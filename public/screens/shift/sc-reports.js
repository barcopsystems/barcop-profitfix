'use strict';

/* ── Shift Control — Reports (one page, three tabs) ───────────────────────────
   Shift | Cash | Operations on the Cash History layout: a plain underline tab
   switcher, then per tab a stats card, a Filter heading, the controls-only
   filter card with Export, and the breakdown data cards below. Read-only
   aggregation of the Shift stores; Export PDF is auto-tagged by the active tab. */

S.ShiftReports = {
  tab: 'shift',
  f: {},            // { from, to } for the active tab
  TABS: [['shift', 'Shift'], ['cash', 'Cash'], ['operations', 'Operations']],
  DOW: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  PRIORITIES: ['Urgent', 'High', 'Normal', 'Low'],

  // ── data ────────────────────────────────────────────────────────────────────
  shifts()     { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  drops()      { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  safeLog()    { return ((App.shiftData && App.shiftData.sc_safe_log) || []); },
  voidComps()  { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  list86()     { return ((App.shiftData && App.shiftData.sc_86_list) || []); },
  maint()      { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },
  checklists() { return ((App.shiftData && App.shiftData.sc_checklists) || []); },

  inRange(dateStr) {
    if (this.f.from && (dateStr || '') < this.f.from) return false;
    if (this.f.to && (dateStr || '') > this.f.to) return false;
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

  draw() {
    const parts = this.tab === 'shift' ? this.bodyShift()
      : this.tab === 'cash' ? this.bodyCash()
      : this.bodyOps();
    const tabLabel = (this.TABS.find(t => t[0] === this.tab) || ['', ''])[1];
    // Plain underline tab switcher (same as Cash History), then the standard
    // stack: stats card, a Filter heading, the controls-only filter card with
    // Export pushed right, then the breakdown data cards. No connected panel box.
    let body;
    if (parts.empty) {
      body = parts.empty;
    } else {
      body = (parts.stats || '')
        + '<div class="sh no-print" style="margin:24px 0 10px;">Filter ' + esc(tabLabel) + '</div>'
        + '<div class="card no-print"><div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
          + parts.controls
          + '<button class="btn btn-ghost btn-sm" id="rpt-export" style="margin-left:auto;align-self:center;">Export PDF</button>'
        + '</div></div>'
        + (parts.below || '');
    }
    this.container.innerHTML = '<div class="screen">' + this.tabBar() + body + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.f = {}; this.draw(); return; }
      if (ev.target.closest('#rpt-export')) { App.exportPDF({ title: 'Shift Reports', root: this.container }); return; }
      const go = ev.target.closest('[data-go]');
      if (go) { App.navigate(go.dataset.go); return; }
    };
    const bind = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener('change', e => { this.f[key] = e.target.value || ''; this.draw(); }); };
    bind('rpt-from', 'from'); bind('rpt-to', 'to');
    document.getElementById('rpt-clear')?.addEventListener('click', () => { this.f = {}; this.draw(); });
  },

  // ── shared markup ───────────────────────────────────────────────────────────
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  dateInputs() {
    return '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="rpt-from" value="' + esc(this.f.from || '') + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="rpt-to" value="' + esc(this.f.to || '') + '"/></div>';
  },
  clearBtn() {
    return '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="rpt-clear" style="margin-bottom:2px;">Clear</button></div>';
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val ' + (cls || '') + '">' + val + '</div></div>';
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
    return '<div style="font-size:13px;color:var(--t3);padding:6px 2px;">No ' + esc(noun) + ' in this range. Adjust or clear the dates.</div>';
  },
  emptyPanel(line1, line2, screen, btn) {
    return '<div style="padding:16px 4px;font-size:13px;color:var(--t3);line-height:1.6;">' + esc(line1) + ' ' + esc(line2)
      + ' <button class="btn btn-ghost btn-sm" data-go="' + esc(screen) + '" style="margin-left:8px;">' + esc(btn) + '</button></div>';
  },

  // ── Shift tab ───────────────────────────────────────────────────────────────
  bodyShift() {
    const all = this.shifts();
    if (!all.length) return { empty: this.emptyPanel('No shifts logged yet.', 'Log a shift in Active Shift and this report will summarize revenue, covers, and check average by shift type and day of week.', 'sc-active-shift', 'Go to Active Shift') };
    const rows = all.filter(s => this.inRange(s.date));
    const controls = this.dateInputs() + this.clearBtn();
    if (!rows.length) return { controls, below: this.noRange('shifts') };

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

    const below = this.section('By Shift Type', this.shiftGroup(rows, s => s.shift_type || 'Unspecified'))
      + this.section('By Day of Week', this.shiftGroup(rows, s => { const d = this.dowOf(s.date); return d >= 0 ? this.DOW[d] : 'Unknown'; }, this.DOW));
    return { stats, controls, below };
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
      return { empty: this.emptyPanel('No cash data yet.', 'Log cash drops and count drawers on the Cash Board and this report will summarize drops by drawer, variances by cashier, and net over/short.', 'sc-cash-control', 'Go to Cash Board') };
    }
    const drops = this.drops().filter(d => this.inRange(d.date));
    const vars = this.variances().filter(v => this.inRange(v.date));
    const controls = this.dateInputs() + this.clearBtn();

    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const netVar = vars.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = vars.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const safeBal = this.safeLog().reduce((b, e) => b + (e.direction === 'out' ? -1 : 1) * (e.amount || 0), 0);
    const stats = this.statsCard(
      this.statItem('Cash Drops', drops.length)
      + this.statItem('Total Dropped', App.fmtCurrency(dropTotal))
      + this.statItem('Net Over/Short', (netVar >= 0 ? '+' : '') + App.fmtCurrency(netVar), netVar < 0 ? 'warn' : '')
      + this.statItem('Out of Tolerance', flagged, flagged ? 'warn' : '')
      + this.statItem('Safe Balance', App.fmtCurrency(safeBal), 'good'));

    const below = this.section('Cash Drops by Drawer', this.dropsByDrawer(drops))
      + this.section('Variances by Cashier', this.variancesByCashier(vars));
    return { stats, controls, below };
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
        + '<td class="' + (x.net < 0 ? 'neg' : '') + '">' + (x.net >= 0 ? '+' : '') + App.fmtCurrency(x.net) + '</td>'
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
    const controls = this.dateInputs() + this.clearBtn();

    const vcTotal = vc.reduce((t, r) => t + (r.amount || 0), 0);
    const openMaint = maint.filter(m => m.status !== 'Resolved').length;
    const checkRate = this.avgCompletion(checks);
    const stats = this.statsCard(
      this.statItem('Voids &amp; Comps', vc.length)
      + this.statItem('Void/Comp $', App.fmtCurrency(vcTotal), 'warn')
      + this.statItem('86\'s Logged', items86.length)
      + this.statItem('Open Maint.', openMaint, openMaint ? 'warn' : '')
      + this.statItem('Checklist Rate', checkRate != null ? checkRate + '%' : '-'));

    let below = this.section('Voids &amp; Comps by Server', this.vcByServer(vc));
    if (vc.length) below += this.section('Voids &amp; Comps by Reason', this.vcByReason(vc));
    below += this.section('Most-86\'d Items', this.most86(items86))
      + this.section('Maintenance by Priority', this.maintByPriority(maint))
      + this.section('Checklist Completion', this.checklistCard(checks));
    return { stats, controls, below };
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
