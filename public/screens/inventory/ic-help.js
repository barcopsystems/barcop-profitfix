'use strict';

/* ── Inventory Control — Help and FAQ ─────────────────────────────────────────
   The in-app knowledge layer for Inventory Control. Explains how counts, the
   bottle slider, receiving, ordering, the reports, and the accounting handoff
   work, and how Inventory Control feeds Profit Recovery. Voice and structure
   match the Recovery help screens for consistency across Bar Cop. */

S.InventoryHelp = {
  render(container, actions) {
    if (actions) actions.innerHTML = '';
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'What does Inventory Control do?',
          a: 'Inventory Control is where the operational reality of your bar and kitchen gets logged: every product you stock, every count, every delivery, every order. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Every Recovery system that needs cost data reads from here. Set up products, count weekly, receive deliveries as they arrive, and the rest of Bar Cop has the data it needs without you typing the same numbers twice.' },
        { q: 'Where do I start?',
          a: 'Three steps to get Inventory Control producing real data. First, add your storage locations on the Locations screen, and use the Manage Order button on each location to put products in walking order so counts go in the order you actually move through the room. Second, add your vendors on the Vendors screen with an email address so Bar Cop can email orders straight to them. Third, add every product you stock on the Products screen with its container size, pour size, unit cost, and menu price. Once products are in, take your first count, receive your first delivery, and the reports start working. The Getting Started checklist on the Hub sidebar walks you through the same sequence with a checkbox per task.' },
        { q: 'Do I need to count everything every week?',
          a: 'For accurate pour cost and variance, yes. A full count on the same day every week is what makes the weekly numbers honest. If a full count is not realistic in week one, count one or two locations and add the rest the following week. A partial count beats no count. But the system dies from a missed week, not a bad number, so build the count into the schedule from day one.' }
      ]},
      { t: 'Products, Locations, and Vendors', qa: [
        { q: 'How do I set up products?',
          a: 'On the Products screen, add every product you stock with: name, category, vendor (picked from your vendor list), primary location (picked from your locations list), container size, pour size (for bar product), unit cost, menu price, and optionally par level and reorder point. Container size is a dropdown that adapts to the category, and any non-standard size you have used before shows up in a Saved Custom Sizes group at the bottom. Bar Cop calculates pours per container, cost per pour, and pour cost percentage automatically. Products with missing required fields flag as Incomplete and are excluded from cost and variance until completed. The Status checkbox hides a product from day-to-day operations without deleting its count or delivery history.' },
        { q: 'How does bottle beer work?',
          a: 'Bottle beer is tracked by the case. When you set category to Bottle Beer, a Case Size field appears (typically 6, 12, 18, 24, or 30 bottles per case). Enter the cost as cost per case, not cost per bottle. Bar Cop divides cost per case by case size to get the cost per bottle, which keeps pour cost percentage accurate. Par level and reorder point go in as cases too, so the Order Sheet builds orders in cases the way you actually buy them. When you count, you record cases on hand and loose bottles separately.' },
        { q: 'Can I import products from my POS or a vendor order guide?',
          a: 'Yes. The Products screen has an Import button. Upload a CSV or Excel file from your POS item export, a spreadsheet you maintain, or your distributor order guide. The csv-mapper reads your column headers and shows a mapping screen where you match each column to the right field. Confirm the mapping, click Import, products load instantly. Any product missing required data flags as Incomplete and you fill those in one at a time. Faster than manual entry on any list over 20 items.' },
        { q: 'What is Standard Pour and why does it matter?',
          a: 'The amount you pour per drink in ounces. Spirits are typically 1.25 to 1.5 oz. Wine by the glass is typically 5 oz. Draft beer is typically 14 to 16 oz. Bar Cop divides container size by pour size to get pours per container, and unit cost by pours per container to get cost per pour. If the pour size is wrong, every downstream number is wrong. Set it accurately, update it whenever you change pour specs. Bottle beer does not use pour size because you sell the whole bottle.' },
        { q: 'What are par level and reorder point?',
          a: 'Par level is the quantity you want on hand. Reorder point is the level that should trigger an order. When a count drops a product below par, it appears on the dashboard\'s Below Par alert and shows up on the Order Sheet ready to be ordered. For bottle beer, par and reorder are in cases. A par level that matches your real weekly usage cycle keeps you from running out without overcarrying inventory.' },
        { q: 'How do Locations work?',
          a: 'Locations are the physical storage spots you count: main bar, back bar, walk-in cooler, dry goods storage, prep kitchen, beer cooler. Each product is assigned to a primary location. Open a location and use Manage Order to set the up-and-down sequence on the products inside it, so when you Take Inventory you walk the shelf in the order you set rather than alphabetical. Delete removes a location from active use and moves it to a Deleted section at the bottom of the screen; click Restore on any deleted location to bring it back if you need it.' },
        { q: 'How do Vendors work?',
          a: 'Each vendor record holds contact info (including email, which Bar Cop uses when you email orders straight from Order History), delivery days, account number, and minimum order. When you Receive Delivery, you pick the vendor and the system pre-fills last-known prices on the products you receive from them. The Order Sheet groups suggested reorder items by vendor so you can place orders one supplier at a time. Vendor records also feed Profit Recovery\'s Vendor Watch.' }
      ]},
      { t: 'Taking Inventory and the Bottle Slider', qa: [
        { q: 'How do counts work?',
          a: 'Open Take Inventory and pick the locations you want to count: one location for a partial count, several or all for a full count. Bar Cop walks you through each location in turn, with the products inside that location appearing in the order you set on the Locations Manage Order view. For every product you record full unopened units plus how full any open bottle is. Submitting saves a dated snapshot to Count History. Usage, variance, and movers are all measured between two counts, so the first count is your starting point and every report needs a second count to compare against.' },
        { q: 'How do I use the bottle slider?',
          a: 'Drag the liquid level up or down. Tap the top half of the bottle to add 0.1 and the bottom half to subtract 0.1. Tap the number to type an exact value. Use the plus and minus buttons for full unopened bottles. Total on hand is full bottles plus the open-bottle fraction. The slider is mobile-first so you can count on a phone propped on the back bar.' },
        { q: 'How do I count bottle beer?',
          a: 'For bottle beer set up with a case size, the count screen shows two boxes instead of the slider: Cases (full cases on hand) and Loose Bottles (single bottles outside a case). Bar Cop combines them so the math comes out right, and the review table shows the breakdown so anyone reviewing the count can see what was counted where.' },
        { q: 'Why count partials instead of estimating by eye?',
          a: 'A back bar with 40 open bottles builds a real error into every calculation when partials are estimated. A bottle the bartender calls "half" might be 0.4 or 0.6, and that 0.2 across 40 bottles is 8 bottles of pour cost showing in or out of variance for reasons that have nothing to do with operations. The slider takes five seconds per bottle and removes that noise from your data.' },
        { q: 'What if I have to leave mid-count?',
          a: 'Counts auto-save as you go. Close Take Inventory, come back later (same device or different), pick up where you left off. The count is not committed to Count History until you hit Submit, so a count in progress is editable up to that moment. If you want to throw out a draft and start fresh, use Cancel on the resume bar or Discard inside the counting view. Both ask for confirmation before clearing the draft.' },
        { q: 'What is Count History for?',
          a: 'Every submitted count, sorted newest first, with a snapshot of what was on hand for every product at the time of the count. Click any count to see the detail. The Usage Report, Variance Report, and Top Movers all read from Count History. The history also lets you go back to a specific date and verify what was on hand if anyone questions a figure later.' }
      ]},
      { t: 'Spot Check', qa: [
        { q: 'What is Spot Check?',
          a: 'A fast pre-shift and post-shift count on a few high-risk products, compared to what your POS says you actually sold for that shift. It is the way to read variance on a single shift without doing a full inventory. Use it on volume product where over-pouring or unrung drinks tend to show up: well spirits, draft beer, premium pour items. Spot Check data also feeds the Theft Risk Scorecard in Profit Recovery.' },
        { q: 'How do I run a Spot Check?',
          a: 'Pick the products before the shift starts and record the pre-shift count with the bottle sliders (open partial level on one slider, full bottles on the other). At the end of the shift, record the post-shift count the same way. If you restocked any of those products mid-shift, enter the full bottles added in the Restocked Mid-Shift box. Pull the POS pours sold for those products from your end-of-shift report and enter that. Bar Cop does the math: it converts the bottle delta into pours, accounts for the restock, and compares actual pours against what the POS rang.' },
        { q: 'What does the variance number tell me?',
          a: 'The result line shows pours over or under, and what that costs in dollars at your pour cost. A small variance is noise. Bar Cop red-flags a line when the variance is more than half a pour and the dollar value is more than a dollar either direction, because that is the level where the pattern starts to matter. Repeated red flags on the same product or the same shift are the signal worth acting on, not a single shift.' }
      ]},
      { t: 'Ordering', qa: [
        { q: 'How does the Order Sheet work?',
          a: 'The Order Sheet is generated from your latest count against par levels. Any product below par is suggested for reorder, grouped by vendor and sorted by how far below par. Review the suggested quantities, adjust if needed, save the order, and the system writes it to Order History. Vendors that already have an open or submitted order are hidden from the suggestions with a small note at the top so you do not double-order. For bottle beer, the suggested quantity is in cases the way you buy it.' },
        { q: 'What if a vendor sent a promo or I need to add something not below par?',
          a: 'Each vendor card has a "+ Add Item" button. Click it, pick the product from that vendor, set the quantity, and the line drops into the same order. Use it for promos, one-off purchases, or anything the par math did not flag.' },
        { q: 'How do I order a one-off for a party or a mid-week run?',
          a: 'Use the "+ New Custom Order" button at the top of the Order Sheet. Pick the vendor, add the products and quantities you need, save. Custom orders bypass the par-level suggestions so you can build any order, any time, without waiting for the next count cycle.' },
        { q: 'What if my par levels are wrong?',
          a: 'They probably are at first. Set initial par levels from gut feel, then watch the Order Sheet over four to six weeks. If you are reordering the same product before it shows below par, raise the par. If a product keeps showing below par but you have plenty, the par is too high. Par levels drift over time as your menu mix changes, so revisit them quarterly.' },
        { q: 'How do I send the order to my vendor?',
          a: 'Open the order in Order History and click Email to Vendor. Bar Cop opens your default email program with the To address pre-filled from the vendor record, the Subject set to "Order from [Bar Name] - [Date]," and the Body filled with your account number, payment terms, every line, the total, and a sign-off. Edit anything you want before sending. Once you send it, the order status flips to Submitted with a timestamp, and the button changes to Resend to Vendor for the next time. Bar Cop never sends mail directly from its own address, so the vendor\'s reply threads naturally back into your inbox.' },
        { q: 'What is Order History?',
          a: 'Every order you have created, sorted newest first, with the line detail and current status (Open, Submitted, Received). Use it to verify what you ordered against what you received when an invoice does not look right, and to spot ordering patterns over time. The history also matters when you onboard a new manager: it shows what gets ordered, from whom, and how often.' }
      ]},
      { t: 'Receiving Deliveries', qa: [
        { q: 'How do I receive a delivery?',
          a: 'Open Receive Delivery and pick the vendor. The Open Order picker shows any orders for that vendor that have not been received yet. Pick the matching order and the lines pre-fill with the products and ordered quantities. Adjust each line to what actually showed up: short counts, substitutions, price changes. If the delivery is a walk-in with no matching order, skip the picker and add lines manually. Save records the delivery, updates each product\'s unit cost, and automatically marks the matched order Received so it disappears from your open list. For bottle beer, quantity and unit price are in cases.' },
        { q: 'What if a line is short, the price is wrong, or the vendor substituted a product?',
          a: 'Bar Cop flags any line where the delivered quantity is less than what you ordered or the price has moved off the product master, and a gold Flag Discrepancy button appears on that line. Click it and an in-app modal opens with the discrepancy form already filled out: date, vendor, product, agreed price, invoiced price, calculated overcharge, suggested type. Add a quick note, save, and the modal closes. You stay on the Receive Delivery screen the entire time, no jumping between screens. The discrepancy lands in the Vendor Discrepancies log in Profit Recovery as an open item.' },
        { q: 'What is Delivery History for?',
          a: 'Every received delivery, sorted newest first, with the full line detail. Click any delivery to see what was received, the prices, and any flagged discrepancies. The history is also how you verify the chain of price changes on any product over time, which is the data behind Vendor Watch.' }
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
      { t: 'Accounting Handoff', qa: [
        { q: 'Where is the bookkeeper handoff?',
          a: 'Under Accounting on the Hub sidebar. Two outputs live there: Month-End Books for the full close, and Weekly P&L for a quick weekly export. Both are built from data Bar Cop already has, so nothing gets hand-keyed twice.' },
        { q: 'What is in Month-End Books?',
          a: 'A single Excel file your bookkeeper or CPA can open straight away. Sheets cover: Income Statement (month and year-to-date), Inventory Valuation (beginning, purchases, ending for Schedule C COGS), Cash Reconciliation (every shift\'s expected versus counted cash with reasons), Void and Comp Log, a Form 8027 Worksheet for tip reporting (you transcribe to the actual IRS form), Variance and Shrinkage, Labor Cost Analysis, and Operational Opportunities from your latest audits. December close adds a Year-End Tax Helper sheet that maps annual totals to Schedule C line numbers. There is also an Owner Summary PDF for a one-page month-versus-prior-month review without opening the spreadsheet. Every sheet carries an in-output disclaimer noting the data comes from your inputs and your accountant should review before filing.' },
        { q: 'What is Weekly P&L?',
          a: 'A quick CSV download with each week\'s revenue, COGS, and labor broken out by bar and food, plus the cost percentages. Pick a range (last week, last four weeks, last 13, year-to-date, or custom), download, hand to your bookkeeper or open in Excel. It is the in-the-moment weekly view; Month-End Books is the full close.' },
        { q: 'How does the Vendor Discrepancies log work?',
          a: 'Lives in Profit Recovery and defaults to log view: summary tiles at the top (Open, Open Overcharge, Recovered), then the list of filed discrepancies underneath. Most discrepancies arrive automatically from the Flag Discrepancy button on Receive Delivery, so day-to-day you do not have to type one in. For the rare case Bar Cop did not see (a damaged bottle found days later, a substitution caught after the fact), a "+ File Manual Discrepancy" button opens a manual form at the bottom of the screen. Click Request Credit on any open item and Bar Cop opens your email program with a structured credit request to the vendor; status flips to Credit Requested. When the credit lands, click Mark Resolved and Bar Cop asks you for the actual recovered amount (defaults to what you claimed but you can override for partial credits, because vendors often pay part).' }
      ]},
      { t: 'How Inventory Control Feeds the Rest of Bar Cop', qa: [
        { q: 'What flows from Inventory Control to Profit Recovery?',
          a: 'Six connections, all read-only on the Recovery side, all always-on (Rule 14). Products are the master list that Profit Recovery\'s Bar Products and Kitchen Products screens read. Counts feed Profit This Week COGS and the Profit Audit cost sections. Deliveries feed Vendor Watch (price changes) and period COGS. Flagged delivery lines feed Vendor Discrepancies. Spot Checks feed the Theft Risk Scorecard. Below-par counts feed Hub alerts.' },
        { q: 'What flows from Inventory Control into Accounting?',
          a: 'Every sheet in Month-End Books pulls from inventory data: the Income Statement uses purchases and COGS, Inventory Valuation uses your beginning and ending counts plus deliveries, Variance and Shrinkage uses the same usage math the in-app Variance Report uses. Weekly P&L pulls the same numbers at a weekly grain. None of it is hand-keyed: if your counts and deliveries are current, your books are too.' },
        { q: 'What if I do not use Profit Recovery?',
          a: 'You still get the operational benefit of running Inventory Control on its own: organized product master, structured counts, delivery history, variance reporting, automated reorder sheets, vendor emails sent straight from Order History, and the full bookkeeper handoff at month-end. The payoff is bigger when Recovery is reading the data too, because that is where the dollar-quantified leaks and the Audit live. Setting up Inventory Control is the best hour of work any operator can put into Bar Cop.' },
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
