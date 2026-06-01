'use strict';

/* ── Shift Control — Variance Log (writes sc_variances) ───────────────────────
   Records cash over/short per drawer at end of shift: expected (POS) cash vs
   counted cash. The variance tolerance comes from Shift Control Cash Settings.
   sc_variances feeds Profit Recovery's Cash Reconciliation and Theft Risk. */

S.ShiftVarianceLog = {
  editId: null,
  _pendingDelId: null,
  REASONS: ['Miscount at count', 'Change-making error', 'Voids/comps not rung',
            'Tip-out error', 'Suspected theft', 'Unknown'],

  variances() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_variances)) App.shiftData.sc_variances = [];
    return App.shiftData.sc_variances;
  },
  shiftTypes() {
    return App.SHIFT_TYPES;
  },
  tolerance() {
    const t = App.cashToleranceForShift(null);
    return (t != null && !isNaN(t)) ? Number(t) : 10;
  },
  // Variance status. "Not Counted" surfaces when both expected and counted
  // are 0 (or unset) — those rows aren't reconciliations, they're blanks
  // that slipped through. Within tolerance otherwise wins on a true 0 net.
  statusOf(variance, expected, counted) {
    if ((expected === 0 || expected == null) && (counted === 0 || counted == null)) return 'Not Counted';
    const tol = this.tolerance();
    if (Math.abs(variance) <= tol) return 'Within Tolerance';
    return variance > 0 ? 'Over' : 'Short';
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
    addBtn.textContent = 'Log Variance';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => App.exportPDF({ title: 'Variance Log', root: this.container }));
    actions.appendChild(exportBtn);
    this.renderList();
  },

  statusBadge(status) {
    if (status === 'Within Tolerance') return '<span class="badge badge-ok">Within Tolerance</span>';
    if (status === 'Over') return '<span class="badge badge-dim">Over</span>';
    if (status === 'Not Counted') return '<span class="badge badge-dim">Not Counted</span>';
    return '<span class="badge badge-warn">Short</span>';
  },

  renderList() {
    const variances = [...this.variances()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    let html;
    if (variances.length === 0) {
      html = '<div class="empty"><div class="empty-title">No variances logged yet</div>'
        + '<div class="empty-sub">At the end of each shift, log expected cash vs counted cash per drawer. '
        + 'Variances feed your Cash Reconciliation and Theft Risk in Profit Recovery.</div>'
        + '<button class="btn btn-primary" id="vl-add-first">Log Variance</button></div>';
    } else {
      const net = variances.reduce((t, v) => t + (v.variance || 0), 0);
      const flagged = variances.filter(v => v.status === 'Over' || v.status === 'Short').length;
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Variances</div><div class="calc-val">' + variances.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Net Over/Short</div><div class="calc-val ' + (net < 0 ? 'warn' : '') + '">'
        + (net >= 0 ? '+' : '') + App.fmtCurrency(net) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged ? 'warn' : '') + '">' + flagged + '</div></div>'
        + '</div>';
      const rows = variances.map(v => {
        const vr = v.variance || 0;
        const notCounted = v.status === 'Not Counted';
        const cls = notCounted ? '' : v.status === 'Short' ? 'neg' : v.status === 'Over' ? '' : 'pos';
        const varCell = notCounted ? '-' : (vr >= 0 ? '+' : '') + App.fmtCurrency(vr);
        return '<tr class="vl-row" data-id="' + v.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(v.date) + '</div></td>'
          + '<td>' + esc(v.shift_type || '-') + '</td>'
          + '<td>' + esc(v.drawer || '-') + '</td>'
          + '<td>' + esc(v.cashier || '-') + '</td>'
          + '<td>' + App.fmtCurrency(v.expected_cash || 0) + '</td>'
          + '<td>' + App.fmtCurrency(v.counted_cash || 0) + '</td>'
          + '<td class="' + cls + '">' + varCell + '</td>'
          + '<td>' + this.statusBadge(v.status) + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-variance-log') ? '<button class="btn btn-ghost btn-sm vl-edit" data-id="' + v.id + '">Edit</button>' : '')
          + (App.canEdit('sc-variance-log') ? '<button class="btn btn-danger btn-sm vl-del" data-id="' + v.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Cashier</th>'
        + '<th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="vl-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this variance?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="vl-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="vl-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.vl-row');
      const edit = ev.target.closest('.vl-edit');
      const del = ev.target.closest('.vl-del');
      const addF = ev.target.closest('#vl-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('sc-variance-log')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    if (id && !App.canEdit('sc-variance-log')) return;
    this.editId = id || null;
    const v = id ? this.variances().find(x => x.id === id) : null;
    const typeOpts = this.shiftTypes().map(t =>
      '<option' + (v && v.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const reasonOpts = '<option value="">Select reason...</option>'
      + this.REASONS.map(r => '<option' + (v && v.reason === r ? ' selected' : '') + '>' + r + '</option>').join('');
    const val = x => (x != null && x !== '') ? x : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Cash Variance</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="vl-date" value="' + esc(v?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="vl-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Drawer / Register</label>'
      + '<select id="vl-drawer">' + App.drawerOptions(v?.drawer_id || v?.drawer, { placeholder: 'Select drawer...' }) + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Cashier</label>'
      + '<select id="vl-cashier">' + App.staffOptions(v?.cashier_id || v?.cashier, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Expected Cash (POS)</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vl-expected" min="0" step="0.01" '
      + 'value="' + val(v?.expected_cash) + '" oninput="S.ShiftVarianceLog.calc()"/></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Counted Cash</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vl-counted" min="0" step="0.01" '
      + 'value="' + val(v?.counted_cash) + '" oninput="S.ShiftVarianceLog.calc()"/></div></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Reason</label>'
      + '<select id="vl-reason">' + reasonOpts + '</select></div>'
      + '</div>'

      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Variance</div><div class="calc-val" id="vl-c-variance">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val" id="vl-c-status">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Tolerance</div><div class="calc-val dim">&plusmn;' + App.fmtCurrency(this.tolerance()) + '</div></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="vl-notes" rows="2" placeholder="Optional">' + esc(v?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="vl-save">' + (id ? 'Update' : 'Save Variance') + '</button>'
      + '<button class="btn btn-ghost" id="vl-cancel">Cancel</button>'
      + '<span id="vl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('vl-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('vl-save')?.addEventListener('click', () => this.save());
    this.calc();
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value);
    const exp = num('vl-expected'), cnt = num('vl-counted');
    const varEl = document.getElementById('vl-c-variance');
    const statEl = document.getElementById('vl-c-status');
    if (varEl == null || statEl == null) return;
    if (isNaN(exp) || isNaN(cnt)) {
      varEl.textContent = '-'; varEl.className = 'calc-val';
      statEl.textContent = '-'; statEl.className = 'calc-val';
      return;
    }
    const variance = cnt - exp;
    const status = this.statusOf(variance, exp, cnt);
    varEl.textContent = (variance >= 0 ? '+' : '') + App.fmtCurrency(variance);
    varEl.className = 'calc-val ' + (status === 'Short' ? 'warn' : status === 'Not Counted' ? 'dim' : status === 'Over' ? 'dim' : 'good');
    statEl.textContent = status;
    statEl.className = 'calc-val ' + (status === 'Short' ? 'warn' : status === 'Not Counted' ? 'dim' : status === 'Over' ? 'dim' : 'good');
  },

  async save() {
    const err = document.getElementById('vl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('vl-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const exp = parseFloat(document.getElementById('vl-expected')?.value);
    const cnt = parseFloat(document.getElementById('vl-counted')?.value);
    if (isNaN(exp) || isNaN(cnt)) { fail('Enter expected and counted cash.'); return; }
    if (exp === 0 && cnt === 0) { fail('Both expected and counted are zero. Log the real numbers or cancel.'); return; }

    const variance = cnt - exp;
    const rec = {
      id:            this.editId || App.uid(),
      date,
      shift_type:    document.getElementById('vl-type')?.value || '',
      drawer_id:     document.getElementById('vl-drawer')?.value || '',
      drawer:        (App.drawerById(document.getElementById('vl-drawer')?.value) || {}).name || '',
      cashier_id:    document.getElementById('vl-cashier')?.value || '',
      cashier:       (App.staffById(document.getElementById('vl-cashier')?.value) || {}).name || '',
      expected_cash: exp,
      counted_cash:  cnt,
      variance,
      tolerance:     this.tolerance(),
      status:        this.statusOf(variance, exp, cnt),
      reason:        document.getElementById('vl-reason')?.value || '',
      notes:         document.getElementById('vl-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.variances();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('vl-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Variance'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('vl-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('vl-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('vl-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_variances = this.variances().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderList();
    };
  }
};
