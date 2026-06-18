'use strict';

/* ── Events — Bookings ────────────────────────────────────────────────────────
   The unified bookings pipeline: one record per party, worked cradle to grave
   through Lead -> Quote Sent -> Booked -> Completed / Lost.

   List = stat strip + stage filter chips + the pipeline table. Open a booking and
   it becomes an "Active Booking" workspace: the STAGE drives the layout, like
   Active Shift. Each stage shows only what it needs and the one action that moves
   it forward, instead of every card and button at once. Send Quote emails the
   customer (the vendor-order mailto pattern) and marks it Quote Sent. Costs and
   the P&L are collected at the Completed stage, where they actually exist. */

S.EventsBookings = {
  _detailId: null,
  filterStage: '',

  STAGES: ['Lead', 'Quote Sent', 'Booked', 'Completed', 'Lost'],
  STAGE_FLOW: ['Lead', 'Quote Sent', 'Booked', 'Completed'],
  EVENT_TYPES: ['Birthday', 'Corporate', 'Rehearsal Dinner', 'Bridal/Baby Shower', 'Holiday Party', 'Reunion', 'Memorial', 'Buyout', 'Private Dining', 'Catering (Offsite)', 'Other'],
  SOURCES: ['Phone', 'Email', 'Website Form', 'Walk-in', 'Referral', 'OpenTable/Resy', 'Repeat Guest', 'Other'],

  // Color = meaning only: a win (completed) is green, a loss is red, in-flight is neutral.
  stageColor(stage) { return stage === 'Completed' ? 'var(--green)' : stage === 'Lost' ? 'var(--red)' : 'var(--t2)'; },

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

  // Persist a partial change to a booking, then re-render in place.
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
    // Deep-link from the Calendar / Dashboard: open a specific booking.
    if (App._evBookingFocus) {
      const fid = App._evBookingFocus; App._evBookingFocus = null;
      if (this.bookings().some(b => b.id === fid)) { this.openDetail(fid); return; }
    }
    // A normal landing always shows the pipeline. (Without this, a sticky
    // _detailId re-opened the last booking with no way back to the list.)
    this._detailId = null;
    this.renderList();
  },

  // ── List / pipeline ──────────────────────────────────────────────────────
  renderList() {
    this._detailId = null;
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
      this.container.onclick = ev => {
        const go = ev.target.closest('.setup-go');
        if (!go) return;
        if (go.dataset.go) App.navigate(go.dataset.go);
        else this.showForm();
      };
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
      + stat('Pipeline Value', App.fmtCurrency(pipelineVal))
      + stat('Deposits Due', App.fmtCurrency(depositsDue), depositsDue ? 'warn' : '')
      + '</div></div>';

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
      const dUntil = this.daysUntil(b.event_date);
      const stale = this.isOpen(b.stage) && (this.daysSince(b.date_received) >= 3);
      const money = b.stage === 'Completed' ? App.fmtCurrency(this.bookingRevenue(b))
        : (b.quoted_total ? App.fmtCurrency(b.quoted_total) : (b.fb_minimum ? App.fmtCurrency(b.fb_minimum) + ' min' : '-'));
      const dep = b.stage === 'Booked'
        ? (b.deposit_paid_date ? '<span style="color:var(--green);">Deposit paid</span>'
            : (b.deposit_amount ? '<span style="color:var(--amber);">' + App.fmtCurrency(b.deposit_amount) + ' due</span>' : '<span style="color:var(--t3);">-</span>'))
        : '<span style="color:var(--t3);">-</span>';
      return '<tr class="eb-row" data-id="' + esc(b.id) + '" style="cursor:pointer;">'
        + '<td><div class="val" style="font-weight:600;">' + esc(this.title(b)) + '</div>'
        +   (b.contact_name && b.event_name ? '<div style="font-size:10px;color:var(--t3);">' + esc(b.contact_name) + '</div>' : '') + '</td>'
        + '<td>' + esc(b.event_type || '-') + '</td>'
        + '<td>' + (b.event_date ? this.fmtDate(b.event_date) + (dUntil != null && dUntil >= 0 && dUntil <= 30 && b.stage === 'Booked' ? ' <span style="color:var(--t3);font-size:10px;">(' + dUntil + 'd)</span>' : '') : (stale ? '<span style="color:var(--red);font-size:11px;">stale</span>' : '-')) + '</td>'
        + '<td>' + (b.party_size ? b.party_size : '-') + '</td>'
        + '<td>' + money + '</td>'
        + '<td>' + dep + '</td>'
        + '<td style="color:' + this.stageColor(b.stage) + ';font-weight:700;">' + esc(b.stage || '') + '</td>'
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

  // ── Active Booking workspace (stage-driven, Active-Shift style) ───────────
  openDetail(id) {
    this._detailId = id;
    App.pushView(() => this.renderDetail(id));   // floating back returns to the pipeline
  },

  stageStepper(b) {
    if (b.stage === 'Lost') {
      return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 2px;">'
        + '<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--red);border:1px solid var(--red);border-radius:4px;padding:5px 11px;">Lost</span>'
        + '<span style="font-size:12px;color:var(--t3);">Closed. Reopen it to put it back in the pipeline.</span></div>';
    }
    const cur = this.STAGE_FLOW.indexOf(b.stage);
    const pills = this.STAGE_FLOW.map((s, i) => {
      const done = i < cur, here = i === cur;
      const style = here ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
        : done ? 'border:1px solid var(--b2);color:var(--t2);' : 'border:1px solid var(--b1);color:var(--t4);';
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;letter-spacing:0.5px;border-radius:4px;padding:5px 11px;' + style + '">'
        + (done ? '<span style="color:var(--green);">&#10003;</span>' : '') + esc(s) + '</span>';
    });
    return '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:14px 0 2px;">'
      + pills.join('<span style="color:var(--t4);">&#8250;</span>') + '</div>';
  },

  renderDetail(id) {
    const b = this.bookings().find(x => x.id === id);
    if (!b) { this._detailId = null; this.renderList(); return; }
    this._detailId = id;
    if (this.actions) this.actions.innerHTML = '';
    const stage = b.stage || 'Lead';
    const col = this.stageColor(stage);

    // Header + stepper
    let html = '<div class="screen">'
      + '<div class="card form-card">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
          + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Booking</div>'
          + '<div style="font-size:20px;font-weight:800;color:var(--t1);">' + esc(this.title(b)) + '</div>'
          + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + esc(b.event_type || '') + (b.event_date ? ' &middot; ' + this.fmtDate(b.event_date) : '') + (b.party_size ? ' &middot; ' + b.party_size + ' guests' : '') + '</div></div>'
          + '<div style="text-align:right;"><span style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + col + ';border:1px solid ' + col + ';border-radius:3px;padding:4px 10px;">' + esc(stage) + '</span></div>'
        + '</div>'
        + this.stageStepper(b)
      + '</div>';

    // Contact and Event (always shown)
    const reg = b.regular_id ? this.regulars().find(r => r.id === b.regular_id) : null;
    const dispRow = (label, val) => '<div class="f"><label>' + label + '</label><div style="font-size:13px;color:var(--t1);">' + (val ? esc(val) : '<span style="color:var(--t4);">-</span>') + '</div></div>';
    html += '<div class="sh" style="margin:18px 0 10px;">Contact and Event</div>'
      + '<div class="card form-card">'
        + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">'
          + dispRow('Contact', b.contact_name) + dispRow('Phone', b.contact_phone) + dispRow('Email', b.contact_email) + dispRow('Source', b.source)
        + '</div>'
        + '<div class="form-row" style="gap:18px;flex-wrap:wrap;margin-top:6px;">'
          + dispRow('Event Date', b.event_date ? this.fmtDate(b.event_date) : '') + dispRow('Time', b.event_time) + dispRow('Party Size', b.party_size ? String(b.party_size) : '') + dispRow('Space', b.space)
        + '</div>'
        + (reg ? '<div style="font-size:11px;color:var(--t2);margin-top:8px;">Linked regular: ' + esc(reg.name || '') + '</div>' : '')
        + (b.requests ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;padding-top:10px;border-top:1px solid var(--b2);">' + esc(b.requests) + '</div>' : '')
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-edit">Edit Details</button></div>'
      + '</div>';

    // Lost: reason only, then the reopen action.
    if (stage === 'Lost') {
      if (b.lost_reason) html += '<div class="sh" style="margin:18px 0 10px;">Why It Closed</div>'
        + '<div class="card form-card"><div style="font-size:13px;color:var(--t2);line-height:1.6;">' + esc(b.lost_reason) + '</div></div>';
      html += this.actionBar(stage);
      html += '</div>';
      this.container.innerHTML = html;
      this.wireDetail(b);
      return;
    }

    // Quote — editable builder while open (Lead / Quote Sent), locked summary once booked.
    if (stage === 'Lead' || stage === 'Quote Sent') {
      const rcOpts = '<option value="">Pick a package (optional)</option>' + this.rateCards().map(r =>
        '<option value="' + esc(r.id) + '"' + (b.rate_card_id === r.id ? ' selected' : '') + '>' + esc(r.package_name || '') + '</option>').join('');
      html += '<div class="sh" style="margin:18px 0 10px;">Quote</div>'
        + '<div class="card form-card">'
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
          + '</div>'
        + '</div>';
    } else {
      const qrow = (k, v) => '<div class="f"><label>' + k + '</label><div style="font-size:13px;color:var(--t1);">' + v + '</div></div>';
      html += '<div class="sh" style="margin:18px 0 10px;">Quote</div>'
        + '<div class="card form-card">'
          + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">'
            + qrow('Per Head', b.per_head ? App.fmtCurrency(b.per_head) : '-')
            + qrow('F&B Minimum', b.fb_minimum ? App.fmtCurrency(b.fb_minimum) : '-')
            + qrow('Quoted Total', App.fmtCurrency(parseFloat(b.quoted_total) || 0))
          + '</div>'
          + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-q-pdf">Quote PDF</button></div>'
        + '</div>';
    }

    // Deposit and Balance + Staffing — once it's Booked (through Completed).
    if (stage === 'Booked' || stage === 'Completed') {
      const bal = this.balanceDue(b);
      html += '<div class="sh" style="margin:18px 0 10px;">Deposit and Balance</div>'
        + '<div class="card form-card">'
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

      const ls = this.linkedShifts(b);
      html += '<div class="sh" style="margin:18px 0 10px;">Staffing</div>'
        + '<div class="card form-card">'
          + (ls.length === 0
              ? '<div style="font-size:12px;color:var(--t4);">No shifts tagged to this event yet.</div>'
              : '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Shift</th><th>Bar</th><th>Floor</th></tr></thead><tbody>'
                + ls.map(s => '<tr><td>' + esc(s.date || '') + '</td><td>' + esc(s.shift_type || '') + '</td><td>' + App.fmtCurrency(s.bar_revenue || 0) + '</td><td>' + App.fmtCurrency(s.floor_revenue || 0) + '</td></tr>').join('')
                + '</tbody></table></div>')
          + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-staff">Schedule Staff for this Event</button></div>'
        + '</div>';
    }

    // Event P&L — the payoff, at Completed. Costs are entered here.
    if (stage === 'Completed') {
      const ls = this.linkedShifts(b);
      const rev = this.bookingRevenue(b);
      const labor = this.bookingLabor(b);
      const food = parseFloat(b.event_food_cost) || 0, bar = parseFloat(b.event_bar_cost) || 0, other = parseFloat(b.event_other_cost) || 0;
      const totalCost = food + bar + labor + other;
      const margin = rev - totalCost;
      const marginPct = rev > 0 ? (margin / rev * 100) : null;
      const pl = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
      html += '<div class="sh" style="margin:18px 0 10px;">Event P&amp;L</div>'
        + '<div class="card form-card">'
          + '<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start;">'
            + pl('Revenue', App.fmtCurrency(rev))
            + pl('Food Cost', App.fmtCurrency(food))
            + pl('Bar Cost', App.fmtCurrency(bar))
            + pl('Labor', App.fmtCurrency(labor))
            + (other > 0 ? pl('Other', App.fmtCurrency(other)) : '')
            + pl('Margin', App.fmtCurrency(margin), margin >= 0 ? 'good' : 'warn')
            + pl('Margin %', marginPct != null ? marginPct.toFixed(1) + '%' : '-', marginPct != null && marginPct >= 30 ? 'good' : 'warn')
          + '</div>'
          + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);">'
            + '<div class="f" style="width:150px;flex-shrink:0;"><label>Food Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-food" value="' + (b.event_food_cost != null && b.event_food_cost !== 0 ? b.event_food_cost : '') + '"/></div></div>'
            + '<div class="f" style="width:150px;flex-shrink:0;"><label>Bar Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-bar" value="' + (b.event_bar_cost != null && b.event_bar_cost !== 0 ? b.event_bar_cost : '') + '"/></div></div>'
            + '<div class="f" style="width:150px;flex-shrink:0;"><label>Other Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-other" value="' + (b.event_other_cost != null && b.event_other_cost !== 0 ? b.event_other_cost : '') + '"/></div></div>'
            + (ls.length ? '' : '<div class="f" style="width:170px;flex-shrink:0;"><label>Actual Revenue</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-actual" value="' + (b.actual_revenue != null && b.actual_revenue !== 0 ? b.actual_revenue : '') + '"/></div></div>')
          + '</div>'
          + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-pl-save">Save P&amp;L</button></div>'
        + '</div>';
    }

    html += this.actionBar(stage);
    html += '</div>';
    this.container.innerHTML = html;
    this.wireDetail(b);
  },

  // The one forward action for the stage, plus the quiet secondaries.
  actionBar(stage) {
    const act = [];
    if (stage === 'Lead')        act.push('<button class="btn btn-primary btn-sm" id="eb-send">Send Quote</button>');
    if (stage === 'Quote Sent') { act.push('<button class="btn btn-primary btn-sm eb-stage" data-to="Booked">Mark Booked</button>'); act.push('<button class="btn btn-ghost btn-sm" id="eb-resend">Resend Quote</button>'); }
    if (stage === 'Booked')      act.push('<button class="btn btn-primary btn-sm eb-stage" data-to="Completed">Mark Completed</button>');
    if (stage === 'Completed')   act.push('<button class="btn btn-ghost btn-sm eb-stage" data-to="Booked">Reopen</button>');
    if (stage === 'Lost')        act.push('<button class="btn btn-ghost btn-sm eb-stage" data-to="Lead">Reopen</button>');
    if (stage !== 'Lost' && stage !== 'Completed') act.push('<button class="btn btn-ghost btn-sm" id="eb-lost">Mark Lost</button>');
    return '<div style="margin-top:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Next Step</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' + act.join('')
      + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div></div>';
  },

  collectQuote(id) {
    const ph = document.getElementById('eb-q-ph'), fb = document.getElementById('eb-q-fb'), tot = document.getElementById('eb-q-total');
    const f = {};
    if (ph)  f.per_head = parseFloat(ph.value) || 0;
    if (fb)  f.fb_minimum = parseFloat(fb.value) || 0;
    if (tot) f.quoted_total = parseFloat(tot.value) || 0;
    return f;
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
    document.getElementById('eb-q-save')?.addEventListener('click', () => this.patch(id, this.collectQuote(id)));
    document.getElementById('eb-q-calc')?.addEventListener('click', () => this.quoteCalc(id));
    document.getElementById('eb-q-pdf')?.addEventListener('click', () => this.quotePDF(this.bookings().find(x => x.id === id)));
    // Money
    document.getElementById('eb-dep-save')?.addEventListener('click', () => this.patch(id, { deposit_amount: parseFloat(document.getElementById('eb-dep')?.value) || 0 }));
    document.getElementById('eb-dep-paid')?.addEventListener('click', () => this.patch(id, { deposit_amount: parseFloat(document.getElementById('eb-dep')?.value) || (parseFloat(b.deposit_amount) || 0), deposit_paid_date: App.todayLocal() }));
    document.getElementById('eb-bal-paid')?.addEventListener('click', () => this.patch(id, { balance_paid_date: App.todayLocal() }));
    // Staffing
    document.getElementById('eb-staff')?.addEventListener('click', () => { App._eventStaffTag = b.event_name || this.title(b); App._eventStaffDate = b.event_date || ''; App.openScreen('lc-build-schedule'); });
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

  // Mark Lost with a captured reason (App.confirm only returns a boolean, so the
  // reason needs its own small form).
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
    if (b.per_head)    L.push('Per head: ' + App.fmtCurrency(b.per_head));
    if (b.fb_minimum)  L.push('Food and beverage minimum: ' + App.fmtCurrency(b.fb_minimum));
    L.push('Quoted total: ' + App.fmtCurrency(parseFloat(b.quoted_total) || 0));
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
    const fields = this.collectQuote(id);
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
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + fld('Guest Count', 'qc-guests', b.party_size || '')
        + fld('Food Cost / Head', 'qc-food', '', '$')
        + fld('Bar Cost / Head', 'qc-bar', '', '$')
        + fld('Staff Hours', 'qc-hrs', '')
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + fld('Avg Staff Wage', 'qc-wage', wage, '$')
        + fld('Other Costs', 'qc-other', '', '$')
        + fld('Target Food Cost %', 'qc-tgt', tgt, null, '%')
      + '</div>'
      + '<div id="qc-result" style="margin-top:6px;"></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="qc-apply">Apply to Quote</button>'
      +   '<button class="btn btn-ghost" id="qc-cancel">Cancel</button></div></div>';
    App.openModal(html, { id: 'eb-calc-modal', maxWidth: 680, noClose: true });
    const recompute = () => {
      const g = x => parseFloat(document.getElementById(x)?.value) || 0;
      const guests = g('qc-guests'), el = document.getElementById('qc-result');
      if (!el) return null;
      if (!guests) { el.innerHTML = ''; return null; }
      const totalCost = g('qc-food') * guests + g('qc-bar') * guests + g('qc-hrs') * (g('qc-wage') || 13) + g('qc-other');
      const t = g('qc-tgt') || 28;
      const perHeadCost = totalCost / guests;
      const perHeadPrice = t > 0 ? perHeadCost / (t / 100) : 0;
      const totalRev = perHeadPrice * guests;
      const box = (label, val, gold) => '<div style="background:var(--input);border-radius:6px;padding:10px 12px;' + (gold ? 'border:1px solid var(--gold-tint-bord);' : '') + '"><div style="font-size:10px;color:' + (gold ? 'var(--gold)' : 'var(--t3)') + ';">' + label + '</div><div style="font-size:' + (gold ? '20px' : '16px') + ';font-weight:' + (gold ? '800' : '700') + ';color:' + (gold ? 'var(--gold)' : 'var(--t1)') + ';">' + val + '</div></div>';
      el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">'
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
      this.patch(id, { per_head: Math.round(r.perHeadPrice * 100) / 100, quoted_total: Math.round(r.totalRev) });
    });
  },

  // ── Booking details form (shared add + Edit Details) ─────────────────────
  // Lead capture stays light: who / what / when. Cost and P&L numbers are
  // collected later, on the Completed stage where they actually exist.
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
        + '<div class="f"><label>Email</label><input type="email" id="ebf-email" value="' + esc(b?.contact_email || '') + '" placeholder="For the quote"/></div>'
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
      event_name:    name,
      contact_name:  cname,
      contact_phone: g('ebf-phone')?.value.trim() || '',
      contact_email: g('ebf-email')?.value.trim() || '',
      event_type:    g('ebf-type')?.value || '',
      source:        g('ebf-source')?.value || '',
      stage:         g('ebf-stage')?.value || 'Lead',
      event_date:    g('ebf-date')?.value || '',
      event_time:    g('ebf-time')?.value.trim() || '',
      party_size:    parseInt(g('ebf-party')?.value) || null,
      space:         g('ebf-space')?.value.trim() || '',
      date_received: g('ebf-recv')?.value || App.todayLocal(),
      regular_id:    g('ebf-reg')?.value || '',
      requests:      g('ebf-req')?.value.trim() || '',
      updated_at:    new Date().toISOString()
    });
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
      { p: ['One record per party, worked from the first call to the paid invoice. The pipeline up top shows what is open, what has gone stale, what is booked soon, and the deposits you are still owed. Tap New Booking to log a lead, or open any row to work it.'] },
      { h: 'The Stages', p: ['A booking moves Lead, Quote Sent, Booked, Completed. The stage drives the page: each stage shows only what you need and the one action that moves it forward, and the stepper at the top shows where it stands. Mark Lost any time before it completes; a lost booking stays in the pipeline so your conversion rate holds honest, and you can reopen it.'] },
      { h: 'Quote and Send', p: ['On a Lead, pick a Rate Card package to prefill the price, or tap Catering Calculator to price per head against a target food cost right on the booking. Set the quoted total, then Send Quote. Capture the customer email on the booking first; Send Quote opens a ready-to-send email with the quote in it, the same way you email a vendor order, and marks the booking Quote Sent. Quote PDF prints a clean copy to attach or hand over.'] },
      { h: 'Deposit and Balance', p: ['Once a booking is Booked, log the deposit you took and mark it paid. The balance is the quoted total minus the deposit; mark it paid when the money lands. Deposits still owed roll up on the pipeline and the dashboard.'] },
      { h: 'Staffing', p: ['Schedule Staff for this Event jumps to Build Schedule on the event date. Tag the shift with the event name and its hours flow into the Event P&L. Catering and offsite gigs use the Event shift so an odd-time job still fits the schedule.'] },
      { h: 'Event P&L', p: ['On a Completed booking, enter the food, bar, and other cost. Revenue comes from the tagged shifts when you have them, otherwise enter the actual revenue. Labor pulls from Labor Control on the tagged shift dates. The margin is your read on whether the event paid off.'] },
      { h: 'Getting Back', p: ['The back arrow at the bottom right returns you to the pipeline from any booking.'] }
    ]);
  }
};
