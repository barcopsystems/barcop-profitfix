'use strict';
S.GettingStarted = {
  TASKS: [
    { week:1, id:'t_targets', label:'Set your cost targets on the Profit Recovery dashboard. Industry benchmarks are pre-filled. Adjust them to match your operation and save.', screen:'dashboard' },
    { week:1, id:'t00', label:'Request your first Profit Audit. Upload your POS Beverages report to get your baseline score before making any changes.', screen:'audit-tracker' },
    { week:1, id:'t01', label:'Complete bar setup. Add all spirits, beer, and wine products in Bar Products.', screen:'bar-products' },
    { week:1, id:'t02', label:'Add kitchen products. Food ingredients and bar mixers go in Kitchen Products.', screen:'kitchen-products' },
    { week:1, id:'t04', label:'Enter your annual bar and food revenue in Settings.', screen:'settings' },
    { week:2, id:'t05', label:'Enter your first week of bar and food data in This Week.', screen:'this-week' },
    { week:2, id:'t06', label:'Build your top 10 recipes in Recipe Library.', screen:'recipe-library' },
    { week:2, id:'t07', label:'Run your first bar inventory count in This Week, step 4.', screen:'this-week' },
    { week:2, id:'t08', label:'Log your first shift check in Shift Check.', screen:'shift-check' },
    { week:3, id:'t09', label:'Enter a second week of data and compare week over week on the Dashboard.', screen:'dashboard' },
    { week:3, id:'t10', label:'Complete the Theft Risk Scorecard to baseline your control environment.', screen:'theft-risk' },
    { week:3, id:'t11', label:'Run a cash reconciliation for one shift.', screen:'cash-recon' },
    { week:3, id:'t12', label:'Log any vendor price changes from your last invoice in Vendor Watch.', screen:'vendor-watch' },
    { week:4, id:'t13', label:'Review the 8-week trend chart on your Dashboard.', screen:'dashboard' },
    { week:4, id:'t14', label:'Check Reports and History. Run the annual cost calculator.', screen:'reports' },
    { week:4, id:'t15', label:'Download and review the resources in the Resources section.', screen:'resources' },
    { week:4, id:'t16', label:'Request your second Profit Audit. The app now includes all your 30-day tracked data for a deeper, more complete analysis.', screen:'audit-tracker' },
  ],

  getProgress() {
    return App.data.getting_started_profit || {};
  },

  saveProgress(progress) {
    App.data.getting_started_profit = progress;
    return App.saveKey('getting_started_profit');
  },

  render(container) {
    const progress = this.getProgress();
    const weeks = [1,2,3,4];
    const weekLabels = {
      1: 'Week 1 — Foundation',
      2: 'Week 2 — First Data',
      3: 'Week 3 — Build the Habit',
      4: 'Week 4 — Full Picture'
    };

    const totalTasks = this.TASKS.length;
    const doneTasks  = this.TASKS.filter(t => progress[t.id]).length;
    const pct = Math.round(doneTasks / totalTasks * 100);

    const weekSections = weeks.map(w => {
      const tasks = this.TASKS.filter(t => t.week === w);
      const wDone = tasks.filter(t => progress[t.id]).length;
      const wPct  = Math.round(wDone / tasks.length * 100);

      const taskRows = tasks.map(t => {
        const done = !!progress[t.id];
        return '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);">'
          + '<input type="checkbox" class="gs-chk" data-id="' + t.id + '" data-screen="' + t.screen + '"'
          + (done ? ' checked' : '') + ' style="margin-top:2px;flex-shrink:0;accent-color:var(--gold);width:16px;height:16px;cursor:pointer;"/>'
          + '<div style="flex:1;">'
          + '<div style="font-size:12px;color:' + (done ? 'var(--t3)' : 'var(--t1)') + ';' + (done ? 'text-decoration:line-through;' : '') + 'line-height:1.5;">' + esc(t.label) + '</div>'
          + '</div>'
          + '<button class="btn btn-ghost btn-sm gs-go" data-screen="' + t.screen + '" style="flex-shrink:0;font-size:10px;padding:4px 10px;">Go</button>'
          + '</div>';
      }).join('');

      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">' + weekLabels[w] + '</div>'
        + '<div style="font-size:11px;font-weight:700;color:' + (wPct===100?'var(--gold)':'var(--t3)') + ';">' + wDone + '/' + tasks.length + '</div>'
        + '</div>'
        + '<div class="prog" style="margin-bottom:14px;"><div class="prog-fill" style="width:' + wPct + '%;"></div></div>'
        + taskRows
        + '</div>';
    }).join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="card" style="margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Overall Progress</div>'
      + '<div style="font-size:18px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:' + (pct===100?'var(--gold)':'var(--w)') + ';">' + pct + '%</div>'
      + '</div>'
      + '<div class="prog"><div class="prog-fill" style="width:' + pct + '%;"></div></div>'
      + (pct===100 ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:12px;">Setup complete. Your Profit Fix system is fully operational.</div>' : '')
      + '</div>'
      + weekSections
      + '</div>';

    container.addEventListener('change', ev => {
      if (!ev.target.classList.contains('gs-chk')) return;
      const id = ev.target.dataset.id;
      const progress = this.getProgress();
      if (ev.target.checked) progress[id] = new Date().toISOString();
      else delete progress[id];
      this.saveProgress(progress).then(() => this.render(container));
    });

    container.addEventListener('click', ev => {
      const btn = ev.target.closest('.gs-go');
      if (btn) App.navigate(btn.dataset.screen);
    });
  }
};
