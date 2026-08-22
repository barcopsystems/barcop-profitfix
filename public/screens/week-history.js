'use strict';

/* ── Week History ─────────────────────────────────────────────────────────────
   Read-only record of every confirmed week (the profit `week` + revenue
   `revenue_week` records, joined on period_end). Reached from both the Profit
   and Revenue sidebars (two doors, one page). Nothing is edited inline: the row
   Edit button and the "Missed a week? Add it" button both open the shared
   Confirm the Week popup for that week. */
S.WeekHistory = {

  /* ⚠ WITHOUT THIS, THE TOP-NAV "Directions for this page" BUTTON IS DEAD ON THIS SCREEN.
     `App.openPageHelp()` calls the active screen's showHowTo() and otherwise falls through to
     `S.HubHelp.open()`, which NAVIGATES to the Hub Help page — so the operator pressed a button
     labelled "Directions for this page" and got silently thrown out of the section they were in.
     This was the only screen in any rail without one, and it sits in BOTH the Profit and the
     Revenue sidebar, which is where Kyle hit it. Pinned tree-wide by verify-profit-walk-fixes P9. */
  showHowTo() {
    App.showHelpModal('How Week History Works', [
      { p: ['Every week you have confirmed, newest first, in one table. It joins your Profit numbers and your Revenue numbers for the same week, so one row is the whole picture of how that week actually went.'] },
      { h: 'What The Columns Mean', p: ['Revenue is the week\'s total sales including catering. Prime Cost is COGS plus labor against total sales, the one number that says whether the week paid. Pour Cost is your bar COGS against bar sales and Food Cost is your food COGS against food sales, the two halves of the COGS side, so you can see which one moved when prime cost does. Check Avg is food and beverage sales per cover. Labor % is total labor, hourly plus salaried, against total sales. RPLH is revenue per labor hour. Reading down the list is how you see a trend instead of a single week.'] },
      { h: 'Fixing A Week', p: ['Edit on any row re-opens that week in the same Confirm the Week popup you closed it with, prefilled with what you saved. Correct a figure and confirm again, and everything downstream, your audits, your Fix systems, and Books, follows the corrected number. A week you never closed shows up here too if Shift has sales imported for it, so you can catch one you missed and confirm it late.'] },
      { h: 'One Set Of Records', p: ['Week History is the third tab on The Week, beside Close The Week and Week in Review. One set of weekly records sits behind all three, so a week you correct here is corrected everywhere at the same moment: your Profit numbers, your Revenue numbers, your audits and your Books.'] }
    ]);
  },

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
  // Week-ends that have POS sales imported in Shift (so an unconfirmed one has
  // something real to confirm). Keeps phantom empty weeks off a fresh account.
  weeksWithData() {
    const set = {};
    ((App.shiftData && App.shiftData.sc_shifts) || []).forEach(s => {
      if (!s.date || ((s.bar_revenue || 0) + (s.floor_revenue || 0) + (s.covers || 0)) === 0) return;
      const pe = App.periodEndFor(App.weekStartFor(s.date));
      if (pe) set[pe] = true;
    });
    return set;
  },
  wk(pe) { return App.dateRangeLabel(App.weekStartFor(pe), pe); },
  // Total sales, the same bar + food + catering + ancillary that Confirm the Week's
  // money strip and the Books income statement show. Ancillary was missing, so one
  // week read $10,500 in the popup, $10,000 in this table, and $10,500 in Books. The
  // Prime Cost column beside it is measured against total sales too, so leaving
  // ancillary out made the row disagree with itself as well.
  totalRev(x) {
    const p = x.p || {};
    return ((p.bar && p.bar.revenue) || 0) + ((p.food && p.food.revenue) || 0)
         + ((p.catering && p.catering.revenue) || 0) + ((p.other && p.other.revenue) || 0);
  },

  draw() {
    const money0 = v => App.fmtCurrency(v || 0, 0);
    const confirmed = this.joined();                       // confirmed weeks, newest first
    const byPe = {}; confirmed.forEach(x => { byPe[x.pe] = x; });

    // Weeks shown = every confirmed week + any week with POS sales imported but
    // never confirmed. Nothing else, so a fresh account is not littered with
    // empty weeks that have nothing to confirm.
    const seen = {};
    confirmed.forEach(x => { seen[x.pe] = true; });
    Object.keys(this.weeksWithData()).forEach(pe => { seen[pe] = true; });
    const rows = Object.keys(seen).sort((a, b) => b.localeCompare(a)).map(k => byPe[k] || { pe: k, p: null, r: null });

    if (!rows.length) {
      this.container.innerHTML = '<div class="screen"><div class="card form-card"><div class="card-title">Week History</div>'
        + '<div style="font-size:13px;color:var(--t2);padding:2px 0;">No weeks yet. Confirm your week over in Close The Week and it shows up here.</div>'
        // S271: the copy named a destination and did not offer it. 'this-week' is the canonical
        // confirm-the-week id — App.openScreen special-cases it to land the Profit dashboard AND
        // open the Confirm the Week modal (S260). Sibling empty states already ship this button.
        + '<div style="margin-top:14px;"><button class="btn btn-primary btn-sm" data-go="this-week">Confirm a Week</button></div>'
        + '</div></div>';
      this.wire();
      return;
    }

    // ── Latest confirmed week, laid out (or a placeholder when none yet) ──
    const stat = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    let summary;
    if (confirmed.length) {
      const l = confirmed[0], lp = l.p || {}, lr = l.r || {};
      const t = (App.data.settings && App.data.settings.targets) || {};
      const primeTgt = t.prime_cost_pct != null ? t.prime_cost_pct : 60;
      /* ⭐ A STAT BOX, NOT A HEADED CARD (Kyle, 2026-08-14): *"get rid of the header in top card and
         make it a stat box.. and move the 'latest confirmed week...' text line into the stat box
         under the numbers."*
         ⛔ NOTHING HERE SETS A COLOUR. Dropping the `.card-title` is the entire change: the box
         already renders `.calc-item` stats, so `.card:has(.calc-item):not(:has(.card-title))` picks
         it up and it reads `--stat` from the stylesheet like every other stat box. That selector
         being shape-based rather than marker-based is what makes this one edit instead of three. */
      summary = '<div class="card form-card" style="margin-bottom:24px;">'
        + '<div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap;">'
        + stat('Revenue', money0(this.totalRev(l)))
        + stat('Prime Cost', lp.prime_cost_pct != null ? lp.prime_cost_pct.toFixed(1) + '%' : '-', (lp.prime_cost_pct != null && lp.prime_cost_pct > primeTgt) ? 'warn' : 'good')
        + stat('Check Avg', lr.check_avg ? App.fmtCurrency(lr.check_avg) : '-')
        + stat('Labor %', lr.labor_pct_blended ? lr.labor_pct_blended.toFixed(1) + '%' : '-')
        + stat('RPLH', lr.rplh_blended ? App.fmtCurrency(lr.rplh_blended) : '-')
        + '</div>'
        /* The line the header used to carry, now UNDER the numbers where it reads as what it is:
           a caption saying which week these five figures are. As a header it was announcing the
           box; here it is answering the question the numbers raise. */
        + '<div style="font-size:11.5px;color:var(--t3);margin-top:14px;">Latest Confirmed Week &middot; '
        + esc(this.wk(l.pe)) + '</div>'
        + '</div>';
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
          /* ⛔ THE UNCONFIRMED ROW GAINS THE SAME TWO CELLS. A column added to the header alone
             runs every row below it one short and the background stops before the right edge
             ([[lessons-paid-for]] #123, which Kyle caught in one screenshot). */
          + '<td data-label="Revenue">-</td><td data-label="Prime Cost">-</td><td data-label="Pour Cost">-</td><td data-label="Food Cost">-</td><td data-label="Check Avg">-</td><td data-label="Labor %">-</td><td data-label="RPLH">-</td>'
          + '<td data-label="" class="no-print"><button class="btn btn-primary btn-sm" data-confirm="' + esc(x.pe) + '" style="white-space:nowrap;">Confirm</button></td>'
          + '</tr>';
      }
      const p = x.p, r = x.r || {};
      return '<tr>'
        + '<td data-label="Week"><div class="val">' + esc(this.wk(x.pe)) + '</div></td>'
        + '<td data-label="Revenue">' + money0(this.totalRev(x)) + '</td>'
        + '<td data-label="Prime Cost">' + (p.prime_cost_pct != null ? p.prime_cost_pct.toFixed(1) + '%' : '-') + '</td>'
        /* ⭐ POUR AND FOOD COST, Kyle's call 2026-08-18. Two Profit Fix steps say "read pour cost /
           food cost against target across your saved weeks" and pointed at the retired This Week;
           nothing in the app showed either across weeks, so the columns come here and the steps
           point at this table. The figures are ALREADY on the record — `bar.cost_pct` and
           `food.cost_pct`, written by Confirm the Week — so nothing new is computed or stored.
           ⚠ Measured on the live seed FIRST: `bar_pour_cost_pct` / `food_cost_pct` at the TOP of a
           week record are undefined on all 13 weeks (that spelling is the TARGETS object, not the
           week), while `bar.cost_pct` reads 22.8 and `food.cost_pct` 32.9. Reading the wrong one
           would have shipped two columns of dashes. */
        + '<td data-label="Pour Cost">' + ((p.bar && p.bar.cost_pct != null) ? p.bar.cost_pct.toFixed(1) + '%' : '-') + '</td>'
        + '<td data-label="Food Cost">' + ((p.food && p.food.cost_pct != null) ? p.food.cost_pct.toFixed(1) + '%' : '-') + '</td>'
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
      + '<th>Week</th><th>Revenue</th><th>Prime Cost</th><th>Pour Cost</th><th>Food Cost</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th><th></th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>' + showOlder;

    this.container.innerHTML = '<div class="screen">' + summary + table + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      const ed = ev.target.closest('[data-edit]');
      if (ed) { ConfirmWeek.open(ed.dataset.edit, { onDone: () => this.draw() }); return; }
      const cf = ev.target.closest('[data-confirm]');
      if (cf) { ConfirmWeek.open(cf.dataset.confirm, { onDone: () => this.draw() }); return; }
      if (ev.target.closest('[data-show-older]')) { this._limit = (this._limit || 52) + 52; this.draw(); return; }
    };
  }
};
