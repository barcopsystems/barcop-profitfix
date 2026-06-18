'use strict';

/* ── Traffic Recovery — Online Presence ───────────────────────────────────────
   One browsable page that breaks the whole digital storefront into the seven
   areas (Google Business, Website and Menu, Reviews, Search, Social, Delivery,
   Email). Each area reads its LIVE numbers from the latest traffic week + the
   saved profile, gives a plain Strong/Watch/Weak read, names the one next move,
   and links into that area's Fix. No charts. Replaces the seven separate area
   pages with a single status surface. Header off (in App._CONVERTED). */

S.TrafficPresence = {

  showHowTo() {
    App.showHelpModal('How Online Presence Works', [
      { p: ['This is your whole online storefront on one page. Every area that brings guests to you, Google Business, your website, reviews, search, social, delivery, and email, with its current numbers and a plain read on where it stands.'] },
      { h: 'The Read', p: ['Each area shows Strong, Watch, or Weak off your live numbers against target. Strong is pulling its weight, Watch is slipping, Weak is costing you discovery and bookings right now.'] },
      { h: 'What To Do', p: ['Each area names the single highest-payoff move. Tap Work on it to open that area\'s Fix, where the full steps and the expected payoff live. Start with the Weak ones.'] }
    ]);
  },

  // Latest traffic week (sorted by period_end, not array position).
  latestWeek() {
    const w = (App.data.traffic_weeks || []).slice()
      .sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    return w.length ? w[w.length - 1] : null;
  },

  // Status from a live value vs its target.
  ratioStatus(actual, target) {
    if (actual == null || !target) return { label: 'No data yet', color: 'var(--t3)' };
    if (actual >= target)        return { label: 'Strong', color: 'var(--green)' };
    if (actual >= target * 0.8)  return { label: 'Watch',  color: 'var(--amber)' };
    return { label: 'Weak', color: 'var(--red)' };
  },
  // Status from a completeness count (checklist areas).
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

    // 1 — Google Business
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

    // 2 — Website and Menu
    A.push({ id: 'website', title: 'Website and Menu', status: this.ratioStatus(w.monthly_sessions, t.monthly_sessions || 2000),
      stats: [
        ['Monthly visits', this.num(w.monthly_sessions), 'target ' + this.num(t.monthly_sessions || 2000)],
        ['Bounce rate', w.bounce_rate != null ? w.bounce_rate + '%' : '-'],
        ['Online ordering', this.onoff(p.web_online_order)],
        ['Online reservations', this.onoff(p.web_reservations)],
        ['Mobile ready', this.yn(p.web_mobile)]
      ],
      action: 'Put online ordering and a reservation link one tap from the homepage, and make the menu load fast on a phone.' });

    // 3 — Reviews
    A.push({ id: 'reviews', title: 'Reviews', status: this.ratioStatus(w.response_rate, t.response_rate || 75),
      stats: [
        ['Response rate', w.response_rate != null ? w.response_rate + '%' : '-', 'target ' + (t.response_rate || 75) + '%'],
        ['Google rating', w.google_rating != null ? w.google_rating + '★' : '-'],
        ['New this month', this.num(w.new_reviews), 'goal ' + (t.review_velocity || 8)],
        ['Yelp', w.yelp_rating != null ? w.yelp_rating + '★' : '-']
      ],
      action: 'Reply to every unanswered review this week, then keep up daily.' });

    // 4 — Search
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

    // 5 — Social
    A.push({ id: 'social', title: 'Social', status: this.ratioStatus(w.ig_posts_month, t.social_posts_month || 12),
      stats: [
        ['Posts this month', this.num(w.ig_posts_month), 'target ' + (t.social_posts_month || 12)],
        ['Instagram', this.num(w.ig_followers) + ' followers'],
        ['Profile visits', this.num(w.social_profile_visits)],
        ['Facebook', this.num(w.fb_followers) + ' followers']
      ],
      action: 'Post three times a week, mixing food, people, and the room.' });

    // 6 — Delivery
    const promos = (p.dd_promo ? 1 : 0) + (p.ue_promo ? 1 : 0) + (p.gh_promo ? 1 : 0);
    const delFlags = [p.dd_menu, p.dd_promo, p.ue_menu, p.ue_promo];
    A.push({ id: 'delivery', title: 'Delivery', status: this.pctStatus(delFlags.filter(Boolean).length, 4),
      stats: [
        ['Orders this month', this.num(w.delivery_orders)],
        ['Avg order', w.delivery_avg_order_value != null ? App.fmtCurrency(w.delivery_avg_order_value, 0) : '-'],
        ['DoorDash', (w.dd_rating != null ? w.dd_rating + '★ ' : '') + (w.dd_active === 'yes' ? 'live' : 'off')],
        ['UberEats', (w.ue_rating != null ? w.ue_rating + '★ ' : '') + (w.ue_active === 'yes' ? 'live' : 'off')],
        ['Promos running', String(promos)]
      ],
      action: 'Run a first-order promo and load 15 or more photos on each delivery app.' });

    // 7 — Email Marketing (loyalty dropped)
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

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const w = this.latestWeek();
    const p = (App.data.traffic_settings && App.data.traffic_settings.profile) || {};
    const t = (App.data.traffic_settings && App.data.traffic_settings.targets) || {};
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
      const rows = a.stats.filter(s => s[1] !== '-' && s[1] != null).map(s =>
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:6px 0;border-bottom:1px solid var(--row-div);">'
        + '<span style="font-size:12px;color:var(--t3);">' + s[0] + '</span>'
        + '<span style="font-size:13px;color:var(--t1);font-weight:600;text-align:right;">' + s[1]
        + (s[2] ? '<span style="font-size:11px;color:var(--t3);font-weight:400;"> &middot; ' + s[2] + '</span>' : '') + '</span></div>'
      ).join('');
      return '<div class="card" style="margin:0;display:flex;flex-direction:column;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">'
        +   '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + a.title + '</div>'
        +   '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + a.status.color + ';">' + a.status.label + '</div>'
        + '</div>'
        + '<div>' + rows + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.55;margin:12px 0 0;">' + esc(a.action) + '</div>'
        + '<div style="margin-top:auto;padding-top:12px;"><button class="btn btn-ghost btn-sm tp-fix" data-gap="' + esc(a.id) + '">Work on it &rarr;</button></div>'
        + '</div>';
    };

    const grid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;">'
      + areas.map(card).join('') + '</div>';

    const empty = !w ? '<div style="font-size:12px;color:var(--t3);margin:-6px 0 16px;">No weekly numbers yet. The reads below run off your saved profile until you confirm a week in This Week.</div>' : '';

    this.container.innerHTML = '<div class="screen">' + strip + empty + grid + '</div>';
    this.container.querySelectorAll('.tp-fix').forEach(b =>
      b.addEventListener('click', () => { App._fixFocus = b.dataset.gap; App.navigate('t-fix'); }));
  }
};
