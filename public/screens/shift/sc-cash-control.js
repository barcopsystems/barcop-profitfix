'use strict';

/* ── Shift Control — Cash Board (the cash command center) ─────────────────────
   One screen for everything cash. The Safe up top shows the running balance and
   the safe actions (deposit, issue a bank, other activity, count the safe).
   Register tiles show each drawer's bank, drops this window, and last close, with
   Log a Drop / Count Drawer on each. The activity list below merges every safe
   move, drawer reconcile, and safe count, filtered by date range.

   The three log screens (Cash Drop, Safe Log, Variance Log) stay as the full
   history/edit doors. The board's pop-up actions write the SAME records through
   the same persistence path (S.ShiftCashDrop.persistDrop / S.ShiftSafeLog
   .persistEntry / putRecord safe_count) so there is one source of truth. */

S.ShiftCashControl = {
  range: '30',   // '7' | '30' | '90' | '365' | 'all'
  _safeExpected: null,

  drops()      { return ((App.shiftData && App.shiftData.sc_cash_drops)  || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances)   || []); },
  safeLog()    { return ((App.shiftData && App.shiftData.sc_safe_log)     || []); },
  safeCounts() { return ((App.shiftData && App.shiftData.sc_safe_counts)  || []); },
  drawers()    { return ((App.shiftData && App.shiftData.sc_drawers) || []).filter(d => d.active !== false); },

  tolerance() {
    const t = App.cashToleranceForShift(null);
    return (t != null && !isNaN(t)) ? Number(t) : 10;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  startDate() {
    if (this.range === 'all') return '';
    const days = parseInt(this.range, 10) || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  },

  // Running safe balance from EVERY safe log entry on file (lifetime, not window).
  currentSafeBalance() {
    return this.safeLog().reduce((bal, e) => {
      const amt = parseFloat(e.amount) || 0;
      return bal + (e.direction === 'out' ? -amt : amt);
    }, 0);
  },

  // Net safe movement inside the active date range.
  netInWindow() {
    const start = this.startDate();
    return this.safeLog().reduce((sum, e) => {
      if (start && e.date < start) return sum;
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

  // Per-drawer rollup: drops this window + the most recent close (variance).
  drawerStats(d) {
    const start = this.startDate();
    const inWin = dt => !start || (dt || '') >= start;
    const drops = this.drops().filter(x => (x.drawer_id === d.id || x.drawer === d.name) && inWin(x.date));
    const dropTotal = drops.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const vars = this.variances().filter(x => x.drawer_id === d.id || x.drawer === d.name);
    const lastVar = vars.slice().sort((a, b) =>
      new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime())[0] || null;
    return { dropCount: drops.length, dropTotal, lastVar };
  },

  // Merge safe entries + variances + safe counts into one chronological stream,
  // filtered to the active range, newest first.
  activityStream() {
    const start = this.startDate();
    const out = [];

    this.safeLog().forEach(e => {
      if (start && e.date < start) return;
      out.push({
        date: e.date, time: e.time || '',
        sortKey: (e.date || '') + 'T' + (e.time || '00:00') + '|' + (e.created_at || ''),
        type: e.txn_type || 'Safe Activity',
        category: 'safe',
        is_drop: e.source === 'cash-drop',
        ref: e.reference || '',
        by: e.performed_by || '',
        amount: parseFloat(e.amount) || 0,
        direction: e.direction || 'in',
        status: '',
        source_screen: e.source === 'cash-drop' ? 'sc-cash-drop' : 'sc-safe-log',
        source_id: e.source === 'cash-drop' ? e.source_id : e.id
      });
    });

    this.variances().forEach(v => {
      if (start && v.date < start) return;
      const variance = parseFloat(v.variance) || 0;
      const tol = (v.tolerance != null && !isNaN(v.tolerance)) ? Number(v.tolerance) : this.tolerance();
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
        source_screen: 'sc-variance-log',
        source_id: v.id
      });
    });

    this.safeCounts().forEach(c => {
      if (start && c.date < start) return;
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
        status: c.status || (Math.abs(variance) <= this.tolerance() ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over'),
        source_screen: '',
        source_id: c.id
      });
    });

    return out.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
  },

  rangeOptions() {
    const opts = [['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['365', 'Last 12 Months'], ['all', 'All Time']];
    return opts.map(([v, l]) => '<option value="' + v + '"' + (this.range === v ? ' selected' : '') + '>' + l + '</option>').join('');
  },

  showHowTo() {
    App.showHelpModal('How the Cash Board Works', [
      { p: ['The Cash Board is one place for everything cash. The Safe up top shows what should be in your safe right now, built from every safe entry on file. Cash drops mirror into the safe automatically, so the balance stays honest with no double entry.'] },
      { h: 'The Safe', p: ['Make a Deposit, Issue a Bank, or log other safe activity right here without leaving the board. Count the Safe lets you count what is physically in the safe and catch an over or short against what should be there. A safe count flags the gap, it does not change your running balance.'] },
      { h: 'Registers', p: ['Each drawer shows its standard bank, the drops pulled this window, and how its last close came out. Log a Drop pulls cash from that register into the safe. Count Drawer opens the variance form to reconcile the counted drawer against the POS at close.'] },
      { h: 'Cash Activity', p: ['Every drop, deposit, bank move, drawer reconcile, and safe count lands in the list below, filtered by the date range you pick. Tap a row to open it in its own log for a full edit.'] }
    ]);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) {
      actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="cc-export">Export PDF</button>';
      document.getElementById('cc-export')?.addEventListener('click', () => App.exportPDF({ title: 'Cash Control', root: this.container }));
    }
    this.draw();
  },

  draw() {
    const stream  = this.activityStream();
    const hasAny  = this.safeLog().length || this.variances().length || this.drops().length || this.safeCounts().length;

    // Day-one: no drawers and nothing logged. Guide setup, then this becomes the
    // live board the moment cash starts moving.
    if (!this.drawers().length && !hasAny) {
      App.setupCard(this.container, {
        title: 'Cash Board',
        lead: 'Track the safe, your drawers, and every cash move in one place. Set up your registers, then open the floor to start logging drops and closes.',
        steps: [
          { title: 'Add your drawers and registers', desc: 'Every register you run cash through. Each one gets its own tile here.', btn: 'Set Up Drawers', screen: 'sc-drawers' },
          { title: 'Open the floor', desc: 'Start a shift to set opening banks and log drops as the night runs.', btn: 'Go to Active Shift', screen: 'sc-active-shift' }
        ]
      });
      return;
    }

    const balance = this.currentSafeBalance();

    // ── Safe hero ──
    const lastCount = this.lastSafeCount();
    let countLine = '';
    if (lastCount) {
      const vr = parseFloat(lastCount.variance) || 0;
      const st = lastCount.status || '';
      const col = st === 'Short' ? 'var(--red)' : st === 'Over' ? 'var(--amber)' : 'var(--green)';
      countLine = '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Last safe count ' + this.fmtDate(lastCount.date) + ': '
        + '<span style="color:' + col + ';font-weight:700;">' + (vr >= 0 ? '+' : '') + App.fmtCurrency(vr) + '</span> ' + esc(st) + '</div>';
    }
    const hero = '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>The Safe</span>' + App.helpButton('cc-how') + '</div>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Current Safe Balance</div>'
      + '<div style="font-size:34px;font-weight:800;color:var(--gold);letter-spacing:0.5px;line-height:1;">' + App.fmtCurrency(balance) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;">Running total from every Safe Log entry on file. Cash drops mirror into the safe automatically.</div>'
      + countLine
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'
      +   '<button class="btn btn-primary btn-sm" id="cc-deposit">Make a Deposit</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-issue-bank">Issue a Bank</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-safe-activity">Add Cash / Paid Out</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cc-count-safe">Count the Safe</button>'
      + '</div></div>';

    // ── Range control + net-in-window ──
    const netWin = this.netInWindow();
    const netColor = netWin > 0 ? 'var(--gold)' : netWin < 0 ? 'var(--red)' : 'var(--t3)';
    const netLabel = this.range === 'all' ? 'Net All Time' : 'Net In Window';
    const controls = '<div class="form-row" style="margin-bottom:14px;align-items:center;gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Date Range</label>'
      + '<select id="cc-range">' + this.rangeOptions() + '</select></div>'
      + '<div style="font-size:11px;color:var(--t3);align-self:flex-end;padding-bottom:10px;flex:1;min-width:180px;">'
        + (this.range === 'all' ? 'All cash activity on file.' : 'Activity from ' + this.fmtDate(this.startDate()) + ' to today.')
      + '</div>'
      + '<div style="align-self:flex-end;padding-bottom:6px;text-align:right;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + netLabel + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:' + netColor + ';line-height:1.1;">'
        + (netWin >= 0 ? '+' : '') + App.fmtCurrency(netWin) + '</div>'
      + '</div></div>';

    // ── Window tiles ──
    const drops     = stream.filter(s => s.category === 'safe' && s.is_drop);
    const safeOut   = stream.filter(s => s.category === 'safe' && s.direction === 'out');
    const variances = stream.filter(s => s.category === 'variance');
    const flagged   = variances.filter(v => v.status === 'Over' || v.status === 'Short');
    const netVar    = variances.reduce((s, v) => s + (v.variance || 0), 0);
    const totDrops  = drops.reduce((s, d) => s + d.amount, 0);
    const totOut    = safeOut.reduce((s, e) => s + e.amount, 0);
    const winWord   = this.range === 'all' ? 'all time' : 'this window';

    const tiles = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Drops In</div><div class="calc-val">' + App.fmtCurrency(totDrops) + '</div><div style="font-size:10px;color:var(--t3);">' + drops.length + ' drop' + (drops.length === 1 ? '' : 's') + ', ' + winWord + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Safe Out</div><div class="calc-val">' + App.fmtCurrency(totOut) + '</div><div style="font-size:10px;color:var(--t3);">deposits and banks, ' + winWord + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Drawer Net</div><div class="calc-val ' + (netVar < 0 ? 'warn' : '') + '">' + (netVar >= 0 ? '+' : '') + App.fmtCurrency(netVar) + '</div><div style="font-size:10px;color:var(--t3);">' + variances.length + ' reconcil' + (variances.length === 1 ? 'iation' : 'iations') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged.length > 0 ? 'warn' : '') + '">' + flagged.length + '</div><div style="font-size:10px;color:var(--t3);">flagged variances</div></div>'
    + '</div>';

    // ── Register tiles ──
    const tile = d => {
      const st = this.drawerStats(d);
      const bank = (d.default_opening_bank != null && d.default_opening_bank !== '') ? App.fmtCurrency(d.default_opening_bank) : '-';
      let closeLine;
      if (st.lastVar) {
        const vr = parseFloat(st.lastVar.variance) || 0;
        const status = st.lastVar.status || '';
        const col = status === 'Short' ? 'var(--red)' : status === 'Over' ? 'var(--amber)' : status === 'Not Counted' ? 'var(--t3)' : 'var(--green)';
        closeLine = '<span style="color:' + col + ';font-weight:700;">' + (vr >= 0 ? '+' : '') + App.fmtCurrency(vr) + '</span> '
          + '<span style="color:var(--t3);">' + esc(status) + ' (' + this.fmtDate(st.lastVar.date) + ')</span>';
      } else {
        closeLine = '<span style="color:var(--t4);">No close logged yet</span>';
      }
      return '<div style="border:1px solid var(--b1);border-radius:6px;padding:14px 16px;background:var(--surface);">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">'
        +   '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(d.name) + '</div>'
        +   '<div style="font-size:11px;color:var(--t3);">Bank ' + bank + '</div></div>'
        + '<div style="font-size:12px;color:var(--t2);margin-top:8px;">Drops ' + winWord + ': <span style="color:var(--t1);font-weight:700;">' + App.fmtCurrency(st.dropTotal) + '</span> <span style="color:var(--t3);">(' + st.dropCount + ')</span></div>'
        + '<div style="font-size:12px;margin-top:4px;">Last close: ' + closeLine + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:12px;">'
        +   '<button class="btn btn-ghost btn-sm cc-drop" data-id="' + esc(d.id) + '">Log a Drop</button>'
        +   '<button class="btn btn-ghost btn-sm cc-count-drawer" data-id="' + esc(d.id) + '">Count Drawer</button>'
        + '</div></div>';
    };
    const drawersCard = '<div class="card"><div class="card-title">Registers</div>'
      + (this.drawers().length
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">' + this.drawers().map(tile).join('') + '</div>'
          : '<div style="font-size:13px;color:var(--t3);">No drawers set up yet. Add your registers so each one tracks its drops and closes. <button class="btn btn-ghost btn-sm" id="cc-go-drawers">Set Up Drawers</button></div>')
      + '</div>';

    // ── Activity table ──
    let body;
    if (stream.length === 0) {
      body = '<div class="empty">'
        + '<div class="empty-title">No cash activity in this range</div>'
        + '<div class="empty-sub">Cash drops, drawer reconciliations, safe counts, and safe activity all show here once they are logged.</div>'
      + '</div>';
    } else {
      const rows = stream.map(s => {
        let amountCell, statusCell;
        if (s.category === 'variance' || s.category === 'safe_count') {
          const isFlag = s.status === 'Over' || s.status === 'Short';
          const sign = s.variance > 0 ? '+' : s.variance < 0 ? '-' : '';
          amountCell = '<span class="' + (isFlag ? 'neg' : 'pos') + '">' + sign + App.fmtCurrency(Math.abs(s.variance || 0)) + '</span>';
          const sColor = s.status === 'Short' ? 'var(--red)' : s.status === 'Over' ? 'var(--amber)' : s.status === 'Not Counted' ? 'var(--t3)' : 'var(--green)';
          statusCell = '<span style="font-weight:700;color:' + sColor + ';">' + esc(s.status || '') + '</span>';
        } else {
          const sign = s.direction === 'out' ? '-' : '+';
          amountCell = '<span class="' + (s.direction === 'out' ? 'neg' : 'pos') + '">' + sign + App.fmtCurrency(s.amount) + '</span>';
          statusCell = s.direction === 'out'
            ? '<span style="font-weight:700;color:var(--t3);">Out</span>'
            : '<span style="font-weight:700;color:var(--gold);">In</span>';
        }
        const clickable = !!s.source_screen;
        return '<tr' + (clickable ? ' class="cc-row" data-screen="' + esc(s.source_screen) + '" style="cursor:pointer;"' : '') + '>'
          + '<td>' + this.fmtDate(s.date) + (s.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(s.time) + '</div>' : '') + '</td>'
          + '<td><div class="val">' + esc(s.type) + '</div></td>'
          + '<td>' + esc(s.ref || '-') + '</td>'
          + '<td>' + esc(s.by || '-') + '</td>'
          + '<td class="val">' + amountCell + '</td>'
          + '<td>' + statusCell + '</td>'
        + '</tr>';
      }).join('');
      body = '<div class="sh" style="margin:6px 0 10px;">Cash Activity</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Reference</th><th>By</th><th>Amount</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + hero + controls + tiles + drawersCard + body + '</div>';

    document.getElementById('cc-range')?.addEventListener('change', e => { this.range = e.target.value; this.draw(); });
    document.getElementById('cc-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('cc-deposit')?.addEventListener('click', () => this.openSafeMove('Bank Deposit'));
    document.getElementById('cc-issue-bank')?.addEventListener('click', () => this.openSafeMove('Bank Issued'));
    document.getElementById('cc-safe-activity')?.addEventListener('click', () => this.openSafeMove('Paid Out'));
    document.getElementById('cc-count-safe')?.addEventListener('click', () => this.openSafeCount());
    document.getElementById('cc-go-drawers')?.addEventListener('click', () => App.navigate('sc-drawers'));

    this.container.onclick = ev => {
      const drop = ev.target.closest('.cc-drop');
      const cd   = ev.target.closest('.cc-count-drawer');
      const row  = ev.target.closest('.cc-row');
      if (drop) { this.openDrop(drop.dataset.id); return; }
      if (cd)   { S.ShiftVarianceLog._openNew = { drawer_id: cd.dataset.id }; App.navigate('sc-variance-log'); return; }
      if (row && row.dataset.screen) App.navigate(row.dataset.screen);
    };
  },

  _nowHHMM() {
    const n = new Date();
    return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  },
  _today() { return new Date().toISOString().slice(0, 10); },
  _mgr() { return App.activeManagerId ? App.activeManagerId() : ''; },

  // ── Log a Drop (pop-up, writes through S.ShiftCashDrop.persistDrop) ─────────
  openDrop(drawerId) {
    const active    = (App.activeShift && App.activeShift()) || null;
    const dId       = drawerId || (active ? active.drawer_id || '' : '');
    const shiftType = active ? active.shift_type || '' : '';
    const byId      = active ? active.manager_id || '' : '';
    const typeOpts  = App.SHIFT_TYPES.map(t => '<option' + (shiftType === t ? ' selected' : '') + '>' + t + '</option>').join('');

    const html = '<div class="card" style="margin:0;"><div class="card-title">Log a Cash Drop</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;min-width:0;"><label>Date</label><input type="date" id="ccd-date" value="' + this._today() + '" style="height:44px;"/></div>'
      +   '<div class="f" style="width:150px;min-width:0;"><label>Shift Type</label><select id="ccd-type" style="height:44px;">' + typeOpts + '</select></div>'
      +   '<div class="f" style="width:130px;min-width:0;"><label>Time</label><input type="time" id="ccd-time" value="' + this._nowHHMM() + '" style="height:44px;"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:220px;min-width:0;"><label>Drawer / Register</label><select id="ccd-drawer" style="height:44px;">' + App.drawerOptions(dId, { placeholder: 'Select drawer...' }) + '</select></div>'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Performed By</label><select id="ccd-by" style="height:44px;">' + App.staffOptions(byId, { placeholder: 'Select staff...' }) + '</select></div>'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Witness</label><select id="ccd-witness" style="height:44px;">' + App.staffOptions('', { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + '<div class="sh" style="margin:16px 0 10px;">Count the Drop</div>'
      + '<div id="ccd-counter">' + CashCounter.html({ prefix: 'ccdrop' }) + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:flex-end;margin-top:14px;">'
      +   '<div class="f" style="width:200px;min-width:0;"><label>Amount Dropped</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccd-amount" min="0" step="0.01" inputmode="decimal" style="height:48px;font-size:20px;"/></div></div>'
      +   '<div class="f" style="flex:1;min-width:0;"><label>&nbsp;</label><div style="font-size:12px;color:var(--t3);padding-bottom:12px;">Counts auto-fill here. Edit directly if you are not counting by bill.</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="ccd-notes" rows="2" placeholder="Optional"></textarea></div></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ccd-save">Save Drop</button><button class="btn btn-ghost" id="ccd-cancel">Cancel</button>'
      +   '<span id="ccd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 640 });
    const counter = CashCounter.mount(document.getElementById('ccd-counter'), {
      onChange: total => { const a = document.getElementById('ccd-amount'); if (a && total > 0) a.value = total.toFixed(2); }
    });
    document.getElementById('ccd-cancel')?.addEventListener('click', () => App.closeModal('cc-modal'));
    document.getElementById('ccd-save')?.addEventListener('click', () => this.saveDrop(counter));
  },

  async saveDrop(counter) {
    const err = document.getElementById('ccd-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccd-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('ccd-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter the amount dropped.'); return; }

    const drawerId = document.getElementById('ccd-drawer')?.value || '';
    const byId     = document.getElementById('ccd-by')?.value || '';
    const witId    = document.getElementById('ccd-witness')?.value || '';
    const rec = {
      id: App.uid(),
      date,
      shift_type:      document.getElementById('ccd-type')?.value || '',
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
      safe_log_id:     null,
      created_at:      new Date().toISOString()
    };

    const btn = document.getElementById('ccd-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await S.ShiftCashDrop.persistDrop(rec);
    if (ok) { App.closeModal('cc-modal'); this.draw(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save Drop'; } fail('Save failed. Try again.'); }
  },

  // ── Safe move (deposit / bank / paid-out) — pop-up, writes safe_log ─────────
  openSafeMove(presetType) {
    const typeOpts = S.ShiftSafeLog.TYPES.map(t => '<option' + (t.name === presetType ? ' selected' : '') + '>' + t.name + '</option>').join('');
    const titleMap = { 'Bank Deposit': 'Make a Deposit', 'Bank Issued': 'Issue a Bank' };
    const title = titleMap[presetType] || 'Safe Activity';
    const hint = presetType === 'Bank Deposit'
      ? '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">Safe balance available: ' + App.fmtCurrency(this.currentSafeBalance()) + '</div>'
      : '';

    const html = '<div class="card" style="margin:0;"><div class="card-title">' + title + '</div>' + hint
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;min-width:0;"><label>Date</label><input type="date" id="ccs-date" value="' + this._today() + '" style="height:44px;"/></div>'
      +   '<div class="f" style="width:130px;min-width:0;"><label>Time</label><input type="time" id="ccs-time" value="' + this._nowHHMM() + '" style="height:44px;"/></div>'
      +   '<div class="f" style="width:180px;min-width:0;"><label>Type</label><select id="ccs-type" style="height:44px;">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;min-width:0;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccs-amount" min="0" step="0.01" inputmode="decimal" style="height:44px;"/></div></div>'
      +   '<div class="f" style="width:140px;min-width:0;"><label>Direction</label><div class="f-display" id="ccs-dir" style="height:44px;display:flex;align-items:center;">-</div></div>'
      +   '<div class="f" style="width:200px;min-width:0;"><label>Reference</label><input type="text" id="ccs-ref" placeholder="e.g. Deposit #, Bar 1"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Performed By</label><select id="ccs-by" style="height:44px;">' + App.staffOptions(this._mgr(), { placeholder: 'Select staff...' }) + '</select></div>'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Witness</label><select id="ccs-witness" style="height:44px;">' + App.staffOptions('', { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="ccs-notes" rows="2" placeholder="Optional"></textarea></div></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ccs-save">Save</button><button class="btn btn-ghost" id="ccs-cancel">Cancel</button>'
      +   '<span id="ccs-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 600 });
    const updateDir = () => {
      const dir = S.ShiftSafeLog.dirOf(document.getElementById('ccs-type')?.value);
      const el = document.getElementById('ccs-dir');
      if (el) { el.textContent = dir === 'out' ? 'Out of safe' : 'Into safe'; el.style.color = dir === 'out' ? 'var(--red)' : 'var(--gold)'; }
    };
    document.getElementById('ccs-type')?.addEventListener('change', updateDir);
    document.getElementById('ccs-cancel')?.addEventListener('click', () => App.closeModal('cc-modal'));
    document.getElementById('ccs-save')?.addEventListener('click', () => this.saveSafeMove());
    updateDir();
  },

  async saveSafeMove() {
    const err = document.getElementById('ccs-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccs-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('ccs-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter an amount.'); return; }

    const txnType = document.getElementById('ccs-type')?.value || '';
    const byId    = document.getElementById('ccs-by')?.value || '';
    const witId   = document.getElementById('ccs-witness')?.value || '';
    const rec = {
      id: App.uid(),
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
      created_at:      new Date().toISOString()
    };

    const btn = document.getElementById('ccs-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await S.ShiftSafeLog.persistEntry(rec);
    if (ok) { App.closeModal('cc-modal'); this.draw(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } fail('Save failed. Try again.'); }
  },

  // ── Count the Safe (pop-up, writes safe_count) ──────────────────────────────
  openSafeCount() {
    const expected = this.currentSafeBalance();
    const tol = this.tolerance();
    this._safeExpected = expected;

    const html = '<div class="card" style="margin:0;"><div class="card-title">Count the Safe</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">Count everything in the safe right now. Bar Cop compares it to what the safe should hold and logs the over or short. This flags the gap, it does not change your running balance.</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;min-width:0;"><label>Date</label><input type="date" id="ccc-date" value="' + this._today() + '" style="height:44px;"/></div>'
      +   '<div class="f" style="width:130px;min-width:0;"><label>Time</label><input type="time" id="ccc-time" value="' + this._nowHHMM() + '" style="height:44px;"/></div>'
      + '</div>'
      + '<div class="sh" style="margin:8px 0 10px;">Count the Safe</div>'
      + '<div id="ccc-counter">' + CashCounter.html({ prefix: 'ccsafe' }) + '</div>'
      + '<div class="calc" style="margin-top:14px;">'
      +   '<div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val" id="ccc-counted">$0</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Expected</div><div class="calc-val dim">' + App.fmtCurrency(expected) + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Over / Short</div><div class="calc-val" id="ccc-variance">-</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val" id="ccc-status">-</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-top:6px;">'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Performed By</label><select id="ccc-by" style="height:44px;">' + App.staffOptions(this._mgr(), { placeholder: 'Select staff...' }) + '</select></div>'
      +   '<div class="f" style="width:190px;min-width:0;"><label>Witness</label><select id="ccc-witness" style="height:44px;">' + App.staffOptions('', { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="ccc-notes" rows="2" placeholder="Optional"></textarea></div></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ccc-save">Save Count</button><button class="btn btn-ghost" id="ccc-cancel">Cancel</button>'
      +   '<span id="ccc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div></div>';

    App.openModal(html, { id: 'cc-modal', maxWidth: 620 });
    const update = total => {
      const cEl = document.getElementById('ccc-counted');
      const varEl = document.getElementById('ccc-variance');
      const stEl = document.getElementById('ccc-status');
      if (cEl) cEl.textContent = App.fmtCurrency(total);
      const variance = Math.round((total - expected) * 100) / 100;
      const status = Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over';
      const cls = 'calc-val ' + (status === 'Short' ? 'warn' : status === 'Over' ? 'dim' : 'good');
      if (varEl) { varEl.textContent = (variance >= 0 ? '+' : '') + App.fmtCurrency(variance); varEl.className = cls; }
      if (stEl) { stEl.textContent = status; stEl.className = cls; }
    };
    const counter = CashCounter.mount(document.getElementById('ccc-counter'), { onChange: total => update(total) });
    update(counter ? counter.total() : 0);
    document.getElementById('ccc-cancel')?.addEventListener('click', () => App.closeModal('cc-modal'));
    document.getElementById('ccc-save')?.addEventListener('click', () => this.saveSafeCount(counter));
  },

  async saveSafeCount(counter) {
    const err = document.getElementById('ccc-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ccc-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const counted = counter ? counter.total() : 0;
    if (counted <= 0) { fail('Count the safe first.'); return; }

    const expected = (this._safeExpected != null) ? this._safeExpected : this.currentSafeBalance();
    const variance = Math.round((counted - expected) * 100) / 100;
    const tol = this.tolerance();
    const status = Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over';
    const byId  = document.getElementById('ccc-by')?.value || '';
    const witId = document.getElementById('ccc-witness')?.value || '';
    const rec = {
      id: App.uid(),
      date,
      time:            document.getElementById('ccc-time')?.value || '',
      counted, expected, variance, tolerance: tol, status,
      denominations:   counter ? counter.denoms() : {},
      performed_by_id: byId,
      performed_by:    (App.staffById(byId) || {}).name || '',
      witness_id:      witId,
      witness:         (App.staffById(witId) || {}).name || '',
      notes:           document.getElementById('ccc-notes')?.value.trim() || '',
      created_at:      new Date().toISOString()
    };

    const btn = document.getElementById('ccc-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'safe_count', rec);
    if (ok) { App.closeModal('cc-modal'); this.draw(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save Count'; } fail('Save failed. Try again.'); }
  }
};
