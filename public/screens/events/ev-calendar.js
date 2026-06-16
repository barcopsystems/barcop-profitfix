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

  draw() {
    const y = this._y, m = this._m, today = App.todayLocal();
    const map = this.itemsByDate();
    const startDow = new Date(y, m, 1).getDay();
    const daysIn = new Date(y, m + 1, 0).getDate();

    const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;">'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      +   '<button class="btn btn-ghost btn-sm" id="evc-prev">&#8249;</button>'
      +   '<div style="font-size:15px;font-weight:700;color:var(--t1);min-width:160px;text-align:center;">' + esc(this.monthLabel(y, m)) + '</div>'
      +   '<button class="btn btn-ghost btn-sm" id="evc-next">&#8250;</button>'
      +   '<button class="btn btn-ghost btn-sm" id="evc-today">This Month</button>'
      + '</div>'
      + '<button class="btn btn-primary btn-sm" id="evc-add">Add Date</button>'
      + '</div>';

    const chipHtml = it => it.kind === 'booking'
      ? '<div class="evcal-chip evcal-booking" data-go="booking" data-id="' + esc(it.id) + '" title="' + esc(it.label) + '">' + esc(it.label) + '</div>'
      : '<div class="evcal-chip evcal-date" data-go="date" data-id="' + esc(it.id) + '" title="' + esc(it.label) + '">' + esc(it.label) + ' <span style="opacity:0.7;">' + this.clDone(it.cl) + '/4</span></div>';

    // Desktop grid
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let cells = dow.map(d => '<div class="evcal-dow">' + d + '</div>').join('');
    for (let i = 0; i < startDow; i++) cells += '<div class="evcal-cell evcal-blank"></div>';
    for (let d = 1; d <= daysIn; d++) {
      const ds = this.ymd(y, m, d);
      const items = map[ds] || [];
      cells += '<div class="evcal-cell' + (ds === today ? ' evcal-today' : '') + '" data-day="' + ds + '">'
        + '<div class="evcal-num">' + d + '</div>' + items.map(chipHtml).join('') + '</div>';
    }
    const grid = '<div class="evcal-grid">' + cells + '</div>';

    // Mobile agenda — only days with items
    const agendaDays = [];
    for (let d = 1; d <= daysIn; d++) { const ds = this.ymd(y, m, d); if (map[ds]) agendaDays.push([ds, d, map[ds]]); }
    const monShort = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short' });
    const agenda = '<div class="evcal-agenda">' + (agendaDays.length === 0
      ? '<div style="color:var(--t3);font-size:13px;padding:10px 2px;">Nothing on the calendar this month. Add a date or book an event.</div>'
      : agendaDays.map(([ds, d, items]) => '<div class="card" style="margin-bottom:8px;"><div style="font-weight:700;color:var(--t1);margin-bottom:6px;">' + monShort + ' ' + d + (ds === today ? ' &middot; Today' : '') + '</div>' + items.map(chipHtml).join('') + '</div>').join('')) + '</div>';

    this.container.innerHTML = '<div class="screen">' + headRow + grid + agenda + '</div>';
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
      else this.showForm(ch.dataset.id, null);
    }));
    this.container.querySelectorAll('.evcal-cell[data-day]').forEach(c => c.addEventListener('click', ev => {
      if (ev.target.closest('.evcal-chip')) return;
      this.showForm(null, c.dataset.day);
    }));
  },

  showForm(id, presetDate) {
    const e = id ? this.entries().find(x => x.id === id) : null;
    const cl = (e && e.checklist) || {};
    const typeOpts = '<option value="">-</option>' + this.TYPES.map(t => '<option' + (e && e.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const chk = (k, label) => '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding:5px 0;"><input type="checkbox" id="evcf-' + k + '"' + (cl[k] ? ' checked' : '') + '/> ' + label + '</label>';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (id ? 'Edit Date' : 'Add a Date') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Date</label><input type="date" id="evcf-date" value="' + esc(e?.date || presetDate || '') + '"/></div>'
        + '<div class="f"><label>Name</label><input type="text" id="evcf-name" value="' + esc(e?.name || '') + '" placeholder="Valentine\'s Day"/></div>'
        + '<div class="f"><label>Type</label><select id="evcf-type" class="form-input">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="sh" style="margin:6px 0 4px;">Planning Checklist</div>'
      + '<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;">'
        + chk('menu', 'Menu locked') + chk('promo', 'Promo created') + chk('staffing', 'Staffing scheduled') + chk('reservations', 'Reservations open')
      + '</div>'
      + '<div class="f" style="width:100%;"><label>Notes</label><textarea id="evcf-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(e?.notes || '') + '</textarea></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="evcf-save">' + (id ? 'Save' : 'Add Date') + '</button>'
      +   '<button class="btn btn-ghost" id="evcf-cancel">Cancel</button>'
      +   (id ? '<button class="btn btn-danger" id="evcf-del" style="margin-left:auto;">Delete</button>' : '')
      +   '<span id="evcf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';
    App.openModal(html, { id: 'evc-form', maxWidth: 560, noClose: true });
    document.getElementById('evcf-cancel')?.addEventListener('click', () => App.closeModal('evc-form'));
    document.getElementById('evcf-save')?.addEventListener('click', () => this.save(id));
    document.getElementById('evcf-del')?.addEventListener('click', async () => {
      const ok = await App.confirmDelete(); if (!ok) return;
      App.data.event_calendar = this.entries().filter(x => x.id !== id);
      await App.saveKey('event_calendar');
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
    const list = this.entries();
    if (id) { const i = list.findIndex(x => x.id === id); if (i > -1) list[i] = Object.assign({}, list[i], rec); }
    else list.push(rec);
    await App.saveKey('event_calendar');
    App.closeModal('evc-form'); this.draw();
  },

  showHowTo() {
    App.showHelpModal('How the Calendar Works', [
      { p: ['One month view of everything that fills the room. Your booked events show automatically on their event date. The holidays and local dates you plan around you add yourself, each with a four-step planning checklist.'] },
      { h: 'Moving Around', p: ['Step months with the arrows or jump back with This Month. Today is highlighted. On a phone the grid becomes a simple agenda list of the days that have something on them.'] },
      { h: 'Booked Events', p: ['Every booking marked Booked or Completed appears on its event date. Tap it to open the booking and work it.'] },
      { h: 'Planning Dates', p: ['Add Date drops a holiday, local event, big game, or promotion onto the calendar. The checklist (menu locked, promo created, staffing scheduled, reservations open) shows how ready you are, like 2 of 4. This is the screen you open once a month to see what is coming before it is too late to plan for it.'] }
    ]);
  }
};
