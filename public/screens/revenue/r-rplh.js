'use strict';

/* ── Revenue Recovery — RPLH Tracker ──────────────────────────────────────────
   Revenue-per-labor-hour analysis. Restructured per the platform map: labor
   hours come from Labor Control (lc_actuals, carried on each revenue_weeks
   record as total_hours). The daypart breakdown is retired with the This Week
   wizard — RPLH is now tracked blended, week over week. */

S.RevenueRPLH = {
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

  render(container, actions) {
    if (actions) actions.innerHTML = '';
    const weeks = (App.data.revenue_weeks || []).filter(w => this.weekRevenue(w) > 0);
    const last = weeks.length ? weeks[weeks.length - 1] : null;
    const prev4 = weeks.slice(-5, -1);
    const avg4 = fn => { const v = prev4.map(fn).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const target = this.rplhTarget();

    const cur = last ? this.weekRPLH(last) : null;
    const avg = avg4(w => this.weekRPLH(w));
    const gap = cur != null ? cur - target : null;

    const metricCard = (label, valHtml, sub, impact, impactCls) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + sub + '</div>'
      + '<div class="metric-impact ' + (impactCls || '') + '">' + (impact || ' ') + '</div>'
      + '<div class="metric-trend"> </div></div>';
    const mv = (txt, cls) => '<div class="metric-val ' + (cls || '') + '">' + txt + '</div>';

    const cards =
        metricCard('Blended RPLH',
          mv(cur != null ? App.fmtCurrency(cur) : ' ', cur == null ? '' : cur >= target ? 'on-target' : 'over-target'),
          'Target: ' + App.fmtCurrency(target),
          gap != null ? (gap >= 0 ? '+' : '') + App.fmtCurrency(gap) + ' vs target' : '',
          gap == null ? '' : gap >= 0 ? 'pos' : 'neg')
      + metricCard('4-Week Average',
          mv(avg != null ? App.fmtCurrency(avg) : ' '),
          'Prior 4 weeks', '', '')
      + metricCard('Revenue This Week',
          mv(last ? App.fmtCurrency(this.weekRevenue(last)) : ' '),
          last ? 'Week ' + last.week_num : 'No weeks saved', '', '')
      + metricCard('Labor Hours',
          mv(last && last.total_hours ? last.total_hours.toFixed(1) : ' '),
          'From Labor Control', '', '');

    // 8-week blended RPLH trend
    const chartWeeks = weeks.slice(-8);
    let chartHtml = '';
    if (chartWeeks.length >= 2) {
      const W = 800, H = 220, PAD = { t: 28, r: 60, b: 40, l: 48 };
      const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b;
      const vals = chartWeeks.map(w => this.weekRPLH(w));
      const present = vals.filter(v => v != null);
      if (present.length) {
        const minY = Math.max(0, Math.floor(Math.min(...present, target) - 8));
        const maxY = Math.ceil(Math.max(...present, target) + 8);
        const xs = i => PAD.l + (i / (chartWeeks.length - 1)) * cw;
        const ys = v => PAD.t + ch - ((v - minY) / (maxY - minY)) * ch;
        const valid = vals.map((v, i) => v != null ? { x: xs(i), y: ys(v) } : null).filter(Boolean);
        let line = '';
        if (valid.length >= 2) {
          line = 'M' + valid[0].x.toFixed(1) + ',' + valid[0].y.toFixed(1);
          for (let i = 1; i < valid.length; i++) {
            const cp = (valid[i].x - valid[i - 1].x) * 0.35;
            line += ' C' + (valid[i - 1].x + cp).toFixed(1) + ',' + valid[i - 1].y.toFixed(1)
              + ' ' + (valid[i].x - cp).toFixed(1) + ',' + valid[i].y.toFixed(1)
              + ' ' + valid[i].x.toFixed(1) + ',' + valid[i].y.toFixed(1);
          }
        }
        const range = maxY - minY, tickStep = range <= 20 ? 4 : range <= 40 ? 8 : 12;
        const ticks = []; for (let v = Math.ceil(minY / tickStep) * tickStep; v <= maxY; v += tickStep) ticks.push(v);
        const yTicks = ticks.map(v => '<line x1="' + PAD.l + '" y1="' + ys(v).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ys(v).toFixed(1) + '" stroke="rgba(255,255,255,0.04)"/><text x="' + (PAD.l - 6) + '" y="' + (ys(v) + 4).toFixed(1) + '" text-anchor="end" fill="var(--t4)" font-family="Barlow,sans-serif" font-size="9">$' + v + '</text>').join('');
        const xLabels = chartWeeks.map((w, i) => '<text x="' + xs(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + (w.period_end ? w.period_end.slice(5).replace('-', '/') : 'Wk' + w.week_num) + '</text>').join('');
        const tgtLine = '<line x1="' + PAD.l + '" y1="' + ys(target).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ys(target).toFixed(1) + '" stroke="#C9A84C" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>';
        const dots = valid.map(p => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="#070E15" stroke="#C9A84C" stroke-width="1.5"/>').join('');
        chartHtml = '<div class="chart-card" style="padding:20px 24px 16px;margin-top:16px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:16px;">8-Week Blended RPLH Trend</div>'
          + '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;" preserveAspectRatio="none">'
          + yTicks + tgtLine
          + (line ? '<path d="' + line + '" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' : '')
          + dots + xLabels
          + '</svg></div>';
      }
    }

    // Optimal staffing calculator
    const t = (App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    const calcHtml = '<div class="card" style="margin-top:16px;">'
      + '<div class="sh">Optimal Staffing Calculator</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Revenue Forecast</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rplh-rev" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>RPLH Target</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rplh-tgt" value="' + Math.round(target) + '"/></div></div>'
      + '<div class="f w-md"><label>Labor Cost Target %</label><div class="fw"><input class="suf" type="number" id="rplh-pct" value="' + (t.floor_labor_pct || 32) + '" step="0.5"/><span class="suf">%</span></div></div>'
      + '</div><div id="rplh-result"></div></div>';

    const histRows = weeks.slice().reverse().slice(0, 12).map(w => {
      const rplh = this.weekRPLH(w);
      return '<tr><td>Wk ' + w.week_num + '</td>'
        + '<td>' + App.fmtCurrency(this.weekRevenue(w)) + '</td>'
        + '<td>' + (w.total_hours ? w.total_hours.toFixed(1) : ' ') + '</td>'
        + '<td class="val">' + (rplh != null ? App.fmtCurrency(rplh) : ' ') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + chartHtml
      + calcHtml
      + '<div class="sh" style="margin-top:16px;">RPLH History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Revenue</th><th>Labor Hours</th><th>Blended RPLH</th></tr></thead><tbody>' + histRows + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
      + 'Labor hours are sourced from Labor Control. RPLH is weekly revenue divided by labor hours.</div>'
      + '</div>';

    const calcResult = () => {
      const rev = parseFloat(document.getElementById('rplh-rev')?.value) || 0;
      const tgt = parseFloat(document.getElementById('rplh-tgt')?.value) || 65;
      const pct = parseFloat(document.getElementById('rplh-pct')?.value) || 32;
      const el = document.getElementById('rplh-result');
      if (!el || !rev) { if (el) el.innerHTML = ''; return; }
      const optHrs = rev / tgt;
      const maxLabor = rev * (pct / 100);
      el.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Optimal Hours</div><div style="font-size:20px;font-weight:800;color:var(--gold);">' + optHrs.toFixed(1) + ' hrs</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Max Labor Budget</div><div style="font-size:20px;font-weight:800;color:var(--t1);">' + App.fmtCurrency(maxLabor) + '</div></div>'
        + '</div>';
    };
    ['rplh-rev', 'rplh-tgt', 'rplh-pct'].forEach(id => document.getElementById(id)?.addEventListener('input', calcResult));
  }
};
