'use strict';

/* ── Traffic Fix — the Traffic Recovery module's Fix Layer screen ──────────────
   Pairs with the Traffic Audit under the sidebar ANALYSIS section. Renders the
   Traffic gap-areas through FixPanel's master/detail flow (Section 9): a ranked
   leak board, tap a gap to open its focused fix page. A dashboard Fix Areas
   card or an audit action item deep-links here with App._fixFocus set to a
   gap-area id, which lands straight on that gap's page. */

S.TrafficFix = {
  render(container) {
    const focus = App._fixFocus || null;
    App._fixFocus = null;
    FixPanel.renderModule(container, 'traffic', focus);
  },
  showHowTo() {
    App.showHelpModal('How the Fix Process Works', FixPanel.howToSections('traffic'));
  }
};
