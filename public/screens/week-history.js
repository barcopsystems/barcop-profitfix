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
    const rows = this.joined();
    const head = '<div class="sh" style="margin:0 0 4px;">Weekly Recovery</div>'
      + '<h1 style="font-size:22px;font-weight:800;color:var(--w);margin:0 0 4px;">Week History</h1>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:20px;">Every week you have confirmed, read only. Edit a week or add one you missed and the Confirm the Week form opens.</div>';

    if (!rows.length) {
      this.container.innerHTML = '<div class="screen">' + head
        + '<div class="card"><div style="font-size:13px;color:var(--t2);padding:6px 0;">No weeks confirmed yet. Open Close The Week and confirm the week, and it shows here once saved.</div>'
        + '<div style="margin-top:12px;"><button class="btn btn-primary btn-sm" data-add-missed>Confirm a Week</button></div></div></div>';
      this.wire();
      return;
    }

    // ── Latest confirmed week, laid out ──
    const l = rows[0], lp = l.p || {}, lr = l.r || {};
    const t = (App.data.settings && App.data.settings.targets) || {};
    const primeTgt = t.prime_cost_pct != null ? t.prime_cost_pct : 60;
    const stat = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    const summary = '<div class="sh" style="margin:0 0 10px;">Latest Confirmed Week &middot; ' + esc(this.wk(l.pe)) + '</div>'
      + '<div class="card" style="margin-bottom:24px;"><div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap;">'
      + stat('Revenue', money0(this.totalRev(l)))
      + stat('Prime Cost', lp.prime_cost_pct != null ? lp.prime_cost_pct.toFixed(1) + '%' : '-', (lp.prime_cost_pct != null && lp.prime_cost_pct > primeTgt) ? 'warn' : 'good')
      + stat('Check Avg', lr.check_avg ? App.fmtCurrency(lr.check_avg) : '-')
      + stat('Labor %', lr.labor_pct_blended ? lr.labor_pct_blended.toFixed(1) + '%' : '-')
      + stat('RPLH', lr.rplh_blended ? App.fmtCurrency(lr.rplh_blended) : '-')
      + '</div></div>';

    // ── The history table (read-only + a per-row Edit) ──
    const limit = this._limit || 52;
    const body = rows.slice(0, limit).map(x => {
      const p = x.p || {}, r = x.r || {};
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

    const table = '<div class="sh" style="margin:0 0 10px;">Confirmed Weeks</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Week</th><th>Revenue</th><th>Prime Cost</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th><th></th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>' + showOlder
      + '<div style="margin:16px 0 24px;"><button class="btn btn-ghost btn-sm" data-add-missed>Missed a week? Add it</button></div>';

    this.container.innerHTML = '<div class="screen">' + head + summary + table + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const ed = ev.target.closest('[data-edit]');
      if (ed) { ConfirmWeek.open(ed.dataset.edit, { onDone: () => this.draw() }); return; }
      if (ev.target.closest('[data-add-missed]')) { this.addMissed(); return; }
      if (ev.target.closest('[data-show-older]')) { this._limit = (this._limit || 52) + 52; this.draw(); return; }
    };
  },

  // Open the confirm popup for the most recent week with no saved record (walk
  // back from the current week); fall back to last week if the recent run is full.
  addMissed() {
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const have = new Set(this.weeks().map(w => (w.period_end || '').slice(0, 10)));
    let pe = cur;
    for (let i = 0; i < 16; i++) {
      if (!have.has(pe)) { ConfirmWeek.open(pe, { onDone: () => this.draw() }); return; }
      const d = new Date(pe + 'T00:00:00'); d.setDate(d.getDate() - 7); pe = App.ymdLocal(d);
    }
    const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() - 7);
    ConfirmWeek.open(App.ymdLocal(d), { onDone: () => this.draw() });
  }
};
