'use strict';

/* ── Inventory Control — Dynamic Pars ─────────────────────────────────────────
   Dynamic par recommendations from real usage. Operator's biggest cash-flow
   leak is over-ordering (dead stock tying up cash, spoilage in the kitchen).
   This screen surfaces a suggested par for each product based on:

     avg_weekly_usage  =  mean weekly draw over the last N weeks
                          (computed from counts + deliveries)
     suggested_par    =  avg_weekly_usage × delivery_cycle_weeks × (1 + buffer)

   The delivery cycle is read per product from its VENDOR's Delivery Days when
   set (a vendor delivering twice a week => ~3.5-day cycle, so perishables don't
   get a week-long par), falling back to the global default otherwise. Window
   and buffer are global under Settings and recompute the list live.

   Each row shows the dollar impact (cash a Reduce frees, stock an Increase
   costs), the confidence behind it (weeks of counts), Update Par to accept, and
   Keep to dismiss a suggestion you intentionally run against. */

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
    const sorted = [...((App.inventoryData && App.inventoryData.ic_counts) || [])].sort(App.cmpOldest);
    // One count of record per day: a same-day re-count collapses to the latest, so a
    // usage period never comes out zero-length. Same guard the Usage and Variance
    // reports already run. Without it a typo re-count on the same Sunday added a pair
    // with ~zero usage that still counted as a WHOLE WEEK, dragging avg_weekly down and
    // suggesting a par under real demand ("Reduce, $X freed" on a product whose demand
    // never moved), which then fed the Order Sheet nudge and the Par accuracy trend.
    const byDate = new Map();
    sorted.forEach(c => { const d = String(c.date || '').slice(0, 10) || ('_' + c.id); byDate.set(d, c); });
    return [...byDate.values()];
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  categories() {
    return (S.InventoryProducts && S.InventoryProducts.CATEGORIES) || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
  },
  vendorByName(name) {
    if (!name) return null;
    return ((App.inventoryData && App.inventoryData.ic_vendors) || []).find(v => v.name === name) || null;
  },

  // ── Units ──────────────────────────────────────────────────────────────
  unitFor(p) { return App.unitAbbr(App.productUnit(p)); },
  // Quantity with the product's ABBREVIATED stock unit (cs / btls / kegs / lbs
  // ...), so Current Par, Avg Weekly, and Suggested Par all read identically.
  qtyAbbr(p, n) {
    if (n == null || isNaN(n)) return '<span style="color:var(--t4);">-</span>';
    const u = this.unitFor(p);
    const num = (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(1);
    return u ? (num + ' ' + u) : num;
  },

  // ── Delivery cycle ───────────────────────────────────────────────────────
  // Count distinct weekday tokens in a vendor's free-text Delivery Days
  // ("Mon, Thu" => 2). Returns 0 when nothing parseable.
  deliveryDaysPerWeek(vendor) {
    if (!vendor || !vendor.delivery_days) return 0;
    const txt = String(vendor.delivery_days).toLowerCase();
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((n, d) => n + (txt.includes(d) ? 1 : 0), 0);
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
      // counted===false = a partial count skipped this product; its stored total:0 is not
      // a real endpoint, so exclude it (else "used" = the whole shelf and pars inflate).
      const sItems = (startC.items || []).filter(it => it.product_id === productId && it.counted !== false);
      const eItems = (endC.items   || []).filter(it => it.product_id === productId && it.counted !== false);
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
    if (!usage) return { weeks_analyzed: 0, avg_weekly: null, suggested: null, status: 'No data' };
    // Cycle from the product's vendor delivery cadence; default when none on file.
    const perWeek = this.deliveryDaysPerWeek(this.vendorByName(product && product.vendor));
    const cycleDays = perWeek >= 1 ? 7 / perWeek : (settings.cycle_days || 7);
    const cycleSource = perWeek >= 1 ? 'vendor' : 'default';
    const cycleWeeks = cycleDays / 7;
    const buffer = (settings.buffer_pct || 0) / 100;
    // Round UP to a whole unit (cases for bottle beer, bottles, kegs, lbs).
    // Usage is already in the product's stock unit. Operators order in whole
    // units, so the ceiling errs on the side of not running out.
    const suggested = Math.ceil(usage.avg_weekly * cycleWeeks * (1 + buffer));
    const current = Math.round(parseFloat(product.par_level) || 0);
    const delta = suggested - current;
    let status = 'No Change';
    if (delta !== 0) status = delta > 0 ? 'Increase' : 'Reduce';
    return { ...usage, cycle_days: cycleDays, cycle_source: cycleSource, suggested, current, delta, status };
  },

  // Dollar value of holding `units` of a product at par (per stock unit cost).
  parValue(p, units) {
    const c = App.unitCost(p);
    return (c == null || units == null) ? 0 : c * units;
  },

  // A suggestion the operator intentionally kept (dismissed) stays off the list
  // until usage drifts more than 20% from where it was when kept, so a par you
  // run against on purpose stops nagging but a real change re-surfaces it.
  isKept(product, avgWeekly) {
    const k = product && product.par_kept;
    if (!k || k.usage == null || k.usage <= 0 || avgWeekly == null) return false;
    return Math.abs(avgWeekly - k.usage) / k.usage <= 0.20;
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
      { h: 'Delivery Cycle Comes From The Vendor', p: ['You buy liquor weekly but produce two or three times a week, so a single cycle for everything over-pars the things you get often. Bar Cop reads each product\'s cycle from its vendor\'s Delivery Days, so a vendor who delivers twice a week gives a tighter par than a weekly one. The Default Delivery Cycle under Settings is only used when a vendor has no delivery days on file.'] },
      { h: 'What Each Row Tells You', p: ['Only products whose par is off from your real usage show up, so the list is a clean to-do. Each row shows current par, average weekly usage, the suggested par with the reorder cycle it used right under it, whether to Increase or Reduce, the cash impact (a Reduce frees money off the shelf, an Increase costs a little more to stock), and how many weeks of counts back the number under the product name. A cycle marked default means that product\'s vendor has no Delivery Days set yet, so add them on the vendor for a sharper number.'] },
      { h: 'Updating One At A Time', p: ['Weigh each suggestion on its own. A par set too low can run you out two weeks later, so this is a judgment call, not a blanket accept. When you agree, click Update Par and Bar Cop sets that product\'s par. It drops off the list once its par matches usage.'] },
      { h: 'Keeping A Par On Purpose', p: ['Carry extra of something by design? Click Keep and Bar Cop drops that suggestion from the list so it stops nagging. It only comes back if your usage on that product really shifts. You can always change a par by hand on Add Products.'] }
    ]);
  },

  draw() {
    const settings = this.settings();
    const counts = this.countsAsc();
    if (counts.length < 2) {
      App.setupCard(this.container, {
        title: 'Dynamic Pars',
        lead: 'Dynamic Pars reads your real usage and suggests par levels that match how you actually sell, so you stop guessing.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Par suggestions need real usage, which means at least two counts. Take a few weekly counts, and the longer the history the sharper the suggestion.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    // Settings card (top card).
    const settingsCard = '<div class="card form-card"><div class="card-title">'
      + '<span>Dynamic Pars Settings</span></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Count Window</label>'
          + '<div class="fw"><input class="suf" type="number" id="ps-window" min="2" max="26" step="1" value="' + settings.window_weeks + '" style="padding-right:46px;"/><span class="suf">weeks</span></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Buffer (%)</label>'
          + '<div class="fw"><input class="suf" type="number" id="ps-buffer" min="0" max="100" step="5" value="' + settings.buffer_pct + '"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Delivery Cycle</label>'
          + '<div class="fw"><input class="suf" type="number" id="ps-cycle" min="1" max="30" step="1" value="' + settings.cycle_days + '" style="padding-right:40px;"/><span class="suf">days</span></div></div>'
      + '</div></div>';

    // Compute suggestions. Only surface pars that need a move and have not been
    // intentionally kept; products already matching usage (or with no data, or
    // kept on purpose) stay off so the list is a clean to-do.
    const rows = this.products()
      .map(p => ({ product: p, ...this.computeSuggestion(p, settings) }))
      .filter(r => (r.status === 'Increase' || r.status === 'Reduce') && !this.isKept(r.product, r.avg_weekly))
      .sort((a, b) => {
        // Increase first (biggest stock-out risk), then Reduce.
        const order = { 'Increase': 0, 'Reduce': 1 };
        return (order[a.status] || 9) - (order[b.status] || 9);
      });

    // Money headline: what right-sizing this list does to your cash.
    let cashToFree = 0, addedStock = 0, raise = 0, cut = 0;
    rows.forEach(r => {
      const dollarDelta = (r.suggested - r.current) * (App.unitCost(r.product) || 0);
      if (r.status === 'Increase') { raise++; addedStock += Math.max(0, dollarDelta); }
      else { cut++; cashToFree += Math.max(0, -dollarDelta); }
    });
    const stat = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label
      + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('Cash to Free', App.fmtCurrency(cashToFree), cashToFree > 0 ? 'good' : '')
      + stat('Pars to Cut', cut)
      + stat('Pars to Raise', raise)
      + stat('Added Stock', App.fmtCurrency(addedStock))
      + '</div></div>';

    // Export only (the list groups by category, so no category filter).
    const exportRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Par Suggestions</div>'
      + '<button class="btn btn-ghost btn-sm" id="ps-export">Export PDF</button></div>';

    const rowHtml = r => {
      const p = r.product;
      const dollarDelta = (r.suggested - r.current) * (App.unitCost(p) || 0);
      const statusText = r.status === 'Increase'
        ? '<span style="font-weight:700;color:var(--amber);">Increase</span>'
        : '<span style="font-weight:700;color:var(--t2);">Reduce</span>';
      const cashImpact = r.status === 'Reduce'
        ? '<span style="color:var(--green);font-weight:700;">' + App.fmtCurrency(Math.max(0, -dollarDelta)) + ' freed</span>'
        : '<span style="color:var(--t3);">' + App.fmtCurrency(Math.max(0, dollarDelta)) + ' to stock</span>';
      const conf = r.weeks_analyzed ? r.weeks_analyzed + ' wk' + (r.weeks_analyzed === 1 ? '' : 's') + ' of counts' : '';
      const cycTxt = (r.cycle_days % 1 === 0) ? r.cycle_days.toString() : r.cycle_days.toFixed(1);
      const cycleLine = '<div style="font-size:10px;color:var(--t3);">' + cycTxt + '-day cycle' + (r.cycle_source === 'default' ? ' (default)' : '') + '</div>';
      return '<tr>'
        + '<td><div class="val">' + esc(p.name) + '</div>'
        + (conf ? '<div style="font-size:10px;color:var(--t3);">' + conf + '</div>' : '') + '</td>'
        + '<td>' + this.qtyAbbr(p, r.current) + '</td>'
        + '<td>' + this.qtyAbbr(p, r.avg_weekly) + '</td>'
        + '<td>' + this.qtyAbbr(p, r.suggested) + cycleLine + '</td>'
        + '<td>' + statusText + '</td>'
        + '<td>' + cashImpact + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm ps-update" data-id="' + p.id + '" data-suggested="' + r.suggested + '">Update Par</button>'
          + '<button class="btn btn-ghost btn-sm ps-keep" data-id="' + p.id + '" data-usage="' + (r.avg_weekly != null ? r.avg_weekly : '') + '">Keep</button>'
        + '</div></td>'
        + '</tr>';
    };

    // Group suggestions by category (one table per category, the category in the
    // first header, a shared fixed colgroup so columns line up), preserving the
    // Increase-first order within each.
    const ORDER = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const byCat = {};
    rows.forEach(r => { const c = (r.product.category) || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(r); });
    const cats = Object.keys(byCat).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
    });
    const listCard = rows.length === 0
      ? '<div class="card"><div style="font-size:13px;color:var(--t3);padding:8px 0;">No pars need changing right now. Your pars match how you are actually selling.</div></div>'
      : cats.map(c => '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
          + '<colgroup><col style="width:200px;"/><col/><col/><col/><col/><col/><col style="width:180px;"/></colgroup>'
          + '<thead><tr><th>' + esc(c) + '</th><th>Current Par</th><th>Avg Weekly</th><th>Suggested Par</th><th>Status</th><th>Cash Impact</th><th></th></tr></thead>'
          + '<tbody>' + byCat[c].map(rowHtml).join('') + '</tbody></table></div>').join('');

    this.container.innerHTML = '<div class="screen">' + settingsCard + statsCard + exportRow + listCard + '</div>';
    this.wire();
  },

  wire() {
    const onChange = async (val, key) => {
      const s = this.settings();
      const n = parseInt(val, 10);
      if (isNaN(n)) return;
      s[key] = n;
      await App.saveInventory();
      this.draw();
    };
    document.getElementById('ps-window')?.addEventListener('change', e => onChange(e.target.value, 'window_weeks'));
    document.getElementById('ps-buffer')?.addEventListener('change', e => onChange(e.target.value, 'buffer_pct'));
    document.getElementById('ps-cycle')?.addEventListener('change',  e => onChange(e.target.value, 'cycle_days'));
    document.getElementById('ps-export')?.addEventListener('click', () => App.exportPDF({ title: 'Dynamic Pars', root: this.container }));

    // One deliberate Update per product: the operator weighs each suggestion on
    // its own, applies the one row, and it drops off the list once its par
    // matches usage. Keep dismisses a par the operator runs against on purpose.
    this.container.querySelectorAll('.ps-update').forEach(btn => {
      btn.addEventListener('click', () => this.applyOne(btn.dataset.id, parseFloat(btn.dataset.suggested)));
    });
    this.container.querySelectorAll('.ps-keep').forEach(btn => {
      btn.addEventListener('click', () => this.keepOne(btn.dataset.id, parseFloat(btn.dataset.usage)));
    });
  },

  async applyOne(productId, suggested) {
    if (!productId || suggested == null || isNaN(suggested)) return;
    const products = (App.inventoryData && App.inventoryData.ic_products) || [];
    const p = products.find(x => x.id === productId);
    if (!p) return;
    // LIVE row: putRecord cannot revert this for us (see App.putRecord). par_level is what the Order
    // Sheet reorders against, so a refused save left the operator ordering to a par the server never
    // took. restoreRows also puts the DELETED par_kept back, so a refused accept does not silently
    // strip a Keep the operator had set.
    const undo = App.snapshotRows([p]);
    p.par_level = suggested;
    p.par_updated_at = new Date().toISOString();
    p.par_source = 'auto-suggestion';
    if (p.par_kept) delete p.par_kept;   // accepting clears any prior Keep
    if (!(await App.putRecord('ic', 'product', p))) App.restoreRows(undo);   // row-per-record: one product row
    this.draw();
  },

  async keepOne(productId, usage) {
    if (!productId) return;
    const products = (App.inventoryData && App.inventoryData.ic_products) || [];
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const undo = App.snapshotRows([p]);   // live row — putRecord cannot revert it for us
    p.par_kept = { usage: (usage != null && !isNaN(usage)) ? usage : null, at: new Date().toISOString() };
    if (!(await App.putRecord('ic', 'product', p))) App.restoreRows(undo);   // row-per-record: one product row
    this.draw();
  }
};
