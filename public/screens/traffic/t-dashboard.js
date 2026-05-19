'use strict';
S.TrafficDashboard = {
  _dismissed: false,

  render(container, actions) {
    actions.innerHTML = '';
    const ts     = App.data.traffic_settings || {};
    const t      = ts.targets || {};
    const weeks  = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prior4 = weeks.slice(-5, -1);
    const avg4   = fn => { const v = prior4.map(fn).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };

    const googleRating  = latest?.google_rating  ?? null;
    const reviewVel     = latest?.new_reviews     ?? null;
    const responseRate  = latest?.response_rate   ?? null;
    const sessions      = latest?.monthly_sessions ?? null;
    const targetRating  = t.google_rating      ?? 4.3;
    const targetVel     = t.review_velocity    ?? 8;
    const targetResp    = t.response_rate      ?? 75;
    const targetSessions= t.monthly_sessions   ?? 2000;

    // Alert
    let alertHtml = '';
    if (latest && !this._dismissed) {
      if (googleRating != null && googleRating < 4.0) {
        alertHtml = '<div class="alert-bar" id="t-alert"><div class="alert-text">Google rating is ' + googleRating.toFixed(1) + '. Ratings below 4.0 cause guests to filter you out of search results. Review recovery is the first priority.</div><button class="alert-dismiss" id="t-dismiss">Close</button></div>';
      } else if (responseRate != null && responseRate < 50) {
        alertHtml = '<div class="alert-bar" id="t-alert"><div class="alert-text">Review response rate is ' + responseRate.toFixed(0) + '%. Target is 75%. Responding to reviews is a direct Google ranking signal.</div><button class="alert-dismiss" id="t-dismiss">Close</button></div>';
      }
    }

    // Start Here card
    const targetsSet = ts._targets_saved || false;
    let startHere = '';
    if (!targetsSet) {
      startHere = '<div class="card" style="margin-bottom:18px;border:1px solid rgba(201,168,76,0.35);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Start Here</div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:4px;">Set Your Traffic Targets</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-bottom:16px;">Numbers below are industry benchmarks. Adjust any target to match your operation. Click the info icon on each field to see what it means and when to change it.</div>'
        + '<div class="form-row" style="gap:12px 16px;margin-bottom:18px;flex-wrap:wrap;">'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Google Rating ' + tt('t-google-rating') + '</label><div class="fw"><input class="suf" type="number" id="tsh-gr" value="' + targetRating + '" step="0.1" min="1" max="5"/><span class="suf">★</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>New Reviews/Mo ' + tt('t-review-vel') + '</label><div class="fw"><input class="suf" type="number" id="tsh-rv" value="' + targetVel + '" step="1"/><span class="suf">/mo</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Response Rate ' + tt('t-response-rate') + '</label><div class="fw"><input class="suf" type="number" id="tsh-rr" value="' + targetResp + '" step="1"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Monthly Sessions ' + tt('t-monthly-sessions') + '</label><div class="fw"><input class="suf" type="number" id="tsh-ms" value="' + targetSessions + '" step="100"/><span class="suf">/mo</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Social Posts/Mo ' + tt('t-social-posts') + '</label><div class="fw"><input class="suf" type="number" id="tsh-sp" value="' + (t.social_posts_month??12) + '" step="1"/><span class="suf">posts</span></div></div>'
        + '</div>'
        + '<button class="btn btn-primary" id="tsh-save">Save and Continue</button>'
        + '</div>';
    }

    // Metric cards
    const trendHtml = (cur, avg, lowerBetter=false) => {
      if (avg==null||cur==null) return '<div class="metric-trend"> </div>';
      const diff = cur - avg;
      if (Math.abs(diff) < 0.05) return '<div class="metric-trend">flat</div>';
      const improving = lowerBetter ? diff < 0 : diff > 0;
      return '<div class="metric-trend ' + (improving?'trend-up':'trend-dn') + '">' + (diff>0?'↑':'↓') + ' vs 4wk avg</div>';
    };

    const metCard = (label, val, target, impact, trendEl, cls) => {
      const impHtml = impact != null
        ? '<div class="metric-impact ' + (impact > 0 ? 'neg' : 'pos') + '">' + (impact > 0 ? '+' : '') + impact + '</div>'
        : '<div class="metric-impact" style="color:var(--t4);">&mdash;</div>';
      const valHtml = val != null
        ? '<div class="metric-val ' + cls + '">' + val + '</div>'
        : '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';
      return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
        + valHtml
        + '<div class="metric-target">Target: ' + target + '</div>'
        + impHtml + trendEl + '</div>';
    };

    const grCls  = googleRating==null?'':googleRating>=targetRating?'on-target':'over-target';
    const rvCls  = reviewVel==null?'':reviewVel>=targetVel?'on-target':'over-target';
    const rrCls  = responseRate==null?'':responseRate>=targetResp?'on-target':'over-target';
    const ssCls  = sessions==null?'':sessions>=targetSessions?'on-target':'over-target';

    const avgGR  = avg4(w=>w.google_rating);
    const avgRV  = avg4(w=>w.new_reviews);

    const grImpact  = googleRating != null && googleRating < targetRating ? +(targetRating - googleRating).toFixed(1) : null;
    const rvImpact  = reviewVel != null && reviewVel < targetVel ? +(targetVel - reviewVel) : null;

    const metrics = '<div class="metric-grid">'
      + metCard('Google Rating',   googleRating!=null?googleRating.toFixed(1)+'★':null,   targetRating+'★',   grImpact!=null?grImpact+' stars below':null,  trendHtml(googleRating,avgGR), grCls)
      + metCard('New Reviews/Mo',  reviewVel!=null?reviewVel+' reviews':null,              targetVel+'/mo',    rvImpact!=null?rvImpact+' below target':null, trendHtml(reviewVel,avgRV),    rvCls)
      + metCard('Response Rate',   responseRate!=null?responseRate.toFixed(0)+'%':null,    targetResp+'%',     null,                                          trendHtml(responseRate,avg4(w=>w.response_rate)), rrCls)
      + metCard('Monthly Sessions',sessions!=null?sessions.toLocaleString():null,          targetSessions.toLocaleString()+'/mo', null,                      trendHtml(sessions,avg4(w=>w.monthly_sessions)), ssCls)
      + '</div>';

    // Chart
    const chartHtml = this.buildChart(weeks, t);

    // Trend Insights button
    const insBtn = document.createElement('button');
    insBtn.className = 'btn btn-ghost btn-sm';
    insBtn.id = 't-insights-btn';
    insBtn.textContent = 'Trend Insights';
    insBtn.addEventListener('click', () => this.showInsights());
    actions.appendChild(insBtn);

    // This Week Summary
    const prev = weeks.length > 1 ? weeks[weeks.length-2] : null;
    let summaryHtml = '';
    if (latest) {
      const row = (label, tw, lw, av) => '<tr><td>' + label + '</td><td class="val">' + (tw||' ') + '</td><td>' + (lw||' ') + '</td><td>' + (av||' ') + '</td></tr>';
      const a4 = fn => { const v = prior4.map(fn).filter(x=>x!=null&&!isNaN(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
      const p = v => v != null ? v.toFixed(1)+'%' : ' ';
      const r = v => v != null ? v.toFixed(1)+'★' : ' ';
      summaryHtml = '<div class="tbl-wrap" style="margin-bottom:18px;"><table class="sum-tbl">'
        + '<thead><tr><th></th><th>This Week</th><th>Last Week</th><th>4-Week Avg</th></tr></thead><tbody>'
        + row('Google Rating',   r(latest.google_rating),  prev?.google_rating?r(prev.google_rating):' ',  a4(w=>w.google_rating)?a4(w=>w.google_rating).toFixed(2)+'★':' ')
        + row('New Reviews',     latest.new_reviews??'  ', prev?.new_reviews??'  ',                         a4(w=>w.new_reviews)?Math.round(a4(w=>w.new_reviews))+'':' ')
        + row('Response Rate',   p(latest.response_rate),  prev?.response_rate?p(prev.response_rate):' ',  a4(w=>w.response_rate)?p(a4(w=>w.response_rate)):' ')
        + row('Sessions',        latest.monthly_sessions?latest.monthly_sessions.toLocaleString():' ', prev?.monthly_sessions?prev.monthly_sessions.toLocaleString():' ', a4(w=>w.monthly_sessions)?Math.round(a4(w=>w.monthly_sessions)).toLocaleString():' ')
        + row('IG Followers',    latest.ig_followers??' ',  prev?.ig_followers??' ',                        a4(w=>w.ig_followers)?Math.round(a4(w=>w.ig_followers))+'':' ')
        + '</tbody></table></div>';
    } else {
      summaryHtml = '<div class="card"><div class="empty"><div class="empty-title">No weeks saved yet</div><div class="empty-sub">Enter your first week to see your numbers here.</div></div></div>';
    }

    container.innerHTML = '<div class="screen">'
      + alertHtml
      + startHere
      + metrics
      + chartHtml
      + '<div class="sh">This Week Summary</div>'
      + summaryHtml
      + '<div class="sh">Quick Actions</div>'
      + '<div class="qa">'
      + '<button class="btn btn-primary" id="t-qa-week">Enter This Week</button>'
      + '<button class="btn btn-ghost" id="t-qa-audit">Traffic Audit</button>'
      + '<button class="btn btn-ghost" id="t-qa-reports">View Reports</button>'
      + '</div>'
      + '</div>';

    document.getElementById('t-dismiss')?.addEventListener('click', () => {
      this._dismissed = true;
      document.getElementById('t-alert')?.remove();
    });

    document.getElementById('tsh-save')?.addEventListener('click', async () => {
      const ts2 = App.data.traffic_settings || {};
      ts2.targets = {
        ...(ts2.targets || {}),
        google_rating:       parseFloat(document.getElementById('tsh-gr')?.value) || 4.3,
        review_velocity:     parseInt(document.getElementById('tsh-rv')?.value)   || 8,
        response_rate:       parseFloat(document.getElementById('tsh-rr')?.value) || 75,
        monthly_sessions:    parseInt(document.getElementById('tsh-ms')?.value)   || 2000,
        social_posts_month:  parseInt(document.getElementById('tsh-sp')?.value)   || 12,
      };
      ts2._targets_saved = true;
      const gs = App.data.getting_started_traffic || {};
      gs['tgs_targets'] = new Date().toISOString();
      App.data.getting_started_traffic = gs;
      await App.saveKey('traffic_settings');
      await App.saveKey('getting_started_traffic');
      App.navigate('t-getting-started');
    });

    document.getElementById('t-qa-week')?.addEventListener('click',    () => App.navigate('t-this-week'));
    document.getElementById('t-qa-audit')?.addEventListener('click',   () => App.navigate('t-audit'));
    document.getElementById('t-qa-reports')?.addEventListener('click', () => App.navigate('t-reports'));
  },


  showInsights() {
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
    fetch('/api/claude', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-5', max_tokens:600, messages:[{role:'user', content:prompt}]})})
    .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(data => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      if (data.error) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">API error: '+data.error.message+'</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const text = data.content?.[0]?.text;
      if (!text) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">No response received. Try again.</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const header = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Trend Insights: Last '+recent.length+' Weeks</div><button class="btn btn-ghost btn-sm ins-close">Close</button></div>';
      const body   = '<div style="font-size:13px;color:var(--t2);line-height:1.9;">'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</div><div style="font-size:13px;color:var(--t2);line-height:1.9;margin-top:14px;">')+'</div>';
      showModal(header+body);
    }).catch(err => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">Connection error: '+err.message+'. Check your connection and try again.</div><button class="btn btn-ghost ins-close">OK</button></div>');
    });
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

    return '<div class="chart-card" style="padding:20px 24px 16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>'
      + '<div style="display:flex;gap:16px;">'
      + '<span style="font-size:10px;color:var(--gold);font-weight:600;">  Google Rating</span>'
      + '<span style="font-size:10px;color:rgba(255,255,255,0.6);font-weight:600;">  Reviews/mo (÷10)</span>'
      + '<span style="font-size:10px;color:#4888A8;font-weight:600;">  Response % (÷10)</span>'
      + '</div></div>'
      + '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;" preserveAspectRatio="none">'
      + '<defs><linearGradient id="grGrad'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/><stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/></linearGradient></defs>'
      + yTicks
      + '<line x1="'+PAD.l+'" y1="'+ys(tGR).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(tGR).toFixed(1)+'" stroke="rgba(201,168,76,0.25)" stroke-width="1" stroke-dasharray="4,4"/>'
      + (areaPath(grS)?'<path d="'+areaPath(grS)+'" fill="url(#grGrad'+uid+')"/>':'')
      + '<path d="'+smoothPath(grS)+'" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(rvS)+'" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(rrS)+'" fill="none" stroke="#4888A8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + grLabels + xLabels
      + '</svg></div>';
  }
};
