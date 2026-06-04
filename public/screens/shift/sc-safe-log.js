'use strict';

/* ── Shift Control — Safe Log (writes sc_safe_log) ────────────────────────────
   A running ledger of cash moving in and out of the safe — drops, banks issued
   and returned, bank deposits, paid-outs. Each entry carries a running balance
   so the operator always knows what should be in the safe. */

S.ShiftSafeLog = {
  editId: null,
  _pendingDelId: null,
  TYPES: [
    { name: 'Opening Balance', dir: 'in' },
    { name: 'Cash Drop',       dir: 'in' },
    { name: 'Bank Returned',   dir: 'in' },
    { name: 'Cash Added',      dir: 'in' },
    { name: 'Bank Issued',     dir: 'out' },
    { name: 'Bank Deposit',    dir: 'out' },
    { name: 'Paid Out',        dir: 'out' }
  ],

  entries() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_safe_log)) App.shiftData.sc_safe_log = [];
    return App.shiftData.sc_safe_log;
  },
  dirOf(typeName) {
    const t = this.TYPES.find(x => x.name === typeName);
    return t ? t.dir : 'in';
  },
  // chronological, oldest first — order entries carry a running balance
  chrono() {
    return [...this.entries()].sort((a, b) => {
      const ka = (a.date || '') + 'T' + (a.time || '00:00') + '|' + (a.created_at || '');
      const kb = (b.date || '') + 'T' + (b.time || '00:00') + '|' + (b.created_at || '');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
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
    addBtn.textContent = 'Add Entry';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => App.exportPDF({ title: 'Safe Log', root: this.container }));
    actions.appendChild(exportBtn);
    this.renderList();
  },

  renderList() {
    const chrono = this.chrono();

    let html;
    if (chrono.length === 0) {
      html = '<div class="empty"><div class="empty-title">No safe activity logged yet</div>'
        + '<div class="empty-sub">Record cash moving in and out of the safe: drops, banks, deposits, '
        + 'paid-outs. Each entry keeps a running balance so you always know what should be in the safe.</div>'
        + '<button class="btn btn-primary" id="sl-add-first">Add Entry</button></div>';
    } else {
      let bal = 0;
      const withBal = chrono.map(e => {
        const signed = (e.direction === 'out' ? -1 : 1) * (e.amount || 0);
        bal += signed;
        return { e, signed, bal };
      });
      const totalIn = withBal.filter(r => r.signed > 0).reduce((t, r) => t + r.signed, 0);
      const totalOut = withBal.filter(r => r.signed < 0).reduce((t, r) => t - r.signed, 0);

      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Safe Balance</div><div class="calc-val good">' + App.fmtCurrency(bal) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total In</div><div class="calc-val">' + App.fmtCurrency(totalIn) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Out</div><div class="calc-val">' + App.fmtCurrency(totalOut) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + chrono.length + '</div></div>'
        + '</div>';

      const ordered = withBal.reverse();
      const rows = ordered.slice(0, App.listLimit('sc', 'safe_log')).map(r => {
        const e = r.e;
        const amtCell = r.signed < 0
          ? '<span class="neg">' + App.fmtCurrency(r.signed) + '</span>'
          : '<span class="pos">+' + App.fmtCurrency(r.signed) + '</span>';
        return '<tr class="sl-row" data-id="' + e.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(e.date) + '</div>'
          + (e.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(e.time) + '</div>' : '') + '</td>'
          + '<td>' + esc(e.txn_type || '-') + '</td>'
          + '<td>' + esc(e.performed_by || '-') + '</td>'
          + '<td>' + esc(e.reference || '-') + '</td>'
          + '<td>' + amtCell + '</td>'
          + '<td class="val">' + App.fmtCurrency(r.bal) + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-safe-log') ? '<button class="btn btn-ghost btn-sm sl-edit" data-id="' + e.id + '">Edit</button>' : '')
          + (App.canEdit('sc-safe-log') ? '<button class="btn btn-danger btn-sm sl-del" data-id="' + e.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Performed By</th><th>Reference</th>'
        + '<th>Amount</th><th>Balance</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'safe_log', ordered, false);
    }

    const modal = '<div id="sl-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this safe entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="sl-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="sl-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.sl-row');
      const edit = ev.target.closest('.sl-edit');
      const del = ev.target.closest('.sl-del');
      const addF = ev.target.closest('#sl-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('sc-safe-log')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    if (id && !App.canEdit('sc-safe-log')) return;
    this.editId = id || null;
    const e = id ? this.entries().find(x => x.id === id) : null;
    const typeOpts = this.TYPES.map(t =>
      '<option' + (e && e.txn_type === t.name ? ' selected' : '') + '>' + t.name + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Add') + ' Safe Entry</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="sl-date" value="' + esc(e?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Time</label>'
      + '<input type="time" id="sl-time" value="' + esc(e?.time || (() => { const n = new Date(); return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0'); })()) + '"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Type</label>'
      + '<select id="sl-type">' + typeOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sl-amount" min="0" step="0.01" value="' + v(e?.amount) + '"/></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Direction</label>'
      + '<div class="f-display" id="sl-dir" style="height:36px;display:flex;align-items:center;">-</div></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Reference</label>'
      + '<input type="text" id="sl-ref" value="' + esc(e?.reference || '') + '" placeholder="e.g. Bar 1, Deposit #"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Performed By</label>'
      + '<select id="sl-by">' + App.staffOptions(e?.performed_by_id || e?.performed_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Witness</label>'
      + '<select id="sl-witness">' + App.staffOptions(e?.witness_id || e?.witness, { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="sl-notes" rows="2" placeholder="Optional">' + esc(e?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="sl-save">' + (id ? 'Update' : 'Save Entry') + '</button>'
      + '<button class="btn btn-ghost" id="sl-cancel">Cancel</button>'
      + '<span id="sl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    const updateDir = () => {
      const dir = this.dirOf(document.getElementById('sl-type')?.value);
      const el = document.getElementById('sl-dir');
      if (el) {
        el.textContent = dir === 'out' ? 'Out of safe' : 'Into safe';
        el.style.color = dir === 'out' ? 'var(--red)' : 'var(--gold)';
      }
    };
    document.getElementById('sl-type')?.addEventListener('change', updateDir);
    document.getElementById('sl-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('sl-save')?.addEventListener('click', () => this.save());
    updateDir();
  },

  async save() {
    const err = document.getElementById('sl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('sl-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('sl-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter an amount.'); return; }

    const txnType = document.getElementById('sl-type')?.value || '';
    const rec = {
      id:           this.editId || App.uid(),
      date,
      time:         document.getElementById('sl-time')?.value || '',
      txn_type:     txnType,
      direction:    this.dirOf(txnType),
      amount,
      reference:    document.getElementById('sl-ref')?.value.trim() || '',
      performed_by_id: document.getElementById('sl-by')?.value || '',
      performed_by:    (App.staffById(document.getElementById('sl-by')?.value) || {}).name || '',
      witness_id:      document.getElementById('sl-witness')?.value || '',
      witness:         (App.staffById(document.getElementById('sl-witness')?.value) || {}).name || '',
      notes:        document.getElementById('sl-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const btn = document.getElementById('sl-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await this.persistEntry(rec);
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Entry'; }
      fail('Save failed. Try again.');
    }
  },

  // Persist a safe entry (upsert + one row). Shared by this screen and the Cash
  // Board's pop-up actions so a safe move logged either door behaves the same.
  async persistEntry(rec) {
    const list = this.entries();
    const i = list.findIndex(x => x.id === rec.id);
    if (i > -1) list[i] = { ...list[i], ...rec }; else list.push(rec);
    const saved = i > -1 ? list[i] : rec;
    return await App.putRecord('sc', 'safe_log', saved);
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('sl-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('sl-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('sl-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      await App.removeRecord('sc', 'safe_log', delId);
      this.renderList();
    };
  }
};
