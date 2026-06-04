'use strict';

/* ── Shift Control — Cash Drop History (read-only) ───────────────────────────
   A read-only, filterable, exportable record of every cash drop. Drops are
   logged and edited on the Cash Board (Cash Control), which writes through the
   shared persistDrop helper here. Each drop physically moves money INTO the
   safe, so persistDrop mirrors it into sc_safe_log and removeDrop pulls that
   mirror back out. */

S.ShiftCashDrop = {
  fFrom: '', fTo: '', fDrawer: '', fBy: '',

  drops() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_cash_drops)) App.shiftData.sc_cash_drops = [];
    return App.shiftData.sc_cash_drops;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';   // Export lives on the Filter card
    this.renderList();
  },

  applyFilters(list) {
    return list.filter(d => {
      const date = d.date || '';
      if (this.fFrom && date < this.fFrom) return false;
      if (this.fTo && date > this.fTo) return false;
      if (this.fDrawer && (d.drawer || '') !== this.fDrawer) return false;
      if (this.fBy && (d.performed_by || '') !== this.fBy) return false;
      return true;
    });
  },

  filterCard(stats) {
    const drawerNames = [...new Set(this.drops().map(d => d.drawer).filter(Boolean))].sort();
    const byNames = [...new Set(this.drops().map(d => d.performed_by).filter(Boolean))].sort();
    const drawerOpts = '<option value="">All drawers</option>' + drawerNames.map(n => '<option' + (this.fDrawer === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
    const byOpts = '<option value="">All staff</option>' + byNames.map(n => '<option' + (this.fBy === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span><button class="btn btn-ghost btn-sm" id="cd-export">Export PDF</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="cd-f-from" value="' + esc(this.fFrom) + '"/></div>'
      +   '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="cd-f-to" value="' + esc(this.fTo) + '"/></div>'
      +   '<div class="f" style="width:180px;flex-shrink:0;"><label>Drawer</label><select id="cd-f-drawer">' + drawerOpts + '</select></div>'
      +   '<div class="f" style="width:180px;flex-shrink:0;"><label>Performed By</label><select id="cd-f-by">' + byOpts + '</select></div>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="cd-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>' + (stats || '') + '</div>';
  },

  renderList() {
    const all = [...this.drops()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Cash Drop History',
        lead: 'Every cash drop you log shows here as a read-only record you can filter and export. Log drops on the Cash Board.',
        steps: [{ title: 'Log a cash drop', desc: 'Pull cash from a register to the safe on the Cash Board.', btn: 'Go to Cash Board', screen: 'sc-cash-control' }]
      });
      return;
    }

    const filtered = this.applyFilters(all);
    const total = filtered.reduce((t, d) => t + (d.amount || 0), 0);
    const stats = '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Drops</div><div class="calc-val">' + filtered.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Dropped</div><div class="calc-val">' + App.fmtCurrency(total) + '</div></div>'
      + '</div>';

    let listHtml;
    if (filtered.length === 0) {
      listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No cash drops match the filter.</div>';
    } else {
      const rows = filtered.slice(0, App.listLimit('sc', 'cash_drop')).map(d => '<tr>'
        + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
        + '<td>' + esc(d.shift_type || '-') + '</td>'
        + '<td>' + esc(d.drawer || '-') + '</td>'
        + '<td>' + esc(d.performed_by || '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td>'
        + '</tr>').join('');
      listHtml = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Performed By</th><th>Amount</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'cash_drop', filtered, false);
    }

    this.container.innerHTML = '<div class="screen">' + this.filterCard(stats) + listHtml
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Read-only. Log, edit, or delete drops on the Cash Board.</div></div>';

    document.getElementById('cd-export')?.addEventListener('click', () => App.exportPDF({ title: 'Cash Drop History', root: this.container }));
    document.getElementById('cd-f-from')?.addEventListener('change', e => { this.fFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('cd-f-to')?.addEventListener('change', e => { this.fTo = e.target.value || ''; this.renderList(); });
    document.getElementById('cd-f-drawer')?.addEventListener('change', e => { this.fDrawer = e.target.value || ''; this.renderList(); });
    document.getElementById('cd-f-by')?.addEventListener('change', e => { this.fBy = e.target.value || ''; this.renderList(); });
    document.getElementById('cd-f-clear')?.addEventListener('click', () => { this.fFrom = this.fTo = this.fDrawer = this.fBy = ''; this.renderList(); });
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); }
    };
  },

  // ── Shared write path (called by the Cash Board) ────────────────────────────
  async persistDrop(rec) {
    const list = this.drops();
    const safeEntry = this._syncSafeLog(rec);
    rec.safe_log_id = safeEntry ? safeEntry.id : null;
    const i = list.findIndex(x => x.id === rec.id);
    if (i > -1) list[i] = { ...list[i], ...rec }; else list.push(rec);
    const saved = i > -1 ? list[i] : rec;
    const ok = await App.putRecord('sc', 'cash_drop', saved);
    if (safeEntry) await App.putRecord('sc', 'safe_log', safeEntry);
    if (ok) App.markSetupDone('gs_sc_cash');
    return ok;
  },

  async removeDrop(id) {
    const drop = this.drops().find(x => x.id === id);
    if (drop && drop.safe_log_id) await App.removeRecord('sc', 'safe_log', drop.safe_log_id);
    return await App.removeRecord('sc', 'cash_drop', id);
  },

  _syncSafeLog(dropRec) {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_safe_log)) App.shiftData.sc_safe_log = [];
    const log = App.shiftData.sc_safe_log;
    const fields = {
      date:         dropRec.date,
      time:         dropRec.drop_time || '',
      txn_type:     'Cash Drop',
      direction:    'in',
      amount:       dropRec.amount,
      reference:    'Drawer: ' + (dropRec.drawer || '-') + (dropRec.shift_type ? ' / ' + dropRec.shift_type : ''),
      performed_by: dropRec.performed_by || '',
      witness:      dropRec.witness || '',
      notes:        dropRec.notes || '',
      source:       'cash-drop',
      source_id:    dropRec.id
    };
    if (dropRec.safe_log_id) {
      const i = log.findIndex(x => x.id === dropRec.safe_log_id);
      if (i > -1) { log[i] = { ...log[i], ...fields }; return log[i]; }
    }
    const newEntry = { id: App.uid(), ...fields, created_at: new Date().toISOString() };
    log.push(newEntry);
    return newEntry;
  }
};
