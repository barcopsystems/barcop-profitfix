'use strict';

/* ── Profit Recovery — Recipe Cost Analysis ───────────────────────────────────
   Read-only diagnostic view. Every menu item with a recipe is ranked by
   recipe cost %, flagged when over target. Menu items missing a recipe
   surface in a secondary list so the operator can see where ingredient-
   level cost-out is still pending.

   A diagnostic view, not its own editor. "Open Item" reuses the canonical
   Menu Items editor (S.RevenueMenuItems.openEditor) as a MODAL in place and
   re-renders this page on close — same store, no cross-section jump. */

S.RecipeCostAnalysis = {
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const items = App.menuItems();
    if (!items.length) {
      this.container.innerHTML = '<div class="screen"><div class="card"><div class="empty">'
        + '<div class="empty-title">No menu items yet</div>'
        + '<div class="empty-sub">Set up your menu in Revenue Recovery, then come back here to see recipe cost analysis.</div>'
        + '<button class="btn btn-primary" id="rca-jump" style="margin-top:14px;">Go to Menu Items</button>'
        + '</div></div></div>';
      document.getElementById('rca-jump')?.addEventListener('click', () => App.openScreen('r-menu-items'));
      return;
    }

    const hasRecipeFn = i => i.recipe && Array.isArray(i.recipe.ingredients) && i.recipe.ingredients.length;
    const withRecipe  = items.filter(hasRecipeFn);
    const linked      = items.filter(i => !hasRecipeFn(i) && !!i.linked_product_id);
    const noRecipe    = items.filter(i => !hasRecipeFn(i) && !i.linked_product_id);

    // Rank items WITH recipes by recipe cost % vs target (over-target first).
    const ranked = withRecipe.map(i => {
      const cost = App.menuItemCost(i) || 0;
      const tgt  = i.target_cost_pct || (i.recipe.mode === 'food' ? App.MENU_TARGET_COST_PCT.plate : App.MENU_TARGET_COST_PCT.cocktail);
      const pct  = i.price > 0 ? (cost / i.price * 100) : null;
      const over = pct != null && pct > tgt;
      const gap  = (pct != null && over) ? (pct - tgt) : 0;
      return { item: i, cost, tgt, pct, over, gap };
    }).sort((a, b) => (b.over === a.over ? (b.gap - a.gap) : (b.over - a.over)));

    const overCount = ranked.filter(r => r.over).length;

    const summaryTile = (label, value, color) =>
      '<div style="flex:1;min-width:140px;background:var(--input);border:1px solid var(--b1);border-radius:6px;padding:14px 18px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">' + label + '</div>'
      + '<div style="font-size:22px;font-weight:800;color:' + (color || 'var(--t1)') + ';line-height:1;">' + value + '</div>'
      + '</div>';

    const summary = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:18px;">'
      + summaryTile('Items with Recipes', String(withRecipe.length), 'var(--t1)')
      + summaryTile('Over Target', String(overCount), overCount > 0 ? 'var(--red)' : 'var(--gold)')
      + summaryTile('Missing Recipe', String(noRecipe.length), noRecipe.length > 0 ? 'var(--gold)' : 'var(--t3)')
      + '</div>';

    const rankedRows = ranked.map(r => {
      const i = r.item;
      const modeLabel = i.recipe.mode === 'food' ? 'Food Plate' : 'Single Drink';
      const cm = (i.price && r.cost) ? (i.price - r.cost) : null;
      return '<tr>'
        + '<td><div class="val" style="color:' + (r.over ? 'var(--red)' : 'var(--t1)') + ';">' + esc(i.name) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">' + modeLabel + '</div></td>'
        + '<td>' + esc(i.category || '-') + '</td>'
        + '<td>' + (i.price ? App.fmtCurrency(i.price) : '-') + '</td>'
        + '<td>' + App.fmtCurrency(r.cost) + '</td>'
        + '<td>' + (cm != null ? App.fmtCurrency(cm) : '-') + '</td>'
        + '<td class="' + (r.over ? 'neg' : (r.pct != null ? 'pos' : '')) + '">' + (r.pct != null ? r.pct.toFixed(1) + '%' : '-') + '</td>'
        + '<td>' + r.tgt.toFixed(1) + '%</td>'
        + '<td>' + (r.over ? '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);">Over by ' + r.gap.toFixed(1) + '%</span>' : '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">On target</span>') + '</td>'
        + '<td><button class="btn btn-ghost btn-sm rca-edit" data-id="' + i.id + '">Open Item</button></td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="9" style="color:var(--t3);text-align:center;padding:14px;">No menu items have recipes attached yet.</td></tr>';

    const rankedTable = '<div class="sh">Items With Recipes</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Cost-per-serving auto-computes from current product prices in Inventory Control. Items over target sort to the top. Click "Open Item" to edit on the Menu Items screen.'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Menu Item</th><th>Category</th><th>Price</th><th>Cost</th><th>Contrib. Margin</th><th>Cost %</th><th>Target</th><th>Status</th><th></th>'
      + '</tr></thead><tbody>' + rankedRows + '</tbody></table></div>';

    let noRecipeSection = '';
    if (noRecipe.length) {
      const nrRows = noRecipe.map(i => {
        return '<tr>'
          + '<td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td>' + esc(i.category || '-') + '</td>'
          + '<td>' + (i.price ? App.fmtCurrency(i.price) : '-') + '</td>'
          + '<td>' + (i.cost ? App.fmtCurrency(i.cost) : '-') + ' <span style="font-size:9px;color:var(--t3);">(manual)</span></td>'
          + '<td><button class="btn btn-ghost btn-sm rca-edit" data-id="' + i.id + '">Open Item</button></td>'
          + '</tr>';
      }).join('');
      noRecipeSection = '<div class="sh" style="margin-top:24px;">Missing a Recipe</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
          + 'These menu items use a manually-entered cost. Add an ingredient-level recipe on the Menu Items screen to switch to live ingredient-based costing.'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Menu Item</th><th>Category</th><th>Price</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + nrRows + '</tbody></table></div>';
    }

    // Linked Inventory items — Beer / Wine / NA. Show in a dim section so the
    // operator sees them but understands they don't need a recipe (cost flows
    // from the linked product directly).
    let linkedSection = '';
    if (linked.length) {
      const lRows = linked.map(i => {
        const cost = App.menuItemCost(i) || 0;
        const pct  = (i.price > 0 && cost > 0) ? (cost / i.price * 100) : null;
        return '<tr>'
          + '<td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td>' + esc(i.category || '-') + '</td>'
          + '<td>' + (i.price ? App.fmtCurrency(i.price) : '-') + '</td>'
          + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + ' <span style="font-size:9px;color:var(--gold);">(linked product)</span></td>'
          + '<td>' + (pct != null ? pct.toFixed(1) + '%' : '-') + '</td>'
          + '<td><button class="btn btn-ghost btn-sm rca-edit" data-id="' + i.id + '">Open Item</button></td>'
          + '</tr>';
      }).join('');
      linkedSection = '<div class="sh" style="margin-top:24px;">Linked Inventory Items</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
          + 'Direct-pour items (Beer / Wine / NA Beverages). Cost flows from the linked inventory product, no recipe needed. When the product price changes in Inventory Control, these menu items auto-update.'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Menu Item</th><th>Category</th><th>Price</th><th>Cost</th><th>Cost %</th><th></th>'
        + '</tr></thead><tbody>' + lRows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">'
      + summary
      + rankedTable
      + noRecipeSection
      + linkedSection
      + '</div>';

    // Open the menu item's editor as a modal IN PLACE (the canonical Menu Items
    // editor, reused), then re-render this page on close — no cross-section jump
    // to Revenue. One store, multiple doors ([[two-doors-same-data]]).
    this.container.querySelectorAll('.rca-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = App.menuItems().find(i => i.id === btn.dataset.id);
        if (item && S.RevenueMenuItems && S.RevenueMenuItems.openEditor) {
          S.RevenueMenuItems.openEditor(item, { onDone: () => this.draw() });
        }
      });
    });
  }
};
