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

  open(module) {
    this._module = module || 'profit';
    App.openHubFullPage('Recovery Playbook', (mount) => {
      this.container = mount;
      this.render();
    }, 'playbook');
    if (App.setHubTopbarActions) {
      App.setHubTopbarActions(
        '<button class="btn btn-ghost btn-sm" id="pb-back" style="margin-right:8px;">&larr; Back</button>'
        + '<button class="btn btn-ghost btn-sm" id="pb-pdf">Save PDF</button>'
      );
      document.getElementById('pb-back')?.addEventListener('click', () => App.showHub());
      document.getElementById('pb-pdf')?.addEventListener('click', () => this._exportPDF());
    }
  },

  doc() { return this.CONTENT[this._module] || this.CONTENT.profit; },
  docPath(file) { return 'assets/resources/' + encodeURIComponent(file); },

  // ── HTML reader ─────────────────────────────────────────────────────────────
  render() {
    const d = this.doc();
    const nav = d.sections.map(sec =>
      '<button class="pb-side-item" data-id="' + esc(sec.id) + '">' + esc(sec.nav) + '</button>').join('');

    const body = d.sections.map(sec => {
      const blocks = sec.blocks.map(b => this.blockHtml(b)).join('');
      return '<section class="pb-section" id="pb-' + esc(sec.id) + '">'
        + (sec.eyebrow ? '<div class="pb-eyebrow">' + esc(sec.eyebrow) + '</div>' : '')
        + '<div class="card-title pb-h1">' + esc(sec.title) + '</div>'
        + blocks + '</section>';
    }).join('');

    this.container.innerHTML = this.styleTag()
      + '<div class="pb-shell">'
      +   '<nav class="pb-side"><div class="pb-side-label">In this playbook</div>' + nav + '</nav>'
      +   '<div class="pb-main"><div class="pb-body">' + body + this.footerHtml() + '</div></div>'
      + '</div>';

    this.container.querySelectorAll('.pb-side-item').forEach(btn =>
      btn.addEventListener('click', () => {
        const el = document.getElementById('pb-' + btn.dataset.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    this.container.querySelectorAll('.pb-go').forEach(btn =>
      btn.addEventListener('click', () => {
        if (btn.dataset.focus) App._fixFocus = btn.dataset.focus;
        App.openScreen(btn.dataset.screen);
      }));
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
          + '<div class="pb-box-text">' + esc(b.text) + '</div></div>';
      case 'table':
        return this.tableHtml(b);
      case 'diag':
        return this.diagHtml(b);
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
    const rows = b.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('');
    return '<div class="tbl-wrap"><table class="tbl pb-tbl">' + head + '<tbody>' + rows + '</tbody></table></div>'
      + (b.note ? '<p class="pb-note">' + esc(b.note) + '</p>' : '');
  },

  diagHtml(b) {
    const items = b.items.map(q =>
      '<div class="pb-diag">'
      + '<div class="pb-diag-q"><span class="pb-diag-n">' + q.n + '.</span> ' + esc(q.q) + '</div>'
      + '<div class="pb-diag-a pb-diag-yes"><span>YES</span>' + esc(q.yes) + '</div>'
      + '<div class="pb-diag-a pb-diag-no"><span>NO &middot; about ' + esc(q.cost) + '/mo</span>' + esc(q.no) + '</div>'
      + '</div>').join('');
    return items;
  },

  crossHtml(b) {
    const rows = b.rows.map(r =>
      '<tr>'
      + '<td class="pb-cross-leak">' + esc(r.leak) + '</td>'
      + '<td>' + esc(r.capture) + '</td>'
      + '<td>' + esc(r.show) + '</td>'
      + '<td>' + this.goBtn({ label: r.fixLabel, screen: r.screen, focus: r.focus }) + '</td>'
      + '</tr>').join('');
    return '<div class="tbl-wrap"><table class="tbl pb-tbl pb-cross">'
      + '<thead><tr><th>The leak</th><th>Where you capture it</th><th>Where Bar Cop shows it</th><th>Where you fix it</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
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
        b.paragraph(blk.text, { gray: 55 });
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
      + '.pb-shell{display:flex;align-items:flex-start;min-height:calc(100vh - 110px);}'
      + '.pb-side{position:sticky;top:0;align-self:flex-start;flex:0 0 232px;border-right:1px solid var(--b-edge);padding:20px 0 40px;}'
      + '.pb-side-label{padding:6px 20px 10px;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t4);}'
      + '.pb-side-item{display:block;width:100%;text-align:left;background:none;border:none;border-left:2px solid transparent;color:var(--t2);font-size:13.5px;font-weight:600;padding:9px 20px;cursor:pointer;line-height:1.35;transition:background .12s,color .12s;}'
      + '.pb-side-item:hover{background:var(--c3);color:var(--w);border-left-color:var(--gold);}'
      + '.pb-main{flex:1;min-width:0;padding:22px 32px 64px;}'
      + '.pb-body{max-width:800px;}'
      + '.pb-section{margin-bottom:40px;scroll-margin-top:14px;}'
      + '.pb-eyebrow{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;}'
      + '.pb-h1{font-size:22px;margin-bottom:14px;}'
      + '.pb-lead{font-size:15px;font-style:italic;color:var(--t1);line-height:1.7;margin:0 0 14px;}'
      + '.pb-p{font-size:13.5px;font-style:italic;color:var(--t2);line-height:1.75;margin:0 0 14px;}'
      + '.pb-sh{margin:24px 0 12px;}'
      + '.pb-note{font-size:12px;color:var(--t3);line-height:1.6;font-style:italic;margin:8px 0 14px;}'
      + '.pb-list{margin:0 0 14px;padding-left:18px;color:var(--t2);font-size:13.5px;line-height:1.8;}'
      + '.pb-box{border-radius:var(--r);padding:16px 18px;margin:0 0 18px;}'
      + '.pb-box-steel{background:#0D181E;border:1px solid var(--b-edge);}'
      + '.pb-box-gold{background:var(--gold-tint);border:1px solid #504829;}'
      + '.pb-box-red{background:#0D181E;border:1px solid var(--red);}'
      + '.pb-box-label{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:6px;}'
      + '.pb-box-title{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:7px;line-height:1.3;}'
      + '.pb-box-text{font-size:13px;color:var(--t2);line-height:1.7;}'
      + '.pb-tbl{width:100%;margin:0 0 8px;}'
      + '.pb-body .tbl-wrap{background:#0D181E;}'
      + '.pb-body .tbl th{background:#0D181E;}'
      + '.pb-cross-leak{font-weight:700;color:var(--t1);white-space:nowrap;}'
      + '.pb-cross td{vertical-align:middle;}'
      + '.pb-diag{border-left:2px solid var(--b-edge);padding:2px 0 2px 14px;margin:0 0 16px;}'
      + '.pb-diag-q{font-size:14px;font-weight:600;color:var(--t1);line-height:1.5;margin-bottom:8px;}'
      + '.pb-diag-n{color:var(--gold);font-weight:700;}'
      + '.pb-diag-a{font-size:12.5px;line-height:1.65;color:var(--t2);margin-top:5px;padding-left:2px;}'
      + '.pb-diag-a span{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.5px;margin-right:7px;padding:1px 6px;border-radius:3px;}'
      + '.pb-diag-yes span{color:var(--green);border:1px solid var(--green);}'
      + '.pb-diag-no span{color:var(--red);border:1px solid var(--red);}'
      + '.pb-parts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 18px;}'
      + '.pb-part{background:#0D181E;border:1px solid var(--b-edge);border-radius:var(--r);padding:14px 16px;}'
      + '.pb-part-label{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:3px;}'
      + '.pb-part-name{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:6px;}'
      + '.pb-part-desc{font-size:12.5px;color:var(--t2);line-height:1.6;margin-bottom:12px;}'
      + '.pb-gorow{margin:0 0 16px;}'
      + '.pb-docs{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 16px;}'
      + '.pb-go,.pb-docs a{justify-content:flex-start;white-space:normal;text-align:left;line-height:1.35;height:auto;}'
      + '.pb-footer{font-size:11px;color:var(--t3);line-height:1.7;border-top:1px solid var(--b2);padding-top:14px;margin-top:24px;max-width:780px;}'
      + '@media(max-width:900px){.pb-shell{flex-direction:column;}.pb-side{position:static;flex-basis:auto;width:100%;border-right:none;border-bottom:1px solid var(--b-edge);display:flex;flex-wrap:wrap;gap:2px;padding:10px 6px;}.pb-side-label{width:100%;}.pb-side-item{width:auto;border-left:none;border-radius:4px;padding:7px 12px;}.pb-main{padding:18px 16px 60px;}.pb-parts{grid-template-columns:1fr;}.pb-docs{flex-direction:column;}.pb-docs a,.pb-go{width:100%;}}'
      + '</style>';
  },

  // ── Content (Profit) ──────────────────────────────────────────────────────────
  CONTENT: {
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
            { t: 'box', tone: 'steel', label: 'Score your answers', title: 'Add up your Yes answers', text: '8 to 10 Yes: you are ahead of most bars. Use the system to formalize what works and close the rest. Even one No is costing you every month. 5 to 7 Yes: you have profitable holes. Add up the monthly figures next to your No answers. That number is what this is built to recover. 0 to 4 Yes: the system pays for itself in the first 30 days. Instinct and experience both have limits. A system does not.' },
            { t: 'box', tone: 'steel', label: 'Five things that are true about every bar', text: '1. Your POS does not catch theft. It records it. 2. A bartender who free-pours is not a bad employee, they are an untrained one in an uncontrolled system. 3. Every vendor assumes you are not checking the invoice, and most of the time they are right. 4. Prime cost is the only number that tells you if the whole machine is working. Every other metric is a piece of it. 5. The bar that controls its costs is not the most popular on the block. It is the one still open in year five.' }
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
                ['Total comp rate (all staff)', '1-2%', 'Above 3%', 'Above 5%', 'Check authorization. No comp without a manager signature.'],
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
            { t: 'p', text: 'The Void and Comp Log shows every void, comp, and no-sale by employee as a rate against their sales, so a bartender running triple the staff is visible by Wednesday. Cash Control reconciles every drawer against expected, and tracks overages as hard as shortages. Spot checks and Receive Delivery close the product and short-count holes. Loss Prevention scores the risk and is where an unexplained pour-cost variance lands.' },
            { t: 'go', label: 'Void and Comp Log', screen: 'sc-void-comp' },
            { t: 'go', label: 'Loss Prevention', screen: 'theft-risk' },
            { t: 'go', label: 'Theft and Loss system', screen: 'profit-fix', focus: 'theft-loss' },
            { t: 'h', text: 'Quick Reference' },
            { t: 'list', items: [
              'Every day: reconcile every drawer in Cash Control before it leaves the floor, and log every void, comp, and no-sale by employee.',
              'Every day: confirm the delivery inspection was done on anything received.',
              'Every week: review voids and comps by employee in Loss Prevention. Flag anyone over 3 percent of their sales.',
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
            { t: 'table',
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
    }
  }
};
