'use strict';

/* ── Revenue Recovery — RPLH Tracker ──────────────────────────────────────────
   Revenue-per-labor-hour analysis. Labor hours come from Labor Control
   (lc_actuals, carried on each revenue_weeks record as total_hours). RPLH is
   tracked blended, week over week. Brought to the standard: stat strip → trend
   chart → Optimal Staffing Calculator (form-card) → RPLH History (data-card). */

S.RevenueRPLH = {
  // History range filter (replaces the old hard 12-week cap). Default "All" so
  // nothing is hidden; show-older paginates a long list.
  _histRange: 'all',
  HIST_CHIPS: [
    { v: '4',   label: 'Last 4 Weeks' },
    { v: '12',  label: 'Last 12 Weeks' },
    { v: '26',  label: 'Last 26 Weeks' },
    { v: 'all', label: 'All' }
  ],

  rplhTarget() {
    const t = (App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    return ((t.rplh_lunch || 50) + (t.rplh_dinner || 75) + (t.rplh_bar || 65)) / 3;
  },
  weekRevenue(w) { return (w.bar_revenue || 0) + (w.floor_revenue || 0); },
  weekRPLH(w) {
    if (w.rplh_blended) return w.rplh_blended;
    const rev = this.weekRevenue(w);
    return w.total_hours > 0 ? rev / w.total_hours : null;
  },

  showHowTo() {
    App.showHelpModal('How the RPLH Tracker Works', [
      { p: ['Revenue per labor hour is the cleanest read on how hard your labor dollars work: weekly revenue divided by labor hours, blended across the week. Revenue and hours both come from your saved weeks in This Week, where the hours flow in from Labor Control.'] },
      { h: 'The Numbers', p: ['Blended RPLH is the latest saved week against your target. The 4-Week Average smooths out a single big or slow week.'] },
      { h: 'Optimal Staffing Calculator', p: ['Revenue Forecast pre-fills with next week\'s number from your Revenue Forecast, so you do not retype it; adjust it or the RPLH target to see the labor hours that revenue can support, plus your labor budget cap at your cost-percent target. Use it when you build next week\'s schedule.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    const weeks = (App.data.revenue_weeks || []).filter(w => this.weekRevenue(w) > 0);
    const last = weeks.length ? weeks[weeks.length - 1] : null;
    const prev4 = weeks.slice(-5, -1);
    const avg4 = fn => { const v = prev4.map(fn).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const target = this.rplhTarget();

    const cur = last ? this.weekRPLH(last) : null;
    const avg = avg4(w => this.weekRPLH(w));
    const gap = cur != null ? cur - target : null;

    // ── Stat strip ────────────────────────────────────────────────────────────
    const item = (label, val, sub, color) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    const strip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + item('Blended RPLH', cur != null ? App.fmtCurrency(cur) : '-',
          'target ' + App.fmtCurrency(target) + (gap != null ? ' &middot; ' + (gap >= 0 ? '+' : '') + App.fmtCurrency(gap) + ' vs target' : ''),
          cur == null ? null : (cur >= target ? 'var(--gold)' : 'var(--red)'))
      + item('4-Week Average', avg != null ? App.fmtCurrency(avg) : '-', 'prior 4 weeks', null)
      + item('Revenue This Week', last ? App.fmtCurrency(this.weekRevenue(last)) : '-', last ? 'Week ' + last.week_num : 'no weeks saved', null)
      + item('Labor Hours', last && last.total_hours ? last.total_hours.toFixed(1) : '-', 'from Labor Control', null)
      + '</div></div>';

    // Pre-fill the staffing calculator's Revenue Forecast from next week's
    // Revenue Forecast (the saved record if one exists, else the suggested
    // default) — Bar Cop already calculates it, so the operator never retypes it.
    const nwd = new Date(); nwd.setDate(nwd.getDate() + 7);
    const nextWeekStart = App.weekStartFor(App.ymdLocal(nwd));
    const savedFc = App.forecastForWeek ? App.forecastForWeek(nextWeekStart) : null;
    const fcTotal = savedFc ? (savedFc.total || 0) : ((App.forecastDefaultsFor ? App.forecastDefaultsFor(nextWeekStart).total : 0) || 0);

    // ── Optimal staffing calculator (form-card) ─────────────────────────────────
    const calcHtml = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Optimal Staffing Calculator</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f w-md"><label>Revenue Forecast</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rplh-rev" value="' + (fcTotal > 0 ? Math.round(fcTotal) : '') + '" placeholder="0"/></div></div>'
      + '<div class="f w-md"><label>RPLH Target</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rplh-tgt" value="' + Math.round(target) + '"/></div></div>'
      + '<div class="f w-md"><label>Labor Cost Target %</label><div class="fw"><input class="form-input suf" type="number" id="rplh-pct" value="' + App.laborTargetPct() + '" step="0.5"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rplh-result" style="margin-top:16px;">'
        + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
          + '<div style="display:flex;gap:36px;flex-wrap:wrap;align-items:center;">'
            + '<div class="calc-item"><div class="calc-label">Optimal Hours</div><div class="calc-val lg" id="rplh-opt">-</div></div>'
            + '<div class="calc-item"><div class="calc-label">Max Labor Budget</div><div class="calc-val lg" id="rplh-max">-</div></div>'
          + '</div>'
        + '</div>'
      + '</div></div>';

    // ── RPLH history (data-card + in-app PDF export) ────────────────────────────
    const N = this._histRange === 'all' ? weeks.length : (parseInt(this._histRange) || weeks.length);
    const histAll = weeks.slice(-N).reverse();   // selected range, newest first, no hard cap
    const histRows = histAll.slice(0, App.listLimit('core', 'rplh_history')).map(w => {
      const rplh = this.weekRPLH(w);
      return '<tr><td>Wk ' + w.week_num + '</td>'
        + '<td>' + App.fmtCurrency(this.weekRevenue(w)) + '</td>'
        + '<td>' + (w.total_hours ? w.total_hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + (rplh != null ? App.fmtCurrency(rplh) : '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:var(--t4);text-align:center;padding:22px;">No weeks saved yet. Save a week in This Week to start tracking RPLH.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + strip
      + calcHtml
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + App.filterChips(this._histRange, this.HIST_CHIPS, 'rplh-range-chip') + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="rplh-export">Export PDF</button>'
      + '</div>'
      + '<div id="rplh-hist-export"><div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Week</th><th>Revenue</th><th>Labor Hours</th><th>Blended RPLH</th>'
      + '</tr></thead><tbody>' + histRows + '</tbody></table></div></div></div>'
      + App.showOlderBar('core', 'rplh_history', histAll, this._histRange !== 'all')
      + '</div>';

    const calcResult = () => {
      const rev = parseFloat(document.getElementById('rplh-rev')?.value) || 0;
      const tgt = parseFloat(document.getElementById('rplh-tgt')?.value) || 65;
      const pct = parseFloat(document.getElementById('rplh-pct')?.value) || 32;
      const optEl = document.getElementById('rplh-opt');
      const maxEl = document.getElementById('rplh-max');
      if (!optEl || !maxEl) return;
      // Always shown; reads "-" until a forecast is in the field.
      if (!rev) { optEl.textContent = '-'; maxEl.textContent = '-'; return; }
      optEl.textContent = (rev / tgt).toFixed(1) + ' hrs';
      maxEl.textContent = App.fmtCurrency(rev * (pct / 100));
    };
    ['rplh-rev', 'rplh-tgt', 'rplh-pct'].forEach(id => document.getElementById(id)?.addEventListener('input', calcResult));
    calcResult();   // render immediately (pre-filled forecast shows values; else "-")
    document.getElementById('rplh-export')?.addEventListener('click', () => App.exportPDF({ title: 'RPLH History', root: document.getElementById('rplh-hist-export') || this.container }));
    this.container.querySelectorAll('.rplh-range-chip').forEach(b => b.addEventListener('click', () => { this._histRange = b.dataset.v; this.render(this.container, this.actions); }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.render(this.container, this.actions)));
  }
};
