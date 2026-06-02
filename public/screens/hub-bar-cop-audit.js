'use strict';

/* ── Bar Cop Audit — Hub-level executive monthly operational audit ───────────
   The owner-operator's monthly read on the entire operation. Distinct from
   the three recovery audits (Profit, Revenue, Traffic) which answer
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

   One audit every 30 days, hard-locked, same as the three recovery audits.
   Empty state when there is not yet ~60 days of logged data because most
   sub-scores need history to mean anything.

   Single-page audit detail layout (no Scores/Findings tab split). Bar Cop
   Outlook button lives in the audit detail header card next to the score
   via the shared AuditOutlook helper. */

S.HubBarCopAudit = {
  WINDOW_DAYS:           30,   // scoring window for most sub-scores
  CONSISTENCY_WEEKS:     8,    // weeks of history for Operational Consistency
  MIN_DATA_DAYS:         60,   // before this much history exists, empty state
  AUDIT_INTERVAL_DAYS:   30,
  RETENTION_CAP:         12,   // keep last 12 audits (1 year), match recovery audits
  MIN_SUBS_FOR_OVERALL:  3,    // need this many of 6 sub-scores covered for an honest overall

  audits() {
    if (!Array.isArray(App.data.bar_cop_audits)) App.data.bar_cop_audits = [];
    return App.data.bar_cop_audits;
  },

  // Cross-system navigation from Bar Cop Audit deep-links. Hands off to
  // S.Hub._enter to load the operator into the correct system sidebar.
  _navTo(screen) {
    if (!screen) return;
    const mod = screen.startsWith('ic-') ? 'inventory'
              : screen.startsWith('lc-') ? 'labor'
              : screen.startsWith('sc-') ? 'shift'
              : screen.startsWith('r-')  ? 'revenue'
              : screen.startsWith('t-')  ? 'traffic'
              : 'profit'; // Profit-domain screens carry no prefix
    if (window.S && S.Hub && S.Hub._enter) S.Hub._enter(screen, mod);
  },

  // ── Public entry ────────────────────────────────────────────────────────
  // Renders into the Hub content area as a full-page screen. The Hub topbar
  // shows "BAR COP AUDIT | Back to Dashboard" mirroring the module shell
  // pattern. Sidebar stays mounted + interactive on the left.
  open() {
    App.openHubFullPage('Bar Cop Audit', (mount) => {
      this.container = mount;
      this._viewingId = null;
      this.renderMain();
    }, 'bar-cop-audit');
  },

  // ── Utilities ───────────────────────────────────────────────────────────
  _now() { return new Date(); },
  _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  },
  _withinWindow(dateStr, days) {
    if (!dateStr) return false;
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= this._daysAgo(days);
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
  _earliestDataDate() {
    // Find the earliest dated record across the Control stores to decide
    // whether ~60 days of history exists. If nothing logged, returns null.
    const candidates = [];
    const pushFrom = (arr, key) => {
      (arr || []).forEach(r => { if (r && r[key]) candidates.push(r[key]); });
    };
    pushFrom(App.shiftData?.sc_shifts,        'date');
    pushFrom(App.shiftData?.sc_variances,     'date');
    pushFrom(App.inventoryData?.ic_counts,    'date');
    pushFrom(App.laborData?.lc_actuals,       'date');
    pushFrom(App.data?.weeks,                 'period_end');
    if (!candidates.length) return null;
    const earliest = candidates.sort()[0];
    return earliest;
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
  _canRunAudit() {
    const a = this.audits();
    if (!a.length) return { ok: true, daysUntil: 0 };
    const latest = a[a.length - 1];
    const since = this._daysSince(latest.date);
    if (since == null) return { ok: true, daysUntil: 0 };
    const remaining = this.AUDIT_INTERVAL_DAYS - since;
    return remaining > 0 ? { ok: false, daysUntil: remaining } : { ok: true, daysUntil: 0 };
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
    const spotChecks = (App.inventoryData?.ic_spot_checks) || [];

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
    const components = [
      { label: 'Opening checklist completion',  ratio: Math.min(1, opens.length   / 30), na: !active, extra: opens.length  + ' opening checklists logged' },
      { label: 'Closing checklist completion',  ratio: Math.min(1, closes.length  / 30), na: !active, extra: closes.length + ' closing checklists logged' },
      { label: 'Inventory counts completed',    ratio: Math.min(1, wkCounts.length / 4),  na: !active, extra: wkCounts.length + ' of 4 expected weekly' },
      { label: 'Spot checks completed',         ratio: Math.min(1, wkSpots.length  / 4),  na: !active, extra: wkSpots.length  + ' of 4 expected weekly' },
      { label: 'Shifts logged',                 ratio: Math.min(1, wkShifts.length / 30), na: !active, extra: wkShifts.length + ' shifts in window' }
    ];

    // Recovery-audit cadence. N/A until that audit has been run at least once.
    const recoveryAudits = [
      { name: 'Profit Recovery',  list: App.data?.audits },
      { name: 'Revenue Recovery', list: App.data?.revenue_audits },
      { name: 'Traffic Recovery', list: App.data?.traffic_audits }
    ];
    recoveryAudits.forEach(r => {
      const arr = r.list || [];
      const latest = arr.length ? arr[arr.length - 1] : null;
      const since = latest ? this._daysSince(latest.date) : null;
      const onTime = since != null && since <= 35; // 30-day rule with 5-day grace
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

    return this._rollup(components);
  },

  // 2. Cash Integrity. Variance trend + drawer + drop + auth compliance.
  _scoreCashIntegrity() {
    const variances = (App.shiftData?.sc_variances)    || [];
    const drawers   = (App.shiftData?.sc_drawers)      || [];
    const drops     = (App.shiftData?.sc_cash_drops)   || [];
    const voidComps = (App.shiftData?.sc_void_comps)   || [];
    const shifts    = (App.shiftData?.sc_shifts)       || [];
    const threshold = (App.shiftData?.settings?.comp_auth_threshold) || 25;

    const wkVar     = variances.filter(v => this._withinWindow(v.date, this.WINDOW_DAYS));
    const wkShifts  = shifts.filter(s => this._withinWindow(s.date, this.WINDOW_DAYS));
    const wkDrawers = drawers.filter(d => this._withinWindow(d.date, this.WINDOW_DAYS));
    const wkVoids   = voidComps.filter(v => this._withinWindow(v.date, this.WINDOW_DAYS));

    // Variance trend: total absolute variance / total revenue handled.
    // Operator-honest: lower is better, capped at 1% as ceiling = 100 score.
    const totalAbsVar = wkVar.reduce((s, v) => s + Math.abs(parseFloat(v.variance) || 0), 0);
    const totalRev    = wkShifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);
    const varPct      = totalRev > 0 ? (totalAbsVar / totalRev) * 100 : 0;
    const varRatio    = Math.max(0, 1 - (varPct / 1)); // 1%+ → 0, 0% → 1

    // Drawer count completion: expected one per shift.
    const drawerRatio = wkShifts.length > 0 ? Math.min(1, wkDrawers.length / wkShifts.length) : null;

    // Authorization compliance on large voids/comps (over threshold).
    const overThresh = wkVoids.filter(v => (parseFloat(v.amount) || 0) >= threshold);
    const authorized = overThresh.filter(v => v.authorized_by);
    const authRatio  = overThresh.length === 0 ? 1 : authorized.length / overThresh.length;

    // Cash drops activity (at least one drop per shift where revenue > $500).
    const cashShifts = wkShifts.filter(s => (parseFloat(s.total_revenue) || 0) > 500);
    const wkDrops    = drops.filter(d => this._withinWindow(d.date, this.WINDOW_DAYS));
    const dropRatio  = cashShifts.length > 0 ? Math.min(1, wkDrops.length / cashShifts.length) : null;

    const components = [
      { label: 'Cash variance trend (lower is better)', ratio: varRatio,    na: totalRev === 0,         extra: totalRev > 0 ? varPct.toFixed(2) + '% of revenue handled' : 'No revenue logged in window' },
      { label: 'Drawer counts per shift',               ratio: drawerRatio, na: wkShifts.length === 0,  extra: wkDrawers.length + ' counts on ' + wkShifts.length + ' shifts' },
      { label: 'Large void/comp authorization',         ratio: authRatio,   na: wkVoids.length === 0,   extra: wkVoids.length === 0 ? 'No voids/comps logged' : (authorized.length + ' of ' + overThresh.length + ' over $' + threshold + ' authorized') },
      { label: 'Cash drops on revenue shifts',          ratio: dropRatio,   na: cashShifts.length === 0, extra: wkDrops.length + ' drops on ' + cashShifts.length + ' shifts over $500' }
    ];
    return this._rollup(components);
  },

  // 3. Inventory Execution. Count cadence + discrepancy resolution + variance.
  _scoreInventoryExecution() {
    const counts     = (App.inventoryData?.ic_counts)        || [];
    const spotChecks = (App.inventoryData?.ic_spot_checks)   || [];
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
      const wkSchedules = schedules.filter(s => this._withinWindow(s.date, this.WINDOW_DAYS));
      const totalSched  = wkSchedules.reduce((s, x) => s + (parseFloat(x.hours) || 0), 0);
      if (totalSched > 0) {
        const dev = Math.abs(totalActual - totalSched) / totalSched;
        schedScore = Math.max(0, 1 - (dev / 0.10));
        schedExtra = Math.round(totalActual) + ' actual vs ' + Math.round(totalSched) + ' scheduled hours';
      } else { schedExtra = 'No schedule logged to compare against'; }
    }

    // Callout frequency: ideal < 1 per 20 shifts. N/A without logged hours.
    const calloutRate = wkCallouts.length / Math.max(20, wkActuals.length || 1) * 20;
    const calloutScore = laborActive ? Math.max(0, 1 - calloutRate) : null;

    // OT incidents: actuals over 40 hours in the window.
    const otCount = wkActuals.filter(a => (parseFloat(a.hours) || 0) > 40).length;
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
      { label: 'Overtime incidents under control',    ratio: otScore,       na: !laborActive,               extra: otCount + ' shifts over 40 hours' },
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
      App.latestEvent(App.data?.traffic_audits || [])
    ].filter(Boolean);
    const gapIds = new Set();
    latestAudits.forEach(a => {
      (a.action_items || []).forEach(it => { if (it.gap_id) gapIds.add(it.gap_id); });
    });
    const surfaced = gapIds.size;

    // Fix log entries in the 30-day window.
    const wkFixes = fixLog.filter(f => this._withinWindow(f.date, this.WINDOW_DAYS));

    // Matured fixes that produced positive dollar movement via Recovery.
    let recoveredCount = 0;
    if (window.Recovery && typeof Recovery.compute === 'function') {
      fixLog.forEach(f => {
        try {
          const r = Recovery.compute(f);
          if (r.status === 'ok' && r.dollars > 0) recoveredCount++;
        } catch (e) {}
      });
    }

    // With zero fixes ever logged there is no recovery activity to judge yet, so
    // the whole sub-score is N/A — never a harsh "0, you are not acting" on the
    // day the first audit surfaced gaps but no second has come around to fix.
    const noFixes = fixLog.length === 0;

    // Component 1: act-on-gaps. N/A until an audit has surfaced something AND at
    // least one fix has been logged.
    const actRatio = (surfaced === 0 || noFixes) ? null : Math.min(1, wkFixes.length / surfaced);

    // Component 2: of the fixes logged, how many produced real favorable movement.
    // N/A until at least one fix is logged.
    const convRatio = noFixes ? null : Math.min(1, recoveredCount / fixLog.length);

    const components = [
      { label: 'Acting on surfaced gaps',                ratio: actRatio,  na: surfaced === 0 || noFixes, extra: noFixes ? 'No recovery activity yet' : (surfaced === 0 ? 'No audit has surfaced gaps yet' : (wkFixes.length + ' fixes logged in last 30 days against ' + surfaced + ' surfaced gaps')) },
      { label: 'Fixes that produced movement',           ratio: convRatio, na: noFixes,                   extra: noFixes ? 'No fixes logged yet' : (recoveredCount + ' of ' + fixLog.length + ' logged fixes produced favorable movement') }
    ];
    return this._rollup(components);
  },

  // 6. Operational Consistency. Week-over-week variance in stable metrics
  //    over last 8 weeks. Low variance = disciplined operation.
  _scoreOperationalConsistency() {
    const weeks = (App.data?.weeks || []).slice(-this.CONSISTENCY_WEEKS);
    const revWeeks = (App.data?.revenue_weeks || []).slice(-this.CONSISTENCY_WEEKS);

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
    const coversCV = cvScore(revWeeks.map(w => (parseFloat(w.covers) || 0)));
    const laborPctCV = cvScore(weeks.map(w => {
      const rev = (parseFloat(w.bar?.revenue) || 0) + (parseFloat(w.food?.revenue) || 0);
      const lab = parseFloat(w.labor_total) || 0;
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

    // Certifications expiring in next 30 days.
    const expSoon = certs.filter(c => {
      if (!c.expiration_date) return false;
      const days = this._daysSince(c.expiration_date) * -1;
      return days >= 0 && days <= 30;
    });
    expSoon.forEach(c => {
      const daysLeft = this._daysSince(c.expiration_date) * -1;
      out.push({
        label:    (c.cert_name || c.name || 'Certification') + ' expiring in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's'),
        detail:   (c.staff_name ? 'For ' + c.staff_name + '. ' : '') + 'Renew before lapse to stay compliant.',
        severity: daysLeft <= 7 ? 'critical' : 'warn'
      });
    });

    // Permits and compliance items due in next 30 days.
    const permitsSoon = permits.filter(p => {
      if (!p.renewal_date) return false;
      const days = this._daysSince(p.renewal_date) * -1;
      return days >= 0 && days <= 30;
    });
    permitsSoon.forEach(p => {
      const daysLeft = this._daysSince(p.renewal_date) * -1;
      out.push({
        label:    (p.name || 'Permit') + ' renewal in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's'),
        detail:   (p.type ? p.type + '. ' : '') + (p.cost ? 'Last cost $' + p.cost + '. ' : '') + 'Operation-level compliance item.',
        severity: daysLeft <= 14 ? 'critical' : 'warn'
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
        screen:   'sc-variance-log'
      });
    }

    // Skipped procedures: opening or closing checklist completion rate below 70%.
    const wkOpens   = checklists.filter(c => c.type === 'open'    && this._withinWindow(c.date, 30));
    const wkCloses  = checklists.filter(c => c.type === 'closing' && this._withinWindow(c.date, 30));
    if (wkOpens.length < 20) {
      out.push({
        label:    'Opening checklist run only ' + wkOpens.length + ' times in last 30 days',
        detail:   'Below 20 of an expected 30 runs. Day starts without the opening sweep can mean missed restock or setup issues.',
        severity: 'warn',
        screen:   'sc-opening-checklist'
      });
    }
    if (wkCloses.length < 20) {
      out.push({
        label:    'Closing checklist run only ' + wkCloses.length + ' times in last 30 days',
        detail:   'Below 20 of an expected 30 runs. Missed closes invite cash-handling and clean-up gaps.',
        severity: 'warn',
        screen:   'sc-closing-checklist'
      });
    }

    // Recovery audits overdue (35+ days since latest).
    [
      { name: 'Profit Recovery',  list: App.data?.audits,         screen: 'audit-tracker' },
      { name: 'Revenue Recovery', list: App.data?.revenue_audits, screen: 'r-audit' },
      { name: 'Traffic Recovery', list: App.data?.traffic_audits, screen: 't-audit' }
    ].forEach(r => {
      const arr = r.list || [];
      const latest = arr.length ? arr[arr.length - 1] : null;
      const since = latest ? this._daysSince(latest.date) : null;
      if (since == null) {
        out.push({
          label:    r.name + ' audit never run',
          detail:   'Run the first audit to start scoring this section.',
          severity: 'warn',
          screen:   r.screen
        });
      } else if (since > 35) {
        out.push({
          label:    r.name + ' audit overdue (' + since + ' days)',
          detail:   'Last run on ' + this._fmtDate(latest.date) + '. The 30-day rhythm keeps the trend honest.',
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
    const voidComps  = (App.shiftData?.sc_void_comps)   || [];
    const actuals    = (App.laborData?.lc_actuals)      || [];
    const discrep    = (App.data?.vendor_discrepancies) || [];
    const counts     = (App.inventoryData?.ic_counts)   || [];
    const reviews    = (App.data?.traffic_review_replies) || [];
    const notes      = (App.laborData?.lc_staff_notes)  || [];

    const since90 = (dateStr) => this._withinWindow(dateStr, 90);

    // Rule 1: same staff plus recurring cash variance (3+ in 90 days)
    const wkVar = variances.filter(v => since90(v.date));
    const byManager = {};
    wkVar.forEach(v => {
      const id = v.counted_by_id || v.counted_by || 'unknown';
      if (!byManager[id]) byManager[id] = [];
      byManager[id].push(v);
    });
    Object.keys(byManager).forEach(id => {
      const list = byManager[id];
      if (list.length >= 3 && id !== 'unknown') {
        const name = list[0].counted_by || id;
        out.push({
          label: 'Recurring cash variance: ' + name,
          detail: list.length + ' variance events in last 90 days. Coach or rotate the close.',
          screen: 'sc-variance-log'
        });
      }
    });

    // Rule 2: same shift type plus recurring void/comp pattern
    const wkVoids = voidComps.filter(v => since90(v.date));
    const byShiftType = {};
    wkVoids.forEach(v => {
      const t = v.shift_type || 'unknown';
      if (!byShiftType[t]) byShiftType[t] = 0;
      byShiftType[t]++;
    });
    Object.keys(byShiftType).forEach(t => {
      if (byShiftType[t] >= 10 && t !== 'unknown') {
        out.push({
          label: 'Void/comp concentration on ' + t + ' shifts',
          detail: byShiftType[t] + ' events in last 90 days on ' + t + '. Pattern worth investigating.',
          screen: 'sc-void-comp'
        });
      }
    });

    // Rule 3: same product plus chronic shrinkage (3+ months of variance)
    // Simplified: products appearing in 3+ ic_counts with negative variance.
    // (Full implementation would join across counts; for v1 we count distinct
    //  product mentions with adverse variance in the last 90 days.)
    const wkCounts = counts.filter(c => since90(c.date));
    const adverseByProduct = {};
    wkCounts.forEach(c => {
      (c.items || []).forEach(it => {
        const variance = parseFloat(it.variance) || 0;
        if (variance < -1) { // shrinkage > 1 unit
          const name = it.product_name || it.name || it.product_id;
          if (!name) return;
          if (!adverseByProduct[name]) adverseByProduct[name] = 0;
          adverseByProduct[name]++;
        }
      });
    });
    Object.keys(adverseByProduct).forEach(name => {
      if (adverseByProduct[name] >= 3) {
        out.push({
          label: 'Chronic shrinkage: ' + name,
          detail: adverseByProduct[name] + ' adverse variance events in last 90 days. Investigate pour, theft, or recipe.',
          screen: 'theft-risk'
        });
      }
    });

    // Rule 4: same day-of-week plus labor overage
    const wkActuals = actuals.filter(a => since90(a.date));
    const byDow = [0,0,0,0,0,0,0];
    const totalsDow = [0,0,0,0,0,0,0];
    wkActuals.forEach(a => {
      const d = new Date(String(a.date).length <= 10 ? a.date + 'T00:00:00' : a.date);
      if (isNaN(d.getTime())) return;
      const dow = d.getDay();
      totalsDow[dow]++;
      if ((parseFloat(a.hours) || 0) > 40) byDow[dow]++;
    });
    const dowNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    byDow.forEach((count, idx) => {
      if (count >= 4 && totalsDow[idx] >= 8) {
        out.push({
          label: 'Recurring labor overage on ' + dowNames[idx],
          detail: count + ' over-40-hour entries on ' + dowNames[idx] + 's in last 90 days. Schedule the day differently.',
          screen: 'lc-build-schedule'
        });
      }
    });

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
      App.latestEvent(App.data?.traffic_audits || [])
    ].filter(Boolean);
    const gapIds = new Set();
    latestAudits.forEach(a => {
      (a.action_items || []).forEach(it => { if (it.gap_id) gapIds.add(it.gap_id); });
    });
    result.gaps = gapIds.size;

    const fixLog = (App.data?.fix_log) || [];
    result.fixesLogged = fixLog.filter(f => this._withinWindow(f.date, this.WINDOW_DAYS)).length;

    if (window.Recovery && typeof Recovery.total === 'function') {
      try {
        const t = Recovery.total();
        result.dollarsRecovered = Math.round(t.dollars || 0);
      } catch (e) {}
    }
    if (window.Recovery && typeof Recovery.compute === 'function') {
      fixLog.forEach(f => {
        try {
          const r = Recovery.compute(f);
          if (r.status === 'pending') result.stillMeasuring++;
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

    return {
      id:          App.uid ? App.uid() : ('bca-' + Date.now()),
      date:        new Date().toISOString(),
      bar_name:    (App.data?.settings?.bar_name) || 'Your Operation',
      overall_score: overall,
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
      sections: {
        'Operational Discipline':   disc.score,
        'Cash Integrity':           cash.score,
        'Inventory Execution':      inv.score,
        'Labor Hygiene':            labor.score,
        'Recovery Action':          rec.score,
        'Operational Consistency':  cons.score
      },
      action_items: this._topExposures().map(e => ({
        action: e.label + '. ' + e.detail,
        gap_id: e.gap_id || null,
        monthly_impact: 0
      }))
    };
  },

  // ── Generate flow ───────────────────────────────────────────────────────
  async _generate() {
    const gate = this._canRunAudit();
    if (!gate.ok) return;
    if (!this._hasEnoughData()) return;
    // Row-per-record in core_events now; full executive-audit history is kept
    // (the 12-audit blob cap is gone) and paged via "Show older" on the list.
    const snapshot = this._computeAuditSnapshot();
    const ok = await App.putRecord('core', 'bar_cop_audit', snapshot);
    if (ok) {
      this._viewingId = snapshot.id;
      this._renderDetail(snapshot);
    }
  },

  // ── Render: landing ─────────────────────────────────────────────────────
  // ── Render: landing ─────────────────────────────────────────────────────
  // Mirrors the audit-tracker.js renderMain pattern exactly so all four
  // audits feel familiar: requestCard at the top with description and
  // countdown or Generate button, latestCard with score and View Full
  // Audit, score history chart, audit history table.
  renderMain() {
    const audits = this.audits().slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const latest = audits[0] || null;
    const enough = this._hasEnoughData();
    const earliest = this._earliestDataDate();
    const daysOfData = earliest ? this._daysSince(earliest) : 0;

    const daysSince = latest && latest.date
      ? Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000)
      : Infinity;
    const canRunAudit = enough && daysSince >= this.AUDIT_INTERVAL_DAYS;
    const daysLeft    = canRunAudit ? 0 : (enough ? this.AUDIT_INTERVAL_DAYS - daysSince : 0);

    let requestRight = '';
    if (!enough) {
      requestRight = '<div style="text-align:right;flex-shrink:0;max-width:240px;">'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.5;">Log some Inventory, Shift, or Labor Control data and the audit can score it.</div></div>';
    } else if (canRunAudit) {
      requestRight = '<button class="btn btn-primary" id="bca-new-btn" style="flex-shrink:0;">' + (latest ? 'Generate New Audit' : 'Generate First Audit') + '</button>';
    } else {
      requestRight = '<div style="text-align:right;flex-shrink:0;">'
        + '<div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</div>'
        + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit</div></div>';
    }

    const requestBody = enough
      ? 'One Bar Cop Audit every ' + this.AUDIT_INTERVAL_DAYS + ' days. Executive operational read across every system. Each of the six sub-scores fills in as you log the data behind it, and shows N/A until then. Top exposures, recurring patterns, and recovery activity included. Print or save as a PDF from your browser.'
      : 'The Bar Cop Audit reads entirely from your Control systems, so there is nothing to upload. Start logging in Inventory, Shift, and Labor Control and it scores what it can, filling in the rest over time.';

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Bar Cop Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:560px;">' + requestBody + '</div>'
      + '</div>'
      + requestRight
      + '</div></div>';

    let latestCard = '';
    if (latest) {
      const prev = audits[1] || null;
      const overallNA = latest.overall_score == null;
      const scoreColor = overallNA ? 'var(--t3)' : App.scoreColor(latest.overall_score);
      const scoreLabel = overallNA ? 'Not enough data yet' : App.scoreLabel(latest.overall_score);

      let progressBanner = '';
      if (prev && latest.overall_score != null && prev.overall_score != null) {
        const diff = latest.overall_score - prev.overall_score;
        progressBanner = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:3px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">vs Previous Audit</div>'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:' + (diff >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (diff >= 0 ? '+' : '') + diff + ' pts</div>'
          + '<div style="font-size:12px;color:var(--t2);">' + prev.overall_score + ' to ' + latest.overall_score + '</div>'
          + '</div>';
      }

      const sections = latest.sections || {};
      const sectionRows = Object.entries(sections).map(([name, score]) => {
        // N/A sub-score: same "Not enough data" treatment the detail page uses,
        // never a raw red "null". No bar, no change arrow.
        if (score == null) {
          return '<tr>'
            + '<td style="color:var(--t2);padding:8px 12px;">' + esc(name) + '</td>'
            + '<td style="padding:8px 12px;width:140px;"></td>'
            + '<td style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:var(--t3);padding:8px 12px;">N/A</td>'
            + '<td style="font-size:11px;color:var(--t4);padding:8px 12px;">Not enough data</td>'
            + '</tr>';
        }
        const ps   = prev?.sections?.[name];
        const diff = (ps != null) ? score - ps : null;
        const bar  = Math.min(100, Math.max(0, score));
        return '<tr>'
          + '<td style="color:var(--t1);padding:8px 12px;">' + esc(name) + '</td>'
          + '<td style="padding:8px 12px;width:140px;"><div style="background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + App.scoreColor(score) + ';border-radius:3px;"></div></div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + App.scoreColor(score) + ';padding:8px 12px;">' + score + '</td>'
          + (diff != null ? '<td style="font-size:12px;color:' + (diff >= 0 ? 'var(--gold)' : 'var(--red)') + ';padding:8px 12px;">' + (diff >= 0 ? '+' : '') + diff + '</td>' : '<td></td>')
          + '</tr>';
      }).join('');

      latestCard = '<div class="card" style="margin-bottom:16px;">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--b2);flex-wrap:wrap;gap:10px;">'
        + '<div>'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Bar Cop Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name || App.data.settings.bar_name || 'Your Operation') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date || '').slice(0, 10) + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (overallNA ? 'N/A' : latest.overall_score) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + '<button class="btn btn-ghost btn-sm bca-view-btn" data-idx="0">View Full Audit</button>'
        + '</div>'
        + '</div>'
        + progressBanner
        + (sectionRows ? '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">'
          + '<thead><tr>'
          + '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Section</th>'
          + '<th style="width:140px;padding:6px 12px;border-bottom:1px solid var(--b2);"></th>'
          + '<th style="width:60px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Score</th>'
          + (prev ? '<th style="width:70px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Change</th>' : '<th></th>')
          + '</tr></thead><tbody>' + sectionRows + '</tbody></table>' : '')
        + '</div>';
    }

    const emptyState = !latest && enough
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first Bar Cop Audit above. Sub-scores, exposures, and recurring patterns appear once the snapshot is built.</div></div>'
      : '';

    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.slice(0, App.listLimit('core', 'bar_cop_audit')).map((a, i) => {
        const p    = audits[i + 1];
        const naA  = a.overall_score == null;
        const diff = (p && !naA && p.overall_score != null) ? a.overall_score - p.overall_score : null;
        return '<tr>'
          + '<td>' + (a.date || '').slice(0, 10) + '</td>'
          + (naA
              ? '<td style="font-size:11px;font-weight:800;color:var(--t3);">N/A</td>'
              : '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + App.scoreColor(a.overall_score) + ';">' + a.overall_score + '</td>')
          + (diff != null ? '<td style="color:' + (diff >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (diff >= 0 ? '+' : '') + diff + ' pts</td>' : '<td></td>')
          + '<td>' + (a.exposures ? a.exposures.length : 0) + '</td>'
          + '<td>' + (a.patterns ? a.patterns.length : 0) + '</td>'
          + '<td><button class="btn btn-ghost btn-sm bca-view-btn" data-idx="' + i + '" style="font-size:10px;padding:4px 10px;">View</button></td>'
          + '</tr>';
      }).join('');
      historyCard = '<div class="card">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Audit History</div>'
        + '<div style="font-size:11px;color:var(--t3);">Full history kept. Print any audit to save as PDF.</div>'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Score</th><th>Change</th><th>Exposures</th><th>Patterns</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('core', 'bar_cop_audit', audits, false)
        + '</div>';
    }

    let scoreChart = '';
    if (audits.length >= 2) {
      scoreChart = this._renderScoreChart(audits);
    }

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + scoreChart + historyCard + '</div>';

    // Landing has no screen-specific topbar actions.
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    document.getElementById('bca-new-btn')?.addEventListener('click', () => this._generate());
    this.container.querySelectorAll('.bca-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this._viewAuditByIdx(parseInt(btn.dataset.idx)));
    });
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  _viewAuditByIdx(idx) {
    const sorted = this.audits().slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const audit = sorted[idx];
    if (audit) this._renderDetail(audit);
  },

  // Audit score history chart. Mirrors the audit-tracker renderScoreChart
  // pattern so the visual matches across all four audits.
  _renderScoreChart(audits) {
    const sorted = audits.slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const W = 700, H = 180, PAD = { t: 24, r: 20, b: 36, l: 40 };
    const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b;
    const scores = sorted.map(a => a.overall_score == null ? null : a.overall_score);
    const validScores = scores.filter(v => v != null);
    const minY = validScores.length ? Math.max(0, Math.min(...validScores) - 10) : 0;
    const maxY = validScores.length ? Math.min(100, Math.max(...validScores) + 10) : 100;
    const xs = i => PAD.l + (sorted.length > 1 ? (i / (sorted.length - 1)) * cw : cw / 2);
    const ys = v => PAD.t + ch - ((v - minY) / (maxY - minY || 1)) * ch;

    const smoothPath = pts => {
      const valid = pts.map((v, i) => v != null ? { x: xs(i), y: ys(v) } : null).filter(Boolean);
      if (valid.length < 2) return valid.length === 1 ? 'M' + valid[0].x + ',' + valid[0].y : '';
      let d = 'M' + valid[0].x.toFixed(1) + ',' + valid[0].y.toFixed(1);
      for (let i = 1; i < valid.length; i++) {
        const cp = (valid[i].x - valid[i - 1].x) * 0.35;
        d += ' C' + (valid[i - 1].x + cp).toFixed(1) + ',' + valid[i - 1].y.toFixed(1) + ' ' + (valid[i].x - cp).toFixed(1) + ',' + valid[i].y.toFixed(1) + ' ' + valid[i].x.toFixed(1) + ',' + valid[i].y.toFixed(1);
      }
      return d;
    };
    const areaPath = pts => {
      const valid = pts.map((v, i) => v != null ? { x: xs(i), y: ys(v) } : null).filter(Boolean);
      if (valid.length < 2) return '';
      let d = 'M' + valid[0].x.toFixed(1) + ',' + ys(minY).toFixed(1) + ' L' + valid[0].x.toFixed(1) + ',' + valid[0].y.toFixed(1);
      for (let i = 1; i < valid.length; i++) {
        const cp = (valid[i].x - valid[i - 1].x) * 0.35;
        d += ' C' + (valid[i - 1].x + cp).toFixed(1) + ',' + valid[i - 1].y.toFixed(1) + ' ' + (valid[i].x - cp).toFixed(1) + ',' + valid[i].y.toFixed(1) + ' ' + valid[i].x.toFixed(1) + ',' + valid[i].y.toFixed(1);
      }
      d += ' L' + valid[valid.length - 1].x.toFixed(1) + ',' + ys(minY).toFixed(1) + ' Z';
      return d;
    };

    const ticks = [minY, Math.round((minY + maxY) / 2), maxY].filter((v, i, a) => a.indexOf(v) === i);
    const uid  = 'bcasc' + Math.random().toString(36).slice(2, 6);
    const linePath = smoothPath(scores);
    const fillPath = areaPath(scores);
    const xLabels  = sorted.map((a, i) =>
      '<text x="' + xs(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + (a.date || '').slice(0, 7) + '</text>'
    ).join('');
    const dots = sorted.map((a, i) => {
      const v   = a.overall_score;
      if (v == null) return '';   // no dot for an N/A audit
      const col = App.scoreHex(v);
      return '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(v).toFixed(1) + '" r="5" fill="#0A1520" stroke="' + col + '" stroke-width="2.5"/>'
        + '<text x="' + xs(i).toFixed(1) + '" y="' + (ys(v) - 10).toFixed(1) + '" text-anchor="middle" fill="' + col + '" font-family="\'Barlow Condensed\',sans-serif" font-size="13" font-weight="700">' + v + '</text>';
    }).join('');

    return '<div class="card" style="margin-bottom:16px;padding:20px 24px 16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Bar Cop Score History</div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;">'
      + '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/></linearGradient></defs>'
      + ticks.map(v => '<line x1="' + PAD.l + '" y1="' + ys(v).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ys(v).toFixed(1) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="' + (PAD.l - 6) + '" y="' + (ys(v) + 4).toFixed(1) + '" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + Math.round(v) + '</text>').join('')
      + (fillPath ? '<path d="' + fillPath + '" fill="url(#' + uid + ')"/>' : '')
      + (linePath ? '<path d="' + linePath + '" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' : '')
      + dots + xLabels
      + '</svg></div>';
  },

  // ── Render: single audit detail (single-page layout) ────────────────────
  _renderDetail(audit) {
    this._viewingId = audit.id;
    const overallNA = audit.overall_score == null;
    const overall = overallNA ? null : audit.overall_score;
    const scoreColor = overallNA ? 'var(--t3)' : App.scoreColor(overall);
    const scoreLabel = overallNA ? 'Not Enough Data Yet' : App.scoreLabel(overall);

    const SUB_NAMES = [
      ['operational_discipline',  'Operational Discipline'],
      ['cash_integrity',          'Cash Integrity'],
      ['inventory_execution',     'Inventory Execution'],
      ['labor_hygiene',           'Labor Hygiene'],
      ['recovery_action',         'Recovery Action'],
      ['operational_consistency', 'Operational Consistency']
    ];

    const subBlock = (key, name) => {
      const raw = audit.sub_scores && audit.sub_scores[key];
      const isNA = raw == null;
      const sc = isNA ? null : raw;
      const col = isNA ? 'var(--t3)' : App.scoreColor(sc);
      const detail = (audit.sub_score_detail && audit.sub_score_detail[key]) || [];
      const breakdown = detail.length
        ? '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b2);">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Score Breakdown</div>'
          + detail.map(c => {
              const naC = c.na || c.pct == null;
              return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:6px 0;font-size:12px;color:var(--t2);">'
                + '<div style="flex:1;">' + esc(c.label) + (c.extra ? ' <span style="color:var(--t3);font-size:11px;">(' + esc(c.extra) + ')</span>' : '') + '</div>'
                + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:' + (naC ? 'var(--t3)' : App.scoreColor(c.pct)) + ';width:50px;text-align:right;font-size:' + (naC ? '11px' : '14px') + ';">' + (naC ? 'N/A' : c.pct) + '</div>'
                + '</div>';
            }).join('')
          + '</div>'
        : '';
      const scoreBlock = isNA
        ? '<div style="text-align:right;"><div style="font-size:16px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:3px;">Not enough data</div></div>'
        : '<div style="text-align:right;">'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:42px;font-weight:700;color:' + col + ';line-height:1;">' + sc + '</div>'
          + '<div style="background:var(--b2);height:5px;border-radius:3px;width:80px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:' + sc + '%;background:' + col + ';border-radius:3px;"></div></div>'
          + '</div>';
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
        +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Sub-Score</div>'
        +     '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
        +   scoreBlock
        + '</div>'
        + breakdown
        + '</div>';
    };

    const subCards = SUB_NAMES.map(([k, n]) => subBlock(k, n)).join('');

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
    const exposureCard = '<div class="card" style="margin-bottom:14px;">'
      + '<div class="card-title">Top Operational Exposures</div>'
      + exposureRows
      + '</div>';

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
    const patternCard = '<div class="card" style="margin-bottom:14px;">'
      + '<div class="card-title">Recurring Patterns</div>'
      + patternRows
      + '</div>';

    // Recovery Activity Snapshot section
    const snap = audit.recovery_snapshot || { gaps: 0, fixesLogged: 0, dollarsRecovered: 0, stillMeasuring: 0 };
    const recoveryCard = '<div class="card" style="margin-bottom:14px;">'
      + '<div class="card-title">Recovery Activity Snapshot</div>'
      + '<div class="calc">'
      +   '<div class="calc-item"><div class="calc-label">Gaps Surfaced</div><div class="calc-val">' + snap.gaps + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Fixes Logged (30d)</div><div class="calc-val ' + (snap.fixesLogged > 0 ? 'good' : '') + '">' + snap.fixesLogged + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Recovered to date</div><div class="calc-val ' + (snap.dollarsRecovered > 0 ? 'good' : '') + '">' + App.fmtCurrency(snap.dollarsRecovered, 0) + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Still Measuring</div><div class="calc-val">' + snap.stillMeasuring + '</div></div>'
      + '</div>'
      + '</div>';

    // Recovery audit one-liner reference
    const lastP = App.latestEvent(App.data?.audits || []);
    const lastR = App.latestEvent(App.data?.revenue_audits || []);
    const lastT = App.latestEvent(App.data?.traffic_audits || []);
    const refLine = '<div style="padding:14px 18px;background:var(--input);border:1px solid var(--b2);border-radius:6px;margin-bottom:14px;font-size:12px;color:var(--t2);line-height:1.6;">'
      + 'Latest scores from the three recovery audits: '
      + 'Profit ' + (lastP ? lastP.overall_score || '-' : '-') + ', '
      + 'Revenue ' + (lastR ? lastR.overall_score || '-' : '-') + ', '
      + 'Traffic ' + (lastT ? lastT.overall_score || '-' : '-') + '. '
      + 'Open each for fix detail.'
      + '</div>';

    // Detail page. No in-content action row: Back to Dashboard lives in the
    // topbar (sidebar stays mounted so re-entering audit history is one
    // click on the sidebar). Print / Save PDF lives in topbar-right.
    this.container.innerHTML = '<div class="screen">'

      // Header card (mirrors recovery audit detail pattern, single-page layout)
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      +   '<div>'
      +     '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Bar Cop Audit</div>'
      +     '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name || (App.data?.settings?.bar_name) || 'Your Operation') + '</div>'
      +     '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + this._fmtDate(audit.date) + '</div>'
      +   '</div>'
      +   '<div style="text-align:right;">'
      +     '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Operational Health</div>'
      +     '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:72px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (overallNA ? 'N/A' : overall) + '</div>'
      +   '</div>'
      + '</div>'
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">'
      +   '<div style="flex:1;min-width:240px;">'
      +     '<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin-bottom:2px;">' + esc(scoreLabel) + (overallNA ? '' : ' Operational Health') + '</div>'
      +     (overallNA ? '<div style="font-size:11px;color:var(--t3);margin-top:4px;line-height:1.5;">' + (audit.sub_scores_covered || 0) + ' of 6 sub-scores have data. Keep logging Inventory, Shift, and Labor Control and the overall fills in.</div>' : App.scoreBar(overall))
      +   '</div>'
      +   '<div id="bca-outlook-mount" style="flex-shrink:0;"></div>'
      + '</div>'
      + '</div>'

      + refLine
      + subCards
      + exposureCard
      + patternCard
      + recoveryCard

      + '</div>';

    // Print button lives in the Hub topbar-right, mirroring how module
    // audit screens put their Print action in topbar-right.
    if (App.setHubTopbarActions) {
      App.setHubTopbarActions('<button class="btn btn-ghost btn-sm" id="bca-print-top">Print / Save PDF</button>');
      document.getElementById('bca-print-top')?.addEventListener('click', () => this.exportPDF(audit));
    }

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
    if (overallNA) {
      b.paragraph((audit.sub_scores_covered || 0) + ' of 6 sub-scores have data. Keep logging Inventory, '
        + 'Shift, and Labor Control and the overall fills in.', { gray: 90 });
    }

    // Recovery-audit reference line (mirrors the on-screen refLine).
    const lastP = App.latestEvent(App.data?.audits || []);
    const lastR = App.latestEvent(App.data?.revenue_audits || []);
    const lastT = App.latestEvent(App.data?.traffic_audits || []);
    b.paragraph('Latest scores from the three recovery audits: '
      + 'Profit ' + (lastP ? (lastP.overall_score || '-') : '-') + ', '
      + 'Revenue ' + (lastR ? (lastR.overall_score || '-') : '-') + ', '
      + 'Traffic ' + (lastT ? (lastT.overall_score || '-') : '-') + '.', { italic: true, gray: 110 });

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
      const dt = new Date(audit.date);
      if (!isNaN(dt.getTime())) {
        const p = n => String(n).padStart(2, '0');
        ds = '' + dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate());
      }
    }
    await b.save('BarCop_BarCopAudit_' + ds + '.pdf');
  }
};
