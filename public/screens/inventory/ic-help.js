'use strict';

/* ── Inventory Control — Help and FAQ ─────────────────────────────────────────
   The in-app knowledge layer for Inventory Control. Replaces a Resources
   screen — explains how counts, the bottle slider, receiving, and the reports
   work, and how Inventory Control feeds Profit Recovery. */

S.InventoryHelp = {
  FAQ: [
    ['Counts and the Bottle Slider', [
      ['How do inventory counts work?',
        'You count what is physically on hand in Take Inventory. Pick a count type: Full, Bar Only, '
        + 'Kitchen Only, or Custom locations. Then step through each location. For every product you '
        + 'record full units and how full any open bottle is. Submitting saves a dated snapshot to Count History.'],
      ['How do I use the bottle slider?',
        'Drag the liquid level up or down, or tap the top half of the bottle to add 0.1 and the bottom '
        + 'half to subtract 0.1. Tap the number to type an exact value. Use the plus and minus buttons '
        + 'for full, unopened bottles. Total on hand is full bottles plus the open-bottle fraction.'],
      ['Why do I need two counts?',
        'Usage, variance, and movers are all measured between two counts. The first count is your '
        + 'starting point; every report needs a second count to compare against. A count in progress '
        + 'auto-saves, so you can leave and resume it later.']
    ]],
    ['Setup and Feeding Profit Recovery', [
      ['How do I set up products?',
        'Add every product you stock in the Products screen, under the right category. Container size, '
        + 'pour size, unit cost, and menu price let Bar Cop calculate cost per pour and pour cost '
        + 'percentage automatically.'],
      ['What do par level and reorder point do?',
        'Par level is the quantity you want on hand. Reorder point is the level that should trigger an '
        + 'order. When a count drops a product below par it appears on the dashboard Below Par alert and '
        + 'on the Order Sheet.'],
      ['How does Inventory Control feed Profit Recovery?',
        'Products here are the master list, Profit Recovery Bar Products and Kitchen Products read from '
        + 'it. Deliveries update product costs and feed period COGS and Vendor Watch. Set inventory data '
        + 'once here and Recovery stays current.'],
      ['How do I import products or a POS file?',
        'Use the Import button. Upload a CSV or Excel file, match your columns to the fields, and '
        + 'Bar Cop remembers that mapping for next time. The same tool handles POS sales files in the '
        + 'Variance Report.']
    ]],
    ['Receiving and Ordering', [
      ['How do I receive a delivery?',
        'In Receive Delivery, pick the vendor and add a line for each product. Unit price pre-fills from '
        + 'the product master; if your invoice price differs, edit it and the line flags a price change. '
        + 'Saving updates those products\' costs and records the delivery for Vendor Watch and COGS.'],
      ['How does the Order Sheet work?',
        'The Order Sheet is generated from your latest count against par levels, anything below par is '
        + 'suggested for reorder, grouped by vendor. The Order Sheet is part of a later build phase.']
    ]],
    ['Reports and Variance', [
      ['How is usage calculated?',
        'Usage equals Starting Stock plus Purchases minus Ending Stock, measured between two counts. '
        + 'Starting and ending stock come from the counts; purchases come from deliveries logged in between.'],
      ['What is variance and what do the colors mean?',
        'Variance compares what you used against what your POS says you sold. Under 5 percent is OK, '
        + '5 to 15 percent is Watch, and over 15 percent is Flag. A high variance points to over-pouring, '
        + 'waste, or theft.'],
      ['What is a Spot Check?',
        'A spot check is a fast count of a few high-risk products before and after a shift, compared to '
        + 'POS sales for that shift, a quick read on variance without a full count. Spot Check is part '
        + 'of a later build phase.']
    ]]
  ],

  render(container, actions) {
    actions.innerHTML = '';
    const faqItem = (q, a) =>
      '<details style="border-bottom:1px solid var(--b2);">'
      + '<summary style="font-size:13px;font-weight:700;color:var(--t1);cursor:pointer;padding:12px 2px;">'
      + esc(q) + '</summary>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;padding:2px 2px 14px;">' + esc(a) + '</div>'
      + '</details>';
    const section = (title, items) =>
      '<div class="card"><div class="card-title">' + esc(title) + '</div>'
      + items.map(([q, a]) => faqItem(q, a)).join('') + '</div>';

    container.innerHTML = '<div class="screen">'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.7;margin-bottom:16px;">'
      + 'How Inventory Control works and how it connects to the rest of Bar Cop. '
      + 'Tap any question to expand it.</div>'
      + this.FAQ.map(([title, items]) => section(title, items)).join('')
      + '</div>';
  }
};
