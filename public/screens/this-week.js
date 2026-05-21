'use strict';

/* ── Profit Recovery — This Week (weekly confirm screen) ──────────────────────
   Thin weekly entry: Period, Bar, Food. COGS auto-fills from Inventory Control;
   Revenue auto-fills from Shift Control and Labor from Labor Control once those
   modules are built. Every field is editable as an override. Saves to
   App.data.weeks. Inventory counts and variance are owned by Inventory Control. */

S.ThisWeek = {
  draft: null,
  DRAFT_KEY: 'pf_draft',
  BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  KITCHEN_CATS: ['Food', 'Misc'],

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
        purch[li.product_id] = (purch[li.product_id] || 0) + (li.qty || 0);
      }));
    let cogs = 0, any = false;
    Object.keys(eMap).forEach(pid => {
      if (!sMap[pid]) return;
      const p = prods.find(x => x.id === pid);
      if (!p || !cats.includes(p.category)) return;
      const used = (sMap[pid].total || 0) + (purch[pid] || 0) - (eMap[pid].total || 0);
      const uc = p.unit_cost != null ? p.unit_cost : (eMap[pid].unit_cost != null ? eMap[pid].unit_cost : null);
      if (uc != null) { cogs += used * uc; any = true; }
    });
    return any ? cogs : null;
  },

  // ── Draft ─────────────────────────────────────────────────────────────────
  loadDraft() {
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {}
    const bc = this.icCOGS(this.BAR_CATS), fc = this.icCOGS(this.KITCHEN_CATS);
    return {
      week_num: App.nextWeekNum ? App.nextWeekNum() : 1,
      period_end: App.nextSunday ? App.nextSunday() : new Date().toISOString().slice(0, 10),
      bar:  { revenue: '', labor: '', cogs: bc != null ? bc.toFixed(2) : '' },
      food: { revenue: '', labor: '', cogs: fc != null ? fc.toFixed(2) : '' },
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
        : 'No inventory counts yet — count in Inventory Control, or enter manually.';
    }
    if (kind === 'revenue') return 'Will auto-fill from Shift Control once it is built — enter manually for now.';
    if (kind === 'labor')   return 'Will auto-fill from Labor Control once it is built — enter manually for now.';
    return '';
  },

  moneyField(id, label, value, kind) {
    return '<div class="f w-md"><label>' + label + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:4px;line-height:1.4;">' + this.feedNote(kind) + '</div></div>';
  },

  sectionCard(title, prefix, data) {
    return '<div class="card"><div class="card-title">' + title + '</div>'
      + '<div class="form-row">'
      + this.moneyField('tw-' + prefix + 'r', title + ' Revenue ' + tt('bar-revenue'), data.revenue, 'revenue')
      + this.moneyField('tw-' + prefix + 'l', title + ' Labor ' + tt('bar-labor'), data.labor, 'labor')
      + this.moneyField('tw-' + prefix + 'c', title + ' COGS ' + tt('bar-cogs'), data.cogs, 'cogs')
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">' + title + ' Cost %</div><div class="calc-val" id="tw-' + prefix + 'pct">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">' + title + ' Labor %</div><div class="calc-val" id="tw-' + prefix + 'lpct">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Target %</div><div class="calc-val" id="tw-' + prefix + 'vpct">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Target $</div><div class="calc-val" id="tw-' + prefix + 'vdol">—</div></div>'
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
      + '<div class="card"><div class="card-title">Review</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Prime Cost %</div><div class="calc-val" id="tw-prime">—</div></div>'
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
    d.notes = v('tw-notes');
  },

  pullCOGS() {
    const bc = this.icCOGS(this.BAR_CATS), fc = this.icCOGS(this.KITCHEN_CATS);
    if (bc != null) { const el = document.getElementById('tw-bc'); if (el) el.value = bc.toFixed(2); }
    if (fc != null) { const el = document.getElementById('tw-fc'); if (el) el.value = fc.toFixed(2); }
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
      set('tw-' + prefix + 'pct', pct != null ? App.fmtPct(pct) : '—', pct != null ? (pct > target ? 'warn' : 'good') : '');
      set('tw-' + prefix + 'lpct', lpct != null ? App.fmtPct(lpct) : '—');
      set('tw-' + prefix + 'vpct', vp != null ? (vp > 0 ? '+' : '') + App.fmtPct(vp) : '—', vp != null ? (vp > 0 ? 'warn' : 'good') : '');
      set('tw-' + prefix + 'vdol', vd != null ? (vd > 0 ? '+' : '') + App.fmtCurrency(vd) : '—', vd != null ? (vd > 0 ? 'warn' : 'good') : '');
    };
    section('b', t.bar_pour_cost_pct ?? 22);
    section('f', t.food_cost_pct ?? 32);

    const tRev = num('tw-br') + num('tw-fr');
    const tCost = num('tw-bc') + num('tw-fc') + num('tw-bl') + num('tw-fl');
    const prime = tRev > 0 ? tCost / tRev * 100 : null;
    const pTarget = t.prime_cost_pct ?? 60;
    set('tw-prime', prime != null ? App.fmtPct(prime) : '—', prime != null ? (prime > pTarget ? 'warn' : 'good') : '');
  },

  async saveWeek() {
    this.collect();
    const d = this.draft;
    const err = document.getElementById('tw-err');
    const numF = v => parseFloat(v) || 0;
    const bRev = numF(d.bar.revenue), bCogs = numF(d.bar.cogs), bLab = numF(d.bar.labor);
    const fRev = numF(d.food.revenue), fCogs = numF(d.food.cogs), fLab = numF(d.food.labor);
    if (bRev + fRev === 0) {
      if (err) { err.textContent = 'Enter at least one revenue figure before saving.'; err.style.display = 'inline'; }
      return;
    }
    const t = App.data.settings.targets || {};
    const bTarget = t.bar_pour_cost_pct ?? 22, fTarget = t.food_cost_pct ?? 32;
    const tRev = bRev + fRev, tCost = bCogs + fCogs + bLab + fLab;
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
      App.navigate('dashboard');
    } else {
      App.data.weeks.pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Week'; }
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  }
};
