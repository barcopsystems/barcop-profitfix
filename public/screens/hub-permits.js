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
  open() {
    App.openHubFullPage('Permits and Licenses', (mount) => {
      this.container = mount;
      this.renderMain();
    }, 'permits');
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
    if (days <= 14) return { key: 'critical', label: 'Due in ' + days + ' day' + (days===1?'':'s'),                              color: 'var(--red)',   days };
    if (days <= 30) return { key: 'warn',     label: 'Due in ' + days + ' days',                                                  color: 'var(--gold)',  days };
    return { key: 'active', label: 'Due in ' + days + ' days', color: 'var(--green)', days };
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
    return d.toISOString().slice(0, 10);
  },

  // ── Filtered list ──────────────────────────────────────────────────────
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

    const fmt$ = (v) => App.fmtCurrency(v || 0, 0);

    // Summary card
    const summaryCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Permits and Licenses</div></div>'
      +   '<button class="btn btn-primary btn-sm" id="hp-add">+ Add Permit</button>'
      + '</div>'
      + '<div class="calc">'
      +   '<div class="calc-item"><div class="calc-label">Tracked</div><div class="calc-val">' + all.length + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">On Track</div><div class="calc-val ' + (activeCt > 0 ? 'good' : '') + '">' + activeCt + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Due in 30 Days</div><div class="calc-val" style="color:' + (dueSoonCt > 0 ? 'var(--gold)' : '') + ';">' + dueSoonCt + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Expired</div><div class="calc-val" style="color:' + (expiredCt > 0 ? 'var(--red)' : '') + ';">' + expiredCt + '</div></div>'
      + '</div>'
      + '</div>';

    // Alerts card — only render if there are anything due/expired
    let alertsCard = '';
    if (expiredCt + criticalCt + warnCt > 0) {
      const flagged = all.map(r => ({ r, s: this._status(r) }))
        .filter(x => x.s.key === 'expired' || x.s.key === 'critical' || x.s.key === 'warn');
      const rank = { expired: 0, critical: 1, warn: 2 };
      flagged.sort((a, b) => (rank[a.s.key] - rank[b.s.key]) || ((a.s.days ?? 99999) - (b.s.days ?? 99999)));
      const alertRows = flagged.map(({ r, s }) => {
        return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:flex-start;">'
          + '<div style="width:8px;height:8px;border-radius:50%;background:' + s.color + ';flex-shrink:0;margin-top:6px;"></div>'
          + '<div style="flex:1;">'
          +   '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + esc(r.name || '(unnamed)') + '</div>'
          +   '<div style="font-size:11px;color:var(--t3);">' + esc(r.type || '') + (r.type ? ' · ' : '') + esc(s.label) + (r.cost ? ' · Last paid ' + fmt$(r.cost) : '') + '</div>'
          + '</div>'
          + '<button class="btn btn-ghost btn-sm hp-renew" data-id="' + esc(r.id) + '" style="flex-shrink:0;font-size:10px;padding:5px 10px;">Mark Renewed</button>'
          + '</div>';
      }).join('');
      alertsCard = '<div class="card" style="margin-bottom:16px;">'
        + '<div class="card-title">Needs Attention</div>'
        + alertRows
        + '</div>';
    }

    // Filter + list table
    const filterOpts = [
      ['all',     'All Permits (' + all.length + ')'],
      ['due',     'Due in 30 Days (' + dueSoonCt + ')'],
      ['expired', 'Expired (' + expiredCt + ')'],
      ['active',  'On Track (' + activeCt + ')']
    ].map(([v, l]) => '<option value="' + v + '"' + (this._filter === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('');

    const recs = this._filtered();
    const logRows = recs.length === 0
      ? '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">' + (all.length === 0
          ? 'No permits logged yet. Use + Add Permit to track your first one.'
          : 'No permits match this filter.') + '</td></tr>'
      : recs.map(r => {
          const s = this._status(r);
          return '<tr>'
            + '<td style="padding:8px 10px;color:var(--t1);">' + esc(r.name || '') + '</td>'
            + '<td style="padding:8px 10px;color:var(--t2);font-size:11px;">' + esc(r.type || '') + '</td>'
            + '<td style="padding:8px 10px;color:var(--t2);white-space:nowrap;">' + this._fmtDate(r.renewal_date) + '</td>'
            + '<td style="padding:8px 10px;color:var(--t3);font-size:11px;">' + esc(r.recurrence || '') + '</td>'
            + '<td style="padding:8px 10px;text-align:right;color:var(--t2);">' + (r.cost ? fmt$(r.cost) : '—') + '</td>'
            + '<td style="padding:8px 10px;font-size:11px;font-weight:700;color:' + s.color + ';white-space:nowrap;">' + esc(s.label) + '</td>'
            + '<td style="padding:8px 10px;text-align:right;white-space:nowrap;">'
            +   '<button class="btn btn-ghost btn-sm hp-renew" data-id="' + esc(r.id) + '" style="font-size:10px;padding:3px 9px;">Mark Renewed</button> '
            +   '<button class="btn btn-ghost btn-sm hp-edit" data-id="' + esc(r.id) + '" style="font-size:10px;padding:3px 9px;">Edit</button> '
            +   '<button class="btn btn-ghost btn-sm hp-del"  data-id="' + esc(r.id) + '" style="font-size:10px;padding:3px 9px;color:var(--red);">Delete</button>'
            + '</td>'
          + '</tr>';
        }).join('');
    const listCard = '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">'
      +   '<div class="card-title" style="margin:0;">Permit Log</div>'
      +   '<select id="hp-filter" style="font-size:12px;padding:5px 8px;">' + filterOpts + '</select>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl">'
      +   '<thead><tr>'
      +     '<th>Name</th><th>Type</th><th>Renewal Date</th><th>Recurrence</th>'
      +     '<th style="text-align:right;">Last Cost</th>'
      +     '<th>Status</th><th></th>'
      +   '</tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div>'
      + '</div>';

    const disclaimerCard = '<div style="border:1px solid var(--amber);border-radius:6px;padding:12px 14px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop tracks the renewal dates you enter. It does not verify that a permit or license is valid, current, or accepted by any agency, and it is not legal advice. Confirm requirements, status, and deadlines with your issuing agency.</div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + summaryCard + disclaimerCard + alertsCard + listCard + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    // Wire
    document.getElementById('hp-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('hp-filter')?.addEventListener('change', (e) => {
      this._filter = e.target.value;
      this.renderMain();
    });
    this.container.querySelectorAll('.hp-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openModal(rec);
      });
    });
    this.container.querySelectorAll('.hp-renew').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openRenewModal(rec);
      });
    });
    this.container.querySelectorAll('.hp-del').forEach(btn => {
      btn.addEventListener('click', () => this._delete(btn.dataset.id));
    });
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
      cost: '',
      last_renewed: '',
      notes: ''
    };
    const typeOpts  = this.TYPES.map(t => '<option value="' + esc(t) + '"' + (rec.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const recurOpts = this.RECURRENCES.map(r => '<option value="' + esc(r) + '"' + (rec.recurrence === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:16px;">' + (isEdit ? 'Edit Permit' : 'Add Permit') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="flex:1;min-width:240px;"><label>Name</label><input type="text" id="hp-f-name" value="' + esc(rec.name) + '" placeholder="State Liquor License"/></div>'
      +   '<div class="f" style="width:200px;"><label>Type</label><select id="hp-f-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +   '<div class="f" style="width:180px;"><label>Next Renewal Date</label><input type="date" id="hp-f-renewal" value="' + esc(rec.renewal_date || '') + '"/></div>'
      +   '<div class="f" style="width:150px;"><label>Recurrence</label><select id="hp-f-recurrence">' + recurOpts + '</select></div>'
      +   '<div class="f" style="width:140px;"><label>Last Cost ($)</label><input type="number" id="hp-f-cost" step="0.01" min="0" value="' + esc(rec.cost === '' ? '' : String(rec.cost || '')) + '" placeholder="0.00"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +   '<div class="f" style="width:180px;"><label>Last Renewed</label><input type="date" id="hp-f-last" value="' + esc(rec.last_renewed || '') + '"/></div>'
      +   '<div class="f" style="flex:1;min-width:240px;"><label>Notes</label><input type="text" id="hp-f-notes" value="' + esc(rec.notes || '') + '" placeholder="Issuing agency, account number, contact"/></div>'
      + '</div>'
      + '<div id="hp-f-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>'
      + '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;">'
      +   '<div>' + (isEdit ? '<button class="btn btn-ghost" data-act="delete" style="color:var(--red);">Delete</button>' : '') + '</div>'
      +   '<div style="display:flex;gap:10px;">'
      +     '<button class="btn btn-ghost" data-act="cancel">Cancel</button>'
      +     '<button class="btn btn-primary" data-act="save">' + (isEdit ? 'Save Changes' : 'Add Permit') + '</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    const close = () => document.body.removeChild(overlay);
    const showErr = (m) => { const e = document.getElementById('hp-f-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };

    overlay.addEventListener('click', async (ev) => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (!act) {
        if (ev.target === overlay) close();
        return;
      }
      if (act === 'cancel') { close(); return; }
      if (act === 'delete') {
        close();
        if (isEdit) await this._delete(rec.id);
        return;
      }
      if (act === 'save') {
        const name         = (document.getElementById('hp-f-name')?.value || '').trim();
        const type         = document.getElementById('hp-f-type')?.value || 'Other';
        const renewal_date = document.getElementById('hp-f-renewal')?.value || '';
        const recurrence   = document.getElementById('hp-f-recurrence')?.value || 'Annual';
        const costRaw      = document.getElementById('hp-f-cost')?.value;
        const cost         = (costRaw === '' || costRaw == null) ? null : parseFloat(costRaw);
        const last_renewed = document.getElementById('hp-f-last')?.value || '';
        const notes        = (document.getElementById('hp-f-notes')?.value || '').trim();
        if (!name) { showErr('Give the permit a name.'); return; }
        if (cost != null && (isNaN(cost) || cost < 0)) { showErr('Cost must be a number at or above zero.'); return; }
        const arr = this.records();
        if (isEdit) {
          const idx = arr.findIndex(r => r.id === rec.id);
          if (idx >= 0) {
            arr[idx] = Object.assign({}, arr[idx], { name, type, renewal_date, recurrence, cost, last_renewed, notes });
          }
        } else {
          arr.push({
            id:         App.uid ? App.uid() : ('prm-' + Date.now()),
            name, type, renewal_date, recurrence, cost, last_renewed, notes,
            created_at: new Date().toISOString()
          });
        }
        await App.saveKey('permits_compliance');
        close();
        this.renderMain();
      }
    });

    const onKey = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); } };
    document.addEventListener('keydown', onKey);
  },

  // ── Mark Renewed modal ─────────────────────────────────────────────────
  // When operator marks a permit renewed, advance the renewal_date by the
  // recurrence and auto-create an Operating Expenses entry under
  // 'Licenses and Permits' so the bookkeeper sees it in Books.
  _openRenewModal(rec) {
    const today = new Date().toISOString().slice(0, 10);
    const suggestedNext = this._nextRenewal(today, rec.recurrence) || rec.renewal_date || '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:480px;width:100%;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Mark Renewed</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:14px;">' + esc(rec.name || '(unnamed permit)') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;line-height:1.6;">Logging this advances the renewal date and creates an Operating Expenses entry under Licenses and Permits for the cost paid. Edit any field before saving.</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:160px;"><label>Renewed On</label><input type="date" id="hp-r-renewed" value="' + today + '"/></div>'
      +   '<div class="f" style="width:140px;"><label>Cost Paid ($)</label><input type="number" id="hp-r-cost" step="0.01" min="0" value="' + esc(rec.cost == null ? '' : String(rec.cost)) + '" placeholder="0.00"/></div>'
      +   '<div class="f" style="width:160px;"><label>Next Renewal Date</label><input type="date" id="hp-r-next" value="' + esc(suggestedNext) + '"/></div>'
      + '</div>'
      + '<div id="hp-r-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">'
      +   '<button class="btn btn-ghost" data-act="cancel">Cancel</button>'
      +   '<button class="btn btn-primary" data-act="confirm">Log Renewal</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    const close = () => document.body.removeChild(overlay);
    const showErr = (m) => { const e = document.getElementById('hp-r-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };

    overlay.addEventListener('click', async (ev) => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (!act) {
        if (ev.target === overlay) close();
        return;
      }
      if (act === 'cancel') { close(); return; }
      if (act === 'confirm') {
        const renewedOn = document.getElementById('hp-r-renewed')?.value || '';
        const nextRen   = document.getElementById('hp-r-next')?.value || '';
        const costRaw   = document.getElementById('hp-r-cost')?.value;
        const cost      = (costRaw === '' || costRaw == null) ? null : parseFloat(costRaw);
        if (!renewedOn) { showErr('Pick the renewed-on date.'); return; }
        if (cost != null && (isNaN(cost) || cost < 0)) { showErr('Cost must be a number at or above zero.'); return; }
        // 1. Update the permit
        const arr = this.records();
        const idx = arr.findIndex(r => r.id === rec.id);
        if (idx >= 0) {
          arr[idx] = Object.assign({}, arr[idx], {
            last_renewed: renewedOn,
            renewal_date: nextRen || arr[idx].renewal_date,
            cost: cost != null ? cost : arr[idx].cost
          });
          await App.saveKey('permits_compliance');
        }
        // 2. Auto-create the Operating Expenses entry if a cost was paid
        if (cost != null && cost > 0) {
          if (!Array.isArray(App.data.operating_expenses)) App.data.operating_expenses = [];
          App.data.operating_expenses.push({
            id:         App.uid ? App.uid() : ('oex-' + Date.now()),
            date:       renewedOn,
            category:   'Licenses and Permits',
            vendor:     rec.type || '',
            amount:     cost,
            notes:      'From Permits Log: ' + (rec.name || 'permit') + ' renewal',
            created_at: new Date().toISOString()
          });
          await App.saveKey('operating_expenses');
        }
        close();
        this.renderMain();
      }
    });

    const onKey = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); } };
    document.addEventListener('keydown', onKey);
  },

  // ── Delete ─────────────────────────────────────────────────────────────
  async _delete(id) {
    const arr = this.records();
    const rec = arr.find(r => r.id === id);
    if (!rec) return;
    const ok = await App.confirm({
      title: 'Delete this permit?',
      message: (rec.name || 'This permit') + (rec.type ? ' (' + rec.type + ')' : '') + ' will be removed from the log. Operating Expenses entries already logged for past renewals stay where they are.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const idx = arr.findIndex(r => r.id === id);
    if (idx >= 0) arr.splice(idx, 1);
    await App.saveKey('permits_compliance');
    this.renderMain();
  }
};
