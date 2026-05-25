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
      google_rating: '', google_total: '', new_reviews: '', response_rate: '',
      gbp_views: '',
      yelp_rating: '', yelp_total: '',
      monthly_sessions: '', bounce_rate: '',
      ig_followers: '', ig_posts_month: '', fb_followers: '',
      social_profile_visits: '',
      dd_active: '', dd_rating: '', ue_active: '', ue_rating: '', gh_active: '', gh_rating: '',
      delivery_orders: '', delivery_avg_order_value: '',
      email_list_size: '', emails_sent: '', email_open_rate: '',
      loyalty_active: '', loyalty_members: '',
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
    document.getElementById('topbar-sub').textContent = 'Step ' + step + ' of 7';
    this.container.innerHTML = '<div class="screen">' + this.stepsHtml() + this.getStepHtml(step) + '</div>';
    this.wireStep(step);
  },

  stepsHtml() {
    let h = '<div class="steps">';
    for (let i = 1; i <= 7; i++) {
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
      case 6: return this.step6();
      case 7: return this.step7();
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

  yesNo(id, val) {
    return '<select id="' + id + '">'
      + '<option value="">-</option>'
      + '<option value="yes"' + (val === 'yes' ? ' selected' : '') + '>Yes</option>'
      + '<option value="no"'  + (val === 'no'  ? ' selected' : '') + '>No</option>'
      + '</select>';
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
    const tGR = ts.google_rating || 4.3, tRV = ts.review_velocity || 8, tRR = ts.response_rate || 75;
    const gr = parseFloat(this.draft.google_rating) || null;
    const rv = parseInt(this.draft.new_reviews) || null;
    const rr = parseFloat(this.draft.response_rate) || null;
    const st = (v, ok, label) => v != null ? '<span class="calc-val ' + (ok ? 'good' : 'warn') + '">' + label + '</span>' : '<span class="calc-val">Enter value</span>';

    return '<div class="card"><div class="card-title">Google and Yelp</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;"><label>Google Rating ' + tt('t-google-rating') + '</label><div class="fw"><input class="suf" type="number" id="ttw-gr" value="' + esc(this.draft.google_rating) + '" step="0.1" min="1" max="5" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">★</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Google Reviews ' + tt('t-google-total') + '</label><div class="fw"><input class="suf" type="number" id="ttw-gt" value="' + esc(this.draft.google_total) + '" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">total</span></div></div>'
      + '<div class="f" style="width:130px;"><label>New Reviews/Mo ' + tt('t-review-vel') + '</label><div class="fw"><input class="suf" type="number" id="ttw-nr" value="' + esc(this.draft.new_reviews) + '" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Response Rate ' + tt('t-response-rate') + '</label><div class="fw"><input class="suf" type="number" id="ttw-rr" value="' + esc(this.draft.response_rate) + '" step="1" min="0" max="100" oninput="S.TrafficThisWeek.calcGBP()"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Yelp Rating ' + tt('t-yelp-rating') + '</label><div class="fw"><input class="suf" type="number" id="ttw-yr" value="' + esc(this.draft.yelp_rating) + '" step="0.1" min="1" max="5"/><span class="suf">★</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Yelp Reviews ' + tt('t-yelp-total') + '</label><div class="fw"><input class="suf" type="number" id="ttw-yt" value="' + esc(this.draft.yelp_total) + '"/><span class="suf">total</span></div></div>'
      + '<div class="f" style="width:160px;"><label>GBP Views/Mo ' + tt('t-gbp-views') + '</label><div class="fw"><input class="suf" type="number" id="ttw-gbpv" value="' + esc(this.draft.gbp_views) + '"/><span class="suf">/mo</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Rating vs Target</div><div id="ttw-gr-status">' + st(gr, gr>=tGR, gr!=null?(gr.toFixed(1)+'★ vs '+tGR+'★'):'') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Reviews vs Target</div><div id="ttw-rv-status">' + st(rv, rv>=tRV, rv!=null?(rv+' vs '+tRV+'/mo'):'') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Response vs Target</div><div id="ttw-rr-status">' + st(rr, rr>=tRR, rr!=null?(rr.toFixed(0)+'% vs '+tRR+'%'):'') + '</div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcGBP() {
    const ts = App.data.traffic_settings?.targets || {};
    const tGR = ts.google_rating || 4.3, tRV = ts.review_velocity || 8, tRR = ts.response_rate || 75;
    const gr = parseFloat(document.getElementById('ttw-gr')?.value) || null;
    const rv = parseInt(document.getElementById('ttw-nr')?.value) || null;
    const rr = parseFloat(document.getElementById('ttw-rr')?.value) || null;
    const set = (id, v, ok, label) => { const el = document.getElementById(id); if (el) el.innerHTML = v != null ? '<span class="calc-val ' + (ok ? 'good' : 'warn') + '">' + label + '</span>' : '<span class="calc-val">Enter value</span>'; };
    set('ttw-gr-status', gr, gr>=tGR, gr!=null?(gr.toFixed(1)+'★ vs '+tGR+'★'):'');
    set('ttw-rv-status', rv, rv>=tRV, rv!=null?(rv+' vs '+tRV+'/mo'):'');
    set('ttw-rr-status', rr, rr>=tRR, rr!=null?(rr.toFixed(0)+'% vs '+tRR+'%'):'');
  },

  step3() {
    const ts = App.data.traffic_settings?.targets || {};
    const tSS = ts.monthly_sessions || 2000;
    const ss = parseInt(this.draft.monthly_sessions) || null;
    const ssStatus = ss != null
      ? '<span class="calc-val ' + (ss>=tSS?'good':'warn') + '">' + ss.toLocaleString() + ' vs ' + tSS.toLocaleString() + '/mo</span>'
      : '<span class="calc-val">Enter sessions</span>';

    return '<div class="card"><div class="card-title">Website</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;"><label>Sessions/Mo ' + tt('t-monthly-sessions') + '</label><div class="fw"><input class="suf" type="number" id="ttw-ss" value="' + esc(this.draft.monthly_sessions) + '" oninput="S.TrafficThisWeek.calcWeb()"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:180px;"><label>Bounce Rate ' + tt('t-bounce-rate') + '</label><div class="fw"><input class="suf" type="number" id="ttw-br" value="' + esc(this.draft.bounce_rate) + '" step="1" min="0" max="100" oninput="S.TrafficThisWeek.calcWeb()"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Sessions vs Target</div><div id="ttw-ss-status">' + ssStatus + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Bounce Rate</div><div id="ttw-br-status"><span class="calc-val">Enter bounce rate</span></div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcWeb() {
    const ts = App.data.traffic_settings?.targets || {};
    const tSS = ts.monthly_sessions || 2000;
    const ss = parseInt(document.getElementById('ttw-ss')?.value) || null;
    const br = parseFloat(document.getElementById('ttw-br')?.value) || null;
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('ttw-ss-status', ss != null ? '<span class="calc-val ' + (ss>=tSS?'good':'warn') + '">' + ss.toLocaleString() + ' vs ' + tSS.toLocaleString() + '/mo</span>' : '<span class="calc-val">Enter sessions</span>');
    set('ttw-br-status', br != null ? (br <= 60 ? '<span class="calc-val good">' + br.toFixed(0) + '% Good</span>' : br <= 70 ? '<span class="calc-val">' + br.toFixed(0) + '% Moderate</span>' : '<span class="calc-val warn">' + br.toFixed(0) + '% High</span>') : '<span class="calc-val">Enter bounce rate</span>');
  },

  step4() {
    const ts = App.data.traffic_settings?.targets || {};
    const tSP = ts.social_posts_month || 12;
    const igp = parseInt(this.draft.ig_posts_month) || null;
    const spStatus = igp != null
      ? '<span class="calc-val ' + (igp>=tSP?'good':'warn') + '">' + igp + ' posts vs ' + tSP + '/mo</span>'
      : '<span class="calc-val">Enter post count</span>';

    return '<div class="card"><div class="card-title">Social Media</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:180px;"><label>Instagram Followers ' + tt('t-ig-followers') + '</label><div class="fw"><input class="suf" type="number" id="ttw-igf" value="' + esc(this.draft.ig_followers) + '"/><span class="suf">followers</span></div></div>'
      + '<div class="f" style="width:180px;"><label>IG Posts/Mo ' + tt('t-social-posts') + '</label><div class="fw"><input class="suf" type="number" id="ttw-igp" value="' + esc(this.draft.ig_posts_month) + '" oninput="S.TrafficThisWeek.calcSocial()"/><span class="suf">posts</span></div></div>'
      + '<div class="f" style="width:180px;"><label>Facebook Followers ' + tt('t-fb-followers') + '</label><div class="fw"><input class="suf" type="number" id="ttw-fbf" value="' + esc(this.draft.fb_followers) + '"/><span class="suf">followers</span></div></div>'
      + '<div class="f" style="width:200px;"><label>Profile Visits/Mo ' + tt('t-social-profile-visits') + '</label><div class="fw"><input class="suf" type="number" id="ttw-spv" value="' + esc(this.draft.social_profile_visits) + '"/><span class="suf">/mo</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Posts vs Target</div><div id="ttw-sp-status">' + spStatus + '</div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcSocial() {
    const ts = App.data.traffic_settings?.targets || {};
    const tSP = ts.social_posts_month || 12;
    const igp = parseInt(document.getElementById('ttw-igp')?.value) || null;
    const el = document.getElementById('ttw-sp-status');
    if (el) el.innerHTML = igp != null ? '<span class="calc-val ' + (igp>=tSP?'good':'warn') + '">' + igp + ' posts vs ' + tSP + '/mo</span>' : '<span class="calc-val">Enter post count</span>';
  },

  step5() {
    return '<div class="card"><div class="card-title">Delivery Platforms</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;"><label>DoorDash Active ' + tt('t-delivery-active') + '</label>' + this.yesNo('ttw-dda', this.draft.dd_active) + '</div>'
      + '<div class="f" style="width:130px;"><label>DoorDash Rating ' + tt('t-delivery-rating') + '</label><div class="fw"><input class="suf" type="number" id="ttw-dd" value="' + esc(this.draft.dd_rating) + '" step="0.1" min="1" max="5" oninput="S.TrafficThisWeek.calcDelivery()"/><span class="suf">★</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Uber Eats Active ' + tt('t-delivery-active') + '</label>' + this.yesNo('ttw-uea', this.draft.ue_active) + '</div>'
      + '<div class="f" style="width:130px;"><label>Uber Eats Rating ' + tt('t-delivery-rating') + '</label><div class="fw"><input class="suf" type="number" id="ttw-ue" value="' + esc(this.draft.ue_rating) + '" step="0.1" min="1" max="5" oninput="S.TrafficThisWeek.calcDelivery()"/><span class="suf">★</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Grubhub Active ' + tt('t-delivery-active') + '</label>' + this.yesNo('ttw-gha', this.draft.gh_active) + '</div>'
      + '<div class="f" style="width:130px;"><label>Grubhub Rating ' + tt('t-delivery-rating') + '</label><div class="fw"><input class="suf" type="number" id="ttw-gh" value="' + esc(this.draft.gh_rating) + '" step="0.1" min="1" max="5" oninput="S.TrafficThisWeek.calcDelivery()"/><span class="suf">★</span></div></div>'
      + '<div class="f" style="width:160px;"><label>Total Orders/Mo ' + tt('t-delivery-orders') + '</label><div class="fw"><input class="suf" type="number" id="ttw-dlo" value="' + esc(this.draft.delivery_orders) + '"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:160px;"><label>Avg Order Value ' + tt('t-delivery-avg-order') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ttw-dlav" value="' + esc(this.draft.delivery_avg_order_value) + '" step="0.50"/></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Delivery Rating Avg</div><div id="ttw-dl-status"><span class="calc-val">Enter ratings</span></div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcDelivery() {
    const dd = parseFloat(document.getElementById('ttw-dd')?.value) || null;
    const ue = parseFloat(document.getElementById('ttw-ue')?.value) || null;
    const gh = parseFloat(document.getElementById('ttw-gh')?.value) || null;
    const ratings = [dd, ue, gh].filter(v => v != null);
    const avg = ratings.length ? ratings.reduce((a,b) => a+b, 0) / ratings.length : null;
    const el = document.getElementById('ttw-dl-status');
    if (el) el.innerHTML = avg != null ? '<span class="calc-val ' + (avg>=4.5?'good':'warn') + '">' + avg.toFixed(1) + '★ across ' + ratings.length + ' platform' + (ratings.length===1?'':'s') + '</span>' : '<span class="calc-val">Enter ratings</span>';
  },

  step6() {
    const eor = parseFloat(this.draft.email_open_rate) || null;
    const eorStatus = eor != null
      ? '<span class="calc-val ' + (eor>=20?'good':'warn') + '">' + eor.toFixed(0) + '% vs 20% benchmark</span>'
      : '<span class="calc-val">Enter open rate</span>';

    return '<div class="card"><div class="card-title">Email and Loyalty</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:170px;"><label>Email List Size ' + tt('t-email-list') + '</label><div class="fw"><input class="suf" type="number" id="ttw-els" value="' + esc(this.draft.email_list_size) + '"/><span class="suf">contacts</span></div></div>'
      + '<div class="f" style="width:160px;"><label>Emails Sent/Mo ' + tt('t-emails-sent') + '</label><input type="number" id="ttw-esnt" value="' + esc(this.draft.emails_sent) + '"/></div>'
      + '<div class="f" style="width:160px;"><label>Email Open Rate ' + tt('t-email-open') + '</label><div class="fw"><input class="suf" type="number" id="ttw-eor" value="' + esc(this.draft.email_open_rate) + '" step="1" min="0" max="100" oninput="S.TrafficThisWeek.calcEmail()"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Loyalty Program ' + tt('t-loyalty-active') + '</label>' + this.yesNo('ttw-loya', this.draft.loyalty_active) + '</div>'
      + '<div class="f" style="width:160px;"><label>Loyalty Members ' + tt('t-loyalty-members') + '</label><div class="fw"><input class="suf" type="number" id="ttw-loym" value="' + esc(this.draft.loyalty_members) + '"/><span class="suf">members</span></div></div>'
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Open Rate</div><div id="ttw-eor-status">' + eorStatus + '</div></div>'
      + '</div>'
      + this.nav(true, true) + '</div>';
  },

  calcEmail() {
    const eor = parseFloat(document.getElementById('ttw-eor')?.value) || null;
    const el = document.getElementById('ttw-eor-status');
    if (el) el.innerHTML = eor != null ? '<span class="calc-val ' + (eor>=20?'good':'warn') + '">' + eor.toFixed(0) + '% vs 20% benchmark</span>' : '<span class="calc-val">Enter open rate</span>';
  },

  step7() {
    const d = this.draft;
    const ts = App.data.traffic_settings?.targets || {};
    const tGR = ts.google_rating || 4.3, tRV = ts.review_velocity || 8, tRR = ts.response_rate || 75;
    const tSS = ts.monthly_sessions || 2000, tSP = ts.social_posts_month || 12;

    const row = (label, val, target, good) => {
      const hasVal = val !== '' && val != null;
      const cls = hasVal && good != null ? (good ? 'pos' : 'neg') : '';
      return '<tr><td>' + label + '</td>'
        + '<td class="val ' + cls + '">' + (hasVal ? esc(String(val)) : '<span style="color:var(--t4);">Not entered</span>') + '</td>'
        + '<td style="color:var(--t3);">' + (target ? 'Target: ' + target : '') + '</td></tr>';
    };
    const num = (v, p) => { const n = p ? parseFloat(v) : parseInt(v); return isNaN(n) ? null : n; };
    const yn = v => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '';

    const gr = num(d.google_rating,1), rv = num(d.new_reviews), rr = num(d.response_rate,1);
    const yr = num(d.yelp_rating,1), ss = num(d.monthly_sessions), br = num(d.bounce_rate,1);
    const igp = num(d.ig_posts_month), eor = num(d.email_open_rate,1);

    return '<div class="card"><div class="card-title">Week ' + esc(String(d.week_num)) + ' Review</div>'
      + '<div class="tbl-wrap" style="margin-bottom:14px;"><table class="sum-tbl"><thead><tr><th></th><th>This Week</th><th></th></tr></thead><tbody>'
      + row('Google Rating',    gr != null ? gr.toFixed(1) + '★' : '',          tGR + '★',    gr != null ? gr >= tGR : null)
      + row('Total Google Reviews', d.google_total || '',                       '',           null)
      + row('New Reviews/Mo',   rv != null ? rv + ' reviews' : '',              tRV + '/mo',  rv != null ? rv >= tRV : null)
      + row('Response Rate',    rr != null ? rr.toFixed(0) + '%' : '',          tRR + '%',    rr != null ? rr >= tRR : null)
      + row('GBP Views/Mo',     d.gbp_views || '',                              '',           null)
      + row('Yelp Rating',      yr != null ? yr.toFixed(1) + '★' : '',          '4.0★',       yr != null ? yr >= 4.0 : null)
      + row('Total Yelp Reviews', d.yelp_total || '',                           '',           null)
      + row('Sessions/Mo',      ss != null ? ss.toLocaleString() : '',          tSS.toLocaleString() + '/mo', ss != null ? ss >= tSS : null)
      + row('Bounce Rate',      br != null ? br.toFixed(0) + '%' : '',          'Under 60%',  br != null ? br <= 60 : null)
      + row('IG Followers',     d.ig_followers || '',                           '',           null)
      + row('IG Posts/Mo',      igp != null ? igp + ' posts' : '',              tSP + '/mo',  igp != null ? igp >= tSP : null)
      + row('FB Followers',     d.fb_followers || '',                           '',           null)
      + row('Profile Visits/Mo', d.social_profile_visits || '',                 '',           null)
      + row('DoorDash',         yn(d.dd_active) + (d.dd_rating ? '  ' + d.dd_rating + '★' : ''),  '',  null)
      + row('Uber Eats',        yn(d.ue_active) + (d.ue_rating ? '  ' + d.ue_rating + '★' : ''),  '',  null)
      + row('Grubhub',          yn(d.gh_active) + (d.gh_rating ? '  ' + d.gh_rating + '★' : ''),  '',  null)
      + row('Delivery Orders/Mo', d.delivery_orders || '',                      '',           null)
      + row('Delivery Avg Order', d.delivery_avg_order_value ? '$' + d.delivery_avg_order_value : '', '', null)
      + row('Email List Size',  d.email_list_size || '',                        '',           null)
      + row('Emails Sent/Mo',   d.emails_sent || '',                            '',           null)
      + row('Email Open Rate',  eor != null ? eor.toFixed(0) + '%' : '',         '20% or more', eor != null ? eor >= 20 : null)
      + row('Loyalty Program',  yn(d.loyalty_active),                           '',           null)
      + row('Loyalty Members',  d.loyalty_members || '',                        '',           null)
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
    if (step === 5) setTimeout(() => this.calcDelivery(), 0);
    if (step === 6) setTimeout(() => this.calcEmail(), 0);

    const nxt = document.getElementById('ttw-next');
    if (nxt) nxt.onclick = () => { this.collectStep(step); this.saveDraft(); this.renderStep(step + 1); };

    const prv = document.getElementById('ttw-prev');
    if (prv) prv.onclick = () => { this.collectStep(step); this.saveDraft(); this.renderStep(Math.max(1, step - 1)); };

    const sav = document.getElementById('ttw-save');
    if (sav) sav.onclick = () => this.saveWeek();
  },

  collectStep(step) {
    const d = this.draft;
    const val = id => document.getElementById(id)?.value ?? '';
    if (step === 1) { d.week_num = val('ttw-wk'); d.period_end = val('ttw-end'); }
    if (step === 2) {
      d.google_rating = val('ttw-gr'); d.google_total = val('ttw-gt');
      d.new_reviews = val('ttw-nr'); d.response_rate = val('ttw-rr');
      d.yelp_rating = val('ttw-yr'); d.yelp_total = val('ttw-yt');
      d.gbp_views = val('ttw-gbpv');
    }
    if (step === 3) { d.monthly_sessions = val('ttw-ss'); d.bounce_rate = val('ttw-br'); }
    if (step === 4) {
      d.ig_followers = val('ttw-igf'); d.ig_posts_month = val('ttw-igp');
      d.fb_followers = val('ttw-fbf'); d.social_profile_visits = val('ttw-spv');
    }
    if (step === 5) {
      d.dd_active = val('ttw-dda'); d.dd_rating = val('ttw-dd');
      d.ue_active = val('ttw-uea'); d.ue_rating = val('ttw-ue');
      d.gh_active = val('ttw-gha'); d.gh_rating = val('ttw-gh');
      d.delivery_orders = val('ttw-dlo'); d.delivery_avg_order_value = val('ttw-dlav');
    }
    if (step === 6) {
      d.email_list_size = val('ttw-els'); d.emails_sent = val('ttw-esnt');
      d.email_open_rate = val('ttw-eor'); d.loyalty_active = val('ttw-loya');
      d.loyalty_members = val('ttw-loym');
    }
    if (step === 7) { d.notes = val('ttw-notes'); }
  },

  async saveWeek() {
    const d = this.draft;
    d.notes = document.getElementById('ttw-notes')?.value || '';
    const numI = v => parseInt(v) || null;
    const numF = v => parseFloat(v) || null;

    const gr = numF(d.google_rating), rv = numI(d.new_reviews), ss = numI(d.monthly_sessions);

    if (!gr && !rv && !ss) {
      const modal = document.getElementById('ttw-alert-modal');
      const msg = document.getElementById('ttw-alert-msg');
      if (msg) msg.textContent = 'Enter at least one metric before saving: Google rating, new reviews, or monthly sessions.';
      if (modal) modal.style.display = 'flex';
      document.getElementById('ttw-alert-ok')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
      return;
    }

    const entry = {
      id:               Date.now(),
      week_num:         parseInt(d.week_num) || 1,
      period_end:       d.period_end,
      saved_at:         new Date().toISOString(),
      google_rating:    gr,
      google_total:     numI(d.google_total),
      new_reviews:      rv,
      response_rate:    numF(d.response_rate),
      gbp_views:        numI(d.gbp_views),
      yelp_rating:      numF(d.yelp_rating),
      yelp_total:       numI(d.yelp_total),
      monthly_sessions: ss,
      bounce_rate:      numF(d.bounce_rate),
      ig_followers:     numI(d.ig_followers),
      ig_posts_month:   numI(d.ig_posts_month),
      fb_followers:     numI(d.fb_followers),
      social_profile_visits: numI(d.social_profile_visits),
      dd_active:        d.dd_active || null,
      dd_rating:        numF(d.dd_rating),
      ue_active:        d.ue_active || null,
      ue_rating:        numF(d.ue_rating),
      gh_active:        d.gh_active || null,
      gh_rating:        numF(d.gh_rating),
      delivery_orders:  numI(d.delivery_orders),
      delivery_avg_order_value: numF(d.delivery_avg_order_value),
      email_list_size:  numI(d.email_list_size),
      emails_sent:      numI(d.emails_sent),
      email_open_rate:  numF(d.email_open_rate),
      loyalty_active:   d.loyalty_active || null,
      loyalty_members:  numI(d.loyalty_members),
      notes:            d.notes
    };

    App.data.traffic_weeks = App.data.traffic_weeks || [];
    App.data.traffic_weeks.push(entry);
    const ok = await App.saveKey('traffic_weeks');

    if (ok) {
      this.clearDraft();
      App.markSetupDone('gs_t_week');
      App.navigate('t-dashboard');
    } else {
      const e = document.getElementById('ttw-err');
      if (e) { e.textContent = 'Save failed. Try again.'; e.style.display = 'inline'; }
    }
  }
};
