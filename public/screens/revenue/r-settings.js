'use strict';
S.RevenueSettings = {
  render(container, actions) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.save());
    actions.appendChild(saveBtn);

    const s  = App.data.settings;
    const rs = App.data.revenue_settings || {};
    const t  = rs.targets || {};
    const servers = rs.servers || [];
    const wages = rs.avg_hourly_wage || { bar:15, kitchen:14, floor:13 };

    const serverRows = servers.map((sv, i) =>
      `<tr>
        <td>${esc(sv.name)}</td>
        <td>${esc(sv.role||'Server')}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="S.RevenueSettings.removeServer(${i})">Remove</button></td>
      </tr>`
    ).join('') || '<tr><td colspan="3" style="color:var(--t3);font-size:12px;text-align:center;padding:14px;">No servers added yet.</td></tr>';

    container.innerHTML = `<div class="screen">
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
          <div class="f" style="width:140px;"><label>Check Avg Target</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-ca" value="${t.check_avg??35}" step="0.5"/></div></div>
          <div class="f" style="width:120px;"><label>Bar Labor %</label><div class="fw"><input class="suf" type="number" id="rs-bl" value="${t.bar_labor_pct??28}" step="0.1"/><span class="suf">%</span></div></div>
          <div class="f" style="width:120px;"><label>Kitchen Labor %</label><div class="fw"><input class="suf" type="number" id="rs-kl" value="${t.kitchen_labor_pct??30}" step="0.1"/><span class="suf">%</span></div></div>
          <div class="f" style="width:120px;"><label>Floor Labor %</label><div class="fw"><input class="suf" type="number" id="rs-fl" value="${t.floor_labor_pct??32}" step="0.1"/><span class="suf">%</span></div></div>
          <div class="f" style="width:120px;"><label>Lunch RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rs-rl" value="${t.rplh_lunch??50}"/></div></div>
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
      <div id="rs-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;">Settings saved.</div>
    </div>`;

    document.getElementById('rs-sv-add')?.addEventListener('click', () => this.addServer());
    document.getElementById('rs-pw-btn')?.addEventListener('click', () => this.changePassword());
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
  }
};
