'use strict';

/* ── Cash Recovery — Cash Audit ───────────────────────────────────────────────
   The weekly cash-health score on the shared AuditUI shell, identical in layout
   to the Profit/Revenue audits. The one difference is honest by necessity: those
   score on the server; Cash scores CLIENT-side off CashEngine, because the cash
   math lives here and duplicating it on the server would be a place for the
   numbers to drift. Four sections: Inventory Capital, Purchasing Discipline, Cash
   Position, Payment Terms. The opportunity hero is "Cash to Free", a one-time
   amount, so it does NOT use the shared monthly-times-twelve strip, which would
   misstate it. Reads CashEngine; stores in cash_audits. */

S.CashAudit = {
  SECTION_NAMES: ['Inventory Capital', 'Purchasing Discipline', 'Cash Position', 'Payment Terms'],

  audits() { return (App.data.cash_audits || []).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)); },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    this.actions.innerHTML = '';
    const audits = this.audits();
    const latest = audits[0] || null;
    const daysSince = latest && latest.date ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const canRun = daysSince >= 7;
    const daysLeft = canRun ? 0 : 7 - daysSince;
    const desc = 'A weekly read on your cash health: how much capital is trapped on the shelf, how disciplined your buying is, whether the weeks ahead are tight, and if you are holding your vendor terms. It reads straight off your counts, orders, and bills, nothing to type.';
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.requestCard('ca', 'Cash Audit', desc, canRun, !!latest, daysLeft, { lockedNoInputs: true })
      + (latest ? AuditUI.landingCard(latest, audits[1], this.SECTION_NAMES, 'ca') : AuditUI.emptyState())
      + (audits.length > 1 ? AuditUI.historyCard(audits, 'cash_audit', 'ca', { hideGrade: true }) : '')
      + '</div>';
    document.getElementById('ca-new-btn')?.addEventListener('click', () => this.showIntake());
    this.container.querySelectorAll('.ca-view-btn').forEach(btn => btn.addEventListener('click', () => this.viewAudit(parseInt(btn.dataset.idx))));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.renderMain()));
  },

  showIntake() {
    this.actions.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'btn btn-ghost btn-sm'; back.textContent = '← Back'; back.style.marginRight = '8px';
    back.onclick = () => this.renderMain();
    this.actions.appendChild(back);

    const counts = CashEngine.countsAsc().length;
    const orders = ((App.inventoryData && App.inventoryData.ic_orders) || []).length;
    const bills = CashEngine.bills().length;
    const terms = CashEngine.termVendors().length;
    const checks = [
      { label: counts + ' inventory count' + (counts === 1 ? '' : 's'), ok: counts > 0 },
      { label: 'Orders and deliveries', ok: orders > 0 },
      { label: bills + ' bill' + (bills === 1 ? '' : 's') + ' in Books', ok: bills > 0 },
      { label: terms + ' vendor' + (terms === 1 ? '' : 's') + ' on terms', ok: terms > 0 }
    ];
    this.container.innerHTML = '<div class="screen">'
      + AuditUI.formCard('Generate Your Cash Audit',
          AuditUI.intakeHasBlock('What Bar Cop Reads', 'The Cash Audit scores off the data you already keep. Nothing to enter; the more current your counts, the sharper it reads.', checks))
      + AuditUI.intakeSubmit('ca')
      + '</div>';
    document.getElementById('ca-iz-submit')?.addEventListener('click', () => this.generate());
  },

  async generate() {
    if (App.demoBlock && App.demoBlock('Running an audit')) return;
    const btn = document.getElementById('ca-iz-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    const record = this._computeAudit();
    await App.putRecord('core', 'cash_audit', record);
    if (App.markSetupDone) App.markSetupDone('gs_c_audit');
    this.renderMain();
    setTimeout(() => this.viewAudit(0), 100);
  },

  // ── Client-side scoring, honest by construction (reads the same CashEngine the
  //    cash screens show). Each section null when there is no basis yet. ────────
  _computeAudit() {
    const trapped = CashEngine.trapped();
    const over = CashEngine.overOrder(3);
    const fc = CashEngine.forecast(4);
    const tv = CashEngine.termVendors();
    const totalV = CashEngine.vendors().length;
    const invValue = CashEngine.onHand().value;
    const tight = fc.filter(r => r.net < 0).length;
    const thisWeekNet = fc.length ? fc[0].net : 0;
    const fourNet = fc.reduce((s, r) => s + r.net, 0);
    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

    let s1 = null;
    if (trapped.hasData && invValue > 0) s1 = clamp(100 - (trapped.total / invValue) * 250);
    let s2 = null;
    if (over.hasData && over.weeksOnHand != null) s2 = clamp(100 - Math.max(0, over.weeksOnHand - over.targetWeeks) * 20);
    const s3 = clamp(100 - tight * 25);
    const s4 = totalV > 0 ? clamp(tv.length / totalV * 100) : null;

    const names = this.SECTION_NAMES;
    const sections = {};
    [s1, s2, s3, s4].forEach((v, i) => { if (v != null) sections[names[i]] = v; });
    const vals = [s1, s2, s3, s4].filter(v => v != null);
    const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const cashToFree = trapped.total + (over.excess || 0);

    const ai = [];
    if (trapped.hasData && trapped.total > 0) ai.push({ s: s1, action: 'Free ' + App.fmtCurrency(trapped.total) + ' trapped on your shelves: ' + App.fmtCurrency(trapped.dead) + ' in dead stock, ' + App.fmtCurrency(trapped.overPar) + ' above par.', gap_id: 'free-trapped' });
    if (over.hasData && over.excess > 0) ai.push({ s: s2, action: 'You are carrying ' + over.weeksOnHand.toFixed(1) + ' weeks of inventory. Order to par to free about ' + App.fmtCurrency(over.excess) + '.', gap_id: 'order-to-par' });
    if (tight > 0) ai.push({ s: s3, action: tight + ' tight week' + (tight === 1 ? '' : 's') + ' in the next four. Move a payment or hold an order to cover it.', gap_id: 'stay-ahead' });
    if (totalV > 0 && tv.length < totalV) ai.push({ s: s4, action: 'Set payment terms on the ' + (totalV - tv.length) + ' vendor' + ((totalV - tv.length) === 1 ? '' : 's') + ' without them, so you stop paying early.', gap_id: 'pay-on-terms' });
    ai.sort((a, b) => (a.s == null ? 100 : a.s) - (b.s == null ? 100 : b.s));
    const action_items = ai.map(x => ({ action: x.action, gap_id: x.gap_id }));

    const cur = v => App.fmtCurrency(v);
    const raw = {
      TRAPPED_CASH: trapped.total, INVENTORY_VALUE: invValue, DEAD_STOCK: trapped.dead, OVERSTOCK: trapped.overPar,
      WEEKS_ON_HAND: over.weeksOnHand, TARGET_WEEKS: over.targetWeeks, EXCESS_CASH: over.excess,
      TIGHT_WEEKS: tight, THIS_WEEK_NET: thisWeekNet, FOUR_WEEK_NET: fourNet,
      VENDORS_ON_TERMS: tv.length, TOTAL_VENDORS: totalV,
      S1_FINDING: s1 == null ? '' : (trapped.total > 0 ? 'You have ' + cur(trapped.total) + ' of your shelf cash frozen in stock that is not moving or sitting above par. Freeing it puts real money back in the account.' : 'Almost none of your shelf cash is trapped. Your inventory is working.'),
      S2_FINDING: s2 == null ? '' : (over.excess > 0 ? 'You are carrying ' + over.weeksOnHand.toFixed(1) + ' weeks of inventory against a ' + over.targetWeeks + '-week target, about ' + cur(over.excess) + ' tied up beyond what you use.' : 'Your buying is tight, right in line with your usage.'),
      S3_FINDING: tight > 0 ? tight + ' of the next four weeks have more cash going out than coming in. Catch them on the forecast and move a payment or hold an order before they land.' : 'No tight weeks in the next four. Your cash timing looks clear.',
      S4_FINDING: s4 == null ? '' : (tv.length < totalV ? tv.length + ' of ' + totalV + ' vendors are on terms. Set terms on the rest and hold every bill to its due date to keep your float.' : 'Every vendor is on terms. Hold each bill to its due date to keep the float yours.')
    };

    return {
      id: App.uid(),
      date: App.todayLocal(),
      bar_name: App.data.settings.bar_name,
      overall_score: overall,
      grade: '',
      audit_period: 'As of ' + App.todayLocal(),
      audit_id: 'CA-' + (this.audits().length + 1),
      sections, action_items, cash_to_free: cashToFree, raw,
      generated_at: new Date().toISOString()
    };
  },

  viewAudit(idx) {
    const audit = this.audits()[idx];
    if (!audit) return;
    this.actions.innerHTML = '';
    const back = document.createElement('button'); back.className = 'btn btn-ghost btn-sm'; back.textContent = '← Back'; back.style.marginRight = '8px'; back.onclick = () => this.renderMain(); this.actions.appendChild(back);
    const pr = document.createElement('button'); pr.className = 'btn btn-ghost btn-sm'; pr.textContent = 'Print / Save PDF'; pr.onclick = () => this.exportPDF(audit); this.actions.appendChild(pr);

    const d = audit.raw || {};
    const sx = audit.sections || {};
    const cur = v => v != null && v !== 0 ? App.fmtCurrency(v) : '';
    const signed = v => v != null ? (v < 0 ? '-' : '+') + App.fmtCurrency(Math.abs(v)) : '';
    const N = this.SECTION_NAMES;
    const sections = [
      AuditUI.sectionBlock(1, N[0], sx[N[0]], [
        ['Trapped Cash', cur(d.TRAPPED_CASH), d.TRAPPED_CASH > 0 ? 'warn' : 'good'],
        ['In Dead Stock', cur(d.DEAD_STOCK), d.DEAD_STOCK > 0 ? 'warn' : ''],
        ['Above Par', cur(d.OVERSTOCK), d.OVERSTOCK > 0 ? 'warn' : ''],
        ['Inventory Value', cur(d.INVENTORY_VALUE)]
      ], null, d),
      AuditUI.sectionBlock(2, N[1], sx[N[1]], [
        ['Weeks On Hand', d.WEEKS_ON_HAND != null ? d.WEEKS_ON_HAND.toFixed(1) + 'w' : '', (d.WEEKS_ON_HAND != null && d.WEEKS_ON_HAND > d.TARGET_WEEKS) ? 'warn' : 'good'],
        ['Target', d.TARGET_WEEKS != null ? d.TARGET_WEEKS + 'w' : ''],
        ['Tied Beyond Target', cur(d.EXCESS_CASH), d.EXCESS_CASH > 0 ? 'warn' : '']
      ], null, d),
      AuditUI.sectionBlock(3, N[2], sx[N[2]], [
        ['Tight Weeks Ahead', d.TIGHT_WEEKS != null ? String(d.TIGHT_WEEKS) : '', d.TIGHT_WEEKS > 0 ? 'warn' : 'good'],
        ['This Week Net', signed(d.THIS_WEEK_NET), d.THIS_WEEK_NET < 0 ? 'warn' : ''],
        ['Four-Week Net', signed(d.FOUR_WEEK_NET), d.FOUR_WEEK_NET < 0 ? 'warn' : '']
      ], null, d),
      AuditUI.sectionBlock(4, N[3], sx[N[3]], [
        ['Vendors On Terms', d.TOTAL_VENDORS ? d.VENDORS_ON_TERMS + ' of ' + d.TOTAL_VENDORS : '', (d.TOTAL_VENDORS && d.VENDORS_ON_TERMS < d.TOTAL_VENDORS) ? 'warn' : 'good']
      ], null, d)
    ].join('');

    this.container.innerHTML = '<div class="screen">'
      + AuditUI.viewHero(audit, 'Cash Recovery Audit', 'ca')
      + this.cashStrip(audit)
      + AuditUI.actionsArea(audit, 'cash', 'ca')
      + sections
      + '</div>';

    AuditUI.attachOutlook('ca', audit, 'cash');
    this.container.querySelector('.ca-export-btn')?.addEventListener('click', () => this.exportPDF(audit));
    this.container.querySelectorAll('.ca-fix-btn').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = btn.dataset.gap; App.navigate('c-fix'); }));
  },

  // The opportunity hero: Cash to Free is a ONE-TIME amount, never annualized.
  cashStrip(audit) {
    const d = audit.raw || {};
    const calc = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + calc('Cash to Free', App.fmtCurrency(audit.cash_to_free || 0), 'good')
      + calc('Weeks On Hand', d.WEEKS_ON_HAND != null ? d.WEEKS_ON_HAND.toFixed(1) + 'w' : '-')
      + calc('Tight Weeks', String(d.TIGHT_WEEKS || 0), d.TIGHT_WEEKS > 0 ? 'warn' : '')
      + '</div></div>';
  },

  async exportPDF(audit) {
    if (!audit) return;
    try { await App._ensurePDFLib(); } catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const d = audit.raw || {};
    const b = App._pdfBuilder('Cash Recovery Audit');
    b.header({ right: 'Cash Recovery Audit' });
    b.paragraph((audit.bar_name || 'Your Bar') + '  |  ' + (audit.date || '') + '  |  Overall ' + (audit.overall_score != null ? audit.overall_score : 'N/A'), { gray: 55 });
    if (audit.cash_to_free > 0) { b.spacer(4); b.heading('Cash to Free: ' + App.fmtCurrency(audit.cash_to_free), 13); }
    if ((audit.action_items || []).length) { b.spacer(4); b.sectionTitle('Action Items'); audit.action_items.forEach((a, i) => b.paragraph((i + 1) + '. ' + a.action, { gray: 55 })); }
    this.SECTION_NAMES.forEach((nm, i) => {
      b.spacer(4); b.sectionTitle('Section ' + (i + 1));
      b.heading(nm + '  (' + (audit.sections[nm] != null ? audit.sections[nm] : 'N/A') + ')', 12);
      const f = d['S' + (i + 1) + '_FINDING']; if (f) b.paragraph(f, { gray: 55 });
    });
    const f = App.deliverableFooter();
    b.disclaimer(f.workbookSubject);
    const venue = (App.data && App.data.settings && App.data.settings.bar_name) || 'Bar Cop';
    await b.save(venue + ' - Cash Recovery Audit - ' + (audit.date || ''));
  },

  showHowTo() {
    App.showHelpModal('How the Cash Audit Works', [
      { p: ['The Cash Audit is a weekly score on your cash health, from 0 to 100, with a breakdown across the four things that decide whether a profitable bar runs flush or tight. It reads straight off your counts, orders, and bills, so there is nothing to type.'] },
      { h: 'The Four Sections', p: ['Inventory Capital is how much of your shelf cash is working versus frozen in dead stock and overstock. Purchasing Discipline is how many weeks of inventory you carry against what you use. Cash Position is whether the weeks ahead are tight. Payment Terms is whether you are holding your vendor terms instead of paying early.'] },
      { h: 'Cash to Free', p: ['The opportunity number up top is the cash you can free right now, the trapped inventory plus the overstock beyond par. It is a one-time amount you can put back in the account, not a monthly figure, so Bar Cop shows it as exactly that.'] },
      { h: 'Action Items', p: ['Each audit ranks what to work first by where you are weakest, and every Fix This button drops you straight into that Cash Fix system. Run it weekly and watch the score climb as you free the cash.'] }
    ]);
  }
};
