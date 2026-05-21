'use strict';

/* ── Shift Control — Operations Reports ───────────────────────────────────────
   Aggregates operational exceptions: voids/comps by server and reason, the
   most-86'd items, maintenance by priority, and checklist completion rates.
   Reads sc_void_comps, sc_86_list, sc_maintenance, sc_checklists. PDF export. */

S.ShiftReportsOps = {
  filterFrom: '',
  filterTo: '',
  PRIORITIES: ['Urgent', 'High', 'Normal', 'Low'],

  voidComps() { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  list86()    { return ((App.shiftData && App.shiftData.sc_86_list) || []); },
  maint()     { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },
  checklists(){ return ((App.shiftData && App.shiftData.sc_checklists) || []); },

  inRange(dateStr) {
    if (this.filterFrom && (dateStr || '') < this.filterFrom) return false;
    if (this.filterTo && (dateStr || '') > this.filterTo) return false;
    return true;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  renderReport() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="ro-export">Export PDF</button>';
    document.getElementById('ro-export')?.addEventListener('click', () => window.print());

    const anyData = this.voidComps().length || this.list86().length || this.maint().length || this.checklists().length;
    if (!anyData) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No operations data yet</div>'
        + '<div class="empty-sub">Log voids/comps, 86s, maintenance, and checklists in Shift Control and '
        + 'this report will summarize the operational exceptions.</div></div></div>';
      this.container.onclick = null;
      return;
    }

    const vc = this.voidComps().filter(r => this.inRange(r.date));
    const items86 = this.list86().filter(r => this.inRange(r.date_86));
    const maint = this.maint().filter(r => this.inRange(r.date_reported));
    const checks = this.checklists().filter(r => this.inRange(r.date));

    const filterCard = '<div class="card"><div class="card-title">Date Range</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="ro-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="ro-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="ro-clear">Clear</button></div>'
      + '</div></div>';

    const vcTotal = vc.reduce((t, r) => t + (r.amount || 0), 0);
    const openMaint = maint.filter(m => m.status !== 'Resolved').length;
    const checkRate = this.avgCompletion(checks);

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Voids &amp; Comps</div><div class="calc-val">' + vc.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Void/Comp $</div><div class="calc-val warn">' + App.fmtCurrency(vcTotal) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">86\'s Logged</div><div class="calc-val">' + items86.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Open Maint.</div><div class="calc-val ' + (openMaint ? 'warn' : '') + '">' + openMaint + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Checklist Rate</div><div class="calc-val">' + (checkRate != null ? checkRate + '%' : '—') + '</div></div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + filterCard + summary
      + this.vcByServer(vc) + this.vcByReason(vc) + this.most86(items86)
      + this.maintByPriority(maint) + this.checklistCard(checks) + '</div>';

    document.getElementById('ro-export')?.addEventListener('click', () => window.print());
    this.container.onclick = ev => {
      if (ev.target.closest('#ro-clear')) {
        this.filterFrom = this.filterTo = '';
        this.renderReport();
      }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('ro-from', 'filterFrom');
    bind('ro-to', 'filterTo');
  },

  avgCompletion(checks) {
    if (checks.length === 0) return null;
    const sum = checks.reduce((t, c) =>
      t + ((c.total_count ? (c.done_count || 0) / c.total_count : 0)), 0);
    return Math.round(sum / checks.length * 100);
  },

  emptyCard(title, msg) {
    return '<div class="card"><div class="card-title">' + title + '</div>'
      + '<div style="font-size:13px;color:var(--t3);">' + msg + '</div></div>';
  },

  vcByServer(vc) {
    if (vc.length === 0) return this.emptyCard('Voids &amp; Comps by Server', 'No voids or comps in this range.');
    const g = {};
    vc.forEach(r => {
      const k = r.server || 'Unspecified';
      if (!g[k]) g[k] = { voidCnt: 0, voidAmt: 0, compCnt: 0, compAmt: 0 };
      if (r.type === 'Comp') { g[k].compCnt++; g[k].compAmt += (r.amount || 0); }
      else { g[k].voidCnt++; g[k].voidAmt += (r.amount || 0); }
    });
    const rows = Object.keys(g)
      .sort((a, b) => (g[b].voidAmt + g[b].compAmt) - (g[a].voidAmt + g[a].compAmt))
      .map(k => {
        const x = g[k];
        return '<tr><td><div class="val">' + esc(k) + '</div></td>'
          + '<td>' + x.voidCnt + '</td><td>' + App.fmtCurrency(x.voidAmt) + '</td>'
          + '<td>' + x.compCnt + '</td><td>' + App.fmtCurrency(x.compAmt) + '</td>'
          + '<td class="val">' + App.fmtCurrency(x.voidAmt + x.compAmt) + '</td></tr>';
      }).join('');
    return '<div class="card"><div class="card-title">Voids &amp; Comps by Server</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Server</th><th>Voids</th><th>Void $</th><th>Comps</th><th>Comp $</th><th>Total $</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  vcByReason(vc) {
    if (vc.length === 0) return '';
    const g = {};
    vc.forEach(r => {
      const k = r.reason || 'Unspecified';
      if (!g[k]) g[k] = { count: 0, amt: 0 };
      g[k].count++;
      g[k].amt += (r.amount || 0);
    });
    const rows = Object.keys(g).sort((a, b) => g[b].amt - g[a].amt).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + g[k].count + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[k].amt) + '</td></tr>').join('');
    return '<div class="card"><div class="card-title">Voids &amp; Comps by Reason</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Reason</th><th>Count</th><th>Amount</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  most86(items) {
    if (items.length === 0) return this.emptyCard('Most-86\'d Items', 'No 86s logged in this range.');
    const g = {};
    items.forEach(i => {
      const key = (i.item || 'Unspecified').trim();
      const lk = key.toLowerCase();
      if (!g[lk]) g[lk] = { name: key, count: 0, category: i.category || '—' };
      g[lk].count++;
    });
    const rows = Object.values(g).sort((a, b) => b.count - a.count).slice(0, 15).map(x =>
      '<tr><td><div class="val">' + esc(x.name) + '</div></td>'
      + '<td>' + esc(x.category) + '</td>'
      + '<td>' + x.count + (x.count > 1 ? ' <span class="badge badge-warn">Repeat</span>' : '') + '</td></tr>').join('');
    return '<div class="card"><div class="card-title">Most-86\'d Items</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Item</th><th>Category</th><th>Times 86\'d</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
      + 'Repeat 86s point to par levels that are set too low — review them in Inventory Control.</div></div>';
  },

  maintByPriority(maint) {
    if (maint.length === 0) return this.emptyCard('Maintenance by Priority', 'No maintenance issues in this range.');
    const g = {};
    maint.forEach(m => {
      const k = m.priority || 'Normal';
      if (!g[k]) g[k] = { open: 0, resolved: 0, cost: 0 };
      if (m.status === 'Resolved') g[k].resolved++;
      else g[k].open++;
      g[k].cost += (m.cost || 0);
    });
    const rows = this.PRIORITIES.filter(p => g[p]).map(p => {
      const x = g[p];
      return '<tr><td><div class="val">' + esc(p) + '</div></td>'
        + '<td class="' + (x.open ? 'neg' : '') + '">' + x.open + '</td>'
        + '<td>' + x.resolved + '</td>'
        + '<td class="val">' + App.fmtCurrency(x.cost) + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="card-title">Maintenance by Priority</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Priority</th><th>Open</th><th>Resolved</th><th>Repair Cost</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  checklistCard(checks) {
    if (checks.length === 0) return this.emptyCard('Checklist Completion', 'No completed checklists in this range.');
    const row = type => {
      const list = checks.filter(c => c.type === type);
      if (list.length === 0) return '';
      const full = list.filter(c => (c.done_count || 0) >= (c.total_count || 0) && (c.total_count || 0) > 0).length;
      const rate = this.avgCompletion(list);
      return '<tr><td><div class="val">' + type + '</div></td>'
        + '<td>' + list.length + '</td>'
        + '<td>' + full + '</td>'
        + '<td>' + (rate != null ? rate + '%' : '—') + '</td></tr>';
    };
    return '<div class="card"><div class="card-title">Checklist Completion</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Type</th><th>Runs</th><th>Fully Complete</th><th>Avg Completion</th>'
      + '</tr></thead><tbody>' + row('Opening') + row('Closing') + '</tbody></table></div></div>';
  }
};
