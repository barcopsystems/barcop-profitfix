'use strict';
S.AuditTracker = {

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    const audits  = (App.data.audits || []).slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const latest  = audits[0] || null;
    const prev    = audits[1] || null;
    const now     = new Date();
    const thisMonthKey   = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth   = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);
    const endOfMonth     = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft       = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    // ── Request / Countdown Card ─────────────────────────────────────────
    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Profit Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">'
      + 'One comprehensive profit audit per month. Upload your POS reports and data files — your audit generates automatically and is ready to download within minutes.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="at-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
      + '</div></div>';

    // ── Latest Audit Card ────────────────────────────────────────────────
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
          + '<div style="font-size:12px;color:var(--t2);">' + prev.overall_score + ' → ' + latest.overall_score + '</div>'
          + '</div>';
      }

      const sections = latest.sections || {};
      const sectionRows = Object.entries(sections).map(([name, score]) => {
        const ps = prev?.sections?.[name];
        const diff = ps != null ? score - ps : null;
        const bar = Math.min(100, Math.max(0, score));
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
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? ' — ' + esc(latest.audit_period) : '') + '</div>'
        + '</div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + (latest.pdf_data ? '<button class="btn btn-ghost btn-sm" id="at-dl-latest" style="margin-top:8px;">Download PDF</button>' : '')
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

    // ── History ──────────────────────────────────────────────────────────
    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.map((a,i) => {
        const p = audits[i+1];
        const diff = p ? (a.overall_score||0) - (p.overall_score||0) : null;
        return '<tr>'
          + '<td>' + (a.date||'').slice(0,10) + '</td>'
          + '<td class="val" style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + (a.overall_score||0) + '</td>'
          + '<td>' + (diff!=null ? '<span style="color:' + (diff>=0?'var(--gold)':'var(--red)') + ';font-weight:700;">' + (diff>=0?'+':'') + diff + '</span>' : '—') + '</td>'
          + '<td>' + esc(a.grade||'') + '</td>'
          + (a.pdf_data ? '<td><button class="btn btn-ghost btn-sm at-dl-hist" data-idx="' + i + '" style="padding:3px 10px;">PDF</button></td>' : '<td></td>')
          + '</tr>';
      }).join('');
      historyCard = '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><div class="card-title" style="margin-bottom:0;">Audit History</div><div style="font-size:11px;color:var(--t3);">2 most recent audits stored. Download to keep permanently.</div></div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Score</th><th>Change</th><th>Grade</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    const emptyState = !latest ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
      + '<div class="empty-sub">Generate your first monthly Profit Audit above. Upload your POS reports and the audit builds automatically.</div></div>' : '';

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + historyCard + '</div>';

    // Wire buttons
    document.getElementById('at-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    document.getElementById('at-dl-latest')?.addEventListener('click', () => this.downloadPDF(audits[0]));
    this.container.querySelectorAll('.at-dl-hist').forEach(btn => {
      btn.addEventListener('click', () => this.downloadPDF(audits[parseInt(btn.dataset.idx)]));
    });
  },

  downloadPDF(audit) {
    if (!audit?.pdf_data) return;
    const bytes = Uint8Array.from(atob(audit.pdf_data), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], {type:'application/pdf'});
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = 'BarCop_Profit_Audit_' + (audit.date||'').slice(0,10) + '.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  showIntakeForm() {
    const s = App.data.settings;
    const modal = document.createElement('div');
    modal.id = 'at-intake-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9000;overflow-y:auto;display:flex;justify-content:center;padding:20px;';

    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:10px;padding:32px;max-width:680px;width:100%;margin:auto;position:relative;">'
      + '<button id="at-intake-close" style="position:absolute;top:14px;right:18px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Monthly Profit Audit</div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:20px;">Upload Your Data Files</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;">Upload your data files below. The POS Beverages report is required. Every additional file you submit unlocks more scored sections and more specific action items. <strong style="color:var(--t1);">Your app data from the last 30 days is included automatically.</strong></div>'
      + '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:14px 16px;margin-bottom:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Confirming Audit For</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(s.bar_name||'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:12px;color:var(--t3);margin-top:2px;">' + esc(s.city_state) + '</div>' : '')
      + '</div>'

      // Revenue fields
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Annual Revenue</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Bar Revenue ' + tt('at-ann-bar-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="at-bar-rev" placeholder="480000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Food Revenue ' + tt('at-ann-food-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="at-food-rev" placeholder="320000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '</div>'

      // Bar Data
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Bar Data</div>'
      + this.renderFileSection('required', 'POS Sales Report — Beverages',        'at-f-pos-bev',   'at-pos-bev',   'Unlocks: Revenue baseline, category split, estimated gap calculations')
      + this.renderFileSection('optional', 'Bar Inventory Count Sheets',           'at-f-bar-inv',   'at-bar-inv',   'Unlocks: Actual pour cost %, theoretical vs. actual variance by product')
      + this.renderFileSection('optional', 'POS Exception Report — Voids and Comps','at-f-exception','at-exception', 'Unlocks: Void and comp rate, behavioral risk indicators, theft vs. training diagnosis')
      + this.renderFileSection('optional', 'Cash Drawer Reconciliation Records',   'at-f-cash',      'at-cash',      'Unlocks: Cash handling gap analysis by shift')
      + this.renderFileSection('optional', 'Beverage Invoices and Delivery Receipts','at-f-bev-inv', 'at-bev-inv',   'Unlocks: Delivery accuracy rate, vendor short analysis')
      + this.renderFileSection('optional', 'Vendor Price List or Recent Invoices', 'at-f-vendor',    'at-vendor',    'Unlocks: Price drift analysis, distributor negotiation data')

      // Kitchen Data
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Kitchen Data</div>'
      + this.renderFileSection('optional', 'POS Sales Report — Food',              'at-f-pos-food',  'at-pos-food',  'Unlocks: Food cost benchmarking, category-level analysis')
      + this.renderFileSection('optional', 'Kitchen Inventory Count Sheets',       'at-f-kit-inv',   'at-kit-inv',   'Unlocks: Actual food cost %, kitchen variance, spoilage rate')
      + this.renderFileSection('optional', 'Food Invoices and Delivery Receipts',  'at-f-food-inv',  'at-food-inv',  'Unlocks: Food delivery accuracy, produce par analysis')
      + this.renderFileSection('highlight','Recipe Costing Sheet',                 'at-f-recipe',    'at-recipe',    'Unlocks: Yield-corrected cost per dish, every repricing opportunity ranked by annual dollar impact')
      + this.renderFileSection('optional', 'Daily Prep Sheets or Production Logs', 'at-f-prep',      'at-prep',      'Unlocks: Production loss analysis, prep yield by station')
      + this.renderFileSection('optional', 'Daily Waste Logs',                     'at-f-waste',     'at-waste',     'Unlocks: Weekly spoilage cost, waste pattern diagnosis')

      // Labor Data
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Labor Data</div>'
      + this.renderFileSection('required', 'Payroll or Time Clock Data',           'at-f-payroll',   'at-payroll',   'Unlocks: Verified prime cost, labor by department, RPLH calculation')

      + '<div style="margin-top:20px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Additional Notes (optional)</label>'
      + '<textarea id="at-notes" style="background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-family:Barlow,sans-serif;font-size:12px;padding:10px;width:100%;min-height:80px;resize:vertical;" placeholder="Recent ownership change, POS migration, seasonal operation, renovation period, staffing changes. Anything that might affect how the numbers look."></textarea></div>'

      + '<div id="at-gen-status" style="font-size:12px;margin:14px 0;display:none;"></div>'
      + '<div style="display:flex;gap:10px;margin-top:20px;">'
      + '<button class="btn btn-primary" id="at-gen-btn">Generate Audit</button>'
      + '<button class="btn btn-ghost" id="at-intake-cancel">Cancel</button>'
      + '</div>'
      + '</div>';

    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    document.getElementById('at-intake-close').onclick  = () => modal.remove();
    document.getElementById('at-intake-cancel').onclick = () => modal.remove();
    document.getElementById('at-gen-btn').onclick = () => this.generateAudit(modal);
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
    const btn    = document.getElementById('at-gen-btn');
    const status = document.getElementById('at-gen-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (status) { status.style.display='block'; status.style.color=color; status.textContent=msg; }
    };

    // Validate: require at least one file
    const fileInputIds = ['at-f-pos-bev','at-f-bar-inv','at-f-exception','at-f-cash','at-f-bev-inv',
      'at-f-vendor','at-f-pos-food','at-f-kit-inv','at-f-food-inv','at-f-recipe','at-f-prep','at-f-waste','at-f-payroll'];
    const allFiles = [];
    for (const id of fileInputIds) {
      const inp = document.getElementById(id);
      if (inp?.files) for (const f of inp.files) allFiles.push({file:f, field:id});
    }

    const posFiles = document.getElementById('at-f-pos-bev')?.files;
    if (!posFiles || posFiles.length === 0) {
      setStatus('POS Beverages report is required. Please attach that file to continue.', 'var(--red)');
      return;
    }

    const barRev  = parseFloat(document.getElementById('at-bar-rev')?.value)  || 0;
    const foodRev = parseFloat(document.getElementById('at-food-rev')?.value) || 0;
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

      // Build FormData
      const form = new FormData();
      form.append('auditType', 'profit');
      form.append('appData', JSON.stringify(auditAppData));
      form.append('notes', document.getElementById('at-notes')?.value || '');
      for (const {file, field} of allFiles) {
        form.append(field, file, file.name);
      }

      setStatus('Analyzing your data and building your audit... This takes 60-90 seconds.', 'var(--t2)');

      const res = await fetch('/api/generate-audit', {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({error:'Server error'}));
        throw new Error(err.error || 'Generation failed');
      }

      setStatus('Finalizing your PDF report...', 'var(--gold)');
      const data = await res.json();

      if (!data.ok || !data.pdfBase64) throw new Error(data.error || 'No PDF returned');

      // Save audit to app data
      const auditRecord = {
        id:            App.uid(),
        date:          new Date().toISOString().slice(0,10),
        bar_name:      App.data.settings.bar_name,
        overall_score: data.auditData.OVERALL_SCORE || 0,
        grade:         data.auditData.DATA_TIER_LABEL || '',
        audit_period:  data.auditData.AUDIT_PERIOD || '',
        audit_id:      data.auditData.AUDIT_ID || '',
        sections:      this.extractSections(data.auditData),
        action_items:  this.extractActionItems(data.auditData),
        pdf_data:      data.pdfBase64,
        generated_at:  new Date().toISOString()
      };

      if (!App.data.audits) App.data.audits = [];
      App.data.audits.push(auditRecord);
      // Keep only the 2 most recent audits to manage storage
      if (App.data.audits.length > 2) {
        App.data.audits = App.data.audits.slice(-2);
      }
      await App.saveKey('audits');

      modal.remove();
      this.renderMain();

      // Auto-download
      setTimeout(() => this.downloadPDF(auditRecord), 500);

    } catch(e) {
      setStatus('Error: ' + (e.message||'Generation failed. Please try again.'), 'var(--red)');
      if (btn) { btn.disabled=false; btn.textContent='Generate Audit'; }
    }
  },

  extractSections(d) {
    // Map score variables to section names
    const sections = {};
    if (d.S1_SCORE != null) sections['Bar Cost & Pour Control'] = d.S1_SCORE;
    if (d.S2_SCORE != null) sections['Theft & Loss Prevention'] = d.S2_SCORE;
    if (d.S3_SCORE != null) sections['Food Cost Control'] = d.S3_SCORE;
    if (d.S4_SCORE != null) sections['Vendor Control'] = d.S4_SCORE;
    if (d.S5_SCORE != null) sections['Prime Cost'] = d.S5_SCORE;
    return sections;
  },

  extractActionItems(d) {
    // Build action items from section gap data
    const items = [];
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Reduce bar pour cost — ' + (d.S1_MONTHLY_GAP > 0 ? '$' + Math.round(d.S1_MONTHLY_GAP) + '/month gap vs target' : ''), monthly_impact: d.S1_MONTHLY_GAP });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Reduce food cost — ' + '$' + Math.round(d.S3_MONTHLY_GAP) + '/month gap vs target', monthly_impact: d.S3_MONTHLY_GAP });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Address void/comp rate — ' + '$' + Math.round(d.S2_MONTHLY_GAP) + '/month in excess', monthly_impact: d.S2_MONTHLY_GAP });
    if (d.S4_EXPOSURE_MONTHLY > 0) items.push({ action: 'Improve vendor verification — $' + Math.round(d.S4_EXPOSURE_MONTHLY) + '/month exposure', monthly_impact: d.S4_EXPOSURE_MONTHLY });
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  }
};
