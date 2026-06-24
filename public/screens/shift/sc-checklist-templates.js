'use strict';

/* ── Shift Control — Checklist Templates (writes sc_checklist_templates) ───────
   Builds reusable Opening and Closing checklist templates. The Checklists
   screen loads these; when none exist it falls back to the built-in defaults.
   Inline new-template form on the landing, saved templates below, edit on its
   own page. */

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

  render(container, actions) {
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
    App.showHelpModal('How Checklist Templates Work', [
      { p: ['A template is a saved checklist: your standard opening or closing task list. Build one here and it loads on the Checklists screen so the manager just checks it off.'] },
      { h: 'Build it', p: ['Name it, pick Opening or Closing, and add your items. Load the default to start from Bar Cop\'s built-in list, then add, remove, or drag the handle to reorder. The order here is the order it runs in.'] },
      { h: 'Using it', p: ['Saved templates show up in the Template picker on the Checklists screen. With no template built, Checklists falls back to the built-in default list.'] }
    ]);
  },

  // ── The template form (used inline for new, on its own page for edit) ───────
  // One card: name + type, then a divided Checklist Items section. Primary
  // buttons live below the card.
  formBlock(isEdit) {
    const typeOpts = this.TYPES.map(ty => '<option' + (this._type === ty ? ' selected' : '') + '>' + ty + '</option>').join('');
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
      + '<div class="card-title">' + (isEdit ? 'Edit' : 'New') + ' Checklist Template</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:260px;flex-shrink:0;"><label>Template Name</label>'
      + '<input type="text" id="ct-name" value="' + esc(this._name) + '" placeholder="e.g. Weekend Bar Open"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Type</label><select id="ct-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<div class="sh" style="margin-bottom:10px;">Checklist Items</div>'
      + '<div id="ct-items">' + itemsBlock + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="ct-add-item">+ Add Item</button>'
      + '<button class="btn btn-ghost btn-sm" id="ct-load-default">Load default ' + this._type + ' items</button>'
      + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="ct-save">' + (isEdit ? 'Update Template' : 'Save Template') + '</button>'
      + (isEdit
          ? '<button class="btn btn-ghost" id="ct-cancel">Cancel</button>'
          : '<button class="btn btn-ghost" id="ct-startover">Start Over</button>')
      + '<span id="ct-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  savedSection(type) {
    const list = this.templates().filter(t => t.type === type);
    if (list.length === 0) return '';
    const rows = list.map(t => '<tr class="ct-row" data-id="' + t.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + esc(t.name) + '</div></td>'
      + '<td>' + (t.items ? t.items.length : 0) + ' items</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm ct-edit" data-id="' + t.id + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm ct-del" data-id="' + t.id + '">Delete</button>'
      + '</div></td></tr>').join('');
    return '<div class="sh" style="margin:24px 0 10px;">' + type + ' Templates</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Name</th><th>Items</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  renderList() {
    if (this.actions) this.actions.innerHTML = '';
    const all = this.templates();
    const saved = all.length
      ? (this.savedSection('Opening') + this.savedSection('Closing'))
      : '<div class="card card-bleed data-card" style="margin-top:24px;"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Name</th><th>Items</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="3" style="color:var(--t3);">No saved templates yet. Build one above. Until you do, the Checklists screen uses a built-in default list.</td></tr></tbody></table></div></div>';

    this.container.innerHTML = '<div class="screen">' + this.formBlock(false) + saved + '</div>';
    this.container.onclick = ev => {
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
    const list = this.templates();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('ct-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    if (ok) {
      App.markSetupDone('gs_sc_checklists');
      this._resetForm();
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update Template' : 'Save Template'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    App.shiftData.sc_checklist_templates = this.templates().filter(x => x.id !== id);
    await App.saveShift();
    this.renderList();
  }
};
