'use strict';
S.AuditTracker = {

  render(container, actions) {
    this.container = container;
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-primary btn-sm';
    uploadBtn.textContent = 'Upload Audit';
    uploadBtn.addEventListener('click', () => this.triggerUpload());
    actions.appendChild(uploadBtn);
    this.renderMain();
  },

  renderMain() {
    const audits = (App.data.audits || []).slice().reverse();

    if (audits.length === 0) {
      this.container.innerHTML = '<div class="screen">'
        + '<div class="card"><div class="empty">'
        + '<div class="empty-title">No Audits Uploaded Yet</div>'
        + '<div class="empty-sub">Upload your first Profit Audit PDF to get started. The app will extract your scores, gaps, and action items automatically.</div>'
        + '<button class="btn btn-primary" id="at-upload-first">Upload First Audit</button>'
        + '</div></div>'
        + '<input type="file" id="at-file-input" accept=".pdf" style="display:none;" />'
        + '</div>';
      document.getElementById('at-upload-first')?.addEventListener('click', () => this.triggerUpload());
      document.getElementById('at-file-input')?.addEventListener('change', e => this.handleFile(e.target.files[0]));
      return;
    }

    // Score progression chart
    const chartHtml = audits.length >= 2 ? this.buildProgressChart(audits) : '';

    // Latest audit summary
    const latest = audits[0];
    const prior  = audits[1] || null;

    const scoreDiff = prior ? latest.overall_score - prior.overall_score : null;
    const scoreDiffHtml = scoreDiff != null
      ? `<span style="font-size:14px;font-weight:700;color:${scoreDiff>0?'var(--gold)':'var(--red)'};">${scoreDiff>0?'+':''}${scoreDiff} pts</span>`
      : '';

    const sectionRows = (latest.sections || []).map(sec => {
      const priorSec = prior?.sections?.find(s => s.name === sec.name);
      const diff = priorSec ? sec.score - priorSec.score : null;
      const statusCls = sec.status === 'ON TARGET' ? 'badge-ok'
                      : sec.status === 'ATTENTION'  ? 'badge-dim' : 'badge-warn';
      return `<tr>
        <td class="val">${esc(sec.name)}</td>
        <td style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:600;color:${sec.score>=60?'var(--gold)':'var(--red)'};">${sec.score}<span style="font-size:11px;color:var(--t3);">/100</span></td>
        <td><span class="badge ${statusCls}">${esc(sec.status)}</span></td>
        <td style="color:var(--t2);">${sec.monthly_gap ? App.fmtCurrency(sec.monthly_gap)+'/mo' : 'N/A'}</td>
        <td>${diff!=null ? `<span style="color:${diff>0?'var(--gold)':'var(--red)'};">${diff>0?'↑':'↓'} ${Math.abs(diff)} pts</span>` : '<span style="color:var(--t4);">First audit</span>'}</td>
      </tr>`;
    }).join('');

    // Action items
    const actionRows = (latest.action_items || []).slice(0, 10).map((a, i) =>
      `<tr>
        <td style="color:var(--t3);font-family:'Barlow Condensed',sans-serif;font-weight:700;">${i+1}</td>
        <td class="val">${esc(a.title)}</td>
        <td><span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t2);">${esc(a.area)}</span></td>
        <td style="color:var(--t2);">${a.monthly_low ? App.fmtCurrency(a.monthly_low)+'/mo' : '—'}</td>
        <td style="color:var(--t3);font-size:11px;">${esc(a.timeframe || '—')}</td>
      </tr>`
    ).join('');

    // Audit history list
    const historyRows = audits.map((a, i) => {
      const prev = audits[i+1];
      const diff = prev ? a.overall_score - prev.overall_score : null;
      return `<tr>
        <td class="val">${esc(a.bar_name)}</td>
        <td style="color:var(--t2);">${esc(a.audit_period || '—')}</td>
        <td style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:600;color:${a.overall_score>=60?'var(--gold)':a.overall_score>=40?'rgba(200,216,232,0.7)':'var(--red)'};">${a.overall_score}/100</td>
        <td>${diff!=null ? `<span style="color:${diff>0?'var(--gold)':'var(--red)'};">${diff>0?'+':''}${diff} pts</span>` : '<span style="color:var(--t4);">—</span>'}</td>
        <td style="color:var(--t2);">${App.fmtCurrency(a.weekly_gap_estimate)}/wk</td>
        <td><span style="font-size:9px;color:var(--t3);">${esc(a.audit_id || '—')}</span></td>
        <td><button class="btn btn-danger btn-sm at-delete" data-id="${a.id}" style="padding:3px 8px;">×</button></td>
      </tr>`;
    }).join('');

    this.container.innerHTML = `<div class="screen">
      <input type="file" id="at-file-input" accept=".pdf" style="display:none;" />

      ${chartHtml}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
        <div class="metric-card">
          <div class="metric-label">Current Score</div>
          <div class="metric-val ${latest.overall_score>=60?'on-target':'over-target'}">${latest.overall_score}<span style="font-size:16px;color:var(--t3);">/100</span></div>
          <div class="metric-target">Industry avg: 63 · Target: 65+</div>
          <div class="metric-impact" style="color:var(--t3);">${scoreDiffHtml || 'First audit'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Weekly Gap</div>
          <div class="metric-val over-target">${App.fmtCurrency(latest.weekly_gap_estimate)}</div>
          <div class="metric-target">Est. left on table/week</div>
          <div class="metric-impact neg">${App.fmtCurrency(latest.weekly_gap_estimate * 52)}/yr</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Sections Critical</div>
          <div class="metric-val ${(latest.sections||[]).filter(s=>s.status==='CRITICAL').length>2?'over-target':'on-target'}">${(latest.sections||[]).filter(s=>s.status==='CRITICAL').length}</div>
          <div class="metric-target">of ${(latest.sections||[]).length} sections</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Audits on File</div>
          <div class="metric-val">${audits.length}</div>
          <div class="metric-target">${audits.length > 1 ? 'Tracking progress' : 'Upload next in 60–90 days'}</div>
        </div>
      </div>

      ${prior ? this.buildComparisonCard(latest, prior) : ''}

      <div class="sh">Section Scorecard — ${esc(latest.bar_name)}</div>
      <div class="tbl-wrap" style="margin-bottom:18px;">
        <table class="tbl"><thead><tr>
          <th>Section</th><th>Score</th><th>Status</th><th>Monthly Gap</th><th>vs Prior Audit</th>
        </tr></thead><tbody>${sectionRows}</tbody></table>
      </div>

      <div class="sh">Top Action Items</div>
      <div class="tbl-wrap" style="margin-bottom:18px;">
        <table class="tbl"><thead><tr>
          <th>#</th><th>Action</th><th>Area</th><th>Monthly Impact</th><th>Time</th>
        </tr></thead><tbody>${actionRows}</tbody></table>
      </div>

      <div class="sh">Audit History</div>
      <div class="tbl-wrap">
        <table class="tbl"><thead><tr>
          <th>Bar</th><th>Period</th><th>Score</th><th>Change</th><th>Weekly Gap</th><th>Audit ID</th><th></th>
        </tr></thead><tbody>${historyRows}</tbody></table>
      </div>
    </div>`;

    document.getElementById('at-file-input')?.addEventListener('change', e => this.handleFile(e.target.files[0]));
    this.container.addEventListener('click', ev => {
      if (ev.target.closest('.at-delete')) this.deleteAudit(ev.target.closest('.at-delete').dataset.id);
    });
  },

  buildProgressChart(audits) {
    const reversed = audits.slice().reverse();
    const W = 700, H = 140, PAD = {t:16, r:20, b:32, l:44};
    const cw = W-PAD.l-PAD.r, ch = H-PAD.t-PAD.b;
    const scores = reversed.map(a => a.overall_score);
    const minY = Math.max(0, Math.min(...scores) - 5);
    const maxY = Math.min(100, Math.max(...scores) + 10);
    const xs = i => PAD.l + (reversed.length > 1 ? (i/(reversed.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY))*ch;
    const tgt65 = ys(65);
    const pts = reversed.map((a,i) => `${xs(i).toFixed(1)},${ys(a.overall_score).toFixed(1)}`).join(' ');
    const ticks = [];
    for (let v = Math.ceil(minY/10)*10; v <= maxY; v+=10) ticks.push(v);

    return `<div class="chart-card" style="margin-bottom:18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Score Progression</div>
        <div style="display:flex;gap:14px;">
          <span style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--t2);"><span style="width:18px;height:2px;background:var(--gold);display:inline-block;"></span>Your Score</span>
          <span style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--t2);"><span style="width:18px;height:2px;background:rgba(201,168,76,0.4);display:inline-block;border-top:2px dashed var(--gold);"></span>Target (65)</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;">
        ${ticks.map(v => `<line x1="${PAD.l}" y1="${ys(v).toFixed(1)}" x2="${W-PAD.r}" y2="${ys(v).toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
        <text x="${PAD.l-5}" y="${(ys(v)+3).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">${v}</text>`).join('')}
        <line x1="${PAD.l}" y1="${tgt65.toFixed(1)}" x2="${W-PAD.r}" y2="${tgt65.toFixed(1)}" stroke="var(--gold)" stroke-width="1" stroke-dasharray="4,4" opacity="0.45"/>
        <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round"/>
        ${reversed.map((a,i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(a.overall_score).toFixed(1)}" r="4" fill="var(--gold)"/>
        <text x="${xs(i).toFixed(1)}" y="${(ys(a.overall_score)-9).toFixed(1)}" text-anchor="middle" fill="var(--gold)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">${a.overall_score}</text>`).join('')}
        ${reversed.map((a,i) => `<text x="${xs(i).toFixed(1)}" y="${H-4}" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">${(a.audit_period||a.audit_id||'Audit '+(i+1)).slice(0,8)}</text>`).join('')}
      </svg>
    </div>`;
  },

  buildComparisonCard(latest, prior) {
    const scoreDiff = latest.overall_score - prior.overall_score;
    const gapDiff = latest.weekly_gap_estimate - prior.weekly_gap_estimate;
    const improved = (latest.sections||[]).filter(s => {
      const p = (prior.sections||[]).find(ps => ps.name === s.name);
      return p && s.score > p.score;
    });
    const declined = (latest.sections||[]).filter(s => {
      const p = (prior.sections||[]).find(ps => ps.name === s.name);
      return p && s.score < p.score;
    });

    return `<div class="card" style="margin-bottom:18px;border-left:3px solid ${scoreDiff>0?'var(--gold)':'var(--red)'};">
      <div class="card-title">Progress vs Prior Audit</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px;">
        <div class="calc-item">
          <div class="calc-label">Score Change</div>
          <div class="calc-val ${scoreDiff>0?'good':'warn'}">${scoreDiff>0?'+':''}${scoreDiff} pts</div>
        </div>
        <div class="calc-item">
          <div class="calc-label">Weekly Gap Change</div>
          <div class="calc-val ${gapDiff<0?'good':'warn'}">${gapDiff>0?'+':''}${App.fmtCurrency(gapDiff)}/wk</div>
        </div>
        <div class="calc-item">
          <div class="calc-label">Sections Improved</div>
          <div class="calc-val good">${improved.length}</div>
        </div>
        <div class="calc-item">
          <div class="calc-label">Sections Declined</div>
          <div class="calc-val ${declined.length>0?'warn':'good'}">${declined.length}</div>
        </div>
      </div>
      ${improved.length>0 ? `<div style="margin-bottom:8px;"><span style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Improved: </span>${improved.map(s=>{const p=(prior.sections||[]).find(ps=>ps.name===s.name);return`<span style="font-size:11px;color:var(--gold);margin-right:12px;">${esc(s.name)} +${s.score-p.score} pts</span>`;}).join('')}</div>` : ''}
      ${declined.length>0 ? `<div><span style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Needs attention: </span>${declined.map(s=>{const p=(prior.sections||[]).find(ps=>ps.name===s.name);return`<span style="font-size:11px;color:var(--red);margin-right:12px;">${esc(s.name)} ${s.score-p.score} pts</span>`;}).join('')}</div>` : ''}
    </div>`;
  },

  triggerUpload() {
    const input = document.getElementById('at-file-input');
    if (input) { input.value = ''; input.click(); return; }
    // Create if not yet rendered
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf'; inp.style.display = 'none';
    inp.addEventListener('change', e => this.handleFile(e.target.files[0]));
    document.body.appendChild(inp);
    inp.click();
  },

  async handleFile(file) {
    if (!file) return;
    // Show loading state
    const content = document.getElementById('content-area');
    if (content) {
      content.innerHTML = `<div class="screen">
        <div class="card" style="text-align:center;padding:48px;">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:600;color:var(--gold);margin-bottom:12px;">Reading Audit PDF...</div>
          <div style="font-size:12px;color:var(--t2);margin-bottom:24px;">Claude is extracting scores, findings, and action items from your audit. This takes about 10–15 seconds.</div>
          <div id="at-progress" style="font-size:11px;color:var(--t3);">Converting PDF...</div>
        </div>
      </div>`;
    }

    try {
      const setProgress = msg => { const el = document.getElementById('at-progress'); if (el) el.textContent = msg; };

      setProgress('Reading PDF file...');
      const base64 = await this.fileToBase64(file);

      setProgress('Sending to Claude for analysis...');
      const extracted = await this.extractAuditData(base64);

      setProgress('Saving audit data...');
      if (!App.data.audits) App.data.audits = [];
      App.data.audits.push({ ...extracted, id: App.uid(), uploaded_at: new Date().toISOString() });
      await App.saveKey('audits');

      this.renderMain();
    } catch (err) {
      console.error('Audit extraction error:', err);
      if (content) {
        content.innerHTML = `<div class="screen">
          <div class="card" style="border-left:3px solid var(--red);">
            <div class="card-title">Upload Failed</div>
            <div style="font-size:12px;color:var(--t2);margin-bottom:14px;">${esc(err.message || 'An error occurred reading the audit PDF.')}</div>
            <button class="btn btn-ghost" onclick="S.AuditTracker.render(document.getElementById('content-area'), document.getElementById('topbar-actions'))">Try Again</button>
          </div>
        </div>`;
      }
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  async extractAuditData(base64) {
    const prompt = `You are analyzing a Bar Cop Profit Audit PDF. Extract ALL of the following data and return ONLY a valid JSON object with no markdown, no backticks, no explanation.

Extract this exact structure:
{
  "bar_name": "string — name of the bar from the report",
  "location": "string — city, state",
  "audit_id": "string — audit ID like PFA-2026-0041",
  "audit_period": "string — e.g. '4 weeks ending April 25, 2026'",
  "audit_date": "string — month and year of audit",
  "data_tier": "string — e.g. 'Tier 2 Analysis'",
  "overall_score": number — the overall score out of 100,
  "industry_avg_score": number — industry average score,
  "weekly_gap_estimate": number — weekly dollars left on the table (number only, no $),
  "annual_gap_low": number — low end of combined annual gap,
  "annual_gap_high": number — high end of combined annual gap,
  "sections": [
    {
      "name": "string — section name",
      "score": number — score out of 100,
      "status": "string — CRITICAL, ATTENTION, or ON TARGET",
      "monthly_gap": number or null — monthly dollar gap (number only),
      "annual_gap": number or null,
      "key_metrics": [
        { "label": "string", "value": "string", "target": "string", "status": "string" }
      ]
    }
  ],
  "top_priorities": [
    { "rank": number, "area": "string", "title": "string", "monthly": "string", "annual": "string", "timeframe": "string" }
  ],
  "action_items": [
    { "rank": number, "area": "string", "title": "string", "priority": "HIGH or MEDIUM", "monthly_low": number or null, "monthly_high": number or null, "annual_low": number or null, "annual_high": number or null, "timeframe": "string", "what_to_do": "string — brief summary" }
  ]
}

Return ONLY the JSON object. No other text.`;

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const text = (data.content || []).map(c => c.text || '').join('').trim();

    // Strip any markdown fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      return JSON.parse(clean);
    } catch (e) {
      throw new Error('Could not parse audit data. Make sure you uploaded a Bar Cop Profit Audit PDF.');
    }
  },

  deleteAudit(id) {
    if (!confirm('Remove this audit from your history?')) return;
    App.data.audits = (App.data.audits || []).filter(a => a.id !== id);
    App.saveKey('audits').then(() => this.renderMain());
  }
};
