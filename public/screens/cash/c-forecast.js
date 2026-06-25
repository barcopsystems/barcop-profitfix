'use strict';

/* ── Cash Recovery — Cash Forecast (the 13-Week Survival Forecast) ─────────────
   The tool independents live or die by. A full quarter of every dollar in and
   out, week by week, pulled from across Bar Cop: sales and event balances in;
   payroll, purchases, and every bill out. Enter your cash on hand and it becomes
   a running balance with the low-point week, your runway, and the line where you
   would go negative. The stress lever models a slow season and answers "can I
   afford it" for a hire, a buy, or a draw. Built to the report standard. Reads
   CashEngine.survivalForecast; the only input is your cash on hand, the one
   number Bar Cop cannot read for you, kept on this device. */

S.CashForecast = {
  WEEKS: 13,
  _salesAdj: 0,
  _scAmt: null,
  _scRecurring: false,

  cashOnHand() { return CashEngine.openingCash(); },

  showHowTo() {
    App.showHelpModal('How the Survival Forecast Works', [
      { p: ['This is the thirteen-week cash forecast, a full quarter of money in against money out. It is the tool that keeps a profitable bar from running out of cash on the wrong week, and almost nobody runs it. Bar Cop runs it for you off data you already keep.'] },
      { h: 'What Is In It', p: ['Cash in is your projected sales plus any event balances coming due. Cash out is your payroll from the schedule, your purchases, and every bill due that week, including the recurring ones projected forward. Enter your cash on hand and each week shows a running balance, so you see your real cushion and exactly which week runs thin.'] },
      { h: 'The Low Point And Runway', p: ['The low-point week is the tightest your account gets across the quarter, the one to plan around. Runway is how many weeks your cash covers before it would go negative. A long runway means you can absorb a slow stretch; a short one is your cue to free trapped cash and tighten terms now.'] },
      { h: 'Stress Test And Can I Afford It', p: ['Slide sales down for a slow season and watch which week cracks. Or drop in a what-if, a second bartender, an equipment buy, an owner draw, and see the runway move and whether you can carry it. Small moves made early beat a scramble on a Friday.'] },
      { h: 'Take It To The Bank', p: ['Export PDF gives you a clean thirteen-week cash flow to hand a lender for a line of credit. A bar that walks in with a real forecast gets a different conversation than one that does not.'] }
    ]);
  },

  statItem(label, val, cls) { return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>'; },
  statsCard(items) { return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>'; },
  dataCard(headers, rowsHtml) { return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>' + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'; },
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
      this.container.innerHTML = '<div class="screen">' + this.openingCard(opening)
        + '<div class="card" style="margin-top:16px;"><div style="font-size:13px;color:var(--t2);line-height:1.7;">The Survival Forecast reads your sales, payroll, purchases, and bills from across Bar Cop. Once your shift sales and a schedule are in, your quarter fills in here.</div>'
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="sc-dashboard">Import Sales</button></div></div></div>';
      this.wire();
      return;
    }

    this.container.innerHTML = '<div class="screen">'
      + this.openingCard(opening)
      + this.statStrip(fc, opening)
      + this.scenarioCard(fc, base)
      + '<div class="sh" style="margin:24px 0 10px;">Your Cash Across the Quarter</div>'
      + (opening != null ? this.curveCard(fc) : '')
      + this.table(fc, opening)
      + this.lowNote(fc, opening)
      + this.billsCard()
      + '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;">'
      +   '<button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="lc-build-schedule">Schedule</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cf-export">Export for Lender</button>'
      + '</div>'
      + '</div>';
    this.wire();
  },

  openingCard(opening) {
    return '<div class="card form-card"><div class="card-title">Cash On Hand</div>'
      + '<div class="form-row"><div class="f" style="width:200px;"><label>Your bank balance now</label>'
      + '<div class="fw"><span class="pre">$</span><input type="number" id="cf-cash" placeholder="0.00" value="' + (opening != null ? opening : '') + '"/></div></div></div>'
      + '</div>'
      + '<div style="margin:16px 0 4px;display:flex;align-items:center;gap:8px;"><button class="btn btn-primary btn-sm" id="cf-save">Save</button>'
      + (opening == null ? '<span style="font-size:12px;color:var(--t3);">Enter it once and the forecast becomes a real running balance and runway.</span>' : '') + '</div>';
  },

  statStrip(fc, opening) {
    if (opening == null) {
      return this.statsCard(
        this.statItem('Tightest Week', fc.tightWeeks ? this.fmtWk(fc.lowPoint.ws) : 'None', fc.tightWeeks ? 'warn' : '')
        + this.statItem('Tight Weeks', String(fc.tightWeeks), fc.tightWeeks ? 'warn' : '')
        + this.statItem('Quarter Net', this.signed(fc.rows.reduce((s, r) => s + r.net, 0))));
    }
    const runway = fc.runway != null ? (fc.runway === 0 ? 'This week' : fc.runway + ' wk' + (fc.runway === 1 ? '' : 's')) : this.WEEKS + '+ wks';
    return this.statsCard(
      this.statItem('Runway', runway, fc.runway != null ? 'warn' : '')
      + this.statItem('Low Point', App.fmtCurrency(fc.lowPoint.balance), fc.lowPoint.balance < 0 ? 'warn' : (fc.lowPoint.balance < opening * 0.25 ? 'warn' : ''))
      + this.statItem('Low-Point Week', this.fmtWk(fc.lowPoint.ws))
      + this.statItem('End of Quarter', App.fmtCurrency(fc.end), fc.end < opening ? 'warn' : ''));
  },

  // Slow-season chips + "Can I afford it" what-if.
  scenarioCard(fc, base) {
    const chip = (label, val) => '<button class="btn btn-ghost btn-sm cf-adj" data-adj="' + val + '" style="' + (this._salesAdj === val ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">' + label + '</button>';
    const slow = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Slow season</span>'
      + chip('Normal', 0) + chip('-10%', -10) + chip('-20%', -20) + chip('-30%', -30) + '</div>';

    let afford = '<div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px;">'
      + '<span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);align-self:center;">Can I afford</span>'
      + '<div class="f" style="width:150px;margin:0;"><div class="fw"><span class="pre">$</span><input type="number" id="cf-sc-amt" placeholder="0" value="' + (this._scAmt || '') + '"/></div></div>'
      + '<button class="btn btn-ghost btn-sm cf-sc-mode" data-mode="once" style="' + (!this._scRecurring ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">One time</button>'
      + '<button class="btn btn-ghost btn-sm cf-sc-mode" data-mode="month" style="' + (this._scRecurring ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">Every week</button>'
      + '<button class="btn btn-primary btn-sm" id="cf-sc-run">Run It</button>'
      + (this._scAmt ? '<button class="btn btn-ghost btn-sm" id="cf-sc-clear">Clear</button>' : '')
      + '</div>';

    let verdict = '';
    if (this._scAmt) {
      const baseLow = base.lowPoint ? base.lowPoint.balance : 0;
      const newLow = fc.lowPoint ? fc.lowPoint.balance : 0;
      const ok = newLow >= 0;
      verdict = '<div style="margin-top:12px;padding:11px 13px;border-radius:var(--r);background:' + (ok ? 'var(--gold-tint)' : 'rgba(193,84,75,0.08)') + ';border:1px solid var(--b-edge);font-size:12px;color:var(--t1);line-height:1.6;">'
        + '<strong style="color:' + (ok ? 'var(--green)' : 'var(--red)') + ';">' + (ok ? 'You can carry it.' : 'It breaks you.') + '</strong> '
        + 'Your low point ' + (this.cashOnHand() != null ? 'goes from ' + App.fmtCurrency(baseLow) + ' to ' + App.fmtCurrency(newLow) : 'drops by ' + App.fmtCurrency(baseLow - newLow))
        + (ok ? '. The cushion holds.' : ', under zero. Free trapped cash or hold it until the runway is longer.') + '</div>';
    }

    return '<div class="card form-card" style="margin-top:14px;"><div class="card-title">Stress Test</div>' + slow + afford + verdict + '</div>';
  },

  // Running-balance curve across the quarter (literal hex per the SVG-fill rule).
  curveCard(fc) {
    const W = 720, H = 120, padL = 8, padR = 8, padT = 12, padB = 18;
    const vals = fc.rows.map(r => r.balance);
    const lo = Math.min(0, ...vals), hi = Math.max(...vals, fc.opening);
    const span = (hi - lo) || 1;
    const n = fc.rows.length;
    const x = i => padL + (W - padL - padR) * (i / (n - 1));
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / span);
    const pts = fc.rows.map((r, i) => x(i) + ',' + y(r.balance).toFixed(1)).join(' ');
    const zeroY = y(0).toFixed(1);
    const low = fc.lowPoint;
    const GREEN = '#518A79', RED = '#C1544B', GOLD = '#DBAB46', GREY = '#16252E', T4 = '#5A6B77';
    const lowNeg = low.balance < 0;
    return '<div class="card" style="overflow:hidden;">'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" style="display:block;height:120px;">'
      + '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY + '" stroke="' + RED + '" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>'
      + '<polyline points="' + pts + '" fill="none" stroke="' + (fc.negativeWeeks ? RED : GREEN) + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
      + fc.rows.map((r, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(r.balance).toFixed(1) + '" r="2.5" fill="' + (r.balance < 0 ? RED : GREEN) + '"/>').join('')
      + '<circle cx="' + x(fc.lowIdx).toFixed(1) + '" cy="' + y(low.balance).toFixed(1) + '" r="4.5" fill="' + (lowNeg ? RED : GOLD) + '"/>'
      + '<text x="' + x(0).toFixed(1) + '" y="' + (H - 4) + '" font-size="9" fill="' + T4 + '" font-family="sans-serif">' + this.fmtWk(fc.rows[0].ws) + '</text>'
      + '<text x="' + (W - padR) + '" y="' + (H - 4) + '" font-size="9" fill="' + T4 + '" text-anchor="end" font-family="sans-serif">' + this.fmtWk(fc.rows[n - 1].ws) + '</text>'
      + '</svg></div>';
  },

  table(fc, opening) {
    const cols = opening != null ? '1.3fr 1fr 1fr 1fr 1.1fr' : '1.3fr 1fr 1fr 1.1fr';
    const headers = '<th>Week</th><th>In</th><th>Out</th><th>Net</th>' + (opening != null ? '<th>Balance</th>' : '');
    const body = fc.rows.map((r, i) => {
      const tg = r.net < 0;
      const isLow = i === fc.lowIdx && opening != null;
      const wk = this.fmtWk(r.ws) + (i === 0 ? ' <span style="color:var(--gold);font-weight:700;font-size:9px;letter-spacing:.5px;">NOW</span>' : '') + (isLow ? ' <span style="color:var(--gold);font-weight:700;font-size:9px;letter-spacing:.5px;">LOW</span>' : '');
      const rowBg = (opening != null && r.balance < 0) ? 'background:rgba(193,84,75,0.07);' : (tg ? 'background:rgba(193,84,75,0.04);' : '');
      return '<tr style="' + rowBg + '"><td style="color:var(--t1);">' + wk + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.inflow) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.out) + '</td>'
        + '<td class="val" style="font-weight:700;color:' + (tg ? 'var(--red)' : 'var(--green)') + ';">' + this.signed(r.net) + '</td>'
        + (opening != null ? '<td class="val" style="font-weight:600;color:' + (r.balance < 0 ? 'var(--red)' : 'var(--t1)') + ';">' + App.fmtCurrency(r.balance) + '</td>' : '')
        + '</tr>';
    }).join('');
    const est = fc.rows.some(r => r.laborSource === 'estimated');
    const note = '<div style="font-size:11px;color:var(--t4);margin-top:10px;">In is projected sales plus event balances. Out is payroll, purchases, and every bill due that week. '
      + (est ? 'Labor for unscheduled weeks is a trailing average; build the schedule to firm it up.' : 'Labor reads off your built schedule.') + '</div>';
    return this.dataCard(headers, body) + note;
  },

  // Who to pay this week: bills coming due, by date, so Pay on Terms is concrete.
  billsCard() {
    const bills = CashEngine.billsToPay(14);
    const heading = '<div class="sh" style="margin:24px 0 10px;">Bills Due, Next Two Weeks</div>';
    if (!bills.length) {
      return heading + '<div class="card"><div style="font-size:12px;color:var(--t3);">No bills due in the next two weeks. Hold any that land to their due date.</div></div>';
    }
    const rows = bills.map(b => {
      const termTxt = b.netDays > 0 ? 'Net ' + b.netDays : (b.terms || '-');
      return '<tr><td style="color:var(--t1);">' + this.fmtWk(b.date) + '</td>'
        + '<td>' + esc(b.vendor || b.category || 'Bill') + '</td>'
        + '<td class="val">' + App.fmtCurrency(b.amount) + '</td>'
        + '<td>' + esc(termTxt) + '</td></tr>';
    }).join('');
    const note = '<div style="font-size:11px;color:var(--t4);margin-top:10px;">Hold each to its due date, not the day it lands, and take any early-pay discount that beats idle cash.</div>';
    return heading + this.dataCard('<th>Due</th><th>Pay</th><th>Amount</th><th>Terms</th>', rows) + note;
  },

  lowNote(fc, opening) {
    if (opening == null || !fc.lowPoint) return '';
    const low = fc.lowPoint;
    if (low.balance >= 0 && fc.runway == null) {
      return '<div style="margin-top:14px;padding:13px 15px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:var(--r);font-size:12px;color:var(--t1);line-height:1.6;">'
        + '<strong style="color:var(--green);">You stay in the black all quarter.</strong> Your tightest week is ' + this.fmtWk(low.ws) + ' at ' + App.fmtCurrency(low.balance) + '. Keep the cushion and watch the weeks ahead.</div>';
    }
    return '<div style="margin-top:14px;padding:13px 15px;background:rgba(193,84,75,0.08);border:1px solid var(--b-edge);border-radius:var(--r);font-size:12px;color:var(--t1);line-height:1.6;">'
      + '<strong style="color:var(--red);">Tight at ' + this.fmtWk(low.ws) + '.</strong> Your account bottoms out at ' + App.fmtCurrency(low.balance) + (low.balance < 0 ? ', under zero' : '') + '. '
      + 'Free trapped cash now, hold payments to their due dates, and move a big buy off that week to cover it.</div>';
  },

  wire() {
    const save = document.getElementById('cf-save');
    if (save) save.addEventListener('click', () => { CashEngine.setOpeningCash(document.getElementById('cf-cash').value); this.draw(); });
    const run = document.getElementById('cf-sc-run');
    if (run) run.addEventListener('click', () => { const v = parseFloat(document.getElementById('cf-sc-amt').value); this._scAmt = isNaN(v) ? null : v; this.draw(); });
    this.container.onclick = ev => {
      if (ev.target.closest('#cf-save') || ev.target.closest('#cf-sc-run')) return;
      if (ev.target.closest('#cf-sc-clear')) { this._scAmt = null; this.draw(); return; }
      if (ev.target.closest('#cf-export')) { App.exportPDF({ title: '13-Week Cash Flow Forecast', root: this.container }); return; }
      const adj = ev.target.closest('.cf-adj');
      if (adj) { this._salesAdj = parseInt(adj.dataset.adj, 10) || 0; this.draw(); return; }
      const mode = ev.target.closest('.cf-sc-mode');
      if (mode) { this._scRecurring = mode.dataset.mode === 'month'; this.draw(); return; }
      if (ev.target.closest('[data-bills]')) { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.open) S.HubOperatingExpenses.open(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
