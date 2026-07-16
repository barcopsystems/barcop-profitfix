'use strict';

/* ── Cash Recovery — Cash Forecast (the 13-Week Survival Forecast) ─────────────
   The tool independents live or die by. A full quarter of every dollar in and
   out, week by week, pulled from across Bar Cop: sales and event balances in;
   payroll, purchases, and every bill out. Enter your cash on hand and it becomes
   a running balance with the low-point week, your runway, and the line where you
   would go negative. The stress lever models a slow season and answers "can I
   afford it" for a hire, a buy, or a draw. Reads CashEngine.survivalForecast; the
   only input is your cash on hand, kept on this device. Organized as: a cash
   position card (balance in, survival stats out), the quarter (chart + table in
   one card), the stress test, then the money coming in and the bills going out. */

S.CashForecast = {
  WEEKS: 13,
  _salesAdj: 0,
  _scAmt: null,
  _scRecurring: false,
  // Shared column layout for the in/out timeline tables, so they line up.
  CFCOLS: '<colgroup><col style="width:13%"><col style="width:24%"><col style="width:21%"><col style="width:21%"><col style="width:21%"></colgroup>',

  cashOnHand() { return CashEngine.openingCash(); },

  showHowTo() {
    App.showHelpModal('How the Survival Forecast Works', [
      { p: ['This is the thirteen-week cash forecast, a full quarter of money in against money out. It is the tool that keeps a profitable bar from running out of cash on the wrong week, and almost nobody runs it. Bar Cop runs it for you off data you already keep.'] },
      { h: 'What Is In It', p: ['Cash in is your projected sales plus any event balances coming due. Cash out is your payroll from the schedule, your purchases, and every bill due that week, including the recurring ones projected forward. Enter your cash on hand and each week shows a running balance, so you see your real cushion and exactly which week runs thin. Past the weeks Bar Cop has real numbers for, it repeats your recent actual weeks forward so the quarter stays filled in instead of going flat.'] },
      { h: 'Your Credit Line As Backstop', p: ['If you keep a line of credit or a card you would lean on in a thin week, enter it next to your bank balance. Bar Cop counts it as your backstop, so a week that dips below zero reads as covered by credit, not a breach, as long as the line holds. The runway then means the weeks until you are truly out: your cash drained and the credit line maxed.'] },
      { h: 'Event Money Coming In', p: ['Booked events put real money on the calendar. The Event Money Coming In card lists each booked event by its date with its total, the deposit you already hold, and the balance still to collect, already counted in the cash-in above. Deposits in hand are money you owe service for, so they are never counted as cash to spend.'] },
      { h: 'The Low Point And Runway', p: ['The low-point week is the tightest your account gets across the quarter, the one to plan around. Runway is how many weeks your cash, plus any credit line, covers before you are truly out. A long runway means you can absorb a slow stretch; a short one is your cue to free trapped cash and tighten terms now.'] },
      { h: 'Stress Test And Can I Afford It', p: ['Slide sales down for a slow season and watch which week cracks. Or drop in a what-if, a second bartender, an equipment buy, an owner draw, and see the runway move. The verdict reads three ways: you can carry it on cash, you can carry it but only by leaning on your credit line (amber, you would be borrowing to do it), or it breaks you even with the line. Small moves made early beat a scramble on a Friday.'] },
      { h: 'Take It To The Bank', p: ['Export for Lender gives you a clean thirteen-week cash flow to hand a bank for a line of credit. A bar that walks in with a real forecast gets a different conversation than one that does not.'] }
    ]);
  },

  statItem(label, val, cls) { return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>'; },
  fixed5(headerCells, bodyRows) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this.CFCOLS + '<thead><tr>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>';
  },
  // A NET (a change), where the plus carries meaning. Its sibling for a BALANCE is
  // App.fmtBal: no plus, minus outside the '$'. Pick by what the number IS.
  signed(v) { return (v < 0 ? '-' : '+') + App.fmtCurrency(Math.abs(v)); },
  fmtWk(ws) { const d = new Date(ws + 'T00:00:00'); return isNaN(d.getTime()) ? ws : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const opening = this.cashOnHand();
    const opts = { salesAdj: this._salesAdj };
    if (this._scAmt) opts.extra = [{ amount: this._scAmt, recurring: this._scRecurring }];
    const fc = CashEngine.survivalForecast(this.WEEKS, opts);
    const base = CashEngine.survivalForecast(this.WEEKS, {});   // for the can-I-afford delta

    if (!fc.hasData) {
      this.container.innerHTML = '<div class="screen">' + this.positionCard(fc, opening, true)
        + '<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">The Survival Forecast reads your sales, payroll, purchases, and bills from across Bar Cop. Once your shift sales and a schedule are in, your quarter fills in here.</div>'
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="sc-dashboard">Import Sales</button></div></div></div>';
      this.wire();
      return;
    }

    this.container.innerHTML = '<div class="screen">'
      + this.positionCard(fc, opening, false)
      + this.scenarioCard(fc, base)
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">Your Cash Across the Quarter</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="cf-export">Export for Lender</button></div>'
      + this.forecastCard(fc, opening)
      + this.billsCard()
      + this.eventsCard()
      + '</div>';
    this.wire();
    this.wireChart();
  },

  // ── Cash position: your bank balance in, the survival stats out, one card ─────
  positionCard(fc, opening, noData) {
    const input = '<div class="form-row" style="margin-bottom:0;align-items:flex-end;">'
      + '<div class="f" style="width:190px;"><label>Your bank balance now</label>'
      + '<div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cf-cash" placeholder="0.00" value="' + (opening != null ? opening : '') + '"/></div></div>'
      + '<div class="f" style="width:170px;"><label>Available credit</label>'
      + '<div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cf-credit" placeholder="0" value="' + (CashEngine.availableCredit() || '') + '"/></div></div>'
      + '<div class="f" style="width:auto;flex:0 0 auto;"><label style="visibility:hidden;">Save</label>'
      + '<div style="display:flex;align-items:center;min-height:36px;"><button class="btn btn-primary btn-sm" id="cf-save">Save</button></div></div>'
      + '</div>';
    let statsHtml = '';
    if (!noData) {
      let items;
      if (opening == null) {
        items = this.statItem('Tightest Week', fc.tightWeeks ? this.fmtWk(fc.lowPoint.ws) : 'None', fc.tightWeeks ? 'warn' : '')
          + this.statItem('Tight Weeks', String(fc.tightWeeks), fc.tightWeeks ? 'warn' : '')
          + this.statItem('Quarter Net', this.signed(fc.rows.reduce((s, r) => s + r.net, 0)));
      } else {
        const runway = fc.runway != null ? (fc.runway === 0 ? 'This week' : fc.runway + ' wk' + (fc.runway === 1 ? '' : 's')) : this.WEEKS + '+ wks';
        items = this.statItem('Runway', runway, fc.runway != null ? 'warn' : '')
          + this.statItem('Low Point', App.fmtBal(fc.lowPoint.balance), (fc.lowPoint.balance < 0 || fc.lowPoint.balance < opening * 0.25) ? 'warn' : '')
          + this.statItem('Low-Point Week', this.fmtWk(fc.lowPoint.ws))
          + this.statItem('End of Quarter', App.fmtCurrency(fc.end), fc.end < opening ? 'warn' : '');
      }
      statsHtml = '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--b2);display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div>';
    }
    return '<div class="card form-card"><div class="card-title">Cash On Hand</div>' + input + statsHtml + '</div>';
  },

  // ── The quarter: running-balance chart over the 13-week table, one card ───────
  forecastCard(fc, opening) {
    return '<div class="card">'
      + (opening != null ? '<div style="margin-bottom:14px;">' + this.curve(fc) + '</div>' : '')
      + this.lowLine(fc, opening)
      + this.tableInner(fc, opening)
      + '</div>';
  },

  // Running-balance curve. Uniform scaling (no preserveAspectRatio="none", which
  // stretched the line, dates, and dot); literal hex per the SVG-fill rule.
  curve(fc) {
    const W = 1000, H = 150, padL = 6, padR = 6, padT = 14, padB = 26;
    const vals = fc.rows.map(r => r.balance);
    const lo = Math.min(0, ...vals), hi = Math.max(...vals, fc.opening);
    const span = (hi - lo) || 1;
    const n = fc.rows.length;
    const x = i => padL + (W - padL - padR) * (n > 1 ? i / (n - 1) : 0);
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / span);
    const pts = fc.rows.map((r, i) => x(i).toFixed(1) + ',' + y(r.balance).toFixed(1)).join(' ');
    const zeroY = y(0).toFixed(1);
    const low = fc.lowPoint, lowNeg = low.balance < 0;
    // SVG can't read the CSS vars, so these mirror the locked palette by hand: --green,
    // --red, --gold. RED was #C1544B, an off-palette red that matched nothing else in
    // Bar Cop (App.scoreHex and every other chart use --red). T4 is a solid stand-in
    // for --t4, which is an rgba token.
    const GREEN = '#518A79', RED = '#C03828', GOLD = '#DBAB46', T4 = '#5A6B77';
    // Transparent oversized hit circles carry each week's figures for the hover
    // tooltip (wired in wireChart), so the tiny visible dots are easy to land on.
    const hit = fc.rows.map((r, i) =>
      '<circle class="cf-dot" data-wk="' + esc(this.fmtWk(r.ws) + (i === 0 ? ' (now)' : (i === fc.lowIdx ? ' (low point)' : ''))) + '"'
      + ' data-in="' + esc(App.fmtCurrency(r.inflow)) + '" data-out="' + esc(App.fmtCurrency(r.out)) + '"'
      + ' data-net="' + esc(this.signed(r.net)) + '" data-netneg="' + (r.net < 0 ? '1' : '0') + '"'
      + ' data-bal="' + esc(App.fmtCurrency(r.balance)) + '" data-balneg="' + (r.balance < 0 ? '1' : '0') + '"'
      + ' cx="' + x(i).toFixed(1) + '" cy="' + y(r.balance).toFixed(1) + '" r="14" fill="transparent" style="cursor:pointer;"/>').join('');
    return '<svg class="cf-curve" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;height:auto;">'
      + '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY + '" stroke="' + RED + '" stroke-width="1" stroke-dasharray="5 5" opacity="0.45"/>'
      + '<polyline points="' + pts + '" fill="none" stroke="' + (fc.negativeWeeks ? RED : GREEN) + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
      + fc.rows.map((r, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(r.balance).toFixed(1) + '" r="3" fill="' + (r.balance < 0 ? RED : GREEN) + '"/>').join('')
      + '<circle cx="' + x(fc.lowIdx).toFixed(1) + '" cy="' + y(low.balance).toFixed(1) + '" r="5" fill="' + (lowNeg ? RED : GOLD) + '"/>'
      + '<text x="' + x(0).toFixed(1) + '" y="' + (H - 7) + '" font-size="12" fill="' + T4 + '" font-family="sans-serif">' + this.fmtWk(fc.rows[0].ws) + '</text>'
      + '<text x="' + (W - padR) + '" y="' + (H - 7) + '" font-size="12" fill="' + T4 + '" text-anchor="end" font-family="sans-serif">' + this.fmtWk(fc.rows[n - 1].ws) + '</text>'
      + hit
      + '</svg>';
  },

  // Hover tooltip for the chart dots: a fixed-position box (so the card's
  // overflow:hidden never clips it) showing that week's In, Out, Net, Balance.
  wireChart() {
    const svg = this.container.querySelector('.cf-curve');
    if (!svg) return;
    const tip = document.createElement('div');
    tip.id = 'cf-tip';
    tip.style.cssText = 'position:fixed;z-index:9999;display:none;pointer-events:none;background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:9px 12px;box-shadow:0 6px 20px rgba(0,0,0,0.45);min-width:148px;';
    this.container.appendChild(tip);
    const line = (label, val, col) => '<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;padding:1px 0;"><span style="color:var(--t3);">' + label + '</span><span style="color:' + (col || 'var(--t1)') + ';font-weight:600;">' + val + '</span></div>';
    const show = dot => {
      const d = dot.dataset;
      tip.innerHTML = '<div style="font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--t2);margin-bottom:7px;">' + d.wk + '</div>'
        + line('In', d.in)
        + line('Out', d.out)
        + line('Net', d.net, d.netneg === '1' ? 'var(--red)' : 'var(--green)')
        + line('Balance', d.bal, d.balneg === '1' ? 'var(--red)' : 'var(--t1)');
      const rect = dot.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = (rect.left + rect.width / 2) + 'px';
      if (rect.top < 130) { tip.style.top = rect.bottom + 'px'; tip.style.transform = 'translate(-50%, 8px)'; }
      else { tip.style.top = rect.top + 'px'; tip.style.transform = 'translate(-50%, calc(-100% - 8px))'; }
    };
    svg.querySelectorAll('.cf-dot').forEach(dot => {
      dot.addEventListener('mouseenter', () => show(dot));
      dot.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    });
  },

  // One concise low-point read inside the forecast card (no floating callout).
  lowLine(fc, opening) {
    if (opening == null || !fc.lowPoint) return '';
    const low = fc.lowPoint, credit = fc.credit || 0;
    const wk = this.fmtWk(low.ws), bal = App.fmtBal(low.balance);
    const wrap = (inner) => '<div style="font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:14px;">' + inner + '</div>'
      + '<div class="pdf-para" style="display:none;">' + inner + '</div>';
    if (low.balance >= 0) {
      return wrap('<strong style="color:var(--green);">In the black all quarter.</strong> Tightest week is ' + wk + ' at ' + bal + '.'
        + (credit > 0 ? ' Plus ' + App.fmtCurrency(credit) + ' of credit in reserve if a slow stretch hits.' : ''));
    }
    if (fc.drawsCredit) {
      return wrap('<strong style="color:var(--amber);">Tight at ' + wk + '.</strong> Your cash dips to ' + bal + ', under zero, but your ' + App.fmtCurrency(credit) + ' credit line covers it. Free trapped cash so you do not have to lean on it.');
    }
    const tail = credit > 0 ? ' Even with your ' + App.fmtCurrency(credit) + ' credit line you would be ' + App.fmtCurrency(Math.abs(low.balance) - credit) + ' short.' : '';
    return wrap('<strong style="color:var(--red);">Tight at ' + wk + '.</strong> Bottoms out at ' + bal + ', under zero.' + tail + ' Free trapped cash and tighten terms now.');
  },

  tableInner(fc, opening) {
    const headers = '<th>Week</th><th>In</th><th>Out</th><th>Net</th>' + (opening != null ? '<th>Balance</th>' : '');
    const body = fc.rows.map((r, i) => {
      const tg = r.net < 0;
      const isLow = i === fc.lowIdx && opening != null;
      const wk = this.fmtWk(r.ws) + (i === 0 ? ' <span style="color:var(--gold);font-weight:700;font-size:9px;letter-spacing:.5px;">NOW</span>' : '') + (isLow ? ' <span style="color:var(--gold);font-weight:700;font-size:9px;letter-spacing:.5px;">LOW</span>' : '');
      // rgb(192,56,40) = #C03828 = --red. This was rgba(193,84,75,...), which is the
      // retired off-palette #C1544B: the RED constant above got moved to the real token
      // and this tint was missed, so the rows tinted in one red under a curve drawn in
      // another.
      const rowBg = (opening != null && r.balance < 0) ? 'background:rgba(192,56,40,0.07);' : (tg ? 'background:rgba(192,56,40,0.04);' : '');
      return '<tr style="' + rowBg + '"><td data-label="Week" style="color:var(--t1);">' + wk + '</td>'
        + '<td data-label="In" class="val">' + App.fmtCurrency(r.inflow) + '</td>'
        + '<td data-label="Out" class="val">' + App.fmtCurrency(r.out) + '</td>'
        + '<td data-label="Net" class="val" style="font-weight:700;color:' + (tg ? 'var(--red)' : 'var(--green)') + ';">' + this.signed(r.net) + '</td>'
        + (opening != null ? '<td data-label="Balance" class="val" style="font-weight:600;color:' + (r.balance < 0 ? 'var(--red)' : 'var(--t1)') + ';">' + App.fmtCurrency(r.balance) + '</td>' : '')
        + '</tr>';
    }).join('');
    return '<div style="overflow-x:auto;margin-top:0;"><table class="row-list"><thead><tr>' + headers + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  // ── Stress test: slow-season chips + "Can I afford it" what-if ────────────────
  scenarioCard(fc, base) {
    const onSel = active => active ? 'background:var(--sel-active-bg);border-color:var(--b-edge);color:var(--t1);' : '';
    const chip = (label, val) => '<button class="btn btn-ghost btn-sm cf-adj" data-adj="' + val + '" style="' + onSel(this._salesAdj === val) + '">' + label + '</button>';
    const slow = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Slow season</span>'
      + chip('Normal', 0) + chip('-10%', -10) + chip('-20%', -20) + chip('-30%', -30) + '</div>';

    const afford = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;">'
      + '<span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Can I afford</span>'
      + '<div class="f" style="width:150px;margin:0;"><div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cf-sc-amt" placeholder="0" value="' + (this._scAmt || '') + '"/></div></div>'
      + '<button class="btn btn-ghost btn-sm cf-sc-mode" data-mode="once" style="' + onSel(!this._scRecurring) + '">One time</button>'
      + '<button class="btn btn-ghost btn-sm cf-sc-mode" data-mode="month" style="' + onSel(this._scRecurring) + '">Every week</button>'
      + '<button class="btn btn-primary btn-sm" id="cf-sc-run">Run It</button>'
      + (this._scAmt ? '<button class="btn btn-ghost btn-sm" id="cf-sc-clear">Clear</button>' : '')
      + '</div>';

    let verdict = '';
    if (this._scAmt) {
      const baseLow = base.lowPoint ? base.lowPoint.balance : 0;
      const newLow = fc.lowPoint ? fc.lowPoint.balance : 0;
      const box = inner => '<div style="margin-top:14px;padding:11px 13px;border-radius:var(--r);background:var(--gold-tint);border:1px solid var(--b-edge);font-size:12px;color:var(--t1);line-height:1.6;">' + inner + '</div>';
      if (!fc.hasOpening) {
        // With no bank balance on file, survivalForecast opens the quarter at an assumed
        // $0 (`openingCash() || 0`), so every balance in this forecast is an offset from
        // a number the operator never gave us. Ruling "It breaks you, under zero" off
        // that is a verdict on nothing: it fires for ANY amount, on exactly the bars the
        // audit tells "flying blind on cash". The two other balance reads on this screen
        // (positionCard, lowLine) already gate on the opening; this one did not.
        // The SWING is still honest: the opening is a constant offset, so it cancels out
        // of the delta between the two forecasts. Show that, and ask for the balance
        // before ruling on it.
        verdict = box('<strong>Your low point moves ' + App.fmtCurrency(Math.abs(baseLow - newLow)) + '.</strong> '
          + 'Whether you can carry that comes down to what is in the bank, and Bar Cop does not have that yet. '
          + 'Put your balance in up top and this gives you a straight answer.');
      } else {
        const credit = fc.credit || 0;
        const ok = newLow >= 0, onCredit = !ok && newLow >= -credit;
        const head = ok ? 'You can carry it.' : onCredit ? 'You can carry it, on credit.' : 'It breaks you.';
        const headCol = ok ? 'var(--green)' : onCredit ? 'var(--amber)' : 'var(--red)';
        const tail = ok ? '. The cushion holds.'
          : onCredit ? ', under zero. Your ' + App.fmtCurrency(credit) + ' credit line covers it, but you would be borrowing to do it.'
          : ', under zero. Even with your credit line you would be ' + App.fmtCurrency(Math.abs(newLow) - credit) + ' short. Free trapped cash or hold it until the runway is longer.';
        verdict = box('<strong style="color:' + headCol + ';">' + head + '</strong> '
          + 'Your low point goes from ' + App.fmtBal(baseLow) + ' to ' + App.fmtBal(newLow) + tail);
      }
    }

    return '<div class="no-print"><div class="sh" style="margin:24px 0 10px;">Stress Test</div>'
      + '<div class="card form-card">' + slow + afford + verdict + '</div></div>';
  },

  // ── Event money coming in: booked-event balances by date ──────────────────────
  eventsCard() {
    const ce = CashEngine.committedEventCash(this.WEEKS);
    if (!ce.list.length && !ce.deposits) return '';
    const heading = '<div class="sh" style="margin:24px 0 10px;">Event Money Coming In</div>';
    if (!ce.list.length) {
      return heading + '<div class="card"><div style="font-size:12px;color:var(--t2);">'
        + App.fmtCurrency(ce.deposits) + ' in deposits is already in hand against booked events. No balances left to collect this quarter.</div></div>';
    }
    const rows = ce.list.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e =>
      '<tr><td data-label="Event Date" style="color:var(--t1);">' + this.fmtWk(e.date) + '</td>'
      + '<td data-label="Event"><span style="color:var(--t1);">' + esc(e.name) + '</span></td>'
      + '<td data-label="Event Total" class="val">' + App.fmtCurrency(e.total != null ? e.total : e.amount) + '</td>'
      + '<td data-label="Deposit Held" class="val">' + (e.deposit ? App.fmtCurrency(e.deposit) : '-') + '</td>'
      + '<td data-label="Balance Due" class="val" style="font-weight:600;">' + App.fmtCurrency(e.amount) + '</td></tr>').join('');
    return heading + this.fixed5('<th>Event Date</th><th>Event</th><th>Event Total</th><th>Deposit Held</th><th>Balance Due</th>', rows);
  },

  // ── Bills due, next two weeks: who to pay and when ────────────────────────────
  billsCard() {
    const bills = CashEngine.billsToPay(14);
    const heading = '<div class="sh" style="margin:24px 0 10px;">Bills Due, Next Two Weeks</div>';
    if (!bills.length) {
      return heading + '<div class="card"><div style="font-size:12px;color:var(--t2);">No bills due in the next two weeks. Hold any that land to their due date.</div></div>';
    }
    const rows = bills.map(b => {
      const termTxt = b.netDays > 0 ? 'Net ' + b.netDays : (b.terms || '-');
      return '<tr><td data-label="Due" style="color:var(--t1);">' + this.fmtWk(b.date) + '</td>'
        + '<td data-label="Pay"><span style="color:var(--t1);">' + esc(b.vendor || b.category || 'Bill') + '</span></td>'
        + '<td data-label="Category">' + esc(b.category || '-') + '</td>'
        + '<td data-label="Amount" class="val">' + App.fmtCurrency(b.amount) + '</td>'
        + '<td data-label="Terms">' + esc(termTxt) + '</td></tr>';
    }).join('');
    return heading + this.fixed5('<th>Due</th><th>Pay</th><th>Category</th><th>Amount</th><th>Terms</th>', rows);
  },

  wire() {
    const save = document.getElementById('cf-save');
    if (save) save.addEventListener('click', () => { CashEngine.setOpeningCash(document.getElementById('cf-cash').value); CashEngine.setAvailableCredit(document.getElementById('cf-credit').value); this.draw(); });
    const run = document.getElementById('cf-sc-run');
    if (run) run.addEventListener('click', () => { const v = parseFloat(document.getElementById('cf-sc-amt').value); this._scAmt = isNaN(v) ? null : v; this.draw(); });
    this.container.onclick = ev => {
      if (ev.target.closest('#cf-save') || ev.target.closest('#cf-sc-run')) return;
      if (ev.target.closest('#cf-sc-clear')) { this._scAmt = null; this.draw(); return; }
      if (ev.target.closest('#cf-export')) { this._exportLender(); return; }
      const adj = ev.target.closest('.cf-adj');
      if (adj) { this._salesAdj = parseInt(adj.dataset.adj, 10) || 0; this.draw(); return; }
      const mode = ev.target.closest('.cf-sc-mode');
      if (mode) { this._scRecurring = mode.dataset.mode === 'month'; this.draw(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  },

  // Export-acknowledgment gate (once per visit) before the lender forecast
  // download. A 13-week pro-forma handed to a bank is high-stakes, so it routes
  // through the same gate as Payroll and Books. See [[legal-protection]].
  async _exportLender() {
    if (!this._cfAckGiven) {
      const ok = await App.confirmExport({
        title: 'Before You Export for a Lender',
        message: 'This is a thirteen-week cash flow projection built from the numbers you have logged in Bar Cop. It is a forecast, not a guarantee or an audited financial statement, and your actual results will vary. Look it over before you hand it to a lender.',
        confirmText: 'I Understand, Continue',
        cancelText: 'Cancel'
      });
      if (!ok) return;
      this._cfAckGiven = true;
    }
    App.exportPDF({ title: '13-Week Cash Flow Forecast', root: this.container, brand: (App.data && App.data.settings && App.data.settings.bar_name) || '', footer: 'Projected figures based on historical sales and known commitments. Actual results will vary.' });
  }
};
