'use strict';

/* ── Shift Control — Drawers / Registers (writes sc_drawers) ──────────────────
   Reference table of every drawer or register in the operation. Cash Drop,
   Variance Log, and any cash-related form pulls from here instead of asking
   the operator to free-type a drawer name (which produced "Bar 1" / "Front
   Bar" / "Main Bar" inconsistency across the same physical register).
   default_opening_bank is optional convenience — Start a Shift can pre-fill
   the opening bank field when the operator picks the drawer this shift
   runs on. */

S.ShiftDrawers = {
  editId: null,
  _pendingDelId: null,

  drawers() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_drawers)) App.shiftData.sc_drawers = [];
    return App.shiftData.sc_drawers;
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Add Drawer';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    this.renderList();
  },

  renderList() {
    const all = this.drawers();
    const active   = all.filter(d => d.active !== false);
    const archived = all.filter(d => d.active === false);

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No drawers set up yet</div>'
        + '<div class="empty-sub">Add every drawer or register in the operation: Main Bar, Service Bar, Floor Register, etc. Cash Drop and Variance Log pull from this list so every cash event lands on the right drawer.</div>'
        + '<button class="btn btn-primary" id="dr-add-first">Add Drawer</button></div>';
    } else {
      const row = d => '<tr>'
        + '<td><div class="val">' + esc(d.name) + '</div></td>'
        + '<td>' + esc(d.location || '-') + '</td>'
        + '<td>' + (d.default_opening_bank != null && d.default_opening_bank !== '' ? App.fmtCurrency(d.default_opening_bank) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td>' + esc(d.notes || '-') + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm dr-edit" data-id="' + d.id + '">Edit</button>'
          + (d.active === false
              ? '<button class="btn btn-ghost btn-sm dr-restore" data-id="' + d.id + '">Restore</button>'
              : '<button class="btn btn-ghost btn-sm dr-archive" data-id="' + d.id + '" style="color:var(--red);">Archive</button>')
        + '</div></td></tr>';

      html = '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th>Drawer / Register</th><th>Location</th><th>Default Opening Bank</th><th>Notes</th><th></th>'
        + '</tr></thead><tbody>' + active.map(row).join('') + '</tbody></table></div>';

      if (archived.length) {
        html += '<div class="sh" style="margin:24px 0 8px;">Archived</div>'
          + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Restore any to bring them back into the dropdowns.</div>'
          + '<div class="tbl-wrap"><table class="tbl"><tbody>'
          + archived.map(d => '<tr style="opacity:0.55;">'
              + '<td style="font-weight:700;color:var(--t2);">' + esc(d.name) + '</td>'
              + '<td>' + esc(d.location || '-') + '</td>'
              + '<td>' + (d.default_opening_bank != null && d.default_opening_bank !== '' ? App.fmtCurrency(d.default_opening_bank) : '-') + '</td>'
              + '<td>' + esc(d.notes || '-') + '</td>'
              + '<td><div class="row-actions">'
                + '<button class="btn btn-ghost btn-sm dr-restore" data-id="' + d.id + '">Restore</button>'
              + '</div></td></tr>').join('')
          + '</tbody></table></div>';
      }
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const edit  = ev.target.closest('.dr-edit');
      const arch  = ev.target.closest('.dr-archive');
      const rest  = ev.target.closest('.dr-restore');
      const first = ev.target.closest('#dr-add-first');
      if (edit) this.showForm(edit.dataset.id);
      else if (arch) this.setArchived(arch.dataset.id, true);
      else if (rest) this.setArchived(rest.dataset.id, false);
      else if (first) this.showForm();
    };
  },

  async setArchived(id, archived) {
    const d = this.drawers().find(x => x.id === id);
    if (!d) return;
    d.active = !archived;
    await App.saveShift();
    this.renderList();
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  showForm(id) {
    this.editId = id || null;
    const d = id ? this.drawers().find(x => x.id === id) : null;
    const locations = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived)
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let locOpts = '<option value="">(none)</option>';
    locations.forEach(l => {
      locOpts += '<option value="' + esc(l.name) + '"' + (d?.location === l.name ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    });
    if (d?.location && !locations.some(l => l.name === d.location)) {
      locOpts += '<option value="' + esc(d.location) + '" selected>' + esc(d.location) + ' (unsaved)</option>';
    }

    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'New') + ' Drawer</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Drawer / Register Name</label>'
      + '<input type="text" id="dr-name" value="' + esc(d?.name || '') + '" placeholder="Main Bar Register"/></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Location <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
      + '<select id="dr-loc">' + locOpts + '</select></div>'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>Default Opening Bank <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="dr-bank" min="0" step="0.01" value="' + v(d?.default_opening_bank) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<input type="text" id="dr-notes" value="' + esc(d?.notes || '') + '" placeholder="Optional"/></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="dr-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="dr-cancel">Cancel</button>'
      + '<span id="dr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('dr-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('dr-save')?.addEventListener('click', () => this.save());
    document.getElementById('dr-name')?.focus();
  },

  async save() {
    const err = document.getElementById('dr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('dr-name')?.value.trim();
    if (!name) { fail('Drawer name required.'); return; }
    const dup = this.drawers().some(d => d.id !== this.editId && (d.name || '').toLowerCase() === name.toLowerCase());
    if (dup) { fail('A drawer with that name already exists.'); return; }

    const numOr = (id, def) => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? def : n; };

    if (this.editId) {
      const d = this.drawers().find(x => x.id === this.editId);
      if (d) {
        d.name                  = name;
        d.location              = document.getElementById('dr-loc')?.value.trim() || '';
        d.default_opening_bank  = numOr('dr-bank', null);
        d.notes                 = document.getElementById('dr-notes')?.value.trim() || '';
      }
    } else {
      this.drawers().push({
        id:                    App.uid(),
        name,
        location:              document.getElementById('dr-loc')?.value.trim() || '',
        default_opening_bank:  numOr('dr-bank', null),
        notes:                 document.getElementById('dr-notes')?.value.trim() || '',
        active:                true,
        created_at:            new Date().toISOString()
      });
    }

    const btn = document.getElementById('dr-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  }
};
