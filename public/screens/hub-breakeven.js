'use strict';

/* ── Break-Even — "Your Number" (Books section, Hub-level page) ────────────────
   The one number that runs the business: the sales you need to cover your costs,
   and how you're tracking against it. Bar Cop already holds every input, so it
   just draws the line. FIXED costs (the nut) = your recurring operating-expense
   bills. VARIABLE costs = COGS + labor as a share of sales (your real prime-cost
   ratio from S.HubBooks, the same aggregator the Books P&L uses). Break-even =
   nut / (1 - variable rate). Sidebar page, so it uses a plain top stats strip
   (not the landing-only Where You Stand card). Opened from the Hub Break-Even
   tile and the Books sidebar. */

S.HubBreakEven = {
  container: null,
  _wf: null,   // what-if working values

  open() {
    App.openHubFullPage('Break-Even', (mount) => { this.container = mount; this._wf = null; this.render(mount); }, 'breakeven');
  },

  // ── Sidebar-page building blocks (match the Cash Recovery pages) ────────────
  _statItem(label, val, colorStyle) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg"' + (colorStyle ? ' style="' + colorStyle + '"' : '') + '>' + val + '</div></div>';
  },
  _statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  _sh(t, right) {
    return right
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">' + t + '</div>' + right + '</div>'
      : '<div class="sh" style="margin:24px 0 10px;">' + t + '</div>';
  },

  // ── Core computation (shared by the page + the Hub tile) ────────────────────
  _compute() {
    const HB = S.HubBooks;
    const curKey = (HB && HB._currentMonthKey) ? HB._currentMonthKey()
      : (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'));
    const YTD = (HB && HB._aggregateYTD) ? HB._aggregateYTD(curKey) : null;
    const netRev = YTD ? ((YTD.totalRev || 0) - (YTD.compsLoss || 0)) : 0;
    const cogs   = YTD ? (YTD.totalCogs || 0) : 0;
    const labor  = YTD ? (YTD.totalLabor || 0) : 0;
    const varRate = netRev > 0 ? (cogs + labor) / netRev : null;   // prime-cost share

    const opex = (App.data && App.data.operating_expenses) || [];
    const recurring = opex.filter(r => r && r.recurring && !r.recurring_parent);
    const monthlyFixed = recurring.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const weeklyNut = monthlyFixed * 12 / 52;

    const breakEven = (varRate != null && varRate < 1 && weeklyNut > 0) ? weeklyNut / (1 - varRate) : null;

    const weeks = ((App.data && App.data.revenue_weeks) || []).slice()
      .sort((a, b) => String(a.period_end || '').localeCompare(String(b.period_end || '')));
    const salesOf = w => (w.bar_revenue || 0) + (w.floor_revenue || 0);
    const lastWk = weeks[weeks.length - 1] || null;
    const lastSales = lastWk ? salesOf(lastWk) : null;

    return {
      curKey, netRev, cogs, labor, varRate, recurring, monthlyFixed, weeklyNut, breakEven,
      weeks, salesOf, lastWk, lastSales,
      hasOpex: monthlyFixed > 0, hasRev: netRev > 0
    };
  },

  summary() {
    const c = this._compute();
    if (!(c.breakEven > 0) || c.lastSales == null) return { hasData: false };
    const delta = c.lastSales - c.breakEven;
    return { hasData: true, breakEven: c.breakEven, lastSales: c.lastSales, delta, ok: delta >= 0 };
  },

  _breakEvenDay(breakEven, lastSales) {
    if (!(breakEven > 0) || !(lastSales > 0)) return null;
    const days = Math.ceil(breakEven / (lastSales / 7));
    if (days > 7) return { reached: false };
    return { reached: true, label: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][days - 1] };
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    const c = this._compute();
    const f = v => App.fmtCurrency(v, 0);
    const f2 = v => App.fmtCurrency(v);

    if (!c.hasOpex) {
      App.setupCard(mount, {
        title: 'Break-Even',
        lead: 'Break-Even shows the sales you need to cover your costs and how you are tracking against it. It needs your fixed costs first, your recurring bills like rent, insurance, and utilities.',
        steps: [{ title: 'Log your operating expenses', desc: 'Add your recurring monthly bills in Operating Expenses. Those are the nut this number is built on.', btn: 'Operating Expenses', screen: 'operating-expenses', done: false }]
      });
      return;
    }
    if (!c.hasRev) {
      App.setupCard(mount, {
        title: 'Break-Even',
        lead: 'Your fixed costs are set. Break-Even needs a few logged weeks to read your cost structure, what share of every sales dollar goes to product and labor.',
        steps: [{ title: 'Close a few weeks', desc: 'Log your weekly sales and costs so Bar Cop can read your prime cost and draw the line.', btn: 'Close The Week', screen: 'dashboard', done: false }]
      });
      return;
    }
    if (c.breakEven == null) {
      mount.innerHTML = '<div class="screen"><div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">'
        + '<span style="color:var(--red);font-weight:700;">There is no break-even.</span> Your product and labor are eating ' + (c.varRate != null ? (c.varRate * 100).toFixed(0) + '%' : 'all') + ' of every dollar, so no sales number covers the nut. Fix the cost structure in Profit Recovery first.'
        + '</div></div></div>';
      return;
    }

    const wf = this._wf || { sales: Math.round(c.lastSales || c.breakEven || 0), nut: Math.round(c.weeklyNut), rate: +(c.varRate * 100).toFixed(1) };
    this._wf = wf;

    const delta = (c.lastSales != null) ? c.lastSales - c.breakEven : null;
    const beDay = this._breakEvenDay(c.breakEven, c.lastSales);
    const mini = (label, val, color) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (color || 'var(--t1)') + ';">' + val + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';

    // ── 1. Top stats strip (the where-you-stand info, sidebar style) ────────
    const topStrip = this._statsCard(
      this._statItem('Break-Even / Week', f(c.breakEven))
      + this._statItem('Last Week', c.lastSales != null ? f(c.lastSales) : '-')
      + this._statItem(delta != null && delta < 0 ? 'Short By' : 'Cleared By', delta != null ? f(Math.abs(delta)) : '-', delta != null ? (delta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : '')
      + this._statItem('Break-Even Day', beDay ? (beDay.reached ? beDay.label : 'Not reached') : '-', beDay && !beDay.reached ? 'color:var(--red);' : '')
    );
    const readText = (delta == null) ? 'Log a week and Bar Cop shows how you tracked against your break-even.'
      : (delta >= 0 ? 'Last week you did ' + f(c.lastSales) + ' and cleared break-even by ' + f(delta) + '. That is your profit.'
                    : 'Last week you did ' + f(c.lastSales) + ', ' + f(Math.abs(delta)) + ' short of break-even.');
    const readLine = '<div style="font-size:12px;color:var(--t3);margin:12px 2px 18px;line-height:1.6;">' + readText + '</div>';

    // ── 2. What If (up top) ────────────────────────────────────────────────
    const wfInput = (id, label, val, suffix, pre) => '<div class="f" style="width:170px;flex-shrink:0;"><label>' + label + '</label>'
      + '<div class="fw">' + (pre ? '<span class="pre">' + pre + '</span>' : '') + '<input' + (pre ? ' class="pre"' : (suffix ? ' class="suf"' : '')) + ' type="number" id="' + id + '" value="' + val + '" step="' + (suffix ? '0.1' : '100') + '"/>' + (suffix ? '<span class="suf">' + suffix + '</span>' : '') + '</div></div>';
    const whatIfCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">What If</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px;">Move any lever and watch break-even and your profit shift. Nothing here is saved, it is a sandbox.</div>'
      + '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      +   wfInput('be-wf-sales', 'Weekly Sales', wf.sales, '', '$')
      +   wfInput('be-wf-nut', 'Weekly Nut', wf.nut, '', '$')
      +   wfInput('be-wf-rate', 'Variable Rate', wf.rate, '%')
      + '</div>'
      + '<div id="be-wf-out" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);"></div>'
      + '</div>';

    // ── 3. Your Cost Structure (above The Nut) ─────────────────────────────
    const cents = Math.round(c.varRate * 100);
    const structCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Cost Structure</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;">Of every sales dollar, <span style="color:var(--t1);font-weight:700;">' + cents + '&cent;</span> goes to product and labor, leaving <span style="color:var(--green);font-weight:700;">' + (100 - cents) + '&cent;</span> to cover the nut and drop to profit. '
      + 'That leftover is what has to add up to your ' + f(c.weeklyNut) + ' weekly nut before you make a dime.</div>'
      + '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);display:flex;flex-wrap:wrap;">'
      +   mini('COGS', c.netRev ? (c.cogs / c.netRev * 100).toFixed(1) + '%' : '-') + vdiv
      +   mini('Labor', c.netRev ? (c.labor / c.netRev * 100).toFixed(1) + '%' : '-')
      + '</div></div>';

    // ── 4. The Nut (2nd to last) ───────────────────────────────────────────
    const byCat = {};
    c.recurring.forEach(r => { const k = r.category || 'Other'; byCat[k] = (byCat[k] || 0) + (parseFloat(r.amount) || 0); });
    const nutRows = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td><td>' + f2(byCat[k]) + '</td><td class="val">' + f2(byCat[k] * 12 / 52) + '</td></tr>').join('')
      + '<tr><td><div class="val" style="font-weight:700;">Total</div></td><td style="font-weight:700;">' + f2(c.monthlyFixed) + '</td><td class="val" style="font-weight:700;">' + f2(c.weeklyNut) + '</td></tr>';
    const opexBtn = '<button class="btn btn-ghost btn-sm" id="be-opex">Operating Expenses</button>';
    const nutCard = this._sh('The Nut', opexBtn)
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="width:100%;">'
      + '<thead><tr><th>Fixed Cost</th><th>Per Month</th><th>Per Week</th></tr></thead><tbody>' + nutRows + '</tbody></table></div>';

    // ── 5. The Last 8 Weeks (last) ─────────────────────────────────────────
    const recent = c.weeks.slice(-8);
    const trendRows = recent.map(w => {
      const s = c.salesOf(w);
      const d = s - c.breakEven;
      return '<tr><td><div class="val">' + esc(String(w.period_end || '').slice(0, 10)) + '</div></td>'
        + '<td>' + f(s) + '</td><td>' + f(c.breakEven) + '</td>'
        + '<td style="color:' + (d >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;">' + (d >= 0 ? 'Cleared ' + f(d) : 'Short ' + f(Math.abs(d))) + '</td></tr>';
    }).join('');
    const trendCard = this._sh('The Last 8 Weeks')
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="width:100%;">'
      + '<thead><tr><th>Week Ending</th><th>Sales</th><th>Break-Even</th><th>Result</th></tr></thead>'
      + '<tbody>' + (trendRows || '<tr><td colspan="4" style="color:var(--t3);">No weeks logged yet.</td></tr>') + '</tbody></table></div>';

    mount.innerHTML = '<div class="screen">' + topStrip + readLine + whatIfCard + structCard + nutCard + trendCard + '</div>';

    document.getElementById('be-opex')?.addEventListener('click', () => S.HubOperatingExpenses?.open?.());

    const drawWf = () => {
      const sales = parseFloat(document.getElementById('be-wf-sales')?.value) || 0;
      const nut   = parseFloat(document.getElementById('be-wf-nut')?.value) || 0;
      const rate  = (parseFloat(document.getElementById('be-wf-rate')?.value) || 0) / 100;
      this._wf = { sales: Math.round(sales), nut: Math.round(nut), rate: +(rate * 100).toFixed(1) };
      const be = (rate < 1 && nut > 0) ? nut / (1 - rate) : null;
      const profit = (be != null) ? (sales - be) : null;
      const out = document.getElementById('be-wf-out');
      if (!out) return;
      if (be == null) { out.innerHTML = '<div style="font-size:13px;color:var(--red);">At that variable rate there is no break-even, product and labor eat every dollar.</div>'; return; }
      out.innerHTML = '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
        + mini('Break-Even / Week', f(be)) + vdiv
        + mini(profit >= 0 ? 'Profit at That Volume' : 'Shortfall', (profit >= 0 ? '' : '-') + f(Math.abs(profit)), profit >= 0 ? 'var(--green)' : 'var(--red)')
        + '</div>';
    };
    ['be-wf-sales', 'be-wf-nut', 'be-wf-rate'].forEach(id => document.getElementById(id)?.addEventListener('input', drawWf));
    drawWf();
  },

  showHowTo() {
    App.showHelpModal('How Break-Even Works', [
      { p: ['Break-Even is the one number that runs the business: the sales you need each week to cover your costs. Below it you are losing money, above it you are making it. Bar Cop already holds every input, so it just draws the line.'] },
      { h: 'How It Is Built', p: ['Your fixed costs, the nut, are your recurring operating-expense bills like rent, insurance, and utilities, spread to a weekly number. Your variable rate is the share of every sales dollar that goes to product and labor, read from your real logged weeks. Break-even is the nut divided by the dollars left after variable costs. Keep your operating expenses and weekly closes current and the number stays honest.'] },
      { h: 'Tracking Against It', p: ['The strip up top shows last week against the line, cleared it and the amount is your profit, short and that is your gap, plus the day of the week you cross break-even at last week\'s pace. The 8-week table at the bottom shows the streak.'] },
      { h: 'What If', p: ['The what-if is a sandbox. Move your weekly sales, cut the nut, or trim the variable rate and watch break-even and your profit move, so you can see what a price change or a rent cut actually buys you before you commit. Nothing there is saved.'] }
    ]);
  }
};
