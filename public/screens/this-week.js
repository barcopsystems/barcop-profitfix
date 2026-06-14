'use strict';

/* ── Profit Recovery — This Week (weekly confirm) ─────────────────────────────
   The week is pulled in from Control (revenue from Shift, COGS from Inventory,
   labor from Labor) and the operator confirms it. The page leads with the money
   picture (total revenue, prime cost vs target, the one thing off target) and
   collapses entry into a single confirm grid. Every field stays editable as an
   override; "Pull from Control" re-pulls all of them at once. Saves to
   App.data.weeks. */

S.ThisWeek = {
  draft: null,
  _showCatering: false,
  DRAFT_KEY: 'pf_draft',
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

  // ── Labor Control labor feed ──────────────────────────────────────────────
  hasLabor() {
    return (((App.laborData && App.laborData.lc_actuals) || []).length) > 0;
  },
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
    const sal = App.salariedCost(start, periodEnd);
    bar += sal.bar; food += sal.food;
    if (sal.total > 0) any = true;
    return any ? { bar, food } : { bar: 0, food: 0 };
  },

  // ── Draft (in-localStorage, survives navigate-away; cleared on Save / Start Over) ──
  loadDraft() {
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {}
    const bc = this.icCOGS(this.BAR_CATS), fc = this.icCOGS(this.KITCHEN_CATS);
    const periodEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const sr = this.shiftRevenue(periodEnd);
    const lc = this.laborCost(periodEnd);
    return {
      week_num: App.nextWeekNum ? App.nextWeekNum() : 1,
      period_end: periodEnd,
      bar:  { revenue: sr && sr.bar ? sr.bar.toFixed(2) : '', labor: lc && lc.bar ? lc.bar.toFixed(2) : '', cogs: bc != null ? bc.toFixed(2) : '' },
      food: { revenue: sr && sr.food ? sr.food.toFixed(2) : '', labor: lc && lc.food ? lc.food.toFixed(2) : '', cogs: fc != null ? fc.toFixed(2) : '' },
      catering: { revenue: '', cogs: '', labor: '' },
      platform_fees: '',
      notes: ''
    };
  },
  saveDraft() { try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} this.draft = null; },

  cateringActive(d) {
    if (this._showCatering) return true;
    const c = d && d.catering;
    return !!(c && (parseFloat(c.revenue) || parseFloat(c.cogs) || parseFloat(c.labor)));
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this.draft) this.draft = this.loadDraft();
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How This Week Works', [
      { p: ['This is the weekly confirm. Bar Cop pulls the week in from your Control systems: revenue from Shift Control (the week\'s logged shifts summed), COGS from Inventory Control (the week\'s counts and deliveries), and labor from Labor Control (actual hours costed and split bar versus food). You read the money picture up top, confirm the grid, and save. You almost never type a raw number, you confirm one.'] },
      { h: 'The Money Picture', p: ['Total revenue, prime cost against your target, and how the week tracked versus your forecast, all live. The Watch line calls out the single category most over target this week so you know where the money is going before you read a single cell. Prime cost is the headline number in a healthy operation, and labor is folded into it.'] },
      { h: 'The Confirm Grid', p: ['One row per revenue stream (Bar, Food, and Catering if you run events). Revenue, Labor, and COGS are the cells, pre-filled from Control and fully editable. Cost percent and the dollars over or under target compute live as you tweak. If a shift was missed or a count was partial, type the right number straight into the cell.'] },
      { h: 'Pull From Control', p: ['Re-runs the Control math and refills every auto cell at once, for when you have logged more since you opened the page. If you have edited a cell by hand and it does not match what Control computed, Bar Cop asks before overwriting, so a deliberate override is never lost silently.'] },
      { h: 'Catering And Platform Fees', p: ['Catering is an optional fourth stream for off-premise events; add the row only if you cater. It rolls into total revenue and prime cost like Bar and Food. Third-party platform fees (DoorDash, UberEats, Toast Tabs) are an operating cost, not part of prime cost, and sit as their own line on Books and Year-End. Leave both blank if they do not apply.'] }
    ]);
  },

  // ── Money hero ──────────────────────────────────────────────────────────────
  heroCard(d) {
    const periodCtl = '<div style="display:flex;align-items:center;gap:16px;font-weight:400;letter-spacing:0;text-transform:none;">'
      + '<span style="display:flex;align-items:center;gap:7px;"><span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Week</span>'
      + '<input type="number" id="tw-wk" value="' + esc(String(d.week_num)) + '" min="1" style="width:62px;" oninput="S.ThisWeek.onInput()"/></span>'
      + '<span style="display:flex;align-items:center;gap:7px;"><span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Ending</span>'
      + '<input type="date" id="tw-end" value="' + esc(d.period_end) + '" style="width:152px;" oninput="S.ThisWeek.onInput()"/></span>'
      + '</div>';
    return '<div class="card form-card" style="margin-bottom:14px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><span>This Week</span>' + periodCtl + '</div>'
      + '<div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val lg" id="tw-totrev">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Prime Cost</div><div class="calc-val lg" id="tw-prime">-</div><div style="font-size:11px;color:var(--t3);margin-top:3px;" id="tw-prime-sub">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Forecast</div><div class="calc-val lg" id="tw-fcgap">-</div></div>'
      + '</div>'
      + '<div id="tw-watch" style="font-size:12px;color:var(--t2);line-height:1.6;margin-top:14px;padding-top:12px;border-top:1px solid var(--b2);"></div>'
      + '</div>';
  },

  // ── Confirm grid ────────────────────────────────────────────────────────────
  cell(id, val) {
    return '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tw-' + id + '" value="' + esc(String(val || '')) + '" step="0.01" inputmode="decimal" oninput="S.ThisWeek.onInput()"/></div>';
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
    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--b2);">'
      + '<div style="font-size:13px;font-weight:600;color:var(--t1);">Confirm the week</div>'
      + '<button class="btn btn-ghost btn-sm" id="tw-pull">Pull from Control</button>'
      + '</div>'
      + '<table class="ing-tbl"><thead><tr>'
      + '<th>Section</th><th>Revenue</th><th>Labor</th><th>COGS</th><th>Cost %</th><th>vs Target</th>'
      + '</tr></thead><tbody>'
      + this.lineRow('Bar', 'b', d.bar)
      + this.lineRow('Food', 'f', d.food)
      + (cateringOn ? this.lineRow('Catering', 'c', d.catering || { revenue: '', cogs: '', labor: '' }) : '')
      + '</tbody></table>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-top:1px solid var(--b2);flex-wrap:wrap;">'
      + footerLeft
      + '<div style="display:flex;align-items:center;gap:9px;"><label style="font-size:11px;color:var(--t2);">3rd-party platform fees</label>'
      + '<div class="fw" style="width:140px;"><span class="pre">$</span><input class="pre" type="number" id="tw-pf" value="' + esc(String(d.platform_fees || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div></div>'
      + '</div></div>';
  },

  draw() {
    const d = this.draft;
    this.container.innerHTML = '<div class="screen">'
      + this.heroCard(d)
      + this.gridCard(d)
      + '<div class="card form-card" style="margin-bottom:8px;"><div class="f" style="margin:0;"><label>Notes (optional)</label>'
      + '<textarea id="tw-notes" class="notes-ta" rows="2" oninput="S.ThisWeek.onInput()">' + esc(d.notes || '') + '</textarea></div></div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="tw-save">Save Week</button>'
      + '<button class="btn btn-ghost" id="tw-start-over">Start Over</button>'
      + '<span id="tw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    this.wire();
    this.calc();
  },

  wire() {
    document.getElementById('tw-save')?.addEventListener('click', () => this.saveWeek());
    document.getElementById('tw-start-over')?.addEventListener('click', () => this.startOver());
    document.getElementById('tw-pull')?.addEventListener('click', () => this.pullAll());
    document.getElementById('tw-add-catering')?.addEventListener('click', () => {
      this.collect(); this._showCatering = true; this.saveDraft(); this.draw();
    });
    document.getElementById('tw-remove-catering')?.addEventListener('click', () => {
      this.collect(); this.draft.catering = { revenue: '', cogs: '', labor: '' }; this._showCatering = false; this.saveDraft(); this.draw();
    });
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
    if (this.cateringActive(d)) { d.catering.revenue = v('tw-cr'); d.catering.cogs = v('tw-cc'); d.catering.labor = v('tw-cl'); }
    d.platform_fees = v('tw-pf');
    d.notes = v('tw-notes');
  },

  // True when the operator typed a value that meaningfully differs from what
  // Control wants to pull in. 50-cent tolerance avoids floating-point noise.
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

  // Re-pull every auto cell from Control at once.
  async pullAll() {
    const pe = document.getElementById('tw-end')?.value || this.draft.period_end;
    const bc = this.icCOGS(this.BAR_CATS), fc = this.icCOGS(this.KITCHEN_CATS);
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
      const ok = await this._confirmOverride('Overwrite your numbers?',
        'Some cells you edited do not match what Control just computed. Pulling will replace them with the logged figures.');
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
      { p: 'b', label: 'Bar pour cost', target: t.bar_pour_cost_pct ?? 22 },
      { p: 'f', label: 'Food cost',     target: t.food_cost_pct ?? 32 }
    ];
    if (this.cateringActive(d)) sections.push({ p: 'c', label: 'Catering cost', target: null });

    let totRev = 0, totCost = 0, worst = null;
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
        put('tw-' + s.p + 'pct', pct != null ? App.fmtPct(pct) : '-', pct == null ? 'var(--t3)' : (over ? 'var(--red)' : 'var(--gold)'));
        put('tw-' + s.p + 'vd', vd != null ? ((vd > 0 ? '+' : '') + App.fmtCurrency(vd)) : '-', vd == null ? 'var(--t3)' : (vd > 0 ? 'var(--red)' : 'var(--green)'));
        if (over && (!worst || (pct - s.target) > worst.over)) worst = { label: s.label, pct, over: pct - s.target };
      }
    });

    const primeTarget = t.prime_cost_pct ?? 60;
    const prime = totRev > 0 ? totCost / totRev * 100 : null;
    put('tw-totrev', totRev > 0 ? App.fmtCurrency(totRev) : '-', 'var(--t1)');
    put('tw-prime', prime != null ? App.fmtPct(prime) : '-', prime == null ? 'var(--t3)' : (prime > primeTarget ? 'var(--red)' : 'var(--gold)'));
    put('tw-prime-sub', 'target ' + primeTarget + '%' + (prime != null ? (prime > primeTarget ? ' · over' : ' · on target') : ''),
      prime != null && prime > primeTarget ? 'var(--red)' : 'var(--t3)');

    const pe = document.getElementById('tw-end')?.value || d.period_end;
    const fc = (pe && App.forecastForWeek) ? App.forecastForWeek(pe) : null;
    const fcTotal = fc && fc.total != null ? Number(fc.total) || 0 : 0;
    const fcGap = fcTotal > 0 && totRev > 0 ? totRev - fcTotal : null;
    put('tw-fcgap', fcGap != null ? ((fcGap >= 0 ? '+' : '') + App.fmtCurrency(fcGap)) : '-', fcGap == null ? 'var(--t3)' : (fcGap >= 0 ? 'var(--green)' : 'var(--red)'));

    const watchEl = document.getElementById('tw-watch');
    if (watchEl) {
      if (worst) watchEl.innerHTML = '<span style="color:var(--red);font-weight:700;">Watch:</span> ' + esc(worst.label) + ' is ' + App.fmtPct(worst.pct) + ', ' + worst.over.toFixed(1) + ' points over target this week.';
      else if (totRev > 0) watchEl.innerHTML = '<span style="color:var(--gold);font-weight:700;">On target.</span> Bar and food cost are both within target this week.';
      else watchEl.innerHTML = '<span style="color:var(--t3);">Enter or pull the week\'s numbers to see where you stand.</span>';
    }
  },

  startOver() {
    App.confirm({ title: 'Start over?', message: 'This clears the numbers entered for this week and re-pulls a fresh copy from Control.', confirmText: 'Start Over', cancelText: 'Keep' }).then(ok => {
      if (!ok) return;
      this.clearDraft();
      this._showCatering = false;
      this.draft = this.loadDraft();
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

    const btn = document.getElementById('tw-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('core', 'week', week);
    if (ok) {
      this.clearDraft();
      this._showCatering = false;
      if (App.updatePeriod) App.updatePeriod();
      App.markSetupDone('gs_p_week');
      App.navigate('dashboard');
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Week'; }
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  }
};
