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

   "Apply Selected" updates par_level on each ic_product in one save. */

S.InventoryParSuggestions = {
  // Default settings — persisted to App.inventoryData.par_settings on change
  defaults: { window_weeks: 8, buffer_pct: 30, cycle_days: 7 },
  filterCategory: '',
  selected: {},   // { product_id: true }

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
  weeklyUsageFor(productId, windowWeeks) {
    const counts = this.countsAsc();
    if (counts.length < 2) return null;
    const recent = counts.slice(-Math.max(2, windowWeeks + 1));
    let total_usage = 0;
    let weeks_analyzed = 0;
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
      total_usage += used;
      weeks_analyzed++;
    }
    if (weeks_analyzed === 0) return null;
    return { weeks_analyzed, total_usage, avg_weekly: total_usage / weeks_analyzed };
  },

  computeSuggestion(product, settings) {
    const usage = this.weeklyUsageFor(product.id, settings.window_weeks);
    if (!usage) return { ...usage, suggested: null, status: 'No data', reasoning: 'Need at least two counts for this product to suggest.' };
    const cycleWeeks = (settings.cycle_days || 7) / 7;
    const buffer = (settings.buffer_pct || 0) / 100;
    let suggested = usage.avg_weekly * cycleWeeks * (1 + buffer);
    // Usage is counted in cases for bottle beer, so suggested is already in
    // cases; just round up to a whole case.
    if (product.category === 'Bottle Beer' && product.case_size > 0) {
      suggested = Math.ceil(suggested);
    } else {
      // Every other category: round UP to a whole unit. Operators order in
      // whole bottles, kegs, cases, lbs — partial units don't exist on a
      // vendor sheet. Ceiling means we err on the side of not running out.
      suggested = Math.ceil(suggested);
    }
    const current = Math.round(parseFloat(product.par_level) || 0);
    const delta = suggested - current;
    let status = 'No Change';
    if (delta !== 0) {
      status = delta > 0 ? 'Increase' : 'Reduce';
    }
    return { ...usage, suggested, current, delta, status,
      reasoning: usage.avg_weekly.toFixed(2) + '/wk × ' + cycleWeeks.toFixed(1) + 'wk cycle × ' + (1 + buffer).toFixed(2) + ' buffer' };
  },

  // ── Entry ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="ps-export">Export PDF</button>';
    document.getElementById('ps-export')?.addEventListener('click', () => window.print());
    this.draw();
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
    const settingsCard = '<div class="card"><div class="card-title">Suggestion Settings</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;line-height:1.6;">'
        + 'Adjust how the suggested par is computed. Wider window smooths out one-week spikes; higher buffer protects against stock-out; cycle days is how often you order. The math: avg weekly usage × (cycle_days/7) × (1 + buffer).'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Window (weeks)</label>'
          + '<input type="number" id="ps-window" min="2" max="26" step="1" value="' + settings.window_weeks + '"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Buffer (%)</label>'
          + '<div class="fw"><input class="suf" type="number" id="ps-buffer" min="0" max="100" step="5" value="' + settings.buffer_pct + '"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Delivery Cycle (days)</label>'
          + '<input type="number" id="ps-cycle" min="1" max="30" step="1" value="' + settings.cycle_days + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Filter Category</label>'
          + '<select id="ps-cat">' + catOpts + '</select></div>'
      + '</div></div>';

    // Compute suggestions
    const rows = this.products()
      .filter(p => !this.filterCategory || p.category === this.filterCategory)
      .map(p => ({ product: p, ...this.computeSuggestion(p, settings) }))
      .sort((a, b) => {
        // Sort: Increase first (most action), Reduce second, No Change last, No Data at bottom
        const order = { 'Increase': 0, 'Reduce': 1, 'No Change': 2, 'No data': 3 };
        return (order[a.status] || 9) - (order[b.status] || 9);
      });

    const actionable = rows.filter(r => r.status === 'Increase' || r.status === 'Reduce').length;
    const noData    = rows.filter(r => r.status === 'No data').length;
    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Products Analyzed</div><div class="calc-val">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Changes Suggested</div><div class="calc-val ' + (actionable > 0 ? 'warn' : '') + '">' + actionable + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">No Data</div><div class="calc-val">' + noData + '</div></div>'
      + '</div>';

    const trs = rows.map(r => {
      const p = r.product;
      const currentDisp = r.current != null ? r.current.toString() + (p.category === 'Bottle Beer' && p.case_size > 0 ? ' cs' : '') : '-';
      const suggDisp = r.suggested != null ? r.suggested.toString() + (p.category === 'Bottle Beer' && p.case_size > 0 ? ' cs' : '') : '<span style="color:var(--t4);">-</span>';
      const deltaColor = r.delta > 0 ? 'var(--gold)' : r.delta < 0 ? 'var(--red)' : 'var(--t3)';
      const deltaDisp = r.delta != null ? (r.delta > 0 ? '+' : '') + r.delta.toString() : '-';
      const statusBadge = r.status === 'Increase' ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:2px 6px;">INCREASE</span>'
        : r.status === 'Reduce' ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--red);border:1px solid var(--red);border-radius:3px;padding:2px 6px;">REDUCE</span>'
        : r.status === 'No data' ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--t4);">NO DATA</span>'
        : '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--t3);">OK</span>';
      const canSelect = r.suggested != null && r.status !== 'No Change';
      const checkbox = canSelect
        ? '<input type="checkbox" class="ps-chk" data-id="' + p.id + '"' + (this.selected[p.id] ? ' checked' : '') + ' style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/>'
        : '';
      return '<tr>'
        + '<td style="width:36px;">' + checkbox + '</td>'
        + '<td><div class="val">' + esc(p.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(p.category || '') + '</div></td>'
        + '<td>' + currentDisp + '</td>'
        + '<td>' + (r.avg_weekly != null ? r.avg_weekly.toFixed(1) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td>' + suggDisp + '</td>'
        + '<td style="color:' + deltaColor + ';font-weight:700;">' + deltaDisp + '</td>'
        + '<td>' + statusBadge + '</td>'
        + '<td><div style="font-size:10px;color:var(--t3);">' + esc(r.reasoning || '') + '</div></td>'
        + '</tr>';
    }).join('');

    const tableCard = '<div class="card"><div class="card-title">Suggestions</div>'
      + summary
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
        + '<button class="btn btn-ghost btn-sm" id="ps-sel-actionable">Select All Changes</button>'
        + '<button class="btn btn-ghost btn-sm" id="ps-sel-clear">Clear Selection</button>'
        + '<button class="btn btn-primary btn-sm" id="ps-apply" style="margin-left:auto;">Apply Selected</button>'
        + '<span id="ps-status" style="font-size:11px;color:var(--gold);margin-left:8px;display:none;"></span>'
      + '</div>'
      + (rows.length === 0
          ? '<div style="font-size:13px;color:var(--t3);padding:10px 0;">No products match the filter.</div>'
          : '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
            + '<th></th><th>Product</th><th>Current Par</th><th>Avg Wkly Usage</th><th>Suggested Par</th><th>Delta</th><th>Status</th><th>Math</th>'
            + '</tr></thead><tbody>' + trs + '</tbody></table></div>')
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + settingsCard + tableCard + '</div>';
    this.wire(rows);
  },

  wire(rows) {
    const onChange = async (id, val, key) => {
      const s = this.settings();
      const n = parseInt(val, 10);
      if (isNaN(n)) return;
      s[key] = n;
      await App.saveInventory();
      this.draw();
    };
    document.getElementById('ps-window')?.addEventListener('change', e => onChange(null, e.target.value, 'window_weeks'));
    document.getElementById('ps-buffer')?.addEventListener('change', e => onChange(null, e.target.value, 'buffer_pct'));
    document.getElementById('ps-cycle')?.addEventListener('change',  e => onChange(null, e.target.value, 'cycle_days'));
    document.getElementById('ps-cat')?.addEventListener('change',    e => { this.filterCategory = e.target.value || ''; this.draw(); });

    this.container.querySelectorAll('.ps-chk').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = e.target.dataset.id;
        if (e.target.checked) this.selected[id] = true;
        else delete this.selected[id];
      });
    });
    document.getElementById('ps-sel-actionable')?.addEventListener('click', () => {
      this.selected = {};
      rows.forEach(r => { if (r.status === 'Increase' || r.status === 'Reduce') this.selected[r.product.id] = true; });
      this.draw();
    });
    document.getElementById('ps-sel-clear')?.addEventListener('click', () => {
      this.selected = {};
      this.draw();
    });
    document.getElementById('ps-apply')?.addEventListener('click', () => this.applySelected(rows));
  },

  async applySelected(rows) {
    const ids = Object.keys(this.selected);
    if (!ids.length) {
      App.confirm({ title: 'No products selected', message: 'Tick the box next to each product whose par you want to update, then click Apply Selected.', confirmText: 'OK', cancelText: 'Cancel' });
      return;
    }
    const ok = await App.confirm({
      title: 'Apply suggested par to ' + ids.length + ' product' + (ids.length === 1 ? '' : 's') + '?',
      message: 'Each product\'s par_level field will be updated to the suggested value. You can manually override individual products afterwards on Product Setup.',
      confirmText: 'Apply',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const products = (App.inventoryData && App.inventoryData.ic_products) || [];
    let applied = 0;
    rows.forEach(r => {
      if (!this.selected[r.product.id] || r.suggested == null) return;
      const p = products.find(x => x.id === r.product.id);
      if (!p) return;
      p.par_level = r.suggested;
      p.par_updated_at = new Date().toISOString();
      p.par_source = 'auto-suggestion';
      applied++;
    });
    await App.saveInventory();
    this.selected = {};
    const status = document.getElementById('ps-status');
    if (status) { status.textContent = '✓ Applied ' + applied + ' par update' + (applied === 1 ? '' : 's') + '.'; status.style.display = 'inline'; }
    this.draw();
  }
};
