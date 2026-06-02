'use strict';

/* ── Labor Control — Tip History (reads lc_tips) ──────────────────────────────
   Historical tip analysis: totals, by staff, and by week over a date range.
   Export to PDF (Rule 10). */

S.LaborTipHistory = {
  filterFrom: '',
  filterTo: '',

  tips() { return ((App.laborData && App.laborData.lc_tips) || []); },
  pools() { return ((App.laborData && App.laborData.lc_tip_pools) || []); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  shiftById(id) { return this.shifts().find(s => s.id === id); },
  inRange(t) {
    if (this.filterFrom && (t.date || '') < this.filterFrom) return false;
    if (this.filterTo && (t.date || '') > this.filterTo) return false;
    return true;
  },
  mondayOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  renderReport() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="th-export">Export PDF</button>';
    document.getElementById('th-export')?.addEventListener('click', () => App.exportPDF({ title: 'Tip History', root: this.container }));

    if (this.tips().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No tip data yet</div>'
        + '<div class="empty-sub">Log tips in the Tip Log and this history will summarize totals by staff '
        + 'and by week.</div></div></div>';
      this.container.onclick = null;
      return;
    }

    const rows = this.tips().filter(t => this.inRange(t));

    const filterCard = '<div class="card"><div class="card-title">Date Range</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="th-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="th-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="th-clear">Clear</button></div>'
      + '</div></div>';

    let body;
    if (rows.length === 0) {
      body = '<div class="empty"><div class="empty-title">No tips in this range</div>'
        + '<div class="empty-sub">Adjust or clear the date range above.</div></div>';
    } else {
      const cash = rows.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = rows.reduce((t, x) => t + (x.card_tips || 0), 0);
      const total = cash + card;
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + rows.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val good">' + App.fmtCurrency(total) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cash</div><div class="calc-val">' + App.fmtCurrency(cash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Card</div><div class="calc-val">' + App.fmtCurrency(card) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg / Entry</div><div class="calc-val">' + App.fmtCurrency(rows.length ? total / rows.length : 0) + '</div></div>'
        + '</div>';
      body = summary + this.byStaff(rows) + this.byShift(rows) + this.byWeek(rows);
    }

    this.container.innerHTML = '<div class="screen">' + filterCard + body + '</div>';
    document.getElementById('th-export')?.addEventListener('click', () => App.exportPDF({ title: 'Tip History', root: this.container }));
    this.container.onclick = ev => {
      if (ev.target.closest('#th-clear')) {
        this.filterFrom = this.filterTo = '';
        this.renderReport();
      }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('th-from', 'filterFrom');
    bind('th-to', 'filterTo');
  },

  byStaff(rows) {
    const g = {};
    rows.forEach(t => {
      const k = t.staff_id || t.name || '?';
      if (!g[k]) g[k] = { name: t.name || '-', count: 0, cash: 0, card: 0 };
      g[k].count++;
      g[k].cash += (t.cash_tips || 0);
      g[k].card += (t.card_tips || 0);
    });
    const trs = Object.keys(g)
      .sort((a, b) => (g[b].cash + g[b].card) - (g[a].cash + g[a].card))
      .map(k => {
        const s = g[k];
        const tot = s.cash + s.card;
        return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
          + '<td>' + s.count + '</td>'
          + '<td>' + App.fmtCurrency(s.cash) + '</td>'
          + '<td>' + App.fmtCurrency(s.card) + '</td>'
          + '<td class="val">' + App.fmtCurrency(tot) + '</td>'
          + '<td>' + App.fmtCurrency(s.count ? tot / s.count : 0) + '</td></tr>';
      }).join('');
    return '<div class="card"><div class="card-title">By Staff</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Avg / Entry</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
  },

  // By-shift aggregation — surfaces the shift_id linkage Phase 3 added.
  // Tip entries with a shift_id group under the matching shift; orphans
  // (legacy entries with no shift_id) get bucketed under "Unlinked Date".
  byShift(rows) {
    const linked = rows.filter(t => t.shift_id);
    if (!linked.length) return '';  // hide the section entirely if no linkage exists in range
    const g = {};
    linked.forEach(t => {
      const k = t.shift_id;
      if (!g[k]) {
        const s = this.shiftById(k);
        g[k] = {
          shift_id: k,
          date: t.date,
          shift_type: t.shift_type || (s ? s.shift_type : '') || '',
          count: 0, cash: 0, card: 0,
          pool_amount: null
        };
      }
      g[k].count++;
      g[k].cash += (t.cash_tips || 0);
      g[k].card += (t.card_tips || 0);
    });
    // Layer in pool data — when a pool exists for the shift, show it alongside
    // the raw tips so the operator can see the split was saved.
    this.pools().forEach(p => {
      if (g[p.shift_id]) g[p.shift_id].pool_amount = p.pool_amount;
    });
    const trs = Object.keys(g)
      .sort((a, b) => (g[b].date || '').localeCompare(g[a].date || ''))
      .map(k => {
        const x = g[k];
        const total = x.cash + x.card;
        const poolCell = x.pool_amount != null
          ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);">POOL ' + App.fmtCurrency(x.pool_amount) + '</span>'
          : '<span style="font-size:9px;color:var(--t4);text-transform:uppercase;letter-spacing:1px;">No pool saved</span>';
        return '<tr><td><div class="val">' + (x.date ? new Date(x.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '-') + '</div>'
          + (x.shift_type ? '<div style="font-size:10px;color:var(--t3);">' + esc(x.shift_type) + '</div>' : '') + '</td>'
          + '<td>' + x.count + '</td>'
          + '<td>' + App.fmtCurrency(x.cash) + '</td>'
          + '<td>' + App.fmtCurrency(x.card) + '</td>'
          + '<td class="val">' + App.fmtCurrency(total) + '</td>'
          + '<td>' + poolCell + '</td></tr>';
      }).join('');
    return '<div class="card"><div class="card-title">By Shift</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">Tip entries linked to a shift. POOL column shows whether the pool split was saved for that shift (taxable allocation per employee).</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Shift</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Pool</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
  },

  byWeek(rows) {
    const g = {};
    rows.forEach(t => {
      const wk = this.mondayOf(t.date);
      if (!g[wk]) g[wk] = { count: 0, total: 0 };
      g[wk].count++;
      g[wk].total += (t.total_tips || 0);
    });
    const trs = Object.keys(g).sort((a, b) => b.localeCompare(a)).map(wk =>
      '<tr><td><div class="val">Week of ' + this.fmtDate(wk) + '</div></td>'
      + '<td>' + g[wk].count + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[wk].total) + '</td></tr>').join('');
    return '<div class="card"><div class="card-title">By Week</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Week</th><th>Entries</th><th>Total Tips</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
  }
};
