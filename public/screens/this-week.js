'use strict';

/* ── Profit Recovery — This Week (weekly confirm + history) ───────────────────
   Matches the Control entry-page standard (Build Schedule / Log Hours / Receive
   Delivery): a stat strip up top, a week-chip selector row (chips left, page
   actions right), the confirm grid, Save + Start Over below the card, then a
   filter-chip row and a view/edit history table. The week is pulled in from
   Control (revenue from Shift, COGS from Inventory, labor from Labor) and the
   operator confirms it. Stepping the selector to a saved week loads it for edit;
   Save updates that record. Saves to App.data.weeks. */

S.ThisWeek = {
  draft: null,
  _weekEnd: null,
  _editId: null,
  _showCatering: false,
  _msg: '',
  DRAFT_KEY: 'pf_draft',
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
  get BAR_CATS()     { return App.BAR_CATS; },
  get KITCHEN_CATS() { return App.KITCHEN_CATS; },

  // ── Inventory Control COGS feed ───────────────────────────────────────────
  icCOGS(cats, periodEnd) {
    const counts = [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
    if (counts.length < 2) return null;
    // Scope to the count pair ending on or before the selected week, so loading a
    // past week pulls THAT week's usage, not the most recent counts. With no
    // periodEnd (or no count pair on/before it) fall back to the latest pair.
    let endIdx = counts.length - 1;
    if (periodEnd) {
      const cdate = c => String(c.date || c.created_at || '').slice(0, 10);
      let idx = -1;
      for (let i = counts.length - 1; i >= 0; i--) { if (cdate(counts[i]) <= periodEnd) { idx = i; break; } }
      if (idx < 1) return null;   // no count pair on or before this week → no honest COGS
      endIdx = idx;
    }
    const startC = counts[endIdx - 1], endC = counts[endIdx];
    const prods = (App.inventoryData && App.inventoryData.ic_products) || [];
    const sMap = {}; (startC.items || []).forEach(it => sMap[it.product_id] = it);
    const eMap = {}; (endC.items || []).forEach(it => eMap[it.product_id] = it);
    const purch = {};
    ((App.inventoryData && App.inventoryData.ic_deliveries) || [])
      .filter(d => d.date > startC.date && d.date <= endC.date)
      .forEach(d => (d.line_items || []).forEach(li => {
        purch[li.product_id] = (purch[li.product_id] || 0) + App.unitsFromDeliveryLine(li);
      }));
    let cogs = 0, any = false;
    Object.keys(eMap).forEach(pid => {
      if (!sMap[pid]) return;
      const p = prods.find(x => x.id === pid);
      if (!p || !cats.includes(p.category)) return;
      const used = (sMap[pid].total || 0) + (purch[pid] || 0) - (eMap[pid].total || 0);
      const c = (p.unit_cost != null) ? App.unitCost(p) : App.unitCostFromCountItem(eMap[pid]);
      if (c != null) { cogs += used * c; any = true; }
    });
    return any ? cogs : null;
  },

  // ── Shift Control revenue feed (7-day week ending periodEnd) ──────────────
  shiftRevenue(periodEnd) {
    const shifts = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!shifts.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    let bar = 0, food = 0, any = false;
    shifts.forEach(s => {
      if (!s.date || s.date < start || s.date > periodEnd) return;
      bar += s.bar_revenue || 0;
      food += s.floor_revenue || 0;
      any = true;
    });
    return any ? { bar, food } : { bar: 0, food: 0 };
  },

  // ── Labor Control labor feed (7-day week ending periodEnd) ────────────────
  // Prime-cost labor is the hourly floor/BOH/FOH labor that scales with volume.
  // Salaried management is a fixed cost that lands in Books as an operating
  // expense, so it is deliberately NOT folded into prime cost here (keeps This
  // Week's prime in step with the booked weekly P&L and the dashboard).
  laborCost(periodEnd) {
    if (!periodEnd) return null;
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    const posDept = {};
    ((App.laborData && App.laborData.lc_positions) || []).forEach(p => { posDept[p.id] = p.department; });
    let bar = 0, food = 0, any = false;
    actuals.forEach(a => {
      if (!a.date || a.date < start || a.date > periodEnd) return;
      any = true;
      if (posDept[a.position_id] === 'Bar') bar += a.cost || 0;
      else food += a.cost || 0;
    });
    return any ? { bar, food } : { bar: 0, food: 0 };
  },

  // ── Dates ───────────────────────────────────────────────────────────────
  currentWeekEnd() { return App.nextSunday ? App.nextSunday() : App.todayLocal(); },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  fmtChip(ymd) { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  fmtDate(ymd) { if (!ymd) return '-'; const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? esc(ymd) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); },
  savedWeek(periodEnd) { return (App.data.weeks || []).find(w => w.period_end === periodEnd) || null; },
  // The period_end of the most recent saved week (This Week opens here, so it
  // lands on real numbers instead of the in-progress, partial current week).
  mostRecentSavedEnd() {
    const ends = (App.data.weeks || []).map(w => w.period_end).filter(Boolean).sort();
    return ends.length ? ends[ends.length - 1] : null;
  },
  // "Jun 15 - Jun 21" for the 7-day week ending on `end` (Sunday). Uses the
  // shared App.dateRangeLabel so the format matches every other week selector.
  weekRangeLabel(end) { return App.dateRangeLabel(App.weekStartFor(end), end); },

  // Catering revenue from the Events section for this week — but ONLY offsite
  // catering jobs. An in-house event runs inside a normal shift, so its revenue
  // already lands in bar/food revenue above; counting it here too would double it.
  // Offsite jobs have no shift, so they are the separate catering line. Revenue +
  // food/bar cost prefill; labor stays for the operator (offsite labor is manual).
  cateringFromBookings(periodEnd) {
    const blank = { revenue: '', cogs: '', labor: '' };
    if (!periodEnd) return blank;
    const start = App.weekStartFor(periodEnd);
    let rev = 0, cogs = 0;
    (App.data.bookings || []).forEach(b => {
      if (b.stage !== 'Completed' || !b.event_date) return;
      const ed = String(b.event_date).slice(0, 10);
      if (ed < start || ed > periodEnd) return;
      const offsite = b.event_type === 'Catering (Offsite)' || /offsite/i.test(b.space || '');
      if (!offsite) return;   // in-house event revenue is already in the shift's bar/food revenue
      rev  += parseFloat(b.actual_revenue) || 0;
      cogs += (parseFloat(b.event_food_cost) || 0) + (parseFloat(b.event_bar_cost) || 0);
    });
    return rev > 0 ? { revenue: rev.toFixed(2), cogs: cogs.toFixed(2), labor: '' } : blank;
  },

  // ── Draft (localStorage; only the unsaved current-week confirm persists) ──
  freshDraft(periodEnd) {
    const bc = this.icCOGS(this.BAR_CATS, periodEnd), fc = this.icCOGS(this.KITCHEN_CATS, periodEnd);
    const sr = this.shiftRevenue(periodEnd);
    const lc = this.laborCost(periodEnd);
    return {
      period_end: periodEnd,
      bar:  { revenue: sr && sr.bar ? sr.bar.toFixed(2) : '', labor: lc && lc.bar ? lc.bar.toFixed(2) : '', cogs: bc != null ? bc.toFixed(2) : '' },
      food: { revenue: sr && sr.food ? sr.food.toFixed(2) : '', labor: lc && lc.food ? lc.food.toFixed(2) : '', cogs: fc != null ? fc.toFixed(2) : '' },
      catering: this.cateringFromBookings(periodEnd),
      other: { revenue: '', cogs: '' },
      platform_fees: '',
      notes: ''
    };
  },
  draftFromWeek(w) {
    const s = v => (v == null || v === '' ? '' : Number(v).toFixed(2));
    return {
      period_end: w.period_end,
      bar:  { revenue: s(w.bar?.revenue),  labor: s(w.bar?.labor),  cogs: s(w.bar?.cogs) },
      food: { revenue: s(w.food?.revenue), labor: s(w.food?.labor), cogs: s(w.food?.cogs) },
      catering: { revenue: s(w.catering?.revenue), cogs: s(w.catering?.cogs), labor: s(w.catering?.labor) },
      other: { revenue: s(w.other?.revenue), cogs: s(w.other?.cogs) },
      platform_fees: s(w.platform_fees),
      notes: w.notes || ''
    };
  },
  saveDraft() { if (this._editId) return; try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify({ weekEnd: this._weekEnd, draft: this.draft })); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} },
  readDraft(weekEnd) {
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) { const o = JSON.parse(r); if (o && o.weekEnd === weekEnd && o.draft) return o.draft; } } catch (e) {}
    return null;
  },

  // Load a week into the grid: saved → editable (carry its id), else a fresh
  // Control pull (with the current-week localStorage draft restored if present).
  loadWeek(weekEnd) {
    this._weekEnd = weekEnd;
    this._showCatering = false;
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

  cateringActive(d) {
    if (this._showCatering) return true;
    const c = d && d.catering;
    return !!(c && (parseFloat(c.revenue) || parseFloat(c.cogs) || parseFloat(c.labor)));
  },

  // ── History filter range ──────────────────────────────────────────────────
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom || '', to: this.filterTo || '' };
    return App.datePresetRange(this.filterPreset);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this._weekEnd) this.loadWeek(this.currentWeekEnd());
    // One-shot deep-link from Reports and History "Edit in This Week": load the
    // requested saved week into the grid for editing, then clear the handoff.
    if (this._focusWeekId) {
      const fw = (App.data.weeks || []).find(x => x.id === this._focusWeekId);
      this._focusWeekId = null;
      if (fw) this.loadWeek(fw.period_end);
    }
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How This Week Works', [
      { p: ['This is the weekly confirm. Bar Cop pulls the week in from your Control systems: revenue from Shift Control, COGS from Inventory Control, labor from Labor Control. You read the money picture up top, confirm the grid, and save. You almost never type a raw number, you confirm one.'] },
      { h: 'The Week Selector', p: ['Each chip shows a week as its date range, for example Jun 15 - Jun 21. This Week opens on the current week, tagged NOW. Step back with the arrows to review or correct an earlier week, and This Week snaps you back to the current week. The numbers below always reflect the week you have selected. Stepping to a past week you already saved loads it back into the grid so you can correct it, and saving updates that week instead of creating a new one.'] },
      { h: 'The Money Picture', p: ['Total revenue, prime cost against your target, how the week tracked versus forecast, and the total dollars running over target this week, all live. Prime cost is the headline number, and labor is folded into it.'] },
      { h: 'The Confirm Grid', p: ['One row per stream (Bar, Food, and Catering if you run events). Revenue, Labor, and COGS are the cells, pre-filled from Control and editable. Cost percent and dollars over or under target compute live as you tweak. Load From Control re-runs the math and refills every auto cell; if you have edited a cell by hand it asks before overwriting.'] },
      { h: 'Other Revenue', p: ['Merch, vending, ticketed events, anything outside bar and food, goes in the Other / Ancillary Revenue box with its cost. It stays out of your prime cost but rolls into Books as its own income line.'] },
      { h: 'Operating Costs', p: ['Third-party platform fees, delivery commissions and the like, are an operating cost, not COGS or labor, so they sit in their own box and do not move the prime cost numbers above. Bar Cop captures the weekly figure here and Books reads it as an operating expense toward your true profit.'] },
      { h: 'Weekly History', p: ['Every week you save lands in the history list, newest first. The Cost vs Target column shows the real dollars that week ran over or under your bar and food cost targets combined. Edit loads a week back into the grid; Delete removes it. The range chips filter the list and Export PDF saves it.'] }
    ]);
  },

  // ── Stat strip (the selected week's money picture) ──────────────────────────
  heroStrip() {
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val lg" id="tw-totrev">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Prime Cost</div><div class="calc-val lg" id="tw-prime">-</div><div style="font-size:11px;color:var(--t3);margin-top:3px;" id="tw-prime-sub">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Forecast</div><div class="calc-val lg" id="tw-fcgap">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Over Target</div><div class="calc-val lg" id="tw-over">-</div></div>'
      + '</div></div>';
  },

  // ── Week-chip selector row (chips left, page actions right) ─────────────────
  selectorRow() {
    const now = this.currentWeekEnd();
    const sel = this._weekEnd;
    const older = this.addDays(sel, -7);
    const fwdDisabled = sel >= now;   // never step past the in-progress current week
    const chip = (end, active) =>
      '<button class="tw-wk-chip btn btn-sm" data-end="' + end + '" style="'
        + (active ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
                  : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">'
        + this.weekRangeLabel(end) + (end === now ? ' <span style="font-size:9px;color:var(--gold);font-weight:800;letter-spacing:1px;">NOW</span>' : '') + '</button>';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm tw-wk-prev" aria-label="Previous week">&lsaquo;</button>'
      + chip(older, false) + chip(sel, true)
      + '<button class="btn btn-ghost btn-sm tw-wk-next"' + (fwdDisabled ? ' disabled style="opacity:.35;cursor:default;"' : '') + ' aria-label="Next week">&rsaquo;</button>'
      + (sel !== now ? '<button class="btn btn-ghost btn-sm tw-wk-now" style="margin-left:4px;">This Week</button>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="tw-pull">Load from Control</button>'
      + '</div></div>';
  },

  // ── Confirm grid card ───────────────────────────────────────────────────────
  cell(id, val) {
    return '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="tw-' + id + '" value="' + esc(String(val || '')) + '" step="0.01" inputmode="decimal" style="width:100%;" oninput="S.ThisWeek.onInput()"/></div>';
  },
  lineRow(label, p, data) {
    return '<tr class="tw-line">'
      + '<td><div class="val">' + label + '</div></td>'
      + '<td>' + this.cell(p + 'r', data.revenue) + '</td>'
      + '<td>' + this.cell(p + 'l', data.labor) + '</td>'
      + '<td>' + this.cell(p + 'c', data.cogs) + '</td>'
      + '<td id="tw-' + p + 'pct">-</td>'
      + '<td id="tw-' + p + 'vd" style="text-align:right;">-</td>'
      + '</tr>';
  },
  gridCard(d) {
    const cateringOn = this.cateringActive(d);
    const footerLeft = cateringOn
      ? '<button type="button" id="tw-remove-catering" style="background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;padding:0;">Remove catering</button>'
      : '<button type="button" id="tw-add-catering" style="background:none;border:none;color:var(--gold);font-size:12px;font-weight:700;cursor:pointer;padding:0;">+ Add catering / events</button>';
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Confirm the Week</div>'
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;">'
      + '<table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:92px;">Section</th><th>Revenue</th><th>Labor</th><th>COGS</th><th style="width:80px;">Cost %</th><th style="width:112px;">vs Target</th>'
      + '</tr></thead><tbody>'
      + this.lineRow('Bar', 'b', d.bar)
      + this.lineRow('Food', 'f', d.food)
      + (cateringOn ? this.lineRow('Catering', 'c', d.catering || { revenue: '', cogs: '', labor: '' }) : '')
      + '</tbody></table></div>'
      + '<div style="margin-bottom:14px;">' + footerLeft + '</div>'
      + '<div class="f" style="margin:0;"><label>Notes</label>'
      + '<textarea id="tw-notes" class="notes-ta" rows="2" placeholder="Optional" oninput="S.ThisWeek.onInput()">' + esc(d.notes || '') + '</textarea></div>'
      + '</div>';
  },

  // Other / ancillary revenue (merch, vending, ticketed events, and the like).
  // A separate income stream that Books rolls into the income statement; it is
  // NOT part of the bar/food prime-cost grid above, so it does not move prime cost.
  otherRevCard(d) {
    const o = d.other || { revenue: '', cogs: '' };
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Other / Ancillary Revenue</div>'
      + '<div class="form-row" style="align-items:flex-end;gap:18px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="tw-or" value="' + esc(String(o.revenue || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Cost of Goods</label>'
      + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="tw-oc" value="' + esc(String(o.cogs || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div></div>'
      + '</div></div>';
  },

  // Operating costs are below-the-line (not COGS or labor), so they sit in their
  // own card and do NOT move the prime-cost numbers above. Captured weekly here
  // because Books reads the per-week figure.
  opexCard(d) {
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Operating Costs</div>'
      + '<div class="form-row" style="align-items:flex-end;gap:18px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>3rd-Party Platform Fees</label>'
      + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="tw-pf" value="' + esc(String(d.platform_fees || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div></div>'
      + '</div></div>';
  },

  // ── Weekly history (filter chips + data-card table) ─────────────────────────
  historyBlock() {
    const r = this.effectiveRange();
    const all = (App.data.weeks || []).slice()
      .filter(w => w.period_end)
      .filter(w => (!r.from || w.period_end >= r.from) && (!r.to || w.period_end <= r.to))
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''));
    const t = App.data.settings.targets || {};
    const bT = t.bar_pour_cost_pct ?? 22, fT = t.food_cost_pct ?? 32, pT = t.prime_cost_pct ?? 60;
    const cls = (v, tgt) => v == null ? '' : (v > tgt ? 'neg' : 'pos');

    const customRow = this.filterPreset === 'custom'
      ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
        + '<div class="f" style="width:180px;"><label>From</label><input type="date" id="tw-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:180px;"><label>To</label><input type="date" id="tw-to" value="' + esc(this.filterTo) + '"/></div></div>'
      : '';

    const rows = all.length
      ? all.map(w => {
          // Cost vs Target $: real dollars this week ran over (or under) the bar
          // and food cost targets combined. Computable from data every saved week
          // carries.
          const barGap  = ((w.bar?.cost_pct  - bT) / 100) * (w.bar?.revenue  || 0);
          const foodGap = ((w.food?.cost_pct - fT) / 100) * (w.food?.revenue || 0);
          const costGap = (isFinite(barGap) ? barGap : 0) + (isFinite(foodGap) ? foodGap : 0);
          const gapStr  = (costGap > 0 ? '+' : costGap < 0 ? '-' : '') + App.fmtCurrency(Math.abs(costGap));
          return '<tr>'
          + '<td><div class="val">' + this.fmtDate(w.period_end) + '</div></td>'
          + '<td>Week ' + (w.week_num != null ? w.week_num : '-') + '</td>'
          + '<td>' + App.fmtCurrency(w.bar?.revenue || 0) + '</td>'
          + '<td class="' + cls(w.bar?.cost_pct, bT) + '">' + App.fmtPct(w.bar?.cost_pct) + '</td>'
          + '<td>' + App.fmtCurrency(w.food?.revenue || 0) + '</td>'
          + '<td class="' + cls(w.food?.cost_pct, fT) + '">' + App.fmtPct(w.food?.cost_pct) + '</td>'
          + '<td class="' + cls(w.prime_cost_pct, pT) + '">' + App.fmtPct(w.prime_cost_pct) + '</td>'
          + '<td class="' + (costGap > 0 ? 'neg' : costGap < 0 ? 'pos' : '') + '">' + gapStr + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm tw-edit" data-id="' + esc(w.id) + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm tw-del" data-id="' + esc(w.id) + '">Delete</button>'
          + '</div></td></tr>';
        }).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--t4);">No weeks saved in this range. Pick a wider range above.</td></tr>';

    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'tw-range-chip') + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="tw-export">Export PDF</button>'
      + '</div>'
      + customRow
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Week Ending</th><th>Week</th><th>Bar Rev</th><th>Bar %</th><th>Food Rev</th><th>Food %</th><th>Prime %</th><th>Cost vs Tgt $</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  draw() {
    const d = this.draft;
    const editing = !!this._editId;
    this.container.innerHTML = '<div class="screen">'
      + this.heroStrip()
      + this.selectorRow()
      + this.gridCard(d)
      + this.otherRevCard(d)
      + this.opexCard(d)
      + '<div style="margin:16px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="tw-save">' + (editing ? 'Update Week' : 'Save Week') + '</button>'
      + '<button class="btn btn-ghost" id="tw-start-over">Start Over</button>'
      + '<span id="tw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<span id="tw-msg" style="color:var(--gold);font-size:12px;font-weight:700;margin-left:8px;display:' + (this._msg ? 'inline' : 'none') + ';">' + esc(this._msg) + '</span>'
      + '</div>'
      + this.historyBlock()
      + '</div>';
    this._msg = '';
    this.wire();
    this.calc();
  },

  wire() {
    document.getElementById('tw-save')?.addEventListener('click', () => this.saveWeek());
    document.getElementById('tw-start-over')?.addEventListener('click', () => this.startOver());
    document.getElementById('tw-pull')?.addEventListener('click', () => this.pullAll());
    document.getElementById('tw-add-catering')?.addEventListener('click', () => { this.collect(); this._showCatering = true; this.saveDraft(); this.draw(); });
    document.getElementById('tw-remove-catering')?.addEventListener('click', () => { this.collect(); this.draft.catering = { revenue: '', cogs: '', labor: '' }; this._showCatering = false; this.saveDraft(); this.draw(); });
    this.container.querySelectorAll('.tw-wk-chip').forEach(b => b.addEventListener('click', () => this.gotoWeek(b.dataset.end)));
    this.container.querySelector('.tw-wk-prev')?.addEventListener('click', () => this.gotoWeek(this.addDays(this._weekEnd, -7)));
    this.container.querySelector('.tw-wk-next')?.addEventListener('click', () => this.gotoWeek(this.addDays(this._weekEnd, 7)));
    this.container.querySelector('.tw-wk-now')?.addEventListener('click', () => this.gotoWeek(this.currentWeekEnd()));
    this.container.querySelectorAll('.tw-range-chip').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (v === 'custom') { this.filterPreset = (this.filterPreset === 'custom') ? this._prevPreset : 'custom'; }
      else { this._prevPreset = v; this.filterPreset = v; }
      this.draw();
    }));
    document.getElementById('tw-from')?.addEventListener('change', e => { this.filterFrom = e.target.value; this.draw(); });
    document.getElementById('tw-to')?.addEventListener('change', e => { this.filterTo = e.target.value; this.draw(); });
    document.getElementById('tw-export')?.addEventListener('click', () => App.exportPDF({ title: 'Weekly History', root: this.container }));
    this.container.querySelectorAll('.tw-edit').forEach(b => b.addEventListener('click', () => this.editWeek(b.dataset.id)));
    this.container.querySelectorAll('.tw-del').forEach(b => b.addEventListener('click', () => this.deleteWeek(b.dataset.id)));
  },

  gotoWeek(weekEnd) {
    if (!this._editId) { this.collect(); this.saveDraft(); }
    this.loadWeek(weekEnd);
    this.draw();
  },

  editWeek(id) {
    const w = (App.data.weeks || []).find(x => x.id === id);
    if (!w) return;
    this.loadWeek(w.period_end);
    this.draw();
    // Jump back to the confirm grid at the top — the app scrolls its .content
    // element, so scrolling the container itself would not move the view.
    const el = App._activeContentEl ? App._activeContentEl() : null;
    if (el && el.scrollTo) el.scrollTo({ top: 0, behavior: 'smooth' });
    else if (el) el.scrollTop = 0;
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  deleteWeek(id) {
    App.confirmDelete().then(ok => {
      if (!ok) return;
      App.removeRecord('core', 'week', id).then(() => {
        if (this._editId === id) this.loadWeek(this._weekEnd);
        this.draw();
      });
    });
  },

  onInput() { this.collect(); this.saveDraft(); this.calc(); },

  collect() {
    const v = id => document.getElementById(id)?.value ?? '';
    const d = this.draft;
    d.bar.revenue = v('tw-br'); d.bar.cogs = v('tw-bc'); d.bar.labor = v('tw-bl');
    d.food.revenue = v('tw-fr'); d.food.cogs = v('tw-fc'); d.food.labor = v('tw-fl');
    if (!d.catering) d.catering = { revenue: '', cogs: '', labor: '' };
    if (this.cateringActive(d)) { d.catering.revenue = v('tw-cr'); d.catering.cogs = v('tw-cc'); d.catering.labor = v('tw-cl'); }
    if (!d.other) d.other = { revenue: '', cogs: '' };
    d.other.revenue = v('tw-or'); d.other.cogs = v('tw-oc');
    d.platform_fees = v('tw-pf');
    d.notes = v('tw-notes');
  },

  _isOverride(id, incoming) {
    const cur = parseFloat(document.getElementById(id)?.value);
    if (isNaN(cur) || cur === 0) return false;
    const inc = parseFloat(incoming);
    if (isNaN(inc)) return false;
    return Math.abs(cur - inc) > 0.5;
  },

  async pullAll() {
    const pe = this._weekEnd;
    const bc = this.icCOGS(this.BAR_CATS, pe), fc = this.icCOGS(this.KITCHEN_CATS, pe);
    const sr = this.shiftRevenue(pe);
    const lc = this.laborCost(pe);
    const incoming = {};
    if (sr) { incoming['tw-br'] = sr.bar; incoming['tw-fr'] = sr.food; }
    if (lc) { incoming['tw-bl'] = lc.bar; incoming['tw-fl'] = lc.food; }
    if (bc != null) incoming['tw-bc'] = bc;
    if (fc != null) incoming['tw-fc'] = fc;
    if (!Object.keys(incoming).length) {
      await App.confirm({ title: 'Nothing to pull yet', message: 'No shifts, counts, or hours are logged in Control for this week yet. Log them in Inventory, Shift, and Labor Control, or enter the numbers here by hand.', confirmText: 'OK', cancelText: '' });
      return;
    }
    const conflicted = Object.entries(incoming).some(([id, val]) => this._isOverride(id, val));
    if (conflicted) {
      const ok = await App.confirm({ title: 'Overwrite your numbers?', message: 'Some cells you edited do not match what Control just computed. Loading will replace them with the logged figures.', confirmText: 'Overwrite', cancelText: 'Keep Mine' });
      if (!ok) return;
    }
    Object.entries(incoming).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = (Number(val) || 0).toFixed(2); });
    this.onInput();
  },

  calc() {
    const d = this.draft;
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const t = (App.data.settings && App.data.settings.targets) || {};
    const put = (id, str, color) => { const el = document.getElementById(id); if (!el) return; el.textContent = str; if (color !== undefined) el.style.color = color; };

    const sections = [
      { p: 'b', target: t.bar_pour_cost_pct ?? 22 },
      { p: 'f', target: t.food_cost_pct ?? 32 }
    ];
    if (this.cateringActive(d)) sections.push({ p: 'c', target: null });

    let totRev = 0, totCost = 0, overTarget = 0;
    sections.forEach(s => {
      const rev = num('tw-' + s.p + 'r'), labor = num('tw-' + s.p + 'l'), cogs = num('tw-' + s.p + 'c');
      totRev += rev; totCost += cogs + labor;
      const pct = rev > 0 ? cogs / rev * 100 : null;
      if (s.target == null) {
        put('tw-' + s.p + 'pct', pct != null ? App.fmtPct(pct) : '-', pct != null ? 'var(--t2)' : 'var(--t3)');
        put('tw-' + s.p + 'vd', '-', 'var(--t3)');
      } else {
        const vd = pct != null ? ((pct - s.target) / 100) * rev : null;
        const over = pct != null && pct > s.target;
        if (vd != null && vd > 0) overTarget += vd;
        put('tw-' + s.p + 'pct', pct != null ? App.fmtPct(pct) : '-', pct == null ? 'var(--t3)' : (over ? 'var(--red)' : 'var(--gold)'));
        put('tw-' + s.p + 'vd', vd != null ? ((vd > 0 ? '+' : '') + App.fmtCurrency(vd)) : '-', vd == null ? 'var(--t3)' : (vd > 0 ? 'var(--red)' : 'var(--green)'));
      }
    });

    const primeTarget = t.prime_cost_pct ?? 60;
    const prime = totRev > 0 ? totCost / totRev * 100 : null;
    put('tw-totrev', totRev > 0 ? App.fmtCurrency(totRev) : '-', 'var(--t1)');
    put('tw-prime', prime != null ? App.fmtPct(prime) : '-', prime == null ? 'var(--t3)' : (prime > primeTarget ? 'var(--red)' : 'var(--gold)'));
    put('tw-prime-sub', 'target ' + primeTarget + '%' + (prime != null ? (prime > primeTarget ? ' · over' : ' · on target') : ''), prime != null && prime > primeTarget ? 'var(--red)' : 'var(--t3)');
    put('tw-over', totRev > 0 ? App.fmtCurrency(overTarget) : '-', overTarget > 0 ? 'var(--red)' : 'var(--gold)');

    const fc = (this._weekEnd && App.forecastForWeek) ? App.forecastForWeek(this._weekEnd) : null;
    const fcTotal = fc && fc.total != null ? Number(fc.total) || 0 : 0;
    const fcGap = fcTotal > 0 && totRev > 0 ? totRev - fcTotal : null;
    put('tw-fcgap', fcGap != null ? ((fcGap >= 0 ? '+' : '') + App.fmtCurrency(fcGap)) : '-', fcGap == null ? 'var(--t3)' : (fcGap >= 0 ? 'var(--green)' : 'var(--red)'));
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
    const err = document.getElementById('tw-err');
    const numF = v => parseFloat(v) || 0;
    const bRev = numF(d.bar.revenue), bCogs = numF(d.bar.cogs), bLab = numF(d.bar.labor);
    const fRev = numF(d.food.revenue), fCogs = numF(d.food.cogs), fLab = numF(d.food.labor);
    const cRev = numF(d.catering?.revenue), cCogs = numF(d.catering?.cogs), cLab = numF(d.catering?.labor);
    const oRev = numF(d.other?.revenue), oCogs = numF(d.other?.cogs);
    const pFees = numF(d.platform_fees);
    if (bRev + fRev + cRev === 0) {
      if (err) { err.textContent = 'Enter at least one revenue figure before saving.'; err.style.display = 'inline'; }
      return;
    }
    const t = App.data.settings.targets || {};
    const bTarget = t.bar_pour_cost_pct ?? 22, fTarget = t.food_cost_pct ?? 32;
    const tRev = bRev + fRev + cRev;
    const tCost = bCogs + fCogs + bLab + fLab + cCogs + cLab;
    const bPct = bRev > 0 ? bCogs / bRev * 100 : 0;
    const fPct = fRev > 0 ? fCogs / fRev * 100 : 0;

    const existing = this._editId ? (App.data.weeks || []).find(w => w.id === this._editId) : null;
    const week = {
      id: this._editId || App.uid(),
      week_num: existing ? existing.week_num : (App.nextWeekNum ? App.nextWeekNum() : 1),
      period_end: this._weekEnd,
      saved_at: new Date().toISOString(),
      bar: { revenue: bRev, cogs: bCogs, labor: bLab, cost_pct: bPct, labor_pct: bRev > 0 ? bLab / bRev * 100 : 0, vs_target_pct: bPct - bTarget, vs_target_dollar: ((bPct - bTarget) / 100) * bRev },
      food: { revenue: fRev, cogs: fCogs, labor: fLab, cost_pct: fPct, labor_pct: fRev > 0 ? fLab / fRev * 100 : 0, vs_target_pct: fPct - fTarget, vs_target_dollar: ((fPct - fTarget) / 100) * fRev },
      catering: { revenue: cRev, cogs: cCogs, labor: cLab, cost_pct: cRev > 0 ? cCogs / cRev * 100 : 0, labor_pct: cRev > 0 ? cLab / cRev * 100 : 0 },
      other: { revenue: oRev, cogs: oCogs },
      platform_fees: pFees,
      prime_cost_pct: tRev > 0 ? tCost / tRev * 100 : 0,
      notes: d.notes || ''
    };

    const btn = document.getElementById('tw-save');
    const wasEditing = !!this._editId;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('core', 'week', week);
    if (ok) {
      if (!wasEditing) this.clearDraft();
      if (App.updatePeriod) App.updatePeriod();
      App.markSetupDone('gs_p_week');
      this._msg = wasEditing ? 'Week updated.' : 'Week saved.';
      this.loadWeek(this._weekEnd);   // reload the now-saved week (becomes editable)
      this.draw();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = wasEditing ? 'Update Week' : 'Save Week'; }
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  }
};
