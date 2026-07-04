'use strict';

/* ── Revenue Recovery — Menu Planning (the data's read on every menu item) ─────
   Independents look at their menu through a personal lens: their recipe, what
   they like to eat. This page takes the emotion out and gives Bar Cop's read on
   each item from the real numbers, operator to operator, no lecture. Every
   briefing is composed IN CODE from the item's own data, so it is instant, free,
   and can't say anything untrue. It is RANK-AWARE: each item is placed against
   the others in its category (only the actual worst Dog "earns the least"), and
   the wording varies deterministically by item id, so no two tiles read the
   same. It sharpens as covers and price history come in. Reuses the Menu
   Engineering classifier + target/suggested math so the read never drifts. */

S.RevenueMenuPlanning = {
  container: null,

  SECTION_ORDER: ['Appetizers', 'Entrees', 'Desserts', 'Specials', 'Snacks', 'Cocktails', 'Beer', 'Wine', 'NA Beverages'],
  DRINK_CATS: ['Cocktails', 'Beer', 'Wine', 'NA Beverages'],

  items() { return (App.data.menu_items || []).filter(i => !i.archived); },
  nounFor(cat) { return this.DRINK_CATS.indexOf(cat) !== -1 ? 'drink' : 'plate'; },

  // Stable per-item seed so the wording varies item to item but never reshuffles
  // between renders.
  _seed(id) { let s = 0; const t = String(id || ''); for (let i = 0; i < t.length; i++) s = (s + t.charCodeAt(i)) % 100000; return s; },
  _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },

  // A rank (1 = best) turned into an honest standing phrase. Only rank 1 / rank n
  // ever claim the top or the bottom, so no two items claim the same superlative.
  _rankWord(rank, n, kind) {
    if (!(n > 1) || !rank) return kind === 'margin' ? 'its margin' : 'its volume';
    const W = kind === 'margin'
      ? { best: 'the fattest margin', worst: 'the thinnest margin', best2: 'the second-fattest margin', worst2: 'the second-thinnest margin', up: 'one of the fatter margins', low: 'one of the thinner margins', mid: 'a middling margin' }
      : { best: 'the top seller', worst: 'the slowest mover', best2: 'the second-best seller', worst2: 'the second-slowest mover', up: 'one of the busier sellers', low: 'one of the slower movers', mid: 'a middling seller' };
    if (rank === 1) return W.best;
    if (rank === n) return W.worst;
    if (rank === 2 && n >= 4) return W.best2;
    if (rank === n - 1 && n >= 4) return W.worst2;
    const frac = rank / n;
    if (frac <= 0.34) return W.up;
    if (frac >= 0.67) return W.low;
    return W.mid;
  },

  // Per-category yardsticks + a margin rank and a covers rank for every rankable
  // item (priced with covers). ranked = 4+ rankable items, enough to rank fairly.
  categoryStats() {
    const stats = {};
    const byCat = {};
    this.items().forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    Object.keys(byCat).forEach(cat => {
      const list = byCat[cat].map(i => ({ i, cost: App.menuItemCost(i) || 0 }));
      const priced = list.filter(x => x.i.price > 0 && x.cost > 0);
      const rankable = priced.filter(x => x.i.weekly_covers > 0);
      const mRank = {}, cRank = {};
      rankable.slice().sort((a, b) => (b.i.price - b.cost) - (a.i.price - a.cost)).forEach((x, idx) => { mRank[x.i.id] = idx + 1; });
      rankable.slice().sort((a, b) => (b.i.weekly_covers || 0) - (a.i.weekly_covers || 0)).forEach((x, idx) => { cRank[x.i.id] = idx + 1; });
      stats[cat] = {
        n: priced.length,
        avgMargin: priced.length ? priced.reduce((s, x) => s + (x.i.price - x.cost), 0) / priced.length : 0,
        avgCovers: rankable.length ? rankable.reduce((s, x) => s + x.i.weekly_covers, 0) / rankable.length : 0,
        ranked: rankable.length >= 4,
        rankedN: rankable.length,
        mRank, cRank
      };
    });
    return stats;
  },

  // The single most expensive ingredient in the recipe, per finished plate/drink.
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

  // The briefing: { lines: [paragraphs], move: '<action text or ''>' }. Every
  // sentence is composed from this item's own figures and its rank in the group.
  briefing(item, cat, cs, quad) {
    const f = v => App.fmtCurrency(v);
    const cost = App.menuItemCost(item) || 0;
    const price = item.price || 0;
    const covers = item.weekly_covers || 0;
    const noun = this.nounFor(cat);
    const catLc = cat.toLowerCase();

    if (!(price > 0)) return { lines: ['No price on this one yet. Price it in Menu Builder and Bar Cop can start reading it.'], move: '' };
    if (!(cost > 0)) return { lines: ['No cost yet, so there is no margin to read. Attach a recipe or enter a cost in Menu Builder and this fills in.'], move: '' };

    const margin = price - cost;
    const costPct = cost / price * 100;
    const target = S.RevenueMenuEngineering.targetPctFor(item);
    const sugg = S.RevenueMenuEngineering.suggested(item, cost);
    const drv = this.topCostIngredient(item);
    const seed = this._seed(item.id);
    const m = cs.mRank[item.id], c = cs.cRank[item.id], rn = cs.rankedN;
    const dwk = (sugg && covers) ? (sugg - price) * covers : 0;

    const V = {
      margin: f(margin), covers: covers, noun: noun, cat: catLc, n: cs.n,
      pct: costPct.toFixed(0), target: target, sugg: f(sugg || 0), dwk: f(dwk),
      name: drv ? drv.name : '', dcost: drv ? f(drv.cost) : '',
      mword: this._rankWord(m, rn, 'margin'), cword: this._rankWord(c, rn, 'covers')
    };
    V.Mword = this._cap(V.mword); V.Cword = this._cap(V.cword);
    const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => (V[k] != null ? String(V[k]) : ''));
    const pick = (arr, salt) => fill(arr[(seed + (salt || 0)) % arr.length]);

    const lines = [];

    // ── Read line ─────────────────────────────────────────────────────────
    if (quad && cs.ranked) {
      const bothBottom = (m === rn && c === rn);
      const dogTail = bothBottom
        ? 'It is the one dragging the section hardest.'
        : (m === rn || c === rn)
          ? 'On one measure it is the very bottom of your ' + catLc + '.'
          : pick(['Others trail it, but it still is not paying for its spot.', 'Not the worst of the bunch, but it is not earning its place.'], 3);
      const READ = {
        STAR: ['A Star. It carries {mword} of your {n} {cat} at {margin} a {noun}, and it is {cword} at {covers} a week. Both sides working.',
               'A Star, and it earns the badge: {mword} in the group at {margin} a {noun}, {cword} at {covers} a week.'],
        PLOWHORSE: ['A Plowhorse. {Cword} at {covers} a week, but it runs {mword} at {margin} a {noun}. The volume is propping up a thin {noun}.',
                    'A Plowhorse. It moves, {cword} at {covers} a week, but the margin is {mword} of the group at {margin}.'],
        PUZZLE: ['A Puzzle. The margin is there, {mword} at {margin} a {noun}, but it is {cword} at {covers} a week. It pays when it sells, it just is not selling.',
                 'A Puzzle. {Mword} at {margin} a {noun}, yet only {cword} at {covers} a week. People are not reaching for it.'],
        DOG: ['A Dog. It runs {mword} at {margin} a {noun} and it is {cword} at {covers} a week. ' + dogTail,
              'A Dog. {Mword} at {margin} a {noun}, and {cword} at {covers} a week. ' + dogTail]
      };
      lines.push(pick(READ[quad] || READ.DOG, 0));
    } else {
      if (cs.n < 4) lines.push(pick(['Only {n} priced {cat} so far, so there is no pack to rank it against yet. It clears {margin} a {noun}. A few more items and this read sharpens.',
                                      'Just {n} priced {cat} on the menu, not enough to rank it fairly. For now it clears {margin} a {noun}.'], 0));
      else if (!covers) lines.push(pick(['It clears {margin} a {noun}, but no covers on it yet, so the volume read stays blank until you drop a product mix at the weekly close.',
                                         'Margin is {margin} a {noun}. No covers logged yet, so Bar Cop can read the plate but not the pull.'], 0));
      else lines.push(fill('It clears {margin} a {noun} on {covers} covers a week.'));
    }

    // ── Cost line ─────────────────────────────────────────────────────────
    if (target) {
      lines.push(costPct > target + 0.5
        ? pick(['Cost is running {pct}% against your {target}% target, so the margin is the lever here, not the covers.',
                'At {pct}% cost against a {target}% target, the leak is on the plate, not the volume.',
                'Cost is {pct}% versus your {target}% target. Fix the {noun} before you chase covers.'], 1)
        : pick(['Cost sits at {pct}% against your {target}% target, right where you want it.',
                'At {pct}% cost against a {target}% target, the margin is clean.',
                'Cost is {pct}% versus a {target}% target. No complaints there.'], 1));
    } else {
      lines.push(fill('Cost runs {pct}% of the price.'));
    }

    // ── Cost driver ───────────────────────────────────────────────────────
    if (drv) lines.push(pick(['The heaviest cost in it is {name} at {dcost} a {noun}.',
                              '{name} is the biggest single cost, {dcost} a {noun}.',
                              'Most of the cost is {name}, {dcost} a {noun}.'], 2));

    // ── The move ──────────────────────────────────────────────────────────
    let move = '';
    if (sugg) move = pick(['reprice to {sugg} to pull it back to target' + (dwk ? ', about {dwk} more a week if covers hold' : '') + '.',
                           '{sugg} is the to-target price' + (dwk ? ', roughly {dwk} more a week if the covers hold' : '') + '.'], 4);
    else if (quad === 'DOG') move = pick(['rework or cut. Run a 90-day Dog Test before you pull it so it is the data making the call.',
                                          'fix the recipe or retire it, but Dog Test it 90 days first so you are not guessing.'], 4);
    else if (quad === 'STAR') move = pick(['feature it. Power spot on the menu, and have the floor push it.',
                                           'protect it and push it. This is one to build the section around.'], 4);
    else if (quad === 'PUZZLE') move = pick(['get it seen. A feature, a special, a server callout. The {noun} already pays.',
                                             'put it in front of people. It sells itself once it is tried.'], 4);
    else if (quad === 'PLOWHORSE') move = pick(['it is at target, so trim the plate cost rather than raise the price.',
                                                'the price is fine, so the lever is shaving cost out of the {noun}.'], 4);

    return { lines, move };
  },

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
        const b = this.briefing(i, cat, cs, classMap[i.id]);
        const body = b.lines.map(p => '<p>' + esc(p) + '</p>').join('');
        const moveBand = b.move ? '<div class="mp-move"><span class="mp-move-lbl">Move:</span> ' + esc(b.move) + '</div>' : '';
        return '<div class="mp-tile">'
          + '<div class="mp-tile-head"><span class="mp-name">' + esc(i.name || 'Unnamed') + '</span>'
          + '<span class="mp-price">' + (i.price > 0 ? App.fmtCurrency(i.price) : '<span style="color:var(--t4);">No price</span>') + '</span></div>'
          + '<div class="mp-brief">' + body + '</div>' + moveBand
          + '</div>';
      }).join('');
      return '<div class="sh" style="margin:22px 0 10px;">' + esc(cat) + '</div><div class="mp-grid">' + tiles + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">' + statStrip + sections + '</div>';
  },

  showHowTo() {
    App.showHelpModal('How Menu Planning Works', [
      { p: ['Menu Planning gives Bar Cop\'s read on every item on your menu, built from the numbers instead of from what you happen to like eating. Independents get attached to their own recipes, and this page is the honest second opinion: what is working, what is not, and the move that follows.'] },
      { h: 'Built From Your Data', p: ['Every briefing is written from that item\'s own figures: its margin against the rest of its category, where it ranks in the group, its cost percent against your target, the single biggest cost in the recipe, and the move that fits. Only your actual worst Dog is called the worst, because Bar Cop ranks them. It sharpens on its own as covers and price history pile up.'] },
      { h: 'Read The Room First', p: ['Items are grouped by section, and inside each section the ones that need a decision come first, your Dogs and anything running over target, then the winners. The counts up top are your menu mix at a glance: how many Stars are pulling their weight and how many Dogs are dragging.'] },
      { h: 'What To Do', p: ['Each tile ends with the move: reprice an over-target item and the weekly dollars behind it, feature a Star, get a Puzzle seen, or run a Dog through a 90-day Dog Test before you cut it. Make the change in Menu Builder or Menu Engineering and the read updates next time you land here.'] }
    ]);
  }
};
