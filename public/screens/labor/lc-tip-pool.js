'use strict';

/* ── Labor Control — Tip Pool Calculator (writes lc_tip_pools) ────────────────
   Splits a tip pool across staff — by hours worked or in an equal split. The
   pool and participant hours can be pulled straight from the Tip Log. Saved
   splits go to lc_tip_pools. */

S.LaborTipPool = {
  _pendingDelId: null,
  date: '',
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
    if (!this.date) this.date = new Date().toISOString().slice(0, 10);
    if (!this.rows) this.rows = [];
    this.renderMain();
  },

  renderMain() {
    this.actions.innerHTML = '';
    if (this.staff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">A tip pool is split across your roster. Add staff in Staff Roster, then '
        + 'calculate pools here.</div>'
        + '<button class="btn btn-primary" id="tp-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#tp-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }

    const equal = this.method === 'equal';
    const rowHtml = this.rows.map((r, i) =>
      '<div class="tp-row" data-idx="' + i + '" style="display:flex;gap:10px;align-items:flex-end;'
      + 'flex-wrap:wrap;padding:10px;border:1px solid var(--b1);border-radius:6px;margin-bottom:8px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
      + '<select class="tp-staff">' + App.staffOptions(r.staff_id) + '</select></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Hours</label>'
      + '<input type="number" class="tp-hours" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"'
      + (equal ? ' disabled' : '') + '/></div>'
      + '<div class="f" style="flex:1;min-width:130px;"><label>&nbsp;</label>'
      + '<div class="tp-share" style="font-size:15px;font-weight:600;font-family:\'Barlow Condensed\';color:var(--gold);padding-bottom:6px;">-</div></div>'
      + '<button class="btn btn-ghost btn-sm tp-remove" style="margin-bottom:6px;">Remove</button>'
      + '</div>').join('');

    const setupCard = '<div class="card"><div class="card-title">Tip Pool</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="tp-date" value="' + esc(this.date) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Pool Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tp-pool" min="0" step="0.01" '
      + 'value="' + esc(this.pool) + '"/></div></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Method</label>'
      + '<select id="tp-method"><option value="hours"' + (equal ? '' : ' selected') + '>By Hours Worked</option>'
      + '<option value="equal"' + (equal ? ' selected' : '') + '>Equal Split</option></select></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="tp-load" style="margin-bottom:2px;">Load from Tip Log</button></div>'
      + '</div></div>';

    const participantsCard = '<div class="card"><div class="card-title">Participants</div>'
      + '<div id="tp-rows">' + (rowHtml || '<div style="font-size:12px;color:var(--t3);margin-bottom:8px;">No participants yet. Add staff below or load from the Tip Log.</div>') + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="tp-add">+ Add Participant</button>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Participants</div><div class="calc-val" id="tp-c-count">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val" id="tp-c-hours">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="tp-c-alloc">$0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="tp-c-rem">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="tp-save">Save Tip Pool</button>'
      + '<span id="tp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">' + setupCard + participantsCard + this.historyCard() + '</div>'
      + this.delModal();

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
    document.getElementById('tp-date')?.addEventListener('change', e => {
      this.date = e.target.value;
      // Auto-load tip log for the new date — operator doesn't have to press
      // a button to do the obvious next step.
      this.loadFromTipLog(true);
    });
    document.getElementById('tp-load')?.addEventListener('click', () => this.loadFromTipLog());
    document.getElementById('tp-save')?.addEventListener('click', () => this.save());
    document.getElementById('tp-pool')?.addEventListener('input', () => this.onPoolInput());
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderMain()); return; }
      const hrow = ev.target.closest('.tp-hrow');
      const hview = ev.target.closest('.tp-hview');
      const hdel = ev.target.closest('.tp-hdel');
      if (hdel) { ev.stopPropagation(); this.confirmDel(hdel.dataset.id); }
      else if (hview) { ev.stopPropagation(); this.renderDetail(hview.dataset.id); }
      else if (hrow) this.renderDetail(hrow.dataset.id);
    };
    this.recalc();
  },

  onPoolInput() {
    this.pool = document.getElementById('tp-pool')?.value || '';
    this.recalc();
  },

  collect() {
    this.date = document.getElementById('tp-date')?.value || this.date;
    this.pool = document.getElementById('tp-pool')?.value || '';
    const rows = [...document.querySelectorAll('.tp-row')];
    if (rows.length) {
      this.rows = rows.map(r => ({
        staff_id: r.querySelector('.tp-staff')?.value || '',
        hours: r.querySelector('.tp-hours')?.value || ''
      }));
    }
  },

  // Load participants + pool amount from the tip log entries for the current
  // date. If quiet=true, silently no-op when no entries exist (used for the
  // date-change auto-load so it doesn't pop an error every time). Hours
  // auto-fill from lc_actuals when the tip-log entry didn't capture them.
  loadFromTipLog(quiet) {
    this.collect();
    const date = this.date;
    const dayTips = this.tips().filter(t => t.date === date);
    if (dayTips.length === 0) {
      if (!quiet) {
        const err = document.getElementById('tp-err');
        if (err) { err.textContent = 'No tip log entries found for ' + this.fmtDate(date) + '.'; err.style.display = 'inline'; }
      }
      return;
    }
    const pool = dayTips.reduce((t, x) => t + (x.total_tips || 0), 0);
    this.pool = pool ? String(pool) : '';
    // One participant row per staff member with a tip-log entry that day.
    // Hours come from the tip-log entry first, then fall back to lc_actuals.
    const seen = {};
    this.rows = [];
    dayTips.forEach(t => {
      if (!t.staff_id || seen[t.staff_id]) return;
      seen[t.staff_id] = true;
      const hrs = (t.hours != null && t.hours > 0) ? t.hours : (App.hoursFor(t.staff_id, date) || '');
      this.rows.push({ staff_id: t.staff_id, hours: hrs });
    });
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
      if (shareEl) shareEl.textContent = s.staff_id ? App.fmtCurrency(s.share) : '-';
      alloc += s.share;
      totalHours += s.hours;
      if (s.staff_id) count++;
    });
    const pool = parseFloat(this.pool) || 0;
    const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('tp-c-count', count);
    set('tp-c-hours', totalHours.toFixed(2).replace(/\.00$/, ''));
    set('tp-c-alloc', App.fmtCurrency(alloc));
    const rem = pool - alloc;
    set('tp-c-rem', App.fmtCurrency(rem), Math.abs(rem) > 0.01 ? 'warn' : 'good');
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

    // Auto-link to a shift if the pool's date matches one. Prefer the most
    // recent matching shift. Lets Form 8027 + Tip History group pool splits
    // by shift the same way the Shift Close wizard does.
    const matchShift = ((App.shiftData?.sc_shifts) || [])
      .filter(sh => sh.date === this.date)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

    const rec = {
      id:          App.uid(),
      shift_id:    matchShift ? matchShift.id : '',
      date:        this.date,
      shift_type:  matchShift ? (matchShift.shift_type || '') : '',
      method:      this.method,
      pool_amount: pool,
      total_hours: totalHours,
      participants,
      created_at:  new Date().toISOString()
    };

    const btn = document.getElementById('tp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    this.pools().push(rec);
    const ok = await App.putRecord('lc', 'tip_pool', rec);
    if (ok) {
      this.rows = [];
      this.pool = '';
      this.renderMain();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Tip Pool'; }
      fail('Save failed. Try again.');
    }
  },

  historyCard() {
    const list = [...this.pools()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    if (list.length === 0) return '';
    const rows = list.slice(0, App.listLimit('lc', 'tip_pool')).map(p => '<tr class="tp-hrow" data-id="' + p.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + this.fmtDate(p.date) + '</div></td>'
      + '<td>' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</td>'
      + '<td class="val">' + App.fmtCurrency(p.pool_amount || 0) + '</td>'
      + '<td>' + ((p.participants || []).length) + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm tp-hview" data-id="' + p.id + '">View</button>'
      + '<button class="btn btn-danger btn-sm tp-hdel" data-id="' + p.id + '">Delete</button>'
      + '</div></td></tr>').join('');
    return '<div class="card"><div class="card-title">Saved Tip Pools</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Method</th><th>Pool</th><th>Participants</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('lc', 'tip_pool', list, false) + '</div>';
  },

  renderDetail(id) {
    const p = this.pools().find(x => x.id === id);
    if (!p) { this.renderMain(); return; }
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="tp-export">Export PDF</button>';
    document.getElementById('tp-export')?.addEventListener('click', () => App.exportPDF({ title: 'Tip Pool Calculator', root: this.container }));

    const rows = (p.participants || []).map(pt => '<tr>'
      + '<td><div class="val">' + esc(pt.name || '-') + '</div></td>'
      + '<td>' + (pt.hours != null ? pt.hours : '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(pt.share || 0) + '</td></tr>').join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="tp-back">&#8592; Back to Tip Pool</button></div>'
      + '<div class="card"><div class="card-title">Tip Pool &middot; ' + this.fmtDate(p.date) + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Method</div><div class="calc-val">' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Pool Amount</div><div class="calc-val">' + App.fmtCurrency(p.pool_amount || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val">' + (p.total_hours || 0) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Hours</th><th>Tip Share</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
    this.container.onclick = ev => { if (ev.target.closest('#tp-back')) this.renderMain(); };
  },

  delModal() {
    return '<div id="tp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this tip pool?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="tp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="tp-del-confirm">Delete</button>'
      + '</div></div></div>';
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('tp-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('tp-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('tp-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      await App.removeRecord('lc', 'tip_pool', delId);
      this.renderMain();
    };
  }
};
