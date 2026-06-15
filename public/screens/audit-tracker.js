'use strict';
S.AuditTracker = {

  render(container, actions) {
    this.container = container;
    this.actions   = actions;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    this.actions.innerHTML = '';
    const audits       = (App.data.audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest       = audits[0] || null;
    // 30-day rolling: next audit is available 30 days after the last one
    // ran, independent of the calendar month. First audit is always available.
    const daysSince    = latest && latest.date
      ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000)
      : Infinity;
    const canRunAudit  = daysSince >= 30;
    const daysLeft     = canRunAudit ? 0 : 30 - daysSince;

    const requestCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Profit Audit</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      + '<div style="font-size:12px;color:var(--t3);max-width:520px;line-height:1.6;">One audit every 30 days. It scores from your Control data plus anything you upload, and the result shows on screen in a minute or two.</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">'
      + '<button class="btn btn-primary" id="at-new-btn">' + (canRunAudit ? (latest ? 'Generate New Audit' : 'Generate First Audit') : 'Review / Update Inputs') + '</button>'
      + (canRunAudit ? '' : '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</div>')
      + '</div></div></div>';

    let latestCard = '';
    if (latest) {
      const prev       = audits[1] || null;
      const scoreColor = App.scoreColor(latest.overall_score);
      const scoreLabel = App.scoreLabel(latest.overall_score);
      let vsLine = '';
      if (prev) {
        const diff = (latest.overall_score||0) - (prev.overall_score||0);
        vsLine = '<div style="font-size:12px;margin-top:8px;"><span style="color:' + (diff>=0?'var(--green)':'var(--red)') + ';font-weight:700;">' + (diff>=0?'+':'') + diff + ' pts</span><span style="color:var(--t3);"> vs last audit (' + prev.overall_score + ' to ' + latest.overall_score + ')</span></div>';
      }

      const heroCard = '<div class="card form-card" style="margin-bottom:16px;">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Audit</div>'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '  ' + esc(latest.audit_period) : '') + '</div>'
        + vsLine + '</div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:52px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin:2px 0 8px;">' + scoreLabel + '</div>'
        + '<button class="btn btn-ghost btn-sm at-view-btn" data-idx="0">View Full Audit</button>'
        + '</div></div></div>';

      const sections = latest.sections || {};
      // All five sections always listed; a section with no score shows N/A.
      const secRows = (App.AUDIT_PROFIT_SECTION_NAMES || Object.keys(sections)).map(name => {
        const score = sections[name];
        if (score == null) {
          return '<tr><td><div class="val">' + esc(name) + '</div></td><td></td>'
            + '<td style="color:var(--t3);font-weight:700;">N/A</td>'
            + '<td style="color:var(--t4);font-size:11px;">Not enough data</td></tr>';
        }
        const ps   = prev?.sections?.[name];
        const diff = ps != null ? score - ps : null;
        const bar  = Math.min(100, Math.max(0, score));
        return '<tr><td><div class="val">' + esc(name) + '</div></td>'
          + '<td style="width:130px;"><div style="background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + App.scoreColor(score) + ';border-radius:3px;"></div></div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + App.scoreColor(score) + ';">' + score + '</td>'
          + '<td style="color:' + (diff==null?'var(--t3)':diff>=0?'var(--green)':'var(--red)') + ';">' + (diff!=null?(diff>=0?'+':'')+diff:'') + '</td></tr>';
      }).join('');
      const sectionCard = '<div class="sh" style="margin:24px 0 10px;">Section Breakdown</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Section</th><th></th><th>Score</th><th>Change</th></tr></thead><tbody>' + secRows + '</tbody></table></div></div>';

      latestCard = heroCard + sectionCard;
    }

    let historyCard = '';
    if (audits.length > 1) {
      const tierChip = (tier) => {
        if (!tier) return '';
        const full = tier.includes('3') || tier.toLowerCase().includes('full');
        return '<span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 9px;border-radius:20px;'
          + (full ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);'
                  : 'background:transparent;border:1px solid var(--b1);color:var(--t3);') + '">' + esc(tier) + '</span>';
      };
      const rows = audits.slice(0, App.listLimit('core', 'audit')).map((a,i) => {
        const p    = audits[i+1];
        const diff = p ? (a.overall_score||0) - (p.overall_score||0) : null;
        return '<tr><td><div class="val">' + (a.date||'').slice(0,10) + '</div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + App.scoreColor(a.overall_score||0) + ';">' + (a.overall_score||0) + '</td>'
          + '<td style="color:' + (diff==null?'var(--t3)':diff>=0?'var(--green)':'var(--red)') + ';">' + (diff!=null?(diff>=0?'+':'')+diff+' pts':'') + '</td>'
          + '<td>' + tierChip(a.grade) + '</td>'
          + '<td style="text-align:right;"><button class="btn btn-ghost btn-sm at-view-btn" data-idx="' + i + '">View</button></td></tr>';
      }).join('');
      historyCard = '<div class="sh" style="margin:24px 0 10px;">Audit History</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Score</th><th>Change</th><th>Data Quality</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        + App.showOlderBar('core', 'audit', audits, false);
    }

    const emptyState = !latest
      ? '<div class="card form-card"><div style="text-align:center;padding:22px;"><div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:6px;">No audits yet</div>'
        + '<div style="font-size:12px;color:var(--t3);">Generate your first Profit Audit above. It scores from your Control data plus anything you upload.</div></div></div>'
      : '';



    // Score history chart — capped to the last 4 audits inside renderScoreChart
    // so it never clutters. Comparison + per-section sparklines dropped; the
    // section Change column and this chart already carry the trend.
    const scoreChart = audits.length >= 2 ? this.renderScoreChart(audits, 'at') : '';

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + scoreChart + historyCard + '</div>';

    document.getElementById('at-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.at-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx)));
    });
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.renderMain()));
  },

  renderScoreChart(audits, prefix) {
    const sorted = audits.slice().sort((a,b) => new Date(a.date||0) - new Date(b.date||0)).slice(-4);
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
    const linePath  = smoothPath(scores);
    const fillPath  = areaPath(scores);
    const xLabels   = sorted.map((a,i) =>
      `<text x="${xs(i).toFixed(1)}" y="${H-4}" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${(a.date||'').slice(0,7)}</text>`
    ).join('');
    const dots = sorted.map((a,i) => {
      const v = a.overall_score||0;
      const col = App.scoreHex(v);
      return `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="5" fill="#0A1520" stroke="${col}" stroke-width="2.5"/>
        <text x="${xs(i).toFixed(1)}" y="${(ys(v)-10).toFixed(1)}" text-anchor="middle" fill="${col}" font-family="'Barlow Condensed',sans-serif" font-size="13" font-weight="700">${v}</text>`;
    }).join('');

    return '<div class="card" style="margin-bottom:16px;padding:20px 24px 16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Profit Score History</div>'
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
    const audits = (App.data.audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const audit  = audits[idx];
    if (!audit) return;

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
    printBtn.onclick = () => this.exportPDF(audit);
    this.actions.appendChild(printBtn);


    const d = audit.raw || audit;
    const scoreColor = App.scoreColor(audit.overall_score||0);

    // Findings text for a section. S1-S5 store evidence + gap + tool +
    // narrative + finding in flat fields per the audit data shape; S6 stores
    // the equivalent inside each signal object so its findings render via
    // sigRows already. This helper pulls the S1-S5 findings text inline so
    // operators see scores and findings on the same page (no Findings tab).
    const findingsBlock = (num) => {
      if (num === 6) return '';
      const fields = ['S'+num+'_EVIDENCE', 'S'+num+'_GAP', 'S'+num+'_TOOL', 'S'+num+'_NARRATIVE', 'S'+num+'_FINDING'];
      const texts = fields.map(f => d[f]).filter(v => v && String(v).trim());
      if (!texts.length) return '';
      return '<div style="margin-top:14px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Findings</div>'
        + texts.map(t => '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
        + '</div>';
    };

    const sectionBlock = (num, name, score, items, signals) => {
      const bar   = Math.min(100, Math.max(0, score||0));
      const color = App.scoreColor(score);
      const rows  = items.filter(([,v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0').map(([label, val, highlight]) =>
        '<tr><td>' + label + '</td>'
        + '<td style="color:' + (highlight==='warn'?'var(--red)':highlight==='good'?'var(--gold)':'var(--t1)') + ';">' + val + '</td></tr>'
      ).join('');
      const sigRows = (signals||[]).map(sig => {
        const sc = (sig.score||'').toUpperCase();
        const dot = sc==='HIGH'?'var(--red)':sc==='MEDIUM'?'var(--amber)':'var(--t3)';
        return '<div style="border:1px solid var(--b-edge);border-radius:8px;padding:12px;margin-top:10px;">'
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
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
        + scoreBlock + '</div>'
        + (rows ? '<div class="at-metrics"><table class="at-mtbl">' + rows + '</table></div>' : '')
        + sigRows
        + findingsBlock(num)
        + '</div>';
    };

    const pct = (v,t) => v ? v+'%' + (t?' (Target: '+t+'%)':'') : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null && v !== 0 ? String(v) : '';
    const yN  = v => v===true?'Yes':v===false?'No':'';

    const gap = (v) => v > 0 ? [cur(v), 'warn'] : v < 0 ? [cur(Math.abs(v)) + ' under target', 'good'] : [''];
    const [s1gap]  = gap(d.S1_MONTHLY_GAP);
    const [s2gap]  = gap(d.S2_MONTHLY_GAP);
    const [s3gap]  = gap(d.S3_MONTHLY_GAP);
    const [s5gap]  = gap(d.S5_PRIME_COST_PCT - (d.S5_TARGET_PCT||60) > 0 ? d.S5_COMBINED_COGS_GAP : 0);

    const signals6 = [
      {score:d.S6_SIG1_SCORE, label:d.S6_SIG1_LABEL, evidence:d.S6_SIG1_EVIDENCE, gap:d.S6_SIG1_GAP, tool:d.S6_SIG1_TOOL},
      {score:d.S6_SIG2_SCORE, label:d.S6_SIG2_LABEL, evidence:d.S6_SIG2_EVIDENCE, gap:d.S6_SIG2_GAP, tool:d.S6_SIG2_TOOL},
      {score:d.S6_SIG3_SCORE, label:d.S6_SIG3_LABEL, evidence:d.S6_SIG3_EVIDENCE, gap:d.S6_SIG3_GAP, tool:d.S6_SIG3_TOOL},
      {score:d.S6_SIG4_SCORE, label:d.S6_SIG4_LABEL, evidence:d.S6_SIG4_EVIDENCE, gap:d.S6_SIG4_GAP, tool:d.S6_SIG4_TOOL},
    ].filter(s => s.label);

    const NAMES = App.AUDIT_PROFIT_SECTION_NAMES;
    const sections = [
      sectionBlock(1, NAMES[0], d.S1_SCORE, [
        ['Bar Pour Cost %',         pct(d.S1_BAR_COST_PCT, d.S1_TARGET_PCT), d.S1_BAR_COST_PCT > d.S1_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Bar Revenue',     cur(d.S1_BAR_REV_MONTHLY)],
        ['Bev COGS Period',         cur(d.S1_BEV_COGS_PERIOD)],
        ['Inventory Variance %',    pct(d.S1_INV_VARIANCE_PCT), d.S1_INV_VARIANCE_PCT > 2 ? 'warn' : ''],
        ['Inventory Variance $',    cur(d.S1_INV_VARIANCE_AMT), d.S1_INV_VARIANCE_AMT > 500 ? 'warn' : ''],
        ['Draft Beer Yield',        d.S1_DRAFT_YIELD_PCT != null ? d.S1_DRAFT_YIELD_PCT + '%' : '', (d.S1_DRAFT_LOSS_PCT != null && d.S1_DRAFT_LOSS_PCT >= 12) ? 'warn' : (d.S1_DRAFT_YIELD_PCT != null ? 'good' : '')],
        ['Draft Yield Loss',        d.S1_DRAFT_LOSS_PCT != null ? d.S1_DRAFT_LOSS_PCT + '% to foam and over-pour' : '', d.S1_DRAFT_LOSS_PCT >= 12 ? 'warn' : ''],
        ['Pour Method',             d.S1_POUR_METHOD],
        ['Recipe Coverage',         d.S1_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',   s1gap || (d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : ''), d.S1_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S1_ANNUAL_GAP), d.S1_ANNUAL_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(2, NAMES[1], d.S2_SCORE, [
        ['Void/Comp %',             pct(d.S2_VOID_COMP_PCT), d.S2_VOID_COMP_PCT > 2 ? 'warn' : ''],
        ['Void/Comp Amount',        cur(d.S2_VOID_COMP_AMT), d.S2_VOID_COMP_AMT > 0 ? 'warn' : ''],
        ['Unauthorized Voids %',    pct(d.S2_VOIDS_NO_APPROVAL_PCT), d.S2_VOIDS_NO_APPROVAL_PCT > 0 ? 'warn' : ''],
        ['Discount % of Sales',     d.S2_DISCOUNT_PCT != null ? d.S2_DISCOUNT_PCT + '%' + (d.S2_DISCOUNT_BENCHMARK_PCT != null ? ' (Benchmark: under ' + d.S2_DISCOUNT_BENCHMARK_PCT + '%)' : '') : '', (d.S2_DISCOUNT_PCT != null && d.S2_DISCOUNT_BENCHMARK_PCT != null && d.S2_DISCOUNT_PCT > d.S2_DISCOUNT_BENCHMARK_PCT) ? 'warn' : ''],
        ['Discount Total',          d.S2_DISCOUNT_PCT != null ? cur(d.S2_DISCOUNT_TOTAL) : ''],
        ['No-Sale Drawer Opens',    d.S2_NO_SALE_COUNT != null ? num(d.S2_NO_SALE_COUNT) : '', d.S2_NO_SALE_COUNT > 0 ? 'warn' : ''],
        ['Drawer Reconciliation',   d.S2_DRAWER_RECON],
        ['Cash Policy Documented',  d.S2_CASH_POLICY],
        ['Void Approval Required',  d.S2_VOID_APPROVAL],
        ['Spillage Log',            d.S2_SPILLAGE_LOG],
        ['Monthly Gap',             cur(d.S2_MONTHLY_GAP), d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(3, NAMES[2], d.S3_SCORE, [
        ['Food Cost %',             pct(d.S3_FOOD_COST_PCT, d.S3_TARGET_PCT), d.S3_FOOD_COST_PCT > d.S3_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Food Revenue',    cur(d.S3_FOOD_REV_MONTHLY)],
        ['Food Variance %',         pct(d.S3_FOOD_VAR_PCT), d.S3_FOOD_VAR_PCT > 3 ? 'warn' : ''],
        ['Food Variance $',         cur(d.S3_FOOD_VAR_AMT)],
        ['Recipe Coverage',         d.S3_RECIPE_COVERAGE],
        ['Inventory Frequency',     d.S3_INV_FREQ],
        ['Waste Log',               d.S3_WASTE_LOG],
        ['Monthly Gap vs Target',   cur(d.S3_MONTHLY_GAP), d.S3_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S3_ANNUAL_GAP), d.S3_ANNUAL_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(4, NAMES[3], d.S4_SCORE, [
        ['Bev Invoice Count',       num(d.S4_BEV_INVOICE_COUNT)],
        ['Food Invoice Count',      num(d.S4_FOOD_INVOICE_COUNT)],
        ['Monthly Vendor Spend',    cur(d.S4_VENDOR_SPEND_MONTHLY)],
        ['Invoice vs PO Matching',  d.S4_INVOICE_VS_PO],
        ['Price Verification',      d.S4_PRICE_VERIFY],
        ['Annual Bid Process',      d.S4_ANNUAL_BIDS],
        ['Backup Vendors',          d.S4_BACKUP_VENDORS],
        ['Uncollected Vendor Credits', d.S4_UNCOLLECTED_CREDITS != null ? cur(d.S4_UNCOLLECTED_CREDITS) + (d.S4_OPEN_CREDIT_COUNT ? ' across ' + d.S4_OPEN_CREDIT_COUNT + ' open' : '') : '', d.S4_UNCOLLECTED_CREDITS > 0 ? 'warn' : ''],
        ['Credits Recovered',       d.S4_RECOVERED_CREDITS != null ? cur(d.S4_RECOVERED_CREDITS) : ''],
        ['Credit Recovery Rate',    d.S4_CREDIT_RECOVERY_PCT != null ? d.S4_CREDIT_RECOVERY_PCT + '%' : '', (d.S4_CREDIT_RECOVERY_PCT != null && d.S4_CREDIT_RECOVERY_PCT < 40) ? 'warn' : ''],
        ['Monthly Exposure',        cur(d.S4_EXPOSURE_MONTHLY), d.S4_EXPOSURE_MONTHLY > 500 ? 'warn' : ''],
        ['Annual Exposure',         cur(d.S4_EXPOSURE_ANNUAL),  d.S4_EXPOSURE_ANNUAL  > 5000? 'warn' : ''],
      ]),
      sectionBlock(5, NAMES[4], d.S5_SCORE, [
        ['Total Revenue Period',    cur(d.S5_TOTAL_REV_PERIOD)],
        ['Total COGS Period',       cur(d.S5_TOTAL_COGS_PERIOD)],
        ['Labor Period',            cur(d.S5_LABOR_PERIOD)],
        ['Labor %',                 pct(d.S5_LABOR_PCT), d.S5_LABOR_PCT > 35 ? 'warn' : ''],
        ['Bar Pour Cost %',         pct(d.S5_BAR_COST_PCT)],
        ['Food Cost %',             pct(d.S5_FOOD_COST_PCT)],
        ['Prime Cost %',            pct(d.S5_PRIME_COST_PCT, d.S5_TARGET_PCT), d.S5_PRIME_COST_PCT > (d.S5_TARGET_PCT||60) ? 'warn' : 'good'],
        ['Prime Cost Amount',       cur(d.S5_PRIME_COST_AMT)],
        ['RPLH Tracked',            d.S5_RPLH_TRACKED],
        ['Labor by Department',     d.S5_LABOR_BY_DEPT],
        ['Monthly COGS Gap',        cur(d.S5_COMBINED_COGS_GAP), d.S5_COMBINED_COGS_GAP > 0 ? 'warn' : ''],
      ]),
      ...(signals6.length ? [sectionBlock(6, 'Operational Risk Signals', null, [], signals6)] : []),
    ].join('');

    const actionItems = (audit.action_items || []).map((a,i) => {
      const txt = a.action || a || '';
      const gid = a.gap_id || (window.FixPanel ? FixPanel.inferGapId(txt, 'profit') : null);
      const btn = gid
        ? '<button class="at-fix-btn" data-gap="' + esc(gid) + '" style="flex-shrink:0;background:transparent;border:1px solid var(--b1);color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 11px;border-radius:3px;cursor:pointer;align-self:center;">Fix This</button>'
        : '';
      return '<div class="at-arow" style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:center;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;align-self:center;">' + (i+1) + '</div>'
        + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(txt) + '</div>'
        + (a.monthly_impact ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:4px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
        + '</div>'
        + btn
        + '</div>';
    }).join('');

    // Data Quality tier badge — app colors only: gold-tint when full coverage,
    // neutral otherwise (never solid bright gold or off-palette yellow).
    const grade = audit.grade || '';
    const gradeChip = grade
      ? (() => { const full = grade.includes('3') || grade.toLowerCase().includes('full');
          return '<span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;'
            + (full ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);'
                    : 'background:transparent;border:1px solid var(--b1);color:var(--t3);') + '">' + esc(grade) + '</span>'; })()
      : '';

    // Score hero (.form-card) — name + meta + tier on the left, the big Profit
    // Score on the right; below, the score label + scale bar with the Bar Cop
    // Outlook mounting next to it.
    const heroCard = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Profit Recovery Audit</div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
        + (audit.date||'').slice(0,10)
        + (audit.audit_period ? '  |  ' + esc(audit.audit_period) : '')
        + (audit.audit_id ? '  |  ' + esc(audit.audit_id) : '')
        + '</div>'
      + (gradeChip ? '<div style="margin-top:8px;">' + gradeChip + '</div>' : '')
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Profit Score</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:72px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (audit.overall_score||0) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + (d.INDUSTRY_AVG != null ? 'Bar Cop Benchmark: ' + d.INDUSTRY_AVG + '  |  ' : '') + 'Target: ' + (d.TARGET_SCORE||65) + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">'
      +   '<div style="flex:1;min-width:240px;">'
      +     '<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin-bottom:2px;">' + esc(App.scoreLabel(audit.overall_score||0)) + ' Profit Score</div>'
      +     App.scoreBar(audit.overall_score||0)
      +   '</div>'
      +   '<div id="at-outlook-mount" style="flex-shrink:0;"></div>'
      + '</div></div>';

    // Total recoverable — the money hero, as a standard stat strip (calc-val lg).
    const totalMonthly = (audit.action_items||[]).reduce((s,a) => s+(a.monthly_impact||0), 0);
    const calcItem = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg good">' + val + '</div></div>';
    const recoverStrip = totalMonthly > 0
      ? '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + calcItem('Recoverable / Month', App.fmtCurrency(totalMonthly))
        + calcItem('Annualized', App.fmtCurrency(totalMonthly*12))
        + (d.WEEKLY_GAP_AMT ? calcItem('Weekly Gap', esc(String(d.WEEKLY_GAP_AMT))) : '')
        + '</div></div>'
      : '';

    // Single-page layout: ranked action items, then the scored sections (each
    // with its metric readout + findings rendered inline via findingsBlock).
    const actionsCard = actionItems
      ? '<div class="sh" style="margin:24px 0 10px;">Action Items, Ranked by Impact</div>'
        + '<div class="card" style="margin-bottom:16px;">' + actionItems + '</div>'
      : '';

    this.container.innerHTML = '<div class="screen">'
      + heroCard
      + recoverStrip
      + actionsCard
      + sections
      + '</div>';

    // Bar Cop Outlook mounts into the audit detail header next to the score.
    // Shared helper handles click + cache + render across all 4 audits.
    const outlookMount = document.getElementById('at-outlook-mount');
    if (outlookMount && window.AuditOutlook) {
      AuditOutlook.attach(outlookMount, audit, 'profit', { compact: true });
    }

    this.container.querySelectorAll('.at-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        App._fixFocus = btn.dataset.gap;
        App.navigate('profit-fix');
      });
    });
  },

  // ── Export the Profit Recovery Audit as a data-driven PDF ───────────────
  // Rebuilds the same content viewAudit() renders (header + score, total
  // recoverable summary, ranked action items, the five scored sections with
  // their metrics + findings text, and the Operational Risk Signals) via the
  // shared App._pdfBuilder. Replaces the old window.print() path. Disclaimer
  // is the canonical App.deliverableFooter() language.
  async exportPDF(audit) {
    if (!audit) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const d = audit.raw || audit;

    // Same formatting helpers viewAudit uses, so PDF values match the screen.
    const pct = (v,t) => v ? v+'%' + (t?' (Target: '+t+'%)':'') : '';
    const cur = v => v ? App.fmtCurrency(v) : '';
    const num = v => v != null && v !== 0 ? String(v) : '';
    const gap = (v) => v > 0 ? cur(v) : v < 0 ? (cur(Math.abs(v)) + ' under target') : '';

    const venue = audit.bar_name || App.data.settings.bar_name || 'Your Bar';
    const metaBits = [(audit.date || '').slice(0, 10)];
    if (audit.audit_period) metaBits.push(audit.audit_period);
    if (audit.audit_id)     metaBits.push(audit.audit_id);

    const b = App._pdfBuilder('Profit Recovery Audit');
    b.header({
      right: 'Profit Recovery Audit',
      meta: metaBits.join('  ·  ') + '  ·  Profit Score ' + (audit.overall_score || 0)
    });
    b.kv('Operation', venue);
    b.kv('Profit Score', (audit.overall_score || 0) + '  (' + App.scoreLabel(audit.overall_score || 0) + ')');
    if (audit.grade) b.kv('Data Quality', audit.grade);
    b.kv('Benchmark / Target',
      (d.INDUSTRY_AVG != null ? 'Bar Cop Benchmark ' + d.INDUSTRY_AVG + '  ·  ' : '')
      + 'Target ' + (d.TARGET_SCORE || 65));

    // Total recoverable summary (mirrors the on-screen recoverable banner).
    const totalMonthly = (audit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0);
    if (totalMonthly > 0) {
      b.sectionTitle('Recoverable Opportunity');
      b.kv('Total Recoverable Per Month', App.fmtCurrency(totalMonthly));
      b.kv('Annualized', App.fmtCurrency(totalMonthly * 12));
      if (d.WEEKLY_GAP_AMT) b.kv('Weekly Gap', String(d.WEEKLY_GAP_AMT));
    }

    // Action items, ranked by impact.
    const actionItems = audit.action_items || [];
    if (actionItems.length) {
      b.sectionTitle('Action Items, Ranked by Impact');
      b.table(['#', 'Action', 'Monthly Opportunity'], actionItems.map((a, i) => [
        String(i + 1),
        a.action || a || '',
        a.monthly_impact ? '+' + App.fmtCurrency(a.monthly_impact) + '/mo' : ''
      ]), { columnStyles: { 0: { cellWidth: 26 }, 2: { cellWidth: 110, halign: 'right' } } });
    }

    // Findings text for a section (same fields as viewAudit's findingsBlock).
    const findingsText = (n) => {
      const fields = ['S'+n+'_EVIDENCE', 'S'+n+'_GAP', 'S'+n+'_TOOL', 'S'+n+'_NARRATIVE', 'S'+n+'_FINDING'];
      return fields.map(f => d[f]).filter(v => v && String(v).trim());
    };

    // Score line for a section header (score, or N/A when null).
    const scoreLine = (sc) => sc != null ? String(sc) + '  (' + App.scoreLabel(sc) + ')' : 'N/A (Not enough data)';

    // The five scored sections, with identical label/value pairs to viewAudit.
    const NAMES = App.AUDIT_PROFIT_SECTION_NAMES;
    const sectionDefs = [
      [1, NAMES[0], d.S1_SCORE, [
        ['Bar Pour Cost %',        pct(d.S1_BAR_COST_PCT, d.S1_TARGET_PCT)],
        ['Monthly Bar Revenue',    cur(d.S1_BAR_REV_MONTHLY)],
        ['Bev COGS Period',        cur(d.S1_BEV_COGS_PERIOD)],
        ['Inventory Variance %',   pct(d.S1_INV_VARIANCE_PCT)],
        ['Inventory Variance $',   cur(d.S1_INV_VARIANCE_AMT)],
        ['Draft Beer Yield',       d.S1_DRAFT_YIELD_PCT != null ? d.S1_DRAFT_YIELD_PCT + '%' : ''],
        ['Draft Yield Loss',       d.S1_DRAFT_LOSS_PCT != null ? d.S1_DRAFT_LOSS_PCT + '% to foam and over-pour' : ''],
        ['Pour Method',            d.S1_POUR_METHOD],
        ['Recipe Coverage',        d.S1_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',  gap(d.S1_MONTHLY_GAP) || (d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : '')],
        ['Annual Gap',             cur(d.S1_ANNUAL_GAP)]
      ]],
      [2, NAMES[1], d.S2_SCORE, [
        ['Void/Comp %',            pct(d.S2_VOID_COMP_PCT)],
        ['Void/Comp Amount',       cur(d.S2_VOID_COMP_AMT)],
        ['Unauthorized Voids %',   pct(d.S2_VOIDS_NO_APPROVAL_PCT)],
        ['Discount % of Sales',    d.S2_DISCOUNT_PCT != null ? d.S2_DISCOUNT_PCT + '%' + (d.S2_DISCOUNT_BENCHMARK_PCT != null ? ' (Benchmark: under ' + d.S2_DISCOUNT_BENCHMARK_PCT + '%)' : '') : ''],
        ['Discount Total',         d.S2_DISCOUNT_PCT != null ? cur(d.S2_DISCOUNT_TOTAL) : ''],
        ['No-Sale Drawer Opens',   d.S2_NO_SALE_COUNT != null ? num(d.S2_NO_SALE_COUNT) : ''],
        ['Drawer Reconciliation',  d.S2_DRAWER_RECON],
        ['Cash Policy Documented', d.S2_CASH_POLICY],
        ['Void Approval Required', d.S2_VOID_APPROVAL],
        ['Spillage Log',           d.S2_SPILLAGE_LOG],
        ['Monthly Gap',            cur(d.S2_MONTHLY_GAP)]
      ]],
      [3, NAMES[2], d.S3_SCORE, [
        ['Food Cost %',            pct(d.S3_FOOD_COST_PCT, d.S3_TARGET_PCT)],
        ['Monthly Food Revenue',   cur(d.S3_FOOD_REV_MONTHLY)],
        ['Food Variance %',        pct(d.S3_FOOD_VAR_PCT)],
        ['Food Variance $',        cur(d.S3_FOOD_VAR_AMT)],
        ['Recipe Coverage',        d.S3_RECIPE_COVERAGE],
        ['Inventory Frequency',    d.S3_INV_FREQ],
        ['Waste Log',              d.S3_WASTE_LOG],
        ['Monthly Gap vs Target',  cur(d.S3_MONTHLY_GAP)],
        ['Annual Gap',             cur(d.S3_ANNUAL_GAP)]
      ]],
      [4, NAMES[3], d.S4_SCORE, [
        ['Bev Invoice Count',      num(d.S4_BEV_INVOICE_COUNT)],
        ['Food Invoice Count',     num(d.S4_FOOD_INVOICE_COUNT)],
        ['Monthly Vendor Spend',   cur(d.S4_VENDOR_SPEND_MONTHLY)],
        ['Invoice vs PO Matching', d.S4_INVOICE_VS_PO],
        ['Price Verification',     d.S4_PRICE_VERIFY],
        ['Annual Bid Process',     d.S4_ANNUAL_BIDS],
        ['Backup Vendors',         d.S4_BACKUP_VENDORS],
        ['Uncollected Vendor Credits', d.S4_UNCOLLECTED_CREDITS != null ? cur(d.S4_UNCOLLECTED_CREDITS) + (d.S4_OPEN_CREDIT_COUNT ? ' across ' + d.S4_OPEN_CREDIT_COUNT + ' open' : '') : ''],
        ['Credits Recovered',      d.S4_RECOVERED_CREDITS != null ? cur(d.S4_RECOVERED_CREDITS) : ''],
        ['Credit Recovery Rate',   d.S4_CREDIT_RECOVERY_PCT != null ? d.S4_CREDIT_RECOVERY_PCT + '%' : ''],
        ['Monthly Exposure',       cur(d.S4_EXPOSURE_MONTHLY)],
        ['Annual Exposure',        cur(d.S4_EXPOSURE_ANNUAL)]
      ]],
      [5, NAMES[4], d.S5_SCORE, [
        ['Total Revenue Period',   cur(d.S5_TOTAL_REV_PERIOD)],
        ['Total COGS Period',      cur(d.S5_TOTAL_COGS_PERIOD)],
        ['Labor Period',           cur(d.S5_LABOR_PERIOD)],
        ['Labor %',                pct(d.S5_LABOR_PCT)],
        ['Bar Pour Cost %',        pct(d.S5_BAR_COST_PCT)],
        ['Food Cost %',            pct(d.S5_FOOD_COST_PCT)],
        ['Prime Cost %',           pct(d.S5_PRIME_COST_PCT, d.S5_TARGET_PCT)],
        ['Prime Cost Amount',      cur(d.S5_PRIME_COST_AMT)],
        ['RPLH Tracked',           d.S5_RPLH_TRACKED],
        ['Labor by Department',    d.S5_LABOR_BY_DEPT],
        ['Monthly COGS Gap',       cur(d.S5_COMBINED_COGS_GAP)]
      ]]
    ];

    sectionDefs.forEach(([n, name, score, items]) => {
      b.sectionTitle('Section ' + n + '  ·  ' + name);
      b.kv('Score', scoreLine(score));
      const rows = items.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0')
        .map(([label, val]) => [label, String(val)]);
      if (rows.length) b.table(['Metric', 'Value'], rows);
      const findings = findingsText(n);
      if (findings.length) {
        b.heading('Findings', 10);
        findings.forEach(t => b.paragraph(t, { gray: 70 }));
      }
    });

    // Section 6 — Operational Risk Signals (only when present).
    const signals6 = [
      {score:d.S6_SIG1_SCORE, label:d.S6_SIG1_LABEL, evidence:d.S6_SIG1_EVIDENCE, gap:d.S6_SIG1_GAP, tool:d.S6_SIG1_TOOL},
      {score:d.S6_SIG2_SCORE, label:d.S6_SIG2_LABEL, evidence:d.S6_SIG2_EVIDENCE, gap:d.S6_SIG2_GAP, tool:d.S6_SIG2_TOOL},
      {score:d.S6_SIG3_SCORE, label:d.S6_SIG3_LABEL, evidence:d.S6_SIG3_EVIDENCE, gap:d.S6_SIG3_GAP, tool:d.S6_SIG3_TOOL},
      {score:d.S6_SIG4_SCORE, label:d.S6_SIG4_LABEL, evidence:d.S6_SIG4_EVIDENCE, gap:d.S6_SIG4_GAP, tool:d.S6_SIG4_TOOL}
    ].filter(s => s.label);
    if (signals6.length) {
      b.sectionTitle('Section 6  ·  Operational Risk Signals');
      b.table(['Risk', 'Signal', 'Evidence', 'Gap', 'Tool'], signals6.map(s => [
        (s.score || '').toUpperCase(),
        s.label || '',
        s.evidence || '',
        s.gap || '',
        s.tool || ''
      ]), { columnStyles: { 0: { cellWidth: 50 } } });
    }

    b.disclaimer(App.deliverableFooter().workbookSubject);

    let ds = App._pdfDateStamp();
    if (audit.date) {
      const dt = new Date((audit.date || '').slice(0, 10) + 'T00:00:00');
      if (!isNaN(dt.getTime())) {
        const p = n => String(n).padStart(2, '0');
        ds = '' + dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate());
      }
    }
    await b.save('BarCop_ProfitAudit_' + ds + '.pdf');
  },

  // renderNarrative() removed 2026-05-28 with the single-page audit refactor.
  // Findings text now renders inline under each section via findingsBlock()
  // inside the sectionBlock helper in viewAudit().

  // ── Stepped intake wizard ─────────────────────────────────────────────────
  _intakeStep: 1,
  _intakeDraft: null,

  showIntakeForm() {
    this._intakeStep = 1;
    // Pre-fill from Hub Settings if available so the operator only types
    // these numbers once across the whole platform (per the "Bar Cop knows
    // this already" rule). They can still override before running the audit.
    const s = App.data?.settings || {};
    // Operating practices persist across audits. They pre-fill from last time
    // so the operator just updates what changed (e.g. Free pour -> Jiggered)
    // and watches the score move. Defaults describe an uncontrolled operation.
    const p = s.profit_practices || {};
    // Stored as dropdown strings. Unanswered = '' so a brand-new audit starts
    // every question on "Select Answer" and an unanswered question has zero
    // effect on the score. Returning audits pre-fill the operator's last
    // answers so they only change what improved.
    const boolStr = v => v === true ? 'true' : v === false ? 'false' : (v || '');
    this._intakeDraft = {
      barRev:  s.annual_bar_revenue  != null ? String(s.annual_bar_revenue)  : '',
      foodRev: s.annual_food_revenue != null ? String(s.annual_food_revenue) : '',
      practices: {
        pour_method:    p.pour_method    || '',
        recipes_costed: p.recipes_costed || '',
        inv_freq:       p.inv_freq       || '',
        void_approval:  boolStr(p.void_approval),
        drawer_recon:   boolStr(p.drawer_recon),
        invoice_vs_po:  p.invoice_vs_po  || '',
        backup_vendors: p.backup_vendors || ''
      }
    };
    this.actions.innerHTML = '';
    this.renderIntake();
  },

  // Single-page Profit intake. Revenue is the only required input; every upload
  // is optional because an operator running Control already has the data, and
  // the slots map 1:1 to the sections computeProfitAudit scores.
  renderIntake() {
    const s = App.data.settings || {};
    const d = this._intakeDraft || {};
    document.getElementById('topbar-sub').textContent = '';
    // The form is always viewable so the operator can review/update inputs. The
    // 30-day cadence gates only the Generate action.
    const _a = (App.data.audits || []).slice().sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    const _since = _a[0] && _a[0].date ? Math.floor((Date.now() - new Date(_a[0].date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = _since >= 30;
    const daysLeft = canRun ? 0 : 30 - _since;

    // Pills — every section the audit can pull from Control. Always listed:
    // greyed until that data exists, gold-tint when Bar Cop is using it.
    const cd = this.buildControlData();
    const checks = [
      { label: 'Bar Pour Cost',   ok: cd && cd.bar_cost_pct != null },
      { label: 'Food Cost',       ok: cd && cd.food_cost_pct != null },
      { label: 'Prime Cost',      ok: cd && cd.prime_cost_pct != null },
      { label: 'Voids and Comps', ok: cd && cd.void_comp_count > 0 },
      { label: 'Cash Variance',   ok: cd && cd.cash_reconciliations > 0 },
      { label: 'Vendor Drift',    ok: cd && cd.deliveries_logged > 0 },
      { label: 'Payroll / Labor', ok: cd && cd.labor_hours > 0 }
    ];
    const pill = (c) => '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 11px;border-radius:20px;margin:0 6px 7px 0;'
      + (c.ok ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t3);') + '">'
      + (c.ok ? '<span style="color:var(--green);font-weight:800;">&#10003;</span>' : '')
      + esc(c.label) + '</span>';

    // Card 1 — annual sales (the dollar baseline) + what Bar Cop already covers.
    const salesField = (id, label, ph, val) => '<div class="f" style="width:220px;"><label>' + label + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="' + id + '" placeholder="' + ph + '" value="' + esc(val || '') + '"/></div></div>';
    const salesCard = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Annual Sales</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Sets the dollar baselines for the audit. Enter at least one; leave Food blank if you run no kitchen.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + salesField('at-iz-bar-rev', 'Annual Bar Sales', '618000', d.barRev)
      + salesField('at-iz-food-rev', 'Annual Food Sales', '372000', d.foodRev)
      + '</div>'
      + '<div class="sh" style="margin:18px 0 8px;">What Bar Cop Already Has</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">Highlighted sections pull from your Control data automatically. The greyed ones fill in as you log them, or from an upload below.</div>'
      + '<div>' + checks.map(pill).join('') + '</div></div>';

    const uploadCard = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Your Reports</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Optional. Drop in a report to score a section Bar Cop cannot see yet. One drop zone takes them all.</div>'
      + FileDrop.render('at-drop', { items: [
          { t: 'Profit and Loss or Monthly Sales Summary', s: 'Scores Bar Cost, Food Cost and Prime Cost (revenue, COGS and labor in one report).' },
          { t: 'Voids, Comps and Cash Report',             s: 'Scores Theft and Loss (void and comp rate, unapproved voids, cash variance).' },
          { t: 'Invoices and Vendor Pricing',              s: 'Scores Vendor Control (invoice matching, price drift).' },
          { t: 'Recipe Costing Sheet',                     s: 'Adds repricing opportunities ranked by dollar impact, and recipe coverage.', hi: true },
          { t: 'Inventory Count Sheets (Bar and Kitchen)', s: 'Adds per-product pour and food cost variance.' }
        ] })
      + '</div>';

    // Operating-practice questions, one clean row each. Answers persist and
    // pre-fill the next audit so the operator updates what changed.
    const pr = d.practices || {};
    const qRow = (label, id, options) => {
      const all = [['', 'Select Answer']].concat(options);
      const opts = all.map(o => '<option value="' + esc(o[0]) + '"' + (String(pr[id] || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 2px;border-bottom:1px solid var(--row-div);">'
        + '<span style="font-size:13px;color:var(--t1);">' + esc(label) + '</span>'
        + '<select class="at-qsel" id="at-q-' + id + '" style="min-width:175px;flex-shrink:0;">' + opts + '</select>'
        + '</div>';
    };
    const questionsCard = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">A Few Quick Questions</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:6px;">These shape your scores and are not in your reports. Answer what applies; the rest carry over to next time.</div>'
      + qRow('How do you pour spirits?',            'pour_method',   [['Free pour','Free pour'],['Jiggered/measured','Jiggered or measured']])
      + qRow('Are your recipes costed?',            'recipes_costed',[['none','None'],['some','Some'],['all','All']])
      + qRow('How often do you count inventory?',   'inv_freq',      [['Never','Never'],['Monthly','Monthly'],['Weekly','Weekly']])
      + qRow('Manager approval on voids and comps?','void_approval', [['false','No'],['true','Yes']])
      + qRow('Drawer reconciled every shift?',      'drawer_recon',  [['false','No'],['true','Yes']])
      + qRow('Invoices matched to orders?',         'invoice_vs_po', [['Never matched','Never'],['Spot checked','Spot check'],['Matched every delivery','Every delivery']])
      + qRow('Backup vendors identified?',          'backup_vendors',[['No','No'],['Yes','Yes']])
      + '</div>';

    // Run + Back, below the cards (standard placement).
    const buttons = '<div style="margin:18px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + (canRun
          ? '<button class="btn btn-primary" id="at-iz-submit">Generate Audit</button>'
          : '<button class="btn btn-primary" id="at-iz-submit" disabled style="opacity:0.5;cursor:default;">Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</button>')
      + '<button class="btn btn-ghost" id="at-iz-cancel">Back</button>'
      + '<span id="at-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></span></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:24px;">' + (canRun ? 'Analysis takes 60 to 90 seconds.' : 'Review and update your inputs now. The next audit can run in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ', and your changes save when you generate it.') + '</div>';

    this.container.innerHTML = '<div class="screen">' + salesCard + uploadCard + questionsCard + buttons + '</div>';
    FileDrop.attach('at-drop');

    document.getElementById('at-iz-cancel')?.addEventListener('click', () => { document.getElementById('topbar-sub').textContent = ''; this.renderMain(); });
    document.getElementById('at-iz-submit')?.addEventListener('click', () => {
      const barRev = parseFloat(document.getElementById('at-iz-bar-rev')?.value) || 0;
      const foodRev = parseFloat(document.getElementById('at-iz-food-rev')?.value) || 0;
      if (barRev === 0 && foodRev === 0) {
        const st = document.getElementById('at-iz-status');
        if (st) { st.style.display = 'block'; st.style.color = 'var(--red)'; st.textContent = 'Enter at least one sales figure to run the audit.'; }
        return;
      }
      this._intakeDraft.barRev = document.getElementById('at-iz-bar-rev')?.value || '';
      this._intakeDraft.foodRev = document.getElementById('at-iz-food-rev')?.value || '';
      const val = id => (document.getElementById('at-q-' + id) || {}).value || '';
      this._intakeDraft.practices = {
        pour_method:    val('pour_method'),
        recipes_costed: val('recipes_costed'),
        inv_freq:       val('inv_freq'),
        void_approval:  val('void_approval'),
        drawer_recon:   val('drawer_recon'),
        invoice_vs_po:  val('invoice_vs_po'),
        backup_vendors: val('backup_vendors')
      };
      this.generateAudit();
    });
  },

  showHowTo() {
    App.showHelpModal('How the Profit Audit Works', [
      { p: ['The Profit Audit scores five areas: Bar Cost, Theft and Loss, Food Cost, Vendor Control, and Prime Cost. It scores whatever data it can see and shows N/A for anything it cannot, so the more you give it, the more it covers.'] },
      { h: 'What Bar Cop already has', p: ['If you run the Inventory, Shift, and Labor Control systems, those numbers feed the audit automatically as verified ground truth. A brand-new operation has none yet, so this first audit reads from what you enter and upload.'] },
      { h: 'The steps', p: ['1. Enter your annual sales (the dollar baseline). A bar with no kitchen leaves Food blank.', '2. Upload any reports that cover a section Bar Cop cannot see yet (a P&L covers Bar, Food, and Prime in one file).', '3. Answer the quick questions about how you operate.', '4. Generate. Sections with no data show N/A and fill in as you log more.'] },
      { h: 'The honest rule', p: ['Every score and dollar figure is computed in code from your real numbers, the same every time. A section with no data is left out, never guessed.'] }
    ]);
  },

  async generateAudit() {
    if (App.demoBlock('Running an audit')) return;
    // Show generating state in the current container
    const submitBtn = document.getElementById('at-iz-submit');
    const statusEl  = document.getElementById('at-iz-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (statusEl) { statusEl.style.display='block'; statusEl.style.color=color; statusEl.textContent=msg; }
    };
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Analyzing...'; }

    // Single shared drop zone — all files pool under one field; the server
    // extraction reads them together regardless of field name.
    const allFiles = FileDrop.getFiles('at-drop').map(f => ({ file: f, field: 'file' }));

    const barRev  = parseFloat(this._intakeDraft?.barRev)  || 0;
    const foodRev = parseFloat(this._intakeDraft?.foodRev) || 0;

    // Validation — do not run an audit with nothing to analyze
    const hasRealData = allFiles.length > 0 || (App.data.weeks && App.data.weeks.length > 0) || barRev > 0 || foodRev > 0;
    if (!hasRealData) {
      setStatus('Add data before running the audit. Enter at least one week in This Week, or attach your POS reports.', 'var(--red)');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Generate Audit'; }
      return;
    }

    setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

    try {
      const draftP = this._intakeDraft?.practices || {};
      // Remember revenue + operating practices (as dropdown strings) so the
      // next audit pre-fills them and the operator only changes what improved.
      App.data.settings.annual_bar_revenue  = barRev;
      App.data.settings.annual_food_revenue = foodRev;
      App.data.settings.profit_practices    = draftP;
      await App.saveKey('settings');

      // Convert to the engine's shape. An unanswered question ('') is omitted
      // so it has no effect on the score.
      const practices = {};
      if (draftP.pour_method)    practices.pour_method    = draftP.pour_method;
      if (draftP.recipes_costed) practices.recipes_costed = draftP.recipes_costed;
      if (draftP.inv_freq)       practices.inv_freq       = draftP.inv_freq;
      if (draftP.invoice_vs_po)  practices.invoice_vs_po  = draftP.invoice_vs_po;
      if (draftP.backup_vendors) practices.backup_vendors = draftP.backup_vendors;
      if (draftP.void_approval === 'true' || draftP.void_approval === 'false') practices.void_approval = draftP.void_approval === 'true';
      if (draftP.drawer_recon === 'true' || draftP.drawer_recon === 'false')   practices.drawer_recon  = draftP.drawer_recon === 'true';

      const auditAppData = JSON.parse(JSON.stringify(App.data));

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      form.append('practices', JSON.stringify(practices));
      const controlData = this.buildControlData();
      if (controlData) form.append('controlData', JSON.stringify(controlData));
      for (const {file, field} of allFiles) form.append(field, file, file.name);

      setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

      const res  = await fetch('/api/generate-profit-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');

      setStatus('Saving audit...', 'var(--gold)');
      const d = data.auditData || {};

      const auditRecord = {
        id:            App.uid(),
        date:          App.todayLocal(),
        bar_name:      d.BAR_NAME || App.data.settings.bar_name,
        overall_score: d.OVERALL_SCORE || 0,
        grade:         d.DATA_TIER_LABEL || '',
        audit_period:  d.AUDIT_PERIOD || '',
        audit_id:      d.AUDIT_ID || '',
        sections:      this.extractSections(d),
        action_items:  this.extractActionItems(d),
        raw:           d,
        generated_at:  new Date().toISOString()
      };

      // Row-per-record in core_events now, so the old 12-audit blob cap is gone:
      // full audit history is retained and paged via "Show older" on the list.
      await App.putRecord('core', 'audit', auditRecord);
      App.markSetupDone('gs_p_audit');

      document.getElementById('topbar-sub').textContent = '';
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message||'Generation failed. Please try again.'), 'var(--red)');
      if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='Generate Audit'; }
    }
  },

  extractSections(d) {
    const s = {};
    const names = App.AUDIT_PROFIT_SECTION_NAMES;
    [1, 2, 3, 4, 5].forEach(n => {
      const v = d['S' + n + '_SCORE'];
      if (v != null) s[names[n - 1]] = v;
    });
    return s;
  },

  extractActionItems(d) {
    const items = [];
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Reduce bar pour cost. $' + Math.round(d.S1_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S1_MONTHLY_GAP, gap_id: 'pour-cost' });
    // Draft yield loss routes to the same pour-cost lever. No separate dollar
    // (monthly_impact 0) — the loss already sits inside the bar pour cost gap.
    if (d.S1_DRAFT_LOSS_PCT != null && d.S1_DRAFT_LOSS_PCT >= 12) items.push({ action: 'Cut draft yield loss. ' + d.S1_DRAFT_LOSS_PCT + '% of every keg is going to foam and over-pour. Tune line temperature, pressure, and pour discipline.', monthly_impact: 0, gap_id: 'pour-cost' });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Reduce food cost. $' + Math.round(d.S3_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S3_MONTHLY_GAP, gap_id: 'food-cost' });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Address void and comp rate. $' + Math.round(d.S2_MONTHLY_GAP) + '/month in excess.', monthly_impact: d.S2_MONTHLY_GAP, gap_id: 'theft-loss' });
    // Discount + no-sale theft vectors. Surfaced as flagged behavior (no separate
    // recoverable dollar — not all discounts are recoverable, and no-sale opens
    // have no honest dollar without an investigation).
    if (d.S2_DISCOUNT_PCT != null && d.S2_DISCOUNT_BENCHMARK_PCT != null && d.S2_DISCOUNT_PCT > d.S2_DISCOUNT_BENCHMARK_PCT) items.push({ action: 'Tighten discount control. Discounts are ' + d.S2_DISCOUNT_PCT + '% of sales vs an under-' + d.S2_DISCOUNT_BENCHMARK_PCT + '% benchmark. Require manager authorization on every discount.', monthly_impact: 0, gap_id: 'theft-loss' });
    if (d.S2_NO_SALE_COUNT >= 10) items.push({ action: 'Review no-sale drawer opens. ' + d.S2_NO_SALE_COUNT + ' no-sale register opens this period. Set a no-sale policy and log a reason for every one, it is the simplest cover for pocketing cash.', monthly_impact: 0, gap_id: 'theft-loss' });
    if (d.S4_EXPOSURE_MONTHLY > 0) items.push({ action: 'Improve vendor verification. $' + Math.round(d.S4_EXPOSURE_MONTHLY) + '/month exposure.', monthly_impact: d.S4_EXPOSURE_MONTHLY, gap_id: 'vendor-control' });
    // Uncollected vendor credits are real filed overcharges. Surfaced with the
    // actual dollar in text; monthly_impact 0 (a one-time recovery, not monthly,
    // and kept out of the headline so it never double-counts vendor exposure).
    if (d.S4_UNCOLLECTED_CREDITS > 0) items.push({ action: 'Chase your filed vendor credits. $' + Math.round(d.S4_UNCOLLECTED_CREDITS) + ' in flagged overcharges is filed but not yet recovered across ' + (d.S4_OPEN_CREDIT_COUNT || 0) + ' open discrepanc' + (d.S4_OPEN_CREDIT_COUNT === 1 ? 'y' : 'ies') + '. The work of catching it is already done.', monthly_impact: 0, gap_id: 'vendor-control' });
    // Prime cost (S5_COMBINED_COGS_GAP) is the bar + food COGS overage, i.e. it
    // already equals S1 + S3. It is shown as context on the Prime Cost section,
    // never added here as a recoverable item, or the Total Recoverable would
    // double-count the same dollars. (Decision: audit-honesty-rebuild.)
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  },

  /* Verified Control-module data sent with the audit as ground truth (map
     Section 8). Each slice is real logged operational data; a section only
     appears when its Control data exists, so the server never gets a
     fabricated figure. Returns null when no Control module has data. */
  buildControlData() {
    const inv = App.inventoryData || {};
    const sh  = App.shiftData || {};
    const lab = App.laborData || {};
    const r1  = n => (n == null || isNaN(n)) ? null : Math.round(n * 10) / 10;
    const cd  = { sources: [] };

    // Bar / food / prime cost — the weeks already derive from Control feeds
    const weeks = (App.data.weeks || []).filter(w => w.period_end).slice(-4);
    if (weeks.length) {
      const avg = fn => { const v = weeks.map(fn).filter(x => x != null && !isNaN(x));
        return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
      cd.bar_cost_pct   = r1(avg(w => w.bar && w.bar.cost_pct));
      cd.food_cost_pct  = r1(avg(w => w.food && w.food.cost_pct));
      cd.prime_cost_pct = r1(avg(w => w.prime_cost_pct));
    }

    // Period window — the audit covers the same trailing 4 weeks the cost
    // percentages use. Scope every summed Control figure to that window so a
    // bar with months of logged records does not overstate a one-period rate.
    let windowStart = null;
    if (weeks.length) {
      const ends = weeks.map(w => w.period_end).sort();
      const d = new Date(ends[0] + 'T00:00:00');
      d.setDate(d.getDate() - 6);          // include the full first week of the window
      windowStart = isNaN(d) ? null : d;
    }
    const inWindow = (rec) => {
      if (!windowStart) return true;       // no weekly data — do not filter
      const ds = rec && (rec.date || rec.created_at);
      if (!ds) return true;                // undated — include rather than silently drop
      const rd = new Date(('' + ds).slice(0, 10) + 'T00:00:00');
      return isNaN(rd) ? true : rd >= windowStart;
    };

    // Inventory Control — counts
    const counts = (inv.ic_counts || []).filter(inWindow);
    if (counts.length) { cd.inventory_counts = counts.length; cd.sources.push('Inventory Control counts'); }

    // Inventory Control — deliveries and vendor price drift
    const dels = (inv.ic_deliveries || []).filter(inWindow);
    if (dels.length) {
      let changes = 0;
      dels.forEach(d => (d.line_items || []).forEach(li => {
        if (li.price_changed && li.prev_price != null && li.price_per_unit != null) changes++;
      }));
      cd.deliveries_logged = dels.length;
      cd.vendor_price_changes = changes;
      cd.sources.push('Inventory Control deliveries');
    }

    // Inventory Control — spot checks (theft pour-variance signal)
    const spots = (inv.ic_spot_checks || []).filter(inWindow);
    if (spots.length) {
      cd.spot_checks = spots.length;
      cd.spot_check_flagged = spots.reduce((s,c) => s + (c.flagged_count || 0), 0);
      cd.spot_check_variance_dollar = r1(spots.reduce((s,c) => s + (c.total_variance_dollar || 0), 0));
      cd.sources.push('Inventory Control spot checks');
    }

    // Shift Control — voids and comps
    const vc = (sh.sc_void_comps || []).filter(inWindow);
    if (vc.length) {
      cd.void_comp_count = vc.length;
      cd.void_comp_total = r1(vc.reduce((s,v) => s + (v.amount || 0), 0));
      cd.void_comp_unauthorized = vc.filter(v => !v.authorized_by).length;
      cd.sources.push('Shift Control void and comp log');
    }

    // Shift Control — drawer reconciliations and cash drops
    const variances = (sh.sc_variances || []).filter(inWindow);
    if (variances.length) {
      cd.cash_reconciliations = variances.length;
      cd.cash_variance_total = r1(variances.reduce((s,v) => s + (v.variance || 0), 0));
      cd.cash_short_count = variances.filter(v => v.status === 'Short').length;
      cd.sources.push('Shift Control drawer reconciliation');
    }
    const drops = (sh.sc_cash_drops || []).filter(inWindow);
    if (drops.length) cd.cash_drops = drops.length;

    // Labor Control — actual hours and cost (prime cost labor)
    const actuals = (lab.lc_actuals || []).filter(inWindow);
    if (actuals.length) {
      cd.labor_hours = r1(actuals.reduce((s,a) => s + (a.hours || 0), 0));
      let laborCost = actuals.reduce((s,a) => s + ((a.hours || 0) * (a.wage || 0)), 0);
      // Add fixed salaried (exempt) cost over the span the windowed actuals cover.
      const dts = actuals.map(a => a.date).filter(Boolean).sort();
      if (dts.length) laborCost += App.salariedCost(dts[0], dts[dts.length - 1]).total;
      cd.labor_cost = Math.round(laborCost);
      cd.sources.push('Labor Control actuals');
    }

    return cd.sources.length ? cd : null;
  }
};
