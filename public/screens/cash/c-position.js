'use strict';

/* ── Cash Recovery — Cash Position (True Available Cash) ───────────────────────
   The number an operator is desperate for and never has: how much of the money
   in the account is actually free to spend. Your balance, minus the money that
   isn't yours (the sales tax you collected and owe, plus tips you are holding),
   minus the reserve you should keep to survive a slow stretch. Spending the
   sales tax you collected is the classic way a profitable bar goes under; this is
   where you stop doing it. Built to the report standard. Reads CashEngine. The
   config (your tax rate, reserve target) is light and kept on this device. */

S.CashPosition = {
  showHowTo() {
    App.showHelpModal('How Cash Position Works', [
      { p: ['The money in your account is not all yours to spend. Some of it is tax you collected and owe, and some of it should be a reserve so a slow stretch does not end you. Cash Position carves both out and shows what is actually free: your Safe to Spend.'] },
      { h: 'Money That Isn\'t Yours', p: ['When a guest pays, the sales tax in that check was never your money, it is the state\'s, and you hold it until you remit. Spending it is the single most common way a profitable bar ends up unable to pay its tax bill. Set your sales tax rate and Bar Cop tracks the running liability off your sales, plus any tips you are holding, so you never mistake it for cash you have.'] },
      { h: 'Your Reserve', p: ['A healthy bar keeps a cushion, enough to cover its fixed bills through a slow stretch with no sales. Set how many weeks you want to hold and Bar Cop sizes the target off your recurring overhead, shows where you stand, and what is left over as truly free cash.'] },
      { h: 'Safe To Spend', p: ['Your balance, minus the tax and tips you owe, minus your reserve target. That is the money you can actually move on without putting the business at risk. If it is negative, you are spending money that is already spoken for.'] }
    ]);
  },

  statItem(label, val, cls) { return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>'; },
  statsCard(items) { return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>'; },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const p = CashEngine.position();
    const sa = p.setAside;

    this.container.innerHTML = '<div class="screen">'
      + this.configCard(p)
      + (p.hasOpening ? this.hero(p) : '')
      + (p.hasOpening ? this.setAsideCard(sa) : '')
      + (p.hasOpening ? this.reserveCard(p) : '')
      + '</div>';
    this.wire();
  },

  configCard(p) {
    const freq = CashEngine.taxFrequency();
    const seg = (label, val, on) => '<button class="btn btn-ghost btn-sm cp-freq" data-freq="' + val + '" style="' + (on ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">' + label + '</button>';
    return '<div class="card form-card"><div class="card-title">Your Numbers</div>'
      + '<div class="form-row">'
      +   '<div class="f" style="width:170px;"><label>Cash on hand</label><div class="fw"><span class="pre">$</span><input type="number" id="cp-cash" placeholder="0.00" value="' + (p.opening != null ? p.opening : '') + '"/></div></div>'
      +   '<div class="f" style="width:140px;"><label>Sales tax rate</label><div class="fw"><input type="number" id="cp-tax" placeholder="0" step="0.01" value="' + (CashEngine.salesTaxRate() || '') + '"/><span class="suf">%</span></div></div>'
      +   '<div class="f" style="width:150px;"><label>Reserve target</label><div class="fw"><input type="number" id="cp-reserve" placeholder="8" value="' + CashEngine.reserveWeeks() + '"/><span class="suf">wks</span></div></div>'
      +   '<div class="f" style="width:160px;"><label>Payroll tax (optional)</label><div class="fw"><input type="number" id="cp-burden" placeholder="0" step="0.1" value="' + (CashEngine.payrollBurden() || '') + '"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;"><span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Remit tax</span>'
      +   seg('Monthly', 'monthly', freq === 'monthly') + seg('Quarterly', 'quarterly', freq === 'quarterly') + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 4px;display:flex;align-items:center;gap:8px;"><button class="btn btn-primary btn-sm" id="cp-save">Save</button>'
      + (p.opening == null ? '<span style="font-size:12px;color:var(--t3);">Enter your cash on hand and tax rate to see what is really free to spend.</span>' : '') + '</div>';
  },

  hero(p) {
    const cls = p.safe < 0 ? 'warn' : '';
    return '<div style="margin-top:6px;">' + this.statsCard(
      this.statItem('Safe to Spend', App.fmtCurrency(p.safe), cls)
      + this.statItem('Set Aside (not yours)', App.fmtCurrency(p.setAside.total), p.setAside.total > 0 ? 'warn' : '')
      + this.statItem('Reserve Target', App.fmtCurrency(p.reserve))
      + this.statItem('Your Balance', App.fmtCurrency(p.opening || 0)))
      + '</div>';
  },

  setAsideCard(sa) {
    const row = (label, val, sub, warn) =>
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);">'
      + '<div><div style="font-size:13px;color:var(--t1);">' + label + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + sub + '</div>' : '') + '</div>'
      + '<div style="font-size:14px;font-weight:600;color:' + (warn && val > 0 ? 'var(--amber)' : 'var(--t1)') + ';white-space:nowrap;">' + App.fmtCurrency(val) + '</div></div>';
    const rateSet = CashEngine.salesTaxRate() > 0;
    return '<div class="sh" style="margin:24px 0 10px;">Money That Isn\'t Yours</div>'
      + '<div class="card">'
      + (rateSet
          ? row('Sales tax collected', sa.salesTax, 'On ' + App.fmtCurrency(sa.sales) + ' in sales ' + sa.periodLabel + ', owed at remittance', true)
          : '<div style="font-size:12px;color:var(--t3);padding:6px 0;">Set your sales tax rate above and Bar Cop tracks the tax you have collected and owe.</div>')
      + (CashEngine.payrollBurden() > 0 ? row('Payroll tax', sa.payrollTax, 'Estimated on ' + App.fmtCurrency(sa.wages) + ' in wages ' + sa.periodLabel, true) : '')
      + (sa.tipsOwed > 0 ? row('Tips held', sa.tipsOwed, 'Pooled tips not yet distributed', true) : '')
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

  wire() {
    const save = document.getElementById('cp-save');
    if (save) save.addEventListener('click', () => {
      CashEngine.setOpeningCash(document.getElementById('cp-cash').value);
      CashEngine.setSalesTaxRate(document.getElementById('cp-tax').value);
      CashEngine.setReserveWeeks(document.getElementById('cp-reserve').value);
      CashEngine.setPayrollBurden(document.getElementById('cp-burden').value);
      this.draw();
    });
    this.container.onclick = ev => {
      if (ev.target.closest('#cp-save')) return;
      const fq = ev.target.closest('.cp-freq');
      if (fq) { CashEngine.setTaxFrequency(fq.dataset.freq); this.draw(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
