'use strict';
S.TrafficSocial = {
  CONTENT_MIX: ['Balanced', 'Mostly promotional', 'Mostly reposts', 'Too few food photos'],
  ENGAGEMENT_BENCHMARK: 2,

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const tSP   = ts.targets?.social_posts_month || 12;
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prev   = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    const trend = (cur, was) => {
      if (cur == null || was == null) return ' ';
      const diff = cur - was;
      if (Math.abs(diff) < 0.01) return 'No change vs last week';
      return (diff > 0 ? '↑ ' : '↓ ') + Math.round(Math.abs(diff)).toLocaleString() + ' vs last week';
    };
    const card = (label, valHtml, targetStr, trendStr) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + targetStr + '</div>'
      + '<div class="metric-trend">' + (trendStr || ' ') + '</div></div>';
    const onTargetVal = (val, ok) => '<div class="metric-val ' + (ok == null ? '' : ok ? 'on-target' : 'over-target') + '">' + val + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const igf = latest?.ig_followers ?? null;
    const igp = latest?.ig_posts_month ?? null;
    const fbf = latest?.fb_followers ?? null;
    const eng = prof.social_ig_engagement != null ? prof.social_ig_engagement : null;

    const cards =
        card('Instagram Followers', igf != null ? onTargetVal(igf.toLocaleString(), null) : noData, 'Grow week over week', trend(igf, prev?.ig_followers))
      + card('IG Posts/Mo',         igp != null ? onTargetVal(String(igp), igp >= tSP) : noData, 'Target: ' + tSP + '/mo', trend(igp, prev?.ig_posts_month))
      + card('IG Engagement Rate',  eng != null ? onTargetVal(eng.toFixed(1) + '%', eng >= this.ENGAGEMENT_BENCHMARK) : noData, 'Benchmark: ' + this.ENGAGEMENT_BENCHMARK + '%+', ' ')
      + card('Facebook Followers',  fbf != null ? onTargetVal(fbf.toLocaleString(), null) : noData, 'Grow week over week', trend(fbf, prev?.fb_followers));

    const recent = weeks.slice(-8);
    const followerChart = App.trendChart({
      title: 'Instagram Follower Growth',
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.ig_followers ?? null }))
    });
    const postsChart = App.trendChart({
      title: 'Instagram Posts per Month', target: tSP,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.ig_posts_month ?? null }))
    });

    // ── Social detail inputs ──
    const mixOpts = '<option value="">—</option>' + this.CONTENT_MIX.map(m =>
      '<option' + (prof.social_content_mix === m ? ' selected' : '') + '>' + m + '</option>').join('');
    const toggle = (k, label) =>
      '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="soc-tog" data-key="' + k + '"' + (prof[k] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>' + label + '</label>';

    const formCard = '<div class="card">'
      + '<div class="card-title">Social Detail</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:170px;"><label>IG Engagement Rate</label><div class="fw"><input class="suf" type="number" id="soc-eng" value="' + (eng != null ? eng : '') + '" step="0.1" min="0"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:170px;"><label>FB Posts This Month</label><input type="number" id="soc-fbp" value="' + (prof.social_fb_posts != null ? prof.social_fb_posts : '') + '" min="0"/></div>'
      + '<div class="f" style="width:200px;"><label>Content Mix</label><select id="soc-mix">' + mixOpts + '</select></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:16px;">'
      + toggle('social_stories', 'Instagram Stories used regularly')
      + toggle('social_reels',   'Reels posted this month')
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="soc-save">Save Social Detail</button>'
      + '<span id="soc-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (igp != null && igp < tSP) tips.push('Instagram posts are ' + igp + ' this month, below the ' + tSP + '/month target. A consistent cadence keeps the account in front of followers.');
    if (eng != null && eng < this.ENGAGEMENT_BENCHMARK) tips.push('IG engagement rate is ' + eng.toFixed(1) + '%, below the ' + this.ENGAGEMENT_BENCHMARK + '% benchmark. Followers are not interacting — try food close-ups, staff, and behind-the-scenes content.');
    if (eng == null) tips.push('Enter your IG engagement rate above to score this section.');
    if (prof.social_fb_posts != null && prof.social_fb_posts < tSP) tips.push('Facebook posts are ' + prof.social_fb_posts + ' this month. Cross-post to keep the Facebook audience warm.');
    if (!prof.social_stories) tips.push('Instagram Stories are not used regularly. Stories reach followers who never see grid posts.');
    if (!prof.social_reels) tips.push('No Reels posted this month. Reels get the most reach of any Instagram format right now.');
    if (prof.social_content_mix && prof.social_content_mix !== 'Balanced') tips.push('Content mix is "' + prof.social_content_mix + '". Aim for a balanced mix — food, people, and the room, not just promotions.');
    if (!latest) tips.push('No weekly data yet. Enter a week in This Week to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Social Is Active</div>'
        + '<div class="empty-sub">Posting cadence, engagement, and content mix are all on track. Keep it consistent.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + followerChart + postsChart
      + formCard
      + tipsCard
      + '</div>';

    document.getElementById('soc-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    this.container.querySelectorAll('.soc-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    const eng = parseFloat(document.getElementById('soc-eng')?.value);
    const fbp = parseInt(document.getElementById('soc-fbp')?.value);
    prof.social_ig_engagement = isNaN(eng) ? null : eng;
    prof.social_fb_posts = isNaN(fbp) ? null : fbp;
    prof.social_content_mix = document.getElementById('soc-mix')?.value || '';
    const ok = await App.saveKey('traffic_settings');
    this.draw();
    const msg = document.getElementById('soc-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
