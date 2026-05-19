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

    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first monthly Traffic Audit above. Upload your screenshots and the audit builds automatically.</div></div>'
      : '';

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + historyCard + '</div>';

    document.getElementById('ta-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    document.getElementById('ta-dl-latest')?.addEventListener('click', () => this.downloadPDF(latest));
    this.container.querySelectorAll('.ta-dl-hist').forEach(btn => {
      btn.addEventListener('click', () => this.downloadPDF(audits[parseInt(btn.dataset.idx)]));
    });
  },

  showIntakeForm() {
    const s = App.data.settings;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:3000;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;';
    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:10px;width:100%;max-width:680px;padding:32px;position:relative;">'
      + '<button id="ta-intake-close" style="position:absolute;top:14px;right:18px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Monthly Traffic Audit</div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:20px;">Upload Your Data Files</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;">Upload screenshots and reports from your Google Business Profile, website analytics, social media pages, and delivery platforms. Submit whatever you have. Partial submissions generate real scores with real action items. <strong style="color:var(--t1);">Your app data from the last 30 days is included automatically.</strong></div>'
      + '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:14px 16px;margin-bottom:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Confirming Audit For</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(s.bar_name||'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:12px;color:var(--t3);margin-top:2px;">' + esc(s.city_state) + '</div>' : '')
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Google Business Profile</div>'
      + this.renderFileSection('required', 'GBP Screenshot — Full Profile View',    'ta-f-gbp-profile',  'A screenshot of your Google Business Profile as it appears in Google Maps or Search. Capture the full listing including name, address, phone, hours, website link, category, and the photo and review summary. Phone screenshots are fine. Accepted: PNG, JPG, PDF.',      'Unlocks: Section 1 full — completeness audit, photo count, post frequency, response rate')
      + this.renderFileSection('optional', 'GBP Insights Export or Screenshot',     'ta-f-gbp-insights', 'Monthly impressions, search queries, direction requests, and phone calls. In Google Business Profile dashboard go to Performance. Screenshot of the dashboard is accepted. Accepted: PDF, PNG, JPG.',                                                                     'Unlocks: Section 1 Tier 3 — full funnel from impression to action')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Website Data</div>'
      + this.renderFileSection('highlight', 'Website Analytics Export or Screenshot','ta-f-analytics',    'Monthly sessions, bounce rate, top pages by sessions, and menu page performance. Export from Google Analytics, Squarespace, Wix, or any analytics platform. A screenshot of the overview dashboard is accepted. Accepted: Excel, CSV, PDF, PNG, JPG.',                 'Unlocks: Section 2 full — sessions, bounce rate, top pages, menu page performance')
      + this.renderFileSection('optional', 'Website Screenshot — Homepage on Mobile','ta-f-mobile-site',  'A screenshot of your homepage as it appears on a phone. Shows whether your phone number, address, and call-to-action are visible without scrolling. Accepted: PNG, JPG.',                                                                                              'Unlocks: Mobile conversion assessment, above-the-fold call-to-action analysis')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Review Platform Data</div>'
      + this.renderFileSection('required', 'Google Review Page Screenshot',         'ta-f-google-reviews','Screenshot of your Google listing showing your star rating, total review count, and the most recent 5 to 10 reviews. In Google Maps click your listing and scroll to Reviews. Accepted: PNG, JPG.',                                                                    'Unlocks: Section 3 full — confirmed rating, review count, response rate, recency analysis')
      + this.renderFileSection('optional', 'Yelp Listing Screenshot',               'ta-f-yelp',          'Screenshot of your Yelp business page showing star rating, review count, and recent reviews. Submit if you have a Yelp listing. Accepted: PNG, JPG.',                                                                                                               'Unlocks: Cross-platform reputation comparison')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Search Visibility</div>'
      + this.renderFileSection('optional', 'Search Results Screenshots',            'ta-f-search',        'Open an incognito browser window. Search for "[your bar type] [your city]" and "[your neighborhood] bar" and screenshot the full results page including the Google Maps pack. Submit screenshots for at least two searches. Accepted: PNG, JPG.',                      'Unlocks: Maps pack presence confirmed, primary search visibility signal')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Social Media</div>'
      + this.renderFileSection('required', 'Instagram Profile Screenshot',          'ta-f-instagram',     'Screenshot of your Instagram profile showing follower count, post count, bio, and the most recent 9 to 12 posts in grid view. Required if Instagram is your primary platform. Phone screenshot is fine. Accepted: PNG, JPG.',                                         'Unlocks: Section 5 full — follower count, post frequency, engagement estimate, content audit')
      + this.renderFileSection('optional', 'Facebook Page Screenshot',              'ta-f-facebook',      'Screenshot of your Facebook business page showing follower count and recent posts. Accepted: PNG, JPG.',                                                                                                                                                              'Unlocks: Cross-platform social presence analysis')
      + this.renderFileSection('optional', 'Instagram Analytics Screenshot',        'ta-f-ig-analytics',  'Screenshot from Instagram Insights showing reach, impressions, and engagement for the last 30 days. In Instagram go to Professional Dashboard and select Insights. Accepted: PNG, JPG.',                                                                             'Unlocks: Section 5 Tier 3 — exact engagement rate, reach, best content type')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Delivery Platforms</div>'
      + this.renderFileSection('optional', 'Delivery Platform Dashboard Screenshot','ta-f-delivery',      'Screenshot of your merchant dashboard on DoorDash, Uber Eats, or Grubhub showing your current rating, photo count, and menu status. Log into the merchant portal for each platform and screenshot the overview page. Submit one per platform. Accepted: PNG, JPG.',  'Unlocks: Section 6 full — confirmed rating, photo count, menu completeness, promo status')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Email and Loyalty</div>'
      + this.renderFileSection('optional', 'Email Platform Screenshot',             'ta-f-email',         'Screenshot of your email platform dashboard showing list size, last send date, and any campaign performance visible on the overview screen. Works with Mailchimp, Klaviyo, Constant Contact, or any email platform. Accepted: PNG, JPG, PDF.',                       'Unlocks: Section 7 full — list size, last send date, frequency, growth mechanism')
      + this.renderFileSection('optional', 'Email Analytics Export',                'ta-f-email-analytics','Campaign performance history showing open rate, click rate, and unsubscribe rate for the last 6 to 12 months. Export from your email platform. Accepted: PDF, CSV.',                                                                                               'Unlocks: Section 7 Tier 3 — list health, open rate trend, campaign history')

      + '<div style="margin-top:20px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Additional Notes (optional)</label>'
      + '<textarea id="ta-notes" rows="3" placeholder="Recent website redesign, ownership change, seasonal operation, reduced social posting due to staffing, a new delivery platform just launched. Anything that might affect how the numbers look." style="width:100%;background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:10px;font-size:12px;resize:vertical;font-family:Barlow,sans-serif;"></textarea></div>'
      + '<div style="display:flex;gap:12px;align-items:center;margin-top:20px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="ta-gen-btn">Generate Audit</button>'
      + '<button class="btn btn-ghost" id="ta-intake-cancel">Cancel</button>'
      + '<div id="ta-gen-status" style="font-size:12px;color:var(--t2);display:none;flex:1;"></div>'
      + '</div>'
      + '</div>';

    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    document.getElementById('ta-intake-close').onclick  = () => modal.remove();
    document.getElementById('ta-intake-cancel').onclick = () => modal.remove();
    document.getElementById('ta-gen-btn').onclick = () => this.generateAudit(modal);
  },

  renderFileSection(type, title, inputId, desc, unlocks) {
    const badge = type === 'required'
      ? '<span style="background:var(--red);color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Required</span>'
      : type === 'highlight'
      ? '<span style="background:var(--gold);color:#000;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Highest Value</span>'
      : '<span style="background:var(--b1);color:var(--t3);font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;flex-shrink:0;">Optional</span>';
    return '<div style="border:1px solid var(--b2);border-radius:4px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' + badge
      + '<div style="font-size:12px;font-weight:700;color:var(--t1);">' + esc(title) + '</div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:6px;line-height:1.5;">' + esc(desc) + '</div>'
      + (unlocks ? '<div style="font-size:10px;color:var(--gold);margin-bottom:10px;line-height:1.4;">' + esc(unlocks) + '</div>' : '<div style="margin-bottom:10px;"></div>')
      + '<input type="file" id="' + inputId + '" multiple accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg" '
      + 'style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:6px;font-size:11px;cursor:pointer;width:100%;"/>'
      + '</div>';
  },

  async generateAudit(modal) {
    const btn    = document.getElementById('ta-gen-btn');
    const status = document.getElementById('ta-gen-status');
    const setStatus = (msg, color='var(--t2)') => {
      if (status) { status.style.display='block'; status.style.color=color; status.textContent=msg; }
    };

    const gbpFiles = document.getElementById('ta-f-gbp-profile')?.files;
    const reviewFiles = document.getElementById('ta-f-google-reviews')?.files;
    if ((!gbpFiles || gbpFiles.length === 0) && (!reviewFiles || reviewFiles.length === 0)) {
      setStatus('At least one Required file is needed. Attach the GBP Profile Screenshot or the Google Review Screenshot to continue.', 'var(--red)');
      return;
    }

    if (btn) { btn.disabled=true; btn.textContent='Generating...'; }
    setStatus('Reading your files and app data...', 'var(--t2)');

    const form = new FormData();
    form.append('auditType', 'traffic');
    form.append('appData', JSON.stringify(App.data));

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

    const notes = document.getElementById('ta-notes')?.value || '';
    if (notes) form.append('notes', notes);

    setStatus('Uploading files and generating audit...', 'var(--t2)');

    try {
      const res  = await fetch('/api/generate-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      setStatus('Saving audit...', 'var(--t2)');
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

      if (modal) modal.remove();
      if (data.pdfBase64) this.downloadPDF(newAudit);
      this.renderMain();
    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (btn) { btn.disabled=false; btn.textContent='Generate Audit'; }
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
