'use strict';

/* ── Week Review — the whole week on one page (Books section, Hub-level) ───────
   The output side of Close the Week: after the data is in, this rolls every
   section's headline numbers for one closed week into a single scannable page,
   broken down by Inventory, Labor, Shift, Profit, Revenue, Cash, Events, Books,
   and Audits. Numbers come straight from the confirmed-week records
   (App.data.weeks = the profit rollup, App.data.revenue_weeks = the revenue
   rollup) so nothing is re-derived or projected. A week with no data reads
   "Not closed" rather than a fake zero. Sidebar page, so it uses a plain top
   stats strip (not the landing-only Where You Stand card), matching Break-Even.
   Opened from the Books sidebar (under Break-Even). Export PDF, like the other
   Books reports. */

S.WeekReview = {
  container: null,
  _wkIdx: 0,   // 0 = most recent closed week; higher = older

  open() {
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
    App.openHubFullPage('Week Review', (mount) => { this.container = mount; this.render(mount); }, 'week-review');
  },

  // ── Shared primitives (mirror Break-Even's current style) ──────────────────
  _statItem(label, val, colorStyle) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg"' + (colorStyle ? ' style="' + colorStyle + '"' : '') + '>' + val + '</div></div>';
  },
  _statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  _sh(t, right) {
    return right
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">' + t + '</div>' + right + '</div>'
      : '<div class="sh" style="margin:24px 0 10px;">' + t + '</div>';
  },
  // A section block: heading with an "Open" link on the right, then its stats.
  _section(title, openOnclick, items, note) {
    const btn = '<button class="btn btn-ghost btn-sm no-print" onclick="' + openOnclick + '">Open ' + esc(title) + ' &rsaquo;</button>';
    return this._sh(title, btn) + this._statsCard(items)
      + (note ? '<div style="font-size:11px;color:var(--t3);margin:6px 2px 0;">' + note + '</div>' : '');
  },

  // ── Week data ──────────────────────────────────────────────────────────────
  // Confirmed profit weeks, newest first. This is the backbone (bar/food revenue,
  // cogs, labor, cost %, prime, variance).
  _weeks() {
    return (((App.data && App.data.weeks) || []).slice())
      .filter(w => w && w.period_end)
      .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
  },
  // The revenue-side rollup for the same week (covers, check avg, labor %, RPLH).
  _revWeekFor(periodEnd) {
    return ((App.data && App.data.revenue_weeks) || []).find(w => w && w.period_end === periodEnd) || null;
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    const weeks = this._weeks();

    if (!weeks.length) {
      App.setupCard(mount, {
        title: 'Week Review',
        lead: 'Week Review rolls your whole week onto one page once the data is in, broken down by every section. Close a week first and it lands here.',
        steps: [{ title: 'Close a week', desc: 'Confirm a week in any Recovery section and Bar Cop rolls the numbers up here.', btn: 'Close The Week', screen: 'dashboard', done: false }]
      });
      return;
    }

    if (this._wkIdx > weeks.length - 1) this._wkIdx = weeks.length - 1;
    if (this._wkIdx < 0) this._wkIdx = 0;
    const w  = weeks[this._wkIdx];
    const rw = this._revWeekFor(w.period_end);

    const f  = v => App.fmtCurrency(v, 0);
    const f2 = v => App.fmtCurrency(v);
    const pct = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';

    // ── Week selector pill (one pill, arrows outside, This Week when off-latest) ─
    const ws = App.weekStartFor ? App.weekStartFor(w.period_end) : null;
    const label = (App.dateRangeLabel && ws) ? App.dateRangeLabel(ws, w.period_end).toUpperCase()
                 : ('WEEK ENDING ' + String(w.period_end).slice(0, 10));
    const isLatest = this._wkIdx === 0;
    const canOlder = this._wkIdx < weeks.length - 1;
    const arrow = (dir, live) => live
      ? '<span class="wr-arrow" data-step="' + dir + '" style="cursor:pointer;color:var(--t2);font-size:20px;padding:0 4px;user-select:none;">' + (dir < 0 ? '&lsaquo;' : '&rsaquo;') + '</span>'
      : '<span style="color:var(--t4);font-size:20px;padding:0 4px;user-select:none;">' + (dir < 0 ? '&lsaquo;' : '&rsaquo;') + '</span>';
    const pill = '<div style="display:inline-flex;align-items:center;background:var(--sel-active-bg);border:1px solid var(--b-edge);border-radius:6px;padding:6px 14px;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:600;letter-spacing:0.5px;color:var(--t1);">' + esc(label) + '</span>'
      + (isLatest ? '<span style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:var(--gold);margin-left:6px;">NOW</span>' : '')
      + '</div>';
    const selector = '<div class="no-print" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:18px;">'
      + arrow(-1, canOlder) + pill + arrow(1, !isLatest)
      + (!isLatest ? '<button class="btn btn-ghost btn-sm wr-now" style="margin-left:8px;">This Week</button>' : '')
      + '</div>';

    // ── Numbers off the confirmed week ─────────────────────────────────────────
    const bar = w.bar || {}, food = w.food || {}, cat = w.catering || {}, oth = w.other || {};
    const netSales = (bar.revenue || 0) + (food.revenue || 0) + (cat.revenue || 0) + (oth.revenue || 0);
    const cogs     = (bar.cogs || 0) + (food.cogs || 0) + (cat.cogs || 0) + (oth.cogs || 0);
    const laborCost = rw ? (rw.total_labor_cost || 0) : ((bar.labor || 0) + (food.labor || 0));
    const laborPct = rw && rw.labor_pct_blended != null ? rw.labor_pct_blended
                    : (netSales > 0 ? ((bar.labor || 0) + (food.labor || 0)) / netSales * 100 : null);
    const covers   = rw ? rw.covers : null;
    const checkAvg = rw ? rw.check_avg : null;
    const overTgt  = Math.max(0, bar.vs_target_dollar || 0) + Math.max(0, food.vs_target_dollar || 0);
    const varDollar = Array.isArray(w.bar_variance)
      ? w.bar_variance.reduce((s, v) => s + Math.abs(v && v.variance_dollar || 0), 0) : null;

    // ── Header strip: the week at a glance ─────────────────────────────────────
    const strip = this._statsCard(
        this._statItem('Net Sales', f(netSales))
      + this._statItem('Prime Cost', pct(w.prime_cost_pct))
      + this._statItem('Labor', pct(laborPct))
      + this._statItem('Covers', covers != null ? String(covers) : '-')
    );

    // ── Section cards (deep-link into each section) ────────────────────────────
    const go = (screen, mod) => "S.Hub._enter('" + screen + "','" + mod + "')";

    const inventory = this._section('Inventory', go('ic-dashboard', 'inventory'),
        this._statItem('Product Used', f(cogs))
      + this._statItem('Bar Pour Cost', pct(bar.cost_pct))
      + this._statItem('Food Cost', pct(food.cost_pct))
      + this._statItem('Pour Variance', varDollar != null ? f2(varDollar) : '-'));

    const labor = this._section('Labor', go('lc-dashboard', 'labor'),
        this._statItem('Labor Cost', f(laborCost))
      + this._statItem('Hours', rw && rw.total_hours != null ? String(rw.total_hours) : '-')
      + this._statItem('Labor %', pct(laborPct))
      + this._statItem('Rev / Labor Hr', rw && rw.rplh_blended != null ? f2(rw.rplh_blended) : '-'));

    const shift = this._section('Shift', go('sc-dashboard', 'shift'),
        this._statItem('Net Sales', f(netSales))
      + this._statItem('Covers', covers != null ? String(covers) : '-')
      + this._statItem('Check Average', checkAvg != null ? f2(checkAvg) : '-'));

    const profit = this._section('Profit', go('dashboard', 'profit'),
        this._statItem('Pour Cost', pct(bar.cost_pct))
      + this._statItem('Food Cost', pct(food.cost_pct))
      + this._statItem('Prime Cost', pct(w.prime_cost_pct))
      + this._statItem('Over Target', overTgt > 0 ? f(overTgt) : '$0', overTgt > 0 ? 'color:var(--red);' : 'color:var(--green);'));

    const revenue = this._section('Revenue', go('r-dashboard', 'revenue'),
        this._statItem('Check Average', checkAvg != null ? f2(checkAvg) : '-')
      + this._statItem('Rev / Labor Hr', rw && rw.rplh_blended != null ? f2(rw.rplh_blended) : '-')
      + this._statItem('Labor %', pct(laborPct)));

    // Cash is a live position (trapped capital / runway), not a per-week figure,
    // so it is labeled as the current standing, honestly.
    const trapped = (window.CashEngine && CashEngine.trapped) ? CashEngine.trapped() : { total: 0, hasData: false };
    const cashSF  = (window.CashEngine && CashEngine.survivalForecast) ? CashEngine.survivalForecast(13) : { hasData: false };
    const runwayTxt = !cashSF.hasData ? '-' : (cashSF.runway == null ? '13+ wks' : cashSF.runway === 0 ? 'This wk' : cashSF.runway + ' wk' + (cashSF.runway === 1 ? '' : 's'));
    const cash = this._section('Cash', go('c-dashboard', 'cash'),
        this._statItem('Trapped Cash', trapped.hasData ? f(trapped.total || 0) : '-')
      + this._statItem('Runway', runwayTxt),
      'Cash is your position right now, not a single week.');

    // Events: catering / event revenue booked into this week's rollup.
    const eventsRev = cat.revenue || 0;
    const events = this._section('Events', go('ev-dashboard', 'events'),
        this._statItem('Event Revenue', f(eventsRev)),
      eventsRev > 0 ? null : 'No event revenue in this week.');

    // Books: the week's top line + prime dollars, with a link to the full P&L.
    const primeDollars = cogs + laborCost;
    const books = this._section('Books', "S.HubBooksHome&&S.HubBooksHome.open&&S.HubBooksHome.open()",
        this._statItem('Revenue', f(netSales))
      + this._statItem('Prime Cost', f(primeDollars))
      + this._statItem('Prime %', pct(w.prime_cost_pct)),
      'Open the Weekly P&L Brief in Books for the full statement.');

    const audits = this._sh('Audits', '<button class="btn btn-ghost btn-sm no-print" onclick="S.HubBarCopAudit&&S.HubBarCopAudit.open&&S.HubBarCopAudit.open()">Open Audits &rsaquo;</button>')
      + '<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">Run a Bar Cop, Profit, Revenue, or Cash audit any time to score the week against your own data. Open Audits to generate one or see your latest scores.</div></div>';

    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="wr-export">Export PDF</button>';
    const body = this._sh('The Week', exportBtn)
      + '<div id="wr-export-root">'
      + strip + inventory + labor + shift + profit + revenue + cash + events + books + audits
      + '</div>';

    mount.innerHTML = '<div class="screen">' + selector + body + '</div>';

    // Wire the week selector + export.
    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => { this._wkIdx += parseInt(a.dataset.step, 10); this.render(mount); }));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkIdx = 0; this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', async () => {
      const ok = await App.confirmExport({
        title: 'Before You Export Your Week Review',
        message: 'This Week Review is built from the numbers you have logged in Bar Cop. It is a worksheet, not a filed financial statement. Verify it against your own records before you rely on it.',
        confirmText: 'I Understand, Continue',
        cancelText: 'Cancel'
      });
      if (ok) App.exportPDF({ title: 'Week Review', subtitle: label, root: document.getElementById('wr-export-root') });
    });
  },

  showHowTo() {
    App.showHelpModal('How Week Review Works', [
      { p: ['Week Review is the output side of your weekly close. Once the data is in, it pulls every section\'s headline numbers for one week onto a single page, so you read the whole operation at a glance instead of walking eight sections.'] },
      { h: 'Pick a week', p: ['Use the arrows to step back through your closed weeks. NOW marks the current one. Everything on the page reads from that week\'s confirmed numbers, nothing projected.'] },
      { h: 'Broken down by section', p: ['Inventory, Labor, Shift, Profit, Revenue, Books, and Events each show their key numbers for the week, with a link into the section. Cash shows your position right now, since trapped capital and runway are live, not weekly. Audits links you out to run or review a score.'] },
      { h: 'Export', p: ['Export PDF saves the week as a one-page report you can keep or hand off, the operational companion to the Weekly P&L Brief.'] }
    ]);
  }
};
