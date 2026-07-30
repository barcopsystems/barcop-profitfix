'use strict';

/* ── Revenue Recovery — Menu Rundown (the data's read on every menu item) ──────
   Independents look at their menu through a personal lens: their recipe, what
   they like to eat. This page takes the emotion out and gives Bar Cop's read on
   each item from the real numbers, operator to operator, no lecture. Every
   briefing is composed IN CODE from the item's own data, so it is instant, free,
   and can't say anything untrue. It is RANK-AWARE: each item is placed against
   the others in its category (only the actual worst Dog "earns the least"), the
   wording is drawn from wide phrase pools seeded off the item id (no two tiles
   read alike, stable between renders), and a dry aside lands here and there. It
   reads the covers TREND (prev vs current), shows each item's MIX share, and each
   tile carries the one button that acts on its move. Reuses the Menu Engineering
   classifier + target/suggested math so the read never drifts. */

S.RevenueMenuPlanning = {
  container: null,

  // The page shows every type at once, so section order is the UNION of the three per-type lists,
  // in type order. Derived, never a second copy: a hardcoded list went stale the moment sections
  // became per-type, and every operator-added section fell to the bottom of the page.
  // ⚠ EACH ENTRY CARRIES ITS TYPE. Returning bare names meant the cocktail pool was positioned by
  // whichever name happened to match first — and "Specials" is a builtin of BOTH the dish and the
  // cocktail list, so on every stock account the drinks landed on the dish Specials slot and split
  // the food sections in half: Appetizers | Entrees | Desserts | Cocktails | Specials | Beer.
  sectionOrder() {
    const out = [];
    ['plate', 'cocktail', 'inventory'].forEach(t => App.menuCatOptions(t).forEach(c => {
      if (!out.some(o => o.name.toLowerCase() === String(c).toLowerCase())) out.push({ name: c, type: t });
    }));
    return out;
  },
  // No Prep sections that pour. Used for the drink/plate wording on linked items only — a
  // cocktail's noun comes from its TYPE now (see nounFor).
  DRINK_CATS: ['Cocktails', 'Beer', 'Wine', 'NA Beverages'],

  items() { return (App.data.menu_items || []).filter(i => !i.archived); },
  // "a drink" or "a plate" in the copy. A COCKTAIL is a drink whatever section it is filed under —
  // that is exactly what per-type sections made possible, and the old category-only lookup called
  // a Happy Hour or Frozen cocktail a plate. No Prep still reads off the section, because that is
  // where its real split is: Beer/Wine/NA pour, Snacks do not.
  // ⚠ READS THE ITEM'S OWN CATEGORY, NOT THE DISPLAY LABEL. Passing the label in meant a qualified
  // heading — "Beer (No Prep)", which appears the moment a dish section is also called Beer — no
  // longer matched DRINK_CATS, and every bottled beer read as "a plate".
  nounFor(item) {
    if (App.menuTypeOf(item) === 'cocktail') return 'drink';
    const c = String((item && item.category) || '');
    return this.DRINK_CATS.some(d => d.toLowerCase() === c.toLowerCase()) ? 'drink' : 'plate';
  },

  // The section name as it reads INSIDE a sentence ("your cocktails"), which is not the heading:
  // the "(Dishes)" qualifier exists only to tell two headings apart and reads as an aside
  // mid-sentence, an acronym must keep its case, and "Uncategorized" is not a countable noun.
  _catPhrase(label) {
    const s = String(label || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!s || s.toLowerCase() === 'uncategorized') return 'unsorted items';
    return s.split(' ').map(w => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase())).join(' ');
  },

  _seed(id) { let s = 0; const t = String(id || ''); for (let i = 0; i < t.length; i++) s = (s + t.charCodeAt(i)) % 100000; return s; },
  _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },

  costPctColor(pct, target) {
    if (pct == null || !target) return '';
    if (pct > target + 0.5) return 'var(--red)';
    if (pct >= target - 3) return 'var(--amber)';
    return 'var(--green)';
  },

  /* ⚠⚠ THE WORD MAY NOT ARGUE WITH THE VERDICT (M1). `rank` is ORDINAL — a position in a sort of
     the items that have covers. The verdict beside it (Star/Plowhorse/Puzzle/Dog) is MEAN-RELATIVE,
     `>= the group average` over every PRICED item. Two scales in one sentence, so the sentence
     contradicted itself. Measured before the fix: four bottle-beer cases at one case price are all
     at the mean and all Stars, and the sort still handed out 1/2/3/4 — "A Star. It carries the
     second-thinnest margin at $12.00 a drink ... Both sides working." And it was never only ties:
     in ANY four-item section rank 2 is best2 and rank 3 is worst2, so an ordinary spread group
     printed "A Puzzle ... yet only the second-best seller at 70 a week" — Puzzle MEANS low volume.
     `hi` IS THE VERDICT'S OWN SIDE, handed in by the caller straight off the quad. It is never a
     second mean computed here: two computations of one quantity is exactly how these drifted apart
     ([[the-loop]] #54), and the pools differ anyway (the verdict's mean counts priced items with no
     covers; the ranks do not, which is how the fattest RANKED margin could sit below the mean).
     A superlative is spent only when it AGREES with that side and the value is UNIQUE in the pool —
     a tied value holds no position however the sort happens to break it. `hi == null` means no
     verdict was reached, and with no verdict there is no honest comparison to make.
     ⚠⚠ A TIE FALLS TO THE SIDE WORD, NOT TO "middling" — and my first version of this fix got that
     wrong in both directions, which is the part worth keeping. I sent a tie to `mid` because the
     fixture in front of me was four IDENTICAL beers, where the tie sits exactly on the mean and
     "an average margin" is true. It is only true there. A tie at a section's EXTREME is just as
     ordinary, and `mid` then claimed a position the item does not hold — the same false-claim class
     `unique` was added to kill (margins $4/$4/$32/$33 printed "a middling margin at $4.00" beside
     two tiles reading $32 and $33). Worse, the READ templates below assert the side IN PROSE right
     next to the slot — "Strong on both counts", "Both sides working", "Low on both" — so a mid word
     contradicted its own sentence and merely MOVED the defect from verdict-vs-word to
     word-vs-template. The side is a fact for every ranked item; a PLACE is not. So `mid` is gone. */
  _rankWord(rank, n, kind, seed, hi, unique) {
    if (!(n > 1) || !rank || hi == null) return kind === 'margin' ? 'its margin' : 'its volume';
    const P = kind === 'margin' ? {
      best: ['the fattest margin', 'the best margin of the bunch', 'the strongest margin here'],
      worst: ['the thinnest margin', 'the weakest margin of the bunch', 'the skinniest margin here'],
      best2: ['the second-fattest margin', 'the second-best margin'],
      worst2: ['the second-thinnest margin', 'the second-weakest margin'],
      up: ['one of the fatter margins', 'an upper-tier margin', 'a healthy margin'],
      low: ['one of the thinner margins', 'a bottom-tier margin', 'a soft margin']
    } : {
      best: ['the top seller', 'your busiest of them', 'the volume leader'],
      worst: ['the slowest mover', 'the least-ordered of them', 'the volume laggard'],
      best2: ['the second-best seller', 'the second-busiest of them'],
      worst2: ['the second-slowest mover', 'the second-least-ordered'],
      up: ['one of the busier sellers', 'an upper-tier seller', 'a strong mover'],
      low: ['one of the slower movers', 'a bottom-tier seller', 'a soft mover']
    };
    // The SIDE is a fact for every ranked item, so it is the floor. A PLACE has to be earned:
    // unique value, and only where that place cannot disagree with the side.
    let bucket = hi ? P.up : P.low;
    if (unique) {
      if (rank === 1 && hi) bucket = P.best;
      else if (rank === n && !hi) bucket = P.worst;
      else if (rank === 2 && n >= 4 && hi) bucket = P.best2;
      else if (rank === n - 1 && n >= 4 && !hi) bucket = P.worst2;
    }
    return bucket[(seed + (kind === 'margin' ? 0 : 5)) % bucket.length];
  },

  /* ⚠ KEYED BY THE SHARED COMPARISON BASIS (App.menuGroupKey), not by the raw category.
     It used to group on i.category while Menu Engineering and the server audit grouped on
     menuGroupKey, so this page printed "A Dog" — a verdict reached against the whole cocktail
     pool — right next to "the thinnest margin of the bunch", measured against only the cocktails
     in that one section. Two different packs in one sentence. Per-type sections would have made
     it routine instead of theoretical, since cocktails can now be split across four sections.
     ⚠ THE KEYS ARE NEVER SHOWN. They read "plate|Desserts". Every display path goes through
     App.menuGroupLabel — a raw key leaked into operator copy once already. */
  categoryStats() {
    const stats = {};
    const byCat = {};
    this.items().forEach(i => { const c = App.menuGroupKey(i); (byCat[c] = byCat[c] || []).push(i); });
    Object.keys(byCat).forEach(cat => {
      const list = byCat[cat].map(i => ({ i, cost: App.menuItemCost(i) || 0 }));
      const priced = list.filter(x => x.i.price > 0 && x.cost > 0);
      const rankable = priced.filter(x => x.i.weekly_covers > 0);
      const mRank = {}, cRank = {};
      rankable.slice().sort((a, b) => (b.i.price - b.cost) - (a.i.price - a.cost)).forEach((x, idx) => { mRank[x.i.id] = idx + 1; });
      rankable.slice().sort((a, b) => (b.i.weekly_covers || 0) - (a.i.weekly_covers || 0)).forEach((x, idx) => { cRank[x.i.id] = idx + 1; });
      /* ⚠ WHICH VALUES TIE, so _rankWord can refuse to claim a position that nobody holds. A rank
         is a place in a sort, and a sort breaks a tie by array order — so two items on the same
         margin were told one had the fattest and the other the second-fattest. Compared in CENTS:
         float noise on `price - cost` reads two genuinely equal margins as distinct, which hands
         the superlative straight back out. */
      const cents = v => Math.round((Number(v) || 0) * 100);
      const tieMap = (pool, val) => {
        const seen = {}, tied = {}, atMin = {};
        let min = null;
        pool.forEach(x => { const k = cents(val(x)); seen[k] = (seen[k] || 0) + 1; if (min == null || k < min) min = k; });
        pool.forEach(x => { const k = cents(val(x)); tied[x.i.id] = seen[k] > 1; atMin[x.i.id] = (k === min); });
        return { tied, atMin };
      };
      /* ⚠ MARGIN TIES ARE MEASURED OVER EVERY PRICED ITEM, NOT JUST THE RANKED ONES, and the reason
         is what the operator can SEE. The page renders a tile for every priced item with its Cost and
         Menu Price, so a never-sold item's margin is on screen even though it holds no rank — and a
         ranked tile claiming "the fattest margin at $11.00" directly under a visible tile also
         reading $11.00 is a contradiction the operator reads off the screen. COVERS ties stay on
         `rankable`, because an item with no covers has no cover count on screen to be compared with
         (it gets the "no covers yet" line instead). Same family as the `n` vs `rankedN` note below,
         one level in. `atMin` is what lets the Dog tail claim a bottom only when it really is one. */
      const mMap = tieMap(priced, x => x.i.price - x.cost);
      const cMap = tieMap(rankable, x => x.i.weekly_covers || 0);
      const mTied = mMap.tied, cTied = cMap.tied, mAtMin = mMap.atMin, cAtMin = cMap.atMin;
      stats[cat] = {
        n: priced.length,
        avgMargin: priced.length ? priced.reduce((s, x) => s + (x.i.price - x.cost), 0) / priced.length : 0,
        avgCovers: rankable.length ? rankable.reduce((s, x) => s + x.i.weekly_covers, 0) / rankable.length : 0,
        totalCovers: byCat[cat].reduce((s, i) => s + (i.weekly_covers || 0), 0),
        ranked: rankable.length >= 4,
        rankedN: rankable.length,
        mRank, cRank, mTied, cTied, mAtMin, cAtMin
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

  // { lines: [paragraphs], move: '<action text>' }, all composed from this item's
  // figures + its rank, pulled from wide pools by seed so the reads stay distinct.
  // `used` is a page-wide Set so a dry aside is woven into the read at most once,
  // never repeated across tiles.
  // ⚠ `cat` IS THE DISPLAY LABEL (App.menuGroupLabel), never the group key. It is lowercased
  // into the copy below as {cat} — "your 12 cocktails at $9.60 a drink" — so a raw key would
  // print "your 12 plate|desserts". That exact leak shipped once already.
  briefing(item, cat, cs, quad, used) {
    used = used || new Set();
    const f = v => App.fmtCurrency(v);
    const cost = App.menuItemCost(item) || 0;
    const price = item.price || 0;
    const covers = item.weekly_covers || 0;
    const noun = this.nounFor(item);
    const catLc = this._catPhrase(cat);

    if (!(price > 0)) return { lines: ['No price on this one yet. Price it in Menu Builder and Bar Cop can start reading it.'], move: '' };
    if (!(cost > 0)) return { lines: ['No cost yet, so there is no margin to read. Attach a recipe or enter a cost in Menu Builder and this fills in.'], move: '' };

    const margin = price - cost;
    const costPct = cost / price * 100;
    const target = S.RevenueMenuEngineering.targetPctFor(item);
    const sugg = S.RevenueMenuEngineering.suggested(item, cost);
    const drv = this.topCostIngredient(item);
    const seed = this._seed(item.id);
    const m = cs.mRank[item.id], c = cs.cRank[item.id], rn = cs.rankedN;
    /* ⚠ THE VERDICT'S OWN SIDE, read straight off the quad rather than recomputed from a mean here.
       This is the definition classify() ranks by (hiM && hiV = Star, !hiM && hiV = Plowhorse,
       hiM && !hiV = Puzzle, neither = Dog), so the rank word beside the verdict cannot disagree
       with it. `null` when nothing was ranked: with no verdict there is no side to take. */
    const hiM = quad ? (quad === 'STAR' || quad === 'PUZZLE') : null;
    const hiV = quad ? (quad === 'STAR' || quad === 'PLOWHORSE') : null;
    const dwk = (sugg && covers) ? (sugg - price) * covers : 0;

    /* ⚠ TIE-AWARE FOR THE SAME REASON _rankWord IS (M1, second half). `m === rn` is a place in a
       sort, and a sort breaks a tie by array order — so with margins 20/5/5/5 and covers 100/10/10/10
       one of three IDENTICAL items was told "Nothing here earns and moves less" while its two twins
       were told "Others trail it", which is false when nothing is behind any of them. A bottom claim
       is only honest if this item is ALONE down there, and a "someone trails it" claim is only honest
       if someone does. Ties get their own read, because level is a real answer.
       ⚠⚠ MEASURED FROM `atMin`, NOT FROM `rank === rn`, and my first version of this used the rank —
       which made "It is level with the weakest of your sides, with nothing to separate them" print on
       an item with two thinner AND two slower siblings, because a tie ANYWHERE satisfied it. A bottom
       claim is a claim about the MINIMUM, so it has to be measured against the minimum. */
    const mBottom = !!(cs.mAtMin[item.id] && !cs.mTied[item.id]);
    const cBottom = !!(cs.cAtMin[item.id] && !cs.cTied[item.id]);
    const tiedLow = !!((cs.mAtMin[item.id] && cs.mTied[item.id]) || (cs.cAtMin[item.id] && cs.cTied[item.id]));
    const dogBucket = (mBottom && cBottom)
      ? ['It is the one dragging the section hardest.', 'It is the anchor on this section, plain and simple.', 'Nothing here earns and moves less.']
      : (mBottom || cBottom)
        ? ['On one measure it is the very bottom of your ' + catLc + '.', 'It hits rock bottom on one of the two here.', 'One of its two numbers is dead last in the group.']
        : tiedLow
          ? ['It is level with the weakest of your ' + catLc + ', with nothing to separate them.', 'It ties with the others at the bottom here, and none of them are earning the spot.', 'It sits level with the weakest in the group, so there is nobody behind it.']
          : ['Others trail it, but it still is not paying for its spot.', 'Not the worst of the bunch, but it is not earning its place.', 'A few trail it, yet it is still not carrying its spot on the menu.'];

    const V = {
      // ⚠ `n` is the PRICED count and it must only ever be used by the "not enough to rank yet"
      // branch, which is the one place it is true. The ranked READ lines used to print it next to
      // a superlative measured over `rankedN` (priced AND with covers) — "the strongest margin of
      // your 12 cocktails" on a page where seven other cocktail tiles showed a fatter margin,
      // because only 5 of the 12 had covers. Cocktail pooling widened the gap.
      // ⚠ ROUNDED FOR DISPLAY. Units sold is a COUNT, and two doors write it without rounding —
      // Menu Builder's Units Sold field (`parseFloat`) and its CSV import — so a stray decimal
      // printed "an average mover at 12.004 a week" in the operator's read. PMIX already rounds.
      margin: f(margin), covers: Math.round(covers), noun: noun, cat: catLc, n: cs.n, s: cs.n === 1 ? '' : 's',
      pct: costPct.toFixed(0), target: target, sugg: f(sugg || 0),
      name: drv ? drv.name : '', dcost: drv ? f(drv.cost) : '',
      // Bare reads of mTied/cTied on purpose: they are required for correctness, and guarding them
      // would silently go back to spending a superlative on a tie ([[the-loop]] #40).
      mword: this._rankWord(m, rn, 'margin', seed, hiM, !cs.mTied[item.id]),
      cword: this._rankWord(c, rn, 'covers', seed, hiV, !cs.cTied[item.id]),
      tail: dogBucket[seed % dogBucket.length],
      dwkc: dwk ? ', about ' + f(dwk) + ' more a week if covers hold' : ''
    };
    V.Mword = this._cap(V.mword); V.Cword = this._cap(V.cword);
    const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => (V[k] != null ? String(V[k]) : ''));
    const pick = (arr, salt) => fill(arr[(seed + (salt || 0)) % arr.length]);

    const lines = [];

    // ── Read line ─────────────────────────────────────────────────────────
    /* ⚠ `m && c` IS NOT BELT-AND-BRACES (S288). A priced item with NO covers is still in the
       verdict's pool, so it has a quad, and `cs.ranked` is a fact about the SECTION — so a
       never-sold item took this branch, where every template quotes a rank it does not have.
       Real output: "A Puzzle. Its margin at $180.00 a drink, but its volume at 0 a week." The
       correct sentence for it was already written two branches down and was unreachable. */
    if (quad && cs.ranked && m && c) {
      const READ = {
        // ⚠ NO SECOND LOCATOR IN THESE TEMPLATES. Four of the six _rankWord pools already end in
        // one ("the best margin of the bunch", "your busiest of them"), so "{mword} in the group"
        // printed "the best margin of the bunch in the group" on roughly two tiles in three.
        STAR: ['A Star. It carries {mword} at {margin} a {noun}, and it is {cword} at {covers} a week. Both sides working.',
               'A Star, and it earns the badge: {mword} at {margin} a {noun}, {cword} at {covers} a week.',
               'This one is a Star. {Mword} at {margin} a {noun} and {cword} at {covers} a week. It is doing everything you want.',
               'A Star. Strong on both counts: {mword} at {margin} a {noun} and {cword} at {covers} a week.'],
        PLOWHORSE: ['A Plowhorse. {Cword} at {covers} a week, but it runs {mword} at {margin} a {noun}. The volume is propping up a thin {noun}.',
                    'A Plowhorse. It moves, {cword} at {covers} a week, but it runs {mword} at {margin}.',
                    'This one is a Plowhorse. People order it, {cword} at {covers} a week, they just are not paying you much for it at {margin} a {noun}.',
                    'A Plowhorse. {Cword} at {covers} a week on {mword} at {margin} a {noun}. Busy, but thin.'],
        PUZZLE: ['A Puzzle. The margin is there, {mword} at {margin} a {noun}, but it is {cword} at {covers} a week. It pays when it sells, it just is not selling.',
                 'A Puzzle. {Mword} at {margin} a {noun}, yet only {cword} at {covers} a week. People are not reaching for it.',
                 'This one is a Puzzle. Good money at {margin} a {noun}, {mword}, but {cword} at {covers} a week. The plate earns, the menu is hiding it.',
                 'A Puzzle. {Mword} at {margin} a {noun}, but {cword} at {covers} a week. Solve the covers and it is a winner.'],
        DOG: ['A Dog. It runs {mword} at {margin} a {noun} and it is {cword} at {covers} a week. {tail}',
              'A Dog. {Mword} at {margin} a {noun}, and {cword} at {covers} a week. {tail}',
              'This one is a Dog. {Mword} at {margin} a {noun} paired with {cword} at {covers} a week. {tail}',
              'A Dog. Low on both: {mword} at {margin} a {noun} and {cword} at {covers} a week. {tail}']
      };
      lines.push(pick(READ[quad] || READ.DOG, 0));
    } else if (cs.n < 4) {
      // "item{s} in {cat}" rather than "{n} {cat}": the count and the section name were glued
      // together, so a section with one item in it read "Only 1 priced desserts" — and an import
      // with no category column read "Only 3 priced uncategorized".
      lines.push(pick(['Only {n} priced item{s} in {cat} so far, so there is no pack to rank it against yet. It clears {margin} a {noun}. A few more items and this read sharpens.',
                       'Just {n} priced item{s} in {cat} on the menu, not enough to rank it fairly. For now it clears {margin} a {noun}.',
                       'With only {n} priced item{s} in {cat}, Bar Cop cannot stack it against the group yet. It clears {margin} a {noun} in the meantime.'], 0));
    } else if (!(covers > 0)) {
      /* ⚠ `> 0`, NOT FALSY. A count that cannot legitimately be zero takes the strict test
         ([[the-loop]] #73). `!covers` let a legacy NEGATIVE through to the bare template below,
         which printed it raw: "It clears $9.00 a plate on -5 covers a week." The form and the
         importer both refuse a negative now, so only data already on file can be shaped that way —
         and this branch is what it lands in, which is also the honest read for it. */
      lines.push(pick(['It clears {margin} a {noun}, but no covers on it yet, so the volume read stays blank until you drop a product mix at the weekly close.',
                       'Margin is {margin} a {noun}. No covers logged yet, so Bar Cop can read the plate but not the pull.',
                       'It earns {margin} a {noun}. Once covers come in at the weekly close, the volume side fills in.'], 0));
    } else {
      lines.push(fill('It clears {margin} a {noun} on {covers} covers a week.'));
    }

    // ── Covers trend (prev read vs now) ───────────────────────────────────
    const prev = item.prev_weekly_covers;
    if (prev != null && prev > 0 && covers >= 0) {
      const tr = (covers - prev) / prev * 100;
      if (tr <= -10 || tr >= 10) {
        V.tr = Math.round(Math.abs(tr));
        lines.push(tr < 0
          ? pick(['Units sold are down {tr}% since your last read. Worth a look before it settles in.',
                  'Volume slipped {tr}% from the last read. Keep an eye on it.',
                  'Units sold fell {tr}% since last time. Not a trend yet, but watch it.'], 7)
          : pick(['Units sold are up {tr}% since your last read. Whatever you changed is working.',
                  'Volume climbed {tr}% from the last read. Keep doing that.',
                  'Units sold jumped {tr}% since last time. Ride it.'], 7));
      }
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

    // ── An occasional dry aside, woven onto the end of the read line (~1 in 4),
    // and never the same one twice across the page (page-wide `used` set keyed on
    // the raw template so the same joke can't repeat as a plate and a drink). ──
    if (quad && cs.ranked && (seed % 4 === 0) && lines.length) {
      const HUMOR = {
        STAR: ['The kind of {noun} you quietly thank at close.', 'If everything pulled like this, you would sleep at night.', 'It earns its spot, which is rarer than it should be.', 'This is the one carrying the quiet load.'],
        PLOWHORSE: ['Everybody\'s favorite, nobody\'s down payment.', 'It keeps the lights on and the margin humble.', 'The crowd loves it, the P&L just tolerates it.', 'A workhorse that forgot to ask for a raise.'],
        PUZZLE: ['Great {noun}, terrible at introducing itself.', 'The wallflower with the best numbers in the room.', 'All dressed up and nobody ordering it.', 'It is hiding in plain sight on your own menu.'],
        DOG: ['It has stayed on the menu out of loyalty, not math.', 'If it were on payroll, you would have had the talk by now.', 'The only thing it moves is the needle the wrong way.', 'It is taking up a seat and not tipping.']
      };
      const pool = HUMOR[quad] || [];
      for (let k = 0; k < pool.length; k++) {
        const raw = pool[(seed + 6 + k) % pool.length];
        if (!used.has(raw)) { used.add(raw); lines[0] = lines[0] + ' ' + fill(raw); break; }
      }
    }

    // ── The move ──────────────────────────────────────────────────────────
    let move = '';
    if (sugg) move = pick(['reprice to {sugg} to bring it back to target{dwkc}. Log it in Menu Engineering, roll it out on the next reprint, and watch covers hold after.',
                           '{sugg} is the to-target price{dwkc}. Most guests will not blink at a bump this size, but confirm the volume sticks before you count the win.',
                           'take it up to {sugg}{dwkc}. Put it on the next printed menu rather than mid-week, and keep an eye on covers for a couple weeks.',
                           'walk it to {sugg}{dwkc}. Small move, real money at this count, just make sure the covers do not flinch once it lands.',
                           'set it at {sugg}{dwkc}. Log the change so Recovery tracks it, then let the next menu print carry it in quietly.',
                           'nudge it to {sugg}{dwkc}. A quarter here and there, but across this many covers it stacks up, so hold the line once it is on.'], 4);
    else if (quad === 'DOG') move = pick(['rework or cut, but run a 90-day Dog Test first so the call is the data and not a hunch. Make one honest change, and if it still lags, pull it clean.',
                                          'fix it or retire it. Give it 90 days on a Dog Test with a single real change, and if margin or covers do not move, drop it and hand the spot to something that earns.',
                                          'this is a rework-or-cut. Dog Test it 90 days, try one thing that might move it, and if the numbers sit still, cut it and free the slot.',
                                          'put it on a 90-day Dog Test before you touch it. One change, one fair shot, and if it flops, it comes off without the second-guessing.',
                                          'rework the recipe or the price, then Dog Test it 90 days. If it will not climb, retire it and give a Puzzle that room instead.',
                                          'give it 90 days on a Dog Test with one honest fix. If it does not earn its keep by then, it has told you what to do.'], 4);
    else if (quad === 'STAR') move = pick(['feature it. Give it a power spot where the eye lands and have the floor push it, because every extra cover here is your best margin working harder. Leave the price alone.',
                                           'protect it and push it. Build the section around it, put it up top, and coach the staff to recommend it. Do not touch a price that is already working.',
                                           'keep it front and center and let the staff sell it. It earns and it moves, so the only wrong move is burying it or messing with the price.',
                                           'lead with it. This is the one you want guests to see first, so give it the real estate and the staff mention, and hold the price steady.',
                                           'showcase it and let it work. It carries the section, so the play is more eyes on it, not a single change to the plate or the price.',
                                           'put it where people look and keep it there. A Star like this wants attention, not adjustment, so resist the urge to tinker.'], 4);
    else if (quad === 'PUZZLE') move = pick(['get it seen. The {noun} already pays, so the whole problem is visibility, a feature, a special, a server callout, or a better spot. Give it a month of real push.',
                                             'put it in front of people. It sells itself once it is tried, so the fix is a sample, a callout, or a spot on the menu that actually gets read.',
                                             'give it a better spot or a callout. The money is fine and the exposure is not, so treat it as a marketing problem, not a menu problem.',
                                             'push it hard for a few weeks. The margin is there, it just needs eyes, so feature it, name it on the specials, or have servers mention it.',
                                             'move it up the menu and have the floor talk it up. The plate earns when it sells, so the only job is getting people to try it.',
                                             'feature it and see what happens. A {noun} this profitable that nobody orders is usually a placement problem, not a recipe one.'], 4);
    else if (quad === 'PLOWHORSE') move = pick(['it is at target on price, so trim the plate cost instead of raising the menu price. Start with the portion or the priciest ingredient, since a few cents times this many covers adds up fast.',
                                                'the price is fine, so the lever is cost. Shave it out of the {noun} through portioning or a cheaper spec on the biggest cost line, and the volume does the rest.',
                                                'hold the price and hunt cost in the recipe. It moves enough that even a small margin gain per {noun} turns into real money at this count.',
                                                'leave the price and tighten the plate. At this volume, a dime saved on the recipe beats a quarter added to the price that scares covers off.',
                                                'work the cost, not the price. Portion control or a smarter spec on the heaviest ingredient buys margin without touching what guests pay.',
                                                'do not raise it, cut cost into it. This many covers means small recipe savings stack up, so start with the priciest line and the portion.'], 4);

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

  // The one button a tile carries, matched to its move.
  actionFor(item, quad) {
    const cost = App.menuItemCost(item) || 0;
    const sugg = (item.price > 0 && cost > 0) ? S.RevenueMenuEngineering.suggested(item, cost) : null;
    if (sugg) return { act: 'reprice', label: 'Reprice' };
    if (quad === 'DOG') return { act: 'dogtest', label: 'Dog Test' };
    return { act: 'edit', label: 'Edit Item' };
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
          { title: 'Build your menu', desc: 'Add and price your menu items in Menu Builder. Each one gets its own briefing here, and it sharpens as units sold and price history come in.', btn: 'Go to Menu Builder', screen: 'r-menu-items', done: false }
        ]
      });
      return;
    }

    const classMap = S.RevenueMenuEngineering.classify();
    const catStats = this.categoryStats();

    // Grouped by the shared comparison basis, so a section on this page is the same pack the
    // Star/Dog verdict inside it was decided against. Cocktails are ONE section here for that
    // reason, however many sections the drink menu is laid out in.
    const byCat = {};
    items.forEach(i => { const c = App.menuGroupKey(i); (byCat[c] = byCat[c] || []).push(i); });
    // Rank off the key's CATEGORY half. Computed once — this runs inside a sort.
    // ⚠ The cocktail pool has no category half, so its position is the FIRST cocktail section in
    // the operator's own order. It used to hardcode the string 'Cocktails', which is a builtin
    // they are free to remove — an operator who calls their section "Signature Drinks" sent every
    // drink on the menu to rank 900, below Snacks, under a heading they had deleted.
    const order = this.sectionOrder();
    const lc = s => String(s == null ? '' : s).toLowerCase();
    const names = order.map(o => lc(o.name));
    // The pool sits at the operator's FIRST COCKTAIL section — found by type, not by name, so a
    // section name shared with the dish list cannot claim the slot. If they have hidden every
    // cocktail section, the drinks go to the end of the known sections rather than to 900, which
    // is reserved for a section nobody's list contains.
    let poolRank = order.findIndex(o => o.type === 'cocktail');
    if (poolRank < 0) poolRank = order.length;
    const secRank = k => {
      const bar = String(k).indexOf('|');
      if (bar < 0) return poolRank;
      const idx = names.indexOf(lc(String(k).slice(bar + 1)));
      return idx === -1 ? 900 : idx;
    };
    const allKeys = Object.keys(byCat);
    const label = k => App.menuGroupLabel(k, allKeys);
    const cats = allKeys.sort((a, b) => (secRank(a) - secRank(b)) || label(a).localeCompare(label(b)));

    const counts = { STAR: 0, PUZZLE: 0, PLOWHORSE: 0, DOG: 0 };
    items.forEach(i => { const q = classMap[i.id]; if (q) counts[q]++; });
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statStrip = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('Items', items.length) + stat('Stars', counts.STAR) + stat('Puzzles', counts.PUZZLE)
      + stat('Plowhorses', counts.PLOWHORSE) + stat('Dogs', counts.DOG)
      + '</div></div>';

    const sCell = (label, val, color) => '<div class="mp-stat"><span class="mp-stat-lbl">' + label + '</span><span class="mp-stat-val"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</span></div>';

    const usedHumor = new Set();
    // `gk` is the GROUP KEY. It is never rendered — every display path below uses secLabel.
    const sections = cats.map(gk => {
      const cs = catStats[gk];
      const secLabel = label(gk);
      const list = byCat[gk].slice().sort((a, b) => {
        const d = this.actionRank(a, classMap[a.id]) - this.actionRank(b, classMap[b.id]);
        return d || (b.weekly_covers || 0) - (a.weekly_covers || 0) || (a.name || '').localeCompare(b.name || '');
      });
      const tiles = list.map(i => {
        const quad = classMap[i.id];
        const b = this.briefing(i, secLabel, cs, quad, usedHumor);
        const body = b.lines.map(p => '<p>' + esc(p) + '</p>').join('');
        const cost = App.menuItemCost(i) || 0;
        const price = i.price || 0;
        const pct = (price > 0 && cost > 0) ? cost / price * 100 : null;
        const mix = (cs.totalCovers > 0 && i.weekly_covers > 0) ? i.weekly_covers / cs.totalCovers * 100 : null;
        const stats = '<div class="mp-stats">'
          + sCell('Cost', cost > 0 ? App.fmtCurrency(cost) : '&mdash;')
          + sCell('Cost %', pct != null ? pct.toFixed(0) + '%' : '&mdash;', this.costPctColor(pct, S.RevenueMenuEngineering.targetPctFor(i)))
          + sCell('Menu Price', price > 0 ? App.fmtCurrency(price) : '&mdash;')
          + sCell('Menu Mix', mix != null ? mix.toFixed(0) + '%' : '&mdash;')
          + '</div>';
        const a = this.actionFor(i, quad);
        const moveBand = b.move
          ? '<div class="mp-move"><div class="mp-move-txt"><span class="mp-move-lbl">Move:</span> ' + esc(b.move) + '</div>'
            + '<span class="mp-act" role="button" tabindex="0" data-id="' + esc(i.id) + '" data-act="' + a.act + '">+ ' + a.label + '</span></div>'
          : '';
        return '<div class="mp-tile">'
          + '<div class="mp-name">' + esc(i.name || 'Unnamed') + '</div>'
          + stats
          + '<div class="mp-brief">' + body + '</div>' + moveBand
          + '</div>';
      }).join('');
      return '<div class="sh" style="margin:22px 0 10px;">' + esc(secLabel) + '</div><div class="mp-grid">' + tiles + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">' + statStrip + sections + '</div>';

    /* ⚠ ONE ACTION, TWO EVENTS (M3). `.mp-act` is the ONLY `role="button"` in the app — nearly every
       other control is a real <button>, which the browser activates on Enter and Space for free (the
       one other custom control, `bottle-slider`'s `<div tabindex="0">`, wires its own keys). A span
       does not, so a control that announces itself as a button and takes Tab focus did nothing on
       either key. It is also the ONLY interactive control on this page, which is what made it a
       dead end rather than an inconvenience. Space is preventDefault'd or the page scrolls under it.
       ⚠ Kyle's call still open: a real <button> with the link styling reset is the stronger answer
       and it is a style.css change, so it is not folded in here. */
    const fire = (btn) => {
      const id = btn.dataset.id, a = btn.dataset.act;
      if (a === 'reprice') { App._menuRepricePreselect = id; App.navigate('r-menu-engineering'); }
      else if (a === 'dogtest') { App._dogTestPreselect = id; App.navigate('r-dog-test'); }
      else { App._menuItemFocus = id; App.navigate('r-menu-items'); }
    };
    this.container.querySelectorAll('.mp-act').forEach(btn => {
      btn.addEventListener('click', () => fire(btn));
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(btn); }
      });
    });
  },

  showHowTo() {
    App.showHelpModal('How Menu Rundown Works', [
      { p: ['Menu Rundown gives Bar Cop\'s read on every item on your menu, built from the numbers instead of from what you happen to like eating. Independents get attached to their own recipes, and this page is the honest second opinion: what is working, what is not, and the move that follows.'] },
      { h: 'Built From Your Data', p: ['Every briefing is written from that item\'s own figures: its margin against the rest of its group, where it ranks in that group, its units-sold trend since your last read, its cost percent against target, the single biggest cost in the recipe, and the move that fits. Only your actual worst Dog is called the worst, because Bar Cop ranks them. It sharpens on its own as units sold and price history pile up.'] },
      { h: 'What Each Item Is Compared Against', p: ['Dishes and No Prep items are read against the others in their own section, because an appetizer is not an entree and a six dollar beer is not a sixty dollar bottle of wine. Every cocktail is read against every other cocktail, whichever section you file it under, because a frozen margarita and a house old fashioned earn their money the same way. That is why your drinks show up here under one Cocktails heading even if your menu lays them out as Happy Hour, Frozen and Specials. It also means you can rearrange your drink menu without changing a single ranking.'] },
      { h: 'The Numbers Up Top', p: ['Each tile leads with cost, cost percent, menu price, and menu mix, that item\'s share of the units sold in the group it is read against. The cost percent is colored by where it lands, red when it is over your target, amber when it is close, green when it is comfortably under.'] },
      { h: 'Read, Then Act', p: ['Items are grouped the way they are compared, the ones that need a decision first. Each tile ends with the move and a button that takes you straight to it: Reprice opens the change in Menu Engineering, Dog Test opens the 90-day test, and Edit Item opens Menu Builder. Make the change and the read updates next time you land here.'] }
    ]);
  }
};
