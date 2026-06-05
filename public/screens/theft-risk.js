'use strict';

/* ── Profit Recovery — Theft Risk (auto-scored) ───────────────────────────────
   Restructured per the platform map: the Theft Risk score is computed from
   operational data — Inventory Control spot checks (ic_spot_checks), Shift
   Control voids/comps (sc_void_comps), and cash variances (sc_variances) — plus
   a manual judgment the operator can add. No more 12-question manual scorecard.
   Snapshots are saved to App.data.theft_scores. */

S.TheftRisk = {
  _manual: null,
  MANUAL_LEVELS: [
    { label: 'Strong controls',  score: 5 },
    { label: 'Adequate controls', score: 30 },
    { label: 'Some concern',     score: 60 },
    { label: 'Serious concern',  score: 90 }
  ],
  spotChecks() { return ((App.inventoryData && App.inventoryData.ic_spot_checks) || []); },
  // Only loss-bearing voids/comps. A comp's reason carries its classification:
  // Staff Meal and Shift Drink are policy expense and do NOT inflate the signal;
  // every customer-facing comp counts as loss. Voids always count (a voided
  // drink could still have been poured). Single source: App.compReasonIsLoss.
  voidComps() {
    return ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => {
      if (r.type === 'Void') return true;
      return App.compReasonIsLoss(r.reason || r.category);
    });
  },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  adjustments() { return ((App.inventoryData && App.inventoryData.ic_adjustments) || []); },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },

  manualScore(level) {
    const m = this.MANUAL_LEVELS.find(x => x.label === level);
    return m ? m.score : null;
  },
  scoreClass(score) {
    if (score == null) return 'dim';
    return score <= 30 ? 'good' : score <= 60 ? '' : 'warn';
  },
  ratingFor(score) {
    if (score == null) return 'Not Enough Data';
    return score <= 30 ? 'Low Risk: Strong Controls'
         : score <= 60 ? 'Moderate Risk: Tighten Controls'
         : 'High Risk: Immediate Action';
  },

  // ── Signals ─────────────────────────────────────────────────────────────────
  // Minimum samples before a signal scores. Below these, a single flag would
  // swing the score wildly, so the signal returns null (Not Enough Data) and is
  // excluded from the blended score rather than reported as confident risk.
  MIN_POUR_ITEMS: 8,
  MIN_VOIDS: 10,
  MIN_VARIANCES: 5,

  pourSignal() {
    const items = [];
    this.spotChecks().forEach(c => (c.items || []).forEach(it => items.push(it)));
    if (items.length < this.MIN_POUR_ITEMS) return { score: null, checks: this.spotChecks().length, items: items.length, insufficient: true };
    const flagged = items.filter(i => i.flagged).length;
    const rate = flagged / items.length;
    const varDollar = items.reduce((t, i) => t + Math.max(0, i.variance_dollar || 0), 0);
    // Transparent: the risk score IS the flagged-pour rate as a percent.
    return {
      score: Math.min(100, Math.round(rate * 100)),
      checks: this.spotChecks().length, items: items.length,
      flagged, rate, varDollar
    };
  },
  voidSignal() {
    const vc = this.voidComps();
    if (vc.length < this.MIN_VOIDS) return { score: null, count: vc.length, insufficient: true };
    const unauth = vc.filter(r => !r.authorized_by || !String(r.authorized_by).trim()).length;
    const rate = unauth / vc.length;
    const total = vc.reduce((t, r) => t + (r.amount || 0), 0);
    // Risk score = share of voids/comps rung without manager authorization.
    return {
      score: Math.min(100, Math.round(rate * 100)),
      count: vc.length, unauth, rate, total
    };
  },
  cashSignal() {
    const vars = this.variances();
    if (vars.length < this.MIN_VARIANCES) return { score: null, count: vars.length, insufficient: true };
    const shorts = vars.filter(v => v.status === 'Short');
    const rate = shorts.length / vars.length;
    const netShort = vars.reduce((t, v) => t + Math.min(0, v.variance || 0), 0);
    // Risk score = share of drawer reconciliations that came up short.
    return {
      score: Math.min(100, Math.round(rate * 100)),
      count: vars.length, shorts: shorts.length, rate, netShort
    };
  },

  // Unauthorized large comps. Reads sc_void_comps where auth_threshold_override
  // is true — meaning the operator saved a Comp over the Hub Settings threshold
  // without a manager in Authorized By and acknowledged the warning. This is
  // one of the most common bar-theft patterns (bartender comping a round of
  // drinks without manager involvement) and the auth override is the explicit
  // signal that it happened. 90-day window.
  unauthorizedLargeCompsSignal() {
    const all = ((App.shiftData && App.shiftData.sc_void_comps) || []);
    if (all.length === 0) return { score: null, count: 0, total: 0 };
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = App.ymdLocal(cutoff);
    const flagged = all.filter(r =>
      r.auth_threshold_override === true && (r.date || '') >= cutoffStr);
    const total = flagged.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return {
      score: flagged.length > 0 ? Math.min(100, flagged.length * 20) : 0,
      count: flagged.length,
      total
    };
  },

  // Confirmed theft from the Inventory Adjustment log (reason='Theft'). These
  // are documented losses the operator has already attributed — strongest
  // signal of all four because there's no inference, just acknowledged events.
  // 90-day window so the score reflects what's recently happening, not
  // permanent history from years ago.
  theftConfirmedSignal() {
    const all = this.adjustments();
    if (all.length === 0) return { score: null, count: 0 };
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = App.ymdLocal(cutoff);
    const recent = all.filter(a => {
      if (a.reason !== 'Theft') return false;
      const date = (a.date_time || '').slice(0, 10);
      return date >= cutoffStr;
    });
    const totalValue = recent.reduce((t, a) => t + Math.abs(a.value || 0), 0);
    // 25 points per confirmed event, capped at 100. Stack value as context.
    return {
      score: recent.length > 0 ? Math.min(100, recent.length * 25) : 0,
      count: recent.length,
      totalValue
    };
  },

  render(container, actions) {
    this.container = container;
    const saved = (App.data && App.data.theft_manual) || {};
    this._manual = { level: saved.level || '', notes: saved.notes || '' };

    actions.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Save Scorecard';
    btn.addEventListener('click', () => this.save());
    actions.appendChild(btn);
    // Quarterly Theft & Loss Brief PDF — single-page summary for owner /
    // bookkeeper / insurance reviews. Generated from the data via the shared
    // App._pdfBuilder and saved straight to a file.
    const briefBtn = document.createElement('button');
    briefBtn.className = 'btn btn-ghost btn-sm';
    briefBtn.textContent = 'Print Theft & Loss Brief';
    briefBtn.addEventListener('click', () => this.printBrief());
    actions.appendChild(briefBtn);
    this.renderMain();
  },

  async printBrief() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const confirmed = this.theftConfirmedSignal();
    const unauthComps = this.unauthorizedLargeCompsSignal();
    const autoScores = [pour.score, voids.score, cash.score, confirmed.score, unauthComps.score].filter(s => s != null);
    const autoScore = autoScores.length ? Math.round(autoScores.reduce((a, b) => a + b, 0) / autoScores.length) : null;
    const manScore = this.manualScore(this._manual?.level);
    let overall;
    if (autoScore != null && manScore != null) overall = Math.round(autoScore * 0.65 + manScore * 0.35);
    else if (autoScore != null) overall = autoScore;
    else if (manScore != null) overall = manScore;
    else overall = null;

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const fmt$ = (v) => (v == null || isNaN(v)) ? '-' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 90-day window for the brief — same window the confirmed-theft signal uses.
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = App.ymdLocal(cutoff);
    const inWindow = (d) => d && String(d).slice(0, 10) >= cutoffStr;

    const recentVCs = this.voidComps().filter(r => inWindow(r.date));
    const recentVars = this.variances().filter(v => inWindow(v.date));
    const recentSpots = this.spotChecks().filter(c => inWindow(c.date));
    const recentAdj = this.adjustments().filter(a => inWindow((a.date_time || '').slice(0, 10)));

    const investigations = (App.data?.variance_investigations || []);
    const openInv = investigations.filter(i => i.status !== 'resolved');
    const resolvedInv = investigations.filter(i => i.status === 'resolved' && inWindow(i.resolved_date));

    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const dash = (s) => s != null ? s : '-';
    const b = App._pdfBuilder('Theft & Loss Brief');
    b.header({ right: 'Theft & Loss Brief', meta: '90-day review, generated ' + today });

    // ── Overall Risk Score ──
    b.sectionTitle('Overall Risk Score');
    b.heading((overall != null ? String(overall) : '-') + '   ' + this.ratingFor(overall), 18);
    if (autoScore != null) b.paragraph('Auto-score ' + autoScore + ' from operational data', { gray: 100, size: 9 });
    if (manScore != null) b.paragraph('Manual judgment ' + manScore, { gray: 100, size: 9 });

    // ── Signal Summary ──
    b.sectionTitle('Signal Summary');
    b.table(['Signal', 'Score', 'Detail'], [
      ['Pour Variance (spot checks)', dash(pour.score),
        pour.flagged ? pour.flagged + ' of ' + pour.items + ' flagged' : '-'],
      ['Voids & Comps (loss-bearing only)', dash(voids.score),
        voids.count ? voids.count + ' loss records, ' + fmt$(voids.total) : '-'],
      ['Cash Variance', dash(cash.score),
        cash.count ? cash.shorts + ' shorts of ' + cash.count + ' counts, ' + fmt$(Math.abs(cash.netShort)) + ' net short' : '-'],
      ['Unauthorized Large Comps', dash(unauthComps.score),
        unauthComps.count ? unauthComps.count + ' over threshold without auth, ' + fmt$(unauthComps.total) : '-'],
      ['Confirmed Theft (adjustment log)', dash(confirmed.score),
        confirmed.count ? confirmed.count + ' events, ' + fmt$(confirmed.totalValue) : '-']
    ], { columnStyles: { 1: { halign: 'right' } } });

    // ── 90-Day Event Counts ──
    b.sectionTitle('90-Day Event Counts');
    b.table(null, [
      ['Spot checks run', String(recentSpots.length)],
      ['Voids and comps logged (loss-bearing)', String(recentVCs.length)],
      ['Cash variances logged', String(recentVars.length)],
      ['Inventory adjustments logged', String(recentAdj.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    // ── Variance Investigations ──
    b.sectionTitle('Variance Investigations');
    b.table(null, [
      ['Open investigations', String(openInv.length)],
      ['Resolved in window', String(resolvedInv.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });
    if (openInv.length > 0) {
      b.paragraph('Open: ' + openInv.map(i => i.sku || '(unnamed)').join(', '), { gray: 70, size: 9 });
    }

    // ── Legal disclaimer (verbatim) ──
    b.disclaimer('Generated from your logged Bar Cop data on ' + today + '. '
      + 'Bar Cop is a software tool, not a forensic auditor, attorney, or insurance adjuster. '
      + 'Use this brief as a reference point for your own review; consult the relevant professional before acting on any conclusion.');

    await b.save('BarCop_VarianceInvestigation_' + App._pdfDateStamp() + '.pdf');
  },

  /* Guided Variance Investigation (Section 10) — the Fix System's 6-step
     variance process as a trackable workflow on a flagged product. */
  VARIANCE_STEPS: [
    { title: 'Verify the count',
      detail: 'Pull the product count sheets across the full period and check every storage location for a missed partial or a unit-of-measure error.' },
    { title: 'Calculate theoretical usage',
      detail: 'POS sales by drink type times recipe ounces, compared against the actual ounce movement from the count.' },
    { title: 'Identify the shifts',
      detail: 'Use the opening and closing counts to find which shifts the variance landed on.' },
    { title: 'Talk to the bar manager',
      detail: 'Ask what they noticed on those shifts: breakage, waste, comps, or unusual activity.' },
    { title: 'Run a mid-shift count',
      detail: 'Run an unannounced mid-shift count on the flagged product during a service period.' },
    { title: 'Document the finding',
      detail: 'Write down the finding and the resolution before closing, even when it is inconclusive.' }
  ],

  _inv(id) { return (App.data.variance_investigations || []).find(x => x.id === id); },

  // Live data for a specific product, pulled from the same Control sources
  // the Variance Report uses. Returns { step2, step3 } HTML strings, or empty
  // strings when no product_id (legacy free-text investigations).
  investigationLiveData(productId) {
    if (!productId) {
      return { step2: '<div style="font-size:11px;color:var(--t4);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">Open a new investigation from the dropdown above to wire live count + spot-check data into this step.</div>', step3: '' };
    }
    const p = this.productById(productId);
    if (!p) return { step2: '', step3: '' };

    // Step 2 — theoretical vs actual usage from the latest two ic_counts
    // bracket + deliveries between them. Same math the Usage Report uses.
    const counts = ((App.inventoryData && App.inventoryData.ic_counts) || []).slice()
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
    let step2Html = '';
    if (counts.length >= 2) {
      const start = counts[counts.length - 2], end = counts[counts.length - 1];
      const si = (start.items || []).find(it => it.product_id === productId);
      const ei = (end.items || []).find(it => it.product_id === productId);
      if (si && ei) {
        let purch = 0;
        ((App.inventoryData && App.inventoryData.ic_deliveries) || [])
          .filter(d => d.date > start.date && d.date <= end.date)
          .forEach(d => (d.line_items || []).forEach(li => {
            if (li.product_id === productId) purch += (App.unitsFromDeliveryLine ? App.unitsFromDeliveryLine(li) : (li.qty || 0));
          }));
        const used = (si.total || 0) + purch - (ei.total || 0);
        // Bottle beer is counted in cases (case_size servings/case); other
        // categories pour pours_per_container servings per container.
        const isCaseBeer = p.category === 'Bottle Beer' && p.case_size > 0;
        const pp = isCaseBeer ? p.case_size
          : (p.pours_per_container || (p.container_size_oz && p.pour_size_oz ? p.container_size_oz / p.pour_size_oz : 0));
        const actualPours = used * pp;
        const cost = (App.unitCost ? App.unitCost(p) : (p.unit_cost || 0)) || 0;
        const actualDollars = used * cost;
        step2Html = '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--gold);border-radius:3px;">'
          + '<div style="font-weight:700;color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Live Data &middot; ' + esc(start.date) + ' to ' + esc(end.date) + '</div>'
          + '<div>Used: <strong>' + used.toFixed(2) + ' containers</strong> (' + actualPours.toFixed(1) + ' pours, ' + App.fmtCurrency(actualDollars) + ')</div>'
          + '<div style="color:var(--t3);margin-top:4px;">Starting count ' + (si.total || 0).toFixed(2) + ' + purchases ' + purch.toFixed(2) + ' - ending count ' + (ei.total || 0).toFixed(2) + '</div>'
          + '<div style="color:var(--t3);margin-top:4px;">Compare against your POS pours sold for the same window. Variance Report in Inventory Control has the full POS-match math when you upload sales data.</div>'
          + '</div>';
      } else {
        step2Html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">This product was not counted on both of the last two inventories. Run a count in Inventory Control to populate the math here.</div>';
      }
    } else {
      step2Html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">Need two inventory counts to compute usage. Run a count in Inventory Control.</div>';
    }

    // Step 3 — recent spot checks where this product was flagged. Helps the
    // operator narrow which shifts the variance landed on.
    const recentSpots = this.spotChecks().slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(c => {
        const item = (c.items || []).find(i => i.product_id === productId);
        if (!item) return null;
        return { date: c.date, shift: c.shift, checked_by: c.checked_by, item };
      })
      .filter(Boolean)
      .slice(0, 5);
    let step3Html = '';
    if (recentSpots.length) {
      const rows = recentSpots.map(s => {
        const flag = s.item.flagged ? '<span style="color:var(--red);font-weight:700;">FLAGGED</span>' : '<span style="color:var(--t3);">ok</span>';
        const vd = s.item.variance_dollar != null ? App.fmtCurrency(s.item.variance_dollar) : '-';
        return '<div style="display:flex;gap:10px;padding:4px 0;font-size:11px;border-bottom:1px solid var(--b2);">'
          + '<span style="color:var(--t2);width:100px;">' + esc(s.date) + '</span>'
          + '<span style="color:var(--t3);width:90px;">' + esc(s.shift || '-') + '</span>'
          + '<span style="color:var(--t3);flex:1;">' + esc(s.checked_by || '-') + '</span>'
          + '<span style="width:80px;text-align:right;color:' + (s.item.flagged ? 'var(--red)' : 'var(--t2)') + ';">' + vd + '</span>'
          + '<span style="width:80px;text-align:right;">' + flag + '</span>'
          + '</div>';
      }).join('');
      step3Html = '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--gold);border-radius:3px;">'
        + '<div style="font-weight:700;color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Recent Spot Checks for This Product</div>'
        + rows
        + '</div>';
    }
    return { step2: step2Html, step3: step3Html };
  },

  // Paper worksheet operator can walk the back-bar with, then enter findings
  // into Bar Cop after. Same paper-to-digital pattern as the Shift Control logs.
  printBlankInvestigation() {
    App.printBlankSheet({
      title: 'Variance Investigation Worksheet',
      subtitle: 'Work the six steps in order on a single flagged product. Manager enters findings into Bar Cop after.',
      columns: [
        { label: 'Step',         width: '8%'  },
        { label: 'Task',         width: '32%' },
        { label: 'What You Did', width: '30%' },
        { label: 'Finding',      width: '30%' }
      ],
      rows: 6
    });
  },

  investigationsCard() {
    const invs = App.data.variance_investigations || [];
    const open = invs.filter(i => i.status !== 'resolved');
    const resolved = invs.filter(i => i.status === 'resolved');
    const inputStyle = 'background:var(--input);border:1px solid var(--b1);border-radius:3px;'
      + 'color:var(--t1);font-size:13px;padding:7px 10px;color-scheme:dark;';

    // Build the product dropdown grouped by category (Liquor, Wine, Beer first).
    const prods = this.products();
    const catOrder = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => {
        const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    let productOpts = '<option value="">Pick a product to investigate...</option>';
    cats.forEach(cat => {
      productOpts += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(p => {
          productOpts += '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
        });
      productOpts += '</optgroup>';
    });

    let html = '<div class="card"><div class="card-title">Variance Investigations</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
      + 'When a product shows unexplained variance, open an investigation and work the six steps in order. '
      + 'It keeps the process honest and leaves a record.</div>'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;margin-bottom:14px;">'
      + '<div class="f" style="width:280px;"><label>Flagged Product</label>'
      + '<select class="vi-product-select" style="' + inputStyle + 'width:100%;height:38px;">' + productOpts + '</select></div>'
      + '<button class="btn btn-primary vi-open-btn">Open Investigation</button>'
      + '<button class="btn btn-ghost btn-sm vi-print-blank" style="margin-left:auto;">Worksheet</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:18px;line-height:1.5;">'
      + 'Tip: a flagged Spot Check in Inventory Control can open an investigation pre-filled for you. Look for the Investigate button on the spot check detail.'
      + '</div>';

    open.forEach(inv => {
      const doneN = inv.steps.filter(s => s.done).length;
      html += '<div style="border:1px solid var(--b1);border-radius:4px;padding:16px;margin-bottom:14px;">'
        + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;">'
        + '<span style="font-size:13px;font-weight:800;color:var(--t1);text-transform:uppercase;letter-spacing:0.5px;">' + esc(inv.sku) + '</span>'
        + '<span style="font-size:11px;color:var(--t3);">opened ' + esc(inv.opened_date) + '</span>'
        + '<span style="font-size:11px;font-weight:700;color:var(--gold);margin-left:auto;">' + doneN + ' of 6 steps</span>'
        + '</div>';
      // Live data block for Step 2 (theoretical vs actual) and Step 3 (recent
      // spot checks) — only shows when the investigation is linked to a real
      // product_id (which the spot-check entry path + the new dropdown both
      // capture). Closes the orphan where Step 2 used to be "operator does
      // the math by hand."
      const liveData = this.investigationLiveData(inv.product_id);
      inv.steps.forEach((s, idx) => {
        const st = this.VARIANCE_STEPS[idx];
        let extra = '';
        if (idx === 1 && liveData.step2) extra = liveData.step2;  // theoretical vs actual
        if (idx === 2 && liveData.step3) extra = liveData.step3;  // shift attribution
        html += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--b2);">'
          + '<input type="checkbox" class="vi-step-check" data-inv="' + inv.id + '" data-step="' + idx + '"'
          + (s.done ? ' checked' : '') + ' style="margin-top:3px;flex-shrink:0;width:15px;height:15px;accent-color:var(--gold);"/>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:12px;font-weight:700;color:' + (s.done ? 'var(--t3)' : 'var(--t1)') + ';">'
          + (idx + 1) + '. ' + esc(st.title) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);line-height:1.55;margin:3px 0 6px;">' + esc(st.detail) + '</div>'
          + extra
          + '<input type="text" class="vi-finding" data-inv="' + inv.id + '" data-step="' + idx + '" '
          + 'value="' + esc(s.finding) + '" placeholder="What you found" style="' + inputStyle + 'width:100%;"/>'
          + '</div></div>';
      });
      html += '<div style="margin-top:12px;">'
        + '<label style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Resolution</label>'
        + '<textarea class="vi-resolution" data-inv="' + inv.id + '" rows="2" '
        + 'placeholder="The conclusion, even if inconclusive" style="' + inputStyle + 'width:100%;margin-top:5px;resize:vertical;">'
        + esc(inv.resolution || '') + '</textarea>'
        + '<div style="display:flex;gap:10px;margin-top:10px;">'
        + '<button class="btn btn-primary btn-sm vi-resolve-btn" data-inv="' + inv.id + '">Resolve and Close</button>'
        + '<button class="btn btn-ghost btn-sm vi-remove" data-inv="' + inv.id + '">Remove</button>'
        + '</div></div></div>';
    });
    if (!open.length) {
      html += '<div style="font-size:12px;color:var(--t4);">No open investigations.</div>';
    }

    if (resolved.length) {
      const resolvedNewest = resolved.slice().reverse();
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:18px 0 8px;">Resolved</div>'
        + resolvedNewest.slice(0, App.listLimit('core', 'variance_investigation')).map(inv =>
          '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--b2);font-size:12px;">'
          + '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:5px;"></span>'
          + '<div style="flex:1;min-width:0;"><span style="font-weight:700;color:var(--t1);">' + esc(inv.sku) + '</span> '
          + '<span style="color:var(--t3);">resolved ' + esc(inv.resolved_date || '') + '</span>'
          + (inv.resolution ? '<div style="color:var(--t2);line-height:1.55;margin-top:2px;">' + esc(inv.resolution) + '</div>' : '')
          + '</div>'
          + '<button class="btn btn-ghost btn-sm vi-remove" data-inv="' + inv.id + '">Remove</button>'
          + '</div>').join('')
        + App.showOlderBar('core', 'variance_investigation', resolvedNewest, false);
    }
    return html + '</div>';
  },

  renderMain() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const confirmed = this.theftConfirmedSignal();
    const unauthComps = this.unauthorizedLargeCompsSignal();
    const autoScores = [pour.score, voids.score, cash.score, confirmed.score, unauthComps.score].filter(s => s != null);
    const autoScore = autoScores.length ? Math.round(autoScores.reduce((a, b) => a + b, 0) / autoScores.length) : null;
    const manScore = this.manualScore(this._manual.level);

    let overall;
    if (autoScore != null && manScore != null) overall = Math.round(autoScore * 0.65 + manScore * 0.35);
    else if (autoScore != null) overall = autoScore;
    else if (manScore != null) overall = manScore;
    else overall = null;

    // ── Headline score ──
    const sc = this.scoreClass(overall);
    const scoreCard = '<div class="card"><div class="card-title">Theft Risk Score</div>'
      + '<div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;">'
      + '<div style="font-family:\'Barlow Condensed\';font-size:52px;font-weight:600;line-height:1;color:'
      + (sc === 'good' ? 'var(--gold)' : sc === 'warn' ? 'var(--red)' : 'var(--w)') + ';">'
      + (overall != null ? overall : '-') + '</div>'
      + '<div><div style="font-size:13px;font-weight:800;color:'
      + (sc === 'good' ? 'var(--gold)' : sc === 'warn' ? 'var(--red)' : 'var(--t2)') + ';text-transform:uppercase;letter-spacing:1px;">'
      + esc(this.ratingFor(overall)) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">0 = strong controls &middot; 100 = high risk'
      + (autoScore != null ? ' &middot; auto-score ' + autoScore + ' from operational data' : '')
      + (manScore != null ? ' &middot; manual judgment ' + manScore : '') + '</div></div>'
      + '</div></div>';

    // ── Signal cards ──
    const signalCard = (title, sig, body) => {
      const cls = this.scoreClass(sig.score);
      const scoreTxt = sig.score != null ? sig.score : '-';
      return '<div class="card"><div class="card-title">' + title + '</div>'
        + '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">'
        + '<div style="font-family:\'Barlow Condensed\';font-size:34px;font-weight:600;color:'
        + (cls === 'good' ? 'var(--gold)' : cls === 'warn' ? 'var(--red)' : 'var(--t3)') + ';min-width:54px;">' + scoreTxt + '</div>'
        + '<div style="flex:1;min-width:200px;font-size:12px;color:var(--t2);line-height:1.6;">' + body + '</div>'
        + '</div></div>';
    };

    const pourBody = pour.score == null
      ? 'No spot checks logged yet. Run spot checks in Inventory Control to score pour variance.'
      : pour.flagged + ' of ' + pour.items + ' checked products flagged across ' + pour.checks
        + ' spot check' + (pour.checks === 1 ? '' : 's') + '. '
        + App.fmtCurrency(pour.varDollar) + ' of unexplained pour variance. '
        + (pour.rate > 0.25 ? 'A high flag rate points to over-pouring or product walking out.'
           : 'Flag rate is contained.');
    const voidBody = voids.score == null
      ? 'No voids or comps logged yet. Shift Control\'s Void and Comp Log feeds this signal.'
      : voids.unauth + ' of ' + voids.count + ' voids/comps had no authorizing manager recorded. '
        + App.fmtCurrency(voids.total) + ' in total voids and comps. '
        + (voids.rate > 0.3 ? 'Unauthorized voids are the most common theft vector. Require manager sign-off.'
           : 'Most voids and comps are authorized.');
    const cashBody = cash.score == null
      ? 'No cash variances logged yet. Shift Control\'s Variance Log feeds this signal.'
      : cash.shorts + ' of ' + cash.count + ' drawer counts came up short. '
        + App.fmtCurrency(Math.abs(cash.netShort)) + ' net shortage. '
        + (cash.rate > 0.3 ? 'Repeated shortages from the same drawers or cashiers warrant a closer look.'
           : 'Shortage rate is within a normal range.');

    const confirmedBody = confirmed.score == null
      ? 'No inventory adjustments logged yet. Documented theft events from the Adjustment Log feed this signal directly.'
      : confirmed.count === 0
        ? 'No theft events logged in the last 90 days. Adjustments with other reasons (damage, expiration, found) do not score here.'
        : confirmed.count + ' confirmed theft event' + (confirmed.count === 1 ? '' : 's')
          + ' logged in the last 90 days, totaling ' + App.fmtCurrency(confirmed.totalValue) + '. '
          + (confirmed.count >= 3 ? 'Multiple confirmed events points to an ongoing problem, not a one-off.'
             : 'Documented but contained. Keep an eye on whether it repeats.');

    const threshold = parseFloat((App.shiftData?.settings || {}).comp_auth_threshold);
    const thresholdLabel = (!isNaN(threshold) && threshold > 0) ? '$' + threshold : 'your threshold';
    const unauthBody = unauthComps.score == null
      ? 'No void/comp records logged yet. Setting a Comp Auth Threshold in Hub Settings enables this signal.'
      : unauthComps.count === 0
        ? 'No unauthorized large comps in the last 90 days. Every comp over ' + thresholdLabel + ' had a manager in the Authorized By field, which is what you want.'
        : unauthComps.count + ' comp' + (unauthComps.count === 1 ? '' : 's')
          + ' over ' + thresholdLabel + ' filed in the last 90 days without manager authorization, totaling ' + App.fmtCurrency(unauthComps.total) + '. '
          + (unauthComps.count >= 3 ? 'A pattern of unauthorized large comps is one of the most common bar-theft vectors. Tighten the rule.'
             : 'One instance can be a busy night. Repeats are a pattern.');

    const signals = signalCard('Pour Variance &middot; Spot Checks', pour, pourBody)
      + signalCard('Voids &amp; Comps', voids, voidBody)
      + signalCard('Cash Variance', cash, cashBody)
      + signalCard('Unauthorized Large Comps', unauthComps, unauthBody)
      + signalCard('Confirmed Theft &middot; Adjustment Log', confirmed, confirmedBody);

    // ── Manual judgment ──
    const levelOpts = '<option value="">No manual judgment</option>'
      + this.MANUAL_LEVELS.map(m => '<option' + (this._manual.level === m.label ? ' selected' : '') + '>' + m.label + '</option>').join('');
    const manualCard = '<div class="card"><div class="card-title">Manual Judgment</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
      + 'Operational data does not see everything. Add your own read on cameras, policies, staffing, and '
      + 'staff behavior. It is blended into the overall score.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Your Assessment</label>'
      + '<select id="tr-manual">' + levelOpts + '</select></div></div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="tr-notes" rows="2" placeholder="What concerns you, or what controls are working">'
      + esc(this._manual.notes) + '</textarea></div></div>'
      + '<div id="tr-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;">Scorecard saved.</div>'
      + '</div>';

    // ── History ──
    const hist = (App.data.theft_scores || []).slice(-6).reverse();
    let histCard = '';
    if (hist.length) {
      const rows = hist.map(s => {
        const ov = s.overall != null ? s.overall : s.total;
        const cls = this.scoreClass(ov);
        return '<tr><td>' + (s.date ? String(s.date).slice(0, 10) : '-') + '</td>'
          + '<td class="' + (cls === 'good' ? 'pos' : cls === 'warn' ? 'neg' : '') + ' val">' + (ov != null ? ov : '-') + '</td>'
          + '<td>' + esc(s.rating || '-') + '</td></tr>';
      }).join('');
      histCard = '<div class="card"><div class="card-title">Recent Scorecards</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Score</th><th>Rating</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + scoreCard + signals + manualCard
      + this.investigationsCard() + histCard + '</div>';

    document.getElementById('tr-manual')?.addEventListener('change', e => {
      this._manual.notes = document.getElementById('tr-notes')?.value || '';
      this._manual.level = e.target.value;
      this.renderMain();
    });
    document.getElementById('tr-notes')?.addEventListener('input', e => {
      this._manual.notes = e.target.value;
    });

    // ── Variance investigation wiring ──
    this.container.querySelectorAll('.vi-open-btn').forEach(b => b.addEventListener('click', () => {
      const sel = this.container.querySelector('.vi-product-select');
      const productId = sel && sel.value;
      if (!productId) { if (sel) sel.style.borderColor = 'var(--red)'; return; }
      const p = this.productById(productId);
      const sku = (p && p.name) || productId;
      const inv = {
        id: App.uid(),
        product_id: productId,
        sku,
        opened_date: App.todayLocal(),
        created_at: new Date().toISOString(),
        status: 'open',
        steps: this.VARIANCE_STEPS.map(() => ({ done: false, finding: '' })),
        resolution: ''
      };
      App.putRecord('core', 'variance_investigation', inv);
      this.renderMain();
    }));
    this.container.querySelector('.vi-print-blank')?.addEventListener('click', () => this.printBlankInvestigation());
    this.container.querySelectorAll('.vi-step-check').forEach(c => c.addEventListener('change', () => {
      const inv = this._inv(c.dataset.inv); if (!inv) return;
      inv.steps[+c.dataset.step].done = c.checked;
      App.putRecord('core', 'variance_investigation', inv);
      this.renderMain();
    }));
    this.container.querySelectorAll('.vi-finding').forEach(i => i.addEventListener('change', () => {
      const inv = this._inv(i.dataset.inv); if (!inv) return;
      inv.steps[+i.dataset.step].finding = i.value;
      App.putRecord('core', 'variance_investigation', inv);
    }));
    this.container.querySelectorAll('.vi-resolution').forEach(t => t.addEventListener('change', () => {
      const inv = this._inv(t.dataset.inv); if (!inv) return;
      inv.resolution = t.value;
      App.putRecord('core', 'variance_investigation', inv);
    }));
    this.container.querySelectorAll('.vi-resolve-btn').forEach(b => b.addEventListener('click', () => {
      const inv = this._inv(b.dataset.inv); if (!inv) return;
      const ta = this.container.querySelector('.vi-resolution[data-inv="' + inv.id + '"]');
      if (ta) inv.resolution = ta.value;
      inv.status = 'resolved';
      inv.resolved_date = App.todayLocal();
      App.putRecord('core', 'variance_investigation', inv);
      this.renderMain();
    }));
    this.container.querySelectorAll('.vi-remove').forEach(b => b.addEventListener('click', () => {
      App.removeRecord('core', 'variance_investigation', b.dataset.inv);
      this.renderMain();
    }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  async save() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const confirmed = this.theftConfirmedSignal();
    const unauthComps = this.unauthorizedLargeCompsSignal();
    const autoScores = [pour.score, voids.score, cash.score, confirmed.score, unauthComps.score].filter(s => s != null);
    const autoScore = autoScores.length ? Math.round(autoScores.reduce((a, b) => a + b, 0) / autoScores.length) : null;
    const manScore = this.manualScore(this._manual.level);
    let overall;
    if (autoScore != null && manScore != null) overall = Math.round(autoScore * 0.65 + manScore * 0.35);
    else if (autoScore != null) overall = autoScore;
    else if (manScore != null) overall = manScore;
    else overall = null;

    App.data.theft_manual = { level: this._manual.level, notes: this._manual.notes };
    const scoreRec = {
      id: App.uid(),
      date: new Date().toISOString(),
      auto_score: autoScore,
      signals: { pour: pour.score, voids: voids.score, cash: cash.score, confirmed: confirmed.score, unauthComps: unauthComps.score },
      manual_level: this._manual.level,
      manual_score: manScore,
      notes: this._manual.notes,
      overall,
      rating: this.ratingFor(overall)
    };
    App.data.last_theft_score_date = new Date().toISOString();

    await App.saveKey('theft_manual');
    await App.putRecord('core', 'theft_score', scoreRec);
    await App.saveKey('last_theft_score_date');
    const m = document.getElementById('tr-msg');
    if (m) { m.style.display = 'block'; setTimeout(() => { if (m) m.style.display = 'none'; }, 2500); }
    this.renderMain();
  }
};
