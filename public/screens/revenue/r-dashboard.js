'use strict';
S.RevenueDashboard = {
  _dismissed: false,

  render(container, actions) {
    actions.innerHTML = '';
    // Trend Insights button lives in the 8-Week Trend chart header, not here.
    const rs     = App.data.revenue_settings || {};
    const t      = rs.targets || {};
    const weeks  = App.data.revenue_weeks || [];
    const validWeeks = weeks.filter(w => (w.bar_revenue||0) + (w.floor_revenue||0) > 0);
    const latest = validWeeks.length ? validWeeks[validWeeks.length - 1] : null;

    const checkAvg   = latest?.check_avg ?? null;
    const laborPct   = latest?.labor_pct_blended ?? null;
    const totalRev   = latest ? (latest.bar_revenue||0) + (latest.floor_revenue||0) : null;
    const covers     = latest?.covers ?? null;
    const targetCA   = t.check_avg ?? 35;
    const targetLP   = ((t.bar_labor_pct||28) + (t.kitchen_labor_pct||30) + (t.floor_labor_pct||32)) / 3;

    // Alert
    let alertHtml = '';
    if (latest && !this._dismissed) {
      if (checkAvg != null && (targetCA - checkAvg) > 2) {
        const annualGap = (targetCA - checkAvg) * (covers||0) * 52;
        alertHtml = '<div class="alert-bar" id="r-alert"><div class="alert-text">Check average is ' + App.fmtCurrency(targetCA - checkAvg) + ' below target. That is ' + App.fmtCurrency(Math.abs(annualGap)) + ' in lost annual revenue at your current cover count.</div><button class="alert-dismiss" id="r-dismiss">Close</button></div>';
      } else if (laborPct != null && laborPct - targetLP > 2) {
        const wkOver = ((laborPct - targetLP) / 100) * (totalRev||0);
        alertHtml = '<div class="alert-bar" id="r-alert"><div class="alert-text">Labor is ' + (laborPct - targetLP).toFixed(1) + ' points over target this week. That is ' + App.fmtCurrency(wkOver) + ' over budget.</div><button class="alert-dismiss" id="r-dismiss">Close</button></div>';
      }
    }

    // Setup nudging lives at the Hub level via the catch-up banner on the
    // Hub Dashboard. Recovery dashboards stay purely operational.

    // Priority Action Items — ranked by dollar impact from the latest Revenue audit
    const rAudits = App.data.revenue_audits || [];
    const latestAudit = rAudits.length ? rAudits[rAudits.length-1] : null;
    const actionItems = (latestAudit?.action_items || [])
      .filter(it => it && it.action)
      .slice()
      .sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0))
      .slice(0,5);

    const actionRows = actionItems.length
      ? actionItems.map((it,i) => {
          const gid = it.gap_id || (window.FixPanel ? FixPanel.inferGapId(it.action, 'revenue') : null);
          return '<div class="r-db-action" data-gap="' + esc(gid || '') + '" '
          + 'style="display:flex;align-items:center;gap:12px;padding:13px 20px;cursor:pointer;'
          + (i < actionItems.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
          + '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--gold-bg);'
          + 'color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</div>'
          + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);line-height:1.5;">'+esc(it.action)+'</div>'
          + (it.monthly_impact > 0
              ? '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:600;color:var(--gold);">'
                + App.fmtCurrency(it.monthly_impact,0) + '<span style="font-size:9px;"> /mo</span></div>'
              : '')
          + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
          + '</div>';
        }).join('')
      : '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.65;">'
        + 'Run a Revenue Audit and your highest-impact opportunities will be ranked here by dollar impact.</div>';
    const actionHtml = '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Priority Action Items')
      + actionRows
      + '</div>';

    container.innerHTML = '<div class="screen">'
      + FixPanel.recoveryCard('revenue')
      + alertHtml
      + this.buildChart(validWeeks.slice(-8), t)
      + actionHtml
      + this.buildInitiativesCard()
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Quick Actions')
      + '<div class="qa" style="padding:18px 20px;">'
      + '<button class="btn btn-primary" id="r-qa-week">Enter This Week</button>'
      + '<button class="btn btn-ghost" id="r-qa-server">Revenue Audit</button>'
      + '<button class="btn btn-ghost" id="r-qa-reports">View Reports</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    document.getElementById('r-dismiss')?.addEventListener('click', () => { this._dismissed=true; document.getElementById('r-alert')?.remove(); });
    document.getElementById('r-qa-week')?.addEventListener('click', () => App.navigate('r-this-week'));
    document.getElementById('r-qa-server')?.addEventListener('click', () => App.navigate('r-audit'));
    document.getElementById('r-qa-reports')?.addEventListener('click', () => App.navigate('r-reports'));
    container.querySelectorAll('.r-db-action').forEach(row => {
      row.addEventListener('click', () => {
        if (row.dataset.gap) App._fixFocus = row.dataset.gap;
        App.navigate('r-fix');
      });
    });
    document.getElementById('r-insights-btn')?.addEventListener('click', () => this.showInsights());
    this.wireInitiatives(container);
    FixPanel.wireFixAreas(container);
  },

  // ── Initiative Tracker ─────────────────────────────────────────────────
  // Operator-typed revenue experiments. Each one captures: start date, what
  // changed, which metric to watch. Bar Cop computes the 8-week-before vs
  // 8-week-after average of the watched metric and shows the lift. Distinct
  // from Recovery Scoreboard (which tracks audit-action-item fix dates). This
  // tracks revenue experiments: new menu items, promotions, service changes.
  INITIATIVE_TYPES: ['Menu Change', 'Promotion', 'Service Change', 'Operational Change', 'Other'],
  INITIATIVE_METRICS: [
    { key: 'revenue',    label: 'Total Revenue (weekly)' },
    { key: 'covers',     label: 'Covers (weekly)' },
    { key: 'check_avg',  label: 'Check Average' },
    { key: 'labor_pct',  label: 'Labor % (lower is better)' }
  ],

  initiatives() {
    if (!Array.isArray(App.data.initiatives)) App.data.initiatives = [];
    return App.data.initiatives;
  },

  // Compute the watched metric value for a given weekly row.
  _metricFor(week, key) {
    if (!week) return null;
    if (key === 'revenue')   return (parseFloat(week.bar_revenue) || 0) + (parseFloat(week.floor_revenue) || 0);
    if (key === 'covers')    return parseFloat(week.covers) || 0;
    if (key === 'check_avg') return parseFloat(week.check_avg) || 0;
    if (key === 'labor_pct') return parseFloat(week.labor_pct_blended) || 0;
    return null;
  },

  // Returns { before, after, lift, weeksAfter } for an initiative.
  _measureInitiative(init) {
    const weeks = (App.data.revenue_weeks || []).filter(w => w.period_end);
    const sd = init.start_date;
    if (!sd) return { before: null, after: null, lift: null, weeksAfter: 0 };
    const before = weeks.filter(w => w.period_end < sd).slice(-8);
    const after  = weeks.filter(w => w.period_end >= sd).slice(0, 8);
    const avg = arr => {
      const vals = arr.map(w => this._metricFor(w, init.metric)).filter(v => v != null && !isNaN(v));
      if (!vals.length) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };
    const beforeAvg = avg(before);
    const afterAvg  = avg(after);
    const lift = (beforeAvg != null && afterAvg != null) ? (afterAvg - beforeAvg) : null;
    return { before: beforeAvg, after: afterAvg, lift, weeksAfter: after.length };
  },

  buildInitiativesCard() {
    const all = this.initiatives();
    const active = all.filter(i => i.status === 'Active');
    const closed = all.filter(i => i.status !== 'Active');

    const formatLift = (lift, metric) => {
      if (lift == null) return '<span style="color:var(--t4);">no data yet</span>';
      const isLowerBetter = metric === 'labor_pct';
      const positive = isLowerBetter ? lift < 0 : lift > 0;
      const color = positive ? 'var(--gold)' : (lift === 0 ? 'var(--t2)' : 'var(--red)');
      const fmt = (metric === 'revenue' || metric === 'check_avg') ? App.fmtCurrency(lift) : (metric === 'covers' ? lift.toFixed(0) : lift.toFixed(1) + '%');
      return '<span style="color:' + color + ';font-weight:700;">' + (lift >= 0 ? '+' : '') + fmt + '</span>';
    };

    const activeRows = active.length ? active.map(i => {
      const m = this._measureInitiative(i);
      const metricLabel = (this.INITIATIVE_METRICS.find(x => x.key === i.metric) || {}).label || i.metric;
      const windowMsg = m.weeksAfter < 2
        ? 'Measuring (week ' + m.weeksAfter + ' of 8)'
        : m.weeksAfter + ' weeks in';
      return '<div style="border-top:1px solid var(--b2);padding:12px 20px;">'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(i.name) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + esc(i.type || '') + ' &middot; started ' + esc(i.start_date || '') + ' &middot; ' + esc(windowMsg) + '</div>'
        + '</div>'
        + (i.hypothesis ? '<div style="font-size:11px;color:var(--t3);margin-top:4px;line-height:1.5;">' + esc(i.hypothesis) + '</div>' : '')
        + '<div style="display:flex;gap:18px;margin-top:8px;flex-wrap:wrap;align-items:baseline;">'
        + '<div style="font-size:11px;color:var(--t3);">Watching: <span style="color:var(--t1);">' + esc(metricLabel) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">Before: <span style="color:var(--t1);">' + (m.before != null ? (i.metric === 'revenue' || i.metric === 'check_avg' ? App.fmtCurrency(m.before) : i.metric === 'covers' ? Math.round(m.before) : m.before.toFixed(1) + '%') : '-') + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">After: <span style="color:var(--t1);">' + (m.after != null ? (i.metric === 'revenue' || i.metric === 'check_avg' ? App.fmtCurrency(m.after) : i.metric === 'covers' ? Math.round(m.after) : m.after.toFixed(1) + '%') : '-') + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">Lift: ' + formatLift(m.lift, i.metric) + '</div>'
        + '<div style="margin-left:auto;display:flex;gap:6px;">'
        + '<button class="btn btn-ghost btn-sm init-complete" data-id="' + esc(i.id) + '" style="font-size:10px;padding:3px 8px;">Mark Complete</button>'
        + '<button class="btn btn-danger btn-sm init-del" data-id="' + esc(i.id) + '" style="font-size:10px;padding:3px 8px;">Delete</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('') : '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.65;">No active initiatives. Start one when you launch a new menu item, run a promotion, or make a service change you want to measure.</div>';

    const closedRows = closed.length ? '<div style="padding:8px 20px 4px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);border-top:1px solid var(--b2);">Completed</div>'
      + closed.slice().reverse().slice(0, 5).map(i => {
        const m = this._measureInitiative(i);
        return '<div style="padding:8px 20px;display:flex;align-items:center;gap:10px;border-top:1px solid var(--b2);font-size:11px;">'
          + '<span style="color:var(--t2);flex:1;">' + esc(i.name) + '</span>'
          + '<span style="color:var(--t3);">' + esc(i.type || '') + '</span>'
          + '<span>' + formatLift(m.lift, i.metric) + '</span>'
          + '<button class="btn btn-ghost btn-sm init-del" data-id="' + esc(i.id) + '" style="font-size:10px;padding:2px 6px;">Remove</button>'
          + '</div>';
      }).join('') : '';

    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Initiative Tracker')
      + '<div style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.55;max-width:560px;">Revenue experiments you want to measure. Pick a metric, log what you changed, Bar Cop tracks the 8-week before/after lift.</div>'
      + '<button class="btn btn-primary btn-sm" id="init-add">+ Start Initiative</button>'
      + '</div>'
      + activeRows
      + closedRows
      + '</div>';
  },

  wireInitiatives(container) {
    document.getElementById('init-add')?.addEventListener('click', () => this.showInitiativeForm());
    container.querySelectorAll('.init-complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = this.initiatives().find(x => x.id === btn.dataset.id);
        if (!i) return;
        i.status = 'Completed';
        i.completed_at = new Date().toISOString();
        await App.saveKey('initiatives');
        S.RevenueDashboard.render(container, document.getElementById('topbar-actions') || document.createElement('div'));
      });
    });
    container.querySelectorAll('.init-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm({ title: 'Delete this initiative?', confirmText: 'Delete', cancelText: 'Cancel' });
        if (!ok) return;
        App.data.initiatives = this.initiatives().filter(x => x.id !== btn.dataset.id);
        await App.saveKey('initiatives');
        S.RevenueDashboard.render(container, document.getElementById('topbar-actions') || document.createElement('div'));
      });
    });
  },

  showInitiativeForm() {
    const typeOpts = this.INITIATIVE_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
    const metricOpts = this.INITIATIVE_METRICS.map(m => '<option value="' + esc(m.key) + '">' + esc(m.label) + '</option>').join('');
    const today = new Date().toISOString().slice(0, 10);
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';
    m.innerHTML = '<div style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:540px;width:100%;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.55);">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--b2);padding-bottom:12px;">'
        + '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Start Initiative</div>'
        + '<button type="button" id="init-close" style="background:none;border:none;color:var(--t2);font-size:26px;line-height:1;cursor:pointer;padding:0 4px;font-weight:300;">&times;</button>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:12px;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Name</label><input type="text" id="init-name" placeholder="New Cocktail Menu"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Start Date</label><input type="date" id="init-date" value="' + today + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:12px;">'
        + '<div class="f" style="width:180px;"><label>Type</label><select id="init-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Watch Metric</label><select id="init-metric">' + metricOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:12px;"><label>What you changed (optional)</label><textarea id="init-hyp" rows="3" placeholder="Launched 6 new cocktails Aug 1, expected check average lift of $2-3"></textarea></div>'
      + '<div id="init-err" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;">'
        + '<button type="button" id="init-cancel" class="btn btn-ghost">Cancel</button>'
        + '<button type="button" id="init-save" class="btn btn-primary">Start Initiative</button>'
      + '</div>'
    + '</div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('init-close').addEventListener('click', close);
    document.getElementById('init-cancel').addEventListener('click', close);
    document.getElementById('init-save').addEventListener('click', async () => {
      const name = document.getElementById('init-name')?.value.trim();
      const date = document.getElementById('init-date')?.value;
      const err = document.getElementById('init-err');
      const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } };
      if (!name) { fail('Name is required.'); return; }
      if (!date) { fail('Start date is required.'); return; }
      this.initiatives().push({
        id: App.uid(),
        name,
        start_date: date,
        type: document.getElementById('init-type')?.value || 'Other',
        metric: document.getElementById('init-metric')?.value || 'revenue',
        hypothesis: document.getElementById('init-hyp')?.value.trim() || '',
        status: 'Active',
        created_at: new Date().toISOString()
      });
      await App.saveKey('initiatives');
      close();
      const c = document.getElementById('content-area');
      const a = document.getElementById('topbar-actions') || document.createElement('div');
      if (c) S.RevenueDashboard.render(c, a);
    });
  },

  buildChart(weeks, t) {
    if (weeks.length < 2) return '<div class="chart-card" style="padding:24px 24px 20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Trend</div>'
      + '<div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>';

    const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;

    const caS   = weeks.map(w=>w.check_avg??null);
    const labS  = weeks.map(w=>w.labor_pct_blended??null);
    const rplhS = weeks.map(w=>w.rplh_blended??null);
    const allV  = [...caS,...labS,...rplhS].filter(v=>v!=null);
    if (!allV.length) return '';

    const minY = Math.max(0, Math.floor(Math.min(...allV)-4));
    const maxY = Math.ceil(Math.max(...allV)+6);
    const xs = i => PAD.l + (weeks.length>1 ? (i/(weeks.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY))*ch;

    const smoothPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
      if (valid.length<2) return valid.length===1?'M'+valid[0].x+','+valid[0].y:'';
      let d='M'+valid[0].x.toFixed(1)+','+valid[0].y.toFixed(1);
      for(let i=1;i<valid.length;i++){const cp=(valid[i].x-valid[i-1].x)*0.35;d+=' C'+(valid[i-1].x+cp).toFixed(1)+','+valid[i-1].y.toFixed(1)+' '+(valid[i].x-cp).toFixed(1)+','+valid[i].y.toFixed(1)+' '+valid[i].x.toFixed(1)+','+valid[i].y.toFixed(1);}
      return d;
    };

    const areaPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
      if (valid.length<2) return '';
      let d='M'+valid[0].x.toFixed(1)+','+ys(minY).toFixed(1)+' L'+valid[0].x.toFixed(1)+','+valid[0].y.toFixed(1);
      for(let i=1;i<valid.length;i++){const cp=(valid[i].x-valid[i-1].x)*0.35;d+=' C'+(valid[i-1].x+cp).toFixed(1)+','+valid[i-1].y.toFixed(1)+' '+(valid[i].x-cp).toFixed(1)+','+valid[i].y.toFixed(1)+' '+valid[i].x.toFixed(1)+','+valid[i].y.toFixed(1);}
      d+=' L'+valid[valid.length-1].x.toFixed(1)+','+ys(minY).toFixed(1)+' Z';
      return d;
    };

    const range=maxY-minY, tickStep=range<=12?2:range<=24?4:8;
    const ticks=[]; for(let v=Math.ceil(minY/tickStep)*tickStep;v<=maxY;v+=tickStep)ticks.push(v);
    const yTicks=ticks.map(v=>'<line x1="'+PAD.l+'" y1="'+ys(v).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(v).toFixed(1)+'" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="'+(PAD.l-8)+'" y="'+(ys(v)+4).toFixed(1)+'" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'+v+'</text>').join('');
    const xLabels=weeks.map((w,i)=>'<text x="'+xs(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'+(w.period_end?w.period_end.slice(5).replace('-','/'):'Wk'+w.week_num)+'</text>').join('');

    const caLabels=caS.map((v,i)=>{if(v==null)return '';const x=xs(i),y=ys(v);const above=y>PAD.t+16;return '<text x="'+x.toFixed(1)+'" y="'+(above?y-10:y+18).toFixed(1)+'" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">$'+v.toFixed(0)+'</text>';}).join('');

    const tCA  = t.check_avg||35;
    const uid  = 'rg'+Math.random().toString(36).slice(2,6);

    const fixMarks = (window.Recovery) ? Recovery.chartMarkers(weeks, 'revenue') : [];
    const fixMarkers = (window.FixPanel && fixMarks.length)
      ? FixPanel.markerSvg(fixMarks, xs, PAD.t, PAD.t + ch) : '';
    const fixLegend = fixMarks.length
      ? '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block;border:0.5px solid rgba(0,0,0,0.35);"></span>Fix Logged</span>'
      : '';

    return '<div class="chart-card" style="padding:20px 24px 16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:16px;flex-wrap:wrap;">'
      + '<div style="display:flex;align-items:center;gap:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>'
      + '<button class="btn btn-ghost btn-sm" id="r-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Trend Insights</button>'
      + '</div>'
      + '<div style="display:flex;gap:20px;flex-wrap:wrap;">'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:var(--gold);display:inline-block;border-radius:1px;"></span>Check Avg</span>'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:rgba(255,255,255,0.4);display:inline-block;border-radius:1px;"></span>Labor %</span>'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:rgba(255,255,255,0.2);display:inline-block;border-radius:1px;"></span>RPLH</span>'
      + fixLegend
      + '</div></div>'
      + '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;overflow:visible;">'
      + '<defs><linearGradient id="caGrad'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/></linearGradient></defs>'
      + yTicks
      + '<line x1="'+PAD.l+'" y1="'+ys(tCA).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(tCA).toFixed(1)+'" stroke="#DBAB46" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>'
      + '<text x="'+(W-PAD.r+6)+'" y="'+(ys(tCA)+4).toFixed(1)+'" fill="rgba(219,171,70,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>'
      + fixMarkers
      + (areaPath(caS)?'<path d="'+areaPath(caS)+'" fill="url(#caGrad'+uid+')"/>':'')
      + '<path d="'+smoothPath(rplhS)+'" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(labS)+'" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(caS)+'" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + caS.map((v,i)=>v!=null?'<circle cx="'+xs(i).toFixed(1)+'" cy="'+ys(v).toFixed(1)+'" r="4" fill="#0A1520" stroke="#DBAB46" stroke-width="2"/>':'').join('')
      + caLabels + xLabels
      + '</svg></div>';
  },

  showInsights() {
    if (App.demoBlock('AI Trend Insights')) return;
    const weeks = (App.data.revenue_weeks||[]).filter(w=>(w.bar_revenue||0)+(w.floor_revenue||0)>0).slice(-8);
    const showModal = (html) => {
      const m = document.createElement('div');
      m.className = 'ins-modal';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:580px;width:100%;max-height:80vh;overflow-y:auto;';
      box.innerHTML = html;
      m.appendChild(box);
      document.body.appendChild(m);
      m.onclick = ev => { if(ev.target===m) m.remove(); };
      box.querySelector('.ins-close')?.addEventListener('click', () => m.remove());
    };
    if (weeks.length < 2) {
      showModal('<div style="text-align:center;"><div style="font-size:13px;color:var(--t1);margin-bottom:16px;">Enter at least 2 weeks of data to generate trend insights.</div><button class="btn btn-ghost ins-close">OK</button></div>');
      return;
    }
    const btn = document.getElementById('r-insights-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    const t  = App.data.revenue_settings?.targets || {};
    const avg = arr => { const v = arr.filter(x=>x!=null); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0; };
    const caT = t.check_avg || 35;
    const lpT = ((t.bar_labor_pct||28)+(t.kitchen_labor_pct||30)+(t.floor_labor_pct||32))/3;
    const caVals  = weeks.map(w=>w.check_avg).filter(v=>v!=null);
    const lpVals  = weeks.map(w=>w.labor_pct_blended).filter(v=>v!=null);
    const revVals = weeks.map(w=>(w.bar_revenue||0)+(w.floor_revenue||0));
    const covVals = weeks.map(w=>w.covers).filter(v=>v!=null);
    const aCA = avg(caVals).toFixed(2);
    const aLP = avg(lpVals).toFixed(1);
    const aRev = avg(revVals).toFixed(0);
    const aCov = avg(covVals).toFixed(0);
    const caTrend = caVals.length>=3 ? (caVals[caVals.length-1]-caVals[0]>1 ? 'trending up (improving)' : caVals[0]-caVals[caVals.length-1]>1 ? 'trending down (worsening)' : 'holding steady') : 'early data';
    const lines = [
      'Check Average: '+weeks.map(w=>w.check_avg?'$'+w.check_avg.toFixed(2):'n/a').join(', ')+' (target:$'+caT+' avg:$'+aCA+')',
      'Check average trend: '+caTrend,
      'Labor %: '+weeks.map(w=>w.labor_pct_blended?w.labor_pct_blended.toFixed(1)+'%':'n/a').join(', ')+' (target:'+lpT.toFixed(1)+'% avg:'+aLP+'%)',
      'Avg weekly revenue: $'+aRev,
      'Avg covers/week: '+aCov,
      'Weekly check avg gap vs target: $'+Math.abs((parseFloat(aCA)-caT)*parseFloat(aCov)).toFixed(0)+' '+(parseFloat(aCA)<caT?'below target':'above target'),
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner. Write 3 short paragraphs, one insight each, based on the revenue and labor data below. Rules: no emdashes, no dashes used as punctuation, no bullet points, no headers, no AI language. Write the way an experienced operator talks to another operator. Plain sentences. Specific numbers. Direct about what needs to change and exactly what to do about it this week.\n\n'+lines.join('\n')+'\n\nLead with check average performance, then labor efficiency, then the single action that will move revenue most this week.';
    fetch('/api/claude', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-5', max_tokens:600, messages:[{role:'user', content:prompt}]})})
    .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(data => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      if (data.error) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">API error: '+data.error.message+'</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const text = data.content?.[0]?.text;
      if (!text) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">No response received. Try again.</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const header = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Trend Insights: Last '+weeks.length+' Weeks</div><button class="btn btn-ghost btn-sm ins-close">Close</button></div>';
      const body   = '<div style="font-size:13px;color:var(--t2);line-height:1.9;">'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</div><div style="font-size:13px;color:var(--t2);line-height:1.9;margin-top:14px;">')+'</div>';
      showModal(header+body);
    }).catch(err => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">Connection error: '+err.message+'. Check your connection and try again.</div><button class="btn btn-ghost ins-close">OK</button></div>');
    });
  }
};
