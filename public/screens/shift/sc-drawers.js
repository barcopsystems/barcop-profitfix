'use strict';

/* ── Shift Control — Registers (writes sc_drawers) ────────────────────────────
   Reference table of every register/till in the operation. Cash Drop, Variance
   Log, and any cash-related form pulls from here instead of asking the operator
   to free-type a name (which produced "Bar 1" / "Front Bar" / "Main Bar"
   inconsistency across the same physical register). default_opening_bank
   pre-fills the opening bank when Start a Shift picks the register this shift
   runs on. Landing = inline add form (collapsible) over the list; Edit is a
   pop-up. (Store stays sc_drawers; only the user-facing word is "Register".) */

S.ShiftDrawers = {
  editId: null,
  _pendingDelId: null,
  _draft: null,            // in-memory inline-form draft (survives leave/return)

  drawers() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_drawers)) App.shiftData.sc_drawers = [];
    return App.shiftData.sc_drawers;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';   // form is inline on the page now
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Registers Work', [
      { p: ['Every register in your operation lives here: the main bar register, a service bar well, each floor register. Cash Drop and the Variance Log pull from this list, so every cash event lands on the same register name instead of "Bar 1" one night and "Front Bar" the next.'] },
      { h: 'Adding a Register', p: ['Give it a clear name and set a default opening bank if it normally opens with the same starting cash. That default pre-fills the opening bank when you start a shift on the register, so you are not retyping it every day.'] },
      { h: 'Cash Tolerance', p: ['Each register carries its own cash tolerance: how far its drawer can be off at a reconcile before Bar Cop flags it Over or Short. A busy main bar is harder to count tight than a slow service well, so set the number that fits the register. The default is $10. The reconcile on Cash Control and the weekly POS cash import both read the matched register\'s tolerance.'] },
      { h: 'Archiving', p: ['Retire a register you no longer use with Archive. It drops out of the dropdowns but stays on past records, so your history stays intact. Restore it any time to bring it back.'] }
    ]);
  },

  // Shared field markup. p = element-id prefix ('dr-' for the inline add form,
  // 'dre-' for the edit pop-up) so the modal's inputs never collide with the
  // inline form sitting behind it.
  fieldsHtml(d, p) {
    p = p || 'dr-';
    const v = val => (val != null && val !== '') ? val : '';
    return '<div class="form-row data-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Register Name</label>'
      + '<input type="text" id="' + p + 'name" value="' + esc(d?.name || '') + '" placeholder="Main Bar Register"/></div>'
      + '<div class="f" style="width:210px;min-width:0;"><label>Default Opening Bank</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'bank" min="0" step="0.01" value="' + v(d?.default_opening_bank) + '" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:170px;min-width:0;"><label>Cash Tolerance</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'tol" min="0" step="0.5" value="' + (d && d.cash_tolerance != null && d.cash_tolerance !== '' ? d.cash_tolerance : 10) + '"/></div></div>'
      + '</div>'
      + App.noteField({ id: p + 'notes', value: d?.notes });
  },

  renderList() {
    this.editId = null;
    const all = this.drawers();
    const active   = all.filter(d => d.active !== false);
    const archived = all.filter(d => d.active === false);

    const formCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('sc-drawers', 'Add Register')
      + '<div class="collapse-body">'
      + this.fieldsHtml(null)
      + '</div></div>'
      + '<div data-collapse-group="sc-drawers" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="dr-save">Save</button>'
        + '<button class="btn btn-ghost" id="dr-startover">Start Over</button>'
        + '<span id="dr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    let listHtml;
    if (all.length === 0) {
      listHtml = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Register Name</th><th>Default Opening Bank</th><th>Cash Tolerance</th><th>Notes</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="5" style="color:var(--t3);">No registers yet. Add your first one above.</td></tr></tbody></table></div>';
    } else {
      const row = d => '<tr>'
        + '<td><div class="val">' + esc(d.name) + '</div></td>'
        + '<td>' + (d.default_opening_bank != null && d.default_opening_bank !== '' ? App.fmtCurrency(d.default_opening_bank) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td>&plusmn;' + App.fmtCurrency(App.drawerTolerance(d)) + '</td>'
        + '<td>' + esc(d.notes || '-') + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm dr-edit" data-id="' + d.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm dr-archive" data-id="' + d.id + '" style="color:var(--red);">Archive</button>'
        + '</div></td></tr>';

      listHtml = '<div class="card" style="overflow-x:auto;margin-top:24px;">'
        + '<table class="row-list"><thead><tr>'
        + '<th>Register Name</th><th>Default Opening Bank</th><th>Cash Tolerance</th><th>Notes</th><th></th>'
        + '</tr></thead><tbody>' + active.map(row).join('') + '</tbody></table></div>';

      if (archived.length) {
        listHtml += '<div class="sh" style="margin:24px 0 8px;">Archived</div>'
          + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Register Name</th><th>Default Opening Bank</th><th>Cash Tolerance</th><th>Notes</th><th></th>'
          + '</tr></thead><tbody>'
          + archived.map(d => '<tr style="opacity:0.55;">'
              + '<td><div class="val">' + esc(d.name) + '</div></td>'
              + '<td>' + (d.default_opening_bank != null && d.default_opening_bank !== '' ? App.fmtCurrency(d.default_opening_bank) : '-') + '</td>'
              + '<td>&plusmn;' + App.fmtCurrency(App.drawerTolerance(d)) + '</td>'
              + '<td>' + esc(d.notes || '-') + '</td>'
              + '<td><div class="row-actions">'
                + '<button class="btn btn-ghost btn-sm dr-restore" data-id="' + d.id + '">Restore</button>'
              + '</div></td></tr>').join('')
          + '</tbody></table></div>';
      }
    }

    this.container.innerHTML = '<div class="screen">' + formCard + listHtml + '</div>';
    App.applyCollapsed(this.container);
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#dr-save')) { this.save(); return; }
      if (ev.target.closest('#dr-startover')) { this._draft = null; this.renderList(); return; }
      const edit = ev.target.closest('.dr-edit');
      const arch = ev.target.closest('.dr-archive');
      const rest = ev.target.closest('.dr-restore');
      if (edit) this.openEditModal(edit.dataset.id);
      else if (arch) this.setArchived(arch.dataset.id, true);
      else if (rest) this.setArchived(rest.dataset.id, false);
    };

    // Hold the in-progress inline form through leave/return.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  async setArchived(id, archived) {
    const d = this.drawers().find(x => x.id === id);
    if (!d) return;
    d.active = !archived;
    await App.saveShift();
    this.renderList();
  },

  // Edit opens in a focused pop-up (own dre- ids). Cancel closes it.
  openEditModal(id) {
    const d = this.drawers().find(x => x.id === id);
    if (!d) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Register</div>'
      + this.fieldsHtml(d, 'dre-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="dre-save">Update</button>'
      + '<span id="dre-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'dr-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('dre-save')?.addEventListener('click', () => this.saveEdit(id));
    document.getElementById('dre-name')?.focus();
  },

  async saveEdit(id) {
    const err = document.getElementById('dre-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('dre-name')?.value.trim();
    if (!name) { fail('Register name required.'); return; }
    const dup = this.drawers().some(d => d.id !== id && (d.name || '').toLowerCase() === name.toLowerCase());
    if (dup) { fail('A register with that name already exists.'); return; }
    const numOr = (eid, def) => { const n = parseFloat(document.getElementById(eid)?.value); return isNaN(n) ? def : n; };
    const d = this.drawers().find(x => x.id === id);
    if (!d) { fail('Register not found.'); return; }
    d.name                 = name;
    d.default_opening_bank = numOr('dre-bank', null);
    d.cash_tolerance       = numOr('dre-tol', 10);
    d.notes                = document.getElementById('dre-notes')?.value.trim() || '';
    const btn = document.getElementById('dre-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    if (ok) { this.editId = null; App.closeModal('dr-edit-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } fail('Save failed. Try again.'); }
  },

  async save() {
    const err = document.getElementById('dr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('dr-name')?.value.trim();
    if (!name) { fail('Register name required.'); return; }
    const dup = this.drawers().some(d => d.id !== this.editId && (d.name || '').toLowerCase() === name.toLowerCase());
    if (dup) { fail('A register with that name already exists.'); return; }

    const numOr = (id, def) => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? def : n; };

    if (this.editId) {
      const d = this.drawers().find(x => x.id === this.editId);
      if (d) {
        d.name                  = name;
        d.default_opening_bank  = numOr('dr-bank', null);
        d.cash_tolerance        = numOr('dr-tol', 10);
        d.notes                 = document.getElementById('dr-notes')?.value.trim() || '';
      }
    } else {
      this.drawers().push({
        id:                    App.uid(),
        name,
        default_opening_bank:  numOr('dr-bank', null),
        cash_tolerance:        numOr('dr-tol', 10),
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
      this._draft = null;
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  }
};
