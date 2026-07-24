'use strict';

/* ── Shift Control — Cash Board (the one place to do cash) ────────────────────
   Everything cash happens here. Top to bottom: the Safe (balance + safe
   actions), the Registers (a tile per register with Log a Drop / Reconcile Drawer),
   then Cash Activity (the full log, tap a row to edit). Entry and editing run
   through pop-ups + the shared bill counter, so there is one door.

   Cash Drop / Safe Log / Variance Log are now read-only HISTORY views (their own
   filterable list + Export). The board writes and edits through their shared
   persist/remove helpers (S.ShiftCashDrop.persistDrop/removeDrop, S.ShiftSafeLog
   .persistEntry/removeEntry, S.ShiftVarianceLog.persistVariance/removeVariance,
   putRecord/removeRecord safe_count) so a record behaves the same wherever it is
   read. */

S.ShiftCashControl = {
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',            // custom range only
  _safeExpected: null,

  drops()      { return ((App.shiftData && App.shiftData.sc_cash_drops)  || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances)   || []); },
  safeLog()    { return ((App.shiftData && App.shiftData.sc_safe_log)     || []); },
  safeCounts() { return ((App.shiftData && App.shiftData.sc_safe_counts)  || []); },
  drawers()    { return ((App.shiftData && App.shiftData.sc_drawers) || []).filter(d => d.active !== false); },

  // The safe count uses a fixed $10 tolerance; drawer reconciles use the matched
  // register's own tolerance (App.drawerTolerance), set on the Add Register form.
  safeTolerance() { return 10; },

  // One cash-status color scheme used everywhere a count/variance status shows:
  // green = within tolerance (clean), red = short, amber = over, grey = not counted.
  statusColor(status) {
    return status === 'Short' ? 'var(--red)'
      : status === 'Over' ? 'var(--amber)'
      : status === 'Not Counted' ? 'var(--t3)'
      : 'var(--green)';
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  _nowHHMM() { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); },
  _today() { return App.todayLocal(); },
  _mgr() { return App.activeManagerId ? App.activeManagerId() : ''; },

  // Effective date window from the active range chip (recomputed off "today" each
  // draw so This Week stays live); Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  inWindow(date) {
    const { from, to } = this.effectiveRange();
    const d = date || '';
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  },

  currentSafeBalance() {
    return this.safeLog().reduce((bal, e) => {
      const amt = parseFloat(e.amount) || 0;
      return bal + (e.direction === 'out' ? -amt : amt);
    }, 0);
  },

  netInWindow() {
    return this.safeLog().reduce((sum, e) => {
      if (!this.inWindow(e.date)) return sum;
      const amt = parseFloat(e.amount) || 0;
      return sum + (e.direction === 'out' ? -amt : amt);
    }, 0);
  },

  lastSafeCount() {
    const list = this.safeCounts();
    if (!list.length) return null;
    return list.slice().sort((a, b) => {
      const ka = (a.date || '') + 'T' + (a.time || '00:00') + '|' + (a.created_at || '');
      const kb = (b.date || '') + 'T' + (b.time || '00:00') + '|' + (b.created_at || '');
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    })[0];
  },

  drawerStats(d) {
    const drops = this.drops().filter(x => (x.drawer_id === d.id || x.drawer === d.name) && this.inWindow(x.date));
    const dropTotal = drops.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const vars = this.variances().filter(x => x.drawer_id === d.id || x.drawer === d.name);
    // Pick the latest reconcile by its real date. Sorting by created_at is a
    // footgun: seeded records share one created_at, so the tie fell back to
    // array order (insertion-order right after Re-Load vs date-desc after a
    // refresh), which flipped the shown "Last reconcile" date between states.
    const lastVar = App.latestEvent(vars);
    return { dropCount: drops.length, dropTotal, lastVar };
  },

  // Merge safe entries + variances + safe counts into one chronological stream,
  // filtered to the active range, newest first. editCat/editId route a row click
  // to the right edit pop-up.
  activityStream() {
    const out = [];

    this.safeLog().forEach(e => {
      if (!this.inWindow(e.date)) return;
      const isDrop = e.source === 'cash-drop';
      out.push({
        date: e.date, time: e.time || '',
        sortKey: (e.date || '') + 'T' + (e.time || '00:00') + '|' + (e.created_at || ''),
        type: e.txn_type || 'Safe Activity',
        category: 'safe',
        is_drop: isDrop,
        ref: e.reference || '',
        by: e.performed_by || '',
        amount: parseFloat(e.amount) || 0,
        direction: e.direction || 'in',
        status: '',
        editCat: isDrop ? 'safe_drop' : 'safe',
        editId: isDrop ? e.source_id : e.id
      });
    });

    this.variances().forEach(v => {
      if (!this.inWindow(v.date)) return;
      const variance = parseFloat(v.variance) || 0;
      const tol = (v.tolerance != null && !isNaN(v.tolerance)) ? Number(v.tolerance) : App.drawerTolerance(v.drawer_id);
      out.push({
        date: v.date, time: '',
        sortKey: (v.date || '') + '|' + (v.created_at || ''),
        type: 'Drawer Reconcile',
        category: 'variance',
        ref: (v.drawer || '-') + (v.cashier ? ' / ' + v.cashier : ''),
        by: v.cashier || '',
        amount: Math.abs(variance),
        direction: 'none',
        variance,
        status: v.status || (Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over'),
        editCat: 'variance',
        editId: v.id
      });
    });

    this.safeCounts().forEach(c => {
      if (!this.inWindow(c.date)) return;
      const variance = parseFloat(c.variance) || 0;
      out.push({
        date: c.date, time: c.time || '',
        sortKey: (c.date || '') + 'T' + (c.time || '00:00') + '|' + (c.created_at || ''),
        type: 'Safe Count',
        category: 'safe_count',
        ref: 'Counted ' + App.fmtCurrency(c.counted || 0) + ' vs ' + App.fmtCurrency(c.expected || 0) + ' expected',
        by: c.performed_by || '',
        amount: Math.abs(variance),
        direction: 'none',
        variance,
        status: c.status || (Math.abs(variance) <= this.safeTolerance() ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over'),
        editCat: 'safe_count',
        editId: c.id
      });
    });

    return out.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
  },

  // Range chips replace the filter card: chips left, Export right, above the list.
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'cc-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="cc-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="cc-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="cc-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  showHowTo() {
    App.showHelpModal('How Cash Control Works', [
      { p: ['Cash Control is the one place you handle cash. Everything is logged and edited right here, top to bottom: the safe, your registers, then the full activity list.'] },
      { h: 'The Safe', p: ['The big number is what should be in your safe right now, built from every safe entry on file. Cash drops mirror into the safe automatically, so the balance stays honest with no double entry.', 'Make a Deposit, Issue a Bank, or log other safe activity (cash added, paid out) with the buttons here. Count the Safe lets you count what is physically in the safe and catch an over or short against what should be there. A safe count flags the gap, it does not change your running balance.', 'Both the Count the Safe and Log a Drop pop-ups give you a bill counter: punch in how many of each bill, ones through hundreds, drop your coins total on the Coins line, and the amount fills in for you. Skip it and type the amount straight in if you already counted by hand.'] },
      { h: 'Registers', p: ['Each register shows its standard bank, the drops pulled in the date range you picked, and how its last reconcile came out. Log a Drop pulls cash from that register into the safe.', 'Your POS cash report imports on the Shift dashboard each week, and that fills the over or short for every register at once. Reconcile by Hand here is for an off-cycle count, a register with no POS export, or a recount: enter the expected POS cash and what you counted, and Bar Cop logs the variance. Either way it adds a dated reconcile and the tile shows the most recent one.'] },
      { h: 'Filter and Activity', p: ['The range chips above the activity list set the window. It drives the four totals (drops in, safe out, drawer net, flagged variances), the drops shown on each register, and the activity list below.', 'Every drop, deposit, bank move, drawer reconcile, and safe count lands in Cash Activity. Hit Edit on any row to change or delete it. Export PDF next to the chips prints the range you are viewing.'] },
      { h: 'History pages', p: ['Cash Drop History, Safe Log History, and Variance History in the sidebar hold the full filterable record of each type with their own Export. They are read-only. All logging and editing happens here on the board.'] }
    ]);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';   // Export PDF lives on the Filter card now
    this.draw();
  },

  draw() {
    const stream = this.activityStream();
    const hasAny = this.safeLog().length || this.variances().length || this.drops().length || this.safeCounts().length;

    if (!this.drawers().length && !hasAny) {
      App.setupCard(this.container, {
        title: 'Cash Control',
        lead: 'Track the safe, your registers, and every cash move in one place. Set up your registers, then log drops and drawer counts here as the night runs.',
        steps: [
          { title: 'Add your registers', desc: 'Every register you run cash through. Each one gets its own tile here, with its opening bank.', btn: 'Set Up Registers', screen: 'sc-drawers' }
        ]
      });
      return;
    }

    // ── 1. The Safe ──
    const balance = this.currentSafeBalance();
    const lastCount = this.lastSafeCount();
    let countLine = '';
    if (lastCount) {
      const vr = parseFloat(lastCount.variance) || 0;
      const st = lastCount.status || '';
      const col = this.statusColor(st);
      countLine = '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Last safe count ' + this.fmtDate(lastCount.date) + ': '
        + '<span style="color:' + col + ';font-weight:700;">' + (vr > 0 ? '+' : '') + App.fmtCurrency(vr) + '</span> ' + esc(st) + '</div>';
    }
    const safeCard = '<div class="card form-card no-print" style="margin-bottom:16px;">'
      + App.collapsibleCardTitle('sc-cash-safe', 'The Safe')
      + '<div class="collapse-body">'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Current Safe Balance</div>'
      + '<div style="font-size:34px;font-weight:800;color:var(--gold);letter-spacing:0.5px;line-height:1;">' + App.fmtCurrency(balance) + '</div>'
      + countLine
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'
      +   '<button class="btn btn-primary btn-sm" id="cc-deposit">Make a Deposit</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-issue-bank">Issue a Bank</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-safe-activity">Add Cash / Paid Out</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-count-safe">Count the Safe</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-log-drop">Log a Drop</button>'
      + '</div></div></div>';

    // ── 2. Registers ──
    const tile = d => {
      const st = this.drawerStats(d);
      const bank = (d.default_opening_bank != null && d.default_opening_bank !== '') ? App.fmtCurrency(d.default_opening_bank) : '-';
      let reconcileBlock;
      if (st.lastVar) {
        const vr = parseFloat(st.lastVar.variance) || 0;
        const status = st.lastVar.status || '';
        const col = this.statusColor(status);
        const sd = new Date((st.lastVar.date || '') + 'T00:00:00');
        const shortDate = isNaN(sd.getTime()) ? '' : sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        reconcileBlock = '<div style="font-size:12px;color:var(--t2);margin-top:8px;">Last reconcile: <span style="color:var(--t1);font-weight:700;">' + (vr > 0 ? '+' : '') + App.fmtCurrency(vr) + '</span>' + (shortDate ? '<span style="color:var(--t3);margin-left:6px;">(' + shortDate + ')</span>' : '') + '</div>'
          + '<div style="font-size:11px;font-weight:700;color:' + col + ';margin-top:2px;">' + esc(status) + '</div>';
      } else {
        reconcileBlock = '<div style="font-size:12px;color:var(--t4);margin-top:8px;">No reconcile logged yet</div>';
      }
      return '<div style="border:1px solid var(--b-edge);border-radius:var(--r);padding:14px 16px;background:var(--gold-tint);">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">'
        +   '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(d.name) + '</div>'
        +   '<div style="font-size:11px;color:var(--t3);">Bank ' + bank + '</div></div>'
        + reconcileBlock
        + '<div style="display:flex;gap:8px;margin-top:12px;">'
        +   '<button class="btn btn-ghost btn-sm cc-count-drawer" data-id="' + esc(d.id) + '">Reconcile by Hand</button>'
        + '</div></div>';
    };
    const registersCard = '<div class="card form-card no-print" data-collapse-group="sc-cash-safe" style="margin-bottom:16px;"><div class="card-title">Registers</div>'
      + (this.drawers().length
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">' + this.drawers().map(tile).join('') + '</div>'
          : '<div style="font-size:13px;color:var(--t3);">No registers set up yet. Add your registers so each one tracks its drops and closes. <button class="btn btn-ghost btn-sm" id="cc-go-drawers">Set Up Registers</button></div>')
      + '</div>';

    // ── 3. Filter card (date range + net + the four totals) ──
    const drops     = stream.filter(s => s.category === 'safe' && s.is_drop);
    const safeOut   = stream.filter(s => s.category === 'safe' && s.direction === 'out');
    const variances = stream.filter(s => s.category === 'variance');
    const flagged   = variances.filter(v => v.status === 'Over' || v.status === 'Short');
    const netVar    = variances.reduce((s, v) => s + (v.variance || 0), 0);
    const totDrops  = drops.reduce((s, d) => s + d.amount, 0);
    const totOut    = safeOut.reduce((s, e) => s + e.amount, 0);
    const netWin    = this.netInWindow();
    const netColor  = netWin > 0 ? 'var(--gold)' : netWin < 0 ? 'var(--red)' : 'var(--t3)';
    const netLabel  = this.filterPreset === 'all' ? 'Net All Time' : 'Net In Window';

    const netBox = '<div style="margin-left:auto;text-align:right;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + netLabel + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:' + netColor + ';line-height:1.1;">' + (netWin > 0 ? '+' : '') + App.fmtCurrency(netWin) + '</div></div>';

    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Drops In</div><div class="calc-val lg">' + App.fmtCurrency(totDrops) + '</div><div style="font-size:10px;color:var(--t3);">' + drops.length + ' drop' + (drops.length === 1 ? '' : 's') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Safe Out</div><div class="calc-val lg">' + App.fmtCurrency(totOut) + '</div><div style="font-size:10px;color:var(--t3);">deposits and banks</div></div>'
      + '<div class="calc-item"><div class="calc-label">Drawer Net</div><div class="calc-val lg ' + (netVar < 0 ? 'warn' : '') + '">' + (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar) + '</div><div style="font-size:10px;color:var(--t3);">' + variances.length + ' reconcil' + (variances.length === 1 ? 'iation' : 'iations') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val lg ' + (flagged.length ? 'warn' : '') + '">' + flagged.length + '</div><div style="font-size:10px;color:var(--t3);">flagged variances</div></div>'
      + netBox
      + '</div></div>';

    // ── 4. Cash Activity (bare list under the range chips) ──
    let activityBody;
    if (stream.length === 0) {
      activityBody = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Reference</th><th>By</th><th>Amount</th><th>Status</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);padding:16px;">No cash activity in this range. Log a drop, deposit, or safe count above to get started.</td></tr></tbody></table></div>';
    } else {
      const rows = stream.slice(0, App.listLimit('sc', 'cash_activity')).map(s => {
        let amountCell, statusCell;
        if (s.category === 'variance' || s.category === 'safe_count') {
          const sign = s.variance > 0 ? '+' : s.variance < 0 ? '-' : '';
          const sColor = this.statusColor(s.status);
          amountCell = '<span style="color:' + sColor + ';">' + sign + App.fmtCurrency(Math.abs(s.variance || 0)) + '</span>';
          statusCell = '<span style="font-weight:700;color:' + sColor + ';">' + esc(s.status || '') + '</span>';
        } else {
          // Direction is shown by the sign + the In/Out word, not by color.
          const sign = s.direction === 'out' ? '-' : '+';
          amountCell = '<span style="color:var(--t1);">' + sign + App.fmtCurrency(s.amount) + '</span>';
          statusCell = '<span style="font-weight:700;color:var(--t2);">' + (s.direction === 'out' ? 'Out' : 'In') + '</span>';
        }
        return '<tr class="cc-row" data-cat="' + esc(s.editCat) + '" data-id="' + esc(s.editId || '') + '" style="cursor:pointer;">'
          + '<td>' + this.fmtDate(s.date) + (s.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(s.time) + '</div>' : '') + '</td>'
          + '<td><div class="val">' + esc(s.type) + '</div></td>'
          + '<td>' + esc(s.ref || '-') + '</td>'
          + '<td>' + esc(s.by || '-') + '</td>'
          + '<td class="val">' + amountCell + '</td>'
          + '<td>' + statusCell + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm cc-edit" data-cat="' + esc(s.editCat) + '" data-id="' + esc(s.editId || '') + '">Edit</button></div></td>'
        + '</tr>';
      }).join('');
      activityBody = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Reference</th><th>By</th><th>Amount</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    this.container.innerHTML = '<div class="screen">' + safeCard + registersCard + statsCard
      + this.filterRow() + activityBody
      + App.showOlderBar('sc', 'cash_activity', stream, this.filterPreset !== 'all') + '</div>';
    App.applyCollapsed(this.container);

    document.getElementById('cc-export')?.addEventListener('click', () => App.exportPDF({ title: 'Cash Control', root: this.container }));
    document.getElementById('cc-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.draw(); });
    document.getElementById('cc-f-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.draw(); });
    document.getElementById('cc-deposit')?.addEventListener('click', () => this.openSafeMove('Bank Deposit'));
    document.getElementById('cc-issue-bank')?.addEventListener('click', () => this.openSafeMove('Bank Issued'));
    document.getElementById('cc-safe-activity')?.addEventListener('click', () => this.openSafeMove('Paid Out'));
    document.getElementById('cc-count-safe')?.addEventListener('click', () => this.openSafeCount());
    document.getElementById('cc-log-drop')?.addEventListener('click', () => this.openDrop(null, ''));
    document.getElementById('cc-go-drawers')?.addEventListener('click', () => App.navigate('sc-drawers'));

    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.draw()); return; }
      const chip = ev.target.closest('.cc-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.draw();
        return;
      }
      const cdr  = ev.target.closest('.cc-count-drawer');
      const edit = ev.target.closest('.cc-edit');
      const row  = ev.target.closest('.cc-row');
      if (cdr)  { this.openCountDrawer(null, cdr.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.editRow(edit.dataset.cat, edit.dataset.id); return; }
      if (row)  { this.editRow(row.dataset.cat, row.dataset.id); }
    };
  },

  editRow(cat, id) {
    if (cat === 'safe_drop')       { const r = this.drops().find(x => x.id === id);      if (r) this.openDrop(r); }
    else if (cat === 'safe')       { const r = this.safeLog().find(x => x.id === id);    if (r) this.openSafeMove(null, r); }
    else if (cat === 'variance')   { const r = this.variances().find(x => x.id === id);  if (r) this.openCountDrawer(r); }
    else if (cat === 'safe_count') { const r = this.safeCounts().find(x => x.id === id); if (r) this.openSafeCount(r); }
  },

  // ── Shared delete confirm (a small modal above the form) ────────────────────
  // label kept for call-site compatibility; the wording is now the standard box.
  confirmDelete(label, onYes) {
    App.confirmDelete().then(async ok => { if (ok) await onYes(); });
  },

  _delBtn(editing) {
    return editing ? '<button class="btn btn-danger" id="ccm-del" style="margin-left:auto;">Delete</button>' : '';
  },

  // ── Log a Drop (new or edit) ────────────────────────────────────────────────
  // onDone (optional): called after a successful save instead of redrawing the
  // board, so a caller can open this pop-up in place and refresh itself.
  openDrop(rec, drawerId, onDone) {
    const editing = !!rec;
    this._dropOnDone = onDone || null;
    this._newDropId = null;   // a fresh new-drop id per open (S148); saveDrop generates it lazily
    const active    = (App.activeShift && App.activeShift()) || null;
    const dId       = editing ? (rec.drawer_id || rec.drawer) : (drawerId || (active ? active.drawer_id || '' : ''));
    const byId      = editing ? (rec.performed_by_id || rec.performed_by) : (active ? active.manager_id || '' : '');
    const witId     = editing ? (rec.witness_id || rec.witness) : '';
    const v = x => (x != null && x !== '') ? x : '';

    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">' + (editing ? 'Edit Cash Drop' : 'Log a Cash Drop') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:nowrap;">'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Date</label><input type="date" id="ccd-date" value="' + esc(v(rec && rec.date) || this._today()) + '"/></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Time</label><input type="time" id="ccd-time" value="' + esc(v(rec && rec.drop_time) || this._nowHHMM()) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:nowrap;">'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Performed By</label><select id="ccd-by">' + App.staffOptions(byId, { placeholder: 'Select staff...' }) + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Witness</label><select id="ccd-witness">' + App.staffOptions(witId, { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + '<div class="sh" style="margin:16px 0 10px;">Count the Drop</div>'
      + '<div id="ccd-counter">' + CashCounter.html({ prefix: 'ccdrop', values: (rec && rec.denominations) || {} }) + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:flex-end;margin-top:14px;">'
      +   '<div class="f" style="flex:1;min-width:0;"><label>From Register <span style="color:var(--t4);font-weight:400;">(optional)</span></label><select id="ccd-drawer">' + App.drawerOptions(dId, { placeholder: 'No specific register' }) + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Amount Dropped</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccd-amount" min="0" step="0.01" inputmode="decimal" value="' + esc(v(rec && rec.amount)) + '"/></div></div>'
      + '</div>'
      + App.noteField({ id: 'ccd-notes', value: rec?.notes })
      + '<div class="card-actions"><button class="btn btn-primary" id="ccd-save">' + (editing ? 'Update' : 'Save Drop') + '</button>'
      +   '<span id="ccd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>' + this._delBtn(editing) + '</div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 540, onClose: () => { this._dropOnDone = null; App.closeModal('cc-modal'); } });
    const counter = CashCounter.mount(document.getElementById('ccd-counter'), {
      // Only fill Amount from the counter when it is still BLANK, so counting a
      // fresh drop auto-fills it, but a value the manager typed (or a saved amount
      // when editing) is never silently overwritten. The counter fires onChange on
      // mount and on every stepper tap; without this guard, opening an edit or
      // tapping a stepper to spot-check a stack would rewrite the real amount.
      onChange: total => { const a = document.getElementById('ccd-amount'); if (a && total > 0 && !(parseFloat(a.value) > 0)) a.value = total.toFixed(2); }
    });
    document.getElementById('ccd-save')?.addEventListener('click', () => this.saveDrop(counter, editing ? rec.id : null));
    document.getElementById('ccm-del')?.addEventListener('click', () => this.confirmDelete('cash drop', async () => {
      // ⚠ HONOUR the return (S149): removeDrop returns false if the drop or its safe-log mirror did
      // not come out. Reporting success anyway (closing + redrawing) left the operator believing the
      // delete landed while a mirror orphan kept the safe balance $400 high with no way to clean it.
      // Keep the form open on a failure so they can retry (removeDrop re-finds the orphan by source_id).
      if (!(await S.ShiftCashDrop.removeDrop(rec.id))) {
        const e = document.getElementById('ccd-err'); if (e) { e.textContent = 'Could not delete. Try again.'; e.style.display = 'inline'; }
        return;
      }
      App.closeModal('cc-modal'); this.draw();
    }));
  },

  async saveDrop(counter, editId) {
    const err = document.getElementById('ccd-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccd-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('ccd-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter the amount dropped.'); return; }

    // If the manager itemized the drop with the counter, the counted bills MUST
    // match the amount. Never save a drop whose recorded bills disagree with the
    // recorded dollars (that is how the safe silently ends up over/short). If the
    // counter is empty (they typed a round amount without itemizing), trust it.
    const counted = counter ? counter.total() : 0;
    if (counted > 0 && Math.abs(counted - amount) >= 0.01) {
      fail('The bills you counted (' + App.fmtCurrency(counted) + ') do not match the amount dropped (' + App.fmtCurrency(amount) + '). Fix one so they match, or clear the counter.');
      return;
    }

    // ⚠ STABLE ID ACROSS RETRIES (S148). persistDrop writes the drop THEN mirrors it into the safe
    // log; if the drop lands but the mirror is refused it returns false, so a naive retry with a
    // fresh App.uid() minted a SECOND drop (Total Dropped doubled, one drop left with a dangling
    // safe_log_id). Reuse ONE id for the life of this form so the retry UPSERTS the same drop and
    // recreates the mirror instead of duplicating. `editId` still drives the Edit-vs-new label.
    const id = editId || (this._newDropId = this._newDropId || App.uid());
    const existing = this.drops().find(x => x.id === id) || null;
    const drawerId = document.getElementById('ccd-drawer')?.value || '';
    const byId     = document.getElementById('ccd-by')?.value || '';
    const witId    = document.getElementById('ccd-witness')?.value || '';
    const rec = {
      id,
      date,
      drop_time:       document.getElementById('ccd-time')?.value || '',
      drawer_id:       drawerId,
      drawer:          (App.drawerById(drawerId) || {}).name || '',
      performed_by_id: byId,
      performed_by:    (App.staffById(byId) || {}).name || '',
      witness_id:      witId,
      witness:         (App.staffById(witId) || {}).name || '',
      amount,
      denominations:   counter ? counter.denoms() : {},
      notes:           document.getElementById('ccd-notes')?.value.trim() || '',
      safe_log_id:     existing ? (existing.safe_log_id || null) : null,
      created_at:      existing ? existing.created_at : new Date().toISOString()
    };

    const btn = document.getElementById('ccd-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await S.ShiftCashDrop.persistDrop(rec);
    if (ok) {
      this._newDropId = null;
      App.closeModal('cc-modal');
      const cb = this._dropOnDone; this._dropOnDone = null;
      if (cb) cb(); else this.draw();
    } else { if (btn) { btn.disabled = false; btn.textContent = editId ? 'Update' : 'Save Drop'; } fail('Save failed. Try again.'); }
  },

  // ── Safe move: deposit / bank / paid-out (new or edit) ──────────────────────
  openSafeMove(presetType, rec) {
    const editing = !!rec;
    const curType = editing ? rec.txn_type : presetType;
    const typeOpts = S.ShiftSafeLog.TYPES.map(t => '<option' + (t.name === curType ? ' selected' : '') + '>' + t.name + '</option>').join('');
    const titleMap = { 'Bank Deposit': 'Make a Deposit', 'Bank Issued': 'Issue a Bank' };
    const title = editing ? 'Edit Safe Activity' : (titleMap[presetType] || 'Safe Activity');
    const v = x => (x != null && x !== '') ? x : '';
    const byId  = editing ? (rec.performed_by_id || rec.performed_by) : this._mgr();
    const witId = editing ? (rec.witness_id || rec.witness) : '';

    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">' + title + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:nowrap;">'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Date</label><input type="date" id="ccs-date" value="' + esc(v(rec && rec.date) || this._today()) + '"/></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Time</label><input type="time" id="ccs-time" value="' + esc(v(rec && rec.time) || this._nowHHMM()) + '"/></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Type</label><select id="ccs-type">' + typeOpts + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Direction</label><div class="f-display" id="ccs-dir">-</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:nowrap;">'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccs-amount" min="0" step="0.01" inputmode="decimal" value="' + esc(v(rec && rec.amount)) + '"/></div></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Reference</label><input type="text" id="ccs-ref" value="' + esc((rec && rec.reference) || '') + '" placeholder="e.g. Deposit #, Bar 1"/></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Performed By</label><select id="ccs-by">' + App.staffOptions(byId, { placeholder: 'Select staff...' }) + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Witness</label><select id="ccs-witness">' + App.staffOptions(witId, { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + App.noteField({ id: 'ccs-notes', value: rec?.notes })
      + '<div class="card-actions"><button class="btn btn-primary" id="ccs-save">' + (editing ? 'Update' : 'Save') + '</button>'
      +   '<span id="ccs-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>' + this._delBtn(editing) + '</div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 540, noClose: true });
    const updateDir = () => {
      const dir = S.ShiftSafeLog.dirOf(document.getElementById('ccs-type')?.value);
      const el = document.getElementById('ccs-dir');
      if (el) { el.textContent = dir === 'out' ? 'Out of safe' : 'Into safe'; el.style.color = dir === 'out' ? 'var(--red)' : 'var(--gold)'; }
    };
    document.getElementById('ccs-type')?.addEventListener('change', updateDir);
    document.getElementById('ccs-save')?.addEventListener('click', () => this.saveSafeMove(editing ? rec.id : null));
    document.getElementById('ccm-del')?.addEventListener('click', () => this.confirmDelete('safe entry', async () => {
      await S.ShiftSafeLog.removeEntry(rec.id); App.closeModal('cc-modal'); this.draw();
    }));
    updateDir();
  },

  async saveSafeMove(editId) {
    const err = document.getElementById('ccs-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccs-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('ccs-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter an amount.'); return; }

    const existing = editId ? this.safeLog().find(x => x.id === editId) : null;
    const txnType = document.getElementById('ccs-type')?.value || '';
    const byId    = document.getElementById('ccs-by')?.value || '';
    const witId   = document.getElementById('ccs-witness')?.value || '';
    const rec = {
      id: editId || App.uid(),
      date,
      time:            document.getElementById('ccs-time')?.value || '',
      txn_type:        txnType,
      direction:       S.ShiftSafeLog.dirOf(txnType),
      amount,
      reference:       document.getElementById('ccs-ref')?.value.trim() || '',
      performed_by_id: byId,
      performed_by:    (App.staffById(byId) || {}).name || '',
      witness_id:      witId,
      witness:         (App.staffById(witId) || {}).name || '',
      notes:           document.getElementById('ccs-notes')?.value.trim() || '',
      created_at:      existing ? existing.created_at : new Date().toISOString()
    };

    const btn = document.getElementById('ccs-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await S.ShiftSafeLog.persistEntry(rec);
    if (ok) { App.closeModal('cc-modal'); this.draw(); }
    else { if (btn) { btn.disabled = false; btn.textContent = editId ? 'Update' : 'Save'; } fail('Save failed. Try again.'); }
  },

  // ── Count the Safe (new or edit) ────────────────────────────────────────────
  openSafeCount(rec) {
    const editing = !!rec;
    const expected = editing ? (parseFloat(rec.expected) || 0) : this.currentSafeBalance();
    const tol = this.safeTolerance();
    this._safeExpected = expected;
    const v = x => (x != null && x !== '') ? x : '';
    const byId  = editing ? (rec.performed_by_id || rec.performed_by) : this._mgr();
    const witId = editing ? (rec.witness_id || rec.witness) : '';

    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">' + (editing ? 'Edit Safe Count' : 'Count the Safe') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;min-width:0;"><label>Date</label><input type="date" id="ccc-date" value="' + esc(v(rec && rec.date) || this._today()) + '"/></div>'
      +   '<div class="f" style="width:130px;min-width:0;"><label>Time</label><input type="time" id="ccc-time" value="' + esc(v(rec && rec.time) || this._nowHHMM()) + '"/></div>'
      + '</div>'
      + '<div class="sh" style="margin:8px 0 10px;">Count the Safe</div>'
      + '<div id="ccc-counter">' + CashCounter.html({ prefix: 'ccsafe', values: (rec && rec.denominations) || {} }) + '</div>'
      + '<div class="calc" style="margin-top:14px;">'
      +   '<div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val" id="ccc-counted">$0</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Expected</div><div class="calc-val dim">' + App.fmtCurrency(expected) + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Over / Short</div><div class="calc-val" id="ccc-variance">-</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val" id="ccc-status">-</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-top:6px;">'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Performed By</label><select id="ccc-by">' + App.staffOptions(byId, { placeholder: 'Select staff...' }) + '</select></div>'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Witness</label><select id="ccc-witness">' + App.staffOptions(witId, { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + App.noteField({ id: 'ccc-notes', value: rec?.notes })
      + '<div class="card-actions"><button class="btn btn-primary" id="ccc-save">' + (editing ? 'Update' : 'Save Count') + '</button>'
      +   '<span id="ccc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>' + this._delBtn(editing) + '</div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 540, noClose: true });
    const update = total => {
      const cEl = document.getElementById('ccc-counted');
      const varEl = document.getElementById('ccc-variance');
      const stEl = document.getElementById('ccc-status');
      if (cEl) cEl.textContent = App.fmtCurrency(total);
      const variance = Math.round((total - expected) * 100) / 100;
      const status = Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over';
      const col = this.statusColor(status);
      if (varEl) { varEl.textContent = (variance > 0 ? '+' : '') + App.fmtCurrency(variance); varEl.className = 'calc-val'; varEl.style.color = col; }
      if (stEl) { stEl.textContent = status; stEl.className = 'calc-val'; stEl.style.color = col; }
    };
    const counter = CashCounter.mount(document.getElementById('ccc-counter'), { onChange: total => update(total) });
    update(counter ? counter.total() : 0);
    document.getElementById('ccc-save')?.addEventListener('click', () => this.saveSafeCount(counter, editing ? rec.id : null));
    document.getElementById('ccm-del')?.addEventListener('click', () => this.confirmDelete('safe count', async () => {
      await App.removeRecord('sc', 'safe_count', rec.id); App.closeModal('cc-modal'); this.draw();
    }));
  },

  async saveSafeCount(counter, editId) {
    const err = document.getElementById('ccc-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccc-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const counted = counter ? counter.total() : 0;
    if (counted <= 0) { fail('Count the safe first.'); return; }

    const existing = editId ? this.safeCounts().find(x => x.id === editId) : null;
    const expected = (this._safeExpected != null) ? this._safeExpected : this.currentSafeBalance();
    const variance = Math.round((counted - expected) * 100) / 100;
    const tol = this.safeTolerance();
    const status = Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over';
    const byId  = document.getElementById('ccc-by')?.value || '';
    const witId = document.getElementById('ccc-witness')?.value || '';
    const rec = {
      id: editId || App.uid(),
      date,
      time:            document.getElementById('ccc-time')?.value || '',
      counted, expected, variance, tolerance: tol, status,
      denominations:   counter ? counter.denoms() : {},
      performed_by_id: byId,
      performed_by:    (App.staffById(byId) || {}).name || '',
      witness_id:      witId,
      witness:         (App.staffById(witId) || {}).name || '',
      notes:           document.getElementById('ccc-notes')?.value.trim() || '',
      created_at:      existing ? existing.created_at : new Date().toISOString()
    };

    const btn = document.getElementById('ccc-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'safe_count', rec);
    if (ok) { App.closeModal('cc-modal'); this.draw(); }
    else { if (btn) { btn.disabled = false; btn.textContent = editId ? 'Update' : 'Save Count'; } fail('Save failed. Try again.'); }
  },

  // ── Reconcile Drawer (new or edit) — count a drawer vs POS by hand ──────────
  // The POS cash-report import lives on the Shift dashboard (the weekly close-out),
  // so this is always a hand count. One drop-zone for the report, not two.
  openCountDrawer(rec, drawerId) {
    const editing = !!rec;
    const active    = (App.activeShift && App.activeShift()) || null;
    const dId       = editing ? (rec.drawer_id || rec.drawer) : (drawerId || (active ? active.drawer_id || '' : ''));
    const cashId    = editing ? (rec.cashier_id || rec.cashier) : '';
    const reasonOpts = '<option value="">Select reason...</option>'
      + S.ShiftVarianceLog.REASONS.map(r => '<option' + (rec && rec.reason === r ? ' selected' : '') + '>' + r + '</option>').join('');
    const v = x => (x != null && x !== '') ? x : '';

    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">' + (editing ? 'Edit Drawer Reconcile' : 'Reconcile Drawer') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:nowrap;">'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Date</label><input type="date" id="ccv-date" value="' + esc(v(rec && rec.date) || this._today()) + '"/></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Register</label><select id="ccv-drawer">' + App.drawerOptions(dId, { placeholder: 'Select register...' }) + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Cashier</label><select id="ccv-cashier">' + App.staffOptions(cashId, { placeholder: 'Select staff...', audience: 'service' }) + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Expected Cash (POS)</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccv-expected" min="0" step="0.01" value="' + esc(v(rec && rec.expected_cash)) + '"/></div></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Counted Cash</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccv-counted" min="0" step="0.01" value="' + esc(v(rec && rec.counted_cash)) + '"/></div></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>Reason</label><select id="ccv-reason">' + reasonOpts + '</select></div>'
      + '</div>'
      + '<div class="calc">'
      +   '<div class="calc-item"><div class="calc-label">Variance</div><div class="calc-val" id="ccv-c-variance">-</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val" id="ccv-c-status">-</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Tolerance</div><div class="calc-val dim" id="ccv-c-tol">&plusmn;' + App.fmtCurrency(App.drawerTolerance(this._effectiveDrawerId(dId))) + '</div></div>'
      + '</div>'
      + App.noteField({ id: 'ccv-notes', value: rec?.notes })
      + '<div class="card-actions"><button class="btn btn-primary" id="ccv-save">' + (editing ? 'Update' : 'Save Count') + '</button>'
      +   '<span id="ccv-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>' + this._delBtn(editing) + '</div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 540, noClose: true });
    const calc = () => {
      const drawerId = this._effectiveDrawerId(document.getElementById('ccv-drawer')?.value || '');
      const tolEl = document.getElementById('ccv-c-tol');
      if (tolEl) tolEl.textContent = '±' + App.fmtCurrency(App.drawerTolerance(drawerId));
      const exp = parseFloat(document.getElementById('ccv-expected')?.value);
      const cnt = parseFloat(document.getElementById('ccv-counted')?.value);
      const varEl = document.getElementById('ccv-c-variance');
      const stEl = document.getElementById('ccv-c-status');
      if (!varEl || !stEl) return;
      if (isNaN(exp) || isNaN(cnt)) { varEl.textContent = '-'; varEl.className = 'calc-val'; stEl.textContent = '-'; stEl.className = 'calc-val'; return; }
      const variance = Math.round((cnt - exp) * 100) / 100;
      const status = S.ShiftVarianceLog.statusOf(variance, exp, cnt, drawerId);
      const col = this.statusColor(status);
      varEl.textContent = (variance > 0 ? '+' : '') + App.fmtCurrency(variance); varEl.className = 'calc-val'; varEl.style.color = col;
      stEl.textContent = status; stEl.className = 'calc-val'; stEl.style.color = col;
    };
    document.getElementById('ccv-drawer')?.addEventListener('change', calc);
    document.getElementById('ccv-expected')?.addEventListener('input', calc);
    document.getElementById('ccv-counted')?.addEventListener('input', calc);
    document.getElementById('ccv-save')?.addEventListener('click', () => this.saveCountDrawer(editing ? rec.id : null));
    document.getElementById('ccm-del')?.addEventListener('click', () => this.confirmDelete('drawer count', async () => {
      await S.ShiftVarianceLog.removeVariance(rec.id); App.closeModal('cc-modal'); this.draw();
    }));
    calc();
  },

  // ⚠ S187: a blank register on a bar with exactly ONE active register resolves to that register
  // (matching buildCash's soleDrawer over the same sc_drawers list), so the live preview AND the
  // saved row agree on tolerance/status, and a hand count shares a key with a column-less import
  // (date|d1) instead of keying at date|'' and being double-counted. 0 or 2+ active stays day-level.
  _effectiveDrawerId(rawId) {
    if (rawId) return rawId;
    const active = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(d => d && d.active !== false);
    return active.length === 1 ? active[0].id : '';
  },

  async saveCountDrawer(editId) {
    const err = document.getElementById('ccv-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccv-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const exp = parseFloat(document.getElementById('ccv-expected')?.value);
    const cnt = parseFloat(document.getElementById('ccv-counted')?.value);
    if (isNaN(exp) || isNaN(cnt)) { fail('Enter expected and counted cash.'); return; }
    if (exp === 0 && cnt === 0) { fail('Both expected and counted are zero. Log the real numbers or cancel.'); return; }

    const existing = editId ? this.variances().find(x => x.id === editId) : null;
    const variance = Math.round((cnt - exp) * 100) / 100;
    // ⚠ S187: normalize a blank register to the sole active drawer (see _effectiveDrawerId) so a hand
    // count on a 1-register bar shares a buildCash key (date|d1 via soleDrawer) with a column-less
    // import instead of keying at date|'' and being double-counted — and so the live preview agrees.
    const drawerId = this._effectiveDrawerId(document.getElementById('ccv-drawer')?.value || '');
    // ⚠ There was NO duplicate check here at all: this minted a fresh id and wrote, so counting the
    // same register twice for one day (a typo re-entered instead of using Edit, or a recount) put
    // TWO rows in and that drawer-day was counted twice in Drawer Net, the short rate, Loss
    // Prevention and the Books cash sheet. Ask rather than refuse — an off-cycle second count is a
    // real thing, it just must not happen by accident. `editId` excluded so editing a count is
    // never treated as a duplicate of itself.
    const sameDay = this.variances().filter(x => x && x.id !== editId
      && x.date === date && (x.drawer_id || '') === drawerId);
    if (sameDay.length) {
      // Show the MOST RECENT prior count, not sameDay[0] (array position) — the ordering-flip class.
      // Reachable once a deliberate "Add anyway" second count exists, or from imported duplicates.
      const prior = sameDay.sort(App.cmpNewest)[0];
      const ok = await App.confirm({
        title: 'This register is already counted for that day',
        message: (prior.drawer || 'That register') + ' on ' + date + ' is already logged at '
          + App.fmtCurrency(prior.variance || 0) + '. Adding another counts the day twice everywhere.'
          + ' Cancel and use Edit on the existing count unless this really is a second, separate count.',
        confirmText: 'Add anyway', cancelText: 'Cancel', danger: true
      });
      if (!ok) return;   // runs before the Save button is disabled below, so nothing to restore
    }
    const cashId   = document.getElementById('ccv-cashier')?.value || '';
    const rec = {
      id: editId || App.uid(),
      date,
      drawer_id:     drawerId,
      drawer:        (App.drawerById(drawerId) || {}).name || '',
      cashier_id:    cashId,
      cashier:       (App.staffById(cashId) || {}).name || '',
      // ⚠ ALWAYS 'manual', never the row's previous source (S100). This function is only ever
      // reached by a human filling in the hand form and pressing Save, so whatever comes out of
      // it IS a hand count — including a correction to a figure that originally arrived by
      // import. Carrying the old 'import' through meant buildCash's protect gate did not
      // recognise the operator's own recount, so the next cash file REPLACED it and reported
      // "1 replaced earlier figures": they imported -47.00, opened it, counted the drawer
      // properly, saved -63.25, and a re-drop silently put -47.00 back.
      // All three readers of this field agree with that reading — pos-ingest's manualKeys (never
      // queue over it), _findDup (never a replacement candidate) and _commitCashRows (never
      // retire it) — and `source` is not displayed anywhere, so nothing else shifts.
      source:        'manual',
      expected_cash: exp,
      counted_cash:  cnt,
      variance,
      tolerance:     S.ShiftVarianceLog.tolerance(drawerId),
      status:        S.ShiftVarianceLog.statusOf(variance, exp, cnt, drawerId),
      reason:        document.getElementById('ccv-reason')?.value || '',
      notes:         document.getElementById('ccv-notes')?.value.trim() || '',
      created_at:    existing ? existing.created_at : new Date().toISOString()
    };

    const btn = document.getElementById('ccv-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await S.ShiftVarianceLog.persistVariance(rec);
    if (ok) { App.closeModal('cc-modal'); this.draw(); }
    else { if (btn) { btn.disabled = false; btn.textContent = editId ? 'Update' : 'Save Count'; } fail('Save failed. Try again.'); }
  }
};
