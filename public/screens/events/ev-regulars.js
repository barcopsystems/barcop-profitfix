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
  /* ⚠⚠ "NEVER LOGGED" IS NOT "GONE QUIET FOR 60+ DAYS". isQuiet returned true for a MISSING
     last_visit, and the importer writes '' on every row — so the moment an operator imported their
     book, the amber tile told them 100% of their regulars had not been in for 60+ days, including
     the six who were at the bar last night, and the Gone Quiet chip handed them their entire list
     as a win-back sheet. The row text already knew better: it prints "never logged", not "(quiet)".
     The tile was the thing making a claim about elapsed time it could not support.
     Two states, two counts, two chips: one is a win-back list, the other is "log a visit for these".
     Different work, so they cannot share a number. */
  isQuiet(r){ const d = this.daysSince(r && r.last_visit); return d != null && d >= this.QUIET_DAYS; },
  isUnlogged(r){ return this.daysSince(r && r.last_visit) == null; },

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
    const unlogged = all.filter(r => this.isUnlogged(r));

    const stat = (l, v, color) => '<div class="calc-item"><div class="calc-label">' + l + '</div><div class="calc-val lg"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Regulars', String(all.length))
      + stat('Birthdays This Month', String(bdays.length), bdays.length ? 'var(--green)' : '')
      + stat('Anniversaries This Month', String(annivs.length), annivs.length ? 'var(--green)' : '')
      + stat('Gone Quiet (' + this.QUIET_DAYS + '+ Days)', String(quiet.length), quiet.length ? 'var(--amber)' : '')
      + stat('No Visit Logged', String(unlogged.length), unlogged.length ? 'var(--t3)' : '')
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
    /* The import result (S201). Rendered as PART of the card, never written into the DOM after a
       redraw — renderList reassigns innerHTML, so a message written first is destroyed on the spot.
       It is cleared once shown, so it cannot greet the operator again days later on a screen they
       just opened. */
    const im = this.importMsg; this.importMsg = null;
    const imHtml = im ? '<div style="margin-top:10px;font-size:12px;color:' + (im.bad ? 'var(--red)' : 'var(--t2)') + ';">' + esc(im.text) + '</div>' : '';
    const addCard = '<div class="card form-card">' + App.collapsibleCardTitle('rg-add', 'Add a Regular')
      + '<div class="collapse-body">' + body + imHtml + '</div></div>' + belowButtons;

    const chips = App.filterChips(this.filter, [
      { v: '', label: 'All' }, { v: 'bday', label: 'Birthdays' }, { v: 'anniv', label: 'Anniversaries' },
      { v: 'quiet', label: 'Gone Quiet' }, { v: 'unlogged', label: 'No Visit Logged' }, { v: 'vip', label: 'VIP' }
    ], 'rg-fchip');
    const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="rg-export">Export PDF</button></div>';

    let list = all.slice();
    if (this.filter === 'bday') list = bdays;
    else if (this.filter === 'anniv') list = annivs;
    else if (this.filter === 'quiet') list = quiet;
    else if (this.filter === 'unlogged') list = unlogged;
    else if (this.filter === 'vip') list = all.filter(r => r.vip);
    // ⚠ String(): (a.name || '') passes any truthy NON-string straight to localeCompare, and one
    // corrupt or legacy row then throws the whole screen into the error card — the entire book gone
    // over one bad field. A single bad row never showed it, because sort does not run at length 1.
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

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
      /* ⚠⚠ THE EXPORT ROOT HAS TO CONTAIN THE "SHOW OLDER" MARKER OR THE PDF IS SILENTLY CAPPED AT
         50. exportListPDF decides whether to lift the row limit by looking for that marker INSIDE
         the root it is handed — and this rendered the bar as a SIBLING of #rg-list while passing
         #rg-list as the root, so truncated was always false and the limit was never raised.
         Measured: a 140-regular book exported 50 names with nothing saying the rest were missing.
         That is the exact failure exportListPDF's own header comment exists to prevent ("you handed
         your accountant 50 rows that looked complete"). A wrapper is the fix: the bar is a BUTTON,
         which the PDF engine strips, so nothing unwanted prints. */
      : headRow + '<div id="rg-export-root">'
        + '<div id="rg-list" class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr><th>Name</th><th>Birthday</th><th>Anniversary</th><th>Drinks</th><th>Last Visit</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('core', 'event_regular', list, !!this.filter)
        + '</div>';

    this.container.innerHTML = '<div class="screen">' + statStrip + addCard + listSection + '</div>';
    this.wire();
    if (this.entryMode === 'import') this.mountImporter();
  },

  // The active chip, in words, for the PDF header. '' when nothing is narrowing the list.
  filterLabel() {
    return this.filter === 'bday'     ? 'Birthdays this month'
         : this.filter === 'anniv'    ? 'Anniversaries this month'
         : this.filter === 'quiet'    ? 'Gone quiet (' + this.QUIET_DAYS + '+ days)'
         : this.filter === 'unlogged' ? 'No visit logged'
         : this.filter === 'vip'      ? 'VIPs only' : '';
  },

  wire() {
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', e => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    /* ⚠ AND IT NAMES THE ACTIVE FILTER (D3) — the chips are no-print and sit outside the root, so
       a Gone Quiet export printed under a bare "Regulars" header and read as the whole book a
       fortnight later. Twelve other screens pass range: for exactly this.
       ⚠ AND A FOOTER, because of WHAT this document is: a printed sheet of guest names, phone
       numbers, birthdays and drink habits. It is the most sensitive artefact Bar Cop produces and
       it carried no handling note; sc-incidents already sets the precedent. */
    document.getElementById('rg-export')?.addEventListener('click', () => {
      if (!document.getElementById('rg-export-root')) return;
      App.exportListPDF({ title: 'Regulars', rootId: 'rg-export-root',
        range: this.filterLabel(),
        footer: 'Contains guest contact details. Store and share it accordingly.',
        lists: [['core', 'event_regular']], reRender: () => this.renderList() });
    });
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
    /* ⚠⚠ THE DRAFT SURVIVES A REFUSED WRITE. This cleared it BEFORE the await and then discarded
       putRecord's verdict — so on a rejection the record was reverted out of the array, the draft
       was already gone, and renderList painted an empty form: the operator retypes the regular from
       memory, having been told only that the save failed. The Labor family already does this
       correctly (lc-time-off, lc-callout-log, lc-log-hours all keep the draft and check the
       boolean); the Events family did not. */
    if (!(await App.putRecord('core', 'event_regular', rec))) return;   // row-per-record
    this._draft = null;
    this.renderList();
  },

  // ⚠ The Edit modal used to refuse a blank name in SILENCE — same door, same rule, two behaviours.
  // The add form has always said "Name is required."; this now does too (see rge-err below).
  showEdit(id) {
    const r = this.regulars().find(x => x.id === id); if (!r) return;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Regular</div>' + this.formCells(r, 'rge')
      + '<div class="card-actions"><button class="btn btn-primary" id="rge-save">Save</button>'
      + '<span id="rge-err" style="display:none;font-size:11px;color:var(--red);align-self:center;margin-left:10px;"></span></div></div>';
    App.openModal(html, { id: 'rg-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('rge-save')?.addEventListener('click', async () => {
      const err = document.getElementById('rge-err');
      const say = (m) => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
      const rec = this.collect('rge');
      // ⚠ SAY IT. A blank name here used to return in SILENCE while the Add form said "Name is
      // required." — one door, one rule, two behaviours, and the operator just sees Save do nothing.
      if (!rec.name) { say('Name is required.'); return; }
      const list = this.regulars(); const i = list.findIndex(x => x.id === id);
      if (i < 0) { say('That regular is no longer in your book.'); return; }
      const out = Object.assign({}, list[i], rec, { updated_at: new Date().toISOString() });
      // ⚠ And the verdict is checked, so a refused save does not close the modal as though it landed.
      if (!(await App.putRecord('core', 'event_regular', out))) { say('Could not save. Nothing was changed.'); return; }
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
        { key: 'drink_prefs', label: 'Drink Preferences', required: false, match: ['drink', 'prefs', 'preferences', 'favorite', 'usual', 'drink preference', 'drink preferences', 'drinks', 'favorite drink', 'usual order', 'go-to drink', 'preferred drink'] },
        /* ⚠ THE ONE COLUMN THE QUIET TILE RUNS ON, AND IT COULD NOT BE IMPORTED. Every row landed
           with last_visit blank, so an imported book started 100% "no visit logged" and the only way
           out was opening every regular in turn. A POS or CRM guest export almost always carries a
           last-visit or last-order date; this reads it when it is there and changes nothing when it
           is not. Same shared date reader as the birthday fields above. */
        { key: 'last_visit', label: 'Last Visit', required: false, match: ['last visit', 'last visited', 'last seen', 'last order', 'last order date', 'last purchase', 'most recent visit', 'last transaction', 'visit date'] }
      ],
      confirmLabel: 'Import Regulars',
      onComplete: rows => this.importRows(rows)
    });
  },

  async importRows(rows) {
    /* ⚠⚠ ONE DATE READER FOR THE WHOLE APP. This was a private copy ending in `new Date(str)` — the
       exact line six scan rounds were spent removing from PosIngest.normDate — so every failure that
       was eliminated there was still live here: a missing year invented as 2001, an impossible date
       rolled into the next month, a UTC marker losing a day (which for a BIRTHDAY buckets 1 March
       into February and drops the regular off that month's outreach list, the precise harm the old
       comment here said it was avoiding), and a day-first cell transposed.
       ⚠ minYear 1900, and this is the only caller that needs it: a birthday is legitimately decades
       before any business date, while every other door imports something that happened this year.
       Before adding a date format here, add it to PosIngest.normDate. */
    /* ⚠ `yearOptional` (S200) IS THE WHOLE REASON THIS DOOR HAS ITS OWN OPTS. A birthday is the one
       date in Bar Cop where the YEAR IS NOT DATA: the list column renders month and day, the stat
       tile and both filter chips read the month, and nothing anywhere prints the year. So refusing
       "1-Jul" did not protect anything, it emptied the feature — "Birthdays This Month" read 0 on a
       file full of birthdays. Year-less cells now store with an explicit 1900, which reads as "no
       year given" and can never be mistaken for a real birth year.
       ⚠ And the date column is read ONCE for its day-first verdict (S199), separately for birthdays
       and anniversaries, because a file can carry one column from a CRM and the other typed by hand. */
    /* ⚠ THE PROBE OPTS MUST MATCH THE READ OPTS, or the column votes on a question it is not being
       asked. dateConvention decides whether a cell may vote by asking normDate to parse it — so
       without `yearOptional` here, every cell in a YEAR-LESS birthday column came back unreadable,
       cast no vote, and the numeric branch silently fell back to month-first. Measured: a day-first
       column ["25/12","01/07","03/11","06/09","30/06"] stored 3 of 5 in the WRONG MONTH under a
       message saying "5 regulars imported." That is the S199 defect reproduced inside the S200 fix,
       which is exactly what a scan round over one's own work is for. */
    const RD = { minYear: 1900, yearOptional: true };
    const conv = k => (typeof PosIngest !== 'undefined' && PosIngest.dateConvention)
      ? PosIngest.dateConvention(rows, k, RD) : { dayFirst: false, contradictory: false };
    const bConv = conv('birthday'), aConv = conv('anniversary'), lvConv = conv('last_visit');
    const mk = c => Object.assign({}, RD, { dayFirst: c.dayFirst, dateAmbiguous: c.contradictory });
    const parseDate = (s, c) => (typeof PosIngest !== 'undefined' && PosIngest.normDate)
      ? PosIngest.normDate(s, mk(c)) : '';
    const added = [];
    let noName = 0, dupes = 0, inFile = 0, badBday = 0, badAnniv = 0;
    // Phone is compared on DIGITS ONLY: "555-0100" and "(555) 0100" are one person, and email is
    // already lowercased, so formatting alone must not mint a second record.
    const key = r => [(r.name || '').trim().toLowerCase(),
      String(r.contact_phone || '').replace(/\D/g, ''),
      (r.contact_email || '').trim().toLowerCase()].join('|');
    const hasContact = r => !!(String(r.contact_phone || '').replace(/\D/g, '') || (r.contact_email || '').trim());
    /* ⚠⚠ TWO DEDUP RULES, BECAUSE A NAME IS NOT AN IDENTITY. The first version used one seen-set on
       name+phone+email, and for a NAME-ONLY list the key degrades to the name — the exact case its
       own comment claimed to avoid. Measured: a six-row bartender's list
       [Mike, Dave, Mike, Sarah, Dave, Mike] imported as THREE people, silently merging two different
       Mikes and keeping only the first one's drink preference, under a message reading "3 already in
       your book" about a book that was empty. First names are what a regulars list is made of, so
       this is the ordinary case, not the edge one.
         · WITH a phone or an email, the key identifies a PERSON: dedup against the book AND within
           the file, because the same contact twice really is one duplicated row.
         · WITHOUT either, the key is just a name and cannot tell two Mikes apart. So it dedups
           CONSUME-ONCE against the book only: a re-drop of the same list matches one banked Mike per
           incoming Mike and adds nobody, while three Mikes in a fresh file stay three people.
       ⚠ That consume-once half is the same mechanism as the operating-expense door, for the same
       reason — the question there is also "have I already got THIS ONE", not "have I got one like
       it". Where the two doors differ is the contact case: an expense is an EVENT and can honestly
       repeat, a fully-identified person cannot. */
    const seen = new Set(this.regulars().filter(hasContact).map(key));
    // Frozen snapshot of what was in the book BEFORE this file, so "already in your book" and
    // "twice in this file" stay tellable apart once `seen` starts growing.
    const BOOK_KEYS = new Set(seen);
    const bare = [];
    this.regulars().forEach(r => { if (!hasContact(r)) bare.push((r.name || '').trim().toLowerCase()); });
    (rows || []).forEach(r => {
      const name = (r.name || '').trim();
      if (!name) { noName++; return; }
      const rec = {
        id: App.uid(), name,
        contact_phone: (r.phone || '').trim(), contact_email: (r.email || '').trim(),
        birthday: parseDate(r.birthday, bConv), anniversary: parseDate(r.anniversary, aConv),
        drink_prefs: (r.drink_prefs || '').trim(),
        // ⚠ Through the SAME shared date reader as birthday/anniversary above, so a last-visit
        // column gets the day-first / two-digit-year handling every other import door has. An
        // unreadable or absent value still lands blank, which reads as "no visit logged".
        last_visit: parseDate(r.last_visit, lvConv), vip: false, notes: '',
        created_at: new Date().toISOString()
      };
      /* `dupes` = already in the book. `inFile` = the same row twice in THIS file. They are different
         facts and saying "already in your book" about the second one was false: on an empty book,
         two identical rows reported "1 already in your book" about someone who had never been there. */
      if (hasContact(rec)) {
        const k = key(rec);
        if (seen.has(k)) { (BOOK_KEYS.has(k) ? dupes++ : inFile++); return; }
        seen.add(k);
      } else {
        const n = name.toLowerCase();
        const at = bare.indexOf(n);
        if (at > -1) { bare.splice(at, 1); dupes++; return; }   // consume ONE banked namesake
      }
      // A cell the file HAD and Bar Cop could not read is reported. A cell the file simply lacks is
      // not a problem and must never be counted as one, or every phone-only list reads as broken.
      if (String(r.birthday || '').trim() && !rec.birthday) badBday++;
      if (String(r.anniversary || '').trim() && !rec.anniversary) badAnniv++;
      this.regulars().push(rec);
      added.push(rec);
    });
    // Row-per-record: persist just the imported regulars in one bulk upsert. They were pushed into
    // the live list before the write, and a bulk write cannot revert itself — so on failure take
    // them back out rather than showing an import the server never received.
    const saved = added.length ? await App.putRecordsBulk('core', 'event_regular', added) : true;
    if (!saved) App.dropRows(this.regulars(), added);
    /* ⚠ THE DOOR USED TO REPORT NOTHING AT ALL — no counter of any kind, no message (S201). A
       200-row list with 20 blank names and 50 unreadable birthdays imported 180 records and said
       NOTHING, so the operator had no way to know half their outreach dates never arrived. The
       message is built here and rendered BY renderList, not written into the DOM after it:
       renderList reassigns innerHTML, so anything written first is destroyed on the spot. */
    if (!saved) {
      this.importMsg = { bad: true, text: 'Could not save the import. Nothing was changed — check your connection and try again.' };
    } else {
      const bits = [added.length + ' regular' + (added.length === 1 ? '' : 's') + ' imported'];
      if (dupes)    bits.push(dupes + ' already in your book');
      if (inFile)   bits.push(inFile + ' repeated row' + (inFile === 1 ? '' : 's') + ' in the file');
      if (noName)   bits.push(noName + ' row' + (noName === 1 ? '' : 's') + ' skipped with no name');
      if (badBday)  bits.push(badBday + ' birthday' + (badBday === 1 ? '' : 's') + ' could not be read and imported blank');
      if (badAnniv) bits.push(badAnniv + ' anniversar' + (badAnniv === 1 ? 'y' : 'ies') + ' could not be read and imported blank');
      if (bConv.contradictory || aConv.contradictory) bits.push('some dates read day-first and others month-first, so day-and-month order could not be settled — check any date where both numbers are 12 or under');
      this.importMsg = { bad: added.length === 0, text: bits.join(' · ') + '.' };
    }
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
