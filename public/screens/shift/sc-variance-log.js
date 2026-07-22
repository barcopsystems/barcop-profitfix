'use strict';

/* ── Shift Control — Variance helpers ─────────────────────────────────────────
   Not a routed screen anymore. Drawer reconciles are logged/edited on the Cash
   Board (Cash Control, Reconcile Drawer) and viewed on Cash History (Variances tab).
   This module holds the canonical status logic + tolerance + reason/status
   lists the board and history read, and the shared write path. sc_variances
   feeds Profit Recovery's Cash Reconciliation and Theft Risk. */

S.ShiftVarianceLog = {
  REASONS: ['Miscount at count', 'Change-making error', 'Voids/comps not rung',
            'Tip-out error', 'Suspected theft', 'Unknown'],
  STATUSES: ['Within Tolerance', 'Over', 'Short', 'Not Counted'],

  variances() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_variances)) App.shiftData.sc_variances = [];
    return App.shiftData.sc_variances;
  },
  tolerance(drawerOrId) {
    const t = App.drawerTolerance(drawerOrId);
    return (t != null && !isNaN(t)) ? Number(t) : 10;
  },
  statusOf(variance, expected, counted, drawerOrId) {
    if ((expected === 0 || expected == null) && (counted === 0 || counted == null)) return 'Not Counted';
    const tol = this.tolerance(drawerOrId);
    if (Math.abs(variance) <= tol) return 'Within Tolerance';
    return variance > 0 ? 'Over' : 'Short';
  },
  statusBadge(status) {
    const col = status === 'Short' ? 'var(--red)' : status === 'Over' ? 'var(--amber)'
      : status === 'Not Counted' ? 'var(--t3)' : 'var(--green)';
    return '<span style="color:' + col + ';font-weight:700;">' + esc(status || '') + '</span>';
  },

  async persistVariance(rec) {
    const list = this.variances();
    const i = list.findIndex(x => x.id === rec.id);
    // ⚠ DO NOT place the row in `list` before the write (S101). putRecord places it itself, and
    // it can only undo that if it is handed a DIFFERENT object than the one already in the array:
    // pre-placing made `prev` the very object being saved, so the failure branch `arr[back] = prev`
    // assigned the row to itself, and the `arr.splice` branch that removes a refused NEW row is
    // only reached when `prev === null`. A refused save therefore left a PHANTOM behind — which
    // then made the hand form's duplicate guard refuse the RETRY ("already logged at $47.50" for a
    // count that was never logged) and made buildCash treat the register-day as hand-counted and
    // skip the whole import. The merge below is load-bearing: callers do not always supply every
    // field, so build the merged object WITHOUT touching the list.
    const saved = i > -1 ? { ...list[i], ...rec } : rec;
    return await App.putRecord('sc', 'variance', saved);
  },

  async removeVariance(id) {
    return await App.removeRecord('sc', 'variance', id);
  }
};
