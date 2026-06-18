'use strict';

/* ── Events — Bookings ────────────────────────────────────────────────────────
   The unified bookings pipeline: one record per party, worked cradle to grave
   through Lead -> Quote Sent -> Booked -> Completed / Lost.

   Landing = stat strip + an inline New Booking form + the pipeline table.
   Open a booking and it becomes an "Active Booking" workspace built in the
   Active Shift design language: a live status header, a progress rail, stat
   tiles, and a single stage-driven "work it" zone with one big forward action,
   instead of card after card of identical buttons. Send Quote emails the
   customer (the vendor-order mailto pattern). Costs + the P&L are collected at
   the Completed stage, where they actually exist. */

S.EventsBookings = {
  _detailId: null,
  _addDraft: null,
  filterStage: '',

  STAGES: ['Lead', 'Quote Sent', 'Booked', 'Completed', 'Lost'],
  STAGE_FLOW: ['Lead', 'Quote Sent', 'Booked', 'Completed'],
  EVENT_TYPES: ['Birthday', 'Corporate', 'Rehearsal Dinner', 'Bridal/Baby Shower', 'Holiday Party', 'Reunion', 'Memorial', 'Buyout', 'Private Dining', 'Catering (Offsite)', 'Other'],
  SOURCES: ['Phone', 'Email', 'Website Form', 'Walk-in', 'Referral', 'OpenTable/Resy', 'Repeat Guest', 'Other'],

  // Color = meaning only: a win (completed) is green, a loss is red, in-flight is neutral.
  stageColor(stage) { return stage === 'Completed' ? 'var(--green)' : stage === 'Lost' ? 'var(--red)' : 'var(--t2)'; },
  // The live accent for the workspace header dot/label.
  stageAccent(stage) { return stage === 'Completed' ? 'var(--green)' : stage === 'Lost' ? 'var(--red)' : 'var(--gold)'; },

  bookings()  { if (!Array.isArray(App.data.bookings)) App.data.bookings = []; return App.data.bookings; },
  rateCards() { if (!Array.isArray(App.data.event_rate_cards)) App.data.event_rate_cards = []; return App.data.event_rate_cards; },
  regulars()  { if (!Array.isArray(App.data.event_regulars)) App.data.event_regulars = []; return App.data.event_regulars; },

  // ── shared visual atoms (the Active Shift language) ──────────────────────
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
  fieldsHtml(b, p) {
    const today = App.todayLocal();
    const typeOpts = '<option value="">-</option>' + this.EVENT_TYPES.map(t => '<option' + (b && b.event_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const srcOpts = '<option value="">-</option>' + this.SOURCES.map(s => '<option' + (b && b.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const stageOpts = this.STAGES.map(s => '<option' + ((b && b.stage === s) || (!(b && b.stage) && s === 'Lead') ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const regOpts = '<option value="">-</option>' + this.regulars().map(r => '<option value="' + esc(r.id) + '"' + (b && b.regular_id === r.id ? ' selected' : '') + '>' + esc(r.name || '') + '</option>').join('');
    const v = x => (x != null && x !== '') ? x : '';
    return '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Event Name</label><input type="text" id="' + p + '-name" value="' + esc(b?.event_name || '') + '" placeholder="Smith Rehearsal Dinner"/></div></div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Contact Name</label><input type="text" id="' + p + '-cname" value="' + esc(b?.contact_name || '') + '" placeholder="Jen Mitchell"/></div>'
        + '<div class="f"><label>Phone</label><input type="tel" id="' + p + '-phone" value="' + esc(b?.contact_phone || '') + '" placeholder="Optional"/></div>'
        + '<div class="f"><label>Email</label><input type="email" id="' + p + '-email" value="' + esc(b?.contact_email || '') + '" placeholder="For the quote"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Event Type</label><select id="' + p + '-type" class="form-input">' + typeOpts + '</select></div>'
        + '<div class="f"><label>Source</label><select id="' + p + '-source" class="form-input">' + srcOpts + '</select></div>'
        + '<div class="f"><label>Stage</label><select id="' + p + '-stage" class="form-input">' + stageOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Event Date</label><input type="date" id="' + p + '-date" value="' + esc(b?.event_date || '') + '"/></div>'
        + '<div class="f"><label>Time</label><input type="text" id="' + p + '-time" value="' + esc(b?.event_time || '') + '" placeholder="6:00 PM"/></div>'
        + '<div class="f"><label>Party Size</label><input type="number" id="' + p + '-party" value="' + v(b?.party_size) + '"/></div>'
        + '<div class="f"><label>Space</label><input type="text" id="' + p + '-space" value="' + esc(b?.space || '') + '" placeholder="Private room"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Date Received</label><input type="date" id="' + p + '-recv" value="' + esc(b?.date_received || today) + '"/></div>'
        + '<div class="f"><label>Link a Regular</label><select id="' + p + '-reg" class="form-input">' + regOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="width:100%;"><label>Requests / Notes</label><textarea id="' + p + '-req" class="notes-ta" rows="2" placeholder="What they asked for, follow-up notes, why it closed.">' + esc(b?.requests || '') + '</textarea></div>';
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
      regular_id:    g('reg')?.value || '',
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

    // Inline New Booking form (persists in-progress via _addDraft). Buttons below
    // the card, bottom-left.
    const addCard = '<div class="card form-card"><div class="card-title">New Booking</div>'
      + '<div id="eb-add-form">' + this.fieldsHtml(this._addDraft, 'ebn') + '</div></div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
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
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
        + '<button class="btn btn-ghost btn-sm" id="eb-worksheet">Worksheet</button></div>';

      const list = (this.filterStage ? all.filter(b => b.stage === this.filterStage) : all)
        .slice().sort((a, b) => (b.date_received || b.event_date || '').localeCompare(a.date_received || a.event_date || ''));

      const rows = list.slice(0, App.LIST_PAGE || 50).map(b => {
        const dUntil = this.daysUntil(b.event_date);
        const isStale = this.isOpen(b.stage) && (this.daysSince(b.date_received) >= 3);
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
          + '<td>' + (b.event_date ? this.fmtDate(b.event_date) + (dUntil != null && dUntil >= 0 && dUntil <= 30 && b.stage === 'Booked' ? ' <span style="color:var(--t3);font-size:10px;">(' + dUntil + 'd)</span>' : '') : (isStale ? '<span style="color:var(--red);font-size:11px;">stale</span>' : '-')) + '</td>'
          + '<td>' + (b.party_size ? b.party_size : '-') + '</td>'
          + '<td>' + money + '</td>'
          + '<td>' + dep + '</td>'
          + '<td style="color:' + this.stageColor(b.stage) + ';font-weight:700;">' + esc(b.stage || '') + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm eb-view" data-id="' + esc(b.id) + '">Open</button>'
          +   '<button class="btn btn-danger btn-sm eb-del" data-id="' + esc(b.id) + '">Delete</button></div></td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No bookings in this stage.</td></tr>';

      listSection = headRow
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Event</th><th>Type</th><th>Event Date</th><th>Party</th><th>Quote / Revenue</th><th>Deposit</th><th>Stage</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + statStrip + addCard + listSection + '</div>';
    this.wireList();
  },

  wireList() {
    // Keep the inline add form's in-progress entry alive across re-renders.
    document.getElementById('eb-add-form')?.addEventListener('input', () => { this._addDraft = this.collect('ebn'); });
    document.getElementById('eb-add')?.addEventListener('click', () => this.addBooking());
    document.getElementById('eb-startover')?.addEventListener('click', () => { this._addDraft = null; this.renderList(); });
    this.container.querySelectorAll('.eb-stage-chip').forEach(b =>
      b.addEventListener('click', () => { this.filterStage = b.dataset.v; this.renderList(); }));
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
    App.pushView(() => this.renderDetail(id));   // floating back returns to the pipeline
  },

  progressRail(b) {
    const flow = this.STAGE_FLOW;
    const lost = b.stage === 'Lost';
    const cur = flow.indexOf(b.stage);
    const node = (s, i) => {
      const done = !lost && i < cur, here = !lost && i === cur;
      const fill = (done || here) ? 'var(--gold)' : 'var(--input)';
      const bord = (done || here) ? 'var(--gold)' : 'var(--b1)';
      const ink = (done || here) ? 'var(--bg)' : 'var(--t4)';
      const glow = here ? 'box-shadow:0 0 0 4px var(--gold-tint);' : '';
      const lbl = here ? 'var(--t1)' : done ? 'var(--t2)' : 'var(--t4)';
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:7px;flex:0 0 auto;">'
        + '<span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:' + fill + ';border:1px solid ' + bord + ';color:' + ink + ';' + glow + '">' + (done ? '&#10003;' : (i + 1)) + '</span>'
        + '<span style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:' + lbl + ';text-align:center;">' + esc(s) + '</span></div>';
    };
    const conn = i => '<div style="flex:1;height:2px;background:' + (!lost && i <= cur ? 'var(--gold)' : 'var(--b1)') + ';margin-top:13px;min-width:16px;"></div>';
    const parts = [];
    flow.forEach((s, i) => { if (i) parts.push(conn(i)); parts.push(node(s, i)); });
    return '<div style="display:flex;align-items:flex-start;max-width:520px;">' + parts.join('') + '</div>';
  },

  statsRow(b) {
    const stage = b.stage;
    const t = [];
    if (stage === 'Lead' || stage === 'Quote Sent') {
      const ds = this.daysSince(b.date_received);
      t.push(this.statTile('Quoted Total', b.quoted_total ? App.fmtCurrency(b.quoted_total) : '-', 'what you are quoting'));
      t.push(this.statTile('Per Head', b.per_head ? App.fmtCurrency(b.per_head) : '-', b.party_size ? b.party_size + ' guests' : 'set the headcount'));
      t.push(this.statTile('Party Size', b.party_size ? String(b.party_size) : '-', 'guests'));
      t.push(this.statTile('Days Open', ds != null ? String(ds) : '-', ds != null && ds >= 3 ? 'follow up' : 'since the inquiry', ds != null && ds >= 3 ? 'warn' : ''));
    } else if (stage === 'Booked') {
      const dU = this.daysUntil(b.event_date);
      const cd = dU == null ? '-' : dU < 0 ? 'past' : dU === 0 ? 'today' : String(dU);
      const cdSub = dU == null ? 'no date set' : dU < 0 ? 'event date passed' : dU === 0 ? 'event is today' : 'days out';
      const bal = this.balanceDue(b);
      t.push(this.statTile('Countdown', cd, cdSub, dU != null && dU >= 0 && dU <= 7 ? 'warn' : ''));
      t.push(this.statTile('Quoted Total', App.fmtCurrency(parseFloat(b.quoted_total) || 0), 'the booking'));
      t.push(this.statTile('Deposit', b.deposit_paid_date ? 'Paid' : (b.deposit_amount ? App.fmtCurrency(b.deposit_amount) : '-'), b.deposit_paid_date ? 'in hand' : (b.deposit_amount ? 'still due' : 'none set'), b.deposit_paid_date ? 'good' : (b.deposit_amount ? 'warn' : '')));
      t.push(this.statTile('Balance Due', App.fmtCurrency(bal), b.balance_paid_date ? 'paid in full' : 'on event day', bal > 0 ? '' : 'good'));
    } else if (stage === 'Completed') {
      const rev = this.bookingRevenue(b);
      const labor = this.bookingLabor(b);
      const cost = (parseFloat(b.event_food_cost) || 0) + (parseFloat(b.event_bar_cost) || 0) + (parseFloat(b.event_other_cost) || 0) + labor;
      const margin = rev - cost;
      const mp = rev > 0 ? margin / rev * 100 : null;
      t.push(this.statTile('Revenue', App.fmtCurrency(rev), this.linkedShifts(b).length ? 'from tagged shifts' : 'actual entered'));
      t.push(this.statTile('Margin', App.fmtCurrency(margin), 'after all costs', margin >= 0 ? 'good' : 'bad'));
      t.push(this.statTile('Margin %', mp != null ? mp.toFixed(0) + '%' : '-', '30% is a solid event', mp != null && mp >= 30 ? 'good' : mp != null ? 'warn' : ''));
      t.push(this.statTile('Labor', App.fmtCurrency(labor), 'from Labor Control'));
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

    // ── Card 1: The Booking (header + progress + stat tiles + contact) ──
    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:' + accent + ';' + (live ? 'box-shadow:0 0 8px ' + accent + ';' : '') + '"></span>'
        + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:' + accent + ';">' + esc(stage) + '</span></div>'
        + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(this.title(b)) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + esc(b.event_type || '') + (b.event_date ? ' &middot; ' + this.fmtDate(b.event_date) : '') + (b.party_size ? ' &middot; ' + b.party_size + ' guests' : '') + (b.contact_name ? ' &middot; ' + esc(b.contact_name) : '') + '</div>'
        + (readout ? '<div style="font-size:13px;color:var(--gold);font-weight:600;margin-top:8px;">' + esc(readout) + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" id="eb-edit">Edit Details</button>'
        + '<button class="btn btn-ghost btn-sm" id="eb-q-pdf">Quote PDF</button>'
      + '</div></div>';

    const reg = b.regular_id ? this.regulars().find(r => r.id === b.regular_id) : null;
    const dispRow = (label, val) => '<div class="f"><label>' + label + '</label><div style="font-size:13px;color:var(--t1);">' + (val ? esc(val) : '<span style="color:var(--t4);">-</span>') + '</div></div>';
    const contact = this.subLabel('Contact and Event')
      + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">' + dispRow('Phone', b.contact_phone) + dispRow('Email', b.contact_email) + dispRow('Source', b.source) + dispRow('Time', b.event_time) + dispRow('Space', b.space) + '</div>'
      + (reg ? '<div style="font-size:11px;color:var(--t2);margin-top:8px;">Linked regular: ' + esc(reg.name || '') + '</div>' : '')
      + (b.requests ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;">' + esc(b.requests) + '</div>' : '');

    const statsRow = this.statsRow(b);
    let card1 = '<div class="card">' + header
      + this.divider() + this.subLabel('Progress') + this.progressRail(b)
      + (statsRow ? this.divider() + this.subLabel('This Booking') + statsRow : '')
      + this.divider() + contact;
    if (stage === 'Lost' && b.lost_reason) card1 += this.divider() + this.subLabel('Why It Closed') + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">' + esc(b.lost_reason) + '</div>';
    card1 += '</div>';

    // ── Card 2: Work It (stage-driven) ──
    let card2 = '';
    if (stage === 'Lead' || stage === 'Quote Sent') {
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
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-q-ph" value="' + (b.per_head != null && b.per_head !== 0 ? b.per_head : '') + '" step="0.01"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>F&amp;B Minimum</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-q-fb" value="' + (b.fb_minimum != null && b.fb_minimum !== 0 ? b.fb_minimum : '') + '"/></div></div>'
          + '<div class="f" style="width:160px;flex-shrink:0;"><label>Quoted Total</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-q-total" value="' + (b.quoted_total != null && b.quoted_total !== 0 ? b.quoted_total : '') + '"/></div></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-save">Save Quote</button>'
          + '<button class="btn btn-ghost btn-sm" id="eb-q-calc">Catering Calculator</button>'
        + '</div></div>';
    } else if (stage === 'Booked') {
      const bal = this.balanceDue(b);
      const ls = this.linkedShifts(b);
      card2 = '<div class="card form-card">' + this.subLabel('Collect the Deposit')
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:160px;flex-shrink:0;"><label>Deposit Amount</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-dep" value="' + (b.deposit_amount != null && b.deposit_amount !== 0 ? b.deposit_amount : '') + '"/></div></div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
            + '<button class="btn btn-ghost btn-sm" id="eb-dep-save">Save Deposit</button>'
            + (b.deposit_amount && !b.deposit_paid_date ? '<button class="btn btn-ghost btn-sm" id="eb-dep-paid">Mark Deposit Paid</button>' : '')
            + (!b.balance_paid_date && bal > 0 ? '<button class="btn btn-ghost btn-sm" id="eb-bal-paid">Mark Balance Paid</button>' : '')
          + '</div>'
        + '</div>'
        + this.divider() + this.subLabel('Staffing')
        + (ls.length === 0
            ? '<div style="font-size:12px;color:var(--t4);">No shifts tagged to this event yet. Schedule the staff and tag the shift to pull its hours into the P&amp;L.</div>'
            : '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Shift</th><th>Bar</th><th>Floor</th></tr></thead><tbody>'
              + ls.map(s => '<tr><td>' + esc(s.date || '') + '</td><td>' + esc(s.shift_type || '') + '</td><td>' + App.fmtCurrency(s.bar_revenue || 0) + '</td><td>' + App.fmtCurrency(s.floor_revenue || 0) + '</td></tr>').join('')
              + '</tbody></table></div>')
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-staff">Schedule Staff for this Event</button></div>'
        + '</div>';
    } else if (stage === 'Completed') {
      const ls = this.linkedShifts(b);
      card2 = '<div class="card form-card">' + this.subLabel('Close Out the P&amp;L')
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;align-items:flex-end;">'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Food Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-food" value="' + (b.event_food_cost != null && b.event_food_cost !== 0 ? b.event_food_cost : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Bar Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-bar" value="' + (b.event_bar_cost != null && b.event_bar_cost !== 0 ? b.event_bar_cost : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Other Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-other" value="' + (b.event_other_cost != null && b.event_other_cost !== 0 ? b.event_other_cost : '') + '"/></div></div>'
          + (ls.length ? '' : '<div class="f" style="width:170px;flex-shrink:0;"><label>Actual Revenue</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="eb-pl-actual" value="' + (b.actual_revenue != null && b.actual_revenue !== 0 ? b.actual_revenue : '') + '"/></div></div>')
        + '</div>'
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="eb-pl-save">Save P&amp;L</button></div>'
        + (ls.length ? this.divider() + this.subLabel('Staffing')
            + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Shift</th><th>Bar</th><th>Floor</th></tr></thead><tbody>'
            + ls.map(s => '<tr><td>' + esc(s.date || '') + '</td><td>' + esc(s.shift_type || '') + '</td><td>' + App.fmtCurrency(s.bar_revenue || 0) + '</td><td>' + App.fmtCurrency(s.floor_revenue || 0) + '</td></tr>').join('')
            + '</tbody></table></div>' : '')
        + '</div>';
    }

    const html = '<div class="screen">' + card1 + card2 + this.actionBar(stage) + '</div>';
    this.container.innerHTML = html;
    this.wireDetail(b);
  },

  // One big forward action for the stage, plus the quiet secondaries.
  actionBar(stage) {
    const act = [];
    if (stage === 'Lead')        act.push('<button class="btn btn-primary btn-lg" id="eb-send">Send Quote</button>');
    if (stage === 'Quote Sent') { act.push('<button class="btn btn-primary btn-lg eb-stage" data-to="Booked">Mark Booked</button>'); act.push('<button class="btn btn-ghost" id="eb-resend">Resend Quote</button>'); }
    if (stage === 'Booked')      act.push('<button class="btn btn-primary btn-lg eb-stage" data-to="Completed">Mark Completed</button>');
    if (stage === 'Completed')   act.push('<button class="btn btn-ghost eb-stage" data-to="Booked">Reopen</button>');
    if (stage === 'Lost')        act.push('<button class="btn btn-ghost eb-stage" data-to="Lead">Reopen</button>');
    if (stage !== 'Lost' && stage !== 'Completed') act.push('<button class="btn btn-ghost" id="eb-lost" style="color:var(--red);">Mark Lost</button>');
    return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' + act.join('')
      + '<button class="btn btn-danger btn-sm" id="eb-detail-del" style="margin-left:auto;">Delete</button></div>';
  },

  collectQuote() {
    const ph = document.getElementById('eb-q-ph'), fb = document.getElementById('eb-q-fb'), tot = document.getElementById('eb-q-total');
    const f = {};
    if (ph)  f.per_head = parseFloat(ph.value) || 0;
    if (fb)  f.fb_minimum = parseFloat(fb.value) || 0;
    if (tot) f.quoted_total = parseFloat(tot.value) || 0;
    return f;
  },

  applyRateCard(id, rcId) {
    const b = this.bookings().find(x => x.id === id);
    const cur = (b && b.rate_card_id === rcId) ? '' : rcId;   // tap the active pill again to clear it
    const rc = this.rateCards().find(r => r.id === cur);
    const fields = { rate_card_id: cur };
    if (rc) {
      if (rc.per_head != null) fields.per_head = rc.per_head;
      if (rc.fb_minimum != null) fields.fb_minimum = rc.fb_minimum;
      if (rc.per_head && b && b.party_size) fields.quoted_total = Math.round(rc.per_head * b.party_size);
      else if (rc.fb_minimum) fields.quoted_total = rc.fb_minimum;
    }
    this.patch(id, fields);
  },

  wireDetail(b) {
    const id = b.id;
    document.getElementById('eb-edit')?.addEventListener('click', () => this.showForm(id));
    document.getElementById('eb-q-pdf')?.addEventListener('click', () => this.quotePDF(this.bookings().find(x => x.id === id)));
    // Quote
    this.container.querySelectorAll('.eb-rc-pill').forEach(p => p.addEventListener('click', () => this.applyRateCard(id, p.dataset.rc)));
    document.getElementById('eb-q-rc')?.addEventListener('change', e => this.applyRateCard(id, e.target.value));
    document.getElementById('eb-q-save')?.addEventListener('click', () => this.patch(id, this.collectQuote()));
    document.getElementById('eb-q-calc')?.addEventListener('click', () => this.quoteCalc(id));
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

  // ── Edit Details (popup; uses the shared field set) ──────────────────────
  showForm(id) {
    const b = id ? this.bookings().find(x => x.id === id) : null;
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (id ? 'Edit Booking' : 'New Booking') + '</div>'
      + this.fieldsHtml(b, 'ebf')
      + '<div class="card-actions"><button class="btn btn-primary" id="ebf-save">' + (id ? 'Save Booking' : 'Create Booking') + '</button>'
      +   '<button class="btn btn-ghost" id="ebf-cancel">Cancel</button>'
      +   '<span id="ebf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';
    App.openModal(html, { id: 'eb-form', maxWidth: 680, noClose: true });
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
      { p: ['One record per party, worked from the first call to the paid invoice. The stat strip up top shows what is open, stale, booked soon, and the deposits you are owed. Log a lead in the New Booking form right on the page, or open any row to work it.'] },
      { h: 'The Active Booking', p: ['Open a booking and the page follows its stage, like Active Shift follows a shift. The header shows where it stands, the progress rail shows the lifecycle, the tiles show the numbers that matter at this stage, and one big button moves it forward. You only see what the stage needs.'] },
      { h: 'The Stages', p: ['A booking moves Lead, Quote Sent, Booked, Completed. Mark Lost any time before it completes; a lost booking stays in the pipeline so your conversion rate holds honest, and you can reopen it.'] },
      { h: 'Quote and Send', p: ['On a Lead, tap a Rate Card package to prefill the price, or open the Catering Calculator to price per head against a target food cost right on the booking. Set the quoted total, then Send Quote. Capture the customer email on the booking first; Send Quote opens a ready-to-send email with the quote in it, the same way you email a vendor order, and marks the booking Quote Sent. Quote PDF prints a clean copy to attach or hand over.'] },
      { h: 'Deposit and Balance', p: ['Once a booking is Booked, log the deposit you took and mark it paid. The balance is the quoted total minus the deposit; mark it paid when the money lands. Deposits still owed roll up on the pipeline and the dashboard.'] },
      { h: 'Staffing', p: ['Schedule Staff for this Event jumps to Build Schedule on the event date. Tag the shift with the event name and its hours flow into the Event P&L. Catering and offsite gigs use the Event shift so an odd-time job still fits the schedule.'] },
      { h: 'Event P&L', p: ['On a Completed booking, enter the food, bar, and other cost. Revenue comes from the tagged shifts when you have them, otherwise enter the actual revenue. Labor pulls from Labor Control on the tagged shift dates. The margin is your read on whether the event paid off.'] },
      { h: 'Getting Back', p: ['The back arrow at the bottom right returns you to the pipeline from any booking.'] }
    ]);
  }
};
