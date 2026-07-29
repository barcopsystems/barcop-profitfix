'use strict';

/* ── Shift Control — Checklist Templates (writes sc_checklist_templates) ───────
   Builds reusable Opening and Closing checklist templates (the Checklists screen
   loads these; when none exist it falls back to the built-in defaults), plus
   free-named Print Only checklists for any station (Bar Close, Kitchen Open, ...)
   that only export to a printable PDF for the clipboard and never run in the app.
   Inline form on the landing, saved lists below, edit on its own page. */

S.ShiftChecklistTemplates = {
  editId: null,
  _name: '',
  _type: 'Opening',
  _items: [],
  TYPES: ['Opening', 'Closing'],

  templates() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_checklist_templates)) App.shiftData.sc_checklist_templates = [];
    return App.shiftData.sc_checklist_templates;
  },
  defaultItems(type) {
    if (type === 'Closing') return (S.ShiftClosingChecklist && S.ShiftClosingChecklist.DEFAULT_ITEMS) || [];
    return (S.ShiftOpeningChecklist && S.ShiftOpeningChecklist.DEFAULT_ITEMS) || [];
  },

  // ── Starter checklists ──────────────────────────────────────────────────────
  // A fresh account should not land on an empty page. Seed a ready-to-use set the
  // operator can run, print, edit, or delete. Fires once per account (flagged), so
  // a deleted starter never comes back and an account that already has checklists
  // (the demo, or a returning user) is left untouched.
  STAFF_STARTERS: [
    { name: 'Bar Open', items: [
      'Unlock and stock the well: liquor, mixers, juices, garnishes', 'Fill ice wells and check the ice machine',
      'Cut fruit and prep garnishes', 'Brew coffee and stock tea', 'Check draft lines pouring clean, no foam',
      'Wipe down bar top, rail, and speed racks', 'Stock napkins, straws, picks, and coasters',
      'Count and set the bar drawer', 'Check glassware stocked and polished', 'Note any 86d bottles or low stock' ] },
    { name: 'Bar Close', items: [
      'Last call and close all open tabs', 'Break down and clean the well, no bottles left out',
      'Empty, rinse, and refill ice wells', 'Wash and dry all glassware and bar tools',
      'Wipe down bar top, rail, speed racks, and stools', 'Restock liquor, beer, and mixers to par for open',
      'Rinse soda guns and pour drains', 'Cover garnish tray and store cut fruit',
      'Pull mats and hose or mop the bar floor', 'Drop the drawer and record over or short',
      'Turn off TVs, music, and signage; lock liquor storage' ] },
    { name: 'Kitchen Open', items: [
      'Turn on the line: grill, fryers, flat top, ovens', 'Check walk-in and reach-in temps and log them',
      'Pull and date prep from the walk-in', 'Stock the line: proteins, sauces, garnishes',
      'Fill and heat sanitizer buckets, set test strips', 'Check fryer oil, filter or change if needed',
      'Stock paper, gloves, and to-go containers', 'Turn on the dish machine, check wash and rinse temps',
      'Review the 86 list and prep list with the team', 'Set up handwashing stations' ] },
    { name: 'Kitchen Close', items: [
      'Break down and clean the line, wrap and date all product', 'Turn off and clean grill, fryers, flat top, ovens',
      'Filter or change fryer oil per schedule', 'Log final walk-in and reach-in temps',
      'Run and break down the dish machine, clean filters', 'Empty and sanitize trash, take out to the dumpster',
      'Sweep and mop the kitchen and dish floors', 'Clean and sanitize prep surfaces and cutting boards',
      'Restock paper, gloves, and containers for open', 'Update the prep list for tomorrow',
      'Turn off hood, lights, and equipment; lock the walk-in' ] },
    { name: 'Server Open', items: [
      'Clock in and check the floor plan and your section', 'Set and wipe tables: silverware, napkins, condiments',
      'Stock your station: napkins, straws, to-go boxes', 'Fill water pitchers and stock ice',
      'Brew coffee and iced tea', 'Check specials, the 86 list, and any menu changes',
      'Roll silverware to par', 'Wipe down menus and check for damage',
      'Confirm your POS login and printer', 'Check restrooms stocked and clean' ] },
    { name: 'Server Close', items: [
      'Close out all tabs and run your checkout report', 'Wipe down and reset every table in your section',
      'Restock station: napkins, straws, condiments, to-go', 'Roll silverware to par for open',
      'Refill salt, pepper, and condiment caddies', 'Wipe down menus and stack them neatly',
      'Empty and wipe down your station and trash', 'Sweep your section and push in chairs',
      'Complete your tip-out and record it', 'Check with the manager before you leave' ] },
    { name: 'Floor Open', items: [
      'Unlock front doors and turn on the open sign', 'Set lights, music, and TVs to open levels',
      'Set the host stand: menus, seating chart, pens', 'Wipe down front door glass and entry',
      'Check dining room tables clean, level, and set', 'Confirm reservations and note large parties',
      'Check restrooms stocked, clean, and dry', 'Straighten the waiting area and stock to-go menus',
      'Set the thermostat to service temperature', 'Walk the floor for anything broken or out of place' ] },
    { name: 'Floor Close', items: [
      'Lock front doors after the last guest, flip the sign', 'Reset the dining room: tables, chairs, booths',
      'Wipe down host stand, menus, and entry glass', 'Straighten and stock the waiting area',
      'Check restrooms cleaned and restocked', 'Turn down or off lights, music, and TVs',
      'Empty front-of-house trash', 'Sweep and spot-mop the entry and dining room',
      'Set the thermostat to overnight', 'Final walk: windows, doors, and the back exit locked' ] }
  ],
  // async now (it awaits the row write before flagging the account seeded). Callers may still
  // fire-and-forget: the in-memory push below happens synchronously, so a render right after
  // this call still sees the starters.
  // `token` is the App._mountSeq captured by render() — see lc-positions.ensureStarters. The failed-
  // seed repaint is guarded on it so a late failure never paints this screen over the next one.
  async ensureStarters(token) {
    if (!App.shiftData) App.shiftData = {};
    if (App.shiftData.sc_starter_seeded) return;
    const list = this.templates();
    if (list.length > 0) { App.shiftData.sc_starter_seeded = true; return; }   // already has checklists
    const mk = (name, type, items) => ({ id: App.uid(), name, type, items: (items || []).slice() });
    const seeded = [];
    seeded.push(mk('Manager Opening', 'Opening', (S.ShiftOpeningChecklist && S.ShiftOpeningChecklist.DEFAULT_ITEMS) || []));
    seeded.push(mk('Manager Closing', 'Closing', (S.ShiftClosingChecklist && S.ShiftClosingChecklist.DEFAULT_ITEMS) || []));
    this.STAFF_STARTERS.forEach(s => seeded.push(mk(s.name, 'Print', s.items)));
    // S179: the whole seed loop would otherwise share ONE new Date().toISOString(), and App.byCreation
    // ties on an identical created_at -> the starter list renders in reverse-authored order after a
    // reload. Stamp each row one step apart so the authored order (Manager Opening ... Floor Close) is
    // recoverable by created_at.
    const seededAt = Date.now();
    seeded.forEach((t, i) => { t.created_at = new Date(seededAt + i).toISOString(); list.push(t); });
    // Persist the ROWS first and only set the "already seeded" flag if they landed. Setting the
    // flag first (and not awaiting the write) meant a failed bulk write left the flag durably
    // true, the array stripped from the blob, and no rows — so Checklist Templates stayed
    // permanently empty and could never re-seed.
    const ok = await App.putRecordsBulk('sc', 'checklist_template', seeded, { quiet: true });   // fires from render(), never shout
    if (!ok) {
      // render() painted these synchronously; the quiet write failed, so splice them out AND
      // re-render — but only if this is still the current screen (app.js:1428).
      seeded.forEach(t => { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); });
      if (token != null && App._mountSeq === token) this.renderList();
      return;
    }
    App.shiftData.sc_starter_seeded = true;
    await App.saveShift();                                       // the sc_starter_seeded flag stays in the blob
  },

  render(container, actions) {
    this.ensureStarters(App._mountSeq);   // pass the mount token — a failed seed only repaints if still current
    this.container = container;
    this.actions = actions;
    if (this.actions) this.actions.innerHTML = '';
    if (this._type == null) this._type = 'Opening';
    // Keep an in-progress template across navigation; only Save, Cancel, or Start Over resets it.
    if (this.editId) this.renderForm();
    else this.renderList();
  },

  _resetForm() {
    this.editId = null;
    this._name = '';
    this._items = [];
    if (this._type == null) this._type = 'Opening';
  },

  showHowTo() {
    App.showHelpModal('How to Build Checklists', [
      { p: ['Build Checklists is where you create every checklist Bar Cop uses. There are two kinds. Manager Opening and Manager Closing checklists load on the Run Checklists screen, where a manager checks them off and the run is recorded. Staff Print Only checklists are for the floor: a list for any station that prints blank for a clipboard and never runs in the app.'] },
      { h: 'Build it', p: ['Name it, pick Manager Opening, Manager Closing, or Staff Print Only, and add your steps. For a manager checklist you can load the built-in default to start from, then add, remove, or drag the handle to reorder. The order here is the order it runs or prints in. Save Checklist to keep it.'] },
      { h: 'Manager Checklists', p: ['Saved Manager Opening and Closing checklists show up in the picker on Run Checklists, where they are checked off and saved as a record. With none built, Run Checklists falls back to a built-in default list. Each one also has an Export PDF that prints a blank sheet for the clipboard.'] },
      { h: 'Staff Checklists', p: ['Staff Print Only checklists are named however you want, like Bar Close, Kitchen Open, or Floor Close, for the people working each station off paper. Each gets its own Export PDF that prints a clean sheet with empty checkboxes and blank Date and Completed By lines. They do not run in the app or save a record; the signed paper in your binder is the record.'] }
    ]);
  },

  // ── The template form (used inline for new, on its own page for edit) ───────
  // One card: name + type, then a divided Checklist Items section. Primary
  // buttons live below the card.
  formBlock(isEdit) {
    const typeOpts = [['Opening', 'Manager Opening'], ['Closing', 'Manager Closing'], ['Print', 'Staff Print Only']]
      .map(([v, l]) => '<option value="' + v + '"' + (this._type === v ? ' selected' : '') + '>' + l + '</option>').join('');
    const itemRows = this._items.map((it, idx) =>
      '<div class="ct-line" data-id="' + idx + '" data-idx="' + idx + '" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">'
      + DragReorder.handleDivHTML()
      + '<input type="text" class="ct-item-input" data-idx="' + idx + '" value="' + esc(it) + '" placeholder="Checklist item" style="flex:1;padding:9px 11px;"/>'
      + '<button type="button" class="btn btn-danger btn-sm ct-remove" data-idx="' + idx + '">Remove</button>'
      + '</div>').join('');
    const itemsBlock = this._items.length === 0
      ? '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">No items yet. Add items below or load the default list.</div>'
      : itemRows;

    return '<div class="card form-card">'
      + '<div class="card-title">' + (isEdit ? 'Edit Checklist' : 'Add New Checklist') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:260px;flex-shrink:0;"><label>Checklist Name</label>'
      + '<input type="text" id="ct-name" value="' + esc(this._name) + '" placeholder="e.g. Weekend Bar Open"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Type</label><select id="ct-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<div class="sh" style="margin-bottom:10px;">Checklist Items</div>'
      + '<div id="ct-items">' + itemsBlock + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="ct-add-item">+ Add Item</button>'
      + (this._type !== 'Print' ? '<button class="btn btn-ghost btn-sm" id="ct-load-default">Load default ' + this._type + ' items</button>' : '')
      + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="ct-save">' + (isEdit ? 'Update Checklist' : 'Save Checklist') + '</button>'
      + (isEdit
          ? '<button class="btn btn-ghost" id="ct-cancel">Cancel</button>'
          : '<button class="btn btn-ghost" id="ct-startover">Start Over</button>')
      + '<span id="ct-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  // heading '' renders no heading (the card then sits under the previous section's
  // heading, e.g. Closing under Manager Checklists). Every checklist gets an Export
  // PDF that prints a blank sheet for the clipboard. colHeader names the first column.
  savedSection(type, heading, colHeader) {
    // Oldest-first: the starter set is authored in a deliberate order (Bar Open ... Floor Close)
    // and seeded in one loop, so row order (newest-first) renders it upside-down.
    const list = this.templates().filter(t => t.type === type).sort(App.byCreation);
    if (list.length === 0) return '';
    const rows = list.map(t => '<tr class="ct-row" data-id="' + t.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + esc(t.name) + '</div></td>'
      + '<td>' + (t.items ? t.items.length : 0) + ' items</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm ct-export" data-id="' + t.id + '">Export PDF</button>'
      + '<button class="btn btn-ghost btn-sm ct-edit" data-id="' + t.id + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm ct-del" data-id="' + t.id + '">Delete</button>'
      + '</div></td></tr>').join('');
    const headingHtml = heading ? '<div class="sh" style="margin:24px 0 10px;">' + heading + '</div>' : '';
    // No-heading card (Closing) tucks right under the Opening card with a small gap.
    const cardStyle = 'overflow-x:auto;' + (heading ? '' : 'margin-top:10px;');
    // Shared column widths so the Items column lines up down all three cards, and
    // sits close to the name (fixed name column ~35px past the text) instead of
    // floating far right. Actions take the remaining width, right-aligned.
    const cg = '<colgroup><col style="width:140px"/><col style="width:110px"/><col/></colgroup>';
    return headingHtml
      + '<div class="card" style="' + cardStyle + '"><table class="row-list" style="table-layout:fixed;width:100%;">' + cg + '<thead><tr>'
      + '<th>' + (colHeader || 'Name') + '</th><th>Items</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  renderList() {
    if (this.actions) this.actions.innerHTML = '';
    const all = this.templates();
    const saved = all.length
      ? (this.savedSection('Opening', 'Manager Checklists', 'Opening Checklists')
         + this.savedSection('Closing', '', 'Closing Checklists')
         + this.savedSection('Print', 'Staff Checklists', 'Print Checklists'))
      : '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Name</th><th>Items</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="3" style="color:var(--t3);">No checklists yet. Build one above. Until you do, the Run Checklists screen uses a built-in default list.</td></tr></tbody></table></div>';

    this.container.innerHTML = '<div class="screen">' + this.formBlock(false) + saved + '</div>';
    this.container.onclick = ev => {
      const exp = ev.target.closest('.ct-export');
      if (exp) { ev.stopPropagation(); this.exportPrint(exp.dataset.id); return; }
      const row = ev.target.closest('.ct-row');
      const edit = ev.target.closest('.ct-edit');
      const del = ev.target.closest('.ct-del');
      if (del) { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row) this.showForm(row.dataset.id);
    };
    this._bindForm(() => this.renderList());
  },

  showForm(id) {
    this.editId = id || null;
    const t = id ? this.templates().find(x => x.id === id) : null;
    this._items = t ? (t.items || []).slice() : [];
    this._name = t ? t.name : '';
    this._type = t ? t.type : 'Opening';
    this.renderForm();
  },

  renderForm() {
    this.container.innerHTML = '<div class="screen">' + this.formBlock(true) + '</div>';
    this.container.onclick = null;
    this._bindForm(() => this.renderForm());
  },

  // Pull current values from the DOM into state.
  syncItems() {
    this._name = document.getElementById('ct-name')?.value || '';
    this._type = document.getElementById('ct-type')?.value || 'Opening';
    const inputs = [...document.querySelectorAll('.ct-item-input')];
    if (inputs.length) this._items = inputs.map(i => i.value);
  },

  _bindForm(reRender) {
    document.getElementById('ct-type')?.addEventListener('change', () => { this.syncItems(); reRender(); });
    document.getElementById('ct-add-item')?.addEventListener('click', () => { this.syncItems(); this._items.push(''); reRender(); });
    document.getElementById('ct-load-default')?.addEventListener('click', () => { this.syncItems(); this._items = this.defaultItems(this._type).slice(); reRender(); });
    // Capture typing into state so stepping off the page keeps the in-progress template.
    document.getElementById('ct-name')?.addEventListener('input', () => this.syncItems());
    document.getElementById('ct-items')?.addEventListener('input', ev => { if (ev.target.classList.contains('ct-item-input')) this.syncItems(); });
    document.getElementById('ct-items')?.addEventListener('click', ev => {
      const rm = ev.target.closest('.ct-remove');
      if (!rm) return;
      this.syncItems();
      this._items.splice(parseInt(rm.dataset.idx, 10), 1);
      reRender();
    });
    const itemsHost = document.getElementById('ct-items');
    if (itemsHost) {
      DragReorder.wire({
        container: itemsHost, rowSelector: '.ct-line', handleSelector: '.dr-handle',
        onCommit: () => {
          // The handle has already moved the row in the DOM, so syncItems reads
          // the inputs in their new on-screen order. That IS the new order; do
          // NOT remap by data-id again (that double-applies the move and snaps
          // a one-row drag right back where it started).
          this.syncItems();
          reRender();
        }
      });
    }
    document.getElementById('ct-cancel')?.addEventListener('click', () => { this._resetForm(); this.renderList(); });
    document.getElementById('ct-startover')?.addEventListener('click', () => { this._resetForm(); this.renderList(); });
    document.getElementById('ct-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    this.syncItems();
    const err = document.getElementById('ct-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = (this._name || '').trim();
    if (!name) { fail('Template name is required.'); return; }
    const items = this._items.map(i => i.trim()).filter(Boolean);
    if (items.length === 0) { fail('Add at least one checklist item.'); return; }

    const rec = { id: this.editId || App.uid(), name, type: this._type || 'Opening', items };
    if (!this.editId) rec.created_at = new Date().toISOString();
    // Row-per-record: build the record to persist (merge onto the existing template on edit
    // so created_at etc. survive), then write just that row.
    const list = this.templates();
    let out = rec;
    if (this.editId) { const i = list.findIndex(x => x.id === this.editId); if (i > -1) out = { ...list[i], ...rec }; }

    const btn = document.getElementById('ct-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'checklist_template', out);
    if (ok) {
      App.markSetupDone('gs_sc_checklists');
      this._resetForm();
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update Checklist' : 'Save Checklist'; }
      fail('Save failed. Try again.');
    }
  },

  // Export a Print checklist as a blank printable sheet for the clipboard: empty
  // checkboxes, blank Date / Completed By / Initials lines. Print-only, no record.
  async exportPrint(id) {
    const t = this.templates().find(x => x.id === id);
    if (!t) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const items = (t.items || []);
    const b = App._pdfBuilder(t.name + ' Checklist');
    b.header({ right: t.name, meta: 'Checklist' });
    b.kv('Date', '________________');
    b.kv('Completed By', '________________');
    b.kv('Initials', '________________');
    b.spacer(6);
    b.sectionTitle('Check off each item as you complete it');
    b.table(['Done', 'Item'], items.map(x => ['[   ]', x]), { columnStyles: { 0: { cellWidth: 55 } } });
    b.spacer(8);
    b.sectionTitle('Notes');
    b.paragraph(' ');
    await b.save(App.pdfFileName(t.name + ' Checklist'));
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('sc', 'checklist_template', id);   // row-per-record
    this.renderList();
  }
};
