'use strict';

/* ── Cash Recovery — Weekly Cockpit (landing screen) ─────────────────────────
   Same model as the Control cockpits (Inventory / Labor / Shift): a recovery
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
    App.showHelpModal('How the Cash Cockpit Works', [
      { p: ['This is your weekly close-out for Cash. Cash is the third lever Bar Cop watches: Profit is your margin, Revenue is your top line, Cash is your liquidity, the money actually in the account. Plenty of bars look fine on paper and still run tight, and this is where you catch it.'] },
      { h: 'The Scoreboard', p: ['Up top is your trapped cash: working capital sitting on the shelf in dead stock and overstock instead of in your account. As you free it up, the number comes down and Cash Freed tracks what you put back. It reads off your counts, so it sharpens as you count.'] },
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

  ORDER: ['trapped', 'order', 'week', 'terms'],
  _META: {
    trapped: { n: 1, title: 'Free up trapped cash',     sub: 'Dead stock and overstock to run down' },
    order:   { n: 2, title: 'Order to par, not to fear', sub: 'Buy what you use, not what you fear' },
    week:    { n: 3, title: 'Stay ahead of the week',    sub: 'What is going out versus coming in' },
    terms:   { n: 4, title: 'Pay on terms',              sub: 'Hold cash to the vendor due date' }
  },
  // Cash steps are reviewed and acted on, then marked. Nothing auto-completes
  // off data (you cannot infer "I ran down the dead stock" from a number), so
  // every step waits on an operator stamp. Honest by default.
  stepDone() {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
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
    return { trapped, over, reorder, billsWeek, freed, termVendors, outThisWeek };
  },

  // ── Render ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';

    const st = this._st = this.computeState();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';
    const flash = this._flash; this._flash = null;

    container.innerHTML = '<div class="screen">'
      + this.scoreboard(st)
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.statusStrip(st)
      + '</div>';
    this.wire();
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
        + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:7px;">'
        +   App.fmtCurrency(t.dead, 0) + ' in dead stock &middot; ' + App.fmtCurrency(t.overPar, 0) + ' sitting above par. Free it up in the steps below.'
        + '</div></div>';
    }
    const freedLine = f.building
      ? '<span style="color:var(--t3);">Cash Freed builds here once you log your first fix.</span>'
      : '<span><span style="color:var(--green);font-weight:700;">' + App.fmtCurrency(f.dollars, 0) + '</span> freed across ' + f.measured + ' fix' + (f.measured === 1 ? '' : 'es') + '</span>';
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Cash Scoreboard</div>'
      + heroBody
      + '<div style="font-size:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--b2);">' + freedLine + '</div>'
      + '</div>';
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
    if (k === 'trapped') {
      if (!st.trapped.hasData) return this._META.trapped.sub;
      return st.trapped.total > 0 ? App.fmtCurrency(st.trapped.total, 0) + ' to free up' : 'Nothing trapped right now';
    }
    if (k === 'order') {
      if (!st.over.hasData) return this._META.order.sub;
      const w = st.over.weeksOnHand;
      return w != null ? w.toFixed(1) + ' weeks on hand' + (st.over.excess > 0 ? ', ' + App.fmtCurrency(st.over.excess, 0) + ' over' : '') : this._META.order.sub;
    }
    if (k === 'week')  return st.billsWeek.total > 0 ? App.fmtCurrency(st.outThisWeek, 0) + ' going out this week' : 'Nothing scheduled out this week';
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

    if (k === 'trapped') {
      const t = st.trapped;
      if (!t.hasData) {
        return explain('Bar Cop reads trapped cash off your counts. Take a couple of weekly counts and the dead stock and overstock show up here with the dollars you can free.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-take-inventory">Take Inventory</button>' + this.markBtn('trapped', 'Mark Done'));
      }
      if (t.total <= 0) {
        return explain('Nothing dead and nothing piled up above par worth chasing. Your shelf cash is moving.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-report-movers">Dead Stock</button>' + this.markBtn('trapped', 'Mark Done'));
      }
      const rows = t.items.slice(0, 4).map(it => itemLine(
        it.name + (it.kind === 'dead' ? ' (not moving)' : ' (over par)'),
        App.fmtCurrency(it.free, 0))).join('');
      return explain('You have <strong style="color:var(--gold);">' + App.fmtCurrency(t.total, 0) + '</strong> trapped: ' + App.fmtCurrency(t.dead, 0) + ' in dead stock and ' + App.fmtCurrency(t.overPar, 0) + ' sitting above par. Run the dogs down, feature them, or cut the par so you stop reordering them.')
        + rows
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-report-movers">Dead Stock</button><button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Cut Pars</button>' + this.markBtn('trapped', 'Mark Done'));
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
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Order Sheet</button>' + this.markBtn('order', 'Mark Done'));
    }

    if (k === 'week') {
      const b = st.billsWeek;
      if (b.total <= 0 && st.reorder.total <= 0) {
        return explain('Nothing scheduled out this week that Bar Cop can see. As bills and orders land, this is where you catch a day where cash goes out faster than it comes in.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button>' + this.markBtn('week', 'Mark Done'));
      }
      const rows = b.list.slice(0, 4).map(x => itemLine(x.vendor, App.fmtCurrency(x.amount, 0))).join('');
      const reorderLine = st.reorder.total > 0
        ? '<div style="font-size:12px;color:var(--t2);margin-top:8px;">Plus about ' + App.fmtCurrency(st.reorder.total, 0) + ' to reorder to par.</div>'
        : '';
      return explain('Going out this week: <strong style="color:var(--t1);">' + App.fmtCurrency(st.outThisWeek, 0) + '</strong> (' + App.fmtCurrency(b.total, 0) + ' in bills and buys). Line it up against the cash coming in so a heavy day does not catch you short.')
        + rows + reorderLine
        + btnRow('<button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button>' + this.markBtn('week', 'Mark Done'));
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
      + btnRow('<button class="btn btn-ghost btn-sm" data-bills="1">Review Bills</button><button class="btn btn-ghost btn-sm" data-go="ic-vendors">Vendor Terms</button>' + this.markBtn('terms', 'Mark Done'));
  },

  // ── Status strip (the KPIs) ──────────────────────────────────────────────────
  statusStrip(st) {
    const item = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    const div = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 20px;"></div>';
    const weeks = st.over.weeksOnHand != null ? st.over.weeksOnHand.toFixed(1) + 'w' : '-';
    return '<div style="display:flex;align-items:center;flex-wrap:wrap;margin-top:22px;background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 22px;">'
      + item('Trapped Cash', st.trapped.hasData ? App.fmtCurrency(st.trapped.total, 0) : '-', st.trapped.total > 0 ? 'warn' : '')
      + div
      + item('Out This Week', st.outThisWeek > 0 ? App.fmtCurrency(st.outThisWeek, 0) : '-')
      + div
      + item('Weeks On Hand', weeks, (st.over.excess > 0 ? 'warn' : ''))
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
      if (ev.target.closest('.c-wk-now'))  { this._weekStart = null; this._openStep = null; this.render(this.container, this.actions); return; }
    };
  }
};
