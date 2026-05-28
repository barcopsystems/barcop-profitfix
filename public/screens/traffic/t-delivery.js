'use strict';
S.TrafficDelivery = {
  // Platforms drive off the canonical App.TRAFFIC_DELIVERY_PLATFORMS list so
  // adding ezCater (or any future platform) updates t-delivery, t-this-week,
  // t-reports, t-dashboard, and t-audit from one place.
  get PLATFORMS() { return App.TRAFFIC_DELIVERY_PLATFORMS; },
  get RATING_BENCHMARK() { return App.TRAFFIC_BENCHMARKS.delivery_rating; },

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  // Active + rating canonical store is traffic_settings.profile. Reads here
  // fall back to the latest weekly snapshot so legacy data survives. This
  // closes the two-doors-same-data candidate where active + rating were
  // typed in This Week wizard step 5 AND displayed on t-delivery — operators
  // hit one canonical edit point now and the menu sync timestamp lives with
  // the other delivery profile fields.
  _readActive(p, prof, latest) {
    if (prof[p.key + '_active'] != null) return prof[p.key + '_active'] === 'yes';
    if (latest && latest[p.key + '_active'] != null) return latest[p.key + '_active'] === 'yes';
    return false;
  },
  _readRating(p, prof, latest) {
    if (prof[p.key + '_rating'] != null) return prof[p.key + '_rating'];
    if (latest && latest[p.key + '_rating'] != null) return latest[p.key + '_rating'];
    return null;
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;

    const plats = this.PLATFORMS.map(p => ({
      key: p.key, name: p.name,
      active:        this._readActive(p, prof, latest),
      rating:        this._readRating(p, prof, latest),
      photos:        prof[p.key + '_photos'] != null ? prof[p.key + '_photos'] : null,
      menu:          !!prof[p.key + '_menu'],
      promo:         !!prof[p.key + '_promo'],
      menu_synced:   prof[p.key + '_menu_synced_at'] || ''
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
        card('Platforms Active', onTargetVal(activeP.length + ' of ' + this.PLATFORMS.length, activeP.length >= 1), this.PLATFORMS.length + ' platforms tracked')
      + card('Average Rating',   avgRating != null ? onTargetVal(avgRating.toFixed(1) + '★', avgRating >= this.RATING_BENCHMARK) : noData, 'Target: ' + this.RATING_BENCHMARK + '★')
      + card('Menus Complete',   onTargetVal(menusDone + ' of ' + activeP.length, activeP.length > 0 && menusDone === activeP.length), 'On every active platform')
      + card('Promos Running',   onTargetVal(promosOn + ' of ' + activeP.length, activeP.length > 0 && promosOn > 0), 'At least one promo live');

    // ── Average rating trend ──
    // Plot the per-week average across whatever rating data exists for each
    // week (profile-canonical now, weekly snapshot for legacy). Pulls the
    // canonical store for the current week so the chart updates the moment
    // an operator edits a rating without waiting for the next weekly save.
    const recent = weeks.slice(-8);
    const ratingChart = App.trendChart({
      title: 'Average Delivery Rating', target: this.RATING_BENCHMARK,
      points: recent.map((w, idx) => {
        const isLatest = idx === recent.length - 1;
        const r = this.PLATFORMS.map(p => {
          if (isLatest && prof[p.key + '_rating'] != null) return prof[p.key + '_rating'];
          return w[p.key + '_rating'];
        }).filter(v => v != null);
        return { label: 'Wk ' + w.week_num, value: r.length ? Math.round(r.reduce((a,b)=>a+b,0)/r.length*100)/100 : null };
      })
    });

    // ── Per-platform detail ──
    const platBlocks = plats.map(p => {
      const syncedTxt = p.menu_synced ? ' &nbsp;·&nbsp; <span style="color:var(--t3);font-size:11px;">Menu synced ' + esc(p.menu_synced) + '</span>' : '';
      const ratingTxt = p.rating != null
        ? ' &nbsp;·&nbsp; <span style="color:' + (p.rating >= this.RATING_BENCHMARK ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + p.rating.toFixed(1) + '★</span>'
        : '';
      return '<div style="padding:14px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:10px;">' + p.name + ratingTxt + syncedTxt + '</div>'
        + '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f" style="width:120px;"><label>Active</label>'
          + '<select class="dl-active" data-key="' + p.key + '">'
          +   '<option value=""'    + (prof[p.key + '_active'] == null ? ' selected' : '') + '>-</option>'
          +   '<option value="yes"' + (prof[p.key + '_active'] === 'yes' ? ' selected' : '') + '>Yes</option>'
          +   '<option value="no"'  + (prof[p.key + '_active'] === 'no'  ? ' selected' : '') + '>No</option>'
          + '</select></div>'
        + '<div class="f" style="width:130px;"><label>Rating</label><div class="fw"><input class="suf dl-rating" data-key="' + p.key + '" type="number" value="' + (p.rating != null ? p.rating : '') + '" step="0.1" min="1" max="5"/><span class="suf">★</span></div></div>'
        + '<div class="f" style="width:150px;"><label>Photo Count ' + tt('t-delivery-photos') + '</label><div class="fw"><input class="suf" type="number" id="dl-' + p.key + '-photos" value="' + (p.photos != null ? p.photos : '') + '" min="0"/><span class="suf">photos</span></div></div>'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding-bottom:9px;"><input type="checkbox" class="dl-tog" data-key="' + p.key + '_menu"' + (p.menu ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Menu complete</label>'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding-bottom:9px;"><input type="checkbox" class="dl-tog" data-key="' + p.key + '_promo"' + (p.promo ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Promo active</label>'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding-bottom:9px;"><input type="checkbox" class="dl-tog-sync" data-key="' + p.key + '"' + (p.menu_synced ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Menu synced to in-house</label>'
        + '</div></div>';
    }).join('');

    const formCard = '<div class="card">'
      + '<div class="card-title">Delivery Platform Detail</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:6px;">Active status and rating live here. Weekly order volume and average ticket get typed in This Week.</div>'
      + reviewedNote(prof.delivery_reviewed_at)
      + platBlocks
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="dl-save">Save Platform Detail</button>'
      + '<span id="dl-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (activeP.length === 0) tips.push('Not active on any delivery platform. DoorDash, Uber Eats, Grubhub, and ezCater are discovery channels. Being absent means missed orders and missed visibility.');
    plats.forEach(p => {
      if (p.active && p.rating != null && p.rating < this.RATING_BENCHMARK) tips.push(p.name + ' rating is ' + p.rating.toFixed(1) + '★, below the ' + this.RATING_BENCHMARK + '★ benchmark. Low delivery ratings push you down the platform feed.');
      if (p.active && !p.menu) tips.push(p.name + ' menu is not marked complete. An incomplete menu costs orders. Add every item, photo, and modifier.');
      if (p.active && p.photos != null && p.photos < 20) tips.push(p.name + ' has only ' + p.photos + ' photos. Platforms favor listings with strong photography.');
      if (p.active && !p.menu_synced) tips.push(p.name + ' menu is not marked synced to your in-house menu. Prices and availability drift; a guest who orders an item that came off the menu leaves a one-star review.');
    });
    if (activeP.length > 0 && promosOn === 0) tips.push('No promos running on any platform. A first-order or limited-time promo lifts placement in the platform feed.');
    if (activeP.length === 0 && !latest) tips.push('No platforms marked active yet. Set Active on the platforms you list on, then enter rating, photo count, menu, and promo status.');

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

    // Snapshot the values that drive fix_log thresholds BEFORE writing, so we
    // can compare new vs old and credit the operator when a gap just closed.
    const before = {};
    this.PLATFORMS.forEach(p => {
      before[p.key + '_menu']  = !!prof[p.key + '_menu'];
      before[p.key + '_promo'] = !!prof[p.key + '_promo'];
      before[p.key + '_sync']  = !!prof[p.key + '_menu_synced_at'];
    });
    const beforeAllMenusComplete = this.PLATFORMS.every(p => prof[p.key + '_active'] === 'yes' ? prof[p.key + '_menu'] : true)
      && this.PLATFORMS.some(p => prof[p.key + '_active'] === 'yes' && prof[p.key + '_menu']);

    this.container.querySelectorAll('.dl-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    this.container.querySelectorAll('.dl-active').forEach(sel => { prof[sel.dataset.key + '_active'] = sel.value || ''; });
    this.container.querySelectorAll('.dl-rating').forEach(inp => {
      const v = parseFloat(inp.value);
      prof[inp.dataset.key + '_rating'] = isNaN(v) ? null : v;
    });
    const todayISO = new Date().toISOString().slice(0, 10);
    this.container.querySelectorAll('.dl-tog-sync').forEach(cb => {
      const k = cb.dataset.key + '_menu_synced_at';
      if (cb.checked) {
        if (!prof[k]) prof[k] = todayISO;
      } else {
        prof[k] = '';
      }
    });
    this.PLATFORMS.forEach(p => {
      const n = parseInt(document.getElementById('dl-' + p.key + '-photos')?.value);
      prof[p.key + '_photos'] = isNaN(n) ? null : n;
    });
    prof.delivery_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');

    // Auto-emit fix_log when a delivery gap just closed: any platform's menu
    // flipped from incomplete to complete, any platform's promo just went
    // live, or all active platforms now have menus synced for the first time.
    if (ok) {
      const closed = [];
      this.PLATFORMS.forEach(p => {
        if (prof[p.key + '_menu']  && !before[p.key + '_menu'])  closed.push(p.name + ' menu marked complete');
        if (prof[p.key + '_promo'] && !before[p.key + '_promo']) closed.push(p.name + ' promo went live');
        if (prof[p.key + '_menu_synced_at'] && !before[p.key + '_sync']) closed.push(p.name + ' menu synced to in-house');
      });
      const afterAllMenusComplete = this.PLATFORMS.every(p => prof[p.key + '_active'] === 'yes' ? prof[p.key + '_menu'] : true)
        && this.PLATFORMS.some(p => prof[p.key + '_active'] === 'yes' && prof[p.key + '_menu']);
      if (afterAllMenusComplete && !beforeAllMenusComplete) closed.push('All active delivery menus complete');
      if (closed.length) App.emitTrafficFix('delivery', closed.join('; '));
    }

    this.draw();
    const msg = document.getElementById('dl-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
