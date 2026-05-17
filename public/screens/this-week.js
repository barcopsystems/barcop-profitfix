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
    return '<div class="card"><div class="card-title">Bar Inventory Count</div>'
      +'<div style="overflow-x:auto;"><table class="tbl"><thead><tr>'
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
    return '<div class="card"><div class="card-title">Bar Variance</div>'
      +'<div style="overflow-x:auto;"><table class="tbl"><thead><tr>'
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
    return '<div class="card"><div class="card-title">Food Inventory Count</div>'
      +'<div style="overflow-x:auto;"><table class="tbl"><thead><tr>'
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
      +'</div></div>';
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
    const tRev=bRev+fRev,tCogs=bCogs+fCogs,tLab=bLab+fLab;
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
