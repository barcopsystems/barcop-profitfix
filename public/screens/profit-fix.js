'use strict';

/* ── Profit Fix — the Profit Recovery module's Fix Layer screen ────────────────
   Pairs with the Profit Audit under the sidebar ANALYSIS section. Renders the
   5 Profit gap-areas through FixPanel (Section 9). A dashboard Fix Areas card
   can deep-link here with App._fixFocus set to a gap-area id to auto-expand it. */

S.ProfitFix = {
  render(container) {
    const focus = App._fixFocus || null;
    App._fixFocus = null;
    container.innerHTML = '<div class="screen"><div id="fix-panel-mount"></div></div>';
    FixPanel.renderInto(document.getElementById('fix-panel-mount'), 'profit', focus);
  }
};
