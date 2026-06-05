'use strict';
S.TrafficGBP = {
  // Toggle list drives off App.TRAFFIC_GBP_TOGGLES so the checklist stays in
  // sync with t-audit and any future screen that needs to read it.
  get TOGGLES() { return App.TRAFFIC_GBP_TOGGLES; },

  // GBP Post Log — per-post detail (date, type, headline, link, cross-posted).
  // Drives the gbp_posts/mo count instead of operator typing the integer.
  // The Posts/Mo input on the profile form stays as a manual override for
  // operators who haven't started logging yet; logged count takes precedence
  // when there's at least one entry in the current month.
  POST_TYPES: ['Offer', 'Event', 'Update'],
  addingPost: false,
  editId: null,

  posts() {
    if (!Array.isArray(App.data.traffic_gbp_posts)) App.data.traffic_gbp_posts = [];
    return App.data.traffic_gbp_posts;
  },
  thisMonthPosts() {
    const ym = new Date().toISOString().slice(0, 7);
    return this.posts().filter(p => (p.date || '').slice(0, 7) === ym);
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
    const tGR   = ts.targets?.google_rating || 4.3;
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;

    const checked    = this.TOGGLES.filter(([k]) => prof[k]).length;
    const completion = Math.round(checked / this.TOGGLES.length * 100);
    const photos = prof.gbp_photos != null ? prof.gbp_photos : null;
    // Posts/Mo prefers the logged count when the log has any entry this month;
    // falls back to the operator-typed integer field on the profile form.
    const monthLogPosts = this.thisMonthPosts().length;
    const posts = monthLogPosts > 0 ? monthLogPosts : (prof.gbp_posts != null ? prof.gbp_posts : null);
    const postsSource = monthLogPosts > 0 ? 'logged' : 'typed';
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

    const logCard = this.postLogCard();

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + profileCard
      + logCard
      + tipsCard
      + '</div>';

    document.getElementById('gbp-save')?.addEventListener('click', () => this.save());
    this.wireLog();
  },

  postLogCard() {
    const all = this.posts().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = all.slice(0, 12);
    const monthCount = this.thisMonthPosts().length;

    const rows = recent.length ? recent.map(p => {
      const headSnippet = (p.headline || '').slice(0, 70) + ((p.headline || '').length > 70 ? '...' : '');
      const linkHtml = p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">Open</a>' : '<span style="color:var(--t4);">-</span>';
      return '<tr class="gpl-row" data-id="' + p.id + '" style="cursor:pointer;">'
        + '<td>' + esc(p.date || '') + '</td>'
        + '<td>' + esc(p.type || '-') + '</td>'
        + '<td style="color:var(--t2);">' + esc(headSnippet || '-') + '</td>'
        + '<td>' + linkHtml + '</td>'
        + '<td>' + (p.cross_posted ? 'Yes' : 'No') + '</td>'
        + '<td><div class="row-actions">'
        +   '<button class="btn btn-ghost btn-sm gpl-edit" data-id="' + p.id + '">Edit</button>'
        +   '<button class="btn btn-danger btn-sm gpl-del" data-id="' + p.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('') : '';

    const tableHtml = recent.length
      ? '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Headline</th><th>Link</th><th>Cross-Posted</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (all.length > recent.length ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Showing 12 of ' + all.length + ' logged posts.</div>' : '')
      : '<div style="padding:14px 0;font-size:12px;color:var(--t3);line-height:1.55;">No GBP posts logged yet. Log a post when you publish one to Google. The log replaces the typed Posts/Mo number above with a real count, and gives you a record of what was posted, when.</div>';

    const form = this.addingPost ? this.postForm() : '';
    const headerActions = this.addingPost
      ? ''
      : '<button class="btn btn-ghost btn-sm" id="gpl-print">Worksheet</button>'
        + '<button class="btn btn-primary btn-sm" id="gpl-add">+ Log Post</button>';

    return '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
      +   '<div class="card-title" style="margin-bottom:0;">GBP Post Log</div>'
      +   '<div style="display:flex;gap:8px;">' + headerActions + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">' + monthCount + ' posts logged this month (benchmark 8/mo).</div>'
      + form
      + tableHtml
      + '</div>';
  },

  postForm() {
    const p = this.editId ? this.posts().find(x => x.id === this.editId) : null;
    const today = App.todayLocal();
    const typeOpts = this.POST_TYPES.map(t =>
      '<option' + (p && p.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    return '<div style="background:var(--input);border:1px solid var(--b1);border-radius:6px;padding:14px;margin-bottom:14px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t3);text-transform:uppercase;margin-bottom:10px;">' + (this.editId ? 'Edit Post' : 'Log a GBP Post') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;"><label>Date</label><input type="date" id="gpl-date" value="' + esc(p?.date || today) + '"/></div>'
      +   '<div class="f" style="width:140px;"><label>Type</label><select id="gpl-type">' + typeOpts + '</select></div>'
      +   '<div class="f" style="flex:1;min-width:240px;"><label>Headline</label><input type="text" id="gpl-headline" value="' + esc(p?.headline || '') + '" placeholder="Sunday brunch live music starts 11am"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:end;">'
      +   '<div class="f" style="flex:1;min-width:240px;"><label>Link (optional)</label><input type="url" id="gpl-link" value="' + esc(p?.link || '') + '" placeholder="https://..."/></div>'
      +   '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding-bottom:9px;">'
      +     '<input type="checkbox" id="gpl-cross" ' + (p?.cross_posted ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Cross-posted to Instagram or Facebook</label>'
      + '</div>'
      + '<div class="card-actions" style="margin-top:12px;">'
      +   '<button class="btn btn-primary btn-sm" id="gpl-save">' + (this.editId ? 'Update' : 'Save Post') + '</button>'
      +   '<button class="btn btn-ghost btn-sm" id="gpl-cancel">Cancel</button>'
      +   '<span id="gpl-err" style="color:var(--red);font-size:11px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  wireLog() {
    const addBtn = document.getElementById('gpl-add');
    if (addBtn) addBtn.addEventListener('click', () => { this.addingPost = true; this.editId = null; this.draw(); });
    const printBtn = document.getElementById('gpl-print');
    if (printBtn) printBtn.addEventListener('click', () => this.printBlankSheet());
    const saveBtn = document.getElementById('gpl-save');
    if (saveBtn) saveBtn.addEventListener('click', () => this.savePost());
    const cancelBtn = document.getElementById('gpl-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { this.addingPost = false; this.editId = null; this.draw(); });
    this.container.querySelectorAll('.gpl-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.gpl-edit') || e.target.closest('.gpl-del') || e.target.tagName === 'A') return;
        this.addingPost = true; this.editId = row.dataset.id; this.draw();
      });
    });
    this.container.querySelectorAll('.gpl-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.addingPost = true; this.editId = btn.dataset.id; this.draw(); });
    });
    this.container.querySelectorAll('.gpl-del').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!(await App.confirmDelete())) return;
        await App.removeRecord('core', 'traffic_gbp_post', btn.dataset.id);
        this.draw();
      });
    });
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'GBP Post Log',
      subtitle: 'Capture each Google post during the week; type into Bar Cop after.',
      columns: [
        { label: 'Date',     width: '90px'  },
        { label: 'Type',     width: '90px'  },
        { label: 'Headline' },
        { label: 'Link',     width: '160px' },
        { label: 'Cross-Posted?', width: '110px' }
      ],
      rows: 12
    });
  },

  async savePost() {
    const err = document.getElementById('gpl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date     = document.getElementById('gpl-date')?.value;
    const type     = document.getElementById('gpl-type')?.value;
    const headline = document.getElementById('gpl-headline')?.value.trim() || '';
    const link     = document.getElementById('gpl-link')?.value.trim() || '';
    const cross    = document.getElementById('gpl-cross')?.checked || false;
    if (!date)     { fail('Date is required.'); return; }
    if (!type)     { fail('Pick a post type.'); return; }
    if (!headline) { fail('Headline is required.'); return; }

    const beforeMonthCount = this.thisMonthPosts().length;
    const rec = {
      id: this.editId || App.uid(),
      date, type, headline, link, cross_posted: cross,
      saved_at: new Date().toISOString()
    };
    const list = this.posts();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    }
    const ok = await App.putRecord('core', 'traffic_gbp_post', saved);
    if (ok) {
      const afterMonthCount = this.thisMonthPosts().length;
      if (afterMonthCount >= 8 && beforeMonthCount < 8) {
        await App.emitTrafficFix('gbp', 'Logged ' + afterMonthCount + ' GBP posts this month (benchmark 8)');
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
    // Snapshot pre-save threshold-relevant state so a just-closed gap
    // (completeness now 100%, or posts/mo target just crossed) can credit
    // the Recovery Scoreboard.
    const beforeChecked = this.TOGGLES.filter(([k]) => prof[k]).length;
    const beforePosts   = prof.gbp_posts != null ? prof.gbp_posts : null;
    this.container.querySelectorAll('.gbp-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    const photos = parseInt(document.getElementById('gbp-photos')?.value);
    const posts  = parseInt(document.getElementById('gbp-posts')?.value);
    prof.gbp_photos = isNaN(photos) ? null : photos;
    prof.gbp_posts  = isNaN(posts)  ? null : posts;
    prof.gbp_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    if (ok) {
      App.markSetupDone('gs_t_gbp');
      const afterChecked = this.TOGGLES.filter(([k]) => prof[k]).length;
      if (afterChecked === this.TOGGLES.length && beforeChecked < this.TOGGLES.length) {
        await App.emitTrafficFix('gbp', 'Google Business Profile checklist 100% complete');
      }
      if (prof.gbp_posts != null && prof.gbp_posts >= 8 && (beforePosts == null || beforePosts < 8)) {
        await App.emitTrafficFix('gbp', 'GBP posts hit ' + prof.gbp_posts + '/mo (benchmark 8/mo)');
      }
    }
    this.draw();
    const msg = document.getElementById('gbp-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
