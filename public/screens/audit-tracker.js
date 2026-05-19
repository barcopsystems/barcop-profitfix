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
    const now          = new Date();
    const thisMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft     = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:200px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Profit Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:500px;">One comprehensive profit audit per month. Upload your POS reports and data files. Your scored audit appears on screen immediately. Print or save it as a PDF from your browser.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;"><div style="font-size:30px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div></div>'
          : '<button class="btn btn-primary" id="at-new-btn" style="flex-shrink:0;">Generate This Month\'s Audit</button>')
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
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Profit Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '  ' + esc(latest.audit_period) : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (latest.overall_score||0) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + '<button class="btn btn-ghost btn-sm at-view-btn" data-idx="0">View Full Audit</button>'
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
          + (diff != null ? '<td style="color:' + (diff>=0?'var(--gold)':'var(--red)') + ';">' + (diff>=0?'+':'') + diff + ' pts</td>' : '<td></td>')
          + '<td style="color:var(--t3);font-size:11px;">' + esc(a.grade||a.audit_id||'') + '</td>'
          + '<td><button class="btn btn-ghost btn-sm at-view-btn" data-idx="' + i + '" style="font-size:10px;padding:4px 10px;">View</button></td>'
          + '</tr>';
      }).join('');
      historyCard = '<div class="card">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div class="card-title" style="margin-bottom:0;">Audit History</div>'
        + '<div style="font-size:11px;color:var(--t3);">Last 12 months stored. Print any audit to save as PDF.</div>'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Score</th><th>Change</th><th>Grade</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '</div>';
    }

    const emptyState = !latest
      ? '<div class="empty"><div class="empty-title">No Audits Yet</div>'
        + '<div class="empty-sub">Generate your first monthly Profit Audit above. Upload your POS reports and the audit appears on screen immediately.</div></div>'
      : '';

    this.container.innerHTML = '<div class="screen">' + requestCard + (latest ? latestCard : emptyState) + historyCard + '</div>';

    document.getElementById('at-new-btn')?.addEventListener('click', () => this.showIntakeForm());
    this.container.querySelectorAll('.at-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx)));
    });
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
    printBtn.onclick = () => window.print();
    this.actions.appendChild(printBtn);

    const d = audit.raw || audit;
    const scoreColor = (audit.overall_score||0) >= 80 ? '#C9A84C' : (audit.overall_score||0) >= 60 ? '#fff' : '#c0392b';

    const sectionBlock = (num, name, score, items, signals) => {
      const bar   = Math.min(100, Math.max(0, score||0));
      const color = (score||0) >= 70 ? 'var(--gold)' : (score||0) >= 50 ? 'var(--t1)' : 'var(--red)';
      const rows  = items.filter(([,v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0').map(([label, val, highlight]) =>
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
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:42px;font-weight:700;color:' + color + ';line-height:1;">' + (score||0) + '</div>'
        + '<div style="background:var(--b2);height:5px;border-radius:3px;width:80px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + color + ';border-radius:3px;"></div></div>'
        + '</div></div>'
        + (rows ? '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>' : '')
        + sigRows
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

    const sections = [
      sectionBlock(1, 'Bar Cost and Pour Control', d.S1_SCORE, [
        ['Bar Pour Cost %',         pct(d.S1_BAR_COST_PCT, d.S1_TARGET_PCT), d.S1_BAR_COST_PCT > d.S1_TARGET_PCT ? 'warn' : 'good'],
        ['Monthly Bar Revenue',     cur(d.S1_BAR_REV_MONTHLY)],
        ['Bev COGS Period',         cur(d.S1_BEV_COGS_PERIOD)],
        ['Inventory Variance %',    pct(d.S1_INV_VARIANCE_PCT), d.S1_INV_VARIANCE_PCT > 2 ? 'warn' : ''],
        ['Inventory Variance $',    cur(d.S1_INV_VARIANCE_AMT), d.S1_INV_VARIANCE_AMT > 500 ? 'warn' : ''],
        ['Pour Method',             d.S1_POUR_METHOD],
        ['Recipe Coverage',         d.S1_RECIPE_COVERAGE],
        ['Monthly Gap vs Target',   s1gap || (d.S1_MONTHLY_GAP ? cur(d.S1_MONTHLY_GAP) : ''), d.S1_MONTHLY_GAP > 0 ? 'warn' : ''],
        ['Annual Gap',              cur(d.S1_ANNUAL_GAP), d.S1_ANNUAL_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(2, 'Theft and Loss Prevention', d.S2_SCORE, [
        ['Void/Comp %',             pct(d.S2_VOID_COMP_PCT), d.S2_VOID_COMP_PCT > 2 ? 'warn' : ''],
        ['Void/Comp Amount',        cur(d.S2_VOID_COMP_AMT), d.S2_VOID_COMP_AMT > 0 ? 'warn' : ''],
        ['Unauthorized Voids %',    pct(d.S2_VOIDS_NO_APPROVAL_PCT), d.S2_VOIDS_NO_APPROVAL_PCT > 0 ? 'warn' : ''],
        ['Drawer Reconciliation',   d.S2_DRAWER_RECON],
        ['Cash Policy Documented',  d.S2_CASH_POLICY],
        ['Void Approval Required',  d.S2_VOID_APPROVAL],
        ['Spillage Log',            d.S2_SPILLAGE_LOG],
        ['Monthly Gap',             cur(d.S2_MONTHLY_GAP), d.S2_MONTHLY_GAP > 0 ? 'warn' : ''],
      ]),
      sectionBlock(3, 'Food Cost Control', d.S3_SCORE, [
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
      sectionBlock(4, 'Vendor Control', d.S4_SCORE, [
        ['Bev Invoice Count',       num(d.S4_BEV_INVOICE_COUNT)],
        ['Food Invoice Count',      num(d.S4_FOOD_INVOICE_COUNT)],
        ['Monthly Vendor Spend',    cur(d.S4_VENDOR_SPEND_MONTHLY)],
        ['Invoice vs PO Matching',  d.S4_INVOICE_VS_PO],
        ['Price Verification',      d.S4_PRICE_VERIFY],
        ['Annual Bid Process',      d.S4_ANNUAL_BIDS],
        ['Backup Vendors',          d.S4_BACKUP_VENDORS],
        ['Monthly Exposure',        cur(d.S4_EXPOSURE_MONTHLY), d.S4_EXPOSURE_MONTHLY > 500 ? 'warn' : ''],
        ['Annual Exposure',         cur(d.S4_EXPOSURE_ANNUAL),  d.S4_EXPOSURE_ANNUAL  > 5000? 'warn' : ''],
      ]),
      sectionBlock(5, 'Prime Cost', d.S5_SCORE, [
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
      sectionBlock(6, 'Operational Risk Signals', d.S6_SIG1_SCORE ? null : 0, [], signals6),
    ].join('');

    const actionItems = (audit.action_items || []).map((a,i) =>
      '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;">' + (i+1) + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(a.action||a) + '</div>'
      + (a.monthly_impact ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:4px;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
      + '</div></div>'
    ).join('');

    // Total recoverable
    const totalMonthly = (audit.action_items||[]).reduce((s,a) => s+(a.monthly_impact||0), 0);

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Profit Recovery Audit</div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
        + (audit.date||'').slice(0,10)
        + (audit.audit_period ? '  |  ' + esc(audit.audit_period) : '')
        + (audit.audit_id ? '  |  ' + esc(audit.audit_id) : '')
        + (audit.grade ? '  |  ' + esc(audit.grade) : '')
        + '</div>'
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Profit Score</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:72px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (audit.overall_score||0) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">Industry Avg: ' + (d.INDUSTRY_AVG||63) + '  |  Target: ' + (d.TARGET_SCORE||65) + '</div>'
      + '</div>'
      + '</div>'
      + (totalMonthly > 0 ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Total Recoverable Per Month</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly) + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Annualized</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(totalMonthly*12) + '</div></div>'
        + (d.WEEKLY_GAP_AMT ? '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">Weekly Gap</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:var(--gold);">' + esc(String(d.WEEKLY_GAP_AMT)) + '</div></div>' : '')
        + '</div>' : '')
      + '</div>'

      + (actionItems ? '<div class="card" style="margin-bottom:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Action Items — Ranked by Impact</div>'
        + actionItems + '</div>' : '')

      + sections
      + '</div>';
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
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6;">Upload your data files below. The POS Beverages report is required. Every additional file unlocks more scored sections and more specific action items. <strong style="color:var(--t1);">Your app data from the last 30 days is included automatically.</strong></div>'
      + '<div style="background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:14px 16px;margin-bottom:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Confirming Audit For</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(s.bar_name||'Your Bar') + '</div>'
      + (s.city_state ? '<div style="font-size:12px;color:var(--t3);margin-top:2px;">' + esc(s.city_state) + '</div>' : '')
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Annual Revenue</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Bar Revenue ' + tt('at-ann-bar-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="at-bar-rev" placeholder="480000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '<div style="flex:1;min-width:200px;"><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Annual Food Revenue ' + tt('at-ann-food-rev') + ' <span style="color:var(--red);">*</span></label><div style="display:flex;align-items:center;background:var(--input);border:1px solid var(--b1);border-radius:4px;overflow:hidden;"><span style="padding:0 10px;color:var(--t3);font-size:13px;">$</span><input type="number" id="at-food-rev" placeholder="320000" style="background:transparent;border:none;color:var(--t1);font-size:13px;padding:8px 10px 8px 0;width:100%;outline:none;"/></div></div>'
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Bar Data</div>'
      + this.renderFileSection('required', 'POS Sales Report — Beverages',         'at-f-pos-bev',   'at-pos-bev',   'Unlocks: Revenue baseline, category split, estimated gap calculations')
      + this.renderFileSection('optional', 'Bar Inventory Count Sheets',            'at-f-bar-inv',   'at-bar-inv',   'Unlocks: Actual pour cost %, theoretical vs. actual variance by product')
      + this.renderFileSection('optional', 'POS Exception Report — Voids and Comps','at-f-exception', 'at-exception', 'Unlocks: Void and comp rate, behavioral risk indicators, theft vs. training diagnosis')
      + this.renderFileSection('optional', 'Cash Drawer Reconciliation Records',    'at-f-cash',      'at-cash',      'Unlocks: Cash handling gap analysis by shift')
      + this.renderFileSection('optional', 'Beverage Invoices and Delivery Receipts','at-f-bev-inv',  'at-bev-inv',   'Unlocks: Delivery accuracy rate, vendor short analysis')
      + this.renderFileSection('optional', 'Vendor Price List or Recent Invoices',  'at-f-vendor',    'at-vendor',    'Unlocks: Price drift analysis, distributor negotiation data')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Kitchen Data</div>'
      + this.renderFileSection('optional', 'POS Sales Report — Food',               'at-f-pos-food',  'at-pos-food',  'Unlocks: Food cost benchmarking, category-level analysis')
      + this.renderFileSection('optional', 'Kitchen Inventory Count Sheets',        'at-f-kit-inv',   'at-kit-inv',   'Unlocks: Actual food cost %, kitchen variance, spoilage rate')
      + this.renderFileSection('optional', 'Food Invoices and Delivery Receipts',   'at-f-food-inv',  'at-food-inv',  'Unlocks: Food delivery accuracy, produce par analysis')
      + this.renderFileSection('highlight','Recipe Costing Sheet',                  'at-f-recipe',    'at-recipe',    'Unlocks: Yield-corrected cost per dish, every repricing opportunity ranked by annual dollar impact')
      + this.renderFileSection('optional', 'Daily Prep Sheets or Production Logs',  'at-f-prep',      'at-prep',      'Unlocks: Production loss analysis, prep yield by station')
      + this.renderFileSection('optional', 'Daily Waste Logs',                      'at-f-waste',     'at-waste',     'Unlocks: Weekly spoilage cost, waste pattern diagnosis')

      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:20px 0 10px;">Labor Data</div>'
      + this.renderFileSection('required', 'Payroll or Time Clock Data',            'at-f-payroll',   'at-payroll',   'Unlocks: Verified prime cost, labor by department, RPLH calculation')

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

    const fileInputIds = ['at-f-pos-bev','at-f-bar-inv','at-f-exception','at-f-cash','at-f-bev-inv',
      'at-f-vendor','at-f-pos-food','at-f-kit-inv','at-f-food-inv','at-f-recipe','at-f-prep','at-f-waste','at-f-payroll'];
    const allFiles = [];
    for (const id of fileInputIds) {
      const inp = document.getElementById(id);
      if (inp?.files) for (const f of inp.files) allFiles.push({file:f, field:id});
    }

    const posFiles = document.getElementById('at-f-pos-bev')?.files;
    if (!posFiles || posFiles.length === 0) {
      setStatus('POS Beverages report is required. Attach that file to continue.', 'var(--red)');
      return;
    }

    const barRev  = parseFloat(document.getElementById('at-bar-rev')?.value)  || 0;
    const foodRev = parseFloat(document.getElementById('at-food-rev')?.value) || 0;
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

      const form = new FormData();
      form.append('appData', JSON.stringify(auditAppData));
      form.append('notes', document.getElementById('at-notes')?.value || '');
      for (const {file, field} of allFiles) form.append(field, file, file.name);

      setStatus('Analyzing your data... This takes 60 to 90 seconds.', 'var(--t2)');

      const res  = await fetch('/api/generate-profit-audit', { method:'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');

      setStatus('Saving audit...', 'var(--gold)');
      const d = data.auditData || {};

      const auditRecord = {
        id:            App.uid(),
        date:          new Date().toISOString().slice(0,10),
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

      if (!App.data.audits) App.data.audits = [];
      App.data.audits.push(auditRecord);
      if (App.data.audits.length > 12) App.data.audits = App.data.audits.slice(-12);
      await App.saveKey('audits');

      modal.remove();
      this.renderMain();
      setTimeout(() => this.viewAudit(0), 100);

    } catch(e) {
      setStatus('Error: ' + (e.message||'Generation failed. Please try again.'), 'var(--red)');
      if (btn) { btn.disabled=false; btn.textContent='Generate Audit'; }
    }
  },

  extractSections(d) {
    const s = {};
    if (d.S1_SCORE != null) s['Bar Cost and Pour Control'] = d.S1_SCORE;
    if (d.S2_SCORE != null) s['Theft and Loss Prevention']  = d.S2_SCORE;
    if (d.S3_SCORE != null) s['Food Cost Control']          = d.S3_SCORE;
    if (d.S4_SCORE != null) s['Vendor Control']             = d.S4_SCORE;
    if (d.S5_SCORE != null) s['Prime Cost']                 = d.S5_SCORE;
    return s;
  },

  extractActionItems(d) {
    const items = [];
    if (d.S1_MONTHLY_GAP > 0) items.push({ action: 'Reduce bar pour cost. $' + Math.round(d.S1_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S1_MONTHLY_GAP });
    if (d.S3_MONTHLY_GAP > 0) items.push({ action: 'Reduce food cost. $' + Math.round(d.S3_MONTHLY_GAP) + '/month gap vs target.', monthly_impact: d.S3_MONTHLY_GAP });
    if (d.S2_MONTHLY_GAP > 0) items.push({ action: 'Address void and comp rate. $' + Math.round(d.S2_MONTHLY_GAP) + '/month in excess.', monthly_impact: d.S2_MONTHLY_GAP });
    if (d.S4_EXPOSURE_MONTHLY > 0) items.push({ action: 'Improve vendor verification. $' + Math.round(d.S4_EXPOSURE_MONTHLY) + '/month exposure.', monthly_impact: d.S4_EXPOSURE_MONTHLY });
    if (d.S5_COMBINED_COGS_GAP > 0) items.push({ action: 'Close prime cost gap. $' + Math.round(d.S5_COMBINED_COGS_GAP) + '/month combined COGS overage.', monthly_impact: d.S5_COMBINED_COGS_GAP });
    return items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
  }
};
