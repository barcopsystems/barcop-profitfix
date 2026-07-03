'use strict';

/* ── Week History ─────────────────────────────────────────────────────────────
   Read-only record of every confirmed week (the profit `week` + revenue
   `revenue_week` records, joined on period_end). Reached from both the Profit
   and Revenue sidebars (two doors, one page). Nothing is edited inline: the row
   Edit button and the "Missed a week? Add it" button both open the shared
   Confirm the Week popup for that week. */
S.WeekHistory = {

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  weeks() { return (App.data.weeks || []); },
  joined() {
    const rmap = {};
    (App.data.revenue_weeks || []).forEach(r => { rmap[(r.period_end || '').slice(0, 10)] = r; });
    return this.weeks().slice()
      .map(w => { const pe = (w.period_end || '').slice(0, 10); return { pe, p: w, r: rmap[pe] || null }; })
      .filter(x => x.pe)
      .sort((a, b) => b.pe.localeCompare(a.pe));
  },
  wk(pe) { return App.dateRangeLabel(App.weekStartFor(pe), pe); },
  totalRev(x) {
    const p = x.p || {};
    return ((p.bar && p.bar.revenue) || 0) + ((p.food && p.food.revenue) || 0) + ((p.catering && p.catering.revenue) || 0);
  },

  draw() {
    const money0 = v => App.fmtCurrency(v || 0, 0);
    const confirmed = this.joined();                       // confirmed weeks, newest first
    const byPe = {}; confirmed.forEach(x => { byPe[x.pe] = x; });

    // A recent completed-week window so unconfirmed gaps surface as Confirm rows,
    // merged with every confirmed week (which can go further back).
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const seen = {};
    let pe = cur;
    for (let i = 0; i < 10; i++) { seen[pe] = true; const d = new Date(pe + 'T00:00:00'); d.setDate(d.getDate() - 7); pe = App.ymdLocal(d); }
    confirmed.forEach(x => { seen[x.pe] = true; });
    const rows = Object.keys(seen).sort((a, b) => b.localeCompare(a)).map(k => byPe[k] || { pe: k, p: null, r: null });

    // ── Latest confirmed week, laid out (or a placeholder when none yet) ──
    const stat = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    let summary;
    if (confirmed.length) {
      const l = confirmed[0], lp = l.p || {}, lr = l.r || {};
      const t = (App.data.settings && App.data.settings.targets) || {};
      const primeTgt = t.prime_cost_pct != null ? t.prime_cost_pct : 60;
      summary = '<div class="card form-card" style="margin-bottom:24px;">'
        + '<div class="card-title">Latest Confirmed Week &middot; ' + esc(this.wk(l.pe)) + '</div>'
        + '<div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap;">'
        + stat('Revenue', money0(this.totalRev(l)))
        + stat('Prime Cost', lp.prime_cost_pct != null ? lp.prime_cost_pct.toFixed(1) + '%' : '-', (lp.prime_cost_pct != null && lp.prime_cost_pct > primeTgt) ? 'warn' : 'good')
        + stat('Check Avg', lr.check_avg ? App.fmtCurrency(lr.check_avg) : '-')
        + stat('Labor %', lr.labor_pct_blended ? lr.labor_pct_blended.toFixed(1) + '%' : '-')
        + stat('RPLH', lr.rplh_blended ? App.fmtCurrency(lr.rplh_blended) : '-')
        + '</div></div>';
    } else {
      summary = '<div class="card form-card" style="margin-bottom:24px;"><div class="card-title">Week History</div>'
        + '<div style="font-size:13px;color:var(--t2);padding:2px 0;">No weeks confirmed yet. Confirm a week below and it lands here.</div></div>';
    }

    // ── The table: confirmed weeks (Edit) + recent unconfirmed weeks (Confirm) ──
    const limit = this._limit || 52;
    const body = rows.slice(0, limit).map(x => {
      if (!x.p) {
        return '<tr>'
          + '<td data-label="Week"><div class="val">' + esc(this.wk(x.pe)) + '</div><div style="font-size:10px;color:var(--t3);">Not confirmed</div></td>'
          + '<td data-label="Revenue">-</td><td data-label="Prime Cost">-</td><td data-label="Check Avg">-</td><td data-label="Labor %">-</td><td data-label="RPLH">-</td>'
          + '<td data-label="" class="no-print"><button class="btn btn-ghost btn-sm" data-confirm="' + esc(x.pe) + '" style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);white-space:nowrap;">Confirm</button></td>'
          + '</tr>';
      }
      const p = x.p, r = x.r || {};
      return '<tr>'
        + '<td data-label="Week"><div class="val">' + esc(this.wk(x.pe)) + '</div></td>'
        + '<td data-label="Revenue">' + money0(this.totalRev(x)) + '</td>'
        + '<td data-label="Prime Cost">' + (p.prime_cost_pct != null ? p.prime_cost_pct.toFixed(1) + '%' : '-') + '</td>'
        + '<td data-label="Check Avg">' + (r.check_avg ? App.fmtCurrency(r.check_avg) : '-') + '</td>'
        + '<td data-label="Labor %">' + (r.labor_pct_blended ? r.labor_pct_blended.toFixed(1) + '%' : '-') + '</td>'
        + '<td data-label="RPLH">' + (r.rplh_blended ? App.fmtCurrency(r.rplh_blended) : '-') + '</td>'
        + '<td data-label="" class="no-print"><button class="btn btn-ghost btn-sm" data-edit="' + esc(x.pe) + '">Edit</button></td>'
        + '</tr>';
    }).join('');
    const showOlder = rows.length > limit
      ? '<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" data-show-older>Show older</button></div>' : '';

    const table = '<div class="sh" style="margin:0 0 10px;">Week History</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Week</th><th>Revenue</th><th>Prime Cost</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th><th></th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>' + showOlder;

    this.container.innerHTML = '<div class="screen">' + summary + table + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const ed = ev.target.closest('[data-edit]');
      if (ed) { ConfirmWeek.open(ed.dataset.edit, { onDone: () => this.draw() }); return; }
      const cf = ev.target.closest('[data-confirm]');
      if (cf) { ConfirmWeek.open(cf.dataset.confirm, { onDone: () => this.draw() }); return; }
      if (ev.target.closest('[data-show-older]')) { this._limit = (this._limit || 52) + 52; this.draw(); return; }
    };
  }
};
