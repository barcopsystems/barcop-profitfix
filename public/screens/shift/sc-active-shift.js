'use strict';

/* ── Shift Control — Active Shift (writes sc_shifts) ──────────────────────────
   Mobile-first live shift command center. Start a shift, then a running view
   with this-shift activity (cash drops, voids/comps, 86s) and one-tap links to
   log them. End Shift captures revenue and covers and closes the sc_shifts
   record — the same record the rest of the platform reads for weekly revenue. */

S.ShiftActiveShift = {
  mode: null,
  _lastTipMode: null,   // remembers the Step 4 choice across shifts this session

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
  fmtClock(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  // In-card section helpers for the running-shift view: one card holds several
  // labeled sub-sections separated by full-bleed dividers (less cardy than one
  // card per section). Divider uses -20px to reach the card edges (card pad 20).
  subLabel(text) {
    return '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + text + '</div>';
  },
  sectionDivider() {
    return '<div style="border-top:1px solid var(--b2);margin:20px -20px;"></div>';
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const act = this.active();
    this.mode = act ? 'active' : 'start';
    if (act) this.renderActive(act);
    else this.renderStart();
  },

  // Dismissible theft-flag warning for the manager opening the floor. Reads the
  // same recent-flags list as the Hub alert (S.TheftRisk.recentFlags). Severe
  // flags ignore the dismiss (acknowledge-but-don't-hide); the rest clear once
  // dismissed (a date stamp in App.data.theft_flags_ack) until a newer flag.
  _theftFlagWarning() {
    if (!(window.S && S.TheftRisk && S.TheftRisk.recentFlags)) return '';
    const wk = new Date(); wk.setDate(wk.getDate() - 6);
    const flags = S.TheftRisk.recentFlags(App.ymdLocal(wk));
    if (!flags.length) return '';
    const ack = (App.data && App.data.theft_flags_ack) || '';
    const active = flags.filter(f => f.severe || f.date > ack);
    if (!active.length) return '';
    const severe = active.filter(f => f.severe).length;
    return '<div class="no-print" style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:200px;font-size:13px;color:var(--t1);"><strong>' + active.length + ' theft flag' + (active.length === 1 ? '' : 's') + ' from recent shifts'
      + (severe ? ', ' + severe + ' to act on now' : '') + '.</strong> Worth a look before you open.</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="of-theft-review">Review</button>'
      + '<button class="btn btn-ghost btn-sm" id="of-theft-dismiss">Dismiss</button>'
      + '</div></div>';
  },

  // ── Start a shift ───────────────────────────────────────────────────────────
  // ── Open the Floor — the visual shift opener ────────────────────────────────
  // Tap a daypart, tap who's running it, tap the registers running this shift (each
  // shows its bank), set staff + tolerance, open. The live readout assembles the
  // shift as you go. State lives in this._openDraft; taps re-render, the bank /
  // tolerance inputs update the draft in place so focus survives typing.
  renderStart() {
    if (!this._openDraft) this._openDraft = this._freshDraft();
    const d = this._openDraft;
    // Cash tolerance is read-only on the opener: always the current Shift Policies
    // value for the picked daypart (changed via the Edit button -> Shift Policies),
    // so it also refreshes after a round-trip to that page.
    d.cash_tolerance = this._defaultToleranceFor(d.shift_type);
    const lbl = 'font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;';
    const types = this.shiftTypes();
    const activeDrawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(x => x.active !== false);
    const mods = this.modStaff();
    const initials = nm => (nm || '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

    const chips = types.map(t =>
      '<button class="of-chip" data-type="' + esc(t) + '" style="padding:9px 16px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
      + (d.shift_type === t ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);' : 'background:var(--input);border:1px solid var(--b1);color:var(--t2);')
      + '">' + esc(t) + '</button>').join('');

    const modChips = mods.length
      ? mods.map(st =>
          '<button class="of-mod" data-mgr="' + esc(st.id) + '" style="display:inline-flex;align-items:center;gap:8px;padding:7px 14px 7px 8px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
          + (d.manager_id === st.id ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);' : 'background:var(--input);border:1px solid var(--b1);color:var(--t2);')
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
              + (on ? 'border:1px solid var(--gold-tint-bord);background:var(--gold-tint);' : 'border:1px solid var(--b1);background:var(--input);opacity:0.6;') + '">'
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

    this.container.innerHTML = '<div class="screen">' + this._theftFlagWarning() + '<div class="card form-card no-print">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div>'
      + '<div style="font-size:18px;font-weight:800;color:var(--t1);letter-spacing:0.3px;">Open the Floor</div>'
      + '<div id="of-readout" style="font-size:13px;color:var(--gold);font-weight:600;margin-top:4px;min-height:18px;">' + esc(this._readoutText()) + '</div>'
      + '</div></div>'

      + '<div style="margin-top:20px;"><div style="' + lbl + '">Daypart</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + chips + '</div></div>'

      + '<div style="margin-top:18px;"><div style="' + lbl + '">Running It</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + modChips + '</div></div>'

      + '<div style="margin-top:18px;"><div style="' + lbl + '">Registers <span style="color:var(--t3);font-weight:400;text-transform:none;letter-spacing:0;">tap the ones running this shift, set each bank</span></div>'
      + regsHtml + '</div>'

      + '<div style="margin-top:18px;display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end;">'
      + '<div><div style="' + lbl + '">Staff on Floor</div>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="of-staff-minus" style="width:34px;">&minus;</button>'
      + '<span style="font-size:18px;font-weight:800;color:var(--t1);min-width:24px;text-align:center;">' + (parseInt(d.staff_on_floor) || 0) + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="of-staff-plus" style="width:34px;">+</button></div></div>'
      + '<div><div style="' + lbl + '">Cash Tolerance</div>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<span style="font-size:18px;font-weight:800;color:var(--t1);">' + (d.cash_tolerance != null && d.cash_tolerance !== '' ? App.fmtCurrency(parseFloat(d.cash_tolerance)) : '-') + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="of-tol-edit">Edit</button>'
      + '</div></div>'
      + '</div>'

      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary btn-lg" id="as-start">Open the Floor</button>'
      + '<button class="btn btn-ghost" id="rs-log">Log a Past Shift</button>'
      + '<span id="as-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + this.recentShiftsCard()
      + '</div>';

    this.container.onclick = ev => {
      const chip = ev.target.closest('.of-chip');
      const mod = ev.target.closest('.of-mod');
      const tile = ev.target.closest('.reg-tile');
      if (ev.target.closest('#of-add-drawers')) { App.navigate('sc-drawers'); return; }
      if (ev.target.closest('#of-tol-edit')) { App.navigate('sc-shift-policies'); return; }
      if (ev.target.closest('#of-theft-review')) { App.openScreen('theft-risk'); return; }
      if (ev.target.closest('#of-theft-dismiss')) { App.data.theft_flags_ack = App.todayLocal(); App.saveKey('theft_flags_ack'); this.renderStart(); return; }
      if (ev.target.closest('#rs-log')) { this.showShiftForm(null); return; }
      if (ev.target.closest('#rs-export')) { App.exportPDF({ title: 'Recent Shifts', root: this.container }); return; }
      const rsEdit = ev.target.closest('.rs-edit');
      if (rsEdit) { this.showShiftForm(rsEdit.dataset.id); return; }
      const rsView = ev.target.closest('.rs-view');
      if (rsView) { S.ShiftHistory._openDetailId = rsView.dataset.id; App.navigate('sc-shift-history'); return; }
      if (ev.target.closest('#rs-older')) { this._rsShow = (this._rsShow || this.RS_PAGE) + this.RS_PAGE; this.renderStart(); return; }
      const rsChip = ev.target.closest('.rs-range-chip');
      if (rsChip) {
        const val = rsChip.dataset.v;
        if (val === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this._rsFrom = ''; this._rsTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = val; this._rsFrom = ''; this._rsTo = ''; }
        this._rsShow = this.RS_PAGE; this.renderStart(); return;
      }
      if (chip) { d.shift_type = chip.dataset.type; this.renderStart(); return; }
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
    document.getElementById('rs-from')?.addEventListener('change', e => { this._rsFrom = e.target.value || ''; this._rsShow = this.RS_PAGE; this.renderStart(); });
    document.getElementById('rs-to')?.addEventListener('change', e => { this._rsTo = e.target.value || ''; this._rsShow = this.RS_PAGE; this.renderStart(); });
  },

  // ── Recent Shifts (opener-state command center: view/edit/log past shifts) ──
  // A single row of time-range chips (Export on the right) sits above the .data-card
  // rows. Custom reveals a bare From/To. Time is the only filter (the Labor model).
  // Log a Past Shift lives below the opener card. Shift History stays the read-only
  // archive.
  _rsFrom: '',             // custom range only
  _rsTo: '',               // custom range only
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  RS_PAGE: 50,
  _rsShow: 50,
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],
  // Effective date window from the active range chip (Custom reads From/To).
  _rsRange() {
    if (this.filterPreset === 'custom') return { from: this._rsFrom, to: this._rsTo };
    return App.datePresetRange(this.filterPreset);
  },
  recentShiftsCard() {
    const all = [...this.shifts()].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    const { from, to } = this._rsRange();
    const list = all.filter(s => {
      const date = s.date || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
    // Paginate: show the most recent RS_PAGE, then a Show older button reveals more.
    const show = this._rsShow || this.RS_PAGE;
    const limited = list.slice(0, show);

    // Range chips on the left, Export on the right (no filter card). Picking Custom
    // reveals a bare From/To row beneath the chips.
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'rs-range-chip');
    const card = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="rs-export">Export PDF</button></div>'
      + '</div>'
      + (this.filterPreset !== 'custom' ? '' :
          '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
          + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="rs-from" value="' + esc(this._rsFrom) + '"/></div>'
          + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="rs-to" value="' + esc(this._rsTo) + '"/></div>'
          + '</div>');

    let below;
    if (!all.length) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No shifts yet. Open the floor above, or log a past shift.</div>';
    } else if (!limited.length) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No shifts in this range. Pick a wider range above.</div>';
    } else {
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
      below = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
      if (list.length > limited.length) {
        below += '<div style="text-align:center;padding:14px 0 4px;"><button class="btn btn-ghost btn-sm" id="rs-older">Show older</button></div>';
      }
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
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">' + (id ? 'Edit Shift' : 'Log a Past Shift') + '</div>'
      + this.shiftFormRows(s)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="asf-save">' + (id ? 'Update' : 'Save Shift') + '</button>'
      + '<button class="btn btn-ghost" id="asf-cancel">Cancel</button>'
      + '<span id="asf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + (id ? '<button class="btn btn-danger" id="asf-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id: 'as-shift-modal', maxWidth: 540, noClose: true });
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
    // One flex-wrap row of all ten cells. In the narrow-form modal each cell is
    // forced to half-width, so an even count flows into clean 2-up rows with no
    // orphaned cell. Order is paired for sense: date/type, the two revenues,
    // manager/covers, bank/staff, walkouts/status.
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:140px;"><label>Date</label><input type="date" id="asf-date" value="' + esc(s?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:130px;"><label>Shift Type</label><select id="asf-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="asf-bar" step="0.01" value="' + v(s?.bar_revenue) + '" oninput="S.ShiftActiveShift.calcShiftForm()"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Floor Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="asf-floor" step="0.01" value="' + v(s?.floor_revenue) + '" oninput="S.ShiftActiveShift.calcShiftForm()"/></div></div>'
      + '<div class="f" style="flex:1;min-width:160px;"><label>Manager on Duty</label><select id="asf-mgr">' + App.staffOptions(s?.manager_id || s?.manager, { placeholder: 'Select staff...', audience: 'supervisor' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Covers</label><input type="number" id="asf-covers" min="0" value="' + v(s?.covers) + '" oninput="S.ShiftActiveShift.calcShiftForm()"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Opening Bank</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="asf-bank" step="0.01" value="' + v(s?.opening_bank != null ? s.opening_bank : defaultBank) + '"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Staff on Floor</label><input type="number" id="asf-staff" min="0" value="' + v(s?.staff_on_floor) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Walkouts</label><input type="number" id="asf-walkouts" min="0" value="' + v(s?.walkouts) + '" placeholder="0"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Status</label><select id="asf-status"><option' + (s && s.status === 'Open' ? ' selected' : '') + '>Open</option><option' + (!s || s.status !== 'Open' ? ' selected' : '') + '>Closed</option></select></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:6px;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="asf-total">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="asf-checkavg">-</div></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label><textarea id="asf-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div>';
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

  // The nav "i" routes here; dispatch to the directions for the current view.
  showHowTo() {
    if (this.mode === 'end' && this._closeDraft) return this.showHowToStep(this._closeDraft.step);
    if (this.mode === 'active') return this.showHowToActive();
    return this.showHowToOpen();
  },

  showHowToOpen() {
    App.showHelpModal('How Open the Floor Works', [
      { p: ['This is how you start a shift. Tap through it: pick the daypart, tap who is running it, turn on the registers in play tonight and set each bank, then open the floor. The line up top fills in as you go so you watch the shift come together.'] },
      { h: 'Theft flags before you open', p: ['If recent shifts threw theft flags, a banner sits at the top of the opener with the count and how many need acting on now. Tap Review to jump to Theft Risk and dig in, or Dismiss to clear it for the day. A flag serious enough to act on stays put even after you dismiss, so it does not slip past you.'] },
      { h: '1. Daypart', p: ['Tap the service you are opening: Brunch, Lunch, Dinner, or Late Night. Bar Cop pre-picks one by the time of day; tap another chip to change it. The daypart also sets this shift\'s cash tolerance.'] },
      { h: '2. Running It', p: ['Tap the manager on duty. The list is your managers and bartenders, the people who actually run a shift.'] },
      { h: '3. Registers', p: ['Every register you set up shows as a tile, turned on with its default bank. Tap a tile to turn it off if it is not running tonight, and type each register\'s starting cash right on the tile. Run one register or ten.'] },
      { h: '4. Floor and Tolerance', p: ['Set how many are on the floor. The cash tolerance, how far a drawer can be off before Bar Cop flags it, comes from the daypart you picked on your Shift Policies page and is shown here; tap Edit to change it there. Then Open the Floor and the shift goes live.'] },
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
    // Pick the operator's service period whose time window contains now.
    const p = App.servicePeriodByTime ? App.servicePeriodByTime() : null;
    if (p && types.includes(p.name)) return p.name;
    return types[0] || '';
  },

  // Manager-on-duty pool: the supervisor audience (Management department + staff
  // flagged Shift Lead on the roster — see App.isSupervisor). Falls back to all
  // active staff if nothing qualifies so the picker is never empty.
  modStaff() {
    const all = ((App.laborData && App.laborData.lc_staff) || []).filter(st => st.status !== 'Inactive');
    const list = all.filter(st => App.isSupervisor(st));
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
  // Register tiles (sub-section content; the card wrapper + label live in renderActive).
  registersTiles(s) {
    const drawers = (Array.isArray(s.drawers) && s.drawers.length)
      ? s.drawers
      : (s.drawer_id || s.drawer ? [{ drawer_id: s.drawer_id || '', name: s.drawer || 'Register', opening_bank: s.opening_bank }] : []);
    if (!drawers.length) return '';
    const dropsByDrawer = {};
    this.byDate('sc_cash_drops', s.date).forEach(dp => {
      const k = dp.drawer_id || '';
      dropsByDrawer[k] = (dropsByDrawer[k] || 0) + (parseFloat(dp.amount) || 0);
    });
    return drawers.map(dr => {
      const dropped = dropsByDrawer[dr.drawer_id] || 0;
      return '<div style="width:165px;border:1px solid var(--b2);background:var(--input);border-radius:10px;padding:12px 14px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(dr.name || 'Register') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Opening bank <span style="color:var(--t1);font-weight:700;float:right;">' + App.fmtCurrency(dr.opening_bank || 0) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">Dropped <span style="color:var(--gold);font-weight:700;float:right;">' + App.fmtCurrency(dropped) + '</span></div>'
        + '</div>';
    }).join('');
  },

  // Discard a just-opened shift (mistake on the opener). Removes the open shift
  // record and drops back onto Open the Floor with the picks rebuilt, so the
  // manager fixes the one thing and re-opens instead of logging + deleting.
  async cancelShift(s) {
    const ok = await App.confirm({ title: 'Cancel this shift?', message: 'If you cancel this shift, it will not be saved and you will go back to open the floor. Cancel with caution.', confirmText: 'Cancel Shift', cancelText: 'Keep Running' });
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
    this._closeDraft = null;
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

    // Cover Goal: this shift's target from the Revenue Forecast (the daypart's
    // slice of the day's cover number, or the whole-day number when there's no
    // daypart history). Shown as a static target, not a live tracker: covers are
    // only entered at close, so there is no live "covers so far" to count up.
    const cg = this.coverGoalFor(s);
    const goalForToday = cg.goal;
    const coverGoalLabel = goalForToday > 0
      ? (cg.daypart ? 'This shift\'s target' : 'Whole-day goal')
      : 'Set in Revenue Forecast';

    const stat = (label, val, sub) =>
      '<div style="flex:1;min-width:130px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\';font-size:30px;font-weight:600;color:var(--w);line-height:1.1;">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + sub + '</div></div>';

    const regTiles = this.registersTiles(s);
    const regSection = regTiles
      ? this.sectionDivider() + this.subLabel('Registers')
        + '<div style="display:flex;gap:12px;flex-wrap:wrap;">' + regTiles + '</div>'
      : '';

    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
      + '<span style="width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);"></span>'
      + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Shift Running</span></div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
      + (s.manager ? 'Manager: ' + esc(s.manager) + ' &middot; ' : '')
      + (s.started_at ? 'Opened ' + this.fmtClock(s.started_at) : '')
      + (s.opening_bank != null ? ' &middot; Opening bank ' + App.fmtCurrency(s.opening_bank) : '') + '</div>'
      + '</div></div>';

    const statsRow = '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + stat('Cover Goal', goalForToday > 0 ? goalForToday + '' : '-', coverGoalLabel)
      + stat('Labor So Far', App.fmtCurrency(labor.cost), laborSub)
      + stat('Cash Drops', drops.length, App.fmtCurrency(dropTotal) + ' dropped')
      + stat('Voids &amp; Comps', vc.length, App.fmtCurrency(vcTotal) + ' total')
      + stat('86\'d Items', active86, active86 === 1 ? 'item out' : 'items out')
      + stat('Open Maint.', openMaint, openMaint === 1 ? 'issue' : 'issues')
      + '</div>';

    const logButtons = '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost" id="ld-cash" style="height:52px;flex:1;min-width:120px;">Cash Drop</button>'
      + '<button class="btn btn-ghost" id="ld-vc" style="height:52px;flex:1;min-width:120px;">Void / Comp</button>'
      + '<button class="btn btn-ghost" id="ld-waste" style="height:52px;flex:1;min-width:120px;">Waste / Spill</button>'
      + '<button class="btn btn-ghost" id="ld-86" style="height:52px;flex:1;min-width:120px;">86 an Item</button>'
      + '<button class="btn btn-ghost" id="ld-maint" style="height:52px;flex:1;min-width:120px;">Maintenance</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      // Card 1 — The Shift: header + Registers + This Shift
      + '<div class="card">'
      + header
      + regSection
      + this.sectionDivider() + this.subLabel('This Shift') + statsRow
      + '</div>'
      // Card 2 — During the Shift: Log During + Shift Notes, End/Cancel in the footer band
      + '<div class="card form-card">'
      + this.subLabel('Log During This Shift') + logButtons
      + this.sectionDivider() + this.shiftNotesInner(s)
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary btn-lg" id="as-end">End Shift</button>'
      + '<button class="btn btn-ghost" id="as-cancel" style="color:var(--red);">Cancel Shift</button>'
      + '</div>'
      + '</div>';

    // Log-During buttons open each module's entry form as a pop-up with an
    // onDone that re-renders the running shift, so the manager never leaves it.
    // Date / shift are preset from this shift so the entry lands on it.
    this.container.onclick = ev => {
      const done = () => this.renderActive(s);
      if (ev.target.closest('#ld-cash'))  { S.ShiftCashControl.openDrop(null, '', done); return; }
      if (ev.target.closest('#ld-vc'))    { S.ShiftVoidComp.openLogModal(done, { date: s.date, shift_type: s.shift_type }); return; }
      if (ev.target.closest('#ld-waste')) { S.ShiftWaste.openLogModal(done, { date: s.date, shift_type: s.shift_type }); return; }
      if (ev.target.closest('#ld-86'))    { S.Shift86List.openLogModal(done, { date_86: s.date }); return; }
      if (ev.target.closest('#ld-maint')) { S.ShiftMaintenance.openLogModal(done, { date_reported: s.date }); return; }
      if (ev.target.closest('#as-cancel')) this.cancelShift(s);
      else if (ev.target.closest('#as-end')) this.renderEnd(s);
      else if (ev.target.closest('#sn-add')) this.addShiftNote(s);
      else if (ev.target.closest('.sn-del')) this.removeShiftNote(s, ev.target.closest('.sn-del').dataset.id);
    };
  },

  // Cover goal for the active shift's daypart. Anchored to this week's Revenue
  // Forecast whole-day cover number for the weekday, then sliced by this
  // daypart's historical share of a day's covers (last 8 weeks of sc_shifts).
  // Prefers the SAME weekday; if the daypart never runs on this weekday (e.g. a
  // Lunch shift on a weekend, where the bar runs Brunch instead) it uses the
  // daypart's typical share across the days it DOES run, so it still breaks
  // down rather than showing the whole-day number. A daypart with no history at
  // all (e.g. "Full Day") keeps the whole-day number, which is correct for it.
  // Returns { goal, daily, daypart } where daypart=true means a slice was used.
  coverGoalFor(s) {
    const out = { goal: 0, daily: 0, daypart: false };
    if (!s || !s.date || !App.weekStartFor || !App.DAYS_MON_FIRST) return out;
    const f = App.forecastForWeek ? App.forecastForWeek(App.weekStartFor(s.date)) : null;
    if (!f || !f.covers_per_day) return out;
    const dt = new Date(s.date + 'T00:00:00');
    if (isNaN(dt.getTime())) return out;
    const wdIdx = (dt.getDay() + 6) % 7;
    const daily = parseFloat(f.covers_per_day[App.DAYS_MON_FIRST[wdIdx]]) || 0;
    out.daily = daily;
    if (daily <= 0) return out;

    // Build two share estimates from the last 8 weeks of sc_shifts: the same
    // weekday (primary), and per-date totals for an any-weekday fallback.
    const refMs = dt.getTime();
    const myType = s.shift_type || '';
    const shifts = (App.shiftData && App.shiftData.sc_shifts) || [];
    let sameWkPart = 0, sameWkTotal = 0;
    const byDate = {};   // date -> { total, part }
    shifts.forEach(h => {
      if (!h || !h.date || h.id === s.id) return;       // skip the open shift itself
      const hd = new Date(String(h.date).length <= 10 ? h.date + 'T00:00:00' : h.date);
      if (isNaN(hd.getTime())) return;
      const daysBack = Math.round((refMs - hd.getTime()) / 86400000);
      if (daysBack < 0 || daysBack > 56) return;        // within the last 8 weeks
      const c = parseFloat(h.covers) || 0;
      if (c <= 0) return;
      const isMine = (h.shift_type || '') === myType;
      if (((hd.getDay() + 6) % 7) === wdIdx) { sameWkTotal += c; if (isMine) sameWkPart += c; }
      const d = byDate[h.date] || (byDate[h.date] = { total: 0, part: 0 });
      d.total += c; if (isMine) d.part += c;
    });

    let share = null;
    if (sameWkTotal > 0 && sameWkPart > 0) {
      share = sameWkPart / sameWkTotal;                  // same weekday (best)
    } else {
      // Any-weekday fallback: this daypart's share across the days it ran.
      let anyPart = 0, anyTotal = 0;
      Object.keys(byDate).forEach(k => { const d = byDate[k]; if (d.part > 0) { anyPart += d.part; anyTotal += d.total; } });
      if (anyTotal > 0 && anyPart > 0) share = anyPart / anyTotal;
    }

    if (share != null) {
      out.goal = Math.round(daily * share);
      out.daypart = true;
    } else {
      out.goal = Math.round(daily);                      // no daypart history (e.g. Full Day)
    }
    return out;
  },

  showHowToActive() {
    App.showHelpModal('How the Running Shift Works', [
      { p: ['This is your command center while the shift is live. Everything you log during service lands on the shift and rolls into the close.'] },
      { h: 'Registers', p: ['The registers you opened sit up top with their bank and what has been dropped from each so far.'] },
      { h: 'This Shift', p: ['Live counts as the night runs: cover goal, labor so far, cash drops, voids and comps, 86\'d items, and open maintenance. The Cover Goal is the day\'s number from Revenue Recovery, Revenue Forecast, split to this shift\'s part of the day based on how your covers normally land across dayparts. Set the day\'s number there and it shows here.'] },
      { h: 'Log During This Shift', p: ['Tap any of these to log it the moment it happens: a cash drop, a void or comp, waste or a spill, an 86, or a maintenance issue. Cash Drop opens right here so you never leave the shift. Each feeds its own log and the shift exceptions.'] },
      { h: 'Shift Notes', p: ['Drop timestamped notes through the night for the closer or the next manager. They flow into the Handoff Report at close.'] },
      { h: 'Ending the Shift', p: ['End Shift runs the close wizard: revenue and covers, cash count per register, exceptions, tips, and handoff notes. Cancel Shift discards the shift without saving if you opened it by mistake.'] }
    ]);
  },

  // ── Mid-shift Notes ────────────────────────────────────────────────────────
  // Operator-pain fix: the handoff_notes field only captures things at close.
  // This adds a running timestamped notebook the manager can drop notes into
  // throughout the shift. Notes flow into the Shift Handoff Report at close.
  // Shift Notes sub-section content (label + add form + list; no card wrapper).
  shiftNotesInner(s) {
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
    return '<div class="form-row" style="gap:10px;align-items:flex-end;margin-bottom:10px;">'
        + '<div class="f" style="flex:1;min-width:220px;margin-bottom:0;"><label>Add a Note</label>'
          + '<textarea id="sn-text" rows="2" placeholder="VIP at 9pm, delivery short on bourbon, weather slowing us down..."></textarea></div>'
        + '<div style="flex-shrink:0;"><button class="btn btn-primary" id="sn-add" style="height:48px;">Add Note</button></div>'
      + '</div>'
      + list;
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
        // Tip recon defaults. tip_mode is the Step 4 choice (tipout | pool | skip);
        // it remembers the last mode used this session, falling back to config.
        tips_pos_reported: null,
        tip_mode:      this._lastTipMode || (App.tipOutEnabled() ? 'tipout' : 'pool'),
        tipout_rows:   null,
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
    return '<div class="card form-card"><div class="card-title">Step 1 of 5 &middot; Revenue and Covers</div>'
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
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Cash Reconciliation</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>';
  },

  // ── Step 2: Cash Reconciliation ───────────────────────────────────────────
  stepCash(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    const cd = d.cashDrawers || [];

    let body;
    if (cd.length === 0) {
      body = '<div style="font-size:13px;color:var(--t3);padding:6px 0;">No registers were opened on this shift, so there is nothing to count. Continue to the next step.</div>';
    } else {
      const fmt = x => x != null ? App.fmtCurrency(x) : '-';
      // One compact row per register (the standard line table), totals in a bold
      // Total row — same shape as the Shift History recap. Opening/Drops are read-
      // only (auto-filled); POS Cash + Counted are the only inputs; Expected and
      // Variance compute live (class names kept so the wiring is unchanged).
      const rows = cd.map((c, i) =>
        '<tr class="aw-cash-line">'
        + '<td><div class="val">' + esc(c.name || 'Register') + '</div></td>'
        + '<td>' + fmt(c.opening_bank) + '</td>'
        + '<td>' + fmt(c.drops_total) + '</td>'
        + '<td><input class="form-input aw-sales" data-i="' + i + '" type="number" min="0" step="0.01" inputmode="decimal" value="' + v(c.sales_cash) + '" placeholder="From POS" style="width:100%;"/></td>'
        + '<td><input class="form-input aw-counted-d" data-i="' + i + '" type="number" min="0" step="0.01" inputmode="decimal" value="' + v(c.counted_cash) + '" placeholder="Counted" style="width:100%;"/></td>'
        + '<td><span class="aw-exp" data-i="' + i + '" style="font-weight:700;color:var(--t1);">-</span></td>'
        + '<td><span class="aw-var" data-i="' + i + '" style="font-weight:700;">-</span></td>'
        + '</tr>').join('');
      const sumOpen = cd.reduce((t, c) => t + (c.opening_bank || 0), 0);
      const sumDrops = cd.reduce((t, c) => t + (c.drops_total || 0), 0);
      const totalRow = '<tr class="aw-cash-line">'
        + '<td><div class="val" style="font-weight:800;">Total</div></td>'
        + '<td>' + App.fmtCurrency(sumOpen) + '</td>'
        + '<td>' + App.fmtCurrency(sumDrops) + '</td>'
        + '<td></td>'
        + '<td><span id="aw-t-counted" style="font-weight:700;color:var(--t1);">-</span></td>'
        + '<td><span id="aw-t-expected" style="font-weight:700;color:var(--t1);">-</span></td>'
        + '<td><span id="aw-t-variance" style="font-weight:700;">-</span></td>'
        + '</tr>';
      const table = '<div class="card" style="padding:0;overflow:hidden;margin:4px 0 12px;"><table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:150px;">Register</th><th style="width:90px;">Opening</th><th style="width:90px;">Drops</th>'
        + '<th style="width:120px;">POS Cash</th><th style="width:120px;">Counted</th>'
        + '<th style="width:100px;">Expected</th><th style="width:100px;">Variance</th>'
        + '</tr></thead><tbody>' + rows + totalRow + '</tbody></table></div>';
      body = table
        + '<label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" id="aw-cash-skip" ' + (d.cash_skipped ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>'
          + 'Skip cash reconciliation (drawers not counted this shift)</label>';
    }

    return '<div class="card form-card"><div class="card-title">Step 2 of 5 &middot; Cash Reconciliation</div>'
      + '<div style="margin-top:4px;"></div>'
      + body
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Exception Review</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>';
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
      const bg = count === 0 ? 'var(--input)' : ack ? 'var(--input)' : '#0D181E';
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
    return '<div class="card form-card"><div class="card-title">Step 3 of 5 &middot; Exception Review</div>'
      + '<div style="margin-top:4px;"></div>'
      + item('e86', eighty6.length, '86\'d Items Still Out', eighty6.length === 0 ? 'Nothing 86\'d.' : eighty6.slice(0, 3).map(i => i.item).join(', ') + (eighty6.length > 3 ? '...' : ''), 'sc-86-list', 'var(--red)')
      + item('vc',  vc.length, 'Big Voids and Comps This Shift', vc.length === 0 ? 'No voids or comps over $' + vcThreshold + '.' : 'Over $' + vcThreshold + ' threshold · ' + App.fmtCurrency(bigVcTotal) + ' total', 'sc-void-comp', 'var(--red)')
      + item('mt',  openMaint.length, 'Open Maintenance Issues', openMaint.length === 0 ? 'Nothing flagged.' : openMaint.slice(0, 3).map(m => m.issue || m.item || 'Issue').join(', ') + (openMaint.length > 3 ? '...' : ''), 'sc-maintenance', 'var(--red)')
      + item('cl',  checklistIncomplete ? 1 : 0, 'Closing Checklist', !closingCheck ? 'No closing checklist run yet for tonight.' : checklistIncomplete ? checklistDone + '% complete · finish before closing' : 'Complete.', 'sc-checklists', 'var(--red)')
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Tip Reconciliation</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>';
  },

  // ── Step 4: Tip Reconciliation ────────────────────────────────────────────
  // The chosen tool loads INLINE. Both Tip Out and Tip Pool pre-load this shift's
  // crew from the posted schedule and write on close — no leaving Active Shift.
  // Choice-first: the closer picks how tips are handled for THIS shift, then the
  // right tool loads. No leaving Active Shift — tip-out is entered right here and
  // logged straight to lc_tips on close, the pool split writes lc_tip_pools, Skip
  // captures nothing. The choice is remembered as the next default.
  stepTips(s) {
    const d = this._closeDraft;
    const mode = d.tip_mode;
    const tipChip = (m, label, sub) =>
      '<button class="aw-tipmode-chip" data-mode="' + m + '" style="flex:1;min-width:150px;text-align:left;padding:12px 14px;border-radius:10px;cursor:pointer;'
      + (mode === m ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);' : 'background:var(--input);border:1px solid var(--b1);') + '">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + label + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + sub + '</div></button>';
    const chooser = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">'
      + tipChip('tipout', 'Tip Out', 'Servers tip out a percent of sales')
      + tipChip('pool', 'Tip Pool', 'One pot split across staff')
      + tipChip('skip', 'Skip Tips', 'Not reconciling tips this shift')
      + '</div>';

    let body;
    if (mode === 'skip') {
      body = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;line-height:1.6;">Tips are not being reconciled for this shift. Continue to handoff notes.</div>';
    } else if (mode === 'pool') {
      body = this._poolBody(s);
    } else {
      body = App.tipOutEnabled()
        ? this.tipoutSection(s)
        : '<div style="font-size:13px;color:var(--t2);padding:8px 2px;line-height:1.6;">Tip-out percentages are set per role in Positions. Add a Tip Out percent to your tipped roles to reconcile tip-outs here, or pick Tip Pool or Skip Tips for this shift.</div>';
    }

    return '<div class="card form-card"><div class="card-title">Step 4 of 5 &middot; Tip Reconciliation</div>'
      + chooser + body + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Handoff Notes</button><button class="btn btn-ghost" id="aw-cancel">Return To Shift</button></div>';
  },

  // Tip Pool branch — mirrors the shift-anchored Labor Tip Pool (lc-tip-pool).
  // The crew pre-loads from THIS shift's posted schedule (call-out adjusted, hours
  // from logged-actuals-else-scheduled), the operator enters the pool amount, and
  // the split saves to lc_tip_pools automatically on close (no Save button) tied
  // to the shift. No logged-tips summary, no POS variance — same form as Labor.
  _poolBody(s) {
    const d = this._closeDraft;
    this._ensurePoolDraft(s);
    const pool = d.pool;
    const equal = pool.method === 'equal';

    return ''
      + '<div class="form-row" style="gap:16px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Pool Amount</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-pool-amount" min="0" step="0.01" value="' + esc(pool.amount || '') + '"/></div></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Method</label>'
          + '<select id="aw-pool-method"><option value="hours"' + (equal ? '' : ' selected') + '>By Hours Worked</option>'
          + '<option value="equal"' + (equal ? ' selected' : '') + '>Equal Split</option></select></div>'
      + '</div>'

      + '<div class="card" style="padding:0;overflow:hidden;margin:14px 0 12px;"><table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:240px;">Staff</th><th style="width:120px;">Hours</th>'
        + '<th style="width:130px;">Tip Share</th><th></th><th style="width:100px;"></th>'
        + '</tr></thead><tbody id="aw-pool-rows"></tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="aw-pool-add">+ Add Participant</button>'

      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Participants</div><div class="calc-val" id="aw-pool-count">0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val" id="aw-pool-hours">0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="aw-pool-alloc">$0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="aw-pool-rem">$0</div></div>'
      + '</div>'

      + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop splits the pool by the method and hours you enter. It is a calculator, not legal or payroll advice. Tip pool eligibility, mandatory versus voluntary pooling, tip credit, and distribution rules vary by jurisdiction and change over time. Managers, owners, and some non-tipped roles may be barred from a pool. Verify who can participate and the rules for your jurisdiction before distributing tips.</div>'
      + '</div>';
  },

  // ── Tip Out branch — entered inline, logged to lc_tips on close ────────────
  // Reuses the Tip Log's canonical tip-out engine (row HTML + math + live recon)
  // so the two doors never drift; only the per-shift preload and the save are
  // Active-Shift-local. Rows live on the close draft (d.tipout_rows).
  _ensureTipoutRows(s) {
    const d = this._closeDraft;
    if (d.tipout_rows) return;
    const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date));
    // Pre-logged in the Tip Log before close — load them with their amounts.
    const logged = tips.map(t => ({
      staff_id: t.staff_id || '',
      hours:    (t.hours != null ? t.hours : ''),
      cash:     (t.cash_tips != null ? t.cash_tips : ''),
      card:     (t.card_tips != null ? t.card_tips : ''),
      sales:    (t.sales != null ? t.sales : ''),
      received: (t.tip_out_received != null ? t.tip_out_received : '')
    }));
    // The rest of the crew, blank to fill: the Tip Log's own shift preload (the
    // posted SCHEDULE for the day, call-out adjusted, hours from logged-actuals-
    // else-scheduled, already-logged skipped). Schedule, not actuals, because
    // hours are usually not logged yet at close. Save/restore Tip Log state so the
    // call leaves that screen untouched.
    let crew = [];
    try {
      const TL = S.LaborTipLog;
      if (TL && TL.preloadFromShift) {
        const savedShift = TL._addShift, savedRows = TL._addRows;
        TL.preloadFromShift(s.id);
        crew = (TL._addRows || []).map(r => ({ staff_id: r.staff_id || '', hours: (r.hours != null ? r.hours : ''), cash: '', card: '', sales: '', received: '' }));
        TL._addShift = savedShift; TL._addRows = savedRows;
      }
    } catch (e) { crew = []; }
    d.tipout_rows = logged.concat(crew);
  },

  // Tip-out section = a Manual / Import sub-toggle (mirrors the Labor Tip Log) over
  // the two-section builder. Import drops a POS tips export straight into the
  // builder rows, which then log to lc_tips on close like the typed rows.
  tipoutSection(s) {
    const d = this._closeDraft;
    const tmode = d.tipout_mode || 'manual';
    d.tipout_mode = tmode;
    const segBtn = (m, label) => {
      const on = tmode === m;
      return '<button type="button" class="btn btn-sm aw-to-mode" data-mode="' + m + '" style="'
        + (on ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    const toggle = '<div class="seg-toggle" style="margin-bottom:14px;">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>';
    const body = tmode === 'import'
      ? '<div id="aw-to-csv"></div><div id="aw-to-result"></div>'
      : this.tipoutBody(s);
    return toggle + body;
  },

  // Drop a POS tips export into the tip-out builder. Same mapper the Labor Tip Log
  // uses; the shift date is implicit (this shift), and Total Sales maps too so the
  // tip-out computes. Matched rows merge into the builder and log on close.
  mountTipoutImporter(s) {
    const el = document.getElementById('aw-to-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS tips export here',
      dropSub: 'Needs a staff name and card or cash tips. The shift date is used automatically; map Total Sales too so tip-outs compute.',
      fields: [
        { key: 'name',      label: 'Staff Name',  required: true,  match: ['employee', 'employee name', 'name', 'staff', 'server', 'server name'] },
        { key: 'card_tips', label: 'Card Tips',   required: false, match: ['card tips', 'credit tips', 'cc tips', 'card', 'credit card tips', 'charged tips', 'non-cash tips'] },
        { key: 'cash_tips', label: 'Cash Tips',   required: false, match: ['cash tips', 'cash', 'declared cash tips', 'declared tips'] },
        { key: 'sales',     label: 'Total Sales', required: false, match: ['sales', 'net sales', 'total sales', 'gross sales'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importTipoutRows(s, rows)
    });
  },

  importTipoutRows(s, rows) {
    const d = this._closeDraft;
    this._ensureTipoutRows(s);
    const byName = {};
    (App.laborData?.lc_staff || []).forEach(st => { byName[(st.name || '').trim().toLowerCase()] = st; });
    const byStaff = {};
    (d.tipout_rows || []).forEach(r => { if (r.staff_id) byStaff[r.staff_id] = r; });
    let matched = 0; const skipped = [];
    (rows || []).forEach(r => {
      const st = byName[(r.name || '').trim().toLowerCase()];
      const cash = parseFloat(r.cash_tips) || 0;
      const card = parseFloat(r.card_tips) || 0;
      const sales = parseFloat(r.sales) || 0;
      if (!st || (cash + card + sales) <= 0) { skipped.push(r.name || '(blank)'); return; }
      let row = byStaff[st.id];
      if (!row) {
        const hrs = App.hoursFor(st.id, s.date);
        row = { staff_id: st.id, hours: (hrs != null && hrs > 0 ? hrs : ''), cash: '', card: '', sales: '', received: '' };
        d.tipout_rows.push(row); byStaff[st.id] = row;
      }
      if (cash) row.cash = cash;
      if (card) row.card = card;
      if (sales) row.sales = sales;
      matched++;
    });
    if (matched === 0) {
      const result = document.getElementById('aw-to-result');
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No rows imported. No staff names matched the roster, or no amounts were found.</div>';
      return;
    }
    // Back to the builder so the imported amounts show, the recon updates, and they
    // log to lc_tips on close with the typed rows.
    d._tipoutNote = { matched, skipped: skipped.length };
    d.tipout_mode = 'manual';
    this.renderWizardStep(s);
  },

  tipoutBody(s) {
    const d = this._closeDraft;
    this._ensureTipoutRows(s);
    const TL = S.LaborTipLog;
    const rows = d.tipout_rows || [];
    // Earners first, then support, so data-idx stays aligned with the DOM order.
    const isSupport = r => App.tipRole(r.staff_id) === 'support';
    const earners = rows.filter(r => !isSupport(r));
    const support = rows.filter(r => isSupport(r));
    d.tipout_rows = earners.concat(support);
    const eBody = earners.map((r, i) => TL.batchEarnerRow(r, i)).join('')
      || '<tr><td colspan="9" style="color:var(--t3);font-size:12px;padding:8px 10px;">No tipped earners on this shift. Add staff below if one worked.</td></tr>';
    const sBody = support.map((r, j) => TL.batchSupportRow(r, earners.length + j)).join('')
      || '<tr><td colspan="9" style="color:var(--t3);font-size:12px;padding:8px 10px;">No support staff on this shift. Add staff below if one worked.</td></tr>';
    const tbl = (head, b) => '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;"><table class="ing-tbl" style="table-layout:fixed;"><thead><tr>' + head + '</tr></thead><tbody>' + b + '</tbody></table></div>';
    const grid = '<th style="width:150px;">Staff</th><th style="width:70px;">Hours</th><th style="width:90px;">Cash Tips</th><th style="width:90px;">Card Tips</th><th style="width:100px;">Total Sales</th><th style="width:90px;">Tip-Out</th><th style="width:90px;">Received</th><th style="width:90px;">Net</th><th style="width:70px;"></th>';
    const sGrid = '<th style="width:150px;">Staff</th><th style="width:70px;">Hours</th><th style="width:90px;"></th><th style="width:90px;"></th><th style="width:100px;"></th><th style="width:90px;"></th><th style="width:90px;">Received</th><th style="width:90px;"></th><th style="width:70px;"></th>';
    const tables = '<div id="tl-b-rows">'
      + '<div class="sh" style="margin:0 0 8px;">Pays / Receives Tip-Out</div>' + tbl(grid, eBody)
      + '<div class="sh" style="margin:14px 0 8px;">Receives Tip-Out</div>' + tbl(sGrid, sBody)
      + '</div>';
    const recon = TL.tipOutRecon(d.tipout_rows);
    const gapCls = Math.abs(recon.gap) > 0.01 ? 'warn' : 'good';
    const reconBox = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Collected</div><div class="calc-val" id="tl-b-collected">' + App.fmtCurrency(recon.collected, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Distributed</div><div class="calc-val" id="tl-b-distributed">' + App.fmtCurrency(recon.distributed, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Not Distributed</div><div class="calc-val ' + gapCls + '" id="tl-b-gap">' + App.fmtCurrency(recon.gap, 2) + '</div></div>'
      + '</div>';
    const headsUp = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop figures each tip-out at the percent of sales you set per role, and tracks what you record as distributed. It is a calculator, not legal or payroll advice. How a tip-out is collected and paid out, who must participate, and tip-credit rules vary by jurisdiction and change over time. Verify the rules for your area, and confirm the actual amounts with your payroll provider.</div>'
      + '</div>';
    const note = d._tipoutNote; d._tipoutNote = null;
    const noteHtml = note
      ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin:0 0 12px;">Imported ' + note.matched + ' row' + (note.matched === 1 ? '' : 's') + ' into the builder.'
        + (note.skipped ? ' <span style="color:var(--t3);font-weight:400;">' + note.skipped + ' skipped (no roster match or no amount).</span>' : '') + '</div>'
      : '';
    return noteHtml + tables + '<button class="btn btn-ghost btn-sm" id="aw-to-add" style="margin-top:4px;">+ Add Staff</button>' + reconBox + headsUp;
  },

  collectTipout() {
    const d = this._closeDraft;
    if (d.tip_mode !== 'tipout') return;
    const rows = S.LaborTipLog.batchDomRows();
    if (rows.length) d.tipout_rows = rows;
  },

  // Write the entered tip-out rows to lc_tips on close — the same record shape the
  // Tip Log writes, so they feed tip-credit, payroll, and Form 8027 identically.
  // Skips anyone already logged for this shift (no double-count).
  async _saveTipoutRows(s) {
    const d = this._closeDraft;
    const rows = d.tipout_rows || [];
    if (!rows.length) return;
    const tipOutOn = App.tipOutEnabled();
    const out = S.LaborTipLog.computeTipOut(rows);
    const staff = (App.laborData && App.laborData.lc_staff) || [];
    const existing = (App.laborData && App.laborData.lc_tips) || [];
    const r2 = n => Math.round((n || 0) * 100) / 100;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], o = out[i];
      const st = staff.find(x => x.id === r.staff_id);
      if (!st || !o) continue;
      if ((o.cash + o.card) <= 0 && o.received <= 0) continue;
      if (existing.some(t => t.staff_id === st.id && t.date === s.date && (t.shift_id || '') === s.id)) continue;
      const h = (r.hours !== '' && r.hours != null) ? parseFloat(r.hours) : null;
      const rec = {
        id: App.uid(), shift_id: s.id, manager_id: s.manager_id || '', date: s.date,
        staff_id: st.id, name: st.name, position_id: st.position_id || '',
        shift_type: s.shift_type || '', cash_tips: o.cash, card_tips: o.card, total_tips: o.cash + o.card,
        sales: tipOutOn ? r2(o.sales) : 0, tip_out_paid: tipOutOn ? r2(o.paid) : 0, tip_out_received: tipOutOn ? r2(o.received) : 0,
        hours: (h != null && !isNaN(h)) ? h : null, notes: '', created_at: new Date().toISOString()
      };
      await App.putRecord('lc', 'tip', rec);
    }
  },

  // ── Pool draft helpers ────────────────────────────────────────────────────
  _ensurePoolDraft(s) {
    const d = this._closeDraft;
    if (d.pool) return; // already hydrated for this wizard run

    // If a pool was already saved for this shift, load it so a close updates it
    // rather than writing a duplicate.
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

    // Fresh draft. Crew pre-loads from THIS shift's posted SCHEDULE (call-out
    // adjusted, hours from logged-actuals-else-scheduled) — the same crew the Tip
    // Out branch and the Labor Tip Pool load via the Tip Log's preloadFromShift.
    // The pool amount stays operator-entered (the schedule has no tip totals and a
    // pool house does not log per-person tips). Save/restore Tip Log state so the
    // call leaves that screen untouched.
    let crew = [];
    try {
      const TL = S.LaborTipLog;
      if (TL && TL.preloadFromShift) {
        const savedShift = TL._addShift, savedRows = TL._addRows;
        TL.preloadFromShift(s.id);
        const staff = (App.laborData && App.laborData.lc_staff) || [];
        crew = (TL._addRows || []).map(r => {
          const st = staff.find(x => x.id === r.staff_id);
          return { staff_id: r.staff_id || '', name: st ? st.name : '', hours: (r.hours != null ? r.hours : ''), share: 0 };
        });
        TL._addShift = savedShift; TL._addRows = savedRows;
      }
    } catch (e) { crew = []; }

    d.pool = { method: 'hours', amount: '', participants: crew, saved_id: '' };
  },

  // Render the participant rows for the inline pool into the ing-tbl tbody. Same
  // batch-builder row shape as the Labor Tip Pool, wired into the wizard's IDs.
  renderPoolRows() {
    const area = document.getElementById('aw-pool-rows');
    if (!area) return;
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    const equal = pool.method === 'equal';
    area.innerHTML = pool.participants.length
      ? pool.participants.map((r, i) => this.poolRowHtml(r, i, equal)).join('')
      : '<tr><td colspan="5" style="color:var(--t3);font-size:12px;padding:8px 10px;">No one on this shift\'s schedule yet. Add a participant below.</td></tr>';
  },

  poolRowHtml(r, i, equal) {
    r = r || {};
    return '<tr class="aw-pool-row" data-idx="' + i + '">'
      + '<td><select class="form-input aw-pool-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input aw-pool-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"' + (equal ? ' disabled' : '') + ' style="width:100%;"/></td>'
      + '<td><div class="aw-pool-share" style="font-weight:600;color:var(--t1);">' + (r.share > 0 ? App.fmtCurrency(r.share, 2) : '-') + '</div></td>'
      + '<td></td>'
      + '<td><button class="btn btn-ghost btn-sm aw-pool-remove" type="button">Remove</button></td>'
      + '</tr>';
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

  // Auto-save the pool split to lc_tip_pools on close — the same record shape the
  // Labor Tip Pool writes, tied to this shift. Silently skips if there is nothing
  // to save (no amount or no participants), so it never blocks the close; updates
  // in place if a pool was already saved for this shift (no duplicate).
  async _savePoolOnClose(s) {
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    this.computePoolShares();
    const amount = parseFloat(pool.amount) || 0;
    const valid = pool.participants.filter(p => p.staff_id);
    if (amount <= 0 || valid.length === 0) return;

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
      created_at:  pool.saved_id ? undefined : new Date().toISOString()
    };
    if (pool.saved_id) rec.updated_at = new Date().toISOString();

    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tip_pools)) App.laborData.lc_tip_pools = [];
    const list = App.laborData.lc_tip_pools;
    if (pool.saved_id) {
      const i = list.findIndex(x => x.id === pool.saved_id);
      if (i > -1) list[i] = { ...list[i], ...rec }; else list.push(rec);
    } else {
      list.push(rec);
    }
    pool.saved_id = rec.id;
    await App.putRecord('lc', 'tip_pool', rec);
  },

  // ── Step 5: Handoff Notes + Final Close ───────────────────────────────────
  stepHandoff(s) {
    const d = this._closeDraft;
    return '<div class="card form-card"><div class="card-title">Step 5 of 5 &middot; Handoff Notes</div>'
      + '<div class="form-row" style="gap:14px;margin-top:4px;"><div class="f" style="width:100%;"><label>Notes for the Opener</label>'
        + '<textarea id="aw-handoff" rows="5" placeholder="Restock priorities, equipment to watch, customer follow-ups, anything the opener will inherit...">' + esc(d.handoff_notes || '') + '</textarea></div></div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary btn-lg" id="aw-finalize">Close Shift</button>'
        + '<button class="btn btn-ghost" id="aw-cancel">Return To Shift</button>'
        + '<span id="aw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
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
      if (d.tip_mode === 'tipout') this.collectTipout();
      else if (d.tip_mode === 'pool') this.collectPool();
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
        { p: ['Pick how tips were handled this shift, then do it right here without leaving the close. Bar Cop remembers your choice as the default next time.'] },
        { h: 'Tip Out', p: ['Choose Tip Out when servers tip out a percent of their sales to support. Bar Cop loads the shift\'s tipped staff into two sections: those who ring sales and tip out (servers, bartenders) enter cash, card, and total sales, and those who only receive (bussers, barbacks) get a Received cell. The Collected vs Distributed line flags any gap. These log straight to the Tip Log on close, so they feed the tip-credit check, payroll, and Form 8027. Tip-out percents are set per role in Positions.', 'Enter Manually loads the crew to type from your tip sheet. Or switch to Import File and drop a POS tips export to fill the rows from your file, then review and close. Either way the rows log on close.'] },
        { h: 'Tip Pool', p: ['Choose Tip Pool when tips go into one pot split across the staff who worked. Bar Cop pre-loads this shift\'s crew straight from the posted schedule, call-out adjusted, with hours from their logged actuals or scheduled hours. Enter the pool amount, pick split by hours or equal, and each share computes live. The split saves to a tip pool tied to this shift automatically when you close, no separate Save step, which the Books Form 8027 worksheet reads later. Verify who can legally share a pool for your jurisdiction.'] },
        { h: 'Skip Tips', p: ['Choose Skip Tips for a shift with nothing to reconcile, or when tips are handled outside Bar Cop. Nothing is captured.'] },
        { h: 'Already Logged', p: ['If you logged this shift\'s tips in the Tip Log before closing, they load in automatically and you just confirm.'] }
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
    // Return To Shift pauses the close and drops back to the running view WITHOUT
    // wiping what was entered — so the operator can log a void/comp/waste inline and
    // come back to End Shift with all their step data (registers, tips, etc.) intact.
    // Sync the visible step first so its inputs are captured before we leave it.
    // The draft only clears on a real close (finalizeClose) or Cancel Shift.
    document.getElementById('aw-cancel')?.addEventListener('click', () => {
      this.syncWizardInputs();
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
            else { varEl.textContent = (variance > 0 ? '+' : '') + App.fmtCurrency(variance); varEl.style.color = Math.abs(variance) <= tol ? 'var(--green)' : (variance < 0 ? 'var(--red)' : 'var(--amber)'); }
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
          else { tvEl.textContent = (tVar > 0 ? '+' : '') + App.fmtCurrency(tVar); tvEl.style.color = Math.abs(tVar) <= tol ? 'var(--green)' : (tVar < 0 ? 'var(--red)' : 'var(--amber)'); }
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

    // Step 4: the chooser + the chosen branch's wiring.
    if (d.step === 'tips') {
      // Chooser: collect the current branch's inputs, switch mode, remember it.
      this.container.querySelectorAll('.aw-tipmode-chip').forEach(b => b.addEventListener('click', () => {
        if (d.tip_mode === 'tipout') this.collectTipout();
        else if (d.tip_mode === 'pool') this.collectPool();
        d.tip_mode = b.dataset.mode;
        this._lastTipMode = b.dataset.mode;
        this.renderWizardStep(s);
      }));

      if (d.tip_mode === 'pool') {
        this.renderPoolRows();
        this.refreshPoolCalc();
        const rowsEl = document.getElementById('aw-pool-rows');
        rowsEl?.addEventListener('input', () => this.refreshPoolCalc());
        rowsEl?.addEventListener('change', ev => {
          // When a row's staff is picked and its hours are empty, auto-fill from
          // that person's logged actuals for the shift date; operator can override.
          if (ev.target.classList && ev.target.classList.contains('aw-pool-staff')) {
            const hoursInp = ev.target.closest('.aw-pool-row')?.querySelector('.aw-pool-hours');
            if (hoursInp && !hoursInp.value && s.date) {
              const hrs = App.hoursFor(ev.target.value, s.date);
              if (hrs != null && hrs > 0) hoursInp.value = hrs;
            }
          }
          this.refreshPoolCalc();
        });
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
          d.pool.participants.push({ staff_id: '', name: '', hours: '', share: 0 });
          this.renderPoolRows();
          this.refreshPoolCalc();
        });
        document.getElementById('aw-pool-amount')?.addEventListener('input', () => this.refreshPoolCalc());
        document.getElementById('aw-pool-method')?.addEventListener('change', () => {
          this.collectPool();
          d.pool.method = document.getElementById('aw-pool-method').value;
          this.renderPoolRows();
          this.refreshPoolCalc();
        });
      } else if (d.tip_mode === 'tipout' && App.tipOutEnabled()) {
        // Manual / Import sub-toggle (mirrors the Labor Tip Log). Switching preserves
        // any typed rows first.
        this.container.querySelectorAll('.aw-to-mode').forEach(b => b.addEventListener('click', () => {
          if ((d.tipout_mode || 'manual') === 'manual') this.collectTipout();
          d.tipout_mode = b.dataset.mode;
          this.renderWizardStep(s);
        }));

        if ((d.tipout_mode || 'manual') === 'import') {
          this.mountTipoutImporter(s);
        } else {
          // Tip-out builder: the Tip Log's canonical row engine drives the live
          // tip-out + net + Collected/Distributed recon. Picking a staff member
          // reshapes the row into its section via a step re-render (collect first).
          const rowsEl = document.getElementById('tl-b-rows');
          if (rowsEl) {
            rowsEl.addEventListener('input', () => { this.collectTipout(); S.LaborTipLog.recalcBatch(); });
            rowsEl.addEventListener('change', ev => {
              if (ev.target.classList && ev.target.classList.contains('tl-b-staff')) {
                const hoursInp = ev.target.closest('.tl-line')?.querySelector('.tl-b-hours');
                if (hoursInp && !hoursInp.value && s.date) { const hrs = App.hoursFor(ev.target.value, s.date); if (hrs != null && hrs > 0) hoursInp.value = hrs; }
                this.collectTipout(); this.renderWizardStep(s); return;
              }
              S.LaborTipLog.recalcBatch();
            });
            rowsEl.addEventListener('click', ev => {
              if (ev.target.closest('.tl-b-remove')) {
                this.collectTipout();
                const idx = parseInt(ev.target.closest('.tl-line').dataset.idx, 10);
                if (d.tipout_rows && idx >= 0) d.tipout_rows.splice(idx, 1);
                this.renderWizardStep(s);
              }
            });
          }
          document.getElementById('aw-to-add')?.addEventListener('click', () => {
            this.collectTipout();
            d.tipout_rows = d.tipout_rows || [];
            d.tipout_rows.push({ staff_id: '', hours: '', cash: '', card: '', sales: '', received: '' });
            this.renderWizardStep(s);
          });
          S.LaborTipLog.recalcBatch();
        }
      }
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

    // Remember the tip choice for next shift, and log tip-out entries to lc_tips
    // before the tip totals below are computed so they reflect what was entered.
    this._lastTipMode = d.tip_mode;
    if (d.tip_mode === 'tipout') await this._saveTipoutRows(s);
    else if (d.tip_mode === 'pool') await this._savePoolOnClose(s);

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
        mode:         d.tip_mode,
        logged_total: ((App.laborData && App.laborData.lc_tips) || [])
          .filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date))
          .reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0),
        pos_reported: d.tips_pos_reported,
        variance:     d.tips_pos_reported != null ? (d.tips_pos_reported - ((App.laborData && App.laborData.lc_tips) || [])
          .filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date))
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
          source:        'shift-close',
          expected_cash: c.expected,
          counted_cash:  c.counted_cash,
          variance:      c.variance,
          tolerance:     tol,
          status:        Math.abs(c.variance) <= tol ? 'Within Tolerance' : c.variance < 0 ? 'Short' : 'Over',
          reason:        '',
          notes:         'Auto-logged from Shift Close wizard',
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
      : '<div style="font-size:11px;color:' + (Math.abs(cv) <= App.cashToleranceForShift(s) ? 'var(--green)' : (cv < 0 ? 'var(--red)' : 'var(--amber)')) + ';font-weight:700;margin-top:6px;">'
        + 'Cash variance ' + (cv > 0 ? '+' : '') + App.fmtCurrency(cv) + ' &middot; auto-logged to Variance Log</div>';
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
      + '<button class="btn btn-ghost" id="ac-hours">Log Staff Hours</button>'
      + '<button class="btn btn-ghost" id="ac-start">Start Another Shift</button>'
      + '<button class="btn btn-ghost" id="ac-history">View Shift History</button>'
      + '</div>'
      + '</div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#ac-start')) this.renderStart();
      else if (ev.target.closest('#ac-history')) App.navigate('sc-shift-history');
      else if (ev.target.closest('#ac-hours')) {
        // Carry this shift's week into Log Hours' Fill-from-Schedule path so the
        // operator confirms scheduled hours instead of hand-logging the whole day.
        if (S.LaborLogHours) {
          S.LaborLogHours._modeOnce = 'schedule';
          S.LaborLogHours._fillWeek = S.LaborLogHours.mondayOf ? S.LaborLogHours.mondayOf(s.date) : '';
        }
        App.openScreen('lc-log-hours');
      }
      else if (ev.target.closest('#ac-handoff')) {
        if (S.ShiftHandoff && S.ShiftHandoff.openForShift) S.ShiftHandoff.openForShift(s.id);
        else App.navigate('sc-shift-history');
      }
    };
  }
};
