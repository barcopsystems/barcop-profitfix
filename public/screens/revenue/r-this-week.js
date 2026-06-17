'use strict';

/* ── Revenue Recovery — This Week (weekly confirm + history) ──────────────────
   Brought to the Control entry-page standard (Build Schedule / Log Hours /
   Profit This Week): a stat strip up top, a week-chip selector row (chips left,
   page actions right), the confirm form, Save + Start Over below the card, then
   a filter-chip row and a view/edit history table. Revenue and covers pull from
   Shift Control (sc_shifts); labor pulls from Labor Control (lc_actuals). The
   operator confirms. Stepping the selector to a saved week loads it for edit;
   Save updates that record. Saves to App.data.revenue_weeks. */

S.RevenueThisWeek = {
  draft: null,
  _weekEnd: null,
  _editId: null,
  _msg: '',
  DRAFT_KEY: 'rf_draft',
  filterPreset: 'last-12',
  _prevPreset: 'last-12',
  filterFrom: '',
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' },
    { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' },
    { v: 'all', label: 'All' },
    { v: 'custom', label: 'Custom' }
  ],

  // ── Shift Control revenue/covers feed (7-day week ending periodEnd) ─────────
  hasShifts() {
    return (((App.shiftData && App.shiftData.sc_shifts) || []).length) > 0;
  },
  shiftFeed(periodEnd) {
    const shifts = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!shifts.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    let bar = 0, floor = 0, covers = 0, any = false;
    shifts.forEach(s => {
      if (!s.date || s.date < start || s.date > periodEnd) return;
      bar += s.bar_revenue || 0;
      floor += s.floor_revenue || 0;
      covers += s.covers || 0;
      any = true;
    });
    return any ? { bar, floor, covers } : { bar: 0, floor: 0, covers: 0 };
  },

  // ── Labor Control labor feed (7-day week ending periodEnd) ─────────────────
  hasLabor() {
    return (((App.laborData && App.laborData.lc_actuals) || []).length) > 0;
  },
  laborFeed(periodEnd) {
    if (!periodEnd) return null;
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    let cost = 0, hours = 0, any = false;
    actuals.forEach(a => {
      if (!a.date || a.date < start || a.date > periodEnd) return;
      cost += a.cost || 0;
      // RPLH counts every labor hour worked, salaried managers included.
      hours += a.hours || 0;
      any = true;
    });
    // Salaried (exempt) labor is a fixed weekly cost on top of hourly wages.
    const sal = App.salariedCost(start, periodEnd);
    cost += sal.total;
    if (sal.total > 0) any = true;
    return any ? { cost, hours } : { cost: 0, hours: 0 };
  },

  targets() { return (App.data.revenue_settings && App.data.revenue_settings.targets) || {}; },
  laborTarget() { return App.laborTargetPct(); },

  // ── Dates ──────────────────────────────────────────────────────────────────
  currentWeekEnd() { return App.nextSunday ? App.nextSunday() : App.todayLocal(); },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  fmtDate(ymd) { if (!ymd) return '-'; const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? esc(ymd) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); },
  savedWeek(periodEnd) { return (App.data.revenue_weeks || []).find(w => (w.period_end || '').slice(0, 10) === periodEnd) || null; },
  // "Jun 15 - Jun 21" for the 7-day week ending on `end` (Sunday). Uses the
  // shared App.dateRangeLabel so the format matches every other week selector.
  weekRangeLabel(end) { return App.dateRangeLabel(App.weekStartFor(end), end); },
  nextWeekNum() {
    const weeks = App.data.revenue_weeks || [];
    return weeks.reduce((m, w) => Math.max(m, w.week_num || 0), 0) + 1;
  },

  // ── Draft (localStorage; only the unsaved current-week confirm persists) ────
  freshDraft(periodEnd) {
    const sf = this.shiftFeed(periodEnd);
    const lf = this.laborFeed(periodEnd);
    return {
      bar_revenue: sf && sf.bar ? sf.bar.toFixed(2) : '',
      floor_revenue: sf && sf.floor ? sf.floor.toFixed(2) : '',
      covers: sf && sf.covers ? String(sf.covers) : '',
      labor_hours: lf && lf.hours ? lf.hours.toFixed(2) : '',
      labor_cost: lf && lf.cost ? lf.cost.toFixed(2) : '',
      notes: ''
    };
  },
  draftFromWeek(w) {
    return {
      bar_revenue: w.bar_revenue ? String(w.bar_revenue) : '',
      floor_revenue: w.floor_revenue ? String(w.floor_revenue) : '',
      covers: w.covers ? String(w.covers) : '',
      labor_hours: w.total_hours ? String(w.total_hours) : '',
      labor_cost: w.total_labor_cost ? String(w.total_labor_cost) : '',
      notes: w.notes || ''
    };
  },
  saveDraft() { if (this._editId) return; try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify({ weekEnd: this._weekEnd, draft: this.draft })); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} },
  readDraft(weekEnd) {
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) { const o = JSON.parse(r); if (o && o.weekEnd === weekEnd && o.draft) return o.draft; } } catch (e) {}
    return null;
  },

  // Load a week into the form: saved → editable (carry its id), else a fresh
  // Control pull (with the current-week localStorage draft restored if present).
  loadWeek(weekEnd) {
    this._weekEnd = weekEnd;
    const saved = this.savedWeek(weekEnd);
    if (saved) {
      this.draft = this.draftFromWeek(saved);
      this._editId = saved.id;
    } else {
      this._editId = null;
      const dr = (weekEnd === this.currentWeekEnd()) ? this.readDraft(weekEnd) : null;
      this.draft = dr || this.freshDraft(weekEnd);
    }
  },

  // ── History filter range ────────────────────────────────────────────────────
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom || '', to: this.filterTo || '' };
    return App.datePresetRange(this.filterPreset);
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this._weekEnd) this.loadWeek(this.currentWeekEnd());
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How This Week Works', [
      { p: ['This is the weekly revenue confirm. Bar Cop pulls the week in from your Control systems: revenue and covers from Shift Control, hours and cost from Labor Control. You read the money picture up top, confirm the numbers, and save. You almost never type a raw number, you confirm one.'] },
      { h: 'The Week Selector', p: ['Each chip shows a week as its date range, for example Jun 15 - Jun 21. This Week opens on the current week, tagged NOW. Step back with the arrows to review or correct an earlier week, and This Week snaps you back. The numbers always reflect the selected week. Stepping to a week you already saved loads it back for editing, and saving updates that week instead of creating a new one.'] },
      { h: 'The Money Picture', p: ['Total revenue, how the week tracked versus your forecast, check average against target, labor percent against target, and revenue per labor hour, all live as you confirm the numbers.'] },
      { h: 'Confirm the Week', p: ['Bar revenue, floor revenue and covers give you the check average. Labor hours and cost give you labor percent and revenue per labor hour. Every cell is pre-filled from Control and editable. Load from Control re-runs the pull and refills the cells; if you have edited a cell by hand it asks before overwriting.'] },
      { h: 'Weekly History', p: ['Every week you save lands in the history list, newest first, with check average and labor percent colored against your targets. Edit loads a week back into the form; Delete removes it. The range chips filter the list and Export PDF saves it.'] }
    ]);
  },

  // ── Stat strip (the selected week's money picture) ──────────────────────────
  heroStrip() {
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val lg" id="rw-h-rev">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Forecast</div><div class="calc-val lg" id="rw-h-fcgap">-</div><div style="font-size:11px;color:var(--t3);margin-top:3px;" id="rw-h-fcsub">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val lg" id="rw-h-ca">-</div><div style="font-size:11px;color:var(--t3);margin-top:3px;" id="rw-h-casub">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val lg" id="rw-h-lpct">-</div><div style="font-size:11px;color:var(--t3);margin-top:3px;" id="rw-h-lpctsub">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val lg" id="rw-h-rplh">-</div></div>'
      + '</div></div>';
  },

  // ── Week-chip selector row (chips left, page actions right) ──────────────────
  selectorRow() {
    const now = this.currentWeekEnd();
    const sel = this._weekEnd;
    const older = this.addDays(sel, -7);
    const fwdDisabled = sel >= now;   // never step past the in-progress current week
    const chip = (end, active) =>
      '<button class="rw-wk-chip btn btn-sm" data-end="' + end + '" style="'
        + (active ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
                  : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">'
        + this.weekRangeLabel(end) + (end === now ? ' <span style="font-size:9px;color:var(--gold);font-weight:800;letter-spacing:1px;">NOW</span>' : '') + '</button>';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm rw-wk-prev" aria-label="Previous week">&lsaquo;</button>'
      + chip(older, false) + chip(sel, true)
      + '<button class="btn btn-ghost btn-sm rw-wk-next"' + (fwdDisabled ? ' disabled style="opacity:.35;cursor:default;"' : '') + ' aria-label="Next week">&rsaquo;</button>'
      + (sel !== now ? '<button class="btn btn-ghost btn-sm rw-wk-now" style="margin-left:4px;">This Week</button>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="rw-pull">Load from Control</button>'
      + '</div></div>';
  },

  // ── Confirm form (framed grid + notes, like Profit This Week) ────────────────
  moneyCell(id, value) {
    return '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" inputmode="decimal" style="width:100%;" oninput="S.RevenueThisWeek.onInput()"/></div>';
  },
  numCell(id, value) {
    return '<input class="form-input" type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" inputmode="decimal" style="width:100%;" oninput="S.RevenueThisWeek.onInput()"/>';
  },
  entryCard(d) {
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Confirm the Week</div>'
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;">'
      + '<table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
      + '<th>Bar Revenue</th><th>Floor Revenue</th><th>Total Covers</th><th>Labor Hours</th><th>Labor Cost</th>'
      + '</tr></thead><tbody><tr class="rw-line">'
      + '<td>' + this.moneyCell('rw-brev', d.bar_revenue) + '</td>'
      + '<td>' + this.moneyCell('rw-frev', d.floor_revenue) + '</td>'
      + '<td>' + this.numCell('rw-cov', d.covers) + '</td>'
      + '<td>' + this.numCell('rw-lhrs', d.labor_hours) + '</td>'
      + '<td>' + this.moneyCell('rw-lcost', d.labor_cost) + '</td>'
      + '</tr></tbody></table></div>'
      + '<div class="f" style="margin:0;"><label>Notes</label>'
      + '<textarea id="rw-notes" class="notes-ta" rows="2" placeholder="Optional" oninput="S.RevenueThisWeek.onInput()">' + esc(d.notes || '') + '</textarea></div>'
      + '</div>';
  },

  // ── Weekly history (filter chips + data-card table + in-app PDF export) ──────
  historyBlock() {
    const r = this.effectiveRange();
    const targetCA = this.targets().check_avg || 35;
    const tgtLP = this.laborTarget();
    const all = (App.data.revenue_weeks || []).slice()
      .filter(w => w.period_end)
      .filter(w => { const pe = (w.period_end || '').slice(0, 10); return (!r.from || pe >= r.from) && (!r.to || pe <= r.to); })
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''));

    const customRow = this.filterPreset === 'custom'
      ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
        + '<div class="f" style="width:180px;"><label>From</label><input type="date" id="rw-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:180px;"><label>To</label><input type="date" id="rw-to" value="' + esc(this.filterTo) + '"/></div></div>'
      : '';

    const rows = all.length
      ? all.map(w => {
          const total = (w.bar_revenue || 0) + (w.floor_revenue || 0);
          const caCls = w.check_avg ? (w.check_avg >= targetCA ? 'pos' : 'neg') : '';
          const lpCls = w.labor_pct_blended ? (w.labor_pct_blended <= tgtLP ? 'pos' : 'neg') : '';
          return '<tr>'
            + '<td><div class="val">' + this.fmtDate((w.period_end || '').slice(0, 10)) + '</div></td>'
            + '<td>Wk ' + (w.week_num != null ? w.week_num : '-') + '</td>'
            + '<td>' + App.fmtCurrency(w.bar_revenue || 0) + '</td>'
            + '<td>' + App.fmtCurrency(w.floor_revenue || 0) + '</td>'
            + '<td class="val">' + App.fmtCurrency(total) + '</td>'
            + '<td>' + (w.covers || '-') + '</td>'
            + '<td class="' + caCls + '">' + (w.check_avg ? App.fmtCurrency(w.check_avg) : '-') + '</td>'
            + '<td class="' + lpCls + '">' + (w.labor_pct_blended ? App.fmtPct(w.labor_pct_blended) : '-') + '</td>'
            + '<td class="val">' + (w.rplh_blended ? App.fmtCurrency(w.rplh_blended) : '-') + '</td>'
            + '<td><div class="row-actions">'
            + '<button class="btn btn-ghost btn-sm rw-edit" data-id="' + esc(w.id) + '">Edit</button>'
            + '<button class="btn btn-danger btn-sm rw-del" data-id="' + esc(w.id) + '">Delete</button>'
            + '</div></td></tr>';
        }).join('')
      : '<tr><td colspan="10" style="text-align:center;padding:22px;color:var(--t4);">No weeks saved in this range. Save a week above, or widen the range.</td></tr>';

    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'rw-range-chip') + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="rw-export">Export PDF</button>'
      + '</div>'
      + customRow
      + '<div id="rw-hist-export"><div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Week Ending</th><th>Week</th><th>Bar Rev</th><th>Floor Rev</th><th>Total</th><th>Covers</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
  },

  draw() {
    const d = this.draft;
    const editing = !!this._editId;
    this.container.innerHTML = '<div class="screen">'
      + this.heroStrip()
      + this.selectorRow()
      + this.entryCard(d)
      + '<div style="margin:16px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="rw-save">' + (editing ? 'Update Week' : 'Save Week') + '</button>'
      + '<button class="btn btn-ghost" id="rw-start-over">Start Over</button>'
      + '<span id="rw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<span id="rw-msg" style="color:var(--gold);font-size:12px;font-weight:700;margin-left:8px;display:' + (this._msg ? 'inline' : 'none') + ';">' + esc(this._msg) + '</span>'
      + '</div>'
      + this.historyBlock()
      + '</div>';
    this._msg = '';
    this.wire();
    this.calc();
  },

  wire() {
    document.getElementById('rw-save')?.addEventListener('click', () => this.saveWeek());
    document.getElementById('rw-start-over')?.addEventListener('click', () => this.startOver());
    document.getElementById('rw-pull')?.addEventListener('click', () => this.pullAll());
    this.container.querySelectorAll('.rw-wk-chip').forEach(b => b.addEventListener('click', () => this.gotoWeek(b.dataset.end)));
    this.container.querySelector('.rw-wk-prev')?.addEventListener('click', () => this.gotoWeek(this.addDays(this._weekEnd, -7)));
    this.container.querySelector('.rw-wk-next')?.addEventListener('click', () => this.gotoWeek(this.addDays(this._weekEnd, 7)));
    this.container.querySelector('.rw-wk-now')?.addEventListener('click', () => this.gotoWeek(this.currentWeekEnd()));
    this.container.querySelectorAll('.rw-range-chip').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (v === 'custom') { this.filterPreset = (this.filterPreset === 'custom') ? this._prevPreset : 'custom'; }
      else { this._prevPreset = v; this.filterPreset = v; }
      this.draw();
    }));
    document.getElementById('rw-from')?.addEventListener('change', e => { this.filterFrom = e.target.value; this.draw(); });
    document.getElementById('rw-to')?.addEventListener('change', e => { this.filterTo = e.target.value; this.draw(); });
    document.getElementById('rw-export')?.addEventListener('click', () => App.exportPDF({ title: 'Weekly History', root: document.getElementById('rw-hist-export') || this.container }));
    this.container.querySelectorAll('.rw-edit').forEach(b => b.addEventListener('click', () => this.editWeek(b.dataset.id)));
    this.container.querySelectorAll('.rw-del').forEach(b => b.addEventListener('click', () => this.deleteWeek(b.dataset.id)));
  },

  gotoWeek(weekEnd) {
    if (!weekEnd) return;
    if (!this._editId) { this.collect(); this.saveDraft(); }
    this.loadWeek(weekEnd);
    this.draw();
  },

  editWeek(id) {
    const w = (App.data.revenue_weeks || []).find(x => x.id === id);
    if (!w) return;
    this.gotoWeek((w.period_end || '').slice(0, 10));
    const el = App._activeContentEl ? App._activeContentEl() : null;
    if (el && el.scrollTo) el.scrollTo({ top: 0, behavior: 'smooth' });
    else if (el) el.scrollTop = 0;
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  deleteWeek(id) {
    App.confirmDelete().then(ok => {
      if (!ok) return;
      App.removeRecord('core', 'revenue_week', id).then(() => {
        if (this._editId === id) this.loadWeek(this._weekEnd);
        this.draw();
      });
    });
  },

  onInput() { this.collect(); this.saveDraft(); this.calc(); },

  collect() {
    const v = id => document.getElementById(id)?.value ?? '';
    const d = this.draft;
    d.bar_revenue = v('rw-brev'); d.floor_revenue = v('rw-frev'); d.covers = v('rw-cov');
    d.labor_hours = v('rw-lhrs'); d.labor_cost = v('rw-lcost');
    d.notes = v('rw-notes');
  },

  // True when the current input differs from the incoming value enough to call
  // it a real override (covers integer compare; dollars by 50 cents).
  _isOverride(id, incoming) {
    const cur = parseFloat(document.getElementById(id)?.value);
    if (isNaN(cur) || cur === 0) return false;
    const inc = parseFloat(incoming);
    if (isNaN(inc)) return false;
    return Math.abs(cur - inc) > 0.5;
  },

  // One "Load from Control" pulls revenue + covers from Shift Control and hours
  // + cost from Labor Control, with a single overwrite confirm if any typed cell
  // would change.
  async pullAll() {
    const pe = this._weekEnd;
    const sf = this.shiftFeed(pe);
    const lf = this.laborFeed(pe);
    const incoming = {};
    if (sf && (sf.bar || sf.floor || sf.covers)) {
      incoming['rw-brev'] = sf.bar; incoming['rw-frev'] = sf.floor;
      if (sf.covers) incoming['rw-cov'] = sf.covers;
    }
    if (lf && (lf.cost || lf.hours)) { incoming['rw-lhrs'] = lf.hours; incoming['rw-lcost'] = lf.cost; }
    if (!Object.keys(incoming).length) {
      await App.confirm({ title: 'Nothing to pull yet', message: 'No shifts or hours are logged in Control for this week yet. Log them in Shift and Labor Control, or enter the numbers here by hand.', confirmText: 'OK', cancelText: '' });
      return;
    }
    const conflicted = Object.entries(incoming).some(([id, val]) => this._isOverride(id, val));
    if (conflicted) {
      const ok = await App.confirm({ title: 'Overwrite your numbers?', message: 'Some cells you edited do not match what Control just computed. Loading will replace them with the logged figures.', confirmText: 'Overwrite', cancelText: 'Keep Mine' });
      if (!ok) return;
    }
    Object.entries(incoming).forEach(([id, val]) => {
      const el = document.getElementById(id); if (!el) return;
      el.value = id === 'rw-cov' ? String(Math.round(Number(val) || 0)) : (Number(val) || 0).toFixed(2);
    });
    this.onInput();
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const set = (id, val, color) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; if (color !== undefined) el.style.color = color; };
    const targetCA = this.targets().check_avg || 35;
    const tgtLP = this.laborTarget();

    const totalRev = num('rw-brev') + num('rw-frev');
    const covers = num('rw-cov');
    const checkAvg = covers > 0 ? totalRev / covers : null;
    const laborCost = num('rw-lcost'), laborHrs = num('rw-lhrs');
    const laborPct = totalRev > 0 && laborCost > 0 ? laborCost / totalRev * 100 : null;
    const rplh = laborHrs > 0 && totalRev > 0 ? totalRev / laborHrs : null;

    const fc = (this._weekEnd && App.forecastForWeek) ? App.forecastForWeek(this._weekEnd) : null;
    const fcTotal = fc && fc.total != null ? Number(fc.total) || 0 : 0;
    const fcGap = fcTotal > 0 && totalRev > 0 ? totalRev - fcTotal : null;

    set('rw-h-rev', totalRev > 0 ? App.fmtCurrency(totalRev) : '-', 'var(--t1)');
    set('rw-h-fcgap', fcGap != null ? ((fcGap >= 0 ? '+' : '') + App.fmtCurrency(fcGap)) : '-', fcGap == null ? 'var(--t3)' : (fcGap >= 0 ? 'var(--green)' : 'var(--red)'));
    set('rw-h-fcsub', fcTotal > 0 ? 'forecast ' + App.fmtCurrency(fcTotal) : 'no forecast set');
    set('rw-h-ca', checkAvg != null ? App.fmtCurrency(checkAvg) : '-', checkAvg == null ? 'var(--t3)' : (checkAvg >= targetCA ? 'var(--gold)' : 'var(--red)'));
    set('rw-h-casub', 'target ' + App.fmtCurrency(targetCA));
    set('rw-h-lpct', laborPct != null ? App.fmtPct(laborPct) : '-', laborPct == null ? 'var(--t3)' : (laborPct > tgtLP ? 'var(--red)' : 'var(--gold)'));
    set('rw-h-lpctsub', 'target ' + App.fmtPct(tgtLP));
    set('rw-h-rplh', rplh != null ? App.fmtCurrency(rplh) : '-', 'var(--t1)');
  },

  startOver() {
    App.confirm({ title: 'Start over?', message: this._editId ? 'This drops your unsaved changes to this week and reloads what is saved.' : 'This clears the numbers entered for this week and re-pulls a fresh copy from Control.', confirmText: 'Start Over', cancelText: 'Keep' }).then(ok => {
      if (!ok) return;
      if (!this._editId) this.clearDraft();
      this.loadWeek(this._weekEnd);
      this.draw();
    });
  },

  async saveWeek() {
    this.collect();
    const d = this.draft;
    const err = document.getElementById('rw-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) err.style.display = 'none';

    const barRev = parseFloat(d.bar_revenue) || 0;
    const floorRev = parseFloat(d.floor_revenue) || 0;
    const totalRev = barRev + floorRev;
    if (totalRev === 0) { fail('Enter at least one revenue figure before saving.'); return; }

    const covers = parseFloat(d.covers) || 0;
    const laborCost = parseFloat(d.labor_cost) || 0;
    const laborHrs = parseFloat(d.labor_hours) || 0;
    const checkAvg = covers > 0 ? totalRev / covers : 0;
    const laborPct = totalRev > 0 ? laborCost / totalRev * 100 : 0;
    const rplh = laborHrs > 0 ? totalRev / laborHrs : 0;

    const existing = this._editId ? (App.data.revenue_weeks || []).find(w => w.id === this._editId) : null;
    const week = {
      id:                this._editId || App.uid(),
      week_num:          existing ? existing.week_num : this.nextWeekNum(),
      period_end:        this._weekEnd,
      bar_revenue:       barRev,
      floor_revenue:     floorRev,
      covers:            covers,
      check_avg:         parseFloat(checkAvg.toFixed(2)),
      total_labor_cost:  laborCost,
      total_hours:       laborHrs,
      labor_pct_blended: parseFloat(laborPct.toFixed(2)),
      rplh_blended:      parseFloat(rplh.toFixed(2)),
      notes:             d.notes || '',
      saved_at:          new Date().toISOString()
    };

    const btn = document.getElementById('rw-save');
    const wasEditing = !!this._editId;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('core', 'revenue_week', week);
    if (ok) {
      if (!wasEditing) this.clearDraft();
      App.markSetupDone('gs_r_week');
      this._msg = wasEditing ? 'Week updated.' : 'Week saved.';
      this.loadWeek(this._weekEnd);   // reload the now-saved week (becomes editable)
      this.draw();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = wasEditing ? 'Update Week' : 'Save Week'; }
      fail('Save failed. Try again.');
    }
  }
};
