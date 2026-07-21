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
      kind: 'profit_initiative',            // core_events kind (row-per-record)
      weeks: () => (App.data && App.data.weeks) || [],
      types: ['Pour Spec', 'Vendor Change', 'Portion Control', 'Operational Change', 'Other'],
      metrics: [
        { key: 'pour_pct',  label: 'Bar Pour Cost %', fmt: 'pct', lowerBetter: true },
        { key: 'food_pct',  label: 'Food Cost %',     fmt: 'pct', lowerBetter: true },
        { key: 'prime_pct', label: 'Prime Cost %',    fmt: 'pct', lowerBetter: true }
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
      kind: 'revenue_initiative',           // core_events kind (row-per-record)
      weeks: () => (App.data && App.data.revenue_weeks) || [],
      types: ['Menu Change', 'Promotion', 'Service Change', 'Operational Change', 'Other'],
      metrics: [
        { key: 'revenue',   label: 'Total Revenue (weekly)',    fmt: 'currency' },
        { key: 'covers',    label: 'Covers (weekly)',           fmt: 'int' },
        { key: 'check_avg', label: 'Check Average',             fmt: 'currency' },
        { key: 'labor_pct', label: 'Labor %', fmt: 'pct', lowerBetter: true }
      ],
      // A partially confirmed week stores null for anything not measured yet, and
      // _measure filters nulls out of the before/after averages. Coercing them to 0
      // here would smuggle a fabricated zero past that filter and drag an
      // experiment's lift toward a result the operator never recorded.
      metricFor: (w, key) => {
        const n = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
        if (key === 'revenue')   return (parseFloat(w.bar_revenue) || 0) + (parseFloat(w.floor_revenue) || 0);
        if (key === 'covers')    return n(w.covers);
        if (key === 'check_avg') return n(w.check_avg);
        if (key === 'labor_pct') return n(w.labor_pct_blended);
        return null;
      },
      namePh: 'New Cocktail Menu',
      hypPh: 'Launched 6 new cocktails Aug 1, expecting a check average lift',
      empty: 'No active experiments. Start one when you launch a new menu item, run a promotion, or make a service change you want to measure.'
    },
    cash: {
      dataKey: 'cash_initiatives',
      kind: 'cash_initiative',              // core_events kind (row-per-record)
      // Cash has no raw weekly operational array; its weekly time series is the
      // interpolated cash_audits (each carries a rich `raw` block). Map date ->
      // period_end so the before/after engine slices it like the others.
      weeks: () => ((App.data && App.data.cash_audits) || [])
        .map(a => ({ raw: a.raw || {}, period_end: a.period_end || a.date })),
      types: ['Payment Terms', 'Par / Ordering', 'Dead Stock', 'Operational Change', 'Other'],
      metrics: [
        { key: 'trapped', label: 'Trapped Cash $',     fmt: 'currency', lowerBetter: true },
        { key: 'cycle',   label: 'Cash Cycle Days',    fmt: 'days',     lowerBetter: true },
        { key: 'runway',  label: 'Runway (weeks)',   fmt: 'weeks' }
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

  // Whether an experiment's measured lift counts as a win for its metric.
  // 'pending' = not enough data yet. Used by the section stat strip.
  outcome(module, init) {
    const m = this._measure(module, init);
    if (m.lift == null) return 'pending';
    if (m.lift === 0) return 'flat';
    const metric = this.metric(module, init.metric);
    const lower = metric && metric.lowerBetter;
    return (lower ? m.lift < 0 : m.lift > 0) ? 'win' : 'loss';
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
    if (f === 'currency')    body = App.fmtBal(lift);   // fmtBal, not fmtCurrency: a losing (negative) lift must read -$123, never the malformed $-123
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
    const active = all.filter(i => i.status === 'Active')
      .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));   // newest change on top
    const closed = all.filter(i => i.status !== 'Active');

    // Active Experiments — a row-list pill table inside the titled card.
    const activeCols = '<colgroup><col style="width:27%"/><col style="width:11%"/><col style="width:12%"/><col style="width:12%"/><col style="width:12%"/><col style="width:26%"/></colgroup>';
    const activeHead = '<thead><tr><th>Active Experiment</th><th>Watching</th><th>Baseline</th><th>So Far</th><th>Lift</th><th></th></tr></thead>';
    const activeBody = active.length ? active.map(i => {
      const m = this._measure(module, i);
      const metric = this.metric(module, i.metric);
      const metricLabel = metric ? metric.label : i.metric;
      const windowMsg = m.weeksAfter < 2 ? 'Measuring (week ' + m.weeksAfter + ' of 8)' : m.weeksAfter + ' weeks in';
      const sub = esc(i.type || '') + ' &middot; started ' + esc(fmtDate(i.start_date)) + ' &middot; ' + esc(windowMsg);
      return '<tr>'
        + '<td><div class="val">' + esc(i.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px;">' + sub + '</div>'
        + (i.hypothesis ? '<div style="font-size:10px;color:var(--t3);margin-top:2px;line-height:1.45;">' + esc(i.hypothesis) + '</div>' : '')
        + '</td>'
        + '<td>' + esc(metricLabel) + '</td>'
        + '<td class="val">' + this._fmtVal(metric, m.before) + '</td>'
        + '<td class="val">' + this._fmtVal(metric, m.after) + '</td>'
        + '<td>' + this._fmtLift(metric, m.lift) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm init-complete" data-id="' + esc(i.id) + '">Complete</button>'
        + '<button class="btn btn-ghost btn-sm init-edit" data-id="' + esc(i.id) + '">Edit</button>'
        + '<button class="btn btn-danger btn-sm init-del" data-id="' + esc(i.id) + '">Delete</button>'
        + '</div></td></tr>';
    }).join('') : '<tr><td colspan="6" style="color:var(--t3);padding:12px 8px;">' + c.empty + '</td></tr>';
    const activeCard = '<div class="card" style="overflow-x:auto;">'
      + '<table class="row-list" style="table-layout:fixed;width:100%;">' + activeCols + activeHead + '<tbody>' + activeBody + '</tbody></table></div>';

    // Start button lives BELOW the card, bottom-left, in gold.
    const startBtn = '<div style="margin:16px 0 24px;"><button class="btn btn-primary init-add">Start Experiment</button></div>';

    // Completed Experiments — its own titled card with a row-list pill table.
    let completedCard = '';
    if (closed.length) {
      const compCols = '<colgroup><col style="width:32%"/><col style="width:12%"/><col style="width:12%"/><col style="width:44%"/></colgroup>';
      // Most-recently-completed first. This was `.reverse()`, which achieved that back when the
      // array was blob insertion-order; the rows load newest-first now, so reversing put the
      // operator's OLDEST experiment at the top. Sort on the real field instead.
      const compBody = closed.slice()
        .sort((a, b) => String((b && b.completed_at) || '').localeCompare(String((a && a.completed_at) || '')))
        .map(i => {
        const m = this._measure(module, i);
        const metric = this.metric(module, i.metric);
        return '<tr>'
          + '<td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td>' + esc(i.type || '') + '</td>'
          + '<td>' + this._fmtLift(metric, m.lift) + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm init-again" data-id="' + esc(i.id) + '">Run Again</button>'
          + '<button class="btn btn-ghost btn-sm init-reopen" data-id="' + esc(i.id) + '">Reopen</button>'
          + '<button class="btn btn-danger btn-sm init-del" data-id="' + esc(i.id) + '">Remove</button>'
          + '</div></td></tr>';
      }).join('');
      completedCard = '<div class="card" style="overflow-x:auto;">'
        + '<table class="row-list" style="table-layout:fixed;width:100%;">' + compCols
        + '<thead><tr><th>Completed Experiment</th><th>Type</th><th>Lift</th><th></th></tr></thead><tbody>' + compBody + '</tbody></table></div>';
    }

    return activeCard + startBtn + completedCard;
  },

  wire(module, container, rerender) {
    const kind = this.cfg(module).kind;
    container.querySelector('.init-add')?.addEventListener('click', () => this._showForm(module, rerender));
    // Edit an active experiment (fix the name, the start date that drives the
    // measurement, the metric, or the note) in the same modal, prefilled.
    container.querySelectorAll('.init-edit').forEach(btn => {
      btn.addEventListener('click', () => this._showForm(module, rerender, { editId: btn.dataset.id }));
    });
    // Run Again: start a fresh experiment prefilled from a completed one.
    container.querySelectorAll('.init-again').forEach(btn => {
      btn.addEventListener('click', () => this._showForm(module, rerender, { seed: this.list(module).find(x => x.id === btn.dataset.id) }));
    });
    // Reopen: send a completed experiment back to Active to keep measuring.
    container.querySelectorAll('.init-reopen').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = this.list(module).find(x => x.id === btn.dataset.id);
        if (!i) return;
        // Live row: putRecord cannot revert it for us (see App.putRecord). restoreRows also puts a
        // DELETED key back, so a refused reactivate does not strip the completion date.
        const undo = App.snapshotRows([i]);
        i.status = 'Active';
        delete i.completed_at;
        if (!(await App.putRecord('core', kind, i))) App.restoreRows(undo);   // row-per-record
        rerender();
      });
    });
    container.querySelectorAll('.init-complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = this.list(module).find(x => x.id === btn.dataset.id);
        if (!i) return;
        const undo = App.snapshotRows([i]);   // live row — putRecord cannot revert it for us
        i.status = 'Completed';
        i.completed_at = new Date().toISOString();
        if (!(await App.putRecord('core', kind, i))) App.restoreRows(undo);   // row-per-record
        rerender();
      });
    });
    container.querySelectorAll('.init-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirmDelete();
        if (!ok) return;
        await App.removeRecord('core', kind, btn.dataset.id);   // row-per-record
        rerender();
      });
    });
  },

  // opts: { editId } edits an existing record in place; { seed } prefills a NEW
  // experiment from a completed one (Run Again); neither = a blank new one.
  _showForm(module, rerender, opts) {
    opts = opts || {};
    const c = this.cfg(module);
    const kind = c.kind;
    const editId = opts.editId || null;
    const src = editId ? this.list(module).find(x => x.id === editId) : (opts.seed || null);
    const today = App.todayLocal();
    // Edit keeps the record's own start date; new and Run Again default to today.
    const v = {
      name: src ? (src.name || '') : '',
      start_date: editId ? ((src && src.start_date) || today) : today,
      type: src ? (src.type || '') : '',
      metric: src ? (src.metric || '') : '',
      hypothesis: src ? (src.hypothesis || '') : ''
    };
    const typeOpts = c.types.map(t => '<option' + (v.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const metricOpts = c.metrics.map(m => '<option value="' + esc(m.key) + '"' + (v.metric === m.key ? ' selected' : '') + '>' + esc(m.label) + '</option>').join('');
    const title = editId ? 'Edit Experiment' : 'Start Experiment';
    const saveLabel = editId ? 'Save Changes' : 'Start Experiment';
    const body = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + title + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Name</label><input type="text" id="init-name" value="' + esc(v.name) + '" placeholder="' + esc(c.namePh) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Start Date</label><input type="date" id="init-date" value="' + esc(v.start_date) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:180px;"><label>Type</label><select id="init-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Watch Metric</label><select id="init-metric">' + metricOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="width:100%;"><label>What you changed (optional)</label><textarea class="notes-ta" id="init-hyp" rows="2" placeholder="' + esc(c.hypPh) + '">' + esc(v.hypothesis) + '</textarea></div>'
      + '<div class="card-actions">'
        + '<button type="button" id="init-save" class="btn btn-primary">' + saveLabel + '</button>'
        + '<span id="init-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(body, { id: 'init-modal', maxWidth: 540 });
    document.getElementById('init-save').addEventListener('click', async () => {
      const name = document.getElementById('init-name')?.value.trim();
      const date = document.getElementById('init-date')?.value;
      const err = document.getElementById('init-err');
      const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'inline'; } };
      if (!name) { fail('Name is required.'); return; }
      if (!date) { fail('Start date is required.'); return; }
      const fields = {
        name,
        start_date: date,
        type: document.getElementById('init-type')?.value || 'Other',
        metric: document.getElementById('init-metric')?.value || c.metrics[0].key,
        hypothesis: document.getElementById('init-hyp')?.value.trim() || ''
      };
      // Row-per-record: build the record (edit merges onto the existing one) and
      // write just that row via putRecord (which also updates the in-memory list).
      let out;
      if (editId) {
        const cur = this.list(module).find(x => x.id === editId);
        if (!cur) { App.closeModal('init-modal'); return; }
        out = Object.assign({}, cur, fields, { updated_at: new Date().toISOString() });
      } else {
        out = Object.assign({ id: App.uid() }, fields, { status: 'Active', created_at: new Date().toISOString() });
      }
      await App.putRecord('core', kind, out);
      App.closeModal('init-modal');
      rerender();
    });
  },

};
