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

  _readinessSteps() {
    const cd = this.buildControlData() || {};
    const costedMenu = (App.data.menu_items || []).filter(i => i.price != null && i.cost != null && i.weekly_covers != null);
    return [
      { label: 'Hours logged in Labor',                done: cd.labor_pct_blended != null || cd.rplh_blended != null, go: 'lc-log-hours' },
      { label: 'Menu items priced with units sold',        done: costedMenu.length >= 4, go: 'r-menu-items' },
      { label: 'Server checks logged',                 done: (App.data.revenue_server_checks || []).length >= 3, go: 'r-server-check' },
      { label: 'Events booked',                        done: (App.data.bookings || []).length > 0, go: 'ev-dashboard' },
      { label: 'Confirm the week',                     done: cd.check_average != null, go: 'r-dashboard' }
    ];
  },

  onGenerate() { this.generateAudit(); },

  // One boolean per scored section = whether Bar Cop can score it now. Drives the
  // projected data badge so it matches what a run would produce.
  _sectionsReady() {
    const cd = this.buildControlData() || {};
    const costedMenu = (App.data.menu_items || []).filter(i => i.price != null && i.cost != null && i.weekly_covers != null);
    const events = (App.data.bookings || []).filter(e => e && e.stage === 'Completed');
    return [
      cd.check_average != null,                                             // S1 Check Average
      cd.labor_pct_blended != null || cd.rplh_blended != null,              // S2 Labor
      costedMenu.length >= 4,                                               // S3 Menu
      (App.data.revenue_server_checks || []).length >= 3 || cd.server_comp_pct != null,  // S4 Server
      events.length > 0                                                     // S5 Events
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
    const overall = audit.overall_score || 0;

    // Formatters mirror viewAudit() exactly.
    const pct = v => v != null ? v + '%' : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null ? String(v) : '';
    const yN  = v => v === true ? 'Yes' : v === false ? 'No' : '';

    const period = [audit.audit_period, audit.audit_id].filter(Boolean).map(x => String(x)).join('  ·  ');
    const metaBits = [(audit.date || '').slice(0, 10) || App._pdfDateStamp(), 'Score ' + overall + ' (' + App.scoreLabel(overall) + ')'];
    if (period) metaBits.push(period);

    const b = App._pdfBuilder('Revenue Audit');
    b.header({ right: 'Revenue Audit', meta: metaBits.join('   ·   ') });
    b.kv('Bar', audit.bar_name || App.data.settings.bar_name || 'Your Bar');
    b.kv('Revenue Score', overall + ' of 100  (' + App.scoreLabel(overall) + ')');
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
    await b.save('BarCop_RevenueAudit_' + stamp + '.pdf');
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

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));

      const res  = await fetch('/api/generate-revenue-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      const d = data.auditData || {};

      const auditRecord = {
        id:            App.uid(),
        date:          App.todayLocal(),
        bar_name:      d.BAR_NAME || App.data.settings?.bar_name || '',
        overall_score: d.OVERALL_SCORE || 0,
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
      App.markSetupDone('gs_r_audit');

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

    // Labor Control — raw actual hours and cost
    const actuals = lab.lc_actuals || [];
    if (actuals.length) {
      cd.labor_hours = r1(actuals.reduce((s,a) => s + (a.hours || 0), 0));
      let laborCost = actuals.reduce((s,a) => s + ((a.hours || 0) * (a.wage || 0)), 0);
      // Add fixed salaried (exempt) cost over the span the actuals cover.
      const dts = actuals.map(a => a.date).filter(Boolean).sort();
      if (dts.length) laborCost += App.salariedCost(dts[0], dts[dts.length - 1]).total;
      cd.labor_cost = Math.round(laborCost);
      cd.sources.push('Labor Control actuals');
    }

    // Server comp discipline (Revenue S4): comps as a % of server sales over the
    // trailing four weeks. Server sales come from the Server Check log, comps from
    // Shift Control's void/comp log. Fed as one team rate the server audit grades.
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = App.ymdLocal ? App.ymdLocal(cutoff) : cutoff.toISOString().slice(0, 10);
    const checks = (App.data.revenue_server_checks || []).filter(c => (c.date || '') >= cutoffStr);
    if (checks.length) {
      const serverSales = checks.reduce((s, c) => s + (parseFloat(c.sales) || 0), 0);
      const comps = ((App.shiftData && App.shiftData.sc_void_comps) || [])
        .filter(r => r.type === 'Comp' && (r.date || '') >= cutoffStr);
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
