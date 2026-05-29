'use strict';

/* ── Onboarding — the first-run doorway, not the setup ────────────────────────
   Three light steps: identity, operation profile, orientation. It captures
   only what the Hub needs from minute one (name, location, dollar baselines)
   and hands off to the unified Hub Getting Started for the six-module setup.
   The setup checklist is the wizard; onboarding is just the front door. */
const Onboarding = {
  _step: 1,

  // Shared recessed box style for the explanatory text on every step. Same
  // visual treatment across all three steps for cohesion.
  _boxStyle: 'background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:16px 18px;margin-bottom:18px;font-size:12px;color:var(--t2);line-height:1.7;text-align:left;',

  start() {
    this._step = 1;
    document.getElementById('ob-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.render();
  },

  render() {
    if (this._step === 1)      this.renderIdentity();
    else if (this._step === 2) this.renderProfile();
    else                       this.renderOrientation();
  },

  _stepDots(n) {
    return '<div style="text-align:center;font-size:9px;font-weight:700;letter-spacing:2px;'
      + 'text-transform:uppercase;color:var(--t3);margin-bottom:24px;">Step ' + n + ' of 3</div>';
  },

  // ── Step 1 — Welcome and identity ───────────────────────────────────────────
  renderIdentity() {
    const s = App.data.settings;
    const parts = (s.city_state || '').split(',').map(p => p.trim());
    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:6px;">Welcome to Bar Cop</div>'
      + this._stepDots(1)
      + '<div style="' + this._boxStyle + '">'
      +   'Bar Cop captures your daily operation, identifies where profit and revenue are leaking, and shows you exactly what to fix. '
      +   'Start with your bar or restaurant name and where you operate, and the rest of the setup follows from there.'
      + '</div>'
      + '<div style="display:flex;gap:14px;margin-bottom:14px;">'
      + '<div class="f" style="flex:2;"><label>Bar / Restaurant Name</label><input type="text" id="ob-name" value="' + esc(s.bar_name || '') + '" placeholder="The Rusty Nail"/></div>'
      + '<div class="f" style="flex:1.2;"><label>City</label><input type="text" id="ob-city" value="' + esc(parts[0] || '') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="flex:0.8;"><label>State / Province</label><input type="text" id="ob-state" value="' + esc(parts[1] || '') + '" placeholder="TX"/></div>'
      + '</div>'
      + '<div id="ob-err" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none;"></div>'
      + '<div class="ob-actions" style="margin-top:20px;"><button class="btn btn-primary btn-lg" style="width:100%;" id="ob-next">Continue</button></div>';

    document.getElementById('ob-name')?.focus();
    document.getElementById('ob-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('ob-next')?.click();
    });
    document.getElementById('ob-next')?.addEventListener('click', () => {
      const name  = document.getElementById('ob-name')?.value.trim();
      const city  = document.getElementById('ob-city')?.value.trim();
      const state = document.getElementById('ob-state')?.value.trim();
      if (!name) {
        const e = document.getElementById('ob-err');
        if (e) { e.textContent = 'Please enter your bar or restaurant name.'; e.style.display = 'block'; }
        return;
      }
      App.data.settings.bar_name   = name;
      App.data.settings.city_state = city && state ? city + ', ' + state : city || state || '';
      this._step = 2;
      this.render();
    });
  },

  // ── Step 2 — Operation profile ──────────────────────────────────────────────
  renderProfile() {
    const s = App.data.settings;
    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:6px;">Your Operation</div>'
      + this._stepDots(2)
      + '<div style="' + this._boxStyle + '">'
      +   'A best estimate is fine here, not exact figures. These annual revenue numbers set the dollar baselines for the Profit Audit, the Recovery Scoreboard, and every dashboard percentage, so a rough number now lets every calculation start working today. '
      +   'If you do not run food sales, enter zero for food. You can adjust either number any time from App Settings under Profile as the year goes on.'
      + '</div>'
      + '<div style="display:flex;gap:14px;margin-bottom:14px;">'
      + '<div class="f" style="flex:1;"><label>Annual Bar Revenue ' + tt('hs-ann-bar-rev') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-bar-rev" value="' + (s.annual_bar_revenue || '') + '"/></div></div>'
      + '<div class="f" style="flex:1;"><label>Annual Food Revenue ' + tt('hs-ann-food-rev') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ob-food-rev" value="' + (s.annual_food_revenue || '') + '"/></div></div>'
      + '</div>'
      + '<div class="ob-actions" style="margin-top:18px;display:flex;gap:10px;">'
      + '<button class="btn btn-ghost btn-lg" id="ob-back">Back</button>'
      + '<button class="btn btn-primary btn-lg" style="flex:1;" id="ob-next">Continue</button>'
      + '</div>';

    document.getElementById('ob-back')?.addEventListener('click', () => { this._step = 1; this.render(); });
    document.getElementById('ob-next')?.addEventListener('click', () => {
      App.data.settings.annual_bar_revenue  = parseFloat(document.getElementById('ob-bar-rev')?.value)  || 0;
      App.data.settings.annual_food_revenue = parseFloat(document.getElementById('ob-food-rev')?.value) || 0;
      this._step = 3;
      this.render();
    });
  },

  // ── Step 3 — Orientation and handoff ────────────────────────────────────────
  renderOrientation() {
    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:6px;">How Bar Cop Works</div>'
      + this._stepDots(3)
      + '<div style="' + this._boxStyle + '">'
      +   'Three <strong style="color:var(--t1);">Control</strong> systems run the day: Inventory, Labor, Shift. Three <strong style="color:var(--t1);">Recovery</strong> systems run the diagnosis: Profit, Revenue, Traffic. Each Recovery system gives you a scored monthly <strong style="color:var(--t1);">Audit</strong>, a <strong style="color:var(--t1);">Fix Process</strong> that walks you through closing every gap step by step, and a <strong style="color:var(--t1);">Recovery Scoreboard</strong> that tallies every dollar you put back into the business. The <strong style="color:var(--t1);">Bar Cop Audit</strong> sits above all six and gives you the executive monthly read on the whole operation.'
      +   '<div style="margin-top:10px;">Next, complete the short setup list. Once your numbers are in, the systems start tracking, scoring, and measuring recovery automatically.</div>'
      + '</div>'
      + '<div class="ob-actions" style="display:flex;gap:10px;">'
      + '<button class="btn btn-ghost btn-lg" id="ob-back">Back</button>'
      + '<button class="btn btn-primary btn-lg" style="flex:1;" id="ob-finish">Continue</button>'
      + '</div>';

    document.getElementById('ob-back')?.addEventListener('click', () => { this._step = 2; this.render(); });

    document.getElementById('ob-finish')?.addEventListener('click', async () => {
      App.data.settings.onboarding_complete = true;
      // The operator just filled in bar name, location, and annual revenue
      // across steps 1 and 2 -- the gs_profile setup task is done by
      // definition. Auto-complete it so Getting Started reflects that on
      // first open (gs_profile shows checked off and lined through).
      App.data.hub_setup_progress = App.data.hub_setup_progress || {};
      App.data.hub_setup_progress.gs_profile = new Date().toISOString();
      await App.saveKey('settings');
      await App.saveKey('hub_setup_progress');
      document.getElementById('ob-overlay').classList.add('hidden');
      // Hand off to the unified setup checklist, not the empty Hub Dashboard.
      // The dashboard becomes the natural landing once setup is meaningful.
      if (S.HubGettingStarted) S.HubGettingStarted.open();
      else App.showHub();
    });
  }
};
