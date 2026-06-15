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
          + '<div class="card">'
            + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">No weeks saved yet. Save at least one week from Profit > This Week before exporting.</div>'
          + '</div>'
        + '</div>';
        return;
      }
      this._renderQboPicker(mount, weeks);
    }, 'weekly-pnl');
  },

  _renderQboPicker(panel, weeks){
    this._pnlAckGiven = false;   // gate once per visit
    panel.innerHTML='<div class="screen">'
      + '<div class="card" style="margin-bottom:18px;">'
        +'<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">Weekly P&amp;L Range</div>'
        +'<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:18px;">Weekly revenue, COGS, and labor as an Excel file. Hand it to your bookkeeper or open in QuickBooks, Xero, or any spreadsheet software.</div>'
        +'<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;">'
          +'<div class="f" style="width:240px;"><label>Range</label>'
            +'<select id="qbo-range">'
              +'<option value="last1">Last completed week</option>'
              +'<option value="last4">Last 4 weeks</option>'
              +'<option value="last13" selected>Last 13 weeks (quarter)</option>'
              +'<option value="ytd">Year to date</option>'
              +'<option value="all">All saved weeks</option>'
              +'<option value="custom">Custom range</option>'
            +'</select>'
          +'</div>'
          +'<div style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="qbo-download">Download File</button></div>'
        +'</div>'
        +'<div id="qbo-custom" style="display:none;gap:12px;margin-top:14px;">'
          +'<div class="f" style="flex:1;max-width:200px;"><label>From</label><input type="date" id="qbo-from"/></div>'
          +'<div class="f" style="flex:1;max-width:200px;"><label>To</label><input type="date" id="qbo-to"/></div>'
        +'</div>'
        +'<div id="qbo-preview" style="font-size:11px;color:var(--t2);margin-top:14px;padding:10px 12px;background:var(--bg);border:1px solid var(--b2);border-radius:4px;line-height:1.5;"></div>'
        +'<div id="qbo-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:14px;display:none;"></div>'
        +'<div style="border:1px solid var(--amber);border-radius:6px;padding:12px 14px;margin-top:14px;">'
          +'<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Before you file</div>'
          +'<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop pulls these numbers from what you have logged. It is a software tool, not a CPA or tax preparer. Your accountant should review and verify before filing anything or closing the books.</div>'
        +'</div>'
      +'</div>'
    +'</div>';

    const rangeSel=document.getElementById('qbo-range');
    const customRow=document.getElementById('qbo-custom');
    const fromInp=document.getElementById('qbo-from');
    const toInp=document.getElementById('qbo-to');
    const dlBtn=document.getElementById('qbo-download');

    const lastDate=weeks[weeks.length-1]?.period_end||'';
    const firstCustomDate=weeks[Math.max(0,weeks.length-13)]?.period_end||'';
    if(fromInp) fromInp.value=firstCustomDate;
    if(toInp) toInp.value=lastDate;

    const updatePreview=()=>{
      const range=rangeSel.value;
      customRow.style.display=(range==='custom')?'flex':'none';
      const filtered=this._filterWeeksByRange(weeks,range,fromInp.value,toInp.value);
      const previewEl=document.getElementById('qbo-preview');
      if(filtered.length===0){
        previewEl.innerHTML='<span style="color:var(--warn);">No weeks fall in that range.</span>';
        dlBtn.disabled=true;
        dlBtn.style.opacity='0.5';
        dlBtn.style.cursor='not-allowed';
      } else {
        const first=filtered[0].period_end||'(no date)';
        const last=filtered[filtered.length-1].period_end||'(no date)';
        previewEl.innerHTML=filtered.length+' week'+(filtered.length===1?'':'s')+' will export. '+esc(first)+' through '+esc(last)+'.';
        dlBtn.disabled=false;
        dlBtn.style.opacity='';
        dlBtn.style.cursor='';
      }
    };
    rangeSel.addEventListener('change',updatePreview);
    fromInp.addEventListener('change',updatePreview);
    toInp.addEventListener('change',updatePreview);
    updatePreview();

    dlBtn.addEventListener('click', async () => {
      const range=rangeSel.value;
      const filtered=this._filterWeeksByRange(weeks,range,fromInp.value,toInp.value);
      if(filtered.length===0) return;
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
        const ok = await App.confirm({
          title: 'Before You Export Your P&L',
          message: 'This Weekly P&L Brief is built from the numbers you have logged in Bar Cop. It is a worksheet, not a filed financial statement. Your accountant should review and verify it before you file anything or close your books.',
          confirmText: 'I Understand, Continue',
          cancelText: 'Cancel'
        });
        if(!ok) return;
        this._pnlAckGiven = true;
      }
      const today=App.todayLocal();
      this._buildAndDownloadXlsx(filtered, today);
    });
  },

  _filterWeeksByRange(weeks,range,customFrom,customTo){
    if(!weeks.length) return [];
    const sorted=weeks.slice().sort((a,b)=>new Date(a.period_end||0)-new Date(b.period_end||0));
    if(range==='all') return sorted;
    if(range==='last1') return sorted.slice(-1);
    if(range==='last4') return sorted.slice(-4);
    if(range==='last13') return sorted.slice(-13);
    if(range==='ytd'){
      const yearStart=new Date(new Date().getFullYear(),0,1);
      return sorted.filter(w=>{
        if(!w.period_end) return false;
        return new Date(w.period_end)>=yearStart;
      });
    }
    if(range==='custom'){
      if(!customFrom||!customTo) return [];
      const from=new Date(customFrom);
      const to=new Date(customTo);
      return sorted.filter(w=>{
        if(!w.period_end) return false;
        const d=new Date(w.period_end);
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
    const pctOrNull = v => {
      const n = parseFloat(v);
      if (v == null || v === '' || isNaN(n)) return null;
      // Stored values may be either 0.32 or 32 depending on source — both seen
      // in weeks records. Treat any value > 1 as a percentage point figure and
      // divide so Excel's % format renders correctly.
      return n > 1 ? n / 100 : n;
    };

    weeks.forEach(w => {
      const bRev = parseFloat(w.bar?.revenue)  || 0;
      const fRev = parseFloat(w.food?.revenue) || 0;
      const bCog = parseFloat(w.bar?.cogs)     || 0;
      const fCog = parseFloat(w.food?.cogs)    || 0;
      const bLab = parseFloat(w.bar?.labor)    || 0;
      const fLab = parseFloat(w.food?.labor)   || 0;
      const tRev = bRev + fRev;
      const tCog = bCog + fCog;
      const tLab = bLab + fLab;
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
    rows.push(lineRow('Source: Profit > This Week weekly rollups. Revenue from Shift Control. COGS from Inventory Control. Labor from Labor Control.'));
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

    const filename = barName + ' - Weekly P&L Brief - ' + today + '.xlsx';
    XLSX.writeFile(wb, filename);
    const statusEl = document.getElementById('qbo-status');
    if (statusEl) {
      statusEl.textContent = 'Downloaded ' + filename;
      statusEl.style.color = 'var(--gold)';
      statusEl.style.display = 'block';
    }
  }
};
