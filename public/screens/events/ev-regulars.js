'use strict';

/* ── Events — Regulars ───────────────────────────────────────────────────────
   The bar's regulars book in digital form: name, contact, birthday, anniversary,
   drink preferences, last visit. Drives birthday and anniversary outreach (the
   highest-converting message an independent bar sends) and surfaces regulars who
   have gone quiet so you can pull them back. Add one at a time or import a list.
   Persists in event_regulars. */

S.EventsRegulars = {
  entryMode: 'manual',
  filter: '',
  QUIET_DAYS: 60,

  regulars() { if (!Array.isArray(App.data.event_regulars)) App.data.event_regulars = []; return App.data.event_regulars; },

  fmtMD(str)  { if (!str) return ''; const d = new Date(String(str).slice(0, 10) + 'T00:00:00'); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  fmtDate(str){ if (!str) return ''; const d = new Date(String(str).slice(0, 10) + 'T00:00:00'); return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); },
  monthOf(str){ if (!str) return -1; const d = new Date(String(str).slice(0, 10) + 'T00:00:00'); return isNaN(d.getTime()) ? -1 : d.getMonth(); },
  daysSince(str){ if (!str) return null; const d = new Date(String(str).slice(0, 10) + 'T00:00:00'); if (isNaN(d.getTime())) return null; return Math.round((new Date(App.todayLocal() + 'T00:00:00') - d) / 86400000); },
  isQuiet(r){ const d = this.daysSince(r.last_visit); return d == null || d >= this.QUIET_DAYS; },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  // Shared field cells; p is the id prefix so the inline add form and the edit
  // modal never share ids.
  formCells(r, p, compact) {
    const C = {
      name:  '<div class="f"><label>Name</label><input type="text" id="' + p + '-name" value="' + esc(r?.name || '') + '" placeholder="Jen Mitchell"/></div>',
      phone: '<div class="f"><label>Phone</label><input type="tel" id="' + p + '-phone" value="' + esc(r?.contact_phone || '') + '" placeholder="Optional"/></div>',
      email: '<div class="f"><label>Email</label><input type="email" id="' + p + '-email" value="' + esc(r?.contact_email || '') + '" placeholder="Optional"/></div>',
      bday:  '<div class="f"><label>Birthday</label><input type="date" id="' + p + '-bday" value="' + esc(r?.birthday || '') + '"/></div>',
      anniv: '<div class="f"><label>Anniversary</label><input type="date" id="' + p + '-anniv" value="' + esc(r?.anniversary || '') + '"/></div>',
      visit: '<div class="f"><label>Last Visit</label><input type="date" id="' + p + '-visit" value="' + esc(r?.last_visit || '') + '"/></div>'
    };
    const vipRow = '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--t1);margin:4px 0 14px;"><input type="checkbox" class="bc-check" id="' + p + '-vip"' + (r?.vip ? ' checked' : '') + '/> This customer is a VIP regular</label>';
    const prefs = '<div class="f" style="width:100%;margin-bottom:14px;"><label>Drink Preferences</label><input type="text" id="' + p + '-prefs" value="' + esc(r?.drink_prefs || '') + '" placeholder="Negroni, Tito\'s soda, no IPAs"/></div>';
    const notes = App.noteField({ id: p + '-notes', value: r?.notes });
    const rowClass = compact ? 'form-row eb-crow' : 'form-row';
    return '<div class="' + rowClass + '" style="gap:' + (compact ? '12' : '14') + 'px;flex-wrap:wrap;">' + C.name + C.phone + C.email + C.bday + C.anniv + C.visit + '</div>'
      + vipRow + prefs + notes;
  },

  collect(p) {
    const g = x => document.getElementById(p + '-' + x);
    return {
      name:          g('name')?.value.trim() || '',
      contact_phone: g('phone')?.value.trim() || '',
      contact_email: g('email')?.value.trim() || '',
      birthday:      g('bday')?.value || '',
      anniversary:   g('anniv')?.value || '',
      last_visit:    g('visit')?.value || '',
      vip:           !!g('vip')?.checked,
      drink_prefs:   g('prefs')?.value.trim() || '',
      notes:         g('notes')?.value.trim() || ''
    };
  },

  renderList() {
    const all = this.regulars();
    const thisMonth = new Date(App.todayLocal() + 'T00:00:00').getMonth();
    const bdays  = all.filter(r => this.monthOf(r.birthday) === thisMonth);
    const annivs = all.filter(r => this.monthOf(r.anniversary) === thisMonth);
    const quiet  = all.filter(r => this.isQuiet(r));

    const stat = (l, v, color) => '<div class="calc-item"><div class="calc-label">' + l + '</div><div class="calc-val lg"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Regulars', String(all.length))
      + stat('Birthdays This Month', String(bdays.length), bdays.length ? 'var(--green)' : '')
      + stat('Anniversaries This Month', String(annivs.length), annivs.length ? 'var(--green)' : '')
      + stat('Gone Quiet (' + this.QUIET_DAYS + '+ Days)', String(quiet.length), quiet.length ? 'var(--amber)' : '')
      + '</div></div>';

    const segBtn = (mode, label) => '<button type="button" class="btn btn-sm rg-mode" data-mode="' + mode + '" style="'
      + (this.entryMode === mode ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    const segToggle = '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>';
    let body, belowButtons = '';
    if (this.entryMode === 'import') {
      body = segToggle + '<div id="rg-csv"></div><div id="rg-imp-actions" style="margin-top:8px;"></div>';
    } else {
      body = segToggle + this.formCells(null, 'rg', true);
      belowButtons = '<div data-collapse-group="rg-add" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="rg-add">Add Regular</button>'
        + '<button class="btn btn-ghost" id="rg-clear">Start Over</button>'
        + '<span id="rg-err" style="color:var(--red);font-size:12px;display:none;"></span></div>';
    }
    const addCard = '<div class="card form-card">' + App.collapsibleCardTitle('rg-add', 'Add a Regular')
      + '<div class="collapse-body">' + body + '</div></div>' + belowButtons;

    const chips = App.filterChips(this.filter, [
      { v: '', label: 'All' }, { v: 'bday', label: 'Birthdays' }, { v: 'anniv', label: 'Anniversaries' }, { v: 'quiet', label: 'Gone Quiet' }, { v: 'vip', label: 'VIP' }
    ], 'rg-fchip');
    const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="rg-export">Export PDF</button></div>';

    let list = all.slice();
    if (this.filter === 'bday') list = bdays;
    else if (this.filter === 'anniv') list = annivs;
    else if (this.filter === 'quiet') list = quiet;
    else if (this.filter === 'vip') list = all.filter(r => r.vip);
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const rows = list.slice(0, App.listLimit('core', 'event_regular')).map(r => {
      const q = this.isQuiet(r);
      return '<tr class="rg-row" data-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td><div class="val" style="font-weight:600;">' + esc(r.name || '-') + (r.vip ? ' <span style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:4px;">VIP</span>' : '') + '</div>'
        +   ((r.contact_phone || r.contact_email) ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.contact_phone || r.contact_email) + '</div>' : '') + '</td>'
        + '<td>' + (r.birthday ? this.fmtMD(r.birthday) : '-') + '</td>'
        + '<td>' + (r.anniversary ? this.fmtMD(r.anniversary) : '-') + '</td>'
        + '<td>' + esc(r.drink_prefs || '-') + '</td>'
        + '<td style="color:' + (q ? 'var(--amber)' : 'var(--t2)') + ';">' + (r.last_visit ? this.fmtDate(r.last_visit) + (q ? ' (quiet)' : '') : 'never logged') + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm rg-edit" data-id="' + esc(r.id) + '">Edit</button><button class="btn btn-danger btn-sm rg-del" data-id="' + esc(r.id) + '">Delete</button></div></td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--t3);text-align:center;padding:14px;">No regulars match.</td></tr>';

    const listSection = all.length === 0
      ? '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">Add your first regular above, or import a list. Birthdays, anniversaries, and quiet regulars surface here as you build the book.</div></div>'
      : headRow + '<div id="rg-list" class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr><th>Name</th><th>Birthday</th><th>Anniversary</th><th>Drinks</th><th>Last Visit</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('core', 'event_regular', list, !!this.filter);

    this.container.innerHTML = '<div class="screen">' + statStrip + addCard + listSection + '</div>';
    this.wire();
    if (this.entryMode === 'import') this.mountImporter();
  },

  wire() {
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', e => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    document.getElementById('rg-export')?.addEventListener('click', () => { const el = document.getElementById('rg-list'); if (el) App.exportPDF({ title: 'Regulars', root: el }); });
    this.container.querySelectorAll('.rg-mode').forEach(b => b.addEventListener('click', () => { this.entryMode = b.dataset.mode; this.renderList(); }));
    this.container.querySelectorAll('.rg-fchip').forEach(b => b.addEventListener('click', () => { this.filter = b.dataset.v; this.renderList(); }));
    this.container.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.renderList())));
    document.getElementById('rg-add')?.addEventListener('click', () => this.add());
    document.getElementById('rg-clear')?.addEventListener('click', () => { this._draft = null; this.renderList(); });
    this.container.querySelectorAll('.rg-row, .rg-edit').forEach(el => el.addEventListener('click', ev => { if (ev.target.closest('.rg-del')) return; this.showEdit(el.dataset.id); }));
    this.container.querySelectorAll('.rg-del').forEach(b => b.addEventListener('click', async ev => {
      ev.stopPropagation();
      const ok = await App.confirmDelete(); if (!ok) return;
      await App.removeRecord('core', 'event_regular', b.dataset.id);   // row-per-record
      this.renderList();
    }));
    // Hold the in-progress Add-a-Regular entry through leave/return (manual mode only;
    // import mode has no form). Only Save or Start Over clears it.
    if (this.entryMode !== 'import') {
      const formRoot = this.container.querySelector('.form-card');
      if (formRoot) {
        if (this._draft) App.restoreDraft(formRoot, this._draft);
        const cap = () => { this._draft = App.captureDraft(formRoot); };
        formRoot.addEventListener('input', cap);
        formRoot.addEventListener('change', cap);
      }
    }
  },

  async add() {
    const rec = this.collect('rg');
    if (!rec.name) { const e = document.getElementById('rg-err'); if (e) { e.textContent = 'Name is required.'; e.style.display = 'inline'; } return; }
    rec.id = App.uid(); rec.created_at = new Date().toISOString();
    this._draft = null;
    await App.putRecord('core', 'event_regular', rec);   // row-per-record
    this.renderList();
  },

  showEdit(id) {
    const r = this.regulars().find(x => x.id === id); if (!r) return;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Regular</div>' + this.formCells(r, 'rge')
      + '<div class="card-actions"><button class="btn btn-primary" id="rge-save">Save</button></div></div>';
    App.openModal(html, { id: 'rg-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('rge-save')?.addEventListener('click', async () => {
      const rec = this.collect('rge'); if (!rec.name) return;
      const list = this.regulars(); const i = list.findIndex(x => x.id === id);
      if (i < 0) return;
      const out = Object.assign({}, list[i], rec, { updated_at: new Date().toISOString() });
      await App.putRecord('core', 'event_regular', out);   // row-per-record
      App.closeModal('rg-edit-modal'); this.renderList();
    });
  },

  mountImporter() {
    const el = document.getElementById('rg-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your regulars list here',
      dropSub: 'Only Name is required; phone, email, birthday, anniversary, and drink preferences come in if your file has them.',
      actionsEl: '#rg-imp-actions',
      fields: [
        // Whole phrases only. A bare 'customer' / 'guest' / 'patron' matched the
        // Customer EMAIL column (every column in these files starts with the same
        // word), so the book filled with regulars named jen@gmail.com.
        { key: 'name',        label: 'Name',        required: true,  match: ['name', 'full name', 'first name', 'last name', 'contact name', 'member name', 'customer name', 'guest name', 'patron name', 'regular name'] },
        { key: 'phone',       label: 'Phone',       required: false, match: ['phone', 'mobile', 'cell', 'phone number', 'telephone', 'contact phone', 'mobile number', 'primary phone', 'cell phone'] },
        { key: 'email',       label: 'Email',       required: false, match: ['email', 'e-mail', 'email address', 'e mail', 'contact email', 'primary email'] },
        { key: 'birthday',    label: 'Birthday',    required: false, match: ['birthday', 'birth date', 'dob', 'bday', 'birthdate', 'date of birth'] },
        { key: 'anniversary', label: 'Anniversary', required: false, match: ['anniversary', 'anniversary date', 'wedding anniversary'] },
        { key: 'drink_prefs', label: 'Drink Preferences', required: false, match: ['drink', 'prefs', 'preferences', 'favorite', 'usual', 'drink preference', 'drink preferences', 'drinks', 'favorite drink', 'usual order', 'go-to drink', 'preferred drink'] }
      ],
      confirmLabel: 'Import Regulars',
      onComplete: rows => this.importRows(rows)
    });
  },

  async importRows(rows) {
    const parseDate = s => {
      if (!s) return '';
      const str = String(s).trim();
      // A plain YYYY-MM-DD is kept verbatim: new Date('1985-06-01') parses as UTC
      // midnight, and ymdLocal would then roll it back a day in any US timezone,
      // bucketing a March 1 birthday into February so it never surfaces in the
      // month's outreach list. Other formats (M/D/YYYY, "June 1 1985") parse local.
      const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (iso) return iso[1] + '-' + String(+iso[2]).padStart(2, '0') + '-' + String(+iso[3]).padStart(2, '0');
      const d = new Date(str);
      return isNaN(d.getTime()) ? '' : App.ymdLocal(d);
    };
    const added = [];
    (rows || []).forEach(r => {
      const name = (r.name || '').trim(); if (!name) return;
      const rec = {
        id: App.uid(), name,
        contact_phone: (r.phone || '').trim(), contact_email: (r.email || '').trim(),
        birthday: parseDate(r.birthday), anniversary: parseDate(r.anniversary),
        drink_prefs: (r.drink_prefs || '').trim(), last_visit: '', vip: false, notes: '',
        created_at: new Date().toISOString()
      };
      this.regulars().push(rec);
      added.push(rec);
    });
    // Row-per-record: persist just the imported regulars in one bulk upsert. They were pushed into
    // the live list before the write, and a bulk write cannot revert itself — so on failure take
    // them back out rather than showing an import the server never received.
    if (!(await App.putRecordsBulk('core', 'event_regular', added))) App.dropRows(this.regulars(), added);
    this.entryMode = 'manual';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Tracking Regulars Works', [
      { p: ['Your regulars book: your guests by name, by drink, by date. Add one at a time, or switch to Import File and drop a list. The chips filter the list (birthdays, anniversaries, gone quiet, VIP), open any regular in the list to edit them, check VIP to mark your best, and Export PDF prints the book.'] },
      { h: 'Outreach', p: ['Birthdays and anniversaries this month are counted up top, and the chips filter the list to them. Work this as your monthly reach-out list.'] },
      { h: 'Gone Quiet', p: ['A regular with no visit logged in the last ' + this.QUIET_DAYS + ' days flags as quiet. Work that as your win-back list, and log a last visit when they come in to keep it honest.'] },
      { h: 'Importing', p: ['Drop a CSV or Excel file and map the columns once. Only Name is required; phone, email, birthday, anniversary, and drink preferences come in if your file has them, and anything missing imports blank to fill later.'] }
    ]);
  }
};
