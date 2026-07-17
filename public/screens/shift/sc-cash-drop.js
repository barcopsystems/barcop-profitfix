'use strict';

/* ── Shift Control — Cash Drop helpers ───────────────────────────────────────
   Not a routed screen anymore. Cash drops are logged/edited on the Cash Board
   (Cash Control) and viewed on Cash History. This module just holds the shared
   write path so a drop behaves the same wherever it is touched. Each drop
   physically moves money INTO the safe, so persistDrop mirrors it into
   sc_safe_log and removeDrop pulls that mirror back out. */

S.ShiftCashDrop = {
  drops() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_cash_drops)) App.shiftData.sc_cash_drops = [];
    return App.shiftData.sc_cash_drops;
  },

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
