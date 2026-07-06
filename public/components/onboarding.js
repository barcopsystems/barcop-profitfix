'use strict';

/* ── Onboarding — the first-run doorway, not the setup ────────────────────────
   One screen after login. The orientation lives in a short intro at the top; the
   only things captured are what the Hub needs from minute one: identity, dollar
   baselines, and the services you run. Numbered gold circles sit in their own
   left column (the same badge the Getting Started page uses) with everything
   aligned to their right, so login -> onboarding -> setup reads as one flow. */
const Onboarding = {
  _spCtrl: null,
  _help: 'font-size:11px;color:var(--t3);line-height:1.5;margin-bottom:11px;',

  start() {
    document.getElementById('ob-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.render();
  },

  // A section = the numbered gold circle in its own left column, with the title
  // and everything else aligned to its right (nothing sits under the circle).
  _section(n, title, body) {
    return '<div style="margin-top:34px;">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">'
      +   '<div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;">' + n + '</div>'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--t1);">' + title + '</div>'
      + '</div>'
      + '<div style="margin-left:36px;">' + body + '</div>'
      + '</div>';
  },

  render() {
    const s = App.data.settings;
    const parts = (s.city_state || '').split(',').map(p => p.trim());
    const v = x => (x != null && x !== '') ? x : '';

    // Pre-fill the name: for a bar added via Add Another Bar, the modal already
    // set accounts.name, so seed it here (unless a real bar_name is already set).
    // Skip a still-default account name (the signup email or "My Bar").
    // The signup trigger names a fresh account after the user's email, and
    // add-account defaults to "My Bar" — skip those, but pre-fill any real name
    // (compare to the actual email, so a bar legitimately named "Bar @ 5th" fills).
    const acctName = (window.DB && DB.activeAccountName) ? DB.activeAccountName() : null;
    const userEmail = (window.DB && DB._user && DB._user.email) || '';
    const acctNameReal = acctName && acctName !== userEmail && acctName !== 'My Bar';
    const prefillName = s.bar_name || (acctNameReal ? acctName : '');

    const basics = '<div class="ob-row" style="display:flex;gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:2;min-width:170px;"><label>Bar / Restaurant Name</label><input type="text" id="ob-name" value="' + esc(prefillName) + '" placeholder="The Rusty Nail"/></div>'
      + '<div class="f" style="flex:1.2;min-width:110px;"><label>City</label><input type="text" id="ob-city" value="' + esc(parts[0] || '') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="flex:0.8;min-width:90px;"><label>State / Province</label><input type="text" id="ob-state" value="' + esc(parts[1] || '') + '" placeholder="TX"/></div>'
      + '</div>';

    const service = '<div style="' + this._help + '">Turn on the services you run. Tap one to set its hours.</div>'
      + '<div id="ob-sp-mount"></div>';

    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:8px;">Welcome to Bar Cop</div>'
      + '<div class="ob-sub" style="max-width:none;text-align:center;">Bar Cop finds where your profit and revenue are leaking and shows you what to fix.<br>Set your basics below and you are ready to go.</div>'
      + this._section(1, 'The Basics', basics)
      + this._section(2, 'Service Periods', service)
      + '<div id="ob-err" style="color:var(--red);font-size:12px;margin:16px 0 0;display:none;text-align:center;"></div>'
      + '<div class="ob-actions" style="margin-top:24px;justify-content:flex-start;"><button class="btn btn-primary btn-lg" style="width:100%;" id="ob-finish">Continue to Bar Cop</button></div>';

    this._spCtrl = window.ServicePeriods
      ? ServicePeriods.mount(document.getElementById('ob-sp-mount'), { selected: App.servicePeriods() })
      : null;

    document.getElementById('ob-name')?.focus();
    document.getElementById('ob-finish')?.addEventListener('click', () => this.finish());
    ['ob-name', 'ob-city', 'ob-state'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', e => e.target.closest('.f')?.classList.remove('ob-invalid'));
    });
  },

  async finish() {
    const err = document.getElementById('ob-err');
    const showErr = m => { if (err) { err.textContent = m; err.style.display = 'block'; } };
    if (err) err.style.display = 'none';

    // Required cells flag with a red border only, no message.
    let firstBad = null;
    ['ob-name', 'ob-city', 'ob-state'].forEach(id => {
      const el = document.getElementById(id);
      const blank = !el || !(el.value || '').trim();
      el?.closest('.f')?.classList.toggle('ob-invalid', blank);
      if (blank && !firstBad) firstBad = el;
    });

    const all = this._spCtrl ? this._spCtrl.value() : [];
    const unnamed = all.some(p => !(p.name || '').trim());
    const periods = all.filter(p => p && p.name);
    if (unnamed) showErr('Name your custom period, or turn it off.');
    else if (!periods.length) showErr('Pick at least one service period.');

    if (firstBad || unnamed || !periods.length) { firstBad?.focus(); return; }

    const s = App.data.settings;
    const city  = document.getElementById('ob-city').value.trim();
    const state = document.getElementById('ob-state').value.trim();
    s.bar_name            = document.getElementById('ob-name').value.trim();
    s.city_state          = city && state ? city + ', ' + state : city || state || '';
    s.service_periods     = periods;
    s.onboarding_complete = true;
    await App.saveKey('settings');

    // Keep the bar switcher (accounts.name) in sync with the name just set.
    try {
      if (window.DB && DB.setAccountName) {
        await DB.setAccountName(s.bar_name);
        if (App.renderAccountSwitcher) await App.renderAccountSwitcher();
      }
    } catch (e) { console.error('account name sync', e); }

    document.getElementById('ob-overlay').classList.add('hidden');
    App.showHub();
  }
};
