'use strict';
S.Settings={
  render(container,actions){
    const s=App.data.settings;const t=s.targets||{};
    const btn=document.createElement('button');btn.className='btn btn-primary btn-sm';btn.textContent='Save';
    btn.addEventListener('click',()=>this.save());actions.appendChild(btn);
    container.innerHTML='<div class="screen">'
      +'<div class="settings-section"><div class="settings-title">Your Bar</div>'
      +'<div class="card"><div class="form-row">'
      +'<div class="f w-lg"><label>Bar Name</label><input type="text" id="s-name" value="'+esc(s.bar_name||'')+'" placeholder="The Rusty Nail" /></div>'
      +'<div class="f w-md"><label>City, State</label><input type="text" id="s-city" value="'+esc(s.city_state||'')+'" placeholder="Austin, TX" /></div>'
      +'<div class="f w-md"><label>Annual Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="s-brev" value="'+(s.annual_bar_revenue||'')+'" placeholder="0" /></div></div>'
      +'<div class="f w-md"><label>Annual Food Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="s-frev" value="'+(s.annual_food_revenue||'')+'" placeholder="0" /></div></div>'
      +'</div></div></div>'
      +'<div class="settings-section"><div class="settings-title">Cost Targets</div>'
      +'<div class="card"><div class="form-row" style="gap:16px 20px;">'
      +'<div class="f" style="width:130px;"><label>Bar Pour Cost %</label><div class="fw"><input class="suf" type="number" id="s-bpc" value="'+(t.bar_pour_cost_pct??22)+'" step="0.1" /><span class="suf">%</span></div></div>'
      +'<div class="f" style="width:130px;"><label>Food Cost %</label><div class="fw"><input class="suf" type="number" id="s-fc" value="'+(t.food_cost_pct??32)+'" step="0.1" /><span class="suf">%</span></div></div>'
      +'<div class="f" style="width:130px;"><label>Bar Labor %</label><div class="fw"><input class="suf" type="number" id="s-bl" value="'+(t.bar_labor_cost_pct??28)+'" step="0.1" /><span class="suf">%</span></div></div>'
      +'<div class="f" style="width:130px;"><label>Food Labor %</label><div class="fw"><input class="suf" type="number" id="s-fl" value="'+(t.food_labor_cost_pct??30)+'" step="0.1" /><span class="suf">%</span></div></div>'
      +'<div class="f" style="width:130px;"><label>Prime Cost %</label><div class="fw"><input class="suf" type="number" id="s-pc" value="'+(t.prime_cost_pct??60)+'" step="0.1" /><span class="suf">%</span></div></div>'
      +'<div class="f" style="width:130px;"><label>Cash Tolerance</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="s-ct" value="'+(s.cash_tolerance??10)+'" /></div></div>'
      +'</div></div></div>'
      +'<div id="s-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;">Settings saved.</div>'
      +'</div>';
  },
  save(){
    const s=App.data.settings;
    s.bar_name=document.getElementById('s-name')?.value.trim();
    s.city_state=document.getElementById('s-city')?.value.trim();
    s.annual_bar_revenue=parseFloat(document.getElementById('s-brev')?.value)||0;
    s.annual_food_revenue=parseFloat(document.getElementById('s-frev')?.value)||0;
    s.targets={bar_pour_cost_pct:parseFloat(document.getElementById('s-bpc')?.value)||22,food_cost_pct:parseFloat(document.getElementById('s-fc')?.value)||32,bar_labor_cost_pct:parseFloat(document.getElementById('s-bl')?.value)||28,food_labor_cost_pct:parseFloat(document.getElementById('s-fl')?.value)||30,prime_cost_pct:parseFloat(document.getElementById('s-pc')?.value)||60};
    s.cash_tolerance=parseFloat(document.getElementById('s-ct')?.value)||10;
    App.saveKey('settings').then(()=>{const m=document.getElementById('s-msg');if(m){m.style.display='block';setTimeout(()=>m.style.display='none',2500);}App.updatePeriod();});
  }
};
