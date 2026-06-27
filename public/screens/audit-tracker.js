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
    const daysSince = latest && latest.date
      ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = daysSince >= 7;
    const daysLeft = canRun ? 0 : 7 - daysSince;
    const desc = 'Generate a new audit every week. Run your first one any time. It scores your trailing four weeks.';
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.firstAuditCard({ pfx: 'at', title: 'Profit Audit', desc, canRun, hasLatest: !!latest, daysLeft,
          gs: { mode: 'check',
            intro: 'Your Profit Audit scores pour cost, food cost, theft and loss, vendors, and prime cost. Drop your P&L or POS sales export and Bar Cop reads a real baseline the day you start.',
            checkLabel: 'I have a P&L or POS sales export ready to drop',
            hint: 'One sales report is enough to start. The more you bring, a voids and comps report, invoices, recipe costs, the sharper your first audit.' } })
      + (latest ? AuditUI.landingCard(latest, audits[1], App.AUDIT_PROFIT_SECTION_NAMES, 'at') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'audit', 'at') : '')
      + '</div>';
    document.getElementById('at-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    AuditUI.wireFirstAudit(this.container);
    this.container.querySelectorAll('.at-view-btn').forEach(btn =>
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  viewAudit(idx) {
    const audits = (App.data.audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;

    this.actions.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-ghost btn-sm';
    backBtn.textContent = '← Back';
    backBtn.style.marginRight = '8px';
    backBtn.onclick = () => this.renderMain();
    this.actions.appendChild(backBtn);

    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Print / Save PDF';
    printBtn.onclick = () => this.exportPDF(audit);
    this.actions.appendChild(printBtn);


    const d = audit.raw || audit;

    const pct = (v,t) => v ? v+'%' + (t?' (Target: '+t+'%)':'') : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null && v !== 0 ? String(v) : '';
    const yN  = v => v===true?'Yes':v===false?'No':'';

    const gap = (v) => v > 0 ? [cur(v), 'warn'] : v < 0 ? [cur(Math.abs(v)) + ' under target', 'good'] : [''];
    const [s1gap]  = gap(d.S1_MONTHLY_GAP);

    const signals6 = [
      {score:d.S6_SIG1_SCORE, label:d.S6_SIG1_LABEL, evidence:d.S6_SIG1_EVIDENCE, gap:d.S6_SIG1_GAP, tool:d.S6_SIG1_TOOL},
      {score:d.S6_SIG2_SCORE, label:d.S6_SIG2_LABEL, evidence:d.S6_SIG2_EVIDENCE, gap:d.S6_SIG2_GAP, tool:d.S6_SIG2_TOOL},
      {score:d.S6_SIG3_SCORE, label:d.S6_SIG3_LABEL, evidence:d.S6_SIG3_EVIDENCE, gap:d.S6_SIG3_GAP, tool:d.S6_SIG3_TOOL},
      {score:d.S6_SIG4_SCORE, label:d.S6_SIG4_LABEL, evidence:d.S6_SIG4_EVIDENCE, gap:d.S6_SIG4_GAP, tool:d.S6_SIG4_TOOL},
    ].filter(s => s.label);

    const NAMES = App.AUDIT_PROFIT_SECTION_NAMES;
    const sections = [
      AuditUI.sectionBlock(1, NAMES[0], d.S1_SCORE, [
        ['Bar Pour Cost %',         pct(d.S1_BAR_COST_PCT, d.S1_TARGET_PCT), d.S1_BAR_COST_PCT > d.S1_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Bar Revenue',     cur(d.S1_BAR_REV_MONTHLY)],
        ['Bev COGS Period',         cur(d.S1_BEV_COGS_PERIOD)],
        ['Inventory Variance %',    pct(d.S1_INV_VARIANCE_PCT), d.S1_INV_VARIANCE_PCT > 2 ? 'warn' : ''],
        ['Inventory Variance $',    cur(d.S1_INV_VARIANCE_AMT), d.S1_INV_VARIANCE_AMT > 500 ? 'warn' : ''],
        ['Draft Beer Yield',        d.S1_DRAFT_YIELD_PCT != null ? d.S1_DRAFT_YIELD_PCT + '%' : '', (d.S1_DRAFT_LOSS_PCT != null && d.S1_DRAFT_LOSS_PCT >= 12) ? 'warn' : (d.S1_DRAFT_YIELD_PCT != null ? 'good' : '')],
        ['Draft Yield Loss',        d.S1_DRAFT_LOSS_PCT != null ? d.S1_DRAFT_LOSS_PCT + '% to foam and over-pour' : '', d.S1_DRAFT_LOSS_PCT >= 12 ? 'warn' : ''],
        ['Pour Method',             d.S1_POUR_METHOD],
        ['Recipe Coverage',         d.S1_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',   s1gap || (d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : ''), d.S1_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S1_ANNUAL_GAP), d.S1_ANNUAL_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(2, NAMES[1], d.S2_SCORE, [
        ['Void/Comp %',             pct(d.S2_VOID_COMP_PCT), d.S2_VOID_COMP_PCT > 2 ? 'warn' : ''],
        ['Void/Comp Amount',        cur(d.S2_VOID_COMP_AMT), d.S2_VOID_COMP_AMT > 0 ? 'warn' : ''],
        ['Unauthorized Voids %',    pct(d.S2_VOIDS_NO_APPROVAL_PCT), d.S2_VOIDS_NO_APPROVAL_PCT > 0 ? 'warn' : ''],
        ['Discount % of Sales',     d.S2_DISCOUNT_PCT != null ? d.S2_DISCOUNT_PCT + '%' + (d.S2_DISCOUNT_BENCHMARK_PCT != null ? ' (Benchmark: under ' + d.S2_DISCOUNT_BENCHMARK_PCT + '%)' : '') : '', (d.S2_DISCOUNT_PCT != null && d.S2_DISCOUNT_BENCHMARK_PCT != null && d.S2_DISCOUNT_PCT > d.S2_DISCOUNT_BENCHMARK_PCT) ? 'warn' : ''],
        ['Discount Total',          d.S2_DISCOUNT_PCT != null ? cur(d.S2_DISCOUNT_TOTAL) : ''],
        ['No-Sale Drawer Opens',    d.S2_NO_SALE_COUNT != null ? num(d.S2_NO_SALE_COUNT) : '', d.S2_NO_SALE_COUNT > 0 ? 'warn' : ''],
        ['Drawer Reconciliation',   d.S2_DRAWER_RECON],
        ['Cash Policy Documented',  d.S2_CASH_POLICY],
        ['Void Approval Required',  d.S2_VOID_APPROVAL],
        ['Spillage Log',            d.S2_SPILLAGE_LOG],
        ['Monthly Gap',             cur(d.S2_MONTHLY_GAP), d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(3, NAMES[2], d.S3_SCORE, [
        ['Food Cost %',             pct(d.S3_FOOD_COST_PCT, d.S3_TARGET_PCT), d.S3_FOOD_COST_PCT > d.S3_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Food Revenue',    cur(d.S3_FOOD_REV_MONTHLY)],
        ['Food Variance %',         pct(d.S3_FOOD_VAR_PCT), d.S3_FOOD_VAR_PCT > 3 ? 'warn' : ''],
        ['Food Variance $',         cur(d.S3_FOOD_VAR_AMT)],
        ['Recipe Coverage',         d.S3_RECIPE_COVERAGE],
        ['Inventory Frequency',     d.S3_INV_FREQ],
        ['Waste Log',               d.S3_WASTE_LOG],
        ['Monthly Gap vs Target',   cur(d.S3_MONTHLY_GAP), d.S3_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S3_ANNUAL_GAP), d.S3_ANNUAL_GAP > 0 ? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(4, NAMES[3], d.S4_SCORE, [
        ['Bev Invoice Count',       num(d.S4_BEV_INVOICE_COUNT)],
        ['Food Invoice Count',      num(d.S4_FOOD_INVOICE_COUNT)],
        ['Monthly Vendor Spend',    cur(d.S4_VENDOR_SPEND_MONTHLY)],
        ['Invoice vs PO Matching',  d.S4_INVOICE_VS_PO],
        ['Price Verification',      d.S4_PRICE_VERIFY],
        ['Uncollected Vendor Credits', d.S4_UNCOLLECTED_CREDITS != null ? cur(d.S4_UNCOLLECTED_CREDITS) + (d.S4_OPEN_CREDIT_COUNT ? ' across ' + d.S4_OPEN_CREDIT_COUNT + ' open' : '') : '', d.S4_UNCOLLECTED_CREDITS > 0 ? 'warn' : ''],
        ['Credits Recovered',       d.S4_RECOVERED_CREDITS != null ? cur(d.S4_RECOVERED_CREDITS) : ''],
        ['Credit Recovery Rate',    d.S4_CREDIT_RECOVERY_PCT != null ? d.S4_CREDIT_RECOVERY_PCT + '%' : '', (d.S4_CREDIT_RECOVERY_PCT != null && d.S4_CREDIT_RECOVERY_PCT < 40) ? 'warn' : ''],
        ['Monthly Exposure',        cur(d.S4_EXPOSURE_MONTHLY), d.S4_EXPOSURE_MONTHLY > 500 ? 'warn' : ''],
        ['Annual Exposure',         cur(d.S4_EXPOSURE_ANNUAL),  d.S4_EXPOSURE_ANNUAL  > 5000? 'warn' : ''],
      ], null, d),
      AuditUI.sectionBlock(5, NAMES[4], d.S5_SCORE, [
        ['Total Revenue Period',    cur(d.S5_TOTAL_REV_PERIOD)],
        ['Total COGS Period',       cur(d.S5_TOTAL_COGS_PERIOD)],
        ['Labor Period',            cur(d.S5_LABOR_PERIOD)],
        ['Labor %',                 pct(d.S5_LABOR_PCT), d.S5_LABOR_PCT > 35 ? 'warn' : ''],
        ['Bar Pour Cost %',         pct(d.S5_BAR_COST_PCT)],
        ['Food Cost %',             pct(d.S5_FOOD_COST_PCT)],
        ['Prime Cost %',            pct(d.S5_PRIME_COST_PCT, d.S5_TARGET_PCT), d.S5_PRIME_COST_PCT > (d.S5_TARGET_PCT||60) ? 'warn' : 'good'],
        ['Prime Cost Amount',       cur(d.S5_PRIME_COST_AMT)],
        ['RPLH Tracked',            d.S5_RPLH_TRACKED],
        ['Labor by Department',     d.S5_LABOR_BY_DEPT],
        ['Monthly COGS Gap',        cur(d.S5_COMBINED_COGS_GAP), d.S5_COMBINED_COGS_GAP > 0 ? 'warn' : ''],
      ], null, d),
      ...(signals6.length ? [AuditUI.sectionBlock(6, 'Operational Risk Signals', null, [], signals6, d)] : []),
    ].join('');

    this.container.innerHTML = '<div class="screen">'
      + AuditUI.viewHero(audit, 'Profit Recovery Audit', 'at')
      + AuditUI.recoverStrip(audit)
      + AuditUI.sectionScoreboard(audit, NAMES, audits[idx + 1])
      + AuditUI.actionsArea(audit, 'profit', 'at')
      + sections
      + '</div>';

    AuditUI.attachOutlook('at', audit, 'profit');
    this.container.querySelector('.at-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.at-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => { App._fixFocus = btn.dataset.gap; App.navigate('profit-fix'); });
    });
  },

  // ── Export the Profit Recovery Audit as a data-driven PDF ───────────────
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
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null && v !== 0 ? String(v) : '';
    const gap = (v) => v > 0 ? cur(v) : v < 0 ? (cur(Math.abs(v)) + ' under target') : '';

    const venue = audit.bar_name || App.data.settings.bar_name || 'Your Bar';
    const metaBits = [(audit.date || '').slice(0, 10)];
    if (audit.audit_period) metaBits.push(audit.audit_period);
    if (audit.audit_id)     metaBits.push(audit.audit_id);

    const b = App._pdfBuilder('Profit Recovery Audit');
    b.header({
      right: 'Profit Recovery Audit',
      meta: metaBits.join('  ·  ') + '  ·  Profit Score ' + (audit.overall_score || 0)
    });
    b.kv('Operation', venue);
    b.kv('Profit Score', (audit.overall_score || 0) + '  (' + App.scoreLabel(audit.overall_score || 0) + ')');
    if (audit.grade) b.kv('Data Quality', audit.grade);
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
        ['Inventory Variance %',   pct(d.S1_INV_VARIANCE_PCT)],
        ['Inventory Variance $',   cur(d.S1_INV_VARIANCE_AMT)],
        ['Draft Beer Yield',       d.S1_DRAFT_YIELD_PCT != null ? d.S1_DRAFT_YIELD_PCT + '%' : ''],
        ['Draft Yield Loss',       d.S1_DRAFT_LOSS_PCT != null ? d.S1_DRAFT_LOSS_PCT + '% to foam and over-pour' : ''],
        ['Pour Method',            d.S1_POUR_METHOD],
        ['Recipe Coverage',        d.S1_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',  gap(d.S1_MONTHLY_GAP) || (d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : '')],
        ['Annual Gap',             cur(d.S1_ANNUAL_GAP)]
      ]],
      [2, NAMES[1], d.S2_SCORE, [
        ['Void/Comp %',            pct(d.S2_VOID_COMP_PCT)],
        ['Void/Comp Amount',       cur(d.S2_VOID_COMP_AMT)],
        ['Unauthorized Voids %',   pct(d.S2_VOIDS_NO_APPROVAL_PCT)],
        ['Discount % of Sales',    d.S2_DISCOUNT_PCT != null ? d.S2_DISCOUNT_PCT + '%' + (d.S2_DISCOUNT_BENCHMARK_PCT != null ? ' (Benchmark: under ' + d.S2_DISCOUNT_BENCHMARK_PCT + '%)' : '') : ''],
        ['Discount Total',         d.S2_DISCOUNT_PCT != null ? cur(d.S2_DISCOUNT_TOTAL) : ''],
        ['No-Sale Drawer Opens',   d.S2_NO_SALE_COUNT != null ? num(d.S2_NO_SALE_COUNT) : ''],
        ['Drawer Reconciliation',  d.S2_DRAWER_RECON],
        ['Cash Policy Documented', d.S2_CASH_POLICY],
        ['Void Approval Required', d.S2_VOID_APPROVAL],
        ['Spillage Log',           d.S2_SPILLAGE_LOG],
        ['Monthly Gap',            cur(d.S2_MONTHLY_GAP)]
      ]],
      [3, NAMES[2], d.S3_SCORE, [
        ['Food Cost %',            pct(d.S3_FOOD_COST_PCT, d.S3_TARGET_PCT)],
        ['Monthly Food Revenue',   cur(d.S3_FOOD_REV_MONTHLY)],
        ['Food Variance %',        pct(d.S3_FOOD_VAR_PCT)],
        ['Food Variance $',        cur(d.S3_FOOD_VAR_AMT)],
        ['Recipe Coverage',        d.S3_RECIPE_COVERAGE],
        ['Inventory Frequency',    d.S3_INV_FREQ],
        ['Waste Log',              d.S3_WASTE_LOG],
        ['Monthly Gap vs Target',  cur(d.S3_MONTHLY_GAP)],
        ['Annual Gap',             cur(d.S3_ANNUAL_GAP)]
      ]],
      [4, NAMES[3], d.S4_SCORE, [
        ['Bev Invoice Count',      num(d.S4_BEV_INVOICE_COUNT)],
        ['Food Invoice Count',     num(d.S4_FOOD_INVOICE_COUNT)],
        ['Monthly Vendor Spend',   cur(d.S4_VENDOR_SPEND_MONTHLY)],
        ['Invoice vs PO Matching', d.S4_INVOICE_VS_PO],
        ['Price Verification',     d.S4_PRICE_VERIFY],
        ['Uncollected Vendor Credits', d.S4_UNCOLLECTED_CREDITS != null ? cur(d.S4_UNCOLLECTED_CREDITS) + (d.S4_OPEN_CREDIT_COUNT ? ' across ' + d.S4_OPEN_CREDIT_COUNT + ' open' : '') : ''],
        ['Credits Recovered',      d.S4_RECOVERED_CREDITS != null ? cur(d.S4_RECOVERED_CREDITS) : ''],
        ['Credit Recovery Rate',   d.S4_CREDIT_RECOVERY_PCT != null ? d.S4_CREDIT_RECOVERY_PCT + '%' : ''],
        ['Monthly Exposure',       cur(d.S4_EXPOSURE_MONTHLY)],
        ['Annual Exposure',        cur(d.S4_EXPOSURE_ANNUAL)]
      ]],
      [5, NAMES[4], d.S5_SCORE, [
        ['Total Revenue Period',   cur(d.S5_TOTAL_REV_PERIOD)],
        ['Total COGS Period',      cur(d.S5_TOTAL_COGS_PERIOD)],
        ['Labor Period',           cur(d.S5_LABOR_PERIOD)],
        ['Labor %',                pct(d.S5_LABOR_PCT)],
        ['Bar Pour Cost %',        pct(d.S5_BAR_COST_PCT)],
        ['Food Cost %',            pct(d.S5_FOOD_COST_PCT)],
        ['Prime Cost %',           pct(d.S5_PRIME_COST_PCT, d.S5_TARGET_PCT)],
        ['Prime Cost Amount',      cur(d.S5_PRIME_COST_AMT)],
        ['RPLH Tracked',           d.S5_RPLH_TRACKED],
        ['Labor by Department',    d.S5_LABOR_BY_DEPT],
        ['Monthly COGS Gap',       cur(d.S5_COMBINED_COGS_GAP)]
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

    // Section 6 — Operational Risk Signals (only when present).
    const signals6 = [
      {score:d.S6_SIG1_SCORE, label:d.S6_SIG1_LABEL, evidence:d.S6_SIG1_EVIDENCE, gap:d.S6_SIG1_GAP, tool:d.S6_SIG1_TOOL},
      {score:d.S6_SIG2_SCORE, label:d.S6_SIG2_LABEL, evidence:d.S6_SIG2_EVIDENCE, gap:d.S6_SIG2_GAP, tool:d.S6_SIG2_TOOL},
      {score:d.S6_SIG3_SCORE, label:d.S6_SIG3_LABEL, evidence:d.S6_SIG3_EVIDENCE, gap:d.S6_SIG3_GAP, tool:d.S6_SIG3_TOOL},
      {score:d.S6_SIG4_SCORE, label:d.S6_SIG4_LABEL, evidence:d.S6_SIG4_EVIDENCE, gap:d.S6_SIG4_GAP, tool:d.S6_SIG4_TOOL}
    ].filter(s => s.label);
    if (signals6.length) {
      b.sectionTitle('Section 6  ·  Operational Risk Signals');
      b.table(['Risk', 'Signal', 'Evidence', 'Gap', 'Tool'], signals6.map(s => [
        (s.score || '').toUpperCase(),
        s.label || '',
        s.evidence || '',
        s.gap || '',
        s.tool || ''
      ]), { columnStyles: { 0: { cellWidth: 50 } } });
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
    await b.save('BarCop_ProfitAudit_' + ds + '.pdf');
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings text now renders inline under each section via findingsBlock()
  // inside the sectionBlock helper in viewAudit().

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    // Pre-fill from Hub Settings if available so the operator only types
    // these numbers once across the whole platform (per the "Bar Cop knows
    // this already" rule). They can still override before running the audit.
    const s = App.data?.settings || {};
    // Operating practices persist across audits. They pre-fill from last time
    // so the operator just updates what changed (e.g. Free pour -> Jiggered)
    // and watches the score move. Defaults describe an uncontrolled operation.
    const p = s.profit_practices || {};
    // Stored as dropdown strings. Unanswered = '' so a brand-new audit starts
    // every question on "Select Answer" and an unanswered question has zero
    // effect on the score. Returning audits pre-fill the operator's last
    // answers so they only change what improved.
    const boolStr = v => v === true ? 'true' : v === false ? 'false' : (v || '');
    this._intakeDraft = {
      barRev:  s.annual_bar_revenue  != null ? String(s.annual_bar_revenue)  : '',
      foodRev: s.annual_food_revenue != null ? String(s.annual_food_revenue) : '',
      practices: {
        pour_method:    p.pour_method    || '',
        recipes_costed: p.recipes_costed || '',
        inv_freq:       p.inv_freq       || '',
        void_approval:  boolStr(p.void_approval),
        drawer_recon:   boolStr(p.drawer_recon),
        invoice_vs_po:  p.invoice_vs_po  || '',
        backup_vendors: p.backup_vendors || ''
      }
    };
    this.actions.innerHTML = '';
    this.renderIntake();
  },

  // Single-page Profit intake. Revenue is the only required input; every upload
  // is optional because an operator running Control already has the data, and
  // the slots map 1:1 to the sections computeProfitAudit scores.
  renderIntake() {
    const d = this._intakeDraft || {};
    document.getElementById('topbar-sub').textContent = '';
    // The form is always viewable so the operator can review/update inputs. The
    // weekly cadence gates only the Generate action.
    const _a = (App.data.audits || []).slice().sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    const _since = _a[0] && _a[0].date ? Math.floor((Date.now() - new Date(_a[0].date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = _since >= 7;
    const daysLeft = canRun ? 0 : 7 - _since;

    // Pills — every section the audit can pull from Control. Always listed:
    // greyed until that data exists, gold-tint when Bar Cop is using it.
    const cd = this.buildControlData();
    const checks = [
      { label: 'Bar Pour Cost',   ok: cd && cd.bar_cost_pct != null },
      { label: 'Food Cost',       ok: cd && cd.food_cost_pct != null },
      { label: 'Prime Cost',      ok: cd && cd.prime_cost_pct != null },
      { label: 'Voids and Comps', ok: cd && cd.void_comp_count > 0 },
      { label: 'Cash Variance',   ok: cd && cd.cash_reconciliations > 0 },
      { label: 'Vendor Drift',    ok: cd && cd.deliveries_logged > 0 },
      { label: 'Payroll / Labor', ok: cd && cd.labor_hours > 0 }
    ];

    const salesCard = AuditUI.formCard('Annual Sales',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Sets the dollar baselines for the audit. Enter at least one; leave Food blank if you run no kitchen.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + AuditUI.moneyField('at-iz-bar-rev', 'Annual Bar Sales', '618000', d.barRev)
      + AuditUI.moneyField('at-iz-food-rev', 'Annual Food Sales', '372000', d.foodRev)
      + '</div>'
      + AuditUI.intakeHasBlock('What Bar Cop Already Has', 'Highlighted sections pull from your Control data automatically. The greyed ones fill in as you log them, or from an upload below.', checks));

    const uploadCard = AuditUI.formCard('Your Reports',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Optional. Drop in a report to score a section Bar Cop cannot see yet. One drop zone takes them all.</div>'
      + FileDrop.render('at-drop', { items: [
          { t: 'Profit and Loss or Monthly Sales Summary', s: 'Scores Bar Cost, Food Cost and Prime Cost (revenue, COGS and labor in one report).' },
          { t: 'Voids, Comps and Cash Report',             s: 'Scores Theft and Loss (void and comp rate, unapproved voids, cash variance).' },
          { t: 'Invoices and Vendor Pricing',              s: 'Scores Vendor Control (invoice matching, price drift).' },
          { t: 'Recipe Costing Sheet',                     s: 'Adds repricing opportunities ranked by dollar impact, and recipe coverage.', hi: true },
          { t: 'Inventory Count Sheets (Bar and Kitchen)', s: 'Adds per-product pour and food cost variance.' }
        ] }));

    // Operating-practice questions. Answers persist and pre-fill the next audit.
    const pr = d.practices || {};
    const questionsCard = AuditUI.formCard('A Few Quick Questions',
      '<div style="font-size:12px;color:var(--t3);margin-bottom:6px;">These shape your scores and are not in your reports. Answer what applies; the rest carry over to next time.</div>'
      + AuditUI.intakeQRow('at', 'How do you pour spirits?', 'pour_method', [['Free pour','Free pour'],['Jiggered/measured','Jiggered or measured']], pr.pour_method)
      + AuditUI.intakeQRow('at', 'Are your recipes costed?', 'recipes_costed', [['none','None'],['some','Some'],['all','All']], pr.recipes_costed)
      + AuditUI.intakeQRow('at', 'How often do you count inventory?', 'inv_freq', [['Never','Never'],['Monthly','Monthly'],['Weekly','Weekly']], pr.inv_freq)
      + AuditUI.intakeQRow('at', 'Manager approval on voids and comps?', 'void_approval', [['false','No'],['true','Yes']], pr.void_approval)
      + AuditUI.intakeQRow('at', 'Drawer reconciled every shift?', 'drawer_recon', [['false','No'],['true','Yes']], pr.drawer_recon)
      + AuditUI.intakeQRow('at', 'Invoices matched to orders?', 'invoice_vs_po', [['Never matched','Never'],['Spot checked','Spot check'],['Matched every delivery','Every delivery']], pr.invoice_vs_po));

    this.container.innerHTML = '<div class="screen">' + salesCard + uploadCard + questionsCard + AuditUI.intakeSubmit('at') + '</div>';
    FileDrop.attach('at-drop');

    document.getElementById('at-iz-cancel')?.addEventListener('click', () => { document.getElementById('topbar-sub').textContent = ''; this.renderMain(); });
    document.getElementById('at-iz-submit')?.addEventListener('click', () => {
      const barRev = parseFloat(document.getElementById('at-iz-bar-rev')?.value) || 0;
      const foodRev = parseFloat(document.getElementById('at-iz-food-rev')?.value) || 0;
      if (barRev === 0 && foodRev === 0) {
        const st = document.getElementById('at-iz-status');
        if (st) { st.style.display = 'block'; st.style.color = 'var(--red)'; st.textContent = 'Enter at least one sales figure to run the audit.'; }
        return;
      }
      this._intakeDraft.barRev = document.getElementById('at-iz-bar-rev')?.value || '';
      this._intakeDraft.foodRev = document.getElementById('at-iz-food-rev')?.value || '';
      const val = id => (document.getElementById('at-q-' + id) || {}).value || '';
      this._intakeDraft.practices = {
        pour_method:    val('pour_method'),
        recipes_costed: val('recipes_costed'),
        inv_freq:       val('inv_freq'),
        void_approval:  val('void_approval'),
        drawer_recon:   val('drawer_recon'),
        invoice_vs_po:  val('invoice_vs_po'),
        backup_vendors: val('backup_vendors')
      };
      this.generateAudit();
    });
  },

  showHowTo() {
    App.showHelpModal('How the Profit Audit Works', [
      { p: ['The Profit Audit scores five areas: Bar Cost, Theft and Loss, Food Cost, Vendor Control, and Prime Cost. It scores whatever data it can see and shows N/A for anything it cannot, so the more you give it, the more it covers.'] },
      { h: 'What Bar Cop already has', p: ['If you run the Inventory, Shift, and Labor Control systems, those numbers feed the audit automatically as verified ground truth. A brand-new operation has none yet, so this first audit reads from what you enter and upload.'] },
      { h: 'The steps', p: ['1. Enter your annual sales (the dollar baseline). A bar with no kitchen leaves Food blank.', '2. Upload any reports that cover a section Bar Cop cannot see yet (a P&L covers Bar, Food, and Prime in one file).', '3. Answer the quick questions about how you operate.', '4. Generate. Sections with no data show N/A and fill in as you log more.'] },
      { h: 'Reading your results', p: ['Generate gives you a scored breakdown: an overall score up top, a score for each of the five areas (N/A where there is no data yet), and a Recoverable Per Month figure with its annualized number. Below that sit your Action Items, ranked by dollar impact, each with a Fix This button that drops you straight into Profit Fix on that exact gap. Bar Cop Briefing is a short written read of where you stand, and Export PDF saves the whole audit. Run one a week; it scores your trailing four weeks, and each is saved so you can watch the score trend on the audit landing.'] },
      { h: 'The honest rule', p: ['Every score and dollar figure is computed in code from your real numbers, the same every time. A section with no data is left out, never guessed.'] }
    ]);
  },

  async generateAudit() {
    if (App.demoBlock('Running an audit')) return;
    // Show generating state in the current container
    const submitBtn = document.getElementById('at-iz-submit');
    const statusEl  = document.getElementById('at-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    // Single shared drop zone — all files pool under one field; the server
    // extraction reads them together regardless of field name.
    const allFiles = FileDrop.getFiles('at-drop').map(f => ({ file: f, field: 'file' }));

    const barRev  = parseFloat(this._intakeDraft?.barRev)  || 0;
    const foodRev = parseFloat(this._intakeDraft?.foodRev) || 0;

    // Validation — do not run an audit with nothing to analyze
    const hasRealData = allFiles.length > 0 || (App.data.weeks && App.data.weeks.length > 0) || barRev > 0 || foodRev > 0;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your POS reports.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

    setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

    try {
      const draftP = this._intakeDraft?.practices || {};
      // Remember revenue + operating practices (as dropdown strings) so the
      // next audit pre-fills them and the operator only changes what improved.
      App.data.settings.annual_bar_revenue  = barRev;
      App.data.settings.annual_food_revenue = foodRev;
      App.data.settings.profit_practices    = draftP;
      await App.saveKey('settings');

      // Convert to the engine's shape. An unanswered question ('') is omitted
      // so it has no effect on the score.
      const practices = {};
      if (draftP.pour_method)    practices.pour_method    = draftP.pour_method;
      if (draftP.recipes_costed) practices.recipes_costed = draftP.recipes_costed;
      if (draftP.inv_freq)       practices.inv_freq       = draftP.inv_freq;
      if (draftP.invoice_vs_po)  practices.invoice_vs_po  = draftP.invoice_vs_po;
      if (draftP.backup_vendors) practices.backup_vendors = draftP.backup_vendors;
      if (draftP.void_approval === 'true' || draftP.void_approval === 'false') practices.void_approval = draftP.void_approval === 'true';
      if (draftP.drawer_recon === 'true' || draftP.drawer_recon === 'false')   practices.drawer_recon  = draftP.drawer_recon === 'true';

      const auditAppData = JSON.parse(JSON.stringify(App.data));

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      form.append('practices', JSON.stringify(practices));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));
      for (const {file, field} of allFiles) form.append(field, file, file.name);

      setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

      const res  = await fetch('/api/generate-profit-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');

      setStatus('Saving audit...', 'var(--gold)');
      const d = data.auditData || {};

      const auditRecord = {
        id:            App.uid(),
        date:          App.todayLocal(),
        bar_name:      d.BAR_NAME || App.data.settings.bar_name,
        overall_score: d.OVERALL_SCORE || 0,
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
      await App.putRecord('core', 'audit', auditRecord);
      App.markSetupDone('gs_p_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message||'Generation failed. Please try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
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
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Reduce bar pour cost. $' + Math.round(d.S1_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S1_MONTHLY_GAP, gap_id: 'pour-cost' });
    // Draft yield loss routes to the same pour-cost lever. No separate dollar
    // (monthly_impact 0) — the loss already sits inside the bar pour cost gap.
    if (d.S1_DRAFT_LOSS_PCT != null && d.S1_DRAFT_LOSS_PCT >= 12) items.push({ action: 'Cut draft yield loss. ' + d.S1_DRAFT_LOSS_PCT + '% of every keg is going to foam and over-pour. Tune line temperature, pressure, and pour discipline.', monthly_impact: 0, gap_id: 'pour-cost' });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Reduce food cost. $' + Math.round(d.S3_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S3_MONTHLY_GAP, gap_id: 'food-cost' });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Address void and comp rate. $' + Math.round(d.S2_MONTHLY_GAP) + '/month in excess.', monthly_impact: d.S2_MONTHLY_GAP, gap_id: 'theft-loss' });
    // Discount + no-sale theft vectors. Surfaced as flagged behavior (no separate
    // recoverable dollar — not all discounts are recoverable, and no-sale opens
    // have no honest dollar without an investigation).
    if (d.S2_DISCOUNT_PCT != null && d.S2_DISCOUNT_BENCHMARK_PCT != null && d.S2_DISCOUNT_PCT > d.S2_DISCOUNT_BENCHMARK_PCT) items.push({ action: 'Tighten discount control. Discounts are ' + d.S2_DISCOUNT_PCT + '% of sales vs an under-' + d.S2_DISCOUNT_BENCHMARK_PCT + '% benchmark. Require manager authorization on every discount.', monthly_impact: 0, gap_id: 'theft-loss' });
    if (d.S2_NO_SALE_COUNT >= 10) items.push({ action: 'Review no-sale drawer opens. ' + d.S2_NO_SALE_COUNT + ' no-sale register opens this period. Set a no-sale policy and log a reason for every one, it is the simplest cover for pocketing cash.', monthly_impact: 0, gap_id: 'theft-loss' });
    if (d.S4_EXPOSURE_MONTHLY > 0) items.push({ action: 'Improve vendor verification. $' + Math.round(d.S4_EXPOSURE_MONTHLY) + '/month exposure.', monthly_impact: d.S4_EXPOSURE_MONTHLY, gap_id: 'vendor-control' });
    // Uncollected vendor credits are real filed overcharges. Surfaced with the
    // actual dollar in text; monthly_impact 0 (a one-time recovery, not monthly,
    // and kept out of the headline so it never double-counts vendor exposure).
    if (d.S4_UNCOLLECTED_CREDITS > 0) items.push({ action: 'Chase your filed vendor credits. $' + Math.round(d.S4_UNCOLLECTED_CREDITS) + ' in flagged overcharges is filed but not yet recovered across ' + (d.S4_OPEN_CREDIT_COUNT || 0) + ' open discrepanc' + (d.S4_OPEN_CREDIT_COUNT === 1 ? 'y' : 'ies') + '. The work of catching it is already done.', monthly_impact: 0, gap_id: 'vendor-control' });
    // Prime cost (S5_COMBINED_COGS_GAP) is the bar + food COGS overage, i.e. it
    // already equals S1 + S3. It is shown as context on the Prime Cost section,
    // never added here as a recoverable item, or the Total Recoverable would
    // double-count the same dollars. (Decision: audit-honesty-rebuild.)
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
    let windowStart = null;
    if (weeks.length) {
      const ends = weeks.map(w => w.period_end).sort();
      const d = new Date(ends[0] + 'T00:00:00');
      d.setDate(d.getDate() - 6);          // include the full first week of the window
      windowStart = isNaN(d) ? null : d;
    }
    const inWindow = (rec) => {
      if (!windowStart) return true;       // no weekly data — do not filter
      const ds = rec && (rec.date || rec.created_at);
      if (!ds) return true;                // undated — include rather than silently drop
      const rd = new Date(('' + ds).slice(0, 10) + 'T00:00:00');
      return isNaN(rd) ? true : rd >= windowStart;
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
    const spots = (inv.ic_spot_checks || []).filter(inWindow);
    if (spots.length) {
      cd.spot_checks = spots.length;
      cd.spot_check_flagged = spots.reduce((s,c) => s + (c.flagged_count || 0), 0);
      cd.spot_check_variance_dollar = r1(spots.reduce((s,c) => s + (c.total_variance_dollar || 0), 0));
      cd.sources.push('Inventory Control spot checks');
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
      // Add fixed salaried (exempt) cost over the span the windowed actuals cover.
      const dts = actuals.map(a => a.date).filter(Boolean).sort();
      if (dts.length) laborCost += App.salariedCost(dts[0], dts[dts.length - 1]).total;
      cd.labor_cost = Math.round(laborCost);
      cd.sources.push('Labor Control actuals');
    }

    return cd.sources.length ? cd : null;
  }
};
