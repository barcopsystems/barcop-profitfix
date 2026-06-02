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
    return App.SHIFT_TYPES;
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
    const drawerOpts = (App.drawerOptions ? App.drawerOptions('', { placeholder: 'Select drawer...' }) : '<option value="">No drawers set up</option>');
    // Pick a sensible default drawer: the first active drawer, if any. Its
    // default_opening_bank pre-fills the Opening Bank field.
    const firstDrawer = ((App.shiftData && App.shiftData.sc_drawers) || []).find(d => d.active !== false);
    const defaultBank = firstDrawer && firstDrawer.default_opening_bank != null ? firstDrawer.default_opening_bank : '';

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
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Drawer / Register</label>'
      + '<select id="as-drawer" style="height:48px;">' + drawerOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Opening Bank</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="as-bank" min="0" step="0.01" '
      + 'inputmode="decimal" value="' + esc(String(defaultBank)) + '" style="height:48px;font-size:16px;"/></div></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Staff on Floor</label>'
      + '<input type="number" id="as-staff" min="0" inputmode="numeric" style="height:48px;font-size:16px;"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Cash Tolerance <span style="color:var(--t4);font-weight:400;">(this shift)</span></label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="as-tol" min="0" step="0.5" '
      + 'inputmode="decimal" value="' + this._defaultToleranceFor(this.shiftTypes()[0]) + '" style="height:48px;font-size:16px;"/></div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="as-start">Start Shift</button>'
      + '<span id="as-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
    this.container.onclick = null;
    // When operator changes shift type, re-pre-fill the tolerance field
    // with that shift type's default. Operator can still type a custom one
    // after to override for tonight.
    document.getElementById('as-type')?.addEventListener('change', e => {
      const tolEl = document.getElementById('as-tol');
      if (tolEl) tolEl.value = this._defaultToleranceFor(e.target.value);
    });
    // When operator changes the drawer, pre-fill Opening Bank with that
    // drawer's default. Operator can still override the bank for tonight.
    document.getElementById('as-drawer')?.addEventListener('change', e => {
      const drawer = App.drawerById ? App.drawerById(e.target.value) : null;
      const bankEl = document.getElementById('as-bank');
      if (drawer && drawer.default_opening_bank != null && bankEl) bankEl.value = drawer.default_opening_bank;
    });
    document.getElementById('as-start')?.addEventListener('click', () => this.startShift());
  },

  // Pre-fill default tolerance for the picked shift type. Reads from
  // Shift Control settings (per-shift-type → overall default → 10).
  _defaultToleranceFor(shiftType) {
    return App.cashToleranceForShift({ shift_type: shiftType });
  },

  async startShift() {
    const err = document.getElementById('as-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('as-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };

    const drawerId = document.getElementById('as-drawer')?.value || '';
    const drawer = drawerId && App.drawerById ? App.drawerById(drawerId) : null;
    const rec = {
      id:             App.uid(),
      date,
      shift_type:     document.getElementById('as-type')?.value || '',
      manager_id:     document.getElementById('as-mgr')?.value || '',
      manager:        (App.staffById(document.getElementById('as-mgr')?.value) || {}).name || '',
      drawer_id:      drawerId,
      drawer:         drawer ? drawer.name : '',
      opening_bank:   num('as-bank'),
      staff_on_floor: num('as-staff'),
      cash_tolerance: num('as-tol'),
      bar_revenue:    0,
      floor_revenue:  0,
      total_revenue:  0,
      covers:         null,
      status:         'Open',
      notes:          '',
      shift_notes:    [],
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

  // Per-shift labor so far for the active-shift dashboard. Two sources, in
  // priority order: logged lc_actuals for today's date win when present
  // (operator clocked staff in/out and logged hours during the shift).
  // Falls back to the day's scheduled labor from lc_schedules so the tile
  // still shows the budget commitment when nothing has been logged yet.
  laborSoFar(s) {
    const actuals = ((App.laborData && App.laborData.lc_actuals) || []).filter(a => a.date === s.date);
    if (actuals.length) {
      const cost = actuals.reduce((t, a) => t + (parseFloat(a.cost) || 0), 0);
      const hours = actuals.reduce((t, a) => t + (parseFloat(a.hours) || 0), 0);
      return { cost, hours, source: 'logged', count: actuals.length };
    }
    // Fall back to scheduled labor for today
    const ws = App.weekStartFor ? App.weekStartFor(s.date) : '';
    if (!ws) return { cost: 0, hours: 0, source: 'none', count: 0 };
    const sched = ((App.laborData && App.laborData.lc_schedules) || []).find(x => x.week_start === ws);
    if (!sched || !Array.isArray(sched.shifts)) return { cost: 0, hours: 0, source: 'none', count: 0 };
    // Resolve day-of-week label (Mon..Sun) for s.date
    const days = App.DAYS_MON_FIRST || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const d = new Date(s.date + 'T00:00:00');
    const wd = (d.getDay() + 6) % 7;
    const dayLabel = days[wd];
    const todays = sched.shifts.filter(sh => sh.day === dayLabel);
    const cost = todays.reduce((t, sh) => t + (parseFloat(sh.cost) || 0), 0);
    const hours = todays.reduce((t, sh) => t + (parseFloat(sh.hours) || 0), 0);
    return { cost, hours, source: 'scheduled', count: todays.length };
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
    const labor = this.laborSoFar(s);
    const laborSub = labor.source === 'logged'
      ? labor.hours.toFixed(1) + ' hrs logged'
      : labor.source === 'scheduled'
        ? labor.hours.toFixed(1) + ' hrs scheduled'
        : 'No hours yet';

    // Cover Goal vs Covers So Far. Goal comes from this week's Revenue Forecast
    // covers_per_day for today's weekday. So-far covers come from the shift's
    // running cover total (typed during shift close, or pulled from any
    // matching server_check entries logged during shift so the floor manager
    // sees a live read).
    const goalForToday = (() => {
      if (!s.date || !App.weekStartFor || !App.DAYS_MON_FIRST) return 0;
      const ws = App.weekStartFor(s.date);
      const f = App.forecastForWeek ? App.forecastForWeek(ws) : null;
      if (!f || !f.covers_per_day) return 0;
      const dt = new Date(s.date + 'T00:00:00');
      if (isNaN(dt.getTime())) return 0;
      const idx = (dt.getDay() + 6) % 7;
      const key = App.DAYS_MON_FIRST[idx];
      return parseFloat(f.covers_per_day[key]) || 0;
    })();
    const coversSoFar = (() => {
      // Prefer the operator-typed running cover number on the shift record.
      if (s.covers != null && s.covers > 0) return parseFloat(s.covers) || 0;
      // Fall back to summing today's logged server_check entries for this
      // shift_type (live read during service when servers are logging shift
      // checks but cover total hasn't been typed on the shift yet).
      const checks = (App.data.revenue_server_checks || [])
        .filter(c => c.date === s.date && c.shift === s.shift_type);
      return checks.reduce((sum, c) => sum + (parseFloat(c.covers) || 0), 0);
    })();
    const coverProgressLabel = goalForToday > 0
      ? coversSoFar.toFixed(0) + ' of ' + goalForToday + (coversSoFar >= goalForToday ? ' (hit)' : ' (' + (goalForToday - coversSoFar).toFixed(0) + ' to goal)')
      : (coversSoFar > 0 ? coversSoFar.toFixed(0) + ' so far' : 'No goal set');

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
      + stat('Cover Goal', goalForToday > 0 ? goalForToday + '' : '-', coverProgressLabel)
      + stat('Labor So Far', App.fmtCurrency(labor.cost), laborSub)
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

      + this.renderShiftNotesCard(s)

      + '<div class="card"><div class="card-title">End of Shift</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-bottom:14px;">Closing the shift records its revenue '
      + 'and covers. That revenue is what feeds your weekly Profit and Revenue numbers.</div>'
      + '<button class="btn btn-primary btn-lg" id="as-end">End Shift</button>'
      + '</div></div>';

    this.container.onclick = ev => {
      const go = ev.target.closest('.as-go');
      if (go) App.navigate(go.dataset.go);
      else if (ev.target.closest('#as-end')) this.renderEnd(s);
      else if (ev.target.closest('#sn-add')) this.addShiftNote(s);
      else if (ev.target.closest('.sn-del')) this.removeShiftNote(s, ev.target.closest('.sn-del').dataset.id);
    };
  },

  // ── Mid-shift Notes ────────────────────────────────────────────────────────
  // Operator-pain fix: the handoff_notes field only captures things at close.
  // This adds a running timestamped notebook the manager can drop notes into
  // throughout the shift. Notes flow into the Shift Handoff Report at close.
  renderShiftNotesCard(s) {
    const notes = Array.isArray(s.shift_notes) ? s.shift_notes : [];
    const fmtTime = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };
    const list = notes.length === 0
      ? '<div style="font-size:12px;color:var(--t3);">No notes yet. Drop in anything the closer or the next manager should know. Delivery short, VIP at nine, server X went home sick, weather slowing us down.</div>'
      : '<div style="display:flex;flex-direction:column;gap:8px;">'
        + notes.slice().reverse().map(n => '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;background:var(--input);border-radius:4px;">'
          + '<div style="font-size:10px;color:var(--gold);font-weight:700;letter-spacing:1px;min-width:55px;padding-top:1px;">' + esc(fmtTime(n.at)) + '</div>'
          + '<div style="flex:1;font-size:13px;color:var(--t1);line-height:1.5;white-space:pre-wrap;">' + esc(n.text || '') + '</div>'
          + '<button class="btn btn-ghost btn-sm sn-del" data-id="' + esc(n.id) + '" style="font-size:10px;padding:2px 8px;color:var(--red);">Delete</button>'
          + '</div>').join('')
      + '</div>';
    return '<div class="card"><div class="card-title">Shift Notes</div>'
      + '<div class="form-row" style="gap:10px;align-items:flex-end;margin-bottom:10px;">'
        + '<div class="f" style="flex:1;min-width:220px;margin-bottom:0;"><label>Add a Note</label>'
          + '<textarea id="sn-text" rows="2" placeholder="VIP at 9pm, delivery short on bourbon, weather slowing us down..."></textarea></div>'
        + '<div style="flex-shrink:0;"><button class="btn btn-primary" id="sn-add" style="height:48px;">Add Note</button></div>'
      + '</div>'
      + list
      + '</div>';
  },

  async addShiftNote(s) {
    const textEl = document.getElementById('sn-text');
    const text = textEl?.value.trim();
    if (!text) return;
    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) return;
    if (!Array.isArray(list[i].shift_notes)) list[i].shift_notes = [];
    list[i].shift_notes.push({
      id: App.uid(),
      at: new Date().toISOString(),
      text,
      manager_id: s.manager_id || ''
    });
    const ok = await App.saveShift();
    if (ok) {
      if (textEl) textEl.value = '';
      this.renderActive(list[i]);
    }
  },

  async removeShiftNote(s, noteId) {
    const ok = await App.confirm({ title: 'Delete this shift note?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) return;
    list[i].shift_notes = (list[i].shift_notes || []).filter(n => n.id !== noteId);
    const saved = await App.saveShift();
    if (saved) this.renderActive(list[i]);
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
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Walkouts</label>'
          + '<input type="number" id="aw-walkouts" min="0" inputmode="numeric" value="' + v(d.walkouts) + '" placeholder="0" style="height:48px;font-size:16px;"/></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;line-height:1.5;">Walkouts: parties that came in but left without ordering, usually because the wait was too long. Real lost-cover signal for capacity planning.</div>'
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
    const tolerance = App.cashToleranceForShift(s);
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
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Tolerance ' + App.fmtCurrency(tolerance) + ' from Shift Control Cash Settings. A variance outside tolerance auto-logs to the Variance Log when you close the shift.</div>'
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
    // Completion % from the real saved counts (completion_pct is never persisted).
    const checklistDone = closingCheck
      ? (closingCheck.total_count ? Math.round((closingCheck.done_count || 0) / closingCheck.total_count * 100) : 0)
      : null;
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
  // Tips logged via Labor Control roll up here. POS variance gets captured.
  // The Tip Pool Calculator is INLINE — participants pre-load from the
  // shift's logged tip entries (with hours from lc_actuals), so the operator
  // splits the pool right here without leaving the wizard. Save Pool writes
  // an lc_tip_pools record with shift_id, linking it permanently to this shift.
  stepTips(s) {
    const d = this._closeDraft;
    const v = val => (val != null && val !== '') ? val : '';
    const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date));
    const tipsTotal = tips.reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0);
    const tipsCash  = tips.reduce((t, r) => t + (parseFloat(r.cash_tips) || 0), 0);
    const tipsCard  = tips.reduce((t, r) => t + (parseFloat(r.card_tips) || 0), 0);

    // Hydrate the pool draft. If a saved pool already exists for this shift,
    // load it. Otherwise build from logged tips (with lc_actuals hours).
    this._ensurePoolDraft(s, tips, tipsTotal);
    const pool = d.pool;
    const savedExisting = !!pool.saved_id;

    return '<div class="card"><div class="card-title">Step 4 of 5 &middot; Tip Reconciliation</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Tips logged in Labor Control for this shift roll up here. Enter the total tips your POS reported, then split the pool with the inline calculator below.</div>'
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

      // Inline Tip Pool Calculator
      + '<div style="border-top:1px solid var(--b2);margin-top:18px;padding-top:18px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
          + '<div>'
            + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Tip Pool Split</div>'
            + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (savedExisting ? 'Pool saved. Edit below to update.' : 'Splits the pool across the staff who worked this shift.') + '</div>'
          + '</div>'
        + '</div>'

        + '<div class="form-row" style="gap:16px;">'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Pool Amount</label>'
            + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="aw-pool-amount" min="0" step="0.01" value="' + esc(pool.amount || '') + '"/></div></div>'
          + '<div class="f" style="width:170px;flex-shrink:0;"><label>Method</label>'
            + '<select id="aw-pool-method"><option value="hours"' + (pool.method === 'hours' ? ' selected' : '') + '>By Hours Worked</option>'
            + '<option value="equal"' + (pool.method === 'equal' ? ' selected' : '') + '>Equal Split</option></select></div>'
        + '</div>'

        + '<div id="aw-pool-rows" style="margin-top:8px;"></div>'
        + '<button class="btn btn-ghost btn-sm" id="aw-pool-add" style="margin-top:8px;">+ Add Participant</button>'

        + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
          + '<div class="calc-item"><div class="calc-label">Participants</div><div class="calc-val" id="aw-pool-count">0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val" id="aw-pool-hours">0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="aw-pool-alloc">$0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="aw-pool-rem">$0</div></div>'
        + '</div>'

        + '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;">'
          + '<button class="btn btn-primary btn-sm" id="aw-pool-save">' + (savedExisting ? 'Update Pool' : 'Save Pool') + '</button>'
          + '<span id="aw-pool-status" style="font-size:11px;color:var(--gold);' + (savedExisting ? '' : 'display:none;') + '">Pool saved for this shift.</span>'
          + '<span id="aw-pool-err" style="color:var(--red);font-size:12px;display:none;"></span>'
        + '</div>'
      + '</div>'

      + '<div class="card-actions"><button class="btn btn-ghost" id="aw-back">Back</button><button class="btn btn-primary btn-lg" id="aw-next">Continue to Handoff Notes</button></div>'
    + '</div>';
  },

  // ── Pool draft helpers ────────────────────────────────────────────────────
  _ensurePoolDraft(s, tips, tipsTotal) {
    const d = this._closeDraft;
    if (d.pool) return; // already hydrated for this wizard run

    const existing = ((App.laborData && App.laborData.lc_tip_pools) || []).find(p => p.shift_id === s.id);
    if (existing) {
      d.pool = {
        method:        existing.method || 'hours',
        amount:        String(existing.pool_amount || ''),
        participants:  (existing.participants || []).map(p => ({ staff_id: p.staff_id, name: p.name, hours: p.hours, share: p.share })),
        saved_id:      existing.id
      };
      return;
    }

    // Fresh draft. Participants come from: tips logged for this shift (most
    // accurate — those are the tipped staff). Fall back to lc_actuals filtered
    // to this shift's date if no tips logged yet.
    const actuals = ((App.laborData && App.laborData.lc_actuals) || []).filter(a => a.date === s.date);
    const staffMap = new Map();
    tips.forEach(t => {
      if (!t.staff_id) return;
      const hrs = (t.hours != null && t.hours > 0)
        ? t.hours
        : (actuals.find(a => a.staff_id === t.staff_id) || {});
      const hoursVal = (typeof hrs === 'number') ? hrs : (hrs.hours || 0);
      if (!staffMap.has(t.staff_id)) staffMap.set(t.staff_id, { staff_id: t.staff_id, name: t.name, hours: hoursVal || 0, share: 0 });
    });
    // If no tip entries at all, fall back to staff who clocked in
    if (staffMap.size === 0) {
      actuals.forEach(a => {
        if (!a.staff_id) return;
        const staff = (App.laborData?.lc_staff || []).find(x => x.id === a.staff_id);
        staffMap.set(a.staff_id, { staff_id: a.staff_id, name: staff?.name || '', hours: a.hours || 0, share: 0 });
      });
    }

    d.pool = {
      method:        'hours',
      amount:        tipsTotal > 0 ? String(tipsTotal.toFixed(2)) : '',
      participants:  [...staffMap.values()],
      saved_id:      ''
    };
  },

  // Render the participant rows for the inline pool. Same shape as standalone
  // calculator, just wired into the wizard's IDs.
  renderPoolRows() {
    const area = document.getElementById('aw-pool-rows');
    if (!area) return;
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    const equal = pool.method === 'equal';
    const allStaff = (App.laborData?.lc_staff || []).filter(s => s.status !== 'Inactive');
    const staffOpts = sel => '<option value="">Select staff...</option>'
      + allStaff.map(s => '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');

    area.innerHTML = pool.participants.map((r, i) =>
      '<div class="aw-pool-row" data-idx="' + i + '" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:10px;border:1px solid var(--b1);border-radius:4px;margin-bottom:6px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
        + '<select class="aw-pool-staff">' + staffOpts(r.staff_id) + '</select></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Hours</label>'
        + '<input type="number" class="aw-pool-hours" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"' + (equal ? ' disabled' : '') + '/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Share</label>'
        + '<div class="aw-pool-share" style="font-size:15px;font-weight:600;font-family:\'Barlow Condensed\';color:var(--gold);padding-bottom:6px;">' + (r.share > 0 ? App.fmtCurrency(r.share) : '-') + '</div></div>'
      + '<button class="btn btn-ghost btn-sm aw-pool-remove" style="margin-bottom:6px;">Remove</button>'
      + '</div>'
    ).join('') || '<div style="font-size:11px;color:var(--t3);padding:6px 0;">No participants yet. Click + Add Participant.</div>';
  },

  collectPool() {
    const d = this._closeDraft;
    if (!d.pool) return;
    d.pool.amount = document.getElementById('aw-pool-amount')?.value || '';
    d.pool.method = document.getElementById('aw-pool-method')?.value || 'hours';
    const rows = [...document.querySelectorAll('.aw-pool-row')];
    if (rows.length) {
      d.pool.participants = rows.map(el => ({
        staff_id: el.querySelector('.aw-pool-staff')?.value || '',
        name:     (App.laborData?.lc_staff || []).find(s => s.id === (el.querySelector('.aw-pool-staff')?.value || ''))?.name || '',
        hours:    parseFloat(el.querySelector('.aw-pool-hours')?.value) || 0,
        share:    0
      }));
    }
  },

  computePoolShares() {
    const d = this._closeDraft;
    if (!d.pool) return;
    const pool = d.pool;
    const amount = parseFloat(pool.amount) || 0;
    const equal = pool.method === 'equal';
    const valid = pool.participants.filter(p => p.staff_id);
    let totalHours = 0;
    pool.participants.forEach(p => { totalHours += parseFloat(p.hours) || 0; });
    pool.participants.forEach(p => {
      if (!p.staff_id) { p.share = 0; return; }
      if (equal) p.share = valid.length > 0 ? amount / valid.length : 0;
      else {
        const h = parseFloat(p.hours) || 0;
        p.share = totalHours > 0 ? amount * (h / totalHours) : 0;
      }
    });
  },

  refreshPoolCalc() {
    this.collectPool();
    this.computePoolShares();
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    // Update share displays in-place without re-rendering the rows (preserves
    // input focus while the operator types).
    const rows = [...document.querySelectorAll('.aw-pool-row')];
    rows.forEach((el, i) => {
      const p = pool.participants[i];
      if (!p) return;
      const sh = el.querySelector('.aw-pool-share');
      if (sh) sh.textContent = p.share > 0 ? App.fmtCurrency(p.share) : '-';
    });
    const amount = parseFloat(pool.amount) || 0;
    const alloc = pool.participants.reduce((s, p) => s + (p.share || 0), 0);
    const totalHours = pool.participants.reduce((s, p) => s + (parseFloat(p.hours) || 0), 0);
    const count = pool.participants.filter(p => p.staff_id).length;
    const rem = amount - alloc;
    const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('aw-pool-count', count);
    set('aw-pool-hours', totalHours.toFixed(2).replace(/\.00$/, ''));
    set('aw-pool-alloc', App.fmtCurrency(alloc));
    set('aw-pool-rem', App.fmtCurrency(rem), Math.abs(rem) > 0.01 ? 'warn' : 'good');
  },

  async savePoolInline(s) {
    this.collectPool();
    this.computePoolShares();
    const d = this._closeDraft;
    const pool = d.pool;
    if (!pool) return;
    const err = document.getElementById('aw-pool-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const amount = parseFloat(pool.amount) || 0;
    if (amount <= 0) { fail('Enter the pool amount.'); return; }
    const valid = pool.participants.filter(p => p.staff_id);
    if (valid.length === 0) { fail('Add at least one participant.'); return; }
    if (pool.method === 'hours' && valid.every(p => (parseFloat(p.hours) || 0) <= 0)) {
      fail('Enter hours for the hours-based split.'); return;
    }
    if (err) err.style.display = 'none';

    const totalHours = valid.reduce((sum, p) => sum + (parseFloat(p.hours) || 0), 0);
    const rec = {
      id:          pool.saved_id || App.uid(),
      shift_id:    s.id,
      date:        s.date,
      shift_type:  s.shift_type || '',
      method:      pool.method,
      pool_amount: amount,
      total_hours: totalHours,
      participants: valid.map(p => ({ staff_id: p.staff_id, name: p.name, hours: parseFloat(p.hours) || 0, share: p.share || 0 })),
      updated_at:  new Date().toISOString(),
      created_at:  pool.saved_id ? undefined : new Date().toISOString()
    };

    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tip_pools)) App.laborData.lc_tip_pools = [];
    const list = App.laborData.lc_tip_pools;
    if (pool.saved_id) {
      const i = list.findIndex(x => x.id === pool.saved_id);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    pool.saved_id = rec.id;

    const btn = document.getElementById('aw-pool-save');
    const status = document.getElementById('aw-pool-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    if (btn) { btn.disabled = false; btn.textContent = 'Update Pool'; }
    if (ok) {
      if (status) { status.textContent = 'Pool saved for this shift.'; status.style.display = 'inline'; }
    } else {
      fail('Save failed. Try again.');
    }
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
      d.walkouts      = num('aw-walkouts');
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
        const tol = App.cashToleranceForShift(s);
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

    // Step 4: live tip variance + inline Tip Pool calculator
    if (d.step === 'tips') {
      const recalcVar = () => {
        const tips = ((App.laborData && App.laborData.lc_tips) || []).filter(t => t.shift_id === s.id || (!t.shift_id && t.date === s.date));
        const tipsTotal = tips.reduce((t, r) => t + (parseFloat(r.total_tips) || 0), 0);
        const pos = parseFloat(document.getElementById('aw-pos-tips')?.value) || 0;
        const variance = pos - tipsTotal;
        const el = document.getElementById('aw-tip-var');
        if (el) {
          el.textContent = pos > 0 ? (variance >= 0 ? '+' : '') + App.fmtCurrency(variance) : '-';
          el.style.color = pos > 0 ? (Math.abs(variance) < 5 ? 'var(--gold)' : 'var(--red)') : '';
        }
      };
      document.getElementById('aw-pos-tips')?.addEventListener('input', recalcVar);
      recalcVar();

      // Inline pool calculator wiring
      this.renderPoolRows();
      this.refreshPoolCalc();

      // Pool inputs delegate listeners (per-row + amount/method)
      const rowsEl = document.getElementById('aw-pool-rows');
      rowsEl?.addEventListener('input', () => this.refreshPoolCalc());
      rowsEl?.addEventListener('change', () => this.refreshPoolCalc());
      rowsEl?.addEventListener('click', ev => {
        if (ev.target.closest('.aw-pool-remove')) {
          this.collectPool();
          d.pool.participants.splice(parseInt(ev.target.closest('.aw-pool-row').dataset.idx, 10), 1);
          this.renderPoolRows();
          this.refreshPoolCalc();
        }
      });
      document.getElementById('aw-pool-add')?.addEventListener('click', () => {
        this.collectPool();
        d.pool.participants.push({ staff_id: '', name: '', hours: 0, share: 0 });
        this.renderPoolRows();
        this.refreshPoolCalc();
      });
      document.getElementById('aw-pool-amount')?.addEventListener('input', () => this.refreshPoolCalc());
      document.getElementById('aw-pool-method')?.addEventListener('change', () => {
        d.pool.method = document.getElementById('aw-pool-method').value;
        this.renderPoolRows();
        this.refreshPoolCalc();
      });
      document.getElementById('aw-pool-save')?.addEventListener('click', () => this.savePoolInline(s));
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
    const tol = App.cashToleranceForShift(s);

    const snapshot = { ...list[i] };
    list[i] = {
      ...list[i],
      bar_revenue:   bar,
      floor_revenue: floor,
      total_revenue: bar + floor,
      covers:        d.covers,
      walkouts:      d.walkouts,
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
        drawer_id:     s.drawer_id || '',
        drawer:        s.drawer || ((App.drawerById && s.drawer_id) ? (App.drawerById(s.drawer_id) || {}).name || '' : ''),
        cashier_id:    s.manager_id || '',
        cashier:       s.manager || '',
        expected_cash: expected,
        counted_cash:  d.counted_cash || 0,
        variance:      cashVariance,
        tolerance:     tol,
        status:        Math.abs(cashVariance) <= tol ? 'Within Tolerance' : cashVariance < 0 ? 'Short' : 'Over',
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
      : '<div style="font-size:11px;color:' + (Math.abs(cv) <= App.cashToleranceForShift(s) ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;margin-top:6px;">'
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
      + '<button class="btn btn-primary" id="ac-handoff" data-shift-id="' + esc(s.id) + '">Save Handoff PDF</button>'
      + '<button class="btn btn-ghost" id="ac-handoff-email" data-shift-id="' + esc(s.id) + '">Email Handoff</button>'
      + '<button class="btn btn-ghost" id="ac-start">Start Another Shift</button>'
      + '<button class="btn btn-ghost" id="ac-history">View Shift History</button>'
      + '</div></div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#ac-start')) this.renderStart();
      else if (ev.target.closest('#ac-history')) App.navigate('sc-shift-history');
      else if (ev.target.closest('#ac-handoff-email')) {
        if (S.ShiftHandoff && S.ShiftHandoff.emailForShift) S.ShiftHandoff.emailForShift(s.id);
      }
      else if (ev.target.closest('#ac-handoff')) {
        if (S.ShiftHandoff && S.ShiftHandoff.openForShift) S.ShiftHandoff.openForShift(s.id);
        else App.navigate('sc-shift-history');
      }
    };
  }
};
