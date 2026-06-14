'use strict';

/* ── Profit Recovery — Theft Risk (auto-scored) ───────────────────────────────
   The score is computed from operational data — Inventory spot checks
   (ic_spot_checks), Shift voids/comps (sc_void_comps), cash variances
   (sc_variances), unauthorized large comps, and confirmed theft from the
   Adjustment Log. Five signals, averaged. The operator's subjective take lives
   in a separate "Manager's Read" that is recorded and can raise a banner, but
   does NOT silently reweight the data score ([[output-honesty]]).

   Layout: stat strip → one "Where the Risk Is" signal table → Manager's Read →
   Save / Brief buttons → Variance Investigations (compact list, drill into one)
   → Score history. Snapshots save to App.data.theft_scores. */

S.TheftRisk = {
  _manual: null,
  // Manager's subjective read — recorded, never blended into the data score.
  MANAGER_LEVELS: ['Strong controls', 'Adequate controls', 'Some concern', 'Serious concern'],
  _levelElevated(level) { return level === 'Some concern' || level === 'Serious concern'; },

  spotChecks() { return ((App.inventoryData && App.inventoryData.ic_spot_checks) || []); },
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
    return { score: Math.min(100, Math.round(rate * 100)), checks: this.spotChecks().length, items: items.length, flagged, rate, varDollar };
  },
  voidSignal() {
    const vc = this.voidComps();
    if (vc.length < this.MIN_VOIDS) return { score: null, count: vc.length, insufficient: true };
    const unauth = vc.filter(r => !r.authorized_by || !String(r.authorized_by).trim()).length;
    const rate = unauth / vc.length;
    const total = vc.reduce((t, r) => t + (r.amount || 0), 0);
    return { score: Math.min(100, Math.round(rate * 100)), count: vc.length, unauth, rate, total };
  },
  cashSignal() {
    const vars = this.variances();
    if (vars.length < this.MIN_VARIANCES) return { score: null, count: vars.length, insufficient: true };
    const shorts = vars.filter(v => v.status === 'Short');
    const rate = shorts.length / vars.length;
    const netShort = vars.reduce((t, v) => t + Math.min(0, v.variance || 0), 0);
    return { score: Math.min(100, Math.round(rate * 100)), count: vars.length, shorts: shorts.length, rate, netShort };
  },
  unauthorizedLargeCompsSignal() {
    const all = ((App.shiftData && App.shiftData.sc_void_comps) || []);
    if (all.length === 0) return { score: null, count: 0, total: 0 };
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = App.ymdLocal(cutoff);
    const flagged = all.filter(r => r.auth_threshold_override === true && (r.date || '') >= cutoffStr);
    const total = flagged.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return { score: flagged.length > 0 ? Math.min(100, flagged.length * 20) : 0, count: flagged.length, total };
  },
  theftConfirmedSignal() {
    const all = this.adjustments();
    if (all.length === 0) return { score: null, count: 0, totalValue: 0 };
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = App.ymdLocal(cutoff);
    const recent = all.filter(a => {
      if (a.reason !== 'Theft') return false;
      return (a.date_time || '').slice(0, 10) >= cutoffStr;
    });
    const totalValue = recent.reduce((t, a) => t + Math.abs(a.value || 0), 0);
    return { score: recent.length > 0 ? Math.min(100, recent.length * 25) : 0, count: recent.length, totalValue };
  },

  // The five signal results + the blended (averaged) auto-score in one place.
  _signals() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const confirmed = this.theftConfirmedSignal();
    const unauthComps = this.unauthorizedLargeCompsSignal();
    const scores = [pour.score, voids.score, cash.score, confirmed.score, unauthComps.score].filter(s => s != null);
    const autoScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { pour, voids, cash, confirmed, unauthComps, autoScore };
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';   // header off; actions live in the page
    const saved = (App.data && App.data.theft_manual) || {};
    this._manual = { level: saved.level || '', notes: saved.notes || '' };
    this.renderMain();
  },

  renderMain() {
    const { pour, voids, cash, confirmed, unauthComps, autoScore } = this._signals();
    const overall = autoScore;
    const open = (App.data.variance_investigations || []).filter(i => i.status !== 'resolved');

    // ── Manager banner (only when the read is elevated) ──
    const banner = this._levelElevated(this._manual.level)
      ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin-bottom:14px;font-size:12px;color:var(--t1);"><strong>Manager flagged: ' + esc(this._manual.level) + '.</strong>' + (this._manual.notes ? ' ' + esc(this._manual.notes) : '') + '</div>'
      : '';

    // ── Stat strip ──
    const stat = (label, valHtml, cls, sub) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + valHtml + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Theft Risk Score', overall != null ? String(overall) : '-', this.scoreClass(overall), esc(this.ratingFor(overall)))
      + stat('Open Investigations', String(open.length))
      + stat('Confirmed Theft (90d)', confirmed.totalValue ? App.fmtCurrency(confirmed.totalValue) : '-', confirmed.count ? 'warn' : '')
      + stat('Unexplained Pour Variance', (pour.score != null && pour.varDollar) ? App.fmtCurrency(pour.varDollar) : '-')
      + '</div></div>';

    // ── Signals table (replaces five cards) ──
    const reads = {
      pour: pour.score == null ? 'No spot checks logged yet'
        : pour.flagged + ' of ' + pour.items + ' pours flagged, ' + App.fmtCurrency(pour.varDollar) + ' variance',
      voids: voids.score == null ? 'No voids or comps logged yet'
        : voids.unauth + ' of ' + voids.count + ' rung without manager auth, ' + App.fmtCurrency(voids.total) + ' total',
      cash: cash.score == null ? 'No cash variances logged yet'
        : cash.shorts + ' of ' + cash.count + ' counts short, ' + App.fmtCurrency(Math.abs(cash.netShort)) + ' net short',
      unauth: unauthComps.score == null ? 'No void/comp records yet'
        : (unauthComps.count === 0 ? 'No large comps over threshold without auth (90d)'
           : unauthComps.count + ' large comps over threshold without auth, ' + App.fmtCurrency(unauthComps.total)),
      confirmed: confirmed.score == null ? 'No adjustments logged yet'
        : (confirmed.count === 0 ? 'No theft events logged in the last 90 days'
           : confirmed.count + ' confirmed events, ' + App.fmtCurrency(confirmed.totalValue))
    };
    const sigRow = (name, sig, read, go) => {
      const cls = this.scoreClass(sig.score);
      const color = cls === 'warn' ? 'var(--red)' : cls === 'dim' ? 'var(--t3)' : 'var(--t1)';
      return '<tr>'
        + '<td><div class="val">' + name + '</div></td>'
        + '<td style="color:' + color + ';font-weight:700;">' + (sig.score != null ? sig.score : '-') + '</td>'
        + '<td style="color:var(--t2);">' + read + '</td>'
        + '<td class="no-print" style="text-align:right;"><button class="btn btn-ghost btn-sm tr-review" data-go="' + go + '">Review</button></td>'
        + '</tr>';
    };
    const signalsTable = '<div class="sh" style="margin:0 0 10px;">Where the Risk Is</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Signal</th><th>Score</th><th>What it shows</th><th class="no-print"></th></tr></thead><tbody>'
      + sigRow('Pour Variance', pour, reads.pour, 'ic-spot-check')
      + sigRow('Voids and Comps', voids, reads.voids, 'sc-void-comp')
      + sigRow('Cash Variance', cash, reads.cash, 'sc-cash-history')
      + sigRow('Unauthorized Large Comps', unauthComps, reads.unauth, 'sc-void-comp')
      + sigRow('Confirmed Theft', confirmed, reads.confirmed, 'ic-adjustments')
      + '</tbody></table></div></div>';

    // ── Manager's Read ──
    const levelOpts = '<option value="">No read yet</option>'
      + this.MANAGER_LEVELS.map(l => '<option' + (this._manual.level === l ? ' selected' : '') + '>' + l + '</option>').join('');
    const managerCard = '<div class="sh" style="margin:22px 0 10px;">Manager\'s Read</div>'
      + '<div class="card form-card">'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:240px;flex-shrink:0;"><label>Concern Level</label><select class="form-input" id="tr-manual">' + levelOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:0;"><label>Notes</label>'
      + '<textarea class="form-input notes-ta" id="tr-notes" rows="2" placeholder="What you see that the data does not: cameras, behavior, staffing, policy">' + esc(this._manual.notes) + '</textarea></div>'
      + '</div>';

    // ── Buttons (bottom-left of the scorecard) ──
    const btnRow = '<div class="no-print" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="tr-save">Save Scorecard</button>'
      + '<button class="btn btn-ghost" id="tr-brief">Theft and Loss Brief</button>'
      + '<span id="tr-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;margin-left:8px;">Scorecard saved.</span>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + banner + statStrip + signalsTable + managerCard + btnRow
      + this.investigationsSection() + this.historyCard() + '</div>';

    // ── Wiring ──
    this.container.querySelectorAll('.tr-review').forEach(b => b.addEventListener('click', () => App.openScreen(b.dataset.go)));
    document.getElementById('tr-manual')?.addEventListener('change', e => {
      this._manual.notes = document.getElementById('tr-notes')?.value || '';
      this._manual.level = e.target.value;
      this.renderMain();
    });
    document.getElementById('tr-notes')?.addEventListener('input', e => { this._manual.notes = e.target.value; });
    document.getElementById('tr-save')?.addEventListener('click', () => this.save());
    document.getElementById('tr-brief')?.addEventListener('click', () => this.printBrief());

    // Investigations
    this.container.querySelector('.vi-open-btn')?.addEventListener('click', () => {
      const sel = this.container.querySelector('.vi-product-select');
      const productId = sel && sel.value;
      if (!productId) { if (sel) sel.style.borderColor = 'var(--red)'; return; }
      const p = this.productById(productId);
      // Dedup: reuse an open investigation for this product instead of duplicating.
      const existing = (App.data.variance_investigations || []).find(i => i.product_id === productId && i.status !== 'resolved');
      if (existing) { App.pushView(() => this.renderInvestigation(existing.id)); return; }
      const inv = {
        id: App.uid(), product_id: productId, sku: (p && p.name) || productId,
        opened_date: App.todayLocal(), created_at: new Date().toISOString(),
        status: 'open', steps: this.VARIANCE_STEPS.map(() => ({ done: false, finding: '' })), resolution: ''
      };
      App.putRecord('core', 'variance_investigation', inv);
      App.pushView(() => this.renderInvestigation(inv.id));
    });
    this.container.querySelector('.vi-print-blank')?.addEventListener('click', () => this.printBlankInvestigation());
    this.container.querySelectorAll('.vi-open-detail').forEach(b => b.addEventListener('click', () => App.pushView(() => this.renderInvestigation(b.dataset.inv))));
    this.container.querySelectorAll('.vi-remove').forEach(b => b.addEventListener('click', () => {
      App.removeRecord('core', 'variance_investigation', b.dataset.inv).then(() => this.renderMain());
    }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.renderMain()));
  },

  // ── Variance Investigations — compact list (drill into one) ───────────────
  investigationsSection() {
    const invs = App.data.variance_investigations || [];
    const open = invs.filter(i => i.status !== 'resolved');
    const resolved = invs.filter(i => i.status === 'resolved');

    const prods = this.products();
    const catOrder = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => { const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    let productOpts = '<option value="">Pick a product to investigate...</option>';
    cats.forEach(cat => {
      productOpts += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(p => { productOpts += '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; });
      productOpts += '</optgroup>';
    });

    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:22px 0 10px;">'
      + '<div class="sh" style="margin:0;">Variance Investigations</div>'
      + '<button class="btn btn-ghost btn-sm no-print vi-print-blank">Worksheet</button>'
      + '</div>'
      + '<div class="card form-card">'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;margin-bottom:0;">'
      + '<div class="f" style="width:300px;"><label>Open an Investigation</label><select class="form-input vi-product-select">' + productOpts + '</select></div>'
      + '<button class="btn btn-primary vi-open-btn">Open Investigation</button>'
      + '</div></div>';

    if (open.length) {
      const rows = open.map(inv => {
        const doneN = inv.steps.filter(s => s.done).length;
        return '<tr>'
          + '<td><div class="val">' + esc(inv.sku) + '</div></td>'
          + '<td>' + esc(inv.opened_date) + '</td>'
          + '<td class="' + (doneN === 6 ? 'pos' : '') + '">' + doneN + ' of 6 steps</td>'
          + '<td class="no-print" style="text-align:right;"><button class="btn btn-ghost btn-sm vi-open-detail" data-inv="' + esc(inv.id) + '">Open</button></td>'
          + '</tr>';
      }).join('');
      h += '<div class="sh" style="margin:18px 0 10px;">Open</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Opened</th><th>Progress</th><th class="no-print"></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    if (resolved.length) {
      const newest = resolved.slice().reverse();
      const rows = newest.slice(0, App.listLimit('core', 'variance_investigation')).map(inv =>
        '<tr>'
        + '<td><div class="val">' + esc(inv.sku) + '</div></td>'
        + '<td>' + esc(inv.resolved_date || '-') + '</td>'
        + '<td style="color:var(--t2);">' + esc(inv.resolution || '-') + '</td>'
        + '<td class="no-print" style="text-align:right;"><button class="btn btn-danger btn-sm vi-remove" data-inv="' + esc(inv.id) + '">Delete</button></td>'
        + '</tr>').join('');
      h += '<div class="sh" style="margin:18px 0 10px;">Resolved</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Resolved</th><th>Finding</th><th class="no-print"></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        + App.showOlderBar('core', 'variance_investigation', newest, false);
    }
    return h;
  },

  // ── One investigation, drilled into (floating back returns to the landing) ──
  renderInvestigation(id) {
    const inv = this._inv(id);
    if (!inv) { App.navigate('theft-risk'); return; }
    const doneN = inv.steps.filter(s => s.done).length;
    const liveData = this.investigationLiveData(inv.product_id);
    const inputStyle = 'background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:13px;padding:7px 10px;color-scheme:dark;';

    let steps = '';
    inv.steps.forEach((s, idx) => {
      const st = this.VARIANCE_STEPS[idx];
      let extra = '';
      if (idx === 1 && liveData.step2) extra = liveData.step2;
      if (idx === 2 && liveData.step3) extra = liveData.step3;
      steps += '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--b2);">'
        + '<input type="checkbox" class="vi-step-check" data-step="' + idx + '"' + (s.done ? ' checked' : '')
        + ' style="margin-top:3px;flex-shrink:0;width:16px;height:16px;accent-color:var(--gold);"/>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;font-weight:700;color:' + (s.done ? 'var(--t3)' : 'var(--t1)') + ';">' + (idx + 1) + '. ' + esc(st.title) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);line-height:1.55;margin:3px 0 8px;">' + esc(st.detail) + '</div>'
        + extra
        + '<input type="text" class="vi-finding" data-step="' + idx + '" value="' + esc(s.finding) + '" placeholder="What you found" style="' + inputStyle + 'width:100%;"/>'
        + '</div></div>';
    });

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Investigating</div><div class="calc-val lg">' + esc(inv.sku) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Opened</div><div class="calc-val lg">' + esc(inv.opened_date) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Progress</div><div class="calc-val lg' + (doneN === 6 ? ' good' : '') + '">' + doneN + ' / 6</div></div>'
      + '</div></div>'
      + '<div class="sh" style="margin:22px 0 10px;">The Six Steps</div>'
      + '<div class="card form-card">' + steps
      + '<div style="margin-top:14px;"><label style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Resolution</label>'
      + '<textarea class="vi-resolution" rows="2" placeholder="The conclusion, even if inconclusive" style="' + inputStyle + 'width:100%;margin-top:5px;resize:vertical;">' + esc(inv.resolution || '') + '</textarea></div>'
      + '</div>'
      + '<div class="no-print" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary vi-resolve-btn">Resolve and Close</button>'
      + '<button class="btn btn-danger vi-remove-detail">Delete Investigation</button>'
      + '</div>'
      + '</div>';

    this.container.querySelectorAll('.vi-step-check').forEach(c => c.addEventListener('change', () => {
      inv.steps[+c.dataset.step].done = c.checked;
      App.putRecord('core', 'variance_investigation', inv).then(() => this.renderInvestigation(id));
    }));
    this.container.querySelectorAll('.vi-finding').forEach(i => i.addEventListener('change', () => {
      inv.steps[+i.dataset.step].finding = i.value;
      App.putRecord('core', 'variance_investigation', inv);
    }));
    this.container.querySelector('.vi-resolution')?.addEventListener('change', e => {
      inv.resolution = e.target.value;
      App.putRecord('core', 'variance_investigation', inv);
    });
    this.container.querySelector('.vi-resolve-btn')?.addEventListener('click', () => {
      const ta = this.container.querySelector('.vi-resolution');
      if (ta) inv.resolution = ta.value;
      inv.status = 'resolved';
      inv.resolved_date = App.todayLocal();
      App.putRecord('core', 'variance_investigation', inv).then(() => App.goBack());
    });
    this.container.querySelector('.vi-remove-detail')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      App.removeRecord('core', 'variance_investigation', id).then(() => App.goBack());
    });
  },

  // ── Score history ──────────────────────────────────────────────────────────
  historyCard() {
    const hist = (App.data.theft_scores || []).slice(-6).reverse();
    if (!hist.length) return '';
    const rows = hist.map(s => {
      const ov = s.overall != null ? s.overall : s.total;
      const cls = this.scoreClass(ov);
      return '<tr><td>' + (s.date ? String(s.date).slice(0, 10) : '-') + '</td>'
        + '<td class="' + (cls === 'good' ? 'pos' : cls === 'warn' ? 'neg' : '') + ' val">' + (ov != null ? ov : '-') + '</td>'
        + '<td>' + esc(s.rating || '-') + '</td></tr>';
    }).join('');
    return '<div class="sh" style="margin:22px 0 10px;">Score History</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Score</th><th>Rating</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  /* Guided Variance Investigation — the Fix System's variance process as a
     trackable workflow on a flagged product. Step 5 is a controlled re-measure
     that stays attached to THIS investigation, not a new spot-check flag. */
  VARIANCE_STEPS: [
    { title: 'Verify the count',
      detail: 'Check every storage location for a missed partial or a count error before chasing theft.' },
    { title: 'Calculate theoretical usage',
      detail: 'Compare POS pours sold against the actual ounce movement from the count.' },
    { title: 'Identify the shifts',
      detail: 'Use opening and closing counts to pin which shifts the variance landed on.' },
    { title: 'Talk to the staff who worked those shifts',
      detail: 'Ask what they saw: breakage, heavy comps, a rush, anything unusual.' },
    { title: 'Re-measure under tighter control',
      detail: 'Unannounced re-count of just this product on one suspect shift, logged here as part of this investigation.' },
    { title: 'Document the finding',
      detail: 'Write the finding and resolution before closing, even if inconclusive.' }
  ],

  _inv(id) { return (App.data.variance_investigations || []).find(x => x.id === id); },

  investigationLiveData(productId) {
    if (!productId) {
      return { step2: '<div style="font-size:11px;color:var(--t4);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">Open this investigation from a product to wire live count + spot-check data into this step.</div>', step3: '' };
    }
    const p = this.productById(productId);
    if (!p) return { step2: '', step3: '' };

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
        const isCaseBeer = p.category === 'Bottle Beer' && p.case_size > 0;
        const pp = isCaseBeer ? p.case_size
          : (p.pours_per_container || (p.container_size_oz && p.pour_size_oz ? p.container_size_oz / p.pour_size_oz : 0));
        const actualPours = used * pp;
        const cost = (App.unitCost ? App.unitCost(p) : (p.unit_cost || 0)) || 0;
        const actualDollars = used * cost;
        step2Html = '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;padding:10px 12px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;">'
          + '<div style="font-weight:700;color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Live Data &middot; ' + esc(start.date) + ' to ' + esc(end.date) + '</div>'
          + '<div>Used: <strong>' + used.toFixed(2) + ' containers</strong> (' + actualPours.toFixed(1) + ' pours, ' + App.fmtCurrency(actualDollars) + ')</div>'
          + '<div style="color:var(--t3);margin-top:4px;">Starting count ' + (si.total || 0).toFixed(2) + ' + purchases ' + purch.toFixed(2) + ' - ending count ' + (ei.total || 0).toFixed(2) + '</div>'
          + '<div style="color:var(--t3);margin-top:4px;">Compare against your POS pours sold for the same window.</div>'
          + '</div>';
      } else {
        step2Html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">This product was not counted on both of the last two inventories. Run a count in Inventory Control to populate the math here.</div>';
      }
    } else {
      step2Html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">Need two inventory counts to compute usage. Run a count in Inventory Control.</div>';
    }

    const recentSpots = this.spotChecks().slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(c => { const item = (c.items || []).find(i => i.product_id === productId); return item ? { date: c.date, shift: c.shift, checked_by: c.checked_by, item } : null; })
      .filter(Boolean).slice(0, 5);
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
      step3Html = '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;padding:10px 12px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;">'
        + '<div style="font-weight:700;color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Recent Spot Checks for This Product</div>' + rows + '</div>';
    }
    return { step2: step2Html, step3: step3Html };
  },

  // Worksheet now PRINTS the six steps so it actually guides the investigation.
  printBlankInvestigation() {
    App.printBlankSheet({
      title: 'Variance Investigation Worksheet',
      subtitle: 'Work the six steps in order on a single flagged product. Manager enters findings into Bar Cop after.',
      columns: [
        { label: 'Step',         width: '7%'  },
        { label: 'Task',         width: '43%' },
        { label: 'What You Did', width: '25%' },
        { label: 'Finding',      width: '25%' }
      ],
      bodyRows: this.VARIANCE_STEPS.map((s, i) => [String(i + 1), s.title + '. ' + s.detail, '', ''])
    });
  },

  // ── Quarterly Theft & Loss Brief (PDF) ──────────────────────────────────────
  async printBrief() {
    const { pour, voids, cash, confirmed, unauthComps, autoScore } = this._signals();
    const overall = autoScore;

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const fmt$ = (v) => (v == null || isNaN(v)) ? '-' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

    b.sectionTitle('Overall Risk Score');
    b.heading((overall != null ? String(overall) : '-') + '   ' + this.ratingFor(overall), 18);
    b.paragraph('Score is the average of the operational signals below.', { gray: 100, size: 9 });
    if (this._manual.level) {
      b.paragraph("Manager's read: " + this._manual.level + (this._manual.notes ? ' - ' + this._manual.notes : ''), { gray: 100, size: 9 });
    }

    b.sectionTitle('Signal Summary');
    b.table(['Signal', 'Score', 'Detail'], [
      ['Pour Variance (spot checks)', dash(pour.score), pour.flagged ? pour.flagged + ' of ' + pour.items + ' flagged' : '-'],
      ['Voids & Comps (loss-bearing only)', dash(voids.score), voids.count ? voids.count + ' loss records, ' + fmt$(voids.total) : '-'],
      ['Cash Variance', dash(cash.score), cash.count ? cash.shorts + ' shorts of ' + cash.count + ' counts, ' + fmt$(Math.abs(cash.netShort)) + ' net short' : '-'],
      ['Unauthorized Large Comps', dash(unauthComps.score), unauthComps.count ? unauthComps.count + ' over threshold without auth, ' + fmt$(unauthComps.total) : '-'],
      ['Confirmed Theft (adjustment log)', dash(confirmed.score), confirmed.count ? confirmed.count + ' events, ' + fmt$(confirmed.totalValue) : '-']
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('90-Day Event Counts');
    b.table(null, [
      ['Spot checks run', String(recentSpots.length)],
      ['Voids and comps logged (loss-bearing)', String(recentVCs.length)],
      ['Cash variances logged', String(recentVars.length)],
      ['Inventory adjustments logged', String(recentAdj.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Variance Investigations');
    b.table(null, [
      ['Open investigations', String(openInv.length)],
      ['Resolved in window', String(resolvedInv.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });
    if (openInv.length > 0) b.paragraph('Open: ' + openInv.map(i => i.sku || '(unnamed)').join(', '), { gray: 70, size: 9 });

    b.disclaimer('Generated from your logged Bar Cop data on ' + today + '. '
      + 'Bar Cop is a software tool, not a forensic auditor, attorney, or insurance adjuster. '
      + 'Use this brief as a reference point for your own review; consult the relevant professional before acting on any conclusion.');

    await b.save('BarCop_TheftLossBrief_' + App._pdfDateStamp() + '.pdf');
  },

  async save() {
    const { pour, voids, cash, confirmed, unauthComps, autoScore } = this._signals();
    const overall = autoScore;

    App.data.theft_manual = { level: this._manual.level, notes: this._manual.notes };
    const scoreRec = {
      id: App.uid(),
      date: new Date().toISOString(),
      auto_score: autoScore,
      signals: { pour: pour.score, voids: voids.score, cash: cash.score, confirmed: confirmed.score, unauthComps: unauthComps.score },
      manual_level: this._manual.level,
      notes: this._manual.notes,
      overall,
      rating: this.ratingFor(overall)
    };
    App.data.last_theft_score_date = new Date().toISOString();

    await App.saveKey('theft_manual');
    await App.putRecord('core', 'theft_score', scoreRec);
    await App.saveKey('last_theft_score_date');
    const m = document.getElementById('tr-msg');
    if (m) { m.style.display = 'inline'; setTimeout(() => { if (m) m.style.display = 'none'; }, 2500); }
    this.renderMain();
  },

  showHowTo() {
    App.showHelpModal('How Theft Risk Works', [
      { p: ['A read-only score of how exposed you are to theft and loss, built from the operational data you already log. It does not accuse anyone; it points you at where the money is most likely leaking so you can investigate.'] },
      { h: 'The Score', p: ['One number, 0 (strong controls) to 100 (high risk), averaged from the five signals below. Each signal only counts once it has enough samples to be meaningful, so a single bad night does not swing it. The number is pure data.'] },
      { h: 'Where the Risk Is', p: ['The five signals: flagged pour variance from spot checks, voids and comps rung without a manager, drawer counts coming up short, large comps filed over your threshold without authorization, and confirmed theft from the Adjustment Log. Red is high, green is contained, grey means not enough data yet. Review jumps you to the screen that feeds each signal.'] },
      { h: "Manager's Read", p: ['Data does not see cameras, body language, or a gut feeling about a shift. Record your own concern level and notes here. It is kept for the brief and the history and raises a banner when you flag concern, but it does NOT change the data score, because the score stays honest.'] },
      { h: 'Variance Investigations', p: ['When a product shows unexplained variance, open an investigation and work the six steps in order. Open one to drill in: it pulls live count and spot-check data into the steps, you check them off and record findings, then resolve and close. A flagged spot check in Inventory Control opens one here for you, and re-flagging the same product reuses the open investigation instead of starting a new one. Print the Worksheet to work the steps on paper at the bar.'] },
      { h: 'Save Scorecard and Brief', p: ['Save Scorecard snapshots today\'s score and your read into the history below. Theft and Loss Brief generates a one-page PDF for an owner, bookkeeper, or insurance review.'] }
    ]);
  }
};
