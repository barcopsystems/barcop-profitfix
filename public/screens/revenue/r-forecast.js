'use strict';

/* ── Revenue Recovery — Revenue Forecast (writes revenue_forecasts) ──────────
   Set next week's revenue expectation by day so Labor Control can build the
   schedule against a real number instead of a guess. Per-day inputs default to a
   weighted average of the same weekday from the last 8 weeks of sc_shifts; the
   operator overrides any cell. Save writes a record keyed by week_start (Monday);
   the schedule builder and the weekly confirm read it. Brought to the Control
   entry-page standard: stat strip → week-chip selector → framed grid → Save +
   Start Over below → Forecast Accuracy history. */

S.RevenueForecast = {
  weekStart: null,
  per_day: null,
  covers_per_day: null,
  defaults: null,
  cover_defaults: null,
  savedId: null,
  notes: '',

  DAYS: null,    // populated from App.DAYS_MON_FIRST in hydrate

  fmt(n) {
    n = Number(n) || 0;
    return App.fmtCurrency ? App.fmtCurrency(n) : ('$' + Math.round(n).toLocaleString());
  },

  // Pick the default week the screen opens on. If today is Mon-Thu, default to
  // THIS week (operator is mid-week, may still be tuning). If today is Fri-Sun,
  // default to NEXT week (planning ahead).
  defaultWeekStart() {
    const today = new Date();
    const wd = (today.getDay() + 6) % 7; // 0 = Mon
    const monday = new Date(today.getTime());
    monday.setDate(monday.getDate() - wd);
    if (wd >= 4) monday.setDate(monday.getDate() + 7);
    return App.ymdLocal(monday);
  },

  // The Monday of the current calendar week (for the NOW tag + This Week snap).
  currentWeekMon() {
    const d = new Date();
    const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return App.ymdLocal(d);
  },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  // "Jun 8 - Jun 14" for the Mon-Sun week starting `ws`.
  weekRangeLabel(ws) { return App.dateRangeLabel(ws, App.periodEndFor(ws)); },

  // Same-weekday cover defaults from sc_shifts: SUM covers per date first (a day
  // can run several services), then average the last 8 same-weekday dates —
  // mirrors App.forecastDefaultsFor for revenue, so the suggestion is a per-day
  // total, not a per-shift average.
  _coverDefaults() {
    const shifts = (App.shiftData?.sc_shifts || []).filter(s => s && s.date && s.covers != null);
    const covByDate = {};
    shifts.forEach(s => { covByDate[s.date] = (covByDate[s.date] || 0) + (parseFloat(s.covers) || 0); });
    const start = new Date(this.weekStart + 'T00:00:00');
    const per_day = {};
    let total = 0;
    this.DAYS.forEach((day, idx) => {
      const target = new Date(start.getTime());
      target.setDate(target.getDate() + idx);
      const samples = [];
      for (let back = 1; back <= 8; back++) {
        const probe = new Date(target.getTime());
        probe.setDate(probe.getDate() - back * 7);
        const key = App.ymdLocal(probe);
        if (covByDate[key] != null) samples.push(covByDate[key]);
      }
      let avg = 0;
      if (samples.length) {
        // Newest sample first; weight newer higher (linear), like the revenue defaults.
        let wsum = 0, vsum = 0;
        samples.forEach((v, i) => { const w = samples.length - i; vsum += v * w; wsum += w; });
        avg = wsum > 0 ? Math.round(vsum / wsum) : 0;
      }
      per_day[day] = avg;
      total += avg;
    });
    return { per_day, total };
  },

  hydrate(weekStart) {
    this.DAYS = (App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).slice();
    this.weekStart = App.weekStartFor(weekStart) || this.defaultWeekStart();
    this.defaults = App.forecastDefaultsFor(this.weekStart);
    this.cover_defaults = this._coverDefaults();

    const saved = App.forecastForWeek(this.weekStart);
    if (saved) {
      this.savedId = saved.id;
      this.per_day = {};
      this.covers_per_day = {};
      this.DAYS.forEach(d => {
        this.per_day[d] = saved.per_day && saved.per_day[d] != null ? saved.per_day[d] : 0;
        this.covers_per_day[d] = saved.covers_per_day && saved.covers_per_day[d] != null ? saved.covers_per_day[d] : (this.cover_defaults.per_day[d] || 0);
      });
      // A quick weekly total set from the schedule has no per-day breakdown. Seed
      // the days with an even split so the number shows and saving preserves it;
      // the operator can then refine any day.
      const perSum = this.DAYS.reduce((t, d) => t + (parseFloat(this.per_day[d]) || 0), 0);
      if (perSum === 0 && Number(saved.total) > 0) {
        const each = Math.round((Number(saved.total) / this.DAYS.length) * 100) / 100;
        this.DAYS.forEach(d => { this.per_day[d] = each; });
      }
      this.notes = saved.notes || '';
    } else {
      this.savedId = null;
      this.per_day = Object.assign({}, this.defaults.per_day);
      this.covers_per_day = Object.assign({}, this.cover_defaults.per_day);
      this.notes = '';
    }
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this.weekStart) this.hydrate();
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Revenue Forecast Works', [
      { p: ['Set what you expect to bring in next week, day by day, so Labor Control builds the schedule against a real number instead of a guess. Each day pre-fills from a weighted average of the same weekday over your last eight weeks of shifts; you adjust any day.'] },
      { h: 'The Week Selector', p: ['Each chip shows a week as its date range, for example Jun 8 - Jun 14. Step forward with the arrows to plan ahead, or back to revise; This Week snaps to the current week, tagged NOW. The forecast you save is keyed to the selected week, and both the schedule builder and the weekly confirm read it.'] },
      { h: 'The Numbers', p: ['Forecast Total is the sum of your daily numbers, shown live against your last confirmed week and against the suggested total. Cover Goal Total is the covers you need to hit, not just the dollars, and it feeds the cover target on Build Schedule.'] },
      { h: 'Filling It In', p: ['Use Suggested for All Days drops the same-weekday averages into every row at once; the Use button on a single row fills just that day. Override any number by hand. Start Over resets the week to where it began.'] },
      { h: 'Forecast Accuracy', p: ['Once a week you forecast has its actual confirmed, it lands in the Forecast Accuracy table at the bottom: each row pairs your forecast against the actual, with the gap in dollars and percent. Average Error is how far off you have run across the matched weeks, and Matched Weeks counts how many pairs it has to work with. Export PDF saves the table. Watch it tighten as you learn your room.'] }
    ]);
  },

  // Pull the matching prior week's revenue_weeks actual — a reality check.
  priorWeekActual() {
    const priorEnd = this.addDays(this.weekStart, -1);
    const weeks = (App.data.revenue_weeks || []).filter(w => w.period_end);
    const sorted = weeks.slice().sort((a, b) => a.period_end.localeCompare(b.period_end));
    let match = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if ((sorted[i].period_end || '').slice(0, 10) <= priorEnd) { match = sorted[i]; break; }
    }
    if (!match) return null;
    return (match.bar_revenue || 0) + (match.floor_revenue || 0);
  },

  dayDate(idx) { const d = new Date(this.weekStart + 'T00:00:00'); d.setDate(d.getDate() + idx); return d; },
  dayLabel(idx) { return this.dayDate(idx).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); },
  total() { return this.DAYS.reduce((t, d) => t + (parseFloat(this.per_day[d]) || 0), 0); },
  totalCovers() { return this.DAYS.reduce((t, d) => t + (parseFloat(this.covers_per_day[d]) || 0), 0); },

  // ── Stat strip (the selected week's plan, live) ─────────────────────────────
  heroStrip() {
    const total = this.total();
    const prior = this.priorWeekActual();
    const sugTotal = this.defaults.total || 0;
    const vsPrior = prior != null ? (total - prior >= 0 ? '+' : '') + this.fmt(total - prior) : '-';
    const vsSug = sugTotal > 0 ? (total - sugTotal >= 0 ? '+' : '') + this.fmt(total - sugTotal) : '-';
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + '<div class="calc-item"><div class="calc-label">Forecast Total</div><div class="calc-val lg" id="rf-total">' + this.fmt(total) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Last Confirmed</div><div class="calc-val lg" id="rf-vsprior">' + vsPrior + '</div><div style="font-size:11px;color:var(--t3);margin-top:3px;">' + (prior != null ? 'last confirmed ' + this.fmt(prior) : 'no prior week') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Suggested</div><div class="calc-val lg" id="rf-vssug">' + vsSug + '</div><div style="font-size:11px;color:var(--t3);margin-top:3px;">' + (sugTotal > 0 ? 'suggested ' + this.fmt(sugTotal) : 'no shift history') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Cover Goal Total</div><div class="calc-val lg" id="rf-covertotal">' + this.totalCovers() + '</div></div>'
      + '</div></div>';
  },

  // ── Week selector row — the Close The Week / Profit This Week pill stepper (one
  // pill, arrows outside, gold NOW, This Week snap). Forward is always live here
  // since this plans ahead. The "Use Suggested" action stays on the right. ───────
  selectorRow() {
    const now = this.currentWeekMon();
    const sel = this.weekStart;
    const isCur = sel === now;
    const sugTotal = this.defaults.total || 0;
    const fmt = ymd => { const dt = new Date(ymd + 'T00:00:00'); return isNaN(dt.getTime()) ? ymd : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(sel) + ' - ' + fmt(App.periodEndFor(sel));
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm rf-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = '<button class="btn btn-ghost btn-sm rf-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm rf-wk-now" style="margin-left:4px;">This Week</button>';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>'
      + '<div style="display:flex;gap:8px;">'
      + (sugTotal > 0 ? '<button class="btn btn-ghost btn-sm" id="rf-reset">Use Suggested for All Days</button>' : '')
      + '</div></div>';
  },

  // ── Daily forecast grid (form-card + framed ing-tbl) ────────────────────────
  rowsHtml() {
    // Single-line rows: a sized input with its "Use" suggestion beside it (not
    // stacked below), so the grid stays compact.
    const useBtn = (cls, day, val, label) => val > 0
      ? '<button class="' + cls + '" data-day="' + day + '" data-val="' + val + '" style="background:none;border:none;color:var(--gold);font-size:11px;font-weight:700;letter-spacing:.5px;cursor:pointer;padding:0;white-space:nowrap;flex-shrink:0;">' + label + '</button>'
      : '<span style="font-size:10px;color:var(--t4);white-space:nowrap;flex-shrink:0;">No history</span>';
    return this.DAYS.map((d, i) => {
      const v = this.per_day[d] || 0;
      const cv = this.covers_per_day[d] || 0;
      const sug = this.defaults.per_day[d] || 0;
      const csug = this.cover_defaults.per_day[d] || 0;
      return '<tr class="rf-row" data-day="' + d + '">'
        + '<td data-label=""><div class="val">' + esc(this.dayLabel(i)) + '</div></td>'
        + '<td data-label="Forecast Revenue"><div style="display:flex;align-items:center;gap:10px;">'
        +   '<div class="fw" style="flex:1;max-width:200px;"><span class="pre">$</span><input class="form-input pre rf-val" type="number" min="0" step="0.01" inputmode="decimal" value="' + v + '" style="width:100%;"/></div>'
        +   useBtn('rf-apply', d, sug, '+ Use ' + this.fmt(sug))
        + '</div></td>'
        + '<td data-label="Cover Goal"><div style="display:flex;align-items:center;gap:10px;">'
        +   '<input class="form-input rf-cval" type="number" min="0" inputmode="numeric" value="' + cv + '" style="flex:1;max-width:120px;"/>'
        +   useBtn('rf-capply', d, csug, '+ Use ' + csug)
        + '</div></td>'
        + '</tr>';
    }).join('');
  },
  gridCard() {
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Daily Forecast</div>'
      + '<div class="pill-wrap" style="margin-bottom:6px;">'
      + '<table class="ing-tbl pill" style="table-layout:fixed;"><colgroup><col style="width:160px;"/><col/><col/></colgroup>'
      + '<thead><tr><th>Day</th><th>Forecast Revenue</th><th>Cover Goal</th></tr></thead>'
      + '<tbody id="rf-rows">' + this.rowsHtml() + '</tbody></table></div>'
      + App.noteField({ id: 'rf-notes', value: this.notes, placeholder: 'Optional', mt: 10 })
      + '</div>';
  },

  draw() {
    this.container.innerHTML = '<div class="screen">'
      + this.heroStrip()
      + this.selectorRow()
      + this.gridCard()
      + '<div style="margin:16px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="rf-save">' + (this.savedId ? 'Update Forecast' : 'Save Forecast') + '</button>'
      + '<button class="btn btn-ghost" id="rf-start-over">Start Over</button>'
      + '<span id="rf-status" style="font-size:12px;color:var(--gold);font-weight:700;margin-left:8px;display:none;">Saved.</span>'
      + '<span id="rf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + this.accuracyBlock()
      + '</div>';
    this.wire();
  },

  // ── Forecast accuracy (folded in from the retired Reports and History) ──────
  // Forecasted vs actual per week: pair each saved forecast (keyed by Monday
  // week_start) to the revenue_weeks actual (Sunday period_end). Last 12 matched
  // weeks. On-page data-card + scoped in-app PDF export.
  accuracyPairs() {
    const forecasts = (App.data.revenue_forecasts || []).slice();
    const weeks = (App.data.revenue_weeks || []).slice();
    const pairs = [];
    forecasts.forEach(f => {
      if (!f.week_start || !f.total) return;
      const periodEnd = this.addDays(f.week_start, 6);
      const actual = weeks.find(w => w.period_end && w.period_end.slice(0, 10) === periodEnd);
      if (!actual) return;
      const actualTotal = (parseFloat(actual.bar_revenue) || 0) + (parseFloat(actual.floor_revenue) || 0);
      const gap = actualTotal - f.total;
      const gapPct = f.total > 0 ? (gap / f.total) * 100 : null;
      pairs.push({ week_start: f.week_start, period_end: periodEnd, forecast: f.total, actual: actualTotal, gap, gapPct });
    });
    pairs.sort((a, b) => b.period_end.localeCompare(a.period_end));
    return pairs.slice(0, 12);
  },

  accuracyBlock() {
    const recent = this.accuracyPairs();
    if (!recent.length) return '';
    const sumAbs = recent.reduce((s, p) => s + (p.gapPct != null ? Math.abs(p.gapPct) : 0), 0);
    const avgErr = sumAbs / recent.length;
    const rows = recent.map(p => {
      const cls = p.gap >= 0 ? 'pos' : 'neg';
      return '<tr>'
        + '<td>' + p.period_end + '</td>'
        + '<td>' + this.fmt(p.forecast) + '</td>'
        + '<td class="val">' + this.fmt(p.actual) + '</td>'
        + '<td class="' + cls + '">' + (p.gap >= 0 ? '+' : '') + this.fmt(p.gap) + '</td>'
        + '<td class="' + cls + '">' + (p.gapPct != null ? (p.gapPct >= 0 ? '+' : '') + p.gapPct.toFixed(1) + '%' : '-') + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<div class="sh" style="margin:0;">Forecast Accuracy</div>'
      + '<button class="btn btn-ghost btn-sm" id="rf-export-acc">Export PDF</button>'
      + '</div>'
      + '<div id="rf-acc-export">'
      + '<div class="card" style="margin-top:8px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Average Error</div><div class="calc-val lg">' + avgErr.toFixed(1) + '%</div></div>'
      + '<div class="calc-item"><div class="calc-label">Matched Weeks</div><div class="calc-val lg">' + recent.length + '</div></div>'
      + '</div></div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Last 12 Weeks</th><th>Forecast</th><th>Actual</th><th>Gap $</th><th>Gap %</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  },

  wire() {
    const rowsEl = document.getElementById('rf-rows');
    rowsEl?.addEventListener('input', () => this.recalc());
    rowsEl?.addEventListener('click', ev => {
      const apply = ev.target.closest('.rf-apply');
      const capply = ev.target.closest('.rf-capply');
      if (apply) {
        const row = rowsEl.querySelector('.rf-row[data-day="' + apply.dataset.day + '"]');
        const inp = row?.querySelector('.rf-val');
        if (inp) inp.value = parseFloat(apply.dataset.val) || 0;
        this.recalc();
      } else if (capply) {
        const row = rowsEl.querySelector('.rf-row[data-day="' + capply.dataset.day + '"]');
        const inp = row?.querySelector('.rf-cval');
        if (inp) inp.value = parseFloat(capply.dataset.val) || 0;
        this.recalc();
      }
    });
    this.container.querySelector('.rf-wk-prev')?.addEventListener('click', () => this.gotoWeekStart(this.addDays(this.weekStart, -7)));
    this.container.querySelector('.rf-wk-next')?.addEventListener('click', () => this.gotoWeekStart(this.addDays(this.weekStart, 7)));
    this.container.querySelector('.rf-wk-now')?.addEventListener('click', () => this.gotoWeekStart(this.currentWeekMon()));
    document.getElementById('rf-reset')?.addEventListener('click', () => {
      this.per_day = Object.assign({}, this.defaults.per_day);
      this.covers_per_day = Object.assign({}, this.cover_defaults.per_day);
      this.draw();
    });
    document.getElementById('rf-save')?.addEventListener('click', () => this.save());
    document.getElementById('rf-start-over')?.addEventListener('click', () => this.startOver());
    document.getElementById('rf-export-acc')?.addEventListener('click', () => App.exportPDF({ title: 'Forecast Accuracy', root: document.getElementById('rf-acc-export') || this.container }));
  },

  gotoWeekStart(ws) {
    if (!ws) return;
    this.hydrate(ws);
    this.draw();
  },

  collect() {
    [...document.querySelectorAll('.rf-row')].forEach(r => {
      const day = r.dataset.day;
      this.per_day[day] = parseFloat(r.querySelector('.rf-val')?.value) || 0;
      this.covers_per_day[day] = parseFloat(r.querySelector('.rf-cval')?.value) || 0;
    });
    this.notes = document.getElementById('rf-notes')?.value || '';
  },

  recalc() {
    this.collect();
    const total = this.total();
    const prior = this.priorWeekActual();
    const sugTotal = this.defaults.total || 0;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('rf-total', this.fmt(total));
    set('rf-vsprior', prior != null ? (total - prior >= 0 ? '+' : '') + this.fmt(total - prior) : '-');
    set('rf-vssug', sugTotal > 0 ? (total - sugTotal >= 0 ? '+' : '') + this.fmt(total - sugTotal) : '-');
    set('rf-covertotal', String(this.totalCovers()));
  },

  startOver() {
    App.confirm({ title: 'Start over?', message: this.savedId ? 'This drops your unsaved changes and reloads the saved forecast for this week.' : 'This clears your numbers and re-pulls the suggested forecast for this week.', confirmText: 'Start Over', cancelText: 'Keep' }).then(ok => {
      if (!ok) return;
      this.hydrate(this.weekStart);
      this.draw();
    });
  },

  async save() {
    this.collect();
    const total = this.total();
    const err = document.getElementById('rf-err');
    const status = document.getElementById('rf-status');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) err.style.display = 'none';
    if (status) status.style.display = 'none';
    if (total <= 0) { fail('Enter at least one day before saving.'); return; }

    const sugTotal = this.defaults.total || 0;
    const matchedDefaults = sugTotal > 0 && this.DAYS.every(d => (parseFloat(this.per_day[d]) || 0) === (parseFloat(this.defaults.per_day[d]) || 0));
    const method = matchedDefaults ? 'auto' : 'manual';

    const rec = {
      id:             this.savedId || App.uid(),
      week_start:     this.weekStart,
      per_day:        Object.assign({}, this.per_day),
      covers_per_day: Object.assign({}, this.covers_per_day),
      total:          Math.round(total * 100) / 100,
      total_covers:   this.totalCovers(),
      method:         method,
      notes:          this.notes || '',
      updated_at:     new Date().toISOString()
    };
    if (!this.savedId) rec.created_at = new Date().toISOString();

    if (!Array.isArray(App.data.revenue_forecasts)) App.data.revenue_forecasts = [];
    const list = App.data.revenue_forecasts;
    const snapshot = list.slice();
    if (this.savedId) {
      const i = list.findIndex(x => x.id === this.savedId);
      if (i > -1) list[i] = { ...list[i], ...rec }; else list.push(rec);
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('rf-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('revenue_forecasts');
    if (btn) btn.disabled = false;
    if (ok) {
      const wasNew = !this.savedId;
      this.savedId = rec.id;
      App.markSetupDone && App.markSetupDone('gs_r_forecast');
      // Re-render so the accuracy history reflects the save.
      this.draw();
      const st = document.getElementById('rf-status');
      if (st) { st.textContent = wasNew ? 'Forecast saved.' : 'Forecast updated.'; st.style.display = 'inline'; setTimeout(() => { if (st) st.style.display = 'none'; }, 2500); }
    } else {
      App.data.revenue_forecasts = snapshot;
      if (btn) btn.textContent = this.savedId ? 'Update Forecast' : 'Save Forecast';
      fail('Save failed. Try again.');
    }
  }
};
