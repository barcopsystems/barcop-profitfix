'use strict';

/* ── Cash Recovery — Capital Efficiency ───────────────────────────────────────
   The deeper lens on trapped cash. Not just "what is dead," but how hard the
   cash parked in each inventory category actually works: how many times a year
   you cycle it (turns) and the gross margin it earns per dollar on the shelf
   (GMROI). A category that ties up cash and barely turns is financing itself. And
   the cash conversion cycle: how many days your money is locked from buying
   product to selling it, net of the days you take to pay. Built to the report
   standard. Reads CashEngine. */

S.CashCapital = {
  showHowTo() {
    App.showHelpModal('How Capital Efficiency Works', [
      { p: ['Every dollar of inventory on your shelf is cash you spent that has not come back yet. Capital Efficiency shows how hard that cash is working, category by category, so you can tell what earns its shelf and what just sits there financing itself.'] },
      { h: 'Turns', p: ['Turns is how many times a year you cycle the cash in a category. If you hold $4,000 of liquor and sell through $32,000 of it a year, that capital turned eight times. High turns means the cash keeps coming back to work again; low turns means it is parked.'] },
      { h: 'GMROI', p: ['Gross margin return on inventory: the gross margin dollars a category earns per dollar of cash you keep in it. A GMROI of 3 means every dollar on the shelf throws off three dollars of margin a year. Below about 1.5 and that capital is lazy; you are tying up cash for a thin return and could put it to better use.'] },
      { h: 'The Cash Conversion Cycle', p: ['How many days your cash is locked up: the days product sits on your shelf, minus the days you take to pay your vendors. The shorter it is, the less cash is trapped in the operating cycle. Order to par to cut the days product sits, and hold your vendor terms to stretch the days you pay, and the cycle, and the cash locked in it, shrinks.'] }
    ]);
  },

  statItem(label, val, cls) { return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>'; },
  statsCard(items) { return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>'; },
  dataCard(headers, rowsHtml) { return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>' + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'; },

  verdict(gmroi) {
    if (gmroi == null) return ['Set margins', 'var(--t3)'];
    if (gmroi >= 3) return ['Earns its shelf', 'var(--green)'];
    if (gmroi >= 1.5) return ['Fair', 'var(--t2)'];
    return ['Lazy capital', 'var(--amber)'];
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const cap = CashEngine.capitalSummary();
    if (!cap.rows.length) {
      App.setupCard(this.container, {
        title: 'Capital Efficiency',
        lead: 'Capital Efficiency shows how hard the cash on your shelves works, by category, and how long your cash is locked in the operating cycle.',
        steps: [{ title: 'Take two inventory counts', desc: 'Turns and the cash cycle read off your usage between counts.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }]
      });
      return;
    }

    const stats = this.statsCard(
      this.statItem('Capital On the Shelf', App.fmtCurrency(cap.totalCap))
      + this.statItem('Blended Turns', cap.turns != null ? cap.turns.toFixed(1) + 'x' : '-')
      + this.statItem('Blended GMROI', cap.gmroi != null ? '$' + cap.gmroi.toFixed(2) : '-', (cap.gmroi != null && cap.gmroi < 1.5) ? 'warn' : ''));

    const headers = '<th>Category</th><th>Capital</th><th>Turns/yr</th><th>GMROI</th><th>Verdict</th>';
    const rows = cap.rows.map(r => {
      const [vl, vc] = this.verdict(r.gmroi);
      return '<tr><td style="color:var(--t1);">' + esc(r.cat) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.value) + '</td>'
        + '<td class="val">' + (r.turns != null ? r.turns.toFixed(1) + 'x' : '-') + '</td>'
        + '<td class="val"' + (r.gmroi != null && r.gmroi < 1.5 ? ' style="color:var(--amber);font-weight:600;"' : '') + '>' + (r.gmroi != null ? '$' + r.gmroi.toFixed(2) : '-') + '</td>'
        + '<td style="color:' + vc + ';font-weight:600;">' + vl + '</td></tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + stats
      + '<div class="sh" style="margin:24px 0 10px;">Return on Your Shelf Cash</div>'
      + this.dataCard(headers, rows)
      + '<div style="font-size:11px;color:var(--t4);margin-top:10px;">GMROI uses your recent bar and food gross margin. Lazy capital, low turns and low GMROI, is cash you could free by cutting the par and running it down.</div>'
      + this.cycleSection()
      + '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      +   '<button class="btn btn-ghost btn-sm" data-go="c-trapped">Free Trapped Cash</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="c-purchasing">Order to Par</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="ic-vendors">Vendor Terms</button>'
      + '</div>'
      + '</div>';
    this.wire();
  },

  cycleSection() {
    const c = CashEngine.cashCycle();
    if (!c.hasData) return '';
    const days = v => Math.round(v) + ' day' + (Math.round(v) === 1 ? '' : 's');
    const stat = (label, val, sub, cls) => '<div style="flex:1;min-width:130px;"><div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:600;line-height:1;color:' + (cls || 'var(--t1)') + ';">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:4px;">' + sub + '</div></div>';
    const cycleCol = c.cycle > 30 ? 'var(--amber)' : 'var(--t1)';
    return '<div class="sh" style="margin:24px 0 10px;">How Long Your Cash Is Locked Up</div>'
      + '<div class="card"><div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Product Sits', days(c.dio), 'Days of inventory on hand')
      + '<div style="align-self:center;font-size:20px;color:var(--t4);">&minus;</div>'
      + stat('You Take to Pay', days(c.dpo), 'Weighted vendor terms')
      + '<div style="align-self:center;font-size:20px;color:var(--t4);">=</div>'
      + stat('Cash Locked', days(c.cycle), 'Your cash conversion cycle', cycleCol)
      + '</div>'
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);font-size:12px;color:var(--t2);line-height:1.6;">'
      + 'About <strong style="color:var(--gold);">' + App.fmtCurrency(c.lockedCash) + '</strong> is tied up in that cycle. Each day you shorten it frees roughly <strong>' + App.fmtCurrency(c.dailyCogs) + '</strong>. '
      + 'Order to par to cut the days product sits, and hold your vendor terms to stretch the days you pay.</div>'
      + '</div>';
  },

  wire() {
    this.container.onclick = ev => {
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
