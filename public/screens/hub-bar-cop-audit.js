'use strict';

/* ── Bar Cop Audit — Hub-level executive weekly operational audit ───────────
   The owner-operator's weekly read on the entire operation. Distinct from
   the three recovery audits (Profit, Revenue, Cash) which answer
   "what's broken, where to fix" with financial outcomes. Bar Cop Audit
   answers a different question: "is the operation being run well, is there
   discipline." Uses Control data and cross-cutting operational metadata,
   not the recovery audit content.

   Six sub-scores, all distinct, all grounded in data the operator already
   logs across Inventory, Labor, and Shift Control plus the fix_log:
     1. Operational Discipline  — daily and weekly procedures completion
     2. Cash Integrity          — variance trend, drawer + safe + auth
     3. Inventory Execution     — count cadence, discrepancy resolution
     4. Labor Hygiene           — schedule adherence, callouts, certs, coaching
     5. Recovery Action         — gaps surfaced vs fixes logged vs dollars pulled
     6. Operational Consistency — week-over-week variance in stable metrics

   One audit a week, same as the three recovery audits. It scores the trailing
   30 days, so the window stays wide enough to read discipline even as it runs
   weekly. It scores as soon as there is anything real to show; each sub-score
   reads N/A until the data behind it exists.

   Single-page audit detail built on the shared AuditUI so it matches the three
   recovery audits. Bar Cop Outlook + Export PDF sit in the Top Operational
   Exposures heading. */

S.HubBarCopAudit = {
  WINDOW_DAYS:           30,   // scoring window for most sub-scores
  CONSISTENCY_WEEKS:     8,    // weeks of history for Operational Consistency
  MIN_DATA_DAYS:         60,   // before this much history exists, empty state
  RETENTION_CAP:         12,   // keep last 12 audits (1 year), match recovery audits
  MIN_SUBS_FOR_OVERALL:  3,    // need this many of 6 sub-scores covered for an honest overall

  // Display names for the six sub-scores, in order. Matches the keys in the
  // audit `sections` map so the shared AuditUI.landingCard renders them as the
  // section-breakdown rows, identical to the three recovery audits.
  SECTION_NAMES: ['Operational Discipline', 'Cash Integrity', 'Inventory Execution', 'Labor Hygiene', 'Recovery Action', 'Operational Consistency'],

  audits() {
    if (!Array.isArray(App.data.bar_cop_audits)) App.data.bar_cop_audits = [];
    return App.data.bar_cop_audits;
  },

  // Cross-system navigation from Bar Cop Audit deep-links. Hands off to
  // S.Hub._enter to load the operator into the correct system sidebar.
  _navTo(screen) {
    if (!screen) return;
    // Permits is a Hub-owned screen (no module prefix), so route it directly
    // rather than letting the prefix fallback treat it as a Profit screen.
    if (screen === 'permits' && window.S && S.HubPermits) { S.HubPermits.open(); return; }
    const mod = screen.startsWith('ic-') ? 'inventory'
              : screen.startsWith('lc-') ? 'labor'
              : screen.startsWith('sc-') ? 'shift'
              : screen.startsWith('r-')  ? 'revenue'
              : screen.startsWith('c-')  ? 'cash'
              : 'profit'; // Profit-domain screens carry no prefix
    if (window.S && S.Hub && S.Hub._enter) S.Hub._enter(screen, mod);
  },

  // ── Public entry ────────────────────────────────────────────────────────
  // Renders into the Hub content area as a full-page screen. The Hub topbar
  // shows "BAR COP AUDIT | Back to Dashboard" mirroring the module shell
  // pattern. Sidebar stays mounted + interactive on the left.
  open() {
    if (App._hubBlocked && App._hubBlocked('bar-cop-audit')) return;   // gated by the Bar Cop Audit area
    App.openHubFullPage('Bar Cop Audit', (mount) => {
      this.container = mount;
      this._viewingId = null;
      this.renderMain();
    }, 'bar-cop-audit');
  },

  // ── Utilities ───────────────────────────────────────────────────────────
  _now() { return new Date(); },
  // (_daysAgo removed 2026-07-27: its only caller was _withinWindow, which now uses
  //  App.windowCutoff. A private day-offset helper sitting unused is how the next window
  //  quietly gets built on the old convention again.)
  /* ⚠ A `days`-day window held days+1. The screen says "over the last 30 days" in its help and its
     component notes, so the window has to be 30. Lower cost than the other nine sites because the
     ratios here are internally consistent — `runDays` is a Set built from the SAME window, so both
     sides of every ratio moved together — but the stated day count was still wrong.
     Compares DATE STRINGS now: `_daysAgo` returned a midnight Date while some records carry a full
     timestamp, so a same-day record's time of day decided whether it was inside the boundary. */
  _withinWindow(dateStr, days) {
    if (!dateStr) return false;
    const ymd = String(dateStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
    // Bounded at BOTH ends (S217). This tested only the floor, so a checklist, count, spot check or
    // drop typed with a future date counted toward the Bar Cop Audit score straight away — and
    // every component here is a completion RATIO, so a phantom row raises the grade.
    return App.inWindow(days)(ymd);
  },
  _daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((this._now() - d) / 86400000);
  },
  _fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  _hasEnoughData() {
    // No hard time lock. The audit can be generated as soon as there is ANYTHING
    // real to show — a scored sub-score, or at least one scorable component (even
    // if its sub-score is N/A for thin coverage), or a surfaced exposure. The
    // scores degrade to N/A honestly; generation is not blocked just because no
    // sub-score cleared the confidence bar yet. (Replaces the old 60-day gate.)
    const subs = [
      this._scoreOperationalDiscipline(), this._scoreCashIntegrity(),
      this._scoreInventoryExecution(), this._scoreLaborHygiene(),
      this._scoreRecoveryAction(), this._scoreOperationalConsistency()
    ];
    if (subs.some(s => s && s.score != null)) return true;
    if (subs.some(s => s && (s.detail || []).some(c => !c.na && c.ratio != null && !isNaN(c.ratio)))) return true;
    return this._topExposures().length > 0;
  },

  // ── Sub-score engines ───────────────────────────────────────────────────
  // Honest scoring rule: a component with no data to judge is marked na (Not
  // enough data) and EXCLUDED from the sub-score — never defaulted to 50. A
  // sub-score with no scorable components returns null (N/A) and drops out of
  // the overall. This replaces the old 0.5/1.0 placeholders that produced a
  // confident score on a barely-used operation.
  MIN_COMPONENTS: 2,   // a sub-score needs this many scorable components to be honest
  _rollup(detail) {
    detail.forEach(c => { c.pct = (c.na || c.ratio == null || isNaN(c.ratio)) ? null : Math.round(c.ratio * 100); });
    const scored = detail.filter(c => !c.na && c.ratio != null && !isNaN(c.ratio));
    // One signal is not enough to claim a confident number (a 100 off a single
    // "audit on time" component is exactly the thin-data lie we kill). Below the
    // minimum, the whole sub-score is N/A.
    const score = scored.length >= this.MIN_COMPONENTS
      ? Math.round((scored.reduce((s, c) => s + c.ratio, 0) / scored.length) * 100)
      : null;
    return { score, detail };
  },

  // 1. Operational Discipline. Daily and weekly procedures actually being
  //    done over the last 30 days. Each component contributes equally to the
  //    sub-score. Operator-honest: missing pieces are visible in the breakdown.
  _scoreOperationalDiscipline() {
    const detail = [];
    const checklists = (App.shiftData?.sc_checklists) || [];
    const shifts     = (App.shiftData?.sc_shifts) || [];
    const counts     = (App.inventoryData?.ic_counts) || [];
    const spotChecks = App.completedSpotChecks();

    // Checklist screens write type 'Opening'/'Closing'; match case-insensitively
    // (also tolerates legacy 'open'/'closing').
    const opens   = checklists.filter(c => (c.type || '').toLowerCase().indexOf('open') === 0 && this._withinWindow(c.date, this.WINDOW_DAYS));
    const closes  = checklists.filter(c => (c.type || '').toLowerCase().indexOf('clos') === 0 && this._withinWindow(c.date, this.WINDOW_DAYS));
    const wkCounts  = counts.filter(c => this._withinWindow(c.date, this.WINDOW_DAYS));
    const wkSpots   = spotChecks.filter(c => this._withinWindow(c.date, this.WINDOW_DAYS));
    const wkShifts  = shifts.filter(s => this._withinWindow(s.date, this.WINDOW_DAYS));

    // Completion procedures are only judged when the operation is active in the
    // window. With nothing logged at all, these are N/A (not a 0% failing grade).
    const active = wkShifts.length > 0 || opens.length > 0 || closes.length > 0 || wkCounts.length > 0 || wkSpots.length > 0;
    // One opening and one closing per DAY THE OPERATION RAN, not per calendar day. The
    // flat /30 assumed a 7-day bar, so a bar open Thu-Sun logging every checklist
    // perfectly (~17 in 30 days) scored 57 and carried a "run only 17 of an expected 30"
    // exposure it could never clear without opening on days it is closed. Same
    // denominator _scoreCashIntegrity already uses for drawer counts.
    const runDays    = new Set(wkShifts.map(s => s.date)).size;
    const openRatio  = runDays > 0 ? Math.min(1, opens.length  / runDays) : null;
    const closeRatio = runDays > 0 ? Math.min(1, closes.length / runDays) : null;
    const runNote    = n => n + ' of ' + runDays + ' day' + (runDays === 1 ? '' : 's') + ' the bar ran';
    const components = [
      { label: 'Opening checklist completion',  ratio: openRatio,  na: !active || openRatio == null,  extra: openRatio == null ? opens.length + ' logged (no shifts in window)'  : runNote(opens.length) },
      { label: 'Closing checklist completion',  ratio: closeRatio, na: !active || closeRatio == null, extra: closeRatio == null ? closes.length + ' logged (no shifts in window)' : runNote(closes.length) },
      { label: 'Inventory counts completed',    ratio: Math.min(1, wkCounts.length / 4),  na: !active, extra: wkCounts.length + ' of 4 expected weekly' },
      { label: 'Spot checks completed',         ratio: Math.min(1, wkSpots.length  / 4),  na: !active, extra: wkSpots.length  + ' of 4 expected weekly' }
      // ('Shifts logged' was REMOVED. It scored sc_shifts RECORDS against a flat 30, but
      //  there is one record per daypart, not per day, and no setting says which days a
      //  bar is open. So a two-daypart bar open Thu-Sun logged 34 records and scored 100,
      //  a one-daypart bar open all week logged 30 and scored 100, and the same Thu-Sun
      //  bar on one daypart logged 17 and scored 57. It rewarded having more dayparts and
      //  punished being closed on Mondays. There is no honest denominator to give it:
      //  sc_shifts is the only record of which days you ran, so scoring it against your
      //  own run days is circular. The checklist, count and spot-check components above
      //  already measure procedure completion against real operating days.)
    ];

    // Recovery-audit cadence. N/A until that audit has been run at least once.
    const recoveryAudits = [
      { name: 'Profit Recovery',  list: App.data?.audits },
      { name: 'Revenue Recovery', list: App.data?.revenue_audits },
      { name: 'Cash Recovery',    list: App.data?.cash_audits }
    ];
    recoveryAudits.forEach(r => {
      const arr = r.list || [];
      const latest = App.latestEvent(arr);
      const since = latest ? this._daysSince(latest.date) : null;
      const onTime = since != null && since <= 12; // weekly rhythm with a few days grace
      components.push({ label: r.name + ' audit on time', ratio: onTime ? 1 : 0, na: arr.length === 0, extra: arr.length === 0 ? 'No audit run yet' : (onTime ? 'Current' : 'Overdue') });
    });

    // Deferred maintenance — open equipment/facility issues aging past a
    // reasonable fix window are a discipline gap (small fixes become failures).
    // N/A until anything is logged; full credit when the backlog is clear.
    const maint = (App.shiftData?.sc_maintenance) || [];
    const openMaint = maint.filter(m => m.status && m.status !== 'Resolved');
    const deferredMaint = openMaint.filter(m => { const d = this._daysSince(m.date_reported); return d != null && d > 14; });
    components.push({
      label: 'Maintenance backlog cleared',
      ratio: openMaint.length === 0 ? 1 : Math.max(0, 1 - (deferredMaint.length / 5)),
      na: maint.length === 0,
      extra: maint.length === 0 ? 'No maintenance logged' : (deferredMaint.length + ' open over 14 days')
    });

    // Pre-shift briefings held. OPT-IN: a bar that never logs one reads N/A here
    // (excluded, no ding); once it starts, it scores briefings against operating days.
    const briefings = (App.shiftData?.sc_briefings) || [];
    const wkBriefings = briefings.filter(b => b.held && this._withinWindow(b.date, this.WINDOW_DAYS));
    const briefDays = new Set(wkShifts.map(s => s.date)).size;
    components.push({
      label: 'Pre-shift briefings held',
      ratio: wkBriefings.length === 0 ? null : (briefDays > 0 ? Math.min(1, wkBriefings.length / briefDays) : 1),
      na: wkBriefings.length === 0,
      extra: wkBriefings.length === 0 ? 'Not used' : (wkBriefings.length + ' held over ' + briefDays + ' operating days')
    });

    return this._rollup(components);
  },

  // 2. Cash Integrity. Variance trend + drawer counts + cash drops. (Comp/void
  // authorization is a POS-native control, not Bar Cop's to score; the per-server
  // sales-pattern read lives in Sales Integrity.)
  _scoreCashIntegrity() {
    const variances = (App.shiftData?.sc_variances)    || [];
    const drops     = (App.shiftData?.sc_cash_drops)   || [];
    const shifts    = (App.shiftData?.sc_shifts)       || [];

    const wkVar     = variances.filter(v => this._withinWindow(v.date, this.WINDOW_DAYS));
    const wkShifts  = shifts.filter(s => this._withinWindow(s.date, this.WINDOW_DAYS));
    // A counted drawer is recorded as a variance record; sc_drawers is the
    // register reference table (no date), so completion reads off the variances.
    const wkDrawers = wkVar;

    // Variance trend: total absolute variance / total revenue handled.
    // Operator-honest: lower is better, capped at 1% as ceiling = 100 score.
    const totalAbsVar = wkVar.reduce((s, v) => s + Math.abs(parseFloat(v.variance) || 0), 0);
    const totalRev    = wkShifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);
    const varPct      = totalRev > 0 ? (totalAbsVar / totalRev) * 100 : 0;
    const varRatio    = Math.max(0, 1 - (varPct / 1)); // 1%+ → 0, 0% → 1

    // Drawer count completion: expected one per operating day (drawers are counted
    // at close, not once per daypart-revenue split, so the denominator is the
    // distinct days the operation ran, not the per-daypart shift records).
    const operatingDays = new Set(wkShifts.map(s => s.date)).size;
    const drawerRatio = operatingDays > 0 ? Math.min(1, wkDrawers.length / operatingDays) : null;

    // Cash drops activity: a drop on each operating day that took real money.
    const cashDays = new Set(wkShifts.filter(s => (parseFloat(s.total_revenue) || 0) > 500).map(s => s.date)).size;
    const wkDrops  = drops.filter(d => this._withinWindow(d.date, this.WINDOW_DAYS));
    const dropRatio = cashDays > 0 ? Math.min(1, wkDrops.length / cashDays) : null;

    const components = [
      { label: 'Cash variance trend (lower is better)', ratio: varRatio,    na: totalRev === 0,         extra: totalRev > 0 ? varPct.toFixed(2) + '% of revenue handled' : 'No revenue logged in window' },
      { label: 'Drawer counts per operating day',       ratio: drawerRatio, na: operatingDays === 0,    extra: wkDrawers.length + ' counts on ' + operatingDays + ' operating days' },
      { label: 'Cash drops on revenue days',            ratio: dropRatio,   na: cashDays === 0,         extra: wkDrops.length + ' drops on ' + cashDays + ' days over $500' }
    ];
    return this._rollup(components);
  },

  // 3. Inventory Execution. Count cadence + discrepancy resolution + variance.
  _scoreInventoryExecution() {
    const counts     = (App.inventoryData?.ic_counts)        || [];
    const spotChecks = App.completedSpotChecks();
    const discrep    = (App.data?.vendor_discrepancies)      || [];

    const wkCounts = counts.filter(c => this._withinWindow(c.date, this.WINDOW_DAYS));
    const wkSpots  = spotChecks.filter(c => this._withinWindow(c.date, this.WINDOW_DAYS));

    // Inventory is judged only when the operator runs inventory at all.
    const invActive = wkCounts.length > 0 || wkSpots.length > 0;
    const countRatio = Math.min(1, wkCounts.length / 4);
    const spotRatio  = Math.min(1, wkSpots.length / 4);

    // Discrepancy resolution rate over the last 90 days. N/A with no discrepancies on file.
    const recentDiscrep = discrep.filter(d => this._withinWindow(d.date, 90));
    const resolved      = recentDiscrep.filter(d => (d.status || '').toLowerCase() === 'resolved');
    const discrepRatio  = recentDiscrep.length === 0 ? null : resolved.length / recentDiscrep.length;

    // Discrepancy aging: open more than 60 days deduct. N/A with no discrepancies at all.
    const aging = discrep.filter(d => (d.status || '').toLowerCase() !== 'resolved' && this._daysSince(d.date) > 60);
    const agingRatio = discrep.length === 0 ? null : (aging.length === 0 ? 1 : Math.max(0, 1 - aging.length / 5));

    // Spot check clean-variance rate. N/A when no spot checks in the window.
    const cleanSpots = wkSpots.filter(s => Math.abs(parseFloat(s.total_variance_dollar) || 0) < 5);
    const spotPassRatio = wkSpots.length === 0 ? null : cleanSpots.length / wkSpots.length;

    const components = [
      { label: 'Inventory counts on schedule',          ratio: countRatio,   na: !invActive,                  extra: wkCounts.length + ' of 4 expected weekly counts' },
      { label: 'Spot checks completed',                 ratio: spotRatio,    na: !invActive,                  extra: wkSpots.length + ' of 4 expected weekly' },
      { label: 'Vendor discrepancy resolution rate',    ratio: discrepRatio, na: recentDiscrep.length === 0,  extra: recentDiscrep.length === 0 ? 'No discrepancies filed' : (resolved.length + ' of ' + recentDiscrep.length + ' resolved in last 90 days') },
      { label: 'No discrepancies aging past 60 days',   ratio: agingRatio,   na: discrep.length === 0,        extra: discrep.length === 0 ? 'No discrepancies filed' : (aging.length + ' open discrepancies aging') },
      { label: 'Spot check clean variance rate',        ratio: spotPassRatio, na: wkSpots.length === 0,       extra: cleanSpots.length + ' of ' + wkSpots.length + ' under $5 variance' }
    ];
    return this._rollup(components);
  },

  // 4. Labor Hygiene. Schedule adherence, callouts, OT, certs, coaching,
  //    wage policy configured (boolean per agent finding — no breach log yet).
  _scoreLaborHygiene() {
    const actuals   = (App.laborData?.lc_actuals)   || [];
    const schedules = (App.laborData?.lc_schedules) || [];
    const callouts  = (App.laborData?.lc_callouts)  || [];
    const certs     = (App.laborData?.lc_certs)     || [];
    const notes     = (App.laborData?.lc_staff_notes) || [];
    const wage      = (App.laborData?.settings)     || {};

    const wkActuals  = actuals.filter(a => this._withinWindow(a.date, this.WINDOW_DAYS));
    const wkCallouts = callouts.filter(c => this._withinWindow(c.date, this.WINDOW_DAYS));
    const wkNotes    = notes.filter(n => this._withinWindow(n.date, 90));

    const laborActive = wkActuals.length > 0;

    // Schedule adherence: actual vs scheduled hours. N/A without both.
    let schedScore = null, schedExtra = 'No logged hours in window';
    if (laborActive) {
      const totalActual = wkActuals.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
      const wkSchedules = schedules.filter(s => this._withinWindow(s.week_start, this.WINDOW_DAYS));
      const totalSched  = wkSchedules.reduce((s, x) => s + (parseFloat(x.total_hours) || 0), 0);
      if (totalSched > 0) {
        const dev = Math.abs(totalActual - totalSched) / totalSched;
        schedScore = Math.max(0, 1 - (dev / 0.10));
        schedExtra = Math.round(totalActual) + ' actual vs ' + Math.round(totalSched) + ' scheduled hours';
      } else { schedExtra = 'No schedule logged to compare against'; }
    }

    // Callout frequency: ideal < 1 per 20 shifts. N/A without logged hours.
    const calloutRate = wkCallouts.length / Math.max(20, wkActuals.length || 1) * 20;
    const calloutScore = laborActive ? Math.max(0, 1 - calloutRate) : null;

    // OT incidents: staff-WEEKS over the threshold. lc_actuals is one row per staff per
    // DAY, so the old per-row `hours > 40` test could never be true (a day has 24 hours)
    // and this component scored a fabricated 100 for every bar, including one running
    // three people at 55 hours every week. Overtime is a weekly threshold, bucketed the
    // same way App.otPremiumForRows does it. Salaried staff are exempt.
    const OT_HRS = App.OT_THRESHOLD || 40;
    const otWeeks = {};
    wkActuals.forEach(a => {
      if (!a || (App.isSalaried && App.isSalaried(a.staff_id))) return;
      const ws = App.weekStartFor ? App.weekStartFor(a.date) : (a.date || '');
      const key = (a.staff_id || a.name || '?') + '|' + ws;
      otWeeks[key] = (otWeeks[key] || 0) + (parseFloat(a.hours) || 0);
    });
    const otCount = Object.keys(otWeeks).filter(k => otWeeks[k] > OT_HRS).length;
    const otScore = laborActive ? Math.max(0, 1 - (otCount / 5)) : null;

    // Certifications. N/A when none are on file.
    const expiring = certs.filter(c => { if (!c.expiration_date) return false; const days = this._daysSince(c.expiration_date) * -1; return days >= 0 && days <= 30; });
    const expired  = certs.filter(c => { if (!c.expiration_date) return false; const days = this._daysSince(c.expiration_date); return days != null && days > 0; });
    const certScore = certs.length === 0 ? null : Math.max(0, 1 - (expiring.length + expired.length * 2) / Math.max(certs.length, 3));

    // Coaching log activity — judged only when there is staff/labor activity.
    const coachingScore = laborActive ? (wkNotes.length > 0 ? 1 : 0) : null;

    // Wage policy configured — a real yes/no, judged when the operator runs labor.
    const policyConfigured = !!(wage.state_min_wage && (wage.state_min_wage > 0));
    const policyScore = laborActive ? (policyConfigured ? 1 : 0) : null;

    const components = [
      { label: 'Schedule adherence',                  ratio: schedScore,    na: schedScore == null,         extra: schedExtra },
      { label: 'Callout frequency',                   ratio: calloutScore,  na: !laborActive,               extra: wkCallouts.length + ' callouts in window' },
      { label: 'Overtime incidents under control',    ratio: otScore,       na: !laborActive,               extra: otCount + ' time' + (otCount === 1 ? '' : 's') + ' someone went over 40 hours in a week' },
      { label: 'Certifications current',              ratio: certScore,     na: certs.length === 0,         extra: certs.length === 0 ? 'No certifications on file' : (expired.length + ' expired, ' + expiring.length + ' expiring in 30 days') },
      { label: 'Coaching log activity',               ratio: coachingScore, na: !laborActive,               extra: wkNotes.length + ' coaching notes in last 90 days' },
      { label: 'Wage policy configured',              ratio: policyScore,   na: !laborActive,               extra: policyConfigured ? 'State minimum wage set in Wage Policies' : 'Wage Policies not configured' }
    ];
    return this._rollup(components);
  },

  // 5. Recovery Action. Did the operator act on what Bar Cop surfaced?
  //    Gaps surfaced across the three recovery audits vs fix_log entries
  //    vs fixes that produced positive dollar movement in the 8-week window.
  _scoreRecoveryAction() {
    const fixLog = (App.data?.fix_log) || [];

    // Gaps surfaced: action_items from the latest audit per recovery section.
    const latestAudits = [
      App.latestEvent(App.data?.audits || []),
      App.latestEvent(App.data?.revenue_audits || []),
      App.latestEvent(App.data?.cash_audits || [])
    ].filter(Boolean);
    const gapIds = new Set();
    latestAudits.forEach(a => {
      (a.action_items || []).forEach(it => { if (it.gap_id) gapIds.add(it.gap_id); });
    });
    const surfaced = gapIds.size;

    // ⚠ Count DISTINCT NON-COMPOSITE GAPS, not raw fix_log ROWS (S169). A batch reprice ("Mark All
    // Live") writes one fix_log row per item but is ONE action on ONE gap (pricing), so counting rows
    // let a single batch read as N fixes and inflate this whole sub-score. And composite gaps
    // (prime-cost) get an AUTO fix_log row (profit-fix._autoStart) yet are NEVER surfaced and are
    // excluded by _gapEntries — so they must be excluded here too, or actRatio (which would include
    // them) and the conversion denominator (measurableCount, from the composite-excluded scored set)
    // would count on different bases, and a composite-only window would show a green "Fixes Logged"
    // tile beside an N/A sub-score.
    // recoveredCount below is already per-gap (S170); these counts were the twin S170 left on rows.
    const composite = (window.Recovery && Recovery.COMPOSITE_GAPS) || [];
    const isRealGap = gid => gid != null && composite.indexOf(gid) === -1;
    const wkGapCount = new Set(
      fixLog.filter(f => this._withinWindow(f.date, this.WINDOW_DAYS) && isRealGap(f.gap_id)).map(f => f.gap_id)
    ).size;

    // The scored gaps to range over: the durable-baseline union of logged fixes, one per gap, composites
    // excluded. Computed ONCE; the loop below derives BOTH the numerator (recovered) and the honest S180
    // denominator (measurable) from it, so they share a basis. _gapEntries(null) stays a single call here.
    const scored = (window.Recovery && typeof Recovery._gapEntries === 'function')
      ? Recovery._gapEntries(null)
      : [...new Set(fixLog.filter(f => isRealGap(f.gap_id)).map(f => f.gap_id))];

    // Split each scored gap's recovery result two ways (S180): measurableCount = fixes that produced a
    // MATURED, real dollar verdict (compute -> status:'ok', dollars != null); recoveredCount = the subset
    // that came out FAVORABLE (dollars > 0). A gap Bar Cop has no weekly dollar metric for (theft, vendor,
    // menu-engineering, server, events, the cash levers) returns 'untracked'; a noDollar ratio metric
    // (pricing, rplh) returns dollars:null; a too-recent fix returns 'building'. None of those can EVER be
    // recovered, so they must NOT sit in the conversion denominator — counting them scored the operator a
    // harsh 0 for working exactly the gaps we cannot dollarize. Guarded on _gapEntries too: `scored` holds
    // compute-able entry objects only when it came from _gapEntries.
    let recoveredCount = 0, measurableCount = 0;
    if (window.Recovery && typeof Recovery.compute === 'function' && typeof Recovery._gapEntries === 'function') {
      scored.forEach(f => {
        try {
          const r = Recovery.compute(f);
          if (r.status === 'ok' && r.dollars != null) {
            measurableCount++;                    // a real dollar outcome, favorable or not
            if (r.dollars > 0) recoveredCount++;  // and it moved the needle up
          }
        } catch (e) {}
      });
    }

    // With no non-composite fix in the (24-month) window there is no recovery activity to judge yet,
    // so the whole sub-score is N/A — never a harsh "0, you are not acting". Windowed on fix_log (NOT
    // the durable scored set, which never ages out — that flip broke the N/A for a long-dormant
    // operation) and non-composite (so the auto prime-cost row alone is not counted as activity, which
    // would leave the tile at 0 beside a scored sub-score).
    const noFixes = fixLog.filter(f => isRealGap(f.gap_id)).length === 0;
    // Nothing dollar-measurable among the fixes (only untracked / noDollar / still-building) -> N/A,
    // never a 0. A theft or vendor fix is real work Bar Cop just cannot put a weekly dollar figure on.
    const noMeasurable = measurableCount === 0;

    // Component 1: act-on-gaps. N/A until an audit has surfaced something AND at least one gap fixed.
    const actRatio = (surfaced === 0 || noFixes) ? null : Math.min(1, wkGapCount / surfaced);

    // Component 2: of the fixes we can measure in dollars, how many produced favorable movement (S180).
    const convRatio = (noFixes || noMeasurable) ? null : Math.min(1, recoveredCount / measurableCount);

    const components = [
      { label: 'Acting on surfaced gaps',                ratio: actRatio,  na: surfaced === 0 || noFixes, extra: noFixes ? 'No recovery activity yet' : (surfaced === 0 ? 'No audit has surfaced gaps yet' : (wkGapCount + ' gap' + (wkGapCount === 1 ? '' : 's') + ' acted on in the last 30 days against ' + surfaced + ' surfaced')) },
      { label: 'Fixes that produced movement',           ratio: convRatio, na: noFixes || noMeasurable,   extra: noFixes ? 'No fixes logged yet' : (noMeasurable ? 'No dollar-measurable fixes yet' : (recoveredCount + ' of ' + measurableCount + ' measurable fix' + (measurableCount === 1 ? '' : 'es') + ' produced favorable movement')) }
    ];
    return this._rollup(components);
  },

  // 6. Operational Consistency. Week-over-week variance in stable metrics
  //    over last 8 weeks. Low variance = disciplined operation.
  _scoreOperationalConsistency() {
    // Sort oldest->newest FIRST: App.data.weeks arrives NEWEST-first (loadEvents orders
    // date DESC), so an unsorted slice(-8) scored the OLDEST 8 weeks on file and never
    // moved as new weeks were confirmed. Same guard the server-side audit already runs
    // (see the note in audit-compute.js). filter() copies, so sort() cannot mutate
    // App.data here.
    const byEnd = (a, b) => String(a.period_end || '').localeCompare(String(b.period_end || ''));
    const weeks = (App.data?.weeks || []).filter(w => w && w.period_end).sort(byEnd).slice(-this.CONSISTENCY_WEEKS);
    const revWeeks = (App.data?.revenue_weeks || []).filter(w => w && w.period_end).sort(byEnd).slice(-this.CONSISTENCY_WEEKS);

    // Coefficient of variation: stddev / mean. Lower = more consistent.
    // 0% CV = perfect, 15%+ CV = 0.
    // Needs at least 3 weeks to mean anything; otherwise N/A (no 0.5 placeholder).
    const cvScore = (values) => {
      const v = values.filter(x => x != null && !isNaN(x));
      if (v.length < 3) return null;
      const mean = v.reduce((s, x) => s + x, 0) / v.length;
      if (mean === 0) return null;
      const variance = v.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / v.length;
      const cv = Math.sqrt(variance) / Math.abs(mean);
      return Math.max(0, 1 - (cv / 0.15));
    };
    // No `|| 0`: a week confirmed before the covers were in stores null, and cvScore
    // drops it. Read as a zero-cover week it would read as wild swing and score the
    // bar 0 for inconsistency it never had.
    const coversCV = cvScore(revWeeks.map(w => parseFloat(w.covers)));
    // Catering has to be on BOTH sides or neither. Counting catering labor against
    // bar+food revenue alone swung this metric purely on catering timing, so a bar
    // whose labor discipline never moved scored 0 for inconsistency.
    const laborPctCV = cvScore(weeks.map(w => {
      const rev = (parseFloat(w.bar?.revenue) || 0) + (parseFloat(w.food?.revenue) || 0) + (parseFloat(w.catering?.revenue) || 0);
      const lab = (parseFloat(w.bar?.labor) || 0) + (parseFloat(w.food?.labor) || 0) + (parseFloat(w.catering?.labor) || 0);
      return rev > 0 ? (lab / rev) * 100 : null;
    }));
    const pourCostCV = cvScore(weeks.map(w => parseFloat(w.bar?.cost_pct)));

    const components = [
      { label: 'Weekly covers consistency',         ratio: coversCV,   na: coversCV == null,   extra: revWeeks.length + ' weeks of revenue data (need 3+)' },
      { label: 'Weekly labor % consistency',        ratio: laborPctCV, na: laborPctCV == null, extra: weeks.length + ' weeks of P&L data (need 3+)' },
      { label: 'Weekly pour cost % consistency',    ratio: pourCostCV, na: pourCostCV == null, extra: weeks.length + ' weeks of P&L data (need 3+)' }
    ];
    return this._rollup(components);
  },

  // ── Top Operational Exposures ───────────────────────────────────────────
  // Cross-system action-ready items. Returns an array of { label, detail,
  // severity ('critical'|'warn'|'info'), gap_id (optional), screen (optional) }.
  _topExposures() {
    const out = [];
    const discrep = (App.data?.vendor_discrepancies) || [];
    const certs   = (App.laborData?.lc_certs)        || [];
    const variances = (App.shiftData?.sc_variances)  || [];
    const checklists = (App.shiftData?.sc_checklists) || [];
    const permits   = (App.data?.permits_compliance) || [];
    const maint     = (App.shiftData?.sc_maintenance) || [];
    const shifts    = (App.shiftData?.sc_shifts)      || [];

    // Deferred maintenance — high-priority open items are real exposure (a
    // failing walk-in or ice machine is lost product plus an emergency bill),
    // and items aging open are deferred fixes turning into failures.
    const openMaint    = maint.filter(m => m.status && m.status !== 'Resolved');
    const highMaint    = openMaint.filter(m => ['high', 'urgent', 'critical'].indexOf((m.priority || '').toLowerCase()) !== -1);
    const agingMaint   = openMaint.filter(m => { const d = this._daysSince(m.date_reported); return d != null && d > 21; });
    if (highMaint.length) {
      out.push({
        label:    highMaint.length + ' high-priority maintenance item' + (highMaint.length === 1 ? '' : 's') + ' open',
        detail:   'Equipment flagged urgent and still unresolved. A failing walk-in or ice machine is lost product and an emergency repair bill. Close these first.',
        severity: 'critical',
        screen:   'sc-maintenance'
      });
    } else if (agingMaint.length) {
      out.push({
        label:    agingMaint.length + ' maintenance item' + (agingMaint.length === 1 ? '' : 's') + ' open over 21 days',
        detail:   'Deferred maintenance turns small fixes into equipment failures. Schedule or escalate them.',
        severity: 'warn',
        screen:   'sc-maintenance'
      });
    }

    // Aging vendor discrepancies (open + over 60 days).
    const aging = discrep.filter(d => (d.status || '').toLowerCase() !== 'resolved' && this._daysSince(d.date) > 60);
    if (aging.length) {
      const totalClaimed = aging.reduce((s, d) => s + (parseFloat(d.overcharge || d.claimed_amount) || 0), 0);
      const totalRecovered = aging.reduce((s, d) => s + (parseFloat(d.recovered_amount || d.credited_amount) || 0), 0);
      out.push({
        label:    aging.length + ' vendor discrepancies open past 60 days',
        detail:   '$' + Math.round(totalClaimed).toLocaleString() + ' claimed'
                  + (totalRecovered > 0 ? ', $' + Math.round(totalRecovered).toLocaleString() + ' recovered so far' : ' still unresolved')
                  + '. Push the vendor or write it off.',
        severity: 'critical',
        screen:   'vendor-discrepancy'
      });
    }

    // Certifications already expired, or expiring in the next 30 days.
    const certFlags = certs.filter(c => c.expiration_date && (this._daysSince(c.expiration_date) * -1) <= 30);
    certFlags.forEach(c => {
      const left = this._daysSince(c.expiration_date) * -1;   // <0 already expired, >0 days left
      const expired = left < 0;
      const n = Math.abs(left);
      out.push({
        label:    (c.cert_type || c.cert_name || c.name || 'Certification') + (expired ? ' expired ' + n + ' day' + (n === 1 ? '' : 's') + ' ago' : ' expiring in ' + n + ' day' + (n === 1 ? '' : 's')),
        detail:   (c.staff_name ? 'For ' + c.staff_name + '. ' : '') + (expired ? 'Out of compliance now. Renew before this person works again.' : 'Renew before lapse to stay compliant.'),
        severity: (expired || left <= 7) ? 'critical' : 'warn',
        screen:   'lc-staff-roster'
      });
    });

    // Permits and compliance items already expired, or due in the next 30 days.
    const permitFlags = permits.filter(p => p.renewal_date && (this._daysSince(p.renewal_date) * -1) <= 30);
    permitFlags.forEach(p => {
      const left = this._daysSince(p.renewal_date) * -1;
      const expired = left < 0;
      const n = Math.abs(left);
      out.push({
        label:    (p.name || 'Permit') + (expired ? ' expired ' + n + ' day' + (n === 1 ? '' : 's') + ' ago' : ' renewal in ' + n + ' day' + (n === 1 ? '' : 's')),
        detail:   (p.type ? p.type + '. ' : '') + (p.cost ? 'Last cost $' + p.cost + '. ' : '') + (expired ? 'Out of compliance. Renew now.' : 'Operation-level compliance item.'),
        severity: (expired || left <= 14) ? 'critical' : 'warn',
        screen:   'permits'
      });
    });

    // Cash variance over $20 on N+ shifts in last 30 days.
    const wkVar = variances.filter(v => this._withinWindow(v.date, 30));
    const bigVar = wkVar.filter(v => Math.abs(parseFloat(v.variance) || 0) > 20);
    if (bigVar.length >= 3) {
      out.push({
        label:    bigVar.length + ' cash variances over $20 in last 30 days',
        detail:   'Pattern suggests a drawer or close-out process gap. Review who counted and when.',
        severity: 'warn',
        screen:   'sc-cash-control'
      });
    }

    // Skipped procedures: opening or closing checklist completion rate below 70%.
    // Measured against the days the bar actually RAN, not 30 flat calendar days. The
    // old 20-of-30 test assumed a 7-day operation, so a Thu-Sun bar running every
    // checklist it should carried both of these warnings permanently with no way to
    // clear them short of opening on days it is closed.
    const wkOpens   = checklists.filter(c => (c.type || '').toLowerCase().indexOf('open') === 0 && this._withinWindow(c.date, 30));
    const wkCloses  = checklists.filter(c => (c.type || '').toLowerCase().indexOf('clos') === 0 && this._withinWindow(c.date, 30));
    const runDays30 = new Set(shifts.filter(s => this._withinWindow(s.date, 30)).map(s => s.date)).size;
    const ranNote   = 'of the ' + runDays30 + ' day' + (runDays30 === 1 ? '' : 's') + ' you were open';
    const openRate  = runDays30 > 0 ? wkOpens.length  / runDays30 : null;
    const closeRate = runDays30 > 0 ? wkCloses.length / runDays30 : null;
    if (openRate != null && openRate < 0.7) {
      out.push({
        label:    'Opening checklist run ' + wkOpens.length + ' times ' + ranNote,
        detail:   'That is ' + Math.round(openRate * 100) + '% of your open days. Day starts without the opening sweep can mean missed restock or setup issues.',
        severity: 'warn',
        screen:   'sc-checklists'
      });
    }
    if (closeRate != null && closeRate < 0.7) {
      out.push({
        label:    'Closing checklist run ' + wkCloses.length + ' times ' + ranNote,
        detail:   'That is ' + Math.round(closeRate * 100) + '% of your open days. Missed closes invite cash-handling and clean-up gaps.',
        severity: 'warn',
        screen:   'sc-checklists'
      });
    }

    // Recovery audits overdue (35+ days since latest).
    [
      { name: 'Profit Recovery',  list: App.data?.audits,         screen: 'audit-tracker' },
      { name: 'Revenue Recovery', list: App.data?.revenue_audits, screen: 'r-audit' },
      { name: 'Cash Recovery',    list: App.data?.cash_audits,    screen: 'c-audit' }
    ].forEach(r => {
      const arr = r.list || [];
      const latest = App.latestEvent(arr);
      const since = latest ? this._daysSince(latest.date) : null;
      if (since == null) {
        out.push({
          label:    r.name + ' audit never run',
          detail:   'Run the first audit to start scoring this section.',
          severity: 'warn',
          screen:   r.screen
        });
      } else if (since > 14) {
        out.push({
          label:    r.name + ' audit overdue (' + since + ' days)',
          detail:   'Last run on ' + this._fmtDate(latest.date) + '. The weekly rhythm keeps the trend honest.',
          severity: since > 60 ? 'critical' : 'warn',
          screen:   r.screen
        });
      }
    });

    // Sort: critical first, then warn, then info.
    const rank = s => s === 'critical' ? 0 : s === 'warn' ? 1 : 2;
    out.sort((a, b) => rank(a.severity) - rank(b.severity));
    return out.slice(0, 12);
  },

  // ── Recurring Patterns (rules-based persistent operational memory) ──────
  // Hardcoded rules. No machine learning, no clustering. Reliability and
  // explainability are the value here. Easy to add more rules later.
  _recurringPatterns() {
    const out = [];
    const variances  = (App.shiftData?.sc_variances)    || [];
    // (sc_void_comps is no longer read here — Rule 2 was its only consumer. See the note below.)
    const actuals    = (App.laborData?.lc_actuals)      || [];
    const discrep    = (App.data?.vendor_discrepancies) || [];
    const counts     = (App.inventoryData?.ic_counts)   || [];
    const notes      = (App.laborData?.lc_staff_notes)  || [];

    const since90 = (dateStr) => this._withinWindow(dateStr, 90);

    // Rule 1: same staff plus recurring cash variance (3+ OUT-OF-TOLERANCE in 90
    // days). Counting the drawer nightly is good discipline, not a red flag, so
    // only over/short events outside tolerance count here, never within-tolerance
    // counts.
    const wkVar = variances.filter(v => since90(v.date)
      && (v.status === 'Short' || v.status === 'Over'
          || Math.abs(parseFloat(v.variance) || 0) > (parseFloat(v.tolerance) || 10)));
    const byManager = {};
    wkVar.forEach(v => {
      const id = v.cashier_id || v.cashier || 'unknown';
      if (!byManager[id]) byManager[id] = [];
      byManager[id].push(v);
    });
    Object.keys(byManager).forEach(id => {
      const list = byManager[id];
      if (list.length >= 3 && id !== 'unknown') {
        const name = list[0].cashier || id;
        out.push({
          label: 'Recurring cash variance: ' + name,
          detail: list.length + ' variance events in last 90 days. Coach or rotate the close.',
          screen: 'sc-cash-control'
        });
      }
    });

    // (Rule 2, "Void/comp concentration on <shift>", was REMOVED — the same call as Rule 4 below,
    // and for a stronger reason. It bucketed void/comps by `v.shift_type || 'unknown'` and fired at
    // >= 10 in 90 days, guarded by `t !== 'unknown'`. The voids/comps import has NO shift column in
    // its field map (pos-ingest.js: date, amount, type, item, server, reason), so pos-ingest writes
    // shift_type: '' unconditionally and every LIVE record buckets to 'unknown'. Only the demo seed
    // writes real shift types, so the rule fired on sample data and never once on a real bar.
    // ⭐ THE DECIDING REASON IS NOT THE MISSING COLUMN — it is that the test was a RAW COUNT WITH
    // NO DENOMINATOR. The busiest daypart always carries the most voids and comps because it
    // carries the most transactions, so even a fully working version would fire on Friday night for
    // essentially every bar: exactly the noise Rule 4 was removed for.
    // AN HONEST REBUILD NEEDS BOTH a real shift dimension (a mapped column, or a daypart derived
    // from a timestamp through service periods) AND a per-shift denominator to normalise against.
    // Do not re-add a bare counter. Nothing was lost here: Rule 1 above is the strong theft signal
    // (recurring cash variance by PERSON), and Loss Prevention owns per-server void/comp analysis
    // on its own 90-day window.
    // ⚠ `shift_type` is deliberately LEFT on the void/comp record. It is written as '' and read by
    // nothing now; removing a stored field is a migration, and the dead field costs nothing.

    // (Chronic per-product shrinkage is not a pattern rule here: variance is not
    // stored on a count item, it is computed by the Variance Report. The Loss
    // Prevention screen owns per-product shrinkage; surfacing it here would mean
    // re-deriving theoretical usage, so it lives there, not in this rule set.)

    // (Rule 4, "Recurring labor overage on <day>", was REMOVED. It tested lc_actuals for
    // hours > 40 on a single row, but that is one staff member on one DAY, so it could
    // never be true and the rule never fired once. There is no honest rebuild: overtime
    // is a weekly threshold (Labor Hygiene scores it, and Overtime Watch owns it), and a
    // per-DAY labor overage needs a per-day labor budget this app does not track. The
    // only version buildable from what is stored is "the day of week with the worst labor
    // percent", which is the slowest day for every bar every week: noise, not a finding.)

    // Rule 5: same vendor plus repeated discrepancies
    const wkDiscrep = discrep.filter(d => since90(d.date));
    const byVendor = {};
    wkDiscrep.forEach(d => {
      const vid = d.vendor_id || d.vendor_name || d.vendor;
      if (!vid) return;
      if (!byVendor[vid]) byVendor[vid] = { count: 0, name: d.vendor_name || d.vendor || vid };
      byVendor[vid].count++;
    });
    Object.keys(byVendor).forEach(vid => {
      if (byVendor[vid].count >= 3) {
        out.push({
          label: 'Repeated discrepancies: ' + byVendor[vid].name,
          detail: byVendor[vid].count + ' separate discrepancies filed in last 90 days. Vendor relationship needs a conversation.',
          screen: 'vendor-discrepancy'
        });
      }
    });

    // Rule 6: staff with negative-review themes but no coaching note
    // Cross-section: reviews mentioning a staff name + lc_staff_notes empty
    // for that staff in the last 90 days. Operator-honest v1: just count
    // review_replies where action_taken contains a staff name and no recent
    // matching coaching note. Requires fuzzy match in production; defer to
    // a future iteration when sample data exists to tune against.
    // (No-op for v1 to avoid false positives.)

    return out;
  },

  // ── Recovery Activity Snapshot ──────────────────────────────────────────
  _recoveryActivitySnapshot() {
    const result = { gaps: 0, fixesLogged: 0, dollarsRecovered: 0, stillMeasuring: 0 };
    const latestAudits = [
      App.latestEvent(App.data?.audits || []),
      App.latestEvent(App.data?.revenue_audits || []),
      App.latestEvent(App.data?.cash_audits || [])
    ].filter(Boolean);
    const gapIds = new Set();
    latestAudits.forEach(a => {
      (a.action_items || []).forEach(it => { if (it.gap_id) gapIds.add(it.gap_id); });
    });
    result.gaps = gapIds.size;

    const fixLog = (App.data?.fix_log) || [];
    // Distinct NON-COMPOSITE gaps with a fix in the window, not raw rows (S169) — a batch reprice is
    // one action on one gap, and the auto prime-cost composite row is excluded (as _gapEntries and the
    // sub-score do), so this tile agrees with the Recovery Action sub-score instead of standing at a
    // count beside its N/A. Matches _scoreRecoveryAction's wkGapCount exactly.
    const _comp = (window.Recovery && Recovery.COMPOSITE_GAPS) || [];
    result.fixesLogged = new Set(fixLog.filter(f => this._withinWindow(f.date, this.WINDOW_DAYS) && f.gap_id != null && _comp.indexOf(f.gap_id) === -1).map(f => f.gap_id)).size;

    if (window.Recovery && typeof Recovery.total === 'function') {
      try {
        const t = Recovery.total();
        result.dollarsRecovered = Math.round(t.dollars || 0);
      } catch (e) {}
    }
    if (window.Recovery && typeof Recovery.compute === 'function') {
      // 'building' is the real mid-measurement status compute() returns; there is
      // no 'pending', so this counter was always 0. Source from _gapEntries (durable-baseline
      // union), matching the dollar total and the recoveredCount above (S170).
      const scored = (typeof Recovery._gapEntries === 'function')
        ? Recovery._gapEntries(null)
        : fixLog.filter(f => (Recovery.COMPOSITE_GAPS || []).indexOf(f.gap_id) === -1);
      scored.forEach(f => {
        try {
          const r = Recovery.compute(f);
          if (r.status === 'building') result.stillMeasuring++;
        } catch (e) {}
      });
    }
    return result;
  },

  // ── Compute a full audit snapshot ───────────────────────────────────────
  _computeAuditSnapshot() {
    const disc   = this._scoreOperationalDiscipline();
    const cash   = this._scoreCashIntegrity();
    const inv    = this._scoreInventoryExecution();
    const labor  = this._scoreLaborHygiene();
    const rec    = this._scoreRecoveryAction();
    const cons   = this._scoreOperationalConsistency();
    const subs   = [disc.score, cash.score, inv.score, labor.score, rec.score, cons.score];
    // Average only the sub-scores that actually have data. A score is honest
    // about how much of the operation it could see (sub_scores_covered of 6).
    // An overall off one or two thin signals says almost nothing, so it needs at
    // least MIN_SUBS_FOR_OVERALL of 6 covered; below that the overall is N/A.
    const scored = subs.filter(x => x != null && !isNaN(x));
    const overall = scored.length >= this.MIN_SUBS_FOR_OVERALL
      ? Math.round(scored.reduce((s, x) => s + x, 0) / scored.length)
      : null;

    const now = new Date();
    const serial = String(Math.floor(Math.random() * 9000) + 1000);
    return {
      id:          App.uid ? App.uid() : ('bca-' + Date.now()),
      // Business date is the LOCAL calendar day (matches every other audit + the
      // event-store index); a full UTC ISO here read a day ahead in the evening.
      date:        App.todayLocal(),
      generated_at: now.toISOString(),
      audit_id:    'BCA-' + now.getFullYear() + '-' + serial,
      audit_period: 'Last 30 days',
      grade:       'Complete Operational Analysis',
      bar_name:    (App.data?.settings?.bar_name) || 'Your Operation',
      overall_score: overall,
      TARGET_SCORE: 70,
      sub_scores_covered: scored.length,
      sub_scores: {
        operational_discipline:   disc.score,
        cash_integrity:           cash.score,
        inventory_execution:      inv.score,
        labor_hygiene:            labor.score,
        recovery_action:          rec.score,
        operational_consistency:  cons.score
      },
      sub_score_detail: {
        operational_discipline:   disc.detail,
        cash_integrity:           cash.detail,
        inventory_execution:      inv.detail,
        labor_hygiene:            labor.detail,
        recovery_action:          rec.detail,
        operational_consistency:  cons.detail
      },
      exposures:        this._topExposures(),
      patterns:         this._recurringPatterns(),
      recovery_snapshot: this._recoveryActivitySnapshot(),
      // Mirror the recovery audit shape so AuditOutlook can reuse the same
      // helper without special-casing Bar Cop Audit.
      // Only covered sub-scores become sections, so the Data Quality badge reads
      // true coverage (all-null must read Limited, not Full). sub_scores above keeps
      // all six keys so the N/A rings still render.
      sections: (function () {
        const s = {};
        [['Operational Discipline', disc.score], ['Cash Integrity', cash.score], ['Inventory Execution', inv.score],
         ['Labor Hygiene', labor.score], ['Recovery Action', rec.score], ['Operational Consistency', cons.score]]
          .forEach(([k, v]) => { if (v != null) s[k] = v; });
        return s;
      })(),
      action_items: this._topExposures().map(e => ({
        action: e.label + '. ' + e.detail,
        gap_id: e.gap_id || null,
        monthly_impact: 0
      }))
    };
  },

  // ── Generate flow ───────────────────────────────────────────────────────
  async _generate() {
    // There is a hard floor below the readiness warning: with literally nothing
    // logged there is nothing to score, so say so rather than fail silently.
    if (!this._hasEnoughData()) {
      const st = document.getElementById('bca-gen-status');
      if (st) { st.style.display = 'block'; st.style.color = 'var(--red)'; st.textContent = 'No data to score yet. Log a week of Inventory, Shift, or Labor Control first.'; }
      return;
    }
    // Row-per-record in core_events now; full executive-audit history is kept
    // (the 12-audit blob cap is gone) and paged via "Show older" on the list.
    const snapshot = this._computeAuditSnapshot();
    App.dedupeAuditToday(App.data.bar_cop_audits, snapshot);
    const ok = await App.putRecord('core', 'bar_cop_audit', snapshot);
    if (ok) {
      this._viewingId = snapshot.id;
      this._renderDetail(snapshot);
    }
  },

  // ── Render: landing ─────────────────────────────────────────────────────
  // Uses the shared AuditUI helpers so the Bar Cop Audit landing is identical to
  // the Profit / Revenue / Cash audits: request card, merged Latest-Audit card
  // with the six sub-scores as the section rows, the 12-month score-history bars,
  // and the Audit History data-card. This audit reads from logged data (no upload),
  // so the request card shows only a countdown when locked, and the history hides
  // the Data Quality (upload tier) column.
  // The data slices the Bar Cop Audit reads across the whole operation, one per
  // sub-score. Each auto-checks off once Bar Cop has it, or taps through to the
  // step that fills it.
  _readinessSteps() {
    const pAud = ((App.data && App.data.audits) || []).length >= 1;
    const rAud = ((App.data && App.data.revenue_audits) || []).length >= 1;
    const _spanDays = arr => {
      const ds = (arr || []).map(r => r && (r.date || r.week_start)).filter(Boolean).sort();
      return ds.length ? (new Date(ds[ds.length - 1] + 'T00:00:00') - new Date(ds[0] + 'T00:00:00')) / 86400000 : 0;
    };
    const invDone   = (((App.inventoryData && App.inventoryData.ic_counts) || []).length) >= 2;
    const laborDone = _spanDays((App.laborData && App.laborData.lc_actuals) || []) >= 13;
    const shiftDone = _spanDays((App.shiftData && App.shiftData.sc_shifts) || []) >= 13;
    return [
      { label: 'Two inventory counts taken',  done: invDone,   go: 'ic-take-inventory' },
      { label: 'Two weeks of labor hours logged', done: laborDone, go: 'lc-log-hours' },
      { label: 'Two weeks of POS sales imported', done: shiftDone, go: 'week-close' },
      { label: 'Profit Audit run',            done: pAud,      go: 'audit-tracker' },
      { label: 'Revenue Audit run',           done: rAud,      go: 'r-audit' }
    ];
  },

  onGenerate() { this._generate(); },

  // One boolean per sub-score = whether it has enough data to score now. Drives
  // the projected data badge so it matches what a run would produce.
  _sectionsReady() {
    return [
      this._scoreOperationalDiscipline(), this._scoreCashIntegrity(),
      this._scoreInventoryExecution(), this._scoreLaborHygiene(),
      this._scoreRecoveryAction(), this._scoreOperationalConsistency()
    ].map(s => !!(s && s.score != null));
  },

  renderMain() {
    const audits = this.audits().slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const latest = audits[0] || null;

    const desc = 'Bar Cop scores how disciplined your whole operation runs off your own logged data. Reads your trailing 30 days. Run it whenever you want a fresh read.';

    this.container.innerHTML = '<div class="screen">'
      + AuditUI.readinessCard({ pfx: 'bca', title: 'Bar Cop Audit', desc,
          steps: this._readinessSteps(), sectionsReady: this._sectionsReady(), hasLatest: !!latest })
      + (latest ? AuditUI.landingCard(latest, audits[1], this.SECTION_NAMES, 'bca') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'bar_cop_audit', 'bca', { sectionCount: this.SECTION_NAMES.length }) : '')
      + '</div>';

    // Landing has no screen-specific topbar actions.
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    document.getElementById('bca-gen-btn')?.addEventListener('click', () => this.onGenerate());
    AuditUI.wireFirstAudit(this.container);
    this.container.querySelectorAll('.bca-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this._viewAuditByIdx(parseInt(btn.dataset.idx, 10)));
    });
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  _viewAuditByIdx(idx) {
    const sorted = this.audits().slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const audit = sorted[idx];
    if (audit) this._renderDetail(audit);
  },

  // ── Render: single audit detail (single-page layout) ────────────────────
  // Per-sub-score 3-part findings (NARRATIVE / FINDING / TOOL), the same
  // structure and tight operator voice as the Profit, Revenue, and Cash audits,
  // so all four read the same. Built off the sub-score and its component checks.
  _SUB_VOICE: {
    operational_discipline:  { area: 'opening and closing discipline', screen: 'Checklists',      good: 'The floor is running the sweeps.',                 bad: 'Shifts are starting and closing without the checklist.', fix: 'Run the opening and closing sweeps every shift and log them in Checklists.' },
    cash_integrity:          { area: 'cash handling',                  screen: 'Cash Control',     good: 'The drawer is tight and the variances are small.', bad: 'The cash path has a gap, variances or missed counts.',   fix: 'Count every drawer and log the drops in Cash Control.' },
    inventory_execution:     { area: 'inventory execution',            screen: 'Inventory',        good: 'Counts and spot checks are on schedule.',          bad: 'Counts and spot checks are falling behind.',             fix: 'Hold the weekly count and spot-check rhythm in Inventory.' },
    labor_hygiene:           { area: 'labor hygiene',                  screen: 'Build Schedule',   good: 'The schedule is holding and the certs are current.', bad: 'Callouts, overtime, or lapsed certs are showing.',      fix: 'Schedule to the forecast and keep certs current in Build Schedule and Staff Roster.' },
    recovery_action:         { area: 'recovery follow-through',        screen: 'the Fix systems',  good: 'You are working your gaps and they are moving.',    bad: 'Surfaced gaps are sitting without a fix logged.',       fix: 'Work your open gaps in the Fix systems and log what you do.' },
    operational_consistency: { area: 'week-to-week consistency',       screen: 'Close The Week',    good: 'Your covers, labor, and pour cost hold week to week.', bad: 'Your weekly numbers are swinging.',                  fix: 'Keep closing every week so the numbers steady and the trend can read.' }
  },
  _subFindings(key, score, detail) {
    if (score == null) return {};
    const v = this._SUB_VOICE[key] || { area: 'this area', screen: 'Bar Cop', good: '', bad: '', fix: '' };
    const scored = (detail || []).filter(c => !(c.na || c.pct == null));
    const full = scored.filter(c => c.pct >= 100).length;
    const weak = scored.filter(c => c.pct < 100).sort((a, b) => a.pct - b.pct).slice(0, 2);
    const strong = score >= 70;
    return {
      narrative: strong ? `Your ${v.area} is holding at ${score}. ${v.good}` : `Your ${v.area} is running ${score}. ${v.bad}`,
      finding: scored.length
        ? (full ? `${full} of ${scored.length} checks are at full marks. ` : '')
          + (weak.length ? `The soft spots are ${weak.map(c => c.label.toLowerCase() + ' (' + c.pct + ')').join(' and ')}.` : 'Every check in this section is at full marks.')
        : '',
      tool: strong ? `Hold it. Keep it logged in ${v.screen}.` : v.fix
    };
  },

  _renderDetail(audit) {
    this._viewingId = audit.id;
    const overallNA = audit.overall_score == null;

    const SUB_NAMES = [
      ['operational_discipline',  'Operational Discipline'],
      ['cash_integrity',          'Cash Integrity'],
      ['inventory_execution',     'Inventory Execution'],
      ['labor_hygiene',           'Labor Hygiene'],
      ['recovery_action',         'Recovery Action'],
      ['operational_consistency', 'Operational Consistency']
    ];

    const subBlock = (key, name, num) => {
      const raw = audit.sub_scores && audit.sub_scores[key];
      const isNA = raw == null;
      const sc = isNA ? null : raw;
      const col = isNA ? 'var(--t3)' : App.scoreColor(sc);
      const detail = (audit.sub_score_detail && audit.sub_score_detail[key]) || [];
      const breakdown = AuditUI.metricRows(detail.map(c => {
        const naC = c.na || c.pct == null;
        return { label: c.label, extra: c.extra, value: naC ? 'N/A' : String(c.pct), valColor: naC ? 'var(--t3)' : App.scoreColor(c.pct) };
      }));
      // 3-part findings (narrative / finding / tool), same as the other three audits.
      const fp = isNA ? {} : this._subFindings(key, sc, detail);
      const findLines = [fp.narrative, fp.finding, fp.tool].filter(Boolean);
      const scoreBlock = isNA
        ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:16px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:3px;">Not enough data</div></div>'
        : AuditUI.scoreRing(sc);
      const divider = '<div style="border-top:1px solid var(--b2);margin:14px 0;"></div>';
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
        +     '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
        +   scoreBlock
        + '</div>'
        + (breakdown ? divider + breakdown : '')
        + (findLines.length ? divider + AuditUI.findingsBlock(findLines) : '')
        + '</div>';
    };

    const subCards = SUB_NAMES.map(([k, n], i) => subBlock(k, n, i + 1)).join('');

    // Top Operational Exposures section
    const exposures = audit.exposures || [];
    const exposureRows = exposures.length
      ? exposures.map(e => {
          const dot = e.severity === 'critical' ? 'var(--red)' : e.severity === 'warn' ? 'var(--amber)' : 'var(--steel)';
          const navBtn = e.screen
            ? '<button class="btn btn-ghost btn-sm bca-nav" data-screen="' + esc(e.screen) + '" style="flex-shrink:0;font-size:10px;padding:5px 10px;">Open</button>'
            : '';
          return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:flex-start;">'
            + '<div style="width:8px;height:8px;border-radius:50%;background:' + dot + ';flex-shrink:0;margin-top:6px;"></div>'
            + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + esc(e.label) + '</div>'
            +   '<div style="font-size:12px;color:var(--t3);line-height:1.55;">' + esc(e.detail) + '</div></div>'
            + navBtn
            + '</div>';
        }).join('')
      : '<div style="padding:18px 0;font-size:12px;color:var(--t3);line-height:1.6;">No operational exposures flagged this month. Operation is clean across the cross-system checks.</div>';
    // The Top Operational Exposures heading carries the Bar Cop Outlook + Export
    // PDF, the way the recovery audits' Action Items area does.
    const exposureCard = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Top Operational Exposures</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;"><button class="btn btn-ghost btn-sm bca-export-btn">Export PDF</button></div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:14px;">' + exposureRows + '</div>';

    // Recurring Patterns section
    const patterns = audit.patterns || [];
    const patternRows = patterns.length
      ? patterns.map(p => {
          const navBtn = p.screen
            ? '<button class="btn btn-ghost btn-sm bca-nav" data-screen="' + esc(p.screen) + '" style="flex-shrink:0;font-size:10px;padding:5px 10px;">Open</button>'
            : '';
          return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:flex-start;">'
            + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + esc(p.label) + '</div>'
            +   '<div style="font-size:12px;color:var(--t3);line-height:1.55;">' + esc(p.detail) + '</div></div>'
            + navBtn
            + '</div>';
        }).join('')
      : '<div style="padding:18px 0;font-size:12px;color:var(--t3);line-height:1.6;">No recurring patterns surfaced this month. Bar Cop watches for same-staff, same-shift, same-vendor, and same-day-of-week patterns over rolling 90-day windows.</div>';
    const patternCard = '<div class="sh" style="margin:24px 0 10px;">Recurring Patterns</div>'
      + '<div class="card" style="margin-bottom:14px;">' + patternRows + '</div>';

    // Recovery Activity stat strip — the second-row stats (no title), the slot
    // where the recovery audits show their recoverable strip under the hero.
    const snap = audit.recovery_snapshot || { gaps: 0, fixesLogged: 0, dollarsRecovered: 0, stillMeasuring: 0 };
    const recoveryStrip = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Gaps Surfaced</div><div class="calc-val lg">' + snap.gaps + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Fixes Logged (30d)</div><div class="calc-val lg ' + (snap.fixesLogged > 0 ? 'good' : '') + '">' + snap.fixesLogged + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Recovered to Date</div><div class="calc-val lg ' + (snap.dollarsRecovered > 0 ? 'good' : '') + '">' + App.fmtCurrency(snap.dollarsRecovered, 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Still Measuring</div><div class="calc-val lg">' + snap.stillMeasuring + '</div></div>'
      + '</div></div>';

    const naNote = overallNA
      ? '<div style="font-size:11px;color:var(--t3);margin:-6px 0 16px;line-height:1.5;">' + (audit.sub_scores_covered || 0) + ' of 6 sub-scores have data. Keep logging Inventory, Shift, and Labor Control and the overall fills in.</div>'
      : '';

    // Detail page. The shared AuditUI.viewHero gives the same header as the three
    // recovery audits, the Recovery Activity stat strip sits in the second row
    // (their recoverable-strip slot), then Top Operational Exposures (this audit's
    // "what to act on"), the six sub-scores, and Recurring Patterns.
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.viewHero(audit, 'Bar Cop Audit', 'bca', this.SECTION_NAMES.length)
      + naNote
      + recoveryStrip
      + exposureCard
      + subCards
      + patternCard
      + '</div>';

    // Back to the audit landing + Print / Save PDF in the Hub topbar-right,
    // matching the recovery audits' detail action row.
    if (App.setHubTopbarActions) {
      App.setHubTopbarActions('<button class="btn btn-ghost btn-sm" id="bca-back-top" style="margin-right:8px;">&larr; Back</button><button class="btn btn-ghost btn-sm" id="bca-print-top">Print / Save PDF</button>');
      document.getElementById('bca-back-top')?.addEventListener('click', () => this.renderMain());
      document.getElementById('bca-print-top')?.addEventListener('click', () => this.exportPDF(audit));
    }

    this.container.querySelector('.bca-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.bca-nav').forEach(btn => {
      btn.addEventListener('click', () => this._navTo(btn.dataset.screen));
    });

    const outlookMount = document.getElementById('bca-outlook-mount');
    if (outlookMount && window.AuditOutlook) {
      AuditOutlook.attach(outlookMount, audit, 'bar-cop', { compact: true });
    }
  },

  // ── Export the Bar Cop Audit as a data-driven PDF ───────────────────────
  // Rebuilds the same content the detail page renders (overall health, the
  // six sub-scores with their breakdowns, top exposures, recurring patterns,
  // recovery activity snapshot, recovery-audit reference) via the shared
  // App._pdfBuilder. Replaces the old window.print() path. Disclaimer is the
  // canonical App.deliverableFooter() language so all Bar Cop deliverables
  // stay in lockstep.
  async exportPDF(audit) {
    if (!audit) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const overall   = audit.overall_score;
    const overallNA = overall == null;
    const scoreLabel = overallNA ? 'Not Enough Data Yet' : App.scoreLabel(overall);
    const venue     = audit.bar_name || (App.data?.settings?.bar_name) || 'Your Operation';

    const b = App._pdfBuilder('Bar Cop Audit');
    b.header({
      right: 'Bar Cop Audit',
      meta: this._fmtDate(audit.date) + '  ·  Operational Health '
            + (overallNA ? 'N/A' : overall)
    });
    b.kv('Operation', venue);
    b.kv('Operational Health', (overallNA ? 'N/A' : overall) + '  (' + scoreLabel + ')');
    const dq = AuditUI.dataQualityLabel(audit, this.SECTION_NAMES.length);
    if (dq) b.kv('Data Quality', dq);
    if (overallNA) {
      b.paragraph((audit.sub_scores_covered || 0) + ' of 6 sub-scores have data. Keep logging Inventory, '
        + 'Shift, and Labor Control and the overall fills in.', { gray: 90 });
    }

    // Six sub-scores, each with its score and breakdown (same as subBlock).
    const SUB_NAMES = [
      ['operational_discipline',  'Operational Discipline'],
      ['cash_integrity',          'Cash Integrity'],
      ['inventory_execution',     'Inventory Execution'],
      ['labor_hygiene',           'Labor Hygiene'],
      ['recovery_action',         'Recovery Action'],
      ['operational_consistency', 'Operational Consistency']
    ];
    SUB_NAMES.forEach(([key, name]) => {
      const raw  = audit.sub_scores && audit.sub_scores[key];
      const isNA = raw == null;
      b.sectionTitle(name);
      b.kv('Sub-Score', isNA ? 'N/A (Not enough data)' : String(raw));
      const detail = (audit.sub_score_detail && audit.sub_score_detail[key]) || [];
      if (!isNA) {
        const fp = this._subFindings(key, raw, detail);
        [fp.narrative, fp.finding, fp.tool].filter(Boolean).forEach(t => b.paragraph(t, { gray: 55 }));
      }
      if (detail.length) {
        b.table(['Component', 'Detail', 'Score'], detail.map(c => [
          c.label,
          c.extra || '',
          (c.na || c.pct == null) ? 'N/A' : String(c.pct)
        ]), { columnStyles: { 2: { halign: 'right', cellWidth: 50 } } });
      }
    });

    // Top Operational Exposures.
    b.sectionTitle('Top Operational Exposures');
    const exposures = audit.exposures || [];
    if (exposures.length) {
      b.table(['Severity', 'Exposure', 'Detail'], exposures.map(e => [
        (e.severity || '').toUpperCase(),
        e.label || '',
        e.detail || ''
      ]), { columnStyles: { 0: { cellWidth: 60 } } });
    } else {
      b.paragraph('No operational exposures flagged this month. Operation is clean across the cross-system checks.');
    }

    // Recurring Patterns.
    b.sectionTitle('Recurring Patterns');
    const patterns = audit.patterns || [];
    if (patterns.length) {
      b.table(['Pattern', 'Detail'], patterns.map(p => [p.label || '', p.detail || '']));
    } else {
      b.paragraph('No recurring patterns surfaced this month. Bar Cop watches for same-staff, same-shift, '
        + 'same-vendor, and same-day-of-week patterns over rolling 90-day windows.');
    }

    // Recovery Activity Snapshot.
    const snap = audit.recovery_snapshot || { gaps: 0, fixesLogged: 0, dollarsRecovered: 0, stillMeasuring: 0 };
    b.sectionTitle('Recovery Activity Snapshot');
    b.table(null, [
      ['Gaps Surfaced',        String(snap.gaps)],
      ['Fixes Logged (30d)',   String(snap.fixesLogged)],
      ['Recovered to date',    App.fmtCurrency(snap.dollarsRecovered, 0)],
      ['Still Measuring',      String(snap.stillMeasuring)]
    ], { columnStyles: { 0: { fontStyle: 'bold' } } });

    b.disclaimer(App.deliverableFooter().workbookSubject);

    let ds = App._pdfDateStamp();
    if (audit.date) {
      const dt = new Date(String(audit.date).length <= 10 ? audit.date + 'T00:00:00' : audit.date);
      if (!isNaN(dt.getTime())) {
        const p = n => String(n).padStart(2, '0');
        ds = '' + dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate());
      }
    }
    await b.save(App.pdfFileName('Bar Cop Audit', ds));
  }
};
