'use strict';
S.TrafficAudit = {
  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    const audits       = (App.data.traffic_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest       = audits[0] || null;
    const prev         = audits[1] || null;
    const now          = new Date();
    const thisMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft     = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Traffic Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive traffic audit per month. Upload screenshots of your Google Business Profile, website analytics, social media pages, and delivery platform listings. Your audit generates automatically and is ready to download within minutes.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="ta-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
      + '</div></div>';

    let latestCard = '';
    if (latest) {
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
        const ps   = prev?.sections?.[name];
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
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '   ' + esc(latest.audit_period) : '') + '</div>'
        + '</div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + (latest.pdf_data ? '<button class="btn btn-ghost btn-sm" id="ta-dl-latest" style="margin-top:8px;">Download PDF</button>' : '')
        + '</div>'
        + '</div>'
        + progressBanner
        + (sectionRows ? '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">'
          + '<thead><tr>'
          + '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Section</th>'
          + '<th style="width:140px;padding:6px 12px;border-bottom:1px solid var(--b2);"></th>'
          + '<th style="width:60px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Score</th>'
          + (prev ? '<th style="width:70px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 12px;border-bottom:1px solid var(--b2);">Change</th>' : '<th></th>')
          + '</tr></thead><tbody>' + sectionRows + '</tbody></table>' : '')
        + (actionItems ? '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Top Action Items by Impact</div>' + actionItems : '')
        + '</div>';
    }

    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.map((a,i) => {
        const p    = audits[i+1];
        const diff = p ? (a.overall_score||0) - (p.overall_score||0) : null;
        return '<tr>'
          + '<td>' + (a.date||'').slice(0,10) + '</td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + ((a.overall_score||0)>=70?'var(--gold)':(a.overall_score||0)>=50?'var(--t1)':'var(--red)') + ';">' + (a.overall_score||0) + '</td>'
          + (diff != null ? '<td style="color:' + (diff>=0?'var(--gold)':'var(--red)') + ';">' + (diff>=0?'+':'') + diff + ' pts</td>' : '<td>&mdash;</td>')
          + '<td>' + esc(a.audit_id||'') + '</td>'
          + (a.pdf_data ? '<td><button class="btn btn-ghost btn-sm ta-dl-hist" data-idx="' + i + '" style="font-size:10px;padding:4px 10px;">Download</button></td>' : '<td></td>')
          + '</tr>';
      }).join('');
      historyCard = '<div class="card">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Audit History</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Score</th><th>Change</th><th>Audit ID</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + requestCard + latestCard + historyCard + '</div>';

    this.container.querySelector('#ta-new-btn')?.addEventListener('click', () => this.showUploadForm());
    this.container.querySelector('#ta-dl-latest')?.addEventListener('click', () => this.downloadPDF(latest));
    this.container.querySelectorAll('.ta-dl-hist').forEach(btn => {
      btn.addEventListener('click', () => this.downloadPDF(audits[parseInt(btn.dataset.idx)]));
    });
  },

  showUploadForm() {
    const c = this.container;
    c.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Generate Traffic Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;margin-bottom:18px;">Upload screenshots and reports from your Google Business Profile, website analytics, social media pages, and delivery platforms. Submit whatever you have. Partial submissions generate real scores with real action items.</div>'
      + '<div style="margin-bottom:16px;">'
      + '<div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px;">What to upload for the best results:</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.8;">• Google Business Profile overview screenshot (reviews, rating, photo count)<br>• Google Search Console or analytics screenshot (sessions, traffic sources)<br>• Instagram and Facebook profile screenshots (followers, recent posts)<br>• DoorDash, UberEats, or Grubhub listing screenshot (rating, menu status)<br>• Any review screenshots showing recent activity</div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Upload Files (screenshots, PDFs, reports)</label><input type="file" id="ta-files" multiple accept="image/*,.pdf" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"/></div>'
      + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="ta-submit-btn">Generate Audit</button>'
      + '<button class="btn btn-ghost" id="ta-cancel-btn">Cancel</button>'
      + '<div id="ta-status" style="font-size:12px;color:var(--gold);display:none;"></div>'
      + '</div>'
      + '</div></div>';

    c.querySelector('#ta-cancel-btn')?.addEventListener('click', () => this.renderMain());
    c.querySelector('#ta-submit-btn')?.addEventListener('click', () => this.submitAudit());
  },

  async submitAudit() {
    const files     = document.getElementById('ta-files')?.files;
    const statusEl  = document.getElementById('ta-status');
    const submitBtn = document.getElementById('ta-submit-btn');
    if (!statusEl || !submitBtn) return;

    submitBtn.disabled = true;
    statusEl.style.display = 'block';
    statusEl.textContent   = 'Uploading and analyzing...';

    const form = new FormData();
    form.append('auditType', 'traffic');
    form.append('appData', JSON.stringify(App.data));
    if (files) { for (const f of files) form.append('file', f); }

    try {
      const res  = await fetch('/api/generate-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      statusEl.textContent = 'Saving audit...';
      const auditData = data.auditData || {};
      const newAudit  = {
        date:          new Date().toISOString().slice(0,10),
        overall_score: auditData.OVERALL_SCORE || 0,
        bar_name:      auditData.BAR_NAME       || App.data.settings?.bar_name || '',
        audit_id:      auditData.AUDIT_ID       || '',
        audit_period:  auditData.AUDIT_PERIOD   || '',
        sections: {
          'Google Business Profile': auditData.S1_SCORE || 0,
          'Website':                 auditData.S2_SCORE || 0,
          'Reviews':                 auditData.S3_SCORE || 0,
          'Search and SEO':          auditData.S4_SCORE || 0,
          'Social Media':            auditData.S5_SCORE || 0,
          'Delivery Platforms':      auditData.S6_SCORE || 0,
          'Email and Loyalty':       auditData.S7_SCORE || 0,
        },
        action_items:  auditData.action_items || [],
        pdf_data:      data.pdfBase64 || null,
        raw:           auditData
      };

      App.data.traffic_audits = App.data.traffic_audits || [];
      App.data.traffic_audits.push(newAudit);
      await App.saveKey('traffic_audits');

      if (data.pdfBase64) this.downloadPDF(newAudit);
      this.renderMain();
    } catch(e) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = 'Error: ' + (e.message || 'Audit generation failed.');
      submitBtn.disabled   = false;
    }
  },

  downloadPDF(audit) {
    if (!audit?.pdf_data) return;
    const bytes = atob(audit.pdf_data);
    const arr   = new Uint8Array(bytes.length);
    for (let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type:'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'Traffic_Audit_' + (audit.date||'').slice(0,10) + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
};
