'use strict';

/* ── Labor Control — Wage Policies (writes App.laborData.settings) ────────────
   Wage-related policy settings that drive runtime behavior in Labor Control.
   Today: State Minimum Wage (drives the tip-credit compliance check on the
   Pay Periods Payroll CSV). Lives in Labor Control's Setup section because
   it only affects Labor screens. Structured the same way Shift Control's
   sc-cash-settings is structured so future wage policies (overtime
   thresholds, jurisdictional overrides) can layer in cleanly. */

S.LaborWageSettings = {
  settings() {
    if (!App.laborData) App.laborData = {};
    if (!App.laborData.settings) App.laborData.settings = {};
    return App.laborData.settings;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Wage Policy Works', [
      { p: ['Wage Policy holds your state minimum wage, the one figure Labor Control needs for the tip-credit check on Pay Periods. Set it once here and every screen reads from this value.'] },
      { h: 'The Tip Credit Check', p: ['When a tipped employee\'s base wage plus their tips for a week falls below the minimum you set here, Bar Cop flags that row on the Pay Periods detail so you can make up the difference before payroll runs.'] },
      { h: 'Verify For Your Jurisdiction', p: ['This is a planning and review aid, not legal or payroll advice. Minimum wage and tip-credit rules vary by state and city and change over time. Confirm the right figure and rules for your location before relying on the check.'] }
    ]);
  },

  draw() {
    const s = this.settings();
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card form-card">'
      + '<div class="card-title">State Minimum Wage</div>'
      + '<div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>State Min Wage</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="lws-min-wage" min="0" step="0.01" value="' + v(s.state_min_wage != null ? s.state_min_wage : '') + '" placeholder="Per hour"/></div></div>'
      + '</div>'
      + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop uses this value for planning and payroll review only. It is a software tool, not a payroll provider, tax preparer, or legal advisor. Minimum wage, tip credit, and tip-pool rules vary by federal, state, and local law, change over time, and some cities set their own rates. You and your payroll provider are responsible for verifying the correct wage and tip-credit requirements for your jurisdiction before processing payroll.</div>'
      + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="lws-save">Save Wage Policy</button>'
      + '<span id="lws-msg" style="font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div>';

    document.getElementById('lws-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const s = this.settings();
    const raw = document.getElementById('lws-min-wage')?.value;
    s.state_min_wage = (raw === '' || raw == null) ? null : (parseFloat(raw) || 0);

    const btn = document.getElementById('lws-save');
    const msg = document.getElementById('lws-msg');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    if (btn) { btn.disabled = false; btn.textContent = 'Save Wage Policy'; }
    if (msg) {
      msg.style.display = 'inline';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.textContent = ok ? 'Saved.' : 'Save failed. Try again.';
      setTimeout(() => { if (msg) msg.style.display = 'none'; }, 2500);
    }
  }
};
