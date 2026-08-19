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
  // the Full/Open readouts. Silhouettes: bottle = wine, liquor = the spirits
  // bottle, keg = draft, jug = a liquid Food/Misc container, box = a solid one.
  // App.sliderShape(p) maps a product to one of these.
  SHAPES: {
    bottle: { range: { top: 56, bot: 214 }, noun: 'Bottle', nounPl: 'Bottles',
      clip: 'M43 16 L43 53 C43 60 21 66 20 90 L20 208 Q20 218 29 218 L61 218 Q70 218 70 208 L70 90 C69 66 47 60 47 53 L47 16 Z',
      outline: '<rect x="38" y="6" width="14" height="9" rx="1.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M40 14 L40 52 C40 58 18 64 16 88 L16 210 Q16 222 28 222 L62 222 Q74 222 74 210 L74 88 C72 64 50 58 50 52 L50 14 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>' },
    keg: { range: { top: 20, bot: 210 }, noun: 'Keg', nounPl: 'Kegs',
      clip: 'M13 30 Q13 19 25 19 L65 19 Q77 19 77 30 L77 200 Q77 211 65 211 L25 211 Q13 211 13 200 Z',
      outline: '<path d="M11 30 Q11 16 25 16 L65 16 Q79 16 79 30 L79 200 Q79 214 65 214 L25 214 Q11 214 11 200 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="14" x2="76" y1="40" y2="40" stroke="var(--b1)" stroke-width="2"/>'
        + '<line x1="14" x2="76" y1="190" y2="190" stroke="var(--b1)" stroke-width="2"/>' },
    // One generic container for every Food/Misc slider product. Full reads 1.00
    // when the fill reaches the inner top line (y 60), leaving the rim gap (46-60)
    // as the headspace most containers are never filled into; empty sits just
    // above the base line (bot 206), never flush with it.
    box: { range: { top: 60, bot: 206 }, noun: 'Unit', nounPl: 'Units',
      clip: 'M20 46 L70 46 L70 212 L20 212 Z',
      outline: '<path d="M20 46 L70 46 L70 212 L20 212 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M22 46 L14 36 M68 46 L76 36" fill="none" stroke="var(--b1)" stroke-width="2" stroke-linecap="round"/>'
        + '<line x1="20" x2="70" y1="60" y2="60" stroke="var(--b1)" stroke-width="1.5"/>' },
    // Liquor bottle. A symmetric squat wide-body bottle with a short wide mouth
    // (both walls mirror about x45), so it reads as a liquor bottle rather than
    // the tall narrow wine bottle. Like the wine bottle, value 1 fills to the
    // shoulder (short neck = headspace), value 0 sits just above the base.
    liquor: { range: { top: 48, bot: 206 }, noun: 'Bottle', nounPl: 'Bottles',
      clip: 'M37 18 L37 46 C37 54 16 56 16 62 L16 200 Q16 210 26 210 L64 210 Q74 210 74 200 L74 62 C74 56 53 54 53 46 L53 18 Z',
      outline: '<rect x="35" y="6" width="20" height="9" rx="1.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M35 14 L35 46 C35 53 14 55 14 62 L14 200 Q14 212 26 212 L64 212 Q76 212 76 200 L76 62 C76 55 55 53 55 46 L55 14 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>' },
    // Liquid Food/Misc (oil, cream, syrup, juice bought by the gal/qt/pint). A
    // short wide jug with a handle so it reads as a jug, not the liquor bottle.
    // value 1 fills to the shoulder (short neck = headspace), value 0 sits just
    // above the base. Symmetric body about x45; the handle is drawn (not filled).
    jug: { range: { top: 62, bot: 204 }, noun: 'Jug', nounPl: 'Jugs',
      clip: 'M39 44 L39 60 C39 68 14 70 14 78 L14 198 Q14 208 24 208 L66 208 Q76 208 76 198 L76 78 C76 70 51 68 51 60 L51 44 Z',
      outline: '<rect x="37" y="34" width="16" height="9" rx="1.5" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M37 42 L37 60 C37 67 12 69 12 78 L12 200 Q12 210 24 210 L66 210 Q78 210 78 200 L78 78 C78 69 53 67 53 60 L53 42 Z" fill="none" stroke="var(--b1)" stroke-width="2"/>'
        + '<path d="M78 88 C89 90 89 124 78 126" fill="none" stroke="var(--b1)" stroke-width="2"/>' }
  },
  _shape(s) { return this.SHAPES[s] || this.SHAPES.bottle; },

  // Fill color per category, from the locked palette (no hardcoded hex).
  COLORS: {
    'Liquor':'var(--gold)', 'Spirits':'var(--gold)', 'Wine':'var(--red)',
    'Bottle Beer':'var(--gold)', 'Draft Beer':'var(--gold)', 'Food':'var(--amber)', 'Misc':'var(--amber)'
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
    /* ⭐ THE UNCOUNTED DISPLAY IS OPT-IN, AND THAT IS A REACH DECISION, NOT A STYLE ONE (T25b).
       Take Inventory owns a COUNTED / NOT COUNTED state and passes `counted`, so an untouched
       slider reads like the typed cells beside it: an empty box behind a grey `0.00` placeholder,
       with the level and the total muted until there is an actual reading.
       ⛔ SPOT CHECK PASSES NOTHING AND IS UNTOUCHED. It has no uncounted concept at all -- a zero
       there is a real pre-shift reading -- so blanking its box would say "you have not answered"
       about an answer the operator just gave. One control, two screens, and reach is a property of
       the screen ([[the-loop]] #55). */
    const uncountable = opts.counted !== undefined;
    const counted = uncountable ? !!opts.counted : true;
    /* ⛔ WHAT MAKES THIS CONTROL COUNT IS A PROPERTY OF THE SCREEN, AND THE TWO ANSWERS ARE BOTH
       RIGHT. Take Inventory counts on VALUE: an empty slider means "not counted yet", because Out
       of Stock is its confirmed zero. Spot Check counts on TOUCH: it has NO Out of Stock, so the
       slider at zero is the only way to record a bottle that came back EMPTY, and un-counting it
       would make the commonest post-shift reading impossible to enter. `ic-spot-check` already
       decided this for itself with `_touched`, and this just follows it. */
    const countsOnTouch = !!opts.countsOnTouch;
    const clip = 'bsclip-' + id;
    // Shape: a keg outline for Draft Beer, a bottle outline otherwise. The
    // fill/level mechanic is identical — only the silhouette and the noun
    // ("Keg" vs "Bottle") change.
    const shp   = this._shape(opts.shape);
    // A caller can override the Full/Open label (the generic box slider labels
    // itself with the product's own unit — "Full Jugs", "Open Case").
    const noun  = opts.noun || shp.noun;
    const nounPl = opts.nounPl || shp.nounPl;
    const rng   = shp.range;
    const clipD = shp.clip;
    const outline = shp.outline;

    return '<div class="bs" data-bs="' + esc(String(id)) + '" data-top="' + rng.top + '" data-bot="' + rng.bot + '" '
      + 'data-uncountable="' + (uncountable ? '1' : '') + '" data-counts-on-touch="' + (countsOnTouch ? '1' : '') + '" '
      + 'data-col="' + col + '" tabindex="0" '
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
      +     'aria-label="Open bottle level (0 to 1)" value="' + (counted ? value.toFixed(2) : '') + '" '
      +     'placeholder="0.00" style="color:' + col + ';"/>'
      +   '<div style="font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:4px;">Open ' + noun + '</div>'
      + '</div>'

      + '<div style="font-size:11px;font-weight:700;color:var(--t2);">Total on hand: '
      +   '<span class="bs-total" style="color:' + (counted ? col : 'var(--t3)') + ';">'
      +     (counted ? this._fmt(fulls + value) : '0.00') + '</span></div>'

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
    // T25b: only a caller that passed `counted` may show the uncounted state (see `html`).
    const uncountable = root.dataset.uncountable === '1';
    const countsOnTouch = root.dataset.countsOnTouch === '1';
    const col = root.dataset.col || 'var(--gold)';
    const startFulls = parseInt(root.querySelector('.bs-fulls').textContent) || 0;
    const inst = this._inst[id] = {
      value: this._snap(parseFloat(valInput && valInput.value) || 0),
      fulls: startFulls,
      // An empty box with no full bottles is the "nothing entered yet" state. Anything else is a
      // reading. Screens that never opt in are always counted, exactly as before.
      counted: !uncountable || String((valInput && valInput.value) ?? '').trim() !== '' || startFulls > 0,
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
    /* `source` says WHAT the operator did, because a gesture and a keystroke are different kinds of
       evidence (Kyle, T25b): 'type' is a deliberate answer even when it is zero, 'clear' is the
       answer being taken back, and 'gesture' (drag, tap, arrows, +/-) counts only if it lands on
       something. The screen derives its own record from this; `counted` below is the DISPLAY state
       and the harness pins that the two agree. */
    const apply = (skipInputWrite, source) => {
      // Every `apply` call site is inside an event handler, so reaching here IS the operator
      // interacting. That is what makes `countsOnTouch` a one-line rule rather than a flag to keep.
      if (uncountable) {
        inst.counted = countsOnTouch ? true
          : ((source === 'type') || inst.value > 0 || inst.fulls > 0);
      }
      const fill = root.querySelector('.bs-fill');
      const handle = root.querySelector('.bs-handle');
      const valEl = root.querySelector('.bs-val');
      const fullsEl = root.querySelector('.bs-fulls');
      const totalEl = root.querySelector('.bs-total');
      if (fill)   { fill.setAttribute('y', this._fillY(inst.value, rng)); fill.setAttribute('height', this._fillH(inst.value, rng)); }
      if (handle) { handle.setAttribute('y1', this._fillY(inst.value, rng)); handle.setAttribute('y2', this._fillY(inst.value, rng)); }
      if (valEl && !skipInputWrite) {
        inst._writing = true;
        // Blank, not "0.00": an empty box is what puts the grey placeholder back, which is the
        // whole visual signal that nothing has been entered yet.
        valEl.value = inst.counted ? inst.value.toFixed(2) : '';
        inst._writing = false;
      }
      if (fullsEl) fullsEl.textContent = inst.fulls;
      if (totalEl) {
        totalEl.textContent = inst.counted ? this._fmt(inst.fulls + inst.value) : '0.00';
        totalEl.style.color = inst.counted ? col : 'var(--t3)';
      }
      inst.onChange({ value: inst.value, fulls: inst.fulls, total: inst.fulls + inst.value,
                      source: source || 'gesture', counted: inst.counted });
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
    /* ⛔ A TOUCH THAT NEVER MOVED IS NOT AN ANSWER (T25). This used to nudge the value by 0.01 on
       a tap with no drag, and `apply()` fires `onChange` unconditionally, so a thumb brushing the
       control while scrolling a shelf on a phone committed a count. At zero the nudge clamped
       straight back to zero, so the number did not even change and the product still became
       counted-at-zero -- which the usage reader then bills as a whole bottle poured.
       ⭐ The nudge is not lost work: this control already carries a numeric box for an exact value
       and arrow-key support for fine adjustment, both of which are deliberate in a way a tap is
       not. Nothing in the suite pinned the tap-nudge and no help text described it. */
    const finish = (clientY) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      inst.value = this._snap(inst.value);
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
        const rawStr = String(valInput.value ?? '');
        /* ⭐ EMPTY AND MID-TYPE ARE DIFFERENT THINGS, and only measuring the RAW string tells them
           apart. An emptied box is the operator deleting their answer, so it un-counts (T25b).
           A non-empty box that does not parse -- "." or "-" partway through a number -- is nobody
           saying anything yet, so it is left alone, which is what the original comment here was
           protecting: rounding or rewriting mid-type is what stole keystrokes on an earlier build. */
        if (!rawStr.trim()) { inst.value = 0; apply(true, 'clear'); return; }
        const raw = parseFloat(rawStr);
        if (isNaN(raw)) return;
        // Clamp to 0-1 but do NOT round to 2 decimals here.
        inst.value = Math.max(0, Math.min(1, raw));
        apply(true, 'type');
      });
      valInput.addEventListener('blur', () => {
        // An empty box stays empty so the placeholder shows; anything else snaps to 2 decimals and
        // the canonical value is written back. Blur must carry the same source as the typing did,
        // or leaving a deliberately typed 0.00 would un-count it on the way out.
        if (!String(valInput.value ?? '').trim()) { inst.value = 0; apply(true, 'clear'); return; }
        inst.value = this._snap(inst.value);
        apply(false, 'type');
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
