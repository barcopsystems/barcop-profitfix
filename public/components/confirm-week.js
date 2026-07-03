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
    const moneyStrip = '<div class="card" style="margin:0 0 16px;"><div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">'
      + stat('Revenue', 'cw-m-rev') + stat('Prime Cost', 'cw-m-prime') + stat('Check Avg', 'cw-m-ca')
      + stat('Labor %', 'cw-m-lp') + stat('RPLH', 'cw-m-rplh') + '</div></div>';

    // Editable grid (Bar / Food rows x Revenue / COGS / Labor) + covers.
    const cell = id => '<td><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="' + id + '"/></div></td>';
    const grid = '<div class="card" style="padding:0;overflow:hidden;margin:0 0 14px;"><table class="ing-tbl" style="width:100%;">'
      + '<thead><tr><th style="width:110px;"></th><th>Revenue</th><th>COGS</th><th>Labor</th></tr></thead><tbody>'
      + '<tr class="cw-line"><td style="font-weight:600;color:var(--t1);">Bar</td>' + cell('cw-bar-rev') + cell('cw-bar-cogs') + cell('cw-bar-lab') + '</tr>'
      + '<tr class="cw-line"><td style="font-weight:600;color:var(--t1);">Food</td>' + cell('cw-food-rev') + cell('cw-food-cogs') + cell('cw-food-lab') + '</tr>'
      + '</tbody></table></div>';

    const coversField = '<div class="form-row" style="gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div class="f" style="width:150px;"><label>Total Covers</label><input class="cw-in" type="number" step="1" id="cw-covers"/></div>'
      + (m.catering && (m.catering.revenue || m.catering.cogs || m.catering.labor)
          ? '<div class="f" style="width:auto;"><label>Catering (from bookings)</label><div style="font-size:13px;color:var(--t2);padding-top:7px;">' + money(parseFloat(m.catering.revenue) || 0) + ' revenue, read-only</div></div>'
          : '')
      + '</div>';

    const manual = '<div class="sh" style="margin:6px 0 10px;">Optional</div>'
      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div class="f" style="width:160px;"><label>Ancillary Revenue</label><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="cw-anc-rev"/></div></div>'
      + '<div class="f" style="width:160px;"><label>Its Cost</label><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="cw-anc-cogs"/></div></div>'
      + '<div class="f" style="width:180px;"><label>Platform / Operating Fees</label><div class="fw"><span class="pre">$</span><input class="pre cw-in" type="number" step="0.01" id="cw-fees"/></div></div>'
      + '</div>'
      + '<div class="f" style="width:100%;margin-bottom:4px;"><label>Notes</label><textarea class="notes-ta" rows="2" id="cw-notes"></textarea></div>';

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
    set('cw-notes', m.notes);
    this._hours = m.hours;
    this._catering = m.catering;

    document.querySelectorAll('#' + this.MODAL_ID + ' .cw-in').forEach(el => el.addEventListener('input', () => this._recalc()));
    document.querySelectorAll('#' + this.MODAL_ID + ' .cw-go').forEach(el => el.addEventListener('click', () => {
      App.closeModal(this.MODAL_ID); App.openScreen(el.dataset.go);
    }));
    document.getElementById('cw-refresh')?.addEventListener('click', () => this._render());
    document.getElementById('cw-save')?.addEventListener('click', () => this._save());
    this._recalc();
  },

  _val(id) { return parseFloat(document.getElementById(id)?.value) || 0; },

  _recalc() {
    const bRev = this._val('cw-bar-rev'), bCogs = this._val('cw-bar-cogs'), bLab = this._val('cw-bar-lab');
    const fRev = this._val('cw-food-rev'), fCogs = this._val('cw-food-cogs'), fLab = this._val('cw-food-lab');
    const covers = this._val('cw-covers');
    const cat = this._catering || {};
    const cRev = parseFloat(cat.revenue) || 0, cCogs = parseFloat(cat.cogs) || 0, cLab = parseFloat(cat.labor) || 0;
    const totRev = bRev + fRev + cRev;
    const primeCost = bCogs + fCogs + bLab + fLab + cCogs + cLab;
    const t = (App.data.settings && App.data.settings.targets) || {};
    const primeTgt = t.prime_cost_pct ?? 60;
    const primePct = totRev > 0 ? primeCost / totRev * 100 : null;
    const checkAvg = covers > 0 ? totRev / covers : null;
    const laborCost = bLab + fLab;
    const laborPct = totRev > 0 ? laborCost / totRev * 100 : null;
    const rplh = this._hours > 0 ? totRev / this._hours : null;
    const caTgt = ((App.data.revenue_settings && App.data.revenue_settings.targets) || {}).check_avg ?? 35;
    const laborTgt = App.laborTargetPct ? App.laborTargetPct() : 30;

    const set = (id, txt, cls) => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.className = 'calc-val lg ' + (cls || ''); } };
    set('cw-m-rev', App.fmtCurrency(totRev, 0));
    set('cw-m-prime', primePct != null ? primePct.toFixed(1) + '%' : '-', primePct != null ? (primePct > primeTgt ? 'warn' : 'good') : '');
    set('cw-m-ca', checkAvg != null ? App.fmtCurrency(checkAvg) : '-', checkAvg != null ? (checkAvg >= caTgt ? 'good' : 'warn') : '');
    set('cw-m-lp', laborPct != null ? laborPct.toFixed(1) + '%' : '-', laborPct != null ? (laborPct <= laborTgt ? 'good' : 'warn') : '');
    set('cw-m-rplh', rplh != null ? App.fmtCurrency(rplh) : '-');
  },

  async _save() {
    const pe = this._weekEnd;
    const err = document.getElementById('cw-err');
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'inline'; } };
    if (err) err.style.display = 'none';

    const bRev = this._val('cw-bar-rev'), bCogs = this._val('cw-bar-cogs'), bLab = this._val('cw-bar-lab');
    const fRev = this._val('cw-food-rev'), fCogs = this._val('cw-food-cogs'), fLab = this._val('cw-food-lab');
    const covers = this._val('cw-covers');
    const oRev = this._val('cw-anc-rev'), oCogs = this._val('cw-anc-cogs'), fees = this._val('cw-fees');
    const notes = (document.getElementById('cw-notes')?.value || '').trim();
    const cat = this._catering || {};
    const cRev = parseFloat(cat.revenue) || 0, cCogs = parseFloat(cat.cogs) || 0, cLab = parseFloat(cat.labor) || 0;

    if (bRev + fRev + cRev === 0) { fail('Enter at least one revenue figure before confirming.'); return; }

    const t = (App.data.settings && App.data.settings.targets) || {};
    const bTgt = t.bar_pour_cost_pct ?? 22, fTgt = t.food_cost_pct ?? 32;
    const totRev = bRev + fRev + cRev;
    const primeCost = bCogs + fCogs + bLab + fLab + cCogs + cLab;
    const bPct = bRev > 0 ? bCogs / bRev * 100 : 0;
    const fPct = fRev > 0 ? fCogs / fRev * 100 : 0;

    // ── Profit `week` record ──
    const pw = (App.data.weeks || []).find(w => w.period_end === pe) || null;
    const week = {
      id: pw ? pw.id : App.uid(),
      week_num: pw ? pw.week_num : (App.nextWeekNum ? App.nextWeekNum() : ((App.data.weeks || []).length + 1)),
      period_end: pe,
      saved_at: new Date().toISOString(),
      bar:  { revenue: bRev, cogs: bCogs, labor: bLab, cost_pct: bPct, labor_pct: bRev > 0 ? bLab / bRev * 100 : 0, vs_target_pct: bPct - bTgt, vs_target_dollar: ((bPct - bTgt) / 100) * bRev },
      food: { revenue: fRev, cogs: fCogs, labor: fLab, cost_pct: fPct, labor_pct: fRev > 0 ? fLab / fRev * 100 : 0, vs_target_pct: fPct - fTgt, vs_target_dollar: ((fPct - fTgt) / 100) * fRev },
      catering: { revenue: cRev, cogs: cCogs, labor: cLab, cost_pct: cRev > 0 ? cCogs / cRev * 100 : 0, labor_pct: cRev > 0 ? cLab / cRev * 100 : 0 },
      other: { revenue: oRev, cogs: oCogs },
      platform_fees: fees,
      prime_cost_pct: totRev > 0 ? primeCost / totRev * 100 : 0,
      notes: notes
    };

    // ── Revenue `revenue_week` record ──
    const rw = (App.data.revenue_weeks || []).find(w => (w.period_end || '').slice(0, 10) === pe) || null;
    const laborCost = bLab + fLab;
    const hours = this._hours || 0;
    const rweek = {
      id: rw ? rw.id : App.uid(),
      week_num: rw ? rw.week_num : ((App.data.revenue_weeks || []).length + 1),
      period_end: pe,
      bar_revenue: bRev,
      floor_revenue: fRev,
      covers: covers,
      check_avg: covers > 0 ? parseFloat((totRev / covers).toFixed(2)) : 0,
      total_labor_cost: laborCost,
      total_hours: hours,
      labor_pct_blended: totRev > 0 ? parseFloat((laborCost / totRev * 100).toFixed(2)) : 0,
      rplh_blended: hours > 0 ? parseFloat((totRev / hours).toFixed(2)) : 0,
      notes: notes,
      saved_at: new Date().toISOString()
    };

    const btn = document.getElementById('cw-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const okP = await App.putRecord('core', 'week', week);
    const okR = await App.putRecord('core', 'revenue_week', rweek);
    if (okP && okR) {
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
