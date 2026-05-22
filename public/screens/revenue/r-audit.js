'use strict';
S.RevenueAudit = {
  _view: null,

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
    const audits       = (App.data.revenue_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest       = audits[0] || null;
    const now          = new Date();
    const thisMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft     = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Revenue Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive revenue audit per month. Upload your POS reports and labor data. Your scored audit appears on screen once the analysis finishes, usually within a minute or two. Print or save it as a PDF from your browser.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="ra-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
      + '</div></div>';

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
      const sectionRows = Object.entries(sections).map(([name, score]) => {
        const ps   = prev?.sections?.[name];
        const diff = ps != null ? score - ps : null;
        const bar  = Math.min(100, Math.max(0, score));
        return '<tr>'
          + '<td style="color:var(--t1);padding:8px 12px;">' + esc(name) + '</td>'
          + '<td style="padding:8px 12px;width:140px;"><div style="background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+bar+'%;background:'+App.scoreColor(score)+';border-radius:3px;"></div></div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:'+App.scoreColor(score)+';padding:8px 12px;">' + score + '</td>'
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
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Revenue Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '  ' + esc(latest.audit_period) : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + '<button class="btn btn-ghost btn-sm ra-view-btn" data-idx="0">View Full Audit</button>'
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


    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first monthly Revenue Audit above. Upload your POS reports and the scored audit appears once the analysis finishes.</div></div>'
      : '';



    let scoreChart = '';
    if (audits.length >= 2) {
      scoreChart = this.renderScoreChart(audits, 'ra');
    }

    let comparison = '';
    if (audits.length >= 2) {
      comparison = this.renderComparison(audits[0], audits[1]);
    }

    let sparklines = '';
    if (audits.length >= 3) {
      sparklines = this.renderSparklines(audits);
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
          + '<td><button class="btn btn-ghost btn-sm ra-view-btn" data-idx="' + i + '" style="font-size:10px;padding:4px 10px;">View</button></td>'
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

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + scoreChart + comparison + sparklines + historyCard + '</div>';

    document.getElementById('ra-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.ra-view-btn').forEach(btn => {
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
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Revenue Score History</div>'
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
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Audit Comparison</div>'
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
      return pts.length >= 2 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : '';
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
    const audits = (App.data.revenue_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;
    this._view = idx;

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

    const sectionBlock = (num, name, score, items) => {
      const bar   = Math.min(100, Math.max(0, score||0));
      const color = App.scoreColor(score);
      const rows  = items.filter(([,v]) => v !== undefined && v !== null && v !== '').map(([label, val, highlight]) =>
        '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<td style="padding:7px 0;font-size:11px;color:var(--t3);width:55%;">' + label + '</td>'
        + '<td style="padding:7px 0;font-size:11px;color:' + (highlight==='warn'?'var(--red)':highlight==='good'?'var(--gold)':'var(--t1)') + ';font-weight:600;">' + val + '</td>'
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

    const pct = v => v != null ? v + '%' : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null ? String(v) : '';
    const yN  = v => v === true ? 'Yes' : v === false ? 'No' : '';

    const sections = [
      sectionBlock(1, 'Check Average and Revenue', d.S1_SCORE, [
        ['Blended Check Average',        cur(d.S1_CHECK_AVG), d.S1_CHECK_AVG < d.S1_CHECK_AVG_TARGET ? 'warn' : 'good'],
        ['Check Average Target',         cur(d.S1_CHECK_AVG_TARGET)],
        ['Bar Check Average',            cur(d.S1_BAR_CHECK_AVG)],
        ['Food Check Average',           cur(d.S1_FOOD_CHECK_AVG)],
        ['Monthly Cover Count',          num(d.S1_COVER_COUNT)],
        ['Monthly Revenue',              cur(d.S1_MONTHLY_REVENUE)],
        ['Monthly Gap vs Target',        cur(d.S1_MONTHLY_GAP), d.S1_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',                   cur(d.S1_ANNUAL_GAP),  d.S1_ANNUAL_GAP  > 0 ? 'warn' : ''],
      ]),
      sectionBlock(2, 'Labor Efficiency', d.S2_SCORE, [
        ['Total Labor %',                pct(d.S2_LABOR_PCT), d.S2_LABOR_PCT > 35 ? 'warn' : 'good'],
        ['Labor Target %',               pct(d.S2_LABOR_TARGET_PCT)],
        ['RPLH',                         cur(d.S2_RPLH)],
        ['RPLH Target',                  cur(d.S2_RPLH_TARGET)],
        ['Total Labor Period',           cur(d.S2_LABOR_PERIOD)],
        ['Scheduled vs Actual Hours',    d.S2_SCHED_VS_ACTUAL || ''],
        ['Overtime Hours',               d.S2_OVERTIME_HRS ? num(d.S2_OVERTIME_HRS) + ' hrs' : ''],
        ['Monthly Labor Gap',            cur(d.S2_MONTHLY_GAP), d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(3, 'Menu Performance', d.S3_SCORE, [
        ['Stars on Menu',                num(d.S3_STARS_COUNT)],
        ['Plowhorses on Menu',           num(d.S3_PLOWHORSES_COUNT)],
        ['Dogs on Menu',                 num(d.S3_DOGS_COUNT), d.S3_DOGS_COUNT > 3 ? 'warn' : ''],
        ['Puzzles on Menu',              num(d.S3_PUZZLES_COUNT)],
        ['Top Category by Revenue',      d.S3_TOP_CATEGORY || ''],
        ['Menu Mix Gap',                 cur(d.S3_MONTHLY_GAP), d.S3_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Pricing Opportunity',          cur(d.S3_PRICING_OPPORTUNITY)],
      ]),
      sectionBlock(4, 'Server Performance', d.S4_SCORE, [
        ['Server Count Analyzed',        num(d.S4_SERVER_COUNT)],
        ['Top Server Check Average',     cur(d.S4_TOP_CHECK_AVG)],
        ['Bottom Server Check Average',  cur(d.S4_BOTTOM_CHECK_AVG)],
        ['Performance Spread',           cur(d.S4_PERFORMANCE_SPREAD), d.S4_PERFORMANCE_SPREAD > 5 ? 'warn' : ''],
        ['Appetizer Attach Rate',        pct(d.S4_APP_ATTACH_RATE), d.S4_APP_ATTACH_RATE < 30 ? 'warn' : ''],
        ['Dessert Attach Rate',          pct(d.S4_DESSERT_ATTACH_RATE)],
        ['Pre-Shift Briefing',           d.S4_PRESHIFT_BRIEFING || ''],
        ['Monthly Gap from Spread',      cur(d.S4_MONTHLY_GAP), d.S4_MONTHLY_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(5, 'Events and Private Dining', d.S5_SCORE, [
        ['Event Revenue Period',         cur(d.S5_EVENT_REV_PERIOD)],
        ['Events per Month',             num(d.S5_EVENTS_PER_MONTH)],
        ['Average Event Revenue',        cur(d.S5_AVG_EVENT_REVENUE)],
        ['Private Dining Minimum Met',   yN(d.S5_MINIMUM_MET)],
        ['Catering Revenue Period',      cur(d.S5_CATERING_REV_PERIOD)],
        ['Annual Event Gap',             cur(d.S5_ANNUAL_EVENT_GAP), d.S5_ANNUAL_EVENT_GAP > 0 ? 'warn' : ''],
        ['Monthly Gap',                  cur(d.S5_MONTHLY_GAP), d.S5_MONTHLY_GAP > 0 ? 'warn' : ''],
      ]),
    ].join('');

    const actionItems = (audit.action_items || []).map((a,i) =>
      '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;">' + (i+1) + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(a.action||a) + '</div>'
      + (a.monthly_impact ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:4px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
      + '</div></div>'
    ).join('');

    const totalMonthly = (audit.action_items||[]).reduce((s,a) => s+(a.monthly_impact||0), 0);

    this.container.innerHTML = '<div class="screen" id="ra-audit-view">'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Revenue Recovery Audit</div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
        + (audit.date||'').slice(0,10)
        + (audit.audit_period ? '  |  ' + esc(audit.audit_period) : '')
        + (audit.audit_id ? '  |  ' + esc(audit.audit_id) : '')
        + (audit.grade ? '  |  ' + esc(audit.grade) : '')
        + '</div>'
      + (audit.grade ? '<div style="margin-top:8px;"><span style="background:' + (audit.grade.includes('3')||audit.grade.toLowerCase().includes('full')?'var(--gold)':audit.grade.includes('2')||audit.grade.toLowerCase().includes('standard')?'rgba(255,200,0,0.3)':'var(--b1)') + ';color:' + (audit.grade.includes('3')||audit.grade.toLowerCase().includes('full')?'#000':'var(--t2)') + ';font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:2px;">' + esc(audit.grade) + '</span></div>' : '')
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Revenue Score</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:72px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (audit.overall_score||0) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">Industry Avg: ' + (d.INDUSTRY_AVG||61) + '  |  Target: ' + (d.TARGET_SCORE||65) + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);">'
      +   '<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin-bottom:2px;">' + esc(App.scoreLabel(audit.overall_score||0)) + ' Revenue Score</div>'
      +   App.scoreBar(audit.overall_score||0)
      + '</div>'
      + (totalMonthly > 0 ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Total Recoverable Per Month</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly) + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Annualized</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly*12) + '</div></div>'
        + '</div>' : '')
      + '</div>'

      + '<div style="display:flex;gap:0;border-bottom:1px solid var(--b2);margin-bottom:16px;">'
      + '<button id="ra-tab-scores" style="background:none;border:none;border-bottom:2px solid var(--gold);color:var(--t1);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:10px 18px;cursor:pointer;letter-spacing:0.5px;">Scores</button>'
      + '<button id="ra-tab-narrative" style="background:none;border:none;border-bottom:2px solid transparent;color:var(--t3);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:10px 18px;cursor:pointer;letter-spacing:0.5px;">Findings</button>'
      + '</div>'

      + '<div id="ra-tab-scores-content">'
      + (actionItems ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Action Items, Ranked by Impact</div>'
        + actionItems + '</div>' : '')
      + sections
      + '</div>'

      + '<div id="ra-tab-narrative-content" style="display:none;">'
      + this.renderNarrative(d)
      + '</div>'

      + '</div>';

    document.getElementById('ra-tab-scores')?.addEventListener('click', () => {
      document.getElementById('ra-tab-scores-content').style.display = '';
      document.getElementById('ra-tab-narrative-content').style.display = 'none';
      document.getElementById('ra-tab-scores').style.borderBottomColor = 'var(--gold)';
      document.getElementById('ra-tab-scores').style.color = 'var(--t1)';
      document.getElementById('ra-tab-narrative').style.borderBottomColor = 'transparent';
      document.getElementById('ra-tab-narrative').style.color = 'var(--t3)';
    });
    document.getElementById('ra-tab-narrative')?.addEventListener('click', () => {
      document.getElementById('ra-tab-scores-content').style.display = 'none';
      document.getElementById('ra-tab-narrative-content').style.display = '';
      document.getElementById('ra-tab-narrative').style.borderBottomColor = 'var(--gold)';
      document.getElementById('ra-tab-narrative').style.color = 'var(--t1)';
      document.getElementById('ra-tab-scores').style.borderBottomColor = 'transparent';
      document.getElementById('ra-tab-scores').style.color = 'var(--t3)';
    });
  },

  renderNarrative(d) {
    const sections = [
      { num:1, name:'Check Average and Revenue',  fields: ['S1_EVIDENCE','S1_GAP','S1_TOOL','S1_NARRATIVE','S1_FINDING'] },
      { num:2, name:'Labor Efficiency',            fields: ['S2_EVIDENCE','S2_GAP','S2_TOOL','S2_NARRATIVE','S2_FINDING'] },
      { num:3, name:'Menu Performance',            fields: ['S3_EVIDENCE','S3_GAP','S3_TOOL','S3_NARRATIVE','S3_FINDING'] },
      { num:4, name:'Server Performance',          fields: ['S4_EVIDENCE','S4_GAP','S4_TOOL','S4_NARRATIVE','S4_FINDING'] },
      { num:5, name:'Events and Private Dining',   fields: ['S5_EVIDENCE','S5_GAP','S5_TOOL','S5_NARRATIVE','S5_FINDING'] },
    ];
    const cards = sections.map(s => {
      const texts = s.fields.map(f => d[f]).filter(v => v && String(v).trim());
      if (!texts.length) return '';
      const score = d['S'+s.num+'_SCORE'];
      const col = score!=null ? App.scoreColor(score) : 'var(--t3)';
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
      return '<div style="padding:24px;text-align:center;color:var(--t3);font-size:13px;">Written findings are available on Tier 2 and Tier 3 audits. Include your server sales report and labor schedule with your next submission to unlock section narratives.</div>';
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
    this._intakeDraft = { barRev: '', foodRev: '' };
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

    const header = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Monthly Revenue Audit</div>';

    const cd = this.buildControlData();
    const controlBanner = (cd && cd.sources && cd.sources.length)
      ? '<div style="background:var(--gold-bg);border:1px solid rgba(201,168,76,0.35);border-radius:6px;padding:12px 16px;margin-bottom:16px;">'
        + '<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:5px;">Control Data Is Feeding This Audit</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;">Verified figures from ' + esc(cd.sources.join(', '))
        + ' go in automatically as ground truth. The uploads below only need to cover what your Control modules do not.</div>'
        + '</div>'
      : '';
    const barInfo = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Audit For</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(s.bar_name||'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:11px;color:var(--t3);">' + esc(s.city_state) + '</div>' : '')
      + '</div>';

    const nav = (showPrev, showNext, isSubmit) =>
      '<div class="card-actions" style="display:flex;align-items:center;gap:8px;">'
      + (showPrev ? '<button class="btn btn-ghost" id="ra-iz-prev">&#8592; Back</button>' : '')
      + (showNext ? '<button class="btn btn-primary" id="ra-iz-next">Next &#8594;</button>' : '')
      + (isSubmit ? '<button class="btn btn-primary" id="ra-iz-submit">Generate Audit</button>' : '')
      + '<div id="ra-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></div>'
      + '<div style="flex:1;"></div>'
      + '<button class="btn btn-ghost" id="ra-iz-cancel">Cancel</button>'
      + '</div>';

    let stepHtml = '';
    if (step === 1) {
      stepHtml = '<div class="card">' + header + barInfo
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Annual Revenue</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;">Enter your annual bar and food revenue. This sets the dollar baselines for every gap calculation. Your app data from the last 30 days is included automatically.</div>'
        + '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
        + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Required</span>Annual Bar Revenue</label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-iz-bar-rev" placeholder="480000" value="' + esc(this._intakeDraft.barRev) + '" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
        + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Required</span>Annual Food Revenue</label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-iz-food-rev" placeholder="320000" value="' + esc(this._intakeDraft.foodRev) + '" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
        + '</div>'
        + nav(false, true, false) + '</div>';
    } else if (step === 2) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Sales Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">The POS Daily Sales Summary is required. Additional files unlock deeper category and menu scoring.</div>'
        + this.renderFileSection('required', 'POS Daily Sales Summary',   'ra-f-pos-daily',   'ra-pos-daily',   'Unlocks: Revenue trend, category split, blended check average')
        + this.renderFileSection('optional', 'Menu Sales Mix Report',      'ra-f-menu-mix',    'ra-menu-mix',    'Unlocks: Category concentration, menu engineering signals')
        + this.renderFileSection('optional', 'Menu Price List',            'ra-f-menu-prices', 'ra-menu-prices', 'Unlocks: Pricing gap analysis, contribution margin assessment')
        + nav(true, true, false) + '</div>';
    } else if (step === 3) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Server and Floor Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Server sales report is the highest-value file in this audit. Unlocks two full scored sections on its own.</div>'
        + this.renderFileSection('highlight', 'Server Sales Report',          'ra-f-server-sales', 'ra-server-sales', 'Unlocks: Check average by server, performance spread, top and bottom server, two full scored sections')
        + this.renderFileSection('optional',  'Server Upsell Tracking Report','ra-f-upsell',       'ra-upsell',       'Unlocks: Appetizer and dessert attach rates, upsell execution scoring by server')
        + this.renderFileSection('optional',  'Pre-Shift Briefing Log',       'ra-f-preshift',     'ra-preshift',     'Unlocks: Assessment of whether a performance standard is being communicated')
        + nav(true, true, false) + '</div>';
    } else if (step === 4) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Labor Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Labor schedule is required for RPLH and prime cost calculations. Payroll actuals unlock deeper variance analysis.</div>'
        + this.renderFileSection('optional', 'Weekly Labor Schedule',       'ra-f-labor-sched', 'ra-labor-sched', 'Unlocks: Required for RPLH calculation, labor percentage, schedule efficiency analysis')
        + this.renderFileSection('optional', 'Time Clock or Payroll Actuals','ra-f-timeclock',   'ra-timeclock',   'Unlocks: Clock drift analysis, actual vs scheduled hours, verified overtime cost')
        + this.renderFileSection('optional', 'Labor Cost by Department',    'ra-f-labor-dept',  'ra-labor-dept',  'Unlocks: Department-level labor targeting, identifies which department is driving overage')
        + nav(true, true, false) + '</div>';
    } else if (step === 5) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Events and Private Dining</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">All optional. Upload whatever you have. Each file unlocks event revenue scoring and gap analysis.</div>'
        + this.renderFileSection('optional', 'Private Dining and Event Revenue Records','ra-f-events',    'ra-events',    'Unlocks: Event frequency, average event revenue, minimum compliance, annual event revenue gap')
        + this.renderFileSection('optional', 'Catering Revenue Records',                'ra-f-catering',  'ra-catering',  'Unlocks: Catering revenue trend, package performance, repeat client rate')
        + this.renderFileSection('optional', 'Private Dining Rate Card',                'ra-f-rate-card', 'ra-rate-card', 'Unlocks: Pricing position analysis, minimum structure assessment')
        + nav(true, true, false) + '</div>';
    } else if (step === 6) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Notes and Submit</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Add any context that might affect how the numbers look, then generate your audit. Analysis takes 60 to 90 seconds.</div>'
        + '<label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Additional Notes (optional)</label>'
        + '<textarea id="ra-iz-notes" rows="4" placeholder="Recent changes, seasonal factors, staffing changes, anything that might affect how the numbers look." style="background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-family:Barlow,sans-serif;font-size:12px;padding:10px;width:100%;resize:vertical;">' + esc(this._intakeDraft.notes||'') + '</textarea>'
        + nav(true, false, true) + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.intakeStepsHtml(total) + controlBanner + stepHtml + '</div>';

    document.getElementById('ra-iz-cancel')?.addEventListener('click', () => {
      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
    });
    document.getElementById('ra-iz-prev')?.addEventListener('click', () => {
      this._saveIntakeStep();
      this._intakeStep--;
      this.renderIntakeStep();
    });
    document.getElementById('ra-iz-next')?.addEventListener('click', () => {
      if (step === 1) {
        const barRev  = parseFloat(document.getElementById('ra-iz-bar-rev')?.value) || 0;
        const foodRev = parseFloat(document.getElementById('ra-iz-food-rev')?.value) || 0;
        if (barRev === 0 && foodRev === 0) {
          const st = document.getElementById('ra-iz-status');
          if (st) { st.style.display='block'; st.style.color='var(--red)'; st.textContent='Enter at least one revenue figure to continue.'; }
          return;
        }
        this._intakeDraft.barRev  = document.getElementById('ra-iz-bar-rev')?.value || '';
        this._intakeDraft.foodRev = document.getElementById('ra-iz-food-rev')?.value || '';
      }
      if (step === 2) {
        const posFiles = document.getElementById('ra-f-pos-daily')?.files;
        if (!posFiles || posFiles.length === 0) {
          const st = document.getElementById('ra-iz-status');
          if (st) { st.style.display='block'; st.style.color='var(--red)'; st.textContent='POS Daily Sales Summary is required.'; }
          return;
        }
      }
      this._saveIntakeStep();
      this._intakeStep++;
      this.renderIntakeStep();
    });
    document.getElementById('ra-iz-submit')?.addEventListener('click', () => {
      this._intakeDraft.notes = document.getElementById('ra-iz-notes')?.value || '';
      this.generateAudit();
    });
  },

  _saveIntakeStep() {
    if (document.getElementById('ra-iz-bar-rev'))  this._intakeDraft.barRev  = document.getElementById('ra-iz-bar-rev').value;
    if (document.getElementById('ra-iz-food-rev')) this._intakeDraft.foodRev = document.getElementById('ra-iz-food-rev').value;
    if (document.getElementById('ra-iz-notes'))    this._intakeDraft.notes   = document.getElementById('ra-iz-notes').value;
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
    const submitBtn = document.getElementById('ra-iz-submit');
    const statusEl  = document.getElementById('ra-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    const barRev  = parseFloat(this._intakeDraft?.barRev)  || 0;
    const foodRev = parseFloat(this._intakeDraft?.foodRev) || 0;

    // Validation — do not run an audit with nothing to analyze
    let raFileCount = 0;
    ['ra-f-pos-daily','ra-f-menu-mix','ra-f-menu-prices','ra-f-server-sales','ra-f-upsell','ra-f-preshift','ra-f-labor-sched','ra-f-timeclock','ra-f-labor-dept','ra-f-events','ra-f-catering','ra-f-rate-card'].forEach(id => {
      const inp = document.getElementById(id);
      if (inp?.files) raFileCount += inp.files.length;
    });
    const hasRealData = raFileCount > 0 || (App.data.revenue_weeks && App.data.revenue_weeks.length > 0) || barRev > 0 || foodRev > 0;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your POS and labor reports.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

    setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

    try {
      const auditAppData = JSON.parse(JSON.stringify(App.data));
      auditAppData.settings.annual_bar_revenue  = barRev;
      auditAppData.settings.annual_food_revenue = foodRev;

      const fileInputIds = [
        'ra-f-pos-daily','ra-f-menu-mix','ra-f-menu-prices',
        'ra-f-server-sales','ra-f-upsell','ra-f-preshift',
        'ra-f-labor-sched','ra-f-timeclock','ra-f-labor-dept',
        'ra-f-events','ra-f-catering','ra-f-rate-card'
      ];
      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      form.append('notes', this._intakeDraft?.notes || '');
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));
      for (const id of fileInputIds) {
        const inp = document.getElementById(id);
        if (inp?.files) for (const f of inp.files) form.append(id, f, f.name);
      }

      const res  = await fetch('/api/generate-revenue-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      setStatus('Saving audit...', 'var(--t2)');
      const d = data.auditData || {};

      const auditRecord = {
        id:            App.uid(),
        date:          new Date().toISOString().slice(0,10),
        bar_name:      d.BAR_NAME || App.data.settings?.bar_name || '',
        overall_score: d.OVERALL_SCORE || 0,
        grade:         d.DATA_TIER_LABEL || '',
        audit_period:  d.AUDIT_PERIOD || '',
        audit_id:      d.AUDIT_ID || '',
        sections:      this.extractSections(d),
        action_items:  this.extractActionItems(d),
        raw:           d,
        generated_at:  new Date().toISOString()
      };

      if (!App.data.revenue_audits) App.data.revenue_audits = [];
      App.data.revenue_audits.push(auditRecord);
      if (App.data.revenue_audits.length > 12) App.data.revenue_audits = App.data.revenue_audits.slice(-12);
      await App.saveKey('revenue_audits');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
    }
  },


  extractSections(d) {
    const s = {};
    if (d.S1_SCORE != null) s['Check Average and Revenue'] = d.S1_SCORE;
    if (d.S2_SCORE != null) s['Labor Efficiency']          = d.S2_SCORE;
    if (d.S3_SCORE != null) s['Menu Performance']          = d.S3_SCORE;
    if (d.S4_SCORE != null) s['Server Performance']        = d.S4_SCORE;
    if (d.S5_SCORE != null) s['Events and Private Dining'] = d.S5_SCORE;
    return s;
  },

  extractActionItems(d) {
    const items = [];
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Close check average gap. $' + Math.round(d.S1_MONTHLY_GAP) + '/month at current cover count.', monthly_impact: d.S1_MONTHLY_GAP });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Reduce labor cost. $' + Math.round(d.S2_MONTHLY_GAP) + '/month over target.', monthly_impact: d.S2_MONTHLY_GAP });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Improve menu mix. $' + Math.round(d.S3_MONTHLY_GAP) + '/month opportunity from repricing Dogs.', monthly_impact: d.S3_MONTHLY_GAP });
    if (d.S4_MONTHLY_GAP > 0) items.push({ action: 'Close server performance spread. $' + Math.round(d.S4_MONTHLY_GAP) + '/month from bottom third to team average.', monthly_impact: d.S4_MONTHLY_GAP });
    if (d.S5_MONTHLY_GAP > 0) items.push({ action: 'Grow event revenue. $' + Math.round(d.S5_MONTHLY_GAP) + '/month gap to target.', monthly_impact: d.S5_MONTHLY_GAP });
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  },

  /* Verified Control-module data sent with the audit as ground truth (map
     Section 8 — Revenue labor and server roster come from Labor Control).
     Each slice appears only when its data exists, so the server never gets a
     fabricated figure. Returns null when no Control data is available. */
  buildControlData() {
    const lab = App.laborData || {};
    const r1  = n => (n == null || isNaN(n)) ? null : Math.round(n * 10) / 10;
    const cd  = { sources: [] };

    // Confirmed weekly labor and check average. Per Stage E the weekly labor
    // figure is fed from Labor Control and revenue/covers from Shift Control,
    // so the confirmed week is verified Control data.
    const weeks = (App.data.revenue_weeks || [])
      .filter(w => (w.bar_revenue||0) + (w.floor_revenue||0) > 0).slice(-4);
    if (weeks.length) {
      const avg = fn => { const v = weeks.map(fn).filter(x => x != null && !isNaN(x));
        return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
      const lp = r1(avg(w => w.labor_pct_blended));
      const rp = r1(avg(w => w.rplh_blended));
      const ca = r1(avg(w => w.check_avg));
      if (lp != null) cd.labor_pct_blended = lp;
      if (rp != null) cd.rplh_blended = rp;
      if (ca != null) cd.check_average = ca;
      if (lp != null || rp != null) cd.sources.push('Labor Control (confirmed weekly labor)');
    }

    // Labor Control — raw actual hours and cost
    const actuals = lab.lc_actuals || [];
    if (actuals.length) {
      cd.labor_hours = r1(actuals.reduce((s,a) => s + (a.hours || 0), 0));
      cd.labor_cost  = Math.round(actuals.reduce((s,a) => s + ((a.hours || 0) * (a.wage || 0)), 0));
      cd.sources.push('Labor Control actuals');
    }

    // Labor Control — staff roster (server performance section)
    const staff = lab.lc_staff || [];
    if (staff.length) {
      cd.roster_count = staff.length;
      cd.sources.push('Labor Control staff roster');
    }

    return cd.sources.length ? cd : null;
  }
};
