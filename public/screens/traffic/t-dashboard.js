'use strict';
S.TrafficDashboard = {
  _dismissed: false,

  render(container, actions) {
    actions.innerHTML = '';
    const ts     = App.data.traffic_settings || {};
    const t      = ts.targets || {};
    const weeks  = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;

    const googleRating  = latest?.google_rating ?? null;
    const responseRate  = latest?.response_rate ?? null;

    // Trend Insights button lives in the 8-Week Trend chart header, not here.

    // Alert
    let alertHtml = '';
    if (latest && !this._dismissed) {
      if (googleRating != null && googleRating < 4.0) {
        alertHtml = '<div class="alert-bar" id="t-alert"><div class="alert-text">Google rating is ' + googleRating.toFixed(1) + '. Ratings below 4.0 cause guests to filter you out of search results. Review recovery is the first priority.</div><button class="alert-dismiss" id="t-dismiss">Close</button></div>';
      } else if (responseRate != null && responseRate < 50) {
        alertHtml = '<div class="alert-bar" id="t-alert"><div class="alert-text">Review response rate is ' + responseRate.toFixed(0) + '%. Target is 75%. Responding to reviews is a direct Google ranking signal.</div><button class="alert-dismiss" id="t-dismiss">Close</button></div>';
      }
    }

    // Setup nudging lives at the Hub level via the catch-up banner on the
    // Hub Dashboard. Recovery dashboards stay purely operational.

    // Live Links — one-click jumps to the operator's saved public platforms.
    // Reads from traffic_settings.urls (set in Hub Settings > Operation Links).
    // Only renders the strip if at least one URL is set; otherwise hidden so
    // the dashboard stays clean for operators who have not added links yet.
    const linksHtml = this.buildLiveLinks();

    // Chart — annotated 8-week trend
    const chartHtml = this.buildChart(weeks, t);

    // Priority Action Items — ranked by dollar impact from the latest Traffic audit
    const tAudits = App.data.traffic_audits || [];
    const latestAudit = tAudits.length ? tAudits[tAudits.length-1] : null;
    const actionItems = (latestAudit?.action_items || [])
      .filter(it => it && it.action)
      .slice()
      .sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0))
      .slice(0,5);

    const actionRows = actionItems.length
      ? actionItems.map((it,i) => {
          const gid = it.gap_id || (window.FixPanel ? FixPanel.inferGapId(it.action, 'traffic') : null);
          return '<div class="t-db-action" data-gap="' + esc(gid || '') + '" '
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
        + 'Run a Traffic Audit and your biggest-dollar opportunities will be ranked here.</div>';
    const actionHtml = '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Priority Action Items')
      + actionRows
      + '</div>';

    container.innerHTML = '<div class="screen">'
      + FixPanel.recoveryCard('traffic')
      + alertHtml
      + linksHtml
      + chartHtml
      + actionHtml
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Quick Actions')
      + '<div class="qa" style="padding:18px 20px;">'
      + '<button class="btn btn-primary" id="t-qa-week">Enter This Week</button>'
      + '<button class="btn btn-ghost" id="t-qa-audit">Traffic Audit</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    document.getElementById('t-dismiss')?.addEventListener('click', () => {
      this._dismissed = true;
      document.getElementById('t-alert')?.remove();
    });

    document.getElementById('t-qa-week')?.addEventListener('click',    () => App.navigate('t-this-week'));
    document.getElementById('t-qa-audit')?.addEventListener('click',   () => App.navigate('t-audit'));
    container.querySelectorAll('.t-db-action').forEach(row => {
      row.addEventListener('click', () => {
        if (row.dataset.gap) App._fixFocus = row.dataset.gap;
        App.navigate('t-fix');
      });
    });
    document.getElementById('t-insights-btn')?.addEventListener('click', () => this.showInsights());
    FixPanel.wireFixAreas(container);
  },

  showInsights() {
    if (App.demoBlock('AI Trend Insights')) return;
    const weeks = App.data.traffic_weeks || [];
    const showModal = (html) => {
      const m = document.createElement('div');
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
    const btn = document.getElementById('t-insights-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    const ts  = App.data.traffic_settings?.targets || {};
    const avg = arr => { const v = arr.filter(x=>x!=null); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0; };
    const recent = weeks.slice(-8);
    const grVals = recent.map(w=>w.google_rating).filter(v=>v!=null);
    const rvVals = recent.map(w=>w.new_reviews).filter(v=>v!=null);
    const rrVals = recent.map(w=>w.response_rate).filter(v=>v!=null);
    const ssVals = recent.map(w=>w.monthly_sessions).filter(v=>v!=null);
    const aGR = avg(grVals).toFixed(2);
    const aRV = avg(rvVals).toFixed(1);
    const aRR = avg(rrVals).toFixed(1);
    const aSS = Math.round(avg(ssVals));
    const grTrend = grVals.length>=3 ? (grVals[grVals.length-1]-grVals[0]>0.1?'trending up':grVals[0]-grVals[grVals.length-1]>0.1?'trending down':'holding steady') : 'early data';
    const lines = [
      'Google Rating: '+recent.map(w=>w.google_rating?w.google_rating.toFixed(1)+'\u2605':'n/a').join(', ')+' (target:'+ts.google_rating+'\u2605 avg:'+aGR+'\u2605)',
      'Rating trend: '+grTrend,
      'New reviews/mo: '+recent.map(w=>w.new_reviews??'n/a').join(', ')+' (target:'+ts.review_velocity+'/mo avg:'+aRV+')',
      'Response rate: '+recent.map(w=>w.response_rate?w.response_rate.toFixed(0)+'%':'n/a').join(', ')+' (target:'+ts.response_rate+'% avg:'+aRR+'%)',
      'Monthly sessions: '+recent.map(w=>w.monthly_sessions??'n/a').join(', ')+' (target:'+ts.monthly_sessions+' avg:'+aSS+')',
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner about their digital presence. Write 3 short paragraphs, one insight each, based on the data below. Rules: no emdashes, no dashes used as punctuation, no bullet points, no headers, no AI language. Write the way an experienced operator talks to another operator. Plain sentences. Specific numbers. Direct about what needs to change and exactly what to do about it this week.\n\n'+lines.join('\n')+'\n\nLead with Google rating and review velocity, then website traffic, then the single action that will have the most impact on local digital visibility this week.';
    fetch('/api/claude', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-6', max_tokens:600, messages:[{role:'user', content:prompt}]})})
    .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(data => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      if (data.error) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">API error: '+data.error.message+'</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const text = data.content?.[0]?.text;
      if (!text) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">No response received. Try again.</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const header = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Trend Insights: Last '+recent.length+' Weeks</div><button class="btn btn-ghost btn-sm ins-close">Close</button></div>';
      const clean  = text.replace(/—/g,', ').replace(/–/g,'-').replace(/ -- /g,', ').replace(/--/g,'-');
      const body   = '<div style="font-size:13px;color:var(--t2);line-height:1.9;">'+clean.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</div><div style="font-size:13px;color:var(--t2);line-height:1.9;margin-top:14px;">')+'</div>';
      showModal(header+body);
    }).catch(err => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">Connection error: '+err.message+'. Check your connection and try again.</div><button class="btn btn-ghost ins-close">OK</button></div>');
    });
  },

  /* Live Links card — one-click jumps to the operator's saved public platforms.
     Only renders entries for URLs that are actually set in traffic_settings.urls
     (Operation Links in Hub Settings). If none are set, returns empty so the
     card stays hidden. Platform list drives off App.TRAFFIC_PLATFORMS. */
  buildLiveLinks() {
    const urls = (App.data.traffic_settings && App.data.traffic_settings.urls) || {};
    const items = App.TRAFFIC_PLATFORMS
      .map(p => ({ key: p.key, label: p.label, u: urls[p.urlKey] }))
      .filter(x => x.u && x.u.trim());

    if (!items.length) return '';

    const btns = items.map(x =>
      '<a href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer" '
      + 'class="btn btn-ghost btn-sm" '
      + 'style="font-size:10px;padding:5px 12px;letter-spacing:0.5px;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">'
      +   esc(x.label)
      +   '<svg width="9" height="9" viewBox="0 0 9 9" fill="none" style="opacity:0.6;"><path d="M2 2h5v5M7 2L2 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '</a>'
    ).join('');

    return '<div class="card" style="padding:14px 20px;margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);flex-shrink:0;">Live Links</div>'
      +   '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + btns + '</div>'
      + '</div>'
      + '</div>';
  },

  buildChart(weeks, t) {
    if (weeks.length < 2) return '<div class="chart-card" style="padding:24px 24px 20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Trend</div>'
      + '<div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>';

    const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
    const last8 = weeks.slice(-8);

    const grS   = last8.map(w=>w.google_rating??null);
    const rvS   = last8.map(w=>w.new_reviews??null);
    const rrS   = last8.map(w=>w.response_rate!=null?w.response_rate/10:null); // scale /10 to plot alongside rating
    const allV  = [...grS,...rvS,...rrS].filter(v=>v!=null);
    if (!allV.length) return '';

    const minY = Math.max(0, Math.floor(Math.min(...allV)-1));
    const maxY = Math.ceil(Math.max(...allV)+2);
    const xs = i => PAD.l + (last8.length>1 ? (i/(last8.length-1))*cw : cw/2);
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

    const range=maxY-minY, tickStep=range<=6?1:range<=12?2:range<=24?4:8;
    const ticks=[]; for(let v=Math.ceil(minY/tickStep)*tickStep;v<=maxY;v+=tickStep)ticks.push(v);
    const yTicks=ticks.map(v=>'<line x1="'+PAD.l+'" y1="'+ys(v).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(v).toFixed(1)+'" stroke="rgba(255,255,255,0.04)"/><text x="'+(PAD.l-6)+'" y="'+(ys(v)+4).toFixed(1)+'" text-anchor="end" fill="var(--t4)" font-family="Barlow,sans-serif" font-size="9">'+v+'</text>').join('');
    const xLabels=last8.map((w,i)=>'<text x="'+xs(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'+(w.period_end?w.period_end.slice(5).replace('-','/'):'Wk'+w.week_num)+'</text>').join('');

    const grLabels=grS.map((v,i)=>{if(v==null)return '';const x=xs(i),y=ys(v);const above=y>PAD.t+16;return '<text x="'+x.toFixed(1)+'" y="'+(above?y-10:y+18).toFixed(1)+'" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">'+v.toFixed(1)+'★</text>';}).join('');

    const tGR  = (t.google_rating||4.3);
    const uid  = 'tg'+Math.random().toString(36).slice(2,6);

    const fixMarks = (window.Recovery) ? Recovery.chartMarkers(last8, 'traffic') : [];
    const fixMarkers = (window.FixPanel && fixMarks.length)
      ? FixPanel.markerSvg(fixMarks, xs, PAD.t, PAD.t + ch) : '';
    const fixLegend = fixMarks.length
      ? '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block;border:0.5px solid rgba(0,0,0,0.35);"></span>Fix Logged</span>'
      : '';

    return '<div class="chart-card" style="padding:20px 24px 16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:16px;flex-wrap:wrap;">'
      + '<div style="display:flex;align-items:center;gap:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>'
      + '<button class="btn btn-ghost btn-sm" id="t-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Trend Insights</button>'
      + '</div>'
      + '<div style="display:flex;gap:20px;flex-wrap:wrap;">'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:var(--gold);display:inline-block;border-radius:1px;"></span>Google Rating</span>'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:rgba(255,255,255,0.55);display:inline-block;border-radius:1px;"></span>Reviews/mo (÷10)</span>'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:var(--blue);display:inline-block;border-radius:1px;"></span>Response % (÷10)</span>'
      + fixLegend
      + '</div></div>'
      + '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;" preserveAspectRatio="none">'
      + '<defs><linearGradient id="grGrad'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0"/></linearGradient></defs>'
      + yTicks
      + '<line x1="'+PAD.l+'" y1="'+ys(tGR).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(tGR).toFixed(1)+'" stroke="rgba(219,171,70,0.25)" stroke-width="1" stroke-dasharray="4,4"/>'
      + fixMarkers
      + (areaPath(grS)?'<path d="'+areaPath(grS)+'" fill="url(#grGrad'+uid+')"/>':'')
      + '<path d="'+smoothPath(grS)+'" fill="none" stroke="#DBAB46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(rvS)+'" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(rrS)+'" fill="none" stroke="#4C8EAB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + grLabels + xLabels
      + '</svg></div>';
  }
};
