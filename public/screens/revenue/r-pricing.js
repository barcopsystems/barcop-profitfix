'use strict';

/* ── Revenue Recovery — Price Calculator ──────────────────────────────────────
   A what-if tool for the Pricing gap-area. Pick a menu item, see its cost
   floor, and model a price change: the break-even volume tells you how far
   sales can fall after an increase before total margin slips. Pure client-side
   math, nothing is saved. The Pricing fix process deep-links here. */

S.RevenuePricing = {

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.items = (App.data.menu_items || []).map(m => ({...m, cost: App.menuItemCost(m) || m.cost})).filter(m => m && m.name);
    const opts = '<option value="">Enter values manually...</option>'
      + this.items.map((m, i) => '<option value="' + i + '">' + esc(m.name) + '</option>').join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Item</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:240px;"><label>Menu Item</label><select id="rp-item">' + opts + '</select></div>'
      + '<div class="f" style="width:120px;"><label>Current Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rp-price" step="0.25"/></div></div>'
      + '<div class="f" style="width:120px;"><label>Item Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rp-cost" step="0.05"/></div></div>'
      + '<div class="f" style="width:120px;"><label>Target Cost %</label><div class="fw"><input class="suf" type="number" id="rp-target" value="30" step="1"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div class="form-row" style="margin-bottom:0;">'
      + '<div class="f" style="width:150px;"><label>Weekly Units Sold</label><input type="number" id="rp-volume" step="1" placeholder="0"/></div>'
      + '<div class="f" style="width:130px;"><label>Proposed Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rp-new" step="0.25"/></div></div>'
      + '</div></div>'
      + '<div id="rp-out"></div>'
      + '</div>';

    document.getElementById('rp-item')?.addEventListener('change', e => {
      const m = this.items[parseInt(e.target.value)];
      if (m) {
        const pe = document.getElementById('rp-price'), ce = document.getElementById('rp-cost');
        if (pe) pe.value = m.price != null ? m.price : '';
        if (ce) ce.value = m.cost  != null ? m.cost  : '';
      }
      this.compute();
    });
    ['rp-price', 'rp-cost', 'rp-target', 'rp-volume', 'rp-new'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', () => this.compute()));
    this.compute();
  },

  compute() {
    const num = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
    const price = num('rp-price'), cost = num('rp-cost'), target = num('rp-target');
    const volume = num('rp-volume'), newPrice = num('rp-new');
    const out = document.getElementById('rp-out');
    if (!out) return;

    if (price == null || cost == null) {
      out.innerHTML = '<div class="card"><div class="empty"><div class="empty-title">Enter a price and a cost</div>'
        + '<div class="empty-sub">Pick a menu item, or type a current price and item cost, to see its cost floor and model a price change.</div></div></div>';
      return;
    }

    // ── Cost floor — the lowest price that holds the target cost percentage ──
    const floor = (target && target > 0) ? cost / (target / 100) : null;
    const belowFloor = floor != null && price < floor;
    const curMargin = price - cost;
    const curPct = price > 0 ? cost / price * 100 : null;

    const floorCard = '<div class="card"><div class="card-title">Cost Floor</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Current Cost %</div><div class="calc-val ' + (belowFloor ? 'warn' : 'good') + '">' + (curPct != null ? App.fmtPct(curPct) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Price Floor at ' + (target || 0) + '%</div><div class="calc-val">' + (floor != null ? App.fmtCurrency(floor, 2) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Margin per Unit</div><div class="calc-val">' + App.fmtCurrency(curMargin, 2) + '</div></div>'
      + '</div>'
      + (belowFloor
          ? '<div style="font-size:12px;color:var(--red);margin-top:10px;line-height:1.6;">Priced below floor. At ' + App.fmtCurrency(price, 2) + ' this item runs ' + App.fmtPct(curPct) + ' cost against a ' + target + '% target. The floor is ' + App.fmtCurrency(floor, 2) + '.</div>'
          : (floor != null
              ? '<div style="font-size:12px;color:var(--t3);margin-top:10px;line-height:1.6;">Priced above floor. There is ' + App.fmtCurrency(price - floor, 2) + ' between the current price and the ' + target + '% floor.</div>'
              : ''))
      + '</div>';

    // ── Break-even on a price change ────────────────────────────────────────
    let sensCard;
    if (newPrice == null || volume == null || volume <= 0) {
      sensCard = '<div class="card"><div class="card-title">Price Change</div>'
        + '<div style="font-size:12px;color:var(--t3);line-height:1.6;">Enter weekly units sold and a proposed price to model the break-even volume on a price change.</div></div>';
    } else {
      const newMargin = newPrice - cost;
      if (newMargin <= 0) {
        sensCard = '<div class="card"><div class="card-title">Price Change</div>'
          + '<div style="font-size:12px;color:var(--red);line-height:1.6;">A proposed price of ' + App.fmtCurrency(newPrice, 2) + ' does not cover the ' + App.fmtCurrency(cost, 2) + ' item cost. Raise the proposed price above cost.</div></div>';
      } else {
        const curContribution = curMargin * volume;
        const breakEven  = curContribution / newMargin;
        const cushion    = volume - breakEven;
        const cushionPct = volume > 0 ? Math.abs(cushion / volume * 100) : 0;
        const weeklyGain = (newMargin * volume) - curContribution;
        const isIncrease = newPrice >= price;
        sensCard = '<div class="card"><div class="card-title">Price Change to ' + App.fmtCurrency(newPrice, 2) + '</div>'
          + '<div class="calc">'
          + '<div class="calc-item"><div class="calc-label">New Margin per Unit</div><div class="calc-val good">' + App.fmtCurrency(newMargin, 2) + '</div></div>'
          + '<div class="calc-item"><div class="calc-label">Break-even Weekly Units</div><div class="calc-val">' + breakEven.toFixed(1) + '</div></div>'
          + '<div class="calc-item"><div class="calc-label">If Volume Holds</div><div class="calc-val ' + (weeklyGain >= 0 ? 'good' : 'warn') + '">' + (weeklyGain >= 0 ? '+' : '') + App.fmtCurrency(weeklyGain) + ' / wk</div></div>'
          + '<div class="calc-item"><div class="calc-label">Annualized</div><div class="calc-val ' + (weeklyGain >= 0 ? 'good' : 'warn') + '">' + (weeklyGain >= 0 ? '+' : '') + App.fmtCurrency(weeklyGain * 52) + '</div></div>'
          + '</div>'
          + '<div style="font-size:12px;color:var(--t2);margin-top:12px;line-height:1.7;">'
          + (isIncrease
              ? 'At ' + App.fmtCurrency(newPrice, 2) + ', weekly sales can fall to ' + breakEven.toFixed(0) + ' units, ' + cushionPct.toFixed(0) + '% below the current ' + volume + ', before total margin drops below today. That cushion is what makes a price increase a confident decision.'
              : 'At ' + App.fmtCurrency(newPrice, 2) + ', weekly sales must rise to ' + breakEven.toFixed(0) + ' units, ' + cushionPct.toFixed(0) + '% above the current ' + volume + ', just to hold today\'s total margin. A price cut only pays once the volume lift clears that bar.')
          + '</div></div>';
      }
    }

    out.innerHTML = floorCard + sensCard;
  }
};
