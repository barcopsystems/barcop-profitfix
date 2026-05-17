'use strict';
S.Settings = {
  render(container, actions) {
    const s = App.data.settings;
    const t = s.targets || {};
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Save';
    btn.addEventListener('click', () => this.save());
    actions.appendChild(btn);

    container.innerHTML = '<div class="screen">'
      + '<div class="settings-section"><div class="settings-title">Your Bar</div>'
      + '<div class="card"><div class="form-row">'
      + '<div class="f w-lg"><label>Bar Name</label><input type="text" id="s-name" value="' + esc(s.bar_name || '') + '" placeholder="The Rusty Nail" /></div>'
      + '<div class="f w-md"><label>City, State</label><input type="text" id="s-city" value="' + esc(s.city_state || '') + '" placeholder="Austin, TX" /></div>'
      + '<div class="f w-md"><label>Annual Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="s-brev" value="' + (s.annual_bar_revenue || '') + '" placeholder="0" /></div></div>'
      + '<div class="f w-md"><label>Annual Food Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="s-frev" value="' + (s.annual_food_revenue || '') + '" placeholder="0" /></div></div>'
      + '</div></div></div>'
      + '<div class="settings-section"><div class="settings-title">Cost Targets</div>'
      + '<div class="card"><div class="form-row" style="gap:16px 20px;">'
      + '<div class="f" style="width:130px;"><label>Bar Pour Cost %</label><div class="fw"><input class="suf" type="number" id="s-bpc" value="' + (t.bar_pour_cost_pct ?? 22) + '" step="0.1" /><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Cost %</label><div class="fw"><input class="suf" type="number" id="s-fc" value="' + (t.food_cost_pct ?? 32) + '" step="0.1" /><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Bar Labor %</label><div class="fw"><input class="suf" type="number" id="s-bl" value="' + (t.bar_labor_cost_pct ?? 28) + '" step="0.1" /><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Labor %</label><div class="fw"><input class="suf" type="number" id="s-fl" value="' + (t.food_labor_cost_pct ?? 30) + '" step="0.1" /><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Prime Cost %</label><div class="fw"><input class="suf" type="number" id="s-pc" value="' + (t.prime_cost_pct ?? 60) + '" step="0.1" /><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Cash Tolerance</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="s-ct" value="' + (s.cash_tolerance ?? 10) + '" /></div></div>'
      + '</div></div></div>'
      + '<div class="settings-section"><div class="settings-title">Account</div>'
      + '<div class="card">'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>New Password</label><input type="password" id="s-pw1" placeholder="Enter new password" autocomplete="new-password" /></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Confirm Password</label><input type="password" id="s-pw2" placeholder="Confirm new password" autocomplete="new-password" /></div>'
      + '<div style="display:flex;align-items:flex-end;padding-bottom:1px;"><button class="btn btn-ghost" id="s-pw-btn">Update Password</button></div>'
      + '</div>'
      + '<div id="s-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>'
      + '</div></div>'
      + '<div class="settings-section"><div class="settings-title">Testing Tools</div>'
      + '<div class="card">'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Load realistic sample data across every section of the app to test calculations and screen layouts. Clear all data to wipe everything and start fresh with your real numbers.</div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-ghost" id="s-load-sample">Load Sample Data</button>'
      + '<button class="btn btn-danger" id="s-clear-all">Clear All Data</button>'
      + '</div>'
      + '<div id="s-test-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>'
      + '</div></div>'
      + '<div id="s-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;">Settings saved.</div>'
      + '</div>';

    document.getElementById('s-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('s-load-sample')?.addEventListener('click', () => this.loadSample());
    document.getElementById('s-clear-all')?.addEventListener('click',  () => this.clearAll());
  },

  save() {
    const s = App.data.settings;
    s.bar_name             = document.getElementById('s-name')?.value.trim();
    s.city_state           = document.getElementById('s-city')?.value.trim();
    s.annual_bar_revenue   = parseFloat(document.getElementById('s-brev')?.value) || 0;
    s.annual_food_revenue  = parseFloat(document.getElementById('s-frev')?.value) || 0;
    s.targets = {
      bar_pour_cost_pct:  parseFloat(document.getElementById('s-bpc')?.value)  || 22,
      food_cost_pct:      parseFloat(document.getElementById('s-fc')?.value)   || 32,
      bar_labor_cost_pct: parseFloat(document.getElementById('s-bl')?.value)   || 28,
      food_labor_cost_pct:parseFloat(document.getElementById('s-fl')?.value)   || 30,
      prime_cost_pct:     parseFloat(document.getElementById('s-pc')?.value)   || 60
    };
    s.cash_tolerance = parseFloat(document.getElementById('s-ct')?.value) || 10;
    App.saveKey('settings').then(() => {
      const m = document.getElementById('s-msg');
      if (m) { m.style.display = 'block'; setTimeout(() => m.style.display = 'none', 2500); }
      App.updatePeriod();
    });
  },

  async changePassword() {
    const pw1=document.getElementById('s-pw1')?.value;
    const pw2=document.getElementById('s-pw2')?.value;
    const msg=document.getElementById('s-pw-msg');
    if(!pw1||pw1.length<8){if(msg){msg.style.color='var(--red)';msg.textContent='Password must be at least 8 characters.';msg.style.display='block';}return;}
    if(pw1!==pw2){if(msg){msg.style.color='var(--red)';msg.textContent='Passwords do not match.';msg.style.display='block';}return;}
    const btn=document.getElementById('s-pw-btn');
    if(btn){btn.disabled=true;btn.textContent='Updating...';}
    try{
      if(!DB._sb){throw new Error('Not connected to database.');}
      const{error}=await DB._sb.auth.updateUser({password:pw1});
      if(error)throw error;
      if(msg){msg.style.color='var(--gold)';msg.textContent='Password updated successfully.';msg.style.display='block';}
      document.getElementById('s-pw1').value='';
      document.getElementById('s-pw2').value='';
    }catch(e){
      if(msg){msg.style.color='var(--red)';msg.textContent='Error: '+(e.message||'Could not update password.');msg.style.display='block';}
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Update Password';}
    }
  },

  async loadSample() {
    const msg = document.getElementById('s-test-msg');
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = 'Loading sample data...'; msg.style.display = 'block'; }

    const uid = () => App.uid();
    const today = new Date();
    const dateStr = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0,10); };

    // ── Settings ──
    App.data.settings.bar_name           = 'The Anchor Bar & Kitchen';
    App.data.settings.city_state         = 'Austin, TX';
    App.data.settings.annual_bar_revenue = 624000;
    App.data.settings.annual_food_revenue= 374400;
    App.data.settings.targets = { bar_pour_cost_pct:22, food_cost_pct:32, bar_labor_cost_pct:28, food_labor_cost_pct:30, prime_cost_pct:60 };
    App.data.settings.cash_tolerance     = 10;
    App.data.settings.onboarding_complete= true;

    // ── Bar Products ──
    const bp = [
      { id:uid(), name:"Tito's Handmade Vodka",    category:'Spirits',      vendor:'Republic National', bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:14.99, menu_price:9.00  },
      { id:uid(), name:"Espolòn Tequila Blanco",   category:'Spirits',      vendor:'Republic National', bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:17.49, menu_price:10.00 },
      { id:uid(), name:"Hendrick's Gin",            category:'Spirits',      vendor:'RNDC',              bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:24.99, menu_price:12.00 },
      { id:uid(), name:"Jack Daniel's Old No. 7",   category:'Spirits',      vendor:'Republic National', bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:16.99, menu_price:9.00  },
      { id:uid(), name:"Bacardi Superior Rum",      category:'Spirits',      vendor:'RNDC',              bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:11.99, menu_price:8.00  },
      { id:uid(), name:"Bud Light",                 category:'Beer - Bottle',vendor:'Glazer\'s',         bottle_size_oz:12,   std_pour_oz:12,  cost_per_unit:1.10,  menu_price:4.00  },
      { id:uid(), name:"Modelo Especial",           category:'Beer - Bottle',vendor:'Glazer\'s',         bottle_size_oz:12,   std_pour_oz:12,  cost_per_unit:1.35,  menu_price:5.00  },
      { id:uid(), name:"Austin Beerworks IPA",      category:'Beer - Draft', vendor:'Austin Beerworks',  bottle_size_oz:661,  std_pour_oz:16,  cost_per_unit:85.00, menu_price:6.00  },
      { id:uid(), name:"Kim Crawford Sauvignon Blanc",category:'Wine',       vendor:'RNDC',              bottle_size_oz:25.4, std_pour_oz:5,   cost_per_unit:12.99, menu_price:9.00  },
      { id:uid(), name:"Well Whiskey",              category:'Spirits',      vendor:'Republic National', bottle_size_oz:33.8, std_pour_oz:1.5, cost_per_unit:9.99,  menu_price:7.00  },
    ].map(p => {
      const pours = p.bottle_size_oz / p.std_pour_oz;
      const cpp   = p.cost_per_unit / pours;
      const pct   = cpp / p.menu_price * 100;
      return { ...p, pours_per_bottle: pours, cost_per_pour: cpp, pour_cost_pct: pct, created_at: new Date().toISOString() };
    });
    App.data.bar_products = bp;

    // ── Kitchen Products ──
    const kp = [
      { id:uid(), name:'Chicken Breast',      category:'Protein',    vendor:'Sysco',  unit:'lb',   cost_per_unit:3.20 },
      { id:uid(), name:'Beef Brisket',        category:'Protein',    vendor:'Sysco',  unit:'lb',   cost_per_unit:5.80 },
      { id:uid(), name:'Romaine Lettuce',     category:'Produce',    vendor:'Sysco',  unit:'head', cost_per_unit:1.50 },
      { id:uid(), name:'Lime Juice',          category:'Mixer/Supply',vendor:'Sysco', unit:'qt',   cost_per_unit:4.50 },
      { id:uid(), name:'Triple Sec',          category:'Mixer/Supply',vendor:'RNDC',  unit:'bottle',cost_per_unit:8.99 },
      { id:uid(), name:'Simple Syrup',        category:'Mixer/Supply',vendor:'Sysco', unit:'qt',   cost_per_unit:3.25 },
      { id:uid(), name:'Burger Patties 8oz',  category:'Protein',    vendor:'Sysco',  unit:'each', cost_per_unit:2.80 },
      { id:uid(), name:'Cheddar Cheese',      category:'Dairy',      vendor:'Sysco',  unit:'lb',   cost_per_unit:4.20 },
      { id:uid(), name:'Nacho Chips',         category:'Dry Goods',  vendor:'Sysco',  unit:'bag',  cost_per_unit:3.50 },
      { id:uid(), name:'Queso Sauce',         category:'Dairy',      vendor:'Sysco',  unit:'qt',   cost_per_unit:5.00 },
    ].map(p => ({ ...p, created_at: new Date().toISOString() }));
    App.data.kitchen_products = kp;

    // ── Recipes ──
    const titoId = bp[0].id, tequilaId = bp[1].id, ginId = bp[2].id, rumId = bp[4].id;
    const limeId = kp[3].id, tripleSec = kp[4].id, simpleSyrup = kp[5].id;
    const chickenId = kp[0].id, burgerPattyId = kp[6].id, cheeseId = kp[7].id, nachipsId = kp[8].id, quesoId = kp[9].id;

    const recipes = [
      {
        id:uid(), name:'House Margarita', mode:'single', category:'Cocktail',
        menu_price:10, target_cost_pct:20,
        ingredients:[
          { product_id:tequilaId, quantity:1,    cost_per_unit:bp[1].cost_per_pour,      total_cost:bp[1].cost_per_pour },
          { product_id:tripleSec, quantity:0.5,  cost_per_unit:kp[4].cost_per_unit/4,    total_cost:kp[4].cost_per_unit/4*0.5 },
          { product_id:limeId,    quantity:0.25, cost_per_unit:kp[3].cost_per_unit/4,    total_cost:kp[3].cost_per_unit/4*0.25 },
        ],
      },
      {
        id:uid(), name:'Vodka Soda', mode:'single', category:'Cocktail',
        menu_price:9, target_cost_pct:20,
        ingredients:[
          { product_id:titoId, quantity:1, cost_per_unit:bp[0].cost_per_pour, total_cost:bp[0].cost_per_pour },
        ],
      },
      {
        id:uid(), name:'Classic Mojito', mode:'single', category:'Cocktail',
        menu_price:11, target_cost_pct:20,
        ingredients:[
          { product_id:rumId,        quantity:1,   cost_per_unit:bp[4].cost_per_pour, total_cost:bp[4].cost_per_pour },
          { product_id:limeId,       quantity:0.5, cost_per_unit:kp[3].cost_per_unit, total_cost:kp[3].cost_per_unit*0.5 },
          { product_id:simpleSyrup,  quantity:0.5, cost_per_unit:kp[5].cost_per_unit, total_cost:kp[5].cost_per_unit*0.5 },
        ],
      },
      {
        id:uid(), name:'Frozen Margarita Batch', mode:'batch', category:'Cocktail',
        menu_price:10, target_cost_pct:20,
        batch_yield:1, batch_yield_unit:'gallons', serving_size:5, serving_size_unit:'oz',
        servings_per_batch:25.6,
        ingredients:[
          { product_id:tequilaId, quantity:2,   cost_per_unit:bp[1].cost_per_unit, total_cost:bp[1].cost_per_unit*2 },
          { product_id:tripleSec, quantity:1,   cost_per_unit:kp[4].cost_per_unit, total_cost:kp[4].cost_per_unit },
          { product_id:limeId,    quantity:2,   cost_per_unit:kp[3].cost_per_unit, total_cost:kp[3].cost_per_unit*2 },
          { product_id:simpleSyrup,quantity:1,  cost_per_unit:kp[5].cost_per_unit, total_cost:kp[5].cost_per_unit },
        ],
      },
      {
        id:uid(), name:'Grilled Chicken Plate', mode:'food', category:'Food Plate',
        menu_price:14, target_cost_pct:32, plate_yield:1,
        ingredients:[
          { product_id:chickenId, quantity:0.5, cost_per_unit:kp[0].cost_per_unit, total_cost:kp[0].cost_per_unit*0.5 },
        ],
      },
      {
        id:uid(), name:'Smash Burger', mode:'food', category:'Food Plate',
        menu_price:13, target_cost_pct:32, plate_yield:1,
        ingredients:[
          { product_id:burgerPattyId, quantity:2,   cost_per_unit:kp[6].cost_per_unit, total_cost:kp[6].cost_per_unit*2 },
          { product_id:cheeseId,      quantity:0.25, cost_per_unit:kp[7].cost_per_unit, total_cost:kp[7].cost_per_unit*0.25 },
        ],
      },
      {
        id:uid(), name:'Bar Nachos', mode:'food', category:'Food Plate',
        menu_price:12, target_cost_pct:32, plate_yield:1,
        ingredients:[
          { product_id:nachipsId, quantity:1,   cost_per_unit:kp[8].cost_per_unit, total_cost:kp[8].cost_per_unit },
          { product_id:quesoId,   quantity:0.5, cost_per_unit:kp[9].cost_per_unit, total_cost:kp[9].cost_per_unit*0.5 },
        ],
      },
    ].map(r => {
      const tc  = r.ingredients.reduce((s,i) => s + i.total_cost, 0);
      const spb = r.servings_per_batch || r.plate_yield || 1;
      const cps = tc / spb;
      const pct = r.menu_price ? cps / r.menu_price * 100 : null;
      return { ...r, total_cost:tc, cost_per_serving:cps, cost_pct:pct, flagged:pct!=null?pct>r.target_cost_pct:false, updated_at:new Date().toISOString(), created_at:new Date().toISOString() };
    });
    App.data.recipes = recipes;

    // ── 8 Weeks of Data ──
    const weeks = [];
    for (let w = 8; w >= 1; w--) {
      const wkNum = w;
      const endDate = dateStr((w-1)*7);
      const barRev  = 11800 + Math.round((Math.random()-0.5)*1200);
      const barCogs = Math.round(barRev * (0.245 + (Math.random()-0.5)*0.04));
      const barLab  = Math.round(barRev * (0.27  + (Math.random()-0.5)*0.03));
      const foodRev = 7100  + Math.round((Math.random()-0.5)*800);
      const foodCogs= Math.round(foodRev * (0.35  + (Math.random()-0.5)*0.05));
      const foodLab = Math.round(foodRev * (0.29  + (Math.random()-0.5)*0.03));
      const bPct    = barCogs / barRev * 100;
      const fPct    = foodCogs/ foodRev* 100;
      const tRev    = barRev + foodRev;
      const pPct    = (barCogs+foodCogs+barLab+foodLab) / tRev * 100;

      const bar_count = bp.map(p => {
        const used = +(Math.random()*3+0.5).toFixed(2);
        return { product_id:p.id, beg_inv:+(Math.random()*2+0.5).toFixed(1), purchases:+(Math.random()*4+1).toFixed(0), end_inv:+(Math.random()*1.5).toFixed(1), units_used:used, total_cost:+(used*p.cost_per_unit).toFixed(2) };
      });
      const bar_variance = bp.map(p => {
        const cnt = bar_count.find(c=>c.product_id===p.id);
        const actualPours = (cnt?.units_used||0) * p.pours_per_bottle;
        const theo = Math.round(actualPours * (0.95 + Math.random()*0.08));
        const varU = +(actualPours - theo).toFixed(1);
        return { product_id:p.id, actual_units:+actualPours.toFixed(1), theoretical_units:theo, variance_units:varU, variance_oz:+(varU*p.std_pour_oz).toFixed(1), variance_dollar:+(varU*p.cost_per_pour).toFixed(2), status:Math.abs(varU)<=2?'OK':'Over — Investigate' };
      });

      weeks.push({ id:uid(), week_num:wkNum, period_end:endDate, saved_at:new Date().toISOString(),
        bar:{ revenue:barRev, cogs:barCogs, labor:barLab, cost_pct:bPct, labor_pct:barLab/barRev*100, vs_target_pct:bPct-22, vs_target_dollar:((bPct-22)/100)*barRev },
        food:{ revenue:foodRev, cogs:foodCogs, labor:foodLab, cost_pct:fPct, labor_pct:foodLab/foodRev*100, vs_target_pct:fPct-32, vs_target_dollar:((fPct-32)/100)*foodRev },
        prime_cost_pct:pPct, bar_count, bar_variance, food_count:[], notes:''
      });
    }
    App.data.weeks = weeks;

    // ── Shifts ──
    const shiftNames = ['Maria G.','Jake T.','Samantha R.','Carlos M.','Ashley B.'];
    const shifts = [];
    for (let i = 0; i < 14; i++) {
      const rev  = 1800 + Math.round(Math.random()*800);
      const cogs = Math.round(rev * (0.22 + (Math.random()-0.5)*0.06));
      const pct  = cogs/rev*100;
      const diff = pct - 22;
      const status = diff<=0?'ON TARGET':diff<=3?'WATCH — SLIGHTLY OVER':'INVESTIGATE — SIGNIFICANTLY OVER';
      shifts.push({ id:uid(), date:dateStr(i*2), shift:['AM','PM','Late'][i%3], bartender:shiftNames[i%5], revenue:rev, cogs, pour_cost_pct:pct, variance_dollar:(diff/100)*rev, status, saved_at:new Date().toISOString() });
    }
    App.data.shifts = shifts;

    // ── Cash Reconciliations ──
    const recons = [];
    for (let i = 0; i < 10; i++) {
      const exp = 600 + Math.round(Math.random()*400);
      const cnt = exp + Math.round((Math.random()-0.5)*30);
      const os  = cnt - exp;
      recons.push({ id:uid(), date:dateStr(i*3), shift:['AM','PM','Close'][i%3], register:'1', cashier:shiftNames[i%5], opening_bank:200, expected_cash:exp, counted_cash:cnt, credit_debit:Math.round(Math.random()*800)+400, over_short:os, tolerance:10, status:Math.abs(os)<=10?'OK':os>0?'Over':'Short', saved_at:new Date().toISOString() });
    }
    App.data.reconciliations = recons;

    // ── Vendor Log ──
    App.data.vendor_log = [
      { id:uid(), date:dateStr(21), vendor:'Republic National', product_id:bp[0].id, product_name:"Tito's Handmade Vodka", product_type:'bar', old_price:14.99, new_price:15.99, change_dollar:1.00, change_pct:6.7, weekly_usage:4, annual_impact:208, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(14), vendor:'Sysco',             product_id:kp[0].id, product_name:'Chicken Breast',        product_type:'kitchen', old_price:3.20, new_price:3.45, change_dollar:0.25, change_pct:7.8, weekly_usage:20, annual_impact:260, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(7),  vendor:'Glazer\'s',         product_id:bp[6].id, product_name:'Modelo Especial',       product_type:'bar', old_price:1.35, new_price:1.50, change_dollar:0.15, change_pct:11.1, weekly_usage:48, annual_impact:374.4, saved_at:new Date().toISOString() },
    ];

    // ── Theft Scores ──
    App.data.theft_scores = [
      { id:uid(), date:dateStr(60), scores:{0:3,1:4,2:3,3:4,4:3,5:4,6:3,7:4,8:3,9:3,10:4,11:4}, total:42, rating:'High Risk — Immediate Action' },
      { id:uid(), date:dateStr(30), scores:{0:2,1:3,2:2,3:3,4:2,5:3,6:2,7:3,8:2,9:2,10:3,11:3}, total:30, rating:'Moderate Risk — Tighten Controls' },
      { id:uid(), date:new Date().toISOString(),  scores:{0:1,1:2,2:1,3:2,4:1,5:2,6:1,7:2,8:1,9:2,10:2,11:2}, total:19, rating:'Low Risk — Strong Controls' },
    ];
    App.data.last_theft_score_date = new Date().toISOString();

    // ── Save everything ──
    await App.save();
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ Sample data loaded — all sections populated. Go test!'; }
  },

  async clearAll() {
    const msg = document.getElementById('s-test-msg');
    if (msg) { msg.style.color = 'var(--t3)'; msg.textContent = 'Clearing...'; msg.style.display = 'block'; }

    const s = App.data.settings;
    App.data = {
      settings: { ...s, onboarding_complete:true },
      bar_products:[], kitchen_products:[], recipes:[],
      weeks:[], shifts:[], reconciliations:[],
      theft_scores:[], vendor_log:[], last_theft_score_date:null,
      audits:[]
    };
    await App.save();
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ All data cleared. Ready for real data.'; }
  }
};
