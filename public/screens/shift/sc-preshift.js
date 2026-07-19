'use strict';

/* ── Shift Control — Pre-Shift Briefing ───────────────────────────────────────
   The before-doors line-up tool, next to Run Checklists. It is PER SERVICE
   PERIOD: pick the period (Lunch, Dinner, ...) from the operator's configured
   service periods and hold a separate briefing for each, so a bar that runs
   lunch and dinner logs a pre-lunch and a pre-dinner briefing the same day.
   Bar Cop builds each one from live data: the check-average target, the day's
   cover forecast, a featured-items list pre-filled with your best-margin sellers
   (swap or remove any that do not fit this service), and your upsell sequence
   (customizable on-page). The manager adds a focus line, reads it at line-up or
   exports it, and taps Held to log it. Logging is OPT-IN: it feeds the Bar Cop
   Audit's operational discipline only once you use it, and never dings a bar
   that does not. Held records live in the sc_briefings event store keyed by
   (date + period); the customized upsell sequence lives in the
   sc_upsell_sequence config blob. */

S.ShiftPreShift = {

  _period: null,
  _focusBy: {},      // period -> in-progress focus text
  _featuredBy: {},   // period -> in-progress featured item ids

  // Default upsell sequence. The operator can customize it on-page; the saved
  // version lives in App.shiftData.sc_upsell_sequence. Kept as [title, desc].
  UPSELL: [
    ['Greet and first-round drink', 'A drink order on the first visit. The first-round drink is the opening move at every table.'],
    ['Appetizer offer', 'Name one, do not ask "any apps?"'],
    ['Feature the picks', 'Recommend from the featured items below. Point to a dish, not the menu.'],
    ['Second round', 'Check drinks at the halfway mark.'],
    ['Dessert and after', 'Offer both, every table.'],
    ['Genuine close', 'Thank them, invite them back.']
  ],

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  briefings() { return (App.shiftData && App.shiftData.sc_briefings) || []; },
  n(v) { return (v == null || isNaN(v)) ? null : Number(v); },

  // The record for today's currently-selected service period, or null.
  _record() {
    const t = App.todayLocal();
    return this.briefings().find(b => (b.date || '') === t && (b.period || '') === this._period) || null;
  },

  // Resolve the selected period, defaulting to the one the clock is in.
  _ensurePeriod() {
    const periods = App.SHIFT_TYPES || [];
    if (!periods.length) { this._period = this._period || 'Service'; return periods; }
    if (!this._period || !periods.includes(this._period)) {
      const cur = App.servicePeriodByTime();
      this._period = (cur && cur.name && periods.includes(cur.name)) ? cur.name : periods[0];
    }
    return periods;
  },

  // ── The upsell sequence (customizable) ──────────────────────────────────────
  upsellSeq() {
    const s = App.shiftData && App.shiftData.sc_upsell_sequence;
    if (Array.isArray(s) && s.length) return s.map(u => ({ title: u.title || '', desc: u.desc || '' }));
    return this.UPSELL.map(u => ({ title: u[0], desc: u[1] }));
  },

  // ── Focus + featured, held per selected period ──────────────────────────────
  _curFocus() {
    const p = this._period;
    if (this._focusBy[p] == null) { const rec = this._record(); this._focusBy[p] = (rec && rec.focus) || ''; }
    return this._focusBy[p];
  },

  // Recommended featured items: high margin AND high volume vs the whole menu.
  todayStars() {
    // Cost is computed from the recipe/product, not stored on the item, so read it
    // through App.menuItemCost (a bare i.cost is null for most items).
    const items = ((App.data && App.data.menu_items) || [])
      .filter(i => !i.archived)
      .map(i => ({ item: i, price: this.n(i.price), cost: this.n(App.menuItemCost(i)), covers: this.n(i.weekly_covers) }))
      .filter(x => x.price != null && x.cost != null && x.covers != null && x.covers > 0);
    if (items.length < 4) return [];
    const avgCM = items.reduce((s, x) => s + (x.price - x.cost), 0) / items.length;
    const avgCov = items.reduce((s, x) => s + x.covers, 0) / items.length;
    return items.filter(x => (x.price - x.cost) >= avgCM && x.covers >= avgCov)
      .sort((a, b) => (b.price - b.cost) - (a.price - a.cost))
      .slice(0, 5)
      .map(x => x.item);
  },

  // ── Daypart-aware featured recommendation ───────────────────────────────────
  // Menu items are not tagged by daypart, so we infer fit from category + price:
  // lighter plates and apps at lunch, the big entrees and cocktails at dinner,
  // drinks and apps late night. It only shapes the DEFAULT list for a period; the
  // operator's swaps/removes still stick (saved per period).
  _CATGROUP: {
    'Appetizers': 'light', 'Sides': 'light', 'Snacks': 'light',
    'Entrees': 'heavy', 'Specials': 'heavy', 'Desserts': 'dessert',
    'Cocktails': 'cocktail', 'Beer': 'drink', 'Wine': 'drink', 'NA Beverages': 'drink'
  },
  _DAYPART: {
    breakfast: { light: 1.3, heavy: 1.0, dessert: 0.7, cocktail: 0.3, drink: 0.9, price: 'low' },
    lunch:     { light: 1.3, heavy: 1.0, dessert: 0.8, cocktail: 0.6, drink: 0.9, price: 'low' },
    happy:     { light: 1.3, heavy: 0.7, dessert: 0.6, cocktail: 1.4, drink: 1.3, price: 'low' },
    dinner:    { light: 1.1, heavy: 1.3, dessert: 1.0, cocktail: 1.2, drink: 1.1, price: 'high' },
    latenight: { light: 1.3, heavy: 0.6, dessert: 0.7, cocktail: 1.5, drink: 1.2, price: 'neutral' }
  },
  // Match the operator's (freely named) service period to a daypart profile, or
  // null for an unrecognized name (falls back to plain best-margin sellers).
  _profileFor(period) {
    const p = (period || '').toLowerCase();
    if (/break|brunch|morning/.test(p))  return this._DAYPART.breakfast;
    if (/happy|hh/.test(p))              return this._DAYPART.happy;
    if (/late|night/.test(p))            return this._DAYPART.latenight;
    if (/lunch|noon|mid.?day/.test(p))   return this._DAYPART.lunch;
    if (/dinner|supper|evening/.test(p)) return this._DAYPART.dinner;
    return null;
  },

  // Top featured items for a period: high-margin sellers, weighted to the daypart.
  _recommendedFor(period) {
    const all = ((App.data && App.data.menu_items) || [])
      .filter(i => !i.archived)
      .map(i => ({ item: i, price: this.n(i.price), cost: this.n(App.menuItemCost(i)), covers: this.n(i.weekly_covers) }))
      .filter(x => x.price != null && x.cost != null && x.covers != null && x.covers > 0 && (x.price - x.cost) > 0);
    if (all.length < 4) return this.todayStars();
    // Prefer items that actually sell (above the menu average), unless that
    // leaves too few to fill the list.
    const avgCov = all.reduce((s, x) => s + x.covers, 0) / all.length;
    let pool = all.filter(x => x.covers >= avgCov);
    if (pool.length < 5) pool = all;
    const profile = this._profileFor(period);
    const prices = pool.map(x => x.price).slice().sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const cm = (cat) => { if (!profile) return 1; const g = this._CATGROUP[cat]; return (g && profile[g] != null) ? profile[g] : 1; };
    const pm = (price) => !profile ? 1 : profile.price === 'low' ? (price <= median ? 1.15 : 0.85) : profile.price === 'high' ? (price >= median ? 1.15 : 0.9) : 1;
    return pool
      .map(x => ({ item: x.item, s: (x.price - x.cost) * cm(x.item.category || '') * pm(x.price) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(o => o.item);
  },

  _curFeatured() {   // array of item ids for the selected period
    const p = this._period;
    if (this._featuredBy[p] == null) {
      const rec = this._record();
      this._featuredBy[p] = (rec && Array.isArray(rec.featured)) ? rec.featured.slice() : this._recommendedFor(p).map(s => s.id);
    }
    return this._featuredBy[p];
  },
  featuredItems() {
    const menu = (App.data && App.data.menu_items) || [];
    return this._curFeatured().map(id => menu.find(m => m.id === id)).filter(Boolean);
  },
  _itemMargin(it) {
    const cost = App.menuItemCost(it);
    if (this.n(it && it.price) == null || this.n(cost) == null) return null;
    return it.price - cost;
  },

  // Why we feature this item: a tight one-liner from the Menu Rundown (class +
  // the sharpest fact), unique per item. Falls back to a margin line.
  _featureReason(it) {
    if (window.S && S.RevenueMenuPlanning && typeof S.RevenueMenuPlanning.shortReadFor === 'function') {
      const line = S.RevenueMenuPlanning.shortReadFor(it);
      if (line) return line;
    }
    const myM = this._itemMargin(it);
    return myM != null ? 'Strong ' + App.fmtCurrency(myM) + ' margin.' : 'Feature it.';
  },

  checkTarget() {
    const t = (App.data && App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    return this.n(t.check_avg);
  },

  // The day's cover forecast for today's week: the saved override if set, else
  // Bar Cop's computed baseline (App.effectiveForecast), read per weekday.
  coversToday() {
    if (!App.effectiveForecast) return null;
    const fc = App.effectiveForecast(App.todayLocal());
    if (!fc || !fc.covers_per_day) return null;
    const d = new Date(App.todayLocal() + 'T00:00:00');
    const wd = (d.getDay() + 6) % 7;                       // Mon=0
    const abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][wd];
    return fc.covers_per_day[abbr] != null ? fc.covers_per_day[abbr] : null;
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  draw() {
    const periods = this._ensurePeriod();
    const tgt = this.checkTarget();
    const covers = this.coversToday();
    const featured = this.featuredItems();
    const held = this._record();
    const dateLabel = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const stat = (label, val, sub) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg">' + val + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';

    // Row above the combined card: service-period chips on the left (only when
    // the operator runs more than one period), Export Briefing on the right.
    const topRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      +   (periods.length > 1 ? App.filterChips(this._period, periods.map(p => ({ v: p, label: p })), 'pb-period-chip') : '')
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="pb-export">Export Briefing</button>'
      + '</div>';

    const featRows = featured.length
      ? featured.map((it, idx) => {
          const m = this._itemMargin(it);
          const mHtml = m != null
            ? '<span style="color:var(--gold);font-weight:700;">' + App.fmtCurrency(m) + '</span>'
            : '<span style="color:var(--t4);">&mdash;</span>';
          return '<tr>'
            + '<td data-label="Item"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;color:var(--t1);">' + esc(it.name || 'Item') + '</div></td>'
            + '<td data-label="Margin">' + mHtml + '</td>'
            + '<td data-label="Talking Point"><input class="pb-pitch" data-id="' + esc(it.id) + '" value="' + esc(it.server_pitch || '') + '" placeholder="How should servers pitch it?" maxlength="90" style="width:100%;background:var(--input);border:1px solid var(--b-edge);border-radius:6px;color:var(--t1);font-size:12px;padding:6px 9px;outline:none;"/></td>'
            + '<td class="no-print" data-label=""><div class="row-actions">'
            +   '<button class="btn btn-ghost btn-sm pb-swap" data-idx="' + idx + '">Swap</button>'
            +   '<button class="btn btn-ghost btn-sm pb-fremove" data-idx="' + idx + '">Remove</button>'
            + '</div></td></tr>';
        }).join('')
      : '<tr><td colspan="4" style="color:var(--t3);text-align:center;padding:14px;">No items featured. Add one below, or cost and price your menu in Menu Engineering and your best margins pre-fill here.</td></tr>';
    const featTable = '<table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:24%"/><col style="width:12%"/><col style="width:44%"/><col/></colgroup>'
      + '<thead><tr><th>Featured Items</th><th>Margin</th><th>Talking Point</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + featRows + '</tbody></table>';

    const featActions = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">'
      + '<button class="btn btn-ghost btn-sm" id="pb-fadd">+ Add Item</button>'
      + '<button class="btn btn-ghost btn-sm" id="pb-freset">Reset to Recommended</button>'
      + '</div>';

    // Date + held status, compact, next to the Today's Focus heading.
    const statusLine = '<span style="font-size:11px;color:var(--t3);">&middot; ' + esc(dateLabel) + '</span>'
      + (held ? '<span style="font-size:11px;color:var(--green);font-weight:700;">&middot; Briefing held</span>' : '');

    // Combined card: Today's Focus (label + status + entry) over the Featured Items
    // list. The list is a row-list table so its column header carries the divider
    // (like the Briefing History card), the Margin is its own column, and the row
    // action buttons take the standard pill-row size.
    const combinedCard = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px;"><div class="sh" style="margin:0;">' + esc(this._period) + ' Focus</div>' + statusLine + '</div>'
      + '<div class="f" style="margin-bottom:20px;"><textarea class="form-input" id="pb-focus" rows="2" placeholder="One thing to hit this shift: a slow daypart, a new dish, a dessert push...">' + esc(this._curFocus() || '') + '</textarea></div>'
      + featTable + featActions
      + '</div>';

    const upsellBlock = this._editUpsell ? this._upsellEditorHtml() : this._upsellStaticHtml();

    this.container.innerHTML = '<div class="screen">'
      // Live stat strip (top)
      + '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap;">'
      +   stat('Check Average Target', tgt != null ? App.fmtCurrency(tgt) : '-', 'your target this service')
      +   stat('Covers Forecast', covers != null ? String(covers) : '-', covers != null ? 'expected today' : 'set a forecast in Build Schedule')
      +   stat('Items Featured', String(featured.length), 'push these')
      + '</div></div>'
      + topRow
      + combinedCard
      + upsellBlock
      // Actions
      + '<div style="display:flex;align-items:center;gap:12px;margin:0 0 20px;">'
      +   '<button class="btn btn-primary" id="pb-held">' + (held ? 'Update Briefing' : 'Mark Briefing Held') + '</button>'
      +   '<span id="pb-status" style="font-size:12px;color:var(--green);display:none;"></span>'
      + '</div>'
      + this.historyHtml()
      + '</div>';

    this.wire();
  },

  // Circle step number, styled like the Workflow map's node numbers.
  _stepNum(i) {
    return '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--b-edge);color:var(--t3);font-size:11px;font-weight:700;line-height:1;">' + (i + 1) + '</span>';
  },

  _upsellStaticHtml() {
    const seq = this.upsellSeq();
    const seqHtml = seq.map((u, i) => '<div style="display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--b2);">'
      + this._stepNum(i)
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(u.title) + '</div>'
      + (u.desc ? '<div style="font-size:12px;color:var(--t2);line-height:1.5;margin-top:2px;">' + esc(u.desc) + '</div>' : '') + '</div></div>').join('');
    return '<div class="sh" style="margin:20px 0 10px;">The Upsell Sequence</div>'
      + '<div class="card">' + seqHtml
      +   '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="pb-up-customize">Customize</button></div>'
      + '</div>';
  },

  _upsellEditorHtml() {
    const rows = this._upsellDraft.map((u, idx) =>
      '<div class="pb-up-line" data-id="' + idx + '" data-idx="' + idx + '" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">'
      + DragReorder.handleDivHTML()
      + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">'
      +   '<input type="text" class="form-input pb-up-title" value="' + esc(u.title) + '" placeholder="Step title"/>'
      +   '<input type="text" class="form-input pb-up-desc" value="' + esc(u.desc) + '" placeholder="What to do or say"/>'
      + '</div>'
      + '<button type="button" class="btn btn-danger btn-sm pb-up-remove" data-idx="' + idx + '">Remove</button>'
      + '</div>').join('');
    const body = this._upsellDraft.length ? rows
      : '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">No steps yet. Add one below.</div>';
    return '<div class="sh" style="margin:20px 0 10px;">The Upsell Sequence</div>'
      + '<div class="card form-card">'
      +   '<div id="pb-up-items">' + body + '</div>'
      +   '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">'
      +     '<button class="btn btn-ghost btn-sm" id="pb-up-add">+ Add Step</button>'
      +     '<button class="btn btn-primary btn-sm" id="pb-up-save">Save Sequence</button>'
      +   '</div>'
      + '</div>';
  },

  historyHtml() {
    const all = this.briefings().slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.period || '').localeCompare(b.period || ''));
    if (!all.length) return '';
    const rows = all.slice(0, App.listLimit('sc', 'briefing')).map(b => '<tr>'
      + '<td>' + (b.date || '') + '</td>'
      + '<td>' + esc(b.period || '') + '</td>'
      + '<td style="color:var(--t2);">' + esc((b.focus || '').slice(0, 70)) + '</td>'
      + '<td class="no-print"><div class="row-actions"><button class="btn btn-danger btn-sm pb-hist-del" data-id="' + esc(b.id) + '">Delete</button></div></td>'
      + '</tr>').join('');
    return '<div class="sh" style="margin:24px 0 10px;">Briefing History</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:18%;"><col style="width:18%;"><col style="width:44%;"><col style="width:20%;"></colgroup>'
      + '<thead><tr><th>Date</th><th>Period</th><th>Briefing Focus</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('sc', 'briefing', all, false);
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    const c = this.container;
    c.querySelectorAll('.pb-period-chip').forEach(b => b.addEventListener('click', () => { this._period = b.dataset.v; this.draw(); }));

    const focusEl = c.querySelector('#pb-focus');
    if (focusEl) focusEl.addEventListener('input', e => { this._focusBy[this._period] = e.target.value; });
    c.querySelector('#pb-export')?.addEventListener('click', () => this.print());
    c.querySelector('#pb-held')?.addEventListener('click', () => this.markHeld());

    // Featured controls
    c.querySelector('#pb-fadd')?.addEventListener('click', () => this._openPicker('add', -1));
    c.querySelector('#pb-freset')?.addEventListener('click', () => { this._featuredBy[this._period] = this._recommendedFor(this._period).map(s => s.id); this.draw(); });
    // Talking point saves ONTO the menu item, so it comes back every time the
    // item is featured, any shift.
    c.querySelectorAll('.pb-pitch').forEach(inp => inp.addEventListener('change', () => {
      const item = ((App.data && App.data.menu_items) || []).find(m => m.id === inp.dataset.id);
      if (item) { item.server_pitch = inp.value.trim(); App.putRecord('core', 'menu_item', item); }
    }));
    c.querySelectorAll('.pb-swap').forEach(b => b.addEventListener('click', () => this._openPicker('swap', parseInt(b.dataset.idx, 10))));
    c.querySelectorAll('.pb-fremove').forEach(b => b.addEventListener('click', () => {
      this._curFeatured().splice(parseInt(b.dataset.idx, 10), 1);
      this.draw();
    }));

    // Upsell: static → customize; editor → add/remove/drag/save (no cancel)
    c.querySelector('#pb-up-customize')?.addEventListener('click', () => {
      this._editUpsell = true;
      this._upsellDraft = this.upsellSeq().map(u => ({ title: u.title, desc: u.desc }));
      this.draw();
    });
    c.querySelector('#pb-up-save')?.addEventListener('click', () => this.saveUpsell());
    c.querySelector('#pb-up-add')?.addEventListener('click', () => { this._syncUpsell(); this._upsellDraft.push({ title: '', desc: '' }); this.draw(); });
    const upHost = c.querySelector('#pb-up-items');
    if (upHost) {
      upHost.addEventListener('input', () => this._syncUpsell());
      upHost.addEventListener('click', ev => {
        const rm = ev.target.closest('.pb-up-remove');
        if (!rm) return;
        this._syncUpsell();
        // Index by live DOM position, not a stale data-idx (a drag reorders the
        // rows without a re-render).
        const row = rm.closest('.pb-up-line');
        const idx = [...this.container.querySelectorAll('.pb-up-line')].indexOf(row);
        if (idx > -1) this._upsellDraft.splice(idx, 1);
        this.draw();
      });
      // On drop: sync state from the reordered DOM. No re-render here — the rows
      // are already in their new order, and re-rendering mid-drop is what made the
      // drag stick instead of dropping on mouse release.
      DragReorder.wire({
        container: upHost, rowSelector: '.pb-up-line', handleSelector: '.dr-handle',
        onCommit: () => { this._syncUpsell(); }
      });
    }

    // History delete + show older
    c.querySelectorAll('.pb-hist-del').forEach(b => b.addEventListener('click', async () => {
      if (!(await App.confirmDelete('this briefing'))) return;
      await App.removeRecord('sc', 'briefing', b.dataset.id);
      this.draw();
    }));
    c.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.draw())));
  },

  _syncUpsell() {
    const rows = [...this.container.querySelectorAll('.pb-up-line')];
    if (rows.length) this._upsellDraft = rows.map(r => ({
      title: r.querySelector('.pb-up-title')?.value || '',
      desc: r.querySelector('.pb-up-desc')?.value || ''
    }));
  },

  async saveUpsell() {
    this._syncUpsell();
    const seq = (this._upsellDraft || []).map(u => ({ title: (u.title || '').trim(), desc: (u.desc || '').trim() })).filter(u => u.title);
    if (!App.shiftData) App.shiftData = {};
    App.shiftData.sc_upsell_sequence = seq;
    const ok = await App.saveShift();
    if (ok) { this._editUpsell = false; this._upsellDraft = null; this.draw(); }
  },

  // ── Featured item picker (menu list, grouped by category, searchable) ─────────
  _pickerListHtml(search) {
    const menu = ((App.data && App.data.menu_items) || []).filter(i => !i.archived);
    const q = (search || '').trim().toLowerCase();
    const filtered = q ? menu.filter(i => (i.name || '').toLowerCase().includes(q)) : menu;
    if (!filtered.length) return '<div style="padding:14px;color:var(--t3);font-size:12px;">No matching menu items.</div>';
    const cats = {};
    filtered.forEach(i => { const cat = i.category || 'Other'; (cats[cat] = cats[cat] || []).push(i); });
    return Object.keys(cats).sort().map(cat =>
      '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin:12px 0 4px;">' + esc(cat) + '</div>'
      + cats[cat].map(i => {
          const m = this._itemMargin(i);
          const mTxt = m != null ? App.fmtCurrency(m) + ' margin' : '';
          return '<div class="pb-pick-item" data-id="' + esc(i.id) + '" style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:9px 12px;background:#0D181E;border-radius:6px;margin-top:6px;cursor:pointer;">'
            + '<span style="font-size:13px;color:var(--t1);">' + esc(i.name || 'Item') + '</span>'
            + '<span style="font-size:11px;color:var(--gold);flex-shrink:0;">' + mTxt + '</span></div>';
        }).join('')
    ).join('');
  },

  _openPicker(mode, idx) {
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (mode === 'swap' ? 'Swap Featured Item' : 'Add Featured Item') + '</div>'
      + '<input type="text" id="pb-pick-search" class="form-input" placeholder="Search your menu..." style="margin-bottom:12px;"/>'
      + '<div id="pb-pick-list" style="max-height:340px;overflow-y:auto;">' + this._pickerListHtml('') + '</div>'
      + '</div>';
    App.openModal(html, { id: 'pb-pick-modal', maxWidth: 520 });
    const search = document.getElementById('pb-pick-search');
    search?.addEventListener('input', () => {
      const l = document.getElementById('pb-pick-list');
      if (l) l.innerHTML = this._pickerListHtml(search.value);
    });
    document.getElementById('pb-pick-list')?.addEventListener('click', ev => {
      const it = ev.target.closest('.pb-pick-item');
      if (!it) return;
      const ids = this._curFeatured();
      if (mode === 'swap' && idx >= 0) ids[idx] = it.dataset.id;
      else ids.push(it.dataset.id);
      App.closeModal('pb-pick-modal');
      this.draw();
    });
  },

  async markHeld() {
    const items = this.featuredItems();
    const date = App.todayLocal();
    const period = this._period;
    const existing = this._record();
    const rec = {
      id: (existing && existing.id) || App.uid(),
      date, period,
      focus: this._curFocus() || '',
      stars_count: items.length,
      featured: items.map(i => i.id),
      stars: items.map(i => i.name),
      check_target: this.checkTarget(),
      covers_forecast: this.coversToday(),
      held: true,
      created_at: (existing && existing.created_at) || new Date().toISOString()
    };
    const ok = await App.putRecord('sc', 'briefing', rec);
    if (ok) {
      const st = this.container.querySelector('#pb-status');
      if (st) { st.style.display = 'inline'; st.textContent = 'Logged ' + period + ' for ' + date + '.'; }
      this.draw();
    }
  },

  async print() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const items = this.featuredItems();
    const tgt = this.checkTarget();
    const covers = this.coversToday();
    const period = this._period;
    const dateLabel = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const b = App._pdfBuilder('Pre-Shift Briefing');
    b.header({ right: period + ' Pre-Shift Briefing', meta: dateLabel });
    b.kv('Service period', period);
    b.kv('Check average target', tgt != null ? App.fmtCurrency(tgt) : 'Not set');
    b.kv('Covers forecast', covers != null ? String(covers) : 'Not set');
    if (this._curFocus()) { b.spacer(2); b.sectionTitle(period + ' Focus'); b.spacer(4); b.paragraph(this._curFocus(), { gray: 40 }); }
    b.sectionTitle('Featured Items'); b.spacer(4);
    if (items.length) b.table(['Item', 'Margin', 'Talking Point'], items.map(i => { const m = this._itemMargin(i); return [i.name || 'Item', m != null ? App.fmtCurrency(m) : '-', i.server_pitch || '']; }), { columnStyles: { 0: { cellWidth: 135 }, 1: { cellWidth: 55, halign: 'left' }, 2: { cellWidth: 'auto' } } });
    else b.paragraph('No items featured. Cost and price your menu in Menu Engineering to feature your best margins.', { gray: 70 });
    b.sectionTitle('The Upsell Sequence'); b.spacer(4);
    this.upsellSeq().forEach((u, i) => b.paragraph((i + 1) + '. ' + u.title + (u.desc ? '. ' + u.desc : ''), { gray: 45 }));
    const venue = (App.data && App.data.settings && App.data.settings.bar_name) || 'Bar Cop';
    await b.save(venue + ' - Pre-Shift Briefing - ' + period + ' - ' + App.todayLocal() + '.pdf');
  },

  showHowTo() {
    App.showHelpModal('How the Pre-Shift Briefing Works', [
      { p: ['The Pre-Shift Briefing is the line-up sheet, read to the floor before doors. It is per service period: pick the period at the top and Bar Cop builds a briefing for it, so a bar that runs lunch and dinner holds a separate pre-lunch and pre-dinner line-up the same day. If you run one service, you will not see the period picker. Read it at line-up, or tap Export Briefing for a paper copy.'] },
      { h: 'What Bar Cop fills in', p: ['The check-average target is your Revenue target. The cover forecast is Bar Cop\'s projection for today, the same one that feeds Build Schedule. The Featured Items list pre-fills with your best-margin sellers, weighted to the daypart you are briefing: lighter plates and apps at lunch, the big entrees and a cocktail at dinner, drinks and apps late night. It reads that off each item\'s category and price, so it is a smart starting point, not a rule. Swap or remove any that do not fit, add your own from the menu, or reset back to the recommendations. Give each one a Talking Point, one short line telling servers how to sell it, and it saves to that item so it comes back every time you feature it. You add one line of focus for the shift.'] },
      { h: 'Customize the upsell sequence', p: ['Tap Customize at the bottom of the upsell sequence to write your own steps, drag them into the order you want, and Save. Your version is used from then on, on screen and on the export, and applies to every briefing until you change it again.'] },
      { h: 'Run it and log it', p: ['Tap Mark Briefing Held to log that you ran it for the selected period. Logging is optional: it counts toward your Bar Cop Audit operational discipline once you start using it, and never counts against you if you do not. Briefing History keeps a record per period; delete any entry logged by mistake.'] }
    ]);
  }
};
