'use strict';

/* ── Shift Control — Weekly Cockpit (landing screen) ──────────────────────────
   Not a stack of status cards. A guided weekly close-out: a progress banner, a
   step flow you work top to bottom (the current step expands as a live
   workspace, done steps collapse to a check), and a compact status strip + the
   as-needed outliers at the bottom. The keystone step (Import this week's sales
   & voids) runs INLINE here via PosIngest. This is the prototype for the
   weekly-cockpit pattern that rolls to the other section dashboards. */

S.ShiftDashboard = {
  _weekEnd: null,    // Sunday of the selected week
  _openStep: null,   // which step is expanded ('' = all collapsed; null = auto-open first undone)
  _flash: null,      // one-shot confirmation line under the banner

  showHowTo() {
    App.showHelpModal('How the Shift Cockpit Works', [
      { p: ['This is your weekly close-out for Shift. You land on the week, see how far along you are, and work the steps top to bottom. The current step opens right here as a workspace, so you do the quick things without leaving the page. When the week is done it reads "You\'re current this week."'] },
      { h: 'The Steps', p: ['1. Import this week\'s sales and voids: drop your weekly POS export (one row per day) and Bar Cop reads the whole week at once. 2. Reconcile cash: optional, since your POS handles the blind close; do it here only if you want to. 3. Log exceptions: waste, spills, and walked tabs, off your sheet. 4. Review loss flags: cash shorts, voids, and comps worth a look.'] },
      { h: 'Working A Step', p: ['Click a step to open it. The import runs right in the cockpit. The others either do the quick part here or send you to the full screen and come back. Mark a step done and the bar advances. The week selector at the top steps you to a prior week to close it out.'] },
      { h: 'The Bottom Strip', p: ['Once the week is in, the strip shows your revenue, voids, and cash over/short at a glance. Below it, the as-needed jobs (Spot Check, Maintenance, Checklists) are one tap away whenever you need them, not part of the weekly flow.'] }
    ]);
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  shifts()     { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  voidComps()  { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  walkedTabs() { return ((App.shiftData && App.shiftData.sc_walked_tabs) || []); },
  waste()      { return ((App.shiftData && App.shiftData.sc_waste) || []); },
  maint()      { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },

  // ── Week math ───────────────────────────────────────────────────────────────
  weekEnd()   { return this._weekEnd || (App.nextSunday ? App.nextSunday() : App.todayLocal()); },
  weekStart() { return App.weekStartFor(this.weekEnd()); },
  inWeek(d)   { const s = this.weekStart(), e = this.weekEnd(); d = String(d || '').slice(0, 10); return !!d && d >= s && d <= e; },
  _stepWeek(n) {
    const d = new Date(this.weekEnd() + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + n);
    this._weekEnd = App.ymdLocal(d);
    this._openStep = null; this._flash = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ────
  _doneKey() { return 'sc_cockpit_done_' + this.weekEnd(); },
  doneMap()  { try { return JSON.parse(localStorage.getItem(this._doneKey()) || '{}'); } catch (e) { return {}; } },
  setDone(step, val) { const m = this.doneMap(); m[step] = val; try { localStorage.setItem(this._doneKey(), JSON.stringify(m)); } catch (e) {} },

  stepDone() {
    const dm = this.doneMap();
    return {
      import: this.shifts().some(s => this.inWeek(s.date)),
      cash:   !!dm.cash || this.variances().some(v => this.inWeek(v.date)),
      exc:    !!dm.exc,
      review: !!dm.review
    };
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  ORDER: ['import', 'cash', 'exc', 'review'],
  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (!this._weekEnd) this._weekEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';
    const flash = this._flash; this._flash = null;

    container.innerHTML = '<div class="screen" style="max-width:900px;">'
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.statusStrip()
      + this.outlierStrip()
      + '</div>';

    if (this._openStep === 'import') this.mountImport();
    this.wire();
  },

  banner(doneCount, total) {
    const range = App.dateRangeLabel ? App.dateRangeLabel(this.weekStart(), this.weekEnd()) : (this.weekStart() + ' - ' + this.weekEnd());
    const allDone = doneCount === total;
    const pct = Math.round(doneCount / total * 100);
    const right = allDone
      ? '<div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--green);font-weight:800;font-size:16px;">&#10003;</span><span style="font-size:13px;color:var(--green);font-weight:700;">You\'re current this week</span></div>'
      : '<div style="font-size:12px;color:var(--t2);"><span style="color:var(--t1);font-weight:800;font-size:16px;">' + doneCount + '</span> of ' + total + ' done this week</div>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:12px;padding:18px 22px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      +   '<div style="display:flex;align-items:center;gap:10px;">'
      +     '<button class="btn btn-ghost btn-sm sc-wk-prev" aria-label="Previous week" style="margin:0;">&lsaquo;</button>'
      +     '<div><div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Close Out Your Week</div>'
      +       '<div style="font-size:18px;font-weight:800;color:var(--t1);">Week of ' + esc(range) + '</div></div>'
      +     '<button class="btn btn-ghost btn-sm sc-wk-next" aria-label="Next week" style="margin:0;">&rsaquo;</button>'
      +   '</div>'
      +   right
      + '</div>'
      + '<div style="height:6px;background:var(--input);border-radius:4px;overflow:hidden;margin-top:14px;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      + '</div>';
  },

  _META: {
    import: { n: 1, title: 'Import this week\'s sales &amp; voids', sub: 'Drop your weekly POS export, one row per day' },
    cash:   { n: 2, title: 'Reconcile cash',                        sub: 'Optional. Your POS likely handles the close-out' },
    exc:    { n: 3, title: 'Log this week\'s exceptions',           sub: 'Waste, spills, walked tabs' },
    review: { n: 4, title: 'Review loss flags',                     sub: 'Cash shorts, voids, comps' }
  },
  stepStatus(k, isDone) {
    if (k === 'import') {
      const n = this.shifts().filter(s => this.inWeek(s.date)).length;
      return isDone ? (n + ' day' + (n === 1 ? '' : 's') + ' imported') : this._META.import.sub;
    }
    if (k === 'cash') return isDone ? 'Reconciled' : this._META.cash.sub;
    if (k === 'exc') {
      const v = this.voidComps().filter(r => this.inWeek(r.date)).length;
      const w = this.waste().filter(r => this.inWeek(r.date)).length;
      const t = this.walkedTabs().filter(r => this.inWeek(r.date)).length;
      const tot = v + w + t;
      return tot ? (tot + ' logged this week') : (isDone ? 'Nothing to log' : this._META.exc.sub);
    }
    if (k === 'review') return isDone ? 'Reviewed' : this._META.review.sub;
    return '';
  },
  stepRow(k, done) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;' + (isOpen ? 'background:var(--gold-tint-bord);color:var(--t1);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    const bord = isOpen ? 'var(--gold-tint-bord)' : 'var(--b-edge)';
    let html = '<div style="border:1px solid ' + bord + ';border-radius:10px;background:' + bg + ';overflow:hidden;">'
      + '<div class="sc-step-head" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, isDone) + '</div></div>'
      +   '<span style="color:var(--t3);font-size:13px;flex-shrink:0;">' + (isOpen ? '&#9652;' : '&#9662;') + '</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k) + '</div>';
    return html + '</div>';
  },

  workspace(k) {
    if (k === 'import') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">One file, the whole week. Pull a "sales by day" report from your POS for this week and drop it. Re-importing replaces the days already in.</div>'
        + '<div id="sc-ck-import"></div><div id="sc-ck-import-res"></div>';
    }
    if (k === 'cash') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Your POS counts the drawer and computes over/short at close, so you do not have to do it here. Reconcile in Bar Cop only if you want the variance pattern tracked, or just mark this done.</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-cash-control">Open Cash Control</button>'
        + '<button class="btn btn-primary btn-sm" data-done="cash">Mark Done</button></div>';
    }
    if (k === 'exc') {
      const cnt = (arr) => arr.filter(r => this.inWeek(r.date)).length;
      const v = cnt(this.voidComps()), w = cnt(this.waste()), t = cnt(this.walkedTabs());
      const tally = '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;">This week so far: '
        + '<strong style="color:var(--t1);">' + v + '</strong> voids/comps, <strong style="color:var(--t1);">' + w + '</strong> waste, <strong style="color:var(--t1);">' + t + '</strong> walked tabs.</div>';
      return tally
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-void-comp">Voids / Comps</button>'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-waste">Waste / Spills</button>'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-walked-tabs">Walked Tabs</button>'
        + '<button class="btn btn-primary btn-sm" data-done="exc">Mark Reviewed</button></div>';
    }
    // review
    const wkVar = this.variances().filter(v => this.inWeek(v.date));
    const shorts = wkVar.filter(v => v.status === 'Short').length;
    const oot = wkVar.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const wkVC = this.voidComps().filter(r => this.inWeek(r.date));
    const voidTot = wkVC.filter(r => r.type === 'Void').reduce((s, r) => s + (r.amount || 0), 0);
    const compTot = wkVC.filter(r => r.type === 'Comp').reduce((s, r) => s + (r.amount || 0), 0);
    const line = (label, val, warn) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12px;">'
      + '<span style="color:var(--t2);">' + label + '</span><span style="font-weight:700;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + '</span></div>';
    return line('Cash shorts this week', String(shorts), shorts > 0)
      + line('Drawers out of tolerance', String(oot), oot > 0)
      + line('Voids', App.fmtCurrency(voidTot), false)
      + line('Comps', App.fmtCurrency(compTot), false)
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="theft-risk">Open Loss Prevention</button>'
      + '<button class="btn btn-primary btn-sm" data-done="review">Mark Reviewed</button></div>';
  },

  statusStrip() {
    const wkS = this.shifts().filter(s => this.inWeek(s.date));
    const rev = wkS.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const wkVC = this.voidComps().filter(r => this.inWeek(r.date));
    const voidTot = wkVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
    const netVar = this.variances().filter(v => this.inWeek(v.date)).reduce((t, v) => t + (v.variance || 0), 0);
    const item = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    return '<div style="display:flex;gap:30px;align-items:center;flex-wrap:wrap;margin-top:22px;padding-top:16px;border-top:1px solid var(--b2);">'
      + item('This Week Revenue', App.fmtCurrency(rev))
      + item('Voids', App.fmtCurrency(voidTot))
      + item('Cash Over / Short', (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar), netVar < 0 ? 'warn' : '')
      + '</div>';
  },

  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-spot-check">Spot Check</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="sc-maintenance">Maintenance</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="sc-checklists">Checklists</button>'
      + '</div>';
  },

  // ── Inline sales import (step 1) ─────────────────────────────────────────────
  mountImport() {
    const el = document.getElementById('sc-ck-import');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your weekly POS sales export here',
      dropSub: 'Needs a Date column plus your sales (bar and/or food). Covers optional. One row per day.',
      fields: PosIngest.FIELDS.sales,
      confirmLabel: 'Import',
      onComplete: rows => this.importSales(rows)
    });
  },
  async importSales(rows) {
    const { toAdd, dupCount } = PosIngest.build('sales', rows);
    const res = document.getElementById('sc-ck-import-res');
    if (!toAdd.length) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No days imported. Check that the file has a Date column and sales values.</div>';
      return;
    }
    const ok = await PosIngest.commit('sales', toAdd);
    if (!ok) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>';
      return;
    }
    this._flash = toAdd.length + ' day' + (toAdd.length === 1 ? '' : 's') + ' imported' + (dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '') + '.';
    this._openStep = 'cash';
    this.render(this.container, this.actions);
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.sc-step-head');
      if (head) { const k = head.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container, this.actions); return; }
      const dn = ev.target.closest('[data-done]');
      if (dn) { this.setDone(dn.dataset.done, true); this._openStep = null; this.render(this.container, this.actions); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      if (ev.target.closest('.sc-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.sc-wk-next')) { this._stepWeek(7); return; }
    };
  }
};
