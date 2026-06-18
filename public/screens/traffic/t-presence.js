'use strict';

/* ── Traffic Recovery — Online Tracker ─────────────────────────────────────────
   The single working surface for the whole online storefront. One page, seven
   area cards (Google Business, Website and Menu, Reviews, Search, Social,
   Delivery, Email). Each card reads its LIVE numbers from the latest traffic
   week + the saved profile, gives a plain Strong/Watch/Weak read and the one
   next move, and folds in that area's editable SETUP (the checklists and counts)
   right on the card, so the operator sees where they stand and does the work in
   one place. No charts. This replaced the seven separate area pages; the Fix
   gives the full steps and the dollar value. Header off (in App._CONVERTED). */

S.TrafficPresence = {
  _open: null,   // Set of area ids whose setup form is expanded

  citBench() { return (App.TRAFFIC_BENCHMARKS || {}).citations ?? 40; },
  engBench() { return (App.TRAFFIC_BENCHMARKS || {}).engagement_rate ?? 2; },

  showHowTo() {
    App.showHelpModal('How Online Tracker Works', [
      { p: ['Your whole online storefront on one page: Google Business, your website, reviews, search, social, delivery, and email. Each area shows its current numbers, a plain read on where it stands, and the setup you control.'] },
      { h: 'The Read', p: ['The strip up top counts how many areas are Strong, Watch, or Weak. Each area card reads off your live numbers against target: Strong is pulling its weight, Watch is slipping, Weak is costing you discovery and bookings right now. Work the Weak ones first.'] },
      { h: 'Update Setup', p: ['Tap Update Setup on any area to record what you have in place: the Google Business checklist, your website toggles, your local search items, delivery menus and ratings, email sending. Save This Area writes it. Crossing a benchmark, a finished checklist, your photo count, your citations, credits the Recovery Scoreboard on its own.'] },
      { h: 'Numbers vs Setup', p: ['Your weekly numbers, rating, reviews, visits, orders, are entered in This Week. The setup here is the state that changes when you do the work, like claiming the listing or adding a reservation link.'] },
      { h: 'Full Steps and Value', p: ['Full Steps and Value opens that area in Traffic Fix, where the ordered steps and the dollars on the table live.'] }
    ]);
  },

  // Latest traffic week (sorted by period_end, not array position).
  latestWeek() {
    const w = (App.data.traffic_weeks || []).slice()
      .sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    return w.length ? w[w.length - 1] : null;
  },
  profile() { return (App.data.traffic_settings && App.data.traffic_settings.profile) || {}; },
  targets() { return (App.data.traffic_settings && App.data.traffic_settings.targets) || {}; },

  ratioStatus(actual, target) {
    if (actual == null || !target) return { label: 'No data yet', color: 'var(--t3)' };
    if (actual >= target)        return { label: 'Strong', color: 'var(--green)' };
    if (actual >= target * 0.8)  return { label: 'Watch',  color: 'var(--amber)' };
    return { label: 'Weak', color: 'var(--red)' };
  },
  pctStatus(done, total) {
    const r = total ? done / total : 0;
    if (r >= 0.85) return { label: 'Strong', color: 'var(--green)' };
    if (r >= 0.6)  return { label: 'Watch',  color: 'var(--amber)' };
    return { label: 'Weak', color: 'var(--red)' };
  },

  num(n) { return (n == null) ? '-' : Number(n).toLocaleString('en-US'); },
  yn(v) { return v ? 'Yes' : 'No'; },
  onoff(v) { return v ? 'On' : 'Off'; },

  // Build the seven area blocks off the live week + profile + targets.
  areas(w, p, t) {
    const A = [];
    w = w || {}; p = p || {}; t = t || {};

    const gbpFlags = [p.gbp_claimed, p.gbp_hours, p.gbp_phone, p.gbp_website, p.gbp_menu, p.gbp_category, p.gbp_attributes, p.gbp_qa];
    const gbpDone = gbpFlags.filter(Boolean).length;
    A.push({ id: 'gbp', title: 'Google Business', status: this.pctStatus(gbpDone, 8),
      stats: [
        ['Google rating', w.google_rating != null ? w.google_rating + '★' : '-', 'target ' + (t.google_rating || 4.3)],
        ['Reviews', this.num(w.google_total), w.new_reviews != null ? '+' + w.new_reviews + ' this month' : ''],
        ['Profile complete', gbpDone + ' of 8'],
        ['Photos', this.num(p.gbp_photos)],
        ['Posts this month', this.num(p.gbp_posts)]
      ],
      action: 'Fill every Google Business field, add photos, and post a weekly offer.' });

    A.push({ id: 'website', title: 'Website and Menu', status: this.ratioStatus(w.monthly_sessions, t.monthly_sessions || 2000),
      stats: [
        ['Monthly visits', this.num(w.monthly_sessions), 'target ' + this.num(t.monthly_sessions || 2000)],
        ['Bounce rate', w.bounce_rate != null ? w.bounce_rate + '%' : '-'],
        ['Online ordering', this.onoff(p.web_online_order)],
        ['Online reservations', this.onoff(p.web_reservations)],
        ['Mobile ready', this.yn(p.web_mobile)]
      ],
      action: 'Put online ordering and a reservation link one tap from the homepage, and make the menu load fast on a phone.' });

    A.push({ id: 'reviews', title: 'Reviews', status: this.ratioStatus(w.response_rate, t.response_rate || 75),
      stats: [
        ['Response rate', w.response_rate != null ? w.response_rate + '%' : '-', 'target ' + (t.response_rate || 75) + '%'],
        ['Google rating', w.google_rating != null ? w.google_rating + '★' : '-'],
        ['New this month', this.num(w.new_reviews), 'goal ' + (t.review_velocity || 8)],
        ['Yelp', w.yelp_rating != null ? w.yelp_rating + '★' : '-']
      ],
      action: 'Reply to every unanswered review this week, then keep up daily.' });

    const seoFlags = [p.search_maps_pack, p.search_nap, p.search_name, p.search_address, p.search_phone, p.search_titles];
    const seoDone = seoFlags.filter(Boolean).length;
    A.push({ id: 'search-seo', title: 'Search', status: this.pctStatus(seoDone, 6),
      stats: [
        ['In Google Maps pack', this.yn(p.search_maps_pack)],
        ['Name, address, phone match', this.yn(p.search_nap)],
        ['Directory citations', this.num(p.search_citations)],
        ['Primary keyword', p.search_keyword ? esc(p.search_keyword) : '-']
      ],
      action: 'Make your name, address, and phone match exactly everywhere, and get into the Google Maps pack.' });

    A.push({ id: 'social', title: 'Social', status: this.ratioStatus(w.ig_posts_month, t.social_posts_month || 12),
      stats: [
        ['Posts this month', this.num(w.ig_posts_month), 'target ' + (t.social_posts_month || 12)],
        ['Instagram', this.num(w.ig_followers) + ' followers'],
        ['Engagement', p.social_ig_engagement != null ? p.social_ig_engagement + '%' : '-'],
        ['Facebook', this.num(w.fb_followers) + ' followers']
      ],
      action: 'Post three times a week, mixing food, people, and the room.' });

    const promos = (p.dd_promo ? 1 : 0) + (p.ue_promo ? 1 : 0) + (p.gh_promo ? 1 : 0);
    const delFlags = [p.dd_menu, p.dd_promo, p.ue_menu, p.ue_promo];
    A.push({ id: 'delivery', title: 'Delivery', status: this.pctStatus(delFlags.filter(Boolean).length, 4),
      stats: [
        ['Orders this month', this.num(w.delivery_orders)],
        ['Avg order', w.delivery_avg_order_value != null ? App.fmtCurrency(w.delivery_avg_order_value, 0) : '-'],
        ['DoorDash', (p.dd_rating != null ? p.dd_rating + '★ ' : '') + (p.dd_active === 'yes' ? 'live' : 'off')],
        ['UberEats', (p.ue_rating != null ? p.ue_rating + '★ ' : '') + (p.ue_active === 'yes' ? 'live' : 'off')],
        ['Promos running', String(promos)]
      ],
      action: 'Run a first-order promo and load 15 or more photos on each delivery app.' });

    A.push({ id: 'email-loyalty', title: 'Email Marketing', status: this.ratioStatus(w.email_open_rate, 22),
      stats: [
        ['List size', this.num(w.email_list_size)],
        ['Open rate', w.email_open_rate != null ? w.email_open_rate + '%' : '-'],
        ['Sending', p.email_frequency ? esc(p.email_frequency) : '-'],
        ['List growth', p.email_growth ? esc(p.email_growth) : '-']
      ],
      action: 'Send at least one email this week and add a sign-up so new guests opt in.' });

    return A;
  },

  // ── Field helpers (the setup forms) ─────────────────────────────────────────
  _chk(cls, key, label, p) {
    return '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="' + cls + '" data-key="' + key + '"' + (p[key] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>' + esc(label) + '</label>';
  },
  _togGrid(def, cls, p) {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:6px;">'
      + def.map(([k, label]) => this._chk(cls, k, label, p)).join('') + '</div>';
  },
  _num(id, label, val, opts) {
    const o = opts || {};
    const attrs = 'type="number"' + (o.step ? ' step="' + o.step + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '');
    const v = (val != null && val !== '') ? esc(String(val)) : '';
    const input = o.suffix
      ? '<div class="fw"><input class="form-input suf" ' + attrs + ' id="' + id + '" value="' + v + '"/><span class="suf">' + o.suffix + '</span></div>'
      : '<input class="form-input" ' + attrs + ' id="' + id + '" value="' + v + '"/>';
    return '<div class="f" style="width:200px;"><label>' + esc(label) + '</label>' + input + '</div>';
  },
  _text(id, label, val) {
    return '<div class="f" style="width:240px;"><label>' + esc(label) + '</label>'
      + '<input class="form-input" type="text" id="' + id + '" value="' + (val ? esc(String(val)) : '') + '"/></div>';
  },
  _date(id, label, val) {
    return '<div class="f" style="width:200px;"><label>' + esc(label) + '</label>'
      + '<input class="form-input" type="date" id="' + id + '" value="' + (val ? esc(String(val)).slice(0, 10) : '') + '"/></div>';
  },
  _sel(id, label, opts, val) {
    const options = opts.map(o => '<option value="' + esc(o === '-' ? '' : o) + '"' + ((val || '') === (o === '-' ? '' : o) ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
    return '<div class="f" style="width:240px;"><label>' + esc(label) + '</label>'
      + '<select class="form-input" id="' + id + '">' + options + '</select></div>';
  },
  _ta(id, label, val, ph) {
    return '<div class="f" style="width:100%;"><label>' + esc(label) + '</label>'
      + '<textarea class="notes-ta" rows="2" id="' + id + '" placeholder="' + esc(ph || '') + '">' + (val ? esc(String(val)) : '') + '</textarea></div>';
  },

  setupHtml(id, p) {
    const row = inner => '<div class="form-row" style="gap:16px;">' + inner + '</div>';
    if (id === 'gbp') {
      return this._togGrid(App.TRAFFIC_GBP_TOGGLES, 'tp-gbp-tog', p)
        + row(this._num('tp-gbp-photos', 'Photos on the listing', p.gbp_photos, { min: 0 })
            + this._num('tp-gbp-posts', 'Posts this month', p.gbp_posts, { min: 0, suffix: '/mo' }));
    }
    if (id === 'website') {
      return this._togGrid(App.TRAFFIC_WEB_TOGGLES, 'tp-web-tog', p)
        + this._ta('tp-web-notes', 'Notes on this week\'s website traffic', p.web_notes, 'Anything the numbers do not explain: a campaign that drove a spike, a slow page, a referrer that surprised you.');
    }
    if (id === 'reviews') {
      return row(this._num('tp-rev-age', 'Most recent review age', p.rev_age, { min: 0, suffix: 'days ago' }))
        + this._ta('tp-rev-patterns', 'Negative patterns noted', p.rev_patterns, 'A recurring complaint across reviews (slow service, a dish, parking, noise). Fix it at the operation, not in the reply.');
    }
    if (id === 'search-seo') {
      return this._togGrid(App.TRAFFIC_SEARCH_TOGGLES, 'tp-srch-tog', p)
        + row(this._text('tp-srch-keyword', 'Primary local keyword', p.search_keyword)
            + this._num('tp-srch-citations', 'Directory citations', p.search_citations, { min: 0, suffix: 'listings' }));
    }
    if (id === 'social') {
      return '<div style="margin-bottom:6px;">' + this._chk('tp-soc-tog', 'social_stories', 'Instagram Stories used regularly', p)
        + this._chk('tp-soc-tog', 'social_reels', 'Reels posted this month', p) + '</div>'
        + row(this._num('tp-soc-eng', 'Instagram engagement rate', p.social_ig_engagement, { step: '0.1', min: 0, suffix: '%' })
            + this._num('tp-soc-fbp', 'Facebook posts this month', p.social_fb_posts, { min: 0, suffix: '/mo' })
            + this._sel('tp-soc-mix', 'Content mix', ['-'].concat(App.TRAFFIC_SOCIAL_CONTENT_MIX), p.social_content_mix));
    }
    if (id === 'delivery') {
      // The sync checkbox stores a DATE (today on first check), so its data-key
      // is the bare platform key and its checked state reads off the saved date.
      const syncChk = k => '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;color:var(--t1);cursor:pointer;">'
        + '<input type="checkbox" class="tp-dl-sync" data-key="' + k + '"' + (p[k + '_menu_synced_at'] ? ' checked' : '')
        + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>Menu synced to in-house</label>';
      return App.TRAFFIC_DELIVERY_PLATFORMS.map(pl => {
        const k = pl.key;
        return '<div class="card" style="margin:0 0 10px;padding:12px 14px;">'
          + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:8px;">' + esc(pl.name) + '</div>'
          + '<div class="form-row" style="gap:14px;">'
          +   this._sel('tp-dl-' + k + '-active', 'Active', ['-', 'yes', 'no'], p[k + '_active'])
          +   this._num('tp-dl-' + k + '-rating', 'Rating', p[k + '_rating'], { step: '0.1', min: 1, max: 5, suffix: '★' })
          +   this._num('tp-dl-' + k + '-photos', 'Photos', p[k + '_photos'], { min: 0 })
          + '</div>'
          + '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:4px;">'
          +   this._chk('tp-dl-tog', k + '_menu', 'Menu complete', p)
          +   this._chk('tp-dl-tog', k + '_promo', 'Promo active', p)
          +   syncChk(k)
          + '</div></div>';
      }).join('');
    }
    if (id === 'email-loyalty') {
      return row(this._date('tp-em-last', 'Last send date', p.email_last_send)
        + this._sel('tp-em-freq', 'Send frequency', ['-'].concat(App.TRAFFIC_EMAIL_FREQUENCY), p.email_frequency)
        + this._sel('tp-em-growth', 'List growth', ['-'].concat(App.TRAFFIC_EMAIL_GROWTH_SOURCES), p.email_growth));
    }
    return '';
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this._open) this._open = new Set();
    // Arriving from a Fix step focuses one area's setup.
    if (App._trackerFocus) { this._open.add(App._trackerFocus); this._focusOnce = App._trackerFocus; App._trackerFocus = null; }

    const w = this.latestWeek();
    const p = this.profile();
    const t = this.targets();
    const areas = this.areas(w, p, t);

    const counts = { Strong: 0, Watch: 0, Weak: 0 };
    areas.forEach(a => { if (counts[a.status.label] != null) counts[a.status.label]++; });
    const stat = (label, val, color) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (color && val > 0 ? ' style="color:' + color + ';"' : '') + '>' + val + '</div></div>';
    const strip = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:center;">'
      + stat('Areas Strong', counts.Strong, 'var(--green)')
      + stat('Watch', counts.Watch, 'var(--amber)')
      + stat('Weak', counts.Weak, 'var(--red)')
      + '</div></div>';

    const card = a => {
      const open = this._open.has(a.id);
      const visible = a.stats.filter(s => s[1] !== '-' && s[1] != null && s[1] !== '');
      const rows = visible.map((s, i) =>
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:11px 14px;background:#0D181E;' + (i < visible.length - 1 ? 'border-bottom:1px solid var(--row-div);' : '') + '">'
        + '<span style="font-size:12px;color:var(--t3);">' + s[0] + '</span>'
        + '<span style="font-size:13px;color:var(--t1);font-weight:600;text-align:right;">' + s[1]
        + (s[2] ? '<span style="font-size:11px;color:var(--t3);font-weight:400;"> &middot; ' + s[2] + '</span>' : '') + '</span></div>'
      ).join('');
      const setup = '<div class="tp-setup" style="display:' + (open ? 'block' : 'none') + ';margin-top:14px;border-top:1px solid var(--b2);padding-top:14px;">'
        + this.setupHtml(a.id, p)
        + '<div style="margin-top:14px;display:flex;align-items:center;gap:8px;">'
        +   '<button class="btn btn-primary btn-sm tp-save" data-area="' + a.id + '">Save This Area</button>'
        +   '<span class="tp-msg" id="tp-msg-' + a.id + '" style="font-size:11px;font-weight:700;letter-spacing:0.5px;display:none;margin-left:4px;"></span>'
        + '</div></div>';
      return '<div class="card form-card tp-card" data-area="' + a.id + '" style="margin-bottom:14px;">'
        + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">'
        +   '<span>' + esc(a.title) + '</span>'
        +   '<span style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + a.status.color + ';">' + a.status.label + '</span>'
        + '</div>'
        + '<div style="border:1px solid var(--b-edge);border-radius:6px;overflow:hidden;">' + rows + '</div>'
        + setup
        + '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">'
        +   '<button class="btn btn-ghost btn-sm tp-toggle" data-area="' + a.id + '">' + (open ? 'Hide Setup' : 'Update Setup') + '</button>'
        +   '<button class="btn btn-ghost btn-sm tp-fix" data-gap="' + a.id + '">Full Steps and Value &rarr;</button>'
        + '</div></div>';
    };

    const empty = !w ? '<div style="font-size:12px;color:var(--t3);margin:-6px 0 16px;">No weekly numbers yet. The reads below run off your saved setup until you confirm a week in This Week.</div>' : '';

    container.innerHTML = '<div class="screen">' + strip + empty + areas.map(card).join('') + '</div>';

    container.querySelectorAll('.tp-toggle').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.area;
      if (this._open.has(id)) this._open.delete(id); else this._open.add(id);
      this.render(this.container, null);
    }));
    container.querySelectorAll('.tp-save').forEach(b => b.addEventListener('click', () => this.saveArea(b.dataset.area)));
    container.querySelectorAll('.tp-fix').forEach(b =>
      b.addEventListener('click', () => { App._fixFocus = b.dataset.gap; App.navigate('t-fix'); }));

    if (this._focusOnce) {
      const el = container.querySelector('.tp-card[data-area="' + this._focusOnce + '"]');
      const sc = App._activeContentEl && App._activeContentEl();
      if (el && sc) sc.scrollTop = el.offsetTop - 12;
      this._focusOnce = null;
    }
  },

  // ── Save one area's setup (ports each old page's save + Scoreboard emit) ─────
  async saveArea(id) {
    const root = this.container.querySelector('.tp-card[data-area="' + id + '"]');
    if (!root) return;
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    const intOf = el => { const n = parseInt(el && el.value); return isNaN(n) ? null : n; };
    const floatOf = el => { const n = parseFloat(el && el.value); return isNaN(n) ? null : n; };
    const emits = [];   // {gap, msg}

    if (id === 'gbp') {
      const def = App.TRAFFIC_GBP_TOGGLES;
      const beforeChecked = def.filter(([k]) => prof[k]).length;
      const beforePosts = prof.gbp_posts != null ? prof.gbp_posts : null;
      root.querySelectorAll('.tp-gbp-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
      prof.gbp_photos = intOf(root.querySelector('#tp-gbp-photos'));
      prof.gbp_posts = intOf(root.querySelector('#tp-gbp-posts'));
      prof.gbp_reviewed_at = new Date().toISOString();
      const afterChecked = def.filter(([k]) => prof[k]).length;
      if (afterChecked === def.length && beforeChecked < def.length) emits.push(['gbp', 'Google Business Profile checklist 100% complete']);
      if (prof.gbp_posts != null && prof.gbp_posts >= 8 && (beforePosts == null || beforePosts < 8)) emits.push(['gbp', 'GBP posts hit ' + prof.gbp_posts + '/mo (benchmark 8/mo)']);
    } else if (id === 'website') {
      const def = App.TRAFFIC_WEB_TOGGLES;
      const beforeSetup = def.filter(([k]) => prof[k]).length;
      root.querySelectorAll('.tp-web-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
      prof.web_notes = (root.querySelector('#tp-web-notes') || {}).value || '';
      prof.web_reviewed_at = new Date().toISOString();
      const afterSetup = def.filter(([k]) => prof[k]).length;
      if (afterSetup === def.length && beforeSetup < def.length) emits.push(['website', 'Website setup checklist 100% complete']);
    } else if (id === 'reviews') {
      prof.rev_age = intOf(root.querySelector('#tp-rev-age'));
      prof.rev_patterns = (root.querySelector('#tp-rev-patterns') || {}).value || '';
      prof.rev_reviewed_at = new Date().toISOString();
    } else if (id === 'search-seo') {
      const def = App.TRAFFIC_SEARCH_TOGGLES;
      const beforeChecked = def.filter(([k]) => prof[k]).length;
      const beforeMaps = !!prof.search_maps_pack;
      const beforeCit = prof.search_citations != null ? prof.search_citations : null;
      root.querySelectorAll('.tp-srch-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
      prof.search_keyword = (root.querySelector('#tp-srch-keyword') || {}).value || '';
      prof.search_citations = intOf(root.querySelector('#tp-srch-citations'));
      prof.search_reviewed_at = new Date().toISOString();
      const cb = this.citBench();
      const afterChecked = def.filter(([k]) => prof[k]).length;
      if (afterChecked === def.length && beforeChecked < def.length) emits.push(['search-seo', 'Local SEO checklist 100% complete']);
      if (prof.search_maps_pack && !beforeMaps) emits.push(['search-seo', 'Confirmed in the Google Maps 3-pack']);
      if (prof.search_citations != null && prof.search_citations >= cb && (beforeCit == null || beforeCit < cb)) emits.push(['search-seo', 'Citation count hit ' + prof.search_citations + ' (benchmark ' + cb + ')']);
    } else if (id === 'social') {
      const beforeEng = prof.social_ig_engagement != null ? prof.social_ig_engagement : null;
      const beforeStories = !!prof.social_stories, beforeReels = !!prof.social_reels;
      root.querySelectorAll('.tp-soc-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
      prof.social_ig_engagement = floatOf(root.querySelector('#tp-soc-eng'));
      prof.social_fb_posts = intOf(root.querySelector('#tp-soc-fbp'));
      prof.social_content_mix = (root.querySelector('#tp-soc-mix') || {}).value || '';
      prof.social_reviewed_at = new Date().toISOString();
      const eb = this.engBench();
      if (prof.social_ig_engagement != null && prof.social_ig_engagement >= eb && (beforeEng == null || beforeEng < eb)) emits.push(['social', 'Instagram engagement rate hit ' + prof.social_ig_engagement.toFixed(1) + '% (benchmark ' + eb + '%)']);
      if (prof.social_stories && !beforeStories) emits.push(['social', 'Instagram Stories now in regular use']);
      if (prof.social_reels && !beforeReels) emits.push(['social', 'Instagram Reels posted this month']);
    } else if (id === 'delivery') {
      const PL = App.TRAFFIC_DELIVERY_PLATFORMS;
      const before = {};
      PL.forEach(pl => { before[pl.key + '_menu'] = !!prof[pl.key + '_menu']; before[pl.key + '_promo'] = !!prof[pl.key + '_promo']; before[pl.key + '_sync'] = !!prof[pl.key + '_menu_synced_at']; });
      const beforeAll = PL.every(pl => prof[pl.key + '_active'] === 'yes' ? prof[pl.key + '_menu'] : true) && PL.some(pl => prof[pl.key + '_active'] === 'yes' && prof[pl.key + '_menu']);
      root.querySelectorAll('.tp-dl-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
      const todayISO = App.todayLocal();
      root.querySelectorAll('.tp-dl-sync').forEach(cb => {
        const k = cb.dataset.key + '_menu_synced_at';
        if (cb.checked) { if (!prof[k]) prof[k] = todayISO; } else { prof[k] = ''; }
      });
      PL.forEach(pl => {
        const k = pl.key;
        prof[k + '_active'] = (root.querySelector('#tp-dl-' + k + '-active') || {}).value || '';
        prof[k + '_rating'] = floatOf(root.querySelector('#tp-dl-' + k + '-rating'));
        prof[k + '_photos'] = intOf(root.querySelector('#tp-dl-' + k + '-photos'));
      });
      prof.delivery_reviewed_at = new Date().toISOString();
      const closed = [];
      PL.forEach(pl => {
        if (prof[pl.key + '_menu'] && !before[pl.key + '_menu']) closed.push(pl.name + ' menu marked complete');
        if (prof[pl.key + '_promo'] && !before[pl.key + '_promo']) closed.push(pl.name + ' promo went live');
        if (prof[pl.key + '_menu_synced_at'] && !before[pl.key + '_sync']) closed.push(pl.name + ' menu synced to in-house');
      });
      const afterAll = PL.every(pl => prof[pl.key + '_active'] === 'yes' ? prof[pl.key + '_menu'] : true) && PL.some(pl => prof[pl.key + '_active'] === 'yes' && prof[pl.key + '_menu']);
      if (afterAll && !beforeAll) closed.push('All active delivery menus complete');
      if (closed.length) emits.push(['delivery', closed.join('; ')]);
    } else if (id === 'email-loyalty') {
      const beforeFreq = prof.email_frequency || '', beforeGrowth = prof.email_growth || '';
      prof.email_last_send = (root.querySelector('#tp-em-last') || {}).value || '';
      prof.email_frequency = (root.querySelector('#tp-em-freq') || {}).value || '';
      prof.email_growth = (root.querySelector('#tp-em-growth') || {}).value || '';
      prof.email_reviewed_at = new Date().toISOString();
      const inFreq = ['', 'Rarely', 'Never'], inGrowth = ['', 'No active mechanism'];
      if (!inFreq.includes(prof.email_frequency) && inFreq.includes(beforeFreq)) emits.push(['email-loyalty', 'Email send frequency moved to ' + prof.email_frequency]);
      if (!inGrowth.includes(prof.email_growth) && inGrowth.includes(beforeGrowth)) emits.push(['email-loyalty', 'List growth mechanism active: ' + prof.email_growth]);
    }

    const ok = await App.saveKey('traffic_settings');
    if (ok) {
      if (id === 'gbp') App.markSetupDone && App.markSetupDone('gs_t_gbp');
      if (id === 'reviews') App.markSetupDone && App.markSetupDone('gs_t_reviews');
      for (const [gap, msg] of emits) { await App.emitTrafficFix(gap, msg); }
    }
    this._open.add(id);
    this.render(this.container, null);
    const m = document.getElementById('tp-msg-' + id);
    if (m) { m.textContent = ok ? 'Saved.' : 'Save failed.'; m.style.color = ok ? 'var(--gold)' : 'var(--red)'; m.style.display = 'inline'; }
  }
};
