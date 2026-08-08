'use strict';

/* ── Revenue Recovery — Menu Engineering (the pricing engine) ──────────────────
   Per category it (1) DIAGNOSES every priced item into Stars / Plowhorses /
   Puzzles / Dogs by margin and popularity against its OWN category, and (2)
   PRESCRIBES the move with a number: a suggested price that brings the item back
   to its margin target (cost / target cost %), the weekly dollars that move with
   it if volume holds, and a quad-appropriate action.

   Repricing saves a PLANNED price first, because changing a number here is not
   the same as changing the real menu (a whole overhaul gets planned in the app,
   then printed and rolled out weeks later). Mark Live is the honest rollout
   moment: it updates the price and logs the change, so Recovery only ever tracks
   the real menu, never a plan on paper. Dogs route to the 90-day Dog Test. */

S.RevenueMenuEngineering = {
  QUAD: [
    { key: 'STAR',      label: 'Stars',      move: 'Feature & push' },
    { key: 'PLOWHORSE', label: 'Plowhorses', move: 'Raise the price' },
    { key: 'PUZZLE',    label: 'Puzzles',    move: 'Promote' },
    { key: 'DOG',       label: 'Dogs',       move: 'Rework or cut' }
  ],

  // A category needs at least this many priced items to rank fairly against itself.
  MIN_PER_CAT: 4,

  // Menu order for the per-category sections (same order Menu Items uses).
  // ⚠ THIS SORTS DISPLAY LABELS, so it must contain the POOLED group's label too. The drink pool
  // is labelled "Mixed Drinks" (App.menuGroupLabel's NOUN map) — without it here, indexOf returns
  // -1 and every drink on this screen sorted to the bottom, below Snacks. Cocktails / Shots /
  // Frozen are also listed because they are real section names a No Prep or dish list can use.
  CAT_ORDER: ['Appetizers', 'Entrees', 'Sides', 'Desserts', 'Specials',
              'Mixed Drinks', 'Cocktails', 'Shots', 'Frozen',
              'Beer', 'Wine', 'NA Beverages', 'Snacks'],

  // The item's margin target: its own override, else the category default. Null
  // for beverages / inventory items with no set target, so no price is suggested.
  // THE single cost-% target rule lives in App.menuTargetPct (override → plate/cocktail
  // by type → null for no-prep resale beverages). This is a thin alias so the reprice tool
  // and the "over target" count/Recipe Summary can never score against different targets.
  targetPctFor(item) { return App.menuTargetPct(item); },

  // Suggested price = the price that hits the target cost %. Only ever a RAISE
  // (Bar Cop never tells you to cut a price); null when at/under target or no target.
  /* ⚠⚠ THE ONE ROW-ACTION RULE (S322). 'marklive' | 'dogtest' | 'reprice' | 'none'.
     Menu Rundown offers one action per tile and deep-links to this screen. It used to decide with
     its own test order — SUGGESTION FIRST, then Dog — while this screen asks planned → Dog →
     suggestion. Both of the rules encoded here were therefore invisible over there:
       · a PLANNED price means a reprice is already pending, and it has to be taken live or
         cancelled before another is started, so the row shows Mark Live / Cancel;
       · a DOG is not a pricing problem, so it is routed to the Dog Test.
     Rundown offered "+ Reprice" on both shapes, the deep link found no `.me-reprice` button, and
     the click did NOTHING AT ALL — the page just loaded. Neither screen was wrong about its own
     row; they were answering one question with two rules, which is what a shared decider exists to
     prevent ([[the-loop]] step 0.6). Cost comes through `App.menuItemCost` so the answer is the
     LIVE cost on both screens (`_rankable` already maps the same thing, S111). */
  rowAction(item, quad) {
    if (!item) return 'none';
    if (item.planned_price > 0) return 'marklive';
    if (quad === 'DOG') return 'dogtest';
    return this.suggested(item, App.menuItemCost(item) || 0) ? 'reprice' : 'none';
  },

  suggested(item, cost) {
    const tgt = this.targetPctFor(item);
    if (!tgt || !(cost > 0) || !(item.price > 0)) return null;
    const exact = cost / (tgt / 100);                 // the precise to-target price
    if (exact <= item.price + 0.01) return null;      // at/under target → no raise
    return Math.ceil(exact * 4) / 4;                  // round UP to the nearest quarter (a real menu price)
  },

  // Canonical Star/Plowhorse/Puzzle/Dog map for every menu item, so Menu Planning
  // shows the exact class this page ranks by (same math as classificationHtml).
  // Returns { [id]: 'STAR'|'PLOWHORSE'|'PUZZLE'|'DOG'|null }; null = the item's
  // category has fewer than MIN_PER_CAT priced items, so it cannot be ranked yet.
  classify() {
    const items = this._rankable().filter(i => i.cost);
    const byCat = {};
    // Group by the COMPARISON BASIS, not the raw category: cocktails rank as one pool because
    // Frozen / Specials / Happy Hour are menu layout, not economics, while dishes and No Prep
    // still rank per category because an appetiser is not an entree. App.menuGroupKey is
    // mirrored on the server so the audit names the same Dogs (verify-menu-grouping-tieout).
    items.forEach(i => { const c = App.menuGroupKey(i); (byCat[c] = byCat[c] || []).push(i); });
    const map = {};
    Object.keys(byCat).forEach(cat => {
      const list = byCat[cat];
      // ⚠ A POOL THAT SEPARATES NOBODY IS UNRANKED, exactly as a too-small one is (S298/S303).
      // `>=` puts an item that sits ON the mean on the high side, so a flat axis makes EVERY item
      // high on it — nothing sold yet reads as a section of Stars and Plowhorses, and four
      // identical beers read as four Stars. Same answer, same null, already handled everywhere.
      if (list.length < this.MIN_PER_CAT || !App.menuPoolSeparable(list)) { list.forEach(i => { map[i.id] = null; }); return; }
      const avgCM = list.reduce((s, i) => s + (i.price - i.cost), 0) / list.length;
      const avgCovers = list.reduce((s, i) => s + i.weekly_covers, 0) / list.length;
      list.forEach(i => {
        const hiM = (i.price - i.cost) >= avgCM, hiV = i.weekly_covers >= avgCovers;
        map[i.id] = (hiM && hiV) ? 'STAR' : (!hiM && hiV) ? 'PLOWHORSE' : (hiM && !hiV) ? 'PUZZLE' : 'DOG';
      });
    });
    return map;
  },

  showHowTo() {
    App.showHelpModal('How Menu Engineering Works', [
      { p: ['Menu Engineering is your pricing engine. For every priced item it does two things: it sorts the item into Stars, Plowhorses, Puzzles, or Dogs against the other items in its own category, and it names the move plus the number behind it. It needs at least four complete items in a category to rank it; finish any Incomplete ones in Menu Builder.'] },
      { h: 'Ranked by Category', p: ['Each item is measured against its own category, not the whole menu, so entrees compete with entrees and beverages with beverages. Margins run very differently across categories, and a soda was never going to out-earn a steak, so pooling them would brand half your menu Dogs for no reason. A category needs at least four priced items to form a fair group; smaller ones sit under Too Few to Rank.'] },
      { h: 'Keeping Units Sold Current', p: ['Everything here runs on each item\'s weekly units sold, so the page is only as accurate as those numbers. Units sold refresh on their own when you drop your product mix report at the Shift weekly close, matched to each menu item by name. If you need to refresh them between closes, the Re-import Units Sold drop at the top of this page takes the same product mix export on demand. Keep them current and the classification, the suggested prices, and the pricing checks all stay honest.'] },
      { h: 'The Suggested Price', p: ['For any item running over its target cost percent, Bar Cop shows the price that brings it back to target, the item cost divided by your target cost percent, and the weekly dollars that move with it if volume holds. It only ever suggests a raise, never a cut. The Weekly Upside up top is what repricing every over-target item to target would add each week.'] },
      { h: 'The Move, Wired Up', p: ['Plowhorses and any over-target item get a Reprice step that prices to target and lets you adjust before you commit. Dogs go to a 90-day Dog Test, the rework-or-cut path. Stars and Puzzles carry their move, feature or promote, so you push them on the floor.'] },
      { h: 'Planned vs Live', p: ['A reprice saves as a Planned price first, because changing a number here is not the same as changing your real menu, you might be planning a whole overhaul. The item shows the plan next to your current live price. When the new prices actually roll out, hit Mark Live. That is the moment Bar Cop logs the change and starts tracking it, so Recovery always reflects your real menu, never a plan on paper.'] },
      { h: 'Repricing', p: ['The Reprice step models the new margin, cost percent, and weekly impact, and shows how far volume can fall before the raise stops paying off. Add an expected volume change if you want Bar Cop to hold you to a prediction. Save it as planned or mark it live on the spot.'] },
      { h: 'Pricing Review Log', p: ['Every change you make lands in the Pricing Review Log at the bottom, the one record of every price move. Once three weeks of units sold come in, Bar Cop checks the real weekly margin swing against what you predicted, so your pricing instincts sharpen over time. Pricing is tracked as a logged change with its date, not a recovered-dollar figure, because a raise only pays if volume holds; that is why the dashboard shows Pricing as a Review row rather than a dollar.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  /* ⚠⚠ THE ONE DEFINITION OF "AN ITEM THIS BOARD CAN RANK" (S221). Four sites wrote this predicate
     out by hand — the setup gate, the ranking, the classification and `_dogIds` — and this file's own
     comments already record one of them being missed when the comparison basis landed ("the THIRD
     grouping site and it was missed"). One helper, four callers.
     ⭐⭐ AND THE SEMANTIC FIX IT CARRIES: the hand-written filters tested `i.weekly_covers` as a
     TRUTHY value, which cannot tell **measured at zero** from **never measured**. The PMIX import
     writes a real 0 on purpose — buildPmix keeps it because "a zero-seller is exactly what the Dog
     Test exists to surface" — and then every one of these filters threw it away. Measured on a
     four-item category with Wings imported at 0 units: the board showed three items and **no sign
     that Wings had died**; with the zero included it ranks as a Puzzle, the single most actionable
     row on the page.
     `!= null` is the discriminator: an item the operator has never entered units for has no data and
     stays off; an item MEASURED at zero is data, and belongs on. Verified both ways.
     ⚠ THE COST, STATED HONESTLY: a zero pulls the category's average covers down (30.0 -> 22.5 in
     the measured fixture), and that CAN flip another item between high and low volume. Nothing else
     flipped in that fixture, but it can — Kyle approved the trade knowing it. */
  /* ⚠ BOTH HALVES ARE LOAD-BEARING AND NEITHER WORKS ALONE. `!= null` alone would admit a legacy
     NEGATIVE, which this file's own notes record as the worst case — it is truthy, drags the
     category average down and reclassifies other items (a Dog became a Plowhorse on -50). And
     `>= 0` alone would admit a never-measured item, because `null >= 0` is TRUE in JS. Both write
     doors now refuse a negative; this is the defensive read for anything already on file. */
  _measured(i) { return !!(i && i.price && !i.archived && i.weekly_covers != null && i.weekly_covers >= 0); },
  _rankable() {
    return (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 }))
      .filter(i => this._measured(i));
  },

  draw() {
    // New-user setup: Menu Engineering needs at least four fully-priced items
    // (price, cost, weekly covers) to rank. Until then, guide the operator to
    // Menu Items with the standard setup card instead of a bare empty state.
    const costed = this._rankable().filter(i => i.cost);
    if (costed.length < 4) {
      /* ⚠ DROP ANY PENDING IMPORT RESULT ON THE WAY OUT. coversImportHtml() is the only thing that
         clears `_coversFlash`, and it is never reached down this branch — so a result stored here
         sat on the screen object and fired LATER, out of context, presented as if it had just
         happened. Reachable: a PMIX where an item sold 0 units writes weekly_covers: 0, the gate
         above filters on a TRUTHY weekly_covers, and a small menu can drop under four and land here
         on the very redraw that follows the import.
         ⚠ THAT FILTER IS ITSELF A KNOWN GAP, NOT FIXED HERE: buildPmix deliberately keeps a real 0
         ("a zero-seller is exactly what the Dog Test exists to surface") and four sites on this
         screen then filter it out of the board, the Dog list and this gate. Fixing that changes what
         the board RANKS — a 0-unit item drags its category's average — so it needs its own pass. */
      this._coversFlash = null;
      /* ⚠ AND DROP THE DEEP-LINK FLAG ON THE WAY OUT TOO — the identical mechanism as the line above,
         one exit that had it and one that did not. Menu Rundown renders "+ Reprice" whenever
         `suggested()` fires, which needs only price, cost and a target, so a THREE-item costed menu
         shows the button while this screen cannot rank yet and returns here. Proven by running both
         screens: the click sets `_menuRepricePreselect`, this branch never reaches the consume at the
         bottom of draw(), and the flag survives — so when the operator later prices a fourth item and
         opens Menu Engineering from the nav, the reprice modal pops UNBIDDEN for an item they clicked
         on another screen minutes earlier. A new exit in a function with a consume convention is a
         leak until proven otherwise ([[the-loop]] #49). */
      App._menuRepricePreselect = null;
      App.setupCard(this.container, {
        title: 'Menu Engineering',
        lead: 'Menu Engineering sorts every priced item into Stars, Plowhorses, Puzzles, and Dogs, and names the move plus the number behind it. Price your menu items first.',
        steps: [
          { title: 'Add your menu items', desc: 'Price at least four items in a category with their cost and weekly units sold in Menu Builder. Menu Engineering ranks them here and shows the move for each.', btn: 'Go to Menu Builder', screen: 'r-menu-items', done: false }
        ]
      });
      return;
    }
    const priced = (App.data.menu_items || []).some(i => i.price && App.menuItemCost(i) && !i.archived);   // live cost, matching :53/:94/:194 (S111a)
    /* ⛔⛔⛔ THE CONFIRM SCREEN OWNS THE PAGE. The classification board below carries Reprice, Make
       Live and the batch apply, every one of which writes on the press — four inches under a sentence
       promising nothing is saved until a different press. Two opposite write models on one page, with
       the destructive one under the reassuring line, is the shape Kyle found on `ev-regulars`.
       ⚠ `_pmixReview` lives on the screen OBJECT, not in the DOM, so Remove, Put Back and a redraw
       cannot lose the operator's file. */
    if (this._pmixReview) {
      this.container.innerHTML = '<div class="screen">' + this.pmixReviewHTML() + '</div>';
      this._wirePmixReview();
      return;
    }
    this.container.innerHTML = '<div class="screen">' + (priced ? this.coversImportHtml() : '') + this.classificationHtml() + '</div>';
    const c = this.container;
    c.querySelectorAll('.me-reprice').forEach(b => b.addEventListener('click', () => this.openReprice(b.dataset.id)));
    c.querySelectorAll('.me-marklive').forEach(b => b.addEventListener('click', () => this.markLive(b.dataset.id)));
    c.querySelectorAll('.me-cancelplan').forEach(b => b.addEventListener('click', () => this.cancelPlanned(b.dataset.id)));
    c.querySelectorAll('.me-dogtest').forEach(b => b.addEventListener('click', () => { App._dogTestPreselect = b.dataset.id; App.navigate('r-dog-test'); }));
    document.getElementById('me-batch')?.addEventListener('click', () => this.openBatch());
    document.getElementById('me-marklive-all')?.addEventListener('click', () => this.markAllLive());
    document.getElementById('me-export')?.addEventListener('click', () => App.exportListPDF({ title: 'Menu Engineering', rootId: 'me-export-root', root: this.container, lists: [['core', 'revenue_price_log']], reRender: () => this.draw() }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.draw()));
    if (priced) this.mountCoversImport();
    // Deep-link from Menu Rundown: open the reprice modal for the passed item.
    if (App._menuRepricePreselect) {
      const rid = App._menuRepricePreselect;
      App._menuRepricePreselect = null;
      /* ⚠⚠ KEY ON THE ITEM, NOT ON A RENDERED BUTTON (S322). This tested `.me-reprice[data-id]`,
         which is a PROXY for the wrong fact twice over: `openReprice` needs only that the item
         exists (`if (!item) return;`), so an item that is genuinely repriceable but not on the
         visible board — a category under MIN_PER_CAT ranks as null and is not drawn — was dropped
         even though the modal would have worked perfectly ([[the-loop]] #62). And when the answer
         really is "no", the click used to do NOTHING, which is indistinguishable from the app
         being broken. Ask the shared rule, and say so when the answer changed. */
      const it = (App.data.menu_items || []).find(x => x.id === rid);
      const act = this.rowAction(it, this.classify()[rid] || null);
      if (act === 'reprice') this.openReprice(rid);
      else App.confirm({
        title: 'That item is not ready to reprice',
        message: !it ? 'The item has since been removed from your menu.'
          : act === 'marklive' ? 'This item already has a planned price waiting. Take it live or cancel it from the row below, then you can price it again.'
          : act === 'dogtest' ? 'This item ranks as a Dog, so Bar Cop routes it to a Dog Test rather than a price rise. Run the test from the row below.'
          : 'This item is already at or under its cost target, so there is no raise to suggest.',
        confirmText: 'OK', cancelText: ''
      });
    }
  },

  // ── Dishes that could not be costed, and what that cost the ranking ──────────
  // A dish with no usable cost is correctly left out of the Star/Plowhorse/Puzzle/Dog
  // math, but that exclusion used to be completely silent: the dish vanished off this
  // page, and if its absence dropped its category under MIN_PER_CAT then every OTHER
  // dish in that category quietly lost its class too. An operator who deleted one
  // inventory product saw three unrelated dishes fall off the board with nothing
  // linking the two events.
  // This says it out loud instead. It NAMES the dishes and NAMES the categories that
  // stopped ranking as a result, so there is something to act on. It changes no math.
  _uncostedNote(uncosted, byCat) {
    if (!uncosted || !uncosted.length) return '';
    // ⚠ TWO DIFFERENT REASONS A DISH IS UNCOSTED, AND ONLY ONE OF THEM IS "COST IT" (S110).
    // A dish whose ingredient or linked product was DELETED has no cost to type: an
    // inventory-linked item has no Cost field at all (ri-cost lives only in the plate/cocktail
    // form) and the save path refuses with "Linked product not found." Telling the operator to
    // cost it is a dead end — and DELETED is the word the Menu Builder already uses on that dish.
    const broken = uncosted.filter(i => App.menuItemMissingIngredients(i).length);
    const plain  = uncosted.filter(i => !App.menuItemMissingIngredients(i).length);
    const nm = arr => esc(arr.map(i => i.name).filter(Boolean).join(', '));
    const parts = [];
    if (plain.length) parts.push((plain.length === 1
      ? '1 menu item is not costed and cannot be ranked: '
      : plain.length + ' menu items are not costed and cannot be ranked: ') + nm(plain) + '.');
    if (broken.length) parts.push((broken.length === 1
      ? '1 menu item cannot be costed because an ingredient was deleted: '
      : broken.length + ' menu items cannot be costed because an ingredient was deleted: ')
      + nm(broken) + '. Replace or remove the missing ingredient.');
    const lead = parts.join(' ');
    // Categories below the ranking threshold, split by whether costing these would actually clear
    // it. `stuck` is the case the old copy lied about: it promised "cost it and it joins the
    // ranking" even when the category would STILL be short afterwards.
    const blocked = [], stuck = [];
    const byCatUncosted = {};
    // Key by the SAME comparison basis byCat uses. Keying this by the raw category while byCat
    // keyed by group meant `byCat[cat]` never matched, every category read as zero costed items,
    // and the shortfall printed one too many ("needs 3 more" when it needed 2).
    uncosted.forEach(i => { const c = App.menuGroupKey(i); byCatUncosted[c] = (byCatUncosted[c] || 0) + 1; });
    // These keys are GROUP KEYS ('plate|Entrees'). Everything pushed onto blocked/stuck is
    // operator-facing copy, so convert to the display label or the sentence reads
    // "plate|Desserts still needs 2 more costed dishes".
    const _allKeys = Object.keys(byCat || {}).concat(Object.keys(byCatUncosted));
    const _lbl = k => App.menuGroupLabel(k, _allKeys);
    Object.keys(byCatUncosted).forEach(cat => {
      const costedHere = ((byCat && byCat[cat]) || []).length;
      if (costedHere >= this.MIN_PER_CAT) return;   // already ranks; costing simply adds this dish
      if (costedHere + byCatUncosted[cat] >= this.MIN_PER_CAT) blocked.push(_lbl(cat));
      else stuck.push({ cat: _lbl(cat), need: this.MIN_PER_CAT - costedHere - byCatUncosted[cat] });
    });
    let why = '';
    if (blocked.length) {
      why = ' That also leaves ' + esc(blocked.join(', ')) + ' below the ' + this.MIN_PER_CAT
        + ' costed menu items Bar Cop needs before it can rank a category, so nothing in '
        + (blocked.length === 1 ? 'it' : 'them') + ' is ranked either. Cost '
        + (uncosted.length === 1 ? 'it' : 'them') + ' and the ranking comes back.';
    } else if (stuck.length) {
      why = ' ' + stuck.map(s => esc(s.cat) + ' still needs ' + s.need + ' more costed menu item'
        + (s.need === 1 ? '' : 's')).join(', ') + ' before Bar Cop can rank '
        + (stuck.length === 1 ? 'it' : 'them') + ', so fixing '
        + (uncosted.length === 1 ? 'this one' : 'these') + ' will not bring '
        + (uncosted.length === 1 ? 'it' : 'them') + ' into the ranking on its own.';
    } else if (plain.length) {
      why = ' Cost ' + (plain.length === 1 ? 'it' : 'them') + ' to bring '
        + (plain.length === 1 ? 'it' : 'them') + ' into the ranking.';
    }
    return '<div class="card" style="margin-top:14px;">'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;">'
      + '<span style="color:var(--gold);font-weight:700;">Not costed</span> &middot; ' + lead + why
      + '</div></div>';
  },

  // ── The page: diagnosis (quadrant) + prescription (suggested price + action) ─
  classificationHtml() {
    // Inject the effective cost (auto-computed from recipe when attached, else
    // the manually-entered cost) so the math always sees a current number.
    // draw() gates on < 4 costed items with the setup card, so this only runs
    // with a rankable menu.
    const priced = this._rankable();
    const items = priced.filter(i => i.cost);
    // ⚠ The dishes we just dropped for having no cost. Excluding them from the ranking is
    // CORRECT — a Star/Dog class is relative to the category average and you cannot place
    // a dish you cannot cost. But the exclusion SHRINKS the category, and a category that
    // falls under MIN_PER_CAT has every remaining item's class nulled, so deleting one
    // inventory product silently took three untouched, correctly-costed dishes off the
    // board with it. Worse, these dishes were filtered out before anything rendered, so
    // they did not appear on this page at all and there was no thread to pull.
    // They are surfaced below instead. The math is untouched: lowering MIN_PER_CAT would
    // hand back confident labels computed against three dishes, which is the fabrication
    // this page exists to avoid.
    const uncosted = priced.filter(i => !i.cost);
    App.markSetupDone('gs_r_eng');

    const SINGULAR = { STAR: 'Star', PLOWHORSE: 'Plowhorse', PUZZLE: 'Puzzle', DOG: 'Dog' };
    const MOVE = {}; this.QUAD.forEach(q => { MOVE[q.key] = q.move; });
    const ORDER = this.QUAD.map(q => q.key);
    const f = v => App.fmtCurrency(v);

    const byCat = {};
    // Group by the COMPARISON BASIS, not the raw category: cocktails rank as one pool because
    // Frozen / Specials / Happy Hour are menu layout, not economics, while dishes and No Prep
    // still rank per category because an appetiser is not an entree. App.menuGroupKey is
    // mirrored on the server so the audit names the same Dogs (verify-menu-grouping-tieout).
    items.forEach(i => { const c = App.menuGroupKey(i); (byCat[c] = byCat[c] || []).push(i); });
    // catSort now receives GROUP KEYS ('plate|Entrees'), not bare category names, so it orders by
    // the DISPLAY label. CAT_ORDER is a list of category names and still works against that.
    const _keys = Object.keys(byCat);
    const _label = k => App.menuGroupLabel(k, _keys);
    const catSort = (a, b) => {
      const la = _label(a), lb = _label(b);
      const ia = this.CAT_ORDER.indexOf(la), ib = this.CAT_ORDER.indexOf(lb);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || la.localeCompare(lb);
    };

    const cands = this.batchCandidates();
    const repriceCount = cands.length;
    const upside = cands.reduce((s, c) => s + (c.dwk || 0), 0);
    const plannedCount = items.filter(i => i.planned_price > 0).length;
    const unranked = [];

    // Build the prescription cells (Suggested, Delta/wk, Action) for one item.
    // quad may be null for an unranked item (no category group), which just means
    // no Dog routing and no quadrant move text.
    const cellsFor = (i, quad) => {
      const sugg = this.suggested(i, i.cost);
      const planned = (i.planned_price > 0) ? i.planned_price : null;
      const eff = planned || sugg;
      const isDog = quad === 'DOG';

      let suggCell;
      if (planned) suggCell = '<span style="color:var(--gold);font-weight:600;">Planned ' + f(planned) + '</span>';
      else if (sugg) suggCell = f(sugg);
      else suggCell = '<span style="color:var(--t3);">' + (this.targetPctFor(i) ? 'On target' : '-') + '</span>';

      const dwk = eff ? (eff - i.price) * i.weekly_covers : null;
      /* ⚠ `eff` is the PLANNED price when one exists, and a planned price can be a CUT, so this
         goes negative. `f` is App.fmtCurrency ('$' + v), which printed that as "$-84.00".
         Minus outside the $ through App.fmtBal, sign and colour both off the ROUNDED value —
         the same rule as the Forecast screen's Gap $ column. */
      const dwkSign = dwk != null ? App.fmtSigned(dwk, 2).sign : 0;
      const dwkCell = dwk != null
        ? '<span style="color:' + (dwkSign < 0 ? 'var(--t2)' : 'var(--gold)') + ';">' + (dwkSign > 0 ? '+' : '') + App.fmtBal(dwk) + '</span>'
        : '<span style="color:var(--t3);">-</span>';

      /* ⚠ THROUGH THE SHARED RULE (S322), not three inline tests — Menu Rundown asks the same
         function, so the button it offers and the button that renders here cannot drift apart. */
      const act = this.rowAction(i, quad);
      let action;
      if (act === 'marklive') action = '<div class="row-actions"><button class="btn btn-primary btn-sm me-marklive" data-id="' + esc(i.id) + '">Mark Live</button><button class="btn btn-ghost btn-sm me-cancelplan" data-id="' + esc(i.id) + '">Cancel</button></div>';
      else if (act === 'dogtest') action = this.dogAction(i.id);
      else if (act === 'reprice') action = '<div class="row-actions"><button class="btn btn-ghost btn-sm me-reprice" data-id="' + esc(i.id) + '">Reprice</button></div>';
      else action = '';

      return { suggCell, dwkCell, action };
    };

    // First section heading carries the bulk actions: Reprice to Target then
    // Export PDF (both cover every section).
    let actionsPlaced = false;
    const heading = label => {
      let btns = '';
      if (!actionsPlaced) {
        btns = (repriceCount > 0 ? '<button class="btn btn-primary btn-sm no-print" id="me-batch" style="margin-right:8px;">Reprice to Target (' + repriceCount + ')</button>' : '')
          + (plannedCount > 0 ? '<button class="btn btn-ghost btn-sm no-print" id="me-marklive-all" style="margin-right:8px;">Mark All Live (' + plannedCount + ')</button>' : '')
          + '<button class="btn btn-ghost btn-sm no-print" id="me-export">Export PDF</button>';
        actionsPlaced = true;
      }
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:22px 0 10px;">'
        + '<div class="sh" style="margin:0;">' + esc(label) + '</div>'
        + '<div style="display:flex;align-items:center;flex-shrink:0;">' + btns + '</div></div>';
    };

    const colgroup = '<colgroup><col style="width:18%;"/><col style="width:16%;"/><col style="width:14%;"/><col style="width:13%;"/><col style="width:13%;"/><col style="width:13%;"/><col style="width:13%;"/></colgroup>';

    // ── Ranked category cards ──────────────────────────────────────────────────
    const cards = Object.keys(byCat).sort(catSort).map(cat => {
      const list = byCat[cat];
      // Same gate as classify(), because this is the SECOND copy of that math and a board showing
      // verdicts classify() refuses to reach is the drift this pair keeps producing (S298/S303).
      if (list.length < this.MIN_PER_CAT || !App.menuPoolSeparable(list)) { unranked.push(...list); return ''; }
      const avgCM = list.reduce((s, i) => s + (i.price - i.cost), 0) / list.length;
      const avgCovers = list.reduce((s, i) => s + i.weekly_covers, 0) / list.length;
      const classed = list.map(i => {
        const hiM = (i.price - i.cost) >= avgCM, hiV = i.weekly_covers >= avgCovers;
        const quad = (hiM && hiV) ? 'STAR' : (!hiM && hiV) ? 'PLOWHORSE' : (hiM && !hiV) ? 'PUZZLE' : 'DOG';
        return { ...i, quad, pct: (i.cost / i.price * 100).toFixed(1) };
      });
      classed.sort((a, b) => ORDER.indexOf(a.quad) - ORDER.indexOf(b.quad) || b.weekly_covers - a.weekly_covers);
      const rows = classed.map(i => {
        const x = cellsFor(i, i.quad);
        return '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td><div class="val">' + SINGULAR[i.quad] + '</div><div style="font-size:10px;color:var(--t3);">' + esc(MOVE[i.quad]) + '</div></td>'
          + '<td>' + Math.round(i.weekly_covers) + '</td>'
          + '<td>' + f(i.price) + '</td>'
          + '<td>' + x.suggCell + '</td>'
          + '<td>' + x.dwkCell + '</td>'
          + '<td>' + x.action + '</td></tr>';
      }).join('');
      return heading(_label(cat) + ' (' + list.length + ')')
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + colgroup
        + '<thead><tr><th>Item</th><th>Class</th><th>Sold/wk</th><th>Current</th><th>Suggested</th><th>&Delta;/wk</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>';
    }).join('');

    // ── Categories too small to rank fairly (still get the pricing engine) ─────
    let unrankedCard = '';
    if (unranked.length) {
      unranked.sort((a, b) => catSort(App.menuGroupKey(a), App.menuGroupKey(b)) || b.weekly_covers - a.weekly_covers);
      const urows = unranked.map(i => {
        const x = cellsFor(i, null);
        return '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td>' + esc(i.category || '') + '</td>'
          + '<td>' + Math.round(i.weekly_covers) + '</td>'
          + '<td>' + f(i.price) + '</td>'
          + '<td>' + x.suggCell + '</td>'
          + '<td>' + x.dwkCell + '</td>'
          + '<td>' + x.action + '</td></tr>';
      }).join('');
      unrankedCard = heading('Too Few to Rank')
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + colgroup
        + '<thead><tr><th>Item</th><th>Category</th><th>Sold/wk</th><th>Current</th><th>Suggested</th><th>&Delta;/wk</th><th></th></tr></thead>'
        + '<tbody>' + urows + '</tbody></table></div>';
    }

    // ── Stat box — menu-wide rollups + the reprice headline + bulk actions ─────
    const avgCMall = items.reduce((s, i) => s + (i.price - i.cost), 0) / items.length;
    const avgCostPct = items.reduce((s, i) => s + (i.cost / i.price * 100), 0) / items.length;
    const calcItem = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statBox = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + calcItem('Items Analyzed', items.length)
      + calcItem('Avg Cost %', avgCostPct.toFixed(1) + '%')
      + calcItem('To Reprice', repriceCount)
      + calcItem('Weekly Upside', '<span style="color:var(--gold);">+' + f(upside) + '</span>')
      + '</div></div>';

    return '<div id="me-export-root">' + statBox + cards + unrankedCard
      + this._uncostedNote(uncosted, byCat) + this.reviewLogHtml() + '</div>';
  },

  // ── Reprice step (the focused pricing modal) ─────────────────────────────────
  openReprice(itemId) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item) return;
    const cost = App.menuItemCost(item) || 0;
    const tgt = this.targetPctFor(item);
    const sugg = this.suggested(item, cost);
    this._reId = item.id; this._reCost = cost;
    const f = v => App.fmtCurrency(v);
    const curPct = item.price > 0 ? (cost / item.price * 100) : 0;
    const start = item.planned_price || sugg || item.price || 0;
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Reprice ' + esc(item.name) + '</div>'
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;border:1px solid var(--b-edge);border-radius:var(--r2);padding:14px 18px;margin-bottom:16px;">'
      +   stat('Current Price', f(item.price))
      +   stat('Cost', f(cost))
      +   stat('Current Cost %', curPct.toFixed(1) + '%')
      +   (tgt ? stat('Target Cost %', tgt + '%') : '')
      + '</div>'
      + '<div class="form-row" style="align-items:flex-end;">'
      +   '<div class="f" style="width:140px;flex-shrink:0;"><label>New Price</label><div class="fw"><span class="pre">$</span>'
      +     '<input class="form-input pre" type="number" id="re-price" value="' + (Math.round(start * 100) / 100) + '" step="0.01" oninput="S.RevenueMenuEngineering.reCalc()"/></div></div>'
      +   '<div class="f" style="width:160px;flex-shrink:0;"><label>Expected Volume Change</label><div class="fw"><input class="form-input suf" type="number" id="re-vol" value="' + (item.planned_vol_pct != null ? item.planned_vol_pct : '') + '" step="1" placeholder="0" oninput="S.RevenueMenuEngineering.reCalc()"/><span class="suf">%</span></div></div>'
      +   (sugg ? '<button class="btn btn-ghost btn-sm" id="re-use-sugg">Use suggested ' + f(sugg) + '</button>' : '')
      + '</div>'
      + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:14px 18px;margin-top:6px;">'
      +   '<div style="display:flex;gap:28px;flex-wrap:wrap;">'
      +     '<div class="calc-item"><div class="calc-label">New Cost %</div><div class="calc-val" id="re-pct">-</div></div>'
      +     '<div class="calc-item"><div class="calc-label">New Margin</div><div class="calc-val" id="re-margin">-</div></div>'
      +     '<div class="calc-item"><div class="calc-label">Weekly Impact</div><div class="calc-val" id="re-impact">-</div></div>'
      +     '<div class="calc-item"><div class="calc-label">Break-even Drop</div><div class="calc-val" id="re-be">-</div></div>'
      +   '</div>'
      + '</div>'
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="re-plan">Save as Planned</button>'
      +   '<button class="btn btn-ghost" id="re-live">Mark Live Now</button>'
      + '</div></div>';

    App.openModal(html, { id: 're-modal', maxWidth: 560, onClose: () => App.closeModal('re-modal') });
    document.getElementById('re-use-sugg')?.addEventListener('click', () => { const el = document.getElementById('re-price'); if (el) { el.value = sugg; this.reCalc(); } });
    document.getElementById('re-plan')?.addEventListener('click', () => this.savePlanned(item.id, this._reNewPrice(), this._reVolPct()));
    document.getElementById('re-live')?.addEventListener('click', () => this.saveLive(item.id, this._reNewPrice(), this._reVolPct()));
    this.reCalc();
  },

  _reNewPrice() { return parseFloat(document.getElementById('re-price')?.value) || 0; },
  _reVolPct() { return parseFloat(document.getElementById('re-vol')?.value) || 0; },

  reCalc() {
    const item = (App.data.menu_items || []).find(i => i.id === this._reId);
    if (!item) return;
    const cost = this._reCost || 0;
    const np = this._reNewPrice();
    const covers = item.weekly_covers || 0;
    const tgt = this.targetPctFor(item);
    const pct = np > 0 ? (cost / np * 100) : null;
    const margin = np - cost;
    const vol = parseFloat(document.getElementById('re-vol')?.value) || 0;
    const oldCM0 = (item.price || 0) - cost;
    const impact = (margin * (covers * (1 + vol / 100))) - (oldCM0 * covers);
    const set = (id, txt, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = txt; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('re-pct', pct != null ? pct.toFixed(1) + '%' : '-', tgt ? (pct > tgt ? 'warn' : 'good') : '');
    set('re-margin', App.fmtCurrency(margin));
    /* ⚠ A price the operator adjusts DOWN, or an expected volume drop big enough to swamp the
       raise, makes the weekly impact negative — and fmtCurrency is '$' + v, so it printed
       "$-84.00". Minus outside the $, sign off the ROUNDED value. */
    const impSign = App.fmtSigned(impact, 2).sign;
    set('re-impact', (impSign > 0 ? '+' : '') + App.fmtBal(impact));
    const oldMargin = (item.price || 0) - cost;
    if (np > (item.price || 0) && margin > 0 && oldMargin > 0) {
      set('re-be', Math.max(0, (1 - oldMargin / margin) * 100).toFixed(0) + '%');
    } else {
      set('re-be', '-');
    }
  },

  // Plan it: set a pending price, no log. The menu math (cost %, engineering)
  // reads it, but Recovery does not see it until it is marked live.
  savePlanned(itemId, newPrice, volPct) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item || !(newPrice > 0)) return;
    const undo = App.snapshotRows([item]);   // live row: putRecord cannot revert it for us
    item.planned_price = Math.round(newPrice * 100) / 100;
    item.planned_vol_pct = parseFloat(volPct) || 0;
    item.planned_at = new Date().toISOString();
    // Returns the promise so a caller (and the harness) can wait for the outcome. Callers use it
    // fire-and-forget; handing it back costs nothing and makes the failure path testable.
    return App.putRecord('core', 'menu_item', item).then(ok => {
      if (!ok) { App.restoreRows(undo); this.draw(); return; }   // leave the modal open to retry
      App.closeModal('re-modal'); this.draw();
    });
  },

  // Roll it out now: set the live price + log the change at this moment.
  async saveLive(itemId, newPrice, volPct) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item || !(newPrice > 0)) return;
    const np = Math.round(newPrice * 100) / 100;
    const old = item.price;
    // ⚠ Snapshot BEFORE mutating. `item` is the live row out of App.data, so putRecord's own revert
    // is a no-op for us (it re-seats the array slot with the very object we just changed — see the
    // note in App.putRecord). Without this, a rejected save left the new price on screen and in
    // memory for the rest of the session while the register was never told.
    const undo = App.snapshotRows([item]);
    item.price = np;
    item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
    // ⚠ LOG ONLY IF IT LANDED. This discarded its result and logged regardless, so a rejected save
    // still wrote a revenue_price_log row AND a fix_log row that Recovery counts — money reported
    // that does not exist, against a price the register was never told about. The bulk twins
    // (applyBatch / markAllLive) were hardened against exactly this; these single-item doors were
    // the twins that got missed. On failure putRecord has already reverted the row and toasted, so
    // redraw and leave the modal OPEN to retry — the same shape applyBatch uses.
    if (!(await App.putRecord('core', 'menu_item', item))) { App.restoreRows(undo); this.draw(); return; }
    if (old != null && old !== np) await this._logPriceChange(item, old, np, volPct);
    App.closeModal('re-modal');
    this.draw();
  },

  // Promote a planned price to live (the honest rollout moment).
  async markLive(itemId) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item || !(item.planned_price > 0)) return;
    const old = item.price, np = item.planned_price, vol = item.planned_vol_pct;
    // This page only ever plans a RAISE, so a plan that now sits at or under the live
    // price is stale: the price moved after the plan was made. Drop it rather than
    // push it live, or Mark Live quietly CUTS the price the operator just set.
    const undo = App.snapshotRows([item]);   // before either branch mutates the live row
    if (old != null && np <= old) {
      item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
      if (!(await App.putRecord('core', 'menu_item', item))) App.restoreRows(undo);
      this.draw();
      return;
    }
    item.price = np; item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
    // Same rule as saveLive: no Recovery credit for a rise the server rejected, and restore the row
    // ourselves so the PLAN comes back too and the operator can just hit Mark Live again.
    const ok = await App.putRecord('core', 'menu_item', item);
    if (!ok) App.restoreRows(undo);
    if (ok && old != null && old !== np) await this._logPriceChange(item, old, np, vol);
    this.draw();
  },

  cancelPlanned(itemId) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item) return;
    const undo = App.snapshotRows([item]);   // live row: putRecord cannot revert it for us
    item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
    return App.putRecord('core', 'menu_item', item).then(ok => {
      if (!ok) App.restoreRows(undo);   // a failed cancel must leave the plan standing
      this.draw();
    });
  },

  // ── Reprice to Target — the batch "engineer the whole menu" pass ─────────────
  // Item ids classified as Dog in their own category, excluded from bulk reprice
  // The latest Dog Test on an item (by decision, else start date), so the Dog row
  // can reflect a running or finished test instead of always offering a new one.
  dogTestFor(id) {
    const tests = (App.data.menu_dog_tests || []).filter(t => t.item_id === id);
    if (!tests.length) return null;
    // A running test always wins over an older decided one (their timestamps are
    // not comparable: a decision carries a full ISO stamp, a start only a date).
    const active = tests.find(t => t.status === 'Testing');
    if (active) return active;
    return tests.slice().sort((a, b) =>
      (b.decided_at || b.start_date || '').localeCompare(a.decided_at || a.start_date || ''))[0];
  },
  // The Dog quadrant action: a running test shows its day count, a kept item is
  // tagged and offers a re-test, and an untested Dog gets the Dog Test button.
  // (A Cut item is archived and never reaches this list.)
  dogAction(id) {
    const dt = this.dogTestFor(id);
    if (dt && dt.status === 'Testing') {
      const el = Math.max(0, Math.floor((Date.now() - new Date((dt.start_date || '') + 'T00:00:00').getTime()) / 86400000));
      return '<div class="row-actions"><button class="btn btn-ghost btn-sm me-dogtest" data-id="' + esc(id) + '">Testing &middot; Day ' + el + '/90</button></div>';
    }
    if (dt && dt.status === 'Kept') {
      const d = (dt.decided_at || '').slice(0, 10);
      return '<div class="row-actions" style="align-items:center;"><span style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:var(--green);white-space:nowrap;">KEPT' + (d ? ' ' + d : '') + '</span>'
        + '<button class="btn btn-ghost btn-sm me-dogtest" data-id="' + esc(id) + '">Re-test</button></div>';
    }
    return '<div class="row-actions"><button class="btn btn-ghost btn-sm me-dogtest" data-id="' + esc(id) + '">Dog Test</button></div>';
  },
  // (Dogs go to the Dog Test, not a blind price bump).
  _dogIds() {
    const items = this._rankable().filter(i => i.cost);
    // ⚠ THE SHARED COMPARISON BASIS, like every other grouping in this file (lines 66, 172, 238,
    // 333) and the server audit. This was the THIRD grouping site and it was missed when the basis
    // landed — it still keyed on the raw category, so it disagreed with the board rendered right
    // beside it. It decides which items are Dogs, and that drives the "To Reprice" count, the
    // Weekly Upside dollar figure and the batch reprice: with drinks split across Cocktails /
    // Shots / Frozen, no drink section reached MIN_PER_CAT, so _dogIds found NO dogs while the
    // board ranked the pool — Weekly Upside read 20x the truth and "Reprice to Target" offered to
    // blind-bump four items the same page labelled Dogs, which the comment below forbids.
    const byCat = {}; items.forEach(i => { const c = App.menuGroupKey(i); (byCat[c] = byCat[c] || []).push(i); });
    const dogs = new Set();
    Object.values(byCat).forEach(list => {
      // The THIRD copy of the quad math, and the one that spends money: it drives Weekly Upside and
      // the batch reprice. Same gate (S298/S303) or this offers to reprice items the board beside
      // it refuses to call Dogs.
      if (list.length < this.MIN_PER_CAT || !App.menuPoolSeparable(list)) return;
      const avgCM = list.reduce((s, i) => s + (i.price - i.cost), 0) / list.length;
      const avgCovers = list.reduce((s, i) => s + i.weekly_covers, 0) / list.length;
      list.forEach(i => { if ((i.price - i.cost) < avgCM && i.weekly_covers < avgCovers) dogs.add(i.id); });
    });
    return dogs;
  },

  // Over-target, not-yet-planned, non-Dog items (the suggestions). References the
  // live stored items so apply can mutate them in place.
  batchCandidates() {
    const dogs = this._dogIds();
    const out = [];
    (App.data.menu_items || []).forEach(item => {
      if (item.archived) return;
      if (!(item.price > 0 && item.weekly_covers > 0)) return;
      if (item.planned_price > 0) return;
      if (dogs.has(item.id)) return;
      const cost = App.menuItemCost(item) || 0;
      const sugg = this.suggested(item, cost);
      if (!sugg) return;
      out.push({ item, cost, sugg, dwk: (sugg - item.price) * item.weekly_covers });
    });
    return out;
  },

  openBatch() {
    const cands = this.batchCandidates();
    if (!cands.length) return;
    const f = v => App.fmtCurrency(v);
    const byCat = {}; cands.forEach(c => { const k = c.item.category || 'Uncategorized'; (byCat[k] = byCat[k] || []).push(c); });
    const catSort = (a, b) => { const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); };
    let listHtml = '';
    Object.keys(byCat).sort(catSort).forEach(cat => {
      listHtml += '<div class="sh" style="margin:14px 0 4px;">' + esc(cat) + '</div>';
      byCat[cat].forEach(c => {
        listHtml += '<label style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--row-div);cursor:pointer;">'
          + '<input type="checkbox" class="bc-check batch-chk" data-id="' + esc(c.item.id) + '" data-dwk="' + c.dwk + '" checked/>'
          + '<span style="flex:1;min-width:0;font-size:13px;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.item.name) + '</span>'
          + '<span style="font-size:12px;color:var(--t3);white-space:nowrap;">' + f(c.item.price) + ' &rarr; <span style="color:var(--t1);font-weight:600;">' + f(c.sugg) + '</span></span>'
          + '<span style="font-size:12px;color:var(--gold);white-space:nowrap;min-width:78px;text-align:right;">+' + f(c.dwk) + '/wk</span>'
          + '</label>';
      });
    });
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Reprice to Target</div>'
      + '<div style="max-height:46vh;overflow:auto;margin:4px 0;">' + listHtml + '</div>'
      + '<div id="batch-sum" style="font-size:13px;font-weight:700;color:var(--t1);padding-top:12px;border-top:1px solid var(--b2);"></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="batch-plan">Save Checked as Planned</button>'
      + '<button class="btn btn-ghost" id="batch-live">Mark Checked Live</button></div></div>';
    App.openModal(html, { id: 'batch-modal', maxWidth: 640, onClose: () => App.closeModal('batch-modal') });
    document.querySelectorAll('.batch-chk').forEach(c => c.addEventListener('change', () => this.batchSum()));
    document.getElementById('batch-plan')?.addEventListener('click', () => this.applyBatch(false));
    document.getElementById('batch-live')?.addEventListener('click', () => this.applyBatch(true));
    this.batchSum();
  },

  batchSum() {
    const checked = [...document.querySelectorAll('.batch-chk')].filter(c => c.checked);
    const total = checked.reduce((s, c) => s + (parseFloat(c.dataset.dwk) || 0), 0);
    const el = document.getElementById('batch-sum');
    if (el) el.textContent = checked.length + ' item' + (checked.length === 1 ? '' : 's') + ' selected, +' + App.fmtCurrency(total) + '/wk';
    const live = document.getElementById('batch-live'), plan = document.getElementById('batch-plan');
    if (live) live.disabled = !checked.length;
    if (plan) plan.disabled = !checked.length;
  },

  async applyBatch(live) {
    const ids = [...document.querySelectorAll('.batch-chk')].filter(c => c.checked).map(c => c.dataset.id);
    if (!ids.length) { App.closeModal('batch-modal'); return; }
    const logs = [], touched = [], undo = [];
    ids.forEach(id => {
      const item = (App.data.menu_items || []).find(x => x.id === id);
      if (!item) return;
      const cost = App.menuItemCost(item) || 0;
      const sugg = this.suggested(item, cost);
      if (!sugg) return;
      touched.push(item);
      undo.push(...App.snapshotRows([item]));   // captured BEFORE the price is changed below
      if (live) {
        const old = item.price;
        item.price = sugg; item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
        if (old != null && old !== sugg) logs.push([item, old, sugg, 0]);
      } else {
        item.planned_price = sugg; item.planned_vol_pct = 0; item.planned_at = new Date().toISOString();
      }
    });
    // A bulk write cannot revert itself. Without this, a failed write left the new prices on the
    // menu screen while the server kept the old ones — and Recovery got a logged price rise that
    // never actually happened, so the scoreboard credited money the bar never charged.
    if (!(await App.putRecordsBulk('core', 'menu_item', touched))) {
      App.restoreRows(undo);
      App.closeModal('batch-modal');
      this.draw();
      return;
    }
    for (const [item, old, np, vol] of logs) await this._logPriceChange(item, old, np, vol);
    App.closeModal('batch-modal');
    this.draw();
  },

  // Roll out every planned price at once (the new menu goes into service).
  async markAllLive() {
    const planned = (App.data.menu_items || []).filter(i => i.planned_price > 0);
    if (!planned.length) return;
    const ok = await App.confirm({ title: 'Mark all planned prices live?', message: planned.length + ' planned price' + (planned.length === 1 ? '' : 's') + ' will become your live menu prices now, and Bar Cop will log the change to Recovery. Do this the day the new menu actually goes into service.', confirmText: 'Mark All Live', cancelText: 'Not Yet' });
    if (!ok) return;
    const logs = [];
    const undo = App.snapshotRows(planned);   // before any price moves
    planned.forEach(item => {
      const old = item.price, np = item.planned_price, vol = item.planned_vol_pct;
      // Raise-only: never CUT a live price in bulk. If the planned price is at/below live,
      // drop the plan without applying it (same guard the single Mark Live / saveLive use).
      if (old != null && np <= old) { item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null; return; }
      item.price = np; item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
      if (old != null && old !== np) logs.push([item, old, np, vol]);
    });
    // Same as the batch apply above: never log a price change to Recovery that did not land.
    if (!(await App.putRecordsBulk('core', 'menu_item', planned))) { App.restoreRows(undo); this.draw(); return; }
    for (const [item, old, np, vol] of logs) await this._logPriceChange(item, old, np, vol);
    this.draw();
  },

  // ── Re-import covers from a POS sales-mix (PMIX) export ───────────────────────
  // Per-item covers drive the whole page (classification, suggested prices, the
  // pricing checks). Covers normally refresh when the product-mix report drops at
  // the Shift weekly close; this on-page drop is the between-closes door to
  // re-import just covers. Matches each row to a menu item by name and upserts
  // weekly_covers. Directions live in the nav-i help (Keeping Units Sold Current).
  coversImportHtml() {
    const fl = this._coversFlash; this._coversFlash = null;
    let flash = '';
    if (fl) {
      // Same two helpers r-server-check's flash uses, so the three outcome notes read identically
      // at both PMIX doors.
      const note = t => '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:6px;">' + t + '</div>';
      const list = a => a.slice(0, 8).map(esc).join(', ') + (a.length > 8 ? ', and ' + (a.length - 8) + ' more' : '');
      const nSkip = fl.nSkipped || 0, nInc = fl.nIncomplete || 0, nNeg = fl.nNegative || 0;
      /* ⚠ I4's two outcomes join the NAME side of every gate below. Each of those `!nSkip` tests is
         really asking "was anything wrong with the names?", and a retired match and an ambiguous
         one are both exactly that — so leaving them out would print "The item names matched" over a
         file whose names were the whole problem ([[the-loop]] #24). */
      const nRet = fl.nRetired || 0, nAmb = fl.nAmbiguous || 0;
      const nameTrouble = nSkip + nRet + nAmb;
      flash = '<div style="font-size:13px;margin-top:12px;font-weight:700;color:' + (fl.updated ? 'var(--gold)' : 'var(--red)') + ';">'
        + (fl.failed ? 'Save failed. Try the import again.'
           : fl.updated ? 'Updated units sold on ' + fl.updated + ' item' + (fl.updated === 1 ? '' : 's')
             + (fl.merged ? ' (' + fl.merged + ' extra row' + (fl.merged === 1 ? '' : 's') + ' combined into item totals)' : '') + '.'
           /* ⚠ DO NOT BLAME THE NAMES WHEN THE NAMES WERE FINE, and do not contradict the note
              printed directly underneath. "No items matched" was the only zero-row headline, so a
              file whose Units cells were unreadable — or whose items all netted negative after
              returns — sent the operator off to rename menu items that were already correct, while
              the note below said in plain words that those names HAD matched. Every combination
              gets a headline that agrees with its notes; anything involving a genuinely unmatched
              name, or an empty file, still falls through to the name message. */
           /* ⚠ BRANCH ON THE BUILDER'S COUNTS (nSkipped/nIncomplete/nNegative), NOT on the display
              lists. The lists strip '(blank)' rows, so a PMIX carrying a nameless row made
              `unmatched` come out EMPTY and the headline claimed "The item names matched" about a
              file that had an unmatched row — one that was itself rendered nowhere. */
           : 'No items updated. ' + (
               (nInc && !nameTrouble && !nNeg)
                 ? 'The item names matched, but Bar Cop could not read a units-sold figure for any of them.'
             : (nNeg && !nameTrouble && !nInc)
                 ? 'Every item came out at negative units after returns, so the previous figures were left alone.'
             : ((nInc || nNeg) && !nameTrouble)
                 ? 'The item names matched — see below for what happened to each row.'
             : ((nRet || nAmb) && !nSkip)
                 ? 'Bar Cop found every name on your menu but could not use them. See below.'
             : 'Check that the item names in your export match your menu.'))
        + '</div>'
        // ⚠ GUARDED like its two neighbours. coversImportHtml() is ONE TERM inside draw()'s single
        // innerHTML expression, so a throw here does not lose a note — it blanks the entire Menu
        // Engineering screen, classification board and all. One writer sets this key today; the
        // guard is for the next one.
        + ((fl.unmatched || []).length ? note('Not matched: ' + list(fl.unmatched) + '. Add them in Menu Builder or rename to match.') : '')
        // I4: the two outcomes the builder now refuses. Each names what happened and the one thing
        // that fixes it, the same shape as the three notes around it.
        + ((fl.retired || []).length ? note('Still selling but no longer on your live menu: ' + list(fl.retired)
            + '. Left alone, because units on an inactive item never show anywhere. Make ' + ((fl.retired || []).length === 1 ? 'it' : 'them')
            + ' active on the Inactive tab in Menu Builder if you are still selling ' + ((fl.retired || []).length === 1 ? 'it' : 'them') + '.') : '')
        + ((fl.ambiguous || []).length ? note('Matches more than one menu item: ' + list(fl.ambiguous)
            + '. Bar Cop could not tell which one rang, so both were left at their previous figures. '
            + 'Rename one of each pair in Menu Builder and drop the file again.') : '')
        + (fl.incomplete && fl.incomplete.length ? note('Skipped, no readable units-sold figure: ' + list(fl.incomplete) + '. These names matched your menu, so check the units column in your export.') : '')
        // A dropped item is a MEASUREMENT THAT WENT MISSING. It keeps last week's units, and this
        // screen presents those as this week's mix — so silence here is a wrong Star/Dog call.
        + (fl.netNegative && fl.netNegative.length ? note('Left at the previous figure: ' + list(fl.netNegative) + '. Returns exceeded sales in this file, so the units came out negative and were not written.') : '')
        // The rows with no name to print — a nameless PMIX line is usually a subtotal or a section
        // header. Reported as a count so the operator's totals reconcile.
        + ((nSkip - (fl.unmatched || []).length) > 0
            ? note((nSkip - fl.unmatched.length) + ' row' + ((nSkip - fl.unmatched.length) === 1 ? '' : 's')
                   + ' skipped with no item name — usually a subtotal or section line in the export.') : '');
    }
    return '<div class="card form-card no-print">'
      + '<div class="card-title" style="display:flex;align-items:center;gap:10px;"><span>Re-import Units Sold</span>' + App.freqTag('As needed') + '</div>'
      + '<div id="me-cov-csv"></div>' + flash
      + '</div>'
      + '<div id="me-cov-actions" style="margin:16px 0 24px;"></div>';
  },

  mountCoversImport() {
    const el = document.getElementById('me-cov-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS product-mix (PMIX) report here',
      dropSub: 'One row per item with units sold for the week. Bar Cop matches each row to a menu item by name and refreshes its weekly units sold.',
      actionsEl: '#me-cov-actions',
      fields: PosIngest.FIELDS.pmix,
      confirmLabel: 'Update Units Sold',
      /* ⛔ THE MAPPER NO LONGER COMMITS. It hands the file to the confirm screen, which is where the
         operator presses the button. Same shape as every other converted door. */
      onComplete: rows => this._openPmixReview(rows)
    });
  },

  /* ── DOOR 11: THE PRODUCT-MIX CONFIRM SCREEN ─────────────────────────────────────
     ONE DOOR, SO THE MAPPING LIVES HERE. Per-server needed a shared mapper because two screens showed
     the same rows; product mix has exactly one door since the cockpit zone became a signpost, so there
     is nothing for this to drift from.
     ⛔⛔ THE UNITS CELL SHOWS THE DISH’S SUMMED TOTAL, NOT THE ROW’S OWN UNITS, because that is what
     the write uses. A daypart-split export names one dish several times and `buildPmix` folds them;
     the flash already explains that merge, because otherwise the operator sees a number bigger than
     any row in their file with no reason given. On a per-row screen that fact belongs on the row.
     ⛔ AND THE COUNT IS DISHES, NOT ROWS. Two rows land as one menu item, so a button promising 2 over
     a table showing one dish is the reference screen’s worst defect wearing a new costume. The shell
     derives its number from the rows, so the noun has to be the dish and the merged rows must not
     each claim their own. */
  PMIX_NOTES: {
    noName:      'No item name on this row',
    noMatch:     'This name is not on your menu',
    ambiguous:   'More than one menu item has this name',
    retired:     'This item is no longer on your live menu',
    incomplete:  'Could not read the units on this row',
    netNegative: 'Returns came to more than the sales, so this item keeps its previous figure',
    merged:      'Summed with the other rows for this item',
    'new':       'Updating this item\'s units sold',
    /* ⛔⛔ THE TOTALS ROWS WENT OUT SILENT ON THE FIRST WALK. `buildPmix` gained the `summary` status
       the same day and this map did not, so the three rows that FOUND that defect — Grand Total, Team
       Average, TOTALS — rendered with an empty What Happens cell, under a column header that is a
       promise. Kyle's rule from door 9, broken again in the same session he gave it. */
    summary:     'Your file\'s own totals line, not a menu item'
  },
  pmixReviewRows(built, opts) {
    opts = opts || {};
    const removed = opts.removed || {};
    const items = (App.data && App.data.menu_items) || [];
    const byId = {}; items.forEach(it => { if (it) byId[it.id] = it; });
    const rows = [];
    /* ⚠ THE FIRST ROW OF A MERGED SET CARRIES THE COUNT. `built.toAdd` holds ONE entry per dish, so the
       shell must see exactly one landing row per dish or its derived number doubles. The first row for
       an entry lands; the rest say they were summed into it and do not count again. */
    const counted = new Set();
    (built.perRow || []).forEach((v, i) => {
      const key = (v.raw && v.raw._rid != null) ? v.raw._rid : i;
      if (removed[key]) return;
      const it = v.entry ? byId[v.entry.item_id] : null;
      const units = v.entry ? v.entry.covers : App.parseNum((v.raw || {}).units);
      /* ⚠ `Number.isFinite`, NOT `!= null`, AND THE REASON IS NOT COSMETIC. `weekly_covers != null` is
         how `_measured` asks "is this item RANKABLE", and `verify-menu-zero-seller` D3 pins that the
         rule is written in exactly one place — so reusing the spelling here made a second copy of a
         rule this screen has already been bitten by. The question on THIS row is different: is there a
         previous figure to show the operator as `was`. `isFinite` says that precisely and also rejects
         a NaN, which `!= null` would have let through into the comparison cell. */
      const was = it && Number.isFinite(it.weekly_covers) ? it.weekly_covers : null;
      const shown = (units == null || isNaN(units)) ? '\u2014' : String(Math.round(units));
      /* ⛔⛔ "was 95", NOT "you entered 95". `ImportConfirm.compare` writes *"you entered X"*, which is
         exactly right on the sales and per-server doors — there the second figure IS a number the
         operator typed by hand, and the row is asking which one wins. Here it is the item's PREVIOUS
         weekly units, set by the last import or the seed. Measured on the first walk: "49 you entered
         95" about a figure nobody entered. Same helper, wrong sentence, because the two doors are
         asking different questions — so this one builds its own sub-line and leaves `compare` alone
         for the doors whose words it fits. */
      const cell = (v.lands && was != null && Math.round(was) !== Math.round(units))
        ? esc(shown) + ImportConfirm.sub('was ' + Math.round(was))
        : esc(shown);
      let lands = !!v.lands;
      if (lands) { if (counted.has(v.entry)) lands = false; else counted.add(v.entry); }
      rows.push({
        cells: [esc(v.name || '(no name)'), cell],
        note: this.PMIX_NOTES[v.status] || '',
        notes: [], lands: lands, needsYou: false, key: key
      });
    });
    return { rows: rows, count: rows.filter(r => r.lands).length };
  },

  _openPmixReview(rows) {
    (rows || []).forEach((r, i) => { if (r && r._rid == null) r._rid = 'pm' + i; });
    this._pmixReview = { rows: rows || [], open: {}, removed: {} };
    this.draw();
  },
  /* ⚠ RE-WALKED ON EVERY RENDER OVER THE ROWS NOT REMOVED, and on this lane that genuinely changes
     answers: taking out the row that carried the returns can lift a dish out of net-negative and back
     into going in. That is right — it is the operator’s decision — and it is why the walk is the one
     place the outcome is decided rather than being cached at the drop. */
  _pmixReviewSummary() {
    const r = this._pmixReview;
    if (!r) return { rows: [], count: 0 };
    const live = r.rows.filter(x => !r.removed[x._rid]);
    return this.pmixReviewRows(PosIngest.build('pmix', live), { removed: {} });
  },
  _pmixReviewRemoved() {
    const r = this._pmixReview;
    if (!r) return [];
    const gone = r.rows.filter(x => r.removed[x._rid]);
    if (!gone.length) return [];
    return this.pmixReviewRows(PosIngest.build('pmix', gone), { removed: {} }).rows;
  },
  _pmixPanelOpts() {
    const s = this._pmixReviewSummary();
    return { rows: s.rows, verb: 'Update', noun: 'Item', nounPlural: 'Items' };
  },
  pmixReviewHTML() {
    const r = this._pmixReview || { open: {} };
    return ImportConfirm.panel(Object.assign(this._pmixPanelOpts(), {
      label: 'Check this file before it goes in',
      lead: 'Nothing is saved until you press the button below. Every row from your file is here with '
          + 'what Bar Cop worked out. Take out anything you do not want.',
      columns: [{ label: 'Item', width: 40 }, { label: 'Units Sold', width: 16 }],
      outcomeLabel: 'What happens',
      removedRows: this._pmixReviewRemoved(),
      removable: true,
      open: r.open,
      // The section is what the rows ARE; the button keeps its own verb. Without this the head read
      // as the bare word "Update" above "72 Items Bar Cop worked out".
      settledLabel: 'Going In',
      goAttr: 'data-pmreview-go', backAttr: 'data-pmreview-back', backLabel: 'Start Over',
      resultId: 'me-cov-result',
      busy: !!this._pmixReviewWriting
    }));
  },
  _wirePmixReview() {
    const c = this.container, r = this._pmixReview;
    if (!c || !r) return;
    c.querySelectorAll('[data-confirm-section]').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.confirmSection;
      r.open[k] = (k === 'needs') ? (r.open[k] === false) : !r.open[k];
      this.draw();
    }));
    c.querySelectorAll('[data-confirm-remove]').forEach(b => b.addEventListener('click', () => {
      r.removed[b.dataset.confirmRemove] = true; this.draw();
    }));
    c.querySelectorAll('[data-confirm-restore]').forEach(b => b.addEventListener('click', () => {
      delete r.removed[b.dataset.confirmRestore]; this.draw();
    }));
    c.querySelector('[data-pmreview-go]')?.addEventListener('click', () => this._runPmixReview());
    c.querySelector('[data-pmreview-back]')?.addEventListener('click', () => {
      this._pmixReview = null; this.draw();
    });
  },
  /* ⛔ ONE PRESS, ONE IMPORT. The button is rebuilt by every redraw, so a flag on the screen object is
     the only thing a redraw cannot hand back. */
  async _runPmixReview() {
    const r = this._pmixReview;
    if (!r || this._pmixReviewWriting) return;
    this._pmixReviewWriting = true;
    const btn = this.container && this.container.querySelector('[data-pmreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
    try {
      await this.applyCoversImport(r.rows.filter(x => !r.removed[x._rid]), { reviewed: true });
    } finally {
      this._pmixReviewWriting = false;
      if (this._pmixReview) {
        const b = this.container && this.container.querySelector('[data-pmreview-go]');
        if (b) { b.disabled = false; b.textContent = ImportConfirm.goLabel(this._pmixPanelOpts()); }
      }
    }
  },

  async applyCoversImport(rows, opts) {
    opts = opts || {};
    // One ingest path: PosIngest matches by name + upserts weekly_covers.
    // ⚠ `retired` and `ambiguous` are I4's two refused outcomes — a name only an inactive item
    // carries, and a name two LIVE items share. Both were previously written or silently dropped;
    // both are now refused by the builder, so both must be carried here or they become the exact
    // silent drop the other three buckets exist to prevent.
    const { toAdd, skipped, incomplete, netNegative, retired, ambiguous, merged } = PosIngest.build('pmix', rows);
    let updated = 0, failed = false;
    if (toAdd.length) {
      // Honor the commit result: discarding it reported "Updated units sold on N items" after a
      // save the server had rejected.
      // ⚠ This comment used to say the rejected save was "rolled back". It was NOT — _commitPmix
      // mutated the live menu items in place and nothing put them back, so this screen redrew the
      // whole board off covers the server never took. The rollback is real now (PosIngest._commitPmix
      // snapshots and restores); do not weaken that comment again without checking the code.
      const ok = await PosIngest.commit('pmix', toAdd);
      if (ok) updated = toAdd.length; else failed = true;
    }
    // Carry `merged` through so the flash can explain a combined total. A daypart-split PMIX lists an
    // item several times and buildPmix sums them, so without this the operator sees a number bigger
    // than any single row in their file with no reason given — the same silent-merge the cockpit
    // import already explains. (sc-dashboard's importPmix surfaces this; this screen was the twin.)
    // ⚠ CARRY ALL THREE OUTCOMES, not just the unmatched names. buildPmix split its one `skipped`
    // list into skipped (name not on your menu) / incomplete (Units cell unreadable) and started
    // reporting netNegative (returns exceeded sales, so the item was LEFT at its previous figure).
    // sc-dashboard's importPmix reads all three; this screen kept reading only the first, so an
    // unreadable Units cell and a net-negative item both vanished here with nothing said — and a
    // net-negative item silently keeps LAST week's units while this very screen presents them as
    // this week's mix, driving its Star/Dog call, its suggested price and the weekly upside.
    this._coversFlash = { updated, failed, merged: merged || 0,
      unmatched: skipped.filter(s => s && s !== '(blank)'),
      incomplete: (incomplete || []).filter(s => s && s !== '(blank)'),
      netNegative: (netNegative || []).filter(Boolean),
      // ⚠ RAW COUNTS drive the headline; the lists above only supply names. A PMIX row with an empty
      // Item Name cell lands in `skipped` as '(blank)', gets filtered out here, and then the headline
      // said "The item names matched" about a file that had a nameless row — which was itself
      // rendered nowhere. Same hole as the server door. Count what the builder counted.
      nSkipped: (skipped || []).length,
      nIncomplete: (incomplete || []).length,
      nNegative: (netNegative || []).length,
      retired: (retired || []).filter(Boolean),
      ambiguous: (ambiguous || []).filter(Boolean),
      nRetired: (retired || []).length,
      nAmbiguous: (ambiguous || []).length };
    /* ⛔⛔⛔ THE CONFIRM SCREEN CLEARS ON SUCCESS, AND ONLY ON SUCCESS — and leaving this out is what
       Kyle hit on the first walk: *"the button says updating.. for a second and then goes back to the
       update button and you stay on the import rows page."* The write landed every time; `draw()`
       simply re-rendered the confirm screen, because `_pmixReview` was still set and `draw()` reads it
       first. A straight omission — `r-server-check` has this exact line and I did not copy it.
       ⛔ AND A REFUSED WRITE KEEPS THE SCREEN, reporting into the shell's own result slot rather than
       redrawing: every row stays up so the operator can press again without re-dropping the file, and
       a redraw would destroy the slot holding the error. */
    if (opts.reviewed && failed) {
      const slot = document.getElementById('me-cov-result');
      if (slot) slot.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + 'Could not save. Nothing was changed. Check your connection and press Update again.</div>';
      return;
    }
    if (opts.reviewed) this._pmixReview = null;
    this.draw();
  },

  // Write the price-log + the pricing fix event, dated NOW (the real rollout).
  // Mirrors the direct-edit path in Menu Items so the Pricing Review Log and the
  // Recovery Scoreboard both pick it up. Pricing is a no-dollar metric, so this
  // logs the change and its date, never an invented recovered figure.
  async _logPriceChange(item, oldPrice, newPrice, volPct) {
    // ⚠ AN UNKNOWN COST MUST NOT BECOME A PREDICTION (S111). This was `menuItemCost(item) || 0`,
    // so a dish whose ingredient had been deleted costed at ZERO and the whole menu price became
    // the margin — persisting a fabricated `predicted_weekly_impact` on the Pricing Review Log
    // row. It was invisible only because verify() returns 'no-cost' before it ever renders (S48),
    // which is a second guard, not a reason to store an invented number. App.logPriceChange
    // already persists `cost: null` for this case; the prediction now matches it.
    const raw = App.menuItemCost(item);
    const cost = raw || 0;
    const covers = item.weekly_covers || 0;
    const vp = parseFloat(volPct) || 0;
    const oldCM = oldPrice - cost, newCM = newPrice - cost;
    const predWk = (raw == null || !(raw > 0))
      ? null
      : (newCM * (covers * (1 + vp / 100))) - (oldCM * covers);
    await App.logPriceChange(item, oldPrice, newPrice, { volPct: vp, predictedWeekly: predWk, reason: 'Reprice from Menu Engineering', source: 'menu-engineering' });
  },

  // ── Pricing Review Log — every logged price change, verified against the
  // prediction once three weeks of covers land (folded in from the retired Price
  // Calculator so there is one pricing door). Honest by construction: a result
  // shows only when the captured baseline and current covers both exist. ────────
  verify(entry) {
    if (!entry || !entry.date || entry.covers_at_change == null || entry.cost == null) return { status: 'old-format' };
    // ⚠ A ZERO cost is not a cost. `entry.cost == null` let it through, and the margins
    // below are `price - cost`, so a 0 makes the ENTIRE menu price the margin and
    // `actualWeekly` comes out badly wrong while being labelled "actual" on screen.
    // Refusing here also covers every row already written with a 0 before
    // App.logPriceChange started storing null.
    if (!entry.cost) return { status: 'no-cost' };
    const t = new Date(entry.date + 'T00:00:00').getTime();
    if (isNaN(t)) return { status: 'old-format' };
    const weeks = Math.floor((Date.now() - t) / (7 * 86400000));
    if (weeks < 3) return { status: 'pending', weeks: Math.max(weeks, 0) };
    const baseItem = (App.data.menu_items || []).find(i => i.id === entry.item_id);
    // ⚠ NO `|| baseItem.cost` (S111). That fell back to the STORED save-time snapshot in exactly
    // the case menuItemCost had just refused to price — re-fabricating the number the null exists
    // to prevent. Inert today because the arithmetic below reads `entry.cost` and `item` is used
    // only for weekly_covers, which is precisely why it is a trap: the next edit to reach for
    // `item.cost` inherits a stale figure silently.
    const item = baseItem ? { ...baseItem, cost: App.menuItemCost(baseItem) } : null;
    if (!item || item.weekly_covers == null) return { status: 'no-item' };
    const coversThen = entry.covers_at_change, coversNow = item.weekly_covers;
    if (!coversThen) return { status: 'no-baseline' };
    const oldCM = entry.old_price - entry.cost, newCM = entry.new_price - entry.cost;
    return {
      status: 'ok', weeks: weeks, coversThen: coversThen, coversNow: coversNow,
      volPct: (coversNow - coversThen) / coversThen * 100,
      actualWeekly: newCM * coversNow - oldCM * coversThen,
      predicted: entry.predicted_weekly_impact != null ? entry.predicted_weekly_impact : null
    };
  },

  logRow(entry) {
    const v = this.verify(entry);
    let vCell;
    if (v.status === 'ok') {
      /* ⚠ A RAISE THAT LOST VOLUME IS THE ROW THIS LOG EXISTS TO SURFACE, and it was the one
         printing "$-312.00/wk actual" — fmtCurrency is '$' + v. Both figures carry the minus
         outside the $ now, and the tone follows the same ROUNDED sign as the text it colours,
         so a wash cannot read red off floating-point residue. */
      const actSign = App.fmtSigned(v.actualWeekly, 2).sign;
      const tone = actSign < 0 ? 'var(--red)' : 'var(--gold)';
      const pred = v.predicted != null
        ? 'predicted ' + (App.fmtSigned(v.predicted, 2).sign > 0 ? '+' : '') + App.fmtBal(v.predicted) + '/wk'
        : 'no prediction on file';
      vCell = '<div style="font-weight:700;color:' + tone + ';">'
        + (actSign > 0 ? '+' : '') + App.fmtBal(v.actualWeekly) + '/wk actual</div>'
        + '<div style="font-size:10px;color:var(--t3);">sold ' + v.coversThen + ' to ' + v.coversNow + ', ' + pred + '</div>';
    } else if (v.status === 'pending') {
      vCell = '<span style="color:var(--t3);">Measuring, week ' + v.weeks + ' of 3</span>';
    } else if (v.status === 'no-cost') {
      // Say WHY rather than a bare "Not verifiable": the operator can act on this one.
      vCell = '<span style="color:var(--t3);">Not costed when the price changed, so the result cannot be measured</span>';
    } else {
      vCell = '<span style="color:var(--t4);">Not verifiable</span>';
    }
    return '<tr><td>' + (entry.date || '').slice(0, 10) + '</td>'
      + '<td><div class="val">' + esc(entry.item_name || '') + '</div></td>'
      + '<td>' + App.fmtCurrency(entry.old_price) + '</td>'
      + '<td>' + App.fmtCurrency(entry.new_price) + '</td>'
      + '<td colspan="3" style="font-size:11px;">' + vCell + '</td></tr>';
  },

  reviewLogHtml() {
    // Newest price change first. `.reverse()` did that when this was a blob insertion-order
    // array; it is row-per-record now and loads newest-first, so reversing showed the OLDEST
    // entries — and past 50 rows the just-made reprice fell off the visible page entirely.
    const log = (App.data.revenue_price_log || []).slice().sort(App.cmpNewest);
    const rows = log.slice(0, App.listLimit('core', 'revenue_price_log')).map(e => this.logRow(e)).join('')
      || '<tr><td colspan="7" style="color:var(--t4);text-align:center;padding:22px;">No price changes logged yet. Reprice an item above and it lands here, verified against the real result after three weeks.</td></tr>';
    return '<div class="sh" style="margin:24px 0 10px;">Pricing Review Log</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:18%;"/><col style="width:16%;"/><col style="width:14%;"/><col style="width:13%;"/><col style="width:13%;"/><col style="width:13%;"/><col style="width:13%;"/></colgroup>'
      + '<thead><tr><th>Date</th><th>Item</th><th>Old Price</th><th>New Price</th><th colspan="3">Verification</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('core', 'revenue_price_log', log, false);
  }
};
