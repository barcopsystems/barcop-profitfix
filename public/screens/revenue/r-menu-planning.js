'use strict';

/* ── Revenue Recovery — Menu Planning (the data's read on every menu item) ─────
   Independents look at their menu through a personal lens: their recipe, what
   they like to eat. This page takes the emotion out and gives Bar Cop's read on
   each item from the real numbers, in an operator-to-operator voice, no lecture.
   Every briefing is composed IN CODE from the item's own data (margin vs its
   category, cost percent vs target, the biggest cost driver in the recipe, and
   the move that follows), so it is instant, free, and can't say anything that
   isn't true. It sharpens on its own as covers and price history come in. Items
   are tiles grouped by section, the ones needing action first. Reuses the Menu
   Engineering classifier + target/suggested math so the read never drifts. */

S.RevenueMenuPlanning = {
  container: null,

  // Reading order for the sections (food first, drinks after). Anything unknown
  // sorts to the end alphabetically.
  SECTION_ORDER: ['Appetizers', 'Entrees', 'Desserts', 'Specials', 'Snacks', 'Cocktails', 'Beer', 'Wine', 'NA Beverages'],
  DRINK_CATS: ['Cocktails', 'Beer', 'Wine', 'NA Beverages'],

  items() { return (App.data.menu_items || []).filter(i => !i.archived); },

  nounFor(cat) { return this.DRINK_CATS.indexOf(cat) !== -1 ? 'drink' : 'plate'; },

  // Per-category yardsticks: average margin over priced items, average covers
  // over items that actually ring, the priced count, and whether the category
  // has enough (4+ fully-priced items) to rank against itself.
  categoryStats() {
    const stats = {};
    const byCat = {};
    this.items().forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    Object.keys(byCat).forEach(cat => {
      const list = byCat[cat].map(i => ({ ...i, _cost: App.menuItemCost(i) || 0 }));
      const priced = list.filter(i => i.price > 0 && i._cost > 0);
      const withCov = priced.filter(i => i.weekly_covers > 0);
      const rankable = priced.filter(i => i.weekly_covers > 0);
      stats[cat] = {
        n: priced.length,
        avgMargin: priced.length ? priced.reduce((s, i) => s + (i.price - i._cost), 0) / priced.length : 0,
        avgCovers: withCov.length ? withCov.reduce((s, i) => s + i.weekly_covers, 0) / withCov.length : 0,
        ranked: rankable.length >= 4
      };
    });
    return stats;
  },

  // The single most expensive ingredient in the recipe, per finished plate/drink.
  // Null for linked or flat-cost items (no recipe to break down).
  topCostIngredient(item) {
    if (!item || !item.recipe || !Array.isArray(item.recipe.ingredients) || !item.recipe.ingredients.length) return null;
    const prods = (App.inventoryData && App.inventoryData.ic_products) || [];
    const batches = (App.inventoryData && App.inventoryData.ic_prep_batches) || [];
    const yld = (item.recipe.mode === 'food' && item.recipe.plate_yield > 0) ? item.recipe.plate_yield : 1;
    let top = null;
    item.recipe.ingredients.forEach(ing => {
      const qty = parseFloat(ing.quantity) || 0;
      const src = ing.source || (ing.product_id ? 'product' : null);
      const id = ing.id || ing.product_id;
      let cost = 0, name = ing.name || '';
      if (src === 'batch') { const b = batches.find(x => x.id === id); if (b) { cost = (b.cost_per_serving || 0) * qty; name = name || b.name; } }
      else if (id) { const p = prods.find(x => x.id === id); if (p) { cost = (App.recipeBasis(p).costPerUnit || 0) * qty; name = name || p.name; } else { cost = (parseFloat(ing.cost_per_unit) || 0) * qty; } }
      else { cost = (parseFloat(ing.cost_per_unit) || 0) * qty; }
      cost = cost / yld;
      if (cost > 0 && (!top || cost > top.cost)) top = { name: name || 'an ingredient', cost };
    });
    return (top && top.cost > 0) ? top : null;
  },

  // The briefing itself: an array of short paragraphs composed from the numbers.
  briefing(item, cat, cs, quad) {
    const f = v => App.fmtCurrency(v);
    const cost = App.menuItemCost(item) || 0;
    const price = item.price || 0;
    const covers = item.weekly_covers || 0;
    const noun = this.nounFor(cat);
    const catLc = cat.toLowerCase();
    const paras = [];

    if (!(price > 0)) { paras.push('No price on this one yet. Price it in Menu Builder and Bar Cop can start reading it.'); return paras; }
    if (!(cost > 0)) { paras.push('No cost yet, so there is no margin to read. Attach a recipe or enter a cost in Menu Builder and this fills in.'); return paras; }

    const margin = price - cost;
    const costPct = cost / price * 100;
    const target = S.RevenueMenuEngineering.targetPctFor(item);
    const sugg = S.RevenueMenuEngineering.suggested(item, cost);

    // Read line.
    const cmp = 'It clears ' + f(margin) + ' a ' + noun
      + (cs.ranked ? ' against the ' + f(cs.avgMargin) + ' average across your ' + cs.n + ' ' + catLc : '')
      + (covers ? ', on ' + covers + ' covers a week' + (cs.ranked && cs.avgCovers ? ' versus the ' + Math.round(cs.avgCovers) + ' pack' : '') : '') + '.';
    if (quad && cs.ranked) {
      if (quad === 'STAR') paras.push('A Star, high margin and high volume both. ' + cmp + ' This is a winner. Protect it and keep it where guests look first.');
      else if (quad === 'PLOWHORSE') paras.push('A Plowhorse. It sells, but the margin trails the pack. ' + cmp + ' The volume is carrying a thin ' + noun + '.');
      else if (quad === 'PUZZLE') paras.push('A Puzzle. The margin is there, the covers are not. ' + cmp + ' It pays when it sells, people just are not reaching for it.');
      else paras.push('A Dog. It trails the pack on both margin and covers. ' + cmp + ' Of your ' + catLc + ', it earns the least and moves the least.');
    } else {
      let extra = '';
      if (cs.n < 4) extra = ' Only ' + cs.n + ' priced ' + catLc + ' so far, so Bar Cop cannot rank it against the pack yet. A few more and this read sharpens.';
      else if (!covers) extra = ' No covers on it yet, so the volume side stays blank until you drop a product mix at the weekly close.';
      paras.push(cmp + extra);
    }

    // Cost line.
    if (target) {
      if (costPct > target + 0.5) paras.push('Cost is running ' + costPct.toFixed(0) + '% against your ' + target + '% target, so the margin is the lever here more than the volume.');
      else paras.push('Cost sits at ' + costPct.toFixed(0) + '% against your ' + target + '% target, right where you want it.');
    } else {
      paras.push('Cost runs ' + costPct.toFixed(0) + '% of the price.');
    }

    // Cost driver.
    const drv = this.topCostIngredient(item);
    if (drv) paras.push('The biggest cost in it is ' + drv.name + ' at ' + f(drv.cost) + ' a ' + noun + '.');

    // The move.
    if (sugg) {
      const dwk = covers ? (sugg - price) * covers : null;
      paras.push('Move: reprice to ' + f(sugg) + ' to bring it back to target' + (dwk ? '. If covers hold, that is ' + f(dwk) + ' more a week' : '') + '.');
    } else if (quad === 'DOG') {
      paras.push('Move: rework or cut. Run it through a 90-day Dog Test before you pull it, so the call is the data and not a gut feel.');
    } else if (quad === 'STAR') {
      paras.push('Move: feature it. Give it a power spot on the menu and have the staff push it.');
    } else if (quad === 'PUZZLE') {
      paras.push('Move: get it seen. A feature, a special, or a server callout, since the ' + noun + ' already pays.');
    } else if (quad === 'PLOWHORSE') {
      paras.push('Move: it is already at target, so the lever is trimming the plate cost, not raising the price.');
    }

    return paras;
  },

  // Order within a section: what needs a decision leads.
  actionRank(item, quad) {
    const cost = App.menuItemCost(item) || 0;
    const sugg = (item.price > 0 && cost > 0) ? S.RevenueMenuEngineering.suggested(item, cost) : null;
    if (quad === 'DOG') return 0;
    if (sugg) return 1;
    if (quad === 'PUZZLE') return 2;
    if (quad === 'PLOWHORSE') return 3;
    if (quad === 'STAR') return 4;
    return 5;
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const items = this.items();
    if (!items.length) {
      App.setupCard(this.container, {
        title: 'Menu Planning',
        lead: 'Menu Planning gives Bar Cop\'s read on every menu item from the numbers, so the call is the data and not what you happen to like eating. Add and price your menu items first.',
        steps: [
          { title: 'Build your menu', desc: 'Add and price your menu items in Menu Builder. Each one gets its own briefing here, and it sharpens as covers and price history come in.', btn: 'Go to Menu Builder', screen: 'r-menu-items', done: false }
        ]
      });
      return;
    }

    const classMap = S.RevenueMenuEngineering.classify();
    const catStats = this.categoryStats();

    const byCat = {};
    items.forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    const secRank = c => { const k = this.SECTION_ORDER.indexOf(c); return k === -1 ? 900 : k; };
    const cats = Object.keys(byCat).sort((a, b) => (secRank(a) - secRank(b)) || a.localeCompare(b));

    // Top counts: the menu mix at a glance.
    const counts = { STAR: 0, PUZZLE: 0, PLOWHORSE: 0, DOG: 0 };
    items.forEach(i => { const q = classMap[i.id]; if (q) counts[q]++; });
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statStrip = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('Items', items.length) + stat('Stars', counts.STAR) + stat('Puzzles', counts.PUZZLE)
      + stat('Plowhorses', counts.PLOWHORSE) + stat('Dogs', counts.DOG)
      + '</div></div>';

    const sections = cats.map(cat => {
      const cs = catStats[cat];
      const list = byCat[cat].slice().sort((a, b) => {
        const d = this.actionRank(a, classMap[a.id]) - this.actionRank(b, classMap[b.id]);
        return d || (b.weekly_covers || 0) - (a.weekly_covers || 0) || (a.name || '').localeCompare(b.name || '');
      });
      const tiles = list.map(i => {
        const paras = this.briefing(i, cat, cs, classMap[i.id]).map(p => '<p>' + esc(p) + '</p>').join('');
        return '<div class="mp-tile">'
          + '<div class="mp-tile-head"><span class="mp-name">' + esc(i.name || 'Unnamed') + '</span>'
          + '<span class="mp-price">' + (i.price > 0 ? App.fmtCurrency(i.price) : '<span style="color:var(--t4);">No price</span>') + '</span></div>'
          + '<div class="mp-brief">' + paras + '</div>'
          + '</div>';
      }).join('');
      return '<div class="sh" style="margin:22px 0 10px;">' + esc(cat) + '</div><div class="mp-grid">' + tiles + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">' + statStrip + sections + '</div>';
  },

  showHowTo() {
    App.showHelpModal('How Menu Planning Works', [
      { p: ['Menu Planning gives Bar Cop\'s read on every item on your menu, built from the numbers instead of from what you happen to like eating. Independents get attached to their own recipes, and this page is the honest second opinion: what is working, what is not, and the move that follows.'] },
      { h: 'Built From Your Data', p: ['Every briefing is written from that item\'s own figures: its margin against the rest of its category, its cost percent against your target, the single biggest cost in the recipe, and the move that fits. Nothing here is a guess or a generic tip. It sharpens on its own as covers and price history pile up, so the longer you run Bar Cop, the sharper the read.'] },
      { h: 'Read The Room First', p: ['Items are grouped by section, and inside each section the ones that need a decision come first, your Dogs and anything running over target, then the winners. The counts up top are your menu mix at a glance: how many Stars are pulling their weight and how many Dogs are dragging.'] },
      { h: 'What To Do', p: ['Each briefing names the move: reprice an over-target item and the weekly dollars behind it, feature a Star, get a Puzzle seen, or run a Dog through a 90-day Dog Test before you cut it. Make the change in Menu Builder or Menu Engineering and the read updates the next time you land here.'] }
    ]);
  }
};
