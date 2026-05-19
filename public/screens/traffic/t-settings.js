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
            <div class="f" style="width:160px;"><label>City</label><input type="text" id="ts-city" value="${esc((s.city_state||'').split(',')[0]?.trim()||'')}" placeholder="Austin"/></div>
            <div class="f" style="width:80px;"><label>State</label><input type="text" id="ts-state" value="${esc((s.city_state||'').split(',')[1]?.trim()||'')}" placeholder="TX"/></div>
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
              <div class="f" style="width:220px;"><label>New Password</label><div class="fw"><input class="suf" type="password" id="ts-pw1" placeholder="Enter new password" autocomplete="new-password" style="border-right:none;border-radius:var(--r2) 0 0 var(--r2);"/><button type="button" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);border-left:none;border-radius:0 var(--r2) var(--r2) 0;padding:0 10px;cursor:pointer;color:var(--t3);display:flex;align-items:center;" id="ts-pw1-eye" onclick="const i=document.getElementById('ts-pw1');const e=document.getElementById('ts-pw1-eye');i.type=i.type==='password'?'text':'password';e.style.color=i.type==='text'?'var(--gold)':'var(--t3)';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button></div></div>
              <div class="f" style="width:220px;"><label>Confirm Password</label><div class="fw"><input class="suf" type="password" id="ts-pw2" placeholder="Confirm new password" autocomplete="new-password" style="border-right:none;border-radius:var(--r2) 0 0 var(--r2);"/><button type="button" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);border-left:none;border-radius:0 var(--r2) var(--r2) 0;padding:0 10px;cursor:pointer;color:var(--t3);display:flex;align-items:center;" id="ts-pw2-eye" onclick="const i=document.getElementById('ts-pw2');const e=document.getElementById('ts-pw2-eye');i.type=i.type==='password'?'text':'password';e.style.color=i.type==='text'?'var(--gold)':'var(--t3)';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button></div></div>
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
    const status = sub.status || 'inactive';
    const plan = sub.plan || null;
    const modules = sub.active_modules || [];
    const periodEnd = sub.period_end ? new Date(sub.period_end) : null;

    const planLabels = { tier_1: '1 Module', tier_2: '2 Modules', tier_3: '3 Modules (Full Access)' };
    const moduleLabels = { profit: 'Profit Recovery', revenue: 'Revenue Recovery', traffic: 'Traffic Recovery' };
    const statusColor = { active: 'var(--gold)', past_due: 'var(--red)', canceled: 'var(--red)', inactive: 'var(--t2)' };
    const statusLabel = { active: 'Active', past_due: 'Past Due', canceled: 'Canceled', inactive: 'No Active Subscription' };
    const allModules = ['profit', 'revenue', 'traffic'];
    const hasAll = allModules.every(m => modules.includes(m));

    let moduleRows = allModules.map(m => {
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
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Unlock Profit Recovery or Revenue Recovery to get a full picture of where your bar is bleeding money.</div>'
        + '<button class="btn btn-primary" id="ts-upgrade-btn">View Upgrade Options</button>'
        + '</div>';
    }

    let noSubBlock = '';
    if (status === 'inactive' || status === 'canceled') {
      noSubBlock = '<div class="card" style="margin-top:0;">'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">You do not have an active subscription. Return to the Recovery Hub to choose a plan.</div>'
        + '<button class="btn btn-primary" id="ts-go-hub-btn">Go to Recovery Hub</button>'
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
      + (status === 'active'
        ? '<button class="btn btn-ghost" id="ts-portal-btn" style="flex-shrink:0;">Manage Billing</button>'
        : '')
      + '</div>'
      + '<div style="margin-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t2);margin-bottom:8px;text-transform:uppercase;">Recovery Modules</div>'
      + moduleRows
      + '</div>'
      + '</div>'
      + upgradeBlock
      + noSubBlock
      + '</div>';

    document.getElementById('ts-portal-btn')?.addEventListener('click', () => this.openBillingPortal());
    document.getElementById('ts-upgrade-btn')?.addEventListener('click', () => App.showHub());
    document.getElementById('ts-go-hub-btn')?.addEventListener('click', () => App.showHub());
  },

  async openBillingPortal() {
    const btn = document.getElementById('ts-portal-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening...'; }
    try {
      const userId = DB._sb?.auth?.getUser ? (await DB._sb.auth.getUser()).data?.user?.id : null;
      if (!userId) throw new Error('Not logged in.');
      const res = await fetch('/api/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open billing portal.');
      window.open(data.url, '_blank');
    } catch (e) {
      alert('Could not open billing portal: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Manage Billing'; }
    }
  }
};
