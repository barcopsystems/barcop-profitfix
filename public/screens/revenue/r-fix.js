'use strict';

/* ── Revenue Fix — the Revenue Recovery module's Fix Layer screen ──────────────
   Pairs with the Revenue Audit under the sidebar ANALYSIS section. Renders the
   7 Revenue gap-areas through FixPanel (Section 9). A dashboard Fix Areas card
   can deep-link here with App._fixFocus set to a gap-area id. The currently
   open gap survives navigation via App._fixOpen.revenue so step deep-links
   round-trip cleanly. */

S.RevenueFix = {
  render(container) {
    const explicit = App._fixFocus || null;
    App._fixFocus = null;
    const remembered = (App._fixOpen && App._fixOpen.revenue) || null;
    const focus = explicit || remembered;
    container.innerHTML = '<div class="screen">'
      + '<div id="fix-panel-mount"></div>'
      + '<div id="recent-activity-mount"></div>'
      + '</div>';
    FixPanel.renderInto(document.getElementById('fix-panel-mount'), 'revenue', focus);
    document.getElementById('recent-activity-mount').innerHTML = FixPanel.recentActivityCard('revenue');
    FixPanel.wireActivityCard(document.getElementById('recent-activity-mount'), 'revenue');
  }
};
