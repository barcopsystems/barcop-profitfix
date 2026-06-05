'use strict';

/* ── Shift Control — Log a Shift form (writes sc_shifts) ──────────────────────
   The add/edit form for a single shift. Reached from Shift History: "Log a Past
   Shift" (add) and a row's Edit (edit). The shift LIST and Delete live on Shift
   History; this screen is form-only. Shift revenue is the single source of
   weekly revenue for Profit and Revenue Recovery. Stored in App.shiftData. */

S.ShiftLogShift = {
  editId: null,
  _openEditId: null,
  get SHIFT_TYPES() { return App.SHIFT_TYPES; },

  shifts() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_shifts)) App.shiftData.sc_shifts = [];
    return App.shiftData.sc_shifts;
  },

  render(container, actions) {
    // The shift form now lives inline on Shift History (Log a Past Shift) plus the
    // in-screen Edit there. This screen just forwards so any old link or the
    // command palette lands on the right place instead of a dead-end form.
    if (actions) actions.innerHTML = '';
    App.navigate('sc-shift-history');
  },

  back() { App.navigate('sc-shift-history'); },

  showForm(id) {
    if (id && !App.canEdit('sc-log-shift')) { this.back(); return; }
    this.editId = id || null;
    const s = id ? this.shifts().find(x => x.id === id) : null;
    const typeOpts = this.SHIFT_TYPES.map(t => '<option' + (s && s.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';
    const firstDrawer = ((App.shiftData && App.shiftData.sc_drawers) || []).find(d => d.active !== false);
    const defaultBank = (firstDrawer && firstDrawer.default_opening_bank != null) ? firstDrawer.default_opening_bank : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Shift' : 'Log a Past Shift') + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="ls-date" value="' + esc(s?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f w-md"><label>Shift Type</label><select id="ls-type">' + typeOpts + '</select></div>'
      + '<div class="f w-md"><label>Manager on Duty</label><select id="ls-mgr">' + App.staffOptions(s?.manager_id || s?.manager, { placeholder: 'Select staff...', audience: 'supervisor' }) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Bar Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ls-bar" value="' + v(s?.bar_revenue) + '" step="0.01" oninput="S.ShiftLogShift.calc()"/></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Floor Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ls-floor" value="' + v(s?.floor_revenue) + '" step="0.01" oninput="S.ShiftLogShift.calc()"/></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Covers</label>'
      + '<input type="number" id="ls-covers" value="' + v(s?.covers) + '" min="0" oninput="S.ShiftLogShift.calc()"/></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Walkouts</label>'
      + '<input type="number" id="ls-walkouts" value="' + v(s?.walkouts) + '" min="0" placeholder="0"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Opening Bank</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ls-bank" value="' + v(s?.opening_bank != null ? s.opening_bank : defaultBank) + '" step="0.01"/></div></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Staff on Floor</label>'
      + '<input type="number" id="ls-staff" value="' + v(s?.staff_on_floor) + '" min="0"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Status</label><select id="ls-status">'
      + '<option' + (s && s.status === 'Open' ? ' selected' : '') + '>Open</option>'
      + '<option' + (!s || s.status !== 'Open' ? ' selected' : '') + '>Closed</option>'
      + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="ls-notes" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div></div>'

      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="ls-total">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="ls-checkavg">-</div></div>'
      + '</div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ls-save">' + (id ? 'Update' : 'Save Shift') + '</button>'
      + '<button class="btn btn-ghost" id="ls-cancel">Cancel</button>'
      + '<span id="ls-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('ls-cancel')?.addEventListener('click', () => this.back());
    document.getElementById('ls-save')?.addEventListener('click', () => this.save());
    this.calc();
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const total = num('ls-bar') + num('ls-floor');
    const covers = num('ls-covers');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ls-total', App.fmtCurrency(total));
    set('ls-checkavg', covers > 0 ? App.fmtCurrency(total / covers) : '-');
  },

  async save() {
    const err = document.getElementById('ls-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ls-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const bar = num('ls-bar') || 0, floor = num('ls-floor') || 0;

    const rec = {
      id:             this.editId || App.uid(),
      date,
      shift_type:     document.getElementById('ls-type')?.value || '',
      manager_id:     document.getElementById('ls-mgr')?.value || '',
      manager:        (App.staffById(document.getElementById('ls-mgr')?.value) || {}).name || '',
      bar_revenue:    bar,
      floor_revenue:  floor,
      total_revenue:  bar + floor,
      covers:         num('ls-covers'),
      walkouts:       num('ls-walkouts'),
      opening_bank:   num('ls-bank'),
      staff_on_floor: num('ls-staff'),
      status:         document.getElementById('ls-status')?.value || 'Closed',
      notes:          document.getElementById('ls-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.shifts();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('ls-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'shift', saved);
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_sc_shift');
      this.back();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Shift'; }
      fail('Save failed. Try again.');
    }
  }
};
