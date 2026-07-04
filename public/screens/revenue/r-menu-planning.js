'use strict';

/* ── Revenue Recovery — Menu Rundown (the data's read on every menu item) ─────
   Independents look at their menu through a personal lens: their recipe, what
   they like to eat. This page takes the emotion out and gives Bar Cop's read on
   each item from the real numbers, operator to operator, no lecture. Every
   briefing is composed IN CODE from the item's own data, so it is instant, free,
   and can't say anything untrue. It is RANK-AWARE: each item is placed against
   the others in its category (only the actual worst Dog "earns the least"), and
   the wording is drawn from wide phrase pools seeded off the item id, so no two
   tiles read the same and each stays stable between renders. A quick-glance stat
   row (Cost / Cost % / Menu Price) sits up top with the cost percent colored by
   where it lands. Reuses the Menu Engineering classifier + target/suggested math
   so the read never drifts. */

S.RevenueMenuPlanning = {
  container: null,

  SECTION_ORDER: ['Appetizers', 'Entrees', 'Desserts', 'Specials', 'Cocktails', 'Beer', 'Wine', 'NA Beverages', 'Snacks'],
  DRINK_CATS: ['Cocktails', 'Beer', 'Wine', 'NA Beverages'],

  items() { return (App.data.menu_items || []).filter(i => !i.archived); },
  nounFor(cat) { return this.DRINK_CATS.indexOf(cat) !== -1 ? 'drink' : 'plate'; },

  _seed(id) { let s = 0; const t = String(id || ''); for (let i = 0; i < t.length; i++) s = (s + t.charCodeAt(i)) % 100000; return s; },
  _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },

  // Quick-glance color for the cost % stat: over target reads as a leak, near it
  // as a watch, comfortably under as a win. Neutral when there is no target.
  costPctColor(pct, target) {
    if (pct == null || !target) return '';
    if (pct > target + 0.5) return 'var(--red)';
    if (pct >= target - 3) return 'var(--amber)';
    return 'var(--green)';
  },

  // A rank (1 = best) turned into an honest standing phrase, drawn from a small
  // synonym pool by seed so two items at the same standing still read differently.
  // Only rank 1 / rank n ever claim the top or the bottom.
  _rankWord(rank, n, kind, seed) {
    if (!(n > 1) || !rank) return kind === 'margin' ? 'its margin' : 'its volume';
    const P = kind === 'margin' ? {
      best: ['the fattest margin', 'the best margin of the bunch', 'the strongest margin here'],
      worst: ['the thinnest margin', 'the weakest margin of the bunch', 'the skinniest margin here'],
      best2: ['the second-fattest margin', 'the second-best margin of the group'],
      worst2: ['the second-thinnest margin', 'the second-weakest margin of the group'],
      up: ['one of the fatter margins', 'an upper-tier margin', 'a healthy margin for the group'],
      low: ['one of the thinner margins', 'a bottom-tier margin', 'a soft margin for the group'],
      mid: ['a middling margin', 'a middle-of-the-pack margin', 'an average margin for the group']
    } : {
      best: ['the top seller', 'your busiest of them', 'the volume leader'],
      worst: ['the slowest mover', 'the least-ordered of them', 'the volume laggard'],
      best2: ['the second-best seller', 'the second-busiest of them'],
      worst2: ['the second-slowest mover', 'the second-least-ordered'],
      up: ['one of the busier sellers', 'an upper-tier seller', 'a strong mover'],
      low: ['one of the slower movers', 'a bottom-tier seller', 'a soft mover'],
      mid: ['a middling seller', 'a middle-of-the-pack seller', 'an average mover']
    };
    let bucket;
    if (rank === 1) bucket = P.best;
    else if (rank === n) bucket = P.worst;
    else if (rank === 2 && n >= 4) bucket = P.best2;
    else if (rank === n - 1 && n >= 4) bucket = P.worst2;
    else { const frac = rank / n; bucket = frac <= 0.34 ? P.up : frac >= 0.67 ? P.low : P.mid; }
    return bucket[(seed + (kind === 'margin' ? 0 : 5)) % bucket.length];
  },

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
  // sentence is composed from this item's own figures and its rank in the group,
  // pulled from wide phrase pools by seed so the reads stay distinct.
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

    const bothBottom = (m === rn && c === rn);
    const dogBucket = bothBottom
      ? ['It is the one dragging the section hardest.', 'It is the anchor on this section, plain and simple.', 'Nothing here earns and moves less.']
      : (m === rn || c === rn)
        ? ['On one measure it is the very bottom of your ' + catLc + '.', 'It hits rock bottom on one of the two here.', 'One of its two numbers is dead last in the group.']
        : ['Others trail it, but it still is not paying for its spot.', 'Not the worst of the bunch, but it is not earning its place.', 'A few trail it, yet it is still not carrying its spot on the menu.'];

    const V = {
      margin: f(margin), covers: covers, noun: noun, cat: catLc, n: cs.n,
      pct: costPct.toFixed(0), target: target, sugg: f(sugg || 0),
      name: drv ? drv.name : '', dcost: drv ? f(drv.cost) : '',
      mword: this._rankWord(m, rn, 'margin', seed), cword: this._rankWord(c, rn, 'covers', seed),
      tail: dogBucket[seed % dogBucket.length],
      dwkc: dwk ? ', about ' + f(dwk) + ' more a week if covers hold' : ''
    };
    V.Mword = this._cap(V.mword); V.Cword = this._cap(V.cword);
    const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => (V[k] != null ? String(V[k]) : ''));
    const pick = (arr, salt) => fill(arr[(seed + (salt || 0)) % arr.length]);

    const lines = [];

    // ── Read line ─────────────────────────────────────────────────────────
    if (quad && cs.ranked) {
      const READ = {
        STAR: ['A Star. It carries {mword} of your {n} {cat} at {margin} a {noun}, and it is {cword} at {covers} a week. Both sides working.',
               'A Star, and it earns the badge: {mword} in the group at {margin} a {noun}, {cword} at {covers} a week.',
               'This one is a Star. {Mword} at {margin} a {noun} and {cword} at {covers} a week. It is doing everything you want.',
               'A Star. Strong on both counts: {mword} at {margin} a {noun} and {cword} at {covers} a week.'],
        PLOWHORSE: ['A Plowhorse. {Cword} at {covers} a week, but it runs {mword} at {margin} a {noun}. The volume is propping up a thin {noun}.',
                    'A Plowhorse. It moves, {cword} at {covers} a week, but the margin is {mword} of the group at {margin}.',
                    'This one is a Plowhorse. People order it, {cword} at {covers} a week, they just are not paying you much for it at {margin} a {noun}.',
                    'A Plowhorse. {Cword} at {covers} a week on {mword} at {margin} a {noun}. Busy, but thin.'],
        PUZZLE: ['A Puzzle. The margin is there, {mword} at {margin} a {noun}, but it is {cword} at {covers} a week. It pays when it sells, it just is not selling.',
                 'A Puzzle. {Mword} at {margin} a {noun}, yet only {cword} at {covers} a week. People are not reaching for it.',
                 'This one is a Puzzle. Good money at {margin} a {noun}, {mword} of the group, but {cword} at {covers} a week. The plate earns, the menu is hiding it.',
                 'A Puzzle. {Mword} at {margin} a {noun}, but {cword} at {covers} a week. Solve the covers and it is a winner.'],
        DOG: ['A Dog. It runs {mword} at {margin} a {noun} and it is {cword} at {covers} a week. {tail}',
              'A Dog. {Mword} at {margin} a {noun}, and {cword} at {covers} a week. {tail}',
              'This one is a Dog. {Mword} at {margin} a {noun} paired with {cword} at {covers} a week. {tail}',
              'A Dog. Low on both: {mword} at {margin} a {noun} and {cword} at {covers} a week. {tail}']
      };
      lines.push(pick(READ[quad] || READ.DOG, 0));
    } else if (cs.n < 4) {
      lines.push(pick(['Only {n} priced {cat} so far, so there is no pack to rank it against yet. It clears {margin} a {noun}. A few more items and this read sharpens.',
                       'Just {n} priced {cat} on the menu, not enough to rank it fairly. For now it clears {margin} a {noun}.',
                       'With only {n} priced {cat}, Bar Cop cannot stack it against the group yet. It clears {margin} a {noun} in the meantime.'], 0));
    } else if (!covers) {
      lines.push(pick(['It clears {margin} a {noun}, but no covers on it yet, so the volume read stays blank until you drop a product mix at the weekly close.',
                       'Margin is {margin} a {noun}. No covers logged yet, so Bar Cop can read the plate but not the pull.',
                       'It earns {margin} a {noun}. Once covers come in at the weekly close, the volume side fills in.'], 0));
    } else {
      lines.push(fill('It clears {margin} a {noun} on {covers} covers a week.'));
    }

    // ── Cost line ─────────────────────────────────────────────────────────
    if (target) {
      lines.push(costPct > target + 0.5
        ? pick(['Cost is running {pct}% against your {target}% target, so the margin is the lever here, not the covers.',
                'At {pct}% cost against a {target}% target, the leak is on the plate, not the volume.',
                'Cost is {pct}% versus your {target}% target. Fix the {noun} before you chase covers.',
                'That {pct}% cost against a {target}% target is where the money is slipping. Tighten the recipe.'], 1)
        : pick(['Cost sits at {pct}% against your {target}% target, right where you want it.',
                'At {pct}% cost against a {target}% target, the margin is clean.',
                'Cost is {pct}% versus a {target}% target. No complaints there.',
                'Plate cost is a tidy {pct}% against your {target}% target.'], 1));
    } else {
      lines.push(fill('Cost runs {pct}% of the price.'));
    }

    // ── Cost driver ───────────────────────────────────────────────────────
    if (drv) lines.push(pick(['The heaviest cost in it is {name} at {dcost} a {noun}.',
                              '{name} is the biggest single cost, {dcost} a {noun}.',
                              'Most of the cost is {name}, {dcost} a {noun}.',
                              'Your priciest line in it is {name}, {dcost} a {noun}.'], 2));

    // ── The move ──────────────────────────────────────────────────────────
    let move = '';
    if (sugg) move = pick(['reprice to {sugg} to bring it back to target{dwkc}. Make the change in Menu Engineering so it is logged, roll it out with the next reprint rather than mid-week, and watch that covers hold after.',
                           '{sugg} is the to-target price{dwkc}. It is a small bump most guests will not blink at, but confirm the volume sticks once it lands before you count the gain.',
                           'take it up to {sugg}{dwkc}. Log it through Menu Engineering, put it on the menu the next time you print, and keep an eye on covers for a couple of weeks after.'], 4);
    else if (quad === 'DOG') move = pick(['rework or cut, but run a 90-day Dog Test first so the call comes from the data and not a gut feel. Make one honest change, a better description, a smaller portion, or a price nudge, and if it still lags, pull it clean.',
                                          'fix it or retire it. Give it 90 days on a Dog Test with a single real change, and if it does not climb on margin or covers, drop it and give the spot to something that earns.',
                                          'this is a rework-or-cut. Dog Test it for 90 days, try one thing that could move it, and if the numbers do not budge, cut it and free the spot for a Puzzle or a Star.'], 4);
    else if (quad === 'STAR') move = pick(['feature it. Give it a power spot where the eye lands and make sure the floor knows to push it, because every extra cover here is your best margin working harder. Leave the price alone.',
                                           'protect it and push it. This is one to build the section around, so put it up top and coach the staff to recommend it, and do not touch a price that is already working.',
                                           'keep it front and center and have the staff sell it. It earns and it moves, so the only wrong move is burying it on the menu or messing with the price.'], 4);
    else if (quad === 'PUZZLE') move = pick(['get it seen. The {noun} already pays, so the whole problem is visibility, a feature, a special, a server callout, or a better spot on the menu. Give it a month of real push before you judge it.',
                                             'put it in front of people. It sells itself once it is tried, so the fix is a sample, a callout, or a menu spot that actually gets read. The margin is already there.',
                                             'give it a better spot or a callout. The money is fine and the exposure is not, so treat this as a marketing problem, not a menu problem, and push it for a few weeks.'], 4);
    else if (quad === 'PLOWHORSE') move = pick(['it is at target on price, so trim the plate cost instead of raising the menu price. Start with the portion or the priciest ingredient, since a few cents saved times this many covers adds up fast.',
                                                'the price is fine, so the lever is cost. Shave it out of the {noun} through portioning or a cheaper spec on the biggest cost line, and the volume does the rest.',
                                                'hold the price and hunt cost in the recipe. It moves enough that even a small margin gain per {noun} turns into real money at this volume.'], 4);

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
        title: 'Menu Rundown',
        lead: 'Menu Rundown gives Bar Cop\'s read on every menu item from the numbers, so the call is the data and not what you happen to like eating. Add and price your menu items first.',
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

    const sCell = (label, val, color) => '<div class="mp-stat"><span class="mp-stat-lbl">' + label + '</span><span class="mp-stat-val"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</span></div>';

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
        const cost = App.menuItemCost(i) || 0;
        const price = i.price || 0;
        const pct = (price > 0 && cost > 0) ? cost / price * 100 : null;
        const stats = '<div class="mp-stats">'
          + sCell('Cost', cost > 0 ? App.fmtCurrency(cost) : '&mdash;')
          + sCell('Cost %', pct != null ? pct.toFixed(0) + '%' : '&mdash;', this.costPctColor(pct, S.RevenueMenuEngineering.targetPctFor(i)))
          + sCell('Menu Price', price > 0 ? App.fmtCurrency(price) : '&mdash;')
          + '</div>';
        return '<div class="mp-tile">'
          + '<div class="mp-name">' + esc(i.name || 'Unnamed') + '</div>'
          + stats
          + '<div class="mp-brief">' + body + '</div>' + moveBand
          + '</div>';
      }).join('');
      return '<div class="sh" style="margin:22px 0 10px;">' + esc(cat) + '</div><div class="mp-grid">' + tiles + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">' + statStrip + sections + '</div>';
  },

  showHowTo() {
    App.showHelpModal('How Menu Rundown Works', [
      { p: ['Menu Rundown gives Bar Cop\'s read on every item on your menu, built from the numbers instead of from what you happen to like eating. Independents get attached to their own recipes, and this page is the honest second opinion: what is working, what is not, and the move that follows.'] },
      { h: 'Built From Your Data', p: ['Every briefing is written from that item\'s own figures: its margin against the rest of its category, where it ranks in the group, its cost percent against your target, the single biggest cost in the recipe, and the move that fits. Only your actual worst Dog is called the worst, because Bar Cop ranks them. It sharpens on its own as covers and price history pile up.'] },
      { h: 'The Numbers Up Top', p: ['Each tile leads with the three that matter at a glance: cost, cost percent, and menu price. The cost percent is colored by where it lands, red when it is over your target, amber when it is close, green when it is comfortably under. The briefing below spells out what those numbers mean and what to do about it.'] },
      { h: 'What To Do', p: ['Items are grouped by section, and inside each section the ones that need a decision come first. Each tile ends with the move: reprice an over-target item and the weekly dollars behind it, feature a Star, get a Puzzle seen, or run a Dog through a 90-day Dog Test before you cut it. Make the change in Menu Builder or Menu Engineering and the read updates next time you land here.'] }
    ]);
  }
};
