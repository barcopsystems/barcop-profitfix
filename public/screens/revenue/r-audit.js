'use strict';
S.RevenueAudit = {

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    const audits       = (App.data.revenue_audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest       = audits[0] || null;
    const prev         = audits[1] || null;
    const now          = new Date();
    const thisMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft     = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    // Request / Countdown Card
    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Revenue Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive revenue audit per month. Upload your POS revenue reports, labor summaries, and server data. Your audit generates automatically and is ready to download within minutes.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="ra-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
      + '</div></div>';

    // Latest Audit Card
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
        const ps  = prev?.sections?.[name];
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
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Revenue Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '   ' + esc(latest.audit_period) : '') + '</div>'
        + '</div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + (latest.pdf_data ? '<button class="btn btn-ghost btn-sm" id="ra-dl-latest" style="margin-top:8px;">Download PDF</button>' : '')
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

    // History
    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.map((a,i) => {
        const p    = audits[i+1];
        const diff = p ? (a.overall_score||0) - (p.overall_score||0) : null;
        return '<tr>'
          + '<td>' + (a.date||'').slice(0,10) + '</td>'
          + '<td class="val" style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + (a.overall_score||0) + '</td>'
          + '<td>' + (diff!=null ? '<span style="color:'+(diff>=0?'var(--gold)':'var(--red)')+';font-weight:700;">'+(diff>=0?'+':'')+diff+'</span>' : ' ') + '</td>'
          + '<td>' + esc(a.grade||'') + '</td>'
          + (a.pdf_data ? '<td><button class="btn btn-ghost btn-sm ra-dl-hist" data-idx="'+i+'" style="padding:3px 10px;">PDF</button></td>' : '<td></td>')
          + '</tr>';
      }).join('');
      historyCard = '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><div class="card-title" style="margin-bottom:0;">Audit History</div><div style="font-size:11px;color:var(--t3);">2 most recent audits stored. Download to keep permanently.</div></div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Score</th><th>Change</th><th>Grade</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first monthly Revenue Audit above. Upload your POS revenue reports and the audit builds automatically.</div></div>'
      : '';

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + historyCard + '</div>';

    document.getElementById('ra-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    document.getElementById('ra-dl-latest')?.addEventListener('click', () => this.downloadPDF(audits[0]));
    this.container.querySelectorAll('.ra-dl-hist').forEach(btn => {
      btn.addEventListener('click', () => this.downloadPDF(audits[parseInt(btn.dataset.idx)]));
    });
  },

  downloadPDF(audit) {
    if (!audit?.pdf_data) return;
    const bytes  = atob(audit.pdf_data);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'revenue-audit-' + (audit.date||'').slice(0,10) + '.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  showIntakeForm() {
    const barName   = App.data.settings.bar_name   || '';
    const cityState = App.data.settings.city_state || '';

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:3000;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;';
    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:10px;width:100%;max-width:680px;padding:32px;position:relative;">'
      + '<button id="ra-intake-close" style="position:absolute;top:14px;right:18px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Monthly Revenue Audit</div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:20px;">Upload Your Data Files</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;"><strong style="color:var(--t1);">Your app data from the last 30 days is included automatically.</strong></div>'
      + '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:14px 16px;margin-bottom:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Confirming Audit For</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(barName) + '</div>'
      + (cityState ? '<div style="font-size:12px;color:var(--t3);margin-top:2px;">' + esc(cityState) + '</div>' : '')
      + '</div>'

      // Revenue fields
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Annual Revenue</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Bar Revenue ' + tt('ra-ann-bar-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-bar-rev" placeholder="480000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Food Revenue ' + tt('ra-ann-food-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-food-rev" placeholder="320000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '</div>'

      // Section 2: Sales Data
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Sales Data</div>'
      + this.renderFileSection('required',  'POS Daily Sales Summary',                'ra-f-pos-daily',    'ra-pos-daily',   'Unlocks: Revenue trend, category split, blended check average')
      + this.renderFileSection('optional',  'Menu Sales Mix Report',                  'ra-f-menu-mix',     'ra-menu-mix',    'Unlocks: Category concentration, menu engineering signals')
      + this.renderFileSection('optional',  'Menu Price List',                        'ra-f-menu-prices',  'ra-menu-prices', 'Unlocks: Pricing gap analysis, contribution margin assessment')

      // Section 3: Server and Floor Data
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Server and Floor Data</div>'
      + this.renderFileSection('highlight', 'Server Sales Report',                    'ra-f-server-sales', 'ra-server-sales','Unlocks: Check average by server, performance spread, top and bottom server — two full audit sections')
      + this.renderFileSection('optional',  'Server Upsell Tracking Report',          'ra-f-upsell',       'ra-upsell',      'Unlocks: Appetizer and dessert attach rates, upsell execution scoring by server')
      + this.renderFileSection('optional',  'Pre-Shift Briefing Log',                 'ra-f-preshift',     'ra-preshift',    'Unlocks: Assessment of whether a performance standard is being communicated')

      // Section 4: Labor Data
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Labor Data</div>'
      + this.renderFileSection('required',  'Weekly Labor Schedule',                  'ra-f-labor-sched',  'ra-labor-sched', 'Unlocks: RPLH calculation, labor percentage, schedule efficiency analysis')
      + this.renderFileSection('optional',  'Time Clock or Payroll Actuals',          'ra-f-timeclock',    'ra-timeclock',   'Unlocks: Clock drift analysis, actual vs scheduled hours, verified overtime cost')
      + this.renderFileSection('optional',  'Labor Cost by Department',               'ra-f-labor-dept',   'ra-labor-dept',  'Unlocks: Department-level labor targeting, identifies which department is driving overage')

      // Section 5: Events and Private Dining
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Events and Private Dining</div>'
      + this.renderFileSection('optional',  'Private Dining and Event Revenue Records','ra-f-events',      'ra-events',      'Unlocks: Event frequency, average event revenue, minimum compliance, annual event revenue gap')
      + this.renderFileSection('optional',  'Catering Revenue Records',               'ra-f-catering',     'ra-catering',    'Unlocks: Catering revenue trend, package performance, repeat client rate')
      + this.renderFileSection('optional',  'Private Dining Rate Card',               'ra-f-rate-card',    'ra-rate-card',   'Unlocks: Pricing position analysis, minimum structure assessment')

      + '<div style="margin-top:20px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Additional Notes (optional)</label>'
      + '<textarea id="ra-notes" rows="3" placeholder="Recent menu changes, staffing changes, seasonal factors, new event program, anything that affects how the numbers look..." style="width:100%;background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:10px;font-size:12px;resize:vertical;font-family:Barlow,sans-serif;"></textarea></div>'
      + '<div style="display:flex;gap:12px;align-items:center;margin-top:20px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="ra-gen-btn">Generate Audit</button>'
      + '<button class="btn btn-ghost" id="ra-intake-cancel">Cancel</button>'
      + '<div id="ra-gen-status" style="font-size:12px;color:var(--t2);display:none;flex:1;"></div>'
      + '</div>'
      + '</div>';

    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    document.getElementById('ra-intake-close').onclick  = () => modal.remove();
    document.getElementById('ra-intake-cancel').onclick = () => modal.remove();
    document.getElementById('ra-gen-btn').onclick = () => this.generateAudit(modal);
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

  async generateAudit(modal) {
    const btn    = document.getElementById('ra-gen-btn');
    const status = document.getElementById('ra-gen-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (status) { status.style.display='block'; status.style.color=color; status.textContent=msg; }
    };

    const posFiles = document.getElementById('ra-f-pos-daily')?.files;
    if (!posFiles || posFiles.length === 0) {
      setStatus('POS Daily Sales Summary is required. Please attach that file to continue.', 'var(--red)');
      return;
    }

    const barRev  = parseFloat(document.getElementById('ra-bar-rev')?.value)  || 0;
    const foodRev = parseFloat(document.getElementById('ra-food-rev')?.value) || 0;
    if (barRev === 0 && foodRev === 0) {
      setStatus('Annual Bar Revenue and Annual Food Revenue are required. Enter at least one to continue.', 'var(--red)');
      return;
    }

    if (btn) { btn.disabled=true; btn.textContent='Generating...'; }
    setStatus('Reading your files and app data...', 'var(--t2)');

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
      form.append('auditType', 'revenue');
      form.append('appData', JSON.stringify(auditAppData));
      form.append('notes', document.getElementById('ra-notes')?.value || '');
      for (const id of fileInputIds) {
        const inp = document.getElementById(id);
        if (inp?.files) for (const f of inp.files) form.append(id, f, f.name);
      }

      setStatus('Analyzing your data and building your audit... This takes 60-90 seconds.', 'var(--t2)');

      const res = await fetch('/api/generate-audit', { method:'POST', body:form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({error:'Server error'}));
        throw new Error(err.error || 'Generation failed');
      }

      setStatus('Finalizing your PDF report...', 'var(--gold)');
      const data = await res.json();
      if (!data.ok || !data.pdfBase64) throw new Error(data.error || 'No PDF returned');

      const auditRecord = {
        id:            App.uid(),
        date:          new Date().toISOString().slice(0,10),
        bar_name:      App.data.settings.bar_name,
        overall_score: data.auditData?.OVERALL_SCORE || 0,
        grade:         data.auditData?.DATA_TIER_LABEL || '',
        audit_period:  data.auditData?.AUDIT_PERIOD || '',
        sections:      this.extractSections(data.auditData || {}),
        action_items:  this.extractActionItems(data.auditData || {}),
        pdf_data:      data.pdfBase64,
        generated_at:  new Date().toISOString()
      };

      if (!App.data.revenue_audits) App.data.revenue_audits = [];
      App.data.revenue_audits.push(auditRecord);
      // Keep only the 2 most recent audits to manage storage
      if (App.data.revenue_audits.length > 2) {
        App.data.revenue_audits = App.data.revenue_audits.slice(-2);
      }
      await App.saveKey('revenue_audits');

      modal.remove();
      this.renderMain();
      setTimeout(() => this.downloadPDF(auditRecord), 500);

    } catch(e) {
      setStatus('Error: ' + (e.message||'Generation failed. Please try again.'), 'var(--red)');
      if (btn) { btn.disabled=false; btn.textContent='Generate Audit'; }
    }
  },

  extractSections(d) {
    const s = {};
    if (d.S1_SCORE != null) s['Check Average'] = d.S1_SCORE;
    if (d.S2_SCORE != null) s['Labor Efficiency'] = d.S2_SCORE;
    if (d.S3_SCORE != null) s['Menu Performance'] = d.S3_SCORE;
    if (d.S4_SCORE != null) s['Server Performance'] = d.S4_SCORE;
    if (d.S5_SCORE != null) s['Revenue Gap Analysis'] = d.S5_SCORE;
    return s;
  },

  extractActionItems(d) {
    const items = [];
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Close check average gap   $' + Math.round(d.S1_MONTHLY_GAP) + '/month at current cover count', monthly_impact: d.S1_MONTHLY_GAP });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Reduce labor cost   $' + Math.round(d.S2_MONTHLY_GAP) + '/month over target', monthly_impact: d.S2_MONTHLY_GAP });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Improve menu mix   $' + Math.round(d.S3_MONTHLY_GAP) + '/month opportunity from repricing Dogs', monthly_impact: d.S3_MONTHLY_GAP });
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  }
};
