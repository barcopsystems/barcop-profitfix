'use strict';

/* ── Shift Control — Active Shift (writes sc_shifts) ──────────────────────────
   Mobile-first live shift command center. Start a shift, then a running view
   with this-shift activity (cash drops, voids/comps, 86s) and one-tap links to
   log them. End Shift captures revenue and covers and closes the sc_shifts
   record — the same record the rest of the platform reads for weekly revenue. */

S.ShiftActiveShift = {
  mode: null,

  shifts() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_shifts)) App.shiftData.sc_shifts = [];
    return App.shiftData.sc_shifts;
  },
  active() {
    return [...this.shifts()]
      .filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },
  shiftTypes() {
    return (S.ShiftLogShift && S.ShiftLogShift.SHIFT_TYPES) || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'];
  },
  byDate(key, date) {
    return ((App.shiftData && App.shiftData[key]) || []).filter(r => r.date === date);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  elapsed(iso) {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const act = this.active();
    this.mode = act ? 'active' : 'start';
    if (act) this.renderActive(act);
    else this.renderStart();
  },

  // ── Start a shift ───────────────────────────────────────────────────────────
  renderStart() {
    const typeOpts = this.shiftTypes().map(t => '<option>' + t + '</option>').join('');
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Start a Shift</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-bottom:16px;">No shift is running. Start one to '
      + 'track cash drops, voids, and 86s live, then close it out with revenue at the end.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="as-date" value="' + new Date().toISOString().slice(0, 10) + '" style="height:48px;"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="as-type" style="height:48px;">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Manager on Duty</label>'
      + '<select id="as-mgr" style="height:48px;">' + App.staffOptions('', { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Opening Bank</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="as-bank" min="0" step="0.01" '
      + 'inputmode="decimal" style="height:48px;font-size:16px;"/></div></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Staff on Floor</label>'
      + '<input type="number" id="as-staff" min="0" inputmode="numeric" style="height:48px;font-size:16px;"/></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="as-start">Start Shift</button>'
      + '<span id="as-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('as-start')?.addEventListener('click', () => this.startShift());
  },

  async startShift() {
    const err = document.getElementById('as-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('as-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };

    const rec = {
      id:             App.uid(),
      date,
      shift_type:     document.getElementById('as-type')?.value || '',
      manager_id:     document.getElementById('as-mgr')?.value || '',
      manager:        (App.staffById(document.getElementById('as-mgr')?.value) || {}).name || '',
      opening_bank:   num('as-bank'),
      staff_on_floor: num('as-staff'),
      bar_revenue:    0,
      floor_revenue:  0,
      total_revenue:  0,
      covers:         null,
      status:         'Open',
      notes:          '',
      started_at:     new Date().toISOString(),
      created_at:     new Date().toISOString()
    };

    const btn = document.getElementById('as-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Starting...'; }
    this.shifts().push(rec);
    const ok = await App.saveShift();
    if (ok) {
      this.renderActive(rec);
    } else {
      this.shifts().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Start Shift'; }
      fail('Could not start the shift. Try again.');
    }
  },

  // ── Active shift dashboard ──────────────────────────────────────────────────
  renderActive(s) {
    this.mode = 'active';
    const drops = this.byDate('sc_cash_drops', s.date);
    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const vc = this.byDate('sc_void_comps', s.date);
    const vcTotal = vc.reduce((t, r) => t + (r.amount || 0), 0);
    const active86 = ((App.shiftData && App.shiftData.sc_86_list) || []).filter(i => i.status !== 'Back').length;
    const openMaint = ((App.shiftData && App.shiftData.sc_maintenance) || []).filter(m => m.status !== 'Resolved').length;

    const stat = (label, val, sub) =>
      '<div style="flex:1;min-width:130px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\';font-size:30px;font-weight:600;color:var(--w);line-height:1.1;">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + sub + '</div></div>';

    const action = (id, label) =>
      '<button class="btn btn-ghost as-go" data-go="' + id + '" style="height:52px;flex:1;min-width:150px;">' + label + '</button>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
      + '<span style="width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);"></span>'
      + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Shift Running</span></div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
      + (s.manager ? 'Manager: ' + esc(s.manager) + ' &middot; ' : '')
      + (s.started_at ? 'Running ' + this.elapsed(s.started_at) : '')
      + (s.opening_bank != null ? ' &middot; Opening bank ' + App.fmtCurrency(s.opening_bank) : '') + '</div>'
      + '</div>'

      + '<div class="card"><div class="card-title">This Shift</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + stat('Cash Drops', drops.length, App.fmtCurrency(dropTotal) + ' dropped')
      + stat('Voids &amp; Comps', vc.length, App.fmtCurrency(vcTotal) + ' total')
      + stat('86\'d Items', active86, active86 === 1 ? 'item out' : 'items out')
      + stat('Open Maint.', openMaint, openMaint === 1 ? 'issue' : 'issues')
      + '</div></div>'

      + '<div class="card"><div class="card-title">Log During This Shift</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + action('sc-cash-drop', 'Cash Drop')
      + action('sc-void-comp', 'Void / Comp')
      + action('sc-waste', 'Waste / Spill')
      + action('sc-86-list', '86 an Item')
      + action('sc-safe-log', 'Safe Log')
      + action('sc-maintenance', 'Maintenance')
      + '</div></div>'

      + '<div class="card"><div class="card-title">End of Shift</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-bottom:14px;">Closing the shift records its revenue '
      + 'and covers. That revenue is what feeds your weekly Profit and Revenue numbers.</div>'
      + '<button class="btn btn-primary btn-lg" id="as-end">End Shift</button>'
      + '</div></div>';

    this.container.onclick = ev => {
      const go = ev.target.closest('.as-go');
      if (go) App.navigate(go.dataset.go);
      else if (ev.target.closest('#as-end')) this.renderEnd(s);
    };
  },

  // ── Shift Close Wizard ─────────────────────────────────────────────────────
  // Five-step structured close-out so nothing slips through the cracks:
  //   1. Revenue + Covers     (bar + floor + covers, computes check avg live)
  //   2. Cash Reconciliation  (opening bank + sales - drops vs counted)
  //   3. Exception Review     (open 86s, big voids/comps, open maint, checklist)
  //   4. Tip Reconciliation   (logged vs POS reported, link to Tip Pool)
  //   5. Handoff Notes        (free text for the next manager, lands on Handoff Report)
  // Wizard state lives on this._closeDraft so steps can be revisited without
  // losing inputs. Cancel returns to Active Shift without saving anything.
  WIZARD_STEPS: [
    { key: 'revenue',    label: 'Revenue and Covers' },
    { key: 'cash',       label: 'Cash Reconciliation' },
    { key: 'exceptions', label: 'Exception Review' },
    { key: 'tips',       label: 'Tip Reconciliation' },
    { key: 'handoff',    label: 'Handoff Notes' }
  ],

  renderEnd(s) {
    this.mode = 'end';
    if (!this._closeDraft || this._closeDraft.shift_id !== s.id) {
      // Initialize wizard draft from the live shift record
      const drops = this.byDate('sc_cash_drops', s.date);
      const dropsTotal = drops.reduce((t, d) => t + (parseFloat(d.amount) || 0), 0);
      this._closeDraft = {
        shift_id:      s.id,
        step:          'revenue',
        bar_revenue:   s.bar_revenue || null,
        floor_revenue: s.floor_revenue || null,
        covers:        s.covers || null,
        notes:         s.notes || '',
        // Cash recon defaults
        opening_bank:  s.opening_bank || 0,
        drops_total:   dropsTotal,
        sales_cash:    null,
        counted_cash:  null,
        cash_skipped:  false,
        // Tip recon defaults
        tips_pos_reported: null,
        // Exception acknowledgments (operator-set, just so they tick through)
        ack: {},
        handoff_notes: ''
      };
    }
    this.renderWizardStep(s);
  },

  renderWizardStep(s) {
    const step = this._closeDraft.step;
    const idx  = this.WIZARD_STEPS.findIndex(x => x.key === step);
    const total = this.WIZARD_STEPS.length;

    const stepper = '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">'
      + this.WIZARD_STEPS.map((s2, i) => {
          const done = i < idx, current = i === idx;
          const bg = current ? 'var(--gold)' : done ? 'var(--gold)' : 'var(--b2)';
          const color = current ? 'var(--bg)' : done ? 'var(--bg)' : 'var(--t3)';
          return '<div style="flex:1;min-width:120px;padding:8px 10px;border-radius:3px;background:' + bg + ';color:' + color + ';font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;text-align:center;">' + (i + 1) + '. ' + s2.label + '</div>';
        }).join('')
    + '</div>';

    const header = '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px;">'
        + '<div>'
          + '<div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Closing Shift</div>'
          + '<div style="font-size:18px;font-weight:800;color:var(--t1);margin-top:2px;">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
          + (s.manager ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">Manager: ' + esc(s.manager) + '</div>' : '')
        + '</div>'
        + '<button class="btn btn-ghost btn-sm" id="aw-cancel">Cancel and Return</button>'
      + '</div>'
      + stepper
    + '</div>';

    let body;
    if      (step === 'revenue')    body = this.stepRevenue(s);
    else if (step === 'cash')       body = this.stepCash(s);
    else if (step === 'exceptions') body = this.stepExceptions(s);
    else if (step === 'tips')       body = this.stepTips(s);
    else                            body = this.stepHandoff(s);

    this.container.innerHTML = '<div class="screen">' + header + body + '</div>';
    this.wireWizard(s);
  },

  // ── Step 1: Revenue and Covers ───────────────────────────────────────────
  stepRevenue(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    return '<div class="card"><div class="card-title">Step 1 of 5 &middot; Revenue and Covers</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Pull these straight from your POS end-of-shift report. Total revenue feeds your weekly Profit and Revenue numbers.</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Bar Revenue</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-bar" min="0" step="0.01" inputmode="decimal" value="' + v(d.bar_revenue) + '" style="height:48px;font-size:16px;"/></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Floor Revenue</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-floor" min="0" step="0.01" inputmode="decimal" value="' + v(d.floor_revenue) + '" style="height:48px;font-size:16px;"/></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Covers</label>'
          + '<input type="number" id="aw-covers" min="0" inputmode="numeric" value="' + v(d.covers) + '" style="height:48px;font-size:16px;"/></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:6px;">'
        + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val good" id="aw-total">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="aw-check">-</div></div>'
      + '</div>'
      + '<div class="card-actions"><button class="btn btn-primary btn-lg" id="aw-next">Continue to Cash Reconciliation</button></div>'
    + '</div>';
  },

  // ── Step 2: Cash Reconciliation ───────────────────────────────────────────
  stepCash(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    const tolerance = (App.data?.settings?.cash_tolerance) || 10;
    return '<div class="card"><div class="card-title">Step 2 of 5 &middot; Cash Reconciliation</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Opening bank and shift drops are filled in for you. Enter the POS cash sales total and what you counted in the drawer at close.</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Opening Bank <span style="color:var(--t4);font-weight:400;">(locked)</span></label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" value="' + v(d.opening_bank) + '" disabled style="height:44px;font-size:15px;"/></div></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Drops Out <span style="color:var(--t4);font-weight:400;">(locked)</span></label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" value="' + v(d.drops_total) + '" disabled style="height:44px;font-size:15px;"/></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>POS Cash Sales</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-sales-cash" min="0" step="0.01" inputmode="decimal" value="' + v(d.sales_cash) + '" placeholder="From POS" style="height:44px;font-size:15px;"/></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Counted Cash</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-counted" min="0" step="0.01" inputmode="decimal" value="' + v(d.counted_cash) + '" placeholder="From drawer" style="height:44px;font-size:15px;"/></div></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:6px;">'
        + '<div class="calc-item"><div class="calc-label">Expected</div><div class="calc-val" id="aw-expected">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Variance</div><div class="calc-val" id="aw-variance">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val" id="aw-vstatus">-</div></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Tolerance ' + App.fmtCurrency(tolerance) + ' from Hub Settings. A variance outside tolerance auto-logs to the Variance Log when you close the shift.</div>'
      + '<div style="margin-top:14px;">'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" id="aw-cash-skip" ' + (d.cash_skipped ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>'
          + 'Skip cash reconciliation (drawer was not counted this shift)'
        + '</label>'
      + '</div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="aw-back">Back</button><button class="btn btn-primary btn-lg" id="aw-next">Continue to Exception Review</button></div>'
    + '</div>';
  },

  // ── Step 3: Exception Review ──────────────────────────────────────────────
  stepExceptions(s) {
    const d = this._closeDraft;
    // Pull each exception category fresh so any logging the operator just
    // did mid-wizard (via Cancel and Return) reflects.
    const eighty6 = ((App.shiftData && App.shiftData.sc_86_list) || []).filter(i => i.status !== 'Back');
    const vcThreshold = 30;
    const vc = ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => r.date === s.date && (parseFloat(r.amount) || 0) >= vcThreshold);
    const openMaint = ((App.shiftData && App.shiftData.sc_maintenance) || []).filter(m => m.status !== 'Resolved');
    const closingCheck = ((App.shiftData && App.shiftData.sc_checklists) || [])
      .filter(c => c.date === s.date && (c.type || '').toLowerCase().includes('clos'))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
    const checklistDone = closingCheck ? (closingCheck.completion_pct || 0) : null;
    const checklistIncomplete = checklistDone != null && checklistDone < 100;

    const item = (key, count, title, sub, target, color) => {
      const ack = d.ack[key];
      const bg = count === 0 ? 'var(--input)' : ack ? 'var(--input)' : 'rgba(199,125,125,0.08)';
      const cntColor = count === 0 ? 'var(--t4)' : color;
      const ackHTML = count === 0
        ? '<span style="font-size:10px;color:var(--t4);font-weight:700;letter-spacing:1px;">CLEAR</span>'
        : '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" class="aw-ack" data-key="' + key + '" ' + (ack ? 'checked' : '') + ' style="width:14px;height:14px;accent-color:var(--gold);cursor:pointer;"/>'
          + 'Acknowledged</label>';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid var(--b2);border-radius:4px;background:' + bg + ';margin-bottom:8px;">'
        + '<div style="display:flex;align-items:center;gap:14px;">'
          + '<div style="font-size:28px;font-weight:800;color:' + cntColor + ';font-family:\'Barlow Condensed\';line-height:1;min-width:40px;text-align:center;">' + count + '</div>'
          + '<div>'
            + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(title) + '</div>'
            + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(sub) + '</div>'
          + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:14px;">'
          + ackHTML
          + (count > 0 && target ? '<button class="btn btn-ghost btn-sm aw-jump" data-target="' + esc(target) + '">Open</button>' : '')
        + '</div>'
      + '</div>';
    };

    const bigVcTotal = vc.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
    return '<div class="card"><div class="card-title">Step 3 of 5 &middot; Exception Review</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Eyes on the exceptions before you close. Open one to investigate or fix; acknowledge each line when you have looked at it.</div>'
      + item('e86', eighty6.length, '86\'d Items Still Out', eighty6.length === 0 ? 'Nothing 86\'d.' : eighty6.slice(0, 3).map(i => i.item).join(', ') + (eighty6.length > 3 ? '...' : ''), 'sc-86-list', 'var(--red)')
      + item('vc',  vc.length, 'Big Voids and Comps This Shift', vc.length === 0 ? 'No voids or comps over $' + vcThreshold + '.' : 'Over $' + vcThreshold + ' threshold &middot; ' + App.fmtCurrency(bigVcTotal) + ' total', 'sc-void-comp', 'var(--red)')
      + item('mt',  openMaint.length, 'Open Maintenance Issues', openMaint.length === 0 ? 'Nothing flagged.' : openMaint.slice(0, 3).map(m => m.issue || m.item || 'Issue').join(', ') + (openMaint.length > 3 ? '...' : ''), 'sc-maintenance', 'var(--red)')
      + item('cl',  checklistIncomplete ? 1 : 0, 'Closing Checklist', !closingCheck ? 'No closing checklist run yet for tonight.' : checklistIncomplete ? checklistDone + '% complete &middot; finish before closing' : 'Complete.', 'sc-closing-checklist', 'var(--red)')
      + '<div class="card-actions"><button class="btn btn-ghost" id="aw-back">Back</button><button class="btn btn-primary btn-lg" id="aw-next">Continue to Tip Reconciliation</button></div>'
    + '</div>';
  },

  // ── Step 4: Tip Reconciliation ────────────────────────────────────────────
  // Phase 2 stub. Phase 3 will auto-fire the Tip Pool calc from this step
  // using the shift's logged staff. For now we surface the numbers and link
  // to the existing Tip Pool screen so the operator can still reconcile.
  stepTips(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || t.date === s.date);
    const tipsTotal = tips.reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0);
    const tipsCash  = tips.reduce((t, r) => t + (parseFloat(r.cash_tips) || 0), 0);
    const tipsCard  = tips.reduce((t, r) => t + (parseFloat(r.card_tips) || 0), 0);

    return '<div class="card"><div class="card-title">Step 4 of 5 &middot; Tip Reconciliation</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Tips logged in Labor Control for this shift roll up here. Enter the total tips your POS reported so the variance is on record.</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
        + '<div class="calc-item"><div class="calc-label">Logged Cash Tips</div><div class="calc-val">' + App.fmtCurrency(tipsCash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Card Tips</div><div class="calc-val">' + App.fmtCurrency(tipsCard) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Total</div><div class="calc-val good">' + App.fmtCurrency(tipsTotal) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Entries</div><div class="calc-val">' + tips.length + '</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>POS Tips Reported</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-pos-tips" min="0" step="0.01" inputmode="decimal" value="' + v(d.tips_pos_reported) + '" placeholder="From POS" style="height:44px;font-size:15px;"/></div></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Variance vs Logged</label>'
          + '<div class="calc-val" id="aw-tip-var" style="height:44px;display:flex;align-items:center;">-</div></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;line-height:1.6;">Need to split the pool? Open the Tip Pool Calculator and the entries for tonight will be loadable there. Phase 3 will auto-fire the pool from this step.</div>'
      + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="aw-tip-pool">Open Tip Pool Calculator</button></div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="aw-back">Back</button><button class="btn btn-primary btn-lg" id="aw-next">Continue to Handoff Notes</button></div>'
    + '</div>';
  },

  // ── Step 5: Handoff Notes + Final Close ───────────────────────────────────
  stepHandoff(s) {
    const d = this._closeDraft;
    return '<div class="card"><div class="card-title">Step 5 of 5 &middot; Handoff Notes</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Anything the next manager needs to know before they open. These notes print on the Shift Handoff Report.</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes for the Opener</label>'
        + '<textarea id="aw-handoff" rows="5" placeholder="Restock priorities, equipment to watch, customer follow-ups, anything the opener will inherit...">' + esc(d.handoff_notes || '') + '</textarea></div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;">Closing the shift saves revenue, logs the cash variance (if any), and writes these notes to the shift record. A Shift Handoff Report will be ready to print or email on the next screen.</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-ghost" id="aw-back">Back</button>'
        + '<button class="btn btn-primary btn-lg" id="aw-finalize">Close Shift</button>'
        + '<span id="aw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
  },

  // Stash the current step's inputs into the draft. Called on Next / Back so
  // wizard state survives navigation between steps.
  syncWizardInputs() {
    const d = this._closeDraft;
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    if (d.step === 'revenue') {
      d.bar_revenue   = num('aw-bar');
      d.floor_revenue = num('aw-floor');
      d.covers        = num('aw-covers');
    } else if (d.step === 'cash') {
      d.sales_cash    = num('aw-sales-cash');
      d.counted_cash  = num('aw-counted');
      d.cash_skipped  = !!document.getElementById('aw-cash-skip')?.checked;
    } else if (d.step === 'exceptions') {
      document.querySelectorAll('.aw-ack').forEach(c => { d.ack[c.dataset.key] = c.checked; });
    } else if (d.step === 'tips') {
      d.tips_pos_reported = num('aw-pos-tips');
    } else if (d.step === 'handoff') {
      d.handoff_notes = document.getElementById('aw-handoff')?.value || '';
    }
  },

  wireWizard(s) {
    const d = this._closeDraft;
    document.getElementById('aw-cancel')?.addEventListener('click', () => {
      this._closeDraft = null;
      this.renderActive(s);
    });
    document.getElementById('aw-next')?.addEventListener('click', () => {
      this.syncWizardInputs();
      const idx = this.WIZARD_STEPS.findIndex(x => x.key === d.step);
      d.step = this.WIZARD_STEPS[Math.min(idx + 1, this.WIZARD_STEPS.length - 1)].key;
      this.renderWizardStep(s);
    });
    document.getElementById('aw-back')?.addEventListener('click', () => {
      this.syncWizardInputs();
      const idx = this.WIZARD_STEPS.findIndex(x => x.key === d.step);
      d.step = this.WIZARD_STEPS[Math.max(idx - 1, 0)].key;
      this.renderWizardStep(s);
    });
    document.getElementById('aw-finalize')?.addEventListener('click', () => {
      this.syncWizardInputs();
      this.finalizeClose(s);
    });

    // Step 1: live calc strip
    if (d.step === 'revenue') {
      const recalc = () => {
        const num = id => parseFloat(document.getElementById(id)?.value) || 0;
        const total = num('aw-bar') + num('aw-floor');
        const covers = num('aw-covers');
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('aw-total', App.fmtCurrency(total));
        set('aw-check', covers > 0 ? App.fmtCurrency(total / covers) : '-');
      };
      ['aw-bar','aw-floor','aw-covers'].forEach(fid =>
        document.getElementById(fid)?.addEventListener('input', recalc));
      recalc();
    }

    // Step 2: live cash recon calc
    if (d.step === 'cash') {
      const recalc = () => {
        const num = id => parseFloat(document.getElementById(id)?.value) || 0;
        const skipped = !!document.getElementById('aw-cash-skip')?.checked;
        const expected = (d.opening_bank || 0) + num('aw-sales-cash') - (d.drops_total || 0);
        const counted  = num('aw-counted');
        const variance = counted - expected;
        const tol = (App.data?.settings?.cash_tolerance) || 10;
        const status = skipped ? 'SKIPPED' : Math.abs(variance) <= tol ? 'OK' : variance < 0 ? 'SHORT' : 'OVER';
        const color = skipped ? 'var(--t3)' : status === 'OK' ? 'var(--gold)' : 'var(--red)';
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('aw-expected', App.fmtCurrency(expected));
        const vEl = document.getElementById('aw-variance');
        if (vEl) {
          vEl.textContent = (variance >= 0 ? '+' : '') + App.fmtCurrency(variance);
          vEl.style.color = skipped ? 'var(--t4)' : status === 'OK' ? 'var(--gold)' : 'var(--red)';
        }
        const sEl = document.getElementById('aw-vstatus');
        if (sEl) { sEl.textContent = status; sEl.style.color = color; }
      };
      ['aw-sales-cash','aw-counted','aw-cash-skip'].forEach(fid =>
        document.getElementById(fid)?.addEventListener('input', recalc));
      document.getElementById('aw-cash-skip')?.addEventListener('change', recalc);
      recalc();
    }

    // Step 3: jump to source screens. Cancel the wizard draft so the operator
    // doesn't lose state — they'll come right back to the wizard from Active.
    if (d.step === 'exceptions') {
      this.container.querySelectorAll('.aw-jump').forEach(b => b.addEventListener('click', () => {
        App.navigate(b.dataset.target);
      }));
    }

    // Step 4: live tip variance + Tip Pool link
    if (d.step === 'tips') {
      const recalc = () => {
        const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || t.date === s.date);
        const tipsTotal = tips.reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0);
        const pos = parseFloat(document.getElementById('aw-pos-tips')?.value) || 0;
        const variance = pos - tipsTotal;
        const el = document.getElementById('aw-tip-var');
        if (el) {
          el.textContent = pos > 0 ? (variance >= 0 ? '+' : '') + App.fmtCurrency(variance) : '-';
          el.style.color = pos > 0 ? (Math.abs(variance) < 5 ? 'var(--gold)' : 'var(--red)') : '';
        }
      };
      document.getElementById('aw-pos-tips')?.addEventListener('input', recalc);
      document.getElementById('aw-tip-pool')?.addEventListener('click', () => App.navigate('lc-tip-pool'));
      recalc();
    }
  },

  // Final commit: write everything to the shift record, auto-log cash variance
  // if there is one, then land on the closed-shift screen which links to the
  // Handoff Report (Chunk D).
  async finalizeClose(s) {
    const d = this._closeDraft;
    const err = document.getElementById('aw-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) { this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div')); return; }

    const bar = d.bar_revenue || 0, floor = d.floor_revenue || 0;
    const expected = (d.opening_bank || 0) + (d.sales_cash || 0) - (d.drops_total || 0);
    const cashVariance = d.cash_skipped ? null : ((d.counted_cash || 0) - expected);
    const tol = (App.data?.settings?.cash_tolerance) || 10;

    const snapshot = { ...list[i] };
    list[i] = {
      ...list[i],
      bar_revenue:   bar,
      floor_revenue: floor,
      total_revenue: bar + floor,
      covers:        d.covers,
      notes:         d.notes || '',
      handoff_notes: d.handoff_notes || '',
      cash_recon: {
        opening_bank: d.opening_bank || 0,
        drops_total:  d.drops_total || 0,
        sales_cash:   d.sales_cash,
        counted_cash: d.counted_cash,
        expected,
        variance:     cashVariance,
        skipped:      d.cash_skipped
      },
      tip_recon: {
        logged_total: ((App.laborData && App.laborData.lc_tips) || [])
          .filter(t => t.shift_id === s.id || t.date === s.date)
          .reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0),
        pos_reported: d.tips_pos_reported,
        variance:     d.tips_pos_reported != null ? (d.tips_pos_reported - ((App.laborData && App.laborData.lc_tips) || [])
          .filter(t => t.shift_id === s.id || t.date === s.date)
          .reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0)) : null
      },
      exception_ack: d.ack || {},
      status:        'Closed',
      closed_at:     new Date().toISOString()
    };

    // Auto-log cash variance to sc_variances when the operator actually
    // counted the drawer. This is what fed Cash Reconciliation in Profit
    // Recovery without forcing the operator to navigate to a separate
    // screen and re-enter the same numbers.
    let varianceLogged = null;
    if (!d.cash_skipped && cashVariance != null) {
      if (!Array.isArray(App.shiftData.sc_variances)) App.shiftData.sc_variances = [];
      varianceLogged = {
        id:            App.uid(),
        date:          s.date,
        shift_type:    s.shift_type || 'Close',
        drawer:        'Main',
        cashier:       s.manager || '',
        expected_cash: expected,
        counted_cash:  d.counted_cash || 0,
        variance:      cashVariance,
        tolerance:     tol,
        status:        Math.abs(cashVariance) <= tol ? 'OK' : cashVariance < 0 ? 'Short' : 'Over',
        reason:        '',
        notes:         'Auto-logged from Shift Close wizard',
        source:        'shift-close',
        source_id:     s.id,
        created_at:    new Date().toISOString()
      };
      App.shiftData.sc_variances.push(varianceLogged);
      list[i].cash_recon.variance_log_id = varianceLogged.id;
    }

    const btn = document.getElementById('aw-finalize');
    if (btn) { btn.disabled = true; btn.textContent = 'Closing...'; }
    const ok = await App.saveShift();
    if (ok) {
      this._closeDraft = null;
      this.renderClosed(list[i]);
    } else {
      list[i] = snapshot;
      if (varianceLogged) App.shiftData.sc_variances = App.shiftData.sc_variances.filter(v => v.id !== varianceLogged.id);
      if (btn) { btn.disabled = false; btn.textContent = 'Close Shift'; }
      fail('Could not close the shift. Try again.');
    }
  },

  renderClosed(s) {
    const cv = s.cash_recon ? s.cash_recon.variance : null;
    const cashLine = (cv == null) ? ''
      : '<div style="font-size:11px;color:' + (Math.abs(cv) <= ((App.data?.settings?.cash_tolerance) || 10) ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;margin-top:6px;">'
        + 'Cash variance ' + (cv >= 0 ? '+' : '') + App.fmtCurrency(cv) + ' &middot; auto-logged to Variance Log</div>';
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Shift Closed</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date)
      + ' &middot; ' + App.fmtCurrency(s.total_revenue || 0) + ' revenue'
      + (s.covers ? ' &middot; ' + s.covers + ' covers' : '') + '</div>'
      + cashLine
      + '</div>'
      + '<div class="card-actions" style="justify-content:center;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="ac-handoff" data-shift-id="' + esc(s.id) + '">Print Handoff Report</button>'
      + '<button class="btn btn-ghost" id="ac-start">Start Another Shift</button>'
      + '<button class="btn btn-ghost" id="ac-history">View Shift History</button>'
      + '</div></div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#ac-start')) this.renderStart();
      else if (ev.target.closest('#ac-history')) App.navigate('sc-shift-history');
      else if (ev.target.closest('#ac-handoff')) {
        // Chunk D wires the actual report screen. For now, navigate to
        // shift history detail as a placeholder.
        const target = (S.ShiftHandoff && S.ShiftHandoff.openForShift) ? null : 'sc-shift-history';
        if (target) App.navigate(target);
        else S.ShiftHandoff.openForShift(s.id);
      }
    };
  }
};
