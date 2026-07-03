'use strict';

/* ── Cash Recovery — Close The Week (landing screen) ─────────────────────────
   Same model as the Control weekly closes (Inventory / Labor / Shift): a recovery
   scoreboard up top, then "CLOSE OUT YOUR WEEK" with a week-stepper and the
   week's cash steps top to bottom. The one difference Kyle called for is the
   Recovery Scoreboard hero (the trapped-cash money number); everything below it
   is the end-of-week cash routine, done quickly in the weekly sit-down. The four
   steps: free up cash in inventory (trapped stock then order to par), stay ahead
   of the week, pay on terms, then run the Cash audit to score it. Quick reads land inline; the deep work
   launches into the screen that already does it (Dynamic Pars, the Order Sheet,
   Books). Every number is computed from real data by CashEngine. */

S.CashDashboard = {
  _weekStart: null,
  _openStep: null,
  _flash: null,
  _st: null,

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Cash. Cash is the third lever Bar Cop watches: Profit is your margin, Revenue is your top line, Cash is your liquidity, the money actually in the account. Plenty of bars look fine on paper and still run tight, and this is where you catch it.'] },
      { h: 'Where You Stand', p: ['Up top is your trapped cash: working capital sitting on the shelf in dead stock and overstock instead of in your account. As you free it up, the number comes down and Cash Freed tracks what you put back. It reads off your counts, so it sharpens as you count.', 'Under it is the survival read, will you make it to next quarter: your runway, the tightest week ahead, and what is actually safe to spend, projected thirteen weeks out. Set your opening balance in Cash Position to make the runway real, and if you keep a line of credit, enter it on the Cash Forecast and the runway counts it as your backstop.'] },
      { h: 'The Steps', p: ['You work your cash where it is stuck, then score the week last, the same shape as Profit and Revenue. 1. Free up cash in inventory: run down the dead stock and overstock, then order to par so cash stops piling up on the shelf. 2. Stay ahead of the week: look at what is going out (bills, buys, labor) against what is coming in, and catch a tight day before it bites. 3. Pay on terms: hold cash to the vendor due date and take any early-pay discount. 4. Run the Cash audit: score the week and update your Cash Fix with where to work next.'] },
      { h: 'Working A Step', p: ['Open a step to read the numbers, then launch into the screen that does the work and come back. Mark a step done and the bar advances; mark it not done to reopen it. The week selector steps you back to close out a prior week. None of this is daily, it is the weekly sit-down.'] }
    ]);
  },

  // ── Week (Monday-based) ──────────────────────────────────────────────────────
  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  fmtWk(ws) { const d = new Date(ws + 'T00:00:00'); return isNaN(d.getTime()) ? ws : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  runwayLabel(r) { return r == null ? '13+ wks' : r === 0 ? 'This week' : r + ' wk' + (r === 1 ? '' : 's'); },
  todayMonday()   { return this.mondayOf(new Date()); },
  weekStart()     { return this._weekStart || this.todayMonday(); },
  weekEnd()       { return this.addDays(this.weekStart(), 6); },
  atCurrentWeek() { return this.weekStart() >= this.todayMonday(); },
  _stepWeek(n) {
    const next = this.addDays(this.weekStart(), n);
    if (n > 0 && next > this.todayMonday()) return;
    this._weekStart = next;
    this._openStep = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ─────
  _doneKey() { return 'cash_cockpit_done_' + this.weekStart(); },
  doneMap()  { try { return JSON.parse(localStorage.getItem(this._doneKey()) || '{}'); } catch (e) { return {}; } },
  setDone(step, val) { const m = this.doneMap(); m[step] = val; try { localStorage.setItem(this._doneKey(), JSON.stringify(m)); } catch (e) {} },

  ORDER: ['trapped', 'week', 'terms', 'audit'],
  _META: {
    trapped: { n: 1, title: 'Free up cash in inventory', sub: 'Run down trapped stock, then order to par' },
    week:    { n: 2, title: 'Stay ahead of the week',    sub: 'What is going out versus coming in' },
    terms:   { n: 3, title: 'Pay on terms',             sub: 'Hold cash to the vendor due date' },
    audit:   { n: 4, title: 'Run the Cash audit',       sub: 'Score the week and update your Cash Fix' }
  },
  // Cash steps are reviewed and acted on, then marked. Nothing auto-completes
  // off data (you cannot infer "I ran down the dead stock" from a number), so
  // every step waits on an operator stamp. Honest by default.
  stepDone() {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
    // The audit step completes off data: a Cash audit runs once a week, so if one
    // was run within the week being viewed, this step is done. The operator can
    // still mark it by hand. Every other step waits on a manual stamp.
    if (!r.audit) {
      const ws = this.weekStart(), we = this.weekEnd();
      const ran = (App.data.cash_audits || []).some(a => { const d = ('' + ((a && a.date) || '')).slice(0, 10); return d && d >= ws && d <= we; });
      if (ran) r.audit = true;
    }
    return r;
  },

  // Compact step summary for the Hub Cash card; mirrors this page for the
  // current week (save/restore the selected week so the live page is untouched).
  hubSteps() {
    const sv = this._weekStart; this._weekStart = this.todayMonday();
    try {
      const done = this.stepDone();
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      return { steps, doneCount: steps.filter(s => s.done).length, total: steps.length };
    } finally { this._weekStart = sv; }
  },

  // ── Heavy compute, once per render ───────────────────────────────────────────
  computeState() {
    const ws = this.weekStart(), we = this.weekEnd();
    const trapped = CashEngine.trapped();
    const over = CashEngine.overOrder(3);
    const reorder = CashEngine.reorderToPar();
    const billsWeek = CashEngine.billsDue(ws, we);
    const freed = CashEngine.freed();
    const termVendors = CashEngine.termVendors();
    const outThisWeek = billsWeek.total + reorder.total;
    // The deep treasury reads: the 13-week survival curve, what is truly safe to
    // spend, and how long the cash stays locked in the operating cycle.
    const survival = CashEngine.survivalForecast(13);
    const position = CashEngine.position();
    const cycle = CashEngine.cashCycle();
    return { trapped, over, reorder, billsWeek, freed, termVendors, outThisWeek, survival, position, cycle };
  },

  // ── Render ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';

    const st = this._st = this.computeState();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;

    // A PAST week renders as a closed-out summary, not the live action steps. The
    // trapped cash, runway, and safe-to-spend are current-state reads with no
    // per-week history, so re-showing them under a past week would be misleading.
    // The current week is the live close; a past week shows what you closed out.
    if (!this.atCurrentWeek()) {
      container.innerHTML = '<div class="screen">'
        + this.banner(doneCount, this.ORDER.length)
        + this.pastWeekCard(done)
        + '</div>';
      this.wire();
      return;
    }

    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';
    const flash = this._flash; this._flash = null;

    const gs = this.getStartedDone();
    container.innerHTML = '<div class="screen">'
      + (gs.all ? this.scoreboard(st) : this.getStartedBox(gs))
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.asNeeded()
      + '</div>';
    this.wire();
  },

  // Closed-out summary for a past week: the four steps as a read-only checklist
  // (still toggleable, so you can close out a week you missed), no live numbers.
  pastWeekCard(done) {
    const rows = this.ORDER.map((k, idx) => {
      const m = this._META[k], isDone = done[k];
      const bb = idx === this.ORDER.length - 1 ? '' : 'border-bottom:1px solid var(--b2);';
      const circle = isDone
        ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
        : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;">' + m.n + '</span>';
      const toggle = isDone
        ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
        : '<button class="btn btn-primary btn-sm" data-done="' + k + '">Mark Done</button>';
      return '<div style="display:flex;align-items:center;gap:13px;padding:14px 16px;' + bb + '">'
        + circle
        + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
        +   '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (isDone ? 'Closed out' : 'Not done') + '</div></div>'
        + toggle + '</div>';
    }).join('');
    return '<div class="card" style="padding:0;overflow:hidden;">' + rows + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:12px;line-height:1.6;">'
      +   'This is your close for the week of ' + this.fmtWk(this.weekStart()) + ' to ' + this.fmtWk(this.weekEnd()) + '. '
      +   'Your live trapped cash, runway, and safe-to-spend are on <strong>This Week</strong>.</div>';
  },

  // ── Day-one Get Started strip ────────────────────────────────────────────────
  // With no data, this replaces Where You Stand (same DashUI strip Profit and
  // Revenue use). Each step reads done off real data; once all four are done the
  // Where You Stand card takes its place. The weekly steps below never change.
  getStartedDone() {
    const hasOpening = !!(window.CashEngine && CashEngine.position && CashEngine.position().hasOpening);
    const hasInv   = ((App.inventoryData && App.inventoryData.ic_products) || []).length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;
    return { hasOpening, hasInv, hasShift, hasLabor, all: hasOpening && hasInv && hasShift && hasLabor };
  },
  getStartedBox(d) {
    return DashUI.dayOneStrip(
      'Four steps to getting started in Cash Recovery.',
      [
        { done: d.hasOpening, num: 1, label: 'Set your Cash Position', go: 'c-position' },
        { done: d.hasInv,   num: 2, label: 'Set up Inventory Control', go: 'ic-dashboard', cross: true },
        { done: d.hasShift, num: 3, label: 'Set up Shift Control', go: 'sc-dashboard', cross: true },
        { done: d.hasLabor, num: 4, label: 'Set up Labor Control', go: 'lc-dashboard', cross: true }
      ]);
  },

  // ── Recovery Scoreboard (the cash money hero) ────────────────────────────────
  scoreboard(st) {
    const t = st.trapped, f = st.freed;
    let heroBody;
    if (!t.hasData) {
      heroBody = '<div style="font-size:13px;color:var(--t2);line-height:1.6;padding:2px 0;">Take a couple of inventory counts and Bar Cop starts reading the cash trapped on your shelves, dead stock and overstock you can turn back into money.</div>';
    } else if (t.total <= 0) {
      heroBody = '<div style="padding:2px 0;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--t1);">All clear</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">No dead stock or overstock worth chasing right now. Your shelf cash is working.</div></div>';
    } else {
      heroBody = '<div style="padding:2px 0;">'
        + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
        +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--gold);">' + App.fmtCurrency(t.total, 0) + '</span>'
        +   '<span style="font-size:13px;color:var(--t2);">trapped on your shelves</span>'
        + '</div></div>';
    }
    const freedLine = f.building
      ? '<span style="color:var(--t3);">Cash Freed builds here as you count, the drop in trapped cash from your first weeks.</span>'
      : '<span><span style="color:var(--green);font-weight:700;">' + App.fmtCurrency(f.dollars, 0) + '</span> in cash freed so far, trapped cash down from your first weeks.</span>';
    const showIns = t.hasData || (st.survival && st.survival.hasData);
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title"' + (showIns ? ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;"' : '') + '><span>Where You Stand</span>'
      +   (showIns ? '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>' : '')
      + '</div>'
      + heroBody
      + '<div style="font-size:12px;color:var(--t3);margin-top:10px;padding-bottom:2px;">' + freedLine + '</div>'
      + this.survivalStrip(st)
      + '</div>';
  },

  // ── Survival read (the deep treasury headline) ───────────────────────────────
  // The trapped-cash hero above answers "what is stuck on my shelf"; this answers
  // "am I going to make it to next quarter." Runway, the tightest week, and what
  // is truly safe to spend, off the 13-week forecast. Color is meaning only.
  survivalStrip(st) {
    const sf = st.survival, pos = st.position;
    const wrap = inner => '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Will You Make It To Next Quarter?</div>'
      + inner + '</div>';
    if (!sf || !sf.hasData) {
      return wrap('<div style="font-size:12px;color:var(--t3);line-height:1.6;">Add your sales, schedule, and bills and Bar Cop projects your cash thirteen weeks out, with your runway and the week that runs thin.</div>');
    }
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    if (!sf.hasOpening) {
      const tw = sf.tightWeeks;
      return wrap('<div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;">'
        + mini('Tight Weeks Ahead', tw + ' of 13', tw > 0 ? 'var(--amber)' : 'var(--green)')
        + '<div style="flex:2;min-width:190px;font-size:12px;color:var(--t3);line-height:1.6;">'
        +   (tw > 0 ? tw + ' week' + (tw === 1 ? '' : 's') + ' have more cash going out than coming in. ' : 'Your cash timing looks clear. ')
        +   'Set your opening balance to see your real runway and the week you would run thin.</div>'
        + '</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="c-position">Set Opening Balance</button></div>');
    }
    const low = sf.lowPoint;
    const credit = sf.credit || 0;
    const runwayCol = sf.runway != null ? 'var(--red)' : 'var(--green)';
    const lowCol = (low && low.balance < -credit) ? 'var(--red)'
      : (low && low.balance < 0) ? 'var(--amber)'
      : (low && pos.reserve > 0 && low.balance < pos.reserve ? 'var(--amber)' : 'var(--t1)');
    const safeCol = (pos.safe != null && pos.safe < 0) ? 'var(--red)' : 'var(--t1)';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    return wrap('<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      + mini('Runway', this.runwayLabel(sf.runway), runwayCol)
      + vdiv
      + mini('Tightest Week', low ? this.fmtWk(low.ws) + ' &middot; ' + App.fmtCurrency(low.balance, 0) : '-', lowCol)
      + vdiv
      + mini('Safe to Spend', pos.hasOpening ? App.fmtCurrency(pos.safe, 0) : '-', safeCol)
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="c-forecast">Cash Forecast</button></div>');
  },

  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm c-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm c-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm c-wk-now" style="margin-left:4px;">This Week</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>';
  },

  banner(doneCount, total) {
    const allDone = doneCount === total;
    const pct = Math.round(doneCount / total * 100);
    const doneLine = allDone
      ? '<span style="color:var(--green);font-weight:700;">&#10003; You\'re current this week</span>'
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + doneCount + '</span> of ' + total + ' done this week</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div style="padding:11px 22px;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Close Out Your Week</div>'
      + '</div>'
      + '<div style="padding:18px 22px;">'
      +   this.weekSelector()
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +     '<div style="flex:1;min-width:160px;height:6px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      +     '<div style="font-size:12px;">' + doneLine + '</div>'
      +   '</div>'
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">A quick weekly pass: free what is trapped, right-size the order, and check the week ahead.</div>')
      + '</div>'
      + '</div>';
  },

  stepStatus(k) {
    const st = this._st;
    if (k === 'audit') {
      const ca = App.latestEvent ? App.latestEvent(App.data.cash_audits || []) : null;
      if (ca && ca.overall_score != null) {
        const ds = ca.date ? Math.floor((Date.now() - new Date(ca.date + 'T00:00:00').getTime()) / 86400000) : null;
        return 'Last scored ' + ca.overall_score + (ds != null ? (ds <= 0 ? ', today' : ', ' + ds + 'd ago') : '');
      }
      return this._META.audit.sub;
    }
    if (k === 'trapped') {
      const t = st.trapped, o = st.over;
      if (!t.hasData && (!o || !o.hasData)) return this._META.trapped.sub;
      const parts = [];
      if (t.hasData && t.total > 0) parts.push(App.fmtCurrency(t.total, 0) + ' to free up');
      if (o && o.hasData && o.weeksOnHand != null) parts.push(o.weeksOnHand.toFixed(1) + ' weeks on hand' + (o.excess > 0 ? ', ' + App.fmtCurrency(o.excess, 0) + ' over' : ''));
      return parts.length ? parts.join(' · ') : 'Inventory cash is moving';
    }
    if (k === 'week') {
      const sf = st.survival;
      if (sf && sf.hasOpening && sf.runway != null) return 'Cash runs ' + this.runwayLabel(sf.runway);
      if (sf && sf.tightWeeks > 0) return sf.tightWeeks + ' tight week' + (sf.tightWeeks === 1 ? '' : 's') + ' in the next 13';
      if (sf && sf.hasData) return 'No tight weeks in the next 13';
      return this._META.week.sub;
    }
    if (k === 'terms') return st.termVendors.length ? st.termVendors.length + ' vendor' + (st.termVendors.length === 1 ? '' : 's') + ' on terms' : this._META.terms.sub;
    return '';
  },

  stepRow(k, done) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="c-step-head" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k) + '</div></div>'
      +   '<span style="color:var(--t3);font-size:13px;flex-shrink:0;">' + (isOpen ? '&#9652;' : '&#9662;') + '</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k, isDone) + '</div>';
    return html + '</div>';
  },

  markBtn(k, label) {
    return this._isDone
      ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
      : '<button class="btn btn-primary btn-sm" data-done="' + k + '">' + label + '</button>';
  },
  workspace(k, isDone) {
    this._isDone = isDone;
    const st = this._st;
    const explain = txt => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const btnRow = inner => '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' + inner + '</div>';
    const itemLine = (label, right) =>
      '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
      + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(label) + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;">' + right + '</div></div>';

    if (k === 'audit') {
      const ca = App.latestEvent ? App.latestEvent(App.data.cash_audits || []) : null;
      const lead = ca && ca.overall_score != null
        ? 'Close the week by scoring it. Your last Cash audit scored <strong style="color:' + App.scoreColor(ca.overall_score) + ';">' + ca.overall_score + '</strong>. Run a fresh one to score this week and refresh your Cash Fix with where to work next.'
        : 'Close the week by scoring your liquidity. Run your Cash audit and it updates your Cash Fix with where to work next week.';
      return explain(lead)
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-audit">Cash Audit</button><button class="btn btn-ghost btn-sm" data-go="c-fix">Cash Fix</button>' + this.markBtn('audit', 'Mark Done'));
    }

    if (k === 'trapped') {
      const t = st.trapped, o = st.over;
      if (!t.hasData && (!o || !o.hasData)) {
        return explain('Bar Cop reads the cash tied up in inventory off your counts. Take a couple of weekly counts and your dead stock, overstock, and weeks on hand show up here with the dollars you can free.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-take-inventory">Take Inventory</button>' + this.markBtn('trapped', 'Mark Done'));
      }
      // Part one: trapped stock (dead + over par) to run down.
      let body = '';
      if (t.hasData && t.total > 0) {
        const rows = t.items.slice(0, 4).map(it => itemLine(
          it.name + (it.kind === 'dead' ? ' (not moving)' : ' (over par)'),
          App.fmtCurrency(it.free, 0))).join('');
        body += explain('You have <strong style="color:var(--gold);">' + App.fmtCurrency(t.total, 0) + '</strong> trapped: ' + App.fmtCurrency(t.dead, 0) + ' in dead stock and ' + App.fmtCurrency(t.overPar, 0) + ' sitting above par. Run the dogs down, feature them, or cut the par so you stop reordering them.') + rows;
      } else if (t.hasData) {
        body += explain('Nothing dead and nothing piled up above par worth chasing. Your shelf cash is moving.');
      }
      // Part two: order to par, so you stop buying ahead of your use.
      if (o && o.hasData) {
        const w = o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) : '-';
        const orderLead = o.excess > 0
          ? 'You are holding <strong style="color:var(--gold);">' + w + ' weeks</strong> of inventory against a ' + o.targetWeeks + '-week target, ' + App.fmtCurrency(o.excess, 0) + ' beyond what you use. Order to par this week, not to a number that feels safe.'
          : 'You are holding ' + w + ' weeks of inventory, right in line with a ' + o.targetWeeks + '-week target. Keep ordering to par.';
        const reorderLine = st.reorder.count > 0
          ? '<div style="font-size:12px;color:var(--t2);margin-top:6px;">Bringing everything to par this week runs <strong>' + App.fmtCurrency(st.reorder.total, 0) + '</strong> across ' + st.reorder.count + ' item' + (st.reorder.count === 1 ? '' : 's') + '.</div>'
          : '';
        body += (body ? '<div style="height:1px;background:var(--b2);margin:14px 0;"></div>' : '') + explain(orderLead) + reorderLine;
      }
      return body
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-trapped">Trapped Cash</button><button class="btn btn-ghost btn-sm" data-go="c-purchasing">Purchasing</button><button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Order Sheet</button>' + this.markBtn('trapped', 'Mark Done'));
    }

    if (k === 'week') {
      const sf = st.survival;
      if (!sf || !sf.hasData) {
        return explain('Bar Cop projects your cash thirteen weeks out off your sales, schedule, and bills. As that data lands, this is where you catch a week where more cash goes out than comes in.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-forecast">Cash Forecast</button>' + this.markBtn('week', 'Mark Done'));
      }
      if (!sf.hasOpening) {
        const tw = sf.tightWeeks;
        return explain((tw > 0 ? '<strong style="color:var(--gold);">' + tw + ' of the next thirteen weeks</strong> have more cash going out than coming in. ' : 'No tight weeks in the next thirteen on flow. ')
            + 'Set your opening cash balance and Bar Cop turns this into a real runway and the exact week you would run thin.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-position">Set Opening Balance</button><button class="btn btn-ghost btn-sm" data-go="c-forecast">Cash Forecast</button>' + this.markBtn('week', 'Mark Done'));
      }
      const low = sf.lowPoint;
      const lead = sf.runway != null
        ? 'Your cash runs about <strong style="color:var(--gold);">' + this.runwayLabel(sf.runway) + '</strong> before it would go negative' + (low ? ', bottoming out the week of ' + this.fmtWk(low.ws) + ' at ' + App.fmtCurrency(low.balance, 0) : '') + '. Free trapped cash, hold payments to their due dates, and move a big buy off that week.'
        : 'Your cash holds all thirteen weeks' + (low ? ', with the low point the week of ' + this.fmtWk(low.ws) + ' at ' + App.fmtCurrency(low.balance, 0) : '') + '. ' + (sf.tightWeeks > 0 ? sf.tightWeeks + ' week' + (sf.tightWeeks === 1 ? '' : 's') + ' run tight on flow, catch them before they land.' : 'No tight weeks ahead.');
      const outLine = st.outThisWeek > 0
        ? '<div style="font-size:12px;color:var(--t2);margin-top:8px;">This week, about ' + App.fmtCurrency(st.outThisWeek, 0) + ' goes out in bills and buys.</div>'
        : '';
      return explain(lead) + outLine
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-forecast">Cash Forecast</button><button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button>' + this.markBtn('week', 'Mark Done'));
    }

    // terms
    const tv = st.termVendors;
    if (!tv.length) {
      return explain('Set payment terms on your vendors (net 7, 15, 30) and Bar Cop flags anything you are paying faster than you have to. Holding cash to the due date keeps more of it in your account longer.')
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-vendors">Set Vendor Terms</button>' + this.markBtn('terms', 'Mark Done'));
    }
    const rows = tv.slice(0, 4).map(v => itemLine(v.name, 'Net ' + v.netDays)).join('');
    const billLine = st.billsWeek.total > 0
      ? '<div style="font-size:12px;color:var(--t2);margin-top:8px;">' + App.fmtCurrency(st.billsWeek.total, 0) + ' in bills are due this week. Pay them on the due date, not early, unless there is a discount worth taking.</div>'
      : '';
    return explain('You have ' + tv.length + ' vendor' + (tv.length === 1 ? '' : 's') + ' on real terms. Hold your cash to the due date and take any early-pay discount that beats what the cash is worth sitting in the account.')
      + rows + billLine
      + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-vendors">Vendor Terms</button>' + this.markBtn('terms', 'Mark Done'));
  },

  // ── Status strip (the treasury vitals) ───────────────────────────────────────
  // The three numbers an operator lives by: what is truly free to spend, how long
  // the cash lasts, and how many days it stays locked in the cycle. Trapped cash
  // already headlines the scoreboard above, so it is not repeated here.
  // ── As needed: the deeper reads an operator opens when they want them, not
  //    part of the weekly close. Capital Efficiency (turns and weeks on hand) and
  //    the Cash Bridge (where the profit went) live here, off the main flow. ────
  asNeeded() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="c-capital">Capital Efficiency</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="c-bridge">Cash Bridge</button>'
      + '</div>';
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.c-step-head');
      if (head) { const k = head.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container, this.actions); return; }
      const dn = ev.target.closest('[data-done]');
      if (dn) { this.setDone(dn.dataset.done, true); this._openStep = null; this.render(this.container, this.actions); return; }
      const un = ev.target.closest('[data-undone]');
      if (un) { this.setDone(un.dataset.undone, false); this._openStep = un.dataset.undone; this.render(this.container, this.actions); return; }
      if (ev.target.closest('[data-bills]')) { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.open) S.HubOperatingExpenses.open(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      if (ev.target.closest('.c-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.c-wk-next')) { this._stepWeek(7); return; }
      if (ev.target.closest('[data-insights]')) { this.showInsights(); return; }
      if (ev.target.closest('.c-wk-now'))  { this._weekStart = null; this._openStep = null; this.render(this.container, this.actions); return; }
    };
  },

  // ── Bar Cop Briefing: a written read of the cash picture, same button Profit
  //    and Revenue carry. Cached once a week per section (DashUI helpers) so
  //    repeat opens do not spend on the API. ──────────────────────────────────
  // Code-generated (no API): survival read, where cash is stuck, the one move.
  showInsights() {
    const st = this._st || this.computeState();
    const sf = st.survival, t = st.trapped;
    if (!(sf && sf.hasData) && !(t && t.hasData)) {
      DashUI.insightsModal('Bar Cop Briefing', 'Take a couple of counts and add your sales, schedule, and bills, and Bar Cop can read your cash for you.');
      return;
    }
    DashUI.insightsModal('Bar Cop Briefing', this._insBriefing(st));
  },

  _insBriefing(st) {
    const m = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const sf = st.survival || {}, pos = st.position || {}, cyc = st.cycle || {}, t = st.trapped || {};
    const totalVendors = (window.CashEngine && CashEngine.vendors) ? CashEngine.vendors().length : 0;
    const onTerms = (st.termVendors || []).length;
    const paras = [];

    // 1 — the survival read
    if (sf.hasOpening) {
      let p1 = sf.runway == null ? 'Your cash holds all thirteen weeks ahead.'
             : sf.runway === 0 ? 'Your cash runs out this week. This is the fire.'
             : 'Your cash runs about ' + sf.runway + ' week' + (sf.runway === 1 ? '' : 's') + ' before it would go negative.';
      if (sf.lowPoint) p1 += ' The tightest week is ' + this.fmtWk(sf.lowPoint.ws) + ' at ' + m(sf.lowPoint.balance) + '.';
      if (sf.tightWeeks > 0) p1 += ' ' + sf.tightWeeks + ' of the next thirteen run tight, more going out than coming in.';
      if (pos.hasOpening && pos.safe != null) p1 += ' Safe to spend right now is ' + m(pos.safe) + (pos.safe < 0 ? ', which means you are into money already spoken for.' : '.');
      paras.push(p1);
    } else {
      let p1 = 'Set your opening cash balance in Cash Position and this becomes a real runway instead of just timing.';
      if (sf.tightWeeks > 0) p1 = sf.tightWeeks + ' of the next thirteen weeks run more cash out than in. ' + p1;
      paras.push(p1);
    }

    // 2 — where the cash is stuck
    let p2 = '';
    if (t.hasData && t.total > 0) p2 = m(t.total) + ' of shelf cash is stuck, ' + m(t.dead) + ' in dead stock and ' + m(t.overPar) + ' above par. ';
    else if (t.hasData) p2 = 'Almost nothing is trapped on the shelf, your inventory is working. ';
    if (cyc.hasData) p2 += 'Your cash is locked about ' + Math.round(cyc.cycle) + ' days: product sits ' + Math.round(cyc.dio) + ' and you take ' + Math.round(cyc.dpo) + ' to pay.';
    if (p2.trim()) paras.push(p2.trim());

    // 3 — the single move that matters most
    let move;
    if (sf.hasOpening && sf.runway != null && sf.runway <= 4) move = 'Buy runway this week. Move a payment to its due date and hold any order you can before the tight week lands.';
    else if (t.hasData && t.total > 2000) move = 'The fastest cash is on your own shelf. Run the dead stock down and order to par in Trapped Cash.';
    else if (totalVendors && onTerms < totalVendors) move = 'Put the ' + (totalVendors - onTerms) + ' vendor' + ((totalVendors - onTerms) === 1 ? '' : 's') + ' without terms on terms, so you stop financing them early.';
    else move = 'Nothing on fire. Keep ordering to par and paying on the due date, not before.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  }
};
