'use strict';

/* ── Labor Control — Tip Pool Log (writes lc_tip_pools) ───────────────────────
   Splits a tip pool across staff — by hours worked or in an equal split. Pick the
   shift and the crew preloads from the posted schedule (the same crew the Shift
   Close pulls); the operator enters the pool amount. Saved splits go to
   lc_tip_pools. */

S.LaborTipPool = {
  _pendingDelId: null,
  _editId: null,      // id of a saved pool being edited (null = building a new one)
  shift_id: '',       // the shift the pool is for (drives the schedule preload)
  date: '',           // derived from the picked shift
  pool: '',
  method: 'hours',
  rows: null,

  pools() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tip_pools)) App.laborData.lc_tip_pools = [];
    return App.laborData.lc_tip_pools;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  tips() { return ((App.laborData && App.laborData.lc_tips) || []); },
  actuals() { return ((App.laborData && App.laborData.lc_actuals) || []); },
  // Pull hours worked for a staff member on a given date from lc_actuals.
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // Keep an in-progress (or being-edited) pool through leaving the screen and
    // coming back, plus the in-screen re-renders — only Save or Start Over resets
    // it. A clean entry (nothing entered) starts fresh on today's date.
    const hasWork = this._editId || this.shift_id || (this.pool !== '' && this.pool != null)
      || (this.rows || []).some(r => r && (r.staff_id || (r.hours !== '' && r.hours != null)));
    if (!hasWork) {
      this.shift_id = '';
      this.date = App.todayLocal();
      this.pool = '';
      this.rows = [];
      this.method = 'hours';
      this._editId = null;
    }
    this.renderMain();
  },

  showHowTo() {
    App.showHelpModal('How the Tip Pool Log Works', [
      { p: ['The Tip Pool Log splits a pool of tips across the staff who share it, either by hours worked or in an equal split. Pick the shift, enter the pool amount, and Bar Cop works out each person\'s share live.'] },
      { h: 'Pick The Shift', p: ['Choosing the shift pre-loads the crew straight from the posted schedule, call-out adjusted, with hours from their logged actuals or their scheduled hours. That is the same crew the Shift Close pulls, so the two match. Add or remove a person and adjust hours, and the shares recompute. Enter the pool amount yourself, since the pool is the total tips you are splitting.'] },
      { h: 'Two Methods', p: ['By Hours Worked splits the pool in proportion to each person\'s hours. Equal Split divides it evenly across participants. Watch the Unallocated figure: it should land at zero when the whole pool is distributed.'] },
      { h: 'Saving And Starting Over', p: ['Save Tip Pool stores the split as a record and feeds the tip-credit check on Pay Periods. Start Over empties the form back to a fresh pool without saving.'] },
      { h: 'Saved Tip Pools', p: ['Every split you save lands in the Saved Tip Pools list at the bottom. View opens a pool to see each person\'s share, with an Export PDF button to print or hand off that split. Edit loads it back into the calculator to fix a number, where Update writes back to the same record instead of making a duplicate. Delete removes a pool you logged in error.'] }
    ]);
  },

  renderMain() {
    this.actions.innerHTML = '';
    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Calculate Your First Tip Pool',
        lead: 'A tip pool is split across your staff by hours worked or in an equal split. Add your staff and you can start calculating.',
        steps: [
          { title: 'Add your staff', desc: 'A pool is split across your roster, so build it first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    const equal = this.method === 'equal';
    const rowHtml = this.rows.map((r, i) => this.participantRowHtml(r, i, equal)).join('');

    const rowsBlock = this.rows.length
      ? '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">'
        + '<table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:240px;">Staff</th><th style="width:120px;">Hours</th>'
        + '<th style="width:130px;">Tip Share</th><th></th><th style="width:100px;"></th>'
        + '</tr></thead><tbody id="tp-rows">' + rowHtml + '</tbody></table></div>'
      : '<div id="tp-rows" style="font-size:12px;color:var(--t3);margin-bottom:8px;">No participants yet. Pick a shift above to load the crew, or add one below.</div>';

    // The split summary + the disclaimer only appear once there are participants,
    // so the empty card stays as clean as the Tip Log's empty state.
    const calcAndHeads = this.rows.length
      ? '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Participants</div><div class="calc-val" id="tp-c-count">0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val" id="tp-c-hours">0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="tp-c-alloc">$0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="tp-c-rem">$0</div></div>'
        + '</div>'
        + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
          + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop splits the pool by the method and hours you enter. It is a calculator, not legal or payroll advice. Tip pool eligibility, mandatory versus voluntary pooling, tip credit, and distribution rules vary by jurisdiction and change over time. Managers, owners, and some non-tipped roles may be barred from a pool. Verify who can participate and the rules for your jurisdiction before distributing tips.</div>'
        + '</div>'
      : '';

    // One card holds the shift/amount/method row AND the participant rows + recon
    // + disclaimer, like the Tip Log's single Log Tips card.
    const card = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-tip-pool', this._editId ? 'Editing Tip Pool' : 'Tip Pool')
      + '<div class="collapse-body">'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:240px;flex-shrink:0;"><label>Shift</label>'
      + '<select id="tp-shift">' + ((S.LaborTipLog && S.LaborTipLog.shiftOptions) ? S.LaborTipLog.shiftOptions(this.shift_id) : '<option value="">Select a shift...</option>') + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Pool Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tp-pool" min="0" step="0.01" '
      + 'value="' + esc(this.pool) + '"/></div></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Method</label>'
      + '<select id="tp-method"><option value="hours"' + (equal ? '' : ' selected') + '>By Hours Worked</option>'
      + '<option value="equal"' + (equal ? ' selected' : '') + '>Equal Split</option></select></div>'
      + '</div>'
      + rowsBlock
      + '<button class="btn btn-ghost btn-sm" id="tp-add">+ Add Participant</button>'
      + calcAndHeads
      + '</div></div>';

    // Save / Clear live BELOW the card (bottom-left), tagged to hide with the card on collapse.
    const actionsRow = '<div data-collapse-group="lc-tip-pool" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="tp-save">' + (this._editId ? 'Update Tip Pool' : 'Save Tip Pool') + '</button>'
      + '<button class="btn btn-ghost" id="tp-clear">Start Over</button>'
      + '<span id="tp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + card + actionsRow + this.historyCard() + '</div>';

    const rowsEl = document.getElementById('tp-rows');
    rowsEl.addEventListener('input', () => { this.collect(); this.recalc(); });
    rowsEl.addEventListener('change', ev => {
      this.collect();
      // When the staff dropdown on a row changes, auto-fill that row's hours
      // from lc_actuals if the hours input is empty. Operator can still
      // override afterwards for tipped-vs-non-tipped hour adjustments.
      if (ev.target.classList && ev.target.classList.contains('tp-staff')) {
        const row = ev.target.closest('.tp-row');
        const idx = row ? parseInt(row.dataset.idx, 10) : -1;
        const hoursInp = row?.querySelector('.tp-hours');
        if (idx >= 0 && hoursInp && !hoursInp.value && this.date) {
          const hrs = App.hoursFor(ev.target.value, this.date);
          if (hrs != null && hrs > 0) {
            hoursInp.value = hrs;
            if (this.rows[idx]) this.rows[idx].hours = hrs;
          }
        }
      }
      this.recalc();
    });
    rowsEl.addEventListener('click', ev => {
      if (ev.target.closest('.tp-remove')) {
        this.collect();
        this.rows.splice(parseInt(ev.target.closest('.tp-row').dataset.idx, 10), 1);
        this.renderMain();
      }
    });
    document.getElementById('tp-add')?.addEventListener('click', () => {
      this.collect();
      this.rows.push({ staff_id: '', hours: '' });
      this.renderMain();
    });
    document.getElementById('tp-method')?.addEventListener('change', e => {
      this.collect();
      this.method = e.target.value;
      this.renderMain();
    });
    // Picking the shift preloads the crew from the schedule (no separate load step).
    document.getElementById('tp-shift')?.addEventListener('change', e => this.loadFromShift(e.target.value));
    document.getElementById('tp-save')?.addEventListener('click', () => this.save());
    document.getElementById('tp-clear')?.addEventListener('click', () => { this._editId = null; this.shift_id = ''; this.rows = []; this.pool = ''; this.method = 'hours'; this.date = App.todayLocal(); this.renderMain(); });
    document.getElementById('tp-pool')?.addEventListener('input', () => this.onPoolInput());
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderMain()); return; }
      const hrow = ev.target.closest('.tp-hrow');
      const hview = ev.target.closest('.tp-hview');
      const hedit = ev.target.closest('.tp-hedit');
      const hdel = ev.target.closest('.tp-hdel');
      if (hdel) { ev.stopPropagation(); this.confirmDel(hdel.dataset.id); }
      else if (hedit) { ev.stopPropagation(); this.editPool(hedit.dataset.id); }
      else if (hview) { ev.stopPropagation(); this.renderDetail(hview.dataset.id); }
      else if (hrow) this.renderDetail(hrow.dataset.id);
    };
    App.applyCollapsed(this.container);
    this.recalc();
  },

  // One participant = one batch-builder table row (same .ing-tbl style as the
  // Void/Comp + Waste builders). Hours is disabled in Equal Split; Tip Share is
  // the live computed cell. Class names match the collect()/recalc() selectors.
  participantRowHtml(r, i, equal) {
    r = r || {};
    return '<tr class="tp-row" data-idx="' + i + '">'
      + '<td><select class="form-input tp-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input tp-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"' + (equal ? ' disabled' : '') + ' style="width:100%;"/></td>'
      + '<td><div class="tp-share" style="font-weight:600;color:var(--t1);">-</div></td>'
      + '<td></td>'
      + '<td><button class="btn btn-ghost btn-sm tp-remove" type="button">Remove</button></td>'
      + '</tr>';
  },

  onPoolInput() {
    this.pool = document.getElementById('tp-pool')?.value || '';
    this.recalc();
  },

  collect() {
    this.pool = document.getElementById('tp-pool')?.value || '';
    const rows = [...document.querySelectorAll('.tp-row')];
    if (rows.length) {
      this.rows = rows.map(r => ({
        staff_id: r.querySelector('.tp-staff')?.value || '',
        hours: r.querySelector('.tp-hours')?.value || ''
      }));
    }
  },

  // Pick a shift -> preload the participants from the posted SCHEDULE (call-out
  // adjusted, hours from logged-actuals-else-scheduled), the same crew Tip Out
  // loads via the Tip Log's preloadFromShift. The pool amount stays operator-
  // entered, since the schedule has no tip totals and a pool house does not log
  // per-person tips. Tip Log state is saved/restored so the call has no side effect.
  loadFromShift(shiftId) {
    this.collect();
    this.shift_id = shiftId || '';
    const TL = S.LaborTipLog;
    const shift = (TL && TL.shiftById) ? TL.shiftById(shiftId) : null;
    if (shiftId && shift) this.date = shift.date || this.date || App.todayLocal();
    let crew = [];
    if (shiftId && TL && TL.preloadFromShift) {
      const savedShift = TL._addShift, savedRows = TL._addRows;
      TL.preloadFromShift(shiftId);
      crew = (TL._addRows || []).map(r => { const st = this.staffById(r.staff_id); return { staff_id: r.staff_id, name: st ? st.name : '', hours: (r.hours != null ? r.hours : '') }; });
      TL._addShift = savedShift; TL._addRows = savedRows;
    }
    this.rows = crew;
    this.renderMain();
  },

  computeShares() {
    const pool = parseFloat(this.pool) || 0;
    const rows = this.rows;
    let totalHours = 0;
    rows.forEach(r => { totalHours += parseFloat(r.hours) || 0; });
    const valid = rows.filter(r => r.staff_id);
    return rows.map(r => {
      let share = 0;
      if (this.method === 'equal') {
        share = valid.length ? pool / valid.length : 0;
      } else {
        const h = parseFloat(r.hours) || 0;
        share = totalHours > 0 ? pool * (h / totalHours) : 0;
      }
      return { staff_id: r.staff_id, hours: parseFloat(r.hours) || 0, share: r.staff_id ? share : 0 };
    });
  },

  recalc() {
    const shares = this.computeShares();
    const rowEls = [...document.querySelectorAll('.tp-row')];
    let alloc = 0, totalHours = 0, count = 0;
    rowEls.forEach((el, i) => {
      const s = shares[i];
      if (!s) return;
      const shareEl = el.querySelector('.tp-share');
      if (shareEl) shareEl.textContent = s.staff_id ? App.fmtCurrency(s.share, 2) : '-';
      alloc += s.share;
      totalHours += s.hours;
      if (s.staff_id) count++;
    });
    const pool = parseFloat(this.pool) || 0;
    const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('tp-c-count', count);
    set('tp-c-hours', totalHours.toFixed(2).replace(/\.00$/, ''));
    set('tp-c-alloc', App.fmtCurrency(alloc, 2));
    const rem = pool - alloc;
    set('tp-c-rem', App.fmtCurrency(rem, 2), Math.abs(rem) > 0.01 ? 'warn' : 'good');
  },

  async save() {
    this.collect();
    const err = document.getElementById('tp-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!this.date) { fail('Date is required.'); return; }
    const pool = parseFloat(this.pool);
    if (isNaN(pool) || pool <= 0) { fail('Enter the pool amount.'); return; }
    const shares = this.computeShares().filter(s => s.staff_id);
    if (shares.length === 0) { fail('Add at least one participant.'); return; }
    if (this.method === 'hours' && shares.every(s => s.hours <= 0)) {
      fail('Enter hours for the hours-based split.'); return;
    }

    let totalHours = 0;
    const participants = shares.map(s => {
      totalHours += s.hours;
      const staff = this.staffById(s.staff_id);
      return { staff_id: s.staff_id, name: staff ? staff.name : '', hours: s.hours, share: s.share };
    });

    // Link the pool to the picked shift (falls back to a date match for an edited
    // pool that predates shift-anchoring). Lets Form 8027 + Tip History group pool
    // splits by shift the same way the Shift Close wizard does.
    const TL = S.LaborTipLog;
    const selShift = (this.shift_id && TL && TL.shiftById) ? TL.shiftById(this.shift_id) : null;
    const matchShift = selShift || ((App.shiftData?.sc_shifts) || [])
      .filter(sh => sh.date === this.date)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

    const existing = this._editId ? this.pools().find(x => x.id === this._editId) : null;
    const rec = {
      id:          this._editId || App.uid(),
      shift_id:    this.shift_id || (matchShift ? matchShift.id : (existing ? existing.shift_id : '')),
      date:        this.date,
      shift_type:  matchShift ? (matchShift.shift_type || '') : (existing ? (existing.shift_type || '') : ''),
      method:      this.method,
      pool_amount: pool,
      total_hours: totalHours,
      participants,
      created_at:  (existing && existing.created_at) ? existing.created_at : new Date().toISOString()
    };
    if (this._editId) rec.updated_at = new Date().toISOString();

    const btn = document.getElementById('tp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const idx = this._editId ? this.pools().findIndex(x => x.id === this._editId) : -1;
    if (idx >= 0) this.pools()[idx] = rec; else this.pools().push(rec);
    const ok = await App.putRecord('lc', 'tip_pool', rec);
    if (ok) {
      this._editId = null;
      this.shift_id = '';
      this.rows = [];
      this.pool = '';
      this.renderMain();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this._editId ? 'Update Tip Pool' : 'Save Tip Pool'; }
      fail('Save failed. Try again.');
    }
  },

  // Load a saved pool back into the calculator to correct it; Update writes back
  // to the SAME record (no duplicate). Cancel Edit / Clear exits edit mode.
  editPool(id) {
    const p = this.pools().find(x => x.id === id);
    if (!p) { this.renderMain(); return; }
    this._editId = id;
    this.shift_id = p.shift_id || '';
    this.date = p.date || App.todayLocal();
    this.pool = (p.pool_amount != null) ? String(p.pool_amount) : '';
    this.method = p.method || 'hours';
    this.rows = (p.participants || []).map(pt => ({ staff_id: pt.staff_id || '', hours: (pt.hours != null ? pt.hours : '') }));
    try { localStorage.removeItem(App._collapseKey('lc-tip-pool')); } catch (e) {}  // make sure the form is open
    this.renderMain();
    const sc = this.container && this.container.closest('.content');
    if (sc) sc.scrollTop = 0;
  },

  historyCard() {
    const list = [...this.pools()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    if (list.length === 0) return '';
    const rows = list.slice(0, App.listLimit('lc', 'tip_pool')).map(p => '<tr class="tp-hrow" data-id="' + p.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + this.fmtDate(p.date) + '</div></td>'
      + '<td>' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</td>'
      + '<td class="val">' + App.fmtCurrency(p.pool_amount || 0, 2) + '</td>'
      + '<td>' + ((p.participants || []).length) + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm tp-hview" data-id="' + p.id + '">View</button>'
      + '<button class="btn btn-ghost btn-sm tp-hedit" data-id="' + p.id + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm tp-hdel" data-id="' + p.id + '">Delete</button>'
      + '</div></td></tr>').join('');
    return '<div class="sh" style="margin:24px 0 10px;">Saved Tip Pools</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Method</th><th>Pool</th><th>Participants</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      + App.showOlderBar('lc', 'tip_pool', list, false);
  },

  renderDetail(id) {
    const p = this.pools().find(x => x.id === id);
    if (!p) { this.renderMain(); return; }
    this.actions.innerHTML = '';

    const rows = (p.participants || []).map(pt => '<tr>'
      + '<td><div class="val">' + esc(pt.name || '-') + '</div></td>'
      + '<td>' + (pt.hours != null ? pt.hours : '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(pt.share || 0, 2) + '</td></tr>').join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Method</div><div class="calc-val lg">' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Pool Amount</div><div class="calc-val lg">' + App.fmtCurrency(p.pool_amount || 0, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val lg">' + (p.total_hours || 0) + '</div></div>'
      + '</div></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Tip Pool &middot; ' + this.fmtDate(p.date) + '</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="tp-export">Export PDF</button></div></div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Hours</th><th>Tip Share</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
    this.container.onclick = null;
    document.getElementById('tp-export')?.addEventListener('click', () => App.exportPDF({ title: 'Tip Pool', root: this.container }));
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'tip_pool', id);
    this.renderMain();
  }
};
