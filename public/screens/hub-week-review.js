'use strict';

/* ── Week in Review — the recap of a week that has finished ────────────────────
   For a FINISHED week it reads every section's real activity (counts taken, spot
   checks run, deliveries received, orders placed, hours and tips logged, logs
   filed) and lays out per section: what was DONE, what it turned up, and what is
   carrying into next week. Three bands, every one of them derived from records
   that exist. Monday-based weeks. Opened from the Week ▸ Review rail row.

   ⛔⛔⛔ IT NO LONGER ACCUSES THE OPERATOR, AND IT NO LONGER SHOWS A LIVE WEEK.
   Kyle, 2026-08-11: *"a recap of the PREVIOUS week only.. i don't think it should
   even have the week selector be able to land on the current unfinished week"*,
   and *"every section card shows a red 4 MISSED and 0 OF 4 derived from stepDone
   (manual ticks nothing reads), while its own DONE THIS WEEK band directly
   beneath proves the work happened."*
   ⭐ MEASURED BEFORE CUTTING: `stepDone` was read out of all eight sources, not
   taken from memory. Every one is `doneMap()` — an `App.acctGet` checkbox map —
   with ONE exception in the whole set: Profit and Revenue append
   `r.week = !!this.savedWeek(this.weekEnd())`, which is DERIVED from the
   confirmed-week record. Events' `stepInfo(...).done` is an ack plus a pending
   list, so it is a tick too. So the page printed a red "4 MISSED" off a control
   panel nothing downstream reads, directly above a band of real records proving
   the work happened. The one derived fact SURVIVES, re-derived here straight from
   `savedWeek`, so "the week was never confirmed" is still said — it just no
   longer needs a checkbox to say it.
   ⚠ AND EVERY "Carrying Into Next Week" ITEM GATED ON A TICK HAD TO BE RE-DERIVED
   OR REMOVED, never simply un-gated: an item is only allowed here if a record can
   prove it. Pinned by verify-week-review-recap.js. */

S.WeekReview = {
  container: null,
  _wkStart: null,   // Monday (ymd) of the selected week; null = this week

  open() {
    if (App._hubBlocked && App._hubBlocked()) return;   // app-wide accountability view — not for Staff
    App.openHubFullPage('Week in Review', (mount) => { this.container = mount; this.render(mount); }, 'week-review');
  },

  // ── Monday-based week (matches the section closes) ──────────────────────────
  _monday(dstr) {
    const d = dstr ? new Date(dstr + 'T00:00:00') : new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(d);
  },
  _addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  /* ⛔⛔ IT OPENS ON THE LAST WEEK YOU ACTUALLY CLOSED. That is the week an operator wants to read
     back, and a `weeks` record with a `period_end` is the only durable definition of "closed" in
     the app ([[confirm-the-week]]). No ticks.
     ⚠ NO FUTURE GUARD HERE ANY MORE, and that is the point: `confirm-week` stamps
     `period_end = App.nextSunday()`, which is TODAY OR LATER, so confirming the RUNNING week wrote a
     record on this week and the old guard waved it through — it only refused a week AHEAD of this
     one. `_defaultMonday`'s ceiling is now the single place that decides how recent the page may
     get, so there is no second rule to disagree with it ([[the-loop]] #45: one fact, one reader). */
  _lastClosedMonday() {
    const ends = ((App.data && App.data.weeks) || [])
      .map(w => String((w && w.period_end) || '').slice(0, 10))
      .filter(Boolean).sort();
    const last = ends[ends.length - 1];
    return last ? this._monday(last) : '';
  },
  /* ⛔⛔ ONE RULE, TWO READERS. `_wkS` is NOT the only thing that decides where this page opens —
     `render` pins `_wkStart` on its first pass so the week is stable across re-renders, and it did
     that with `_monday()`. So the first version of this change put the fallback in `_wkS` alone and
     was completely INERT: render had already assigned this week before `_wkS` was ever consulted.
     It read correct and did nothing, and only walking the page showed it. Both readers ask here. */
  /* ⛔⛔⛔ THE CEILING. The newest week this page can stand on is the week that ENDED. Kyle:
     *"a recap of the previous week.. i don't think it should even have the week selector be able to
     land on the current unfinished week."* A week half-lived has half its records, so a recap of it
     reports a bar that looks like it did nothing about a week nobody has finished.
     ⚠ IT IS A CAP, NOT A CLAMP: an operator who has not closed a week in a month still opens on the
     week they DID close. This only says how recent the page may get. */
  _maxMonday() { return this._addDays(this._monday(), -7); },
  _defaultMonday() {
    const lc = this._lastClosedMonday(), mx = this._maxMonday();
    return (lc && lc <= mx) ? lc : mx;
  },
  _wkS() { return this._wkStart || this._defaultMonday(); },
  _wkE() { return this._addDays(this._wkS(), 6); },
  _inWeek(dstr) { const d = String(dstr || '').slice(0, 10); const s = this._wkS(), e = this._wkE(); return !!d && d >= s && d <= e; },
  _atLatest() { return this._wkS() >= this._maxMonday(); },
  _step(n) {
    const next = this._addDays(this._wkS(), n);
    if (n > 0 && next > this._maxMonday()) return;
    this._wkStart = next;
    this.render(this.container);
  },

  // ── Shared visual bits ──────────────────────────────────────────────────────
  _eyebrow(t) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:11px;">' + t + '</div>';
  },
  _act(n, label) {
    const zero = !n;
    return '<div style="min-width:0;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:23px;font-weight:600;line-height:1;color:' + (zero ? 'var(--t4)' : 'var(--t1)') + ';">' + n + '</div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:4px;">' + label + '</div></div>';
  },
  _actRow(items) {
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 22px;"></div>';
    return '<div class="wr-statrow" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _res(label, val, col) {
    return '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
  },
  _resRow(items) {
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 24px;"></div>';
    return '<div class="wr-statrow" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _openItem(text, sev) {
    const col = sev === 'red' ? 'var(--red)' : 'var(--amber)';
    return '<div style="display:flex;align-items:center;gap:11px;padding:10px 13px;background:var(--gold-tint);border-radius:5px;">'
      + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + col + ';"></span>'
      + '<span style="font-size:12.5px;color:var(--t2);line-height:1.5;">' + text + '</span></div>';
  },
  /* ⛔ URGENT FIRST, ON EVERY CARD (Kyle, 2026-07-31: "the carrying into next week sections on
     each card are not consistent with the red urgent dot items all listed above the amber dot
     items"). This rendered in PUSH ORDER, so whether a red sat above an amber depended on which
     check happened to run first. Measured off the rendered dots, two of six populated cards were
     out of order — and on the Cash card the single most urgent line, "Safe-to-spend is negative",
     sat SECOND, under a merely-amber one.
     ⚠⚠ AND THE ORDER DECIDES WHAT SURVIVES: the 5-item cap below truncates whatever is last, so
     unsorted it could drop a RED while showing five ambers. The Labor card already pushes six.
     Sorting fixes the ordering and the truncation together.
     ⚠ STABLE within a band — the authored order inside red (and inside amber) is roughly
     worst-first and must not be shuffled. Pinned by verify-week-review-urgency-and-period.js. */
  _openList(items) {
    const rank = o => (o && o.sev === 'red') ? 0 : 1;
    const ranked = items.map((o, i) => ({ o, i }))
      .sort((a, b) => (rank(a.o) - rank(b.o)) || (a.i - b.i))
      .map(x => x.o);
    return ranked.length
      ? '<div style="display:flex;flex-direction:column;gap:8px;">' + ranked.slice(0, 5).map(o => this._openItem(o.t, o.sev)).join('') + '</div>'
      : '<div style="font-size:12.5px;color:var(--green);padding:2px 0;">&#10003; Nothing open. Clean week.</div>';
  },
  /* ⭐ AUDIT FRESHNESS, ASKED AT THE WEEK'S END, NOT AGAINST THE WALL CLOCK. The cockpits' own
     `_auditState` measures days since the newest audit against `Date.now()`, so on a recap of a week
     in March it would print "153 days old" — a fact about today wearing a past week's heading. The
     honest question about a finished week is how fresh the read was WHEN THAT WEEK CLOSED, and the
     app's own bar for "due" is 7 days. Judged against the data's own dates, so it has no shelf life
     ([[the-loop]] #135). ONE helper, three callers, so Profit, Revenue and Cash cannot drift apart
     on it ([[the-loop]] #54). */
  _auditGap(records) {
    const end = this._wkE();
    const last = (records || [])
      .map(a => String((a && (a.date || a.generated_at)) || '').slice(0, 10))
      .filter(d => d && d <= end).sort().pop();
    if (!last) return { ever: false, days: null, stale: true };
    const days = Math.round((new Date(end + 'T00:00:00').getTime() - new Date(last + 'T00:00:00').getTime()) / 86400000);
    return { ever: true, days: days, stale: days >= 7 };
  },
  /* Section shell: header (the section name, full-bleed divider) then inset-divided blocks.
     ⛔ NO STATUS CHIP AND NO FOOTER LINK. The chip counted manual ticks and the link opened one of
     the six cockpits being deleted — seven of the twenty-three remaining cockpit references in the
     whole app were this one line. A recap does not need eight doors on it. */
  _sectionCard(name, blocks) {
    const idiv = '<div class="wr-idiv"></div>';
    const header = '<div class="wr-head" style="display:flex;align-items:center;gap:12px;min-width:0;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--t1);">' + esc(name) + '</span>'
      + '</div>';
    const body = blocks.map(b => '<div class="wr-block">' + this._eyebrow(b.label) + b.html + '</div>').join(idiv);
    return '<div class="card" style="padding:0 !important;overflow:hidden;margin:0;display:flex;flex-direction:column;">'
      + header + '<div style="flex:1 1 auto;">' + body + '</div></div>';
  },

  // ── The week's money headline (from the confirmed week, matched by Sunday) ───
  _weekMoney() {
    const pe = this._wkE();
    const w  = ((App.data && App.data.weeks) || []).find(x => x && x.period_end === pe);
    const rw = ((App.data && App.data.revenue_weeks) || []).find(x => x && x.period_end === pe);
    let netSales = null, prime = null, laborPct = null;
    if (w) {
      const bar = w.bar || {}, food = w.food || {}, cat = w.catering || {}, oth = w.other || {};
      netSales = (bar.revenue || 0) + (food.revenue || 0) + (cat.revenue || 0) + (oth.revenue || 0);
      prime = w.prime_cost_pct;
    } else if (rw) {
      netSales = (rw.bar_revenue || 0) + (rw.floor_revenue || 0);
    }
    // Labor % is ConfirmWeek's `labor_pct_blended`, measured against TOTAL SALES with
    // catering labor in the numerator ([[labor-cost-model]] THE DENOMINATORS). When that
    // number is missing, rebuild it THE SAME WAY — two things were wrong with the old
    // fallback and both showed the operator a number that was not true:
    //   1. `(b.labor || 0)` reads a BLANK as zero, so a week with revenue and no labor
    //      entered printed a confident "Labor 0.0%" — the best labor number a bar can
    //      have, on a week with no labor data at all. ConfirmWeek is deliberately
    //      null-in/null-out here ("a percentage whose input was never entered is
    //      unknown, and it stays unknown all the way into the store") and every other
    //      consumer honours it: hub.js, r-dashboard.js and hub-group-dashboard.js all
    //      print '-'. This was the only site that invented a value.
    //   2. It divided bar+food labor by bar+food revenue, dropping catering from BOTH
    //      sides, so the same "Labor" label switched basis depending on whether a
    //      revenue_week happened to exist (measured 2.34 points high on a catering week).
    // `laborIn` MIRRORS confirm-week's gate exactly — a department owes a labor figure
    // only once it has rung sales, so a bar with no kitchen still resolves. Do not
    // "simplify" it to a plain null check or a bar-only operation goes unknown forever.
    if (rw && rw.labor_pct_blended != null) laborPct = rw.labor_pct_blended;
    else if (w) {
      const b = w.bar || {}, f = w.food || {}, c = w.catering || {}, o = w.other || {};
      const bR = b.revenue || 0, fR = f.revenue || 0;
      const laborIn = (!(bR > 0) || b.labor != null) && (!(fR > 0) || f.labor != null);
      const totSales = bR + fR + (c.revenue || 0) + (o.revenue || 0);
      if (laborIn && totSales > 0) {
        laborPct = ((b.labor || 0) + (f.labor || 0) + (c.labor || 0)) / totSales * 100;
      }
    }
    /* ⛔ REPORT WHETHER THE WEEK IS CONFIRMED, NOT JUST WHAT IT IS WORTH (W2). These tiles print
       a bare '-' until the week is confirmed, while the Shift card ten inches below prints
       "Net Sales $19,150" off the LOGGED shifts. Both are right and they answer different
       questions — this one is "what did you sign off", that one is "what has been logged so far"
       — but they carry the same label and nothing said which was which
       ([[the-loop]] #57: different quantities are allowed to differ; the fix is the label).
       ⚠ The flag is about the RECORD EXISTING, never about a value being null: a week can be
       confirmed and still leave Labor % unknown (confirm-week is null-in/null-out there on
       purpose), and captioning that "not confirmed" would be a false statement about the
       operator's own work. */
    return { netSales, prime, laborPct, confirmed: !!(w || rw) };
  },
  _topCard() {
    const m = this._weekMoney();
    const pct = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';
    const stat = (label, val) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:7px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:600;line-height:0.9;color:var(--w);">' + val + '</div></div>';
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 34px;"></div>';
    const stats = [
      stat('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-'),
      stat('Prime Cost', pct(m.prime)),
      stat('Labor', pct(m.laborPct))
    ].join(vdiv);
    return '<div class="card" style="margin-bottom:16px;overflow:hidden;padding:0 !important;">'
      + '<div class="wr-tophead" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Week In Review</div>'
      + '</div>'
      + '<div class="wr-statrow wr-topstats" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + stats + '</div>'
      /* ⛔ SAY WHY THESE ARE BLANK (W2). Three dashes up here beside "Net Sales $19,150" in the
         Shift card read as a contradiction; they are two different questions and only this one
         waits on the weekly close. Said ONCE, under the row, rather than stuffing words into a
         38px number slot. Gated on the week RECORD, never on a null figure. */
      /* ⚠ PAST TENSE, BECAUSE THE WEEK IS OVER. It still says how to fix it: Close The Week steps
         back to any past week, so an unconfirmed week is not a closed door. */
      + (m.confirmed ? ''
          : '<div class="wr-note" style="padding-top:0;font-size:11.5px;color:var(--t3);line-height:1.6;">'
            + 'This week was never confirmed, so these stayed blank. You can still confirm it from Close The Week. The section cards below show what was logged.</div>')
      + '</div>';
  },

  // ── Inventory ───────────────────────────────────────────────────────────────
  _inventorySection() {
    const ID = S.InventoryDashboard;
    if (!ID) return '';
    const inv = (App.inventoryData) || {};
    const products = (inv.ic_products || []).filter(p => p.active !== false);
    if (!products.length || !(inv.ic_counts || []).length) return null;

    const sv = ID._weekStart;
    ID._weekStart = this._wkS();
    let st;
    try { st = ID.computeState(); } finally { ID._weekStart = sv; }

    const wkCounts   = (inv.ic_counts || []).filter(c => this._inWeek(c.date)).length;
    const wkSpot     = App.completedSpotChecks().filter(s => this._inWeek(s.date)).length;
    const wkDeliv    = st.deliveriesThisWeek || 0;
    const wkOrders   = (inv.ic_orders || []).filter(o => this._inWeek(o.date)).length;
    const wkAdj      = (inv.ic_adjustments || []).filter(a => this._inWeek(a.date_time || a.created_at)).length;
    const wkTransfer = (inv.ic_transfers || []).filter(t => this._inWeek(t.date_time || t.created_at)).length;

    const activity = this._actRow([
      this._act(wkCounts, 'Counts'), this._act(wkDeliv, 'Deliveries'), this._act(wkOrders, 'Orders'),
      this._act(wkSpot, 'Spot Checks'), this._act(wkAdj, 'Adjustments'), this._act(wkTransfer, 'Transfers')
    ]);
    const results = this._resRow([
      this._res('Used This Period', st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-'),
      this._res('Below Par', App.fmtCurrency(st.reorderTotal, 0), st.reorderCount ? 'var(--amber)' : 'var(--t1)'),
      this._res('Shrinkage 30d', App.fmtCurrency(st.shrink, 0), st.shrink > 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Dead Stock', String(st.deadAll), st.deadAll > 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Over Target', String(st.menuOver), st.menuOver > 0 ? 'var(--red)' : 'var(--t1)')
    ]);
    /* ⛔ "Variance flags never reviewed this week" is GONE, not un-gated: its only evidence was the
       `review` checkbox, and nothing in the app records that a human looked at a flag. An item with
       no record behind it does not belong on a page whose whole claim is that it reads real logs.
       ⭐ "below par, no order placed" KEPT, re-derived: the order records for the week are right
       here, so the sentence can be proved instead of asserted. */
    const open = [];
    if (st.reorderCount > 0 && wkOrders === 0) open.push({ t: '<b>' + st.reorderCount + '</b> item' + (st.reorderCount === 1 ? '' : 's') + ' below par and no order placed all week', sev: 'red' });
    if (st.deadAll > 0) open.push({ t: '<b>' + st.deadAll + '</b> dead-stock item' + (st.deadAll === 1 ? '' : 's') + ' tying up cash', sev: 'amber' });
    if (st.parOff > 0) open.push({ t: '<b>' + st.parOff + '</b> par' + (st.parOff === 1 ? '' : 's') + ' off versus real usage', sev: 'amber' });
    if (st.menuOver > 0) open.push({ t: '<b>' + st.menuOver + '</b> menu item' + (st.menuOver === 1 ? '' : 's') + ' over cost target', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Inventory',
      activity: 'Counts ' + wkCounts + ', Deliveries ' + wkDeliv + ', Orders ' + wkOrders + ', Spot Checks ' + wkSpot + ', Adjustments ' + wkAdj + ', Transfers ' + wkTransfer,
      results: 'Used ' + (st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-') + ', Below Par ' + App.fmtCurrency(st.reorderTotal, 0) + ', Shrinkage 30d ' + App.fmtCurrency(st.shrink, 0) + ', Dead Stock ' + st.deadAll + ', Over Target ' + st.menuOver,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Inventory', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Labor ───────────────────────────────────────────────────────────────────
  _laborSection() {
    const LD = S.LaborDashboard;
    if (!LD) return '';
    const lab = (App.laborData) || {};
    if (!(lab.lc_staff || []).length || !(lab.lc_actuals || []).length) return null;

    const target = App.laborTargetPct ? App.laborTargetPct() : 29;
    const today = App.todayLocal();
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return App.ymdLocal(d); })();

    const sv = LD._weekStart;
    LD._weekStart = this._wkS();
    let wkHours, wkCost, laborPct, rplh, proj, tipN, calloutN, calloutUncov, toPending, expired, expiring, schedBuilt;
    try {
      const wkStart = LD.weekStart(), wkEnd = LD.weekEnd();
      const endCap = wkEnd < today ? wkEnd : today;
      const wkActuals = LD.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
      wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
      const salCost = (App.salariedCost ? App.salariedCost(wkStart, endCap).total : 0) || 0;
      const otPrem = App.otPremiumForRows ? App.otPremiumForRows(wkActuals).total : 0;   // 0.5x over 40/wk, not stored in a.cost
      wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + salCost + otPrem;
      const weekRevenue = ((App.shiftData && App.shiftData.sc_shifts) || [])
        .filter(s => LD.inWeek(s.date)).reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
      laborPct = weekRevenue > 0 ? (wkCost / weekRevenue * 100) : null;
      rplh = (wkHours > 0 && weekRevenue > 0) ? (weekRevenue / wkHours) : null;
      proj = LD.weekProjection();
      tipN = LD.tips().filter(t => LD.inWeek(t.date)).length;
      calloutN = LD.callouts().filter(c => LD.inWeek(c.date)).length;
      calloutUncov = LD.callouts().filter(c => LD.inWeek(c.date) && !c.covered).length;
      toPending = LD.timeOff().filter(t => t.status === 'Requested').length;
      const activeIds = new Set(LD.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
      expired = LD.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today).length;
      expiring = LD.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30).length;
      schedBuilt = LD.schedules().some(s => s.week_start === LD.nextWeekStart());
    } finally { LD._weekStart = sv; }

    const otRisk = (proj.over || 0) + (proj.approaching || 0);

    const activity = this._actRow([
      this._act(wkHours ? wkHours.toFixed(1) : 0, 'Hours'),
      this._act(tipN, 'Tip Entries'),
      this._act(calloutN, 'Call-Outs'),
      this._act(toPending, 'Time-Off')
    ]);
    const results = this._resRow([
      this._res('Labor Cost', App.fmtCurrency(wkCost, 0)),
      this._res('Labor %', laborPct != null ? laborPct.toFixed(1) + '%' : '-', (laborPct != null && laborPct > target) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Hours', wkHours.toFixed(1)),
      this._res('RPLH', rplh != null ? App.fmtCurrency(rplh) : '-'),
      this._res('OT Risk', String(otRisk), otRisk > 0 ? 'var(--amber)' : 'var(--t1)')
    ]);
    /* ⭐ THE SCHEDULE ITEM ALREADY HAD A DATA HALF, so dropping the tick half cost nothing:
       `schedBuilt` asks the store whether a schedule exists for the week AFTER the one under
       review, which is the actual fact the sentence claims. */
    const open = [];
    if (!schedBuilt) open.push({ t: "Next week's schedule was never built", sev: 'red' });
    if (proj.over > 0) open.push({ t: '<b>' + proj.over + '</b> staff projected over ' + App.OT_THRESHOLD + ' hrs (~' + App.fmtCurrency(proj.otPremium, 0) + ' premium)', sev: 'red' });
    if (calloutUncov > 0) open.push({ t: '<b>' + calloutUncov + '</b> uncovered call-out' + (calloutUncov === 1 ? '' : 's') + ' this week', sev: 'red' });
    if (toPending > 0) open.push({ t: '<b>' + toPending + '</b> time-off request' + (toPending === 1 ? '' : 's') + ' to review', sev: 'amber' });
    if (expired > 0) open.push({ t: '<b>' + expired + '</b> certification' + (expired === 1 ? '' : 's') + ' expired', sev: 'red' });
    if (expiring > 0) open.push({ t: '<b>' + expiring + '</b> certification' + (expiring === 1 ? '' : 's') + ' expiring within 30 days', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Labor',
      activity: 'Hours ' + (wkHours ? wkHours.toFixed(1) : 0) + ', Tip Entries ' + tipN + ', Call-Outs ' + calloutN + ', Time-Off ' + toPending,
      results: 'Labor Cost ' + App.fmtCurrency(wkCost, 0) + ', Labor % ' + (laborPct != null ? laborPct.toFixed(1) + '%' : '-') + ', Hours ' + wkHours.toFixed(1) + ', RPLH ' + (rplh != null ? App.fmtCurrency(rplh) : '-') + ', OT Risk ' + otRisk,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Labor', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Shift ───────────────────────────────────────────────────────────────────
  _shiftSection() {
    const SD = S.ShiftDashboard;
    if (!SD) return '';
    const sh = (App.shiftData) || {};
    if (!(sh.sc_shifts || []).length) return null;

    const sv = SD._weekEnd;
    SD._weekEnd = this._wkE();
    let rev, covers, checkAvg, voidTot, compTot, netVar, days, vcN, wasteN, walkedN, reconN, shorts;
    try {
      const wkS = SD.shifts().filter(s => SD.inWeek(s.date));
      rev = wkS.reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
      covers = wkS.reduce((t, s) => t + (s.covers || 0), 0);
      checkAvg = covers > 0 ? rev / covers : null;
      const wkVC = SD.voidComps().filter(r => SD.inWeek(r.date));
      voidTot = wkVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
      compTot = wkVC.filter(r => r.type === 'Comp').reduce((t, r) => t + (r.amount || 0), 0);
      const wkVar = SD.variances().filter(v => SD.inWeek(v.date));
      netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
      shorts = wkVar.filter(v => v.status === 'Short').length;
      reconN = wkVar.length;
      days = wkS.length;
      vcN = wkVC.length;
      wasteN = SD.waste().filter(r => SD.inWeek(r.date)).length;
      walkedN = SD.walkedTabs().filter(r => SD.inWeek(r.date)).length;
    } finally { SD._weekEnd = sv; }

    const activity = this._actRow([
      this._act(days, 'Days'), this._act(reconN, 'Reconciles'), this._act(vcN, 'Voids/Comps'),
      this._act(wasteN, 'Waste'), this._act(walkedN, 'Walked Tabs')
    ]);
    const results = this._resRow([
      this._res('Net Sales', App.fmtCurrency(rev, 0)),
      this._res('Covers', String(covers)),
      this._res('Check Avg', checkAvg != null ? App.fmtCurrency(checkAvg) : '-'),
      this._res('Over / Short', (netVar > 0 ? '+' : '') + App.fmtBal(netVar, 0), netVar < 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Voids + Comps', App.fmtCurrency(voidTot + compTot, 0))
    ]);
    /* ⛔ "Loss flags never reviewed this week" is GONE — its only evidence was the `review` tick.
       ⭐ "Cash not reconciled" KEPT, on its data half alone, plus the guard the tick used to supply
       by accident: a week the bar never traded has nothing to reconcile, and accusing it of a
       missed reconcile is the same false accusation in a new costume. */
    const open = [];
    if (shorts > 0) open.push({ t: '<b>' + shorts + '</b> cash-short shift' + (shorts === 1 ? '' : 's') + ' to chase', sev: 'red' });
    if (days > 0 && reconN === 0) open.push({ t: 'Cash was never reconciled this week', sev: 'amber' });
    if (walkedN > 0) open.push({ t: '<b>' + walkedN + '</b> walked tab' + (walkedN === 1 ? '' : 's') + ' this week', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Shift',
      activity: 'Days ' + days + ', Reconciles ' + reconN + ', Voids/Comps ' + vcN + ', Waste ' + wasteN + ', Walked Tabs ' + walkedN,
      results: 'Net Sales ' + App.fmtCurrency(rev, 0) + ', Covers ' + covers + ', Check Avg ' + (checkAvg != null ? App.fmtCurrency(checkAvg) : '-') + ', Over/Short ' + (netVar > 0 ? '+' : '') + App.fmtBal(netVar, 0) + ', Voids+Comps ' + App.fmtCurrency(voidTot + compTot, 0),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Shift', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Profit (Recovery) ───────────────────────────────────────────────────────
  _profitSection() {
    const PD = S.Dashboard;
    if (!PD) return '';
    if (!((App.data && App.data.weeks) || []).length && !((App.data && App.data.audits) || []).length) return null;

    /* ⛔ TWO CURRENT-STATE FIGURES CAME OFF THIS CARD IN THE SAME EDIT, for one reason written
       here in the file already: a number about today does not belong under a past week's heading.
         · `Recoverable/yr` was gated on "is this the current week", which this page can no longer
           be, so the cell could only ever print a dash — a dead gate is not a safe gate.
         · "Biggest leak not worked" was that same class PLUS a tick: `_topLeak` ranks
           `Recovery.gapImpact` as it stands TODAY, and `!done.leaks` was the checkbox.
       The Hub is the page that answers "what should I work on now"; this one answers "what did that
       week do". */
    const sv = PD._weekEnd;
    PD._weekEnd = this._wkE();
    let w, costRows, overCount;
    try {
      w = PD.savedWeek(this._wkE());
      costRows = w ? PD._costRows(w) : null;
      overCount = costRows ? costRows.filter(r => r.over).length : 0;
    } finally { PD._weekEnd = sv; }

    // Real recovery activity logged this week (records dated in the window).
    const dat = App.data || {};
    const auditsWk  = (dat.audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10))).length;
    const reviewsWk = (dat.sales_reviews || []).filter(r => this._inWeek(r.date || r.created_at)).length;
    const discWk    = (dat.vendor_discrepancies || []).filter(d => this._inWeek(d.date || d.filed_at || d.created_at)).length;
    const investWk  = (dat.variance_investigations || []).filter(i => this._inWeek(i.opened_date || i.date)).length;
    const expActive = (dat.profit_initiatives || []).filter(e => e.status === 'Active').length;

    const activity = this._actRow([
      this._act(auditsWk, 'Audits Run'), this._act(reviewsWk, 'Sales Reviews'), this._act(discWk, 'Discrepancies'),
      this._act(investWk, 'Investigations'), this._act(expActive, 'Experiments')
    ]);
    const costCell = (i, label) => {
      const r = costRows ? costRows[i] : null;
      const has = r && r.val != null;
      return this._res(label, has ? r.val.toFixed(1) + '%' : '-', has ? (r.over ? 'var(--red)' : 'var(--green)') : 'var(--t1)');
    };
    const results = this._resRow([
      costCell(0, 'Bar Pour'), costCell(1, 'Food Cost'), costCell(2, 'Prime Cost')
    ]);

    /* ⭐ "the week was never confirmed" IS THE ONE DERIVED FACT IN THE WHOLE STEP SET, and it
       survives — asked straight of the record now (`!w`) instead of through `stepDone`, which was
       only ever passing this same answer through. Nothing was lost by cutting the ticks. */
    const ag = this._auditGap(dat.audits);
    const open = [];
    if (!w) open.push({ t: 'This week was never confirmed, so its cost numbers stayed blank', sev: 'red' });
    if (w && overCount > 0) {
      const names = costRows.filter(r => r.over).map(r => r.label.toLowerCase());
      open.push({ t: '<b>' + overCount + '</b> of 3 costs over target (' + names.join(', ') + ')', sev: overCount >= 2 ? 'red' : 'amber' });
    }
    if (!ag.ever) open.push({ t: 'No Profit audit had been run by the end of this week', sev: 'amber' });
    else if (ag.stale) open.push({ t: 'Profit audit was <b>' + ag.days + '</b> days old when this week closed', sev: 'amber' });

    const pcv = i => (costRows && costRows[i] && costRows[i].val != null) ? (costRows[i].val.toFixed(1) + '%') : '-';
    (this._pdf || (this._pdf = [])).push({ name: 'Profit',
      activity: 'Audits Run ' + auditsWk + ', Sales Reviews ' + reviewsWk + ', Discrepancies ' + discWk + ', Investigations ' + investWk + ', Experiments ' + expActive,
      results: 'Bar Pour ' + pcv(0) + ', Food ' + pcv(1) + ', Prime ' + pcv(2),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Profit', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Revenue (Recovery) ──────────────────────────────────────────────────────
  _revenueSection() {
    const RD = S.RevenueDashboard;
    if (!RD) return '';
    if (!((App.data && App.data.revenue_weeks) || []).length && !((App.data && App.data.revenue_audits) || []).length) return null;

    // Same two current-state figures came off this card as off Profit's — see the note there.
    const sv = RD._weekEnd;
    RD._weekEnd = this._wkE();
    let w, metrics, offCount;
    try {
      w = RD.savedWeek(this._wkE());
      metrics = RD.metricsRows(w || {});
      offCount = metrics.filter(m => m.good === false).length;
    } finally { RD._weekEnd = sv; }

    const dat = App.data || {};
    const auditsWk = (dat.revenue_audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10))).length;
    const priceWk  = (dat.revenue_price_log || []).filter(p => this._inWeek(p.date || p.created_at || p.changed_at)).length;
    const dogWk    = (dat.menu_dog_tests || []).filter(t => this._inWeek(t.start_date || t.created_at)).length;
    const checkWk  = (dat.revenue_server_checks || []).filter(c => this._inWeek(c.date || c.created_at)).length;
    const expActive = (dat.initiatives || []).filter(e => e.status === 'Active').length;

    const activity = this._actRow([
      this._act(auditsWk, 'Audits Run'), this._act(priceWk, 'Price Changes'), this._act(dogWk, 'Dog Tests'),
      this._act(checkWk, 'Server Checks'), this._act(expActive, 'Experiments')
    ]);
    const mCell = (i, label) => {
      const m = metrics[i];
      const col = (m && m.good != null) ? (m.good ? 'var(--green)' : 'var(--red)') : 'var(--t1)';
      return this._res(label, m ? m.value : '-', col);
    };
    const results = this._resRow([
      mCell(0, 'Check Avg'), mCell(1, 'Labor %'), mCell(2, 'Rev / Labor Hr')
    ]);

    const ag = this._auditGap(dat.revenue_audits);
    const open = [];
    if (!w) open.push({ t: 'This week was never confirmed, so its numbers stayed blank', sev: 'red' });
    if (w && offCount > 0) {
      const names = metrics.filter(m => m.good === false).map(m => m.label.toLowerCase());
      open.push({ t: '<b>' + offCount + '</b> off target (' + names.join(', ') + ')', sev: offCount >= 2 ? 'red' : 'amber' });
    }
    if (!ag.ever) open.push({ t: 'No Revenue audit had been run by the end of this week', sev: 'amber' });
    else if (ag.stale) open.push({ t: 'Revenue audit was <b>' + ag.days + '</b> days old when this week closed', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Revenue',
      activity: 'Audits Run ' + auditsWk + ', Price Changes ' + priceWk + ', Dog Tests ' + dogWk + ', Server Checks ' + checkWk + ', Experiments ' + expActive,
      results: 'Check Avg ' + metrics[0].value + ', Labor % ' + metrics[1].value + ', Rev/Labor Hr ' + metrics[2].value,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Revenue', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Cash (Recovery; numbers are a live position, not per-week) ──────────────
  /* ⭐⭐ THE ONLY SECTION THAT NOW READS NOTHING FROM A DYING COCKPIT. `S.CashDashboard` was here for
     one reason — `stepDone()` — so cutting the ticks cut the dependency with it. The other five
     module sections still read their cockpit for real DATA (`ID.computeState`, `LD.actuals`,
     `SD.shifts`, `PD.savedWeek`/`_costRows`, `RD.metricsRows`), which is the extraction 1c still
     needs and is tracked as its own piece of work. */
  _cashSection() {
    if (!window.CashEngine) return '';
    const trapped = CashEngine.trapped ? CashEngine.trapped() : { hasData: false };
    const sf = CashEngine.survivalForecast ? CashEngine.survivalForecast(13) : { hasData: false };
    const pos = CashEngine.position ? CashEngine.position() : { hasOpening: false };
    if (!trapped.hasData && !sf.hasData) return null;

    const dat = App.data || {};
    const auditsWk  = (dat.cash_audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10))).length;
    const expActive = (dat.cash_initiatives || []).filter(e => e.status === 'Active').length;

    const runwayLabel = r => r == null ? '13+ wks' : r === 0 ? 'This wk' : r + ' wk' + (r === 1 ? '' : 's');

    const activity = this._actRow([
      this._act(auditsWk, 'Audits Run'), this._act(expActive, 'Experiments')
    ]);
    const results = this._resRow([
      this._res('Trapped Cash', trapped.hasData ? App.fmtCurrency(trapped.total, 0) : '-', (trapped.hasData && trapped.total > 0) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Runway', (sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-', (sf.hasOpening && sf.runway != null) ? 'var(--red)' : 'var(--t1)'),
      this._res('Safe to Spend', pos.hasOpening ? App.fmtBal(pos.safe, 0) : '-', (pos.hasOpening && pos.safe < 0) ? 'var(--red)' : 'var(--t1)'),
      this._res('Tightest Week', (sf.hasData && sf.lowPoint) ? App.fmtBal(sf.lowPoint.balance, 0) : '-', (sf.lowPoint && sf.lowPoint.balance < 0) ? 'var(--red)' : 'var(--t1)')
    ]);

    const ag = this._auditGap(dat.cash_audits);
    const open = [];
    if (trapped.hasData && trapped.total > 0) open.push({ t: '<b>' + App.fmtCurrency(trapped.total, 0) + '</b> still trapped on the shelf', sev: 'amber' });
    if (sf.hasOpening && sf.runway != null && sf.runway <= 4) open.push({ t: 'Cash runs thin, about ' + runwayLabel(sf.runway) + ' of runway', sev: 'red' });
    else if (sf.hasData && sf.tightWeeks > 0) open.push({ t: '<b>' + sf.tightWeeks + '</b> tight week' + (sf.tightWeeks === 1 ? '' : 's') + ' in the next 13', sev: 'amber' });
    if (pos.hasOpening && pos.safe != null && pos.safe < 0) open.push({ t: 'Safe-to-spend is negative, into money already spoken for', sev: 'red' });
    if (!ag.ever) open.push({ t: 'No Cash audit had been run by the end of this week', sev: 'amber' });
    else if (ag.stale) open.push({ t: 'Cash audit was <b>' + ag.days + '</b> days old when this week closed', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Cash',
      activity: 'Audits Run ' + auditsWk + ', Experiments ' + expActive,
      results: 'Current position: Trapped Cash ' + (trapped.hasData ? App.fmtCurrency(trapped.total, 0) : '-') + ', Runway ' + ((sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-') + ', Safe to Spend ' + (pos.hasOpening ? App.fmtBal(pos.safe, 0) : '-') + ', Tightest Week ' + ((sf.hasData && sf.lowPoint) ? App.fmtBal(sf.lowPoint.balance, 0) : '-'),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Cash', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Position', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Events (pipeline, not a weekly close) ───────────────────────────────────
  _eventsSection() {
    const ED = S.EventsDashboard;
    if (!ED) return '';
    if (!((App.data && App.data.bookings) || []).length) return null;

    // Events' `stepInfo(...).done` was an ACK plus a pending list, so it was a tick too.
    let st;
    try { st = ED._computeState(); } catch (e) { return null; }

    const bookings = (App.data && App.data.bookings) || [];
    const newBookWk = bookings.filter(b => this._inWeek(b.date_received)).length;
    const heldWk    = bookings.filter(b => this._inWeek(b.event_date) && (b.stage === 'Booked' || b.stage === 'Completed')).length;
    const depCollWk = bookings.filter(b => this._inWeek(b.deposit_paid_date)).length;

    const activity = this._actRow([
      this._act(newBookWk, 'New Bookings'), this._act(heldWk, 'Events Held'), this._act(depCollWk, 'Deposits In')
    ]);
    const results = this._resRow([
      this._res('Booked', ED._money(st.bookedRev)),
      this._res('Pipeline', ED._money(st.pipeline)),
      this._res('Deposits Due', ED._money(st.depositsDue), st.depositsDue > 0 ? 'var(--amber)' : 'var(--t1)'),
      this._res('Win Rate', st.conv)
    ]);

    const open = [];
    if (st.open.length) open.push({ t: '<b>' + st.open.length + '</b> open lead' + (st.open.length === 1 ? '' : 's') + ' to follow up', sev: st.stale.length ? 'red' : 'amber' });
    if (st.depositsDue > 0) open.push({ t: '<b>' + ED._money(st.depositsDue) + '</b> in deposits still due', sev: 'amber' });
    if (st.noRunSheet.length) open.push({ t: '<b>' + st.noRunSheet.length + '</b> upcoming event' + (st.noRunSheet.length === 1 ? '' : 's') + ' need a run sheet', sev: 'amber' });
    if (st.completedOpen.length) open.push({ t: '<b>' + st.completedOpen.length + '</b> completed event' + (st.completedOpen.length === 1 ? '' : 's') + ' to close out', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Events',
      activity: 'New Bookings ' + newBookWk + ', Events Held ' + heldWk + ', Deposits In ' + depCollWk,
      results: 'Booked ' + ED._money(st.bookedRev) + ', Pipeline ' + ED._money(st.pipeline) + ', Deposits Due ' + ED._money(st.depositsDue) + ', Win Rate ' + st.conv,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Events', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Pipeline', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Books (monthly close) ───────────────────────────────────────────────────
  _booksSection() {
    const BH = S.HubBooksHome;
    if (!BH) return '';
    if (!((App.data && App.data.weeks) || []).length) return null;

    let st;
    try { st = BH._computeState(); } catch (e) { return null; }

    /* ⛔ BILLS ARE NOT OUTFLOWS, AND THIS COUNTED ONE DRAW AS BOTH. Since the one-ledger merge
       `operating_expenses` also holds the cash outflows, so an owner draw incremented "Bills
       Logged" here AND "Outflows Logged" on the line below it, side by side on the same card and
       in the PDF. It also suppressed the "no bills logged this month yet" prompt for a month whose
       only row was a draw. */
    const opex = ((App.data && App.data.operating_expenses) || [])
      .filter(r => !S.HubOperatingExpenses.isCashOnlyCategory(r && r.category));
    const billsWk = opex.filter(r => r && this._inWeek(r.date)).length;
    // ⭐ THE LEDGER, through the engine's own reader, so this count and the forecast can never be
    // counting two different sets of records (the cutover — see CashEngine.cashOutflows).
    const outflowWk = (CashEngine.cashOutflows() || []).filter(o => this._inWeek(o.date || o.created_at)).length;
    const billsMonth = opex.filter(r => r && String(r.date || '').slice(0, 7) === st.curKey).length;
    const rawRun = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
    const pnlRun = rawRun('books_report_run_weeklypnl');
    const meRun  = rawRun('books_report_run_monthend');
    const reportsWk = (pnlRun && this._inWeek(String(pnlRun).slice(0, 10)) ? 1 : 0) + (meRun && this._inWeek(String(meRun).slice(0, 10)) ? 1 : 0);

    /* ⛔⛔ THE STEP LIST IS GONE, AND WITH IT THE DRIFT IT KEPT CAUSING. It was hand-copied and had
       already drifted twice — Kyle spotted the second: *"the week review 4 steps don't match books
       now."* Deriving it from `BH.ORDER` fixed the drift and left the real defect standing, which is
       that the whole band counted checkboxes. There is nothing left here to keep in step. */
    const activity = this._actRow([
      this._act(billsWk, 'Bills Logged'), this._act(outflowWk, 'Outflows Logged'), this._act(reportsWk, 'Reports Run')
    ]);
    const results = this._resRow([
      this._res('Op Income YTD', BH._money(st.ytdInc), st.ytdInc < 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Margin', BH._pct(st.ytdMargin)),
      this._res('Month Revenue', BH._money(st.cmRev)),
      this._res('Month Income', BH._money(st.mInc), st.mInc < 0 ? 'var(--red)' : 'var(--t1)')
    ]);

    /* ⛔ "<Month> books not closed yet" is GONE: its only evidence was the `generate` tick, and
       nothing durable records that the month-end pack was produced (the localStorage stamp is the
       run DATE, not the month it covers, so it cannot answer the question). The two items that
       survive are both records: the month's bill rows, and the permit dates. */
    const open = [];
    if (billsMonth === 0) open.push({ t: 'No bills logged this month yet', sev: 'amber' });
    if (st.dueCount > 0) open.push({ t: '<b>' + st.dueCount + '</b> permit/license item' + (st.dueCount === 1 ? '' : 's') + ' need attention', sev: st.expiredCt > 0 ? 'red' : 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Books',
      activity: 'Bills Logged ' + billsWk + ', Outflows Logged ' + outflowWk + ', Reports Run ' + reportsWk,
      results: 'Op Income YTD ' + BH._money(st.ytdInc) + ', Margin ' + BH._pct(st.ytdMargin) + ', Month Revenue ' + BH._money(st.cmRev) + ', Month Income ' + BH._money(st.mInc),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing to close' });
    return this._sectionCard('Books', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Month + YTD', html: results },
      { label: 'To Close', html: this._openList(open) }
    ]);
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    // ⛔ THE SEED IS THE REAL DECISION — see `_defaultMonday`. This line is what actually decides
    // where the page opens, and pointing it at `_monday()` is what made the first attempt inert.
    if (this._wkStart == null) this._wkStart = this._defaultMonday();

    /* ⛔ THE EMPTY STATE IS A DOOR, AND IT POINTED AT A COCKPIT. This was the seventh cockpit
       reference in the file and the only one an operator can actually press, because it is the one
       thing that renders on day one. It names the two real first jobs instead, both survivors. */
    const products = ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
    const counts = (App.inventoryData && App.inventoryData.ic_counts) || [];
    if (!products.length || !counts.length) {
      App.setupCard(mount, {
        title: 'Week in Review',
        lead: 'Week in Review recaps a week that has finished: what your team logged in each section, what it turned up, and what carried over. It reads your real records, so there is nothing here until a week has been worked.',
        steps: [
          { title: 'Add your products', desc: 'Vendors first, then the products you buy from them.', btn: 'Add Products', screen: 'ic-vendors', done: products.length > 0 },
          { title: 'Take a count', desc: 'Count your stock. Once a week has been worked, it reads back here the following week.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: counts.length > 0 }
        ]
      });
      return;
    }

    // ── Week selector (standard buttoned arrows + pill + This Week) ─────────────
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    // ⛔ The forward arrow stops at the week that ENDED. There is no way to reach the live week.
    const atLatest = this._atLatest();
    const prevBtn = '<button class="btn btn-ghost btn-sm wr-arrow" data-step="-7" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = atLatest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm wr-arrow" data-step="7" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pill = '<span style="display:inline-flex;align-items:center;border:1px solid var(--b-edge);background:var(--sel-active-bg);border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;color:var(--t1);white-space:nowrap;">'
      + esc(range) + (atLatest ? '<span style="color:var(--gold);font-weight:800;font-size:11px;margin-left:6px;">LAST WEEK</span>' : '') + '</span>';
    const nowBtn = atLatest ? '' : '<button class="btn btn-ghost btn-sm wr-now" style="margin-left:4px;">Last Week</button>';
    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="wr-export">Export PDF</button>';
    const selectorRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>'
      + exportBtn + '</div>';

    this._pdf = [];   // section payloads, collected as each section builds, for the PDF
    const sections = [this._inventorySection(), this._laborSection(), this._shiftSection(), this._profitSection(), this._revenueSection(), this._cashSection(), this._eventsSection(), this._booksSection()].filter(Boolean).join('');

    mount.innerHTML = '<div class="screen wr-screen">'
      + this._topCard()
      + selectorRow
      + '<div class="wr-grid">' + sections + '</div>'
      + '</div>';

    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => this._step(parseInt(a.dataset.step, 10))));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkStart = this._maxMonday(); this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', () => this._exportPDF());
  },

  _stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); },

  // Data-driven PDF built from the per-section payloads collected during render.
  async _exportPDF() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const m = this._weekMoney();
    const pctv = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    const b = App._pdfBuilder('Week in Review', {});
    b.header({ right: 'Week in Review', meta: range });
    // The same fact on the artefact that leaves the building: a blank Net Sales on paper, with no
    // explanation, is the identical ambiguity the screen had (step 0.6 — the PDF is the second
    // consumer, and it is the one an accountant reads without the app in front of them).
    if (!m.confirmed) b.paragraph('This week was never confirmed, so the sales and cost figures below stayed blank. The section notes show what was logged.', { gray: 70 });
    b.kv('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-');
    b.kv('Prime Cost', pctv(m.prime));
    b.kv('Labor', pctv(m.laborPct));
    // Same three bands as the screen, in the same order. The paper and the page say one thing.
    (this._pdf || []).forEach(s => {
      b.sectionTitle(s.name);
      if (s.activity) b.paragraph('Done this week: ' + s.activity, { gray: 70 });
      b.paragraph('What it turned up: ' + s.results, { gray: 70 });
      b.paragraph('Carrying over: ' + s.open, { gray: 70 });
    });
    /* ⛔ NAME IT FOR THE WEEK IT REVIEWS, NOT THE DAY IT WAS RUN. With no period this fell back
       to today, so three different weeks exported as one filename and each overwrote the last in
       the downloads folder — the same defect the Weekly P&L Brief had (B5). The week is right
       here in _wkS/_wkE. */
    await b.save(App.pdfFileName('Week in Review', this._wkS() + ' to ' + this._wkE()));
  }
  /* ⛔ `showHowTo` IS GONE, AND IT HAD NO CALLER. Hub pages take their help from the topic table in
     `app.js` keyed by the action passed to `openHubFullPage` ([[help-model]]), so the "i" on this
     page has always opened `App._HUB_HELP['week-review']` and never this. It sat here describing
     step ticks and a NOW marker that no longer exist — a stale how-to reads as a spec to the next
     person who opens the file. The live topic is updated in the same edit ([[the-loop]] #61:
     retiring something is three greps, and the help is the one nobody does). */
};
