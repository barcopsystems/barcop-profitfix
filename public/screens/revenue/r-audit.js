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
    const daysSince = latest && latest.date
      ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = daysSince >= 30;
    const daysLeft = canRun ? 0 : 30 - daysSince;
    const desc = 'Get a new audit every 30 days. Run first audit on day 1.';
    const SECTION_NAMES = ['Check Average and Revenue', 'Labor Efficiency', 'Menu Performance', 'Server Performance', 'Events and Private Dining'];
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.requestCard('ra', 'Revenue Audit', desc, canRun, !!latest, daysLeft)
      + (latest ? AuditUI.landingCard(latest, audits[1], SECTION_NAMES, 'ra') : AuditUI.emptyState())
      + (latest ? AuditUI.scoreChart(audits, 'Revenue Score History') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'revenue_audit', 'ra') : '')
      + '</div>';
    document.getElementById('ra-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.ra-view-btn').forEach(btn =>
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  viewAudit(idx) {
    const audits = (App.data.revenue_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;
    this._view = idx;

    // Header off (in _CONVERTED): no topbar Back/Save PDF. Back is the sidebar
    // nav; PDF export lives in the Action Items row next to Bar Cop Outlook.
    this.actions.innerHTML = '';


    const d = audit.raw || audit;
    const pct = v => v != null ? v + '%' : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null ? String(v) : '';
    const yN  = v => v === true ? 'Yes' : v === false ? 'No' : '';

    const signals6 = [
      {score:d.S6_SIG1_SCORE, label:d.S6_SIG1_LABEL, evidence:d.S6_SIG1_EVIDENCE, gap:d.S6_SIG1_GAP, tool:d.S6_SIG1_TOOL},
      {score:d.S6_SIG2_SCORE, label:d.S6_SIG2_LABEL, evidence:d.S6_SIG2_EVIDENCE, gap:d.S6_SIG2_GAP, tool:d.S6_SIG2_TOOL},
      {score:d.S6_SIG3_SCORE, label:d.S6_SIG3_LABEL, evidence:d.S6_SIG3_EVIDENCE, gap:d.S6_SIG3_GAP, tool:d.S6_SIG3_TOOL},
      {score:d.S6_SIG4_SCORE, label:d.S6_SIG4_LABEL, evidence:d.S6_SIG4_EVIDENCE, gap:d.S6_SIG4_GAP, tool:d.S6_SIG4_TOOL},
    ].filter(s => s.label);

    const sections = [
      AuditUI.sectionBlock(1, 'Check Average and Revenue', d.S1_SCORE, [
        ['Blended Check Average',        cur(d.S1_CHECK_AVG), d.S1_CHECK_AVG < d.S1_CHECK_AVG_TARGET ? 'warn' : 'good'],
        ['Check Average Target',         cur(d.S1_CHECK_AVG_TARGET)],
        ['Bar Check Average',            cur(d.S1_BAR_CHECK_AVG)],
        ['Food Check Average',           cur(d.S1_FOOD_CHECK_AVG)],
        ['Monthly Cover Count',          num(d.S1_COVER_COUNT)],
        ['Beverage Attachment',          d.S1_BEV_PER_COVER != null ? d.S1_BEV_PER_COVER + ' drinks per guest' : '', (d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null && d.S1_BEV_PER_COVER < d.S1_BEV_ATTACH_BENCHMARK) ? 'warn' : (d.S1_BEV_PER_COVER != null ? 'good' : '')],
        ['Attachment Benchmark',         d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null ? d.S1_BEV_ATTACH_BENCHMARK + ' drinks per guest' : ''],
        ['Drinks Sold (period)',         d.S1_BEV_PER_COVER != null ? num(d.S1_BEV_UNITS) : ''],
        ['Checks With a Drink',          d.S1_BEV_INCIDENCE_PCT != null ? d.S1_BEV_INCIDENCE_PCT + '%' : ''],
        ['Weakest Daypart',              d.S1_DAYPART_WEAKEST ? d.S1_DAYPART_WEAKEST + ' at ' + cur(d.S1_DAYPART_WEAKEST_CHECK) : '', d.S1_DAYPART_SPREAD >= 4 ? 'warn' : ''],
        ['Daypart Check Spread',         d.S1_DAYPART_SPREAD != null ? cur(d.S1_DAYPART_SPREAD) + ' (weakest to strongest)' : ''],
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
        ['Scheduled vs Actual Hours',    d.S2_SCHED_VS_ACTUAL || ''],
        ['Overtime Hours',               d.S2_OVERTIME_HRS ? num(d.S2_OVERTIME_HRS) + ' hrs' : ''],
        ['Monthly Labor Gap',            cur(d.S2_MONTHLY_GAP), d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(3, 'Menu Performance', d.S3_SCORE, [
        ['Stars on Menu',                num(d.S3_STARS_COUNT)],
        ['Plowhorses on Menu',           num(d.S3_PLOWHORSES_COUNT)],
        ['Dogs on Menu',                 num(d.S3_DOGS_COUNT), d.S3_DOGS_COUNT > 3 ? 'warn' : ''],
        ['Puzzles on Menu',              num(d.S3_PUZZLES_COUNT)],
        ['Top Category by Revenue',      d.S3_TOP_CATEGORY || ''],
        ['Last Price Increase',          d.S3_LAST_PRICE_INCREASE || '', d.S3_PRICING_STALE === true ? 'warn' : ''],
        ['Menu Mix Gap',                 cur(d.S3_MONTHLY_GAP), d.S3_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Pricing Opportunity',          cur(d.S3_PRICING_OPPORTUNITY)],
      ], null, d),
      AuditUI.sectionBlock(4, 'Server Performance', d.S4_SCORE, [
        ['Server Count Analyzed',        num(d.S4_SERVER_COUNT)],
        ['Top Server Check Average',     cur(d.S4_TOP_CHECK_AVG)],
        ['Bottom Server Check Average',  cur(d.S4_BOTTOM_CHECK_AVG)],
        ['Performance Spread',           cur(d.S4_PERFORMANCE_SPREAD), d.S4_PERFORMANCE_SPREAD > 5 ? 'warn' : ''],
        ['Appetizer Attach Rate',        pct(d.S4_APP_ATTACH_RATE), d.S4_APP_ATTACH_RATE < 30 ? 'warn' : ''],
        ['Dessert Attach Rate',          pct(d.S4_DESSERT_ATTACH_RATE)],
        ['Pre-Shift Briefing',           d.S4_PRESHIFT_BRIEFING || ''],
        ['Monthly Gap from Spread',      cur(d.S4_MONTHLY_GAP), d.S4_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(5, 'Events and Private Dining', d.S5_SCORE, [
        ['Event Revenue Period',         cur(d.S5_EVENT_REV_PERIOD)],
        ['Events per Month',             num(d.S5_EVENTS_PER_MONTH)],
        ['Average Event Revenue',        cur(d.S5_AVG_EVENT_REVENUE)],
        ['Private Dining Minimum Met',   yN(d.S5_MINIMUM_MET)],
        ['Catering Revenue Period',      cur(d.S5_CATERING_REV_PERIOD)],
        ['Annual Event Gap',             cur(d.S5_ANNUAL_EVENT_GAP), d.S5_ANNUAL_EVENT_GAP > 0 ? 'warn' : ''],
        ['Monthly Gap',                  cur(d.S5_MONTHLY_GAP), d.S5_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      ...(signals6.length ? [AuditUI.sectionBlock(6, 'Operational Risk Signals', null, [], signals6, d)] : []),
    ].join('');

    this.container.innerHTML = '<div class="screen" id="ra-audit-view">'
      + AuditUI.viewHero(audit, 'Revenue Recovery Audit', 'ra')
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

    const period = [audit.audit_period, audit.audit_id, audit.grade].filter(Boolean).map(x => String(x)).join('  ·  ');
    const metaBits = [(audit.date || '').slice(0, 10) || App._pdfDateStamp(), 'Score ' + overall + ' (' + App.scoreLabel(overall) + ')'];
    if (period) metaBits.push(period);

    const b = App._pdfBuilder('Revenue Recovery Audit');
    b.header({ right: 'Revenue Recovery Audit', meta: metaBits.join('   ·   ') });
    b.kv('Bar', audit.bar_name || App.data.settings.bar_name || 'Your Bar');
    b.kv('Revenue Score', overall + ' of 100  (' + App.scoreLabel(overall) + ')');
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
      ['Beverage Attachment',          d.S1_BEV_PER_COVER != null ? d.S1_BEV_PER_COVER + ' drinks per guest' : ''],
      ['Attachment Benchmark',         d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null ? d.S1_BEV_ATTACH_BENCHMARK + ' drinks per guest' : ''],
      ['Drinks Sold (period)',         d.S1_BEV_PER_COVER != null ? num(d.S1_BEV_UNITS) : ''],
      ['Checks With a Drink',          d.S1_BEV_INCIDENCE_PCT != null ? d.S1_BEV_INCIDENCE_PCT + '%' : ''],
      ['Weakest Daypart',              d.S1_DAYPART_WEAKEST ? d.S1_DAYPART_WEAKEST + ' at ' + cur(d.S1_DAYPART_WEAKEST_CHECK) : ''],
      ['Daypart Check Spread',         d.S1_DAYPART_SPREAD != null ? cur(d.S1_DAYPART_SPREAD) + ' (weakest to strongest)' : ''],
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
      ['Scheduled vs Actual Hours',    d.S2_SCHED_VS_ACTUAL || ''],
      ['Overtime Hours',               d.S2_OVERTIME_HRS ? num(d.S2_OVERTIME_HRS) + ' hrs' : ''],
      ['Monthly Labor Gap',            cur(d.S2_MONTHLY_GAP)],
    ]);
    section(3, 'Menu Performance', d.S3_SCORE, [
      ['Stars on Menu',                num(d.S3_STARS_COUNT)],
      ['Plowhorses on Menu',           num(d.S3_PLOWHORSES_COUNT)],
      ['Dogs on Menu',                 num(d.S3_DOGS_COUNT)],
      ['Puzzles on Menu',              num(d.S3_PUZZLES_COUNT)],
      ['Top Category by Revenue',      d.S3_TOP_CATEGORY || ''],
      ['Last Price Increase',          d.S3_LAST_PRICE_INCREASE || ''],
      ['Menu Mix Gap',                 cur(d.S3_MONTHLY_GAP)],
      ['Pricing Opportunity',          cur(d.S3_PRICING_OPPORTUNITY)],
    ]);
    section(4, 'Server Performance', d.S4_SCORE, [
      ['Server Count Analyzed',        num(d.S4_SERVER_COUNT)],
      ['Top Server Check Average',     cur(d.S4_TOP_CHECK_AVG)],
      ['Bottom Server Check Average',  cur(d.S4_BOTTOM_CHECK_AVG)],
      ['Performance Spread',           cur(d.S4_PERFORMANCE_SPREAD)],
      ['Appetizer Attach Rate',        pct(d.S4_APP_ATTACH_RATE)],
      ['Dessert Attach Rate',          pct(d.S4_DESSERT_ATTACH_RATE)],
      ['Pre-Shift Briefing',           d.S4_PRESHIFT_BRIEFING || ''],
      ['Monthly Gap from Spread',      cur(d.S4_MONTHLY_GAP)],
    ]);
    section(5, 'Events and Private Dining', d.S5_SCORE, [
      ['Event Revenue Period',         cur(d.S5_EVENT_REV_PERIOD)],
      ['Events per Month',             num(d.S5_EVENTS_PER_MONTH)],
      ['Average Event Revenue',        cur(d.S5_AVG_EVENT_REVENUE)],
      ['Private Dining Minimum Met',   yN(d.S5_MINIMUM_MET)],
      ['Catering Revenue Period',      cur(d.S5_CATERING_REV_PERIOD)],
      ['Annual Event Gap',             cur(d.S5_ANNUAL_EVENT_GAP)],
      ['Monthly Gap',                  cur(d.S5_MONTHLY_GAP)],
    ]);

    // Operational Risk Signals (Section 6) — same source as signals6 on screen.
    const signals6 = [
      { score: d.S6_SIG1_SCORE, label: d.S6_SIG1_LABEL, evidence: d.S6_SIG1_EVIDENCE, gap: d.S6_SIG1_GAP, tool: d.S6_SIG1_TOOL },
      { score: d.S6_SIG2_SCORE, label: d.S6_SIG2_LABEL, evidence: d.S6_SIG2_EVIDENCE, gap: d.S6_SIG2_GAP, tool: d.S6_SIG2_TOOL },
      { score: d.S6_SIG3_SCORE, label: d.S6_SIG3_LABEL, evidence: d.S6_SIG3_EVIDENCE, gap: d.S6_SIG3_GAP, tool: d.S6_SIG3_TOOL },
      { score: d.S6_SIG4_SCORE, label: d.S6_SIG4_LABEL, evidence: d.S6_SIG4_EVIDENCE, gap: d.S6_SIG4_GAP, tool: d.S6_SIG4_TOOL },
    ].filter(s => s.label);
    if (signals6.length) {
      b.sectionTitle('Section 6  ·  Operational Risk Signals');
      signals6.forEach(sig => {
        b.heading((sig.label || '') + (sig.score ? '  [' + String(sig.score).toUpperCase() + ']' : ''), 10);
        if (sig.evidence) b.paragraph(sig.evidence);
        if (sig.gap)      b.paragraph(sig.gap);
        if (sig.tool)     b.paragraph(sig.tool);
      });
    }

    b.disclaimer(App.deliverableFooter().disclaimerLines.join(' '));

    const stamp = /^\d{4}-\d{2}-\d{2}/.test(audit.date || '') ? audit.date.slice(0, 10).replace(/-/g, '') : App._pdfDateStamp();
    await b.save('BarCop_RevenueAudit_' + stamp + '.pdf');
  },

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    // Pre-fill Annual Bar/Food Revenue. Priority: Hub Settings → 12-week
    // revenue_weeks average × 52 → empty. Operator can override.
    const s = App.data?.settings || {};
    let barRev  = s.annual_bar_revenue  != null ? String(s.annual_bar_revenue)  : '';
    let foodRev = s.annual_food_revenue != null ? String(s.annual_food_revenue) : '';
    if (!barRev || !foodRev) {
      const weeks = (App.data?.revenue_weeks || []).slice(-12);
      if (weeks.length >= 1) {
        const avgBar  = weeks.reduce((s, w) => s + (parseFloat(w.bar_revenue)   || 0), 0) / weeks.length;
        const avgFood = weeks.reduce((s, w) => s + (parseFloat(w.floor_revenue) || 0), 0) / weeks.length;
        if (!barRev  && avgBar  > 0) barRev  = String(Math.round(avgBar  * 52));
        if (!foodRev && avgFood > 0) foodRev = String(Math.round(avgFood * 52));
      }
    }
    const p = s.revenue_practices || {};
    const boolStr = v => v === true ? 'true' : v === false ? 'false' : (v || '');
    this._intakeDraft = {
      barRev, foodRev,
      practices: {
        pre_shift:          p.pre_shift || '',
        upsell_standard:    boolStr(p.upsell_standard),
        private_dining_min: boolStr(p.private_dining_min),
        menu_engineered:    boolStr(p.menu_engineered),
        last_price_increase: p.last_price_increase || '',
        labor_to_forecast:  boolStr(p.labor_to_forecast)
      }
    };
    this.actions.innerHTML = '';
    this.renderIntake();
  },

  // Single-page Revenue intake (replaces the 6-step wizard). Mirrors the Profit
  // pattern: revenue baseline + "what Bar Cop already has" + code-mapped upload
  // slots + practice questions (Select Answer = no score impact), no notes.
  renderIntake() {
    const d = this._intakeDraft || {};
    document.getElementById('topbar-sub').textContent = '';
    // Form viewable anytime; the 30-day window gates only Generate.
    const _a = (App.data.revenue_audits || []).slice().sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    const _since = _a[0] && _a[0].date ? Math.floor((Date.now() - new Date(_a[0].date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = _since >= 30;
    const daysLeft = canRun ? 0 : 30 - _since;

    const cd = this.buildControlData();
    const costedMenu = (App.data.menu_items || []).filter(i => i.price != null && i.cost != null && i.weekly_covers != null);
    const checks = [
      { label: 'Check Average',  ok: cd && cd.check_average != null },
      { label: 'Labor and RPLH', ok: cd && (cd.labor_pct_blended != null || cd.rplh_blended != null) },
      { label: 'Menu Mix',       ok: costedMenu.length >= 4 },
      { label: 'Server Spread',  ok: (App.data.revenue_server_checks || []).length >= 3 },
      { label: 'Events',         ok: (App.data.bookings || []).length > 0 }
    ];

    const salesCard = AuditUI.formCard('Annual Sales',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Sets the dollar baselines for the audit. Enter at least one; leave Food blank if you run no kitchen.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + AuditUI.moneyField('ra-iz-bar-rev', 'Annual Bar Sales', '618000', d.barRev)
      + AuditUI.moneyField('ra-iz-food-rev', 'Annual Food Sales', '372000', d.foodRev)
      + '</div>'
      + AuditUI.intakeHasBlock('What Bar Cop Already Has', 'Highlighted areas pull from your Control data automatically. The greyed ones fill in as you log them, or from an upload below.', checks));

    const uploadCard = AuditUI.formCard('Your Reports',
      FileDrop.render('ra-drop', { items: [
          { t: 'POS Sales Summary',          s: 'Scores Check Average (revenue, covers, blended check average).' },
          { t: 'Server Sales Report',        s: 'Scores Server Performance (check average by server, spread, top and bottom).', hi: true },
          { t: 'Menu Sales Mix and Pricing', s: 'Scores Menu Performance (Stars, Plowhorses, Dogs, pricing).' },
          { t: 'Labor Schedule or Payroll',  s: 'Scores Labor Efficiency (labor percent, RPLH, overtime).' },
          { t: 'Event and Catering Records', s: 'Scores Events and Private Dining (event revenue, frequency).' }
        ] }));

    const pr = d.practices || {};
    const questionsCard = AuditUI.formCard('A Few Quick Questions',
      AuditUI.intakeQRow('ra', 'Pre-shift briefing held?', 'pre_shift', [['never','Never'],['sometimes','Sometimes'],['every','Every shift']], pr.pre_shift)
      + AuditUI.intakeQRow('ra', 'Server upsell standard taught and tracked?', 'upsell_standard', [['false','No'],['true','Yes']], pr.upsell_standard)
      + AuditUI.intakeQRow('ra', 'Private dining package with a spend minimum?', 'private_dining_min', [['false','No'],['true','Yes']], pr.private_dining_min)
      + AuditUI.intakeQRow('ra', 'Menu repriced or engineered in last 6 months?', 'menu_engineered', [['false','No'],['true','Yes']], pr.menu_engineered)
      + AuditUI.intakeQRow('ra', 'When did you last raise menu prices?', 'last_price_increase', [['within_6mo','Within 6 months'],['6_12mo','6 to 12 months'],['over_year','Over a year ago'],['never','Cannot recall']], pr.last_price_increase)
      + AuditUI.intakeQRow('ra', 'Labor scheduled to a sales forecast?', 'labor_to_forecast', [['false','No'],['true','Yes']], pr.labor_to_forecast));

    this.container.innerHTML = '<div class="screen">' + salesCard + uploadCard + questionsCard + AuditUI.intakeSubmit('ra') + '</div>';
    FileDrop.attach('ra-drop');

    document.getElementById('ra-iz-cancel')?.addEventListener('click', () => { document.getElementById('topbar-sub').textContent = ''; this.renderMain(); });
    document.getElementById('ra-iz-submit')?.addEventListener('click', () => {
      const barRev = parseFloat(document.getElementById('ra-iz-bar-rev')?.value) || 0;
      const foodRev = parseFloat(document.getElementById('ra-iz-food-rev')?.value) || 0;
      if (barRev === 0 && foodRev === 0) {
        const st = document.getElementById('ra-iz-status');
        if (st) { st.style.display = 'block'; st.style.color = 'var(--red)'; st.textContent = 'Enter at least one sales figure to run the audit.'; }
        return;
      }
      this._intakeDraft.barRev = document.getElementById('ra-iz-bar-rev')?.value || '';
      this._intakeDraft.foodRev = document.getElementById('ra-iz-food-rev')?.value || '';
      const val = id => (document.getElementById('ra-q-' + id) || {}).value || '';
      this._intakeDraft.practices = {
        pre_shift:          val('pre_shift'),
        upsell_standard:    val('upsell_standard'),
        private_dining_min: val('private_dining_min'),
        menu_engineered:    val('menu_engineered'),
        last_price_increase: val('last_price_increase'),
        labor_to_forecast:  val('labor_to_forecast')
      };
      this.generateAudit();
    });
  },

  showHowTo() {
    App.showHelpModal('How the Revenue Audit Works', [
      { p: ['The Revenue Audit scores five areas: Check Average, Labor Efficiency, Menu Performance, Server Performance, and Events. It scores whatever data it can see and shows N/A for anything it cannot.'] },
      { h: 'What Bar Cop already has', p: ['If you log weekly numbers, schedules, menu items, and servers in Bar Cop, those feed the audit automatically. A new operation reads from what you enter and upload here instead.'] },
      { h: 'The steps', p: ['1. Enter your annual sales (the dollar baseline).', '2. Upload any reports for a section Bar Cop cannot see yet (a POS sales summary covers Check Average, a server sales report covers Server Performance, and so on).', '3. Answer the quick questions about how you operate.', '4. Generate. Sections with no data show N/A and fill in over time.'] },
      { h: 'Reading your results', p: ['Generate gives you a scored breakdown: an overall score up top, a score for each of the five areas (N/A where there is no data yet), and a Recoverable Per Month figure with its annualized number. Below that sit your Action Items, ranked by dollar impact, each with a Fix This button that drops you into Revenue Fix on that exact gap; an events item sends you to Event Booking instead. Bar Cop Outlook is a short written read of where you stand, and Export PDF saves the whole audit. Run one every 30 days; each is saved so you can watch the score trend on the audit landing.'] },
      { h: 'The honest rule', p: ['Cost savings (labor) and revenue growth (check average, menu, servers, events) are kept separate, never blended into one number. Every figure is computed in code from your real data.'] }
    ]);
  },

  async generateAudit() {
    if (App.demoBlock('Running an audit')) return;
    const submitBtn = document.getElementById('ra-iz-submit');
    const statusEl  = document.getElementById('ra-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    const barRev  = parseFloat(this._intakeDraft?.barRev)  || 0;
    const foodRev = parseFloat(this._intakeDraft?.foodRev) || 0;

    // Validation — do not run an audit with nothing to analyze. Files come from
    // the single shared drop zone.
    const dropFiles = FileDrop.getFiles('ra-drop');
    const hasRealData = dropFiles.length > 0 || (App.data.revenue_weeks && App.data.revenue_weeks.length > 0) || barRev > 0 || foodRev > 0;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your POS and labor reports.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

    setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

    try {
      const draftP = this._intakeDraft?.practices || {};
      App.data.settings.annual_bar_revenue  = barRev;
      App.data.settings.annual_food_revenue = foodRev;
      App.data.settings.revenue_practices   = draftP;
      await App.saveKey('settings');

      // Unanswered question ('') is omitted so it has no score effect.
      const practices = {};
      if (draftP.pre_shift) practices.pre_shift = draftP.pre_shift;
      if (draftP.upsell_standard === 'true' || draftP.upsell_standard === 'false') practices.upsell_standard = draftP.upsell_standard === 'true';
      if (draftP.private_dining_min === 'true' || draftP.private_dining_min === 'false') practices.private_dining_min = draftP.private_dining_min === 'true';
      if (draftP.menu_engineered === 'true' || draftP.menu_engineered === 'false') practices.menu_engineered = draftP.menu_engineered === 'true';
      if (draftP.last_price_increase) practices.last_price_increase = draftP.last_price_increase;
      if (draftP.labor_to_forecast === 'true' || draftP.labor_to_forecast === 'false') practices.labor_to_forecast = draftP.labor_to_forecast === 'true';

      const auditAppData = JSON.parse(JSON.stringify(App.data));

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      form.append('practices', JSON.stringify(practices));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));
      for (const f of dropFiles) form.append('file', f, f.name);

      const res  = await fetch('/api/generate-revenue-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      setStatus('Saving audit...', 'var(--t2)');
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
      await App.putRecord('core', 'revenue_audit', auditRecord);
      App.markSetupDone('gs_r_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
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
    // Beverage attachment routes to the same check-average lever. No separate
    // dollar (monthly_impact 0) so it never double-counts the check-average gap.
    if (d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null && d.S1_BEV_PER_COVER < d.S1_BEV_ATTACH_BENCHMARK) {
      items.push({ action: 'Lift beverage attachment. ' + d.S1_BEV_PER_COVER + ' drinks per guest vs a ' + d.S1_BEV_ATTACH_BENCHMARK + ' benchmark. Build the drink into every table, it is the highest-margin add.', monthly_impact: 0, gap_id: 'check-average' });
    }
    // Daypart diagnostic — surfaced only when a real gap exists. No dollar (the
    // blended check-average gap already carries it).
    if (d.S1_DAYPART_SPREAD >= 4 && d.S1_DAYPART_WEAKEST) {
      items.push({ action: 'Work your weakest daypart. ' + d.S1_DAYPART_WEAKEST + ' runs a ' + Math.round(d.S1_DAYPART_WEAKEST_CHECK) + ' dollar check against ' + Math.round(d.S1_DAYPART_STRONGEST_CHECK) + ' at your strongest. Targeted menu, staffing, and upsell there close most of the gap.', monthly_impact: 0, gap_id: 'check-average' });
    }
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Reduce labor cost. $' + Math.round(d.S2_MONTHLY_GAP) + '/month over target.', monthly_impact: d.S2_MONTHLY_GAP, gap_id: 'labor-scheduling' });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Improve menu mix. $' + Math.round(d.S3_MONTHLY_GAP) + '/month opportunity from repricing Dogs.', monthly_impact: d.S3_MONTHLY_GAP, gap_id: 'menu-engineering' });
    // Pricing lag — operator-stated, no fabricated dollar (we have no per-item
    // price-vs-market data). Surfaced as a finding routing to repricing.
    if (d.S3_PRICING_STALE === true) items.push({ action: 'Reprice the menu. Your last price increase was ' + (d.S3_LAST_PRICE_INCREASE ? d.S3_LAST_PRICE_INCREASE.toLowerCase() : 'over a year ago') + '. Inflation has quietly eaten the margin on every plate since then.', monthly_impact: 0, gap_id: 'pricing' });
    if (d.S4_MONTHLY_GAP > 0) items.push({ action: 'Close server performance spread. $' + Math.round(d.S4_MONTHLY_GAP) + '/month from bottom third to team average.', monthly_impact: d.S4_MONTHLY_GAP, gap_id: 'server-performance' });
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
      .filter(w => (w.bar_revenue||0) + (w.floor_revenue||0) > 0).slice(-4);
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

    // Labor Control — staff roster (server performance section)
    const staff = lab.lc_staff || [];
    if (staff.length) {
      cd.roster_count = staff.length;
      cd.sources.push('Labor Control staff roster');
    }

    return cd.sources.length ? cd : null;
  }
};
