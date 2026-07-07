'use strict';

/* ── Profit Recovery — Recipe Cost Analysis ───────────────────────────────────
   A read-only diagnostic. Every menu item with a recipe is costed from the live
   ingredient prices in Inventory Control and ranked by cost percentage, so the
   items eating your margin sort to the top. Items still on a manual cost, and
   direct-pour items whose cost auto-flows from a linked product, show in their
   own sections below. All three sections share one column layout so the numbers
   line up straight down the page.

   Not its own editor. "Edit" reuses the canonical Menu Items editor
   (S.RevenueMenuItems.openEditor) as a MODAL in place and re-renders this page
   on close — same store, no cross-section jump ([[two-doors-same-data]]). */

S.RecipeCostAnalysis = {
  // Shared column structure so every section's columns line up across tables
  // (table-layout:fixed + one colgroup is the only way separate tables align).
  COLGROUP:
    '<colgroup>'
    + '<col style="width:20%;"><col style="width:11%;"><col style="width:9%;">'
    + '<col style="width:9%;"><col style="width:10%;"><col style="width:9%;">'
    + '<col style="width:8%;"><col style="width:10%;"><col style="width:14%;">'
    + '</colgroup>',
  THEAD:
    '<thead><tr><th>Menu Item</th><th>Category</th><th>Price</th><th>Cost</th>'
    + '<th>Margin</th><th>Cost %</th><th>Target</th><th>Status</th><th class="no-print"></th></tr></thead>',

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  // One row builder for all three sections, so every column sits in the same
  // place. cost always comes from the canonical App.menuItemCost (recipe, linked
  // product, or manual fallback). opts: { tgt, sub, tag }.
  rcaRow(i, opts) {
    opts = opts || {};
    const cost = App.menuItemCost(i) || 0;
    const pct  = (i.price > 0 && cost > 0) ? (cost / i.price * 100) : null;
    const margin = (i.price && cost) ? (i.price - cost) : null;
    const tgt = opts.tgt != null ? opts.tgt : (i.target_cost_pct || null);
    const hasStatus = (tgt != null && pct != null);
    const over = hasStatus && pct > tgt;
    const tagS = opts.tag ? ' <span style="font-size:9px;color:var(--t3);">' + opts.tag + '</span>' : '';
    const subS = opts.sub ? '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">' + opts.sub + '</div>' : '';
    const statusS = hasStatus
      ? (over ? '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);">Over by ' + (pct - tgt).toFixed(1) + '%</span>'
              : '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">On target</span>')
      : '<span style="color:var(--t3);">-</span>';
    return '<tr>'
      + '<td><div class="val">' + esc(i.name) + '</div>' + subS + '</td>'
      + '<td>' + esc(i.category || '-') + '</td>'
      + '<td>' + (i.price ? App.fmtCurrency(i.price) : '-') + '</td>'
      + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + tagS + '</td>'
      + '<td>' + (margin != null ? App.fmtCurrency(margin) : '-') + '</td>'
      + '<td class="' + (over ? 'neg' : '') + '">' + (pct != null ? pct.toFixed(1) + '%' : '-') + '</td>'
      + '<td>' + (tgt != null ? tgt.toFixed(1) + '%' : '-') + '</td>'
      + '<td>' + statusS + '</td>'
      + '<td class="no-print"><button class="btn btn-ghost btn-sm rca-edit" data-id="' + i.id + '">Work</button></td>'
      + '</tr>';
  },

  dataCard(rowsHtml) {
    return '<div class="card" style="overflow-x:auto;">'
      + '<table class="row-list" style="table-layout:fixed;width:100%;">'
      + this.COLGROUP + this.THEAD + '<tbody>' + rowsHtml + '</tbody></table></div>';
  },

  draw() {
    const items = App.menuItems();

    // ── Day-one / prerequisite empty state ──────────────────────────────
    if (!items.length) {
      App.setupCard(this.container, {
        title: 'Recipe Summary',
        lead: 'This page ranks every plate and drink by recipe cost percentage and flags what is running over target. Set up your menu first, then come back.',
        steps: [
          { title: 'Add your menu items', desc: 'Build your cocktails and food with prices and recipes, and link your beer, wine, and NA pours so cost flows in automatically.', btn: 'Go to Menu Builder', screen: 'r-menu-items', done: false }
        ]
      });
      // setupCard wires App.navigate (same module); Menu Items lives in Revenue,
      // so route the step button through openScreen to switch modules first.
      this.container.onclick = ev => {
        const go = ev.target.closest('.setup-go');
        if (go && go.dataset.go) App.openScreen(go.dataset.go);
      };
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

    // ── Stat strip — counts that map to the three groups below ──────────
    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statsCard = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Items With Recipes', String(withRecipe.length))
      + stat('Over Target', String(overCount), overCount > 0 ? 'warn' : '')
      + stat('Missing a Recipe', String(noRecipe.length), noRecipe.length === 0 ? 'dim' : '')
      + stat('Linked Items', String(linked.length), linked.length === 0 ? 'dim' : '')
      + '</div></div>';

    // ── Items With Recipes (over-target first) ──────────────────────────
    const rankedRows = ranked.map(r =>
      this.rcaRow(r.item, { tgt: r.tgt, sub: r.item.recipe.mode === 'food' ? 'Food Plate' : 'Single Drink' })
    ).join('') || '<tr><td colspan="9" style="color:var(--t3);text-align:center;padding:14px;">No menu items have recipes attached yet.</td></tr>';

    // The .sh prints; Export PDF is no-print so it stays out of the PDF.
    const heroHead = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">Items With Recipes</div>'
        + '<button class="btn btn-ghost btn-sm no-print" id="rca-export">Export PDF</button>'
      + '</div>';
    const rankedTable = heroHead + this.dataCard(rankedRows);

    // ── Missing a Recipe (items on a manual cost) ───────────────────────
    let noRecipeSection = '';
    if (noRecipe.length) {
      const nrRows = noRecipe.map(i => this.rcaRow(i, { tag: '(manual)' })).join('');
      noRecipeSection = '<div class="sh" style="margin-top:24px;">Missing a Recipe</div>' + this.dataCard(nrRows);
    }

    // ── Linked Inventory items — Beer / Wine / NA, cost auto-flows ──────
    let linkedSection = '';
    if (linked.length) {
      const lRows = linked.map(i => this.rcaRow(i, { tag: '(linked)' })).join('');
      linkedSection = '<div class="sh" style="margin-top:24px;">Linked Inventory Items</div>' + this.dataCard(lRows);
    }

    this.container.innerHTML = '<div class="screen">'
      + statsCard + rankedTable + noRecipeSection + linkedSection
      + '</div>';

    // Export the whole analysis (DOM-walk; no-print chrome excluded).
    document.getElementById('rca-export')?.addEventListener('click',
      () => App.exportPDF({ title: 'Recipe Summary', root: this.container }));

    // Edit opens the canonical Menu Items editor as a modal IN PLACE, then
    // re-renders this page on close — no cross-section jump ([[two-doors-same-data]]).
    // Work takes you to Menu Items and opens that item's editor there (its
    // canonical home), cohesive with Loss Prevention / Vendor Discrepancies.
    this.container.querySelectorAll('.rca-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        App._menuItemFocus = btn.dataset.id;
        App.openScreen('r-menu-items');
      });
    });
  },

  showHowTo() {
    App.showHelpModal('How Recipe Summary Works', [
      { p: ['A read-only diagnostic. Every menu item with a recipe is costed from the live prices of its ingredients in Inventory Control, then ranked by cost percentage so the items eating your margin sort to the top.'] },
      { h: 'The Numbers Up Top', p: ['How many items are costed from a recipe, how many of those run over their target cost percentage (red when any do), how many still need a recipe, and how many pull their cost from a linked inventory product.'] },
      { h: 'Items With Recipes', p: ['Cost per serving computes automatically from current product prices, so when a vendor raises a price these update on their own. Cost percent is the cost against the menu price, and over-target items are flagged and sorted to the top. Export PDF saves the full analysis.'] },
      { h: 'Missing a Recipe', p: ['These items carry a hand-entered cost. Edit one and add an ingredient recipe to switch it to live, ingredient-based costing that tracks your real prices.'] },
      { h: 'Linked Inventory Items', p: ['Direct-pour beer, wine, and NA beverages. Cost flows straight from the linked inventory product, no recipe needed, and it updates whenever that product price changes.'] },
      { h: 'Work', p: ['Work takes you to Menu Builder and opens that item\'s editor, where menu items are built and changed. Update the recipe or price there, then come back to Recipe Summary to see the new cost percent.'] }
    ]);
  }
};
