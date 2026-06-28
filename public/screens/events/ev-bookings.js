'use strict';

/* ── Events — Bookings ────────────────────────────────────────────────────────
   The unified bookings pipeline: one record per party, worked cradle to grave
   through Lead -> Quote Sent -> Booked -> Completed / Lost.

   Landing = stat strip + an inline New Booking form + the pipeline table.
   Open a booking and it becomes an "Active Booking" workspace: a live status
   header, a progress rail, stat tiles, and a single stage-driven "work it" zone
   with one big forward action,
   instead of card after card of identical buttons. Send Quote emails the
   customer (the vendor-order mailto pattern). Costs + the P&L are collected at
   the Completed stage, where they actually exist. */

S.EventsBookings = {
  _detailId: null,
  _addDraft: null,
  _viewStep: null,   // a prior step being viewed/edited (null = the live current stage)
  filterStage: '',

  STAGES: ['Lead', 'Quote Sent', 'Booked', 'Completed', 'Lost'],
  STAGE_FLOW: ['Lead', 'Quote Sent', 'Booked', 'Completed'],
  EVENT_TYPES: ['Birthday', 'Corporate', 'Rehearsal Dinner', 'Bridal/Baby Shower', 'Holiday Party', 'Reunion', 'Memorial', 'Buyout', 'Private Dining', 'Catering (Offsite)', 'Other'],
  SOURCES: ['Phone', 'Email', 'Website Form', 'Walk-in', 'Referral', 'OpenTable/Resy', 'Repeat Guest', 'Other'],

  // Color = meaning only: a win (completed) is green, a loss is red, in-flight is neutral.
  stageColor(stage) { return stage === 'Completed' ? 'var(--green)' : stage === 'Lost' ? 'var(--red)' : 'var(--t2)'; },
  // The live accent for the workspace header dot/label.
  stageAccent(stage) { return stage === 'Lost' ? 'var(--red)' : 'var(--green)'; },

  bookings()  { if (!Array.isArray(App.data.bookings)) App.data.bookings = []; return App.data.bookings; },
  rateCards() { if (!Array.isArray(App.data.event_rate_cards)) App.data.event_rate_cards = []; return App.data.event_rate_cards; },
  regulars()  { if (!Array.isArray(App.data.event_regulars)) App.data.event_regulars = []; return App.data.event_regulars; },

  // ── shared visual atoms (the stage-driven workspace language) ────────────
  subLabel(t) { return '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + t + '</div>'; },
  divider()   { return '<div style="border-top:1px solid var(--b2);margin:20px -20px;"></div>'; },
  statTile(label, val, sub, cls) {
    const c = cls === 'warn' ? 'var(--amber)' : cls === 'good' ? 'var(--green)' : cls === 'bad' ? 'var(--red)' : 'var(--t1)';
    return '<div style="flex:1;min-width:120px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:600;line-height:1.1;color:' + c + ';">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + (sub || '&nbsp;') + '</div></div>';
  },

  // ── helpers ────────────────────────────────────────────────────────────────
  isOpen(s) { return s === 'Lead' || s === 'Quote Sent'; },
  title(b)  { return b.event_name || (b.contact_name ? b.contact_name + (b.event_type ? ' - ' + b.event_type : '') : (b.event_type || 'Booking')); },
  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((d - new Date(App.todayLocal() + 'T00:00:00')) / 86400000);
  },
  daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((new Date(App.todayLocal() + 'T00:00:00') - d) / 86400000);
  },

  // The ISO date for a scheduled shift (its Monday week_start + Mon-first day idx).
  _shiftIso(weekStart, day) {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const idx = DAYS.indexOf(day);
    if (idx < 0 || !weekStart) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + idx);
    return App.ymdLocal(d);
  },
  // The staff scheduled AND checked as working this event (Build Schedule). Only
  // these people's labor counts toward the event, so a private party during normal
  // service does not charge the whole day's crew to the event.
  eventStaffShifts(b) {
    if (!b || !b.id || !b.event_date) return [];
    const iso = String(b.event_date).slice(0, 10);
    const out = [];
    ((App.laborData && App.laborData.lc_schedules) || []).forEach(s => {
      (s.shifts || []).forEach(sh => {
        if (sh.event === b.id && this._shiftIso(s.week_start, sh.day) === iso) out.push(Object.assign({}, sh, { _iso: iso }));
      });
    });
    return out;
  },
  // Revenue is the event's own actual revenue (the banquet check). A shift's total
  // cannot be cleanly split for a shared-day event, so it is operator-entered.
  bookingRevenue(b) { return parseFloat(b.actual_revenue) || 0; },
  // Group the event roster by staff: lc_actuals is one row per staff per day, but
  // a person can have more than one event-tagged block that day, so each person is
  // costed once (their logged actual if present, else the sum of their blocks).
  eventStaffByPerson(b) {
    const byStaff = {};
    this.eventStaffShifts(b).forEach(sh => { (byStaff[sh.staff_id] = byStaff[sh.staff_id] || []).push(sh); });
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    return Object.keys(byStaff).map(sid => {
      const blocks = byStaff[sid];
      const act = actuals.find(a => a.staff_id === sid && String(a.date || '').slice(0, 10) === blocks[0]._iso);
      const hrs = act ? (parseFloat(act.hours) || 0) : blocks.reduce((s, sh) => s + (parseFloat(sh.hours) || 0), 0);
      const cost = act ? (parseFloat(act.cost) || (parseFloat(act.hours) || 0) * (parseFloat(act.wage) || 0))
                       : blocks.reduce((s, sh) => s + (parseFloat(sh.cost) || (parseFloat(sh.hours) || 0) * (parseFloat(sh.wage) || 0)), 0);
      return { name: blocks[0].name || '-', hours: hrs, cost: cost, logged: !!act };
    });
  },
  bookingLabor(b) {
    return this.eventStaffByPerson(b).reduce((sum, p) => sum + p.cost, 0);
  },
  DEFAULT_SVC_PCT: 20,
  // The default tax rate comes from the Cash section's sales-tax setting so events
  // quote at the rate the rest of Bar Cop uses; a booking can override it.
  defaultTaxPct() { try { return parseFloat(CashEngine.salesTaxRate()) || 0; } catch (e) { return 0; } },

  // The quote math, one source of truth: an F&B subtotal (the bigger of per-head x
  // headcount or the F&B minimum) plus a service charge and tax on that subtotal.
  quoteParts(b) {
    b = b || {};
    const ph = parseFloat(b.per_head) || 0;
    const party = parseInt(b.party_size) || 0;
    const fbMin = parseFloat(b.fb_minimum) || 0;
    const svcPct = (b.service_charge_pct != null && b.service_charge_pct !== '') ? (parseFloat(b.service_charge_pct) || 0) : this.DEFAULT_SVC_PCT;
    const taxPct = (b.tax_pct != null && b.tax_pct !== '') ? (parseFloat(b.tax_pct) || 0) : this.defaultTaxPct();
    const subtotal = Math.max(ph * party, fbMin);
    const service = subtotal * svcPct / 100;
    const tax = subtotal * taxPct / 100;
    return { ph, party, fbMin, svcPct, taxPct, subtotal, service, tax, total: subtotal + service + tax };
  },
  quoteTotal(b) { return this.quoteParts(b).total; },
  quoteBreakdownHtml(p) {
    const line = (lbl, val, strong) => '<div style="display:flex;justify-content:space-between;gap:16px;padding:' + (strong ? '8px 0 0' : '5px 0') + ';' + (strong ? 'border-top:1px solid var(--b2);margin-top:4px;' : '') + 'font-size:' + (strong ? '14px' : '12px') + ';">'
      + '<span style="color:' + (strong ? 'var(--t1)' : 'var(--t3)') + ';font-weight:' + (strong ? '700' : '400') + ';">' + lbl + '</span>'
      + '<span style="color:' + (strong ? 'var(--gold)' : 'var(--t2)') + ';font-weight:' + (strong ? '800' : '600') + ';">' + App.fmtCurrency(val) + '</span></div>';
    return '<div style="max-width:320px;">'
      + line('F&amp;B Subtotal', p.subtotal)
      + line('Service Charge (' + (p.svcPct || 0) + '%)', p.service)
      + line('Tax (' + (p.taxPct || 0) + '%)', p.tax)
      + line('Quoted Total', p.total, true)
      + '</div>';
  },

  balanceDue(b) {
    const quoted = this.quoteTotal(b);
    const dep = parseFloat(b.deposit_amount) || 0;
    return Math.max(0, quoted - dep);
  },

  // Other active bookings holding the same space on the same day: a double-book risk.
  conflicts(b) {
    if (!b || !b.event_date || !b.space || !String(b.space).trim()) return [];
    const date = String(b.event_date).slice(0, 10);
    const space = String(b.space).trim().toLowerCase();
    return this.bookings().filter(o => o.id !== b.id
      && o.stage !== 'Lost' && o.stage !== 'Completed'
      && String(o.event_date || '').slice(0, 10) === date
      && String(o.space || '').trim().toLowerCase() === space);
  },
  conflictBanner(b) {
    const conf = this.conflicts(b);
    if (!conf.length) return '';
    const hard = b.stage === 'Booked' && conf.some(o => o.stage === 'Booked');
    const col = hard ? 'var(--red)' : 'var(--amber)';
    const names = conf.map(o => esc(this.title(o)) + ' (' + esc(o.stage) + ')').join(', ');
    return '<div style="border:1px solid ' + col + ';background:var(--input);border-radius:6px;padding:11px 14px;margin-bottom:14px;font-size:12px;color:var(--t2);line-height:1.6;">'
      + '<span style="color:' + col + ';font-weight:800;">Double-booking</span> &middot; ' + esc(b.space) + ' is also held on ' + this.fmtDate(b.event_date) + ' by ' + names + '. Move one or confirm the room fits both.</div>';
  },

  // The event-staff roster table (who is charged to this event, and their hours).
  staffingHtml(b) {
    const people = this.eventStaffByPerson(b);
    if (!people.length) return '<div style="font-size:12px;color:var(--t4);">No staff checked for this event yet. In Build Schedule, open each person working it and check "Working ' + esc(this.title(b)) + '."</div>';
    const rows = people.map(p =>
      '<tr><td>' + esc(p.name) + '</td><td>' + p.hours.toFixed(1) + 'h</td><td style="color:var(--t3);">' + (p.logged ? 'logged' : 'scheduled') + '</td><td>' + App.fmtCurrency(p.cost) + '</td></tr>'
    ).join('');
    return '<div class="tbl-wrap"><table class="tbl eb-staff-tbl"><thead><tr><th>Staff</th><th>Hours</th><th>Source</th><th>Cost</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  async patch(id, fields) {
    const list = this.bookings();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    list[i] = Object.assign({}, list[i], fields, { updated_at: new Date().toISOString() });
    await App.putRecord('core', 'booking', list[i]);
    if (this._detailId === id) this.renderDetail(id);
    else this.renderList();
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (App._evBookingFocus) {
      const fid = App._evBookingFocus; App._evBookingFocus = null;
      if (this.bookings().some(b => b.id === fid)) { this.openDetail(fid); return; }
    }
    // A normal landing always shows the pipeline. (Without this, a sticky
    // _detailId re-opened the last booking with no way back to the list.)
    this._detailId = null;
    this.renderList();
  },

  // ── Shared booking-detail fields (inline new form + Edit popup) ───────────
  // Light lead capture: who / what / when. Cost and P&L numbers come later, at
  // the Completed stage. `p` is the id prefix so the inline form and the edit
  // popup never collide.
  fieldsHtml(b, p, compact) {
    const today = App.todayLocal();
    const typeOpts = '<option value="">Select type...</option>' + this.EVENT_TYPES.map(t => '<option' + (b && b.event_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const srcOpts = '<option value="">Select source...</option>' + this.SOURCES.map(s => '<option' + (b && b.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const stageOpts = this.STAGES.map(s => '<option' + ((b && b.stage === s) || (!(b && b.stage) && s === 'Lead') ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const v = x => (x != null && x !== '') ? x : '';
    const C = {
      name:   '<div class="f"><label>Event Name</label><input type="text" id="' + p + '-name" value="' + esc(b?.event_name || '') + '" placeholder="Smith Rehearsal Dinner"/></div>',
      cname:  '<div class="f"><label>Contact Name</label><input type="text" id="' + p + '-cname" value="' + esc(b?.contact_name || '') + '" placeholder="Jen Mitchell"/></div>',
      phone:  '<div class="f"><label>Phone</label><input type="tel" id="' + p + '-phone" value="' + esc(b?.contact_phone || '') + '" placeholder="Optional"/></div>',
      email:  '<div class="f"><label>Email</label><input type="email" id="' + p + '-email" value="' + esc(b?.contact_email || '') + '" placeholder="For the quote"/></div>',
      type:   '<div class="f"><label>Event Type</label><select id="' + p + '-type" class="form-input">' + typeOpts + '</select></div>',
      source: '<div class="f"><label>Source</label><select id="' + p + '-source" class="form-input">' + srcOpts + '</select></div>',
      stage:  '<div class="f"><label>Stage</label><select id="' + p + '-stage" class="form-input">' + stageOpts + '</select></div>',
      date:   '<div class="f"><label>Event Date</label><input type="date" id="' + p + '-date" value="' + esc(b?.event_date || '') + '"/></div>',
      time:   '<div class="f"><label>Time</label><input type="text" id="' + p + '-time" value="' + esc(b?.event_time || '') + '" placeholder="6:00 PM"/></div>',
      party:  '<div class="f"><label>Party Size</label><input type="number" id="' + p + '-party" value="' + v(b?.party_size) + '"/></div>',
      space:  '<div class="f"><label>Space</label><input type="text" id="' + p + '-space" value="' + esc(b?.space || '') + '" placeholder="Private room"/></div>',
      recv:   '<div class="f"><label>Date Received</label><input type="date" id="' + p + '-recv" value="' + esc(b?.date_received || today) + '"/></div>',
      notes:  '<div class="f" style="width:100%;"><label>Requests / Notes</label><textarea id="' + p + '-req" class="notes-ta" rows="2" placeholder="What they asked for, follow-up notes, why it closed.">' + esc(b?.requests || '') + '</textarea></div>'
    };
    // Compact (the inline landing form): all data cells on two rows; notes below.
    if (compact) {
      // Event Name leads (wider); all data cells fit on two rows, notes below.
      const nameW = '<div class="f" style="flex:2 1 170px;"><label>Event Name</label><input type="text" id="' + p + '-name" value="' + esc(b?.event_name || '') + '" placeholder="Smith Rehearsal Dinner"/></div>';
      return '<div class="form-row eb-crow" style="gap:12px;flex-wrap:wrap;">' + nameW + C.cname + C.phone + C.email + C.date + C.time + '</div>'
        + '<div class="form-row eb-crow" style="gap:12px;flex-wrap:wrap;">' + C.party + C.type + C.space + C.recv + C.source + C.stage + '</div>'
        + C.notes;
    }
    // Default (the Edit popup): narrow-form reflows these into a clean 2-up grid,
    // six cells per column. Event Name takes the first spot; Notes is full-width.
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">' + C.name + C.cname + C.phone + C.email + C.type + C.source + C.stage + C.date + C.time + C.party + C.space + C.recv + '</div>'
      + C.notes;
  },

  collect(p) {
    const g = x => document.getElementById(p + '-' + x);
    return {
      event_name:    g('name')?.value.trim() || '',
      contact_name:  g('cname')?.value.trim() || '',
      contact_phone: g('phone')?.value.trim() || '',
      contact_email: g('email')?.value.trim() || '',
      event_type:    g('type')?.value || '',
      source:        g('source')?.value || '',
      stage:         g('stage')?.value || 'Lead',
      event_date:    g('date')?.value || '',
      event_time:    g('time')?.value.trim() || '',
      party_size:    parseInt(g('party')?.value) || null,
      space:         g('space')?.value.trim() || '',
      date_received: g('recv')?.value || App.todayLocal(),
      requests:      g('req')?.value.trim() || ''
    };
  },

  // ── Landing: stat strip + inline New Booking form + pipeline ──────────────
  renderList() {
    this._detailId = null;
    const all = this.bookings();

    const open  = all.filter(b => this.isOpen(b.stage));
    const stale = open.filter(b => { const d = this.daysSince(b.date_received); return d != null && d >= 3; });
    const booked = all.filter(b => b.stage === 'Booked');
    const bookedSoon = booked.filter(b => { const d = this.daysUntil(b.event_date); return d != null && d >= 0 && d <= 30; });
    const pipelineVal = open.reduce((s, b) => s + this.quoteTotal(b), 0);
    const depositsDue = booked.filter(b => !b.deposit_paid_date).reduce((s, b) => s + (parseFloat(b.deposit_amount) || 0), 0);

    const stat = (label, val, color) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Open Leads', String(open.length), open.length ? '' : 'var(--t3)')
      + stat('Stale (3+ Days)', String(stale.length), stale.length ? 'var(--amber)' : '')
      + stat('Pipeline Value', App.fmtCurrency(pipelineVal))
      + stat('Booked, Next 30d', String(bookedSoon.length))
      + stat('Deposits Due', App.fmtCurrency(depositsDue), depositsDue ? 'var(--amber)' : '')
      + '</div></div>';

    // Inline New Booking form (persists in-progress via _addDraft). Buttons below
    // the card, bottom-left.
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('eb-new-booking', 'New Booking', '<button class="btn btn-ghost btn-sm no-print" id="eb-worksheet" type="button">Worksheet</button>')
      + '<div class="collapse-body"><div id="eb-add-form">' + this.fieldsHtml(this._addDraft, 'ebn', true) + '</div></div></div>'
      + '<div data-collapse-group="eb-new-booking" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="eb-add">Create Booking</button>'
      + '<button class="btn btn-ghost" id="eb-startover">Start Over</button>'
      + '<span id="eb-add-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>';

    let listSection;
    if (all.length === 0) {
      listSection = '<div style="font-size:12px;color:var(--t3);padding:6px 2px;">Log your first booking above. Your pipeline shows here as you add them.</div>';
    } else {
      const chipDefs = [{ v: '', label: 'All' }].concat(this.STAGES.map(s => ({ v: s, label: s })));
      const chips = App.filterChips(this.filterStage, chipDefs, 'eb-stage-chip');
      const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div></div>';

      const list = (this.filterStage ? all.filter(b => b.stage === this.filterStage) : all)
        .slice().sort((a, b) => (b.date_received || b.event_date || '').localeCompare(a.date_received || a.event_date || ''));

      const rows = list.slice(0, App.listLimit('core', 'booking')).map(b => {
        const dUntil = this.daysUntil(b.event_date);
        const isStale = this.isOpen(b.stage) && (this.daysSince(b.date_received) >= 3);
        const qt = this.quoteTotal(b);
        const money = b.stage === 'Completed' ? App.fmtCurrency(this.bookingRevenue(b))
          : (qt ? App.fmtCurrency(qt) : '-');
        const dep = b.stage === 'Booked'
          ? (b.deposit_paid_date ? '<span style="color:var(--green);">Deposit paid</span>'
              : (b.deposit_amount ? '<span style="color:var(--amber);">' + App.fmtCurrency(b.deposit_amount) + ' due</span>' : '<span style="color:var(--t3);">-</span>'))
          : '<span style="color:var(--t3);">-</span>';
        return '<tr class="eb-row" data-id="' + esc(b.id) + '" style="cursor:pointer;">'
          + '<td><div class="val" style="font-weight:600;">' + esc(this.title(b)) + '</div>'
          +   (b.contact_name && b.event_name ? '<div style="font-size:10px;color:var(--t3);">' + esc(b.contact_name) + '</div>' : '') + '</td>'
          + '<td>' + esc(b.event_type || '-') + '</td>'
          + '<td>' + (b.event_date ? this.fmtDate(b.event_date) + (dUntil != null && dUntil >= 0 && dUntil <= 30 && b.stage === 'Booked' ? ' <span style="color:var(--t3);font-size:10px;">(' + dUntil + 'd)</span>' : '') : (isStale ? '<span style="color:var(--amber);font-size:11px;">stale</span>' : '-')) + '</td>'
          + '<td>' + (b.party_size ? b.party_size : '-') + '</td>'
          + '<td>' + money + '</td>'
          + '<td>' + dep + '</td>'
          + '<td style="color:' + this.stageColor(b.stage) + ';font-weight:700;">' + esc(b.stage || '') + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm eb-view" data-id="' + esc(b.id) + '">Open</button>'
          +   '<button class="btn btn-danger btn-sm eb-del" data-id="' + esc(b.id) + '">Delete</button></div></td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No bookings in this stage.</td></tr>';

      listSection = headRow
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Event</th><th>Type</th><th>Event Date</th><th>Party</th><th>Quote / Revenue</th><th>Deposit</th><th>Stage</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('core', 'booking', list, !!this.filterStage);
    }

    this.container.innerHTML = '<div class="screen">' + statStrip + addCard + listSection + '</div>';
    this.wireList();
  },

  wireList() {
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', e => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    // Keep the inline add form's in-progress entry alive across re-renders.
    document.getElementById('eb-add-form')?.addEventListener('input', () => { this._addDraft = this.collect('ebn'); });
    document.getElementById('eb-add')?.addEventListener('click', () => this.addBooking());
    document.getElementById('eb-startover')?.addEventListener('click', () => { this._addDraft = null; this.renderList(); });
    this.container.querySelectorAll('.eb-stage-chip').forEach(b =>
      b.addEventListener('click', () => { this.filterStage = b.dataset.v; this.renderList(); }));
    document.getElementById('eb-worksheet')?.addEventListener('click', () => this.worksheet());
    this.container.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.renderList())));
    this.container.querySelectorAll('.eb-row, .eb-view').forEach(el =>
      el.addEventListener('click', ev => {
        if (ev.target.closest('.eb-del')) return;
        const id = el.dataset.id;
        if (id) this.openDetail(id);
      }));
    this.container.querySelectorAll('.eb-del').forEach(b =>
      b.addEventListener('click', async ev => {
        ev.stopPropagation();
        const ok = await App.confirmDelete();
        if (!ok) return;
        await App.removeRecord('core', 'booking', b.dataset.id);
        this.renderList();
      }));
  },

  async addBooking() {
    const rec = this.collect('ebn');
    if (!rec.event_name && !rec.contact_name) {
      const e = document.getElementById('eb-add-err'); if (e) { e.textContent = 'Enter an event name or a contact name.'; e.style.display = 'inline'; }
      return;
    }
    rec.id = App.uid();
    rec.created_at = new Date().toISOString();
    rec.updated_at = rec.created_at;
    await App.putRecord('core', 'booking', rec);
    this._addDraft = null;
    this.openDetail(rec.id);   // jump straight into the new booking's workspace
  },

  // ── Active Booking workspace ─────────────────────────────────────────────
  openDetail(id) {
    this._detailId = id;
    this._viewStep = null;
    App.pushView(() => this.renderDetail(id));   // floating back returns to the pipeline
  },

  // The lifecycle rail. Every reached node (at or before the current stage) is
  // clickable to jump back and edit that step, like the closing-shift stepper;
  // the glow rides whichever step you are viewing. Same node design, just clickable.
  progressRail(b, viewStep) {
    const flow = this.STAGE_FLOW;
    const lost = b.stage === 'Lost';
    const cur = flow.indexOf(b.stage);
    const viewIdx = lost ? -1 : flow.indexOf(viewStep);
    const node = (s, i) => {
      const reached = !lost && i <= cur;
      const done = !lost && i < cur;
      const here = !lost && i === viewIdx;
      const fill = reached ? 'var(--green)' : 'var(--input)';
      const bord = reached ? 'var(--green)' : 'var(--b1)';
      const ink = reached ? 'var(--bg)' : 'var(--t4)';
      const glow = here ? 'box-shadow:0 0 0 4px rgba(81,138,121,0.28);' : '';
      const lbl = here ? 'var(--t1)' : reached ? 'var(--t2)' : 'var(--t4)';
      const wrap = 'display:flex;flex-direction:column;align-items:center;gap:7px;flex:0 0 auto;' + (reached ? 'cursor:pointer;' : '');
      const attrs = reached ? ' class="eb-step" data-step="' + esc(s) + '"' : '';
      return '<div' + attrs + ' style="' + wrap + '">'
        + '<span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:' + fill + ';border:1px solid ' + bord + ';color:' + ink + ';' + glow + '">' + (done ? '&#10003;' : (i + 1)) + '</span>'
        + '<span style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:' + lbl + ';text-align:center;">' + esc(s) + '</span></div>';
    };
    const conn = i => '<div style="flex:1;height:2px;background:' + (!lost && i <= cur ? 'var(--green)' : 'var(--b1)') + ';margin-top:13px;min-width:16px;"></div>';
    const parts = [];
    flow.forEach((s, i) => { if (i) parts.push(conn(i)); parts.push(node(s, i)); });
    return '<div style="display:flex;align-items:flex-start;max-width:520px;">' + parts.join('') + '</div>';
  },

  statsRow(b, dispStage) {
    const stage = dispStage || b.stage;
    const t = [];
    if (stage === 'Lead' || stage === 'Quote Sent') {
      const ds = this.daysSince(b.date_received);
      const qt = this.quoteTotal(b);
      t.push(this.statTile('Quoted Total', qt ? App.fmtCurrency(qt) : '-', 'all in, service and tax'));
      t.push(this.statTile('Per Head', b.per_head ? App.fmtCurrency(b.per_head) : '-', b.party_size ? b.party_size + ' guests' : 'set the headcount'));
      t.push(this.statTile('Party Size', b.party_size ? String(b.party_size) : '-', 'guests'));
      t.push(this.statTile('Days Open', ds != null ? String(ds) : '-', ds != null && ds >= 3 ? 'follow up' : 'since the inquiry', ds != null && ds >= 3 ? 'warn' : ''));
    } else if (stage === 'Booked') {
      const dU = this.daysUntil(b.event_date);
      const cd = dU == null ? '-' : dU < 0 ? 'past' : dU === 0 ? 'today' : String(dU);
      const cdSub = dU == null ? 'no date set' : dU < 0 ? 'event date passed' : dU === 0 ? 'event is today' : 'days out';
      const bal = this.balanceDue(b);
      t.push(this.statTile('Countdown', cd, cdSub, dU != null && dU >= 0 && dU <= 7 ? 'warn' : ''));
      t.push(this.statTile('Quoted Total', App.fmtCurrency(this.quoteTotal(b)), 'all in, service and tax'));
      t.push(this.statTile('Deposit', b.deposit_paid_date ? 'Paid' : (b.deposit_amount ? App.fmtCurrency(b.deposit_amount) : '-'), b.deposit_paid_date ? 'in hand' : (b.deposit_amount ? 'still due' : 'none set'), b.deposit_paid_date ? 'good' : (b.deposit_amount ? 'warn' : '')));
      t.push(this.statTile('Balance Due', App.fmtCurrency(bal), b.balance_paid_date ? 'paid in full' : 'on event day', bal > 0 ? '' : 'good'));
    } else if (stage === 'Completed') {
      const rev = this.bookingRevenue(b);
      const labor = this.bookingLabor(b);
      const cost = (parseFloat(b.event_food_cost) || 0) + (parseFloat(b.event_bar_cost) || 0) + (parseFloat(b.event_other_cost) || 0) + labor;
      const margin = rev - cost;
      const mp = rev > 0 ? margin / rev * 100 : null;
      t.push(this.statTile('Revenue', App.fmtCurrency(rev), 'actual entered'));
      t.push(this.statTile('Margin', App.fmtCurrency(margin), 'after all costs', margin >= 0 ? 'good' : 'bad'));
      t.push(this.statTile('Margin %', mp != null ? mp.toFixed(0) + '%' : '-', '30% is a solid event', mp != null && mp >= 30 ? 'good' : mp != null ? 'warn' : ''));
      t.push(this.statTile('Labor', App.fmtCurrency(labor), this.eventStaffShifts(b).length ? 'checked event staff' : 'check staff in schedule'));
    }
    return t.length ? '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + t.join('') + '</div>' : '';
  },

  renderDetail(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) { this._detailId = null; this.renderList(); return; }
    this._detailId = id;
    if (this.actions) this.actions.innerHTML = '';
    const stage = b.stage || 'Lead';
    const accent = this.stageAccent(stage);
    const live = stage === 'Lead' || stage === 'Quote Sent' || stage === 'Booked';
    const readout = { 'Lead': 'Build a quote and send it.', 'Quote Sent': 'Follow up. Mark it booked when they confirm.', 'Booked': 'Collect the deposit and lock in the staff.', 'Completed': 'Close out the numbers below.', 'Lost': 'Closed. Reopen it to put it back in play.' }[stage] || '';
    // viewStep: the step the operator is looking at. Defaults to the live stage;
    // clicking an earlier node in the rail opens that step to edit without changing
    // the booking's real stage.
    const curIdx = this.STAGE_FLOW.indexOf(stage);
    let viewStep = stage, viewingPast = false;
    if (this._viewStep && curIdx >= 0) {
      const vi = this.STAGE_FLOW.indexOf(this._viewStep);
      if (vi >= 0 && vi < curIdx) { viewStep = this._viewStep; viewingPast = true; }
      else this._viewStep = null;
    }

    // ── Card 1: The Booking (header + progress + stat tiles + contact) ──
    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:' + accent + ';' + (live ? 'box-shadow:0 0 8px ' + accent + ';' : '') + '"></span>'
        + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:' + accent + ';">' + esc(stage) + '</span></div>'
        + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(this.title(b)) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + esc(b.event_type || '') + (b.event_date ? ' &middot; ' + this.fmtDate(b.event_date) : '') + (b.party_size ? ' &middot; ' + b.party_size + ' guests' : '') + (b.contact_name ? ' &middot; ' + esc(b.contact_name) : '') + '</div>'
        + (readout ? '<div style="font-size:13px;color:' + accent + ';font-weight:600;margin-top:8px;">' + esc(readout) + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" id="eb-edit">Edit Details</button>'
        + '<button class="btn btn-ghost btn-sm eb-runsheet-open">Run Sheet</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-q-pdf">Quote PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-agreement">Agreement</button>'
      + '</div></div>';

    const dispRow = (label, val) => '<div class="f"><label>' + label + '</label><div style="font-size:13px;color:var(--t1);">' + (val ? esc(val) : '<span style="color:var(--t4);">-</span>') + '</div></div>';
    const contact = this.subLabel('Contact and Event')
      + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">' + dispRow('Phone', b.contact_phone) + dispRow('Email', b.contact_email) + dispRow('Source', b.source) + dispRow('Time', b.event_time) + dispRow('Space', b.space) + '</div>'
      + (b.requests ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;">' + esc(b.requests) + '</div>' : '');

    const statsRow = this.statsRow(b, viewStep);
    let card1 = '<div class="card">' + header
      + this.divider() + this.subLabel('Progress') + this.progressRail(b, viewStep)
      + (statsRow ? this.divider() + this.subLabel('This Booking') + statsRow : '')
      + this.divider() + contact;
    if (stage === 'Lost' && b.lost_reason) card1 += this.divider() + this.subLabel('Why It Closed') + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">' + esc(b.lost_reason) + '</div>';
    card1 += '</div>';

    // ── Card 2: Work It (driven by the viewed step) ──
    let card2 = '';
    if (viewStep === 'Lead' || viewStep === 'Quote Sent') {
      const rcs = this.rateCards();
      let rcPicker;
      if (rcs.length && rcs.length <= 6) {
        rcPicker = '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + rcs.map(r =>
          '<button type="button" class="eb-rc-pill" data-rc="' + esc(r.id) + '" style="padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;'
          + (b.rate_card_id === r.id ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);' : 'background:var(--input);border:1px solid var(--b1);color:var(--t2);')
          + '">' + esc(r.package_name || '') + (r.per_head ? ' &middot; ' + App.fmtCurrency(r.per_head) + '/head' : '') + '</button>').join('') + '</div>';
      } else if (rcs.length) {
        rcPicker = '<select id="eb-q-rc" class="form-input" style="max-width:300px;"><option value="">Pick a package (optional)</option>' + rcs.map(r => '<option value="' + esc(r.id) + '"' + (b.rate_card_id === r.id ? ' selected' : '') + '>' + esc(r.package_name || '') + '</option>').join('') + '</select>';
      } else {
        rcPicker = '<div style="font-size:12px;color:var(--t3);">No packages yet. Build them on Pricing, or just set the price below.</div>';
      }
      card2 = '<div class="card form-card">' + this.subLabel('Build the Quote')
        + '<div style="margin-bottom:16px;">' + rcPicker + '</div>'
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:130px;flex-shrink:0;"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre eb-q-in" type="number" id="eb-q-ph" value="' + (b.per_head != null && b.per_head !== 0 ? b.per_head : '') + '" step="0.01"/></div></div>'
          + '<div class="f" style="width:100px;flex-shrink:0;"><label>Guests</label><input class="form-input eb-q-in" type="number" id="eb-q-party" value="' + (b.party_size != null && b.party_size !== 0 ? b.party_size : '') + '"/></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>F&amp;B Minimum</label><div class="fw"><span class="pre">$</span><input class="form-input pre eb-q-in" type="number" id="eb-q-fb" value="' + (b.fb_minimum != null && b.fb_minimum !== 0 ? b.fb_minimum : '') + '"/></div></div>'
          + '<div class="f" style="width:120px;flex-shrink:0;"><label>Service Charge</label><div class="fw"><input class="form-input suf eb-q-in" type="number" id="eb-q-svc" value="' + (b.service_charge_pct != null && b.service_charge_pct !== '' ? b.service_charge_pct : this.DEFAULT_SVC_PCT) + '" step="0.5"/><span class="suf">%</span></div></div>'
          + '<div class="f" style="width:110px;flex-shrink:0;"><label>Tax</label><div class="fw"><input class="form-input suf eb-q-in" type="number" id="eb-q-tax" value="' + (b.tax_pct != null && b.tax_pct !== '' ? b.tax_pct : this.defaultTaxPct()) + '" step="0.01"/><span class="suf">%</span></div></div>'
        + '</div>'
        + '<div id="eb-q-breakdown" style="margin-top:16px;">' + this.quoteBreakdownHtml(this.quoteParts(b)) + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-calc">Catering Calculator</button>'
        + '</div></div>';
    } else if (viewStep === 'Booked') {
      const bal = this.balanceDue(b);
      card2 = '<div class="card form-card">' + this.subLabel('Collect the Deposit')
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:160px;flex-shrink:0;"><label>Deposit Amount</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-dep" value="' + (b.deposit_amount != null && b.deposit_amount !== 0 ? b.deposit_amount : '') + '"/></div></div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
            + '<button class="btn btn-primary btn-sm" id="eb-dep-save">Save Deposit</button>'
            + (b.deposit_amount && !b.deposit_paid_date ? '<button class="btn btn-ghost btn-sm" id="eb-dep-paid">Mark Deposit Paid</button>' : '')
            + (!b.balance_paid_date && bal > 0 ? '<button class="btn btn-ghost btn-sm" id="eb-bal-paid">Mark Balance Paid</button>' : '')
          + '</div>'
        + '</div>'
        + this.divider() + this.subLabel('Staffing')
        + this.staffingHtml(b)
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-staff">Schedule Staff for this Event</button></div>'
        + this.divider() + this.subLabel('Run Sheet')
        + this.runSheetReadout(b)
        + '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm eb-runsheet-open">Open Run Sheet</button><button class="btn btn-ghost btn-sm eb-runsheet-print">Print Run Sheet</button></div>'
        + '</div>';
    } else if (viewStep === 'Completed') {
      card2 = '<div class="card form-card">' + this.subLabel('Close Out the P&amp;L')
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:170px;flex-shrink:0;"><label>Actual Revenue</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-actual" value="' + (b.actual_revenue != null && b.actual_revenue !== 0 ? b.actual_revenue : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Food Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-food" value="' + (b.event_food_cost != null && b.event_food_cost !== 0 ? b.event_food_cost : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Bar Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-bar" value="' + (b.event_bar_cost != null && b.event_bar_cost !== 0 ? b.event_bar_cost : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Other Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-other" value="' + (b.event_other_cost != null && b.event_other_cost !== 0 ? b.event_other_cost : '') + '"/></div></div>'
        + '</div>'
        + this.divider() + this.subLabel('Event Staff') + this.staffingHtml(b)
        + '</div>';
    }

    const viewBanner = viewingPast
      ? '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--t1);">Editing your ' + esc(viewStep) + ' step. Save your changes, then Back to ' + esc(stage) + '.</div>'
      : '';
    const html = '<div class="screen">' + this.conflictBanner(b) + card1 + viewBanner + card2 + this.actionBar(stage, viewStep, viewingPast) + '</div>';
    this.container.innerHTML = html;
    this.wireDetail(b);
  },

  // One big forward action for the live stage, plus the quiet secondaries. When
  // viewing a prior step, show that step's save and a way back instead.
  actionBar(stage, viewStep, viewingPast) {
    const act = [];
    if (viewingPast) {
      if (viewStep === 'Lead' || viewStep === 'Quote Sent') act.push('<button class="btn btn-primary" id="eb-q-save">Save Quote</button>');
      act.push('<button class="btn btn-ghost" id="eb-viewback">Back to ' + esc(stage) + '</button>');
      return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' + act.join('')
        + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div>';
    }
    if (stage === 'Lead') {
      act.push('<button class="btn btn-primary" id="eb-q-save">Save Quote</button>');
      act.push('<button class="btn btn-ghost" id="eb-send">Email Quote</button>');
    }
    if (stage === 'Quote Sent') {
      act.push('<button class="btn btn-primary eb-stage" data-to="Booked">Mark Booked</button>');
      act.push('<button class="btn btn-ghost" id="eb-q-update">Update Quote</button>');
      act.push('<button class="btn btn-ghost" id="eb-resend">Resend Quote</button>');
    }
    if (stage === 'Booked')      act.push('<button class="btn btn-primary btn-lg eb-stage" data-to="Completed">Mark Completed</button>');
    if (stage === 'Completed') {
      act.push('<button class="btn btn-primary" id="eb-pl-save">Save P&amp;L</button>');
      act.push('<button class="btn btn-ghost eb-stage" data-to="Booked">Reopen</button>');
    }
    if (stage === 'Lost')        act.push('<button class="btn btn-ghost eb-stage" data-to="Lead">Reopen</button>');
    if (stage !== 'Lost' && stage !== 'Completed') act.push('<button class="btn btn-ghost" id="eb-lost" style="color:var(--red);">Mark Lost</button>');
    return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' + act.join('')
      + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div>';
  },

  collectQuote() {
    const g = id => document.getElementById(id);
    const f = {};
    if (g('eb-q-ph'))    f.per_head = parseFloat(g('eb-q-ph').value) || 0;
    if (g('eb-q-party')) f.party_size = parseInt(g('eb-q-party').value) || null;
    if (g('eb-q-fb'))    f.fb_minimum = parseFloat(g('eb-q-fb').value) || 0;
    if (g('eb-q-svc'))   f.service_charge_pct = (g('eb-q-svc').value !== '') ? (parseFloat(g('eb-q-svc').value) || 0) : this.DEFAULT_SVC_PCT;
    if (g('eb-q-tax'))   f.tax_pct = (g('eb-q-tax').value !== '') ? (parseFloat(g('eb-q-tax').value) || 0) : this.defaultTaxPct();
    const cur = this.bookings().find(x => x.id === this._detailId) || {};
    f.quoted_total = Math.round(this.quoteParts(Object.assign({}, cur, f)).total);
    return f;
  },

  // Live recompute of the breakdown as the operator types in the quote fields.
  renderQuoteBreakdown() {
    const el = document.getElementById('eb-q-breakdown');
    if (!el) return;
    const cur = this.bookings().find(x => x.id === this._detailId) || {};
    el.innerHTML = this.quoteBreakdownHtml(this.quoteParts(Object.assign({}, cur, this.collectQuote())));
  },

  applyRateCard(id, rcId) {
    const b = this.bookings().find(x => x.id === id);
    const cur = (b && b.rate_card_id === rcId) ? '' : rcId;   // tap the active pill again to clear it
    const rc = this.rateCards().find(r => r.id === cur);
    const fields = { rate_card_id: cur };
    if (rc) {
      if (rc.per_head != null) fields.per_head = rc.per_head;
      if (rc.fb_minimum != null) fields.fb_minimum = rc.fb_minimum;
    }
    fields.quoted_total = Math.round(this.quoteParts(Object.assign({}, b, fields)).total);
    this.patch(id, fields);
  },

  wireDetail(b) {
    const id = b.id;
    // Clickable lifecycle rail: jump back to a reached step to edit it.
    this.container.querySelectorAll('.eb-step').forEach(el => el.addEventListener('click', () => {
      const step = el.dataset.step;
      this._viewStep = (step === b.stage) ? null : step;
      this.renderDetail(id);
    }));
    document.getElementById('eb-viewback')?.addEventListener('click', () => { this._viewStep = null; this.renderDetail(id); });
    document.getElementById('eb-edit')?.addEventListener('click', () => this.showForm(id));
    document.getElementById('eb-q-pdf')?.addEventListener('click', () => this.quotePDF(this.bookings().find(x => x.id === id)));
    document.getElementById('eb-agreement')?.addEventListener('click', () => this.agreementModal(id));
    // Quote
    this.container.querySelectorAll('.eb-rc-pill').forEach(p => p.addEventListener('click', () => this.applyRateCard(id, p.dataset.rc)));
    document.getElementById('eb-q-rc')?.addEventListener('change', e => this.applyRateCard(id, e.target.value));
    document.getElementById('eb-q-save')?.addEventListener('click', () => this.patch(id, this.collectQuote()));
    document.getElementById('eb-q-update')?.addEventListener('click', () => this.patch(id, this.collectQuote()));
    document.getElementById('eb-q-calc')?.addEventListener('click', () => this.quoteCalc(id));
    this.container.querySelectorAll('.eb-q-in').forEach(el => el.addEventListener('input', () => this.renderQuoteBreakdown()));
    // Money
    document.getElementById('eb-dep-save')?.addEventListener('click', () => this.patch(id, { deposit_amount: parseFloat(document.getElementById('eb-dep')?.value) || 0 }));
    document.getElementById('eb-dep-paid')?.addEventListener('click', () => this.patch(id, { deposit_amount: parseFloat(document.getElementById('eb-dep')?.value) || (parseFloat(b.deposit_amount) || 0), deposit_paid_date: App.todayLocal() }));
    document.getElementById('eb-bal-paid')?.addEventListener('click', () => this.patch(id, { balance_paid_date: App.todayLocal() }));
    // Staffing
    document.getElementById('eb-staff')?.addEventListener('click', () => { App._eventStaffTag = b.event_name || this.title(b); App._eventStaffDate = b.event_date || ''; App.openScreen('lc-build-schedule'); });
    this.container.querySelectorAll('.eb-runsheet-open').forEach(el => el.addEventListener('click', () => this.runSheet(id)));
    this.container.querySelectorAll('.eb-runsheet-print').forEach(el => el.addEventListener('click', () => this.printRunSheet(this.bookings().find(x => x.id === id))));
    // Event P&L
    document.getElementById('eb-pl-save')?.addEventListener('click', () => {
      const f = {
        event_food_cost:  parseFloat(document.getElementById('eb-pl-food')?.value) || 0,
        event_bar_cost:   parseFloat(document.getElementById('eb-pl-bar')?.value) || 0,
        event_other_cost: parseFloat(document.getElementById('eb-pl-other')?.value) || 0
      };
      const actEl = document.getElementById('eb-pl-actual');
      if (actEl) f.actual_revenue = parseFloat(actEl.value) || 0;
      this.patch(id, f);
    });
    // Forward actions
    document.getElementById('eb-send')?.addEventListener('click', () => this.sendQuote(id));
    document.getElementById('eb-resend')?.addEventListener('click', () => this.sendQuote(id, true));
    document.getElementById('eb-lost')?.addEventListener('click', () => this.markLost(id));
    this.container.querySelectorAll('.eb-stage').forEach(btn => btn.addEventListener('click', () => this.changeStage(id, btn.dataset.to)));
    document.getElementById('eb-detail-del')?.addEventListener('click', async () => {
      const ok = await App.confirmDelete();
      if (!ok) return;
      await App.removeRecord('core', 'booking', id);
      this._detailId = null;
      App.goBack ? App.goBack() : this.renderList();
    });
  },

  async changeStage(id, to) {
    const fields = { stage: to };
    const b = this.bookings().find(x => x.id === id);
    if (to === 'Booked' && b && !b.date_received) fields.date_received = App.todayLocal();
    await this.patch(id, fields);
    // No per-booking scoreboard credit by design: event revenue flows into This
    // Week (catering) and the Revenue Audit, where the engine measures real
    // weekly improvement.
  },

  // Mark Lost with a captured reason (App.confirm only returns a boolean).
  markLost(id) {
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Mark This Booking Lost</div>'
      + '<div class="f" style="width:100%;"><label>Reason (optional)</label><input type="text" id="eb-lost-reason" placeholder="Booked elsewhere, date conflict, over budget"/></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="eb-lost-save">Mark Lost</button>'
      +   '<button class="btn btn-ghost" id="eb-lost-cancel">Cancel</button></div></div>';
    App.openModal(html, { id: 'eb-lost-modal', maxWidth: 520, noClose: true });
    document.getElementById('eb-lost-cancel')?.addEventListener('click', () => App.closeModal('eb-lost-modal'));
    document.getElementById('eb-lost-save')?.addEventListener('click', async () => {
      const reason = document.getElementById('eb-lost-reason')?.value.trim() || '';
      App.closeModal('eb-lost-modal');
      await this.patch(id, { stage: 'Lost', lost_reason: reason });
    });
  },

  // ── Send Quote by email (the vendor-order mailto pattern) ────────────────
  buildQuoteMailto(b) {
    const barName = (App.data && App.data.settings && App.data.settings.bar_name) || 'our team';
    const to = b.contact_email || '';
    const subj = 'Quote from ' + barName + (b.event_name ? ' - ' + b.event_name : '');
    const L = [];
    L.push('Hi' + (b.contact_name ? ' ' + b.contact_name : '') + ',');
    L.push('');
    L.push('Thanks for thinking of us. Here is your quote' + (b.event_type ? ' for your ' + b.event_type.toLowerCase() : '') + ':');
    L.push('');
    if (b.event_date)  L.push('Date: ' + this.fmtDate(b.event_date) + (b.event_time ? ' at ' + b.event_time : ''));
    if (b.party_size)  L.push('Party size: ' + b.party_size + ' guests');
    if (b.space)       L.push('Space: ' + b.space);
    const p = this.quoteParts(b);
    if (b.per_head)    L.push('Per head: ' + App.fmtCurrency(b.per_head) + (b.party_size ? ' x ' + b.party_size + ' guests' : ''));
    if (b.fb_minimum)  L.push('Food and beverage minimum: ' + App.fmtCurrency(b.fb_minimum));
    L.push('Food and beverage subtotal: ' + App.fmtCurrency(p.subtotal));
    if (p.svcPct) L.push('Service charge (' + p.svcPct + '%): ' + App.fmtCurrency(p.service));
    if (p.taxPct) L.push('Tax (' + p.taxPct + '%): ' + App.fmtCurrency(p.tax));
    L.push('Quoted total: ' + App.fmtCurrency(p.total));
    if (b.deposit_amount) L.push('Deposit to confirm: ' + App.fmtCurrency(b.deposit_amount));
    L.push('');
    L.push('Let me know and we will get you on the calendar.');
    L.push('');
    L.push(barName);
    return 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(L.join('\n'));
  },

  async sendQuote(id, resend) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    if (!b.contact_email) {
      const go = await App.confirm({ title: 'Add an email first', message: 'A quote goes out by email. Add the customer email on the booking, then send it.', confirmText: 'Edit Details', cancelText: 'Cancel' });
      if (go) this.showForm(id);
      return;
    }
    const fields = this.collectQuote();
    if (!resend) fields.stage = 'Quote Sent';
    await this.patch(id, fields);
    const updated = this.bookings().find(x => x.id === id) || b;
    window.location.href = this.buildQuoteMailto(updated);
  },

  // In-place catering calculator (no navigating away): price a per-head number to
  // hit a target food cost, then apply it straight to the quote.
  quoteCalc(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    const wage = (S.EventsPricing && S.EventsPricing.defaultWage) ? S.EventsPricing.defaultWage() : 13;
    const tgt = (App.MENU_TARGET_COST_PCT && App.MENU_TARGET_COST_PCT.catering) || 28;
    const fld = (lbl, fid, val, pre, suf) =>
      '<div class="f"><label>' + lbl + '</label><div class="fw">' + (pre ? '<span class="pre">' + pre + '</span>' : '')
      + '<input class="form-input' + (pre ? ' pre' : suf ? ' suf' : '') + '" type="number" id="' + fid + '" value="' + (val != null ? val : '') + '" step="0.01"/>' + (suf ? '<span class="suf">' + suf + '</span>' : '') + '</div></div>';
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Catering Calculator</div>'
      + '<div class="form-grid">'
        + fld('Guest Count', 'qc-guests', b.party_size || '')
        + fld('Food Cost / Head', 'qc-food', '', '$')
        + fld('Bar Cost / Head', 'qc-bar', '', '$')
        + fld('Staff Hours', 'qc-hrs', '')
        + fld('Avg Staff Wage', 'qc-wage', wage, '$')
        + fld('Other Costs', 'qc-other', '', '$')
        + fld('Target Food Cost %', 'qc-tgt', tgt, null, '%')
      + '</div>'
      + '<div id="qc-result" style="margin-top:14px;"></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="qc-apply">Apply to Quote</button>'
      +   '<button class="btn btn-ghost" id="qc-cancel">Cancel</button></div></div>';
    App.openModal(html, { id: 'eb-calc-modal', maxWidth: 680, noClose: true });
    const recompute = () => {
      const g = x => parseFloat(document.getElementById(x)?.value) || 0;
      const guests = g('qc-guests'), el = document.getElementById('qc-result');
      if (!el) return null;
      if (!guests) { el.innerHTML = ''; return null; }
      const foodPH = g('qc-food'), barPH = g('qc-bar');
      const totalCost = (foodPH + barPH) * guests + g('qc-hrs') * (g('qc-wage') || 13) + g('qc-other');
      const t = g('qc-tgt') || 28;
      const perHeadCost = totalCost / guests;
      // Price off the food cost to hit the target food cost %; the margin below
      // shows whether that price also covers bar, labor, and other.
      const perHeadPrice = (foodPH > 0 && t > 0) ? foodPH / (t / 100) : 0;
      const totalRev = perHeadPrice * guests;
      const box = (label, val, gold) => '<div style="background:var(--input);border-radius:6px;padding:10px 12px;' + (gold ? 'border:1px solid var(--gold-tint-bord);' : '') + '"><div style="font-size:10px;color:' + (gold ? 'var(--gold)' : 'var(--t3)') + ';">' + label + '</div><div style="font-size:' + (gold ? '20px' : '16px') + ';font-weight:' + (gold ? '800' : '700') + ';color:' + (gold ? 'var(--gold)' : 'var(--t1)') + ';">' + val + '</div></div>';
      el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:10px;">'
        + box('Total Cost', App.fmtCurrency(totalCost))
        + box('Cost Per Head', App.fmtCurrency(perHeadCost))
        + box('Suggested Per Head', App.fmtCurrency(perHeadPrice), true)
        + box('Total Event Revenue', App.fmtCurrency(totalRev))
        + box('Gross Margin', App.fmtCurrency(totalRev - totalCost))
        + '</div>';
      return { perHeadPrice, totalRev };
    };
    ['qc-guests', 'qc-food', 'qc-bar', 'qc-hrs', 'qc-wage', 'qc-other', 'qc-tgt'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', recompute));
    recompute();
    document.getElementById('qc-cancel')?.addEventListener('click', () => App.closeModal('eb-calc-modal'));
    document.getElementById('qc-apply')?.addEventListener('click', () => {
      const r = recompute();
      App.closeModal('eb-calc-modal');
      if (!r || !r.perHeadPrice) return;
      const ph = Math.round(r.perHeadPrice * 100) / 100;
      const cur = this.bookings().find(x => x.id === id) || {};
      this.patch(id, { per_head: ph, quoted_total: Math.round(this.quoteParts(Object.assign({}, cur, { per_head: ph })).total) });
    });
  },

  // ── Edit Details (popup; uses the shared field set) ──────────────────────
  showForm(id) {
    const b = id ? this.bookings().find(x => x.id === id) : null;
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (id ? 'Edit Booking' : 'New Booking') + '</div>'
      + this.fieldsHtml(b, 'ebf')
      + '<div class="card-actions"><button class="btn btn-primary" id="ebf-save">' + (id ? 'Save Booking' : 'Create Booking') + '</button>'
      +   '<button class="btn btn-ghost" id="ebf-cancel">Cancel</button>'
      +   '<span id="ebf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';
    App.openModal(html, { id: 'eb-form', maxWidth: 540, noClose: true });
    document.getElementById('ebf-cancel')?.addEventListener('click', () => App.closeModal('eb-form'));
    document.getElementById('ebf-save')?.addEventListener('click', () => this.saveForm(id));
  },

  async saveForm(id) {
    const fields = this.collect('ebf');
    const err = document.getElementById('ebf-err');
    if (!fields.event_name && !fields.contact_name) { if (err) { err.textContent = 'Enter an event name or a contact name.'; err.style.display = 'inline'; } return; }
    const existing = id ? this.bookings().find(x => x.id === id) : null;
    const rec = Object.assign({}, existing || {}, fields, { id: id || App.uid(), updated_at: new Date().toISOString() });
    if (!id) rec.created_at = new Date().toISOString();
    await App.putRecord('core', 'booking', rec);
    App.closeModal('eb-form');
    if (this._detailId) this.renderDetail(rec.id);
    else if (!id) this.openDetail(rec.id);
    else this.renderList();
  },

  // ── Quote PDF ────────────────────────────────────────────────────────────
  quotePDF(b) {
    if (!b) return;
    if (App.demoBlock && App.demoBlock('Quote PDF')) return;
    const money = n => App.fmtCurrency(n);
    const lines = [];
    lines.push(['Event', this.title(b)]);
    if (b.event_type)  lines.push(['Type', b.event_type]);
    if (b.event_date)  lines.push(['Date', this.fmtDate(b.event_date) + (b.event_time ? ' ' + b.event_time : '')]);
    if (b.party_size)  lines.push(['Party Size', String(b.party_size) + ' guests']);
    if (b.space)       lines.push(['Space', b.space]);
    const qp = this.quoteParts(b);
    if (b.per_head)    lines.push(['Per Head', money(b.per_head) + (b.party_size ? ' x ' + b.party_size + ' guests' : '')]);
    if (b.fb_minimum)  lines.push(['Food & Beverage Minimum', money(b.fb_minimum)]);
    lines.push(['F&B Subtotal', money(qp.subtotal)]);
    if (qp.svcPct) lines.push(['Service Charge (' + qp.svcPct + '%)', money(qp.service)]);
    if (qp.taxPct) lines.push(['Tax (' + qp.taxPct + '%)', money(qp.tax)]);
    lines.push(['Quoted Total', money(qp.total)]);
    if (b.deposit_amount) lines.push(['Deposit to Confirm', money(b.deposit_amount)]);
    const rowsHtml = lines.map(([k, v]) => '<tr><td style="color:var(--t3);">' + esc(k) + '</td><td style="text-align:right;font-weight:600;">' + esc(v) + '</td></tr>').join('');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:640px;background:var(--surface);padding:24px;';
    wrap.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Event Quote</div>'
      + '<div class="pdf-para">Prepared ' + this.fmtDate(App.todayLocal()) + (b.contact_name ? ' for ' + esc(b.contact_name) : '') + '</div>'
      + '<table class="tbl"><tbody>' + rowsHtml + '</tbody></table>'
      + '<div class="pdf-para">This is a quote worksheet, an estimate prepared from your package pricing. Final charges may vary with headcount and selections. Not a contract.</div>'
      + '</div></div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Event Quote - ' + this.title(b), root: wrap })).finally(() => wrap.remove());
  },

  // ── Run Sheet (the operational doc the kitchen and floor run the event off) ─
  runSheetFields(b) {
    const ta = (lbl, id, val, ph, rows) => '<div class="f" style="width:100%;margin-top:14px;"><label>' + lbl + '</label><textarea id="' + id + '" class="notes-ta" rows="' + (rows || 2) + '" placeholder="' + ph + '">' + esc(val || '') + '</textarea></div>';
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;"><label>Guaranteed Count</label><input type="number" id="rs-gcount" value="' + (b.guaranteed_count != null && b.guaranteed_count !== '' ? b.guaranteed_count : '') + '" placeholder="' + (b.party_size || '') + '"/></div>'
        + '<div class="f" style="width:160px;"><label>Final Count Due</label><input type="date" id="rs-cdue" value="' + esc(b.count_due_date || '') + '"/></div>'
        + '<div class="f" style="flex:1 1 160px;"><label>Day-of Contact</label><input type="text" id="rs-dcname" value="' + esc(b.day_contact_name || '') + '" placeholder="Who runs point on site"/></div>'
        + '<div class="f" style="width:150px;"><label>Their Phone</label><input type="tel" id="rs-dcphone" value="' + esc(b.day_contact_phone || '') + '" placeholder="Optional"/></div>'
      + '</div>'
      + ta('Timeline', 'rs-timeline', b.timeline, 'Load-in 5:00, doors 6:30, dinner 7:00, last call 9:30, out by 10:30.', 3)
      + ta('Food / Menu', 'rs-menu', b.menu_notes, 'Courses, passed apps, buffet, the cake. What the kitchen makes.', 3)
      + ta('Bar / Beverage', 'rs-bev', b.bev_notes, 'Open bar, cash bar, drink tickets, wine on the tables, a toast.', 2)
      + ta('Allergies and Dietary', 'rs-allergy', b.allergies, 'Nut allergy at table 3, two vegan, one gluten free.', 2)
      + ta('Setup / Layout', 'rs-setup', b.setup_notes, 'Tables, head table, dance floor, linens, signage.', 2)
      + ta('AV / Music / Rentals', 'rs-av', b.av_notes, 'Mic, projector, the playlist, rented chairs, who delivers.', 2);
  },

  collectRunSheet() {
    const g = id => document.getElementById(id);
    return {
      guaranteed_count:  g('rs-gcount') ? (parseInt(g('rs-gcount').value) || null) : null,
      count_due_date:    g('rs-cdue')?.value || '',
      day_contact_name:  g('rs-dcname')?.value.trim() || '',
      day_contact_phone: g('rs-dcphone')?.value.trim() || '',
      timeline:          g('rs-timeline')?.value.trim() || '',
      menu_notes:        g('rs-menu')?.value.trim() || '',
      bev_notes:         g('rs-bev')?.value.trim() || '',
      allergies:         g('rs-allergy')?.value.trim() || '',
      setup_notes:       g('rs-setup')?.value.trim() || '',
      av_notes:          g('rs-av')?.value.trim() || ''
    };
  },

  runSheetReadout(b) {
    const filled = [b.timeline, b.menu_notes, b.bev_notes, b.setup_notes, b.av_notes].filter(s => s && String(s).trim()).length;
    const gc = b.guaranteed_count ? b.guaranteed_count + ' guaranteed' : (b.party_size ? b.party_size + ' estimated' : 'no count set');
    const due = b.count_due_date ? 'count due ' + this.fmtDate(b.count_due_date) : '';
    const allergy = (b.allergies && String(b.allergies).trim()) ? '<span style="color:var(--amber);font-weight:600;">allergies noted</span>' : '';
    const prog = filled ? filled + ' of 5 sections filled' : 'not started';
    return '<div style="font-size:12px;color:var(--t2);line-height:1.8;">' + [gc, due, allergy, prog].filter(Boolean).join(' &middot; ') + '</div>';
  },

  runSheet(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    const sub = [b.event_date ? this.fmtDate(b.event_date) : '', esc(b.event_time || ''), esc(b.space || ''), b.party_size ? b.party_size + ' guests' : ''].filter(Boolean).join('  &middot;  ');
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Run Sheet</span><button class="btn btn-ghost btn-sm" id="rs-print">Print Run Sheet</button></div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(this.title(b)) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin:2px 0 14px;">' + sub + '</div>'
      + this.runSheetFields(b)
      + '<div class="card-actions"><button class="btn btn-primary" id="rs-save">Save Run Sheet</button>'
      +   '<button class="btn btn-ghost" id="rs-cancel">Cancel</button></div></div>';
    App.openModal(html, { id: 'eb-runsheet-modal', maxWidth: 700, noClose: true });
    document.getElementById('rs-cancel')?.addEventListener('click', () => App.closeModal('eb-runsheet-modal'));
    document.getElementById('rs-save')?.addEventListener('click', async () => {
      await this.patch(id, this.collectRunSheet());
      App.closeModal('eb-runsheet-modal');
    });
    document.getElementById('rs-print')?.addEventListener('click', async () => {
      await this.patch(id, this.collectRunSheet());
      this.printRunSheet(this.bookings().find(x => x.id === id));
    });
  },

  printRunSheet(b) {
    if (!b) return;
    if (App.demoBlock && App.demoBlock('Run Sheet')) return;
    const dayc = [b.day_contact_name || '', b.day_contact_phone || ''].filter(Boolean).join(' · ');
    const det = [];
    if (b.event_type) det.push(['Type', b.event_type]);
    if (b.event_date) det.push(['Date', this.fmtDate(b.event_date) + (b.event_time ? ' ' + b.event_time : '')]);
    if (b.space) det.push(['Space', b.space]);
    det.push(['Headcount', b.guaranteed_count ? b.guaranteed_count + ' guaranteed' : (b.party_size ? b.party_size + ' estimated' : '-')]);
    if (b.count_due_date) det.push(['Final Count Due', this.fmtDate(b.count_due_date)]);
    if (dayc) det.push(['Day-of Contact', dayc]);
    const detTbl = '<table class="tbl"><tbody>' + det.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>';
    const sec = (lbl, val) => (val && String(val).trim()) ? '<div class="sh">' + lbl + '</div><div class="pdf-para">' + esc(val) + '</div>' : '';
    const staff = this.eventStaffByPerson(b);
    const staffTbl = staff.length ? '<div class="sh">Event Staff</div><table class="tbl"><tbody>' + staff.map(p => '<tr><td>' + esc(p.name) + '</td><td>' + p.hours.toFixed(1) + 'h</td></tr>').join('') + '</tbody></table>' : '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:680px;';
    wrap.innerHTML = '<div class="screen">'
      + '<div class="card-title">Event Run Sheet</div>'
      + detTbl
      + sec('Timeline', b.timeline)
      + sec('Food / Menu', b.menu_notes)
      + sec('Bar / Beverage', b.bev_notes)
      + sec('Allergies and Dietary', b.allergies)
      + sec('Setup / Layout', b.setup_notes)
      + sec('AV / Music / Rentals', b.av_notes)
      + sec('Notes', b.requests)
      + staffTbl
      + '</div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Run Sheet - ' + this.title(b), root: wrap })).finally(() => wrap.remove());
  },

  // ── Event Agreement (the terms worksheet the client signs to lock the date) ─
  DEFAULT_AGREEMENT_TERMS:
      'Deposit: The deposit shown above is due to confirm this booking and is non-refundable. Your date and space are not held until the deposit is received.\n\n'
    + 'Final balance: The remaining balance is due on or before the event date.\n\n'
    + 'Final guest count: A final guaranteed count is due several days before the event. You are billed for the guaranteed count or the actual count, whichever is higher.\n\n'
    + 'Cancellation: Cancellations made well ahead of the date may refund any payment beyond the deposit. Closer to the date, payments are non-refundable.\n\n'
    + 'Service charge and tax: A service charge and applicable sales tax are added to the food and beverage total, as shown above.\n\n'
    + 'Damage and overages: You are responsible for any damage to the space and for charges beyond what is quoted, billed after the event.',
  agreementTerms() { try { const v = localStorage.getItem('event_agreement_terms'); return (v != null && v !== '') ? v : this.DEFAULT_AGREEMENT_TERMS; } catch (e) { return this.DEFAULT_AGREEMENT_TERMS; } },

  agreementModal(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) return;
    const p = this.quoteParts(b);
    const money = [['Quoted Total', App.fmtCurrency(p.total)]];
    if (b.deposit_amount) money.push(['Deposit to Confirm', App.fmtCurrency(b.deposit_amount)]);
    money.push(['Balance Due', App.fmtCurrency(this.balanceDue(b))]);
    const moneyHtml = money.map(r => '<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;padding:3px 0;"><span style="color:var(--t3);">' + r[0] + '</span><span style="color:var(--t1);font-weight:600;">' + r[1] + '</span></div>').join('');
    const sub = [b.event_date ? this.fmtDate(b.event_date) : '', esc(b.event_time || ''), esc(b.space || ''), b.party_size ? b.party_size + ' guests' : ''].filter(Boolean).join('  &middot;  ');
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Event Agreement</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(this.title(b)) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin:2px 0 12px;">' + sub + '</div>'
      + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;margin-bottom:14px;">' + moneyHtml + '</div>'
      + '<div class="f" style="width:100%;"><label>Terms</label><textarea id="ag-terms" class="notes-ta" rows="10">' + esc(this.agreementTerms()) + '</textarea></div>'
      + '<div style="font-size:11px;color:var(--t4);line-height:1.6;margin-top:8px;">These terms are a starting point. Set them to your own policy and have your attorney review the agreement before you rely on it. Bar Cop is a software tool, not legal advice.</div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ag-print">Save and Print</button>'
      +   '<button class="btn btn-ghost" id="ag-cancel">Cancel</button></div></div>';
    App.openModal(html, { id: 'eb-agreement-modal', maxWidth: 680, noClose: true });
    document.getElementById('ag-cancel')?.addEventListener('click', () => App.closeModal('eb-agreement-modal'));
    document.getElementById('ag-print')?.addEventListener('click', () => {
      const terms = document.getElementById('ag-terms')?.value || '';
      try { localStorage.setItem('event_agreement_terms', terms); } catch (e) {}
      App.closeModal('eb-agreement-modal');
      this.printAgreement(b, terms);
    });
  },

  printAgreement(b, terms) {
    if (!b) return;
    if (App.demoBlock && App.demoBlock('Event Agreement')) return;
    const barName = (App.data && App.data.settings && App.data.settings.bar_name) || 'Our Venue';
    const p = this.quoteParts(b);
    const money = n => App.fmtCurrency(n);
    const lines = [['Event', this.title(b)]];
    if (b.event_type) lines.push(['Type', b.event_type]);
    if (b.event_date) lines.push(['Date', this.fmtDate(b.event_date) + (b.event_time ? ' ' + b.event_time : '')]);
    if (b.space) lines.push(['Space', b.space]);
    if (b.party_size) lines.push(['Guest Count', String(b.party_size)]);
    lines.push(['F&B Subtotal', money(p.subtotal)]);
    if (p.svcPct) lines.push(['Service Charge (' + p.svcPct + '%)', money(p.service)]);
    if (p.taxPct) lines.push(['Tax (' + p.taxPct + '%)', money(p.tax)]);
    lines.push(['Quoted Total', money(p.total)]);
    if (b.deposit_amount) lines.push(['Deposit to Confirm', money(b.deposit_amount)]);
    lines.push(['Balance Due', money(this.balanceDue(b))]);
    const tbl = '<table class="tbl"><tbody>' + lines.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>';
    const termsHtml = String(terms || this.agreementTerms()).split(/\n\s*\n/).filter(s => s.trim()).map(s => '<div class="pdf-para">' + esc(s.trim()) + '</div>').join('');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:680px;';
    wrap.innerHTML = '<div class="screen">'
      + '<div class="card-title">Event Agreement</div>'
      + '<div class="pdf-para">Between ' + esc(barName) + ' and ' + esc(b.contact_name || 'the client') + ', prepared ' + this.fmtDate(App.todayLocal()) + '.</div>'
      + tbl
      + '<div class="sh">Terms</div>'
      + termsHtml
      + '<div class="sh">Signatures</div>'
      + '<div class="pdf-para">Client signature: ______________________________     Date: ________________</div>'
      + '<div class="pdf-para">' + esc(barName) + ' signature: ______________________     Date: ________________</div>'
      + '</div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Event Agreement - ' + this.title(b), root: wrap, brand: barName, footer: '' })).finally(() => wrap.remove());
  },

  worksheet() {
    App.printBlankSheet({
      title: 'Booking Inquiry Pad',
      subtitle: 'Capture event and catering inquiries as the phone rings. Enter into Bar Cop after the day.',
      columns: [
        { label: 'Date',        width: '10%' },
        { label: 'Contact',     width: '16%' },
        { label: 'Phone/Email', width: '16%' },
        { label: 'Event Type',  width: '12%' },
        { label: 'Event Date',  width: '11%' },
        { label: 'Party',       width: '8%'  },
        { label: 'Notes / Follow-up' }
      ],
      rows: 14
    });
  },

  showHowTo() {
    App.showHelpModal('How Event Booking Works', [
      { p: ['One record per party, worked from the first call to the paid invoice. Read the stat strip up top for what is open, stale, booked soon, and the deposits you are owed. Log a lead in the New Booking form on the page, or open any row to work it. Worksheet prints a blank inquiry pad to capture calls by the phone.'] },
      { h: 'The Active Booking', p: ['Open a booking and the page follows its stage. The header carries the stage, the progress rail carries the lifecycle, the tiles carry the numbers for this stage, and one big button moves it forward. Tap any reached step on the rail to jump back and edit it, then Back to where you left off.'] },
      { h: 'The Stages', p: ['A booking moves Lead, Quote Sent, Booked, Completed. Mark Lost any time before it completes; it stays in the pipeline and you can reopen it.'] },
      { h: 'Quote and Send', p: ['On a Lead, tap a Rate Card package to prefill the price, or open the Catering Calculator to price per head against a target food cost right on the booking. Set the per head and guest count, the F&B minimum if you hold one, and your service charge and tax. Bar Cop builds the quote underneath: F&B subtotal, then service charge and tax on top, to the quoted total. Then Send Quote. Capture the customer email on the booking first; Send Quote opens a ready-to-send email with the full breakdown in it, the same way you email a vendor order, and marks the booking Quote Sent. Quote PDF prints a clean copy to attach or hand over.'] },
      { h: 'Deposit and Balance', p: ['Once a booking is Booked, log the deposit you took and mark it paid. The balance is the quoted total minus the deposit; mark it paid when the money lands. Deposits still owed roll up on the pipeline and the dashboard, and booked balances feed your Cash Forecast as money coming in.'] },
      { h: 'Agreement', p: ['Agreement, on the booking header, builds an event agreement from the booking: the event details, the money, your terms, and signature lines for you and the client. The terms start from a sensible template you edit once to your own policy, and Bar Cop remembers them for the next event. Save and Print gives you a clean copy to send for signature. It is a worksheet, not a contract; have your attorney review it.'] },
      { h: 'Staffing', p: ['Schedule Staff for this Event jumps to Build Schedule on the event date, which is marked with an EVENT tag. Open each person working the event and check "Working [event name]" so only their hours land on the Event P&L, not the whole day\'s crew.'] },
      { h: 'Run Sheet', p: ['Run Sheet is what the kitchen and floor work the event off: the timeline, the food and bar, allergies and dietary, the room setup, AV and rentals, the guaranteed headcount and when the final count is due, and who runs point on site. Open it from the booking header or the Booked stage, fill it in, and Print Run Sheet to hand the team a clean copy.'] },
      { h: 'Event P&L', p: ['On a Completed booking, enter the actual revenue (the event\'s bill) and the food, bar, and other cost. Labor pulls automatically from the staff you checked for the event in Build Schedule, using their logged hours on the event date. The margin is the event\'s bottom line.'] },
      { h: 'Getting Back', p: ['The back arrow at the bottom right returns you to the pipeline from any booking.'] }
    ]);
  }
};
