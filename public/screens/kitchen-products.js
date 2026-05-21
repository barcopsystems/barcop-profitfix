'use strict';

/* ── Profit Recovery — Kitchen Products (read-only view of ic_products) ───────
   The product master lives in Inventory Control. This screen is a permanent
   read-only mirror of the Food / Misc products in ic_products. */

S.KitchenProducts = {
  IC_KITCHEN_CATS: ['Food', 'Misc'],

  icKitchenProducts() {
    return ((App.inventoryData && App.inventoryData.ic_products) || [])
      .filter(p => this.IC_KITCHEN_CATS.includes(p.category));
  },

  render(container, actions) {
    actions.innerHTML = '';
    const prods = this.icKitchenProducts();

    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-ghost btn-sm';
    goBtn.textContent = 'Manage in Inventory Control';
    goBtn.addEventListener('click', () => { App.showApp('inventory'); App.navigate('ic-product-setup'); });
    actions.appendChild(goBtn);

    let body;
    if (prods.length === 0) {
      body = '<div class="empty"><div class="empty-title">No kitchen products yet</div>'
        + '<div class="empty-sub">Kitchen products are managed in Inventory Control. Add Food and '
        + 'Misc products there and they will appear here automatically.</div>'
        + '<button class="btn btn-primary" id="kp-go-ic">Open Inventory Control</button></div>';
    } else {
      const rows = prods.map(p => '<tr>'
        + '<td><div class="val">' + esc(p.name) + '</div>'
        + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
        + '<td>' + esc(p.category || '—') + '</td>'
        + '<td>' + esc(p.sub_category || '—') + '</td>'
        + '<td>' + (p.unit_cost != null ? App.fmtCurrency(p.unit_cost) : '<span style="color:var(--t4);">—</span>') + '</td>'
        + '<td>' + esc(p.vendor || '—') + '</td></tr>').join('');
      body = '<div style="font-size:11px;color:var(--gold);font-weight:700;letter-spacing:1px;margin-bottom:12px;">'
        + 'MANAGED IN INVENTORY CONTROL'
        + '<span style="color:var(--t3);font-weight:600;letter-spacing:0.5px;"> &nbsp; Read-only view of the kitchen product master.</span></div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Category</th><th>Sub-Category</th><th>Unit Cost</th><th>Vendor</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    container.innerHTML = '<div class="screen">' + body + '</div>';
    container.onclick = ev => {
      if (ev.target.closest('#kp-go-ic')) { App.showApp('inventory'); App.navigate('ic-product-setup'); }
    };
  }
};
