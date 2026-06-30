'use strict';

/* ── Import This Week — the one weekly POS intake ─────────────────────────────
   The whole weekly data load in one place. The operator drops their POS exports
   here and PosIngest fans each one out to every screen that reads it (This Week,
   Server Check, Sales Integrity, Menu Engineering, Labor, Cash, the audits), so
   the close is a few drops in one spot instead of hunting a dozen scattered
   boxes. CSVMapper remembers each report's column mapping, so after the first
   week it is drag, drop, done. A hub full-page screen, launched from the Hub's
   weekly cadence. */

S.ImportWeek = {
  // Each weekly POS report → its PosIngest type + what it feeds. Sales and Labor
  // are the core two; the rest are optional and light up their own features.
  REPORTS: [
    { type: 'sales',  group: 'Sales',      title: 'Daily Sales',     feeds: 'This Week, check average, category mix, forecasts, audits',
      drop: 'Drop your POS sales-by-day report here',          sub: 'One row per day with bar and food sales, plus covers.' },
    { type: 'server', group: 'Sales',      title: 'Server Sales',    feeds: 'Server Check, Sales Integrity',
      drop: 'Drop your POS per-server sales report here',      sub: 'One row per server with covers and total sales. Matched to your roster by name.' },
    { type: 'pmix',   group: 'Sales',      title: 'Menu Sales Mix',  feeds: 'Menu Engineering, Dog Test',
      drop: 'Drop your POS product mix (PMIX) report here',    sub: 'One row per menu item with units sold. Matched to your menu by name.' },
    { type: 'hours',  group: 'Labor',      title: 'Timeclock Hours', feeds: 'Labor cost, RPLH, overtime, payroll, audits',
      drop: 'Drop your timeclock export here',                 sub: 'One row per employee shift with hours worked. Matched to your roster by name.' },
    { type: 'tips',   group: 'Labor',      title: 'Tips',            feeds: 'Tip pool, payroll, Server Check',
      drop: 'Drop your POS tips export here',                  sub: 'One row per server with card and cash tips.' },
    { type: 'voids',  group: 'Exceptions', title: 'Voids & Comps',   feeds: 'Loss Prevention, Sales Integrity, Profit audit',
      drop: 'Drop your POS voids and comps export here',       sub: 'One row per voided or comped item.' },
    { type: 'cash',   group: 'Exceptions', title: 'Cash / Drawer',   feeds: 'Over and Short, Cash Recovery, Profit audit',
      drop: 'Drop your POS cash or drawer report here',        sub: 'Over and short, or expected and counted cash, per register.' }
  ],
  GROUPS: ['Sales', 'Labor', 'Exceptions'],

  open() {
    App.openHubFullPage('Import This Week', mount => this.render(mount));
  },

  render(mount) {
    this.container = mount;
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Import This Week Works', [
      { p: ['This is the one place you load the week. Drop your POS exports here and Bar Cop sends each one to every screen that uses it, so you are not hunting for a drop box on a dozen pages. Most weeks you only need a Sales report and a Labor report; the rest are optional and fill in their own features.'] },
      { h: 'The Mapping', p: ['The first time you drop a report, you match its columns to Bar Cop once, against a preview of your own rows. Bar Cop remembers that mapping, so every week after it is drag, drop, confirm. Re-dropping the same week replaces those days, it never double counts.'] },
      { h: 'Names Have to Match', p: ['Server, item, and register names in your export are matched to your roster, menu, and registers by name. Anything that does not match is skipped and listed so you can rename it in Bar Cop or fix the export. After that first cleanup it just flows.'] },
      { h: 'What Lights Up', p: ['Sales feeds This Week, check average, Server Check, Sales Integrity, and Menu Engineering. Labor feeds hours, RPLH, overtime, and payroll. Exceptions feed Loss Prevention and the audits. Cash feeds Over and Short and Cash Recovery. The audits then recompute on their own, no separate upload.'] }
    ]);
  },

  // Live "imported this week" read off the destination store (records dated in
  // roughly the last week). Honest: green only when the week's data is actually in.
  _recent(ymd) {
    if (!ymd) return false;
    const d = new Date(String(ymd).slice(0, 10) + 'T00:00:00').getTime();
    return !isNaN(d) && (Date.now() - d) <= 9 * 86400000 && d <= Date.now() + 86400000;
  },
  statusFor(type) {
    let arr = [], fields = ['date'];
    if (type === 'sales')       arr = (App.shiftData && App.shiftData.sc_shifts) || [];
    else if (type === 'server') arr = (App.data && App.data.revenue_server_checks) || [];
    else if (type === 'hours')  arr = (App.laborData && App.laborData.lc_actuals) || [];
    else if (type === 'tips')   arr = (App.laborData && App.laborData.lc_tips) || [];
    else if (type === 'voids')  arr = (App.shiftData && App.shiftData.sc_void_comps) || [];
    else if (type === 'cash')   arr = (App.shiftData && App.shiftData.sc_variances) || [];
    else if (type === 'pmix') { arr = (App.data && App.data.menu_items) || []; fields = ['weekly_covers_updated_at']; }
    return arr.some(r => r && fields.some(f => this._recent(r[f])));
  },
  statusInner(type) {
    return this.statusFor(type)
      ? '<span style="font-size:11px;font-weight:700;color:var(--green);display:inline-flex;align-items:center;gap:6px;"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);flex-shrink:0;"></span>Imported this week</span>'
      : '<span style="font-size:11px;color:var(--t3);">Not imported this week</span>';
  },

  draw() {
    const intro = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Import This Week</span>'
      + '<button class="btn btn-ghost btn-sm no-print" id="iw-help">How it works</button></div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;">Drop your weekly POS exports below and Bar Cop sends each one to every screen that uses it, one place instead of a dozen. Most weeks you only need Sales and Labor; the rest are optional. Bar Cop remembers your column mapping, so after the first time it is drag, drop, done.</div></div>';
    let body = '';
    this.GROUPS.forEach(g => {
      body += '<div class="sh" style="margin:18px 0 10px;">' + esc(g) + '</div>';
      this.REPORTS.filter(r => r.group === g).forEach(r => { body += this.reportCard(r); });
    });
    this.container.innerHTML = '<div class="screen">' + intro + body + '</div>';
    document.getElementById('iw-help')?.addEventListener('click', () => this.showHowTo());
    this.mountAll();
  },

  reportCard(r) {
    return '<div class="card" style="margin-bottom:12px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">'
      +   '<div style="min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(r.title) + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:3px;">Feeds ' + esc(r.feeds) + '</div></div>'
      +   '<span id="iw-status-' + r.type + '">' + this.statusInner(r.type) + '</span>'
      + '</div>'
      + '<div id="iw-csv-' + r.type + '"></div>'
      + '<div id="iw-res-' + r.type + '"></div>'
      + '<div id="iw-act-' + r.type + '" class="no-print" style="margin-top:10px;"></div>'
      + '</div>';
  },

  mountAll() {
    if (typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    this.REPORTS.forEach(r => {
      const el = document.getElementById('iw-csv-' + r.type);
      if (!el) return;
      CSVMapper.mount(el, {
        dropTitle: r.drop,
        dropSub: r.sub,
        actionsEl: '#iw-act-' + r.type,
        fields: PosIngest.FIELDS[r.type],
        confirmLabel: 'Import',
        onComplete: rows => this.ingest(r.type, rows)
      });
    });
  },

  async ingest(type, rows) {
    const { toAdd, skipped, dupCount } = PosIngest.build(type, rows);
    let ok = true;
    if (toAdd.length) ok = await PosIngest.commit(type, toAdd);
    const unmatched = (skipped || []).filter(s => s && s !== '(blank)');
    const res = document.getElementById('iw-res-' + type);
    if (res) {
      const good = ok && toAdd.length;
      res.innerHTML = '<div style="font-size:12px;font-weight:700;margin-top:10px;color:' + (good ? 'var(--gold)' : 'var(--red)') + ';">'
        + (good ? 'Imported ' + toAdd.length + ' row' + (toAdd.length === 1 ? '' : 's') + (dupCount ? ' (' + dupCount + ' already on file, skipped)' : '') + '.'
                : (toAdd.length ? 'Save failed. Try again.' : 'Nothing imported. Check the columns and names against the report.'))
        + '</div>'
        + (unmatched.length ? '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:5px;">Skipped, not matched to Bar Cop: ' + unmatched.slice(0, 8).map(esc).join(', ') + (unmatched.length > 8 ? ', and ' + (unmatched.length - 8) + ' more' : '') + '.</div>' : '');
    }
    const stEl = document.getElementById('iw-status-' + type);
    if (stEl) stEl.innerHTML = this.statusInner(type);
  }
};
