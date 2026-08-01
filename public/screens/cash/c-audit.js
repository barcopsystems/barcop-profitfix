'use strict';

/* ── Cash Recovery — Cash Audit ───────────────────────────────────────────────
   The weekly read on cash health, scored on the four disciplines that decide
   whether a profitable bar runs flush or tight: Capital Efficiency (how hard the
   cash on the shelf works), the Cash Conversion Cycle (how many days your money
   is locked), Liquidity and Runway (whether the weeks ahead hold), and Payment
   Terms (whether you keep your float instead of paying early). It scores CLIENT
   side off CashEngine, because all the cash math lives there and a second copy on
   the server would be a place for the numbers to drift. The opportunity hero is
   "Cash to Free", a one-time amount, so it does NOT use the shared monthly-times-
   twelve strip, which would misstate it. Reads CashEngine; stores in cash_audits. */

S.CashAudit = {
  SECTION_NAMES: ['Capital Efficiency', 'Cash Conversion Cycle', 'Liquidity & Runway', 'Payment Terms'],

  audits() { return (App.data.cash_audits || []).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)); },

  /* CA-<year>-<4 digits>, matching PFA/RFA, and never one that is already on file. The server
     pair draw blind because they cannot see the account's history; this runs in the browser
     with the whole list in hand, so it costs nothing to check. Bounded retries, then a
     timestamp tail, because an unbounded loop on a full keyspace is worse than a long id. */
  _newAuditId() {
    const yr = new Date().getFullYear();
    const taken = new Set(this.audits().map(a => a && a.audit_id).filter(Boolean));
    for (let i = 0; i < 50; i++) {
      const id = 'CA-' + yr + '-' + String(Math.floor(Math.random() * 9000) + 1000);
      if (!taken.has(id)) return id;
    }
    return 'CA-' + yr + '-' + String(Date.now()).slice(-6);
  },

  fmtWk(ws) { const d = new Date(ws + 'T00:00:00'); return isNaN(d.getTime()) ? ws : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },

  // Balances below (Safe to Spend, the low point, cash kept) go through App.fmtBal:
  // several of those lines fire ONLY when the value is under zero, so raw fmtCurrency
  // printed "$-2,340.00" every time, lender PDF included. Amounts that cannot go
  // negative (trapped cash, dead stock, locked cash) stay on plain `cur`.
  runwayLabel(r) { return r == null ? '13+ wks' : r === 0 ? 'This week' : r + ' wk' + (r === 1 ? '' : 's'); },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    this.actions.innerHTML = '';
    const audits = this.audits();
    const latest = audits[0] || null;
    const desc = 'Bar Cop reads your cash health off your own logged data. Run it whenever you want a fresh read.';
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.readinessCard({ pfx: 'ca', title: 'Cash Audit', desc,
          steps: this._readinessSteps(), sectionsReady: this._sectionsReady(), hasLatest: !!latest })
      + (latest ? AuditUI.landingCard(latest, audits[1], this.SECTION_NAMES, 'ca') : '')
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'cash_audit', 'ca', { sectionCount: this.SECTION_NAMES.length }) : '')
      + '</div>';
    AuditUI.wireFirstAudit(this.container);
    document.getElementById('ca-gen-btn')?.addEventListener('click', () => this.onGenerate());
    this.container.querySelectorAll('.ca-view-btn').forEach(btn => btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.renderMain()));
  },

  // The data slices the Cash Audit scores, one per treasury section. Each
  // auto-checks off once Bar Cop has it, or taps through to the step that fills
  // it. Reads the same CashEngine and Control stores the audit scores off.
  _readinessSteps() {
    const hasOpening = !!(window.CashEngine && CashEngine.position && CashEngine.position().hasOpening);
    const counts = ((App.inventoryData && App.inventoryData.ic_counts) || []).length;
    const sales  = ((App.shiftData && App.shiftData.sc_shifts) || []).length;
    const terms  = (window.CashEngine && CashEngine.termVendors) ? CashEngine.termVendors().length : 0;
    return [
      { label: 'Opening cash balance set',   done: hasOpening,   go: 'c-position' },
      { label: 'Two inventory counts taken', done: counts >= 2,  go: 'ic-take-inventory' },
      { label: 'A week of POS sales imported', done: sales >= 1, go: 'sc-dashboard' },
      { label: 'Vendors on payment terms',   done: terms > 0,    go: 'ic-vendors' }
    ];
  },

  onGenerate() { this.generate(); },

  // One boolean per scored treasury section = whether CashEngine can score it now.
  // Drives the projected data badge so it matches what a run would produce.
  _sectionsReady() {
    const E = window.CashEngine;
    if (!E) return [false, false, false, false];
    const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
    return [
      // Tests the SAME denominator the S1 score divides by. Test a different one and
      // readiness promises a section the audit then scores null (see the audit-ui
      // projected-vs-post-run badge, same trap).
      safe(() => E.trapped().hasData && E.onHand().value > 0, false),   // S1 Capital Efficiency
      safe(() => E.cashCycle().hasData, false),                              // S2 Cash Conversion Cycle
      safe(() => E.survivalForecast(13).hasData, false),                     // S3 Liquidity & Runway
      safe(() => E.vendors().length > 0, false)                             // S4 Payment Terms
    ];
  },

  async generate() {
    const btn = document.getElementById('ca-gen-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; btn.style.opacity = '0.7'; }
    const record = this._computeAudit();
    App.dedupeAuditToday(App.data.cash_audits, record);
    await App.putRecord('core', 'cash_audit', record);
    if (App.markSetupDone) App.markSetupDone('gs_c_audit');
    this.renderMain();
    setTimeout(() => this.viewAudit(0), 100);
  },

  // ── Client-side scoring on the four real treasury disciplines, honest by
  //    construction (reads the same CashEngine the cash screens show). Each
  //    section is null when there is no basis for it yet. ──────────────────────
  _computeAudit() {
    const E = CashEngine;
    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

    // S1 Capital Efficiency: the share of shelf cash that is lazy (dead + above
    // par), with the per-category turns/GMROI as the depth behind the number.
    const trapped = E.trapped();
    const cap = E.capitalSummary();
    // S1 is a SHARE of the shelf, so both sides must be the same shelf at the same
    // moment. trapped() reads onHand() (right now), so the denominator does too. It
    // used to divide by avgInventoryValue() (a 4-count average), which made the score
    // swing on the inventory TREND instead of on laziness: one bar, 50% of the shelf
    // dead or over par at every count, scored 0 while building stock and 65 while
    // drawing it down. Same bar, same laziness, 65 points apart. onHand is also what
    // the S1 narrative below already calls "on hand", and trapped <= onHand.value by
    // construction, so the share is always real. Average inventory stays where it
    // belongs: turns and GMROI on c-capital, a different question (how hard the cash
    // works over time), on a deliberately different basis.
    const invValue = E.onHand().value;
    let s1 = null;
    if (trapped.hasData && invValue > 0) s1 = clamp(100 - (trapped.total / invValue) * 130);
    const lazyCats = cap.rows.filter(r => r.gmroi != null && r.gmroi < 1.5).map(r => r.cat);

    // S2 Cash Conversion Cycle: days your cash is locked (product sits minus days
    // you take to pay). Zero or negative is ideal; 25 days is below target.
    const cyc = E.cashCycle();
    let s2 = null;
    if (cyc.hasData) s2 = clamp(100 - Math.max(0, cyc.cycle) * 2);

    // S3 Liquidity & Runway: the 13-week survival picture. Tight weeks (net cash
    // out) is the always-available base; opening cash refines it with runway and
    // a Safe-to-Spend check.
    const sf = E.survivalForecast(13);
    const pos = E.position();
    let s3 = null;
    if (sf.hasData) {
      let v = 100 - sf.tightWeeks * 8;
      if (sf.hasOpening) {
        if (sf.runway != null) v = Math.min(v, sf.runway * 7);
        if (pos.safe < 0) v -= 20;
      }
      s3 = clamp(v);
    }

    // S4 Payment Terms: how much of your buying is on terms, and the float you
    // actually hold (spend-weighted days to pay).
    const tv = E.termVendors();
    const totalV = E.vendors().length;
    const dpo = E._weightedDPO();
    let s4 = null;
    if (totalV > 0) {
      const onTermsPct = tv.length / totalV;
      const dpoScore = Math.min(1, dpo / 30);
      s4 = clamp((onTermsPct * 0.6 + dpoScore * 0.4) * 100);
    }

    const names = this.SECTION_NAMES;
    const sections = {};
    [s1, s2, s3, s4].forEach((v, i) => { if (v != null) sections[names[i]] = v; });
    const vals = [s1, s2, s3, s4].filter(v => v != null);
    const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;

    // The opportunity hero is the de-duplicated trapped total (dead stock + above
    // par per product). The over-order excess is a different framing of the same
    // overstock, so it is NOT added here, which would double count.
    const cashToFree = trapped.total;

    const cur = v => App.fmtCurrency(v);
    const ai = [];
    if (trapped.hasData && trapped.total > 0) ai.push({ s: s1, action: 'Free ' + cur(trapped.total) + ' of lazy shelf cash: ' + cur(trapped.dead) + ' in dead stock, ' + cur(trapped.overPar) + ' above par.', gap_id: 'free-trapped' });
    if (cyc.hasData && cyc.cycle > 7) ai.push({ s: s2, action: 'Your cash is locked about ' + Math.round(cyc.cycle) + ' days. Order to par to free roughly ' + cur(cyc.dailyCogs) + ' for each day you shorten it.', gap_id: 'order-to-par' });
    if (sf.hasData && sf.tightWeeks > 0) ai.push({ s: s3, action: sf.tightWeeks + ' tight week' + (sf.tightWeeks === 1 ? '' : 's') + ' in the next thirteen' + (sf.hasOpening && sf.lowPoint ? ', bottoming out ' + this.fmtWk(sf.lowPoint.ws) + ' at ' + App.fmtBal(sf.lowPoint.balance) : '') + '. Move a payment or hold an order to cover it.', gap_id: 'stay-ahead' });
    if (totalV > 0 && tv.length < totalV) ai.push({ s: s4, action: 'Set payment terms on the ' + (totalV - tv.length) + ' vendor' + ((totalV - tv.length) === 1 ? '' : 's') + ' without them, so you stop paying early.', gap_id: 'pay-on-terms' });
    ai.sort((a, b) => (a.s == null ? 100 : a.s) - (b.s == null ? 100 : b.s));
    const action_items = ai.map(x => ({ action: x.action, gap_id: x.gap_id }));

    const raw = {
      // S1
      TRAPPED_CASH: trapped.total, INVENTORY_VALUE: invValue, DEAD_STOCK: trapped.dead, OVERSTOCK: trapped.overPar,
      BLENDED_TURNS: cap.turns, BLENDED_GMROI: cap.gmroi, LAZY_CATS: lazyCats,
      // S2
      DIO: cyc.hasData ? cyc.dio : null, DPO: cyc.hasData ? cyc.dpo : null, CYCLE_DAYS: cyc.hasData ? cyc.cycle : null,
      LOCKED_CASH: cyc.hasData ? cyc.lockedCash : null, DAILY_COGS: cyc.hasData ? cyc.dailyCogs : null,
      // S3
      // RUNWAY is meaningless without a bank balance: survivalForecast opens at an
      // assumed $0, so the weeks-until-out is counted down from a number the operator
      // never gave us. Its neighbours OPENING_CASH and SAFE_TO_SPEND already gate on
      // hasOpening; this one did not, so the Experiments "Runway (weeks)" metric
      // (initiative-tracker) fired for exactly the bars whose audit reads "flying blind
      // on cash" two lines away.
      TIGHT_WEEKS: sf.hasData ? sf.tightWeeks : null, RUNWAY: sf.hasOpening ? sf.runway : null, HAS_OPENING: sf.hasOpening,
      OPENING_CASH: sf.hasOpening ? sf.opening : null, END_BALANCE: sf.hasData ? sf.end : null,
      LOW_POINT_BAL: (sf.hasData && sf.lowPoint) ? sf.lowPoint.balance : null,
      LOW_POINT_WEEK: (sf.hasData && sf.lowPoint) ? this.fmtWk(sf.lowPoint.ws) : '',
      SAFE_TO_SPEND: pos.hasOpening ? pos.safe : null,
      // S4
      VENDORS_ON_TERMS: tv.length, TOTAL_VENDORS: totalV, WEIGHTED_DPO: dpo,
      // findings — 3-part (NARRATIVE / FINDING / TOOL), reads like Profit and Revenue
      ...this._s1Parts(s1, trapped, invValue, cap, lazyCats),
      ...this._s2Parts(s2, cyc),
      ...this._s3Parts(s3, sf, pos),
      ...this._s4Parts(s4, tv.length, totalV, dpo)
    };

    return {
      id: App.uid(),
      date: App.todayLocal(),
      bar_name: App.data.settings.bar_name,
      overall_score: overall,
      grade: 'Complete Cash Analysis',
      /* ⚠ A PERIOD, NOT A SECOND COPY OF THE DATE. This wrote 'As of <today>', and the view
         prints it as "<date>  |  <audit_period>  |  <id>" — so the header read
         "2026-07-31 | As of 2026-07-31 | CA-14", saying the date twice and the window never.
         Every other audit states its window (Profit and Revenue take AUDIT_PERIOD, "4 weeks
         ending X"; the Bar Cop audit says "Last 30 days"); Cash was the only one of the four
         that did not, and the demo seed papered over it by writing the Revenue-style string.
         ⚠ It must NOT copy "4 weeks ending X": this audit does not read a trailing 4 weeks.
         S1/S2 are a right-now shelf read against the last two counts, S3 is thirteen weeks
         FORWARD, S4 is the vendor list as it stands. That is what the label now says. */
      audit_period: 'Position today, 13 weeks ahead',
      /* ⚠ A COUNT IS NOT AN IDENTIFIER. This was `'CA-' + (this.audits().length + 1)`, which
         printed "CA-14" against the siblings' "PFA-2026-6185" and "RFA-2026-1578" — no year, no
         padding — on a document that gets handed to a lender. Worse, it reuses a value the
         moment any record leaves the list, so two different audits could carry one id.
         Same shape as PFA/RFA now, and because this one is generated client-side we can do what
         the server-side pair cannot: check it against the ids already on file and redraw. */
      audit_id: this._newAuditId(),
      sections, action_items, cash_to_free: cashToFree, raw,
      signals: this._riskSignals(),
      generated_at: new Date().toISOString()
    };
  },

  _lastMonthBounds() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { s: App.ymdLocal(start), e: App.ymdLocal(end) };
  },

  // ── Cash Risk Signals: cross-cutting liquidity risks the four scored sections
  //    do not isolate. Each fires ONLY when its condition is actually true,
  //    computed live off CashEngine, so a flush bar shows few or none. Severity
  //    HIGH/MEDIUM/LOW, with the evidence and the screen that fixes it. ──────────
  _riskSignals() {
    const E = CashEngine;
    const out = [];
    const cur = v => App.fmtCurrency(v);
    const sf = E.survivalForecast(13);
    const pos = E.position();

    if (sf.hasData && sf.hasOpening && sf.runway != null) {
      out.push({
        label: 'Cash crunch ahead', score: 'HIGH',
        evidence: 'Your account runs dry in about ' + (sf.runway === 0 ? 'a week' : sf.runway + ' week' + (sf.runway === 1 ? '' : 's')) + (sf.lowPoint ? ', bottoming out the week of ' + this.fmtWk(sf.lowPoint.ws) + ' at ' + App.fmtBal(sf.lowPoint.balance) : '') + '.',
        gap: 'A profitable bar that runs out of cash still closes its doors. This is the most urgent thing to cover.',
        tool: 'Free trapped cash and move a payment, on the Cash Forecast.'
      });
    }
    if (pos.hasOpening && pos.safe < 0) {
      out.push({
        label: 'Spending money that is not yours', score: 'HIGH',
        evidence: 'Safe to Spend is ' + App.fmtBal(pos.safe) + ', under zero. You are holding ' + cur(pos.setAside.total) + ' in tax and tips owed against a ' + App.fmtBal(pos.opening || 0) + ' balance.',
        gap: 'You are leaning on the sales tax you collected or your reserve. Spending the tax is the classic way a profitable bar cannot pay its tax bill.',
        tool: 'See what is truly free, on Cash Position.'
      });
    }
    const b = this._lastMonthBounds();
    const br = E.bridge(b.s, b.e);
    if (br.hasData) {
      const ownerOut = (br.co.draw || 0) + (br.co.loan || 0);
      if (ownerOut > 0 && ownerOut > Math.max(0, br.cashKept)) {
        out.push({
          label: 'Draws and debt outpacing what you keep', score: br.cashKept < 0 ? 'HIGH' : 'MEDIUM',
          evidence: 'Last month ' + cur(ownerOut) + ' left for owner draws and loan payments while the business kept ' + App.fmtBal(br.cashKept) + '.',
          gap: 'When draws and debt service take most of the cash the operation generates, there is little left to build a cushion. Fine for a month, a problem as a pattern.',
          tool: 'See where the profit went, on the Cash Bridge.'
        });
      }
    }
    if (pos.hasOpening && pos.reserve > 0 && pos.cushion < pos.reserve) {
      out.push({
        label: 'Reserve underfunded', score: 'MEDIUM',
        evidence: 'Your cushion is ' + cur(Math.max(0, pos.cushion)) + ' against a ' + cur(pos.reserve) + ' reserve target, ' + cur(pos.reserve - pos.cushion) + ' short.',
        gap: 'A slow stretch with no sales has no buffer. Free trapped cash to close the gap, then hold a little aside each week.',
        tool: 'Size your reserve, on Cash Position.'
      });
    }
    if (sf.hasData && !sf.hasOpening) {
      out.push({
        label: 'Flying blind on cash', score: 'MEDIUM',
        evidence: 'No opening cash balance is set, so the forecast cannot read a real runway or what is safe to spend.',
        gap: 'You can see whether the weeks ahead run tight on flow, but not how much cushion you actually have.',
        tool: 'Enter your balance, on Cash Position.'
      });
    }
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    out.sort((a, b2) => (rank[a.score] == null ? 3 : rank[a.score]) - (rank[b2.score] == null ? 3 : rank[b2.score]));
    return out;
  },

  // Section 5 in the full view: the signal cards, or a clear state when none fire.
  riskSection(audit) {
    const signals = audit.signals || [];
    if (signals.length) return AuditUI.sectionBlock(5, 'Cash Risk Signals', null, [], signals, null);
    // No signals fired. Two very different reasons: a healthy bar (there was cash
    // data and nothing tripped) reads "Clear"; an audit with no data behind it
    // cannot claim anything is healthy, so it reads "Not enough data" like the
    // scored sections above. Scored-section count is the honest data signal.
    const hasData = Object.keys(audit.sections || {}).length > 0;
    /* ⛔ THE ALL-CLEAR MAY ONLY NAME WHAT WAS ACTUALLY LOOKED AT. This sentence enumerated four
       things — "Your runway, what is safe to spend, your draws, and your reserve are all in a
       healthy range" — off nothing but "some section scored". Three of the four risk signals
       are gated on the liquidity read (`sf.hasData && sf.hasOpening`), so a bar that has never
       entered its bank balance fires NO signals, scores S1/S2 fine, and was told its runway
       was healthy. That is live-reachable, not just a demo artefact: _computeAudit sets s3 to
       null whenever survivalForecast has no data. Found via the seeded history, where an early
       audit printed CLEAR beside a 6-week runway, but the live path has the same hole.
       [[the-loop]] #72: when a count of problems goes green at zero, say what it could not
       evaluate. */
    const scored = Object.keys(audit.sections || {});
    const liquidityScored = scored.indexOf(this.SECTION_NAMES[2]) >= 0;
    const tag = hasData
      ? '<div style="color:var(--green);font-weight:800;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Clear</div>'
      : '<div style="text-align:right;flex-shrink:0;"><div style="font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:3px;">Not enough data</div></div>';
    const body = !hasData
      ? 'Not enough data to flag cash risks yet. Set your opening cash balance and log a week of cash and inventory, then run it.'
      : liquidityScored
        ? 'No cash risks flagged. Your runway, what is safe to spend, your draws, and your reserve are all in a healthy range.'
        : 'No cash risks flagged in what this audit could read. Your runway and what is safe to spend were not scored here, so this does not speak for them. Set your opening cash balance in Cash Position and run it again.';
    return '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section 5</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">Cash Risk Signals</div></div>'
      + tag + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">' + body + '</div>'
      + '</div>';
  },

  // ── 3-part findings (NARRATIVE / FINDING / TOOL), same structure and voice as
  //    the Profit and Revenue audits so all four read the same. ────────────────
  _s1Parts(s1, trapped, invValue, cap, lazyCats) {
    if (s1 == null) return {};
    const cur = v => App.fmtCurrency(v);
    const turns = cap.turns != null ? 'Your shelf cash turns about ' + cap.turns.toFixed(1) + ' times a year. ' : '';
    if (trapped.total > 0) return {
      S1_NARRATIVE: 'You have ' + cur(trapped.total) + ' of shelf cash frozen in slow movers and overstock, against ' + cur(invValue) + ' on hand. That is money working too little.',
      S1_FINDING: turns + (lazyCats.length ? 'The deadest weight sits in ' + lazyCats.join(', ') + '.' : 'Freeing it puts real money back in the account.'),
      S1_TOOL: 'Run the dead stock down and cut the over-par in Trapped Cash, then hold pars to real usage so it does not pile back on the shelf.'
    };
    return {
      S1_NARRATIVE: 'Almost none of your shelf cash is trapped. Your inventory is working.',
      S1_FINDING: turns + 'The shelf is turning cash, not holding it.',
      S1_TOOL: 'Hold it. Keep ordering to par so cash does not pile back onto the shelf.'
    };
  },
  _s2Parts(s2, cyc) {
    if (s2 == null || !cyc.hasData) return {};
    const cur = v => App.fmtCurrency(v);
    const d = v => Math.round(v) + ' day' + (Math.round(v) === 1 ? '' : 's');
    if (cyc.cycle > 0) return {
      S2_NARRATIVE: 'Your cash is locked about ' + d(cyc.cycle) + ': product sits ' + d(cyc.dio) + ' and you take ' + d(cyc.dpo) + ' to pay.',
      S2_FINDING: 'About ' + cur(cyc.lockedCash) + ' is tied up in that cycle, and every day you shorten it frees roughly ' + cur(cyc.dailyCogs) + '.',
      S2_TOOL: 'Order to par to cut the days product sits, and hold your terms to stretch the days you pay.'
    };
    return {
      S2_NARRATIVE: 'Your cash comes back before the bills are due. Product sits ' + d(cyc.dio) + ' and you take ' + d(cyc.dpo) + ' to pay.',
      S2_FINDING: 'Your vendors are financing your inventory. That is the right side of the cycle.',
      S2_TOOL: 'Hold it. Keep ordering to par and paying on the due date.'
    };
  },
  _s3Parts(s3, sf, pos) {
    if (s3 == null || !sf.hasData) return {};
    const cur = v => App.fmtCurrency(v);
    const safeTxt = (pos.safe != null && pos.safe < 0) ? ' Your Safe to Spend is under zero, you are leaning on money already spoken for.' : '';
    if (!sf.hasOpening) return {
      S3_NARRATIVE: sf.tightWeeks > 0 ? sf.tightWeeks + ' of the next thirteen weeks have more cash going out than coming in.' : 'No tight weeks in the next thirteen. Your cash timing looks clear.',
      S3_FINDING: 'Without an opening balance this is timing only, not a real runway.',
      S3_TOOL: 'Set your opening cash balance in Cash Position to see the full runway and exactly which week runs thin.'
    };
    const lowTxt = sf.lowPoint ? ' The tightest week is ' + this.fmtWk(sf.lowPoint.ws) + ' at ' + App.fmtBal(sf.lowPoint.balance) + '.' : '';
    if (sf.runway != null) return {
      S3_NARRATIVE: 'Your cash runs about ' + this.runwayLabel(sf.runway) + ' before it would go negative.',
      S3_FINDING: (lowTxt ? lowTxt.trim() : 'The next thirteen weeks are the window.') + safeTxt,
      S3_TOOL: 'Free trapped cash and hold payments to their due dates to push the runway out.'
    };
    return {
      S3_NARRATIVE: 'Your cash holds all thirteen weeks.',
      S3_FINDING: (lowTxt ? lowTxt.trim() + ' ' : '') + (sf.tightWeeks > 0 ? sf.tightWeeks + ' week' + (sf.tightWeeks === 1 ? '' : 's') + ' run tight on flow.' : 'No tight weeks ahead.') + safeTxt,
      S3_TOOL: sf.tightWeeks > 0 ? 'Catch the tight weeks on the forecast before they land, move a payment or hold an order.' : 'Hold it. Keep the forecast current so a tight week cannot surprise you.'
    };
  },
  _s4Parts(s4, onTerms, totalV, dpo) {
    if (s4 == null) return {};
    const d = Math.round(dpo);
    const hold = 'you hold about ' + d + ' day' + (d === 1 ? '' : 's') + ' on average before you pay';
    if (onTerms < totalV) return {
      S4_NARRATIVE: onTerms + ' of ' + totalV + ' vendors are on terms, and ' + hold + '.',
      S4_FINDING: 'The ' + (totalV - onTerms) + ' without terms are the ones you are financing early.',
      S4_TOOL: 'Set terms on the rest, and pay each bill on its due date, not early, to keep the float.'
    };
    return {
      S4_NARRATIVE: 'Every vendor is on terms, and ' + hold + '.',
      S4_FINDING: 'You are holding your cash to the last honest day.',
      S4_TOOL: 'Keep paying on the due date, not before, to keep the float yours.'
    };
  },

  /* ⛔ ENTER THROUGH App.pushView, WHICH IS WHAT RAISES THE FLOATING BACK BUTTON.
     This used to append "← Back" and "Print / Save PDF" to `this.actions` — which is
     `#topbar-actions`, inside the old `.topbar`. `c-audit` is in App._CONVERTED, so that
     topbar is `display:none` and BOTH buttons rendered at zero width. Measured: from an audit
     full view there was no visible Back anywhere (no #fn-back either, because nothing had
     pushed a view), and browser Back left the audit entirely — from a historical audit opened
     out of the history table it landed on Cash Fix. The only way back to the list was the nav
     rail. Export survived only because the page body carries its own copy of that button.
     app.js's _viewStack comment states the convention: one floating back button, no per-page
     back buttons — the same door Count / Delivery / Order history already use. */
  viewAudit(idx) {
    const audit = this.audits()[idx];
    if (!audit) return;
    App.pushView(() => this._drawAudit(audit));
  },

  _drawAudit(audit) {
    if (this.actions) this.actions.innerHTML = '';
    const d = audit.raw || {};
    const sx = audit.sections || {};
    const cur = v => v != null && v !== 0 ? App.fmtCurrency(v) : '';
    const days = v => v != null ? Math.round(v) + 'd' : '';
    const N = this.SECTION_NAMES;
    const sections = [
      AuditUI.sectionBlock(1, N[0], sx[N[0]], [
        ['Trapped Cash', cur(d.TRAPPED_CASH), d.TRAPPED_CASH > 0 ? 'warn' : 'good'],
        ['In Dead Stock', cur(d.DEAD_STOCK), d.DEAD_STOCK > 0 ? 'warn' : ''],
        ['Above Par', cur(d.OVERSTOCK), d.OVERSTOCK > 0 ? 'warn' : ''],
        // ⚠ TWO BASES SITTING NEXT TO EACH OTHER, AND THEY DO NOT MIX (S9; the rule is stated in
        // cash-engine.js:39-46). Inventory Value is E.onHand() — the shelf right now. Blended Turns
        // comes from E.capitalSummary(), which is built on the 4-count AVERAGE, because turns and
        // GMROI are only honest against average inventory. So turns was never computed from the
        // value printed above it, and a reader who divides one into the other cannot make it
        // reconcile. Say which basis each is on. **DO NOT "tidy" these onto one basis** — mixing
        // them is what scored one bar 0 while it built stock and 65 while it drew the same stock
        // down at an unchanged 50% lazy. c-capital.js:50-57 fixed the same defect the same way.
        ['Inventory Value', cur(d.INVENTORY_VALUE), '', 'on the shelf now'],
        ['Blended Turns', d.BLENDED_TURNS != null ? d.BLENDED_TURNS.toFixed(1) + 'x' : '', '', 'against average capital']
      ], null, d),
      AuditUI.sectionBlock(2, N[1], sx[N[1]], [
        ['Cash Locked', d.CYCLE_DAYS != null ? days(d.CYCLE_DAYS) : '', (d.CYCLE_DAYS != null && d.CYCLE_DAYS > 30) ? 'warn' : 'good'],
        ['Product Sits', days(d.DIO)],
        ['You Take to Pay', days(d.DPO)],
        ['Cash Tied in Cycle', cur(d.LOCKED_CASH), d.LOCKED_CASH > 0 ? 'warn' : '']
      ], null, d),
      AuditUI.sectionBlock(3, N[2], sx[N[2]], [
        ['Tight Weeks Ahead', d.TIGHT_WEEKS != null ? String(d.TIGHT_WEEKS) : '', d.TIGHT_WEEKS > 0 ? 'warn' : 'good'],
        ['Runway', d.HAS_OPENING ? this.runwayLabel(d.RUNWAY) : '', d.HAS_OPENING && d.RUNWAY != null ? 'warn' : ''],
        ['Low-Point Week', d.HAS_OPENING ? d.LOW_POINT_WEEK : ''],
        ['Low Point', d.HAS_OPENING ? App.fmtBal(d.LOW_POINT_BAL) : '', (d.HAS_OPENING && d.LOW_POINT_BAL < 0) ? 'warn' : ''],
        ['Safe to Spend', d.SAFE_TO_SPEND != null ? App.fmtBal(d.SAFE_TO_SPEND) : '', (d.SAFE_TO_SPEND != null && d.SAFE_TO_SPEND < 0) ? 'warn' : '']
      ], null, d),
      AuditUI.sectionBlock(4, N[3], sx[N[3]], [
        ['Vendors On Terms', d.TOTAL_VENDORS ? d.VENDORS_ON_TERMS + ' of ' + d.TOTAL_VENDORS : '', (d.TOTAL_VENDORS && d.VENDORS_ON_TERMS < d.TOTAL_VENDORS) ? 'warn' : 'good'],
        ['Days You Hold', d.WEIGHTED_DPO ? Math.round(d.WEIGHTED_DPO) + 'd' : '']
      ], null, d)
    ].join('');

    this.container.innerHTML = '<div class="screen">'
      + AuditUI.viewHero(audit, 'Cash Audit', 'ca', this.SECTION_NAMES.length)
      + this.cashStrip(audit)
      + AuditUI.actionsArea(audit, 'cash', 'ca')
      + sections
      + this.riskSection(audit)
      + '</div>';

    AuditUI.attachOutlook('ca', audit, 'cash');
    this.container.querySelector('.ca-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.ca-fix-btn').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = btn.dataset.gap; App.navigate('c-fix'); }));
  },

  // The opportunity hero spans the disciplines: the one-time cash you can free,
  // how long it stays locked, and whether the weeks ahead run tight. Cash to Free
  // is a ONE-TIME amount, never annualized.
  cashStrip(audit) {
    const d = audit.raw || {};
    const calc = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + calc('Cash to Free', App.fmtCurrency(audit.cash_to_free || 0), 'good')
      + calc('Cash Locked', d.CYCLE_DAYS != null ? Math.round(d.CYCLE_DAYS) + 'd' : '-', (d.CYCLE_DAYS != null && d.CYCLE_DAYS > 30) ? 'warn' : '')
      + calc('Tight Weeks', d.TIGHT_WEEKS != null ? String(d.TIGHT_WEEKS) : '-', d.TIGHT_WEEKS > 0 ? 'warn' : '')
      + '</div></div>';
  },

  async exportPDF(audit) {
    if (!audit) return;
    try { await App._ensurePDFLib(); } catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const d = audit.raw || {};
    const b = App._pdfBuilder('Cash Audit');
    b.header({ right: 'Cash Audit' });
    const dq = AuditUI.dataQualityLabel(audit, this.SECTION_NAMES.length);
    b.paragraph((audit.bar_name || 'Your Bar') + '  |  ' + (audit.date || '') + '  |  Overall ' + (audit.overall_score != null ? audit.overall_score : 'N/A') + (dq ? '  |  ' + dq : ''), { gray: 55 });
    if (audit.cash_to_free > 0) { b.spacer(4); b.heading('Cash to Free: ' + App.fmtCurrency(audit.cash_to_free), 13); }
    if ((audit.action_items || []).length) { b.spacer(4); b.sectionTitle('Action Items'); audit.action_items.forEach((a, i) => b.paragraph((i + 1) + '. ' + a.action, { gray: 55 })); }
    this.SECTION_NAMES.forEach((nm, i) => {
      b.spacer(4); b.sectionTitle('Section ' + (i + 1));
      b.heading(nm + '  (' + (audit.sections[nm] != null ? audit.sections[nm] : 'N/A') + ')', 12);
      const f = d['S' + (i + 1) + '_FINDING']; if (f) b.paragraph(f, { gray: 55 });
    });
    if ((audit.signals || []).length) {
      b.spacer(4); b.sectionTitle('Cash Risk Signals');
      audit.signals.forEach(s => { b.heading(s.label + '  (' + (s.score || '') + ')', 12); if (s.evidence) b.paragraph(s.evidence, { gray: 55 }); });
    }
    const f = App.deliverableFooter();
    b.disclaimer(f.workbookSubject);
    /* ⚠ THROUGH THE SHARED BUILDER, LIKE THE OTHER THREE AUDITS. This hand-rolled the filename
       — which is why it was one of the three that once shipped a file with NO .pdf extension
       (see App._savePDF's note) — and it stamped a dashed date while Profit, Revenue and Bar Cop
       all use App._pdfDateStamp()'s YYYYMMDD. One audit out of four with a different filename
       shape, on the documents most likely to be filed side by side. */
    const ds = /^\d{4}-\d{2}-\d{2}/.test(audit.date || '')
      ? (audit.date || '').slice(0, 10).replace(/-/g, '') : App._pdfDateStamp();
    await b.save(App.pdfFileName('Cash Audit', ds));
  },

  showHowTo() {
    App.showHelpModal('How the Cash Audit Works', [
      { p: ['The Cash Audit is a weekly score on your cash health, from 0 to 100, with a breakdown across the four things that decide whether a profitable bar runs flush or tight. It reads straight off your counts, orders, schedule, and bills, so there is nothing to type.'] },
      { h: 'The Four Sections', p: ['Capital Efficiency is how hard the cash on your shelves works, by turns and the dead stock dragging it. The Cash Conversion Cycle is how many days your money stays locked from buying product to selling it, net of the days you take to pay. Liquidity and Runway is whether the thirteen weeks ahead hold and how long your cash covers you. Payment Terms is whether you are keeping your float instead of paying early.'] },
      { h: 'Cash to Free', p: ['The opportunity number up top is the cash you can free right now, the dead stock plus the overstock above par. It is a one-time amount you can put back in the account, not a monthly figure, so Bar Cop shows it as exactly that.'] },
      { h: 'Sharpen the Runway', p: ['Set your opening cash balance in Cash Position and the audit reads a real runway, the week you would run thin, and what is actually safe to spend. Without it, the liquidity read still scores your tight weeks, the ones where more cash goes out than comes in.'] },
      { h: 'Cash Risk Signals', p: ['The last section flags the cross-cutting risks the four scores do not isolate: a cash crunch coming in the next thirteen weeks, a Safe to Spend gone negative, owner draws and debt outpacing what the business keeps, a reserve running thin. Each one fires only when it is actually true, so a flush bar shows few or none.'] },
      { h: 'Action Items', p: ['Each audit ranks what to work first by where you are weakest, and every Fix This button drops you straight into that Cash Fix system. Run it whenever you want a fresh read and watch the score climb as you free the cash and tighten the cycle.'] }
    ]);
  }
};
