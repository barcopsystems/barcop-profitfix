'use strict';

/* ── Cash Recovery — Cash Fix ─────────────────────────────────────────────────
   The four Cash Fix Systems on a leak board, the same shape as the Profit and
   Revenue Fix rails: each system shows where you stand right now and the steps
   to work it. The dollars are honest by construction. Free Trapped Cash and
   Order to Par carry a real figure off your inventory; Stay Ahead shows the
   worst tight week; Pay on Terms has no clean dollar so it reads as a review,
   never an invented number. "Cash Freed to date" up top is the measured drop in
   trapped capital from your own first weeks. Reads CashEngine; writes nothing. */

S.CashFix = {
  _open: null,

  SYSTEMS: [
    {
      id: 'free-trapped', name: 'Free Trapped Inventory Cash',
      summary: 'The biggest lever. Working capital sitting on the shelf in dead stock and overstock instead of in your account. Free it and it is real cash back, this week.',
      compute() { const t = CashEngine.trapped(); const d = t.total; return { hasMetric: t.hasData, dollars: d, band: !t.hasData ? null : d > 1500 ? 'over' : d > 400 ? 'watch' : 'ok', read: t.hasData ? App.fmtCurrency(d, 0) + ' trapped' : 'Take a count to read it' }; },
      stand() { const t = CashEngine.trapped(); return [['Trapped cash', t.hasData ? App.fmtCurrency(t.total, 0) : '-'], ['In dead stock', App.fmtCurrency(t.dead, 0)], ['Above par', App.fmtCurrency(t.overPar, 0)]]; },
      steps: [
        { t: 'Review your dead stock and overstock', go: 'c-trapped' },
        { t: 'Cut the pars that run above your real usage', go: 'ic-par-suggestions' },
        { t: 'Run the dogs down: feature, special, or 86', go: 'ic-report-movers' },
        { t: 'Re-count to confirm the cash came back', go: 'ic-take-inventory' }
      ]
    },
    {
      id: 'order-to-par', name: 'Order to Par, Not to Fear',
      summary: 'Every case you buy ahead of when you need it is cash off your account and onto the shelf. Order to what you actually use, not to a number that feels safe.',
      compute() { const o = CashEngine.overOrder(3); const d = o.excess; const w = o.weeksOnHand; return { hasMetric: o.hasData && d > 0, dollars: d, band: !o.hasData ? null : (w != null && w > 5) ? 'over' : d > 0 ? 'watch' : 'ok', read: o.hasData ? (w != null ? w.toFixed(1) + ' weeks on hand' : 'On par') : 'Take two counts to read it' }; },
      stand() { const o = CashEngine.overOrder(3); const r = CashEngine.reorderToPar(); return [['Weeks on hand', o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) : '-'], ['Tied beyond 3 weeks', o.excess > 0 ? App.fmtCurrency(o.excess, 0) : '$0'], ['Order to par', r.total > 0 ? App.fmtCurrency(r.total, 0) : '-']]; },
      steps: [
        { t: 'Check how many weeks you are carrying', go: 'c-purchasing' },
        { t: 'Tune your pars to your real usage', go: 'ic-par-suggestions' },
        { t: 'Order to par in the Order Sheet', go: 'ic-order-sheet' },
        { t: 'Re-count to confirm it came down', go: 'ic-take-inventory' }
      ]
    },
    {
      id: 'stay-ahead', name: 'Stay Ahead of the Week',
      summary: 'Cash is about timing as much as amount. Line up what is going out against what is coming in two to four weeks ahead, so a heavy week does not catch you short.',
      compute() { const rows = CashEngine.forecast(4); const tight = rows.filter(r => r.net < 0); const worst = tight.length ? Math.min(...tight.map(r => r.net)) : 0; return { hasMetric: tight.length > 0, dollars: Math.abs(worst), band: tight.length === 0 ? 'ok' : tight.length > 1 ? 'over' : 'watch', read: tight.length ? tight.length + ' tight week' + (tight.length === 1 ? '' : 's') + ' ahead' : 'Clear ahead' }; },
      stand() { const rows = CashEngine.forecast(4); const tight = rows.filter(r => r.net < 0); const net = rows.reduce((s, r) => s + r.net, 0); return [['Tight weeks ahead', String(tight.length)], ['This week net', (rows[0] && rows[0].net < 0 ? '-' : '+') + App.fmtCurrency(Math.abs(rows[0] ? rows[0].net : 0), 0)], ['4-week net', (net < 0 ? '-' : '+') + App.fmtCurrency(Math.abs(net), 0)]]; },
      steps: [
        { t: 'Open the Cash Forecast and read the weeks', go: 'c-forecast' },
        { t: 'Spot any week where cash out beats cash in' },
        { t: 'Move a payment to its due date or hold a big order', bills: true },
        { t: 'Confirm the tight week is covered' }
      ]
    },
    {
      id: 'pay-on-terms', name: 'Pay on Terms',
      summary: 'If a vendor gives you net 30, paying on day 5 hands them your cash three weeks early for nothing. Hold it to the due date and take any early-pay discount that beats idle cash.',
      compute() { const tv = CashEngine.termVendors(); return { hasMetric: false, dollars: 0, band: tv.length ? 'ok' : 'watch', read: tv.length ? tv.length + ' vendor' + (tv.length === 1 ? '' : 's') + ' on terms' : 'No vendor terms set' }; },
      stand() { const tv = CashEngine.termVendors(); const all = CashEngine.vendors().length; return [['Vendors on terms', tv.length + ' of ' + all], ['Longest terms', tv.length ? 'Net ' + tv[0].netDays : '-']]; },
      steps: [
        { t: 'Set payment terms on each vendor', go: 'ic-vendors' },
        { t: 'Hold every bill to its due date', bills: true },
        { t: 'Take early-pay discounts that beat idle cash' },
        { t: 'Review your terms each quarter' }
      ]
    }
  ],

  showHowTo() {
    App.showHelpModal('How Cash Fix Works', [
      { p: ['These are your four cash systems, the levers that put liquidity back in your account. Each one shows where you stand right now and the steps to work it. A system is not a checklist you finish; it is a habit you keep, so the numbers read live off your data every time you open this.'] },
      { h: 'Honest Dollars', p: ['Free Trapped Cash and Order to Par carry a real figure straight off your inventory. Stay Ahead shows the worst tight week from your forecast. Pay on Terms has no clean dollar to put on it, so it reads as a review rather than a made-up number. If Bar Cop cannot stand behind a figure, it does not show one.'] },
      { h: 'Cash Freed', p: ['The number up top is what you have actually freed: how far your trapped cash has come down from your own first weeks. It reads off your count history, so it is the real reduction in capital tied up on the shelf, not a projection. It builds as you count.'] }
    ]);
  },

  freedLine() {
    const f = CashEngine.freed();
    if (f.building) {
      return '<div style="font-size:12px;color:var(--t3);">Cash Freed builds here as you count. It is the drop in trapped cash from your first weeks.</div>';
    }
    return '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:40px;font-weight:600;line-height:0.9;color:var(--gold);">' + App.fmtCurrency(f.dollars, 0) + '</span>'
      + '<span style="font-size:13px;color:var(--t2);">cash freed to date</span></div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">trapped cash is down from ' + App.fmtCurrency(f.baseline, 0) + ' in your first weeks to ' + App.fmtCurrency(f.current, 0) + ' now.</div>';
  },

  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (this._open) { this.renderDetail(this._open); return; }

    const BAND = { over: { l: 'Over', c: 'var(--red)' }, watch: { l: 'Watch', c: 'var(--amber)' }, ok: { l: 'On target', c: 'var(--gold)' } };
    const states = this.SYSTEMS.map(s => ({ s, st: s.compute() }));
    const withD = states.filter(x => x.st.hasMetric && x.st.dollars > 0).sort((a, b) => b.st.dollars - a.st.dollars);
    const rest = states.filter(x => !(x.st.hasMetric && x.st.dollars > 0));
    const maxD = withD.length ? withD[0].st.dollars : 0;

    const leakRow = ({ s, st }) => {
      const b = BAND[st.band] || BAND.watch;
      const w = maxD > 0 ? Math.max(8, Math.round(st.dollars / maxD * 100)) : 8;
      return '<div class="cf-sys" data-sys="' + s.id + '" style="cursor:pointer;padding:13px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">'
        + '<div style="display:flex;align-items:center;gap:9px;min-width:0;"><span style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(s.name) + '</span>'
        + '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:' + b.c + ';">' + b.l + '</span></div>'
        + '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;color:' + b.c + ';line-height:1;">' + App.fmtCurrency(st.dollars, 0) + '</div></div>'
        + '<div style="height:7px;background:var(--gold-tint);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + w + '%;background:' + b.c + ';border-radius:4px;"></div></div></div>';
    };
    const flatRow = ({ s, st }) => {
      const b = BAND[st.band] || BAND.watch;
      const right = st.band === 'ok'
        ? '<span style="font-size:11px;font-weight:700;color:var(--gold);">' + esc(st.read) + ' &rsaquo;</span>'
        : '<span style="font-size:11px;color:var(--t3);">' + esc(st.read) + ' &rsaquo;</span>';
      return '<div class="cf-sys" data-sys="' + s.id + '" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);">'
        + '<span style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(s.name) + '</span>' + right + '</div>';
    };

    container.innerHTML = '<div class="screen">'
      + '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Cash Freed</div>' + this.freedLine() + '</div>'
      + '<div class="sh" style="margin:4px 0 8px;">Your Four Cash Systems</div>'
      + '<div class="card" style="padding:2px 16px;">' + withD.map(leakRow).join('') + rest.map(flatRow).join('') + '</div>'
      + '<div style="font-size:11px;color:var(--t4);margin-top:10px;">Tap a system to see where you stand and how to work it.</div>'
      + '</div>';
    this.wire();
  },

  renderDetail(id) {
    const s = this.SYSTEMS.find(x => x.id === id); if (!s) { this._open = null; this.render(this.container, this.actions); return; }
    const st = s.compute();
    const BAND = { over: { l: 'Over', c: 'var(--red)' }, watch: { l: 'Watch', c: 'var(--amber)' }, ok: { l: 'On target', c: 'var(--gold)' } };
    const b = BAND[st.band] || BAND.watch;

    const stand = s.stand().map(([k, v]) =>
      '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--b2);font-size:12px;"><span style="color:var(--t2);">' + esc(k) + '</span><span style="color:var(--t1);font-weight:600;">' + v + '</span></div>').join('');

    const steps = s.steps.map((step, i) => {
      const last = i === s.steps.length - 1;
      const link = step.go || step.bills;
      const circle = '<div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</div>';
      const attr = step.go ? ' data-go="' + esc(step.go) + '"' : (step.bills ? ' data-bills="1"' : '');
      return '<div class="cf-step"' + attr + ' style="display:flex;align-items:center;gap:13px;padding:13px 4px;' + (last ? '' : 'border-bottom:1px solid var(--b2);') + (link ? 'cursor:pointer;' : '') + '">'
        + circle + '<div style="flex:1;min-width:0;font-size:12.5px;color:var(--t1);">' + esc(step.t) + '</div>'
        + (link ? '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>' : '') + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="cf-back" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--t3);margin-bottom:14px;">&lsaquo; Cash Systems</div>'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;"><div style="font-size:19px;font-weight:700;color:var(--t1);">' + esc(s.name) + '</div>'
      + '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:' + b.c + ';">' + b.l + '</span></div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:18px;">' + esc(s.summary) + '</div>'
      + '<div class="sh" style="margin:0 0 6px;">Where You Stand</div>'
      + '<div class="card" style="margin-bottom:18px;">' + stand + '</div>'
      + '<div class="sh" style="margin:0 0 6px;">How to Work It</div>'
      + '<div class="card" style="padding:4px 16px;">' + steps + '</div>'
      + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('.cf-back')) { this._open = null; this.render(this.container, this.actions); return; }
      const bills = ev.target.closest('[data-bills]');
      if (bills) { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.open) S.HubOperatingExpenses.open(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      const sys = ev.target.closest('.cf-sys');
      if (sys) { this._open = sys.dataset.sys; this.render(this.container, this.actions); return; }
    };
  }
};
