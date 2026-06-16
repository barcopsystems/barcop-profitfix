'use strict';

/* ── Events — Bookings ────────────────────────────────────────────────────────
   The unified bookings pipeline: one record per party, worked cradle to grave
   through Lead -> Quote Sent -> Booked -> Completed / Lost. Merges the old
   Revenue "Events & Catering" pipeline and the Traffic "Group Inquiries" lead
   log into a single record (App.data.bookings, kind 'booking').

   List = stat strip + stage filter chips + the pipeline table. Detail = an
   interactive, stage-aware page (Active-Shift style): the stage drives what is
   shown and the next action. Contact & Event -> Quote (rate card / catering
   calculator) -> Money (deposit + balance) -> Staffing (jump to Build Schedule,
   tagged) -> Linked Shifts + Event P&L. Feeds: event revenue rolls into This
   Week catering + the Revenue Audit; labor pulls from the tagged shifts. */

S.EventsBookings = {
  _detailId: null,
  filterStage: '',

  STAGES: ['Lead', 'Quote Sent', 'Booked', 'Completed', 'Lost'],
  STAGE_COLOR: {
    'Lead':       'var(--gold)',
    'Quote Sent': 'var(--amber)',
    'Booked':     'var(--green)',
    'Completed':  'var(--focus)',
    'Lost':       'var(--red)'
  },
  EVENT_TYPES: ['Birthday', 'Corporate', 'Rehearsal Dinner', 'Bridal/Baby Shower', 'Holiday Party', 'Reunion', 'Memorial', 'Buyout', 'Catering (Offsite)', 'Other'],
  SOURCES: ['Phone', 'Email', 'Website Form', 'Walk-in', 'Referral', 'OpenTable/Resy', 'Repeat Guest', 'Other'],

  bookings()  { if (!Array.isArray(App.data.bookings)) App.data.bookings = []; return App.data.bookings; },
  rateCards() { if (!Array.isArray(App.data.event_rate_cards)) App.data.event_rate_cards = []; return App.data.event_rate_cards; },
  regulars()  { if (!Array.isArray(App.data.event_regulars)) App.data.event_regulars = []; return App.data.event_regulars; },

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

  // Revenue: linked-shift revenue (tagged) preferred, else the typed actual.
  linkedShifts(b) {
    const tag = String(b.event_name || '').trim().toLowerCase();
    if (!tag) return [];
    return ((App.shiftData && App.shiftData.sc_shifts) || []).filter(s => String(s.event_tag || '').trim().toLowerCase() === tag);
  },
  bookingRevenue(b) {
    const tagged = this.linkedShifts(b).reduce((s, x) => s + (parseFloat(x.bar_revenue) || 0) + (parseFloat(x.floor_revenue) || 0), 0);
    return tagged > 0 ? tagged : (parseFloat(b.actual_revenue) || 0);
  },
  bookingLabor(b) {
    const dates = new Set(this.linkedShifts(b).map(s => s.date).filter(Boolean));
    return ((App.laborData && App.laborData.lc_actuals) || [])
      .filter(a => a.date && dates.has(a.date))
      .reduce((s, a) => s + ((parseFloat(a.hours) || 0) * (parseFloat(a.wage) || 0)), 0);
  },
  balanceDue(b) {
    const quoted = parseFloat(b.quoted_total) || 0;
    const dep = parseFloat(b.deposit_amount) || 0;
    return Math.max(0, quoted - dep);
  },

  // Persist a partial change to a booking, then re-render the detail in place.
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
    // Deep-link from the Calendar (or anywhere): open a specific booking.
    if (App._evBookingFocus) { const fid = App._evBookingFocus; App._evBookingFocus = null; if (this.bookings().some(b => b.id === fid)) { this.openDetail(fid); return; } }
    if (this._detailId) { this.renderDetail(this._detailId); return; }
    this.renderList();
  },

  // ── List / pipeline ──────────────────────────────────────────────────────
  renderList() {
    const all = this.bookings();
    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Bookings',
        lead: 'Every party, buyout, and catering job, from the first phone call to the paid invoice. Log a lead when it comes in and work it through Quote Sent, Booked, and Completed. The pipeline shows what is open, what is stale, and the deposits you are still owed.',
        steps: [
          { title: 'Log your first booking', desc: 'Capture the lead while it is fresh: who called, the event type, the date they want, and the party size.', btn: 'New Booking', screen: '', done: false },
          { title: 'Set up your packages', desc: 'Build a Rate Card so quotes prefill, and price catering per head on the Pricing screen.', btn: 'Open Pricing', screen: 'ev-pricing', done: this.rateCards().length > 0 }
        ]
      });
      this.container.querySelector('.setup-card')?.insertAdjacentHTML('beforeend', '');
      this.container.onclick = ev => {
        const go = ev.target.closest('.setup-go');
        if (!go) return;
        if (go.dataset.go) App.navigate(go.dataset.go);
        else this.showForm();
      };
      // The first step's button has no screen; wire it to open the form.
      this.container.querySelectorAll('.setup-go').forEach(b => { if (!b.dataset.go) b.addEventListener('click', () => this.showForm()); });
      return;
    }

    const open  = all.filter(b => this.isOpen(b.stage));
    const stale = open.filter(b => { const d = this.daysSince(b.date_received); return d != null && d >= 3; });
    const booked = all.filter(b => b.stage === 'Booked');
    const bookedSoon = booked.filter(b => { const d = this.daysUntil(b.event_date); return d != null && d >= 0 && d <= 30; });
    const pipelineVal = open.reduce((s, b) => s + (parseFloat(b.quoted_total) || 0), 0);
    const depositsDue = booked.filter(b => !b.deposit_paid_date).reduce((s, b) => s + (parseFloat(b.deposit_amount) || 0), 0);

    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Open Leads', String(open.length), open.length ? '' : 'dim')
      + stat('Stale (3+ Days)', String(stale.length), stale.length ? 'warn' : '')
      + stat('Booked, Next 30d', String(bookedSoon.length))
      + stat('Pipeline Value', App.fmtCurrency(pipelineVal, 0))
      + stat('Deposits Due', App.fmtCurrency(depositsDue, 0), depositsDue ? 'warn' : '')
      + '</div></div>';

    // Stage filter chips (gold-tint selection)
    const chipDefs = [{ v: '', label: 'All' }].concat(this.STAGES.map(s => ({ v: s, label: s })));
    const chips = App.filterChips(this.filterStage, chipDefs, 'eb-stage-chip');
    const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;">'
      +   '<button class="btn btn-ghost btn-sm" id="eb-worksheet">Worksheet</button>'
      +   '<button class="btn btn-primary btn-sm" id="eb-new">New Booking</button>'
      + '</div></div>';

    const list = (this.filterStage ? all.filter(b => b.stage === this.filterStage) : all)
      .slice().sort((a, b) => (b.date_received || b.event_date || '').localeCompare(a.date_received || a.event_date || ''));

    const rows = list.slice(0, App.LIST_PAGE || 50).map(b => {
      const col = this.STAGE_COLOR[b.stage] || 'var(--t1)';
      const dUntil = this.daysUntil(b.event_date);
      const stale = this.isOpen(b.stage) && (this.daysSince(b.date_received) >= 3);
      const money = b.stage === 'Completed' ? App.fmtCurrency(this.bookingRevenue(b), 0)
        : (b.quoted_total ? App.fmtCurrency(b.quoted_total, 0) : (b.fb_minimum ? App.fmtCurrency(b.fb_minimum, 0) + ' min' : '-'));
      const dep = b.stage === 'Booked'
        ? (b.deposit_paid_date ? '<span style="color:var(--green);">Deposit paid</span>'
            : (b.deposit_amount ? '<span style="color:var(--amber);">' + App.fmtCurrency(b.deposit_amount, 0) + ' due</span>' : '<span style="color:var(--t3);">-</span>'))
        : '<span style="color:var(--t3);">-</span>';
      return '<tr class="eb-row" data-id="' + esc(b.id) + '" style="cursor:pointer;">'
        + '<td><div class="val" style="font-weight:600;">' + esc(this.title(b)) + '</div>'
        +   (b.contact_name && b.event_name ? '<div style="font-size:10px;color:var(--t3);">' + esc(b.contact_name) + '</div>' : '') + '</td>'
        + '<td>' + esc(b.event_type || '-') + '</td>'
        + '<td>' + (b.event_date ? this.fmtDate(b.event_date) + (dUntil != null && dUntil >= 0 && dUntil <= 30 && b.stage === 'Booked' ? ' <span style="color:var(--t3);font-size:10px;">(' + dUntil + 'd)</span>' : '') : (stale ? '<span style="color:var(--red);font-size:11px;">stale</span>' : '-')) + '</td>'
        + '<td>' + (b.party_size ? b.party_size : '-') + '</td>'
        + '<td>' + money + '</td>'
        + '<td>' + dep + '</td>'
        + '<td style="color:' + col + ';font-weight:700;">' + esc(b.stage || '') + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm eb-view" data-id="' + esc(b.id) + '">Open</button>'
        +   '<button class="btn btn-danger btn-sm eb-del" data-id="' + esc(b.id) + '">Delete</button></div></td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No bookings in this stage.</td></tr>';

    this.container.innerHTML = '<div class="screen">' + statStrip + headRow
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Event</th><th>Type</th><th>Event Date</th><th>Party</th><th>Quote / Revenue</th><th>Deposit</th><th>Stage</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      + '</div>';
    this.wireList();
  },

  wireList() {
    this.container.querySelectorAll('.eb-stage-chip').forEach(b =>
      b.addEventListener('click', () => { this.filterStage = b.dataset.v; this.renderList(); }));
    document.getElementById('eb-new')?.addEventListener('click', () => this.showForm());
    document.getElementById('eb-worksheet')?.addEventListener('click', () => this.worksheet());
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

  // ── Detail (stage-aware, Active-Shift style) ─────────────────────────────
  openDetail(id) {
    this._detailId = id;
    App.pushView(() => this.renderDetail(id));
  },

  renderDetail(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) { this._detailId = null; App.goBack ? App.goBack() : this.render(this.container, this.actions); return; }
    this._detailId = id;
    if (this.actions) this.actions.innerHTML = '';
    const col = this.STAGE_COLOR[b.stage] || 'var(--t1)';

    // What's next, by stage.
    const nextLine = {
      'Lead':       'Build a quote, then send it.',
      'Quote Sent': 'Follow up. Mark it Booked when they confirm.',
      'Booked':     'Collect the deposit, schedule staff, and watch the balance.',
      'Completed':  'Review the Event P&L below.',
      'Lost':       'Closed. Logged for your conversion rate.'
    }[b.stage] || '';

    // Header
    let html = '<div class="screen">'
      + '<div class="card form-card">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
          + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Booking</div>'
          + '<div style="font-size:20px;font-weight:800;color:var(--t1);">' + esc(this.title(b)) + '</div>'
          + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + esc(b.event_type || '') + (b.event_date ? ' &middot; ' + this.fmtDate(b.event_date) : '') + (b.party_size ? ' &middot; ' + b.party_size + ' guests' : '') + '</div></div>'
          + '<div style="text-align:right;"><span style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + col + ';border:1px solid ' + col + ';border-radius:3px;padding:4px 10px;">' + esc(b.stage || '') + '</span></div>'
        + '</div>'
        + (nextLine ? '<div style="font-size:12px;color:var(--t2);margin-top:12px;padding-top:12px;border-top:1px solid var(--b2);">Next: ' + esc(nextLine) + '</div>' : '')
      + '</div>';

    // Contact & Event
    const reg = b.regular_id ? this.regulars().find(r => r.id === b.regular_id) : null;
    const dispRow = (label, val) => '<div class="f"><label>' + label + '</label><div style="font-size:13px;color:var(--t1);">' + (val ? esc(val) : '<span style="color:var(--t4);">-</span>') + '</div></div>';
    html += '<div class="sh" style="margin:18px 0 10px;">Contact &amp; Event</div>'
      + '<div class="card">'
        + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">'
          + dispRow('Contact', b.contact_name)
          + dispRow('Phone', b.contact_phone)
          + dispRow('Email', b.contact_email)
          + dispRow('Source', b.source)
        + '</div>'
        + '<div class="form-row" style="gap:18px;flex-wrap:wrap;margin-top:6px;">'
          + dispRow('Event Date', b.event_date ? this.fmtDate(b.event_date) : '')
          + dispRow('Time', b.event_time)
          + dispRow('Party Size', b.party_size ? String(b.party_size) : '')
          + dispRow('Space', b.space)
        + '</div>'
        + (reg ? '<div style="font-size:11px;color:var(--gold);margin-top:8px;">Linked regular: ' + esc(reg.name || '') + '</div>' : '')
        + (b.requests ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;padding-top:10px;border-top:1px solid var(--b2);">' + esc(b.requests) + '</div>' : '')
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-edit">Edit Details</button></div>'
      + '</div>';

    // Quote
    const rcOpts = '<option value="">Pick a package (optional)</option>' + this.rateCards().map(r =>
      '<option value="' + esc(r.id) + '"' + (b.rate_card_id === r.id ? ' selected' : '') + '>' + esc(r.package_name || '') + '</option>').join('');
    html += '<div class="sh" style="margin:18px 0 10px;">Quote</div>'
      + '<div class="card">'
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:240px;flex-shrink:0;"><label>Rate Card Package</label><select id="eb-q-rc" class="form-input">' + rcOpts + '</select></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-q-ph" value="' + (b.per_head != null ? b.per_head : '') + '" step="0.01"/></div></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>F&amp;B Minimum</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-q-fb" value="' + (b.fb_minimum != null ? b.fb_minimum : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Quoted Total</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-q-total" value="' + (b.quoted_total != null ? b.quoted_total : '') + '"/></div></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-save">Save Quote</button>'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-calc">Catering Calculator</button>'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-pdf">Quote PDF</button>'
          + (this.isOpen(b.stage) ? '<button class="btn btn-primary btn-sm" id="eb-q-send" style="margin-left:auto;">Send Quote</button>' : '')
        + '</div>'
      + '</div>';

    // Money (deposit + balance) — once there's a quote or it's booked
    if (b.stage === 'Booked' || b.stage === 'Completed' || b.quoted_total) {
      const bal = this.balanceDue(b);
      html += '<div class="sh" style="margin:18px 0 10px;">Deposit &amp; Balance</div>'
        + '<div class="card">'
          + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
            + '<div class="f" style="width:150px;flex-shrink:0;"><label>Deposit Amount</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-dep" value="' + (b.deposit_amount != null ? b.deposit_amount : '') + '"/></div></div>'
            + '<div class="f" style="width:160px;flex-shrink:0;"><label>Deposit Status</label><div style="font-size:13px;color:' + (b.deposit_paid_date ? 'var(--green)' : 'var(--amber)') + ';">' + (b.deposit_paid_date ? 'Paid ' + this.fmtDate(b.deposit_paid_date) : (b.deposit_amount ? 'Due' : 'None set')) + '</div></div>'
            + '<div class="f" style="width:150px;flex-shrink:0;"><label>Balance Due</label><div style="font-size:14px;font-weight:600;color:' + (bal > 0 ? 'var(--t1)' : 'var(--green)') + ';">' + App.fmtCurrency(bal) + '</div></div>'
            + '<div class="f" style="width:160px;flex-shrink:0;"><label>Balance Status</label><div style="font-size:13px;color:' + (b.balance_paid_date ? 'var(--green)' : 'var(--t3)') + ';">' + (b.balance_paid_date ? 'Paid ' + this.fmtDate(b.balance_paid_date) : 'Open') + '</div></div>'
          + '</div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
            + '<button class="btn btn-ghost btn-sm" id="eb-dep-save">Save Deposit</button>'
            + (b.deposit_amount && !b.deposit_paid_date ? '<button class="btn btn-ghost btn-sm" id="eb-dep-paid">Mark Deposit Paid</button>' : '')
            + (!b.balance_paid_date && bal > 0 ? '<button class="btn btn-ghost btn-sm" id="eb-bal-paid">Mark Balance Paid</button>' : '')
          + '</div>'
        + '</div>';
    }

    // Staffing — jump to Build Schedule + linked shift readout
    const ls = this.linkedShifts(b);
    html += '<div class="sh" style="margin:18px 0 10px;">Staffing</div>'
      + '<div class="card">'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-bottom:10px;">Staff this event in Build Schedule. A shift tagged "' + esc(b.event_name || this.title(b)) + '" feeds its hours into the Event P&amp;L below automatically.</div>'
        + (ls.length === 0
            ? '<div style="font-size:12px;color:var(--t4);">No shifts tagged to this event yet.</div>'
            : '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Shift</th><th>Bar</th><th>Floor</th></tr></thead><tbody>'
              + ls.map(s => '<tr><td>' + esc(s.date || '') + '</td><td>' + esc(s.shift_type || '') + '</td><td>' + App.fmtCurrency(s.bar_revenue || 0, 0) + '</td><td>' + App.fmtCurrency(s.floor_revenue || 0, 0) + '</td></tr>').join('')
              + '</tbody></table></div>')
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-staff">Schedule Staff for this Event</button></div>'
      + '</div>';

    // Event P&L
    const rev = this.bookingRevenue(b);
    const labor = this.bookingLabor(b);
    const food = parseFloat(b.event_food_cost) || 0, bar = parseFloat(b.event_bar_cost) || 0, other = parseFloat(b.event_other_cost) || 0;
    const totalCost = food + bar + labor + other;
    const margin = rev - totalCost;
    const marginPct = rev > 0 ? (margin / rev * 100) : null;
    const pl = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    html += '<div class="sh" style="margin:18px 0 10px;">Event P&amp;L</div>'
      + '<div class="card">'
        + '<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start;">'
          + pl('Revenue', App.fmtCurrency(rev))
          + pl('Food Cost', App.fmtCurrency(food))
          + pl('Bar Cost', App.fmtCurrency(bar))
          + pl('Labor', App.fmtCurrency(labor))
          + (other > 0 ? pl('Other', App.fmtCurrency(other)) : '')
          + pl('Margin', App.fmtCurrency(margin), margin >= 0 ? 'good' : 'warn')
          + pl('Margin %', marginPct != null ? marginPct.toFixed(1) + '%' : '-', marginPct != null && marginPct >= 30 ? 'good' : 'warn')
        + '</div>'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:10px;">Revenue uses tagged shifts when present, else the typed actual. Labor pulls from Labor Control on the tagged shift dates. Food and bar cost are your estimates (Edit Details).</div>'
      + '</div>';

    // Stage actions
    const act = [];
    if (b.stage === 'Lead' || b.stage === 'Quote Sent') act.push('<button class="btn btn-primary btn-sm eb-stage" data-to="Booked">Mark Booked</button>');
    if (b.stage === 'Booked') act.push('<button class="btn btn-primary btn-sm eb-stage" data-to="Completed">Mark Completed</button>');
    if (b.stage !== 'Lost' && b.stage !== 'Completed') act.push('<button class="btn btn-ghost btn-sm eb-stage" data-to="Lost">Mark Lost</button>');
    if (b.stage === 'Lost') act.push('<button class="btn btn-ghost btn-sm eb-stage" data-to="Lead">Reopen</button>');
    html += '<div style="margin-top:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Move This Booking</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' + act.join('')
      + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div></div>';

    html += '</div>';
    this.container.innerHTML = html;
    this.wireDetail(b);
  },

  wireDetail(b) {
    const id = b.id;
    document.getElementById('eb-edit')?.addEventListener('click', () => this.showForm(id));
    // Quote
    document.getElementById('eb-q-rc')?.addEventListener('change', e => {
      const rc = this.rateCards().find(r => r.id === e.target.value);
      const fields = { rate_card_id: e.target.value || '' };
      if (rc) {
        if (rc.per_head != null) fields.per_head = rc.per_head;
        if (rc.fb_minimum != null) fields.fb_minimum = rc.fb_minimum;
        if (rc.per_head && b.party_size) fields.quoted_total = Math.round(rc.per_head * b.party_size);
        else if (rc.fb_minimum) fields.quoted_total = rc.fb_minimum;
      }
      this.patch(id, fields);
    });
    document.getElementById('eb-q-save')?.addEventListener('click', () => this.patch(id, {
      per_head:     parseFloat(document.getElementById('eb-q-ph')?.value) || 0,
      fb_minimum:   parseFloat(document.getElementById('eb-q-fb')?.value) || 0,
      quoted_total: parseFloat(document.getElementById('eb-q-total')?.value) || 0
    }));
    document.getElementById('eb-q-calc')?.addEventListener('click', () => App.navigate('ev-pricing'));
    document.getElementById('eb-q-pdf')?.addEventListener('click', () => this.quotePDF(this.bookings().find(x => x.id === id)));
    document.getElementById('eb-q-send')?.addEventListener('click', () => this.patch(id, {
      per_head:     parseFloat(document.getElementById('eb-q-ph')?.value) || 0,
      fb_minimum:   parseFloat(document.getElementById('eb-q-fb')?.value) || 0,
      quoted_total: parseFloat(document.getElementById('eb-q-total')?.value) || 0,
      stage: 'Quote Sent'
    }));
    // Money
    document.getElementById('eb-dep-save')?.addEventListener('click', () => this.patch(id, { deposit_amount: parseFloat(document.getElementById('eb-dep')?.value) || 0 }));
    document.getElementById('eb-dep-paid')?.addEventListener('click', () => this.patch(id, { deposit_amount: parseFloat(document.getElementById('eb-dep')?.value) || (parseFloat(b.deposit_amount) || 0), deposit_paid_date: App.todayLocal() }));
    document.getElementById('eb-bal-paid')?.addEventListener('click', () => this.patch(id, { balance_paid_date: App.todayLocal() }));
    // Staffing
    document.getElementById('eb-staff')?.addEventListener('click', () => { App._eventStaffTag = b.event_name || this.title(b); App._eventStaffDate = b.event_date || ''; App.openScreen('lc-build-schedule'); });
    // Stage actions
    this.container.querySelectorAll('.eb-stage').forEach(btn =>
      btn.addEventListener('click', () => this.changeStage(id, btn.dataset.to)));
    document.getElementById('eb-detail-del')?.addEventListener('click', async () => {
      const ok = await App.confirmDelete();
      if (!ok) return;
      await App.removeRecord('core', 'booking', id);
      this._detailId = null;
      App.goBack ? App.goBack() : this.render(this.container, this.actions);
    });
  },

  async changeStage(id, to) {
    if (to === 'Lost') {
      const reason = await App.confirm({ title: 'Mark this booking lost?', message: 'It stays in the pipeline for your conversion rate. You can reopen it later.', confirmText: 'Mark Lost', cancelText: 'Keep' });
      if (!reason) return;
    }
    const fields = { stage: to };
    if (to === 'Booked' && !this.bookings().find(x => x.id === id)?.date_received) fields.date_received = App.todayLocal();
    await this.patch(id, fields);
    // A booked win credits the Recovery Scoreboard — wired in the feeds pass.
  },

  // ── Booking form (shared add + edit) ─────────────────────────────────────
  showForm(id) {
    const b = id ? this.bookings().find(x => x.id === id) : null;
    const today = App.todayLocal();
    const typeOpts = '<option value="">-</option>' + this.EVENT_TYPES.map(t => '<option' + (b && b.event_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const srcOpts = '<option value="">-</option>' + this.SOURCES.map(s => '<option' + (b && b.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const stageOpts = this.STAGES.map(s => '<option' + ((b && b.stage === s) || (!b && s === 'Lead') ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const regOpts = '<option value="">-</option>' + this.regulars().map(r => '<option value="' + esc(r.id) + '"' + (b && b.regular_id === r.id ? ' selected' : '') + '>' + esc(r.name || '') + '</option>').join('');
    const v = x => (x != null && x !== '') ? x : '';

    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (id ? 'Edit Booking' : 'New Booking') + '</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Event Name</label><input type="text" id="ebf-name" value="' + esc(b?.event_name || '') + '" placeholder="Smith Rehearsal Dinner"/></div></div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Contact Name</label><input type="text" id="ebf-cname" value="' + esc(b?.contact_name || '') + '" placeholder="Jen Mitchell"/></div>'
        + '<div class="f"><label>Phone</label><input type="tel" id="ebf-phone" value="' + esc(b?.contact_phone || '') + '" placeholder="Optional"/></div>'
        + '<div class="f"><label>Email</label><input type="email" id="ebf-email" value="' + esc(b?.contact_email || '') + '" placeholder="Optional"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Event Type</label><select id="ebf-type" class="form-input">' + typeOpts + '</select></div>'
        + '<div class="f"><label>Source</label><select id="ebf-source" class="form-input">' + srcOpts + '</select></div>'
        + '<div class="f"><label>Stage</label><select id="ebf-stage" class="form-input">' + stageOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Event Date</label><input type="date" id="ebf-date" value="' + esc(b?.event_date || '') + '"/></div>'
        + '<div class="f"><label>Time</label><input type="text" id="ebf-time" value="' + esc(b?.event_time || '') + '" placeholder="6:00 PM"/></div>'
        + '<div class="f"><label>Party Size</label><input type="number" id="ebf-party" value="' + v(b?.party_size) + '"/></div>'
        + '<div class="f"><label>Space</label><input type="text" id="ebf-space" value="' + esc(b?.space || '') + '" placeholder="Private room"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Date Received</label><input type="date" id="ebf-recv" value="' + esc(b?.date_received || today) + '"/></div>'
        + '<div class="f"><label>Link a Regular</label><select id="ebf-reg" class="form-input">' + regOpts + '</select></div>'
        + '<div class="f"><label>Event Food Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ebf-food" value="' + v(b?.event_food_cost) + '" placeholder="For P&L"/></div></div>'
        + '<div class="f"><label>Event Bar Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ebf-bar" value="' + v(b?.event_bar_cost) + '" placeholder="For P&L"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Actual Revenue (if not tagging shifts)</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ebf-actual" value="' + v(b?.actual_revenue) + '"/></div></div>'
        + '<div class="f"><label>Other Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ebf-other" value="' + v(b?.event_other_cost) + '" placeholder="Optional"/></div></div>'
      + '</div>'
      + '<div class="f" style="width:100%;"><label>Requests / Notes</label><textarea id="ebf-req" class="notes-ta" rows="2" placeholder="What they asked for, follow-up notes, why it closed.">' + esc(b?.requests || '') + '</textarea></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ebf-save">' + (id ? 'Save Booking' : 'Create Booking') + '</button>'
      +   '<button class="btn btn-ghost" id="ebf-cancel">Cancel</button>'
      +   '<span id="ebf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';

    App.openModal(html, { id: 'eb-form', maxWidth: 680, noClose: true });
    document.getElementById('ebf-cancel')?.addEventListener('click', () => App.closeModal('eb-form'));
    document.getElementById('ebf-save')?.addEventListener('click', () => this.saveForm(id));
  },

  async saveForm(id) {
    const g = x => document.getElementById(x);
    const err = g('ebf-err');
    const name = g('ebf-name')?.value.trim();
    const cname = g('ebf-cname')?.value.trim();
    if (!name && !cname) { if (err) { err.textContent = 'Enter an event name or a contact name.'; err.style.display = 'inline'; } return; }
    const existing = id ? this.bookings().find(x => x.id === id) : null;
    const rec = Object.assign({}, existing || {}, {
      id: id || App.uid(),
      event_name:   name,
      contact_name: cname,
      contact_phone: g('ebf-phone')?.value.trim() || '',
      contact_email: g('ebf-email')?.value.trim() || '',
      event_type:   g('ebf-type')?.value || '',
      source:       g('ebf-source')?.value || '',
      stage:        g('ebf-stage')?.value || 'Lead',
      event_date:   g('ebf-date')?.value || '',
      event_time:   g('ebf-time')?.value.trim() || '',
      party_size:   parseInt(g('ebf-party')?.value) || null,
      space:        g('ebf-space')?.value.trim() || '',
      date_received: g('ebf-recv')?.value || App.todayLocal(),
      regular_id:   g('ebf-reg')?.value || '',
      event_food_cost:  parseFloat(g('ebf-food')?.value) || 0,
      event_bar_cost:   parseFloat(g('ebf-bar')?.value) || 0,
      event_other_cost: parseFloat(g('ebf-other')?.value) || 0,
      actual_revenue:   parseFloat(g('ebf-actual')?.value) || 0,
      requests:     g('ebf-req')?.value.trim() || '',
      updated_at:   new Date().toISOString()
    });
    if (!id) rec.created_at = new Date().toISOString();
    await App.putRecord('core', 'booking', rec);
    App.closeModal('eb-form');
    if (this._detailId) this.renderDetail(rec.id);
    else { if (!id) this.openDetail(rec.id); else this.renderList(); }
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
    if (b.per_head)    lines.push(['Per Head', money(b.per_head)]);
    if (b.fb_minimum)  lines.push(['Food & Beverage Minimum', money(b.fb_minimum)]);
    lines.push(['Quoted Total', money(parseFloat(b.quoted_total) || 0)]);
    if (b.deposit_amount) lines.push(['Deposit to Confirm', money(b.deposit_amount)]);
    const rowsHtml = lines.map(([k, v]) => '<tr><td style="color:var(--t3);">' + esc(k) + '</td><td style="text-align:right;font-weight:600;">' + esc(v) + '</td></tr>').join('');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:640px;background:var(--surface);padding:24px;';
    wrap.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Event Quote</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">Prepared ' + this.fmtDate(App.todayLocal()) + (b.contact_name ? ' for ' + esc(b.contact_name) : '') + '</div>'
      + '<table class="tbl"><tbody>' + rowsHtml + '</tbody></table>'
      + '<div style="font-size:10px;color:var(--t3);line-height:1.6;margin-top:14px;">This is a quote worksheet, an estimate prepared from your package pricing. Final charges may vary with headcount and selections. Not a contract.</div>'
      + '</div></div>';
    document.body.appendChild(wrap);
    Promise.resolve(App.exportPDF({ title: 'Event Quote - ' + this.title(b), root: wrap })).finally(() => wrap.remove());
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
    App.showHelpModal('How Bookings Works', [
      { p: ['One record per party, worked from the first call to the paid invoice. Log the lead, move it through Quote Sent and Booked, and it lands as a Completed event with its own profit and loss. The pipeline up top shows what is open, what has gone stale, what is booked soon, and the deposits you are still owed.'] },
      { h: 'The Stages', p: ['Lead is a fresh inquiry. Quote Sent means you priced it and sent it. Booked means they confirmed. Completed means the event ran. Lost stays in the pipeline so your conversion rate stays honest. Move a booking with the buttons at the bottom of its page.'] },
      { h: 'Quote', p: ['Pick a Rate Card package to prefill the price, or open the Catering Calculator to price per head. Set the F&B minimum and quoted total, then Send Quote. Quote PDF prints a clean estimate to email the guest.'] },
      { h: 'Deposit and Balance', p: ['Once a booking has a quote, track the deposit you took and the balance still due. Mark the deposit and balance paid as the money comes in. Deposits still owed roll up on the pipeline stat strip.'] },
      { h: 'Staffing', p: ['Schedule Staff for this Event jumps to Build Schedule for the event date. Tag the shift to the event and its hours flow into the Event P&L automatically. Catering and offsite gigs use the Event shift so odd-time work fits.'] },
      { h: 'Event P&L', p: ['Revenue comes from the tagged shifts when present, otherwise the actual revenue you type. Labor pulls from Labor Control on those shift dates. Food and bar cost are your estimates. The margin tells you whether the event was worth running.'] }
    ]);
  }
};
