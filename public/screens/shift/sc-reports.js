'use strict';

/* ── Shift Control — Reports (one page, three tabs) ───────────────────────────
   Shift | Cash | Operations on the Cash History layout: a plain underline tab
   switcher, then per tab a stats card, the range chips + Export (sitting where the
   first breakdown's heading used to be — the accepted filter model, no filter box),
   and the breakdown data cards below. Read-only aggregation of the Shift stores;
   Export PDF is auto-tagged by the active tab. */

S.ShiftReports = {
  tab: 'shift',
  filterPreset: 'last-4',  // active range chip, shared across the tabs
  _prevPreset: 'last-4',
  filterFrom: '',          // custom range only
  filterTo: '',
  TABS: [['shift', 'Shift'], ['cash', 'Cash'], ['operations', 'Operations']],
  DOW: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  PRIORITIES: ['Urgent', 'High', 'Normal', 'Low'],
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  // ── data ────────────────────────────────────────────────────────────────────
  shifts()     { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  drops()      { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  safeLog()    { return ((App.shiftData && App.shiftData.sc_safe_log) || []); },
  voidComps()  { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  list86()     { return ((App.shiftData && App.shiftData.sc_86_list) || []); },
  maint()      { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },
  checklists() { return ((App.shiftData && App.shiftData.sc_checklists) || []); },

  // Effective window from the active range chip (recomputed off "today" each draw);
  // Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  inRange(dateStr) {
    const { from, to } = this.effectiveRange();
    const d = dateStr || '';
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  },
  dowOf(date) {
    const d = new Date(String(date).length <= 10 ? date + 'T00:00:00' : date);
    return isNaN(d.getTime()) ? -1 : d.getDay();
  },

  // ── shell ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Shift Reports Work', [
      { p: ['Reports roll up everything your shifts generated so you can spot the patterns: which shifts make money, where the cash is leaking, and what keeps going wrong on the floor. Everything here is read-only, pulled straight from the shifts, drawers, and logs you already recorded.'] },
      { h: 'The Three Tabs', p: ['Shift covers revenue, covers, and check average broken out by shift type and by day of week. Cash covers your drops by drawer and your variances by cashier, plus net over/short and the safe balance. Operations covers voids and comps by server and reason, your most-86\'d items, maintenance by priority, and checklist completion.'] },
      { h: 'Setting the Range', p: ['The chips pick the window: This Week, Last Week, This Month, Last 4 Weeks, or All. Custom opens a From and To date picker. The range carries across all three tabs and every number on the page updates to match.'] },
      { h: 'Reading the Numbers', p: ['The stats card up top is the headline for the tab. The breakdown tables below it show where those totals come from, so a repeat 86, a cashier who runs short, or a shift type that drags can stand right out.'] },
      { h: 'Export', p: ['Export PDF saves the tab you are looking at, with the current range, for a manager review or your records.'] }
    ]);
  },

  draw() {
    if (!(this.shifts().length || this.drops().length || this.variances().length || this.voidComps().length || this.list86().length || this.maint().length || this.checklists().length)) {
      App.setupCard(this.container, {
        title: 'Shift Reports',
        lead: 'Reports roll up your shifts, cash, and operations across any date range. Run a shift and log a little activity and these fill in.',
        steps: [
          { title: 'Import your week', desc: 'Import your weekly sales in the Shift dashboard to feed the Shift and Cash reports. Voids, waste, and checklists feed the Operations report.', btn: 'Go to Shift Dashboard', screen: 'sc-dashboard', done: false }
        ]
      });
      return;
    }
    const parts = this.tab === 'shift' ? this.bodyShift()
      : this.tab === 'cash' ? this.bodyCash()
      : this.bodyOps();
    // Plain underline tab switcher (same as Cash History), then the standard stack:
    // stats card, the range chips + Export (which sit where the first breakdown's
    // heading used to be — the accepted filter model, no filter box), then the
    // breakdown data cards.
    const body = parts.empty ? parts.empty
      : ((parts.stats || '') + this.filterRow() + (parts.below || ''));
    this.container.innerHTML = '<div class="screen">' + this.tabBar() + body + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }   // keep the range across tabs
      const chip = ev.target.closest('.rpt-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.draw();
        return;
      }
      if (ev.target.closest('#rpt-export')) { App.exportPDF({ title: 'Shift Reports', root: this.container }); return; }
      const go = ev.target.closest('[data-go]');
      if (go) { App.navigate(go.dataset.go); return; }
    };
    document.getElementById('rpt-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.draw(); });
    document.getElementById('rpt-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.draw(); });
  },

  // ── shared markup ───────────────────────────────────────────────────────────
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  // Range chips left, Export right, directly above the first data card (in place of
  // its old heading); Custom reveals a bare From/To row. The accepted filter model.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'rpt-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="rpt-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="rpt-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="rpt-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  // Each breakdown = a background .sh heading + a bleed data card (same look as
  // the Cash History tables). Title may carry HTML entities so it is not escaped.
  section(title, html) {
    return '<div class="sh" style="margin:24px 0 10px;">' + title + '</div>' + html;
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  bareTable(headers, rows) {
    return this.dataCard(headers.map(h => '<th>' + h + '</th>').join(''), rows);
  },
  noRange(noun) {
    return '<div style="font-size:13px;color:var(--t3);padding:6px 2px;">No ' + esc(noun) + ' in this range. Pick a wider range above.</div>';
  },
  emptyPanel(line1, line2, screen, btn) {
    return '<div style="padding:16px 4px;font-size:13px;color:var(--t3);line-height:1.6;">' + esc(line1) + ' ' + esc(line2)
      + ' <button class="btn btn-ghost btn-sm" data-go="' + esc(screen) + '" style="margin-left:8px;">' + esc(btn) + '</button></div>';
  },

  // ── Shift tab ───────────────────────────────────────────────────────────────
  bodyShift() {
    const all = this.shifts();
    if (!all.length) return { empty: this.emptyPanel('No sales imported yet.', 'Import your weekly sales in the Shift dashboard and this report will summarize revenue, covers, and check average by day.', 'sc-dashboard', 'Go to Shift Dashboard') };
    const rows = all.filter(s => this.inRange(s.date));

    const totRev = rows.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const totCov = rows.reduce((t, s) => t + (s.covers || 0), 0);
    const avgChk = totCov > 0 ? totRev / totCov : null;
    const avgRev = rows.length ? totRev / rows.length : 0;
    const stats = this.statsCard(
      this.statItem('Shifts', rows.length)
      + this.statItem('Total Revenue', App.fmtCurrency(totRev))
      + this.statItem('Avg Revenue / Shift', App.fmtCurrency(avgRev))
      + this.statItem('Total Covers', totCov)
      + this.statItem('Avg Check', avgChk != null ? App.fmtCurrency(avgChk) : '-'));

    // First breakdown carries no heading — the chips row sits in its place.
    const below = rows.length
      ? (this.shiftGroup(rows, s => s.shift_type || 'Unspecified')
         + this.section('By Day of Week', this.shiftGroup(rows, s => { const d = this.dowOf(s.date); return d >= 0 ? this.DOW[d] : 'Unknown'; }, this.DOW)))
      : this.noRange('shifts');
    return { stats, below };
  },

  shiftGroup(rows, keyFn, order) {
    const g = {};
    rows.forEach(s => {
      const k = keyFn(s);
      if (!g[k]) g[k] = { count: 0, rev: 0, cov: 0 };
      g[k].count++; g[k].rev += (s.total_revenue || 0); g[k].cov += (s.covers || 0);
    });
    let keys = Object.keys(g);
    keys = order ? order.filter(k => g[k]).concat(keys.filter(k => order.indexOf(k) < 0))
                 : keys.sort((a, b) => g[b].rev - g[a].rev);
    const isDay = !!order;
    const trs = keys.map(k => {
      const x = g[k];
      const avgRev = x.count ? x.rev / x.count : 0;
      const avgCov = x.count ? x.cov / x.count : 0;
      const avgChk = x.cov > 0 ? x.rev / x.cov : null;
      return '<tr><td><div class="val">' + esc(k) + '</div></td>'
        + '<td>' + x.count + '</td><td class="val">' + App.fmtCurrency(x.rev) + '</td>'
        + '<td>' + App.fmtCurrency(avgRev) + '</td><td>' + x.cov + '</td>'
        + '<td>' + avgCov.toFixed(1) + '</td>'
        + '<td>' + (avgChk != null ? App.fmtCurrency(avgChk) : '-') + '</td></tr>';
    }).join('');
    return this.bareTable([isDay ? 'Day' : 'Shift Type', 'Shifts', 'Total Revenue', 'Avg Revenue', 'Covers', 'Avg Covers', 'Avg Check'], trs);
  },

  // ── Cash tab ────────────────────────────────────────────────────────────────
  bodyCash() {
    if (!this.drops().length && !this.variances().length) {
      return { empty: this.emptyPanel('No cash data yet.', 'Log cash drops and count drawers in Cash Control and this report will summarize drops by drawer, variances by cashier, and net over/short.', 'sc-cash-control', 'Go to Cash Control') };
    }
    const drops = this.drops().filter(d => this.inRange(d.date));
    const vars = this.variances().filter(v => this.inRange(v.date));

    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const netVar = vars.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = vars.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const safeBal = this.safeLog().reduce((b, e) => b + (e.direction === 'out' ? -1 : 1) * (e.amount || 0), 0);
    const stats = this.statsCard(
      this.statItem('Cash Drops', drops.length)
      + this.statItem('Total Dropped', App.fmtCurrency(dropTotal))
      + this.statItem('Net Over/Short', (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar), netVar < 0 ? 'warn' : '')
      + this.statItem('Out of Tolerance', flagged, flagged ? 'warn' : '')
      + this.statItem('Safe Balance', App.fmtCurrency(safeBal), 'good'));

    // First breakdown carries no heading — the chips row sits in its place.
    const below = this.dropsByDrawer(drops)
      + this.section('Variances by Cashier', this.variancesByCashier(vars));
    return { stats, below };
  },

  dropsByDrawer(drops) {
    if (!drops.length) return '<div style="font-size:13px;color:var(--t3);">No cash drops in this range.</div>';
    const g = {};
    drops.forEach(d => { const k = d.drawer || 'Unspecified'; if (!g[k]) g[k] = { count: 0, total: 0 }; g[k].count++; g[k].total += (d.amount || 0); });
    const rows = Object.keys(g).sort((a, b) => g[b].total - g[a].total).map(k => {
      const x = g[k];
      return '<tr><td><div class="val">' + esc(k) + '</div></td><td>' + x.count + '</td>'
        + '<td class="val">' + App.fmtCurrency(x.total) + '</td>'
        + '<td>' + App.fmtCurrency(x.count ? x.total / x.count : 0) + '</td></tr>';
    }).join('');
    return this.bareTable(['Drawer', 'Drops', 'Total', 'Avg Drop'], rows);
  },

  variancesByCashier(vars) {
    if (!vars.length) return '<div style="font-size:13px;color:var(--t3);">No variances in this range.</div>';
    const g = {};
    vars.forEach(v => {
      const k = v.cashier || 'Unspecified';
      if (!g[k]) g[k] = { count: 0, net: 0, short: 0, over: 0 };
      g[k].count++; g[k].net += (v.variance || 0);
      if (v.status === 'Short') g[k].short++; else if (v.status === 'Over') g[k].over++;
    });
    const rows = Object.keys(g).sort((a, b) => g[a].net - g[b].net).map(k => {
      const x = g[k];
      return '<tr><td><div class="val">' + esc(k) + '</div></td><td>' + x.count + '</td>'
        + '<td class="' + (x.net < 0 ? 'neg' : '') + '">' + (x.net > 0 ? '+' : '') + App.fmtCurrency(x.net) + '</td>'
        + '<td class="' + (x.short ? 'neg' : '') + '">' + x.short + '</td><td>' + x.over + '</td></tr>';
    }).join('');
    return this.bareTable(['Cashier', 'Variances', 'Net Over/Short', 'Times Short', 'Times Over'], rows);
  },

  // ── Operations tab ──────────────────────────────────────────────────────────
  bodyOps() {
    if (!(this.voidComps().length || this.list86().length || this.maint().length || this.checklists().length)) {
      return { empty: this.emptyPanel('No operations data yet.', 'Log voids and comps, 86s, maintenance, and checklists in Shift Control and this report will summarize the operational exceptions.', 'sc-void-comp', 'Go to Void / Comp') };
    }
    const vc = this.voidComps().filter(r => this.inRange(r.date));
    const items86 = this.list86().filter(r => this.inRange(r.date_86));
    const maint = this.maint().filter(r => this.inRange(r.date_reported));
    const checks = this.checklists().filter(r => this.inRange(r.date));

    const vcTotal = vc.reduce((t, r) => t + (r.amount || 0), 0);
    const openMaint = maint.filter(m => m.status !== 'Resolved').length;
    const checkRate = this.avgCompletion(checks);
    const stats = this.statsCard(
      this.statItem('Voids &amp; Comps', vc.length)
      + this.statItem('Void/Comp $', App.fmtCurrency(vcTotal), 'warn')
      + this.statItem('86\'s Logged', items86.length)
      + this.statItem('Open Maint.', openMaint, openMaint ? 'warn' : '')
      + this.statItem('Checklist Rate', checkRate != null ? checkRate + '%' : '-'));

    // First breakdown carries no heading — the chips row sits in its place.
    let below = this.vcByServer(vc);
    if (vc.length) below += this.section('Voids &amp; Comps by Reason', this.vcByReason(vc));
    below += this.section('Most-86\'d Items', this.most86(items86))
      + this.section('Maintenance by Priority', this.maintByPriority(maint))
      + this.section('Checklist Completion', this.checklistCard(checks));
    return { stats, below };
  },

  avgCompletion(checks) {
    if (!checks.length) return null;
    const sum = checks.reduce((t, c) => t + (c.total_count ? (c.done_count || 0) / c.total_count : 0), 0);
    return Math.round(sum / checks.length * 100);
  },

  vcByServer(vc) {
    if (!vc.length) return '<div style="font-size:13px;color:var(--t3);">No voids or comps in this range.</div>';
    const g = {};
    vc.forEach(r => {
      const k = r.server || 'Unspecified';
      if (!g[k]) g[k] = { voidCnt: 0, voidAmt: 0, compCnt: 0, compAmt: 0 };
      if (r.type === 'Comp') { g[k].compCnt++; g[k].compAmt += (r.amount || 0); }
      else { g[k].voidCnt++; g[k].voidAmt += (r.amount || 0); }
    });
    const rows = Object.keys(g).sort((a, b) => (g[b].voidAmt + g[b].compAmt) - (g[a].voidAmt + g[a].compAmt)).map(k => {
      const x = g[k];
      return '<tr><td><div class="val">' + esc(k) + '</div></td>'
        + '<td>' + x.voidCnt + '</td><td>' + App.fmtCurrency(x.voidAmt) + '</td>'
        + '<td>' + x.compCnt + '</td><td>' + App.fmtCurrency(x.compAmt) + '</td>'
        + '<td class="val">' + App.fmtCurrency(x.voidAmt + x.compAmt) + '</td></tr>';
    }).join('');
    return this.bareTable(['Server', 'Voids', 'Void $', 'Comps', 'Comp $', 'Total $'], rows);
  },

  vcByReason(vc) {
    const g = {};
    vc.forEach(r => { const k = r.reason || 'Unspecified'; if (!g[k]) g[k] = { count: 0, amt: 0 }; g[k].count++; g[k].amt += (r.amount || 0); });
    const rows = Object.keys(g).sort((a, b) => g[b].amt - g[a].amt).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td><td>' + g[k].count + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[k].amt) + '</td></tr>').join('');
    return this.bareTable(['Reason', 'Count', 'Amount'], rows);
  },

  most86(items) {
    if (!items.length) return '<div style="font-size:13px;color:var(--t3);">No 86s logged in this range.</div>';
    const g = {};
    items.forEach(i => {
      const key = (i.item || 'Unspecified').trim();
      const lk = key.toLowerCase();
      if (!g[lk]) g[lk] = { name: key, count: 0, category: i.category || '-' };
      g[lk].count++;
    });
    const rows = Object.values(g).sort((a, b) => b.count - a.count).slice(0, 15).map(x =>
      '<tr><td><div class="val">' + esc(x.name) + '</div></td><td>' + esc(x.category) + '</td>'
      + '<td>' + x.count + (x.count > 1 ? ' <span style="color:var(--amber);font-weight:700;">Repeat</span>' : '') + '</td></tr>').join('');
    return this.bareTable(['Item', 'Category', 'Times 86\'d'], rows);
  },

  maintByPriority(maint) {
    if (!maint.length) return '<div style="font-size:13px;color:var(--t3);">No maintenance issues in this range.</div>';
    const g = {};
    maint.forEach(m => {
      const k = m.priority || 'Normal';
      if (!g[k]) g[k] = { open: 0, resolved: 0, cost: 0 };
      if (m.status === 'Resolved') g[k].resolved++; else g[k].open++;
      g[k].cost += (m.cost || 0);
    });
    const rows = this.PRIORITIES.filter(p => g[p]).map(p => {
      const x = g[p];
      return '<tr><td><div class="val">' + esc(p) + '</div></td>'
        + '<td class="' + (x.open ? 'neg' : '') + '">' + x.open + '</td>'
        + '<td>' + x.resolved + '</td><td class="val">' + App.fmtCurrency(x.cost) + '</td></tr>';
    }).join('');
    return this.bareTable(['Priority', 'Open', 'Resolved', 'Repair Cost'], rows);
  },

  checklistCard(checks) {
    if (!checks.length) return '<div style="font-size:13px;color:var(--t3);">No completed checklists in this range.</div>';
    const row = type => {
      const list = checks.filter(c => c.type === type);
      if (!list.length) return '';
      const full = list.filter(c => (c.done_count || 0) >= (c.total_count || 0) && (c.total_count || 0) > 0).length;
      const rate = this.avgCompletion(list);
      return '<tr><td><div class="val">' + type + '</div></td><td>' + list.length + '</td>'
        + '<td>' + full + '</td><td>' + (rate != null ? rate + '%' : '-') + '</td></tr>';
    };
    return this.bareTable(['Type', 'Runs', 'Fully Complete', 'Avg Completion'], row('Opening') + row('Closing'));
  }
};
