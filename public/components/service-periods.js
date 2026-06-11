'use strict';

/* ── Service Periods selector — shared by App Settings + Onboarding ───────────
   The operator picks which services they run as gold-tint preset chips, plus a
   custom one they can name. Each selected period carries a time window (used to
   auto-pick the daypart on Open the Floor). One source so the two doors never
   drift. Stored in settings.service_periods as [{id,name,start,end}].

   Usage:
     const ctrl = ServicePeriods.mount(el, { selected: App.servicePeriods() });
     ctrl.value();   // [{id,name,start,end,custom}] sorted by start time
*/
window.ServicePeriods = {
  get PRESETS() { return (window.App && App.SERVICE_PERIOD_PRESETS) || []; },

  _min(t) { const a = String(t || '').split(':'); return (parseInt(a[0], 10) || 0) * 60 + (parseInt(a[1], 10) || 0); },
  _fmt(t) {
    const m = this._min(t); let h = Math.floor(m / 60); const mm = m % 60;
    const ap = h < 12 ? 'AM' : 'PM'; h = h % 12; if (h === 0) h = 12;
    return h + ':' + String(mm).padStart(2, '0') + ' ' + ap;
  },
  _sorted(list) { return list.slice().sort((a, b) => this._min(a.start) - this._min(b.start)); },
  _uid() { return (window.App && App.uid) ? App.uid() : 'sp_' + Math.random().toString(36).slice(2, 9); },

  mount(root, opts) {
    opts = opts || {};
    if (!root) return null;
    const ctrl = {
      periods: (opts.selected || []).map(p => ({ id: p.id || this._uid(), name: p.name, start: p.start || '', end: p.end || '', custom: !!p.custom })),
      value() { return ServicePeriods._sorted(this.periods).map(p => ({ id: p.id, name: p.name, start: p.start, end: p.end, custom: p.custom })); }
    };
    ctrl.periods.forEach(p => { if (!p.id) p.id = this._uid(); });
    const emit = () => { if (opts.onChange) opts.onChange(ctrl.value()); };

    const inputStyle = 'width:118px;flex:0 0 auto;';
    const render = () => {
      const selected = new Set(ctrl.periods.map(p => (p.name || '').toLowerCase()));
      const chips = this.PRESETS.map(pr => {
        const on = selected.has(pr.name.toLowerCase());
        return '<button type="button" class="sp-chip" data-name="' + esc(pr.name) + '" style="'
          + (on
              ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);')
          + 'border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;">' + esc(pr.name) + '</button>';
      }).join('');

      const list = this._sorted(ctrl.periods);
      const rows = list.length
        ? list.map(p =>
            '<div class="sp-row" data-id="' + esc(p.id) + '" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--row-div);">'
            + '<div style="flex:1;min-width:110px;font-size:13px;font-weight:700;color:var(--t1);">' + esc(p.name) + (p.custom ? ' <span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--t3);text-transform:uppercase;">custom</span>' : '') + '</div>'
            + '<input type="time" class="form-input sp-start" value="' + esc(p.start) + '" style="' + inputStyle + '"/>'
            + '<span style="color:var(--t3);font-size:12px;">to</span>'
            + '<input type="time" class="form-input sp-end" value="' + esc(p.end) + '" style="' + inputStyle + '"/>'
            + '<button type="button" class="btn btn-ghost btn-sm sp-remove" data-id="' + esc(p.id) + '">Remove</button>'
            + '</div>')
            .join('')
        : '<div style="font-size:12px;color:var(--red);padding:9px 0;">Pick at least one service above.</div>';

      root.innerHTML =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' + chips + '</div>'
        + '<button type="button" class="sp-add-toggle" style="background:none;border:none;color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;padding:0;margin-bottom:12px;">+ Add Custom</button>'
        + '<div class="sp-add-form" style="display:none;gap:10px;align-items:flex-end;flex-wrap:wrap;background:var(--input);border:1px solid var(--b-edge);border-radius:6px;padding:12px 14px;margin-bottom:14px;">'
        +   '<div class="f" style="flex:1;min-width:130px;"><label>Name</label><input type="text" class="sp-c-name" placeholder="e.g. Happy Hour"/></div>'
        +   '<div class="f" style="width:118px;flex:0 0 auto;"><label>Start</label><input type="time" class="sp-c-start" value="16:00"/></div>'
        +   '<div class="f" style="width:118px;flex:0 0 auto;"><label>End</label><input type="time" class="sp-c-end" value="18:00"/></div>'
        +   '<button type="button" class="btn btn-primary btn-sm sp-c-add">Add</button>'
        + '</div>'
        + '<div class="sp-list">' + rows + '</div>';
      wire();
      emit();
    };

    const wire = () => {
      root.querySelectorAll('.sp-chip').forEach(b => b.addEventListener('click', () => {
        const name = b.dataset.name;
        const idx = ctrl.periods.findIndex(p => (p.name || '').toLowerCase() === name.toLowerCase());
        if (idx >= 0) ctrl.periods.splice(idx, 1);
        else {
          const pr = this.PRESETS.find(x => x.name === name);
          if (pr) ctrl.periods.push({ id: this._uid(), name: pr.name, start: pr.start, end: pr.end, custom: false });
        }
        render();
      }));
      const addForm = root.querySelector('.sp-add-form');
      root.querySelector('.sp-add-toggle')?.addEventListener('click', () => {
        addForm.style.display = (addForm.style.display === 'none' || !addForm.style.display) ? 'flex' : 'none';
      });
      root.querySelector('.sp-c-add')?.addEventListener('click', () => {
        const nm = (root.querySelector('.sp-c-name')?.value || '').trim();
        if (!nm) { root.querySelector('.sp-c-name')?.focus(); return; }
        // Don't duplicate a name that already exists (preset or custom).
        if (ctrl.periods.some(p => (p.name || '').toLowerCase() === nm.toLowerCase())) { render(); return; }
        ctrl.periods.push({
          id: this._uid(), name: nm,
          start: root.querySelector('.sp-c-start')?.value || '',
          end: root.querySelector('.sp-c-end')?.value || '',
          custom: true
        });
        render();
      });
      root.querySelectorAll('.sp-row').forEach(rowEl => {
        const p = ctrl.periods.find(x => x.id === rowEl.dataset.id);
        rowEl.querySelector('.sp-start')?.addEventListener('change', e => { if (p) { p.start = e.target.value; emit(); } });
        rowEl.querySelector('.sp-end')?.addEventListener('change', e => { if (p) { p.end = e.target.value; emit(); } });
      });
      root.querySelectorAll('.sp-remove').forEach(btn => btn.addEventListener('click', () => {
        const idx = ctrl.periods.findIndex(p => p.id === btn.dataset.id);
        if (idx >= 0) ctrl.periods.splice(idx, 1);
        render();
      }));
    };

    render();
    return ctrl;
  }
};
