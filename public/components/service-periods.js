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

  mount(root, opts) {
    opts = opts || {};
    if (!root) return null;
    const self = this;
    let editingId = null;
    const ctrl = {
      periods: (opts.selected || []).map(p => ({ id: p.id || self._uid(), name: p.name, start: p.start || '', end: p.end || '', custom: !!p.custom })),
      value() { return self._sorted(this.periods).map(p => ({ id: p.id, name: p.name, start: p.start, end: p.end, custom: p.custom })); }
    };
    const emit = () => { if (opts.onChange) opts.onChange(ctrl.value()); };

    const pillStyle = on => 'padding:9px 16px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
      + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);' : 'background:#0D181E;border:1px solid var(--b1);color:var(--t2);');
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

      root.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:16px 12px;align-items:flex-start;">' + presetUnits + customUnits + addUnit + '</div>';
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
          else { const pr = this.PRESETS.find(x => x.name === name); if (pr) ctrl.periods.push({ id: this._uid(), name: pr.name, start: pr.start, end: pr.end, custom: false }); }
        } else if (kind === 'custom') {
          const id = btn.dataset.id;
          if (editingId === id) editingId = null;
          ctrl.periods = ctrl.periods.filter(p => p.id !== id);
        } else {
          if (ctrl.periods.filter(p => p.custom).length >= 3) return;   // cap at 3
          const np = { id: this._uid(), name: '', start: '16:00', end: '18:00', custom: true };
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
        pop.querySelector('.sp-start')?.addEventListener('change', e => { if (p) { p.start = e.target.value; emit(); } });
        pop.querySelector('.sp-end')?.addEventListener('change', e => { if (p) { p.end = e.target.value; emit(); } });
        pop.querySelector('.sp-done')?.addEventListener('click', () => { editingId = null; render(); });
        pop.querySelector('.sp-cname')?.focus();
      }
    };

    render();
    return ctrl;
  }
};
