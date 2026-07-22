'use strict';

/* ── Shift Control — Safe Log helpers ─────────────────────────────────────────
   Not a routed screen anymore. Safe activity is logged/edited on the Cash Board
   (Cash Control) and viewed on Cash History (Safe Log tab). This module holds
   the canonical TYPES + dirOf the board reads, the chrono accessor Cash History
   uses for the running balance, and the shared write path. */

S.ShiftSafeLog = {
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
  // chronological, oldest first — running balance accumulates in order
  chrono() {
    return [...this.entries()].sort((a, b) => {
      const ka = (a.date || '') + 'T' + (a.time || '00:00') + '|' + (a.created_at || '');
      const kb = (b.date || '') + 'T' + (b.time || '00:00') + '|' + (b.created_at || '');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  },

  async persistEntry(rec) {
    const list = this.entries();
    const i = list.findIndex(x => x.id === rec.id);
    // ⚠ DO NOT place the row in `list` before the write (S131) — see the full note in
    // sc-variance-log.persistVariance. Pre-placing kills BOTH of putRecord's recovery branches,
    // so a refused deposit / bank run / paid-out stayed on screen and kept moving the running
    // safe balance, which is the figure an owner counts the physical safe against. The merge is
    // load-bearing, so build it without touching the list.
    const saved = i > -1 ? { ...list[i], ...rec } : rec;
    return await App.putRecord('sc', 'safe_log', saved);
  },

  async removeEntry(id) {
    return await App.removeRecord('sc', 'safe_log', id);
  }
};
