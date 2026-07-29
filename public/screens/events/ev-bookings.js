'use strict';

/* ── Events — Bookings ────────────────────────────────────────────────────────
   The unified bookings pipeline: one record per party, worked cradle to grave
   through Lead -> Quote Sent -> Booked -> Completed / Lost.

   Landing = stat strip + an inline New Booking form + the pipeline table.
   Open a booking and it becomes an "Active Booking" workspace: a live status
   header, a progress rail, stat tiles, and a single stage-driven "work it" zone
   with one big forward action,
   instead of card after card of identical buttons. Send Quote emails the
   customer (the vendor-order mailto pattern). Costs + the P&L are collected at
   the Completed stage, where they actually exist. */

S.EventsBookings = {
  _detailId: null,
  _addDraft: null,
  _viewStep: null,   // a prior step being viewed/edited (null = the live current stage)
  filterStage: '',

  STAGES: ['Lead', 'Quote Sent', 'Booked', 'Completed', 'Lost'],
  STAGE_FLOW: ['Lead', 'Quote Sent', 'Booked', 'Completed'],
  EVENT_TYPES: ['Birthday', 'Corporate', 'Rehearsal Dinner', 'Bridal/Baby Shower', 'Holiday Party', 'Reunion', 'Memorial', 'Buyout', 'Private Dining', 'Catering (Offsite)', 'Other'],
  SOURCES: ['Phone', 'Email', 'Website Form', 'Walk-in', 'Referral', 'OpenTable/Resy', 'Repeat Guest', 'Other'],

  // Color = meaning only: a win (completed) is green, a loss is red, in-flight is neutral.
  stageColor(stage) { return stage === 'Completed' ? 'var(--green)' : stage === 'Lost' ? 'var(--red)' : 'var(--t2)'; },
  // The live accent for the workspace header dot/label.
  stageAccent(stage) { return stage === 'Lost' ? 'var(--red)' : 'var(--green)'; },

  bookings()  { if (!Array.isArray(App.data.bookings)) App.data.bookings = []; return App.data.bookings; },
  rateCards() { if (!Array.isArray(App.data.event_rate_cards)) App.data.event_rate_cards = []; return App.data.event_rate_cards; },
  regulars()  { if (!Array.isArray(App.data.event_regulars)) App.data.event_regulars = []; return App.data.event_regulars; },

  // ── shared visual atoms (the stage-driven workspace language) ────────────
  subLabel(t) { return '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + t + '</div>'; },
  divider()   { return '<div style="border-top:1px solid var(--b2);margin:20px -20px;"></div>'; },
  statTile(label, val, sub, cls) {
    const c = cls === 'warn' ? 'var(--amber)' : cls === 'good' ? 'var(--green)' : cls === 'bad' ? 'var(--red)' : 'var(--t1)';
    return '<div style="flex:1;min-width:120px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:600;line-height:1.1;color:' + c + ';">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + (sub || '&nbsp;') + '</div></div>';
  },

  // ── helpers ────────────────────────────────────────────────────────────────
  isOpen(s) { return s === 'Lead' || s === 'Quote Sent'; },
  title(b)  { return b.event_name || (b.contact_name ? b.contact_name + (b.event_type ? ' - ' + b.event_type : '') : (b.event_type || 'Booking')); },
  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((d - new Date(App.todayLocal() + 'T00:00:00')) / 86400000);
  },
  daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((new Date(App.todayLocal() + 'T00:00:00') - d) / 86400000);
  },

  // The ISO date for a scheduled shift (its Monday week_start + Mon-first day idx).
  _shiftIso(weekStart, day) {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const idx = DAYS.indexOf(day);
    if (idx < 0 || !weekStart) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + idx);
    return App.ymdLocal(d);
  },
  // The staff scheduled AND checked as working this event (Build Schedule). Only
  // these people's labor counts toward the event, so a private party during normal
  // service does not charge the whole day's crew to the event.
  eventStaffShifts(b) {
    if (!b || !b.id || !b.event_date) return [];
    const iso = String(b.event_date).slice(0, 10);
    const out = [];
    ((App.laborData && App.laborData.lc_schedules) || []).forEach(s => {
      (s.shifts || []).forEach(sh => {
        if (sh.event === b.id && this._shiftIso(s.week_start, sh.day) === iso) out.push(Object.assign({}, sh, { _iso: iso }));
      });
    });
    return out;
  },
  // Revenue is the event's own actual revenue (the banquet check). A shift's total
  // cannot be cleanly split for a shared-day event, so it is operator-entered.
  bookingRevenue(b) { return parseFloat(b.actual_revenue) || 0; },
  // Group the event roster by staff: lc_actuals is one row per staff per day, but
  // a person can have more than one event-tagged block that day, so each person is
  // costed once (their logged actual if present, else the sum of their blocks).
  eventStaffByPerson(b) {
    const byStaff = {};
    this.eventStaffShifts(b).forEach(sh => { (byStaff[sh.staff_id] = byStaff[sh.staff_id] || []).push(sh); });
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    return Object.keys(byStaff).map(sid => {
      const blocks = byStaff[sid];
      const act = actuals.find(a => a.staff_id === sid && String(a.date || '').slice(0, 10) === blocks[0]._iso);
      const hrs = act ? (parseFloat(act.hours) || 0) : blocks.reduce((s, sh) => s + (parseFloat(sh.hours) || 0), 0);
      const cost = act ? (parseFloat(act.cost) || (parseFloat(act.hours) || 0) * (parseFloat(act.wage) || 0))
                       : blocks.reduce((s, sh) => s + (parseFloat(sh.cost) || (parseFloat(sh.hours) || 0) * (parseFloat(sh.wage) || 0)), 0);
      return { name: blocks[0].name || '-', hours: hrs, cost: cost, logged: !!act };
    });
  },
  bookingLabor(b) {
    return this.eventStaffByPerson(b).reduce((sum, p) => sum + p.cost, 0);
  },
  DEFAULT_SVC_PCT: 20,
  // The default tax rate comes from the Cash section's sales-tax setting so events
  // quote at the rate the rest of Bar Cop uses; a booking can override it.
  defaultTaxPct() { try { return parseFloat(CashEngine.salesTaxRate()) || 0; } catch (e) { return 0; } },

  /* ⚠⚠ ONE FLOOR, EVERY DOOR — round 1 put its negative guard on `saveQuote`, which is ONE of the
     FIVE doors that write a money-bearing field onto a booking, and a booking's numbers leave the
     building on a quote PDF and a signed agreement. Measured through the shipped doors:
       Edit Details   party_size -90        Quoted Total $9,811.13 -> $0.00, with NO message at all
       New Booking    party_size -40        saved silently
       Run Sheet      guaranteed_count -75  $0.00, and "F&B Subtotal (-75 guaranteed)" on the client
                      quote; with an F&B minimum set it quietly bills the MINIMUM instead — a
                      $2,116.13 under-bill that looks entirely plausible
       Save Deposit   deposit_amount -2000  Balance Due $11,811.13 on the signed agreement, $2,000
                      ABOVE the quoted total: over-billing a client on the document they sign
     Round 1 also taught quoteParts to bill `guaranteed_count` and never added it to round 1's own
     guard — the field was collected at a different door ([[the-loop]] step 0.5).
     ⚠ REFUSED, NOT SILENTLY CLAMPED, at every door, for the same reason as the rate card: rewriting
     the operator's number without saying so is the other way to put something untrue on a client's
     paperwork. `ev-pricing._rejectReason` is the same shape for the same reason; this is the
     booking's copy of that rule, one definition, so the doors cannot drift apart again. */
  /* ⚠ The field list lives INSIDE the function on purpose. A harness lifts a METHOD by name; a
     sibling data property is invisible to every slicer in the suite, so splitting these would kill
     each stub with "cannot convert undefined to object" on correct code — integrity #16 wearing a
     data-literal costume, which is the expensive direction because it reads like a real regression. */
  _rejectReason(fields) {
    const LABELS = {
      per_head: 'Per Head', fb_minimum: 'F&B Minimum', room_fee: 'Room Fee',
      service_charge_pct: 'Service Charge', tax_pct: 'Tax', party_size: 'Party Size',
      guaranteed_count: 'Guaranteed Count', deposit_amount: 'Deposit Amount',
      event_food_cost: 'Food Cost', event_bar_cost: 'Bar Cost', event_other_cost: 'Other Cost',
      actual_revenue: 'Actual Revenue'
    };
    if (!fields) return '';
    const bad = Object.keys(LABELS)
      .filter(k => fields[k] != null && fields[k] !== '' && (parseFloat(fields[k]) || 0) < 0);
    return bad.length ? (bad.map(k => LABELS[k]).join(', ') + ' cannot be negative.') : '';
  },

  // The quote math, one source of truth: an F&B subtotal (the bigger of per-head x
  // headcount or the F&B minimum) plus a service charge and tax on that subtotal.
  quoteParts(b) {
    b = b || {};
    /* ⚠ AND THE READER FLOORS TOO, because the doors only guard what is typed TODAY. A booking
       banked before this guard existed, or carrying a rate card from before ev-pricing's, would
       still print a negative or a $0.00 total onto a client document. A quantity that cannot be
       negative in the world is read as 0 here; nothing the operator types is silently rewritten,
       because every door above refuses it out loud first. */
    const nn = v => Math.max(0, parseFloat(v) || 0);
    const ph = nn(b.per_head);
    /* ⚠⚠ BILL THE GUARANTEED COUNT — THE SIGNED AGREEMENT ALREADY PROMISES IT AND THE APP NEVER DID.
       the DEFAULT agreement template reads "A final guaranteed count is due several days before the
       event. You are billed for the guaranteed count or the actual count, whichever is higher."
       ⚠ That is the TEMPLATE, not necessarily this operator's terms — `agreementTerms()` returns
       whatever they have saved, and they are invited to rewrite it. Billing on the guarantee is
       still right whatever their terms say, because the operator TYPED that count themselves and
       both the on-screen breakdown and the signed agreement NAME the count they were billed on, so
       nothing is asserted behind anyone's back. The template is why the behaviour exists; it is not
       a claim about any particular bar's contract. `guaranteed_count`
       is collected on the Run Sheet and was then used ONLY for display — never by the quote math,
       which read the ESTIMATE (`party_size`) forever. Measured: an estimate of 60 with a final
       guarantee of 75 at $85/head left the quoted total, the Balance Due tile, the re-printed
       agreement and the cash forecast at $7,028 while the terms entitled the bar to $8,660 —
       $1,632 under-collected, with no screen in Bar Cop disagreeing with the operator.
       ⚠ Bar Cop has no ACTUAL-count field, so the honest reading of the clause it can support is
       "the guarantee supersedes the estimate once it is given". The breakdown names which count it
       billed, so the number never moves for a reason the operator cannot point at. */
    const guaranteed = Math.max(0, parseInt(b.guaranteed_count) || 0);
    const party = guaranteed || Math.max(0, parseInt(b.party_size) || 0);
    const fbMin = nn(b.fb_minimum);
    const roomFee = nn(b.room_fee);
    const svcPct = (b.service_charge_pct != null && b.service_charge_pct !== '') ? nn(b.service_charge_pct) : this.DEFAULT_SVC_PCT;
    const taxPct = (b.tax_pct != null && b.tax_pct !== '') ? nn(b.tax_pct) : this.defaultTaxPct();
    const subtotal = Math.max(ph * party, fbMin);
    const service = subtotal * svcPct / 100;
    const tax = subtotal * taxPct / 100;
    // Room fee is a flat facility charge added on top of the F&B quote. Gratuity
    // is on F&B only and room-rental tax varies by jurisdiction, so the fee is not
    // auto-serviced or auto-taxed — it flows straight to the total (and the balance
    // due). Before this it was collected on the rate card but silently dropped from
    // every quote, PDF, agreement, and balance.
    return { ph, party, guaranteed, fbMin, roomFee, svcPct, taxPct, subtotal, service, tax, total: subtotal + service + tax + roomFee };
  },
  quoteTotal(b) { return this.quoteParts(b).total; },

  /* ⚠⚠ ONE COUNT LABEL, EVERY SURFACE — AND THE THREE THE CLIENT ACTUALLY HOLDS WERE THE THREE
     THAT LIED. Round 1 taught `quoteParts` to bill the guaranteed count and named that count in the
     on-screen breakdown, so the total never moves for a reason the operator cannot point at. The
     quote PDF, the emailed quote and the signed agreement all went on printing raw `party_size`
     beside a subtotal billed on the guarantee. ⛔ MEASURED — estimate 60, final guarantee 75, $85 a
     head, straight off `buildQuoteMailto`:
         Party size: 60 guests
         Per head: $85.00 x 60 guests
         Food and beverage subtotal: $6,375.00
     85 x 60 is 5,100. **The arithmetic on the document that governs the deal does not work**, and it
     is out by $1,275 in the bar's favour, which is exactly the direction a client disputes.
     The annotation had gone to the ONE surface the client never sees ([[the-loop]] step 0.6 — list
     every consumer of a value, and the artefact that leaves the building is the one that counts). */
  // `long` is the client-document phrasing ("75 guests (guaranteed)"); the on-screen breakdown wants
  // the short form for its parenthetical. ONE definition of the fact, two renderings of it.
  _countLabel(p, long) {
    if (!p || !p.party) return '';
    const which = p.guaranteed ? 'guaranteed' : 'estimated';
    return long ? (p.party + ' guests (' + which + ')') : (p.party + ' ' + which);
  },

  quoteBreakdownHtml(p) {
    const line = (lbl, val, strong) => '<div style="display:flex;justify-content:space-between;gap:16px;padding:' + (strong ? '8px 0 0' : '5px 0') + ';' + (strong ? 'border-top:1px solid var(--b2);margin-top:4px;' : '') + 'font-size:' + (strong ? '14px' : '12px') + ';">'
      + '<span style="color:' + (strong ? 'var(--t1)' : 'var(--t3)') + ';font-weight:' + (strong ? '700' : '400') + ';">' + lbl + '</span>'
      + '<span style="color:' + (strong ? 'var(--gold)' : 'var(--t2)') + ';font-weight:' + (strong ? '800' : '600') + ';">' + App.fmtCurrency(val) + '</span></div>';
    return '<div style="max-width:320px;">'
      // Name the count the subtotal was billed on, so a total that moves when the final guarantee
      // comes in is a change the operator can point at rather than one that just happens.
      + line('F&amp;B Subtotal' + (p.ph && p.party ? ' (' + this._countLabel(p) + ')' : ''), p.subtotal)
      + line('Service Charge (' + (p.svcPct || 0) + '%)', p.service)
      + line('Tax (' + (p.taxPct || 0) + '%)', p.tax)
      + (p.roomFee ? line('Room Fee', p.roomFee) : '')
      + line('Quoted Total', p.total, true)
      + '</div>';
  },

  // The agreement's balance TERM: quoted minus the deposit, what the contract says is
  // owed. This is what belongs on the signed agreement, where it sits beside "Deposit to
  // Confirm": both are deal terms, so neither moves after the client pays. Use
  // balanceOutstanding for anything reporting what is still owed TODAY.
  /* ⚠ AND THE DEPOSIT IS READ THROUGH THE SAME FLOOR quoteParts USES. I gave quoteParts a reader
     floor and did not carry the reasoning fifty lines down to the field whose own defect report says
     a negative OVER-BILLS the client: a deposit does not clamp a balance, it INFLATES it. Measured
     on a $6,540.75 quote with `deposit_amount: -2000` — Balance Due **$8,540.75 on the signed
     agreement**, $2,000 above the total it asks them to pay, and the same figure into the 13-week
     forecast.
     ⚠ FIVE readers, not three: `cash-engine.eventInflow` and `committedEventCash` read the deposit
     too, and the first version of this comment claimed they were covered when they were not — a
     confidence claim in a comment is an instruction to the next reader not to check. They call this
     helper now. If a sixth appears, it calls this, not `parseFloat`. */
  _depositHeld(b) { return Math.max(0, parseFloat(b && b.deposit_amount) || 0); },

  /* How much of a banked deposit goes back on a cancelled booking (S247). Absent, it is the whole
     deposit — what every record written before this field existed already means. ⚠ Capped at what
     was actually banked: you cannot give back more than you took, and an uncapped figure would be a
     typo the cash forecast believes. ONE definition, shared with `CashEngine.eventRefundsOwed`. */
  _refundOwedOnLost(b) {
    const held = this._depositHeld(b);
    const set = (b && b.refund_amount != null && b.refund_amount !== '') ? (parseFloat(b.refund_amount) || 0) : held;
    return Math.min(held, Math.max(0, set));
  },

  /* ⚠⚠ ONE DEFINITION OF "A DEPOSIT IS STILL DUE", BECAUSE THERE WERE TWO AND THEY DISAGREED.
     The Bookings strip summed every unpaid deposit; the Events dashboard filtered `> 0` first.
     ⛔ MEASURED on the identical set (1500, -2000, 500): **strip $0.00, dashboard $2,000.00**.
     And NEITHER looked at `balance_paid_date`, so a booking settled in full went on being chased
     for its deposit on three surfaces at once — measured **$1,500.00** on an event reading
     "paid in full" one click away. A deposit is due only while there is something left to collect.
     Both screens call this now, so they cannot drift apart again ([[the-loop]] #54). */
  depositsDueList() {
    return this.bookings().filter(b => b.stage === 'Booked' && !b.deposit_paid_date
      && !b.balance_paid_date && this._depositHeld(b) > 0);
  },
  depositsDueTotal() { return this.depositsDueList().reduce((s, b) => s + this._depositHeld(b), 0); },

  balanceDue(b) {
    const quoted = this.quoteTotal(b);
    const dep = this._depositHeld(b);
    return Math.max(0, quoted - dep);
  },
  // What is actually still owed right now: zero once the balance is collected.
  // cash-engine.eventInflow already drops any booking carrying a balance_paid_date,
  // precisely because that cash is in hand, but the Balance Due tile kept printing the
  // full figure with "paid in full" written underneath it.
  balanceOutstanding(b) {
    if (b.balance_paid_date) return 0;
    /* ⚠⚠ ONLY A COLLECTED DEPOSIT REDUCES WHAT IS STILL OWED. This deferred to balanceDue, which
       nets the deposit whether or not the client has actually paid it — so a booking with a
       promised-but-unpaid $1,500 deposit printed "Balance Due $6,195.00" against a truth of
       $7,695.00, crediting the client for money the bar has not received, under a tile whose own
       comment says it reports what is still owed RIGHT NOW.
       cash-engine.eventInflow has always drawn this distinction (`b.deposit_paid_date ? ... : 0`),
       which is why the same event read $6,195 here and $7,695 on the Cash Forecast.
       ⚠ balanceDue is deliberately NOT changed: it is the AGREEMENT TERM — quoted minus the deposit
       the contract asks for — and it must stay put on a signed document after the client pays. */
    const dep = b.deposit_paid_date ? this._depositHeld(b) : 0;
    return Math.max(0, this.quoteTotal(b) - dep);
  },

  /* What the bar owes BACK, when a deposit is larger than the whole quote. balanceDue clamps at
     zero, which is right for a balance and wrong as the last word on the money: the overpayment
     simply disappeared, the tile read "paid in full", and the event dropped out of the forecast's
     event table (it only lists rows with a balance above zero). Measured: an $8,000 deposit on a
     $7,695 event hid $305 the bar owes the client on every screen in Bar Cop. */
  refundOwed(b) {
    /* ⚠⚠ ONLY MONEY ACTUALLY BANKED CAN BE OVER-COLLECTED — the same distinction balanceOutstanding
       was fixed to make, and I did not carry it here in the same breath. Without it: a deposit taken
       to hold a date BEFORE the quote is built (quote still $0) printed "Refund Owed $1,500.00", so
       Bar Cop told the operator to pay back money they had just banked. And a PROMISED $8,000 on a
       $7,695 event hid the $7,695 that was genuinely still owed. */
    if (!b || !b.deposit_paid_date) return 0;
    const dep = this._depositHeld(b);
    return Math.max(0, dep - this.quoteTotal(b));
  },

  /* ⚠⚠ FREEZE THE RATES THE MOMENT A QUOTE BECOMES A COMMITMENT. quoteParts reads `tax_pct` off the
     booking and falls back to the LIVE setting, and `collectQuote` was the only writer that ever
     stored it — so a booking that reached Quote Sent or Booked by any other door (a rate-card pill,
     the Catering Calculator, Edit Details' own Stage dropdown) carried no snapshot at all.
     ⛔ MEASURED: a $7,200.00 quote already sent to a client became $7,695.00 the moment the operator
     set their sales tax rate in Cash settings. **$495 appeared with zero edits to the booking**, on
     the quote PDF, the signed agreement, the Balance Due tile and the pipeline. A booking WITH the
     snapshot is immune, which is the control.
     This is the rule the cash engine already paid for once: a number that moves invisibly destroys
     trust in every number beside it. Before a quote goes out the live rate is correct, so nothing is
     frozen while the booking is still a Lead. */
  _freezeRates(b, fields) {
    const cur = Object.assign({}, b || {}, fields);
    if (cur.tax_pct == null || cur.tax_pct === '') fields.tax_pct = this.defaultTaxPct();
    if (cur.service_charge_pct == null || cur.service_charge_pct === '') fields.service_charge_pct = this.DEFAULT_SVC_PCT;
    return fields;
  },

  // Other active bookings holding the same space on the same day: a double-book risk.
  /* One definition of "this booking still holds its date". Lost is dead and Completed is history,
     so neither can clash with anything. ⚠ ev-calendar carried a SECOND copy of the conflict rule
     with a DIFFERENT stage set, so the calendar flagged a pair the booking page then refused to
     name — click through and the banner described a different event ([[the-loop]]: find the second
     IMPLEMENTATION, not the second caller). The calendar now calls this. */
  holdsDate(o) { return !!o && o.stage !== 'Lost' && o.stage !== 'Completed'; },

  conflicts(b) {
    if (!b || !b.event_date || !this.holdsDate(b)) return [];
    const date = String(b.event_date).slice(0, 10);
    /* ⚠⚠ A BLANK SPACE USED TO SWITCH THE WHOLE CHECK OFF. Space is optional at every entry door
       and has no validation anywhere, so a single-room bar that never types one got NO protection:
       two Booked events on the same night read completely clean on both screens. Two bookings with
       no space named are still two events on one day, which is the thing worth seeing — the banner
       words that case differently rather than claiming a room clash it cannot know about. */
    const space = String(b.space || '').trim().toLowerCase();
    return this.bookings().filter(o => o.id !== b.id
      && this.holdsDate(o)
      && String(o.event_date || '').slice(0, 10) === date
      && String(o.space || '').trim().toLowerCase() === space);
  },
  conflictBanner(b) {
    const conf = this.conflicts(b);
    if (!conf.length) return '';
    const hard = b.stage === 'Booked' && conf.some(o => o.stage === 'Booked');
    const col = hard ? 'var(--red)' : 'var(--amber)';
    /* ⚠ NAME THE TIMES. The check is date + space with no time, because a booking carries a start
       and no duration — so a legitimate lunch and dinner turn in one room reads as a clash. Bar Cop
       cannot know whether they overlap, so it does not pretend to: it prints both times and lets
       the operator see at a glance that it is a turn ([[the-loop]] #30 — do not infer a fact the
       data does not carry). Without this every twice-a-day room shows a red banner, which is how a
       real warning stops being read. */
    const nameList = arr => arr.map(o => esc(this.title(o)) + ' (' + esc(o.stage) + ')'
      + (o.event_time ? ', ' + esc(o.event_time) : '')).join(', ');
    const names = nameList(conf);
    const named = !!String(b.space || '').trim();
    const mine = b.event_time ? ' at ' + esc(b.event_time) : '';
    /* ⚠ THE BANNER MAY NOT STATE A COUNT OR A CLAIM THE DATA DOES NOT SUPPORT. It was written for a
       PAIR and hardcoded that: three events on one day still read "Two events, one day" and
       "Neither has a space named" about three of them. And `holdsDate` deliberately includes Lead
       and Quote Sent — which is right, quoting two parties for the same Saturday is exactly what
       you want flagged — but the copy then told the operator the room "is also held" by an inquiry
       and to "Move one", when nothing is booked and there is nothing yet to move.
       ⚠ The stage set itself is NOT narrowed ([[the-loop]] #29 — the reasoning above holdsDate was
       written deliberately in round 1 and re-verified here). Only the wording is the defect: it now
       counts what it found and says what those bookings actually are. */
    const n = conf.length;
    /* ⚠ THE SENTENCE IS ABOUT THE **OTHER** BOOKINGS, so the test is their stage, not this one's.
       A first draft asked `b.stage === 'Booked' || conf.some(...)`, which made a Booked event sitting
       beside an open quote read "the room is also held by Downtown Tech Mixer (Quote Sent)" — a quote
       holds nothing. Four combinations, all true now: others booked -> held, move one; others only
       quoted -> a heads-up with nothing else confirmed. */
    /* ⚠ ONLY A BOOKED EVENT HOLDS THE ROOM, so only Booked events may be NAMED as holding it. The
       first version of this fix got the TEST right and left the LIST alone, so as soon as one other
       booking was Booked the sentence swept every lead and quote in with it: measured, three events
       in one room printed "Private Room is also held by Tech Mixer (Booked), Rotary (Quote Sent)" —
       a quote holds nothing. It needed three events to show, which is why the two-event case passed.
       ⚠ And the HEADLINE has its own test. "Double-booking" is only true when BOTH are booked, which
       is exactly what `hard` already computes for the colour; a Quote Sent booking beside a Booked
       one printed "Double-booking" when nothing of the operator's was booked at all. */
    /* ⚠ AND "QUOTED" MEANS A QUOTE ACTUALLY WENT OUT. Round 4's bucket was `stage !== 'Booked'`,
       which swept LEADS in and then asserted a quote about them: measured, *"Rotary (Lead) also has
       a quote out for it"* and the headline "Same date, another quote out" on a booking nobody had
       priced. That is the split-a-flag shape ([[the-loop]] #24) — the new bucket inherited the old
       one's members. Three states, three words: held, quoted, enquired about. */
    const holders = conf.filter(o => o.stage === 'Booked');
    const quoted = conf.filter(o => o.stage === 'Quote Sent');
    const leads = conf.filter(o => o.stage !== 'Booked' && o.stage !== 'Quote Sent');
    const verb = arr => arr.length === 1 ? ' also has ' : ' also have ';   // "has/have a quote out"
    const asked = ' also asked about ';                                     // past tense takes neither
    const othersHold = holders.length > 0;
    const count = n === 1 ? 'Two events' : (n + 1) + ' events';
    const nEls = n === 1 ? 'Neither' : 'None';
    // ⚠ `mine` is THIS booking's time and belongs to the date, never inside the clause naming the
    // other event — "held on Sep 12 at 6:00 PM by Tech Mixer (Booked), 11:00 AM" read as though the
    // operator's own 6:00 PM were part of the other party's hold.
    const alsoQuoted = (quoted.length ? ' ' + nameList(quoted) + verb(quoted) + 'a quote out for it.' : '')
      + (leads.length ? ' ' + nameList(leads) + asked + 'it.' : '');
    const body = named
      ? (othersHold
          ? esc(b.space) + ' is also held on ' + this.fmtDate(b.event_date) + mine + ' by ' + nameList(holders) + '.'
            + alsoQuoted + ' Move one, or confirm the room turns in time.'
          : quoted.length
            ? esc(b.space) + ' is also quoted for ' + this.fmtDate(b.event_date) + mine + ' on ' + nameList(quoted) + '.'
              + (leads.length ? ' ' + nameList(leads) + asked + 'it.' : '')
              + ' Nothing else is booked yet, so this is a heads-up, not a clash.'
            : nameList(leads) + asked + esc(b.space) + ' on ' + this.fmtDate(b.event_date)
              + '. Nothing has been quoted or booked yet.')
      : this.fmtDate(b.event_date) + mine + ' also has ' + names + '. ' + nEls + ' has a space named, so Bar Cop cannot tell whether they share a room. Add the space to each to be sure.';
    const headline = named
      ? (hard ? 'Double-booking' : othersHold ? 'Room already held'
         : quoted.length ? 'Same date, another quote out' : 'Same date, another enquiry')
      : count + ', one day';
    return '<div style="border:1px solid ' + col + ';background:var(--input);border-radius:6px;padding:11px 14px;margin-bottom:14px;font-size:12px;color:var(--t2);line-height:1.6;">'
      + '<span style="color:' + col + ';font-weight:800;">' + headline + '</span> &middot; ' + body + '</div>';
  },

  // The event-staff roster table (who is charged to this event, and their hours).
  staffingHtml(b) {
    const people = this.eventStaffByPerson(b);
    if (!people.length) return '<div style="font-size:12px;color:var(--t4);">No staff checked for this event yet. In Build Schedule, open each person working it and check "Working ' + esc(this.title(b)) + '."</div>';
    const rows = people.map(p =>
      '<tr><td>' + esc(p.name) + '</td><td>' + p.hours.toFixed(1) + 'h</td><td style="color:var(--t3);">' + (p.logged ? 'logged' : 'scheduled') + '</td><td>' + App.fmtCurrency(p.cost) + '</td></tr>'
    ).join('');
    return '<table class="row-list"><thead><tr><th>Event Staff</th><th>Hours</th><th>Source</th><th>Cost</th></tr></thead><tbody>' + rows + '</tbody></table>';
  },

  async patch(id, fields) {
    const list = this.bookings();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return false;
    /* ⚠⚠ HAND putRecord A DIFFERENT OBJECT THAN THE ONE IN THE LIST, OR ITS REVERT IS A NO-OP.
       This assigned the new record into the array and THEN passed that same object to putRecord —
       the exact shape putRecord's own comment warns about: `prev` and `rec` become one object, so
       the rollback assigns it to itself and the old values are already gone.
       ⛔ MEASURED on a refused write: the booking read "Booked" with a deposit date on screen and in
       memory while the server still held "Lead". cash-engine.eventInflow counts `stage === 'Booked'`,
       so that event's balance entered the 13-week forecast and Safe to Spend on a booking that was
       never saved, and vanished on the next reload. A copy handed in reverts correctly (the control).
       This is the central write door for the whole lifecycle — stage changes, rate-card application,
       deposit and balance dates, quote edits — so it is the one place the fix belongs. */
    const next = Object.assign({}, list[i], fields, { updated_at: new Date().toISOString() });
    const ok = await App.putRecord('core', 'booking', next);   // places `next`, restores the old row if refused
    // Re-render either way: on a refusal the row is back to its saved values and the screen must
    // show that, rather than the change the operator thinks landed.
    if (this._detailId === id) this.renderDetail(id);
    else this.renderList();
    return ok;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (App._evBookingFocus) {
      const fid = App._evBookingFocus; App._evBookingFocus = null;
      if (this.bookings().some(b => b.id === fid)) { this.openDetail(fid); return; }
    }
    // A normal landing always shows the pipeline. (Without this, a sticky
    // _detailId re-opened the last booking with no way back to the list.)
    this._detailId = null;
    this.renderList();
  },

  // ── Shared booking-detail fields (inline new form + Edit popup) ───────────
  // Light lead capture: who / what / when. Cost and P&L numbers come later, at
  // the Completed stage. `p` is the id prefix so the inline form and the edit
  // popup never collide.
  fieldsHtml(b, p, compact) {
    const today = App.todayLocal();
    const typeOpts = '<option value="">Select type...</option>' + this.EVENT_TYPES.map(t => '<option' + (b && b.event_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const srcOpts = '<option value="">Select source...</option>' + this.SOURCES.map(s => '<option' + (b && b.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const stageOpts = this.STAGES.map(s => '<option' + ((b && b.stage === s) || (!(b && b.stage) && s === 'Lead') ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const v = x => (x != null && x !== '') ? x : '';
    const C = {
      name:   '<div class="f"><label>Event Name</label><input type="text" id="' + p + '-name" value="' + esc(b?.event_name || '') + '" placeholder="Smith Rehearsal Dinner"/></div>',
      cname:  '<div class="f"><label>Contact Name</label><input type="text" id="' + p + '-cname" value="' + esc(b?.contact_name || '') + '" placeholder="Jen Mitchell"/></div>',
      phone:  '<div class="f"><label>Phone</label><input type="tel" id="' + p + '-phone" value="' + esc(b?.contact_phone || '') + '" placeholder="Optional"/></div>',
      email:  '<div class="f"><label>Email</label><input type="email" id="' + p + '-email" value="' + esc(b?.contact_email || '') + '" placeholder="For the quote"/></div>',
      type:   '<div class="f"><label>Event Type</label><select id="' + p + '-type" class="form-input">' + typeOpts + '</select></div>',
      source: '<div class="f"><label>Source</label><select id="' + p + '-source" class="form-input">' + srcOpts + '</select></div>',
      stage:  '<div class="f"><label>Stage</label><select id="' + p + '-stage" class="form-input">' + stageOpts + '</select></div>',
      date:   '<div class="f"><label>Event Date</label><input type="date" id="' + p + '-date" value="' + esc(b?.event_date || '') + '"/></div>',
      time:   '<div class="f"><label>Time</label><input type="text" id="' + p + '-time" value="' + esc(b?.event_time || '') + '" placeholder="6:00 PM"/></div>',
      party:  '<div class="f"><label>Party Size</label><input type="number" id="' + p + '-party" value="' + v(b?.party_size) + '"/></div>',
      space:  '<div class="f"><label>Space</label><input type="text" id="' + p + '-space" value="' + esc(b?.space || '') + '" placeholder="Private room"/></div>',
      recv:   '<div class="f"><label>Date Received</label><input type="date" id="' + p + '-recv" value="' + esc(b?.date_received || today) + '"/></div>',
      notes:  '<div class="f" style="width:100%;"><label>Requests / Notes</label><textarea id="' + p + '-req" class="notes-ta" rows="2" placeholder="What they asked for, follow-up notes, why it closed.">' + esc(b?.requests || '') + '</textarea></div>'
    };
    // Compact (the inline landing form): all data cells on two rows; notes below.
    if (compact) {
      // Event Name leads (wider); all data cells fit on two rows, notes below.
      const nameW = '<div class="f" style="flex:2 1 170px;"><label>Event Name</label><input type="text" id="' + p + '-name" value="' + esc(b?.event_name || '') + '" placeholder="Smith Rehearsal Dinner"/></div>';
      return '<div class="form-row eb-crow" style="gap:12px;flex-wrap:wrap;">' + nameW + C.cname + C.phone + C.email + C.date + C.time + '</div>'
        + '<div class="form-row eb-crow" style="gap:12px;flex-wrap:wrap;">' + C.party + C.type + C.space + C.recv + C.source + C.stage + '</div>'
        + C.notes;
    }
    // Default (the Edit popup): narrow-form reflows these into a clean 2-up grid,
    // six cells per column. Event Name takes the first spot; Notes is full-width.
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">' + C.name + C.cname + C.phone + C.email + C.type + C.source + C.stage + C.date + C.time + C.party + C.space + C.recv + '</div>'
      + C.notes;
  },

  collect(p) {
    const g = x => document.getElementById(p + '-' + x);
    return {
      event_name:    g('name')?.value.trim() || '',
      contact_name:  g('cname')?.value.trim() || '',
      contact_phone: g('phone')?.value.trim() || '',
      contact_email: g('email')?.value.trim() || '',
      event_type:    g('type')?.value || '',
      source:        g('source')?.value || '',
      stage:         g('stage')?.value || 'Lead',
      event_date:    g('date')?.value || '',
      event_time:    g('time')?.value.trim() || '',
      party_size:    parseInt(g('party')?.value) || null,
      space:         g('space')?.value.trim() || '',
      date_received: g('recv')?.value || App.todayLocal(),
      requests:      g('req')?.value.trim() || ''
    };
  },

  // ── Landing: stat strip + inline New Booking form + pipeline ──────────────
  renderList() {
    this._detailId = null;
    const all = this.bookings();

    const open  = all.filter(b => this.isOpen(b.stage));
    const stale = open.filter(b => { const d = this.daysSince(b.date_received); return d != null && d >= 3; });
    const booked = all.filter(b => b.stage === 'Booked');
    const bookedSoon = booked.filter(b => { const d = this.daysUntil(b.event_date); return d != null && d >= 0 && d <= 30; });
    const pipelineVal = open.reduce((s, b) => s + this.quoteTotal(b), 0);
    const depositsDue = this.depositsDueTotal();   // one definition, shared with the Events dashboard

    const stat = (label, val, color) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Open Leads', String(open.length), open.length ? '' : 'var(--t3)')
      + stat('Stale (3+ Days)', String(stale.length), stale.length ? 'var(--amber)' : '')
      + stat('Pipeline Value (incl. tax)', App.fmtCurrency(pipelineVal))
      + stat('Booked, Next 30d', String(bookedSoon.length))
      + stat('Deposits Due', App.fmtCurrency(depositsDue), depositsDue ? 'var(--amber)' : '')
      + '</div></div>';

    // Inline New Booking form (persists in-progress via _addDraft). Buttons below
    // the card, bottom-left.
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('eb-new-booking', 'New Booking', '<button class="btn btn-ghost btn-sm no-print" id="eb-worksheet" type="button">Worksheet</button>')
      + '<div class="collapse-body"><div id="eb-add-form">' + this.fieldsHtml(this._addDraft, 'ebn', true) + '</div></div></div>'
      + '<div data-collapse-group="eb-new-booking" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="eb-add">Create Booking</button>'
      + '<button class="btn btn-ghost" id="eb-startover">Start Over</button>'
      + '<span id="eb-add-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>';

    let listSection;
    if (all.length === 0) {
      listSection = '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">Log your first booking above. Your pipeline shows here as you add them.</div></div>';
    } else {
      const chipDefs = [{ v: '', label: 'All' }].concat(this.STAGES.map(s => ({ v: s, label: s })));
      const chips = App.filterChips(this.filterStage, chipDefs, 'eb-stage-chip');
      const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div></div>';

      const list = (this.filterStage ? all.filter(b => b.stage === this.filterStage) : all)
        .slice().sort((a, b) => (b.date_received || b.event_date || '').localeCompare(a.date_received || a.event_date || ''));

      const rows = list.slice(0, App.listLimit('core', 'booking')).map(b => {
        const dUntil = this.daysUntil(b.event_date);
        const isStale = this.isOpen(b.stage) && (this.daysSince(b.date_received) >= 3);
        const qt = this.quoteTotal(b);
        const money = b.stage === 'Completed' ? App.fmtCurrency(this.bookingRevenue(b))
          : (qt ? App.fmtCurrency(qt) : '-');
        const dep = b.stage === 'Booked'
          ? (b.deposit_paid_date ? '<span style="color:var(--green);">Deposit paid</span>'
              : (b.deposit_amount ? '<span style="color:var(--amber);">' + App.fmtCurrency(b.deposit_amount) + ' due</span>' : '<span style="color:var(--t3);">-</span>'))
          : '<span style="color:var(--t3);">-</span>';
        return '<tr class="eb-row" data-id="' + esc(b.id) + '" style="cursor:pointer;">'
          + '<td><div class="val" style="font-weight:600;">' + esc(this.title(b)) + '</div>'
          +   (b.contact_name && b.event_name ? '<div style="font-size:10px;color:var(--t3);">' + esc(b.contact_name) + '</div>' : '') + '</td>'
          + '<td>' + esc(b.event_type || '-') + '</td>'
          + '<td>' + (b.event_date ? this.fmtDate(b.event_date) + (dUntil != null && dUntil >= 0 && dUntil <= 30 && b.stage === 'Booked' ? ' <span style="color:var(--t3);font-size:10px;">(' + dUntil + 'd)</span>' : '') : (isStale ? '<span style="color:var(--amber);font-size:11px;">stale</span>' : '-')) + '</td>'
          + '<td>' + (b.party_size ? b.party_size : '-') + '</td>'
          + '<td>' + money + '</td>'
          + '<td>' + dep + '</td>'
          + '<td style="color:' + this.stageColor(b.stage) + ';font-weight:700;">' + esc(b.stage || '') + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm eb-view" data-id="' + esc(b.id) + '">Open</button>'
          +   '<button class="btn btn-danger btn-sm eb-del" data-id="' + esc(b.id) + '">Delete</button></div></td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No bookings in this stage.</td></tr>';

      listSection = headRow
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Event</th><th>Type</th><th>Event Date</th><th>Party</th><th>Quote / Revenue</th><th>Deposit</th><th>Stage</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('core', 'booking', list, !!this.filterStage);
    }

    this.container.innerHTML = '<div class="screen">' + statStrip + addCard + listSection + '</div>';
    this.wireList();
  },

  wireList() {
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', e => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    // Keep the inline add form's in-progress entry alive across re-renders.
    document.getElementById('eb-add-form')?.addEventListener('input', () => { this._addDraft = this.collect('ebn'); });
    document.getElementById('eb-add')?.addEventListener('click', () => this.addBooking());
    document.getElementById('eb-startover')?.addEventListener('click', () => { this._addDraft = null; this.renderList(); });
    this.container.querySelectorAll('.eb-stage-chip').forEach(b =>
      b.addEventListener('click', () => { this.filterStage = b.dataset.v; this.renderList(); }));
    document.getElementById('eb-worksheet')?.addEventListener('click', () => this.worksheet());
    this.container.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.renderList())));
    this.container.querySelectorAll('.eb-row, .eb-view').forEach(el =>
      el.addEventListener('click', ev => {
        if (ev.target.closest('.eb-del')) return;
        const id = el.dataset.id;
        if (id) this.openDetail(id);
      }));
    this.container.querySelectorAll('.eb-del').forEach(b =>
      b.addEventListener('click', async ev => {
        ev.stopPropagation();
        const ok = await App.confirmDelete();
        if (!ok) return;
        await App.removeRecord('core', 'booking', b.dataset.id);
        this.renderList();
      }));
  },

  async addBooking() {
    const rec = this.collect('ebn');
    const say = m => { const e = document.getElementById('eb-add-err'); if (e) { e.textContent = m; e.style.display = m ? 'inline' : 'none'; } };
    say('');
    if (!rec.event_name && !rec.contact_name) { say('Enter an event name or a contact name.'); return; }
    const badNew = this._rejectReason(rec);
    if (badNew) { say(badNew); return; }
    /* ⚠⚠ THE THIRD STAGE DOOR, AND IT CARRIED NEITHER GUARD. This form renders the Stage dropdown,
       so a booking can be created straight at Booked or Quote Sent — the two states `changeStage`
       and `saveForm` both protect. Measured: created at Booked with a blank date (the state where
       "Deposits Due" bills an event the calendar, the countdown and the forecast cannot see), and
       created at Quote Sent with no rate snapshot, so setting the sales-tax rate afterwards moved
       the quote **$8,640.00 -> $9,234.00, $594.00 with zero edits to the booking**.
       ⚠ Same rule as saveForm, worded for a form that has no record behind it yet. */
    if (rec.stage === 'Booked' && !String(rec.event_date || '').trim()) {
      say('A booked event needs a date, or it will not reach your calendar or your cash forecast.');
      return;
    }
    if (rec.stage === 'Quote Sent' || rec.stage === 'Booked' || rec.stage === 'Completed') this._freezeRates(null, rec);
    // A booking can be created straight at Lost from this form; it still needs dating.
    this._applyStageFacts(null, rec.stage, rec);
    rec.id = App.uid();
    rec.created_at = new Date().toISOString();
    rec.updated_at = rec.created_at;
    const ok = await App.putRecord('core', 'booking', rec);
    if (!ok) {
      const e = document.getElementById('eb-add-err');
      if (e) { e.textContent = 'Could not save this booking. Check your access and try again.'; e.style.display = 'inline'; }
      return;   // don't navigate into a booking that was rejected (e.g. read-only access)
    }
    this._addDraft = null;
    this.openDetail(rec.id);   // jump straight into the new booking's workspace
  },

  // ── Active Booking workspace ─────────────────────────────────────────────
  openDetail(id) {
    this._detailId = id;
    this._viewStep = null;
    App.pushView(() => this.renderDetail(id));   // floating back returns to the pipeline
  },

  // The lifecycle rail. Every reached node (at or before the current stage) is
  // clickable to jump back and edit that step, like the closing-shift stepper;
  // the glow rides whichever step you are viewing. Same node design, just clickable.
  progressRail(b, viewStep) {
    const flow = this.STAGE_FLOW;
    const lost = b.stage === 'Lost';
    const cur = flow.indexOf(b.stage);
    const viewIdx = lost ? -1 : flow.indexOf(viewStep);
    const node = (s, i) => {
      const reached = !lost && i <= cur;
      const done = !lost && i < cur;
      const here = !lost && i === viewIdx;
      const fill = reached ? 'var(--green)' : 'var(--input)';
      const bord = reached ? 'var(--green)' : 'var(--b1)';
      const ink = reached ? 'var(--bg)' : 'var(--t4)';
      const glow = here ? 'box-shadow:0 0 0 4px rgba(81,138,121,0.28);' : '';
      const lbl = here ? 'var(--t1)' : reached ? 'var(--t2)' : 'var(--t4)';
      const wrap = 'display:flex;flex-direction:column;align-items:center;gap:7px;flex:0 0 auto;' + (reached ? 'cursor:pointer;' : '');
      const attrs = reached ? ' class="eb-step" data-step="' + esc(s) + '"' : '';
      return '<div' + attrs + ' style="' + wrap + '">'
        + '<span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:' + fill + ';border:1px solid ' + bord + ';color:' + ink + ';' + glow + '">' + (done ? '&#10003;' : (i + 1)) + '</span>'
        + '<span style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:' + lbl + ';text-align:center;">' + esc(s) + '</span></div>';
    };
    const conn = i => '<div style="flex:1;height:2px;background:' + (!lost && i <= cur ? 'var(--green)' : 'var(--b1)') + ';margin-top:13px;min-width:16px;"></div>';
    const parts = [];
    flow.forEach((s, i) => { if (i) parts.push(conn(i)); parts.push(node(s, i)); });
    return '<div style="display:flex;align-items:flex-start;max-width:520px;">' + parts.join('') + '</div>';
  },

  statsRow(b, dispStage) {
    const stage = dispStage || b.stage;
    const t = [];
    if (stage === 'Lead' || stage === 'Quote Sent') {
      const ds = this.daysSince(b.date_received);
      const qt = this.quoteTotal(b);
      t.push(this.statTile('Quoted Total', qt ? App.fmtCurrency(qt) : '-', 'all in, service and tax'));
      t.push(this.statTile('Per Head', b.per_head ? App.fmtCurrency(b.per_head) : '-', b.party_size ? b.party_size + ' guests' : 'set the headcount'));
      t.push(this.statTile('Party Size', b.party_size ? String(b.party_size) : '-', 'guests'));
      t.push(this.statTile('Days Open', ds != null ? String(ds) : '-', ds != null && ds >= 3 ? 'follow up' : 'since the inquiry', ds != null && ds >= 3 ? 'warn' : ''));
    } else if (stage === 'Booked') {
      const dU = this.daysUntil(b.event_date);
      const cd = dU == null ? '-' : dU < 0 ? 'past' : dU === 0 ? 'today' : String(dU);
      const cdSub = dU == null ? 'no date set' : dU < 0 ? 'event date passed' : dU === 0 ? 'event is today' : 'days out';
      // Outstanding, not the contract term: this tile reports what is still owed.
      const bal = this.balanceOutstanding(b);
      t.push(this.statTile('Countdown', cd, cdSub, dU != null && dU >= 0 && dU <= 7 ? 'warn' : ''));
      t.push(this.statTile('Quoted Total', App.fmtCurrency(this.quoteTotal(b)), 'all in, service and tax'));
      t.push(this.statTile('Deposit', b.deposit_paid_date ? 'Paid' : (b.deposit_amount ? App.fmtCurrency(b.deposit_amount) : '-'), b.deposit_paid_date ? 'in hand' : (b.deposit_amount ? 'still due' : 'none set'), b.deposit_paid_date ? 'good' : (b.deposit_amount ? 'warn' : '')));
      /* payment_method is READ here, not just written — a settled balance says which way it landed,
         because that is the difference between money already in your sales and money that was not.
         ⚠⚠ AND AN OVERPAYMENT IS NAMED. balanceDue clamps with Math.max(0, …), so a deposit larger
         than the quote read "$0.00 · paid in full" and the event dropped out of the forecast table
         entirely (that list only takes rows where the balance is above zero). The refund the bar
         OWES THE CLIENT — real money, a real liability — appeared on no screen at all. It is also
         the only tell that a figure was typed into the wrong box. */
      /* ⚠ REFUND OWED IS AN EXTRA TILE, NOT A REPLACEMENT. Swapping it in HID what was still owed,
         and the Mark Balance Paid button is gated separately — so in that state the balance could
         never be marked paid at all, and (before the anchor fix) it flooded the forecast forever.
         They are two different facts and an overpaid deposit does not stop a balance existing. */
      t.push(this.statTile('Balance Due', App.fmtCurrency(bal),
        b.balance_paid_date
          ? ('paid in full' + (b.payment_method === 'register' ? ', through the register' : b.payment_method === 'direct' ? ', paid direct' : ''))
          : 'on event day', bal > 0 ? '' : 'good'));
      const over = this.refundOwed(b);
      if (over > 0) t.push(this.statTile('Refund Owed', App.fmtCurrency(over), 'deposit is over the quote', 'warn'));
    } else if (stage === 'Completed') {
      const rev = this.bookingRevenue(b);
      const labor = this.bookingLabor(b);
      const cost = (parseFloat(b.event_food_cost) || 0) + (parseFloat(b.event_bar_cost) || 0) + (parseFloat(b.event_other_cost) || 0) + labor;
      const margin = rev - cost;
      const mp = rev > 0 ? margin / rev * 100 : null;
      t.push(this.statTile('Revenue', App.fmtCurrency(rev), 'actual entered'));
      // Margin is a RESULT (the event's bottom line), so it takes App.fmtBal: minus
      // outside the '$', no plus on a positive. It is negative-capable by design and
      // this very line knows it (`margin >= 0 ? 'good' : 'bad'`), so a job that lost
      // money printed "$-500" on the tile flagged bad.
      t.push(this.statTile('Margin', App.fmtBal(margin), 'after all costs', margin >= 0 ? 'good' : 'bad'));
      t.push(this.statTile('Margin %', mp != null ? mp.toFixed(0) + '%' : '-', '30% is a solid event', mp != null && mp >= 30 ? 'good' : mp != null ? 'warn' : ''));
      t.push(this.statTile('Labor', App.fmtCurrency(labor), this.eventStaffShifts(b).length ? 'checked event staff' : 'check staff in schedule'));
      /* ⚠ AND SAY IF IT IS STILL UNPAID (S238). A button with no figure beside it is a button nobody
         presses: the P&L tiles are all about what the event EARNED, and none of them says whether
         the money actually arrived. This is the tile that sends them to the Collect the Balance
         row below, and it is the only thing on a Completed booking that reports it. */
      const owed = this.balanceOutstanding(b);
      if (owed > 0) t.push(this.statTile('Balance Due', App.fmtCurrency(owed), 'still to collect', 'warn'));
    } else if (stage === 'Lost') {
      /* ⚠ A LOST BOOKING HAD NO TILES AT ALL, which is why a banked deposit could disappear from
         every screen in Bar Cop while the record still held it. The deal is dead; the money is not. */
      const held = b.deposit_paid_date ? this._depositHeld(b) : 0;
      if (held > 0) {
        const o = b.deposit_outcome;
        const lbl = o === 'kept' ? 'Kept' : o === 'refunded' ? 'Refunded' : o === 'to_refund' ? 'To refund' : 'Undecided';
        const sub = o === 'kept' ? 'stayed in your account'
          : o === 'refunded' ? (b.deposit_refund_date ? 'paid back ' + this.fmtDate(b.deposit_refund_date) : 'paid back')
          : o === 'to_refund' ? 'money still to leave' : 'say what happened to it';
        t.push(this.statTile('Deposit Held', App.fmtCurrency(held), sub, o === 'kept' ? 'good' : o ? 'warn' : 'bad'));
        t.push(this.statTile('Outcome', lbl, o ? '&nbsp;' : 'nothing recorded', o ? '' : 'bad'));
      }
    }
    return t.length ? '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + t.join('') + '</div>' : '';
  },

  renderDetail(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) { this._detailId = null; this.renderList(); return; }
    this._detailId = id;
    if (this.actions) this.actions.innerHTML = '';
    const stage = b.stage || 'Lead';
    const accent = this.stageAccent(stage);
    const live = stage === 'Lead' || stage === 'Quote Sent' || stage === 'Booked';
    const readout = { 'Lead': 'Build a quote and send it.', 'Quote Sent': 'Follow up. Mark it booked when they confirm.', 'Booked': 'Collect the deposit and lock in the staff.', 'Completed': 'Close out the numbers below.', 'Lost': 'Closed. Reopen it to put it back in play.' }[stage] || '';
    // viewStep: the step the operator is looking at. Defaults to the live stage;
    // clicking an earlier node in the rail opens that step to edit without changing
    // the booking's real stage.
    const curIdx = this.STAGE_FLOW.indexOf(stage);
    let viewStep = stage, viewingPast = false;
    if (this._viewStep && curIdx >= 0) {
      const vi = this.STAGE_FLOW.indexOf(this._viewStep);
      if (vi >= 0 && vi < curIdx) { viewStep = this._viewStep; viewingPast = true; }
      else this._viewStep = null;
    }

    // ── Card 1: The Booking (header + progress + stat tiles + contact) ──
    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:' + accent + ';' + (live ? 'box-shadow:0 0 8px ' + accent + ';' : '') + '"></span>'
        + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:' + accent + ';">' + esc(stage) + '</span></div>'
        + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(this.title(b)) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + esc(b.event_type || '') + (b.event_date ? ' &middot; ' + this.fmtDate(b.event_date) : '') + (b.party_size ? ' &middot; ' + b.party_size + ' guests' : '') + (b.contact_name ? ' &middot; ' + esc(b.contact_name) : '') + '</div>'
        + (readout ? '<div style="font-size:13px;color:' + accent + ';font-weight:600;margin-top:8px;">' + esc(readout) + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" id="eb-edit">Edit Details</button>'
        + '<button class="btn btn-ghost btn-sm eb-runsheet-open">Run Sheet</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-q-pdf">Quote PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-agreement">Agreement</button>'
      + '</div></div>';

    const dispRow = (label, val) => '<div class="f"><label>' + label + '</label><div style="font-size:13px;color:var(--t1);">' + (val ? esc(val) : '<span style="color:var(--t4);">-</span>') + '</div></div>';
    const contact = this.subLabel('Contact and Event')
      + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">' + dispRow('Phone', b.contact_phone) + dispRow('Email', b.contact_email) + dispRow('Source', b.source) + dispRow('Time', b.event_time) + dispRow('Space', b.space) + '</div>'
      + (b.requests ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;">' + esc(b.requests) + '</div>' : '');

    // Remembered so the live quote redraw can refresh the tiles for the SAME step it is typing in.
    this._curView = viewStep;
    const statsRow = this.statsRow(b, viewStep);
    let card1 = '<div class="card">' + header
      + this.divider() + this.subLabel('Progress') + this.progressRail(b, viewStep)
      + (statsRow ? this.divider() + this.subLabel('This Booking') + '<div id="eb-stats">' + statsRow + '</div>' : '')
      + this.divider() + contact;
    if (stage === 'Lost' && b.lost_reason) card1 += this.divider() + this.subLabel('Why It Closed') + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">' + esc(b.lost_reason) + '</div>';
    card1 += '</div>';

    // ── Card 2: Work It (driven by the viewed step) ──
    let card2 = '';
    if (viewStep === 'Lead' || viewStep === 'Quote Sent') {
      const rcs = this.rateCards();
      let rcPicker;
      if (rcs.length && rcs.length <= 6) {
        rcPicker = '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + rcs.map(r =>
          '<button type="button" class="eb-rc-pill" data-rc="' + esc(r.id) + '" style="padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;'
          + (b.rate_card_id === r.id ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);' : 'background:var(--gold-tint);border:1px solid var(--b2);color:var(--t2);')
          + '">' + esc(r.package_name || '') + (r.per_head ? ' &middot; ' + App.fmtCurrency(r.per_head) + '/head' : '') + '</button>').join('') + '</div>';
      } else if (rcs.length) {
        rcPicker = '<select id="eb-q-rc" class="form-input" style="max-width:300px;"><option value="">Pick a package (optional)</option>' + rcs.map(r => '<option value="' + esc(r.id) + '"' + (b.rate_card_id === r.id ? ' selected' : '') + '>' + esc(r.package_name || '') + '</option>').join('') + '</select>';
      } else {
        rcPicker = '<div style="font-size:12px;color:var(--t3);">No packages yet. Build them on Pricing, or just set the price below.</div>';
      }
      card2 = '<div class="card form-card">' + this.subLabel('Build the Quote')
        + '<div style="margin-bottom:16px;">' + rcPicker + '</div>'
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:130px;flex-shrink:0;"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre eb-q-in" type="number" id="eb-q-ph" value="' + (b.per_head != null && b.per_head !== 0 ? b.per_head : '') + '" step="0.01"/></div></div>'
          + '<div class="f" style="width:100px;flex-shrink:0;"><label>Guests</label><input class="form-input eb-q-in" type="number" id="eb-q-party" value="' + (b.party_size != null && b.party_size !== 0 ? b.party_size : '') + '"/></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>F&amp;B Minimum</label><div class="fw"><span class="pre">$</span><input class="form-input pre eb-q-in" type="number" id="eb-q-fb" value="' + (b.fb_minimum != null && b.fb_minimum !== 0 ? b.fb_minimum : '') + '"/></div></div>'
          + '<div class="f" style="width:120px;flex-shrink:0;"><label>Room Fee</label><div class="fw"><span class="pre">$</span><input class="form-input pre eb-q-in" type="number" id="eb-q-room" value="' + (b.room_fee != null && b.room_fee !== 0 ? b.room_fee : '') + '"/></div></div>'
          + '<div class="f" style="width:120px;flex-shrink:0;"><label>Service Charge</label><div class="fw"><input class="form-input suf eb-q-in" type="number" id="eb-q-svc" value="' + (b.service_charge_pct != null && b.service_charge_pct !== '' ? b.service_charge_pct : this.DEFAULT_SVC_PCT) + '" step="0.5"/><span class="suf">%</span></div></div>'
          + '<div class="f" style="width:110px;flex-shrink:0;"><label>Tax</label><div class="fw"><input class="form-input suf eb-q-in" type="number" id="eb-q-tax" value="' + (b.tax_pct != null && b.tax_pct !== '' ? b.tax_pct : this.defaultTaxPct()) + '" step="0.01"/><span class="suf">%</span></div></div>'
        + '</div>'
        + '<div id="eb-q-breakdown" style="margin-top:16px;">' + this.quoteBreakdownHtml(this.quoteParts(b)) + '</div>'
        + '<div id="eb-q-err" style="display:none;margin-top:10px;font-size:12px;color:var(--red);"></div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-calc">Catering Calculator</button>'
        + '</div></div>';
    } else if (viewStep === 'Booked') {
      const bal = this.balanceDue(b);
      card2 = '<div class="card form-card">' + this.subLabel('Collect the Deposit')
        + '<div class="f" style="width:auto;"><label>Deposit Amount</label>'
          + '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">'
            + '<div class="fw" style="width:160px;flex-shrink:0;"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-dep" value="' + (b.deposit_amount != null && b.deposit_amount !== 0 ? b.deposit_amount : '') + '"/></div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
              + '<button class="btn btn-primary btn-sm" id="eb-dep-save">Save Deposit</button>'
              + (b.deposit_amount && !b.deposit_paid_date ? '<button class="btn btn-ghost btn-sm" id="eb-dep-paid">Mark Deposit Paid</button>' : '')
              + (this.balanceOutstanding(b) > 0 ? '<button class="btn btn-ghost btn-sm" id="eb-bal-paid">Mark Balance Paid</button>' : '')
            + '</div>'
            + '<span id="eb-dep-err" style="color:var(--red);font-size:12px;display:none;"></span>'
          + '</div>'
        + '</div>'
        + this.divider()
        + this.staffingHtml(b)
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-staff">Schedule Staff for this Event</button></div>'
        + this.divider() + this.subLabel('Run Sheet')
        + this.runSheetReadout(b)
        + '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm eb-runsheet-open">Open Run Sheet</button><button class="btn btn-ghost btn-sm eb-runsheet-print">Export Run Sheet</button></div>'
        + '</div>';
    } else if (viewStep === 'Completed') {
      // Only when there is a quote to derive it from; a house event that was never quoted has no
      // tax figure Bar Cop can hand them, and inventing one is exactly what it must not do.
      const qpNet = this.quoteTotal(b) > 0 ? this.quoteParts(b) : null;
      card2 = '<div class="card form-card">' + this.subLabel('Close Out the P&amp;L')
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:190px;flex-shrink:0;"><label>Actual Revenue (before tax)</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-actual" value="' + (b.actual_revenue != null && b.actual_revenue !== 0 ? b.actual_revenue : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Food Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-food" value="' + (b.event_food_cost != null && b.event_food_cost !== 0 ? b.event_food_cost : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Bar Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-bar" value="' + (b.event_bar_cost != null && b.event_bar_cost !== 0 ? b.event_bar_cost : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Other Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-other" value="' + (b.event_other_cost != null && b.event_other_cost !== 0 ? b.event_other_cost : '') + '"/></div></div>'
        + '</div>'
        /* ⚠⚠ SAY WHICH NUMBER YOU WANT, AND HAND THEM IT (S235). `actual_revenue` had no stated
           basis and its two readers need opposite ones: `this-week.cateringFromBookings` posts it to
           the week's Events REVENUE line, beside Bar and Food, which are NET — and the engine
           computes the tax remittance AS A PERCENTAGE OF that total, so an all-in figure overstates
           both the revenue and the tax owed. The seed entered it BOTH ways ($1,575 net-ish on one
           booking, $2,840 all-in on another) and no single entry could satisfy both readers.
           ⚠ THE DECISION: net of sales tax, because every other revenue number in Bar Cop is. The
           service charge and the room fee ARE revenue (they are income to the bar); only the tax is
           not. And the operator is handed the figure rather than asked to compute it — derived from
           the QUOTE, which Bar Cop knows exactly, not inferred about the actual. */
        + (qpNet && qpNet.tax > 0 ? '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:8px;">'
            + 'You quoted ' + App.fmtCurrency(qpNet.total) + ' all in. Before sales tax that is '
            + '<b style="color:var(--t2);">' + App.fmtCurrency(qpNet.total - qpNet.tax) + '</b>. '
            + 'Enter what the event actually earned, not counting the tax you collected for the state.</div>' : '')
        + '<div id="eb-pl-err" style="display:none;margin-top:10px;font-size:12px;color:var(--red);"></div>'
        /* ⚠⚠ SETTLE THE BALANCE FROM THE CARD YOU LAND ON (S238, Kyle: "shouldn't have to go back to
           previous step"). Mark Balance Paid lived ONLY on the Booked card, so the ordinary path —
           event happens, Mark Completed, close out the P&L — never passes it. The operator had to
           know to click backwards on the progress rail, which means **the default state of every
           completed event is "still owed"**, and its balance sits in the 13-week forecast until
           somebody thinks to go looking. Measured on a seed-shaped in-house buyout: **$7,400 of
           phantom cash landing in week 0, which is the low point** — feeding the runway and Safe to
           Spend. The one question Bar Cop cannot answer for itself is how it was settled, so the
           door to asking has to be where the operator already is. */
        + (this.balanceOutstanding(b) > 0
            ? this.divider() + this.subLabel('Collect the Balance')
              + '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">'
              + '<div style="font-size:13px;color:var(--t2);">' + App.fmtCurrency(this.balanceOutstanding(b))
              + ' is still owed on this event.</div>'
              + '<button class="btn btn-primary btn-sm" id="eb-bal-paid">Mark Balance Paid</button></div>'
            : '')
        + this.divider() + this.staffingHtml(b)
        + '</div>';
    } else if (viewStep === 'Lost' || b.stage === 'Lost') {
      /* ⚠ THE PAYABLE HAS TO STAY WORKABLE, or "still to refund" is just a label. A Lost booking
         rendered no card at all, so a deposit the bar had agreed to give back could be recorded and
         then never settled — it would sit in the 13-week forecast as money leaving, for ever.
         This is also the only door for a booking that was marked Lost before the question existed,
         or by the Stage dropdown in Edit Details, which does not ask. */
      const held = b.deposit_paid_date ? this._depositHeld(b) : 0;
      if (held > 0) {
        const o = b.deposit_outcome;
        card2 = '<div class="card form-card">' + this.subLabel('The Deposit You Were Holding')
          + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
          + (o === 'kept' ? 'You kept ' + App.fmtCurrency(held) + '. It stayed in your account and no cash moves.'
             : o === 'refunded' ? 'You refunded ' + App.fmtCurrency(held) + (b.deposit_refund_date ? ' on ' + this.fmtDate(b.deposit_refund_date) : '') + '. That money has left your bank.'
             : o === 'to_refund' ? App.fmtCurrency(this._refundOwedOnLost(b)) + ' is still to go back to them. Your Cash Forecast counts it as money leaving until you mark it paid.'
               + (this._refundOwedOnLost(b) < held ? ' You are keeping ' + App.fmtCurrency(held - this._refundOwedOnLost(b)) + '.' : '')
             : 'You are holding ' + App.fmtCurrency(held) + ' of theirs and Bar Cop has no record of what happened to it, so it is in no number anywhere. Say which.')
          + '</div>'
          /* ⚠ S247 — HOW MUCH GOES BACK. Keeping a cancellation fee out of the deposit and returning
             the rest is ordinary, and charging the whole thing made that unrepresentable. Only shown
             while there IS something still to refund; the box defaults to the whole deposit, which
             is what every record written before this field existed already means. */
          + (o === 'to_refund'
              ? '<div class="form-row" style="gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">'
                + '<div class="f" style="width:170px;flex-shrink:0;"><label>Amount Going Back</label>'
                + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-refund-amt" value="'
                + this._refundOwedOnLost(b) + '"/></div></div>'
                + '<button class="btn btn-ghost btn-sm" id="eb-refund-amt-save">Save Amount</button>'
                + '<span id="eb-refund-err" style="color:var(--red);font-size:12px;display:none;"></span></div>'
              : '')
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
          + (o !== 'kept' ? '<button class="btn btn-ghost btn-sm eb-dep-out" data-out="kept">Keeping it</button>' : '')
          + (o !== 'refunded' ? '<button class="btn btn-primary btn-sm eb-dep-out" data-out="refunded">' + (o === 'to_refund' ? 'Mark refund paid' : 'Already refunded') + '</button>' : '')
          + (o !== 'to_refund' ? '<button class="btn btn-ghost btn-sm eb-dep-out" data-out="to_refund">Still to refund</button>' : '')
          + '</div></div>';
      }
    }

    const viewBanner = viewingPast
      ? '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--t1);">Editing your ' + esc(viewStep) + ' step. Save your changes, then Back to ' + esc(stage) + '.</div>'
      : '';
    const html = '<div class="screen">' + this.conflictBanner(b) + card1 + viewBanner + card2 + this.actionBar(stage, viewStep, viewingPast) + '</div>';
    this.container.innerHTML = html;
    this.wireDetail(b);
  },

  // One big forward action for the live stage, plus the quiet secondaries. When
  // viewing a prior step, show that step's save and a way back instead.
  actionBar(stage, viewStep, viewingPast) {
    const act = [];
    if (viewingPast) {
      if (viewStep === 'Lead' || viewStep === 'Quote Sent') act.push('<button class="btn btn-primary" id="eb-q-save">Save Quote</button>');
      act.push('<button class="btn btn-ghost" id="eb-viewback">Back to ' + esc(stage) + '</button>');
      return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' + act.join('')
        + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div>';
    }
    if (stage === 'Lead') {
      act.push('<button class="btn btn-primary" id="eb-q-save">Save Quote</button>');
      act.push('<button class="btn btn-ghost" id="eb-send">Email Quote</button>');
      /* ⛔⛔ A QUOTE DOES NOT HAVE TO GO BY EMAIL, AND WITHOUT THIS A PHONE BOOKING COULD NOT MOVE AT
         ALL. Kyle, walking the real app: *"you cannot get to the quote sent screen without emailing
         a quote.. this is wrong.. if no email is used."* He is right, and the reach is the common
         case: `sendQuote` REFUSES without a `contact_email`, and Email Quote was the ONLY forward
         action on a Lead — so a party booked over the phone or at the bar could never reach Quote
         Sent, therefore never Booked, therefore never take a deposit, reach the calendar, or enter
         the cash forecast. Bar Cop's own Source list leads with Phone and Walk-in.
         The only escape was the Stage dropdown inside Edit Details, which is a hidden door and not
         the "one big forward action" this workspace is built around. Quotes get read down the phone
         and handed over on paper — Quote PDF is right there in the header — so the stage has to be
         markable on its own. ⚠ Found by a real-app pass, not by six scan rounds: a harness cannot
         see that the button you need is not on the screen ([[the-loop]] #32). */
      act.push('<button class="btn btn-ghost eb-stage" data-to="Quote Sent">Mark Quote Sent</button>');
    }
    if (stage === 'Quote Sent') {
      act.push('<button class="btn btn-primary eb-stage" data-to="Booked">Mark Booked</button>');
      act.push('<button class="btn btn-ghost" id="eb-q-update">Update Quote</button>');
      act.push('<button class="btn btn-ghost" id="eb-resend">Resend Quote</button>');
    }
    if (stage === 'Booked')      act.push('<button class="btn btn-primary btn-lg eb-stage" data-to="Completed">Mark Completed</button>');
    if (stage === 'Completed') {
      act.push('<button class="btn btn-primary" id="eb-pl-save">Save P&amp;L</button>');
      act.push('<button class="btn btn-ghost eb-stage" data-to="Booked">Reopen</button>');
    }
    if (stage === 'Lost')        act.push('<button class="btn btn-ghost eb-stage" data-to="Lead">Reopen</button>');
    if (stage !== 'Lost' && stage !== 'Completed') act.push('<button class="btn btn-ghost" id="eb-lost" style="color:var(--red);">Mark Lost</button>');
    return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' + act.join('')
      + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div>';
  },

  /* ⭐⭐ ONE RULE, EVERY DOOR AND THE LIVE BREAKDOWN: **a blank cell means UNCHANGED. Type 0 to zero
     it.** Round 4 gave this an `onlyTyped` flag so only the incidental doors skipped blanks, and
     kept "an explicit Save means what the form shows" for Save Quote. That split immediately paid
     out three ways, all measured:
       · **Email Quote** never got the flag, so clearing Per Head to retype it mailed the client
         "Quoted total: $0.00" against a truth of $7,310.25, banked the booking at $0 and marked it
         Quote Sent — on the one door whose output the client keeps.
       · the **live breakdown** read blank as 0 while the nav doors read it as unchanged, so the
         screen said **$0.00** and the click saved **$7,310.25**. The number they are looking at was
         not the number the click banks, in either direction.
       · a partly-typed number (`8.`, `-`) reports as `''` to `type="number"`, so mid-typing landed
         in that same split.
     Two rules for one cell is what produced all three. There is now one, it is the safe direction,
     and the escape hatch is real: a typed `0` is collected as a genuine 0, and a stored 0 renders as
     an empty box, so blank round-trips ([[the-loop]] #58 — the fix for a widened mechanism is fewer
     special cases, not more). */
  collectQuote() {
    const g = id => { const el = document.getElementById(id); return (el && String(el.value).trim() !== '') ? el : null; };
    const f = {};
    if (g('eb-q-ph'))    f.per_head = parseFloat(g('eb-q-ph').value) || 0;
    if (g('eb-q-party')) f.party_size = parseInt(g('eb-q-party').value) || null;
    if (g('eb-q-fb'))    f.fb_minimum = parseFloat(g('eb-q-fb').value) || 0;
    if (g('eb-q-room'))  f.room_fee = parseFloat(g('eb-q-room').value) || 0;
    if (g('eb-q-svc'))   f.service_charge_pct = (g('eb-q-svc').value !== '') ? (parseFloat(g('eb-q-svc').value) || 0) : this.DEFAULT_SVC_PCT;
    if (g('eb-q-tax'))   f.tax_pct = (g('eb-q-tax').value !== '') ? (parseFloat(g('eb-q-tax').value) || 0) : this.defaultTaxPct();
    const cur = this.bookings().find(x => x.id === this._detailId) || {};
    f.quoted_total = Math.round(this.quoteParts(Object.assign({}, cur, f)).total);
    return f;
  },

  /* ⚠⚠ ONE GUARD, BOTH QUOTE DOORS — a quote is a document a client signs. quoteParts applies no
     floor to any input, so a mistyped negative went straight onto it. Measured through the shipped
     function: room_fee -9000 against a $6,000 minimum produced a Quoted Total of **-$1,305.00** on
     the quote PDF and the agreement, and a service charge of -20 printed as a discount wearing the
     service charge's name.
     ⚠ REFUSED, NOT SILENTLY CLAMPED, for the same reason as the rate card: rewriting the operator's
     number without saying so is the other way to put something untrue on a client's paperwork.
     Both Save Quote and Update Quote route through here so they cannot drift apart. */
  async saveQuote(id) {
    const f = this.collectQuote();
    const err = document.getElementById('eb-q-err');
    const say = m => { if (err) { err.textContent = m; err.style.display = m ? 'block' : 'none'; } };
    say('');
    const bad = this._rejectReason(f);
    if (bad) { say(bad); return false; }
    return this.patch(id, f);
  },

  // Live recompute of the breakdown as the operator types in the quote fields.
  renderQuoteBreakdown() {
    const el = document.getElementById('eb-q-breakdown');
    if (!el) return;
    const cur = this.bookings().find(x => x.id === this._detailId) || {};
    const f = this.collectQuote();
    /* ⚠ SAY IT WHILE THEY ARE TYPING, NOT AT SAVE. The reader floor in `quoteParts` is right, but it
       made a mistyped `-95` per head render as a clean **$0.00** everywhere in the breakdown — which
       reads as "no price entered yet" rather than as a mistake. (Before the floor it read
       -$5,700.00, visibly wrong; the floor made it invisibly wrong, which is worse.) The operator
       had no signal at all until Save Quote finally refused. */
    /* ⛔⛔ A REFUSED VALUE IS NOT PRICED AT ALL — found by Kyle on the very next screen after the
       tile fix below, and it IS that fix's own [[the-loop]] #58: the tiles used to render only from
       the STORED record, which no door lets hold a negative, so nothing had to ask what they do with
       one. Making them follow the typing handed them a value the app had just refused.
       MEASURED on screen: a red line reading "Per Head cannot be negative." with **Per Head
       $-62.00** and **Quoted Total $250.00** printed confidently above it — negative money on a tile,
       and a "quoted total" that is just the room fee left standing after the floor ate the rest.
       Neither figure is true of this booking, and [[output-honesty]] is that every displayed number
       must be. So while the input is invalid, BOTH surfaces show the booking as it actually stands
       and the message says what to fix. One rule, no disagreement, nothing untrue on screen. */
    const bad = this._rejectReason(f);
    this._stepErr(bad);
    const merged = bad ? Object.assign({}, cur) : Object.assign({}, cur, f);
    el.innerHTML = this.quoteBreakdownHtml(this.quoteParts(merged));
    /* ⛔⛔ AND THE TILES ABOVE, BECAUSE THEY NAME THE SAME QUANTITY. Found by Kyle in the real app in
       two minutes, on ground five adversarial rounds had just been over — a node harness cannot see
       that an element was not re-rendered.
       Typing in the quote cells only redrew `#eb-q-breakdown`; `statsRow` is built by renderDetail
       off the STORED record and sat there stale. MEASURED on screen: the **Quoted Total tile read
       "–" while the Quoted Total line directly beneath it read $3,828.18**, and Per Head read "–"
       against a 62 in its own box. One screen, one quantity, two answers — the exact class
       [[the-loop]] #54 exists for, and it reads as "the app has not worked out the price yet", so
       the operator presses Save just to find out what they are looking at.
       ⚠ Only the Lead / Quote Sent branch is ever redrawn here (the quote cells exist nowhere else),
       so this does not widen `statsRow`'s reach into its Booked or Completed branches ([[the-loop]]
       #58 — re-derive the assumptions at the new reach, and keep the new reach narrow). */
    const tiles = document.getElementById('eb-stats');
    const view = this._curView || merged.stage;
    if (tiles && (view === 'Lead' || view === 'Quote Sent')) tiles.innerHTML = this.statsRow(merged, view);
  },

  async applyRateCard(id, rcId) {
    const b = this.bookings().find(x => x.id === id);
    const cur = (b && b.rate_card_id === rcId) ? '' : rcId;   // tap the active pill again to clear it
    const rc = this.rateCards().find(r => r.id === cur);
    /* ⚠ CARRY WHAT IS TYPED. A guest count typed and not yet saved was destroyed by this patch's
       re-render, and `quoted_total` was then banked off the STALE count — measured: 90 typed,
       stored 60, total $6,541 where the operator meant $9,811.13. The card's own three fields win
       (that is what tapping it means); everything else the operator typed is carried through, in
       ONE write rather than two. */
    const open = this.openEdits();
    if (!this._stepErr(this._rejectReason(open))) return;
    const fields = Object.assign({}, open, { rate_card_id: cur });
    if (rc) {
      if (rc.per_head != null) fields.per_head = rc.per_head;
      if (rc.fb_minimum != null) fields.fb_minimum = rc.fb_minimum;
      if (rc.room_fee != null) fields.room_fee = rc.room_fee;
    }
    /* ⚠⚠ THE ONE MONEY DOOR THE FLOOR DID NOT COVER, AND IT IS THE ENTRANCE RATHER THAN AN EXIT.
       Every other door refuses a negative; this one COPIED one straight off a rate card. Measured:
       a card carrying `room_fee: -250` (one built before ev-pricing grew its own guard yesterday)
       persisted -250 onto the booking in a single tap — and from that moment Save Quote, Update
       Quote, Email Quote, Mark Booked, Quote PDF and Agreement ALL refused it, naming a field the
       operator never typed in. Guarding the exits while leaving the entrance open is worse than not
       guarding at all: it strands the booking. */
    const bad = this._rejectReason(fields);
    // sticky: the bad value is on the CARD, not in any cell, so typing cannot clear this.
    if (bad) { this._stepErr(bad + ' Fix the package on Pricing, or set the price here.', true); return; }
    this._stepErr('');
    fields.quoted_total = Math.round(this.quoteParts(Object.assign({}, b, fields)).total);
    await this.patch(id, fields);
  },

  wireDetail(b) {
    const id = b.id;
    // Clickable lifecycle rail: jump back to a reached step to edit it.
    /* Every one of these leaves the current step's card, and each rebuilds the page from the STORED
       record — so whatever is typed and unsaved goes with it. Save it on the way out.
       ⚠⚠ BUT NAVIGATION IS NEVER BLOCKED BY THE WRITE VERDICT. Gating these on the save TRAPPED a
       read-only operator (and anyone with the storage-full banner up): Edit Details, the rail, Back
       to <stage> and Mark Lost all became buttons that did nothing, with NO message — `_stepErr`
       clears the span just before the failing write, and `_reportWriteFail` stays quiet while the
       viewer banner owns the message. Worse, having opened a past step, both ways back were gated on
       the same failing write, so the only escape was the global back arrow. A failed save reverts
       and the operator can see that; refusing to let them move is a second, worse failure.
       ⚠ The two CLIENT DOCUMENT doors below are the exception, and deliberately so. */
    this.container.querySelectorAll('.eb-step').forEach(el => el.addEventListener('click', async () => {
      const step = el.dataset.step;
      if ((await this._saveOpen(id)) === 'invalid') return;   // fixable: keep the message on screen
      this._viewStep = (step === b.stage) ? null : step;
      this.renderDetail(id);
    }));
    document.getElementById('eb-viewback')?.addEventListener('click', async () => {
      if ((await this._saveOpen(id)) === 'invalid') return;
      this._viewStep = null; this.renderDetail(id);
    });
    document.getElementById('eb-edit')?.addEventListener('click', async () => {
      if ((await this._saveOpen(id)) === 'invalid') return;
      this.showForm(id);
    });
    /* ⚠⚠ THE TWO DOORS THAT PRODUCE A DOCUMENT FOR THE CLIENT WERE THE TWO THAT DID NOT SAVE FIRST.
       Typing in the quote cells only calls renderQuoteBreakdown, so the screen showed the
       renegotiated number while both of these read the STORED record. Measured: per-head talked
       down from $95 to $85 and not yet saved — the breakdown on screen read $7,796 while the Quote
       PDF and the signed Event Agreement both printed $7,028. The client signs the wrong figure on
       the document that governs the deal.
       openEdits() is the helper that already exists for exactly this, and its own comment describes
       this bug being fixed for the STAGE buttons — these two were never added ([[the-loop]] #53: a
       comment naming a defect reads as handled to every later reader). Email Quote already saved
       first, which is what makes this an omission rather than a decision. */
    // ⚠ A REFUSED WRITE MUST NOT PRODUCE A CLIENT DOCUMENT. `_saveOpen` returns the verdict; the old
    // code discarded it and printed the STORED (pre-negotiation) figures — measured $10,965.38 on a
    // document the operator had just re-priced to $9,811.13.
    document.getElementById('eb-q-pdf')?.addEventListener('click', async () => {
      if ((await this._saveOpen(id)) !== true) return;
      this.quotePDF(this.bookings().find(x => x.id === id));
    });
    document.getElementById('eb-agreement')?.addEventListener('click', async () => {
      if ((await this._saveOpen(id)) !== true) return;
      this.agreementModal(id);
    });
    // Quote
    this.container.querySelectorAll('.eb-rc-pill').forEach(p => p.addEventListener('click', () => this.applyRateCard(id, p.dataset.rc)));
    document.getElementById('eb-q-rc')?.addEventListener('change', e => this.applyRateCard(id, e.target.value));
    document.getElementById('eb-q-save')?.addEventListener('click', () => this.saveQuote(id));
    document.getElementById('eb-q-update')?.addEventListener('click', () => this.saveQuote(id));
    document.getElementById('eb-q-calc')?.addEventListener('click', () => this.quoteCalc(id));
    this.container.querySelectorAll('.eb-q-in').forEach(el => el.addEventListener('input', () => this.renderQuoteBreakdown()));
    // Money. ⚠ A NEGATIVE DEPOSIT DOES NOT CLAMP, IT INFLATES: balanceDue is quoted MINUS deposit,
    // so -$2,000 printed a Balance Due of $11,811.13 on the signed agreement against a $9,811.13
    // quote — over-billing a client by $2,000 on the document they sign. Both deposit doors refuse.
    const depSay = m => { const e = document.getElementById('eb-dep-err'); if (e) { e.textContent = m; e.style.display = m ? 'inline' : 'none'; } };
    const depFields = fallback => {
      const raw = document.getElementById('eb-dep')?.value;
      const amt = (raw != null && raw !== '') ? (parseFloat(raw) || 0) : fallback;
      return { deposit_amount: amt };
    };
    document.getElementById('eb-dep-save')?.addEventListener('click', () => {
      const f = depFields(0);
      const bad = this._rejectReason(f);
      depSay(bad);
      if (!bad) this.patch(id, f);
    });
    document.getElementById('eb-dep-paid')?.addEventListener('click', () => {
      const f = depFields(parseFloat(b.deposit_amount) || 0);
      const bad = this._rejectReason(f);
      depSay(bad);
      if (!bad) this.patch(id, Object.assign(f, { deposit_paid_date: App.todayLocal() }));
    });
    // ⚠ The deposit box sits in the SAME flex row as this button, so a correction typed into it and
    // then settled with Mark Balance Paid was thrown away by the re-render (measured 2500 -> 1500).
    document.getElementById('eb-bal-paid')?.addEventListener('click', async () => {
      if ((await this._saveOpen(id)) === 'invalid') return;   // never settle a balance over an unread refusal
      this.markPaid(id);
    });
    // Staffing
    document.getElementById('eb-staff')?.addEventListener('click', () => { App._eventStaffTag = b.event_name || this.title(b); App._eventStaffDate = b.event_date || ''; App.openScreen('lc-build-schedule'); });
    this.container.querySelectorAll('.eb-runsheet-open').forEach(el => el.addEventListener('click', () => this.runSheet(id)));
    this.container.querySelectorAll('.eb-runsheet-print').forEach(el => el.addEventListener('click', () => this.printRunSheet(this.bookings().find(x => x.id === id))));
    // Event P&L. � actual_revenue does NOT reach the cash forecast  _eventTotal collects the
    // AGREED figure (quoteTotal); that change was tried and reverted. It IS posted to This Week's
    // Events revenue line, net of tax (S235), so a mistyped negative here is still money.
    document.getElementById('eb-pl-save')?.addEventListener('click', () => {
      const f = {
        event_food_cost:  parseFloat(document.getElementById('eb-pl-food')?.value) || 0,
        event_bar_cost:   parseFloat(document.getElementById('eb-pl-bar')?.value) || 0,
        event_other_cost: parseFloat(document.getElementById('eb-pl-other')?.value) || 0
      };
      const actEl = document.getElementById('eb-pl-actual');
      if (actEl) f.actual_revenue = parseFloat(actEl.value) || 0;
      const bad = this._rejectReason(f);
      const e = document.getElementById('eb-pl-err');
      if (e) { e.textContent = bad; e.style.display = bad ? 'block' : 'none'; }
      if (!bad) this.patch(id, f);
    });
    // Forward actions
    document.getElementById('eb-send')?.addEventListener('click', () => this.sendQuote(id));
    document.getElementById('eb-resend')?.addEventListener('click', () => this.sendQuote(id, true));
    // Recording (or correcting) what happened to a dead booking's deposit.
    this.container.querySelectorAll('.eb-dep-out').forEach(el => el.addEventListener('click', () => {
      const out = el.dataset.out;
      const f = { deposit_outcome: out };
      // Refunded means it has already left the bank, so it stops being projected out. Moving BACK
      // to kept or still-to-refund has to clear that date, or the money would read as gone twice.
      f.deposit_refund_date = (out === 'refunded') ? App.todayLocal() : null;
      /* ⛔⛔ AND IT HAS TO BE DATED, OR THE PAYABLE CAN VANISH ENTIRELY. `eventRefundsOwed` dates the
         obligation by `lost_date`, falling back to the EVENT date — and this card is the only door
         for a booking that reached Lost through Edit Details' Stage dropdown or the New Booking
         form, neither of which stamps one. MEASURED on a bar with $700 in the bank: a $3,000 refund
         recorded here on a booking whose event was five months out was charged **$0.00** — byte
         identical to owing nothing — and the Deposits to Refund card listed zero rows, while the
         card two inches above said "your Cash Forecast counts it as money leaving". With the event
         inside the quarter it charged in the WRONG WEEK, leaving the tightest week $3,000 rich and
         the Runway reading 13+ weeks against a truth of THIS WEEK. */
      if (!b.lost_date) f.lost_date = App.todayLocal();
      this.patch(id, f);
    }));
    // S247 — how much of the deposit goes back. Refused, not clamped, so a typo is never rewritten
    // silently onto a figure the cash forecast then charges.
    document.getElementById('eb-refund-amt-save')?.addEventListener('click', () => {
      const el = document.getElementById('eb-refund-amt');
      const err = document.getElementById('eb-refund-err');
      const say = m => { if (err) { err.textContent = m; err.style.display = m ? 'inline' : 'none'; } };
      const raw = el ? String(el.value).trim() : '';
      const v = parseFloat(raw);
      const held = this._depositHeld(b);
      if (raw === '' || isNaN(v)) { say('Enter how much goes back.'); return; }
      if (v < 0) { say('A refund cannot be negative.'); return; }
      if (v > held) { say('You only took ' + App.fmtCurrency(held) + '.'); return; }
      say('');
      this.patch(id, { refund_amount: v });
    });
    document.getElementById('eb-lost')?.addEventListener('click', async () => {
      if ((await this._saveOpen(id)) === 'invalid') return;
      this.markLost(id);
    });
    this.container.querySelectorAll('.eb-stage').forEach(btn => btn.addEventListener('click', () => this.changeStage(id, btn.dataset.to)));
    document.getElementById('eb-detail-del')?.addEventListener('click', async () => {
      const ok = await App.confirmDelete();
      if (!ok) return;
      // A refused delete restores the row and toasts; navigating away regardless made it look done.
      if (!(await App.removeRecord('core', 'booking', id))) return;
      this._detailId = null;
      App.goBack ? App.goBack() : this.renderList();
    });
  },

  // Whatever the operator has typed into the step they are looking at. Each step's card has its
  // own Save button, but the stage buttons sit in the SAME action row — and on Quote Sent, Mark
  // Booked is the PRIMARY button sitting to the LEFT of Update Quote. So a renegotiated per-head
  // was typed, the breakdown updated on screen, Mark Booked was pressed, and the booking saved at
  // the OLD price: the screen showed one total and the agreement stored another.
  // ⚠ EVERY read is gated on the input existing. These cards render one step at a time, and
  // `parseFloat(missing?.value) || 0` is 0 — an ungated collect would zero a banked deposit on
  // Mark Completed, which is worse than the bug it fixes.
  /* ⛔⛔⛔ A BLANK BOX IS NOT A TYPED ZERO, AND THE COMMENT ABOVE ALREADY SAID SO WHILE THE CODE DID
     THE OPPOSITE. The gate tested whether the ELEMENT exists, never whether the operator had put
     anything in it — and `parseFloat('') || 0` is 0 either way. For the three stage buttons that was
     survivable; round 3 wired SEVEN more doors onto the same collect, including two print buttons
     and every node of the navigation rail.
     ⛔ MEASURED: a Booked event with $1,500 banked. The operator clears the Deposit box to retype
     it and clicks **Quote PDF**. `deposit_amount` **$1,500 -> $0.00**, what is still owed
     **$4,912.50 -> $6,412.50**, and `balanceDue` — the figure on the SIGNED AGREEMENT — with it.
     `eventInflow` then puts $1,500 more into the 13-week forecast as still owed and prints $0 in the
     Deposit Held column on cash already in the bank. The card re-renders with the box blank again
     (a stored 0 renders as ''), so it looks exactly as they left it, and the tile row reads
     "Deposit / Paid / in hand" beside "Balance Due $6,412.50" — contradicting itself on one line.
     Same door zeroes Per Head (quote -> $0.00, and that is what the PDF prints), Guests (collapses
     to the F&B minimum) and Actual Revenue.
     **The rule: a blank cell means UNCHANGED, not zero.** An explicit Save on a visible form still
     means what the form shows — that is why only this collect passes `onlyTyped`. ([[the-loop]]
     #53: the comment naming this exact failure had been sitting here since round 1.) */
  openEdits() {
    const g = id => document.getElementById(id);
    const typed = id => { const el = g(id); return !!el && String(el.value).trim() !== ''; };
    const f = {};
    /* ⚠ ALL FOUR TRIGGER CELLS, NOT THREE. Round 4 gated on per head / guests / F&B minimum, so a
       ROOM-FEE-ONLY edit — an ordinary room-rental enquiry with no headcount yet — collected nothing
       and every navigation door dropped it: measured, $500.00 on screen, 0 writes, and the quote PDF
       printed $0.00. Round 3's shape had returned it. */
    if (typed('eb-q-ph') || typed('eb-q-party') || typed('eb-q-fb') || typed('eb-q-room')) Object.assign(f, this.collectQuote());
    if (typed('eb-dep')) f.deposit_amount = parseFloat(g('eb-dep').value) || 0;
    if (typed('eb-pl-food') || typed('eb-pl-bar') || typed('eb-pl-other') || typed('eb-pl-actual')) {
      if (typed('eb-pl-food'))   f.event_food_cost  = parseFloat(g('eb-pl-food').value) || 0;
      if (typed('eb-pl-bar'))    f.event_bar_cost   = parseFloat(g('eb-pl-bar').value) || 0;
      if (typed('eb-pl-other'))  f.event_other_cost = parseFloat(g('eb-pl-other').value) || 0;
      if (typed('eb-pl-actual')) f.actual_revenue   = parseFloat(g('eb-pl-actual').value) || 0;
    }
    return f;
  },

  /* The stage buttons sit in the same action row as the step's own Save, so they carry whatever is
     typed in the open card (`openEdits`). That means they are a money door too: they must refuse a
     negative like every other one, and they must not THROW AWAY a legitimate edit when the stage
     move itself is refused. */
  /* `sticky` marks a message whose cause is NOT in any input, so nothing the operator types can
     clear it. ⛔ Without it the rate-card refusal died on the next keystroke: `renderQuoteBreakdown`
     re-checks the typed cells on every input event, found nothing wrong with them, and wiped the one
     line explaining why tapping the package had done nothing — leaving an un-applied package, no
     price set, and no explanation on screen. */
  _stepErr(msg, sticky) {
    // Whichever step's card is on screen owns the message; there is no error span on the action bar.
    const el = ['eb-q-err', 'eb-pl-err', 'eb-dep-err'].map(i => document.getElementById(i)).find(Boolean);
    if (el && !(!msg && el.dataset && el.dataset.sticky === '1')) {
      el.textContent = msg || '';
      el.style.display = msg ? 'block' : 'none';
      if (el.dataset) { if (sticky && msg) el.dataset.sticky = '1'; else delete el.dataset.sticky; }
    }
    return !msg;
  },

  /* ⚠⚠ ONE DOOR FOR "SAVE WHAT IS OPEN, AND STOP IF THE WRITE WAS REFUSED". Round 3 found the same
     two-part shape at NINE places, so it is one helper rather than nine patches ([[the-loop]] step
     0.6: when the fix is to a PATTERN, extract one helper so they cannot drift apart).
     Part one — TYPED INPUT DISCARDED. Every one of these re-renders from the STORED record, so a
     renegotiation typed into the quote card and not yet saved is gone with nothing saying so:
     Email Quote's missing-email refusal ($1,154.25 measured), Edit Details from the header, a click
     on the progress rail, Mark Balance Paid / Mark Lost (which sit in the same flex row as the
     deposit box), and applying a rate card (which then banks `quoted_total` off the stale count).
     Part two — A REFUSED WRITE TREATED AS SUCCESS. `patch` returns a verdict and it was discarded,
     so the Quote PDF and the Agreement printed the pre-negotiation price under a comment saying
     that exact bug was fixed. `sendQuote` is the one door that already checked it, which is what
     proves the rest were omissions. */
  async _saveOpen(id) {
    const f = this.openEdits();
    /* ⚠ AND THESE DOORS MUST NOT FREEZE A LEAD'S RATES. They are incidental — printing, navigating,
       opening a popup — while `_freezeRates`' own rule is "nothing is frozen while the booking is
       still a Lead", because before a quote goes out the live rate is the correct one. The Service
       Charge and Tax cells always RENDER with a value, so collecting them stamped a snapshot on a
       Lead that had never been quoted: measured, a Quote PDF click pinned tax at 8.25%, and when the
       operator later corrected their rate to 10% that Lead sat at $6,412.50 against a live $6,500.00
       and stopped following the setting, with nothing on screen saying why.
       ⚠ `changeStage` deliberately does NOT come through here — a stage button is an explicit
       commitment, and the rates the operator can see are the ones it should freeze. */
    const b = this.bookings().find(x => x.id === id);
    if (!b) return false;                       // nothing can be saved onto a record that is gone
    if ((b.stage || 'Lead') === 'Lead') {
      /* ⚠ ...BUT ONLY WHEN THE CELL IS JUST THE RENDERED DEFAULT. Round 4 deleted both rates
         unconditionally, which threw away a service charge the operator had TYPED — measured: 22%
         and 9% entered on a Lead, Quote PDF clicked, both silently gone, and `quoted_total` banked
         at **7467 while the PDF printed $7,310.25**, a persisted figure $156.75 from anything on
         screen. A value that differs from the default is an override and is theirs; a value equal to
         it is just what the box was painted with, and keeping that is what freezes a Lead. */
      if ((parseFloat(f.service_charge_pct) || 0) === this.DEFAULT_SVC_PCT) delete f.service_charge_pct;
      if ((parseFloat(f.tax_pct) || 0) === this.defaultTaxPct()) delete f.tax_pct;
      if (f.quoted_total != null) f.quoted_total = Math.round(this.quoteParts(Object.assign({}, b, f)).total);
    }
    /* ⛔⛔ A VALIDATION REFUSAL AND A WRITE REFUSAL ARE DIFFERENT ANSWERS AND ROUND 4 RETURNED BOTH
       AS `false`. The navigation doors were then told to ignore the verdict — which is right for a
       write the operator cannot do anything about, and WRONG for a value they could fix in two
       seconds: the door re-rendered, deleted the very span holding "Deposit Amount cannot be
       negative", and took their typing with it. MEASURED: a Completed event with Food Cost 1450
       (correct) beside Other Cost -20 (a fat finger) — one rail click and **the $1,450 was gone,
       0 writes, and the explanation destroyed in the same tick**, so they never learn the minus sign
       was the problem. Mark Balance Paid and Mark Lost went further and stamped a terminal fact over
       the unread refusal. Three answers now: 'invalid' (stop, they can fix it), false (the write
       failed, let them move — blocking is the trap round 4 already had to undo), true. */
    if (!this._stepErr(this._rejectReason(f))) return 'invalid';
    if (!Object.keys(f).length) return true;
    return !!(await this.patch(id, f));
  },

  /* ⚠⚠ ONE DEFINITION OF WHAT A STAGE MOVE DOES TO THE CANCELLATION FACTS — because there are THREE
     doors that move a booking's stage and round 6 taught only one of them.
     ⛔ REOPENING A DEAD BOOKING MUST DROP WHAT DIED WITH IT. `deposit_outcome`,
     `deposit_refund_date` and — when the money actually went back — `deposit_paid_date` all describe
     a cancellation. Reopen wrote only the stage, so they survived onto the live booking. MEASURED:
     $1,500 banked, refunded on cancellation, reopened and re-Booked — `eventInflow` read **$5,040.75
     against a truth of $6,540.75** and `committedEventCash` reported **$1,500 "already in hand"**
     that had left the bank. It also left a stale outcome a later re-Lost resurrected, four months
     out of date, without asking anyone.
     ⛔ AND A BOOKING THAT REACHES LOST MUST BE DATED, because `eventRefundsOwed` dates the payable by
     `lost_date` and falls back to the EVENT date — five months out, that charged $0.00.
     ⚠ THE TWIN, which is why this is a helper and not a block: `changeStage` got both rules in round
     6 and **`saveForm`'s Stage dropdown had neither**, though it moves a booking out of Lost and into
     it just as freely; `addBooking` can create one at Lost outright. Copying the block would have
     been a second implementation of the thing under test ([[the-loop]] step 0.5, and #58 — a rule
     stops the class it names only if the NEXT door is derived against it).
     ⚠ Clearing `deposit_paid_date` ONLY on `refunded` is the factual half: the bar demonstrably does
     not hold that money any more. "Kept" is left alone — whether a kept cancellation fee becomes a
     deposit again is not knowable, and the cleared outcome means it asks again if the booking dies
     twice ([[the-loop]] #30). */
  _applyStageFacts(b, to, fields) {
    const from = (b && b.stage) || 'Lead';
    if (from === 'Lost' && to !== 'Lost') {
      if (b.deposit_outcome) fields.deposit_outcome = null;
      if (b.deposit_outcome === 'refunded') fields.deposit_paid_date = null;
      if (b.deposit_refund_date) fields.deposit_refund_date = null;
      if (b.lost_date) fields.lost_date = null;
    }
    if (to === 'Lost' && !(b && b.lost_date)) fields.lost_date = App.todayLocal();
    return fields;
  },

  async changeStage(id, to) {
    const edits = this.openEdits();
    if (!this._stepErr(this._rejectReason(edits))) return false;
    // ⚠ A FRESH OBJECT. `Object.assign(edits, …)` mutates in place, so `edits` and `fields` became
    // one object and the blank-date refusal below — which saves `edits` to protect the operator's
    // typing — wrote `stage: 'Booked'` with it, advancing the very booking it was refusing. Caught
    // by the pre-existing G6 pin the same minute it was written ([[the-loop]] #49's family).
    const fields = Object.assign({}, edits, { stage: to });
    const b = this.bookings().find(x => x.id === id);
    this._applyStageFacts(b, to, fields);
    /* ⚠⚠ A BOOKED EVENT WITH NO DATE IS OWED MONEY NOTHING CAN SEE. changeStage validated nothing,
       and every other surface keys on event_date: the calendar map is empty, the countdown reads
       "-", eventInflow skips it, and the dashboard's future-booked revenue is $0 — while
       "Deposits Due" still bills its deposit on BOTH the Bookings strip and the Events dashboard.
       So the one number it does produce is the one with no event behind it.
       Same shape as sendQuote's missing-email guard: name the problem and open the door that fixes
       it, rather than refusing in silence. */
    if (to === 'Booked' && b && !String(b.event_date || '').trim()) {
      /* ⚠⚠ AND THE REFUSAL MUST NOT EAT THE OPERATOR'S WORK. `openEdits` was collected at the top
         and this `return` threw it away: a per-head talked down from $95 to $85 on a 90-guest event
         — $900 of F&B subtotal — typed into the quote card, Mark Booked pressed, guard fires, Edit
         Details opens over the top and re-renders from the STORED record. The renegotiation was
         gone with nothing on screen saying so. Only the STAGE MOVE is refused here; the numbers
         they typed are valid and are saved before the prompt, so they survive the re-render. */
      // ⚠ And the verdict is checked: a refused write reverts the edits, so prompting the operator
      // to go and add a date would send them into Edit Details over numbers that are already gone.
      if (Object.keys(edits).length && !(await this.patch(id, edits))) return false;
      const go = await App.confirm({ title: 'Set the event date first',
        message: 'A booked event needs a date. Without one it will not reach your calendar, the countdown, or your cash forecast, but its deposit will still show as money you are owed.',
        confirmText: 'Edit Details', cancelText: 'Cancel' });
      if (go) this.showForm(id);
      return false;
    }
    if (to === 'Booked' && b && !b.date_received) fields.date_received = App.todayLocal();
    // Once a quote is out or committed it is a number someone else has seen, so the rates behind it
    // stop floating. Not on Lead (nothing has been sent) and not on Lost (a dead booking's total
    // never prints again, and writing to it would break "with no editable card, only the stage moves").
    if (to === 'Quote Sent' || to === 'Booked' || to === 'Completed') this._freezeRates(b, fields);
    await this.patch(id, fields);
    // No per-booking scoreboard credit by design: event revenue flows into This
    // Week (catering) and the Revenue Audit, where the engine measures real
    // weekly improvement.
  },

  /* ⚠⚠ ASK HOW IT WAS SETTLED. Bar Cop cannot work this out and guessing costs money both ways: a
     buyout the guests settle at the bar rings through the POS and is already in your sales, while a
     catering invoice paid by check never touched them. The forecast used to guess by deleting every
     Completed or past-dated event, which erased real receivables ($6,195 measured). One question,
     two buttons, asked at the only moment the operator actually knows — and until it is answered
     the balance simply stays owed, which is both true and the reason they will answer it. */
  markPaid(id) {
    const b = this.bookings().find(x => x.id === id); if (!b) return;
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">How was the balance paid?</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">'
      + App.fmtCurrency(this.balanceOutstanding(b)) + ' on ' + esc(this.title(b)) + '.</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="eb-paid-reg">Rang through the register</button>'
      + '<button class="btn btn-ghost" id="eb-paid-dir">Paid direct</button></div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:14px;">'
      + 'Rang through the register is already counted in your sales. Paid direct never touched the POS.</div></div>';
    App.openModal(html, { id: 'eb-paid-modal', maxWidth: 520 });
    const done = async (how) => {
      App.closeModal('eb-paid-modal');
      await this.patch(id, { balance_paid_date: App.todayLocal(), payment_method: how });
    };
    document.getElementById('eb-paid-reg')?.addEventListener('click', () => done('register'));
    document.getElementById('eb-paid-dir')?.addEventListener('click', () => done('direct'));
  },

  // Mark Lost with a captured reason (App.confirm only returns a boolean).
  /* ⚠⚠ WHEN A BOOKING DIES, ASK WHAT HAPPENED TO THE MONEY YOU ARE HOLDING. Marking Lost used to
     drop a banked deposit out of the cash position with no prompt and no record: measured, a $1,500
     deposit went {balanceTotal 8311.13, deposits 1500} -> {0, [], 0} and appeared on NO screen in
     Bar Cop, while the record still held it. `statsRow` returns '' for Lost, card 2 is empty and the
     rail has no clickable nodes, so there was nowhere for it to show even if it had been counted.
     Bar Cop cannot work out which of three things happened, and guessing costs money in both
     directions — so it asks once, at the only moment the operator knows, exactly as Mark Balance
     Paid asks how it was settled ([[the-loop]] #30: a single question beats a smarter inference).
     ⚠ Only asked when a deposit was actually COLLECTED. A promised-but-unpaid deposit is nothing to
     decide about, and a question with no stakes is how a real one stops being read. */
  markLost(id) {
    const b = this.bookings().find(x => x.id === id) || {};
    const held = b.deposit_paid_date ? this._depositHeld(b) : 0;
    const reasonField = '<div class="f" style="width:100%;"><label>Reason (optional)</label><input type="text" id="eb-lost-reason" placeholder="Booked elsewhere, date conflict, over budget"/></div>';
    const money = held > 0
      ? this.divider() + this.subLabel('The Deposit You Are Holding')
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
        /* ⛔ DO NOT TELL THE OPERATOR WHAT THEIR OWN CONTRACT SAYS. The first version of this read
           "Your agreement says the deposit is non-refundable" — true of the DEFAULT template and
           nothing else. `agreementTerms()` returns the operator's saved text whenever they have
           edited it (`App.acctGet('event_agreement_terms')`), and the agreement modal exists
           precisely so they can rewrite it to their own policy. Strike that clause and Bar Cop was
           asserting the content of their contract, wrongly, at the moment they decide whether to
           hand back real money — a legal-adjacent claim on a money decision ([[legal-protection]]).
           ⚠ And it cannot be fixed by READING the terms: they are free text, so "refundable up to
           30 days out" and "non-refundable" both contain the word, and a substring test would be
           wrong in both directions ([[the-loop]] #30 — do not infer a fact the data does not carry).
           Bar Cop states its own limit instead, which is true whatever their terms say. */
        + 'You have <b style="color:var(--t1);">' + App.fmtCurrency(held) + '</b> of theirs. '
        + 'Check your own event agreement for what you owe back — Bar Cop does not read your terms. '
        + 'It only counts money leaving if you say it does.</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary btn-sm" id="eb-lost-kept">Keeping it</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-lost-refunded">Already refunded</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-lost-torefund">Still to refund</button></div>'
      : '<div class="card-actions"><button class="btn btn-primary" id="eb-lost-save">Mark Lost</button></div>';
    App.openModal('<div class="card form-card" style="margin:0;"><div class="card-title">Mark This Booking Lost</div>'
      + reasonField + money + '</div>', { id: 'eb-lost-modal', maxWidth: 540, confirmDirty: true });
    const done = async (outcome) => {
      const reason = document.getElementById('eb-lost-reason')?.value.trim() || '';
      App.closeModal('eb-lost-modal');
      // ⚠ THROUGH THE SHARED HELPER, not its own copy of the rule. This stamped `lost_date` inline,
      // which made it the SECOND implementation of "a booking reaching Lost must be dated" — the
      // exact drift the helper exists to end, found by sweeping every door against every rule
      // rather than one defect at a time.
      const f = this._applyStageFacts(this.bookings().find(x => x.id === id), 'Lost',
        { stage: 'Lost', lost_reason: reason });
      if (outcome) {
        f.deposit_outcome = outcome;
        // Already refunded means the money has left the bank, so it is in the opening balance
        // already and must NOT also be projected out — the mirror of balance_paid_date on the way in.
        if (outcome === 'refunded') f.deposit_refund_date = App.todayLocal();
      }
      await this.patch(id, f);
    };
    document.getElementById('eb-lost-save')?.addEventListener('click', () => done(''));
    document.getElementById('eb-lost-kept')?.addEventListener('click', () => done('kept'));
    document.getElementById('eb-lost-refunded')?.addEventListener('click', () => done('refunded'));
    document.getElementById('eb-lost-torefund')?.addEventListener('click', () => done('to_refund'));
  },

  // ── Send Quote by email (the vendor-order mailto pattern) ────────────────
  buildQuoteMailto(b) {
    const barName = (App.data && App.data.settings && App.data.settings.bar_name) || 'our team';
    const to = b.contact_email || '';
    const subj = 'Quote from ' + barName + (b.event_name ? ' - ' + b.event_name : '');
    const L = [];
    L.push('Hi' + (b.contact_name ? ' ' + b.contact_name : '') + ',');
    L.push('');
    L.push('Thanks for thinking of us. Here is your quote' + (b.event_type ? ' for your ' + b.event_type.toLowerCase() : '') + ':');
    L.push('');
    if (b.event_date)  L.push('Date: ' + this.fmtDate(b.event_date) + (b.event_time ? ' at ' + b.event_time : ''));
    const p = this.quoteParts(b);
    // The BILLED count, not the estimate — see _countLabel. This line and the subtotal below have
    // to multiply out, or the client's own arithmetic contradicts the document.
    if (p.party)       L.push('Party size: ' + this._countLabel(p, true));
    if (b.space)       L.push('Space: ' + b.space);
    if (p.ph)          L.push('Per head: ' + App.fmtCurrency(p.ph) + (p.party ? ' x ' + p.party + ' guests' : ''));
    if (b.fb_minimum)  L.push('Food and beverage minimum: ' + App.fmtCurrency(b.fb_minimum));
    L.push('Food and beverage subtotal: ' + App.fmtCurrency(p.subtotal));
    if (p.svcPct) L.push('Service charge (' + p.svcPct + '%): ' + App.fmtCurrency(p.service));
    if (p.taxPct) L.push('Tax (' + p.taxPct + '%): ' + App.fmtCurrency(p.tax));
    if (p.roomFee) L.push('Room fee: ' + App.fmtCurrency(p.roomFee));
    L.push('Quoted total: ' + App.fmtCurrency(p.total));
    if (b.deposit_amount) L.push('Deposit to confirm: ' + App.fmtCurrency(b.deposit_amount));
    L.push('');
    L.push('Let me know and we will get you on the calendar.');
    L.push('');
    L.push(barName);
    return 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(L.join('\n'));
  },

  async sendQuote(id, resend) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    if (!b.contact_email) {
      /* ⚠⚠ THE TWIN OF `changeStage`'s BLANK-DATE REFUSAL, AND IT HAD THE SAME HOLE. `collectQuote`
         was not called until after this `return`, so a per-head talked down and typed into the quote
         card was thrown away by the Edit Details re-render — measured $10,965.38 stored against
         $9,811.13 on screen, a $1,154.25 gap, and the next Email Quote sends the client the old
         price. Only the SEND is refused; the numbers they typed are theirs. */
      if ((await this._saveOpen(id)) === 'invalid') return;   // a failed WRITE still opens the prompt
      const go = await App.confirm({ title: 'Add an email first', message: 'A quote goes out by email. Add the customer email on the booking, then send it.', confirmText: 'Edit Details', cancelText: 'Cancel' });
      if (go) this.showForm(id);
      return;
    }
    const fields = this.collectQuote();
    // The one door that puts the number in front of the client fastest gets the same floor.
    if (!this._stepErr(this._rejectReason(fields))) return;
    // The quote is about to be in a client's inbox. collectQuote only stamps the rates when the
    // quote panel is on screen (every field is guarded by `if (g(...))`), so sending from anywhere
    // else left the booking floating on the live tax setting.
    this._freezeRates(b, fields);
    if (!resend) fields.stage = 'Quote Sent';
    /* ⚠⚠ DO NOT EMAIL A CLIENT A NUMBER THAT DID NOT SAVE. The verdict was discarded here, and my
       own patch fix made that WORSE rather than better: the old patch mutated the array before
       awaiting, so a refused write still left the new figures in memory and the email at least
       matched the screen. The fixed patch reverts properly — so this read returned the OLD record
       and the client was emailed the OLD price. Measured: re-priced to $9,811.13 on screen, refused
       write, and the email said "Quoted total: $7,695.00" — $2,116.13 under-quoted, on the document
       the client holds you to. ([[the-loop]] step 0.6: when a fix changes a RETURN VALUE, read every
       caller that consumed the old behaviour.) */
    if (!(await this.patch(id, fields))) return;
    const updated = this.bookings().find(x => x.id === id) || b;
    window.location.href = this.buildQuoteMailto(updated);
  },

  // In-place catering calculator (no navigating away): price a per-head number to
  // hit a target food cost, then apply it straight to the quote.
  quoteCalc(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    const wage = (S.EventsPricing && S.EventsPricing.defaultWage) ? S.EventsPricing.defaultWage() : 13;
    const tgt = (App.MENU_TARGET_COST_PCT && App.MENU_TARGET_COST_PCT.catering) || 28;
    const fld = (lbl, fid, val, pre, suf) =>
      '<div class="f"><label>' + lbl + '</label><div class="fw">' + (pre ? '<span class="pre">' + pre + '</span>' : '')
      + '<input class="form-input' + (pre ? ' pre' : suf ? ' suf' : '') + '" type="number" id="' + fid + '" value="' + (val != null ? val : '') + '" step="0.01"/>' + (suf ? '<span class="suf">' + suf + '</span>' : '') + '</div></div>';
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Catering Calculator</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + fld('Guest Count', 'qc-guests', b.party_size || '')
        + fld('Food Cost / Head', 'qc-food', '', '$')
        + fld('Bar Cost / Head', 'qc-bar', '', '$')
        + fld('Staff Hours', 'qc-hrs', '')
        + fld('Avg Staff Wage', 'qc-wage', wage, '$')
        + fld('Other Costs', 'qc-other', '', '$')
        + fld('Target Food Cost %', 'qc-tgt', tgt, null, '%')
      + '</div>'
      + '<div id="qc-result" style="margin-top:14px;"></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="qc-apply">Apply to Quote</button></div></div>';
    App.openModal(html, { id: 'eb-calc-modal', maxWidth: 540, noClose: true });
    const recompute = () => {
      const g = x => parseFloat(document.getElementById(x)?.value) || 0;
      const guests = g('qc-guests'), el = document.getElementById('qc-result');
      if (!el) return null;
      if (!guests) { el.innerHTML = ''; return null; }
      const foodPH = g('qc-food'), barPH = g('qc-bar');
      const totalCost = (foodPH + barPH) * guests + g('qc-hrs') * (g('qc-wage') || 13) + g('qc-other');
      const t = g('qc-tgt') || 28;
      const perHeadCost = totalCost / guests;
      // Price off the food cost to hit the target food cost %; the margin below
      // shows whether that price also covers bar, labor, and other.
      const perHeadPrice = (foodPH > 0 && t > 0) ? foodPH / (t / 100) : 0;
      const totalRev = perHeadPrice * guests;
      const item = (label, val, gold) => '<div style="min-width:0;"><div style="font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap;color:' + (gold ? 'var(--gold)' : 'var(--t3)') + ';">' + label + '</div><div style="font-size:14px;font-weight:700;color:' + (gold ? 'var(--gold)' : 'var(--t1)') + ';">' + val + '</div></div>';
      el.innerHTML = '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:12px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between;">'
        + item('Total Cost', App.fmtCurrency(totalCost))
        + item('Cost / Head', App.fmtCurrency(perHeadCost))
        + item('Suggested / Head', App.fmtCurrency(perHeadPrice), true)
        + item('Event Revenue', App.fmtCurrency(totalRev))
        + item('Gross Margin', App.fmtBal(totalRev - totalCost))
        + '</div>';
      return { perHeadPrice, totalRev };
    };
    ['qc-guests', 'qc-food', 'qc-bar', 'qc-hrs', 'qc-wage', 'qc-other', 'qc-tgt'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', recompute));
    recompute();
    document.getElementById('qc-apply')?.addEventListener('click', () => {
      const r = recompute();
      App.closeModal('eb-calc-modal');
      if (!r || !r.perHeadPrice) return;
      /* ⚠ NO `_rejectReason` HERE ON PURPOSE, and the reasoning lives in the source so the next
         sweep does not re-raise it ([[the-loop]] #29). This is the one money door without the floor,
         because it CANNOT emit a negative: `perHeadPrice` is gated on `foodPH > 0 && t > 0` above,
         so it is 0 or positive, and `if (!r || !r.perHeadPrice) return;` drops the 0. Verified by
         running the arithmetic with a negative food cost and a negative target; both give 0. */
      const ph = Math.round(r.perHeadPrice * 100) / 100;
      const cur = this.bookings().find(x => x.id === id) || {};
      this.patch(id, { per_head: ph, quoted_total: Math.round(this.quoteParts(Object.assign({}, cur, { per_head: ph })).total) });
    });
  },

  // ── Edit Details (popup; uses the shared field set) ──────────────────────
  showForm(id) {
    const b = id ? this.bookings().find(x => x.id === id) : null;
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (id ? 'Edit Booking' : 'New Booking') + '</div>'
      + this.fieldsHtml(b, 'ebf')
      + '<div class="card-actions"><button class="btn btn-primary" id="ebf-save">' + (id ? 'Save Booking' : 'Create Booking') + '</button>'
      +   '<span id="ebf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';
    App.openModal(html, { id: 'eb-form', maxWidth: 540, confirmDirty: true });
    document.getElementById('ebf-save')?.addEventListener('click', () => this.saveForm(id));
  },

  async saveForm(id) {
    const fields = this.collect('ebf');
    const err = document.getElementById('ebf-err');
    const say = m => { if (err) { err.textContent = m; err.style.display = m ? 'inline' : 'none'; } };
    say('');
    if (!fields.event_name && !fields.contact_name) { say('Enter an event name or a contact name.'); return; }
    // The same floor every other booking door uses — this one wrote party_size straight through.
    const badFields = this._rejectReason(fields);
    if (badFields) { say(badFields); return; }
    const existing = id ? this.bookings().find(x => x.id === id) : null;
    /* ⚠⚠ EDIT DETAILS IS A STAGE DOOR TOO, AND IT BYPASSED BOTH NEW GUARDS. `_freezeRates`' own
       comment names this popup's Stage dropdown as a door that carried no rate snapshot — and then
       the fix went to changeStage and sendQuote only, so a Lead driven straight to Booked here was
       saved with no snapshot and no date check: it re-priced by $144.00 when the operator later
       corrected their tax setting, and it could reach Booked with a blank date, the state where
       "Deposits Due" bills an event nothing else can see. ([[the-loop]] #53 — a comment naming a
       defect reads as handled to every later reader, including me.) */
    const st = fields.stage || (existing && existing.stage);
    if (st === 'Booked' && !String(fields.event_date || (existing && existing.event_date) || '').trim()) {
      say('A booked event needs a date, or it will not reach your calendar or your cash forecast.');
      return;
    }
    if (st === 'Quote Sent' || st === 'Booked' || st === 'Completed') this._freezeRates(existing, fields);
    // The Stage dropdown is a stage door too — same cancellation rules as the buttons (see the
    // helper). It moves a booking out of Lost and into it just as freely and had neither.
    if (st) this._applyStageFacts(existing, st, fields);
    const rec = Object.assign({}, existing || {}, fields, { id: id || App.uid(), updated_at: new Date().toISOString() });
    if (!id) rec.created_at = new Date().toISOString();
    const ok = await App.putRecord('core', 'booking', rec);
    if (!ok) { say('Could not save this booking. Check your access and try again.'); return; }
    App.closeModal('eb-form');
    if (this._detailId) this.renderDetail(rec.id);
    else if (!id) this.openDetail(rec.id);
    else this.renderList();
  },

  // ── Quote PDF ────────────────────────────────────────────────────────────
  quotePDF(b) {
    if (!b) return;
    const money = n => App.fmtCurrency(n);
    const lines = [];
    lines.push(['Event', this.title(b)]);
    if (b.event_type)  lines.push(['Type', b.event_type]);
    if (b.event_date)  lines.push(['Date', this.fmtDate(b.event_date) + (b.event_time ? ' ' + b.event_time : '')]);
    const qp = this.quoteParts(b);
    // The BILLED count, not the estimate (see _countLabel) — Per Head x this must equal the subtotal.
    if (qp.party)      lines.push(['Party Size', this._countLabel(qp, true)]);
    if (b.space)       lines.push(['Space', b.space]);
    if (qp.ph)         lines.push(['Per Head', money(qp.ph) + (qp.party ? ' x ' + qp.party + ' guests' : '')]);
    if (b.fb_minimum)  lines.push(['Food & Beverage Minimum', money(b.fb_minimum)]);
    lines.push(['F&B Subtotal', money(qp.subtotal)]);
    if (qp.svcPct) lines.push(['Service Charge (' + qp.svcPct + '%)', money(qp.service)]);
    if (qp.taxPct) lines.push(['Tax (' + qp.taxPct + '%)', money(qp.tax)]);
    if (qp.roomFee) lines.push(['Room Fee', money(qp.roomFee)]);
    lines.push(['Quoted Total', money(qp.total)]);
    if (b.deposit_amount) lines.push(['Deposit to Confirm', money(b.deposit_amount)]);
    const rowsHtml = lines.map(([k, v]) => '<tr><td style="color:var(--t3);">' + esc(k) + '</td><td style="text-align:right;font-weight:600;">' + esc(v) + '</td></tr>').join('');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:640px;background:var(--surface);padding:24px;';
    wrap.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title" style="margin-bottom:10px;">Event Quote</div>'
      + '<div class="pdf-para">Prepared ' + this.fmtDate(App.todayLocal()) + (b.contact_name ? ' for ' + esc(b.contact_name) : '') + '</div>'
      + '<table class="tbl"><tbody>' + rowsHtml + '</tbody></table>'
      + '<div class="pdf-fine">This quote is an estimate based on current package pricing and the details provided. Final pricing is confirmed on a signed event agreement and may adjust with final guest count and selections.</div>'
      + '</div></div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Event Quote - ' + this.title(b), root: wrap })).finally(() => wrap.remove());
  },

  // ── Run Sheet (the operational doc the kitchen and floor run the event off) ─
  runSheetFields(b) {
    const ta = (lbl, id, val, ph, rows) => '<div class="f" style="width:100%;margin-top:14px;"><label>' + lbl + '</label><textarea id="' + id + '" class="notes-ta" rows="' + (rows || 2) + '" placeholder="' + ph + '">' + esc(val || '') + '</textarea></div>';
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;"><label>Guaranteed Count</label><input type="number" id="rs-gcount" value="' + (b.guaranteed_count != null && b.guaranteed_count !== '' ? b.guaranteed_count : '') + '" placeholder="' + (b.party_size || '') + '"/></div>'
        + '<div class="f" style="width:160px;"><label>Final Count Due</label><input type="date" id="rs-cdue" value="' + esc(b.count_due_date || '') + '"/></div>'
        + '<div class="f" style="flex:1 1 160px;"><label>Day-of Contact</label><input type="text" id="rs-dcname" value="' + esc(b.day_contact_name || '') + '" placeholder="Who runs point on site"/></div>'
        + '<div class="f" style="width:150px;"><label>Their Phone</label><input type="tel" id="rs-dcphone" value="' + esc(b.day_contact_phone || '') + '" placeholder="Optional"/></div>'
      + '</div>'
      + ta('Timeline', 'rs-timeline', b.timeline, 'Load-in 5:00, doors 6:30, dinner 7:00, last call 9:30, out by 10:30.', 3)
      + ta('Food / Menu', 'rs-menu', b.menu_notes, 'Courses, passed apps, buffet, the cake. What the kitchen makes.', 3)
      + ta('Bar / Beverage', 'rs-bev', b.bev_notes, 'Open bar, cash bar, drink tickets, wine on the tables, a toast.', 2)
      + ta('Allergies and Dietary', 'rs-allergy', b.allergies, 'Nut allergy at table 3, two vegan, one gluten free.', 2)
      + ta('Setup / Layout', 'rs-setup', b.setup_notes, 'Tables, head table, dance floor, linens, signage.', 2)
      + ta('AV / Music / Rentals', 'rs-av', b.av_notes, 'Mic, projector, the playlist, rented chairs, who delivers.', 2);
  },

  collectRunSheet() {
    const g = id => document.getElementById(id);
    return {
      guaranteed_count:  g('rs-gcount') ? (parseInt(g('rs-gcount').value) || null) : null,
      count_due_date:    g('rs-cdue')?.value || '',
      day_contact_name:  g('rs-dcname')?.value.trim() || '',
      day_contact_phone: g('rs-dcphone')?.value.trim() || '',
      timeline:          g('rs-timeline')?.value.trim() || '',
      menu_notes:        g('rs-menu')?.value.trim() || '',
      bev_notes:         g('rs-bev')?.value.trim() || '',
      allergies:         g('rs-allergy')?.value.trim() || '',
      setup_notes:       g('rs-setup')?.value.trim() || '',
      av_notes:          g('rs-av')?.value.trim() || ''
    };
  },

  runSheetReadout(b) {
    const filled = [b.timeline, b.menu_notes, b.bev_notes, b.setup_notes, b.av_notes].filter(s => s && String(s).trim()).length;
    const gc = b.guaranteed_count ? b.guaranteed_count + ' guaranteed' : (b.party_size ? b.party_size + ' estimated' : 'no count set');
    const due = b.count_due_date ? 'count due ' + this.fmtDate(b.count_due_date) : '';
    const allergy = (b.allergies && String(b.allergies).trim()) ? '<span style="color:var(--amber);font-weight:600;">allergies noted</span>' : '';
    const prog = filled ? filled + ' of 5 sections filled' : 'not started';
    return '<div style="font-size:12px;color:var(--t2);line-height:1.8;">' + [gc, due, allergy, prog].filter(Boolean).join(' &middot; ') + '</div>';
  },

  runSheet(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    const sub = [b.event_date ? this.fmtDate(b.event_date) : '', esc(b.event_time || ''), esc(b.space || ''), b.party_size ? b.party_size + ' guests' : ''].filter(Boolean).join('  &middot;  ');
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Run Sheet</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(this.title(b)) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin:2px 0 14px;">' + sub + '</div>'
      + this.runSheetFields(b)
      + '<div id="rs-err" style="display:none;margin-top:10px;font-size:12px;color:var(--red);"></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="rs-save">Save Run Sheet</button><button class="btn btn-ghost" id="rs-print">Export Run Sheet</button></div></div>';
    App.openModal(html, { id: 'eb-runsheet-modal', maxWidth: 540, noClose: true });
    /* ⚠⚠ THIS DOOR PRICES THE EVENT. `guaranteed_count` is collected here and round 1 taught
       quoteParts to BILL it — so the Run Sheet quietly became a money door and kept a form's worth
       of free text's worth of validation, which is none. Measured: a fat-fingered -75 took the
       Quoted Total from $9,811.13 to $0.00 and printed "F&B Subtotal (-75 guaranteed)" on the
       client's quote; with an F&B minimum set it billed the minimum instead, a $2,116.13 shortfall
       that looks perfectly ordinary. Both buttons here save, so both are gated. */
    const rsSay = m => { const e = document.getElementById('rs-err'); if (e) { e.textContent = m; e.style.display = m ? 'block' : 'none'; } };
    const rsCollect = () => { const f = this.collectRunSheet(); const bad = this._rejectReason(f); rsSay(bad); return bad ? null : f; };
    /* ⚠⚠ AND THE WRITE VERDICT IS CHECKED AT BOTH. This is the largest form in the file — six
       textareas plus the counts and the day-of contact — and Save CLOSED THE MODAL on a refused
       write, so the operator got a red toast and an empty run sheet when they reopened it. Export
       was worse: it printed the OLD sheet, so the kitchen preps the stored guarantee (90) while the
       modal above it shows the typed one (75). Both now keep the modal open and say why, which is
       what `addBooking` and `saveForm` already do. */
    document.getElementById('rs-save')?.addEventListener('click', async () => {
      const f = rsCollect(); if (!f) return;
      if (!(await this.patch(id, f))) { rsSay('Could not save this run sheet. Check your access and try again.'); return; }
      App.closeModal('eb-runsheet-modal');
    });
    document.getElementById('rs-print')?.addEventListener('click', async () => {
      const f = rsCollect(); if (!f) return;
      if (!(await this.patch(id, f))) { rsSay('Could not save this run sheet, so it was not printed. Check your access and try again.'); return; }
      this.printRunSheet(this.bookings().find(x => x.id === id));
    });
  },

  printRunSheet(b) {
    if (!b) return;
    const dayc = [b.day_contact_name || '', b.day_contact_phone || ''].filter(Boolean).join(' · ');
    const det = [];
    if (b.event_type) det.push(['Type', b.event_type]);
    if (b.event_date) det.push(['Date', this.fmtDate(b.event_date) + (b.event_time ? ' ' + b.event_time : '')]);
    if (b.space) det.push(['Space', b.space]);
    det.push(['Headcount', b.guaranteed_count ? b.guaranteed_count + ' guaranteed' : (b.party_size ? b.party_size + ' estimated' : '-')]);
    if (b.count_due_date) det.push(['Final Count Due', this.fmtDate(b.count_due_date)]);
    if (dayc) det.push(['Day-of Contact', dayc]);
    const detTbl = '<table class="tbl"><tbody>' + det.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>';
    const sec = (lbl, val) => (val && String(val).trim()) ? '<div class="sh">' + lbl + '</div><div class="pdf-para">' + esc(val) + '</div>' : '';
    const staff = this.eventStaffByPerson(b);
    const staffTbl = staff.length ? '<div class="sh">Event Staff</div><table class="tbl"><tbody>' + staff.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + p.hours.toFixed(1) + 'h</td></tr>').join('') + '</tbody></table>' : '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:680px;';
    wrap.innerHTML = '<div class="screen">'
      + '<div class="card-title">Event Run Sheet</div>'
      + detTbl
      + sec('Timeline', b.timeline)
      + sec('Food / Menu', b.menu_notes)
      + sec('Bar / Beverage', b.bev_notes)
      + sec('Allergies and Dietary', b.allergies)
      + sec('Setup / Layout', b.setup_notes)
      + sec('AV / Music / Rentals', b.av_notes)
      + sec('Notes', b.requests)
      + staffTbl
      + '</div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Run Sheet - ' + this.title(b), root: wrap })).finally(() => wrap.remove());
  },

  // ── Event Agreement (the terms worksheet the client signs to lock the date) ─
  DEFAULT_AGREEMENT_TERMS:
      'Deposit: The deposit shown above is due to confirm this booking and is non-refundable. Your date and space are not held until the deposit is received.\n\n'
    + 'Final balance: The remaining balance is due on or before the event date.\n\n'
    + 'Final guest count: A final guaranteed count is due several days before the event. You are billed for the guaranteed count or the actual count, whichever is higher.\n\n'
    + 'Cancellation: Cancellations made well ahead of the date may refund any payment beyond the deposit. Closer to the date, payments are non-refundable.\n\n'
    + 'Service charge and tax: A service charge and applicable sales tax are added to the food and beverage total, as shown above.\n\n'
    + 'Damage and overages: You are responsible for any damage to the space and for charges beyond what is quoted, billed after the event.',
  agreementTerms() {
    // Account-scoped only. The old code migrated a BARE `event_agreement_terms` localStorage
    // key onto the current account — but that key predates account scoping, so on a multi-bar
    // device it could carry Bar A's leftover terms into Bar B (a cross-bar leak). Terms live
    // in account_state now; a legacy bare value (pre-launch, dev device only) is simply ignored.
    const v = App.acctGet('event_agreement_terms');
    return (v != null && v !== '') ? v : this.DEFAULT_AGREEMENT_TERMS;
  },

  agreementModal(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    const p = this.quoteParts(b);
    const money = [['Quoted Total', App.fmtCurrency(p.total)]];
    if (b.deposit_amount) money.push(['Deposit to Confirm', App.fmtCurrency(b.deposit_amount)]);
    money.push(['Balance Due', App.fmtCurrency(this.balanceDue(b))]);
    const moneyHtml = money.map(r => '<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;padding:3px 0;"><span style="color:var(--t3);">' + r[0] + '</span><span style="color:var(--t1);font-weight:600;">' + r[1] + '</span></div>').join('');
    const sub = [b.event_date ? this.fmtDate(b.event_date) : '', esc(b.event_time || ''), esc(b.space || ''), b.party_size ? b.party_size + ' guests' : ''].filter(Boolean).join('  &middot;  ');
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Event Agreement</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(this.title(b)) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin:2px 0 12px;">' + sub + '</div>'
      + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;margin-bottom:14px;">' + moneyHtml + '</div>'
      + '<div class="f" style="width:100%;"><label>Terms</label><textarea id="ag-terms" class="notes-ta" rows="10">' + esc(this.agreementTerms()) + '</textarea></div>'
      + '<div style="font-size:11px;color:var(--t4);line-height:1.6;margin-top:8px;">These terms are a starting point. Set them to your own policy and have your attorney review the agreement before you rely on it. Bar Cop is a software tool, not legal advice.</div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ag-print">Save and Print</button></div></div>';
    App.openModal(html, { id: 'eb-agreement-modal', maxWidth: 680, noClose: true });
    document.getElementById('ag-print')?.addEventListener('click', () => {
      const terms = document.getElementById('ag-terms')?.value || '';
      App.acctSet('event_agreement_terms', terms);
      App.closeModal('eb-agreement-modal');
      this.printAgreement(b, terms);
    });
  },

  printAgreement(b, terms) {
    if (!b) return;
    const barName = (App.data && App.data.settings && App.data.settings.bar_name) || 'Our Venue';
    const p = this.quoteParts(b);
    const money = n => App.fmtCurrency(n);
    const lines = [['Event', this.title(b)]];
    if (b.event_type) lines.push(['Type', b.event_type]);
    if (b.event_date) lines.push(['Date', this.fmtDate(b.event_date) + (b.event_time ? ' ' + b.event_time : '')]);
    if (b.space) lines.push(['Space', b.space]);
    // The count the F&B subtotal was BILLED on. The agreement's own terms promise "billed for the
    // guaranteed count or the actual count, whichever is higher" — printing the superseded estimate
    // next to a guarantee-billed subtotal contradicted the paragraph below it on the same page.
    if (p.party) lines.push(['Guest Count', this._countLabel(p, true)]);
    /* ⚠ S244 — THE SIGNED DOCUMENT HAS TO SHOW ITS OWN WORKING. Kyle, reading a real agreement:
       the page printed "52 guests (guaranteed)" and "F&B Subtotal $3,224.00" with nothing between
       them, while the terms two paragraphs down say the client is billed on that count. So they
       cannot check the figure, and cannot work out what a change in the count costs them — on the
       one document that governs the deal. The quote PDF had this line the whole time; the agreement
       did not ([[the-loop]] step 0.6 — the artefact that leaves the building is the one that counts). */
    if (p.ph) lines.push(['Per Head', money(p.ph) + (p.party ? ' x ' + p.party + ' guests' : '')]);
    /* ⛔ AND THE MINIMUM, OR THE PER HEAD ROW I JUST ADDED MAKES THE PAGE FAIL ITS OWN ARITHMETIC.
       The subtotal is the GREATER of per-head x count and the F&B minimum. Print the per-head line
       without the minimum beside it and a client checking the page sees 85 x 40 = $3,400 above an
       F&B Subtotal of $5,000.00 — **$1,600 unexplained on a signature page**, which is the identical
       shape to the room-fee omission documented below. Both siblings that print Per Head (the quote
       PDF and the emailed quote) print the minimum too; only this document did not. */
    if (p.fbMin) lines.push(['Food & Beverage Minimum', money(p.fbMin)]);
    lines.push(['F&B Subtotal', money(p.subtotal)]);
    if (p.svcPct) lines.push(['Service Charge (' + p.svcPct + '%)', money(p.service)]);
    if (p.taxPct) lines.push(['Tax (' + p.taxPct + '%)', money(p.tax)]);
    // The room fee is in quoteParts' total, so leaving its line off made the client's
    // SIGNED agreement itemize to less than the total it asks them to pay. The on-screen
    // quote and the quote PDF both print it; this document was the one that did not, and
    // an unexplained gap on a signature page is exactly what gets disputed.
    if (p.roomFee) lines.push(['Room Fee', money(p.roomFee)]);
    lines.push(['Quoted Total', money(p.total)]);
    if (b.deposit_amount) lines.push(['Deposit to Confirm', money(b.deposit_amount)]);
    lines.push(['Balance Due', money(this.balanceDue(b))]);
    const tbl = '<table class="tbl"><tbody>' + lines.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>';
    const termsHtml = String(terms || this.agreementTerms()).split(/\n\s*\n/).filter(s => s.trim()).map(s => '<div class="pdf-para">' + esc(s.trim()) + '</div>').join('');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:680px;';
    wrap.innerHTML = '<div class="screen">'
      + '<div class="card-title" style="margin-bottom:10px;">Event Agreement</div>'
      + '<div class="pdf-para">Between ' + esc(barName) + ' and ' + esc(b.contact_name || 'the client') + ', prepared ' + this.fmtDate(App.todayLocal()) + '.</div>'
      + tbl
      + '<div class="sh">Terms</div>'
      + termsHtml
      + '<div class="sh">Signatures</div>'
      + '<div class="pdf-para">Client signature: ______________________________     Date: ________________</div>'
      + '<div class="pdf-para">' + esc(barName) + ' signature: ______________________     Date: ________________</div>'
      + '</div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Event Agreement - ' + this.title(b), root: wrap, brand: barName, footer: '' })).finally(() => wrap.remove());
  },

  worksheet() {
    App.printBlankSheet({
      title: 'Booking Inquiry Pad',
      subtitle: 'Capture event and catering inquiries as the phone rings. Enter into Bar Cop after the day.',
      columns: [
        { label: 'Date',        width: '10%' },
        { label: 'Contact',     width: '16%' },
        { label: 'Phone/Email', width: '16%' },
        { label: 'Event Type',  width: '12%' },
        { label: 'Event Date',  width: '11%' },
        { label: 'Party',       width: '8%'  },
        { label: 'Notes / Follow-up' }
      ],
      rows: 14
    });
  },

  showHowTo() {
    App.showHelpModal('How Event Booking Works', [
      { p: ['One record per party, worked from the first call to the paid invoice. Read the stat strip up top for what is open, stale, booked soon, and the deposits you are owed. Log a lead in the New Booking form on the page, or open any row to work it. Worksheet prints a blank inquiry pad to capture calls by the phone.'] },
      { h: 'The Active Booking', p: ['Open a booking and the page follows its stage. The header carries the stage, the progress rail carries the lifecycle, the tiles carry the numbers for this stage, and one big button moves it forward. Tap any reached step on the rail to jump back and edit it, then Back to where you left off.'] },
      { h: 'The Stages', p: ['A booking moves Lead, Quote Sent, Booked, Completed. Mark Lost any time before it completes; it stays in the pipeline and you can reopen it.'] },
      { h: 'Quote and Send', p: ['On a Lead, tap a Rate Card package to prefill the price, or open the Catering Calculator to price per head against a target food cost right on the booking. Set the per head and guest count, the F&B minimum if you hold one, and your service charge and tax. Bar Cop builds the quote underneath: F&B subtotal, then service charge and tax on top, to the quoted total. Then Send Quote. Capture the customer email on the booking first; Send Quote opens a ready-to-send email with the full breakdown in it, the same way you email a vendor order, and marks the booking Quote Sent. Quote PDF prints a clean copy to attach or hand over.'] },
      { h: 'Deposit and Balance', p: ['Once a booking is Booked, log the deposit you took and mark it paid. The balance is the quoted total minus the deposit; mark it paid when the money lands. Deposits still owed roll up on the pipeline and the dashboard, and booked balances feed your Cash Forecast as money coming in.'] },
      { h: 'Agreement', p: ['Agreement, on the booking header, builds an event agreement from the booking: the event details, the money, your terms, and signature lines for you and the client. The terms start from a sensible template you edit once to your own policy, and Bar Cop remembers them for the next event. Save and Print gives you a clean copy to send for signature. It is a worksheet, not a contract; have your attorney review it.'] },
      { h: 'Staffing', p: ['Schedule Staff for this Event jumps to Build Schedule on the event date, which is marked with an EVENT tag. Open each person working the event and check "Working [event name]" so only their hours land on the Event P&L, not the whole day\'s crew.'] },
      { h: 'Run Sheet', p: ['Run Sheet is what the kitchen and floor work the event off: the timeline, the food and bar, allergies and dietary, the room setup, AV and rentals, the guaranteed headcount and when the final count is due, and who runs point on site. Open it from the booking header or the Booked stage, fill it in, and Print Run Sheet to hand the team a clean copy.'] },
      { h: 'Event P&L', p: ['On a Completed booking, enter the actual revenue and the food, bar, and other cost. Actual revenue is what the event earned BEFORE sales tax, the same basis as your bar and food sales, because the tax you collect is the state\'s money and not yours. The service charge and any room fee are yours, so they count. Bar Cop shows you the figure off your own quote so you do not have to work it out. Labor pulls automatically from the staff you checked for the event in Build Schedule, using their logged hours on the event date. The margin is the event\'s bottom line.'] },
      { h: 'Getting Back', p: ['The back arrow at the bottom right returns you to the pipeline from any booking.'] }
    ]);
  }
};
