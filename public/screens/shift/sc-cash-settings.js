'use strict';

/* ── Shift Control — Cash Settings (writes App.shiftData.settings) ────────────
   Default cash variance tolerance + per-shift-type defaults. Lives in Shift
   Control's Setup section because it only affects Shift screens. Hub
   Settings no longer carries cash_tolerance; this is the home now.

   Tolerance lookup order at evaluation time (App.cashToleranceForShift):
     1. shift.cash_tolerance — per-shift override set on Start a Shift
     2. App.shiftData.settings.tolerances_by_type[shift_type]
     3. App.shiftData.settings.cash_tolerance — overall default
     4. 10 — last-resort legacy fallback */

S.ShiftCashSettings = {
  shiftTypes() {
    return App.SHIFT_TYPES;
  },
  settings() {
    if (!App.shiftData) App.shiftData = {};
    if (!App.shiftData.settings) App.shiftData.settings = {};
    if (App.shiftData.settings.tolerances_by_type == null) App.shiftData.settings.tolerances_by_type = {};
    return App.shiftData.settings;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const s = this.settings();
    const v = val => (val != null && val !== '') ? val : '';

    const typeRows = this.shiftTypes().map(t => {
      const cur = s.tolerances_by_type[t];
      return '<div class="form-row" style="gap:14px;align-items:center;margin-bottom:8px;">'
        + '<div style="width:200px;flex-shrink:0;font-size:13px;color:var(--t1);font-weight:600;">' + esc(t) + '</div>'
        + '<div class="f" style="width:160px;flex-shrink:0;margin:0;">'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" min="0" step="0.5" '
        + 'data-type="' + esc(t) + '" class="cs-type-tol" value="' + v(cur) + '" placeholder="Inherit default"/></div></div>'
      + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div class="card-title">Default Cash Variance Tolerance</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:14px;">'
        + 'The maximum dollar amount you treat as acceptable for a drawer to be off. Variance under this stays green; over flags the shift on Variance Log, Cash Reconciliation, and the Shift Handoff Report. This is the baseline; per-shift-type defaults below can override it for a specific shift, and Start a Shift lets the operator override for one specific shift.'
      + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:center;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Default Tolerance</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cs-default" min="0" step="0.5" value="' + v(s.cash_tolerance != null ? s.cash_tolerance : 10) + '"/></div></div>'
      + '<div style="font-size:11px;color:var(--t3);padding-bottom:10px;">Applies to any shift type that does not have its own default below.</div>'
      + '</div>'
      + '</div>'

      + '<div class="card">'
      + '<div class="card-title">Per Shift-Type Defaults <span style="color:var(--t4);font-weight:400;font-size:12px;text-transform:none;letter-spacing:0;">(optional)</span></div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:14px;">'
        + 'If a shift type runs different cash risk (busy late nights are tougher to count tight than a slow brunch), set a different tolerance for that shift type. Leave blank to inherit the default above.'
      + '</div>'
      + typeRows
      + '</div>'

      + '<div class="card-actions" style="margin-top:6px;">'
      + '<button class="btn btn-primary" id="cs-save">Save Cash Settings</button>'
      + '<span id="cs-msg" style="font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div>';

    document.getElementById('cs-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const s = this.settings();
    const numOr = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };

    s.cash_tolerance = numOr(document.getElementById('cs-default')?.value, 10);
    const byType = {};
    document.querySelectorAll('.cs-type-tol').forEach(inp => {
      const t = inp.dataset.type;
      const raw = inp.value;
      if (raw === '' || raw == null) return;  // blank = inherit
      const n = parseFloat(raw);
      if (!isNaN(n)) byType[t] = n;
    });
    s.tolerances_by_type = byType;

    const btn = document.getElementById('cs-save');
    const msg = document.getElementById('cs-msg');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    if (btn) { btn.disabled = false; btn.textContent = 'Save Cash Settings'; }
    if (msg) {
      msg.style.display = 'inline';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.textContent = ok ? 'Saved.' : 'Save failed. Try again.';
      setTimeout(() => { if (msg) msg.style.display = 'none'; }, 2500);
    }
  }
};
