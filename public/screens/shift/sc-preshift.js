'use strict';

/* ── Shift Control — Pre-Shift Briefing ───────────────────────────────────────
   The before-doors line-up tool, next to Run Checklists. Bar Cop builds the
   briefing from live data so the manager reads it instead of filling a blank
   sheet: the check-average target, the cover forecast, a featured-items list
   pre-filled with your best-margin sellers (swap or remove any that do not fit
   this service), and your upsell sequence (customizable on-page). The manager
   adds a focus line, reads it at line-up or exports it, and taps Held to log it.
   Logging is OPT-IN: it feeds the Bar Cop Audit's operational discipline only
   once you use it, and never dings a bar that does not. Held records live in
   the sc_briefings event store; the customized upsell sequence lives in the
   sc_upsell_sequence config blob. Service-period neutral (no "tonight"): the
   same briefing works for breakfast, lunch, happy hour, or dinner. */

S.ShiftPreShift = {

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
    if (this._focus == null) this._focus = (this._todayRecord() || {}).focus || '';
    this.draw();
  },

  briefings() { return (App.shiftData && App.shiftData.sc_briefings) || []; },
  _todayRecord() { const t = App.todayLocal(); return this.briefings().find(b => (b.date || '') === t) || null; },
  n(v) { return (v == null || isNaN(v)) ? null : Number(v); },

  // ── The upsell sequence (customizable) ──────────────────────────────────────
  upsellSeq() {
    const s = App.shiftData && App.shiftData.sc_upsell_sequence;
    if (Array.isArray(s) && s.length) return s.map(u => ({ title: u.title || '', desc: u.desc || '' }));
    return this.UPSELL.map(u => ({ title: u[0], desc: u[1] }));
  },

  // ── Featured items (pre-filled with recommended Stars, manager-adjustable) ───
  // Recommended: high margin AND high volume vs the whole menu.
  todayStars() {
    const items = ((App.data && App.data.menu_items) || [])
      .filter(i => !i.archived && this.n(i.price) != null && this.n(i.cost) != null && this.n(i.weekly_covers) != null && i.weekly_covers > 0);
    if (items.length < 4) return [];
    const cm = arr => arr.reduce((s, i) => s + (i.price - i.cost), 0) / arr.length;
    const cv = arr => arr.reduce((s, i) => s + (i.weekly_covers || 0), 0) / arr.length;
    const avgCM = cm(items), avgCov = cv(items);
    return items.filter(i => (i.price - i.cost) >= avgCM && i.weekly_covers >= avgCov)
      .sort((a, b) => (b.price - b.cost) - (a.price - a.cost))
      .slice(0, 5);
  },
  _initFeatured() {
    const rec = this._todayRecord();
    this._featured = (rec && Array.isArray(rec.featured))
      ? rec.featured.slice()
      : this.todayStars().map(s => s.id);
  },
  featuredItems() {
    if (this._featured == null) this._initFeatured();
    const menu = (App.data && App.data.menu_items) || [];
    return this._featured.map(id => menu.find(m => m.id === id)).filter(Boolean);
  },
  _itemMargin(it) {
    const cost = App.menuItemCost(it);
    if (this.n(it && it.price) == null || this.n(cost) == null) return null;
    return it.price - cost;
  },

  checkTarget() {
    const t = (App.data && App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    return this.n(t.check_avg);
  },

  // The cover forecast for today from the week's revenue forecast (covers_per_day).
  coversToday() {
    const fc = (App.data && App.data.revenue_forecasts) || [];
    if (!fc.length) return null;
    const d = new Date(App.todayLocal() + 'T00:00:00');
    const wd = (d.getDay() + 6) % 7;                       // Mon=0
    const mon = new Date(d); mon.setDate(d.getDate() - wd);
    const monStr = App.ymdLocal(mon);
    const abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][wd];
    const rec = fc.find(f => f.week_start === monStr) || fc.slice().sort((a, b) => (b.week_start || '').localeCompare(a.week_start || ''))[0];
    const cpd = rec && rec.covers_per_day;
    return (cpd && cpd[abbr] != null) ? cpd[abbr] : null;
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  draw() {
    const tgt = this.checkTarget();
    const covers = this.coversToday();
    const featured = this.featuredItems();
    const held = this._todayRecord();
    const dateLabel = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const stat = (label, val, sub) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg">' + val + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';

    const featHtml = featured.length
      ? featured.map((it, idx) => {
          const m = this._itemMargin(it);
          const mHtml = m != null
            ? '<div style="flex-shrink:0;font-size:12px;color:var(--gold);font-weight:700;">' + App.fmtCurrency(m) + ' margin</div>'
            : '<div style="flex-shrink:0;font-size:12px;color:var(--t4);">&mdash;</div>';
          return '<div style="display:flex;align-items:center;gap:12px;padding:9px 14px;background:#0D181E;border-radius:6px;margin-top:6px;">'
            + '<div style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.name || 'Item') + '</div>'
            + mHtml
            + '<button class="btn btn-ghost btn-sm pb-swap" data-idx="' + idx + '">Swap</button>'
            + '<button class="btn btn-ghost btn-sm pb-fremove" data-idx="' + idx + '" title="Remove">&times;</button>'
            + '</div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3);padding:10px 14px;background:#0D181E;border-radius:6px;margin-top:6px;">No items featured. Add one below, or cost and price your menu in Menu Engineering and your best margins pre-fill here.</div>';

    const featActions = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">'
      + '<button class="btn btn-ghost btn-sm" id="pb-fadd">+ Add Item</button>'
      + '<button class="btn btn-ghost btn-sm" id="pb-freset">Reset to Recommended</button>'
      + '</div>';

    const upsellBlock = this._editUpsell ? this._upsellEditorHtml() : this._upsellStaticHtml();

    this.container.innerHTML = '<div class="screen">'
      // Date + held status (thin line; the old header card is gone, its intro is in the "i" help)
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">' + esc(dateLabel)
      +   (held ? '  &middot;  <span style="color:var(--green);font-weight:700;">Briefing held</span>' : '') + '</div>'
      // Live stat strip (top)
      + '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap;">'
      +   stat('Check Average Target', tgt != null ? App.fmtCurrency(tgt) : '-', 'your target this service')
      +   stat('Covers Forecast', covers != null ? String(covers) : '-', covers != null ? 'expected today' : 'set a forecast in Build Schedule')
      +   stat('Items Featured', String(featured.length), 'push these')
      + '</div></div>'
      // Today's focus (heading row carries the Export button)
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 10px;">'
      +   '<div class="sh" style="margin:0;">Today\'s Focus</div>'
      +   '<button class="btn btn-ghost btn-sm" id="pb-export">Export Briefing</button>'
      + '</div>'
      + '<div class="card form-card" style="margin-bottom:16px;">'
      +   '<div class="f"><textarea class="form-input" id="pb-focus" rows="2" placeholder="One thing to hit this shift: a slow daypart, a new dish, a dessert push...">' + esc(this._focus || '') + '</textarea></div>'
      + '</div>'
      // Featured items
      + '<div class="sh" style="margin:20px 0 10px;">Featured Items</div>'
      + '<div class="card" style="margin-bottom:16px;">'
      +   '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:2px;">Bar Cop recommends your best-margin sellers. Swap or remove any that do not fit this service.</div>'
      +   featHtml + featActions
      + '</div>'
      // Upsell sequence (static list or on-page editor)
      + upsellBlock
      // Actions
      + '<div style="display:flex;align-items:center;gap:12px;margin:0 0 20px;">'
      +   '<button class="btn btn-primary" id="pb-held">' + (held ? 'Update Today\'s Briefing' : 'Mark Briefing Held') + '</button>'
      +   '<span id="pb-status" style="font-size:12px;color:var(--green);display:none;"></span>'
      + '</div>'
      // History
      + this.historyHtml()
      + '</div>';

    this.wire();
  },

  _upsellStaticHtml() {
    const seq = this.upsellSeq();
    const seqHtml = seq.map((u, i) => '<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:20px;flex-shrink:0;">' + (i + 1) + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(u.title) + '</div>'
      + (u.desc ? '<div style="font-size:12px;color:var(--t2);line-height:1.5;margin-top:2px;">' + esc(u.desc) + '</div>' : '') + '</div></div>').join('');
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 10px;">'
      +   '<div class="sh" style="margin:0;">The Upsell Sequence</div>'
      +   '<button class="btn btn-ghost btn-sm" id="pb-up-customize">Customize</button>'
      + '</div>'
      + '<div class="card" style="margin-bottom:16px;">' + seqHtml + '</div>';
  },

  _upsellEditorHtml() {
    const rows = this._upsellDraft.map((u, idx) =>
      '<div class="pb-up-line" data-idx="' + idx + '" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">'
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
      + '<div class="card form-card" style="margin-bottom:0;">'
      +   '<div id="pb-up-items">' + body + '</div>'
      +   '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="pb-up-add">+ Add Step</button></div>'
      + '</div>'
      + '<div style="margin:14px 0 24px;display:flex;align-items:center;gap:8px;">'
      +   '<button class="btn btn-primary" id="pb-up-save">Save Sequence</button>'
      +   '<button class="btn btn-ghost" id="pb-up-cancel">Cancel</button>'
      + '</div>';
  },

  historyHtml() {
    const all = this.briefings().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!all.length) return '';
    const rows = all.slice(0, App.listLimit('sc', 'briefing')).map(b => '<tr>'
      + '<td>' + (b.date || '') + '</td>'
      + '<td>' + (b.stars_count != null ? b.stars_count + ' featured' : '') + '</td>'
      + '<td style="color:var(--t2);">' + esc((b.focus || '').slice(0, 70)) + '</td>'
      + '<td class="no-print"><div class="row-actions"><button class="btn btn-danger btn-sm pb-hist-del" data-id="' + esc(b.id) + '">Delete</button></div></td>'
      + '</tr>').join('');
    return '<div class="sh" style="margin:24px 0 10px;">Briefing History</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:20%;"><col style="width:16%;"><col style="width:44%;"><col style="width:20%;"></colgroup>'
      + '<thead><tr><th>Date</th><th>Featured</th><th>Focus</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('sc', 'briefing', all, false);
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    const c = this.container;
    const focusEl = c.querySelector('#pb-focus');
    if (focusEl) focusEl.addEventListener('input', e => { this._focus = e.target.value; });
    c.querySelector('#pb-export')?.addEventListener('click', () => this.print());
    c.querySelector('#pb-held')?.addEventListener('click', () => this.markHeld());

    // Featured controls
    c.querySelector('#pb-fadd')?.addEventListener('click', () => this._openPicker('add', -1));
    c.querySelector('#pb-freset')?.addEventListener('click', () => { this._featured = this.todayStars().map(s => s.id); this.draw(); });
    c.querySelectorAll('.pb-swap').forEach(b => b.addEventListener('click', () => this._openPicker('swap', parseInt(b.dataset.idx, 10))));
    c.querySelectorAll('.pb-fremove').forEach(b => b.addEventListener('click', () => {
      if (this._featured == null) this._initFeatured();
      this._featured.splice(parseInt(b.dataset.idx, 10), 1);
      this.draw();
    }));

    // Upsell: static → customize; editor → add/remove/drag/save/cancel
    c.querySelector('#pb-up-customize')?.addEventListener('click', () => {
      this._editUpsell = true;
      this._upsellDraft = this.upsellSeq().map(u => ({ title: u.title, desc: u.desc }));
      this.draw();
    });
    c.querySelector('#pb-up-cancel')?.addEventListener('click', () => { this._editUpsell = false; this._upsellDraft = null; this.draw(); });
    c.querySelector('#pb-up-save')?.addEventListener('click', () => this.saveUpsell());
    c.querySelector('#pb-up-add')?.addEventListener('click', () => { this._syncUpsell(); this._upsellDraft.push({ title: '', desc: '' }); this.draw(); });
    const upHost = c.querySelector('#pb-up-items');
    if (upHost) {
      upHost.addEventListener('input', () => this._syncUpsell());
      upHost.addEventListener('click', ev => {
        const rm = ev.target.closest('.pb-up-remove');
        if (!rm) return;
        this._syncUpsell();
        this._upsellDraft.splice(parseInt(rm.dataset.idx, 10), 1);
        this.draw();
      });
      DragReorder.wire({
        container: upHost, rowSelector: '.pb-up-line', handleSelector: '.dr-handle',
        onCommit: () => { this._syncUpsell(); this.draw(); }
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
          return '<div class="pb-pick-item" data-id="' + esc(i.id) + '" style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 10px;border-radius:6px;cursor:pointer;">'
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
      if (this._featured == null) this._initFeatured();
      if (mode === 'swap' && idx >= 0) this._featured[idx] = it.dataset.id;
      else this._featured.push(it.dataset.id);
      App.closeModal('pb-pick-modal');
      this.draw();
    });
  },

  async markHeld() {
    const items = this.featuredItems();
    const date = App.todayLocal();
    const existing = this._todayRecord();
    const rec = {
      id: (existing && existing.id) || App.uid(),
      date,
      focus: this._focus || '',
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
      if (st) { st.style.display = 'inline'; st.textContent = 'Logged for ' + date + '.'; }
      this.draw();
    }
  },

  async print() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const items = this.featuredItems();
    const tgt = this.checkTarget();
    const covers = this.coversToday();
    const dateLabel = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const b = App._pdfBuilder('Pre-Shift Briefing');
    b.header({ right: 'Pre-Shift Briefing', meta: dateLabel });
    b.kv('Check average target', tgt != null ? App.fmtCurrency(tgt) : 'Not set');
    b.kv('Covers forecast', covers != null ? String(covers) : 'Not set');
    if (this._focus) { b.spacer(2); b.sectionTitle('Today\'s Focus'); b.spacer(4); b.paragraph(this._focus, { gray: 40 }); }
    b.sectionTitle('Featured Items'); b.spacer(4);
    if (items.length) b.table(['Item', 'Margin'], items.map(i => { const m = this._itemMargin(i); return [i.name || 'Item', m != null ? App.fmtCurrency(m) : '-']; }), { columnStyles: { 1: { cellWidth: 90, halign: 'right' } } });
    else b.paragraph('No items featured. Cost and price your menu in Menu Engineering to feature your best margins.', { gray: 70 });
    b.sectionTitle('The Upsell Sequence'); b.spacer(4);
    this.upsellSeq().forEach((u, i) => b.paragraph((i + 1) + '. ' + u.title + (u.desc ? '. ' + u.desc : ''), { gray: 45 }));
    const venue = (App.data && App.data.settings && App.data.settings.bar_name) || 'Bar Cop';
    await b.save(venue + ' - Pre-Shift Briefing - ' + App.todayLocal() + '.pdf');
  },

  showHowTo() {
    App.showHelpModal('How the Pre-Shift Briefing Works', [
      { p: ['The Pre-Shift Briefing is the line-up sheet, read to the floor before doors. Bar Cop builds it from your live numbers so it is current every shift, with nothing to fill in from scratch. Read it at line-up, or tap Export Briefing for a paper copy. It works for any service: breakfast, lunch, happy hour, or dinner.'] },
      { h: 'What Bar Cop fills in', p: ['The check-average target is your Revenue target. The cover forecast comes from Build Schedule. The Featured Items list pre-fills with your best-margin, high-volume sellers from Menu Engineering. Swap or remove any that do not fit this service, or reset back to the recommendations. You add one line of focus for the shift.'] },
      { h: 'Customize the upsell sequence', p: ['Tap Customize on the upsell sequence to write your own steps, drag them into the order you want, and save. Your version is used from then on, on screen and on the export, and applies to every briefing until you change it again.'] },
      { h: 'Run it and log it', p: ['Tap Mark Briefing Held to log that you ran it. Logging is optional: it counts toward your Bar Cop Audit operational discipline once you start using it, and never counts against you if you do not. Briefing History keeps a record; delete any entry logged by mistake.'] }
    ]);
  }
};
