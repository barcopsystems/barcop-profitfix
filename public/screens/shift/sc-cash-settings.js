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

  showHowTo() {
    App.showHelpModal('How Cash Tolerances Work', [
      { p: ['Cash tolerance is the most a drawer can be off before Bar Cop flags it. A count that comes in under the tolerance stays green; over it, the shift flags on the Variance Log, Cash Reconciliation, and the Shift Handoff Report.'] },
      { h: 'The Default', p: ['The Default Tolerance is your baseline. It applies to any shift type that does not have its own number set below.'] },
      { h: 'Per Shift-Type', p: ['Some shifts carry more cash risk than others. A busy late night is tougher to count tight than a slow brunch. Set a different tolerance for a shift type here and it overrides the default for that type. Leave a type blank to inherit the default.'] },
      { h: 'One-Off Overrides', p: ['Start a Shift can still override the tolerance for one specific shift, without touching these settings.'] }
    ]);
  },

  draw() {
    const s = this.settings();
    const v = val => (val != null && val !== '') ? val : '';

    const typeRows = this.shiftTypes().map(t => {
      const cur = s.tolerances_by_type[t];
      return '<div class="form-row" style="gap:14px;align-items:center;margin-bottom:8px;">'
        + '<div style="width:200px;flex-shrink:0;font-size:13px;color:var(--t1);font-weight:600;">' + esc(t) + '</div>'
        + '<div class="f" style="width:160px;flex-shrink:0;margin:0;">'
        + '<div class="fw"><span class="pre">$</span><input class="pre cs-type-tol" type="number" min="0" step="0.5" '
        + 'data-type="' + esc(t) + '" value="' + v(cur) + '" placeholder="Inherit default"/></div></div>'
      + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card sc-dr-form">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Default Cash Variance Tolerance</span>'
      + App.helpButton('cs-how') + '</div>'
      + '<div class="form-row" style="gap:14px;align-items:center;">'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Default Tolerance ' + tt('cs-tolerance') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cs-default" min="0" step="0.5" value="' + v(s.cash_tolerance != null ? s.cash_tolerance : 10) + '"/></div></div>'
      + '</div>'
      + '</div>'

      + '<div class="card sc-dr-form">'
      + '<div class="card-title">Per Shift-Type Defaults</div>'
      + typeRows
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="cs-save">Save Cash Settings</button>'
      + '<span id="cs-msg" style="font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div>'
      + '</div>';

    document.getElementById('cs-how')?.addEventListener('click', () => this.showHowTo());
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
