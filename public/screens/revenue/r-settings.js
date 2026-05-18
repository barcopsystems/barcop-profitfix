'use strict';
S.RevenueSettings = {

  render(container, actions) {
    actions.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.id = 'rs-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.save());
    actions.appendChild(saveBtn);

    const s      = App.data.settings;
    const rs     = App.data.revenue_settings || {};
    const t      = rs.targets || {};
    const servers = rs.servers || [];
    const wages  = rs.avg_hourly_wage || { bar:15, kitchen:14, floor:13 };

    const serverRows = servers.map((sv, i) =>
      `<tr><td>${esc(sv.name)}</td><td>${esc(sv.role||'Server')}</td><td><button class="btn btn-ghost btn-sm" onclick="S.RevenueSettings.removeServer(${i})">Remove</button></td></tr>`
    ).join('') || '<tr><td colspan="3" style="color:var(--t3);font-size:12px;text-align:center;padding:14px;">No servers added yet.</td></tr>';

    container.innerHTML = `<div class="screen">
      <div class="s-tabs" style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:24px;">
        <button class="s-tab s-tab-active" data-tab="general" style="background:none;border:none;color:var(--gold);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;cursor:pointer;border-bottom:2px solid var(--gold);margin-bottom:-1px;">Settings</button>
        <button class="s-tab" data-tab="subscription" style="background:none;border:none;color:var(--t2);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">Subscription</button>
      </div>

      <div id="rs-tab-general">
        <div class="settings-section"><div class="settings-title">Your Bar</div>
          <div class="card"><div class="form-row" style="gap:16px;">
            <div class="f w-lg"><label>Bar / Restaurant Name</label><input type="text" id="rs-name" value="${esc(s.bar_name||'')}" placeholder="The Rusty Nail"/></div>
            <div class="f" style="flex:1.2;min-width:130px;"><label>City</label><input type="text" id="rs-city" value="${esc((s.city_state||'').split(',')[0]?.trim()||'')}" placeholder="Austin"/></div>
            <div class="f" style="flex:0.8;min-width:100px;"><label>State / Province</label><input type="text" id="rs-state" value="${esc((s.city_state||'').split(',')[1]?.trim()||'')}" placeholder="TX"/></div>
            <div class="f w-md"><label>Annual Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-brev" value="${s.annual_bar_revenue||''}" placeholder="0"/></div></div>
            <div class="f w-md"><label>Annual Food Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-frev" value="${s.annual_food_revenue||''}" placeholder="0"/></div></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Revenue Targets</div>
          <div class="card"><div class="form-row" style="gap:16px 20px;">
            <div class="f" style="width:140px;"><label>Check Avg Target ${tt('r-check-avg')}</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-ca" value="${t.check_avg??35}" step="0.5"/></div></div>
            <div class="f" style="width:120px;"><label>Bar Labor % ${tt('r-labor-pct')}</label><div class="fw"><input class="suf" type="number" id="rs-bl" value="${t.bar_labor_pct??28}" step="0.1"/><span class="suf">%</span></div></div>
            <div class="f" style="width:120px;"><label>Kitchen Labor %</label><div class="fw"><input class="suf" type="number" id="rs-kl" value="${t.kitchen_labor_pct??30}" step="0.1"/><span class="suf">%</span></div></div>
            <div class="f" style="width:120px;"><label>Floor Labor %</label><div class="fw"><input class="suf" type="number" id="rs-fl" value="${t.floor_labor_pct??32}" step="0.1"/><span class="suf">%</span></div></div>
            <div class="f" style="width:120px;"><label>Lunch RPLH ${tt('r-rplh-target')}</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-rl" value="${t.rplh_lunch??50}"/></div></div>
            <div class="f" style="width:120px;"><label>Dinner RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-rd" value="${t.rplh_dinner??75}"/></div></div>
            <div class="f" style="width:120px;"><label>Bar RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-rb" value="${t.rplh_bar??65}"/></div></div>
            <div class="f" style="width:120px;"><label>Event Close Rate</label><div class="fw"><input class="suf" type="number" id="rs-ec" value="${t.event_close_rate??40}" step="1"/><span class="suf">%</span></div></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Average Hourly Wages</div>
          <div class="card"><div class="form-row" style="gap:16px;">
            <div class="f" style="width:140px;"><label>Bar Staff</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-wb" value="${wages.bar||15}" step="0.25"/><span style="font-size:11px;color:var(--t3);margin-left:6px;">/hr</span></div></div>
            <div class="f" style="width:140px;"><label>Kitchen Staff</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-wk" value="${wages.kitchen||14}" step="0.25"/><span style="font-size:11px;color:var(--t3);margin-left:6px;">/hr</span></div></div>
            <div class="f" style="width:140px;"><label>Floor Staff</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-wf" value="${wages.floor||13}" step="0.25"/><span style="font-size:11px;color:var(--t3);margin-left:6px;">/hr</span></div></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Server Roster</div>
          <div class="card">
            <div class="form-row" style="gap:12px;margin-bottom:14px;">
              <div class="f w-lg"><label>Server Name</label><input type="text" id="rs-sv-name" placeholder="Jane Smith"/></div>
              <div class="f w-md"><label>Role</label>
                <select id="rs-sv-role" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;">
                  <option>Server</option><option>Bartender</option><option>Bar Server</option><option>Manager</option>
                </select>
              </div>
              <div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost" id="rs-sv-add">Add Server</button></div>
            </div>
            <div class="tbl-wrap"><table class="sum-tbl">
              <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
              <tbody id="rs-sv-table">${serverRows}</tbody>
            </table></div>
          </div>
        </div>
        <div class="settings-section"><div class="settings-title">Account</div>
          <div class="card">
            <div class="form-row" style="gap:16px;">
              <div class="f" style="width:220px;"><label>New Password</label><input type="password" id="rs-pw1" placeholder="Enter new password" autocomplete="new-password"/></div>
              <div class="f" style="width:220px;"><label>Confirm Password</label><input type="password" id="rs-pw2" placeholder="Confirm new password" autocomplete="new-password"/></div>
              <div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost" id="rs-pw-btn">Update Password</button></div>
            </div>
            <div id="rs-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>
          </div>
        </div>
        <div class="settings-section"><div class="settings-title">Data</div>
          <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-ghost" id="rs-load-sample">Load Sample Data</button>
            <button class="btn btn-ghost" id="rs-clear-all" style="color:var(--red);">Clear Revenue Data</button>
            <div id="rs-test-msg" style="font-size:12px;color:var(--gold);display:none;"></div>
          </div>
        </div>
        <div id="rs-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;margin-top:8px;">Settings saved.</div>
      </div>

      <div id="rs-tab-subscription" style="display:none;">
        <div id="rs-sub-content"></div>
      </div>
    </div>`;

    document.getElementById('rs-sv-add')?.addEventListener('click', () => this.addServer());
    document.getElementById('rs-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('rs-load-sample')?.addEventListener('click', () => this.loadSample());
    document.getElementById('rs-clear-all')?.addEventListener('click', () => this.clearRevenue());

    container.querySelectorAll('.s-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const which = tab.dataset.tab;
        container.querySelectorAll('.s-tab').forEach(t2 => {
          const active = t2.dataset.tab === which;
          t2.style.color = active ? 'var(--gold)' : 'var(--t2)';
          t2.style.borderBottomColor = active ? 'var(--gold)' : 'transparent';
        });
        document.getElementById('rs-tab-general').style.display = which === 'general' ? '' : 'none';
        document.getElementById('rs-tab-subscription').style.display = which === 'subscription' ? '' : 'none';
        document.getElementById('rs-save-btn').style.display = which === 'general' ? '' : 'none';
        if (which === 'subscription') this.renderSubscription();
      });
    });
  },

  renderSubscription() {
    const el = document.getElementById('rs-sub-content');
    if (!el) return;
    const sub = App.subscription || {};
    const status = sub.status || 'inactive';
    const plan = sub.plan || null;
    const modules = sub.active_modules || [];
    const periodEnd = sub.period_end ? new Date(sub.period_end) : null;

    const planLabels = { tier_1: '1 Module', tier_2: '2 Modules', tier_3: '3 Modules (Full Access)' };
    const moduleLabels = { profit: 'Profit Recovery', revenue: 'Revenue Recovery', traffic: 'Traffic Recovery' };
    const statusColor = { active: 'var(--gold)', past_due: 'var(--red)', canceled: 'var(--red)', inactive: 'var(--t2)' };
    const statusLabel = { active: 'Active', past_due: 'Past Due', canceled: 'Canceled', inactive: 'No Active Subscription' };
    const allMods = ['profit', 'revenue', 'traffic'];
    const hasAll = allMods.every(m => modules.includes(m));

    const moduleRows = allMods.map(m => {
      const on = modules.includes(m);
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + (on ? 'var(--gold)' : 'var(--t2)') + ';flex-shrink:0;"></div>'
        + '<div style="font-size:13px;color:' + (on ? 'var(--t1)' : 'var(--t2)') + ';">' + moduleLabels[m] + '</div>'
        + '<div style="margin-left:auto;font-size:11px;font-weight:700;letter-spacing:1px;color:' + (on ? 'var(--gold)' : 'var(--t2)') + ';">' + (on ? 'ACTIVE' : 'AVAILABLE') + '</div>'
        + '</div>';
    }).join('');

    let billingLine = '';
    if (periodEnd && status === 'active') {
      billingLine = '<div style="font-size:12px;color:var(--t2);margin-top:4px;">Renews ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    } else if (periodEnd && status === 'canceled') {
      billingLine = '<div style="font-size:12px;color:var(--red);margin-top:4px;">Access ends ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    }

    let upgradeBlock = '';
    if (status === 'active' && !hasAll) {
      upgradeBlock = '<div class="card" style="margin-top:0;">'
        + '<div class="settings-title" style="margin-bottom:12px;">Add More Modules</div>'
        + '<button class="btn btn-primary" id="rs-upgrade-btn">View Upgrade Options</button>'
        + '</div>';
    }

    let noSubBlock = '';
    if (status === 'inactive' || status === 'canceled') {
      noSubBlock = '<div class="card" style="margin-top:0;">'
        + '<button class="btn btn-primary" id="rs-hub-btn">Go to Recovery Hub</button>'
        + '</div>';
    }

    el.innerHTML = '<div class="settings-section" style="display:flex;flex-direction:column;gap:16px;">'
      + '<div class="card">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--t1);">' + (plan ? planLabels[plan] : 'No Plan') + '</div>'
      + '<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:' + (statusColor[status] || 'var(--t2)') + ';margin-top:4px;text-transform:uppercase;">' + (statusLabel[status] || status) + '</div>'
      + billingLine
      + '</div>'
      + (status === 'active' ? '<button class="btn btn-ghost" id="rs-portal-btn" style="flex-shrink:0;">Manage Billing</button>' : '')
      + '</div>'
      + '<div style="margin-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t2);margin-bottom:8px;text-transform:uppercase;">Recovery Modules</div>'
      + moduleRows
      + '</div>'
      + '</div>'
      + upgradeBlock
      + noSubBlock
      + '</div>';

    document.getElementById('rs-portal-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('rs-portal-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Opening...'; }
      try {
        const userId = DB._sb?.auth?.getUser ? (await DB._sb.auth.getUser()).data?.user?.id : null;
        if (!userId) throw new Error('Not logged in.');
        const res = await fetch('/api/billing-portal', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not open billing portal.');
        window.open(data.url, '_blank');
      } catch(e) {
        alert('Could not open billing portal: ' + e.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Manage Billing'; }
      }
    });
    document.getElementById('rs-upgrade-btn')?.addEventListener('click', () => App.showHub());
    document.getElementById('rs-hub-btn')?.addEventListener('click', () => App.showHub());
  },

  addServer() {
    const name = document.getElementById('rs-sv-name')?.value.trim();
    const role = document.getElementById('rs-sv-role')?.value;
    if (!name) return;
    const rs = App.data.revenue_settings;
    if (!rs.servers) rs.servers = [];
    rs.servers.push({ name, role, id: Date.now().toString() });
    App.saveKey('revenue_settings').then(() => App.navigate('r-settings'));
  },

  removeServer(index) {
    const rs = App.data.revenue_settings;
    rs.servers.splice(index, 1);
    App.saveKey('revenue_settings').then(() => App.navigate('r-settings'));
  },

  save() {
    const s = App.data.settings;
    const city  = document.getElementById('rs-city')?.value.trim() || '';
    const state = document.getElementById('rs-state')?.value.trim() || '';
    s.bar_name            = document.getElementById('rs-name')?.value.trim();
    s.city_state          = city && state ? city + ', ' + state : city || state || '';
    s.annual_bar_revenue  = parseFloat(document.getElementById('rs-brev')?.value) || 0;
    s.annual_food_revenue = parseFloat(document.getElementById('rs-frev')?.value) || 0;
    const rs = App.data.revenue_settings;
    rs.targets = {
      check_avg:         parseFloat(document.getElementById('rs-ca')?.value) || 35,
      bar_labor_pct:     parseFloat(document.getElementById('rs-bl')?.value) || 28,
      kitchen_labor_pct: parseFloat(document.getElementById('rs-kl')?.value) || 30,
      floor_labor_pct:   parseFloat(document.getElementById('rs-fl')?.value) || 32,
      rplh_lunch:        parseFloat(document.getElementById('rs-rl')?.value) || 50,
      rplh_dinner:       parseFloat(document.getElementById('rs-rd')?.value) || 75,
      rplh_bar:          parseFloat(document.getElementById('rs-rb')?.value) || 65,
      event_close_rate:  parseFloat(document.getElementById('rs-ec')?.value) || 40,
    };
    rs.avg_hourly_wage = {
      bar:     parseFloat(document.getElementById('rs-wb')?.value) || 15,
      kitchen: parseFloat(document.getElementById('rs-wk')?.value) || 14,
      floor:   parseFloat(document.getElementById('rs-wf')?.value) || 13,
    };
    rs._targets_saved = true;
    Promise.all([App.saveKey('settings'), App.saveKey('revenue_settings')]).then(() => {
      const m = document.getElementById('rs-msg');
      if (m) { m.style.display = 'block'; setTimeout(() => m.style.display = 'none', 2500); }
    });
  },

  async changePassword() {
    const pw1 = document.getElementById('rs-pw1')?.value;
    const pw2 = document.getElementById('rs-pw2')?.value;
    const msg = document.getElementById('rs-pw-msg');
    const btn = document.getElementById('rs-pw-btn');
    if (!pw1 || pw1.length < 8) { if(msg){msg.style.color='var(--red)';msg.textContent='Password must be at least 8 characters.';msg.style.display='block';} return; }
    if (pw1 !== pw2) { if(msg){msg.style.color='var(--red)';msg.textContent='Passwords do not match.';msg.style.display='block';} return; }
    if(btn){btn.disabled=true;btn.textContent='Updating...';}
    const {error} = await DB._sb.auth.updateUser({password:pw1});
    if(btn){btn.disabled=false;btn.textContent='Update Password';}
    if(msg){msg.style.color=error?'var(--red)':'var(--gold)';msg.textContent=error?error.message:'Password updated.';msg.style.display='block';}
  },

  async loadSample() {
    const msg = document.getElementById('rs-test-msg');
    if (msg) { msg.style.color='var(--t2)'; msg.textContent='Loading sample data...'; msg.style.display='block'; }

    const uid = () => App.uid();
    const today = new Date();
    const dateStr = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate()-daysAgo); return d.toISOString().slice(0,10); };

    // Settings
    App.data.settings.bar_name            = 'The Anchor Bar & Kitchen';
    App.data.settings.city_state          = 'Austin, TX';
    App.data.settings.annual_bar_revenue  = 624000;
    App.data.settings.annual_food_revenue = 374400;
    App.data.settings.onboarding_complete = true;

    // Revenue Settings
    App.data.revenue_settings = {
      targets: {
        check_avg: 38, bar_labor_pct: 26, kitchen_labor_pct: 28,
        floor_labor_pct: 30, rplh_lunch: 52, rplh_dinner: 78, rplh_bar: 68,
        event_close_rate: 45
      },
      avg_hourly_wage: { bar: 16, kitchen: 15, floor: 14 },
      servers: [
        { id:'sv1', name:'Jessica M.', role:'Server' },
        { id:'sv2', name:'Marcus T.', role:'Server' },
        { id:'sv3', name:'Brianna K.', role:'Server' },
        { id:'sv4', name:'Derek W.', role:'Server' },
        { id:'sv5', name:'Aimee R.', role:'Server' },
        { id:'sv6', name:'Carlos P.', role:'Bartender' },
        { id:'sv7', name:'Tiffany L.', role:'Bar Server' },
        { id:'sv8', name:'Noah S.', role:'Server' },
      ],
      _targets_saved: true
    };

    // Menu Items
    App.data.revenue_menu_items = [
      { id:uid(), name:'Smash Burger',          category:'Entrees',    price:16, cost:4.80, weekly_covers:142 },
      { id:uid(), name:'Fish Tacos (3)',         category:'Entrees',    price:18, cost:5.40, weekly_covers:98  },
      { id:uid(), name:'Caesar Salad',           category:'Entrees',    price:14, cost:3.50, weekly_covers:64  },
      { id:uid(), name:'Chicken Sandwich',       category:'Entrees',    price:15, cost:4.20, weekly_covers:88  },
      { id:uid(), name:'Ribeye (10 oz)',         category:'Entrees',    price:42, cost:14.70, weekly_covers:28 },
      { id:uid(), name:'Queso and Chips',        category:'Appetizers', price:12, cost:2.40, weekly_covers:178 },
      { id:uid(), name:'Chicken Wings (8 pc)',   category:'Appetizers', price:14, cost:4.20, weekly_covers:122 },
      { id:uid(), name:'Pretzel Bites',          category:'Appetizers', price:10, cost:1.80, weekly_covers:76  },
      { id:uid(), name:'Brownie Sundae',         category:'Desserts',   price:9,  cost:2.25, weekly_covers:31  },
      { id:uid(), name:'Churro Bites',           category:'Desserts',   price:8,  cost:1.60, weekly_covers:18  },
      { id:uid(), name:'House Margarita',        category:'Cocktails',  price:12, cost:2.16, weekly_covers:210 },
      { id:uid(), name:'Espresso Martini',       category:'Cocktails',  price:14, cost:3.08, weekly_covers:88  },
      { id:uid(), name:'Aperol Spritz',          category:'Cocktails',  price:11, cost:2.09, weekly_covers:64  },
      { id:uid(), name:'Old Fashioned',          category:'Cocktails',  price:13, cost:2.86, weekly_covers:52  },
      { id:uid(), name:'Bud Light',              category:'Beer',       price:5,  cost:1.10, weekly_covers:134 },
      { id:uid(), name:'Modelo Especial',        category:'Beer',       price:6,  cost:1.35, weekly_covers:112 },
      { id:uid(), name:'Austin Beerworks IPA',   category:'Beer',       price:7,  cost:1.75, weekly_covers:78  },
      { id:uid(), name:'House Cabernet',         category:'Wine',       price:10, cost:2.50, weekly_covers:42  },
      { id:uid(), name:'House Chardonnay',       category:'Wine',       price:9,  cost:2.25, weekly_covers:38  },
    ];

    // Server checks
    App.data.revenue_server_checks = [
      { id:uid(), date:dateStr(1),  shift:'Dinner', server_name:'Jessica M.', covers:32, sales:1408, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(1),  shift:'Dinner', server_name:'Marcus T.',  covers:28, sales:1092, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(2),  shift:'Lunch',  server_name:'Brianna K.', covers:24, sales:840,  saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(2),  shift:'Dinner', server_name:'Derek W.',   covers:30, sales:990,  saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(3),  shift:'Dinner', server_name:'Aimee R.',   covers:26, sales:1066, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(4),  shift:'Bar',    server_name:'Carlos P.',  covers:44, sales:1540, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(5),  shift:'Dinner', server_name:'Tiffany L.', covers:22, sales:748,  saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(6),  shift:'Lunch',  server_name:'Noah S.',    covers:18, sales:612,  saved_at:new Date().toISOString() },
    ];

    // Events
    App.data.revenue_events = [
      { id:uid(), event_name:'Henderson Wedding Rehearsal', event_type:'Private Dining', status:'Completed',  date:dateStr(18), covers:45, fb_minimum:2500, actual_revenue:3240, estimated_revenue:0,    notes:'Returned guests, great tip' },
      { id:uid(), event_name:'TechCorp Quarterly Dinner',   event_type:'Corporate',      status:'Completed',  date:dateStr(32), covers:60, fb_minimum:4000, actual_revenue:4820, estimated_revenue:0,    notes:'' },
      { id:uid(), event_name:'Birthday Buyout - Garcia',    event_type:'Buyout',         status:'Confirmed',  date:dateStr(-8), covers:80, fb_minimum:5000, actual_revenue:0,    estimated_revenue:5400, notes:'Deposit received' },
      { id:uid(), event_name:'Acme Corp Holiday Party',     event_type:'Corporate',      status:'Proposal Sent', date:dateStr(-21), covers:120, fb_minimum:8000, actual_revenue:0, estimated_revenue:9000, notes:'Follow up Friday' },
      { id:uid(), event_name:'Bachelorette - Martinez',     event_type:'Social',         status:'Inquiry',    date:dateStr(-14), covers:20, fb_minimum:1200, actual_revenue:0,    estimated_revenue:1400, notes:'Asked for menu options' },
      { id:uid(), event_name:'Wilson Anniversary',          event_type:'Private Dining', status:'Lost',       date:dateStr(45), covers:12, fb_minimum:800,  actual_revenue:0,    estimated_revenue:0,    notes:'Went with a competitor' },
    ];

    // Rate Cards
    App.data.revenue_rate_cards = [
      { id:uid(), package_name:'Weeknight Private Dining', event_type:'Private Dining', min_covers:20, max_covers:50, fb_minimum:1500, room_fee:0, per_head:0 },
      { id:uid(), package_name:'Weekend Private Dining',   event_type:'Private Dining', min_covers:20, max_covers:50, fb_minimum:2500, room_fee:0, per_head:0 },
      { id:uid(), package_name:'Full Buyout Weeknight',    event_type:'Buyout',         min_covers:60, max_covers:150, fb_minimum:5000, room_fee:500, per_head:0 },
      { id:uid(), package_name:'Full Buyout Weekend',      event_type:'Buyout',         min_covers:60, max_covers:150, fb_minimum:8000, room_fee:1000, per_head:0 },
      { id:uid(), package_name:'Corporate Lunch',          event_type:'Corporate',      min_covers:20, max_covers:80, fb_minimum:0, room_fee:0, per_head:35 },
    ];

    // Pricing log
    App.data.revenue_price_log = [
      { id:uid(), date:dateStr(30), item_name:'House Margarita',  old_price:11, new_price:12, reason:'Cost increase on lime and agave', margin_impact:1 },
      { id:uid(), date:dateStr(45), item_name:'Smash Burger',     old_price:14, new_price:16, reason:'Beef cost up 18% since Q1',       margin_impact:2 },
      { id:uid(), date:dateStr(60), item_name:'Ribeye (10 oz)',   old_price:38, new_price:42, reason:'Menu repositioning',              margin_impact:4 },
    ];

    // 12 weeks of weekly data with varied performance
    const serverNames = ['Jessica M.','Marcus T.','Brianna K.','Derek W.','Aimee R.','Carlos P.','Tiffany L.','Noah S.'];
    const serverCheckAvgs = [44, 38, 35, 33, 41, 37, 26, 30]; // consistent individual averages

    const weeks = [];
    for (let i = 12; i >= 1; i--) {
      const wkNum = 13 - i;
      const daysBack = i * 7;
      const periodEnd = dateStr(daysBack);
      // Add some variance to make the trends interesting
      const trend = (12 - i) * 0.15; // improving trend
      const barRev   = Math.round(6200 + (Math.random()-0.4)*800 + trend*80);
      const floorRev = Math.round(5800 + (Math.random()-0.4)*700 + trend*60);
      const covers   = Math.round(380 + (Math.random()-0.4)*60);
      const checkAvg = parseFloat(((barRev + floorRev) / covers).toFixed(2));
      const barLaborHrs     = Math.round(210 + (Math.random()-0.5)*20);
      const kitchenLaborHrs = Math.round(180 + (Math.random()-0.5)*18);
      const floorLaborHrs   = Math.round(240 + (Math.random()-0.5)*24);
      const totalHrs        = barLaborHrs + kitchenLaborHrs + floorLaborHrs;
      const barLaborCost    = Math.round(barLaborHrs * 16);
      const kitchenLaborCost = Math.round(kitchenLaborHrs * 15);
      const floorLaborCost  = Math.round(floorLaborHrs * 14);
      const totalLaborCost  = barLaborCost + kitchenLaborCost + floorLaborCost;
      const totalRev        = barRev + floorRev;
      const laborPct        = parseFloat((totalLaborCost / totalRev * 100).toFixed(2));
      const rplhBlended     = parseFloat((totalRev / totalHrs).toFixed(2));
      // Daypart splits
      const lunchRev  = Math.round(floorRev * 0.32);
      const dinnerRev = Math.round(floorRev * 0.68);
      const lunchHrs  = Math.round(floorLaborHrs * 0.35);
      const dinnerHrs = Math.round(floorLaborHrs * 0.65);
      const rplhLunch  = parseFloat((lunchRev  / lunchHrs).toFixed(2));
      const rplhDinner = parseFloat((dinnerRev / dinnerHrs).toFixed(2));
      const rplhBar    = parseFloat((barRev / barLaborHrs).toFixed(2));
      // Server entries - spread around check averages
      const serverEntries = serverNames.map((name, si) => {
        const svCovers = Math.round((covers / serverNames.length) * (0.8 + Math.random()*0.4));
        const svCA     = serverCheckAvgs[si] + (Math.random()-0.5)*3;
        return { id: 'sv'+(si+1), name, covers: svCovers, sales: Math.round(svCA * svCovers) };
      });
      weeks.push({
        id: uid(), week_num: wkNum, period_end: periodEnd,
        bar_revenue: barRev, floor_revenue: floorRev, covers, check_avg: checkAvg,
        bar_labor_hours: barLaborHrs, bar_labor_cost: barLaborCost,
        kitchen_labor_hours: kitchenLaborHrs, kitchen_labor_cost: kitchenLaborCost,
        floor_labor_hours: floorLaborHrs, floor_labor_cost: floorLaborCost,
        total_labor_cost: totalLaborCost, total_hours: totalHrs,
        labor_pct_blended: laborPct, rplh_blended: rplhBlended,
        rplh_lunch: rplhLunch, rplh_dinner: rplhDinner, rplh_bar: rplhBar,
        rplh_lunch_rev: lunchRev, rplh_lunch_hrs: lunchHrs,
        rplh_dinner_rev: dinnerRev, rplh_dinner_hrs: dinnerHrs,
        rplh_bar_rev: barRev, rplh_bar_hrs: barLaborHrs,
        server_entries: serverEntries,
        notes: '', saved_at: new Date().toISOString()
      });
    }
    App.data.revenue_weeks = weeks;

    // Getting Started progress
    App.data.getting_started_revenue = {
      rgs_targets: dateStr(60), rgs_menu: dateStr(55), rgs_servers: dateStr(55),
      rgs_eng: dateStr(50), rgs_labor: dateStr(50), rgs_week1: dateStr(42),
      rgs_server1: dateStr(35), rgs_rplh1: dateStr(35), rgs_upsell: dateStr(28),
    };

    // Two Revenue Audits with real PDF data using the build script
    const audit1Score = 48;
    const audit2Score = 61;
    App.data.revenue_audits = [
      {
        id: uid(),
        date: dateStr(35),
        bar_name: 'The Anchor Bar & Kitchen',
        overall_score: audit1Score,
        grade: 'Tier 2 Analysis   Standard Data Submitted',
        audit_period: '4 weeks ending ' + dateStr(42),
        sections: {
          'Menu Engineering and Pricing': 42,
          'Labor Cost and Scheduling': 38,
          'Check Average and Upselling': 35,
          'Server Performance Management': 48,
          'Revenue Management Intelligence': 55,
        },
        action_items: [
          { action: 'Close check average gap   $2,480/month at current cover count', monthly_impact: 2480 },
          { action: 'Reduce labor cost   $1,840/month over target', monthly_impact: 1840 },
          { action: 'Improve menu mix   $920/month opportunity from repricing Dogs', monthly_impact: 920 },
        ],
        pdf_data: null,
        generated_at: dateStr(35)
      },
      {
        id: uid(),
        date: dateStr(5),
        bar_name: 'The Anchor Bar & Kitchen',
        overall_score: audit2Score,
        grade: 'Tier 2 Analysis   Standard Data Submitted',
        audit_period: '4 weeks ending ' + dateStr(12),
        sections: {
          'Menu Engineering and Pricing': 58,
          'Labor Cost and Scheduling': 54,
          'Check Average and Upselling': 52,
          'Server Performance Management': 66,
          'Revenue Management Intelligence': 70,
        },
        action_items: [
          { action: 'Close check average gap   $1,640/month at current cover count', monthly_impact: 1640 },
          { action: 'Reduce labor cost   $980/month over target', monthly_impact: 980 },
        ],
        pdf_data: null,
        generated_at: dateStr(5)
      }
    ];

    await App.save();

    if (msg) { msg.style.color='var(--gold)'; msg.textContent='Sample data loaded. All sections populated.'; }
  },

  async clearRevenue() {
    const msg = document.getElementById('rs-test-msg');
    if (msg) { msg.style.color='var(--t2)'; msg.textContent='Clearing...'; msg.style.display='block'; }
    App.data.revenue_weeks        = [];
    App.data.revenue_audits       = [];
    App.data.revenue_server_checks = [];
    App.data.revenue_menu_items   = [];
    App.data.revenue_price_log    = [];
    App.data.revenue_events       = [];
    App.data.revenue_rate_cards   = [];
    App.data.getting_started_revenue = {};
    App.data.revenue_settings = {
      targets: { check_avg:38, bar_labor_pct:26, kitchen_labor_pct:28, floor_labor_pct:30, rplh_lunch:52, rplh_dinner:78, rplh_bar:68, event_close_rate:45 },
      avg_hourly_wage: { bar:16, kitchen:15, floor:14 },
      servers: [],
      _targets_saved: false
    };
    await App.save();
    if (msg) { msg.style.color='var(--gold)'; msg.textContent='Revenue data cleared. Ready for real data.'; }
  }
};
