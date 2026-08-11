'use strict';
S.RevenueAudit = {
  _view: null,

  render(container, actions) {
    this.container = container;
    this.actions   = actions;
    actions.innerHTML = '';
    this._view = null;
    this.renderMain();
  },

  renderMain() {
    this._view = null;
    this.actions.innerHTML = '';
    const audits = (App.data.revenue_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest = audits[0] || null;
    const desc = 'Bar Cop scores your trailing four weeks off your logged data. Run it whenever you want a fresh read.';
    const SECTION_NAMES = ['Check Average and Revenue', 'Labor Efficiency', 'Menu Performance', 'Server Performance', 'Events and Private Dining'];
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.readinessCard({ pfx: 'ra', title: 'Revenue Audit', desc,
          steps: this._readinessSteps(), sectionsReady: this._sectionsReady(), hasLatest: !!latest })
      + (latest ? AuditUI.landingCard(latest, audits[1], SECTION_NAMES, 'ra') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'revenue_audit', 'ra', { sectionCount: SECTION_NAMES.length }) : '')
      + '</div>';
    AuditUI.wireFirstAudit(this.container);
    document.getElementById('ra-gen-btn')?.addEventListener('click', () => this.onGenerate());
    this.container.querySelectorAll('.ra-view-btn').forEach(btn =>
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  // ⚠ THE ONE CLIENT-SIDE MIRROR of the server's scorable-menu filter. It MUST stay
  // identical to `server/audit-compute.js` (`num(i.price) > 0 && num(i.cost) > 0 &&
  // num(i.weekly_covers) > 0 && !i.archived`), because this is what tells the operator
  // whether a run will be able to score the menu section.
  // It used to read `price != null && cost != null && weekly_covers != null` with no
  // archived test, and `0 != null` is true while `0 > 0` is false — so the two sides
  // split on FOUR shapes at once: an item imported with no cost column (r-menu-items
  // stores cost 0), an archived Dog-Test-cut dish, a dish that never sells, and a dish
  // with no price. A 40-item POS import therefore ticked "Menu items priced with units
  // sold" and earned the "Full data" badge while the server could score NONE of it and
  // recipeCoverage reported 0%, costing S2 up to 10 points. Bar Cop promised a score and
  // then quietly did not deliver it.
  // Both readiness readers go through here so the two copies cannot drift apart again.
  // Pinned as a tie-out by verify-audit-readiness-tieout.js, which lifts BOTH filters
  // from source and asserts they classify the same menu identically.
  // ⚠ THE AUDIT SCORES THE LIVE COST, NOT THE SAVED SNAPSHOT (S106 — Kyle's call, option B,
  // 2026-07-22). A menu item's `cost` is written ONCE, at save time (r-menu-items.js), while every
  // other screen recomputes it through App.menuItemCost. The audit is computed on the SERVER, and
  // the server never receives inventory — audit-compute.js cannot see ic_products at all — so that
  // snapshot was the only figure it had, and nothing refreshed it until somebody happened to
  // re-save the dish. A keg going $180 -> $320 left the audit scoring $5.55/pint margin against a
  // truth of $4.42; five deleted products left it awarding the "Full data" badge and a full
  // Star/Dog mix while Menu Engineering on the next screen said "Price your menu items first".
  // Returns COPIES, so nothing stored changes and no background write is added — the server's own
  // filter is untouched and correct; what changed is the data fed to it.
  // A cost of null (deleted ingredient) stays NULL, so `> 0` drops the dish out of the scored set
  // rather than scoring it at zero — an unknown cost is not a free one.
  _auditMenuItems() {
    return (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) }));
  },
  // ⚠ Reads the same live view as the payload, or readiness would judge the snapshot while the
  // server judges the live figure — which is S49's client/server tie-out broken from the other
  // side. verify-audit-live-cost.js case C pins that the two classify a menu identically.
  _costedMenu() {
    return this._auditMenuItems().filter(i => +i.price > 0 && +i.cost > 0 && +i.weekly_covers > 0 && !i.archived);
  },

  _readinessSteps() {
    const cd = this.buildControlData() || {};
    const costedMenu = this._costedMenu();
    return [
      { label: 'Hours logged in Labor',                done: cd.labor_pct_blended != null || cd.rplh_blended != null, go: 'lc-log-hours' },
      { label: 'Menu items priced with units sold',        done: costedMenu.length >= 4, go: 'r-menu-items' },
      { label: 'Server checks logged',                 done: this._windowedServerCount() >= 3, go: 'r-server-check' },
      { label: 'Events completed',                     done: this._windowedCompletedEvents().length > 0, go: 'ev-dashboard' },
      { label: 'Confirm the week',                     done: cd.check_average != null, go: 'week-close' }
    ];
  },

  onGenerate() { this.generateAudit(); },

  // Shared trailing-4-week window end, mirroring the server (audit-compute.js
  // computeRevenueAudit): winEnd = the last confirmed revenue week's period_end, or ''
  // when no weeks are confirmed yet (each caller applies its own no-weeks fallback).
  /* ⚠⚠ THE AUDIT'S WINDOW, AND IT MIRRORS `server/audit-compute.js` FIELD FOR FIELD (S216).
     The server is the authority and it is unambiguous:
         weeks       = confirmed weeks, oldest -> newest, .slice(-PERIOD_WEEKS)
         _winWeeks   = weeks.length || PERIOD_WEEKS        <- the REAL count, never a constant
         _scWinEnd   = weeks[last].period_end
         _scWinStart = _scWinEnd - (_winWeeks * 7 - 1)     <- inclusive
         AUDIT_PERIOD = "<weeks.length> weeks ending <_scWinEnd>"
     Its own comment records why the count must be real: "A hardcoded PERIOD_WEEKS made these windows
     28 days under an 'N weeks ending ...' heading, so a bar with 2 confirmed weeks had 4 weeks of
     events and server checks summed into figures labelled 2 weeks."
     ⛔ TWO CLIENT WINDOWS WERE STILL MISSING IT, EACH IN ITS OWN WAY: `_windowedServerCount` had the
     right anchor and a hardcoded `-(4*7-1)`, and buildControlData's S4 comp window was anchored to
     TODAY over a fixed 28 days — so `server_comp_pct` was measured over a period that need not
     overlap the heading at all. Measured on a bar with 2 confirmed weeks ending 15 days ago: the
     comp rate read 10.0% against a truth of 5.0% for the period it was reported under.
     ⭐ ONE helper, both readers, so they cannot drift apart again. A figure measured over a
     different window is not a worse figure — it is a figure about something else. */
  _auditWindow() {
    const weeks = (App.data.revenue_weeks || [])
      .filter(w => w && (((+w.bar_revenue || 0) + (+w.floor_revenue || 0)) > 0 || (+w.total_revenue || 0) > 0))
      .sort((a, b) => String(a.period_end || a.week_end || '').localeCompare(String(b.period_end || b.week_end || '')))
      .slice(-4);   // PERIOD_WEEKS on the server
    if (!weeks.length) return { start: '', end: '', weeks: 0 };
    const end = String(weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end || '').slice(0, 10);
    if (!end) return { start: '', end: '', weeks: 0 };
    return { start: this._shiftYmdUTC(end, -(weeks.length * 7 - 1)), end, weeks: weeks.length };
  },
  _shiftYmdUTC(ymd, days) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); },

  // Mirror the server's S5 window: the audit only scores events that are COMPLETED and
  // fall inside the trailing 4-week window, never all-time. Readiness must test the same,
  // or the badge promises "Full data" while the run returns "Partial" (a completed event
  // outside the window is not scorable).
  _windowedCompletedEvents() {
    const completed = (App.data.bookings || []).filter(e => e && e.stage === 'Completed');
    if (!completed.length) return [];
    const evDate = e => String(e.event_date || '').slice(0, 10);
    /* ⚠ THE THIRD WINDOW WITH THE HARDCODED FOUR (S216) — found by the detector, not by reading.
       The server's S5 spans `_winWeeks * 7 - 1` where `_winWeeks = weeks.length || PERIOD_WEEKS`,
       so with 2 confirmed weeks this counted completed events over 28 days while the run scored 14.
       Same shape as `_windowedServerCount`, one function away, and I only looked at the two I had
       already named. `win.weeks || 4` mirrors the server's fallback exactly. */
    const win = this._auditWindow();
    const winEnd = win.end || (completed.map(evDate).filter(Boolean).sort().slice(-1)[0] || '');   // no weeks yet: anchor on the latest event, same as the server
    const winStart = winEnd ? this._shiftYmdUTC(winEnd, -((win.weeks || 4) * 7 - 1)) : '';
    return (winStart && winEnd)
      ? completed.filter(e => { const d = evDate(e); return d && d >= winStart && d <= winEnd; })
      : completed;
  },

  // Mirror the server's S4 window: server checks are windowed to the same trailing 4 weeks,
  // then grouped by SERVER; the spread scores only with >=3 distinct servers. Readiness
  // counted ALL-TIME rows before, so it projected "ready/Full" while the run scored S4 N/A
  // (e.g. 3+ checks all older than the window with no recent comp data). Returns distinct
  // servers with covers in the window, matching what the server groups.
  _windowedServerCount() {
    const checks = (App.data.revenue_server_checks || []).filter(c => c && (+(c.covers) || 0) > 0 && c.sales != null && !isNaN(+c.sales));
    if (!checks.length) return 0;
    // ⚠ THE REAL WEEK COUNT, not a hardcoded four (S216). Readiness exists to predict whether S4
    // will score, so counting servers over 28 days when the run scores 14 makes the badge promise
    // something the run then refuses — the exact mismatch the comment above says it fixed.
    const win = this._auditWindow();
    const winEnd = win.end, winStart = win.start;
    const windowed = (winStart && winEnd)
      ? checks.filter(c => { const d = String(c.date || '').slice(0, 10); return d && d >= winStart && d <= winEnd; })
      : checks;   // no closed weeks yet: use every check, same as the server
    const servers = new Set();
    windowed.forEach(c => { const k = c.staff_id || c.server_name || c.server || c.name; if (k) servers.add(k); });
    return servers.size;
  },

  // One boolean per scored section = whether Bar Cop can score it now. Drives the
  // projected data badge so it matches what a run would produce.
  _sectionsReady() {
    const cd = this.buildControlData() || {};
    const costedMenu = this._costedMenu();
    return [
      cd.check_average != null,                                             // S1 Check Average
      cd.labor_pct_blended != null || cd.rplh_blended != null,              // S2 Labor
      costedMenu.length >= 4,                                               // S3 Menu
      this._windowedServerCount() >= 3 || cd.server_comp_pct != null,       // S4 Server (windowed + >=3 distinct servers, mirrors the server)
      this._windowedCompletedEvents().length > 0                            // S5 Events (windowed, mirrors the server)
    ];
  },

  viewAudit(idx) {
    const audits = (App.data.revenue_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;
    this._view = idx;

    // Header off (in _CONVERTED): no topbar Back/Save PDF. Back is the sidebar
    // nav; PDF export lives in the Action Items row next to Bar Cop Briefing.
    this.actions.innerHTML = '';


    const d = audit.raw || audit;
    const pct = v => v != null ? v + '%' : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null ? String(v) : '';
    const yN  = v => v === true ? 'Yes' : v === false ? 'No' : '';

    const sections = [
      AuditUI.sectionBlock(1, 'Check Average and Revenue', d.S1_SCORE, [
        ['Blended Check Average',        cur(d.S1_CHECK_AVG), d.S1_CHECK_AVG < d.S1_CHECK_AVG_TARGET ? 'warn' : 'good'],
        ['Check Average Target',         cur(d.S1_CHECK_AVG_TARGET)],
        ['Bar Check Average',            cur(d.S1_BAR_CHECK_AVG)],
        ['Food Check Average',           cur(d.S1_FOOD_CHECK_AVG)],
        ['Monthly Cover Count',          num(d.S1_COVER_COUNT)],
        ['Monthly Revenue',              cur(d.S1_MONTHLY_REVENUE)],
        ['Monthly Gap vs Target',        cur(d.S1_MONTHLY_GAP), d.S1_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',                   cur(d.S1_ANNUAL_GAP),  d.S1_ANNUAL_GAP  > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(2, 'Labor Efficiency', d.S2_SCORE, [
        ['Total Labor %',                pct(d.S2_LABOR_PCT), d.S2_LABOR_PCT > 35 ? 'warn' : 'good'],
        ['Labor Target %',               pct(d.S2_LABOR_TARGET_PCT)],
        ['RPLH',                         cur(d.S2_RPLH)],
        ['RPLH Target',                  cur(d.S2_RPLH_TARGET)],
        ['Total Labor Period',           cur(d.S2_LABOR_PERIOD)],
        ['Monthly Labor Gap',            cur(d.S2_MONTHLY_GAP), d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(3, 'Menu Performance', d.S3_SCORE, [
        ['Dishes Scored',                d.S3_MENU_SCORED != null ? d.S3_MENU_SCORED + ' of ' + (d.S3_MENU_TOTAL || d.S3_MENU_SCORED) : ''],
        ['Stars on Menu',                num(d.S3_STARS_COUNT)],
        ['Plowhorses on Menu',           num(d.S3_PLOWHORSES_COUNT)],
        ['Dogs on Menu',                 num(d.S3_DOGS_COUNT), d.S3_DOGS_COUNT > 3 ? 'warn' : ''],
        ['Puzzles on Menu',              num(d.S3_PUZZLES_COUNT)],
        ['Top Category by Revenue',      d.S3_TOP_CATEGORY || ''],
        ['Last Price Increase',          d.S3_LAST_PRICE_INCREASE || '', d.S3_PRICING_STALE === true ? 'warn' : (d.S3_PRICING_STALE === false ? 'good' : '')],
        ['Dog Tests Running',            d.S3_DOG_TESTS_ACTIVE != null ? num(d.S3_DOG_TESTS_ACTIVE) : ''],
      ], null, d),
      AuditUI.sectionBlock(4, 'Server Performance', d.S4_SCORE, [
        ['Servers Analyzed',             num(d.S4_SERVER_COUNT)],
        ['Top Server Check Average',     cur(d.S4_TOP_CHECK_AVG)],
        ['Bottom Server Check Average',  cur(d.S4_BOTTOM_CHECK_AVG)],
        ['Team Check Average',           cur(d.S4_TEAM_CHECK_AVG)],
        ['Performance Spread',           cur(d.S4_PERFORMANCE_SPREAD), d.S4_PERFORMANCE_SPREAD > 5 ? 'warn' : ''],
        ['Comp % of Sales',              d.S4_COMP_PCT != null ? d.S4_COMP_PCT + '%' + (d.S4_COMP_BENCHMARK_PCT != null ? ' (Benchmark: under ' + d.S4_COMP_BENCHMARK_PCT + '%)' : '') : '', (d.S4_COMP_PCT != null && d.S4_COMP_BENCHMARK_PCT != null && d.S4_COMP_PCT > d.S4_COMP_BENCHMARK_PCT) ? 'warn' : ''],
        ['Monthly Gap from Spread',      cur(d.S4_MONTHLY_GAP), d.S4_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(5, 'Events and Private Dining', d.S5_SCORE, [
        ['Event Revenue Period',         cur(d.S5_EVENT_REV_PERIOD)],
        ['Events per Month',             num(d.S5_EVENTS_PER_MONTH)],
        ['Average Event Revenue',        cur(d.S5_AVG_EVENT_REVENUE)],
        ['Private Dining Minimum Met',   d.S5_MINIMUM_MET || ''],
        ['Monthly Gap',                  cur(d.S5_MONTHLY_GAP), d.S5_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
    ].join('');

    this.container.innerHTML = '<div class="screen" id="ra-audit-view">'
      + AuditUI.viewHero(audit, 'Revenue Audit', 'ra', 5)
      + AuditUI.recoverStrip(audit)
      + AuditUI.actionsArea(audit, 'revenue', 'ra')
      + sections
      + '</div>';

    AuditUI.attachOutlook('ra', audit, 'revenue');
    this.container.querySelector('.ra-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.ra-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gap = btn.dataset.gap;
        // Events is its own section now (dropped from the Revenue Fix rail), so
        // the Events and Private Dining action jumps to the Events booking
        // pipeline instead of falling back to the first Fix system.
        if (gap === 'events-catering') { App.openScreen('ev-bookings'); return; }
        App._fixFocus = gap; App.navigate('r-fix');
      });
    });
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings render inline under each section via findingsBlock() in viewAudit().

  // ── Data-driven PDF export ────────────────────────────────────────────────
  // Rebuilds the on-screen Revenue Audit from data via App._pdfBuilder (no
  // window.print, no DOM walk). Mirrors viewAudit(): overall score header, the
  // five scored sections + Operational Risk Signals, each section's metric rows
  // and inline Findings, ranked action items, ending with the canonical legal
  // disclaimer (App.deliverableFooter().disclaimerLines, verbatim).
  async exportPDF(audit) {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const d = audit.raw || audit;
    // Null is "not enough data", never 0: `|| 0` printed "Score 0 (Critical)" in the
    // exported PDF for an audit the screen correctly showed as N/A. Same leak the Profit
    // Audit export had.
    const overall = audit.overall_score;
    const overallTxt = overall == null ? 'N/A' : String(overall);
    const overallBand = overall == null ? 'Not enough data yet' : App.scoreLabel(overall);

    // Formatters mirror viewAudit() exactly.
    const pct = v => v != null ? v + '%' : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null ? String(v) : '';
    const yN  = v => v === true ? 'Yes' : v === false ? 'No' : '';

    const period = [audit.audit_period, audit.audit_id].filter(Boolean).map(x => String(x)).join('  ·  ');
    const metaBits = [(audit.date || '').slice(0, 10) || App._pdfDateStamp(), 'Score ' + overallTxt + ' (' + overallBand + ')'];
    if (period) metaBits.push(period);

    const b = App._pdfBuilder('Revenue Audit');
    b.header({ right: 'Revenue Audit', meta: metaBits.join('   ·   ') });
    b.kv('Bar', audit.bar_name || App.data.settings.bar_name || 'Your Bar');
    b.kv('Revenue Score', overall == null ? 'N/A  (Not enough data yet)' : (overall + ' of 100  (' + overallBand + ')'));
    const dq = AuditUI.dataQualityLabel(audit, 5);
    if (dq) b.kv('Data Quality', dq);
    b.kv('Target', String(d.TARGET_SCORE || 70));

    // Ranked action items (same source + ordering as the screen).
    const actionItems = audit.action_items || [];
    if (actionItems.length) {
      b.sectionTitle('Action Items, Ranked by Impact');
      b.table(['#', 'Action', 'Monthly Opportunity'], actionItems.map((a, i) => [
        String(i + 1),
        a.action || a || '',
        a.monthly_impact ? '+' + App.fmtCurrency(a.monthly_impact) : ''
      ]), { columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 110 } } });
      const totalMonthly = actionItems.reduce((s, a) => s + (a.monthly_impact || 0), 0);
      if (totalMonthly > 0) {
        b.kv('Total Recoverable Per Month', App.fmtCurrency(totalMonthly));
        b.kv('Annualized', App.fmtCurrency(totalMonthly * 12));
      }
    }

    // Findings text per section (matches findingsBlock in viewAudit).
    const findingsText = (n) => {
      if (n === 6) return [];
      return ['S' + n + '_EVIDENCE', 'S' + n + '_GAP', 'S' + n + '_TOOL', 'S' + n + '_NARRATIVE', 'S' + n + '_FINDING']
        .map(f => d[f]).filter(v => v && String(v).trim());
    };

    // One section: title with its score, metric rows, then findings paragraphs.
    const section = (n, name, score, rows) => {
      const scoreTxt = score != null ? String(score) : 'N/A (Not enough data)';
      b.sectionTitle('Section ' + n + '  ·  ' + name + '  ·  Score ' + scoreTxt);
      const body = rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, val]) => [label, val]);
      if (body.length) b.table(null, body, { columnStyles: { 0: { cellWidth: 200, fontStyle: 'bold' } } });
      const finds = findingsText(n);
      if (finds.length) { b.heading('Findings', 10); finds.forEach(t => b.paragraph(t)); }
    };

    section(1, 'Check Average and Revenue', d.S1_SCORE, [
      ['Blended Check Average',        cur(d.S1_CHECK_AVG)],
      ['Check Average Target',         cur(d.S1_CHECK_AVG_TARGET)],
      ['Bar Check Average',            cur(d.S1_BAR_CHECK_AVG)],
      ['Food Check Average',           cur(d.S1_FOOD_CHECK_AVG)],
      ['Monthly Cover Count',          num(d.S1_COVER_COUNT)],
      ['Monthly Revenue',              cur(d.S1_MONTHLY_REVENUE)],
      ['Monthly Gap vs Target',        cur(d.S1_MONTHLY_GAP)],
      ['Annual Gap',                   cur(d.S1_ANNUAL_GAP)],
    ]);
    section(2, 'Labor Efficiency', d.S2_SCORE, [
      ['Total Labor %',                pct(d.S2_LABOR_PCT)],
      ['Labor Target %',               pct(d.S2_LABOR_TARGET_PCT)],
      ['RPLH',                         cur(d.S2_RPLH)],
      ['RPLH Target',                  cur(d.S2_RPLH_TARGET)],
      ['Total Labor Period',           cur(d.S2_LABOR_PERIOD)],
      ['Monthly Labor Gap',            cur(d.S2_MONTHLY_GAP)],
    ]);
    section(3, 'Menu Performance', d.S3_SCORE, [
      ['Dishes Scored',                d.S3_MENU_SCORED != null ? d.S3_MENU_SCORED + ' of ' + (d.S3_MENU_TOTAL || d.S3_MENU_SCORED) : ''],
      ['Stars on Menu',                num(d.S3_STARS_COUNT)],
      ['Plowhorses on Menu',           num(d.S3_PLOWHORSES_COUNT)],
      ['Dogs on Menu',                 num(d.S3_DOGS_COUNT)],
      ['Puzzles on Menu',              num(d.S3_PUZZLES_COUNT)],
      ['Top Category by Revenue',      d.S3_TOP_CATEGORY || ''],
      ['Last Price Increase',          d.S3_LAST_PRICE_INCREASE || ''],
      ['Dog Tests Running',            d.S3_DOG_TESTS_ACTIVE != null ? num(d.S3_DOG_TESTS_ACTIVE) : ''],
    ]);
    section(4, 'Server Performance', d.S4_SCORE, [
      ['Servers Analyzed',             num(d.S4_SERVER_COUNT)],
      ['Top Server Check Average',     cur(d.S4_TOP_CHECK_AVG)],
      ['Bottom Server Check Average',  cur(d.S4_BOTTOM_CHECK_AVG)],
      ['Team Check Average',           cur(d.S4_TEAM_CHECK_AVG)],
      ['Performance Spread',           cur(d.S4_PERFORMANCE_SPREAD)],
      ['Comp % of Sales',              d.S4_COMP_PCT != null ? d.S4_COMP_PCT + '%' + (d.S4_COMP_BENCHMARK_PCT != null ? ' (Benchmark: under ' + d.S4_COMP_BENCHMARK_PCT + '%)' : '') : ''],
      ['Monthly Gap from Spread',      cur(d.S4_MONTHLY_GAP)],
    ]);
    section(5, 'Events and Private Dining', d.S5_SCORE, [
      ['Event Revenue Period',         cur(d.S5_EVENT_REV_PERIOD)],
      ['Events per Month',             num(d.S5_EVENTS_PER_MONTH)],
      ['Average Event Revenue',        cur(d.S5_AVG_EVENT_REVENUE)],
      ['Private Dining Minimum Met',   d.S5_MINIMUM_MET || ''],
      ['Monthly Gap',                  cur(d.S5_MONTHLY_GAP)],
    ]);

    b.disclaimer(App.deliverableFooter().disclaimerLines.join(' '));

    const stamp = /^\d{4}-\d{2}-\d{2}/.test(audit.date || '') ? audit.date.slice(0, 10).replace(/-/g, '') : App._pdfDateStamp();
    await b.save(App.pdfFileName('Revenue Audit', stamp));
  },


  showHowTo() {
    App.showHelpModal('How the Revenue Audit Works', [
      { p: ['The Revenue Audit scores five areas: Check Average, Labor Efficiency, Menu Performance, Server Performance, and Events. It scores whatever data it can see and shows N/A for anything it cannot.'] },
      { h: 'What Bar Cop reads', p: ['The audit runs off data you already keep, so there is no form to fill in. Your weekly numbers, schedules, menu items, and servers feed it automatically. Your sales come from the weeks you close, and until the first one is in Bar Cop asks once for last week\'s bar and food sales so the score has real numbers to work from. There are no questions to answer, nothing self-reported. Every score is measured, so no one can talk the number up by claiming a practice the data does not back.'] },
      { h: 'The readiness checklist', p: ['Before you generate, the top card shows what the audit reads and checks off each slice you already have: hours logged, menu items priced with units sold, server checks logged, events booked, and the week confirmed. Any row you are missing taps through to the step that fills it. You can still run with gaps, they just read N/A, so the checklist is a heads-up, not a lock.'] },
      { h: 'The steps', p: ['1. Get your week in: confirm the week in Close The Week and log your Control data. 2. Generate. If no week is closed yet, enter last week\'s bar and food sales when Bar Cop asks. Sections with no data show N/A and fill in over time.'] },
      { h: 'Reading your results', p: ['Generate gives you a scored breakdown: an overall score up top, a score for each of the five areas (N/A where there is no data yet), and a Recoverable Per Month figure with its annualized number. Below that sit your Action Items, ranked by dollar impact, each with a Fix This button that drops you into Revenue Fix on that exact gap; an events item sends you to Event Booking instead. Bar Cop Briefing is a short written read of where you stand, and Export PDF saves the whole audit. Run it whenever you want a fresh read; it scores your trailing four weeks, and Bar Cop keeps one record a day so you can watch the score trend on the audit landing.'] },
      { h: 'The honest rule', p: ['Cost savings (labor) and revenue growth (check average, menu, servers, events) are kept separate, never blended into one number. Every figure is computed in code from your real data.'] }
    ]);
  },

  async generateAudit() {
    const btn      = document.getElementById('ra-gen-btn');
    const statusEl = document.getElementById('ra-gen-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    const resetBtn = () => { if (btn) { btn.disabled=false; btn.textContent='Generate New Audit'; btn.style.opacity=''; } };
    if (btn) { btn.disabled=true; btn.textContent='Analyzing...'; btn.style.opacity='0.7'; }

    // Sales come from your closed weeks. Until the first one is in, prompt once
    // for a weekly sales estimate (keyed to this week) so the first audit still
    // sizes its dollars off real numbers. A real POS week supersedes it.
    const hasWeeks = !!(App.data.revenue_weeks && App.data.revenue_weeks.length > 0);
    if (!hasWeeks && !AuditUI.weekSalesEstimate()) {
      resetBtn();
      AuditUI.promptWeekSales(() => this.generateAudit());
      return;
    }


    try {
      // Honest-by-construction: the audit scores solely on what Bar Cop measures
      // from real data (weekly numbers, schedules, menu, servers, events). No
      // self-reported operating practices feed the score, so the number an owner
      // relies on cannot be inflated by a claim the data does not back up.
      const auditAppData = JSON.parse(JSON.stringify(App.data));
      // ⚠ Ship the LIVE cost (S106). The deep copy above carries each dish's save-time snapshot,
      // which the server has no way to refresh. Replacing it here costs nothing, changes nothing
      // stored, and leaves the server's filter exactly as it was.
      auditAppData.menu_items = this._auditMenuItems();

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));

      const res  = await fetch('/api/generate-revenue-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      const d = data.auditData || {};

      // Estimate-only, no real data → nothing real to score. Record it N/A (overall
      // null) like the Cash and Bar Cop audits, so it never shows a score, counts as
      // a run, or flips the Hub / Close-the-Week off a guess. A real week supersedes it.
      const noData = AuditUI.projectedQuality(this._sectionsReady()).none;

      const auditRecord = {
        id:            App.uid(),
        date:          App.todayLocal(),
        bar_name:      d.BAR_NAME || App.data.settings?.bar_name || '',
        // Null in, null through: `|| 0` would turn the server's honest "no score" into
        // a fabricated 0. Same reason as the profit audit.
        overall_score: (noData || d.OVERALL_SCORE == null) ? null : d.OVERALL_SCORE,
        grade:         d.DATA_TIER_LABEL || '',
        audit_period:  d.AUDIT_PERIOD || '',
        audit_id:      d.AUDIT_ID || '',
        sections:      this.extractSections(d),
        action_items:  this.extractActionItems(d),
        raw:           d,
        generated_at:  new Date().toISOString()
      };

      // Row-per-record in core_events now; full audit history retained (the old
      // 12-audit blob cap is gone) and paged via "Show older" on the list.
      App.dedupeAuditToday(App.data.revenue_audits, auditRecord);
      await App.putRecord('core', 'revenue_audit', auditRecord);
      if (!noData) App.markSetupDone('gs_r_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      resetBtn();
    }
  },


  extractSections(d) {
    const s = {};
    if (d.S1_SCORE != null) s['Check Average and Revenue'] = d.S1_SCORE;
    if (d.S2_SCORE != null) s['Labor Efficiency']          = d.S2_SCORE;
    if (d.S3_SCORE != null) s['Menu Performance']          = d.S3_SCORE;
    if (d.S4_SCORE != null) s['Server Performance']        = d.S4_SCORE;
    if (d.S5_SCORE != null) s['Events and Private Dining'] = d.S5_SCORE;
    return s;
  },

  extractActionItems(d) {
    const items = [];
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Close check average gap. $' + Math.round(d.S1_MONTHLY_GAP) + '/month at current cover count.', monthly_impact: d.S1_MONTHLY_GAP, gap_id: 'check-average' });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Reduce labor cost. $' + Math.round(d.S2_MONTHLY_GAP) + '/month over target.', monthly_impact: d.S2_MONTHLY_GAP, gap_id: 'labor-scheduling' });
    // Menu: Dogs and stale pricing route to Menu Engineering. Repricing recency is
    // read from the price-change log now, not a self-report. No fabricated dollar.
    if (d.S3_DOGS_COUNT > 3) items.push({ action: 'Cut the dead weight on the menu. ' + d.S3_DOGS_COUNT + ' Dogs are running low margin and low volume. Reprice or Dog Test them in Menu Engineering before they eat the mix.', monthly_impact: 0, gap_id: 'menu-engineering' });
    if (d.S3_PRICING_STALE === true) items.push({ action: 'Reprice the menu. Your last price increase was ' + (d.S3_LAST_PRICE_INCREASE ? d.S3_LAST_PRICE_INCREASE.toLowerCase() : 'over a year ago') + '. Inflation has quietly eaten the margin on every plate since then. Reprice to target in Menu Engineering.', monthly_impact: 0, gap_id: 'menu-engineering' });
    if (d.S4_MONTHLY_GAP > 0) items.push({ action: 'Close server performance spread. $' + Math.round(d.S4_MONTHLY_GAP) + '/month from bottom third to team average.', monthly_impact: d.S4_MONTHLY_GAP, gap_id: 'server-performance' });
    // Comp discipline routes to Server Check, no separate dollar.
    if (d.S4_COMP_PCT != null && d.S4_COMP_BENCHMARK_PCT != null && d.S4_COMP_PCT > d.S4_COMP_BENCHMARK_PCT) items.push({ action: 'Tighten comp discipline. Comps are ' + d.S4_COMP_PCT + '% of server sales against an under-' + d.S4_COMP_BENCHMARK_PCT + '% benchmark. Watch the comp rate by server in Server Check.', monthly_impact: 0, gap_id: 'server-performance' });
    if (d.S5_MONTHLY_GAP > 0) items.push({ action: 'Grow event revenue. $' + Math.round(d.S5_MONTHLY_GAP) + '/month gap to target.', monthly_impact: d.S5_MONTHLY_GAP, gap_id: 'events-catering' });
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  },

  /* Verified Control-module data sent with the audit as ground truth (map
     Section 8 — Revenue labor and server roster come from Labor Control).
     Each slice appears only when its data exists, so the server never gets a
     fabricated figure. Returns null when no Control data is available. */
  buildControlData() {
    const lab = App.laborData || {};
    const r1  = n => (n == null || isNaN(n)) ? null : Math.round(n * 10) / 10;
    const cd  = { sources: [] };

    // Confirmed weekly labor and check average. Per Stage E the weekly labor
    // figure is fed from Labor Control and revenue/covers from Shift Control,
    // so the confirmed week is verified Control data.
    const weeks = (App.data.revenue_weeks || [])
      .filter(w => (w.bar_revenue||0) + (w.floor_revenue||0) > 0)
      .slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-4);
    if (weeks.length) {
      const avg = fn => { const v = weeks.map(fn).filter(x => x != null && !isNaN(x));
        return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
      const lp = r1(avg(w => w.labor_pct_blended));
      const rp = r1(avg(w => w.rplh_blended));
      const ca = r1(avg(w => w.check_avg));
      if (lp != null) cd.labor_pct_blended = lp;
      if (rp != null) cd.rplh_blended = rp;
      if (ca != null) cd.check_average = ca;
      if (lp != null || rp != null) cd.sources.push('Labor Control (confirmed weekly labor)');
    }

    // Labor Control — raw actual hours and cost, WINDOWED to the audit's trailing
    // 4-week period. Summing all-time labor against a 4-week revenue base printed a
    // "Total Labor Period" that grew with account age (and could exceed revenue).
    let winStart, winEnd;
    if (weeks.length) {
      winStart = App.weekStartFor(weeks[0].period_end);
      winEnd   = weeks[weeks.length - 1].period_end;
    } else {
      const allD = (lab.lc_actuals || []).map(a => a.date).filter(Boolean).sort();
      winEnd = allD.length ? allD[allD.length - 1] : App.todayLocal();
      const s = new Date(winEnd + 'T00:00:00'); s.setDate(s.getDate() - 27); winStart = App.ymdLocal(s);
    }
    const actuals = (lab.lc_actuals || []).filter(a => a && a.date && a.date >= winStart && a.date <= winEnd);
    if (actuals.length) {
      cd.labor_hours = r1(actuals.reduce((s,a) => s + (a.hours || 0), 0));
      let laborCost = actuals.reduce((s,a) => s + ((a.hours || 0) * (a.wage || 0)), 0);
      // lc_actuals hold straight time only. Add the weekly overtime premium here too,
      // or Total Labor Period contradicts labor_pct_blended (which is OT-inclusive,
      // coming off the saved revenue_weeks) inside the same audit.
      laborCost += App.otPremiumForRows ? App.otPremiumForRows(actuals).total : 0;
      // Fixed salaried (exempt) cost over the SAME window, not the whole history.
      laborCost += App.salariedCost(winStart, winEnd).total;
      cd.labor_cost = Math.round(laborCost);
      cd.sources.push('Labor Control actuals');
    }

    /* Server comp discipline (Revenue S4): comps as a % of server sales. Server sales come from the
       Server Check log, comps from Shift Control's void/comp log. Fed as one team rate the audit grades.
       ⚠⚠ IT IS MEASURED OVER THE AUDIT'S OWN WINDOW, NOT A TRAILING 28 DAYS FROM TODAY (S216).
       This used to anchor on today over a fixed four weeks, while every other S4 figure — and the
       AUDIT_PERIOD heading printed above them — anchors on the last CONFIRMED week and spans as many
       weeks as are actually confirmed. Those need not overlap at all: measured on a bar with 2
       confirmed weeks ending 15 days ago, the rate read **10.0% against a truth of 5.0%** for the
       period it was reported under, because it was counting the in-progress week's comps.
       `_auditWindow` is the one implementation and mirrors server/audit-compute.js field for field.
       ⚠⚠ AND IT KEEPS S215b's UPPER BOUND. With confirmed weeks the window ends at the last one, so
       a future-dated row is already out. With NONE, the server's own fallback is "score every check
       on file" — matched here, except still bounded at today, because one mistyped year in the
       DENOMINATOR pushes this rate DOWN and makes comp discipline look healthier than it is. This
       figure is produced solely by the client, so bounding it cannot put the two out of step. */
    const auditWin = this._auditWindow();
    const todayStr = App.todayLocal ? App.todayLocal() : '9999-12-31';
    const inWin = auditWin.end
      ? (d => { const s = String(d || '').slice(0, 10); return s >= auditWin.start && s <= auditWin.end; })
      : (d => { const s = String(d || '').slice(0, 10); return !!s && s <= todayStr; });
    const checks = (App.data.revenue_server_checks || []).filter(c => inWin(c.date));
    if (checks.length) {
      const serverSales = checks.reduce((s, c) => s + (parseFloat(c.sales) || 0), 0);
      /* ⚠⚠ S220's SECOND CONSUMER, AND THIS ONE FEEDS A SCORE (step 0.6). The scorecard's Comps %
         one screen over had the identical shape: comps from the WHOLE window divided by sales from
         only the days that actually have a server check. The Void/Comp log and the Server Check log
         are filled in by different people at different times, so being out of step is the ordinary
         state. Measured on this rate — same comping, same nights worked, only the number of nights
         ENTERED changing: 5.0% with five nights logged, 8.3% with three, 25.0% with one. The audit
         then grades "server comp discipline" on how much bookkeeping got done, which is not what it
         claims to measure.
         This is a TEAM rate, so the honest restriction is by DATE (the scorecard's is per server).
         Comps on a day with no server sales have no denominator and cannot be expressed as a rate. */
      const checkDays = new Set(checks.map(c => String(c.date || '').slice(0, 10)));
      const comps = ((App.shiftData && App.shiftData.sc_void_comps) || [])
        .filter(r => r.type === 'Comp' && App.compReasonIsLoss(r.reason || r.category) && inWin(r.date)
                  && checkDays.has(String(r.date || '').slice(0, 10)));   // give-aways only; excludes Staff Meal/Shift Drink so S4 doesn't fire a false "tighten comp discipline" flag; same bounded window as the sales side, or the rate is a ratio of two different periods
      const compTotal = comps.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
      if (serverSales > 0) {
        cd.server_comp_total = Math.round(compTotal);
        cd.server_comp_pct = r1((compTotal / serverSales) * 100);
        cd.sources.push('Server Check log');
      }
    }

    return cd.sources.length ? cd : null;
  }
};
