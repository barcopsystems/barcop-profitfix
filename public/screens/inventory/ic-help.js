'use strict';

/* ── Inventory Control — Help and FAQ ─────────────────────────────────────────
   The in-app knowledge layer for Inventory Control. Explains how counts, the
   bottle slider, receiving, ordering, and the reports work, and how Inventory
   Control feeds Profit Recovery. Voice and structure match the Recovery help
   screens for consistency across the platform. */

S.InventoryHelp = {
  render(container, actions) {
    if (actions) actions.innerHTML = '';
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'What does Inventory Control do?',
          a: 'Inventory Control is where the operational reality of your bar and kitchen gets logged: every product you stock, every count, every delivery, every order. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Every Recovery system that needs cost data reads from here. Set up products, count weekly, receive deliveries as they arrive, and the rest of Bar Cop has the data it needs without you typing the same numbers twice.' },
        { q: 'Where do I start?',
          a: 'Three steps to get Inventory Control producing real data. First, add your storage locations on the Locations screen. Second, add your vendors on the Vendors screen. Third, add every product you stock on the Products screen with its container size, pour size, unit cost, and menu price. Once products are in, take your first count, receive your first delivery, and the reports start working. The Getting Started checklist on the Hub sidebar walks you through the same sequence with a checkbox per task.' },
        { q: 'Do I need to count everything every week?',
          a: 'For accurate pour cost and variance, yes. A full count on the same day every week is what makes the weekly numbers honest. If a full count is not realistic in week one, start with a Bar Only count and add Kitchen the following week. A partial count beats no count. But the system dies from a missed cycle, not a bad number, so build the count into the week from day one.' }
      ]},
      { t: 'Products, Locations, and Vendors', qa: [
        { q: 'How do I set up products?',
          a: 'On the Products screen, add every product you stock with: name, category, vendor, container size, pour size (for bar product), unit cost, menu price, and optionally par level and reorder point. Bar Cop calculates pours per container, cost per pour, and pour cost percentage automatically. Products with missing required fields flag as Incomplete and are excluded from cost and variance calculations until completed.' },
        { q: 'Can I import products from my POS or a vendor order guide?',
          a: 'Yes. The Products screen has an Import button. Upload a CSV or Excel file from your POS item export, a spreadsheet you maintain, or your distributor order guide. The csv-mapper reads your column headers and shows a mapping screen where you match each column to the right field. Confirm the mapping, click Import, products load instantly. Any product missing required data flags as Incomplete and you fill those in one at a time. Faster than manual entry on any list over 20 items.' },
        { q: 'What is Standard Pour and why does it matter?',
          a: 'The amount you pour per drink in ounces. Spirits are typically 1.25 to 1.5 oz. Wine by the glass is typically 5 oz. Draft beer is typically 14 to 16 oz. Bar Cop divides container size by pour size to get pours per container, and unit cost by pours per container to get cost per pour. If the pour size is wrong, every downstream number is wrong. Set it accurately, update it whenever you change pour specs.' },
        { q: 'What are par level and reorder point?',
          a: 'Par level is the quantity you want on hand. Reorder point is the level that should trigger an order. When a count drops a product below par, it appears on the dashboard\'s Below Par alert and shows up on the Order Sheet ready to be ordered. A par level that matches your real weekly usage cycle keeps you from running out without overcarrying inventory.' },
        { q: 'How do Locations work?',
          a: 'Locations are the physical storage spots you count: main bar, back bar, walk-in cooler, dry goods storage, prep kitchen, beer cooler. Each product is assigned to a primary location. When you Take Inventory, the system walks you through each location and shows you the products that should be there. Setting up locations once saves time on every count because nothing is left in your head about what gets counted where.' },
        { q: 'How do Vendors work?',
          a: 'Each vendor record holds the contact info, delivery days, and minimum order. When you Receive Delivery, you pick the vendor and the system pre-fills last-known prices on the products you receive from them. The Order Sheet groups suggested reorder items by vendor so you can place orders one supplier at a time. Vendor records also feed Profit Recovery\'s Vendor Watch.' }
      ]},
      { t: 'Taking Inventory and the Bottle Slider', qa: [
        { q: 'How do counts work?',
          a: 'Open Take Inventory, pick the count type (Full, Bar Only, Kitchen Only, or Custom locations), and step through each location. For every product you record full unopened units plus how full any open bottle is. Submitting saves a dated snapshot to Count History. Usage, variance, and movers are all measured between two counts, so the first count is your starting point and every report needs a second count to compare against.' },
        { q: 'How do I use the bottle slider?',
          a: 'Drag the liquid level up or down. Tap the top half of the bottle to add 0.1 and the bottom half to subtract 0.1. Tap the number to type an exact value. Use the plus and minus buttons for full unopened bottles. Total on hand is full bottles plus the open-bottle fraction. The slider is mobile-first so you can count on a phone propped on the back bar.' },
        { q: 'Why count partials instead of estimating by eye?',
          a: 'A back bar with 40 open bottles builds a real error into every calculation when partials are estimated. A bottle the bartender calls "half" might be 0.4 or 0.6, and that 0.2 across 40 bottles is 8 bottles of pour cost showing in or out of variance for reasons that have nothing to do with operations. The slider takes 5 seconds per bottle and removes that noise from your data.' },
        { q: 'What if I have to leave mid-count?',
          a: 'Counts auto-save as you go. Close Take Inventory, come back later (same device or different), pick up where you left off. The count is not committed to Count History until you hit Submit, so a count in progress is editable up to that moment.' },
        { q: 'What is Count History for?',
          a: 'Every submitted count, sorted newest first, with a snapshot of what was on hand for every product at the time of the count. Click any count to see the detail. The Usage Report, Variance Report, and Top Movers all read from Count History. The history also lets you go back to a specific date and verify what was on hand if anyone questions a figure later.' },
        { q: 'What is Spot Check?',
          a: 'A fast pre-shift and post-shift count on a few high-risk products, compared to POS sales for that shift. A quick read on variance without a full count. Use it on volume product where over-pouring or unrung drinks tend to show up: well spirits, draft beer, premium pour items. Spot Check data also feeds the Theft Risk Scorecard in Profit Recovery.' }
      ]},
      { t: 'Receiving Deliveries', qa: [
        { q: 'How do I receive a delivery?',
          a: 'Open Receive Delivery, pick the vendor, and add a line for each product on the invoice. Unit price pre-fills from the product master. If the invoice price differs, edit it and the line flags a price change. Submitting records the delivery, updates the product\'s unit cost, and triggers the downstream effects: Vendor Watch picks up the price change, the next pour cost calculation uses the new cost, and the delivery shows on the dashboard.' },
        { q: 'What happens if I get a short pour, wrong unit, or substitution?',
          a: 'Flag the line on receive. The line lands in the Vendor Discrepancies log inside Profit Recovery as an open item. Each open item is a credit you can request from the vendor, and the log holds the date, the issue, and the dollar value until you mark it resolved. Discrepancies you let slide are margin absorbed silently. The log makes them visible and recoverable.' },
        { q: 'What is Delivery History for?',
          a: 'Every received delivery, sorted newest first, with the full line detail. Click any delivery to see what was received, the prices, and any flagged discrepancies. The history is also how you verify the chain of price changes on any product over time, which is the data behind Vendor Watch.' }
      ]},
      { t: 'Ordering', qa: [
        { q: 'How does the Order Sheet work?',
          a: 'The Order Sheet is generated from your latest count against par levels. Any product below par is suggested for reorder, grouped by vendor and sorted by how far below par. Review the suggested quantities, adjust if needed, mark the order placed, and the system saves it to Order History. The Order Sheet does not transmit to vendors automatically. You still place the order through your vendor\'s normal channel; this is the build sheet, not the order portal.' },
        { q: 'What if my par levels are wrong?',
          a: 'They probably are at first. Set initial par levels from gut feel, then watch the Order Sheet over four to six weeks. If you are reordering the same product before it shows below par, raise the par. If a product keeps showing below par but you have plenty, the par is too high. Par levels drift over time as your menu mix changes, so revisit them quarterly.' },
        { q: 'What is Order History?',
          a: 'Every order you have marked placed, sorted newest first, with the line detail. Use it to verify what you ordered against what you received when an invoice does not look right, and to spot ordering patterns over time. The history also matters when you onboard a new manager: it shows what gets ordered, from whom, and how often.' }
      ]},
      { t: 'Reports', qa: [
        { q: 'How is the Usage Report calculated?',
          a: 'Usage equals starting stock plus purchases minus ending stock, measured between two counts. Starting and ending stock come from the counts. Purchases come from any delivery logged between the two count dates. The report shows usage in units and in dollars, broken out by product. Usage is the raw consumption number that feeds COGS, variance, and the movers analysis.' },
        { q: 'How does the Variance Report work?',
          a: 'Variance compares what you used (from the Usage Report) against what your POS says you sold for the same period. Bar Cop converts bottles used into pours automatically using each product\'s standard pour. Under 5 percent variance is OK, 5 to 15 percent is Watch, over 15 percent is Flag. A high variance points to over-pouring, waste, or theft. The report ranks products by variance dollars, so the biggest leaks show first.' },
        { q: 'How do I import POS sales for the Variance Report?',
          a: 'The Variance Report has an Import button that accepts your POS Item Sales Report, Sales Mix, or Product Mix for the period. Same csv-mapper as the Products import: upload the file, map your columns to the right fields, confirm. The mapping is remembered for next time, so weekly variance becomes a one-click import after the first run.' },
        { q: 'What is the Stock Report?',
          a: 'A current on-hand snapshot from your latest count, in units and dollars, by category and location. Use it for end-of-period inventory valuation, insurance documentation, or to brief a new bar manager on what is in the building right now.' },
        { q: 'What are Top Movers for?',
          a: 'Your fastest-moving and slowest-moving products by usage, over the period between your two most recent counts. The top of the list tells you what to keep stocked deep. The bottom of the list flags slow-movers carrying inventory dollars that are not turning. A slow-mover that has been on the menu for six months may belong in the Menu Engineering Dog quadrant for review.' }
      ]},
      { t: 'How Inventory Control Feeds Recovery', qa: [
        { q: 'What flows from Inventory Control to Profit Recovery?',
          a: 'Five connections, all read-only on the Recovery side, all always-on (Rule 14). Products are the master list that Profit Recovery\'s Bar Products and Kitchen Products screens read. Counts feed Profit This Week COGS and the Profit Audit cost sections. Deliveries feed Vendor Watch (price changes), Vendor Discrepancies (flagged lines), and period COGS. Spot Checks feed the Theft Risk Scorecard. Below-par counts feed Hub alerts.' },
        { q: 'What if I do not use Profit Recovery?',
          a: 'You still get the operational benefit of running Inventory Control: organized product master, structured counts, delivery history, variance reporting, automated reorder sheets. But the value compounds when Recovery is reading the data, because that is where the dollar-quantified leaks and the Audit live. Setting up Inventory Control is the highest-leverage hour of work for any operator who is going to use Bar Cop.' },
        { q: 'Do I have to enter every product or can I start with the high-volume ones?',
          a: 'Start with high-volume bar product, the items that move daily. Get those counted weekly. Add the rest of the bar over the first month. Kitchen can layer in after bar is stable. A perfect product list that takes three weeks to build delays every other system. An imperfect list that produces a weekly count from day one starts producing real data immediately, and you fill in the gaps as they surface.' }
      ]}
    ];

    const sectionsHtml = sections.map(sec => {
      const items = sec.qa.map(f =>
        '<div style="border-bottom:1px solid var(--b2);padding:14px 0;">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:6px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">' + esc(f.q) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;display:none;">' + esc(f.a) + '</div>'
        + '</div>'
      ).join('');
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">' + esc(sec.t) + '</div>'
        + items
        + '</div>';
    }).join('');

    container.innerHTML = '<div class="screen">' + sectionsHtml + '</div>';
  }
};
