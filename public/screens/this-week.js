'use strict';
S.ThisWeek = {
  step:1, draft:null,

  render(container, actions) {
    this.container=container;
    if(!this.draft)this.draft=this.loadDraft();
    this.renderStep(this.step);
  },

  loadDraft(){
    try{const r=localStorage.getItem('pf_draft');if(r){const d=JSON.parse(r);this.step=d._step||1;return d;}}catch(e){}
    return{_step:1,week_num:App.nextWeekNum(),period_end:App.nextSunday(),bar:{revenue:'',cogs:'',labor:''},food:{revenue:'',cogs:'',labor:''},bar_count:[],bar_variance:[],food_count:[],notes:''};
  },
  saveDraft(){this.draft._step=this.step;localStorage.setItem('pf_draft',JSON.stringify(this.draft));},
  clearDraft(){localStorage.removeItem('pf_draft');this.draft=null;this.step=1;},

  renderStep(step){
    this.step=step;this.saveDraft();
    document.getElementById('topbar-sub').textContent='Step '+step+' of 7';
    this.container.innerHTML='<div class="screen">'+this.stepsHtml()+this.getStepHtml(step)+'</div>';
    this.wireStep(step);
  },

  stepsHtml(){
    let h='<div class="steps">';
    for(let i=1;i<=7;i++){
      const cls=i<this.step?'done':i===this.step?'active':'';
      h+=(i>1?'<div class="step-line'+(i-1<this.step?' done':'')+'"></div>':'')+
         '<div class="step-dot '+cls+'">'+(i<this.step?'✓':i)+'</div>';
    }
    return h+'</div>';
  },

  getStepHtml(s){
    switch(s){
      case 1: return this.step1();
      case 2: return this.step2();
      case 3: return this.step3();
      case 4: return this.step4();
      case 5: return this.step5();
      case 6: return this.step6();
      case 7: return this.step7();
      default: return '';
    }
  },

  nav(showPrev,showNext){
    return '<div class="card-actions">'
      +(showPrev?'<button class="btn btn-ghost" id="tw-prev">← Back</button>':'')
      +(showNext&&this.step<7?'<button class="btn btn-primary" id="tw-next">Next →</button>':'')
      +'</div>';
  },

  step1(){
    return '<div class="card"><div class="card-title">Period Details</div>'
      +'<div class="form-row">'
      +'<div class="f" style="width:100px;"><label>Week #</label><input type="number" id="tw-wk" value="'+this.draft.week_num+'" min="1" /></div>'
      +'<div class="f" style="width:160px;"><label>Period End Date</label><input type="date" id="tw-end" value="'+this.draft.period_end+'" /></div>'
      +'</div>'+this.nav(false,true)+'</div>';
  },

  step2(){
    const b=this.draft.bar,target=App.data.settings.targets?.bar_pour_cost_pct??22;
    return '<div class="card"><div class="card-title">Bar Revenue & Cost</div>'
      +'<div class="form-row">'
      +'<div class="f w-md"><label>Bar Revenue '+tt('bar-revenue')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-br" value="'+b.revenue+'" oninput="S.ThisWeek.calcBar()" /></div></div>'
      +'<div class="f w-md"><label>Bar COGS '+tt('bar-cogs')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-bc" value="'+b.cogs+'" oninput="S.ThisWeek.calcBar()" /></div></div>'
      +'<div class="f w-md"><label>Bar Labor '+tt('bar-labor')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-bl" value="'+b.labor+'" oninput="S.ThisWeek.calcBar()" /></div></div>'
      +'</div>'
      +'<div class="calc">'
      +'<div class="calc-item"><div class="calc-label">Bar Pour Cost %</div><div class="calc-val" id="tw-bpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Bar Labor %</div><div class="calc-val" id="tw-blpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">'+target+'%</div></div>'
      +'<div class="calc-item"><div class="calc-label">vs Target %</div><div class="calc-val" id="tw-bvpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">vs Target $</div><div class="calc-val" id="tw-bvdol">—</div></div>'
      +'</div>'+this.nav(true,true)+'</div>';
  },

  calcBar(){
    const rev=parseFloat(document.getElementById('tw-br')?.value)||0;
    const cogs=parseFloat(document.getElementById('tw-bc')?.value)||0;
    const labor=parseFloat(document.getElementById('tw-bl')?.value)||0;
    const target=App.data.settings.targets?.bar_pour_cost_pct??22;
    const pct=rev>0?(cogs/rev*100):null;
    const labPct=rev>0?(labor/rev*100):null;
    const vp=pct!=null?pct-target:null;
    const vd=pct!=null?((pct-target)/100)*rev:null;
    if(pct!=null&&cogs>rev){const el=document.getElementById('tw-bpct');if(el){el.textContent='COGS > Revenue — check numbers';el.className='calc-val warn';return;}}
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val;el.className='calc-val'+(cls?' '+cls:'');};
    set('tw-bpct',pct!=null?App.fmtPct(pct):'—',pct!=null?(pct>target?'warn':'good'):'');
    set('tw-blpct',labPct!=null?App.fmtPct(labPct):'—');
    set('tw-bvpct',vp!=null?(vp>0?'+':'')+App.fmtPct(vp):'—',vp!=null?(vp>0?'warn':'good'):'');
    set('tw-bvdol',vd!=null?(vd>0?'+':'')+App.fmtCurrency(vd):'—',vd!=null?(vd>0?'warn':'good'):'');
  },

  step3(){
    const f=this.draft.food,target=App.data.settings.targets?.food_cost_pct??32;
    return '<div class="card"><div class="card-title">Food Revenue & Cost</div>'
      +'<div class="form-row">'
      +'<div class="f w-md"><label>Food Revenue '+tt('bar-revenue')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-fr" value="'+f.revenue+'" oninput="S.ThisWeek.calcFood()" /></div></div>'
      +'<div class="f w-md"><label>Food COGS '+tt('bar-cogs')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-fc" value="'+f.cogs+'" oninput="S.ThisWeek.calcFood()" /></div></div>'
      +'<div class="f w-md"><label>Food Labor '+tt('bar-labor')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-fl" value="'+f.labor+'" oninput="S.ThisWeek.calcFood()" /></div></div>'
      +'</div>'
      +'<div class="calc">'
      +'<div class="calc-item"><div class="calc-label">Food Cost %</div><div class="calc-val" id="tw-fpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Food Labor %</div><div class="calc-val" id="tw-flpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">'+target+'%</div></div>'
      +'<div class="calc-item"><div class="calc-label">vs Target %</div><div class="calc-val" id="tw-fvpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">vs Target $</div><div class="calc-val" id="tw-fvdol">—</div></div>'
      +'</div>'+this.nav(true,true)+'</div>';
  },

  calcFood(){
    const rev=parseFloat(document.getElementById('tw-fr')?.value)||0;
    const cogs=parseFloat(document.getElementById('tw-fc')?.value)||0;
    const labor=parseFloat(document.getElementById('tw-fl')?.value)||0;
    const target=App.data.settings.targets?.food_cost_pct??32;
    const pct=rev>0?(cogs/rev*100):null;
    const labPct=rev>0?(labor/rev*100):null;
    const vp=pct!=null?pct-target:null;
    const vd=pct!=null?((pct-target)/100)*rev:null;
    if(pct!=null&&cogs>rev){const el=document.getElementById('tw-fpct');if(el){el.textContent='COGS > Revenue — check numbers';el.className='calc-val warn';return;}}
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val;el.className='calc-val'+(cls?' '+cls:'');};
    set('tw-fpct',pct!=null?App.fmtPct(pct):'—',pct!=null?(pct>target?'warn':'good'):'');
    set('tw-flpct',labPct!=null?App.fmtPct(labPct):'—');
    set('tw-fvpct',vp!=null?(vp>0?'+':'')+App.fmtPct(vp):'—',vp!=null?(vp>0?'warn':'good'):'');
    set('tw-fvdol',vd!=null?(vd>0?'+':'')+App.fmtCurrency(vd):'—',vd!=null?(vd>0?'warn':'good'):'');
  },

  step4(){
    const prods=App.data.bar_products||[];
    if(prods.length===0)return '<div class="card"><div class="card-title">Bar Inventory Count</div>'
      +'<div class="empty"><div class="empty-title">No bar products set up</div><div class="empty-sub">Add products in Bar Products first.</div>'
      +'<button class="btn btn-ghost" onclick="App.navigate(\'bar-products\')">Go to Bar Products</button></div>'
      +this.nav(true,true)+'</div>';
    if(!this.draft.bar_count||this.draft.bar_count.length===0){
      const prev=App.data.weeks.length>0?App.data.weeks[App.data.weeks.length-1]:null;
      this.draft.bar_count=prods.map(p=>{const pc=prev?.bar_count?.find(c=>c.product_id===p.id);return{product_id:p.id,beg_inv:pc?.end_inv??0,purchases:'',end_inv:'',units_used:null,total_cost:null};});
    }
    const rows=prods.map(p=>{
      const cnt=this.draft.bar_count.find(c=>c.product_id===p.id)||{};
      return '<tr><td class="val">'+esc(p.name)+'</td>'
        +'<td style="color:var(--t2);">'+esc(cnt.beg_inv??0)+'</td>'
        +'<td><input class="form-input" type="number" style="width:90px;" data-pid="'+p.id+'" data-field="purchases" value="'+esc(cnt.purchases||'')+'" oninput="S.ThisWeek.calcCount(\''+p.id+'\',\'bar\')" /></td>'
        +'<td><input class="form-input" type="number" style="width:90px;" data-pid="'+p.id+'" data-field="end_inv" value="'+esc(cnt.end_inv||'')+'" oninput="S.ThisWeek.calcCount(\''+p.id+'\',\'bar\')" /></td>'
        +'<td id="cu-bar-'+p.id+'" style="color:var(--t2);">'+(cnt.units_used!=null?cnt.units_used.toFixed(2):'—')+'</td>'
        +'<td style="color:var(--t2);">'+App.fmtCurrency(p.cost_per_unit)+'</td>'
        +'<td id="cc-bar-'+p.id+'" style="color:var(--t2);">'+(cnt.total_cost!=null?App.fmtCurrency(cnt.total_cost):'—')+'</td></tr>';
    }).join('');
    return '<div class="card">'      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'      +'<div class="card-title" style="margin:0;padding:0;border:none;">Bar Inventory Count</div>'      +'<div style="display:flex;align-items:center;gap:8px;">'      +'<button class="btn btn-ghost btn-sm" onclick="S.ThisWeek.showImportPanel(\'bar-count\')" style="display:flex;align-items:center;gap:4px;">'      +'<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'      +'Import</button></div></div>'      +'<div id="tw-imp-bar-count-panel"></div>'      +'<div style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      +'<th>Product</th>'
      +'<th>Beg Inv '+tt('inv-beg')+'</th>'
      +'<th>Purchases '+tt('inv-purchases')+'</th>'
      +'<th>End Inv '+tt('inv-end')+'</th>'
      +'<th>Used '+tt('inv-used')+'</th>'
      +'<th>Unit Cost '+tt('unit-cost')+'</th>'
      +'<th>Total Cost</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
      +this.nav(true,true)+'</div>';
  },

  calcCount(pid,type){
    const arr=type==='bar'?this.draft.bar_count:this.draft.food_count;
    const cnt=arr?.find(c=>c.product_id===pid);if(!cnt)return;
    const beg=parseFloat(cnt.beg_inv)||0;
    const pur=parseFloat(document.querySelector('[data-pid="'+pid+'"][data-field="purchases"]')?.value)||0;
    const end=parseFloat(document.querySelector('[data-pid="'+pid+'"][data-field="end_inv"]')?.value)||0;
    cnt.purchases=pur;cnt.end_inv=end;
    const used=beg+pur-end;cnt.units_used=used;
    const prods=type==='bar'?App.data.bar_products:App.data.kitchen_products;
    const prod=prods?.find(p=>p.id===pid);
    cnt.total_cost=used*(prod?.cost_per_unit||0);
    const uel=document.getElementById('cu-'+type+'-'+pid);const cel=document.getElementById('cc-'+type+'-'+pid);
    if(uel){uel.textContent=used.toFixed(2);uel.style.color=used<0?'var(--red)':'var(--t2)';}
    if(cel)cel.textContent=used>=0?App.fmtCurrency(cnt.total_cost):'Check count — ending > beginning+purchases';
    this.saveDraft();
  },

  step5(){
    const prods=App.data.bar_products||[];
    if(!prods.length||!this.draft.bar_count?.length)return '<div class="card"><div class="card-title">Bar Variance</div>'
      +'<div class="empty"><div class="empty-title">Complete inventory count first</div></div>'+this.nav(true,true)+'</div>';
    if(!this.draft.bar_variance||!this.draft.bar_variance.length){
      this.draft.bar_variance=prods.map(p=>({product_id:p.id,theoretical_units:'',actual_units:null,variance_units:null,variance_oz:null,variance_dollar:null,status:''}));
    }
    const rows=prods.map(p=>{
      const cnt=this.draft.bar_count.find(c=>c.product_id===p.id)||{};
      const vr=this.draft.bar_variance.find(v=>v.product_id===p.id)||{};
      const pourOz=p.std_pour_oz||1,bottleOz=p.bottle_size_oz||25.4,ppb=bottleOz/pourOz;
      const actualPours=(cnt.units_used||0)*ppb;
      const sc=vr.status==='OK'?'badge-ok':vr.status?'badge-warn':'badge-dim';
      return '<tr><td class="val">'+esc(p.name)+'</td>'
        +'<td style="color:var(--t2);">'+actualPours.toFixed(1)+'</td>'
        +'<td><input class="form-input" type="number" step="1" style="width:90px;" data-pid="'+p.id+'" value="'+esc(vr.theoretical_units||'')+'" oninput="S.ThisWeek.calcVar(\''+p.id+'\')" /></td>'
        +'<td id="vv-'+p.id+'" style="color:var(--t2);">'+(vr.variance_units!=null?vr.variance_units.toFixed(1):'—')+'</td>'
        +'<td id="vd-'+p.id+'" class="'+(vr.variance_dollar>0?'neg':'')+'">'+(vr.variance_dollar!=null?App.fmtCurrency(vr.variance_dollar):'—')+'</td>'
        +'<td id="vs-'+p.id+'"><span class="badge '+sc+'">'+(vr.status||'—')+'</span></td></tr>';
    }).join('');
    const totDol=this.draft.bar_variance.reduce((s,v)=>s+(v.variance_dollar||0),0);
    return '<div class="card">'      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'      +'<div class="card-title" style="margin:0;padding:0;border:none;">Bar Variance</div>'      +'<div style="display:flex;align-items:center;gap:8px;">'      +'<button class="btn btn-ghost btn-sm" onclick="S.ThisWeek.showImportPanel(\'variance\')" style="display:flex;align-items:center;gap:4px;">'      +'<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'      +'Import POS Sales</button></div></div>'      +'<div id="tw-imp-variance-panel"></div>'      +'<div style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      +'<th>Product</th>'
      +'<th>Pours Made '+tt('pours-bottle')+'</th>'
      +'<th>Pours Sold '+tt('theoretical')+'</th>'
      +'<th>Variance '+tt('variance-units')+'</th>'
      +'<th>Variance $ '+tt('cost-pour')+'</th>'
      +'<th>Status</th>'
      +'</tr></thead>'
      +'<tbody>'+rows+'</tbody>'
      +'<tfoot><tr>'
      +'<td colspan="4" style="color:var(--t3);font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:9px 12px;">Total</td>'
      +'<td class="'+(totDol>0?'neg':'pos')+'" style="padding:9px 12px;">'+App.fmtCurrency(totDol)+'</td>'
      +'<td></td></tr></tfoot>'
      +'</table></div>'+this.nav(true,true)+'</div>';
  },

  calcVar(pid){
    const vr=this.draft.bar_variance?.find(v=>v.product_id===pid);
    const cnt=this.draft.bar_count?.find(c=>c.product_id===pid);
    const prod=App.data.bar_products?.find(p=>p.id===pid);
    if(!vr||!cnt||!prod)return;
    const theo=parseFloat(document.querySelector('[data-pid="'+pid+'"]')?.value)||0;
    vr.theoretical_units=theo;
    const pourOz=prod.std_pour_oz||1,bottleOz=prod.bottle_size_oz||25.4,ppb=bottleOz/pourOz;
    const actualPours=(cnt.units_used||0)*ppb;
    vr.actual_units=actualPours;
    const varU=actualPours-theo;vr.variance_units=varU;
    vr.variance_oz=varU*pourOz;
    const cpp=prod.cost_per_pour||(prod.pours_per_bottle&&prod.cost_per_unit?prod.cost_per_unit/prod.pours_per_bottle:0);
    vr.variance_dollar=varU*cpp;
    vr.status=Math.abs(varU)<=2?'OK':varU>0?'Over — Investigate':'Short — Check Count';
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=val;if(cls)el.className=cls;};
    set('vv-'+pid,vr.variance_units.toFixed(1));
    set('vd-'+pid,App.fmtCurrency(vr.variance_dollar));
    set('vs-'+pid,'<span class="badge '+(vr.status==='OK'?'badge-ok':'badge-warn')+'">'+esc(vr.status)+'</span>');
    if(vr.variance_dollar>0)document.getElementById('vd-'+pid)?.classList.add('neg');
    this.saveDraft();
  },

  step6(){
    const prods=App.data.kitchen_products||[];
    if(prods.length===0)return '<div class="card"><div class="card-title">Food Inventory Count</div>'
      +'<div class="empty"><div class="empty-title">No kitchen products set up</div><div class="empty-sub">You can skip this step.</div></div>'+this.nav(true,true)+'</div>';
    if(!this.draft.food_count||!this.draft.food_count.length){
      const prev=App.data.weeks.length>0?App.data.weeks[App.data.weeks.length-1]:null;
      this.draft.food_count=prods.map(p=>{const pc=prev?.food_count?.find(c=>c.product_id===p.id);return{product_id:p.id,beg_inv:pc?.end_inv??0,purchases:'',end_inv:'',units_used:null,total_cost:null};});
    }
    const rows=prods.map(p=>{
      const cnt=this.draft.food_count.find(c=>c.product_id===p.id)||{};
      return '<tr><td class="val">'+esc(p.name)+'</td>'
        +'<td style="color:var(--t2);">'+esc(p.unit||'each')+'</td>'
        +'<td style="color:var(--t2);">'+esc(cnt.beg_inv??0)+'</td>'
        +'<td><input class="form-input" type="number" style="width:90px;" data-pid="'+p.id+'" data-field="purchases" value="'+esc(cnt.purchases||'')+'" oninput="S.ThisWeek.calcCount(\''+p.id+'\',\'food\')" /></td>'
        +'<td><input class="form-input" type="number" style="width:90px;" data-pid="'+p.id+'" data-field="end_inv" value="'+esc(cnt.end_inv||'')+'" oninput="S.ThisWeek.calcCount(\''+p.id+'\',\'food\')" /></td>'
        +'<td id="cu-food-'+p.id+'" style="color:var(--t2);">'+(cnt.units_used!=null?cnt.units_used.toFixed(2):'—')+'</td>'
        +'<td style="color:var(--t2);">'+App.fmtCurrency(p.cost_per_unit)+'</td>'
        +'<td id="cc-food-'+p.id+'" style="color:var(--t2);">'+(cnt.total_cost!=null?App.fmtCurrency(cnt.total_cost):'—')+'</td></tr>';
    }).join('');
    return '<div class="card">'      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'      +'<div class="card-title" style="margin:0;padding:0;border:none;">Food Inventory Count</div>'      +'<div style="display:flex;align-items:center;gap:8px;">'      +'<button class="btn btn-ghost btn-sm" onclick="S.ThisWeek.showImportPanel(\'food-count\')" style="display:flex;align-items:center;gap:4px;">'      +'<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'      +'Import</button></div></div>'      +'<div id="tw-imp-food-count-panel"></div>'      +'<div style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      +'<th>Product</th>'
      +'<th>Unit '+tt('kitchen-unit')+'</th>'
      +'<th>Beg Inv '+tt('inv-beg')+'</th>'
      +'<th>Purchases '+tt('inv-purchases')+'</th>'
      +'<th>End Inv '+tt('inv-end')+'</th>'
      +'<th>Used '+tt('inv-used')+'</th>'
      +'<th>Unit Cost '+tt('kitchen-cost')+'</th>'
      +'<th>Total Cost</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
      +this.nav(true,true)+'</div>';
  },



  showImportPanel(type) {
    const panelId = type === 'bar-count' ? 'tw-imp-bar-count-panel'
                  : type === 'variance'  ? 'tw-imp-variance-panel'
                  : 'tw-imp-food-count-panel';
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const configs = {
      'bar-count': {
        title: 'Import Bar Inventory Count',
        desc:  'Upload your physical bar count sheet. The app reads your columns, matches product names, and fills in Purchases and Ending Inventory automatically.',
        guide: '<strong style="color:var(--t1);">Columns the app looks for:</strong><br>'
          + '&bull; <strong>Product name</strong> — any column named Item, Name, Product, Description, or similar<br>'
          + '&bull; <strong>Purchases / Received / Deliveries</strong> — bottles or units received this week<br>'
          + '&bull; <strong>Ending / End / Closing / On Hand / Count</strong> — your physical closing count<br><br>'
          + '<strong style="color:var(--t1);">You do not need all columns</strong> — import just ending inventory if that is all you have.<br><br>'
          + '<strong style="color:var(--t1);">Beginning inventory</strong> carries forward from last week automatically.<br><br>'
          + '<strong style="color:var(--t1);">Where to export:</strong><br>'
          + '&bull; Toast: Reports → Inventory → End of Day Inventory<br>'
          + '&bull; Square: Items → Inventory History → Export<br>'
          + '&bull; Lightspeed: Reports → Inventory → Stock Report<br>'
          + '&bull; Any inventory system: Physical Count or End of Period export as CSV or Excel',
        fileId:   'tw-file-bar-count',
        onChange: "S.ThisWeek._handleImportFile(this,'bar-count')",
      },
      'variance': {
        title: 'Import POS Sales — Bar Variance',
        desc:  'Upload your POS Item Sales or Sales Mix report for the week. The app matches product names and fills in Pours Sold automatically so variance calculates instantly.',
        guide: '<strong style="color:var(--t1);">Columns the app looks for:</strong><br>'
          + '&bull; <strong>Product name</strong> — any column named Item, Name, Product, Description, Menu Item, or similar<br>'
          + '&bull; <strong>Quantity sold</strong> — any column named Qty, Sold, Units, Pours, Shots, Count, Net Qty, or similar<br><br>'
          + '<strong style="color:var(--t1);">Important:</strong> The quantity column must be number of drinks sold — not dollar amount.<br><br>'
          + '<strong style="color:var(--t1);">Where to export:</strong><br>'
          + '&bull; Toast: Reports → Menu → Item Selection Report<br>'
          + '&bull; Square: Reports → Item Sales → Export<br>'
          + '&bull; Aloha: Reports → Sales → Product Mix Report<br>'
          + '&bull; Lightspeed: Reports → Sales → Sales by Item<br>'
          + '&bull; Any system: look for Item Sales Report, Sales Mix, Menu Mix, or Product Mix',
        fileId:   'tw-file-variance',
        onChange: "S.ThisWeek._handleImportFile(this,'variance')",
      },
      'food-count': {
        title: 'Import Food Inventory Count',
        desc:  'Upload your kitchen count sheet. The app matches product names and fills in Purchases and Ending Inventory automatically.',
        guide: '<strong style="color:var(--t1);">Columns the app looks for:</strong><br>'
          + '&bull; <strong>Product name</strong> — any column named Item, Name, Product, Ingredient, Description, or similar<br>'
          + '&bull; <strong>Purchases / Received / Deliveries</strong> — units received this week<br>'
          + '&bull; <strong>Ending / End / Closing / On Hand / Count</strong> — your physical closing count<br><br>'
          + '<strong style="color:var(--t1);">Units:</strong> Use whatever unit you count in — lbs, cases, each, quarts.<br><br>'
          + '<strong style="color:var(--t1);">Where to export:</strong><br>'
          + '&bull; MarketMan, Craftable, BlueCart, Compeat: Physical Count or Inventory Count export<br>'
          + '&bull; Sysco / US Foods / PFG portal: order history download works as a purchases import<br>'
          + '&bull; A manual spreadsheet you already maintain: save as CSV and import directly',
        fileId:   'tw-file-food-count',
        onChange: "S.ThisWeek._handleImportFile(this,'food-count')",
      }
    };

    const cfg = configs[type];
    if (!cfg) return;

    panel.innerHTML = '<div class="divider"></div><div class="card">'
      + '<div class="card-title">' + cfg.title + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">' + cfg.desc + '</div>'
      + '<details style="margin-bottom:16px;"><summary style="font-size:11px;color:var(--t3);cursor:pointer;font-weight:700;letter-spacing:0.5px;">What should my file look like?</summary>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.7;margin-top:8px;padding:10px 12px;background:var(--input);border-radius:3px;">'
      + '<strong style="color:var(--t1);">First row must be column headers.</strong> One row per product.<br><br>'
      + cfg.guide
      + '<br><br><strong style="color:var(--t1);">Accepted formats:</strong> CSV, Excel (.xlsx, .xls)<br>'
      + '<strong style="color:var(--t1);">Name matching:</strong> Strips size descriptors (750ml, 1.75L, 12oz, lb, case) and matches on core product name. Unmatched items are listed after import.'
      + '</div></details>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Accepted formats: CSV, XLSX, XLS</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f"><label>Select File</label>'
      + '<input type="file" id="' + cfg.fileId + '" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:8px;font-size:12px;cursor:pointer;width:100%;" onchange="' + cfg.onChange + '"/>'
      + '</div></div>'
      + '<div id="tw-imp-status-' + type + '" style="font-size:12px;margin-top:10px;display:none;"></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" onclick="S.ThisWeek._closeImportPanel(\'' + type + '\')">Cancel</button>'
      + '</div></div>';

    panel.scrollIntoView({behavior:'smooth', block:'nearest'});
  },

  _closeImportPanel(type) {
    const panelId = type === 'bar-count' ? 'tw-imp-bar-count-panel'
                  : type === 'variance'  ? 'tw-imp-variance-panel'
                  : 'tw-imp-food-count-panel';
    const panel = document.getElementById(panelId);
    if (panel) panel.innerHTML = '';
  },

  _setImportStatus(type, msg, color) {
    const el = document.getElementById('tw-imp-status-' + type);
    if (!el) return;
    el.style.display = 'block';
    el.style.color = color || 'var(--t2)';
    el.textContent = msg;
  },

  _handleImportFile(input, type) {
    const file = input.files?.[0];
    if (!file) return;
    this._setImportStatus(type, 'Reading file...', 'var(--t3)');
    const ext = file.name.split('.').pop().toLowerCase();

    const apply = (headers, rows) => {
      if (type === 'variance') {
        this._applyVarianceImport(headers, rows, type);
      } else {
        this._applyCountImport(headers, rows, type === 'bar-count' ? 'bar' : 'food', type);
      }
    };

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = e => {
        const parsed = this._parseCSV(e.target.result);
        if (!parsed) { this._setImportStatus(type, 'File appears empty.', 'var(--red)'); return; }
        apply(parsed.headers, parsed.rows);
      };
      reader.readAsText(file);
    } else {
      const load = () => {
        const reader = new FileReader();
        reader.onload = e => {
          const wb = XLSX.read(e.target.result, {type:'array'});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
          if (data.length < 2) { this._setImportStatus(type, 'File appears empty.', 'var(--red)'); return; }
          const headers = data[0].map(h => String(h).trim());
          const rows = data.slice(1).filter(r => r.some(v => v !== '')).map(r => r.map(v => String(v).trim()));
          apply(headers, rows);
        };
        reader.readAsArrayBuffer(file);
      };
      if (typeof XLSX === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = load; s.onerror = () => this._setImportStatus(type, 'Could not load Excel reader. Try CSV.', 'var(--red)');
        document.head.appendChild(s);
      } else load();
    }
    input.value = '';
  },

  _applyCountImport(headers, rows, countType, panelType) {
    const prods = countType === 'bar' ? (App.data.bar_products||[]) : (App.data.kitchen_products||[]);
    const countArr = countType === 'bar' ? this.draft.bar_count : this.draft.food_count;
    if (!countArr?.length) { this._setImportStatus(panelType, 'No products found — set up products first.', 'var(--red)'); return; }

    const nameCol = this._detectNameCol(headers);
    const purCol  = this._detectNumCol(headers, ['purchase','received','delivery','deliveries','receive','bought','order','in','additions','add']);
    const endCol  = this._detectNumCol(headers, ['ending','end','close','closing','final','count','on hand','onhand','physical']);

    if (!purCol && !endCol) {
      this._setImportStatus(panelType, 'Could not detect Purchases or Ending Inventory columns. Check your file has column headers.', 'var(--red)');
      return;
    }

    const colIdx = col => headers.indexOf(col);
    const getVal = (row, col) => col ? (parseFloat((row[colIdx(col)]||'').replace(/[^0-9.-]/g,'')) || 0) : 0;

    let matched = 0, unmatched = [];
    rows.forEach(row => {
      const itemName = (row[colIdx(nameCol)] || '').toString().trim();
      if (!itemName) return;
      let bestProd = null, bestScore = 0;
      prods.forEach(p => { const s = this._fuzzyMatch(itemName, p.name); if (s > bestScore) { bestScore = s; bestProd = p; } });
      if (!bestProd || bestScore < 0.45) { unmatched.push(itemName); return; }
      const cnt = countArr.find(c => c.product_id === bestProd.id);
      if (!cnt) return;
      if (purCol) { const v = getVal(row, purCol); if (v > 0) cnt.purchases = v; }
      if (endCol) { cnt.end_inv = getVal(row, endCol); }
      matched++;
    });

    prods.forEach(p => {
      const cnt = countArr.find(c => c.product_id === p.id);
      if (!cnt) return;
      const beg = parseFloat(cnt.beg_inv)||0, pur = parseFloat(cnt.purchases)||0, end = parseFloat(cnt.end_inv)||0;
      cnt.units_used = beg + pur - end;
      cnt.total_cost = cnt.units_used * (p.cost_per_unit||0);
    });
    this.saveDraft();

    const msg = matched + ' product' + (matched!==1?'s':'') + ' updated'
      + (unmatched.length ? '. Not matched: ' + unmatched.slice(0,4).join(', ') + (unmatched.length>4?'…':'') : '');
    this._setImportStatus(panelType, msg, matched > 0 ? 'var(--gold)' : 'var(--red)');
    setTimeout(() => { this._closeImportPanel(panelType); this.renderStep(this.step); }, 1800);
  },

  _applyVarianceImport(headers, rows, panelType) {
    const prods  = App.data.bar_products || [];
    const varArr = this.draft.bar_variance;
    const cntArr = this.draft.bar_count;
    if (!varArr?.length) { this._setImportStatus(panelType, 'Complete inventory count first.', 'var(--red)'); return; }

    const nameCol = this._detectNameCol(headers);
    const soldCol = this._detectNumCol(headers, ['sold','qty','quantity','count','units','pours','shots','drinks','sales','total','net qty','net sales','net quantity']);

    if (!soldCol) {
      this._setImportStatus(panelType, 'Could not detect a Qty Sold column. Column should be named Qty, Sold, Units, Pours, or similar.', 'var(--red)');
      return;
    }

    const colIdx = col => headers.indexOf(col);
    let matched = 0, unmatched = [];

    rows.forEach(row => {
      const itemName = (row[colIdx(nameCol)] || '').toString().trim();
      if (!itemName) return;
      let bestProd = null, bestScore = 0;
      prods.forEach(p => { const s = this._fuzzyMatch(itemName, p.name); if (s > bestScore) { bestScore = s; bestProd = p; } });
      if (!bestProd || bestScore < 0.45) { unmatched.push(itemName); return; }
      const vr = varArr.find(v => v.product_id === bestProd.id);
      const cnt = cntArr?.find(c => c.product_id === bestProd.id);
      if (!vr) return;
      const soldQty = parseFloat((row[colIdx(soldCol)]||'').toString().replace(/[^0-9.-]/g,'')) || 0;
      vr.theoretical_units = soldQty;
      const pourOz = bestProd.std_pour_oz||1, bottleOz = bestProd.bottle_size_oz||25.4;
      const actualPours = (cnt?.units_used||0) * (bottleOz/pourOz);
      vr.actual_units = actualPours;
      const varU = actualPours - soldQty;
      vr.variance_units = varU;
      vr.variance_oz = varU * pourOz;
      const cpp = bestProd.cost_per_pour||(bestProd.pours_per_bottle&&bestProd.cost_per_unit?bestProd.cost_per_unit/bestProd.pours_per_bottle:0);
      vr.variance_dollar = varU * cpp;
      vr.status = Math.abs(varU)<=2?'OK':varU>0?'Over — Investigate':'Short — Check Count';
      matched++;
    });

    this.saveDraft();
    const msg = matched + ' product' + (matched!==1?'s':'') + ' updated'
      + (unmatched.length ? '. Not matched: ' + unmatched.slice(0,4).join(', ') + (unmatched.length>4?'…':'') : '');
    this._setImportStatus(panelType, msg, matched > 0 ? 'var(--gold)' : 'var(--red)');
    setTimeout(() => { this._closeImportPanel(panelType); this.renderStep(this.step); }, 1800);
  },

  // ── Shared import utilities ─────────────────────────────────────────────────

  // Fuzzy name match: returns 0-1 similarity score
  _fuzzyMatch(a, b) {
    const clean = s => s.toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim()
      .replace(/\b(ml|oz|liter|litre|750|1750|1000|375|200|50|12|16|keg|bottle|btl|case|pk|pack|ea|each|lb|lbs|kg|gallon|gal|qt|quart|pint|pt|cup)\b/g,'').replace(/\s+/g,' ').trim();
    const ca = clean(a), cb = clean(b);
    if (ca === cb) return 1;
    if (ca.includes(cb) || cb.includes(ca)) return 0.85;
    const wa = ca.split(' '), wb = cb.split(' ');
    const common = wa.filter(w => w.length > 2 && wb.includes(w));
    if (common.length === 0) return 0;
    return common.length / Math.max(wa.length, wb.length);
  },

  // Parse CSV text into [headers, rows]
  _parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = []; let inQ = false, cur = '';
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      vals.push(cur.trim());
      return vals;
    });
    return { headers, rows };
  },

  // Auto-detect which column likely contains item names
  _detectNameCol(headers) {
    const candidates = ['name','item','product','description','item name','product name','sku description','item description','menu item','ingredient'];
    for (const h of headers) {
      if (candidates.some(c => h.toLowerCase().includes(c))) return h;
    }
    return headers[0]; // fallback to first column
  },

  // Auto-detect numeric column by keyword list
  _detectNumCol(headers, keywords) {
    for (const h of headers) {
      if (keywords.some(k => h.toLowerCase().includes(k))) return h;
    }
    return null;
  },

  // Show import status message
  _setImportMsg(id, msg, color) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    el.style.color = color || 'var(--t2)';
    el.textContent = msg;
  },

  step7(){
    const d=this.draft;
    const bRev=parseFloat(d.bar.revenue)||0,bCogs=parseFloat(d.bar.cogs)||0,bLab=parseFloat(d.bar.labor)||0;
    const fRev=parseFloat(d.food.revenue)||0,fCogs=parseFloat(d.food.cogs)||0,fLab=parseFloat(d.food.labor)||0;
    const tRev=bRev+fRev,tCogs=bCogs+fCogs,tLab=bLab+fLab;
    const bPct=bRev>0?(bCogs/bRev*100):0;
    const fPct=fRev>0?(fCogs/fRev*100):0;
    const pPct=tRev>0?((tCogs+tLab)/tRev*100):0;
    const t=App.data.settings.targets||{};
    const bT=t.bar_pour_cost_pct??22,fT=t.food_cost_pct??32,pT=t.prime_cost_pct??60;
    return '<div class="card"><div class="card-title">Review — Week '+d.week_num+'</div>'
      +'<div class="tbl-wrap" style="margin-bottom:14px;"><table class="sum-tbl"><thead><tr><th></th><th>This Week</th><th>Annualized</th></tr></thead><tbody>'
      +'<tr><td>Bar Revenue</td><td class="val">'+App.fmtCurrency(bRev)+'</td><td>'+App.fmtCurrency(bRev*52)+'</td></tr>'
      +'<tr><td>Bar COGS</td><td>'+App.fmtCurrency(bCogs)+'</td><td></td></tr>'
      +'<tr><td>Bar Labor</td><td>'+App.fmtCurrency(bLab)+'</td><td></td></tr>'
      +'<tr><td>Bar Pour Cost %</td><td class="val '+(bPct>bT?'neg':'pos')+'">'+App.fmtPct(bPct)+'</td><td class="dim">Target: '+bT+'%</td></tr>'
      +'<tr><td>Bar Labor %</td><td>'+App.fmtPct(bRev>0?(bLab/bRev*100):0)+'</td><td></td></tr>'
      +'<tr><td>Food Revenue</td><td class="val">'+App.fmtCurrency(fRev)+'</td><td>'+App.fmtCurrency(fRev*52)+'</td></tr>'
      +'<tr><td>Food Cost %</td><td class="val '+(fPct>fT?'neg':'pos')+'">'+App.fmtPct(fPct)+'</td><td class="dim">Target: '+fT+'%</td></tr>'
      +'<tr class="total"><td>Total Revenue</td><td class="val">'+App.fmtCurrency(tRev)+'</td><td>'+App.fmtCurrency(tRev*52)+'</td></tr>'
      +'<tr class="total"><td>Prime Cost % '+tt('prime-cost')+'</td><td class="val '+(pPct>pT?'neg':'pos')+'">'+App.fmtPct(pPct)+'</td><td class="dim">Target: '+pT+'%</td></tr>'
      +'</tbody></table></div>'
      +'<div class="f" style="margin-bottom:14px;"><label>Notes (optional)</label><textarea id="tw-notes" rows="2">'+esc(d.notes||'')+'</textarea></div>'
      +'<div class="card-actions">'
      +'<button class="btn btn-ghost" id="tw-prev">← Back</button>'
      +'<button class="btn btn-primary btn-lg" id="tw-save-week">Save Week</button>'
      +'<span id="tw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      +'</div></div>'
      +'<div id="tw-alert-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;"><div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;"><div id="tw-alert-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;"></div><div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-primary" id="tw-alert-ok">OK</button></div></div></div>';
  },

  wireStep(step){
    if(step===2)setTimeout(()=>this.calcBar(),0);
    if(step===3)setTimeout(()=>this.calcFood(),0);
    const nxtBtn=document.getElementById('tw-next');if(nxtBtn)nxtBtn.onclick=()=>{
      if(step===1){this.draft.week_num=document.getElementById('tw-wk')?.value||this.draft.week_num;this.draft.period_end=document.getElementById('tw-end')?.value||this.draft.period_end;}
      if(step===2){this.draft.bar.revenue=document.getElementById('tw-br')?.value||'';this.draft.bar.cogs=document.getElementById('tw-bc')?.value||'';this.draft.bar.labor=document.getElementById('tw-bl')?.value||'';}
      if(step===3){this.draft.food.revenue=document.getElementById('tw-fr')?.value||'';this.draft.food.cogs=document.getElementById('tw-fc')?.value||'';this.draft.food.labor=document.getElementById('tw-fl')?.value||'';}
      this.saveDraft();this.renderStep(step+1);
    };
    const prvBtn=document.getElementById('tw-prev');if(prvBtn)prvBtn.onclick=()=>{
      if(step===7){this.draft.notes=document.getElementById('tw-notes')?.value||'';this.saveDraft();}
      this.renderStep(Math.max(1,step-1));
    };
    const swBtn=document.getElementById('tw-save-week');if(swBtn)swBtn.onclick=()=>this.saveWeek();
  },

  async saveWeek(){
    const d=this.draft;
    d.notes=document.getElementById('tw-notes')?.value||'';
    const bRev=parseFloat(d.bar.revenue)||0,bCogs=parseFloat(d.bar.cogs)||0,bLab=parseFloat(d.bar.labor)||0;
    const fRev=parseFloat(d.food.revenue)||0,fCogs=parseFloat(d.food.cogs)||0,fLab=parseFloat(d.food.labor)||0;
    const tRev=bRev+fRev;

    if(tRev===0){
      const modal=document.getElementById('tw-alert-modal');
      const msg=document.getElementById('tw-alert-msg');
      if(msg) msg.textContent='Bar revenue and food revenue are both zero. Enter at least one revenue figure before saving.';
      if(modal) modal.style.display='flex';
      document.getElementById('tw-alert-ok').onclick=()=>{modal.style.display='none';};
      return;
    }
    const tCogs=bCogs+fCogs,tLab=bLab+fLab;
    const bPct=bRev>0?(bCogs/bRev*100):0;
    const fPct=fRev>0?(fCogs/fRev*100):0;
    const pPct=tRev>0?((tCogs+tLab)/tRev*100):0;
    const t=App.data.settings.targets||{};
    const week={id:App.uid(),week_num:parseInt(d.week_num),period_end:d.period_end,saved_at:new Date().toISOString(),
      bar:{revenue:bRev,cogs:bCogs,labor:bLab,cost_pct:bPct,labor_pct:bRev>0?(bLab/bRev*100):0,vs_target_pct:bPct-(t.bar_pour_cost_pct??22),vs_target_dollar:((bPct-(t.bar_pour_cost_pct??22))/100)*bRev},
      food:{revenue:fRev,cogs:fCogs,labor:fLab,cost_pct:fPct,labor_pct:fRev>0?(fLab/fRev*100):0,vs_target_pct:fPct-(t.food_cost_pct??32),vs_target_dollar:((fPct-(t.food_cost_pct??32))/100)*fRev},
      prime_cost_pct:pPct,bar_count:d.bar_count||[],bar_variance:d.bar_variance||[],food_count:d.food_count||[],notes:d.notes};
    App.data.weeks.push(week);
    const ok=await App.saveKey('weeks');
    if(ok){this.clearDraft();App.updatePeriod();App.navigate('dashboard');}
    else{const e=document.getElementById('tw-err');if(e){e.textContent='Save failed. Try again.';e.style.display='inline';}}
  }
};
