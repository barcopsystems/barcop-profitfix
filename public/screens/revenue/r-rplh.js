'use strict';

/* ── Revenue Recovery — RPLH Tracker ──────────────────────────────────────────
   Revenue-per-labor-hour analysis. Labor hours come from Labor Control
   (lc_actuals, carried on each revenue_weeks record as total_hours). RPLH is
   tracked blended, week over week. Brought to the standard: stat strip → trend
   chart → Optimal Staffing Calculator (form-card) → RPLH History (data-card). */

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

  showHowTo() {
    App.showHelpModal('How the RPLH Tracker Works', [
      { p: ['Revenue per labor hour is the cleanest read on how hard your labor dollars work: weekly revenue divided by labor hours, blended across the week. Revenue and hours both come from your saved weeks in This Week, where the hours flow in from Labor Control.'] },
      { h: 'The Numbers', p: ['Blended RPLH is the latest saved week against your target. The 4-Week Average smooths out a single big or slow week. The 8-week trend shows the direction, with your target as the dashed line.'] },
      { h: 'Optimal Staffing Calculator', p: ['Enter a revenue forecast and your RPLH target to see the labor hours that revenue can support, plus your labor budget cap at your cost-percent target. Use it when you build next week\'s schedule.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
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

    // ── 8-week blended RPLH trend ───────────────────────────────────────────────
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
        const yTicks = ticks.map(v => '<line x1="' + PAD.l + '" y1="' + ys(v).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ys(v).toFixed(1) + '" stroke="var(--b1)"/><text x="' + (PAD.l - 6) + '" y="' + (ys(v) + 4).toFixed(1) + '" text-anchor="end" fill="var(--t4)" font-family="Barlow,sans-serif" font-size="9">$' + v + '</text>').join('');
        const xLabels = chartWeeks.map((w, i) => '<text x="' + xs(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="var(--t3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + (w.period_end ? w.period_end.slice(5).replace('-', '/') : 'Wk' + w.week_num) + '</text>').join('');
        const tgtLine = '<line x1="' + PAD.l + '" y1="' + ys(target).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ys(target).toFixed(1) + '" stroke="var(--gold)" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>';
        const dots = valid.map(p => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" fill="var(--bg)" stroke="var(--gold)" stroke-width="1.5"/>').join('');
        chartHtml = '<div class="card" style="margin-bottom:16px;">'
          + '<div class="card-title">8-Week Blended RPLH Trend</div>'
          + '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;" preserveAspectRatio="none">'
          + yTicks + tgtLine
          + (line ? '<path d="' + line + '" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' : '')
          + dots + xLabels
          + '</svg></div>';
      }
    }

    // ── Optimal staffing calculator (form-card) ─────────────────────────────────
    const calcHtml = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Optimal Staffing Calculator</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f w-md"><label>Revenue Forecast</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rplh-rev" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>RPLH Target</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rplh-tgt" value="' + Math.round(target) + '"/></div></div>'
      + '<div class="f w-md"><label>Labor Cost Target %</label><div class="fw"><input class="form-input suf" type="number" id="rplh-pct" value="' + App.laborTargetPct() + '" step="0.5"/><span class="suf">%</span></div></div>'
      + '</div><div id="rplh-result"></div></div>';

    // ── RPLH history (data-card + in-app PDF export) ────────────────────────────
    const histRows = weeks.slice().reverse().slice(0, 12).map(w => {
      const rplh = this.weekRPLH(w);
      return '<tr><td>Wk ' + w.week_num + '</td>'
        + '<td>' + App.fmtCurrency(this.weekRevenue(w)) + '</td>'
        + '<td>' + (w.total_hours ? w.total_hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + (rplh != null ? App.fmtCurrency(rplh) : '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:var(--t4);text-align:center;padding:22px;">No weeks saved yet. Save a week in This Week to start tracking RPLH.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + strip
      + chartHtml
      + calcHtml
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">RPLH History</div>'
      + '<button class="btn btn-ghost btn-sm" id="rplh-export">Export PDF</button>'
      + '</div>'
      + '<div id="rplh-hist-export"><div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Week</th><th>Revenue</th><th>Labor Hours</th><th>Blended RPLH</th>'
      + '</tr></thead><tbody>' + histRows + '</tbody></table></div></div></div>'
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
        + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Optimal Hours</div><div style="font-size:20px;font-weight:800;color:var(--gold);">' + optHrs.toFixed(1) + ' hrs</div></div>'
        + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Max Labor Budget</div><div style="font-size:20px;font-weight:800;color:var(--t1);">' + App.fmtCurrency(maxLabor) + '</div></div>'
        + '</div>';
    };
    ['rplh-rev', 'rplh-tgt', 'rplh-pct'].forEach(id => document.getElementById(id)?.addEventListener('input', calcResult));
    document.getElementById('rplh-export')?.addEventListener('click', () => App.exportPDF({ title: 'RPLH History', root: document.getElementById('rplh-hist-export') || this.container }));
  }
};
