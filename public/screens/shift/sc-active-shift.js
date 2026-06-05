'use strict';

/* ── Shift Control — Active Shift (writes sc_shifts) ──────────────────────────
   Mobile-first live shift command center. Start a shift, then a running view
   with this-shift activity (cash drops, voids/comps, 86s) and one-tap links to
   log them. End Shift captures revenue and covers and closes the sc_shifts
   record — the same record the rest of the platform reads for weekly revenue. */

S.ShiftActiveShift = {
  mode: null,

  shifts() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_shifts)) App.shiftData.sc_shifts = [];
    return App.shiftData.sc_shifts;
  },
  active() {
    return [...this.shifts()]
      .filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },
  shiftTypes() {
    return App.SHIFT_TYPES;
  },
  byDate(key, date) {
    return ((App.shiftData && App.shiftData[key]) || []).filter(r => r.date === date);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  elapsed(iso) {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const act = this.active();
    this.mode = act ? 'active' : 'start';
    if (act) this.renderActive(act);
    else this.renderStart();
  },

  // ── Start a shift ───────────────────────────────────────────────────────────
  // ── Open the Floor — the visual shift opener ────────────────────────────────
  // Tap a daypart, tap who's running it, tap the registers live tonight (each
  // shows its bank), set staff + tolerance, open. The live readout assembles the
  // shift as you go. State lives in this._openDraft; taps re-render, the bank /
  // tolerance inputs update the draft in place so focus survives typing.
  renderStart() {
    if (!this._openDraft) this._openDraft = this._freshDraft();
    const d = this._openDraft;
    const lbl = 'font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;';
    const types = this.shiftTypes();
    const activeDrawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(x => x.active !== false);
    const mods = this.modStaff();
    const initials = nm => (nm || '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

    const chips = types.map(t =>
      '<button class="of-chip" data-type="' + esc(t) + '" style="padding:9px 16px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
      + (d.shift_type === t ? 'background:var(--gold-bg);border:1px solid var(--gold);color:var(--gold);' : 'background:var(--input);border:1px solid var(--b1);color:var(--t2);')
      + '">' + esc(t) + '</button>').join('');

    const modChips = mods.length
      ? mods.map(st =>
          '<button class="of-mod" data-mgr="' + esc(st.id) + '" style="display:inline-flex;align-items:center;gap:8px;padding:7px 14px 7px 8px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
          + (d.manager_id === st.id ? 'background:var(--gold-bg);border:1px solid var(--gold);color:var(--gold);' : 'background:var(--input);border:1px solid var(--b1);color:var(--t2);')
          + '"><span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--surface);font-size:10px;font-weight:800;">'
          + esc(initials(st.name)) + '</span>' + esc(st.name) + '</button>').join('')
      : '<div style="font-size:12px;color:var(--t3);">No manager-eligible staff yet. Add staff and positions in Labor Control.</div>';

    let regsHtml;
    if (activeDrawers.length === 0) {
      regsHtml = '<div style="border:1px dashed var(--b1);border-radius:8px;padding:18px;text-align:center;color:var(--t3);font-size:13px;">'
        + 'No registers set up yet. <button class="btn btn-ghost btn-sm" id="of-add-drawers" style="margin-left:6px;">Set Up Registers</button>'
        + '<div style="margin-top:6px;font-size:11px;">You can still open the floor without one; cash counting just gets skipped.</div></div>';
    } else {
      regsHtml = '<div style="display:flex;flex-wrap:wrap;gap:12px;">'
        + activeDrawers.map(dr => {
            const st = d.drawers[dr.id] || { on: false, bank: '' };
            const on = !!st.on;
            return '<div class="reg-tile" data-drawer="' + esc(dr.id) + '" style="width:150px;min-height:90px;border-radius:10px;padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;'
              + (on ? 'border:1.5px solid var(--gold);background:var(--gold-bg);' : 'border:1px solid var(--b1);background:var(--input);opacity:0.6;') + '">'
              + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">'
              + '<div style="font-size:13px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(dr.name) + '</div>'
              + (on ? '<span style="color:var(--gold);font-size:14px;font-weight:800;">&#10003;</span>' : '') + '</div>'
              + (on
                  ? '<div style="display:flex;align-items:center;gap:4px;margin-top:8px;"><span style="color:var(--t3);font-size:13px;">$</span>'
                    + '<input class="reg-bank" type="number" min="0" step="0.01" inputmode="decimal" data-drawer="' + esc(dr.id) + '" value="' + esc(String(st.bank != null ? st.bank : '')) + '" placeholder="0" '
                    + 'oninput="S.ShiftActiveShift.setBank(\'' + esc(dr.id) + '\', this.value)" '
                    + 'style="width:100%;background:var(--bg);border:1px solid var(--b1);border-radius:5px;padding:5px 7px;color:var(--t1);font-size:14px;"/></div>'
                  : '<div style="font-size:11px;color:var(--t3);margin-top:8px;">tap to open</div>')
              + '</div>';
          }).join('')
        + '</div>';
    }

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div>'
      + '<div style="font-size:18px;font-weight:800;color:var(--t1);letter-spacing:0.3px;">Open the Floor</div>'
      + '<div id="of-readout" style="font-size:13px;color:var(--gold);font-weight:600;margin-top:4px;min-height:18px;">' + esc(this._readoutText()) + '</div>'
      + '</div>' + App.helpButton('of-how') + '</div>'

      + '<div style="margin-top:20px;"><div style="' + lbl + '">Daypart</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + chips + '</div></div>'

      + '<div style="margin-top:18px;"><div style="' + lbl + '">Running It</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + modChips + '</div></div>'

      + '<div style="margin-top:18px;"><div style="' + lbl + '">Registers <span style="color:var(--t3);font-weight:400;text-transform:none;letter-spacing:0;">tap the ones running tonight, set each bank</span></div>'
      + regsHtml + '</div>'

      + '<div style="margin-top:18px;display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end;">'
      + '<div><div style="' + lbl + '">Staff on Floor</div>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="of-staff-minus" style="width:34px;">&minus;</button>'
      + '<span style="font-size:18px;font-weight:800;color:var(--t1);min-width:24px;text-align:center;">' + (parseInt(d.staff_on_floor) || 0) + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="of-staff-plus" style="width:34px;">+</button></div></div>'
      + '<div><div style="' + lbl + '">Cash Tolerance</div>'
      + '<div class="fw" style="width:130px;"><span class="pre">$</span><input class="pre" type="number" id="of-tol" min="0" step="0.5" inputmode="decimal" value="' + esc(String(d.cash_tolerance != null ? d.cash_tolerance : '')) + '" oninput="S.ShiftActiveShift.setTol(this.value)"/></div></div>'
      + '</div>'

      + '<div class="card-actions" style="margin-top:24px;">'
      + '<button class="btn btn-primary btn-lg" id="as-start">Open the Floor</button>'
      + '<span id="as-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>'
      + this.recentShiftsCard()
      + '</div>';

    this.container.onclick = ev => {
      const chip = ev.target.closest('.of-chip');
      const mod = ev.target.closest('.of-mod');
      const tile = ev.target.closest('.reg-tile');
      if (ev.target.closest('#of-how')) { this.showHowToOpen(); return; }
      if (ev.target.closest('#of-add-drawers')) { App.navigate('sc-drawers'); return; }
      if (ev.target.closest('#rs-log')) { this.showShiftForm(null); return; }
      const rsEdit = ev.target.closest('.rs-edit');
      if (rsEdit) { this.showShiftForm(rsEdit.dataset.id); return; }
      const rsView = ev.target.closest('.rs-view');
      if (rsView) { S.ShiftHistory._openDetailId = rsView.dataset.id; App.navigate('sc-shift-history'); return; }
      if (ev.target.closest('#rs-clear')) { this._rsFrom = this._rsTo = ''; this.renderStart(); return; }
      if (chip) { d.shift_type = chip.dataset.type; d.cash_tolerance = this._defaultToleranceFor(d.shift_type); this.renderStart(); return; }
      if (mod) { d.manager_id = (d.manager_id === mod.dataset.mgr) ? '' : mod.dataset.mgr; this.renderStart(); return; }
      if (ev.target.closest('#of-staff-minus')) { d.staff_on_floor = Math.max(0, (parseInt(d.staff_on_floor) || 0) - 1); this.renderStart(); return; }
      if (ev.target.closest('#of-staff-plus')) { d.staff_on_floor = (parseInt(d.staff_on_floor) || 0) + 1; this.renderStart(); return; }
      if (tile && !ev.target.closest('.reg-bank')) {
        const id = tile.dataset.drawer;
        if (!d.drawers[id]) d.drawers[id] = { on: false, bank: '' };
        d.drawers[id].on = !d.drawers[id].on;
        if (d.drawers[id].on && (d.drawers[id].bank === '' || d.drawers[id].bank == null)) {
          const dr = activeDrawers.find(x => x.id === id);
          if (dr && dr.default_opening_bank != null) d.drawers[id].bank = dr.default_opening_bank;
        }
        this.renderStart();
        return;
      }
      if (ev.target.closest('#as-start')) this.startShift();
    };
    document.getElementById('rs-from')?.addEventListener('change', e => { this._rsFrom = e.target.value || ''; this.renderStart(); });
    document.getElementById('rs-to')?.addEventListener('change', e => { this._rsTo = e.target.value || ''; this.renderStart(); });
  },

  // ── Recent Shifts (opener-state command center: view/edit/log past shifts) ──
  // The filter card holds the title + Log a Past Shift + a light date filter;
  // the rows sit OUTSIDE the card. Shift History stays the read-only archive.
  _rsFrom: '',
  _rsTo: '',
  recentShiftsCard() {
    const all = [...this.shifts()].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    const from = this._rsFrom || '', to = this._rsTo || '';
    const list = all.filter(s => {
      if (from && (s.date || '') < from) return false;
      if (to && (s.date || '') > to) return false;
      return true;
    });
    const limited = (from || to) ? list : list.slice(0, 10);
    const card = '<div class="card" style="margin-top:16px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Recent Shifts</span><button class="btn btn-primary btn-sm" id="rs-log">Log a Past Shift</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="rs-from" value="' + esc(from) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="rs-to" value="' + esc(to) + '"/></div>'
      + ((from || to) ? '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="rs-clear">Clear</button></div>' : '')
      + '</div></div>';
    let below;
    if (!all.length) below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No shifts yet. Open the floor above, or log a past shift.</div>';
    else if (!limited.length) below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No shifts in that range.</div>';
    else {
      const trs = limited.map(s => {
        const statusText = s.status === 'Open'
          ? '<span style="color:var(--gold);font-weight:700;">Open</span>'
          : '<span style="color:var(--t3);font-weight:700;">Closed</span>';
        return '<tr>'
          + '<td><div class="val">' + this.fmtDate(s.date) + '</div></td>'
          + '<td>' + esc(s.shift_type || '-') + '</td>'
          + '<td>' + esc(s.manager || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.total_revenue || 0) + '</td>'
          + '<td>' + statusText + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm rs-view" data-id="' + s.id + '">View</button>'
          + '<button class="btn btn-ghost btn-sm rs-edit" data-id="' + s.id + '">Edit</button></div></td></tr>';
      }).join('');
      below = '<div class="tbl-wrap" style="overflow-x:auto;margin-top:12px;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }
    return card + below;
  },

  _reDispatch() {
    this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div'));
  },

  // ── Log a Past Shift / Edit a shift (focused pop-up over the command center) ─
  showShiftForm(id) {
    if (id && App.canEdit && !App.canEdit('sc-active-shift')) return;
    this._shiftFormId = id || null;
    const s = id ? this.shifts().find(x => x.id === id) : null;
    const html = '<div class="card" style="margin:0;"><div class="card-title">' + (id ? 'Edit Shift' : 'Log a Past Shift') + '</div>'
      + this.shiftFormRows(s)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="asf-save">' + (id ? 'Update' : 'Save Shift') + '</button>'
      + '<button class="btn btn-ghost" id="asf-cancel">Cancel</button>'
      + '<span id="asf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + (id ? '<button class="btn btn-danger" id="asf-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id: 'as-shift-modal', maxWidth: 760, noClose: true });
    document.getElementById('asf-cancel')?.addEventListener('click', () => { this._shiftFormId = null; App.closeModal('as-shift-modal'); });
    document.getElementById('asf-save')?.addEventListener('click', () => this.saveShiftForm());
    document.getElementById('asf-del')?.addEventListener('click', () => this.confirmDeleteShift(id));
    this.calcShiftForm();
  },

  shiftFormRows(s) {
    const v = val => (val != null && val !== '') ? val : '';
    const typeOpts = App.SHIFT_TYPES.map(t => '<option' + (s && s.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const firstDrawer = ((App.shiftData && App.shiftData.sc_drawers) || []).find(d => d.active !== false);
    const defaultBank = (firstDrawer && firstDrawer.default_opening_bank != null) ? firstDrawer.default_opening_bank : '';
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:140px;"><label>Date</label><input type="date" id="asf-date" value="' + esc(s?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:130px;"><label>Shift Type</label><select id="asf-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="asf-bar" step="0.01" value="' + v(s?.bar_revenue) + '" oninput="S.ShiftActiveShift.calcShiftForm()"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Floor Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="asf-floor" step="0.01" value="' + v(s?.floor_revenue) + '" oninput="S.ShiftActiveShift.calcShiftForm()"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:160px;"><label>Manager on Duty</label><select id="asf-mgr">' + App.staffOptions(s?.manager_id || s?.manager, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Covers</label><input type="number" id="asf-covers" min="0" value="' + v(s?.covers) + '" oninput="S.ShiftActiveShift.calcShiftForm()"/></div>'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Walkouts</label><input type="number" id="asf-walkouts" min="0" value="' + v(s?.walkouts) + '" placeholder="0"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Opening Bank</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="asf-bank" step="0.01" value="' + v(s?.opening_bank != null ? s.opening_bank : defaultBank) + '"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Staff on Floor</label><input type="number" id="asf-staff" min="0" value="' + v(s?.staff_on_floor) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Status</label><select id="asf-status"><option' + (s && s.status === 'Open' ? ' selected' : '') + '>Open</option><option' + (!s || s.status !== 'Open' ? ' selected' : '') + '>Closed</option></select></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:6px;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="asf-total">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="asf-checkavg">-</div></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label><textarea id="asf-notes" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div>';
  },

  calcShiftForm() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const total = num('asf-bar') + num('asf-floor');
    const covers = num('asf-covers');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('asf-total', App.fmtCurrency(total));
    set('asf-checkavg', covers > 0 ? App.fmtCurrency(total / covers) : '-');
  },

  async saveShiftForm() {
    const err = document.getElementById('asf-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('asf-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const bar = num('asf-bar') || 0, floor = num('asf-floor') || 0;
    const mgrId = document.getElementById('asf-mgr')?.value || '';
    const rec = {
      id:             this._shiftFormId || App.uid(),
      date,
      shift_type:     document.getElementById('asf-type')?.value || '',
      manager_id:     mgrId,
      manager:        (App.staffById(mgrId) || {}).name || '',
      bar_revenue:    bar,
      floor_revenue:  floor,
      total_revenue:  bar + floor,
      covers:         num('asf-covers'),
      walkouts:       num('asf-walkouts'),
      opening_bank:   num('asf-bank'),
      staff_on_floor: num('asf-staff'),
      status:         document.getElementById('asf-status')?.value || 'Closed',
      notes:          document.getElementById('asf-notes')?.value.trim() || ''
    };
    const list = this.shifts();
    let saved = rec;
    if (this._shiftFormId) {
      const i = list.findIndex(x => x.id === this._shiftFormId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      rec.created_at = new Date().toISOString();
      list.push(rec);
    }
    const btn = document.getElementById('asf-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'shift', saved);
    this._shiftFormId = null;
    if (ok) { if (App.markSetupDone) App.markSetupDone('gs_sc_shift'); App.closeModal('as-shift-modal'); this._reDispatch(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save Shift'; } fail('Save failed. Try again.'); }
  },

  async confirmDeleteShift(id) {
    if (!id) return;
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('sc', 'shift', id);
    this._shiftFormId = null;
    App.closeModal('as-shift-modal');
    this._reDispatch();
  },

  showHowToOpen() {
    App.showHelpModal('How Open the Floor Works', [
      { p: ['This is how you start a shift. Tap through it: pick the daypart, tap who is running it, turn on the registers in play tonight and set each bank, then open the floor. The line up top fills in as you go so you watch the shift come together.'] },
      { h: '1. Daypart', p: ['Tap the service you are opening: Brunch, Lunch, Dinner, or Late Night. Bar Cop pre-picks one by the time of day; tap another chip to change it. The daypart also sets this shift\'s cash tolerance.'] },
      { h: '2. Running It', p: ['Tap the manager on duty. The list is your managers and bartenders, the people who actually run a shift.'] },
      { h: '3. Registers', p: ['Every register you set up shows as a tile, turned on with its default bank. Tap a tile to turn it off if it is not running tonight, and type each register\'s starting cash right on the tile. Run one register or ten.'] },
      { h: '4. Floor and Tolerance', p: ['Set how many are on the floor and confirm the cash tolerance, which is how far a drawer can be off before Bar Cop flags it. Then Open the Floor and the shift goes live.'] },
      { h: 'Recent Shifts', p: ['Below the opener is every shift you have run. Log a Past Shift back-fills one you missed or ran before Bar Cop, Edit fixes any shift, and View opens its full recap. Creating, editing, and deleting shifts all happen here.'] },
      { h: 'Shift History', p: ['Shift History in the sidebar is the read-only record of every shift: filter it, open a recap, and export. The editing all happens here on Active Shift, so the history stays a clean reference. Shift revenue flows straight into Profit and Revenue Recovery, so keep it accurate.'] }
    ]);
  },

  _freshDraft() {
    const types = this.shiftTypes();
    const defType = this._daypartByTime(types);
    const drawers = {};
    ((App.shiftData && App.shiftData.sc_drawers) || []).filter(x => x.active !== false).forEach(dr => {
      drawers[dr.id] = { on: true, bank: dr.default_opening_bank != null ? dr.default_opening_bank : '' };
    });
    return { date: App.todayLocal(), shift_type: defType, manager_id: '', drawers, staff_on_floor: '', cash_tolerance: this._defaultToleranceFor(defType) };
  },

  _daypartByTime(types) {
    const h = new Date().getHours();
    let want = h < 11 ? 'Brunch' : h < 16 ? 'Lunch' : h < 22 ? 'Dinner' : 'Late Night';
    if (!types.includes(want)) want = (want === 'Brunch' && types.includes('Lunch')) ? 'Lunch' : types[0];
    return want;
  },

  // Manager-on-duty pool: staff in Management positions plus bartenders (who
  // commonly run a bar shift). Falls back to all active staff if nothing matches
  // so the picker is never empty. (A per-position "can run a shift" flag is the
  // planned upgrade.)
  modStaff() {
    const positions = (App.laborData && App.laborData.lc_positions) || [];
    const eligible = new Set(positions.filter(p =>
      (p.department || '') === 'Management' || /manager|bartender/i.test(p.name || '')
    ).map(p => p.id));
    const all = ((App.laborData && App.laborData.lc_staff) || []).filter(st => st.active !== false);
    const list = all.filter(st => eligible.has(st.position_id));
    return list.length ? list : all;
  },

  _openDrawerList() {
    const d = this._openDraft || {};
    return ((App.shiftData && App.shiftData.sc_drawers) || [])
      .filter(x => x.active !== false && d.drawers && d.drawers[x.id] && d.drawers[x.id].on)
      .map(dr => { const b = parseFloat(d.drawers[dr.id].bank); return { drawer_id: dr.id, name: dr.name, opening_bank: isNaN(b) ? 0 : b }; });
  },

  _readoutText() {
    const d = this._openDraft || {};
    const parts = [];
    if (d.shift_type) parts.push(d.shift_type);
    const mgr = d.manager_id ? (App.staffById(d.manager_id) || {}).name : '';
    if (mgr) parts.push(mgr);
    const opens = this._openDrawerList();
    if (opens.length) {
      parts.push(opens.length + ' register' + (opens.length === 1 ? '' : 's'));
      parts.push(App.fmtCurrency(opens.reduce((t, x) => t + x.opening_bank, 0)));
    }
    const staff = parseInt(d.staff_on_floor) || 0;
    if (staff) parts.push(staff + ' on floor');
    return parts.length ? parts.join('  ·  ') : 'Tap to build tonight’s shift';
  },

  setBank(id, val) {
    if (!this._openDraft) return;
    if (!this._openDraft.drawers[id]) this._openDraft.drawers[id] = { on: true, bank: '' };
    this._openDraft.drawers[id].bank = val;
    const ro = document.getElementById('of-readout');
    if (ro) ro.textContent = this._readoutText();
  },

  setTol(val) {
    if (this._openDraft) this._openDraft.cash_tolerance = val;
  },

  // Pre-fill default tolerance for the picked shift type. Reads from
  // Shift Control settings (per-shift-type → overall default → 10).
  _defaultToleranceFor(shiftType) {
    return App.cashToleranceForShift({ shift_type: shiftType });
  },

  async startShift() {
    const err = document.getElementById('as-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const d = this._openDraft || this._freshDraft();
    if (!d.date) { fail('Date is required.'); return; }
    const opens = this._openDrawerList();
    const totalBank = opens.reduce((t, x) => t + x.opening_bank, 0);
    const numTol = (() => { const n = parseFloat(d.cash_tolerance); return isNaN(n) ? null : n; })();
    const numStaff = (() => { const n = parseInt(d.staff_on_floor); return isNaN(n) ? null : n; })();

    // drawers[] is the canonical multi-register list. The single drawer_id /
    // drawer / opening_bank stay set (primary id, a summary name, the total
    // bank) so Active Shift, the close wizard, and Shift History keep working
    // until per-drawer cash recon lands in the close.
    const rec = {
      id:             App.uid(),
      date:           d.date,
      shift_type:     d.shift_type || '',
      manager_id:     d.manager_id || '',
      manager:        (App.staffById(d.manager_id) || {}).name || '',
      drawers:        opens,
      drawer_id:      opens[0] ? opens[0].drawer_id : '',
      drawer:         opens.length === 0 ? '' : opens.length === 1 ? opens[0].name : opens.length + ' registers',
      opening_bank:   opens.length ? totalBank : null,
      staff_on_floor: numStaff,
      cash_tolerance: numTol,
      bar_revenue:    0,
      floor_revenue:  0,
      total_revenue:  0,
      covers:         null,
      status:         'Open',
      notes:          '',
      shift_notes:    [],
      started_at:     new Date().toISOString(),
      created_at:     new Date().toISOString()
    };

    const btn = document.getElementById('as-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening...'; }
    this.shifts().push(rec);
    const ok = await App.putRecord('sc', 'shift', rec);
    if (ok) {
      this._openDraft = null;
      this.renderActive(rec);
    } else {
      this.shifts().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Open the Floor'; }
      fail('Could not open the shift. Try again.');
    }
  },

  // Per-shift labor so far for the active-shift dashboard. Two sources, in
  // priority order: logged lc_actuals for today's date win when present
  // (operator clocked staff in/out and logged hours during the shift).
  // Falls back to the day's scheduled labor from lc_schedules so the tile
  // still shows the budget commitment when nothing has been logged yet.
  laborSoFar(s) {
    const actuals = ((App.laborData && App.laborData.lc_actuals) || []).filter(a => a.date === s.date);
    if (actuals.length) {
      const cost = actuals.reduce((t, a) => t + (parseFloat(a.cost) || 0), 0);
      const hours = actuals.reduce((t, a) => t + (parseFloat(a.hours) || 0), 0);
      return { cost, hours, source: 'logged', count: actuals.length };
    }
    // Fall back to scheduled labor for today
    const ws = App.weekStartFor ? App.weekStartFor(s.date) : '';
    if (!ws) return { cost: 0, hours: 0, source: 'none', count: 0 };
    const sched = ((App.laborData && App.laborData.lc_schedules) || []).find(x => x.week_start === ws);
    if (!sched || !Array.isArray(sched.shifts)) return { cost: 0, hours: 0, source: 'none', count: 0 };
    // Resolve day-of-week label (Mon..Sun) for s.date
    const days = App.DAYS_MON_FIRST || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const d = new Date(s.date + 'T00:00:00');
    const wd = (d.getDay() + 6) % 7;
    const dayLabel = days[wd];
    const todays = sched.shifts.filter(sh => sh.day === dayLabel);
    const cost = todays.reduce((t, sh) => t + (parseFloat(sh.cost) || 0), 0);
    const hours = todays.reduce((t, sh) => t + (parseFloat(sh.hours) || 0), 0);
    return { cost, hours, source: 'scheduled', count: todays.length };
  },

  // ── Active shift dashboard ──────────────────────────────────────────────────
  // The registers running this shift, shown live during service: each drawer's
  // opening bank and what has been dropped from it so far. Reads s.drawers[]
  // (multi-register), falling back to the single legacy drawer for old shifts.
  registersCard(s) {
    const drawers = (Array.isArray(s.drawers) && s.drawers.length)
      ? s.drawers
      : (s.drawer_id || s.drawer ? [{ drawer_id: s.drawer_id || '', name: s.drawer || 'Register', opening_bank: s.opening_bank }] : []);
    if (!drawers.length) return '';
    const dropsByDrawer = {};
    this.byDate('sc_cash_drops', s.date).forEach(dp => {
      const k = dp.drawer_id || '';
      dropsByDrawer[k] = (dropsByDrawer[k] || 0) + (parseFloat(dp.amount) || 0);
    });
    const tiles = drawers.map(dr => {
      const dropped = dropsByDrawer[dr.drawer_id] || 0;
      return '<div style="width:165px;border:1px solid var(--b2);background:var(--input);border-radius:10px;padding:12px 14px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(dr.name || 'Register') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Opening bank <span style="color:var(--t1);font-weight:700;float:right;">' + App.fmtCurrency(dr.opening_bank || 0) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">Dropped <span style="color:var(--gold);font-weight:700;float:right;">' + App.fmtCurrency(dropped) + '</span></div>'
        + '</div>';
    }).join('');
    return '<div class="card"><div class="card-title">Registers</div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;">' + tiles + '</div></div>';
  },

  // Discard a just-opened shift (mistake on the opener). Removes the open shift
  // record and drops back onto Open the Floor with the picks rebuilt, so the
  // manager fixes the one thing and re-opens instead of logging + deleting.
  async cancelShift(s) {
    const ok = await App.confirm({ title: 'Discard this shift and go back? It will not be saved to history.', confirmText: 'Discard', cancelText: 'Keep Running' });
    if (!ok) return;
    const srcDrawers = (Array.isArray(s.drawers) && s.drawers.length)
      ? s.drawers
      : (s.drawer_id ? [{ drawer_id: s.drawer_id, opening_bank: s.opening_bank }] : []);
    const drawers = {};
    srcDrawers.forEach(dr => { drawers[dr.drawer_id] = { on: true, bank: dr.opening_bank != null ? dr.opening_bank : '' }; });
    this._openDraft = {
      date: s.date,
      shift_type: s.shift_type || '',
      manager_id: s.manager_id || '',
      drawers,
      staff_on_floor: s.staff_on_floor != null ? s.staff_on_floor : '',
      cash_tolerance: s.cash_tolerance != null ? s.cash_tolerance : this._defaultToleranceFor(s.shift_type)
    };
    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i > -1) list.splice(i, 1);
    await App.removeRecord('sc', 'shift', s.id);
    this.renderStart();
  },

  renderActive(s) {
    this.mode = 'active';
    const drops = this.byDate('sc_cash_drops', s.date);
    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const vc = this.byDate('sc_void_comps', s.date);
    const vcTotal = vc.reduce((t, r) => t + (r.amount || 0), 0);
    const active86 = ((App.shiftData && App.shiftData.sc_86_list) || []).filter(i => i.status !== 'Back').length;
    const openMaint = ((App.shiftData && App.shiftData.sc_maintenance) || []).filter(m => m.status !== 'Resolved').length;
    const labor = this.laborSoFar(s);
    const laborSub = labor.source === 'logged'
      ? labor.hours.toFixed(1) + ' hrs logged'
      : labor.source === 'scheduled'
        ? labor.hours.toFixed(1) + ' hrs scheduled'
        : 'No hours yet';

    // Cover Goal vs Covers So Far. Goal comes from this week's Revenue Forecast
    // covers_per_day for today's weekday. So-far covers come from the shift's
    // running cover total (typed during shift close, or pulled from any
    // matching server_check entries logged during shift so the floor manager
    // sees a live read).
    const goalForToday = (() => {
      if (!s.date || !App.weekStartFor || !App.DAYS_MON_FIRST) return 0;
      const ws = App.weekStartFor(s.date);
      const f = App.forecastForWeek ? App.forecastForWeek(ws) : null;
      if (!f || !f.covers_per_day) return 0;
      const dt = new Date(s.date + 'T00:00:00');
      if (isNaN(dt.getTime())) return 0;
      const idx = (dt.getDay() + 6) % 7;
      const key = App.DAYS_MON_FIRST[idx];
      return parseFloat(f.covers_per_day[key]) || 0;
    })();
    const coversSoFar = (() => {
      // Prefer the operator-typed running cover number on the shift record.
      if (s.covers != null && s.covers > 0) return parseFloat(s.covers) || 0;
      // Fall back to summing today's logged server_check entries for this
      // shift_type (live read during service when servers are logging shift
      // checks but cover total hasn't been typed on the shift yet).
      const checks = (App.data.revenue_server_checks || [])
        .filter(c => c.date === s.date && c.shift === s.shift_type);
      return checks.reduce((sum, c) => sum + (parseFloat(c.covers) || 0), 0);
    })();
    const coverProgressLabel = goalForToday > 0
      ? coversSoFar.toFixed(0) + ' of ' + goalForToday + (coversSoFar >= goalForToday ? ' (hit)' : ' (' + (goalForToday - coversSoFar).toFixed(0) + ' to goal)')
      : (coversSoFar > 0 ? coversSoFar.toFixed(0) + ' so far' : 'Set in Revenue Forecast');

    const stat = (label, val, sub) =>
      '<div style="flex:1;min-width:130px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\';font-size:30px;font-weight:600;color:var(--w);line-height:1.1;">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + sub + '</div></div>';

    const action = (id, label) =>
      '<button class="btn btn-ghost as-go" data-go="' + id + '" style="height:52px;flex:1;min-width:120px;">' + label + '</button>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
      + '<span style="width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);"></span>'
      + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Shift Running</span></div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
      + (s.manager ? 'Manager: ' + esc(s.manager) + ' &middot; ' : '')
      + (s.started_at ? 'Running ' + this.elapsed(s.started_at) : '')
      + (s.opening_bank != null ? ' &middot; Opening bank ' + App.fmtCurrency(s.opening_bank) : '') + '</div>'
      + '</div>'
      + App.helpButton('as-how')
      + '</div>'
      + '</div>'

      + this.registersCard(s)

      + '<div class="card"><div class="card-title">This Shift</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + stat('Cover Goal', goalForToday > 0 ? goalForToday + '' : '-', coverProgressLabel)
      + stat('Labor So Far', App.fmtCurrency(labor.cost), laborSub)
      + stat('Cash Drops', drops.length, App.fmtCurrency(dropTotal) + ' dropped')
      + stat('Voids &amp; Comps', vc.length, App.fmtCurrency(vcTotal) + ' total')
      + stat('86\'d Items', active86, active86 === 1 ? 'item out' : 'items out')
      + stat('Open Maint.', openMaint, openMaint === 1 ? 'issue' : 'issues')
      + '</div></div>'

      + '<div class="card"><div class="card-title">Log During This Shift</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost" id="ld-cash" style="height:52px;flex:1;min-width:120px;">Cash Drop</button>'
      + action('sc-void-comp', 'Void / Comp')
      + action('sc-waste', 'Waste / Spill')
      + action('sc-86-list', '86 an Item')
      + action('sc-maintenance', 'Maintenance')
      + '</div></div>'

      + this.renderShiftNotesCard(s)

      + '<div class="card"><div class="card-title">End of Shift</div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<button class="btn btn-primary btn-lg" id="as-end">End Shift</button>'
      + '<button class="btn btn-ghost" id="as-cancel" style="color:var(--red);">Cancel Shift</button>'
      + '</div></div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#ld-cash')) { S.ShiftCashControl.openDrop(null, '', () => this.renderActive(s)); return; }
      const go = ev.target.closest('.as-go');
      if (go) App.navigate(go.dataset.go);
      else if (ev.target.closest('#as-how')) this.showHowToActive();
      else if (ev.target.closest('#as-cancel')) this.cancelShift(s);
      else if (ev.target.closest('#as-end')) this.renderEnd(s);
      else if (ev.target.closest('#sn-add')) this.addShiftNote(s);
      else if (ev.target.closest('.sn-del')) this.removeShiftNote(s, ev.target.closest('.sn-del').dataset.id);
    };
  },

  showHowToActive() {
    App.showHelpModal('How the Running Shift Works', [
      { p: ['This is your command center while the shift is live. Everything you log during service lands on the shift and rolls into the close.'] },
      { h: 'Registers', p: ['The registers you opened sit up top with their bank and what has been dropped from each so far.'] },
      { h: 'This Shift', p: ['Live counts as the night runs: cover goal, labor so far, cash drops, voids and comps, 86\'d items, and open maintenance. The Cover Goal comes from the covers you set per day in Revenue Recovery, Revenue Forecast. Set it there and it shows here.'] },
      { h: 'Log During This Shift', p: ['Tap any of these to log it the moment it happens: a cash drop, a void or comp, waste or a spill, an 86, or a maintenance issue. Cash Drop opens right here so you never leave the shift. Each feeds its own log and the shift exceptions.'] },
      { h: 'Shift Notes', p: ['Drop timestamped notes through the night for the closer or the next manager. They flow into the Handoff Report at close.'] },
      { h: 'Ending the Shift', p: ['End Shift runs the close wizard: revenue and covers, cash count per register, exceptions, tips, and handoff notes. Cancel Shift discards the shift without saving if you opened it by mistake.'] }
    ]);
  },

  // ── Mid-shift Notes ────────────────────────────────────────────────────────
  // Operator-pain fix: the handoff_notes field only captures things at close.
  // This adds a running timestamped notebook the manager can drop notes into
  // throughout the shift. Notes flow into the Shift Handoff Report at close.
  renderShiftNotesCard(s) {
    const notes = Array.isArray(s.shift_notes) ? s.shift_notes : [];
    const fmtTime = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };
    const list = notes.length === 0
      ? '<div style="font-size:12px;color:var(--t3);">No notes yet. Drop in anything the closer or the next manager should know. Delivery short, VIP at nine, server X went home sick, weather slowing us down.</div>'
      : '<div style="display:flex;flex-direction:column;gap:8px;">'
        + notes.slice().reverse().map(n => '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;background:var(--input);border-radius:4px;">'
          + '<div style="font-size:10px;color:var(--gold);font-weight:700;letter-spacing:1px;min-width:55px;padding-top:1px;">' + esc(fmtTime(n.at)) + '</div>'
          + '<div style="flex:1;font-size:13px;color:var(--t1);line-height:1.5;white-space:pre-wrap;">' + esc(n.text || '') + '</div>'
          + '<button class="btn btn-ghost btn-sm sn-del" data-id="' + esc(n.id) + '" style="font-size:10px;padding:2px 8px;color:var(--red);">Delete</button>'
          + '</div>').join('')
      + '</div>';
    return '<div class="card"><div class="card-title">Shift Notes</div>'
      + '<div class="form-row" style="gap:10px;align-items:flex-end;margin-bottom:10px;">'
        + '<div class="f" style="flex:1;min-width:220px;margin-bottom:0;"><label>Add a Note</label>'
          + '<textarea id="sn-text" rows="2" placeholder="VIP at 9pm, delivery short on bourbon, weather slowing us down..."></textarea></div>'
        + '<div style="flex-shrink:0;"><button class="btn btn-primary" id="sn-add" style="height:48px;">Add Note</button></div>'
      + '</div>'
      + list
      + '</div>';
  },

  async addShiftNote(s) {
    const textEl = document.getElementById('sn-text');
    const text = textEl?.value.trim();
    if (!text) return;
    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) return;
    if (!Array.isArray(list[i].shift_notes)) list[i].shift_notes = [];
    list[i].shift_notes.push({
      id: App.uid(),
      at: new Date().toISOString(),
      text,
      manager_id: s.manager_id || ''
    });
    const ok = await App.putRecord('sc', 'shift', list[i]);
    if (ok) {
      if (textEl) textEl.value = '';
      this.renderActive(list[i]);
    }
  },

  async removeShiftNote(s, noteId) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) return;
    list[i].shift_notes = (list[i].shift_notes || []).filter(n => n.id !== noteId);
    const saved = await App.putRecord('sc', 'shift', list[i]);
    if (saved) this.renderActive(list[i]);
  },

  // ── Shift Close Wizard ─────────────────────────────────────────────────────
  // Five-step structured close-out so nothing slips through the cracks:
  //   1. Revenue + Covers     (bar + floor + covers, computes check avg live)
  //   2. Cash Reconciliation  (opening bank + sales - drops vs counted)
  //   3. Exception Review     (open 86s, big voids/comps, open maint, checklist)
  //   4. Tip Reconciliation   (logged vs POS reported, link to Tip Pool)
  //   5. Handoff Notes        (free text for the next manager, lands on Handoff Report)
  // Wizard state lives on this._closeDraft so steps can be revisited without
  // losing inputs. Cancel returns to Active Shift without saving anything.
  WIZARD_STEPS: [
    { key: 'revenue',    label: 'Revenue and Covers' },
    { key: 'cash',       label: 'Cash Reconciliation' },
    { key: 'exceptions', label: 'Exception Review' },
    { key: 'tips',       label: 'Tip Reconciliation' },
    { key: 'handoff',    label: 'Handoff Notes' }
  ],

  // One cash-recon row per open drawer: its opening bank plus the drops pulled
  // from it (attributed by drawer_id; any drop that does not match an open
  // drawer falls onto the first one so the totals reconcile). sales_cash and
  // counted_cash are filled in by the operator during the close.
  _initCashDrawers(s) {
    const base = (Array.isArray(s.drawers) && s.drawers.length)
      ? s.drawers.map(dr => ({ drawer_id: dr.drawer_id, name: dr.name, opening_bank: dr.opening_bank || 0 }))
      : (s.drawer_id || s.drawer ? [{ drawer_id: s.drawer_id || '', name: s.drawer || 'Register', opening_bank: s.opening_bank || 0 }] : []);
    if (!base.length) return [];
    const dropsBy = {};
    this.byDate('sc_cash_drops', s.date).forEach(dp => {
      const k = dp.drawer_id || '';
      dropsBy[k] = (dropsBy[k] || 0) + (parseFloat(dp.amount) || 0);
    });
    const known = new Set(base.map(x => x.drawer_id));
    let orphan = 0;
    Object.keys(dropsBy).forEach(k => { if (!known.has(k)) orphan += dropsBy[k]; });
    return base.map((dr, idx) => ({
      drawer_id:   dr.drawer_id,
      name:        dr.name,
      opening_bank: dr.opening_bank || 0,
      drops_total: (dropsBy[dr.drawer_id] || 0) + (idx === 0 ? orphan : 0),
      sales_cash:  null,
      counted_cash: null
    }));
  },

  renderEnd(s) {
    this.mode = 'end';
    if (!this._closeDraft || this._closeDraft.shift_id !== s.id) {
      // Initialize wizard draft from the live shift record
      this._closeDraft = {
        shift_id:      s.id,
        step:          'revenue',
        bar_revenue:   s.bar_revenue || null,
        floor_revenue: s.floor_revenue || null,
        covers:        s.covers || null,
        notes:         s.notes || '',
        // Per-drawer cash recon
        cashDrawers:   this._initCashDrawers(s),
        cash_skipped:  false,
        // Tip recon defaults
        tips_pos_reported: null,
        // Exception acknowledgments (operator-set, just so they tick through)
        ack: {},
        handoff_notes: ''
      };
    }
    this.renderWizardStep(s);
  },

  renderWizardStep(s) {
    const step = this._closeDraft.step;
    const idx  = this.WIZARD_STEPS.findIndex(x => x.key === step);
    const total = this.WIZARD_STEPS.length;

    // Reached steps are gold; the step you have completed (behind the current
    // one) is clickable with white text so you can jump straight back to it, no
    // Back button. The current step keeps dark text as the "you are here" marker.
    // Steps not yet reached stay greyed and locked.
    const stepper = '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">'
      + this.WIZARD_STEPS.map((s2, i) => {
          const done = i < idx, current = i === idx;
          const bg = (i <= idx) ? 'var(--gold)' : 'var(--b2)';
          const color = current ? 'var(--bg)' : done ? 'var(--w)' : 'var(--t3)';
          const base = 'flex:1;min-width:120px;padding:8px 10px;border-radius:3px;background:' + bg + ';color:' + color + ';font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;text-align:center;';
          if (done) return '<div class="wiz-step" data-step="' + s2.key + '" style="' + base + 'cursor:pointer;">' + (i + 1) + '. ' + s2.label + '</div>';
          return '<div style="' + base + '">' + (i + 1) + '. ' + s2.label + '</div>';
        }).join('')
    + '</div>';

    const header = '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:22px;">'
        + '<div>'
          + '<div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Closing Shift</div>'
          + '<div style="font-size:18px;font-weight:800;color:var(--t1);margin-top:2px;">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
          + (s.manager ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">Manager: ' + esc(s.manager) + '</div>' : '')
        + '</div>'
        + App.helpButton('aw-how')
      + '</div>'
      + stepper
    + '</div>';

    let body;
    if      (step === 'revenue')    body = this.stepRevenue(s);
    else if (step === 'cash')       body = this.stepCash(s);
    else if (step === 'exceptions') body = this.stepExceptions(s);
    else if (step === 'tips')       body = this.stepTips(s);
    else                            body = this.stepHandoff(s);

    this.container.innerHTML = '<div class="screen">' + header + body + '</div>';
    this.wireWizard(s);
  },

  // ── Step 1: Revenue and Covers ───────────────────────────────────────────
  stepRevenue(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    return '<div class="card"><div class="card-title">Step 1 of 5 &middot; Revenue and Covers</div>'
      + '<div class="form-row" style="gap:16px;margin-top:4px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Bar Revenue</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-bar" min="0" step="0.01" inputmode="decimal" value="' + v(d.bar_revenue) + '" style="height:48px;font-size:16px;"/></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Floor Revenue</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-floor" min="0" step="0.01" inputmode="decimal" value="' + v(d.floor_revenue) + '" style="height:48px;font-size:16px;"/></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Covers</label>'
          + '<input type="number" id="aw-covers" min="0" inputmode="numeric" value="' + v(d.covers) + '" style="height:48px;font-size:16px;"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Walkouts</label>'
          + '<input type="number" id="aw-walkouts" min="0" inputmode="numeric" value="' + v(d.walkouts) + '" placeholder="0" style="height:48px;font-size:16px;"/></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:10px;">'
        + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val good" id="aw-total">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="aw-check">-</div></div>'
      + '</div>'
      + '<div class="card-actions"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Cash Reconciliation</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>'
    + '</div>';
  },

  // ── Step 2: Cash Reconciliation ───────────────────────────────────────────
  stepCash(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    const tolerance = App.cashToleranceForShift(s);
    const cd = d.cashDrawers || [];

    let body;
    if (cd.length === 0) {
      body = '<div style="font-size:13px;color:var(--t3);padding:6px 0;">No registers were opened on this shift, so there is nothing to count. Continue to the next step.</div>';
    } else {
      const rows = cd.map((c, i) =>
        '<div style="border:1px solid var(--b2);border-radius:8px;padding:14px;margin-bottom:10px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:10px;">' + esc(c.name || 'Register') + '</div>'
        + '<div class="form-row" style="gap:12px;flex-wrap:wrap;margin-bottom:10px;">'
          + '<div class="f" style="width:118px;flex-shrink:0;"><label>Opening Bank</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" value="' + v(c.opening_bank) + '" disabled style="height:42px;"/></div></div>'
          + '<div class="f" style="width:118px;flex-shrink:0;"><label>Drops Out</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" value="' + v(c.drops_total) + '" disabled style="height:42px;"/></div></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>POS Cash Sales</label><div class="fw"><span class="pre">$</span><input class="pre aw-sales" data-i="' + i + '" type="number" min="0" step="0.01" inputmode="decimal" value="' + v(c.sales_cash) + '" placeholder="From POS" style="height:42px;"/></div></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>Counted</label><div class="fw"><span class="pre">$</span><input class="pre aw-counted-d" data-i="' + i + '" type="number" min="0" step="0.01" inputmode="decimal" value="' + v(c.counted_cash) + '" placeholder="From drawer" style="height:42px;"/></div></div>'
        + '</div>'
        + '<div style="display:flex;gap:22px;font-size:12px;color:var(--t3);">'
          + '<div>Expected <span class="aw-exp" data-i="' + i + '" style="color:var(--t1);font-weight:700;">-</span></div>'
          + '<div>Variance <span class="aw-var" data-i="' + i + '" style="font-weight:700;">-</span></div>'
        + '</div></div>').join('');
      const totals = '<div class="calc" style="margin-top:4px;">'
        + '<div class="calc-item"><div class="calc-label">Total Expected</div><div class="calc-val" id="aw-t-expected">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Counted</div><div class="calc-val" id="aw-t-counted">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Variance</div><div class="calc-val" id="aw-t-variance">-</div></div>'
        + '</div>';
      body = rows + totals
        + '<div style="margin-top:14px;"><label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" id="aw-cash-skip" ' + (d.cash_skipped ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>'
          + 'Skip cash reconciliation (drawers not counted this shift)</label></div>';
    }

    return '<div class="card"><div class="card-title">Step 2 of 5 &middot; Cash Reconciliation</div>'
      + '<div style="margin-top:4px;"></div>'
      + body
      + '<div class="card-actions"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Exception Review</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>'
    + '</div>';
  },

  // ── Step 3: Exception Review ──────────────────────────────────────────────
  stepExceptions(s) {
    const d = this._closeDraft;
    // Pull each exception category fresh so any logging the operator just
    // did mid-wizard (via Cancel and Return) reflects.
    const eighty6 = ((App.shiftData && App.shiftData.sc_86_list) || []).filter(i => i.status !== 'Back');
    const vcThreshold = 30;
    const vc = ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => r.date === s.date && (parseFloat(r.amount) || 0) >= vcThreshold);
    const openMaint = ((App.shiftData && App.shiftData.sc_maintenance) || []).filter(m => m.status !== 'Resolved');
    const closingCheck = ((App.shiftData && App.shiftData.sc_checklists) || [])
      .filter(c => c.date === s.date && (c.type || '').toLowerCase().includes('clos'))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
    // Completion % from the real saved counts (completion_pct is never persisted).
    const checklistDone = closingCheck
      ? (closingCheck.total_count ? Math.round((closingCheck.done_count || 0) / closingCheck.total_count * 100) : 0)
      : null;
    const checklistIncomplete = checklistDone != null && checklistDone < 100;

    const item = (key, count, title, sub, target, color) => {
      const ack = d.ack[key];
      const bg = count === 0 ? 'var(--input)' : ack ? 'var(--input)' : 'rgba(199,125,125,0.08)';
      const cntColor = count === 0 ? 'var(--t4)' : color;
      const ackHTML = count === 0
        ? '<span style="font-size:10px;color:var(--t4);font-weight:700;letter-spacing:1px;">CLEAR</span>'
        : '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" class="aw-ack" data-key="' + key + '" ' + (ack ? 'checked' : '') + ' style="width:14px;height:14px;accent-color:var(--gold);cursor:pointer;"/>'
          + 'Acknowledged</label>';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid var(--b2);border-radius:4px;background:' + bg + ';margin-bottom:8px;">'
        + '<div style="display:flex;align-items:center;gap:14px;">'
          + '<div style="font-size:28px;font-weight:800;color:' + cntColor + ';font-family:\'Barlow Condensed\';line-height:1;min-width:40px;text-align:center;">' + count + '</div>'
          + '<div>'
            + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(title) + '</div>'
            + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(sub) + '</div>'
          + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:14px;">'
          + ackHTML
          + (count > 0 && target ? '<button class="btn btn-ghost btn-sm aw-jump" data-target="' + esc(target) + '">Open</button>' : '')
        + '</div>'
      + '</div>';
    };

    const bigVcTotal = vc.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
    return '<div class="card"><div class="card-title">Step 3 of 5 &middot; Exception Review</div>'
      + '<div style="margin-top:4px;"></div>'
      + item('e86', eighty6.length, '86\'d Items Still Out', eighty6.length === 0 ? 'Nothing 86\'d.' : eighty6.slice(0, 3).map(i => i.item).join(', ') + (eighty6.length > 3 ? '...' : ''), 'sc-86-list', 'var(--red)')
      + item('vc',  vc.length, 'Big Voids and Comps This Shift', vc.length === 0 ? 'No voids or comps over $' + vcThreshold + '.' : 'Over $' + vcThreshold + ' threshold &middot; ' + App.fmtCurrency(bigVcTotal) + ' total', 'sc-void-comp', 'var(--red)')
      + item('mt',  openMaint.length, 'Open Maintenance Issues', openMaint.length === 0 ? 'Nothing flagged.' : openMaint.slice(0, 3).map(m => m.issue || m.item || 'Issue').join(', ') + (openMaint.length > 3 ? '...' : ''), 'sc-maintenance', 'var(--red)')
      + item('cl',  checklistIncomplete ? 1 : 0, 'Closing Checklist', !closingCheck ? 'No closing checklist run yet for tonight.' : checklistIncomplete ? checklistDone + '% complete &middot; finish before closing' : 'Complete.', 'sc-checklists', 'var(--red)')
      + '<div class="card-actions"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Tip Reconciliation</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>'
    + '</div>';
  },

  // ── Step 4: Tip Reconciliation ────────────────────────────────────────────
  // Tips logged via Labor Control roll up here. POS variance gets captured.
  // The Tip Pool Calculator is INLINE — participants pre-load from the
  // shift's logged tip entries (with hours from lc_actuals), so the operator
  // splits the pool right here without leaving the wizard. Save Pool writes
  // an lc_tip_pools record with shift_id, linking it permanently to this shift.
  stepTips(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date));
    const tipsTotal = tips.reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0);
    const tipsCash  = tips.reduce((t, r) => t + (parseFloat(r.cash_tips) || 0), 0);
    const tipsCard  = tips.reduce((t, r) => t + (parseFloat(r.card_tips) || 0), 0);

    // Hydrate the pool draft. If a saved pool already exists for this shift,
    // load it. Otherwise build from logged tips (with lc_actuals hours).
    this._ensurePoolDraft(s, tips, tipsTotal);
    const pool = d.pool;
    const savedExisting = !!pool.saved_id;

    return '<div class="card"><div class="card-title">Step 4 of 5 &middot; Tip Reconciliation</div>'
      + '<div style="margin-top:4px;"></div>'
      + '<div class="calc" style="margin-bottom:14px;">'
        + '<div class="calc-item"><div class="calc-label">Logged Cash Tips</div><div class="calc-val">' + App.fmtCurrency(tipsCash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Card Tips</div><div class="calc-val">' + App.fmtCurrency(tipsCard) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Total</div><div class="calc-val good">' + App.fmtCurrency(tipsTotal) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Entries</div><div class="calc-val">' + tips.length + '</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>POS Tips Reported</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-pos-tips" min="0" step="0.01" inputmode="decimal" value="' + v(d.tips_pos_reported) + '" placeholder="From POS" style="height:44px;font-size:15px;"/></div></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Variance vs Logged</label>'
          + '<div class="calc-val" id="aw-tip-var" style="height:44px;display:flex;align-items:center;">-</div></div>'
      + '</div>'

      // Inline Tip Pool Calculator
      + '<div style="border-top:1px solid var(--b2);margin-top:18px;padding-top:18px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
          + '<div>'
            + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Tip Pool Split</div>'
            + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (savedExisting ? 'Pool saved. Edit below to update.' : 'Splits the pool across the staff who worked this shift.') + '</div>'
          + '</div>'
        + '</div>'

        + '<div class="form-row" style="gap:16px;">'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Pool Amount</label>'
            + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-pool-amount" min="0" step="0.01" value="' + esc(pool.amount || '') + '"/></div></div>'
          + '<div class="f" style="width:170px;flex-shrink:0;"><label>Method</label>'
            + '<select id="aw-pool-method"><option value="hours"' + (pool.method === 'hours' ? ' selected' : '') + '>By Hours Worked</option>'
            + '<option value="equal"' + (pool.method === 'equal' ? ' selected' : '') + '>Equal Split</option></select></div>'
        + '</div>'

        + '<div id="aw-pool-rows" style="margin-top:8px;"></div>'
        + '<button class="btn btn-ghost btn-sm" id="aw-pool-add" style="margin-top:8px;">+ Add Participant</button>'

        + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
          + '<div class="calc-item"><div class="calc-label">Participants</div><div class="calc-val" id="aw-pool-count">0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val" id="aw-pool-hours">0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="aw-pool-alloc">$0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="aw-pool-rem">$0</div></div>'
        + '</div>'

        + '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;">'
          + '<button class="btn btn-primary btn-sm" id="aw-pool-save">' + (savedExisting ? 'Update Pool' : 'Save Pool') + '</button>'
          + '<span id="aw-pool-status" style="font-size:11px;color:var(--gold);' + (savedExisting ? '' : 'display:none;') + '">Pool saved for this shift.</span>'
          + '<span id="aw-pool-err" style="color:var(--red);font-size:12px;display:none;"></span>'
        + '</div>'
      + '</div>'

      + '<div class="card-actions"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Handoff Notes</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>'
    + '</div>';
  },

  // ── Pool draft helpers ────────────────────────────────────────────────────
  _ensurePoolDraft(s, tips, tipsTotal) {
    const d = this._closeDraft;
    if (d.pool) return; // already hydrated for this wizard run

    const existing = ((App.laborData && App.laborData.lc_tip_pools) || []).find(p => p.shift_id === s.id);
    if (existing) {
      d.pool = {
        method:        existing.method || 'hours',
        amount:        String(existing.pool_amount || ''),
        participants:  (existing.participants || []).map(p => ({ staff_id: p.staff_id, name: p.name, hours: p.hours, share: p.share })),
        saved_id:      existing.id
      };
      return;
    }

    // Fresh draft. Participants come from: tips logged for this shift (most
    // accurate — those are the tipped staff). Fall back to lc_actuals filtered
    // to this shift's date if no tips logged yet.
    const actuals = ((App.laborData && App.laborData.lc_actuals) || []).filter(a => a.date === s.date);
    const staffMap = new Map();
    tips.forEach(t => {
      if (!t.staff_id) return;
      const hrs = (t.hours != null && t.hours > 0)
        ? t.hours
        : (actuals.find(a => a.staff_id === t.staff_id) || {});
      const hoursVal = (typeof hrs === 'number') ? hrs : (hrs.hours || 0);
      if (!staffMap.has(t.staff_id)) staffMap.set(t.staff_id, { staff_id: t.staff_id, name: t.name, hours: hoursVal || 0, share: 0 });
    });
    // If no tip entries at all, fall back to staff who clocked in
    if (staffMap.size === 0) {
      actuals.forEach(a => {
        if (!a.staff_id) return;
        const staff = (App.laborData?.lc_staff || []).find(x => x.id === a.staff_id);
        staffMap.set(a.staff_id, { staff_id: a.staff_id, name: staff?.name || '', hours: a.hours || 0, share: 0 });
      });
    }

    d.pool = {
      method:        'hours',
      amount:        tipsTotal > 0 ? String(tipsTotal.toFixed(2)) : '',
      participants:  [...staffMap.values()],
      saved_id:      ''
    };
  },

  // Render the participant rows for the inline pool. Same shape as standalone
  // calculator, just wired into the wizard's IDs.
  renderPoolRows() {
    const area = document.getElementById('aw-pool-rows');
    if (!area) return;
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    const equal = pool.method === 'equal';
    const allStaff = (App.laborData?.lc_staff || []).filter(s => s.status !== 'Inactive');
    const staffOpts = sel => '<option value="">Select staff...</option>'
      + allStaff.map(s => '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');

    area.innerHTML = pool.participants.map((r, i) =>
      '<div class="aw-pool-row" data-idx="' + i + '" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:10px;border:1px solid var(--b1);border-radius:4px;margin-bottom:6px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
        + '<select class="aw-pool-staff">' + staffOpts(r.staff_id) + '</select></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Hours</label>'
        + '<input type="number" class="aw-pool-hours" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"' + (equal ? ' disabled' : '') + '/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Share</label>'
        + '<div class="aw-pool-share" style="font-size:15px;font-weight:600;font-family:\'Barlow Condensed\';color:var(--gold);padding-bottom:6px;">' + (r.share > 0 ? App.fmtCurrency(r.share) : '-') + '</div></div>'
      + '<button class="btn btn-ghost btn-sm aw-pool-remove" style="margin-bottom:6px;">Remove</button>'
      + '</div>'
    ).join('') || '<div style="font-size:11px;color:var(--t3);padding:6px 0;">No participants yet. Click + Add Participant.</div>';
  },

  collectPool() {
    const d = this._closeDraft;
    if (!d.pool) return;
    d.pool.amount = document.getElementById('aw-pool-amount')?.value || '';
    d.pool.method = document.getElementById('aw-pool-method')?.value || 'hours';
    const rows = [...document.querySelectorAll('.aw-pool-row')];
    if (rows.length) {
      d.pool.participants = rows.map(el => ({
        staff_id: el.querySelector('.aw-pool-staff')?.value || '',
        name:     (App.laborData?.lc_staff || []).find(s => s.id === (el.querySelector('.aw-pool-staff')?.value || ''))?.name || '',
        hours:    parseFloat(el.querySelector('.aw-pool-hours')?.value) || 0,
        share:    0
      }));
    }
  },

  computePoolShares() {
    const d = this._closeDraft;
    if (!d.pool) return;
    const pool = d.pool;
    const amount = parseFloat(pool.amount) || 0;
    const equal = pool.method === 'equal';
    const valid = pool.participants.filter(p => p.staff_id);
    let totalHours = 0;
    pool.participants.forEach(p => { totalHours += parseFloat(p.hours) || 0; });
    pool.participants.forEach(p => {
      if (!p.staff_id) { p.share = 0; return; }
      if (equal) p.share = valid.length > 0 ? amount / valid.length : 0;
      else {
        const h = parseFloat(p.hours) || 0;
        p.share = totalHours > 0 ? amount * (h / totalHours) : 0;
      }
    });
  },

  refreshPoolCalc() {
    this.collectPool();
    this.computePoolShares();
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    // Update share displays in-place without re-rendering the rows (preserves
    // input focus while the operator types).
    const rows = [...document.querySelectorAll('.aw-pool-row')];
    rows.forEach((el, i) => {
      const p = pool.participants[i];
      if (!p) return;
      const sh = el.querySelector('.aw-pool-share');
      if (sh) sh.textContent = p.share > 0 ? App.fmtCurrency(p.share) : '-';
    });
    const amount = parseFloat(pool.amount) || 0;
    const alloc = pool.participants.reduce((s, p) => s + (p.share || 0), 0);
    const totalHours = pool.participants.reduce((s, p) => s + (parseFloat(p.hours) || 0), 0);
    const count = pool.participants.filter(p => p.staff_id).length;
    const rem = amount - alloc;
    const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('aw-pool-count', count);
    set('aw-pool-hours', totalHours.toFixed(2).replace(/\.00$/, ''));
    set('aw-pool-alloc', App.fmtCurrency(alloc));
    set('aw-pool-rem', App.fmtCurrency(rem), Math.abs(rem) > 0.01 ? 'warn' : 'good');
  },

  async savePoolInline(s) {
    this.collectPool();
    this.computePoolShares();
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    const err = document.getElementById('aw-pool-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const amount = parseFloat(pool.amount) || 0;
    if (amount <= 0) { fail('Enter the pool amount.'); return; }
    const valid = pool.participants.filter(p => p.staff_id);
    if (valid.length === 0) { fail('Add at least one participant.'); return; }
    if (pool.method === 'hours' && valid.every(p => (parseFloat(p.hours) || 0) <= 0)) {
      fail('Enter hours for the hours-based split.'); return;
    }
    if (err) err.style.display = 'none';

    const totalHours = valid.reduce((sum, p) => sum + (parseFloat(p.hours) || 0), 0);
    const rec = {
      id:          pool.saved_id || App.uid(),
      shift_id:    s.id,
      date:        s.date,
      shift_type:  s.shift_type || '',
      method:      pool.method,
      pool_amount: amount,
      total_hours: totalHours,
      participants: valid.map(p => ({ staff_id: p.staff_id, name: p.name, hours: parseFloat(p.hours) || 0, share: p.share || 0 })),
      updated_at:  new Date().toISOString(),
      created_at:  pool.saved_id ? undefined : new Date().toISOString()
    };

    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tip_pools)) App.laborData.lc_tip_pools = [];
    const list = App.laborData.lc_tip_pools;
    if (pool.saved_id) {
      const i = list.findIndex(x => x.id === pool.saved_id);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    pool.saved_id = rec.id;

    const btn = document.getElementById('aw-pool-save');
    const status = document.getElementById('aw-pool-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    if (btn) { btn.disabled = false; btn.textContent = 'Update Pool'; }
    if (ok) {
      if (status) { status.textContent = 'Pool saved for this shift.'; status.style.display = 'inline'; }
    } else {
      fail('Save failed. Try again.');
    }
  },

  // ── Step 5: Handoff Notes + Final Close ───────────────────────────────────
  stepHandoff(s) {
    const d = this._closeDraft;
    return '<div class="card"><div class="card-title">Step 5 of 5 &middot; Handoff Notes</div>'
      + '<div class="form-row" style="gap:14px;margin-top:4px;"><div class="f" style="width:100%;"><label>Notes for the Opener</label>'
        + '<textarea id="aw-handoff" rows="5" placeholder="Restock priorities, equipment to watch, customer follow-ups, anything the opener will inherit...">' + esc(d.handoff_notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary btn-lg" id="aw-finalize">Close Shift</button>'
        + '<button class="btn btn-ghost" id="aw-cancel">Return To Shift</button>'
        + '<span id="aw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
  },

  // Stash the current step's inputs into the draft. Called on Next / Back so
  // wizard state survives navigation between steps.
  syncWizardInputs() {
    const d = this._closeDraft;
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    if (d.step === 'revenue') {
      d.bar_revenue   = num('aw-bar');
      d.floor_revenue = num('aw-floor');
      d.covers        = num('aw-covers');
      d.walkouts      = num('aw-walkouts');
    } else if (d.step === 'cash') {
      const cd = d.cashDrawers || [];
      this.container.querySelectorAll('.aw-sales').forEach(el => { const i = +el.dataset.i; if (cd[i]) { const n = parseFloat(el.value); cd[i].sales_cash = (el.value === '' || isNaN(n)) ? null : n; } });
      this.container.querySelectorAll('.aw-counted-d').forEach(el => { const i = +el.dataset.i; if (cd[i]) { const n = parseFloat(el.value); cd[i].counted_cash = (el.value === '' || isNaN(n)) ? null : n; } });
      d.cash_skipped  = !!document.getElementById('aw-cash-skip')?.checked;
    } else if (d.step === 'exceptions') {
      document.querySelectorAll('.aw-ack').forEach(c => { d.ack[c.dataset.key] = c.checked; });
    } else if (d.step === 'tips') {
      d.tips_pos_reported = num('aw-pos-tips');
    } else if (d.step === 'handoff') {
      d.handoff_notes = document.getElementById('aw-handoff')?.value || '';
    }
  },

  showHowToStep(step) {
    const M = {
      revenue: ['Step 1: Revenue and Covers', [
        { p: ['Pull these straight from your POS end-of-shift report.'] },
        { h: 'What To Enter', p: ['Bar Revenue and Floor Revenue split your sales; together they are the total that feeds your weekly Profit and Revenue numbers. Covers is how many guests you served. Walkouts is parties that came in but left without ordering, usually because the wait was too long, a real lost-cover signal for capacity planning.'] },
        { h: 'Check Average', p: ['Bar Cop divides total revenue by covers and shows the check average live as you type.'] }
      ]],
      cash: ['Step 2: Cash Reconciliation', [
        { p: ['Count each register that ran this shift.'] },
        { h: 'Per Register', p: ['Opening bank and drops are filled in for you from what you opened with and dropped during the shift. Enter the POS cash sales for that register and what you physically counted in the drawer. Bar Cop shows Expected (opening + sales minus drops) and the Variance against it, per drawer and as a total.'] },
        { h: 'Tolerance And Logging', p: ['Each drawer is judged against your cash tolerance from Cash Tolerances. Any drawer outside tolerance auto-logs to the Variance Log when you close, so you never re-enter it. Tick Skip if the drawers were not counted this shift.'] }
      ]],
      exceptions: ['Step 3: Exception Review', [
        { p: ['A last look at the loose ends before you close.'] },
        { h: 'The Lines', p: ['86\'d items still out, big voids and comps this shift, open maintenance issues, and the closing checklist. A line in red means there is something to look at.'] },
        { h: 'Open And Acknowledge', p: ['Open any line to investigate or fix it on its own screen, then come right back. Tick Acknowledged once you have eyes on it. Acknowledgments save with the shift so the record shows you reviewed them.'] }
      ]],
      tips: ['Step 4: Tip Reconciliation', [
        { p: ['Reconcile tips and split the pool without leaving the close.'] },
        { h: 'Logged vs POS', p: ['Tips logged in Labor Control for this shift roll up here. Enter the total your POS reported so Bar Cop can show any variance.'] },
        { h: 'Split The Pool', p: ['The inline pool calculator pre-loads the shift\'s tipped staff and their hours. Pick split by hours or equal, then Save Pool. It writes a tip pool tied to this shift, which the Books Form 8027 worksheet reads later.'] }
      ]],
      handoff: ['Step 5: Handoff Notes', [
        { p: ['The last word for whoever opens next.'] },
        { h: 'What To Write', p: ['Restock priorities, equipment to watch, customer follow-ups, anything the opener inherits. These notes, plus your timestamped shift notes, print on the Shift Handoff Report.'] },
        { h: 'Closing', p: ['Close Shift saves the revenue, logs any cash variance, and writes these notes to the shift. The Handoff Report is ready to save on the next screen.'] }
      ]]
    };
    const m = M[step] || M.revenue;
    App.showHelpModal(m[0], m[1]);
  },

  wireWizard(s) {
    const d = this._closeDraft;
    document.getElementById('aw-how')?.addEventListener('click', () => this.showHowToStep(d.step));
    document.getElementById('aw-cancel')?.addEventListener('click', () => {
      this._closeDraft = null;
      this.renderActive(s);
    });
    document.getElementById('aw-next')?.addEventListener('click', () => {
      this.syncWizardInputs();
      const idx = this.WIZARD_STEPS.findIndex(x => x.key === d.step);
      d.step = this.WIZARD_STEPS[Math.min(idx + 1, this.WIZARD_STEPS.length - 1)].key;
      this.renderWizardStep(s);
    });
    // Jump straight to any completed step by clicking its pill (syncs current
    // inputs first so nothing entered is lost). Replaces the Back button.
    this.container.querySelectorAll('.wiz-step').forEach(el => el.addEventListener('click', () => {
      this.syncWizardInputs();
      d.step = el.dataset.step;
      this.renderWizardStep(s);
    }));
    document.getElementById('aw-finalize')?.addEventListener('click', () => {
      this.syncWizardInputs();
      this.finalizeClose(s);
    });

    // Step 1: live calc strip
    if (d.step === 'revenue') {
      const recalc = () => {
        const num = id => parseFloat(document.getElementById(id)?.value) || 0;
        const total = num('aw-bar') + num('aw-floor');
        const covers = num('aw-covers');
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('aw-total', App.fmtCurrency(total));
        set('aw-check', covers > 0 ? App.fmtCurrency(total / covers) : '-');
      };
      ['aw-bar','aw-floor','aw-covers'].forEach(fid =>
        document.getElementById(fid)?.addEventListener('input', recalc));
      recalc();
    }

    // Step 2: live per-drawer cash recon calc
    if (d.step === 'cash') {
      const cd = d.cashDrawers || [];
      const tol = App.cashToleranceForShift(s);
      const recalc = () => {
        const skipped = !!document.getElementById('aw-cash-skip')?.checked;
        let tExp = 0, tCnt = 0, tVar = 0, anyCounted = false;
        cd.forEach((c, i) => {
          const salesEl = this.container.querySelector('.aw-sales[data-i="' + i + '"]');
          const cntEl   = this.container.querySelector('.aw-counted-d[data-i="' + i + '"]');
          const sales = parseFloat(salesEl?.value) || 0;
          const cntStr = cntEl ? cntEl.value : '';
          const counted = parseFloat(cntStr) || 0;
          const countedEntered = cntEl && cntStr !== '' && !isNaN(parseFloat(cntStr));
          c.sales_cash = (salesEl && salesEl.value !== '' && !isNaN(parseFloat(salesEl.value))) ? sales : null;
          c.counted_cash = countedEntered ? counted : null;
          const expected = (c.opening_bank || 0) + sales - (c.drops_total || 0);
          const variance = counted - expected;
          const expEl = this.container.querySelector('.aw-exp[data-i="' + i + '"]');
          if (expEl) expEl.textContent = App.fmtCurrency(expected);
          const varEl = this.container.querySelector('.aw-var[data-i="' + i + '"]');
          if (varEl) {
            if (skipped || !countedEntered) { varEl.textContent = '-'; varEl.style.color = 'var(--t4)'; }
            else { varEl.textContent = (variance >= 0 ? '+' : '') + App.fmtCurrency(variance); varEl.style.color = Math.abs(variance) <= tol ? 'var(--gold)' : 'var(--red)'; }
          }
          tExp += expected;
          if (countedEntered) { tCnt += counted; tVar += variance; anyCounted = true; }
        });
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('aw-t-expected', App.fmtCurrency(tExp));
        set('aw-t-counted', (anyCounted && !skipped) ? App.fmtCurrency(tCnt) : '-');
        const tvEl = document.getElementById('aw-t-variance');
        if (tvEl) {
          if (skipped || !anyCounted) { tvEl.textContent = '-'; tvEl.style.color = ''; }
          else { tvEl.textContent = (tVar >= 0 ? '+' : '') + App.fmtCurrency(tVar); tvEl.style.color = Math.abs(tVar) <= tol ? 'var(--gold)' : 'var(--red)'; }
        }
      };
      this.container.querySelectorAll('.aw-sales, .aw-counted-d').forEach(el => el.addEventListener('input', recalc));
      const skipEl = document.getElementById('aw-cash-skip');
      if (skipEl) { skipEl.addEventListener('input', recalc); skipEl.addEventListener('change', recalc); }
      recalc();
    }

    // Step 3: jump to source screens. Cancel the wizard draft so the operator
    // doesn't lose state — they'll come right back to the wizard from Active.
    if (d.step === 'exceptions') {
      this.container.querySelectorAll('.aw-jump').forEach(b => b.addEventListener('click', () => {
        App.navigate(b.dataset.target);
      }));
    }

    // Step 4: live tip variance + inline Tip Pool calculator
    if (d.step === 'tips') {
      const recalcVar = () => {
        const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date));
        const tipsTotal = tips.reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0);
        const pos = parseFloat(document.getElementById('aw-pos-tips')?.value) || 0;
        const variance = pos - tipsTotal;
        const el = document.getElementById('aw-tip-var');
        if (el) {
          el.textContent = pos > 0 ? (variance >= 0 ? '+' : '') + App.fmtCurrency(variance) : '-';
          el.style.color = pos > 0 ? (Math.abs(variance) < 5 ? 'var(--gold)' : 'var(--red)') : '';
        }
      };
      document.getElementById('aw-pos-tips')?.addEventListener('input', recalcVar);
      recalcVar();

      // Inline pool calculator wiring
      this.renderPoolRows();
      this.refreshPoolCalc();

      // Pool inputs delegate listeners (per-row + amount/method)
      const rowsEl = document.getElementById('aw-pool-rows');
      rowsEl?.addEventListener('input', () => this.refreshPoolCalc());
      rowsEl?.addEventListener('change', () => this.refreshPoolCalc());
      rowsEl?.addEventListener('click', ev => {
        if (ev.target.closest('.aw-pool-remove')) {
          this.collectPool();
          d.pool.participants.splice(parseInt(ev.target.closest('.aw-pool-row').dataset.idx, 10), 1);
          this.renderPoolRows();
          this.refreshPoolCalc();
        }
      });
      document.getElementById('aw-pool-add')?.addEventListener('click', () => {
        this.collectPool();
        d.pool.participants.push({ staff_id: '', name: '', hours: 0, share: 0 });
        this.renderPoolRows();
        this.refreshPoolCalc();
      });
      document.getElementById('aw-pool-amount')?.addEventListener('input', () => this.refreshPoolCalc());
      document.getElementById('aw-pool-method')?.addEventListener('change', () => {
        d.pool.method = document.getElementById('aw-pool-method').value;
        this.renderPoolRows();
        this.refreshPoolCalc();
      });
      document.getElementById('aw-pool-save')?.addEventListener('click', () => this.savePoolInline(s));
    }
  },

  // Final commit: write everything to the shift record, auto-log cash variance
  // if there is one, then land on the closed-shift screen which links to the
  // Handoff Report (Chunk D).
  async finalizeClose(s) {
    const d = this._closeDraft;
    const err = document.getElementById('aw-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) { this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div')); return; }

    const bar = d.bar_revenue || 0, floor = d.floor_revenue || 0;
    const tol = App.cashToleranceForShift(s);

    // Per-drawer cash recon: expected = opening bank + POS cash sales - drops, per drawer.
    const reconDrawers = (d.cashDrawers || []).map(c => {
      const expected = (c.opening_bank || 0) + (c.sales_cash || 0) - (c.drops_total || 0);
      const counted = (!d.cash_skipped && c.counted_cash != null) ? c.counted_cash : null;
      const variance = counted != null ? (counted - expected) : null;
      const status = d.cash_skipped ? 'Skipped' : counted == null ? 'Not Counted'
        : Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over';
      return { drawer_id: c.drawer_id, name: c.name, opening_bank: c.opening_bank || 0, drops_total: c.drops_total || 0, sales_cash: c.sales_cash, counted_cash: counted, expected, variance, status };
    });
    const anySales = reconDrawers.some(c => c.sales_cash != null);
    const anyCounted = !d.cash_skipped && reconDrawers.some(c => c.counted_cash != null);
    const tExpected = reconDrawers.reduce((t, c) => t + (c.expected || 0), 0);
    const tVariance = anyCounted ? reconDrawers.reduce((t, c) => t + (c.variance || 0), 0) : null;

    const snapshot = { ...list[i] };
    list[i] = {
      ...list[i],
      bar_revenue:   bar,
      floor_revenue: floor,
      total_revenue: bar + floor,
      covers:        d.covers,
      walkouts:      d.walkouts,
      notes:         d.notes || '',
      handoff_notes: d.handoff_notes || '',
      cash_recon: {
        skipped:      d.cash_skipped,
        drawers:      reconDrawers,
        opening_bank: reconDrawers.reduce((t, c) => t + (c.opening_bank || 0), 0),
        drops_total:  reconDrawers.reduce((t, c) => t + (c.drops_total || 0), 0),
        sales_cash:   anySales ? reconDrawers.reduce((t, c) => t + (c.sales_cash || 0), 0) : null,
        counted_cash: anyCounted ? reconDrawers.reduce((t, c) => t + (c.counted_cash || 0), 0) : null,
        expected:     tExpected,
        variance:     tVariance
      },
      tip_recon: {
        logged_total: ((App.laborData && App.laborData.lc_tips) || [])
          .filter(t => t.shift_id === s.id || t.date === s.date)
          .reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0),
        pos_reported: d.tips_pos_reported,
        variance:     d.tips_pos_reported != null ? (d.tips_pos_reported - ((App.laborData && App.laborData.lc_tips) || [])
          .filter(t => t.shift_id === s.id || t.date === s.date)
          .reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0)) : null
      },
      exception_ack: d.ack || {},
      status:        'Closed',
      closed_at:     new Date().toISOString()
    };

    // Auto-log each counted drawer's variance to sc_variances so Cash
    // Reconciliation in Profit Recovery and the Variance Log get the count
    // without re-entry. One record per drawer that was actually counted.
    const variancesLogged = [];
    if (!d.cash_skipped) {
      if (!Array.isArray(App.shiftData.sc_variances)) App.shiftData.sc_variances = [];
      reconDrawers.forEach(c => {
        if (c.counted_cash == null) return;
        const vrec = {
          id:            App.uid(),
          date:          s.date,
          shift_type:    s.shift_type || 'Close',
          drawer_id:     c.drawer_id || '',
          drawer:        c.name || '',
          cashier_id:    s.manager_id || '',
          cashier:       s.manager || '',
          expected_cash: c.expected,
          counted_cash:  c.counted_cash,
          variance:      c.variance,
          tolerance:     tol,
          status:        Math.abs(c.variance) <= tol ? 'Within Tolerance' : c.variance < 0 ? 'Short' : 'Over',
          reason:        '',
          notes:         'Auto-logged from Shift Close wizard',
          source:        'shift-close',
          source_id:     s.id,
          created_at:    new Date().toISOString()
        };
        App.shiftData.sc_variances.push(vrec);
        variancesLogged.push(vrec);
      });
      if (variancesLogged.length) list[i].cash_recon.variance_log_ids = variancesLogged.map(v => v.id);
    }

    const btn = document.getElementById('aw-finalize');
    if (btn) { btn.disabled = true; btn.textContent = 'Closing...'; }
    let ok = await App.putRecord('sc', 'shift', list[i]);
    if (ok) {
      for (const vrec of variancesLogged) { ok = await App.putRecord('sc', 'variance', vrec); if (!ok) break; }
    }
    if (ok) {
      this._closeDraft = null;
      this.renderClosed(list[i]);
    } else {
      list[i] = snapshot;
      if (variancesLogged.length) {
        const ids = new Set(variancesLogged.map(v => v.id));
        App.shiftData.sc_variances = App.shiftData.sc_variances.filter(v => !ids.has(v.id));
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Close Shift'; }
      fail('Could not close the shift. Try again.');
    }
  },

  renderClosed(s) {
    const cv = s.cash_recon ? s.cash_recon.variance : null;
    const cashLine = (cv == null) ? ''
      : '<div style="font-size:11px;color:' + (Math.abs(cv) <= App.cashToleranceForShift(s) ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;margin-top:6px;">'
        + 'Cash variance ' + (cv >= 0 ? '+' : '') + App.fmtCurrency(cv) + ' &middot; auto-logged to Variance Log</div>';
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Shift Closed</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date)
      + ' &middot; ' + App.fmtCurrency(s.total_revenue || 0) + ' revenue'
      + (s.covers ? ' &middot; ' + s.covers + ' covers' : '') + '</div>'
      + cashLine
      + '</div>'
      + '<div class="card-actions" style="justify-content:center;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="ac-handoff" data-shift-id="' + esc(s.id) + '">Save Handoff PDF</button>'
      + '<button class="btn btn-ghost" id="ac-start">Start Another Shift</button>'
      + '<button class="btn btn-ghost" id="ac-history">View Shift History</button>'
      + '</div></div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#ac-start')) this.renderStart();
      else if (ev.target.closest('#ac-history')) App.navigate('sc-shift-history');
      else if (ev.target.closest('#ac-handoff')) {
        if (S.ShiftHandoff && S.ShiftHandoff.openForShift) S.ShiftHandoff.openForShift(s.id);
        else App.navigate('sc-shift-history');
      }
    };
  }
};
