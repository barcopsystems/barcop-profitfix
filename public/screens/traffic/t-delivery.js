'use strict';
S.TrafficDelivery = {
  PLATFORMS: [
    { key: 'dd', name: 'DoorDash' },
    { key: 'ue', name: 'Uber Eats' },
    { key: 'gh', name: 'Grubhub' }
  ],
  RATING_BENCHMARK: 4.5,

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;

    const plats = this.PLATFORMS.map(p => ({
      key: p.key, name: p.name,
      active: latest ? latest[p.key + '_active'] === 'yes' : false,
      rating: latest ? (latest[p.key + '_rating'] ?? null) : null,
      photos: prof[p.key + '_photos'] != null ? prof[p.key + '_photos'] : null,
      menu:   !!prof[p.key + '_menu'],
      promo:  !!prof[p.key + '_promo']
    }));
    const activeP   = plats.filter(p => p.active);
    const ratings   = plats.map(p => p.rating).filter(v => v != null);
    const avgRating = ratings.length ? ratings.reduce((a,b) => a+b, 0) / ratings.length : null;
    const menusDone = activeP.filter(p => p.menu).length;
    const promosOn  = activeP.filter(p => p.promo).length;

    // ── Metric cards ──
    const card = (label, valHtml, targetStr) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + targetStr + '</div><div class="metric-trend"> </div></div>';
    const onTargetVal = (val, ok) => '<div class="metric-val ' + (ok ? 'on-target' : 'over-target') + '">' + val + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const cards =
        card('Platforms Active', onTargetVal(activeP.length + ' of 3', activeP.length >= 1), '3 major platforms')
      + card('Average Rating',   avgRating != null ? onTargetVal(avgRating.toFixed(1) + '★', avgRating >= this.RATING_BENCHMARK) : noData, 'Target: ' + this.RATING_BENCHMARK + '★')
      + card('Menus Complete',   onTargetVal(menusDone + ' of ' + activeP.length, activeP.length > 0 && menusDone === activeP.length), 'On every active platform')
      + card('Promos Running',   onTargetVal(promosOn + ' of ' + activeP.length, activeP.length > 0 && promosOn > 0), 'At least one promo live');

    // ── Average rating trend ──
    const recent = weeks.slice(-8);
    const ratingChart = App.trendChart({
      title: 'Average Delivery Rating', target: this.RATING_BENCHMARK,
      points: recent.map(w => {
        const r = ['dd','ue','gh'].map(k => w[k + '_rating']).filter(v => v != null);
        return { label: 'Wk ' + w.week_num, value: r.length ? Math.round(r.reduce((a,b)=>a+b,0)/r.length*100)/100 : null };
      })
    });

    // ── Per-platform detail ──
    const platBlocks = plats.map(p => {
      const statusBadge = p.active
        ? '<span style="color:var(--gold);font-weight:700;">Active</span>'
        : '<span style="color:var(--t3);font-weight:700;">Not Active</span>';
      const ratingTxt = p.rating != null
        ? ' &nbsp;·&nbsp; <span style="color:' + (p.rating >= this.RATING_BENCHMARK ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + p.rating.toFixed(1) + '★</span>'
        : '';
      return '<div style="padding:14px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:10px;">' + p.name + ' &nbsp;·&nbsp; ' + statusBadge + ratingTxt + '</div>'
        + '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;">'
        + '<div class="f" style="width:150px;"><label>Photo Count ' + tt('t-delivery-photos') + '</label><div class="fw"><input class="suf" type="number" id="dl-' + p.key + '-photos" value="' + (p.photos != null ? p.photos : '') + '" min="0"/><span class="suf">photos</span></div></div>'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="dl-tog" data-key="' + p.key + '_menu"' + (p.menu ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Menu complete</label>'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="dl-tog" data-key="' + p.key + '_promo"' + (p.promo ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Promo active</label>'
        + '</div></div>';
    }).join('');

    const formCard = '<div class="card">'
      + '<div class="card-title">Delivery Platform Detail</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:6px;">Active status and rating come from This Week. Set photo count, menu, and promo status here.</div>'
      + platBlocks
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="dl-save">Save Platform Detail</button>'
      + '<span id="dl-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (activeP.length === 0) tips.push('Not active on any delivery platform. DoorDash, Uber Eats, and Grubhub are discovery channels — being absent means missed orders and missed visibility.');
    plats.forEach(p => {
      if (p.active && p.rating != null && p.rating < this.RATING_BENCHMARK) tips.push(p.name + ' rating is ' + p.rating.toFixed(1) + '★, below the ' + this.RATING_BENCHMARK + '★ benchmark. Low delivery ratings push you down the platform feed.');
      if (p.active && !p.menu) tips.push(p.name + ' menu is not marked complete. An incomplete menu costs orders — add every item, photo, and modifier.');
      if (p.active && p.photos != null && p.photos < 20) tips.push(p.name + ' has only ' + p.photos + ' photos. Platforms favor listings with strong photography.');
    });
    if (activeP.length > 0 && promosOn === 0) tips.push('No promos running on any platform. A first-order or limited-time promo lifts placement in the platform feed.');
    if (!latest) tips.push('No weekly data yet. Enter delivery platform status in This Week to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Delivery Is Dialed In</div>'
        + '<div class="empty-sub">Active platforms are well rated with complete menus and live promos. Keep ratings up by hitting prep times.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + ratingChart
      + formCard
      + tipsCard
      + '</div>';

    document.getElementById('dl-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    this.container.querySelectorAll('.dl-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    this.PLATFORMS.forEach(p => {
      const n = parseInt(document.getElementById('dl-' + p.key + '-photos')?.value);
      prof[p.key + '_photos'] = isNaN(n) ? null : n;
    });
    const ok = await App.saveKey('traffic_settings');
    this.draw();
    const msg = document.getElementById('dl-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
