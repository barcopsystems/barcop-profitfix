'use strict';

/* ── Fix Docs — auto-generated Fix-system printables ──────────────────────────
   The signable policies, forms, and audit sheets the Profit/Revenue Fix systems
   and the Recovery Playbooks hand the operator. Every one is generated in Bar
   Cop's own PDF style through App._pdfBuilder, so they all carry the same header
   with the operator's real establishment name (no stored .docx/.pdf files to
   maintain, no mismatched letterheads). Data-driven: each doc is a list of typed
   blocks (para / section / table / fields / checklist / lines / signatures) fed
   to one renderer. Add a doc = add an entry to DOCS. No API, no cost.

   Entry point: FixDocs.download(id) from a Fix step or a Playbook doc button.
   Advice-construable docs carry an in-output disclaimer (legal posture). */

const FixDocs = (() => {

  // ── Block renderers, operating on the App._pdfBuilder object `b` ────────────
  const GREY = 55;
  const _rule = 205;

  // "Label: ______________" fill line. value fills it when known (e.g. the bar
  // name), else a blank rule to write on.
  function fieldLine(b, label, value) {
    const doc = b.doc, m = b.margin;
    b._need(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(45, 45, 45);
    const lbl = App._pdfSafe(label + ':');
    doc.text(lbl, m, b.y);
    const x0 = m + doc.getTextWidth(lbl) + 8;
    if (value != null && value !== '') {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
      doc.text(App._pdfSafe(String(value)), x0, b.y);
    } else {
      doc.setDrawColor(_rule, _rule, _rule);
      doc.line(x0, b.y + 2, b.pageW - m, b.y + 2);
    }
    b.y += 20;
  }

  // "[ ] text" check line (drawn box so it renders on any font).
  function checkItem(b, text) {
    const doc = b.doc, m = b.margin;
    const lines = doc.splitTextToSize(App._pdfSafe(text), b.usableW - 20);
    b._need(lines.length * 13 + 4);
    doc.setDrawColor(90, 90, 90); doc.setLineWidth(0.7);
    doc.rect(m, b.y - 7.5, 9, 9);
    doc.setLineWidth(0.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(GREY, GREY, GREY);
    lines.forEach((ln, i) => { if (i) b._need(13); doc.text(ln, m + 16, b.y); b.y += 13; });
    b.y += 4;
  }

  // A labeled write-in area: N blank rules to hand-write on.
  function writeLines(b, label, n) {
    const doc = b.doc, m = b.margin;
    if (label) {
      b._need(16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(45, 45, 45);
      doc.text(App._pdfSafe(label + ':'), m, b.y); b.y += 16;
    }
    doc.setDrawColor(_rule, _rule, _rule);
    for (let i = 0; i < (n || 3); i++) { b._need(22); doc.line(m, b.y, b.pageW - m, b.y); b.y += 22; }
    b.y += 4;
  }

  // Signature block: one row per role, each with a Signature line, a Print line,
  // and a Date line.
  function signatures(b, roles) {
    const doc = b.doc, m = b.margin;
    (roles || []).forEach(role => {
      b._need(40);
      doc.setDrawColor(_rule, _rule, _rule);
      const half = (b.pageW - m * 2) * 0.62;
      doc.line(m, b.y, m + half, b.y);                       // signature
      doc.line(m + half + 16, b.y, b.pageW - m, b.y);        // date
      b.y += 11;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(App._pdfSafe(role + ' signature'), m, b.y);
      doc.text('Date', m + half + 16, b.y);
      b.y += 24;
    });
  }

  function renderBlocks(b, blocks, ctx) {
    (blocks || []).forEach(blk => {
      switch (blk.t) {
        case 'para':      b.paragraph(blk.text, { italic: !!blk.italic, gray: blk.gray != null ? blk.gray : GREY }); break;
        case 'section':   b.sectionTitle(blk.title); break;
        case 'heading':   b.heading(blk.text, blk.size || 11); break;
        case 'table':     b.table(blk.head, blk.rows, blk.opts || {}); break;
        case 'fields':    (blk.items || []).forEach(it => fieldLine(b, it.label || it, it.value != null ? it.value : (it.auto ? ctx[it.auto] : ''))); break;
        case 'checklist': (blk.items || []).forEach(it => checkItem(b, it)); break;
        case 'lines':     writeLines(b, blk.label, blk.n || 3); break;
        case 'signatures': signatures(b, blk.roles); break;
        case 'spacer':    b.spacer(blk.h); break;
      }
    });
  }

  // ── The documents (design input = the original Fix-System files, rewritten
  //    app-native in operator voice). Each: id, title, filename tag, module (for
  //    the fix crosswalk), an optional disclaimer, and the block list. ──────────
  const POLICY_DISCLAIMER = 'This is a template Bar Cop generates for your own use. It is not legal, HR, or tax advice. Rules and required language vary by state and locality. Have your attorney or HR advisor review it before you put it in force.';
  const FORM_DISCLAIMER = 'This form is a record-keeping template, not legal or HR advice. Document facts only. Consult your attorney or HR advisor before acting on any employee matter.';

  const DOCS = {
    'pour-standards': {
      title: 'Measured Pour Standards Policy', tag: 'PourStandardsPolicy', module: 'profit', disclaimer: POLICY_DISCLAIMER,
      blocks: [
        { t: 'fields', items: [
          { label: 'Establishment', auto: 'bar_name' },
          { label: 'Effective Date' },
          { label: 'Policy Owner (Manager / Owner)' }
        ]},
        { t: 'section', title: '1. Policy Statement' },
        { t: 'para', text: 'This policy sets the standard pour for every alcoholic beverage served here. Anyone who pours, serves, or handles alcohol reads it, understands it, and follows it. This is not optional. It protects the margin, keeps drinks consistent for guests, and lowers over-service risk.' },
        { t: 'para', text: 'A quarter-ounce of drift per pour, across 200 pours a night, is 50 ounces of product a shift that never got rung. At $1.50 an ounce that is $75 a night, $525 a week, more than $27,000 a year. Measured pours are the single biggest cost control a bar has.' },
        { t: 'section', title: '2. Pour Standards by Category' },
        { t: 'para', text: 'These are the house measures, not estimates. Any deviation needs a manager\'s OK before service. All figures are fluid ounces.' },
        { t: 'table', head: ['Category', 'Standard', 'Rocks / Neat', 'Double', 'Tool'], rows: [
          ['Well spirits', '1.25', '1.5', '2.5', 'Jigger'],
          ['Call spirits', '1.25', '1.5', '2.5', 'Jigger'],
          ['Premium spirits', '1.5', '1.5', '3.0', 'Jigger'],
          ['Wine by the glass', '5', '-', '-', 'Measured pour or lined glass'],
          ['Draft beer', '16 (pint)', '-', '-', 'Calibrated glass'],
          ['Bottled beer', 'Full bottle', '-', '-', '-']
        ]},
        { t: 'para', text: 'Free-pour is allowed only after a bartender passes a formal calibration test and has written manager approval on file. Until that approval exists, a jigger is required on every pour.' },
        { t: 'section', title: '3. Equipment at Every Station' },
        { t: 'checklist', items: [
          'One 1 oz / 2 oz dual jigger per bartender, in service at all times',
          'One 0.5 oz / 0.75 oz jigger for liqueur and modifier pours',
          'Calibrated pour spouts or lined glasses for wine by the glass',
          'Calibrated or lined glasses for draft, no freehand estimation',
          'Manager confirms jiggers are present and clean before service'
        ]},
        { t: 'section', title: '4. Acknowledgment' },
        { t: 'para', text: 'I have read the Measured Pour Standards Policy, I understand it, and I agree to follow it on every shift.' },
        { t: 'fields', items: [{ label: 'Employee name (print)' }] },
        { t: 'signatures', roles: ['Employee', 'Manager'] }
      ]
    },

    'theft-loss-policy': {
      title: 'Theft and Loss Prevention Policy', tag: 'TheftLossPolicy', module: 'profit', disclaimer: POLICY_DISCLAIMER,
      blocks: [
        { t: 'fields', items: [
          { label: 'Business Name', auto: 'bar_name' },
          { label: 'State' },
          { label: 'Effective Date' },
          { label: 'Policy Owner (Owner / GM)' }
        ]},
        { t: 'section', title: '1. Purpose' },
        { t: 'para', text: 'This policy sets the standards on theft, fraud, and loss. It covers every employee, manager, and contractor who works here or on our behalf. It protects the business, the livelihood of everyone on the payroll, and the guests who trust us.' },
        { t: 'para', text: 'Theft and fraud are among the top reasons bars and restaurants fail. This is not about punishment, it is about prevention. Clear definitions, documented steps, and consistent enforcement take away the gray area where theft lives.' },
        { t: 'section', title: '2. Defined Violations' },
        { t: 'para', text: 'The conduct below violates this policy. Not knowing the policy is not a defense. This list is not exhaustive; any dishonest or unauthorized taking of property is a violation.' },
        { t: 'table', head: ['Category', 'Defined Acts', 'Classification'], rows: [
          ['Product theft', 'Consuming product without paying. Giving product away with no charge or record. Removing product from the premises.', 'Terminable. Law enforcement may be contacted.'],
          ['Cash theft', 'Taking cash from the till, safe, or tip pool. Voiding a paid transaction. Underringing. Pocket sales with no POS entry.', 'Terminable. Law enforcement will be contacted.'],
          ['Vendor theft', 'Taking gifts, kickbacks, or cash from vendors. Signing for items not received. Approving false invoices.', 'Terminable. Law enforcement may be contacted.'],
          ['Administrative abuse', 'Falsifying counts. Altering waste or comp records. False shift reports. Signing for another\'s work.', 'Terminable at management discretion.']
        ]},
        { t: 'section', title: '3. Documentation' },
        { t: 'para', text: 'Every suspected violation is documented in writing when it is found, and given to the owner or GM within 24 hours. Facts only, no speculation. Include:' },
        { t: 'checklist', items: [
          'Date, time, and location of the incident',
          'The employee involved, if known',
          'The manager or witness who observed or found it',
          'A specific description of what was observed',
          'Any evidence: POS records, camera footage, inventory records',
          'Names of any other witnesses'
        ]},
        { t: 'section', title: '4. Investigation' },
        { t: 'para', text: '1. The owner or GM reviews the written report and decides whether to investigate. 2. Relevant records are pulled: POS, counts, waste logs, footage, invoices. 3. Witnesses are interviewed separately and statements signed. 4. The employee is interviewed and given a chance to respond. 5. The owner or GM makes a determination on the evidence and documents the outcome. 6. Any discipline follows the schedule below.' },
        { t: 'section', title: '5. Discipline' },
        { t: 'table', head: ['Situation', 'Action', 'Record'], rows: [
          ['Minor, first offense', 'Written warning, Corrective Action Form signed', 'Filed in personnel record'],
          ['Repeated minor', 'Final written warning or suspension', 'Filed in personnel record'],
          ['Theft or fraud', 'Termination for cause', 'Full case file retained']
        ]},
        { t: 'section', title: '6. Acknowledgment' },
        { t: 'para', text: 'I have read the Theft and Loss Prevention Policy and I understand that violating it can end my employment.' },
        { t: 'fields', items: [{ label: 'Employee name (print)' }] },
        { t: 'signatures', roles: ['Employee', 'Manager'] }
      ]
    },

    'corrective-action': {
      title: 'Employee Corrective Action Form', tag: 'CorrectiveActionForm', module: 'profit', disclaimer: FORM_DISCLAIMER,
      blocks: [
        { t: 'heading', text: 'Written Warning', size: 11 },
        { t: 'section', title: '1. Employee' },
        { t: 'fields', items: [
          { label: 'Establishment', auto: 'bar_name' },
          { label: 'Employee name' },
          { label: 'Position / role' },
          { label: 'Date of warning' },
          { label: 'Date of incident' },
          { label: 'Manager issuing warning' }
        ]},
        { t: 'section', title: '2. Violation Type (check all that apply)' },
        { t: 'checklist', items: [
          'Pour standard, serving without a jigger or over the standard measure',
          'Inventory variance above the threshold, unexplained',
          'Waste not logged, or logged wrong',
          'Cash handling, till discrepancy or unauthorized void',
          'Policy non-compliance, documented procedure not followed',
          'Other cost-control violation, described below'
        ]},
        { t: 'section', title: '3. Incident (facts only)' },
        { t: 'para', text: 'Describe what happened: date, time, location, what was observed, who witnessed it. Do not speculate.' },
        { t: 'lines', n: 5 },
        { t: 'section', title: '4. Prior Warnings' },
        { t: 'fields', items: [
          { label: 'Prior written warning on file (Y / N)' },
          { label: 'If yes, date' },
          { label: 'If yes, nature' }
        ]},
        { t: 'section', title: '5. Corrective Action Required' },
        { t: 'para', text: 'What the employee must do differently, going forward. Be specific and measurable.' },
        { t: 'lines', n: 4 },
        { t: 'fields', items: [{ label: 'Improvement demonstrated by (date)' }] },
        { t: 'section', title: '6. If Not Corrected' },
        { t: 'checklist', items: ['Final written warning', 'Suspension without pay', 'Demotion or reassignment', 'Termination for cause'] },
        { t: 'section', title: '7. Signatures' },
        { t: 'para', text: 'Signing acknowledges receipt of this form. It does not indicate agreement with the contents.' },
        { t: 'signatures', roles: ['Employee', 'Manager', 'Witness'] }
      ]
    },

    'vendor-terms': {
      title: 'Vendor Agreement Terms Checklist', tag: 'VendorTermsChecklist', module: 'profit', disclaimer: POLICY_DISCLAIMER,
      blocks: [
        { t: 'fields', items: [
          { label: 'Establishment', auto: 'bar_name' },
          { label: 'Vendor name' },
          { label: 'Product category (spirits / beer / wine / food / supplies)' },
          { label: 'Account rep and contact' },
          { label: 'Review date' },
          { label: 'Reviewed by' }
        ]},
        { t: 'para', text: 'Work this during vendor onboarding and at each contract review. Circle Y or N for every item. Any N needs a written resolution before the account is approved or renewed. Send the completed sheet to your rep so the terms are on record, not just a phone call.', italic: true },
        { t: 'section', title: '1. Pricing' },
        { t: 'table', head: ['Confirm in writing', 'Y / N', 'Notes'], rows: [
          ['Current price confirmed for all active SKUs', 'Y  /  N', ''],
          ['Price-lock period and expiry noted', 'Y  /  N', ''],
          ['Increase conditions defined, minimum notice agreed', 'Y  /  N', ''],
          ['Volume tiers documented if applicable', 'Y  /  N', ''],
          ['Invoice price matches PO price at every delivery', 'Y  /  N', '']
        ], opts: { columnStyles: { 1: { cellWidth: 60, halign: 'center' }, 2: { cellWidth: 150 } } } },
        { t: 'section', title: '2. Substitutions' },
        { t: 'table', head: ['Confirm in writing', 'Y / N', 'Notes'], rows: [
          ['Substitution policy confirmed in writing', 'Y  /  N', ''],
          ['Your pre-approval required before any substitution ships', 'Y  /  N', ''],
          ['Substitutes billed at the ordered item\'s price', 'Y  /  N', ''],
          ['Right to refuse a substitute at delivery, no penalty', 'Y  /  N', '']
        ], opts: { columnStyles: { 1: { cellWidth: 60, halign: 'center' }, 2: { cellWidth: 150 } } } },
        { t: 'section', title: '3. Delivery and Terms' },
        { t: 'table', head: ['Confirm in writing', 'Y / N', 'Notes'], rows: [
          ['Delivery days and windows confirmed', 'Y  /  N', ''],
          ['Short and damaged-goods credit process agreed', 'Y  /  N', ''],
          ['Payment terms confirmed (net 7 / 15 / 30)', 'Y  /  N', ''],
          ['Early-pay discount terms noted if offered', 'Y  /  N', '']
        ], opts: { columnStyles: { 1: { cellWidth: 60, halign: 'center' }, 2: { cellWidth: 150 } } } },
        { t: 'signatures', roles: ['Operator', 'Vendor rep'] }
      ]
    },

    'server-standards': {
      title: 'Server Upsell Standards and Scripts', tag: 'ServerUpsellStandards', module: 'revenue', disclaimer: POLICY_DISCLAIMER,
      blocks: [
        { t: 'fields', items: [
          { label: 'Establishment', auto: 'bar_name' },
          { label: 'Effective Date' }
        ]},
        { t: 'section', title: 'The Standard' },
        { t: 'para', text: 'Serving here is a trained, measured job, not whatever each server decides it is. Every server runs the six touch points below, in order, at every table. This is the standard you are measured on in Server Check.' },
        { t: 'section', title: 'The Six Touch Points' },
        { t: 'table', head: ['#', 'Touch point', 'What it sounds like'], rows: [
          ['1', 'Greet and first-round drink', 'Get a drink order down on the first visit. "Can I start you with a cocktail or a glass of wine?" The first-round drink is the opening move at every table.'],
          ['2', 'Appetizer offer', 'Name one, do not ask "any apps?" "The wings and the calamari are what people come back for, want me to put one in?"'],
          ['3', 'Feature the Stars', 'Recommend from today\'s Stars list off the pre-shift. Point to a specific dish, not the menu.'],
          ['4', 'Second round', 'Check drinks at the halfway mark. "Ready for another, or should I bring the wine list?"'],
          ['5', 'Dessert and after-dinner', 'Offer both, every table. "We have a key lime pie tonight, and it goes with a coffee or a port."'],
          ['6', 'Genuine close', 'Thank them by name if you have it, invite them back. Guests who feel taken care of spend more and come back.']
        ], opts: { columnStyles: { 0: { cellWidth: 24, halign: 'center' }, 1: { cellWidth: 110 } } } },
        { t: 'section', title: 'How You Are Measured' },
        { t: 'para', text: 'Server Check reads your sales divided by your covers, your check average, not your total sales. Coaching is off your own number against the team, never an impression. Name a specific wine or cocktail pairing in every pre-shift and on the check.' },
        { t: 'section', title: 'Acknowledgment' },
        { t: 'para', text: 'I have read the server standard and I will run the six touch points at every table.' },
        { t: 'fields', items: [{ label: 'Server name (print)' }] },
        { t: 'signatures', roles: ['Server', 'Manager'] }
      ]
    },

    'food-standards': {
      title: 'Food Handling and Portion Standards', tag: 'FoodPortionStandards', module: 'profit', disclaimer: POLICY_DISCLAIMER,
      blocks: [
        { t: 'fields', items: [
          { label: 'Establishment', auto: 'bar_name' },
          { label: 'Effective Date' },
          { label: 'Kitchen Manager' }
        ]},
        { t: 'section', title: '1. Purpose' },
        { t: 'para', text: 'This sets the kitchen standard for safe food handling and consistent portions. Everyone on the line reads it and works to it. Safe handling keeps guests safe and keeps the inspector off your back. Consistent portions protect food cost, because over-portioning a high-volume plate is money off every ticket.' },
        { t: 'section', title: '2. Food Handling' },
        { t: 'table', head: ['Area', 'Standard'], rows: [
          ['Cold holding', 'Keep cold food at 40F or below. Check and log walk-in and reach-in temps at open and close.'],
          ['Hot holding', 'Hold hot food at 135F or above. Reheat to 165F before it goes on the line.'],
          ['Cooking temps', 'Poultry 165F, ground meat 155F, whole cuts and fish 145F. Use a probe thermometer, not the clock.'],
          ['Storage and FIFO', 'Label and date everything. First in, first out. Raw stored below and away from ready-to-eat.'],
          ['Cross-contamination', 'Separate boards and knives by product. Wash, rinse, sanitize between tasks. Change gloves between raw and ready-to-eat.'],
          ['Hygiene', 'Wash hands on the clock, after every break, and between tasks. No bare-hand contact with ready-to-eat food.']
        ], opts: { columnStyles: { 0: { cellWidth: 110, fontStyle: 'bold' } } } },
        { t: 'section', title: '3. Portion Standards' },
        { t: 'para', text: 'Every plate goes out to the portion on its recipe card, not by eye. The tools below stay on the line at all times.' },
        { t: 'checklist', items: [
          'Portion scale at every station, in service and calibrated',
          'Portioned scoops, ladles, and spoodles matched to each recipe spec',
          'Ring molds or templates where plate presentation is specified',
          'Proteins pre-portioned, weighed, and labeled during prep, not on the fly',
          'Cooks weigh-check their own plates against spec at the start of every shift'
        ]},
        { t: 'para', text: 'Portions are audited on the line against these standards. Coaching is on the spot and treated as training, not discipline.' },
        { t: 'section', title: '4. Acknowledgment' },
        { t: 'para', text: 'I have read the Food Handling and Portion Standards and I will work to them on every shift.' },
        { t: 'fields', items: [{ label: 'Employee name (print)' }] },
        { t: 'signatures', roles: ['Employee', 'Kitchen Manager'] }
      ]
    },

    'portion-audit': {
      title: 'Portion Control Audit', tag: 'PortionControlAudit', module: 'profit', disclaimer: FORM_DISCLAIMER,
      blocks: [
        { t: 'fields', items: [
          { label: 'Establishment', auto: 'bar_name' },
          { label: 'Date' },
          { label: 'Station' },
          { label: 'Auditor' }
        ]},
        { t: 'para', text: 'Run this on at least two stations a week at varied times, against the portion spec on each recipe card. Weigh the plate, record the actual against spec, and coach on the spot. Treat what you find as training, not discipline. Over-portioning a high-volume plate 20 percent is real food cost no shift number catches.', italic: true },
        { t: 'section', title: 'Weigh Against Spec' },
        { t: 'table', head: ['Item / component', 'Spec', 'Actual', 'Variance', 'Pass / Fail', 'Cook'], rows: [
          ['', '', '', '', '', ''], ['', '', '', '', '', ''], ['', '', '', '', '', ''],
          ['', '', '', '', '', ''], ['', '', '', '', '', ''], ['', '', '', '', '', ''],
          ['', '', '', '', '', ''], ['', '', '', '', '', '']
        ], opts: { columnStyles: { 0: { cellWidth: 150 } } } },
        { t: 'section', title: 'Findings and Coaching' },
        { t: 'lines', label: 'What was off, and what you coached', n: 4 },
        { t: 'signatures', roles: ['Auditor'] }
      ]
    }
  };

  // ── Public API ──────────────────────────────────────────────────────────────
  function meta(id) { const d = DOCS[id]; return d ? { id, title: d.title, module: d.module } : null; }

  async function download(id) {
    const d = DOCS[id];
    if (!d) { console.warn('FixDocs: unknown doc', id); return; }
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const ctx = { bar_name: (App.data && App.data.settings && App.data.settings.bar_name) || '' };
    const b = App._pdfBuilder(d.title);
    b.header({ right: d.title });
    renderBlocks(b, d.blocks, ctx);
    if (d.disclaimer) b.disclaimer(d.disclaimer);
    const venue = ctx.bar_name || 'Bar Cop';
    await b.save(venue + ' - ' + d.title + '.pdf');
  }

  return { DOCS, meta, download };
})();

if (typeof window !== 'undefined') window.FixDocs = FixDocs;
