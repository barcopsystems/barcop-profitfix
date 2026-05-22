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
  }

];
