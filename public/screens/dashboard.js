'use strict';
S.Dashboard = {
  showHowTo() {
    App.showHelpModal('How the Profit Dashboard Works', [
      { p: ['The Profit Recovery landing runs the whole loop on one page: how much you have recovered up top, where the operation is leaking right now and the trend just under it, this week and your audit below that, and the jobs you run most at the bottom. Every number is computed from your own logged data, never an industry average. Before you have run an audit or logged a week, a Get Started strip points you at your first audit and the Control sections that feed Recovery.'] },
      { h: 'Recovery Scoreboard', p: ['The headline is what Bar Cop has measured you put back in the register since you marked each fix implemented. Realized to date, not a projection. A figure appears once two weeks of after-data exist and firms up over the next six. An on-pace-for-the-year number, when shown, is a clearly labeled secondary line, never banked cash.'] },
      { h: 'Where You\'re Leaking Now', p: ['Your cost gaps as plain text, biggest dollar leak first. Pour Cost and Food Cost carry a live dollar a year at this week\'s pace because Bar Cop has a weekly metric for them. Theft and Loss and Vendor Control do not dollarize into a clean weekly leak, so they read as a Review row you tap to work on their own screen. Labor is the third part of prime cost and is worked in Revenue Recovery, so its row routes there. Tap any row to open its fix process.'] },
      { h: 'Eight-Week Trend', p: ['Bar pour cost, food cost, and prime cost over the last eight weeks, with a marker on the weeks you logged a fix so you can see the metric bend after the work went in.'] },
      { h: 'This Week and Profit Audit', p: ['This Week shows the latest confirmed week\'s revenue and prime cost against target. Profit Audit shows your latest score and when the next one can run. Both open their full screen with a tap.'] },
      { h: 'Quick Actions', p: ['The four jobs you run most from here: enter this week\'s numbers, run a Profit Audit, open the Profit Forecast, and open Recipe Summary.'] }
    ]);
  },

  render(container, actions) {
    if (actions) actions.innerHTML = '';
    this.container = container;
    const weeks  = (App.data && App.data.weeks)  || [];
    const audits = (App.data && App.data.audits) || [];
    if (weeks.length === 0 && audits.length === 0) this.renderDayOne(container);
    else this.renderFull(container);
  },

  // Populated dashboard: Recovery Scoreboard hero, a diagnosis row (Where You're
  // Leaking Now as text + the 8-week trend), a standard row (This Week + Profit
  // Audit), then Quick Actions. Same skeleton clones to Revenue and Traffic.
  renderFull(container) {
    const weeks   = (App.data && App.data.weeks) || [];
    const targets = (App.data && App.data.settings && App.data.settings.targets) || {};
    const leak = FixPanel.leakRowsText('profit');
    const leakPanel = '<div class="card form-card" style="height:100%;"><div class="card-title">Where You\'re Leaking Now</div>'
      + (leak || '<div style="font-size:12px;color:var(--t3);line-height:1.6;">Run a Profit Audit and log a week, and your leaks rank here, biggest first.</div>')
      + '</div>';
    container.innerHTML = '<div class="screen">'
      + FixPanel._scoreboardCard('profit')
      + this.row(leakPanel, this.buildChart(weeks.slice(-8), targets))
      + this.row(this.weekPanel(weeks, targets), this.auditPanel())
      + this.quickActions()
      + '</div>';
    FixPanel.wireFixAreas(container);
    document.getElementById('db-insights-btn')?.addEventListener('click', () => this.showInsights());
    this.wireQuick(container);
  },

  // Equal-height two-column row (the Control-dashboard pattern).
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },

  // This Week panel — the latest confirmed week's headline numbers + a way in.
  weekPanel(weeks, targets) {
    const w = weeks[weeks.length - 1];
    if (!w) return '<div class="card form-card" style="height:100%;"><div class="card-title">This Week</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">Confirm a week in This Week and its numbers show here.</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="this-week">Open This Week</button></div>';
    const rev = (w.bar && w.bar.revenue || 0) + (w.food && w.food.revenue || 0) + (w.catering && w.catering.revenue || 0);
    const prime = w.prime_cost_pct;
    const pT = targets.prime_cost_pct || 60;
    const over = prime != null && prime > pT;
    const period = w.period_end ? 'Week ending ' + w.period_end.slice(5).replace('-', '/') : '';
    const r = (label, val, col) => '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--row-div);">'
      + '<span style="font-size:12px;color:var(--t3);">' + label + '</span>'
      + '<span style="font-size:14px;font-weight:600;color:' + (col || 'var(--t1)') + ';">' + val + '</span></div>';
    return '<div class="card form-card" style="height:100%;"><div class="card-title">This Week</div>'
      + (period ? '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">' + period + '</div>' : '')
      + r('Total Revenue', App.fmtCurrency(rev, 0))
      + r('Prime Cost', prime != null ? prime.toFixed(1) + '% (target ' + pT + '%)' : 'Not entered', over ? 'var(--red)' : (prime != null ? 'var(--green)' : 'var(--t3)'))
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm db-qa" data-go="this-week">Open This Week</button></div></div>';
  },

  // Profit Audit panel — latest score + next-audit timing + a way in.
  auditPanel() {
    const audits = ((App.data && App.data.audits) || []).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const latest = audits[0];
    if (!latest) return '<div class="card form-card" style="height:100%;"><div class="card-title">Profit Audit</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">Run your first Profit Audit for a baseline across pour cost, theft and loss, food cost, vendors, and prime cost.</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="audit-tracker">Run Profit Audit</button></div>';
    const score = latest.overall_score || 0;
    const col = App.scoreColor(score);
    const daysSince = latest.date ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const daysLeft = Math.max(0, 30 - daysSince);
    const timing = daysLeft > 0 ? 'Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') : 'Ready to run a new audit';
    return '<div class="card form-card" style="height:100%;"><div class="card-title">Profit Audit</div>'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:700;color:' + col + ';line-height:1;">' + score + '</div>'
      + '<div><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + col + ';">' + esc(App.scoreLabel(score)) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date || '').slice(0, 10) + '</div></div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + timing + '</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="audit-tracker">View Audit</button></div>';
  },

  // Day one (no weeks, no audits): guided steps + placeholders, like Control. The
  // Recovery day-one points at the first audit and the Control feeds, not a prereq
  // checklist; the wow visuals switch on only once data backs them.
  renderDayOne(container) {
    const hasAudit = ((App.data && App.data.audits) || []).length > 0;
    const hasInv   = ((App.inventoryData && App.inventoryData.ic_products) || []).length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;

    const step = (done, num, label, go, cross) =>
      '<div class="db-go" data-go="' + go + '"' + (cross ? ' data-cross="1"' : '') + ' style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid ' + (done ? 'var(--b2)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (done ? 'var(--input)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;' + (done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (done ? '&#10003;' : num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + label + '</span></div>';

    const strip = '<div class="card form-card" style="margin-bottom:14px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Run your first Profit Audit for a baseline, and set up the Control sections that feed Recovery. As that data lands, this dashboard fills in with your recovered dollars and where the operation is leaking.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + step(hasAudit, 1, 'Run your first Profit Audit', 'audit-tracker', false)
      + step(hasInv,   2, 'Set up Inventory Control', 'ic-dashboard', true)
      + step(hasShift, 3, 'Set up Shift Control', 'sc-dashboard', true)
      + step(hasLabor, 4, 'Set up Labor Control', 'lc-dashboard', true)
      + '</div></div>';

    const ph = (title, msg) => '<div class="card form-card" style="height:100%;"><div class="card-title">' + title + '</div>'
      + '<div style="font-size:13px;color:var(--t3);line-height:1.6;">' + msg + '</div></div>';

    container.innerHTML = '<div class="screen">'
      + strip
      + '<div style="margin-bottom:16px;">' + ph('Recovery Scoreboard', 'Your recovered dollars show here once you log your first fix. Bar Cop measures the metric before and after the fix and reports only what is real.') + '</div>'
      + this.row(
          ph('Where You\'re Leaking Now', 'Your cost gaps rank here once a week of data lands, biggest dollar first, each one a tap into the fix process.'),
          ph('8-Week Trend', 'Bar, food, and prime cost over the last eight weeks plot here once you have logged a couple of weeks.'))
      + this.row(
          ph('This Week', 'The latest confirmed week shows here. Enter your numbers in This Week to start.'),
          ph('Profit Audit', 'Your latest Profit Audit score lands here once you run one.'))
      + this.quickActions()
      + '</div>';
    this.wireQuick(container);
  },

  quickActions() {
    const btn = (go, label) => '<button class="btn btn-primary db-qa" data-go="' + go + '" style="flex:1;min-width:150px;">' + label + '</button>';
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + btn('this-week', 'Enter This Week')
      + btn('audit-tracker', 'Run Profit Audit')
      + btn('profit-forecast', 'Profit Forecast')
      + btn('recipe-cost-analysis', 'Recipe Summary')
      + '</div></div>';
  },

  wireQuick(container) {
    container.querySelectorAll('.db-qa').forEach(b =>
      b.addEventListener('click', () => App.navigate(b.dataset.go)));
    container.querySelectorAll('.db-go').forEach(b =>
      b.addEventListener('click', () => {
        if (b.dataset.cross) App.openScreen(b.dataset.go); else App.navigate(b.dataset.go);
      }));
  },

  buildChart(weeks, targets) {
    if (weeks.length < 2) return '<div class="chart-card" style="height:100%;padding:24px 24px 20px;">'
      +'<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Trend</div>'
      +'<div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>';

    const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;

    const barS  = weeks.map(w=>w.bar?.cost_pct??null);
    const foodS = weeks.map(w=>w.food?.cost_pct??null);
    const priS  = weeks.map(w=>w.prime_cost_pct??null);
    const allV  = [...barS,...foodS,...priS].filter(v=>v!=null);
    if (allV.length===0) return '';

    const minY = Math.max(0, Math.floor(Math.min(...allV) - 4));
    const maxY = Math.ceil(Math.max(...allV) + 6);
    const xs = i => PAD.l + (weeks.length > 1 ? (i/(weeks.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY))*ch;

    // Smooth bezier path
    const smoothPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
      if (valid.length < 2) return valid.length===1?`M${valid[0].x},${valid[0].y}`:'';
      let d = `M${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)}`;
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ` C${(valid[i-1].x+cp).toFixed(1)},${valid[i-1].y.toFixed(1)} ${(valid[i].x-cp).toFixed(1)},${valid[i].y.toFixed(1)} ${valid[i].x.toFixed(1)},${valid[i].y.toFixed(1)}`;
      }
      return d;
    };

    // Area fill path (close back to bottom)
    const areaPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v),orig:v}:null).filter(Boolean);
      if (valid.length < 2) return '';
      let d = `M${valid[0].x.toFixed(1)},${ys(minY).toFixed(1)} L${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)}`;
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ` C${(valid[i-1].x+cp).toFixed(1)},${valid[i-1].y.toFixed(1)} ${(valid[i].x-cp).toFixed(1)},${valid[i].y.toFixed(1)} ${valid[i].x.toFixed(1)},${valid[i].y.toFixed(1)}`;
      }
      d += ` L${valid[valid.length-1].x.toFixed(1)},${ys(minY).toFixed(1)} Z`;
      return d;
    };

    const pourTarget = targets.bar_pour_cost_pct || 22;
    const primeTarget = targets.prime_cost_pct || 60;
    const tPx = ys(pourTarget);

    // Y-axis ticks — 4 evenly spaced
    const range = maxY - minY;
    const tickStep = range <= 12 ? 2 : range <= 24 ? 4 : 8;
    const ticks = [];
    for (let v = Math.ceil(minY/tickStep)*tickStep; v <= maxY; v += tickStep) ticks.push(v);

    // X labels
    const xLabels = weeks.map((w,i) => {
      const lbl = w.period_end ? w.period_end.slice(5).replace('-','/') : 'Wk'+w.week_num;
      return `<text x="${xs(i).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${lbl}</text>`;
    }).join('');

    // Value labels on bar cost dots
    const barLabels = barS.map((v,i) => {
      if (v==null) return '';
      const x = xs(i), y = ys(v);
      const above = y > PAD.t + 16;
      return `<text x="${x.toFixed(1)}" y="${(above ? y-10 : y+18).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">${v.toFixed(1)}%</text>`;
    }).join('');

    const barPath  = smoothPath(barS);
    const foodPath = smoothPath(foodS);
    const priPath  = smoothPath(priS);
    const barArea  = areaPath(barS);

    const uid = 'ag'+Math.random().toString(36).slice(2,6);

    const fixMarks = (window.Recovery) ? Recovery.chartMarkers(weeks, 'profit') : [];
    const fixMarkers = (window.FixPanel && fixMarks.length)
      ? FixPanel.markerSvg(fixMarks, xs, PAD.t, PAD.t + ch) : '';
    const fixLegend = fixMarks.length
      ? '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:8px;height:8px;border-radius:50%;background:#DBAB46;display:inline-block;border:0.5px solid rgba(0,0,0,0.35);"></span>Fix Logged</span>'
      : '';

    return `<div class="chart-card" style="height:100%;padding:20px 24px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:16px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>
          <button class="btn btn-ghost btn-sm" id="db-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Trend Insights</button>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:#DBAB46;display:inline-block;border-radius:1px;"></span>Bar Pour Cost</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:rgba(255,255,255,0.4);display:inline-block;border-radius:1px;"></span>Food Cost</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:rgba(255,255,255,0.2);display:inline-block;border-radius:1px;"></span>Prime Cost</span>
          ${fixLegend}
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${ticks.map(v=>`
          <line x1="${PAD.l}" y1="${ys(v).toFixed(1)}" x2="${W-PAD.r}" y2="${ys(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
          <text x="${PAD.l-8}" y="${(ys(v)+4).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${v}%</text>
        `).join('')}
        <line x1="${PAD.l}" y1="${tPx.toFixed(1)}" x2="${W-PAD.r}" y2="${tPx.toFixed(1)}" stroke="#DBAB46" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>
        <text x="${W-PAD.r+6}" y="${(tPx+4).toFixed(1)}" fill="rgba(219,171,70,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>
        ${fixMarkers}
        ${barArea ? `<path d="${barArea}" fill="url(#${uid})"/>` : ''}
        ${priPath ? `<path d="${priPath}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        ${foodPath ? `<path d="${foodPath}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        ${barPath ? `<path d="${barPath}" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        ${barS.map((v,i) => v!=null ? `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="4" fill="#0A1520" stroke="#DBAB46" stroke-width="2"/>` : '').join('')}
        ${barLabels}
        ${xLabels}
      </svg>
    </div>`;
  },

  showInsights() {
    if (App.demoBlock && App.demoBlock('AI Trend Insights')) return;
    const ID = 'db-insights';
    const weeks = (App.data.weeks || []).slice(-8);
    const wrap = inner => '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Trend Insights</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.85;">' + inner + '</div>'
      + '<div class="card-actions"><button class="btn btn-ghost" onclick="App.closeModal(\'' + ID + '\')">Close</button></div></div>';
    const open = inner => App.openModal(wrap(inner), { id: ID, maxWidth: 600, noClose: true });

    if (weeks.length < 2) { open('Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }
    open('Reading your last ' + weeks.length + ' weeks&hellip;');

    const t = App.data.settings.targets || {};
    const bT = t.bar_pour_cost_pct || 22, fT = t.food_cost_pct || 32, pT = t.prime_cost_pct || 60;
    const avg = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    const bP = weeks.map(w => w.bar?.cost_pct).filter(v => v != null);
    const fP = weeks.map(w => w.food?.cost_pct).filter(v => v != null);
    const pP = weeks.map(w => w.prime_cost_pct).filter(v => v != null);
    const bR = weeks.map(w => w.bar?.revenue).filter(v => v != null);
    const aB = avg(bP).toFixed(1), aF = avg(fP).toFixed(1), aP = avg(pP).toFixed(1), aR = avg(bR);
    const gap = ((parseFloat(aB) - bT) / 100 * aR).toFixed(0);
    const trend = bP.length >= 3 ? (bP[bP.length - 1] - bP[0] > 1 ? 'trending higher (worsening)' : bP[0] - bP[bP.length - 1] > 1 ? 'trending lower (improving)' : 'holding steady') : 'early data';
    const lines = [
      'Bar Pour Cost %: ' + weeks.map(w => (w.bar?.cost_pct || 0).toFixed(1) + '%').join(', ') + ' (target:' + bT + '% avg:' + aB + '%)',
      'Food Cost %: ' + weeks.map(w => (w.food?.cost_pct || 0).toFixed(1) + '%').join(', ') + ' (target:' + fT + '% avg:' + aF + '%)',
      'Prime Cost %: ' + weeks.map(w => (w.prime_cost_pct || 0).toFixed(1) + '%').join(', ') + ' (target:' + pT + '% avg:' + aP + '%)',
      'Bar Revenue: ' + weeks.map(w => '$' + Math.round(w.bar?.revenue || 0)).join(', '),
      'Weekly gap vs bar target: $' + Math.abs(gap) + ' ' + (parseFloat(gap) > 0 ? 'over' : 'under'),
      'Pour cost trend: ' + trend
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner. Write 3 short paragraphs, one insight each, based on the data below. Rules: no emdashes, no dashes used as punctuation, no bullet points, no headers, no AI language. Write the way an experienced operator talks to another operator. Plain sentences. Specific numbers. Direct about what needs to change and exactly what to do about it this week.\n\n' + lines.join('\n') + '\n\nLead with the most urgent cost issue, then revenue trend, then the single action that will matter most this week.';

    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { open('Could not read the trend right now: ' + esc(data.error.message || 'try again.')); return; }
        const text = data.content?.[0]?.text;
        if (!text) { open('No response came back. Try again.'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        open('<p style="margin:0;">' + safe + '</p>');
      })
      .catch(err => open('Connection error: ' + esc(err.message) + '. Check your connection and try again.'));
  }
};
