'use strict';

/* ── Recovery Timeline — what to expect, and when ─────────────────────────────
   The journey of a recovery number, so a real user knows what is happening
   (and a demo visitor sees The Anchor's honest arc instead of a finished number
   with no story). Four phases (Diagnose day one, Build weeks 1-4, Measure around
   day 30, Live week 8+), a "you are here" read from the operator's own data, and
   a cost-trend chart with the markers that show exactly when the number turns
   on. Opened as a sub-view (pushView) from the Fix System landing. SVG uses
   literal hex per the SVG-fill rule. */

const RT_GOLD = '#DBAB46';
const RT_RED  = '#C03828';
const RT_GRID = '#16252E';
const RT_STEEL = '#496477';
const RT_DIM  = 'rgba(255,255,255,0.38)';   // = --t3, muted axis labels

S.RecoveryTimeline = {
  PHASES: [
    { key: 'diagnose', name: 'Diagnose', when: 'Day one', desc: 'Upload your POS, run your audits, read your Forecast. You see your opportunity, what is on the table, right away.' },
    { key: 'build',    name: 'Build',    when: 'Weeks 1 to 4', desc: 'Set up and work the systems. Bar Cop watches the disciplines and builds your baseline. No recovery dollars yet, and it tells you so.' },
    { key: 'measure',  name: 'Measure',  when: 'Around day 30', desc: 'Enough data. Your first recovery number shows, up or down, and the Bar Cop Audit unlocks.' },
    { key: 'live',     name: 'Live',     when: 'Week 8 and on', desc: 'The number matures and tracks every week. A slip re-surfaces the system so you catch it.' }
  ],

  startDate(moduleKey) {
    const log = (App.data && Array.isArray(App.data.fix_log) ? App.data.fix_log : [])
      .filter(e => e.module === moduleKey && e.date);
    if (!log.length) return null;
    return log.map(e => String(e.date).slice(0, 10)).sort()[0];
  },
  weeksData() {
    return ((App.data && App.data.weeks) || [])
      .filter(w => w.period_end && w.prime_cost_pct != null)
      .slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
  },
  daysBetween(a, b) {
    return Math.max(0, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000));
  },

  render(container, moduleKey) {
    moduleKey = moduleKey || 'profit';
    this.container = container;
    const B = (window.Recovery && Recovery.BASELINE_WEEKS) || 3;
    const weeks = this.weeksData();
    const start = this.startDate(moduleKey);
    const opWeeks = start ? weeks.filter(w => w.period_end >= start).length : 0;
    const today = App.todayLocal();

    // Current phase from the operator's own data.
    let phase = 'diagnose';
    if (start) phase = opWeeks < B + 1 ? 'build' : opWeeks < 8 ? 'measure' : 'live';

    // ── Phase strip ──
    const strip = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">'
      + this.PHASES.map((p, i) => {
        const on = p.key === phase;
        return '<div style="flex:1 1 150px;min-width:150px;background:' + (on ? 'var(--gold-tint)' : 'var(--surface)') + ';border:1px solid ' + (on ? 'var(--gold-tint-bord)' : 'var(--b-edge)') + ';border-radius:10px;padding:13px 15px;">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;"><span style="width:20px;height:20px;border-radius:50%;background:' + (on ? 'var(--gold)' : 'var(--input)') + ';color:' + (on ? 'var(--bg)' : 'var(--t3)') + ';font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>'
          + '<span style="font-size:13px;font-weight:700;color:var(--t1);">' + p.name + '</span></div>'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';margin-bottom:6px;">' + p.when + '</div>'
          + '<div style="font-size:11px;color:var(--t2);line-height:1.5;">' + p.desc + '</div></div>';
      }).join('') + '</div>';

    // ── You are here ──
    let here;
    if (!start) {
      here = 'You have not started a system yet. Do your first tracked action, a count, a drawer count, a logged comp, and your timeline begins on that day.';
    } else {
      const wks = Math.max(1, Math.round(this.daysBetween(start, today) / 7));
      const next = phase === 'build' ? 'Your recovery number turns on once Bar Cop has a few weeks to measure against, around week 4.'
        : phase === 'measure' ? 'Your first recovery numbers are landing now, up or down, and they firm up over the next few weeks.'
        : 'Your recovery number is live and tracked every week.';
      here = 'You are in the ' + this.PHASES.find(p => p.key === phase).name + ' phase, about ' + wks + ' week' + (wks === 1 ? '' : 's') + ' in. ' + next;
    }
    const hereCard = '<div class="card form-card" style="margin-bottom:18px;">'
      + '<div class="card-title">You Are Here</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">' + here + '</div></div>';

    // ── Recovery-number journey chart ──
    const chart = this.chartCard(start, moduleKey);

    container.innerHTML = '<div class="screen">'
      + strip + hereCard + chart + '</div>';
  },

  // The cumulative recovery number, week by week, for a module: each measured
  // week's gap-vs-baseline dollars, summed across the module's dollarizing cost
  // gaps and accumulated. Empty until a gap clears its baseline (about the first
  // month) which is the whole point: no number during setup, then it builds.
  recoverySeries(moduleKey) {
    if (!window.Recovery) return { points: [], firstMeasure: null };
    const R = window.Recovery;
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.module === moduleKey && e.date
      && R.COMPOSITE_GAPS.indexOf(e.gap_id) === -1 && R.METRICS[e.gap_id]);
    const byWeek = {};
    const B = R.BASELINE_WEEKS;
    mine.forEach(e => {
      const m = R.METRICS[e.gap_id];
      const op = R._series(m.series)
        .filter(w => w.period_end && w.period_end >= e.date && m.value(w) != null)
        .slice().sort((a, b) => a.period_end.localeCompare(b.period_end));
      if (op.length <= B) return;                       // this gap still building
      const bAvg = R._avg(op.slice(0, B).map(m.value));
      if (bAvg == null) return;
      op.slice(B).forEach(w => {
        const v = m.value(w), base = m.base(w);
        if (v == null || base == null) return;
        const imp = m.lowerBetter ? (bAvg - v) : (v - bAvg);
        const d = (m.baseKind === 'pts') ? (imp / 100) * base : imp * base;
        byWeek[w.period_end] = (byWeek[w.period_end] || 0) + d;
      });
    });
    const dates = Object.keys(byWeek).sort();
    let cum = 0;
    const points = dates.map(d => { cum += byWeek[d]; return { d: d, v: cum }; });
    return { points: points, firstMeasure: dates[0] || null };
  },

  chartCard(start, moduleKey) {
    const title = '<div class="sh" style="margin:6px 0 10px;">Your Recovery Number Over Time</div>';
    const series = this.recoverySeries(moduleKey);
    if (!series.points.length) {
      return title + '<div class="card"><div style="font-size:12px;color:var(--t3);line-height:1.6;">No recovery number yet. You are building your baseline. Around day 30, once you have a few solid weeks of real data, your first number lands here, up or down, and it builds from there on your actual numbers.</div></div>';
    }
    // $0 through setup and the baseline; the number turns on at the first measured
    // week. Anchor at the start so the climb reads from zero.
    const firstMeasure = series.firstMeasure;
    const pts = [{ d: start || firstMeasure, v: 0 }].concat(series.points);
    const now = pts[pts.length - 1];

    const dvals = pts.map(p => p.v).concat([0]);
    let lo = Math.min.apply(null, dvals), hi = Math.max.apply(null, dvals);
    const padv = Math.max((hi - lo) * 0.18, 50);
    lo -= padv; hi += padv;

    const W = 680, H = 230, padL = 56, padR = 16, padT = 22, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const t0 = new Date(pts[0].d + 'T00:00:00').getTime();
    const span = Math.max(new Date(now.d + 'T00:00:00').getTime() - t0, 1);
    const x = d => padL + ((new Date(d + 'T00:00:00').getTime() - t0) / span) * plotW;
    const y = v => padT + (1 - (v - lo) / ((hi - lo) || 1)) * plotH;

    // Building zone — setup plus the baseline weeks, before any number.
    const bx0 = x(pts[0].d), bx1 = x(firstMeasure);
    const buildZone = (bx1 - bx0 > 3)
      ? '<rect x="' + bx0.toFixed(1) + '" y="' + padT + '" width="' + (bx1 - bx0).toFixed(1) + '" height="' + plotH + '" fill="rgba(73,100,119,0.14)"/>'
        + '<text x="' + ((bx0 + bx1) / 2).toFixed(1) + '" y="' + (padT - 8).toFixed(1) + '" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing="0.5" fill="' + RT_STEEL + '">BUILDING</text>'
      : '';
    // Zero baseline line.
    const zY = y(0).toFixed(1);
    const zeroLine = '<line x1="' + padL + '" y1="' + zY + '" x2="' + (W - padR) + '" y2="' + zY + '" stroke="' + RT_GRID + '" stroke-width="1"/>'
      + '<text x="' + (padL - 6) + '" y="' + (parseFloat(zY) + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + RT_DIM + '">$0</text>';
    // Recovery line — gold when ending positive, red when net below the start.
    const col = now.v >= 0 ? RT_GOLD : RT_RED;
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(p.d).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    const line = '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    // Now point + value.
    const nx = x(now.d), ny = y(now.v);
    const nowFmt = (now.v < 0 ? '-$' : '$') + Math.abs(Math.round(now.v)).toLocaleString();
    const nowDot = '<circle cx="' + nx.toFixed(1) + '" cy="' + ny.toFixed(1) + '" r="4" fill="' + col + '"/>'
      + '<text x="' + (nx - 6).toFixed(1) + '" y="' + (ny - 9).toFixed(1) + '" text-anchor="end" font-size="12" font-weight="700" fill="' + col + '">' + nowFmt + '</text>';
    // X labels — start date left, Now right.
    const fmtD = d => { const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const xLabels = '<text x="' + bx0.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="start" font-size="9" fill="' + RT_DIM + '">' + fmtD(pts[0].d) + '</text>'
      + '<text x="' + nx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="end" font-size="9" fill="' + RT_DIM + '">Now</text>';

    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;">'
      + buildZone + zeroLine + line + nowDot + xLabels + '</svg>';
    return title + '<div class="card" style="padding:16px;">' + svg + '</div>';
  }
};
