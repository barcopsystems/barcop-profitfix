'use strict';

/* ── Shift Control — Walked Tabs Log (writes sc_walked_tabs) ──────────────────
   Tracks customers who leave without paying: walked tabs, dine-and-dash,
   mis-billed checks, lost-check write-offs. Real dollar losses that today
   evaporate into "I think we lost $73 somewhere on Saturday."

   Each record captures the server who had the table, the amount, the reason
   code, and the manager who absorbed the loss. The log feeds Books shrinkage
   attribution and creates a server trend signal (is this server's walk rate
   genuinely worse than the rest of the floor, or is it the neighborhood?). */

S.ShiftWalkedTabs = {
  editId: null,
  filterFrom: '',
  filterTo: '',
  filterServerId: '',
  filterReason: '',

  REASONS: ['Walked', 'Mis-bill', 'Refused to Pay', 'Lost Check', 'Other'],

  tabs() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_walked_tabs)) App.shiftData.sc_walked_tabs = [];
    return App.shiftData.sc_walked_tabs;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="wt-export">Export PDF</button>';
    document.getElementById('wt-export')?.addEventListener('click', () => App.exportPDF({ title: 'Walked Tabs', root: this.container }));

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Log Walked Tab';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.tabs();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

    const totalLoss = filtered.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + filtered.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Loss</div><div class="calc-val warn">' + App.fmtCurrency(totalLoss) + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No walked tabs logged yet</div>'
        + '<div class="empty-sub">Every time a customer leaves without paying, a check gets mis-billed, or a tab is lost, log it here. The data attributes losses to the right server and shift instead of letting them evaporate into the weekly total.</div>'
        + '<button class="btn btn-primary" id="wt-add-first">Log Your First Walked Tab</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No entries match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      const rows = filtered.slice(0, App.listLimit('sc', 'walked_tab')).map(r => {
        return '<tr class="wt-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div>'
          + (r.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.time) + '</div>' : '') + '</td>'
          + '<td>' + esc(r.server || '-') + '</td>'
          + '<td>' + esc(r.check_ref || '-') + '</td>'
          + '<td class="val neg">' + App.fmtCurrency(r.amount || 0) + '</td>'
          + '<td>' + esc(r.reason || '-') + '</td>'
          + '<td>' + esc(r.manager || '-') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm wt-edit" data-id="' + r.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm wt-del" data-id="' + r.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = summary + this.filterCard()
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>When</th><th>Server</th><th>Check / Table</th><th>Amount</th><th>Reason</th><th>Manager</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'walked_tab', filtered, !!(this.filterFrom || this.filterTo || this.filterServerId || this.filterReason));
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  filterCard() {
    const reasonOpts = '<option value="">All reasons</option>'
      + this.REASONS.map(r => '<option value="' + esc(r) + '"' + (this.filterReason === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="wt-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="wt-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Server</label>'
          + '<select id="wt-f-server">' + App.staffOptions(this.filterServerId, { placeholder: 'All servers' }) + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label><select id="wt-f-reason">' + reasonOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="wt-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(r => {
      const date = r.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterServerId && r.server_id !== this.filterServerId) return false;
      if (this.filterReason && r.reason !== this.filterReason) return false;
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.wt-row');
      const edit = ev.target.closest('.wt-edit');
      const del  = ev.target.closest('.wt-del');
      const addF = ev.target.closest('#wt-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('wt-f-from')?.addEventListener('change',   e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('wt-f-to')?.addEventListener('change',     e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('wt-f-server')?.addEventListener('change', e => { this.filterServerId = e.target.value || ''; this.renderList(); });
    document.getElementById('wt-f-reason')?.addEventListener('change', e => { this.filterReason = e.target.value || ''; this.renderList(); });
    document.getElementById('wt-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterServerId = this.filterReason = '';
      this.renderList();
    });
  },

  showForm(id) {
    this.editId = id || null;
    const r = id ? this.tabs().find(x => x.id === id) : null;
    const reasonOpts = this.REASONS.map(rs =>
      '<option' + (r && r.reason === rs ? ' selected' : '') + '>' + esc(rs) + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Walked Tab' : 'Log a Walked Tab') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Document the loss while it\'s fresh. Server, amount, what happened. The log feeds Books shrinkage attribution and tells you which servers have higher walk rates than the rest of the floor.</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="wt-date" value="' + esc(r?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Time</label>'
          + '<input type="time" id="wt-time" value="' + esc(r?.time || this.nowTime()) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label>'
          + '<select id="wt-reason">' + reasonOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Server</label>'
          + '<select id="wt-server">' + App.staffOptions(r?.server_id || r?.server, { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Check / Table #</label>'
          + '<input type="text" id="wt-check" value="' + esc(r?.check_ref || '') + '" placeholder="Optional"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Amount</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="wt-amount" min="0" step="0.01" value="' + v(r?.amount) + '" placeholder="0.00"/></div></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Manager (absorbing the loss)</label>'
          + '<select id="wt-mgr">' + App.staffOptions(r?.manager_id || App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'

      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="wt-notes" rows="3" placeholder="What happened. Did the customer leave during a rush? Did the server forget to ring the check? Anything that helps you spot patterns later.">' + esc(r?.notes || '') + '</textarea></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="wt-save">' + (id ? 'Update' : 'Log Walked Tab') + '</button>'
        + '<button class="btn btn-ghost" id="wt-cancel">Cancel</button>'
        + '<span id="wt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('wt-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('wt-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('wt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('wt-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('wt-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter the dollar amount lost.'); return; }
    const serverId = document.getElementById('wt-server')?.value || '';
    if (!serverId) { fail('Pick the server.'); return; }
    const managerId = document.getElementById('wt-mgr')?.value || '';
    if (!managerId) { fail('Pick the manager.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      date,
      time:        document.getElementById('wt-time')?.value || '',
      server_id:   serverId,
      server:      (App.staffById(serverId) || {}).name || '',
      check_ref:   document.getElementById('wt-check')?.value.trim() || '',
      amount,
      reason:      document.getElementById('wt-reason')?.value || 'Walked',
      manager_id:  managerId,
      manager:     (App.staffById(managerId) || {}).name || '',
      notes:       document.getElementById('wt-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.tabs();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('wt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'walked_tab', saved);
    this.editId = null;
    if (ok) this.renderList();
    else {
      if (btn) { btn.disabled = false; btn.textContent = 'Log Walked Tab'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this walked tab entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('sc', 'walked_tab', id);
    this.renderList();
  }
};
