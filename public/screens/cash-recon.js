'use strict';

/* ── Profit Recovery — Cash Reconciliation (read-only view) ───────────────────
   Cash is captured in Shift Control (Cash Drop + drawer reconciliation) and
   flows here automatically — no manual entry. This is the Profit read-out of
   sc_cash_drops + sc_variances: the over/short picture, what is out of
   tolerance, and what feeds Theft Risk. Range chips + Export, to the standard. */

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

  drops()     { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances() { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  tolerance(shift) { return App.cashToleranceForShift(shift || null); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  // Cash status color scheme (locked): within = green, short = red, over = amber,
  // anything else (not counted) = grey. Same scheme as Shift Cash Control.
  statusColor(st) {
    return st === 'Within Tolerance' ? 'var(--green)' : st === 'Short' ? 'var(--red)' : st === 'Over' ? 'var(--amber)' : 'var(--t3)';
  },

  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
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
        title: 'Cash Reconciliation',
        lead: 'Your cash drops and end-of-shift drawer counts flow here from Shift Control. Set up a register and run a shift to start seeing your over/short picture.',
        steps: [
          { title: 'Set up a register', desc: 'Add your registers in Shift Control so drawers can be counted.', btn: 'Set Up Registers', screen: 'sc-drawers', done: false },
          { title: 'Run and reconcile a shift', desc: 'Open the floor, drop cash, and reconcile drawers at close. Those land here.', btn: 'Open the Floor', screen: 'sc-active-shift', done: false }
        ]
      });
      this.container.onclick = ev => { const go = ev.target.closest('.setup-go'); if (go && go.dataset.go) App.openScreen(go.dataset.go); };
      return;
    }

    const { from, to } = this.effectiveRange();
    const inR = dt => { const ds = dt ? String(dt).slice(0, 10) : ''; return (!from || ds >= from) && (!to || ds <= to); };
    const byDate = (a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
    const variances = allV.filter(v => inR(v.date)).sort(byDate);
    const drops = allD.filter(d => inR(d.date)).sort(byDate);

    // ── Stat strip (reflects the selected range) ──
    const netVar    = variances.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged   = variances.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Variances Logged', String(variances.length))
      + stat('Net Over / Short', (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar), netVar < 0 ? 'warn' : '')
      + stat('Out of Tolerance', String(flagged), flagged ? 'warn' : '')
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

    // ── Cash Variances ──
    const vRows = variances.map(v => {
      const vr = v.variance || 0;
      const color = this.statusColor(v.status);
      return '<tr><td><div class="val">' + this.fmtDate(v.date) + '</div></td>'
        + '<td>' + esc(v.shift_type || '-') + '</td>'
        + '<td>' + esc(v.drawer || '-') + '</td>'
        + '<td>' + esc(v.cashier || '-') + '</td>'
        + '<td>' + App.fmtCurrency(v.expected_cash || 0) + '</td>'
        + '<td>' + App.fmtCurrency(v.counted_cash || 0) + '</td>'
        + '<td style="color:' + color + ';font-weight:700;">' + (vr > 0 ? '+' : '') + App.fmtCurrency(vr) + '</td>'
        + '<td style="color:' + color + ';font-weight:700;">' + esc(v.status || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="8" style="color:var(--t3);padding:12px 8px;">No cash variances in this range. Pick a wider range above.</td></tr>';
    const varCard = '<div class="sh" style="margin:22px 0 10px;">Cash Variances</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Cashier</th><th>Expected</th><th>Counted</th><th>Over/Short</th><th>Status</th>'
      + '</tr></thead><tbody>' + vRows + '</tbody></table></div></div>';

    // ── Cash Drops ──
    const dRows = drops.map(d => '<tr><td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
      + '<td>' + esc(d.shift_type || '-') + '</td>'
      + '<td>' + esc(d.drawer || '-') + '</td>'
      + '<td>' + esc(d.performed_by || '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td></tr>').join('')
      || '<tr><td colspan="5" style="color:var(--t3);padding:12px 8px;">No cash drops in this range. Pick a wider range above.</td></tr>';
    const dropCard = '<div class="sh" style="margin:22px 0 10px;">Cash Drops</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Performed By</th><th>Amount</th>'
      + '</tr></thead><tbody>' + dRows + '</tbody></table></div></div>';

    this.container.innerHTML = '<div class="screen">' + statStrip + filterRow + custom + varCard + dropCard + '</div>';

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
    document.getElementById('cr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Cash Reconciliation', root: this.container }));
  },

  showHowTo() {
    App.showHelpModal('How Cash Reconciliation Works', [
      { p: ['A read-only view of your cash. The drops and end-of-shift drawer counts you log in Shift Control flow here automatically, no double entry, so you can see your over/short picture and catch a drawer that keeps coming up light.'] },
      { h: 'Over / Short and Tolerance', p: ['Each drawer count compares counted cash against expected. Anything beyond your tolerance, set in Shift Control under Shift Policies, is flagged. Within tolerance reads green, Short red, Over amber.'] },
      { h: 'What It Feeds', p: ['Repeated shortages from the same drawer or cashier feed the Theft Risk scorecard, so a pattern surfaces there even when any one night looks minor.'] },
      { h: 'Filter and Export', p: ['The range chips pull a stretch of activity and the numbers up top reflect the range you pick. Export PDF saves it for your records or your bookkeeper.'] }
    ]);
  }
};
