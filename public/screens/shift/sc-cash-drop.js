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
    // ⚠ DO NOT place the row in `list` before the write (S62) — see the full note in
    // sc-variance-log.persistVariance. The merge is load-bearing, so build it without touching
    // the list and let putRecord place it (and revert or splice it out on a refusal).
    const saved = i > -1 ? { ...list[i], ...rec } : rec;
    const ok = await App.putRecord('sc', 'cash_drop', saved);
    // ⚠ THE MIRROR IS WRITTEN ONLY IF THE DROP ITSELF LANDED, AND ITS RESULT IS CHECKED (S62).
    // This used to fire unconditionally — even when `ok` was already false — and discard what it
    // returned, so the server could hold a "Cash Drop +$400 in" safe entry with NO drop behind
    // it. sc-safe-log accumulates dir:'in'/'out' into the running safe balance, which is the
    // figure an owner counts the physical safe against, so it read $400 high permanently with
    // nothing on screen saying so.
    if (!ok) return false;
    if (safeEntry && !(await App.putRecord('sc', 'safe_log', safeEntry))) return false;
    App.markSetupDone('gs_sc_cash');
    return true;
  },

  async removeDrop(id) {
    const drop = this.drops().find(x => x.id === id);
    // ⚠ THE DROP GOES FIRST, and the mirror only once that landed (S62, the twin of persistDrop).
    // The old order pulled the safe entry out first and DISCARDED the result, so a succeeded-
    // mirror / failed-drop pair left a drop with no mirror and the running safe balance reading
    // $400 LOW — a wrong number. This order fails the other way: the safe entry may outlive its
    // drop, which leaves the BALANCE STILL CORRECT (the money really did go into the safe) and
    // the orphan visible and deletable on the Safe Log screen.
    const ok = await App.removeRecord('sc', 'cash_drop', id);
    if (!ok) return false;
    if (drop && drop.safe_log_id) return await App.removeRecord('sc', 'safe_log', drop.safe_log_id);
    return true;
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
    // ⚠ BUILDS the entry, never writes it into `log` (S62). It used to splice the merged row into
    // the live list / push the new one before anything was saved, which is what defeated
    // putRecord's revert for the mirror as well as the drop. persistDrop hands what this returns
    // to putRecord, and putRecord is what places it.
    if (dropRec.safe_log_id) {
      const i = log.findIndex(x => x.id === dropRec.safe_log_id);
      if (i > -1) return { ...log[i], ...fields };
    }
    return { id: App.uid(), ...fields, created_at: new Date().toISOString() };
  }
};
