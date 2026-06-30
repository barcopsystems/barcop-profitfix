'use strict';

/* ── Revenue Recovery — Menu Engineering ──────────────────────────────────────
   Pure diagnosis: a stat box + a margin x popularity classification (Stars /
   Plowhorses / Puzzles / Dogs) that NAMES THE MOVE for each group. Every item
   has a Reprice link that jumps to the Price Calculator with the item
   preselected. (The price calculator + pricing log moved to their own page,
   r-price-calc; the old SVG scatter matrix + "vs Last Update" column are gone.) */

S.RevenueMenuEngineering = {
  // The four groups + the one-line move for each. The diagnosis is text now
  // (no color cue — the move spells out what to do).
  QUAD: [
    { key: 'STAR',      label: 'Stars',      move: 'Feature & push' },
    { key: 'PLOWHORSE', label: 'Plowhorses', move: 'Raise the price' },
    { key: 'PUZZLE',    label: 'Puzzles',    move: 'Promote' },
    { key: 'DOG',       label: 'Dogs',       move: 'Rework or cut' }
  ],

  // A category needs at least this many priced items to rank fairly against itself.
  MIN_PER_CAT: 4,

  showHowTo() {
    App.showHelpModal('How Menu Engineering Works', [
      { p: ['Menu Engineering sorts every priced item that has a cost and weekly covers into four groups by margin and popularity, so you know exactly what to push, reprice, promote, or cut. It needs at least four complete items in a category; finish any Incomplete ones in Menu Items.'] },
      { h: 'Ranked by Category', p: ['Each item is measured against its own category, not the whole menu, so entrees compete with entrees and beverages with beverages. Margins run very differently across categories, and a soda was never going to out-earn a steak, so pooling them would brand half your menu Dogs for no reason. A category needs at least four priced items to form a fair group; smaller ones sit under Too Few to Rank until you add more.'] },
      { h: 'The Numbers', p: ['The box up top reads your whole menu at a glance: how many items were analyzed, your average cost percent and average margin across them, and how many Plowhorses across every category are sitting underpriced and waiting on a price bump.'] },
      { h: 'The Four Groups', p: ['Stars are high margin and high volume for their category, your winners, so feature them and brief servers to push them. Plowhorses sell well but earn little, so raise the price. Puzzles earn well but sell slowly, so promote them and give them server attention. Dogs are low on both, candidates to rework or cut.'] },
      { h: 'Repricing', p: ['Reprice on any row opens the Price Calculator with that item ready, so you can model the new margin and weekly dollar impact before you commit, then log the change.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    this.container.innerHTML = '<div class="screen">' + this.classificationHtml() + '</div>';
    // Reprice → Price Calculator with the item preselected (same-module navigate
    // + a one-shot handoff flag the calculator consumes on render).
    this.container.querySelectorAll('.me-reprice').forEach(b =>
      b.addEventListener('click', () => { App._pricePreselect = b.dataset.id; App.navigate('r-price-calc'); }));
  },

  // ── Classification (Stars / Plowhorses / Puzzles / Dogs), per category ───────
  classificationHtml() {
    // Inject the effective cost (auto-computed from recipe when attached, else
    // the manually-entered cost) so the math always sees a current number.
    const items = (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 })).filter(i => i.price && i.cost && i.weekly_covers);
    if (items.length >= 4) App.markSetupDone('gs_r_eng');
    if (items.length < 4) {
      return '<div class="card"><div class="empty">'
        + '<div class="empty-title">Not Enough Data</div>'
        + '<div class="empty-sub">Add at least 4 menu items with price, cost, and weekly covers to sort your menu into Stars, Plowhorses, Puzzles, and Dogs.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'r-menu-items\')">Go to Menu Items</button></div>'
        + '</div></div>';
    }

    // Classify each item WITHIN its own category: it is measured against the
    // average margin and average covers of its OWN category, not the whole menu.
    // Comparing a soda to a steak is apples to oranges, so a Dog means the weakest
    // performer among its peers, the read you can actually act on. A category needs
    // at least MIN_PER_CAT priced items to form a fair group; smaller ones are
    // listed unranked.
    const SINGULAR = { STAR: 'Star', PLOWHORSE: 'Plowhorse', PUZZLE: 'Puzzle', DOG: 'Dog' };
    const MOVE = {}; this.QUAD.forEach(q => { MOVE[q.key] = q.move; });
    const ORDER = this.QUAD.map(q => q.key);

    const byCat = {};
    items.forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    const catSort = (a, b) => {
      const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    };

    let totalPlow = 0;
    const unranked = [];
    const cards = Object.keys(byCat).sort(catSort).map(cat => {
      const list = byCat[cat];
      if (list.length < this.MIN_PER_CAT) { unranked.push(...list); return ''; }
      const avgCM = list.reduce((s, i) => s + (i.price - i.cost), 0) / list.length;
      const avgCovers = list.reduce((s, i) => s + i.weekly_covers, 0) / list.length;
      const classed = list.map(i => {
        const hiM = (i.price - i.cost) >= avgCM, hiV = i.weekly_covers >= avgCovers;
        const quad = (hiM && hiV) ? 'STAR' : (!hiM && hiV) ? 'PLOWHORSE' : (hiM && !hiV) ? 'PUZZLE' : 'DOG';
        return { ...i, quad, cm: i.price - i.cost, pct: (i.cost / i.price * 100).toFixed(1) };
      });
      totalPlow += classed.filter(i => i.quad === 'PLOWHORSE').length;
      classed.sort((a, b) => ORDER.indexOf(a.quad) - ORDER.indexOf(b.quad) || b.weekly_covers - a.weekly_covers);
      const rows = classed.map(i =>
        '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
        + '<td><div class="val">' + SINGULAR[i.quad] + '</div><div style="font-size:10px;color:var(--t3);">' + esc(MOVE[i.quad]) + '</div></td>'
        + '<td>' + App.fmtCurrency(i.price) + '</td>'
        + '<td>' + i.pct + '%</td>'
        + '<td>' + App.fmtCurrency(i.cm) + '</td>'
        + '<td>' + i.weekly_covers + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm me-reprice" data-id="' + esc(i.id) + '">Reprice</button></div></td></tr>').join('');
      return '<div class="sh" style="margin:22px 0 10px;">' + esc(cat) + ' (' + list.length + ')</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + '<colgroup><col style="width:200px;"/><col style="width:150px;"/><col/><col/><col/><col/><col style="width:120px;"/></colgroup>'
        + '<thead><tr><th>Item</th><th>Class</th><th>Price</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>';
    }).join('');

    // ── Stat box — menu-wide rollups + the reprice-candidate count ────────────
    const avgCMall = items.reduce((s, i) => s + (i.price - i.cost), 0) / items.length;
    const avgCostPct = items.reduce((s, i) => s + (i.cost / i.price * 100), 0) / items.length;
    const calcItem = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statBox = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + calcItem('Items Analyzed', items.length)
      + calcItem('Avg Cost %', avgCostPct.toFixed(1) + '%')
      + calcItem('Avg Margin', App.fmtCurrency(avgCMall))
      + calcItem('Plowhorses to Reprice', totalPlow)
      + '</div></div>';

    // ── Categories too small to rank fairly against themselves ─────────────────
    let unrankedCard = '';
    if (unranked.length) {
      unranked.sort((a, b) => catSort(a.category || 'Uncategorized', b.category || 'Uncategorized') || b.weekly_covers - a.weekly_covers);
      const urows = unranked.map(i =>
        '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
        + '<td>' + esc(i.category || '') + '</td>'
        + '<td>' + App.fmtCurrency(i.price) + '</td>'
        + '<td>' + (i.cost / i.price * 100).toFixed(1) + '%</td>'
        + '<td>' + App.fmtCurrency(i.price - i.cost) + '</td>'
        + '<td>' + i.weekly_covers + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm me-reprice" data-id="' + esc(i.id) + '">Reprice</button></div></td></tr>').join('');
      unrankedCard = '<div class="sh" style="margin:22px 0 10px;">Too Few to Rank</div>'
        + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin:0 0 10px;">These categories have fewer than ' + this.MIN_PER_CAT + ' priced items, so there is no fair group to rank them against yet. Add more items in the category and they sort into Stars, Plowhorses, Puzzles, and Dogs.</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + '<colgroup><col style="width:200px;"/><col/><col/><col/><col/><col/><col style="width:120px;"/></colgroup>'
        + '<thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th></th></tr></thead>'
        + '<tbody>' + urows + '</tbody></table></div>';
    }

    return statBox + cards + unrankedCard;
  }
};
