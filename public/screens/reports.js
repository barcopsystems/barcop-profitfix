'use strict';

/* ── Profit Recovery — Reports and History ────────────────────────────────────
   The report surface on top of the weekly rollups. Two tabs (report standard):
     • Annual Outlook — projects savings at your cost targets from your average
       cost percentages (a clearly-labeled estimate, not a guarantee).
     • Weekly History — a READ-ONLY view of the weeks saved in This Week, which
       owns editing. A row opens a read-only breakdown with "Edit in This Week"
       (the single edit door, per two-doors-same-data).
   The Weekly P&L Brief XLSX (reached from Hub ▸ Accounting) also lives here; it
   carries an export-acknowledgment gate + the shared deliverable disclaimer. */

S.Reports = {
  tab: 'out',
  filterPreset: 'last-12',
  _prevPreset: 'last-12',
  filterFrom: '',
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' }, { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  weeks() { return (App.data.weeks || []); },
  targets() { return (App.data.settings.targets || {}); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  avgOf(weeks, fn) { const v = weeks.map(fn).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; },

  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';   // header off; actions live in the page
    this.renderMain();
  },

  renderMain() {
    const all = this.weeks();

    // Day-one: no weeks saved yet → guide to This Week.
    if (!all.length) {
      App.setupCard(this.container, {
        title: 'Reports and History',
        lead: 'This is where your saved weeks collect, with a savings outlook against your cost targets. Confirm and save a week in This Week and it lands here.',
        steps: [
          { title: 'Confirm a week', desc: 'Pull the week from Control, confirm the grid, and save it in This Week.', btn: 'Open This Week', screen: 'this-week', done: false },
          { title: 'Set your targets', desc: 'Your bar, food, and prime cost targets drive the savings outlook.', btn: 'App Settings', screen: 'settings', done: false }
        ]
      });
      this.container.onclick = ev => { const go = ev.target.closest('.setup-go'); if (go && go.dataset.go) App.openScreen(go.dataset.go); };
      return;
    }

    const tabBar = '<div class="ch-tabs" style="margin-bottom:18px;">'
      + '<button class="ch-tab' + (this.tab === 'out' ? ' on' : '') + '" data-tab="out">Annual Outlook</button>'
      + '<button class="ch-tab' + (this.tab === 'hist' ? ' on' : '') + '" data-tab="hist">Weekly History</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + tabBar + (this.tab === 'out' ? this.panelOutlook() : this.panelHistory()) + '</div>';

    this.container.querySelectorAll('.ch-tab').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.renderMain(); }));
    if (this.tab === 'out') this.wireOutlook(); else this.wireHistory();
  },

  // ── Annual Outlook tab ──────────────────────────────────────────────────────
  panelOutlook() {
    const all = this.weeks();
    const t = this.targets();
    const bT = t.bar_pour_cost_pct ?? 22, fT = t.food_cost_pct ?? 32, pT = t.prime_cost_pct ?? 60;
    const avgB = this.avgOf(all, w => w.bar?.cost_pct), avgF = this.avgOf(all, w => w.food?.cost_pct), avgP = this.avgOf(all, w => w.prime_cost_pct);

    const savedBar = App.data.settings.annual_bar_revenue || 0, savedFood = App.data.settings.annual_food_revenue || 0;
    const annBar = savedBar || this.avgOf(all, w => w.bar?.revenue) * 52 || 0;
    const annFood = savedFood || this.avgOf(all, w => w.food?.revenue) * 52 || 0;
    const annTot = annBar + annFood;

    const cur = (pct, rev) => (pct / 100) * rev;
    const barCur = cur(avgB, annBar), barTgt = cur(bT, annBar), barSave = barCur - barTgt;
    const foodCur = cur(avgF, annFood), foodTgt = cur(fT, annFood), foodSave = foodCur - foodTgt;
    const primeCur = cur(avgP, annTot), primeTgt = cur(pT, annTot), primeSave = primeCur - primeTgt;

    // ── Stat strip (whole dollars — this is a projection) ──
    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const heroVal = (primeSave > 0 ? '+' : '') + App.fmtCurrency(primeSave, 0);
    const heroCls = primeSave > 0 ? '' : 'good';
    const heroStyle = primeSave > 0 ? ' style="color:var(--gold);"' : '';
    const statStrip = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Projected Annual Sales', App.fmtCurrency(annTot, 0))
      + stat('Prime Cost (Current)', App.fmtCurrency(primeCur, 0))
      + stat('Prime Cost (At Target)', App.fmtCurrency(primeTgt, 0))
      + '<div class="calc-item"><div class="calc-label">Savings Potential</div><div class="calc-val lg ' + heroCls + '"' + heroStyle + '>' + heroVal + '</div></div>'
      + '</div></div>';

    // ── Annual Sales inputs (Recalculate commits to settings) ──
    const salesInput = (id, label, val) =>
      '<div class="f" style="width:200px;flex-shrink:0;"><label>' + label + '</label><div class="fw"><span class="pre">$</span>'
      + '<input class="pre" type="number" id="' + id + '" value="' + Math.round(val) + '" placeholder="Enter annual sales"/></div></div>';
    const salesCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Annual Sales</div>'
      + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;">'
      + salesInput('rc-bar-rev', 'Annual Bar Sales', annBar)
      + salesInput('rc-food-rev', 'Annual Food Sales', annFood)
      + '<div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost" id="rc-recalc">Recalculate</button></div>'
      + '</div></div>';

    // ── Savings at Your Targets (no total row — Bar/Food/Prime overlap) ──
    const sRow = (area, avg, tgt, curD, tgtD, save) =>
      '<tr><td><div class="val">' + area + '</div></td>'
      + '<td class="' + (avg > tgt ? 'neg' : 'pos') + '">' + App.fmtPct(avg) + '</td>'
      + '<td>' + tgt + '%</td>'
      + '<td>' + App.fmtCurrency(curD, 0) + '</td>'
      + '<td>' + App.fmtCurrency(tgtD, 0) + '</td>'
      + '<td class="' + (save > 0 ? 'neg' : 'pos') + '">' + (save > 0 ? '+' : '') + App.fmtCurrency(save, 0) + '</td></tr>';
    const savingsCard = '<div class="sh" style="margin:4px 0 10px;">Savings at Your Targets</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl" style="table-layout:fixed;width:100%;min-width:560px;">'
      + '<colgroup><col style="width:18%"/><col style="width:15%"/><col style="width:13%"/><col style="width:19%"/><col style="width:17%"/><col style="width:18%"/></colgroup>'
      + '<thead><tr><th>Area</th><th>Current Cost %</th><th>Target %</th><th>Current Annual Cost</th><th>At Target</th><th>Savings Potential</th></tr></thead>'
      + '<tbody>'
      + sRow('Bar', avgB, bT, barCur, barTgt, barSave)
      + sRow('Food', avgF, fT, foodCur, foodTgt, foodSave)
      + sRow('Prime Cost', avgP, pT, primeCur, primeTgt, primeSave)
      + '</tbody></table></div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;line-height:1.5;">Estimate projected from your ' + all.length + '-week average cost percentages. Not a guarantee or financial advice.</div>';

    return statStrip + salesCard + savingsCard;
  },

  wireOutlook() {
    document.getElementById('rc-recalc')?.addEventListener('click', async () => {
      const bar = parseFloat(document.getElementById('rc-bar-rev')?.value) || 0;
      const food = parseFloat(document.getElementById('rc-food-rev')?.value) || 0;
      App.data.settings.annual_bar_revenue = bar;
      App.data.settings.annual_food_revenue = food;
      await App.saveKey('settings');
      this.renderMain();
    });
  },

  // ── Weekly History tab ──────────────────────────────────────────────────────
  panelHistory() {
    const t = this.targets();
    const bT = t.bar_pour_cost_pct ?? 22, fT = t.food_cost_pct ?? 32, pT = t.prime_cost_pct ?? 60;
    const { from, to } = this.effectiveRange();
    const weeks = this.weeks().filter(w => w.period_end)
      .filter(w => (!from || w.period_end >= from) && (!to || w.period_end <= to))
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''));

    const avgP = this.avgOf(weeks, w => w.prime_cost_pct);
    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Weeks Logged', String(weeks.length))
      + stat('Avg Prime %', weeks.length ? App.fmtPct(avgP) : '-', avgP > pT ? 'warn' : '')
      + stat('Avg Bar Cost %', weeks.length ? App.fmtPct(this.avgOf(weeks, w => w.bar?.cost_pct)) : '-')
      + stat('Avg Food Cost %', weeks.length ? App.fmtPct(this.avgOf(weeks, w => w.food?.cost_pct)) : '-')
      + '</div></div>';

    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'pr-range-chip');
    const filterRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="pr-export">Export PDF</button></div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input class="form-input" type="date" id="pr-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input class="form-input" type="date" id="pr-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';

    const rows = weeks.map(w => {
      const barGap = ((w.bar?.cost_pct - bT) / 100) * (w.bar?.revenue || 0);
      const foodGap = ((w.food?.cost_pct - fT) / 100) * (w.food?.revenue || 0);
      const costGap = (isFinite(barGap) ? barGap : 0) + (isFinite(foodGap) ? foodGap : 0);
      const gapStr = (costGap > 0 ? '+' : costGap < 0 ? '-' : '') + App.fmtCurrency(Math.abs(costGap));
      return '<tr class="pr-row" data-id="' + w.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(w.period_end) + '</div></td>'
        + '<td>Week ' + (w.week_num != null ? w.week_num : '-') + '</td>'
        + '<td>' + App.fmtCurrency(w.bar?.revenue || 0) + '</td>'
        + '<td class="' + (w.bar?.cost_pct > bT ? 'neg' : 'pos') + '">' + App.fmtPct(w.bar?.cost_pct) + '</td>'
        + '<td>' + App.fmtCurrency(w.food?.revenue || 0) + '</td>'
        + '<td class="' + (w.food?.cost_pct > fT ? 'neg' : 'pos') + '">' + App.fmtPct(w.food?.cost_pct) + '</td>'
        + '<td class="' + (w.prime_cost_pct > pT ? 'neg' : 'pos') + '">' + App.fmtPct(w.prime_cost_pct) + '</td>'
        + '<td class="' + (costGap > 0 ? 'neg' : costGap < 0 ? 'pos' : '') + '">' + gapStr + '</td>'
        + '<td style="text-align:right;"><button class="btn btn-ghost btn-sm pr-view" data-id="' + w.id + '">View</button></td></tr>';
    }).join('') || '<tr><td colspan="9" style="color:var(--t3);padding:12px 8px;">No weeks in this range. Pick a wider range above.</td></tr>';
    const histCard = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl" style="table-layout:fixed;width:100%;min-width:700px;">'
      + '<colgroup><col style="width:12%"/><col style="width:8%"/><col style="width:13%"/><col style="width:11%"/><col style="width:13%"/><col style="width:11%"/><col style="width:9%"/><col style="width:14%"/><col style="width:9%"/></colgroup>'
      + '<thead><tr><th>Period End</th><th>Week</th><th>Bar Sales</th><th>Bar Cost %</th><th>Food Sales</th><th>Food Cost %</th><th>Prime %</th><th>Cost vs Target $</th><th></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div></div>';

    return statStrip + filterRow + custom + histCard + '<div id="pr-week-detail"></div>';
  },

  wireHistory() {
    this.container.querySelectorAll('.pr-range-chip').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (v === 'custom') {
        if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-12'; this.filterFrom = ''; this.filterTo = ''; }
        else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
      } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
      this.renderMain();
    }));
    document.getElementById('pr-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderMain(); });
    document.getElementById('pr-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.renderMain(); });
    document.getElementById('pr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Weekly History', root: this.container }));
    this.container.querySelectorAll('.pr-row').forEach(r => r.addEventListener('click', () => this.showWeekDetail(r.dataset.id)));
    this.container.querySelectorAll('.pr-view').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); this.showWeekDetail(b.dataset.id); }));
  },

  showWeekDetail(id) {
    const w = this.weeks().find(x => x.id === id);
    const det = document.getElementById('pr-week-detail');
    if (!w || !det) return;
    const t = this.targets();
    const bT = t.bar_pour_cost_pct ?? 22, fT = t.food_cost_pct ?? 32, pT = t.prime_cost_pct ?? 60;
    const tRev = (w.bar?.revenue || 0) + (w.food?.revenue || 0);
    const kv = (label, val, opts) => {
      const o = opts || {};
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--row-div);">'
        + '<span style="color:var(--t2);' + (o.bold ? 'font-weight:600;' : '') + '">' + label + '</span>'
        + '<span class="val' + (o.cls ? ' ' + o.cls : '') + '"' + (o.bold ? ' style="font-weight:600;"' : '') + '>' + val + '</span></div>';
    };
    det.innerHTML = '<div class="sh" style="margin:22px 0 10px;">Week ' + (w.week_num != null ? w.week_num : '-') + ' - ' + esc(w.period_end || '') + '</div>'
      + '<div class="card" style="padding:4px 18px;">'
      + kv('Bar Sales', App.fmtCurrency(w.bar?.revenue || 0))
      + kv('Bar Cost %', App.fmtPct(w.bar?.cost_pct), { cls: w.bar?.cost_pct > bT ? 'neg' : 'pos' })
      + kv('Food Sales', App.fmtCurrency(w.food?.revenue || 0))
      + kv('Food Cost %', App.fmtPct(w.food?.cost_pct), { cls: w.food?.cost_pct > fT ? 'neg' : 'pos' })
      + kv('Total Sales', App.fmtCurrency(tRev), { bold: true })
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;"><span style="color:var(--t2);font-weight:600;">Prime Cost %</span><span class="val ' + (w.prime_cost_pct > pT ? 'neg' : 'pos') + '" style="font-weight:600;">' + App.fmtPct(w.prime_cost_pct) + '</span></div>'
      + '</div>'
      + (w.notes ? '<div style="font-size:12px;color:var(--t2);margin-top:10px;">Notes: ' + esc(w.notes) + '</div>' : '')
      + '<div style="display:flex;gap:8px;margin-top:14px;"><button class="btn btn-ghost btn-sm" id="pr-edit-week">Edit in This Week</button><button class="btn btn-ghost btn-sm" id="pr-close-week">Close</button></div>';
    document.getElementById('pr-edit-week')?.addEventListener('click', () => { S.ThisWeek._focusWeekId = id; App.navigate('this-week'); });
    document.getElementById('pr-close-week')?.addEventListener('click', () => { det.innerHTML = ''; });
    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  showHowTo() {
    App.showHelpModal('How Reports and History Works', [
      { p: ['The report surface that sits on top of your weekly numbers. Two tabs: an Annual Outlook that projects what tightening to your targets is worth, and a read-only Weekly History of every week you have saved.'] },
      { h: 'Annual Outlook', p: ['Enter your annual bar and food sales, or let Bar Cop project them from your weekly average, and it shows your current annual cost, the cost at your targets, and the savings potential. It uses your average cost percentages, so it is an estimate to aim at, not a promise. The three areas are not added together because they overlap (prime cost already includes bar and food).'] },
      { h: 'Weekly History', p: ['Every week saved in This Week lands here, newest first. The range chips pull a stretch of weeks and the numbers up top reflect the range. A row opens a read-only breakdown of that week.'] },
      { h: 'Editing a Week', p: ['Editing happens in one place, This Week, so the numbers never drift between two screens. Open a week here and tap Edit in This Week to load it into the confirm grid and correct it.'] },
      { h: 'Export', p: ['Export PDF saves the weekly history for your records or your bookkeeper. The full Weekly P&L Brief Excel file lives under Hub, Accounting.'] }
    ]);
  },

  // ─────────────────────────────────────────────────────────────────────
  // Weekly P&L Brief (reached from Hub ▸ Accounting). A wide-format weekly
  // P&L XLSX for the operator's bookkeeper. Carries an export-acknowledgment
  // gate + the shared deliverable disclaimer.
  // ─────────────────────────────────────────────────────────────────────
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
