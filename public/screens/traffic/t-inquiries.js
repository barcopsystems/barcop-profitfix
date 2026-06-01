'use strict';

/* ── Traffic Recovery — Group Inquiries (writes traffic_inquiries) ────────────
   Sales pipeline for group and private event inquiries. Distinct from
   Revenue Recovery's Events screen, which tracks events that already booked.
   This is where the lead lives: someone called, emailed, or walked in
   asking about a party, and what happened next.

   Status moves through: New → Called Back → Quote Sent → Booked / Declined /
   Lost. Bar Cop calculates conversion rate from closed (Booked vs Declined +
   Lost) inquiries. Operators usually find they\'re losing 40% because they
   didn\'t call back fast enough — which the log makes visible. When an
   inquiry flips to Booked, fix_log credits the win. */

S.TrafficInquiries = {
  editId: null,
  filterStatus: '',

  EVENT_TYPES: ['Birthday', 'Corporate', 'Rehearsal Dinner', 'Bridal/Baby Shower', 'Holiday Party', 'Reunion', 'Memorial', 'Other'],
  SOURCES:     ['Phone', 'Email', 'Website Form', 'Walk-in', 'Referral', 'OpenTable/Resy', 'Other'],
  STATUSES:    ['New', 'Called Back', 'Quote Sent', 'Booked', 'Declined', 'Lost'],
  STATUS_COLOR: {
    'New':         'var(--gold)',
    'Called Back': 'var(--steel)',
    'Quote Sent':  'var(--amber)',
    'Booked':      'var(--green)',
    'Declined':    'var(--t3)',
    'Lost':        'var(--red)'
  },
  CLOSED:    ['Booked', 'Declined', 'Lost'],

  inquiries() {
    if (!Array.isArray(App.data.traffic_inquiries)) App.data.traffic_inquiries = [];
    return App.data.traffic_inquiries;
  },

  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((today - d) / 86400000);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Worksheet';
    printBtn.addEventListener('click', () => this.printBlankSheet());
    this.actions.appendChild(printBtn);
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Log Inquiry';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.inquiries();
    const filtered = this.filterStatus ? all.filter(i => i.status === this.filterStatus) : all;
    filtered.sort((a, b) => (b.date_received || '').localeCompare(a.date_received || ''));

    const ninetyAgo = new Date(); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
    const recentClosed = all.filter(i => this.CLOSED.includes(i.status) && i.date_received && new Date(i.date_received) >= ninetyAgo);
    const recentBooked = recentClosed.filter(i => i.status === 'Booked');
    const conversion = recentClosed.length ? Math.round(100 * recentBooked.length / recentClosed.length) : null;
    // A conversion % off 1-2 closed inquiries is noise (1 of 1 = 100%). Only show
    // the rate once there is a real sample; show the raw count until then.
    const convShown = recentClosed.length >= 5;

    const openInquiries = all.filter(i => !this.CLOSED.includes(i.status));
    const stale = openInquiries.filter(i => { const d = this.daysSince(i.date_received); return d != null && d >= 3; });

    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Open Inquiries</div><div class="calc-val ' + (openInquiries.length ? 'good' : '') + '">' + openInquiries.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Stale (3+ Days)</div><div class="calc-val ' + (stale.length ? 'warn' : '') + '">' + stale.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Booked (Last 90d)</div><div class="calc-val">' + recentBooked.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Conversion (Last 90d)</div><div class="calc-val ' + (convShown && conversion >= 50 ? 'good' : convShown && conversion < 25 ? 'warn' : '') + '">' + (convShown ? conversion + '%' : (recentClosed.length ? recentBooked.length + ' of ' + recentClosed.length : '-')) + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No inquiries logged yet</div>'
        + '<div class="empty-sub">Every call, email, or walk-in asking about a party, a corporate dinner, a rehearsal, a memorial. Log the lead when it comes in. Move it through Called Back → Quote Sent → Booked or Lost. Operators who track inquiries usually find they\'re losing 40% because they didn\'t call back fast enough. The log shows it.</div>'
        + '<button class="btn btn-primary" id="tq-add-first">Log Your First Inquiry</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No inquiries match the filter</div>'
        + '<div class="empty-sub">Adjust or clear the filter above.</div></div>';
    } else {
      const rows = filtered.slice(0, 200).map(i => {
        const days = this.daysSince(i.date_received);
        const isOpen = !this.CLOSED.includes(i.status);
        const stale = isOpen && days != null && days >= 3;
        const statusBadge = '<span style="color:' + (this.STATUS_COLOR[i.status] || 'var(--t1)') + ';font-weight:700;">' + esc(i.status || '-') + '</span>';
        const contactInfo = (i.contact_email || i.contact_phone) ? '<div style="font-size:10px;color:var(--t3);">' + esc(i.contact_email || i.contact_phone) + '</div>' : '';
        return '<tr class="tq-row" data-id="' + i.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(i.contact_name || '-') + '</div>' + contactInfo + '</td>'
          + '<td>' + this.fmtDate(i.date_received) + (days != null && isOpen ? ' <span style="color:' + (stale ? 'var(--red)' : 'var(--t3)') + ';font-size:10px;">(' + days + 'd)</span>' : '') + '</td>'
          + '<td>' + esc(i.event_type || '-') + '</td>'
          + '<td>' + (i.party_size ? i.party_size + ' guests' : '-') + '</td>'
          + '<td>' + (i.event_date ? this.fmtDate(i.event_date) : '-') + '</td>'
          + '<td>' + esc(i.source || '-') + '</td>'
          + '<td>' + statusBadge + '</td>'
          + '<td><div class="row-actions">'
          +   '<button class="btn btn-ghost btn-sm tq-edit" data-id="' + i.id + '">Edit</button>'
          +   '<button class="btn btn-danger btn-sm tq-del" data-id="' + i.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = summary + this.filterCard()
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Contact</th><th>Received</th><th>Type</th><th>Party</th><th>Event Date</th><th>Source</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  filterCard() {
    const statusOpts = '<option value="">All statuses</option>'
      + this.STATUSES.map(s => '<option value="' + esc(s) + '"' + (this.filterStatus === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      +   '<div class="f" style="width:170px;flex-shrink:0;"><label>Status</label><select id="tq-f-status">' + statusOpts + '</select></div>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="tq-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.tq-row');
      const edit = ev.target.closest('.tq-edit');
      const del  = ev.target.closest('.tq-del');
      const addF = ev.target.closest('#tq-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('tq-f-status')?.addEventListener('change', e => { this.filterStatus = e.target.value || ''; this.renderList(); });
    document.getElementById('tq-f-clear')?.addEventListener('click', () => { this.filterStatus = ''; this.renderList(); });
  },

  showForm(id) {
    this.editId = id || null;
    const i = id ? this.inquiries().find(x => x.id === id) : null;
    const today = new Date().toISOString().slice(0, 10);
    const typeOpts   = '<option value="">-</option>' + this.EVENT_TYPES.map(t =>
      '<option' + (i && i.event_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const sourceOpts = '<option value="">-</option>' + this.SOURCES.map(s =>
      '<option' + (i && i.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const statusOpts = this.STATUSES.map(s =>
      '<option' + ((i && i.status === s) || (!i && s === 'New') ? ' selected' : '') + '>' + esc(s) + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Inquiry' : 'Log an Inquiry') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Capture the lead while it\'s fresh. Move the status as you work it: called them back, sent a quote, booked or lost. The conversion rate on the summary card tells you the truth about how many leads turn into events.</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:230px;flex-shrink:0;"><label>Contact Name</label>'
          + '<input type="text" id="tq-contact-name" value="' + esc(i?.contact_name || '') + '" placeholder="Jen Mitchell"/></div>'
        + '<div class="f" style="width:230px;flex-shrink:0;"><label>Email</label>'
          + '<input type="email" id="tq-contact-email" value="' + esc(i?.contact_email || '') + '" placeholder="Optional"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Phone</label>'
          + '<input type="tel" id="tq-contact-phone" value="' + esc(i?.contact_phone || '') + '" placeholder="Optional"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Date Received</label>'
          + '<input type="date" id="tq-date-received" value="' + esc(i?.date_received || today) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Source</label>'
          + '<select id="tq-source">' + sourceOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Event Type</label>'
          + '<select id="tq-event-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label>'
          + '<select id="tq-status">' + statusOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Event Date</label>'
          + '<input type="date" id="tq-event-date" value="' + esc(i?.event_date || '') + '"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Party Size</label>'
          + '<div class="fw"><input class="suf" type="number" id="tq-party-size" min="1" value="' + (i?.party_size != null ? i.party_size : '') + '"/><span class="suf">guests</span></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Quoted Total (optional)</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tq-quoted" min="0" step="50" value="' + (i?.quoted_total != null ? i.quoted_total : '') + '"/></div></div>'
      + '</div>'

      + '<div class="f" style="margin-bottom:0;"><label>Notes (what they asked, when you followed up, why it closed)</label>'
        + '<textarea id="tq-notes" rows="3" placeholder="Phoned 5/12 said she needs a private room for 18, anniversary dinner. Quoted prix-fixe Saturday 6pm. Lost to the steakhouse downtown over the room layout.">' + esc(i?.notes || '') + '</textarea></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tq-save">' + (id ? 'Update' : 'Log Inquiry') + '</button>'
        + '<button class="btn btn-ghost" id="tq-cancel">Cancel</button>'
        + '<span id="tq-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('tq-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('tq-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('tq-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const contactName  = document.getElementById('tq-contact-name')?.value.trim() || '';
    const dateReceived = document.getElementById('tq-date-received')?.value;
    if (!contactName)  { fail('Contact name is required.'); return; }
    if (!dateReceived) { fail('Date received is required.'); return; }

    const before = this.editId ? this.inquiries().find(x => x.id === this.editId) : null;
    const beforeStatus = before?.status || null;

    const rec = {
      id:             this.editId || App.uid(),
      contact_name:   contactName,
      contact_email:  document.getElementById('tq-contact-email')?.value.trim() || '',
      contact_phone:  document.getElementById('tq-contact-phone')?.value.trim() || '',
      date_received:  dateReceived,
      source:         document.getElementById('tq-source')?.value || '',
      event_type:     document.getElementById('tq-event-type')?.value || '',
      event_date:     document.getElementById('tq-event-date')?.value || '',
      party_size:     parseInt(document.getElementById('tq-party-size')?.value) || null,
      quoted_total:   parseFloat(document.getElementById('tq-quoted')?.value) || null,
      status:         document.getElementById('tq-status')?.value || 'New',
      notes:          document.getElementById('tq-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.inquiries();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('tq-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('traffic_inquiries');
    if (ok) {
      // fix_log emit when an inquiry just flipped to Booked. Closing a lead
      // is the most direct traffic-to-revenue conversion an operator can
      // make; credit the Recovery Scoreboard for it.
      if (rec.status === 'Booked' && beforeStatus !== 'Booked') {
        const partyTxt = rec.party_size ? ' (' + rec.party_size + ' guests)' : '';
        await App.emitTrafficFix('email-loyalty', 'Group inquiry booked: ' + rec.contact_name + partyTxt);
      }
      this.editId = null;
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update' : 'Log Inquiry'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this inquiry?', confirmText: 'Delete' });
    if (!ok) return;
    App.data.traffic_inquiries = this.inquiries().filter(x => x.id !== id);
    await App.saveKey('traffic_inquiries');
    this.renderList();
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Group Inquiries',
      subtitle: 'Capture inquiries on paper at the host stand; type into Bar Cop after.',
      columns: [
        { label: 'Date',        width: '90px'  },
        { label: 'Contact',     width: '140px' },
        { label: 'Phone/Email', width: '160px' },
        { label: 'Party',       width: '70px'  },
        { label: 'Event Date',  width: '100px' },
        { label: 'Type',        width: '110px' },
        { label: 'Notes' }
      ],
      rows: 12
    });
  }
};
