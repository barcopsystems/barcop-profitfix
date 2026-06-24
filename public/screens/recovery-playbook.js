'use strict';

/* ── Recovery Playbook — the sit-and-read companion to the Fix layer ───────────
   The app-native rewrite of the old Fix-System guide. The Fix screens are the
   tactical "do this now"; this is the strategic read that makes the operator
   care, then walks them into the exact Bar Cop screen that does the work.

   One content source (CONTENT[module]) drives two renderers: the in-app HTML
   reader (full-width, sticky section list, clickable Go-to buttons that deep
   link straight into the live screen) and a Save-PDF export built on the same
   App._pdfBuilder every Bar Cop deliverable uses. Profit is built first;
   Revenue and Traffic slot into the same scaffold.

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
    App.openScreen(module === 'revenue' ? 'r-playbook' : module === 'traffic' ? 't-playbook' : module === 'cash' ? 'c-playbook' : 'recovery-playbook');
  },

  doc() { return this.CONTENT[this._module] || this.CONTENT.profit; },
  // Slash-safe so per-module resource subfolders resolve (e.g. revenue/Foo.pdf).
  docPath(file) { return 'assets/resources/' + String(file).split('/').map(encodeURIComponent).join('/'); },

  // ── Module screen: standard .screen width + a sticky right-hand section rail ──
  render(content, actions) {
    this.container = content;
    // The screen serves whichever Recovery section it is opened from.
    this._module = (App._activeModule === 'revenue') ? 'revenue' : (App._activeModule === 'traffic') ? 'traffic' : (App._activeModule === 'cash') ? 'cash' : 'profit';
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
    return '<div class="card card-bleed data-card pb-tbl-card"><div class="card-bleed-tbl"><table class="tbl' + (b.nowrap1 ? ' pb-tbl-nowrap1' : '') + '">'
      + head + '<tbody>' + rows + '</tbody></table></div></div>'
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
    return '<div class="card card-bleed data-card pb-tbl-card"><div class="card-bleed-tbl"><table class="tbl">'
      + '<thead><tr><th>The leak</th><th>Where you capture it</th><th>Where Bar Cop shows it</th><th>Where you fix it</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div></div>';
  },

  partsHtml(b) {
    const cards = b.items.map(it =>
      '<div class="pb-part">'
      + '<div class="pb-part-label">' + esc(it.label) + '</div>'
      + '<div class="pb-part-name">' + esc(it.name) + '</div>'
      + '<div class="pb-part-desc">' + esc(it.desc) + '</div>'
      + '<div class="pb-part-go">' + this.goBtn({ label: it.name, screen: 'profit-fix', focus: it.focus }) + '</div>'
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
            { t: 'lead', text: 'Ten questions. Yes or no, no partial credit. If the answer is kind of, or I think so, that is a No. You either know the number this week or you do not.' },
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
              { n: 10, cost: '$400', q: 'Could you cover a surprise $5,000 expense next week without a scramble?', yes: 'You have a real cushion and a forward look, so a surprise is an inconvenience, not a crisis.', no: 'A single surprise on the wrong week is how good bars end up borrowing at bad rates or paying late.' }
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
              { leak: 'Paying early', capture: 'Vendor payment terms + bills in Books', show: 'the cockpit Pay on Terms step', fixLabel: 'Pay on Terms system', screen: 'c-fix', focus: 'pay-on-terms' }
            ] },
            { t: 'p', text: 'And you do not read it alone. The Cash cockpit lands you on the week\'s steps in order, the scoreboard tracks what you have freed, and every figure reads live off your own counts and bills, never a made-up number.' }
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
            { t: 'p', text: 'And you do not read the numbers alone. Bar Cop Outlook writes a plain-language narrative on every audit, and Bar Cop Insights reads your trend on the Profit dashboard, so the story behind the numbers is already written for you.' }
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
            { t: 'p', text: 'And you do not read the numbers alone. Bar Cop Outlook writes a plain-language narrative on every audit, and Bar Cop Insights reads your trend on the Revenue dashboard, so the story behind the numbers is already written for you.' }
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
    },

    traffic: {
      label: 'Traffic',
      intro: 'The strategic read behind your Traffic Fix System. The Fix screens tell you what to do this week. This is the why behind it: where your online presence leaks the guests who are already searching, what each gap quietly costs, and the exact Bar Cop screen that captures, measures, and closes it. Traffic runs on your online numbers and screenshots, not your Control data, so you enter or import them and Bar Cop does the rest.',
      sections: [
        {
          id: 'worth', nav: 'What It Costs You', eyebrow: 'What an invisible online presence costs',
          title: 'The Guests You Never See',
          blocks: [
            { t: 'lead', text: 'There is a guest searching for a bar right now in your neighborhood, on a phone, looking at the map results. Your listing shows up with no photos, an incomplete profile, and a 3.9 rating with six unanswered reviews. The bar two blocks away has 47 photos, a 4.4 with a response on every review, and a website that loaded in two seconds with a reservation button. The guest does not know your food is better. They decided in eight seconds on what they could see. That happens dozens of times a week and never shows on the P&L. It just shows up as a table that was never seated.' },
            { t: 'p', text: 'A bar without a real online presence captures only 60 to 80 percent of the traffic already searching for it. On 750,000 a year, closing half of that gap is 37,000 to 75,000 in business you were already in line for. It is not a marketing problem, it is a visibility problem, and a system is what fixes it.' },
            { t: 'box', tone: 'gold', label: 'The stakes', title: 'A fifth to a third of your searching guests never choose you', text: 'On a million-dollar bar that is 50,000 to 80,000 a year, captured by the bar with the more complete profile, the faster site, and the fresher reviews. These are illustrative ranges, not a promise. Your real number is whatever Bar Cop measures once you start.' },
            { t: 'h', text: 'The Four Gaps a Searching Guest Sees' },
            { t: 'p', text: 'None of it feels urgent because nothing obviously broke. The profile just sat there, slowly working against you, while you wondered why a good month was quiet.' },
            { t: 'table',
              head: ['The gap', 'What the guest sees', 'Illustrative cost'],
              rows: [
                ['Google profile', 'Incomplete fields, stale photos, unanswered questions. The signal of an inactive business.', 'Most of your local-search discovery, gone'],
                ['Website', 'Slow on a phone, a PDF menu, no reservation button. The click bounces back to Google.', 'Most mobile visitors leave before the menu loads'],
                ['Reviews', 'A lower rating and fewer recent reviews than the bar three blocks away.', 'Guests pick the listing that looks more trusted'],
                ['Email', 'No list, so every first visit depends on the guest deciding to come back alone.', 'The one channel you own, never built']
              ] },
            { t: 'h', text: 'What 90 Days Looks Like' },
            { t: 'p', text: 'A worked example, not a promise. A bar doing about 900,000 a year, busy most weekends, good food. The Google profile is 55 percent complete by the platform own score. The website was last updated years ago. Zero email list. A 4.1 rating with 28 unanswered reviews from the last six months. Not a struggling bar, a bar leaving a real share of its traffic on the table because none of it felt urgent. Here is the arc the first 90 days tends to follow.' },
            { t: 'table',
              head: ['Metric', 'Where it stood', 'Day 90'],
              rows: [
                ['Google profile', '55% complete', '100%, profile views up sharply'],
                ['Reviews', '0% answered, 3.9 rating', 'Every review answered, 4.3 rating'],
                ['Website', '9 seconds on mobile, 74% bounce', '2.4 seconds, bounce nearly halved'],
                ['Email list', '0 subscribers', '380, first campaign drove 41 covers on a Tuesday']
              ],
              note: 'Day 1 is always the same. The profile is worse than the owner thought. That is not a problem with the bar. It is the first accurate picture it has had of its digital presence.' },
            { t: 'p', text: 'Week one: the profile goes to 100 percent, holiday hours fixed, photos added, two posts up. Weeks two and three: the website hero image is compressed, the phone number moves into the mobile header, the PDF menu is replaced, a Reserve button goes in, and the review backlog gets answered. By day 90 profile views are up several hundred percent, the rating has climbed, the site loads in under three seconds, and an email list that started at zero is driving covers on a slow Tuesday. No new ad spend. The same building, a digital presence that finally makes it easy to choose you.' },
            { t: 'box', tone: 'steel', title: 'The guests are deciding right now', text: 'They are comparing your profile to the bar three blocks away and noticing nobody has answered a review in eight months. The only question is whether your online presence makes it easy to choose you or easy to choose someone else. That is the whole job Bar Cop does here.' }
          ]
        },
        {
          id: 'timeline', nav: 'The First 90 Days', eyebrow: 'What to expect and when',
          title: 'Recovery Has a Timeline',
          blocks: [
            { t: 'p', text: 'The first 30 days are foundation, not results. You complete the Google profile, audit the website and fix the top few things, set the review-response standard, and clear the backlog. No traffic increase yet. You fixed what was broken and laid the base.' },
            { t: 'p', text: 'Days 30 to 60 are early signals: profile views rise as the completed listing ranks better, review velocity picks up once you ask, and the social calendar replaces inspiration. Days 60 to 90 the systems activate: delivery listings optimized, citations consistent, the email list past a few hundred with the first campaign sent. The full presence is now visible to a searching guest.' },
            { t: 'table',
              head: ['Phase', 'What is happening', 'What to expect'],
              rows: [
                ['Days 1-30', 'Profile completed, website audited and fixed, review backlog cleared', 'No traffic increase yet. Foundation laid, broken things fixed.'],
                ['Days 30-60', 'Profile ranking better, review velocity up, social on a calendar', 'Profile views up, new-guest calls increasing, rating moving'],
                ['Days 60-90', 'Delivery optimized, citations consistent, first email campaign sent', 'Delivery discovery up, email driving return visits'],
                ['Day 90+', 'All seven systems on a weekly rhythm, monthly scorecard', 'Compounding traffic as each system reinforces the others']
              ],
              note: 'The most common place it breaks is weeks three to six, after the first push is done but before the weekly rhythm is habit. Review responses slip, the post does not go out. Bar Cop tracks whether each system is still running and flags the moment one starts slipping, so it restarts before the habit dies.' }
          ]
        },
        {
          id: 'diagnostic', nav: 'Traffic Diagnostic', eyebrow: 'Traffic diagnostic',
          title: 'How Findable Are You Right Now?',
          blocks: [
            { t: 'lead', text: 'Ten questions. Yes or no, no partial credit. If it is somewhere between, that is a No. The system is either running this week or it is not.' },
            { t: 'p', text: 'Most operators can tell you last Saturday revenue to the dollar. Ask the completeness score on the Google profile and it gets quiet. Ask the last time anyone answered a review and the subject changes. Ask the mobile bounce rate and it has never been checked. That gap, between what you know and what the guest sees before they decide, is where this diagnostic lives. The monthly figure next to each No is an illustrative example of what that gap commonly costs, not your number.' },
            { t: 'diag', items: [
              { n: 1, cost: '$1,400', q: 'Is your Google Business Profile 100 percent complete, with current hours, photos updated in the last 90 days, and at least two posts live in the last 30?',
                yes: 'Every field is filled, hours are accurate including holidays, photos were refreshed within 90 days, and you have posted at least twice this month.',
                no: 'Your profile is partially complete, maybe with stale hours, few photos, and no recent posts. Guests who find you see an incomplete profile that reads as an inactive business.' },
              { n: 2, cost: '$1,200', q: 'Does your website load in under 3 seconds on mobile, show your phone and address above the fold, and have a working reservation or order link on the home page?',
                yes: 'It scores under 3 seconds on mobile, your contact info is visible without scrolling, and a guest can act from the home page without hunting.',
                no: 'It is slow on a phone, the contact info takes scrolling to find, or there is no clear action. Most guests searching on a phone leave before they see your content.' },
              { n: 3, cost: '$900', q: 'Do you respond to every Google review within 48 hours with a personalized reply that addresses what they actually wrote?',
                yes: 'Every review, good or bad, gets a response within 48 hours that uses the name and references something specific.',
                no: 'Reviews go unanswered, or you reply only to the good ones. Unanswered reviews tell both guests and Google nobody is managing the business.' },
              { n: 4, cost: '$1,600', q: 'Do you appear in the Google Maps top 3 for at least two searches a new guest in your neighborhood would actually run?',
                yes: 'You have checked your real ranking for at least two high-intent local searches, you are in the top 3 for both, and you track it weekly.',
                no: 'You have never checked your real ranking for the searches guests run, or you know you are not in the top 3 for any neighborhood search. The top 3 takes most of the clicks.' },
              { n: 5, cost: '$800', q: 'Do you post on at least one social platform three times a week with content that shows the actual experience inside your bar, not just promo graphics?',
                yes: 'You post at least three times a week with a mix of experience content, video, and timely updates that show the space, the team, and what it feels like to be there.',
                no: 'You post irregularly, mostly promo graphics, or not at all. Content that does not show the experience does not drive new guests through the door.' },
              { n: 6, cost: '$1,100', q: 'Are you listed on at least two delivery platforms with current photos, accurate hours, and a menu that matches what you actually serve right now?',
                yes: 'You are live on at least two platforms with current photos, accurate hours, and no discontinued items on the menu.',
                no: 'You are not on delivery, or the listings have old photos, wrong hours, or dead menu items. Delivery platforms are discovery platforms now.' },
              { n: 7, cost: '$1,300', q: 'Do you have a guest email list with at least 300 active subscribers, and have you sent a campaign in the last 30 days?',
                yes: 'You collect emails at multiple touchpoints, your list has at least 300 recent opt-ins, and you sent a campaign this month.',
                no: 'You have no list, a small dormant one, or you collect addresses but never send. Email is the only channel where you own the audience.' },
              { n: 8, cost: '$700', q: 'Is your name, address, and phone identical across Google, Yelp, Facebook, and your website, with no variations in spelling or format?',
                yes: 'Every listing uses the exact same name, address format, and phone. No abbreviations on some and spelled out on others, no old numbers anywhere.',
                no: 'Your listing details vary across platforms. That inconsistency directly suppresses your local search ranking.' },
              { n: 9, cost: '$1,000', q: 'Do you have a written process for asking guests for a review at the moment of highest satisfaction, with at least one staff member trained on it this month?',
                yes: 'You have a written ask process, it specifies when and how, and you trained at least one staff member on it in the last 30 days.',
                no: 'You rely on happy guests to review on their own. Without an active ask, velocity stalls and your rating drifts down against competitors who do ask.' },
              { n: 10, cost: '$600', q: 'Do you review your profile insights, website clicks, and review count every week against the prior week?',
                yes: 'You have a Monday tracking review where you check profile views, calls, directions, website visits, and review count against last week.',
                no: 'You check these occasionally or never. Without weekly tracking you cannot see whether your work is paying off or whether something broke on your profile.' }
            ] },
            { t: 'diagscore' },
            { t: 'box', tone: 'steel', label: 'Five things that are true about every bar', items: [
              'Your Google profile has at least three incomplete fields suppressing your local ranking right now.',
              'Your website loads slower on a phone than you think, and most guests who click your link leave before it finishes.',
              'At least four reviews from the last six months have gone unanswered, and every guest who reads them notices.',
              'Your best guests would give you their email if you asked correctly, and you have never built a way to ask.',
              'The bar ranking above you in Maps for your neighborhood is not better than you. They just have a more complete profile and more recent reviews.'
            ] }
          ]
        },
        {
          id: 'what', nav: 'What Bar Cop Does', eyebrow: 'What Bar Cop does for you',
          title: 'Every Gap: Captured, Measured, Closed',
          blocks: [
            { t: 'lead', text: 'The old way was a folder full of spreadsheets and a vague sense your online presence needed work. Bar Cop runs it for you. You log your online numbers in the Online Tracker and This Week, by hand or by dropping in a screenshot, Bar Cop diagnoses where the searching guest is slipping away, and the Fix System walks you into the exact screen that closes it.' },
            { t: 'p', text: 'Here is the map. Every gap, where you capture it, where Bar Cop shows it to you, and where you fix it. Tap any Fix button to jump straight there.' },
            { t: 'cross', rows: [
              { leak: 'Google profile', capture: 'Online Tracker profile fields', show: 'Traffic dashboard + Audit', fixLabel: 'Google Business system', screen: 't-fix', focus: 'gbp' },
              { leak: 'Website', capture: 'Online Tracker website check', show: 'Traffic dashboard', fixLabel: 'Website system', screen: 't-fix', focus: 'website' },
              { leak: 'Reviews', capture: 'This Week rating and review counts', show: 'Traffic dashboard', fixLabel: 'Reviews system', screen: 't-fix', focus: 'reviews' },
              { leak: 'Search and SEO', capture: 'Online Tracker search, citations, NAP', show: 'Traffic dashboard', fixLabel: 'Search and SEO system', screen: 't-fix', focus: 'search-seo' },
              { leak: 'Social media', capture: 'Online Tracker + This Week social numbers', show: 'Traffic dashboard', fixLabel: 'Social Media system', screen: 't-fix', focus: 'social' },
              { leak: 'Delivery platforms', capture: 'Online Tracker + This Week delivery numbers', show: 'Traffic dashboard', fixLabel: 'Delivery Platforms system', screen: 't-fix', focus: 'delivery' },
              { leak: 'Email', capture: 'Online Tracker list size + This Week growth', show: 'Traffic dashboard', fixLabel: 'Email Marketing system', screen: 't-fix', focus: 'email-loyalty' }
            ] },
            { t: 'p', text: 'The paper a system still needs lives inside it too. The GBP checklist and photo brief, the review response templates and recovery protocol, the keyword worksheet, the social standards, the delivery comparison, and the email templates all download right from the step that calls for them in your Traffic Fix System. And on This Week you can drop in a screenshot of your platform dashboards and Bar Cop reads the numbers off it.' },
            { t: 'p', text: 'You do not read the numbers alone either. Bar Cop Outlook writes a plain-language narrative on every audit, and Bar Cop Insights reads your trend on the Traffic dashboard, so the story behind the numbers is already written for you.' }
          ]
        },
        {
          id: 'benchmarks', nav: 'Benchmarks', eyebrow: 'Benchmarks',
          title: 'The Numbers to Run Against',
          blocks: [
            { t: 'p', text: 'These are your reference points. Bar Cop measures against them for you every week, but know them cold. Find the metric, know your target, and know the line where a number turns into a problem.' },
            { t: 'h', text: 'Google Business and Local Search' },
            { t: 'table',
              head: ['Metric', 'Target', 'Warning', 'Critical', 'Common cause'],
              rows: [
                ['GBP completeness', '100%', '85-99%', 'Under 85%', 'Every incomplete field reduces local pack ranking'],
                ['Total photos', '40+', '20-39', 'Under 20', 'Profiles with 40+ photos get more click-throughs'],
                ['Photos added, last 90 days', '5+', '2-4', '0-1', 'Photo recency is a ranking activity signal'],
                ['GBP posts, last 30 days', '4+', '2-3', '0-1', 'Posts signal active management'],
                ['Local pack ranking', 'Top 3', '4-7', '8+', 'Top 3 takes over 75% of clicks; position 4+ under 10%']
              ] },
            { t: 'h', text: 'Website Conversion' },
            { t: 'table',
              head: ['Metric', 'Target', 'Warning', 'Critical', 'Common cause'],
              rows: [
                ['Mobile load time', 'Under 3s', '3-5s', 'Over 5s', 'Most mobile visitors leave if load exceeds 3 seconds'],
                ['Mobile bounce rate', 'Under 40%', '40-60%', 'Over 60%', 'The page is not answering what the search promised'],
                ['Click-to-call rate', '8-15%', '4-7%', 'Under 4%', 'Phone not above the fold or not tap-to-call'],
                ['Reservation link clicks', '6-12%', '3-5%', 'Under 3%', 'CTA not above the fold or the path has too many steps']
              ] },
            { t: 'h', text: 'Reviews and Reputation' },
            { t: 'table',
              head: ['Metric', 'Target', 'Warning', 'Critical', 'Common cause'],
              rows: [
                ['Average Google rating', '4.3+', '4.0-4.2', 'Under 4.0', 'Under 4.0 drops inquiry conversion vs a 4.3+ competitor'],
                ['Review response rate', '100%', '70-99%', 'Under 70%', 'Unanswered reviews signal a business nobody manages'],
                ['Review response time', 'Under 24h', '24-48h', 'Over 48h', 'Response time feeds guest perception and ranking'],
                ['New reviews, last 30 days', '8+', '4-7', 'Under 4', 'Review velocity is a ranking signal']
              ] },
            { t: 'h', text: 'Social and Email' },
            { t: 'table',
              head: ['Metric', 'Target', 'Warning', 'Critical', 'Common cause'],
              rows: [
                ['Social posting frequency', '3+/week', '1-2/week', 'Under 1/week', 'Algorithms deprioritize accounts posting under 3x a week'],
                ['Experience content ratio', '60%+', '40-59%', 'Under 40%', 'Promo content alone does not drive new-guest visits'],
                ['Email list size, active', '500+', '200-499', 'Under 200', 'Under 200 produces unreliable campaign data'],
                ['Email open rate', '28%+', '18-27%', 'Under 18%', 'Subject line problems or list quality']
              ] }
          ]
        },
        {
          id: 'connect', nav: 'How It Connects', eyebrow: 'How the systems connect',
          title: 'Seven Systems, One Front Door',
          blocks: [
            { t: 'p', text: 'These are not independent fixes. A complete Google profile that sends traffic to a slow website loses most of those visitors before they act. A high review count with no response standard tells the next guest nobody is managing the place. A social following with no email capture builds an audience on a platform you do not own. Each system produces the visibility that makes the next one worth doing.' },
            { t: 'p', text: 'The systems are sequenced on purpose. Google Business comes first because most new-guest discovery for a bar starts there, and every other system produces better results once the profile sending traffic is complete and ranking. Each one feeds the next.' },
            { t: 'parts', items: [
              { label: 'System 1', name: 'Google Business', desc: 'Complete every field, post weekly. The single highest-return action in this system.', focus: 'gbp' },
              { label: 'System 2', name: 'Website', desc: 'If your profile sends them to a slow site with a PDF menu, the visit is lost.', focus: 'website' },
              { label: 'System 3', name: 'Reviews', desc: 'Rating, velocity, and response rate. All three drive ranking and the decision.', focus: 'reviews' },
              { label: 'System 4', name: 'Search and SEO', desc: 'Own your neighborhood searches. NAP consistency and citations are the base.', focus: 'search-seo' },
              { label: 'System 5', name: 'Social Media', desc: 'Experience content drives walk-ins. Promo graphics drive likes. Not the same thing.', focus: 'social' },
              { label: 'System 6', name: 'Delivery Platforms', desc: 'Discovery, not just orders. A delivery guest becomes a dine-in regular.', focus: 'delivery' },
              { label: 'System 7', name: 'Email Marketing', desc: 'The one channel you own. No algorithm can take it away.', focus: 'email-loyalty' }
            ] },
            { t: 'box', tone: 'gold', label: 'The logic in plain language', text: 'Google Business and local search get you found. The website and reviews decide whether the guest who found you chooses you. Social and delivery widen the discovery. Email is the only channel that brings them back on your terms. Start with Google Business. Every other system produces more once the profile sending the traffic is complete and ranking.' },
            { t: 'go', label: 'Traffic Fix System', screen: 't-fix', focus: 'gbp' }
          ]
        },
        {
          id: 't1', nav: 'System 1: Google Business', eyebrow: 'System 1 - where discovery starts',
          title: 'Google Business',
          blocks: [
            { t: 'lead', text: 'A bar owner in Phoenix, 68 seats, solid following, open four years. A regular stopped in to ask why Google said they were permanently closed. She pulled up her profile right there at the bar. Permanently closed. She had no idea, and it had been showing that for six weeks. Six weeks of guests who searched, saw permanently closed, and went somewhere else. No notification, nobody told her. The listing just sat there saying the wrong thing while she wondered why October was slow.' },
            { t: 'p', text: 'For an independent bar, most new-guest discovery starts on Google Maps, and the three results at the top of the map take over 75 percent of the clicks. Everything below position three gets under 10 percent combined. The guests searching are already in buying mode, already deciding where to go. A complete, photo-rich, active profile with a strong rating is the most efficient conversion tool you have, and it costs nothing to finish.' },
            { t: 'p', text: 'Complete every field. Get to 40-plus photos and refresh at least five every 90 days. Post weekly with a photo, because a post without one gets half the click-through. Seed the questions section with the ten things guests actually ask. An incomplete profile is not neutral, it is a profile that has been quietly working against you for months while you assumed it was fine because nothing obviously broke.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Online Tracker holds your profile field-by-field with a completeness read, so you see exactly what is missing. You log your weekly profile views, calls, and direction requests in This Week, by hand or from a screenshot, and the Traffic dashboard and Audit grade where you stand.' },
            { t: 'go', label: 'Online Tracker', screen: 't-presence' },
            { t: 'go', label: 'Google Business system', screen: 't-fix', focus: 'gbp' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Complete every field: name, categories, hours including holidays, phone, website, attributes, menu link.',
              'Get to 40-plus photos across interior, bar, food, cocktails, team, and exterior. Add five every 90 days.',
              'Post at least twice a month, every post with a photo.',
              'Seed the questions section with the ten things guests ask, and answer new ones within 24 hours.',
              'Every Monday, read profile views, calls, and direction requests against last week.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/GBP_Checklist.pdf', label: 'GBP Optimization Checklist' },
              { file: 'traffic/Photo_Brief_25_Shots.pdf', label: 'Photo Brief, 25 Shots' },
              { file: 'traffic/GBP_Yelp_Description_Template.docx', label: 'Description Template' }
            ] }
          ]
        },
        {
          id: 't2', nav: 'System 2: Website', eyebrow: 'System 2 - open the door you got them to',
          title: 'Website and Online Menu',
          blocks: [
            { t: 'lead', text: 'A bar in Austin, 90 seats, a beautiful website, professionally designed, gorgeous on a desktop. We ran a mobile speed test: nine seconds to load, 74 percent bounce on mobile. Three of every four people who clicked the link from Google left before the home page finished loading. The bar was paying for a website that worked as a filter, eliminating most of its mobile traffic before they ever saw a menu, a phone number, or a way to reserve.' },
            { t: 'p', text: 'Your website is where your Google profile sends its clicks. Two-thirds or more of that traffic is on a phone, and a guest on a phone has four questions: are you open, where are you, can I reserve, what is the menu. If those are not answered in about eight seconds, a big share of guests bounce back to the search results, and your competitor is one tap away.' },
            { t: 'p', text: 'The fix is rarely a rebuild. Compress the images, put a tap-to-call number in the mobile header, replace the PDF menu with a web-readable page, and add a Reserve button above the fold. A PDF menu is a conversion failure: slow on a phone, impossible to read without pinching, and invisible to Google. Those few changes often move the page from losing half its mobile visitors to keeping most of them, in one afternoon.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Online Tracker carries your website conversion check, the handful of things that decide whether a phone visitor stays. You log the weekly numbers in This Week, and the Traffic dashboard grades the trend.' },
            { t: 'go', label: 'Online Tracker', screen: 't-presence' },
            { t: 'go', label: 'Website system', screen: 't-fix', focus: 'website' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Run a mobile speed test on your home and menu page. Target under 3 seconds.',
              'Compress every image to a few hundred KB. This alone moves the score the most.',
              'Put a tap-to-call number, the address, and today hours above the fold on mobile.',
              'Replace the PDF menu with a web-readable page. Google cannot index a PDF.',
              'Add one clear action above the fold: Reserve a Table, Order Online, or View Menu.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/Website_Conversion_Audit.pdf', label: 'Website Conversion Audit' },
              { file: 'traffic/Website_Copy_CTA_Standards.docx', label: 'Website Copy and CTA Standards' }
            ] }
          ]
        },
        {
          id: 't3', nav: 'System 3: Reviews', eyebrow: 'System 3 - rating, velocity, response',
          title: 'Reviews and Reputation',
          blocks: [
            { t: 'lead', text: 'A bar in Denver, 4.2 rating, 180 reviews, solid reputation. A competitor three blocks away: 4.4, 340 reviews. Same neighborhood, similar concept and price. When guests compared the two listings side by side, they almost always chose the competitor. Not because the competitor was better, but because 340 reviews at 4.4 looked more trustworthy than 180 at 4.2. The Denver bar had not asked a single guest for a review in six months. The competitor had a written process and got 12 to 15 a month. The gap was not quality. It was process.' },
            { t: 'p', text: 'Rating is what guests see when they compare you. Velocity is what Google sees when it decides which listings to surface, because recent activity is a prominence signal and a stale review profile reads as a less active business. Response rate counts too: an owner who answers every review, including the good ones, signals a business that is actively managed.' },
            { t: 'p', text: 'The ask works at the moment of highest satisfaction, when a guest tells a server the food was great, not when the bill arrives. A trained server asking with specific language converts several times better than a card alone. And asking guests to leave a review sounds transactional, while saying you would really appreciate hearing about their experience on Google sounds like a genuine request. For a bad review, a calm four-sentence reply, acknowledge, address the specific issue, state your standard, invite them back, protects the rating in front of every future reader.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You log your rating and new-review counts in This Week, by hand or from a screenshot, and the Traffic dashboard tracks your velocity and response rate against target so a slip shows up the same week.' },
            { t: 'go', label: 'This Week', screen: 't-this-week' },
            { t: 'go', label: 'Reviews system', screen: 't-fix', focus: 'reviews' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Respond to every review, good or bad, within 48 hours, using the name and a specific detail.',
              'Put a written ask in place and train the floor to ask at the moment a guest is clearly happy.',
              'Track new-review velocity weekly. Below target, find the shift with the lowest ask compliance.',
              'Answer a negative review in four calm sentences: acknowledge, address, state your standard, invite them back.',
              'Ask Google first. Yelp filters reviews from accounts with no history.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/Review_Response_Templates.pdf', label: 'Review Response Templates' },
              { file: 'traffic/Review_Request_Script_Card.pdf', label: 'Review Request Script Card' },
              { file: 'traffic/Negative_Review_Recovery_Protocol.docx', label: 'Negative Review Recovery Protocol' }
            ] }
          ]
        },
        {
          id: 't4', nav: 'System 4: Search and SEO', eyebrow: 'System 4 - own your neighborhood',
          title: 'Search Visibility and SEO',
          blocks: [
            { t: 'lead', text: 'A bar in Chicago, strong concept, good profile, ranking number one for best bar Chicago in organic search. The owner was proud of it. We pulled the searches that actually drove first visits: 85 percent were neighborhood-specific, bar Wicker Park, cocktails near Wicker Park, happy hour Wicker Park. For those, they were not in the top ten. They had spent a year optimizing for a vanity search almost no real customer ran, and ignored the neighborhood searches that drove nearly all their new traffic.' },
            { t: 'p', text: 'Local SEO is not about ranking for the broadest terms. It is about being findable for the specific searches a new guest in your neighborhood runs on a phone deciding where to go tonight. The map pack, the three results above the blue links, takes about three times the clicks of the organic results. Position one of the local pack is worth more than position one organic for a bar.' },
            { t: 'p', text: 'Two levers you control: relevance (your categories, description, and attributes) and prominence (reviews plus citations). A citation is any mention of your name, address, and phone, and Google uses how many and how consistent as a proxy for how established you are. The variations that hurt most are the ones that seem trivial: Street versus St, Suite versus Ste, a phone with dashes versus parentheses. Each tells Google two different businesses may be at that address, and splits the ranking credit instead of consolidating it.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Online Tracker holds your search and citation checklist, your name-address-phone consistency, and your neighborhood keyword tracking, so you see which terms are moving and which directories still need claiming.' },
            { t: 'go', label: 'Online Tracker', screen: 't-presence' },
            { t: 'go', label: 'Search and SEO system', screen: 't-fix', focus: 'search-seo' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Pick your ten target searches: the neighborhood and occasion terms a new guest actually runs.',
              'Make your name, address, and phone identical across every platform. Fix every variant.',
              'Build toward 40 directory citations with consistent details. Claim Foursquare early, it feeds others.',
              'Merge any duplicate Google or Yelp listings that split your review credit.',
              'Check your ranking for the ten terms weekly from your own neighborhood.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/Keyword_Research_Worksheet.docx', label: 'Keyword Research Worksheet' },
              { file: 'traffic/Platform_Claiming_Checklist.docx', label: 'Local SEO Quick-Start' }
            ] }
          ]
        },
        {
          id: 't5', nav: 'System 5: Social Media', eyebrow: 'System 5 - show what it feels like',
          title: 'Social Media and Content',
          blocks: [
            { t: 'lead', text: 'A bar manager in Nashville, 90 seats, spending four hours a week on Instagram. Over six months her followers grew from 1,400 to 1,900. Nobody on the team could point to one new guest who came in because of a post. The content was professional and consistent, and it was built entirely on promo graphics, menu announcements, and drink specials. Nothing showed what it felt like to be in the bar.' },
            { t: 'p', text: 'Social for a bar is not a brand exercise or a follower campaign, it is a decision-influencing tool. The post that drives a Saturday visit is almost always a video of the room on a busy night or a close-up of a cocktail worth ordering, not a graphic announcing the Tuesday special. You have two audiences: regulars who already know you, and potential guests who never heard of you. Promo content gets engagement from the regulars. Experience content gets shared to people who have never visited.' },
            { t: 'p', text: 'The highest-reach post most bars can make is a 60-second walkthrough on a busy Friday, phone vertical, no narration. It shows guests exactly what they are missing. Run a simple mix of three experience posts to one promo to one community post a week, hand a content captain on each shift a short shot list, and track profile visits, link clicks, and shares, not likes. Likes are vanity. Shares are discovery.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Online Tracker holds your social profile audit and your posting routine, and you log the weekly numbers that matter, profile visits and link clicks, in This Week. The Traffic dashboard shows which content is actually driving guests.' },
            { t: 'go', label: 'Online Tracker', screen: 't-presence' },
            { t: 'go', label: 'Social Media system', screen: 't-fix', focus: 'social' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Post at least three times a week, at least 60 percent of it experience content, not promo graphics.',
              'Lead with video: a 60-second busy-night walkthrough outperforms any graphic you can design.',
              'Run a 3-1-1 week: three experience, one promo, one community post.',
              'Name a content captain each shift with a short shot list so the clips actually get captured.',
              'Track profile visits, link clicks, and shares. Likes do not bring anyone in.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/Social_Content_Brief.pdf', label: 'Social Content Calendar' },
              { file: 'traffic/Social_Media_Content_Standards.docx', label: 'Social Standards Policy' }
            ] }
          ]
        },
        {
          id: 't6', nav: 'System 6: Delivery', eyebrow: 'System 6 - a discovery storefront',
          title: 'Delivery Platforms',
          blocks: [
            { t: 'lead', text: 'A bar in Seattle, listed on three delivery platforms. Two profiles had photos from 2020 showing a menu that no longer existed. Its rating on one platform had dropped to 3.7 without the owner noticing, because nobody was checking it. The platform fault was accepting the order. The bar fault was not catching it four months earlier.' },
            { t: 'p', text: 'Delivery platforms are live, rated, reviewed digital storefronts that run independent of your website and your profile, and they are now discovery channels, not just order channels. A guest who finds you on delivery, orders once with a good experience, and then comes in is worth far more than a single order. A listing with current photos and a 4.3-plus rating is an acquisition channel for dine-in guests. A listing with 2020 photos and a 3.7 rating deters both.' },
            { t: 'p', text: 'The delivery menu is a separate product, not a copy of the in-house one. Commission compresses your margin, so it is usually 40 to 60 percent of the full menu, curated for margin at commission and for travel quality. An item that makes money but arrives looking nothing like the photo earns a bad review that describes the restaurant. And every delivery bag is a marketing touchpoint: a small card with your photo, address, and a QR code turns a delivery order into a future visit.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Online Tracker holds your platform listing audit, photos, hours, menu, rating, and you log your weekly ratings and order volume in This Week so a rating drop shows up before it costs you a month.' },
            { t: 'go', label: 'Online Tracker', screen: 't-presence' },
            { t: 'go', label: 'Delivery Platforms system', screen: 't-fix', focus: 'delivery' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Audit every platform: current photos, accurate hours, no discontinued items, a description on every item over 12 dollars.',
              'Build the delivery menu for margin at commission and travel quality, not as a copy of the full menu.',
              'Respond to every platform review the same way you do on Google.',
              'Check every platform dashboard weekly for rating and order volume. A rating drifts to 3.7 unnoticed.',
              'Put a card in every delivery bag with your photo and a QR to reserve or join the list.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/Delivery_Platform_Comparison.docx', label: 'Delivery Platform Comparison' },
              { file: 'traffic/Online_Menu_Audit.pdf', label: 'Delivery Menu Builder' }
            ] }
          ]
        },
        {
          id: 't7', nav: 'System 7: Email', eyebrow: 'System 7 - the channel you own',
          title: 'Email Marketing',
          blocks: [
            { t: 'lead', text: 'A bar in Boston, 3,800 Instagram followers, 290 email subscribers. A slow Tuesday in February, they sent one email: we miss you, here is what is new. Three sentences about a new cocktail, the live music Friday, and a note that Tuesday and Wednesday were quiet if they wanted a table. No discount. Forty-one covers came in that Tuesday, tracked because they asked every table. Their Instagram post that same day got 84 likes and zero covers. The channel with thirteen times fewer followers drove every person who walked in.' },
            { t: 'p', text: 'Social gives you reach: your post might appear if the algorithm shows it and someone is scrolling. Email gives you access: you land in the inbox, with permission, at a time you choose. Every other system in this playbook is about the first visit. Email is the system that brings them back, and it is the one digital asset you own outright. No algorithm can interrupt it, no platform can de-prioritize it.' },
            { t: 'p', text: 'Capture at multiple touchpoints, the server ask and event signup convert highest, the table card and receipt are easiest to systematize. Write the monthly email in the owner voice, first person, under 200 words, one real detail and one invitation, signed with a name, not a marketing newsletter. Send once or twice a month, never the burst-and-silence cycle. Segment regulars from new guests, and clean the list every 90 days so your sends keep landing in the primary inbox.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'The Online Tracker holds your list size and your active capture touchpoints, and you log weekly subscriber growth in This Week, so a touchpoint that stops producing shows up fast.' },
            { t: 'go', label: 'Online Tracker', screen: 't-presence' },
            { t: 'go', label: 'Email Marketing system', screen: 't-fix', focus: 'email-loyalty' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Turn on at least two capture touchpoints this week: a table card and a receipt insert at minimum.',
              'Set up a two-email welcome sequence before the first subscriber joins.',
              'Send one owner-voice email a month, under 200 words, one detail and one invitation, signed with a name.',
              'Send once or twice a month. Never four times in two weeks and then silence.',
              'Clean the list every 90 days: re-engage non-openers, then remove them so your open rate holds.'
            ] },
            { t: 'docs', items: [
              { file: 'traffic/Email_Campaign_Templates.docx', label: 'Email Campaign Templates' },
              { file: 'traffic/Guest_Email_Capture.pdf', label: 'Email List Building Playbook' }
            ] }
          ]
        },
        {
          id: 't8', nav: 'System 8: Keep It Running', eyebrow: 'System 8 - make it survive a busy week',
          title: 'Putting It In Place and Keeping It Running',
          blocks: [
            { t: 'lead', text: 'A bar owner in Portland, good instincts, strong team, motivated. She had read two operations guides before this one. Started both, highlighted, made lists, got through week one with real energy, abandoned both at week two. Not because the systems were wrong, but because neither told her in what order to do what, on what day, with what tool, assigned to whom. They told her what good looked like. They did not tell her how to get there from a Tuesday with a full bar and three things already on fire. Motivation lasts about ten days. A task list with names and dates does not expire.' },
            { t: 'p', text: 'Most efforts fail around the 45-day mark, not week one. The Monday tracking review slides to Tuesday, the content captain role quietly disappears, the email send does not happen because nobody has anything to write. Each feels like a one-time exception. None of them are. The order matters: complete the Google profile before chasing citations, fix your name-address-phone before building new ones, set the review-response standard before pushing for more reviews.' },
            { t: 'h', text: 'The first four weeks' },
            { t: 'table', nowrap1: true,
              head: ['Week', 'Focus', 'What goes live'],
              rows: [
                ['Week 1', 'Complete the foundation', 'Finish the Google profile, claim every directory, add photos, run the first post. Record your baselines.'],
                ['Week 2', 'Audit and standardize', 'Audit the website, fix your name-address-phone everywhere, clear the review backlog, build the content calendar.'],
                ['Week 3', 'Activate the channels', 'Fix the delivery listings, stand up the email list and capture, load your keywords, send the first email.'],
                ['Week 4', 'Full run', 'All seven systems live: the Monday tracking review, posts on the calendar, reviews answered, the list growing.']
              ],
              note: 'The Monday tracking review is the system that runs the system. Twenty minutes before the week starts, it is the only thing that confirms the other six are producing. Block it as a non-movable appointment.' },
            { t: 'h', text: 'How Bar Cop runs it' },
            { t: 'p', text: 'You do not track this on paper. The moment you do the first real step, your Traffic Fix System logs that day and measures from there. It reads your logged numbers and tells you which systems are running and which are slipping, so the 45-day fade shows up as a status you can see, not a slow quiet you cannot explain. Your setup checklist lives in Getting Started.' },
            { t: 'go', label: 'Traffic Fix System', screen: 't-fix', focus: 'gbp' },
            { t: 'docs', items: [
              { file: 'traffic/30Day_Traffic_Implementation.pdf', label: '30-Day Traffic Implementation' },
              { file: 'traffic/90Day_Traffic_Growth_Roadmap.docx', label: '90-Day Traffic Growth Roadmap' }
            ] }
          ]
        },
        {
          id: 'close', nav: 'Start Tonight', eyebrow: 'Start tonight',
          title: 'The Guests Are Out There',
          blocks: [
            { t: 'lead', text: 'A bar in Minneapolis, 64 seats, good food, loyal regulars. Three months into the system. The Google profile was 54 percent complete when she started, at 100 by the end of week one. Profile views went from 340 a month to 1,140. Review velocity went from one or two a month to eleven. Rating moved from 4.1 to 4.4. The email list was zero in January and 380 in March. One Tuesday in February they emailed 290 subscribers and 41 people came in, more than the bar had ever done on a February Tuesday, and she could point to the exact email because her hosts asked. None of it was complicated. She just never had a system that made her look at these things every week.' },
            { t: 'p', text: 'What separates bars that get found from bars that stay invisible is not location, concept, or budget. It is whether someone checked the profile this month, whether there are new photos, whether the reviews have responses, whether there is an email list with an actual send this week. None of it is complicated. All of it requires a system instead of a feeling.' },
            { t: 'box', tone: 'gold', label: 'Do these tonight', text: 'Open the Online Tracker and run your Google profile completeness. Log your rating and review count in This Week. Check the rating on every delivery platform you are on. Then open your Traffic Fix System and do the first step, so Bar Cop logs the day and starts measuring what you capture.' },
            { t: 'p', text: 'The guests are already searching. They are already choosing. This system makes sure they choose you.' },
            { t: 'go', label: 'Traffic Fix System', screen: 't-fix', focus: 'gbp' }
          ]
        }
      ]
    }
  }
};
