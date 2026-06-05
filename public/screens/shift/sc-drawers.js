'use strict';

/* ── Shift Control — Drawers / Registers (writes sc_drawers) ──────────────────
   Reference table of every drawer or register in the operation. Cash Drop,
   Variance Log, and any cash-related form pulls from here instead of asking
   the operator to free-type a drawer name (which produced "Bar 1" / "Front
   Bar" / "Main Bar" inconsistency across the same physical register).
   default_opening_bank pre-fills the opening bank when Start a Shift picks
   the drawer this shift runs on.

   UN-BOX PROTOTYPE (2026-06-05): rebuilt in the full-width, on-canvas language
   to compare against the boxed version. Page header with the primary action
   top-right, the add form opens as a pop-up off "Add Drawer" (Edit reuses the
   same pop-up), and the list sits directly on the page canvas (no card box). */

S.ShiftDrawers = {
  editId: null,

  drawers() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_drawers)) App.shiftData.sc_drawers = [];
    return App.shiftData.sc_drawers;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';   // primary action lives in the page header now
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Drawers and Registers Work', [
      { p: ['Every drawer or register in your operation lives here: the main bar register, a service bar well, each floor register. Cash Drop and the Variance Log pull from this list, so every cash event lands on the same drawer name instead of "Bar 1" one night and "Front Bar" the next.'] },
      { h: 'Adding a Drawer', p: ['Give it a clear name, tie it to a location if you want, and set a default opening bank if it normally opens with the same starting cash. That default pre-fills the opening bank when you start a shift on the drawer, so you are not retyping it every day.'] },
      { h: 'Archiving', p: ['Retire a drawer you no longer use with Archive. It drops out of the dropdowns but stays on past records, so your history stays intact. Restore it any time to bring it back.'] }
    ]);
  },

  // Shared field markup. p = element-id prefix; the add/edit pop-up uses 'dr-'.
  fieldsHtml(d, p) {
    p = p || 'dr-';
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
    return '<div class="form-row data-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Drawer / Register Name</label>'
      + '<input type="text" id="' + p + 'name" value="' + esc(d?.name || '') + '" placeholder="Main Bar Register"/></div>'
      + '<div class="f" style="width:220px;min-width:0;"><label>Location</label>'
      + '<select id="' + p + 'loc">' + locOpts + '</select></div>'
      + '<div class="f" style="width:210px;min-width:0;"><label>Default Opening Bank ' + tt('dr-bank') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'bank" min="0" step="0.01" value="' + v(d?.default_opening_bank) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<input type="text" id="' + p + 'notes" value="' + esc(d?.notes || '') + '" placeholder="Optional"/></div></div>';
  },

  renderList() {
    this.editId = null;
    const all = this.drawers();
    const active   = all.filter(d => d.active !== false);
    const archived = all.filter(d => d.active === false);

    const header = '<div class="page-head">'
      + '<div>'
      + '<h1 class="page-title">Drawers &amp; Registers</h1>'
      + '<div class="page-desc">Every drawer or register in your operation. Cash Drop and the Variance Log pull from this list so every cash event lands on the same name instead of "Bar 1" one night and "Front Bar" the next.</div>'
      + '</div>'
      + '<div class="page-head-actions">'
      + App.helpButton('dr-how')
      + '<button class="btn btn-primary" id="dr-add">Add Drawer</button>'
      + '</div></div>';

    let body;
    if (all.length === 0) {
      body = '<div class="page-empty">No drawers yet. Add your first register with the button above. Cash Drop and the Variance Log will pull from this list so every cash event lands on the right drawer.</div>';
    } else {
      const row = d => '<tr>'
        + '<td><div class="val">' + esc(d.name) + '</div></td>'
        + '<td>' + esc(d.location || '-') + '</td>'
        + '<td>' + (d.default_opening_bank != null && d.default_opening_bank !== '' ? App.fmtCurrency(d.default_opening_bank) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td>' + esc(d.notes || '-') + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm dr-edit" data-id="' + d.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm dr-archive" data-id="' + d.id + '" style="color:var(--red);">Archive</button>'
        + '</div></td></tr>';

      body = '<div class="data-table"><table class="tbl"><thead><tr>'
        + '<th>Drawer / Register</th><th>Location</th><th>Default Opening Bank</th><th>Notes</th><th></th>'
        + '</tr></thead><tbody>' + active.map(row).join('') + '</tbody></table></div>';

      if (archived.length) {
        body += '<div class="canvas-sub">Archived</div>'
          + '<div class="canvas-hint">Restore any to bring them back into the dropdowns.</div>'
          + '<div class="data-table"><table class="tbl"><tbody>'
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

    this.container.innerHTML = '<div class="page">' + header + body + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#dr-how')) { this.showHowTo(); return; }
      if (ev.target.closest('#dr-add')) { this.openFormModal(null); return; }
      const edit = ev.target.closest('.dr-edit');
      const arch = ev.target.closest('.dr-archive');
      const rest = ev.target.closest('.dr-restore');
      if (edit) this.openFormModal(edit.dataset.id);
      else if (arch) this.setArchived(arch.dataset.id, true);
      else if (rest) this.setArchived(rest.dataset.id, false);
    };
  },

  async setArchived(id, archived) {
    const d = this.drawers().find(x => x.id === id);
    if (!d) return;
    d.active = !archived;
    await App.saveShift();
    this.renderList();
  },

  // Add (id null) and Edit (id set) share one focused pop-up.
  openFormModal(id) {
    const d = id ? this.drawers().find(x => x.id === id) : null;
    if (id && !d) return;
    this.editId = id || null;
    const html = '<div class="card" style="margin:0;"><div class="card-title">' + (id ? 'Edit Drawer' : 'Add Drawer') + '</div>'
      + this.fieldsHtml(d, 'dr-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="dr-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="dr-cancel">Cancel</button>'
      + '<span id="dr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'dr-form-modal', maxWidth: 640, noClose: true });
    document.getElementById('dr-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('dr-form-modal'); });
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
    if (ok) {
      this.editId = null;
      App.closeModal('dr-form-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update' : 'Save'; }
      fail('Save failed. Try again.');
    }
  }
};
