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

    // Total Covers + Events Revenue (read-only, from bookings) on one row, the
    // events value vertically centered against the covers input.
    const evRev = parseFloat(m.catering && m.catering.revenue) || 0;
    const coversField = '<div class="form-row" style="gap:24px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div class="f" style="width:150px;"><label>Total Covers</label><input class="cw-in" type="number" step="1" id="cw-covers"/></div>'
      + '<div class="f" style="width:auto;"><label>Events Revenue</label>'
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
     never entered is unknown, and it stays unknown all the way into the store. */
  _figures() {
    const nz = v => (v == null ? 0 : v);
    const bRev = this._valOrNull('cw-bar-rev'),  bCogs = this._valOrNull('cw-bar-cogs'),  bLab = this._valOrNull('cw-bar-lab');
    const fRev = this._valOrNull('cw-food-rev'), fCogs = this._valOrNull('cw-food-cogs'), fLab = this._valOrNull('cw-food-lab');
    const covers = this._valOrNull('cw-covers');
    const oRev = this._val('cw-anc-rev'), oCogs = this._val('cw-anc-cogs'), fees = this._val('cw-fees');
    const cat = this._catering || {};
    const cRev = parseFloat(cat.revenue) || 0, cCogs = parseFloat(cat.cogs) || 0, cLab = parseFloat(cat.labor) || 0;
    const hours = this._hours || 0;

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
    const salaried = App.salariedCost ? (App.salariedCost(App.weekStartFor(this._weekEnd), this._weekEnd).total || 0) : 0;
    const hourlyLabor = Math.max(0, (nz(bLab) + nz(fLab)) - salaried);

    return {
      bRev, bCogs, bLab, fRev, fCogs, fLab, cRev, cCogs, cLab, oRev, oCogs, fees, covers, hours,
      totRev, totSales, primeCost, laborCost, hourlyLabor,
      barPct:     (bRev > 0 && bCogs != null) ? bCogs / bRev * 100 : null,
      foodPct:    (fRev > 0 && fCogs != null) ? fCogs / fRev * 100 : null,
      barLabPct:  (bRev > 0 && bLab  != null) ? bLab  / bRev * 100 : null,
      foodLabPct: (fRev > 0 && fLab  != null) ? fLab  / fRev * 100 : null,
      primePct:  (cogsIn && laborIn && totSales > 0) ? primeCost / totSales * 100 : null,
      laborPct:  (laborIn && totSales > 0) ? laborCost / totSales * 100 : null,
      hourlyPct: (laborIn && fbRev > 0)    ? hourlyLabor / fbRev * 100 : null,
      checkAvg:  (covers > 0) ? totRev / covers : null,
      rplh:      (hours  > 0) ? totRev / hours  : null
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

    if (f.totRev === 0) { fail('Enter at least one revenue figure before confirming.'); return; }

    const t = (App.data.settings && App.data.settings.targets) || {};
    const bTgt = t.bar_pour_cost_pct ?? 22, fTgt = t.food_cost_pct ?? 32;

    // ── Profit `week` record ──
    const pw = (App.data.weeks || []).find(w => w.period_end === pe) || null;
    const week = {
      id: pw ? pw.id : App.uid(),
      week_num: pw ? pw.week_num : App.weekNumFor(App.data.weeks || [], pe),
      period_end: pe,
      saved_at: new Date().toISOString(),
      bar:  { revenue: f.bRev, cogs: f.bCogs, labor: f.bLab, cost_pct: f.barPct, labor_pct: f.barLabPct,
              vs_target_pct: f.barPct != null ? f.barPct - bTgt : null,
              vs_target_dollar: f.barPct != null ? ((f.barPct - bTgt) / 100) * f.bRev : null },
      food: { revenue: f.fRev, cogs: f.fCogs, labor: f.fLab, cost_pct: f.foodPct, labor_pct: f.foodLabPct,
              vs_target_pct: f.foodPct != null ? f.foodPct - fTgt : null,
              vs_target_dollar: f.foodPct != null ? ((f.foodPct - fTgt) / 100) * f.fRev : null },
      catering: { revenue: f.cRev, cogs: f.cCogs, labor: f.cLab, cost_pct: f.cRev > 0 ? f.cCogs / f.cRev * 100 : 0, labor_pct: f.cRev > 0 ? f.cLab / f.cRev * 100 : 0 },
      other: { revenue: f.oRev, cogs: f.oCogs },
      platform_fees: f.fees,
      prime_cost_pct: f.primePct,
      notes: notes
    };

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
      total_labor_cost: f.laborCost,
      hourly_labor_cost: parseFloat(f.hourlyLabor.toFixed(2)),
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
      const movedP = App.renumberWeekStore(App.data.weeks || []);
      const movedR = App.renumberWeekStore(App.data.revenue_weeks || []);
      if (movedP.length) await App.putRecordsBulk('core', 'week', movedP);
      if (movedR.length) await App.putRecordsBulk('core', 'revenue_week', movedR);
      if (App.markSetupDone) { App.markSetupDone('gs_p_week'); App.markSetupDone('gs_r_week'); }
      if (App.updatePeriod) App.updatePeriod();
      App.closeModal(this.MODAL_ID);
      if (this._onDone) this._onDone();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm the Week'; }
      fail('Could not save. Try again.');
    }
  }
};
