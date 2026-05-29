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
    // 30-day rolling: next audit is available 30 days after the last one
    // ran, independent of the calendar month. First audit is always available.
    const daysSince    = latest && latest.date
      ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000)
      : Infinity;
    const canRunAudit  = daysSince >= 30;
    const daysLeft     = canRunAudit ? 0 : 30 - daysSince;

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Traffic Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive traffic audit every 30 days. Upload screenshots of your Google Business Profile, website analytics, social media pages, and delivery platforms. Your scored audit appears on screen once the analysis finishes, usually within a minute or two. Print or save it as a PDF from your browser.</div>'
      + '</div>'
      + (canRunAudit
          ? '<button class="btn btn-primary" id="ta-new-btn" style="flex-shrink:0;">' + (latest ? 'Generate New Audit' : 'Generate First Audit') + '</button>'
          : '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' day' + (daysLeft===1?'':'s') + '</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit</div></div>')
      + '</div></div>';

    // Score summary card for latest
    let latestCard = '';
    if (latest) {
      const prev = audits[1] || null;
      const scoreColor = App.scoreColor(latest.overall_score);
      const scoreLabel = App.scoreLabel(latest.overall_score);
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
      // List all seven sections; an unscored one shows N/A (Not enough data).
      const TRAF_SECTION_NAMES = ['Google Business Profile', 'Website', 'Reviews', 'Search and SEO', 'Social Media', 'Delivery Platforms', 'Email and Loyalty'];
      const sectionRows = TRAF_SECTION_NAMES.map(name => {
        const score = sections[name];
        if (score == null) {
          return '<tr>'
            + '<td style="color:var(--t2);padding:8px 12px;">' + esc(name) + '</td>'
            + '<td style="padding:8px 12px;width:140px;"></td>'
            + '<td style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:var(--t3);padding:8px 12px;">N/A</td>'
            + '<td style="font-size:11px;color:var(--t4);padding:8px 12px;">Not enough data</td>'
            + '</tr>';
        }
        const ps   = audits[1]?.sections?.[name];
        const diff = ps != null ? score - ps : null;
        const bar  = Math.min(100, Math.max(0, score));
        return '<tr>'
          + '<td style="color:var(--t1);padding:8px 12px;">' + esc(name) + '</td>'
          + '<td style="padding:8px 12px;width:140px;"><div style="background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+bar+'%;background:'+App.scoreColor(score)+';border-radius:3px;"></div></div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:'+App.scoreColor(score)+';padding:8px 12px;">' + score + '</td>'
          + (diff != null ? '<td style="font-size:12px;color:'+(diff>=0?'var(--gold)':'var(--red)')+';padding:8px 12px;">'+(diff>=0?'+':'')+diff+'</td>' : '<td></td>')
          + '</tr>';
      }).join('');

      // Top Action Items by Impact lives on the full audit view only.
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
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + App.scoreColor(a.overall_score||0) + ';">' + (a.overall_score||0) + '</td>'
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
        + '<div class="empty-sub">Generate your first Traffic Audit above. Upload your screenshots and the scored audit appears once the analysis finishes.</div></div>'
      : '';



    let scoreChart = '';
    if (audits.length >= 2) scoreChart = this.renderScoreChart(audits, 'ta');

    let comparison = '';
    if (audits.length >= 2) comparison = this.renderComparison(audits[0], audits[1]);

    let sparklines = '';
    if (audits.length >= 3) sparklines = this.renderSparklines(audits);

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + scoreChart + comparison + historyCard + '</div>';

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
      const col = App.scoreHex(v);
      return `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="5" fill="#0A1520" stroke="${col}" stroke-width="2.5"/>
        <text x="${xs(i).toFixed(1)}" y="${(ys(v)-10).toFixed(1)}" text-anchor="middle" fill="${col}" font-family="'Barlow Condensed',sans-serif" font-size="13" font-weight="700">${v}</text>`;
    }).join('');
    return '<div class="card" style="margin-bottom:16px;padding:20px 24px 16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Traffic Score History</div>'
      + `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">`
      + `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/></linearGradient></defs>`
      + ticks.map(v => `<line x1="${PAD.l}" y1="${ys(v).toFixed(1)}" x2="${W-PAD.r}" y2="${ys(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="${PAD.l-6}" y="${(ys(v)+4).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${Math.round(v)}</text>`).join('')
      + (fillPath ? `<path d="${fillPath}" fill="url(#${uid})"/>` : '')
      + (linePath ? `<path d="${linePath}" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : '')
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
      const col = (v) => v==null?'':App.scoreColor(v);
      return '<tr>'
        + '<td style="padding:9px 12px;font-size:12px;color:var(--t2);">' + esc(name) + '</td>'
        + '<td style="padding:9px 12px;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:' + col(pv) + ';">' + (pv??'--') + '</td>'
        + '<td style="padding:9px 12px;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:' + col(cv) + ';">' + (cv??'--') + '</td>'
        + '<td style="padding:9px 12px;text-align:center;font-size:13px;">' + arrow + '</td>'
        + '</tr>';
    }).join('');
    const overallDiff = (curr.overall_score||0) - (prev.overall_score||0);
    return '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Audit Comparison</div>'
      + '</div>'
      + '<div style="display:flex;gap:24px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<div><div style="font-size:10px;color:var(--t3);margin-bottom:2px;">' + esc((prev.date||'').slice(0,7)) + (prev.grade?' &nbsp;&middot;&nbsp;' + esc(prev.grade):'') + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:' + App.scoreColor(prev.overall_score||0) + ';">' + (prev.overall_score||0) + '</div></div>'
      + '<div style="display:flex;align-items:center;padding:0 8px;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:' + (overallDiff>=0?'var(--gold)':'var(--red)') + ';">' + (overallDiff>=0?'+':'') + overallDiff + ' pts</div></div>'
      + '<div><div style="font-size:10px;color:var(--t3);margin-bottom:2px;">' + esc((curr.date||'').slice(0,7)) + (curr.grade?' &nbsp;&middot;&nbsp;' + esc(curr.grade):'') + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:' + App.scoreColor(curr.overall_score||0) + ';">' + (curr.overall_score||0) + '</div></div>'
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
      return pts.length >= 2 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#DBAB46" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    };
    const tiles = allNames.map(name => {
      const values = sorted.map(a => (a.sections||{})[name] ?? null);
      const curr   = values[values.length-1] ?? 0;
      const prev   = values.slice(0,-1).reverse().find(v => v != null) ?? null;
      const diff   = prev != null ? curr - prev : null;
      const col    = App.scoreColor(curr);
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
            return `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="#0A1520" stroke="#DBAB46" stroke-width="2"/>`;
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
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-ghost btn-sm';
    backBtn.textContent = '← Back';
    backBtn.style.marginRight = '8px';
    backBtn.onclick = () => this.renderMain();
    this.actions.appendChild(backBtn);

    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Print / Save PDF';
    printBtn.onclick = () => window.print();
    this.actions.appendChild(printBtn);

    const d = audit.raw || audit;
    const scoreColor = App.scoreColor(audit.overall_score||0);

    // Findings text for sections 1-7 (Traffic's section 8 is Risk Signals,
    // which renders its findings via the signals array inline). Inlined
    // under each section card so operators see scores and findings on the
    // same page (no Findings tab).
    const findingsBlock = (num) => {
      if (num === 8) return '';
      const fields = ['S'+num+'_EVIDENCE', 'S'+num+'_GAP', 'S'+num+'_TOOL', 'S'+num+'_NARRATIVE', 'S'+num+'_FINDING'];
      const texts = fields.map(f => d[f]).filter(v => v && String(v).trim());
      if (!texts.length) return '';
      return '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b2);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Findings</div>'
        + texts.map(t => '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
        + '</div>';
    };

    const sectionBlock = (num, name, score, items, signals) => {
      const bar = Math.min(100, Math.max(0, score||0));
      const color = App.scoreColor(score);
      const rows = items.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([label,val]) =>
        '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<td style="padding:7px 0;font-size:11px;color:var(--t3);width:55%;">' + label + '</td>'
        + '<td style="padding:7px 0;font-size:11px;color:var(--t1);font-weight:600;">' + val + '</td>'
        + '</tr>'
      ).join('');
      const sigRows = (signals||[]).map(sig => {
        const sc = (sig.score||'').toUpperCase();
        const dot = sc==='HIGH'?'var(--red)':sc==='MEDIUM'?'rgba(255,200,0,0.7)':'var(--gold)';
        return '<div style="border:1px solid var(--b2);border-radius:4px;padding:12px;margin-top:10px;">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
          + '<div style="width:8px;height:8px;border-radius:50%;background:' + dot + ';flex-shrink:0;"></div>'
          + '<div style="font-size:11px;font-weight:700;color:var(--t1);">' + esc(sig.label||'') + '</div>'
          + '<div style="margin-left:auto;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + dot + ';">' + esc(sig.score||'') + '</div>'
          + '</div>'
          + (sig.evidence ? '<div style="font-size:11px;color:var(--t3);margin-bottom:4px;">' + esc(sig.evidence) + '</div>' : '')
          + (sig.gap      ? '<div style="font-size:11px;color:var(--t2);margin-bottom:4px;">' + esc(sig.gap) + '</div>' : '')
          + (sig.tool     ? '<div style="font-size:11px;color:var(--gold);">' + esc(sig.tool) + '</div>' : '')
          + '</div>';
      }).join('');
      // score === null on a DATA section means N/A (not enough data) — show a
      // clear N/A badge. The Risk Signals section also passes null but supplies
      // a signals array, so it shows no badge.
      const isSignals = signals && signals.length;
      const scoreBlock = score != null
        ? '<div style="text-align:right;">'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:42px;font-weight:700;color:' + color + ';line-height:1;">' + score + '</div>'
          + '<div style="background:var(--b2);height:5px;border-radius:3px;width:80px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + color + ';border-radius:3px;"></div></div>'
          + '</div>'
        : isSignals
          ? ''
          : '<div style="text-align:right;"><div style="font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:3px;">Not enough data</div></div>';
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
        + scoreBlock + '</div>'
        + (rows ? '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>' : '')
        + sigRows
        + findingsBlock(num)
        + '</div>';
    };

    const yN = v => v ? 'Yes' : 'No';
    const pct = v => v != null ? v + '%' : '';
    const num = v => v != null ? String(v) : '';
    const dol = v => v ? App.fmtCurrency(v) : '';

    const signals8 = [
      {score:d.S8_SIG1_SCORE, label:d.S8_SIG1_LABEL, evidence:d.S8_SIG1_EVIDENCE, gap:d.S8_SIG1_GAP, tool:d.S8_SIG1_TOOL},
      {score:d.S8_SIG2_SCORE, label:d.S8_SIG2_LABEL, evidence:d.S8_SIG2_EVIDENCE, gap:d.S8_SIG2_GAP, tool:d.S8_SIG2_TOOL},
      {score:d.S8_SIG3_SCORE, label:d.S8_SIG3_LABEL, evidence:d.S8_SIG3_EVIDENCE, gap:d.S8_SIG3_GAP, tool:d.S8_SIG3_TOOL},
      {score:d.S8_SIG4_SCORE, label:d.S8_SIG4_LABEL, evidence:d.S8_SIG4_EVIDENCE, gap:d.S8_SIG4_GAP, tool:d.S8_SIG4_TOOL},
    ].filter(s => s.label);

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
      ...(signals8.length ? [sectionBlock(8, 'Operational Risk Signals', null, [], signals8)] : []),
    ].join('');

    const actionItems = (audit.action_items || []).map((a,i) => {
      const txt = a.action || a || '';
      const gid = a.gap_id || (window.FixPanel ? FixPanel.inferGapId(txt, 'traffic') : null);
      const btn = gid
        ? '<button class="ta-fix-btn" data-gap="' + esc(gid) + '" style="flex-shrink:0;background:transparent;border:1px solid var(--b1);color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 11px;border-radius:3px;cursor:pointer;align-self:center;">Fix This &#9656;</button>'
        : '';
      return '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:center;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;align-self:center;">' + (i+1) + '</div>'
        + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(txt) + '</div>'
        + (a.monthly_impact ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:4px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
        + '</div>'
        + btn
        + '</div>';
    }).join('');

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
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">'
      +   '<div style="flex:1;min-width:240px;">'
      +     '<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin-bottom:2px;">' + esc(App.scoreLabel(audit.overall_score||0)) + ' Digital Presence Score</div>'
      +     App.scoreBar(audit.overall_score||0)
      +   '</div>'
      +   '<div id="ta-outlook-mount" style="flex-shrink:0;"></div>'
      + '</div>'
      + (d.WEEKLY_GAP_AMT ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);font-size:13px;color:var(--t2);">Estimated Weekly Gap: <strong style="color:var(--gold);">' + esc(String(d.WEEKLY_GAP_AMT)) + '</strong></div>' : '')
      + '</div>'
      // Single-page layout: action items + sections inline, findings under
      // each section via findingsBlock. No tab split.
      + (actionItems ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Action Items, Ranked by Impact</div>'
        + actionItems + '</div>' : '')
      + sections
      + '</div>';

    const outlookMount = document.getElementById('ta-outlook-mount');
    if (outlookMount && window.AuditOutlook) {
      AuditOutlook.attach(outlookMount, audit, 'traffic', { compact: true });
    }

    this.container.querySelectorAll('.ta-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        App._fixFocus = btn.dataset.gap;
        App.navigate('t-fix');
      });
    });
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings render inline under each section via findingsBlock() in viewAudit().

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    const s = App.data?.settings || {};
    const p = s.traffic_practices || {};
    const boolStr = v => v === true ? 'true' : v === false ? 'false' : (v || '');
    this._intakeDraft = {
      practices: { growth_mechanism: boolStr(p.growth_mechanism), loyalty: boolStr(p.loyalty) }
    };
    this.actions.innerHTML = '';
    this.renderIntake();
  },

  // Single-page Traffic intake. Links are entered inline (no bouncing to
  // Settings), saved back to Operation Links, and read live (PageSpeed, Google
  // Places, Yelp). Screenshots are optional fallback. No revenue, no notes.
  renderIntake() {
    const s = App.data.settings || {};
    const d = this._intakeDraft || {};
    document.getElementById('topbar-sub').textContent = '';
    const urls = (App.data.traffic_settings && App.data.traffic_settings.urls) || {};

    const header = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Traffic Audit</div>';
    const barInfo = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Audit For</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(s.bar_name || 'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:11px;color:var(--t3);">' + esc(s.city_state) + '</div>' : '')
      + '</div>';

    // What Bar Cop already has from weekly traffic metrics.
    const tw = (App.data.traffic_weeks || []).slice(-4);
    const has = (fn) => tw.some(w => w[fn] != null);
    const checks = [
      { label: 'Google Rating',  ok: has('google_rating') },
      { label: 'Review Response',ok: has('response_rate') },
      { label: 'Website Sessions',ok: has('monthly_sessions') },
      { label: 'Social Posts',   ok: has('social_posts_month') },
      { label: 'Email',          ok: has('email_list_size') || has('email_open_rate') }
    ];
    const chip = (c) => '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border-radius:20px;margin:0 6px 6px 0;'
      + (c.ok ? 'background:var(--gold-bg);border:1px solid rgba(219,171,70,0.35);color:var(--t1);font-weight:700;' : 'background:var(--input);border:1px solid var(--b2);color:var(--t3);') + '">'
      + (c.ok ? '<span style="color:var(--gold);font-weight:800;">&#10003;</span>' : '<span style="color:var(--t4);font-weight:800;">&middot;</span>') + esc(c.label) + '</span>';
    // Only claim "already has" when weekly traffic numbers actually exist.
    // Unlike the Control modules, Bar Cop does not auto-collect this — it only
    // has what the operator logged in This Week.
    const haveWeekly = checks.some(c => c.ok);
    const controlCard = haveWeekly
      ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:13px;font-weight:800;color:var(--t1);margin-bottom:4px;">From your weekly traffic numbers</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.6;">These come from what you logged in This Week. Your links below add live data; screenshots fill anything links cannot reach.</div>'
        + '<div>' + checks.filter(c => c.ok).map(chip).join('') + '</div></div>'
      : '<div class="card" style="margin-bottom:16px;"><div style="font-size:12px;color:var(--t2);line-height:1.6;">No weekly traffic numbers logged yet, so this audit reads entirely from the links and screenshots below. As you log weekly traffic in This Week, those numbers feed future audits automatically.</div></div>';

    // Inline link fields — pre-filled from Operation Links, saved on Generate.
    const linkRow = (key, label, ph) => '<div style="margin-bottom:10px;">'
      + '<label style="font-size:11px;font-weight:700;letter-spacing:0.5px;color:var(--t3);display:block;margin-bottom:4px;">' + esc(label) + '</label>'
      + '<input type="url" id="ta-link-' + key + '" value="' + esc(urls[key] || '') + '" placeholder="' + ph + '" style="background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-size:12px;padding:8px 10px;width:100%;outline:none;"/></div>';
    const linksCard = '<div class="card" style="margin-bottom:16px;">' + header + barInfo
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Your Links</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Paste the links Bar Cop should read. They save to your Operation Links so you only enter them once. Google rating, reviews, and website speed are read live from these.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 24px;">'
      + (App.TRAFFIC_PLATFORMS || []).map(p => linkRow(p.urlKey, p.label, p.placeholder || '')).join('')
      + '</div></div>';

    const screenshotsCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Screenshots</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">All optional. Add these for what your links cannot reach (data behind a login) or as a fallback. Accepts images, PDF, or exports.</div>'
      + this.renderFileSection('highlight', 'Website Analytics (sessions, bounce rate)', 'ta-f-analytics',      'ta-analytics',      'Sessions and bounce live behind your analytics login, not in the public page.')
      + this.renderFileSection('optional',  'Google Review Page (fallback)',             'ta-f-google-reviews', 'ta-google-reviews', 'Backup if the live Google read is unavailable.')
      + this.renderFileSection('optional',  'GBP Insights (impressions, calls)',         'ta-f-gbp-insights',   'ta-gbp-insights',   'Adds the impression-to-action funnel.')
      + this.renderFileSection('optional',  'Search Results (maps pack)',                'ta-f-search',         'ta-search',         'Confirms maps-pack presence and search visibility.')
      + this.renderFileSection('optional',  'Instagram Profile',                         'ta-f-instagram',      'ta-instagram',      'Follower count, post frequency, content.')
      + this.renderFileSection('optional',  'Delivery Platform Dashboard',               'ta-f-delivery',       'ta-delivery',       'Rating, photos, menu completeness, promos.')
      + this.renderFileSection('optional',  'Email Platform',                            'ta-f-email',          'ta-email',          'List size, send frequency, open rate.')
      + '</div>';

    const pr = d.practices || {};
    const qRow = (label, id, options) => {
      const all = [['', 'Select Answer']].concat(options);
      const opts = all.map(o => '<option value="' + esc(o[0]) + '"' + (String(pr[id] || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
      return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="flex:1;font-size:12px;color:var(--t1);">' + esc(label) + '</div>'
        + '<select id="ta-q-' + id + '" style="background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-size:12px;padding:6px 8px;min-width:120px;">' + opts + '</select></div>';
    };
    const questionsCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">A Couple Quick Questions</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:8px;line-height:1.6;">These are not in your reports. Select Answer = no effect on the score.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 28px;">'
      + qRow('Email signup or list-growth mechanism in place?', 'growth_mechanism', [['false', 'No'], ['true', 'Yes']])
      + qRow('Loyalty or rewards program?', 'loyalty', [['false', 'No'], ['true', 'Yes']])
      + '</div></div>';

    const submitCard = '<div class="card">'
      + '<div class="card-actions" style="display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="ta-iz-submit">Generate Audit</button>'
      + '<div id="ta-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></div>'
      + '<div style="flex:1;"></div>'
      + '<button class="btn btn-ghost" id="ta-iz-cancel">Cancel</button></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Analysis takes 60 to 90 seconds.</div></div>';

    this.container.innerHTML = '<div class="screen">' + linksCard + controlCard + screenshotsCard + questionsCard + submitCard + '</div>';

    document.getElementById('ta-iz-cancel')?.addEventListener('click', () => { document.getElementById('topbar-sub').textContent = ''; this.renderMain(); });
    document.getElementById('ta-iz-submit')?.addEventListener('click', () => {
      const val = id => (document.getElementById('ta-q-' + id) || {}).value || '';
      this._intakeDraft.practices = { growth_mechanism: val('growth_mechanism'), loyalty: val('loyalty') };
      this.generateAudit();
    });
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

    const header = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Traffic Audit</div>';
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

    const urls = (App.data.traffic_settings && App.data.traffic_settings.urls) || {};

    let stepHtml = '';
    if (step === 1) {
      stepHtml = '<div class="card">' + header + barInfo
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Google Business Profile</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Your saved GBP link in Operation Links is used to pull live profile data. The optional GBP Insights screenshot unlocks Tier 3 scoring (impressions, calls, directions). Your Bar Cop data is included automatically.</div>'
        + this.renderUrlSection('GBP URL (from Operation Links)', urls.gbp, 'GBP', 'Settings > Operation Links > Google Business Profile')
        + this.renderFileSection('optional', 'GBP Screenshot: Full Profile View (Fallback)', 'ta-f-gbp-profile',  'ta-gbp-profile',  'Adds: Backup data source if the live URL fetch is blocked or returns nothing useful')
        + this.renderFileSection('optional', 'GBP Insights Export or Screenshot',            'ta-f-gbp-insights', 'ta-gbp-insights', 'Adds: Section 1 Tier 3. Full funnel from impression to action. Cannot be pulled by URL.')
        + nav(false, true, false) + '</div>';
    } else if (step === 2) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Website Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Your saved website link is run through Google PageSpeed Insights for mobile performance, accessibility, SEO, and best-practices scoring. Analytics export is still the highest-value upload because it covers session and bounce data behind the login.</div>'
        + this.renderUrlSection('Website URL (from Operation Links)', urls.website, 'Website', 'Settings > Operation Links > Website')
        + this.renderFileSection('highlight', 'Website Analytics Export or Screenshot', 'ta-f-analytics',   'ta-analytics',   'Adds: Section 2 full. Sessions, bounce rate, top pages, menu page performance. Cannot be pulled by URL.')
        + this.renderFileSection('optional',  'Website Screenshot: Homepage on Mobile (Fallback)','ta-f-mobile-site', 'ta-mobile-site', 'Adds: Backup data source if the live URL fetch is blocked.')
        + nav(true, true, false) + '</div>';
    } else if (step === 3) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Reviews and Search Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Google review screenshot unlocks the full reviews section. Yelp and search screenshots add cross-platform scoring.</div>'
        + this.renderFileSection('required', 'Google Review Page Screenshot', 'ta-f-google-reviews', 'ta-google-reviews', 'Adds: Required for Section 3 full scoring. Confirmed rating, review count, response rate, recency analysis')
        + this.renderFileSection('optional', 'Yelp Listing Screenshot',       'ta-f-yelp',           'ta-yelp',           'Adds: Cross-platform reputation comparison')
        + this.renderFileSection('optional', 'Search Results Screenshots',    'ta-f-search',         'ta-search',         'Adds: Maps pack presence confirmed, primary search visibility signal')
        + nav(true, true, false) + '</div>';
    } else if (step === 4) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Social Media Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Instagram profile screenshot adds the full social section. Analytics produce Tier 3 engagement scoring.</div>'
        + this.renderFileSection('optional', 'Instagram Profile Screenshot',    'ta-f-instagram',    'ta-instagram',    'Adds: Required for Section 5 full scoring. Follower count, post frequency, engagement estimate, content audit')
        + this.renderFileSection('optional', 'Facebook Page Screenshot',        'ta-f-facebook',     'ta-facebook',     'Adds: Cross-platform social presence analysis')
        + this.renderFileSection('optional', 'Instagram Analytics Screenshot',  'ta-f-ig-analytics', 'ta-ig-analytics', 'Adds: Section 5 Tier 3. Exact engagement rate, reach, best content type')
        + nav(true, true, false) + '</div>';
    } else if (step === 5) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Delivery, Email and Guest Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">All optional. Each file unlocks additional section scoring for delivery platforms and email and loyalty programs.</div>'
        + this.renderFileSection('optional', 'Delivery Platform Dashboard Screenshot', 'ta-f-delivery',       'ta-delivery',       'Adds: Section 6 full. Confirmed rating, photo count, menu completeness, promo status')
        + this.renderFileSection('optional', 'Email Platform Screenshot',              'ta-f-email',          'ta-email',          'Adds: Section 7 full. List size, last send date, frequency, growth mechanism')
        + this.renderFileSection('optional', 'Email Analytics Export',                 'ta-f-email-analytics','ta-email-analytics', 'Adds: Section 7 Tier 3. List health, open rate trend, campaign history')
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
        // Step 1 now uses the GBP URL from Operation Links instead of requiring
        // a screenshot. Block forward if both the URL and a fallback screenshot
        // are missing — the audit needs at least one source for the GBP section.
        const gbpUrl = (App.data.traffic_settings && App.data.traffic_settings.urls && App.data.traffic_settings.urls.gbp) || '';
        const gbpFiles = document.getElementById('ta-f-gbp-profile')?.files;
        if (!gbpUrl && (!gbpFiles || gbpFiles.length === 0)) {
          const st = document.getElementById('ta-iz-status');
          if (st) { st.style.display='block'; st.style.color='var(--red)'; st.textContent='Add your Google Business Profile URL in Settings, or upload a GBP screenshot as the fallback, to continue.'; }
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


  // Renders an indicator for a URL pulled from Settings. If the URL is set,
  // shows green-tinted "Using your saved [Platform] link" with a truncated
  // preview. If not, shows a "Add it in Settings" prompt with a button that
  // jumps to App Settings. The audit endpoint reads urls from traffic_settings
  // either way; this is purely the operator-facing indicator.
  renderUrlSection(label, url, platform, settingsPath) {
    const has = !!(url && url.trim());
    const truncate = (s, n) => (s && s.length > n) ? s.slice(0, n - 1) + '…' : s;
    if (has) {
      return '<div style="border:1px solid var(--green);background:rgba(81,138,121,0.08);border-radius:4px;padding:12px 14px;margin-bottom:8px;">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
        +   '<span style="background:var(--green);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Live URL</span>'
        +   '<div style="font-size:12px;font-weight:700;color:var(--t1);">' + esc(label) + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--t3);word-break:break-all;">' + esc(truncate(url, 110)) + '</div>'
        + '</div>';
    }
    return '<div style="border:1px solid rgba(192,56,40,0.4);background:rgba(192,56,40,0.06);border-radius:4px;padding:12px 14px;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
      +   '<span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Missing</span>'
      +   '<div style="font-size:12px;font-weight:700;color:var(--t1);">' + esc(label) + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-bottom:8px;">'
      +   'No ' + esc(platform) + ' URL is saved. Add it in ' + esc(settingsPath) + ' so the audit can pull live data. You can also upload a fallback screenshot below.'
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" onclick="S.HubSettings.open()" style="font-size:10px;padding:4px 10px;">Open Settings</button>'
      + '</div>';
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
    if (App.demoBlock('Running an audit')) return;
    const submitBtn = document.getElementById('ta-iz-submit');
    const statusEl  = document.getElementById('ta-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    const draftP = this._intakeDraft?.practices || {};
    // Collect the inline links and save them back to Operation Links so the
    // operator enters them once and the audit can read them live next time.
    const linkKeys = (App.TRAFFIC_PLATFORMS || []).map(p => p.urlKey);
    const savedUrls = Object.assign({}, (App.data.traffic_settings && App.data.traffic_settings.urls) || {});
    linkKeys.forEach(k => { const el = document.getElementById('ta-link-' + k); if (el) savedUrls[k] = (el.value || '').trim(); });
    if (!App.data.traffic_settings) App.data.traffic_settings = {};
    App.data.traffic_settings.urls = savedUrls;
    App.data.settings.traffic_practices = draftP;
    await App.saveKey('traffic_settings');
    await App.saveKey('settings');

    const form = new FormData();
    form.append('appData', JSON.stringify(App.data));
    // Links + a place query (name + city) so the server can read Google Places
    // and Yelp live where keys are configured.
    const urlsPayload = Object.assign({}, savedUrls, {
      place_query: [App.data.settings?.bar_name, App.data.settings?.city_state].filter(Boolean).join(' '),
      city_state: App.data.settings?.city_state || ''
    });
    form.append('urls', JSON.stringify(urlsPayload));
    // Practices — unanswered ('') omitted so it has no score effect.
    const practices = {};
    if (draftP.growth_mechanism === 'true' || draftP.growth_mechanism === 'false') practices.growth_mechanism = draftP.growth_mechanism === 'true';
    if (draftP.loyalty === 'true' || draftP.loyalty === 'false') practices.loyalty = draftP.loyalty === 'true';
    form.append('practices', JSON.stringify(practices));

    const fileInputIds = ['ta-f-analytics', 'ta-f-google-reviews', 'ta-f-gbp-insights', 'ta-f-search', 'ta-f-instagram', 'ta-f-delivery', 'ta-f-email'];
    let taFileCount = 0;
    fileInputIds.forEach(id => {
      const inp = document.getElementById(id);
      if (inp?.files) { for (const f of inp.files) { form.append('file', f); taFileCount++; } }
    });

    // Validation — links, screenshots, or weekly data all count as real input.
    const hasRealData = taFileCount > 0 || (App.data.traffic_weeks && App.data.traffic_weeks.length > 0)
      || savedUrls.gbp || savedUrls.website || savedUrls.yelp;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your screenshots.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

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
        sections: (() => {
          // Preserve N/A: only include a section when it actually scored, so
          // the landing list can show "N/A" for the ones with no data.
          const map = { 'Google Business Profile': d.S1_SCORE, 'Website': d.S2_SCORE, 'Reviews': d.S3_SCORE, 'Search and SEO': d.S4_SCORE, 'Social Media': d.S5_SCORE, 'Delivery Platforms': d.S6_SCORE, 'Email and Loyalty': d.S7_SCORE };
          const out = {}; Object.keys(map).forEach(k => { if (map[k] != null) out[k] = map[k]; }); return out;
        })(),
        action_items: (Array.isArray(d.action_items) ? d.action_items : []).map(a => {
          const obj = typeof a === 'string' ? { action: a, monthly_impact: 0 } : a;
          if (!obj.gap_id && window.FixPanel) obj.gap_id = FixPanel.inferGapId(obj.action, 'traffic');
          return obj;
        }),
        raw: d
      };

      App.data.traffic_audits = App.data.traffic_audits || [];
      App.data.traffic_audits.push(newAudit);
      if (App.data.traffic_audits.length > 12) {
        App.data.traffic_audits = App.data.traffic_audits.slice(-12);
      }
      await App.saveKey('traffic_audits');
      App.markSetupDone('gs_t_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);
    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
    }
  }

};
