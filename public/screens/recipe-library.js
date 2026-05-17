'use strict';
S.RecipeLibrary={
  editId:null,rows:[],mode:null,_saving:false,_pendingDelIds:null,
  YUNITS:[{l:'oz',oz:1},{l:'ml',oz:0.033814},{l:'liters',oz:33.814},{l:'gallons',oz:128},{l:'quarts',oz:32},{l:'pints',oz:16},{l:'cups',oz:8}],
  yOpts(sel){return this.YUNITS.map(u=>'<option value="'+u.l+'"'+(u.l===(sel||'oz')?' selected':'')+'>'+u.l+'</option>').join('');},
  toOz(v,u){const m=this.YUNITS.find(x=>x.l===u);return v*(m?m.oz:1);},
  allProds(){return[...(App.data.bar_products||[]).map(p=>({...p,_t:'bar'})),...(App.data.kitchen_products||[]).map(p=>({...p,_t:'kitchen'}))];},
  prodsForMode(mode){if(mode==='food')return(App.data.kitchen_products||[]).map(p=>({...p,_t:'kitchen'}));if(mode==='batch')return this.allProds();return(App.data.bar_products||[]).map(p=>({...p,_t:'bar'}));},
  prodOpts(mode,selId){
    const prods=this.prodsForMode(mode);if(!prods.length)return'<option value="">No products set up</option>';
    if(mode==='batch'){
      const bar=prods.filter(p=>p._t==='bar'),kit=prods.filter(p=>p._t==='kitchen');
      let h='<option value="">Select ingredient...</option>';
      if(bar.length){h+='<optgroup label="Bar Products">';bar.forEach(p=>{h+='<option value="'+p.id+'"'+(p.id===selId?' selected':'')+'>'+esc(p.name)+'</option>';});h+='</optgroup>';}
      if(kit.length){h+='<optgroup label="Kitchen / Mixers">';kit.forEach(p=>{h+='<option value="'+p.id+'"'+(p.id===selId?' selected':'')+'>'+esc(p.name)+' ('+esc(p.unit||'each')+')</option>';});h+='</optgroup>';}
      return h;
    }
    return'<option value="">Select ingredient...</option>'+prods.map(p=>'<option value="'+p.id+'"'+(p.id===selId?' selected':'')+'>'+esc(p.name)+'</option>').join('');
  },
  unitLabel(prod,mode){if(!prod)return'—';if(mode==='single')return'pours';if(mode==='batch')return prod._t==='kitchen'?(prod.unit||'each'):'bottles';return prod.unit||'units';},
  costBasis(prod,mode){if(!prod)return 0;if(mode==='single')return prod.cost_per_pour||0;return prod.cost_per_unit||0;},

  render(container,actions){
    this.container=container;
    const btn=document.createElement('button');btn.className='btn btn-primary btn-sm';btn.textContent='New Recipe';
    btn.addEventListener('click',()=>this.showModeSelector());actions.appendChild(btn);
    this.renderList();
  },
  renderList(){
    const recipes=App.data.recipes||[];const flagged=recipes.filter(r=>r.flagged).length;
    const mL={single:'Single Drink',batch:'Batch Cocktail',food:'Food Plate'};
    let html='';
    if(recipes.length===0){html='<div class="empty"><div class="empty-title">No recipes yet</div><div class="empty-sub">Cost out single cocktails, batch bar recipes, or food plates.</div><button class="btn btn-primary" id="rl-add-first">Add Recipe</button></div>';}
    else{
      const rows=recipes.map(r=>{
        const tgt=r.target_cost_pct??22;const over=r.cost_pct!=null&&r.cost_pct>tgt;
        const yld=r.mode==='batch'?(r.batch_yield||'—')+' '+(r.batch_yield_unit||''):r.mode==='food'?(r.plate_yield>1?r.plate_yield+' plates':'1 plate'):'1 drink';
        return '<tr><td style="width:36px;"><input type="checkbox" class="rl-chk" data-id="'+r.id+'" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td><td class="val">'+esc(r.name)+'<span class="badge badge-dim" style="margin-left:6px;font-size:8px;">'+(mL[r.mode]||r.mode||'SINGLE').toUpperCase()+'</span>'+(r.flagged?'<span class="badge badge-warn" style="margin-left:4px;">Above Target</span>':'')+'</td>'
          +'<td>'+esc(r.category||'—')+'</td><td>'+esc(yld)+'</td>'
          +'<td>'+App.fmtCurrency(r.cost_per_serving)+'</td><td>'+App.fmtCurrency(r.menu_price)+'</td>'
          +'<td class="'+(over?'neg':r.cost_pct!=null?'pos':'')+'">'+App.fmtPct(r.cost_pct)+'</td>'
          +'<td>'+App.fmtPct(tgt)+'</td>'
          +'<td><div class="row-actions"><button class="btn btn-ghost btn-sm rl-edit" data-id="'+r.id+'">Edit</button><button class="btn btn-danger btn-sm rl-del" data-id="'+r.id+'">Delete</button></div></td></tr>';
      }).join('');
      html=(flagged>0?'<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'+flagged+' recipe'+(flagged>1?'s are':' is')+' above target cost.</div></div>':'')
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><button class="btn btn-ghost btn-sm" id="rl-sel-all">Select All</button><button class="btn btn-danger btn-sm" id="rl-del-sel" style="display:none;">Delete Selected</button><span id="rl-sel-count" style="font-size:11px;color:var(--t3);"></span></div>'
        +'<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr><th style="width:36px;"><input type="checkbox" id="rl-chk-all" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></th><th>Recipe</th><th>Category</th><th>Yield</th><th>Cost/Serving</th><th>Menu Price</th><th>Recipe Cost %</th><th>Target %</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }
    const rlModal='<div id="rl-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;"><div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;"><div id="rl-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this recipe?</div><div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-ghost" id="rl-del-cancel">Cancel</button><button class="btn btn-danger" id="rl-del-confirm">Delete</button></div></div></div>';
    this.container.innerHTML='<div class="screen">'+html+'<div id="rl-form"></div></div>'+rlModal;
    this.container.onclick=ev=>{
      if(ev.target.closest('.rl-edit'))this.editRecipe(ev.target.closest('.rl-edit').dataset.id);
      if(ev.target.closest('.rl-del'))this.del(ev.target.closest('.rl-del').dataset.id);
      if(ev.target.closest('#rl-add-first'))this.showModeSelector();
      if(ev.target.closest('#rl-cancel'))this.renderList();
      if(ev.target.closest('#rl-save'))this.saveRecipe();
      if(ev.target.closest('#rl-add-ing'))this.addRow();
      if(ev.target.closest('#rl-switch'))this.showModeSelector();
      if(ev.target.closest('.rl-rm-ing'))this.removeRow(parseInt(ev.target.closest('.rl-rm-ing').dataset.i));
      if(ev.target.closest('#rl-mode-single'))this.showForm('single');
      if(ev.target.closest('#rl-mode-batch'))this.showForm('batch');
      if(ev.target.closest('#rl-mode-food'))this.showForm('food');
      if(ev.target.closest('#rl-mode-cancel'))this.renderList();
    };

    const updateSel=()=>{
      const checked=this.container.querySelectorAll('.rl-chk:checked');
      const btn=document.getElementById('rl-del-sel');
      const cnt=document.getElementById('rl-sel-count');
      if(btn)btn.style.display=checked.length>0?'':'none';
      if(cnt)cnt.textContent=checked.length>0?checked.length+' selected':'';
    };
    document.getElementById('rl-chk-all')?.addEventListener('change',function(){
      document.querySelectorAll('.rl-chk').forEach(c=>{c.checked=this.checked;});
      updateSel();
    });
    this.container.addEventListener('change',ev=>{if(ev.target.classList.contains('rl-chk'))updateSel();});
    document.getElementById('rl-sel-all')?.addEventListener('click',()=>{
      const chks=document.querySelectorAll('.rl-chk');
      const allChecked=[...chks].every(c=>c.checked);
      chks.forEach(c=>{c.checked=!allChecked;});
      const ca=document.getElementById('rl-chk-all');if(ca)ca.checked=!allChecked;
      updateSel();
    });
    document.getElementById('rl-del-sel')?.addEventListener('click',()=>{
      const ids=[...document.querySelectorAll('.rl-chk:checked')].map(c=>c.dataset.id);
      if(!ids.length)return;
      this._pendingDelIds=ids;
      const modal=document.getElementById('rl-del-modal');
      const msgEl=document.getElementById('rl-del-msg');
      if(msgEl)msgEl.textContent='Delete '+ids.length+' recipe'+(ids.length>1?'s':'')+'?';
      if(modal)modal.style.display='flex';
      document.getElementById('rl-del-cancel').onclick=()=>{modal.style.display='none';this._pendingDelIds=null;};
      document.getElementById('rl-del-confirm').onclick=()=>{
        modal.style.display='none';
        const ids=this._pendingDelIds||[];
        App.data.recipes=(App.data.recipes||[]).filter(r=>!ids.includes(r.id));
        App.saveKey('recipes').then(()=>this.renderList());
        this._pendingDelIds=null;
      };
    });
    this.container.addEventListener('change',ev=>{
      if(ev.target.classList.contains('rl-ing-prod'))this.onProdChange(ev.target);
      if(['rl-menu-price','rl-target-pct','rl-batch-yield','rl-batch-yield-unit','rl-serving-size','rl-serving-size-unit','rl-plate-yield'].includes(ev.target.id))this.calc();
    });
    this.container.addEventListener('input',ev=>{
      if(ev.target.classList.contains('rl-ing-qty'))this.calc();
      if(['rl-menu-price','rl-target-pct','rl-batch-yield','rl-serving-size','rl-plate-yield'].includes(ev.target.id))this.calc();
    });
  },
  showModeSelector(){
    const fa=document.getElementById('rl-form');if(!fa)return;
    const card=(id,title,desc,eg)=>'<div class="rl-mode-card" id="'+id+'" style="cursor:pointer;background:var(--surface);border:1px solid var(--b1);border-radius:var(--r);padding:20px;transition:all 0.15s;flex:1;min-width:200px;display:flex;flex-direction:column;">'
      +'<div style="font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--w);margin-bottom:8px;">'+title+'</div>'
      +'<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:8px;">'+desc+'</div>'
      +'<div style="font-size:11px;color:var(--t3);font-style:italic;">'+eg+'</div></div>';
    fa.innerHTML='<div class="divider"></div><div class="sh">What are you costing out?</div>'
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;align-items:stretch;">'
      +card('rl-mode-single','Single Drink','Cost one cocktail made to order. Quantities in pours.','House Margarita, Old Fashioned, Espresso Martini')
      +card('rl-mode-batch','Batch Cocktail','Cost a large recipe made in advance. Spirits + mixers. Enter yield and serving size.','Frozen Margarita Mix (1 gal), Sangria Batch, Punch Bowl')
      +card('rl-mode-food','Food Plate','Cost a food dish from kitchen ingredients.','Chicken Wings, Burger, Nachos')
      +'</div><button class="btn btn-ghost btn-sm" id="rl-mode-cancel">Cancel</button>';
    fa.querySelectorAll('.rl-mode-card').forEach(card=>{
      card.addEventListener('mouseenter',()=>{card.style.borderColor='var(--gold)';card.style.background='rgba(201,168,76,0.04)';});
      card.addEventListener('mouseleave',()=>{card.style.borderColor='var(--b1)';card.style.background='var(--surface)';});
    });
  },
  editRecipe(id){const r=(App.data.recipes||[]).find(r=>r.id===id);if(r)this.showForm(r.mode||'single',id);},
  showForm(mode,id){
    this.mode=mode;this.editId=id||null;
    const r=id?(App.data.recipes||[]).find(r=>r.id===id):null;
    const target=App.data.settings.targets?.bar_pour_cost_pct??22;
    const fa=document.getElementById('rl-form');if(!fa)return;
    this.rows=r?.ingredients?r.ingredients.map(i=>({...i})):[{product_id:'',quantity:'',cost_per_unit:0,total_cost:0}];
    const mL={single:'Single Drink',batch:'Batch Cocktail',food:'Food Plate'};
    const catOpts=(mode==='food'?['Food Plate','Appetizer','Entree','Dessert','Side','Other']:['Cocktail','Shot','Beer','Wine','Non-Alcoholic','Other']).map(c=>'<option'+(r?.category===c?' selected':'')+'>'+c+'</option>').join('');

    const yieldExtra = mode==='batch'
      ?'<div class="form-row" style="margin-bottom:12px;gap:16px;">'
        +'<div class="f" style="width:200px;flex-shrink:0;"><label>Batch Yield '+tt('batch-yield')+'</label><div class="fj"><input type="number" id="rl-batch-yield" value="'+(r?.batch_yield||'')+'" placeholder="e.g. 1" /><select id="rl-batch-yield-unit">'+this.yOpts(r?.batch_yield_unit)+'</select></div></div>'
        +'<div class="f" style="width:200px;flex-shrink:0;"><label>Serving Size '+tt('serving-size')+'</label><div class="fj"><input type="number" id="rl-serving-size" value="'+(r?.serving_size||'')+'" placeholder="e.g. 5" /><select id="rl-serving-size-unit">'+this.yOpts(r?.serving_size_unit)+'</select></div></div>'
        +'<div class="f" style="width:140px;flex-shrink:0;"><label>Servings Per Batch '+tt('servings-batch')+'</label><div class="f-display" id="rl-spb">—</div></div>'
        +'</div>'
      : mode==='food'
      ? '' // plate yield is inline in main form row
      : '';

    // For food mode, plate yield goes in the same row as other fields
    const plateYieldField = mode==='food'
      ? '<div class="f" style="width:120px;flex-shrink:0;"><label>Plates Per Batch '+tt('plate-yield')+'</label><input type="number" id="rl-plate-yield" value="'+(r?.plate_yield||1)+'" min="1" /></div>'
      : '';

    fa.innerHTML='<div class="divider"></div>'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
      +'<div class="sh" style="margin-bottom:0;">'+(id?'Edit':'New')+' — '+mL[mode]+'</div>'
      +(!id?'<button class="btn btn-ghost btn-sm" id="rl-switch" style="padding:3px 8px;font-size:9px;">Change Type</button>':'')
      +'</div>'
      +'<div class="card"><div class="form-row" style="gap:16px;">'
      +'<div class="f w-lg"><label>Recipe Name</label><input type="text" id="rl-name" value="'+esc(r?.name||'')+'" /></div>'
      +'<div class="f w-md"><label>Category</label><select id="rl-category">'+catOpts+'</select></div>'
      +'<div class="f" style="width:120px;flex-shrink:0;"><label>Menu Price '+tt('menu-price')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rl-menu-price" value="'+(r?.menu_price||'')+'" step="0.25" /></div></div>'
      +'<div class="f" style="width:120px;flex-shrink:0;"><label>Target Cost % '+tt('recipe-cost-pct')+'</label><div class="fw"><input class="suf" type="number" id="rl-target-pct" value="'+(r?.target_cost_pct||target)+'" step="0.5" /><span class="suf">%</span></div></div>'
      + plateYieldField
      +'</div>'
      + yieldExtra
      +'<div class="sh" style="margin-top:4px;">'+(mode==='food'?'Kitchen':'Bar')+' Ingredients</div>'
      +'<div id="rl-ings" style="margin-bottom:12px;"></div>'
      +'<button class="btn btn-ghost btn-sm" id="rl-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
      +'<div class="calc" style="margin-bottom:0;">'
      +'<div class="calc-item"><div class="calc-label">Total Ingredient Cost</div><div class="calc-val" id="rl-tc">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="rl-cps">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Recipe Cost %</div><div class="calc-val" id="rl-cpct">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim" id="rl-tgt-d">—</div></div>'
      +'</div>'
      +'<div class="card-actions">'
      +'<button class="btn btn-ghost" id="rl-cancel">Cancel</button>'
      +'<button class="btn btn-primary" id="rl-save">'+(id?'Update':'Save')+'</button>'
      +'<span id="rl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      +'</div></div>';
    this.renderRows();this.calc();document.getElementById('rl-name')?.focus();
  },
  renderRows(){
    const area=document.getElementById('rl-ings');if(!area)return;
    const mode=this.mode;
    const qHead=mode==='single'?'Pours '+tt('recipe-pours'):mode==='batch'?'Qty '+tt('recipe-bottles'):'Qty';
    area.innerHTML='<div class="card" style="padding:0;overflow:hidden;">'
      +'<table class="ing-tbl"><thead><tr><th>Ingredient</th><th>'+qHead+'</th><th>Unit</th><th>'+(mode==='single'?'Cost/Pour':'Unit Cost')+'</th><th>Line Cost</th><th></th></tr></thead>'
      +'<tbody>'+this.rows.map((ing,idx)=>{
        const prod=ing.product_id?this.prodsForMode(mode).find(p=>p.id===ing.product_id):null;
        const unit=this.unitLabel(prod,mode);
        const cost=this.costBasis(prod,mode);
        const costD=cost>0?App.fmtCurrency(cost):(prod?'<span style="color:var(--red);font-size:10px;">Add cost</span>':'—');
        const lineD=ing.total_cost>0?App.fmtCurrency(ing.total_cost):'—';
        return '<tr><td style="min-width:180px;"><select class="form-input rl-ing-prod" data-i="'+idx+'" style="width:100%;">'+this.prodOpts(mode,ing.product_id)+'</select></td>'
          +'<td style="width:90px;"><input class="form-input rl-ing-qty" type="number" data-i="'+idx+'" value="'+(ing.quantity||'')+'" min="0" step="0.25" style="width:100%;padding:6px 8px;" /></td>'
          +'<td style="width:70px;color:var(--t2);font-size:12px;">'+unit+'</td>'
          +'<td style="width:90px;font-size:12px;">'+costD+'</td>'
          +'<td style="width:90px;" class="val" id="rl-lc-'+idx+'">'+lineD+'</td>'
          +'<td style="width:36px;"><button class="btn btn-danger btn-sm rl-rm-ing" data-i="'+idx+'" style="padding:4px 8px;">×</button></td></tr>';
      }).join('')+'</tbody></table></div>';
  },
  onProdChange(sel){
    const idx=parseInt(sel.dataset.i);const prod=sel.value?this.prodsForMode(this.mode).find(p=>p.id===sel.value):null;
    this.rows[idx].product_id=sel.value;this.rows[idx].cost_per_unit=this.costBasis(prod,this.mode);this.rows[idx].total_cost=0;
    this.renderRows();this.calc();
  },
  addRow(){this.rows.push({product_id:'',quantity:'',cost_per_unit:0,total_cost:0});this.renderRows();},
  removeRow(idx){this.rows.splice(idx,1);this.renderRows();this.calc();},
  calc(){
    const mode=this.mode;
    document.querySelectorAll('.rl-ing-qty').forEach(el=>{
      const idx=parseInt(el.dataset.i);if(!this.rows[idx])return;
      const qty=parseFloat(el.value)||0;this.rows[idx].quantity=qty;this.rows[idx].total_cost=qty*(this.rows[idx].cost_per_unit||0);
      const le=document.getElementById('rl-lc-'+idx);if(le)le.textContent=this.rows[idx].total_cost>0?App.fmtCurrency(this.rows[idx].total_cost):'—';
    });
    const tc=this.rows.reduce((s,i)=>s+(i.total_cost||0),0);
    const mp=parseFloat(document.getElementById('rl-menu-price')?.value)||0;
    const tpct=parseFloat(document.getElementById('rl-target-pct')?.value)||22;
    let cps=tc;
    if(mode==='batch'){
      const by=parseFloat(document.getElementById('rl-batch-yield')?.value)||0;
      const bu=document.getElementById('rl-batch-yield-unit')?.value||'oz';
      const ss=parseFloat(document.getElementById('rl-serving-size')?.value)||0;
      const su=document.getElementById('rl-serving-size-unit')?.value||'oz';
      const spb=by>0&&ss>0?this.toOz(by,bu)/this.toOz(ss,su):null;
      const spbEl=document.getElementById('rl-spb');if(spbEl)spbEl.textContent=spb!=null?spb.toFixed(1)+' drinks':'—';
      cps=spb&&spb>0?tc/spb:tc;
    } else if(mode==='food'){
      const py=parseFloat(document.getElementById('rl-plate-yield')?.value)||1;cps=py>0?tc/py:tc;
    }
    const cpct=mp>0?(cps/mp*100):null;
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val;el.className='calc-val'+(cls?' '+cls:'');};
    set('rl-tc',tc>0?App.fmtCurrency(tc):'—');set('rl-cps',cps>0?App.fmtCurrency(cps):'—');
    set('rl-cpct',cpct!=null?App.fmtPct(cpct):'—',cpct!=null?(cpct>tpct?'warn':'good'):'');
    set('rl-tgt-d',App.fmtPct(tpct));
  },
  saveRecipe(){
    if(this._saving)return;
    this._saving=true;
    setTimeout(()=>{this._saving=false;},2000);
    const name=document.getElementById('rl-name')?.value.trim();const err=document.getElementById('rl-err');
    if(!name){if(err){err.textContent='Recipe name required.';err.style.display='inline';}return;}
    const mode=this.mode,mp=parseFloat(document.getElementById('rl-menu-price')?.value)||0,tpct=parseFloat(document.getElementById('rl-target-pct')?.value)||22;
    document.querySelectorAll('.rl-ing-qty').forEach(el=>{const idx=parseInt(el.dataset.i);if(this.rows[idx]){this.rows[idx].quantity=parseFloat(el.value)||0;this.rows[idx].total_cost=this.rows[idx].quantity*(this.rows[idx].cost_per_unit||0);}});
    const tc=this.rows.reduce((s,i)=>s+(i.total_cost||0),0);
    let cps=tc,by=null,bu=null,ss=null,su=null,spb=null,py=null;
    if(mode==='batch'){by=parseFloat(document.getElementById('rl-batch-yield')?.value)||0;bu=document.getElementById('rl-batch-yield-unit')?.value||'oz';ss=parseFloat(document.getElementById('rl-serving-size')?.value)||0;su=document.getElementById('rl-serving-size-unit')?.value||'oz';spb=by>0&&ss>0?this.toOz(by,bu)/this.toOz(ss,su):null;cps=spb&&spb>0?tc/spb:tc;}
    else if(mode==='food'){py=parseFloat(document.getElementById('rl-plate-yield')?.value)||1;cps=py>0?tc/py:tc;}
    const cpct=mp>0?(cps/mp*100):null;
    const recipe={id:this.editId||App.uid(),name,mode,category:document.getElementById('rl-category')?.value,menu_price:mp,target_cost_pct:tpct,ingredients:this.rows.filter(i=>i.product_id&&i.quantity>0),total_cost:tc,cost_per_serving:cps,cost_pct:cpct,flagged:cpct!=null?cpct>tpct:false,batch_yield:by,batch_yield_unit:bu,serving_size:ss,serving_size_unit:su,servings_per_batch:spb,plate_yield:py,updated_at:new Date().toISOString(),created_at:this.editId?undefined:new Date().toISOString()};
    if(!App.data.recipes)App.data.recipes=[];
    if(this.editId){const i=App.data.recipes.findIndex(r=>r.id===this.editId);if(i>-1)App.data.recipes[i]={...App.data.recipes[i],...recipe};}
    else App.data.recipes.push(recipe);
    App.saveKey('recipes').then(()=>{this.editId=null;this.rows=[];this.mode=null;this.renderList();});
  },
  del(id){this._pendingDelIds=[id];const modal=document.getElementById('rl-del-modal');const msgEl=document.getElementById('rl-del-msg');if(msgEl)msgEl.textContent='Delete this recipe?';if(modal)modal.style.display='flex';document.getElementById('rl-del-cancel').onclick=()=>{modal.style.display='none';this._pendingDelIds=null;};document.getElementById('rl-del-confirm').onclick=()=>{modal.style.display='none';const ids=this._pendingDelIds||[];App.data.recipes=(App.data.recipes||[]).filter(r=>!ids.includes(r.id));App.saveKey('recipes').then(()=>this.renderList());this._pendingDelIds=null;};}
};
