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
const RT_TXT  = '#9FB0BC';
const RT_DIM  = '#5E6E78';

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
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;"><span style="width:20px;height:20px;border-radius:50%;background:' + (on ? 'var(--gold)' : 'var(--input)') + ';color:' + (on ? '#0B0F14' : 'var(--t3)') + ';font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>'
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
    const hereCard = '<div class="card form-card" style="margin-bottom:18px;border-color:var(--gold-tint-bord);background:var(--gold-tint);">'
      + '<div class="card-title" style="color:var(--gold);">You Are Here</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">' + here + '</div></div>';

    // ── Cost-trend chart ──
    const chart = this.chartCard(weeks, start, B);

    container.innerHTML = '<div class="screen">'
      + strip + hereCard + chart + '</div>';
  },

  chartCard(weeks, start, B) {
    // Zoom to the recovery window: from the day the system started through now.
    // That is the stretch the recovery number actually measures, so showing only
    // it keeps the story readable (where you started, where you are) instead of
    // cramming a year of pre-start history into a sliver on the right.
    let data, baseN, titleText;
    if (start) {
      const win = weeks.filter(w => w.period_end >= start);
      data = win.map(w => ({ d: w.period_end, v: w.prime_cost_pct }));
      baseN = Math.min(B, data.length);
      titleText = 'Prime Cost Since You Started';
    } else {
      data = weeks.slice(-12).map(w => ({ d: w.period_end, v: w.prime_cost_pct }));
      baseN = 0;
      titleText = 'Prime Cost, Recent Weeks';
    }
    const title = '<div class="sh" style="margin:6px 0 10px;">' + titleText + '</div>';
    if (data.length < 2) {
      return title + '<div class="card"><div style="font-size:12px;color:var(--t3);line-height:1.6;">Your trend fills in here as you confirm weeks in This Week. Once you have a couple of weeks, you will see where you started and where you are now against your target.</div></div>';
    }

    const target = (App.data.settings && App.data.settings.targets && App.data.settings.targets.prime_cost_pct) ?? 60;
    const vals = data.map(p => p.v).concat([target]);
    const ymin = Math.floor(Math.min.apply(null, vals) - 2);
    const ymax = Math.ceil(Math.max.apply(null, vals) + 2);
    const W = 680, H = 230, padL = 40, padR = 16, padT = 24, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = data.length;
    const x = i => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = v => padT + (1 - (v - ymin) / (ymax - ymin || 1)) * plotH;

    // Baseline band — your own first weeks, the starting point recovery measures
    // against. One label, far left, so nothing overlaps.
    let baseBand = '';
    if (baseN >= 1) {
      const x0 = x(0), x1 = x(Math.min(baseN, n) - 1), bw = Math.max(x1 - x0, 3);
      baseBand = '<rect x="' + x0.toFixed(1) + '" y="' + padT + '" width="' + bw.toFixed(1) + '" height="' + plotH + '" fill="rgba(73,100,119,0.16)"/>'
        + '<text x="' + (x0 + bw / 2).toFixed(1) + '" y="' + (padT - 8).toFixed(1) + '" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing="0.5" fill="' + RT_STEEL + '">BASELINE</text>';
    }
    // Target line
    const tY = y(target).toFixed(1);
    const targetLine = '<line x1="' + padL + '" y1="' + tY + '" x2="' + (W - padR) + '" y2="' + tY + '" stroke="' + RT_STEEL + '" stroke-width="1" stroke-dasharray="4,4"/>'
      + '<text x="' + (W - padR) + '" y="' + (parseFloat(tY) - 4).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + RT_DIM + '">target ' + target + '%</text>';
    // The line itself — clean, no per-week dots.
    const path = data.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    const line = '<path d="' + path + '" fill="none" stroke="' + RT_GOLD + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    // Only two dots: where you started, and where you are now (with the value).
    const sx = x(0), sy = y(data[0].v), nx = x(n - 1), ny = y(data[n - 1].v);
    const startDot = '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="3" fill="' + RT_GOLD + '"/>';
    const nowDot = '<circle cx="' + nx.toFixed(1) + '" cy="' + ny.toFixed(1) + '" r="4" fill="' + RT_GOLD + '"/>'
      + '<text x="' + (nx - 6).toFixed(1) + '" y="' + (ny - 9).toFixed(1) + '" text-anchor="end" font-size="11" font-weight="700" fill="' + RT_GOLD + '">' + data[n - 1].v.toFixed(1) + '%</text>';
    // X labels: start date on the left, "Now" on the right.
    const fmtD = d => { const dt = new Date(d + 'T00:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const xLabels = '<text x="' + sx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="start" font-size="9" fill="' + RT_DIM + '">' + fmtD(data[0].d) + '</text>'
      + '<text x="' + nx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="end" font-size="9" fill="' + RT_DIM + '">Now</text>';
    // Y labels
    const yLabels = '<text x="' + (padL - 6) + '" y="' + (y(ymax) + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + RT_DIM + '">' + ymax + '%</text>'
      + '<text x="' + (padL - 6) + '" y="' + (y(ymin) + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + RT_DIM + '">' + ymin + '%</text>';

    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;">'
      + baseBand + targetLine + line + startDot + nowDot + xLabels + yLabels + '</svg>';
    return title + '<div class="card" style="padding:16px;">' + svg + '</div>';
  }
};
