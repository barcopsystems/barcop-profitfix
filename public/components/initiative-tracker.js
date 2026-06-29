'use strict';
/* Shared, module-aware experiment tracker. Renders on the Experiments page
   (top-nav), one card per area (Profit / Revenue / Cash). An experiment is the
   operator's OWN change, kept separate from the Fix System (audit-prescribed
   fixes) and the Recovery Scoreboard (recovered dollars). Bar Cop averages the
   eight weeks before the start date against the eight weeks after on the watched
   metric and shows the lift. It reports a metric lift only, never recovered
   dollars, so it never double-counts the Scoreboard. The card is multi-instance
   safe: wire(module, container, rerender) scopes to the passed container, so all
   three areas can live on one page. Data keys stay *_initiatives for back-compat. */
const InitiativeTracker = {

  CONFIG: {
    profit: {
      dataKey: 'profit_initiatives',
      weeks: () => (App.data && App.data.weeks) || [],
      types: ['Pour Spec', 'Vendor Change', 'Portion Control', 'Operational Change', 'Other'],
      metrics: [
        { key: 'pour_pct',  label: 'Bar Pour Cost % (lower is better)', fmt: 'pct', lowerBetter: true },
        { key: 'food_pct',  label: 'Food Cost % (lower is better)',     fmt: 'pct', lowerBetter: true },
        { key: 'prime_pct', label: 'Prime Cost % (lower is better)',    fmt: 'pct', lowerBetter: true }
      ],
      metricFor: (w, key) => {
        if (key === 'pour_pct')  return (w && w.bar  && w.bar.cost_pct  != null) ? Number(w.bar.cost_pct)  : null;
        if (key === 'food_pct')  return (w && w.food && w.food.cost_pct != null) ? Number(w.food.cost_pct) : null;
        if (key === 'prime_pct') return (w && w.prime_cost_pct != null) ? Number(w.prime_cost_pct) : null;
        return null;
      },
      namePh: 'Re-spec well pours',
      hypPh: 'Dropped well pours to 1.25oz Aug 1, expecting pour cost to fall',
      empty: 'No active experiments. Start one when you re-spec a pour, switch a vendor, or tighten portions and want to measure the cost change.'
    },
    revenue: {
      dataKey: 'initiatives',
      weeks: () => (App.data && App.data.revenue_weeks) || [],
      types: ['Menu Change', 'Promotion', 'Service Change', 'Operational Change', 'Other'],
      metrics: [
        { key: 'revenue',   label: 'Total Revenue (weekly)',    fmt: 'currency' },
        { key: 'covers',    label: 'Covers (weekly)',           fmt: 'int' },
        { key: 'check_avg', label: 'Check Average',             fmt: 'currency' },
        { key: 'labor_pct', label: 'Labor % (lower is better)', fmt: 'pct', lowerBetter: true }
      ],
      metricFor: (w, key) => {
        if (key === 'revenue')   return (parseFloat(w.bar_revenue) || 0) + (parseFloat(w.floor_revenue) || 0);
        if (key === 'covers')    return parseFloat(w.covers) || 0;
        if (key === 'check_avg') return parseFloat(w.check_avg) || 0;
        if (key === 'labor_pct') return parseFloat(w.labor_pct_blended) || 0;
        return null;
      },
      namePh: 'New Cocktail Menu',
      hypPh: 'Launched 6 new cocktails Aug 1, expecting a check average lift',
      empty: 'No active experiments. Start one when you launch a new menu item, run a promotion, or make a service change you want to measure.'
    },
    cash: {
      dataKey: 'cash_initiatives',
      // Cash has no raw weekly operational array; its weekly time series is the
      // interpolated cash_audits (each carries a rich `raw` block). Map date ->
      // period_end so the before/after engine slices it like the others.
      weeks: () => ((App.data && App.data.cash_audits) || [])
        .map(a => ({ raw: a.raw || {}, period_end: a.period_end || a.date })),
      types: ['Payment Terms', 'Par / Ordering', 'Dead Stock', 'Operational Change', 'Other'],
      metrics: [
        { key: 'trapped', label: 'Trapped Cash $ (lower is better)',     fmt: 'currency', lowerBetter: true },
        { key: 'cycle',   label: 'Cash Cycle Days (lower is better)',    fmt: 'days',     lowerBetter: true },
        { key: 'runway',  label: 'Runway in weeks (higher is better)',   fmt: 'weeks' }
      ],
      metricFor: (w, key) => {
        const r = (w && w.raw) || {};
        if (key === 'trapped') return r.TRAPPED_CASH != null ? Number(r.TRAPPED_CASH) : null;
        if (key === 'cycle')   return r.CYCLE_DAYS   != null ? Number(r.CYCLE_DAYS)   : null;
        if (key === 'runway')  return r.RUNWAY       != null ? Number(r.RUNWAY)       : null;
        return null;
      },
      namePh: 'Move top vendors to net-30',
      hypPh: 'Negotiated net-30 with the top vendors to hold cash longer and shorten the cash cycle',
      empty: 'No active experiments. Start one when you negotiate vendor terms, cut par levels, or clear dead stock and want to measure the cash change.'
    }
  },

  cfg(module) { return this.CONFIG[module] || this.CONFIG.revenue; },

  list(module) {
    const key = this.cfg(module).dataKey;
    if (!Array.isArray(App.data[key])) App.data[key] = [];
    return App.data[key];
  },

  metric(module, key) {
    return this.cfg(module).metrics.find(m => m.key === key) || null;
  },

  // 8-week-before vs 8-week-after average of the watched metric. The weeks array
  // loads newest-first from the event store, so sort a copy ascending by
  // period_end before the positional slices (event-store ordering gotcha).
  _measure(module, init) {
    const c = this.cfg(module);
    const weeks = (c.weeks() || []).filter(w => w.period_end)
      .slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    const sd = init.start_date;
    if (!sd) return { before: null, after: null, lift: null, weeksAfter: 0 };
    const before = weeks.filter(w => w.period_end < sd).slice(-8);
    const after  = weeks.filter(w => w.period_end >= sd).slice(0, 8);
    const avg = arr => {
      const vals = arr.map(w => c.metricFor(w, init.metric)).filter(v => v != null && !isNaN(v));
      if (!vals.length) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };
    const beforeAvg = avg(before), afterAvg = avg(after);
    const lift = (beforeAvg != null && afterAvg != null) ? (afterAvg - beforeAvg) : null;
    return { before: beforeAvg, after: afterAvg, lift, weeksAfter: after.length };
  },

  _fmtVal(metric, v) {
    if (v == null || isNaN(v)) return '-';
    const f = metric ? metric.fmt : null;
    if (f === 'currency') return App.fmtCurrency(v);
    if (f === 'rating')   return v.toFixed(1) + '★';
    if (f === 'int')      return Math.round(v).toLocaleString('en-US');
    if (f === 'days')     return Math.round(v) + ' days';
    if (f === 'weeks')    return Math.round(v) + ' wk' + (Math.round(v) === 1 ? '' : 's');
    return v.toFixed(1) + '%';
  },

  _fmtLift(metric, lift) {
    if (lift == null) return '<span style="color:var(--t4);">no data yet</span>';
    const lower = metric && metric.lowerBetter;
    const positive = lower ? lift < 0 : lift > 0;
    const color = positive ? 'var(--gold)' : (lift === 0 ? 'var(--t2)' : 'var(--red)');
    const sign = lift > 0 ? '+' : '';   // negatives carry their own minus sign
    const f = metric ? metric.fmt : null;
    let body;
    if (f === 'currency')    body = App.fmtCurrency(lift);
    else if (f === 'rating') body = lift.toFixed(1) + '★';
    else if (f === 'int')    body = Math.round(lift).toLocaleString('en-US');
    else if (f === 'days')   body = Math.round(lift) + ' days';
    else if (f === 'weeks')  body = Math.round(lift) + ' wks';
    else                     body = lift.toFixed(1) + '%';
    return '<span style="color:' + color + ';font-weight:700;">' + sign + body + '</span>';
  },

  card(module) {
    const c = this.cfg(module);
    const all = this.list(module);
    const fmtDate = d => { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const active = all.filter(i => i.status === 'Active');
    const closed = all.filter(i => i.status !== 'Active');

    const activeRows = active.length ? active.map(i => {
      const m = this._measure(module, i);
      const metric = this.metric(module, i.metric);
      const metricLabel = metric ? metric.label : i.metric;
      const windowMsg = m.weeksAfter < 2 ? 'Measuring (week ' + m.weeksAfter + ' of 8)' : m.weeksAfter + ' weeks in';
      return '<div style="border-top:1px solid var(--b2);padding:12px 20px;">'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(i.name) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + esc(i.type || '') + ' &middot; started ' + esc(fmtDate(i.start_date)) + ' &middot; ' + esc(windowMsg) + '</div>'
        + '</div>'
        + (i.hypothesis ? '<div style="font-size:11px;color:var(--t3);margin-top:4px;line-height:1.5;">' + esc(i.hypothesis) + '</div>' : '')
        + '<div style="display:flex;gap:18px;margin-top:8px;flex-wrap:wrap;align-items:baseline;">'
        + '<div style="font-size:11px;color:var(--t3);">Watching: <span style="color:var(--t1);">' + esc(metricLabel) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">Before: <span style="color:var(--t1);">' + this._fmtVal(metric, m.before) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">After: <span style="color:var(--t1);">' + this._fmtVal(metric, m.after) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">Lift: ' + this._fmtLift(metric, m.lift) + '</div>'
        + '<div style="margin-left:auto;display:flex;gap:6px;">'
        + '<button class="btn btn-ghost btn-sm init-complete" data-id="' + esc(i.id) + '" style="font-size:10px;padding:3px 8px;">Mark Complete</button>'
        + '<button class="btn btn-danger btn-sm init-del" data-id="' + esc(i.id) + '" style="font-size:10px;padding:3px 8px;">Delete</button>'
        + '</div></div></div>';
    }).join('') : '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.65;">' + c.empty + '</div>';

    const closedRows = closed.length ? '<div style="padding:8px 20px 4px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);border-top:1px solid var(--b2);">Completed</div>'
      + closed.slice().reverse().slice(0, 5).map(i => {
        const m = this._measure(module, i);
        const metric = this.metric(module, i.metric);
        return '<div style="padding:8px 20px;display:flex;align-items:center;gap:10px;border-top:1px solid var(--b2);font-size:11px;">'
          + '<span style="color:var(--t2);flex:1;">' + esc(i.name) + '</span>'
          + '<span style="color:var(--t3);">' + esc(i.type || '') + '</span>'
          + '<span>' + this._fmtLift(metric, m.lift) + '</span>'
          + '<button class="btn btn-ghost btn-sm init-del" data-id="' + esc(i.id) + '" style="font-size:10px;padding:2px 6px;">Remove</button>'
          + '</div>';
      }).join('') : '';

    return '<div class="card" style="padding:0;overflow:hidden;">'
      + '<div style="padding:14px 20px;display:flex;align-items:center;justify-content:flex-end;">'
      + '<button class="btn btn-ghost btn-sm init-add">+ Start Experiment</button>'
      + '</div>'
      + activeRows + closedRows + '</div>';
  },

  wire(module, container, rerender) {
    const save = this.cfg(module).dataKey;
    container.querySelector('.init-add')?.addEventListener('click', () => this._showForm(module, rerender));
    container.querySelectorAll('.init-complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = this.list(module).find(x => x.id === btn.dataset.id);
        if (!i) return;
        i.status = 'Completed';
        i.completed_at = new Date().toISOString();
        await App.saveKey(save);
        rerender();
      });
    });
    container.querySelectorAll('.init-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirmDelete();
        if (!ok) return;
        App.data[save] = this.list(module).filter(x => x.id !== btn.dataset.id);
        await App.saveKey(save);
        rerender();
      });
    });
  },

  _showForm(module, rerender) {
    const c = this.cfg(module);
    const save = c.dataKey;
    const typeOpts = c.types.map(t => '<option>' + esc(t) + '</option>').join('');
    const metricOpts = c.metrics.map(m => '<option value="' + esc(m.key) + '">' + esc(m.label) + '</option>').join('');
    const today = App.todayLocal();
    const body = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Start Experiment</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Name</label><input type="text" id="init-name" placeholder="' + esc(c.namePh) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Start Date</label><input type="date" id="init-date" value="' + today + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:180px;"><label>Type</label><select id="init-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Watch Metric</label><select id="init-metric">' + metricOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="width:100%;"><label>What you changed (optional)</label><textarea class="notes-ta" id="init-hyp" rows="2" placeholder="' + esc(c.hypPh) + '"></textarea></div>'
      + '<div class="card-actions">'
        + '<button type="button" id="init-save" class="btn btn-primary">Start Experiment</button>'
        + '<button type="button" id="init-cancel" class="btn btn-ghost">Cancel</button>'
        + '<span id="init-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(body, { id: 'init-modal', maxWidth: 540, noClose: true });
    document.getElementById('init-cancel').addEventListener('click', () => App.closeModal('init-modal'));
    document.getElementById('init-save').addEventListener('click', async () => {
      const name = document.getElementById('init-name')?.value.trim();
      const date = document.getElementById('init-date')?.value;
      const err = document.getElementById('init-err');
      const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'inline'; } };
      if (!name) { fail('Name is required.'); return; }
      if (!date) { fail('Start date is required.'); return; }
      this.list(module).push({
        id: App.uid(),
        name,
        start_date: date,
        type: document.getElementById('init-type')?.value || 'Other',
        metric: document.getElementById('init-metric')?.value || c.metrics[0].key,
        hypothesis: document.getElementById('init-hyp')?.value.trim() || '',
        status: 'Active',
        created_at: new Date().toISOString()
      });
      await App.saveKey(save);
      App.closeModal('init-modal');
      rerender();
    });
  }
};
