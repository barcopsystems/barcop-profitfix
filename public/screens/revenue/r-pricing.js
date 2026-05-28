'use strict';

/* ── Revenue Recovery — Price Calculator (deep-link to Menu Engineering) ──────
   The Price Sensitivity tab on Menu Engineering is the canonical price-change
   modeling tool. It does the same math this screen used to do (cost floor,
   break-even, weekly/annual impact), and it ALSO logs the change to
   revenue_price_log so the Recovery Scoreboard can measure whether the change
   moved the metric. Two doors editing the same data was confusing, so this
   screen is now a thin landing page that deep-links to the canonical view.

   The Pricing gap-area in fix-revenue continues to deep-link to 'r-pricing'
   so existing Fix Process steps work; this screen routes them onward. */

S.RevenuePricing = {
  render(container, actions) {
    if (actions) actions.innerHTML = '';
    container.innerHTML = '<div class="screen">'
      + '<div class="card">'
        + '<div class="card-title">Price Calculator</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:18px;">'
        + 'The Price Sensitivity tab on Menu Engineering is where price changes get modeled now. '
        + 'It does the cost-floor math, the break-even volume, and the weekly and annual margin impact, '
        + 'and it logs the change to your price history so the Recovery Scoreboard can measure whether '
        + 'the change actually moved the number.'
        + '</div>'
        + '<button class="btn btn-primary" id="rp-go">Open Menu Engineering &#8594; Price Sensitivity</button>'
      + '</div>'
      + '</div>';
    document.getElementById('rp-go')?.addEventListener('click', () => {
      App._menuEngineeringTab = 'price-sensitivity';
      App.navigate('r-menu-engineering');
    });
  }
};
