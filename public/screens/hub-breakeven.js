'use strict';

/* ── Break-Even — "Your Number" (Books section, Hub-level page) ────────────────
   The one number that runs the business: the sales you need to cover your costs,
   and how you're tracking against it. Bar Cop already holds every input, so it
   just draws the line. FIXED costs (the nut) = your recurring operating-expense
   bills. VARIABLE costs = COGS + labor as a share of sales (your real prime-cost
   ratio from S.HubBooks, the same aggregator the Books P&L uses). Break-even =
   nut / (1 - variable rate). Everything downstream (this-week tracking, the
   break-even day, the 8-week trend, the what-if) reads off those. Nothing new to
   enter. Opened from the Hub Break-Even tile and the Books sidebar. */

S.HubBreakEven = {
  container: null,
  _wf: null,   // what-if working values

  open() {
    App.openHubFullPage('Break-Even', (mount) => { this.container = mount; this._wf = null; this.render(mount); }, 'breakeven');
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

    // Fixed nut: the recurring operating-expense bills, monthly -> weekly.
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

  // Compact read for the Hub tile.
  summary() {
    const c = this._compute();
    if (!(c.breakEven > 0) || c.lastSales == null) return { hasData: false };
    const delta = c.lastSales - c.breakEven;
    return { hasData: true, breakEven: c.breakEven, lastSales: c.lastSales, delta, ok: delta >= 0 };
  },

  // Which day of the Mon-Sun week you cross break-even, at last week's pace.
  _breakEvenDay(breakEven, lastSales) {
    if (!(breakEven > 0) || !(lastSales > 0)) return null;
    const perDay = lastSales / 7;
    const days = Math.ceil(breakEven / perDay);
    if (days > 7) return { reached: false };
    return { reached: true, label: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][days - 1], days };
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    const c = this._compute();
    const f = v => App.fmtCurrency(v, 0);
    const f2 = v => App.fmtCurrency(v);

    // ── Day-one / can't-compute states ─────────────────────────────────────
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

    const wf = this._wf || { sales: Math.round(c.lastSales || c.breakEven || 0), nut: Math.round(c.weeklyNut), rate: +(c.varRate * 100).toFixed(1) };
    this._wf = wf;

    // ── Cost structure eats every dollar: no break-even exists ─────────────
    if (c.breakEven == null) {
      mount.innerHTML = '<div class="screen">'
        + '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Break-Even</div>'
        + '<div style="padding:2px 0;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:40px;font-weight:600;line-height:0.9;color:var(--red);">No break-even</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:8px;line-height:1.6;">Your product and labor are eating ' + (c.varRate != null ? (c.varRate * 100).toFixed(0) + '%' : 'all') + ' of every dollar. There is no sales number that breaks even until you fix the cost structure. Start in Profit Recovery.</div></div>'
        + '</div></div>';
      return;
    }

    const delta = (c.lastSales != null) ? c.lastSales - c.breakEven : null;
    const beDay = this._breakEvenDay(c.breakEven, c.lastSales);

    // ── Where You Stand (hero + secondary strip, Books style) ──────────────
    const mini = (label, val, color) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (color || 'var(--t1)') + ';">' + val + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';

    const readLine = (delta == null)
      ? 'Log a week and Bar Cop shows how you tracked against it.'
      : (delta >= 0
        ? 'Last week you did ' + f(c.lastSales) + '. You cleared break-even by <span style="color:var(--green);font-weight:700;">' + f(delta) + '</span>, that is your profit.'
        : 'Last week you did ' + f(c.lastSales) + '. You came up <span style="color:var(--red);font-weight:700;">' + f(Math.abs(delta)) + '</span> short of break-even.');

    const heroCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Where You Stand</div>'
      + '<div style="padding:2px 0;"><div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--t1);">' + f(c.breakEven) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">in weekly sales to break even</span></div></div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:10px;line-height:1.6;">' + readLine + '</div>'
      + '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Your Structure</div>'
      +   '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +     mini('The Nut / Week', f(c.weeklyNut)) + vdiv
      +     mini('Variable Rate', (c.varRate * 100).toFixed(1) + '%') + vdiv
      +     mini('Break-Even Day', beDay ? (beDay.reached ? beDay.label : 'Not in the week') : '-', beDay && !beDay.reached ? 'var(--red)' : 'var(--t1)')
      +   '</div>'
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-act="operating-expenses">Operating Expenses</button></div></div>';

    // ── The Nut breakdown ──────────────────────────────────────────────────
    const byCat = {};
    c.recurring.forEach(r => { const k = r.category || 'Other'; byCat[k] = (byCat[k] || 0) + (parseFloat(r.amount) || 0); });
    const nutRows = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + f2(byCat[k]) + '</td>'
      + '<td class="val">' + f2(byCat[k] * 12 / 52) + '</td></tr>').join('');
    const nutCard = '<div class="sh" style="margin:24px 0 10px;">The Nut</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl">'
      + '<thead><tr><th>Fixed Cost</th><th>Per Month</th><th>Per Week</th></tr></thead>'
      + '<tbody>' + nutRows
      + '<tr><td><div class="val" style="font-weight:700;">Total</div></td><td style="font-weight:700;">' + f2(c.monthlyFixed) + '</td><td class="val" style="font-weight:700;">' + f2(c.weeklyNut) + '</td></tr>'
      + '</tbody></table></div></div>';

    // ── Cost structure read ────────────────────────────────────────────────
    const cents = Math.round(c.varRate * 100);
    const structCard = '<div class="card form-card" style="margin:16px 0;"><div class="card-title">Your Cost Structure</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;">Of every sales dollar, <span style="color:var(--t1);font-weight:700;">' + cents + '&cent;</span> goes to product and labor, leaving <span style="color:var(--green);font-weight:700;">' + (100 - cents) + '&cent;</span> to cover the nut and drop to profit. '
      + 'That leftover is what has to add up to your ' + f(c.weeklyNut) + ' weekly nut before you make a dime.</div>'
      + '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);display:flex;flex-wrap:wrap;">'
      +   mini('COGS', c.netRev ? (c.cogs / c.netRev * 100).toFixed(1) + '%' : '-') + vdiv
      +   mini('Labor', c.netRev ? (c.labor / c.netRev * 100).toFixed(1) + '%' : '-')
      + '</div></div>';

    // ── 8-week trend ───────────────────────────────────────────────────────
    const recent = c.weeks.slice(-8);
    const trendRows = recent.map(w => {
      const s = c.salesOf(w);
      const d = s - c.breakEven;
      const end = String(w.period_end || '').slice(0, 10);
      return '<tr><td><div class="val">' + esc(end) + '</div></td>'
        + '<td>' + f(s) + '</td>'
        + '<td>' + f(c.breakEven) + '</td>'
        + '<td style="color:' + (d >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;">' + (d >= 0 ? 'Cleared ' + f(d) : 'Short ' + f(Math.abs(d))) + '</td></tr>';
    }).join('');
    const trendCard = '<div class="sh" style="margin:24px 0 10px;">The Last 8 Weeks</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl">'
      + '<thead><tr><th>Week Ending</th><th>Sales</th><th>Break-Even</th><th>Result</th></tr></thead>'
      + '<tbody>' + (trendRows || '<tr><td colspan="4" style="color:var(--t3);">No weeks logged yet.</td></tr>') + '</tbody></table></div></div>';

    // ── What-if simulator ──────────────────────────────────────────────────
    const wfInput = (id, label, val, suffix, pre) => '<div class="f" style="width:170px;flex-shrink:0;"><label>' + label + '</label>'
      + '<div class="fw">' + (pre ? '<span class="pre">' + pre + '</span>' : '') + '<input' + (pre ? ' class="pre"' : (suffix ? ' class="suf"' : '')) + ' type="number" id="' + id + '" value="' + val + '" step="' + (suffix ? '0.1' : '100') + '"/>' + (suffix ? '<span class="suf">' + suffix + '</span>' : '') + '</div></div>';
    const whatIfCard = '<div class="card form-card" style="margin:16px 0;"><div class="card-title">What If</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px;">Move any lever and watch break-even and your profit shift. Nothing here is saved, it is a sandbox.</div>'
      + '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      +   wfInput('be-wf-sales', 'Weekly Sales', wf.sales, '', '$')
      +   wfInput('be-wf-nut', 'Weekly Nut', wf.nut, '', '$')
      +   wfInput('be-wf-rate', 'Variable Rate', wf.rate, '%')
      + '</div>'
      + '<div id="be-wf-out" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);"></div>'
      + '</div>';

    mount.innerHTML = '<div class="screen">' + heroCard + nutCard + structCard + trendCard + whatIfCard + '</div>';

    // Operating Expenses deep-link (Books action).
    mount.querySelector('[data-act="operating-expenses"]')?.addEventListener('click', () => S.HubOperatingExpenses?.open?.());

    // What-if live recompute.
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
      { h: 'Tracking Against It', p: ['Where You Stand shows last week against the line, cleared it and the amount is your profit, short and that is your gap. The break-even day is which day of the week you stop losing and start earning at last week\'s pace. The 8-week trend shows the streak.'] },
      { h: 'What If', p: ['The what-if is a sandbox. Move your weekly sales, cut the nut, or trim the variable rate and watch break-even and your profit move, so you can see what a price change or a rent cut actually buys you before you commit. Nothing there is saved.'] }
    ]);
  }
};
