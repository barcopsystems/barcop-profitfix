'use strict';
S.TrafficGettingStarted = {
  TASKS: [
    { week:1, id:'tgs_targets',  label:'Set your traffic targets on the Dashboard. Google rating goal, review velocity, response rate, and monthly sessions are pre-filled with industry benchmarks.', screen:'t-dashboard' },
    { week:1, id:'tgs_gbp',      label:'Complete the Google Business Profile audit in the GBP section. Confirm your listing is claimed, hours are current, and your menu link is active.', screen:'t-gbp' },
    { week:1, id:'tgs_website',  label:'Run the Website Scorecard. Check mobile optimization, page load speed, and whether your menu page appears in the top navigation.', screen:'t-website' },
    { week:1, id:'tgs_reviews',  label:'Log your current Google and Yelp ratings and review counts in Review Tracker. This is your baseline before any recovery work begins.', screen:'t-reviews' },
    { week:2, id:'tgs_week1',    label:'Enter your first week of digital metrics in This Week. Google rating, new reviews, response rate, and any sessions data you have.', screen:'t-this-week' },
    { week:2, id:'tgs_search',   label:'Complete the Search and SEO section. Confirm your NAP consistency and identify your primary local search keyword.', screen:'t-search' },
    { week:2, id:'tgs_social',   label:'Log your social media baseline in Social Media. Instagram followers, post frequency, and Facebook page status.', screen:'t-social' },
    { week:2, id:'tgs_respond',  label:'Respond to every unanswered Google review — positive and negative. Set a goal to respond within 48 hours going forward.', screen:'t-reviews' },
    { week:3, id:'tgs_delivery', label:'Audit your delivery platform presence in Delivery Platforms. Confirm photos, menu completeness, and rating on each active platform.', screen:'t-delivery' },
    { week:3, id:'tgs_email',    label:'Log your email list status in Email and Loyalty. List size, last send date, and current open rate if available.', screen:'t-email' },
    { week:3, id:'tgs_week2',    label:'Enter Week 2 data in This Week.', screen:'t-this-week' },
    { week:3, id:'tgs_content',  label:'Post at least 3 times on Instagram this week. One menu item photo, one behind-the-scenes, one event or promotion.', screen:'t-social' },
    { week:4, id:'tgs_week3',    label:'Enter Week 3 data in This Week.', screen:'t-this-week' },
    { week:4, id:'tgs_trend',    label:'Review the 3-week trend on your Dashboard. Check whether your Google rating is moving and whether review velocity is on target.', screen:'t-dashboard' },
    { week:4, id:'tgs_audit',    label:'Generate your first Traffic Audit. Upload any GBP screenshots, website analytics, and social media reports you have available.', screen:'t-audit' },
    { week:4, id:'tgs_routine',  label:'Set a recurring weekly reminder to enter This Week data. Consistency is what makes the system work.', screen:'t-this-week' },
  ],

  getProgress() { return App.data.getting_started_traffic || {}; },
  saveProgress(p) { App.data.getting_started_traffic = p; return App.saveKey('getting_started_traffic'); },

  render(container) {
    const progress = this.getProgress();
    const weeks = [1,2,3,4];
    const weekLabels = { 1:'Week 1 — Foundation', 2:'Week 2 — Baseline and Gaps', 3:'Week 3 — Platform Audit', 4:'Week 4 — Full System Running' };
    const total = this.TASKS.length;
    const done  = this.TASKS.filter(t => progress[t.id]).length;
    const pct   = Math.round(done / total * 100);

    const sections = weeks.map(w => {
      const tasks = this.TASKS.filter(t => t.week === w);
      const wDone = tasks.filter(t => progress[t.id]).length;
      const wPct  = Math.round(wDone / tasks.length * 100);
      const rows  = tasks.map(t => {
        const d = !!progress[t.id];
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);">
          <input type="checkbox" class="tgs-chk" data-id="${t.id}" data-screen="${t.screen}" ${d?'checked':''} style="margin-top:2px;flex-shrink:0;accent-color:var(--gold);width:16px;height:16px;cursor:pointer;"/>
          <div style="flex:1;font-size:12px;color:${d?'var(--t3)':'var(--t1)'};${d?'text-decoration:line-through;':''}line-height:1.5;">${esc(t.label)}</div>
          <button class="btn btn-ghost btn-sm tgs-go" data-screen="${t.screen}" style="flex-shrink:0;font-size:10px;padding:4px 10px;">Go</button>
        </div>`;
      }).join('');
      return `<div class="card" style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">
          <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">${weekLabels[w]}</div>
          <div style="font-size:11px;font-weight:700;color:${wPct===100?'var(--gold)':'var(--t3)'};">${wDone}/${tasks.length}</div>
        </div>
        <div class="prog" style="margin-bottom:14px;"><div class="prog-fill" style="width:${wPct}%;"></div></div>
        ${rows}
      </div>`;
    }).join('');

    container.innerHTML = `<div class="screen">
      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Overall Progress</div>
          <div style="font-size:18px;font-family:'Barlow Condensed',sans-serif;font-weight:700;color:${pct===100?'var(--gold)':'var(--w)'};">${pct}%</div>
        </div>
        <div class="prog"><div class="prog-fill" style="width:${pct}%;"></div></div>
        ${pct===100?'<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:12px;">Setup complete. Your Traffic Recovery system is fully operational.</div>':''}
      </div>
      ${sections}
    </div>`;

    container.addEventListener('change', ev => {
      if (!ev.target.classList.contains('tgs-chk')) return;
      const id = ev.target.dataset.id;
      const p = this.getProgress();
      if (ev.target.checked) p[id] = new Date().toISOString(); else delete p[id];
      this.saveProgress(p).then(() => this.render(container));
    });
    container.addEventListener('click', ev => {
      const btn = ev.target.closest('.tgs-go');
      if (btn) App.navigate(btn.dataset.screen);
    });
  }
};
