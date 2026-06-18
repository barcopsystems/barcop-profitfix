'use strict';

/* ── Traffic Recovery — This Week ──────────────────────────────────────────────
   One page, not a seven-step wizard. Every field pre-fills from last week, so
   the operator only touches what moved, then saves. A status strip up top, the
   confirm form, then the weekly history (folded in from the old Reports page).
   Loyalty dropped. Header off (in App._CONVERTED). Saving stays on the page and
   auto-emits a Recovery fix_log on the threshold crossings the old flow did. */

S.TrafficThisWeek = {
  _form: null,
  _editId: null,

  showHowTo() {
    App.showHelpModal('How This Week Works', [
      { p: ['Each week, confirm where your online numbers landed. Bar Cop pre-fills every field from last week, so you only touch what moved, then save. One page, no wizard.'] },
      { h: 'Scan a Screenshot', p: ['Short on time, drop a screenshot of any dashboard, Google Business, Analytics, Yelp, Instagram, a delivery app, or your email tool, and Bar Cop reads the numbers off it and fills the form for you. Check what it pulled, then Save. Drop more than one to fill different areas.'] },
      { h: 'The Status Strip', p: ['Up top is where you stand right now: Google rating, review response, website visits, posting, delivery orders, and email open rate, each against target. The form below is the week you are confirming.'] },
      { h: 'Reservations', p: ['If the Audit found that you take reservations online, a Reservations field shows under Website. Enter your monthly count so the Traffic Forecast can put a dollar value on your booking channel. No reservation link yet means no field, and the Forecast shows what standing one up would be worth instead.'] },
      { h: 'History', p: ['Every saved week lands in the list below. Edit loads a past week back into the form to correct it. These weeks feed your Traffic dashboard, the Forecast, and the Recovery Scoreboard.'] }
    ]);
  },

  // Field groups — [key, label, type('num'|'money'), step, unit].
  GROUPS: [
    ['Google and Reviews', [
      ['google_rating', 'Google Rating', 'num', '0.1', '★'],
      ['google_total', 'Google Reviews', 'num', '1', 'total'],
      ['new_reviews', 'New Reviews / Mo', 'num', '1', '/mo'],
      ['response_rate', 'Response Rate', 'num', '1', '%'],
      ['yelp_rating', 'Yelp Rating', 'num', '0.1', '★'],
      ['yelp_total', 'Yelp Reviews', 'num', '1', 'total']
    ]],
    ['Website', [
      ['monthly_sessions', 'Visits / Mo', 'num', '1', '/mo'],
      ['monthly_reservations', 'Reservations / Mo', 'num', '1', '/mo'],
      ['bounce_rate', 'Bounce Rate', 'num', '1', '%']
    ]],
    ['Social', [
      ['ig_followers', 'Instagram Followers', 'num', '1', ''],
      ['ig_posts_month', 'IG Posts / Mo', 'num', '1', '/mo'],
      ['fb_followers', 'Facebook Followers', 'num', '1', '']
    ]],
    ['Delivery', [
      ['delivery_orders', 'Orders / Mo', 'num', '1', '/mo'],
      ['delivery_avg_order_value', 'Avg Order Value', 'money', '0.5', '']
    ]],
    ['Email', [
      ['email_list_size', 'Email List Size', 'num', '1', ''],
      ['emails_sent', 'Emails Sent / Mo', 'num', '1', ''],
      ['email_open_rate', 'Open Rate', 'num', '1', '%']
    ]]
  ],

  allKeys() { return this.GROUPS.reduce((a, g) => a.concat(g[1].map(f => f[0])), []); },
  weeks() { return (App.data.traffic_weeks || []).slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')); },
  latest() { const w = this.weeks(); return w.length ? w[w.length - 1] : null; },
  targets() { return (App.data.traffic_settings && App.data.traffic_settings.targets) || {}; },
  profile() { return (App.data.traffic_settings && App.data.traffic_settings.profile) || {}; },
  // Reservations are only tracked when the Audit says the operator takes them
  // online; otherwise the field stays off the form (nothing to count).
  reservationsOn() { return !!this.profile().web_reservations; },

  // A blank week pre-filled from the most recent one (confirm, not retype).
  freshForm() {
    const w = this.weeks();
    const last = w.length ? w[w.length - 1] : null;
    const f = { week_num: ((last && last.week_num) || w.length) + 1, period_end: App.nextSunday(), notes: '' };
    this.allKeys().forEach(k => { f[k] = (last && last[k] != null) ? String(last[k]) : ''; });
    return f;
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this._form) this._form = this.freshForm();
    this.draw();
  },

  draw() {
    this.container.innerHTML = '<div class="screen">'
      + this.statStrip()
      + this.scanCard()
      + this.formCard()
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      +   '<button class="btn btn-primary" id="tw-save">' + (this._editId ? 'Update Week' : 'Save Week') + '</button>'
      +   '<button class="btn btn-ghost" id="tw-start-over">Start Over</button>'
      +   '<span id="tw-err" style="font-size:12px;color:var(--red);display:none;margin-left:6px;"></span>'
      + '</div>'
      + this.historyCard()
      + '</div>';
    this.wire();
  },

  // ── Status strip — the latest saved week against target ─────────────────────
  statStrip() {
    const w = this.latest() || {};
    const t = this.targets();
    const item = (label, val, sub, good) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (good != null && val != null ? ' style="color:' + (good ? 'var(--green)' : 'var(--red)') + ';"' : '') + '>' + (val != null ? val : '-') + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    const n = v => v != null ? Number(v).toLocaleString('en-US') : null;
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + item('Google Rating', w.google_rating != null ? w.google_rating + '★' : null, 'target ' + (t.google_rating || 4.3) + '★', w.google_rating != null ? w.google_rating >= (t.google_rating || 4.3) : null)
      + item('Response Rate', w.response_rate != null ? w.response_rate + '%' : null, 'target ' + (t.response_rate || 75) + '%', w.response_rate != null ? w.response_rate >= (t.response_rate || 75) : null)
      + item('Website Visits', n(w.monthly_sessions), 'target ' + n(t.monthly_sessions || 2000), w.monthly_sessions != null ? w.monthly_sessions >= (t.monthly_sessions || 2000) : null)
      + (this.reservationsOn() ? item('Reservations', n(w.monthly_reservations), 'per month', null) : '')
      + item('Posts / Mo', w.ig_posts_month != null ? String(w.ig_posts_month) : null, 'target ' + (t.social_posts_month || 12), w.ig_posts_month != null ? w.ig_posts_month >= (t.social_posts_month || 12) : null)
      + item('Delivery Orders', n(w.delivery_orders), 'per month', null)
      + item('Email Open', w.email_open_rate != null ? w.email_open_rate + '%' : null, 'benchmark 22%', w.email_open_rate != null ? w.email_open_rate >= 22 : null)
      + '</div></div>';
  },

  // ── Confirm form — one card, grouped, pre-filled ────────────────────────────
  field(f) {
    const [key, label, type, step, unit] = f;
    const val = esc(this._form[key] != null ? this._form[key] : '');
    let input;
    if (type === 'money') {
      input = '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" step="' + step + '" id="tw-' + key + '" value="' + val + '"/></div>';
    } else if (unit) {
      input = '<div class="fw"><input class="form-input suf" type="number" step="' + step + '" id="tw-' + key + '" value="' + val + '"/><span class="suf">' + unit + '</span></div>';
    } else {
      input = '<input class="form-input" type="number" step="' + step + '" id="tw-' + key + '" value="' + val + '"/>';
    }
    return '<div class="f" style="width:170px;"><label>' + label + '</label>' + input + '</div>';
  },

  formCard() {
    const resvOn = this.reservationsOn();
    const groups = this.GROUPS.map(g =>
      '<div class="sh" style="margin:16px 0 8px;">' + g[0] + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + g[1].filter(f => f[0] !== 'monthly_reservations' || resvOn).map(f => this.field(f)).join('')
      + '</div>'
    ).join('');
    return '<div class="card form-card"><div class="card-title">' + (this._editId ? 'Edit Week' : 'Confirm This Week') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      +   '<div class="f" style="width:170px;"><label>Week ending</label><input class="form-input" type="date" id="tw-period_end" value="' + esc(this._form.period_end || '') + '"/></div>'
      + '</div>'
      + groups
      + '<div class="sh" style="margin:16px 0 8px;">Notes</div>'
      + '<div class="f" style="width:100%;"><textarea class="notes-ta" rows="2" id="tw-notes" placeholder="Optional">' + esc(this._form.notes || '') + '</textarea></div>'
      + '</div>';
  },

  // ── Weekly history (folded in from the old Reports page) ────────────────────
  historyCard() {
    const all = this.weeks().slice().reverse();   // newest first
    if (!all.length) return '<div style="font-size:12px;color:var(--t3);margin-top:8px;">No weeks saved yet. Confirm your first week above.</div>';
    const t = this.targets();
    const shown = all.slice(0, App.listLimit('core', 'traffic_weeks_hist'));
    const rows = shown.map(w => {
      const cell = (val, good) => '<td' + (good != null && val != null ? ' style="color:' + (good ? 'var(--green)' : 'var(--red)') + ';"' : '') + '>' + (val != null && val !== '' ? val : '-') + '</td>';
      return '<tr>'
        + '<td><div class="val">' + (w.period_end || '').slice(0, 10) + '</div></td>'
        + cell(w.google_rating != null ? w.google_rating + '★' : null, w.google_rating != null ? w.google_rating >= (t.google_rating || 4.3) : null)
        + cell(w.response_rate != null ? w.response_rate + '%' : null, w.response_rate != null ? w.response_rate >= (t.response_rate || 75) : null)
        + cell(w.monthly_sessions != null ? Number(w.monthly_sessions).toLocaleString('en-US') : null, w.monthly_sessions != null ? w.monthly_sessions >= (t.monthly_sessions || 2000) : null)
        + cell(w.ig_posts_month != null ? String(w.ig_posts_month) : null, w.ig_posts_month != null ? w.ig_posts_month >= (t.social_posts_month || 12) : null)
        + cell(w.delivery_orders != null ? String(w.delivery_orders) : null, null)
        + '<td style="text-align:right;"><div class="row-actions"><button class="btn btn-ghost btn-sm tw-edit" data-id="' + esc(String(w.id)) + '">Edit</button></div></td>'
        + '</tr>';
    }).join('');
    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      +   '<div class="sh" style="margin:0;">Weekly History</div>'
      +   '<button class="btn btn-ghost btn-sm" id="tw-hist-export">Export PDF</button>'
      + '</div>'
      + '<div id="tw-hist-export-area"><div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl">'
      +   '<thead><tr><th>Week ending</th><th>Rating</th><th>Response</th><th>Visits</th><th>Posts</th><th>Orders</th><th></th></tr></thead>'
      +   '<tbody>' + rows + '</tbody></table></div></div></div>'
      + App.showOlderBar('core', 'traffic_weeks_hist', all, false);
  },

  // ── Scan a screenshot — vision prefill through the existing /api/claude proxy ─
  SCAN_PROMPT: 'You are reading one screenshot from a bar or restaurant\'s online dashboard. It could be Google Business Profile, Google Analytics, a Yelp page, Instagram, Facebook, a delivery platform (DoorDash, Uber Eats, Grubhub), or an email tool such as Mailchimp. Extract only the metrics you can clearly see. Respond with a single JSON object and nothing else, including only the keys you can read and omitting the rest. Keys: google_rating (star rating), google_total (total Google reviews), new_reviews (reviews this month), response_rate (percent), yelp_rating, yelp_total, monthly_sessions (website visits per month), monthly_reservations (online reservations per month), bounce_rate (percent), ig_followers, ig_posts_month (posts in the last 30 days), fb_followers, delivery_orders (orders this month), delivery_avg_order_value (dollars), email_list_size, emails_sent (this month), email_open_rate (percent). All values plain numbers, no symbols, no percent signs, no words.',

  scanCard() {
    return '<div class="card form-card" style="margin-bottom:14px;"><div class="card-title">Scan a Screenshot</div>'
      + '<div id="tw-drop" style="border:1px dashed var(--b-edge);background:var(--input);border-radius:8px;padding:22px 18px;text-align:center;transition:background .15s,border-color .15s;">'
      +   '<div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:4px;">Drop a dashboard screenshot</div>'
      +   '<div style="font-size:12px;color:var(--t3);line-height:1.5;max-width:480px;margin:0 auto 10px;">Google Business, Analytics, Yelp, Instagram, a delivery app, or your email tool. Bar Cop reads the numbers and fills the form below to confirm.</div>'
      +   '<button class="btn btn-ghost btn-sm" id="tw-scan-pick" type="button">Choose Image</button>'
      +   '<input type="file" id="tw-scan-file" accept="image/png,image/jpeg" style="display:none;"/>'
      + '</div>'
      + '<div id="tw-scan-status" style="display:none;font-size:12px;font-weight:600;margin-top:10px;"></div>'
      + '</div>';
  },
  _scanStatus(msg, color) {
    const el = document.getElementById('tw-scan-status');
    if (!el) return;
    el.textContent = msg; el.style.color = color || 'var(--t2)'; el.style.display = 'block';
  },
  _readB64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const s = String(fr.result || ''); const i = s.indexOf(','); res(i >= 0 ? s.slice(i + 1) : s); };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  },
  _parseScan(raw) {
    if (!raw) return null;
    const s = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < 0) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  },
  applyScan(obj) {
    const valid = new Set(this.allKeys());
    let n = 0;
    Object.keys(obj).forEach(k => {
      if (!valid.has(k)) return;
      const num = Number(obj[k]);
      if (obj[k] == null || obj[k] === '' || isNaN(num)) return;
      this._form[k] = String(num); n++;
    });
    return n;
  },
  async handleScan(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { this._scanStatus('Drop a PNG or JPG screenshot.', 'var(--red)'); return; }
    this._scanStatus('Reading your screenshot...', 'var(--gold)');
    let b64;
    try { b64 = await this._readB64(file); } catch (e) { this._scanStatus('Could not read that file. Try another.', 'var(--red)'); return; }
    const media_type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    try {
      const r = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 500,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type, data: b64 } },
            { type: 'text', text: this.SCAN_PROMPT }
          ] }]
        })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data.error) { this._scanStatus('Could not read it: ' + (data.error.message || 'try again') + '.', 'var(--red)'); return; }
      const obj = this._parseScan(data.content && data.content[0] && data.content[0].text);
      if (!obj) { this._scanStatus('Could not read numbers from that image. Try a clearer screenshot, or enter them by hand.', 'var(--red)'); return; }
      const n = this.applyScan(obj);
      if (!n) { this._scanStatus('No matching numbers in that screenshot. Try another, or enter them by hand.', 'var(--amber)'); return; }
      this.draw();
      this._scanStatus('Filled ' + n + ' number' + (n === 1 ? '' : 's') + ' from your screenshot. Check them below, then Save.', 'var(--gold)');
    } catch (e) { this._scanStatus('Scan failed. Check your connection, or enter the numbers by hand.', 'var(--red)'); }
  },

  collect() {
    const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    this._form.period_end = v('tw-period_end');
    this._form.notes = v('tw-notes');
    this.allKeys().forEach(k => { this._form[k] = v('tw-' + k); });
  },

  wire() {
    // Capture every keystroke into state so a re-render never loses work.
    this.container.querySelectorAll('#tw-period_end, #tw-notes, [id^="tw-"]').forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.addEventListener('input', () => this.collect());
    });
    document.getElementById('tw-save').onclick = () => this.saveWeek();
    document.getElementById('tw-start-over').onclick = () => { this._form = this.freshForm(); this._editId = null; this.draw(); };
    this.container.querySelectorAll('.tw-edit').forEach(b => b.addEventListener('click', () => this.loadForEdit(b.dataset.id)));
    document.getElementById('tw-hist-export')?.addEventListener('click', () => App.exportPDF({ title: 'Traffic Weekly History', root: document.getElementById('tw-hist-export-area') || this.container }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.draw()));

    // Screenshot scan dropzone
    const drop = document.getElementById('tw-drop');
    const fileInput = document.getElementById('tw-scan-file');
    document.getElementById('tw-scan-pick')?.addEventListener('click', () => fileInput && fileInput.click());
    fileInput?.addEventListener('change', () => { if (fileInput.files && fileInput.files[0]) this.handleScan(fileInput.files[0]); });
    if (drop) {
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.background = 'var(--gold-tint)'; drop.style.borderColor = 'var(--gold-tint-bord)'; }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.background = 'var(--input)'; drop.style.borderColor = 'var(--b-edge)'; }));
      drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) this.handleScan(f); });
    }
  },

  loadForEdit(id) {
    const rec = this.weeks().find(w => String(w.id) === String(id));
    if (!rec) return;
    const f = { week_num: rec.week_num, period_end: (rec.period_end || '').slice(0, 10), notes: rec.notes || '' };
    this.allKeys().forEach(k => { f[k] = rec[k] != null ? String(rec[k]) : ''; });
    this._form = f;
    this._editId = id;
    this.draw();
    const sc = App._activeContentEl && App._activeContentEl();
    if (sc) sc.scrollTop = 0;
  },

  async saveWeek() {
    this.collect();
    const d = this._form;
    const numI = v => { const n = parseInt(v); return isNaN(n) ? null : n; };
    const numF = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    if (numF(d.google_rating) == null && numI(d.new_reviews) == null && numI(d.monthly_sessions) == null) {
      const e = document.getElementById('tw-err');
      if (e) { e.textContent = 'Enter at least one number before saving.'; e.style.display = 'inline'; }
      return;
    }

    const weeks = this.weeks();
    const prev = weeks.length ? weeks[weeks.length - 1] : null;
    const tRR = this.targets().response_rate || 75;
    const rr = numF(d.response_rate), list = numI(d.email_list_size);

    const entry = {
      id: this._editId || App.uid(),
      week_num: numI(d.week_num) || (weeks.length + 1),
      period_end: d.period_end,
      date: d.period_end,
      saved_at: new Date().toISOString(),
      google_rating: numF(d.google_rating), google_total: numI(d.google_total),
      new_reviews: numI(d.new_reviews), response_rate: rr,
      yelp_rating: numF(d.yelp_rating), yelp_total: numI(d.yelp_total),
      monthly_sessions: numI(d.monthly_sessions), monthly_reservations: numI(d.monthly_reservations), bounce_rate: numF(d.bounce_rate),
      ig_followers: numI(d.ig_followers), ig_posts_month: numI(d.ig_posts_month),
      fb_followers: numI(d.fb_followers),
      delivery_orders: numI(d.delivery_orders), delivery_avg_order_value: numF(d.delivery_avg_order_value),
      email_list_size: list, emails_sent: numI(d.emails_sent), email_open_rate: numF(d.email_open_rate),
      notes: d.notes || ''
    };

    const ok = await App.putRecord('core', 'traffic_week', entry);
    if (!ok) {
      const e = document.getElementById('tw-err');
      if (e) { e.textContent = 'Save failed. Try again.'; e.style.display = 'inline'; }
      return;
    }

    // Auto-emit a Recovery fix_log on a fresh week's threshold crossings, so the
    // Scoreboard credits the work without a manual "mark implemented".
    if (!this._editId) {
      if (rr != null && rr >= tRR && (prev == null || prev.response_rate == null || prev.response_rate < tRR)) {
        await App.emitTrafficFix('reviews', 'Review response rate hit ' + Math.round(rr) + '% (target ' + tRR + '%)');
      }
      if (list != null && prev && prev.email_list_size != null && (list - prev.email_list_size) >= 10) {
        await App.emitTrafficFix('email-loyalty', 'Email list grew by ' + (list - prev.email_list_size).toLocaleString('en-US') + ' contacts');
      }
      if (App.markSetupDone) App.markSetupDone('gs_t_week');
    }

    this._editId = null;
    this._form = this.freshForm();
    this.draw();
  }
};
