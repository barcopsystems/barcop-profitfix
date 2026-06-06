'use strict';

/* ── Shift Control — Comp Authorization (writes App.shiftData.settings) ───────
   Comp-related policy settings that drive runtime behavior in Shift Control.
   Today: Comp Auth Threshold (drives the soft warning on Void/Comp Log when
   a comp over the threshold is filed without a manager in Authorized By).
   Lives in Shift Control's Setup section because it only affects Shift
   screens. Structured the same way sc-cash-settings is structured so future
   comp policies (per-shift-type thresholds, per-position rules) can layer in
   cleanly. */

S.ShiftCompSettings = {
  settings() {
    if (!App.shiftData) App.shiftData = {};
    if (!App.shiftData.settings) App.shiftData.settings = {};
    return App.shiftData.settings;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Comp Authorization Works', [
      { p: ['Comps above your threshold on the Void and Comp Log require a manager in the Authorized By field. Saving a comp over the threshold without a manager pops a soft warning the operator can override, and every override flags in Theft Risk under the Unauthorized Large Comps signal.'] },
      { p: ['The bartender comping a $40 round of drinks without manager involvement is one of the most common bar-theft patterns, and this is how Bar Cop catches it.'] },
      { h: 'Setting It', p: ['The default is $25. Set the threshold to 0 to disable the warning entirely.'] }
    ]);
  },

  draw() {
    const s = this.settings();
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card form-card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Comp Authorization Threshold</span>'
      + App.helpButton('ccs-how') + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:center;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Threshold ' + tt('ccs-threshold') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ccs-threshold" min="0" step="1" value="' + v(s.comp_auth_threshold != null ? s.comp_auth_threshold : 25) + '"/></div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ccs-save">Save Comp Policies</button>'
      + '<span id="ccs-msg" style="font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div>'
      + '</div>';

    document.getElementById('ccs-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('ccs-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const s = this.settings();
    const raw = document.getElementById('ccs-threshold')?.value;
    s.comp_auth_threshold = (raw === '' || raw == null) ? 25 : (parseFloat(raw) || 0);

    const btn = document.getElementById('ccs-save');
    const msg = document.getElementById('ccs-msg');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    if (btn) { btn.disabled = false; btn.textContent = 'Save Comp Policies'; }
    if (msg) {
      msg.style.display = 'inline';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.textContent = ok ? 'Saved.' : 'Save failed. Try again.';
      setTimeout(() => { if (msg) msg.style.display = 'none'; }, 2500);
    }
  }
};
