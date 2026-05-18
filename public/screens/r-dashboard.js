'use strict';
S.RevenueGettingStarted = {
  TASKS: [
    { week:1, id:'rgs_targets',  label:'Set your revenue targets on the Dashboard. Check average, labor percentages, and RPLH targets are pre-filled with industry benchmarks.', screen:'r-dashboard' },
    { week:1, id:'rgs_menu',     label:'Add your menu items in Menu Items. Include food and drink categories with pricing and cost data.', screen:'r-menu-items' },
    { week:1, id:'rgs_servers',  label:'Add your server roster in Settings. Every server you staff needs to be in the system before entering weekly data.', screen:'r-settings' },
    { week:1, id:'rgs_eng',      label:'Run Menu Engineering with your current menu data. Identify your Stars, Plowhorses, Puzzles, and Dogs.', screen:'r-menu-engineering' },
    { week:1, id:'rgs_labor',    label:'Review the Labor Budget calculator. Enter your projected revenue and let the app calculate your labor budget before you write the schedule.', screen:'r-labor-budget' },
    { week:2, id:'rgs_week1',    label:'Enter your first week of revenue and labor data in This Week.', screen:'r-this-week' },
    { week:2, id:'rgs_server1',  label:'Review the Server Check Average table after entering Week 1 data. Note the spread between your top and bottom performers.', screen:'r-check-average' },
    { week:2, id:'rgs_rplh1',    label:'Review RPLH by daypart for Week 1. Identify which daypart is performing lowest.', screen:'r-rplh' },
    { week:2, id:'rgs_upsell',   label:'Run the Upsell Revenue Calculator in Check Average. Enter your current team average and see the annual gap.', screen:'r-check-average' },
    { week:3, id:'rgs_events',   label:'Build your Event Rate Card in Events and Catering. This replaces verbal quoting for private dining and buyouts.', screen:'r-events' },
    { week:3, id:'rgs_price',    label:'Run the Price Sensitivity Calculator on your top 5 menu items.', screen:'r-menu-engineering' },
    { week:3, id:'rgs_week2',    label:'Enter Week 2 data in This Week.', screen:'r-this-week' },
    { week:3, id:'rgs_catering', label:'Run the Catering Pricing Calculator for your most common event type.', screen:'r-events' },
    { week:4, id:'rgs_week3',    label:'Enter Week 3 data in This Week.', screen:'r-this-week' },
    { week:4, id:'rgs_trend',    label:'Review the 3-week trend on your Dashboard.', screen:'r-dashboard' },
    { week:4, id:'rgs_report',   label:'Review your Reports and History. Run the annual revenue projection.', screen:'r-reports' },
    { week:4, id:'rgs_brief',    label:'Brief your servers on the check average target and the weekly gap. Make it a number they know.', screen:'r-check-average' },
    { week:4, id:'rgs_routine',  label:'Set a recurring weekly reminder to enter This Week data. Consistency is what makes the system work.', screen:'r-this-week' },
  ],

  getProgress() { return App.data.getting_started_revenue || {}; },
  saveProgress(p) { App.data.getting_started_revenue = p; return App.saveKey('getting_started_revenue'); },

  render(container) {
    const progress = this.getProgress();
    const weeks = [1,2,3,4];
    const weekLabels = { 1:'Week 1 — Foundation', 2:'Week 2 — Labor and Server Baseline', 3:'Week 3 — Revenue Systems', 4:'Week 4 — Full System Running' };
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
          <input type="checkbox" class="rgs-chk" data-id="${t.id}" data-screen="${t.screen}" ${d?'checked':''} style="margin-top:2px;flex-shrink:0;accent-color:var(--gold);width:16px;height:16px;cursor:pointer;"/>
          <div style="flex:1;font-size:12px;color:${d?'var(--t3)':'var(--t1)'};${d?'text-decoration:line-through;':''}line-height:1.5;">${esc(t.label)}</div>
          <button class="btn btn-ghost btn-sm rgs-go" data-screen="${t.screen}" style="flex-shrink:0;font-size:10px;padding:4px 10px;">Go</button>
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
        ${pct===100?'<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:12px;">Setup complete. Your Revenue Recovery system is fully operational.</div>':''}
      </div>
      ${sections}
    </div>`;

    container.addEventListener('change', ev => {
      if (!ev.target.classList.contains('rgs-chk')) return;
      const id = ev.target.dataset.id;
      const p = this.getProgress();
      if (ev.target.checked) p[id] = new Date().toISOString(); else delete p[id];
      this.saveProgress(p).then(() => this.render(container));
    });
    container.addEventListener('click', ev => {
      const btn = ev.target.closest('.rgs-go');
      if (btn) App.navigate(btn.dataset.screen);
    });
  }
};
