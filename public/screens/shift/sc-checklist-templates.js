'use strict';

/* ── Shift Control — Checklist Templates (writes sc_checklist_templates) ───────
   Builds reusable Opening and Closing checklist templates. The Opening and
   Closing Checklist screens load these templates; when none exist they fall
   back to their built-in defaults. */

S.ShiftChecklistTemplates = {
  editId: null,
  _items: [],
  _pendingDelId: null,
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
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'New Template';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.templates();
    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No checklist templates yet</div>'
        + '<div class="empty-sub">Build Opening and Closing checklist templates here. Until you do, the '
        + 'Opening and Closing Checklist screens use a built-in default list.</div>'
        + '<button class="btn btn-primary" id="ct-add-first">New Template</button></div>';
    } else {
      const section = type => {
        const list = all.filter(t => t.type === type);
        if (list.length === 0) return '';
        const rows = list.map(t => '<tr class="ct-row" data-id="' + t.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(t.name) + '</div></td>'
          + '<td>' + (t.items ? t.items.length : 0) + ' items</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm ct-edit" data-id="' + t.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm ct-del" data-id="' + t.id + '">Delete</button>'
          + '</div></td></tr>').join('');
        return '<div class="card"><div class="card-title">' + type + ' Templates</div>'
          + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Name</th><th>Items</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
      };
      html = section('Opening') + section('Closing');
    }

    const modal = '<div id="ct-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this template?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="ct-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="ct-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.ct-row');
      const edit = ev.target.closest('.ct-edit');
      const del = ev.target.closest('.ct-del');
      const addF = ev.target.closest('#ct-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
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
    const typeOpts = this.TYPES.map(ty =>
      '<option' + (this._type === ty ? ' selected' : '') + '>' + ty + '</option>').join('');

    const itemRows = this._items.map((it, idx) =>
      '<div class="ct-line" data-idx="' + idx + '" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">'
      + '<input type="text" class="ct-item-input" data-idx="' + idx + '" value="' + esc(it) + '" '
      + 'placeholder="Checklist item" style="flex:1;"/>'
      + '<button type="button" class="btn btn-ghost btn-sm ct-up" data-idx="' + idx + '"' + (idx === 0 ? ' disabled' : '') + '>&#9650;</button>'
      + '<button type="button" class="btn btn-ghost btn-sm ct-down" data-idx="' + idx + '"' + (idx === this._items.length - 1 ? ' disabled' : '') + '>&#9660;</button>'
      + '<button type="button" class="btn btn-danger btn-sm ct-remove" data-idx="' + idx + '">Remove</button>'
      + '</div>').join('');

    const itemsBlock = this._items.length === 0
      ? '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">No items yet. Add items below or load the default list.</div>'
      : itemRows;

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (this.editId ? 'Edit' : 'New') + ' Checklist Template</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:260px;flex-shrink:0;"><label>Template Name</label>'
      + '<input type="text" id="ct-name" value="' + esc(this._name) + '" placeholder="e.g. Weekend Bar Open"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Type</label>'
      + '<select id="ct-type">' + typeOpts + '</select></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Checklist Items</div>'
      + '<div id="ct-items">' + itemsBlock + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="ct-add-item">+ Add Item</button>'
      + '<button class="btn btn-ghost btn-sm" id="ct-load-default">Load default ' + this._type + ' items</button>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ct-save">' + (this.editId ? 'Update Template' : 'Save Template') + '</button>'
      + '<button class="btn btn-ghost" id="ct-cancel">Cancel</button>'
      + '<span id="ct-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    this._bindForm();
  },

  // pull current values from the DOM into state
  syncItems() {
    this._name = document.getElementById('ct-name')?.value || '';
    this._type = document.getElementById('ct-type')?.value || 'Opening';
    const inputs = [...document.querySelectorAll('.ct-item-input')];
    if (inputs.length) this._items = inputs.map(i => i.value);
  },

  _bindForm() {
    document.getElementById('ct-type')?.addEventListener('change', () => {
      this.syncItems();
      this.renderForm();
    });
    document.getElementById('ct-add-item')?.addEventListener('click', () => {
      this.syncItems();
      this._items.push('');
      this.renderForm();
    });
    document.getElementById('ct-load-default')?.addEventListener('click', () => {
      this.syncItems();
      this._items = this.defaultItems(this._type).slice();
      this.renderForm();
    });
    document.getElementById('ct-items')?.addEventListener('click', ev => {
      const rm = ev.target.closest('.ct-remove');
      const up = ev.target.closest('.ct-up');
      const dn = ev.target.closest('.ct-down');
      if (!rm && !up && !dn) return;
      this.syncItems();
      const idx = parseInt((rm || up || dn).dataset.idx, 10);
      if (rm) this._items.splice(idx, 1);
      else if (up && idx > 0) { const x = this._items.splice(idx, 1)[0]; this._items.splice(idx - 1, 0, x); }
      else if (dn && idx < this._items.length - 1) { const x = this._items.splice(idx, 1)[0]; this._items.splice(idx + 1, 0, x); }
      this.renderForm();
    });
    document.getElementById('ct-cancel')?.addEventListener('click', () => this.renderList());
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

    const rec = {
      id:    this.editId || App.uid(),
      name,
      type:  this._type || 'Opening',
      items
    };
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
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_sc_checklists');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Template'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('ct-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('ct-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('ct-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_checklist_templates = this.templates().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderList();
    };
  }
};
