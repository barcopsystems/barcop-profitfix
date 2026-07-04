'use strict';

/* ── Revenue Recovery — Menu Planning (layout & ordering worksheet) ────────────
   Closes the loop Build → Engineer → Lay out → hand off. It pulls every menu item
   from Menu Builder, groups them into their menu sections, and lets the operator
   drag the sections and the items into the exact order the printed menu should
   read, with an optional description per item. Each item carries its menu-
   engineering class (Star / Plowhorse / Puzzle / Dog) and cost percent as a
   placement guide, so the high-margin items land where the eye goes. Export Brief
   prints a clean sections / order / descriptions / prices sheet to hand a printer
   or designer: content and order only, no fonts, no layout. It never changes a
   price or a cost. Order saves on each item (menu_order) + the copy
   (menu_description); section order saves to App.data.menu_section_order. */

S.RevenueMenuPlanning = {
  container: null,

  // Canonical menu order for any section the operator has not placed yet.
  CAT_ORDER: ['Cocktails', 'Appetizers', 'Entrees', 'Desserts', 'Specials', 'Beer', 'Wine', 'NA Beverages', 'Snacks'],
  SINGULAR: { STAR: 'Star', PLOWHORSE: 'Plowhorse', PUZZLE: 'Puzzle', DOG: 'Dog' },

  items() { return (App.data.menu_items || []).filter(i => !i.archived); },
  byId(id) { return (App.data.menu_items || []).find(i => i.id === id) || null; },

  // Section display order: the operator's saved order first, then any new section
  // in the canonical menu order, then anything else alphabetically.
  sectionOrder(cats) {
    const saved = Array.isArray(App.data.menu_section_order) ? App.data.menu_section_order : [];
    const rank = c => {
      const s = saved.indexOf(c); if (s !== -1) return s;
      const k = this.CAT_ORDER.indexOf(c); return (k === -1 ? 900 : 100 + k);
    };
    return cats.slice().sort((a, b) => (rank(a) - rank(b)) || a.localeCompare(b));
  },

  // Items within a section: the operator's saved order first, then by name.
  itemSort(a, b) {
    const oa = (a.menu_order != null && a.menu_order !== '') ? a.menu_order : Number.MAX_SAFE_INTEGER;
    const ob = (b.menu_order != null && b.menu_order !== '') ? b.menu_order : Number.MAX_SAFE_INTEGER;
    return (oa - ob) || (a.name || '').localeCompare(b.name || '');
  },

  // A small pill. color = meaning only (over-target cost reads as a leak).
  chip(text, opts) {
    opts = opts || {};
    return '<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;font-size:10px;'
      + 'font-weight:700;letter-spacing:.3px;vertical-align:middle;background:' + (opts.bg || 'transparent')
      + ';border:1px solid ' + (opts.border || 'var(--b1)') + ';color:' + (opts.color || 'var(--t2)') + ';">'
      + esc(text) + '</span>';
  },

  chipsFor(item, quad) {
    let h = '';
    if (quad && this.SINGULAR[quad]) h += this.chip(this.SINGULAR[quad]);
    const cost = App.menuItemCost(item) || 0;
    if (item.price > 0 && cost > 0) {
      const pct = cost / item.price * 100;
      const tgt = S.RevenueMenuEngineering.targetPctFor(item);
      const over = tgt && pct > tgt;
      h += this.chip(pct.toFixed(0) + '% cost', over ? { color: 'var(--red)', border: 'var(--red)' } : {});
      h += this.chip(App.fmtCurrency(item.price - cost) + ' margin');
    }
    return h;
  },

  priceCellHTML(item) {
    let h = item.price > 0
      ? '<span style="font-weight:600;color:var(--t1);">' + App.fmtCurrency(item.price) + '</span>'
      : '<span style="color:var(--t4);font-weight:600;">No price</span>';
    (item.other_prices || []).forEach(op => {
      if (op && op.price > 0) h += '<div style="font-size:11px;font-weight:400;color:var(--t3);">' + esc(op.label || 'Alt') + ' ' + App.fmtCurrency(op.price) + '</div>';
    });
    return h;
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
        lead: 'Menu Planning lays out your menu after Menu Builder prices it. Drag your sections and items into the order they should print, add a description to each, and export a clean brief for your printer. Add your menu items first.',
        steps: [
          { title: 'Build your menu', desc: 'Add and price your menu items in Menu Builder. They show up here grouped into their sections, ready to arrange.', btn: 'Go to Menu Builder', screen: 'r-menu-items', done: false }
        ]
      });
      return;
    }

    const byCat = {};
    items.forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    const cats = this.sectionOrder(Object.keys(byCat));
    const classMap = S.RevenueMenuEngineering.classify();

    const sections = cats.map(cat => {
      const list = byCat[cat].slice().sort((a, b) => this.itemSort(a, b));
      const rows = list.map(i => {
        return '<tr data-id="' + esc(i.id) + '">'
          + DragReorder.handleCell()
          + '<td>'
          +   '<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;">'
          +     '<div style="min-width:0;"><span class="val" style="font-weight:600;">' + esc(i.name || 'Unnamed') + '</span>' + this.chipsFor(i, classMap[i.id]) + '</div>'
          +     '<div style="flex-shrink:0;text-align:right;">' + this.priceCellHTML(i) + '</div>'
          +   '</div>'
          +   '<textarea class="mp-desc notes-ta" data-id="' + esc(i.id) + '" rows="2" placeholder="Menu description (optional)" style="margin-top:8px;width:100%;">' + esc(i.menu_description || '') + '</textarea>'
          + '</td></tr>';
      }).join('');
      return '<div class="card form-card mp-sec" data-id="' + esc(cat) + '" style="margin-bottom:14px;">'
        + '<div class="card-title" style="display:flex;align-items:center;gap:10px;">'
        +   '<span class="mp-sec-handle" style="cursor:grab;color:var(--t3);display:inline-flex;touch-action:none;" title="Drag to reorder sections">' + DragReorder.HANDLE_GLYPH + '</span>'
        +   '<span>' + esc(cat) + '</span>'
        +   '<span style="margin-left:auto;font-weight:400;color:var(--t3);font-size:12px;">' + list.length + (list.length === 1 ? ' item' : ' items') + '</span>'
        + '</div>'
        + '<table class="row-list mp-items" data-cat="' + esc(cat) + '" style="width:100%;"><tbody>' + rows + '</tbody></table>'
        + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;">'
      +   '<div class="sh" style="margin:0;">Menu Sections</div>'
      +   '<button class="btn btn-ghost btn-sm" id="mp-export">Export Brief</button>'
      + '</div>'
      + '<div id="mp-sections">' + sections + '</div>'
      + '</div>';

    this.wire();
  },

  wire() {
    const c = this.container;

    // Reorder the sections themselves.
    const secWrap = c.querySelector('#mp-sections');
    if (secWrap) DragReorder.wire({ container: secWrap, rowSelector: '.mp-sec', handleSelector: '.mp-sec-handle', dragClass: 'dr-dragging', onCommit: ids => this.persistSectionOrder(ids) });

    // Reorder items within each section.
    c.querySelectorAll('table.mp-items').forEach(tbl => {
      DragReorder.wire({ container: tbl, rowSelector: 'tr[data-id]', handleSelector: '.dr-handle', dragClass: 'dr-dragging', onCommit: ids => this.persistItemOrder(ids) });
    });

    // Descriptions: keep in memory on every keystroke (survives a re-render or
    // navigating away), persist to storage on blur.
    c.querySelectorAll('.mp-desc').forEach(ta => {
      ta.addEventListener('input', () => { const it = this.byId(ta.dataset.id); if (it) it.menu_description = ta.value; });
      ta.addEventListener('change', () => { App.saveKey('menu_items'); });
    });

    document.getElementById('mp-export')?.addEventListener('click', () => this.exportBrief());
  },

  async persistSectionOrder(ids) {
    App.data.menu_section_order = ids;
    await App.saveKey('menu_section_order');
  },

  async persistItemOrder(ids) {
    ids.forEach((id, i) => { const it = this.byId(id); if (it) it.menu_order = i + 1; });
    await App.saveKey('menu_items');
  },

  // A clean, content-only DOM for the printer/designer brief: each section in
  // order, its items in order, the description, and every price (including happy
  // hour / specials). No chips, handles, or engineering data.
  buildBriefRoot() {
    const items = this.items();
    const byCat = {};
    items.forEach(i => { const c = i.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(i); });
    const cats = this.sectionOrder(Object.keys(byCat));
    const root = document.createElement('div');
    root.className = 'screen';
    root.style.cssText = 'position:absolute;left:-9999px;top:0;width:640px;';
    root.innerHTML = cats.map(cat => {
      const rows = byCat[cat].slice().sort((a, b) => this.itemSort(a, b)).map(i => {
        let priceTxt = i.price > 0 ? App.fmtCurrency(i.price) : '';
        (i.other_prices || []).forEach(op => { if (op && op.price > 0) priceTxt += (priceTxt ? ' / ' : '') + (op.label || 'Alt') + ' ' + App.fmtCurrency(op.price); });
        return '<tr><td>' + esc(i.name || 'Unnamed') + '</td><td>' + esc(i.menu_description || '') + '</td><td>' + esc(priceTxt) + '</td></tr>';
      }).join('');
      return '<div class="sh">' + esc(cat) + '</div>'
        + '<table class="row-list"><thead><tr><th>Item</th><th>Description</th><th>Price</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }).join('');
    return root;
  },

  async exportBrief() {
    const root = this.buildBriefRoot();
    document.body.appendChild(root);
    try { await App.exportPDF({ title: 'Menu Brief', root }); }
    finally { root.remove(); }
  },

  showHowTo() {
    App.showHelpModal('How Menu Planning Works', [
      { p: ['Menu Planning is where you lay out your menu after Menu Builder prices it and Menu Engineering ranks it. Every menu item shows up here, grouped into its sections. Drag the sections into the order they should print, and drag the items within a section into the order the eye should read them. This page never changes a price or a cost, it only sets the order and the copy.'] },
      { h: 'Place Your Winners', p: ['Each item carries its menu-engineering class and cost percent as a placement guide. Stars and Puzzles are your high-margin items, so put them where the eye lands first, the top of a section and the top of the page. Plowhorses sell well but earn less, so do not lead a section with them.'] },
      { h: 'Descriptions', p: ['Add an optional description under any item, the menu copy a guest reads. It saves as you type and prints on the brief.'] },
      { h: 'Export Brief', p: ['Export Brief prints a clean sheet: your sections in order, the items in order, each description, and every price including happy-hour and special prices. It is content and order only, no fonts or layout, so you can hand it straight to a printer or designer to build the real menu.'] }
    ]);
  }
};
