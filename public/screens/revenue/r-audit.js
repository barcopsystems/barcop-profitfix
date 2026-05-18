'use strict';
S.RevenueAudit = {
  render(container, actions) {
    const audits = App.data.revenue_audits || [];
    const latest = audits.length ? audits[audits.length - 1] : null;
    const prev   = audits.length >= 2 ? audits[audits.length - 2] : null;

    const scoreColor = s => s >= 65 ? 'var(--gold)' : s >= 45 ? '#4888A8' : 'var(--red)';

    const ring = (score, size = 96) => {
      if (score == null) return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;"><span style="font-size:11px;color:var(--t3);">No Score</span></div>`;
      const r = (size/2)-7, circ = 2*Math.PI*r, dash = (Math.min(score,100)/100)*circ;
      const col = scoreColor(score);
      return `<div style="position:relative;width:${size}px;height:${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="5"/>
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:22px;font-weight:800;color:${col};line-height:1;">${score}</span>
        </div>
      </div>`;
    };

    // Days until next audit (monthly cadence)
    let daysUntil = 0;
    if (latest?.date) {
      const next = new Date(latest.date);
      next.setDate(next.getDate() + 30);
      daysUntil = Math.max(0, Math.ceil((next - new Date()) / 86400000));
    }

    const auditAvailable = !latest || daysUntil === 0;

    const latestCard = latest ? `
      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;">
          ${ring(latest.overall_score)}
          <div style="flex:1;min-width:200px;">
            <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Latest Revenue Audit</div>
            <div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:4px;">${new Date(latest.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
            ${prev ? `<div style="font-size:12px;color:${latest.overall_score>=prev.overall_score?'var(--gold)':'var(--red)'};">${latest.overall_score>=prev.overall_score?'+':''}${latest.overall_score-prev.overall_score} pts from prior audit</div>` : '<div style="font-size:12px;color:var(--t3);">First audit on record</div>'}
            <div style="margin-top:14px;">
              <button class="btn btn-primary" onclick="S.RevenueAudit.downloadPDF('${latest.id}')">Download PDF</button>
            </div>
          </div>
          ${!auditAvailable ? `<div style="text-align:center;padding:12px 20px;background:var(--input);border-radius:8px;">
            <div style="font-size:28px;font-weight:800;color:var(--t1);">${daysUntil}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">Days Until<br>Next Audit</div>
          </div>` : ''}
        </div>
        ${latest.sections ? `<div style="margin-top:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
          ${Object.entries(latest.sections).map(([k,v]) => `
            <div style="background:var(--input);border-radius:6px;padding:10px 12px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">${k.replace(/_/g,' ')}</div>
              <div style="font-size:18px;font-weight:800;color:${scoreColor(v)};">${v}</div>
            </div>`).join('')}
        </div>` : ''}
      </div>` : `<div class="card" style="margin-bottom:18px;"><div class="empty"><div class="empty-title">No Revenue Audits Yet</div><div class="empty-sub">Request your first audit below. Upload your POS revenue reports and labor data to get your baseline score.</div></div></div>`;

    const requestCard = auditAvailable ? `
      <div class="card" style="margin-bottom:18px;border:1px solid rgba(201,168,76,0.3);">
        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">${latest ? 'New Audit Available' : 'Request Your First Audit'}</div>
        <div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:8px;">${latest ? 'Your monthly Revenue Audit is ready.' : 'Get your Revenue Recovery baseline score.'}</div>
        <div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:18px;">Upload your POS revenue report, labor summary, and server performance data. The audit scores your check average trends, labor efficiency, menu performance, and revenue gaps. More data submitted means more sections scored.</div>
        <div id="r-audit-dropzone" style="border:2px dashed rgba(255,255,255,0.12);border-radius:8px;padding:28px;text-align:center;margin-bottom:16px;cursor:pointer;" onclick="document.getElementById('r-audit-files').click()">
          <div style="font-size:13px;color:var(--t2);margin-bottom:6px;">Click to upload files or drag and drop</div>
          <div style="font-size:11px;color:var(--t3);">POS revenue report, labor summary, server check data</div>
          <input type="file" id="r-audit-files" multiple accept=".csv,.xlsx,.xls,.pdf" style="display:none"/>
        </div>
        <div id="r-audit-file-list" style="margin-bottom:16px;font-size:12px;color:var(--t2);"></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-primary" id="r-audit-submit" style="flex-shrink:0;">Submit for Audit</button>
          <div id="r-audit-status" style="font-size:12px;color:var(--t2);"></div>
        </div>
      </div>` : '';

    const historyRows = audits.slice().reverse().map(a => `
      <tr>
        <td>${new Date(a.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
        <td style="color:${scoreColor(a.overall_score)};font-weight:700;">${a.overall_score ?? '—'}</td>
        <td>${a.tier || 'Tier 1'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="S.RevenueAudit.downloadPDF('${a.id}')">PDF</button></td>
      </tr>`).join('') || '<tr><td colspan="4" style="color:var(--t3);text-align:center;padding:14px;">No audit history yet.</td></tr>';

    container.innerHTML = `<div class="screen">
      ${latestCard}
      ${requestCard}
      <div class="sh">Audit History</div>
      <div class="tbl-wrap"><table class="sum-tbl">
        <thead><tr><th>Date</th><th>Score</th><th>Tier</th><th></th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table></div>
    </div>`;

    // File list display
    document.getElementById('r-audit-files')?.addEventListener('change', e => {
      const names = Array.from(e.target.files).map(f => f.name).join(', ');
      const el = document.getElementById('r-audit-file-list');
      if (el) el.textContent = names ? 'Files selected: ' + names : '';
    });

    document.getElementById('r-audit-submit')?.addEventListener('click', () => this.submitAudit());
  },

  async submitAudit() {
    const btn = document.getElementById('r-audit-submit');
    const status = document.getElementById('r-audit-status');
    const files = document.getElementById('r-audit-files')?.files;
    if (!files || !files.length) { if(status) { status.style.color='var(--red)'; status.textContent='Please upload at least one file before submitting.'; } return; }
    if(btn) { btn.disabled=true; btn.textContent='Submitting...'; }
    if(status) { status.style.color='var(--t2)'; status.textContent='Uploading files and generating audit...'; }
    try {
      const form = new FormData();
      form.append('module', 'revenue');
      form.append('bar_name', App.data.settings.bar_name || 'Unknown');
      form.append('settings', JSON.stringify(App.data.revenue_settings || {}));
      form.append('weeks', JSON.stringify(App.data.revenue_weeks || []));
      Array.from(files).forEach(f => form.append('files', f));
      const res = await fetch('/api/generate-audit', { method:'POST', body:form });
      if (!res.ok) throw new Error('Audit generation failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const auditRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        overall_score: null,
        tier: 'Tier 1',
        pdf_url: url
      };
      if (!App.data.revenue_audits) App.data.revenue_audits = [];
      App.data.revenue_audits.push(auditRecord);
      await App.saveKey('revenue_audits');
      const a = document.createElement('a');
      a.href = url; a.download = 'revenue-audit.pdf'; a.click();
      if(status) { status.style.color='var(--gold)'; status.textContent='Audit complete. PDF downloaded.'; }
    } catch(e) {
      if(status) { status.style.color='var(--red)'; status.textContent='Error: ' + e.message; }
    } finally {
      if(btn) { btn.disabled=false; btn.textContent='Submit for Audit'; }
    }
  },

  downloadPDF(id) {
    const audit = (App.data.revenue_audits || []).find(a => a.id === id);
    if (audit?.pdf_url) { const a = document.createElement('a'); a.href = audit.pdf_url; a.download = 'revenue-audit.pdf'; a.click(); }
    else alert('PDF not available for this audit.');
  }
};
