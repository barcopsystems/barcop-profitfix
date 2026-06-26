'use strict';

/* ── Cash Recovery — Close The Week (landing screen) ─────────────────────────
   Same model as the Control weekly closes (Inventory / Labor / Shift): a recovery
   scoreboard up top, then "CLOSE OUT YOUR WEEK" with a week-stepper and the
   week's cash steps top to bottom. The one difference Kyle called for is the
   Recovery Scoreboard hero (the trapped-cash money number); everything below it
   is the end-of-week cash routine, done quickly in the weekly sit-down. The four
   steps are the four Cash Fix Systems: free trapped cash, order to par, stay
   ahead of the week, pay on terms. Quick reads land inline; the deep work
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
      { h: 'The Scoreboard', p: ['Up top is your trapped cash: working capital sitting on the shelf in dead stock and overstock instead of in your account. As you free it up, the number comes down and Cash Freed tracks what you put back. It reads off your counts, so it sharpens as you count.', 'Under it is the survival read, will you make it to next quarter: your runway, the tightest week ahead, and what is actually safe to spend, projected thirteen weeks out. Set your opening balance in Cash Position to make the runway real.'] },
      { h: 'The Steps', p: ['1. Free trapped cash: run down the dead stock and cut pars that are too high. 2. Order to par: buy what you use, not what you fear, so cash stops piling up on the shelf. 3. Stay ahead of the week: look at what is going out (bills, buys, labor) against what is coming in, and catch a tight day before it bites. 4. Pay on terms: hold cash to the vendor due date and take any early-pay discount.'] },
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

  ORDER: ['audit', 'trapped', 'order', 'week', 'terms'],
  _META: {
    audit:   { n: 1, title: 'Run the Cash audit',        sub: 'Score the week and update your Cash Fix' },
    trapped: { n: 2, title: 'Free up trapped cash',      sub: 'Dead stock and overstock to run down' },
    order:   { n: 3, title: 'Order to par, not to fear', sub: 'Buy what you use, not what you fear' },
    week:    { n: 4, title: 'Stay ahead of the week',    sub: 'What is going out versus coming in' },
    terms:   { n: 5, title: 'Pay on terms',              sub: 'Hold cash to the vendor due date' }
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

    container.innerHTML = '<div class="screen">'
      + this.scoreboard(st)
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

  // ── Recovery Scoreboard (the cash money hero) ────────────────────────────────
  scoreboard(st) {
    const t = st.trapped, f = st.freed;
    let heroBody;
    if (!t.hasData) {
      heroBody = '<div style="font-size:13px;color:var(--t2);line-height:1.6;padding:2px 0;">Take a couple of inventory counts and Bar Cop starts reading the cash trapped on your shelves, dead stock and overstock you can turn back into money.</div>';
    } else if (t.total <= 0) {
      heroBody = '<div style="padding:2px 0;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:600;line-height:1;color:var(--t1);">All clear</div>'
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
      + '<div class="card-title"' + (showIns ? ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;"' : '') + '><span>Cash Scoreboard</span>'
      +   (showIns ? '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>' : '')
      + '</div>'
      + heroBody
      + '<div style="font-size:12px;margin-top:10px;">' + freedLine + '</div>'
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
    const mini = (label, val, col) => '<div style="min-width:108px;">'
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
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="c-position">Set Opening Balance</button></div>');
    }
    const low = sf.lowPoint;
    const runwayCol = sf.runway != null ? 'var(--red)' : 'var(--green)';
    const lowCol = (low && low.balance < 0) ? 'var(--red)' : (low && pos.reserve > 0 && low.balance < pos.reserve ? 'var(--amber)' : 'var(--t1)');
    const safeCol = (pos.safe != null && pos.safe < 0) ? 'var(--red)' : 'var(--t1)';
    return wrap('<div style="display:flex;align-items:flex-start;gap:35px;flex-wrap:wrap;">'
      + mini('Runway', this.runwayLabel(sf.runway), runwayCol)
      + mini('Tightest Week', low ? this.fmtWk(low.ws) + ' &middot; ' + App.fmtCurrency(low.balance, 0) : '-', lowCol)
      + mini('Safe to Spend', pos.hasOpening ? App.fmtCurrency(pos.safe, 0) : '-', safeCol)
      + '</div>'
      + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="c-forecast">Cash Forecast</button></div>');
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
      if (!st.trapped.hasData) return this._META.trapped.sub;
      return st.trapped.total > 0 ? App.fmtCurrency(st.trapped.total, 0) + ' to free up' : 'Nothing trapped right now';
    }
    if (k === 'order') {
      if (!st.over.hasData) return this._META.order.sub;
      const w = st.over.weeksOnHand;
      return w != null ? w.toFixed(1) + ' weeks on hand' + (st.over.excess > 0 ? ', ' + App.fmtCurrency(st.over.excess, 0) + ' over' : '') : this._META.order.sub;
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
        ? 'Your last Cash audit scored <strong style="color:' + App.scoreColor(ca.overall_score) + ';">' + ca.overall_score + '</strong>. Run a fresh one to score this week, then open the Cash Fix and check off what you have already handled so the steps below read where you really are.'
        : 'Start the week here. The Cash audit scores your liquidity and feeds the fix steps. Run it, then open the Cash Fix and mark what you have handled.';
      return explain(lead)
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-audit">Cash Audit</button><button class="btn btn-ghost btn-sm" data-go="c-fix">Cash Fix</button>' + this.markBtn('audit', 'Mark Done'));
    }

    if (k === 'trapped') {
      const t = st.trapped;
      if (!t.hasData) {
        return explain('Bar Cop reads trapped cash off your counts. Take a couple of weekly counts and the dead stock and overstock show up here with the dollars you can free.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-take-inventory">Take Inventory</button>' + this.markBtn('trapped', 'Mark Done'));
      }
      if (t.total <= 0) {
        return explain('Nothing dead and nothing piled up above par worth chasing. Your shelf cash is moving.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-report-stock">Dead Stock</button>' + this.markBtn('trapped', 'Mark Done'));
      }
      const rows = t.items.slice(0, 4).map(it => itemLine(
        it.name + (it.kind === 'dead' ? ' (not moving)' : ' (over par)'),
        App.fmtCurrency(it.free, 0))).join('');
      return explain('You have <strong style="color:var(--gold);">' + App.fmtCurrency(t.total, 0) + '</strong> trapped: ' + App.fmtCurrency(t.dead, 0) + ' in dead stock and ' + App.fmtCurrency(t.overPar, 0) + ' sitting above par. Run the dogs down, feature them, or cut the par so you stop reordering them.')
        + rows
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-trapped">Trapped Cash</button><button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Cut Pars</button>' + this.markBtn('trapped', 'Mark Done'));
    }

    if (k === 'order') {
      const o = st.over;
      if (!o.hasData) {
        return explain('Once you have two counts, Bar Cop shows how many weeks of inventory you are sitting on and flags the cash tied up beyond what you actually use.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Order Sheet</button>' + this.markBtn('order', 'Mark Done'));
      }
      const w = o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) : '-';
      const lead = o.excess > 0
        ? 'You are holding <strong style="color:var(--gold);">' + w + ' weeks</strong> of inventory against a ' + o.targetWeeks + '-week target. That is ' + App.fmtCurrency(o.excess, 0) + ' tied up beyond what you use. Order to par this week, not to a number that feels safe.'
        : 'You are holding ' + w + ' weeks of inventory, right in line with a ' + o.targetWeeks + '-week target. Keep ordering to par.';
      const reorderLine = st.reorder.count > 0
        ? '<div style="font-size:12px;color:var(--t2);margin-top:6px;">Bringing everything to par this week runs <strong>' + App.fmtCurrency(st.reorder.total, 0) + '</strong> across ' + st.reorder.count + ' item' + (st.reorder.count === 1 ? '' : 's') + '.</div>'
        : '';
      return explain(lead) + reorderLine
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="c-purchasing">Purchasing</button><button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Order Sheet</button>' + this.markBtn('order', 'Mark Done'));
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
  showInsights() {
    if (App.demoBlock && App.demoBlock('Bar Cop Briefing')) return;
    const st = this._st || this.computeState();
    const sf = st.survival, t = st.trapped;
    if (!(sf && sf.hasData) && !(t && t.hasData)) {
      DashUI.insightsModal('Bar Cop Briefing', 'Take a couple of counts and add your sales, schedule, and bills, and Bar Cop can read your cash for you.');
      return;
    }
    const rec = DashUI._insRec('cash');
    if (rec && DashUI._insFresh(rec)) { DashUI.insightsModal('Bar Cop Briefing', rec.html, rec.generated_at); return; }
    const prompt = this._insPrompt(st);
    const btn = this.container.querySelector('[data-insights]');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...'; }
    const restore = label => { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label || orig || 'Bar Cop Briefing'; } };
    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { DashUI.insightsModal('Bar Cop Briefing', 'Could not read your cash right now: ' + esc(data.error.message || 'try again.')); restore('Try Again'); return; }
        const text = data.content && data.content[0] && data.content[0].text;
        if (!text) { DashUI.insightsModal('Bar Cop Briefing', 'No response came back. Try again.'); restore('Try Again'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        const html = '<p style="margin:0;">' + safe + '</p>';
        DashUI.insightsModal('Bar Cop Briefing', html, DashUI._insSave('cash', html));
        restore();
      })
      .catch(err => { DashUI.insightsModal('Bar Cop Briefing', 'Connection error: ' + esc(err.message) + '. Check your connection and try again.'); restore('Try Again'); });
  },

  _insPrompt(st) {
    const m = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const sf = st.survival || {}, pos = st.position || {}, cyc = st.cycle || {}, t = st.trapped || {}, f = st.freed || {};
    const totalVendors = (window.CashEngine && CashEngine.vendors) ? CashEngine.vendors().length : 0;
    const onTerms = (st.termVendors || []).length;
    const runway = sf.hasOpening ? (sf.runway == null ? 'holds all 13 weeks' : (sf.runway === 0 ? 'runs out this week' : sf.runway + ' weeks')) : 'not set (no opening balance)';
    const low = sf.hasOpening && sf.lowPoint ? (this.fmtWk(sf.lowPoint.ws) + ' at ' + m(sf.lowPoint.balance)) : 'n/a';
    const facts = [
      'Trapped cash on the shelf: ' + (t.hasData ? m(t.total) + ' (' + m(t.dead) + ' dead stock, ' + m(t.overPar) + ' above par)' : 'not counted yet'),
      'Cash freed so far (drop from your first weeks): ' + (f.building ? 'still building, not enough counts yet' : m(f.dollars)),
      'Runway: ' + runway,
      'Tightest week ahead: ' + low,
      'Tight weeks in the next 13 (more cash out than in): ' + (sf.tightWeeks != null ? sf.tightWeeks : 'n/a'),
      'Safe to spend right now: ' + (pos.hasOpening ? m(pos.safe) : 'n/a (opening balance not set)'),
      'Cash locked in the operating cycle: ' + (cyc.hasData ? Math.round(cyc.cycle) + ' days (product sits ' + Math.round(cyc.dio) + ' days, you take ' + Math.round(cyc.dpo) + ' days to pay)' : 'n/a'),
      'Vendors on payment terms: ' + onTerms + ' of ' + totalVendors,
      'Cash going out this week (bills plus reorder): ' + m(st.outThisWeek)
    ].join('\n');
    return 'You are a 30-year bar and restaurant operator writing a read for a fellow owner about the cash side of their bar this week. The facts below are computed from this operator\'s own data.\n\n'
      + 'Talk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing like "you already know what to do," nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless).\n\n'
      + 'STAY TRUE TO THE FACTS:\n'
      + '- Use only the facts below. Do not invent numbers or weeks.\n'
      + '- If a number is not set or not counted yet, say so plainly instead of guessing.\n\n'
      + 'FACTS:\n' + facts
      + '\n\nWrite two or three short paragraphs: first the survival read (runway and the tightest week, can they make the next quarter), then where the cash is stuck (trapped shelf cash and how long cash stays locked), then the single move that matters most this week. Use the exact numbers from the facts.';
  }
};
