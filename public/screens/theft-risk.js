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
  voidComps()  { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  adjustments() { return ((App.inventoryData && App.inventoryData.ic_adjustments) || []); },

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
  pourSignal() {
    const items = [];
    this.spotChecks().forEach(c => (c.items || []).forEach(it => items.push(it)));
    if (items.length === 0) return { score: null, checks: this.spotChecks().length, items: 0 };
    const flagged = items.filter(i => i.flagged).length;
    const rate = flagged / items.length;
    const varDollar = items.reduce((t, i) => t + Math.max(0, i.variance_dollar || 0), 0);
    return {
      score: Math.min(100, Math.round(rate * 280)),
      checks: this.spotChecks().length, items: items.length,
      flagged, rate, varDollar
    };
  },
  voidSignal() {
    const vc = this.voidComps();
    if (vc.length === 0) return { score: null, count: 0 };
    const unauth = vc.filter(r => !r.authorized_by || !String(r.authorized_by).trim()).length;
    const rate = unauth / vc.length;
    const total = vc.reduce((t, r) => t + (r.amount || 0), 0);
    return {
      score: Math.min(100, Math.round(rate * 120)),
      count: vc.length, unauth, rate, total
    };
  },
  cashSignal() {
    const vars = this.variances();
    if (vars.length === 0) return { score: null, count: 0 };
    const shorts = vars.filter(v => v.status === 'Short');
    const rate = shorts.length / vars.length;
    const netShort = vars.reduce((t, v) => t + Math.min(0, v.variance || 0), 0);
    return {
      score: Math.min(100, Math.round(rate * 150)),
      count: vars.length, shorts: shorts.length, rate, netShort
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
    const cutoffStr = cutoff.toISOString().slice(0, 10);
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
    this.renderMain();
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

  investigationsCard() {
    const invs = App.data.variance_investigations || [];
    const open = invs.filter(i => i.status !== 'resolved');
    const resolved = invs.filter(i => i.status === 'resolved');
    const inputStyle = 'background:var(--input);border:1px solid var(--b1);border-radius:3px;'
      + 'color:#fff;font-size:13px;padding:7px 10px;color-scheme:dark;';

    let html = '<div class="card"><div class="card-title">Variance Investigations</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
      + 'When a product shows unexplained variance, open an investigation and work the six steps in order. '
      + 'It keeps the process honest and leaves a paper trail.</div>'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;margin-bottom:18px;">'
      + '<div class="f" style="width:230px;"><label>Flagged Product</label>'
      + '<input type="text" class="vi-sku-input" placeholder="e.g. Titos 1L" style="' + inputStyle + 'width:100%;"/></div>'
      + '<button class="btn btn-primary vi-open-btn">Open Investigation</button></div>';

    open.forEach(inv => {
      const doneN = inv.steps.filter(s => s.done).length;
      html += '<div style="border:1px solid var(--b1);border-radius:4px;padding:16px;margin-bottom:14px;">'
        + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;">'
        + '<span style="font-size:13px;font-weight:800;color:var(--t1);text-transform:uppercase;letter-spacing:0.5px;">' + esc(inv.sku) + '</span>'
        + '<span style="font-size:11px;color:var(--t3);">opened ' + esc(inv.opened_date) + '</span>'
        + '<span style="font-size:11px;font-weight:700;color:var(--gold);margin-left:auto;">' + doneN + ' of 6 steps</span>'
        + '</div>';
      inv.steps.forEach((s, idx) => {
        const st = this.VARIANCE_STEPS[idx];
        html += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--b2);">'
          + '<input type="checkbox" class="vi-step-check" data-inv="' + inv.id + '" data-step="' + idx + '"'
          + (s.done ? ' checked' : '') + ' style="margin-top:3px;flex-shrink:0;width:15px;height:15px;accent-color:#DBAB46;"/>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:12px;font-weight:700;color:' + (s.done ? 'var(--t3)' : 'var(--t1)') + ';">'
          + (idx + 1) + '. ' + esc(st.title) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);line-height:1.55;margin:3px 0 6px;">' + esc(st.detail) + '</div>'
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
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:18px 0 8px;">Resolved</div>'
        + resolved.slice().reverse().map(inv =>
          '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--b2);font-size:12px;">'
          + '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:5px;"></span>'
          + '<div style="flex:1;min-width:0;"><span style="font-weight:700;color:var(--t1);">' + esc(inv.sku) + '</span> '
          + '<span style="color:var(--t3);">resolved ' + esc(inv.resolved_date || '') + '</span>'
          + (inv.resolution ? '<div style="color:var(--t2);line-height:1.55;margin-top:2px;">' + esc(inv.resolution) + '</div>' : '')
          + '</div>'
          + '<button class="btn btn-ghost btn-sm vi-remove" data-inv="' + inv.id + '">Remove</button>'
          + '</div>').join('');
    }
    return html + '</div>';
  },

  renderMain() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const confirmed = this.theftConfirmedSignal();
    const autoScores = [pour.score, voids.score, cash.score, confirmed.score].filter(s => s != null);
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

    const signals = signalCard('Pour Variance &middot; Spot Checks', pour, pourBody)
      + signalCard('Voids &amp; Comps', voids, voidBody)
      + signalCard('Cash Variance', cash, cashBody)
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
      const inp = this.container.querySelector('.vi-sku-input');
      const sku = inp && inp.value.trim();
      if (!sku) { if (inp) inp.style.borderColor = 'var(--red)'; return; }
      App.data.variance_investigations = App.data.variance_investigations || [];
      App.data.variance_investigations.push({
        id: App.uid(), sku: sku, opened_date: new Date().toISOString().slice(0, 10),
        status: 'open', steps: this.VARIANCE_STEPS.map(() => ({ done: false, finding: '' })), resolution: ''
      });
      App.saveKey('variance_investigations');
      this.renderMain();
    }));
    this.container.querySelectorAll('.vi-step-check').forEach(c => c.addEventListener('change', () => {
      const inv = this._inv(c.dataset.inv); if (!inv) return;
      inv.steps[+c.dataset.step].done = c.checked;
      App.saveKey('variance_investigations');
      this.renderMain();
    }));
    this.container.querySelectorAll('.vi-finding').forEach(i => i.addEventListener('change', () => {
      const inv = this._inv(i.dataset.inv); if (!inv) return;
      inv.steps[+i.dataset.step].finding = i.value;
      App.saveKey('variance_investigations');
    }));
    this.container.querySelectorAll('.vi-resolution').forEach(t => t.addEventListener('change', () => {
      const inv = this._inv(t.dataset.inv); if (!inv) return;
      inv.resolution = t.value;
      App.saveKey('variance_investigations');
    }));
    this.container.querySelectorAll('.vi-resolve-btn').forEach(b => b.addEventListener('click', () => {
      const inv = this._inv(b.dataset.inv); if (!inv) return;
      const ta = this.container.querySelector('.vi-resolution[data-inv="' + inv.id + '"]');
      if (ta) inv.resolution = ta.value;
      inv.status = 'resolved';
      inv.resolved_date = new Date().toISOString().slice(0, 10);
      App.saveKey('variance_investigations');
      this.renderMain();
    }));
    this.container.querySelectorAll('.vi-remove').forEach(b => b.addEventListener('click', () => {
      App.data.variance_investigations = (App.data.variance_investigations || []).filter(x => x.id !== b.dataset.inv);
      App.saveKey('variance_investigations');
      this.renderMain();
    }));
  },

  async save() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const confirmed = this.theftConfirmedSignal();
    const autoScores = [pour.score, voids.score, cash.score, confirmed.score].filter(s => s != null);
    const autoScore = autoScores.length ? Math.round(autoScores.reduce((a, b) => a + b, 0) / autoScores.length) : null;
    const manScore = this.manualScore(this._manual.level);
    let overall;
    if (autoScore != null && manScore != null) overall = Math.round(autoScore * 0.65 + manScore * 0.35);
    else if (autoScore != null) overall = autoScore;
    else if (manScore != null) overall = manScore;
    else overall = null;

    App.data.theft_manual = { level: this._manual.level, notes: this._manual.notes };
    if (!App.data.theft_scores) App.data.theft_scores = [];
    App.data.theft_scores.push({
      id: App.uid(),
      date: new Date().toISOString(),
      auto_score: autoScore,
      signals: { pour: pour.score, voids: voids.score, cash: cash.score, confirmed: confirmed.score },
      manual_level: this._manual.level,
      manual_score: manScore,
      notes: this._manual.notes,
      overall,
      rating: this.ratingFor(overall)
    });
    App.data.last_theft_score_date = new Date().toISOString();

    await App.saveKey('theft_manual');
    await App.saveKey('theft_scores');
    await App.saveKey('last_theft_score_date');
    const m = document.getElementById('tr-msg');
    if (m) { m.style.display = 'block'; setTimeout(() => { if (m) m.style.display = 'none'; }, 2500); }
    this.renderMain();
  }
};
