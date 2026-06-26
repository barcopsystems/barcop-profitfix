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
    const done = this.stepDone(st);
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';

    container.innerHTML = '<div class="screen">'
      + (gs.all ? this.whereYouStand(st) : this.getStartedBox(gs))
      + this.banner(doneCount, this.ORDER.length)
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done, st)).join('')
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

    const cutoff = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 90); return App.ymdLocal(d); })();
    const closed = all.filter(b => (b.stage === 'Booked' || b.stage === 'Completed' || b.stage === 'Lost') && (b.date_received || '') >= cutoff);
    const wins = closed.filter(b => b.stage === 'Booked' || b.stage === 'Completed').length;
    const conv = closed.length >= 5 ? Math.round(100 * wins / closed.length) + '%' : (closed.length ? wins + ' of ' + closed.length : '-');

    const soon14 = futureBooked.filter(b => { const d = EB.daysUntil(b.event_date); return d != null && d >= 0 && d <= 14; });
    const noRunSheet = soon14.filter(b => !this._runSheetStarted(b));
    const completedOpen = all.filter(b => b.stage === 'Completed' && !(parseFloat(b.actual_revenue) > 0));

    return { all, open, stale, booked, futureBooked, bookedRev, next, pipeline, depDueList, depositsDue, conv, soon14, noRunSheet, completedOpen };
  },

  stepDone(st) {
    // Day one: nothing is logged yet, so the pipeline work has not started. Show the
    // steps as to-do, not auto-complete just because there is nothing pending.
    if (!st.all.length) return { leads: false, deposits: false, prep: false, close: false };
    return {
      leads:    st.stale.length === 0,
      deposits: st.depositsDue === 0,
      prep:     st.noRunSheet.length === 0,
      close:    st.completedOpen.length === 0
    };
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

    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Where You Stand</div>'
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

  // ── Expandable step (Books stepRow pattern; done is read off pipeline state) ─
  stepRow(k, done, st) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="ek-step-head" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, st) + '</div></div>'
      +   '<span style="color:var(--t3);font-size:13px;flex-shrink:0;">' + (isOpen ? '&#9652;' : '&#9662;') + '</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k) + '</div>';
    return html + '</div>';
  },

  stepStatus(k, st) {
    if (k === 'leads') {
      if (!st.open.length) return 'No open leads. The pipeline is clear.';
      return st.open.length + ' open' + (st.stale.length ? ' &middot; ' + st.stale.length + ' need follow-up' : ', all current');
    }
    if (k === 'deposits') return st.depositsDue > 0 ? this._money(st.depositsDue) + ' across ' + st.depDueList.length + ' event' + (st.depDueList.length === 1 ? '' : 's') : 'All deposits are in.';
    if (k === 'prep') {
      if (!st.soon14.length) return 'Nothing in the next two weeks.';
      return st.soon14.length + ' in two weeks' + (st.noRunSheet.length ? ' &middot; ' + st.noRunSheet.length + ' need a run sheet' : ', run sheets started');
    }
    if (k === 'close') return st.completedOpen.length ? st.completedOpen.length + ' event' + (st.completedOpen.length === 1 ? '' : 's') + ' to close out' : 'Every completed event is closed.';
    return '';
  },

  workspace(k) {
    const explain = (txt) => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const M = {
      leads:    'Follow up on open leads and quotes before they go cold. Three days without a touch and a lead flags stale.',
      deposits: 'A booking is not locked until the deposit is in. Collect what is owed on your booked events.',
      prep:     'Build the run sheet for every event in the next two weeks so the kitchen and floor know the plan.',
      close:    'Enter the actual revenue and costs on completed events to lock in the Event P&L.'
    };
    return explain(M[k]) + '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm" data-act="ev-bookings">Open Bookings</button></div>';
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
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => App.navigate(el.dataset.act)));
    this.container.querySelectorAll('.db-go').forEach(el => el.addEventListener('click', () => App.navigate(el.dataset.go)));
    this.container.querySelectorAll('.ek-step-head').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container);
    }));
  },

  showHowTo() {
    App.showHelpModal('How the Events Landing Works', [
      { p: ['Your events room at a glance. Up top, Where You Stand: the revenue you have booked, your open pipeline, the deposits you are owed, and your win rate. Below it, Book Out Your Events walks the work that keeps the pipeline moving.'] },
      { h: 'Getting Set Up', p: ['Before you have data, a Get Started box points you at the four things that turn Events on: log a booking, build your rate card, add your regulars, and plan a date. Once those are in, Where You Stand takes its place.'] },
      { h: 'Book Out Your Events', p: ['Four steps that handle themselves off your pipeline, no marking needed: work your open leads, collect deposits due, prep the run sheets for events in the next two weeks, and close out the P&L on completed events. A step turns green when there is nothing left to do in it; when all four are clear, your events are handled.'] },
      { h: 'As Needed', p: ['The planning tools sit at the bottom: the Event Calendar and your price packages.'] }
    ]);
  }
};
