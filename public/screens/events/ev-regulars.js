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
    /* ⛔ THE CONFIRM SCREEN TAKES THE ADD CARD'S SLOT, and the book below stays on screen — the same
       shape every door in the rollout uses. Keeping the list visible is the point: "already in your
       book" is a verdict about that list, and the operator can check it from where they are told it. */
    const topCard = this._regularsReview ? this.regularsReviewHTML() : addCard;

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

    /* ⛔⛔ THE CONFIRM SCREEN OWNS THE PAGE. Kyle, walking the shipped screen: *"the regulars current
       list and chips shouldn't still be on the page."* He is right, and the reason is sharper than
       tidiness: this screen's one promise is **"Nothing is saved until you do"**, and the book
       underneath it carries DELETE and EDIT buttons that write on the press. Two opposite write
       models on one page, four inches apart, with the destructive one sitting below the reassuring
       sentence. The chips and Export PDF are the same error more quietly: they act on a list that
       has nothing to do with the file being confirmed, and Export hands out a book about to change.
       ⚠ I built it the other way on purpose, copying the vendor door ("already in your book is a
       verdict about that list, so keep the list visible"). That argument only ever covered the dup
       rows, and it bought them a glance at the price of putting Delete under an unconfirmed import.
       The screen already names every dup by name and contact, which is the part that was needed. */
    this.container.innerHTML = '<div class="screen">' + statStrip + topCard
      + (this._regularsReview ? '' : listSection) + '</div>';
    this.wire();
    /* ⚠ NOT WHILE THE CONFIRM SCREEN IS UP. Its markup replaces the add card, so `#rg-csv` is gone,
       and re-mounting would hand the operator a second file picker over a file they have not
       finished confirming. */
    if (this.entryMode === 'import' && !this._regularsReview) this.mountImporter();
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
    /* ── The confirm screen's controls. Every one writes state and re-renders, so the button's
       count, the rows on screen and what actually gets written all read from the same place. ──── */
    // A section head opens or closes its own table. A closed section renders no rows at all, so this
    // is what actually builds them.
    this.container.querySelectorAll('[data-confirm-section]').forEach(h => h.addEventListener('click', () => {
      const r = this._regularsReview; if (!r) return;
      const k = h.dataset.confirmSection;
      r.open[k] = (k === 'needs') ? (r.open[k] === false) : !r.open[k];
      this.renderList();
    }));
    /* Remove takes a row out of the import. No confirm: nothing is written until Add, the row is
       named right beside the button, and Start Over re-drops the file. */
    this.container.querySelectorAll('[data-confirm-remove]').forEach(b => b.addEventListener('click', () => {
      if (!this._regularsReview) return;
      this._regularsReview.removed[b.dataset.confirmRemove] = true;
      this.renderList();
    }));
    // Put Back, from the Removed section. The exact inverse of the line above, and the reason Remove
    // is safe to press: nothing on this screen destroys anything until the button at the bottom.
    this.container.querySelectorAll('[data-confirm-restore]').forEach(b => b.addEventListener('click', () => {
      if (!this._regularsReview) return;
      delete this._regularsReview.removed[b.dataset.confirmRestore];
      this.renderList();
    }));
    this.container.querySelector('[data-regreview-go]')?.addEventListener('click', () => this._runRegularsReview());
    this.container.querySelector('[data-regreview-back]')?.addEventListener('click', () => {
      // Back to the drop zone, not out of the import. A mapping belongs to the file it was made for,
      // so the file is re-dropped from scratch — nothing was written, so there is nothing to undo.
      this._regularsReview = null; this.renderList();
    });
    // Switching mode abandons a confirm in progress, which is safe: nothing has been written.
    this.container.querySelectorAll('.rg-mode').forEach(b => b.addEventListener('click', () => { this._regularsReview = null; this.entryMode = b.dataset.mode; this.renderList(); }));
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
    const e = document.getElementById('rg-err');
    // ⚠ CLEARED FIRST, same as the Pricing twin. A refused write returns below WITHOUT a redraw, so
    // a "Name is required." from the previous attempt stayed on screen after the operator had typed
    // the name — sitting beside a write-failure toast and naming the wrong problem.
    if (e) { e.textContent = ''; e.style.display = 'none'; }
    if (!rec.name) { if (e) { e.textContent = 'Name is required.'; e.style.display = 'inline'; } return; }
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
      /* ⚠ THIS SENTENCE IS READ AT THE MOMENT THE OPERATOR DECIDES WHICH COLUMNS TO MAP, and it
         listed everything EXCEPT the column round 1 added. Anyone whose header is not in the
         auto-match vocabulary read this, concluded last visit was not supported, left it unmapped —
         and landed in the 100%-"no visit logged" state that column exists to end ([[copy-matches-app]]). */
      dropSub: 'Only Name is required; phone, email, birthday, anniversary, drink preferences, and last visit come in if your file has them.',
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
      /* ⛔ THE FILE STOPS HERE NOW. It used to go straight to `importRows`, which classified and
         WROTE in one pass and then flattened the whole result into one sentence AFTER the write —
         the shape this rollout exists to end. The mapper now hands its rows to the confirm screen;
         nothing is written until the operator presses Add on it. */
      onComplete: rows => this._openRegularsReview(rows)
    });
  },

  /* ── The confirm screen ──────────────────────────────────────────────────────
     Door 7 of the rollout. The DOOR owns its columns and its build; `ImportConfirm` owns the frame,
     the dim rule, and the one that matters — the button's count, which the shell DERIVES from the
     rows rather than taking as an argument, so this screen cannot print a number that disagrees
     with its own table. */

  /* ⛔⛔ THE DATE VERDICTS BELONG TO THE FILE, AND THEY ARE SETTLED AT THE DROP.
     `PosIngest.dateConvention` votes over every row to decide whether a date column is day-first.
     A confirm screen re-walks on EVERY render over the rows NOT removed, so asking that question
     inside the walk asks it of whatever subset survived Remove.
     ⛔ MEASURED ON THE SHIPPED DOOR (2026-08-07), before this screen existed: the five-row birthday
     column 25/12, 01/07, 03/11, 06/09, 30/06 reads correctly as a day-first column; take out the two
     rows carrying the >12 evidence and the three survivors flip to 1985-01-07, 1990-03-11 and
     1975-06-09 — three birthdays into a different month, while the operator is looking at them.
     The operating-expense door hit the same shape on a bank register. Taken once here, held on the
     review, handed to the write.
     ⚠ THE PROBE OPTS MUST MATCH THE READ OPTS, or the column votes on a question it is not being
     asked. dateConvention decides whether a cell may vote by asking normDate to parse it — so
     without `yearOptional` here, every cell in a YEAR-LESS birthday column came back unreadable,
     cast no vote, and the numeric branch silently fell back to month-first. Measured: a day-first
     column ["25/12","01/07","03/11","06/09","30/06"] stored 3 of 5 in the WRONG MONTH under a
     message saying "5 regulars imported."
     ⚠ And each date column is read ONCE for its own day-first verdict (S199), separately for
     birthdays and anniversaries, because a file can carry one column from a CRM and the other typed
     by hand.
     ⚠⚠ `yearOptional` IS A BIRTHDAY RULE AND IT MUST NOT REACH LAST VISIT. One shared opts object
     served all three columns, so the S200 sentinel — an explicit 1904 meaning "no year was given",
     which is honest for a birthday because nothing ever prints a birth year — became a REAL CLAIM
     about when a guest was last in. Measured on the shipped reader: a year-less "3/15" stored as
     1904-03-15, the Last Visit column printed "Mar 15, 1904" as fact, daysSince returned 44,695, and
     the regular moved OFF the "log a visit for these" list onto the win-back list under a date that
     never happened. A last visit is the one date on this screen where the year IS the data, so it
     takes the app's ordinary rules: no yearOptional, and the DEFAULT minYear (1990) rather than
     1900, which also refuses a fat-fingered "1915" instead of banking it as a real visit. */
  _regularsDateConv(rows) {
    const RD = { minYear: 1900, yearOptional: true };   // birthday + anniversary
    const VD = {};                                      // last visit: an ordinary business date
    const conv = (k, o) => (typeof PosIngest !== 'undefined' && PosIngest.dateConvention)
      ? PosIngest.dateConvention(rows, k, o) : { dayFirst: false, contradictory: false };
    const bConv = conv('birthday', RD), aConv = conv('anniversary', RD), lvConv = conv('last_visit', VD);
    return { RD: RD, VD: VD, bConv: bConv, aConv: aConv, lvConv: lvConv };
  },

  /* ⛔ THE ONE WALK. `importRows` and the confirm screen must decide "does this row land" in the
     same place, or the button and the write can disagree — the defect the whole rollout exists to
     close. PURE: no DOM, no writes, safe to call on every render. Returns one verdict per input row,
     IN THE FILE'S OWN ORDER, so the screen can zip its rows to it by index.
     ⚠⚠ ONE DATE READER FOR THE WHOLE APP. This was a private copy ending in `new Date(str)` — the
     exact line six scan rounds were spent removing from PosIngest.normDate — so every failure that
     was eliminated there was still live here: a missing year invented as 2001, an impossible date
     rolled into the next month, a UTC marker losing a day (which for a BIRTHDAY buckets 1 March into
     February and drops the regular off that month's outreach list), and a day-first cell transposed.
     Before adding a date format here, add it to PosIngest.normDate. */
  _buildRegularRows(rows, convs) {
    const C = convs || this._regularsDateConv(rows || []);
    const RD = C.RD, VD = C.VD;
    const mk = (o, c) => Object.assign({}, o, { dayFirst: c.dayFirst, dateAmbiguous: c.contradictory });
    const parseDate = (s, c, o) => (typeof PosIngest !== 'undefined' && PosIngest.normDate)
      ? PosIngest.normDate(s, mk(o, c)) : '';
    /* Phone is compared on DIGITS ONLY: "555-0100" and "(555) 0100" are one person, and email is
       already lowercased, so formatting alone must not mint a second record.
       ⚠ AND THE COUNTRY CODE COUNTS AS FORMATTING. Digits alone left "+1 555-0100" as 15550100
       beside "555-0100" as 5550100, so the same guest in one file minted two records — the exact
       thing the digits-only rule exists to stop, one character short. A POS export writes E.164
       (+1...) while a hand-typed list does not, which is the common mixed case.
       Only an 11-digit number LEADING with 1 is trimmed: that is the US country code and nothing
       else is 11 digits starting with 1. A 10-digit number and any genuine international number
       are left exactly as they are. */
    const phoneKey = v => { const d = String(v || '').replace(/\D/g, ''); return (d.length === 11 && d[0] === '1') ? d.slice(1) : d; };
    /* ⛔⛔ A NAME PLUS **EITHER** STRONG IDENTIFIER IS THE SAME PERSON. This was one key,
       `name|phone|email` joined into a single string, so a blank in any one of the three produced a
       different key and the same guest imported again.
       ⛔ MEASURED LIVE (2026-08-07) against a book holding
       `Carla Mendez / 512-555-0211 / carla.m@example.com`:
           a file row `Carla Mendez / 512-555-0211`        -> a SECOND Carla, under "1 regular imported"
           a file row `Carla Mendez / carla.m@example.com` -> a second one
           a file row carrying all three                    -> correctly "already in your book"
       A POS export carries phone numbers and a CRM export carries email addresses, so an operator
       who drops both gets their whole book twice. It is worse under a confirm screen than it was
       without one: the row reads "Adding this regular" beside somebody already in the book, on a
       screen whose whole promise is that every row tells the truth about itself.
       ⛔ AND IT IS NAME **AND** (PHONE **OR** EMAIL), NEVER A PHONE ON ITS OWN. Keying on the number
       alone would merge two different names sharing one line, which is the ordinary case rather than
       the edge one — the seeded demo carries `Tom & Ana Briggs` on a single phone. Block N's control
       is that case and it must not be weakened to make the dedup easier.
       ⚠ A row matching on EITHER identifier is skipped, never merged: a guest whose number changed
       keeps the number already on file. Same rule the door has always had for an exact match. */
    const nameKey = r => (r.name || '').trim().toLowerCase();
    const phoneOf = r => { const d = phoneKey(r.contact_phone); return d ? nameKey(r) + '|p|' + d : ''; };
    const emailOf = r => { const e = (r.contact_email || '').trim().toLowerCase(); return e ? nameKey(r) + '|e|' + e : ''; };
    const keysOf = r => [phoneOf(r), emailOf(r)].filter(Boolean);
    const hasContact = r => keysOf(r).length > 0;
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
    const seen = new Set();
    this.regulars().forEach(r => keysOf(r).forEach(k => seen.add(k)));
    // Frozen snapshot of what was in the book BEFORE this file, so "already in your book" and
    // "twice in this file" stay tellable apart once `seen` starts growing.
    const BOOK_KEYS = new Set(seen);
    const bare = [];
    this.regulars().forEach(r => { if (!hasContact(r)) bare.push((r.name || '').trim().toLowerCase()); });
    const list = [];
    (rows || []).forEach(r => {
      const name = (r.name || '').trim();
      if (!name) { list.push({ raw: r, name: '', status: 'noName', lands: false, note: 'No name', notes: [] }); return; }
      const rec = {
        id: App.uid(), name,
        contact_phone: (r.phone || '').trim(), contact_email: (r.email || '').trim(),
        birthday: parseDate(r.birthday, C.bConv, RD), anniversary: parseDate(r.anniversary, C.aConv, RD),
        drink_prefs: (r.drink_prefs || '').trim(),
        // ⚠ Through the SAME shared date reader as birthday/anniversary above, so a last-visit
        // column gets the day-first / two-digit-year handling every other import door has. An
        // unreadable or absent value still lands blank, which reads as "no visit logged".
        last_visit: parseDate(r.last_visit, C.lvConv, VD), vip: false, notes: '',
        created_at: new Date().toISOString()
      };
      /* `dup` = already in the book. `inFile` = the same row twice in THIS file. They are different
         facts and saying "already in your book" about the second one was false: on an empty book,
         two identical rows reported "1 already in your book" about someone who had never been there. */
      const ks = keysOf(rec);
      if (ks.length) {
        if (ks.some(k => seen.has(k))) {
          /* ⚠ ANY key in the frozen book snapshot means "already in your book", not just the first
             one that happened to match. A row can match the book on its email and an earlier row of
             this same file on its phone, and of those two facts the book one is the one the operator
             needs. Reading the first hit would have made that answer depend on field order. */
          const inBook = ks.some(k => BOOK_KEYS.has(k));
          list.push({ raw: r, name: name, rec: rec, status: inBook ? 'dup' : 'inFile', lands: false,
            note: inBook ? 'Already in your book' : 'Repeated in this file', notes: [] });
          return;
        }
        ks.forEach(k => seen.add(k));
      } else {
        const n = name.toLowerCase();
        const at = bare.indexOf(n);
        if (at > -1) {   // consume ONE banked namesake
          bare.splice(at, 1);
          list.push({ raw: r, name: name, rec: rec, status: 'dup', lands: false,
            note: 'Already in your book', notes: [] });
          return;
        }
      }
      /* ⛔ KYLE'S CALL, 2026-08-07, AND IT IS A DELIBERATE EXCEPTION TO THE ROLLOUT'S RULE 4 ("a row
         that will not land is dimmed with the reason on the row"). A row whose birthday, anniversary
         or last visit could not be read STILL LANDS, with that field blank and the reason on the row.
         Rule 4 and *"a note that does not change the default is not a guard"* were both written about
         a default that BOOKED MONEY the operator would then double-count. Here doing nothing loses a
         BIRTHDAY, not a dollar — and holding a real regular out of the book over one unparseable
         cell costs more than it saves. The test is what the default DESTROYS, not whether a note is
         present. So these are ANNOTATIONS on a landing row; only noName / dup / inFile are exclusions.
         ⚠ A cell the file HAD and Bar Cop could not read is reported. A cell the file simply lacks is
         not a problem and must never be counted as one, or every phone-only list reads as broken —
         and on a first drop that puts a note on every row, which is the wallpaper that makes an
         operator stop reading notes at all.
         ⚠ FLAGS, AND THE COPY IS DERIVED FROM THEM, never the other way round: the result line counts
         these, and counting them by matching the note's own wording means a reworded note silently
         zeroes the count. */
      const badBday  = !!(String(r.birthday || '').trim() && !rec.birthday);
      const badAnniv = !!(String(r.anniversary || '').trim() && !rec.anniversary);
      // ⚠ AND THE THIRD COLUMN, which the sentence above claimed all along and did not do. The Last
      // Visit column was added without a counter, so an unreadable one imported blank in silence —
      // reading on screen as "never logged", which is a DIFFERENT fact and the one the quiet tile was
      // split apart to stop the app confusing.
      const badVisit = !!(String(r.last_visit || '').trim() && !rec.last_visit);
      const notes = [];
      if (badBday)  notes.push('Birthday could not be read');
      if (badAnniv) notes.push('Anniversary could not be read');
      if (badVisit) notes.push('Last visit could not be read');
      list.push({ raw: r, name: name, rec: rec, status: 'new', lands: true, note: 'Adding this regular',
        notes: notes, badBday: badBday, badAnniv: badAnniv, badVisit: badVisit });
    });
    return { list: list, convs: C };
  },

  _openRegularsReview(rows) {
    this._regularsReview = {
      // ⚠ A STABLE ID PER ROW, so Remove has something to remove BY. The build returns one verdict
      // per input row in the file's own order, so index is a real identity here.
      rows: (rows || []).map((r, i) => Object.assign({}, r, { _rid: 'r' + i })),
      // ⛔ TAKEN AT THE DROP, OVER THE WHOLE FILE, AND NEVER RE-DERIVED. See `_regularsDateConv`.
      convs: this._regularsDateConv(rows || []),
      open: {}, removed: {}
    };
    this.renderList();
  },

  /* ONE WALK produces the rows the screen shows AND the number the button prints, because they come
     out of the same `_buildRegularRows` the write uses. */
  _regularsReviewSummary() {
    const r = this._regularsReview;
    if (!r) return { rows: [], count: 0 };
    // A removed row is gone from the list, from the count and from the write.
    const live = r.rows.filter(x => !r.removed[x._rid]);
    const built = this._buildRegularRows(live, r.convs);
    // ⚠ Zipped by index: the build returns exactly one entry per input row, in order.
    const rows = built.list.map((x, i) => this._regularsReviewRow(x, (live[i] || {})._rid));
    return { rows: rows, count: rows.filter(x => x.lands).length, built: built };
  },

  /* The rows the operator took out. Built through the SAME walk and the SAME row mapper as the rest,
     so a removed row looks exactly as it did when they removed it — which is what makes Put Back
     legible; a row that renders as a blank line is one nobody can decide about.
     ⚠ A SEPARATE WALK, ON PURPOSE. Removed rows are gone from the live build, so a removed duplicate
     stops consuming the namesake it was consuming and the row behind it is promoted. That is what
     makes Remove mean "take this out of the import" rather than "hide it".
     ⚠ Their VERDICTS are therefore meaningless here — this walk sees a book without the live rows —
     so they are never read. The section shows the data and one control, and the note says the one
     true thing about every row in it. */
  _regularsReviewRemoved() {
    const r = this._regularsReview;
    if (!r) return [];
    const gone = r.rows.filter(x => r.removed[x._rid]);
    if (!gone.length) return [];
    const built = this._buildRegularRows(gone, r.convs);
    return built.list.map((x, i) => Object.assign(
      this._regularsReviewRow(x, (gone[i] || {})._rid),
      { note: 'Taken out of this import', notes: [], lands: false }));
  },

  /* One file row as an `ImportConfirm` row. `cells` is HTML this door escapes; `note` and `notes`
     are TEXT the shell escapes, and they are what the shell's one-line NOTE_BUDGET applies to. */
  _regularsReviewRow(x, rid) {
    const rec = x.rec || {};
    /* ⚠ FORMATTED THE WAY THE BOOK DIRECTLY BELOW FORMATS THE SAME FIELD. Birthday and anniversary
       render month and day (the list column, both tiles and both chips read the month, and nothing
       anywhere prints a birth year); a last visit renders in full, because there the year IS the
       fact. Giving one quantity two spellings two inches apart is how a screen stops being checkable.
       ⚠ A null cell renders as an em dash from the shell, which is what "the file did not say"
       should look like — different from a value Bar Cop refused, which carries a note. */
    const contact = rec.contact_phone || rec.contact_email || '';
    return {
      cells: [
        (x.name ? esc(x.name) : '&mdash;') + (contact ? ImportConfirm.sub(esc(contact)) : ''),
        rec.birthday ? esc(this.fmtMD(rec.birthday)) : null,
        rec.anniversary ? esc(this.fmtMD(rec.anniversary)) : null,
        rec.last_visit ? esc(this.fmtDate(rec.last_visit)) : null
      ],
      key: rid,
      note: x.note || '',
      notes: x.notes || [],
      lands: !!x.lands
    };
  },

  regularsReviewHTML() {
    const s = this._regularsReviewSummary();
    const n = s.rows.length;
    const bad = s.rows.filter(x => !x.lands).length;
    const c = (this._regularsReview || {}).convs || {};
    const unsettled = !!((c.bConv && c.bConv.contradictory) || (c.aConv && c.aConv.contradictory)
      || (c.lvConv && c.lvConv.contradictory));
    /* ⚠ EACH NUMBER NAMES ITS OWN COLLECTION: `n` is rows read out of the file, `bad` is rows that
       will not land, and the button counts what will be created. Reading the nearest one is how a
       screen ends up contradicting itself. And the lead names the button's own verb — renaming the
       button has to rewrite this sentence with it.
       ⛔ THE DAY-FIRST WARNING IS THE ONE FACT HERE THAT IS ABOUT THE FILE AND NOT ABOUT A ROW: when
       a column's order cannot be settled, no single row can carry it, because the whole column is in
       doubt. It used to be printed AFTER the write, which is the one moment it cannot be acted on. */
    const lead = 'Bar Cop read ' + n + ' row' + (n === 1 ? '' : 's') + ' out of this file. '
      + (bad
          ? (bad === 1 ? 'One of them is not going in. ' : bad + ' of them are not going in. ') + 'Check the rest, then add them. '
          : 'Check them, then add them. ')
      + 'Nothing is saved until you do.'
      + (unsettled ? ' Some dates read day-first and others month-first, so day-and-month order could not be settled. Check any date where both numbers are 12 or under.' : '');
    return ImportConfirm.panel({
      label: 'Check your regulars',
      lead: lead,
      columns: [{ label: 'Name', width: 26 }, { label: 'Birthday', width: 15 },
                { label: 'Anniversary', width: 15 }, { label: 'Last Visit', width: 16 }],
      outcomeLabel: 'What Happens',
      rows: s.rows,
      verb: 'Add', noun: 'Regular',
      removable: true,
      // Removed rows are never part of `rows`, which is what keeps them out of the count, out of the
      // needs/settled split and out of the "All N of these" lift with no special case anywhere.
      removedRows: this._regularsReviewRemoved(),
      goAttr: 'data-regreview-go', backAttr: 'data-regreview-back', backLabel: 'Start Over',
      resultId: 'rg-imp-result',
      // The door owns which sections are open; a closed one builds no table at all.
      open: (this._regularsReview || {}).open,
      busy: !!this._regularsReviewWriting
    });
  },

  /* One press, one import. The button is rebuilt by every re-render, so a flag on the screen is the
     only thing a re-render cannot hand back. */
  async _runRegularsReview() {
    const r = this._regularsReview;
    if (!r || this._regularsReviewWriting) return;
    this._regularsReviewWriting = true;
    const btn = this.container && this.container.querySelector('[data-regreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    try {
      // ⛔ THE VERDICTS TRAVEL WITH THE ROWS. The write reads the day-first answer the SCREEN showed,
      // never a fresh one derived over whatever survived Remove.
      await this.importRows(r.rows.filter(x => !r.removed[x._rid]), { reviewed: true, convs: r.convs });
    } finally {
      this._regularsReviewWriting = false;
      /* ⛔ ONLY SUCCESS CLEARS THE SCREEN, and `importRows` is what clears it — a refused write keeps
         the whole screen so the operator can press again without re-dropping the file. Do NOT
         re-render here: the failure path writes into the result slot and a re-render destroys it. */
      if (this._regularsReview) {
        const b = this.container && this.container.querySelector('[data-regreview-go]');
        // ⚠ The shell's own label builder, never a second copy of the string ([[the-loop]] #54).
        if (b) { b.disabled = false; b.textContent = ImportConfirm.goLabel({ rows: this._regularsReviewSummary().rows, verb: 'Add', noun: 'Regular' }); }
      }
    }
  },

  async importRows(rows, opts) {
    opts = opts || {};
    /* ⛔ ONE WALK, SHARED WITH THE CONFIRM SCREEN. The row-by-row decision — is this a new regular,
       one already in the book, a repeat inside the file, or a nameless row, and which of its dates
       could not be read — lives in `_buildRegularRows`, which the screen calls to draw itself and
       this calls to write. Two copies of that decision is how a button ends up promising a number
       the write does not honour, which is the defect the whole rollout exists to close.
       EVERYTHING BELOW IS REPORTING AND WRITING; nothing below decides what lands.
       ⛔ `opts.convs` CARRIES THE FILE-LEVEL DATE VERDICTS the screen was drawn with. Without it the
       write would re-derive day-first over whatever survived Remove and could store a different
       month from the one the operator just approved. See `_regularsDateConv`. */
    const built = this._buildRegularRows(rows, opts.convs);
    const bConv = built.convs.bConv, aConv = built.convs.aConv, lvConv = built.convs.lvConv;
    const countOf = f => built.list.filter(f).length;
    const added    = built.list.filter(x => x.lands).map(x => x.rec);
    const noName   = countOf(x => x.status === 'noName');
    const dupes    = countOf(x => x.status === 'dup');
    const inFile   = countOf(x => x.status === 'inFile');
    const badBday  = countOf(x => x.badBday);
    const badAnniv = countOf(x => x.badAnniv);
    const badVisit = countOf(x => x.badVisit);
    // Pushed into the live list before the write, exactly as before the split, so the screen below
    // shows them immediately and `dropRows` has something to take back out if the write is refused.
    added.forEach(rec => this.regulars().push(rec));
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
      const failed = 'Could not save the import. Nothing was changed — check your connection and try again.';
      /* ⛔ A REFUSED WRITE ON THE CONFIRM SCREEN REPORTS INTO THE SHELL'S RESULT SLOT, AND THE SCREEN
         IS NOT RE-RENDERED. The screen stays up with every row still on it, so the operator presses
         Add again rather than re-dropping the file and re-mapping its columns — and a re-render here
         would destroy the slot holding the error, which is the worst outcome an import has: a clean
         page and no message anywhere. The shell always renders that slot for exactly this. */
      if (opts.reviewed) {
        const slot = document.getElementById('rg-imp-result');
        if (slot) slot.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + esc(failed) + '</div>';
        return;
      }
      this.importMsg = { bad: true, text: failed };
    } else {
      /* ⛔ THE CONFIRM SCREEN CLEARS ON SUCCESS AND ONLY ON SUCCESS. A refused write returns above
         this line with the screen and every row still up. Cleared here because this is the only
         line that knows the write landed — forgetting it locks the page: the records land, the list
         re-renders, and every re-render puts the import screen straight back. */
      this._regularsReview = null;
      const bits = [added.length + ' regular' + (added.length === 1 ? '' : 's') + ' imported'];
      if (dupes)    bits.push(dupes + ' already in your book');
      if (inFile)   bits.push(inFile + ' repeated row' + (inFile === 1 ? '' : 's') + ' in the file');
      if (noName)   bits.push(noName + ' row' + (noName === 1 ? '' : 's') + ' skipped with no name');
      if (badBday)  bits.push(badBday + ' birthday' + (badBday === 1 ? '' : 's') + ' could not be read and imported blank');
      if (badAnniv) bits.push(badAnniv + ' anniversar' + (badAnniv === 1 ? 'y' : 'ies') + ' could not be read and imported blank');
      // An unreadable last visit lands blank, and blank renders as "never logged" — so without this
      // line the operator is told a guest has never been in when their file said otherwise.
      if (badVisit)  bits.push(badVisit + ' last visit' + (badVisit === 1 ? '' : 's') + ' could not be read and imported blank');
      // ⚠ lvConv WAS COMPUTED AND ITS VERDICT THROWN AWAY. The last-visit column is probed for
      // day-first exactly like the other two, and its "cannot settle the order" answer was simply
      // not in this test — so an ambiguous visit column imported silently mis-monthed (S199's
      // defect, live in the new column).
      if (bConv.contradictory || aConv.contradictory || lvConv.contradictory) bits.push('some dates read day-first and others month-first, so day-and-month order could not be settled — check any date where both numbers are 12 or under');
      /* ⛔ ONCE A DOOR HAS A CONFIRM SCREEN, ITS SUCCESS LINE IS THE HEADLINE ALONE. Every clause
         below it — already in your book, repeated in the file, no name, the three dates Bar Cop
         could not read, and the day-first warning — is a row or a sentence on the screen the
         operator just read and pressed Add on. Repeating it afterwards is the second telling, and a
         string of parentheticals is the shape Kyle called *"very hard to read and follow"* on the
         sales door.
         ⚠ PRECONDITION, AND IT HAS BEEN PAID FOR TWICE: every clause must FIRST be on the screen.
         Dropping one before moving its fact is losing information, not repeating less. The
         day-first warning is the one that is about the FILE rather than a row, so it lives in the
         lead sentence of `regularsReviewHTML`.
         The full account survives for a caller with no screen in front of it. */
      this.importMsg = { bad: added.length === 0, text: (opts.reviewed ? bits[0] : bits.join(' · ')) + '.' };
    }
    /* ⚠ ONLY LEAVE IMPORT MODE ON SUCCESS. This switched unconditionally, so the FAILURE path told
       the operator to "check your connection and try again" and then destroyed the thing they would
       retry: renderList drops the mapper, taking the parsed file and the column mapping with it, so
       "try again" meant re-drop and re-map from scratch. On a failure the importer stays put. */
    if (saved) this.entryMode = 'manual';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Tracking Regulars Works', [
      { p: ['Your regulars book: your guests by name, by drink, by date. Add one at a time, or switch to Import File and drop a list. The chips filter the list (birthdays, anniversaries, gone quiet, VIP), open any regular in the list to edit them, check VIP to mark your best, and Export PDF prints the book.'] },
      { h: 'Outreach', p: ['Birthdays and anniversaries this month are counted up top, and the chips filter the list to them. Work this as your monthly reach-out list.'] },
      // ⚠ THE HELP STILL DESCRIBED THE PRE-SPLIT SCREEN. Round 1 split one count into two — a
      // regular with NO visit ever logged is no longer counted as quiet — and neither the new tile
      // nor the new chip was mentioned anywhere here, so the operator had nothing telling them
      // which of the two counts is the win-back sheet.
      { h: 'Gone Quiet', p: ['A regular whose last visit was more than ' + this.QUIET_DAYS + ' days ago flags as quiet. Work that chip as your win-back list, and log a last visit when they come in to keep it honest.',
        'No Visit Logged is a separate count, and it is different work: those are regulars you have never logged a visit for, so Bar Cop cannot say whether they have gone quiet or were in last night. Open them and set a last visit, and they start counting properly.'] },
      { h: 'Importing', p: ['Drop a CSV or Excel file and map the columns once. Only Name is required; phone, email, birthday, anniversary, drink preferences, and last visit come in if your file has them, and anything missing imports blank to fill later.',
        'Then Bar Cop lists every row in the file and what will happen to it: who is going in, who is already in your book, rows repeated in the file, and any birthday, anniversary or last visit it could not read. Nothing is saved until you press Add on that screen, and you can take any row out before you do.'] }
    ]);
  }
};
