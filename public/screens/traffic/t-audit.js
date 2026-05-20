'use strict';
S.TrafficAudit = {
  _view: null, // null = list, number = index of audit being viewed

  render(container, actions) {
    this.container = container;
    this.actions   = actions;
    actions.innerHTML = '';
    this._view = null;
    this.renderMain();
  },

  renderMain() {
    this._view = null;
    this.actions.innerHTML = '';
    const audits       = (App.data.traffic_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest       = audits[0] || null;
    const now          = new Date();
    const thisMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft     = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Traffic Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive traffic audit per month. Upload screenshots of your Google Business Profile, website analytics, social media pages, and delivery platforms. Your scored audit appears on screen immediately. Print or save it as a PDF from your browser.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="ta-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
      + '</div></div>';

    // Score summary card for latest
    let latestCard = '';
    if (latest) {
      const prev = audits[1] || null;
      const scoreColor = latest.overall_score >= 80 ? 'var(--gold)' : latest.overall_score >= 60 ? 'var(--t1)' : 'var(--red)';
      const scoreLabel = latest.overall_score >= 80 ? 'Strong' : latest.overall_score >= 60 ? 'Moderate' : 'Needs Work';
      let progressBanner = '';
      if (prev) {
        const diff = (latest.overall_score||0) - (prev.overall_score||0);
        progressBanner = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:3px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">vs Previous Audit</div>'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:' + (diff>=0?'var(--gold)':'var(--red)') + ';">' + (diff>=0?'+':'') + diff + ' pts</div>'
          + '<div style="font-size:12px;color:var(--t2);">' + prev.overall_score + ' to ' + latest.overall_score + '</div>'
          + '</div>';
      }
      const sections = latest.sections || {};
      const sectionRows = Object.entries(sections).map(([name, score]) => {
        const ps   = audits[1]?.sections?.[name];
        const diff = ps != null ? score - ps : null;
        const bar  = Math.min(100, Math.max(0, score));
        return '<tr>'
          + '<td style="color:var(--t1);padding:8px 12px;">' + esc(name) + '</td>'
          + '<td style="padding:8px 12px;width:140px;"><div style="background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+bar+'%;background:'+(score>=70?'var(--gold)':score>=50?'rgba(255,200,0,0.6)':'var(--red)')+';border-radius:3px;"></div></div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:'+(score>=70?'var(--gold)':score>=50?'var(--t1)':'var(--red)')+';padding:8px 12px;">' + score + '</td>'
          + (diff != null ? '<td style="font-size:12px;color:'+(diff>=0?'var(--gold)':'var(--red)')+';padding:8px 12px;">'+(diff>=0?'+':'')+diff+'</td>' : '<td></td>')
          + '</tr>';
      }).join('');

      const actionItems = (latest.action_items || []).slice(0,5).map((a,i) =>
        '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:var(--t3);width:24px;flex-shrink:0;">' + (i+1) + '</div>'
        + '<div style="flex:1;"><div style="font-size:12px;color:var(--t1);line-height:1.5;">' + esc(a.action||a) + '</div>'
        + (a.monthly_impact ? '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-top:2px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
        + '</div></div>'
      ).join('');

      latestCard = '<div class="card" style="margin-bottom:16px;">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--b2);flex-wrap:wrap;gap:10px;">'
        + '<div>'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Traffic Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '  ' + esc(latest.audit_period) : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + '<button class="btn btn-ghost btn-sm ta-view-btn" data-idx="0">View Full Audit</button>'
        + '</div>'
        + '</div>'
        + progressBanner
        + (sectionRows ? '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">'
          + '<thead><tr>'
          + '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Section</th>'
          + '<th style="width:140px;padding:6px 12px;border-bottom:1px solid var(--b2);"></th>'
          + '<th style="width:60px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Score</th>'
          + (audits[1] ? '<th style="width:70px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Change</th>' : '<th></th>')
          + '</tr></thead><tbody>' + sectionRows + '</tbody></table>' : '')
        + (actionItems ? '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Top Action Items by Impact</div>' + actionItems : '')
        + '</div>';
    }

    // History card
    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.map((a,i) => {
        const p    = audits[i+1];
        const diff = p ? (a.overall_score||0) - (p.overall_score||0) : null;
        const tier = a.grade || '';
        const tierBadge = tier
          ? '<span style="background:' + (tier.includes('3')||tier.toLowerCase().includes('full')?'var(--gold)':tier.includes('2')||tier.toLowerCase().includes('standard')?'rgba(255,200,0,0.3)':'var(--b1)') + ';color:' + (tier.includes('3')||tier.toLowerCase().includes('full')?'#000':'var(--t2)') + ';font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 7px;border-radius:2px;">' + esc(tier) + '</span>'
          : '';
        return '<tr>'
          + '<td>' + (a.date||'').slice(0,10) + '</td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + ((a.overall_score||0)>=70?'var(--gold)':(a.overall_score||0)>=50?'var(--t1)':'var(--red)') + ';">' + (a.overall_score||0) + '</td>'
          + (diff != null ? '<td style="color:' + (diff>=0?'var(--gold)':'var(--red)') + ';">' + (diff>=0?'+':'') + diff + ' pts</td>' : '<td></td>')
          + '<td>' + tierBadge + '</td>'
          + '<td><button class="btn btn-ghost btn-sm ta-view-btn" data-idx="' + i + '" style="font-size:10px;padding:4px 10px;">View</button></td>'
          + '</tr>';
      }).join('');
      historyCard = '<div class="card">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Audit History</div>'
        + '<div style="font-size:11px;color:var(--t3);">Last 12 months stored. Print any audit to save as PDF.</div>'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Score</th><th>Change</th><th>Data Quality</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '</div>';
    }

    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first monthly Traffic Audit above. Upload your screenshots and the audit appears on screen immediately.</div></div>'
      : '';



    let scoreChart = '';
    if (audits.length >= 2) scoreChart = this.renderScoreChart(audits, 'ta');

    let comparison = '';
    if (audits.length >= 2) comparison = this.renderComparison(audits[0], audits[1]);

    let sparklines = '';
    if (audits.length >= 3) sparklines = this.renderSparklines(audits);

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + scoreChart + comparison + sparklines + historyCard + '</div>';

    document.getElementById('ta-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.ta-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx)));
    });
  },

  renderScoreChart(audits, prefix) {
    const sorted = audits.slice().sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
    const W=700, H=180, PAD={t:24,r:20,b:36,l:40};
    const cw = W-PAD.l-PAD.r, ch = H-PAD.t-PAD.b;
    const scores = sorted.map(a => a.overall_score||0);
    const minY = Math.max(0, Math.min(...scores) - 10);
    const maxY = Math.min(100, Math.max(...scores) + 10);
    const xs = i => PAD.l + (sorted.length > 1 ? (i/(sorted.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY||1))*ch;
    const smoothPath = pts => {
      const valid = pts.map((v,i) => v!=null ? {x:xs(i),y:ys(v)} : null).filter(Boolean);
      if (valid.length < 2) return valid.length===1 ? `M${valid[0].x},${valid[0].y}` : '';
      let d = `M${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)}`;
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ` C${(valid[i-1].x+cp).toFixed(1)},${valid[i-1].y.toFixed(1)} ${(valid[i].x-cp).toFixed(1)},${valid[i].y.toFixed(1)} ${valid[i].x.toFixed(1)},${valid[i].y.toFixed(1)}`;
      }
      return d;
    };
    const areaPath = pts => {
      const valid = pts.map((v,i) => v!=null ? {x:xs(i),y:ys(v)} : null).filter(Boolean);
      if (valid.length < 2) return '';
      let d = `M${valid[0].x.toFixed(1)},${ys(minY).toFixed(1)} L${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)}`;
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ` C${(valid[i-1].x+cp).toFixed(1)},${valid[i-1].y.toFixed(1)} ${(valid[i].x-cp).toFixed(1)},${valid[i].y.toFixed(1)} ${valid[i].x.toFixed(1)},${valid[i].y.toFixed(1)}`;
      }
      d += ` L${valid[valid.length-1].x.toFixed(1)},${ys(minY).toFixed(1)} Z`;
      return d;
    };
    const ticks = [minY, Math.round((minY+maxY)/2), maxY].filter((v,i,a) => a.indexOf(v)===i);
    const uid = prefix + 'sc' + Math.random().toString(36).slice(2,6);
    const linePath = smoothPath(scores);
    const fillPath = areaPath(scores);
    const xLabels  = sorted.map((a,i) =>
      `<text x="${xs(i).toFixed(1)}" y="${H-4}" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${(a.date||'').slice(0,7)}</text>`
    ).join('');
    const dots = sorted.map((a,i) => {
      const v = a.overall_score||0;
      const col = v>=80?'#C9A84C':v>=60?'rgba(255,255,255,0.8)':'#c0392b';
      return `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="5" fill="#0A1520" stroke="${col}" stroke-width="2.5"/>
        <text x="${xs(i).toFixed(1)}" y="${(ys(v)-10).toFixed(1)}" text-anchor="middle" fill="${col}" font-family="'Barlow Condensed',sans-serif" font-size="13" font-weight="700">${v}</text>`;
    }).join('');
    return '<div class="card" style="margin-bottom:16px;padding:20px 24px 16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Traffic Score History</div>'
      + `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">`
      + `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/><stop offset="100%" stop-color="#C9A84C" stop-opacity="0.01"/></linearGradient></defs>`
      + ticks.map(v => `<line x1="${PAD.l}" y1="${ys(v).toFixed(1)}" x2="${W-PAD.r}" y2="${ys(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="${PAD.l-6}" y="${(ys(v)+4).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${Math.round(v)}</text>`).join('')
      + (fillPath ? `<path d="${fillPath}" fill="url(#${uid})"/>` : '')
      + (linePath ? `<path d="${linePath}" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : '')
      + dots + xLabels
      + '</svg></div>';
  },

  renderComparison(curr, prev) {
    const cs = curr.sections || {};
    const ps = prev.sections || {};
    const allNames = [...new Set([...Object.keys(cs), ...Object.keys(ps)])];
    const rows = allNames.map(name => {
      const cv = cs[name] ?? null;
      const pv = ps[name] ?? null;
      const diff = (cv != null && pv != null) ? cv - pv : null;
      const arrow = diff == null ? '' : diff > 0
        ? '<span style="color:var(--gold);font-weight:700;">&#9650; +' + diff + '</span>'
        : diff < 0
        ? '<span style="color:var(--red);font-weight:700;">&#9660; ' + diff + '</span>'
        : '<span style="color:var(--t3);">&#8212;</span>';
      const col = (v) => v==null?'':v>=70?'var(--gold)':v>=50?'var(--t1)':'var(--red)';
      return '<tr>'
        + '<td style="padding:9px 12px;font-size:12px;color:var(--t2);">' + esc(name) + '</td>'
        + '<td style="padding:9px 12px;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:' + col(pv) + ';">' + (pv??'--') + '</td>'
        + '<td style="padding:9px 12px;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:' + col(cv) + ';">' + (cv??'--') + '</td>'
        + '<td style="padding:9px 12px;text-align:center;font-size:13px;">' + arrow + '</td>'
        + '</tr>';
    }).join('');
    const overallDiff = (curr.overall_score||0) - (prev.overall_score||0);
    return '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Audit Comparison</div>'
      + '<div style="display:flex;gap:24px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<div><div style="font-size:10px;color:var(--t3);margin-bottom:2px;">' + esc((prev.date||'').slice(0,7)) + (prev.grade?' &nbsp;&middot;&nbsp;' + esc(prev.grade):'') + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:' + ((prev.overall_score||0)>=70?'var(--gold)':(prev.overall_score||0)>=50?'var(--t1)':'var(--red)') + ';">' + (prev.overall_score||0) + '</div></div>'
      + '<div style="display:flex;align-items:center;padding:0 8px;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:' + (overallDiff>=0?'var(--gold)':'var(--red)') + ';">' + (overallDiff>=0?'+':'') + overallDiff + ' pts</div></div>'
      + '<div><div style="font-size:10px;color:var(--t3);margin-bottom:2px;">' + esc((curr.date||'').slice(0,7)) + (curr.grade?' &nbsp;&middot;&nbsp;' + esc(curr.grade):'') + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:' + ((curr.overall_score||0)>=70?'var(--gold)':(curr.overall_score||0)>=50?'var(--t1)':'var(--red)') + ';">' + (curr.overall_score||0) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th style="text-align:left;">Section</th><th style="text-align:center;">' + esc((prev.date||'').slice(0,7)) + '</th><th style="text-align:center;">' + esc((curr.date||'').slice(0,7)) + '</th><th style="text-align:center;">Change</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  },

  renderSparklines(audits) {
    const sorted = audits.slice().sort((a,b) => new Date(a.date||0) - new Date(b.date||0)).slice(-6);
    const latest = sorted[sorted.length-1];
    const allNames = Object.keys(latest.sections||{});
    if (!allNames.length) return '';
    const W=120, H=40, PAD=4;
    const spark = (values) => {
      const valid = values.filter(v => v != null);
      if (valid.length < 2) return '';
      const minV = Math.min(...valid), maxV = Math.max(...valid);
      const range = maxV - minV || 1;
      const pts = values.map((v,i) => {
        if (v == null) return null;
        const x = PAD + (i/(values.length-1))*(W-PAD*2);
        const y = H - PAD - ((v-minV)/range)*(H-PAD*2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).filter(Boolean);
      return pts.length >= 2 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    };
    const tiles = allNames.map(name => {
      const values = sorted.map(a => (a.sections||{})[name] ?? null);
      const curr   = values[values.length-1] ?? 0;
      const prev   = values.slice(0,-1).reverse().find(v => v != null) ?? null;
      const diff   = prev != null ? curr - prev : null;
      const col    = curr>=70?'var(--gold)':curr>=50?'var(--t1)':'var(--red)';
      return '<div style="flex:1;min-width:140px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:10px 12px;">'
        + '<div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:4px;letter-spacing:0.5px;">' + esc(name) + '</div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:' + col + ';line-height:1;">' + curr + '</div>'
        + (diff != null ? '<div style="font-size:11px;font-weight:700;color:' + (diff>0?'var(--gold)':diff<0?'var(--red)':'var(--t3)') + ';">' + (diff>0?'+':'') + diff + '</div>' : '')
        + '</div>'
        + `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;">`
        + `<line x1="4" y1="${(H/2).toFixed(1)}" x2="${W-4}" y2="${(H/2).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`
        + spark(values)
        + (values[values.length-1] != null ? (() => {
            const valid = values.filter(v=>v!=null);
            const minV=Math.min(...valid), maxV=Math.max(...valid), range=maxV-minV||1;
            const lx = PAD + ((values.length-1)/(values.length-1))*(W-PAD*2);
            const ly = H - PAD - ((values[values.length-1]-minV)/range)*(H-PAD*2);
            return `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="#0A1520" stroke="#C9A84C" stroke-width="2"/>`;
          })() : '')
        + '</svg>'
        + '</div>';
    }).join('');
    return '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Section Trends  <span style="font-weight:400;letter-spacing:0;text-transform:none;font-size:10px;color:var(--t3);">Last ' + sorted.length + ' audits</span></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:10px;">' + tiles + '</div>'
      + '</div>';
  },

  viewAudit(idx) {
    const audits = (App.data.traffic_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;
    this._view = idx;

    // Add Print button to topbar actions
    this.actions.innerHTML = '';
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Print / Save PDF';
    printBtn.onclick = () => window.print();
    this.actions.appendChild(printBtn);
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-ghost btn-sm';
    backBtn.textContent = '← Back';
    backBtn.style.marginRight = '8px';
    backBtn.onclick = () => this.renderMain();
    this.actions.insertBefore(backBtn, printBtn);

    const d = audit.raw || audit;
    const scoreColor = (audit.overall_score||0) >= 80 ? '#C9A84C' : (audit.overall_score||0) >= 60 ? '#fff' : '#c0392b';

    const sectionBlock = (num, name, score, items) => {
      const bar = Math.min(100, Math.max(0, score||0));
      const color = (score||0) >= 70 ? 'var(--gold)' : (score||0) >= 50 ? 'var(--t1)' : 'var(--red)';
      const rows = items.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([label,val]) =>
        '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<td style="padding:7px 0;font-size:11px;color:var(--t3);width:55%;">' + label + '</td>'
        + '<td style="padding:7px 0;font-size:11px;color:var(--t1);font-weight:600;">' + val + '</td>'
        + '</tr>'
      ).join('');
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:42px;font-weight:700;color:' + color + ';line-height:1;">' + (score||0) + '</div>'
        + '<div style="background:var(--b2);height:5px;border-radius:3px;width:80px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + color + ';border-radius:3px;"></div></div>'
        + '</div></div>'
        + (rows ? '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>' : '')
        + '</div>';
    };

    const yN = v => v ? 'Yes' : 'No';
    const pct = v => v != null ? v + '%' : '';
    const num = v => v != null ? String(v) : '';
    const dol = v => v ? App.fmtCurrency(v) : '';

    const sections = [
      sectionBlock(1, 'Google Business Profile', d.S1_SCORE, [
        ['Listing Claimed and Verified', yN(d.S1_LISTING_CLAIMED)],
        ['Hours Complete', yN(d.S1_HOURS_COMPLETE)],
        ['Website Linked', yN(d.S1_WEBSITE_LINKED)],
        ['Menu Link Active', yN(d.S1_MENU_LINK_ACTIVE)],
        ['Photo Count', num(d.S1_PHOTO_COUNT) + (d.S1_PHOTO_BENCHMARK ? ' (Benchmark: ' + d.S1_PHOTO_BENCHMARK + ')' : '')],
        ['Google Posts Last 30 Days', num(d.S1_POSTS_LAST_30_DAYS) + (d.S1_POSTS_BENCHMARK ? ' (Benchmark: ' + d.S1_POSTS_BENCHMARK + ')' : '')],
        ['Profile Completeness', pct(d.S1_PROFILE_COMPLETENESS_PCT)],
        ['Monthly Gap', dol(d.S1_MONTHLY_GAP)],
      ]),
      sectionBlock(2, 'Website', d.S2_SCORE, [
        ['Website Exists and Mobile Optimized', yN(d.S2_MOBILE_OPTIMIZED)],
        ['Monthly Sessions', num(d.S2_MONTHLY_SESSIONS) + (d.S2_SESSIONS_BENCHMARK ? ' (Benchmark: ' + d.S2_SESSIONS_BENCHMARK + ')' : '')],
        ['Bounce Rate', pct(d.S2_BOUNCE_RATE) + (d.S2_BOUNCE_BENCHMARK ? ' (Benchmark: under ' + d.S2_BOUNCE_BENCHMARK + '%)' : '')],
        ['Menu Page in Top 3', yN(d.S2_MENU_PAGE_IN_TOP_3)],
        ['Online Ordering Present', yN(d.S2_ONLINE_ORDERING_PRESENT)],
        ['Monthly Gap', dol(d.S2_MONTHLY_GAP)],
      ]),
      sectionBlock(3, 'Reviews', d.S3_SCORE, [
        ['Google Rating', d.S3_GOOGLE_RATING ? d.S3_GOOGLE_RATING + '★' + (d.S3_GOOGLE_RATING_BENCHMARK ? ' (Benchmark: ' + d.S3_GOOGLE_RATING_BENCHMARK + '★)' : '') : ''],
        ['Google Review Count', num(d.S3_GOOGLE_REVIEW_COUNT)],
        ['Response Rate', pct(d.S3_RESPONSE_RATE) + (d.S3_RESPONSE_BENCHMARK ? ' (Benchmark: ' + d.S3_RESPONSE_BENCHMARK + '%)' : '')],
        ['Most Recent Review', d.S3_MOST_RECENT_REVIEW_DAYS != null ? d.S3_MOST_RECENT_REVIEW_DAYS + ' days ago' : ''],
        ['Yelp Rating', d.S3_YELP_RATING ? d.S3_YELP_RATING + '★' : ''],
        ['Unanswered Reviews', num(d.S3_UNANSWERED)],
        ['Negative Pattern', d.S3_NEGATIVE_PATTERN || ''],
        ['Monthly Gap', dol(d.S3_MONTHLY_GAP)],
      ]),
      sectionBlock(4, 'Search and SEO', d.S4_SCORE, [
        ['In Google Maps 3-Pack', yN(d.S4_MAPS_PACK_CONFIRMED)],
        ['NAP Consistent', yN(d.S4_NAP_CONSISTENT)],
        ['Business Name', d.S4_NAP_BUSINESS_NAME || ''],
        ['Primary Keyword', d.S4_PRIMARY_KEYWORD || ''],
      ]),
      sectionBlock(5, 'Social Media', d.S5_SCORE, [
        ['Instagram Followers', num(d.S5_IG_FOLLOWERS)],
        ['IG Posts Last 30 Days', num(d.S5_IG_POSTS_LAST_30) + (d.S5_IG_POSTS_BENCHMARK ? ' (Benchmark: ' + d.S5_IG_POSTS_BENCHMARK + ')' : '')],
        ['Facebook Followers', num(d.S5_FB_FOLLOWERS)],
        ['Content Type', d.S5_CONTENT_TYPE || ''],
        ['Monthly Gap', dol(d.S5_MONTHLY_GAP)],
      ]),
      sectionBlock(6, 'Delivery Platforms', d.S6_SCORE, [
        ['DoorDash Active', yN(d.S6_DOORDASH_ACTIVE)],
        ['Uber Eats Active', yN(d.S6_UBEREATS_ACTIVE)],
        ['Grubhub Active', yN(d.S6_GRUBHUB_ACTIVE)],
        ['DoorDash Rating', d.S6_DOORDASH_RATING ? d.S6_DOORDASH_RATING + '★' : ''],
        ['Uber Eats Rating', d.S6_UBEREATS_RATING ? d.S6_UBEREATS_RATING + '★' : ''],
        ['Photo Count', num(d.S6_PHOTO_COUNT_DELIVERY)],
        ['Menu Complete', yN(d.S6_MENU_COMPLETE)],
        ['Promotion Active', yN(d.S6_PROMO_ACTIVE)],
        ['Monthly Gap', dol(d.S6_MONTHLY_GAP)],
      ]),
      sectionBlock(7, 'Email and Loyalty', d.S7_SCORE, [
        ['Email List Exists', yN(d.S7_EMAIL_LIST_EXISTS)],
        ['List Size', d.S7_LIST_SIZE ? num(d.S7_LIST_SIZE) + (d.S7_LIST_BENCHMARK ? ' (Benchmark: ' + d.S7_LIST_BENCHMARK + ')' : '') : ''],
        ['Last Send', d.S7_LAST_SEND_DAYS_AGO != null ? d.S7_LAST_SEND_DAYS_AGO + ' days ago' : ''],
        ['Send Frequency', d.S7_SEND_FREQUENCY || ''],
        ['Open Rate', d.S7_OPEN_RATE ? pct(d.S7_OPEN_RATE) + (d.S7_OPEN_BENCHMARK ? ' (Benchmark: ' + d.S7_OPEN_BENCHMARK + '%)' : '') : ''],
        ['Growth Mechanism', d.S7_GROWTH_MECHANISM || ''],
        ['Loyalty Program', yN(d.S7_LOYALTY_PROGRAM)],
        ['Monthly Gap', dol(d.S7_MONTHLY_GAP)],
      ]),
    ].join('');

    const actionItems = (audit.action_items || []).map((a,i) =>
      '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;">' + (i+1) + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(a.action||a) + '</div>'
      + (a.monthly_impact ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:4px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
      + '</div></div>'
    ).join('');

    this.container.innerHTML = '<div class="screen" id="ta-audit-view">'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Traffic Recovery Audit</div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + (audit.date||'').slice(0,10)
        + (audit.audit_period ? '  |  ' + esc(audit.audit_period) : '')
        + (audit.audit_id ? '  |  ' + esc(audit.audit_id) : '')
        + '</div>'
      + (audit.grade ? '<div style="margin-top:8px;"><span style="background:' + (audit.grade.includes('3')||audit.grade.toLowerCase().includes('full')?'var(--gold)':audit.grade.includes('2')||audit.grade.toLowerCase().includes('standard')?'rgba(255,200,0,0.3)':'var(--b1)') + ';color:' + (audit.grade.includes('3')||audit.grade.toLowerCase().includes('full')?'#000':'var(--t2)') + ';font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:2px;">' + esc(audit.grade) + '</span></div>' : '')
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Digital Presence Score</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:72px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (audit.overall_score||0) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">Industry Avg: ' + (d.INDUSTRY_AVG||58) + '  |  Target: ' + (d.TARGET_SCORE||65) + '</div>'
      + '</div>'
      + '</div>'
      + (d.WEEKLY_GAP_AMT ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);font-size:13px;color:var(--t2);">Estimated Weekly Gap: <strong style="color:var(--gold);">' + esc(String(d.WEEKLY_GAP_AMT)) + '</strong></div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:0;border-bottom:1px solid var(--b2);margin-bottom:16px;">'
      + '<button id="ta-tab-scores" style="background:none;border:none;border-bottom:2px solid var(--gold);color:var(--t1);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:10px 18px;cursor:pointer;letter-spacing:0.5px;">Scores</button>'
      + '<button id="ta-tab-narrative" style="background:none;border:none;border-bottom:2px solid transparent;color:var(--t3);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:10px 18px;cursor:pointer;letter-spacing:0.5px;">Findings</button>'
      + '</div>'
      + '<div id="ta-tab-scores-content">'
      + (actionItems ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Action Items -- Ranked by Impact</div>'
        + actionItems + '</div>' : '')
      + sections
      + '</div>'
      + '<div id="ta-tab-narrative-content" style="display:none;">'
      + this.renderNarrative(d)
      + '</div>'
      + '</div>';

    document.getElementById('ta-tab-scores')?.addEventListener('click', () => {
      document.getElementById('ta-tab-scores-content').style.display = '';
      document.getElementById('ta-tab-narrative-content').style.display = 'none';
      document.getElementById('ta-tab-scores').style.borderBottomColor = 'var(--gold)';
      document.getElementById('ta-tab-scores').style.color = 'var(--t1)';
      document.getElementById('ta-tab-narrative').style.borderBottomColor = 'transparent';
      document.getElementById('ta-tab-narrative').style.color = 'var(--t3)';
    });
    document.getElementById('ta-tab-narrative')?.addEventListener('click', () => {
      document.getElementById('ta-tab-scores-content').style.display = 'none';
      document.getElementById('ta-tab-narrative-content').style.display = '';
      document.getElementById('ta-tab-narrative').style.borderBottomColor = 'var(--gold)';
      document.getElementById('ta-tab-narrative').style.color = 'var(--t1)';
      document.getElementById('ta-tab-scores').style.borderBottomColor = 'transparent';
      document.getElementById('ta-tab-scores').style.color = 'var(--t3)';
    });
  },

  renderNarrative(d) {
    const sections = [
      { num:1, name:'Google Business Profile', fields: ['S1_EVIDENCE','S1_GAP','S1_TOOL','S1_NARRATIVE','S1_FINDING'] },
      { num:2, name:'Website',                 fields: ['S2_EVIDENCE','S2_GAP','S2_TOOL','S2_NARRATIVE','S2_FINDING'] },
      { num:3, name:'Reviews',                 fields: ['S3_EVIDENCE','S3_GAP','S3_TOOL','S3_NARRATIVE','S3_FINDING'] },
      { num:4, name:'Search and SEO',          fields: ['S4_EVIDENCE','S4_GAP','S4_TOOL','S4_NARRATIVE','S4_FINDING'] },
      { num:5, name:'Social Media',            fields: ['S5_EVIDENCE','S5_GAP','S5_TOOL','S5_NARRATIVE','S5_FINDING'] },
      { num:6, name:'Delivery Platforms',      fields: ['S6_EVIDENCE','S6_GAP','S6_TOOL','S6_NARRATIVE','S6_FINDING'] },
      { num:7, name:'Email and Loyalty',       fields: ['S7_EVIDENCE','S7_GAP','S7_TOOL','S7_NARRATIVE','S7_FINDING'] },
    ];
    const cards = sections.map(s => {
      const texts = s.fields.map(f => d[f]).filter(v => v && String(v).trim());
      if (!texts.length) return '';
      const score = d['S'+s.num+'_SCORE'];
      const col = score!=null ? (score>=70?'var(--gold)':score>=50?'var(--t1)':'var(--red)') : 'var(--t3)';
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--b2);">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Section ' + s.num + '</div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + s.name + '</div></div>'
        + (score!=null ? '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:' + col + ';">' + score + '</div>' : '')
        + '</div>'
        + texts.map(t => '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
        + '</div>';
    }).filter(Boolean).join('');
    if (!cards) {
      return '<div style="padding:24px;text-align:center;color:var(--t3);font-size:13px;">Written findings are available on Tier 2 and Tier 3 audits. Include your website analytics export and GBP insights with your next submission to unlock section narratives.</div>';
    }
    return '<div style="margin-bottom:8px;font-size:11px;color:var(--t3);line-height:1.6;">Written findings from the audit analysis. These are the observations behind each section score.</div>' + cards;
  },

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    this._intakeDraft = {};
    this.actions.innerHTML = '';
    this.renderIntakeStep();
  },

  intakeStepsHtml(total) {
    let h = '<div class="steps">';
    for (let i = 1; i <= total; i++) {
      const cls = i < this._intakeStep ? 'done' : i === this._intakeStep ? 'active' : '';
      h += (i > 1 ? '<div class="step-line' + (i-1 < this._intakeStep ? ' done' : '') + '"></div>' : '')
        + '<div class="step-dot ' + cls + '">' + (i < this._intakeStep ? '&#10003;' : i) + '</div>';
    }
    return h + '</div>';
  },

  renderIntakeStep() {
    const s    = App.data.settings;
    const step = this._intakeStep;
    const total = 6;
    document.getElementById('topbar-sub').textContent = 'Step ' + step + ' of ' + total;

    const header = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Monthly Traffic Audit</div>';
    const barInfo = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Audit For</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(s.bar_name||'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:11px;color:var(--t3);">' + esc(s.city_state) + '</div>' : '')
      + '</div>';

    const nav = (showPrev, showNext, isSubmit) =>
      '<div class="card-actions" style="display:flex;align-items:center;gap:8px;">'
      + (showPrev ? '<button class="btn btn-ghost" id="ta-iz-prev">&#8592; Back</button>' : '')
      + (showNext ? '<button class="btn btn-primary" id="ta-iz-next">Next &#8594;</button>' : '')
      + (isSubmit ? '<button class="btn btn-primary" id="ta-iz-submit">Generate Audit</button>' : '')
      + '<div id="ta-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></div>'
      + '<div style="flex:1;"></div>'
      + '<button class="btn btn-ghost" id="ta-iz-cancel">Cancel</button>'
      + '</div>';

    let stepHtml = '';
    if (step === 1) {
      stepHtml = '<div class="card">' + header + barInfo
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Google Business Profile</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Upload screenshots of your Google Business Profile. The full profile view is required. GBP Insights unlocks Tier 3 scoring. Your app data is included automatically.</div>'
        + this.renderFileSection('required', 'GBP Screenshot — Full Profile View', 'ta-f-gbp-profile',  'ta-gbp-profile',  'Unlocks: Section 1 full — completeness audit, photo count, post frequency, response rate')
        + this.renderFileSection('optional', 'GBP Insights Export or Screenshot',  'ta-f-gbp-insights', 'ta-gbp-insights', 'Unlocks: Section 1 Tier 3 — full funnel from impression to action')
        + nav(false, true, false) + '</div>';
    } else if (step === 2) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Website Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Website analytics is the highest-value file in this section. Mobile screenshot adds conversion assessment.</div>'
        + this.renderFileSection('highlight', 'Website Analytics Export or Screenshot', 'ta-f-analytics',   'ta-analytics',   'Unlocks: Section 2 full — sessions, bounce rate, top pages, menu page performance')
        + this.renderFileSection('optional',  'Website Screenshot — Homepage on Mobile','ta-f-mobile-site', 'ta-mobile-site', 'Unlocks: Mobile conversion assessment, above-the-fold call-to-action analysis')
        + nav(true, true, false) + '</div>';
    } else if (step === 3) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Reviews and Search Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Google review screenshot unlocks the full reviews section. Yelp and search screenshots add cross-platform scoring.</div>'
        + this.renderFileSection('required', 'Google Review Page Screenshot', 'ta-f-google-reviews', 'ta-google-reviews', 'Unlocks: Required for Section 3 full scoring — confirmed rating, review count, response rate, recency analysis')
        + this.renderFileSection('optional', 'Yelp Listing Screenshot',       'ta-f-yelp',           'ta-yelp',           'Unlocks: Cross-platform reputation comparison')
        + this.renderFileSection('optional', 'Search Results Screenshots',    'ta-f-search',         'ta-search',         'Unlocks: Maps pack presence confirmed, primary search visibility signal')
        + nav(true, true, false) + '</div>';
    } else if (step === 4) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Social Media Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Instagram profile screenshot unlocks the full social section. Analytics unlock Tier 3 engagement scoring.</div>'
        + this.renderFileSection('optional', 'Instagram Profile Screenshot',    'ta-f-instagram',    'ta-instagram',    'Unlocks: Required for Section 5 full scoring — follower count, post frequency, engagement estimate, content audit')
        + this.renderFileSection('optional', 'Facebook Page Screenshot',        'ta-f-facebook',     'ta-facebook',     'Unlocks: Cross-platform social presence analysis')
        + this.renderFileSection('optional', 'Instagram Analytics Screenshot',  'ta-f-ig-analytics', 'ta-ig-analytics', 'Unlocks: Section 5 Tier 3 — exact engagement rate, reach, best content type')
        + nav(true, true, false) + '</div>';
    } else if (step === 5) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Delivery, Email and Guest Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">All optional. Each file unlocks additional section scoring for delivery platforms and email and loyalty programs.</div>'
        + this.renderFileSection('optional', 'Delivery Platform Dashboard Screenshot', 'ta-f-delivery',       'ta-delivery',       'Unlocks: Section 6 full — confirmed rating, photo count, menu completeness, promo status')
        + this.renderFileSection('optional', 'Email Platform Screenshot',              'ta-f-email',          'ta-email',          'Unlocks: Section 7 full — list size, last send date, frequency, growth mechanism')
        + this.renderFileSection('optional', 'Email Analytics Export',                 'ta-f-email-analytics','ta-email-analytics', 'Unlocks: Section 7 Tier 3 — list health, open rate trend, campaign history')
        + nav(true, true, false) + '</div>';
    } else if (step === 6) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Notes and Submit</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Add any context that might affect how the numbers look, then generate your audit. Analysis takes 60 to 90 seconds.</div>'
        + '<label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Additional Notes (optional)</label>'
        + '<textarea id="ta-iz-notes" rows="4" placeholder="Recent changes, seasonal factors, staffing changes, anything that might affect how the numbers look." style="background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-family:Barlow,sans-serif;font-size:12px;padding:10px;width:100%;resize:vertical;">' + esc(this._intakeDraft.notes||'') + '</textarea>'
        + nav(true, false, true) + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.intakeStepsHtml(total) + stepHtml + '</div>';

    document.getElementById('ta-iz-cancel')?.addEventListener('click', () => {
      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
    });
    document.getElementById('ta-iz-prev')?.addEventListener('click', () => {
      this._saveIntakeStep();
      this._intakeStep--;
      this.renderIntakeStep();
    });
    document.getElementById('ta-iz-next')?.addEventListener('click', () => {
      if (step === 1) {
        const gbpFiles = document.getElementById('ta-f-gbp-profile')?.files;
        if (!gbpFiles || gbpFiles.length === 0) {
          const st = document.getElementById('ta-iz-status');
          if (st) { st.style.display='block'; st.style.color='var(--red)'; st.textContent='GBP Profile Screenshot is required to continue.'; }
          return;
        }
      }
      if (step === 3) {
        const reviewFiles = document.getElementById('ta-f-google-reviews')?.files;
        if (!reviewFiles || reviewFiles.length === 0) {
          const st = document.getElementById('ta-iz-status');
          if (st) { st.style.display='block'; st.style.color='var(--red)'; st.textContent='Google Review Page Screenshot is required to continue.'; }
          return;
        }
      }
      this._saveIntakeStep();
      this._intakeStep++;
      this.renderIntakeStep();
    });
    document.getElementById('ta-iz-submit')?.addEventListener('click', () => {
      this._intakeDraft.notes = document.getElementById('ta-iz-notes')?.value || '';
      this.generateAudit();
    });
  },

  _saveIntakeStep() {
    if (document.getElementById('ta-iz-notes')) this._intakeDraft.notes = document.getElementById('ta-iz-notes').value;
  },


  renderFileSection(type, title, inputId, ttId, unlocks) {
    const badge = type === 'required'
      ? '<span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Required</span>'
      : type === 'highlight'
      ? '<span style="background:var(--gold);color:#000;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Highest Value</span>'
      : '<span style="background:var(--b1);color:var(--t3);font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Optional</span>';
    return '<div style="border:1px solid var(--b2);border-radius:4px;padding:12px 14px;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' + badge
      + '<div style="font-size:12px;font-weight:700;color:var(--t1);">' + esc(title) + '</div>'
      + (ttId ? tt(ttId) : '')
      + '</div>'
      + (unlocks ? '<div style="font-size:10px;color:var(--gold);margin-bottom:8px;line-height:1.4;">' + esc(unlocks) + '</div>' : '<div style="margin-bottom:8px;"></div>')
      + '<input type="file" id="' + inputId + '" multiple accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg" '
      + 'style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:6px;font-size:11px;cursor:pointer;width:100%;"/>'
      + '</div>';
  },

  async generateAudit() {
    const submitBtn = document.getElementById('ta-iz-submit');
    const statusEl  = document.getElementById('ta-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    const form = new FormData();
    form.append('appData', JSON.stringify(App.data));
    form.append('notes', this._intakeDraft?.notes || '');

    const fileInputIds = [
      'ta-f-gbp-profile','ta-f-gbp-insights','ta-f-analytics','ta-f-mobile-site',
      'ta-f-google-reviews','ta-f-yelp','ta-f-search',
      'ta-f-instagram','ta-f-facebook','ta-f-ig-analytics',
      'ta-f-delivery','ta-f-email','ta-f-email-analytics'
    ];
    fileInputIds.forEach(id => {
      const inp = document.getElementById(id);
      if (inp?.files) { for (const f of inp.files) form.append('file', f); }
    });

    setStatus('Uploading files and generating audit...', 'var(--t2)');

    try {
      const res  = await fetch('/api/generate-traffic-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      setStatus('Saving audit...', 'var(--t2)');
      const d = data.auditData || {};
      const newAudit = {
        date:          new Date().toISOString().slice(0,10),
        overall_score: d.OVERALL_SCORE || 0,
        bar_name:      d.BAR_NAME      || App.data.settings?.bar_name || '',
        audit_id:      d.AUDIT_ID      || '',
        audit_period:  d.AUDIT_PERIOD  || '',
        grade:         d.DATA_TIER_LABEL || '',
        sections: {
          'Google Business Profile': d.S1_SCORE || 0,
          'Website':                 d.S2_SCORE || 0,
          'Reviews':                 d.S3_SCORE || 0,
          'Search and SEO':          d.S4_SCORE || 0,
          'Social Media':            d.S5_SCORE || 0,
          'Delivery Platforms':      d.S6_SCORE || 0,
          'Email and Loyalty':       d.S7_SCORE || 0,
        },
        action_items: (Array.isArray(d.action_items) ? d.action_items : []).map(a =>
          typeof a === 'string' ? { action: a, monthly_impact: 0 } : a
        ),
        raw: d
      };

      App.data.traffic_audits = App.data.traffic_audits || [];
      App.data.traffic_audits.push(newAudit);
      if (App.data.traffic_audits.length > 12) {
        App.data.traffic_audits = App.data.traffic_audits.slice(-12);
      }
      await App.saveKey('traffic_audits');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);
    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
    }
  }

};
