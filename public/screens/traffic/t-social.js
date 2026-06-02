'use strict';
S.TrafficSocial = {
  // Drives off canonical App enums so content-mix options + engagement
  // benchmark stay in sync across Traffic.
  get CONTENT_MIX() { return App.TRAFFIC_SOCIAL_CONTENT_MIX; },
  get ENGAGEMENT_BENCHMARK() { return App.TRAFFIC_BENCHMARKS.engagement_rate; },

  // Social Post Log — per-post detail across platforms. Replaces the typed
  // IG Posts/Mo integer with a real count when at least one post is logged
  // this month. Drives the social_posts_month target with real data.
  PLATFORMS:     ['Instagram', 'Facebook', 'TikTok', 'X', 'Threads'],
  CONTENT_TYPES: ['Food/Drink', 'Event/Promo', 'Behind-Scenes', 'Staff/Guest', 'Reel/Video', 'Story'],
  addingPost: false,
  editId: null,

  socialPosts() {
    if (!Array.isArray(App.data.traffic_social_posts)) App.data.traffic_social_posts = [];
    return App.data.traffic_social_posts;
  },
  thisMonthSocialPosts() {
    const ym = new Date().toISOString().slice(0, 7);
    return this.socialPosts().filter(p => (p.date || '').slice(0, 7) === ym);
  },

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
    const fbf = latest?.fb_followers ?? null;
    const eng = prof.social_ig_engagement != null ? prof.social_ig_engagement : null;
    // IG Posts/Mo prefers a logged count (filtering Social Post Log to IG +
    // current month) over the typed weekly figure when the log has entries.
    const monthIgLog = this.thisMonthSocialPosts().filter(p => p.platform === 'Instagram').length;
    const igp = monthIgLog > 0 ? monthIgLog : (latest?.ig_posts_month ?? null);

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
    const mixOpts = '<option value="">-</option>' + this.CONTENT_MIX.map(m =>
      '<option' + (prof.social_content_mix === m ? ' selected' : '') + '>' + m + '</option>').join('');
    const toggle = (k, label) =>
      '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="soc-tog" data-key="' + k + '"' + (prof[k] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>' + label + '</label>';

    const formCard = '<div class="card">'
      + '<div class="card-title">Social Detail</div>'
      + reviewedNote(prof.social_reviewed_at)
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:170px;"><label>IG Engagement Rate ' + tt('t-social-engagement') + '</label><div class="fw"><input class="suf" type="number" id="soc-eng" value="' + (eng != null ? eng : '') + '" step="0.1" min="0"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:170px;"><label>FB Posts/Mo ' + tt('t-social-fbposts') + '</label><input type="number" id="soc-fbp" value="' + (prof.social_fb_posts != null ? prof.social_fb_posts : '') + '" min="0"/></div>'
      + '<div class="f" style="width:200px;"><label>Content Mix ' + tt('t-social-mix') + '</label><select id="soc-mix">' + mixOpts + '</select></div>'
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
    if (igp != null && igp < tSP) tips.push('Instagram posts are ' + igp + ' this month, below the ' + tSP + '/month target. A consistent posting schedule keeps the account in front of followers.');
    if (eng != null && eng < this.ENGAGEMENT_BENCHMARK) tips.push('IG engagement rate is ' + eng.toFixed(1) + '%, below the ' + this.ENGAGEMENT_BENCHMARK + '% benchmark. Followers are not interacting. Try food close-ups, staff, and behind-the-scenes content.');
    if (eng == null) tips.push('Enter your IG engagement rate above to score this section.');
    if (prof.social_fb_posts != null && prof.social_fb_posts < tSP) tips.push('Facebook posts are ' + prof.social_fb_posts + ' this month. Cross-post to keep the Facebook audience warm.');
    if (!prof.social_stories) tips.push('Instagram Stories are not used regularly. Stories reach followers who never see grid posts.');
    if (!prof.social_reels) tips.push('No Reels posted this month. Reels get the most reach of any Instagram format right now.');
    if (prof.social_content_mix && prof.social_content_mix !== 'Balanced') tips.push('Content mix is "' + prof.social_content_mix + '". Aim for a balanced mix: food, people, and the room, not just promotions.');
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
        + '<div class="empty-sub">Posting schedule, engagement, and content mix are all on track. Keep it consistent.</div></div></div>';

    const logCard = this.postLogCard(tSP);

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + followerChart + postsChart
      + formCard
      + logCard
      + tipsCard
      + '</div>';

    document.getElementById('soc-save')?.addEventListener('click', () => this.save());
    this.wireLog();
  },

  postLogCard(tSP) {
    const all = this.socialPosts().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = all.slice(0, 12);
    const monthCount = this.thisMonthSocialPosts().length;

    const rows = recent.length ? recent.map(p => {
      const capSnippet = (p.caption || '').slice(0, 60) + ((p.caption || '').length > 60 ? '...' : '');
      const linkHtml = p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">Open</a>' : '<span style="color:var(--t4);">-</span>';
      return '<tr class="spl-row" data-id="' + p.id + '" style="cursor:pointer;">'
        + '<td>' + esc(p.date || '') + '</td>'
        + '<td>' + esc(p.platform || '-') + '</td>'
        + '<td>' + esc(p.content_type || '-') + '</td>'
        + '<td style="color:var(--t2);">' + esc(capSnippet || '-') + '</td>'
        + '<td>' + linkHtml + '</td>'
        + '<td><div class="row-actions">'
        +   '<button class="btn btn-ghost btn-sm spl-edit" data-id="' + p.id + '">Edit</button>'
        +   '<button class="btn btn-danger btn-sm spl-del" data-id="' + p.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('') : '';

    const tableHtml = recent.length
      ? '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Platform</th><th>Type</th><th>Caption</th><th>Link</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (all.length > recent.length ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Showing 12 of ' + all.length + ' logged posts.</div>' : '')
      : '<div style="padding:14px 0;font-size:12px;color:var(--t3);line-height:1.55;">No social posts logged yet. Log a post when you publish one. The log replaces the typed weekly post count with a real count and gives you a record of what was posted, where.</div>';

    const form = this.addingPost ? this.postForm() : '';
    const headerActions = this.addingPost
      ? ''
      : '<button class="btn btn-ghost btn-sm" id="spl-print">Worksheet</button>'
        + '<button class="btn btn-primary btn-sm" id="spl-add">+ Log Post</button>';

    return '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
      +   '<div class="card-title" style="margin-bottom:0;">Social Post Log</div>'
      +   '<div style="display:flex;gap:8px;">' + headerActions + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">' + monthCount + ' posts logged this month (target ' + tSP + '/mo across platforms).</div>'
      + form
      + tableHtml
      + '</div>';
  },

  postForm() {
    const p = this.editId ? this.socialPosts().find(x => x.id === this.editId) : null;
    const today = new Date().toISOString().slice(0, 10);
    const platOpts = this.PLATFORMS.map(pl =>
      '<option' + (p && p.platform === pl ? ' selected' : '') + '>' + esc(pl) + '</option>').join('');
    const typeOpts = '<option value="">-</option>' + this.CONTENT_TYPES.map(c =>
      '<option' + (p && p.content_type === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    return '<div style="background:var(--input);border:1px solid var(--b1);border-radius:6px;padding:14px;margin-bottom:14px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t3);text-transform:uppercase;margin-bottom:10px;">' + (this.editId ? 'Edit Post' : 'Log a Social Post') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;"><label>Date</label><input type="date" id="spl-date" value="' + esc(p?.date || today) + '"/></div>'
      +   '<div class="f" style="width:140px;"><label>Platform</label><select id="spl-platform">' + platOpts + '</select></div>'
      +   '<div class="f" style="width:170px;"><label>Content Type</label><select id="spl-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:10px;"><label>Caption (snippet)</label>'
      +   '<input type="text" id="spl-caption" value="' + esc(p?.caption || '') + '" placeholder="First few words of the post"/></div>'
      + '<div class="f" style="margin-bottom:0;"><label>Link (optional)</label>'
      +   '<input type="url" id="spl-link" value="' + esc(p?.link || '') + '" placeholder="https://instagram.com/p/..."/></div>'
      + '<div class="card-actions" style="margin-top:12px;">'
      +   '<button class="btn btn-primary btn-sm" id="spl-save">' + (this.editId ? 'Update' : 'Save Post') + '</button>'
      +   '<button class="btn btn-ghost btn-sm" id="spl-cancel">Cancel</button>'
      +   '<span id="spl-err" style="color:var(--red);font-size:11px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  wireLog() {
    const addBtn = document.getElementById('spl-add');
    if (addBtn) addBtn.addEventListener('click', () => { this.addingPost = true; this.editId = null; this.draw(); });
    const printBtn = document.getElementById('spl-print');
    if (printBtn) printBtn.addEventListener('click', () => this.printBlankSheet());
    const saveBtn = document.getElementById('spl-save');
    if (saveBtn) saveBtn.addEventListener('click', () => this.savePost());
    const cancelBtn = document.getElementById('spl-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { this.addingPost = false; this.editId = null; this.draw(); });
    this.container.querySelectorAll('.spl-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.spl-edit') || e.target.closest('.spl-del') || e.target.tagName === 'A') return;
        this.addingPost = true; this.editId = row.dataset.id; this.draw();
      });
    });
    this.container.querySelectorAll('.spl-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.addingPost = true; this.editId = btn.dataset.id; this.draw(); });
    });
    this.container.querySelectorAll('.spl-del').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!(await App.confirm({ title: 'Delete this social post entry?', confirmText: 'Delete' }))) return;
        await App.removeRecord('core', 'traffic_social_post', btn.dataset.id);
        this.draw();
      });
    });
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Social Post Log',
      subtitle: 'Capture each social post during the week; type into Bar Cop after.',
      columns: [
        { label: 'Date',     width: '90px'  },
        { label: 'Platform', width: '100px' },
        { label: 'Type',     width: '110px' },
        { label: 'Caption (snippet)' },
        { label: 'Link',     width: '160px' }
      ],
      rows: 15
    });
  },

  async savePost() {
    const err = document.getElementById('spl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date     = document.getElementById('spl-date')?.value;
    const platform = document.getElementById('spl-platform')?.value;
    const type     = document.getElementById('spl-type')?.value || '';
    const caption  = document.getElementById('spl-caption')?.value.trim() || '';
    const link     = document.getElementById('spl-link')?.value.trim() || '';
    if (!date)     { fail('Date is required.'); return; }
    if (!platform) { fail('Pick a platform.'); return; }

    const tSP = (App.data.traffic_settings?.targets?.social_posts_month) || 12;
    const beforeMonthCount = this.thisMonthSocialPosts().length;
    const rec = {
      id: this.editId || App.uid(),
      date, platform, content_type: type, caption, link,
      saved_at: new Date().toISOString()
    };
    const list = this.socialPosts();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    }
    const ok = await App.putRecord('core', 'traffic_social_post', saved);
    if (ok) {
      const afterMonthCount = this.thisMonthSocialPosts().length;
      if (afterMonthCount >= tSP && beforeMonthCount < tSP) {
        await App.emitTrafficFix('social', 'Logged ' + afterMonthCount + ' social posts this month (target ' + tSP + ')');
      }
      this.addingPost = false;
      this.editId = null;
      this.draw();
    } else {
      fail('Save failed. Try again.');
    }
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    const beforeEng     = prof.social_ig_engagement != null ? prof.social_ig_engagement : null;
    const beforeStories = !!prof.social_stories;
    const beforeReels   = !!prof.social_reels;
    this.container.querySelectorAll('.soc-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    const eng = parseFloat(document.getElementById('soc-eng')?.value);
    const fbp = parseInt(document.getElementById('soc-fbp')?.value);
    prof.social_ig_engagement = isNaN(eng) ? null : eng;
    prof.social_fb_posts = isNaN(fbp) ? null : fbp;
    prof.social_content_mix = document.getElementById('soc-mix')?.value || '';
    prof.social_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    if (ok) {
      if (prof.social_ig_engagement != null && prof.social_ig_engagement >= this.ENGAGEMENT_BENCHMARK
          && (beforeEng == null || beforeEng < this.ENGAGEMENT_BENCHMARK)) {
        await App.emitTrafficFix('social', 'Instagram engagement rate hit ' + prof.social_ig_engagement.toFixed(1) + '% (benchmark ' + this.ENGAGEMENT_BENCHMARK + '%)');
      }
      if (prof.social_stories && !beforeStories) {
        await App.emitTrafficFix('social', 'Instagram Stories now in regular use');
      }
      if (prof.social_reels && !beforeReels) {
        await App.emitTrafficFix('social', 'Instagram Reels posted this month');
      }
    }
    this.draw();
    const msg = document.getElementById('soc-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
