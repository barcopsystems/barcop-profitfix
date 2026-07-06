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

  // opts.newBar = true → adding a bar to an existing account. The form starts
  // blank, gets a Cancel, and Continue goes to the plan gate instead of saving
  // to the current bar (nothing persists until they pay for the new bar).
  start(opts) {
    this._newBar = !!(opts && opts.newBar);
    document.getElementById('ob-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.render();
  },

  render() {
    const nb = this._newBar;
    const s = App.data.settings;
    const parts = nb ? [] : (s.city_state || '').split(',').map(p => p.trim());

    // Pre-fill the name: for a bar added via Add Another Bar, the modal already
    // set accounts.name, so seed it here (unless a real bar_name is already set).
    // Skip a still-default account name (the signup email or "My Bar").
    // The signup trigger names a fresh account after the user's email, and
    // add-account defaults to "My Bar" — skip those, but pre-fill any real name
    // (compare to the actual email, so a bar legitimately named "Bar @ 5th" fills).
    // A brand-new bar (nb) always starts blank.
    const acctName = (window.DB && DB.activeAccountName) ? DB.activeAccountName() : null;
    const userEmail = (window.DB && DB._user && DB._user.email) || '';
    const acctNameReal = acctName && acctName !== userEmail && acctName !== 'My Bar';
    const prefillName = nb ? '' : (s.bar_name || (acctNameReal ? acctName : ''));

    const basics = '<div class="ob-row" style="display:flex;gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1.4;min-width:150px;"><label>Bar / Restaurant Name</label><input type="text" id="ob-name" value="' + esc(prefillName) + '" placeholder="The Rusty Nail"/></div>'
      + '<div class="f" style="flex:1.2;min-width:110px;"><label>City</label><input type="text" id="ob-city" value="' + esc(parts[0] || '') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="flex:0 0 132px;"><label>State / Province</label><input type="text" id="ob-state" value="' + esc(parts[1] || '') + '" placeholder="TX"/></div>'
      + '</div>';

    // Onboarding always opens with Lunch / Dinner / Late Night on (Breakfast and
    // Custom off) unless the account already saved its own service periods. A
    // brand-new bar always starts from the defaults.
    const savedSP = nb ? null : s.service_periods;
    const defaultSP = App.SERVICE_PERIOD_PRESETS
      .filter(p => p.name !== 'Breakfast')
      .map(p => ({ id: 'sp_ob_' + p.name.toLowerCase().replace(/[^a-z]/g, ''), name: p.name, start: p.start, end: p.end }));
    const initialSP = (Array.isArray(savedSP) && savedSP.length) ? savedSP : defaultSP;

    // The Basics + Service Periods share one dark wrapper (same as the login
    // email/password box), split by a divider, no numbered circles.
    const secLabel = 'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--t1);margin-bottom:12px;';
    const wrapper = '<div class="auth-inputs" style="text-align:left;">'
      + '<div style="' + secLabel + '">The Basics</div>'
      + basics
      + '<div style="border-top:1px solid var(--b-edge);margin:18px 0;"></div>'
      + '<div style="' + secLabel + '">Service Periods</div>'
      + '<div style="' + this._help + '">Tap on the service periods you run and set the times.</div>'
      + '<div id="ob-sp-mount"></div>'
      + '</div>';

    const heading = nb ? 'Set Up Your New Bar' : 'Welcome to Bar Cop';
    const sub     = nb ? 'Enter the basics for this location.' : 'Your POS rings the sales. Bar Cop runs the business.';
    const btnText = nb ? 'Continue' : 'Continue to Bar Cop';
    const cancelHTML = nb
      ? '<div style="text-align:center;margin-top:14px;"><button class="auth-link" id="ob-cancel" style="font-size:12px;">Cancel</button></div>'
      : '';

    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:8px;">' + heading + '</div>'
      + '<div class="ob-sub" style="max-width:none;text-align:center;">' + sub + '</div>'
      + wrapper
      + '<div id="ob-err" style="color:var(--red);font-size:12px;margin:16px 0 0;display:none;text-align:center;"></div>'
      + '<div class="ob-actions" style="margin-top:24px;justify-content:flex-start;"><button class="btn btn-primary" style="width:100%;padding:14px 20px;font-size:12px;" id="ob-finish">' + btnText + '</button></div>'
      + cancelHTML;

    this._spCtrl = window.ServicePeriods
      ? ServicePeriods.mount(document.getElementById('ob-sp-mount'), { selected: initialSP })
      : null;

    document.getElementById('ob-name')?.focus();
    document.getElementById('ob-finish')?.addEventListener('click', () => this.finish());
    document.getElementById('ob-cancel')?.addEventListener('click', () => { if (App._returnToUserAccounts) App._returnToUserAccounts(); });
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

    const city  = document.getElementById('ob-city').value.trim();
    const state = document.getElementById('ob-state').value.trim();
    const draft = {
      bar_name:        document.getElementById('ob-name').value.trim(),
      city_state:      city && state ? city + ', ' + state : city || state || '',
      service_periods: periods
    };

    // New bar: nothing is saved to any account yet. Hand the draft to the plan
    // gate; the bar is created + these settings applied only after payment.
    if (this._newBar) {
      document.getElementById('ob-overlay').classList.add('hidden');
      App.showPlanGate({ newBar: true, draft });
      return;
    }

    const s = App.data.settings;
    s.bar_name            = draft.bar_name;
    s.city_state          = draft.city_state;
    s.service_periods     = draft.service_periods;
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
