'use strict';

/* ── Profit Recovery — Bar Products (read-only view of ic_products) ───────────
   The product master lives in Inventory Control. This screen is a permanent
   read-only mirror of the bar-category products (Liquor, Wine, Bottle Beer,
   Draft Beer) in ic_products. */

S.BarProducts = {
  icBarProducts() {
    return ((App.inventoryData && App.inventoryData.ic_products) || [])
      .filter(p => App.BAR_CATS.includes(p.category));
  },

  render(container, actions) {
    actions.innerHTML = '';
    const target = App.data.settings.targets?.bar_pour_cost_pct ?? 22;
    const prods = this.icBarProducts();

    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-ghost btn-sm';
    goBtn.textContent = 'Manage in Inventory Control';
    goBtn.addEventListener('click', () => { App.showApp('inventory'); App.navigate('ic-product-setup'); });
    actions.appendChild(goBtn);

    let body;
    if (prods.length === 0) {
      body = '<div class="empty"><div class="empty-title">No bar products yet</div>'
        + '<div class="empty-sub">Bar products are managed in Inventory Control. Add Liquor, Wine, '
        + 'and Beer products there and they will appear here automatically.</div>'
        + '<button class="btn btn-primary" id="bp-go-ic">Open Inventory Control</button></div>';
    } else {
      const rows = prods.map(p => {
        const pc = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
        return '<tr>'
          + '<td><div class="val">' + esc(p.name) + '</div>'
          + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
          + '<td>' + esc(p.category || '-') + '</td>'
          + '<td>' + (p.container_size_oz != null ? p.container_size_oz + ' oz' : '-') + '</td>'
          + '<td>' + (p.pour_size_oz != null ? p.pour_size_oz + ' oz' : '-') + '</td>'
          + '<td>' + (p.unit_cost != null ? App.fmtCurrency(p.unit_cost) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (p.cost_per_pour != null ? App.fmtCurrency(p.cost_per_pour) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td class="' + pc + '">' + (p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '</tr>';
      }).join('');
      body = '<div style="font-size:11px;color:var(--gold);font-weight:700;letter-spacing:1px;margin-bottom:12px;">'
        + 'MANAGED IN INVENTORY CONTROL'
        + '<span style="color:var(--t3);font-weight:600;letter-spacing:0.5px;"> &nbsp; Read-only view of the bar product master.</span></div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Category</th><th>Container</th><th>Pour</th><th>Unit Cost</th><th>Cost/Pour</th><th>Pour Cost %</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    container.innerHTML = '<div class="screen">' + body + '</div>';
    container.onclick = ev => {
      if (ev.target.closest('#bp-go-ic')) { App.showApp('inventory'); App.navigate('ic-product-setup'); }
    };
  }
};
