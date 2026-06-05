'use strict';
S.TrafficReviews = {
  // Review Reply Log — operator-typed per-reply detail. Closes the orphan
  // where audit asked "Unanswered Reviews" with no capture screen, and gives
  // the operator a place to track which reviews they replied to with what.
  // Each row is one logged reply: date, source, rating, reply snippet, action.
  // Lives under App.data.traffic_review_replies (separate from the operator-
  // typed monthly response_rate field on the weekly snapshot — log is the
  // detail, response_rate is the rolled number).
  SOURCES: ['Google', 'Yelp', 'TripAdvisor', 'Facebook', 'DoorDash', 'Uber Eats', 'Grubhub', 'Other'],
  ACTIONS: ['Replied publicly', 'Replied + offered comp', 'Replied + invited back', 'Reached out privately', 'Resolved in person', 'No action needed'],
  addingReply: false,
  editId: null,

  replies() {
    if (!Array.isArray(App.data.traffic_review_replies)) App.data.traffic_review_replies = [];
    return App.data.traffic_review_replies;
  },
  thisMonthReplies() {
    const ym = new Date().toISOString().slice(0, 7);
    return this.replies().filter(r => (r.date || '').slice(0, 7) === ym);
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
    const tGR   = ts.targets?.google_rating   || 4.3;
    const tRV   = ts.targets?.review_velocity || 8;
    const tRR   = ts.targets?.response_rate   || 75;
    const tYR   = 4.0;
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prev   = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    const trend = (cur, was, suffix) => {
      if (cur == null || was == null) return ' ';
      const diff = cur - was;
      if (Math.abs(diff) < 0.01) return 'No change vs last week';
      const amt = suffix === '★' ? Math.abs(diff).toFixed(1) : Math.round(Math.abs(diff)).toLocaleString();
      return (diff > 0 ? '↑ ' : '↓ ') + amt + (suffix || '') + ' vs last week';
    };
    const card = (label, val, targetStr, onTarget, trendStr) => {
      const valHtml = val == null
        ? '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>'
        : '<div class="metric-val ' + (onTarget == null ? '' : onTarget ? 'on-target' : 'over-target') + '">' + val + '</div>';
      return '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
        + '<div class="metric-target">' + targetStr + '</div>'
        + '<div class="metric-trend">' + (trendStr || ' ') + '</div></div>';
    };

    const gr = latest?.google_rating ?? null;
    const yr = latest?.yelp_rating ?? null;
    const nr = latest?.new_reviews ?? null;
    const rr = latest?.response_rate ?? null;

    const cards =
        card('Google Rating',   gr != null ? gr.toFixed(1) + '★' : null,  'Target: ' + tGR + '★',   gr != null ? gr >= tGR : null, trend(gr, prev?.google_rating, '★'))
      + card('Yelp Rating',     yr != null ? yr.toFixed(1) + '★' : null,  'Target: ' + tYR + '★',   yr != null ? yr >= tYR : null, trend(yr, prev?.yelp_rating, '★'))
      + card('Review Velocity', nr != null ? nr + '/mo' : null,           'Target: ' + tRV + '/mo', nr != null ? nr >= tRV : null, trend(nr, prev?.new_reviews, ''))
      + card('Response Rate',   rr != null ? Math.round(rr) + '%' : null, 'Target: ' + tRR + '%',   rr != null ? rr >= tRR : null, trend(rr, prev?.response_rate, '%'));

    // ── Trend charts ──
    const recent = weeks.slice(-8);
    const velChart = App.trendChart({
      title: 'Review Velocity: New Reviews per Month',
      target: tRV,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.new_reviews ?? null }))
    });
    const rrChart = App.trendChart({
      title: 'Response Rate Trend',
      target: tRR,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.response_rate ?? null }))
    });

    // ── Review monitoring inputs ──
    const age = prof.rev_age != null ? prof.rev_age : '';
    const inputsCard = '<div class="card">'
      + '<div class="card-title">Review Monitoring</div>'
      + reviewedNote(prof.rev_reviewed_at)
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;"><label>Most Recent Review Age ' + tt('t-review-age') + '</label><div class="fw"><input class="suf" type="number" id="rev-age" value="' + esc(String(age)) + '" min="0"/><span class="suf">days ago</span></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Negative Patterns Noted ' + tt('t-review-patterns') + '</label>'
      + '<textarea id="rev-patterns" rows="2" placeholder="Recurring complaints or themes across recent reviews: slow service, noise, a specific dish.">' + esc(prof.rev_patterns || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="rev-save">Save</button>'
      + '<span id="rev-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (gr != null && gr < tGR) tips.push('Google rating is ' + gr.toFixed(1) + '★, below the ' + tGR + '★ target. Ask happy guests for a review at the table or on the receipt.');
    if (yr != null && yr < tYR) tips.push('Yelp rating is ' + yr.toFixed(1) + '★, below the ' + tYR + '★ benchmark. Yelp runs lower than Google, but under 4.0 hurts.');
    if (nr != null && nr < tRV) tips.push('Only ' + nr + ' new reviews this month, below the ' + tRV + '/month target. A steady stream of fresh reviews matters more than the all-time count.');
    if (rr != null && rr < tRR) tips.push('Response rate is ' + Math.round(rr) + '%, below the ' + tRR + '% target. Reply to every review, positive and negative.');
    if (age !== '' && Number(age) > 14) tips.push('Most recent review is ' + age + ' days old. Reviews have gone quiet. Prompt guests this week.');
    if (prof.rev_patterns && prof.rev_patterns.trim()) tips.push('Negative pattern on file: "' + prof.rev_patterns.trim() + '". Fix the root cause, not just the reply.');
    if (!latest) tips.push('No weekly data yet. Enter a week in This Week to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Reviews Looking Good</div>'
        + '<div class="empty-sub">Ratings, velocity, and response rate are all on target. Keep replying to every review.</div></div></div>';

    const logCard = this.replyLogCard(tRV);

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + velChart + rrChart
      + inputsCard
      + logCard
      + tipsCard
      + '</div>';

    document.getElementById('rev-save')?.addEventListener('click', () => this.save());
    this.wireLog();
  },

  replyLogCard(tRV) {
    const monthReplies = this.thisMonthReplies();
    const all = this.replies().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = all.slice(0, 12);

    const ratingColor = (n) => n >= 4 ? 'var(--gold)' : n >= 3 ? 'var(--amber)' : 'var(--red)';
    const rows = recent.length ? recent.map(r => {
      const replySnippet = (r.reply || '').slice(0, 60) + ((r.reply || '').length > 60 ? '...' : '');
      return '<tr class="rrl-row" data-id="' + r.id + '" style="cursor:pointer;">'
        + '<td>' + esc(r.date || '') + '</td>'
        + '<td>' + esc(r.source || '-') + '</td>'
        + '<td><span style="color:' + ratingColor(r.rating) + ';font-weight:700;">' + (r.rating != null ? r.rating + '★' : '-') + '</span></td>'
        + '<td style="color:var(--t2);">' + esc(replySnippet || '-') + '</td>'
        + '<td>' + esc(r.action || '-') + '</td>'
        + '<td><div class="row-actions">'
        +   '<button class="btn btn-ghost btn-sm rrl-edit" data-id="' + r.id + '">Edit</button>'
        +   '<button class="btn btn-danger btn-sm rrl-del" data-id="' + r.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('') : '';

    const tableHtml = recent.length
      ? '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Source</th><th>Rating</th><th>Reply</th><th>Action</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (all.length > recent.length ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Showing 12 of ' + all.length + ' logged replies.</div>' : '')
      : '<div style="padding:14px 0;font-size:12px;color:var(--t3);line-height:1.55;">No replies logged yet. Log the first reply you wrote this week. The log doubles as your monthly count toward review velocity and gives you a record of what was offered to which guest.</div>';

    const form = this.addingReply ? this.replyForm() : '';
    const headerActions = this.addingReply
      ? ''
      : '<button class="btn btn-ghost btn-sm" id="rrl-print">Worksheet</button>'
        + '<button class="btn btn-primary btn-sm" id="rrl-add">+ Log Reply</button>';

    return '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
      +   '<div class="card-title" style="margin-bottom:0;">Review Reply Log</div>'
      +   '<div style="display:flex;gap:8px;">' + headerActions + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">' + monthReplies.length + ' replies logged this month'
      +   (tRV ? ' (review velocity target ' + tRV + '/mo)' : '') + '.</div>'
      + form
      + tableHtml
      + '</div>';
  },

  replyForm() {
    const r = this.editId ? this.replies().find(x => x.id === this.editId) : null;
    const today = App.todayLocal();
    const sourceOpts = this.SOURCES.map(s =>
      '<option' + (r && r.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const actionOpts = '<option value="">-</option>' + this.ACTIONS.map(a =>
      '<option' + (r && r.action === a ? ' selected' : '') + '>' + esc(a) + '</option>').join('');
    return '<div style="background:var(--input);border:1px solid var(--b1);border-radius:6px;padding:14px;margin-bottom:14px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t3);text-transform:uppercase;margin-bottom:10px;">' + (this.editId ? 'Edit Reply' : 'Log a Review Reply') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;"><label>Date</label><input type="date" id="rrl-date" value="' + esc(r?.date || today) + '"/></div>'
      +   '<div class="f" style="width:140px;"><label>Source</label><select id="rrl-source">' + sourceOpts + '</select></div>'
      +   '<div class="f" style="width:110px;"><label>Rating</label><div class="fw"><input class="suf" type="number" id="rrl-rating" value="' + (r?.rating != null ? r.rating : '') + '" min="1" max="5" step="1"/><span class="suf">★</span></div></div>'
      +   '<div class="f" style="width:220px;"><label>Action Taken</label><select id="rrl-action">' + actionOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:0;"><label>Reply (paste or summarize)</label>'
      +   '<textarea id="rrl-reply" rows="3" placeholder="The reply you wrote, or a summary if it was long.">' + esc(r?.reply || '') + '</textarea></div>'
      + '<div class="card-actions" style="margin-top:12px;">'
      +   '<button class="btn btn-primary btn-sm" id="rrl-save">' + (this.editId ? 'Update' : 'Save Reply') + '</button>'
      +   '<button class="btn btn-ghost btn-sm" id="rrl-cancel">Cancel</button>'
      +   '<span id="rrl-err" style="color:var(--red);font-size:11px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  wireLog() {
    const addBtn = document.getElementById('rrl-add');
    if (addBtn) addBtn.addEventListener('click', () => { this.addingReply = true; this.editId = null; this.draw(); });
    const printBtn = document.getElementById('rrl-print');
    if (printBtn) printBtn.addEventListener('click', () => this.printBlankSheet());
    const saveBtn = document.getElementById('rrl-save');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveReply());
    const cancelBtn = document.getElementById('rrl-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { this.addingReply = false; this.editId = null; this.draw(); });
    this.container.querySelectorAll('.rrl-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.rrl-edit') || e.target.closest('.rrl-del')) return;
        this.addingReply = true; this.editId = row.dataset.id; this.draw();
      });
    });
    this.container.querySelectorAll('.rrl-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.addingReply = true; this.editId = btn.dataset.id; this.draw(); });
    });
    this.container.querySelectorAll('.rrl-del').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!(await App.confirmDelete())) return;
        await App.removeRecord('core', 'traffic_review_reply', btn.dataset.id);
        this.draw();
      });
    });
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Review Reply Log',
      subtitle: 'Capture reviews and replies during the week; type into Bar Cop after.',
      columns: [
        { label: 'Date',    width: '90px'  },
        { label: 'Source',  width: '100px' },
        { label: 'Rating',  width: '70px'  },
        { label: 'Reply (short)' },
        { label: 'Action Taken', width: '180px' }
      ],
      rows: 15
    });
  },

  async saveReply() {
    const err = document.getElementById('rrl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date   = document.getElementById('rrl-date')?.value;
    const source = document.getElementById('rrl-source')?.value;
    const rating = parseInt(document.getElementById('rrl-rating')?.value);
    const reply  = document.getElementById('rrl-reply')?.value.trim() || '';
    const action = document.getElementById('rrl-action')?.value || '';
    if (!date)             { fail('Date is required.'); return; }
    if (!source)           { fail('Pick a source.'); return; }
    if (isNaN(rating) || rating < 1 || rating > 5) { fail('Rating must be 1 to 5.'); return; }

    const beforeMonthCount = this.thisMonthReplies().length;
    const rec = {
      id: this.editId || App.uid(),
      date, source, rating, reply, action,
      saved_at: new Date().toISOString()
    };
    const list = this.replies();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    }
    const ok = await App.putRecord('core', 'traffic_review_reply', saved);
    if (ok) {
      const tRV = (App.data.traffic_settings?.targets?.review_velocity) || 8;
      const afterMonthCount = this.thisMonthReplies().length;
      if (afterMonthCount >= tRV && beforeMonthCount < tRV) {
        await App.emitTrafficFix('reviews', 'Logged ' + afterMonthCount + ' review replies this month (target ' + tRV + ')');
      }
      this.addingReply = false;
      this.editId = null;
      this.draw();
    } else {
      fail('Save failed. Try again.');
    }
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    const age = parseInt(document.getElementById('rev-age')?.value);
    prof.rev_age = isNaN(age) ? null : age;
    prof.rev_patterns = document.getElementById('rev-patterns')?.value || '';
    prof.rev_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    if (ok) App.markSetupDone('gs_t_reviews');
    this.draw();
    const msg = document.getElementById('rev-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
