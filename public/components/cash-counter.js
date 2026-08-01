'use strict';

/* ── Cash Counter — shared bill counter ──────────────────────────────────────
   The one tactile cash tool, reused everywhere a manager counts money: Cash
   Drop, Log a Drop on the Cash Board, and Count the Safe. Tap the - / + steppers
   or type a count per bill; coins take a dollar amount. Live per-bill subtotal
   and a running counted total. Denomination keys (h100..h1, coins) match what
   Cash Drop already stores, so the saved shape never changed.

   Usage:
     el.innerHTML = CashCounter.html({ prefix:'cd', values: rec.denominations });
     const counter = CashCounter.mount(el, { onChange: (total, denoms) => {...} });
     counter.total();   // counted dollars
     counter.denoms();  // { h100:2, h20:3, coins:4.50 }
   Scoped per root element, so multiple counters can live on one page. */

window.CashCounter = {
  DENOMS: [
    { key: 'h100', label: '$100', val: 100 },
    { key: 'h50',  label: '$50',  val: 50 },
    { key: 'h20',  label: '$20',  val: 20 },
    { key: 'h10',  label: '$10',  val: 10 },
    { key: 'h5',   label: '$5',   val: 5 },
    { key: 'h1',   label: '$1',   val: 1 }
  ],

  // Total dollars from a stored denominations object (the shape we persist).
  totalOf(d) {
    if (!d) return 0;
    let t = 0;
    this.DENOMS.forEach(dn => { t += (parseInt(d[dn.key], 10) || 0) * dn.val; });
    t += parseFloat(d.coins) || 0;
    return Math.round(t * 100) / 100;
  },

  _stepBtn(dir, key) {
    return '<button type="button" class="ccd-step" data-step="' + dir + '" data-key="' + key + '" '
      + 'style="width:30px;height:34px;flex-shrink:0;border:1px solid var(--b1);border-radius:6px;'
      + 'background:var(--surface);color:var(--t1);font-size:16px;line-height:1;cursor:pointer;font-weight:700;">'
      + (dir > 0 ? '+' : '&minus;') + '</button>';
  },

  html(opts) {
    opts = opts || {};
    const p = opts.prefix || 'cc';
    const vals = opts.values || {};
    const v = x => (x != null && x !== '') ? x : '';

    const row = dn =>
      '<div class="ccd-row" style="display:flex;align-items:center;gap:6px;">'
      + '<div style="width:38px;flex-shrink:0;font-size:13px;font-weight:700;color:var(--t1);">' + dn.label + '</div>'
      + this._stepBtn(-1, dn.key)
      + '<input type="number" class="ccd-cnt" id="' + p + '-' + dn.key + '" data-key="' + dn.key + '" data-val="' + dn.val + '" '
      + 'min="0" step="1" inputmode="numeric" value="' + v(vals[dn.key]) + '" '
      + 'style="width:48px;flex-shrink:0;height:34px;text-align:center;font-size:14px;'
      + 'background:var(--input);border:1px solid var(--b1);border-radius:6px;color:var(--w);"/>'
      + this._stepBtn(1, dn.key)
      + '<div class="ccd-sub" data-key="' + dn.key + '" style="flex:1;text-align:right;font-size:13px;color:var(--t2);min-width:0;">$0</div>'
      + '</div>';

    const coins =
      '<div class="ccd-row" style="display:flex;align-items:center;gap:8px;margin-top:10px;">'
      + '<div style="width:38px;flex-shrink:0;font-size:13px;font-weight:700;color:var(--t1);">Coins</div>'
      + '<div class="fw" style="flex:0 0 150px;width:150px;"><span class="pre">$</span>'
      + '<input class="pre ccd-coins" id="' + p + '-coins" type="number" min="0" step="0.01" inputmode="decimal" '
      + 'value="' + v(vals.coins) + '" style="height:34px;font-size:14px;'
      + 'background:var(--input);border:1px solid var(--b1);border-radius:6px;color:var(--w);"/></div>'
      + '</div>';

    return '<div class="cash-counter" data-prefix="' + p + '">'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;">'
      +   this.DENOMS.map(row).join('')
      + '</div>'
      + coins
      + '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--b2);margin-top:12px;padding-top:12px;">'
      +   '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">Counted Total</div>'
      +   '<div class="ccd-total" style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--gold);line-height:1;">$0</div>'
      + '</div>'
      + '</div>';
  },

  // Wire steppers + inputs within root. Returns a controller. onChange fires on
  // every change with (total, denomsObject).
  mount(root, opts) {
    opts = opts || {};
    if (!root) return null;
    const wrap = root.classList && root.classList.contains('cash-counter')
      ? root : root.querySelector('.cash-counter');
    if (!wrap) return null;

    const ctrl = {
      total() { return CashCounter.totalOf(ctrl.denoms()); },
      /* HAS THE OPERATOR ENTERED ANYTHING AT ALL? `total()` cannot answer this — an untouched
         counter and a counter typed full of zeros both total 0, and `denoms()` drops every
         non-positive cell. A caller that reads 0 as a real count prints a full-balance shortage
         on a form nobody has filled in (SH3). A BLANK cell is the discriminator: typed zeros are
         still a count. */
      touched() {
        return [...wrap.querySelectorAll('.ccd-cnt, .ccd-coins')]
          .some(inp => String(inp.value != null ? inp.value : '').trim() !== '');
      },
      denoms() {
        const d = {};
        wrap.querySelectorAll('.ccd-cnt').forEach(inp => {
          const c = parseInt(inp.value, 10);
          if (!isNaN(c) && c > 0) d[inp.dataset.key] = c;
        });
        const coins = parseFloat(wrap.querySelector('.ccd-coins') && wrap.querySelector('.ccd-coins').value);
        if (!isNaN(coins) && coins > 0) d.coins = coins;
        return d;
      }
    };

    const recompute = () => {
      let total = 0;
      wrap.querySelectorAll('.ccd-cnt').forEach(inp => {
        const c = parseInt(inp.value, 10) || 0;
        const val = parseFloat(inp.dataset.val) || 0;
        const sub = c * val;
        total += sub;
        const subEl = wrap.querySelector('.ccd-sub[data-key="' + inp.dataset.key + '"]');
        if (subEl) subEl.textContent = App.fmtCurrency(sub);
      });
      const coinsEl = wrap.querySelector('.ccd-coins');
      total += parseFloat(coinsEl && coinsEl.value) || 0;
      const tEl = wrap.querySelector('.ccd-total');
      if (tEl) tEl.textContent = App.fmtCurrency(total);
      if (opts.onChange) opts.onChange(Math.round(total * 100) / 100, ctrl.denoms());
    };
    ctrl.recompute = recompute;

    wrap.addEventListener('click', ev => {
      const step = ev.target.closest('.ccd-step');
      if (!step) return;
      const inp = wrap.querySelector('.ccd-cnt[data-key="' + step.dataset.key + '"]');
      if (!inp) return;
      const next = Math.max(0, (parseInt(inp.value, 10) || 0) + (parseInt(step.dataset.step, 10) || 0));
      inp.value = next ? String(next) : '';
      recompute();
    });
    wrap.addEventListener('input', ev => {
      if (ev.target.classList.contains('ccd-cnt') || ev.target.classList.contains('ccd-coins')) recompute();
    });

    recompute();
    return ctrl;
  }
};
