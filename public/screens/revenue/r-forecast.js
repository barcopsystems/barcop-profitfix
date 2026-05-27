'use strict';

/* ── Revenue Recovery — Revenue Forecast (writes revenue_forecasts) ──────────
   One screen, one purpose: set next week's revenue expectation by day so
   Labor Control can build the schedule against a real number instead of a
   guess. Per-day inputs default to a weighted average of the same weekday
   from the last 8 weeks of sc_shifts. Operator overrides any cell. Save
   writes a record keyed by week_start (Monday). The schedule builder and
   weekly confirm screens read from this store. */

S.RevenueForecast = {
  weekStart: null,
  per_day: null,
  defaults: null,
  savedId: null,
  notes: '',

  DAYS: null,    // populated from App.DAYS_MON_FIRST in render

  fmt(n) {
    n = Number(n) || 0;
    return App.fmtCurrency ? App.fmtCurrency(n) : ('$' + Math.round(n).toLocaleString());
  },

  // Pick the default week the screen opens on. If today is Mon-Thu, default
  // to THIS week (operator is mid-week, may still be tuning). If today is
  // Fri-Sun, default to NEXT week (the operator is planning ahead).
  defaultWeekStart() {
    const today = new Date();
    const wd = (today.getDay() + 6) % 7; // 0 = Mon
    const monday = new Date(today.getTime());
    monday.setDate(monday.getDate() - wd);
    if (wd >= 4) monday.setDate(monday.getDate() + 7);
    return monday.toISOString().slice(0, 10);
  },

  hydrate(weekStart) {
    this.DAYS = (App.DAYS_MON_FIRST || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).slice();
    this.weekStart = App.weekStartFor(weekStart) || this.defaultWeekStart();
    this.defaults = App.forecastDefaultsFor(this.weekStart);

    const saved = App.forecastForWeek(this.weekStart);
    if (saved) {
      this.savedId = saved.id;
      this.per_day = {};
      this.DAYS.forEach(d => { this.per_day[d] = saved.per_day && saved.per_day[d] != null ? saved.per_day[d] : 0; });
      this.notes = saved.notes || '';
    } else {
      this.savedId = null;
      this.per_day = Object.assign({}, this.defaults.per_day);
      this.notes = '';
    }
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this.weekStart) this.hydrate();
    this.draw();
  },

  // Pull the matching Sunday period_end's revenue_weeks record for the
  // PRIOR week — shown as a quick reality check against the forecast.
  priorWeekActual() {
    const priorEnd = (() => {
      const d = new Date(this.weekStart + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const weeks = (App.data.revenue_weeks || []).filter(w => w.period_end);
    // last week whose period_end is on or before priorEnd
    const sorted = weeks.slice().sort((a, b) => a.period_end.localeCompare(b.period_end));
    let match = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].period_end <= priorEnd) { match = sorted[i]; break; }
    }
    if (!match) return null;
    return (match.bar_revenue || 0) + (match.floor_revenue || 0);
  },

  dayDate(idx) {
    const d = new Date(this.weekStart + 'T00:00:00');
    d.setDate(d.getDate() + idx);
    return d;
  },

  dayLabel(idx) {
    const d = this.dayDate(idx);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  total() {
    return this.DAYS.reduce((t, d) => t + (parseFloat(this.per_day[d]) || 0), 0);
  },

  rowsHtml() {
    return this.DAYS.map((d, i) => {
      const v = this.per_day[d] || 0;
      const sug = this.defaults.per_day[d] || 0;
      const sugHtml = sug > 0
        ? '<button class="btn btn-ghost btn-sm rf-apply" data-day="' + d + '" data-val="' + sug + '" '
          + 'style="margin-bottom:6px;font-size:10px;letter-spacing:1px;padding:4px 8px;">Use ' + this.fmt(sug) + '</button>'
        : '<div style="font-size:10px;color:var(--t4);padding-bottom:8px;">No history yet</div>';
      return '<div class="rf-row" data-day="' + d + '" '
        + 'style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:10px;border:1px solid var(--b1);border-radius:4px;margin-bottom:6px;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>' + esc(this.dayLabel(i)) + '</label>'
        + '<div style="font-size:10px;color:var(--t4);padding-bottom:8px;">' + esc(d) + '</div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Forecast Revenue</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre rf-val" type="number" min="0" step="0.01" '
        + 'inputmode="decimal" value="' + v + '"/></div></div>'
        + '<div class="f" style="flex:1;min-width:140px;"><label>Suggested</label>'
        + sugHtml + '</div>'
        + '</div>';
    }).join('');
  },

  draw() {
    const prior = this.priorWeekActual();
    const total = this.total();
    const sugTotal = this.defaults.total || 0;
    const periodEnd = App.periodEndFor(this.weekStart);
    const startLabel = (() => {
      const d = new Date(this.weekStart + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    })();

    const priorLine = prior != null
      ? 'Last week ' + this.fmt(prior) + '. ' + (sugTotal > 0 ? 'Suggested total ' + this.fmt(sugTotal) + '.' : '')
      : (sugTotal > 0 ? 'Suggested total ' + this.fmt(sugTotal) + ', based on the last 8 same-weekday weeks.' : 'Not enough shift history yet for an auto-suggestion. Enter your own numbers.');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Week</div>'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="rf-prev" style="margin-bottom:6px;">&laquo; Prior week</button>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Week Starting (Mon)</label>'
      + '<input type="date" id="rf-week" value="' + esc(this.weekStart) + '"/></div>'
      + '<div style="font-size:11px;color:var(--t3);padding-bottom:10px;">'
      + esc(startLabel) + ' through ' + esc(new Date(periodEnd + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="rf-next" style="margin-bottom:6px;">Next week &raquo;</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;">' + esc(priorLine) + '</div>'
      + '</div>'

      + '<div class="card"><div class="card-title">Daily Forecast</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">'
      + 'Set what you expect to bring in each day. The schedule builder reads these numbers when you build next week. '
      + 'Click "Use $X" on a row to drop the same-weekday average straight in.</div>'
      + '<div id="rf-rows">' + this.rowsHtml() + '</div>'
      + (sugTotal > 0
          ? '<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" id="rf-reset">Use Suggested for All Days</button></div>'
          : '')
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Forecast Total</div><div class="calc-val good" id="rf-total">' + this.fmt(total) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Last Week</div><div class="calc-val" id="rf-vsprior">'
      + (prior != null ? (total - prior >= 0 ? '+' : '') + this.fmt(total - prior) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Suggested</div><div class="calc-val" id="rf-vssug">'
      + (sugTotal > 0 ? (total - sugTotal >= 0 ? '+' : '') + this.fmt(total - sugTotal) : '-') + '</div></div>'
      + '</div>'
      + '</div>'

      + '<div class="card"><div class="card-title">Review</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes (optional)</label>'
      + '<textarea id="rf-notes" rows="2" placeholder="Event on Saturday, slow Tuesday, weather looking soft Friday...">' + esc(this.notes) + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="rf-save">' + (this.savedId ? 'Update Forecast' : 'Save Forecast') + '</button>'
      + (this.savedId ? '<button class="btn btn-ghost" id="rf-delete">Delete</button>' : '')
      + '<span id="rf-status" style="font-size:11px;color:var(--gold);margin-left:8px;display:none;">Saved.</span>'
      + '<span id="rf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.wire();
  },

  wire() {
    const rowsEl = document.getElementById('rf-rows');
    rowsEl?.addEventListener('input', () => this.recalc());
    rowsEl?.addEventListener('click', ev => {
      const apply = ev.target.closest('.rf-apply');
      if (!apply) return;
      const day = apply.dataset.day;
      const val = parseFloat(apply.dataset.val) || 0;
      const row = rowsEl.querySelector('.rf-row[data-day="' + day + '"]');
      const inp = row?.querySelector('.rf-val');
      if (inp) inp.value = val;
      this.recalc();
    });
    document.getElementById('rf-reset')?.addEventListener('click', () => {
      this.per_day = Object.assign({}, this.defaults.per_day);
      this.draw();
    });
    document.getElementById('rf-week')?.addEventListener('change', e => {
      this.collect();
      this.hydrate(e.target.value);
      this.draw();
    });
    document.getElementById('rf-prev')?.addEventListener('click', () => this.shiftWeek(-7));
    document.getElementById('rf-next')?.addEventListener('click', () => this.shiftWeek(7));
    document.getElementById('rf-save')?.addEventListener('click', () => this.save());
    document.getElementById('rf-delete')?.addEventListener('click', () => this.confirmDelete());
  },

  shiftWeek(days) {
    const d = new Date(this.weekStart + 'T00:00:00');
    d.setDate(d.getDate() + days);
    this.hydrate(d.toISOString().slice(0, 10));
    this.draw();
  },

  collect() {
    const rows = [...document.querySelectorAll('.rf-row')];
    rows.forEach(r => {
      const day = r.dataset.day;
      const val = parseFloat(r.querySelector('.rf-val')?.value) || 0;
      this.per_day[day] = val;
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
      id:         this.savedId || App.uid(),
      week_start: this.weekStart,
      per_day:    Object.assign({}, this.per_day),
      total:      Math.round(total * 100) / 100,
      method:     method,
      notes:      this.notes || '',
      updated_at: new Date().toISOString()
    };
    if (!this.savedId) rec.created_at = new Date().toISOString();

    if (!Array.isArray(App.data.revenue_forecasts)) App.data.revenue_forecasts = [];
    const list = App.data.revenue_forecasts;
    const snapshot = list.slice();
    if (this.savedId) {
      const i = list.findIndex(x => x.id === this.savedId);
      if (i > -1) list[i] = { ...list[i], ...rec };
      else list.push(rec);
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('rf-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('revenue_forecasts');
    if (btn) btn.disabled = false;
    if (ok) {
      this.savedId = rec.id;
      if (btn) btn.textContent = 'Update Forecast';
      if (status) { status.textContent = 'Saved.'; status.style.display = 'inline'; setTimeout(() => { if (status) status.style.display = 'none'; }, 2500); }
      App.markSetupDone && App.markSetupDone('gs_r_forecast');
    } else {
      App.data.revenue_forecasts = snapshot;
      if (btn) btn.textContent = this.savedId ? 'Update Forecast' : 'Save Forecast';
      fail('Save failed. Try again.');
    }
  },

  confirmDelete() {
    if (!this.savedId) return;
    App.confirm({
      title: 'Delete this forecast?',
      message: 'The schedule builder and weekly screens will fall back to a guess for this week.',
      confirmText: 'Delete',
      cancelText: 'Keep It'
    }).then(ok => { if (ok) this.doDelete(); });
  },

  async doDelete() {
    const list = App.data.revenue_forecasts || [];
    const snapshot = list.slice();
    App.data.revenue_forecasts = list.filter(x => x.id !== this.savedId);
    const ok = await App.saveKey('revenue_forecasts');
    if (ok) {
      this.savedId = null;
      this.per_day = Object.assign({}, this.defaults.per_day);
      this.notes = '';
      this.draw();
    } else {
      App.data.revenue_forecasts = snapshot;
    }
  }
};
