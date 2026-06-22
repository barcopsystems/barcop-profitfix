'use strict';

/* ── Shift Control — Shift Policies (writes App.shiftData.settings) ───────────
   Combined Shift Control setup page for the two policy thresholds that drive
   when Bar Cop flags a shift:
     • Cash Variance Tolerance — default + per-shift-type overrides. Read at
       evaluation via App.cashToleranceForShift (shift override → per-type →
       default → 10 legacy fallback).
     • Comp Authorization Threshold — comps over this on the Void/Comp Log need
       a manager in Authorized By, else a soft warning + Theft Risk flag.
   Replaces the separate sc-cash-settings + sc-comp-settings pages; same settings
   keys, so every consumer (App.cashToleranceForShift, the comp warning) is
   unchanged. One Save below the cards; directions live in the nav "i". */

S.ShiftPolicies = {
  shiftTypes() { return App.SHIFT_TYPES; },
  settings() {
    if (!App.shiftData) App.shiftData = {};
    if (!App.shiftData.settings) App.shiftData.settings = {};
    if (App.shiftData.settings.tolerances_by_type == null) App.shiftData.settings.tolerances_by_type = {};
    return App.shiftData.settings;
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Shift Policies Work', [
      { p: ['Two thresholds that tell Bar Cop when to flag a shift: how far a drawer can be off, and how big a comp can get before a manager has to sign off. Set them once and they drive the warnings across Shift Control.'] },
      { h: 'Cash Variance Tolerance', p: ['Cash tolerance is the most a drawer can be off before Bar Cop flags it. A count under the tolerance stays green; over it, the drawer flags on the Variance Log and in Cash Reconciliation.'] },
      { h: 'Default vs Per Shift-Type', p: ['The Default Tolerance is your baseline; it applies to any shift type without its own number. Some shifts carry more cash risk than others (a busy late night is tougher to count tight than a slow brunch), so set a different tolerance for a shift type and it overrides the default for that type. Leave a type blank to inherit the default.'] },
      { h: 'One-Off Overrides', p: ['Start a Shift can still override the tolerance for one specific shift, without touching these settings.'] },
      { h: 'Comp Authorization', p: ['Comps above your threshold on the Void and Comp Log require a manager in the Authorized By field. Saving a comp over the threshold without a manager pops a soft warning the operator can override, and every override flags in Theft Risk under the Unauthorized Large Comps signal.'] },
      { p: ['The bartender comping a $40 round of drinks without manager involvement is one of the most common bar-theft patterns, and this is how Bar Cop catches it. The default is $25; set it to 0 to turn the warning off.'] }
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
        + '<div class="fw"><span class="pre">$</span><input class="pre sp-type-tol" type="number" min="0" step="0.5" '
        + 'data-type="' + esc(t) + '" value="' + v(cur) + '" placeholder="Inherit default"/></div></div>'
      + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      // ── Cash Variance Tolerance ──────────────────────────────────────────────
      + '<div class="card form-card">'
      + '<div class="card-title">Cash Variance Tolerance</div>'
      + '<div class="form-row" style="gap:14px;align-items:center;">'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Default Tolerance</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sp-default" min="0" step="0.5" value="' + v(s.cash_tolerance != null ? s.cash_tolerance : 10) + '"/></div></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;">The most a drawer can be off before a shift flags. Applies to any shift type without its own number below.</div>'
      + '<div class="divider"></div>'
      + '<div class="sh" style="margin-bottom:10px;">Per Shift-Type Defaults</div>'
      + typeRows
      + '</div>'
      // ── Comp Authorization ───────────────────────────────────────────────────
      + '<div class="card form-card">'
      + '<div class="card-title">Comp Authorization</div>'
      + '<div class="form-row" style="gap:14px;align-items:center;">'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Comp Auth Threshold</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sp-comp" min="0" step="1" value="' + v(s.comp_auth_threshold != null ? s.comp_auth_threshold : 25) + '"/></div></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;">Comps over this need a manager in Authorized By on the Void / Comp Log, or the shift flags in Theft Risk. Set to 0 to turn the warning off.</div>'
      + '</div>'
      // ── Save (below the cards) ───────────────────────────────────────────────
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="sp-save">Save Shift Policies</button>'
      + '<span id="sp-msg" style="font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div>';

    document.getElementById('sp-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const s = this.settings();
    const numOr = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };

    s.cash_tolerance = numOr(document.getElementById('sp-default')?.value, 10);
    const byType = {};
    document.querySelectorAll('.sp-type-tol').forEach(inp => {
      const t = inp.dataset.type;
      const raw = inp.value;
      if (raw === '' || raw == null) return;  // blank = inherit
      const n = parseFloat(raw);
      if (!isNaN(n)) byType[t] = n;
    });
    s.tolerances_by_type = byType;

    const compRaw = document.getElementById('sp-comp')?.value;
    s.comp_auth_threshold = (compRaw === '' || compRaw == null) ? 25 : (parseFloat(compRaw) || 0);

    const btn = document.getElementById('sp-save');
    const msg = document.getElementById('sp-msg');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    if (btn) { btn.disabled = false; btn.textContent = 'Save Shift Policies'; }
    if (msg) {
      msg.style.display = 'inline';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.textContent = ok ? 'Saved.' : 'Save failed. Try again.';
      setTimeout(() => { if (msg) msg.style.display = 'none'; }, 2500);
    }
  }
};
