'use strict';

/* ── Hub Permits and Compliance Log ──────────────────────────────────────────
   A Hub-owned view under Compliance. Per-entry log of permits, licenses,
   and other recurring compliance items (liquor license, business license,
   health permit, fire safety, etc.). Each entry holds the renewal date,
   recurrence, last cost, and notes.

   Status awareness:
     - Expired: renewal_date is in the past
     - Critical (within 14 days): renewal_date is within 14 days
     - Due soon (within 30 days): renewal_date is within 30 days
     - Active: renewal_date is more than 30 days out

   Mark Renewed action: operator enters cost paid + date renewed. Bar Cop
   advances the renewal date based on recurrence and auto-creates an entry
   in the Operating Expenses log under 'Licenses and Permits' so the
   bookkeeper does not have to log it twice. Two-doors handled by the
   canonical store: the opex entry carries a note pointing back to the
   permit so the connection is visible.

   Bar Cop Audit reads App.data.permits_compliance to surface upcoming
   renewals in Top Operational Exposures. */

S.HubPermits = {

  // Locked type enum. Dropdown-only on the entry form. Operator labels each
  // permit with a free-text Name; Type is the broader category.
  TYPES: [
    'Liquor License',
    'Business License',
    'Health Permit',
    'Food Service Permit',
    'Fire Safety / Occupancy',
    'Music / Entertainment License',
    'Outdoor Seating Permit',
    'Sign Permit',
    'Workers Compensation',
    'Other'
  ],

  RECURRENCES: ['Annual', 'Biennial', 'Quarterly', 'Monthly', 'One-Time', 'Other'],

  _filter: 'all',  // all | due | expired | active

  records() {
    if (!Array.isArray(App.data.permits_compliance)) App.data.permits_compliance = [];
    return App.data.permits_compliance;
  },

  // ── Entry ───────────────────────────────────────────────────────────────
  /* ⭐⭐ IT IS A SHIFT CONTROL SCREEN NOW (build piece 5), so this navigates instead of opening a
     Hub full page. `open()` KEPT ITS NAME AND ITS CONTRACT deliberately: the Hub's three Needs
     Attention rows, the Books landing's Licensing button and its get-started step all call it, and
     renaming it would mean changing five callers to gain nothing. Kyle asked for exactly this —
     *"make sure any needs attention rows on the hub point to the new location"* — and the cheapest
     way to be sure is that every door still calls the same one function. */
  open() {
    App.navigate('sc-licensing');
  },
  /* The Shift Control mount, same signature every screen in that module uses. `open()` above routes
     here; `App.navigate` sets the container and calls this. */
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.renderMain();
  },

  // ── Status helpers ─────────────────────────────────────────────────────
  _today() { const d = new Date(); d.setHours(0,0,0,0); return d; },
  _daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return Math.floor((d - this._today()) / 86400000);
  },
  _status(record) {
    if (!record || !record.renewal_date) return { key: 'unknown', label: 'No renewal date', color: 'var(--t3)', days: null };
    const days = this._daysUntil(record.renewal_date);
    if (days == null) return { key: 'unknown', label: 'No renewal date', color: 'var(--t3)', days: null };
    if (days < 0) return { key: 'expired',  label: 'Expired ' + Math.abs(days) + ' day' + (Math.abs(days)===1?'':'s') + ' ago', color: 'var(--red)',   days };
    if (days <= 14) return { key: 'critical', label: 'Due in ' + days + ' day' + (days===1?'':'s'),                              color: 'var(--amber)', days };
    if (days <= 30) return { key: 'warn',     label: 'Due in ' + days + ' days',                                                  color: 'var(--amber)', days };
    return { key: 'active', label: 'Due in ' + days + ' days', color: 'var(--t2)', days };
  },
  _fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Compute the next renewal date given a renewed-on date and a recurrence.
  // Returns yyyy-mm-dd, or null for One-Time / Other (operator picks manually).
  _nextRenewal(renewedDate, recurrence) {
    if (!renewedDate) return null;
    const d = new Date(String(renewedDate).length <= 10 ? renewedDate + 'T00:00:00' : renewedDate);
    if (isNaN(d.getTime())) return null;
    if (recurrence === 'Annual')    d.setFullYear(d.getFullYear() + 1);
    else if (recurrence === 'Biennial')  d.setFullYear(d.getFullYear() + 2);
    else if (recurrence === 'Quarterly') d.setMonth(d.getMonth() + 3);
    else if (recurrence === 'Monthly')   d.setMonth(d.getMonth() + 1);
    else return null; // One-Time / Other
    return App.ymdLocal(d);
  },

  // ── Filtered list ──────────────────────────────────────────────────────
  /* The active status filter in words, for the PDF header. A method, not a property, so the
     harness slicers that lift members by name can still see its siblings ([[the-loop]] #16).
     The on-screen chips carry live counts ("Expired (3)"); the printed label deliberately does
     not, because a count baked into a saved document goes stale the moment anything changes. */
  _filterLabel() {
    return App.chipRangeLabel([
      { v: 'all',     label: 'All permits' },
      { v: 'due',     label: 'Due in 30 days' },
      { v: 'expired', label: 'Expired only' },
      { v: 'active',  label: 'On track only' }
    ], this._filter);
  },

  _filtered() {
    const all = this.records().slice();
    let recs = all;
    if (this._filter === 'due') {
      recs = all.filter(r => {
        const s = this._status(r);
        return s.key === 'critical' || s.key === 'warn';
      });
    } else if (this._filter === 'expired') {
      recs = all.filter(r => this._status(r).key === 'expired');
    } else if (this._filter === 'active') {
      recs = all.filter(r => this._status(r).key === 'active');
    }
    // Sort: expired first, then critical, then warn, then active, by days asc.
    const rank = { expired: 0, critical: 1, warn: 2, active: 3, unknown: 4 };
    recs.sort((a, b) => {
      const sa = this._status(a), sb = this._status(b);
      const r = (rank[sa.key] ?? 9) - (rank[sb.key] ?? 9);
      if (r !== 0) return r;
      return (sa.days ?? 99999) - (sb.days ?? 99999);
    });
    return recs;
  },

  // ── Main render ────────────────────────────────────────────────────────
  renderMain() {
    const all = this.records();
    const statuses = all.map(r => this._status(r));
    const expiredCt  = statuses.filter(s => s.key === 'expired').length;
    const criticalCt = statuses.filter(s => s.key === 'critical').length;
    const warnCt     = statuses.filter(s => s.key === 'warn').length;
    const activeCt   = statuses.filter(s => s.key === 'active').length;
    const dueSoonCt  = criticalCt + warnCt;


    // Stats strip — plain card + flex calc-items (calc-val lg), color = meaning.
    const stat = (label, val, color) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</div></div>';
    const statsCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      +   stat('Tracked', all.length)
      +   stat('On Track', activeCt)
      +   stat('Due in 30 Days', dueSoonCt, dueSoonCt > 0 ? 'var(--amber)' : '')
      +   stat('Expired', expiredCt, expiredCt > 0 ? 'var(--red)' : '')
      + '</div></div>';

    // Inline Add Permit form, on the page under the stats. Heads Up (the legal
    // disclaimer) lives at the bottom inside the card; the buttons sit below it.
    const typeOpts  = this.TYPES.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
    const recurOpts = this.RECURRENCES.map(r => '<option value="' + esc(r) + '"' + (r === 'Annual' ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    const headsUpInside = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:18px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop tracks the dates you enter. It does not verify them and is not legal advice. Confirm requirements and deadlines with your issuing agency.</div>'
      + '</div>';
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('hpa-add', 'Add Permit')
      + '<div class="collapse-body">'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="flex:1 1 120px;min-width:100px;"><label>Name</label><input type="text" id="hpa-name" placeholder="Texas Mixed Beverage Permit"/></div>'
      +   '<div class="f" style="width:220px;"><label>Type' + App.manageListLink('permit_type') + '</label>' + App.customSelect({ id: 'hpa-type', key: 'permit_type', builtin: this.TYPES, blank: true, blankLabel: 'Select type...' }) + '</div>'
      +   '<div class="f" style="width:120px;"><label>Recurrence</label><select id="hpa-recurrence">' + recurOpts + '</select></div>'
      +   '<div class="f" style="width:150px;"><label>Next Renewal Date</label><input type="date" id="hpa-renewal"/></div>'
      +   '<div class="f" style="width:150px;"><label>Last Renewed</label><input type="date" id="hpa-last"/></div>'
      /* ⛔⛔ THE LAST COST BOX WAS HERE AND IT IS GONE (build piece 5). This tracker holds no money,
         same as `sc-maintenance` and `sc-incidents`: the status is the whole record. A permit fee is
         an ordinary operating expense logged at the one Money Out door and it reaches the P&L's
         Licenses and Permits line from there — a better number than this field ever was, because it
         includes the permits nobody thought to track. */
      + '</div>'
      + App.noteField({ id: 'hpa-notes', placeholder: 'Issuing agency, account number, contact' })
      + '<div id="hpa-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>'
      + headsUpInside
      + '</div>'
      + '</div>';
    const addButtons = '<div data-collapse-group="hpa-add" style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="hpa-save">Add Permit</button>'
      + '<button class="btn btn-ghost" id="hpa-clear">Start Over</button>'
      + '</div>';

    // Needs Attention — only when something is due or expired.
    let alertsCard = '';
    if (dueSoonCt + expiredCt > 0) {
      const flagged = all.map(r => ({ r, s: this._status(r) }))
        .filter(x => x.s.key === 'expired' || x.s.key === 'critical' || x.s.key === 'warn');
      const rank = { expired: 0, critical: 1, warn: 2 };
      flagged.sort((a, b) => (rank[a.s.key] - rank[b.s.key]) || ((a.s.days ?? 99999) - (b.s.days ?? 99999)));
      const alertRows = flagged.map(({ r, s }, i) => {
        const bb = i === flagged.length - 1 ? '' : 'border-bottom:1px solid var(--b2);';
        return '<div style="display:flex;gap:12px;padding:12px 0;' + bb + 'align-items:center;">'
          + '<div style="width:8px;height:8px;border-radius:50%;background:' + s.color + ';flex-shrink:0;"></div>'
          + '<div style="flex:1;min-width:0;">'
          +   '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + esc(r.name || '(unnamed)') + '</div>'
          /* ⛔ "· Last paid $X" CAME OFF THIS LINE (build piece 5). What a permit cost is on the
             expense log now, not on the permit. */
          +   '<div style="font-size:11px;color:var(--t3);">' + esc(r.type || '') + (r.type ? ' · ' : '') + esc(s.label) + '</div>'
          + '</div>'
          + '<button class="btn btn-ghost btn-sm hp-renew" data-id="' + esc(r.id) + '" style="flex-shrink:0;">Mark Renewed</button>'
          + '</div>';
      }).join('');
      alertsCard = '<div class="card form-card" style="margin-bottom:16px;">'
        + '<div class="card-title">Needs Attention</div>'
        + alertRows
        + '</div>';
    }

    /* ⭐ KYLE'S ORDER: *"on the licensing page.. move the [Add Permit card] below the needs attention
       card and above the chip selectors."* The alert comes before the form — what is about to lapse
       is the reason an operator opened this page, and the form is what they do second. */
    this.container.innerHTML = '<div class="screen">' + statsCard + alertsCard + addCard + addButtons + '<div style="margin-top:24px;"></div>' + '<div id="hp-list-region"></div>' + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    // Wire the static parts (form + the Needs Attention renew buttons). The
    // Export button rides the chips row inside the list region.
    document.getElementById('hpa-save')?.addEventListener('click', () => this._saveAdd());
    document.getElementById('hpa-clear')?.addEventListener('click', () => this._clearAdd());
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', (e) => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    App.wireCustomSelects(this.container);
    this.container.querySelectorAll('.hp-renew').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openRenewModal(rec);
      });
    });

    // The chips + list re-render on their own so a filter click never wipes the
    // half-filled Add Permit form above.
    this._renderListRegion();
  },

  // Chips + the data-card list. Re-rendered alone on a filter change so the
  // inline Add form keeps any in-progress entry.
  _renderListRegion() {
    const region = document.getElementById('hp-list-region');
    if (!region) return;
    const all = this.records();
    const statuses = all.map(r => this._status(r));
    const expiredCt = statuses.filter(s => s.key === 'expired').length;
    const activeCt  = statuses.filter(s => s.key === 'active').length;
    const dueSoonCt = statuses.filter(s => s.key === 'critical' || s.key === 'warn').length;

    const chipOpts = [
      { v: 'all',     label: 'All (' + all.length + ')' },
      { v: 'due',     label: 'Due in 30 Days (' + dueSoonCt + ')' },
      { v: 'expired', label: 'Expired (' + expiredCt + ')' },
      { v: 'active',  label: 'On Track (' + activeCt + ')' }
    ];
    const chips = App.filterChips(this._filter, chipOpts);

    const recs = this._filtered();
    const logRows = recs.length === 0
      ? '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">' + (all.length === 0
          ? 'No permits logged yet. Use the form above to add your first one.'
          : 'No permits match this filter.') + '</td></tr>'
      : recs.map(r => {
          const s = this._status(r);
          return '<tr>'
            + '<td data-label="Name" style="color:var(--t1);">' + esc(r.name || '') + '</td>'
            + '<td data-label="Type" style="color:var(--t2);">' + esc(r.type || '') + '</td>'
            + '<td data-label="Renewal Date" style="white-space:nowrap;">' + this._fmtDate(r.renewal_date) + '</td>'
            + '<td data-label="Recurrence" style="color:var(--t2);">' + esc(r.recurrence || '') + '</td>'
            // ⛔ the Last Cost column went with the field (build piece 5)
            + '<td data-label="Status" style="font-weight:700;color:' + s.color + ';white-space:nowrap;">' + esc(s.label) + '</td>'
            + '<td class="no-print" data-label="">'
            +   '<div class="row-actions" style="flex-wrap:wrap;">'
            +     '<button class="btn btn-ghost btn-sm hp-renew" data-id="' + esc(r.id) + '">Mark Renewed</button>'
            +     '<button class="btn btn-ghost btn-sm hp-edit" data-id="' + esc(r.id) + '">Edit</button>'
            +     '<button class="btn btn-danger btn-sm hp-del" data-id="' + esc(r.id) + '">Delete</button>'
            +   '</div>'
            + '</td>'
          + '</tr>';
        }).join('');

    const chipsRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="hp-export">Export PDF</button>'
      + '</div>';
    // EXPERIMENT: permit list as the audit-history pill-row table (all cells
    // left-aligned). To revert, restore the .card-bleed data-card + .tbl version.
    const listCard = '<div class="card" id="hp-list" style="overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<thead><tr>'
      +     '<th>Name</th><th>Type</th><th>Renewal Date</th><th>Recurrence</th>'
      +     '<th>Status</th><th class="no-print"></th>'
      +   '</tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table>'
      + '</div>';

    region.innerHTML = chipsRow + listCard;

    region.querySelector('#hp-export')?.addEventListener('click', () => {
      const el = document.getElementById('hp-list');
      /* Not a date range, but the same lie: the chips are `no-print`, so a list filtered to
         "Expired" saved as a document that looks like the whole licence book. Name the filter. */
      if (el) App.exportPDF({ title: 'Licensing', root: el, range: this._filterLabel() });
    });
    region.querySelectorAll('.fc-chip').forEach(chip => {
      chip.addEventListener('click', () => { this._filter = chip.dataset.v; this._renderListRegion(); });
    });
    region.querySelectorAll('.hp-renew').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openRenewModal(rec);
      });
    });
    region.querySelectorAll('.hp-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openModal(rec);
      });
    });
    region.querySelectorAll('.hp-del').forEach(btn => {
      btn.addEventListener('click', () => this._delete(btn.dataset.id));
    });
  },

  // ── Inline add form save / start over ────────────────────────────────────
  async _saveAdd() {
    const g = (id) => document.getElementById(id);
    const name         = (g('hpa-name')?.value || '').trim();
    const type         = g('hpa-type')?.value || '';
    const recurrence   = g('hpa-recurrence')?.value || 'Annual';
    const renewal_date = g('hpa-renewal')?.value || '';
    const last_renewed = g('hpa-last')?.value || '';
    const notes        = (g('hpa-notes')?.value || '').trim();
    const showErr = (m) => { const e = g('hpa-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };
    if (!name) { showErr('Give the permit a name.'); return; }
    if (!type) { showErr('Pick a type.'); return; }
    /* ⛔ THE NEGATIVE-COST REFUSAL WENT WITH THE FIELD, and that is the right direction: there is no
       number left to refuse. `verify-negative-input-guards` lost its maintenance entry the same way
       when item 12 took the Repair Cost box off that tracker. */
    await App.putRecord('core', 'permit', {
      id: App.uid ? App.uid() : ('prm-' + Date.now()),
      name, type, renewal_date, recurrence, last_renewed, notes,
      created_at: new Date().toISOString()
    });
    this.renderMain();
  },

  _clearAdd() {
    ['hpa-name', 'hpa-renewal', 'hpa-last', 'hpa-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const t = document.getElementById('hpa-type');       if (t) t.selectedIndex = 0;
    const r = document.getElementById('hpa-recurrence'); if (r) r.value = 'Annual';
    const e = document.getElementById('hpa-err');        if (e) e.style.display = 'none';
  },

  // ── Add / Edit modal ────────────────────────────────────────────────────
  _openModal(record) {
    const isEdit = !!record;
    const rec = record || {
      id: '',
      name: '',
      type: this.TYPES[0],
      renewal_date: '',
      recurrence: 'Annual',
      last_renewed: '',
      notes: ''
    };
    const typeOpts  = this.TYPES.map(t => '<option value="' + esc(t) + '"' + (rec.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const recurOpts = this.RECURRENCES.map(r => '<option value="' + esc(r) + '"' + (rec.recurrence === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    const id = 'hp-modal';

    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Permit' : 'Add Permit') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Name</label><input type="text" id="hp-f-name" value="' + esc(rec.name) + '" placeholder="Texas Mixed Beverage Permit"/></div>'
      +   '<div class="f"><label>Type' + App.manageListLink('permit_type') + '</label>' + App.customSelect({ id: 'hp-f-type', key: 'permit_type', builtin: this.TYPES, selected: rec.type, blank: true, blankLabel: 'Select type...' }) + '</div>'
      +   '<div class="f"><label>Recurrence</label><select id="hp-f-recurrence">' + recurOpts + '</select></div>'
      +   '<div class="f"><label>Next Renewal Date</label><input type="date" id="hp-f-renewal" value="' + esc(rec.renewal_date || '') + '"/></div>'
      +   '<div class="f"><label>Last Renewed</label><input type="date" id="hp-f-last" value="' + esc(rec.last_renewed || '') + '"/></div>'
      + '</div>'
      + App.noteField({ id: 'hp-f-notes', value: rec.notes, placeholder: 'Issuing agency, account number, contact' })
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="hp-save">' + (isEdit ? 'Save Changes' : 'Add Permit') + '</button>'
      +   '<span id="hp-f-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      +   (isEdit ? '<button class="btn btn-danger" id="hp-modal-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    App.wireCustomSelects(document);
    const showErr = (m) => { const e = document.getElementById('hp-f-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };

    if (isEdit) document.getElementById('hp-modal-del')?.addEventListener('click', async () => { App.closeModal(id); await this._delete(rec.id); });
    document.getElementById('hp-save')?.addEventListener('click', async () => {
      const name         = (document.getElementById('hp-f-name')?.value || '').trim();
      const type         = document.getElementById('hp-f-type')?.value || '';
      const renewal_date = document.getElementById('hp-f-renewal')?.value || '';
      const recurrence   = document.getElementById('hp-f-recurrence')?.value || 'Annual';
      const last_renewed = document.getElementById('hp-f-last')?.value || '';
      const notes        = (document.getElementById('hp-f-notes')?.value || '').trim();
      if (!name) { showErr('Give the permit a name.'); return; }
      if (!type) { showErr('Pick a type.'); return; }
      if (isEdit) {
        const cur = this.records().find(r => r.id === rec.id) || rec;
        await App.putRecord('core', 'permit', Object.assign({}, cur, { name, type, renewal_date, recurrence, last_renewed, notes }));
      } else {
        await App.putRecord('core', 'permit', {
          id:         App.uid ? App.uid() : ('prm-' + Date.now()),
          name, type, renewal_date, recurrence, last_renewed, notes,
          created_at: new Date().toISOString()
        });
      }
      App.closeModal(id);
      this.renderMain();
    });
  },

  // ── Mark Renewed modal ─────────────────────────────────────────────────
  // When operator marks a permit renewed, advance the renewal_date by the
  // recurrence and auto-create an Operating Expenses entry under
  // 'Licenses and Permits' so the bookkeeper sees it in Books.
  _openRenewModal(rec) {
    const today = App.todayLocal();
    const suggestedNext = this._nextRenewal(today, rec.recurrence) || rec.renewal_date || '';
    const id = 'hp-renew-modal';

    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Mark Renewed</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + esc(rec.name || '(unnamed permit)') + '. This advances the renewal date and advances the renewal date. Log what you paid with the rest of your money out, on Close The Books.</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Renewed On</label><input type="date" id="hp-r-renewed" value="' + today + '"/></div>'
      +   '<div class="f"><label>Next Renewal Date</label><input type="date" id="hp-r-next" value="' + esc(suggestedNext) + '"/></div>'
      + '</div>'
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="hp-r-go">Log Renewal</button>'
      +   '<span id="hp-r-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    const showErr = (m) => { const e = document.getElementById('hp-r-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };

    document.getElementById('hp-r-go')?.addEventListener('click', async () => {
      const renewedOn = document.getElementById('hp-r-renewed')?.value || '';
      const nextRen   = document.getElementById('hp-r-next')?.value || '';
      if (!renewedOn) { showErr('Pick the renewed-on date.'); return; }
      // 1. Update the permit
      const cur = this.records().find(r => r.id === rec.id);
      if (cur) {
        await App.putRecord('core', 'permit', Object.assign({}, cur, {
          last_renewed: renewedOn,
          renewal_date: nextRen || cur.renewal_date
        }));
      }
      /* ⛔⛔⛔ THE SECOND WRITE DOOR INTO THE EXPENSE LOG WAS HERE, AND IT WAS DOUBLE-COUNTING.
         It wrote a `Licenses and Permits` row with `vendor: rec.type` — "Liquor License". A bank
         statement writes the agency's name. MEASURED on the deployed build with this row already on
         file: a `TEXAS ALCOHOLIC BEV COMM` line for the same amount on the same day imported as NEW,
         so the fee landed on the books twice; only an operator who happened to type the bank's exact
         spelling ever got a dedup. It arrived uncategorised, so the P&L stayed clean until they
         sorted it into Licenses and Permits — and then it doubled, silently.
         ⭐ A permit fee is an ordinary bill. It is logged at the one Money Out door like every other
         one, and it reaches the P&L from there. Mark Renewed has ONE job now: the date. */
      App.closeModal(id);
      this.renderMain();
    });
  },

  // ── Delete ─────────────────────────────────────────────────────────────
  async _delete(id) {
    const arr = this.records();
    const rec = arr.find(r => r.id === id);
    if (!rec) return;
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('core', 'permit', id);
    this.renderMain();
  }
};
