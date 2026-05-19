'use strict';
S.TrafficSettings = {

  render(container, actions) {
    actions.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.id = 'ts-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.save());
    actions.appendChild(saveBtn);

    const s  = App.data.settings;
    const ts = App.data.traffic_settings || {};
    const t  = ts.targets || {};

    container.innerHTML = `<div class="screen">
      <div class="s-tabs" style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:24px;">
        <button class="s-tab s-tab-active" data-tab="general" style="background:none;border:none;color:var(--gold);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;cursor:pointer;border-bottom:2px solid var(--gold);margin-bottom:-1px;">Settings</button>
        <button class="s-tab" data-tab="subscription" style="background:none;border:none;color:var(--t2);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">Subscription</button>
      </div>

      <div id="ts-tab-general">
        <div class="settings-section"><div class="settings-title">Your Bar</div>
          <div class="card"><div class="form-row" style="gap:16px;">
            <div class="f w-lg"><label>Bar / Restaurant Name</label><input type="text" id="ts-name" value="${esc(s.bar_name||'')}" placeholder="The Rusty Nail"/></div>
            <div class="f" style="flex:1.2;min-width:130px;"><label>City</label><input type="text" id="ts-city" value="${esc((s.city_state||'').split(',')[0]?.trim()||'')}" placeholder="Austin"/></div>
            <div class="f" style="flex:0.8;min-width:100px;"><label>State / Province</label><input type="text" id="ts-state" value="${esc((s.city_state||'').split(',')[1]?.trim()||'')}" placeholder="TX"/></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Traffic Targets</div>
          <div class="card"><div class="form-row" style="gap:16px 20px;">
            <div class="f" style="width:130px;min-width:120px;"><label>Google Rating ${tt('t-google-rating')}</label><div class="fw"><input class="suf" type="number" id="ts-gr" value="${t.google_rating??4.3}" step="0.1" min="1" max="5"/><span class="suf">★</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>New Reviews/Mo ${tt('t-review-vel')}</label><div class="fw"><input class="suf" type="number" id="ts-rv" value="${t.review_velocity??8}" step="1"/><span class="suf">/mo</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>Response Rate ${tt('t-response-rate')}</label><div class="fw"><input class="suf" type="number" id="ts-rr" value="${t.response_rate??75}" step="1"/><span class="suf">%</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>Monthly Sessions ${tt('t-monthly-sessions')}</label><div class="fw"><input class="suf" type="number" id="ts-ms" value="${t.monthly_sessions??2000}" step="100"/><span class="suf">/mo</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>Social Posts/Mo ${tt('t-social-posts')}</label><div class="fw"><input class="suf" type="number" id="ts-sp" value="${t.social_posts_month??12}" step="1"/><span class="suf">posts</span></div></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Account</div>
          <div class="card">
            <div class="form-row" style="gap:16px;">
              <div class="f" style="width:220px;"><label>New Password</label><input type="password" id="ts-pw1" placeholder="Enter new password" autocomplete="new-password"/></div>
              <div class="f" style="width:220px;"><label>Confirm Password</label><input type="password" id="ts-pw2" placeholder="Confirm new password" autocomplete="new-password"/></div>
              <div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost" id="ts-pw-btn">Update Password</button></div>
            </div>
            <div id="ts-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>
          </div>
        </div>
        <div class="settings-section"><div class="settings-title">Data</div>
          <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-ghost" id="ts-clear-all" style="color:var(--red);">Clear Traffic Data</button>
            <div id="ts-test-msg" style="font-size:12px;color:var(--gold);display:none;"></div>
          </div>
        </div>
        <div id="ts-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;margin-top:8px;">Settings saved.</div>
      </div>

      <div id="ts-tab-subscription" style="display:none;">
        <div id="ts-sub-content"></div>
      </div>
    </div>`;

    document.getElementById('ts-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('ts-clear-all')?.addEventListener('click', () => this.clearTraffic());

    container.querySelectorAll('.s-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const which = tab.dataset.tab;
        container.querySelectorAll('.s-tab').forEach(t2 => {
          const active = t2.dataset.tab === which;
          t2.style.color = active ? 'var(--gold)' : 'var(--t2)';
          t2.style.borderBottomColor = active ? 'var(--gold)' : 'transparent';
        });
        document.getElementById('ts-tab-general').style.display       = which === 'general'      ? '' : 'none';
        document.getElementById('ts-tab-subscription').style.display  = which === 'subscription' ? '' : 'none';
        document.getElementById('ts-save-btn').style.display          = which === 'general'      ? '' : 'none';
        if (which === 'subscription') this.renderSubscription();
      });
    });
  },

  async save() {
    const s  = App.data.settings;
    const city  = (document.getElementById('ts-city')?.value  || '').trim();
    const state = (document.getElementById('ts-state')?.value || '').trim();
    s.bar_name   = document.getElementById('ts-name')?.value || s.bar_name;
    s.city_state = city && state ? city + ', ' + state : city || state || s.city_state;

    const ts = App.data.traffic_settings || {};
    ts.targets = {
      ...(ts.targets || {}),
      google_rating:      parseFloat(document.getElementById('ts-gr')?.value) || 4.3,
      review_velocity:    parseInt(document.getElementById('ts-rv')?.value)   || 8,
      response_rate:      parseFloat(document.getElementById('ts-rr')?.value) || 75,
      monthly_sessions:   parseInt(document.getElementById('ts-ms')?.value)   || 2000,
      social_posts_month: parseInt(document.getElementById('ts-sp')?.value)   || 12,
    };
    ts._targets_saved = true;
    App.data.traffic_settings = ts;

    await App.saveKey('settings');
    await App.saveKey('traffic_settings');
    const msg = document.getElementById('ts-msg');
    if (msg) { msg.style.display='block'; setTimeout(()=>msg.style.display='none',2500); }
  },

  async changePassword() {
    const pw1 = document.getElementById('ts-pw1')?.value || '';
    const pw2 = document.getElementById('ts-pw2')?.value || '';
    const msg = document.getElementById('ts-pw-msg');
    if (!msg) return;
    if (!pw1 || pw1.length < 8) { msg.style.color='var(--red)'; msg.textContent='Password must be at least 8 characters.'; msg.style.display='block'; return; }
    if (pw1 !== pw2) { msg.style.color='var(--red)'; msg.textContent='Passwords do not match.'; msg.style.display='block'; return; }
    msg.style.color='var(--gold)'; msg.textContent='Updating...'; msg.style.display='block';
    const { error } = await DB._sb.auth.updateUser({ password: pw1 });
    if (error) { msg.style.color='var(--red)'; msg.textContent='Error: ' + error.message; }
    else { msg.style.color='var(--gold)'; msg.textContent='Password updated.'; }
  },

  async clearTraffic() {
    if (!confirm('Clear all Traffic Recovery data? This cannot be undone.')) return;
    App.data.traffic_weeks   = [];
    App.data.traffic_audits  = [];
    App.data.getting_started_traffic = {};
    App.data.traffic_settings = {
      targets: { google_rating:4.3, review_velocity:8, response_rate:75, monthly_sessions:2000, social_posts_month:12 },
      _targets_saved: false
    };
    await App.save();
    const msg = document.getElementById('ts-test-msg');
    if (msg) { msg.textContent='Traffic data cleared.'; msg.style.display='block'; setTimeout(()=>msg.style.display='none',2500); }
  },

  renderSubscription() {
    const el = document.getElementById('ts-sub-content');
    if (!el) return;
    const sub = App.subscription || {};
    const modules = sub.active_modules || [];
    el.innerHTML = '<div class="card">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Subscription</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;">Active Modules: ' + (modules.join(', ') || 'None') + '</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;">Status: ' + esc(sub.status||'inactive') + '</div>'
      + '<button class="btn btn-ghost" id="ts-portal-btn">Manage Billing</button>'
      + '<div id="ts-portal-msg" style="font-size:12px;color:var(--gold);margin-top:8px;display:none;"></div>'
      + '</div>';
    document.getElementById('ts-portal-btn')?.addEventListener('click', async () => {
      const pmsg = document.getElementById('ts-portal-msg');
      if (pmsg) { pmsg.textContent='Opening billing portal...'; pmsg.style.display='block'; }
      try {
        const { data: { session } } = await DB._sb.auth.getSession();
        const res = await fetch('/api/billing-portal', {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+(session?.access_token||'')},
          body: JSON.stringify({ userId: session?.user?.id })
        });
        const d = await res.json();
        if (d.url) window.open(d.url,'_blank');
        else if (pmsg) { pmsg.style.color='var(--red)'; pmsg.textContent=d.error||'Error opening portal.'; }
      } catch(e) { if (pmsg) { pmsg.style.color='var(--red)'; pmsg.textContent='Error: '+e.message; } }
    });
  }
};
