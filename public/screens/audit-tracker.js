'use strict';
S.AuditTracker = {

  render(container, actions) {
    this.container = container;
    this.actions   = actions;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    this.actions.innerHTML = '';
    const audits = (App.data.audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest = audits[0] || null;
    const desc = 'Bar Cop scores your trailing four weeks off your logged data. Run it whenever you want a fresh read.';
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.readinessCard({ pfx: 'at', title: 'Profit Audit', desc,
          steps: this._readinessSteps(), sectionsReady: this._sectionsReady(), hasLatest: !!latest })
      + (latest ? AuditUI.landingCard(latest, audits[1], App.AUDIT_PROFIT_SECTION_NAMES, 'at') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'audit', 'at', { sectionCount: App.AUDIT_PROFIT_SECTION_NAMES.length }) : '')
      + '</div>';
    AuditUI.wireFirstAudit(this.container);
    document.getElementById('at-gen-btn')?.addEventListener('click', () => this.onGenerate());
    this.container.querySelectorAll('.at-view-btn').forEach(btn =>
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  // The audit reads from logged data now (no intake form). These are the data
  // slices it scores; each auto-checks off, or taps through to the step that
  // fills it. Done flags come from buildControlData.
  _readinessSteps() {
    const cd = this.buildControlData() || {};
    return [
      { label: 'Inventory count taken',                done: (cd.inventory_counts || 0) > 0, go: 'ic-take-inventory' },
      { label: 'Hours logged in Labor',                done: (cd.labor_hours || 0) > 0, go: 'lc-log-hours' },
      { label: 'Deliveries logged',                    done: (cd.deliveries_logged || 0) > 0, go: 'ic-receive-delivery' },
      { label: 'Voids and comps logged',               done: (cd.void_comp_count || 0) > 0, go: 'sc-void-comp' },
      { label: 'Cash reconciled',                      done: (cd.cash_reconciliations || 0) > 0, go: 'sc-cash-control' },
      { label: 'Confirm the week',                     done: cd.bar_cost_pct != null || cd.prime_cost_pct != null, go: 'dashboard' }
    ];
  },

  onGenerate() { this.generateAudit(); },

  // One boolean per SCORED section (Pour, Food, Shrink, Theft, Vendor) = whether
  // Bar Cop has data to score it right now. Drives the projected data badge so it
  // matches what a run would actually produce. Prime is context, not counted.
  _sectionsReady() {
    const cd = this.buildControlData() || {};
    const discreps = (App.data && App.data.vendor_discrepancies) || [];
    const vlog = (App.data && App.data.vendor_log) || [];
    return [
      cd.bar_cost_pct != null,                                                       // S1 Pour
      cd.food_cost_pct != null,                                                       // S2 Food
      (cd.inventory_counts || 0) > 0 || cd.inv_variance_dollar != null || cd.waste_total != null || (cd.spot_checks || 0) > 0,   // S3 Shrink & Waste
      (cd.void_comp_count || 0) > 0 || (cd.cash_reconciliations || 0) > 0 || cd.walked_tabs_total != null || cd.sales_integrity_flags != null,  // S4 Theft & Cash
      (cd.deliveries_logged || 0) > 0 || (cd.vendor_price_changes || 0) > 0 || discreps.length > 0 || vlog.length > 0   // S5 Vendor
    ];
  },

  /* ⛔ ENTER THROUGH App.pushView — the twin of the Cash audit defect, found by the sweep that
     closed it (2026-08-01). `audit-tracker` is in App._CONVERTED, so the old `.topbar` holding
     `#topbar-actions` is display:none and both buttons appended below rendered at ZERO WIDTH.
     From a Profit audit full view there was no visible Back anywhere, and browser Back left
     the audit entirely. app.js's _viewStack comment states the convention: one floating back
     button, no per-page back buttons. Export survives because the page body carries
     `.at-export-btn` (wired at the bottom of this function). */
  viewAudit(idx) {
    const audits = (App.data.audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;
    App.pushView(() => this._drawAudit(audit));
  },

  _drawAudit(audit) {
    if (this.actions) this.actions.innerHTML = '';


    const d = audit.raw || audit;

    const pct = (v,t) => v ? v+'%' + (t?' (Target: '+t+'%)':'') : '';
    const cur = v => v ? (v < 0 ? '-' + App.fmtCurrency(Math.abs(v)) : App.fmtCurrency(v)) : '';   // App.fmtCurrency prefixes the $, so a raw negative renders "$-600.00"
    const num = v => v != null && v !== 0 ? String(v) : '';
    const yN  = v => v===true?'Yes':v===false?'No':'';

    const gap = (v) => v > 0 ? [cur(v), 'warn'] : v < 0 ? [cur(Math.abs(v)) + ' under target', 'good'] : [''];
    const [s1gap]  = gap(d.S1_MONTHLY_GAP);

    const NAMES = App.AUDIT_PROFIT_SECTION_NAMES;
    const sections = [
      AuditUI.sectionBlock(1, NAMES[0], d.S1_SCORE, [
        ['Bar Pour Cost %',         pct(d.S1_BAR_COST_PCT, d.S1_TARGET_PCT), d.S1_BAR_COST_PCT > d.S1_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Bar Revenue',     cur(d.S1_BAR_REV_MONTHLY)],
        ['Bev COGS Period',         cur(d.S1_BEV_COGS_PERIOD)],
        ['Recipe Costing',          d.S1_RECIPE_COVERAGE, (d.S1_RECIPE_COVERAGE_PCT != null && d.S1_RECIPE_COVERAGE_PCT < 50) ? 'warn' : ''],
        ['Monthly Gap vs Target',   d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : '', d.S1_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S1_ANNUAL_GAP), d.S1_ANNUAL_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(2, NAMES[1], d.S2_SCORE, [
        ['Food Cost %',             pct(d.S2_FOOD_COST_PCT, d.S2_TARGET_PCT), d.S2_FOOD_COST_PCT > d.S2_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Food Revenue',    cur(d.S2_FOOD_REV_MONTHLY)],
        ['Recipe Costing',          d.S2_RECIPE_COVERAGE, (d.S2_RECIPE_COVERAGE_PCT != null && d.S2_RECIPE_COVERAGE_PCT < 50) ? 'warn' : ''],
        ['Monthly Gap vs Target',   d.S2_MONTHLY_GAP ? cur(d.S2_MONTHLY_GAP) : '', d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S2_ANNUAL_GAP), d.S2_ANNUAL_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(3, NAMES[2], d.S3_SCORE, [
        ['Inventory Variance $',    cur(d.S3_INV_VARIANCE_DOLLAR), d.S3_INV_VARIANCE_DOLLAR > 0 ? 'warn' : ''],
        // Warn on the magnitude: the dollar is signed now, and a variance running 4%
        // the WRONG way is a broken count, not a clean sheet.
        ['Inventory Variance %',    d.S3_INV_VARIANCE_PCT != null ? d.S3_INV_VARIANCE_PCT + '% of COGS' : '', Math.abs(d.S3_INV_VARIANCE_PCT) > 2 ? 'warn' : ''],
        ['Count Frequency',         d.S3_COUNT_FREQ, /not counted/i.test(d.S3_COUNT_FREQ||'') ? '' : (/monthly/i.test(d.S3_COUNT_FREQ||'') ? 'warn' : (d.S3_COUNT_FREQ ? 'good' : ''))],
        ['Counts This Period',      num(d.S3_COUNTS_IN_PERIOD)],
        ['Spot Checks',             num(d.S3_SPOT_CHECKS)],
        ['Spot Check Variance $',   cur(d.S3_SPOT_VARIANCE_DOLLAR), d.S3_SPOT_VARIANCE_DOLLAR > 300 ? 'warn' : ''],
        ['Waste Logged',            cur(d.S3_WASTE_TOTAL)],
        ['Measured Shrink (in pour and food cost)', cur(d.S3_SHRINK_PERIOD), d.S3_SHRINK_PERIOD > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(4, NAMES[3], d.S4_SCORE, [
        ['Void/Comp %',             pct(d.S4_VOID_COMP_PCT), d.S4_VOID_COMP_PCT > 2 ? 'warn' : ''],
        ['Void/Comp Amount',        cur(d.S4_VOID_COMP_AMT), d.S4_VOID_COMP_AMT > 0 ? 'warn' : ''],
        ['Unauthorized Voids %',    pct(d.S4_VOIDS_NO_APPROVAL_PCT), d.S4_VOIDS_NO_APPROVAL_PCT > 0 ? 'warn' : ''],
        ['Cash Short Rate',         d.S4_CASH_SHORT_RATE_PCT != null ? d.S4_CASH_SHORT_RATE_PCT + '% of counts' : '', d.S4_CASH_SHORT_RATE_PCT > 15 ? 'warn' : ''],
        ['Drawer Reconciliation',   d.S4_DRAWER_RECON],
        ['Walked Tabs',             cur(d.S4_WALKED_TABS_TOTAL) + (d.S4_WALKED_TABS_COUNT ? ' across ' + d.S4_WALKED_TABS_COUNT : ''), d.S4_WALKED_TABS_TOTAL > 0 ? 'warn' : ''],
        ['Sales Integrity Flags',   d.S4_SALES_INTEGRITY_FLAGS != null ? num(d.S4_SALES_INTEGRITY_FLAGS) : '', d.S4_SALES_INTEGRITY_FLAGS > 0 ? 'warn' : ''],
        ['Monthly Gap',             cur(d.S4_MONTHLY_GAP), d.S4_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(5, NAMES[4], d.S5_SCORE, [
        ['Deliveries Logged',       num(d.S5_DELIVERIES_LOGGED)],
        ['Price Changes Caught',    num(d.S5_VENDOR_PRICE_CHANGES)],
        ['Monthly Vendor Spend',    cur(d.S5_VENDOR_SPEND_MONTHLY)],
        ['Price Verification',      d.S5_PRICE_VERIFY],
        ['Uncollected Vendor Credits', d.S5_UNCOLLECTED_CREDITS != null ? cur(d.S5_UNCOLLECTED_CREDITS) + (d.S5_OPEN_CREDIT_COUNT ? ' across ' + d.S5_OPEN_CREDIT_COUNT + ' open' : '') : '', d.S5_UNCOLLECTED_CREDITS > 0 ? 'warn' : ''],
        ['Credits Recovered',       d.S5_RECOVERED_CREDITS != null ? cur(d.S5_RECOVERED_CREDITS) : ''],
        ['Credit Recovery Rate',    d.S5_CREDIT_RECOVERY_PCT != null ? d.S5_CREDIT_RECOVERY_PCT + '%' : '', (d.S5_CREDIT_RECOVERY_PCT != null && d.S5_CREDIT_RECOVERY_PCT < 40) ? 'warn' : ''],
        ['Est. Monthly Exposure',   cur(d.S5_EXPOSURE_MONTHLY), d.S5_EXPOSURE_MONTHLY > 500 ? 'warn' : ''],
        ['Est. Annual Exposure',    cur(d.S5_EXPOSURE_ANNUAL),  d.S5_EXPOSURE_ANNUAL  > 5000? 'warn' : ''],
      ], null, d),
    ].join('');

    this.container.innerHTML = '<div class="screen">'
      + AuditUI.viewHero(audit, 'Profit Audit', 'at', App.AUDIT_PROFIT_SECTION_NAMES.length)
      + AuditUI.recoverStrip(audit)
      + AuditUI.actionsArea(audit, 'profit', 'at')
      + sections
      + this.primeContext(d)
      + '</div>';

    AuditUI.attachOutlook('at', audit, 'profit');
    this.container.querySelector('.at-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.at-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => { App._fixFocus = btn.dataset.gap; App.navigate('profit-fix'); });
    });
  },

  // ── Prime Cost — context card, NOT a scored section ─────────────
  // Prime is pour + food + labor, so averaging it into the overall would double-
  // weight S1 and S2. It reads as context here: where the whole margin stands.
  primeContext(d) {
    if (d.PRIME_COST_PCT == null) return '';
    const cur = v => v ? (v < 0 ? '-' + App.fmtCurrency(Math.abs(v)) : App.fmtCurrency(v)) : '';   // App.fmtCurrency prefixes the $, so a raw negative renders "$-600.00"
    const pct = v => v != null ? v + '%' : '';
    const over = d.PRIME_COST_PCT > (d.PRIME_TARGET_PCT || 60);
    const rows = [
      { label: 'Prime Cost %', value: pct(d.PRIME_COST_PCT) + (d.PRIME_TARGET_PCT ? ' (Target: ' + d.PRIME_TARGET_PCT + '%)' : ''), valColor: over ? 'var(--red)' : 'var(--green)' },
      { label: 'Prime Cost Amount', value: cur(d.PRIME_COST_AMT) },
      { label: 'Labor %', value: pct(d.PRIME_LABOR_PCT), valColor: d.PRIME_LABOR_PCT > 35 ? 'var(--red)' : 'var(--t1)' },
      { label: 'Labor Period', value: cur(d.PRIME_LABOR_PERIOD) },
      { label: 'Total Revenue Period', value: cur(d.PRIME_TOTAL_REV_PERIOD) },
      { label: 'Total COGS Period', value: cur(d.PRIME_TOTAL_COGS_PERIOD) }
    ].filter(r => r.value && r.value !== '$0');
    if (!rows.length) return '';
    return '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Context</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">Prime Cost</div></div></div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin:8px 0 4px;">Pour, food, and labor together. Shown for context, not scored into the overall (it would double-count Pour and Food above).</div>'
      + '<div style="border-top:1px solid var(--b2);margin:12px 0;"></div>'
      + AuditUI.metricRows(rows)
      + '</div>';
  },

  // ── Export the Profit Audit as a data-driven PDF ───────────────
  // Rebuilds the same content viewAudit() renders (header + score, total
  // recoverable summary, ranked action items, the five scored sections with
  // their metrics + findings text, and the Operational Risk Signals) via the
  // shared App._pdfBuilder. Replaces the old window.print() path. Disclaimer
  // is the canonical App.deliverableFooter() language.
  async exportPDF(audit) {
    if (!audit) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const d = audit.raw || audit;

    // Same formatting helpers viewAudit uses, so PDF values match the screen.
    const pct = (v,t) => v ? v+'%' + (t?' (Target: '+t+'%)':'') : '';
    const cur = v => v ? (v < 0 ? '-' + App.fmtCurrency(Math.abs(v)) : App.fmtCurrency(v)) : '';   // App.fmtCurrency prefixes the $, so a raw negative renders "$-600.00"
    const num = v => v != null && v !== 0 ? String(v) : '';
    const gap = (v) => v > 0 ? cur(v) : v < 0 ? (cur(Math.abs(v)) + ' under target') : '';

    const venue = audit.bar_name || App.data.settings.bar_name || 'Your Bar';
    const metaBits = [(audit.date || '').slice(0, 10)];
    if (audit.audit_period) metaBits.push(audit.audit_period);
    if (audit.audit_id)     metaBits.push(audit.audit_id);

    // A null score is "not enough data", NOT a zero. `|| 0` turned it into a fabricated
    // 0, and App.scoreLabel(0) reads "Critical" — so a brand-new bar that saw
    // "N/A / Not enough data yet" on screen exported a PDF headed "Profit Score 0
    // (Critical)" next to an industry average of 63, and handed that to their bank. The
    // screen has always handled null (audit-ui.js); the export was the last leak.
    const _score = audit.overall_score;
    const _scoreTxt = _score == null ? 'N/A' : String(_score);
    const b = App._pdfBuilder('Profit Audit');
    b.header({
      right: 'Profit Audit',
      meta: metaBits.join('  ·  ') + '  ·  Profit Score ' + _scoreTxt
    });
    b.kv('Operation', venue);
    b.kv('Profit Score', _score == null ? 'N/A  (Not enough data yet)' : (_score + '  (' + App.scoreLabel(_score) + ')'));
    const dq = AuditUI.dataQualityLabel(audit, App.AUDIT_PROFIT_SECTION_NAMES.length);
    if (dq) b.kv('Data Quality', dq);
    b.kv('Target', String(d.TARGET_SCORE || 70));

    // Total recoverable summary (mirrors the on-screen recoverable banner).
    const totalMonthly = (audit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0);
    if (totalMonthly > 0) {
      b.sectionTitle('Recoverable Opportunity');
      b.kv('Total Recoverable Per Month', App.fmtCurrency(totalMonthly));
      b.kv('Annualized', App.fmtCurrency(totalMonthly * 12));
      if (d.WEEKLY_GAP_AMT) b.kv('Weekly Gap', String(d.WEEKLY_GAP_AMT));
    }

    // Action items, ranked by impact.
    const actionItems = audit.action_items || [];
    if (actionItems.length) {
      b.sectionTitle('Action Items, Ranked by Impact');
      b.table(['#', 'Action', 'Monthly Opportunity'], actionItems.map((a, i) => [
        String(i + 1),
        a.action || a || '',
        a.monthly_impact ? '+' + App.fmtCurrency(a.monthly_impact) + '/mo' : ''
      ]), { columnStyles: { 0: { cellWidth: 26 }, 2: { cellWidth: 110, halign: 'right' } } });
    }

    // Findings text for a section (same fields as viewAudit's findingsBlock).
    const findingsText = (n) => {
      const fields = ['S'+n+'_EVIDENCE', 'S'+n+'_GAP', 'S'+n+'_TOOL', 'S'+n+'_NARRATIVE', 'S'+n+'_FINDING'];
      return fields.map(f => d[f]).filter(v => v && String(v).trim());
    };

    // Score line for a section header (score, or N/A when null).
    const scoreLine = (sc) => sc != null ? String(sc) + '  (' + App.scoreLabel(sc) + ')' : 'N/A (Not enough data)';

    // The five scored sections, with identical label/value pairs to viewAudit.
    const NAMES = App.AUDIT_PROFIT_SECTION_NAMES;
    const sectionDefs = [
      [1, NAMES[0], d.S1_SCORE, [
        ['Bar Pour Cost %',        pct(d.S1_BAR_COST_PCT, d.S1_TARGET_PCT)],
        ['Monthly Bar Revenue',    cur(d.S1_BAR_REV_MONTHLY)],
        ['Bev COGS Period',        cur(d.S1_BEV_COGS_PERIOD)],
        ['Recipe Costing',         d.S1_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',  d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : ''],
        ['Annual Gap',             cur(d.S1_ANNUAL_GAP)]
      ]],
      [2, NAMES[1], d.S2_SCORE, [
        ['Food Cost %',            pct(d.S2_FOOD_COST_PCT, d.S2_TARGET_PCT)],
        ['Monthly Food Revenue',   cur(d.S2_FOOD_REV_MONTHLY)],
        ['Recipe Costing',         d.S2_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',  d.S2_MONTHLY_GAP ? cur(d.S2_MONTHLY_GAP) : ''],
        ['Annual Gap',             cur(d.S2_ANNUAL_GAP)]
      ]],
      [3, NAMES[2], d.S3_SCORE, [
        ['Inventory Variance $',   cur(d.S3_INV_VARIANCE_DOLLAR)],
        ['Inventory Variance %',   d.S3_INV_VARIANCE_PCT != null ? d.S3_INV_VARIANCE_PCT + '% of COGS' : ''],
        ['Count Frequency',        d.S3_COUNT_FREQ],
        ['Counts This Period',     num(d.S3_COUNTS_IN_PERIOD)],
        ['Spot Checks',            num(d.S3_SPOT_CHECKS)],
        ['Spot Check Variance $',  cur(d.S3_SPOT_VARIANCE_DOLLAR)],
        ['Waste Logged',           cur(d.S3_WASTE_TOTAL)],
        ['Measured Shrink (in pour and food cost)', cur(d.S3_SHRINK_PERIOD)]
      ]],
      [4, NAMES[3], d.S4_SCORE, [
        ['Void/Comp %',            pct(d.S4_VOID_COMP_PCT)],
        ['Void/Comp Amount',       cur(d.S4_VOID_COMP_AMT)],
        ['Unauthorized Voids %',   pct(d.S4_VOIDS_NO_APPROVAL_PCT)],
        ['Cash Short Rate',        d.S4_CASH_SHORT_RATE_PCT != null ? d.S4_CASH_SHORT_RATE_PCT + '% of counts' : ''],
        ['Drawer Reconciliation',  d.S4_DRAWER_RECON],
        ['Walked Tabs',            cur(d.S4_WALKED_TABS_TOTAL) + (d.S4_WALKED_TABS_COUNT ? ' across ' + d.S4_WALKED_TABS_COUNT : '')],
        ['Sales Integrity Flags',  d.S4_SALES_INTEGRITY_FLAGS != null ? num(d.S4_SALES_INTEGRITY_FLAGS) : ''],
        ['Monthly Gap',            cur(d.S4_MONTHLY_GAP)]
      ]],
      [5, NAMES[4], d.S5_SCORE, [
        ['Deliveries Logged',      num(d.S5_DELIVERIES_LOGGED)],
        ['Price Changes Caught',   num(d.S5_VENDOR_PRICE_CHANGES)],
        ['Monthly Vendor Spend',   cur(d.S5_VENDOR_SPEND_MONTHLY)],
        ['Price Verification',     d.S5_PRICE_VERIFY],
        ['Uncollected Vendor Credits', d.S5_UNCOLLECTED_CREDITS != null ? cur(d.S5_UNCOLLECTED_CREDITS) + (d.S5_OPEN_CREDIT_COUNT ? ' across ' + d.S5_OPEN_CREDIT_COUNT + ' open' : '') : ''],
        ['Credits Recovered',      d.S5_RECOVERED_CREDITS != null ? cur(d.S5_RECOVERED_CREDITS) : ''],
        ['Credit Recovery Rate',   d.S5_CREDIT_RECOVERY_PCT != null ? d.S5_CREDIT_RECOVERY_PCT + '%' : ''],
        ['Est. Monthly Exposure',  cur(d.S5_EXPOSURE_MONTHLY)],
        ['Est. Annual Exposure',   cur(d.S5_EXPOSURE_ANNUAL)]
      ]]
    ];

    sectionDefs.forEach(([n, name, score, items]) => {
      b.sectionTitle('Section ' + n + '  ·  ' + name);
      b.kv('Score', scoreLine(score));
      const rows = items.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0')
        .map(([label, val]) => [label, String(val)]);
      if (rows.length) b.table(['Metric', 'Value'], rows);
      const findings = findingsText(n);
      if (findings.length) {
        b.heading('Findings', 10);
        findings.forEach(t => b.paragraph(t, { gray: 70 }));
      }
    });

    // Prime Cost — context, not a scored section.
    if (d.PRIME_COST_PCT != null) {
      b.sectionTitle('Context  ·  Prime Cost');
      b.paragraph('Pour, food, and labor together. Shown for context, not scored into the overall.', { gray: 70 });
      const primeRows = [
        ['Prime Cost %', pct(d.PRIME_COST_PCT, d.PRIME_TARGET_PCT)],
        ['Prime Cost Amount', cur(d.PRIME_COST_AMT)],
        ['Labor %', pct(d.PRIME_LABOR_PCT)],
        ['Labor Period', cur(d.PRIME_LABOR_PERIOD)],
        ['Total Revenue Period', cur(d.PRIME_TOTAL_REV_PERIOD)],
        ['Total COGS Period', cur(d.PRIME_TOTAL_COGS_PERIOD)]
      ].filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0')
        .map(([label, val]) => [label, String(val)]);
      if (primeRows.length) b.table(['Metric', 'Value'], primeRows);
    }

    b.disclaimer(App.deliverableFooter().workbookSubject);

    let ds = App._pdfDateStamp();
    if (audit.date) {
      const dt = new Date((audit.date || '').slice(0, 10) + 'T00:00:00');
      if (!isNaN(dt.getTime())) {
        const p = n => String(n).padStart(2, '0');
        ds = '' + dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate());
      }
    }
    await b.save(App.pdfFileName('Profit Audit', ds));
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings text now renders inline under each section via findingsBlock()
  // inside the sectionBlock helper in viewAudit().


  showHowTo() {
    App.showHelpModal('How the Profit Audit Works', [
      { p: ['The Profit Audit scores five areas: Pour and Bar Cost, Food Cost, Shrink and Waste, Theft and Cash Loss, and Vendor Cost Control. Prime cost shows below the sections as context, not scored (it is pour plus food plus labor, so scoring it would double-count). It scores whatever data it can see and shows N/A for anything it cannot, so the more you give it, the more it covers.'] },
      { h: 'What Bar Cop reads', p: ['The audit runs off data you already keep, so there is no form to fill in. Your Inventory, Shift, and Labor Control numbers feed it as verified ground truth. Your sales come from the weeks you close, and until the first one is in Bar Cop asks once for last week\'s bar and food sales so the score has real numbers to work from. There are no questions to answer, nothing self-reported. Every score is measured, so no one can talk the number up by claiming a practice the data does not back.'] },
      { h: 'The readiness checklist', p: ['Before you generate, the top card shows what the audit reads and checks off each slice you already have: an inventory count, hours logged, deliveries logged, voids logged, cash reconciled, and the week confirmed. Any row you are missing taps through to the step that fills it. You can still run with gaps, they just read N/A, so the checklist is a heads-up, not a lock.'] },
      { h: 'The steps', p: ['1. Get your week in: confirm the week in Close The Week and log your Control data. 2. Generate. If no week is closed yet, enter last week\'s bar and food sales when Bar Cop asks. Sections with no data show N/A and fill in as you log more.'] },
      { h: 'Reading your results', p: ['Generate gives you a scored breakdown: an overall score up top, a score for each of the five areas (N/A where there is no data yet), and a Recoverable Per Month figure with its annualized number. Below that sit your Action Items, ranked by dollar impact, each with a Fix This button that drops you straight into Profit Fix on that exact gap. Bar Cop Briefing is a short written read of where you stand, and Export PDF saves the whole audit. Run it whenever you want a fresh read; it scores your trailing four weeks, and Bar Cop keeps one record a day so you can watch the score trend on the audit landing.'] },
      { h: 'The honest rule', p: ['Every score and dollar figure is computed in code from your real numbers, the same every time. A section with no data is left out, never guessed.'] }
    ]);
  },

  // S159: the Profit Audit is scored on the SERVER, which never sees inventory, so a menu item's
  // save-time `cost` snapshot was the only figure it had — the same S106 blind spot the Revenue
  // Audit already fixed and this one missed. Ship a COPY with the LIVE cost (App.menuItemCost); a
  // deleted-ingredient dish gets cost null and drops OUT of the server's costed filter rather than
  // scoring at a stale figure. Mirror of r-audit._auditMenuItems; verify-audit-live-cost.js case F
  // pins that BOTH audits ship the live view so the fix can never land on one side again.
  _auditMenuItems() {
    return (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) }));
  },

  async generateAudit() {
    const btn      = document.getElementById('at-gen-btn');
    const statusEl = document.getElementById('at-gen-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    const resetBtn = () => { if (btn) { btn.disabled=false; btn.textContent='Generate New Audit'; btn.style.opacity=''; } };
    if (btn) { btn.disabled=true; btn.textContent='Analyzing...'; btn.style.opacity='0.7'; }

    // Sales come from your closed weeks. Until the first one is in, prompt once
    // for a weekly sales estimate (keyed to this week) so the first audit still
    // sizes its dollars off real numbers. A real POS week supersedes it.
    const hasWeeks = !!(App.data.weeks && App.data.weeks.length > 0);
    if (!hasWeeks && !AuditUI.weekSalesEstimate()) {
      resetBtn();
      AuditUI.promptWeekSales(() => this.generateAudit());
      return;
    }

    try {
      // Honest-by-construction: the audit scores solely on what Bar Cop measures
      // from real data (Control + weekly numbers). No self-reported operating
      // practices feed the score. A manager cannot inflate the number an owner
      // relies on by claiming a practice they do not actually follow.
      const auditAppData = JSON.parse(JSON.stringify(App.data));
      // S159: score on the LIVE menu cost, not the save-time snapshot (twin of r-audit's S106 fix).
      auditAppData.menu_items = this._auditMenuItems();

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));

      const res  = await fetch('/api/generate-profit-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');

      const d = data.auditData || {};

      // Estimate-only, no real data (no closed weeks, no control counts) → nothing
      // real to score. Record it N/A (overall null) like the Cash and Bar Cop audits,
      // so it never shows a score, counts as a run, or flips the Hub / Close-the-Week
      // off a guess. A real week or a count supersedes it and it scores normally.
      const noData = AuditUI.projectedQuality(this._sectionsReady()).none;

      const auditRecord = {
        id:            App.uid(),
        date:          App.todayLocal(),
        bar_name:      d.BAR_NAME || App.data.settings.bar_name,
        // `|| 0` would turn the server's honest "no score" into a fabricated 0, and this
        // noData gate is a different test than the server's section gates, so they can
        // disagree. Null in, null through.
        overall_score: (noData || d.OVERALL_SCORE == null) ? null : d.OVERALL_SCORE,
        grade:         d.DATA_TIER_LABEL || '',
        audit_period:  d.AUDIT_PERIOD || '',
        audit_id:      d.AUDIT_ID || '',
        sections:      this.extractSections(d),
        action_items:  this.extractActionItems(d),
        raw:           d,
        generated_at:  new Date().toISOString()
      };

      // Row-per-record in core_events now, so the old 12-audit blob cap is gone:
      // full audit history is retained and paged via "Show older" on the list.
      App.dedupeAuditToday(App.data.audits, auditRecord);
      await App.putRecord('core', 'audit', auditRecord);
      if (!noData) App.markSetupDone('gs_p_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message||'Generation failed. Please try again.'), 'var(--red)');
      resetBtn();
    }
  },

  extractSections(d) {
    const s = {};
    const names = App.AUDIT_PROFIT_SECTION_NAMES;
    [1, 2, 3, 4, 5].forEach(n => {
      const v = d['S' + n + '_SCORE'];
      if (v != null) s[names[n - 1]] = v;
    });
    return s;
  },

  extractActionItems(d) {
    const items = [];
    // S1 Pour and S2 Food are real measured cost gaps (recoverable dollars).
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Reduce bar pour cost. $' + Math.round(d.S1_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S1_MONTHLY_GAP, gap_id: 'pour-cost' });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Reduce food cost. $' + Math.round(d.S2_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S2_MONTHLY_GAP, gap_id: 'food-cost' });
    // S3 Shrink is diagnostic: its dollar already lives inside the pour and food
    // gaps above, so it surfaces the where (monthly_impact 0, never re-added).
    if (d.S3_INV_VARIANCE_DOLLAR > 0 && (d.S3_INV_VARIANCE_PCT == null || d.S3_INV_VARIANCE_PCT > 2)) items.push({ action: 'Work your inventory variance. $' + Math.round(d.S3_INV_VARIANCE_DOLLAR) + ' of product was used but never rung this period. Count weekly, run the variance report, and chase the biggest negative lines in Loss Prevention.', monthly_impact: 0, gap_id: 'theft-loss' });
    if (/monthly|not counted/i.test(d.S3_COUNT_FREQ || '')) items.push({ action: 'Count more often. Inventory is running ' + String(d.S3_COUNT_FREQ).toLowerCase() + '. You cannot catch shrink you do not count for. Move to a weekly count.', monthly_impact: 0, gap_id: 'theft-loss' });
    // S4 Theft: void/comp excess is a real distinct dollar.
    if (d.S4_MONTHLY_GAP > 0) items.push({ action: 'Address void and comp rate. $' + Math.round(d.S4_MONTHLY_GAP) + '/month in excess.', monthly_impact: d.S4_MONTHLY_GAP, gap_id: 'theft-loss' });
    if (d.S4_SALES_INTEGRITY_FLAGS > 0) items.push({ action: 'Work your Sales Integrity flags. ' + d.S4_SALES_INTEGRITY_FLAGS + ' server' + (d.S4_SALES_INTEGRITY_FLAGS === 1 ? '' : 's') + ' flagged as an outlier worth a closer look. Open the investigation in Loss Prevention.', monthly_impact: 0, gap_id: 'theft-loss' });
    // S5 Vendor exposure is an ESTIMATE (a few percent of spend), so it stays out
    // of the recoverable headline; filed-but-uncollected credits are real dollars
    // but a one-time recovery, also monthly_impact 0.
    if (d.S5_EXPOSURE_MONTHLY > 0) items.push({ action: 'Tighten vendor verification. Match every invoice to its PO and price sheet. On unverified invoices a few percent of spend slips through in overcharges, roughly $' + Math.round(d.S5_EXPOSURE_MONTHLY) + ' a month of exposure to catch.', monthly_impact: 0, gap_id: 'vendor-control' });
    if (d.S5_UNCOLLECTED_CREDITS > 0) items.push({ action: 'Chase your filed vendor credits. $' + Math.round(d.S5_UNCOLLECTED_CREDITS) + ' in flagged overcharges is filed but not yet recovered across ' + (d.S5_OPEN_CREDIT_COUNT || 0) + ' open discrepanc' + (d.S5_OPEN_CREDIT_COUNT === 1 ? 'y' : 'ies') + '. The work of catching it is already done.', monthly_impact: 0, gap_id: 'vendor-control' });
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  },

  /* Verified Control-module data sent with the audit as ground truth (map
     Section 8). Each slice is real logged operational data; a section only
     appears when its Control data exists, so the server never gets a
     fabricated figure. Returns null when no Control module has data. */
  buildControlData() {
    const inv = App.inventoryData || {};
    const sh  = App.shiftData || {};
    const lab = App.laborData || {};
    const r1  = n => (n == null || isNaN(n)) ? null : Math.round(n * 10) / 10;
    const cd  = { sources: [] };

    // Bar / food / prime cost — the weeks already derive from Control feeds
    const weeks = (App.data.weeks || []).filter(w => w.period_end)
      .slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-4);
    if (weeks.length) {
      const avg = fn => { const v = weeks.map(fn).filter(x => x != null && !isNaN(x));
        return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
      cd.bar_cost_pct   = r1(avg(w => w.bar && w.bar.cost_pct));
      cd.food_cost_pct  = r1(avg(w => w.food && w.food.cost_pct));
      cd.prime_cost_pct = r1(avg(w => w.prime_cost_pct));
    }

    // Period window — the audit covers the same trailing 4 weeks the cost
    // percentages use. Scope every summed Control figure to that window so a
    // bar with months of logged records does not overstate a one-period rate.
    let windowStart = null, windowEnd = null;
    if (weeks.length) {
      const ends = weeks.map(w => w.period_end).sort();
      const d = new Date(ends[0] + 'T00:00:00');
      d.setDate(d.getDate() - 6);          // include the full first week of the window
      windowStart = isNaN(d) ? null : d;
      // Upper bound = the latest confirmed week's end. Without it, comps/waste/
      // variance logged in the CURRENT in-progress week are summed against the 4
      // closed weeks' revenue, inflating the recoverable-dollar headline.
      const e = new Date(ends[ends.length - 1] + 'T00:00:00');
      windowEnd = isNaN(e) ? null : e;
    }
    const inWindow = (rec) => {
      if (!windowStart) return true;       // no weekly data — do not filter
      const ds = rec && (rec.date || rec.created_at);
      if (!ds) return true;                // undated — include rather than silently drop
      const rd = new Date(('' + ds).slice(0, 10) + 'T00:00:00');
      if (isNaN(rd)) return true;
      return rd >= windowStart && (!windowEnd || rd <= windowEnd);
    };

    // Inventory Control — counts
    const counts = (inv.ic_counts || []).filter(inWindow);
    if (counts.length) { cd.inventory_counts = counts.length; cd.sources.push('Inventory Control counts'); }

    // Inventory Control — deliveries and vendor price drift
    const dels = (inv.ic_deliveries || []).filter(inWindow);
    if (dels.length) {
      let changes = 0;
      dels.forEach(d => (d.line_items || []).forEach(li => {
        if (li.price_changed && li.prev_price != null && li.price_per_unit != null) changes++;
      }));
      cd.deliveries_logged = dels.length;
      cd.vendor_price_changes = changes;
      cd.sources.push('Inventory Control deliveries');
    }

    // Inventory Control — spot checks (theft pour-variance signal)
    const spots = App.completedSpotChecks().filter(inWindow);   // in-progress checks measured nothing yet
    if (spots.length) {
      cd.spot_checks = spots.length;
      cd.spot_check_flagged = spots.reduce((s,c) => s + (c.flagged_count || 0), 0);
      cd.spot_check_variance_dollar = r1(spots.reduce((s,c) => s + (c.total_variance_dollar || 0), 0));
      cd.sources.push('Inventory Control spot checks');
    }

    // Inventory Control — variance report runs (theoretical vs actual usage $ =
    // the measured shrink: over-pour, waste, theft, count error). Feeds S3.
    const vruns = (inv.ic_variance_runs || []).filter(inWindow);
    if (vruns.length) {
      cd.inv_variance_dollar = r1(vruns.reduce((s,v) => s + (v.total_sales_variance || 0), 0));
      cd.sources.push('Inventory Control variance report');
    }

    // Shift Control — waste and spill log (food and bev loss $). Feeds S3.
    const waste = (sh.sc_waste || []).filter(inWindow);
    if (waste.length) {
      cd.waste_total = r1(waste.reduce((s,w) => s + (w.cost || 0), 0));
      cd.sources.push('Shift Control waste log');
    }

    // Shift Control — walked tabs (revenue lost to walk-outs). Feeds S4.
    const walked = (sh.sc_walked_tabs || []).filter(inWindow);
    if (walked.length) {
      cd.walked_tabs_total = r1(walked.reduce((s,w) => s + (w.amount || 0), 0));
      cd.walked_tabs_count = walked.length;
      cd.sources.push('Shift Control walked tabs');
    }

    // Sales Integrity — per-server fraud reviews (flagged server count). Feeds S4.
    const reviews = (App.data.sales_reviews || []).filter(inWindow);
    if (reviews.length) {
      cd.sales_integrity_flags = reviews.reduce((s,r) => s + ((r.summary && r.summary.flagged) || 0), 0);
      cd.sources.push('Sales Integrity reviews');
    }

    // Shift Control — voids and comps
    const vc = (sh.sc_void_comps || []).filter(inWindow);
    if (vc.length) {
      cd.void_comp_count = vc.length;
      cd.void_comp_total = r1(vc.reduce((s,v) => s + (v.amount || 0), 0));
      cd.void_comp_unauthorized = vc.filter(v => !v.authorized_by).length;
      cd.sources.push('Shift Control void and comp log');
    }

    // Shift Control — drawer reconciliations and cash drops
    const variances = (sh.sc_variances || []).filter(inWindow);
    if (variances.length) {
      cd.cash_reconciliations = variances.length;
      cd.cash_variance_total = r1(variances.reduce((s,v) => s + (v.variance || 0), 0));
      cd.cash_short_count = variances.filter(v => v.status === 'Short').length;
      cd.sources.push('Shift Control drawer reconciliation');
    }
    const drops = (sh.sc_cash_drops || []).filter(inWindow);
    if (drops.length) cd.cash_drops = drops.length;

    // Labor Control — actual hours and cost (prime cost labor)
    const actuals = (lab.lc_actuals || []).filter(inWindow);
    if (actuals.length) {
      cd.labor_hours = r1(actuals.reduce((s,a) => s + (a.hours || 0), 0));
      let laborCost = actuals.reduce((s,a) => s + ((a.hours || 0) * (a.wage || 0)), 0);
      // lc_actuals hold straight time only, so add the weekly overtime premium or the
      // audit scores labor low on any week someone crossed 40 hours.
      laborCost += App.otPremiumForRows ? App.otPremiumForRows(actuals).total : 0;
      // Add fixed salaried (exempt) cost over the span the windowed actuals cover.
      const dts = actuals.map(a => a.date).filter(Boolean).sort();
      if (dts.length) laborCost += App.salariedCost(dts[0], dts[dts.length - 1]).total;
      cd.labor_cost = Math.round(laborCost);
      cd.sources.push('Labor Control actuals');
    }

    return cd.sources.length ? cd : null;
  }
};
