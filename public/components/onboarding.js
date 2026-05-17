'use strict';
const Onboarding={
  SIZES:[
    {g:'Spirits',l:'50ml (1.7 oz)',oz:1.7},{g:'Spirits',l:'200ml (6.8 oz)',oz:6.8},
    {g:'Spirits',l:'375ml (12.7 oz)',oz:12.7},{g:'Spirits',l:'750ml (25.4 oz)',oz:25.4},
    {g:'Spirits',l:'1L (33.8 oz)',oz:33.8},{g:'Spirits',l:'1.75L (59.2 oz)',oz:59.2},
    {g:'Wine',l:'187ml (6.3 oz)',oz:6.3},{g:'Wine',l:'375ml (12.7 oz)',oz:12.7},
    {g:'Wine',l:'750ml (25.4 oz)',oz:25.4},{g:'Wine',l:'1.5L (50.7 oz)',oz:50.7},
    {g:'Beer',l:'12 oz',oz:12},{g:'Beer',l:'16 oz',oz:16},{g:'Beer',l:'22 oz bomber',oz:22},
    {g:'Beer',l:'32 oz crowler',oz:32},{g:'Beer',l:'40 oz',oz:40},
    {g:'Draft Keg',l:'1/6 keg (661 oz)',oz:661},{g:'Draft Keg',l:'1/4 keg (992 oz)',oz:992},
    {g:'Draft Keg',l:'1/2 keg (1984 oz)',oz:1984},{g:'Other',l:'Custom (enter oz)',oz:null}
  ],
  sizeOpts(){
    let g='',h='<option value="">Select size...</option>';
    this.SIZES.forEach(s=>{if(s.g!==g){if(g)h+='</optgroup>';h+='<optgroup label="'+s.g+'">';g=s.g;}const v=s.oz!==null?s.oz:'custom';h+='<option value="'+v+'">'+s.l+'</option>';});
    if(g)h+='</optgroup>';return h;
  },
  start(){
    document.getElementById('ob-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.renderStep();
  },
  renderStep(){
    const s=App.data.settings;
    document.getElementById('ob-content').innerHTML=
      '<div class="ob-pips"><div class="ob-pip on"></div><div class="ob-pip"></div></div>'
      +'<div class="ob-heading">Welcome to Bar Cop Profit Fix</div>'
      +'<div class="ob-sub">Tell us about your bar to get started. You can update all of this later in Settings.</div>'
      +'<div class="form-row">'
      +'<div class="f w-lg"><label>Bar Name</label><input type="text" id="ob-name" value="'+esc(s.bar_name||'')+'" placeholder="The Rusty Nail" /></div>'
      +'<div class="f w-md"><label>City, State</label><input type="text" id="ob-city" value="'+esc(s.city_state||'')+'" placeholder="Austin, TX" /></div>'
      +'</div>'
      +'<div class="form-row">'
      +'<div class="f w-lg"><label>Annual Bar Revenue (Estimate)</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-brev" value="'+(s.annual_bar_revenue||'')+'" placeholder="0" /></div></div>'
      +'<div class="f w-lg"><label>Annual Food Revenue (Estimate)</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-frev" value="'+(s.annual_food_revenue||'')+'" placeholder="0 — skip if bar only" /></div></div>'
      +'</div>'
      +'<div id="ob-err" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none;"></div>'
      +'<div class="ob-actions"><button class="btn btn-primary btn-lg" id="ob-next1">Next →</button></div>';

    document.getElementById('ob-next1')?.addEventListener('click',()=>{
      const name=document.getElementById('ob-name')?.value.trim();
      if(!name){const e=document.getElementById('ob-err');if(e){e.textContent='Bar name is required.';e.style.display='block';}return;}
      App.data.settings.bar_name=name;
      App.data.settings.city_state=document.getElementById('ob-city')?.value.trim();
      App.data.settings.annual_bar_revenue=parseFloat(document.getElementById('ob-brev')?.value)||0;
      App.data.settings.annual_food_revenue=parseFloat(document.getElementById('ob-frev')?.value)||0;
      App.saveKey('settings').then(()=>this.renderTargets());
    });
    document.getElementById('ob-name')?.focus();
  },
  renderTargets(){
    const t=App.data.settings.targets||{};
    document.getElementById('ob-content').innerHTML=
      '<div class="ob-pips"><div class="ob-pip done"></div><div class="ob-pip on"></div></div>'
      +'<div class="ob-heading">Your Cost Targets</div>'
      +'<div class="ob-sub">Industry benchmarks are filled in. Adjust to match your operation — you can always update these in Settings.</div>'
      +'<div class="form-row">'
      +'<div class="f w-sm"><label>Bar Pour Cost %</label><div class="fw"><input class="suf" type="number" id="ob-bpc" value="'+(t.bar_pour_cost_pct??22)+'" step="0.1"/><span class="suf">%</span></div></div>'
      +'<div class="f w-sm"><label>Food Cost %</label><div class="fw"><input class="suf" type="number" id="ob-fc" value="'+(t.food_cost_pct??32)+'" step="0.1"/><span class="suf">%</span></div></div>'
      +'<div class="f w-sm"><label>Bar Labor %</label><div class="fw"><input class="suf" type="number" id="ob-bl" value="'+(t.bar_labor_cost_pct??28)+'" step="0.1"/><span class="suf">%</span></div></div>'
      +'<div class="f w-sm"><label>Food Labor %</label><div class="fw"><input class="suf" type="number" id="ob-fl" value="'+(t.food_labor_cost_pct??30)+'" step="0.1"/><span class="suf">%</span></div></div>'
      +'<div class="f w-sm"><label>Prime Cost %</label><div class="fw"><input class="suf" type="number" id="ob-pc" value="'+(t.prime_cost_pct??60)+'" step="0.1"/><span class="suf">%</span></div></div>'
      +'<div class="f w-sm"><label>Cash Tolerance</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-ct" value="'+(App.data.settings.cash_tolerance??10)+'"/></div></div>'
      +'</div>'
      +'<div class="ob-actions">'
      +'<button class="btn btn-ghost" id="ob-back">← Back</button>'
      +'<button class="btn btn-primary btn-lg" id="ob-finish">Open Dashboard</button>'
      +'</div>';

    document.getElementById('ob-back')?.addEventListener('click',()=>this.renderStep());
    document.getElementById('ob-finish')?.addEventListener('click',()=>{
      App.data.settings.targets={
        bar_pour_cost_pct:parseFloat(document.getElementById('ob-bpc')?.value)||22,
        food_cost_pct:parseFloat(document.getElementById('ob-fc')?.value)||32,
        bar_labor_cost_pct:parseFloat(document.getElementById('ob-bl')?.value)||28,
        food_labor_cost_pct:parseFloat(document.getElementById('ob-fl')?.value)||30,
        prime_cost_pct:parseFloat(document.getElementById('ob-pc')?.value)||60
      };
      App.data.settings.cash_tolerance=parseFloat(document.getElementById('ob-ct')?.value)||10;
      App.data.settings.onboarding_complete=true;
      App.saveKey('settings').then(()=>{App.showApp();App.navigate('dashboard');});
    });
  }
};
