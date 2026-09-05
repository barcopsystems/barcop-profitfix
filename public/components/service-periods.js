'use strict';

/* ── Service Periods selector — shared by App Settings + Onboarding ───────────
   A single row of pill chips, one per service (plus a "+ Custom" pill that adds
   up to three named customs), with the
   multi-select feel of the Open-the-Floor registers: tap a pill to turn it gold,
   tap again to grey it off. Under each SELECTED pill sits a small "set hours"
   chip; tapping it drops down a little box to set that period's time window
   (Custom also names it), and Done closes it. One source so App Settings and
   onboarding never drift. Stored in settings.service_periods as [{id,name,start,end}].

   Usage:
     const ctrl = ServicePeriods.mount(el, { selected: App.servicePeriods() });
     ctrl.value();   // [{id,name,start,end,custom}] sorted by start time
*/
window.ServicePeriods = {
  get PRESETS() { return (typeof App !== 'undefined' && App.SERVICE_PERIOD_PRESETS) || []; },

  _min(t) { const a = String(t || '').split(':'); return (parseInt(a[0], 10) || 0) * 60 + (parseInt(a[1], 10) || 0); },
  _sorted(list) { return list.slice().sort((a, b) => this._min(a.start) - this._min(b.start)); },
  _isFullDay(p) { return this._min(p.start) === 0 && this._min(p.end) >= 1439; },
  _uid() { return (typeof App !== 'undefined' && App.uid) ? App.uid() : 'sp_' + Math.random().toString(36).slice(2, 9); },
  _fmtShort(t) {
    const m = this._min(t); let h = Math.floor(m / 60); const mm = m % 60;
    const ap = h < 12 ? 'a' : 'p'; h = h % 12; if (h === 0) h = 12;
    return h + ':' + String(mm).padStart(2, '0') + ap;
  },
  _windowLabel(p) {
    if (!p.start || !p.end) return 'Set hours';
    return this._fmtShort(p.start) + '–' + this._fmtShort(p.end);
  },

  /* ⛔⛔⛔ SERVICE PERIODS MAY NOT CROSS EACH OTHER (Kyle, 2026-09-05).
     *"a happy hour can be a shift.. but if it was a restaurant it wouldn't cross hours like the app
     does.. say lunch might be 10-2, happy hour 2-5, and then dinner 5-10... don't let them cross
     times.. it prompts them, sorry you already have a shift set at this time."*

     ⛔ THIS IS NOT A TIDINESS RULE, IT IS WHAT MAKES A TIP CLOSE POSSIBLE. Tips are closed out per
     shift: a server who works across two dayparts banks out at the end of each and tips out twice.
     That only has an answer if the dayparts are disjoint. MEASURED on the demo with the periods it
     currently seeds (Lunch 11-16, Happy Hour 15-18, Dinner 16-22, Late Night 22-02): NINE of twelve
     Saturday shifts straddle more than one period, and a 16:00-00:00 bartender lands on THREE.
     There is no honest way to tip that person out three times for one shift.
     ⚠ THE APP'S OWN PRESETS ARE ALREADY DISJOINT (06-11, 11-16, 16-22, 22-02). Only a custom
     period could ever cross, which is exactly what the demo's Happy Hour did.

     ⭐ ONE HELPER, CONSULTED BY EVERY MUTATION POINT. There are FOUR ways to create an overlap in
     this control (add a preset, add a custom — which defaults to 16:00-18:00 — edit From, edit To),
     and a rule enforced at three of them is not enforced ([[the-loop]] #94/#133: one rule missing
     from N doors gets ONE census, never N patches). */
  _overlap(a, b) {
    if (!a.start || !a.end || !b.start || !b.end) return false;
    // A window that ends at or before it starts wraps past midnight (Late Night 22:00-02:00), so
    // it is measured on a 48-hour line. Touching end-to-start is NOT a crossing: 11-16 and 16-22
    // are the adjacent dayparts this rule exists to allow.
    const span = p => { const s = this._min(p.start); let e = this._min(p.end); if (e <= s) e += 1440; return [s, e]; };
    const [as, ae] = span(a), [bs, be] = span(b);
    const hit = (x1, x2, y1, y2) => Math.max(x1, y1) < Math.min(x2, y2);
    // Compare both against each other's next-day copy too, or a wrapping window misses a morning one.
    return hit(as, ae, bs, be) || hit(as, ae, bs + 1440, be + 1440) || hit(as + 1440, ae + 1440, bs, be);
  },
  /* The period `cand` would collide with, or null. `cand` carries its own id so editing a period
     never reports it as conflicting with itself. */
  _conflict(list, cand) {
    return list.find(p => p.id !== cand.id && !this._isFullDay(p) && !this._isFullDay(cand) && this._overlap(p, cand)) || null;
  },
  /* The refusal, in Kyle's words: name the period already sitting on those hours and say when it
     is free, so the operator can act on it instead of guessing. */
  _clashText(cand, clash) {
    const nm = (clash.name || '').trim() || 'Another shift';
    return nm + ' is already set for ' + this._windowLabel(clash) + '. Shifts cannot overlap, so start this one at '
      + this._fmtShort(clash.end) + ' or later.';
  },
  /* Where a NEW custom period should open: the first gap after everything already set, an hour
     long. Falls back to a late slot when the day is full, and the caller still refuses if even
     that collides — so the default never lands on top of an existing shift. */
  _firstFreeSlot(list) {
    const pad = n => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
    const ends = list.filter(p => p.start && p.end && !this._isFullDay(p))
      .map(p => { const s = this._min(p.start); let e = this._min(p.end); if (e <= s) e += 1440; return e; });
    const from = ends.length ? Math.max(...ends) : 16 * 60;
    return { start: pad(from), end: pad(from + 60) };
  },

  mount(root, opts) {
    opts = opts || {};
    if (!root) return null;
    const self = this;
    let editingId = null;
    let warn = '';            // the overlap refusal, shown until the next successful change
    const ctrl = {
      periods: (opts.selected || []).map(p => ({ id: p.id || self._uid(), name: p.name, start: p.start || '', end: p.end || '', custom: !!p.custom })),
      value() { return self._sorted(this.periods).map(p => ({ id: p.id, name: p.name, start: p.start, end: p.end, custom: p.custom })); }
    };
    const emit = () => { if (opts.onChange) opts.onChange(ctrl.value()); };

    const pillStyle = on => 'padding:9px 16px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
      + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);' : 'background:var(--gold-tint);border:1px solid var(--b1);color:var(--t2);');
    const setStyle = 'font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid var(--b1);background:transparent;color:var(--t3);cursor:pointer;white-space:nowrap;';
    const inStyle = 'width:100%;background:var(--bg);border:1px solid var(--b1);border-radius:5px;padding:5px 7px;color:var(--t1);font-size:13px;box-sizing:border-box;';
    const tlbl = 'font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;';

    const popover = p => {
      const nameField = p.custom
        ? '<div style="' + tlbl + 'margin-bottom:3px;">Name</div><input type="text" class="sp-cname" value="' + esc(p.name || '') + '" placeholder="e.g. Happy Hour" style="' + inStyle + 'margin-bottom:9px;"/>'
        : '';
      return '<div class="sp-pop" style="position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:10;width:180px;background:var(--surface);border:1px solid var(--b-edge);border-radius:6px;padding:12px;box-shadow:0 10px 24px rgba(0,0,0,0.45);text-align:left;">'
        + nameField
        + '<div style="' + tlbl + 'margin-bottom:3px;">From</div><input type="time" class="sp-start" value="' + esc(p.start) + '" style="' + inStyle + '"/>'
        + '<div style="' + tlbl + 'margin:7px 0 3px;">To</div><input type="time" class="sp-end" value="' + esc(p.end) + '" style="' + inStyle + '"/>'
        + '<button type="button" class="btn btn-primary btn-sm sp-done" style="width:100%;margin-top:10px;">Done</button>'
        + '</div>';
    };

    // One pill + (when selected) its set-hours chip / drop-down, as a centered column.
    const unit = (label, kind, dataAttr, p) => {
      const on = !!p;
      let below = '';
      if (on) {
        below = this._isFullDay(p)
          ? '<span style="font-size:10px;color:var(--t3);">All day</span>'
          : '<button type="button" class="sp-set" data-id="' + esc(p.id) + '" style="' + setStyle + '">' + esc(self._windowLabel(p)) + '</button>'
            + (editingId === p.id ? popover(p) : '');
      }
      return '<div class="sp-unit" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;">'
        + '<button type="button" class="sp-pill" data-kind="' + kind + '"' + dataAttr + ' style="' + pillStyle(on) + '">' + esc(label) + '</button>'
        + below
        + '</div>';
    };

    const render = () => {
      const byName = nm => ctrl.periods.find(p => !p.custom && (p.name || '').toLowerCase() === nm.toLowerCase());
      const customs = ctrl.periods.filter(p => p.custom);

      const presetUnits = this.PRESETS.map(pr =>
        unit(pr.name, 'preset', ' data-name="' + esc(pr.name) + '"', byName(pr.name))
      ).join('');
      const customUnits = customs.map(c =>
        unit(c.name || 'Custom', 'custom', ' data-id="' + esc(c.id) + '"', c)
      ).join('');
      // Up to 3 customs; the "+ Custom" add pill shows until you have three.
      const addUnit = customs.length < 3 ? unit('Custom', 'custom-add', '', null) : '';

      // The refusal sits under the pills, where the operator is looking, and clears itself on the
      // next change that lands. It is a sentence, not a red border: a bare flag on a time input
      // does not say WHICH shift is in the way.
      const warnHtml = warn
        ? '<div class="sp-warn" style="margin-top:12px;font-size:12px;color:var(--amber);line-height:1.5;">' + esc(warn) + '</div>'
        : '';
      root.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:16px 12px;align-items:flex-start;">' + presetUnits + customUnits + addUnit + '</div>' + warnHtml;
      wire();
      emit();
    };

    const wire = () => {
      root.querySelectorAll('.sp-pill').forEach(btn => btn.addEventListener('click', () => {
        const kind = btn.dataset.kind;
        if (kind === 'preset') {
          const name = btn.dataset.name;
          const idx = ctrl.periods.findIndex(p => !p.custom && (p.name || '').toLowerCase() === name.toLowerCase());
          if (idx >= 0) { if (editingId === ctrl.periods[idx].id) editingId = null; ctrl.periods.splice(idx, 1); }
          else {
            const pr = this.PRESETS.find(x => x.name === name);
            if (pr) {
              // Door 1 of 4. A preset can cross a CUSTOM the operator already set.
              const cand = { id: this._uid(), name: pr.name, start: pr.start, end: pr.end, custom: false };
              const clash = self._conflict(ctrl.periods, cand);
              if (clash) { warn = self._clashText(cand, clash); render(); return; }
              ctrl.periods.push(cand);
            }
          }
        } else if (kind === 'custom') {
          const id = btn.dataset.id;
          if (editingId === id) editingId = null;
          ctrl.periods = ctrl.periods.filter(p => p.id !== id);
        } else {
          if (ctrl.periods.filter(p => p.custom).length >= 3) return;   // cap at 3
          /* Door 2 of 4, and the one that bites by default: a new custom used to land on a
             hardcoded 16:00-18:00, which crosses Dinner on the app's own presets. It now opens on
             the first free gap after the last period instead, so the common case is legal before
             the operator types anything. */
          const np = { id: this._uid(), name: '', custom: true };
          const slot = self._firstFreeSlot(ctrl.periods);
          np.start = slot.start; np.end = slot.end;
          if (self._conflict(ctrl.periods, np)) { warn = 'Your day is already covered. Free up some hours first.'; render(); return; }
          ctrl.periods.push(np);
          editingId = np.id;   // open the drop-down so they name + set it
        }
        render();
      }));
      root.querySelectorAll('.sp-set').forEach(chip => chip.addEventListener('click', () => {
        editingId = (editingId === chip.dataset.id) ? null : chip.dataset.id;
        render();
      }));
      const pop = root.querySelector('.sp-pop');
      if (pop) {
        const p = ctrl.periods.find(x => x.id === editingId);
        pop.querySelector('.sp-cname')?.addEventListener('input', e => { if (p) { p.name = e.target.value; emit(); } });
        /* Doors 3 and 4. The change is REFUSED and the old value put back, rather than accepted and
           flagged: a crossing pair that lives in the control until somebody notices is the state
           this rule exists to prevent, and an operator who saved mid-edit would keep it. */
        const timeEdit = (sel, field) => pop.querySelector(sel)?.addEventListener('change', e => {
          if (!p) return;
          const was = p[field];
          const cand = { id: p.id, name: p.name, start: p.start, end: p.end, custom: p.custom };
          cand[field] = e.target.value;
          const clash = self._conflict(ctrl.periods, cand);
          if (clash) { e.target.value = was; warn = self._clashText(cand, clash); render(); return; }
          p[field] = e.target.value; warn = ''; emit();
        });
        timeEdit('.sp-start', 'start');
        timeEdit('.sp-end', 'end');
        pop.querySelector('.sp-done')?.addEventListener('click', () => { editingId = null; render(); });
        pop.querySelector('.sp-cname')?.focus();
      }
    };

    render();
    return ctrl;
  }
};
