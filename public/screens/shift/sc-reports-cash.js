'use strict';

/* ── Shift Control — Cash Reports (reads sc_cash_drops, sc_variances) ─────────
   Aggregates cash control activity: drops by drawer, variances by cashier,
   net over/short, and current safe balance. Export to PDF (Rule 10). */

S.ShiftReportsCash = {
  filterFrom: '',
  filterTo: '',

  drops()     { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances() { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  safeLog()   { return ((App.shiftData && App.shiftData.sc_safe_log) || []); },

  inRange(rec) {
    if (this.filterFrom && (rec.date || '') < this.filterFrom) return false;
    if (this.filterTo && (rec.date || '') > this.filterTo) return false;
    return true;
  },
  safeBalance() {
    return this.safeLog().reduce((b, e) =>
      b + (e.direction === 'out' ? -1 : 1) * (e.amount || 0), 0);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  renderReport() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="rc-export">Export PDF</button>';
    document.getElementById('rc-export')?.addEventListener('click', () => window.print());

    if (this.drops().length === 0 && this.variances().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No cash data yet</div>'
        + '<div class="empty-sub">Log cash drops and variances in Shift Control and this report will '
        + 'summarize drops by drawer, variances by cashier, and net over/short.</div></div></div>';
      this.container.onclick = null;
      return;
    }

    const drops = this.drops().filter(d => this.inRange(d));
    const vars = this.variances().filter(v => this.inRange(v));

    const filterCard = '<div class="card"><div class="card-title">Date Range</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="rc-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="rc-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="rc-clear">Clear</button></div>'
      + '</div></div>';

    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const netVar = vars.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = vars.filter(v => v.status === 'Over' || v.status === 'Short').length;

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Cash Drops</div><div class="calc-val">' + drops.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Dropped</div><div class="calc-val">' + App.fmtCurrency(dropTotal) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Net Over/Short</div><div class="calc-val ' + (netVar < 0 ? 'warn' : '') + '">'
      + (netVar >= 0 ? '+' : '') + App.fmtCurrency(netVar) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged ? 'warn' : '') + '">' + flagged + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Safe Balance</div><div class="calc-val good">' + App.fmtCurrency(this.safeBalance()) + '</div></div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + filterCard + summary
      + this.dropsByDrawer(drops) + this.variancesByCashier(vars) + '</div>';

    document.getElementById('rc-export')?.addEventListener('click', () => window.print());
    this.container.onclick = ev => {
      if (ev.target.closest('#rc-clear')) {
        this.filterFrom = this.filterTo = '';
        this.renderReport();
      }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('rc-from', 'filterFrom');
    bind('rc-to', 'filterTo');
  },

  dropsByDrawer(drops) {
    if (drops.length === 0) {
      return '<div class="card"><div class="card-title">Cash Drops by Drawer</div>'
        + '<div style="font-size:13px;color:var(--t3);">No cash drops in this range.</div></div>';
    }
    const groups = {};
    drops.forEach(d => {
      const k = d.drawer || 'Unspecified';
      if (!groups[k]) groups[k] = { count: 0, total: 0 };
      groups[k].count++;
      groups[k].total += (d.amount || 0);
    });
    const rows = Object.keys(groups).sort((a, b) => groups[b].total - groups[a].total).map(k => {
      const g = groups[k];
      return '<tr><td><div class="val">' + esc(k) + '</div></td>'
        + '<td>' + g.count + '</td>'
        + '<td class="val">' + App.fmtCurrency(g.total) + '</td>'
        + '<td>' + App.fmtCurrency(g.count ? g.total / g.count : 0) + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="card-title">Cash Drops by Drawer</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Drawer</th><th>Drops</th><th>Total</th><th>Avg Drop</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  variancesByCashier(vars) {
    if (vars.length === 0) {
      return '<div class="card"><div class="card-title">Variances by Cashier</div>'
        + '<div style="font-size:13px;color:var(--t3);">No variances in this range.</div></div>';
    }
    const groups = {};
    vars.forEach(v => {
      const k = v.cashier || 'Unspecified';
      if (!groups[k]) groups[k] = { count: 0, net: 0, short: 0, over: 0 };
      groups[k].count++;
      groups[k].net += (v.variance || 0);
      if (v.status === 'Short') groups[k].short++;
      else if (v.status === 'Over') groups[k].over++;
    });
    const rows = Object.keys(groups).sort((a, b) => groups[a].net - groups[b].net).map(k => {
      const g = groups[k];
      return '<tr><td><div class="val">' + esc(k) + '</div></td>'
        + '<td>' + g.count + '</td>'
        + '<td class="' + (g.net < 0 ? 'neg' : g.net > 0 ? '' : '') + '">' + (g.net >= 0 ? '+' : '') + App.fmtCurrency(g.net) + '</td>'
        + '<td class="' + (g.short ? 'neg' : '') + '">' + g.short + '</td>'
        + '<td>' + g.over + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="card-title">Variances by Cashier</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Cashier</th><th>Variances</th><th>Net Over/Short</th><th>Times Short</th><th>Times Over</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
      + 'Repeated shortages from one cashier are worth a closer look in Theft Risk.</div></div>';
  }
};
