'use strict';

/* ── Inventory Control — Dynamic Pars ─────────────────────────────────────────
   Dynamic par recommendations from real usage. Operator's biggest cash-flow
   leak is over-ordering (dead stock tying up cash, spoilage in the kitchen).
   This screen surfaces a suggested par for each product based on:

     avg_weekly_usage  =  mean weekly draw over the last N weeks
                          (computed from counts + deliveries)
     suggested_par    =  avg_weekly_usage × delivery_cycle_weeks × (1 + buffer)

   Defaults: 8-week window, 7-day delivery cycle, 30% safety buffer. Operator
   adjusts under Settings card and the suggestions recompute live. Per-product
   delivery cycle override lives on the product record (Phase 2; v1 uses
   global default for everyone).

   "Apply Dynamic Pars" updates par_level on each ic_product in one save. */

S.InventoryParSuggestions = {
  // Default settings — persisted to App.inventoryData.par_settings on change
  defaults: { window_weeks: 8, buffer_pct: 30, cycle_days: 7 },
  filterCategory: '',

  settings() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!App.inventoryData.par_settings) App.inventoryData.par_settings = { ...this.defaults };
    return App.inventoryData.par_settings;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  categories() {
    return (S.InventoryProducts && S.InventoryProducts.CATEGORIES) || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
  },

  // ── Math ──────────────────────────────────────────────────────────────
  // Compute average weekly usage for one product over the last N weeks.
  // Pairs adjacent counts; usage_for_pair = start_total + purchases_between
  // - end_total. Returns { weeks_analyzed, avg_weekly, total_usage } or null
  // if not enough data.
  weeklyUsageFor(productId, windowWeeks, asOfDate) {
    let counts = this.countsAsc();
    // asOfDate limits the window to counts that existed at a past point, so a
    // historical par-accuracy figure (e.g. the dashboard trend) is honest
    // instead of reusing today's suggestion. Omitted = use all counts.
    if (asOfDate) counts = counts.filter(c => c.date <= asOfDate);
    if (counts.length < 2) return null;
    const recent = counts.slice(-Math.max(2, windowWeeks + 1));
    let total_usage = 0;
    let weeks_analyzed = 0;
    let total_weeks = 0;
    for (let i = 1; i < recent.length; i++) {
      const startC = recent[i - 1];
      const endC   = recent[i];
      // Sum a product's lines across all locations it was counted in.
      const sItems = (startC.items || []).filter(it => it.product_id === productId);
      const eItems = (endC.items   || []).filter(it => it.product_id === productId);
      if (!sItems.length || !eItems.length) continue;
      const start = sItems.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
      const end   = eItems.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
      const purch = this.deliveries()
        .filter(d => d.date > startC.date && d.date <= endC.date)
        .reduce((s, d) => s + (d.line_items || [])
          .filter(li => li.product_id === productId)
          .reduce((ss, li) => ss + (App.unitsFromDeliveryLine ? App.unitsFromDeliveryLine(li) : (parseFloat(li.qty) || 0)), 0), 0);
      const used = Math.max(0, start + purch - end);
      // Weight by the ACTUAL time between the two counts so "weekly" is honest
      // even when counts are not exactly seven days apart.
      const days = (new Date(endC.date + 'T00:00:00').getTime() - new Date(startC.date + 'T00:00:00').getTime()) / 86400000;
      total_usage += used;
      total_weeks += days > 0 ? days / 7 : 1;
      weeks_analyzed++;
    }
    if (weeks_analyzed === 0 || total_weeks <= 0) return null;
    return { weeks_analyzed, total_usage, avg_weekly: total_usage / total_weeks };
  },

  computeSuggestion(product, settings, asOfDate) {
    const usage = this.weeklyUsageFor(product.id, settings.window_weeks, asOfDate);
    if (!usage) return { weeks_analyzed: 0, avg_weekly: null, suggested: null, status: 'No data', reasoning: 'Need at least two counts for this product to suggest.' };
    const cycleWeeks = (settings.cycle_days || 7) / 7;
    const buffer = (settings.buffer_pct || 0) / 100;
    let suggested = usage.avg_weekly * cycleWeeks * (1 + buffer);
    // Round UP to a whole unit (cases for bottle beer, bottles, kegs, lbs).
    // Usage is already in the product's stock unit. Operators order in whole
    // units, so the ceiling errs on the side of not running out.
    suggested = Math.ceil(suggested);
    const current = Math.round(parseFloat(product.par_level) || 0);
    const delta = suggested - current;
    let status = 'No Change';
    if (delta !== 0) {
      status = delta > 0 ? 'Increase' : 'Reduce';
    }
    return { ...usage, suggested, current, delta, status,
      reasoning: usage.avg_weekly.toFixed(2) + '/wk × ' + cycleWeeks.toFixed(1) + 'wk × ' + (1 + buffer).toFixed(2) };
  },

  // ── Entry ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Dynamic Pars Work', [
      { p: ['A par is the amount you want on hand for a product. Set it right and the Order Sheet keeps you stocked without tying up cash in dead inventory. Dynamic Pars reads your real usage from your counts and suggests a par for every product, so you are not guessing.'] },
      { h: 'How The Suggestion Is Built', p: ['Bar Cop averages how fast each product actually moved over your recent counts, covers one delivery cycle of that usage, then adds a safety buffer. The math: average weekly usage times your delivery cycle, plus the buffer.'] },
      { h: 'The Three Settings', p: ['Window is how many weeks of counts to average. Buffer is the safety cushion on top of usage. Delivery Cycle is how often you reorder. Change any of them and every suggestion recomputes on the spot.'] },
      { h: 'Reading The List', p: ['Only products whose par is off from your real usage show up here, so the list is a clean to-do, not your whole catalog. Each row shows the current par, average weekly usage, the suggested par, and whether it should Increase or Reduce. The longer your count history, the sharper the suggestion.'] },
      { h: 'Updating One At A Time', p: ['Weigh each suggestion on its own before you act on it. A par set too low can run you out two weeks later, so this is a judgment call, not a blanket accept. When you agree with one, click Update Par on that row and Bar Cop sets that product\'s par to the suggested number. It drops off the list once its par matches usage. You can always change a par by hand on Add Products.'] }
    ]);
  },

  draw() {
    const settings = this.settings();
    const counts = this.countsAsc();
    if (counts.length < 2) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Not enough counts yet</div>'
        + '<div class="empty-sub">Par suggestions need real usage data — at least two inventory counts. Take a few weekly counts and come back. The longer the history, the better the suggestion.</div>'
        + '<button class="btn btn-primary" id="ps-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#ps-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const cats = this.categories();
    const catOpts = '<option value="">All categories</option>'
      + cats.map(c => '<option value="' + esc(c) + '"' + (this.filterCategory === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    // Settings card
    const settingsCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Dynamic Pars Settings</span>'
      + '<button class="btn btn-ghost btn-sm" id="ps-how">How This Works</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Window (weeks) ' + tt('ic-par-window') + '</label>'
          + '<input type="number" id="ps-window" min="2" max="26" step="1" value="' + settings.window_weeks + '"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Buffer (%) ' + tt('ic-par-buffer') + '</label>'
          + '<div class="fw"><input class="suf" type="number" id="ps-buffer" min="0" max="100" step="5" value="' + settings.buffer_pct + '"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Delivery Cycle (days) ' + tt('ic-par-cycle') + '</label>'
          + '<input type="number" id="ps-cycle" min="1" max="30" step="1" value="' + settings.cycle_days + '"/></div>'
      + '</div></div>';

    // Compute suggestions
    // Only surface pars that actually need a move. Products already matching
    // their usage (and ones with no usage data yet) are not shown, so the list
    // is a clean to-do, not a full dump of the catalog.
    const rows = this.products()
      .filter(p => !this.filterCategory || p.category === this.filterCategory)
      .map(p => ({ product: p, ...this.computeSuggestion(p, settings) }))
      .filter(r => r.status === 'Increase' || r.status === 'Reduce')
      .sort((a, b) => {
        // Increase first (biggest stock-out risk), then Reduce.
        const order = { 'Increase': 0, 'Reduce': 1 };
        return (order[a.status] || 9) - (order[b.status] || 9);
      });

    const trs = rows.map(r => {
      const p = r.product;
      const currentDisp = r.current != null ? r.current.toString() + (p.category === 'Bottle Beer' && p.case_size > 0 ? ' cs' : '') : '-';
      const suggDisp = r.suggested != null ? r.suggested.toString() + (p.category === 'Bottle Beer' && p.case_size > 0 ? ' cs' : '') : '<span style="color:var(--t4);">-</span>';
      const deltaColor = r.delta > 0 ? 'var(--gold)' : r.delta < 0 ? 'var(--red)' : 'var(--t3)';
      const deltaDisp = r.delta != null ? (r.delta > 0 ? '+' : '') + r.delta.toString() : '-';
      const statusText = r.status === 'Increase' ? '<span style="font-weight:700;color:var(--gold);">Increase</span>'
        : r.status === 'Reduce' ? '<span style="font-weight:700;color:var(--red);">Reduce</span>'
        : r.status === 'No data' ? '<span style="color:var(--t4);">No data</span>'
        : '<span style="color:var(--t3);">OK</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(p.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(p.category || '') + '</div></td>'
        + '<td>' + currentDisp + '</td>'
        + '<td>' + (r.avg_weekly != null ? esc(App.qtyWithUnit(p, r.avg_weekly)) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td>' + suggDisp + '</td>'
        + '<td style="color:' + deltaColor + ';font-weight:700;">' + deltaDisp + '</td>'
        + '<td>' + statusText + '</td>'
        + '<td><div style="font-size:10px;color:var(--t3);">' + esc(r.reasoning || '') + '</div></td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm ps-update" data-id="' + p.id + '" data-suggested="' + r.suggested + '">Update Par</button></div></td>'
        + '</tr>';
    }).join('');

    const tableCard = '<div class="card"><div class="card-title">Par Suggestions</div>'
      + '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:220px;">'
        + '<label>Filter by Category</label><select id="ps-cat">' + catOpts + '</select></div></div>'
      + (rows.length === 0
          ? '<div style="font-size:13px;color:var(--t3);padding:10px 0;">No pars need changing right now.</div>'
          : '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
            + '<th>Product</th><th>Current Par</th><th>Avg Wkly Usage</th><th>Suggested Par</th><th>Delta</th><th>Status</th><th>Math</th><th></th>'
            + '</tr></thead><tbody>' + trs + '</tbody></table></div>')
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + settingsCard + tableCard + '</div>';
    this.wire();
  },

  wire() {
    const onChange = async (id, val, key) => {
      const s = this.settings();
      const n = parseInt(val, 10);
      if (isNaN(n)) return;
      s[key] = n;
      await App.saveInventory();
      this.draw();
    };
    document.getElementById('ps-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('ps-window')?.addEventListener('change', e => onChange(null, e.target.value, 'window_weeks'));
    document.getElementById('ps-buffer')?.addEventListener('change', e => onChange(null, e.target.value, 'buffer_pct'));
    document.getElementById('ps-cycle')?.addEventListener('change',  e => onChange(null, e.target.value, 'cycle_days'));
    document.getElementById('ps-cat')?.addEventListener('change',    e => { this.filterCategory = e.target.value || ''; this.draw(); });

    // One deliberate Update per product: the operator weighs each suggestion on
    // its own, applies the one row, and it drops off the list once its par
    // matches usage.
    this.container.querySelectorAll('.ps-update').forEach(btn => {
      btn.addEventListener('click', () => this.applyOne(btn.dataset.id, parseFloat(btn.dataset.suggested)));
    });
  },

  async applyOne(productId, suggested) {
    if (!productId || suggested == null || isNaN(suggested)) return;
    const products = (App.inventoryData && App.inventoryData.ic_products) || [];
    const p = products.find(x => x.id === productId);
    if (!p) return;
    p.par_level = suggested;
    p.par_updated_at = new Date().toISOString();
    p.par_source = 'auto-suggestion';
    await App.saveInventory();
    this.draw();
  }
};
