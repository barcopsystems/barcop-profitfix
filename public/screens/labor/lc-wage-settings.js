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
      { p: ['Wage Policy holds the wage and tip settings that drive Labor Control: your state minimum wage, which powers the tip-credit check on Pay Periods, and your tip-out percentage.'] },
      { h: 'The Tip Credit Check', p: ['When a tipped employee\'s base wage plus their tip share falls below the minimum you set here for a week, Bar Cop flags that row on the Pay Periods detail so you can make up the difference before payroll runs. Set it once and every screen reads from this one value.'] },
      { h: 'Tip-Out % of Sales', p: ['If your servers and bartenders tip out a percentage of their sales to support staff, set it here. The Tip Log then shows a Sales column: each earner\'s sales times this percent is their tip-out, pooled and split to the support staff by hours, and each person\'s net tips carry into the tip-credit check and payroll worksheet. Leave it blank if your house pools tips or does not tip out. Bar Cop calculates the amounts only; how a tip-out is actually paid out is your and your payroll provider\'s call.'] },
      { h: 'Verify For Your Jurisdiction', p: ['This is a planning and review aid, not legal or payroll advice. Minimum wage, tip-credit, and tip-pool rules vary by state and city and change over time. Confirm the right figures and rules for your location before relying on the check.'] }
    ]);
  },

  draw() {
    const s = this.settings();
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card form-card">'
      + '<div class="card-title">Wage &amp; Tip Policy</div>'
      + '<div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>State Min Wage</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="lws-min-wage" min="0" step="0.01" value="' + v(s.state_min_wage != null ? s.state_min_wage : '') + '" placeholder="Per hour"/></div></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Tip-Out % of Sales</label>'
      + '<div class="fw"><input class="suf" type="number" id="lws-tipout" min="0" step="0.1" value="' + v(s.tip_out_pct != null ? s.tip_out_pct : '') + '" placeholder="0"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:10px;">Set a Tip-Out % to turn on tip-out tracking in the Tip Log: each server\'s sales times this percent is their tip-out, pooled and split to the support staff by hours. Leave it blank if your house pools tips or does not tip out.</div>'
      + '<div style="border:1px solid var(--amber);background:var(--bg);border-radius:6px;padding:12px 14px;margin-top:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop uses this value for planning and payroll review only. It is a software tool, not a payroll provider, tax preparer, or legal advisor. Minimum wage, tip credit, and tip-pool rules vary by federal, state, and local law, change over time, and some cities set their own rates. You and your payroll provider are responsible for verifying the correct wage and tip-credit requirements for your jurisdiction before processing payroll.</div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lws-save">Save Wage Policy</button>'
      + '<span id="lws-msg" style="font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div>'
      + '</div>';

    document.getElementById('lws-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const s = this.settings();
    const raw = document.getElementById('lws-min-wage')?.value;
    s.state_min_wage = (raw === '' || raw == null) ? null : (parseFloat(raw) || 0);
    const traw = document.getElementById('lws-tipout')?.value;
    s.tip_out_pct = (traw === '' || traw == null) ? null : (parseFloat(traw) || 0);

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
