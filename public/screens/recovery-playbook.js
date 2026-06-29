'use strict';

/* ── Recovery Playbook — the sit-and-read companion to the Fix layer ───────────
   The app-native rewrite of the old Fix-System guide. The Fix screens are the
   tactical "do this now"; this is the strategic read that makes the operator
   care, then walks them into the exact Bar Cop screen that does the work.

   One content source (CONTENT[module]) drives two renderers: the in-app HTML
   reader (full-width, sticky section list, clickable Go-to buttons that deep
   link straight into the live screen) and a Save-PDF export built on the same
   App._pdfBuilder every Bar Cop deliverable uses. Profit is built first;
   Revenue and Cash slot into the same scaffold.

   Opens as a Hub full-page (like the Blueprint). Home = a button on the Profit
   Fix screen. No formulas, no spreadsheet steps: Bar Cop does that math now.
   Dollar figures are illustrative examples, never a promise (see the footer). */

S.RecoveryPlaybook = {
  _module: 'profit',

  // Kept as a convenience for the "Read the Recovery Playbook" button on the
  // Profit Fix screen. The playbook is a real Profit Recovery module screen now,
  // so it just routes there and inherits the section sidebar, topbar, and shell.
  open(module) {
    this._module = module || 'profit';
    App.openScreen(module === 'revenue' ? 'r-playbook' : module === 'cash' ? 'c-playbook' : 'recovery-playbook');
  },

  doc() { return this.CONTENT[this._module] || this.CONTENT.profit; },
  // Slash-safe so per-module resource subfolders resolve (e.g. revenue/Foo.pdf).
  docPath(file) { return 'assets/resources/' + String(file).split('/').map(encodeURIComponent).join('/'); },

  // ── Module screen: standard .screen width + a sticky right-hand section rail ──
  render(content, actions) {
    this.container = content;
    // The screen serves whichever Recovery section it is opened from.
    this._module = (App._activeModule === 'revenue') ? 'revenue' : (App._activeModule === 'cash') ? 'cash' : 'profit';
    this._diag = {};   // diagnostic answers, session-only (fresh each visit)
    const d = this.doc();
    const rail = d.sections.map(sec =>
      '<button class="pb-rail-item" data-id="' + esc(sec.id) + '">' + esc(sec.nav) + '</button>').join('');

    // Converted page (topbar hidden), so Save PDF lives in the page. It rides the
    // right of the first section's title line so the header stays at the top.
    const pdfBtn = '<button class="btn btn-ghost btn-sm pb-pdf-btn" id="pb-pdf">' + this._icon('reference') + 'Save PDF</button>';

    const body = d.sections.map((sec, idx) => {
      const blocks = sec.blocks.map(b => this.blockHtml(b)).join('');
      const eyebrow = sec.eyebrow ? '<div class="pb-eyebrow">' + esc(sec.eyebrow) + '</div>' : '';
      const titleRow = idx === 0
        ? '<div class="pb-h1row"><div class="card-title pb-h1">' + esc(sec.title) + '</div>' + pdfBtn + '</div>'
        : '<div class="card-title pb-h1">' + esc(sec.title) + '</div>';
      return '<section class="pb-section" id="pb-' + esc(sec.id) + '">' + eyebrow + titleRow + blocks + '</section>';
    }).join('');

    content.innerHTML = this.styleTag()
      + '<div class="screen">'
      +   '<div class="pb-row">'
      +     '<div class="pb-body">' + body + this.footerHtml() + '</div>'
      +     '<nav class="pb-rail"><div class="pb-rail-label">In this playbook</div>' + rail + '</nav>'
      +   '</div>'
      + '</div>';

    const bodyEl = content.querySelector('.pb-body');
    content.querySelector('#pb-pdf')?.addEventListener('click', () => this._exportPDF());

    content.querySelectorAll('.pb-rail-item').forEach(btn =>
      btn.addEventListener('click', () => {
        const el = document.getElementById('pb-' + btn.dataset.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    content.querySelectorAll('.pb-go').forEach(btn =>
      btn.addEventListener('click', () => {
        if (btn.dataset.focus) App._fixFocus = btn.dataset.focus;
        App.openScreen(btn.dataset.screen);
      }));

    // Interactive diagnostic: Yes/No per question reveals its outcome and scores
    // live. Delegated on the fresh .pb-body (recreated each render, so no leak).
    if (bodyEl) bodyEl.addEventListener('click', e => {
      const yn = e.target.closest('.pb-yn');
      if (!yn) return;
      const n = +yn.dataset.q, v = yn.dataset.v;
      this._diag[n] = (this._diag[n] === v) ? null : v;
      const dyn = bodyEl.querySelector('[data-qwrap="' + n + '"] .pb-diag-dyn');
      if (dyn) dyn.innerHTML = this._diagDyn(n);
      const sc = bodyEl.querySelector('#pb-diagscore');
      if (sc) sc.innerHTML = this._diagScoreHtml();
    });

    this._wireRail();
  },

  // Highlight the rail item for the section currently at the top of the reader.
  _wireRail() {
    if (this._railObs) { this._railObs.disconnect(); this._railObs = null; }
    if (typeof IntersectionObserver === 'undefined') return;
    const scroller = this.container.closest('.content') || null;
    const items = {};
    this.container.querySelectorAll('.pb-rail-item').forEach(i => { items[i.dataset.id] = i; });
    const setActive = id => Object.keys(items).forEach(k => items[k].classList.toggle('active', k === id));
    this._railObs = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id.replace('pb-', ''));
    }, { root: scroller, rootMargin: '0px 0px -75% 0px', threshold: 0 });
    this.container.querySelectorAll('.pb-section').forEach(s => this._railObs.observe(s));
  },

  showHowTo() {
    const label = this.doc().label;
    App.showHelpModal('How the ' + label + ' Playbook Works', [
      { p: ['The strategic read behind your ' + label + ' Fix System: where the money leaks, what each leak quietly costs, and the exact Bar Cop screen that captures, measures, and closes it.'] },
      { h: 'Reading it', p: ['Use the list on the right to jump to any section. Every Open button drops you straight on the live screen it names, and every Download pulls the policy or worksheet for that step.'] },
      { h: 'Save PDF', p: ['Save PDF up top prints the whole playbook as a clean reference to hand a manager. The dollar figures in it are illustrative examples of what these gaps commonly cost, not a promise.'] }
    ]);
  },

  blockHtml(b) {
    switch (b.t) {
      case 'lead':
        return '<p class="pb-lead">' + esc(b.text) + '</p>';
      case 'p':
        return '<p class="pb-p">' + esc(b.text) + '</p>';
      case 'h':
        return '<div class="sh pb-sh">' + esc(b.text) + '</div>';
      case 'note':
        return '<p class="pb-note">' + esc(b.text) + '</p>';
      case 'list':
        return '<ul class="pb-list">' + b.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
      case 'box':
        return '<div class="pb-box pb-box-' + (b.tone || 'steel') + '">'
          + (b.label ? '<div class="pb-box-label">' + esc(b.label) + '</div>' : '')
          + (b.title ? '<div class="pb-box-title">' + esc(b.title) + '</div>' : '')
          + (b.text ? '<div class="pb-box-text">' + esc(b.text) + '</div>' : '')
          + (b.items ? '<ol class="pb-box-list">' + b.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ol>' : '')
          + '</div>';
      case 'table':
        return this.tableHtml(b);
      case 'diag':
        return this.diagHtml(b);
      case 'diagscore':
        return '<div class="pb-box pb-box-steel" id="pb-diagscore">' + this._diagScoreHtml() + '</div>';
      case 'cross':
        return this.crossHtml(b);
      case 'parts':
        return this.partsHtml(b);
      case 'go':
        return '<div class="pb-gorow">' + this.goBtn(b) + '</div>';
      case 'docs':
        return '<div class="pb-docs">' + b.items.map(it =>
          '<a class="btn btn-ghost btn-sm" href="' + this.docPath(it.file) + '" download style="text-decoration:none;">'
          + this._icon('reference') + 'Download: ' + esc(it.label) + '</a>').join('') + '</div>';
      default:
        return '';
    }
  },

  // Matches the Profit Fix step icons so the playbook buttons read identically to
  // the rest of the app: arrow for an in-app jump, document for a download.
  _icon(kind) {
    const p = kind === 'reference'
      ? '<path d="M3.5 1.5h4l3 3v8h-7z"/><path d="M7.5 1.5v3h3"/>'
      : '<path d="M2.5 7h7M7 4l3 3-3 3"/>';
    return '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">' + p + '</svg>';
  },

  goBtn(b) {
    return '<button class="btn btn-ghost btn-sm pb-go" data-screen="' + esc(b.screen) + '"'
      + (b.focus ? ' data-focus="' + esc(b.focus) + '"' : '') + '>'
      + this._icon('action') + 'Open: ' + esc(b.label || '') + '</button>';
  },

  tableHtml(b) {
    const head = '<thead><tr>' + b.head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead>';
    const rows = b.rows.map(r => '<tr>' + r.map((c, i) =>
      '<td data-label="' + esc(b.head[i] || '') + '">' + esc(c) + '</td>').join('') + '</tr>').join('');
    return '<div class="card pb-tbl-card" style="overflow-x:auto;"><table class="row-list' + (b.nowrap1 ? ' pb-tbl-nowrap1' : '') + '">'
      + head + '<tbody>' + rows + '</tbody></table></div>'
      + (b.note ? '<p class="pb-note">' + esc(b.note) + '</p>' : '');
  },

  diagHtml(b) {
    this._diagItems = b.items;
    return b.items.map(q =>
      '<div class="pb-diag" data-qwrap="' + q.n + '">'
      + '<div class="pb-diag-q"><span class="pb-diag-n">' + q.n + '.</span> ' + esc(q.q) + '</div>'
      + '<div class="pb-diag-dyn">' + this._diagDyn(q.n) + '</div>'
      + '</div>').join('');
  },

  // The Yes/No toggle + the revealed outcome for one question, from current state.
  _diagDyn(n) {
    const q = (this._diagItems || []).find(x => x.n === n);
    if (!q) return '';
    const ans = this._diag[n];
    const toggle = '<div class="pb-diag-toggle">'
      + '<button class="pb-yn' + (ans === 'yes' ? ' on yes' : '') + '" data-q="' + n + '" data-v="yes">Yes</button>'
      + '<button class="pb-yn' + (ans === 'no' ? ' on no' : '') + '" data-q="' + n + '" data-v="no">No</button>'
      + '</div>';
    const reveal = ans === 'yes'
      ? '<div class="pb-diag-reveal yes">' + esc(q.yes) + '</div>'
      : ans === 'no'
        ? '<div class="pb-diag-reveal no">' + esc(q.no) + ' <span class="pb-diag-cost">commonly about ' + esc(q.cost) + ' a month</span></div>'
        : '';
    return toggle + reveal;
  },

  // The live score box: their Yes count, the band meaning once all are answered,
  // and the illustrative combined monthly figure for the gaps they flagged No.
  _diagScoreHtml() {
    const items = this._diagItems || [];
    const ans = this._diag || {};
    let yes = 0, no = 0, answered = 0, dollars = 0;
    items.forEach(q => {
      const a = ans[q.n];
      if (!a) return;
      answered++;
      if (a === 'yes') yes++;
      else { no++; dollars += parseInt(String(q.cost).replace(/[^0-9]/g, ''), 10) || 0; }
    });
    const head = '<div class="pb-box-label">Score your answers</div>';
    if (answered === 0) {
      return head + '<div class="pb-box-text">Tap Yes or No on each question above and your score builds here.</div>';
    }
    const money = '$' + dollars.toLocaleString();
    let html = head + '<div class="pb-score-num">' + yes + ' <span>of ' + items.length + ' Yes</span></div>';
    if (no > 0) {
      html += '<div class="pb-box-text">The gaps you marked No commonly run about <strong>' + money
        + ' a month</strong> combined. That is an illustrative example of typical loss, not your measured number.</div>';
    }
    if (answered === items.length) {
      let band;
      if (yes >= 8) band = 'You are ahead of most bars. Use the system to formalize what works and close the rest. Even one No is costing you every month.';
      else if (yes >= 5) band = 'You have profitable holes. The combined figure above is what this system is built to recover.';
      else band = 'This system pays for itself in the first 30 days. Instinct and experience both have limits. A system does not.';
      html += '<div class="pb-box-text" style="margin-top:9px;">' + band + '</div>';
    } else {
      html += '<div class="pb-box-text" style="margin-top:6px;color:var(--t3);">' + answered + ' of ' + items.length + ' answered. Answer them all for your full read.</div>';
    }
    return html;
  },

  crossHtml(b) {
    const rows = b.rows.map(r =>
      '<tr>'
      + '<td data-label="The leak" class="pb-cross-leak">' + esc(r.leak) + '</td>'
      + '<td data-label="Where you capture it">' + esc(r.capture) + '</td>'
      + '<td data-label="Where Bar Cop shows it">' + esc(r.show) + '</td>'
      + '<td data-label="Where you fix it">' + this.goBtn({ label: r.fixLabel, screen: r.screen, focus: r.focus }) + '</td>'
      + '</tr>').join('');
    return '<div class="card pb-tbl-card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:18%"/><col style="width:30%"/><col style="width:24%"/><col style="width:28%"/></colgroup>'
      + '<thead><tr><th>The leak</th><th>Where you capture it</th><th>Where Bar Cop shows it</th><th>Where you fix it</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  partsHtml(b) {
    const fixScreen = this._module === 'revenue' ? 'r-fix' : this._module === 'cash' ? 'c-fix' : 'profit-fix';
    const cards = b.items.map(it =>
      '<div class="pb-part">'
      + '<div class="pb-part-label">' + esc(it.label) + '</div>'
      + '<div class="pb-part-name">' + esc(it.name) + '</div>'
      + '<div class="pb-part-desc">' + esc(it.desc) + '</div>'
      + '<div class="pb-part-go">' + this.goBtn({ label: it.name, screen: fixScreen, focus: it.focus }) + '</div>'
      + '</div>').join('');
    return '<div class="pb-parts">' + cards + '</div>';
  },

  footerHtml() {
    return '<div class="pb-footer">'
      + 'Dollar figures in this playbook are illustrative examples of what these gaps commonly cost, not a promise of results. '
      + 'Your real numbers are whatever Bar Cop measures from your own data. '
      + 'Bar Cop is a software tool, not a CPA, accountant, or other professional advisor. '
      + 'Review and verify before making material decisions.'
      + '</div>';
  },

  // ── Save PDF (same engine as the audits) ──────────────────────────────────────
  async _exportPDF() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const d = this.doc();
    const b = App._pdfBuilder('Recovery Playbook');
    b.header({ right: 'Recovery Playbook: ' + d.label });
    b.paragraph(d.intro, { gray: 70 });
    d.sections.forEach(sec => {
      b.spacer(6);
      b.sectionTitle(sec.eyebrow || sec.nav);
      b.heading(sec.title, 14);
      sec.blocks.forEach(blk => this.blockPDF(b, blk));
    });
    const f = App.deliverableFooter();
    b.disclaimer('Dollar figures shown are illustrative examples, not a promise of results. ' + f.workbookSubject);
    const venue = (App.data && App.data.settings && App.data.settings.bar_name) || 'Bar Cop';
    await b.save(venue + ' - Recovery Playbook - ' + d.label);
  },

  blockPDF(b, blk) {
    switch (blk.t) {
      case 'lead': b.paragraph(blk.text, { gray: 40, size: 11 }); break;
      case 'p':    b.paragraph(blk.text, { gray: 55 }); break;
      case 'h':    b.spacer(2); b.heading(blk.text, 11); break;
      case 'note': b.paragraph(blk.text, { gray: 115, italic: true, size: 9 }); break;
      case 'list': blk.items.forEach(i => b.paragraph('-  ' + i, { gray: 55 })); break;
      case 'box':
        if (blk.title) b.heading(blk.title, 11);
        else if (blk.label) b.heading(blk.label, 10);
        if (blk.text) b.paragraph(blk.text, { gray: 55 });
        if (blk.items) blk.items.forEach((i, n) => b.paragraph((n + 1) + '. ' + i, { gray: 55 }));
        break;
      case 'table':
        b.table(blk.head, blk.rows);
        if (blk.note) b.paragraph(blk.note, { gray: 115, italic: true, size: 9 });
        break;
      case 'diag':
        blk.items.forEach(q => {
          b.heading(q.n + '. ' + q.q, 10);
          b.paragraph('Yes: ' + q.yes, { gray: 70, size: 9 });
          b.paragraph('No (about ' + q.cost + '/mo): ' + q.no, { gray: 70, size: 9 });
        });
        break;
      case 'cross':
        b.table(['The leak', 'Where you capture it', 'Where Bar Cop shows it', 'Where you fix it'],
          blk.rows.map(r => [r.leak, r.capture, r.show, r.fixLabel + ' (open in Bar Cop)']));
        break;
      case 'diagscore':
        b.heading('Score your answers', 11);
        b.paragraph('8 to 10 Yes: you are ahead of most bars. Use the system to formalize what works and close the rest. Even one No is costing you every month.', { gray: 55 });
        b.paragraph('5 to 7 Yes: you have profitable holes. Add up the monthly figures next to your No answers. That is what this system is built to recover.', { gray: 55 });
        b.paragraph('0 to 4 Yes: this system pays for itself in the first 30 days. Instinct and experience both have limits. A system does not.', { gray: 55 });
        break;
      case 'parts':
        b.table(['System', 'What it does'], blk.items.map(it => [it.label + ' - ' + it.name, it.desc]));
        break;
      case 'go':
        b.paragraph('-> Open ' + (blk.label || '') + ' in Bar Cop.', { gray: 110, italic: true, size: 9 });
        break;
      case 'docs':
        blk.items.forEach(it => b.paragraph('Download in Bar Cop: ' + it.label, { gray: 110, italic: true, size: 9 }));
        break;
    }
  },

  styleTag() {
    return '<style>'
      + '.pb-h1row{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px;}'
      + '.pb-h1row .pb-h1{margin-bottom:0;}'
      + '.pb-pdf-btn{flex-shrink:0;}'
      + '.pb-row{display:flex;gap:28px;align-items:flex-start;}'
      + '.pb-body{flex:1;min-width:0;border:1px solid var(--b-edge);border-radius:var(--r);padding:20px 22px;}'
      + '.pb-rail{flex:0 0 200px;position:sticky;top:24px;padding-top:2px;}'
      + '.pb-rail-label{font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t4);padding:2px 10px 8px;}'
      + '.pb-rail-item{display:block;width:100%;text-align:left;background:none;border:none;border-left:2px solid var(--b2);color:var(--t3);font-size:12.5px;font-weight:600;padding:6px 12px;cursor:pointer;line-height:1.3;transition:color .12s,border-color .12s;}'
      + '.pb-rail-item:hover{color:var(--w);}'
      + '.pb-rail-item.active{color:var(--w);border-left-color:var(--focus);}'
      + '.pb-section{margin-bottom:40px;scroll-margin-top:14px;}'
      + '.pb-eyebrow{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;}'
      + '.pb-h1{font-size:22px;margin-bottom:14px;}'
      + '.pb-lead{font-size:15px;font-style:italic;color:var(--t1);line-height:1.7;margin:0 0 14px;}'
      + '.pb-p{font-size:13.5px;color:var(--t2);line-height:1.75;margin:0 0 14px;}'
      + '.pb-sh{margin:24px 0 12px;}'
      + '.pb-note{font-size:12px;color:var(--t3);line-height:1.6;font-style:italic;margin:8px 0 14px;}'
      + '.pb-list{margin:0 0 14px;padding-left:18px;color:var(--t2);font-size:13.5px;line-height:1.8;}'
      + '.pb-box{border-radius:var(--r);padding:16px 18px;margin:0 0 18px;}'
      + '.pb-box-steel{background:#0D181E;border:1px solid var(--b-edge);}'
      + '.pb-box-gold{background:var(--gold-tint);border:1px solid var(--gold-tint-bord);}'
      + '.pb-box-red{background:#0D181E;border:1px solid var(--red);}'
      + '.pb-box-label{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:6px;}'
      + '.pb-box-title{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:7px;line-height:1.3;}'
      + '.pb-box-text{font-size:13px;color:var(--t2);line-height:1.7;}'
      + '.pb-box-list{margin:11px 0 0;padding-left:0;list-style-position:inside;font-size:13px;color:var(--t2);line-height:1.65;}'
      + '.pb-box-list li{margin-bottom:7px;}'
      + '.pb-box-list li:last-child{margin-bottom:0;}'
      + '.pb-tbl-card{margin:0 0 18px;}'
      + '.pb-tbl-nowrap1 td:first-child,.pb-tbl-nowrap1 th:first-child{white-space:nowrap;}'
      + '.pb-cross-leak{font-weight:700;color:var(--t1);}'
      + '.pb-diag{border-left:2px solid var(--b-edge);padding:2px 0 2px 14px;margin:0 0 16px;}'
      + '.pb-diag-q{font-size:14px;font-weight:600;color:var(--t1);line-height:1.5;margin-bottom:8px;}'
      + '.pb-diag-n{color:inherit;font-weight:700;}'
      + '.pb-diag-toggle{display:flex;gap:8px;margin-top:10px;}'
      + '.pb-yn{background:transparent;border:1px solid var(--b1);color:var(--t2);font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:5px 18px;border-radius:var(--r);cursor:pointer;transition:border-color .12s,color .12s;}'
      + '.pb-yn:hover{color:var(--w);border-color:rgba(255,255,255,0.28);}'
      + '.pb-yn.on.yes{color:var(--green);border-color:var(--green);}'
      + '.pb-yn.on.no{color:var(--red);border-color:var(--red);}'
      + '.pb-diag-reveal{margin-top:10px;font-size:12.5px;line-height:1.65;color:var(--t2);background:#08131A;border-radius:var(--r);padding:10px 12px;}'
      + '.pb-diag-cost{color:var(--red);font-weight:700;}'
      + '.pb-score-num{font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:600;line-height:1;color:var(--t1);margin:8px 0;}'
      + '.pb-score-num span{font-size:15px;color:var(--t3);}'
      + '.pb-parts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 18px;}'
      + '.pb-part{background:#0D181E;border:1px solid var(--b-edge);border-radius:var(--r);padding:14px 16px;}'
      + '.pb-part-label{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:3px;}'
      + '.pb-part-name{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:6px;}'
      + '.pb-part-desc{font-size:12.5px;color:var(--t2);line-height:1.6;margin-bottom:12px;}'
      + '.pb-gorow{margin:0 0 16px;}'
      + '.pb-docs{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 16px;}'
      + '.pb-go,.pb-docs a{justify-content:flex-start;white-space:normal;text-align:left;line-height:1.35;height:auto;}'
      + '.pb-footer{font-size:11px;color:var(--t3);line-height:1.7;border-top:1px solid var(--b2);padding-top:14px;margin-top:24px;max-width:780px;}'
      + '@media(max-width:900px){.pb-row{flex-direction:column;}.pb-rail{position:static;flex-basis:auto;width:100%;order:-1;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:4px;border-bottom:1px solid var(--b-edge);padding:0 0 8px;}.pb-rail-label{display:none;}.pb-rail-item{width:auto;flex-shrink:0;white-space:nowrap;border-left:none;border-bottom:2px solid transparent;padding:7px 10px;}.pb-rail-item.active{border-left:none;border-bottom-color:var(--focus);}.pb-parts{grid-template-columns:1fr;}.pb-docs{flex-direction:column;}.pb-docs a,.pb-go{width:100%;}}'
      + '</style>';
  },

  // ── Content (Profit) ──────────────────────────────────────────────────────────
  CONTENT: {
    cash: {
      label: 'Cash',
      intro: 'The strategic read behind your Cash Fix System. Profit is your margin and Revenue is your top line, but Cash is the one that closes the doors. Plenty of bars are profitable on paper and still run tight. This is where the money gets stuck, what it costs you to leave it there, and the exact Bar Cop screen that frees it. No spreadsheets. Bar Cop does that math now.',
      sections: [
        {
          id: 'worth', nav: 'What It Costs You', eyebrow: 'What tight cash costs',
          title: 'Profitable on Paper, Broke in the Bank',
          blocks: [
            { t: 'lead', text: 'You can run a healthy margin, ring strong sales, and still sweat payroll on a slow Tuesday. Profit is what you earned. Cash is what is actually in the account on the day a bill is due, and the two are not the same number. The gap between them is where good bars die.' },
            { t: 'p', text: 'Cash gets stuck in two places: on your shelves, as inventory you bought ahead of when you need it, and in the calendar, as money going out before the money comes in. Neither shows up on a P&L. Both are recoverable, and Bar Cop reads them straight off the data you already keep.' },
            { t: 'box', tone: 'gold', label: 'The stakes', title: 'The number one killer of independent bars is not profit, it is cash', text: 'A bar can post a profit every month for a year and still close because it ran out of cash on the wrong week. Most operators never see it coming because nothing is watching the timing. Trapped inventory and a blind cash calendar are the two leaks behind almost every tight week.' },
            { t: 'h', text: 'The Four Places It Gets Stuck' },
            { t: 'p', text: 'It is rarely one thing. A bar that is profitable and still tight almost always has the same four leaks running at once.' },
            { t: 'table',
              head: ['The leak', 'What it looks like', 'Illustrative cost'],
              rows: [
                ['Dead stock', 'Slow premium bottles and odd one-offs that sit for months. Real money, frozen on the shelf.', 'A typical bar carries $2,000 to $6,000 in stock that has not moved in 60 days.'],
                ['Overstock', 'Ordering to a comfort number instead of par. Cases you will not touch for a month.', 'A week of extra inventory across the bar is often $3,000 to $8,000 in idle cash.'],
                ['Paying early', 'Paying every invoice the day it lands, handing vendors your cash weeks before it is owed.', 'On $30,000 a month in payables, holding to net terms frees thousands in float.'],
                ['Tight-week surprises', 'A quarterly bill or a big order landing on a slow week, with nothing watching for it.', 'One scramble can mean an overdraft fee, a rushed loan, or a vendor putting you on hold.']
              ] },
            { t: 'h', text: 'What Freeing It Looks Like' },
            { t: 'p', text: 'This is a worked example, not a promise. Take a bar carrying about four weeks of inventory when it uses two, paying on receipt with no terms set, and no forward look at the cash calendar. Here is the arc the first 90 days tends to follow.' },
            { t: 'table',
              head: ['Lever', 'Day 1', 'What changes', 'Cash freed'],
              rows: [
                ['Trapped inventory', '$5,800 in dead and overstock', 'Pars cut to real usage, dead stock run down', '$3,000 to $4,000 back in the account'],
                ['Weeks on hand', '4.1 weeks', 'Order to par, not to fear', 'A week of inventory freed across the bar'],
                ['Vendor terms', 'Paid on receipt', 'Net 30 set and held to the due date', 'Weeks of float on every payables dollar'],
                ['Tight weeks', 'Found on Friday', 'Seen four weeks out on the forecast', 'Moved or covered before it bit']
              ],
              note: 'Illustrative example. Your real recovery depends on how much is trapped and how far you are paying ahead of terms. Bar Cop measures your actual number off your counts.' },
            { t: 'box', tone: 'steel', title: 'This cash is yours, sitting still', text: 'Trapped cash is not lost, it is frozen. It is your money, on your shelf or in someone else\'s account early. The whole job of Cash Recovery is to thaw it and put it back to work.' }
          ]
        },
        {
          id: 'bridge', nav: 'Where the Profit Went', eyebrow: 'Profit to cash',
          title: 'You Earned a Profit. Where Did It Go?',
          blocks: [
            { t: 'lead', text: 'The P&L says you made money last month. The account says otherwise. That gap is not an accounting error and it is not theft. It is your profit sitting somewhere other than the bank, and there are only a few places it can be.' },
            { t: 'p', text: 'Profit turns into cash, or it does not, through a short list of moves. Some went back onto the shelf as inventory you bought. Some left as an owner draw, which is real cash out even though it is not a business expense. Some went to loan principal, which a P&L barely shows. And some was sales tax you collected and paid through, money that was never yours to begin with. Add those up and the missing profit is accounted for to the dollar.' },
            { t: 'box', tone: 'steel', title: 'Profit, minus where it went, equals the cash you kept', text: 'The Cash Bridge lays it out as a waterfall: your profit for the period, minus what went into inventory, minus owner draws, minus loan payments, minus tax remitted, equals the cash you actually kept. When that kept number is small against a healthy profit, this is the screen that tells you exactly why instead of leaving you to guess.' },
            { t: 'p', text: 'This is less a leak to plug than a truth to see. Some of those outflows are necessary and some are choices, but you cannot manage what you cannot see. Read the bridge each month and the profitable-but-broke mystery stops being one.' },
            { t: 'go', label: 'Cash Bridge', screen: 'c-bridge' }
          ]
        },
        {
          id: 'timeline', nav: 'The First 90 Days', eyebrow: 'What to expect and when',
          title: 'Freeing Cash Has a Timeline',
          blocks: [
            { t: 'p', text: 'The first 30 days are about reading the truth. A couple of clean counts and Bar Cop shows you what is trapped, how many weeks you are carrying, and where the cash calendar gets tight. The number is usually bigger than the gut estimate.' },
            { t: 'p', text: 'Days 30 to 60 are where the cash comes back. Pars get cut to real usage, the dead stock gets run down, and you start ordering to par instead of to fear. Weeks on hand drops, and the difference is cash in the account.' },
            { t: 'p', text: 'By day 90 the timing is under control too. Vendor terms are set and held, the forecast is read every week, and a tight week gets spotted and covered before it lands. Same sales, same room, more cash on hand.' },
            { t: 'table',
              head: ['Phase', 'What is happening', 'What to expect'],
              rows: [
                ['Days 1-30', 'First counts, trapped cash read, weeks on hand and the cash calendar baselined', 'No results yet. This is reading the truth, not fixing it.'],
                ['Days 30-60', 'Pars cut, dead stock run down, ordering to par', 'Trapped cash starts coming back, a few thousand is typical'],
                ['Days 60-90', 'Vendor terms set and held, forecast read weekly, tight weeks covered early', 'Cash on hand climbs and the tight weeks stop surprising you'],
                ['Day 90+', 'Every system running, the weekly cash sitting standard', 'Your real freed-cash number is established']
              ],
              note: 'The most common place it breaks is the moment a busy week knocks the count off schedule, because trapped cash reads off your counts. Bar Cop tracks whether each system is still running and flags the moment one slips.' }
          ]
        },
        {
          id: 'diagnostic', nav: 'Cash Diagnostic', eyebrow: 'Cash diagnostic',
          title: 'How Tight Are You Right Now?',
          blocks: [
            { t: 'lead', text: 'Eleven questions. Yes or no, no partial credit. If the answer is kind of, or I think so, that is a No. You either know the number this week or you do not.' },
            { t: 'p', text: 'Most operators know last weekend sales cold. Ask how much cash is trapped on the shelf, or what next week looks like against the bills, and the room goes quiet. The monthly figure next to each No is an illustrative example of what that gap commonly costs, not your number.' },
            { t: 'diag', items: [
              { n: 1, cost: '$800', q: 'Do you know how much cash is trapped on your shelves right now, in dead stock and overstock?', yes: 'You can see your frozen capital and work the biggest pieces down. The cash comes back as you do.', no: 'You are carrying money on the shelf you cannot see. Dead bottles and overstock sit for months while you sweat the account.' },
              { n: 2, cost: '$700', q: 'Do you know how many weeks of inventory you are carrying against what you actually use?', yes: 'You order to par, not to fear, so cash stops piling up on the shelf.', no: 'You are likely carrying weeks of extra inventory, which is weeks of idle cash you could be using elsewhere.' },
              { n: 3, cost: '$600', q: 'Have you set the real payment terms on every vendor, net 7, 15, or 30?', yes: 'You hold your cash to the due date and take any early-pay discount worth taking. The float is yours.', no: 'You are likely paying on receipt, handing vendors your cash weeks before it is owed for nothing in return.' },
              { n: 4, cost: '$900', q: 'Can you say right now whether next week has more cash going out than coming in?', yes: 'You see the tight weeks four weeks out and move a payment or hold an order before they bite.', no: 'You find the tight week on the day the truck wants a check. That is how a profitable bar ends up scrambling.' },
              { n: 5, cost: '$500', q: 'Do you know your cash runway, how many weeks your cash on hand covers at this burn?', yes: 'You know exactly how much cushion you have, so a slow stretch is a plan, not a panic.', no: 'You are guessing at your cushion. A bad two weeks can put you against the wall with no warning.' },
              { n: 6, cost: '$700', q: 'Did you run your slow movers down or cut a par in the last 30 days?', yes: 'You are actively thawing trapped cash, not just watching it.', no: 'Trapped cash only comes back when you work it. Sitting on it is the same as leaving the money on the shelf.' },
              { n: 7, cost: '$400', q: 'Do you order to par off real usage, instead of padding every order just in case?', yes: 'Your orders right-size themselves and the overstock works off on its own.', no: 'The padding you add to feel safe is exactly the cash that ends up trapped.' },
              { n: 8, cost: '$600', q: 'Do you read a forward cash look every week, not just last month\'s bank balance?', yes: 'You manage the timing, so the lumpy bills and big buys never catch you flat.', no: 'A bank balance tells you where you were. It says nothing about the bill landing next Thursday.' },
              { n: 9, cost: '$300', q: 'Have you asked a vendor for better terms in the last 90 days?', yes: 'Your steady accounts move from net 15 to net 30 when you ask, and that is free float.', no: 'Most distributors give terms to a steady account that asks. If you never ask, you never get them.' },
              { n: 10, cost: '$400', q: 'Could you cover a surprise $5,000 expense next week without a scramble?', yes: 'You have a real cushion and a forward look, so a surprise is an inconvenience, not a crisis.', no: 'A single surprise on the wrong week is how good bars end up borrowing at bad rates or paying late.' },
              { n: 11, cost: '$600', q: 'Do you know how much of the cash in your account is actually yours to spend, after the sales tax and tips you owe?', yes: 'You spend off your Safe to Spend, so the tax bill never catches you having already spent money that was the state\'s.', no: 'You are reading the balance as if it is all yours. Spending the sales tax you collected is the classic way a profitable bar ends up unable to pay its tax bill.' }
            ] },
            { t: 'diagscore' },
            { t: 'box', tone: 'steel', label: 'Five things that are true about every bar', items: [
              'Profit is an opinion until the cash clears. The bank balance is the only number that cannot be argued with.',
              'Money on the shelf is not inventory, it is frozen cash with a spoilage clock on it.',
              'Every dollar you pay before its due date is a free loan to a vendor who did not even ask for it.',
              'The tight week is always visible weeks ahead. The only question is whether anything is looking.',
              'The bar that watches its cash is not the busiest on the block. It is the one that makes payroll in a slow February.'
            ] }
          ]
        },
        {
          id: 'what', nav: 'What Bar Cop Does', eyebrow: 'What Bar Cop does for you',
          title: 'Every Dollar: Found, Freed, Tracked',
          blocks: [
            { t: 'lead', text: 'You already keep the data. Your counts say what is on the shelf, your orders and bills say what is going out, your forecast says what is coming in. Bar Cop reads all of it and turns it into the four cash systems, then walks you into the exact screen that frees the money.' },
            { t: 'p', text: 'Here is the map. Every leak, where you capture it, where Bar Cop shows it, and where you fix it. Tap any Fix button to jump straight there.' },
            { t: 'cross', rows: [
              { leak: 'Trapped inventory cash', capture: 'Take Inventory weekly count + product costs', show: 'Trapped Cash', fixLabel: 'Free Trapped Cash system', screen: 'c-fix', focus: 'free-trapped' },
              { leak: 'Over-ordering', capture: 'Counts, the Order Sheet, and your pars', show: 'Purchasing', fixLabel: 'Order to Par system', screen: 'c-fix', focus: 'order-to-par' },
              { leak: 'Cash timing', capture: 'Revenue forecast, schedule, and bills in Books', show: 'Cash Forecast', fixLabel: 'Stay Ahead system', screen: 'c-fix', focus: 'stay-ahead' },
              { leak: 'Paying early', capture: 'Vendor payment terms + bills in Books', show: 'the Pay on Terms step on Close The Week', fixLabel: 'Pay on Terms system', screen: 'c-fix', focus: 'pay-on-terms' }
            ] },
            { t: 'p', text: 'Three more screens give you the whole cash picture beyond the four leaks. Cash Position shows what is truly safe to spend once the tax and tips you owe and your reserve are set aside. The Cash Bridge shows where last month\'s profit went instead of into the account. Capital Efficiency shows how hard the cash on your shelves is working. None of them is a chore; they are the read that tells you whether the systems are winning.' },
            { t: 'p', text: 'And you do not read it alone. Close The Week lands you on the week\'s steps in order, the Where You Stand card tracks what you have freed, and every figure reads live off your own counts and bills, never a made-up number.' }
          ]
        },
        {
          id: 'position', nav: "What's Actually Yours", eyebrow: 'True available cash',
          title: 'The Balance Is Not the Number',
          blocks: [
            { t: 'lead', text: 'There is the number in your account and there is the number you can actually spend, and they are not the same. Part of that balance is money you are only holding: the sales tax you collected and owe the state, and outstanding gift cards you already took cash for. Spend it and you come up short the day it is due.' },
            { t: 'p', text: 'Spending the sales tax you collected is the single most common way a profitable bar ends up unable to pay its tax bill. It does not feel like spending someone else\'s money, because it is sitting right there in the account, but every dollar of tax in a guest\'s check belonged to the state the moment they paid. Outstanding gift cards are the same: cash you already took in with product still owed.' },
            { t: 'p', text: 'Under that sits your reserve, the cushion a healthy bar keeps to cover its fixed bills through a slow stretch with no sales. What is left after the money you owe and the reserve you should hold is your Safe to Spend, the only number you can move on without putting the business at risk.' },
            { t: 'box', tone: 'gold', label: 'The number that keeps you out of trouble', text: 'Set your reserve target on Cash Position and your sales tax rate in Business Profile. Cash Position then carves the tax and gift cards you owe out of your balance, sizes the reserve off your real fixed overhead, and shows your Safe to Spend. If that number is negative, you are already leaning on money that is spoken for.' },
            { t: 'go', label: 'Cash Position', screen: 'c-position' }
          ]
        },
        {
          id: 'benchmarks', nav: 'Benchmarks', eyebrow: 'Benchmarks',
          title: 'The Numbers to Run Against',
          blocks: [
            { t: 'p', text: 'These are your reference points. Bar Cop measures against them for you every week, but know them cold. Know how many weeks of each category you should carry, when trapped cash crosses from normal into a problem, what terms your vendors will actually give you, and how much runway is healthy.' },
            { t: 'h', text: 'Weeks of Inventory On Hand' },
            { t: 'table',
              head: ['Category', 'Target weeks', 'High warning', 'Too much', 'Why'],
              rows: [
                ['Liquor', '2-3', '4', '5+', 'Long shelf life tempts overbuying; premium bottles sit the longest'],
                ['Wine', '3-4', '5', '6+', 'A by-the-bottle list needs depth, but slow SKUs quietly trap cash'],
                ['Bottle beer', '1-2', '3', '4+', 'Dated product; overstock risks code dates and dumps'],
                ['Draft beer', '1-1.5', '2', '3+', 'Kegs are perishable; carry close to what you actually pour'],
                ['Food', '0.5-1', '1.5', '2+', 'Perishable; carry to the next delivery, not past it'],
                ['Overall bar', '2-3', '4', '5+', 'Above three weeks blended, run the category breakdown to find the overstock']
              ] },
            { t: 'h', text: 'Trapped Cash Thresholds' },
            { t: 'table',
              head: ['Signal', 'Healthy', 'Watch', 'Act now', 'What it means'],
              rows: [
                ['Trapped as % of inventory value', 'Under 5%', '5-12%', '12%+', 'Dead stock plus overstock against your total shelf value'],
                ['Dead stock, no movement in 60 days', 'Under $500', '$500-$2,000', '$2,000+', 'Cash frozen with a spoilage clock running on it'],
                ['Any single slow SKU tied up', 'Under $150', '$150-$400', '$400+', 'Usually one premium program that went cold']
              ] },
            { t: 'h', text: 'Vendor Payment Terms' },
            { t: 'table',
              head: ['Vendor type', 'Common terms', 'Worth asking for', 'Note'],
              rows: [
                ['Broadline / major distributor', 'Net 14-30', 'Net 30', 'A steady account gets net 30 just by asking'],
                ['Local / specialty', 'COD to Net 7', 'Net 15', 'Smaller vendors guard cash; build the relationship first'],
                ['Produce / perishable', 'Net 7-14', 'Net 14', 'Fast turns, so shorter terms are normal here'],
                ['Beer and wine', 'COD to Net 30', 'Net 15-30', 'Some states restrict alcohol terms; know your local rules']
              ],
              note: 'Terms are state-dependent for alcohol. Where they are allowed, ask. The float is free money and most distributors extend it to an account that asks.' },
            { t: 'h', text: 'Cash Runway' },
            { t: 'table',
              head: ['Runway your cash on hand covers', 'Position', 'What to do'],
              rows: [
                ['8+ weeks', 'Strong', 'You can absorb a slow stretch and a surprise without flinching'],
                ['4-8 weeks', 'Healthy', 'Normal for a well-run bar; just watch the tight weeks on the forecast'],
                ['2-4 weeks', 'Thin', 'Free your trapped cash and tighten terms before the next slow patch'],
                ['Under 2 weeks', 'Tight', 'One bad fortnight is a crisis; work every lever in this playbook now']
              ],
              note: 'Runway needs your cash on hand, the one number only you know. Enter it on the Cash Forecast, plus any line of credit you would lean on, and the weekly net becomes a real runway that knows your backstop.' },
            { t: 'h', text: 'Cash Conversion Cycle' },
            { t: 'table',
              head: ['Days your cash is locked', 'Position', 'What it means'],
              rows: [
                ['Negative', 'Strong', 'You sell the product before the vendor bill is due; your vendors finance your inventory'],
                ['0 to 15 days', 'Healthy', 'Cash comes back about as fast as you pay; normal for a tight, fast-turning bar'],
                ['15 to 30 days', 'Watch', 'A couple of weeks of cash locked in the operating cycle; tighten pars or stretch terms'],
                ['30+ days', 'Too much', 'A month of cash trapped between buying and selling; real money to free']
              ],
              note: 'The cash cycle is the days product sits on your shelf minus the days you take to pay your vendors. Order to par to cut the first, hold your terms to stretch the second. Capital Efficiency shows your number.' }
          ]
        },
        {
          id: 'connect', nav: 'How It Connects', eyebrow: 'How the systems connect',
          title: 'Four Systems, One Cash Position',
          blocks: [
            { t: 'p', text: 'These are not four separate chores. Free your trapped cash but keep ordering to a comfort number and the shelf refills in a month. Hold your vendor terms but never look at the week ahead and a quarterly bill still catches you flat. Cash control fails when it is treated as separate problems instead of one connected position you manage every week.' },
            { t: 'p', text: 'The four systems are sequenced on purpose. Free the trapped cash first, because that is the biggest one-time pile and it funds the cushion. Then stop refilling it by ordering to par. Then manage the timing with the forecast and your terms so the cash you freed stays free.' },
            { t: 'parts', items: [
              { label: 'System 1', name: 'Free Trapped Inventory Cash', desc: 'The biggest one-time pile. Turn dead stock and overstock back into account cash.', focus: 'free-trapped' },
              { label: 'System 2', name: 'Order to Par', desc: 'Stop refilling the pile. Buy what you use, not a number that feels safe.', focus: 'order-to-par' },
              { label: 'System 3', name: 'Stay Ahead of the Week', desc: 'Manage the timing. See the tight weeks two to four weeks out and cover them early.', focus: 'stay-ahead' },
              { label: 'System 4', name: 'Pay on Terms', desc: 'Keep the float. Hold every bill to its due date and take the discounts worth taking.', focus: 'pay-on-terms' }
            ] },
            { t: 'box', tone: 'gold', label: 'The logic in plain language', text: 'Trapped cash is the fastest money to free, so start there and it pays for the breathing room. But freeing it once does nothing if you keep over-ordering, so System 2 stops the shelf from refilling. Systems 3 and 4 are the timing half: the forecast shows you the tight weeks before they land, and holding your terms keeps the cash you freed in your account longer. Start by freeing what is trapped. Everything after that is about keeping it free.' },
            { t: 'go', label: 'Cash Fix System', screen: 'c-fix', focus: 'free-trapped' }
          ]
        },
        {
          id: 'c1', nav: 'System 1: Free Trapped Cash', eyebrow: 'System 1 - the biggest pile',
          title: 'Free Trapped Inventory Cash',
          blocks: [
            { t: 'lead', text: 'A craft cocktail bar in Denver, strong margins, busy four nights a week. The owner is proud of a deep back bar, forty-some premium and rare bottles. We counted and ran it: $6,200 sitting in bottles that had not poured a single drink in two months. Not spoiled, not stolen. Just bought for a cocktail program that changed, and never moved since. Six thousand dollars frozen on a shelf the owner walked past every day.' },
            { t: 'p', text: 'Trapped cash is the quietest drain in the building because it does not look like a loss. It looks like inventory. A full, deep shelf feels like strength, and a slow premium bottle feels like an investment. But cash on the shelf is not working. It is not in your account when the rent is due, and the longer it sits the more it risks a code date or a dusty bottle nobody orders.' },
            { t: 'p', text: 'There are two kinds and Bar Cop separates them so you do not double count. Dead stock is product that did not move at all between your last two counts; its full value is frozen. Overstock is product still moving but sitting well above its par; the cash is in the extra you did not need yet. A bar carrying four weeks of inventory it uses in two is sitting on a week or two of idle cash across the whole room, and that is usually thousands of dollars.' },
            { t: 'p', text: 'Freeing it is not complicated, it is just deliberate. Run a dead bottle down: feature it, build a cocktail around it, put it on a special, or eighty-six it and stop reordering. For overstock, cut the par so the next order is smaller and the extra works off on its own. Done across the back bar, that is real money back in the account inside a few weeks.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You count in Take Inventory and the moment it saves, Trapped Cash ranks every product by the dollars you can free, dead stock and overstock both. Dynamic Pars is where you cut the pars that run above your usage so the shelf stops refilling. Cash Freed on your Cash Fix tracks the drop in trapped capital from your own first weeks, so you see the money come back.' },
            { t: 'go', label: 'Trapped Cash', screen: 'c-trapped' },
            { t: 'go', label: 'Dynamic Pars', screen: 'ic-par-suggestions' },
            { t: 'go', label: 'Free Trapped Cash system', screen: 'c-fix', focus: 'free-trapped' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Count on the same day every week, so trapped cash and the cash you free stay honest.',
              'Work the Trapped Cash list top down: the biggest dollars first.',
              'Run a dead bottle down before it dusts: feature it, special it, build a cocktail, or 86 it.',
              'Cut the par on anything you keep reordering before it runs low.',
              'Give a slow SKU two counts of no movement before you call it dead, so a seasonal item does not get cut early.',
              'Re-count the following week and watch Cash Freed climb.'
            ] }
          ]
        },
        {
          id: 'c2', nav: 'System 2: Order to Par', eyebrow: 'System 2 - stop refilling the pile',
          title: 'Order to Par, Not to Fear',
          blocks: [
            { t: 'lead', text: 'A neighborhood bar orders the same way every week: walk the shelf, eyeball what looks low, and round every order up a case "to be safe." Nobody ever ran the math. We did: four and a half weeks of inventory on hand for a bar that turns its product in two. The padding the owner added every week to feel safe was about $7,000 in cash sitting on the shelf at any given moment. Safe was expensive.' },
            { t: 'p', text: 'Over-ordering is how the trapped pile refills the moment you free it. Every case you buy ahead of when you need it is cash off your account and onto the shelf, and it is the easiest leak in the business to rationalize because running out feels worse than overbuying. But a bar that carries two to three weeks of most categories almost never runs out, and it keeps weeks of cash in the account instead of on the rack.' },
            { t: 'p', text: 'The fix is to order to par off real usage, not a comfort number. Par is what you actually use between deliveries plus a thin safety buffer, and Bar Cop sets it off your counts instead of your gut. Where a category keeps coming in overstocked, the par is too high; cut it and the orders right-size themselves. And consolidating to fewer, fuller orders timed near when your sales come in keeps the cash in your account a few extra days each cycle.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Purchasing shows your weeks on hand against your usage and which categories are overstocked, so you know which order to tighten first. Capital Efficiency goes a level deeper, showing how many times a year you turn the cash in each category and how many days your cash stays locked from buying product to selling it, so you can see exactly where the cash is parked longest. Dynamic Pars sets pars off real usage. The Order Sheet brings everything to par and no further. Re-count the next week and watch your weeks on hand settle toward target.' },
            { t: 'go', label: 'Purchasing', screen: 'c-purchasing' },
            { t: 'go', label: 'Capital Efficiency', screen: 'c-capital' },
            { t: 'go', label: 'Order Sheet', screen: 'ic-order-sheet' },
            { t: 'go', label: 'Order to Par system', screen: 'c-fix', focus: 'order-to-par' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Read your weeks on hand in Purchasing before you place the order.',
              'Order to par, not to a number that feels safe. The buffer is in the par already.',
              'If a category keeps coming in overstocked, the par is too high. Cut it in Dynamic Pars.',
              'Check Capital Efficiency for the categories with the lowest turns; that is where your cash sits longest.',
              'Consolidate to fewer, fuller orders and time them near when your sales land.',
              'Targets by category are in the Benchmarks section.',
              'Re-count the following week and confirm weeks on hand is coming down.'
            ] }
          ]
        },
        {
          id: 'c3', nav: 'System 3: Stay Ahead', eyebrow: 'System 3 - manage the timing',
          title: 'Stay Ahead of the Week',
          blocks: [
            { t: 'lead', text: 'A profitable bar, six years open, never missed a payroll. Then a slow February week landed the same days as the quarterly insurance bill and a big liquor reorder, and there was not enough in the account on Thursday when the truck wanted a check. The owner moved money from savings and made it work, but it was a scramble that a single glance at the weeks ahead would have turned into a non-event. Profit was never the problem. Timing was.' },
            { t: 'p', text: 'Cash is about timing as much as amount. A bar can be profitable for the month and still be short on the wrong Thursday, because the bills, the orders, and the labor do not line up neatly with the days the sales come in. The lumpy ones do the damage: a quarterly bill, an annual license, a big equipment buy, the things that do not show up on a normal week and are exactly the ones a busy operator forgets are coming.' },
            { t: 'p', text: 'The fix is to look the whole quarter ahead, every week, and line up what is going out against what is coming in. A week where more goes out than comes in is a tight week, and seeing it on Sunday gives you options a Friday scramble never does: move a payment to its actual due date, hold a big order a week, lean out a slow shift, or just know to keep the cushion in place. The move is small. The cost of not seeing it is not.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Cash Forecast projects the full quarter, thirteen weeks ahead, lining up your projected sales and event balances coming in against payroll, purchases, and every bill due that week, the recurring ones projected forward too. Enter your cash on hand and it becomes a running balance with your low-point week, your runway, and the line where you would go negative. Enter a line of credit too and Bar Cop counts it as your backstop, so the runway and the can-I-afford read both know what you can lean on. Slide sales down to stress-test a slow season, or drop in a what-if, a second bartender, an equipment buy, an owner draw, and see whether you can carry it before you commit. Export it as a clean thirteen-week cash flow to walk into a lender. The bills come from Books, the sales from your forecast, the labor from your schedule.' },
            { t: 'go', label: 'Cash Forecast', screen: 'c-forecast' },
            { t: 'go', label: 'Review Bills', screen: 'books' },
            { t: 'go', label: 'Stay Ahead system', screen: 'c-fix', focus: 'stay-ahead' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Read the Cash Forecast every week, not once a quarter. Tight weeks form on a few days notice.',
              'Enter your cash on hand so the net becomes a real running balance and runway.',
              'Find the week where cash out beats cash in, and cover it before it lands.',
              'Watch for the lumpy ones: quarterly bills, annual licenses, big equipment buys.',
              'Stress-test a slow season or a big buy with the slider and Can I Afford It before you commit to it.',
              'To cover a tight week, move a payment to its due date, hold a big order, or lean out a slow shift.',
              'Confirm the week is back in the black after your moves.'
            ] }
          ]
        },
        {
          id: 'c4', nav: 'System 4: Pay on Terms', eyebrow: 'System 4 - keep the float',
          title: 'Pay on Terms',
          blocks: [
            { t: 'lead', text: 'An owner pays every invoice the day it lands, always has, takes a kind of pride in it. His main distributor gives him net 30. He pays on day three. We ran it: on about $28,000 a month in payables, paying three to four weeks early was handing the distributor the use of his cash for nothing, every single month. Not a penny of discount for it. Just a habit of paying fast that quietly cost him his float.' },
            { t: 'p', text: 'If a vendor gives you net 30, paying on day 5 hands them the use of your money for three weeks for free. That float is real: it is cash that could be covering a tight week, freeing you from a savings transfer, or just sitting in your account earning a little instead of theirs. Paying on the due date is not slow-paying or playing games. It is using the terms you already negotiated.' },
            { t: 'p', text: 'There is a flip side, and it is the one exception. An early-pay discount, two percent off for paying in ten days, usually beats what the cash is worth to you that month, so take those. The discipline is simple: hold every bill to its due date unless there is a discount that beats holding it. And ask for terms you do not have. Most distributors extend net 30 to a steady account that simply asks at the quarterly review.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Set the real terms on each vendor record in List Vendors, net 7, 15, or 30. Bar Cop uses them to flag anything you are paying ahead of the due date and to time the cash-out side of your forecast. Your bills live in Books, where you pay on the due date and take the discounts worth taking.' },
            { t: 'go', label: 'List Vendors', screen: 'ic-vendors' },
            { t: 'go', label: 'Review Bills', screen: 'books' },
            { t: 'go', label: 'Pay on Terms system', screen: 'c-fix', focus: 'pay-on-terms' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Set the real payment terms on every vendor record.',
              'Pay on the due date, not the day the invoice lands.',
              'Take an early-pay discount when it beats what the cash is worth to you that month.',
              'Ask every vendor for better terms at your quarterly review. Steady accounts get net 30 by asking.',
              'Know your local rules; some states restrict terms on alcohol.',
              'Terms norms by vendor type are in the Benchmarks section.'
            ] }
          ]
        },
        {
          id: 'close', nav: 'Start Tonight', eyebrow: 'Start tonight',
          title: 'Profit Is an Opinion, Cash Is a Fact',
          blocks: [
            { t: 'lead', text: 'A bar in Portland, profitable on paper for two straight years, always tight, always sweating the slow weeks. The owner ran the whole system: counted weekly, freed the trapped cash, cut the pars, set vendor terms and held them, read the forecast every Sunday. Ninety days later there was an extra few thousand dollars sitting in the account that used to live on the shelf, the tight weeks stopped being surprises, and a slow February was a plan instead of a panic. Same sales. Same room. The cash had just been somewhere it could not help.' },
            { t: 'p', text: 'What separates a bar that runs flush from one that is always tight is rarely sales. It is whether anyone is watching where the cash sits and when it moves. The tools are not complicated and the math is not advanced. What it takes is reading the number every week, freeing what is frozen, and holding your terms, whether or not it feels urgent. The week it feels least urgent is usually the week a tight one is forming.' },
            { t: 'box', tone: 'gold', label: 'Do these tonight', text: 'Open Trapped Cash and read what is frozen on your shelves. Open the Cash Forecast and look at the next four weeks. Set the payment terms on your top three vendors in List Vendors. Then open your Cash Fix and work the first system, so Bar Cop starts tracking the cash you free.' },
            { t: 'p', text: 'The gap between what you are earning and what is actually in the account is not a mystery. It is a timing and a trapped-cash problem, and both are fixable. Start freeing it tonight.' },
            { t: 'go', label: 'Cash Fix System', screen: 'c-fix', focus: 'free-trapped' }
          ]
        }
      ]
    },
    profit: {
      label: 'Profit',
      intro: 'The strategic read behind your Profit Fix System. The Fix screens tell you what to do this week. This is the why behind it: where the money leaks, what each leak quietly costs, and the exact Bar Cop screen that captures, measures, and closes it. No spreadsheets, no formulas. Bar Cop does that math now.',
      sections: [
        {
          id: 'worth', nav: 'What It Costs You', eyebrow: 'What running without systems costs',
          title: 'The Money Leaving Before You See It',
          blocks: [
            { t: 'lead', text: 'You know your sales number cold, against last year, last month, and your gut for how the room felt. The money that never shows up on a report is what walks back out the door: pour cost nobody is watching, food cost with no recipe behind it, vendor invoices nobody audits, and theft that never hits the P&L.' },
            { t: 'p', text: 'A bar running without real cost controls gives back roughly 8 to 14 percent of sales to preventable gaps. Not from a bad location. Not from slow nights. From the absence of a system. The money is recoverable. It takes a system to pull it back, and that system is what Bar Cop runs for you.' },
            { t: 'box', tone: 'gold', label: 'The stakes', title: '8 to 14 percent of sales walks out the door', text: 'On a million-dollar bar that is 80,000 to 140,000 a year. On a 500,000 bar, 40,000 to 70,000. These are illustrative ranges for a bar running with no pour tracking, no recipe cost cards, no vendor audits, and no weekly prime cost review. Your real number is whatever Bar Cop measures once you start.' },
            { t: 'h', text: 'The Four Places It Disappears' },
            { t: 'p', text: 'It is never one thing. A bar bleeding money despite solid sales almost always has the same four leaks running at once. Each one alone is a problem. All four together is why the money is gone and nobody can say where.' },
            { t: 'table',
              head: ['The leak', 'What it looks like', 'Illustrative cost'],
              rows: [
                ['Pour cost variance', 'Most loose bars run 6 to 12 points above target. Free-pouring, over-portioning, unrecorded comps.', 'Every point is real money: about 7,500 a year per point on 750K in bar sales.'],
                ['Food cost drift', 'No recipe cards means no cost floor. Bars without cards typically run 34 to 42 percent when the target is 28 to 32.', '4 to 6 points recoverable in 90 days.'],
                ['Vendor overcharges', 'Price drift, substitutions billed at premium, short counts nobody checks against the order.', 'A quarterly invoice audit typically finds 2 to 4 percent recoverable.'],
                ['Theft and comp abuse', 'No shift accountability. Voids, comps, and no-rings invisible until the loss is big enough to feel.', 'Undetected theft conservatively runs 1 to 3 percent of bar sales.']
              ] },
            { t: 'h', text: 'What One Point Is Worth' },
            { t: 'p', text: 'Pour cost is usually where the biggest recoverable number lives, and the fastest to move once the controls are in. Measured pours and weekly counting consistently pull back 3 to 5 points in 60 to 90 days. Find your level. The gap between a controlled pour cost and a loose one is real money every year.' },
            { t: 'table',
              head: ['Annual bar sales', 'One point of pour cost', 'A 4-point recovery'],
              rows: [
                ['$500,000', '$5,000 / yr', '$20,000 / yr'],
                ['$750,000', '$7,500 / yr', '$30,000 / yr'],
                ['$1,000,000', '$10,000 / yr', '$40,000 / yr'],
                ['$1,500,000', '$15,000 / yr', '$60,000 / yr']
              ],
              note: 'Illustrative example. From one part of the system. Your actual recovery depends on how far above target you start and how consistently the system runs.' },
            { t: 'h', text: 'What 90 Days Looks Like' },
            { t: 'p', text: 'This is a worked example, not a promise. Take a full-service bar and kitchen doing about 1.1 million a year, 720,000 bar and 380,000 food. The owner has run it six years. He knows the room. He does not know his pour cost, his recipe costs, or his prime cost within four points. Here is the arc the first 90 days tends to follow.' },
            { t: 'table',
              head: ['Metric', 'His estimate', 'Actual at day 1', 'The gap'],
              rows: [
                ['Pour cost', '23%', '31.4%', '8.4 points above where he thought he was'],
                ['Food cost', '32%', '38.2%', 'No recipe cards, protein yields never run'],
                ['Vendor overcharges', 'Unknown', '$4,800 in 6 months', 'Found in the first delivery audit across 3 distributors'],
                ['Prime cost', '58%', '67.1%', '9 points above target for a full-service room']
              ],
              note: 'Day 1 is always uncomfortable. The number is almost always worse than the estimate. That is not a failure. That is the first accurate look this bar has had at itself in six years.' },
            { t: 'p', text: 'Week two: a signed pour policy goes up and measured pours start. Weekly counting begins in Take Inventory. The first delivery audit catches 840 in price variances and the credits get requested. Recipe costs go in on the top ten menu items. The first variance report flags well vodka and house tequila running 11 to 13 percent over.' },
            { t: 'p', text: 'Week six: pour cost is at 27.8 percent, down 3.6 points. The well variance resolves to a mix of free-pouring and one Friday bartender pocketing 60 to 80 a shift in no-ring cash. Documented. Addressed. Recipe costs are in on 22 items. Four price below their cost floor: two get a price move, two get a recipe change.' },
            { t: 'p', text: 'Day 90: the first full quarter. Pour cost 24.3, down 7.1 points. Food cost 32.8, down 5.4. Vendor credits recovered: 6,200 in the quarter. Prime cost 59.4, under 60 for the first time in the bar history. Same room, same staff, no new customers. A different set of systems running every week.' },
            { t: 'box', tone: 'steel', title: 'This gap exists whether you track it or not', text: 'The money is leaving right now, every shift. The only question is whether something is telling you where it goes and handing you the tool to stop it. That is the whole job Bar Cop does.' }
          ]
        },
        {
          id: 'timeline', nav: 'The First 90 Days', eyebrow: 'What to expect and when',
          title: 'Recovery Has a Timeline',
          blocks: [
            { t: 'p', text: 'The first 30 days are about baselines, not results. You run a real count and read your actual pour cost. It usually lands higher than the estimate. That is the system doing its job: the bar without the comfortable fog of not measuring.' },
            { t: 'p', text: 'Days 30 to 60 are where the first real movement happens. Measured pours are in. Counts are running on a schedule. The variance report is flagging items to chase. Pour cost usually starts moving here, a point or two at first, more if free-pouring was bad. Food cost moves slower because recipe costs take time to build, so expect food results in the 60 to 90 day window.' },
            { t: 'p', text: 'By day 90 every system should be running. Pour cost trending to target, food cost measurably below the day-1 baseline, the first vendor credits requested, prime cost reviewed every week. The operation looks different from the inside.' },
            { t: 'table',
              head: ['Phase', 'What is happening', 'What to expect'],
              rows: [
                ['Days 1-30', 'First count, actual pour cost, prime cost baseline, void and comp data pulled', 'No results yet. This is measurement, not correction.'],
                ['Days 30-60', 'Pour cost moving, variance report running, shift audits and delivery audits active', '1 to 3 points of pour cost improvement is typical'],
                ['Days 60-90', 'Recipe costs built, food cost lower, vendor credits received, prime cost trending down', 'Full system impact starts showing in the P&L'],
                ['Day 90+', 'Every system running, weekly prime cost review standard', 'Your real annual recovery rate is established']
              ],
              note: 'The most common place it breaks is days 30 to 45, when the first discipline fades and a busy week knocks the count off schedule. Bar Cop tracks whether each system is still running and tells you the moment one starts slipping, so it restarts before the habit dies.' }
          ]
        },
        {
          id: 'diagnostic', nav: 'Profit Diagnostic', eyebrow: 'Profit diagnostic',
          title: 'How Controlled Are You Right Now?',
          blocks: [
            { t: 'lead', text: 'Ten questions. Yes or no, no partial credit. If the answer is kind of, or we used to, or I need to check, that is a No. The system is either running this week or it is not.' },
            { t: 'p', text: 'Most operators know last Saturday sales to the dollar. Ask for last week pour cost and the room goes quiet. Ask for last month prime cost and the subject changes. That gap is where this diagnostic lives. The monthly figure next to each No is an illustrative example of what that gap commonly costs, not your number.' },
            { t: 'diag', items: [
              { n: 1, cost: '$1,200', q: 'Do you know your actual pour cost from last week, not last month, last week?',
                yes: 'You are managing in real time. A problem that starts Tuesday shows in your data by Monday, before it compounds.',
                no: 'You are running a 30-day lag on one of your most volatile cost lines. A bartender who starts over-pouring on the third costs you 27 days of undetected loss before you ever see a number.' },
              { n: 2, cost: '$900', q: 'Can you say right now which product is running the highest variance, by SKU, in ounces?',
                yes: 'A blended number tells you the house is on fire. The SKU-level report tells you which room, and who was behind the bar when it happened.',
                no: 'You are guessing. Spirits at 31 percent while your blended number reads 24 is invisible until you pull it apart by category. By then the margin is gone.' },
              { n: 3, cost: '$1,400', q: 'Does every bartender use a jigger on every pour, every shift, with a signed policy to prove it?',
                yes: 'Your pour standard is documented and on file. When the corrective conversation comes, your documentation predates it.',
                no: 'Every pour is a personal judgment call. At 250 cocktails a night and a third of an ounce average overage, that is about 21,000 a year down the drain because nobody wrote the rule down.' },
              { n: 4, cost: '$600', q: 'Did you check your last three deliveries line by line against the order before you paid?',
                yes: 'You caught the overcharges, the premium-rate substitutions, and the short counts before they became sunk costs.',
                no: 'You are paying whatever the invoice says. Price drift, substitutions, and short counts are common. The money is gone the moment you sign without checking.' },
              { n: 5, cost: '$800', q: 'What was your prime cost last week, COGS plus labor as a percent of net sales?',
                yes: 'You are managing with your most important number current. You know whether the machine is working, and you can act this week instead of reacting next month.',
                no: 'You are flying without instruments. The room is busy and you have no idea whether last week made money or gave it away. Prime cost is the one number that tells the truth about the whole operation.' },
              { n: 6, cost: '$1,100', q: 'Do you have a cost on every menu item, ingredient level, at current prices, right now?',
                yes: 'Your food cost has a floor. Every dish has a documented minimum, a target margin, and a price set by math. When a supplier raises prices you see exactly which items are hit.',
                no: 'Your pricing is based on feel or what the last owner charged. Without costs you do not know which items make money and which you are giving away.' },
              { n: 7, cost: '$1,500', q: 'Do you see every void, comp, and no-sale by employee, every day, before the next shift?',
                yes: 'You have daily visibility into every transaction exception. A bartender running three times the comp rate of the staff is visible by Wednesday, not at month-end.',
                no: 'Theft and comp abuse stay invisible until the loss is big enough to notice, which usually means three to six months running. Your POS records every void. If you are not reading it daily by employee, you are ignoring data you already have.' },
              { n: 8, cost: '$700', q: 'Did you physically count your entire bar, every bottle, every location, in the last two weeks?',
                yes: 'Your data is two weeks old at most. You can run a meaningful variance cycle, so problems show before they compound.',
                no: 'Monthly counting gives every problem a 30-day head start. A new hire, a volume swing, a bartender who finds out the back bar is not counted: a lot of money can leave before a monthly counter sees it.' },
              { n: 9, cost: '$500', q: 'Have you sat down with each vendor in the last 90 days with your invoice history and a competitor price sheet?',
                yes: 'Your vendors know you are watching, and that alone keeps pricing honest. Show up with a competitor price 8 percent lower on a high-volume SKU and you get a real conversation.',
                no: 'The vendor sets the price and you pay it. Quarterly reviews with documented history consistently find 2 to 4 percent recoverable. On 400,000 in purchasing that is 8,000 to 16,000 a year left on the table.' },
              { n: 10, cost: '$400', q: 'Do you have a written 30-day plan, with tasks, owners, and deadlines, on your desk right now?',
                yes: 'You are not relying on motivation. Tasks have names and dates. The system runs because the plan is written, not because someone feels like running it.',
                no: 'The plan lives in your head, which means it dies the first busy Friday and gets pushed to next week. It is always next week. Write it, assign it, date it. That is the whole difference between a bar that implements and one that intends to.' }
            ] },
            { t: 'diagscore' },
            { t: 'box', tone: 'steel', label: 'Five things that are true about every bar', items: [
              'Your POS does not catch theft. It records it.',
              'A bartender who free-pours is not a bad employee, they are an untrained one in an uncontrolled system.',
              'Every vendor assumes you are not checking the invoice, and most of the time they are right.',
              'Prime cost is the only number that tells you if the whole machine is working. Every other metric is a piece of it.',
              'The bar that controls its costs is not the most popular on the block. It is the one still open in year five.'
            ] }
          ]
        },
        {
          id: 'what', nav: 'What Bar Cop Does', eyebrow: 'What Bar Cop does for you',
          title: 'Every Leak: Captured, Measured, Fixed',
          blocks: [
            { t: 'lead', text: 'The old way was a folder full of spreadsheets you had to keep alive by hand, disconnected from each other and abandoned by week three. Bar Cop runs the whole thing for you. You capture the work in your Control sections, Bar Cop diagnoses where the money is leaking, and the Fix System walks you into the exact screen that closes it.' },
            { t: 'p', text: 'Here is the map. Every leak, where you capture it, where Bar Cop shows it to you, and where you fix it. Tap any Fix button to jump straight there.' },
            { t: 'cross', rows: [
              { leak: 'Pour cost', capture: 'Take Inventory weekly count + product costs in Inventory', show: 'Profit dashboard pour cost + Variance Report', fixLabel: 'Pour Cost system', screen: 'profit-fix', focus: 'pour-cost' },
              { leak: 'Theft and loss', capture: 'Void and Comp Log, Cash Control, and spot checks in Shift', show: 'Loss Prevention', fixLabel: 'Theft and Loss system', screen: 'profit-fix', focus: 'theft-loss' },
              { leak: 'Food cost', capture: 'Menu Items recipes, food counts, Waste and Spill Log', show: 'Recipe Summary + Profit dashboard food cost', fixLabel: 'Food Cost system', screen: 'profit-fix', focus: 'food-cost' },
              { leak: 'Vendor control', capture: 'Receive Delivery checked against the order', show: 'Vendor Tracker', fixLabel: 'Vendor Control system', screen: 'profit-fix', focus: 'vendor-control' },
              { leak: 'Prime cost', capture: 'This Week rolls up COGS and labor for you', show: 'This Week + Profit Audit + the Hub', fixLabel: 'Prime Cost system', screen: 'profit-fix', focus: 'prime-cost' }
            ] },
            { t: 'p', text: 'The paper a system still needs lives inside it too. The signable pour standards policy, the theft and loss policy, the corrective action template, the portion audit, and the vendor terms checklist all download right from the step that calls for them in your Profit Fix System.' },
            { t: 'p', text: 'And you do not read the numbers alone. Bar Cop Briefing writes a plain-language narrative on every audit and reads your trend on the Profit dashboard, so the story behind the numbers is already written for you.' }
          ]
        },
        {
          id: 'benchmarks', nav: 'Benchmarks', eyebrow: 'Benchmarks',
          title: 'The Numbers to Run Against',
          blocks: [
            { t: 'p', text: 'These are your reference points. Bar Cop measures against them for you every week, but know them cold. Find your category, know your target, and know the line where a number turns into a problem.' },
            { t: 'h', text: 'Pour Cost by Category' },
            { t: 'table',
              head: ['Category', 'Target', 'High warning', 'Critical', 'Most common cause'],
              rows: [
                ['Spirits', '18-24%', '25-28%', '29%+', 'Free-pouring, over-portion, unrecorded comps, product going home'],
                ['Draft beer', '20-26%', '27-30%', '31%+', 'Line waste, improper fill height, keg yield miscalculation'],
                ['Bottled beer', '22-28%', '29-32%', '33%+', 'Pricing gaps, breakage, cooler shrinkage'],
                ['Wine', '28-34%', '35-38%', '39%+', 'Over-pour at table, bottle waste, unrecorded by-the-glass'],
                ['NA beverages', '15-22%', '23-26%', '27%+', 'Pricing gaps, shrinkage at service stations'],
                ['Blended bar', '20-26%', '27-30%', '31%+', 'Run the category breakdown if blended is above target']
              ] },
            { t: 'h', text: 'Food Cost by Category' },
            { t: 'table',
              head: ['Category', 'Target', 'High warning', 'Critical', 'Most common cause'],
              rows: [
                ['Proteins', '28-34%', '35-38%', '39%+', 'Yield loss not accounted for, over-portioning, no cost cards'],
                ['Produce', '22-28%', '29-32%', '33%+', 'Over-prep, spoilage, no prep schedule discipline'],
                ['Dairy and eggs', '18-24%', '25-28%', '29%+', 'Portion drift on sauces, butter, cream'],
                ['Dry goods', '15-22%', '23-26%', '27%+', 'Menu pricing gaps, no cost cards on composed items'],
                ['Bar food', '24-30%', '31-34%', '35%+', 'No recipe cards, fry waste, over-portion on apps'],
                ['Blended food', '28-34%', '35-38%', '39%+', 'Run the category breakdown if blended is above target']
              ] },
            { t: 'h', text: 'Prime Cost by Concept Type' },
            { t: 'table',
              head: ['Concept type', 'Target', 'High warning', 'Critical', 'Common driver'],
              rows: [
                ['Bar-heavy concept', '48-55%', '56-60%', '61%+', 'Labor or pour cost above benchmark'],
                ['Full-service bar / restaurant', '55-60%', '61-65%', '66%+', 'Food cost or labor scheduling problem'],
                ['Fast casual', '55-62%', '63-67%', '68%+', 'Labor model or food cost above target'],
                ['High-volume nightlife', '42-50%', '51-56%', '57%+', 'Pour cost or excessive late-night staffing'],
                ['Craft cocktail bar', '50-58%', '59-63%', '64%+', 'Premium product cost without matching pricing']
              ] },
            { t: 'h', text: 'Void, Comp, and Variance Red Flags' },
            { t: 'table',
              head: ['Metric', 'Normal', 'High warning', 'Red flag', 'What to do'],
              rows: [
                ['Total void rate (all staff)', 'Under 1.5%', 'Above 2.5%', 'Above 4%', 'Pull by employee. Look for clustering by shift or time of night.'],
                ['Individual bartender void rate', 'Under 1%', 'Above 2%', 'Above 4%', 'Investigate the shift pattern. Compare to their sales volume.'],
                ['Total comp rate (all staff)', '1-2%', 'Above 3%', 'Above 5%', 'Pull comp dollars by server in Sales Integrity. One server far above the floor is the tell.'],
                ['Cash drawer variance per shift', 'Under $5', '$10-$20', '$25+ recurring', 'Log the direction. Recurring same direction means investigate.'],
                ['Pour cost variance by SKU', 'Under 3%', '3-5%', 'Above 5%', 'Pull opening and closing counts for that SKU. Check shift records.'],
                ['Prime cost week over week', 'Under 1 pt', '2-3 pts up', '4+ pts up', 'Separate COGS from labor. Three weeks trending up is structural.']
              ] }
          ]
        },
        {
          id: 'connect', nav: 'How It Connects', eyebrow: 'How the systems connect',
          title: 'Six Systems, One Profit Machine',
          blocks: [
            { t: 'p', text: 'These are not independent fixes. Fix your pour cost and watch food cost drift up. Stop a theft problem and miss the vendor overcharges on every delivery. Get prime cost right for one quarter and lose it the next because nothing was written down and the manager who built it left. Cost control fails when it is treated as separate problems instead of one connected machine.' },
            { t: 'p', text: 'The six systems are sequenced on purpose. Pour cost comes first because it is the foundation, you cannot get a real prime cost without a real COGS number, and you cannot get COGS without a weekly count. Each system feeds the next.' },
            { t: 'parts', items: [
              { label: 'System 1', name: 'Pour Cost', desc: 'Sets the baseline every other number depends on. Start here.', focus: 'pour-cost' },
              { label: 'System 2', name: 'Theft and Loss', desc: 'Variance that over-pouring cannot explain is usually theft.', focus: 'theft-loss' },
              { label: 'System 3', name: 'Food Cost', desc: 'Recipe costs, waste, and portion discipline. The food side of COGS.', focus: 'food-cost' },
              { label: 'System 4', name: 'Vendor Control', desc: 'Vendor prices flow into recipe costs. Audit every delivery before you pay.', focus: 'vendor-control' },
              { label: 'System 5', name: 'Prime Cost', desc: 'COGS plus labor as a percent of net sales. The one number that tells all.', focus: 'prime-cost' },
              { label: 'System 6', name: 'Keep It Running', desc: 'Bar Cop tracks whether each system is still running and flags the moment one slips.', focus: 'prime-cost' }
            ] },
            { t: 'box', tone: 'gold', label: 'The logic in plain language', text: 'Pour cost variance contains your theft number, you cannot separate them without the variance report. Vendor prices flow into recipe costs the day an invoice changes, so food cost is wrong the day after a price increase you did not catch. Prime cost is the sum of everything: if it is high, one of the first four systems is broken. Start with pour cost. Every other number is downstream of the count and the pour cost calculation. Get that right first and the rest follows.' },
            { t: 'go', label: 'Profit Fix System', screen: 'profit-fix', focus: 'pour-cost' }
          ]
        },
        {
          id: 'p1', nav: 'System 1: Pour Cost', eyebrow: 'System 1 - the biggest recoverable number',
          title: 'Pour Cost Control',
          blocks: [
            { t: 'lead', text: 'A bar in Nashville, 180 seats, sports concept, about 900,000 a year in beverage. Open four years, never a real count. The owner figured pour cost was around 23 percent. We counted everything and ran it: actual pour cost 34 percent. On 900,000 in bar sales that gap is 99,000 a year. Not stolen, not fraud. Just never counted.' },
            { t: 'p', text: 'Your POS is a sales tool. It records what was rung. It does not know the bartender poured 2.1 ounces into a 1.5 ounce drink, or the comp that went out without a signature, or the bottle that left in a bag. Pour cost is an operations tool, and you cannot run one without the other. Most bars with no system run 6 to 12 points above where they should be.' },
            { t: 'p', text: 'A 0.3 ounce average overage sounds like nothing. On a well spirit it is about 27 cents a drink. At 250 drinks a night, 300 nights a year, that is roughly 20,000 a year from over-pouring alone, and that is the conservative version. It is not malice. A bartender in the weeds at 10pm is thinking about the eight tickets on the rail, not the extra quarter ounce. The problem is a system that lets accuracy depend on attention during the busiest hour of the night.' },
            { t: 'h', text: 'How a variance turns into a name' },
            { t: 'p', text: 'Pour cost has one job: measure the gap between what you spent on product and what you collected. Inside that gap is over-pouring, waste, theft, and unrecorded comps. A blended number tells you the house is on fire. The SKU-level variance tells you which room, which shift, and who was behind the bar. The work is to pull the flagged SKU, check its counts and shift records against POS sales, and close every investigation with a written finding, even an inconclusive one.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You count in Take Inventory. The moment it saves, your real pour cost by category reads on the Profit dashboard, no formula to build. The Variance Report flags the SKUs over target so you know exactly where to look, and This Week carries the blended cost into your weekly P&L. The Pour Cost system in your Profit Fix walks each step and tracks whether it is actually happening.' },
            { t: 'go', label: 'Take Inventory', screen: 'ic-take-inventory' },
            { t: 'go', label: 'Pour Cost system', screen: 'profit-fix', focus: 'pour-cost' },
            { t: 'h', text: 'Quick Reference: every week' },
            { t: 'list', items: [
              'Run the full bar count in Take Inventory. Every week, without exception.',
              'Read pour cost by category on the Profit dashboard the moment the count saves.',
              'Open the Variance Report and flag any SKU over 3 percent.',
              'Investigate every flag within 48 hours: pull its counts, check the shift records, confirm POS sales.',
              'Confirm opening and closing counts were done every shift.',
              'If a SKU stays unexplained after that, it moves to Loss Prevention (theft).'
            ] },
            { t: 'docs', items: [
              { file: 'Measured_Pour_Standards_Policy.docx', label: 'Measured Pour Standards Policy' },
              { file: 'Bar_Inventory_Procedures_Manual.docx', label: 'Bar Inventory Procedures Manual' }
            ] }
          ]
        },
        {
          id: 'p2', nav: 'System 2: Theft and Loss', eyebrow: 'System 2 - the quiet leak',
          title: 'Theft and Loss Prevention',
          blocks: [
            { t: 'lead', text: 'A manager pulls the void report for the first time in eight months. One bartender is running four times the comp rate of everyone else, always Friday nights, always after 11pm, always on spirits, always when the floor is busy. She is not malicious. She is building regulars. But the bar is absorbing the cost and nobody was watching. Eight months of Friday nights.' },
            { t: 'p', text: 'Theft in bars is rarely dramatic. It looks like a void at 11:47pm on a busy Saturday. A comp that never got a signature. A delivery two cases short that nobody counted. Each one is small enough to rationalize. Together they are the difference between a bar that makes money and one that cannot figure out where it went. Your POS records theft. It does not catch it.' },
            { t: 'p', text: 'Run the math on one bartender voiding six 18 dollar transactions a shift, three shifts a week: about 16,000 a year, from one person, on one method, invisible without a report that breaks voids out by employee. The no-ring scheme is simpler and harder to catch: cash in, drink out, nothing rung, drawer comes up over, the overage gets pulled before the count. The comp game is legal on its face, which is what makes it expensive: the bar pays for a relationship the bartender is using to build their own following.' },
            { t: 'p', text: 'The shift audit is not mainly a detection tool, it is a behavior tool. Audit every Tuesday at 3pm and you have trained the staff to behave on Tuesdays at 3pm. Audit twice a week at times nobody can predict and you have a real deterrent: everybody knows it happens, nobody knows when, and that uncertainty changes behavior on every shift.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You log every void, comp, and no-sale in the Void and Comp Log. Sales Integrity reads your POS server sales report and benchmarks every server against the floor, so one running off on no-sales, voids, or cash mix surfaces by Wednesday. Cash Control reconciles every drawer and tracks overages as hard as shortages. Spot checks and Receive Delivery close the product and short-count holes, and Loss Prevention is where a flagged server or an unexplained pour-cost variance opens an investigation.' },
            { t: 'go', label: 'Void and Comp Log', screen: 'sc-void-comp' },
            { t: 'go', label: 'Sales Integrity', screen: 'sales-integrity' },
            { t: 'go', label: 'Loss Prevention', screen: 'theft-risk' },
            { t: 'go', label: 'Theft and Loss system', screen: 'profit-fix', focus: 'theft-loss' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Every day: reconcile every drawer in Cash Control before it leaves the floor, and log every void, comp, and no-sale by employee.',
              'Every day: confirm the delivery inspection was done on anything received.',
              'Every week: run a Sales Integrity review on your server sales report. Flag any server running off the floor.',
              'Every week: review drawer history. Flag anyone with recurring same-direction variance.',
              'Every week: run a shift audit at least twice, different shifts, different times. Document what you saw in writing.',
              'Escalate: one incident, document and watch. Two in 30 days on the same person, written corrective action. Confirmed cash theft, document fully and talk to your attorney before the conversation.'
            ] },
            { t: 'docs', items: [
              { file: 'Theft_Loss_Prevention_Policy.docx', label: 'Theft and Loss Prevention Policy' },
              { file: 'Employee_Corrective_Action_Template.docx', label: 'Employee Corrective Action Template' }
            ] }
          ]
        },
        {
          id: 'p3', nav: 'System 3: Food Cost', eyebrow: 'System 3 - the other half of COGS',
          title: 'Food Cost Control',
          blocks: [
            { t: 'lead', text: 'A chef builds a beautiful menu. Creative, seasonal, priced against the competition. He never costs a single item. Eight months in, the owner pulls food cost: 42 percent. The menu is popular, the room is full most nights, and the restaurant loses money on every plate it sells. The food was not the problem. The math was, and the math was never done.' },
            { t: 'p', text: 'A chef who cannot tell you the cost of a dish to the penny is running your kitchen on feel, and feel runs 30,000 to 50,000 a year on 500,000 in food sales. The fix is three documents: a cost on every menu item, a portion standard posted at every station, and a waste log filled out every shift. That is the whole system.' },
            { t: 'p', text: 'What you pay per pound at delivery and what you actually use per pound are two different numbers. A tenderloin bought at 18 dollars a pound with 70 percent usable yield after trim truly costs 25.71 a pound. Cost your cards against purchase price instead of yield and every protein item is understated. Build your costs on the highest-volume items first: a 4 dollar over-cost on a bestseller running 200 covers a week is over 40,000 a year.' },
            { t: 'p', text: 'Portion drift is not theft, it is eyes. Cooks plate by eye and eyes vary cook to cook and hour to hour. A 1.5 ounce average overage on your top protein at 200 covers can run 40,000 a year on one item. And a waste entry without a reason code is just a count. With reason codes (over-production, spoilage, prep error, return, quality) it is a diagnosis you can act on.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You build recipes on Menu Items and they cost out automatically off your product prices, yield included. Take Inventory food counts feed your real food cost to the Profit dashboard and This Week. The Waste and Spill Log captures waste with reason codes. Recipe Summary shows every item priced below its floor so you can move a price or change a recipe.' },
            { t: 'go', label: 'Menu Items', screen: 'r-menu-items' },
            { t: 'go', label: 'Recipe Summary', screen: 'recipe-cost-analysis' },
            { t: 'go', label: 'Food Cost system', screen: 'profit-fix', focus: 'food-cost' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Review the waste log weekly: top three categories by dollar, one action each, with the kitchen manager.',
              'Run a portion audit on at least two stations: weigh five plates each against the posted spec.',
              'Update recipe costs for any ingredient whose price moved.',
              'Confirm reason codes are being used on every waste entry.',
              'Cost every special before service, not after.',
              'Targets are in the Benchmarks section. Run the category breakdown the moment blended food cost is above target.'
            ] },
            { t: 'docs', items: [
              { file: 'Daily_Food_Waste_Tracking.pdf', label: 'Daily Food Waste Sheet' },
              { file: 'Portion_Control_Audit.pdf', label: 'Portion Control Audit' },
              { file: 'Food_Handling_Portion_Standards.docx', label: 'Food Handling and Portion Standards' }
            ] }
          ]
        },
        {
          id: 'p4', nav: 'System 4: Vendor Control', eyebrow: 'System 4 - the leak nobody audits',
          title: 'Vendor Control',
          blocks: [
            { t: 'lead', text: 'An owner audits six months of invoices on a slow Tuesday with nothing else to do. She lays her orders against the invoices and checks line by line. By the time she finishes three vendors she has found 11,400 in overcharges. Not fraud. Price drift, substitutions billed at premium, and one delivery that came up a case short every week for four months. She had been signing without checking a single line.' },
            { t: 'p', text: 'Vendor overcharging is the quietest loss in the business. It does not spike and it does not flag in your POS. It accumulates one invoice at a time. Vendors do not volunteer their best price to a customer who never asks. That is not malice, it is rational behavior, and it costs you until you start checking.' },
            { t: 'p', text: 'Short counts are the clearest example. The conversation is over the moment the driver leaves. You cannot call two days later and say you think a case was missing. Your only advantage is the count you did at the door before you signed. A verbal complaint is a story. A written discrepancy with the invoice number, date, ordered and received quantity, and the dollar gap is a credit request, and vendors process credit requests.' },
            { t: 'p', text: 'Small drift compounds. A 1 liter spirit that creeps from 22.40 to 24.50 over a quarter at 18 bottles a week is a couple hundred dollars on that one SKU alone, and you usually have twenty. The quarterly review is where you get it back: sit down with the rep with your variance history and a competitor price sheet, and ask for a match or an explanation. Show up with data and the conversation changes.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Receive Delivery is the door: you check the invoice against the order line by line and flag anything over your price before you sign. Vendor Tracker keeps the cumulative variance by vendor, surfaces the items that drifted, files discrepancies, and builds the scorecard you bring to the quarterly review.' },
            { t: 'go', label: 'Receive Delivery', screen: 'ic-receive-delivery' },
            { t: 'go', label: 'Vendor Tracker', screen: 'vendor-tracker' },
            { t: 'go', label: 'Vendor Control system', screen: 'profit-fix', focus: 'vendor-control' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Every delivery: pull the order before the truck arrives. Know what you ordered and at what price.',
              'Every delivery: count every case before you sign. Short counts not caught at the door are not recovered.',
              'Every delivery: check the invoice against the order in Receive Delivery. Flag anything over 2 percent above your price.',
              'File a discrepancy the moment you find one, while the driver is still there.',
              'Monthly: review your top spend items in Vendor Tracker. Flag anything up over 5 percent, or where another vendor is 8 percent cheaper.',
              'Quarterly: sit down with each rep with your variance history and competitor pricing. Ask for a match or an explanation. Confirm terms in writing after.'
            ] },
            { t: 'docs', items: [
              { file: 'Vendor_Agreement_Terms_Checklist.docx', label: 'Vendor Agreement Terms Checklist' },
              { file: 'Vendor_Delivery_Inspection.pdf', label: 'Vendor Delivery Inspection' },
              { file: 'Vendor_Delivery_Discrepancy.pdf', label: 'Vendor Discrepancy Report' }
            ] }
          ]
        },
        {
          id: 'p5', nav: 'System 5: Prime Cost', eyebrow: 'System 5 - the one number that tells all',
          title: 'Prime Cost',
          blocks: [
            { t: 'lead', text: 'An owner has been open three years. The room is full most nights, sales up 18 percent over last year. An accountant asks him his prime cost. He does not know what that means. She works it from six months of P&Ls: 71 percent. He has run a full bar and a busy kitchen for three years keeping less than 29 cents of every dollar. The room was full. The business was not working.' },
            { t: 'p', text: 'Prime cost, COGS plus labor against net sales, is the gauge that covers the whole operation at once. Every other number in this playbook, pour cost, food cost, vendor savings, theft, lands here. If prime cost is right, the machine is working. If it is wrong, one of the first four systems is broken, and you see it before the P&L says so a month later.' },
            { t: 'p', text: 'A monthly number tells you what happened. A weekly number gives you time to do something about it. A 5 point spike on 300,000 in monthly sales is 15,000, gone before you see it if you wait for the accountant. Catch it Monday of week three and you cap the damage at seven days instead of thirty.' },
            { t: 'p', text: 'Two traps. First, labor is not just the wages you paid, it is wages plus payroll taxes plus benefits plus any owner time on the floor. Run prime against wages only and you understate labor 10 to 15 percent and flatter the number. Second, when prime jumps, run the split test: did COGS move more or did labor move more. The bigger mover is your driver. A one-week bump with a reason can wait a week. Three weeks trending up is structural.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'This Week rolls your COGS and labor into prime cost for you every week, after comps and discounts, the way it should be calculated. The Profit dashboard trends it, the Profit Audit and the Hub confirm it, and the Weekly P&L Brief and Month-End Books carry it cleanly to your accountant.' },
            { t: 'go', label: 'This Week', screen: 'this-week' },
            { t: 'go', label: 'Prime Cost system', screen: 'profit-fix', focus: 'prime-cost' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Read prime cost in This Week every Monday on last week numbers.',
              'If it is above target, find whether COGS or labor moved more. That is your driver.',
              'If COGS: which category. If labor: which shifts or department.',
              'Act this week. One week with a reason can wait. Three weeks up is structural.',
              'Net sales means after comps and discounts, never register totals.',
              'Targets by concept type are in the Benchmarks section.'
            ] },
            { t: 'docs', items: [
              { file: 'Weekly_PL_Snapshot.pdf', label: 'Weekly P&L Snapshot' },
              { file: 'Monthly_Cost_Control_Review_Agenda.docx', label: 'Monthly Cost Control Review Agenda' }
            ] }
          ]
        },
        {
          id: 'p6', nav: 'System 6: Keep It Running', eyebrow: 'System 6 - make it survive a busy Friday',
          title: 'Putting It In Place and Keeping It Running',
          blocks: [
            { t: 'lead', text: 'An owner buys three cost control books over two years. She starts all three and finishes none. The first week of each feels productive. By week three service gets busy, a manager calls in sick, and the spreadsheet sits unopened. Three years later she still does not know her pour cost. The problem was never the system. It was the absence of a sequenced plan with owners, deadlines, and one number to confirm it is working. Motivation fades in about ten days. Process does not.' },
            { t: 'p', text: 'Most efforts fail at the 45-day mark, not week one. A daily log stops getting filled. A Friday audit gets skipped twice. The invoice audit falls two weeks behind. None of it feels like failure, each feels like a one-time exception. A system that only runs when you are running it is a personal habit, and personal habits do not survive a vacation, an illness, or a volume spike. The fix is a sequence with names and dates on it.' },
            { t: 'h', text: 'The first four weeks' },
            { t: 'table', nowrap1: true,
              head: ['Week', 'Focus', 'What goes live'],
              rows: [
                ['Week 1', 'Establish baselines', 'Run your first count, read your real pour cost, food cost, and prime cost. Change nothing. Know the numbers.'],
                ['Week 2', 'Install the counting', 'Opening and closing counts every shift, daily voids and comps, drawer reconciliation, delivery checks. Count again.'],
                ['Week 3', 'Install the standards', 'Sign the pour policy, post portion specs, hold the accountability talk, start recipe costs on your top items, run your first shift audit.'],
                ['Week 4', 'Full run', 'Every system at once: count, pour and food cost, variance, prime cost, voids by employee, delivery audits, waste review.']
              ],
              note: 'Week 3 feels uncomfortable the first time you tell experienced bartenders to use a jigger or post specs in a kitchen that has run on feel for years. Do it anyway. Professional, direct, not apologetic. This is how the bar runs now.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You do not track any of this on paper. The moment you do the first real step in Control, your Profit Fix System logs that day and measures from there. It reads your live data and tells you which systems are running and which are slipping, so the 45-day fade shows up as a status you can see, not a surprise on next month P&L. Your setup checklist lives in Getting Started.' },
            { t: 'go', label: 'Profit Fix System', screen: 'profit-fix', focus: 'pour-cost' },
            { t: 'docs', items: [
              { file: '90Day_Cost_Control_Roadmap.docx', label: '90-Day Cost Control Roadmap' },
              { file: 'Monthly_Cost_Control_Review_Agenda.docx', label: 'Monthly Cost Control Review Agenda' }
            ] }
          ]
        },
        {
          id: 'close', nav: 'Start Tonight', eyebrow: 'Start tonight',
          title: 'The Numbers Do Not Lie',
          blocks: [
            { t: 'lead', text: 'A full-service bar in Cincinnati, about 1.1 million a year. The owner ran the whole system: weekly pour cost, a variance report every Monday, daily counts, void tracking, an invoice audit on every delivery, prime cost pulled before she looked at anything else. After 90 days she sat down with her accountant. Pour cost down 4.2 points. Food cost down 3.1. Two vendor disputes recovered 2,300 in the first six weeks. Prime cost 57 percent, under 60 for the first time in three years. She added no new revenue. She stopped losing the revenue she was already bringing in.' },
            { t: 'p', text: 'What separates bars that make money from bars that wonder where it went is not location, concept, or talent behind the bar. It is measurement and process. The tools are not complicated and the math is not advanced. What it takes is showing up Monday and pulling the number whether or not you feel like it. The week it feels least urgent is almost always the week something is quietly going wrong.' },
            { t: 'box', tone: 'gold', label: 'Do these tonight', text: 'Open Take Inventory and schedule your first count. Read your prime cost in This Week. Pull your last month of voids and comps in the Void and Comp Log. Then open your Profit Fix System and do the first step, so Bar Cop logs the day and starts measuring what you win back.' },
            { t: 'p', text: 'The gap between what you are making and what you should be making is not a mystery. It is a measurement problem. Start measuring tonight.' },
            { t: 'go', label: 'Profit Fix System', screen: 'profit-fix', focus: 'pour-cost' }
          ]
        }
      ]
    },

    revenue: {
      label: 'Revenue',
      intro: 'The strategic read behind your Revenue Fix System. The Fix screens tell you what to do this week. This is the why behind it: where the top line leaks, what each gap quietly costs, and the exact Bar Cop screen that captures, measures, and closes it. No spreadsheets, no formulas. Bar Cop does that math now.',
      sections: [
        {
          id: 'worth', nav: 'What It Costs You', eyebrow: 'What you are leaving on the table',
          title: 'The Revenue Walking Out the Door',
          blocks: [
            { t: 'lead', text: 'You track revenue obsessively. You know last Saturday to the dollar, against last week, last year, and your gut for the room. What almost never gets calculated is the gap between what you took in and what you were set up to take in. That gap lives in servers who take orders instead of sell, a menu priced on instinct, an event room nobody owns, and a schedule built from memory. None of it shows up as a line on the P&L. It just shows up as a revenue number that never quite gets where it should.' },
            { t: 'p', text: 'A bar running without revenue systems leaves roughly 8 to 15 percent of its potential on the table. On 750,000 a year that is 60,000 to 110,000. From the building you already have, the guests already at your tables. It is recoverable, and pulling it back is the job Bar Cop does.' },
            { t: 'box', tone: 'gold', label: 'The stakes', title: '8 to 15 percent of your revenue never gets captured', text: 'On a million-dollar bar that is 80,000 to 150,000 a year. These are illustrative ranges for a bar with no menu engineering, no pricing discipline, a floor selling on instinct, and a schedule built from habit. Your real number is whatever Bar Cop measures once you start.' },
            { t: 'h', text: 'The Four Gaps Running at Once' },
            { t: 'p', text: 'Sit down with a busy bar that is not growing and the same four gaps are running together. Each one alone leaks. All four together is why the room is full and the number still will not move.' },
            { t: 'table',
              head: ['The gap', 'What it looks like', 'Illustrative cost'],
              rows: [
                ['Menu mix', 'Items in the wrong positions, prices nobody has reviewed in two years, your best margin item buried.', 'A few points of margin on every cover.'],
                ['Floor selling', 'Half the servers sell, half take orders, and nobody knows which is which.', 'A $3 to $8 check-average spread across the floor.'],
                ['Events', 'An event room booking four a month when it should book twelve, priced like a favor.', 'The highest-margin revenue in the building, left on the table.'],
                ['Schedule by habit', 'Built like last week, with nothing to do with the revenue it has to support.', '2 to 4 points of labor on slow shifts.']
              ] },
            { t: 'h', text: 'Check Average: The Fastest Lever' },
            { t: 'p', text: 'Check average is the fastest revenue lever in the building. No new customers, no bigger room. The guests already at your tables spending 3 to 5 dollars more a visit. At 200 covers a day over 300 service days, a 3 dollar lift is 180,000 a year. Same guests, same room, a different conversation at the table.' },
            { t: 'table',
              head: ['Covers a day', '+$3 a cover', '+$4 a cover', '+$5 a cover'],
              rows: [
                ['100', '$90,000 / yr', '$120,000 / yr', '$150,000 / yr'],
                ['150', '$135,000 / yr', '$180,000 / yr', '$225,000 / yr'],
                ['200', '$180,000 / yr', '$240,000 / yr', '$300,000 / yr'],
                ['300', '$270,000 / yr', '$360,000 / yr', '$450,000 / yr']
              ],
              note: 'Illustrative example over 300 service days. Find your cover count. This is from the same guests already in the room.' },
            { t: 'h', text: 'What 90 Days Looks Like' },
            { t: 'p', text: 'A worked example, not a promise. A full-service bar and kitchen at about 1.2 million. The owner figures her check average is around 30. Pull three weeks by server and it is 31.40, with three servers under 26 and two over 38. The menu has never been run for margin. Labor sits at 26 percent against a 21 target. The event room books four a month. Here is the arc the first 90 days tends to follow.' },
            { t: 'table',
              head: ['Metric', 'Where it stood', 'The gap'],
              rows: [
                ['Check average', 'Never measured', 'A $17 spread between the best and worst server, unseen'],
                ['Menu', 'No process', '14 items in the wrong position or priced below margin'],
                ['Labor', '26%', '5 points above target, schedule built from memory'],
                ['Events', '4 a month', 'Inquiries answered in 38 hours, handled like favors']
              ],
              note: 'Day 1 is always the same. The gap is bigger than expected. That is not a problem with the bar. It is the first accurate picture it has had of itself.' },
            { t: 'p', text: 'Week two: a pre-shift briefing starts before every service with a check-average target and two featured items. The first menu pass repositions three high-margin items and flags the below-floor prices. Week six: check average is climbing, one server is cut off a dead Thursday, the event room has a rate card and a two-hour response standard. Day 90: check average up 3.80, floor labor down to 22 percent, nine events booked in the month against four. Annual impact off the run rate, about 147,000 captured. Same room, same staff, no new customers. A different set of systems running every week.' },
            { t: 'box', tone: 'steel', title: 'The revenue is already in your building', text: 'You do not need more customers. You need the ones you have to spend more, stay longer, and book the room. The only question is whether something captures it every shift. That is the whole job Bar Cop does.' }
          ]
        },
        {
          id: 'timeline', nav: 'The First 90 Days', eyebrow: 'What to expect and when',
          title: 'Recovery Has a Timeline',
          blocks: [
            { t: 'p', text: 'The first 30 days are about baselines, not results. You track check average by server for the first time and find a spread you did not know was there. You run the menu for margin and see which items carry the others. You pull labor by department and find the floor a few points over. No revenue results yet. This is measurement.' },
            { t: 'p', text: 'Days 30 to 60 are where the first numbers move. The briefing is running, check average starts climbing within three to four weeks, the schedule gets built from a forecast instead of memory, and the event room starts answering inquiries same day. Days 60 to 90 the systems compound: the server spread closes from coaching, the events pipeline starts producing, and the full impact shows up in the Monday numbers.' },
            { t: 'table',
              head: ['Phase', 'What is happening', 'What to expect'],
              rows: [
                ['Days 1-30', 'Baselines: check average by server, menu by margin, labor by department', 'No results yet. This is measurement, not correction.'],
                ['Days 30-60', 'Briefing live, schedule built from forecast, events answered same day', 'Check average trending up within 3 to 4 weeks'],
                ['Days 60-90', 'Server spread closing, events pipeline producing, pricing corrected', 'Full system impact showing in the weekly numbers'],
                ['Day 90+', 'Every system running, monthly revenue review standard', 'Your real annual improvement is established and compounding']
              ],
              note: 'The most common place it breaks is days 20 to 45, when the briefing gets skipped on a busy night and the Monday review slides to Tuesday. Bar Cop tracks whether each system is still running and flags the moment one starts slipping, so it restarts before the habit dies.' }
          ]
        },
        {
          id: 'diagnostic', nav: 'Revenue Diagnostic', eyebrow: 'Revenue diagnostic',
          title: 'How Much Revenue Are You Capturing?',
          blocks: [
            { t: 'lead', text: 'Ten questions. Yes or no, no partial credit. If it is somewhere between, that is a No. The system is either running this week or it is not.' },
            { t: 'p', text: 'Most operators know their revenue number cold. Ask the average check per cover from last Tuesday and it gets quiet. Ask what floor labor ran as a percent of revenue last week and the subject changes. That gap is where this diagnostic lives. The monthly figure next to each No is an illustrative example of what that gap commonly costs, not your number.' },
            { t: 'diag', items: [
              { n: 1, cost: '$1,200', q: 'Do you know which menu items are your highest-margin contributors, and are those items positioned to sell on your current menu?',
                yes: 'You have a menu engineering process, you review it at least quarterly, and your highest-margin items sit in the positions that sell.',
                no: 'Your layout is based on tradition or what looked good to the designer. High-cost items may be getting promoted over high-margin ones and nobody has done the math to find out.' },
              { n: 2, cost: '$900', q: 'Do you have a written pricing strategy, reviewed at least quarterly against your actual food and beverage costs?',
                yes: 'You have pricing logic tied to real cost data and you review it on a schedule. Prices move by calculation, not by reaction to a bad month.',
                no: 'Prices were set at opening or when costs got painful enough to force a change. Every month you wait, the gap between your price and your cost grows wider.' },
              { n: 3, cost: '$1,400', q: 'Do you calculate labor cost as a percent of revenue by department and review it weekly, not just on the monthly P&L?',
                yes: 'You have weekly labor by bar, kitchen, and floor against target every Monday. A department running over shows up in seven days, not thirty.',
                no: 'You see a blended total on the monthly statement. By the time it shows up there, three to four weeks of over-schedule have already run and cannot be recovered.' },
              { n: 4, cost: '$1,100', q: 'Do you track revenue per labor hour by shift and use that number when you build the schedule?',
                yes: 'Your schedule is built against an RPLH target. You know which shifts produce and which ones cost more than they return.',
                no: 'The schedule looks like last week because that is how schedules get built. No connection to the revenue it has to support. That gap runs every week.' },
              { n: 5, cost: '$800', q: 'Do you track average check per cover by server and by shift and review it weekly?',
                yes: 'You know which servers sell and which take orders, and you act on the difference every week.',
                no: 'You see total sales by server. Your best and worst salespeople look identical in the data you are reviewing now.' },
              { n: 6, cost: '$1,400', q: 'Do your servers follow a documented upsell sequence on every table, with a system that confirms they are doing it?',
                yes: 'You have written upsell sequences, a briefing before every service, and a table audit that confirms execution.',
                no: 'Upselling depends on the server mood and instinct. Some do it, most do not, and you have no way to measure the difference.' },
              { n: 7, cost: '$2,000', q: 'Do you have a private dining or events offer with a written rate card, a minimum spend, and a named person who sells it?',
                yes: 'You have a client-facing package, a rate card, a pipeline, and a follow-up process. The event room is a revenue center with an owner.',
                no: 'Events get booked when someone asks and priced however feels right. Inquiries that could be 3,000 dollar bookings get handled like favors.' },
              { n: 8, cost: '$1,500', q: 'Do you have a written follow-up process for every event inquiry, with a response-time standard and a tracked pipeline?',
                yes: 'Every inquiry gets a fast response and goes in a tracker. You know your close rate and the dollar value of every open inquiry.',
                no: 'Inquiries get answered when someone gets to them. No record of what came in, what was quoted, or what went cold. The typical response time runs well over a day.' },
              { n: 9, cost: '$1,800', q: 'Do you have a catering or off-premise revenue stream with documented pricing, a repeatable process, and a named owner?',
                yes: 'You have a catering menu, a pricing calculator, a delivery checklist, and one person accountable from first contact to final invoice.',
                no: 'Catering happens when someone asks and you figure out the details each time. Pricing is a guess. Execution starts from scratch on every booking.' },
              { n: 10, cost: '$1,000', q: 'Do you run a structured monthly revenue review covering check-average trend, the event pipeline, and server performance?',
                yes: 'You review the components monthly with your team and set specific targets for the next 30 days.',
                no: 'Revenue review means looking at the total and hoping it went up. Without reviewing the parts, you cannot know what is working and what is bleeding.' }
            ] },
            { t: 'diagscore' },
            { t: 'box', tone: 'steel', label: 'Five things that are true about every bar', items: [
              'Your highest-selling item and your most profitable item are not the same item, and most operators cannot say which is which.',
              'At least one server on your floor is taking orders and at least one is selling. Without check average by server you cannot tell them apart.',
              'Your event space is doing a fraction of what it could, not for lack of demand, but because nobody owns the process end to end.',
              'This week you built the schedule the same way you built it three years ago. Your revenue changed. The schedule did not catch up.',
              'The bar that grows revenue is not the busiest on the block. It is the one that knows what it is worth and builds the systems to capture it.'
            ] }
          ]
        },
        {
          id: 'what', nav: 'What Bar Cop Does', eyebrow: 'What Bar Cop does for you',
          title: 'Every Gap: Captured, Measured, Closed',
          blocks: [
            { t: 'lead', text: 'The old way was a folder full of spreadsheets you had to keep alive by hand, abandoned by week three. Bar Cop runs the whole thing for you. You capture the work in your sections, Bar Cop diagnoses where the top line is leaking, and the Fix System walks you into the exact screen that closes it.' },
            { t: 'p', text: 'Here is the map. Every gap, where you capture it, where Bar Cop shows it to you, and where you fix it. Tap any Fix button to jump straight there.' },
            { t: 'cross', rows: [
              { leak: 'Menu mix', capture: 'Menu Items recipes and costs', show: 'Menu Engineering + Dog Test Tracker', fixLabel: 'Menu Engineering system', screen: 'r-fix', focus: 'menu-engineering' },
              { leak: 'Pricing', capture: 'Menu Items costs by ingredient', show: 'Price Calculator + Menu Engineering', fixLabel: 'Pricing system', screen: 'r-fix', focus: 'pricing' },
              { leak: 'Labor cost', capture: 'Build Schedule + Revenue Forecast', show: 'Labor History + Overtime Watch', fixLabel: 'Labor Cost and Scheduling system', screen: 'r-fix', focus: 'labor-scheduling' },
              { leak: 'Labor productivity', capture: 'Build Schedule hours against the week', show: 'This Week revenue per labor hour', fixLabel: 'Labor Productivity system', screen: 'r-fix', focus: 'rplh' },
              { leak: 'Check average', capture: 'Server Check covers and sales', show: 'Server Check scorecard', fixLabel: 'Check Average system', screen: 'r-fix', focus: 'check-average' },
              { leak: 'Server performance', capture: 'Server Check by server', show: 'Server Check scorecard', fixLabel: 'Server Performance system', screen: 'r-fix', focus: 'server-performance' }
            ] },
            { t: 'p', text: 'The paper a system still needs lives inside it too. The upsell standards and scripts, the pre-shift briefing, the table visit audit, the menu engineering review, and the quarterly pricing checklist all download right from the step that calls for them in your Revenue Fix System. Events and catering have their own section, and confirmed bookings feed your week and the Revenue Audit automatically.' },
            { t: 'p', text: 'And you do not read the numbers alone. Bar Cop Briefing writes a plain-language narrative on every audit and reads your trend on the Revenue dashboard, so the story behind the numbers is already written for you.' }
          ]
        },
        {
          id: 'benchmarks', nav: 'Benchmarks', eyebrow: 'Benchmarks',
          title: 'The Numbers to Run Against',
          blocks: [
            { t: 'p', text: 'These are your reference points. Bar Cop measures against them for you every week, but know them cold. Find your category, know your target, and know the line where a number turns into a problem.' },
            { t: 'h', text: 'Menu and Pricing' },
            { t: 'table',
              head: ['Metric', 'Target', 'Warning', 'Critical', 'Common cause'],
              rows: [
                ['Stars (contribution margin)', 'Above average', 'At average', 'Below average', 'Stars belong in prime placement and the briefing every shift'],
                ['Plowhorses', 'Reprice to avg', 'Within 10%', '25%+ below avg', 'Reprice or rework the recipe to lift margin without losing volume'],
                ['Menu price review', 'Quarterly', 'Semi-annual', 'Annual or less', 'Prices untouched since opening are almost always below the floor'],
                ['Items above food-cost target', 'Under 10%', '10-20%', 'Above 20%', 'Every item above target is subsidized by the ones at target']
              ] },
            { t: 'h', text: 'Labor Cost and Productivity' },
            { t: 'table',
              head: ['Metric', 'Target', 'High warning', 'Critical', 'Most common cause'],
              rows: [
                ['Bar labor % of bar revenue', '18-24%', '25-28%', '29%+', 'Over-scheduled for the volume'],
                ['Kitchen labor % of food revenue', '28-34%', '35-38%', '39%+', 'Scheduling above the revenue, or a low-volume week'],
                ['Floor labor % of total revenue', '16-22%', '23-26%', '27%+', 'Over-staffed floor or check average below threshold'],
                ['Revenue per labor hour, bar', '$55-75', '$40-54', 'Under $40', 'Labor not producing proportional revenue'],
                ['Revenue per labor hour, full service', '$40-60', '$30-39', 'Under $30', 'Schedule or check average needs work']
              ] },
            { t: 'h', text: 'Check Average and Upsell' },
            { t: 'table',
              head: ['Metric', 'Target', 'Warning', 'Critical', 'What to look at'],
              rows: [
                ['Check average growth, monthly', '0.5-1.5%', 'Flat', 'Declining', 'Server performance, menu mix, or briefing slipping'],
                ['Server check-average spread', 'Under 15%', '15-25%', 'Above 25%', 'Wide spread means inconsistent selling, not personality'],
                ['Upsell attempt rate', '80%+ of tables', '50-79%', 'Under 50%', 'Briefing not landing, or no table audit'],
                ['Dessert close rate', '25-35%', '15-24%', 'Under 15%', 'Dessert offered, not suggested by name']
              ] }
          ]
        },
        {
          id: 'connect', nav: 'How It Connects', eyebrow: 'How the systems connect',
          title: 'Six Systems, One Revenue Engine',
          blocks: [
            { t: 'p', text: 'These are not independent fixes. Menu engineering without pricing gives you items in the right spot at the wrong price. Scheduling without RPLH gives you a schedule that feels right but is not tied to the revenue it has to support. Upselling without check-average tracking gives you activity with no measure of whether it works. Revenue stalls when it is treated as separate problems instead of one connected engine.' },
            { t: 'p', text: 'The systems are sequenced on purpose. Menu engineering comes first because every pricing decision, every upsell, and every event menu builds on knowing which items make money and which ones you are subsidizing. Each system feeds the next.' },
            { t: 'parts', items: [
              { label: 'System 1', name: 'Menu Engineering', desc: 'Stars, plowhorses, puzzles, dogs. Know which items to push and which to cut. Start here.', focus: 'menu-engineering' },
              { label: 'System 2', name: 'Pricing', desc: 'Price to your real costs, not the bar down the street. Review it every quarter.', focus: 'pricing' },
              { label: 'System 3', name: 'Labor Cost and Scheduling', desc: 'Build the schedule from the revenue number, not from last week schedule.', focus: 'labor-scheduling' },
              { label: 'System 4', name: 'Labor Productivity', desc: 'Revenue per labor hour tells you whether the schedule is actually working.', focus: 'rplh' },
              { label: 'System 5', name: 'Check Average and Upsell', desc: 'Every table has more in it. This builds the system that captures it.', focus: 'check-average' },
              { label: 'System 6', name: 'Server Performance', desc: 'Your floor is the revenue engine. Measure it by server, coach from the number.', focus: 'server-performance' }
            ] },
            { t: 'box', tone: 'gold', label: 'The logic in plain language', text: 'Menu engineering tells you which items to sell, pricing makes sure each one carries its margin, and the floor systems (check average and server performance) get them ordered. Labor cost and RPLH make sure the revenue you capture is not eaten by the hours you scheduled to capture it. Start with menu engineering. Every pricing, upsell, and labor decision downstream is better once you know which items make money.' },
            { t: 'go', label: 'Revenue Fix System', screen: 'r-fix', focus: 'menu-engineering' }
          ]
        },
        {
          id: 'r1', nav: 'System 1: Menu Engineering', eyebrow: 'System 1 - know what makes money',
          title: 'Menu Engineering',
          blocks: [
            { t: 'lead', text: 'A bar in Atlanta, 72 seats, same menu for three years. Salmon was her third-highest seller. She was proud of it, put it in the feature box, trained servers to push it. We ran the numbers. Salmon contributed 7.20 a plate. Her ribeye, which she never pushed because it felt expensive to suggest, contributed 19.40. Same covers, same kitchen. She had been training her team to sell her worst-margin item and leaving 12 dollars on the table every time they succeeded.' },
            { t: 'p', text: 'Food cost percent tells you whether an item is in line with its price. Contribution margin in dollars is what hits the bottom line. Most operators promote by volume, not by margin per plate, and that is exactly backwards. Promotion is not the same as margin. Filling your best menu positions with anything other than your best-margin items is opportunity walking out the door.' },
            { t: 'p', text: 'Every item lands in one of four spots. Stars are high margin and high volume: feature them and put them in the briefing. Plowhorses are high volume, low margin: reprice toward the floor or rework the recipe. Puzzles are high margin, low volume: usually a visibility problem, so reposition and rewrite the description. Dogs are low and low: rework or cut. A box or a strong description moves selection 20 to 30 percent, which is revenue with no kitchen change.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You set every item up in Menu Items with its real cost. Menu Engineering plots the four quadrants for you off your live sales, ranked by contribution margin in dollars, not food cost percent. The Dog Test Tracker watches the items on a 90-day test so a cut is a decision, not a guess.' },
            { t: 'go', label: 'Menu Engineering', screen: 'r-menu-engineering' },
            { t: 'go', label: 'Menu Engineering system', screen: 'r-fix', focus: 'menu-engineering' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Review the quadrants quarterly: which Stars are not in prime positions, which Plowhorses need a price or recipe fix.',
              'Sort by contribution margin in dollars, not by food cost percent. The ranking will surprise you.',
              'Put Dogs on a 90-day test in a better spot with a better description, then keep or cut.',
              'Update item costs whenever a supplier price moves more than 5 percent. Stale costs put items in the wrong quadrant.',
              'Give every Star and high-margin item a description that names the key ingredient and a pairing. A pairing in the description is an embedded upsell.'
            ] },
            { t: 'docs', items: [
              { file: 'revenue/Menu_Engineering_Audit.pdf', label: 'Menu Engineering Review Worksheet' }
            ] }
          ]
        },
        {
          id: 'r2', nav: 'System 2: Pricing', eyebrow: 'System 2 - price to your cost, not theirs',
          title: 'Pricing',
          blocks: [
            { t: 'lead', text: 'A bar owner in Denver, full-service, solid reviews, steady regulars. He had not changed a menu price in 26 months. His chicken entree was still 18 dollars while his protein cost was up 21 percent and his kitchen labor up 14. His food cost on that plate was now 44 percent. He had been serving it to 80 people a week and losing ground on every one, assuming the menu was fine because nobody complained.' },
            { t: 'p', text: 'Most operators do not have a pricing strategy, they have a pricing history. Prices were set at opening, nudged when costs got painful, and otherwise left alone because raising feels risky. Reactive pricing always lags the cost curve. The fix is a quarterly review on a fixed calendar that catches the increase in April instead of finding it on the May statement.' },
            { t: 'p', text: 'Do not price off the bar down the street. Their supplier discount, their lease, their prep cook are not yours. Their 16 dollar burger hits 28 percent food cost; yours at 16 might hit 34. Price to your own cost floor: ingredient cost divided by your target food-cost percent. And guest resistance is wildly overestimated. A surgical 1 to 2 dollar bump on a mid-menu item during a normal reprint almost never gets noticed. The 1.50 you are afraid to add is real money every year you do not.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Menu Items holds your real ingredient costs and shows the price floor for every item. The Price Calculator runs a proposed change and shows the break-even before you print. Menu Engineering hands you the plowhorse list that should go through pricing first.' },
            { t: 'go', label: 'Price Calculator', screen: 'r-price-calc' },
            { t: 'go', label: 'Pricing system', screen: 'r-fix', focus: 'pricing' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Run the price floor on every item where ingredient costs moved since the last review. Flag anything below floor.',
              'Run each plowhorse through the Price Calculator at a 1.50 to 3 dollar increase before you decide.',
              'Review quarterly on a fixed calendar, and any time a supplier raises a high-volume item more than 8 percent.',
              'Price spirits, wine, draft, and food on their own math. They are not the same category.',
              'Close the review with a written list and a target print date. An intention to reprice the salmon is not a review.'
            ] },
            { t: 'docs', items: [
              { file: 'revenue/Quarterly_Pricing_Review.pdf', label: 'Quarterly Pricing Review Checklist' }
            ] }
          ]
        },
        {
          id: 'r3', nav: 'System 3: Labor Cost', eyebrow: 'System 3 - schedule to the revenue',
          title: 'Labor Cost and Scheduling',
          blocks: [
            { t: 'lead', text: 'A full-service concept in Chicago, 110 seats. A Tuesday in February: 22 servers on for a shift that did 4,200 in food and beverage. That is 191 dollars a server and floor labor at 58 percent of revenue. The manager who built it did what he always did on Tuesdays, the same way for two and a half years. Nobody had ever told him to check the revenue before he wrote the names.' },
            { t: 'p', text: 'Labor is the most controllable major expense you have. Your lease does not flex with revenue; your labor should, and in most bars it does not because the schedule is built the same way every week. The fix is not cutting staff or wages, it is building the schedule from a revenue number instead of from memory. And a blended labor percent hides the problem: 32 percent total can be a tight bar carrying a kitchen and floor that are both five points over.' },
            { t: 'p', text: 'Overtime is a scheduling failure, not a staffing solution. A few overtime earners at five premium hours a week runs well into five figures a year, paid as a premium on hours you were already going to have. And slow shifts are the quiet leak: Monday and Tuesday do half the weekend revenue at three-quarters of the headcount because the extra body feels safe.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Revenue Forecast sets the number for the week. You build to it in Build Schedule, which shows the labor budget in hours before you write a single name. Overtime Watch catches the premium before it runs, and Labor History splits the percentage by department so nothing hides in the blend.' },
            { t: 'go', label: 'Build Schedule', screen: 'lc-build-schedule' },
            { t: 'go', label: 'Labor Cost and Scheduling system', screen: 'r-fix', focus: 'labor-scheduling' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Pull the revenue forecast by day before you build, and build to the labor budget in hours, not from last week.',
              'Flag any shift where the schedule runs more than 5 percent over its budget, and settle it before you post.',
              'Every Monday, review actual labor by department against target. Flag anything more than 2 points over.',
              'Decide whether a miss was a scheduling error or a revenue miss, and assign one action before the review closes.',
              'Treat overtime as a schedule to fix, not a cost to accept. Redistribute the hours.'
            ] },
            { t: 'docs', items: [
              { file: 'revenue/Weekly_Labor_Review.pdf', label: 'Weekly Labor Review Form' }
            ] }
          ]
        },
        {
          id: 'r4', nav: 'System 4: Labor Productivity', eyebrow: 'System 4 - the return on every hour',
          title: 'Labor Productivity (RPLH)',
          blocks: [
            { t: 'lead', text: 'Two bars, same city, similar concept, both around 900,000 a year, both running 28 percent blended labor. Bar A pulls 68 dollars of revenue per labor hour on Saturday and 41 on Tuesday. Bar B pulls 42 on Saturday and 28 on Tuesday. Same labor percent. Bar A gets 60 percent more revenue out of every labor dollar, and the percentage hides it completely.' },
            { t: 'p', text: 'Revenue per labor hour is what you get back for every hour you schedule: revenue divided by labor hours. Labor percent answers whether you spent the right share. RPLH answers whether that spend produced what it should. A Saturday at 38 against a 55 target is a 17 dollar gap an hour, and across a season of Saturdays that is real revenue the labor you already pay for is not capturing.' },
            { t: 'p', text: 'Low RPLH has three causes and each needs a different fix: over-scheduling (rebuild from the forecast), check average too low (briefing and upsell), or a revenue miss against forecast (a one-off). Get the diagnosis right, because cutting the schedule to fix a check-average problem just makes service worse. Set your targets off your own baseline plus 10 to 15 percent, not a benchmark copied from a guide that has nothing to do with your concept.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'This Week shows your revenue per labor hour by shift against target, with the trend. You build to that target in Build Schedule, working backward from the revenue the shift is set up for instead of guessing a headcount.' },
            { t: 'go', label: 'This Week', screen: 'r-this-week' },
            { t: 'go', label: 'Labor Productivity system', screen: 'r-fix', focus: 'rplh' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Read RPLH by shift every Monday. Flag any shift more than 10 percent below target.',
              'Check the four-week trend: is the shift moving toward target or away from it.',
              'Decide whether a below-target shift is a scheduling problem or a check-average problem, then fix the right one.',
              'Build the schedule from the revenue the shift is set up for, not from a headcount habit.',
              'Set targets off your own baseline plus 10 to 15 percent, not a copied benchmark.'
            ] }
          ]
        },
        {
          id: 'r5', nav: 'System 5: Check Average', eyebrow: 'System 5 - the fastest floor lever',
          title: 'Check Average and Upsell',
          blocks: [
            { t: 'lead', text: 'A full-service bar in Portland, 85 seats. The owner figured her average check was around 30, maybe a little more. We pulled three weeks by server. Her highest was 41.20. Her lowest was 23.80. Same menu, same guests, same room. A 17.40 spread between her best and worst server she had never seen because she was only looking at total revenue, not at what each person on the floor was generating per cover.' },
            { t: 'p', text: 'Check average is the revenue your servers generate per cover, and it is the number that tells you whether the floor is selling or taking orders. Two servers with the same section produce completely different revenue if one suggests an appetizer and a dessert and the other asks if there is anything else. A server who says we have a really good Old Fashioned tonight is making a suggestion; a server who asks if you want a drink is making an offer. Specific suggestions convert two to three times the rate of open offers.' },
            { t: 'p', text: 'A 3 dollar lift across the floor needs no new customers and no bigger room, just a briefing before each shift and a number to hit. The pre-shift briefing is the highest-payoff five minutes in the building, and it is operational, not motivational: the featured items, the check-average target, the upsell sequence, one pairing. Track by server and flag anyone more than 15 percent below the team. The gap between a below-average server and the team, times their covers, times the year, is the coaching conversation.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Server Check tracks check average by server and shift, compares each to the team, and flags the gaps. The scorecard is your weekly read, and the upsell standards, the briefing form, and the table audit download right here for the floor.' },
            { t: 'go', label: 'Server Check', screen: 'r-server-check' },
            { t: 'go', label: 'Check Average system', screen: 'r-fix', focus: 'check-average' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Run a pre-shift briefing before every service: featured items, a check-average target, the upsell sequence, one pairing.',
              'Review check average by server every Monday. Flag anyone more than 15 percent below the team.',
              'Any server trending down two weeks in a row gets a coaching conversation this week.',
              'Run two table audits a week, different shifts, unannounced. Predictable audits only buy you good behavior on audit day.',
              'Set the next week briefing items from your Menu Engineering Stars.'
            ] },
            { t: 'docs', items: [
              { file: 'revenue/Server_Upsell_Standards_Scripts.docx', label: 'Server Upsell Standards and Scripts' },
              { file: 'revenue/PreShift_Upsell_Briefing.pdf', label: 'Pre-Shift Upsell Briefing' },
              { file: 'revenue/Table_Visit_Audit.pdf', label: 'Table Visit Audit' }
            ] }
          ]
        },
        {
          id: 'r6', nav: 'System 6: Server Performance', eyebrow: 'System 6 - manage the revenue engine',
          title: 'Server Performance',
          blocks: [
            { t: 'lead', text: 'A GM at a 110-seat concept spent three years watching his best server and his second-best from across the room. Both were regulars favorites, both professional. He asked which one to promote to floor lead. I asked their individual check averages for the last 60 days. He had never pulled the number by server. We pulled it together: his best server averaged 29 a cover, his second-best 41. He had been about to promote the wrong person because he was managing by impression instead of by data.' },
            { t: 'p', text: 'The floor generates 60 to 70 percent of revenue in most full-service concepts and gets the least rigor. You track product cost to the decimal and let the floor run on personality. Two reliable, well-liked servers a few dollars below the team average can quietly cost tens of thousands a year, not because they are bad, but because nobody told them the number.' },
            { t: 'p', text: 'Coach from the number, not a judgment. Not your tables are not selling enough, which is an impression, but your check average over four weeks was 24.80 against a team average of 33.40, which is a fact. Most servers below average are not lazy; they are uncomfortable at one touch point, usually the dessert close, and nobody ever helped them get comfortable with it. A written standard signed at hire makes every later conversation fair and enforceable, and naming the top performer each week tells the whole floor the number is seen.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'Server Check is the scorecard: check average by server, the team comparison, and the four-week trend, so coaching starts from a fact. The written standard and the table audit download right here.' },
            { t: 'go', label: 'Server Check', screen: 'r-server-check' },
            { t: 'go', label: 'Server Performance system', screen: 'r-fix', focus: 'server-performance' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Review check average by server every Monday and flag anyone below threshold.',
              'Name the top performer for the prior week in the next briefing.',
              'Schedule coaching for below-average servers this week, not next, and open with the number.',
              'Distribute the written standard, collect a signed copy at hire, and keep it on file.',
              'Check the four-week trend two weeks after coaching. Moving, acknowledge it. Not moving, a second conversation in writing.'
            ] },
            { t: 'docs', items: [
              { file: 'revenue/Server_Upsell_Standards_Scripts.docx', label: 'Server Upsell Standards and Scripts' },
              { file: 'revenue/Table_Visit_Audit.pdf', label: 'Table Visit Audit' }
            ] }
          ]
        },
        {
          id: 'r7', nav: 'System 7: Keep It Running', eyebrow: 'System 7 - make it survive a busy Friday',
          title: 'Putting It In Place and Keeping It Running',
          blocks: [
            { t: 'lead', text: 'A bar owner in Seattle reads every book about running a better restaurant. She highlights, she dog-ears, she starts about twice a year, gets through week one with real energy, and then a Saturday blows up and a manager calls out and the spreadsheet she opened Tuesday sits untouched until she finds it three months later. The information was never the problem. The absence of a sequenced plan with named owners, fixed deadlines, and one number to confirm it is working was the problem, every time. Motivation lasts about ten days. Process does not expire.' },
            { t: 'p', text: 'Most efforts fail at the 45-day mark, not week one. A briefing gets skipped on a busy night, the Monday review slides to Tuesday, the audit sits in a drawer. Each feels like a one-time exception. None of them are. The order matters too: menu engineering before pricing, labor cost before RPLH, check average before the upsell standard, because each one produces the data the next one needs.' },
            { t: 'h', text: 'The first four weeks' },
            { t: 'table', nowrap1: true,
              head: ['Week', 'Focus', 'What goes live'],
              rows: [
                ['Week 1', 'Establish baselines', 'Run the menu for margin, pull check average by server, set labor and RPLH targets. Change nothing. Know the numbers.'],
                ['Week 2', 'Build the lists', 'Run the price floors, build next week from a forecast, log every server check average. Build the lists, do not reprice yet.'],
                ['Week 3', 'Launch the floor systems', 'Sign the server standard, run the first briefing, start the first coaching conversation, run the first table audit.'],
                ['Week 4', 'Full run', 'Every system at once: Monday labor and RPLH review, a briefing every shift, two audits, the menu matrix and check average updated.']
              ],
              note: 'Week 3 feels uncomfortable the first time you hand experienced servers a written standard. Do it anyway. Direct, professional, not apologetic. This is how the floor runs now.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You do not track this on paper. The moment you do the first real step, your Revenue Fix System logs that day and measures from there. It reads your live data and tells you which systems are running and which are slipping, so the 45-day fade shows up as a status you can see, not a surprise on next month numbers. Your setup checklist lives in Getting Started.' },
            { t: 'go', label: 'Revenue Fix System', screen: 'r-fix', focus: 'menu-engineering' },
            { t: 'docs', items: [
              { file: 'revenue/30_90Day_Revenue_Growth_Roadmap.docx', label: '30 and 90-Day Revenue Growth Roadmap' }
            ] }
          ]
        },
        {
          id: 'close', nav: 'Start Tonight', eyebrow: 'Start tonight',
          title: 'The Revenue Is Already in Your Building',
          blocks: [
            { t: 'lead', text: 'A bar owner in Asheville, 78 seats, three months in. Check average up 3.80 from baseline at 110 covers a night. Nine private events in October against four the month before. Floor labor running 22 percent against a 29 percent habit-schedule baseline. She said she could not believe none of it was complicated. It was not. She just never had a system that made her look at it every week.' },
            { t: 'p', text: 'What separates bars that capture their revenue from bars that leave it on the table is not location, concept, or talent. It is measurement and a system instead of a feeling. A briefing before every service. A schedule built from a revenue number. A rate card that goes out within two hours. None of it is complicated. All of it requires a system.' },
            { t: 'box', tone: 'gold', label: 'Do these tonight', text: 'Open Menu Items and set up your top sellers with real costs. Read your check average by server in Server Check. Build next week from your Revenue Forecast instead of last week schedule. Then open your Revenue Fix System and do the first step, so Bar Cop logs the day and starts measuring what you capture.' },
            { t: 'p', text: 'The gap between what you are making and what you should be making is not a market problem. It is a systems problem. Start building the system tonight.' },
            { t: 'go', label: 'Revenue Fix System', screen: 'r-fix', focus: 'menu-engineering' }
          ]
        }
      ]
    }
  }
};
