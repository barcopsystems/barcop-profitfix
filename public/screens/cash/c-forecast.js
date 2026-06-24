'use strict';

/* ── Cash Recovery — Cash Forecast ────────────────────────────────────────────
   The four-week cash curve: projected sales coming in against overhead bills,
   labor, and recurring purchases going out, week by week, so a heavy week shows
   up before the delivery truck wants a check. Inflow is your revenue forecast;
   outflow is dated bills from Books, labor (your built schedule or a trailing
   average), and your weekly cost of goods. Enter your cash on hand to turn the
   weekly net into a running balance and a runway. Reads CashEngine. The cash on
   hand is the one number only you know, so it is kept on this device. */

S.CashForecast = {
  WEEKS: 4,
  _cashKey: 'cash_on_hand_now',

  cashOnHand() { const v = parseFloat(localStorage.getItem(this._cashKey)); return isNaN(v) ? null : v; },
  setCashOnHand(v) { try { if (v == null || v === '') localStorage.removeItem(this._cashKey); else localStorage.setItem(this._cashKey, String(v)); } catch (e) {} },

  showHowTo() {
    App.showHelpModal('How the Cash Forecast Works', [
      { p: ['The forecast lines up the cash coming in against the cash going out for the next four weeks, so you catch a tight week before it bites. A quarterly insurance bill landing the same week as a big order, on a slow stretch, is the kind of thing that catches an operator short. Here you see it coming.'] },
      { h: 'What Is In It', p: ['Cash in is your projected sales, from your revenue forecast or Bar Cop\'s same-weekday baseline. Cash out is three pieces: overhead bills due that week from Books, your labor (your built schedule if you have one, otherwise a trailing average of what you actually pay), and your recurring purchases, estimated at your weekly cost of goods. Net is in minus out.'] },
      { h: 'Cash On Hand And Runway', p: ['Enter your cash on hand now and the weekly net becomes a running balance, so you see your actual cushion week to week and how many weeks it covers. That number is the one thing Bar Cop cannot read for you, so it stays on this device. Leave it blank and you still see the weekly net and any tight week.'] },
      { h: 'A Tight Week', p: ['A week where more goes out than comes in is flagged. One tight week with a cushion behind it is fine. A tight week with no cushion is your cue to move a payment to its due date, lean out a slow shift, or hold a big order a week. The cockpit steps are where you do something about it.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const rows = CashEngine.forecast(this.WEEKS);
    const cash = this.cashOnHand();

    // Running balance + runway when cash on hand is set.
    let bal = cash, runway = null;
    rows.forEach((r, i) => { if (cash != null) { bal += r.net; r._bal = bal; if (runway === null && bal < 0) runway = i; } });

    const thisWeekNet = rows.length ? rows[0].net : 0;
    const tight = rows.filter(r => r.net < 0).length;
    const horizonNet = rows.reduce((s, r) => s + r.net, 0);

    container.innerHTML = '<div class="screen">'
      + this.cashInput(cash)
      + this.statStrip(thisWeekNet, tight, horizonNet, cash, runway, rows)
      + '<div class="sh" style="margin:20px 0 8px;">The Next ' + this.WEEKS + ' Weeks</div>'
      + this.table(rows, cash)
      + (tight ? this.tightNote(rows) : '')
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'
      +   '<button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="lc-build-schedule">Build Schedule</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Order Sheet</button>'
      + '</div>'
      + '</div>';
    this.wire();
  },

  cashInput(cash) {
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
      +   '<div style="flex:1;min-width:200px;"><div style="font-size:12px;color:var(--t2);line-height:1.5;">Cash on hand now lets Bar Cop turn the weekly net into a running balance and a runway. Only you know this number, so it stays on this device.</div></div>'
      +   '<div class="f" style="width:170px;margin:0;"><label>Cash On Hand</label><div class="fw"><span class="pre">$</span><input type="number" id="cf-cash" placeholder="0" value="' + (cash != null ? cash : '') + '" style="height:42px;"/></div></div>'
      +   '<button class="btn btn-primary btn-sm" id="cf-save" style="align-self:flex-end;">Save</button>'
      + '</div></div>';
  },

  statStrip(thisWeekNet, tight, horizonNet, cash, runway, rows) {
    const item = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    const div = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 20px;"></div>';
    let third;
    if (cash != null) {
      const endBal = rows.length ? rows[rows.length - 1]._bal : cash;
      third = runway != null
        ? item('Runway', runway === 0 ? 'This week' : runway + ' wk' + (runway === 1 ? '' : 's'), 'warn')
        : item('Balance in ' + this.WEEKS + 'w', App.fmtCurrency(endBal, 0), endBal < 0 ? 'warn' : '');
    } else {
      third = item(this.WEEKS + '-Week Net', this.signed(horizonNet), horizonNet < 0 ? 'warn' : '');
    }
    return '<div style="display:flex;align-items:center;flex-wrap:wrap;background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 22px;">'
      + item('This Week Net', this.signed(thisWeekNet), thisWeekNet < 0 ? 'warn' : '')
      + div + item('Tight Weeks', String(tight), tight > 0 ? 'warn' : '')
      + div + third
      + '</div>';
  },

  signed(v) { return (v < 0 ? '-' : '+') + App.fmtCurrency(Math.abs(v), 0); },

  table(rows, cash) {
    const cols = cash != null ? '1.4fr 1fr 1fr 1fr 1fr' : '1.4fr 1fr 1fr 1.2fr';
    const head = '<div style="display:grid;grid-template-columns:' + cols + ';gap:10px;padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--b2);">'
      + '<div>Week</div><div style="text-align:right;">In</div><div style="text-align:right;">Out</div><div style="text-align:right;">Net</div>' + (cash != null ? '<div style="text-align:right;">Balance</div>' : '') + '</div>';
    const maxAbs = Math.max(1, ...rows.map(r => Math.max(r.inflow, r.out)));
    const body = rows.map((r, i) => {
      const tight = r.net < 0;
      const wk = this.fmtWk(r.ws) + (i === 0 ? ' <span style="color:var(--gold);font-weight:700;font-size:9px;letter-spacing:.5px;">NOW</span>' : '');
      const bar = '<div style="height:4px;background:var(--input);border-radius:3px;overflow:hidden;margin-top:5px;display:flex;">'
        + '<div style="height:100%;width:' + Math.round(r.inflow / maxAbs * 100) + '%;background:var(--green);"></div></div>'
        + '<div style="height:4px;background:var(--input);border-radius:3px;overflow:hidden;margin-top:3px;display:flex;">'
        + '<div style="height:100%;width:' + Math.round(r.out / maxAbs * 100) + '%;background:' + (tight ? 'var(--red)' : 'var(--t4)') + ';"></div></div>';
      return '<div style="display:grid;grid-template-columns:' + cols + ';gap:10px;padding:11px 14px;align-items:center;' + (i < rows.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + 'background:' + (tight ? 'rgba(193,84,75,0.06)' : (i % 2 ? 'var(--bg)' : 'transparent')) + ';">'
        + '<div style="min-width:0;"><div style="font-size:12px;color:var(--t1);">' + wk + '</div>' + bar + '</div>'
        + '<div style="text-align:right;font-size:12px;color:var(--t2);">' + App.fmtCurrency(r.inflow, 0) + '</div>'
        + '<div style="text-align:right;font-size:12px;color:var(--t2);">' + App.fmtCurrency(r.out, 0) + '</div>'
        + '<div style="text-align:right;font-size:13px;font-weight:700;color:' + (tight ? 'var(--red)' : 'var(--green)') + ';">' + this.signed(r.net) + '</div>'
        + (cash != null ? '<div style="text-align:right;font-size:13px;font-weight:600;color:' + (r._bal < 0 ? 'var(--red)' : 'var(--t1)') + ';">' + App.fmtCurrency(r._bal, 0) + '</div>' : '')
        + '</div>';
    }).join('');
    const est = rows.some(r => r.laborSource === 'estimated');
    const note = '<div style="font-size:10px;color:var(--t4);padding:9px 14px;border-top:1px solid var(--b2);">Out is overhead bills, labor, and your weekly cost of goods. '
      + (est ? 'Labor for unscheduled weeks is a trailing average; build the schedule to firm it up.' : 'Labor reads off your built schedule.') + '</div>';
    return '<div class="card" style="padding:0;overflow:hidden;">' + head + body + note + '</div>';
  },

  tightNote(rows) {
    const first = rows.find(r => r.net < 0);
    return '<div style="margin-top:14px;padding:13px 15px;background:rgba(193,84,75,0.08);border:1px solid var(--b-edge);border-radius:var(--r);">'
      + '<div style="font-size:12px;color:var(--t1);line-height:1.6;"><strong style="color:var(--red);">Tight week ' + this.fmtWk(first.ws) + '.</strong> '
      + App.fmtCurrency(first.out, 0) + ' goes out against ' + App.fmtCurrency(first.inflow, 0) + ' coming in. Move a payment to its due date, hold a big order a week, or lean out a slow shift to cover the gap.</div></div>';
  },

  fmtWk(ws) { const d = new Date(ws + 'T00:00:00'); return isNaN(d.getTime()) ? ws : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },

  wire() {
    const save = document.getElementById('cf-save');
    if (save) save.addEventListener('click', () => {
      const v = document.getElementById('cf-cash').value;
      this.setCashOnHand(v);
      this.render(this.container, this.actions);
    });
    this.container.onclick = ev => {
      if (ev.target.closest('#cf-save')) return;
      if (ev.target.closest('[data-bills]')) { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.open) S.HubOperatingExpenses.open(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
