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
  CAT_ORDER: ['Cocktails', 'Appetizers', 'Entrees', 'Desserts', 'Specials', 'Beer', 'Wine', 'NA Beverages', 'Snacks'],

  // The item's margin target: its own override, else the category default. Null
  // for beverages / inventory items with no set target, so no price is suggested.
  targetPctFor(item) {
    if (item.target_cost_pct) return item.target_cost_pct;
    if (item.category === 'Cocktails') return App.MENU_TARGET_COST_PCT.cocktail;
    if ((App.MENU_PLATE_CATEGORIES || []).indexOf(item.category) !== -1) return App.MENU_TARGET_COST_PCT.plate;
    return null;
  },

  // Suggested price = the price that hits the target cost %. Only ever a RAISE
  // (Bar Cop never tells you to cut a price); null when at/under target or no target.
  suggested(item, cost) {
    const tgt = this.targetPctFor(item);
    if (!tgt || !(cost > 0) || !(item.price > 0)) return null;
    const exact = cost / (tgt / 100);                 // the precise to-target price
    if (exact <= item.price + 0.01) return null;      // at/under target → no raise
    return Math.ceil(exact * 4) / 4;                  // round UP to the nearest quarter (a real menu price)
  },

  showHowTo() {
    App.showHelpModal('How Menu Engineering Works', [
      { p: ['Menu Engineering is your pricing engine. For every priced item it does two things: it sorts the item into Stars, Plowhorses, Puzzles, or Dogs against the other items in its own category, and it names the move plus the number behind it. It needs at least four complete items in a category to rank it; finish any Incomplete ones in Menu Items.'] },
      { h: 'Ranked by Category', p: ['Each item is measured against its own category, not the whole menu, so entrees compete with entrees and beverages with beverages. Margins run very differently across categories, and a soda was never going to out-earn a steak, so pooling them would brand half your menu Dogs for no reason. A category needs at least four priced items to form a fair group; smaller ones sit under Too Few to Rank.'] },
      { h: 'Keeping Covers Current', p: ['Everything here runs on each item\'s weekly covers, so the page is only as accurate as those numbers. Covers refresh on their own when you drop your product mix report at the Shift weekly close, matched to each menu item by name. If you need to refresh covers between closes, the Re-import Covers drop at the top of this page takes the same product mix export on demand. Keep them current and the classification, the suggested prices, and the pricing checks all stay honest.'] },
      { h: 'The Suggested Price', p: ['For any item running over its target cost percent, Bar Cop shows the price that brings it back to target, the item cost divided by your target cost percent, and the weekly dollars that move with it if volume holds. It only ever suggests a raise, never a cut. The Weekly Upside up top is what repricing every over-target item to target would add each week.'] },
      { h: 'The Move, Wired Up', p: ['Plowhorses and any over-target item get a Reprice step that prices to target and lets you adjust before you commit. Dogs go to a 90-day Dog Test, the rework-or-cut path. Stars and Puzzles carry their move, feature or promote, so you push them on the floor.'] },
      { h: 'Planned vs Live', p: ['A reprice saves as a Planned price first, because changing a number here is not the same as changing your real menu, you might be planning a whole overhaul. The item shows the plan next to your current live price. When the new prices actually roll out, hit Mark Live. That is the moment Bar Cop logs the change and starts tracking it, so Recovery always reflects your real menu, never a plan on paper.'] },
      { h: 'Repricing', p: ['The Reprice step models the new margin, cost percent, and weekly impact, and shows how far volume can fall before the raise stops paying off. Add an expected volume change if you want Bar Cop to hold you to a prediction. Save it as planned or mark it live on the spot.'] },
      { h: 'Pricing Review Log', p: ['Every change you make lands in the Pricing Review Log at the bottom, the one record of every price move. Once three weeks of covers come in, Bar Cop checks the real weekly swing against what you predicted, so your pricing instincts sharpen over time and the Recovery Scoreboard can measure whether a change actually moved the number.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const priced = (App.data.menu_items || []).some(i => i.price && i.cost && !i.archived);
    this.container.innerHTML = '<div class="screen">' + (priced ? this.coversImportHtml() : '') + this.classificationHtml() + '</div>';
    const c = this.container;
    c.querySelectorAll('.me-reprice').forEach(b => b.addEventListener('click', () => this.openReprice(b.dataset.id)));
    c.querySelectorAll('.me-marklive').forEach(b => b.addEventListener('click', () => this.markLive(b.dataset.id)));
    c.querySelectorAll('.me-cancelplan').forEach(b => b.addEventListener('click', () => this.cancelPlanned(b.dataset.id)));
    c.querySelectorAll('.me-dogtest').forEach(b => b.addEventListener('click', () => { App._dogTestPreselect = b.dataset.id; App.navigate('r-dog-test'); }));
    document.getElementById('me-batch')?.addEventListener('click', () => this.openBatch());
    document.getElementById('me-marklive-all')?.addEventListener('click', () => this.markAllLive());
    document.getElementById('me-export')?.addEventListener('click', () => App.exportPDF({ title: 'Menu Engineering', root: document.getElementById('me-export-root') || this.container }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.draw()));
    if (priced) this.mountCoversImport();
  },

  // ── The page: diagnosis (quadrant) + prescription (suggested price + action) ─
  classificationHtml() {
    // Inject the effective cost (auto-computed from recipe when attached, else
    // the manually-entered cost) so the math always sees a current number.
    const items = (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 })).filter(i => i.price && i.cost && i.weekly_covers && !i.archived);
    if (items.length >= 4) App.markSetupDone('gs_r_eng');
    if (items.length < 4) {
      return '<div class="card"><div class="empty">'
        + '<div class="empty-title">Not Enough Data</div>'
        + '<div class="empty-sub">Add at least 4 menu items with price, cost, and weekly covers to sort your menu into Stars, Plowhorses, Puzzles, and Dogs.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'r-menu-items\')">Go to Menu Items</button></div>'
        + '</div></div>';
    }

    const SINGULAR = { STAR: 'Star', PLOWHORSE: 'Plowhorse', PUZZLE: 'Puzzle', DOG: 'Dog' };
    const MOVE = {}; this.QUAD.forEach(q => { MOVE[q.key] = q.move; });
    const ORDER = this.QUAD.map(q => q.key);
    const f = v => App.fmtCurrency(v);

    const byCat = {};
    items.forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    const catSort = (a, b) => {
      const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    };

    const cands = this.batchCandidates();
    const repriceCount = cands.length;
    const upside = cands.reduce((s, c) => s + (c.dwk || 0), 0);
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
      const dwkCell = dwk != null
        ? '<span style="color:' + (dwk >= 0 ? 'var(--gold)' : 'var(--t2)') + ';">' + (dwk >= 0 ? '+' : '') + f(dwk) + '</span>'
        : '<span style="color:var(--t3);">-</span>';

      let action;
      if (planned) action = '<div class="row-actions"><button class="btn btn-primary btn-sm me-marklive" data-id="' + esc(i.id) + '">Mark Live</button><button class="btn btn-ghost btn-sm me-cancelplan" data-id="' + esc(i.id) + '">Cancel</button></div>';
      else if (isDog) action = this.dogAction(i.id);
      else if (sugg) action = '<div class="row-actions"><button class="btn btn-ghost btn-sm me-reprice" data-id="' + esc(i.id) + '">Reprice</button></div>';
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
          + '<button class="btn btn-ghost btn-sm no-print" id="me-export">Export PDF</button>';
        actionsPlaced = true;
      }
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:22px 0 10px;">'
        + '<div class="sh" style="margin:0;">' + esc(label) + '</div>'
        + '<div style="display:flex;align-items:center;flex-shrink:0;">' + btns + '</div></div>';
    };

    const colgroup = '<colgroup><col style="width:22%;"/><col style="width:18%;"/><col style="width:15%;"/><col style="width:15%;"/><col style="width:16%;"/><col style="width:14%;"/></colgroup>';

    // ── Ranked category cards ──────────────────────────────────────────────────
    const cards = Object.keys(byCat).sort(catSort).map(cat => {
      const list = byCat[cat];
      if (list.length < this.MIN_PER_CAT) { unranked.push(...list); return ''; }
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
          + '<td>' + f(i.price) + '</td>'
          + '<td>' + x.suggCell + '</td>'
          + '<td>' + x.dwkCell + '</td>'
          + '<td>' + x.action + '</td></tr>';
      }).join('');
      return heading(cat + ' (' + list.length + ')')
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + colgroup
        + '<thead><tr><th>Item</th><th>Class</th><th>Current</th><th>Suggested</th><th>&Delta;/wk</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>';
    }).join('');

    // ── Categories too small to rank fairly (still get the pricing engine) ─────
    let unrankedCard = '';
    if (unranked.length) {
      unranked.sort((a, b) => catSort(a.category || 'Uncategorized', b.category || 'Uncategorized') || b.weekly_covers - a.weekly_covers);
      const urows = unranked.map(i => {
        const x = cellsFor(i, null);
        return '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td>' + esc(i.category || '') + '</td>'
          + '<td>' + f(i.price) + '</td>'
          + '<td>' + x.suggCell + '</td>'
          + '<td>' + x.dwkCell + '</td>'
          + '<td>' + x.action + '</td></tr>';
      }).join('');
      unrankedCard = heading('Too Few to Rank')
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + colgroup
        + '<thead><tr><th>Item</th><th>Category</th><th>Current</th><th>Suggested</th><th>&Delta;/wk</th><th></th></tr></thead>'
        + '<tbody>' + urows + '</tbody></table></div>';
    }

    // ── Stat box — menu-wide rollups + the reprice headline + bulk actions ─────
    const avgCMall = items.reduce((s, i) => s + (i.price - i.cost), 0) / items.length;
    const avgCostPct = items.reduce((s, i) => s + (i.cost / i.price * 100), 0) / items.length;
    const plannedCount = items.filter(i => i.planned_price > 0).length;
    const calcItem = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const actionsRow = (plannedCount > 0)
      ? '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;"><button class="btn btn-ghost btn-sm" id="me-marklive-all">Mark All Live (' + plannedCount + ')</button></div>'
      : '';
    const statBox = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + calcItem('Items Analyzed', items.length)
      + calcItem('Avg Cost %', avgCostPct.toFixed(1) + '%')
      + calcItem('To Reprice', repriceCount)
      + calcItem('Weekly Upside', '<span style="color:var(--gold);">+' + f(upside) + '</span>')
      + '</div>'
      + actionsRow
      + '</div>';

    return '<div id="me-export-root">' + statBox + cards + unrankedCard + this.reviewLogHtml() + '</div>';
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
    set('re-impact', (impact >= 0 ? '+' : '') + App.fmtCurrency(impact));
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
    item.planned_price = Math.round(newPrice * 100) / 100;
    item.planned_vol_pct = parseFloat(volPct) || 0;
    item.planned_at = new Date().toISOString();
    App.saveKey('menu_items').then(() => { App.closeModal('re-modal'); this.draw(); });
  },

  // Roll it out now: set the live price + log the change at this moment.
  async saveLive(itemId, newPrice, volPct) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item || !(newPrice > 0)) return;
    const np = Math.round(newPrice * 100) / 100;
    const old = item.price;
    item.price = np;
    item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
    await App.saveKey('menu_items');
    if (old != null && old !== np) await this._logPriceChange(item, old, np, volPct);
    App.closeModal('re-modal');
    this.draw();
  },

  // Promote a planned price to live (the honest rollout moment).
  async markLive(itemId) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item || !(item.planned_price > 0)) return;
    const old = item.price, np = item.planned_price, vol = item.planned_vol_pct;
    item.price = np; item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
    await App.saveKey('menu_items');
    if (old != null && old !== np) await this._logPriceChange(item, old, np, vol);
    this.draw();
  },

  cancelPlanned(itemId) {
    const item = (App.data.menu_items || []).find(i => i.id === itemId);
    if (!item) return;
    item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
    App.saveKey('menu_items').then(() => this.draw());
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
    const items = (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 })).filter(i => i.price && i.cost && i.weekly_covers && !i.archived);
    const byCat = {}; items.forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    const dogs = new Set();
    Object.values(byCat).forEach(list => {
      if (list.length < this.MIN_PER_CAT) return;
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
    const logs = [];
    ids.forEach(id => {
      const item = (App.data.menu_items || []).find(x => x.id === id);
      if (!item) return;
      const cost = App.menuItemCost(item) || 0;
      const sugg = this.suggested(item, cost);
      if (!sugg) return;
      if (live) {
        const old = item.price;
        item.price = sugg; item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
        if (old != null && old !== sugg) logs.push([item, old, sugg, 0]);
      } else {
        item.planned_price = sugg; item.planned_vol_pct = 0; item.planned_at = new Date().toISOString();
      }
    });
    await App.saveKey('menu_items');
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
    planned.forEach(item => {
      const old = item.price, np = item.planned_price, vol = item.planned_vol_pct;
      item.price = np; item.planned_price = null; item.planned_at = null; item.planned_vol_pct = null;
      if (old != null && old !== np) logs.push([item, old, np, vol]);
    });
    await App.saveKey('menu_items');
    for (const [item, old, np, vol] of logs) await this._logPriceChange(item, old, np, vol);
    this.draw();
  },

  // ── Re-import covers from a POS sales-mix (PMIX) export ───────────────────────
  // Per-item covers drive the whole page (classification, suggested prices, the
  // pricing checks). Covers normally refresh when the product-mix report drops at
  // the Shift weekly close; this on-page drop is the between-closes door to
  // re-import just covers. Matches each row to a menu item by name and upserts
  // weekly_covers. Directions live in the nav-i help (Keeping Covers Current).
  coversImportHtml() {
    const fl = this._coversFlash; this._coversFlash = null;
    let flash = '';
    if (fl) {
      flash = '<div style="font-size:13px;margin-top:12px;font-weight:700;color:' + (fl.updated ? 'var(--gold)' : 'var(--red)') + ';">'
        + (fl.updated ? 'Updated covers on ' + fl.updated + ' item' + (fl.updated === 1 ? '' : 's') + '.' : 'No items matched. Check that the item names in your export match your menu.')
        + '</div>'
        + (fl.unmatched.length ? '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:6px;">Not matched: ' + fl.unmatched.slice(0, 8).map(esc).join(', ') + (fl.unmatched.length > 8 ? ', and ' + (fl.unmatched.length - 8) + ' more' : '') + '. Add them in Menu Items or rename to match.</div>' : '');
    }
    return '<div class="card form-card no-print">'
      + '<div class="card-title" style="display:flex;align-items:center;gap:10px;"><span>Re-import Covers</span>' + App.cadenceTag('As needed') + '</div>'
      + '<div id="me-cov-csv"></div>' + flash
      + '<div id="me-cov-actions" style="margin-top:12px;"></div>'
      + '</div>';
  },

  mountCoversImport() {
    const el = document.getElementById('me-cov-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS product-mix (PMIX) report here',
      dropSub: 'One row per item with units sold for the week. Bar Cop matches each row to a menu item by name and refreshes its weekly covers.',
      actionsEl: '#me-cov-actions',
      fields: PosIngest.FIELDS.pmix,
      confirmLabel: 'Update Covers',
      onComplete: rows => this.applyCoversImport(rows)
    });
  },

  async applyCoversImport(rows) {
    // One ingest path: PosIngest matches by name + upserts weekly_covers.
    const { toAdd, skipped } = PosIngest.build('pmix', rows);
    let updated = 0;
    if (toAdd.length) { await PosIngest.commit('pmix', toAdd); updated = toAdd.length; }
    this._coversFlash = { updated, unmatched: skipped.filter(s => s && s !== '(blank)') };
    this.draw();
  },

  // Write the price-log + the pricing fix event, dated NOW (the real rollout).
  // Mirrors the direct-edit path in Menu Items so the Pricing Review Log and the
  // Recovery Scoreboard both pick it up. Pricing is a no-dollar metric, so this
  // logs the change and its date, never an invented recovered figure.
  async _logPriceChange(item, oldPrice, newPrice, volPct) {
    const cost = App.menuItemCost(item) || 0;
    const covers = item.weekly_covers || 0;
    const vp = parseFloat(volPct) || 0;
    const oldCM = oldPrice - cost, newCM = newPrice - cost;
    const predWk = (newCM * (covers * (1 + vp / 100))) - (oldCM * covers);
    await App.logPriceChange(item, oldPrice, newPrice, { volPct: vp, predictedWeekly: predWk, reason: 'Reprice from Menu Engineering', source: 'menu-engineering' });
  },

  // ── Pricing Review Log — every logged price change, verified against the
  // prediction once three weeks of covers land (folded in from the retired Price
  // Calculator so there is one pricing door). Honest by construction: a result
  // shows only when the captured baseline and current covers both exist. ────────
  verify(entry) {
    if (!entry || !entry.date || entry.covers_at_change == null || entry.cost == null) return { status: 'old-format' };
    const t = new Date(entry.date + 'T00:00:00').getTime();
    if (isNaN(t)) return { status: 'old-format' };
    const weeks = Math.floor((Date.now() - t) / (7 * 86400000));
    if (weeks < 3) return { status: 'pending', weeks: Math.max(weeks, 0) };
    const baseItem = (App.data.menu_items || []).find(i => i.id === entry.item_id);
    const item = baseItem ? { ...baseItem, cost: App.menuItemCost(baseItem) || baseItem.cost } : null;
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
      const tone = v.actualWeekly >= 0 ? 'var(--gold)' : 'var(--red)';
      const pred = v.predicted != null
        ? 'predicted ' + (v.predicted > 0 ? '+' : '') + App.fmtCurrency(v.predicted) + '/wk'
        : 'no prediction on file';
      vCell = '<div style="font-weight:700;color:' + tone + ';">'
        + (v.actualWeekly > 0 ? '+' : '') + App.fmtCurrency(v.actualWeekly) + '/wk actual</div>'
        + '<div style="font-size:10px;color:var(--t3);">covers ' + v.coversThen + ' to ' + v.coversNow + ', ' + pred + '</div>';
    } else if (v.status === 'pending') {
      vCell = '<span style="color:var(--t3);">Measuring, week ' + v.weeks + ' of 3</span>';
    } else {
      vCell = '<span style="color:var(--t4);">Not verifiable</span>';
    }
    return '<tr><td>' + (entry.date || '').slice(0, 10) + '</td>'
      + '<td><div class="val">' + esc(entry.item_name || '') + '</div></td>'
      + '<td>' + App.fmtCurrency(entry.old_price) + '</td>'
      + '<td>' + App.fmtCurrency(entry.new_price) + '</td>'
      + '<td colspan="2" style="font-size:11px;">' + vCell + '</td></tr>';
  },

  reviewLogHtml() {
    const log = (App.data.revenue_price_log || []).slice().reverse();
    const rows = log.slice(0, App.listLimit('core', 'revenue_price_log')).map(e => this.logRow(e)).join('')
      || '<tr><td colspan="6" style="color:var(--t4);text-align:center;padding:22px;">No price changes logged yet. Reprice an item above and it lands here, verified against the real result after three weeks.</td></tr>';
    return '<div class="sh" style="margin:24px 0 10px;">Pricing Review Log</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:22%;"/><col style="width:18%;"/><col style="width:15%;"/><col style="width:15%;"/><col style="width:16%;"/><col style="width:14%;"/></colgroup>'
      + '<thead><tr><th>Date</th><th>Item</th><th>Old Price</th><th>New Price</th><th colspan="2">Verification</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('core', 'revenue_price_log', log, false);
  }
};
