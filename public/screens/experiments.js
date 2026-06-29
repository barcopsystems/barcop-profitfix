'use strict';

/* ── Experiments — the operator's own before/after change log ──────────────────
   A top-nav full-page (opened like the Blueprint: no module sidebar). One place
   for every change the operator chose to make, grouped by where it lands across
   the financial trinity — Profit, Revenue, Cash. Each area uses the shared,
   multi-instance InitiativeTracker card, which averages the 8 weeks before the
   start date against the 8 after on the watched metric and shows the lift.

   It reports a metric lift only, never recovered dollars, so it never overlaps
   the Recovery Scoreboard, and it is separate from the Fix System (which tracks
   the audit-prescribed fixes). The nav "i" directions live in App._HUB_HELP
   ['experiments']. */

S.Experiments = {
  AREAS: [
    { module: 'profit',  label: 'Profit Experiments' },
    { module: 'revenue', label: 'Revenue Experiments' },
    { module: 'cash',    label: 'Cash Experiments' }
  ],

  open() {
    App.openHubFullPage('Experiments', (mount) => { this.container = mount; this.render(); }, 'experiments');
  },

  render() {
    if (!this.container) return;
    const sections = this.AREAS.map((a, i) =>
      '<div class="sh" style="margin:' + (i === 0 ? '0' : '32px') + ' 0 10px;">' + esc(a.label) + '</div>'
      + '<div class="exp-area" data-module="' + a.module + '">'
      + (typeof InitiativeTracker !== 'undefined' ? InitiativeTracker.card(a.module) : '')
      + '</div>'
    ).join('');
    this.container.innerHTML = '<div class="screen">' + sections + '</div>';
    if (typeof InitiativeTracker === 'undefined') return;
    this.AREAS.forEach(a => {
      const el = this.container.querySelector('.exp-area[data-module="' + a.module + '"]');
      if (el) InitiativeTracker.wire(a.module, el, () => this.render());
    });
  }
};
