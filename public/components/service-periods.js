'use strict';

/* ── Service Periods selector — shared by App Settings + Onboarding ───────────
   A row of tap-to-select tiles, the same interaction as the Open-the-Floor
   register tiles: tap a service to turn it gold (with a check); its time window
   opens up INSIDE the tile. Tap again to turn it off — no remove button. The last
   tile is Custom: turn it on, name it, set its window. One source so the settings
   screen and onboarding never drift. Stored in settings.service_periods as
   [{id,name,start,end}].

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

  mount(root, opts) {
    opts = opts || {};
    if (!root) return null;
    const self = this;
    const ctrl = {
      periods: (opts.selected || []).map(p => ({ id: p.id || self._uid(), name: p.name, start: p.start || '', end: p.end || '', custom: !!p.custom })),
      value() { return self._sorted(this.periods).map(p => ({ id: p.id, name: p.name, start: p.start, end: p.end, custom: p.custom })); }
    };
    const emit = () => { if (opts.onChange) opts.onChange(ctrl.value()); };

    const tileStyle = on => 'width:165px;border-radius:10px;padding:12px 14px;cursor:pointer;'
      + (on ? 'border:1px solid var(--gold-tint-bord);background:var(--gold-tint);' : 'border:1px solid var(--b1);background:var(--input);opacity:0.6;');
    const inStyle = 'width:100%;background:var(--bg);border:1px solid var(--b1);border-radius:5px;padding:5px 7px;color:var(--t1);font-size:13px;box-sizing:border-box;';
    const tlbl = 'font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;';
    const head = (name, on) =>
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(name) + '</div>'
      + (on ? '<span style="color:var(--gold);font-size:14px;font-weight:800;">&#10003;</span>' : '') + '</div>';
    const timesBody = p => this._isFullDay(p)
      ? '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Open to close</div>'
      : '<div style="margin-top:10px;">'
        + '<div style="' + tlbl + 'margin-bottom:3px;">From</div>'
        + '<input type="time" class="sp-start" value="' + esc(p.start) + '" style="' + inStyle + '"/>'
        + '<div style="' + tlbl + 'margin:7px 0 3px;">To</div>'
        + '<input type="time" class="sp-end" value="' + esc(p.end) + '" style="' + inStyle + '"/>'
        + '</div>';

    const render = () => {
      const byName = nm => ctrl.periods.find(p => !p.custom && (p.name || '').toLowerCase() === nm.toLowerCase());
      const custom = ctrl.periods.find(p => p.custom);

      const presetTiles = this.PRESETS.map(pr => {
        const p = byName(pr.name);
        const on = !!p;
        return '<div class="sp-tile" data-kind="preset" data-name="' + esc(pr.name) + '"' + (on ? ' data-id="' + esc(p.id) + '"' : '') + ' style="' + tileStyle(on) + '">'
          + head(pr.name, on)
          + (on ? timesBody(p) : '<div style="font-size:11px;color:var(--t3);margin-top:8px;">tap to use</div>')
          + '</div>';
      }).join('');

      const cOn = !!custom;
      const customTile = '<div class="sp-tile" data-kind="custom"' + (cOn ? ' data-id="' + esc(custom.id) + '"' : '') + ' style="' + tileStyle(cOn) + '">'
        + head('Custom', cOn)
        + (cOn
            ? '<input type="text" class="sp-cname" value="' + esc(custom.name || '') + '" placeholder="Name it" style="' + inStyle + 'margin-top:10px;"/>' + timesBody(custom)
            : '<div style="font-size:11px;color:var(--t3);margin-top:8px;">tap to add</div>')
        + '</div>';

      root.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;">' + presetTiles + customTile + '</div>';
      wire();
      emit();
    };

    const wire = () => {
      root.querySelectorAll('.sp-tile').forEach(tile => {
        tile.addEventListener('click', ev => {
          if (ev.target.closest('input')) return;   // editing a field, don't toggle the tile
          if (tile.dataset.kind === 'preset') {
            const name = tile.dataset.name;
            const idx = ctrl.periods.findIndex(p => !p.custom && (p.name || '').toLowerCase() === name.toLowerCase());
            if (idx >= 0) ctrl.periods.splice(idx, 1);
            else { const pr = this.PRESETS.find(x => x.name === name); if (pr) ctrl.periods.push({ id: this._uid(), name: pr.name, start: pr.start, end: pr.end, custom: false }); }
          } else {
            if (ctrl.periods.some(p => p.custom)) ctrl.periods = ctrl.periods.filter(p => !p.custom);
            else ctrl.periods.push({ id: this._uid(), name: '', start: '16:00', end: '18:00', custom: true });
          }
          render();
        });
        const id = tile.dataset.id;
        if (id) {
          const p = ctrl.periods.find(x => x.id === id);
          tile.querySelector('.sp-start')?.addEventListener('change', e => { if (p) { p.start = e.target.value; emit(); } });
          tile.querySelector('.sp-end')?.addEventListener('change', e => { if (p) { p.end = e.target.value; emit(); } });
          tile.querySelector('.sp-cname')?.addEventListener('input', e => { if (p) { p.name = e.target.value; emit(); } });
        }
      });
    };

    render();
    return ctrl;
  }
};
