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

  draw() {
    const s = this.settings();
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div class="card-title">State Minimum Wage</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:14px;">'
        + 'Your state\'s minimum wage drives the tip credit check on the Payroll CSV. If a tipped employee\'s base wage plus their tip share falls below state minimum for the week, Bar Cop flags the row on Pay Periods detail so you can make up the difference before payroll runs. Set it once here; every consumer reads from this single value.'
      + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:center;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>State Min Wage (per hour)</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="lws-min-wage" min="0" step="0.01" value="' + v(s.state_min_wage != null ? s.state_min_wage : '') + '" placeholder="Per hour"/></div></div>'
      + '<div style="font-size:11px;color:var(--t3);padding-bottom:10px;">Leave blank if your jurisdiction does not allow tip credit or you do not run tip credit math.</div>'
      + '</div>'
      + '</div>'

      + '<div class="card-actions" style="margin-top:6px;">'
      + '<button class="btn btn-primary" id="lws-save">Save Wage Policies</button>'
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
    if (btn) { btn.disabled = false; btn.textContent = 'Save Wage Policies'; }
    if (msg) {
      msg.style.display = 'inline';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.textContent = ok ? 'Saved.' : 'Save failed. Try again.';
      setTimeout(() => { if (msg) msg.style.display = 'none'; }, 2500);
    }
  }
};
