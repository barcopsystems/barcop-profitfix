'use strict';

/* ── Profit Fix — the Profit Recovery module's Fix Layer screen ────────────────
   Pairs with the Profit Audit under the sidebar ANALYSIS section. Renders the
   5 Profit gap-areas through FixPanel (Section 9). A dashboard Fix Areas card
   can deep-link here with App._fixFocus set to a gap-area id. The currently
   open gap survives navigation via App._fixOpen.profit so step deep-links
   round-trip cleanly. */

S.ProfitFix = {
  render(container) {
    const explicit = App._fixFocus || null;
    App._fixFocus = null;
    const remembered = (App._fixOpen && App._fixOpen.profit) || null;
    const focus = explicit || remembered;
    container.innerHTML = '<div class="screen">'
      + '<div id="fix-panel-mount"></div>'
      + '<div id="recent-activity-mount"></div>'
      + '</div>';
    FixPanel.renderInto(document.getElementById('fix-panel-mount'), 'profit', focus);
    document.getElementById('recent-activity-mount').innerHTML = FixPanel.recentActivityCard('profit');
    FixPanel.wireActivityCard(document.getElementById('recent-activity-mount'), 'profit');
  }
};
