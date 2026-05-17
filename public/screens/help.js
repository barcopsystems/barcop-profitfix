'use strict';
S.Help={
  render(container){
    const sections=[
      {t:'Getting Started',qa:[
        {q:'Where do I start?',a:'Set up your Bar Products first — spirits, beer, and wine with their container sizes, standard pours, unit costs, and menu prices. Every other feature pulls from that list. Once products are set up, enter your first week of data and the dashboard populates automatically.'},
        {q:'What is Prime Cost and why does it matter?',a:'Prime Cost is your total cost of goods sold plus total labor, expressed as a percentage of total revenue. It is the single most important number in a bar operation. Target is 60% or below. Operations consistently above 65% are almost always losing money even when they feel busy.'},
        {q:'Do I need to use every section?',a:'No. Start with Bar Products, then This Week. Everything else — recipes, vendor watch, theft risk, cash reconciliation — layers on top. Use what is useful now and add the rest when the core data is solid.'}
      ]},
      {t:'This Week — Weekly Entry',qa:[
        {q:'What is Bar Revenue?',a:'Total bar sales for the week from your POS system. Include all drink sales — spirits, beer, wine, and non-alcoholic. Pull this from your POS end-of-week summary report.'},
        {q:'What is Bar COGS?',a:'Cost of Goods Sold — what you spent on bar product this week. This is your beverage invoices for the week, plus any product transferred in from storage, minus any product transferred out. Use invoice totals, not what you ordered.'},
        {q:'What is Bar Labor?',a:'Total bar staff payroll for the week — bartenders, barbacks, and bar manager time. Do not include kitchen staff or floor servers unless you are tracking combined labor. The target for bar labor is 12% or below of bar revenue.'},
        {q:'What is the inventory count for?',a:'The inventory count is how the app calculates actual product usage. Beginning inventory plus purchases minus ending inventory equals units used. That number is compared to what your POS says you sold to calculate variance. The count needs to be in the same unit throughout — bottles for spirits, units for beer.'},
        {q:'What is Bar Variance and how does it work?',a:'Variance is the difference between how much product you actually used (calculated from your inventory count) and how much your POS says you sold. The app converts your actual bottle usage into pours automatically using the standard pour you set in Bar Products, then compares pours-to-pours with your POS sales. Enter the pours sold from your POS sales mix report for each product. If you used 3.4 bottles of a spirit with a 1 oz standard pour in a 25.4 oz bottle, that is 86.7 pours made. If your POS shows 85 shots sold, your variance is +1.7 pours — essentially zero. Variance above 2–3 pours per product per week is worth investigating.'},
        {q:'What does Pours Made mean in the variance table?',a:'Pours Made is the number of standard pours calculated from your inventory count. The app takes bottles used from your count and multiplies by the pours-per-bottle for that product based on the standard pour you set in product setup.'},
        {q:'What does Pours Sold mean?',a:'Pours Sold is what you enter manually from your POS sales mix report. It is the number of times that specific spirit was rung in during the week. Enter this as individual shots or pours, not bottles.'}
      ]},
      {t:'Bar Products',qa:[
        {q:'What is Standard Pour?',a:'The amount you pour per drink, in ounces. Well and call spirits are typically 1.25 or 1.5 oz. Premium spirits are typically 1.5 oz. Wine by the glass is typically 5 oz. Draft beer is typically 14–16 oz. This number drives Cost Per Pour, Pour Cost %, and the variance calculation.'},
        {q:'What is Pour Cost %?',a:'Cost Per Pour divided by Menu Price, expressed as a percentage. At 22% pour cost, every dollar of bar revenue costs you 22 cents in product. Industry benchmark for spirits is 18–22%. Beer and wine typically run lower. If your blended pour cost is consistently above 25%, it is worth investigating pour standards, recipe coverage, and inventory variance.'},
        {q:'What is Cost Per Pour?',a:'Unit Cost divided by Pours Per Bottle. What it costs you in product to make one drink from that bottle. Calculated automatically from your inputs.'},
        {q:'What is Pours Per Bottle?',a:'Container size in ounces divided by standard pour in ounces. Calculated automatically. A 750ml bottle (25.4 oz) with a 1.5 oz standard pour yields 16.9 pours per bottle.'}
      ]},
      {t:'Shift Check',qa:[
        {q:'What is Shift Check for?',a:'A fast daily spot-check that takes under 60 seconds. Enter shift revenue and COGS from your POS and you immediately see the shift pour cost and whether it is on target. Running this daily catches problems before they compound into a full week of loss.'},
        {q:'What is Shift COGS?',a:'The product cost for that specific shift. If you track COGS by shift from your POS, use that number. If not, use weekly COGS divided by number of shifts as an estimate. The result tells you whether that shift ran hot or in line with target.'}
      ]},
      {t:'Recipe Library',qa:[
        {q:'What is the difference between Single Drink, Batch Cocktail, and Food Plate?',a:'Single Drink costs one cocktail made to order — enter pours of each spirit (1 = one standard pour, 0.5 = half pour). Batch Cocktail costs a large recipe made in advance — enter full bottles and mixer quantities, then set the total batch yield and serving size and the app calculates cost per drink. Food Plate costs a kitchen dish from your kitchen product list.'},
        {q:'What is Recipe Cost %?',a:'Total ingredient cost divided by menu price. If a cocktail costs $1.40 to make and you charge $9, recipe cost is 15.6%. A recipe that crosses its target cost after a price change gets flagged on the dashboard automatically.'},
        {q:'What is Batch Yield?',a:'The total amount the batch makes, in the unit you choose. A frozen margarita mix that makes 1 gallon is a yield of 1 gallon, which the app converts to 128 oz. Enter the serving size in the same unit category and the app calculates servings per batch.'}
      ]},
      {t:'Vendor Watch',qa:[
        {q:'How does Vendor Watch work?',a:'Select a product from your bar or kitchen product list. The vendor auto-fills from what you entered in product setup. Enter the new invoice price. Enter your weekly usage. The app calculates the cost change dollar amount, cost change percentage, and annual impact. When you save, the product cost updates everywhere — product setup, recipes that use that ingredient, and the flagged recipe check on the dashboard.'},
        {q:'What is Annual Impact $?',a:'Cost change per unit multiplied by weekly usage multiplied by 52 weeks. At 4 bottles per week, a $1.25 per bottle price increase costs $260 per year. This makes small invoice changes visible in real terms.'}
      ]},
      {t:'Theft Risk Scorecard',qa:[
        {q:'How do I score the indicators?',a:'Rate each indicator from 1 to 5. A score of 1 means strong controls are in place for that item — daily cash counts, manager-approved voids, weekly inventory, etc. A score of 5 means no controls exist. Be honest. The scorecard is only useful if it reflects reality. Industry operations with consistent scores above 35 are at high risk of ongoing undetected theft.'},
        {q:'What is the target score?',a:'20 or below indicates strong controls. 21–35 is moderate risk with specific gaps to address. Above 35 is high risk requiring immediate attention. Run the scorecard every 60–90 days to track whether your control environment is improving.'}
      ]},
      {t:'Cash Reconciliation',qa:[
        {q:'How does the count work?',a:'Enter the quantity of each bill and coin denomination in the drawer. The app calculates the total. Enter the expected cash from your POS (cash sales for the shift) and the opening bank separately. The over/short is counted cash minus expected cash, not including the opening bank.'},
        {q:'What is Opening Bank?',a:'The cash float placed in the drawer at the start of the shift. This is not revenue — it is the starting change fund. It should not be counted as part of cash sales for the shift.'},
        {q:'What is the tolerance?',a:'The maximum dollar amount you consider acceptable for a drawer to be off. Set in Settings, defaults to $10. Drawers within tolerance show as OK. Drawers outside tolerance flag in the log. Consistent over/short patterns on the same employee are worth investigating regardless of the tolerance setting.'}
      ]},
      {t:'Audit Tracker',qa:[
        {q:'How do I upload an audit?',a:'Click Upload Audit in the top right and select your Bar Cop Profit Audit PDF. The app reads the entire document automatically and extracts your overall score, all six section scores, key metrics, and every action item ranked by monthly dollar impact. This takes about 10–15 seconds.'},
        {q:'What happens when I upload a second audit?',a:'The app automatically compares the two and shows score progression, which sections improved or declined, how the weekly gap changed, and a score progression chart. Upload a new audit every 60–90 days to track improvement over time.'}
      ]}
    ];

    const html=sections.map(sec=>'<div class="card" style="margin-bottom:12px;">'
      +'<div class="card-title">'+esc(sec.t)+'</div>'
      +sec.qa.map(item=>'<div style="margin-bottom:14px;">'
        +'<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:5px;">'+esc(item.q)+'</div>'
        +'<div style="font-size:12px;color:var(--t2);line-height:1.7;">'+esc(item.a)+'</div>'
        +'</div>').join('')
      +'</div>').join('');

    container.innerHTML='<div class="screen">'+html+'</div>';
  }
};
