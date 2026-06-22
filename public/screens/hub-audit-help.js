'use strict';

/* ── Bar Cop Audit — Help and FAQ ─────────────────────────────────────────────
   The Audit section's knowledge layer, same underline tab switcher + live
   search as the Control / Recovery / Events help pages. Per-page how-tos live on
   each page's info "i" panel; this covers the why: what the audit measures, the
   rhythm, and how it relates to the recovery audits. Hub-shell screen, opens
   with the Bar Cop Audit sidebar. */

S.HubAuditHelp = {
  tab: 0,
  query: '',

  open() {
    App.openHubFullPage('Bar Cop Audit Help', (mount) => {
      this.container = mount; this.tab = 0; this.query = ''; this.draw();
    }, 'audit-help');
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What is the Bar Cop Audit?',
        a: 'It is your weekly read on how well the whole operation is being run, scored from the data you already log across Inventory, Labor, and Shift Control. It answers a different question than the recovery audits. Profit, Revenue, and Traffic tell you where money is leaking and how to fix it. The Bar Cop Audit tells you whether the operation has discipline: are procedures followed, is cash tight, is inventory under control, are you acting on what Bar Cop surfaced.' },
      { q: 'How often do I run it?',
        a: 'Once a week, the same rhythm as the recovery audits. Between runs the page counts down to the next one. It scores your trailing 30 days, so the window stays wide enough for each measure to mean something while you still get a fresh read every week.' },
      { q: 'Do I have to enter anything to run it?',
        a: 'No. The Bar Cop Audit reads entirely from your Control systems, so there is nothing to upload. Log your counts, shifts, cash, schedules, and hours as normal and the audit scores what it can. Anything without enough behind it shows Not Enough Data instead of guessing.' }
    ]},
    { t: 'The Score', qa: [
      { q: 'What are the six sub-scores?',
        a: 'Operational Discipline (are daily and weekly procedures getting done), Cash Integrity (variance trend, drawer counts, large void and comp authorization), Inventory Execution (count cadence and discrepancy resolution), Labor Hygiene (schedule adherence, callouts, overtime, certifications), Recovery Action (are you acting on the gaps your audits surfaced), and Operational Consistency (how steady your weekly numbers are). Each is built only from real records.' },
      { q: 'Why does a sub-score say Not Enough Data?',
        a: 'Because that area does not have enough logged behind it to score honestly yet. One signal is not enough to claim a confident number, so the sub-score stays Not Enough Data and drops out of the overall until the data fills in. It is the honest answer, not a failing grade. Keep logging and it fills in.' },
      { q: 'How is the overall score figured?',
        a: 'It averages only the sub-scores that actually have data, and it needs at least three of the six covered before it shows an overall at all. A score off one or two thin signals would say almost nothing, so Bar Cop holds the overall until it can stand behind it.' }
    ]},
    { t: 'The Recovery Audits', qa: [
      { q: 'How is this different from my Profit, Revenue, and Traffic audits?',
        a: 'Those three are diagnostic: each scores its own area and hands you a Fix System to recover the money. The Bar Cop Audit sits above them as the operational read. The sidebar links to all three so you can reach them in one place, but each opens in its own Recovery section right next to its Fix System, where the work happens.' },
      { q: 'Does running a recovery audit affect my Bar Cop Audit?',
        a: 'Yes. Running your recovery audits on time and acting on what they surface both feed the Bar Cop Audit, through the Recovery Action and Operational Discipline sub-scores. An operation that diagnoses and fixes scores higher than one that lets gaps sit.' }
    ]},
    { t: 'History', qa: [
      { q: 'Where do past audits go?',
        a: 'Every Bar Cop Audit is kept. The Audit History page in the sidebar lists them newest first, and View opens the full detail of any past one so you can see how a score moved and what was flagged at the time.' },
      { q: 'What does the score trend tell me?',
        a: 'Whether the operation is tightening up or slipping. One audit is a snapshot; a line of them is the real story, which is why the weekly rhythm matters. A steady climb means your procedures are sticking. A drop is an early warning before it shows up in the money.' }
    ]}
  ],

  draw() {
    const search = '<div class="f" style="max-width:420px;margin-bottom:8px;">'
      + '<input type="text" id="help-search" placeholder="Search Audit help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
    const tabs = '<div class="ch-tabs no-print">'
      + this.SECTIONS.map((s, i) => '<button class="ch-tab' + (this.tab === i ? ' on' : '') + '" data-tab="' + i + '">' + esc(s.t) + '</button>').join('')
      + '</div>';
    this.container.innerHTML = '<div class="screen">' + search + tabs + '<div id="help-body">' + this.bodyHtml() + '</div></div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.wire();
  },

  bodyHtml() {
    const q = this.query.trim().toLowerCase();
    if (q) {
      const matches = [];
      this.SECTIONS.forEach(sec => sec.qa.forEach(item => {
        if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) matches.push({ topic: sec.t, q: item.q, a: item.a });
      }));
      if (!matches.length) return '<div style="padding:18px 2px;color:var(--t3);font-size:13px;">No help topics match that search. Try a different word.</div>';
      return matches.map(m => this.qaHtml(m.q, m.a, m.topic)).join('');
    }
    const sec = this.SECTIONS[this.tab] || this.SECTIONS[0];
    return sec.qa.map(item => this.qaHtml(item.q, item.a)).join('');
  },

  qaHtml(q, a, topic) {
    return '<div style="border-bottom:1px solid var(--b2);padding:16px 0;">'
      + (topic ? '<div class="sh" style="margin-bottom:7px;">' + esc(topic) + '</div>' : '')
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:7px;">' + esc(q) + '</div>'
      + '<div style="font-size:12.5px;color:var(--t2);line-height:1.7;">' + esc(a) + '</div>'
      + '</div>';
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = parseInt(tab.dataset.tab, 10) || 0; this.query = ''; this.draw(); }
    };
    const search = document.getElementById('help-search');
    if (search) search.addEventListener('input', e => {
      this.query = e.target.value || '';
      const body = document.getElementById('help-body');
      if (body) body.innerHTML = this.bodyHtml();
    });
  }
};
