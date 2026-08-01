'use strict';

/* ── Confirm the Week ─────────────────────────────────────────────────────────
   ONE popup that closes the week for both Profit and Revenue at once. The two
   old "Run This Week" pages (S.ThisWeek / S.RevenueThisWeek) each confirmed the
   same week from the same feeds into two stores; this is the single door.

   Opened from either cockpit's step 1 (current or the selected week) and from
   Week History (a specific past week). The week is ALWAYS fixed by the caller —
   there is no week picker inside, so current and past never mix on one form.

   Auto-fills from Control (reusing the tested feed helpers on S.ThisWeek /
   S.RevenueThisWeek), lets the operator edit, and on Confirm writes BOTH the
   profit `week` record and the revenue `revenue_week` record. */
const ConfirmWeek = {
  MODAL_ID: 'confirm-week-modal',

  open(weekEnd, opts) {
    opts = opts || {};
    this._weekEnd = weekEnd || (App.nextSunday ? App.nextSunday() : App.todayLocal());
    this._onDone = opts.onDone || null;
    this._err = '';
    this._render();
  },

  // ── Feeds (reuse the tested helpers; compute the sc_shifts sales rollup here
  //    so we do not depend on a page being rendered) ────────────────────────────
  salesRollup(pe) {
    const days = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!days.length || !pe) return { bar: 0, floor: 0, covers: 0, any: false };
    const sd = new Date(pe + 'T00:00:00');
    if (isNaN(sd.getTime())) return { bar: 0, floor: 0, covers: 0, any: false };
    sd.setDate(sd.getDate() - 6);
    const start = App.ymdLocal(sd);
    let bar = 0, floor = 0, covers = 0, any = false;
    days.forEach(s => {
      if (!s.date || s.date < start || s.date > pe) return;
      bar += s.bar_revenue || 0; floor += s.floor_revenue || 0; covers += s.covers || 0; any = true;
    });
    return { bar, floor, covers, any };
  },

  // The confirm's working values: the confirmed record if the week is already in,
  // otherwise the auto-fill from Control.
  _model() {
    const pe = this._weekEnd;
    const pw = (App.data.weeks || []).find(w => w.period_end === pe) || null;
    const rw = (App.data.revenue_weeks || []).find(w => (w.period_end || '').slice(0, 10) === pe) || null;
    const confirmed = !!(pw || rw);

    const sales   = this.salesRollup(pe);
    const barCogs = S.ThisWeek.icCOGS(App.BAR_CATS, pe);
    const foodCogs= S.ThisWeek.icCOGS(App.KITCHEN_CATS, pe);
    const laborSp = S.ThisWeek.laborCost(pe) || { bar: 0, food: 0 };
    const laborTot= (S.RevenueThisWeek.laborFeed(pe)) || { cost: 0, hours: 0 };
    const cat     = S.ThisWeek.cateringFromBookings(pe) || { revenue: '', cogs: '', labor: '' };

    const n = v => (v == null || v === '') ? '' : String(v);
    // Prefer the confirmed record's numbers when editing; else the live feed.
    return {
      pe, confirmed,
      hours: rw && rw.total_hours != null ? rw.total_hours : (laborTot.hours || 0),
      bar: {
        revenue: pw ? n(pw.bar && pw.bar.revenue) : (sales.any ? sales.bar.toFixed(2) : ''),
        cogs:    pw ? n(pw.bar && pw.bar.cogs)    : (barCogs != null ? barCogs.toFixed(2) : ''),
        labor:   pw ? n(pw.bar && pw.bar.labor)   : (laborSp.bar ? laborSp.bar.toFixed(2) : '')
      },
      food: {
        revenue: pw ? n(pw.food && pw.food.revenue) : (sales.any ? sales.floor.toFixed(2) : ''),
        cogs:    pw ? n(pw.food && pw.food.cogs)    : (foodCogs != null ? foodCogs.toFixed(2) : ''),
        labor:   pw ? n(pw.food && pw.food.labor)   : (laborSp.food ? laborSp.food.toFixed(2) : '')
      },
      covers: rw ? n(rw.covers) : (sales.any ? String(sales.covers) : ''),
      catering: cat,
      other:  { revenue: pw ? n(pw.other && pw.other.revenue) : '', cogs: pw ? n(pw.other && pw.other.cogs) : '' },
      platform_fees: pw ? n(pw.platform_fees) : '',
      notes: pw ? (pw.notes || '') : (rw ? (rw.notes || '') : ''),
      // readiness
      ready: {
        pos:   sales.any,
        count: (barCogs != null || foodCogs != null),
        hours: (laborTot.cost > 0 || laborTot.hours > 0)
      }
    };
  },

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    const m = this._model();
    const rangeLabel = App.dateRangeLabel(App.weekStartFor(m.pe), m.pe);
    const money = v => App.fmtCurrency(v || 0, 0);

    // Readiness checklist rows (collapse to one "ready" line when all green).
    const allReady = m.ready.pos && m.ready.count && m.ready.hours;
    const chkRow = (ok, label, go) => '<div class="cw-chk" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--b2);">'
      + '<span style="display:flex;align-items:center;gap:9px;font-size:12px;color:var(--t2);">'
      +   (ok ? '<span style="width:16px;height:16px;border-radius:50%;background:var(--green);color:var(--bg);display:inline-flex;align-items:center;justify-content:center;font-size:10px;">&#10003;</span>'
             : '<span style="width:16px;height:16px;border-radius:50%;border:1px solid var(--b1);display:inline-block;"></span>')
      +   label + '</span>'
      + (ok ? '' : '<button class="btn btn-ghost btn-sm cw-go" data-go="' + go + '">Fix</button>') + '</div>';
    const checklist = allReady
      ? '<div style="font-size:12px;color:var(--green);font-weight:600;margin-bottom:14px;">This week is ready to confirm.</div>'
      : '<div style="margin-bottom:14px;">'
        + chkRow(m.ready.pos,   'POS sales dropped in Shift', 'sc-dashboard')
        + chkRow(m.ready.count, 'Inventory count taken (for COGS)', 'ic-take-inventory')
        + chkRow(m.ready.hours, 'Hours logged in Labor', 'lc-log-hours')
        + '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Missing pieces read as blank. You can still confirm and fill them later.</div>'
        + '</div>';

    // Money picture strip (recomputed live in _recalc).
    const stat = (label, id) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg" id="' + id + '">-</div></div>';
    const moneyStrip = '<div class="card" style="margin:0 0 16px;background:var(--input);"><div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">'
      + stat('Revenue', 'cw-m-rev') + stat('Prime Cost', 'cw-m-prime') + stat('Check Avg', 'cw-m-ca')
      + stat('Labor %', 'cw-m-lp') + stat('RPLH', 'cw-m-rplh') + '</div></div>';

    // Editable grid (Bar / Food rows x Revenue / COGS / Labor). Pill rows, fixed
    // layout so it always fits the modal; overflow-x wrapper (not .pill-wrap) so
    // it stays a table on desktop.
    const cell = id => '<td style="background:#0D181E;"><div class="fw" style="margin:0;"><span class="pre">$</span><input class="form-input pre cw-in" type="number" step="0.01" id="' + id + '" style="width:100%;min-width:0;"/></div></td>';
    const lbl = t => '<td style="font-weight:600;color:var(--t1);background:#0D181E;">' + t + '</td>';
    const grid = '<div style="overflow-x:auto;margin:0 0 16px;"><table class="ing-tbl pill" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:58px;"/><col/><col/><col/></colgroup>'
      + '<thead><tr><th></th><th>Revenue</th><th>COGS</th><th>Labor</th></tr></thead><tbody>'
      + '<tr class="cw-line">' + lbl('Bar') + cell('cw-bar-rev') + cell('cw-bar-cogs') + cell('cw-bar-lab') + '</tr>'
      + '<tr class="cw-line">' + lbl('Food') + cell('cw-food-rev') + cell('cw-food-cogs') + cell('cw-food-lab') + '</tr>'
      + '</tbody></table></div>';

    // Total Covers + Catering Revenue (read-only, from bookings) on one row, the
    // events value vertically centered against the covers input.
    const evRev = parseFloat(m.catering && m.catering.revenue) || 0;
    const coversField = '<div class="form-row" style="gap:24px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div class="f" style="width:150px;"><label>Total Covers</label><input class="cw-in" type="number" step="1" id="cw-covers"/></div>'
      + '<div class="f" style="width:auto;"><label>Catering Revenue</label>'
      +   '<div style="min-height:36px;display:flex;align-items:center;font-size:13px;color:var(--t2);">' + (evRev > 0 ? money(evRev) + ' from bookings' : 'None this week') + '</div></div>'
      + '</div>';

    const manual = '<div style="border-top:1px solid var(--b2);margin:2px 0 16px;"></div>'
      + '<div class="sh" style="margin:0 0 10px;">Optional</div>'
      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
      + '<div class="f" style="width:180px;"><label>Ancillary Revenue</label><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="cw-anc-rev"/></div></div>'
      + '<div class="f" style="width:180px;"><label>Ancillary Cost</label><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="cw-anc-cogs"/></div></div>'
      + '<div class="f" style="width:200px;"><label>Platform / Operating Fees</label><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="cw-fees"/></div></div>'
      + '</div>'
      + App.noteField({ id: 'cw-notes', value: m.notes, mt: 10 });

    const confirmLabel = m.confirmed ? 'Update the Week' : 'Confirm the Week';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Confirm the Week &mdash; ' + esc(rangeLabel) + '</div>'
      + checklist + moneyStrip + grid + coversField + manual
      + '<div class="card-actions"><button class="btn btn-primary" id="cw-save">' + confirmLabel + '</button>'
      +   '<button class="btn btn-ghost" id="cw-refresh">Refresh from Control</button>'
      +   '<span id="cw-err" style="color:var(--red);font-size:12px;align-self:center;display:none;"></span></div>'
      + '</div>';

    App.openModal(html, { id: this.MODAL_ID, maxWidth: 660 });

    // Seed the inputs from the model, then wire live recompute.
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('cw-bar-rev', m.bar.revenue);   set('cw-bar-cogs', m.bar.cogs);   set('cw-bar-lab', m.bar.labor);
    set('cw-food-rev', m.food.revenue); set('cw-food-cogs', m.food.cogs); set('cw-food-lab', m.food.labor);
    set('cw-covers', m.covers);
    set('cw-anc-rev', m.other.revenue); set('cw-anc-cogs', m.other.cogs); set('cw-fees', m.platform_fees);
    this._hours = m.hours;
    this._catering = m.catering;

    document.querySelectorAll('#' + this.MODAL_ID + ' .cw-in').forEach(el => el.addEventListener('input', () => this._recalc()));
    document.querySelectorAll('#' + this.MODAL_ID + ' .cw-go').forEach(el => el.addEventListener('click', () => {
      App.closeModal(this.MODAL_ID); App.openScreen(el.dataset.go);
    }));
    document.getElementById('cw-refresh')?.addEventListener('click', () => this._refresh());
    document.getElementById('cw-save')?.addEventListener('click', () => this._save());
    this._recalc();
  },

  // For cells where zero is a real answer (most weeks book no ancillary revenue
  // and no platform fees).
  _val(id) { return parseFloat(document.getElementById(id)?.value) || 0; },

  // For cells where blank means "not measured yet", which is not the same number
  // as zero. This form deliberately invites a partial close ("Missing pieces read
  // as blank. You can still confirm and fill them later"), so a cell the operator
  // has not filled has to survive as null. Saved as 0 it becomes a measurement: a
  // blank COGS on a $20k bar week reads as a 0% pour cost, which prints "On target"
  // on the leak board and pays out recovered dollars against the biggest leak in
  // the bar, because every guard downstream tests for null, not zero.
  _valOrNull(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const raw = String(el.value == null ? '' : el.value).trim();
    if (raw === '') return null;
    const v = parseFloat(raw);
    return isNaN(v) ? null : v;
  },

  /* The week's numbers, derived in one place so the money strip and the saved
     record can never drift apart. Null in, null out: a percentage whose input was
     never entered is unknown, and it stays unknown all the way into the store.
     ⚠ This half only READS THE FORM. Every line of arithmetic lives in `_derive` below, because
     the S331 count-edit updater has to ask the identical question about a week that is NOT on
     screen — and a second copy of this math is exactly the drift [[the-loop]] #45 keeps finding. */
  _figures() {
    const cat = this._catering || {};
    return this._derive({
      bRev: this._valOrNull('cw-bar-rev'),  bCogs: this._valOrNull('cw-bar-cogs'),  bLab: this._valOrNull('cw-bar-lab'),
      fRev: this._valOrNull('cw-food-rev'), fCogs: this._valOrNull('cw-food-cogs'), fLab: this._valOrNull('cw-food-lab'),
      covers: this._valOrNull('cw-covers'),
      oRev: this._val('cw-anc-rev'), oCogs: this._val('cw-anc-cogs'), fees: this._val('cw-fees'),
      cRev: parseFloat(cat.revenue) || 0, cCogs: parseFloat(cat.cogs) || 0, cLab: parseFloat(cat.labor) || 0,
      hours: this._hours || 0,
      periodEnd: this._weekEnd
    });
  },

  /* The arithmetic, with no DOM in it. Takes the raw cells, returns every figure the money strip
     and the saved record are built from. */
  _derive(r) {
    const nz = v => (v == null ? 0 : v);
    const bRev = r.bRev, bCogs = r.bCogs, bLab = r.bLab;
    const fRev = r.fRev, fCogs = r.fCogs, fLab = r.fLab;
    const covers = r.covers;
    const oRev = r.oRev || 0, oCogs = r.oCogs || 0, fees = r.fees || 0;
    const cRev = r.cRev || 0, cCogs = r.cCogs || 0, cLab = r.cLab || 0;
    const hours = r.hours || 0;

    const totRev = nz(bRev) + nz(fRev) + cRev;
    // Total sales = F&B (bar+food+catering) + ancillary. Prime % and Labor % are measured
    // against TOTAL SALES — the standard restaurant KPI, and what Books/the income statement
    // use — so they foot to the P&L and read the same on every screen. Catering labor is in
    // the numerator too. Check average stays per-cover F&B (ancillary isn't a per-guest check).
    const totSales = totRev + oRev;
    const fbRev = nz(bRev) + nz(fRev);

    // A department only owes a cost and a labor figure once it has rung sales, so a
    // bar with no kitchen leaves every food cell blank forever and still foots.
    const cogsIn  = (!(bRev > 0) || bCogs != null) && (!(fRev > 0) || fCogs != null);
    const laborIn = (!(bRev > 0) || bLab  != null) && (!(fRev > 0) || fLab  != null);

    // Ancillary COST is in prime because ancillary REVENUE is in the denominator
    // (totSales). Left out, logging merch or vending sales mechanically improved prime %
    // for free. There was no input for it at all until 2026-07-16: the retired This Week
    // screen had one, Confirm the Week did not carry it over, so Books' Other COGS line
    // was unfillable and a no-op re-save wiped whatever the seed had written.
    const primeCost = nz(bCogs) + nz(fCogs) + nz(bLab) + nz(fLab) + cCogs + cLab + oCogs;
    const laborCost = nz(bLab) + nz(fLab) + cLab;
    // Hourly (schedulable) labor = bar+food hourly only, minus fixed salaried pay,
    // so the labor-scheduling recovery leak dollarizes only what the weekly schedule
    // can move (catering event crew is event-driven, not weekly-schedulable).
    const salaried = App.salariedCost ? (App.salariedCost(App.weekStartFor(r.periodEnd), r.periodEnd).total || 0) : 0;
    const hourlyLabor = Math.max(0, (nz(bLab) + nz(fLab)) - salaried);

    return {
      bRev, bCogs, bLab, fRev, fCogs, fLab, cRev, cCogs, cLab, oRev, oCogs, fees, covers, hours,
      totRev, totSales, primeCost, laborCost, hourlyLabor,
      // ⚠ S334: these two are RETURNED so the record writer can gate on the SAME fact the
      // percentages below already gate on. Before this, `_save` wrote total_labor_cost and
      // hourly_labor_cost straight off `laborCost`/`hourlyLabor` — which `nz()` has already
      // turned from "not entered" into 0 — so one record said "labor % unknown" and
      // "labor cost $0.00" about the same week. Re-deriving the test in the writer would be a
      // second implementation of it ([[the-loop]] step 0.5); exposing it keeps ONE.
      cogsIn, laborIn,
      barPct:     (bRev > 0 && bCogs != null) ? bCogs / bRev * 100 : null,
      foodPct:    (fRev > 0 && fCogs != null) ? fCogs / fRev * 100 : null,
      barLabPct:  (bRev > 0 && bLab  != null) ? bLab  / bRev * 100 : null,
      foodLabPct: (fRev > 0 && fLab  != null) ? fLab  / fRev * 100 : null,
      primePct:  (cogsIn && laborIn && totSales > 0) ? primeCost / totSales * 100 : null,
      laborPct:  (laborIn && totSales > 0) ? laborCost / totSales * 100 : null,
      hourlyPct: (laborIn && fbRev > 0)    ? hourlyLabor / fbRev * 100 : null,
      checkAvg:  (covers > 0) ? fbRev / covers : null,   // F&B revenue over F&B covers: check average is per-guest, so the numerator must match the cover population (catering revenue has no cover here). Matches the retired This Week screen and the metric's base=covers contract.
      rplh:      (hours  > 0) ? totRev / hours  : null
    };
  },

  /* The `week` record's COMPUTED half — everything that follows from the figures, in ONE place.
     ⚠ TWO doors now write this record: the weekly confirm below, and the S331 count-edit updater.
     [[the-loop]] #54 — the moment a number is produced in two places the test is the EQUALITY, and
     the cheapest way to guarantee it is one implementation. The caller owns the IDENTITY half
     (id, week_num, period_end, saved_at, notes); everything here is derived and nothing else is. */
  _weekShape(f) {
    const t = (App.data.settings && App.data.settings.targets) || {};
    const bTgt = t.bar_pour_cost_pct ?? 22, fTgt = t.food_cost_pct ?? 32;
    return {
      bar:  { revenue: f.bRev, cogs: f.bCogs, labor: f.bLab, cost_pct: f.barPct, labor_pct: f.barLabPct,
              vs_target_pct: f.barPct != null ? f.barPct - bTgt : null,
              vs_target_dollar: f.barPct != null ? ((f.barPct - bTgt) / 100) * f.bRev : null },
      food: { revenue: f.fRev, cogs: f.fCogs, labor: f.fLab, cost_pct: f.foodPct, labor_pct: f.foodLabPct,
              vs_target_pct: f.foodPct != null ? f.foodPct - fTgt : null,
              vs_target_dollar: f.foodPct != null ? ((f.foodPct - fTgt) / 100) * f.fRev : null },
      catering: { revenue: f.cRev, cogs: f.cCogs, labor: f.cLab, cost_pct: f.cRev > 0 ? f.cCogs / f.cRev * 100 : 0, labor_pct: f.cRev > 0 ? f.cLab / f.cRev * 100 : 0 },
      other: { revenue: f.oRev, cogs: f.oCogs },
      platform_fees: f.fees,
      prime_cost_pct: f.primePct
    };
  },

  _recalc() {
    const f = this._figures();
    const t = (App.data.settings && App.data.settings.targets) || {};
    const primeTgt = t.prime_cost_pct ?? 60;
    const caTgt = ((App.data.revenue_settings && App.data.revenue_settings.targets) || {}).check_avg ?? 35;
    const laborTgt = App.laborTargetPct ? App.laborTargetPct() : 30;

    const set = (id, txt, cls) => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.className = 'calc-val lg ' + (cls || ''); } };
    set('cw-m-rev', App.fmtCurrency(f.totSales, 0));
    set('cw-m-prime', f.primePct != null ? f.primePct.toFixed(1) + '%' : '-', f.primePct != null ? (f.primePct > primeTgt ? 'warn' : 'good') : '');
    set('cw-m-ca', f.checkAvg != null ? App.fmtCurrency(f.checkAvg) : '-', f.checkAvg != null ? (f.checkAvg >= caTgt ? 'good' : 'warn') : '');
    set('cw-m-lp', f.laborPct != null ? f.laborPct.toFixed(1) + '%' : '-', f.laborPct != null ? (f.laborPct <= laborTgt ? 'good' : 'warn') : '');
    set('cw-m-rplh', f.rplh != null ? App.fmtCurrency(f.rplh) : '-');
  },

  // Force the Control-sourced cells back to the live auto-fill, overwriting any
  // manual edits (this is what "Refresh from Control" promises). Leaves the
  // manual optional fields (ancillary, fees, notes) alone and does not re-render.
  _refresh() {
    const pe = this._weekEnd;
    const sales   = this.salesRollup(pe);
    const barCogs = S.ThisWeek.icCOGS(App.BAR_CATS, pe);
    const foodCogs= S.ThisWeek.icCOGS(App.KITCHEN_CATS, pe);
    const laborSp = S.ThisWeek.laborCost(pe) || { bar: 0, food: 0 };
    const laborTot= (S.RevenueThisWeek.laborFeed(pe)) || { cost: 0, hours: 0 };
    const auto = {
      'cw-bar-rev':  sales.any ? sales.bar.toFixed(2)   : '',
      'cw-bar-cogs': barCogs != null ? barCogs.toFixed(2) : '',
      'cw-bar-lab':  laborSp.bar ? laborSp.bar.toFixed(2) : '',
      'cw-food-rev': sales.any ? sales.floor.toFixed(2) : '',
      'cw-food-cogs':foodCogs != null ? foodCogs.toFixed(2) : '',
      'cw-food-lab': laborSp.food ? laborSp.food.toFixed(2) : '',
      'cw-covers':   sales.any ? String(sales.covers)   : ''
    };
    const apply = () => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      Object.keys(auto).forEach(id => set(id, auto[id]));
      this._hours = laborTot.hours || 0;
      this._recalc();
    };
    // Only warn if a Control-sourced cell actually differs from the fresh pull.
    const num = v => parseFloat(v) || 0;
    const edited = Object.keys(auto).some(id => num(document.getElementById(id) && document.getElementById(id).value) !== num(auto[id]));
    if (!edited) { apply(); return; }
    App.confirm({
      title: 'Refresh from Control?',
      message: 'This replaces the numbers you manually entered with the latest calculated numbers from your Control data.',
      confirmText: 'Update from Control',
      cancelText: 'Keep My Numbers',
      danger: false
    }).then(ok => { if (ok) apply(); });
  },

  async _save() {
    const pe = this._weekEnd;
    const err = document.getElementById('cw-err');
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'inline'; } };
    if (err) err.style.display = 'none';

    const f = this._figures();
    const notes = (document.getElementById('cw-notes')?.value || '').trim();

    /* ⚠⚠ NEGATIVE REVENUE IS REFUSED HERE THE WAY BOTH DAY DOORS ALREADY REFUSE IT (H-class field 6).
       Four sites write bar/floor revenue, at two grains, and they split by grain: the POS import
       (`PosIngest.buildSales`) treats a negative day aggregate as an unusable column, keeps the
       prior figure and REPORTS it; the manual sales grid refuses and NAMES THE DAY. This door, the
       weekly close, had exactly one guard — `totRev === 0` — so a bar of -4,500 against 6,000 of
       food netted positive and sailed straight through. Measured on the live build: totRev $3,390
       on a $6,000 food week, prime cost 336.4%, check average $3.00, and it saves. That one record
       is the week: it writes BOTH the profit `week` and the `revenue_week`, which feed Books,
       Recovery's leak dollars, the cash engine's revenue baseline, the Hub, both audits and the
       forecast. `pos-ingest.js` already carries a comment describing this exact failure at the day
       grain; the fix went to the day and the week grain never learned it ([[the-loop]] #45).
       `<input type="number">` stops nothing: no cell here carries `min` and nothing calls
       checkValidity, so the field hands back "-4500" quite happily.
       ⚠ BEFORE the zero check, not after: -100 bar against +100 food sums to exactly 0, and the
       operator would have been told to "enter a revenue figure" about figures they had entered.
       ⚠ EVERY offending cell is named in ONE message. Refusing them one save at a time is the
       drip-feed the bulk-hours door was fixed for.
       ⚠ COGS AND LABOR ARE DELIBERATELY NOT HERE. A weekly COGS can legitimately come out negative
       (usage = opening + purchases - closing, and a big delivery landing on the last day can push
       closing above the rest), so a blanket refusal would refuse real data — a defect with a
       support call attached. Every cell guarded below has a day-level twin that already refuses,
       so this is grains agreeing, not a new rule. */
    const negLabels = [['Bar revenue', f.bRev], ['Food revenue', f.fRev],
                       ['Ancillary revenue', f.oRev], ['Total covers', f.covers]]
      .filter(c => c[1] != null && c[1] < 0).map(c => c[0]);
    if (negLabels.length) {
      const names = negLabels.length === 1 ? negLabels[0]
        : negLabels.slice(0, -1).join(', ') + ' and ' + negLabels[negLabels.length - 1];
      fail(names + ' cannot be negative.');
      return;
    }
    if (f.totRev === 0) { fail('Enter at least one revenue figure before confirming.'); return; }

    // ── Profit `week` record ──
    const pw = (App.data.weeks || []).find(w => w.period_end === pe) || null;
    const week = Object.assign({
      id: pw ? pw.id : App.uid(),
      week_num: pw ? pw.week_num : App.weekNumFor(App.data.weeks || [], pe),
      period_end: pe,
      saved_at: new Date().toISOString()
    }, this._weekShape(f), { notes: notes });

    // ── Revenue `revenue_week` record ──
    const rw = (App.data.revenue_weeks || []).find(w => (w.period_end || '').slice(0, 10) === pe) || null;
    // Total labor INCLUDES catering labor, consistent with prime_cost_pct and the
    // locked "total labor drives every labor% number" rule. It was dropping cLab
    // while the denominator (totRev) kept catering revenue, understating labor%.
    const r2 = v => (v == null ? null : parseFloat(v.toFixed(2)));
    const rweek = {
      id: rw ? rw.id : App.uid(),
      week_num: rw ? rw.week_num : App.weekNumFor(App.data.revenue_weeks || [], pe),
      period_end: pe,
      bar_revenue: f.bRev,
      floor_revenue: f.fRev,
      // Carried so Recovery can dollarize labor_pct_blended against the denominator it
      // was actually measured with (total sales). Without these the record could only
      // reach bar+food, and a point of a total-sales % dollarized against bar+food ran
      // light by exactly catering's and ancillary's share. See recovery.js _rTotSales.
      catering_revenue: f.cRev,
      other_revenue: f.oRev,
      covers: f.covers,
      check_avg: r2(f.checkAvg),
      // ⚠ S334: NULL when labor was never entered, never 0. `nz()` turns a blank cell into 0
      // upstream so the arithmetic can run, but a week nobody typed labor into did not measure
      // zero labor, and storing 0 says it did — on the record Books, Recovery and break-even
      // all read. Same `laborIn` that already governs labor_pct_blended two lines down, so the
      // record can no longer say "percentage unknown" and "cost $0.00" in one breath.
      total_labor_cost: f.laborIn ? f.laborCost : null,
      hourly_labor_cost: f.laborIn ? parseFloat(f.hourlyLabor.toFixed(2)) : null,
      total_hours: f.hours,
      labor_pct_blended: r2(f.laborPct),
      // Hourly labor % divides by BAR + FOOD revenue, matching its own numerator.
      // hourlyLabor is bar+food hourly pay with catering crew deliberately left out
      // (event-driven, not weekly-schedulable), so dividing it by totRev, which carries
      // catering REVENUE, measured a bar+food cost against bar+food+catering sales and
      // read low on every week with an event. It also disagreed with the two things that
      // consume it: Recovery dollarizes a point of this against bar_revenue +
      // floor_revenue (recovery.js), and the Anchor seed already computes it over
      // bar+food. So the leak dollars ran light by catering's share of the week.
      // (labor_pct_blended stays on totSales: that is the P&L number, total labor against
      // total sales, and it ties to Books. Different metric, different basis, on purpose.)
      hourly_labor_pct: r2(f.hourlyPct),
      rplh_blended: r2(f.rplh),
      notes: notes,
      saved_at: new Date().toISOString()
    };

    const btn = document.getElementById('cw-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const okP = await App.putRecord('core', 'week', week);
    const okR = await App.putRecord('core', 'revenue_week', rweek);
    if (okP && okR) {
      // Confirming a back-filled week slots it in ahead of weeks already logged, so
      // every later week's number shifts up one. Re-rank both stores off period_end
      // and persist only the records that actually moved (none on the normal path,
      // where the week being confirmed is already the latest).
      // renumberWeekStore re-ranks IN PLACE and hands back only the rows that moved. A bulk write
      // cannot revert itself, so a failed re-rank used to leave memory showing week numbers the
      // server does not have. The confirm itself already succeeded above and stands; only the
      // renumbering is rolled back, and the next confirm re-ranks from the server's truth.
      const undoP = App.snapshotRows(App.data.weeks || []);
      const undoR = App.snapshotRows(App.data.revenue_weeks || []);
      const movedP = App.renumberWeekStore(App.data.weeks || []);
      const movedR = App.renumberWeekStore(App.data.revenue_weeks || []);
      let okRank = movedP.length ? await App.putRecordsBulk('core', 'week', movedP) : true;
      if (okRank && movedR.length) okRank = await App.putRecordsBulk('core', 'revenue_week', movedR);
      if (!okRank) { App.restoreRows(undoP); App.restoreRows(undoR); }
      if (App.markSetupDone) { App.markSetupDone('gs_p_week'); App.markSetupDone('gs_r_week'); }
      if (App.updatePeriod) App.updatePeriod();
      App.closeModal(this.MODAL_ID);
      if (this._onDone) this._onDone();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm the Week'; }
      fail('Could not save. Try again.');
    }
  },

  /* ── S331: WHAT WOULD A CORRECTED COUNT DO TO THE WEEKS ALREADY CONFIRMED? ────────────────────
     Kyle: *"a submitted count that has been included in a confirmed week.. can't it just still have
     an edit button that when it is changed and submitted a popup just says 'this count is included
     in this confirmed week and the count will adjust in that week'?"* The alternative — re-open the
     week, go to inventory, edit, come back, re-confirm — is exactly the hoops this app exists to
     remove. And it opens no new hole: a confirmed week's figures are ALREADY editable from Week
     History, which reuses this same popup and writes back to these same records. The old lock froze
     the SOURCE while leaving the RESULT freely editable.

     ⚠⚠ MORE THAN ONE WEEK MOVES. A count is the END of one usage pair and the START of the next, so
     correcting count N moves the week whose pair ends at N *and* the one ending at N+1 — and it does
     not stop at two: `icCOGS` will price a week off a pair up to nine days stale, so a week
     confirmed early can share a pair with the week before it and three move at once. Rather than
     re-deriving which weeks those are — a second copy of icCOGS's pair-and-span rules, which is how
     [[the-loop]] #45 keeps biting — this asks EVERY confirmed week the question twice, once against
     the stored counts and once against the corrected set, and reports the ones whose answer moved.
     No window is assumed, so no future change to icCOGS can leave this behind, and nothing in the
     copy may quote a count.

     ⚠ THE COMPARISON IS AT CENT GRANULARITY on purpose. `submit()` rebuilds a count's items from the
     live sheet, so an untouched re-save can reorder the summation and move a total by 1e-12. Money
     is measured in cents; a float artefact is not a change an operator made. */
  cogsImpact(nextCounts) {
    /* ⚠ ONE ROW PER `period_end`, and it must be the SAME row `_save` would edit. Duplicate week
       records are a shape this codebase already documents as reachable (app.js: two devices saving
       for one untouched week leave two rows), and `_save` resolves them with `.find`, so only the
       first is ever editable from the UI. Without this, a correction listed the same week twice in
       the popup with identical figures and wrote both — including the row nothing can reach. */
    const seenPe = new Set();
    const weeks = ((App.data && App.data.weeks) || []).filter(w => {
      const pe = w && String(w.period_end || '').slice(0, 10);
      if (!pe || seenPe.has(pe)) return false;
      seenPe.add(pe);
      return true;
    });
    const inv = App.inventoryData;
    if (!weeks.length || !inv || !Array.isArray(nextCounts)) return [];
    const cents = v => (v == null ? null : Math.round(v * 100));
    const r2 = v => (v == null ? null : Math.round(v * 100) / 100);
    const num = (o, k) => (o && o[k] != null) ? o[k] : null;
    const read = () => weeks.map(w => {
      const pe = String(w.period_end).slice(0, 10);
      return { bar: S.ThisWeek.icCOGS(App.BAR_CATS, pe), food: S.ThisWeek.icCOGS(App.KITCHEN_CATS, pe) };
    });

    /* ⚠⚠ THE STORE IS BORROWED, AND EVERY EXIT PUTS IT BACK ([[the-loop]] #49). `icCOGS` reads
       `App.inventoryData.ic_counts` directly, so the only way to ask "what would this count do" with
       the SHIPPED reader — rather than a second implementation of it — is to swap the array for the
       length of one synchronous call. `finally`, not a happy path: a throw in the middle would
       otherwise leave the app looking at a count that has not been saved. */
    const original = inv.ic_counts;
    let was, now;
    try {
      was = read();
      inv.ic_counts = nextCounts;
      now = read();
    } finally {
      inv.ic_counts = original;
    }

    const out = [];
    weeks.forEach((w, i) => {
      /* ⚠ `isFinite` on each side, NOT `!= null`. Two reasons and both matter: a correction that
         makes a week's COGS UNCOMPUTABLE must never erase the figure that was signed off (icCOGS
         says nothing rather than inventing a number, and writing its null over a confirmed week
         would be inventing a zero) — and a NaN passes every `!= null` test while making
         `cents(NaN) !== cents(x)` true for ANY x, so it would report a phantom move and write NaN
         into the record. Nothing may be written that is not a real number. */
      const barMoved  = Number.isFinite(now[i].bar)  && cents(now[i].bar)  !== cents(was[i].bar);
      const foodMoved = Number.isFinite(now[i].food) && cents(now[i].food) !== cents(was[i].food);
      /* ⚠ THE GATE IS "DID THE COUNT-DERIVED VALUE MOVE", NOT "does the stored value differ". Those
         cells are hand-editable and Refresh from Control is opt-in, so a typed COGS legitimately
         disagrees with the counts forever. Gating on the stored value would offer to overwrite that
         typing on every unrelated count edit ([[user-chooses-conflicts]]). */
      if (!barMoved && !foodMoved) return;
      const pe = String(w.period_end).slice(0, 10);
      const storedBar = num(w.bar, 'cogs'), storedFood = num(w.food, 'cogs');
      const nextBar  = barMoved  ? r2(now[i].bar)  : storedBar;
      const nextFood = foodMoved ? r2(now[i].food) : storedFood;
      const f = this._derive({
        bRev: num(w.bar, 'revenue'),  bCogs: nextBar,  bLab: num(w.bar, 'labor'),
        fRev: num(w.food, 'revenue'), fCogs: nextFood, fLab: num(w.food, 'labor'),
        covers: null, hours: 0,
        oRev: num(w.other, 'revenue') || 0, oCogs: num(w.other, 'cogs') || 0,
        fees: w.platform_fees || 0,
        cRev: num(w.catering, 'revenue') || 0,
        cCogs: num(w.catering, 'cogs') || 0,
        cLab: num(w.catering, 'labor') || 0,
        periodEnd: pe
      });
      /* ⚠ A FACT WORTH SAYING OUT LOUD, AND IT COSTS NOTHING TO KNOW. When `was` is null the count
         feed could NOT price that week at the time it was confirmed, so a figure that IS stored was
         typed into the Confirm the Week form — the cell would have been blank. That is not an
         inference from a flag (the S140 / [[the-loop]] #37 trap, where an edit inherits the flag and
         "how did this get here" is unanswerable); it is measured, from the same reader. Saying it
         is what stops "Save and Update the Week" quietly replacing an operator's own arithmetic.
         ⚠⚠ AND IT NEEDS BOTH HALVES. The first version tested only "the feed could not price it",
         which is ALSO true when the operator left the cell blank — the form invites exactly that
         ("Missing pieces read as blank. You can still confirm and fill them later"). On a new bar
         with one count that produced a box reading "Bar COGS not set → $2,801.12" directly above
         the sentence "so the figure in it was typed in", and then advised protecting a value that
         does not exist. A claim about a figure has to check the figure is there. */
      /* ⚠⚠ PER FIGURE, NOT PER WEEK. The first version ORed the two sides and hung ONE sentence off
         the week block — and `icCOGS` answers per CATEGORY SET, so a bar with no kitchen products
         gets a count-derived Bar COGS and a TYPED Food COGS in the same confirmed week. The box
         then listed both figures and said "the figure in it was typed in", which is false about the
         bar one. A claim about a figure belongs to that figure. */
      /* ⚠ `Number.isFinite`, matching what `money()` renders with — `!= null` is true for NaN, and
         a NaN stored figure prints as "not set", so the two tests disagreeing produced
         "Bar COGS not set (you typed this) → $2,801.12". One value, one test. */
      const barTyped  = barMoved  && was[i].bar  == null && Number.isFinite(storedBar);
      const foodTyped = foodMoved && was[i].food == null && Number.isFinite(storedFood);
      /* ⚠ NO WEEK-LEVEL `typedBefore` FIELD. It was emitted for one round and then read nowhere
         once the tag moved onto the figure — a field computed, carried and never read is a fix that
         never shipped ([[the-loop]] #25), and it invites the next reader to use the coarse answer. */
      out.push({
        period_end: pe,
        label: App.dateRangeLabel('', pe),
        bar:  { from: storedBar,  to: nextBar,  moved: barMoved,  typed: barTyped },
        food: { from: storedFood, to: nextFood, moved: foodMoved, typed: foodTyped },
        prime: { from: num(w, 'prime_cost_pct'), to: f.primePct },
        /* The identity half survives untouched; `_weekShape` replaces exactly the derived half, so
           the percentages can never be left describing the old COGS ([[the-loop]] #42). */
        record: Object.assign({}, w, this._weekShape(f), { saved_at: new Date().toISOString() })
      });
    });
    return out.sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
  },

  /* ONE popup naming every affected week with real before/after figures.
     Three answers, because there genuinely are three: 'update' (save the count and move the weeks),
     'count-only' (save the count, leave the confirmed figures alone — which is what protects a
     hand-typed COGS without ever having to work out where it came from, the S140 / #37 trap), and
     'cancel', which Esc and a click outside both resolve to, so an accidental dismiss saves
     nothing at all. */
  /* ⚠⚠ `isEdit` — THE WORDS ARE A CLAIM ABOUT WHICH ACTIVITY THE OPERATOR IS IN ([[the-loop]] #79),
     AND "correction" IS FALSE ON THE MOST ORDINARY PATH THERE IS. The Profit and Revenue cockpits
     both confirm `App.nextSunday()`, i.e. the week that is still RUNNING, and this popup's own
     sibling copy invites it ("Missing pieces read as blank. You can still confirm and fill them
     later"). So: confirm on Wednesday, take the normal weekly count on Sunday, and that BRAND NEW
     count lands inside the confirmed week and moves its COGS. Calling that "this correction" tells
     a first-time counter they are rewriting signed-off history, and it makes "Save the Count Only"
     read as the careful answer -- when on that path it is the one that leaves the week holding LAST
     week's usage as this week's cost of goods. */
  async askCogsImpact(impacts, isEdit) {
    if (!impacts || !impacts.length) return 'count-only';
    /* ⚠ `isFinite`, not `!= null` — `App.fmtCurrency` returns a bare SPACE for NaN, so a corrupt
       stored figure would render as "Bar COGS   → $2,801.12" and read like a blank cell rather than
       a value nobody can vouch for. */
    const money = v => (Number.isFinite(v) ? App.fmtCurrency(v) : 'not set');
    const p1 = v => (Number.isFinite(v) ? v.toFixed(1) + '%' : 'not set');
    // "(you typed this)" rides on the FIGURE it is true of, never on the week block.
    const tag = t => (t ? ' (you typed this)' : '');
    const lines = impacts.map(i => {
      const bits = [];
      if (i.bar.moved)  bits.push('Bar COGS ' + money(i.bar.from) + tag(i.bar.typed) + ' → ' + money(i.bar.to));
      if (i.food.moved) bits.push('Food COGS ' + money(i.food.from) + tag(i.food.typed) + ' → ' + money(i.food.to));
      if (i.prime.from != null || i.prime.to != null) bits.push('Prime ' + p1(i.prime.from) + ' → ' + p1(i.prime.to));
      return 'Week ending ' + i.label + '\n' + bits.join('  ·  ');
    });
    /* ⚠ NOTHING HERE MAY SAY "BOTH". Two is the common case, not the bound: a count closes one
       week's pair and opens the next, and `icCOGS` will price a week off a pair up to nine days
       stale — so a week confirmed early can share a pair with the week before it and THREE move at
       once. The first version said "both of them" under a title reading "sits inside 3 confirmed
       weeks", contradicting itself in one box. Count-agnostic wording only. */
    const many = impacts.length > 1;
    /* ⚠ THE FIGURE PLURAL IS ITS OWN COUNT. It was driven by `many`, which counts WEEKS — so one
       week with both bar and food moving (an ordinary Full count against the running week) printed
       "leave the confirmed figure exactly where it is" directly under a block listing two. */
    const figs = impacts.reduce((n, i) => n + (i.bar.moved ? 1 : 0) + (i.food.moved ? 1 : 0), 0);
    /* ⚠ A THIRD COUNT, AND IT IS NOT `figs`. Two figures can move while exactly ONE of them was
       typed, which read "including the ones you typed" about a single figure. Weeks, moved figures
       and typed figures are three different collections; each sentence uses its own. */
    const typedFigs = impacts.reduce((n, i) => n + (i.bar.typed ? 1 : 0) + (i.food.typed ? 1 : 0), 0);
    const anyTyped = typedFigs > 0;
    const lead = isEdit
      ? (many
          ? 'A count closes one week and opens the next, and a week confirmed early can share a count pair with the week before it. This correction changes the cost of goods every one of these weeks was confirmed with:'
          : 'This correction changes the cost of goods that week was confirmed with:')
      : (many
          ? 'You have already confirmed these weeks, and this count is what prices their cost of goods:'
          : 'You have already confirmed that week, and this count is what prices its cost of goods:');
    const ans = await App.confirm({
      /* ⚠ "SITS INSIDE" WAS FALSE THE MOMENT MORE THAN ONE WEEK WAS LISTED. A count carries one
         date and confirmed weeks do not overlap, so it sits inside exactly ONE — the others move
         because a count ENDS one usage pair and STARTS the next, which is a different sentence. The
         title now says what the box is actually about: what this changes. */
      title: many ? 'This changes ' + impacts.length + ' weeks you have already confirmed'
                  : 'This changes a week you have already confirmed',
      message: lead + '\n\n' + lines.join('\n\n')
        /* ⚠ THE STEER IS SCOPED, AND READING THE RENDERED BOX IS WHAT CAUGHT IT ([[the-loop]] #34).
           Printing all four modes side by side showed "…so the figure in it was typed in." and then,
           three lines down, "Updating is usually what you want." Both sentences were true and they
           must not share a box: once we KNOW the operator typed the figure, a default is exactly
           what [[user-chooses-conflicts]] forbids. Nothing typed → the steer stands, because on a
           first-time count "save the count only" silently leaves last week's usage in place. */
        + '\n\n' + (isEdit
            ? 'Update ' + (many ? 'them' : 'it') + ' now, or save the count on its own and leave the '
              + 'confirmed figure' + (figs > 1 ? 's' : '') + ' exactly where ' + (figs > 1 ? 'they are' : 'it is') + '.'
            : anyTyped
              ? 'Updating replaces every figure above with what the counts say, including the one'
                + (typedFigs > 1 ? 's' : '') + ' you typed. Save the count on its own to keep what is there.'
              : 'Updating is usually what you want: it puts this count\'s real usage into '
                + (many ? 'those weeks' : 'that week') + '. Save the count on its own only if you '
                + 'typed ' + (figs > 1 ? 'those figures' : 'that figure') + ' in by hand and want to keep '
                + (figs > 1 ? 'them' : 'it') + '.'),
      confirmText: many ? 'Save and Update the Weeks' : 'Save and Update the Week',
      altText: 'Save the Count Only',
      cancelText: 'Cancel',
      danger: false,
      /* ⚠ MEASURED, not chosen. The three rendered buttons come to 88 + 182 + 227 px plus 20 px of
         gaps = 517, against 464 px of content at the old 520 — so the row wrapped and dropped the
         PRIMARY alone onto a second line under the two ghosts, leaving Cancel reading first. 620
         gives 564 px and they sit on one line. `flex-wrap` stays on as the small-screen fallback. */
      maxWidth: 620
    });
    return ans === true ? 'update' : (ans === 'alt' ? 'count-only' : 'cancel');
  },

  /* Write the records cogsImpact built. Reports which weeks did NOT land rather than swallowing a
     failure — a week that silently kept its old COGS while the count moved is the divergence this
     whole item exists to close. */
  async applyCogsImpact(impacts) {
    const failed = [];
    for (let i = 0; i < (impacts || []).length; i++) {
      const ok = await App.putRecord('core', 'week', impacts[i].record);
      if (!ok) failed.push(impacts[i].label || impacts[i].period_end);
    }
    if (!failed.length && App.updatePeriod) App.updatePeriod();
    return { ok: failed.length === 0, failed };
  }
};
