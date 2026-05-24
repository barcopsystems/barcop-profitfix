'use strict';
S.TrafficGBP = {
  // Profile completeness checklist — stored once in traffic_settings.profile
  TOGGLES: [
    ['gbp_claimed',    'Listing claimed'],
    ['gbp_hours',      'Hours complete'],
    ['gbp_phone',      'Phone number present'],
    ['gbp_website',    'Website linked'],
    ['gbp_menu',       'Menu link active'],
    ['gbp_category',   'Primary category set'],
    ['gbp_attributes', 'Attributes complete'],
    ['gbp_qa',         'Q and A populated']
  ],

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const tGR   = ts.targets?.google_rating || 4.3;
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;

    const checked    = this.TOGGLES.filter(([k]) => prof[k]).length;
    const completion = Math.round(checked / this.TOGGLES.length * 100);
    const photos = prof.gbp_photos != null ? prof.gbp_photos : null;
    const posts  = prof.gbp_posts  != null ? prof.gbp_posts  : null;
    const rating = latest?.google_rating ?? null;
    const reviews = latest?.google_total ?? null;

    // ── Metric cards ──
    const card = (label, valHtml, targetStr) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + valHtml
      + '<div class="metric-target">' + targetStr + '</div>'
      + '<div class="metric-trend"> </div></div>';

    const onTargetVal = (val, onTarget) => '<div class="metric-val ' + (onTarget == null ? '' : onTarget ? 'on-target' : 'over-target') + '">' + val + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const cards =
        card('Profile Completeness', '<div class="metric-val" style="color:' + App.scoreColor(completion) + ';">' + completion + '%</div>', checked + ' of ' + this.TOGGLES.length + ' complete')
      + card('Google Rating',  rating  != null ? onTargetVal(rating.toFixed(1) + '★', rating >= tGR) : noData, 'Target: ' + tGR + '★')
      + card('Photo Count',    photos  != null ? onTargetVal(photos.toLocaleString(), photos >= 100) : noData, 'Benchmark: 100+')
      + card('GBP Posts/Mo',   posts   != null ? onTargetVal(String(posts), posts >= 8) : noData, 'Benchmark: 8/mo');

    // ── Completeness checklist ──
    const toggleRows = this.TOGGLES.map(([k, label]) =>
      '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="gbp-tog" data-key="' + k + '"' + (prof[k] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>'
      + label + '</label>'
    ).join('');

    const profileCard = '<div class="card">'
      + '<div class="card-title">Profile Completeness</div>'
      + reviewedNote(prof.gbp_reviewed_at)
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:16px;">' + toggleRows + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:170px;"><label>Photo Count ' + tt('t-gbp-photos') + '</label><div class="fw"><input class="suf" type="number" id="gbp-photos" value="' + (photos != null ? photos : '') + '" min="0"/><span class="suf">photos</span></div></div>'
      + '<div class="f" style="width:170px;"><label>GBP Posts/Mo ' + tt('t-gbp-posts') + '</label><div class="fw"><input class="suf" type="number" id="gbp-posts" value="' + (posts != null ? posts : '') + '" min="0"/><span class="suf">posts</span></div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="gbp-save">Save Profile</button>'
      + '<span id="gbp-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action tips ──
    const tips = [];
    this.TOGGLES.forEach(([k, label]) => { if (!prof[k]) tips.push('Complete this profile item: ' + label + '.'); });
    if (rating != null && rating < tGR) tips.push('Google rating is ' + rating.toFixed(1) + '★, below the ' + tGR + '★ target. Ask satisfied guests for reviews.');
    if (photos != null && photos < 100) tips.push('Photo count is ' + photos + '. Aim for 100 or more. Listings with more photos get more clicks.');
    if (posts != null && posts < 8) tips.push('Only ' + posts + ' GBP posts this month. Post at least 8. Offers, events, and updates keep the listing active.');
    if (photos == null) tips.push('Enter your photo count above to score this section.');
    if (posts == null) tips.push('Enter your GBP posts this month above to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Profile Looks Strong</div>'
        + '<div class="empty-sub">Every Google Business Profile item is complete and on benchmark. Keep posting and gathering reviews.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + profileCard
      + tipsCard
      + '</div>';

    document.getElementById('gbp-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    this.container.querySelectorAll('.gbp-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    const photos = parseInt(document.getElementById('gbp-photos')?.value);
    const posts  = parseInt(document.getElementById('gbp-posts')?.value);
    prof.gbp_photos = isNaN(photos) ? null : photos;
    prof.gbp_posts  = isNaN(posts)  ? null : posts;
    prof.gbp_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    if (ok) App.markSetupDone('gs_t_gbp');
    this.draw();
    const msg = document.getElementById('gbp-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
