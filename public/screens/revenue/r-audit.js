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
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive revenue audit per month. Upload your POS reports and labor data. Your scored audit appears on screen immediately. Print or save it as a PDF from your browser.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="ra-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
      + '</div></div>';

    let latestCard = '';
    if (latest) {
      const prev = audits[1] || null;
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

    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.map((a,i) => {
        const p    = audits[i+1];
        const diff = p ? (a.overall_score||0) - (p.overall_score||0) : null;
        return '<tr>'
          + '<td>' + (a.date||'').slice(0,10) + '</td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + ((a.overall_score||0)>=70?'var(--gold)':(a.overall_score||0)>=50?'var(--t1)':'var(--red)') + ';">' + (a.overall_score||0) + '</td>'
          + (diff != null ? '<td style="color:' + (diff>=0?'var(--gold)':'var(--red)') + ';">' + (diff>=0?'+':'') + diff + ' pts</td>' : '<td></td>')
          + '<td style="color:var(--t3);font-size:11px;">' + esc(a.grade||a.audit_id||'') + '</td>'
          + '<td><button class="btn btn-ghost btn-sm ra-view-btn" data-idx="' + i + '" style="font-size:10px;padding:4px 10px;">View</button></td>'
          + '</tr>';
      }).join('');
      historyCard = '<div class="card">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Audit History</div>'
        + '<div style="font-size:11px;color:var(--t3);">Last 12 months stored. Print any audit to save as PDF.</div>'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Score</th><th>Change</th><th>Grade</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '</div>';
    }

    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first monthly Revenue Audit above. Upload your POS reports and the audit appears on screen immediately.</div></div>'
      : '';

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + historyCard + '</div>';

    document.getElementById('ra-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.ra-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx)));
    });
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
    const scoreColor = (audit.overall_score||0) >= 80 ? '#C9A84C' : (audit.overall_score||0) >= 60 ? '#fff' : '#c0392b';

    const sectionBlock = (num, name, score, items) => {
      const bar   = Math.min(100, Math.max(0, score||0));
      const color = (score||0) >= 70 ? 'var(--gold)' : (score||0) >= 50 ? 'var(--t1)' : 'var(--red)';
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
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Revenue Score</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:72px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (audit.overall_score||0) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">Industry Avg: ' + (d.INDUSTRY_AVG||61) + '  |  Target: ' + (d.TARGET_SCORE||65) + '</div>'
      + '</div>'
      + '</div>'
      + (totalMonthly > 0 ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Total Recoverable Per Month</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly) + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Annualized</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly*12) + '</div></div>'
        + '</div>' : '')
      + '</div>'
      + (actionItems ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Action Items -- Ranked by Impact</div>'
        + actionItems + '</div>' : '')
      + sections
      + '</div>';
  },

  showIntakeForm() {
    const s = App.data.settings;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:3000;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;';
    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:10px;width:100%;max-width:680px;padding:32px;position:relative;">'
      + '<button id="ra-intake-close" style="position:absolute;top:14px;right:18px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Monthly Revenue Audit</div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:20px;">Upload Your Data Files</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;">Upload your POS reports and labor data. The daily sales summary and labor schedule are required. Every additional file unlocks more scored sections. <strong style="color:var(--t1);">Your app data from the last 30 days is included automatically.</strong></div>'
      + '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:14px 16px;margin-bottom:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Confirming Audit For</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(s.bar_name||'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:12px;color:var(--t3);margin-top:2px;">' + esc(s.city_state) + '</div>' : '')
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Annual Revenue</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Bar Revenue ' + tt('ra-ann-bar-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-bar-rev" placeholder="480000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Food Revenue ' + tt('ra-ann-food-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="ra-food-rev" placeholder="320000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Sales Data</div>'
      + this.renderFileSection('required',  'POS Daily Sales Summary',                'ra-f-pos-daily',    'ra-pos-daily',   'Unlocks: Revenue trend, category split, blended check average')
      + this.renderFileSection('optional',  'Menu Sales Mix Report',                  'ra-f-menu-mix',     'ra-menu-mix',    'Unlocks: Category concentration, menu engineering signals')
      + this.renderFileSection('optional',  'Menu Price List',                        'ra-f-menu-prices',  'ra-menu-prices', 'Unlocks: Pricing gap analysis, contribution margin assessment')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Server and Floor Data</div>'
      + this.renderFileSection('highlight', 'Server Sales Report',                    'ra-f-server-sales', 'ra-server-sales','Unlocks: Check average by server, performance spread, top and bottom server')
      + this.renderFileSection('optional',  'Server Upsell Tracking Report',          'ra-f-upsell',       'ra-upsell',      'Unlocks: Appetizer and dessert attach rates, upsell execution scoring by server')
      + this.renderFileSection('optional',  'Pre-Shift Briefing Log',                 'ra-f-preshift',     'ra-preshift',    'Unlocks: Assessment of whether a performance standard is being communicated')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Labor Data</div>'
      + this.renderFileSection('required',  'Weekly Labor Schedule',                  'ra-f-labor-sched',  'ra-labor-sched', 'Unlocks: RPLH calculation, labor percentage, schedule efficiency analysis')
      + this.renderFileSection('optional',  'Time Clock or Payroll Actuals',          'ra-f-timeclock',    'ra-timeclock',   'Unlocks: Clock drift analysis, actual vs scheduled hours, verified overtime cost')
      + this.renderFileSection('optional',  'Labor Cost by Department',               'ra-f-labor-dept',   'ra-labor-dept',  'Unlocks: Department-level labor targeting, identifies which department is driving overage')

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
      setStatus('POS Daily Sales Summary is required. Attach that file to continue.', 'var(--red)');
      return;
    }

    const barRev  = parseFloat(document.getElementById('ra-bar-rev')?.value)  || 0;
    const foodRev = parseFloat(document.getElementById('ra-food-rev')?.value) || 0;
    if (barRev === 0 && foodRev === 0) {
      setStatus('Annual Bar Revenue and Annual Food Revenue are required. Enter at least one to continue.', 'var(--red)');
      return;
    }

    if (btn) { btn.disabled=true; btn.textContent='Analyzing...'; }
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
      form.append('appData', JSON.stringify(auditAppData));
      form.append('notes', document.getElementById('ra-notes')?.value || '');
      for (const id of fileInputIds) {
        const inp = document.getElementById(id);
        if (inp?.files) for (const f of inp.files) form.append(id, f, f.name);
      }

      setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

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

      modal.remove();
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message || 'Audit generation failed. Try again.'), 'var(--red)');
      if (btn) { btn.disabled=false; btn.textContent='Generate Audit'; }
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
  }
};
