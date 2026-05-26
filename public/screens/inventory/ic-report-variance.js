'use strict';

/* ── Inventory Control — Variance Report (ic_counts + ic_deliveries + POS) ────
   Compares what was used (from inventory counts) against what was sold (from a
   POS sales CSV). Two views: Sales Variance (dollars) and Usage Variance (oz).
   POS sales are imported with the reusable CSVMapper; the import stays in
   memory for the session. */

S.InventoryVarianceReport = {
  tab: 'sales',
  endCountId: null,
  posRows: null,        // [{name, qty, sales}]
  manualMap: {},        // { posName(lowercased): productId }

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  allProducts() { return ((App.inventoryData && App.inventoryData.ic_products) || []); },
  productById(id) { return this.allProducts().find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // ── Usage for the selected period ─────────────────────────────────────────
  currentPeriod() {
    const asc = this.countsAsc();
    if (asc.length < 2) return null;
    let i = asc.findIndex(c => c.id === this.endCountId);
    if (i < 1) i = asc.length - 1;
    return { startC: asc[i - 1], endC: asc[i] };
  },

  usageMap() {
    const period = this.currentPeriod();
    if (!period) return {};
    const { startC, endC } = period;
    const sMap = {}; (startC.items || []).forEach(it => sMap[it.product_id] = it);
    const eMap = {}; (endC.items   || []).forEach(it => eMap[it.product_id] = it);
    const purch = {};
    this.deliveries().filter(d => d.date > startC.date && d.date <= endC.date)
      .forEach(d => (d.line_items || []).forEach(li => {
        purch[li.product_id] = (purch[li.product_id] || 0) + App.bottlesFromDeliveryLine(li);
      }));
    const map = {};
    Object.keys(eMap).forEach(pid => {
      if (!sMap[pid]) return;
      const p = this.productById(pid) || {};
      const used = (sMap[pid].total || 0) + (purch[pid] || 0) - (eMap[pid].total || 0);
      const ppc = p.pours_per_container || null;
      const unitCost = p.unit_cost != null ? p.unit_cost : (eMap[pid].unit_cost != null ? eMap[pid].unit_cost : null);
      map[pid] = {
        product: p, name: eMap[pid].name, used,
        poursMade: ppc != null ? used * ppc : null,
        ouncesUsed: p.container_size_oz != null ? used * p.container_size_oz : null,
        usageCost: unitCost != null ? used * unitCost : null
      };
    });
    return map;
  },

  // ── POS matching ──────────────────────────────────────────────────────────
  posByProduct() {
    const result = {};
    if (!this.posRows) return result;
    const byName = {};
    this.allProducts().forEach(p => { byName[p.name.toLowerCase().trim()] = p; });
    this.posRows.forEach(pr => {
      let p = byName[pr.name.toLowerCase().trim()];
      if (!p && this.manualMap[pr.name.toLowerCase().trim()]) p = this.productById(this.manualMap[pr.name.toLowerCase().trim()]);
      if (p) {
        if (!result[p.id]) result[p.id] = { qty: 0, sales: 0 };
        result[p.id].qty += pr.qty; result[p.id].sales += pr.sales;
      }
    });
    return result;
  },

  unmatchedPos() {
    if (!this.posRows) return [];
    const byName = {};
    this.allProducts().forEach(p => { byName[p.name.toLowerCase().trim()] = true; });
    return this.posRows.filter(pr =>
      !byName[pr.name.toLowerCase().trim()] && !this.manualMap[pr.name.toLowerCase().trim()]);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="vr-export">Export PDF</button>';
    document.getElementById('vr-export')?.addEventListener('click', () => window.print());
    this.draw();
  },

  draw() {
    const asc = this.countsAsc();
    if (asc.length < 2) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Not enough counts yet</div>'
        + '<div class="empty-sub">Variance compares usage between two counts against POS sales. '
        + 'Submit at least two inventory counts first.</div>'
        + '<button class="btn btn-primary" id="vr-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#vr-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const period = this.currentPeriod();
    const periodOpts = asc.slice(1).map((c, i) =>
      '<option value="' + c.id + '"' + (c.id === period.endC.id ? ' selected' : '') + '>'
      + this.fmtDate(asc[i].date) + ' &rarr; ' + this.fmtDate(c.date) + '</option>').reverse().join('');

    const controls = '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:260px;">'
      + '<label>Count Period</label><select id="vr-period">' + periodOpts + '</select></div></div>';

    let body;
    if (!this.posRows) {
      body = '<div class="card"><div class="card-title">Import POS Sales</div>'
        + '<div id="vr-import"></div></div>';
    } else {
      body = this.matchSummary() + this.unmatchedCard() + this.tabsAndBody();
    }

    this.container.innerHTML = '<div class="screen">' + controls + body + '</div>';

    document.getElementById('vr-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.draw(); });

    if (!this.posRows) {
      CSVMapper.mount(document.getElementById('vr-import'), {
        hint: 'Export a product sales report from your POS (Toast, Square, Aloha, Lightspeed, or any system) '
          + 'and upload it here. Map the product name, quantity sold, and sales amount columns.',
        confirmLabel: 'Import POS Sales',
        fields: [
          { key: 'name',  label: 'Product Name',   required: true,  match: ['product','item','name','description','menu item'] },
          { key: 'qty',   label: 'Quantity Sold',  required: false, match: ['qty','quantity','sold','units','count'] },
          { key: 'sales', label: 'Sales Amount',   required: false, match: ['sales','amount','revenue','net sales','total'] }
        ],
        onComplete: rows => {
          this.posRows = rows.map(r => ({
            name: String(r.name || '').trim(),
            qty: parseFloat(String(r.qty || '').replace(/[^0-9.]/g, '')) || 0,
            sales: parseFloat(String(r.sales || '').replace(/[^0-9.-]/g, '')) || 0
          })).filter(r => r.name);
          this.manualMap = {};
          this.draw();
        }
      });
    } else {
      this.wireBody();
    }
  },

  matchSummary() {
    const matched = Object.keys(this.posByProduct()).length;
    const unmatched = this.unmatchedPos().length;
    return '<div class="alert-bar" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div class="alert-text">' + this.posRows.length + ' POS rows imported &middot; '
      + matched + ' matched to products' + (unmatched ? ' &middot; ' + unmatched + ' unmatched' : '') + '.</div>'
      + '<button class="btn btn-ghost btn-sm" id="vr-reimport">Re-import</button></div>';
  },

  unmatchedCard() {
    const un = this.unmatchedPos();
    if (!un.length) return '';
    const prodOpts = '<option value="">Skip: not a tracked product</option>'
      + this.allProducts().slice().sort((a, b) => a.name.localeCompare(b.name))
          .map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('');
    const rows = un.map(pr => '<div class="form-row" style="gap:12px;align-items:center;margin-bottom:8px;">'
      + '<div style="width:240px;font-size:13px;color:var(--t1);font-weight:600;flex-shrink:0;">' + esc(pr.name) + '</div>'
      + '<div class="f" style="width:240px;"><select class="vr-map" data-pos="' + esc(pr.name.toLowerCase().trim()) + '">'
      + prodOpts + '</select></div></div>').join('');
    return '<div class="card"><div class="card-title">Unmatched POS Products</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">These POS product names did not match a '
      + 'product in your master list. Map each to the right product, or leave it skipped.</div>' + rows + '</div>';
  },

  tabsAndBody() {
    const tabBtn = (k, label) => '<button class="vr-tab" data-tab="' + k + '" style="background:none;border:none;'
      + 'border-bottom:2px solid ' + (this.tab === k ? 'var(--gold)' : 'transparent') + ';'
      + 'color:' + (this.tab === k ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
      + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 14px;cursor:pointer;">' + label + '</button>';
    return '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:14px;">'
      + tabBtn('sales', 'Sales Variance') + tabBtn('usage', 'Usage Variance') + '</div>'
      + '<div id="vr-body">' + (this.tab === 'usage' ? this.tabUsage() : this.tabSales()) + '</div>';
  },

  wireBody() {
    document.getElementById('vr-reimport')?.addEventListener('click', () => { this.posRows = null; this.manualMap = {}; this.draw(); });
    this.container.querySelectorAll('.vr-map').forEach(sel =>
      sel.addEventListener('change', e => {
        const pos = e.target.dataset.pos;
        if (e.target.value) this.manualMap[pos] = e.target.value;
        else delete this.manualMap[pos];
        this.draw();
      }));
    this.container.querySelectorAll('.vr-tab').forEach(btn =>
      btn.addEventListener('click', () => { this.tab = btn.dataset.tab; this.draw(); }));
  },

  // ── Status ────────────────────────────────────────────────────────────────
  status(pct) {
    const a = Math.abs(pct || 0);
    if (a < 5)  return { label: 'OK',    color: 'var(--gold)' };
    if (a <= 15) return { label: 'Watch', color: 'var(--steel)' };
    return { label: 'Flag', color: 'var(--red)' };
  },
  badge(pct) {
    const s = this.status(pct);
    return '<span style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:'
      + s.color + ';border:1px solid ' + s.color + ';border-radius:3px;padding:2px 6px;">' + s.label + '</span>';
  },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },
  pct(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : v.toFixed(1) + '%'; },

  // ── Sales Variance ────────────────────────────────────────────────────────
  tabSales() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      const registerSales = pr.sales;
      const theoSales = u.poursMade != null && p.menu_price ? u.poursMade * p.menu_price : null;
      const salesVar = theoSales != null ? theoSales - registerSales : null;
      const varPct = theoSales ? salesVar / theoSales * 100 : null;
      const actualCostPct = registerSales && u.usageCost != null ? u.usageCost / registerSales * 100 : null;
      const actualProfit = u.usageCost != null ? registerSales - u.usageCost : null;
      return { name: u.name, registerSales, theoSales, salesVar, varPct, actualCostPct, actualProfit };
    });
    if (!rows.length) return this.emptyMatch();
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + '</div></td>'
      + '<td>' + this.cur(r.registerSales) + '</td>'
      + '<td>' + this.cur(r.theoSales) + '</td>'
      + '<td>' + this.cur(r.salesVar) + '</td>'
      + '<td>' + this.pct(r.varPct) + '</td>'
      + '<td>' + this.pct(r.actualCostPct) + '</td>'
      + '<td class="' + (r.actualProfit != null ? (r.actualProfit >= 0 ? 'pos' : 'neg') : '') + '">' + this.cur(r.actualProfit) + '</td>'
      + '<td>' + (r.varPct != null ? this.badge(r.varPct) : '-') + '</td>'
      + '</tr>').join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
      + 'Theoretical sales is what the product poured should have rung up. A large positive variance means '
      + 'product left the bar without a matching sale.</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Register Sales</th><th>Theo Sales</th><th>Sales Variance</th>'
      + '<th>Variance %</th><th>Actual Cost %</th><th>Actual Profit</th><th>Status</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  // ── Usage Variance ────────────────────────────────────────────────────────
  tabUsage() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      const ouncesSold = p.pour_size_oz != null ? pr.qty * p.pour_size_oz : null;
      const ounceVar = u.ouncesUsed != null && ouncesSold != null ? u.ouncesUsed - ouncesSold : null;
      const varPct = ounceVar != null && u.ouncesUsed ? ounceVar / u.ouncesUsed * 100 : null;
      return { name: u.name, ouncesSold, ouncesUsed: u.ouncesUsed, poursMade: u.poursMade, used: u.used, ounceVar, varPct };
    });
    if (!rows.length) return this.emptyMatch();
    const n = (v, d) => v == null ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d);
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + '</div></td>'
      + '<td>' + n(r.ouncesSold) + '</td>'
      + '<td>' + n(r.ouncesUsed) + '</td>'
      + '<td>' + n(r.poursMade, 0) + '</td>'
      + '<td>' + n(r.used) + '</td>'
      + '<td>' + n(r.ounceVar) + '</td>'
      + '<td>' + this.pct(r.varPct) + '</td>'
      + '<td>' + (r.varPct != null ? this.badge(r.varPct) : '-') + '</td>'
      + '</tr>').join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
      + 'Ounces used comes from your counts; ounces sold comes from POS quantity at each product\'s pour size. '
      + 'A positive variance is product poured but not sold.</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Oz Sold</th><th>Oz Used</th><th>Pours Made</th><th>Bottles Used</th>'
      + '<th>Oz Variance</th><th>Variance %</th><th>Status</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyMatch() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products have both usage data for this period and a matched POS sales row. '
      + 'Check the count period and the unmatched-product mapping above.</div>';
  }
};
