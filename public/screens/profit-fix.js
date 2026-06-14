'use strict';

/* ── Profit Fix — the Profit Recovery module's Fix Layer screen ────────────────
   Pairs with the Profit Audit under the sidebar ANALYSIS section. Renders the
   Profit gap-areas through FixPanel's master/detail flow (Section 9): a ranked
   leak board, tap a gap to open its focused fix page. A dashboard Fix Areas
   card or an audit action item deep-links here with App._fixFocus set to a
   gap-area id, which lands straight on that gap's page. */

S.ProfitFix = {
  render(container) {
    const focus = App._fixFocus || null;
    App._fixFocus = null;
    FixPanel.renderModule(container, 'profit', focus);
  },
  showHowTo() {
    App.showHelpModal('How the Fix Process Works', FixPanel.howToSections('profit'));
  }
};
