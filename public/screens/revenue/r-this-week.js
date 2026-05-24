'use strict';

/* ── Revenue Recovery — This Week (thin weekly confirm screen) ────────────────
   Restructured per the platform map: a thin confirm screen, not a 6-step
   wizard. Revenue and covers auto-fill from Shift Control (sc_shifts); labor
   auto-fills from Labor Control (lc_actuals). Every field is editable as an
   override only. RPLH-by-daypart and server entry moved to their own screens. */

S.RevenueThisWeek = {
  draft: null,
  DRAFT_KEY: 'rf_draft',

  // ── Shift Control revenue/covers feed ─────────────────────────────────────
  hasShifts() {
    return (((App.shiftData && App.shiftData.sc_shifts) || []).length) > 0;
  },
  shiftFeed(periodEnd) {
    const shifts = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!shifts.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = startD.toISOString().slice(0, 10);
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

  // ── Labor Control labor feed ──────────────────────────────────────────────
  hasLabor() {
    return (((App.laborData && App.laborData.lc_actuals) || []).length) > 0;
  },
  laborFeed(periodEnd) {
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    if (!actuals.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = startD.toISOString().slice(0, 10);
    let cost = 0, hours = 0, any = false;
    actuals.forEach(a => {
      if (!a.date || a.date < start || a.date > periodEnd) return;
      cost += a.cost || 0;
      hours += a.hours || 0;
      any = true;
    });
    return any ? { cost, hours } : { cost: 0, hours: 0 };
  },

  targets() { return (App.data.revenue_settings && App.data.revenue_settings.targets) || {}; },
  laborTarget() {
    const t = this.targets();
    return ((t.bar_labor_pct || 28) + (t.kitchen_labor_pct || 30) + (t.floor_labor_pct || 32)) / 3;
  },

  // ── Draft ─────────────────────────────────────────────────────────────────
  loadDraft() {
    let saved = null;
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) saved = JSON.parse(r); } catch (e) {}
    const weeks = App.data.revenue_weeks || [];
    const lastWeek = weeks.length ? weeks[weeks.length - 1] : null;
    const periodEnd = (saved && saved.period_end) || (App.nextSunday ? App.nextSunday() : new Date().toISOString().slice(0, 10));
    if (saved) {
      return {
        week_num: saved.week_num || ((lastWeek && lastWeek.week_num || 0) + 1),
        period_end: periodEnd,
        bar_revenue: saved.bar_revenue || '',
        floor_revenue: saved.floor_revenue || '',
        covers: saved.covers || '',
        labor_hours: saved.labor_hours || '',
        labor_cost: saved.labor_cost || '',
        notes: saved.notes || ''
      };
    }
    const sf = this.shiftFeed(periodEnd);
    const lf = this.laborFeed(periodEnd);
    return {
      week_num: (lastWeek && lastWeek.week_num || 0) + 1,
      period_end: periodEnd,
      bar_revenue: sf && sf.bar ? sf.bar.toFixed(2) : '',
      floor_revenue: sf && sf.floor ? sf.floor.toFixed(2) : '',
      covers: sf && sf.covers ? String(sf.covers) : '',
      labor_hours: lf && lf.hours ? lf.hours.toFixed(2) : '',
      labor_cost: lf && lf.cost ? lf.cost.toFixed(2) : '',
      notes: ''
    };
  },
  saveDraft() { try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} this.draft = null; },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this.draft) this.draft = this.loadDraft();
    this.draw();
  },

  feedNote(kind) {
    if (kind === 'revenue') {
      return this.hasShifts()
        ? 'Auto-filled from Shift Control: the weekly sum of shift revenue and covers. <a href="#" onclick="S.RevenueThisWeek.pullRevenue();return false;" style="color:var(--gold);font-weight:700;">Pull latest</a>'
        : 'No shifts logged in Shift Control yet. Log shifts there, or enter manually.';
    }
    if (kind === 'labor') {
      return this.hasLabor()
        ? 'Auto-filled from Labor Control: logged hours and cost for the week. <a href="#" onclick="S.RevenueThisWeek.pullLabor();return false;" style="color:var(--gold);font-weight:700;">Pull latest</a>'
        : 'No hours logged in Labor Control yet. Log hours there, or enter manually.';
    }
    return '';
  },

  moneyField(id, label, value, kind, prefix) {
    const input = prefix === '$'
      ? '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" oninput="S.RevenueThisWeek.onInput()"/></div>'
      : '<input type="number" id="' + id + '" value="' + esc(String(value || '')) + '" step="0.01" oninput="S.RevenueThisWeek.onInput()"/>';
    return '<div class="f w-md"><label>' + label + '</label>' + input
      + (kind ? '<div style="font-size:10px;color:var(--t3);margin-top:4px;line-height:1.4;">' + this.feedNote(kind) + '</div>' : '')
      + '</div>';
  },

  draw() {
    const d = this.draft;
    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Period</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:100px;"><label>Week #</label><input type="number" id="rw-wk" value="' + esc(String(d.week_num)) + '" min="1" oninput="S.RevenueThisWeek.onInput()"/></div>'
      + '<div class="f" style="width:160px;"><label>Period End Date</label><input type="date" id="rw-end" value="' + esc(d.period_end) + '" oninput="S.RevenueThisWeek.onInput()"/></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Revenue and Covers</div>'
      + '<div class="form-row">'
      + this.moneyField('rw-brev', 'Bar Revenue', d.bar_revenue, 'revenue', '$')
      + this.moneyField('rw-frev', 'Floor Revenue', d.floor_revenue, 'revenue', '$')
      + this.moneyField('rw-cov', 'Total Covers', d.covers, 'revenue', '')
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="rw-c-rev">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="rw-c-ca">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">$' + (this.targets().check_avg || 35) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Target</div><div class="calc-val" id="rw-c-cagap">-</div></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Labor</div>'
      + '<div class="form-row">'
      + this.moneyField('rw-lhrs', 'Labor Hours', d.labor_hours, 'labor', '')
      + this.moneyField('rw-lcost', 'Labor Cost', d.labor_cost, 'labor', '$')
      + '</div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val" id="rw-c-lpct">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">' + App.fmtPct(this.laborTarget()) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val" id="rw-c-rplh">-</div></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Review</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes (optional)</label>'
      + '<textarea id="rw-notes" rows="2" oninput="S.RevenueThisWeek.onInput()">' + esc(d.notes || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="rw-save">Save Week</button>'
      + '<span id="rw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    document.getElementById('rw-save')?.addEventListener('click', () => this.saveWeek());
    this.calc();
  },

  onInput() { this.collect(); this.saveDraft(); this.calc(); },

  collect() {
    const v = id => document.getElementById(id)?.value ?? '';
    const d = this.draft;
    d.week_num = v('rw-wk'); d.period_end = v('rw-end');
    d.bar_revenue = v('rw-brev'); d.floor_revenue = v('rw-frev'); d.covers = v('rw-cov');
    d.labor_hours = v('rw-lhrs'); d.labor_cost = v('rw-lcost');
    d.notes = v('rw-notes');
  },

  pullRevenue() {
    const pe = document.getElementById('rw-end')?.value || this.draft.period_end;
    const sf = this.shiftFeed(pe);
    if (sf) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('rw-brev', sf.bar.toFixed(2));
      set('rw-frev', sf.floor.toFixed(2));
      set('rw-cov', sf.covers ? String(sf.covers) : '');
    }
    this.onInput();
  },
  pullLabor() {
    const pe = document.getElementById('rw-end')?.value || this.draft.period_end;
    const lf = this.laborFeed(pe);
    if (lf) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('rw-lhrs', lf.hours.toFixed(2));
      set('rw-lcost', lf.cost.toFixed(2));
    }
    this.onInput();
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    const totalRev = num('rw-brev') + num('rw-frev');
    const covers = num('rw-cov');
    const checkAvg = covers > 0 ? totalRev / covers : null;
    const targetCA = this.targets().check_avg || 35;
    set('rw-c-rev', totalRev > 0 ? App.fmtCurrency(totalRev) : '-');
    set('rw-c-ca', checkAvg != null ? App.fmtCurrency(checkAvg) : '-', checkAvg != null ? (checkAvg >= targetCA ? 'good' : 'warn') : '');
    const caGap = checkAvg != null ? checkAvg - targetCA : null;
    set('rw-c-cagap', caGap != null ? (caGap >= 0 ? '+' : '') + App.fmtCurrency(caGap) : '-', caGap != null ? (caGap >= 0 ? 'good' : 'warn') : '');

    const laborCost = num('rw-lcost'), laborHrs = num('rw-lhrs');
    const laborPct = totalRev > 0 && laborCost > 0 ? laborCost / totalRev * 100 : null;
    const rplh = laborHrs > 0 && totalRev > 0 ? totalRev / laborHrs : null;
    set('rw-c-lpct', laborPct != null ? App.fmtPct(laborPct) : '-', laborPct != null ? (laborPct > this.laborTarget() ? 'warn' : 'good') : '');
    set('rw-c-rplh', rplh != null ? App.fmtCurrency(rplh) : '-');
  },

  async saveWeek() {
    this.collect();
    const d = this.draft;
    const err = document.getElementById('rw-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
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

    const week = {
      id:                App.uid(),
      week_num:          parseInt(d.week_num) || 1,
      period_end:        d.period_end,
      bar_revenue:       barRev,
      floor_revenue:     floorRev,
      covers:            covers,
      check_avg:         parseFloat(checkAvg.toFixed(2)),
      total_labor_cost:  laborCost,
      total_hours:       laborHrs,
      labor_pct_blended: parseFloat(laborPct.toFixed(2)),
      rplh_blended:      parseFloat(rplh.toFixed(2)),
      rplh_lunch:        0,
      rplh_dinner:       0,
      rplh_bar:          0,
      server_entries:    [],
      notes:             d.notes || '',
      saved_at:          new Date().toISOString()
    };

    if (!App.data.revenue_weeks) App.data.revenue_weeks = [];
    App.data.revenue_weeks.push(week);
    const btn = document.getElementById('rw-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('revenue_weeks');
    if (ok) {
      this.clearDraft();
      App.markSetupDone('gs_r_week');
      App.navigate('r-dashboard');
    } else {
      App.data.revenue_weeks.pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Week'; }
      fail('Save failed. Try again.');
    }
  }
};
