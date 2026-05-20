'use strict';
S.VendorWatch = {
  render(container, actions) {
    this.container=container;
    const btn=document.createElement('button');btn.className='btn btn-primary btn-sm';btn.textContent='Log Change';
    btn.addEventListener('click',()=>this.showForm());actions.appendChild(btn);
    this.renderMain();
    // Auto-show form if no entries yet
    setTimeout(()=>{ if((App.data.vendor_log||[]).length===0) this.showForm(); }, 50);
  },
  allProds(){return [...(App.data.bar_products||[]).map(p=>({...p,_t:'bar'})),...(App.data.kitchen_products||[]).map(p=>({...p,_t:'kitchen'}))];},
  renderMain(){
    const log=(App.data.vendor_log||[]).slice().reverse();
    const total=log.reduce((s,e)=>s+(e.annual_impact||0),0);
    const logRows=log.length===0
      ?'<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--t4);">No price changes logged yet.</td></tr>'
      :log.map(e=>'<tr><td>'+esc(e.date||'—')+'</td><td>'+esc(e.vendor||'—')+'</td><td class="val">'+esc(e.product_name||'—')+'</td>'
        +'<td>'+App.fmtCurrency(e.old_price,2)+'</td><td>'+App.fmtCurrency(e.new_price,2)+'</td>'
        +'<td class="'+(e.change_pct>0?'neg':'pos')+'">'+(e.change_pct>0?'+':'')+App.fmtPct(e.change_pct)+'</td>'
        +'<td class="'+(e.annual_impact>0?'neg':'pos')+'">'+(e.annual_impact>0?'+':'')+App.fmtCurrency(e.annual_impact)+'/yr</td></tr>').join('');

    this.container.innerHTML='<div class="screen">'
      +(log.length>0?'<div class="calc" style="margin-bottom:18px;">'
        +'<div class="calc-item"><div class="calc-label">Changes Logged</div><div class="calc-val">'+log.length+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Total Annual Impact</div><div class="calc-val '+(total>0?'warn':'good')+'">'+(total>0?'+':'')+App.fmtCurrency(total)+'/yr</div></div>'
        +'</div>':'')
      +'<div id="vw-form"></div>'
      +'<div class="sh">Price Change Log</div>'
      +'<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      +'<th>Date</th><th>Vendor</th><th>Product</th><th>Previous Cost</th><th>New Invoice Cost</th><th>Cost Change %</th><th>Annual Impact $</th>'
      +'</tr></thead><tbody>'+logRows+'</tbody></table></div></div>';

    this.container.onclick=ev=>{
      if(ev.target.closest('#vw-cancel'))this.renderMain();
      if(ev.target.closest('#vw-save'))this.saveEntry();
    };
    this.container.addEventListener('change',ev=>{if(ev.target.id==='vw-prod')this.onProdSelect();});
    this.container.addEventListener('input',ev=>{if(['vw-new','vw-usage'].includes(ev.target.id))this.calcImpact();});
  },
  showForm(){
    const fa=document.getElementById('vw-form');if(!fa)return;
    const prods=this.allProds();
    if(prods.length===0){fa.innerHTML='<div class="card" style="margin-bottom:18px;"><p style="color:var(--t2);">Add bar or kitchen products first.</p></div>';return;}
    const bar=prods.filter(p=>p._t==='bar'),kit=prods.filter(p=>p._t==='kitchen');
    let opts='<option value="">Select product...</option>';
    if(bar.length){opts+='<optgroup label="Bar Products">';bar.forEach(p=>{opts+='<option value="'+p.id+'">'+esc(p.name)+'</option>';});opts+='</optgroup>';}
    if(kit.length){opts+='<optgroup label="Kitchen / Mixers">';kit.forEach(p=>{opts+='<option value="'+p.id+'">'+esc(p.name)+'</option>';});opts+='</optgroup>';}

    fa.innerHTML='<div class="card" style="margin-bottom:18px;"><div class="card-title">Log Price Change</div>'
      +'<div class="form-row" style="gap:16px;">'
      +'<div class="f w-date"><label>Date</label><input type="date" id="vw-date" value="'+new Date().toISOString().slice(0,10)+'" /></div>'
      +'<div class="f" style="width:220px;flex-shrink:0;"><label>Product</label><select id="vw-prod">'+opts+'</select></div>'
      +'<div class="f" style="width:170px;flex-shrink:0;"><label>Vendor</label><input type="text" id="vw-vendor" placeholder="Auto-fills from product" /></div>'
      +'</div>'
      +'<div class="form-row" style="gap:16px;">'
      +'<div class="f" style="width:130px;flex-shrink:0;"><label>Previous Cost '+tt('prev-cost')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vw-old" readonly style="opacity:0.6;" placeholder="Auto-fills"/></div></div>'
      +'<div class="f" style="width:130px;flex-shrink:0;"><label>New Invoice Cost '+tt('new-cost')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vw-new" placeholder="0.00" step="0.01" /></div></div>'
      +'<div class="f" style="width:130px;flex-shrink:0;"><label>Weekly Usage '+tt('weekly-usage')+'</label><input type="number" id="vw-usage" placeholder="e.g. 4" step="0.5" /></div>'
      +'</div>'
      +'<div class="calc" id="vw-calc" style="display:none;margin-bottom:0;">'
      +'<div class="calc-item"><div class="calc-label">Cost Change $</div><div class="calc-val" id="vw-cd">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Cost Change %</div><div class="calc-val" id="vw-cp">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Annual Impact $ '+tt('annual-impact')+'</div><div class="calc-val" id="vw-ai">—</div></div>'
      +'</div>'
      +'<div class="card-actions">'
      +'<button class="btn btn-primary" id="vw-save">Update Cost</button>'
      +'<button class="btn btn-ghost" id="vw-cancel">Cancel</button>'
      +'<span id="vw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      +'</div></div>';
  },
  onProdSelect(){
    const id=document.getElementById('vw-prod')?.value;const prod=this.allProds().find(p=>p.id===id);if(!prod)return;
    const ve=document.getElementById('vw-vendor');if(ve&&prod.vendor){ve.value=prod.vendor;ve.readOnly=false;ve.style.opacity='1';}
    const oe=document.getElementById('vw-old');if(oe)oe.value=prod.cost_per_unit||0;
    this.calcImpact();
  },
  calcImpact(){
    const old=parseFloat(document.getElementById('vw-old')?.value)||0;
    const nw=parseFloat(document.getElementById('vw-new')?.value)||0;
    const usage=parseFloat(document.getElementById('vw-usage')?.value)||0;
    const calc=document.getElementById('vw-calc');if(!calc)return;
    if(!nw){calc.style.display='none';return;}calc.style.display='';
    const cd=nw-old,cp=old>0?(cd/old*100):0,ai=cd*usage*52;
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val;el.className='calc-val'+(cls?' '+cls:'');};
    set('vw-cd',(cd>=0?'+':'')+App.fmtCurrency(cd,2),cd>0?'warn':cd<0?'good':'');
    set('vw-cp',(cp>=0?'+':'')+App.fmtPct(cp),cp>0?'warn':cp<0?'good':'');
    set('vw-ai',(ai>=0?'+':'')+App.fmtCurrency(ai)+'/yr'+(usage===0?' — enter weekly usage':''),ai>0?'warn':ai<0?'good':'');
  },
  saveEntry(){
    const id=document.getElementById('vw-prod')?.value;
    const nw=parseFloat(document.getElementById('vw-new')?.value);
    const old=parseFloat(document.getElementById('vw-old')?.value)||0;
    const usage=parseFloat(document.getElementById('vw-usage')?.value)||0;
    const err=document.getElementById('vw-err');
    if(!id){if(err){err.textContent='Select a product.';err.style.display='inline';}return;}
    if(!nw){if(err){err.textContent='Enter new invoice cost.';err.style.display='inline';}return;}
    const prod=this.allProds().find(p=>p.id===id);if(!prod)return;
    const cd=nw-old,cp=old>0?(cd/old*100):0,ai=cd*usage*52;
    const entry={id:App.uid(),date:document.getElementById('vw-date')?.value||new Date().toISOString().slice(0,10),vendor:document.getElementById('vw-vendor')?.value.trim()||'',product_id:id,product_name:prod.name,product_type:prod._t,old_price:old,new_price:nw,change_dollar:cd,change_pct:cp,weekly_usage:usage,annual_impact:ai,saved_at:new Date().toISOString()};
    if(!App.data.vendor_log)App.data.vendor_log=[];
    App.data.vendor_log.push(entry);
    if(prod._t==='bar'){const i=(App.data.bar_products||[]).findIndex(p=>p.id===id);if(i>-1){App.data.bar_products[i].cost_per_unit=nw;const p=App.data.bar_products[i];if(p.pours_per_bottle){p.cost_per_pour=nw/p.pours_per_bottle;if(p.menu_price)p.pour_cost_pct=(p.cost_per_pour/p.menu_price)*100;}}}
    else{const i=(App.data.kitchen_products||[]).findIndex(p=>p.id===id);if(i>-1)App.data.kitchen_products[i].cost_per_unit=nw;}
    (App.data.recipes||[]).forEach(r=>{let changed=false;(r.ingredients||[]).forEach(ing=>{if(ing.product_id===id){ing.cost_per_unit=nw;ing.total_cost=nw*(ing.quantity||0);changed=true;}});if(changed){r.total_cost=(r.ingredients||[]).reduce((s,i)=>s+(i.total_cost||0),0);const sv=r.servings_per_batch||r.plate_yield||1;r.cost_per_serving=r.total_cost/sv;if(r.menu_price){r.cost_pct=(r.cost_per_serving/r.menu_price)*100;r.flagged=r.target_cost_pct?r.cost_pct>r.target_cost_pct:false;}}});
    Promise.all([App.saveKey('vendor_log'),App.saveKey(prod._t==='bar'?'bar_products':'kitchen_products'),App.saveKey('recipes')]).then(()=>this.renderMain());
  }
};
