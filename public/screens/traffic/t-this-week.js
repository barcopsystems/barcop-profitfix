'use strict';
S.TrafficThisWeek = {
  step: 1,
  draft: null,

  render(container, actions) {
    this.container = container;
    if (!this.draft) this.draft = this.loadDraft();
    this.renderStep(this.step);
  },

  loadDraft() {
    try {
      const r = localStorage.getItem('tf_draft');
      if (r) { const d = JSON.parse(r); this.step = d._step || 1; return d; }
    } catch(e) {}
    const weeks = App.data.traffic_weeks || [];
    const lastWk = weeks.length ? Math.max(...weeks.map(w => w.week_num || 0)) : 0;
    return {
      _step: 1,
      week_num: lastWk + 1,
      period_end: App.nextSunday ? App.nextSunday() : new Date().toISOString().slice(0,10),
      google_rating: '',
      google_total: '',
      new_reviews: '',
      response_rate: '',
      monthly_sessions: '',
      bounce_rate: '',
      ig_followers: '',
      ig_posts_month: '',
      fb_followers: '',
      notes: ''
    };
  },

  saveDraft() {
    this.draft._step = this.step;
    try { localStorage.setItem('tf_draft', JSON.stringify(this.draft)); } catch(e) {}
  },

  clearDraft() {
    try { localStorage.removeItem('tf_draft'); } catch(e) {}
    this.draft = null;
    this.step = 1;
  },

  renderStep(step) {
    this.step = step;
    this.saveDraft();
    document.getElementById('topbar-sub').textContent = 'Step ' + step + ' of 5';
    this.container.innerHTML = '<div class="screen">' + this.stepsHtml() + this.getStepHtml(step) + '</div>';
    this.wireStep(step);
  },

  stepsHtml() {
    const labels = ['Period', 'Google', 'Website', 'Social', 'Review'];
    let h = '<div class="steps">';
    for (let i = 1; i <= 5; i++) {
      const cls = i < this.step ? 'done' : i === this.step ? 'active' : '';
      h += (i > 1 ? '<div class="step-line' + (i-1 < this.step ? ' done' : '') + '"></div>' : '')
         + '<div class="step-dot ' + cls + '">' + (i < this.step ? '✓' : i) + '</div>';
    }
    return h + '</div>';
  },

  getStepHtml(s) {
    switch(s) {
      case 1: return this.step1();
      case 2: return this.step2();
      case 3: return this.step3();
      case 4: return this.step4();
      case 5: return this.step5();
      default: return '';
    }
  },

  nav(showPrev, showNext, isFinal) {
    return '<div class="card-actions">'
      + (showPrev ? '<button class="btn btn-ghost" id="ttw-prev">← Back</button>' : '')
      + (showNext && !isFinal ? '<button class="btn btn-primary" id="ttw-next">Next →</button>' : '')
      + (isFinal ? '<button class="btn btn-primary btn-lg" id="ttw-save">Save Week</button><span id="ttw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>' : '')
      + '</div>';
  },

  step1() {
    return '<div class="card"><div class="card-title">Period Details</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:100px;"><label>Week # ' + tt('tw-week-num') + '</label><input type="number" id="ttw-wk" value="' + esc(this.draft.week_num) + '" min="1"/></div>'
      + '<div class="f" style="width:160px;"><label>Period End Date ' + tt('tw-period-end') + '</label><input type="date" id="ttw-end" value="' + esc(this.draft.period_end) + '"/></div>'
      + '</div>'
      + this.nav(false, true) + '</div>';
  },

  step2() {
    const ts = App.data.traffic_settings?.targets || {};
    const tGR = ts.google_rating || 4.3;
    const tRV = ts.review_velocity || 8;
    const tRR = ts.response_rate || 75;
    const gr  = parseFloat(this.draft.google_rating) || null;
    const rv  = parseInt(this.draft.new_reviews)      || null;
    const rr  = parseFloat(this.draft.response_rate)  || null;

    const grStatus = gr != null ? (gr >= tGR
      ? '<span class="calc-val good">' + gr.toFixed(1) + '★ On Target</span>'
      : '<span class="calc-val warn">' + gr.toFixed(1) + '★ Below Target (' + tGR + '★)</span>') : '';
    const rvStatus = rv != null ? (rv >= tRV
      ? '<span class="calc-val good">' + rv + ' On Target</span>'
      : '<span class="calc-val warn">' + rv + ' Below Target (' + tRV + '/mo)</span>') : '';
    const rrStatus = rr != null ? (rr >= tRR
      ? '<span class="calc-val good">' + rr.toFixed(0) + '% On Target</span>'
      : '<span class="calc-val warn">' + rr.toFixed(0) + '% Below Target (' + tRR + '%)</span>') : '';

    return '<div class="card"><div class="card-title">Google Business Profile</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:160px;"><label>Google Rating ' + tt('t-google-rating') + '</label><div class="fw"><input class="suf" type="number" id="ttw-gr" value="' + esc(this.draft.google_rating) + '" step="0.1" min="1" max="5" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">★</span></div></div>'
      + '<div class="f" style="width:160px;"><label>Total Google Reviews</label><div class="fw"><input class="suf" type="number" id="ttw-gt" value="' + esc(this.draft.google_total) + '" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">total</span></div></div>'
      + '<div class="f" style="width:160px;"><label>New Reviews/Mo ' + tt('t-review-vel') + '</label><div class="fw"><input class="suf" type="number" id="ttw-nr" value="' + esc(this.draft.new_reviews) + '" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:160px;"><label>Response Rate ' + tt('t-response-rate') + '</label><div class="fw"><input class="suf" type="number" id="ttw-rr" value="' + esc(this.draft.response_rate) + '" step="1" min="0" max="100" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Rating vs Target</div><div id="ttw-gr-status">' + (grStatus || '<span class="calc-val">Enter rating</span>') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Reviews vs Target</div><div id="ttw-rv-status">' + (rvStatus || '<span class="calc-val">Enter count</span>') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Response vs Target</div><div id="ttw-rr-status">' + (rrStatus || '<span class="calc-val">Enter rate</span>') + '</div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcGBP() {
    const ts  = App.data.traffic_settings?.targets || {};
    const tGR = ts.google_rating    || 4.3;
    const tRV = ts.review_velocity  || 8;
    const tRR = ts.response_rate    || 75;
    const gr  = parseFloat(document.getElementById('ttw-gr')?.value) || null;
    const rv  = parseInt(document.getElementById('ttw-nr')?.value)   || null;
    const rr  = parseFloat(document.getElementById('ttw-rr')?.value) || null;
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('ttw-gr-status', gr != null ? (gr >= tGR ? '<span class="calc-val good">' + gr.toFixed(1) + '★ On Target</span>' : '<span class="calc-val warn">' + gr.toFixed(1) + '★ Below ' + tGR + '★ Target</span>') : '<span class="calc-val">Enter rating</span>');
    set('ttw-rv-status', rv != null ? (rv >= tRV ? '<span class="calc-val good">' + rv + ' On Target</span>'           : '<span class="calc-val warn">' + rv + ' Below ' + tRV + '/mo Target</span>') : '<span class="calc-val">Enter count</span>');
    set('ttw-rr-status', rr != null ? (rr >= tRR ? '<span class="calc-val good">' + rr.toFixed(0) + '% On Target</span>' : '<span class="calc-val warn">' + rr.toFixed(0) + '% Below ' + tRR + '% Target</span>') : '<span class="calc-val">Enter rate</span>');
  },

  step3() {
    const ts = App.data.traffic_settings?.targets || {};
    const tSS = ts.monthly_sessions || 2000;
    const ss  = parseInt(this.draft.monthly_sessions) || null;
    const ssStatus = ss != null ? (ss >= tSS
      ? '<span class="calc-val good">' + ss.toLocaleString() + ' On Target</span>'
      : '<span class="calc-val warn">' + ss.toLocaleString() + ' Below Target (' + tSS.toLocaleString() + '/mo)</span>') : '';

    return '<div class="card"><div class="card-title">Website</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;"><label>Sessions/Mo ' + tt('t-monthly-sessions') + '</label><div class="fw"><input class="suf" type="number" id="ttw-ss" value="' + esc(this.draft.monthly_sessions) + '" oninput="S.TrafficThisWeek.calcWeb()"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:180px;"><label>Bounce Rate ' + tt('t-bounce-rate') + '</label><div class="fw"><input class="suf" type="number" id="ttw-br" value="' + esc(this.draft.bounce_rate) + '" step="1" min="0" max="100" oninput="S.TrafficThisWeek.calcWeb()"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Sessions vs Target</div><div id="ttw-ss-status">' + (ssStatus || '<span class="calc-val">Enter sessions</span>') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Bounce Rate</div><div id="ttw-br-status"><span class="calc-val">Enter bounce rate</span></div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcWeb() {
    const ts  = App.data.traffic_settings?.targets || {};
    const tSS = ts.monthly_sessions || 2000;
    const ss  = parseInt(document.getElementById('ttw-ss')?.value)    || null;
    const br  = parseFloat(document.getElementById('ttw-br')?.value)  || null;
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('ttw-ss-status', ss != null ? (ss >= tSS ? '<span class="calc-val good">' + ss.toLocaleString() + ' On Target</span>' : '<span class="calc-val warn">' + ss.toLocaleString() + ' Below ' + tSS.toLocaleString() + ' Target</span>') : '<span class="calc-val">Enter sessions</span>');
    set('ttw-br-status', br != null ? (br <= 60 ? '<span class="calc-val good">' + br.toFixed(0) + '% Good</span>' : br <= 70 ? '<span class="calc-val">' + br.toFixed(0) + '% Moderate</span>' : '<span class="calc-val warn">' + br.toFixed(0) + '% High — homepage needs a clearer call to action</span>') : '<span class="calc-val">Enter bounce rate</span>');
  },

  step4() {
    const ts   = App.data.traffic_settings?.targets || {};
    const tSP  = ts.social_posts_month || 12;
    const igp  = parseInt(this.draft.ig_posts_month) || null;
    const spStatus = igp != null ? (igp >= tSP
      ? '<span class="calc-val good">' + igp + ' posts On Target</span>'
      : '<span class="calc-val warn">' + igp + ' posts Below Target (' + tSP + '/mo)</span>') : '';

    return '<div class="card"><div class="card-title">Social Media</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:180px;"><label>Instagram Followers ' + tt('t-ig-followers') + '</label><div class="fw"><input class="suf" type="number" id="ttw-igf" value="' + esc(this.draft.ig_followers) + '"/><span class="suf">followers</span></div></div>'
      + '<div class="f" style="width:180px;"><label>IG Posts/Mo ' + tt('t-social-posts') + '</label><div class="fw"><input class="suf" type="number" id="ttw-igp" value="' + esc(this.draft.ig_posts_month) + '" oninput="S.TrafficThisWeek.calcSocial()"/><span class="suf">posts</span></div></div>'
      + '<div class="f" style="width:180px;"><label>Facebook Followers ' + tt('t-fb-followers') + '</label><div class="fw"><input class="suf" type="number" id="ttw-fbf" value="' + esc(this.draft.fb_followers) + '"/><span class="suf">followers</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Posts vs Target</div><div id="ttw-sp-status">' + (spStatus || '<span class="calc-val">Enter post count</span>') + '</div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcSocial() {
    const ts  = App.data.traffic_settings?.targets || {};
    const tSP = ts.social_posts_month || 12;
    const igp = parseInt(document.getElementById('ttw-igp')?.value) || null;
    const el  = document.getElementById('ttw-sp-status');
    if (!el) return;
    el.innerHTML = igp != null ? (igp >= tSP ? '<span class="calc-val good">' + igp + ' posts On Target</span>' : '<span class="calc-val warn">' + igp + ' posts Below ' + tSP + '/mo Target</span>') : '<span class="calc-val">Enter post count</span>';
  },

  step5() {
    const d   = this.draft;
    const ts  = App.data.traffic_settings?.targets || {};
    const tGR = ts.google_rating    || 4.3;
    const tRV = ts.review_velocity  || 8;
    const tRR = ts.response_rate    || 75;
    const tSS = ts.monthly_sessions || 2000;
    const tSP = ts.social_posts_month || 12;

    const row = (label, val, target, good) => {
      const hasVal = val !== '' && val != null;
      const cls = hasVal ? (good ? 'pos' : 'neg') : '';
      return '<tr><td>' + label + '</td>'
        + '<td class="val ' + cls + '">' + (hasVal ? esc(String(val)) : '<span style="color:var(--t4);">Not entered</span>') + '</td>'
        + '<td style="color:var(--t3);">Target: ' + target + '</td></tr>';
    };

    const gr = parseFloat(d.google_rating) || null;
    const rv = parseInt(d.new_reviews)     || null;
    const rr = parseFloat(d.response_rate) || null;
    const ss = parseInt(d.monthly_sessions)|| null;
    const br = parseFloat(d.bounce_rate)   || null;
    const igp= parseInt(d.ig_posts_month)  || null;

    return '<div class="card"><div class="card-title">Review — Week ' + esc(String(d.week_num)) + '</div>'
      + '<div class="tbl-wrap" style="margin-bottom:14px;"><table class="sum-tbl"><thead><tr><th></th><th>This Week</th><th></th></tr></thead><tbody>'
      + row('Google Rating',    gr != null ? gr.toFixed(1) + '★' : '',         tGR + '★',    gr != null && gr >= tGR)
      + row('Total Reviews',    d.google_total || '',                            '',           true)
      + row('New Reviews/Mo',   rv != null ? rv + ' reviews' : '',              tRV + '/mo',  rv != null && rv >= tRV)
      + row('Response Rate',    rr != null ? rr.toFixed(0) + '%' : '',          tRR + '%',    rr != null && rr >= tRR)
      + row('Sessions/Mo', ss != null ? ss.toLocaleString() : '',          tSS.toLocaleString() + '/mo', ss != null && ss >= tSS)
      + row('Bounce Rate',      br != null ? br.toFixed(0) + '%' : '',          'Under 60%',  br != null && br <= 60)
      + row('IG Followers',     d.ig_followers || '',                            '',           true)
      + row('IG Posts/Mo',      igp != null ? igp + ' posts' : '',              tSP + '/mo',  igp != null && igp >= tSP)
      + row('FB Followers',     d.fb_followers || '',                            '',           true)
      + '</tbody></table></div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes (optional)</label><textarea id="ttw-notes" rows="2">' + esc(d.notes || '') + '</textarea></div>'
      + this.nav(true, false, true)
      + '<div id="ttw-alert-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;"><div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;"><div id="ttw-alert-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;"></div><div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-primary" id="ttw-alert-ok">OK</button></div></div></div>'
      + '</div>';
  },

  wireStep(step) {
    if (step === 2) setTimeout(() => this.calcGBP(), 0);
    if (step === 3) setTimeout(() => this.calcWeb(), 0);
    if (step === 4) setTimeout(() => this.calcSocial(), 0);

    const nxt = document.getElementById('ttw-next');
    if (nxt) nxt.onclick = () => {
      this.collectStep(step);
      this.saveDraft();
      this.renderStep(step + 1);
    };

    const prv = document.getElementById('ttw-prev');
    if (prv) prv.onclick = () => {
      this.collectStep(step);
      this.saveDraft();
      this.renderStep(Math.max(1, step - 1));
    };

    const sav = document.getElementById('ttw-save');
    if (sav) sav.onclick = () => this.saveWeek();
  },

  collectStep(step) {
    const d = this.draft;
    const val = id => document.getElementById(id)?.value ?? '';
    if (step === 1) {
      d.week_num   = val('ttw-wk');
      d.period_end = val('ttw-end');
    }
    if (step === 2) {
      d.google_rating  = val('ttw-gr');
      d.google_total   = val('ttw-gt');
      d.new_reviews    = val('ttw-nr');
      d.response_rate  = val('ttw-rr');
    }
    if (step === 3) {
      d.monthly_sessions = val('ttw-ss');
      d.bounce_rate      = val('ttw-br');
    }
    if (step === 4) {
      d.ig_followers   = val('ttw-igf');
      d.ig_posts_month = val('ttw-igp');
      d.fb_followers   = val('ttw-fbf');
    }
    if (step === 5) {
      d.notes = val('ttw-notes');
    }
  },

  async saveWeek() {
    const d = this.draft;
    d.notes = document.getElementById('ttw-notes')?.value || '';

    const gr = parseFloat(d.google_rating) || null;
    const rv = parseInt(d.new_reviews)     || null;
    const rr = parseFloat(d.response_rate) || null;
    const ss = parseInt(d.monthly_sessions)|| null;

    if (!gr && !rv && !ss) {
      const modal = document.getElementById('ttw-alert-modal');
      const msg   = document.getElementById('ttw-alert-msg');
      if (msg) msg.textContent = 'Enter at least one metric before saving — Google rating, new reviews, or monthly sessions.';
      if (modal) modal.style.display = 'flex';
      document.getElementById('ttw-alert-ok')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
      return;
    }

    const entry = {
      id:              Date.now(),
      week_num:        parseInt(d.week_num) || 1,
      period_end:      d.period_end,
      saved_at:        new Date().toISOString(),
      google_rating:   gr,
      google_total:    parseInt(d.google_total)    || null,
      new_reviews:     rv,
      response_rate:   rr,
      monthly_sessions:ss,
      bounce_rate:     parseFloat(d.bounce_rate)   || null,
      ig_followers:    parseInt(d.ig_followers)    || null,
      ig_posts_month:  parseInt(d.ig_posts_month)  || null,
      fb_followers:    parseInt(d.fb_followers)    || null,
      notes:           d.notes
    };

    App.data.traffic_weeks = App.data.traffic_weeks || [];
    App.data.traffic_weeks.push(entry);
    const ok = await App.saveKey('traffic_weeks');

    if (ok) {
      this.clearDraft();
      App.navigate('t-dashboard');
    } else {
      const e = document.getElementById('ttw-err');
      if (e) { e.textContent = 'Save failed. Try again.'; e.style.display = 'inline'; }
    }
  }
};
