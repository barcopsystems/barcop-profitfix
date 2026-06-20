'use strict';
S.TrafficAudit = {
  _view: null, // null = list, number = index of audit being viewed

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
    const audits = (App.data.traffic_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest = audits[0] || null;
    const daysSince = latest && latest.date
      ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = daysSince >= 30;
    const daysLeft = canRun ? 0 : 30 - daysSince;
    const desc = 'One full traffic audit every 30 days. It scores from your weekly traffic numbers plus screenshots of your Google Business, website, social, and delivery platforms, and the result shows on screen in a minute or two.';
    const SECTION_NAMES = ['Google Business', 'Website', 'Reviews', 'Search and SEO', 'Social Media', 'Delivery Platforms', 'Email Marketing'];
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.requestCard('ta', 'Traffic Audit', desc, canRun, !!latest, daysLeft)
      + (latest ? AuditUI.landingCard(latest, audits[1], SECTION_NAMES, 'ta') : AuditUI.emptyState())
      + (latest ? AuditUI.scoreChart(audits, 'Traffic Score History') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'traffic_audit', 'ta') : '')
      + '</div>';
    document.getElementById('ta-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.ta-view-btn').forEach(btn =>
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  viewAudit(idx) {
    const audits = (App.data.traffic_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;
    this._view = idx;

    // Header off (in _CONVERTED): no topbar Back/Save PDF. Back is the sidebar
    // nav; PDF export lives in the Action Items row next to Bar Cop Outlook.
    this.actions.innerHTML = '';

    const d = audit.raw || audit;
    const yN = v => v ? 'Yes' : 'No';
    // Tri-state: true/false render, null (not assessed) renders blank so the row
    // auto-hides instead of showing a misleading "No".
    const triNA = v => v === true ? 'Yes' : v === false ? 'No' : '';
    const pct = v => v != null ? v + '%' : '';
    const num = v => v != null ? String(v) : '';
    const dol = v => v ? App.fmtCurrency(v) : '';

    const signals8 = [
      {score:d.S8_SIG1_SCORE, label:d.S8_SIG1_LABEL, evidence:d.S8_SIG1_EVIDENCE, gap:d.S8_SIG1_GAP, tool:d.S8_SIG1_TOOL},
      {score:d.S8_SIG2_SCORE, label:d.S8_SIG2_LABEL, evidence:d.S8_SIG2_EVIDENCE, gap:d.S8_SIG2_GAP, tool:d.S8_SIG2_TOOL},
      {score:d.S8_SIG3_SCORE, label:d.S8_SIG3_LABEL, evidence:d.S8_SIG3_EVIDENCE, gap:d.S8_SIG3_GAP, tool:d.S8_SIG3_TOOL},
      {score:d.S8_SIG4_SCORE, label:d.S8_SIG4_LABEL, evidence:d.S8_SIG4_EVIDENCE, gap:d.S8_SIG4_GAP, tool:d.S8_SIG4_TOOL},
    ].filter(s => s.label);

    const sections = [
      AuditUI.sectionBlock(1, 'Google Business', d.S1_SCORE, [
        ['Listing Claimed and Verified', yN(d.S1_LISTING_CLAIMED)],
        ['Hours Complete', yN(d.S1_HOURS_COMPLETE)],
        ['Website Linked', yN(d.S1_WEBSITE_LINKED)],
        ['Menu Link Active', yN(d.S1_MENU_LINK_ACTIVE)],
        ['Photo Count', num(d.S1_PHOTO_COUNT) + (d.S1_PHOTO_BENCHMARK ? ' (Benchmark: ' + d.S1_PHOTO_BENCHMARK + ')' : '')],
        ['Google Posts Last 30 Days', num(d.S1_POSTS_LAST_30_DAYS) + (d.S1_POSTS_BENCHMARK ? ' (Benchmark: ' + d.S1_POSTS_BENCHMARK + ')' : '')],
        ['Profile Completeness', pct(d.S1_PROFILE_COMPLETENESS_PCT)],
        ['Monthly Gap', dol(d.S1_MONTHLY_GAP)],
      ], null, d),
      AuditUI.sectionBlock(2, 'Website', d.S2_SCORE, [
        ['Website Exists and Mobile Optimized', yN(d.S2_MOBILE_OPTIMIZED)],
        ['Monthly Sessions', num(d.S2_MONTHLY_SESSIONS) + (d.S2_SESSIONS_BENCHMARK ? ' (Benchmark: ' + d.S2_SESSIONS_BENCHMARK + ')' : '')],
        ['Bounce Rate', pct(d.S2_BOUNCE_RATE) + (d.S2_BOUNCE_BENCHMARK ? ' (Benchmark: under ' + d.S2_BOUNCE_BENCHMARK + '%)' : '')],
        ['Menu Page in Top 3', yN(d.S2_MENU_PAGE_IN_TOP_3)],
        ['Menu Is a Web Page (not a PDF)', triNA(d.S2_MENU_IS_WEB_PAGE)],
        ['Online Ordering Link', triNA(d.S2_ONLINE_ORDERING_PRESENT)],
        ['Reservation / Booking Link', triNA(d.S2_RESERVATIONS_PRESENT)],
        ['Click-to-Call on Mobile', triNA(d.S2_CLICK_TO_CALL)],
        ['Mobile Layout Set', triNA(d.S2_MOBILE_VIEWPORT)],
        ['Hours on the Homepage', triNA(d.S2_HOURS_ON_PAGE)],
        ['Conversion Elements Present', d.S2_CONVERSION_ELEMENTS_ASSESSED != null ? d.S2_CONVERSION_ELEMENTS_PRESENT + ' of ' + d.S2_CONVERSION_ELEMENTS_ASSESSED : ''],
        ['Monthly Gap', dol(d.S2_MONTHLY_GAP)],
      ], null, d),
      AuditUI.sectionBlock(3, 'Reviews', d.S3_SCORE, [
        ['Google Rating', d.S3_GOOGLE_RATING ? d.S3_GOOGLE_RATING + '★' + (d.S3_GOOGLE_RATING_BENCHMARK ? ' (Benchmark: ' + d.S3_GOOGLE_RATING_BENCHMARK + '★)' : '') : ''],
        ['Google Review Count', num(d.S3_GOOGLE_REVIEW_COUNT)],
        ['Response Rate', pct(d.S3_RESPONSE_RATE) + (d.S3_RESPONSE_BENCHMARK ? ' (Benchmark: ' + d.S3_RESPONSE_BENCHMARK + '%)' : '')],
        ['Most Recent Review', d.S3_MOST_RECENT_REVIEW_DAYS != null ? d.S3_MOST_RECENT_REVIEW_DAYS + ' days ago' : ''],
        ['Yelp Rating', d.S3_YELP_RATING ? d.S3_YELP_RATING + '★' : ''],
        ['Unanswered Reviews', num(d.S3_UNANSWERED)],
        ['Review Generation System', triNA(d.S3_REVIEW_GENERATION)],
        ['Recurring Theme (operational)', d.S3_NEGATIVE_PATTERN || ''],
        ['Monthly Gap', dol(d.S3_MONTHLY_GAP)],
      ], null, d),
      AuditUI.sectionBlock(4, 'Search and SEO', d.S4_SCORE, [
        ['In Google Maps 3-Pack', yN(d.S4_MAPS_PACK_CONFIRMED)],
        ['NAP Consistent', yN(d.S4_NAP_CONSISTENT)],
        ['Business Name', d.S4_NAP_BUSINESS_NAME || ''],
        ['Primary Keyword', d.S4_PRIMARY_KEYWORD || ''],
      ], null, d),
      AuditUI.sectionBlock(5, 'Social Media', d.S5_SCORE, [
        ['Instagram Followers', num(d.S5_IG_FOLLOWERS)],
        ['IG Posts Last 30 Days', num(d.S5_IG_POSTS_LAST_30) + (d.S5_IG_POSTS_BENCHMARK ? ' (Benchmark: ' + d.S5_IG_POSTS_BENCHMARK + ')' : '')],
        ['Facebook Followers', num(d.S5_FB_FOLLOWERS)],
        ['Content Type', d.S5_CONTENT_TYPE || ''],
        ['Monthly Gap', dol(d.S5_MONTHLY_GAP)],
      ], null, d),
      AuditUI.sectionBlock(6, 'Delivery Platforms', d.S6_SCORE, [
        ['DoorDash Active', yN(d.S6_DOORDASH_ACTIVE)],
        ['Uber Eats Active', yN(d.S6_UBEREATS_ACTIVE)],
        ['Grubhub Active', yN(d.S6_GRUBHUB_ACTIVE)],
        ['DoorDash Rating', d.S6_DOORDASH_RATING ? d.S6_DOORDASH_RATING + '★' : ''],
        ['Uber Eats Rating', d.S6_UBEREATS_RATING ? d.S6_UBEREATS_RATING + '★' : ''],
        ['Photo Count', num(d.S6_PHOTO_COUNT_DELIVERY)],
        ['Menu Complete', yN(d.S6_MENU_COMPLETE)],
        ['Promotion Active', yN(d.S6_PROMO_ACTIVE)],
        ['Delivery Prices Marked Up', triNA(d.S6_DELIVERY_MARKUP), d.S6_DELIVERY_MARKUP === false ? 'warn' : ''],
        ['Platform Commission', d.S6_DELIVERY_COMMISSION_PCT != null ? d.S6_DELIVERY_COMMISSION_PCT + '%' : ''],
        ['Monthly Gap', dol(d.S6_MONTHLY_GAP)],
      ], null, d),
      AuditUI.sectionBlock(7, 'Email Marketing', d.S7_SCORE, [
        ['Email List Exists', yN(d.S7_EMAIL_LIST_EXISTS)],
        ['List Size', d.S7_LIST_SIZE ? num(d.S7_LIST_SIZE) + (d.S7_LIST_BENCHMARK ? ' (Benchmark: ' + d.S7_LIST_BENCHMARK + ')' : '') : ''],
        ['Last Send', d.S7_LAST_SEND_DAYS_AGO != null ? d.S7_LAST_SEND_DAYS_AGO + ' days ago' : ''],
        ['Send Frequency', d.S7_SEND_FREQUENCY || ''],
        ['Open Rate', d.S7_OPEN_RATE ? pct(d.S7_OPEN_RATE) + (d.S7_OPEN_BENCHMARK ? ' (Benchmark: ' + d.S7_OPEN_BENCHMARK + '%)' : '') : ''],
        ['Growth Mechanism', d.S7_GROWTH_MECHANISM || ''],
        ['Monthly Gap', dol(d.S7_MONTHLY_GAP)],
      ], null, d),
      ...(signals8.length ? [AuditUI.sectionBlock(8, 'Operational Risk Signals', null, [], signals8, d)] : []),
    ].join('');

    this.container.innerHTML = '<div class="screen" id="ta-audit-view">'
      + AuditUI.viewHero(audit, 'Traffic Recovery Audit')
      + AuditUI.recoverStrip(audit)
      + AuditUI.actionsArea(audit, 'traffic', 'ta')
      + sections
      + '</div>';

    AuditUI.attachOutlook('ta', audit, 'traffic');
    this.container.querySelector('.ta-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.ta-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => { App._fixFocus = btn.dataset.gap; App.navigate('t-fix'); });
    });
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings render inline under each section via findingsBlock() in viewAudit().

  // ── Data-driven PDF export ────────────────────────────────────────────────
  // Rebuilds the on-screen Traffic Audit from data via App._pdfBuilder (no
  // window.print, no DOM walk). Mirrors viewAudit(): Digital Presence Score
  // header, the seven scored sections + Operational Risk Signals, each
  // section's metric rows and inline Findings, ranked action items, ending with
  // the canonical legal disclaimer (App.deliverableFooter().disclaimerLines).
  async exportPDF(audit) {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const d = audit.raw || audit;
    const overall = audit.overall_score || 0;

    // Formatters mirror viewAudit() exactly.
    const yN    = v => v ? 'Yes' : 'No';
    const triNA = v => v === true ? 'Yes' : v === false ? 'No' : '';
    const pct   = v => v != null ? v + '%' : '';
    const num   = v => v != null ? String(v) : '';
    const dol   = v => v ? App.fmtCurrency(v) : '';

    const period = [audit.audit_period, audit.audit_id, audit.grade].filter(Boolean).map(x => String(x)).join('  ·  ');
    const metaBits = [(audit.date || '').slice(0, 10) || App._pdfDateStamp(), 'Score ' + overall + ' (' + App.scoreLabel(overall) + ')'];
    if (period) metaBits.push(period);

    const b = App._pdfBuilder('Traffic Recovery Audit');
    b.header({ right: 'Traffic Recovery Audit', meta: metaBits.join('   ·   ') });
    b.kv('Bar', audit.bar_name || App.data.settings.bar_name || 'Your Bar');
    b.kv('Digital Presence Score', overall + ' of 100  (' + App.scoreLabel(overall) + ')');
    if (d.INDUSTRY_AVG != null) b.kv('Bar Cop Benchmark', String(d.INDUSTRY_AVG));
    b.kv('Target', String(d.TARGET_SCORE || 65));
    if (d.WEEKLY_GAP_AMT) b.kv('Estimated Weekly Gap', String(d.WEEKLY_GAP_AMT));

    // Ranked action items (same source + ordering as the screen).
    const actionItems = audit.action_items || [];
    if (actionItems.length) {
      b.sectionTitle('Action Items, Ranked by Impact');
      b.table(['#', 'Action', 'Monthly Opportunity'], actionItems.map((a, i) => [
        String(i + 1),
        a.action || a || '',
        a.monthly_impact ? '+' + App.fmtCurrency(a.monthly_impact) : ''
      ]), { columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 110 } } });
    }

    // Findings text per section (matches findingsBlock in viewAudit; S8 is signals).
    const findingsText = (n) => {
      if (n === 8) return [];
      return ['S' + n + '_EVIDENCE', 'S' + n + '_GAP', 'S' + n + '_TOOL', 'S' + n + '_NARRATIVE', 'S' + n + '_FINDING']
        .map(f => d[f]).filter(v => v && String(v).trim());
    };

    const section = (n, name, score, rows) => {
      const scoreTxt = score != null ? String(score) : 'N/A (Not enough data)';
      b.sectionTitle('Section ' + n + '  ·  ' + name + '  ·  Score ' + scoreTxt);
      const body = rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, val]) => [label, val]);
      if (body.length) b.table(null, body, { columnStyles: { 0: { cellWidth: 220, fontStyle: 'bold' } } });
      const finds = findingsText(n);
      if (finds.length) { b.heading('Findings', 10); finds.forEach(t => b.paragraph(t)); }
    };

    section(1, 'Google Business', d.S1_SCORE, [
      ['Listing Claimed and Verified', yN(d.S1_LISTING_CLAIMED)],
      ['Hours Complete', yN(d.S1_HOURS_COMPLETE)],
      ['Website Linked', yN(d.S1_WEBSITE_LINKED)],
      ['Menu Link Active', yN(d.S1_MENU_LINK_ACTIVE)],
      ['Photo Count', num(d.S1_PHOTO_COUNT) + (d.S1_PHOTO_BENCHMARK ? ' (Benchmark: ' + d.S1_PHOTO_BENCHMARK + ')' : '')],
      ['Google Posts Last 30 Days', num(d.S1_POSTS_LAST_30_DAYS) + (d.S1_POSTS_BENCHMARK ? ' (Benchmark: ' + d.S1_POSTS_BENCHMARK + ')' : '')],
      ['Profile Completeness', pct(d.S1_PROFILE_COMPLETENESS_PCT)],
      ['Monthly Gap', dol(d.S1_MONTHLY_GAP)],
    ]);
    section(2, 'Website', d.S2_SCORE, [
      ['Website Exists and Mobile Optimized', yN(d.S2_MOBILE_OPTIMIZED)],
      ['Monthly Sessions', num(d.S2_MONTHLY_SESSIONS) + (d.S2_SESSIONS_BENCHMARK ? ' (Benchmark: ' + d.S2_SESSIONS_BENCHMARK + ')' : '')],
      ['Bounce Rate', pct(d.S2_BOUNCE_RATE) + (d.S2_BOUNCE_BENCHMARK ? ' (Benchmark: under ' + d.S2_BOUNCE_BENCHMARK + '%)' : '')],
      ['Menu Page in Top 3', yN(d.S2_MENU_PAGE_IN_TOP_3)],
      ['Menu Is a Web Page (not a PDF)', triNA(d.S2_MENU_IS_WEB_PAGE)],
      ['Online Ordering Link', triNA(d.S2_ONLINE_ORDERING_PRESENT)],
      ['Reservation / Booking Link', triNA(d.S2_RESERVATIONS_PRESENT)],
      ['Click-to-Call on Mobile', triNA(d.S2_CLICK_TO_CALL)],
      ['Mobile Layout Set', triNA(d.S2_MOBILE_VIEWPORT)],
      ['Hours on the Homepage', triNA(d.S2_HOURS_ON_PAGE)],
      ['Conversion Elements Present', d.S2_CONVERSION_ELEMENTS_ASSESSED != null ? d.S2_CONVERSION_ELEMENTS_PRESENT + ' of ' + d.S2_CONVERSION_ELEMENTS_ASSESSED : ''],
      ['Monthly Gap', dol(d.S2_MONTHLY_GAP)],
    ]);
    section(3, 'Reviews', d.S3_SCORE, [
      ['Google Rating', d.S3_GOOGLE_RATING ? d.S3_GOOGLE_RATING + ' stars' + (d.S3_GOOGLE_RATING_BENCHMARK ? ' (Benchmark: ' + d.S3_GOOGLE_RATING_BENCHMARK + ' stars)' : '') : ''],
      ['Google Review Count', num(d.S3_GOOGLE_REVIEW_COUNT)],
      ['Response Rate', pct(d.S3_RESPONSE_RATE) + (d.S3_RESPONSE_BENCHMARK ? ' (Benchmark: ' + d.S3_RESPONSE_BENCHMARK + '%)' : '')],
      ['Most Recent Review', d.S3_MOST_RECENT_REVIEW_DAYS != null ? d.S3_MOST_RECENT_REVIEW_DAYS + ' days ago' : ''],
      ['Yelp Rating', d.S3_YELP_RATING ? d.S3_YELP_RATING + ' stars' : ''],
      ['Unanswered Reviews', num(d.S3_UNANSWERED)],
      ['Review Generation System', triNA(d.S3_REVIEW_GENERATION)],
      ['Recurring Theme (operational)', d.S3_NEGATIVE_PATTERN || ''],
      ['Monthly Gap', dol(d.S3_MONTHLY_GAP)],
    ]);
    section(4, 'Search and SEO', d.S4_SCORE, [
      ['In Google Maps 3-Pack', yN(d.S4_MAPS_PACK_CONFIRMED)],
      ['NAP Consistent', yN(d.S4_NAP_CONSISTENT)],
      ['Business Name', d.S4_NAP_BUSINESS_NAME || ''],
      ['Primary Keyword', d.S4_PRIMARY_KEYWORD || ''],
    ]);
    section(5, 'Social Media', d.S5_SCORE, [
      ['Instagram Followers', num(d.S5_IG_FOLLOWERS)],
      ['IG Posts Last 30 Days', num(d.S5_IG_POSTS_LAST_30) + (d.S5_IG_POSTS_BENCHMARK ? ' (Benchmark: ' + d.S5_IG_POSTS_BENCHMARK + ')' : '')],
      ['Facebook Followers', num(d.S5_FB_FOLLOWERS)],
      ['Content Type', d.S5_CONTENT_TYPE || ''],
      ['Monthly Gap', dol(d.S5_MONTHLY_GAP)],
    ]);
    section(6, 'Delivery Platforms', d.S6_SCORE, [
      ['DoorDash Active', yN(d.S6_DOORDASH_ACTIVE)],
      ['Uber Eats Active', yN(d.S6_UBEREATS_ACTIVE)],
      ['Grubhub Active', yN(d.S6_GRUBHUB_ACTIVE)],
      ['DoorDash Rating', d.S6_DOORDASH_RATING ? d.S6_DOORDASH_RATING + ' stars' : ''],
      ['Uber Eats Rating', d.S6_UBEREATS_RATING ? d.S6_UBEREATS_RATING + ' stars' : ''],
      ['Photo Count', num(d.S6_PHOTO_COUNT_DELIVERY)],
      ['Menu Complete', yN(d.S6_MENU_COMPLETE)],
      ['Promotion Active', yN(d.S6_PROMO_ACTIVE)],
      ['Delivery Prices Marked Up', triNA(d.S6_DELIVERY_MARKUP)],
      ['Platform Commission', d.S6_DELIVERY_COMMISSION_PCT != null ? d.S6_DELIVERY_COMMISSION_PCT + '%' : ''],
      ['Monthly Gap', dol(d.S6_MONTHLY_GAP)],
    ]);
    section(7, 'Email Marketing', d.S7_SCORE, [
      ['Email List Exists', yN(d.S7_EMAIL_LIST_EXISTS)],
      ['List Size', d.S7_LIST_SIZE ? num(d.S7_LIST_SIZE) + (d.S7_LIST_BENCHMARK ? ' (Benchmark: ' + d.S7_LIST_BENCHMARK + ')' : '') : ''],
      ['Last Send', d.S7_LAST_SEND_DAYS_AGO != null ? d.S7_LAST_SEND_DAYS_AGO + ' days ago' : ''],
      ['Send Frequency', d.S7_SEND_FREQUENCY || ''],
      ['Open Rate', d.S7_OPEN_RATE ? pct(d.S7_OPEN_RATE) + (d.S7_OPEN_BENCHMARK ? ' (Benchmark: ' + d.S7_OPEN_BENCHMARK + '%)' : '') : ''],
      ['Growth Mechanism', d.S7_GROWTH_MECHANISM || ''],
      ['Monthly Gap', dol(d.S7_MONTHLY_GAP)],
    ]);

    // Operational Risk Signals (Section 8) — same source as signals8 on screen.
    const signals8 = [
      { score: d.S8_SIG1_SCORE, label: d.S8_SIG1_LABEL, evidence: d.S8_SIG1_EVIDENCE, gap: d.S8_SIG1_GAP, tool: d.S8_SIG1_TOOL },
      { score: d.S8_SIG2_SCORE, label: d.S8_SIG2_LABEL, evidence: d.S8_SIG2_EVIDENCE, gap: d.S8_SIG2_GAP, tool: d.S8_SIG2_TOOL },
      { score: d.S8_SIG3_SCORE, label: d.S8_SIG3_LABEL, evidence: d.S8_SIG3_EVIDENCE, gap: d.S8_SIG3_GAP, tool: d.S8_SIG3_TOOL },
      { score: d.S8_SIG4_SCORE, label: d.S8_SIG4_LABEL, evidence: d.S8_SIG4_EVIDENCE, gap: d.S8_SIG4_GAP, tool: d.S8_SIG4_TOOL },
    ].filter(s => s.label);
    if (signals8.length) {
      b.sectionTitle('Section 8  ·  Operational Risk Signals');
      signals8.forEach(sig => {
        b.heading((sig.label || '') + (sig.score ? '  [' + String(sig.score).toUpperCase() + ']' : ''), 10);
        if (sig.evidence) b.paragraph(sig.evidence);
        if (sig.gap)      b.paragraph(sig.gap);
        if (sig.tool)     b.paragraph(sig.tool);
      });
    }

    b.disclaimer(App.deliverableFooter().disclaimerLines.join(' '));

    const stamp = /^\d{4}-\d{2}-\d{2}/.test(audit.date || '') ? audit.date.slice(0, 10).replace(/-/g, '') : App._pdfDateStamp();
    await b.save('BarCop_TrafficAudit_' + stamp + '.pdf');
  },

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    const s = App.data?.settings || {};
    const p = s.traffic_practices || {};
    const boolStr = v => v === true ? 'true' : v === false ? 'false' : (v || '');
    this._intakeDraft = {
      practices: { growth_mechanism: boolStr(p.growth_mechanism), delivery_markup: boolStr(p.delivery_markup), review_generation: boolStr(p.review_generation) }
    };
    this.actions.innerHTML = '';
    this.renderIntake();
  },

  // Single-page Traffic intake. Links are entered inline (no bouncing to
  // Settings), saved back to Operation Links. Only the website is read live for
  // its score (PageSpeed); Google and Yelp ratings come from screenshots by
  // design (no rating API). No revenue, no notes.
  renderIntake() {
    const d = this._intakeDraft || {};
    document.getElementById('topbar-sub').textContent = '';
    const urls = (App.data.traffic_settings && App.data.traffic_settings.urls) || {};
    // Form viewable anytime; the 30-day window gates only Generate.
    const _a = (App.data.traffic_audits || []).slice().sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    const _since = _a[0] && _a[0].date ? Math.floor((Date.now() - new Date(_a[0].date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = _since >= 30;
    const daysLeft = canRun ? 0 : 30 - _since;

    // From weekly traffic numbers (Bar Cop does not auto-collect this — it only
    // has what the operator logged in This Week).
    const tw = (App.data.traffic_weeks || []).slice(-4);
    const has = (fn) => tw.some(w => w[fn] != null);
    const checks = [
      { label: 'Google Rating',   ok: has('google_rating') },
      { label: 'Review Response', ok: has('response_rate') },
      { label: 'Website Sessions',ok: has('monthly_sessions') },
      { label: 'Social Posts',    ok: has('ig_posts_month') },
      { label: 'Delivery Orders', ok: has('delivery_orders') },
      { label: 'Email',           ok: has('email_list_size') || has('email_open_rate') }
    ];

    // Only the Website link drives a live score (PageSpeed); everything else is
    // a screenshot. Pre-filled from Operation Links, saved on Generate.
    const wp = (App.TRAFFIC_PLATFORMS || []).find(p => p.urlKey === 'website') || {};
    const linkField = '<div class="f" style="width:100%;max-width:480px;"><label>' + esc(wp.label || 'Website URL') + '</label>'
      + '<input class="form-input" type="url" id="ta-link-website" value="' + esc(urls.website || '') + '" placeholder="' + esc(wp.placeholder || 'https://yourbar.com') + '"/></div>';

    const websiteCard = AuditUI.formCard('Your Website',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">The one link Bar Cop reads live for your score: speed, mobile, SEO, and best practices. Everything else, including your Google and Yelp ratings, comes from a screenshot below.</div>'
      + linkField
      + AuditUI.intakeHasBlock('From Your Weekly Traffic Numbers', 'Highlighted areas come from what you logged in This Week. The greyed ones fill in as you log them, or from a screenshot below.', checks));

    const screenshotsCard = AuditUI.formCard('Screenshots',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Optional, but this is where most of your score comes from. Drop in a screenshot for anything your website link cannot reach. One drop zone takes them all.</div>'
      + FileDrop.render('ta-drop', { accept: '.png,.jpg,.jpeg,.pdf,.csv', acceptText: 'Screenshots, PDF, or CSV', items: [
          { t: 'Google Review Page (rating, reviews)',      s: 'Your Google rating, review count, response rate, and recency. This is how Bar Cop scores your Google reviews.', hi: true },
          { t: 'Yelp Listing (rating, reviews)',            s: 'Your Yelp rating and review count for cross-platform reputation.', hi: true },
          { t: 'Website Analytics (sessions, bounce rate)', s: 'Sessions and bounce live behind your analytics login, not in the public page.', hi: true },
          { t: 'GBP Insights (impressions, calls)',         s: 'Adds the impression-to-action funnel.' },
          { t: 'Search Results (maps pack)',                s: 'Confirms maps-pack presence and search visibility.' },
          { t: 'Instagram Profile',                         s: 'Follower count, post frequency, content.' },
          { t: 'Delivery Platform Dashboard',               s: 'Rating, photos, menu completeness, promos.' },
          { t: 'Email Platform',                            s: 'List size, send frequency, open rate.' }
        ] }));

    const pr = d.practices || {};
    const questionsCard = AuditUI.formCard('A Few Quick Questions',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:6px;">These are not in your reports. Answer what applies; the rest carry over to next time.</div>'
      + AuditUI.intakeQRow('ta', 'Email signup or list-growth mechanism in place?', 'growth_mechanism', [['false','No'],['true','Yes']], pr.growth_mechanism)
      + AuditUI.intakeQRow('ta', 'Delivery menu prices marked up to offset commission?', 'delivery_markup', [['false','No'],['true','Yes']], pr.delivery_markup)
      + AuditUI.intakeQRow('ta', 'Review generation system asking guests for reviews?', 'review_generation', [['false','No'],['true','Yes']], pr.review_generation));

    this.container.innerHTML = '<div class="screen">' + websiteCard + screenshotsCard + questionsCard + AuditUI.intakeSubmit('ta', canRun, daysLeft) + '</div>';
    FileDrop.attach('ta-drop');

    document.getElementById('ta-iz-cancel')?.addEventListener('click', () => { document.getElementById('topbar-sub').textContent = ''; this.renderMain(); });
    document.getElementById('ta-iz-submit')?.addEventListener('click', () => {
      const val = id => (document.getElementById('ta-q-' + id) || {}).value || '';
      this._intakeDraft.practices = { growth_mechanism: val('growth_mechanism'), delivery_markup: val('delivery_markup'), review_generation: val('review_generation') };
      this.generateAudit();
    });
  },

  showHowTo() {
    App.showHelpModal('How the Traffic Audit Works', [
      { p: ['The Traffic Audit scores your digital presence across seven areas: Google Business, website, reviews, search, social, delivery, and email. It scores whatever you give it and shows N/A for anything it has no data on, so the more you provide, the more it covers. One audit every 30 days.'] },
      { h: 'What Bar Cop Already Has', p: ['The chips on the form show which areas your weekly This Week numbers already cover, so you do not re-enter them. The greyed ones fill in as you log more or drop a screenshot.'] },
      { h: 'Reads Live From a Link', p: ['Your Website is the one link Bar Cop reads live: speed, mobile, SEO, and best practices, scored straight from the link. Save it once and it is ready every audit.'] },
      { h: 'Needs a Screenshot', p: ['Everything else needs a screenshot. Your Google and Yelp ratings, website analytics, Instagram, Facebook, delivery platforms, and email sit behind a login or carry data a link cannot reach. Drop one screenshot per area you want scored; one drop zone takes them all, and PDF or CSV exports work too.'] },
      { h: 'The Quick Questions', p: ['A few questions cover what no report shows, like whether you mark up delivery prices to offset commission or run a review-ask at the table. They shape the score and carry over to next time.'] },
      { h: 'The Steps', p: ['1. Confirm your Website link.', '2. Drop a screenshot for each area you want scored.', '3. Answer the quick questions.', '4. Generate. Anything with no data shows N/A and fills in next time.'] },
      { h: 'Reading Your Results', p: ['Generate gives you a scored breakdown: an overall score up top and a score for each area (N/A where there is no data yet). Below that sit your Action Items, ranked by impact, each with a Fix This button that drops you into Traffic Fix on that exact gap. Bar Cop Outlook is a short written read of where you stand, and Export PDF saves the whole audit. The Traffic Audit does not put a dollar figure on a gap; the Traffic Forecast does that. Each audit is saved so you can watch the score trend on the audit landing.'] }
    ]);
  },

  async generateAudit() {
    if (App.demoBlock('Running an audit')) return;
    const submitBtn = document.getElementById('ta-iz-submit');
    const statusEl  = document.getElementById('ta-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    const draftP = this._intakeDraft?.practices || {};
    // Collect the website link and save it back to Operation Links so the
    // operator enters it once and the audit can read it live next time. Google
    // and Yelp are screenshot-only — no live link read.
    const linkKeys = ['website'];   // the only score-driving live link
    const savedUrls = Object.assign({}, (App.data.traffic_settings && App.data.traffic_settings.urls) || {});
    linkKeys.forEach(k => { const el = document.getElementById('ta-link-' + k); if (el) savedUrls[k] = (el.value || '').trim(); });
    if (!App.data.traffic_settings) App.data.traffic_settings = {};
    App.data.traffic_settings.urls = savedUrls;
    App.data.settings.traffic_practices = draftP;
    await App.saveKey('traffic_settings');
    await App.saveKey('settings');

    const form = new FormData();
    form.append('appData', JSON.stringify(App.data));
    // Only the website is read live (PageSpeed). No Google Places / Yelp query.
    form.append('urls', JSON.stringify(savedUrls));
    // Practices — unanswered ('') omitted so it has no score effect.
    const practices = {};
    if (draftP.growth_mechanism === 'true' || draftP.growth_mechanism === 'false') practices.growth_mechanism = draftP.growth_mechanism === 'true';
    if (draftP.delivery_markup === 'true' || draftP.delivery_markup === 'false') practices.delivery_markup = draftP.delivery_markup === 'true';
    if (draftP.review_generation === 'true' || draftP.review_generation === 'false') practices.review_generation = draftP.review_generation === 'true';
    form.append('practices', JSON.stringify(practices));

    // Screenshots come from the single shared drop zone.
    const dropFiles = FileDrop.getFiles('ta-drop');
    for (const f of dropFiles) form.append('file', f, f.name);

    // Validation — the website link, screenshots, or weekly data all count.
    const hasRealData = dropFiles.length > 0 || (App.data.traffic_weeks && App.data.traffic_weeks.length > 0)
      || savedUrls.website;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your screenshots.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

    setStatus('Uploading files and generating audit...', 'var(--t2)');

    try {
      const res  = await fetch('/api/generate-traffic-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      setStatus('Saving audit...', 'var(--t2)');
      const d = data.auditData || {};
      const newAudit = {
        date:          App.todayLocal(),
        overall_score: d.OVERALL_SCORE || 0,
        bar_name:      d.BAR_NAME      || App.data.settings?.bar_name || '',
        audit_id:      d.AUDIT_ID      || '',
        audit_period:  d.AUDIT_PERIOD  || '',
        grade:         d.DATA_TIER_LABEL || '',
        sections: (() => {
          // Preserve N/A: only include a section when it actually scored, so
          // the landing list can show "N/A" for the ones with no data.
          const map = { 'Google Business': d.S1_SCORE, 'Website': d.S2_SCORE, 'Reviews': d.S3_SCORE, 'Search and SEO': d.S4_SCORE, 'Social Media': d.S5_SCORE, 'Delivery Platforms': d.S6_SCORE, 'Email Marketing': d.S7_SCORE };
          const out = {}; Object.keys(map).forEach(k => { if (map[k] != null) out[k] = map[k]; }); return out;
        })(),
        action_items: (Array.isArray(d.action_items) ? d.action_items : []).map(a => {
          const obj = typeof a === 'string' ? { action: a, monthly_impact: 0 } : a;
          if (!obj.gap_id && window.FixPanel) obj.gap_id = FixPanel.inferGapId(obj.action, 'traffic');
          return obj;
        }),
        raw: d
      };

      // Row-per-record in core_events; full audit history kept (12-cap removed).
      if (newAudit.id == null) newAudit.id = App.uid();
      await App.putRecord('core', 'traffic_audit', newAudit);
      App.markSetupDone('gs_t_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);
    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
    }
  }

};
