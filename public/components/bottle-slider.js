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
  // Fill range per shape, in viewBox y. value 1 sits at the REALISTIC full level
  // (a liquor bottle fills to the base of the neck, leaving headspace above; a
  // keg fills to its top), value 0 at the interior base. Anchoring 1 at the
  // shoulder instead of the cap is what makes a genuinely full open bottle read
  // 1.00 instead of ~0.80, so on-hand and variance stay honest.
  // One entry per silhouette. range = the fill's y span in the 0..230 viewBox
  // (value 1 at top, 0 at the interior base). clip = the interior the fill paints
  // inside. outline = the visible stroke drawn over the fill. noun/nounPl label
  // the Full/Open readouts. bottle + keg are the originals, unchanged; the rest
  // are the Food/Misc containers so a box reads as a box and a jug as a jug.
  SHAPES: {
    bottle: { range: { top: 56, bot: 214 }, noun: 'Bottle', nounPl: 'Bottles',
      clip: 'M43 16 L43 53 C43 60 21 66 20 90 L20 208 Q20 218 29 218 L61 218 Q70 218 70 208 L70 90 C69 66 47 60 47 53 L47 16 Z',
      outline: '<rect x="38" y="6" width="14" height="9" rx="1.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M40 14 L40 52 C40 58 18 64 16 88 L16 210 Q16 222 28 222 L62 222 Q74 222 74 210 L74 88 C72 64 50 58 50 52 L50 14 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>' },
    keg: { range: { top: 20, bot: 210 }, noun: 'Keg', nounPl: 'Kegs',
      clip: 'M21 30 Q21 19 33 19 L57 19 Q69 19 69 30 L69 200 Q69 211 57 211 L33 211 Q21 211 21 200 Z',
      outline: '<path d="M19 30 Q19 16 33 16 L57 16 Q71 16 71 30 L71 200 Q71 214 57 214 L33 214 Q19 214 19 200 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="20" x2="70" y1="40" y2="40" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="20" x2="70" y1="190" y2="190" stroke="var(--b1)" stroke-width="2"/>' },
    box: { range: { top: 46, bot: 212 }, noun: 'Box', nounPl: 'Boxes',
      clip: 'M20 46 L70 46 L70 212 L20 212 Z',
      outline: '<path d="M20 46 L70 46 L70 212 L20 212 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M22 46 L14 36 M68 46 L76 36" fill="none" stroke="var(--b1)" stroke-width="2" stroke-linecap="round"/>'
        + '<line x1="20" x2="70" y1="60" y2="60" stroke="var(--b1)" stroke-width="1.5"/>' },
    bag: { range: { top: 54, bot: 212 }, noun: 'Bag', nounPl: 'Bags',
      clip: 'M28 54 L62 54 L68 205 Q68 214 59 214 L31 214 Q22 214 22 205 Z',
      outline: '<path d="M28 54 L62 54 L68 205 Q68 214 59 214 L31 214 Q22 214 22 205 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M28 54 Q30 40 45 40 Q60 40 62 54" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="33" x2="57" y1="49" y2="49" stroke="var(--b1)" stroke-width="1.5"/>' },
    jug: { range: { top: 66, bot: 212 }, noun: 'Jug', nounPl: 'Jugs',
      clip: 'M26 66 L64 66 L64 205 Q64 214 55 214 L35 214 Q26 214 26 205 Z',
      outline: '<path d="M26 66 L64 66 L64 205 Q64 214 55 214 L35 214 Q26 214 26 205 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M38 66 L38 46 L52 46 L52 66" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<rect x="35" y="37" width="20" height="10" rx="1.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M64 80 Q82 84 82 108 Q82 132 64 134" fill="none" stroke="var(--b1)" stroke-width="2"/>' },
    crate: { range: { top: 48, bot: 210 }, noun: 'Crate', nounPl: 'Crates',
      clip: 'M20 48 L70 48 L70 210 L20 210 Z',
      outline: '<path d="M20 48 L70 48 L70 210 L20 210 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="20" x2="70" y1="94" y2="94" stroke="var(--b1)" stroke-width="1.5"/>'
        + '<line x1="20" x2="70" y1="140" y2="140" stroke="var(--b1)" stroke-width="1.5"/>'
        + '<line x1="20" x2="70" y1="186" y2="186" stroke="var(--b1)" stroke-width="1.5"/>' },
    tub: { range: { top: 56, bot: 212 }, noun: 'Tub', nounPl: 'Tubs',
      clip: 'M26 56 L64 56 L60 206 Q60 213 53 213 L37 213 Q30 213 30 206 Z',
      outline: '<path d="M26 56 L64 56 L60 206 Q60 213 53 213 L37 213 Q30 213 30 206 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M22 50 L68 50 L64 56 L26 56 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>' },
    can: { range: { top: 54, bot: 208 }, noun: 'Can', nounPl: 'Cans',
      clip: 'M26 54 L64 54 L64 208 L26 208 Z',
      outline: '<path d="M26 54 L64 54 L64 208 L26 208 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<ellipse cx="45" cy="54" rx="19" ry="5.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="26" x2="64" y1="66" y2="66" stroke="var(--b1)" stroke-width="1.5"/>' }
  },
  _shape(s) { return this.SHAPES[s] || this.SHAPES.bottle; },
  _range(shape) { return this._shape(shape).range; },

  // Fill color per category, from the locked palette (no hardcoded hex).
  COLORS: {
    'Liquor':'var(--gold)', 'Spirits':'var(--gold)', 'Wine':'var(--red)',
    'Bottle Beer':'var(--gold)', 'Draft Beer':'var(--gold)', 'Food':'var(--steel)', 'Misc':'var(--steel)'
  },
  colorFor(cat) { return this.COLORS[cat] || 'var(--gold)'; },

  _snap(v) { v = Math.round((Number(v) || 0) * 100) / 100; return Math.max(0, Math.min(1, v)); },
  _fmt(n)  { return (Math.round(n * 100) / 100).toFixed(2); },
  _fillY(v, r){ return (r.top + (1 - v) * (r.bot - r.top)).toFixed(1); },
  _fillH(v, r){ return (v * (r.bot - r.top)).toFixed(1); },

  html(id, opts) {
    opts = opts || {};
    const value = this._snap(opts.value != null ? opts.value : 0);
    const fulls = Math.max(0, parseInt(opts.fulls) || 0);
    const col = this.colorFor(opts.category || 'Liquor');
    const clip = 'bsclip-' + id;
    // Shape: a keg outline for Draft Beer, a bottle outline otherwise. The
    // fill/level mechanic is identical — only the silhouette and the noun
    // ("Keg" vs "Bottle") change.
    const shp   = this._shape(opts.shape);
    const noun  = shp.noun;
    const nounPl = shp.nounPl;
    const rng   = shp.range;
    const clipD = shp.clip;
    const outline = shp.outline;

    return '<div class="bs" data-bs="' + esc(String(id)) + '" data-top="' + rng.top + '" data-bot="' + rng.bot + '" tabindex="0" '
      + 'style="display:flex;flex-direction:column;align-items:center;gap:10px;outline:none;user-select:none;-webkit-tap-highlight-color:transparent;">'

      + '<div class="bs-fulls-row" style="display:flex;align-items:center;gap:10px;">'
      +   '<button type="button" class="bs-minus" aria-label="One less full bottle">&#8722;</button>'
      +   '<div style="text-align:center;min-width:62px;">'
      +     '<div class="bs-fulls" style="font-family:\'Barlow Condensed\',sans-serif;font-size:26px;font-weight:700;color:var(--t1);line-height:1;">' + fulls + '</div>'
      +     '<div style="font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:2px;">Full ' + nounPl + '</div>'
      +   '</div>'
      +   '<button type="button" class="bs-plus" aria-label="One more full bottle">+</button>'
      + '</div>'

      + '<svg class="bs-svg" viewBox="0 0 90 230" width="92" height="210" style="touch-action:none;cursor:pointer;display:block;-webkit-tap-highlight-color:transparent;">'
      +   '<defs><clipPath id="' + clip + '">'
      +     '<path d="' + clipD + '"/>'
      +   '</clipPath></defs>'
      +   '<rect x="0" y="0" width="90" height="230" fill="rgba(255,255,255,0.04)" clip-path="url(#' + clip + ')"/>'
      +   '<rect class="bs-fill" x="0" width="90" fill="' + col + '" clip-path="url(#' + clip + ')" '
      +     'y="' + this._fillY(value, rng) + '" height="' + this._fillH(value, rng) + '"/>'
      +   '<line class="bs-handle" x1="12" x2="78" y1="' + this._fillY(value, rng) + '" y2="' + this._fillY(value, rng) + '" stroke="var(--w)" stroke-width="2.5" stroke-linecap="round"/>'
      +   outline
      + '</svg>'

      + '<div style="text-align:center;">'
      +   '<input class="bs-val" type="number" step="0.01" min="0" max="1" inputmode="decimal" '
      +     'aria-label="Open bottle level (0 to 1)" value="' + value.toFixed(2) + '" '
      +     'style="color:' + col + ';"/>'
      +   '<div style="font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:4px;">Open ' + noun + '</div>'
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;color:var(--t2);">Total on hand: '
      +   '<span class="bs-total" style="color:' + col + ';">' + this._fmt(fulls + value) + '</span></div>'

      + '</div>';
  },

  mount(id, onChange) {
    const root = document.querySelector('.bs[data-bs="' + (window.CSS && CSS.escape ? CSS.escape(String(id)) : String(id)) + '"]');
    if (!root) return;
    const svg = root.querySelector('.bs-svg');
    const valInput = root.querySelector('.bs-val');
    const top = parseFloat(root.dataset.top) || this.SHAPES.bottle.range.top;
    const bot = parseFloat(root.dataset.bot) || this.SHAPES.bottle.range.bot;
    const rng = { top, bot };
    const inst = this._inst[id] = {
      value: this._snap(parseFloat(valInput && valInput.value) || 0),
      fulls: parseInt(root.querySelector('.bs-fulls').textContent) || 0,
      onChange: onChange || function(){},
      // Suppresses the input change handler during programmatic value writes
      // (drag, arrow keys, +/-) so we do not feed our own writes back through
      // the snap/apply cycle as if the operator typed them.
      _writing: false
    };

    // skipInputWrite=true means: update the slider visual + fulls/total
    // displays, but leave whatever the operator is currently typing in the
    // input alone. Used by the input handler so we do not stomp on a
    // partial entry like "." or "0.2" while the operator is still typing
    // the rest of the number.
    const apply = (skipInputWrite) => {
      const fill = root.querySelector('.bs-fill');
      const handle = root.querySelector('.bs-handle');
      const valEl = root.querySelector('.bs-val');
      const fullsEl = root.querySelector('.bs-fulls');
      const totalEl = root.querySelector('.bs-total');
      if (fill)   { fill.setAttribute('y', this._fillY(inst.value, rng)); fill.setAttribute('height', this._fillH(inst.value, rng)); }
      if (handle) { handle.setAttribute('y1', this._fillY(inst.value, rng)); handle.setAttribute('y2', this._fillY(inst.value, rng)); }
      if (valEl && !skipInputWrite) { inst._writing = true; valEl.value = inst.value.toFixed(2); inst._writing = false; }
      if (fullsEl) fullsEl.textContent = inst.fulls;
      if (totalEl) totalEl.textContent = this._fmt(inst.fulls + inst.value);
      inst.onChange({ value: inst.value, fulls: inst.fulls, total: inst.fulls + inst.value });
    };

    const valueFromY = (clientY) => {
      const r = svg.getBoundingClientRect();
      const vy = (clientY - r.top) / r.height * 230;
      return Math.max(0, Math.min(1, (bot - vy) / (bot - top)));
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

    // Bidirectional sync between the slider visual and the numeric input.
    // While typing: parse the raw text, clamp to 0-1, sync the slider
    // visual, but DO NOT write back to the input (would stomp the operator's
    // half-typed number like "." or "0.2" and force the cursor to the end).
    // On blur: snap to 2 decimals and write the canonical formatted value.
    if (valInput) {
      valInput.addEventListener('input', () => {
        if (inst._writing) return;
        const raw = parseFloat(valInput.value);
        if (isNaN(raw)) {
          // Empty or just "." -- keep the slider where it is and let the
          // operator keep typing. They will commit a valid number on blur.
          return;
        }
        // Clamp to 0-1 but do NOT round to 2 decimals here -- rounding mid-
        // type is what stole keystrokes on the previous build.
        inst.value = Math.max(0, Math.min(1, raw));
        apply(true);
      });
      valInput.addEventListener('blur', () => {
        // Snap to 2 decimals and write the canonical formatted value back.
        // If the operator left the field empty or with garbage, fall back to
        // whatever inst.value last resolved to (zero on a fresh slider).
        inst.value = this._snap(inst.value);
        apply();
      });
      valInput.addEventListener('focus', () => { valInput.select(); });
    }
  },

  get(id) {
    const i = this._inst[id];
    return i ? { value: i.value, fulls: i.fulls, total: i.fulls + i.value } : { value: 0, fulls: 0, total: 0 };
  }
};

window.BottleSlider = BottleSlider;
