'use strict';

/* ── Events — Dashboard ──────────────────────────────────────────────────────
   The Events landing (the top-nav Events link lands here; no sidebar Dashboard
   row). A feeder section, so this is an at-a-glance, not an audit: pipeline value
   and deposits owed up top, the next event and the leads to work, the regulars
   to reach this month, and what is coming on the calendar. Day one shows a Get
   Started strip until the first booking lands. */

S.EventsDashboard = {
  EB() { return S.EventsBookings; },
  bookings() { return (App.data && App.data.bookings) || []; },
  regulars() { return (App.data && App.data.event_regulars) || []; },
  calendar() { return (App.data && App.data.event_calendar) || []; },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (this.bookings().length === 0 && this.regulars().length === 0 && this.calendar().length === 0) this.renderDayOne();
    else this.renderFull();
  },

  // ── shared layout helpers (the Control/Recovery dashboard recipe) ──────────
  metricCard(label, val, target, cls) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div><div class="metric-val' + (cls ? ' ' + cls : '') + '">' + val + '</div><div class="metric-target">' + (target || '&nbsp;') + '</div><div class="metric-trend">&nbsp;</div></div>';
  },
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },
  shPanel(title, body, titleRight) {
    const sh = '<div class="sh" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</div>';
    const head = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:22px;margin:0 0 10px;">' + sh + (titleRight || '') + '</div>';
    return head + '<div class="card" style="flex:1;">' + body + '</div>';
  },
  panelCard(title, body, titleRight) {
    return '<div class="card form-card" style="height:100%;"><div class="card-title"' + (titleRight ? ' style="display:flex;align-items:center;justify-content:space-between;"' : '') + '><span>' + title + '</span>' + (titleRight || '') + '</div>' + body + '</div>';
  },

  // ── computed numbers ───────────────────────────────────────────────────────
  stats() {
    const EB = this.EB(), all = this.bookings();
    const open = all.filter(b => EB.isOpen(b.stage));
    const stale = open.filter(b => { const d = EB.daysSince(b.date_received); return d != null && d >= 3; });
    const booked = all.filter(b => b.stage === 'Booked');
    const soon = booked.filter(b => { const d = EB.daysUntil(b.event_date); return d != null && d >= 0 && d <= 30; });
    const pipeline = open.reduce((s, b) => s + (parseFloat(b.quoted_total) || 0), 0);
    const depositsDue = booked.filter(b => !b.deposit_paid_date).reduce((s, b) => s + (parseFloat(b.deposit_amount) || 0), 0);
    const cutoff = (() => { const d = new Date(App.todayLocal() + 'T00:00:00'); d.setDate(d.getDate() - 90); return App.ymdLocal(d); })();
    // A win is any booking that closed won (booked or already completed); a loss is Lost.
    const closed = all.filter(b => (b.stage === 'Booked' || b.stage === 'Completed' || b.stage === 'Lost') && (b.date_received || '') >= cutoff);
    const wins = closed.filter(b => b.stage === 'Booked' || b.stage === 'Completed').length;
    const conv = closed.length >= 5 ? Math.round(100 * wins / closed.length) + '%' : (closed.length ? wins + ' of ' + closed.length : '-');
    return { open, stale, booked, soon, pipeline, depositsDue, conv };
  },

  renderFull() {
    const EB = this.EB(), s = this.stats(), today = App.todayLocal();

    const tiles = '<div class="metric-grid">'
      + this.metricCard('Pipeline Value', App.fmtCurrency(s.pipeline), s.open.length + ' open lead' + (s.open.length === 1 ? '' : 's'))
      + this.metricCard('Booked, Next 30d', String(s.soon.length), 'confirmed events')
      + this.metricCard('Conversion (90d)', s.conv, 'won vs lost')
      + this.metricCard('Deposits Due', App.fmtCurrency(s.depositsDue), 'on booked events', s.depositsDue ? 'over-target' : 'on-target')
      + '</div>';

    // Hero — the next upcoming booked event. The action button rides the header.
    const upcoming = this.bookings().filter(b => b.stage === 'Booked' && b.event_date && b.event_date >= today)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
    const next = upcoming[0];
    let heroBody, heroBtn;
    if (next) {
      const dU = EB.daysUntil(next.event_date);
      const bal = EB.balanceDue(next);
      heroBtn = '<button class="btn btn-ghost btn-sm ev-go" data-go="ev-bookings" data-focus="' + esc(next.id) + '" style="margin:0;">Open Booking</button>';
      heroBody = '<div><div style="font-size:18px;font-weight:800;color:var(--t1);">' + esc(EB.title(next)) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:3px;">' + EB.fmtDate(next.event_date) + (dU != null ? ' &middot; ' + (dU === 0 ? 'today' : 'in ' + dU + ' day' + (dU === 1 ? '' : 's')) : '') + (next.party_size ? ' &middot; ' + next.party_size + ' guests' : '') + (bal > 0 ? ' &middot; ' + App.fmtCurrency(bal) + ' balance due' : '') + '</div></div>';
    } else {
      heroBtn = '<button class="btn btn-ghost btn-sm ev-go" data-go="ev-bookings" style="margin:0;">Open Bookings</button>';
      heroBody = '<div style="font-size:13px;color:var(--t2);line-height:1.6;">No events booked yet. Log a lead and work it through to Booked, and your next event shows here.</div>';
    }

    // Upcoming + Leads
    const upRows = upcoming.slice(0, 6).map(b => '<div class="ev-go" data-go="ev-bookings" data-focus="' + esc(b.id) + '" style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--row-div);cursor:pointer;"><span style="font-size:12px;color:var(--t1);">' + esc(EB.title(b)) + '</span><span style="font-size:11px;color:var(--t3);">' + EB.fmtDate(b.event_date) + '</span></div>').join('')
      || '<div style="font-size:12px;color:var(--t3);">Nothing booked ahead yet.</div>';
    const leads = s.open.slice().sort((a, b) => (EB.daysSince(b.date_received) || 0) - (EB.daysSince(a.date_received) || 0));
    const leadRows = leads.slice(0, 6).map(b => { const st = EB.daysSince(b.date_received) >= 3; return '<div class="ev-go" data-go="ev-bookings" data-focus="' + esc(b.id) + '" style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--row-div);cursor:pointer;"><span style="font-size:12px;color:var(--t1);">' + esc(EB.title(b)) + '</span><span style="font-size:11px;color:' + (st ? 'var(--red)' : 'var(--t3)') + ';">' + (st ? 'follow up' : b.stage) + '</span></div>'; }).join('')
      || '<div style="font-size:12px;color:var(--t3);">No open leads. The pipeline is clear.</div>';

    // Regulars to reach + This month on the calendar
    const RG = S.EventsRegulars, regs = this.regulars();
    const m = new Date(today + 'T00:00:00').getMonth();
    const reach = regs.filter(r => RG.monthOf(r.birthday) === m || RG.monthOf(r.anniversary) === m);
    const quiet = regs.filter(r => RG.isQuiet(r));
    const regBody = (reach.length || quiet.length)
      ? (reach.length ? '<div style="font-size:12px;color:var(--t1);margin-bottom:6px;"><span style="color:var(--t1);font-weight:700;">' + reach.length + '</span> with a birthday or anniversary this month</div>' : '')
        + (quiet.length ? '<div style="font-size:12px;color:var(--t2);"><span style="color:var(--amber);font-weight:700;">' + quiet.length + '</span> gone quiet (' + RG.QUIET_DAYS + '+ days)</div>' : '')
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm ev-go" data-go="ev-regulars">Open Regulars</button></div>'
      : '<div style="font-size:12px;color:var(--t3);">No outreach due this month. Add regulars to build the list.</div><div style="margin-top:12px;"><button class="btn btn-ghost btn-sm ev-go" data-go="ev-regulars">Open Regulars</button></div>';

    const cal = this.calendar().filter(e => e.date && new Date(e.date + 'T00:00:00').getMonth() === m && new Date(e.date + 'T00:00:00').getFullYear() === new Date(today + 'T00:00:00').getFullYear());
    const calBody = cal.length
      ? cal.slice(0, 6).map(e => { const done = ['menu', 'promo', 'staffing', 'reservations'].filter(k => (e.checklist || {})[k]).length; return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--row-div);"><span style="font-size:12px;color:var(--t1);">' + esc(e.name || '') + '</span><span style="font-size:11px;color:' + (done === 4 ? 'var(--green)' : 'var(--t3)') + ';">' + done + '/4 ready</span></div>'; }).join('')
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm ev-go" data-go="ev-calendar">Open Calendar</button></div>'
      : '<div style="font-size:12px;color:var(--t3);">Nothing planned this month. Add holidays and local dates on the Calendar.</div><div style="margin-top:12px;"><button class="btn btn-ghost btn-sm ev-go" data-go="ev-calendar">Open Calendar</button></div>';

    this.container.innerHTML = '<div class="screen">'
      + tiles
      + '<div style="margin-bottom:16px;">' + this.panelCard('Next Event', heroBody, heroBtn) + '</div>'
      + this.row(this.shPanel('Upcoming Events', upRows), this.shPanel('Leads to Work', leadRows))
      + this.row(this.shPanel('Regulars to Reach', regBody), this.shPanel('This Month', calBody))
      + this.quickActions()
      + '</div>';
    this.wire();
  },

  quickActions() {
    const btn = (go, label) => '<button class="btn btn-primary ev-go" data-go="' + go + '" style="flex:1;min-width:150px;">' + label + '</button>';
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + btn('ev-bookings', 'Bookings') + btn('ev-calendar', 'Calendar') + btn('ev-regulars', 'Regulars') + btn('ev-pricing', 'Pricing')
      + '</div></div>';
  },

  renderDayOne() {
    const step = (done, num, label, go) =>
      '<div class="ev-go" data-go="' + go + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid ' + (done ? 'var(--b2)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (done ? 'var(--input)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;' + (done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (done ? '&#10003;' : num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + label + '</span></div>';
    const hasRC = ((App.data && App.data.event_rate_cards) || []).length > 0;
    const strip = '<div class="card form-card" style="margin-bottom:14px;"><div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Events is where you run parties, buyouts, and catering, from the first call to the paid invoice. Log a booking, build your packages, add your regulars, and plan the dates that fill the room.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + step(false, 1, 'Log your first booking', 'ev-bookings')
      + step(hasRC, 2, 'Build your rate card', 'ev-pricing')
      + step(false, 3, 'Add your regulars', 'ev-regulars')
      + step(false, 4, 'Plan a date', 'ev-calendar')
      + '</div></div>';
    const ph = msg => '<div style="font-size:13px;color:var(--t3);line-height:1.6;">' + msg + '</div>';
    this.container.innerHTML = '<div class="screen">' + strip
      + '<div class="metric-grid">'
        + this.metricCard('Pipeline Value', App.fmtCurrency(0), 'After your first lead')
        + this.metricCard('Booked, Next 30d', '0', 'confirmed events')
        + this.metricCard('Conversion (90d)', '-', 'won vs lost')
        + this.metricCard('Deposits Due', App.fmtCurrency(0), 'on booked events')
      + '</div>'
      + '<div style="margin-bottom:16px;">' + this.panelCard('Next Event', ph('Your next booked event shows here. Log a lead and work it to Booked to start.'), '<button class="btn btn-ghost btn-sm ev-go" data-go="ev-bookings" style="margin:0;">Open Bookings</button>') + '</div>'
      + this.row(this.shPanel('Upcoming Events', ph('Booked events show here, soonest first.')), this.shPanel('Leads to Work', ph('Open leads and the ones that have gone stale show here.')))
      + this.row(this.shPanel('Regulars to Reach', ph('Birthdays, anniversaries, and quiet regulars surface here once you build the book.')), this.shPanel('This Month', ph('Holidays and local dates you plan around show here.')))
      + this.quickActions()
      + '</div>';
    this.wire();
  },

  wire() {
    this.container.querySelectorAll('.ev-go').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.focus) App._evBookingFocus = b.dataset.focus;
      App.navigate(b.dataset.go);
    }));
  },

  showHowTo() {
    App.showHelpModal('How the Events Dashboard Works', [
      { p: ['The Events landing, read top to bottom: the money in your pipeline and the deposits you are owed, your next event and the leads to work, who to reach out to this month, and what is coming on the calendar. Every number comes from your own bookings, regulars, and calendar.'] },
      { h: 'The Numbers', p: ['Watch Deposits Due and clear it on each booking as the money comes in. Conversion counts your wins (booked and completed) against the ones you lost over 90 days, and holds a raw count until five bookings close, then shows a percent. Pipeline Value totals your open leads; Booked, Next 30d is your near-term confirmed events.'] },
      { h: 'Working From Here', p: ['Next Event and the lead list open straight to the booking. Regulars to Reach is your monthly outreach list. This Month shows the dates you are planning around. The Quick Actions jump to Event Booking, Event Calendar, Track Regulars, and Price Packages.'] }
    ]);
  }
};
