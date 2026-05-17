'use strict';
S.KitchenProducts = {
  editId: null,
  render(container, actions) {
    this.container=container;
    const btn=document.createElement('button');btn.className='btn btn-primary btn-sm';btn.textContent='Add Product';
    btn.addEventListener('click',()=>this.showForm());actions.appendChild(btn);this.renderList();
  },
  renderList() {
    const prods=App.data.kitchen_products||[];
    let html='';
    if(prods.length===0){html='<div class="empty"><div class="empty-title">No kitchen products yet</div><div class="empty-sub">Add food ingredients and bar mixers — syrups, juices, powders — here.</div><button class="btn btn-primary" id="kp-add-first">Add Product</button></div>';}
    else {
      const rows=prods.map(p=>'<tr><td class="val">'+esc(p.name)+'</td><td>'+esc(p.category||'—')+'</td><td>'+esc(p.unit||'—')+'</td><td>'+App.fmtCurrency(p.cost_per_unit)+'</td><td>'+esc(p.vendor||'—')+'</td><td><div class="row-actions"><button class="btn btn-ghost btn-sm kp-edit" data-id="'+p.id+'">Edit</button><button class="btn btn-danger btn-sm kp-del" data-id="'+p.id+'">Delete</button></div></td></tr>').join('');
      html='<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Unit Cost</th><th>Vendor</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }
    this.container.innerHTML='<div class="screen">'+html+'<div id="kp-form"></div></div>';
    this.container.onclick=ev=>{
      if(ev.target.closest('.kp-edit'))this.showForm(ev.target.closest('.kp-edit').dataset.id);
      if(ev.target.closest('.kp-del'))this.del(ev.target.closest('.kp-del').dataset.id);
      if(ev.target.closest('#kp-add-first'))this.showForm();
      if(ev.target.closest('#kp-cancel'))this.renderList();
      if(ev.target.closest('#kp-save'))this.save();
    };
  },
  showForm(id) {
    this.editId=id||null;
    const p=id?(App.data.kitchen_products||[]).find(p=>p.id===id):null;
    const fa=document.getElementById('kp-form');if(!fa)return;
    fa.innerHTML='<div class="divider"></div><div class="card"><div class="card-title">'+(id?'Edit':'New')+' Kitchen Product</div>'
      +'<div class="form-row">'
      +'<div class="f w-lg"><label>Product Name</label><input type="text" id="kp-name" value="'+esc(p?.name||'')+'" placeholder="Chicken Breast" /></div>'
      +'<div class="f w-md"><label>Category</label><select id="kp-cat">'+['Protein','Produce','Dairy','Dry Goods','Frozen','Mixer/Supply','Other'].map(c=>'<option'+(p?.category===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div>'
      +'<div class="f w-md"><label>Vendor</label><input type="text" id="kp-vendor" value="'+esc(p?.vendor||'')+'" placeholder="Sysco" /></div>'
      +'<div class="f" style="width:90px;flex-shrink:0;"><label>Unit '+tt('kitchen-unit')+'</label><input type="text" id="kp-unit" value="'+esc(p?.unit||'')+'" placeholder="lb, bag, each" /></div>'
      +'<div class="f" style="width:90px;flex-shrink:0;"><label>Unit Cost '+tt('kitchen-cost')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="kp-cost" value="'+(p?.cost_per_unit||'')+'" step="0.01" placeholder="0.00"/></div></div>'
      +'</div>'
      +'<div class="card-actions"><button class="btn btn-ghost" id="kp-cancel">Cancel</button><button class="btn btn-primary" id="kp-save">'+(id?'Update':'Save')+'</button><span id="kp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      +'</div>';
    document.getElementById('kp-name')?.focus();
  },
  save(){
    const name=document.getElementById('kp-name')?.value.trim();
    const err=document.getElementById('kp-err');
    if(!name){if(err){err.textContent='Name required.';err.style.display='inline';}return;}
    const prod={id:this.editId||App.uid(),name,category:document.getElementById('kp-cat')?.value,vendor:document.getElementById('kp-vendor')?.value.trim(),unit:document.getElementById('kp-unit')?.value.trim(),cost_per_unit:parseFloat(document.getElementById('kp-cost')?.value)||0,created_at:this.editId?undefined:new Date().toISOString()};
    if(!App.data.kitchen_products)App.data.kitchen_products=[];
    if(this.editId){const i=App.data.kitchen_products.findIndex(p=>p.id===this.editId);if(i>-1)App.data.kitchen_products[i]={...App.data.kitchen_products[i],...prod};}
    else App.data.kitchen_products.push(prod);
    App.saveKey('kitchen_products').then(()=>{this.editId=null;this.renderList();});
  },
  del(id){
    if(!confirm('Delete this product?'))return;
    App.data.kitchen_products=(App.data.kitchen_products||[]).filter(p=>p.id!==id);
    App.saveKey('kitchen_products').then(()=>this.renderList());
  }
};
