'use strict';

/* ── Weekly P&L Brief builder ─────────────────────────────────────────────────
   NOT a navigable screen. The old Profit "Reports and History" page was retired
   (its Weekly History moved into This Week, its Annual Outlook grew into the
   Profit Forecast page). What remains here is the Weekly P&L Brief Excel
   deliverable, launched from Hub ▸ Accounting (hub.js → S.Reports._openQboModal).
   It carries an export-acknowledgment gate + the shared deliverable disclaimer. */

S.Reports = {
  _openQboModal(){
    if (App.stampFixView) App.stampFixView('weekly-pnl');
    const weeks=(App.data.weeks||[]).slice().sort((a,b)=>new Date(a.period_end||0)-new Date(b.period_end||0));
    App.openHubFullPage('Weekly P&L Brief', (mount) => {
      if (App.setHubTopbarActions) App.setHubTopbarActions('');
      if(weeks.length===0){
        mount.innerHTML='<div class="screen">'
          + '<div class="card form-card">'
            + '<div class="card-title">Weekly P&amp;L Brief</div>'
            + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">No weeks confirmed yet. Confirm a week from the Profit dashboard first, and it shows here to export.</div>'
          + '</div>'
        + '</div>';
        return;
      }
      this._renderQboPicker(mount, weeks);
    }, 'weekly-pnl');
  },

  _renderQboPicker(panel, weeks){
    this._pnlAckGiven = false;   // gate once per visit

    const lastDate=weeks[weeks.length-1]?.period_end||'';
    const firstCustomDate=weeks[Math.max(0,weeks.length-13)]?.period_end||'';

    panel.innerHTML='<div class="screen">'
      + '<div class="card form-card">'
        + '<div class="card-title">Weekly P&amp;L Brief</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0;">'
          + '<div class="f" style="width:300px;"><label>Range</label>'
            + '<select id="qbo-range">'
              + '<option value="last1">Last completed week</option>'
              + '<option value="last4">Last 4 weeks</option>'
              + '<option value="last13" selected>Last 13 weeks (quarter)</option>'
              + '<option value="ytd">Year to date</option>'
              + '<option value="all">All saved weeks</option>'
              + '<option value="custom">Custom range</option>'
            + '</select>'
          + '</div>'
          + '<div class="f" id="qbo-from-f" style="width:170px;display:none;"><label>From</label><input type="date" id="qbo-from"/></div>'
          + '<div class="f" id="qbo-to-f" style="width:170px;display:none;"><label>To</label><input type="date" id="qbo-to"/></div>'
        + '</div>'
        + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:18px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
          + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop assembles these numbers from what you log. It is a software tool, not a CPA, tax preparer, or legal advisor. This is a worksheet, not your official financial statement. Your accountant should review and verify every figure before you file anything or close the books.</div>'
        + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="qbo-download">Generate File</button>'
        + '<span id="qbo-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-left:6px;display:none;"></span>'
      + '</div>'
      + this._whatsInsideCard()
    + '</div>';

    const rangeSel=document.getElementById('qbo-range');
    const fromInp=document.getElementById('qbo-from');
    const toInp=document.getElementById('qbo-to');
    const fromF=document.getElementById('qbo-from-f');
    const toF=document.getElementById('qbo-to-f');
    if(fromInp) fromInp.value=firstCustomDate;
    if(toInp) toInp.value=lastDate;

    const syncCustom=()=>{ const c=rangeSel.value==='custom'; fromF.style.display=c?'':'none'; toF.style.display=c?'':'none'; };
    rangeSel.addEventListener('change',syncCustom);
    syncCustom();

    document.getElementById('qbo-download').addEventListener('click', async () => {
      const filtered=this._filterWeeksByRange(weeks,rangeSel.value,fromInp.value,toInp.value);
      if(filtered.length===0){ this._setStatus('No weeks fall in that range.','var(--red)'); return; }
      if(typeof XLSX==='undefined'){
        await App.confirm({
          title: 'File builder not loaded',
          message: 'The Excel builder did not load. Hard refresh the page (Ctrl+Shift+R) and try again.',
          confirmText: 'OK',
          cancelText: ''
        });
        return;
      }
      // Export-acknowledgment gate (once per visit) — active notice before the
      // financial worksheet downloads. See [[legal-protection]].
      if(!this._pnlAckGiven){
        const ok = await App.confirmExport({
          title: 'Before You Export Your P&L',
          message: 'This Weekly P&L Brief is built from the numbers you have logged in Bar Cop. It is a worksheet, not a filed financial statement. Your accountant should review and verify it before you file anything or close your books.',
          confirmText: 'I Understand, Continue',
          cancelText: 'Cancel'
        });
        if(!ok) return;
        this._pnlAckGiven = true;
      }
      this._buildAndDownloadXlsx(filtered, App.todayLocal());
    });
  },

  _setStatus(msg, color){
    const el=document.getElementById('qbo-status');
    if(!el) return;
    el.textContent=msg;
    el.style.color=color||'var(--gold)';
    el.style.display='block';
  },

  _whatsInsideCard(){
    const rows=[
      ['One row per week', 'Each saved week in your range, with the week ending date and week number.'],
      ['Revenue', 'Bar revenue, food revenue, and total revenue for the week.'],
      ['COGS', 'Bar COGS, food COGS, and total cost of goods sold.'],
      ['Labor', 'Bar labor, food labor, and total labor cost.'],
      ['Prime cost', 'Total prime cost, COGS plus labor, for the week.'],
      ['Cost ratios', 'Bar pour cost %, food cost %, and prime cost % for the week.']
    ];
    const listHtml=rows.map(r=>
      '<tr><td style="padding:8px 0;font-weight:700;color:var(--t1);width:220px;vertical-align:top;font-size:12px;">'+esc(r[0])+'</td>'
      +'<td style="padding:8px 0;color:var(--t2);font-size:12px;line-height:1.6;">'+esc(r[1])+'</td></tr>'
    ).join('');
    return '<div class="card form-card">'
      +'<div class="card-title">What\'s In the File</div>'
      +'<table style="width:100%;border-collapse:collapse;"><tbody>'+listHtml+'</tbody></table>'
      +'</div>';
  },

  _filterWeeksByRange(weeks,range,customFrom,customTo){
    if(!weeks.length) return [];
    // Parse a bare YYYY-MM-DD as LOCAL midnight (not UTC), so the boundary
    // comparisons below line up with new Date(year,0,1) / the date inputs and a
    // year-edge week never slips out by a day. See the local-date convention.
    const pd=(s)=>new Date((s||'1970-01-01')+'T00:00:00');
    const sorted=weeks.slice().sort((a,b)=>pd(a.period_end)-pd(b.period_end));
    if(range==='all') return sorted;
    if(range==='last1') return sorted.slice(-1);
    if(range==='last4') return sorted.slice(-4);
    if(range==='last13') return sorted.slice(-13);
    if(range==='ytd'){
      const yearStart=new Date(new Date().getFullYear(),0,1);
      return sorted.filter(w=>{
        if(!w.period_end) return false;
        return pd(w.period_end)>=yearStart;
      });
    }
    if(range==='custom'){
      if(!customFrom||!customTo) return [];
      const from=pd(customFrom);
      const to=pd(customTo);
      return sorted.filter(w=>{
        if(!w.period_end) return false;
        const d=pd(w.period_end);
        return d>=from&&d<=to;
      });
    }
    return sorted;
  },

  // Build the XLSX in a Books-style sheet: title row, blank, header row, data
  // rows, blank, source note, disclaimer footer. Column widths set so headers
  // never clip on first open. Money + percent number formats applied.
  _buildAndDownloadXlsx(weeks, today){
    const COL_COUNT = 15;
    const COL_WIDTHS = [
      { wch: 14 }, // Week Ending
      { wch: 13 }, // Week Number
      { wch: 14 }, // Bar Revenue
      { wch: 14 }, // Food Revenue
      { wch: 16 }, // Total Revenue
      { wch: 12 }, // Bar COGS
      { wch: 12 }, // Food COGS
      { wch: 14 }, // Total COGS
      { wch: 12 }, // Bar Labor
      { wch: 12 }, // Food Labor
      { wch: 14 }, // Total Labor
      { wch: 18 }, // Total Prime Cost
      { wch: 17 }, // Bar Pour Cost %
      { wch: 14 }, // Food Cost %
      { wch: 14 }  // Prime Cost %
    ];

    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const rows = [];
    const merges = [];
    const blankRow = () => { const r=[]; for(let i=0;i<COL_COUNT;i++) r.push(''); return r; };
    const lineRow  = (text) => { const r=[text]; for(let i=1;i<COL_COUNT;i++) r.push(''); return r; };
    const mergeFull = (rowIdx) => merges.push({ s:{ r:rowIdx, c:0 }, e:{ r:rowIdx, c:COL_COUNT-1 } });

    const firstWeek = weeks[0]?.period_end || '';
    const lastWeek  = weeks[weeks.length - 1]?.period_end || '';

    // Title row (merged across full width so the bar name never gets clipped)
    rows.push(lineRow(barName + ': Weekly P&L Brief, ' + firstWeek + ' through ' + lastWeek));
    mergeFull(0);
    rows.push(blankRow());

    // Header row
    rows.push([
      'Week Ending', 'Week Number',
      'Bar Revenue', 'Food Revenue', 'Total Revenue',
      'Bar COGS',    'Food COGS',    'Total COGS',
      'Bar Labor',   'Food Labor',   'Total Labor',
      'Total Prime Cost',
      'Bar Pour Cost %', 'Food Cost %', 'Prime Cost %'
    ]);

    // Data rows
    // A weeks record stores these as percentage POINTS (22.4 means 22.4%). ConfirmWeek is
    // the only live writer and computes cogs / revenue * 100; the seed (sample-profile)
    // does the same. Excel's % cell format wants a FRACTION, so divide. Always.
    //
    // This used to hedge: `n > 1 ? n / 100 : n`, on the premise that stored values "may be
    // either 0.32 or 32 depending on source". That premise is stale, and the hedge broke
    // the real sub-1% case it could not tell apart from a fraction: $500 of bar revenue
    // against $4 of COGS is a genuine 0.8 POINTS, which is not > 1, so it passed straight
    // through and Excel printed 80.0%. A 100x error, in the sheet handed to the accountant.
    const pctOrNull = v => {
      const n = parseFloat(v);
      if (v == null || v === '' || isNaN(n)) return null;
      return n / 100;
    };

    weeks.forEach(w => {
      const bRev = parseFloat(w.bar?.revenue)  || 0;
      const fRev = parseFloat(w.food?.revenue) || 0;
      const bCog = parseFloat(w.bar?.cogs)     || 0;
      const fCog = parseFloat(w.food?.cogs)    || 0;
      const bLab = parseFloat(w.bar?.labor)    || 0;
      const fLab = parseFloat(w.food?.labor)   || 0;
      // Totals roll in catering + ancillary so they tie to the Books income statement and
      // the Prime Cost % (measured against total sales) foots. The Bar/Food columns are the
      // F&B floor breakout; catering + ancillary fold into the Total columns.
      const cRev = parseFloat(w.catering?.revenue) || 0, cCog = parseFloat(w.catering?.cogs) || 0, cLab = parseFloat(w.catering?.labor) || 0;
      const oRev = parseFloat(w.other?.revenue)    || 0, oCog = parseFloat(w.other?.cogs)    || 0;
      const tRev = bRev + fRev + cRev + oRev;
      const tCog = bCog + fCog + cCog + oCog;
      const tLab = bLab + fLab + cLab;
      const prime = tCog + tLab;
      rows.push([
        w.period_end || '',
        w.week_num != null ? Number(w.week_num) : '',
        bRev, fRev, tRev,
        bCog, fCog, tCog,
        bLab, fLab, tLab,
        prime,
        pctOrNull(w.bar?.cost_pct),
        pctOrNull(w.food?.cost_pct),
        pctOrNull(w.prime_cost_pct)
      ]);
    });

    // Footer: blank, source note (merged), then the shared disclaimer block.
    rows.push(blankRow());
    rows.push(lineRow('Source: Confirm the Week rollups. Total columns include catering + ancillary revenue (Bar/Food columns are the F&B floor breakout). Prime Cost % is measured against total sales, consistent with the Books income statement.'));
    mergeFull(rows.length - 1);
    App.deliverableFooter().disclaimerLines.forEach(line => {
      rows.push(lineRow(line));
      mergeFull(rows.length - 1);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    // Money columns 2..11 (Bar Revenue..Total Prime Cost), percent columns 12..14
    rows.forEach((row, i) => {
      for (let c = 2; c <= 11; c++) {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      }
      for (let c = 12; c <= 14; c++) {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = pctFmt;
      }
    });
    ws['!cols']   = COL_WIDTHS;
    ws['!merges'] = merges;
    ws['!rows']   = [{ hpt: 22 }]; // taller title row

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly P&L');
    wb.Props = {
      Title:       barName + ' - Weekly P&L Brief, ' + firstWeek + ' through ' + lastWeek,
      Subject:     App.deliverableFooter().workbookSubject,
      Author:      barName,
      Company:     'Bar Cop',
      CreatedDate: new Date()
    };

    const filename = App.fileSafe(barName) + ' - Weekly P&L Worksheet - ' + today + '.xlsx';
    XLSX.writeFile(wb, filename);
    try { localStorage.setItem('books_report_run_weeklypnl', new Date().toISOString()); } catch (e) {}
    this._setStatus('Downloaded ' + filename, 'var(--gold)');
  }
};
