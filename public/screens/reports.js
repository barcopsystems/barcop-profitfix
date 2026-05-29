'use strict';
S.Reports={
  render(container,actions){
    this.container=container;this.actions=actions;this.renderMain();
  },
  renderMain(){
    if(this.actions){
      this.actions.innerHTML='<button class="btn btn-ghost btn-sm" id="pr-export">Export PDF</button>';
      document.getElementById('pr-export')?.addEventListener('click',()=>window.print());
    }
    const weeks=(App.data.weeks||[]).slice().reverse();
    const t=App.data.settings.targets||{};
    const allW=App.data.weeks||[];
    const avg=fn=>{const v=allW.map(fn).filter(x=>x!=null&&!isNaN(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;};
    const avgB=avg(w=>w.bar?.cost_pct);const avgF=avg(w=>w.food?.cost_pct);const avgP=avg(w=>w.prime_cost_pct);

    // Use saved values or fall back to weekly average * 52
    const savedBarRev  = App.data.settings.annual_bar_revenue  || 0;
    const savedFoodRev = App.data.settings.annual_food_revenue || 0;
    const calcBarRev   = avg(w=>w.bar?.revenue)*52;
    const calcFoodRev  = avg(w=>w.food?.revenue)*52;
    const annBarRev    = savedBarRev  || calcBarRev  || 0;
    const annFoodRev   = savedFoodRev || calcFoodRev || 0;

    const histRows=weeks.length===0?'<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--t4);">No weeks saved yet.</td></tr>'
      :weeks.map(w=>{
        const tRev=(w.bar?.revenue||0)+(w.food?.revenue||0);
        const bT=t.bar_pour_cost_pct??22,fT=t.food_cost_pct??32,pT=t.prime_cost_pct??60;
        // Cost vs Target $: how many real dollars this week ran over (or under)
        // the bar and food cost targets combined. Always computable from data
        // every saved week carries, sample or operator-entered.
        const barGap  = ((w.bar?.cost_pct  - bT)/100) * (w.bar?.revenue  || 0);
        const foodGap = ((w.food?.cost_pct - fT)/100) * (w.food?.revenue || 0);
        const costGap = (isFinite(barGap)?barGap:0) + (isFinite(foodGap)?foodGap:0);
        const gapStr  = (costGap > 0 ? '+' : costGap < 0 ? '-' : '') + App.fmtCurrency(Math.abs(costGap));
        return '<tr style="cursor:pointer;" onclick="S.Reports.viewWeek(\''+w.id+'\')"><td>'+esc(w.period_end||'')+'</td><td class="val">Week '+w.week_num+'</td>'
          +'<td>'+App.fmtCurrency(w.bar?.revenue)+'</td>'
          +'<td class="'+(w.bar?.cost_pct>bT?'neg':'pos')+'">'+App.fmtPct(w.bar?.cost_pct)+'</td>'
          +'<td>'+App.fmtCurrency(w.food?.revenue)+'</td>'
          +'<td class="'+(w.food?.cost_pct>fT?'neg':'pos')+'">'+App.fmtPct(w.food?.cost_pct)+'</td>'
          +'<td class="'+(w.prime_cost_pct>pT?'neg':'pos')+'">'+App.fmtPct(w.prime_cost_pct)+'</td>'
          +'<td class="'+(costGap>0?'neg':costGap<0?'pos':'')+'">'+gapStr+'</td></tr>';
      }).join('');

    const calcBlock=(label,revId,rev,costPct,target)=>{
      const cur=(costPct/100)*rev,tgt=(target/100)*rev,savings=cur-tgt;
      const isPrime = revId === null;
      const revInput = isPrime
        ? '<div class="f" style="width:200px;flex-shrink:0;"><label>Annual Total Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rc-prime-rev" value="'+Math.round(rev)+'" readonly style="opacity:0.6;"/></div></div>'
        : '<div class="f" style="width:200px;flex-shrink:0;"><label>Annual Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="'+revId+'" value="'+Math.round(rev)+'" placeholder="Enter annual revenue"/></div></div>';
      return '<div class="card" style="margin-bottom:12px;"><div class="card-title">'+label+'</div>'
        +'<div class="form-row" style="gap:16px;">'
        +revInput
        +'<div class="f" style="width:140px;flex-shrink:0;"><label>Current Cost %</label><div class="fw"><input class="suf" type="number" value="'+costPct.toFixed(1)+'" readonly style="opacity:0.6;"/><span class="suf">%</span></div></div>'
        +'<div class="f" style="width:140px;flex-shrink:0;"><label>Target Cost %</label><div class="fw"><input class="suf" type="number" value="'+target+'" readonly style="opacity:0.6;"/><span class="suf">%</span></div></div>'
        +(isPrime ? '' : '<div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost rc-recalc" data-id="'+revId+'">Recalculate</button></div>')
        +'</div>'
        +'<div class="calc" id="calc-results-'+label.replace(/\s/g,'-').toLowerCase()+'">'
        +'<div class="calc-item"><div class="calc-label">Current Annual Cost</div><div class="calc-val">'+App.fmtCurrency(cur)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Cost at Target</div><div class="calc-val good">'+App.fmtCurrency(tgt)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Annual Savings Potential</div><div class="calc-val '+(savings>0?'warn':'good')+'">'+App.fmtCurrency(savings)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Monthly Gap</div><div class="calc-val '+(savings>0?'warn':'good')+'">'+App.fmtCurrency(savings/12)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Weekly Gap</div><div class="calc-val '+(savings>0?'warn':'good')+'">'+App.fmtCurrency(savings/52)+'</div></div>'
        +'</div></div>';
    };

    this.container.innerHTML='<div class="screen">'
      +'<div class="sh">Annual Calculator</div>'
      +'<div style="font-size:12px;color:var(--t3);margin-bottom:14px;margin-top:-4px;">Enter your annual bar and food revenue below. The calculator uses your average cost percentages from weekly history to show savings potential at your targets.</div>'
      +calcBlock('Bar','rc-bar-rev',annBarRev,avgB,t.bar_pour_cost_pct??22)
      +calcBlock('Food','rc-food-rev',annFoodRev,avgF,t.food_cost_pct??32)
      +calcBlock('Prime Cost',null,annBarRev+annFoodRev,avgP,t.prime_cost_pct??60)
      +'<div class="sh" style="margin-top:24px;">Weekly History</div>'
      +'<div class="tbl-wrap" style="overflow-x:auto;margin-bottom:24px;"><table class="tbl"><thead><tr>'
      +'<th>Period End</th><th>Week</th><th>Bar Rev</th><th>Bar Cost %</th><th>Food Rev</th><th>Food Cost %</th><th>Prime %</th><th>Cost vs Tgt $</th>'
      +'</tr></thead><tbody>'+histRows+'</tbody></table></div>'
      +'<div id="week-detail"></div>'
      +'</div>';

    // Recalculate buttons
    this.container.querySelectorAll('.rc-recalc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id  = btn.dataset.id;
        const inp = document.getElementById(id);
        if (!inp) return;
        const val = parseFloat(inp.value) || 0;
        if (id === 'rc-bar-rev') {
          App.data.settings.annual_bar_revenue = val;
        } else {
          App.data.settings.annual_food_revenue = val;
        }
        await App.saveKey('settings');
        this.renderMain();
      });
    });
  },
  // ─────────────────────────────────────────────────────────────────────
  // Export to QuickBooks — Phase 3 Item 30.
  // Drops a wide-format weekly P&L CSV (revenue, COGS, labor with bar+food
  // splits, plus prime cost and percentages) for the operator's bookkeeper.
  // Not a direct QBO API integration. CSV is the universal handoff and works
  // with QuickBooks, Xero, or any spreadsheet.
  // ─────────────────────────────────────────────────────────────────────

  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "WEEKLY P&L BRIEF | Back to Dashboard".
  _openQboModal(){
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
      const today=new Date().toISOString().slice(0,10);
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
    const numOrNull = v => {
      const n = parseFloat(v);
      return (v == null || v === '' || isNaN(n)) ? null : n;
    };
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
    // Reads from App.deliverableFooter() so all Bar Cop deliverables stay in
    // lockstep on legal language.
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
      Title:       barName + ' Weekly P&L Brief',
      Subject:     App.deliverableFooter().workbookSubject,
      Author:      barName,
      Company:     'Bar Cop',
      CreatedDate: new Date()
    };

    const filename = barName + ' - Weekly P&L Brief - ' + today + '.xlsx';
    XLSX.writeFile(wb, filename);
  },

  viewWeek(id){
    const w=(App.data.weeks||[]).find(w=>w.id===id);if(!w)return;
    const det=document.getElementById('week-detail');if(!det)return;
    const t=App.data.settings.targets||{};
    const bT=t.bar_pour_cost_pct??22,fT=t.food_cost_pct??32,pT=t.prime_cost_pct??60;
    const tRev=(w.bar?.revenue||0)+(w.food?.revenue||0);
    det.innerHTML='<div class="divider"></div>'
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">'
      +'<div class="sh" style="margin-bottom:0;">Week '+w.week_num+' - '+(w.period_end||'')+'</div>'
      +'<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'week-detail\').innerHTML=\'\'">Close</button>'
      +'</div>'
      +'<div class="card"><div class="tbl-wrap"><table class="sum-tbl"><thead><tr><th></th><th>Amount</th></tr></thead><tbody>'
      +'<tr><td>Bar Revenue</td><td class="val">'+App.fmtCurrency(w.bar?.revenue)+'</td></tr>'
      +'<tr><td>Bar COGS</td><td>'+App.fmtCurrency(w.bar?.cogs)+'</td></tr>'
      +'<tr><td>Bar Labor</td><td>'+App.fmtCurrency(w.bar?.labor)+'</td></tr>'
      +'<tr><td>Bar Pour Cost %</td><td class="val '+(w.bar?.cost_pct>bT?'neg':'pos')+'">'+App.fmtPct(w.bar?.cost_pct)+'</td></tr>'
      +'<tr><td>Food Revenue</td><td class="val">'+App.fmtCurrency(w.food?.revenue)+'</td></tr>'
      +'<tr><td>Food Cost %</td><td class="val '+(w.food?.cost_pct>fT?'neg':'pos')+'">'+App.fmtPct(w.food?.cost_pct)+'</td></tr>'
      +'<tr class="total"><td>Total Revenue</td><td class="val">'+App.fmtCurrency(tRev)+'</td></tr>'
      +'<tr class="total"><td>Prime Cost %</td><td class="val '+(w.prime_cost_pct>pT?'neg':'pos')+'">'+App.fmtPct(w.prime_cost_pct)+'</td></tr>'
      +'</tbody></table></div>'
      +(w.notes?'<div style="margin-top:12px;font-size:12px;color:var(--t2);">Notes: '+esc(w.notes)+'</div>':'')
      +'</div>';
    det.scrollIntoView({behavior:'smooth'});
  }
};
