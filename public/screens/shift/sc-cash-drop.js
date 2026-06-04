'use strict';

/* ── Shift Control — Cash Drop History (read-only) ───────────────────────────
   A read-only, exportable record of every cash drop. Drops are logged and
   edited on the Cash Board (Cash Control), which writes through the shared
   persistDrop helper here so a drop behaves the same wherever it is read. Each
   drop physically moves money INTO the safe, so persistDrop mirrors it into
   sc_safe_log and removeDrop pulls that mirror back out. */

S.ShiftCashDrop = {
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
    actions.innerHTML = '';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => App.exportPDF({ title: 'Cash Drop History', root: this.container }));
    actions.appendChild(exportBtn);
    this.renderList();
  },

  renderList() {
    const drops = [...this.drops()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    if (drops.length === 0) {
      App.setupCard(this.container, {
        title: 'Cash Drop History',
        lead: 'Every cash drop you log shows here as a read-only record you can export. Log drops on the Cash Board.',
        steps: [{ title: 'Log a cash drop', desc: 'Pull cash from a register to the safe on the Cash Board.', btn: 'Go to Cash Board', screen: 'sc-cash-control' }]
      });
      return;
    }

    const total = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Drops</div><div class="calc-val">' + drops.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Dropped</div><div class="calc-val">' + App.fmtCurrency(total) + '</div></div>'
      + '</div>';
    const rows = drops.slice(0, App.listLimit('sc', 'cash_drop')).map(d => '<tr>'
      + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
      + '<td>' + esc(d.shift_type || '-') + '</td>'
      + '<td>' + esc(d.drawer || '-') + '</td>'
      + '<td>' + esc(d.performed_by || '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td>'
      + '</tr>').join('');
    const html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Performed By</th><th>Amount</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('sc', 'cash_drop', drops, false)
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Read-only. Log, edit, or delete drops on the Cash Board.</div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); }
    };
  },

  // ── Shared write path (called by the Cash Board) ────────────────────────────
  // Persist a drop + mirror it into the safe log. On edit, update the linked
  // safe entry in place; on new, create it and store its id back on the drop.
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

  // Mirror a cash drop into sc_safe_log as a Cash Drop entry (money into the
  // safe). Returns the safe entry so the caller links + persists it. Updates the
  // linked entry on edit, creates one on new.
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
