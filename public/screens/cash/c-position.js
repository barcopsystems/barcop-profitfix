'use strict';

/* ── Cash Recovery — Cash Position (True Available Cash) ───────────────────────
   The number an operator is desperate for and never has: how much of the money
   in the account is actually free to spend RIGHT NOW. A point-in-time snapshot,
   not a forecast (that is the Forecast page). Your balance, minus the money that
   isn't yours (the sales tax you collected and owe since your last filing, plus
   any outstanding gift cards), minus the reserve you should keep. The Safe to
   Spend card shows the whole subtraction so you can see where every dollar goes.
   Reads CashEngine. Tax rate and filing frequency are set in Business Profile;
   the reserve target and gift card balance are set here on this device. */

S.CashPosition = {
  showHowTo() {
    App.showHelpModal('How Cash Position Works', [
      { p: ['The money in your account is not all yours to spend, and Cash Position is a snapshot of how much actually is, as of right now. Some of your balance is tax you collected and owe, and some should be a reserve so a slow stretch does not end you. This carves both out and shows what is truly free: your Safe to Spend.'] },
      { h: 'A Snapshot, Not A Forecast', p: ['Your cash on hand changes every day, so this is a point-in-time read: enter your balance now and it tells you what is safe to move on today. Check it again whenever you need the number. The thirteen-week look ahead lives on the Forecast page.'] },
      { h: 'Money That Isn\'t Yours', p: ['When a guest pays, the sales tax in that check was never your money, it is the state\'s, and you hold it until you remit. How often you file matters: a quarterly filer is sitting on up to three months of collected tax at once, a much bigger pile than a monthly filer who just remitted. Your sales tax rate and how you file are set once in Business Profile; Cash Position reads them and tracks the tax you have collected since your last filing. Outstanding gift cards count too: that is cash you already took in with product still owed, so enter the balance here and Bar Cop carves it out alongside the tax.'] },
      { h: 'Your Reserve', p: ['A healthy bar keeps a cushion, enough to cover its fixed bills through a slow stretch with no sales. Set how many weeks you want to hold and Bar Cop sizes the target off your recurring overhead, shows where you stand, and what is left over as truly free cash.'] },
      { h: 'Safe To Spend', p: ['Your balance, minus the tax and gift cards you owe, minus your reserve target. That is the money you can actually move on without putting the business at risk. If it is negative, you are spending money that is already spoken for.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const p = CashEngine.position();
    this.container.innerHTML = '<div class="screen">'
      + this.configCard(p)
      + (p.hasOpening ? this.heroCard(p) : '')
      + (p.hasOpening ? this.setAsideCard(p.setAside) : '')
      + (p.hasOpening ? this.reserveCard(p) : '')
      + '</div>';
    this.wire();
  },

  configCard(p) {
    return '<div class="card form-card"><div class="card-title">Your Numbers</div>'
      + '<div class="form-row">'
      +   '<div class="f" style="width:170px;"><label>Cash on hand</label><div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cp-cash" placeholder="0.00" value="' + (p.opening != null ? p.opening : '') + '"/></div></div>'
      +   '<div class="f" style="width:150px;"><label>Reserve target</label><div class="fw"><input type="number" class="suf" id="cp-reserve" placeholder="8" value="' + CashEngine.reserveWeeks() + '"/><span class="suf">wks</span></div></div>'
      +   '<div class="f" style="width:180px;"><label>Gift cards outstanding</label><div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cp-gift" placeholder="0" value="' + (CashEngine.giftCardLiability() || '') + '"/></div></div>'
      + '</div>'
      + this.taxReadout()
      + (p.opening == null ? '<div style="font-size:12px;color:var(--t3);margin-top:8px;">Enter your cash on hand to see what is really free to spend.</div>' : '')
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      +   '<button class="btn btn-primary" id="cp-save">Run Numbers</button>'
      +   '<button class="btn btn-ghost" id="cp-reset">Start Over</button>'
      + '</div>';
  },

  // The tax rate, filing frequency, and payroll burden are now set once in
  // App Settings -> Business Profile (read by Cash, Books, and Events alike).
  // Show the live values here as a read-only line so the operator can see what
  // is feeding the set-aside without editing it in two places.
  taxReadout() {
    const rate = CashEngine.salesTaxRate(), burden = CashEngine.payrollBurden();
    const freqLabel = CashEngine.taxFrequency() === 'quarterly' ? 'Quarterly' : 'Monthly';
    const parts = [rate > 0 ? 'Sales tax ' + rate + '% &middot; ' + freqLabel + ' filing' : 'Sales tax not set'];
    if (burden > 0) parts.push('Payroll tax ' + burden + '%');
    return '<div style="font-size:12px;color:var(--t3);margin-top:12px;padding-top:12px;border-top:1px solid var(--b2);">'
      + parts.join(' &middot; ') + ' &middot; set in <span data-go="settings-profile" style="color:var(--gold);cursor:pointer;text-decoration:underline;text-underline-offset:2px;">Business Profile</span></div>';
  },

  // ── Safe to Spend: the whole subtraction, so the relationship is visible ──────
  heroCard(p) {
    const today = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const safeCol = p.safe < 0 ? 'var(--red)' : 'var(--green)';
    const eq = (label, val, opts) => {
      opts = opts || {};
      return '<div style="flex:0 0 auto;">'
        + (label ? '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">' + label + '</div>' : '')
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:' + (opts.big ? '40px' : '26px') + ';font-weight:600;line-height:0.9;color:' + (opts.col || 'var(--t1)') + ';">' + val + '</div></div>';
    };
    const op = sym => '<div style="align-self:flex-end;font-size:20px;color:var(--t4);padding-bottom:3px;">' + sym + '</div>';
    return '<div class="card form-card" style="margin-top:6px;"><div class="card-title">Safe to Spend</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:18px;">As of ' + today + '. A snapshot of your account right now, not a forecast.</div>'
      + '<div style="display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;">'
      +   eq('Your Balance', App.fmtCurrency(p.opening || 0))
      +   op('&minus;')
      +   eq('Set Aside, Not Yours', App.fmtCurrency(p.setAside.total), { col: p.setAside.total > 0 ? 'var(--amber)' : 'var(--t1)' })
      +   op('&minus;')
      +   eq('Reserve Target', App.fmtCurrency(p.reserve))
      +   op('=')
      +   eq('Safe to Spend', App.fmtCurrency(p.safe), { big: true, col: safeCol })
      + '</div>'
      + (p.safe < 0
          ? '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);font-size:12px;color:var(--t2);line-height:1.6;"><strong style="color:var(--red);">You are spending spoken-for money.</strong> Your balance is already claimed by tax, gift cards, and your reserve. Free trapped cash or hold any spend until this is back above zero.</div>'
          : '')
      + '</div>';
  },

  setAsideCard(sa) {
    const row = (label, val, sub, warn) =>
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#0D181E;border-radius:var(--r2);margin-bottom:8px;">'
      + '<div><div style="font-size:13px;color:var(--t1);">' + label + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + sub + '</div>' : '') + '</div>'
      + '<div style="font-size:14px;font-weight:600;color:' + (warn && val > 0 ? 'var(--amber)' : 'var(--t1)') + ';white-space:nowrap;">' + App.fmtCurrency(val) + '</div></div>';
    const rateSet = CashEngine.salesTaxRate() > 0;
    return '<div class="sh" style="margin:24px 0 10px;">Money That Isn\'t Yours</div>'
      + '<div class="card">'
      + (rateSet
          ? row('Sales tax collected', sa.salesTax, 'Tax on your ' + sa.periodLabel + ' sales (' + App.fmtCurrency(sa.sales) + '), owed at your next remittance', true)
          : '<div style="font-size:12px;color:var(--t3);padding:6px 0;">Set your sales tax rate above and Bar Cop tracks the tax you have collected and owe since your last filing.</div>')
      + (CashEngine.payrollBurden() > 0 ? row('Payroll tax', sa.payrollTax, 'Estimated on ' + App.fmtCurrency(sa.wages) + ' in wages ' + sa.periodLabel, true) : '')
      + (sa.giftCards > 0 ? row('Gift cards outstanding', sa.giftCards, 'Cash you collected, product still owed', true) : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0 2px;">'
      +   '<div style="font-size:13px;font-weight:700;color:var(--t1);">Total set aside</div>'
      +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;color:var(--gold);">' + App.fmtCurrency(sa.total) + '</div></div>'
      + '</div>';
  },

  reserveCard(p) {
    const target = p.reserve, cushion = Math.max(0, p.cushion);
    const pct = target > 0 ? Math.min(100, Math.round(cushion / target * 100)) : 100;
    const gap = Math.max(0, target - p.cushion);
    const weekly = CashEngine.weeklyFixedCosts();
    const body = target <= 0
      ? '<div style="font-size:12px;color:var(--t3);">Add your recurring bills in Books and set a reserve target above, and Bar Cop sizes your cushion off your fixed overhead.</div>'
      : '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:600;line-height:1;color:' + (gap > 0 ? 'var(--t1)' : 'var(--green)') + ';">' + App.fmtCurrency(p.cushion) + '</span>'
        + '<span style="font-size:13px;color:var(--t2);">toward a ' + App.fmtCurrency(target) + ' reserve (' + CashEngine.reserveWeeks() + ' weeks of your ' + App.fmtCurrency(weekly) + '/wk fixed costs)</span></div>'
        + '<div style="height:8px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (gap > 0 ? 'var(--gold)' : 'var(--green)') + ';"></div></div>'
        + (gap > 0
            ? '<div style="font-size:12px;color:var(--t3);margin-top:10px;">You are <strong style="color:var(--t1);">' + App.fmtCurrency(gap) + '</strong> short. Free trapped cash to close it fast, then set aside a little each week to hold it.</div>'
            : '<div style="font-size:12px;color:var(--green);margin-top:10px;">Fully reserved. Your cushion covers ' + CashEngine.reserveWeeks() + ' weeks of fixed costs with no sales.</div>');
    return '<div class="sh" style="margin:24px 0 10px;">Your Reserve</div>'
      + '<div class="card">' + body
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="c-trapped">Free Trapped Cash</button></div></div>';
  },

  resetForm() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('cp-cash', ''); set('cp-reserve', ''); set('cp-gift', '');
  },

  wire() {
    const save = document.getElementById('cp-save');
    if (save) save.addEventListener('click', () => {
      CashEngine.setOpeningCash(document.getElementById('cp-cash').value);
      CashEngine.setReserveWeeks(document.getElementById('cp-reserve').value);
      CashEngine.setGiftCardLiability(document.getElementById('cp-gift').value);
      this.draw();
    });
    const reset = document.getElementById('cp-reset');
    if (reset) reset.addEventListener('click', () => this.resetForm());
    this.container.onclick = ev => {
      if (ev.target.closest('#cp-save') || ev.target.closest('#cp-reset')) return;
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
