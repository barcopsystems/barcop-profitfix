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

  showHowTo() {
    App.showHelpModal('How Menu Engineering Works', [
      { p: ['Menu Engineering sorts every priced item that has a cost and weekly covers into four groups by margin and popularity, so you know exactly what to push, reprice, promote, or cut. It needs at least four complete items; finish any Incomplete ones in Menu Items.'] },
      { h: 'The Numbers', p: ['The box up top reads your whole menu at a glance: how many items were analyzed, your average cost percent and average margin across them, and how many Plowhorses are sitting underpriced and waiting on a price bump.'] },
      { h: 'The Four Groups', p: ['Stars are high margin and high volume, your winners, so feature them and brief servers to push them. Plowhorses sell well but earn little, so raise the price. Puzzles earn well but sell slowly, so promote them and give them server attention. Dogs are low on both, candidates to rework or cut.'] },
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

  // ── Classification (Stars / Plowhorses / Puzzles / Dogs) ─────────────────────
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

    const avgCM     = items.reduce((s, i) => s + (i.price - i.cost), 0) / items.length;
    const avgCovers = items.reduce((s, i) => s + i.weekly_covers, 0) / items.length;
    const classify = item => {
      const hiM = (item.price - item.cost) >= avgCM;
      const hiV = item.weekly_covers >= avgCovers;
      if (hiM && hiV) return 'STAR';
      if (!hiM && hiV) return 'PLOWHORSE';
      if (hiM && !hiV) return 'PUZZLE';
      return 'DOG';
    };
    const classified = items.map(item => ({ ...item, quad: classify(item), cm: item.price - item.cost, pct: (item.cost / item.price * 100).toFixed(1) }));

    // ── Stat box — menu-level rollups + the reprice-candidate count ────────────
    const avgCostPct = items.reduce((s, i) => s + (i.cost / i.price * 100), 0) / items.length;
    const plowCount  = classified.filter(i => i.quad === 'PLOWHORSE').length;
    const calcItem = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statBox = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + calcItem('Items Analyzed', items.length)
      + calcItem('Avg Cost %', avgCostPct.toFixed(1) + '%')
      + calcItem('Avg Margin', App.fmtCurrency(avgCM))
      + calcItem('Plowhorses to Reprice', plowCount)
      + '</div></div>';

    // One card per group: a heading that names the group + count + the move, then
    // the item detail with a Reprice link. Shared fixed colgroup so the four
    // group tables line their columns up down the page.
    const groups = this.QUAD.map(q => {
      const qItems = classified.filter(i => i.quad === q.key).sort((a, b) => b.weekly_covers - a.weekly_covers);
      if (!qItems.length) return '';
      const rows = qItems.map(i =>
        '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
        + '<td>' + esc(i.category || '') + '</td>'
        + '<td>' + App.fmtCurrency(i.price) + '</td>'
        + '<td>' + i.pct + '%</td>'
        + '<td>' + App.fmtCurrency(i.cm) + '</td>'
        + '<td>' + i.weekly_covers + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm me-reprice" data-id="' + esc(i.id) + '">Reprice</button></div></td></tr>').join('');
      return '<div class="sh" style="margin:22px 0 10px;">'
        + esc(q.label) + ' (' + qItems.length + ')'
        + '<span style="color:var(--t3);font-weight:400;text-transform:none;letter-spacing:0;">&nbsp;&mdash; ' + esc(q.move) + '</span></div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + '<colgroup><col style="width:230px;"/><col/><col/><col/><col/><col/><col style="width:120px;"/></colgroup>'
        + '<thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th></th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>';
    }).join('');

    return statBox + groups;
  }
};
