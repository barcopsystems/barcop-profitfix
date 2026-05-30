'use strict';

/* ── Profit Recovery — This Week (weekly confirm screen) ──────────────────────
   Thin weekly entry: Period, Bar, Food. COGS auto-fills from Inventory Control;
   Revenue auto-fills from Shift Control and Labor from Labor Control once those
   modules are built. Every field is editable as an override. Saves to
   App.data.weeks. Inventory counts and variance are owned by Inventory Control. */

S.ThisWeek = {
  draft: null,
  DRAFT_KEY: 'pf_draft',
  // Bar / Kitchen category lists read from App canonical (see app.js BAR_CATS
  // / KITCHEN_CATS) so the lists never drift across the three Profit Recovery
  // screens that read them.
  get BAR_CATS()     { return App.BAR_CATS; },
  get KITCHEN_CATS() { return App.KITCHEN_CATS; },

  // ── Inventory Control COGS feed ───────────────────────────────────────────
  hasIC() {
    return (((App.inventoryData && App.inventoryData.ic_counts) || []).length) >= 2;
  },
  icCOGS(cats) {
    const counts = [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
    if (counts.length < 2) return null;
    const startC = counts[counts.length - 2], endC = counts[counts.length - 1];
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

  // ── Shift Control revenue feed ────────────────────────────────────────────
  hasShifts() {
    return (((App.shiftData && App.shiftData.sc_shifts) || []).length) > 0;
  },
  // sum bar/floor shift revenue for the 7-day week ending at periodEnd
  shiftRevenue(periodEnd) {
    const shifts = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!shifts.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = startD.toISOString().slice(0, 10);
    let bar = 0, food = 0, any = false;
    shifts.forEach(s => {
      if (!s.date || s.date < start || s.date > periodEnd) return;
      bar += s.bar_revenue || 0;
      food += s.floor_revenue || 0;
      any = true;
    });
    return any ? { bar, food } : { bar: 0, food: 0 };
  },

  // ── Labor Control labor feed ──────────────────────────────────────────────
  hasLabor() {
    return (((App.laborData && App.laborData.lc_actuals) || []).length) > 0;
  },
  // sum logged labor cost for the 7-day week ending at periodEnd, split bar vs food
  laborCost(periodEnd) {
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    if (!actuals.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = startD.toISOString().slice(0, 10);
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

  // ── Draft ─────────────────────────────────────────────────────────────────
  loadDraft() {
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {}
    const bc = this.icCOGS(this.BAR_CATS), fc = this.icCOGS(this.KITCHEN_CATS);
    const periodEnd = App.nextSunday ? App.nextSunday() : new Date().toISOString().slice(0, 10);
    const sr = this.shiftRevenue(periodEnd);
    const lc = this.laborCost(periodEnd);
    return {
      week_num: App.nextWeekNum ? App.nextWeekNum() : 1,
      period_end: periodEnd,
      bar:  { revenue: sr && sr.bar ? sr.bar.toFixed(2) : '', labor: lc && lc.bar ? lc.bar.toFixed(2) : '', cogs: bc != null ? bc.toFixed(2) : '' },
      food: { revenue: sr && sr.food ? sr.food.toFixed(2) : '', labor: lc && lc.food ? lc.food.toFixed(2) : '', cogs: fc != null ? fc.toFixed(2) : '' },
      // Catering: optional third revenue stream for operators who do
      // off-premise events. Operators who don't cater leave it blank — it
      // adds zero to totals so it's invisible if unused.
      catering: { revenue: '', cogs: '', labor: '' },
      // 3rd-party platform fees (DoorDash, UberEats, Toast Tabs, etc).
      // Operating cost, NOT part of prime cost or COGS. Sits as its own line
      // on Books and Year-End. Operators who don't do delivery leave blank.
      platform_fees: '',
      notes: ''
    };
  },
  saveDraft() { try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} this.draft = null; },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this.draft) this.draft = this.loadDraft();
    this.draw();
  },

  feedNote(kind) {
    if (kind === 'cogs') {
      return this.hasIC()
        ? 'Auto-filled from Inventory Control. <a href="#" onclick="S.ThisWeek.pullCOGS();return false;" style="color:var(--gold);font-weight:700;">Pull latest</a>'
        : 'No inventory counts yet, count in Inventory Control, or enter manually.';
    }
    if (kind === 'revenue') {
      return this.hasShifts()
        ? 'Auto-filled from Shift Control, the weekly sum of logged shift revenue. <a href="#" onclick="S.ThisWeek.pullRevenue();return false;" style="color:var(--gold);font-weight:700;">Pull latest</a>'
        : 'No shifts logged in Shift Control yet, log shifts there, or enter manually.';
    }
    if (kind === 'labor') {
      return this.hasLabor()
        ? 'Auto-filled from Labor Control, logged hours costed and split Bar vs Food. <a href="#" onclick="S.ThisWeek.pullLabor();return false;" style="color:var(--gold);font-weight:700;">Pull latest</a>'
        : 'No hours logged in Labor Control yet, log hours there, or enter manually.';
    }
    return '';
  },

  moneyField(id, label, value, kind) {
    return '<div class="f w-md"><label>' + label + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:4px;line-height:1.4;">' + this.feedNote(kind) + '</div></div>';
  },

  // Catering: optional third revenue line. Renders the same shape as the Bar
  // / Food cards but with no Pull Latest links (no Control source feeds
  // catering numbers — the operator types them) and no target % comparison
  // (catering margin varies too widely by event type to anchor a single target).
  cateringCard(data) {
    const inputRow = (id, label, value) =>
      '<div class="f w-md"><label>' + label + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:4px;line-height:1.4;">Operator entry. Leave blank if you do not cater.</div></div>';
    return '<div class="card"><div class="card-title">Catering / Events (optional)</div>'
      + '<div class="form-row">'
      + inputRow('tw-cr', 'Catering Revenue', data.revenue)
      + inputRow('tw-cl', 'Catering Labor',   data.labor)
      + inputRow('tw-cc', 'Catering COGS',    data.cogs)
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Catering Cost %</div><div class="calc-val" id="tw-cpct">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Catering Labor %</div><div class="calc-val" id="tw-clpct">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Gross Contribution</div><div class="calc-val" id="tw-ccontrib">-</div></div>'
      + '</div></div>';
  },

  sectionCard(title, prefix, data) {
    return '<div class="card"><div class="card-title">' + title + '</div>'
      + '<div class="form-row">'
      + this.moneyField('tw-' + prefix + 'r', title + ' Revenue ' + tt('bar-revenue'), data.revenue, 'revenue')
      + this.moneyField('tw-' + prefix + 'l', title + ' Labor ' + tt('bar-labor'), data.labor, 'labor')
      + this.moneyField('tw-' + prefix + 'c', title + ' COGS ' + tt('bar-cogs'), data.cogs, 'cogs')
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">' + title + ' Cost %</div><div class="calc-val" id="tw-' + prefix + 'pct">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">' + title + ' Labor %</div><div class="calc-val" id="tw-' + prefix + 'lpct">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Target %</div><div class="calc-val" id="tw-' + prefix + 'vpct">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Target $</div><div class="calc-val" id="tw-' + prefix + 'vdol">-</div></div>'
      + '</div></div>';
  },

  draw() {
    const d = this.draft;
    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Period</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:100px;"><label>Week # ' + tt('tw-week-num') + '</label><input type="number" id="tw-wk" value="' + esc(String(d.week_num)) + '" min="1" oninput="S.ThisWeek.onInput()"/></div>'
      + '<div class="f" style="width:160px;"><label>Period End Date ' + tt('tw-period-end') + '</label><input type="date" id="tw-end" value="' + esc(d.period_end) + '" oninput="S.ThisWeek.onInput()"/></div>'
      + '</div></div>'
      + this.sectionCard('Bar', 'b', d.bar)
      + this.sectionCard('Food', 'f', d.food)
      + this.cateringCard(d.catering || { revenue: '', cogs: '', labor: '' })
      + '<div class="card"><div class="card-title">Other Operating Costs</div>'
      + '<div class="form-row">'
      + '<div class="f w-md"><label>3rd-Party Platform Fees</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-pf" value="' + esc(String(d.platform_fees || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:4px;line-height:1.4;">DoorDash, UberEats, Toast Tabs, or any platform fee for the week. Sits as its own operating expense line on Books and Year-End.</div>'
      + '</div></div></div>'
      + '<div class="card"><div class="card-title">Review</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="tw-totrev">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Forecast</div><div class="calc-val" id="tw-fcst">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Forecast</div><div class="calc-val" id="tw-fcgap">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Prime Cost %</div><div class="calc-val" id="tw-prime">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">' + (App.data.settings.targets?.prime_cost_pct ?? 60) + '%</div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes (optional)</label><textarea id="tw-notes" rows="2" oninput="S.ThisWeek.onInput()">' + esc(d.notes || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="tw-save">Save Week</button>'
      + '<span id="tw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    document.getElementById('tw-save')?.addEventListener('click', () => this.saveWeek());
    this.calc();
  },

  onInput() {
    this.collect();
    this.saveDraft();
    this.calc();
  },

  collect() {
    const v = id => document.getElementById(id)?.value ?? '';
    const d = this.draft;
    d.week_num = v('tw-wk'); d.period_end = v('tw-end');
    d.bar.revenue = v('tw-br'); d.bar.cogs = v('tw-bc'); d.bar.labor = v('tw-bl');
    d.food.revenue = v('tw-fr'); d.food.cogs = v('tw-fc'); d.food.labor = v('tw-fl');
    if (!d.catering) d.catering = { revenue: '', cogs: '', labor: '' };
    d.catering.revenue = v('tw-cr'); d.catering.cogs = v('tw-cc'); d.catering.labor = v('tw-cl');
    d.platform_fees = v('tw-pf');
    d.notes = v('tw-notes');
  },

  // True when the operator has typed a value that meaningfully differs from
  // what Control wants to pull in. 50-cent tolerance avoids false alarms on
  // floating-point noise.
  _isOverride(id, incoming) {
    const cur = parseFloat(document.getElementById(id)?.value);
    if (isNaN(cur) || cur === 0) return false;
    const inc = parseFloat(incoming);
    if (isNaN(inc)) return false;
    return Math.abs(cur - inc) > 0.5;
  },
  async _confirmOverride(title, message) {
    return App.confirm({ title, message, confirmText: 'Overwrite', cancelText: 'Keep Mine' });
  },

  async pullCOGS() {
    const bc = this.icCOGS(this.BAR_CATS), fc = this.icCOGS(this.KITCHEN_CATS);
    const incoming = {};
    if (bc != null) incoming['tw-bc'] = bc;
    if (fc != null) incoming['tw-fc'] = fc;
    const conflicted = Object.entries(incoming).some(([id, v]) => this._isOverride(id, v));
    if (conflicted) {
      const ok = await this._confirmOverride(
        'Overwrite your COGS numbers?',
        'Your typed Bar or Food COGS don\'t match what Inventory Control just computed. Pulling latest will replace them.'
      );
      if (!ok) return;
    }
    if (bc != null) { const el = document.getElementById('tw-bc'); if (el) el.value = bc.toFixed(2); }
    if (fc != null) { const el = document.getElementById('tw-fc'); if (el) el.value = fc.toFixed(2); }
    this.onInput();
  },

  async pullRevenue() {
    const pe = document.getElementById('tw-end')?.value || this.draft.period_end;
    const sr = this.shiftRevenue(pe);
    if (!sr) return;
    const incoming = { 'tw-br': sr.bar, 'tw-fr': sr.food };
    const conflicted = Object.entries(incoming).some(([id, v]) => this._isOverride(id, v));
    if (conflicted) {
      const ok = await this._confirmOverride(
        'Overwrite your revenue numbers?',
        'Your typed Bar or Food revenue don\'t match Shift Control. Pulling latest will replace them.'
      );
      if (!ok) return;
    }
    const br = document.getElementById('tw-br'); if (br) br.value = sr.bar.toFixed(2);
    const fr = document.getElementById('tw-fr'); if (fr) fr.value = sr.food.toFixed(2);
    this.onInput();
  },

  async pullLabor() {
    const pe = document.getElementById('tw-end')?.value || this.draft.period_end;
    const lc = this.laborCost(pe);
    if (!lc) return;
    const incoming = { 'tw-bl': lc.bar, 'tw-fl': lc.food };
    const conflicted = Object.entries(incoming).some(([id, v]) => this._isOverride(id, v));
    if (conflicted) {
      const ok = await this._confirmOverride(
        'Overwrite your labor numbers?',
        'Your typed Bar or Food labor don\'t match Labor Control. Pulling latest will replace them.'
      );
      if (!ok) return;
    }
    const bl = document.getElementById('tw-bl'); if (bl) bl.value = lc.bar.toFixed(2);
    const fl = document.getElementById('tw-fl'); if (fl) fl.value = lc.food.toFixed(2);
    this.onInput();
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const t = App.data.settings.targets || {};
    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };

    const section = (prefix, target) => {
      const rev = num('tw-' + prefix + 'r'), cogs = num('tw-' + prefix + 'c'), labor = num('tw-' + prefix + 'l');
      const pct = rev > 0 ? cogs / rev * 100 : null;
      const lpct = rev > 0 ? labor / rev * 100 : null;
      const vp = pct != null ? pct - target : null;
      const vd = pct != null ? ((pct - target) / 100) * rev : null;
      set('tw-' + prefix + 'pct', pct != null ? App.fmtPct(pct) : '-', pct != null ? (pct > target ? 'warn' : 'good') : '');
      set('tw-' + prefix + 'lpct', lpct != null ? App.fmtPct(lpct) : '-');
      set('tw-' + prefix + 'vpct', vp != null ? (vp > 0 ? '+' : '') + App.fmtPct(vp) : '-', vp != null ? (vp > 0 ? 'warn' : 'good') : '');
      set('tw-' + prefix + 'vdol', vd != null ? (vd > 0 ? '+' : '') + App.fmtCurrency(vd) : '-', vd != null ? (vd > 0 ? 'warn' : 'good') : '');
    };
    section('b', t.bar_pour_cost_pct ?? 22);
    section('f', t.food_cost_pct ?? 32);

    // Catering tile math: read-only display, doesn't anchor a target since
    // catering margin varies too widely by event type.
    const cr = num('tw-cr'), cc = num('tw-cc'), cl = num('tw-cl');
    const cpct = cr > 0 ? cc / cr * 100 : null;
    const clpct = cr > 0 ? cl / cr * 100 : null;
    const ccontrib = cr - cc - cl;
    set('tw-cpct',    cpct  != null ? App.fmtPct(cpct)  : '-');
    set('tw-clpct',   clpct != null ? App.fmtPct(clpct) : '-');
    set('tw-ccontrib', cr > 0 ? App.fmtCurrency(ccontrib) : '-', cr > 0 ? (ccontrib >= 0 ? 'good' : 'warn') : '');

    // Catering revenue rolls into Total Revenue; catering COGS + labor roll
    // into prime cost since they're real product + payroll cost. Platform
    // fees do NOT roll into prime — they're shown as a separate operating
    // expense line on Books and Year-End.
    const tRev = num('tw-br') + num('tw-fr') + cr;
    const tCost = num('tw-bc') + num('tw-fc') + num('tw-bl') + num('tw-fl') + cc + cl;
    const prime = tRev > 0 ? tCost / tRev * 100 : null;
    const pTarget = t.prime_cost_pct ?? 60;
    set('tw-totrev', tRev > 0 ? App.fmtCurrency(tRev) : '-');
    // Forecast vs actual: read this week's forecast keyed by week_start
    const pe = document.getElementById('tw-end')?.value || this.draft.period_end;
    const fc = (pe && App.forecastForWeek) ? App.forecastForWeek(pe) : null;
    const fcTotal = fc && fc.total != null ? Number(fc.total) || 0 : 0;
    set('tw-fcst', fcTotal > 0 ? App.fmtCurrency(fcTotal) : '-', fcTotal > 0 ? 'dim' : '');
    const fcGap = fcTotal > 0 && tRev > 0 ? tRev - fcTotal : null;
    set('tw-fcgap', fcGap != null ? (fcGap >= 0 ? '+' : '') + App.fmtCurrency(fcGap) : '-', fcGap != null ? (fcGap >= 0 ? 'good' : 'warn') : '');
    set('tw-prime', prime != null ? App.fmtPct(prime) : '-', prime != null ? (prime > pTarget ? 'warn' : 'good') : '');
  },

  async saveWeek() {
    this.collect();
    const d = this.draft;
    const err = document.getElementById('tw-err');
    const numF = v => parseFloat(v) || 0;
    const bRev = numF(d.bar.revenue), bCogs = numF(d.bar.cogs), bLab = numF(d.bar.labor);
    const fRev = numF(d.food.revenue), fCogs = numF(d.food.cogs), fLab = numF(d.food.labor);
    const cRev = numF(d.catering?.revenue), cCogs = numF(d.catering?.cogs), cLab = numF(d.catering?.labor);
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

    const week = {
      id: App.uid(),
      week_num: parseInt(d.week_num) || 1,
      period_end: d.period_end,
      saved_at: new Date().toISOString(),
      bar: {
        revenue: bRev, cogs: bCogs, labor: bLab, cost_pct: bPct,
        labor_pct: bRev > 0 ? bLab / bRev * 100 : 0,
        vs_target_pct: bPct - bTarget, vs_target_dollar: ((bPct - bTarget) / 100) * bRev
      },
      food: {
        revenue: fRev, cogs: fCogs, labor: fLab, cost_pct: fPct,
        labor_pct: fRev > 0 ? fLab / fRev * 100 : 0,
        vs_target_pct: fPct - fTarget, vs_target_dollar: ((fPct - fTarget) / 100) * fRev
      },
      catering: {
        revenue: cRev, cogs: cCogs, labor: cLab,
        cost_pct: cRev > 0 ? cCogs / cRev * 100 : 0,
        labor_pct: cRev > 0 ? cLab / cRev * 100 : 0
      },
      platform_fees: pFees,
      prime_cost_pct: tRev > 0 ? tCost / tRev * 100 : 0,
      notes: d.notes || ''
    };

    if (!App.data.weeks) App.data.weeks = [];
    App.data.weeks.push(week);
    const btn = document.getElementById('tw-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('weeks');
    if (ok) {
      this.clearDraft();
      if (App.updatePeriod) App.updatePeriod();
      App.markSetupDone('gs_p_week');
      App.navigate('dashboard');
    } else {
      App.data.weeks.pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Week'; }
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  }
};
