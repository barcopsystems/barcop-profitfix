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
      /* ⚠⚠ THE BANDS NAME THEIR BASIS INSTEAD OF IMPLYING A POSITION, and that is what makes them
         honest across two pools. `hi` is the verdict's side, measured over `classify()`'s pool; the
         RANK beside it is measured over the wider set the operator can SEE. Those differ (an uncosted
         item shows a Menu Mix but is not ranked; an item with no units-sold figure shows a margin but
         is not in the verdict's pool), so a vague position claim built from `hi` could invert against
         the column: "one of the busier sellers at 40 a week" printed on a tile reading Menu Mix 6%
         beside tiles reading 46% and 31%. "An above-average seller" is TRUE BY CONSTRUCTION — it says
         exactly what `hi` means — and nothing on screen can contradict it. The superlatives below keep
         their position claims because they are separately gated on being the real extreme. */
      up: ['an above-average margin', 'a margin above the group average', 'a better-than-average margin'],
      low: ['a below-average margin', 'a margin below the group average', 'a thinner-than-average margin']
    } : {
      best: ['the top seller', 'your busiest of them', 'the volume leader'],
      worst: ['the slowest mover', 'the least-ordered of them', 'the volume laggard'],
      best2: ['the second-best seller', 'the second-busiest of them'],
      worst2: ['the second-slowest mover', 'the second-least-ordered'],
      up: ['an above-average seller', 'a better-than-average mover', 'a seller above the group average'],
      low: ['a below-average seller', 'a slower-than-average mover', 'a seller below the group average']
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
      /* ⚠⚠⚠ THREE POOLS, AND WHICH ONE A CLAIM IS MEASURED OVER IS THE DEFECT THAT KEEPS COMING BACK
         HERE. Rewritten wholesale after round 3, because the notes that used to sit in this spot
         described the pools as they were two fixes ago and had gone BACKWARDS — and a comment that
         states the wrong model is worse than none, since the next reader trusts it ([[the-loop]] #53).
         The rule, once, plainly: A CLAIM IS MEASURED OVER THE SET THE OPERATOR CAN SEE IT AGAINST.
           `priced`     price and cost both known. Every one renders a tile showing Cost and Menu
                        Price, so this is the set a MARGIN claim is checked against.
           `coversPool` covers known, costed or not. Every one renders a MENU MIX, so this is the set
                        a VOLUME claim is checked against — an uncosted item still shows its share.
           `counted`    priced AND covers known. This is exactly `classify()`'s pool, so it is what
                        decides whether the section can be RANKED at all, and nothing else.
         The two earlier attempts both failed by mixing them: ranking margins over the covers set let
         "the weakest margin of the bunch at $2.00" print beside a visible tile reading $1.00, and
         ranking covers over the costed set let a 90-a-week tile claim "the volume leader" under an
         11% Menu Mix beside a 63% one. ⚠ A real PMIX zero belongs in `coversPool`: r-menu-engineering
         says a zero-seller is exactly what the Dog Test exists to surface, and excluding it let a
         20-a-week item call itself the least-ordered beside a sibling that sold nothing. */
      const counted = priced.filter(x => x.i.weekly_covers != null && x.i.weekly_covers >= 0);
      const coversPool = list.filter(x => x.i.weekly_covers != null && x.i.weekly_covers >= 0);
      const mRank = {}, cRank = {};
      priced.slice().sort((a, b) => (b.i.price - b.cost) - (a.i.price - a.cost)).forEach((x, idx) => { mRank[x.i.id] = idx + 1; });
      coversPool.slice().sort((a, b) => (b.i.weekly_covers || 0) - (a.i.weekly_covers || 0)).forEach((x, idx) => { cRank[x.i.id] = idx + 1; });
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
      // Each axis ties over the pool its claim is checked against, per the rule above. `atMin` is what
      // lets the Dog tail claim a bottom only when the item really is one.
      const mMap = tieMap(priced, x => x.i.price - x.cost);
      const cMap = tieMap(coversPool, x => x.i.weekly_covers || 0);
      const mTied = mMap.tied, cTied = cMap.tied, mAtMin = mMap.atMin, cAtMin = cMap.atMin;
      stats[cat] = {
        n: priced.length,
        /* ⚠ NO `avgMargin` / `avgCovers` HERE, DELIBERATELY (S289). Both were computed and read
           nowhere, and they were not merely dead — they were the WRONG means: taken over these
           pools, not over classify()'s. The next person reaching for "the group average" to write a
           sentence would have got a number the verdict was never measured against, which is exactly
           the two-means drift that caused M1. If a mean is ever needed here, take it from the
           verdict's own pool or read the side off the quad ([[the-loop]] #54). */
        totalCovers: byCat[cat].reduce((s, i) => s + Math.max(0, i.weekly_covers || 0), 0),
        /* ⚠⚠ THE SAME GATE THE VERDICT USES (S297/S309). This was `rankable.length >= 4` — items
           with covers ABOVE zero — while `classify()` ranks over every MEASURED item (priced, costed,
           covers known, zeros included) at `MIN_PER_CAT`. A stricter gate here meant a section could
           carry real verdicts that this page refused to say out loud: the tile still printed the
           verdict's MOVE and its button, so a Dog got a Dog Test button and was never called a Dog,
           and a Star got "feature it. Give it a power spot" with no Star named. `counted` is exactly
           classify's pool, so the two cannot disagree, and the threshold is READ from the classifier
           rather than the literal 4 that used to sit here and drift silently. */
        /* ⚠ AND THE SEPARABILITY GATE, because classify() now carries it too (S298/S303) and this
           value's whole job is to not disagree with classify(). A pool where every item holds the
           same margin, or where nothing has sold, reaches no verdict — so this page must not
           promise one either. */
        ranked: counted.length >= (S.RevenueMenuEngineering.MIN_PER_CAT || 4)
          && App.menuPoolSeparable(counted.map(x => ({ price: x.i.price, cost: x.cost, weekly_covers: x.i.weekly_covers }))),
        /* ⚠ WHY IT IS UNRANKED, NOT JUST THAT IT IS (S309's lesson, applied in the same edit that
           creates the second reason). The "not enough to rank" copy names a COUNT, and it would be
           simply false for a section of four items that are all identical. Two reasons, two
           sentences, and the branch below reads this rather than guessing from the count. */
        notSeparable: counted.length >= (S.RevenueMenuEngineering.MIN_PER_CAT || 4)
          && !App.menuPoolSeparable(counted.map(x => ({ price: x.i.price, cost: x.cost, weekly_covers: x.i.weekly_covers }))),
        // Which axis carries no information, so the sentence can say the true one.
        flatCovers: !(new Set(counted.map(x => Number(x.i.weekly_covers) || 0)).size > 1),
        // The count that actually gates ranking. `n` below is the PRICED count and means something
        // else; quoting it in the "cannot rank yet" copy is what S309 was.
        rankN: counted.length,
        // The pool size PER AXIS, because the two ranks are measured over different sets. One shared
        // `n` is what let a margin rank be tested against the covers pool's size.
        mN: priced.length, cN: coversPool.length,
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
    // ⚠ DECLARED HERE, not beside the trend block below, because the READ line now reads it too
    // (S304) and a `const` used above its declaration is a TDZ throw, not a syntax error —
    // `node --check` passes on it and only running the function finds it ([[the-loop]] #72).
    const prev = item.prev_weekly_covers;
    const noun = this.nounFor(item);
    const catLc = this._catPhrase(cat);

    /* ⚠⚠ BOTH OF THESE KEEP THEIR BUTTON (I10). `moveBand` renders only when `move` is non-empty, so
       returning '' here left a tile whose own copy says "Price it in Menu Builder" with no way to
       get to Menu Builder — on the page whose help promises "a button that takes you straight to
       it", in the DAY-ONE state after any import (a menu file with no price column produces a whole
       page of them). The loss guard directly below already carries this fix, with a comment naming
       I10; these two were the pair still open. */
    if (!(price > 0)) return { lines: ['No price on this one yet. Price it in Menu Builder and Bar Cop can start reading it.'],
      move: 'open it in Menu Builder and put a menu price on it. Every other read on this tile waits on that one number.' };
    if (!(cost > 0)) return { lines: ['No cost yet, so there is no margin to read. Attach a recipe or enter a cost in Menu Builder and this fills in.'],
      move: 'open it in Menu Builder and give it a cost, either by building the recipe or typing a flat figure. Until it has one there is no margin to read.' };
    /* ⚠⚠ A LOSS IS NOT A MARGIN, AND EVERY READ BELOW ASSUMES IT IS. Nothing guarded `cost >= price`,
       and a group whose mean margin is negative makes an above-mean LOSS a Puzzle — so the page
       printed "Good money at $-10.00 a plate", "The best margin of the bunch at $-3.00" and
       "It clears $-1.00 a plate", in gold. Reachable from a mis-entered recipe (a unit slip on one
       ingredient) or a cost sheet imported without a price column. Same class as I9, which was the
       identical lie on Pre-Shift, so it gets the same answer: say what the numbers are and refuse to
       grade them. `!(margin > 0)` covers price === cost too, where there is equally nothing to read. */
    if (!(price - cost > 0)) return { lines: ['At ' + f(price) + ' with ' + f(cost)
      + ' of cost in it, this one is not making anything. Every read below needs a margin to work '
      + 'from, so the rest of the tile stays blank until the price or the cost moves.'],
      // ⚠ AND IT KEEPS ITS BUTTON. `moveBand` renders only when `move` is non-empty, so returning ''
      // here left a tile that says "check it in Menu Builder" with no way to get to Menu Builder —
      // the exact dead end I10 was fixed for, reintroduced by a guard I added the same day.
      move: 'open it in Menu Builder and fix whichever of the two is wrong. A cost above the price is '
        + 'almost always a unit slip on one ingredient or a price that never got entered.' };

    const margin = price - cost;
    const costPct = cost / price * 100;
    const target = S.RevenueMenuEngineering.targetPctFor(item);
    const sugg = S.RevenueMenuEngineering.suggested(item, cost);
    const drv = this.topCostIngredient(item);
    const seed = this._seed(item.id);
    // ⚠ ONE n PER AXIS. `rn` used to serve both, so a margin rank taken over the priced pool was
    // tested against the ranked pool's size and `rank === n` stopped meaning "the bottom".
    const m = cs.mRank[item.id], c = cs.cRank[item.id], mN = cs.mN, cN = cs.cN;
    /* ⚠ THE VERDICT'S OWN SIDE, read straight off the quad rather than recomputed from a mean here.
       This is the definition classify() ranks by (hiM && hiV = Star, !hiM && hiV = Plowhorse,
       hiM && !hiV = Puzzle, neither = Dog), so the rank word beside the verdict cannot disagree
       with it. `null` when nothing was ranked: with no verdict there is no side to take. */
    const hiM = quad ? (quad === 'STAR' || quad === 'PUZZLE') : null;
    const hiV = quad ? (quad === 'STAR' || quad === 'PLOWHORSE') : null;
    // ⚠ `covers > 0`, not truthy. A legacy negative cover count flipped the sign and the move read
    // "take it up to $18.75, about $-43.75 more a week if covers hold" — a loss offered as upside.
    // The read line already refuses a negative count; the move has to refuse it too.
    const dwk = (sugg && covers > 0) ? (sugg - price) * covers : 0;

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
    /* ⚠⚠ AND THE TIE READ NEEDS BOTH AXES AT THE BOTTOM, not a tie on either one. My first version
       fired it on `(mAtMin && mTied) || (cAtMin && cTied)`, so a COVERS tie printed a MARGIN claim:
       "paired with a bottom-tier seller at 5 a week. It sits level with the weakest in the group, so
       there is nobody behind it" — on an item with two thinner margins in the same section. "Nobody
       behind it" is a claim about the whole group, so it takes the whole group's bottom. */
    const mMin = !!cs.mAtMin[item.id], cMin = !!cs.cAtMin[item.id];
    const mTie = !!cs.mTied[item.id], cTie = !!cs.cTied[item.id];
    const bothMin = mMin && cMin;
    const mBottom = mMin && !mTie;
    const cBottom = cMin && !cTie;
    const tiedLow = bothMin && (mTie || cTie);
    const dogBucket = (mBottom && cBottom)
      ? ['It is the one dragging the section hardest.', 'It is the anchor on this section, plain and simple.', 'Nothing here earns and moves less.']
      : (mBottom || cBottom)
        ? ['On one measure it is the very bottom of your ' + catLc + '.', 'It hits rock bottom on one of the two here.', 'One of its two numbers is dead last in the group.']
        /* ⚠ ONLY THE CLAIM THAT SURVIVES A SPLIT TIE. `tiedLow` means at the minimum on both axes with
           a tie somewhere — but the item it ties with on MARGIN can be a different item from the one
           it ties with on COVERS, and then "level with the weakest, nothing to separate them" is false
           twice over: the margin twin outsells it, the covers twin out-earns it, and both are doing
           better than it on the other measure. Measured: a Dog printed "It ties with the others at the
           bottom here, and none of them are earning the spot" while its two partners were a Plowhorse
           and a Puzzle. Only "nobody behind it" is true of a both-axis minimum however the ties pair
           up, so that is the one left standing. */
        : tiedLow
          ? ['It sits level with the weakest in the group, so there is nobody behind it.', 'Nothing in this section is behind it on either measure, and it is level with the bottom on one.', 'It is down at the bottom on both counts, level rather than alone.']
          : ['Others trail it, but it still is not paying for its spot.', 'Not the worst of the bunch, but it is not earning its place.', 'A few trail it, yet it is still not carrying its spot on the menu.'];

    const V = {
      /* ⚠ `n` IS THE COUNT THAT GATES RANKING, and it must only ever be used by the "not enough to
         rank yet" branch, which is the one place it is true. It used to be the PRICED count while
         the gate ran on a different set — so a section held back by one item with no units-sold
         figure printed "Only 4 priced items" and then refused to rank the 4 (S309). It also used to
         appear in the ranked READ lines next to a superlative measured over a smaller pool: "the
         strongest margin of your 12 cocktails" on a page where seven other cocktail tiles showed a
         fatter margin, because only 5 of the 12 had covers. */
      /* ⚠ ROUNDED FOR DISPLAY, BUT NEVER DOWN TO ZERO. Units sold is a COUNT, and two doors write it
         unrounded (Menu Builder's Units Sold field via `parseFloat`, and its CSV import), so a stray
         decimal printed "an average mover at 12.004 a week". ⚠⚠ My first version was a bare
         `Math.round`, which traded that for something worse: `weekly_covers: 0.4` passes the
         `covers > 0` gate, so the volume read RUNS and then displayed "the slowest mover at 0 a week"
         — a zero printed inside the branch that exists because covers are non-zero. A sub-1 value is
         shown as it is; rounding only applies where there is a whole count to round. The real cure is
         refusing a fractional count at both write doors (S295). */
      margin: f(margin), covers: covers >= 1 ? Math.round(covers) : covers,
      prevc: prev >= 1 ? Math.round(prev) : prev,   // same display rule as `covers`
      noun: noun, cat: catLc, n: cs.rankN, s: cs.rankN === 1 ? '' : 's',
      pct: costPct.toFixed(0), target: target, sugg: f(sugg || 0),
      name: drv ? drv.name : '', dcost: drv ? f(drv.cost) : '',
      // Bare reads of mTied/cTied on purpose: they are required for correctness, and guarding them
      // would silently go back to spending a superlative on a tie ([[the-loop]] #40).
      mword: this._rankWord(m, mN, 'margin', seed, hiM, !cs.mTied[item.id]),
      cword: this._rankWord(c, cN, 'covers', seed, hiV, !cs.cTied[item.id]),
      tail: dogBucket[seed % dogBucket.length],
      dwkc: dwk ? ', about ' + f(dwk) + ' more a week if covers hold' : ''
    };
    /* ⚠ `{Name}` EXISTS BECAUSE ONE TEMPLATE OPENS WITH IT (S305). `topCostIngredient` falls back to
       the lower-case literal 'an ingredient' for a row with no resolvable product, and the
       cost-driver pool's second template starts with `{name}` — so an unnamed ingredient printed
       "an ingredient is the biggest single cost, $3.00 a plate." mid-page, sentence-initial and
       lower case. Same treatment `{Mword}`/`{Cword}` already get, for the same reason. */
    V.Mword = this._cap(V.mword); V.Cword = this._cap(V.cword); V.Name = this._cap(V.name);
    const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => (V[k] != null ? String(V[k]) : ''));
    const pick = (arr, salt) => fill(arr[(seed + (salt || 0)) % arr.length]);

    const lines = [];

    // ── Read line ─────────────────────────────────────────────────────────
    /* ⚠ `m && c` IS NOT BELT-AND-BRACES (S288). A priced item with NO covers is still in the
       verdict's pool, so it has a quad, and `cs.ranked` is a fact about the SECTION — so a
       never-sold item took this branch, where every template quotes a volume it does not have.
       Real output: "A Puzzle. Its margin at $180.00 a drink, but its volume at 0 a week." The
       correct sentence for it was already written two branches down and was unreachable.
       ⚠ The test was `m && c` — "does it hold a rank" — which worked only while a zero-cover item
       was excluded from the covers RANKING. Now that a real zero IS ranked (so nobody can claim to
       be the least-ordered while it sits there selling nothing), the gate has to say what it always
       meant: does this item have a volume worth reading. Two jobs that happened to coincide. */
    if (quad && cs.ranked && covers > 0) {
      const READ = {
        // ⚠ NO SECOND LOCATOR IN THESE TEMPLATES. Four of the six _rankWord pools already end in
        // one ("the best margin of the bunch", "your busiest of them"), so "{mword} in the group"
        // printed "the best margin of the bunch in the group" on roughly two tiles in three.
        STAR: ['A Star. It carries {mword} at {margin} a {noun}, and it is {cword} at {covers} a week. Both sides working.',
               'A Star, and it earns the badge: {mword} at {margin} a {noun}, {cword} at {covers} a week.',
               'This one is a Star. {Mword} at {margin} a {noun} and {cword} at {covers} a week. It is doing everything you want.',
               'A Star. Strong on both counts: {mword} at {margin} a {noun} and {cword} at {covers} a week.'],
        PLOWHORSE: ['A Plowhorse. {Cword} at {covers} a week, but it runs {mword} at {margin} a {noun}. The volume is propping up a thin {noun}.',
                    // ⚠ `a {noun}` — this was the one margin mention in the file that ended bare, so it
                    // printed "it runs a bottom-tier margin at $16.00." with no unit on the money.
                    'A Plowhorse. It moves, {cword} at {covers} a week, but it runs {mword} at {margin} a {noun}.',
                    'This one is a Plowhorse. People order it, {cword} at {covers} a week, they just are not paying you much for it at {margin} a {noun}.',
                    'A Plowhorse. {Cword} at {covers} a week on {mword} at {margin} a {noun}. Busy, but thin.'],
        PUZZLE: ['A Puzzle. The margin is there, {mword} at {margin} a {noun}, but it is {cword} at {covers} a week. It pays when it sells, it just is not selling.',
                 'A Puzzle. {Mword} at {margin} a {noun}, yet only {cword} at {covers} a week. People are not reaching for it.',
                 // ⚠ `{noun}`, not "plate" (S305). `nounFor()` exists to keep this page from calling
                 // a bottled beer or an old fashioned a plate, and eight strings bypassed it.
                 'This one is a Puzzle. Good money at {margin} a {noun}, {mword}, but {cword} at {covers} a week. The {noun} earns, the menu is hiding it.',
                 'A Puzzle. {Mword} at {margin} a {noun}, but {cword} at {covers} a week. Solve the covers and it is a winner.'],
        DOG: ['A Dog. It runs {mword} at {margin} a {noun} and it is {cword} at {covers} a week. {tail}',
              'A Dog. {Mword} at {margin} a {noun}, and {cword} at {covers} a week. {tail}',
              'This one is a Dog. {Mword} at {margin} a {noun} paired with {cword} at {covers} a week. {tail}',
              'A Dog. Low on both: {mword} at {margin} a {noun} and {cword} at {covers} a week. {tail}']
      };
      lines.push(pick(READ[quad] || READ.DOG, 0));
    /* ⚠ THE DROP TO ZERO IS SAID FIRST, WHATEVER THE SECTION'S STATE (S304, second half). `!cs.ranked`
       used to be tested ahead of the covers branch, so in a section too small to rank, an item that
       sold 20 last read and NOTHING this one rendered "Only 3 items in entrees have a price, a cost
       and units sold..." and stopped — the trend block is gated on `covers > 0` too, so nothing
       anywhere on the tile mentioned that it had died. Whether the section can be ranked is a fact
       about the SECTION; this item stopping is a fact about the ITEM, and it is the more important
       of the two. */
    } else if (prev > 0 && covers === 0) {
      lines.push(pick(['It clears {margin} a {noun} when it sells, and it sold nothing this read against {prevc} the read before. That is the whole signal.',
                       'Margin is {margin} a {noun}, but it moved zero this read, down from {prevc}. Worth finding out why before it settles in.',
                       'It earns {margin} a {noun} on paper. Nothing sold this read against {prevc} last time, and that is a menu decision waiting to happen.'], 0));
    } else if (!cs.ranked) {
      /* ⚠ GATED ON THE SAME FACT THE RANKING IS (S309). This asked `cs.n < 4` — the PRICED count —
         while ranking needs a price, a cost AND a units-sold figure. So one item missing its units
         sold dropped the whole section out of the ranking while `cs.n` stayed at 4, this branch was
         skipped, and three healthy items silently lost every verdict with no sentence anywhere
         saying why. Asking `!cs.ranked` cannot drift from the gate because it IS the gate.
         ⚠ The copy says what is actually needed, not "priced": an item counts here only once it has
         all three numbers, which is the thing the operator has to go and fix.
         "item{s} in {cat}" rather than "{n} {cat}": the count and the section name were glued
         together, so a section with one item in it read "Only 1 priced desserts" — and an import
         with no category column read "Only 3 priced uncategorized". */
      /* ⚠⚠ TWO REASONS A SECTION CANNOT BE RANKED NOW, SO TWO SENTENCES (S298/S303, and S309's
         lesson applied in the same edit that creates the second reason rather than a round later).
         The copy below names a COUNT, and it is simply FALSE for a section of four items that all
         carry the same margin or where none of them has sold: there are plenty of items, and
         nothing separates them. Printing "only 4 items have all three numbers" there sends the
         operator off to fill in data that is already filled in. */
      lines.push(cs.notSeparable
        ? (cs.flatCovers
            ? pick(['Nothing in {cat} has sold yet, so there is no volume to rank it on. It clears {margin} a {noun}. Drop a product mix at the weekly close and the verdicts come with it.',
                    'Every item in {cat} is sitting at the same units sold, so there is no pack to place it in yet. For now it clears {margin} a {noun}.',
                    'No units sold anywhere in {cat} yet, and Bar Cop will not call this one a Star or a Dog on nothing. It clears {margin} a {noun}.'], 0)
            : pick(['Everything in {cat} runs the same margin, so there is nothing to separate them on and no honest verdict to give. It clears {margin} a {noun}.',
                    'The items in {cat} are too alike to rank against each other, so Bar Cop is not going to pick a winner between them. This one clears {margin} a {noun}.',
                    'Nothing separates the items in {cat} on margin, so a Star or a Dog here would be made up. It clears {margin} a {noun}.'], 0))
        : pick(['Only {n} item{s} in {cat} have a price, a cost and units sold, so there is no pack to rank it against yet. It clears {margin} a {noun}. A few more and this read sharpens.',
                'Just {n} item{s} in {cat} carry all three numbers, not enough to rank it fairly. For now it clears {margin} a {noun}.',
                'With only {n} complete item{s} in {cat}, Bar Cop cannot stack it against the group yet. It clears {margin} a {noun} in the meantime.'], 0));
    } else if (!(covers > 0)) {
      /* ⚠ `> 0`, NOT FALSY. A count that cannot legitimately be zero takes the strict test
         ([[the-loop]] #73). `!covers` let a legacy NEGATIVE through to the bare template below,
         which printed it raw: "It clears $9.00 a plate on -5 covers a week." The form and the
         importer both refuse a negative now, so only data already on file can be shaped that way —
         and this branch is what it lands in, which is also the honest read for it. */
      /* ⚠⚠ TWO DIFFERENT STATES WERE SHARING ONE SENTENCE (S304). "No covers on it yet" is true for
         an item that has never sold. It is FALSE for one that sold last read and sold NOTHING this
         one — and that item then got the covers-trend line underneath, so the tile read "Once covers
         come in at the weekly close, the volume side fills in." directly above "Units sold are down
         100% since your last read." Covers did come in. They went to zero, which is exactly what the
         Dog Test exists to surface, so it is worth saying out loud rather than describing as absent.
         The trend line is suppressed for this case below, because this sentence already carries it. */
      /* ⚠ `covers === 0`, NOT merely "not positive". A NEGATIVE count is corrupt legacy data, and
         saying "it moved zero this read" about it asserts a figure the record does not carry — the
         old code printed "-5 covers a week", and replacing that with a false zero is not an
         improvement. A negative falls to the never-sold copy, which claims nothing. */
      lines.push(prev > 0 && covers === 0
        ? pick(['It clears {margin} a {noun} when it sells, and it sold nothing this read against {prevc} the read before. That is the whole signal.',
                'Margin is {margin} a {noun}, but it moved zero this read, down from {prevc}. Worth finding out why before it settles in.',
                'It earns {margin} a {noun} on paper. Nothing sold this read against {prevc} last time, and that is a menu decision waiting to happen.'], 0)
        : pick(['It clears {margin} a {noun}, but no covers on it yet, so the volume read stays blank until you drop a product mix at the weekly close.',
                'Margin is {margin} a {noun}. No covers logged yet, so Bar Cop can read the {noun} but not the pull.',
                'It earns {margin} a {noun}. Once covers come in at the weekly close, the volume side fills in.'], 0));
    } else {
      lines.push(fill('It clears {margin} a {noun} on {covers} covers a week.'));
    }

    // ── Covers trend (prev read vs now) ───────────────────────────────────
    // ⚠ Not when it sold nothing: the read line above already states that in full, and printing
    // "down 100%" underneath it says the same thing twice (S304).
    if (prev != null && prev > 0 && covers > 0) {
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

    /* ── Cost line ─────────────────────────────────────────────────────────
       ⚠⚠ MEASURED AND DELIBERATELY NOT "FIXED" (S301). A round-2 finder reported that "A Star.
       Strong on both counts" prints directly above "Cost is running 63% against your 32% target, so
       the margin is the lever here", and called it a contradiction. It is not, and the reason is
       worth leaving here so the next round does not re-open it ([[the-loop]] #29/#57): write the two
       questions out and they are different sentences. The VERDICT asks "how does this item compare
       with the others in its group" — that is what Menu Engineering, the server audit and this page
       all rank on. The COST LINE asks "is this item at the cost target you set". A section can be
       entirely over target and still have a best and a worst inside it; both readings are true, and
       an operator needs both (the Star is still the one to feature, and its recipe is still the one
       leaking). Making them agree would mean either muting the verdict for a whole over-target
       section or dropping the target reading, and each throws away a real fact.
       ⚠ What WOULD be a defect is a verdict that reads as absolute when it is relative. The help
       text says the comparison is within the section, the rank words all name the group, and the
       cost line names the target explicitly. If Kyle ever wants the tile to lead with the target
       instead, that is a voice decision, not a correctness one. */
    if (target) {
      /* ⚠⚠ ONE THRESHOLD, NOT TWO. This asked `costPct > target + 0.5` while the MOVE below asks
         `suggested()`, which fires at `cost / (target/100) > price + 0.01` — a different test on the
         same question. Measured on a $10.00 plate at a 32% target, costs $3.21 through $3.25 land
         between them, and the tile then printed "Cost is a tidy 33% against your 32% target" (which
         contradicts itself in six words) directly above "walk it to $10.25". `sugg` IS the answer to
         "is this over target enough to act on", and inside this branch a null `sugg` can only mean
         at-or-under, so reading it makes the two agree by construction rather than by keeping two
         tolerances in step by hand ([[the-loop]] #54). */
      lines.push(sugg
        ? pick(['Cost is running {pct}% against your {target}% target, so the margin is the lever here, not the covers.',
                'At {pct}% cost against a {target}% target, the leak is on the {noun}, not the volume.',
                'Cost is {pct}% versus your {target}% target. Fix the {noun} before you chase covers.',
                'That {pct}% cost against a {target}% target is where the money is slipping. Tighten the recipe.'], 1)
        : pick(['Cost sits at {pct}% against your {target}% target, right where you want it.',
                'At {pct}% cost against a {target}% target, the margin is clean.',
                'Cost is {pct}% versus a {target}% target. No complaints there.',
                // "Plate cost" was the one that opened a sentence, so it loses the noun rather than
                // gaining a capitalised one — there is no {Noun} slot and inventing one for a single
                // string is worse than the plainer sentence.
                'Cost is a tidy {pct}% against your {target}% target.'], 1));
    } else {
      lines.push(fill('Cost runs {pct}% of the price.'));
    }

    // ── Cost driver ───────────────────────────────────────────────────────
    if (drv) lines.push(pick(['The heaviest cost in it is {name} at {dcost} a {noun}.',
                              // `{Name}` — this is the one template in the pool that OPENS with the
                              // ingredient name, so it takes the capitalised slot (S305).
                              '{Name} is the biggest single cost, {dcost} a {noun}.',
                              'Most of the cost is {name}, {dcost} a {noun}.',
                              'Your priciest line in it is {name}, {dcost} a {noun}.'], 2));

    // ── An occasional dry aside, woven onto the end of the read line (~1 in 4),
    // and never the same one twice across the page (page-wide `used` set keyed on
    // the raw template so the same joke can't repeat as a plate and a drink). ──
    /* ⚠ THE SAME GATE AS THE READ LINE, AND LEAVING IT OFF WAS A DELIBERATE MISTAKE OF MINE. When
       S288 added `covers > 0` above I judged this aside "apt anyway" for a never-sold item and moved
       on. It is not: the joke is keyed to the QUAD, and it is stapled onto `lines[0]` — which for a
       zero-cover item is the "no covers logged yet" sentence. Real output: "Margin is $6.00 a drink.
       No covers logged yet, so Bar Cop can read the plate but not the pull. The only thing it moves
       is the needle the wrong way." The aside contradicts the sentence it is glued to, and the word
       Dog appears nowhere on the tile. A verdict-keyed line belongs only where the verdict is read. */
    if (quad && cs.ranked && covers > 0 && (seed % 4 === 0) && lines.length) {
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
    /* ⚠⚠ TWO OF THESE SIX CLAIM VOLUME, AND THE REPRICE BRANCH RUNS BEFORE THE NO-COVERS ONE BELOW
       (S303, second half — my first pass missed it because I gated the quad branches and forgot this
       one sits above them). A reprice is sound advice with no units sold behind it: the item is over
       its cost target, and that is true whatever it sells. But "real money at this count" and "across
       this many covers it stacks up" are claims about traffic, and on a menu before its first product
       mix drop there is none. So the volume-flavoured pair is only offered once there are covers to
       flavour it with. Split explicitly rather than regex-filtered: which sentence claims volume is a
       fact about the COPY, and a filter over my own wording would go stale the day someone edits it. */
    const REPRICE_ANY = ['reprice to {sugg} to bring it back to target{dwkc}. Log it in Menu Engineering, roll it out on the next reprint, and watch covers hold after.',
                         '{sugg} is the to-target price{dwkc}. Most guests will not blink at a bump this size, but confirm the volume sticks before you count the win.',
                         'take it up to {sugg}{dwkc}. Put it on the next printed menu rather than mid-week, and keep an eye on covers for a couple weeks.',
                         'set it at {sugg}{dwkc}. Log the change so Recovery tracks it, then let the next menu print carry it in quietly.'];
    const REPRICE_WITH_VOLUME = ['walk it to {sugg}{dwkc}. Small move, real money at this count, just make sure the covers do not flinch once it lands.',
                                 'nudge it to {sugg}{dwkc}. A quarter here and there, but across this many covers it stacks up, so hold the line once it is on.'];
    if (sugg) move = pick(REPRICE_ANY.concat(covers > 0 ? REPRICE_WITH_VOLUME : []), 4);
    /* ⚠⚠ NO VOLUME ADVICE WITHOUT VOLUME (S303). `classify()` compares with `>=`, so in a section
       where NOTHING has sold `avgCovers` is 0 and `0 >= 0` makes every item high-volume — the whole
       section comes back Stars and Plowhorses. The verdict-keyed moves below then talk about traffic
       the item does not have: "a few cents times this many covers adds up fast", "every extra cover
       here is your best margin working harder", "This many covers means small recipe savings stack
       up". That is the day-one shape for any menu before the first product mix drop, so it is the
       first thing a new operator would read. The margin half is still real and still worth saying;
       the volume half is not, so the move says what would make the rest of the page true.
       ⚠ Placed AFTER the `sugg` branch on purpose: a reprice does not need volume to be right, and
       its weekly-dollar figure is already suppressed without covers. */
    /* ⚠ THE SAME SPLIT THE READ LINE GOT, because the move was still telling an item that sold
       nothing to go and drop the product mix it had already dropped. All four templates below assert
       ABSENCE ("so the volume side fills in", "what it does on the floor is still blank"), which is
       true of an item that has never sold and false of one that went 20 to 0 — for which the mix came
       back and the answer was zero. A fix that splits one branch and not its sibling is the
       half-migration shape ([[the-loop]] #42). */
    else if (!(covers > 0)) move = (prev > 0 && covers === 0)
      ? pick(['it sold nothing this read. Pull it for a week and watch, or put it on a 90-day Dog Test and make the call on data rather than on hope.',
              'a {noun} that stops selling has told you something. Give it one honest change or one Dog Test, and if it stays at zero, take the spot back.',
              'zero units is a decision, not a gap. Dog Test it, rework it once, or cut it and hand the space to something that moves.',
              'find out why it stopped before you touch the price. A {noun} at zero is either off the menu, out of stock, or off the floor\'s tongue.'], 4)
      : pick(['drop a product mix at the weekly close so the volume side fills in. Until it does, the only honest read here is the margin, and that clears {margin} a {noun}.',
              'get units sold in before you act on this one. The margin reads {margin} a {noun}; what it actually does on the floor is still blank.',
              'there is nothing to act on until it sells. Log a product mix at the weekly close and Bar Cop can tell you whether it is earning its spot.',
              'let it run a week and drop your product mix. The {noun} clears {margin}, but a verdict without units sold behind it is not worth acting on.'], 4);
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
                                           'showcase it and let it work. It carries the section, so the play is more eyes on it, not a single change to the {noun} or the price.',
                                           'put it where people look and keep it there. A Star like this wants attention, not adjustment, so resist the urge to tinker.'], 4);
    else if (quad === 'PUZZLE') move = pick(['get it seen. The {noun} already pays, so the whole problem is visibility, a feature, a special, a server callout, or a better spot. Give it a month of real push.',
                                             'put it in front of people. It sells itself once it is tried, so the fix is a sample, a callout, or a spot on the menu that actually gets read.',
                                             'give it a better spot or a callout. The money is fine and the exposure is not, so treat it as a marketing problem, not a menu problem.',
                                             'push it hard for a few weeks. The margin is there, it just needs eyes, so feature it, name it on the specials, or have servers mention it.',
                                             'move it up the menu and have the floor talk it up. The {noun} earns when it sells, so the only job is getting people to try it.',
                                             'feature it and see what happens. A {noun} this profitable that nobody orders is usually a placement problem, not a recipe one.'], 4);
    /* ⚠ "AT TARGET" IS ONLY TRUE IF THERE IS A TARGET (S302). `suggested()` returns null for two
       different reasons — the item is at/under target, and the item HAS NO TARGET — and this branch
       collapsed them into "it is at target on price". `App.menuTargetPct` returns null for every No
       Prep resale item (beer, wine, NA) unless the operator sets a per-item override, because they
       are markup-priced rather than costed to a percentage. Those items also have no recipe, so the
       portioning and ingredient-spec advice below is a dead end for them: the lever is the buy
       price. Split by the fact rather than papering over it. */
    /* ⚠⚠ RECIPE ADVICE ONLY WHERE THERE IS A RECIPE LINE TO ACT ON (S305). This split on `target`
       alone, so all six templates below — "start with the portion or the priciest ingredient",
       "a smarter spec on the biggest cost line", "hunt cost in the recipe" — printed on any item
       carrying a cost TARGET, including one whose cost is a single flat figure the operator typed.
       There is no cost-driver line on that tile to act on, so the advice points at nothing.
       `drv` IS the thing those sentences refer to (`topCostIngredient`, null when there is no
       recipe or nothing in it costs anything), so it is the discriminator rather than a proxy.
       ⚠ AND A RESALE ITEM IS SPLIT OFF BY ITS LINK, NOT BY ITS TARGET. `menuTargetPct` returns null
       for beer/wine/NA, which is what routed them to the buy-price advice — but that answer comes
       back the moment an operator sets a per-item override, and then a bottled beer was being told
       to tighten its recipe. The lever on a resale item is the case price whatever target it
       carries, so the test is the link. */
    else if (quad === 'PLOWHORSE') move = (target && drv)
      ? pick(['it is at target on price, so trim the {noun} cost instead of raising the menu price. Start with the portion or the priciest ingredient, since a few cents times this many covers adds up fast.',
              'the price is fine, so the lever is cost. Shave it out of the {noun} through portioning or a cheaper spec on the biggest cost line, and the volume does the rest.',
              'hold the price and hunt cost in the recipe. It moves enough that even a small margin gain per {noun} turns into real money at this count.',
              'leave the price and tighten the {noun}. At this volume, a dime saved on the recipe beats a quarter added to the price that scares covers off.',
              'work the cost, not the price. Portion control or a smarter spec on the heaviest ingredient buys margin without touching what guests pay.',
              'do not raise it, cut cost into it. This many covers means small recipe savings stack up, so start with the priciest line and the portion.'], 4)
      // A resale item: the case price is the lever whatever target it carries.
      : item.linked_product_id
        ? pick(['the lever here is what you pay for it, not what you charge. Push your vendor on the case price or compare a second supplier, because at this volume every cent back is real money.',
                // ⚠ NOT "there is no cost target on a resale item like this" — that was true only
                // while this branch was gated on a missing target, and it is gated on the LINK now,
                // so an item carrying an override would have been told a fact about itself that is
                // false. Markup pricing is the reason either way, so the reason is what it says.
                'work the buy price. A resale item like this is priced on markup rather than to a cost percent, so the margin comes from what it costs you, and at this count a small drop per unit adds up fast.',
                'the price is doing its job; the room is on the cost side. Get a quote from another distributor on this one, since volume like this makes a small unit saving worth chasing.',
                'shop this one. It moves well and earns thin, and with no recipe to tighten the only real lever is the case price you are paying.'], 4)
      /* A dish or a drink at a cost target whose cost is one typed figure. The lever really is the
         cost, and the honest first step is the thing that would let Bar Cop name where it goes. */
      : target
        ? pick(['the price is where you want it, so the money is in the cost, and this one carries a flat cost with nothing behind it. Build its recipe in Menu Builder and Bar Cop can show you which line is eating the margin.',
                'hold the price and go after the cost. Right now that cost is a single typed figure, so there is nothing to take apart. Build the recipe in Menu Builder and this tile will name the biggest line for you.',
                'the price is fine; the room is on the cost side. Build the recipe in Menu Builder so the cost comes off real ingredients, and at this volume even a few cents back per {noun} is real money.',
                'do not raise it. At this count the lever is what the {noun} costs you, and a flat typed cost hides where that goes. Build the recipe in Menu Builder and you will see it.'], 4)
        : pick(['the lever here is what you pay for it, not what you charge. Push your vendor on the case price or compare a second supplier, because at this volume every cent back is real money.',
                'work the buy price. There is no cost target on this one, so the margin comes from what it costs you, and at this count a small drop per unit adds up fast.',
                'the price is doing its job; the room is on the cost side. Get a quote from another supplier on this one, since volume like this makes a small unit saving worth chasing.',
                'shop this one. It moves well and earns thin, and with no recipe to tighten the only real lever is the price you are paying.'], 4);
    /* ⚠ NOBODY FALLS OFF THE END OF THIS CHAIN. Every branch above needs either a suggested price or
       a quad, so an item that is selling, on target, and sitting in a section too small to rank got
       NO move and therefore no button at all — `moveBand` renders only when `move` is non-empty. The
       page's own help promises "a button that takes you straight to it" on every tile, which is what
       I10 was fixed for; this was the last hole left in that promise. What such an item actually
       needs is the thing that would let it be ranked. */
    else move = pick(['nothing to chase on this one yet. Its cost is where you want it, and once {cat} has four items with a price, a cost and units sold, Bar Cop can rank it against the rest.',
                      'it is doing its job quietly. Round out {cat} with a few more complete items and this tile starts telling you where it really sits.',
                      'no move needed right now. Fill in the rest of {cat} and the comparison that makes this read useful comes with it.'], 4);

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
  /* ⚠⚠ DELEGATES, IT DOES NOT RE-DECIDE (S322). This rolled its own test order — suggestion
     FIRST, then Dog — while Menu Engineering asks planned → Dog → suggestion. So this tile offered
     "+ Reprice" on a DOG and on an item whose reprice was already planned, and both deep links
     landed on a screen with no Reprice button on that row: the click did nothing whatsoever.
     One rule, one place. `rowAction` returns 'marklive' | 'dogtest' | 'reprice' | 'none', and
     every one of those has a branch in `fire()` below. */
  actionFor(item, quad) {
    const act = S.RevenueMenuEngineering.rowAction(item, quad);
    if (act === 'reprice')  return { act: 'reprice',  label: 'Reprice' };
    if (act === 'marklive') return { act: 'marklive', label: 'Mark Live' };
    if (act === 'dogtest')  return { act: 'dogtest',  label: 'Dog Test' };
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
          // ⚠ NOT "and price history" (S306). This screen never reads `revenue_price_log` — its only
          // trend input is `prev_weekly_covers`. The how-to was corrected for exactly this claim and
          // the empty-state lead kept it, which is the copy a brand-new operator reads FIRST. A
          // stale promise sends them looking for a feature that is not there ([[help-model]]).
          { title: 'Build your menu', desc: 'Add and price your menu items in Menu Builder. Each one gets its own briefing here, and it sharpens as units sold come in each week.', btn: 'Go to Menu Builder', screen: 'r-menu-items', done: false }
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
      // A pending plan is taken live or cancelled on the board itself, so this lands the operator
      // there rather than opening a second reprice over the first (S322).
      else if (a === 'marklive') { App.navigate('r-menu-engineering'); }
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
      /* ⚠ THREE CLAIMS CORRECTED HERE (S306). "as units sold and price history pile up" was simply
         untrue: this screen never reads the price log, and its only trend input is the previous
         units-sold reading. "Only your actual worst Dog is called the worst" is now true again but
         had to be earned (S300a/b) — it is kept because it states the rule the ranking follows. A
         stale how-to is a bug ([[help-model]]), and the version that overstates what the page reads
         is the one that sends an operator looking for a feature. */
      { h: 'Built From Your Data', p: ['Every briefing is written from that item\'s own figures: its margin against the rest of its group, where it ranks in that group, its units-sold trend since your last read, its cost percent against target, the single biggest cost in the recipe, and the move that fits. Only an item that really is the bottom of its group is called the bottom, and one that ties with another is never called either. It sharpens on its own as units sold come in each week.'] },
      { h: 'What Each Item Is Compared Against', p: ['Dishes and No Prep items are read against the others in their own section, because an appetizer is not an entree and a six dollar beer is not a sixty dollar bottle of wine. Every cocktail is read against every other cocktail, whichever section you file it under, because a frozen margarita and a house old fashioned earn their money the same way. That is why your drinks show up here under one Mixed Drinks heading even if your menu lays them out as Cocktails, Shots and Frozen. It also means you can rearrange your drink menu without changing a single ranking.'] },
      { h: 'The Numbers Up Top', p: ['Each tile leads with cost, cost percent, menu price, and menu mix, that item\'s share of the units sold in the group it is read against. The cost percent is colored by where it lands, red when it is over your target, amber when it is close either side, green when it is comfortably under. Beer, wine and NA items carry no cost target, since they are priced on markup rather than to a percentage, so their cost percent is shown without a color.'] },
      { h: 'Read, Then Act', p: ['Items are grouped the way they are compared, the ones that need a decision first. Each tile ends with the move and a button that takes you straight to it: Reprice opens the change in Menu Engineering, Dog Test opens the 90-day test, and Edit Item opens Menu Builder. Make the change and the read updates next time you land here.'] }
    ]);
  }
};
