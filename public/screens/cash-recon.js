'use strict';

/* ── Profit Recovery — Cash Reconciliation (who/what is repeatedly off) ────────
   Cash is captured in Shift Control (Cash Drop + end-of-shift drawer counts) and
   flows here automatically. This is NOT the chronological log — Shift Control's
   Cash History is that. This is the DIAGNOSIS: every drawer count grouped by
   cashier and by register so a repeat-short pattern stands out, even when any
   one night looks minor. The clean split: Cash History = the log (when),
   Theft Risk = one cash signal (how bad), Cash Reconciliation = who/what to act
   on. Range chips + Export, to the standard. */

S.CashRecon = {
  filterPreset: 'last-4',
  _prevPreset: 'last-4',
  filterFrom: '',
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  // Honesty gate: a cashier/register is only ranked + flagged once it has enough
  // counts in range. Fewer reads "Not enough data" and never gets a status — we
  // don't brand a repeat-short off one or two nights. (Same spirit as Theft Risk.)
  MIN_COUNTS: 3,

  // Shared fixed column layout so By Cashier and By Register line up down the
  // page; the mobile hook (style.css) drops it and promotes the name to a card title.
  COLGROUP: '<colgroup><col style="width:24%"/><col style="width:12%"/><col style="width:12%"/><col style="width:20%"/><col style="width:16%"/><col style="width:16%"/></colgroup>',

  drops()     { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances() { return ((App.shiftData && App.shiftData.sc_variances) || []); },

  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },

  // Group counts by a key (cashier name or register name) → tally rows.
  aggregate(variances, keyFn) {
    const g = {};
    variances.forEach(v => {
      const k = (keyFn(v) || '').trim() || 'Unspecified';
      if (!g[k]) g[k] = { name: k, counts: 0, shorts: 0, net: 0 };
      g[k].counts++;
      g[k].net += (v.variance || 0);
      if (v.status === 'Short') g[k].shorts++;
    });
    return Object.values(g);
  },

  // Status tiers (meaning-only color): red = act, amber = early pattern,
  // green = spotless, neutral = fine, grey = not enough counts to judge.
  tierOf(counts, shorts) {
    if (counts < this.MIN_COUNTS) return { label: 'Not enough data', color: 'var(--t3)' };
    const rate = shorts / counts;
    if (rate >= 0.40) return { label: 'Repeat short', color: 'var(--red)' };
    if (rate >= 0.20) return { label: 'Watch', color: 'var(--amber)' };
    if (shorts === 0) return { label: 'Clean', color: 'var(--green)' };
    return { label: 'OK', color: 'var(--t1)' };
  },

  buildCard(heading, firstLabel, groups) {
    const MIN = this.MIN_COUNTS;
    const sorted = groups.slice().sort((a, b) => {
      const ga = a.counts >= MIN, gb = b.counts >= MIN;
      if (ga !== gb) return ga ? -1 : 1;                       // ranked entries first
      if (ga) {                                                // both ranked
        const ra = a.shorts / a.counts, rb = b.shorts / b.counts;
        if (rb !== ra) return rb - ra;                         // worst short rate first
        if (a.net !== b.net) return a.net - b.net;             // more negative net first
        return a.name.localeCompare(b.name);
      }
      if (b.counts !== a.counts) return b.counts - a.counts;   // thin: more counts first
      return a.name.localeCompare(b.name);
    });

    const rows = sorted.map(x => {
      const gated = x.counts >= MIN;
      const t = this.tierOf(x.counts, x.shorts);
      const netColor = x.net < 0 ? 'var(--red)' : x.net > 0 ? 'var(--amber)' : 'var(--t1)';
      const rate = gated ? Math.round((x.shorts / x.counts) * 100) + '%' : '<span style="color:var(--t3);">-</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(x.name) + '</div></td>'
        + '<td>' + x.counts + '</td>'
        + '<td>' + x.shorts + '</td>'
        + '<td style="color:' + netColor + ';font-weight:700;">' + (x.net > 0 ? '+' : '') + App.fmtCurrency(x.net) + '</td>'
        + '<td>' + rate + '</td>'
        + '<td style="color:' + t.color + ';font-weight:700;">' + t.label + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--t3);padding:12px 8px;">No drawer counts in this range. Pick a wider range above.</td></tr>';

    return (heading ? '<div class="sh" style="margin:22px 0 10px;">' + heading + '</div>' : '')
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl" style="table-layout:fixed;width:100%;min-width:560px;">'
      + this.COLGROUP
      + '<thead><tr><th>' + firstLabel + '</th><th>Counts</th><th>Short</th><th>Net Over / Short</th><th>Short Rate</th><th>Status</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div></div>';
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';   // header off; actions live in the page
    this.renderMain();
  },

  renderMain() {
    const allV = this.variances();
    const allD = this.drops();

    // Day-one / prerequisite: no cash captured yet → guide to Shift Control.
    if (!allV.length && !allD.length) {
      App.setupCard(this.container, {
        title: 'Over and Short',
        lead: 'Your drawer counts and cash drops flow here from Shift Control. Once a few shifts are reconciled, this shows which cashier and which register keep coming up short. Set up a register and run a shift to start the picture.',
        steps: [
          { title: 'Set up a register', desc: 'Add your registers in Shift Control so drawers can be counted.', btn: 'Set Up Registers', screen: 'sc-drawers', done: false },
          { title: 'Reconcile your drawers', desc: 'Count drawers and log over/short in Cash Control. Those land here.', btn: 'Go to Cash Control', screen: 'sc-cash-control', done: false }
        ]
      });
      this.container.onclick = ev => { const go = ev.target.closest('.setup-go'); if (go && go.dataset.go) App.openScreen(go.dataset.go); };
      return;
    }

    const { from, to } = this.effectiveRange();
    const inR = dt => { const ds = dt ? String(dt).slice(0, 10) : ''; return (!from || ds >= from) && (!to || ds <= to); };
    const variances = allV.filter(v => inR(v.date));
    const drops = allD.filter(d => inR(d.date));

    // ── Stat strip (reflects the selected range) ──
    const counts    = variances.length;
    const shorts    = variances.filter(v => v.status === 'Short').length;
    const flagged   = variances.filter(v => v.status === 'Short' || v.status === 'Over').length;
    const netVar    = variances.reduce((t, v) => t + (v.variance || 0), 0);
    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const shortRate = counts ? Math.round((shorts / counts) * 100) + '%' : '-';
    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Net Over / Short', (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar), netVar < 0 ? 'warn' : '')
      + stat('Out of Tolerance', String(flagged), flagged ? 'warn' : '')
      + stat('Short Rate', shortRate)
      + stat('Cash Dropped', App.fmtCurrency(dropTotal))
      + '</div></div>';

    // ── Filter row (chips left, Export right) ──
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'cr-range-chip');
    const filterRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="cr-export">Export PDF</button></div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input class="form-input" type="date" id="cr-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input class="form-input" type="date" id="cr-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';

    // ── By Cashier + By Register (ranked worst-first by short rate) ──
    const byCashier  = this.buildCard('',  'Cashier',  this.aggregate(variances, v => v.cashier));
    const byRegister = this.buildCard('By Register', 'Register', this.aggregate(variances, v => v.drawer));

    this.container.innerHTML = '<div class="screen">' + statStrip + filterRow + custom + byCashier + byRegister + '</div>';

    this.container.querySelectorAll('.cr-range-chip').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (v === 'custom') {
        if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
        else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
      } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
      this.renderMain();
    }));
    document.getElementById('cr-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderMain(); });
    document.getElementById('cr-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.renderMain(); });
    document.getElementById('cr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Over and Short', root: this.container }));
  },

  showHowTo() {
    App.showHelpModal('How Over and Short Works', [
      { p: ['This finds who and what is repeatedly coming up short. Every drawer count you reconcile in Shift Control flows here automatically and gets grouped by cashier and by register, so a pattern stands out even when any single night looks minor. No double entry.'] },
      { h: 'By Cashier and By Register', p: ['Each row is one cashier or one register over the range you pick: how many drawer counts ran, how many came up short, the net over or short for the period, and the short rate (times short divided by counts). Both lists rank worst first.'] },
      { h: 'Reading the Status', p: ['Repeat short (red) means it comes up short often enough to act on. Watch (amber) is an early pattern worth keeping an eye on. Clean (green) is a spotless range. OK is fine. A cashier or register with only a couple of counts reads Not enough data and is never flagged, so nobody gets branded off one or two nights.'] },
      { h: 'How This Differs From Cash History', p: ['Cash History in Shift Control is the log, every count in the order it happened. This is the diagnosis on top of it: who and what to look at. A repeat cash short here is also one of the live signals on Loss Prevention.'] },
      { h: 'Filter and Export', p: ['The range chips pull a stretch of activity and the numbers up top reflect the range you pick. Export PDF saves it for your records or your bookkeeper.'] }
    ]);
  }
};
