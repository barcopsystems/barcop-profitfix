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
    return score <= 30 ? 'Low Risk — Strong Controls'
         : score <= 60 ? 'Moderate Risk — Tighten Controls'
         : 'High Risk — Immediate Action';
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

  renderMain() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const autoScores = [pour.score, voids.score, cash.score].filter(s => s != null);
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
      + (overall != null ? overall : '—') + '</div>'
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
      const scoreTxt = sig.score != null ? sig.score : '—';
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
        + (voids.rate > 0.3 ? 'Unauthorized voids are the most common theft vector — require manager sign-off.'
           : 'Most voids and comps are authorized.');
    const cashBody = cash.score == null
      ? 'No cash variances logged yet. Shift Control\'s Variance Log feeds this signal.'
      : cash.shorts + ' of ' + cash.count + ' drawer counts came up short. '
        + App.fmtCurrency(Math.abs(cash.netShort)) + ' net shortage. '
        + (cash.rate > 0.3 ? 'Repeated shortages from the same drawers or cashiers warrant a closer look.'
           : 'Shortage rate is within a normal range.');

    const signals = signalCard('Pour Variance &middot; Spot Checks', pour, pourBody)
      + signalCard('Voids &amp; Comps', voids, voidBody)
      + signalCard('Cash Variance', cash, cashBody);

    // ── Manual judgment ──
    const levelOpts = '<option value="">No manual judgment</option>'
      + this.MANUAL_LEVELS.map(m => '<option' + (this._manual.level === m.label ? ' selected' : '') + '>' + m.label + '</option>').join('');
    const manualCard = '<div class="card"><div class="card-title">Manual Judgment</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
      + 'Operational data does not see everything. Add your own read on cameras, policies, staffing, and '
      + 'staff behavior — it is blended into the overall score.</div>'
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
        return '<tr><td>' + (s.date ? String(s.date).slice(0, 10) : '—') + '</td>'
          + '<td class="' + (cls === 'good' ? 'pos' : cls === 'warn' ? 'neg' : '') + ' val">' + (ov != null ? ov : '—') + '</td>'
          + '<td>' + esc(s.rating || '—') + '</td></tr>';
      }).join('');
      histCard = '<div class="card"><div class="card-title">Recent Scorecards</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Score</th><th>Rating</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + scoreCard + signals + manualCard + histCard + '</div>';

    document.getElementById('tr-manual')?.addEventListener('change', e => {
      this._manual.notes = document.getElementById('tr-notes')?.value || '';
      this._manual.level = e.target.value;
      this.renderMain();
    });
    document.getElementById('tr-notes')?.addEventListener('input', e => {
      this._manual.notes = e.target.value;
    });
  },

  async save() {
    const pour = this.pourSignal(), voids = this.voidSignal(), cash = this.cashSignal();
    const autoScores = [pour.score, voids.score, cash.score].filter(s => s != null);
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
      signals: { pour: pour.score, voids: voids.score, cash: cash.score },
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
