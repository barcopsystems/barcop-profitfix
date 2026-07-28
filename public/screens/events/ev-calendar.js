'use strict';

/* ── Events — Calendar ───────────────────────────────────────────────────────
   One interactive month grid for everything that fills the room: your booked
   events (from Bookings, on their event date) and the holidays / local dates
   you plan around, each with a four-step planning checklist (menu, promo,
   staffing, reservations). Booked-event chips open the booking; date chips open
   a planning card. The grid is the desktop view; phones fall back to an agenda
   list (same data, swapped by CSS). Planning dates persist in event_calendar. */

S.EventsCalendar = {
  _y: null, _m: null,   // year + month index (0-11) of the displayed month
  TYPES: ['Holiday', 'Local Event', 'Big Game', 'Promotion', 'Other'],

  entries()  { if (!Array.isArray(App.data.event_calendar)) App.data.event_calendar = []; return App.data.event_calendar; },
  bookings() { return (S.EventsBookings && S.EventsBookings.bookings()) || (App.data.bookings || []); },

  ymd(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); },
  monthLabel(y, m) { return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (this._y == null) { const t = new Date(App.todayLocal() + 'T00:00:00'); this._y = t.getFullYear(); this._m = t.getMonth(); }
    this.draw();
  },

  step(delta) {
    let m = this._m + delta, y = this._y;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    this._m = m; this._y = y; this.draw();
  },
  thisMonth() { const t = new Date(App.todayLocal() + 'T00:00:00'); this._y = t.getFullYear(); this._m = t.getMonth(); this.draw(); },

  // Map of YYYY-MM-DD -> [items] for the displayed month.
  itemsByDate() {
    const map = {};
    const add = (date, item) => { if (!date) return; const k = String(date).slice(0, 10); (map[k] = map[k] || []).push(item); };
    this.bookings().forEach(b => {
      if ((b.stage === 'Booked' || b.stage === 'Completed') && b.event_date)
        add(b.event_date, { kind: 'booking', id: b.id, label: (S.EventsBookings ? S.EventsBookings.title(b) : (b.event_name || 'Event')) });
    });
    this.entries().forEach(e => add(e.date, { kind: 'date', id: e.id, label: e.name || e.type || 'Date', cl: e.checklist || {} }));
    return map;
  },

  clDone(cl) { return ['menu', 'promo', 'staffing', 'reservations'].filter(k => (cl || {})[k]).length; },

  // ── Recognized holidays (shown automatically every year; tap one to plan it) ──
  FIXED_HOLIDAYS: [
    [1, 1, "New Year's Day"], [2, 14, "Valentine's Day"], [3, 17, "St. Patrick's Day"],
    [5, 5, 'Cinco de Mayo'], [7, 4, 'Independence Day'], [10, 31, 'Halloween'],
    [12, 24, 'Christmas Eve'], [12, 25, 'Christmas Day'], [12, 31, "New Year's Eve"]
  ],
  _nthWeekday(y, mo0, wd, n) {
    const first = new Date(y, mo0, 1);
    const offset = (wd - first.getDay() + 7) % 7;
    return this.ymd(y, mo0, 1 + offset + (n - 1) * 7);
  },
  _lastWeekday(y, mo0, wd) {
    const lastDate = new Date(y, mo0 + 1, 0).getDate();
    const last = new Date(y, mo0, lastDate);
    return this.ymd(y, mo0, lastDate - ((last.getDay() - wd + 7) % 7));
  },
  _easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      mm = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * mm + 114) / 31),
      day = ((h + l - 7 * mm + 114) % 31) + 1;
    return this.ymd(y, mo - 1, day);
  },
  holidaysForYear(y) {
    const list = this.FIXED_HOLIDAYS.map(([mo, d, name]) => ({ date: this.ymd(y, mo - 1, d), name }));
    list.push({ date: this._easter(y), name: 'Easter' });
    list.push({ date: this._nthWeekday(y, 4, 0, 2), name: "Mother's Day" });   // 2nd Sunday, May
    list.push({ date: this._lastWeekday(y, 4, 1), name: 'Memorial Day' });      // last Monday, May
    list.push({ date: this._nthWeekday(y, 5, 0, 3), name: "Father's Day" });    // 3rd Sunday, June
    list.push({ date: this._nthWeekday(y, 8, 1, 1), name: 'Labor Day' });       // 1st Monday, September
    list.push({ date: this._nthWeekday(y, 10, 4, 4), name: 'Thanksgiving' });   // 4th Thursday, November
    return list;
  },
  holidaysForMonth(y, m) {
    return this.holidaysForYear(y).filter(h => { const d = new Date(h.date + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === m; });
  },

  draw() {
    const y = this._y, m = this._m, today = App.todayLocal();
    const map = this.itemsByDate();
    // Recognized holidays, auto-shown, unless you've already added your own date that day.
    this.holidaysForMonth(y, m).forEach(h => {
      if ((map[h.date] || []).some(it => it.kind === 'date')) return;
      (map[h.date] = map[h.date] || []).push({ kind: 'holiday', date: h.date, label: h.name });
    });
    // Same-space double-bookings on a day get a conflict flag on their chips.
    const conflictIds = new Set();
    Object.keys(map).forEach(k => {
      const bk = map[k].filter(it => it.kind === 'booking');
      if (bk.length < 2) return;
      /* ⚠⚠ ONE CONFLICT RULE, NOT TWO. This was a private copy that used a different stage set from
         S.EventsBookings.conflicts — the calendar counted Completed events as holders and ignored
         Quote Sent ones, so it flagged pairs the booking page then refused to name: click the red
         chip and the banner described a DIFFERENT event. It also dropped any booking with a blank
         space, exactly like the copy on the other screen, so a single-room bar got nothing.
         Delegating means the two screens can never disagree again. */
      bk.forEach(it => {
        const rec = this.bookings().find(x => x.id === it.id);
        if (rec && typeof S !== 'undefined' && S.EventsBookings && S.EventsBookings.conflicts(rec).length) conflictIds.add(it.id);
      });
    });
    this._conflictIds = conflictIds;

    const startDow = new Date(y, m, 1).getDay();
    const daysIn = new Date(y, m + 1, 0).getDate();

    // Month chip styled like the week stepper: gold-tint on the current month, neutral otherwise.
    const t = new Date(today + 'T00:00:00');
    const isCurMonth = (y === t.getFullYear() && m === t.getMonth());
    const nowBadge = isCurMonth ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(this.monthLabel(y, m).toUpperCase()) + nowBadge + '</span>';
    const headRow = '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px;">'
      + '<button class="btn btn-ghost btn-sm" id="evc-prev" aria-label="Previous month" style="margin:0;padding:3px 9px;">&lsaquo;</button>'
      + pill
      + '<button class="btn btn-ghost btn-sm" id="evc-next" aria-label="Next month" style="margin:0;padding:3px 9px;">&rsaquo;</button>'
      + (isCurMonth ? '' : '<button class="btn btn-ghost btn-sm" id="evc-today" style="margin-left:4px;">This Month</button>')
      + '</div>';

    const chipHtml = it => {
      if (it.kind === 'booking') {
        const conf = this._conflictIds && this._conflictIds.has(it.id);
        return '<div class="evcal-chip evcal-booking" data-go="booking" data-id="' + esc(it.id) + '" title="' + esc(it.label) + (conf ? ' (double-booked space)' : '') + '"' + (conf ? ' style="border-color:var(--red);"' : '') + '>' + (conf ? '&#9888; ' : '') + esc(it.label) + '</div>';
      }
      if (it.kind === 'holiday') return '<div class="evcal-chip evcal-holiday" data-go="holiday" data-date="' + esc(it.date) + '" data-name="' + esc(it.label) + '" title="' + esc(it.label) + ' (tap to plan)">' + esc(it.label) + '</div>';
      return '<div class="evcal-chip evcal-date" data-go="date" data-id="' + esc(it.id) + '" title="' + esc(it.label) + '">' + esc(it.label) + ' <span style="opacity:0.7;">' + this.clDone(it.cl) + '/4</span></div>';
    };

    // Desktop grid
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let cells = dow.map(d => '<div class="evcal-dow">' + d + '</div>').join('');
    for (let i = 0; i < startDow; i++) cells += '<div class="evcal-cell evcal-blank"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const ds = this.ymd(y, m, d);
      const items = map[ds] || [];
      cells += '<div class="evcal-cell' + (ds === today ? ' evcal-today' : '') + '" data-day="' + ds + '">'
        + '<div class="evcal-num"' + (ds === today ? ' style="color:var(--green);"' : '') + '>' + d + '</div>' + items.map(chipHtml).join('') + '</div>';
    }
    const grid = '<div class="evcal-grid">' + cells + '</div>';

    // Mobile agenda — only days with items
    const agendaDays = [];
    for (let d = 1; d <= daysIn; d++) { const ds = this.ymd(y, m, d); if (map[ds]) agendaDays.push([ds, d, map[ds]]); }
    const monShort = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short' });
    const agenda = '<div class="evcal-agenda">' + (agendaDays.length === 0
      ? '<div style="color:var(--t3);font-size:13px;padding:10px 2px;">Nothing on the calendar this month. Add a date or book an event.</div>'
      : agendaDays.map(([ds, d, items]) => '<div class="card" style="margin-bottom:8px;"><div style="font-weight:700;color:var(--t1);margin-bottom:6px;">' + monShort + ' ' + d + (ds === today ? ' &middot; Today' : '') + '</div>' + items.map(chipHtml).join('') + '</div>').join('')) + '</div>';

    this.container.innerHTML = '<div class="screen">' + headRow
      + '<div class="card" style="background:var(--input);">' + grid + agenda + '</div>'
      + '<div style="margin:16px 0 24px;"><button class="btn btn-primary" id="evc-add">Add New Date</button></div>'
      + '</div>';
    this.wire();
  },

  wire() {
    document.getElementById('evc-prev')?.addEventListener('click', () => this.step(-1));
    document.getElementById('evc-next')?.addEventListener('click', () => this.step(1));
    document.getElementById('evc-today')?.addEventListener('click', () => this.thisMonth());
    document.getElementById('evc-add')?.addEventListener('click', () => this.showForm(null, null));
    this.container.querySelectorAll('.evcal-chip').forEach(ch => ch.addEventListener('click', ev => {
      ev.stopPropagation();
      if (ch.dataset.go === 'booking') { App._evBookingFocus = ch.dataset.id; App.navigate('ev-bookings'); }
      else if (ch.dataset.go === 'holiday') this.showForm(null, ch.dataset.date, ch.dataset.name, 'Holiday');
      else this.showForm(ch.dataset.id, null);
    }));
    this.container.querySelectorAll('.evcal-cell[data-day]').forEach(c => c.addEventListener('click', ev => {
      if (ev.target.closest('.evcal-chip')) return;
      this.showForm(null, c.dataset.day);
    }));
  },

  showForm(id, presetDate, presetName, presetType) {
    const e = id ? this.entries().find(x => x.id === id) : null;
    const cl = (e && e.checklist) || {};
    const typeOpts = '<option value="">Select type...</option>' + this.TYPES.map(t => '<option' + (((e && e.type === t) || (!e && presetType === t)) ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const chk = (k, label) => '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding:5px 0;"><input type="checkbox" class="bc-check" id="evcf-' + k + '"' + (cl[k] ? ' checked' : '') + '/> ' + label + '</label>';
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (id ? 'Edit Date' : 'Add New Date') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="flex:1 1 140px;"><label>Date</label><input type="date" id="evcf-date" value="' + esc(e?.date || presetDate || '') + '"/></div>'
        + '<div class="f" style="flex:1 1 140px;"><label>Name</label><input type="text" id="evcf-name" value="' + esc(e?.name || presetName || '') + '" placeholder="Valentine\'s Day"/></div>'
        + '<div class="f" style="flex:1 1 140px;"><label>Type</label><select id="evcf-type" class="form-input">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="sh" style="margin:6px 0 4px;">Planning Checklist</div>'
      + '<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;">'
        + chk('menu', 'Menu locked') + chk('promo', 'Promo created') + chk('staffing', 'Staffing scheduled') + chk('reservations', 'Reservations open')
      + '</div>'
      + App.noteField({ id: 'evcf-notes', value: e?.notes })
      + '<div class="card-actions"><button class="btn btn-primary" id="evcf-save">' + (id ? 'Save' : 'Add New Date') + '</button>'
      +   (id ? '<button class="btn btn-danger" id="evcf-del" style="margin-left:auto;">Delete</button>' : '')
      +   '<span id="evcf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';
    App.openModal(html, { id: 'evc-form', maxWidth: 540, noClose: true });
    document.getElementById('evcf-save')?.addEventListener('click', () => this.save(id));
    document.getElementById('evcf-del')?.addEventListener('click', async () => {
      const ok = await App.confirmDelete(); if (!ok) return;
      await App.removeRecord('core', 'event_calendar_entry', id);   // row-per-record
      App.closeModal('evc-form'); this.draw();
    });
  },

  async save(id) {
    const g = x => document.getElementById(x);
    const date = g('evcf-date')?.value, name = g('evcf-name')?.value.trim(), err = g('evcf-err');
    if (!date) { if (err) { err.textContent = 'Pick a date.'; err.style.display = 'inline'; } return; }
    if (!name) { if (err) { err.textContent = 'Name the date.'; err.style.display = 'inline'; } return; }
    const rec = {
      id: id || App.uid(), date, name, type: g('evcf-type')?.value || '',
      checklist: { menu: !!g('evcf-menu')?.checked, promo: !!g('evcf-promo')?.checked, staffing: !!g('evcf-staffing')?.checked, reservations: !!g('evcf-reservations')?.checked },
      notes: g('evcf-notes')?.value.trim() || ''
    };
    // Row-per-record: build the merged record (edit preserves fields not on the
    // form) and write just that row.
    const list = this.entries();
    let out = rec;
    if (id) { const i = list.findIndex(x => x.id === id); if (i > -1) out = Object.assign({}, list[i], rec); }
    await App.putRecord('core', 'event_calendar_entry', out);
    App.closeModal('evc-form'); this.draw();
  },

  showHowTo() {
    App.showHelpModal('How the Event Calendar Works', [
      { p: ['One month view of everything that fills the room: your booked events on their dates, the recognized holidays Bar Cop already knows, and the local dates you add yourself.'] },
      { h: 'Moving Around', p: ['Step months with the arrows, or jump back with This Month. The current month is tagged gold and today is highlighted. On a phone the grid becomes an agenda list of the days that have something on them.'] },
      { h: 'Booked Events', p: ['Every booking marked Booked or Completed shows on its event date. Tap it to open the booking. If two events land in the same space on the same day, both chips flag red so you catch a double-booking before it bites you.'] },
      { h: 'Holidays', p: ['The big ones show up every year on their own: New Year\'s, Valentine\'s, St. Patrick\'s, Cinco de Mayo, Mother\'s and Father\'s Day, the Fourth, Halloween, Thanksgiving, Christmas, New Year\'s Eve, and more. Tap one to drop it onto your calendar with a planning checklist.'] },
      { h: 'Planning Dates', p: ['Add New Date, below the calendar, drops a local event, big game, or promotion onto a day. Work the checklist (menu locked, promo created, staffing scheduled, reservations open); the 2 of 4 read is your prep status for that date.'] }
    ]);
  }
};
