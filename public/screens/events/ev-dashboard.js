'use strict';

/* ── Events — Dashboard ("Book The Events" landing) ──────────────────────────
   The Events landing, mirroring the Books "Close Out Your Books" pattern. Day
   one shows a Get Started box that flips to a Where You Stand card (booked
   revenue on top, a three-stat read below) once the room is set up. Below it,
   a Book The Events step card walks the pipeline work, the steps complete
   themselves off your pipeline state (no manual marking, since there is no
   weekly or monthly reset), then an As Needed row for the planning tools. */

S.EventsDashboard = {
  _openStep: null,
  ORDER: ['leads', 'deposits', 'prep', 'close'],
  _META: {
    leads:    { n: 1, title: 'Work your open leads' },
    deposits: { n: 2, title: 'Collect deposits due' },
    prep:     { n: 3, title: 'Prep upcoming events' },
    close:    { n: 4, title: 'Close out completed events' }
  },

  EB() { return S.EventsBookings; },
  _money(v) { return (v == null || isNaN(v)) ? '-' : App.fmtCurrency(Number(v)); },
  _runSheetStarted(b) { return !!(b.timeline || b.menu_notes || b.bev_notes || b.setup_notes || b.av_notes || b.guaranteed_count); },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const st = this._computeState();
    const gs = this.getStartedDone();
    const infos = {}; this.ORDER.forEach(k => { infos[k] = this.stepInfo(k, st); });
    const doneCount = this.ORDER.filter(k => infos[k].done).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !infos[k].done) || '';

    container.innerHTML = '<div class="screen">'
      + (gs.all ? this.whereYouStand(st) : this.getStartedBox(gs))
      + this.banner(doneCount, this.ORDER.length)
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, infos[k], st)).join('')
      + '</div>'
      + this.asNeeded()
      + '</div>';
    this.wire();
  },

  // ── Heavy compute, once per render ──────────────────────────────────────────
  _computeState() {
    const EB = this.EB();
    const all = (App.data && App.data.bookings) || [];
    const today = App.todayLocal();
    const open = all.filter(b => EB.isOpen(b.stage));
    const stale = open.filter(b => { const d = EB.daysSince(b.date_received); return d != null && d >= 3; });
    const booked = all.filter(b => b.stage === 'Booked');
    const futureBooked = booked.filter(b => b.event_date && b.event_date >= today);
    const bookedRev = futureBooked.reduce((s, b) => s + EB.quoteTotal(b), 0);
    const next = futureBooked.slice().sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))[0] || null;
    const pipeline = open.reduce((s, b) => s + EB.quoteTotal(b), 0);
    const depDueList = booked.filter(b => !b.deposit_paid_date && (parseFloat(b.deposit_amount) || 0) > 0);
    const depositsDue = depDueList.reduce((s, b) => s + (parseFloat(b.deposit_amount) || 0), 0);

    // The briefing sentence below says "your win rate is X over the last 90 days", so the window is
    // 90 days, not 91. App.windowCutoff is the one implementation of that.
    const cutoff = App.windowCutoff(90);
    const closed = all.filter(b => (b.stage === 'Booked' || b.stage === 'Completed' || b.stage === 'Lost') && (b.date_received || '') >= cutoff);
    const wins = closed.filter(b => b.stage === 'Booked' || b.stage === 'Completed').length;
    const conv = closed.length >= 5 ? Math.round(100 * wins / closed.length) + '%' : (closed.length ? wins + ' of ' + closed.length : '-');

    const soon14 = futureBooked.filter(b => { const d = EB.daysUntil(b.event_date); return d != null && d >= 0 && d <= 14; });
    const noRunSheet = soon14.filter(b => !this._runSheetStarted(b));
    const completedOpen = all.filter(b => b.stage === 'Completed' && !(parseFloat(b.actual_revenue) > 0));

    return { all, open, stale, booked, futureBooked, bookedRev, next, pipeline, depDueList, depositsDue, conv, soon14, noRunSheet, completedOpen };
  },

  // ── Step completion: you mark a step done (your own checkmark), and it stays
  // done until something NEW lands in it, then it reopens on its own. Mark Done
  // snapshots the items pending right then; the step is done while nothing outside
  // that snapshot is pending. Stored per-step on this device.
  _ackKey(k) { return 'events_step_ack_' + k; },
  ackOf(k)   { try { const v = localStorage.getItem(this._ackKey(k)); return v == null ? null : (JSON.parse(v) || []); } catch (e) { return null; } },
  setAck(k, ids) { try { localStorage.setItem(this._ackKey(k), JSON.stringify(ids || [])); } catch (e) {} },
  clearAck(k)    { try { localStorage.removeItem(this._ackKey(k)); } catch (e) {} },
  pendingIds(k, st) {
    const id = b => b.id;
    if (k === 'leads')    return st.open.map(id);
    if (k === 'deposits') return st.depDueList.map(id);
    if (k === 'prep')     return st.noRunSheet.map(id);
    if (k === 'close')    return st.completedOpen.map(id);
    return [];
  },
  stepInfo(k, st) {
    const ack = this.ackOf(k);
    const pend = this.pendingIds(k, st);
    const acked = ack != null;
    const newPend = acked ? pend.filter(x => ack.indexOf(x) === -1) : pend;
    return { acked, pend, newPend, done: acked && newPend.length === 0 };
  },

  // ── Where You Stand (booked revenue hero + three-stat read) ─────────────────
  whereYouStand(st) {
    const EB = this.EB();
    const nextLine = st.next
      ? st.futureBooked.length + ' event' + (st.futureBooked.length === 1 ? '' : 's') + ' on the books &middot; next ' + EB.fmtDate(st.next.event_date)
      : 'nothing booked ahead yet';
    const hero = '<div style="padding:2px 0;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--w);">' + this._money(st.bookedRev) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">booked, on the calendar</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">' + nextLine + '</div></div>';

    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">The Pipeline</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Open Pipeline', this._money(st.pipeline)) + vdiv
      +   mini('Deposits Due', this._money(st.depositsDue), st.depositsDue > 0 ? 'var(--amber)' : 'var(--t1)') + vdiv
      +   mini('Win Rate, 90d', st.conv)
      + '</div>'
      + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-act="ev-bookings">Open Bookings</button></div></div>';

    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>'
      + '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button></div>'
      + hero + secondary + '</div>';
  },

  // ── Book The Events banner (the pipeline-work progress) ──────────────────────
  banner(dc, total) {
    const allDone = dc === total;
    const pct = total ? Math.round(dc / total * 100) : 0;
    const doneLine = allDone
      ? '<span style="color:var(--green);font-weight:700;">&#10003; Your events are handled</span>'
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + dc + '</span> of ' + total + ' handled</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div style="padding:11px 22px;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Book Out Your Events</div>'
      + '</div>'
      + '<div style="padding:18px 22px;">'
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
      +     '<div style="flex:1;min-width:160px;height:6px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      +     '<div style="font-size:12px;">' + doneLine + '</div>'
      +   '</div>'
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">Work the leads, collect the deposits, prep the run sheets, and close out what is done.</div>')
      + '</div>'
      + '</div>';
  },

  // ── Expandable step (Books stepRow pattern; you mark it done, it reopens on new work) ─
  stepRow(k, info, st) {
    const m = this._META[k], isDone = info.done, isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="ek-step-head' + (isOpen ? '' : ' collapsed') + '" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, st, info) + '</div></div>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k, info) + '</div>';
    return html + '</div>';
  },

  stepStatus(k, st, info) {
    if (info.done) {
      return { leads: 'Leads followed up.', deposits: 'Deposits handled.', prep: 'Run sheets handled.', close: 'Completed events closed.' }[k];
    }
    const n = info.newPend.length;
    if (k === 'leads')    return n ? n + ' lead' + (n === 1 ? '' : 's') + ' to follow up' : 'No open leads right now';
    if (k === 'deposits') {
      const amt = st.depDueList.filter(b => info.newPend.indexOf(b.id) !== -1).reduce((s, b) => s + (parseFloat(b.deposit_amount) || 0), 0);
      return n ? this._money(amt) + ' due across ' + n + ' event' + (n === 1 ? '' : 's') : 'No deposits due right now';
    }
    if (k === 'prep')     return n ? n + ' event' + (n === 1 ? '' : 's') + ' need a run sheet' : 'Nothing to prep right now';
    if (k === 'close')    return n ? n + ' event' + (n === 1 ? '' : 's') + ' to close out' : 'Nothing to close right now';
    return '';
  },

  workspace(k, info) {
    const explain = (txt) => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const M = {
      leads:    'Follow up on open leads and quotes before they go cold, then mark this done. It reopens on its own when a new lead comes in.',
      deposits: 'A booking is not locked until the deposit is in. Collect what is owed, then mark this done. It reopens when a new deposit comes due.',
      prep:     'Build the run sheet for every event in the next two weeks so the kitchen and floor know the plan, then mark this done. It reopens for the next event to prep.',
      close:    'Enter the actual revenue and costs on completed events to lock in the Event P&L, then mark this done. It reopens for the next event to close.'
    };
    const markBtn = info.done
      ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
      : '<button class="btn btn-primary btn-sm" data-done="' + k + '">Mark Done</button>';
    return explain(M[k]) + '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm" data-act="ev-bookings">Open Bookings</button>' + markBtn + '</div>';
  },

  asNeeded() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="ev-calendar">Event Calendar</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="ev-pricing">Price Packages</button>'
      + '</div>';
  },

  // ── Day one: four-step Get Started box; flips to Where You Stand once set up ─
  getStartedDone() {
    const has = (a) => Array.isArray(a) && a.length > 0;
    const hasBooking = has(App.data && App.data.bookings);
    const hasRate    = has(App.data && App.data.event_rate_cards);
    const hasReg     = has(App.data && App.data.event_regulars);
    const hasCal     = has(App.data && App.data.event_calendar);
    // Event Booking is the heart of the section and can run alone, so once a
    // booking exists, show Where You Stand; the rate card, regulars, and calendar
    // are optional and reachable from As Needed and the sidebar.
    return { hasBooking, hasRate, hasReg, hasCal, all: hasBooking };
  },
  getStartedBox(d) {
    return DashUI.dayOneStrip(
      'Set up your events room and this card fills in with your booked revenue, your pipeline, and the deposits you are owed.',
      [
        { done: d.hasBooking, num: 1, label: 'Log your first booking', go: 'ev-bookings' },
        { done: d.hasRate,    num: 2, label: 'Build your rate card',    go: 'ev-pricing' },
        { done: d.hasReg,     num: 3, label: 'Add your regulars',       go: 'ev-regulars' },
        { done: d.hasCal,     num: 4, label: 'Plan a date',             go: 'ev-calendar' }
      ]);
  },

  wire() {
    this.container.querySelectorAll('[data-insights]').forEach(el => el.addEventListener('click', () => this.showInsights()));
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => App.navigate(el.dataset.act)));
    this.container.querySelectorAll('.db-go').forEach(el => el.addEventListener('click', () => App.navigate(el.dataset.go)));
    this.container.querySelectorAll('.ek-step-head').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container);
    }));
    this.container.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.done; this.setAck(k, this.pendingIds(k, this._computeState())); this._openStep = null; this.render(this.container);
    }));
    this.container.querySelectorAll('[data-undone]').forEach(b => b.addEventListener('click', () => {
      this.clearAck(b.dataset.undone); this.render(this.container);
    }));
  },

  // ── Bar Cop Briefing: a written read of the events pipeline. Code-generated
  //    (no API), same button the other sections carry. ─────────────────────────
  showInsights() {
    const st = this._computeState();
    if (!st.all.length) { DashUI.insightsModal('Bar Cop Briefing', 'Log a few bookings and Bar Cop can read your events pipeline for you.'); return; }
    DashUI.insightsModal('Bar Cop Briefing', this._insBriefing(st));
  },
  _insBriefing(st) {
    const EB = this.EB();
    const m = n => (n == null || isNaN(n)) ? '$0' : App.fmtCurrency(Number(n), 0);
    const paras = [];

    // 1 — what is booked and in the pipeline
    let p1 = 'You have ' + m(st.bookedRev) + ' booked on the calendar across ' + st.futureBooked.length + ' event' + (st.futureBooked.length === 1 ? '' : 's') + (st.next ? ', next up ' + EB.fmtDate(st.next.event_date) : '') + '.';
    if (st.pipeline > 0) p1 += ' Another ' + m(st.pipeline) + ' sits in the open pipeline.';
    paras.push(p1);

    // 2 — what needs a hand
    const bits = [];
    if (st.depositsDue > 0) bits.push(m(st.depositsDue) + ' in deposits still owed');
    if (st.open.length) bits.push(st.open.length + ' open lead' + (st.open.length === 1 ? '' : 's') + (st.stale.length ? ', ' + st.stale.length + ' going cold' : ''));
    if (st.noRunSheet.length) bits.push(st.noRunSheet.length + ' event' + (st.noRunSheet.length === 1 ? '' : 's') + ' in the next two weeks with no run sheet');
    if (st.completedOpen.length) bits.push(st.completedOpen.length + ' completed event' + (st.completedOpen.length === 1 ? '' : 's') + ' still to close out');
    paras.push(bits.length ? 'What needs a hand: ' + bits.join(', ') + '.' : 'The pipeline is clean, nothing chasing you right now. Your win rate is ' + st.conv + ' over the last 90 days.');

    // 3 — the one move
    let move;
    if (st.stale.length) move = 'Chase the ' + st.stale.length + ' cold lead' + (st.stale.length === 1 ? '' : 's') + ' first, before they book somewhere else.';
    else if (st.depositsDue > 0) move = 'Collect the deposits owed. A booking is not locked until the money is in.';
    else if (st.noRunSheet.length) move = 'Build run sheets for the events landing in the next two weeks so the kitchen and floor have the plan.';
    else move = 'Nothing urgent. Keep the leads moving and the deposits collected.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  },

  showHowTo() {
    App.showHelpModal('How the Events Landing Works', [
      { p: ['Your events room at a glance. Up top, Where You Stand: the revenue you have booked, your open pipeline, the deposits you are owed, and your win rate. Below it, Book Out Your Events walks the work that keeps the pipeline moving.'] },
      { h: 'Getting Set Up', p: ['Before you have data, a Get Started box points you at the four things that turn Events on: log a booking, build your rate card, add your regulars, and plan a date. Once those are in, Where You Stand takes its place.'] },
      { h: 'Book Out Your Events', p: ['Four steps for the ongoing pipeline work: work your open leads, collect deposits due, prep the run sheets for events in the next two weeks, and close out the P&L on completed events. A step stays open until you do the work and mark it done, your own checkmark that you handled it. It stays done until something new lands in it, a new lead, a deposit due, an event to prep or close, and then it reopens on its own showing just the new item. So the cockpit never goes stale and never marks itself done for you.'] },
      { h: 'As Needed', p: ['The planning tools sit at the bottom: the Event Calendar and your price packages.'] }
    ]);
  }
};
