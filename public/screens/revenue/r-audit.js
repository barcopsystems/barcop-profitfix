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
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Revenue Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One revenue audit every 30 days. Upload your POS reports and labor data. Your scored audit appears on screen once the analysis finishes, usually within a minute or two. Print or save it as a PDF from your browser.</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">'
      +   '<button class="btn btn-primary" id="ra-new-btn">' + (canRunAudit ? (latest ? 'Generate New Audit' : 'Generate First Audit') : 'Review / Update Inputs') + '</button>'
      +   (canRunAudit ? '' : '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</div>')
      + '</div></div></div>';

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
      // List ALL five sections; an unscored one shows N/A (Not enough data)
      // instead of disappearing.
      const REV_SECTION_NAMES = ['Check Average and Revenue', 'Labor Efficiency', 'Menu Performance', 'Server Performance', 'Events and Private Dining'];
      const sectionRows = REV_SECTION_NAMES.map(name => {
        const score = sections[name];
        if (score == null) {
          return '<tr>'
            + '<td style="color:var(--t2);padding:8px 12px;">' + esc(name) + '</td>'
            + '<td style="padding:8px 12px;width:140px;"></td>'
            + '<td style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:var(--t3);padding:8px 12px;">N/A</td>'
            + '<td style="font-size:11px;color:var(--t4);padding:8px 12px;">Not enough data</td>'
            + '</tr>';
        }
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

      // Top Action Items by Impact lives on the full audit view only.
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
        + '</div>';
    }


    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first Revenue Audit above. Upload your POS reports and the scored audit appears once the analysis finishes.</div></div>'
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

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + scoreChart + comparison + historyCard + '</div>';

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

    // Findings text for sections 1-5 (S6 has signal-embedded findings).
    // Inlined under each section card via findingsBlock so the operator
    // sees scores and findings on the same page (no Findings tab).
    const findingsBlock = (num) => {
      if (num === 6) return '';
      const fields = ['S'+num+'_EVIDENCE', 'S'+num+'_GAP', 'S'+num+'_TOOL', 'S'+num+'_NARRATIVE', 'S'+num+'_FINDING'];
      const texts = fields.map(f => d[f]).filter(v => v && String(v).trim());
      if (!texts.length) return '';
      return '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b2);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Findings</div>'
        + texts.map(t => '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
        + '</div>';
    };

    const sectionBlock = (num, name, score, items, signals) => {
      const bar   = Math.min(100, Math.max(0, score||0));
      const color = App.scoreColor(score);
      const rows  = items.filter(([,v]) => v !== undefined && v !== null && v !== '').map(([label, val, highlight]) =>
        '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<td style="padding:7px 0;font-size:11px;color:var(--t3);width:55%;">' + label + '</td>'
        + '<td style="padding:7px 0;font-size:11px;color:' + (highlight==='warn'?'var(--red)':highlight==='good'?'var(--gold)':'var(--t1)') + ';font-weight:600;">' + val + '</td>'
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
      // clear N/A badge, never a red "0". The Risk Signals section also passes
      // null but supplies a signals array, so it shows no badge at all.
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

    const pct = v => v != null ? v + '%' : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null ? String(v) : '';
    const yN  = v => v === true ? 'Yes' : v === false ? 'No' : '';

    const signals6 = [
      {score:d.S6_SIG1_SCORE, label:d.S6_SIG1_LABEL, evidence:d.S6_SIG1_EVIDENCE, gap:d.S6_SIG1_GAP, tool:d.S6_SIG1_TOOL},
      {score:d.S6_SIG2_SCORE, label:d.S6_SIG2_LABEL, evidence:d.S6_SIG2_EVIDENCE, gap:d.S6_SIG2_GAP, tool:d.S6_SIG2_TOOL},
      {score:d.S6_SIG3_SCORE, label:d.S6_SIG3_LABEL, evidence:d.S6_SIG3_EVIDENCE, gap:d.S6_SIG3_GAP, tool:d.S6_SIG3_TOOL},
      {score:d.S6_SIG4_SCORE, label:d.S6_SIG4_LABEL, evidence:d.S6_SIG4_EVIDENCE, gap:d.S6_SIG4_GAP, tool:d.S6_SIG4_TOOL},
    ].filter(s => s.label);

    const sections = [
      sectionBlock(1, 'Check Average and Revenue', d.S1_SCORE, [
        ['Blended Check Average',        cur(d.S1_CHECK_AVG), d.S1_CHECK_AVG < d.S1_CHECK_AVG_TARGET ? 'warn' : 'good'],
        ['Check Average Target',         cur(d.S1_CHECK_AVG_TARGET)],
        ['Bar Check Average',            cur(d.S1_BAR_CHECK_AVG)],
        ['Food Check Average',           cur(d.S1_FOOD_CHECK_AVG)],
        ['Monthly Cover Count',          num(d.S1_COVER_COUNT)],
        ['Beverage Attachment',          d.S1_BEV_PER_COVER != null ? d.S1_BEV_PER_COVER + ' drinks per guest' : '', (d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null && d.S1_BEV_PER_COVER < d.S1_BEV_ATTACH_BENCHMARK) ? 'warn' : (d.S1_BEV_PER_COVER != null ? 'good' : '')],
        ['Attachment Benchmark',         d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null ? d.S1_BEV_ATTACH_BENCHMARK + ' drinks per guest' : ''],
        ['Drinks Sold (period)',         d.S1_BEV_PER_COVER != null ? num(d.S1_BEV_UNITS) : ''],
        ['Checks With a Drink',          d.S1_BEV_INCIDENCE_PCT != null ? d.S1_BEV_INCIDENCE_PCT + '%' : ''],
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
        ['Last Price Increase',          d.S3_LAST_PRICE_INCREASE || '', d.S3_PRICING_STALE === true ? 'warn' : ''],
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
      ...(signals6.length ? [sectionBlock(6, 'Operational Risk Signals', null, [], signals6)] : []),
    ].join('');

    const actionItems = (audit.action_items || []).map((a,i) => {
      const txt = a.action || a || '';
      const gid = a.gap_id || (window.FixPanel ? FixPanel.inferGapId(txt, 'revenue') : null);
      const btn = gid
        ? '<button class="ra-fix-btn" data-gap="' + esc(gid) + '" style="flex-shrink:0;background:transparent;border:1px solid var(--b1);color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 11px;border-radius:3px;cursor:pointer;align-self:center;">Fix This &#9656;</button>'
        : '';
      return '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:center;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;align-self:center;">' + (i+1) + '</div>'
        + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(txt) + '</div>'
        + (a.monthly_impact ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:4px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
        + '</div>'
        + btn
        + '</div>';
    }).join('');

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
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">'
      +   '<div style="flex:1;min-width:240px;">'
      +     '<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin-bottom:2px;">' + esc(App.scoreLabel(audit.overall_score||0)) + ' Revenue Score</div>'
      +     App.scoreBar(audit.overall_score||0)
      +   '</div>'
      +   '<div id="ra-outlook-mount" style="flex-shrink:0;"></div>'
      + '</div>'
      + (totalMonthly > 0 ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Total Recoverable Per Month</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly) + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Annualized</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly*12) + '</div></div>'
        + '</div>' : '')
      + '</div>'

      // Single-page layout: action items + sections inline, findings under
      // each section via findingsBlock. No tab split.
      + (actionItems ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Action Items, Ranked by Impact</div>'
        + actionItems + '</div>' : '')
      + sections

      + '</div>';

    const outlookMount = document.getElementById('ra-outlook-mount');
    if (outlookMount && window.AuditOutlook) {
      AuditOutlook.attach(outlookMount, audit, 'revenue', { compact: true });
    }

    this.container.querySelectorAll('.ra-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        App._fixFocus = btn.dataset.gap;
        App.navigate('r-fix');
      });
    });
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings render inline under each section via findingsBlock() in viewAudit().

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    // Pre-fill Annual Bar/Food Revenue. Priority: Hub Settings → 12-week
    // revenue_weeks average × 52 → empty. Operator can override.
    const s = App.data?.settings || {};
    let barRev  = s.annual_bar_revenue  != null ? String(s.annual_bar_revenue)  : '';
    let foodRev = s.annual_food_revenue != null ? String(s.annual_food_revenue) : '';
    if (!barRev || !foodRev) {
      const weeks = (App.data?.revenue_weeks || []).slice(-12);
      if (weeks.length >= 1) {
        const avgBar  = weeks.reduce((s, w) => s + (parseFloat(w.bar_revenue)   || 0), 0) / weeks.length;
        const avgFood = weeks.reduce((s, w) => s + (parseFloat(w.floor_revenue) || 0), 0) / weeks.length;
        if (!barRev  && avgBar  > 0) barRev  = String(Math.round(avgBar  * 52));
        if (!foodRev && avgFood > 0) foodRev = String(Math.round(avgFood * 52));
      }
    }
    const p = s.revenue_practices || {};
    const boolStr = v => v === true ? 'true' : v === false ? 'false' : (v || '');
    this._intakeDraft = {
      barRev, foodRev,
      practices: {
        pre_shift:          p.pre_shift || '',
        upsell_standard:    boolStr(p.upsell_standard),
        private_dining_min: boolStr(p.private_dining_min),
        menu_engineered:    boolStr(p.menu_engineered),
        last_price_increase: p.last_price_increase || '',
        labor_to_forecast:  boolStr(p.labor_to_forecast)
      }
    };
    this.actions.innerHTML = '';
    this.renderIntake();
  },

  // Single-page Revenue intake (replaces the 6-step wizard). Mirrors the Profit
  // pattern: revenue baseline + "what Bar Cop already has" + code-mapped upload
  // slots + practice questions (Select Answer = no score impact), no notes.
  renderIntake() {
    const s = App.data.settings || {};
    const d = this._intakeDraft || {};
    document.getElementById('topbar-sub').textContent = '';
    // Form viewable anytime; the 30-day cadence gates only Generate.
    const _a = (App.data.revenue_audits || []).slice().sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    const _since = _a[0] && _a[0].date ? Math.floor((Date.now() - new Date(_a[0].date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = _since >= 30;
    const daysLeft = canRun ? 0 : 30 - _since;

    const header = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Revenue Audit</div>';
    const barInfo = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Audit For</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(s.bar_name || 'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:11px;color:var(--t3);">' + esc(s.city_state) + '</div>' : '')
      + '</div>';

    const cd = this.buildControlData();
    const costedMenu = (App.data.menu_items || []).filter(i => i.price != null && i.cost != null && i.weekly_covers != null);
    const checks = [
      { label: 'Check Average',   ok: cd && cd.check_average != null },
      { label: 'Labor % / RPLH',  ok: cd && (cd.labor_pct_blended != null || cd.rplh_blended != null) },
      { label: 'Menu Mix',        ok: costedMenu.length >= 4 },
      { label: 'Server Spread',   ok: (App.data.revenue_server_checks || []).length >= 3 },
      { label: 'Events',          ok: (App.data.revenue_events || []).length > 0 }
    ];
    const chip = (c) => '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border-radius:20px;margin:0 6px 6px 0;'
      + (c.ok ? 'background:var(--gold-bg);border:1px solid rgba(219,171,70,0.35);color:var(--t1);font-weight:700;' : 'background:var(--input);border:1px solid var(--b2);color:var(--t3);') + '">'
      + (c.ok ? '<span style="color:var(--gold);font-weight:800;">&#10003;</span>' : '<span style="color:var(--t4);font-weight:800;">&middot;</span>')
      + esc(c.label) + '</span>';
    const haveControl = cd && cd.sources && cd.sources.length;
    const controlCard = haveControl
      ? '<div class="card" style="margin-bottom:16px;"><div style="font-size:13px;font-weight:800;color:var(--t1);margin-bottom:4px;">What Bar Cop already has</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.6;">These come from your Bar Cop data as verified ground truth. Uploads only fill what is not checked, or add deeper detail.</div>'
        + '<div>' + checks.map(chip).join('') + '</div></div>'
      : '<div class="card" style="margin-bottom:16px;"><div style="font-size:12px;color:var(--t2);line-height:1.6;">Bar Cop has no Revenue data yet for this bar, so this first audit reads from the reports you upload below. As you log shifts, schedules, menu, and servers in Bar Cop, those numbers flow in automatically.</div></div>';

    const revLabel = (txt) => '<label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">' + txt + '</label>';
    const revInput = (id, ph, val) => '<div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="' + id + '" placeholder="' + ph + '" value="' + esc(val || '') + '" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div>';
    const revCard = '<div class="card" style="margin-bottom:16px;">' + header + barInfo
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">'
      +   '<div style="font-size:16px;font-weight:800;color:var(--t1);">Annual Revenue</div>'
      +   '<button class="btn btn-ghost btn-sm" id="ra-how-btn">How this works</button>'
      + '</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:18px;line-height:1.6;">Enter your annual revenue. This sets the dollar baselines for every gap. Enter at least one figure. A bar with no kitchen can leave Food Revenue blank.</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:200px;">' + revLabel('Annual Bar Revenue') + revInput('ra-iz-bar-rev', '618000', d.barRev) + '</div>'
      + '<div style="flex:1;min-width:200px;">' + revLabel('Annual Food Revenue (leave blank if none)') + revInput('ra-iz-food-rev', '372000', d.foodRev) + '</div>'
      + '</div></div>';

    const uploadCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Your Reports</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">All optional. Anything Bar Cop already has from your Control systems is used automatically. Drop in any of the reports below to score a section Bar Cop cannot see yet, or for deeper detail. One drop zone takes them all.</div>'
      + FileDrop.render('ra-drop', { items: [
          { t: 'POS Sales Summary',          s: 'Scores Check Average (revenue, covers, blended check average).' },
          { t: 'Server Sales Report',        s: 'Scores Server Performance (check average by server, spread, top and bottom).', hi: true },
          { t: 'Menu Sales Mix and Pricing', s: 'Scores Menu Performance (Stars, Plowhorses, Dogs, pricing).' },
          { t: 'Labor Schedule or Payroll',  s: 'Scores Labor Efficiency (labor percent, RPLH, overtime).' },
          { t: 'Event and Catering Records', s: 'Scores Events and Private Dining (event revenue, frequency).' }
        ] })
      + '</div>';

    const pr = d.practices || {};
    const qRow = (label, id, options) => {
      const all = [['', 'Select Answer']].concat(options);
      const opts = all.map(o => '<option value="' + esc(o[0]) + '"' + (String(pr[id] || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
      return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="flex:1;font-size:12px;color:var(--t1);">' + esc(label) + '</div>'
        + '<select id="ra-q-' + id + '" style="background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-size:12px;padding:6px 8px;min-width:150px;">' + opts + '</select></div>';
    };
    const questionsCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">A Few Quick Questions</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:8px;line-height:1.6;">These shape your scores and usually are not in your reports. Anything left on Select Answer has no effect. They carry over to your next audit.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0 28px;">'
      + qRow('Pre-shift briefing held?',                'pre_shift',          [['never','Never'],['sometimes','Sometimes'],['every','Every shift']])
      + qRow('Server upsell standard taught and tracked?','upsell_standard',  [['false','No'],['true','Yes']])
      + qRow('Private dining package with a spend minimum?','private_dining_min',[['false','No'],['true','Yes']])
      + qRow('Menu repriced or engineered in last 6 months?','menu_engineered',[['false','No'],['true','Yes']])
      + qRow('When did you last raise menu prices?',    'last_price_increase',[['within_6mo','Within 6 months'],['6_12mo','6 to 12 months'],['over_year','Over a year ago'],['never','Cannot recall']])
      + qRow('Labor scheduled to a sales forecast?',    'labor_to_forecast',  [['false','No'],['true','Yes']])
      + '</div></div>';

    const submitCard = '<div class="card">'
      + '<div class="card-actions" style="display:flex;align-items:center;gap:8px;">'
      + (canRun
          ? '<button class="btn btn-primary" id="ra-iz-submit">Generate Audit</button>'
          : '<button class="btn btn-primary" id="ra-iz-submit" disabled style="opacity:0.5;cursor:default;">Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</button>')
      + '<div id="ra-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></div>'
      + '<div style="flex:1;"></div>'
      + '<button class="btn btn-ghost" id="ra-iz-cancel">' + (canRun ? 'Cancel' : 'Back') + '</button></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">' + (canRun ? 'Analysis takes 60 to 90 seconds.' : 'You can review and update your inputs now. The next audit can be generated in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '.') + '</div></div>';

    this.container.innerHTML = '<div class="screen">' + revCard + controlCard + uploadCard + questionsCard + submitCard + '</div>';
    FileDrop.attach('ra-drop');

    document.getElementById('ra-how-btn')?.addEventListener('click', () => App.showHelpModal('How the Revenue Audit Works', [
      { p: ['The Revenue Audit scores five areas: Check Average, Labor Efficiency, Menu Performance, Server Performance, and Events. It scores whatever data it can see and shows N/A for anything it cannot.'] },
      { h: 'What Bar Cop already has', p: ['If you log weekly numbers, schedules, menu items, and servers in Bar Cop, those feed the audit automatically. A new operation reads from what you enter and upload here instead.'] },
      { h: 'The steps', p: ['1. Enter your annual revenue (the dollar baseline).', '2. Upload any reports for a section Bar Cop cannot see yet (a POS sales summary covers Check Average, a server sales report covers Server Performance, and so on).', '3. Answer the quick questions about how you operate.', '4. Generate. Sections with no data show N/A and fill in over time.'] },
      { h: 'The honest rule', p: ['Cost savings (labor) and revenue growth (check average, menu, servers, events) are kept separate, never blended into one number. Every figure is computed in code from your real data.'] }
    ]));
    document.getElementById('ra-iz-cancel')?.addEventListener('click', () => { document.getElementById('topbar-sub').textContent = ''; this.renderMain(); });
    document.getElementById('ra-iz-submit')?.addEventListener('click', () => {
      const barRev = parseFloat(document.getElementById('ra-iz-bar-rev')?.value) || 0;
      const foodRev = parseFloat(document.getElementById('ra-iz-food-rev')?.value) || 0;
      if (barRev === 0 && foodRev === 0) {
        const st = document.getElementById('ra-iz-status');
        if (st) { st.style.display = 'block'; st.style.color = 'var(--red)'; st.textContent = 'Enter at least one revenue figure to run the audit.'; }
        return;
      }
      this._intakeDraft.barRev = document.getElementById('ra-iz-bar-rev')?.value || '';
      this._intakeDraft.foodRev = document.getElementById('ra-iz-food-rev')?.value || '';
      const val = id => (document.getElementById('ra-q-' + id) || {}).value || '';
      this._intakeDraft.practices = {
        pre_shift:          val('pre_shift'),
        upsell_standard:    val('upsell_standard'),
        private_dining_min: val('private_dining_min'),
        menu_engineered:    val('menu_engineered'),
        last_price_increase: val('last_price_increase'),
        labor_to_forecast:  val('labor_to_forecast')
      };
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

    const header = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Revenue Audit</div>';

    const cd = this.buildControlData();
    const controlBanner = (cd && cd.sources && cd.sources.length)
      ? '<div style="background:var(--gold-bg);border:1px solid rgba(219,171,70,0.35);border-radius:6px;padding:12px 16px;margin-bottom:16px;">'
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
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;">Enter your annual bar and food revenue. This sets the dollar baselines for every gap calculation. Your Bar Cop data from the last 30 days is included automatically.</div>'
        + '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
        + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Required</span>Annual Bar Revenue</label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-iz-bar-rev" placeholder="480000" value="' + esc(this._intakeDraft.barRev) + '" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
        + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Required</span>Annual Food Revenue</label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-iz-food-rev" placeholder="320000" value="' + esc(this._intakeDraft.foodRev) + '" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
        + '</div>'
        + nav(false, true, false) + '</div>';
    } else if (step === 2) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Sales Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">The POS Daily Sales Summary is required. Additional files add deeper category and menu scoring.</div>'
        + this.renderFileSection('required', 'POS Daily Sales Summary',   'ra-f-pos-daily',   'ra-pos-daily',   'Adds: Revenue trend, category split, blended check average')
        + this.renderFileSection('optional', 'Menu Sales Mix Report',      'ra-f-menu-mix',    'ra-menu-mix',    'Adds: Category concentration, menu engineering signals')
        + this.renderFileSection('optional', 'Menu Price List',            'ra-f-menu-prices', 'ra-menu-prices', 'Adds: Pricing gap analysis, contribution margin assessment')
        + nav(true, true, false) + '</div>';
    } else if (step === 3) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Server and Floor Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Server sales report is the highest-value file in this audit. Adds two full scored sections on its own.</div>'
        + this.renderFileSection('highlight', 'Server Sales Report',          'ra-f-server-sales', 'ra-server-sales', 'Adds: Check average by server, performance spread, top and bottom server, two full scored sections')
        + this.renderFileSection('optional',  'Server Upsell Tracking Report','ra-f-upsell',       'ra-upsell',       'Adds: Appetizer and dessert attach rates, upsell execution scoring by server')
        + this.renderFileSection('optional',  'Pre-Shift Briefing Log',       'ra-f-preshift',     'ra-preshift',     'Adds: Assessment of whether a performance standard is being communicated')
        + nav(true, true, false) + '</div>';
    } else if (step === 4) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Labor Data</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Labor schedule is required for RPLH and prime cost calculations. Payroll actuals add deeper variance analysis.</div>'
        + this.renderFileSection('optional', 'Weekly Labor Schedule',       'ra-f-labor-sched', 'ra-labor-sched', 'Adds: Required for RPLH calculation, labor percentage, schedule efficiency analysis')
        + this.renderFileSection('optional', 'Time Clock or Payroll Actuals','ra-f-timeclock',   'ra-timeclock',   'Adds: Clock drift analysis, actual vs scheduled hours, verified overtime cost')
        + this.renderFileSection('optional', 'Labor Cost by Department',    'ra-f-labor-dept',  'ra-labor-dept',  'Adds: Department-level labor targeting, identifies which department is driving overage')
        + nav(true, true, false) + '</div>';
    } else if (step === 5) {
      stepHtml = '<div class="card">' + header
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px;">Events and Private Dining</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6;">All optional. Upload whatever you have. Each file unlocks event revenue scoring and gap analysis.</div>'
        + this.renderFileSection('optional', 'Private Dining and Event Revenue Records','ra-f-events',    'ra-events',    'Adds: Event frequency, average event revenue, minimum compliance, annual event revenue gap')
        + this.renderFileSection('optional', 'Catering Revenue Records',                'ra-f-catering',  'ra-catering',  'Adds: Catering revenue trend, package performance, repeat client rate')
        + this.renderFileSection('optional', 'Private Dining Rate Card',                'ra-f-rate-card', 'ra-rate-card', 'Adds: Pricing position analysis, minimum structure assessment')
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
    if (App.demoBlock('Running an audit')) return;
    const submitBtn = document.getElementById('ra-iz-submit');
    const statusEl  = document.getElementById('ra-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    const barRev  = parseFloat(this._intakeDraft?.barRev)  || 0;
    const foodRev = parseFloat(this._intakeDraft?.foodRev) || 0;

    // Validation — do not run an audit with nothing to analyze. Files come from
    // the single shared drop zone.
    const dropFiles = FileDrop.getFiles('ra-drop');
    const hasRealData = dropFiles.length > 0 || (App.data.revenue_weeks && App.data.revenue_weeks.length > 0) || barRev > 0 || foodRev > 0;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your POS and labor reports.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

    setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

    try {
      const draftP = this._intakeDraft?.practices || {};
      App.data.settings.annual_bar_revenue  = barRev;
      App.data.settings.annual_food_revenue = foodRev;
      App.data.settings.revenue_practices   = draftP;
      await App.saveKey('settings');

      // Unanswered question ('') is omitted so it has no score effect.
      const practices = {};
      if (draftP.pre_shift) practices.pre_shift = draftP.pre_shift;
      if (draftP.upsell_standard === 'true' || draftP.upsell_standard === 'false') practices.upsell_standard = draftP.upsell_standard === 'true';
      if (draftP.private_dining_min === 'true' || draftP.private_dining_min === 'false') practices.private_dining_min = draftP.private_dining_min === 'true';
      if (draftP.menu_engineered === 'true' || draftP.menu_engineered === 'false') practices.menu_engineered = draftP.menu_engineered === 'true';
      if (draftP.last_price_increase) practices.last_price_increase = draftP.last_price_increase;
      if (draftP.labor_to_forecast === 'true' || draftP.labor_to_forecast === 'false') practices.labor_to_forecast = draftP.labor_to_forecast === 'true';

      const auditAppData = JSON.parse(JSON.stringify(App.data));

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      form.append('practices', JSON.stringify(practices));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));
      for (const f of dropFiles) form.append('file', f, f.name);

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
      App.markSetupDone('gs_r_audit');

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
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Close check average gap. $' + Math.round(d.S1_MONTHLY_GAP) + '/month at current cover count.', monthly_impact: d.S1_MONTHLY_GAP, gap_id: 'check-average' });
    // Beverage attachment routes to the same check-average lever. No separate
    // dollar (monthly_impact 0) so it never double-counts the check-average gap.
    if (d.S1_BEV_PER_COVER != null && d.S1_BEV_ATTACH_BENCHMARK != null && d.S1_BEV_PER_COVER < d.S1_BEV_ATTACH_BENCHMARK) {
      items.push({ action: 'Lift beverage attachment. ' + d.S1_BEV_PER_COVER + ' drinks per guest vs a ' + d.S1_BEV_ATTACH_BENCHMARK + ' benchmark. Build the drink into every table, it is the highest-margin add.', monthly_impact: 0, gap_id: 'check-average' });
    }
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Reduce labor cost. $' + Math.round(d.S2_MONTHLY_GAP) + '/month over target.', monthly_impact: d.S2_MONTHLY_GAP, gap_id: 'labor-scheduling' });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Improve menu mix. $' + Math.round(d.S3_MONTHLY_GAP) + '/month opportunity from repricing Dogs.', monthly_impact: d.S3_MONTHLY_GAP, gap_id: 'menu-engineering' });
    // Pricing lag — operator-stated, no fabricated dollar (we have no per-item
    // price-vs-market data). Surfaced as a finding routing to repricing.
    if (d.S3_PRICING_STALE === true) items.push({ action: 'Reprice the menu. Your last price increase was ' + (d.S3_LAST_PRICE_INCREASE ? d.S3_LAST_PRICE_INCREASE.toLowerCase() : 'over a year ago') + '. Inflation has quietly eaten the margin on every plate since then.', monthly_impact: 0, gap_id: 'pricing' });
    if (d.S4_MONTHLY_GAP > 0) items.push({ action: 'Close server performance spread. $' + Math.round(d.S4_MONTHLY_GAP) + '/month from bottom third to team average.', monthly_impact: d.S4_MONTHLY_GAP, gap_id: 'server-performance' });
    if (d.S5_MONTHLY_GAP > 0) items.push({ action: 'Grow event revenue. $' + Math.round(d.S5_MONTHLY_GAP) + '/month gap to target.', monthly_impact: d.S5_MONTHLY_GAP, gap_id: 'events-catering' });
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
