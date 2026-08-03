'use strict';

/* ── Inventory Control — Products (master product list: ic_products) ──────────
   ic_products is the platform-wide product master. Profit Recovery Bar Products
   and Kitchen Products read from it. Stored in App.inventoryData (ic_data table,
   Rule 21) — saved via App.saveInventory().

   Category-first entry: the operator lands on six big category cards (Liquor,
   Wine, Bottle Beer, Draft Beer, Food, Misc). Picking a card opens a form
   tailored to that category with the right field labels (Bottle Size, Keg
   Size, Cost per Case, Unit Type), the right defaults, and only the fields
   that matter. Edit reopens the same category's form. CSV import is per
   category so the column schema matches what's actually being imported. */

S.InventoryProducts = {
  editId: null,
  _saving: false,
  _pendingDelIds: null,
  _formCategory: null,     // category being entered/edited in the open form
  activeCat: 'Liquor',     // list filter for the existing-products table
  _selected: null,         // Set of product ids checked for bulk delete
  _dismissedAlerts: null,  // Set of categories whose incomplete-data bar was dismissed

  get CATEGORIES() { return App.IC_CATEGORIES; },   // single source on App
  // The one extra tab after the real categories. Named to match the action (Make Inactive) and the
  // list badge (Inactive) — deliberately NOT "Archived", which is ic-locations' vocabulary.
  // Held as a constant so the string is never spelled out in the filter, the tab bar and the
  // click handler separately.
  INACTIVE_TAB: 'Inactive',

  // What the current tab should list. Inactive products LEAVE the working category tabs and live in
  // the Inactive tab instead — Kyle's call 2026-07-21, over a per-category section: you will not
  // remember whether something was Food or Misc, Delete Permanently belongs in one labelled place
  // rather than scattered across six tabs you use for routine edits, and archiving 100 mis-imported
  // wines should leave every working tab clean.
  visibleProducts() {
    const all = this.products();
    return this.activeCat === this.INACTIVE_TAB
      ? all.filter(p => p && p.active === false)
      : all.filter(p => p && this._tabFor(p) === this.activeCat && p.active !== false);
  },

  // ⚠ THE ONE DOOR FOR "WHICH TAB DOES THIS PRODUCT BELONG ON" (S124). Both the tab filter above
  // and the category CARD counts used a bare `(p.category || '') === c`, so an ACTIVE product whose
  // category is missing, '' or a legacy value ('Beer') was listed by NO tab and counted by NO card
  // — invisible on both axes, and therefore impossible to edit or delete from this screen. (The
  // INACTIVE tab would still have shown it, since that one filters on `active === false` alone.)
  // Nothing in this screen creates one — showForm coerces the category, runImport sets the tab's —
  // so it is a restore / legacy-data hazard; but "structurally unable to show it" has no way out.
  // Misc is the catch-all category by design, so anything unrecognised lands there. Card and tab
  // share this door so they cannot disagree, which is what keeps the S53 three-way tie-out true.
  _tabFor(p) {
    const c = (p && p.category) || '';
    // `this.CATEGORIES` is the screen's getter onto App.IC_CATEGORIES (:24) — the single source.
    // There is no `this.IC_CATEGORIES`; reaching for it throws on every render.
    return this.CATEGORIES.indexOf(c) > -1 ? c : 'Misc';
  },

  // Per-category form spec: labels, defaults, which fields show.
  // The single renderForm() method reads this to assemble each form.
  FORM_SPEC: {
    'Liquor': {
      title:           'Liquor',
      noun:            'Bottle',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Spirits',
      defaultSize:     25.4,
      showPour:        true,
      pourLabel:       'Pour Size',
      defaultPour:     1.5,
      priceLabel:      'Pour Price',
      costLabel:       'Cost per Bottle',
      costTT:          'ic-cost-per-bottle',
      sizeTT:          'ic-bottle-size',
      pourTT:          'ic-liquor-pour',
      priceTT:         'ic-liquor-pour-price',
      calc1Label:      'Pours / Bottle',
      calc2Label:      'Cost / Pour',
      servingPlaceholder:'Double, Happy Hour',
      servingTT:       'ic-serving-sizes-liquor',
      parUnit:         'btls',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:true
    },
    'Wine': {
      title:           'Wine',
      noun:            'Bottle',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Wine',
      defaultSize:     25.4,
      showPour:        true,
      pourLabel:       'Glass Size',
      defaultPour:     5,
      priceLabel:      'Glass Price',
      costLabel:       'Cost per Bottle',
      costTT:          'ic-cost-per-bottle',
      sizeTT:          'ic-bottle-size',
      pourTT:          'ic-wine-glass-size',
      priceTT:         'ic-wine-glass-price',
      calc1Label:      'Glasses / Bottle',
      calc2Label:      'Cost / Glass',
      servingPlaceholder:'Bottle, Split',
      servingTT:       'ic-serving-sizes-wine',
      parUnit:         'btls',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:true
    },
    'Bottle Beer': {
      title:           'Bottle Beer',
      noun:            'Case',
      // Bottle beer is tracked by the case / individual bottle only — the bottle's
      // oz size is never used in any cost or count, so there is no size field.
      sizeLabel:       null,
      sizeGroup:       null,
      defaultSize:     null,
      showPour:        false,
      priceLabel:      'Price per Bottle',
      costLabel:       'Cost per Case',
      costTT:          'ic-cost-per-case',
      priceTT:         'ic-beer-bottle-price',
      calc1Label:      'Btls / Case',
      calc2Label:      'Cost / Btl',
      parUnit:         'cases',
      showMenuPrice:   true,
      showCaseSize:    true,
      defaultCaseSize: 24,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:false
    },
    'Draft Beer': {
      title:           'Draft Beer',
      noun:            'Keg',
      sizeLabel:       'Keg Size',
      sizeGroup:       'Draft Keg',
      defaultSize:     1984,
      showPour:        true,
      pourLabel:       'Pour Size',
      defaultPour:     16,
      priceLabel:      'Pour Price',
      costLabel:       'Cost per Keg',
      costTT:          'ic-cost-per-keg',
      sizeTT:          'ic-keg-size',
      pourTT:          'ic-draft-pour',
      priceTT:         'ic-draft-pour-price',
      calc1Label:      'Pours / Keg',
      calc2Label:      'Cost / Pour',
      servingPlaceholder:'Pitcher, 12 oz',
      servingTT:       'ic-serving-sizes-draft',
      parUnit:         'kegs',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:true
    },
    'Food': {
      title:           'Food Item',
      noun:            'Unit',
      sizeLabel:       null,
      sizeGroup:       null,
      showPour:        false,
      costLabel:       'Cost per Unit',
      costTT:          'ic-cost-per-unit',
      parUnit:         'units',
      showMenuPrice:   false,
      showCaseSize:    false,
      showUnitType:    true,
      showPackSize:    true,
      defaultUnitType: 'lb',
      showCalcStrip:   false,
      showServingSizes:false
    },
    'Misc': {
      title:           'Misc Item',
      noun:            'Unit',
      sizeLabel:       null,
      sizeGroup:       null,
      showPour:        false,
      costLabel:       'Cost per Unit',
      costTT:          'ic-cost-per-unit',
      parUnit:         'units',
      showMenuPrice:   false,
      showCaseSize:    false,
      showUnitType:    true,
      showPackSize:    true,
      defaultUnitType: 'each',
      showCalcStrip:   false,
      showServingSizes:false
    }
  },


  SIZES: [
    {g:'Spirits',l:'50ml (1.7 oz)',oz:1.7},{g:'Spirits',l:'200ml (6.8 oz)',oz:6.8},
    {g:'Spirits',l:'375ml (12.7 oz)',oz:12.7},{g:'Spirits',l:'750ml (25.4 oz)',oz:25.4},
    {g:'Spirits',l:'1L (33.8 oz)',oz:33.8},{g:'Spirits',l:'1.75L (59.2 oz)',oz:59.2},
    {g:'Wine',l:'187ml (6.3 oz)',oz:6.3},{g:'Wine',l:'375ml (12.7 oz)',oz:12.7},
    {g:'Wine',l:'750ml (25.4 oz)',oz:25.4},{g:'Wine',l:'1.5L (50.7 oz)',oz:50.7},
    {g:'Beer',l:'12 oz',oz:12},{g:'Beer',l:'16 oz',oz:16},{g:'Beer',l:'22 oz bomber',oz:22},
    {g:'Beer',l:'32 oz crowler',oz:32},{g:'Beer',l:'40 oz',oz:40},
    {g:'Draft Keg',l:'1/6 keg (661 oz)',oz:661},{g:'Draft Keg',l:'1/4 keg (992 oz)',oz:992},
    {g:'Draft Keg',l:'1/2 keg (1984 oz)',oz:1984},{g:'Other',l:'Custom (enter oz)',oz:null}
  ],

  /* ⚠⚠ A DISTRIBUTOR'S SIZE COLUMN IS METRIC, AND IT WAS STORED AS OUNCES VERBATIM.
     `container_size_oz` took `App.parseNum`, which strips the unit and keeps the number — so a
     Southern Glazer / RNDC / Breakthru order guide reading "750ML" stored a **750-OUNCE BOTTLE**:
     500 pours instead of 16.9, a $28 bottle costing $0.056 a pour instead of $1.656, and a
     **0.6% pour cost against a true 18.4%** — rendered GREEN, with `isComplete()` returning true so
     nothing flagged it. "1.75L" made the opposite error, 1.75 oz, at 428%.
     It reaches theoretical usage, theoretical sales, the Variance Report, Menu Engineering and COGS,
     so a bar that poured three bottles reads 1,500 pours made instead of 50.8.
     ⚠ The manual form never had this bug because it uses a size DROPDOWN (SIZES above, already in
     ounces). The import is the only door that can put a raw metric string in the field.
     Explicit units only — this converts what the file SAYS and never guesses at a bare number. */
  /* ⚠⚠ IT DELEGATES TO `App.ozPerUnit`, WHICH ALREADY EXISTED. The first version hand-rolled ml/cl/L
     here — a second unit table 5,300 lines from the real one — and immediately proved why that is a
     mistake: it did not know **LTR**, which is what every distributor order guide actually prints,
     so a "1.75LTR" handle still read as 1.75 OUNCES (the exact 34x bug this function was written to
     kill, surviving under the commonest spelling). It also knew nothing of gal/qt/pt/cup, which
     `App.ozPerUnit` has carried all along, so "5.16 gal" read as 5.16 oz at a 4,872% pour cost.
     One table. Formats added there are gained here for free, and vice versa.
     ⚠ A CELL WITH TWO NUMBERS IS REFUSED, NOT GUESSED. "12/750ML" is pack-times-size, and
     `App.parseNum` concatenates digit runs — its own doc says it will not unpick a two-number cell —
     so it produced 12750 and this function turned that into **431 oz: a plausible 13% pour cost that
     renders GREEN**. That is worse than the raw 0.4% it replaced, which at least looked absurd.
     Refusing leaves the row Incomplete, which is the honest state and the one the operator can act
     on. */
  _sizeToOz(raw) {
    /* A hyphen between the number and its unit is just punctuation ("750-ML", "12-OZ"), but it made
       the unit unreadable AND made App.parseNum see a trailing minus, so the size was lost entirely.
       ⚠ IT IS REWRITTEN ONLY WHEN THE LETTERS ARE A UNIT THIS APP RECOGNISES. Rewriting every
       `<digits>-<letters>` turned **"12-PACK" into a 12-OUNCE container** — 8 pours from a case, a
       38.9% pour cost that `isComplete()` called true and the list rendered GREEN. `6-PK` gave
       77.8%, `4-PK` gave 116.7%. That is the same "plausible wrong answer" failure the two-number
       refusal below exists to prevent, arriving from the other side. A pack descriptor is not a
       size, so it stays unreadable and the row stays Incomplete. */
    const s0 = String(raw == null ? '' : raw).trim().toLowerCase();
    /* ⚠ THE LOOKAHEAD TAKES UP TO TWO WORDS, because a unit can be two ("fl oz"). Capturing one
       word made `16-FL OZ` read `fl`, which `ozPerUnit` does not know — so the hyphen survived,
       `App.parseNum` saw a trailing minus, and the negative guard below refused the whole cell.
       A 16 oz bottle imported with NO SIZE. */
    const known = w => App.ozPerUnit && App.ozPerUnit(String(w).trim()) != null;
    const s = s0.replace(/(\d)\s*-\s*(?=([a-z]+(?:\s+[a-z]+)?))/g, (mm, d, word) => {
      const one = String(word).split(/\s+/)[0];
      return (known(word) || known(one)) ? d + ' ' : mm;
    });
    if (!s) return null;
    /* ⚠ KEG FRACTIONS FIRST, because they are two numbers and the guard below would refuse them.
       "1/2 keg", "1/6 bbl" and "1/4 barrel" are how a draft size is normally written, and every one
       was landing Incomplete. The ounce figures are the SIZES table's own (1/2 = 1984, 1/4 = 992,
       1/6 = 661), so the import and the dropdown cannot disagree. */
    /* ⚠ `[-\s]*`, NOT `\s*`. `App.ozPerUnit` does not know "bbl" or "keg" (kegs live in the table
       below, not in the shared unit map), so the hyphen rewrite above deliberately leaves them
       alone — and a space-only keg pattern then could not match `1/2-BBL`, ordinary draft notation.
       The cell fell through to the two-number refusal and every hyphenated keg landed Incomplete
       with no pour cost and no theoretical usage. */
    const keg = s.match(/^(\d)\s*\/\s*(\d)[-\s]*(?:bbl|barrel|keg)\b/);
    if (keg) { const KEG = { '1/2': 1984, '1/4': 992, '1/6': 661 }; const oz = KEG[keg[1] + '/' + keg[2]]; if (oz) return oz; }
    if ((s.match(/[\d][\d,]*(?:\.\d+)?/g) || []).length > 1) return null;   // pack x size — ambiguous
    const n = App.parseNum(s);
    if (n == null) return null;
    /* ⚠ A NEGATIVE SIZE IS NEVER A SIZE, and this refuses it HERE rather than leaning on the
       caller's `nonNeg`. "12-PACK" keeps its hyphen (a pack descriptor is not a unit), which makes
       App.parseNum read a trailing minus and hand back -12 — so the function's own answer must be
       null. Leaving that to the one call site meant any second caller would inherit the bug. */
    if (n < 0) return null;
    const m = s.match(/[\d.]\s*([a-z]+)/);                   // the unit token attached to the number
    const per = (m && App.ozPerUnit) ? App.ozPerUnit(m[1]) : null;
    if (per == null) return n;                               // no unit, or one we do not convert: already ounces
    return Math.round(n * per * 10) / 10;                    // matches the SIZES table's precision
  },

  /* A PACK COLUMN'S LEADING NUMBER IS THE COUNT. `parseInt` used to read it and the switch to
     `App.parseNum` REGRESSED every slash-pack cell: "24/12 OZ" became **2412**, so a $28.80 case of
     beer priced at **$0.0119 a bottle** instead of $1.20 — a 100x understatement feeding
     `App.bottleCost`, COGS, variance dollars, stock value and the books valuation. The switch was
     made to win "1,000 count" (which parseInt read as 1); this reads the first NUMBER RUN, so it
     wins both — commas stay inside the run, a slash ends it. */
  _packCount(raw) {
    const s = String(raw == null ? '' : raw);
    /* ⚠ `#10` IS A CAN SIZE, NOT A COUNT. Reading the first number run accepted "#10 can" as ten,
       so a $28.80 case priced at $2.88 a unit — and BOTH predecessors refused it (`parseInt` gave
       NaN, `App.parseNum` has a `#` guard for exactly this family, which is also what keeps
       `#REF!` / `#N/A` out). "6/#10 CAN" is still 6, because there the count comes first. */
    /* ⚠ ONLY A CAN-SIZE `#`, not every `#`. Refusing any leading hash also threw away `"#24"` and
       `"#12/CS"`, where `#` is ordinary shorthand for "number of" on a hand-built case-size column —
       the product then landed Incomplete with no bottle cost at all. A can size is the hash followed
       by a small number AND a can/pail word; `"#10 can"` is refused, `"#24"` is twenty-four. */
    // ⚠ CASE-INSENSITIVE AND PLURAL-TOLERANT. Without the `i` flag and the `s?`, only the exact
    // lowercase singular was caught — and a distributor order guide prints "#10 CAN" and "#5 PAIL"
    // in CAPS. `#10 CAN` came back as a count of ten, so a $28.80 can priced at $2.88 a unit.
    if (/^\s*#\s*[\d.]+\s*(?:can|pail|tin|jug)s?\b/i.test(s)) return null;
    const m = s.match(/[\d][\d,]*(?:\.\d+)?/);
    return m ? App.parseNum(m[0]) : null;
  },

  /* ⛔ A KEG VOLUME IS A FACT THE FILE CARRIES, NOT A GUESS ABOUT IT (Kyle, chat 27,
     after a draft beer EXPORT landed 17 of 18 rows in Not Sorted Yet).
     Beer STYLES are deliberately unreadable — an IPA is a keg or a case and the style
     cannot say which — and that rule is what protects a mixed beer list. The cost of it
     was that a file with NOTHING but styles sorted nothing at all. An order guide writes
     "1/2 BBL", which the vocabulary already reads; an EXPORT writes the same fact as
     `1984`, and that is the form nothing could see.
     Nothing else in a bar comes in 661, 992 or 1984 ounces, so reading it is not
     inference. ⚠ THE VOLUMES COME FROM `SIZES`, never a list typed here: a keg size
     added to the app's own table is gained by this rule for free, and the dropdown can
     never offer a size the importer refuses to recognise.
     ⚠ `_sizeToOz` IS the validator, exactly as it is for the size fallback: it refuses
     two-number cells and pack descriptors by design, so "12-PACK" and "24/12 oz CAN"
     cannot reach a keg answer however they are spelled. */
  _kegOzList() {
    return (this.SIZES || []).filter(s => s.g === 'Draft Keg' && s.oz > 0).map(s => s.oz);
  },
  _isKegSize(raw) {
    const oz = this._sizeToOz(raw);
    return oz != null && this._kegOzList().indexOf(oz) > -1;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  isPourable(cat) { return cat !== 'Food' && cat !== 'Misc'; },

  // Location is NOT part of completeness — a product is assigned to locations on
  // Set Locations, and a missing one is surfaced as a "Needs a location" nudge in
  // the list rather than blocking the product. Primary location auto-derives from
  // the first location it's placed in.
  isComplete(p) {
    if (!p.name || p.unit_cost == null || p.unit_cost === '') return false;
    if (p.category === 'Bottle Beer') return !!p.case_size;
    if (this.isPourable(p.category)) return !!(p.container_size_oz && p.pour_size_oz && p.menu_price);
    return true;
  },

  products() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_products)) App.inventoryData.ic_products = [];
    return App.inventoryData.ic_products;
  },


  vendorOpts(sel) {
    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let h = '<option value="">Select vendor...</option>';
    vendors.forEach(v => {
      h += '<option value="' + esc(v.name) + '"' + (sel === v.name ? ' selected' : '') + '>' + esc(v.name) + '</option>';
    });
    if (sel && !vendors.some(v => v.name === sel)) {
      h += '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (unsaved)</option>';
    }
    return h;
  },

  locationOpts(sel) {
    const locs = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived)
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let h = '<option value="">Select location...</option>';
    locs.forEach(l => {
      h += '<option value="' + esc(l.name) + '"' + (sel === l.name ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    });
    if (sel && !locs.some(l => l.name === sel)) {
      h += '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (unsaved)</option>';
    }
    return h;
  },

  // The list_config key for a size group (empty for Food/Misc, which have no group).
  _sizeKey(group) {
    return { 'Spirits': 'size_spirits', 'Wine': 'size_wine', 'Beer': 'size_beer', 'Draft Keg': 'size_draft' }[group] || '';
  },
  // Register a size group's built-in options (oz-valued) with the shared list
  // system so the Edit editor + dropdown read them. Returns the key.
  _registerSizeList(group) {
    const key = this._sizeKey(group);
    if (!key) return '';
    App._listMeta[key] = { valued: true };
    App._listBuiltins[key] = this.SIZES.filter(s => s.g === group && s.oz != null).map(s => ({ label: s.l, v: s.oz }));
    return key;
  },
  // Size dropdown scoped to the form's category group, driven by the operator's
  // editable list (built-ins + added minus hidden). The currently saved size stays
  // selectable even if it was later hidden/removed, so a product never orphans.
  // Each custom option carries its name in data-name so save can store the label.
  sizeOpts(sel, group) {
    const key = this._registerSizeList(group);
    let h = '<option value="">Select size...</option>';
    const items = key ? App.listValuedOptions(key) : [];
    const selN = (sel != null && sel !== '' && sel !== 'custom') ? parseFloat(sel) : null;
    if (selN != null && !isNaN(selN) && !items.some(it => it.v === selN)) items.push({ label: selN + ' oz', v: selN, name: '' });
    items.sort((a, b) => a.v - b.v);
    items.forEach(it => {
      h += '<option value="' + it.v + '"' + (it.name ? ' data-name="' + esc(it.name) + '"' : '')
        + (selN != null && it.v === selN ? ' selected' : '') + '>' + esc(it.label) + '</option>';
    });
    return h;
  },


  // ── In-place custom cells (size / unit) ─────────────────────────────────────
  // Both cells carry a "| Edit" link that opens the shared list editor (add /
  // remove / hide / reset). Sizes are an oz-valued list; Unit Type is a plain list.
  _sizeCellHtml(spec, sizeSel) {
    const key = this._sizeKey(spec.sizeGroup);
    return '<div class="f" style="width:180px;flex-shrink:0;"><label>' + esc(spec.sizeLabel) + (key ? App.manageListLink(key) : '') + '</label>'
      + '<select id="ip-size" class="cs-select"' + (key ? ' data-cs-key="' + key + '"' : '') + '>' + this.sizeOpts(sizeSel, spec.sizeGroup) + '</select>'
      + '</div>';
  },
  _unitCellHtml(ut) {
    return '<div class="f" style="width:160px;flex-shrink:0;"><label>Unit Type' + App.manageListLink('unit_type') + '</label>'
      + App.customSelect({ id: 'ip-unit', key: 'unit_type', builtin: App.IC_FOOD_UNIT_TYPES, selected: ut, blank: true, blankLabel: 'Select unit...' }) + '</div>';
  },

  // ── Entry point ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this._selected = null;   // fresh entry starts with nothing selected
    this.renderLanding();
  },

  // Page directions for the nav "i" (see [[help-model]]). Covers single entry
  // AND the per-category CSV / Excel upload flow.
  showHowTo() {
    App.showHelpModal('How Add Products Works', [
      { p: ['Add Products is your master product list. Everything Bar Cop costs, counts, orders, and reports reads from here, so a complete product list is the best hour of setup you can put into Bar Cop. Get it right once and every count sheet, order, and pour cost downstream is right too.'] },
      { h: 'Start With A Category', p: ['Pick one of the six category cards on top: Liquor, Wine, Bottle Beer, Draft Beer, Food, Misc. Each opens a form built for that category with the right fields and labels: bottle size and pour for liquor, glass for wine, case size for bottle beer, keg size for draft, a unit type for food and misc. Add one product at a time, or upload a whole list.'] },
      { h: 'What Makes A Product Complete', p: ['Every product needs a name and a cost. Anything you pour (liquor, wine, draft) also needs its container size, pour size, and menu price so Bar Cop can figure pours per container, cost per pour, and pour cost percent. For example, a 750ml bottle of well vodka at 25.4 oz, poured at 1.5 oz, gives you about 17 pours per bottle. Bottle beer just needs its case size, the number of bottles in a case, since it is tracked by the case and the individual bottle. A product missing a required field shows as Incomplete in red until you finish it. A complete product can still read Needs a location in red until you place it on a shelf over in Set Locations; it will not show up on a count sheet until it lives somewhere.'] },
      { h: 'Bottle Beer Is By The Case', p: ['Bottle beer is bought, costed, and counted by the case, the same way liquor is the bottle and draft is the keg. Enter the cost per case and the case size, say 24 for a case of Modelo, and Bar Cop works out the per-bottle cost for the menu side on its own. You never track loose bottles as the unit; the case is the unit.'] },
      { h: 'Food and Misc: How You Track It', p: ['Food and Misc pick a Unit Type (how you buy it: the pound, case, bag, each, gallon, or your own word), then a Track By, which is the one thing that decides how Bar Cop counts and costs it. Three ways. By the unit: you weigh or count whole units, like ground beef by the pound (count 11.42 lb), and recipes pull pounds. By pieces: one unit breaks into pieces, like a bag of 45 wings or a pound sliced into 16 bacon slices; you count full units plus loose pieces and recipes pull pieces. By ounces: a liquid measured by the ounce, like oil or syrup; a gallon fills in 128 for you, your own units you type the ounces, and recipes pull ounces. The same unit can go either way, which is the point: buy bacon by the pound but Track By pieces. Pick it once and the count sheet, the cost, and the recipe all line up. Serving sizes and prices are the menu side and live in the Menu Builder.'] },
      { h: 'Sold On The Menu (Food and Misc)', p: ['Most Food and Misc products are things you cook or clean with, not sell straight. But some you do sell as-is: a bag of chips, a bottled soda, a canned non-alcoholic drink. For those, tick Non prep menu item in the Sold on the Menu section at the bottom of the form. That lists the product in the Menu Builder as a No Prep item, so you can add it to a menu section with its own price. Leave it off for raw ingredients and supplies so they stay out of the menu picker. Beer and wine are always available on the menu, so they carry no tick.'] },
      { h: 'Other Pour Sizes Sold', p: ['The standard serving and its menu price live up top. If a product also sells another way, a pitcher, a happy hour pour, a whole bottle of wine, add it under Other Pour Sizes Sold with its own price and Bar Cop shows that size its own pour cost. A thinner happy hour price reads its own honest margin instead of hiding inside the standard pour.'] },
      { h: 'Uploading A List', p: ['Each category card has an Upload option for bringing in a whole list at once from a CSV or Excel file: a POS export, a distributor order guide, or your own spreadsheet. The first row is your column headers, one product per row. Starting from a category card just tells Bar Cop what to expect, so the columns it offers match that category. It is not locked to it. Every import then stops on one more screen, where you check where each product is going before anything is added.'] },
      { h: 'Matching Your Columns', p: ['Only Product Name is required; everything else is optional and can be filled in after. Your headers do not need to match exactly. After you drop the file, Bar Cop shows the columns it found, auto-matched to each field, with a preview of your first rows so you can confirm it lined them up right. Fix any that are wrong, set ones you want to ignore to Skip, then Import. Any row missing required data comes in as Incomplete so you can finish it later.'] },
      { h: 'Checking Where Everything Goes', p: ['A distributor order guide is one file with kegs and cases in it, and an export from another program is usually one file with everything in it. So once the columns are matched, every import stops here: Bar Cop lists every product it found and shows you where each one is going before anything is written. It is the same screen and the same press whether the file sorted itself perfectly or not, which is also your chance to drop anything you no longer carry. The ones it has already worked out sit in a closed section per category, with the count on the section, so you can open one and check it. Anything it could not work out sits at the top, open, and that is the only part you have to do.', 'Bar Cop fills in whatever the product name or a column in your file settles on its own. Bourbon, Vodka and Gin are Liquor, and it knows the common spirit and wine brands by name. It leaves a beer style alone on purpose, because an IPA can be a keg or a case and the file does not say which, and it would rather ask than put your product in the wrong place. Tick the ones it left, pick a category, and press Move To. Every row also has a Remove button, for the section headings and subtotal lines an order guide is full of.', 'If the file turns out to be all one category, like a draft list or a wine list, anything Bar Cop cannot read on its own goes to the card you started from, because that is the answer you already gave it. When the file holds several categories it never does that: what it cannot place stays at the top for you.', 'If your file does not name a supplier, Bar Cop asks once and puts that vendor on every product it adds that does not already name one, and adds them to your vendor list so you can order from them. Nothing is written to your account until you press Add, and that button says exactly how many products are coming in.'] },
      { h: 'Bulk Edit Many At Once', p: ['After an upload you often need the same value across a whole category: a 1.5 oz pour on every liquor, one vendor or storage location across a list, the same par. Check the products you want, or use Select All on the category tab, then tap Bulk Edit. Turn on only the fields you want to change, set each value, and Apply. Bar Cop writes those fields to every selected product at once and leaves everything else untouched, then refigures pours per container, cost per pour, and pour cost percent for each one. Anything that was Incomplete and now has what it needs clears its flag.'] },
      { h: 'Hiding A Product', p: ['When you Edit a product, the status across from the title reads ACTIVE or INACTIVE. Hit Hide from operations to pull a seasonal pour or a discontinued item out of counts, orders, and the menu side without throwing away its history, then Update to commit. An inactive product moves to the Inactive tab after Misc, so your category lists stay clean; open it there and Make active brings it back.'] }
    ]);
  },

  // ── Landing: six category cards on top, filterable list below ────────────
  renderLanding() {
    const all = this.products();
    // ⚠ THE SELECTION MAY ONLY EVER HOLD ROWS THAT ARE ON SCREEN, and it is enforced
    // here rather than at each action so a new door cannot reintroduce it. Make Inactive
    // moves products off the working tab while the operator stays on that tab, and the
    // selection used to survive it: the toolbar kept offering "Delete 5 Selected" with
    // nothing ticked, and the next click acted on five records with no visible
    // representation on the page. (Switching tabs already clears the selection outright,
    // so "visible" is exactly visibleProducts().) This cannot fight confirmDel's
    // deliberate keep-the-failures-selected retry: a product whose delete was REFUSED is
    // still present and still rendered, so it survives the prune.
    if (this._selected && this._selected.size) {
      const onScreen = new Set(this.visibleProducts().map(p => p.id));
      [...this._selected].forEach(id => { if (!onScreen.has(id)) this._selected.delete(id); });
    }
    // Short, category-specific labels for the per-card upload button.
    const UPLOAD_LABEL = { 'Liquor': 'Liquor', 'Wine': 'Wine', 'Bottle Beer': 'Btl Beer', 'Draft Beer': 'Draft', 'Food': 'Food', 'Misc': 'Misc' };
    const cards = this.CATEGORIES.map(c => {
      // ⚠ ACTIVE ONLY, matching the tab and the list. Three numbers on this one screen
      // describe the same category — this card, the tab below it (catTabs) and the rows
      // themselves (visibleProducts) — and the active-only rule had been applied to the
      // last two and not to the cards, so a bar that archived one liquor saw a card
      // reading 35, a tab reading 34, and 34 rows.
      // The incomplete count is the worse half: it counted archived products too, while
      // the alert bar under the tabs is built from visibleProducts. So an archived,
      // incomplete product made the card advertise "1 incomplete" that no working tab
      // could list and no alert mentioned — sending the operator hunting for a product
      // the screen is structurally unable to show them.
      // Same door as the tab filter (S124), so a card can never advertise a count the tab beneath
      // it cannot list — that is the S53 tie-out, and a catch-all would break it otherwise.
      const n = all.filter(p => this._tabFor(p) === c && p.active !== false).length;
      const incomplete = all.filter(p => this._tabFor(p) === c && p.active !== false && !this.isComplete(p)).length;
      const incText = incomplete > 0
        ? '<div style="font-size:10px;color:var(--t4);margin-top:6px;">' + incomplete + ' incomplete</div>'
        : '';
      return '<div class="ip-card" data-cat="' + esc(c) + '" '
        + 'style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:22px 18px 20px;text-align:center;">'
        + '<div style="font-size:17px;font-weight:800;color:var(--t1);letter-spacing:0.3px;margin-bottom:4px;">' + esc(c) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + n + ' product' + (n === 1 ? '' : 's') + '</div>'
        + incText
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:18px;">'
          + '<span class="ip-card-add" data-cat="' + esc(c) + '" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">+ Add Single Product</span>'
          + '<span style="font-size:10px;color:var(--t4);letter-spacing:1px;">or</span>'
          + '<button type="button" class="ip-card-imp" data-cat="' + esc(c) + '" style="background:none;border:1px solid var(--b1);border-radius:4px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;cursor:pointer;">Upload ' + esc(UPLOAD_LABEL[c] || c) + ' List</button>'
        + '</div>'
        + '</div>';
    }).join('');

    const cardsBlock = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">'
      + cards + '</div>';

    // Existing-products table, filtered by activeCat. Tabs flip the filter.
    // One door: the working tabs list ACTIVE products of that category, the Inactive tab lists every
    // inactive product whatever category it came from. See visibleProducts.
    const prods = this.visibleProducts();
    const onInactiveTab = this.activeCat === this.INACTIVE_TAB;
    const target = App.data?.settings?.targets?.bar_pour_cost_pct ?? 22;
    // ⚠ ACTIVE ONLY (S123). On the Inactive tab `prods` is every archived product, so this alert
    // counted retired products as a problem — the same active-only rule the tab counts and the row
    // flags already follow.
    const incompleteHere = prods.filter(p => p.active !== false && !this.isComplete(p));

    const tabs = this.catTabs();

    const spec = this.FORM_SPEC[this.activeCat];
    const isFoodMisc = (this.activeCat === 'Food' || this.activeCat === 'Misc');
    const isBottleBeer = this.activeCat === 'Bottle Beer';
    const sizeCol = isFoodMisc ? 'Unit' : (isBottleBeer ? 'Case Size' : ((spec && spec.sizeLabel) || 'Container'));
    // Column headers + fixed colgroup, shared by the populated list AND the empty
    // state so the headers always show and the empty message sits in the data row.
    // Food / Misc show recipe-costing columns; Bottle Beer drops the Pour column
    // (tracked by the case, never poured); poured drinks keep size + pour.
    // ⚠ The INACTIVE tab gets its own category-agnostic layout, and it must, because it
    // is the one tab that holds products from EVERY category at once. The headers here
    // are chosen from `this.activeCat` while each row's cells are chosen from
    // `p.category` in _productRowHtml — on a working tab those are the same value so they
    // always agree, but on the Inactive tab activeCat is 'Inactive', which is neither
    // Food/Misc nor Bottle Beer, so this used to fall through to the poured-drinks
    // header while the rows still emitted their own category's cells. A Bottle Beer row
    // came out one cell short, shifting every column left so Edit/Delete rendered under
    // "Par", and a Food row's recipe cost printed under a "Cost %" header — a dollar
    // figure beneath a percent heading. Per-category columns are meaningless on a
    // cross-category list anyway, so it shows what all products share.
    // ⚠ NO Category column: the rows are already GROUPED into category sections on this
    // tab, so a per-row category repeats the heading above it (Kyle 2026-07-21). Same
    // reason there is no "Inactive" badge on the name — every row here is inactive.
    // Size IS worth a column and is read per ROW, since the categories are mixed here:
    // a container size for pourables, the case size for bottle beer, the unit for
    // food/misc.
    const headerCols = onInactiveTab
      ? '<th>Vendor</th><th>Size</th><th>Cost</th><th>Par</th><th></th>'
      : isFoodMisc
      ? '<th>Vendor</th><th>Unit</th><th>Per Unit</th><th>Cost/Unit</th><th style="white-space:nowrap;">Recipe Cost</th><th>Par</th><th></th>'
      : isBottleBeer
        ? '<th>Vendor</th><th>Case Size</th><th>Cost Per</th><th>Cost %</th><th>Par</th><th></th>'
        : '<th>Vendor</th><th>' + esc(sizeCol) + '</th><th>Pour</th><th>Cost Per</th><th>Cost %</th><th>Par</th><th></th>';
    // Each layout gets an even, aligned column set so cards line up down the page.
    // Percentage widths (not fixed px): the columns stay aligned across the Vodka/
    // Gin/Rum tables AND the table always fits its card, so it never scrolls sideways.
    const colgroup = onInactiveTab
      // ⚠ The actions cell carries THREE buttons here (Make Active / Edit / Delete), not
      // two, so it needs materially more room than the working tabs give it — at 15% the
      // Par value ran straight into the Make Active button. Everything from Vendor on
      // moves left to pay for it.
      ? '<colgroup><col style="width:4%;"/><col style="width:25%;"/><col style="width:15%;"/><col style="width:13%;"/><col style="width:13%;"/><col style="width:7%;"/><col style="width:23%;"/></colgroup>'
      : isFoodMisc
      ? '<colgroup><col style="width:4%;"/><col style="width:20%;"/><col style="width:14%;"/><col style="width:8%;"/><col style="width:11%;"/><col style="width:11%;"/><col style="width:11%;"/><col style="width:9%;"/><col style="width:12%;"/></colgroup>'
      : isBottleBeer
        ? '<colgroup><col style="width:4%;"/><col style="width:20%;"/><col style="width:16%;"/><col style="width:13%;"/><col style="width:14%;"/><col style="width:9%;"/><col style="width:10%;"/><col style="width:14%;"/></colgroup>'
        : '<colgroup><col style="width:4%;"/><col style="width:19%;"/><col style="width:14%;"/><col style="width:13%;"/><col style="width:8%;"/><col style="width:12%;"/><col style="width:8%;"/><col style="width:8%;"/><col style="width:14%;"/></colgroup>';
    const nCols = onInactiveTab ? 7 : (isBottleBeer ? 8 : 9);

    let body;
    if (prods.length === 0) {
      // Empty state: no rows to align, so skip the fixed colgroup + table-layout:fixed
      // (their hard pixel widths forced a min-width wider than the card and made an
      // empty table scroll sideways). Auto layout fits the container, no scroll.
      // Tab-aware: the Inactive tab has no "Inactive card" to click and you never ADD an inactive
      // product (they land here by being archived), so it gets its own copy instead of the add pitch.
      const emptyMsg = onInactiveTab
        ? 'No inactive products. Products you archive from the tabs above show up here.'
        : 'No ' + esc(this.activeCat) + ' products yet. Click the ' + esc(this.activeCat) + ' card above to add your first one.';
      body = '<div class="card" style="margin-top:18px;"><table class="row-list" style="width:100%;">'
        + '<thead><tr><th></th><th>Product</th>' + headerCols + '</tr></thead>'
        + '<tbody><tr><td colspan="' + nCols + '" style="color:var(--t3);">' + emptyMsg + '</td></tr></tbody></table></div>';
    } else {
      const pourable = this.isPourable(this.activeCat);
      const dismissed = this._dismissedAlerts && this._dismissedAlerts.has(this.activeCat);
      const alertBar = (incompleteHere.length > 0 && !dismissed)
        ? '<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'
          + incompleteHere.length + ' product' + (incompleteHere.length > 1 ? 's have' : ' has')
          + ' incomplete data, flagged in the Product column.</div>'
          + '<button class="btn btn-ghost btn-sm ip-alert-dismiss" style="flex-shrink:0;border-color:rgba(255,255,255,0.5);color:var(--w);">Dismiss</button></div>'
        : '';

      const selCount = this._selected ? this._selected.size : 0;
      const toolbar = '<div class="no-print" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm ip-sel-all">Select All</button>'
        + '<button class="btn btn-ghost btn-sm ip-sel-clear">Clear</button>'
        // ⚠ NO Bulk Edit on the Inactive tab. Bulk edit is inherently PER-CATEGORY (the
        // fields differ by category) and this is the one list that is deliberately
        // cross-category, so no single form can be right for it: `FORM_SPEC['Inactive']`
        // does not exist, so it silently fell back to the MISC form and offered Misc's
        // fields over liquor, wine and food at once — and because `cat` was 'Inactive'
        // rather than 'Misc' it also offered a Sub-Category dropdown built from
        // `subcatSuggestions('Inactive')`, which is empty, so one stray touch wrote
        // sub_category = '' across the whole selection and wiped Vodka / Bourbon /
        // Chardonnay in a single action.
        // The tab's real jobs are RESTORE and DELETE, so bulk Make Active takes its place
        // — and that was missing anyway, leaving "restore 100 mis-imported wines" as 100
        // separate clicks.
        + (selCount > 0 ? (onInactiveTab
            ? '<button class="btn btn-ghost btn-sm ip-sel-activate">Make Active ' + selCount + ' Selected</button>'
            : '<button class="btn btn-ghost btn-sm ip-sel-edit">Bulk Edit ' + selCount + ' Selected</button>') : '')
        + (selCount > 0 ? '<button class="btn btn-danger btn-sm ip-sel-del">Delete ' + selCount + ' Selected</button>' : '')
        + '<button class="btn btn-ghost btn-sm" id="ip-export" style="margin-left:auto;">Export PDF</button>'
        + '</div>';

      // Group the list by Sub-Category (Misc Type for Misc) into its own card so a
      // manager can scan each style — "Vodka Products (18)" — and spot what is
      // missing. Products with no sub-category fall into an "Uncategorized" card.
      // ⚠ 'All' on the Inactive tab so App.subcatGroups groups by CATEGORY. Passing
      // 'Inactive' made it group by SUB-category, and an archived product rarely has one,
      // so every inactive product in the bar landed under a single "Uncategorized"
      // heading. Kyle's design call for this tab (2026-07-21) was explicitly "grouped by
      // category inside, category shown per row" — you will not remember whether
      // something was Food or Misc, which is the whole reason the tab exists.
      const tables = App.subcatGroups(prods, onInactiveTab ? 'All' : this.activeCat).map((g, gi) => {
        const hdr = esc(g.label) + ' (' + g.items.length + ')';
        const groupRows = g.items.map(p => this._productRowHtml(p, pourable, target)).join('');
        return '<div class="card" style="overflow-x:auto;margin-top:' + (gi === 0 ? '0' : '16') + 'px;">'
          + '<table class="row-list" style="table-layout:fixed;width:100%;">' + colgroup + '<thead><tr>'
          + '<th></th><th>' + hdr + '</th>' + headerCols
          + '</tr></thead><tbody>' + groupRows + '</tbody></table></div>';
      }).join('');

      body = alertBar + toolbar + '<div id="ip-list-export">' + tables + '</div>';
    }

    // When an upload is active, the lower area becomes the in-place import
    // panel (drop zone -> column mapper) instead of the product list. The list
    // sits in an .rpt-panel so the active category tab connects into it cleanly
    // (same connected look as the report tabs) and the header row gets padding.
    // Three states in the lower area, not two: the drop/mapper, then the routing
    // question, then back to the list. `_routing` only exists while `_import` does.
    const lower = this._import
      ? (this._routing ? this.routePanelHTML() : this.importPanelHTML())
      : (tabs + body);
    /* The import result (S206). It has to render HERE, not be written into the DOM by `note()`:
       `note()` targets `#ip-csv-actions`, which is the importer's own action row, and a successful
       import closes the importer and calls renderLanding — so anything written first is destroyed
       on the spot. Cleared once shown, so it cannot greet the operator again on a later visit. */
    const _im = this._importMsg; this._importMsg = null;
    const _imHtml = _im ? '<div style="font-size:13px;color:var(--t2);margin:0 0 12px;">' + esc(_im) + '</div>' : '';
    this.container.innerHTML = '<div class="screen">' + _imHtml + cardsBlock + lower + '</div>';
    this.wireLanding();
  },

  // One product row for the grouped Products list.
  _productRowHtml(p, pourable, target) {
    const complete = this.isComplete(p);
    const sz  = this.SIZES.find(s => s.oz === p.container_size_oz);
    const szL = p.category === 'Food' || p.category === 'Misc'
      ? (esc(p.unit_type || '-') + (p.pack_size > 0 ? ' <span style="font-size:9px;color:var(--t3);">&middot; ' + p.pack_size + ' ea</span>' : ''))
      : (sz ? sz.l : (p.container_size_oz ? (p.container_size_label ? esc(p.container_size_label) + ' (' + p.container_size_oz + ' oz)' : p.container_size_oz + ' oz') : '-'));
    const pc  = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
    // ⚠ NO 50% DIM (S122). It was the THIRD marker for the same fact, and the other two were cut on
    // exactly this reasoning — the per-row "Inactive" name badge and a Category column repeating the
    // heading above it. It is STRUCTURALLY DEAD on every working tab (visibleProducts() guarantees
    // active !== false there) and UNIVERSAL on the Inactive tab, so it labelled nothing anywhere
    // while making the one screen used to clear 100 mis-imported wines half-legible.
    const costUnit = ((this.FORM_SPEC[p.category] || {}).costLabel || 'Cost per Unit').split(' ').pop().toLowerCase();
    const piece = App.piecePrice ? App.piecePrice(p) : null;
    const costDisplay = p.unit_cost != null
      ? App.fmtCurrency(p.unit_cost) + ' <span style="font-size:9px;color:var(--t3);">/' + costUnit + '</span>'
        // ⚠ TWO decimals, always. A sub-dollar per-each price used to print three
        // ("$0.406/ea"), which is the only money on any product list that does not look
        // like money. The extra digit was display-only — every calculation reads the
        // underlying value, not this string — so nothing is lost by rounding it here.
        // Kyle 2026-07-21. Applies to the Food and Misc tabs as well, since this is the
        // one shared product-row builder.
        + (p.pack_size > 0 && piece != null ? ' <span style="font-size:9px;color:var(--t3);">&middot; ' + App.fmtCurrency(piece, 2) + '/ea</span>' : '')
      : '<span style="color:var(--t4);">-</span>';
    const checked = (this._selected && this._selected.has(p.id)) ? ' checked' : '';
    const dash = '<span style="color:var(--t4);">-</span>';
    // Per-category data cells. Food / Misc show the recipe-costing breakdown (per
    // unit servings/oz + the recipe cost); pourable + bottle beer keep pour cols.
    let tds;
    // ⚠ The Inactive tab holds every category at once, so its cell COUNT is chosen from
    // the TAB rather than from p.category — otherwise the row disagrees with the header,
    // which is exactly what happened here (see the headerCols note in renderLanding).
    // The size VALUE still reads per row, because the categories are mixed: `szL` already
    // gives the unit for Food/Misc and the container size for pourables, and bottle beer
    // is tracked by the CASE so it shows the case size instead.
    if (this.activeCat === this.INACTIVE_TAB) {
      const sizeCell = p.category === 'Bottle Beer'
        ? (p.case_size ? esc(p.case_size + ' btl') : dash)
        : szL;
      tds = '<td>' + sizeCell + '</td><td>' + costDisplay + '</td>';
    } else if (p.category === 'Food' || p.category === 'Misc') {
      const basis = App.recipeBasis ? App.recipeBasis(p) : null;
      const uEach = String(p.unit_type || '').toLowerCase() === 'each';
      let perU = dash;
      if (App.isLiquidIngredient && App.isLiquidIngredient(p)) {
        const oz = App.ozPerContainer(p);
        if (oz > 0) perU = (oz % 1 === 0 ? oz : oz.toFixed(1)) + ' oz';
      } else if (p.pack_size > 0) {
        perU = p.pack_size + ' ' + esc(p.serving_name || 'ea');
      } else if (uEach) {
        perU = '1 ' + esc(p.serving_name || 'ea');
      }
      const plainCost = p.unit_cost != null
        ? App.fmtCurrency(p.unit_cost) + ' <span style="font-size:9px;color:var(--t3);">/' + esc(p.unit_type || 'unit') + '</span>' : dash;
      const recCost = (App.isRecipeIngredient && App.isRecipeIngredient(p) && basis && basis.costPerUnit > 0)
        ? App.fmtCurrency(basis.costPerUnit, 2) + ' <span style="font-size:9px;color:var(--t3);">/' + esc(basis.unitLabel) + '</span>'
        : dash;
      tds = '<td>' + esc(p.unit_type || '-') + '</td><td>' + perU + '</td><td>' + plainCost + '</td><td>' + recCost + '</td>';
    } else if (p.category === 'Bottle Beer') {
      // Case-tracked: show Case Size (not an oz bottle size), no Pour column, and a
      // cost % from the per-bottle cost vs the bottle price.
      const cb = App.bottleCost ? App.bottleCost(p) : null;
      const bpct = (cb != null && p.menu_price) ? cb / p.menu_price * 100 : null;
      const bpc = bpct != null ? (bpct > target ? 'neg' : 'pos') : '';
      const caseDisp = p.case_size ? esc(p.case_size + ' btl') : dash;
      tds = '<td>' + caseDisp + '</td>'
        + '<td>' + costDisplay + '</td>'
        + '<td class="' + bpc + '">' + (bpct != null ? App.fmtPct(bpct) : dash) + '</td>';
    } else {
      tds = '<td>' + szL + '</td>'
        + '<td>' + (pourable ? (p.pour_size_oz ? p.pour_size_oz + ' oz' : '-') : dash) + '</td>'
        + '<td>' + costDisplay + '</td>'
        + '<td class="' + pc + '">' + (pourable && p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : dash) + '</td>';
    }
    return '<tr>'
      + '<td class="cb-left" style="width:40px;text-align:center;"><input type="checkbox" class="bc-check ip-sel" data-id="' + p.id + '"' + checked + '/></td>'
      // ⚠ No "Inactive" tag on the name. An inactive product is only ever rendered on the
      // Inactive tab (visibleProducts keeps `active !== false` on every working tab), so
      // the tag could only ever appear where every single row is inactive — it labelled
      // nothing. Kyle 2026-07-21.
      + '<td><div class="val">' + esc(p.name) + '</div>'
      + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '')
      // ⚠ NEITHER FLAG APPLIES TO A RETIRED PRODUCT (S123). An inactive product is off the count
      // sheets, par suggestions, spot checks and order sheet BY DESIGN, so it does not need a shelf
      // and its missing cost is not blocking anything — nagging in red about products the operator
      // deliberately retired fired on the tab whose whole purpose is holding junk, with the exact
      // fixture it was built for (100 mis-imported wines: 8 red "Incomplete" plus 8 "Needs a
      // location"). Still flagged for an ACTIVE product, which is the point of the flags.
      + (p.active !== false && !complete ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Incomplete</div>' : '')
      + (p.active !== false && App.productLocations(p).length === 0 ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Needs a location</div>' : '') + '</td>'
      + '<td>' + esc(p.vendor || '-') + '</td>'
      + tds
      + '<td>' + (p.par_level != null && p.par_level !== '' ? esc(p.par_level + ' ' + (App.productUnit(p, p.par_level) || '')) : '<span style="color:var(--t4);">-</span>') + '</td>'
      + '<td><div class="row-actions">'
      // One-click restore, so putting a product back does not mean opening the editor
      // and hunting for the status toggle (Kyle 2026-07-21). Only on the Inactive tab,
      // which is the only place an inactive product is ever listed.
      + (this.activeCat === this.INACTIVE_TAB
          ? '<button class="btn btn-ghost btn-sm ip-activate" data-id="' + p.id + '">Make Active</button>' : '')
      + '<button class="btn btn-ghost btn-sm ip-edit" data-id="' + p.id + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm ip-del" data-id="' + p.id + '">Delete</button>'
      + '</div></td></tr>';
  },

  // Category filter tabs, styled to match the report tab bar (.rpt-tabs).
  catTabs() {
    const all = this.products();
    // ⚠ Counts are of ACTIVE products only, matching what the tab actually lists. Counting every
    // product would make Liquor read 35 and then show 34. Route the count through _tabFor — the ONE
    // door visibleProducts() and the category cards also use (S124/S156) — so a legacy/out-of-list
    // category (e.g. 'Beer'), which _tabFor sends to Misc, is counted by the Misc badge too and not
    // dropped by a bare `(p.category||'')===c` while the card and list still show it.
    const tab = (label, n, key) => {
      const on = (key || label) === this.activeCat;
      return '<button class="ch-tab' + (on ? ' on' : '') + '" data-cat="' + esc(key || label) + '">'
        + esc(label) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
    };
    const inactiveN = all.filter(p => p && p.active === false).length;
    return '<div class="ch-tabs no-print">'
      + this.CATEGORIES.map(c =>
          tab(c, all.filter(p => p && this._tabFor(p) === c && p.active !== false).length)).join('')
      // Last, after Misc: one place for everything retired, whatever category it came from.
      + tab(this.INACTIVE_TAB, inactiveN)
      + '</div>';
  },

  wireLanding() {
    this.container.onclick = ev => {
      const addLink = ev.target.closest('.ip-card-add');
      const impLink = ev.target.closest('.ip-card-imp');
      const tab     = ev.target.closest('.ch-tab');
      const edit    = ev.target.closest('.ip-edit');
      const del     = ev.target.closest('.ip-del');
      const activate = ev.target.closest('.ip-activate');
      const dismiss = ev.target.closest('.ip-alert-dismiss');
      const selAll  = ev.target.closest('.ip-sel-all');
      const selClr  = ev.target.closest('.ip-sel-clear');
      const selEdit = ev.target.closest('.ip-sel-edit');
      const selAct  = ev.target.closest('.ip-sel-activate');
      const selDel  = ev.target.closest('.ip-sel-del');
      const selBox  = ev.target.closest('.ip-sel');
      const exp     = ev.target.closest('#ip-export');

      if (exp)     { ev.stopPropagation(); App.exportPDF({ title: this.activeCat + ' Products', root: document.getElementById('ip-list-export') }); return; }
      if (addLink) { ev.stopPropagation(); this.showForm(addLink.dataset.cat); return; }
      if (impLink) { ev.stopPropagation(); this._import = { cat: impLink.dataset.cat }; this._formCategory = impLink.dataset.cat; this.renderLanding(); setTimeout(() => document.getElementById('ip-import-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); return; }
      if (tab)     { ev.stopPropagation(); this.activeCat = tab.dataset.cat; this._selected = new Set(); this.renderLanding(); return; }
      if (edit)    { ev.stopPropagation(); this.showFormForId(edit.dataset.id); return; }
      // Restore in one click. Routed through setActiveBulk, which is the door that already
      // snapshots and puts the row back if the write is refused, so this cannot leave the
      // product looking restored when the server never took it.
      if (activate) { ev.stopPropagation(); this.setActiveBulk([activate.dataset.id], true).then(() => this.renderLanding()); return; }
      if (del)     { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); return; }
      if (dismiss) { ev.stopPropagation(); (this._dismissedAlerts = this._dismissedAlerts || new Set()).add(this.activeCat); this.renderLanding(); return; }
      // ⚠ Through visibleProducts(), the ONE door for what a tab lists. This used to
      // filter on category alone, which meant two opposite failures from one line: on a
      // working tab it also selected that category's INACTIVE products, which are not
      // rendered — so after archiving 40 mis-imported wines, Select All on Wine to clear
      // 12 bad rows read "Delete 52 Selected" over 12 rows and permanently deleted all 40
      // archived ones, none of which had ever been shown. And on the Inactive tab it
      // selected NOTHING, because no product has category 'Inactive', so the tab's whole
      // purpose (clearing 100 mis-imported wines) had no bulk path at all.
      if (selAll)  { ev.stopPropagation(); this._selected = new Set(this.visibleProducts().map(p => p.id)); this.renderLanding(); return; }
      if (selClr)  { ev.stopPropagation(); this._selected = new Set(); this.renderLanding(); return; }
      if (selEdit) { ev.stopPropagation(); this.openBulkEdit(); return; }
      // Bulk restore. Through setActiveBulk, the door that snapshots and puts every row
      // back if the write is refused. The selection is left alone — renderLanding prunes
      // it to what is still on screen, so the restored products drop out of it on their own.
      if (selAct)  { ev.stopPropagation(); this.setActiveBulk([...(this._selected || [])], true).then(() => this.renderLanding()); return; }
      if (selDel)  { ev.stopPropagation(); this.confirmDel([...(this._selected || [])]); return; }
      if (selBox)  { const id = selBox.dataset.id; this._selected = this._selected || new Set(); if (this._selected.has(id)) this._selected.delete(id); else this._selected.add(id); this.renderLanding(); return; }
    };

    // In-place import panel (drop zone -> column mapper, same spot). Wired only
    // while an upload is active for a category.
    // `else if`, not an early return: this block is currently last in wireLanding,
    // and a return would silently swallow anything added after it later.
    if (this._routing) { this.wireRouting(); }
    else if (this._import) {
      document.getElementById('ip-imp-cancel')?.addEventListener('click', () => { this._import = null; this._routing = null; this.renderLanding(); });
      const cat = this._import.cat;
      const el = document.getElementById('ip-csv');
      if (el && typeof CSVMapper !== 'undefined') {
        CSVMapper.mount(el, {
          actionsEl: '#ip-csv-actions',
          dropTitle: 'Drop your ' + cat + ' product file here',
          dropSub: 'Needs a product name column; cost, size, price and par are optional.',
          confirmLabel: 'Import',
          // The UNION, not just this card's fields: the file may route into other
          // categories, and a column with nowhere to bind is a column thrown away.
          fields: this.importFieldsForImport(cat).map(f => ({ key: f.key, label: f.label, required: f.required, match: f.aliases })),
          onState: state => { const row = document.getElementById('ip-imp-cancel-row'); if (row) row.style.display = (state === 'map') ? 'none' : ''; },
          // The mapper no longer imports. It hands the rows to the routing question,
          // which is what resolves each row's category before anything is written.
          onComplete: rows => { this._formCategory = cat; this._openRouting(rows, cat); }
        });
      }
    }
  },

  wireRouting() {
    const r = this._routing;
    if (!r) return;
    /* Every control writes to STATE and re-renders. The screen is therefore always drawn
       from the same place the import reads, so the button count, the group counts and the
       write can never disagree with each other or with the DOM. */
    const redraw = () => this.renderLanding();

    this.container.querySelectorAll('.ip-rt-cb').forEach(cb =>
      cb.addEventListener('change', () => {
        if (cb.checked) r.checked[cb.value] = true; else delete r.checked[cb.value];
        redraw();
      }));

    document.getElementById('ip-rt-add')?.addEventListener('click', () => {
      const cat = (document.getElementById('ip-rt-cat') || {}).value || '';
      if (!cat) { this._routeNote('Pick a category first, then press Move To.'); return; }
      const ids = this._routeCheckedIds();
      if (!ids.length) return;
      this._assignRows(ids, cat);
      /* The checks clear and the group they went to OPENS, so the operator sees where
         their batch landed instead of watching rows vanish. */
      r.checked = {}; r.open[cat] = true;
      redraw();
    });

    /* ⛔ REMOVAL IS PER ROW NOW. It replaces a bulk "Not a product" button that took
       Kyle's whole import, and the fix is structural rather than a filter: a control
       rendered on the row can only ever act on a row that is on screen, by name.
       No confirm — nothing is written until Add, the row is named right beside the
       button, and Start Over re-drops the file. */
    this.container.querySelectorAll('.ip-rt-rm').forEach(b =>
      b.addEventListener('click', () => { this._removeRows([b.dataset.rid]); redraw(); }));

    this.container.querySelectorAll('.ip-rt-head').forEach(h =>
      h.addEventListener('click', () => { const c = h.dataset.cat; r.open[c] = !r.open[c]; redraw(); }));

    document.getElementById('ip-route-vendor')?.addEventListener('change', e => {
      if (e.target.value === '__new') { r.vendorNew = true; r.vendor = ''; }
      else { r.vendorNew = false; r.vendor = e.target.value; }
      redraw();
    });
    /* ⚠ `input`, not `change`, and NO redraw. A redraw on every keystroke rebuilds the
       input and takes the caret with it. The value is captured as it is typed so any LATER
       re-render rebuilds the field from state rather than from a node about to be destroyed. */
    document.getElementById('ip-route-vendor-new')?.addEventListener('input', e => { r.vendor = e.target.value.trim(); });

    document.getElementById('ip-route-back')?.addEventListener('click', () => {
      // Back to the drop zone, not out of the import. A mapping belongs to the file it
      // was made for, so the file is re-dropped from scratch.
      this._routing = null; this.renderLanding();
    });

    document.getElementById('ip-route-go')?.addEventListener('click', async () => {
      const btn = document.getElementById('ip-route-go');
      if (!btn || btn.disabled || this._routeWriting) return;
      // One press, one import. A button that survives a re-render is how a double-click
      // became two concurrent writes elsewhere in this app.
      this._routeWriting = true;
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Importing...';
      const rows = this._routeStamp();
      try { await this.runImport(rows); }
      finally {
        this._routeWriting = false;
        /* ⛔ ONLY CLEAR ON SUCCESS, and `_import` is how we know: runImport nulls it when
           the write lands. A failed save keeps the whole screen so the operator can press
           Import again without re-sorting anything.
           ⚠ And do NOT re-render here — runImport's failure exits write into
           #ip-csv-actions and a re-render would destroy the message. */
        if (!this._import) { this._routing = null; }
        else {
          const b = document.getElementById('ip-route-go');
          if (b) { b.disabled = false; b.textContent = label; }
        }
      }
    });
  },

  // A refusal has to say something, or the button reads as broken ([[the-loop]] #89).
  _routeNote(msg) {
    const a = document.getElementById('ip-csv-actions');
    if (!a) return;
    a.querySelectorAll('.ip-csv-note').forEach(n => n.remove());
    a.insertAdjacentHTML('beforeend', '<span class="ip-csv-note" style="color:var(--red);font-size:12px;margin-left:10px;">' + esc(msg) + '</span>');
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  // Track whether the form is being opened to EDIT an INCOMPLETE existing
  // product. Drives field-missing highlights. Add-new flow + edit-of-
  // complete flow both stay clean (no red borders). Only when the operator
  // clicks Edit on a row flagged as Incomplete do the missing cells light up.
  _setEditFlag(id) {
    if (!id) { this._editingIncomplete = false; return; }
    const p = this.products().find(x => x.id === id);
    this._editingIncomplete = !!(p && !this.isComplete(p));
  },

  showForm(category, id) {
    this._setEditFlag(id);
    if (!this.CATEGORIES.includes(category)) category = 'Liquor';
    this.editId = id || null;
    this._formCategory = category;
    this.renderForm();
  },

  // Used by Edit click: resolves the category from the existing record.
  showFormForId(id) {
    const p = this.products().find(x => x.id === id);
    if (!p) return;
    this.showForm(p.category || 'Misc', id);
  },

  renderForm() {
    const cat = this._formCategory;
    const spec = this.FORM_SPEC[cat] || this.FORM_SPEC['Misc'];
    const p = this.editId ? this.products().find(x => x.id === this.editId) : null;
    const v = (val) => val != null && val !== '' ? val : '';
    const isActive = p ? p.active !== false : true;

    // ── Header: standard form-card title; the Active toggle sits right after the
    // title (edit mode only), leaving the top-right for the corner X. ───────────
    const titleText = this.editId ? 'Editing ' + esc(cat) + ' Product' : 'New ' + esc(spec.title) + ' Product';

    const statusHTML = this.editId
      ? '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span class="ip-active-state" data-active="' + (isActive ? 'true' : 'false') + '" style="'
          + 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:1px;'
          + 'background:' + (isActive ? 'rgba(125,199,125,0.12)' : 'rgba(199,125,125,0.12)') + ';'
          + 'color:' + (isActive ? 'var(--green)' : 'var(--red)') + ';">'
          + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>'
          + (isActive ? 'ACTIVE' : 'INACTIVE')
        + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="ip-toggle-active">'
          + (isActive ? 'Hide from operations' : 'Make active')
        + '</button>'
      + '</div>'
      : '';

    const header = '<div class="card-title" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-right:30px;">'
      + '<span>' + titleText + '</span>'
      + statusHTML
    + '</div>';

    // ── Row 1: identity fields (Name, Brand, Sub-Cat, Vendor, Location) ────
    // Auto-fit grid: fits all five on one row on wide screens and wraps/stacks
    // cleanly on narrow screens instead of overflowing the form container.
    // Misc is a grab-bag, so it gets a structured Misc Type select that tags the
    // product (NA Beverage / Drink Mixer / Garnish / supplies). That tag drives the
    // menu picker (NA Beverage) and the recipe ingredient picker (Mixer/Garnish),
    // so it is a FIXED list with no | Edit — the app branches on its value, and an
    // operator-invented type would silently drop products out of those pickers.
    // Every other category keeps an editable Sub-Category (a pure label).
    const subOrType = cat === 'Misc'
      ? (() => {
          const mt = (p?.misc_type || '');
          const inList = (App.MISC_TYPES || []).some(t => t === mt);
          return '<div class="f"><label>Misc Type</label>'
            + '<select class="form-input" id="ip-misctype"><option value="">Select type...</option>'
            + (App.MISC_TYPES || []).map(t => '<option' + (mt === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('')
            + (mt && !inList ? '<option selected>' + esc(mt) + '</option>' : '')
            + '</select></div>';
        })()
      : (() => {
          const cur = (p?.sub_category || '');
          const key = 'subcat_' + cat.toLowerCase().replace(/\s+/g, '_');
          const builtin = (App.SUBCAT_SUGGESTIONS[cat] || []).filter(o => o.toLowerCase() !== 'other');
          return '<div class="f"><label>Sub-Category' + App.manageListLink(key) + '</label>'
            + App.customSelect({ id: 'ip-subcat-sel', key, builtin, selected: cur, blank: true, blankLabel: 'Select...' }) + '</div>';
        })();

    // All identity + spec cells flow in ONE form-row (assembled below) so they
    // pair into clean two columns and the single lone cell falls on the LAST row,
    // not stranded mid-form. row1 + row2 are just cell strings now.
    const row1 = '<div class="f"><label>Product Name</label>'
      + '<input type="text" id="ip-name" value="' + esc(p?.name || '') + '" placeholder="' + esc(this._namePlaceholder(cat)) + '"/></div>'
      + '<div class="f"><label>Brand</label>'
      + '<input type="text" id="ip-brand" value="' + esc(p?.brand || '') + '" placeholder="' + esc(this._brandPlaceholder(cat)) + '"/></div>'
      + subOrType
      + '<div class="f"><label>Primary Vendor</label>'
      + '<select id="ip-vendor">' + this.vendorOpts(p?.vendor) + '</select></div>'
      /* The vendor's OWN code for this product. An order guide's whole point is that the
         distributor identifies things by their number, and when the order goes back the
         rep works from that number, not from your product name. It had nowhere to land,
         so the most useful column on a guide was being thrown away on every import. */
      + '<div class="f"><label>Vendor Item #</label>'
      + '<input type="text" id="ip-vcode" value="' + esc(p?.vendor_item_code || '') + '" placeholder="Optional"/></div>'
      + '<div class="f"><label>Primary Location</label>'
      + '<select id="ip-loc1">' + this.locationOpts(p?.primary_location) + '</select></div>';

    // ── Row 2: category-specific size/cost/par fields ─────────────────────
    let row2 = '';
    let foodStrip = '';   // Food / Misc derived-cost calc strip (below the grid)
    if (spec.sizeGroup && spec.showPour) {
      // Liquor / Wine / Draft Beer
      const sizeSel = p?.container_size_oz != null ? p.container_size_oz : spec.defaultSize;
      row2 = ''
        + this._sizeCellHtml(spec, sizeSel)
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + esc(spec.costLabel) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:100px;flex-shrink:0;"><label>' + esc(spec.pourLabel || 'Pour Size') + '</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-pour" value="' + v(p?.pour_size_oz) + '" step="0.25" placeholder="e.g. ' + spec.defaultPour + '"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:120px;flex-shrink:0;"><label>' + 'Menu Price' + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>';
    } else if (spec.showCaseSize) {
      // Bottle Beer — tracked by the case / individual bottle; no oz size field.
      row2 = ''
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Case Size</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-case-size" value="' + v(p?.case_size != null ? p.case_size : spec.defaultCaseSize) + '" step="1" min="1"/><span class="suf">btl</span></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + esc(spec.costLabel) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + 'Menu Price' + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>';
    } else if (spec.showUnitType) {
      // Food / Misc
      const ut = p?.unit_type || spec.defaultUnitType;
      // How this product is tracked (its stock measure): by the whole unit, by
      // pieces, or by ounces. Derived from the saved product, else defaulted from
      // the unit (volume units start on ounces). The operator can change it — the
      // same unit can go either way (bacon = a lb tracked by pieces).
      this._trackBy = (p && parseFloat(p.container_size_oz) > 0) ? 'oz'
        : (p && parseFloat(p.pack_size) > 0) ? 'pieces'
        : ({ gallon: 1, quart: 1, pint: 1 }[String(ut || '').toLowerCase()] ? 'oz' : 'unit');
      // Default Count By follows Track By; an existing product keeps its saved
      // choice (and counts as "touched" so a unit change never overrides).
      this._countTouched = !!(p?.count_style);
      const cstyle = p?.count_style || (this._trackBy === 'oz' ? 'slider' : this._trackBy === 'pieces' ? 'loose' : 'number');
      row2 = ''
        + this._unitCellHtml(ut)
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.costLabel) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        // Track By (stock measure) + the one field it needs. Swaps live when Track
        // By, Unit, or Misc Type changes (see _rerenderDivisor).
        + '<span id="ip-divisor-wrap" style="display:contents;">' + this._trackDivisorHTML(p, ut, p?.misc_type) + '</span>'
        // How this product is counted on the count sheet: a typed number, full
        // units + loose pieces, or a fill slider (pick the silhouette).
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Count By</label>'
        + '<select id="ip-cstyle">'
        + '<option value="number"' + (cstyle === 'number' ? ' selected' : '') + '>Total Count</option>'
        + '<option value="loose"' + (cstyle === 'loose' ? ' selected' : '') + '>Full + Loose</option>'
        + '<option value="slider"' + (cstyle === 'slider' ? ' selected' : '') + '>Fill Slider</option>'
        + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>';
      foodStrip = '<div id="ip-divisor-strip">' + this._foodDivisorStripHTML(p, ut, p?.misc_type) + '</div>';
    }

    // ── Calc strip (pourable + bottle beer) ───────────────────────────────
    // For Bottle Beer slots are: Btls/Case, Cost/Btl, Pour Cost %.
    // For everything else: Pours/Container, Cost/Pour, Pour Cost %.
    let calcStrip = '';
    if (spec.showCalcStrip) {
      const slot1Label = spec.calc1Label || (spec.showCaseSize ? 'Btls / Case' : 'Pours / Container');
      const slot2Label = spec.calc2Label || (spec.showCaseSize ? 'Cost / Btl' : 'Cost / Pour');
      calcStrip = '<div style="margin-top:18px;background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:14px 18px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">' + esc(slot1Label) + '</div><div class="calc-val" id="ip-pours">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">' + esc(slot2Label) + '</div><div class="calc-val" id="ip-cpp">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Pour Cost %</div><div class="calc-val" id="ip-pct">-</div></div>'
      + '</div></div>';
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    const notes = App.noteField({ id: 'ip-notes', value: p?.notes });

    const servingBlock = spec.showServingSizes ? this.servingSizesBlockHTML(p, spec) : '';

    // Food / Misc: a single "sold on the menu" toggle that lists the product in the
    // Menu Builder's No Prep picker (bagged chips, bottled drinks). Beer/Wine are
    // always menu-eligible; pourables carry Other Pour Sizes here instead.
    const menuFlagBlock = spec.showUnitType
      ? '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:6px;">'
        + '<input type="checkbox" class="bc-check" id="ip-soldmenu"' + (p?.sold_on_menu ? ' checked' : '') + '/>'
        + '<span style="font-size:13px;color:var(--t1);">Non prep menu item <span style="color:var(--t3);font-weight:400;">(soda, chip bag)</span></span>'
        + '</label>'
      : '';

    // Sectioned three-column layout: Details, then the category's Purchase & Cost
    // (spec fields + calc strip), then Sold on the Menu (pourable Other Sizes) and
    // Notes, each divided by a rule line so the form fills in section by section.
    const soldInner = servingBlock + menuFlagBlock;
    const formCard = '<div class="card form-card ip-form">'
      + header
      + '<div class="ip-sec-label" style="margin-top:6px;">Details</div>'
      + '<div class="ip-grid3">' + row1 + '</div>'
      + '<div class="ip-sec"><div class="ip-sec-label">Purchase &amp; Cost</div>'
        + '<div class="ip-grid3">' + row2 + '</div>'
        + calcStrip
        + foodStrip
      + '</div>'
      + (soldInner ? '<div class="ip-sec"><div class="ip-sec-label">Sold on the Menu</div>' + soldInner + '</div>' : '')
      + '<div style="margin-top:18px;">' + notes + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="ip-save">' + (this.editId ? 'Update' : 'Save') + '</button>'
        + '<span id="ip-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
    // Popup over the products list (which stays mounted behind), instead of
    // swapping the whole page out. The corner X closes it (and re-renders the landing).
    App.openModal(formCard, { id: 'ip-form-modal', layer: 9000, maxWidth: 660, confirmDirty: true, onClose: () => { App.closeModal('ip-form-modal'); this.renderLanding(); } });

    this._wireForm();
  },

  _namePlaceholder(cat) {
    return { 'Liquor':"Tito's Handmade Vodka", 'Wine':'House Cabernet', 'Bottle Beer':'Modelo Especial',
             'Draft Beer':'ABW Pearl Snap', 'Food':'Ground Beef 80/20', 'Misc':'Lime Juice' }[cat] || '';
  },
  _brandPlaceholder(cat) {
    return { 'Liquor':"Tito's", 'Wine':'Producer', 'Bottle Beer':'Constellation',
             'Draft Beer':'Austin Beerworks', 'Food':'', 'Misc':'' }[cat] || '';
  },

  // Required fields per category — matches isComplete() exactly so the
  // .field-missing highlights surface the same items as the Incomplete badge.
  // All categories require name, unit cost, and a primary location (a product
  // with no location can't be counted). Pourable (Liquor/Wine/Draft Beer) also
  // require container size, pour size, and menu price. Bottle Beer requires
  // container size + case size. Food/Misc just need the basics.
  _requiredFieldIds(cat) {
    const ids = ['ip-name', 'ip-cost'];
    if (cat === 'Bottle Beer') {
      ids.push('ip-case-size');
    } else if (this.isPourable(cat)) {
      ids.push('ip-size', 'ip-pour', 'ip-price');
    }
    return ids;
  },
  // Value check: is a given input "filled"? Handles the size dropdown's
  // "custom" option by also checking the linked custom-oz input.
  _isFilled(id) {
    const el = document.getElementById(id);
    if (!el) return true; // not rendered in this category — not required
    const v = (el.value || '').trim();
    if (!v) return false;
    // For numeric inputs, zero counts as not-filled
    if (el.type === 'number') return parseFloat(v) > 0;
    return true;
  },
  applyMissingFieldHighlights(cat) {
    const ids = this._requiredFieldIds(cat);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (!wrap) return;
      if (!this._isFilled(id)) wrap.classList.add('field-missing');
      else wrap.classList.remove('field-missing');
    });
  },

  _wireForm() {
    document.getElementById('ip-save')?.addEventListener('click', () => this.save());
    document.getElementById('ip-name')?.focus();

    // Size + Unit Type are now editable dropdowns (the "| Edit" list editor);
    // no inline custom entry. A change just recomputes the derived costs.
    document.getElementById('ip-size')?.addEventListener('change', () => {
      this.calcProduct();
      this._refreshMissing();
    });
    document.getElementById('ip-unit')?.addEventListener('change', () => this._onUnitChange());
    // A supply type hides Track By (always pieces-for-ordering); the divisor handles
    // that, so just re-render.
    document.getElementById('ip-misctype')?.addEventListener('change', () => this._rerenderDivisor());
    // Wire the "| Edit" links (and any custom-select chrome) inside this form.
    App.wireCustomSelects(document.getElementById('ip-form-modal') || document);
    // Once the operator picks a Count By, stop auto-defaulting it on unit changes.
    document.getElementById('ip-cstyle')?.addEventListener('change', () => { this._countTouched = true; });
    ['ip-pour','ip-cost','ip-price','ip-case-size'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => { this.calcProduct(); this._refreshMissing(); })
    );
    // Food / Misc: live cost per ounce / serving / piece as cost or divisor change.
    document.getElementById('ip-cost')?.addEventListener('input', () => this._calcDivisor());
    this._wireDivisor();
    // Field-missing refresh on the other required inputs
    ['ip-name', 'ip-vendor', 'ip-loc1'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this._refreshMissing())
    );
    document.getElementById('ip-vendor')?.addEventListener('change', () => this._refreshMissing());
    document.getElementById('ip-loc1')?.addEventListener('change', () => this._refreshMissing());

    // Edit mode: status toggle. Flips the visual state and updates the
    // button label. Save reads the toggled state via the badge's data-active
    // attribute, so the operator commits the change by clicking Update.
    document.getElementById('ip-toggle-active')?.addEventListener('click', () => {
      const el = document.querySelector('.ip-active-state');
      if (!el) return;
      const nowActive = !(el.dataset.active === 'true');
      el.dataset.active = nowActive ? 'true' : 'false';
      el.style.background = nowActive ? 'rgba(125,199,125,0.12)' : 'rgba(199,125,125,0.12)';
      el.style.color = nowActive ? 'var(--green)' : 'var(--red)';
      el.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>' + (nowActive ? 'ACTIVE' : 'INACTIVE');
      document.getElementById('ip-toggle-active').textContent = nowActive ? 'Hide from operations' : 'Make active';
    });

    // Other sizes sold: wire existing rows + the add button.
    document.querySelectorAll('.vss-row').forEach(r => this._wireServingRow(r));
    document.getElementById('vss-add')?.addEventListener('click', () => {
      const list = document.getElementById('vss-list');
      if (!list) return;
      const holder = document.createElement('div');
      holder.innerHTML = this.servingRowHTML({}, list.children.length);
      const row = holder.firstElementChild;
      list.appendChild(row);
      this._wireServingRow(row);
      row.querySelector('.vss-label')?.focus();
    });

    if (this.editId) this.calcProduct();

    // On render: if we're editing an existing product, highlight required-
    // but-empty fields so the operator sees what's missing at a glance.
    if (this._editingIncomplete) {
      this.applyMissingFieldHighlights(this._formCategory || '');
    }
  },

  _refreshMissing() {
    if (!this._editingIncomplete) return;
    this.applyMissingFieldHighlights(this._formCategory || '');
  },

  getOz() {
    const v = document.getElementById('ip-size')?.value;
    if (!v || v === '') return 0;
    return parseFloat(v) || 0;
  },

  getUnitType() {
    return document.getElementById('ip-unit')?.value || null;
  },

  // Sub-Category value: the picked option (including the "Other" catch-all).
  getSubcat() {
    const sel = document.getElementById('ip-subcat-sel');
    return sel ? sel.value : (document.getElementById('ip-subcat')?.value.trim() || '');
  },

  // ── Adaptive Food / Misc divisor field ────────────────────────────────────



  // Only the INPUT cells for the grid. The derived cost readouts live in the calc
  // strip below (see _foodDivisorStripHTML), the way liquor shows its calc strip.
  // Is the misc_type a non-recipe supply (paper / cleaning)?
  _isSupply(miscType) { return (App.MISC_SUPPLY_TYPES || []).includes(miscType); },

  // Track By selector (the product's stock measure) + the one field that measure
  // needs. Supply items skip the selector (always pieces-for-ordering).
  _trackDivisorHTML(p, unitType, miscType) {
    if (this._isSupply(miscType)) return this._divisorFieldsHTML(p, unitType, miscType);
    const uName = (unitType && unitType !== 'custom') ? unitType : 'unit';
    const tb = this._trackBy;
    const opt = (val, label) => '<option value="' + val + '"' + (tb === val ? ' selected' : '') + '>' + esc(label) + '</option>';
    return '<div class="f" style="width:150px;flex-shrink:0;"><label>Track By</label>'
      + '<select id="ip-trackby">'
      +   opt('unit', 'By the ' + uName)
      +   opt('pieces', 'By pieces')
      +   opt('oz', 'By ounces')
      + '</select></div>'
      + this._divisorFieldsHTML(p, unitType, miscType);
  },

  // The one measure field for the current Track By (or supply's pieces field).
  _divisorFieldsHTML(p, unitType, miscType) {
    const vv = x => (x != null && x !== '' ? x : '');
    const uLabel = (unitType && unitType !== 'custom') ? unitType : 'unit';
    // Supply (paper / cleaning): pieces per unit for ordering, never a recipe cost.
    if (this._isSupply(miscType)) {
      const packV = (p && p.pack_size != null && p.pack_size !== '') ? p.pack_size : '';
      return '<div class="f"><label>Pieces <span style="color:var(--t4);font-weight:400;">(per ' + esc(uLabel) + ')</span></label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-pack" value="' + vv(packV) + '" step="1" min="1" placeholder="Optional"/><span class="suf">ea</span></div></div>';
    }
    // By ounces: the ounces in ONE unit drive cost per oz + the fill-slider count. A
    // volume unit (gallon/quart/pint) knows its ounces and locks the field; a custom
    // unit types it in. Label names the unit: "Gallon Size (oz)" / "Bottle Size (oz)".
    if (this._trackBy === 'oz') {
      const ut = String(unitType || '').toLowerCase();
      const VOL = { gallon: 128, quart: 32, pint: 16 };
      const known = VOL[ut];
      const uName = (unitType && unitType !== 'custom') ? unitType : 'Unit';
      const oz = (known != null) ? known : ((p && p.container_size_oz > 0) ? p.container_size_oz : '');
      const lock = (known != null) ? ' readonly style="opacity:0.6;cursor:not-allowed;"' : '';
      return '<div class="f"><label>' + esc(uName) + ' Size (oz)</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-foz" value="' + (oz === '' ? '' : oz) + '" step="0.1" min="0"' + lock + '/><span class="suf">oz</span></div></div>';
    }
    // By pieces: how many pieces one unit breaks into (cost per piece, full + loose
    // count), plus what one piece is called (wing, slice) for the recipe.
    if (this._trackBy === 'pieces') {
      const packV = (p && p.pack_size != null && p.pack_size !== '') ? p.pack_size : '';
      return '<div class="f"><label>Pieces <span style="color:var(--t4);font-weight:400;">(per ' + esc(uLabel) + ')</span></label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-pack" value="' + vv(packV) + '" step="1" min="1" placeholder="e.g. 45"/><span class="suf">ea</span></div></div>'
        + '<div class="f"><label>Piece Name</label>'
        + '<input type="text" id="ip-sname" value="' + esc((p && p.serving_name) || '') + '" placeholder="wing, slice"/></div>';
    }
    // By the unit: you count / weigh whole units, cost is per unit — no extra field.
    return '';
  },

  // The derived cost readout for a Food / Misc product, in ONE calc strip below the
  // inputs (mirrors liquor's calc strip). Liquid vs solid is set by the unit's
  // method (Edit Unit Types), so there is no on-form toggle.
  _foodDivisorStripHTML(p, unitType, miscType) {
    const isSupply = this._isSupply(miscType);
    const uName = (unitType && unitType !== 'custom') ? unitType : 'unit';
    const cost = (p && p.unit_cost > 0) ? parseFloat(p.unit_cost) : 0;
    const item = (label, val, id) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val"' + (id ? ' id="' + id + '"' : '') + '>' + val + '</div></div>';
    let items = '';
    if (isSupply) {
      const n = (p && p.pack_size > 0) ? p.pack_size : 0;
      items += item('Cost / Piece', (cost > 0 && n > 0) ? App.fmtCurrency(cost / n, 2) : '-', 'ip-div-cps');
    } else if (this._trackBy === 'oz') {
      const oz = (p && p.container_size_oz > 0) ? p.container_size_oz : 0;
      items += item('Cost / oz', (cost > 0 && oz > 0) ? App.fmtCurrency(cost / oz, 3) : '-', 'ip-div-cps');
    } else if (this._trackBy === 'pieces') {
      const n = (p && p.pack_size > 0) ? p.pack_size : 0;
      items += item('Cost / Piece', (cost > 0 && n > 0) ? App.fmtCurrency(cost / n, 2) : '-', 'ip-div-cps');
    } else {
      items += item('Cost / ' + esc(uName), cost > 0 ? App.fmtCurrency(cost, 2) : '-', 'ip-div-cps');
    }
    return '<div style="margin-top:18px;background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:14px 18px;">'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },

  // Re-render the Track By selector + measure field + cost strip on any change,
  // carrying in-progress values (or a volume-unit oz prefill) across the rebuild.
  _rerenderDivisor(prefillOz) {
    const cur = this.editId ? this.products().find(x => x.id === this.editId) : null;
    const ut = this.getUnitType();
    const mt = document.getElementById('ip-misctype')?.value || '';
    const liveOz = prefillOz != null ? prefillOz
      : (parseFloat(document.getElementById('ip-foz')?.value) || (cur && cur.container_size_oz) || 0);
    const livePack = parseFloat(document.getElementById('ip-pack')?.value) || (cur && cur.pack_size) || 0;
    const usePack = (this._trackBy === 'pieces' || this._isSupply(mt)) ? livePack : 0;
    const seed = Object.assign({}, cur || {}, { container_size_oz: this._trackBy === 'oz' ? liveOz : 0, pack_size: usePack });
    const wrap = document.getElementById('ip-divisor-wrap');
    if (wrap) wrap.innerHTML = this._trackDivisorHTML(seed, ut, mt);
    const strip = document.getElementById('ip-divisor-strip');
    if (strip) strip.innerHTML = this._foodDivisorStripHTML(seed, ut, mt);
    this._wireDivisor();
    // Follow the practical Count By as Track By changes, unless the operator picked one.
    if (!this._countTouched) {
      const sel = document.getElementById('ip-cstyle');
      if (sel) sel.value = this._trackBy === 'oz' ? 'slider' : this._trackBy === 'pieces' ? 'loose' : 'number';
    }
  },
  // Unit picked: a volume unit is always By ounces and knows them (prefill + lock).
  // A known count unit can't be a fixed-oz container, so drop off By ounces to By the
  // unit. A custom unit keeps whatever Track By the operator set.
  _onUnitChange() {
    const ul = String(this.getUnitType() || '').toLowerCase();
    const VOL = { gallon: 128, quart: 32, pint: 16 };
    const COUNT = ['lb', 'each', 'case', 'bag', 'box', 'dozen'];
    if (VOL[ul] != null) { this._trackBy = 'oz'; this._rerenderDivisor(VOL[ul]); return; }
    if (COUNT.includes(ul) && this._trackBy === 'oz') this._trackBy = 'unit';
    this._rerenderDivisor();
  },
  // Track By changed by the operator.
  _onTrackByChange() {
    const v = document.getElementById('ip-trackby')?.value;
    this._trackBy = (v === 'oz' || v === 'pieces') ? v : 'unit';
    this._rerenderDivisor();
  },

  _wireDivisor() {
    document.getElementById('ip-trackby')?.addEventListener('change', () => this._onTrackByChange());
    ['ip-pack', 'ip-foz'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener('input', () => this._calcDivisor()); el.addEventListener('change', () => this._calcDivisor()); }
    });
    // The Unit Type "| Edit" link, (re)built here on rerenders — wire it (idempotent).
    App.wireCustomSelects(document.getElementById('ip-form-modal') || document);
    this._calcDivisor();
  },

  // Live derived cost in the strip for the current Track By.
  _calcDivisor() {
    const el = document.getElementById('ip-div-cps');
    if (!el) return;
    const cost = parseFloat(document.getElementById('ip-cost')?.value) || 0;
    if (!(cost > 0)) { el.textContent = '-'; return; }
    const mt = document.getElementById('ip-misctype')?.value || '';
    if (this._isSupply(mt)) {
      const n = parseFloat(document.getElementById('ip-pack')?.value) || 0;
      el.textContent = n > 0 ? App.fmtCurrency(cost / n, 2) : '-';
      return;
    }
    if (this._trackBy === 'oz') {
      const oz = parseFloat(document.getElementById('ip-foz')?.value) || 0;
      el.textContent = oz > 0 ? App.fmtCurrency(cost / oz, 3) : '-';
      return;
    }
    if (this._trackBy === 'pieces') {
      const n = parseFloat(document.getElementById('ip-pack')?.value) || 0;
      el.textContent = n > 0 ? App.fmtCurrency(cost / n, 2) : '-';
      return;
    }
    el.textContent = App.fmtCurrency(cost, 2);   // by the unit
  },

  // Cost per menu serving for a resale item = purchase cost / servings per unit.
  // Still used by the CSV import path; the form no longer edits resale directly.
  _resaleCps(cost, servings) {
    const c = parseFloat(cost) || 0;
    const n = parseFloat(servings);
    return (n && n > 0) ? c / n : c;
  },

  // Per-bottle cost from the form. For Bottle Beer with case_size > 0, the
  // cost field is per-case so divide. Otherwise pass through.
  effectiveBottleCost() {
    const cost = parseFloat(document.getElementById('ip-cost')?.value) || 0;
    if (this._formCategory === 'Bottle Beer') {
      const cs = parseInt(document.getElementById('ip-case-size')?.value) || 0;
      if (cs > 0) return cost / cs;
    }
    return cost;
  },

  calcProduct() {
    const spec = this.FORM_SPEC[this._formCategory] || {};
    if (!spec.showCalcStrip) return;
    const oz    = this.getOz();
    const pour  = parseFloat(document.getElementById('ip-pour')?.value) || 0;
    const cost  = this.effectiveBottleCost();
    const price = parseFloat(document.getElementById('ip-price')?.value) || 0;
    const target = App.data?.settings?.targets?.bar_pour_cost_pct || 22;
    const pours = pour > 0 ? oz / pour : null;
    const cpp   = pours ? cost / pours : null;
    const pct   = cpp && price ? cpp / price * 100 : null;
    const set   = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };

    if (this._formCategory === 'Bottle Beer') {
      // Bottle Beer slots: Btls/Case · Cost/Btl · Pour Cost %
      const cs = parseInt(document.getElementById('ip-case-size')?.value) || 0;
      const cb = cs > 0 ? (parseFloat(document.getElementById('ip-cost')?.value) / cs) : null;
      const pct = cb && price ? cb / price * 100 : null;
      set('ip-pours', cs > 0 ? cs.toString() : '-');
      set('ip-cpp',   cb ? App.fmtBal(cb) : '-');
      set('ip-pct',   pct ? App.fmtPct(pct) : '-', pct ? (pct > target ? 'warn' : 'good') : '');
      return;
    }
    set('ip-pours', pours ? pours.toFixed(1) : '-');
    set('ip-cpp',   cpp   ? App.fmtBal(cpp) : '-');
    set('ip-pct',   pct   ? App.fmtPct(pct) : '-', pct ? (pct > target ? 'warn' : 'good') : '');
    this.recalcAllServing();
  },

  // ── Other sizes sold (serving sizes) ────────────────────────────────────────
  // The standard pour/price lives in the row above. These are the OTHER ways the
  // same bottle/keg sells: a pitcher, a happy hour pour, a whole bottle of wine.
  // Each carries its own price and shows its own pour cost, because a discounted
  // size is a thinner margin. The shelf is still one counted pool; this only
  // captures the extra price points so each size reads an honest pour cost.
  servingSizesBlockHTML(p, spec) {
    const sizes = Array.isArray(p?.serving_sizes) ? p.serving_sizes : [];
    const rows = sizes.map((s, i) => this.servingRowHTML(s, i)).join('');
    return '<div style="margin-top:18px;">'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">'
        + '<label style="margin:0;">Other Pour Sizes Sold</label>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="vss-add">+ Add a size</button>'
      + '</div>'
      + '<div id="vss-list">' + rows + '</div></div>';
  },
  servingRowHTML(s, i) {
    s = s || {};
    const spec = this.FORM_SPEC[this._formCategory] || {};
    const ph = spec.servingPlaceholder || 'Pitcher, Bottle...';
    return '<div class="vss-row" style="display:flex;gap:10px;align-items:flex-end;margin-bottom:8px;flex-wrap:wrap;">'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Name</label>'
      + '<input type="text" class="vss-label" value="' + esc(s.label || '') + '" placeholder="' + esc(ph) + '"/></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Size</label>'
      + '<div class="fw"><input class="suf vss-size" type="number" step="0.1" min="0" value="' + (s.size_oz != null ? s.size_oz : '') + '"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:100px;flex-shrink:0;"><label>Price</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre vss-price" type="number" step="0.25" min="0" value="' + (s.price != null ? s.price : '') + '"/></div></div>'
      + '<div style="font-size:11px;color:var(--t3);padding-bottom:9px;white-space:nowrap;">Pour cost <span class="vss-pct" style="font-weight:700;color:var(--t1);">-</span></div>'
      + '<button type="button" class="btn btn-ghost btn-sm vss-del" style="margin-bottom:2px;">Remove</button>'
      + '</div>';
  },
  // Pour cost for one serving-size row: (bottle cost / bottle oz) x this size, over this price.
  recalcServingRow(row) {
    if (!row) return;
    const span = row.querySelector('.vss-pct');
    if (!span) return;
    const oz   = this.getOz();
    const cost = this.effectiveBottleCost();
    const size  = parseFloat(row.querySelector('.vss-size')?.value) || 0;
    const price = parseFloat(row.querySelector('.vss-price')?.value) || 0;
    const costPerOz = oz > 0 ? cost / oz : 0;
    const pct = (size > 0 && price > 0 && costPerOz > 0) ? (costPerOz * size) / price * 100 : null;
    const target = App.data?.settings?.targets?.bar_pour_cost_pct || 22;
    span.textContent = pct != null ? App.fmtPct(pct) : '-';
    span.style.color = pct == null ? 'var(--t1)' : (pct > target ? 'var(--red)' : 'var(--green)');
  },
  recalcAllServing() {
    document.querySelectorAll('.vss-row').forEach(r => this.recalcServingRow(r));
  },
  _wireServingRow(row) {
    row.querySelectorAll('.vss-size, .vss-price').forEach(inp =>
      inp.addEventListener('input', () => this.recalcServingRow(row)));
    row.querySelector('.vss-del')?.addEventListener('click', () => row.remove());
    this.recalcServingRow(row);
  },

  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);

    const cat = this._formCategory || 'Misc';
    const spec = this.FORM_SPEC[cat] || this.FORM_SPEC['Misc'];
    const name = document.getElementById('ip-name')?.value.trim();
    const err  = document.getElementById('ip-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } this._saving = false; };
    if (!name) { fail('Product name required.'); return; }
    // Guard against duplicate product names (catches inactive products too), the
    // same way Vendors and Locations block duplicates.
    const allProds = (App.inventoryData && App.inventoryData.ic_products) || [];
    if (allProds.find(x => x.id !== this.editId && (x.name || '').trim().toLowerCase() === name.toLowerCase())) {
      fail('A product named "' + name + '" already exists. Use a different name or edit that product.'); return;
    }

    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    let oz      = spec.sizeGroup || spec.showCaseSize ? (this.getOz() || null) : null;
    // Bottle beer has no oz field (tracked by the case / bottle). Store a fixed
    // nominal bottle size so the Usage Variance oz round-trip still cancels; it is
    // never shown to or entered by the operator.
    if (cat === 'Bottle Beer') oz = 12;
    // Custom bottle/keg sizes carry the operator's own name (Gallon, 3L Box) so the
    // dropdown reads "Gallon (128 oz)"; a preset carries none. The name rides on the
    // selected option's data-name (set from the operator's edited size list).
    let sizeLabel = null;
    if ((spec.sizeGroup || spec.showCaseSize) && oz != null && !this.SIZES.some(s => s.oz === oz)) {
      const selEl = document.getElementById('ip-size');
      const opt = selEl && selEl.selectedOptions ? selEl.selectedOptions[0] : null;
      sizeLabel = (opt && opt.dataset && opt.dataset.name) ? opt.dataset.name : null;
    }
    const pour  = spec.showPour ? num('ip-pour') : null;
    const cost  = num('ip-cost');
    // Resale / sell-size data now lives on menu items (Menu Builder), not here, so
    // the product form carries the product's existing resale fields through
    // untouched (seeded resale items keep working until they migrate). Pourable
    // categories still read their menu price from ip-price.
    const cur = this.editId ? this.products().find(x => x.id === this.editId) : null;
    const soldOnMenu = spec.showUnitType ? !!document.getElementById('ip-soldmenu')?.checked : false;
    const servingsPerUnit = spec.showUnitType ? (cur && cur.servings_per_unit != null ? cur.servings_per_unit : null) : null;
    const costPerServing = spec.showUnitType ? (cur && cur.cost_per_serving != null ? cur.cost_per_serving : null) : null;
    const price = spec.showMenuPrice ? num('ip-price') : (cur && cur.menu_price != null ? cur.menu_price : null);
    const pours = oz && pour ? oz / pour : null;
    const effCost = this.effectiveBottleCost();
    const cpp   = pours && effCost != null && effCost > 0 ? effCost / pours : null;
    const pct   = cpp != null && price ? cpp / price * 100 : null;
    const caseSize = spec.showCaseSize
      ? (parseInt(document.getElementById('ip-case-size')?.value) || null)
      : null;
    const unitType = spec.showUnitType ? this.getUnitType() : null;
    const miscTypeVal = cat === 'Misc' ? (document.getElementById('ip-misctype')?.value || '') : '';
    // Food / Misc stock measure follows Track By: ounces sets container_size_oz
    // (recipe-costed per oz, fill-slider), pieces sets pack_size (per piece, full+
    // loose), by-the-unit sets neither (per unit, total count).
    if (spec.showUnitType) {
      const fromField = parseFloat(document.getElementById('ip-foz')?.value);
      oz = (this._trackBy === 'oz' && fromField > 0) ? fromField : null;
    }
    // Serving name (Food / Misc): the recipe noun, e.g. slice / patty / each.
    const servingName = spec.showUnitType ? (document.getElementById('ip-sname')?.value.trim() || null) : null;
    // Pack size: servings or pieces per unit (Food / Misc). Optional; null when
    // the unit is already the piece. Drives per-serving cost + loose counts.
    const packSize = spec.showPackSize ? (parseInt(document.getElementById('ip-pack')?.value) || null) : null;
    // How this product is counted: number / loose / slider.
    const countStyle = spec.showPackSize ? (document.getElementById('ip-cstyle')?.value || 'number') : null;
    /* Hoisted out of the record literal so they can be checked with the rest of the numbers below.
       A value validated in one place and read in another is how a form grows a hole. */
    const parLevel = num('ip-par');
    const reorderPoint = num('ip-reorder');
    /* ⚠⚠ NONE OF THESE NUMBERS CAN BE NEGATIVE, AND NOTHING WAS CHECKING (class D round 2).
       This is the widest numeric door in the app: it refused a missing name and a duplicate name,
       both by name, and then persisted SEVEN numbers raw. `min="0"` / `min="1"` sit on four of the
       inputs and stop nothing — a number input still hands back "-6" and nothing calls
       checkValidity.
       ⭐ THE TELL THAT IT IS AN OVERSIGHT AND NOT A POLICY: this same function already applies the
       rule twice — `ip-foz` is taken only `if (fromField > 0)`, and an extra serving-size row needs
       `sz > 0 && pr > 0`. Two fields of nine got the test. That is the "the field two lines above
       it in the same function" shape this class keeps producing.
       MEASURED: `unit_cost` is the number every inventory dollar descends from. At -$30 a bottle,
       the REAL `menuItemCost` prices a 1.5 oz pour at **-$1.77**, so a $12 gin and tonic shows a
       **$13.77 margin on a $12 drink** and ranks as a STAR on the Menu Engineering board. It also
       feeds COGS, usage variance and order value. `case_size` is worse than it looks, because
       bottle beer is tracked, priced and counted BY THE CASE, so a negative inverts every count
       that divides by it.
       ⚠ ZERO AND BLANK BOTH STAY LEGAL. Blank is "not measured", which is not the same number as
       zero; zero is a real answer (a comped house product genuinely costs nothing) and is already
       inert everywhere it divides — `pours = oz && pour` is falsy at 0, and `parseInt('0') || null`
       is null. Only a negative is impossible.
       ⚠ ONLY FIELDS THIS FORM ACTUALLY SHOWS are judged. `price` falls back to the STORED
       `cur.menu_price` on categories with no price cell, and refusing a save because of a legacy
       value the operator cannot even see would be a guard that refuses real work. */
    const negNums = [
      [spec.costLabel || 'Cost', cost],
      [spec.pourLabel || 'Pour Size', pour],
      ['Menu Price', spec.showMenuPrice ? price : null],
      ['Par', parLevel],
      ['Reorder', reorderPoint],
      ['Case Size', caseSize],
      ['Pieces', packSize]
    ].filter(f => f[1] != null && f[1] < 0).map(f => f[0]);
    if (negNums.length) {
      fail(negNums.join(' and ') + ' cannot be negative.');
      return;
    }
    // Other sizes sold: each row needs a size and a price to count.
    const servingSizes = [];
    if (spec.showServingSizes) {
      document.querySelectorAll('.vss-row').forEach(r => {
        const sz = parseFloat(r.querySelector('.vss-size')?.value);
        const pr = parseFloat(r.querySelector('.vss-price')?.value);
        if (sz > 0 && pr > 0) servingSizes.push({ label: r.querySelector('.vss-label')?.value.trim() || '', size_oz: sz, price: pr });
      });
    }
    // Status: edit mode reads the badge state, new mode defaults to active.
    const stateEl = document.querySelector('.ip-active-state');
    const active = stateEl ? stateEl.dataset.active === 'true' : true;

    // Primary location is the product's "home" (ordering/transfer default).
    // Any additional locations are managed from the Locations screen; preserve
    // them and make sure the primary is always included in locations[].
    const primaryLoc = document.getElementById('ip-loc1')?.value.trim() || '';
    const existingProd = this.editId ? this.products().find(x => x.id === this.editId) : null;
    const locSet = new Set(existingProd && Array.isArray(existingProd.locations) ? existingProd.locations : []);
    if (primaryLoc) locSet.add(primaryLoc);
    const locsArr = [...locSet];
    // First location placed is the ordering/transfer home. Never leave a product
    // with locations but no valid primary, or it skips the "Needs a location" flag.
    let primary = primaryLoc;
    if (!primary || !locsArr.includes(primary)) primary = locsArr[0] || '';

    const prod = {
      id:                  this.editId || App.uid(),
      name,
      brand:               document.getElementById('ip-brand')?.value.trim() || '',
      category:            cat,
      sub_category:        this.getSubcat(),
      misc_type:           cat === 'Misc' ? (document.getElementById('ip-misctype')?.value || '') : '',
      vendor:              document.getElementById('ip-vendor')?.value.trim() || '',
      vendor_item_code:    document.getElementById('ip-vcode')?.value.trim() || '',
      container_size_oz:   oz,
      container_size_label: sizeLabel,
      case_size:           caseSize,
      pack_size:           packSize,
      serving_name:        servingName,
      count_style:         countStyle,
      pour_size_oz:        pour,
      unit_type:           unitType,
      unit_cost:           cost,
      menu_price:          price,
      sold_on_menu:        soldOnMenu,
      servings_per_unit:   servingsPerUnit,
      cost_per_serving:    costPerServing,
      par_level:           parLevel,
      reorder_point:       reorderPoint,
      locations:           locsArr,
      primary_location:    primary,
      active,
      notes:               document.getElementById('ip-notes')?.value.trim() || '',
      pours_per_container: pours,
      cost_per_pour:       cpp,
      pour_cost_pct:       pct,
      serving_sizes:       servingSizes
    };

    // Row-per-record (data-safety migration): build the one record to persist —
    // on edit, merge onto the existing product so fields not on the form
    // (created_at, cost_history, imported, location_sequences) are preserved —
    // then write just that row. putRecord updates the in-memory list too.
    const list = this.products();
    let rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      rec = i > -1 ? { ...list[i], ...prod } : prod;
    } else {
      prod.created_at = new Date().toISOString();
      rec = prod;
    }

    const btn = document.getElementById('ip-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const ok = await App.putRecord('ic', 'product', rec);
    this._saving = false;
    if (ok) {
      // S152 (retry class): clear the edit context ONLY on success. Resetting editId/_formCategory
      // before this check left a refused save's retry with editId null, so the duplicate-name guard
      // (x.id !== this.editId, above) matched the product's OWN name — "already exists" on the row
      // being edited — and following that error minted a phantom Misc duplicate. The modal stays open
      // on failure, so the edit context MUST survive for the retry; the twin runImport clears inside
      // its own if(ok) for exactly this reason.
      this.editId = null;
      this._formCategory = null;
      App.markSetupDone('gs_ic_products');
      // ⚠ LAND ON A TAB THAT ACTUALLY LISTS IT (S120). This was `prod.category` unconditionally,
      // which was right while inactive products still sat on their category tab — visibleProducts()
      // now keeps `active !== false` on every working tab, so fixing an archived liquor's cost and
      // hitting Update threw the operator onto Liquor, where the row they had just edited does not
      // appear and nothing says where it went. Edit is one of only three buttons on that row.
      this.activeCat = (prod.active === false) ? this.INACTIVE_TAB : prod.category;
      App.closeModal('ip-form-modal');
      this.renderLanding();
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save';
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  // ── Delete guard ────────────────────────────────────────────────────────────
  // Plain-English summary of every LIVE place these products are used, for the delete dialog.
  // History is named but explicitly EXCLUDED: past counts, deliveries, waste and spot checks are a
  // record of what happened. Pulling a product out of last month's count would rewrite a closed
  // period's COGS, so a delete never touches them and the dialog says so.
  _delRefsSummary(refs, count) {
    const names = (arr, key) => {
      const list = arr.map(x => (x && x[key]) || '').filter(Boolean);
      const shown = list.slice(0, 4).map(n => esc(n)).join(', ');
      return list.length > 4 ? shown + ' and ' + (list.length - 4) + ' more' : shown;
    };
    const line = (n, one, many, detail) => n
      ? '<div style="font-size:12px;color:var(--t1);line-height:1.6;margin-bottom:6px;">'
        + '<strong>' + n + ' ' + (n === 1 ? one : many) + '</strong>'
        + (detail ? '<span style="color:var(--t3);"> &middot; ' + detail + '</span>' : '') + '</div>'
      : '';
    return line(refs.menuItems.length, 'menu item', 'menu items', names(refs.menuItems, 'name'))
      + line(refs.prepBatches.length, 'prep batch', 'prep batches', names(refs.prepBatches, 'name'))
      + line(refs.openOrders.length, 'open order', 'open orders', names(refs.openOrders, 'vendor'))
      + line((refs.investigations || []).length, 'open loss investigation', 'open loss investigations', names(refs.investigations || [], 'sku'))
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:10px;">'
      + 'Your count, delivery, waste and spot-check history also mentions '
      + (count === 1 ? 'it' : 'them') + '. That is a record of what happened and is never changed.'
      + '</div>';
  },
  // Three-way, because "delete or cancel" is the wrong question when something still uses it.
  // Make Inactive leads: verified in code, an inactive product drops off the count sheet, par
  // suggestions, spot checks and the order sheet, while every recipe that uses it keeps costing
  // correctly (App.menuItemCost and ic-prep-batches both read the product list unfiltered).
  _confirmDelInUse(ids, refs) {
    const what = ids.length > 1 ? 'these ' + ids.length + ' products' : 'this product';
    // ⚠ DO NOT OFFER MAKE INACTIVE TO SOMETHING ALREADY INACTIVE (S121). App.productReferences does
    // not filter on `active`, so an archived product still sitting in a recipe opens this guard —
    // and every row on the Inactive tab is archived, so 100% of guard hits there led with a blue
    // PRIMARY button that runs setActiveBulk(ids, false): a real write that changes nothing, under
    // copy describing the state the product is already in. A MIXED selection keeps the offer,
    // because it is still meaningful for the active ones.
    const sel = this.products().filter(p => p && ids.indexOf(p.id) > -1);
    const canInactivate = sel.some(p => p.active !== false);
    return new Promise(resolve => {
      const html = '<div class="card" style="margin:0;">'
        + '<div class="card-title">Something still uses ' + what + '</div>'
        + this._delRefsSummary(refs, ids.length)
        + (canInactivate
            ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin:14px 0 4px;">'
              + '<strong>Make Inactive</strong> keeps every recipe costing correctly and every past number '
              + 'true. It just stops showing on your count sheets, par suggestions, spot checks and order sheet.</div>'
            : '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin:14px 0 4px;">'
              + (ids.length > 1 ? 'These are already inactive' : 'This is already inactive')
              + ', so they are off your count sheets, par suggestions, spot checks and order sheet — '
              + 'while still costing every recipe correctly. Deleting is the only step left.</div>')
        + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-bottom:14px;">'
        + 'Deleting permanently leaves those recipes missing an ingredient. Bar Cop flags them rather '
        + 'than quietly costing the dish cheaper, but you will have to fix each one.</div>'
        + '<div class="card-actions" style="flex-wrap:wrap;">'
        + (canInactivate ? '<button class="btn btn-primary" data-act="inactive">Make Inactive</button>' : '')
        + '<button class="btn btn-ghost" data-act="cancel">Cancel</button>'
        + '<button class="btn btn-danger" data-act="delete" style="margin-left:auto;">Delete Permanently</button>'
        + '</div></div>';
      // ⚠ THE CORNER X IS A REAL EXIT AND THE PROMISE HAS TO SURVIVE IT (S37). `noClose` was dead
      // (App.openModal reads opts.noX), and it stays dead deliberately: 36 of the 44 modals in the
      // app carry no Cancel button at all, so honouring it would turn them into rooms with no door.
      // The click handler below only resolves for a [data-act] button, so closing any other way
      // left confirmDel parked on its await with nothing after it ever running — no delete (the
      // safe direction) but also no feedback and no recovery.
      // ⚠ app.js:3134 — `doClose` calls opts.onClose() INSTEAD of App.closeModal, so this handler
      // must close the modal itself or the box stays on screen over a resolved promise.
      App.openModal(html, { id: 'ip-del-guard', maxWidth: 560,
        onClose: () => { App.closeModal('ip-del-guard'); resolve(null); } });
      const root = document.getElementById('ip-del-guard');
      if (!root) { resolve(null); return; }   // no DOM: refuse rather than delete blind
      root.addEventListener('click', ev => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        App.closeModal('ip-del-guard');
        resolve(b.dataset.act === 'cancel' ? null : b.dataset.act);
      });
    });
  },
  // ⚠ LIVE rows, so putRecordsBulk cannot revert them for us (see App.putRecord). Snapshot first,
  // or a refused write leaves the list showing an archive the server never took.
  async setActiveBulk(ids, active) {
    const idSet = new Set(ids);
    const touched = this.products().filter(p => p && idSet.has(p.id));
    if (!touched.length) return true;
    const undo = App.snapshotRows(touched);
    touched.forEach(p => { p.active = active; });
    const ok = await App.putRecordsBulk('ic', 'product', touched);
    if (!ok) App.restoreRows(undo);
    return ok;
  },

  async confirmDel(ids, msg) {
    if (!ids.length) return;
    // Cross-check every LIVE use first. Deleting an ingredient out from under a recipe used to be
    // silent at both ends: no warning here, and the dish just re-costed cheaper.
    const refs = App.productReferences(new Set(ids));
    if (refs.any) {
      const choice = await this._confirmDelInUse(ids, refs);
      if (choice === 'inactive') { await this.setActiveBulk(ids, false); this.renderLanding(); return; }
      if (choice !== 'delete') return;
    } else if (!(await App.confirmDelete(ids.length > 1 ? ids.length + ' products' : null))) {
      return;
    }
    // Row-per-record: delete one row per id (removeRecord also drops it from the
    // in-memory list), so a delete only ever touches those rows, never the set.
    // ⚠ Report the TRUTH about a partial delete (S4). This loop discarded every result, so 3
    // failures out of 100 looked identical to a clean sweep — and removeRecord's toast is coalesced
    // to one line that never says WHICH. At 100 rows that is exactly when it matters.
    const failed = [];
    for (const id of ids) { if (!(await App.removeRecord('ic', 'product', id))) failed.push(id); }
    // Keep the failures SELECTED so a retry is one click; clear only what actually went.
    if (this._selected) ids.forEach(id => { if (failed.indexOf(id) < 0) this._selected.delete(id); });
    this.renderLanding();
    if (failed.length) {
      // A single-row delete (the row's Delete button) never put anything in _selected, so it must
      // not claim "still selected"; only a bulk delete keeps the failed rows selected for a retry.
      const single = ids.length === 1;
      App.confirm({
        title: single ? 'Could not delete this product' : (failed.length + ' of ' + ids.length + ' could not be deleted'),
        message: single
          ? 'It is still here, so you can try again.'
          : ((ids.length - failed.length) + ' deleted. The other ' + failed.length + ' are still here and still selected, so you can try again.'),
        confirmText: 'OK', oneButton: true, danger: false
      });
    }
  },

  // ── Bulk edit (set the same field across many selected products) ─────────────
  // After an upload you often need one value on a whole category (a 1.5 oz pour
  // on every liquor, one vendor or location across a list). Selection is scoped
  // to the active category tab, so the form shows that category's exact fields.
  // Only fields whose Apply box is checked are written; everything else stays.

  // The bulk-applicable fields per category (cost stays out — it is per-product).
  bulkFieldDefs(cat, spec) {
    const defs = [];
    if (spec.sizeGroup) defs.push({ key: 'size', label: spec.sizeLabel || 'Size', type: 'size' });
    if (spec.showPour)      defs.push({ key: 'pour', label: spec.pourLabel || 'Pour Size', type: 'oz' });
    if (spec.showCaseSize)  defs.push({ key: 'case', label: 'Case Size', type: 'int', suffix: 'btl' });
    if (spec.showUnitType)  defs.push({ key: 'unit', label: 'Unit Type', type: 'unit' });
    if (spec.showMenuPrice) defs.push({ key: 'price', label: 'Menu Price', type: 'money' });
    if (cat === 'Misc') defs.push({ key: 'misctype', label: 'Misc Type', type: 'misctype' });
    else                defs.push({ key: 'subcat',   label: 'Sub-Category', type: 'subcat' });
    defs.push({ key: 'vendor',  label: 'Primary Vendor',   type: 'vendor' });
    defs.push({ key: 'loc',     label: 'Primary Location', type: 'location' });
    defs.push({ key: 'par',     label: 'Par' + (spec.parUnit ? ' (' + spec.parUnit + ')' : ''),     type: 'int' });
    defs.push({ key: 'reorder', label: 'Reorder' + (spec.parUnit ? ' (' + spec.parUnit + ')' : ''), type: 'int' });
    return defs;
  },

  bulkInputHTML(def, spec, cat) {
    const k = def.key;
    if (def.type === 'subcat') {
      const opts = (App.subcatSuggestions(cat) || []).filter(o => o.toLowerCase() !== 'other');
      return '<select id="be-subcat" class="be-input" data-key="subcat"><option value="">Select...</option>'
        + opts.map(o => '<option>' + esc(o) + '</option>').join('')
        + '<option>Other</option></select>';
    }
    if (def.type === 'misctype') {
      return '<select id="be-misctype" class="be-input" data-key="misctype"><option value="">Select...</option>'
        + (App.MISC_TYPES || []).map(t => '<option>' + esc(t) + '</option>').join('')
        + '</select>';
    }
    if (def.type === 'size') {
      // Sizes are managed only through the single-product form's "| Edit" list now.
      return '<select id="be-size" class="be-input" data-key="size">' + this.sizeOpts(null, spec.sizeGroup) + '</select>';
    }
    if (def.type === 'oz')   return '<div class="fw"><input class="suf be-input" type="number" id="be-' + k + '" step="0.25" data-key="' + k + '"/><span class="suf">oz</span></div>';
    if (def.type === 'money') return '<div class="fw"><span class="pre">$</span><input class="pre be-input" type="number" id="be-' + k + '" step="0.25" data-key="' + k + '" placeholder="0.00"/></div>';
    if (def.type === 'int') {
      return def.suffix
        ? '<div class="fw"><input class="suf be-input" type="number" id="be-' + k + '" step="1" min="0" data-key="' + k + '"/><span class="suf">' + esc(def.suffix) + '</span></div>'
        : '<input type="number" class="be-input" id="be-' + k + '" step="1" min="0" data-key="' + k + '"/>';
    }
    if (def.type === 'unit') {
      // Unit types are managed only through the single-product form's "| Edit" list.
      App._listBuiltins['unit_type'] = App.IC_FOOD_UNIT_TYPES;
      let opts = '<option value="">Select unit...</option>';
      App.listOptions('unit_type').forEach(u => { opts += '<option value="' + esc(u) + '">' + esc(u) + '</option>'; });
      return '<select id="be-unit" class="be-input" data-key="unit">' + opts + '</select>';
    }
    if (def.type === 'vendor')   return '<select id="be-vendor" class="be-input" data-key="vendor">' + this.vendorOpts(null) + '</select>';
    if (def.type === 'location') return '<select id="be-loc" class="be-input" data-key="loc">' + this.locationOpts(null) + '</select>';
    return '';
  },

  openBulkEdit() {
    const ids = [...(this._selected || [])];
    if (!ids.length) return;
    const cat = this.activeCat;
    // ⚠ Guarded, not just hidden. The toolbar no longer offers Bulk Edit on the Inactive
    // tab, but a UI-only fix would leave the data-wiping path one stale click away — the
    // form built here from `FORM_SPEC['Misc']` (the silent fallback for a category that
    // has no spec) offered an EMPTY Sub-Category dropdown whose every touch wrote
    // sub_category = '' across a mixed-category selection. There is no correct
    // bulk-edit form for a cross-category list, so this door is simply shut.
    if (cat === this.INACTIVE_TAB) return;
    const spec = this.FORM_SPEC[cat] || this.FORM_SPEC['Misc'];
    const n = ids.length;
    const fieldsHTML = this.bulkFieldDefs(cat, spec).map(def =>
      '<div class="f">'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" class="bc-check be-apply" data-key="' + def.key + '"/>'
        + '<span>' + esc(def.label) + '</span>'
      + '</label>'
      + this.bulkInputHTML(def, spec, cat)
      + '</div>').join('');
    const body = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Bulk Edit ' + n + ' ' + esc(cat) + ' Product' + (n === 1 ? '' : 's') + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 18px;">' + fieldsHTML + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="be-apply-btn">Apply to ' + n + ' Product' + (n === 1 ? '' : 's') + '</button>'
        + '<span id="be-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
    // `noClose` removed: it was never read (App.openModal reads opts.noX) and the X stays by design
    // (S37). Nothing hangs on this one — applyBulk is fired by a button and nothing awaits the box —
    // so closing with the X simply abandons the edit, which is what it looks like it does.
    App.openModal(body, { id: 'ip-bulk-modal', layer: 9000, maxWidth: 640 });
    this._wireBulk(cat, spec, ids);
  },

  _wireBulk(cat, spec, ids) {
    document.getElementById('be-apply-btn')?.addEventListener('click', () => this.applyBulk(ids));
    // Touching a field auto-checks its Apply box (automate the obvious step).
    document.querySelectorAll('.be-input').forEach(inp => {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        const box = document.querySelector('.be-apply[data-key="' + inp.dataset.key + '"]');
        if (box) box.checked = true;
      });
    });
  },

  async applyBulk(ids) {
    const applied = {};
    /* The label the modal actually rendered beside each checkbox, captured here rather than kept
       as a second copy of the list: these names are PER CATEGORY ("Pour Size" vs "Glass Size",
       "Par (btl)" vs "Par (cs)"), so a hardcoded set would be wrong on half the categories and
       would drift the next time bulkFieldDefs changes. */
    const applyLabel = {};
    document.querySelectorAll('.be-apply').forEach(box => {
      if (!box.checked) return;
      applied[box.dataset.key] = true;
      const span = box.parentElement && box.parentElement.querySelector('span');
      applyLabel[box.dataset.key] = (span && span.textContent.trim()) || box.dataset.key;
    });
    const err = document.getElementById('be-err');
    if (!Object.keys(applied).length) {
      if (err) { err.textContent = 'Turn on at least one field to apply.'; err.style.display = 'inline'; }
      return;
    }
    const num = id => { const el = document.getElementById(id); if (!el) return null; const n = parseFloat(el.value); return isNaN(n) ? null : n; };
    const intVal = id => { const el = document.getElementById(id); if (!el) return null; const n = parseInt(el.value); return isNaN(n) ? null : n; };
    const getSize = () => {
      const n = parseFloat(document.getElementById('be-size')?.value); return isNaN(n) ? null : n;
    };
    // The size option carries a custom name (data-name) for non-built-in sizes; the
    // single save sets container_size_label alongside the oz, so bulk must too, or a
    // changed size renders the OLD label against the new oz.
    const getSizeLabel = () => {
      const sel = document.getElementById('be-size');
      const opt = sel && sel.selectedOptions ? sel.selectedOptions[0] : null;
      return (opt && opt.dataset && opt.dataset.name) ? opt.dataset.name : '';
    };
    const getUnit = () => document.getElementById('be-unit')?.value || null;
    /* ⚠⚠ THE BULK TWIN OF THE SINGLE FORM'S GUARD (class D round 2), and the worse of the pair:
       one typo here lands on EVERY product in the selection. The single form now refuses a negative
       on seven fields; this door writes five of the same ones — pour, case size, menu price, par,
       reorder — into the same store and tested none of them.
       ⚠⚠ IT SITS HERE, ABOVE THE SNAPSHOT, AND THAT PLACEMENT IS THE WHOLE CARE OF IT. Below the
       loop this handler has already MUTATED the live rows, and its own comment fourteen lines down
       explains what that costs: "THE RETRY IS THE WORSE HALF. The modal stays open on a failure,
       and applyBulk assigns only the fields ticked THIS time — so a refused value left standing in
       memory is written by the NEXT attempt." A refusal added after the mutation would rebuild
       exactly that hole ([[the-loop]] #49). Refusing here touches nothing at all, so there is
       nothing to roll back.
       ⚠ ONLY TICKED FIELDS ARE JUDGED — `applied[key]` is what decides whether a value is written
       at all, so a stale number in an un-ticked box must not block a save it has no part in.
       ⚠ `size` is NOT judged: it is a select of preset sizes and cannot produce a negative. */
    const negBulk = [
      ['pour', num('be-pour')], ['case', intVal('be-case')], ['price', num('be-price')],
      ['par', num('be-par')], ['reorder', num('be-reorder')]
    ].filter(f => applied[f[0]] && f[1] != null && f[1] < 0).map(f => applyLabel[f[0]] || f[0]);
    if (negBulk.length) {
      if (err) { err.textContent = negBulk.join(' and ') + ' cannot be negative.'; err.style.display = 'inline'; }
      return;
    }
    const idSet = new Set(ids);
    // ⚠ LIVE rows, so putRecordsBulk cannot revert them for us (see App.putRecord) — the same
    // reason setActiveBulk above snapshots. SELECT FIRST, snapshot, THEN mutate: this used to
    // mutate as it collected, so a refused write left every edited product holding the new
    // pour / par / vendor AND the derived cost_per_pour and pour_cost_pct the list colours
    // red or green off — a percentage the server never took.
    // ⚠⚠ THE RETRY IS THE WORSE HALF. The modal stays open on a failure, and applyBulk assigns
    // only the fields ticked THIS time — so a refused value left standing in memory is written
    // by the NEXT attempt, and the change the server refused becomes permanent.
    const touched = this.products().filter(p => p && idSet.has(p.id));
    const undo = App.snapshotRows(touched);
    touched.forEach(p => {
      if (applied.size)    { p.container_size_oz = getSize(); p.container_size_label = getSizeLabel(); }
      if (applied.pour)    p.pour_size_oz = num('be-pour');
      if (applied.case)    p.case_size = intVal('be-case');
      if (applied.unit)    p.unit_type = getUnit();
      if (applied.price)   p.menu_price = num('be-price');
      if (applied.subcat)   p.sub_category = (document.getElementById('be-subcat')?.value || '');
      if (applied.misctype) p.misc_type = (document.getElementById('be-misctype')?.value || '');
      if (applied.vendor)  p.vendor = (document.getElementById('be-vendor')?.value || '').trim();
      if (applied.loc) {
        const locVal = (document.getElementById('be-loc')?.value || '').trim();
        const locSet = new Set(Array.isArray(p.locations) ? p.locations : []);
        if (locVal) locSet.add(locVal);
        p.locations = [...locSet];
        let primary = locVal;
        if (!primary || !p.locations.includes(primary)) primary = p.locations[0] || '';
        p.primary_location = primary;
      }
      if (applied.par)     p.par_level = num('be-par');
      if (applied.reorder) p.reorder_point = num('be-reorder');
      this.recomputeDerived(p);
    });
    const btn = document.getElementById('be-apply-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
    // Row-per-record: write only the edited products in one bulk upsert.
    const ok = await App.putRecordsBulk('ic', 'product', touched);
    if (ok) {
      App.closeModal('ip-bulk-modal');
      this._selected = new Set();
      this.renderLanding();
    } else {
      // Memory goes back FIRST, and never gated on the error element being on screen — this
      // whole branch used to hang off `else if (err)`, so a missing #be-err would have kept the
      // refused values AND left the button stuck reading "Applying...".
      App.restoreRows(undo);
      if (btn) { btn.disabled = false; btn.textContent = 'Apply to ' + ids.length + ' Product' + (ids.length === 1 ? '' : 's'); }
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  // Recompute a product's derived fields from its own values, matching save() and
  // runImport() exactly (bottle beer divides the cost-per-case by case size; a
  // non-pourable item has no pour, so its pour-based figures stay null).
  recomputeDerived(p) {
    const oz = p.container_size_oz || 0;
    const pour = p.pour_size_oz || 0;
    const price = p.menu_price || 0;
    let effCost = p.unit_cost;
    if (p.category === 'Bottle Beer' && p.case_size > 0 && p.unit_cost != null) effCost = p.unit_cost / p.case_size;
    const pours = oz && pour ? oz / pour : null;
    const cpp = pours && effCost != null && effCost > 0 ? effCost / pours : null;
    const pct = cpp != null && price ? cpp / price * 100 : null;
    p.pours_per_container = pours;
    p.cost_per_pour = cpp;
    p.pour_cost_pct = pct;
  },

  // ── Import (category-scoped CSV / Excel with column mapping) ──────────────
  // Each category card has its own Import link. The category is locked at
  // import time so the mapping schema can include only category-relevant
  // columns (Case Size for Bottle Beer, Keg Size for Draft, Unit Type for
  // Food and Misc) and we never compute cost_per_pour with the wrong divisor.

  // Category-specific column maps. Each category gets only the fields that
  // actually live on its form so the operator is not picking columns for
  // fields that will be ignored.
  importFieldsForCategory(cat) {
    const COMMON = [
      {key:'name',          label:'Product Name',  required:true,  aliases:['name','item','product','description','item name','product name','item description','product description','item desc']},
      {key:'brand',         label:'Brand',         required:false, aliases:['brand','make','label','manufacturer','producer','brand name','maker']},
      // ⚠ `dept`/`department`/`group`: a distributor guide labels its category column that
      // way constantly, and without them the whole column went unbound and unsortable.
      {key:'sub_category',  label:'Sub-Category',  required:false, aliases:['sub-category','subcategory','sub category','subtype','type','category','style','varietal','class','dept','department','group','family','major group','product type','product class']},
      {key:'vendor',        label:'Primary Vendor',required:false, aliases:['vendor','supplier','distributor','source','primary vendor','supplier name','vendor name','distributor name','purveyor']},
      // ⚠ `unit price`/`your price`/`net`: measured unbound on a real-shaped guide, which
      // left every product with no cost at all. `price` alone stays with MENU price.
      {key:'unit_cost',     label:'Unit Cost ($)', required:false, aliases:['cost','unit cost','cogs','item cost','wholesale','price paid','case cost','cost per unit','wholesale cost','purchase price','buy price','cost each','unit price','your price','net price','net cost','case price','bottle cost','invoice cost']},
    ];
    if (cat === 'Liquor' || cat === 'Wine') {
      return COMMON.concat([
        {key:'container_size_oz',label:'Bottle Size (oz)', required:false, aliases:['size','bottle size','container','volume','oz','ounces','container size','bottle volume','size (oz)']},
        {key:'pour_size_oz',     label:'Pour Size (oz)',   required:false, aliases:['pour','pour size','standard pour','std pour','serving','pour (oz)','serving size','shot size']},
        {key:'menu_price',       label:'Menu Price ($)',   required:false, aliases:['price','menu price','sell price','retail','selling price','pour price','glass price','list price','sell','sells for','menu','shelf price','rtl']},
        {key:'par_level',        label:'Par (bottles)',    required:false, aliases:['par','par level','target stock','par stock','target par']},
        {key:'reorder_point',    label:'Reorder Point (bottles)', required:false, aliases:['reorder','reorder point','min','minimum','reorder level','min stock','minimum stock']},
      ]);
    }
    if (cat === 'Bottle Beer') {
      return COMMON.map(f => f.key === 'unit_cost' ? {...f, label:'Cost per Case ($)'} : f).concat([
        {key:'case_size',        label:'Case Size (bottles per case)', required:false, aliases:['case','case size','case pack','pack','bottles per case','pack size','units per case','case qty','case quantity','case count','pack count']},
        {key:'menu_price',       label:'Menu Price ($ per bottle)', required:false, aliases:['price','menu price','sell price','retail','bottle price','selling price','list price','sell','sells for','menu','shelf price','rtl']},
        {key:'par_level',        label:'Par (cases)',      required:false, aliases:['par','par level','target stock','par stock','target par']},
        {key:'reorder_point',    label:'Reorder Point (cases)', required:false, aliases:['reorder','reorder point','min','minimum','reorder level','min stock','minimum stock']},
      ]);
    }
    if (cat === 'Draft Beer') {
      return COMMON.map(f => f.key === 'unit_cost' ? {...f, label:'Cost per Keg ($)'} : f).concat([
        {key:'container_size_oz',label:'Keg Size (oz)',   required:false, aliases:['size','keg','keg size','volume','oz','ounces','keg volume','container size','size (oz)']},
        {key:'pour_size_oz',     label:'Pour Size (oz)',  required:false, aliases:['pour','pour size','standard pour','std pour','serving','pour (oz)','serving size','glass size']},
        {key:'menu_price',       label:'Menu Price ($)',  required:false, aliases:['price','menu price','sell price','retail','pour price','glass price','selling price','sell','sells for','menu','shelf price','rtl']},
        {key:'par_level',        label:'Par (kegs)',      required:false, aliases:['par','par level','target stock','par stock','target par']},
        {key:'reorder_point',    label:'Reorder Point (kegs)', required:false, aliases:['reorder','reorder point','min','minimum','reorder level','min stock','minimum stock']},
      ]);
    }
    const tail = [
      {key:'unit_type',         label:'Unit Type (lb / case / each / gallon / ...)', required:false, aliases:['unit','unit type','uom','unit of measure','measure','buy unit','order unit','purchase unit']},
      {key:'container_size_oz', label:'Container Size (oz, for a liquid)', required:false, aliases:['size','container','container size','volume','oz','ounces','bottle size','size (oz)','net weight','fluid ounces']},
      {key:'pack_size',         label:'Pieces / Servings per Unit', required:false, aliases:['pack','pack size','servings','servings per unit','pieces','pieces per unit','units per','per unit','yield','count per unit','pieces per case','servings per case','pieces per pack']},
      {key:'serving_name',      label:'Serving / Piece Name', required:false, aliases:['serving name','piece','piece name','portion name','each name','unit name','portion','piece unit']},
      {key:'par_level',         label:'Par Level',     required:false, aliases:['par','par level','target stock','par stock','target par']},
      {key:'reorder_point',     label:'Reorder Point', required:false, aliases:['reorder','reorder point','min','minimum','reorder level','min stock','minimum stock']},
    ];
    if (cat === 'Misc') {
      // Misc swaps free-text Sub-Category for the structured Misc Type tag.
      return COMMON.filter(f => f.key !== 'sub_category').concat([
        {key:'misc_type', label:'Misc Type (NA Beverage / Drink Mixer / Garnish / supply)', required:false, aliases:['misc type','type','group','category','sub-category','subcategory','sub category','item type','classification','kind']},
      ], tail);
    }
    // Food
    return COMMON.concat(tail);
  },

  /* ⛔ THE MAPPER MUST OFFER EVERY FIELD THE FILE COULD NEED, NOT JUST THE CARD'S.
     Found by Kyle walking a real beer order guide, and no fixture of mine could have
     found it: my harness handed rows straight to runImport, so it supplied fields the
     card door never offers.
     `importFieldsForCategory` is right about ONE category, and it was the whole story
     while the category was locked. Now a file can route into several, so a beer guide
     dropped on Bottle Beer offered 9 fields with no Pour Size and no Keg Size in them —
     and the file's own `Std Pour` column, holding 16, bound to NOTHING. The 8 kegs
     landed with no keg size and no pour, which is no pours per keg, no cost per pour,
     no pour cost, and Incomplete in red. The routing worked and the data was thrown
     away one step earlier ([[the-loop]] #38: the fact was in the column next to the
     one being read).
     So the card's own fields come FIRST, with the card's own labels, and anything the
     other categories need is appended after. An unmatched field renders as (skip) and
     costs nothing; runImport still gates every field on the ROW's category, so a pour
     mapped on a bottle-beer row is read and correctly ignored. */
  IMPORT_UNION_EXTRAS: [
    { key: 'container_size_oz', label: 'Container / Keg Size (oz)' },
    { key: 'pour_size_oz',      label: 'Pour Size (oz)' },
    { key: 'case_size',         label: 'Case Size (bottles per case)' },
    { key: 'unit_type',         label: 'Unit Type (lb / case / each / gallon / ...)' },
    { key: 'pack_size',         label: 'Pieces / Servings per Unit' },
    { key: 'serving_name',      label: 'Serving / Piece Name' },
    { key: 'misc_type',         label: 'Misc Type' },
    /* ⚠ CARRIES ITS OWN ALIASES: no category's field list defines this key, so the merge
       below finds nothing for it and CSVMapper would be left matching only the literal
       key and label. These are the headings a real order guide uses. */
    { key: 'vendor_item_code',  label: 'Vendor Item #', aliases: [
      'item #', 'item number', 'item no', 'item code', 'itemnum', 'item id',
      'sku', 'product code', 'product number', 'part number', 'part #',
      'vendor item', 'vendor item #', 'vendor code', 'catalog #', 'catalog number', 'stock code'] }
  ],
  importFieldsForImport(cat) {
    const own = this.importFieldsForCategory(cat);
    const have = new Set(own.map(f => f.key));
    // Merge each extra's aliases across every category that defines it, so a column
    // matches as well here as it would on its own card.
    const aliasesFor = key => {
      const out = new Set();
      (App.IC_CATEGORIES || []).forEach(c => {
        const f = this.importFieldsForCategory(c).find(x => x.key === key);
        if (f) (f.aliases || []).forEach(a => out.add(a));
      });
      return [...out];
    };
    return own.concat(this.IMPORT_UNION_EXTRAS
      .filter(e => !have.has(e.key))
      // Its own aliases where it has them (a key no category defines), else the merge.
      .map(e => ({ key: e.key, label: e.label, required: false, aliases: e.aliases || aliasesFor(e.key) })));
  },

  // In-place import panel rendered in the landing's lower area. Two stages:
  // 'drop' (drag-drop / browse zone) then 'mapper' (column matching) — same
  // spot, no page change. Wired in wireLanding().
  // The upload uses the shared CSVMapper (drop -> Map Your Columns -> preview ->
  // Import), mounted in wireLanding, so it matches every other import in the app.
  /* ── THE WALK ─────────────────────────────────────────────────────────────
     Kyle, 2026-08-03, and he is right: *"The process has no steps.. it's just drop
     downs and buttons"*. An operator does this ONCE, on day one, having never seen it,
     and it is one of the first things they do — so a bad five minutes here is where
     they decide the whole app is not worth the trouble.
     ⛔ THIS IS THE DOCUMENTED EXCEPTION TO "no explainer text on cards"
     ([[form-table-standard]]). That rule exists to kill tiny grey afterthoughts under
     fields somebody already understands. Here nobody understands anything yet. The
     lead is normal readable body text, not a 11px whisper, because it is meant to be
     read — which is also why D2's card-prose ratchet does not see it. ONE line per
     step, never a paragraph. */
  /* ⛔ SECTIONS, NOT STEP NUMBERS (Kyle, 2026-08-03, after seeing them): *"the step circle
     numbers are messed up and not needed.. it just needs to be clearly sectioned and
     explain what each section is"*. Numbering broke the moment a section was conditional
     (the supplier one rendered a blank circle), and the numbers were never the point.
     A heading that says what the section is, and one line only where the section is not
     self-explanatory. */
  _sectionHead(title, lead) {
    return '<div class="card-title">' + esc(title) + '</div>'
      + (lead ? '<div style="font-size:13.5px;color:var(--t2);line-height:1.55;margin:0 0 18px;">' + lead + '</div>' : '');
  },

  importPanelHTML() {
    /* ⚠ NO HEADING AND NO LEAD ON THIS ONE. CSVMapper already prints "Drop your Liquor
       product file here" with its own requirements line, and then "MAP YOUR COLUMNS /
       Match each field to a column from your file. Detected columns are pre-selected."
       Adding a section head over the top of that said the same thing twice, which is the
       "too much text" half of the complaint. A screen that already explains itself gets
       nothing from us. */
    return '<div class="card form-card" id="ip-import-panel">'
      + '<div id="ip-csv"></div>'
      + '</div>'
      + '<div id="ip-imp-cancel-row" class="no-print" style="margin:16px 0 24px;"><button type="button" class="btn btn-ghost" id="ip-imp-cancel">Cancel</button></div>'
      + '<div id="ip-csv-actions" class="no-print" style="margin:0 0 24px;"></div>';
  },

  /* ── ROUTING: what is actually in this file? ──────────────────────────────
     Sits between the column mapper and runImport. The import used to assume its
     category from whichever card was clicked, which is right for a wine list and
     wrong for the file operators actually have: a vendor order guide holds kegs
     AND cases, and an export from another system holds everything. Dropped on one
     card, every row became that category silently.
     ⛔ NOTHING IS GUESSED INTO EXISTENCE. Every value the operator has not set
     stays on Skip, and a skipped row is not imported and is named in the result. */

  // Columns that could name a category. Only ones already mapped, holding more than
  // one distinct value, and few enough to be a category rather than free text.
  /* ⛔ THE PACK COLUMN IS IN HERE ON PURPOSE, AND IT IS THE WHOLE BEER CASE.
     A beer distributor's order guide is THE file this feature exists for, and its type
     column holds STYLES: IPA, Lager, Stout. A style cannot answer draft-or-bottle, because
     the same IPA is sold as a 1/2 BBL keg and as a 24/12 oz case, and grouping by style
     puts both in one group where the operator can only pick one category for the pair.
     The pack column is the only thing in the file that separates them. It survives to here
     as its RAW string (`_packCount`/`_sizeToOz` do not run until runImport), so
     "1/2 BBL" and "24/12 oz CAN" are groupable values. Measured before adding it. */
  ROUTE_CANDIDATES: [
    { key: 'sub_category',     label: 'Sub-Category' },
    { key: 'case_size',        label: 'Case / Pack' },
    { key: 'container_size_oz', label: 'Size' },
    { key: 'unit_type',        label: 'Unit Type' },
    { key: 'misc_type',        label: 'Misc Type' }
  ],
  _groupableColumns(rows) {
    return this.ROUTE_CANDIDATES.filter(c => {
      const vals = new Set((rows || []).map(r => String(r[c.key] == null ? '' : r[c.key]).trim()).filter(Boolean));
      return vals.size > 1 && vals.size <= 60;
    });
  },
  // Distinct values of the chosen column, biggest group first. '' collects every row
  // whose cell is empty, which is a real bucket on an order guide (header and subtotal
  // lines) and must be visible rather than silently folded into something.
  _routeGroups(rows, key) {
    const n = {};
    (rows || []).forEach(r => { const v = String(r[key] == null ? '' : r[key]).trim(); n[v] = (n[v] || 0) + 1; });
    return Object.keys(n).map(v => ({ value: v, count: n[v] }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  },

  /* Pre-fill only what the word itself settles. A spirit names its own category; a beer
     STYLE does not, because an IPA is a keg or a case and the file does not say which.
     Guessing there would put product in the wrong category on the app's most common
     order guide, so those come back '' and the operator picks. */
  /* ⛔ THE THIN WORD LIST IS WHAT FORCED THE COMPLICATED SCREEN (Kyle, 2026-08-03:
     "this whole process is complicated as heck"). The first version matched the WHOLE
     cell exactly, so it knew Chardonnay and Cabernet and did not know Pinot Noir or
     Sauvignon Blanc — which are just as common. Most rows came back unset, and because
     most rows came back unset the operator had to hand-classify a fourteen-row
     worksheet. Bar Cop was making the operator do its job.
     These are FINITE, WELL-KNOWN lists, not inference: spirit types, wine varietals, and
     the pack formats a distributor writes. A whitelist can be wrong about a word; it
     cannot be wrong about a rule it never made up.
     ⚠ BEER STYLES ARE STILL ABSENT AND THAT IS DELIBERATE. An IPA is a keg or a case and
     the file does not say which. Pinned as F3, and widening the vocabulary must not
     quietly undo it. */
  _ROUTE_HINTS: {
    'Liquor': ['liquor','spirit','spirits','vodka','gin','rum','rhum','cachaca','tequila','mezcal',
      'whiskey','whisky','bourbon','rye','scotch','irish whiskey','single malt','blended whiskey',
      'cognac','armagnac','brandy','calvados','grappa','pisco','soju','shochu','aquavit','akvavit',
      'liqueur','liqueurs','cordial','cordials','schnapps','amaro','amari','absinthe','anisette',
      'sambuca','ouzo','triple sec','curacao','irish cream','aperitif','apertif','digestif',
      'bitters','blanco','reposado','anejo','overproof','well','call','premium','top shelf'],
    'Wine': ['wine','wines','house red','house white','red blend','white blend','red wine','white wine','rose','rosé','blush','sparkling','champagne',
      'prosecco','cava','chardonnay','cabernet','sauvignon','merlot','pinot','noir','grigio','gris',
      'riesling','malbec','zinfandel','syrah','shiraz','moscato','muscat','tempranillo','sangiovese',
      'chianti','rioja','bordeaux','burgundy','barolo','nebbiolo','viognier','albarino','verdejo',
      'gewurztraminer','chenin','semillon','grenache','mourvedre','carmenere','primitivo',
      'montepulciano','valpolicella','malvasia','torrontes','vinho','port','sherry','madeira',
      'marsala','sangria','by the glass','btg'],
    /* Pack formats, and they are the beer order guide's only honest discriminator. A
       barrel is a keg and a can is a can, with no judgement involved.
       ⚠ `btl` is deliberately ABSENT: a liquor guide writes "12/750ML BTL", so it would
       file spirits as bottle beer. That group comes up unset and the operator sets it. */
    'Draft Beer':  ['draft','draught','keg','kegs','bbl','barrel','half barrel','sixtel','on tap','tap'],
    /* ⚠ `oz btl` / `oz bottle` as PHRASES, never a bare `btl`. Bare would have filed a
       liquor guide's "12/750ML BTL" as bottle beer; with the ounce attached, "24/12 OZ
       BTL" matches and the millilitre form cannot. Excluding `btl` outright was the safe
       first move and it cost three real products (Corona, Bud Light Bottles, Michelob)
       on the beer guide — measured, which is what showed the phrase was worth finding. */
    'Bottle Beer': ['bottle beer','bottled beer','can','cans','canned','package beer','packaged beer',
      'six pack','sixpack','6pk','12pk','24pk','oz btl','oz bottle','oz bottles'],
    'Food': ['food','produce','meat','beef','pork','poultry','chicken','seafood','fish','shellfish',
      'dairy','cheese','bakery','bread','frozen','grocery','dry goods','spice','spices','sauce',
      'sauces','oil','oils','condiment','condiments','flour','sugar','baking'],
    'Misc': ['na beverage','n/a beverage','non alcoholic','non-alcoholic','nonalcoholic','soda',
      'sodas','cola','juice','juices','mixer','mixers','syrup','syrups','puree','garnish','garnishes',
      'supply','supplies','paper','paper goods','disposable','disposables','chemical','chemicals',
      'cleaning','glassware','smallwares','straws','napkins','co2','ice','tonic','seltzer','water',
      'energy drink','coffee','tea','bib','bag in box','sprite','pepsi','fanta','dr pepper',
      'mountain dew','canada dry','schweppes','red bull','monster','ocean spray','monin','torani']
  },
  /* ⭐⭐ THE BRAND LIST — Kyle, 2026-08-03: *"is there no way to store a master list to auto
     recognize the names? Jim Beam and Jack Daniels.. Bar Cop should be able to know those
     are bourbon"*. He is right, and the bigger miss was that I was only ever reading the
     CATEGORY COLUMN. The PRODUCT NAME says it outright most of the time — "Smirnoff VODKA
     80", "Barefoot CHARDONNAY", "Coors Light Half BBL", "Coca-COLA BIB" — and this list is
     only for the ones where it does not.
     ⛔ NO BEER BRANDS, deliberately. A brand cannot say draft or bottle: Coors Light ships
     as both, which is the same reason beer STYLES are not in the vocabulary. Beer is
     answered by the pack column or not at all.
     Merged into `_ROUTE_HINTS` rather than matched separately, so brands get the same token
     rules, the same phrase rules and the same two-categories-means-unset conflict test. */
  _BRAND_HINTS: {
    'Liquor': ['jim beam','jack daniel','makers mark','wild turkey','knob creek','bulleit','woodford',
      'buffalo trace','evan williams','four roses','elijah craig','jameson','tullamore','bushmills',
      'crown royal','canadian club','johnnie walker','dewar','chivas','glenlivet','glenfiddich',
      'macallan','smirnoff','absolut','stolichnaya','stoli','titos','grey goose','ketel one',
      'belvedere','svedka','new amsterdam','bacardi','captain morgan','malibu','kraken','sailor jerry',
      'patron','jose cuervo','don julio','casamigos','espolon','herradura','milagro','hornitos',
      'tanqueray','bombay','beefeater','hendricks','aviation','jagermeister','fireball','baileys',
      'kahlua','cointreau','grand marnier','disaronno','frangelico','chambord','campari','aperol',
      'hennessy','courvoisier','remy martin','martell','rumchata','southern comfort'],
    'Wine': ['barefoot','sutter home','yellow tail','kendall jackson','la crema','josh cellars',
      'louis martini','meiomi','apothic','cupcake','la marca','kim crawford','whitehaven',
      'santa margherita','ruffino','bogle','19 crimes','dark horse','beringer','robert mondavi',
      'caymus','decoy','menage a trois','sonoma cutrer','oyster bay','matua','mark west','clos du bois']
  },
  /* Matches the whole cell, a multi-word phrase inside it, or a single WHOLE TOKEN.
     ⚠ TOKENS, NEVER SUBSTRINGS. "Ginger Beer" contains the letters g-i-n and a substring
     match would file a mixer as liquor; as tokens it is [ginger, beer] and `gin` does not
     appear. Same trap protects "Canadian Whisky" from the `can` in bottle beer.
     ⛔ AND IF TWO CATEGORIES BOTH CLAIM THE VALUE, IT SETTLES NOTHING — return unset. A
     "Bourbon Barrel Aged" line hits both Liquor and Draft Beer, and unset is the honest
     answer there, not whichever category happened to be checked first. */
  _guessCategory(value) {
    // Apostrophes out first, so one spelling covers "Tito's"/"Titos",
    // "Jack Daniel's"/"Jack Daniels", "Maker's Mark"/"Makers Mark".
    const s = String(value || '').trim().toLowerCase().replace(/['’]/g, '');
    if (!s) return '';
    const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
    const hits = new Set();
    const test = list => (list || []).some(w =>
      w === s || (w.indexOf(' ') > -1 ? s.indexOf(w) > -1 : tokens.indexOf(w) > -1));
    for (const cat of Object.keys(this._ROUTE_HINTS)) {
      if (test(this._ROUTE_HINTS[cat]) || test(this._BRAND_HINTS[cat])) hits.add(cat);
    }
    return hits.size === 1 ? [...hits][0] : '';
  },
  /* A group the vocabulary cannot name may still be settled by ANOTHER column in the same
     file, and this is where a real guide gets rescued: "Stout" says nothing about draft or
     bottle, but if every Stout row reads 1/2 BBL in the pack column then the file has
     answered it.
     ⛔ ALL OR NOTHING. One row in the group disagreeing, or one row the other column
     cannot name either, and it stays unset. That is what keeps "Light Lager" — which
     genuinely ships as both a keg and a case — out of the wrong category, and it is the
     difference between reading a fact the file contains and inferring one it does not
     ([[the-loop]] #30). */
  _agreeAcross(rows, key, value, others) {
    const mine = (rows || []).filter(row => String(row[key] == null ? '' : row[key]).trim() === value);
    if (!mine.length) return '';
    /* ⭐ THE PRODUCT NAME IS TRIED FIRST, and it is the source I had ignored completely.
       "DEPT-12" says nothing, but every row under it reads Smirnoff Vodka, Absolut Vodka,
       Jim Beam, Jack Daniels, Bombay Sapphire — the answer was in the name column the
       whole time, on the same row ([[the-loop]] #38: the fact was in the column next to
       the one being read).
       Same all-or-nothing rule: every row in the group has to agree, or it stays unset. */
    const byName = new Set();
    let allNamed = true;
    for (const row of mine) {
      const g = this._guessCategory(String(row.name == null ? '' : row.name).trim());
      if (!g) { allNamed = false; break; }
      byName.add(g);
    }
    if (allNamed && byName.size === 1) return [...byName][0];
    for (const c of others) {
      const seen = new Set();
      let all = true;
      for (const row of mine) {
        const g = this._guessCategory(String(row[c.key] == null ? '' : row[c.key]).trim());
        if (!g) { all = false; break; }
        seen.add(g);
      }
      if (all && seen.size === 1) return [...seen][0];
    }
    return '';
  },
  /* ⛔ THE FILE'S OWN FURNITURE IS NOT A PRODUCT — and reading the product name is what
     made this urgent. An order guide is full of section dividers and subtotal lines, and
     the moment Bar Cop started matching on the name, "*** LIQUOR SECTION ***" matched the
     word LIQUOR and imported itself as a product. Measured on test-2-messy: three junk
     rows came in that had correctly stayed out before.
     ⚠ DELIBERATELY NARROW ([[the-loop]] #26 — a name-classifying vocabulary has eaten a
     real record three times in this codebase). Two structural tests, no general word list:
       1. wrapped in a run of decoration (`*** X ***`, `--- X ---`). Nobody names a product
          that, and no vocabulary is involved.
       2. begins or ends with SUBTOTAL / GRAND TOTAL. ⛔ Bare "total" is NOT here: it is a
          real first word ("Total Eclipse"), and the existing `PosIngest.isSummaryName`
          already catches a lone "Grand Total".
     Pinned in the same edit against real product names, which is what the rule demands. */
  _isFurnitureRow(row) {
    const n = String((row && row.name) == null ? '' : row.name).trim();
    if (!n) return false;                       // nameless rows have their own bucket
    if (/^[*=\-_~#]{2,}.*[*=\-_~#]{2,}$/.test(n)) return true;
    const flat = n.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return /^(sub total|subtotal|grand total)\b/.test(flat) || /\b(sub total|subtotal|grand total)$/.test(flat);
  },

  /* ⭐⭐ THE PRE-FILL. Everything the vocabulary, the brand list and the column reading
     buy is spent HERE and nowhere else: it fills the list in before the operator sees it,
     and then gets out of the way. It is a head start, never a decision — every row it
     touches is on screen with its own checkbox and can be moved.
     ⛔ NO FALLBACK TO THE CARD. A row nothing can place stays blank and sits at the TOP
     of the screen as the work. That is only affordable because the operator can now SEE
     it: the old design had to guess, because an unplaced row was a footnote.
     ⛔ AND FURNITURE IS LEFT BLANK, NOT REMOVED. `*** SECTION ***` is almost certainly not
     a product, but 'almost certainly' is not good enough to delete somebody's row for
     them. It shows up unsorted and they remove it in the same sweep as everything else.
     ([[the-loop]] #26 — a name-classifying vocabulary has eaten a real record three
     times in this codebase; here it costs a checkbox instead of a product.) */
  _prefillAssign() {
    const r = this._routing;
    if (!r) return;
    const best = this._bestGrouping(r.rows);
    const others = best ? this._groupableColumns(r.rows).filter(c => c.key !== best.key) : [];
    r.rows.forEach(row => {
      if (r.assignById[row._rid] !== undefined) return;
      if (this._isFurnitureRow(row)) return;
      let guess = this._guessCategory(String(row.name == null ? '' : row.name).trim());
      /* ⛔ THE KEG VOLUME SITS BELOW THE NAME AND ABOVE THE COLUMN. Below the name
         because a product that says what it is outranks its container, and if the two
         ever disagree the name is the one a human wrote. Above the column because it is
         a fact about THIS row, while a column reading is an inference about a group. */
      if (!guess && this._isKegSize(row.container_size_oz)) guess = 'Draft Beer';
      if (!guess && best) {
        const v = String(row[best.key] == null ? '' : row[best.key]).trim();
        guess = this._guessCategory(v) || this._agreeAcross(r.rows, best.key, v, others);
      }
      if (guess) r.assignById[row._rid] = guess;
    });

    /* ⛔⛔ THE CARD ANSWERS WHAT THE FILE COULD NOT — BUT ONLY ON A SINGLE-CATEGORY FILE.
       Kyle, chat 27, after a bottle beer EXPORT sorted 1 of 10 on the Bottle Beer card.
       Unlike the draft one there is no fact in that file to read: the Type column holds
       STYLES (unreadable by design), the names are beer BRANDS (excluded for the same
       reason a style is — Coors Light ships as a keg and as a case), and a Case Size of
       24 is not distinctive, because a liquor file's 12-bottle case column binds to the
       same field. The only thing left that can answer it is the card they clicked, which
       is not a guess: it is the operator's own statement about the file.

       THIS REVERSES CHAT 26'S "NO CARD FALLBACK", and what makes it safe now is the
       change directly above: EVERY import stops at the confirm screen, so the card can no
       longer file anything silently. The defect that rule was written against was 400 rows
       landing as Liquor with nobody told; the same rows now arrive as a list you accept.

       ⛔ GATED ON A MEASUREMENT, NOT A FEELING. How many distinct categories did the FILE
       resolve out of itself? Measured across every file on disk: the six that already work
       read 3 to 5, and both broken exports read exactly 1. The gap is 1 against 3, so this
       threshold is not fitted to whichever fixture was in front of me ([[the-loop]] #28).
       Two or more means the file is genuinely mixed, and the card stays out of it exactly
       as it does today.
       ⚠ COUNTED BEFORE A SINGLE ROW IS FILLED. Counting as we go would put the card's own
       category into the set after the first fill, the file would read as mixed from row two
       onward, and every remaining row would be left behind — a fallback that fires once.
       ⚠ AND FURNITURE IS TESTED AGAIN HERE. This is a second pass, so the guard that keeps
       `*** SECTION ***` and SUBTOTAL out of the products does not carry over from the loop
       above. A section divider becoming a product is worse than one left unsorted
       ([[the-loop]] #26). */
    const fileCats = new Set(Object.values(r.assignById).filter(Boolean));
    if (fileCats.size > 1 || !r.cardCat) return;
    r.rows.forEach(row => {
      if (r.assignById[row._rid] !== undefined) return;
      if (this._isFurnitureRow(row)) return;
      r.assignById[row._rid] = r.cardCat;
    });
  },

  /* Which column, if any, actually SORTS this file? Measured, not guessed: run the
     vocabulary over each candidate column's values and count the ROWS it can place.
     ⚠ This is what lets a beer guide sort itself: its Type column holds styles and places
     NOTHING, while its Pack column holds 1/2 BBL and 24/12 oz CAN and places nearly
     everything. Picking `groupable[0]` would have taken the useless one.
     ⛔ AND IT HAS TO NAME MOST OF THE FILE. Measured on a real-shaped guide: the only
     candidate left was a PACK column that resolved 4 rows of 14, which cleared an older
     'two or more categories' test — and 10 spirits and wines were left out. A column is
     the category column only if it can name the category for MOST of the file. */
  _bestGrouping(rows) {
    let best = null;
    const cands = this._groupableColumns(rows);
    cands.forEach(c => {
      const cats = new Set();
      let placed = 0;
      const others = cands.filter(x => x.key !== c.key);
      this._routeGroups(rows, c.key).forEach(g => {
        const guess = this._guessCategory(g.value) || this._agreeAcross(rows, c.key, g.value, others);
        if (guess) { placed += g.count; cats.add(guess); }
      });
      if (!best || placed > best.placed || (placed === best.placed && cats.size > best.cats)) {
        best = { key: c.key, placed: placed, cats: cats.size };
      }
    });
    if (best && best.placed * 2 <= (rows || []).length) return null;
    return best;
  },

  /* ── THE PER-PRODUCT LIST ─────────────────────────────────────────────────
     Kyle, 2026-08-03, after the group worksheet printed 'Light Lager -> Skip' while
     three of its five products imported anyway: *"why can't the mapper just import every
     product row listed in the file... the next screen is every product listed with the
     select all green checkmarks and some category selector and add button"*.
     ⭐ THE REASON IT IS RIGHT, and it is worth keeping: **a group is an abstraction, a
     product is a thing.** Every confusing thing on the old screen came from asking the
     operator to reason about buckets — and the worksheet had drifted into saying
     something FALSE, because rows resolve one at a time while it still spoke in groups.
     A list of product names cannot drift from the products. */
  _openRouting(rows, cardCat) {
    rows = (rows || []).map((row, i) => Object.assign({}, row, { _rid: 'r' + i }));
    this._routing = {
      rows: rows,
      cardCat: cardCat || '',
      assignById: {},   // _rid -> category. The operator's answers AND the pre-fill.
      removed: {},      // _rid -> true. Not a product; never written.
      open: {},         // which category groups are expanded on screen
      checked: {},      // _rid -> true, the current selection
      vendor: '', vendorNew: false
    };
    this._prefillAssign();
    /* ⛔ THE SCREEN ALWAYS OPENS (Kyle, chat 27): *"i would actually prefer the process
       to be the same every time no matter what... let the user confirm everything is
       correct before adding to the categories.. that way bar cop can never make a
       mistake."*
       It used to skip itself when the file sorted cleanly and named a vendor, on the
       reasoning that a clean path should not collect a second confirm
       ([[automate-obvious-step]]). That is overruled, and the reasons are better than
       the one it replaces: an unvarying process is worth more than a saved click; the
       Add press is what moves responsibility for what lands from Bar Cop to the
       operator; and it is the only place they can drop products they no longer carry
       before those become live records. A clean file is now a screen you scan and
       accept, which costs one press and can never be wrong. */
    this.renderLanding();
    setTimeout(() => document.getElementById('ip-route-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  },

  /* The rows the batch verb may touch: the unsorted section, which is always open, plus
     any group the operator has expanded. Nothing hidden. */
  _routeVisibleRows() {
    const r = this._routing;
    if (!r) return [];
    return this._routeRows().filter(row => {
      const c = r.assignById[row._rid];
      return !c || !!r.open[c];
    });
  },
  // Every row still in the import. A removed row is gone from the list and the counts.
  _routeRows() {
    const r = this._routing;
    return r ? r.rows.filter(row => !r.removed[row._rid]) : [];
  },
  /* ⛔ ONLY WHAT IS ON SCREEN. A check SURVIVES a collapse, so without this an operator
     could tick three rows, close the group, pick a different category and move rows they
     can no longer see — the identical defect Select All had, arriving through the control
     that replaced it. `_routeVisibleRows` was that fix and this is its second consumer:
     the toolbar's enabled state reads the same list, so the button cannot offer to move
     something it will not move. */
  _routeCheckedIds() {
    const r = this._routing;
    if (!r) return [];
    return this._routeVisibleRows().filter(row => r.checked[row._rid]).map(row => row._rid);
  },
  _assignRows(ids, cat) {
    const r = this._routing;
    if (!r) return;
    (ids || []).forEach(id => { if (cat) r.assignById[id] = cat; else delete r.assignById[id]; });
  },
  _removeRows(ids) {
    const r = this._routing;
    if (!r) return;
    // ⚠ Also drop the selection and the assignment, so a row put back by Start Over
    // does not come back carrying a category nobody can see any more.
    (ids || []).forEach(id => { r.removed[id] = true; delete r.checked[id]; delete r.assignById[id]; });
  },

  /* The rows as they would be written. `_category` is only ever the operator's answer or
     the pre-fill they left alone — there is no third source and no fallback. */
  _routeStamp() {
    const r = this._routing;
    if (!r) return [];
    return this._routeRows().map(row => {
      /* ⛔ FILL, NEVER OVERWRITE. The chosen supplier is the answer for a file that does
         not name one, so it only applies where the row's own cell is empty. A file that
         DOES carry a Supplier column has already answered per row, and a broadline guide
         can legitimately list several. */
      const vendor = String(row.vendor == null ? '' : row.vendor).trim() || (r.vendor || '');
      return Object.assign({}, row, { _category: r.assignById[row._rid] || '', vendor: vendor });
    });
  },

  /* ⛔ COUNTS WHAT `runImport` WILL ACTUALLY WRITE, IN THE SAME ORDER IT DECIDES.
     Measured on a messy file: the table read 13, the button promised 14, and 12 landed —
     it was counting a row with no product name and a name the file repeats. That is the
     last number an operator reads before pressing ([[output-honesty]]). */
  /* ⛔ IT ALSO RETURNS *WHY*, PER ROW, AND THAT IS WHAT THE SCREEN RENDERS (Kyle, chat 27).
     The counts alone forced the operator to do arithmetic: a header saying 8 over a button
     saying 1, with a sentence underneath about rows being left out. *"visually is making
     the user try to do math and figure out what the heck it is talking about."* So the same
     single walk that produces the counts now also stamps each row with the reason it will
     or will not land, and the row says it for itself.
     ⚠ ONE WALK, NOT TWO. The status map and the counts have to come from the same pass in
     the same order, or the dim and the number can disagree — which is the exact defect this
     function was written to end.
     ⚠ THE ORDER IS runImport's ORDER: no name, then no category, then already-taken. A row
     with no category NEVER reaches the duplicate test, so it must read as unsorted work and
     not as a duplicate, or the screen tells the operator to leave alone the one row they
     have to act on.
     ⚠ AND `taken` IS SPLIT IN TWO WITHOUT CHANGING THE VERDICT. runImport keeps one set,
     seeded from the product list and added to as it goes; `mine` + `seen` is that same set,
     separated only so the row can say WHICH it is — a name you already own is a dead end,
     a name repeated inside this file is not. `dup` still totals both, as it always did. */
  _routeSummary() {
    const by = {}, missing = [], status = {};
    let nameless = 0, dup = 0;
    const all = this.products() || [];
    const mine = new Set(all.map(p => (p.name || '').trim().toLowerCase()));
    const hidden = new Set(all.filter(p => p.active === false).map(p => (p.name || '').trim().toLowerCase()));
    const seen = new Set();
    this._routeStamp().forEach(row => {
      const nm = String(row.name == null ? '' : row.name).trim();
      if (!nm) { nameless++; status[row._rid] = 'nameless'; return; }
      if (!row._category) { missing.push(nm); status[row._rid] = 'unplaced'; return; }
      const key = nm.toLowerCase();
      if (mine.has(key)) { dup++; status[row._rid] = hidden.has(key) ? 'dupArchived' : 'dup'; return; }
      if (seen.has(key)) { dup++; status[row._rid] = 'repeat'; return; }
      seen.add(key);
      status[row._rid] = 'ok';
      by[row._category] = (by[row._category] || 0) + 1;
    });
    const order = App.IC_CATEGORIES || [];
    const cats = Object.keys(by).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { by: by, cats: cats, missing: missing, nameless: nameless, dup: dup, status: status };
  },
  // ONE SOURCE with the list above it, or the button and the screen disagree.
  _routeReadyCount() {
    if (!this._routing) return 0;
    const s = this._routeSummary();
    return s.cats.reduce((n, c) => n + s.by[c], 0);
  },
  // Does the file leave anybody without a supplier? If not there is no question to ask.
  _needsVendor() {
    const r = this._routing;
    return !!r && r.rows.some(row => !String(row.vendor == null ? '' : row.vendor).trim());
  },
  /* ⛔ `_routeHasQuestion()` LIVED HERE AND IS GONE (chat 27). It decided whether the
     screen was worth showing — no unplaced rows, one category, a supplier named, and it
     skipped straight to the write. Kyle overruled the whole idea: the process is the same
     every time, and the operator's Add is the confirmation. Deleted rather than left
     unreferenced, because a helper nobody calls reads as live coverage to the next person
     who greps it ([[the-loop]] #61). Its three conditions all still exist as things the
     screen SHOWS; none of them is a reason to hide it. */

  // ── The screen ─────────────────────────────────────────────────────────────
  /* ⚠ ONE SHARED COLGROUP for every section on the screen. Percentage widths, not px,
     exactly as the product list below does it: the columns then line up across the
     Not-Sorted table and every Going-Into table, AND each table always fits its card so
     nothing scrolls sideways. Kyle: *"column in different sections should still be
     aligned with each other"*. */
  _routeColgroup() {
    return '<colgroup><col style="width:5%;"/><col style="width:33%;"/><col style="width:16%;"/>'
      + '<col style="width:15%;"/><col style="width:16%;"/><col style="width:15%;"/></colgroup>';
  },
  /* ⛔ A ROW THAT WILL NOT LAND SAYS SO ON ITSELF (Kyle, chat 27). Dim, plus one short
     line under the name giving the actual reason. That is what lets the header above it
     count only what lands: the arithmetic disappears because nothing has to be inferred
     from a difference between two numbers.
     ⚠ FOUR REASONS, NOT ONE. "already yours" is a dead end, "hidden" needs the Inactive
     tab named or the operator cannot act on it, "repeated in this file" is about the file
     and not about their bar, and a nameless row is neither. One label per cause. */
  _ROUTE_ROW_NOTE: {
    dup:         'Already in your list',
    dupArchived: 'Already in your list, hidden on the Inactive tab',
    repeat:      'Repeated in this file',
    nameless:    'No product name'
  },
  _routeRowHtml(row, status) {
    const r = this._routing;
    const size = String(row.container_size_oz || row.case_size || '').trim();
    // 'unplaced' is deliberately unmarked: that row is the WORK, not a row to leave alone.
    const note = this._ROUTE_ROW_NOTE[status] || '';
    /* ⛔ REMOVAL LIVES ON THE ROW (Kyle, chat 27). It replaces a bulk "Not a product"
       button, and that is not only tidier: a control sitting on the row can only ever
       act on a row the operator is looking at, by name. The bulk one took his entire
       import because it reached past the screen. Ghost, and in `.row-actions`, which is
       exactly how the product list below does its Edit and Delete. */
    return '<tr' + (note ? ' style="opacity:0.5;"' : '') + '>'
      + '<td class="cb-left"><input type="checkbox" class="bc-check ip-rt-cb" value="' + esc(row._rid) + '"'
        + (r.checked[row._rid] ? ' checked' : '') + '/></td>'
      + '<td>' + esc(row.name || '')
        + (note ? '<div style="font-size:10px;color:var(--t3);letter-spacing:0.5px;margin-top:2px;">' + esc(note) + '</div>' : '')
        + '</td>'
      + '<td>' + esc(row.brand || '') + '</td>'
      + '<td>' + esc(size) + '</td>'
      + '<td>' + esc(row.sub_category || '') + '</td>'
      + '<td><div class="row-actions"><button type="button" class="btn btn-ghost btn-sm ip-rt-rm"'
        + ' data-rid="' + esc(row._rid) + '">Remove</button></div></td>'
      + '</tr>';
  },
  /* A section is the app's own STEP-CARD head (Kyle, chat 27, with the weekly-close
     steps open beside this screen): the name in white, what the section holds on the
     line under it, the chevron on the right, and no numbered circle. The table sits
     INSIDE the card and only renders when the section is open.
     `key` null means the always-open Not Sorted section, which gets the same head with
     no chevron and no click.
     ⚠ `collapsed` STAYS ON THE CARD. `.card.collapsed .card-chevron` already ships in
     style.css; every other rotation selector there is a NAMED head (`.pf-step-head`,
     `.c-step-head`, ...), so moving the class to the head would need a new selector, and
     a new selector is a design change that gets walked on its own.
     ⚠ `container-type:inline-size` is inline because `.card:has(> .row-list)` was giving
     this card exactly that for free, and the table just moved a level down. Without it
     the @container rule that stacks a row-list on a narrow screen never fires again. */
  _routeSection(rows, title, sub, key, isOpen, first, status) {
    const head = '<div' + (key ? ' class="ip-rt-head" data-cat="' + esc(key) + '"' : '')
      + ' style="display:flex;align-items:center;gap:13px;padding:14px 16px;' + (key ? 'cursor:pointer;' : '') + '">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(title) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(sub) + '</div></div>'
      + (key ? '<span class="card-chevron" aria-hidden="true">&#9662;</span>' : '')
      + '</div>';
    const table = '<div style="padding:0 16px 16px;overflow-x:auto;">'
      + '<table class="row-list" style="table-layout:fixed;width:100%;">' + this._routeColgroup()
      + '<thead><tr><th></th><th>Product</th><th>Brand</th><th>Size</th><th>In Your File</th><th></th></tr></thead>'
      + '<tbody>' + rows.map(row => this._routeRowHtml(row, (status || {})[row._rid])).join('') + '</tbody></table></div>';
    return '<div class="card' + (key && !isOpen ? ' collapsed' : '')
      + '" style="padding:0;container-type:inline-size;margin-top:' + (first ? '0' : '16') + 'px;">'
      + head + (isOpen ? table : '') + '</div>';
  },
  routePanelHTML() {
    const r = this._routing;
    const cats = App.IC_CATEGORIES || [];
    const rows = this._routeRows();
    const unsorted = rows.filter(row => !r.assignById[row._rid]);
    const sorted = {};
    rows.forEach(row => { const c = r.assignById[row._rid]; if (c) (sorted[c] = sorted[c] || []).push(row); });
    const order = cats.filter(c => sorted[c]);
    // ⛔ VISIBLE checked rows, the same list `_routeCheckedIds` acts on, so the button
    // can never offer to move something it will not move.
    const nChecked = this._routeCheckedIds().length;

    /* The toolbar is the whole batch interaction: check some rows, say where they go,
       Move To. Select All and Clear are gone (Kyle, chat 27) and removal moved onto the
       row itself, which is what makes the destructive control structurally incapable of
       pointing at something off screen.
       ⚠ NO LABEL over the selector, and the row centres rather than baseline-aligning,
       so the button sits against the middle of the select instead of hanging off it. */
    let body = '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div class="f" style="max-width:220px;">'
      + '<select class="form-input" id="ip-rt-cat"><option value="">Choose a category...</option>'
      + cats.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('')
      + '</select></div>'
      + '<button type="button" class="btn btn-primary btn-sm" id="ip-rt-add"' + (nChecked ? '' : ' disabled') + '>Move To</button>'
      + '</div>';

    /* Groups Bar Cop already worked out are COLLAPSED (Kyle's call), so the only thing at
       eye level is what needs doing; the count rides on the head, so a closed section
       still says what it holds and where it is going.
       ⛔ THE HEAD COUNTS WHAT LANDS, NOT HOW MANY ROWS ARE IN IT (Kyle, chat 27). It used
       to count rows, so a re-drop read "8 products moving into Draft Beer" over a button
       promising 1 — and the difference was explained by a sentence at the bottom of the
       page, which is arithmetic in two places at once. `s.by[c]` is the count of rows in
       that group that will ACTUALLY be written, from the same walk the button reads, so
       the section heads now SUM to the button and every row that is not in the total says
       why on itself. */
    const s = this._routeSummary();
    if (unsorted.length) {
      body += this._routeSection(unsorted, 'Not Sorted Yet',
        unsorted.length + ' row' + (unsorted.length === 1 ? '' : 's') + ' Bar Cop could not work out',
        null, true, true, s.status);
    }
    order.forEach((c, i) => {
      const n = s.by[c] || 0;
      body += this._routeSection(sorted[c], c,
        n + ' product' + (n === 1 ? '' : 's') + ' moving into ' + c,
        c, !!r.open[c], !unsorted.length && i === 0, s.status);
    });

    /* ⛔ THE GAP LINE IS GONE (Kyle, chat 27, looking at his own re-drop): *"i have no
       idea what '7 are names you already have, so they are left out' means... it just
       reads as confusing to a user that just has all 17 of their beer products sorted and
       correct ready to add."*
       It was written in chat 26 for a real defect — the button promised 14, the table said
       13 and 12 landed — and it explained the difference in prose. The trouble is WHEN it
       fires: only on a re-drop or a name you already own, which is precisely the moment
       the operator is looking at a screen that otherwise reads as finished, so a sentence
       about rows being "left out" lands as an error nobody made.
       ⭐ AND THE DIVERGENCE IT USED TO EXPLAIN IS CLOSED, which is why no sentence is
       needed here at all. Kyle worked out the right answer immediately afterwards: the
       section head counts what LANDS, and any row that will not land is dimmed and says
       why on itself. Deleting the line first and closing the gap second is the wrong order
       and it was mine; the line was a symptom of counting two different things. */

    /* ⛔ ONLY ASK WHEN THE FILE DOES NOT ANSWER. A file that names a supplier on every row
       has no question, and the control does not belong on screen at all. */
    let vendorBlock = '';
    if (this._needsVendor()) {
      const vendorRows = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
        .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const known = vendorRows.some(v => v.name === r.vendor);
      /* ⛔ THE COUNT IS WHAT WILL ACTUALLY BE CREATED, not the row count. It said "all 21
         products" on a file whose 21 rows include six section dividers and a subtotal —
         a promise about a number no operator would ever see land ([[output-honesty]]).
         `_routeReadyCount` is the same figure the Add button prints, so the two sentences
         on this screen cannot disagree; it moves as rows are sorted, which is correct,
         because that is when more of them become products. */
      const n = this._routeReadyCount();
      /* ⛔ AND THE COUNT IS ONLY A CLAIM ABOUT RECIPIENTS WHEN THE FILE NAMES NOBODY.
         `_needsVendor` is "SOME row has no supplier", and `_routeStamp` FILLS rather than
         overwrites — so on a file with a partly-filled Supplier column, "all 13 products"
         names rows that keep their own vendor and never see this one. The data was right
         either way; the sentence was not. When the file has answered for some of them,
         say what happens instead of counting it ([[the-loop]] #30: do not estimate a
         number the screen cannot state truthfully). */
      const noneNamed = rows.every(row => !String(row.vendor == null ? '' : row.vendor).trim());
      const who = !noneNamed ? 'the ones your file does not already name'
        : (n ? 'all ' + n + ' product' + (n === 1 ? '' : 's') : 'every product you add');
      /* ⚠ ONE SENTENCE (Kyle, chat 27: "the who supplies these explainer text is too
         long"). The old one also spent a clause telling them they could skip it, which
         the dropdown's own "Skip for now" option already says. */
      vendorBlock = '<div class="card" id="ip-route-vendor-card" style="margin-top:16px;">'
        + this._sectionHead('Who Supplies These?',
        'Your file does not name one for all of these. Pick who these came from and Bar Cop puts them on '
        + who + ' and adds them to your vendor list.')
        + '<div class="form-row" style="margin-bottom:0;">'
        + '<div class="f" style="max-width:260px;"><label>Supplier</label>'
        + '<select class="form-input" id="ip-route-vendor">'
        + '<option value=""' + (r.vendor || r.vendorNew ? '' : ' selected') + '>Skip for now</option>'
        + vendorRows.map(v => '<option value="' + esc(v.name) + '"' + (!r.vendorNew && r.vendor === v.name ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('')
        + '<option value="__new"' + (r.vendorNew ? ' selected' : '') + '>Type in a new one...</option>'
        + '</select></div>'
        + (r.vendorNew ? '<div class="f" style="max-width:260px;"><label>Their name</label>'
            + '<input class="form-input" id="ip-route-vendor-new" type="text" value="' + esc(known ? '' : (r.vendor || '')) + '" placeholder="Coastal Beverage"/></div>' : '')
        + '</div></div>';
    }

    const ready = this._routeReadyCount();
    const busy = !!this._routeWriting;
    const lead = unsorted.length
      ? 'Bar Cop has put ' + (rows.length - unsorted.length) + ' of these where it thinks they go. '
        + 'Check the ' + unsorted.length + ' it could not work out, pick a category, and press Move To to place them, '
        + 'or Remove the ones that are not products.'
      : 'Bar Cop has put all ' + rows.length + ' of these where it thinks they go. Open a group to check it.';

    /* ⛔ "IMPORT N PRODUCTS" WAS UNTRUE WHERE IT STOOD (Kyle, chat 27): the file was
       imported two screens ago, and a button offering to import it again reads as though
       the work already happened. What this press does is ADD the products. */
    return this._sectionHead('Your ' + rows.length + ' Product' + (rows.length === 1 ? '' : 's'), lead)
      + body
      + vendorBlock
      + '<div class="no-print" style="margin:22px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button type="button" class="btn btn-primary" id="ip-route-go"' + (ready && !busy ? '' : ' disabled')
      + '>' + (busy ? 'Adding...' : 'Add ' + ready + ' Product' + (ready === 1 ? '' : 's')) + '</button>'
      + '<button type="button" class="btn btn-ghost" id="ip-route-back"' + (busy ? ' disabled' : '') + '>Start Over</button>'
      + '</div>'
      + '<div id="ip-csv-actions" class="no-print" style="margin:0 0 24px;"></div>';
  },

  // CSVMapper hands back rows already keyed by field (name, unit_cost, ...). Build
  // a product per row with the same category-specific cost math the form uses.
  async runImport(rows) {
    rows = rows || [];
    /* ⚠ THE CATEGORY IS A PROPERTY OF THE ROW, NOT OF THE FILE. This used to read
       `this._formCategory` ONCE and apply `FORM_SPEC[cat]` to the whole run, which was
       correct while the only way in was clicking a category card. It is not correct for a
       vendor order guide, which is one file holding kegs AND cases, and a real export from
       another system, which is one file holding everything. Dropped on the Liquor card,
       every row became a Liquor product silently: wrong cost divisor, wrong size, wrong
       tab, 400 rows to delete by hand.
       So `cardCat` is now only the FALLBACK, used when a row carries no category of its own,
       which is exactly the six existing card doors. `cat` and `spec` are resolved PER ROW
       inside the loop below. */
    const cardCat = this._formCategory || 'Liquor';
    const val = (row, k) => String(row[k] != null ? row[k] : '').trim();
    // App.parseNum is the ONE coercion; null for "no number" is already this caller's contract.
    // ⚠ It also FIXES the sign here: this stripped the minus entirely, so a "-4.50" cell read +4.50.
    const numOf = str => App.parseNum(str);
    /* ⚠ DECLARED HERE, above every use. It sat below the size read and died in the temporal dead
       zone — the same trap that bit the staff door's `wageNum` in the same round.
       Negative values must not reach storage (the standard `verify-negative-input-guards.js`
       states): the typed form carries `min="0"` on size, pour, par and reorder and `min="1"` on the
       pack fields, so the IMPORT is the only door that can produce one — and Excel's accounting
       format on a vendor credit line emits exactly `(25.00)`, which App.parseNum correctly reads as
       -25. Stored, it gave a negative pour cost that `isComplete()` called true and the row-colour
       class rendered GREEN, indistinguishable from a healthy figure. */
    const nonNeg = n => (n == null || n < 0) ? null : n;
    // Snap an imported Misc Type to a known tag (case-insensitive); an unknown
    // value is kept as typed and simply behaves as a recipe ingredient.
    const normMiscType = v => { const s = (v || '').trim().toLowerCase(); return (App.MISC_TYPES || []).find(t => t.toLowerCase() === s) || (v || '').trim(); };
    // ⚠ CLEAR THE PREVIOUS ONE FIRST (S125). This appended without clearing, so two refused import
    // attempts rendered "Save failed. Try again. Save failed. Try again." beside the Import button.
    const note = (txt, color) => {
      const a = document.getElementById('ip-csv-actions');
      if (!a) return;
      a.querySelectorAll('.ip-csv-note').forEach(n => n.remove());
      a.insertAdjacentHTML('beforeend', '<span class="ip-csv-note" style="color:' + (color || 'var(--red)') + ';font-size:12px;margin-left:10px;">' + esc(txt) + '</span>');
    };

    const imported = [];
    // Block duplicate names the same way the manual Save does (case-insensitive,
    // and de-dupes repeats within the file itself), so a re-drop never creates
    // duplicate-named products the rest of the app treats as an error state.
    const taken = new Set(this.products().map(p => (p.name || '').trim().toLowerCase()));
    /* ⚠ AN ARCHIVED PRODUCT OF THE SAME NAME IS A DEAD END, SO IT IS NAMED SEPARATELY. `products()`
       includes `active:false` rows, and archive-then-reimport is the app's OWN documented recovery
       path for a bad import — so following it was the one thing that could not work: 0 imported,
       *"3 duplicate names skipped"*, and the category tab showing 0 products because the archived
       copies are not visible anywhere. The block stays (a second product of the same name is an
       error state the rest of the app cannot represent), but the message now says WHERE they are. */
    const archived = new Set(this.products().filter(p => p.active === false)
      .map(p => (p.name || '').trim().toLowerCase()));
    let dup = 0, dupArchived = 0, nameless = 0;
    // Rows the operator left on Skip, or whose value was never mapped to a category.
    // They are NOT imported and they are named in the result (Kyle, 2026-08-03).
    const unplaceable = [];
    rows.forEach(row => {
      const name = val(row, 'name');
      if (!name) { nameless++; return; }
      /* THE ROW'S OWN CATEGORY WINS. A row that carries the key with no value was left on
         Skip or its value was never mapped, and a fallback category is exactly the defect
         this whole change exists to remove: a product filed somewhere the operator never
         chose is invisible until they go looking for it.
         ⚠ This sits ABOVE the duplicate check on purpose. A skipped row must not consume a
         `taken` slot, or the same name appearing later on a row that IS placeable would be
         thrown away as a duplicate of something that was never imported. */
      const cat = ('_category' in row) ? String(row._category || '').trim() : cardCat;
      const spec = cat ? this.FORM_SPEC[cat] : null;
      if (!spec) { unplaceable.push(name); return; }
      const nameKey = name.toLowerCase();
      if (taken.has(nameKey)) { if (archived.has(nameKey)) dupArchived++; else dup++; return; }
      taken.add(nameKey);
      // nonNeg here too: a `-750ml` credit line gave -25.4 oz, a NEGATIVE pour cost, and the row
      // still read Complete and rendered GREEN (the row-colour class keys off the sign).
      let oz     = nonNeg(this._sizeToOz(val(row, 'container_size_oz')));
      /* ⛔ ON A BEER ORDER GUIDE THE KEG SIZE *IS* THE PACK COLUMN. The file has one
         column reading "1/2 BBL" for a keg and "24/12 oz CAN" for a case, and those are
         two different facts: a case size for one row and a container size for the other.
         Bar Cop already reads both (`_packCount` and `_sizeToOz`), but only `case_size`
         had a column to bind to, so every keg landed with no size and no pours per keg.
         So a DRAFT row with no size of its own falls back to the pack cell.
         ⚠ WHY THIS IS NOT A GUESS: `_sizeToOz` is the validator and it is strict by
         design — it refuses two-number cells ("24/12 oz") and refuses pack descriptors
         ("12-PACK"), with a comment above it explaining that a plausible wrong size is
         worse than none. So this can only ever succeed on something that really is a size.
         ⛔ IT WAS SCOPED TO DRAFT BEER AND THAT WAS TOO NARROW. Measured on a 60-product
         guide whose one Pack column reads "1.75 L" for spirits and "1/2 BBL" for kegs:
         the spirits bound their size to nothing and 44 of 46 products landed Incomplete.
         One column carrying the size for every category is the normal shape, not a beer
         quirk. It stays a FALLBACK — a row with a real size column of its own is never
         overridden — and the validator is what keeps it honest for a bottle-beer row,
         whose "24/12 oz CAN" it refuses and whose 12 oz nominal is forced below anyway. */
      if (oz == null) oz = nonNeg(this._sizeToOz(val(row, 'case_size')));
      // Bottle beer has no oz field; store a fixed nominal size so the usage-variance
      // oz round-trip cancels (never shown or entered — matches the manual form).
      if (cat === 'Bottle Beer') oz = 12;
      /* ⚠ A NEGATIVE COST OR PRICE IS REFUSED, NOT STORED. `verify-negative-input-guards.js` states
         the app's standard — negative values must not reach storage — and four guards were added
         elsewhere while this door was missed. Only the import can produce one: a `type="number"`
         field cannot accept `(25.00)`, but Excel's default accounting format for a vendor CREDIT
         line emits exactly that, and App.parseNum correctly reads it as -25. It then stored as a
         negative unit cost with `isComplete()` returning TRUE, giving negative COGS and negative
         inventory value. Dropping it to null leaves the row Incomplete, which is the honest state. */
      const pour = spec.showPour ? nonNeg(numOf(val(row, 'pour_size_oz'))) : null;
      const cost = nonNeg(numOf(val(row, 'unit_cost')));
      // Menu price + servings come in for resale Food/Misc as well as pourables.
      const price = (spec.showMenuPrice || spec.showUnitType) ? nonNeg(numOf(val(row, 'menu_price'))) : null;
      const soldOnMenu = spec.showUnitType && price != null && price > 0;
      const servingsPerUnit = soldOnMenu ? (this._packCount(val(row, 'servings_per_unit')) || 1) : null;
      const costPerServing = soldOnMenu ? this._resaleCps(cost, servingsPerUnit) : null;
      const caseSize = spec.showCaseSize ? (this._packCount(val(row, 'case_size')) || null) : null;
      const unitType = spec.showUnitType ? (val(row, 'unit_type').toLowerCase() || spec.defaultUnitType) : null;
      const miscType = cat === 'Misc' ? normMiscType(val(row, 'misc_type')) : '';
      // Food / Misc: pieces-or-servings per unit, the recipe noun, and the count
      // method (defaulted from the product's role, exactly like the form).
      const packSizeRaw = spec.showPackSize ? (this._packCount(val(row, 'pack_size')) || null) : null;
      // A Food/Misc product is tracked ONE way: by ounces (container_size_oz) OR by
      // pieces (pack_size), never both — otherwise the edit form picks one Track By
      // and drops the other on save. Prefer ounces when a container size is given.
      const packSize = (spec.showPackSize && oz != null && oz > 0) ? null : packSizeRaw;
      const servingName = spec.showUnitType ? (val(row, 'serving_name') || null) : null;
      const countStyle = spec.showPackSize
        ? App.defaultCountStyle({ unit_type: unitType, misc_type: miscType, pack_size: packSize })
        : null;
      const pours = oz && pour ? oz / pour : null;
      // Per-bottle cost (divides by case_size for Bottle Beer when set).
      const perBottle = (cat === 'Bottle Beer' && caseSize && caseSize > 0)
        ? (cost != null ? cost / caseSize : null)
        : cost;
      const cpp = pours && perBottle != null ? perBottle / pours : null;
      const pct = cpp != null && price ? cpp / price * 100 : null;
      imported.push({
        id:                  App.uid(),
        name,
        brand:               val(row, 'brand'),
        category:            cat,
        sub_category:        cat === 'Misc' ? '' : val(row, 'sub_category'),
        misc_type:           miscType,
        vendor:              val(row, 'vendor'),
        vendor_item_code:    val(row, 'vendor_item_code'),
        container_size_oz:   oz,
        case_size:           caseSize,
        pack_size:           packSize,
        serving_name:        servingName,
        count_style:         countStyle,
        pour_size_oz:        pour,
        unit_type:           unitType,
        unit_cost:           cost,
        menu_price:          price,
        sold_on_menu:        soldOnMenu,
        servings_per_unit:   servingsPerUnit,
        cost_per_serving:    costPerServing,
        par_level:           nonNeg(numOf(val(row, 'par_level'))),
        reorder_point:       nonNeg(numOf(val(row, 'reorder_point'))),
        primary_location:    '',
        active:              true,
        notes:               '',
        pours_per_container: pours,
        cost_per_pour:       cpp,
        pour_cost_pct:       pct,
        created_at:          new Date().toISOString(),
        imported:            true
      });
    });

    /* Every bucket reaches the operator, on BOTH exits. `note()` used to fire only when nothing
       imported, so a 400-row file that silently landed 180 read as a clean success — and the
       zero-row headline named only duplicates, so 1 duplicate plus 3 nameless rows reported the
       duplicate and nothing else. An absolute claim may only fire when the other buckets are empty. */
    const buckets = () => {
      const b = [];
      if (dup) b.push(dup + ' duplicate name' + (dup === 1 ? '' : 's') + ' skipped');
      if (dupArchived) b.push(dupArchived + ' already exist' + (dupArchived === 1 ? 's' : '') + ' but ' + (dupArchived === 1 ? 'is' : 'are') + ' hidden — see the Inactive tab');
      if (nameless) b.push(nameless + ' row' + (nameless === 1 ? '' : 's') + ' skipped with no product name');
      /* ⚠ NAMED, not counted. Every other bucket here is a count because the operator can
         find those rows again in their own file. An unplaceable row is different: it was
         dropped on a decision the operator made on the mapping screen, and a bare "9 rows
         skipped" gives them nothing to act on. Cap the list so a 200-row miss does not
         render a wall of text, and say how many are behind it. */
      /* ⛔ REPORT PRODUCTS, NOT ROWS. An order guide repeats a name across sections, so the
         same product can appear on a skipped row AND on a placeable one. Reporting the raw
         row list told the operator "House Vodka not imported" while House Vodka was sitting
         in their list — true about a row, false about their bar, and the only version they
         can act on is the one about their bar. Drop any name that did come in. */
      const gone = unplaceable.filter(n =>
        !imported.some(p => (p.name || '').trim().toLowerCase() === n.trim().toLowerCase()));
      if (gone.length) {
        const shown = gone.slice(0, 5);
        b.push(gone.length + ' not added, no category set: ' + shown.join(', ')
          + (gone.length > shown.length ? ' and ' + (gone.length - shown.length) + ' more' : ''));
      }
      return b;
    };
    if (!imported.length) {
      const b = buckets();
      const head = (dup || dupArchived) && !nameless ? 'No new products added.'
        : nameless && !dup && !dupArchived ? 'No rows with a product name were found.'
        : b.length ? 'No new products added.'
        : 'No rows with a product name were found.';
      note(head + (b.length ? ' ' + b.join('. ') + '.' : ''));
      return;
    }

    this.products().push(...imported);
    // Row-per-record: persist just the newly imported products (dups were skipped
    // above, so existing rows are untouched) in one bulk upsert.
    const ok = await App.putRecordsBulk('ic', 'product', imported);
    if (ok) {
      App.markSetupDone('gs_ic_products');
      /* Land on the tab where most of the import actually went. `cat` used to be the one
         file-level category and is now per row, so there is no single answer any more —
         and for a single-category file (every card door) the largest group IS that
         category, so those doors land exactly where they always did. */
      this.activeCat = (() => {
        const n = {};
        imported.forEach(p => { n[p.category] = (n[p.category] || 0) + 1; });
        return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b))[0] || cardCat;
      })();
      this.editId = null;
      this._formCategory = null;
      this._import = null;
      // Say what landed AND what did not. Set before renderLanding, which is what renders it.
      const b = buckets();
      /* ⚠ "ADDED", NOT "IMPORTED" (Kyle, chat 27). The button was renamed off Import
         because by this point the file has already been imported and the word made the
         work read as done; this sentence prints the instant it is pressed and kept saying
         the old word, which is the same confusion arriving one screen later. */
      this._importMsg = 'Added ' + imported.length + ' product' + (imported.length === 1 ? '' : 's') + '.'
        + (b.length ? ' ' + b.join('. ') + '.' : '');
      this.renderLanding();
    } else {
      // ⚠ TAKE THEM BACK OUT. They were pushed into the live list above and
      // putRecordsBulk cannot revert, so a refused import used to leave every parsed
      // product sitting in memory. The duplicate guard at the top of this function builds
      // `taken` from that SAME list, so the retry then found every row already taken and
      // reported "No new products imported. N duplicate names skipped." — following the
      // instruction the operator was just given was the one thing that could not work,
      // until a reload silently threw the whole import away. Every sibling importer
      // (ev-regulars, hub-operating-expenses, ic-vendors, lc-staff-roster, r-menu-items)
      // already did this; this one was missed.
      App.dropRows(this.products(), imported);
      note('Save failed. Try again.');
    }
  }
};
