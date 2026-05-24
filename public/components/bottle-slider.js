'use strict';

/* ── Bottle Slider — reusable count component ─────────────────────────────────
   Used by Take Inventory and Spot Check. Estimates how full an open bottle is
   (0.00–1.00 in 0.01 steps) plus a separate full-bottle integer count.

   API:
     BottleSlider.html(id, {value, fulls, category})  → HTML string
     BottleSlider.mount(id, onChange)                 → wire after HTML is in DOM
     BottleSlider.get(id)                             → {value, fulls, total}

   Interaction: drag the level, tap top/bottom half for ±0.01, arrow keys for
   accessibility, tap the value to type it directly, +/- for full bottles. */

const BottleSlider = {
  _inst: {},
  TOP: 16, BOT: 218,   // viewBox y-range of the fillable interior

  COLORS: {
    'Liquor':'#DBAB46', 'Spirits':'#DBAB46', 'Wine':'#8B1A1A',
    'Bottle Beer':'#DBAB46', 'Draft Beer':'#E8C84A', 'Food':'#4888A8', 'Misc':'#4888A8'
  },
  colorFor(cat) { return this.COLORS[cat] || '#DBAB46'; },

  _snap(v) { v = Math.round((Number(v) || 0) * 100) / 100; return Math.max(0, Math.min(1, v)); },
  _fmt(n)  { return (Math.round(n * 100) / 100).toFixed(2); },
  _fillY(v){ return (this.TOP + (1 - v) * (this.BOT - this.TOP)).toFixed(1); },
  _fillH(v){ return (v * (this.BOT - this.TOP)).toFixed(1); },

  html(id, opts) {
    opts = opts || {};
    const value = this._snap(opts.value != null ? opts.value : 0);
    const fulls = Math.max(0, parseInt(opts.fulls) || 0);
    const col = this.colorFor(opts.category || 'Liquor');
    const clip = 'bsclip-' + id;
    const btn = 'width:44px;height:44px;border-radius:6px;border:1px solid var(--b1);background:var(--input);color:var(--t1);font-size:22px;font-weight:700;cursor:pointer;';

    return '<div class="bs" data-bs="' + esc(String(id)) + '" tabindex="0" '
      + 'style="display:flex;flex-direction:column;align-items:center;gap:10px;outline:none;user-select:none;">'

      + '<div style="display:flex;align-items:center;gap:10px;">'
      +   '<button type="button" class="bs-minus" style="' + btn + '">&#8722;</button>'
      +   '<div style="text-align:center;min-width:62px;">'
      +     '<div class="bs-fulls" style="font-family:\'Barlow Condensed\',sans-serif;font-size:26px;font-weight:700;color:var(--t1);line-height:1;">' + fulls + '</div>'
      +     '<div style="font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:2px;">Full Bottles</div>'
      +   '</div>'
      +   '<button type="button" class="bs-plus" style="' + btn + '">+</button>'
      + '</div>'

      + '<svg class="bs-svg" viewBox="0 0 90 230" width="92" height="210" style="touch-action:none;cursor:pointer;display:block;">'
      +   '<defs><clipPath id="' + clip + '">'
      +     '<path d="M43 16 L43 53 C43 60 21 66 20 90 L20 208 Q20 218 29 218 L61 218 Q70 218 70 208 L70 90 C69 66 47 60 47 53 L47 16 Z"/>'
      +   '</clipPath></defs>'
      +   '<rect x="0" y="0" width="90" height="230" fill="rgba(255,255,255,0.04)" clip-path="url(#' + clip + ')"/>'
      +   '<rect class="bs-fill" x="0" width="90" fill="' + col + '" clip-path="url(#' + clip + ')" '
      +     'y="' + this._fillY(value) + '" height="' + this._fillH(value) + '"/>'
      +   '<line class="bs-handle" x1="12" x2="78" y1="' + this._fillY(value) + '" y2="' + this._fillY(value) + '" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>'
      +   '<rect x="38" y="6" width="14" height="9" rx="1.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
      +   '<path d="M40 14 L40 52 C40 58 18 64 16 88 L16 210 Q16 222 28 222 L62 222 Q74 222 74 210 L74 88 C72 64 50 58 50 52 L50 14 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
      + '</svg>'

      + '<div style="text-align:center;">'
      +   '<div class="bs-val" style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:' + col + ';line-height:1;cursor:pointer;">' + value.toFixed(2) + '</div>'
      +   '<div style="font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:2px;">Open Bottle</div>'
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;color:var(--t2);">Total on hand: '
      +   '<span class="bs-total" style="color:' + col + ';">' + this._fmt(fulls + value) + '</span></div>'

      + '</div>';
  },

  mount(id, onChange) {
    const root = document.querySelector('.bs[data-bs="' + (window.CSS && CSS.escape ? CSS.escape(String(id)) : String(id)) + '"]');
    if (!root) return;
    const svg = root.querySelector('.bs-svg');
    const inst = this._inst[id] = {
      value: this._snap(parseFloat(root.querySelector('.bs-val').textContent)),
      fulls: parseInt(root.querySelector('.bs-fulls').textContent) || 0,
      onChange: onChange || function(){}
    };

    const apply = () => {
      const fill = root.querySelector('.bs-fill');
      const handle = root.querySelector('.bs-handle');
      const valEl = root.querySelector('.bs-val');
      const fullsEl = root.querySelector('.bs-fulls');
      const totalEl = root.querySelector('.bs-total');
      if (fill)   { fill.setAttribute('y', this._fillY(inst.value)); fill.setAttribute('height', this._fillH(inst.value)); }
      if (handle) { handle.setAttribute('y1', this._fillY(inst.value)); handle.setAttribute('y2', this._fillY(inst.value)); }
      if (valEl)  valEl.textContent = inst.value.toFixed(2);
      if (fullsEl) fullsEl.textContent = inst.fulls;
      if (totalEl) totalEl.textContent = this._fmt(inst.fulls + inst.value);
      inst.onChange({ value: inst.value, fulls: inst.fulls, total: inst.fulls + inst.value });
    };

    const valueFromY = (clientY) => {
      const r = svg.getBoundingClientRect();
      const vy = (clientY - r.top) / r.height * 230;
      return Math.max(0, Math.min(1, (this.BOT - vy) / (this.BOT - this.TOP)));
    };

    let dragging = false, moved = false, startY = 0;
    const move = (clientY) => {
      if (!dragging) return;
      if (Math.abs(clientY - startY) > 5) moved = true;
      if (moved) { inst.value = this._snap(valueFromY(clientY)); apply(); }
    };
    const finish = (clientY) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        const r = svg.getBoundingClientRect();
        inst.value = this._snap(inst.value + (clientY < r.top + r.height / 2 ? 0.01 : -0.01));
      } else {
        inst.value = this._snap(inst.value);
      }
      apply();
    };
    const onMM = e => move(e.clientY);
    const onMU = e => { finish(e.clientY); window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); };

    svg.addEventListener('mousedown', e => {
      e.preventDefault();
      dragging = true; moved = false; startY = e.clientY;
      window.addEventListener('mousemove', onMM);
      window.addEventListener('mouseup', onMU);
    });
    svg.addEventListener('touchstart', e => { dragging = true; moved = false; startY = e.touches[0].clientY; }, { passive: true });
    svg.addEventListener('touchmove',  e => { move(e.touches[0].clientY); }, { passive: true });
    svg.addEventListener('touchend',   e => { finish(e.changedTouches[0].clientY); });

    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); inst.value = this._snap(inst.value + 0.01); apply(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); inst.value = this._snap(inst.value - 0.01); apply(); }
    });

    root.querySelector('.bs-minus').addEventListener('click', () => { inst.fulls = Math.max(0, inst.fulls - 1); apply(); });
    root.querySelector('.bs-plus').addEventListener('click',  () => { inst.fulls = inst.fulls + 1; apply(); });

    const valEl = root.querySelector('.bs-val');
    valEl.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'number'; input.step = '0.01'; input.min = '0'; input.max = '1';
      input.value = inst.value.toFixed(2);
      input.style.cssText = 'width:64px;text-align:center;font-size:18px;';
      valEl.replaceWith(input);
      input.focus(); input.select();
      let done = false;
      const commit = () => {
        if (done) return; done = true;
        inst.value = this._snap(parseFloat(input.value));
        input.replaceWith(valEl);
        apply();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    });
  },

  get(id) {
    const i = this._inst[id];
    return i ? { value: i.value, fulls: i.fulls, total: i.fulls + i.value } : { value: 0, fulls: 0, total: 0 };
  }
};

window.BottleSlider = BottleSlider;
