'use strict';

/* ── Fix Layer content — Profit Recovery ──────────────────────────────────────
   Static fix content for the Profit gap-areas (Section 9). Rendered by
   FixPanel inside Profit Recovery's Help & FAQ. Zero API cost (Rule 23).
   Source: the Profit Fix System. */

window.FIX = window.FIX || {};

FIX.profit = [

  {
    id: 'pour-cost',
    name: 'Pour Cost',
    module: 'profit',
    summary: 'The gap between what you spent on bar product and what you sold. Measure it weekly, investigate variance, and hold the line with a written pour standard.',

    process: {
      intro: 'A functioning pour cost system has four parts that all have to run: a count on the same day every week, pour cost calculated right after the count, a variance report reviewed within 48 hours, and a written procedure so anyone can run it. Remove any one and the system falls apart within 60 days.',
      steps: [
        { title: 'Set accurate bottle yields',
          detail: 'Pour cost is only as good as your yield inputs. A 750ml bottle at a 1.5oz pour yields 16.9 drinks, not 17 — never round. Enter every active SKU with its container size and standard pour so cost-per-drink is exact.' },
        { title: 'Count on the same day every week',
          detail: 'A full physical count of every storage location, same day, no exceptions. Value inventory at cost using your most recent invoice price. Measure partial bottles — do not estimate by eye.' },
        { title: 'Calculate actual pour cost',
          detail: 'Opening inventory plus purchases received minus closing inventory, divided by beverage sales. Purchases means product physically received in the period, not invoices paid. Run it right after the count, broken out by category.' },
        { title: 'Run the variance report',
          detail: 'Variance is the gap between theoretical usage (POS sales times recipe ounces) and actual usage (physical count movement). Flag any SKU above 3%. Four things produce variance: over-pouring, waste, theft, and unrecorded comps.' },
        { title: 'Review within 48 hours',
          detail: 'Fifteen minutes, Monday morning. Pour cost by category first, variance report second. One decision: is anything here enough to open an investigation today? If yes, assign it before you leave.' },
        { title: 'Hold the line with a written pour standard',
          detail: 'Introduce a measured-pour (jigger) policy as an operational standard that applies to everyone on the same date. Every staff member signs before the effective date — a signed policy makes later corrective action a policy issue, not a personal conflict.' }
      ]
    },

    formulas: [
      { label: 'Actual Pour Cost %',
        formula: '(Opening Inventory + Purchases - Closing Inventory) / Beverage Sales',
        example: '$8,400 opening + $3,200 purchases - $7,100 closing / $22,000 sales = 20.9%' },
      { label: 'Variance (oz)',
        formula: 'Actual usage from count - Theoretical usage from POS sales',
        example: 'POS drink types x recipe ounces = expected oz; the gap to counted oz is variance' },
      { label: 'Bottle Yield',
        formula: 'Container size (oz) / Standard pour (oz)',
        example: '750ml = 25.4oz / 1.5oz = 16.9 drinks (never round to 17)' },
      { label: 'Over-Pour Cost',
        formula: 'Average overage (oz) x cost per oz x drinks per night x service nights',
        example: '0.3oz x $0.90 x 250 drinks x 300 nights = $20,250 per year' }
    ],

    commonMistakes: [
      'Rounding bottle yield to a whole number — the 0.1-drink gap compounds across every SKU and quietly understates theoretical pour cost.',
      'Estimating partial bottles by eye instead of measuring them — a back bar with 40 open bottles builds a real error into every calculation.',
      'Counting purchases as invoices paid rather than product physically received in the period — one delivery on the wrong side of a count date throws the number off by a full case.',
      'Letting the count slip when a manager is out — the system dies from a missed cycle, not a bad number. Write the process down so it lives in paper, not people.',
      'Starting a variance investigation with a conversation instead of the data — verify the count first; many spikes turn out to be a counting error, not a person.'
    ],

    quickRef: {
      rhythm: [
        'Complete a full physical bar inventory count',
        'Calculate actual pour cost by category',
        'Run the variance report and flag any SKU above 3%',
        'Review flagged SKUs within 48 hours of the count',
        'Verify opening and closing counts were completed every shift',
        'Confirm the jigger policy was enforced with the floor manager'
      ],
      benchmarks: [
        { label: 'Spirits',          target: '18-24%', warning: '24-28%', critical: 'above 28%' },
        { label: 'Draft Beer',       target: '20-26%', warning: '26-30%', critical: 'above 30%' },
        { label: 'Bottled Beer',     target: '22-28%', warning: '28-32%', critical: 'above 32%' },
        { label: 'Wine',             target: '28-34%', warning: '34-38%', critical: 'above 38%' },
        { label: 'NA Beverages',     target: '15-22%', warning: '22-26%', critical: 'above 26%' },
        { label: 'Blended bar cost', target: '20-26%', warning: '26-28%', critical: 'above 28%' }
      ],
      escalation: [
        'Verify the count: pull the SKU count sheets across the full period and check every storage location for a missed partial or a unit-of-measure error.',
        'Calculate theoretical usage: POS sales by drink type times recipe ounces, compared to actual ounce movement.',
        'Identify which shifts drove the variance from the opening and closing counts.',
        'Talk to the bar manager about what they noticed on those shifts — breakage, waste, unusual activity.',
        'Run an unannounced mid-shift count on the flagged SKU during a service period.',
        'Document the finding and resolution in writing before closing the investigation — even when it is inconclusive.'
      ]
    },

    templates: [
      {
        id: 'measured-pour-policy',
        name: 'Measured Pour Standards Policy',
        intro: 'The document that makes the jigger requirement official and enforceable. Every staff member signs before the effective date; keep originals in employee files.',
        fields: [
          { key: 'bar_name',       label: 'Bar Name',                  placeholder: 'Your bar' },
          { key: 'jigger_size',    label: 'Standard Spirit Pour',      placeholder: '1.5 oz' },
          { key: 'wine_pour',      label: 'Wine by the Glass Pour',    placeholder: '5 oz' },
          { key: 'effective_date', label: 'Effective Date',            placeholder: 'e.g. March 4' }
        ],
        body: 'MEASURED POUR STANDARDS POLICY\n{{bar_name}}\nEffective {{effective_date}}\n\n'
          + 'PURPOSE\n'
          + 'This policy sets the measured-pour standard for all bar staff at {{bar_name}}. Accurate pours are how we calculate product cost, price the menu correctly, and run the bar on data rather than guesswork. This standard applies to every staff member equally.\n\n'
          + 'THE STANDARD\n'
          + '- Every spirit pour is measured with a jigger. Standard spirit pour: {{jigger_size}}.\n'
          + '- Wine by the glass is poured to {{wine_pour}} using a measured pour or lined glassware.\n'
          + '- Draft beer is poured to a full, properly settled glass with minimal foam waste.\n'
          + '- Speed pours and count pours are not a substitute for a jigger on priced drinks.\n\n'
          + 'WHY\n'
          + 'We cannot know what we spend on product without knowing what is poured. Measured pours are how professionally run bars operate. This is an operational standard, not a judgment of anyone\'s skill.\n\n'
          + 'ENFORCEMENT\n'
          + 'This standard takes effect on {{effective_date}}. Every staff member signs this policy before working a shift on or after that date. After the effective date, measured pours are a job requirement, and repeated failure to follow the standard is addressed through the corrective-action process.\n\n'
          + 'ACKNOWLEDGEMENT\n'
          + 'I have read and understand the Measured Pour Standards Policy for {{bar_name}}.\n\n'
          + 'Staff name: ____________________   Signature: ____________________   Date: __________\n\n'
          + 'Manager: ____________________   Signature: ____________________   Date: __________'
      }
    ],

    aiWorkflows: [
      {
        id: 'pc-ai-1',
        title: 'Analyze the Weekly Variance Report',
        whatItDoes: 'Turns a week of variance data into the top three loss areas, their annualized dollar impact, and a probable operational cause for each.',
        prompt: 'Here is my variance report for the week ending [DATE]. Columns are: SKU name, theoretical usage (oz), actual usage (oz), variance (oz), variance (%). [PASTE DATA]. Identify the top three loss SKUs, calculate the annualized dollar impact of each at my weekly bar revenue of $[AMOUNT], and suggest one operational cause for each.',
        whatToPaste: 'Fill in [DATE], paste your variance report rows for [PASTE DATA], and put your weekly bar revenue in [AMOUNT].'
      },
      {
        id: 'pc-ai-2',
        title: 'Write the Measured Pour Staff Memo',
        whatItDoes: 'Drafts a short, positively framed staff memo introducing the jigger policy as an operational standard, not a punishment.',
        prompt: 'I am introducing a measured pour policy at my bar. All bartenders will now use jiggers for every spirit pour. Write a short staff memo (under 200 words) that introduces the policy, explains the reason in operational terms, frames it as a standard rather than a sign of distrust, and sets the start date as [DATE].',
        whatToPaste: 'Replace [DATE] with your effective date.'
      },
      {
        id: 'pc-ai-3',
        title: 'Build a Monthly Pour Cost Trend Summary',
        whatItDoes: 'Reads four weeks of category pour cost and flags which categories are trending up, holding, or improving.',
        prompt: 'Here are my weekly pour cost percentages for the past four weeks by category. Week 1: Spirits [X]%, Draft Beer [X]%, Bottled Beer [X]%, Wine [X]%. Week 2: [repeat]. Week 3: [repeat]. Week 4: [repeat]. Identify which categories are trending up, which are stable, and which improved. Flag any category that moved more than 2 points in either direction over the four weeks.',
        whatToPaste: 'Replace each [X] with your actual weekly category pour cost percentages.'
      },
      {
        id: 'pc-ai-4',
        title: 'Diagnose a Variance Spike on One SKU',
        whatItDoes: 'Walks a single flagged SKU through probable causes in order and tells you which records to pull to confirm each.',
        prompt: 'My variance report shows [SKU NAME] running [X]% above theoretical this week. Last week it was [X]%. The week before it was within normal range. My POS shows [X] units sold this week, my physical count shows [X] units used, and my delivery record shows [X] units received. Walk me through the most likely causes in order of probability and tell me what records to pull to confirm each one.',
        whatToPaste: 'Fill in the SKU name and the four bracketed numbers from your reports.'
      }
    ]
  },

  {
    id: 'theft-loss',
    name: 'Theft & Loss',
    module: 'profit',
    summary: 'Cash, product, and comp loss that never shows as a line item. Track voids and comps by employee, reconcile every drawer, audit shifts, and act on documented patterns.',

    process: {
      intro: 'Theft is caught by accountability, not suspicion. Daily habits create the data; the weekly review reads it. The job is to make manipulation visible and to build a paper trail before you need it.',
      steps: [
        { title: 'Log voids, comps, and no-sales by employee — daily',
          detail: 'Pull voids, comps, and no-sale transactions from the POS into a daily tracker, broken out by employee. A blended total hides every individual pattern that matters. Do it before the next shift starts.' },
        { title: 'Reconcile every cash drawer before it leaves the floor',
          detail: 'Count each drawer against expected cash from the POS at end of shift, while the person who ran it is still there. Log the direction — consistent shorts and consistent overs are both signals.' },
        { title: 'Inspect every delivery against the invoice',
          detail: 'Check the delivery before the driver leaves. Short counts and substitutions are most likely during a busy service and hardest to dispute afterward. File a discrepancy report on anything that does not match.' },
        { title: 'Run unannounced shift audits',
          detail: 'At least twice a week, on different shifts at varied times, do a mid-shift spot check — drawer, voids so far, product levels. The audit is a deterrent as much as a detection tool.' },
        { title: 'Review weekly by employee',
          detail: 'Every Monday, same time: void and comp rate by employee, drawer variance history, audit observations. Flag anyone running above benchmark against the group.' },
        { title: 'Build the documentation trail',
          detail: 'Document incidents in writing when you observe them — not when you are certain. By the time you are certain, the paper trail that makes action possible is gone.' },
        { title: 'Escalate on a pattern, not a single incident',
          detail: 'One incident is a data point; increase oversight and watch. Two incidents on the same employee within 30 days is a documented pattern that supports written corrective action.' }
      ]
    },

    formulas: [
      { label: 'Void Rate %',
        formula: 'Total voids / Gross sales x 100 (per employee, not blended)',
        example: '$1,240 voids / $42,800 sales = 2.9% — above the 2% warning line' },
      { label: 'Comp Rate %',
        formula: 'Total comps / Gross sales x 100 (per employee, not blended)',
        example: '$890 comps / $42,800 sales = 2.1% — within range' },
      { label: 'Cash Drawer Variance',
        formula: 'Counted cash - Expected cash from POS',
        example: 'Recurring shorts of $25+ on one drawer is a red flag — log the direction every shift' }
    ],

    commonMistakes: [
      'Waiting until you are certain before documenting — by the time you are certain, the paper trail that makes action possible is gone.',
      'Reviewing voids and comps as a blended total instead of by employee — a blended rate hides every individual pattern that matters.',
      'Treating all comps the same — a manager comp for service recovery and a bartender comp for a regular are different things and must be tracked separately.',
      'Skipping the delivery inspection when the truck arrives mid-service — that is exactly when short counts happen and are hardest to dispute later.',
      'Having no written comp authorization policy — a comp that needs no manager sign-off is an unauthorized expense you approved by silence.',
      'Acting on a single incident with no documentation — it creates legal exposure and rarely survives a dispute with an employee who denies it.',
      'Using behavioral indicators as an accusation framework — they direct attention, they are not evidence.'
    ],

    quickRef: {
      rhythm: [
        'Daily: reconcile every cash drawer before it leaves the floor',
        'Daily: log all voids, comps, and no-sales by employee',
        'Daily: confirm the delivery inspection form was completed for any deliveries',
        'Weekly: review void and comp rate by employee, flag anyone above benchmark',
        'Weekly: review drawer reconciliation history for recurring variance',
        'Weekly: run at least two shift audits on different shifts at varied times',
        'Weekly: document any incidents observed in writing before the week closes'
      ],
      benchmarks: [
        { label: 'Void rate — all staff',     target: '0.5-1.5%', warning: 'above 2.5%', critical: 'above 4%' },
        { label: 'Void rate — per bartender', target: 'under 1%',  warning: 'above 2%',   critical: 'above 4%' },
        { label: 'Comp rate — all staff',     target: '1-2%',     warning: 'above 3%',   critical: 'above 5%' },
        { label: 'Comp rate — per bartender', target: 'under 1.5%', warning: 'above 3%', critical: 'above 5%' },
        { label: 'No-sale transactions',      target: '0-2 / shift', warning: '5+ / shift', critical: '10+ / shift' },
        { label: 'Cash drawer variance',      target: 'under $5',  warning: '$10-$20 consistent', critical: '$25+ recurring' }
      ],
      escalation: [
        'Single incident: document it, increase oversight, do not act yet.',
        'Two incidents on the same employee within 30 days: issue written corrective action.',
        'Unexplained variance above 4% after a full investigation: escalate to a Profit Audit.',
        'Confirmed cash theft with documentation: consult legal before the termination conversation.',
        'Confirmed vendor short count: file a discrepancy report and dispute the invoice.',
        'Pattern of comps without manager approval: address in writing and revoke comp authority if needed.'
      ]
    },

    templates: [
      {
        id: 'theft-loss-policy',
        name: 'Theft and Loss Prevention Policy',
        intro: 'Sets the cash, comp, and product accountability rules for all staff. Signed at hire and kept in the employee file.',
        fields: [
          { key: 'bar_name',       label: 'Bar Name',       placeholder: 'Your bar' },
          { key: 'effective_date', label: 'Effective Date', placeholder: 'e.g. March 4' }
        ],
        body: 'THEFT AND LOSS PREVENTION POLICY\n{{bar_name}}\nEffective {{effective_date}}\n\n'
          + 'PURPOSE\n'
          + 'This policy protects the business and every honest employee by setting clear accountability standards for cash, product, and transactions at {{bar_name}}. It applies to all staff equally.\n\n'
          + 'TRANSACTIONS\n'
          + '- Every sale is rung into the POS before the drink is served. No exceptions.\n'
          + '- Voids require a manager and a stated reason. Self-voids are not permitted.\n'
          + '- Comps require manager authorization and are recorded with the reason and the approving manager.\n'
          + '- No-sale drawer opens are logged. Repeated no-sales are reviewed.\n\n'
          + 'CASH HANDLING\n'
          + '- Each drawer is assigned to one person per shift and reconciled before it leaves the floor.\n'
          + '- Cash variance is counted and logged every shift, short or over.\n\n'
          + 'PRODUCT\n'
          + '- Product leaves the bar only as a rung sale or an authorized comp.\n'
          + '- Deliveries are inspected against the invoice before the driver leaves.\n\n'
          + 'ACCOUNTABILITY\n'
          + 'Voids, comps, drawer variance, and audits are reviewed regularly. Violations are addressed through the corrective-action process. Confirmed theft is grounds for termination and may be referred to law enforcement.\n\n'
          + 'ACKNOWLEDGEMENT\n'
          + 'I have read and understand the Theft and Loss Prevention Policy for {{bar_name}}.\n\n'
          + 'Staff name: ____________________   Signature: ____________________   Date: __________\n\n'
          + 'Manager: ____________________   Signature: ____________________   Date: __________'
      },
      {
        id: 'corrective-action',
        name: 'Employee Corrective Action Form',
        intro: 'Documents a corrective conversation for the employee file. Fill it out factually, before the conversation, with only what was directly observed.',
        fields: [
          { key: 'bar_name',      label: 'Bar Name',       placeholder: 'Your bar' },
          { key: 'employee_name', label: 'Employee Name',  placeholder: 'Employee' },
          { key: 'incident_date', label: 'Incident Date',  placeholder: 'e.g. March 2' },
          { key: 'policy_ref',    label: 'Policy Violated', placeholder: 'e.g. Comp authorization' }
        ],
        body: 'EMPLOYEE CORRECTIVE ACTION\n{{bar_name}}\n\n'
          + 'Employee: {{employee_name}}\n'
          + 'Date of incident: {{incident_date}}\n'
          + 'Policy violated: {{policy_ref}}\n\n'
          + 'WHAT WAS OBSERVED\n'
          + '(State only what was directly observed — facts, specifics, no conclusions about intent.)\n'
          + '________________________________________________________________\n'
          + '________________________________________________________________\n\n'
          + 'PRIOR WARNINGS\n'
          + '(List any prior written warnings and their dates, or note None.)\n'
          + '________________________________________________________________\n\n'
          + 'CORRECTIVE ACTION AND EXPECTATION GOING FORWARD\n'
          + '________________________________________________________________\n'
          + '________________________________________________________________\n\n'
          + 'ACKNOWLEDGEMENT\n'
          + 'This corrective action was reviewed with the employee on the date below. The employee signature confirms the conversation took place, not necessarily agreement.\n\n'
          + 'Employee: ____________________   Signature: ____________________   Date: __________\n\n'
          + 'Manager: ____________________   Signature: ____________________   Date: __________'
      }
    ],

    aiWorkflows: [
      {
        id: 'tl-ai-1',
        title: 'Analyze Voids and Comps by Employee',
        whatItDoes: 'Finds the statistical outliers in a month of void/comp data and quantifies the dollar gap versus the group median — without drawing conclusions about intent.',
        prompt: 'Here is my void and comp data for the past 30 days by employee. Columns are: employee name, total sales, total voids, total comps, void rate %, comp rate %. [PASTE DATA]. Identify any employees running statistically above the group average, calculate the dollar value of their excess void and comp rate versus the group median, and flag any patterns by shift or day of week if visible. Do not draw conclusions about intent — report only what the numbers show.',
        whatToPaste: 'Paste your by-employee void/comp table into [PASTE DATA].'
      },
      {
        id: 'tl-ai-2',
        title: 'Write the Void/Comp Tracking Staff Memo',
        whatItDoes: 'Drafts a matter-of-fact memo introducing void and comp tracking as standard practice, not a response to an incident.',
        prompt: 'I am introducing void and comp tracking by employee at my bar. Write a staff memo under 200 words that introduces the system, explains it is standard industry practice, frames it as a normal operational process rather than a sign of distrust, and confirms the start date of [DATE]. Tone should be matter-of-fact and professional with no accusatory language.',
        whatToPaste: 'Replace [DATE] with your start date.'
      },
      {
        id: 'tl-ai-3',
        title: 'Generate a Monthly Theft Risk Summary',
        whatItDoes: 'Turns scorecard indicators into a team risk summary and the top two employees for increased oversight, in pattern-based language.',
        prompt: 'Here is my employee theft risk scorecard data for [MONTH]. For each employee I scored these indicators 0-3: void rate trend, cash drawer consistency, shift audit observations, delivery involvement, peer reports. [PASTE SCORES]. Summarize the risk profile of the team, identify the top two employees for increased oversight, and suggest one specific management action for each. Frame everything as observable patterns, not conclusions about intent.',
        whatToPaste: 'Fill in [MONTH] and paste your scorecard values into [PASTE SCORES].'
      },
      {
        id: 'tl-ai-4',
        title: 'Write a Corrective Action Summary',
        whatItDoes: 'Produces a factual, file-ready corrective action paragraph from the incident facts.',
        prompt: 'I need to document a corrective action for an employee file. The facts: employee name [NAME], date of incident [DATE], shift [SHIFT], what was specifically observed [DESCRIPTION], which policy was violated [POLICY SECTION], prior written warnings [YES or NO and details]. Write a corrective action summary paragraph suitable for the employee file — factual and specific, with no editorializing or conclusions beyond what was directly observed.',
        whatToPaste: 'Fill in each bracketed field with the incident facts.'
      }
    ]
  },

  {
    id: 'food-cost',
    name: 'Food Cost',
    module: 'profit',
    summary: 'What the kitchen spends on product against what it sells. Cost every recipe on real prices, count weekly, track waste with reasons, and price surgically.',

    process: {
      intro: 'Food cost is controlled before service, on the cost card, and during service, at the station. The weekly count tells you the number; the recipe cards, waste log, and portion audits tell you why it moved.',
      steps: [
        { title: 'Build yield-adjusted recipe cost cards',
          detail: 'Cost every menu item from current invoice prices, not memory. Proteins and produce are costed at true cost per usable pound after prep yield — costing at purchase price systematically understates every protein on the menu.' },
        { title: 'Count food on the same weekly schedule as the bar',
          detail: 'A full food count, same day every week, valued at cost. The count is the foundation every food cost calculation depends on.' },
        { title: 'Calculate actual food cost by category',
          detail: 'Opening inventory plus purchases received minus closing inventory, divided by food sales. Never calculate from purchases alone — that number moves with delivery timing, not kitchen performance.' },
        { title: 'Track waste daily with reason codes',
          detail: 'Every station logs waste every service with a reason code. A count of what was thrown away tells you nothing; the reason code tells you what to change.' },
        { title: 'Run portion control audits',
          detail: 'At least two stations a week at varied times. Over-portioning is almost always a standards gap, not a character gap — treat findings as training, not discipline.' },
        { title: 'Review weekly with the kitchen manager',
          detail: 'Top three waste categories by dollar value, portion audit findings, any category above benchmark. One specific action per category, with an owner.' },
        { title: 'Price surgically when a category runs high',
          detail: 'When food cost spikes, raise prices on the specific items above target — not across the board. A surgical increase is less visible to guests and fixes the margin without hiding the operational cause.' }
      ]
    },

    formulas: [
      { label: 'Food Cost %',
        formula: '(Opening Inventory + Purchases - Closing Inventory) / Food Sales',
        example: '$12,600 opening + $8,400 purchases - $11,200 closing / $28,000 sales = 35.0%' },
      { label: 'True Cost per Usable Pound',
        formula: 'Purchase price per pound / usable yield %',
        example: 'Salmon $9.40/lb / 55% yield = $17.09 per usable pound' },
      { label: 'Minimum Menu Price',
        formula: 'Plate cost / target food cost %',
        example: '$10.38 plate cost / 30% target = $34.60 minimum price' }
    ],

    commonMistakes: [
      'Building recipe cards once and never updating them — a card built at January prices is wrong by March, and the error compounds with every price move since.',
      'Costing proteins at purchase price without a yield adjustment — every protein on the menu is understated until you run a prep yield calculation.',
      'Running a blended food cost instead of by category — a 34% blended number can hide a 48% seafood cost that has been invisible for months.',
      'Treating portion audit findings as a disciplinary issue — over-portioning is almost always a standards gap, not a character gap.',
      'Logging waste without reason codes — a count of what was thrown away tells you nothing about why it happened or what to change.',
      'Raising prices across the board when food cost spikes — a surgical increase on the specific items above target is less visible and more effective.',
      'Having no written portion standards posted at stations — a verbal instruction given on day one is a memory that fades and drifts.'
    ],

    quickRef: {
      rhythm: [
        'Review the food waste log — identify the top three waste categories by dollar value',
        'Run a portion control audit on at least two stations',
        'Update recipe cost cards for any ingredients with invoice price changes',
        'Confirm daily waste sheets are using reason codes correctly',
        'Share the top waste categories with the kitchen manager, one action each',
        'Confirm specials are costed before service, not after'
      ],
      benchmarks: [
        { label: 'Proteins',          target: '28-34%', warning: '34-38%', critical: 'above 38%' },
        { label: 'Produce',           target: '22-28%', warning: '28-32%', critical: 'above 32%' },
        { label: 'Dairy & Eggs',      target: '18-24%', warning: '24-28%', critical: 'above 28%' },
        { label: 'Dry Goods',         target: '15-22%', warning: '22-26%', critical: 'above 26%' },
        { label: 'Bar Food',          target: '24-30%', warning: '30-34%', critical: 'above 34%' },
        { label: 'Blended food cost', target: '28-34%', warning: '34-36%', critical: 'above 36%' }
      ],
      escalation: [
        'Run the category breakdown to find which category is driving the blended number.',
        'Pull recent invoices for that category and check for ingredient price changes not yet in the cost cards.',
        'Re-cost the affected cards at current prices, with yield adjustment on proteins and produce.',
        'Run a portion audit on the stations producing that category.',
        'Review the waste log for that category and read the reason codes.',
        'If cost is still above target, decide between a surgical price increase and a recipe modification.'
      ]
    },

    templates: [
      {
        id: 'portion-standards',
        name: 'Food Handling and Portion Standards Guide',
        intro: 'The written portion standard, posted at every station. A standard that lives on paper at the station does not fade or drift the way a verbal instruction does.',
        fields: [
          { key: 'bar_name',       label: 'Bar / Kitchen Name', placeholder: 'Your kitchen' },
          { key: 'effective_date', label: 'Effective Date',     placeholder: 'e.g. March 4' }
        ],
        body: 'FOOD HANDLING AND PORTION STANDARDS\n{{bar_name}}\nEffective {{effective_date}}\n\n'
          + 'WHY THIS IS POSTED\n'
          + 'Consistent portions are how we hold food cost, plate the menu the same way every time, and give every guest the same value. These standards apply at every station, every shift.\n\n'
          + 'PORTIONING\n'
          + '- Every portioned item is measured with a scale or a portion tool — not by eye.\n'
          + '- Proteins are weighed to the spec on the recipe card before they hit the plate.\n'
          + '- Sauces, cheese, and high-cost garnishes are portioned with the listed tool.\n'
          + '- When in doubt, check the recipe card. The card is the standard.\n\n'
          + 'WASTE\n'
          + '- Every item discarded is logged on the daily waste sheet with a reason code.\n'
          + '- Trim, spoilage, overproduction, and comp/remake waste are logged separately.\n'
          + '- Prep to par. Overproduction that gets thrown away is cost with no sale.\n\n'
          + 'HANDLING\n'
          + '- Follow date labelling and FIFO rotation on all product.\n'
          + '- Store proteins and produce at the correct temperatures; log cooler temps each shift.\n\n'
          + 'These standards are reviewed in portion audits twice a week. Findings are a training matter — ask if a standard is unclear.'
      }
    ],

    aiWorkflows: [
      {
        id: 'fc-ai-1',
        title: 'Build a Recipe Cost Card',
        whatItDoes: 'Costs a menu item from an ingredient list — yield-adjusted, with food cost % at your price and the minimum price to hit target.',
        prompt: 'I need to cost a menu item called [ITEM NAME]. Here are the ingredients with purchase units and current purchase prices: [LIST]. The recipe uses these quantities per portion: [LIST RECIPE QUANTITIES]. Assume a waste factor of [X]% on proteins and [X]% on produce. Calculate total cost per portion, food cost percentage at my current menu price of $[PRICE], and the minimum menu price to hit a [TARGET]% food cost. Show your work on yield-adjusted costs for protein and produce items.',
        whatToPaste: 'Fill in the item name, ingredient list, recipe quantities, waste factors, current price, and target.'
      },
      {
        id: 'fc-ai-2',
        title: 'Analyze the 30-Day Waste Log',
        whatItDoes: 'Finds the top waste categories by dollar value, annualizes them, and suggests one specific operational change per category from the reason codes.',
        prompt: 'Here is my food waste log for the past 30 days. Columns: date, item, quantity wasted, unit, reason code, dollar value, station. [PASTE DATA]. Identify the top three waste categories by total dollar value, calculate what each costs annually at this run rate, and for each category identify the most common reason code and suggest one specific operational change based on it. Do not suggest general improvements — one specific change per category.',
        whatToPaste: 'Paste your 30-day waste log into [PASTE DATA].'
      },
      {
        id: 'fc-ai-3',
        title: 'Find Menu Items Below Food Cost Target',
        whatItDoes: 'Flags every menu item above its category target and calculates the minimum price increase to fix it.',
        prompt: 'Here are my recipe cost cards with current food cost percentages. [LIST MENU ITEMS WITH CURRENT FOOD COST % AND MENU PRICE]. My target food cost by category is: proteins [X]%, produce [X]%, dry goods [X]%. Identify all items above their category target. For each, calculate the minimum price increase to hit target without rounding up more than $1. Flag any item where hitting target needs an increase above $2 — those need a separate decision about recipe modification versus price change.',
        whatToPaste: 'Paste your menu items with food cost % and price, and fill in the category targets.'
      },
      {
        id: 'fc-ai-4',
        title: 'Write the Weekly Food Cost Summary',
        whatItDoes: 'Drafts a short, direct weekly summary for the kitchen manager with one named priority action.',
        prompt: 'Here is this week\'s food cost data. Total food sales: $[AMOUNT]. Total food cost: $[AMOUNT]. Food cost by category: [LIST CATEGORIES WITH DOLLAR AMOUNTS]. Top three waste items this week with reason codes: [LIST]. Portion audit findings this week: [NOTES]. Write a brief weekly summary under 150 words for my kitchen manager covering what improved from last week, what is still above target, and one priority action for next week with a specific owner named. Direct and operational tone, not congratulatory.',
        whatToPaste: 'Fill in the sales/cost figures, category amounts, waste items, and audit notes.'
      }
    ]
  },

  {
    id: 'vendor-control',
    name: 'Vendor Control',
    module: 'profit',
    summary: 'Price drift, short counts, and quiet substitutions on every invoice. Audit each delivery against the PO, track prices monthly, and renegotiate quarterly with the data.',

    process: {
      intro: 'Vendor overcharge recovery is an ongoing weekly process, not a one-time audit. Every discrepancy you document at delivery is a credit you can request; every one you miss is a cost you absorbed.',
      steps: [
        { title: 'Pull the PO before the delivery arrives',
          detail: 'Know what you ordered and at what price before the truck is at the door. You cannot audit a delivery you do not have an order for.' },
        { title: 'Count every case before you sign',
          detail: 'Count the delivery against the order. A short count not caught at the door is a loss you already accepted — it is not recovered later.' },
        { title: 'Audit the invoice against the PO line by line',
          detail: 'Compare every line. Flag any price more than 2% above the PO. Note any substitution on the invoice before you sign — a lower-tier product at a premium price is an overcharge, not a substitution.' },
        { title: 'File a discrepancy report on any variance',
          detail: 'Document the SKU, agreed price, invoiced price, and overcharge, and contact your rep within 24 hours. Discrepancies age out fast.' },
        { title: 'Run a monthly price review on the top 20 spend items',
          detail: 'Enter current invoiced prices into a price tracker. Flag any item up more than 5% since last quarter, and any item where another vendor is 8%+ cheaper on the same product.' },
        { title: 'Hold a quarterly vendor review',
          detail: 'Bring the documented variance and price-drift data. Ask for a price match or an explanation, discuss volume terms, and confirm the substitution policy in writing.' },
        { title: 'Confirm vendor terms in writing',
          detail: 'Pricing, substitution policy, and delivery terms confirmed in writing within 48 hours of the review. When a price dispute happens and your only record is a phone call, you have no dispute.' }
      ]
    },

    formulas: [
      { label: 'Invoice Variance',
        formula: '(Invoiced price - PO price) x quantity',
        example: 'Titos 1L: ($24.50 - $22.40) x 18 bottles = $37.80 overcharge on one delivery' },
      { label: 'Price Drift %',
        formula: '(Current price - Original quoted price) / Original quoted price x 100',
        example: '($24.50 - $22.40) / $22.40 = 9.4% drift since the original quote' },
      { label: 'Substitution Overcharge',
        formula: 'Price billed for the substitute - Price of the item actually ordered',
        example: 'A lower-tier product billed at the premium SKU price is an overcharge for the difference' }
    ],

    commonMistakes: [
      'Paying invoices without comparing them to the PO line by line — every invoice you sign unchecked is a price you accepted by default.',
      'Accepting substitutions without adjusting the invoice price — a lower-tier product at a premium price is an overcharge.',
      'Never shopping competitive pricing because you assume distributor prices are fixed — most categories have negotiable elements and respond to documented competition.',
      'Signing delivery receipts before counting the cases — a short count not caught at the door is a loss you already accepted.',
      'Verbal-only vendor relationships with no confirmed pricing in writing — when a dispute happens, a phone conversation is not documentation.',
      'Treating vendor overcharge recovery as a one-time audit rather than an ongoing weekly process.'
    ],

    quickRef: {
      rhythm: [
        'Every delivery: pull the PO, count every case, audit the invoice line by line',
        'Every delivery: complete the delivery inspection before the driver leaves',
        'On any variance: file a discrepancy report and contact the rep within 24 hours',
        'Monthly: enter the top 20 spend items into the price tracker',
        'Monthly: flag any item up more than 5% since last quarter or 8%+ cheaper elsewhere',
        'Quarterly: run the vendor review with the documented variance in hand',
        'Quarterly: confirm pricing and substitution terms in writing within 48 hours'
      ],
      benchmarks: [
        { label: 'Invoice price vs PO',          target: 'matches PO',  warning: 'up to 2% over', critical: 'above 2% over' },
        { label: 'Price drift per quarter',      target: 'flat',        warning: 'up to 5%',      critical: 'above 5%' },
        { label: 'Alternative-vendor gap',       target: 'in line',     warning: '5-8% cheaper',  critical: '8%+ cheaper elsewhere' },
        { label: 'Cumulative overcharge / vendor', target: '$0',        warning: 'under $500 / qtr', critical: '$500+ / qtr' }
      ],
      escalation: [
        'Pull the PO and the invoice and compare them line by line for the flagged delivery.',
        'File a vendor discrepancy report: SKU, agreed price, invoiced price, and total overcharge.',
        'Contact your rep within 24 hours of the delivery — discrepancies age out fast.',
        'Request a credit memo for the full overcharge with a specific response deadline.',
        'Log the variance in the price tracker so the pattern is visible at the quarterly review.',
        'If overcharges recur after the dispute, renegotiate terms or move the category to another vendor.'
      ]
    },

    templates: [
      {
        id: 'vendor-terms',
        name: 'Vendor Agreement Terms Checklist',
        intro: 'Confirms the terms of a vendor relationship in writing. Complete it after a quarterly review and send it to the rep so pricing and policy are on the record.',
        fields: [
          { key: 'bar_name',       label: 'Bar Name',       placeholder: 'Your bar' },
          { key: 'vendor_name',    label: 'Vendor Name',    placeholder: 'Vendor' },
          { key: 'effective_date', label: 'Effective Date', placeholder: 'e.g. March 4' }
        ],
        body: 'VENDOR AGREEMENT TERMS CONFIRMATION\n{{bar_name}} and {{vendor_name}}\nEffective {{effective_date}}\n\n'
          + 'This document confirms in writing the terms discussed in our review. Please reply to confirm or correct any item.\n\n'
          + 'PRICING\n'
          + '- Confirmed pricing on our top spend SKUs is attached / listed below.\n'
          + '- Price changes are communicated in writing before the affected delivery.\n'
          + '- Invoiced prices match the confirmed pricing unless a written change was sent in advance.\n'
          + '____________________________________________________________\n\n'
          + 'SUBSTITUTIONS\n'
          + '- Substitutions are pre-approved by us before delivery, or refused.\n'
          + '- A substitution is billed at the price of the item actually delivered, never at the ordered item\'s price.\n\n'
          + 'DELIVERY\n'
          + '- Delivery days and window: ________________________\n'
          + '- Deliveries are counted and inspected at the door before signing.\n'
          + '- Short counts and discrepancies are credited on documented report.\n\n'
          + 'VOLUME AND TERMS\n'
          + '- Volume discount terms: ________________________\n'
          + '- Payment terms: ________________________\n\n'
          + 'CONFIRMED BY\n'
          + 'Operator: ____________________   Date: __________\n'
          + 'Vendor representative: ____________________   Date: __________'
      }
    ],

    aiWorkflows: [
      {
        id: 'vc-ai-1',
        title: 'Calculate Cumulative Overcharge by Vendor',
        whatItDoes: 'Reads a quarter of invoice audit data and totals the overcharge by vendor, flags the worst SKUs, and projects the annual cost.',
        prompt: 'Here is my invoice audit data for the past quarter. Columns: vendor name, SKU, PO price, invoiced price, variance per unit, quantity, total variance. [PASTE DATA]. Calculate cumulative overcharge by vendor, identify which SKUs have the most consistent variance across deliveries, project the annual overcharge at this run rate, and flag any vendor where cumulative overcharge exceeds $500 for the quarter.',
        whatToPaste: 'Paste your quarter of invoice audit rows into [PASTE DATA].'
      },
      {
        id: 'vc-ai-2',
        title: 'Draft a Vendor Dispute Letter',
        whatItDoes: 'Writes a direct, factual dispute letter requesting a credit memo for a documented overcharge.',
        prompt: 'I need to dispute a price variance with my vendor [VENDOR NAME]. Details: SKU [NAME], agreed price $[AMOUNT], invoiced price $[AMOUNT], quantity [NUMBER], total overcharge $[AMOUNT], delivery date [DATE], invoice number [NUMBER]. Write a professional dispute letter requesting a credit memo for the full overcharge amount. Direct and factual tone, not adversarial. Include a specific deadline for the credit memo response.',
        whatToPaste: 'Fill in the vendor, SKU, prices, quantity, overcharge, date, and invoice number.'
      },
      {
        id: 'vc-ai-3',
        title: 'Build a Quarterly Vendor Review Agenda',
        whatItDoes: 'Turns a quarter of purchase history into a printable review agenda with talking points, questions, and target outcomes.',
        prompt: 'I am preparing for my quarterly review with [VENDOR NAME]. Here is my purchase history for the quarter: total spend $[AMOUNT], top 5 SKUs by spend [LIST WITH AMOUNTS], invoice variances found [LIST], substitutions received [LIST], quality issues [NOTES]. Build a structured meeting agenda with talking points for each item, specific questions to ask, and a target outcome for each agenda item. Format it so I can print it and bring it to the meeting.',
        whatToPaste: 'Fill in the vendor and the quarter\'s spend, SKUs, variances, substitutions, and quality notes.'
      },
      {
        id: 'vc-ai-4',
        title: 'Identify Price Drift on a SKU',
        whatItDoes: 'Reads six months of invoiced prices for one SKU and reports the drift trend, total increase, and cumulative overcharge.',
        prompt: 'Here are my invoiced prices for [SKU NAME] over the past six months, one entry per delivery: [LIST DATES AND PRICES]. Identify the trend direction, calculate the total price increase over the period as a percentage, determine whether it is gradual drift or step changes at specific dates, tell me at what point the price first moved above my original quoted rate of $[AMOUNT], and express the cumulative overcharge in dollars based on my average weekly order volume of [QUANTITY].',
        whatToPaste: 'Fill in the SKU, the dated price list, your original quoted rate, and weekly order volume.'
      }
    ]
  },

  {
    id: 'prime-cost',
    name: 'Prime Cost',
    module: 'profit',
    summary: 'COGS plus labor as a share of sales — the single number that confirms whether the other systems are working. Run it weekly, isolate the driver, act before the next week starts.',

    process: {
      intro: 'Prime cost is an operations metric, not a finance metric. It belongs in the weekly management meeting alongside pour cost and waste — read weekly, on Monday, in fifteen minutes.',
      steps: [
        { title: 'Pull accurate weekly inputs',
          detail: 'Net sales after comps and discounts, COGS by category, and total labor including payroll taxes and employer benefits. Inaccurate inputs produce a prime cost that looks better than it is every week.' },
        { title: 'Run prime cost every Monday, not monthly',
          detail: 'A 30-day lag is 30 days of compounding loss before you see the number, and another 30 before you know if the fix worked. Weekly review is the whole point.' },
        { title: 'Calculate it correctly',
          detail: '(Total COGS + Total Labor) divided by Net Sales. Keep food COGS and beverage COGS separate — a blended number hides which side is the problem.' },
        { title: 'Read it against your concept target',
          detail: 'A 60% prime cost is healthy for a full-service bar-restaurant and concerning for high-volume nightlife. Know your target before you read the number.' },
        { title: 'Isolate the driver when above target',
          detail: 'Decide whether COGS or labor moved the number. If COGS, which category. If labor, which shifts or departments. The number tells you it moved; the components tell you where.' },
        { title: 'Assign the action before the week starts',
          detail: 'A weekly review ends in one decision: is anything here enough to open an investigation or a corrective action today? If yes, assign it before the week begins.' },
        { title: 'Roll weekly snapshots into a monthly review',
          detail: 'File a weekly P&L snapshot each Monday. Once a month, review the four weeks together with management and set the next month\'s cost-control priorities with named owners.' }
      ]
    },

    formulas: [
      { label: 'Prime Cost %',
        formula: '(Total COGS + Total Labor) / Net Sales x 100',
        example: '($21,620 COGS + $16,835 labor) / $62,000 net sales = 62.0%' },
      { label: 'True Labor Cost',
        formula: 'Wages + payroll taxes + employer benefits',
        example: 'Real labor runs 10-15% above wages alone — wages-only understates prime cost' },
      { label: 'Net Sales',
        formula: 'Gross sales - comps - discounts',
        example: 'Register totals are not net sales; comps left in the denominator flatter the number' }
    ],

    commonMistakes: [
      'Calculating prime cost monthly instead of weekly — a 30-day lag means 30 days of compounding loss before you see it, and 30 more before you know the fix worked.',
      'Excluding payroll taxes and benefits from labor — real labor cost is 10-15% above wages alone, and wages-only systematically understates the problem.',
      'Using gross sales instead of net sales as the denominator — comps and discounts left in make prime cost look better than it is every week.',
      'Not separating COGS into food and beverage — a blended COGS number hides which side is the problem and sends you looking in the wrong place.',
      'Treating prime cost as a finance metric — it belongs in the weekly management meeting, not the monthly P&L review.',
      'Acting on a single week\'s spike before checking the data — a miscoded payroll run or a one-time purchase produces a false spike.'
    ],

    quickRef: {
      rhythm: [
        'Pull prior-week net sales (after comps and discounts), COGS by category, and total labor',
        'Calculate prime cost and compare it to target and to last week',
        'If above target, identify whether COGS or labor is the driver',
        'If COGS, isolate the category; if labor, isolate the shifts or departments',
        'Assign an investigation or corrective action before the week starts',
        'File the weekly P&L snapshot',
        'Once a month, review the four weeks together and set named priorities'
      ],
      benchmarks: [
        { label: 'Bar-heavy concept',           target: '48-55%', warning: '55-60%', critical: 'above 60%' },
        { label: 'Full-service bar & restaurant', target: '55-60%', warning: '60-65%', critical: 'above 65%' },
        { label: 'Fast casual',                  target: '55-62%', warning: '62-67%', critical: 'above 67%' },
        { label: 'High-volume nightlife',        target: '42-50%', warning: '50-56%', critical: 'above 56%' },
        { label: 'Craft cocktail bar',           target: '50-58%', warning: '58-63%', critical: 'above 63%' }
      ],
      escalation: [
        'Verify the data first — net sales truly net of comps, labor including taxes. A miscode produces a false spike.',
        'Split the move: did COGS or labor drive the change versus last week?',
        'If COGS, isolate food versus beverage, then drill to the category.',
        'If labor, isolate which shifts or departments ran over their hours.',
        'Check for one-time events — a bulk purchase or a payroll correction landing in the week.',
        'Decide whether this is a structural problem or a one-week anomaly before acting.'
      ]
    },

    templates: [
      {
        id: 'monthly-cost-review',
        name: 'Monthly Cost Control Review Agenda',
        intro: 'The agenda for the monthly management review of prime cost and its components. Run it the first Tuesday of every month.',
        fields: [
          { key: 'bar_name',     label: 'Bar Name',      placeholder: 'Your bar' },
          { key: 'review_month', label: 'Review Month',  placeholder: 'e.g. March' }
        ],
        body: 'MONTHLY COST CONTROL REVIEW\n{{bar_name}} — {{review_month}}\n\n'
          + '1. PRIME COST FOR THE MONTH\n'
          + '- Prime cost by week (four weeks): __________________________\n'
          + '- Monthly average vs. concept target: ______________________\n'
          + '- Direction versus the prior month: ________________________\n\n'
          + '2. COGS REVIEW\n'
          + '- Beverage cost: target vs. actual, and the driver if off.\n'
          + '- Food cost: target vs. actual, by category.\n'
          + '- Vendor price changes caught this month: __________________\n\n'
          + '3. LABOR REVIEW\n'
          + '- Labor cost % vs. target.\n'
          + '- Overtime and any departments or shifts that ran over.\n\n'
          + '4. RESULTS OF LAST MONTH\'S PRIORITIES\n'
          + '- Priority 1: __________________  Result: __________________\n'
          + '- Priority 2: __________________  Result: __________________\n'
          + '- Priority 3: __________________  Result: __________________\n\n'
          + '5. PRIORITIES FOR NEXT MONTH (assign a named owner to each)\n'
          + '- Priority 1: __________________  Owner: ___________________\n'
          + '- Priority 2: __________________  Owner: ___________________\n'
          + '- Priority 3: __________________  Owner: ___________________\n\n'
          + 'Reviewed by: ____________________   Date: __________'
      }
    ],

    aiWorkflows: [
      {
        id: 'pr-ai-1',
        title: 'Calculate Prime Cost vs. Concept Benchmark',
        whatItDoes: 'Calculates prime cost from your weekly inputs, compares it to your concept target, and says whether COGS or labor is the larger driver.',
        prompt: 'Here is my data for the week ending [DATE]. Net sales: $[AMOUNT]. Food cost: $[AMOUNT]. Beverage cost: $[AMOUNT]. Paper and supplies: $[AMOUNT]. Total wages: $[AMOUNT]. Payroll taxes and benefits: $[AMOUNT]. My concept is a [CONCEPT TYPE] and my target prime cost is [TARGET]%. Calculate my prime cost percentage, compare it to target and calculate the dollar value of the gap, tell me whether COGS or labor is the larger driver of any variance, and show your math.',
        whatToPaste: 'Fill in the week\'s sales and cost figures, your concept type, and target.'
      },
      {
        id: 'pr-ai-2',
        title: 'Diagnose a Prime Cost Spike',
        whatItDoes: 'Walks a week-over-week prime cost jump through probable causes in order and names the exact data to pull for each.',
        prompt: 'My prime cost moved from [X]% to [Y]% this week. Component changes: food cost [X]% to [Y]%, beverage cost [X]% to [Y]%, labor [X]% to [Y]%. Net sales this week: $[AMOUNT] versus $[AMOUNT] last week. Walk me through the most likely cause of the spike in order of probability and tell me exactly what data to pull to confirm each one. Do not suggest general improvements — suggest specific things to check, in order.',
        whatToPaste: 'Fill in this week and last week\'s prime cost, component percentages, and net sales.'
      },
      {
        id: 'pr-ai-3',
        title: 'Build a Four-Week Prime Cost Trend',
        whatItDoes: 'Calculates four weeks of prime cost, finds the trend and the biggest mover, and judges structural problem versus one-week anomaly.',
        prompt: 'Here are my weekly prime cost inputs for the past four weeks. For each week: net sales, food cost, beverage cost, labor. [PASTE DATA]. Calculate prime cost for each week, identify the trend direction, flag which component has moved the most over the four weeks, and tell me whether this looks like a structural problem or a one-week anomaly and what data to pull to confirm. My concept target is [TARGET]%.',
        whatToPaste: 'Paste four weeks of inputs into [PASTE DATA] and fill in your target.'
      },
      {
        id: 'pr-ai-4',
        title: 'Write the Monthly Cost Control Summary',
        whatItDoes: 'Drafts a direct monthly review summary for management with three named priorities for next month.',
        prompt: 'Here is my prime cost data for the past month by week: [PASTE WEEKLY DATA]. Top three cost control actions we took this month: [LIST]. Results from last month\'s priority actions: [NOTES]. Write a brief monthly review summary under 200 words for my management team covering what the numbers showed, what we did about it, and three priorities for next month with a named owner for each. Direct and operational tone — not encouraging, not congratulatory.',
        whatToPaste: 'Paste the weekly data, this month\'s actions, and last month\'s results.'
      }
    ]
  }

];
