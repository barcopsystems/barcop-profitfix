'use strict';

/* ── Cash Recovery — Cash Forecast ────────────────────────────────────────────
   The four-week cash curve: projected sales in against overhead bills, labor, and
   recurring purchases out, week by week, so a heavy week shows up before the
   delivery truck wants a check. Built to the report standard (form-card input +
   stats card + .data-card). Enter your cash on hand to turn the weekly net into a
   running balance and a runway. The cash on hand is the one number only you know,
   so it is kept on this device. Reads CashEngine. */

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

  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  signed(v) { return (v < 0 ? '-' : '+') + App.fmtCurrency(Math.abs(v)); },
  fmtWk(ws) { const d = new Date(ws + 'T00:00:00'); return isNaN(d.getTime()) ? ws : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const rows = CashEngine.forecast(this.WEEKS);
    const cash = this.cashOnHand();

    let bal = cash, runway = null;
    rows.forEach((r, i) => { if (cash != null) { bal += r.net; r._bal = bal; if (runway === null && bal < 0) runway = i; } });

    const thisWeekNet = rows.length ? rows[0].net : 0;
    const tight = rows.filter(r => r.net < 0).length;
    const horizonNet = rows.reduce((s, r) => s + r.net, 0);

    // Cash on hand (form-card; explainer lives in the how-to).
    const cashCard = '<div class="card form-card"><div class="card-title">Cash On Hand</div>'
      + '<div class="form-row"><div class="f" style="width:190px;"><label>Cash on hand now</label>'
      + '<div class="fw"><span class="pre">$</span><input type="number" id="cf-cash" placeholder="0.00" value="' + (cash != null ? cash : '') + '"/></div></div></div>'
      + '</div>'
      + '<div style="margin:16px 0 4px;display:flex;align-items:center;gap:8px;"><button class="btn btn-primary btn-sm" id="cf-save">Save</button></div>';

    // Stats.
    let third;
    if (cash != null) {
      const endBal = rows.length ? rows[rows.length - 1]._bal : cash;
      third = runway != null
        ? this.statItem('Runway', runway === 0 ? 'This week' : runway + ' wk' + (runway === 1 ? '' : 's'), 'warn')
        : this.statItem('Balance in ' + this.WEEKS + 'w', App.fmtCurrency(endBal), endBal < 0 ? 'warn' : '');
    } else {
      third = this.statItem(this.WEEKS + '-Week Net', this.signed(horizonNet), horizonNet < 0 ? 'warn' : '');
    }
    const stats = this.statsCard(
      this.statItem('This Week Net', this.signed(thisWeekNet), thisWeekNet < 0 ? 'warn' : '')
      + this.statItem('Tight Weeks', String(tight), tight > 0 ? 'warn' : '')
      + third);

    const actionRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="lc-build-schedule">Build Schedule</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Order Sheet</button>'
      + '<button class="btn btn-ghost btn-sm" id="cf-export">Export PDF</button>'
      + '</div>';

    const headers = '<th>Week</th><th>In</th><th>Out</th><th>Net</th>' + (cash != null ? '<th>Balance</th>' : '');
    const body = rows.map((r, i) => {
      const tg = r.net < 0;
      const wk = this.fmtWk(r.ws) + (i === 0 ? ' <span style="color:var(--gold);font-weight:700;font-size:9px;letter-spacing:.5px;">NOW</span>' : '');
      return '<tr' + (tg ? ' style="background:rgba(193,84,75,0.06);"' : '') + '><td style="color:var(--t1);">' + wk + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.inflow) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.out) + '</td>'
        + '<td class="val" style="font-weight:700;color:' + (tg ? 'var(--red)' : 'var(--green)') + ';">' + this.signed(r.net) + '</td>'
        + (cash != null ? '<td class="val" style="font-weight:600;color:' + (r._bal < 0 ? 'var(--red)' : 'var(--t1)') + ';">' + App.fmtCurrency(r._bal) + '</td>' : '')
        + '</tr>';
    }).join('');

    const est = rows.some(r => r.laborSource === 'estimated');
    const note = '<div style="font-size:11px;color:var(--t4);margin-top:10px;">Out is overhead bills, labor, and your weekly cost of goods. '
      + (est ? 'Labor for unscheduled weeks is a trailing average; build the schedule to firm it up.' : 'Labor reads off your built schedule.') + '</div>';

    const tightNote = tight ? this.tightNote(rows) : '';

    this.container.innerHTML = '<div class="screen">'
      + cashCard + stats + actionRow
      + '<div class="sh" style="margin:24px 0 10px;">The Next ' + this.WEEKS + ' Weeks</div>'
      + this.dataCard(headers, body) + note + tightNote
      + '</div>';

    const save = document.getElementById('cf-save');
    if (save) save.addEventListener('click', () => { this.setCashOnHand(document.getElementById('cf-cash').value); this.draw(); });
    this.container.onclick = ev => {
      if (ev.target.closest('#cf-save')) return;
      if (ev.target.closest('#cf-export')) { App.exportPDF({ title: 'Cash Forecast', root: this.container }); return; }
      if (ev.target.closest('[data-bills]')) { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.open) S.HubOperatingExpenses.open(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  },

  tightNote(rows) {
    const first = rows.find(r => r.net < 0);
    return '<div style="margin-top:14px;padding:13px 15px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:var(--r);">'
      + '<div style="font-size:12px;color:var(--t1);line-height:1.6;"><strong style="color:var(--red);">Tight week ' + this.fmtWk(first.ws) + '.</strong> '
      + App.fmtCurrency(first.out) + ' goes out against ' + App.fmtCurrency(first.inflow) + ' coming in. Move a payment to its due date, hold a big order a week, or lean out a slow shift to cover the gap.</div></div>';
  }
};
