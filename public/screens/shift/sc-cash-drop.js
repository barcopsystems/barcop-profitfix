'use strict';

/* ── Shift Control — Cash Drop (writes sc_cash_drops) ─────────────────────────
   Mobile-first. Records cash pulled from a register to the safe during/after a
   shift. An optional denomination grid counts the drop and auto-fills the
   amount. sc_cash_drops feeds Profit Recovery's Cash Reconciliation. */

S.ShiftCashDrop = {
  editId: null,
  _pendingDelId: null,
  DENOMS: [
    { key: 'h100', label: '$100', val: 100 },
    { key: 'h50',  label: '$50',  val: 50 },
    { key: 'h20',  label: '$20',  val: 20 },
    { key: 'h10',  label: '$10',  val: 10 },
    { key: 'h5',   label: '$5',   val: 5 },
    { key: 'h1',   label: '$1',   val: 1 }
  ],

  drops() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_cash_drops)) App.shiftData.sc_cash_drops = [];
    return App.shiftData.sc_cash_drops;
  },
  shiftTypes() {
    return (S.ShiftLogShift && S.ShiftLogShift.SHIFT_TYPES) || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'];
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Cash Drop';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    this.renderList();
  },

  renderList() {
    const drops = [...this.drops()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    let html;
    if (drops.length === 0) {
      html = '<div class="empty"><div class="empty-title">No cash drops logged yet</div>'
        + '<div class="empty-sub">Record each cash drop from a register to the safe. Drops feed your '
        + 'Cash Reconciliation in Profit Recovery automatically.</div>'
        + '<button class="btn btn-primary" id="cd-add-first">Log Cash Drop</button></div>';
    } else {
      const total = drops.reduce((t, d) => t + (d.amount || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Drops</div><div class="calc-val">' + drops.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Dropped</div><div class="calc-val">' + App.fmtCurrency(total) + '</div></div>'
        + '</div>';
      const rows = drops.map(d => '<tr class="cd-row" data-id="' + d.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
        + '<td>' + esc(d.shift_type || '-') + '</td>'
        + '<td>' + esc(d.drawer || '-') + '</td>'
        + '<td>' + esc(d.performed_by || '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td>'
        + '<td><div class="row-actions">'
        + (App.canEdit('sc-cash-drop') ? '<button class="btn btn-ghost btn-sm cd-edit" data-id="' + d.id + '">Edit</button>' : '')
        + (App.canEdit('sc-cash-drop') ? '<button class="btn btn-danger btn-sm cd-del" data-id="' + d.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Performed By</th><th>Amount</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="cd-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this cash drop?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="cd-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="cd-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.cd-row');
      const edit = ev.target.closest('.cd-edit');
      const del = ev.target.closest('.cd-del');
      const addF = ev.target.closest('#cd-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    this.editId = id || null;
    const d = id ? this.drops().find(x => x.id === id) : null;
    const typeOpts = this.shiftTypes().map(t =>
      '<option' + (d && d.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';
    const den = d && d.denominations ? d.denominations : {};

    const denomRows = this.DENOMS.map(dn =>
      '<div class="form-row" style="gap:14px;align-items:center;margin-bottom:10px;">'
      + '<div style="width:64px;flex-shrink:0;font-size:15px;font-weight:700;color:var(--t1);">' + dn.label + '</div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Count</label>'
      + '<input type="number" class="cd-denom" data-key="' + dn.key + '" data-val="' + dn.val + '" '
      + 'min="0" step="1" inputmode="numeric" value="' + v(den[dn.key]) + '" '
      + 'style="height:44px;font-size:16px;" oninput="S.ShiftCashDrop.calc()"/></div>'
      + '<div class="f" style="flex:1;"><label>Subtotal</label>'
      + '<div class="f-display cd-sub" data-key="' + dn.key + '" style="font-size:15px;">$0</div></div>'
      + '</div>').join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">' + (id ? 'Edit' : 'Log') + ' Cash Drop</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="cd-date" value="' + esc(d?.date || new Date().toISOString().slice(0, 10)) + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="cd-type" style="height:44px;">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Time</label>'
      + '<input type="time" id="cd-time" value="' + esc(d?.drop_time || '') + '" style="height:44px;"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Drawer / Register</label>'
      + '<input type="text" id="cd-drawer" value="' + esc(d?.drawer || '') + '" placeholder="e.g. Bar 1" style="height:44px;"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Performed By</label>'
      + '<input type="text" id="cd-by" value="' + esc(d?.performed_by || '') + '" placeholder="Name" style="height:44px;"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Witness</label>'
      + '<input type="text" id="cd-witness" value="' + esc(d?.witness || '') + '" placeholder="Optional" style="height:44px;"/></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Count the Drop</div>'
      + denomRows
      + '<div class="form-row" style="gap:14px;align-items:center;margin-bottom:0;">'
      + '<div style="width:64px;flex-shrink:0;font-size:15px;font-weight:700;color:var(--t1);">Coins</div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cd-coins" min="0" step="0.01" '
      + 'inputmode="decimal" value="' + v(den.coins) + '" style="height:44px;font-size:16px;" oninput="S.ShiftCashDrop.calc()"/></div></div>'
      + '<div class="f" style="flex:1;"></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Amount Dropped</div>'
      + '<div class="form-row" style="gap:16px;align-items:flex-end;margin-bottom:0;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cd-amount" min="0" step="0.01" '
      + 'inputmode="decimal" value="' + v(d?.amount) + '" style="height:52px;font-size:22px;"/></div></div>'
      + '<div class="f" style="flex:1;"><label>&nbsp;</label>'
      + '<div style="font-size:12px;color:var(--t3);padding-bottom:14px;">Counted total auto-fills here. '
      + 'Edit directly if you are not counting by denomination.</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-top:14px;margin-bottom:0;">'
      + '<div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="cd-notes" rows="2" placeholder="Optional">' + esc(d?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="cd-save">' + (id ? 'Update' : 'Save Drop') + '</button>'
      + '<button class="btn btn-ghost" id="cd-cancel">Cancel</button>'
      + '<span id="cd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('cd-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('cd-save')?.addEventListener('click', () => this.save());
    this._countedEntered = false;
    this.calc();
  },

  calc() {
    let counted = 0, anyDenom = false;
    document.querySelectorAll('.cd-denom').forEach(inp => {
      const count = parseInt(inp.value, 10) || 0;
      const val = parseFloat(inp.dataset.val) || 0;
      const sub = count * val;
      if (count > 0) anyDenom = true;
      const subEl = document.querySelector('.cd-sub[data-key="' + inp.dataset.key + '"]');
      if (subEl) subEl.textContent = App.fmtCurrency(sub);
      counted += sub;
    });
    const coins = parseFloat(document.getElementById('cd-coins')?.value) || 0;
    if (coins > 0) anyDenom = true;
    counted += coins;

    if (anyDenom) {
      const amtEl = document.getElementById('cd-amount');
      if (amtEl) amtEl.value = counted.toFixed(2);
    }
  },

  async save() {
    const err = document.getElementById('cd-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('cd-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('cd-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter the amount dropped.'); return; }

    const denominations = {};
    document.querySelectorAll('.cd-denom').forEach(inp => {
      const c = parseInt(inp.value, 10);
      if (!isNaN(c) && c > 0) denominations[inp.dataset.key] = c;
    });
    const coins = parseFloat(document.getElementById('cd-coins')?.value);
    if (!isNaN(coins) && coins > 0) denominations.coins = coins;

    const rec = {
      id:            this.editId || App.uid(),
      date,
      shift_type:    document.getElementById('cd-type')?.value || '',
      drop_time:     document.getElementById('cd-time')?.value || '',
      drawer:        document.getElementById('cd-drawer')?.value.trim() || '',
      performed_by:  document.getElementById('cd-by')?.value.trim() || '',
      witness:       document.getElementById('cd-witness')?.value.trim() || '',
      amount,
      denominations,
      notes:         document.getElementById('cd-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.drops();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('cd-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_sc_cash');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Drop'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('cd-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('cd-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('cd-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_cash_drops = this.drops().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderList();
    };
  }
};
