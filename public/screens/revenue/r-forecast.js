'use strict';

/* ── Revenue Recovery — Revenue Forecast (READ-ONLY forward glance) ───────────
   Bar Cop projects each week from a weighted 8-week same-weekday average of
   sc_shifts revenue and covers (App.forecastDefaultsFor / coverDefaultsFor) and
   adds the revenue of any events booked that week (App.effectiveForecast). Every
   reader (Build Schedule, This Week) pulls that automatically, so the forecast
   is always live and event-aware with nothing to enter or save. This page is a
   read-only glance: this week and next, a short projection, and a self-filling
   Forecast Accuracy history. To bump a week for something the average cannot
   see, book the event in Events (it flows here on its own) or set the number on
   Build Schedule. No inputs here. */

S.RevenueForecast = {
  container: null,

  fmt(n) { n = Number(n) || 0; return App.fmtCurrency ? App.fmtCurrency(n) : ('$' + Math.round(n).toLocaleString()); },

  // Monday of the current calendar week.
  currentWeekMon() {
    const d = new Date();
    const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return App.ymdLocal(d);
  },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  weekRangeLabel(ws) { return App.dateRangeLabel(ws, App.periodEndFor(ws)); },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Revenue Forecast Works', [
      { p: ['Bar Cop projects each week from a weighted average of the same weekday over your last eight weeks of sales and covers, and adds the revenue of any events you have booked that week. It uses that number on its own, so Build Schedule and your weekly numbers always have a real forecast to build against without you entering anything.'] },
      { h: 'It Runs Itself', p: ['There is nothing to fill in or save here. Every week you confirm sharpens the projection, and every event you book raises the week it lands on. This page is a read-only look at what is coming.'] },
      { h: 'Adjusting a Week', p: ['Know something the average cannot see, a private party, a holiday, a slow week? Book the event in Events and it flows here on its own, or set the week\'s number on Build Schedule when you build the schedule. Either way it feeds back automatically.'] },
      { h: 'The Numbers', p: ['This Week and Next Week show the projected total, events included. Cover Goal is the guests you are projected to serve, which also feeds Build Schedule and the Pre-Shift Briefing. The projection below lists the next several weeks, with the events landing in each and the labor budget that forecast sets, so you can see what is building.'] },
      { h: 'Forecast Accuracy', p: ['Each confirmed week is paired against the forecast it was projected at, with the gap in dollars and percent. Average Error is how far off you have run across the matched weeks, and Matched Weeks counts how many pairs it has. Export PDF saves the table. Watch it tighten as Bar Cop learns your room.'] }
    ]);
  },

  // ── Hero: this week + next week + this week's cover goal (read-only) ─────────
  heroStrip() {
    const thisMon = this.currentWeekMon();
    const nextMon = this.addDays(thisMon, 7);
    const f0 = App.effectiveForecast(thisMon) || {};
    const f1 = App.effectiveForecast(nextMon) || {};
    const stat = (label, val, sub) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    const sub = (ws, f) => (f.events_total || 0) > 0 ? 'includes ' + this.fmt(f.events_total) + ' events' : this.weekRangeLabel(ws);
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('This Week', this.fmt(f0.total || 0), sub(thisMon, f0))
      + stat('Next Week', this.fmt(f1.total || 0), sub(nextMon, f1))
      + stat('Cover Goal', String(f0.total_covers || 0), 'guests this week')
      + '</div></div>';
  },

  // ── Projection: the next several weeks, read-only ───────────────────────────
  // Shared colgroup so the Projection and Forecast Accuracy tables line up column
  // for column down the page (both are five-column .row-list tables).
  _colgroup() {
    return '<colgroup><col style="width:26%"/><col style="width:18%"/><col style="width:19%"/><col style="width:18%"/><col style="width:19%"/></colgroup>';
  },

  projectionCard() {
    const thisMon = this.currentWeekMon();
    const laborPct = App.laborTargetPct ? App.laborTargetPct() : 30;
    const rows = [];
    for (let i = 0; i < 6; i++) {
      const ws = this.addDays(thisMon, i * 7);
      const f = App.effectiveForecast(ws) || {};
      const total = f.total || 0;
      const ev = (f.events_total || 0) > 0 ? this.fmt(f.events_total) : '<span style="color:var(--t4);">-</span>';
      rows.push('<tr><td>' + esc(this.weekRangeLabel(ws)) + (i === 0 ? ' <span style="color:var(--gold);font-size:10px;font-weight:800;letter-spacing:.5px;">NOW</span>' : '') + '</td>'
        + '<td>' + this.fmt(total) + '</td>'
        + '<td>' + ev + '</td>'
        + '<td>' + (f.total_covers || 0) + '</td>'
        + '<td>' + this.fmt(total * laborPct / 100) + '</td></tr>');
    }
    return '<div class="sh" style="margin:22px 0 10px;">Projection</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this._colgroup()
      + '<thead><tr><th>Week</th><th>Forecast</th><th>Events</th><th>Cover Goal</th><th>Labor Budget</th></tr></thead>'
      + '<tbody>' + rows.join('') + '</tbody></table></div>';
  },

  // ── Forecast accuracy — auto from confirmed weeks (no manual save) ───────────
  // Walk each confirmed week and pair its actual (bar + floor from the revenue
  // week, plus event revenue from the profit week's catering line) against the
  // forecast that was in effect for that week (App.effectiveForecast). Last 12.
  accuracyPairs() {
    const weeks = (App.data.revenue_weeks || []).slice();
    const profitWeeks = (App.data.weeks || []);
    const pairs = [];
    weeks.forEach(w => {
      const pe = w.period_end ? String(w.period_end).slice(0, 10) : '';
      if (!pe) return;
      const ws = App.weekStartFor(pe);
      const base = (parseFloat(w.bar_revenue) || 0) + (parseFloat(w.floor_revenue) || 0);
      const pw = profitWeeks.find(x => String(x.period_end || '').slice(0, 10) === pe);
      const cat = pw && pw.catering ? (parseFloat(pw.catering.revenue) || 0) : 0;
      const actual = base + cat;
      if (actual <= 0) return;
      const fc = App.effectiveForecast(ws);
      const forecast = fc && fc.total != null ? Number(fc.total) || 0 : 0;
      if (!(forecast > 0)) return;
      const gap = actual - forecast;
      const gapPct = forecast > 0 ? gap / forecast * 100 : null;
      pairs.push({ period_end: pe, forecast, actual, gap, gapPct });
    });
    pairs.sort((a, b) => b.period_end.localeCompare(a.period_end));
    return pairs.slice(0, 12);
  },

  accuracyBlock() {
    const recent = this.accuracyPairs();
    if (!recent.length) return '';
    const sumAbs = recent.reduce((s, p) => s + (p.gapPct != null ? Math.abs(p.gapPct) : 0), 0);
    const avgErr = sumAbs / recent.length;
    const rows = recent.map(p => {
      /* ⚠ THE GAP IS A CHANGE, SO IT TAKES A SIGN — AND THE SIGN GOES OUTSIDE THE DOLLAR SIGN.
         `this.fmt` is App.fmtCurrency, which is literally '$' + v, so
         `(p.gap >= 0 ? '+' : '') + this.fmt(p.gap)` printed a miss as "$-2,097.00" while the
         Gap % cell beside it read "-10.0%" through fmtSigned: two columns of one row
         disagreeing about where a minus goes. App.fmtBal is the canonical negative-safe
         money formatter, and the '+' on a beat now comes off fmtSigned's sign, so the sign
         AND the red/green class are both decided on the ROUNDED value — the same fix the %
         column already had. A week that hit its forecast exactly still leaves floating-point
         residue, and the old raw `>= 0` test let that residue paint a balanced row red. */
      const g = App.fmtSigned(p.gap, 2);
      const cls = g.sign < 0 ? 'neg' : 'pos';
      return '<tr><td>' + p.period_end + '</td>'
        + '<td>' + this.fmt(p.forecast) + '</td>'
        + '<td class="val">' + this.fmt(p.actual) + '</td>'
        + '<td class="' + cls + '">' + (g.sign > 0 ? '+' : '') + App.fmtBal(p.gap) + '</td>'
        + '<td class="' + cls + '">' + App.fmtSigned(p.gapPct, 1, '%').text + '</td></tr>';
    }).join('');
    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<div class="sh" style="margin:0;">Forecast Accuracy</div>'
      + '<button class="btn btn-ghost btn-sm" id="rf-export-acc">Export PDF</button></div>'
      + '<div id="rf-acc-export">'
      + '<div class="card" style="margin-top:8px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Average Error</div><div class="calc-val lg">' + avgErr.toFixed(1) + '%</div></div>'
      + '<div class="calc-item"><div class="calc-label">Matched Weeks</div><div class="calc-val lg">' + recent.length + '</div></div>'
      + '</div></div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this._colgroup()
      + '<thead><tr><th>Last 12 Weeks</th><th>Forecast</th><th>Actual</th><th>Gap $</th><th>Gap %</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div></div>';
  },

  draw() {
    if (App.markSetupDone) App.markSetupDone('gs_r_forecast');
    this.container.innerHTML = '<div class="screen">'
      + this.heroStrip()
      + this.projectionCard()
      + this.accuracyBlock()
      + '</div>';
    this.wire();
  },

  wire() {
    document.getElementById('rf-export-acc')?.addEventListener('click', () => App.exportPDF({ title: 'Forecast Accuracy', root: document.getElementById('rf-acc-export') || this.container }));
  }
};
