'use strict';

/* ── Onboarding — the first-run doorway, not the setup ────────────────────────
   One screen after login. The orientation lives in a short intro at the top; the
   only things captured are what the Hub needs from minute one: identity, dollar
   baselines, and the services you run. Numbered gold circles match the Getting
   Started page it hands off to, so login -> onboarding -> setup reads as one flow.
   The six-module setup checklist is the wizard; this is just the front door. */
const Onboarding = {
  _spCtrl: null,

  start() {
    document.getElementById('ob-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.render();
  },

  // A numbered gold circle + label, the same badge the Getting Started page uses.
  _sectionHead(n, title) {
    return '<div style="display:flex;align-items:center;gap:12px;margin:26px 0 14px;">'
      + '<div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--gold-bg);color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + n + '</div>'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t1);">' + title + '</div>'
      + '</div>';
  },

  render() {
    const s = App.data.settings;
    const parts = (s.city_state || '').split(',').map(p => p.trim());
    const v = x => (x != null && x !== '') ? x : '';

    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:8px;">Welcome to Bar Cop</div>'
      + '<div class="ob-sub" style="max-width:none;">Bar Cop captures your daily operation, finds where profit and revenue are leaking, and shows you exactly what to fix. Three quick things get every calculation working, then you continue to the setup checklist.</div>'

      // ① The Basics
      + this._sectionHead(1, 'The Basics')
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="flex:2;min-width:180px;"><label>Bar / Restaurant Name</label><input type="text" id="ob-name" value="' + esc(s.bar_name || '') + '" placeholder="The Rusty Nail"/></div>'
      +   '<div class="f" style="flex:1.2;min-width:110px;"><label>City</label><input type="text" id="ob-city" value="' + esc(parts[0] || '') + '" placeholder="Austin"/></div>'
      +   '<div class="f" style="flex:0.8;min-width:90px;"><label>State / Province</label><input type="text" id="ob-state" value="' + esc(parts[1] || '') + '" placeholder="TX"/></div>'
      + '</div>'

      // ② Your Numbers
      + this._sectionHead(2, 'Your Numbers')
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin:-6px 0 12px 36px;">A best estimate is fine. These set the dollar baselines for the Profit Audit, the Recovery Scoreboard, and every dashboard. No food sales? Enter zero for food. Change either any time in App Settings.</div>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="flex:1;min-width:150px;"><label>Annual Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-bar-rev" value="' + v(s.annual_bar_revenue) + '"/></div></div>'
      +   '<div class="f" style="flex:1;min-width:150px;"><label>Annual Food Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-food-rev" value="' + v(s.annual_food_revenue) + '"/></div></div>'
      + '</div>'

      // ③ Service Periods
      + this._sectionHead(3, 'Service Periods')
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin:-6px 0 12px 36px;">Turn on the services you run. These set every shift-type field across Bar Cop, and Open the Floor pre-picks the right one by the time of day. Add a custom one if your venue runs something different.</div>'
      + '<div id="ob-sp-mount"></div>'

      + '<div id="ob-err" style="color:var(--red);font-size:12px;margin:16px 0 0;display:none;"></div>'
      + '<div class="ob-actions" style="margin-top:22px;justify-content:flex-start;"><button class="btn btn-primary btn-lg" style="width:100%;" id="ob-finish">Continue to Bar Cop</button></div>';

    this._spCtrl = window.ServicePeriods
      ? ServicePeriods.mount(document.getElementById('ob-sp-mount'), { selected: App.servicePeriods() })
      : null;

    document.getElementById('ob-name')?.focus();
    document.getElementById('ob-finish')?.addEventListener('click', () => this.finish());
  },

  async finish() {
    const err = document.getElementById('ob-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'block'; } };
    const name  = document.getElementById('ob-name')?.value.trim();
    const city  = document.getElementById('ob-city')?.value.trim();
    const state = document.getElementById('ob-state')?.value.trim();
    if (!name) { fail('Please enter your bar or restaurant name.'); document.getElementById('ob-name')?.focus(); return; }
    const all = this._spCtrl ? this._spCtrl.value() : [];
    if (all.some(p => !(p.name || '').trim())) { fail('Name your custom period, or turn it off.'); return; }
    const periods = all.filter(p => p && p.name);
    if (!periods.length) { fail('Pick at least one service period.'); return; }

    const s = App.data.settings;
    s.bar_name            = name;
    s.city_state          = city && state ? city + ', ' + state : city || state || '';
    s.annual_bar_revenue  = parseFloat(document.getElementById('ob-bar-rev')?.value)  || 0;
    s.annual_food_revenue = parseFloat(document.getElementById('ob-food-rev')?.value) || 0;
    s.service_periods     = periods;
    s.onboarding_complete = true;

    // The operator just filled identity, baselines, and service periods, so the
    // gs_profile and gs_service_periods Foundation tasks are done by definition.
    App.data.hub_setup_progress = App.data.hub_setup_progress || {};
    const now = new Date().toISOString();
    App.data.hub_setup_progress.gs_profile = now;
    App.data.hub_setup_progress.gs_service_periods = now;
    await App.saveKey('settings');
    await App.saveKey('hub_setup_progress');

    document.getElementById('ob-overlay').classList.add('hidden');
    if (S.HubGettingStarted) S.HubGettingStarted.open();
    else App.showHub();
  }
};
