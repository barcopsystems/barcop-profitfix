'use strict';

/* ── Profit Recovery — Vendor Tracker ─────────────────────────────────────────
   The merged vendor cost-control center. Three tabs, all reading the same
   vendor data (ic_deliveries, ic_products cost_history, ic_vendors,
   vendor_discrepancies):

     Scorecard      — per-vendor rollup (spend, price drift, short counts,
                      open / recovered credits, days-to-credit, a status read)
     Price Changes  — the line-by-line price drift captured from deliveries,
                      annualized by each product's usage rate
     Discrepancies  — the working log: file a discrepancy, request the credit,
                      mark it resolved with what you actually got back

   Replaces the old vendor-watch / vendor-scorecard / vendor-discrepancy screens
   (those three ids deep-link straight to the matching tab). One store, multiple
   doors ([[two-doors-same-data]]); read-only diagnostics + one working log. */

S.VendorTracker = {
  tab: 'scorecard',   // 'scorecard' | 'watch' | 'discrepancies'
  range: '90',        // scorecard window: '30' | '90' | '180' | '365' | 'all'

  // ── Shared data helpers ─────────────────────────────────────────────
  vendors()       { return ((App.inventoryData && App.inventoryData.ic_vendors)    || []); },
  products()      { return ((App.inventoryData && App.inventoryData.ic_products)   || []); },
  deliveries()    { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  discRecords()   {
    if (!Array.isArray(App.data.vendor_discrepancies)) App.data.vendor_discrepancies = [];
    return App.data.vendor_discrepancies;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(String(str)) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Render shell ─────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';   // header is off; actions live in the page
    this.draw();
  },

  draw() {
    // Prerequisite: no vendors set up at all → guided setup (every tab needs them).
    if (!this.vendors().length) {
      App.setupCard(this.container, {
        title: 'Vendor Tracker',
        lead: 'Track vendor cost performance, price drift, and the credits you are owed. Add your vendors in Inventory Control first.',
        steps: [
          { title: 'Add your vendors', desc: 'Set up vendors in Inventory Control. Vendor Tracker rolls up their deliveries, price changes, and discrepancies here.', btn: 'Go to Vendors', screen: 'ic-vendors', done: false }
        ]
      });
      this.container.onclick = ev => {
        const go = ev.target.closest('.setup-go');
        if (go && go.dataset.go) App.openScreen(go.dataset.go);
      };
      return;
    }

    // Stamp the specific tab being viewed so the monthly Price Changes review and
    // the quarterly Scorecard review verify independently (one tab visit must not
    // satisfy both Profit Fix vendor steps).
    if (App.stampFixView) App.stampFixView('vendor-tracker:' + this.tab);

    const tabBar = '<div class="ch-tabs no-print">'
      + [['scorecard', 'Scorecard'], ['watch', 'Price Changes'], ['discrepancies', 'Discrepancies']]
        .map(([k, l]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-vtab="' + k + '">' + l + '</button>').join('')
      + '</div>';

    let body;
    if (this.tab === 'watch') body = this.watchBody();
    else if (this.tab === 'discrepancies') body = this.discrepanciesBody();
    else body = this.scorecardBody();

    this.container.innerHTML = '<div class="screen">' + tabBar + body + '</div>';

    this.container.querySelectorAll('.ch-tab[data-vtab]').forEach(b =>
      b.addEventListener('click', () => { this.tab = b.dataset.vtab; this.draw(); }));

    if (this.tab === 'watch') this.wireWatch();
    else if (this.tab === 'discrepancies') this.wireDiscrepancies();
    else this.wireScorecard();
  },

  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
  },
  statsCard(itemsHtml) {
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">' + itemsHtml + '</div></div>';
  },
  dataCard(theadHtml, rowsHtml) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl">'
      + theadHtml + '<tbody>' + rowsHtml + '</tbody></table></div></div>';
  },

  // Shared day-based range chips (the Scorecard's set) + an Export button, used
  // on all three tabs. Filters by startDate(); 'all' = no cutoff. this.range is
  // shared, so the window carries across tabs.
  RANGES: [['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['180', 'Last 6 Months'], ['365', 'Last 12 Months'], ['all', 'All Time']],
  rangeFilterRow(exportId) {
    const chips = App.filterChips(this.range, this.RANGES.map(([v, label]) => ({ v, label })), 'vt-range-chip');
    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="' + exportId + '">Export PDF</button></div>';
  },

  // ════════════════════════════════════════════════════════════════════
  //  SCORECARD TAB
  // ════════════════════════════════════════════════════════════════════
  startDate() {
    if (this.range === 'all') return '';
    const days = parseInt(this.range, 10) || 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return App.ymdLocal(d);
  },

  metricsFor(vendorName) {
    const start = this.startDate();
    const dels  = this.deliveries().filter(d => d.vendor === vendorName && (!start || d.date >= start));
    const disc  = this.discRecords().filter(d => d.vendor === vendorName && (!start || d.date >= start));

    const totalSpend    = dels.reduce((s, d) => s + (d.total || 0), 0);
    const deliveryCount = dels.length;
    const shortCounts   = dels.reduce((s, d) => s + (d.short_count_count || 0), 0);
    const priceChanges  = dels.reduce((s, d) => s + (d.price_change_count || 0), 0);
    const priceApplied  = dels.reduce((s, d) => s + (d.price_change_applied_count || 0), 0);

    let netDrift = 0;
    this.products().forEach(p => {
      (p.cost_history || []).forEach(h => {
        if (h.vendor !== vendorName) return;
        if (start && h.date < start) return;
        if (h.source !== 'delivery') return;
        netDrift += (parseFloat(h.new_cost) || 0) - (parseFloat(h.old_cost) || 0);
      });
    });

    const overchargeOpen     = disc.filter(d => d.status !== 'Resolved').reduce((s, d) => s + (parseFloat(d.overcharge) || 0), 0);
    const recovered          = disc.filter(d => d.status === 'Resolved').reduce((s, d) => s + (parseFloat(d.recovered_amount != null ? d.recovered_amount : d.overcharge) || 0), 0);
    const openCount          = disc.filter(d => d.status !== 'Resolved').length;
    const totalDiscrepancies = disc.length;

    const resolvedTimes = disc.filter(d => d.status === 'Resolved' && d.credit_requested_at && d.resolved_at)
      .map(d => (new Date(d.resolved_at).getTime() - new Date(d.credit_requested_at).getTime()) / 86400000);
    const avgDaysToCredit = resolvedTimes.length ? Math.round(resolvedTimes.reduce((s, t) => s + t, 0) / resolvedTimes.length) : null;

    return { vendorName, totalSpend, deliveryCount, shortCounts, priceChanges, priceApplied, netDrift, overchargeOpen, recovered, openCount, totalDiscrepancies, avgDaysToCredit };
  },

  // Status as colored TEXT (no badge): High red / Watch amber / Clean green / No activity grey.
  statusFor(m) {
    if (!m.deliveryCount && !m.totalDiscrepancies) return { label: 'No Activity', color: 'var(--t4)' };
    const driftPct = m.totalSpend > 0 ? (m.netDrift / m.totalSpend) * 100 : 0;
    if (m.overchargeOpen > 100 || driftPct > 5 || m.shortCounts > 2) return { label: 'High',  color: 'var(--red)' };
    if (m.overchargeOpen > 0   || m.netDrift > 0  || m.shortCounts > 0) return { label: 'Watch', color: 'var(--amber)' };
    return { label: 'Clean', color: 'var(--green)' };
  },

  scorecardBody() {
    const vendors = this.vendors().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const metrics = vendors.map(v => this.metricsFor(v.name));

    const totalSpend     = metrics.reduce((s, m) => s + m.totalSpend, 0);
    const totalDrift     = metrics.reduce((s, m) => s + m.netDrift, 0);
    const totalOpenOver  = metrics.reduce((s, m) => s + m.overchargeOpen, 0);
    const totalRecovered = metrics.reduce((s, m) => s + m.recovered, 0);

    const stats = this.statsCard(
      this.statItem('Total Spend', App.fmtCurrency(totalSpend))
      + this.statItem('Net Price Drift', (totalDrift >= 0 ? '+' : '') + App.fmtCurrency(totalDrift), totalDrift > 0 ? 'warn' : '')
      + this.statItem('Open Overcharge', App.fmtCurrency(totalOpenOver), totalOpenOver > 0 ? 'warn' : '')
      + this.statItem('Recovered', App.fmtCurrency(totalRecovered), 'good')
    );

    const filterRow = this.rangeFilterRow('vt-sc-export');

    // Vendors ranked by total impact so the pain-causers surface first.
    const sorted = metrics.slice().sort((a, b) =>
      (b.overchargeOpen + Math.max(0, b.netDrift) + b.totalSpend * 0.01) - (a.overchargeOpen + Math.max(0, a.netDrift) + a.totalSpend * 0.01));

    const rows = sorted.map(m => {
      const s = this.statusFor(m);
      return '<tr>'
        + '<td><div class="val">' + esc(m.vendorName) + '</div></td>'
        + '<td>' + m.deliveryCount + '</td>'
        + '<td>' + App.fmtCurrency(m.totalSpend) + '</td>'
        + '<td class="' + (m.netDrift > 0 ? 'neg' : (m.netDrift < 0 ? 'pos' : '')) + '">' + (m.netDrift > 0 ? '+' : '') + App.fmtCurrency(m.netDrift) + '</td>'
        + '<td>' + m.priceApplied + (m.priceApplied !== m.priceChanges ? ' <span style="color:var(--t4);">of ' + m.priceChanges + '</span>' : '') + '</td>'
        + '<td class="' + (m.shortCounts > 0 ? 'neg' : '') + '">' + m.shortCounts + '</td>'
        + '<td class="' + (m.overchargeOpen > 0 ? 'neg' : '') + '">' + App.fmtCurrency(m.overchargeOpen) + (m.openCount > 0 ? ' <span style="color:var(--t4);font-size:10px;">(' + m.openCount + ')</span>' : '') + '</td>'
        + '<td class="pos">' + App.fmtCurrency(m.recovered) + '</td>'
        + '<td>' + (m.avgDaysToCredit != null ? m.avgDaysToCredit + 'd' : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td><span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + s.color + ';">' + s.label + '</span></td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="10" style="color:var(--t3);text-align:center;padding:14px;">No vendor activity in this range. Pick a wider range above.</td></tr>';

    const thead = '<thead><tr><th>Vendor</th><th>Deliveries</th><th>Spend</th><th>Net Drift</th>'
      + '<th>Price Updates</th><th>Short Counts</th><th>Open Overcharge</th><th>Recovered</th><th>Avg Days to Credit</th><th>Status</th></tr></thead>';

    return stats + filterRow + this.dataCard(thead, rows);
  },

  wireScorecard() {
    this.container.querySelectorAll('.vt-range-chip').forEach(b =>
      b.addEventListener('click', () => { this.range = b.dataset.v; this.draw(); }));
    document.getElementById('vt-sc-export')?.addEventListener('click',
      () => App.exportPDF({ title: 'Vendor Scorecard', root: this.container }));
  },

  // ════════════════════════════════════════════════════════════════════
  //  PRICE CHANGES TAB  (from Vendor Watch)
  // ════════════════════════════════════════════════════════════════════
  priceChanges() {
    const out = [];
    this.deliveries().forEach(d => {
      (d.line_items || []).forEach(li => {
        if (li.price_changed && li.prev_price != null && li.price_per_unit != null) {
          out.push({ date: d.date, vendor: d.vendor, product_id: li.product_id, name: li.name, old: li.prev_price, new: li.price_per_unit });
        }
      });
    });
    return out.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  annualUsage(pid) {
    const counts = [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
    if (counts.length < 2) return null;
    const s = counts[counts.length - 2], e = counts[counts.length - 1];
    const si = (s.items || []).find(it => it.product_id === pid);
    const ei = (e.items || []).find(it => it.product_id === pid);
    if (!si || !ei) return null;
    let purch = 0;
    this.deliveries().filter(d => d.date > s.date && d.date <= e.date)
      .forEach(d => (d.line_items || []).forEach(li => { if (li.product_id === pid) purch += App.unitsFromDeliveryLine(li); }));
    const used = (si.total || 0) + purch - (ei.total || 0);
    const days = (new Date(e.date + 'T00:00:00').getTime() - new Date(s.date + 'T00:00:00').getTime()) / 86400000;
    if (days <= 0) return null;
    return used / days * 365;
  },

  watchBody() {
    const all = this.priceChanges().map(c => {
      const delta = c.new - c.old;
      const pct = c.old > 0 ? delta / c.old * 100 : 0;
      const au = this.annualUsage(c.product_id);
      return { ...c, delta, pct, annual: au != null ? delta * au : null };
    });

    if (!all.length) {
      return '<div class="card"><div class="empty"><div class="empty-title">No vendor price changes yet</div>'
        + '<div class="empty-sub">Price changes are captured automatically when a delivery\'s invoice price differs from the product\'s current cost. Record deliveries in Inventory Control and any drift shows up here, with what it costs you per year.</div>'
        + '</div></div>';
    }

    const start = this.startDate();
    const changes = all.filter(c => !start || (c.date || '') >= start);
    const totalAnnual = changes.reduce((s, c) => s + (c.annual || 0), 0);
    const increases = changes.filter(c => c.delta > 0).length;

    const stats = this.statsCard(
      this.statItem('Price Increases', String(increases))
      + this.statItem('Total Annual Impact', (totalAnnual > 0 ? '+' : '') + App.fmtCurrency(totalAnnual) + '/yr', totalAnnual > 0 ? 'warn' : (totalAnnual < 0 ? 'good' : ''))
    );

    const filterRow = this.rangeFilterRow('vt-w-export');

    const rows = changes.slice(0, App.listLimit('core', 'vendor_price_changes')).map(c => '<tr>'
      + '<td>' + this.fmtDate(c.date) + '</td>'
      + '<td>' + esc(c.vendor || '-') + '</td>'
      + '<td class="val">' + esc(c.name || '-') + '</td>'
      + '<td>' + App.fmtCurrency(c.old, 2) + '</td>'
      + '<td>' + App.fmtCurrency(c.new, 2) + '</td>'
      + '<td class="' + (c.delta > 0 ? 'neg' : 'pos') + '">' + (c.delta > 0 ? '+' : '') + App.fmtPct(c.pct) + '</td>'
      + '<td class="' + (c.annual == null ? '' : c.annual > 0 ? 'neg' : 'pos') + '">'
        + (c.annual == null ? '<span style="color:var(--t4);">-</span>' : (c.annual > 0 ? '+' : '') + App.fmtCurrency(c.annual) + '/yr') + '</td>'
      + '</tr>').join('') || '<tr><td colspan="7" style="color:var(--t3);text-align:center;padding:14px;">No price changes in this range. Pick a wider range above.</td></tr>';

    const thead = '<thead><tr><th>Date</th><th>Vendor</th><th>Product</th><th>Previous Cost</th><th>New Cost</th><th>Change %</th><th>Annual Impact</th></tr></thead>';
    return stats + filterRow + this.dataCard(thead, rows)
      + App.showOlderBar('core', 'vendor_price_changes', changes, this.range !== 'all');
  },

  wireWatch() {
    this.container.querySelectorAll('.vt-range-chip').forEach(b =>
      b.addEventListener('click', () => { this.range = b.dataset.v; this.draw(); }));
    document.getElementById('vt-w-export')?.addEventListener('click',
      () => App.exportPDF({ title: 'Vendor Price Changes', root: this.container }));
    this.container.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.draw())));
  },

  // ════════════════════════════════════════════════════════════════════
  //  DISCREPANCIES TAB  (the working log)
  // ════════════════════════════════════════════════════════════════════
  discStatusText(st) {
    if (st === 'Resolved') return '<span style="color:var(--green);font-weight:700;">Resolved</span>';
    if (st === 'Credit Requested') return '<span style="color:var(--t2);font-weight:700;">Credit Requested</span>';
    return '<span style="color:var(--amber);font-weight:700;">Open</span>';
  },

  discrepanciesBody() {
    const allRows = this.discRecords().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const start = this.startDate();
    const rows = allRows.filter(r => !start || (r.date || '') >= start);
    const open = rows.filter(r => r.status !== 'Resolved');
    const openTotal = open.reduce((s, r) => s + (r.overcharge || 0), 0);
    const recovered = rows.filter(r => r.status === 'Resolved').reduce((s, r) => s + ((r.recovered_amount != null ? r.recovered_amount : r.overcharge) || 0), 0);

    const stats = this.statsCard(
      this.statItem('Open Discrepancies', String(open.length), open.length ? 'warn' : 'good')
      + this.statItem('Open Overcharge', App.fmtCurrency(openTotal), openTotal > 0 ? 'warn' : '')
      + this.statItem('Recovered', App.fmtCurrency(recovered), 'good')
    );

    const filterRow = this.rangeFilterRow('vt-disc-export');

    let body;
    if (!rows.length) {
      body = allRows.length
        ? '<div class="card"><div class="empty"><div class="empty-title">No discrepancies in this range</div>'
          + '<div class="empty-sub">Pick a wider range above, or All Time, to see every claim.</div></div></div>'
        : '<div class="card"><div class="empty"><div class="empty-title">No discrepancies filed</div>'
          + '<div class="empty-sub">When a delivery is short or a price is wrong, file it here. Every discrepancy you document is a credit you can request. Contact the rep within 24 hours; they age out fast.</div></div></div>';
    } else {
      const trs = rows.slice(0, App.listLimit('core', 'vendor_discrepancy')).map(r => {
        const act = r.status === 'Open'
          ? '<button class="btn btn-ghost btn-sm vt-credit" data-id="' + esc(r.id) + '">Request Credit</button>'
          : r.status === 'Credit Requested'
            ? '<button class="btn btn-ghost btn-sm vt-resolve" data-id="' + esc(r.id) + '">Mark Resolved</button>'
            : '';
        return '<tr>'
          + '<td>' + this.fmtDate(r.date) + '</td>'
          + '<td class="val">' + esc(r.vendor || '-') + '</td>'
          + '<td>' + esc(r.type || '-') + '</td>'
          + '<td>' + esc(r.sku || '-') + '</td>'
          + '<td class="' + ((r.overcharge || 0) > 0 ? 'neg' : '') + '">' + App.fmtCurrency(r.overcharge || 0) + '</td>'
          + '<td>' + this.discStatusText(r.status) + '</td>'
          + '<td style="white-space:nowrap;text-align:right;">' + act
          + ' <button class="btn btn-danger btn-sm vt-del" data-id="' + esc(r.id) + '">Delete</button></td>'
          + '</tr>';
      }).join('');
      const thead = '<thead><tr><th>Date</th><th>Vendor</th><th>Type</th><th>Product</th><th>Overcharge</th><th>Status</th><th></th></tr></thead>';
      body = this.dataCard(thead, trs) + App.showOlderBar('core', 'vendor_discrepancy', rows, false);
    }

    return stats + filterRow + body;
  },

  wireDiscrepancies() {
    this.container.querySelectorAll('.vt-range-chip').forEach(b =>
      b.addEventListener('click', () => { this.range = b.dataset.v; this.draw(); }));
    document.getElementById('vt-disc-export')?.addEventListener('click',
      () => App.exportPDF({ title: 'Vendor Discrepancies', root: this.container }));
    this.container.querySelectorAll('.vt-credit').forEach(b => b.addEventListener('click', () => this.requestCredit(b.dataset.id)));
    this.container.querySelectorAll('.vt-resolve').forEach(b => b.addEventListener('click', () => this.markResolved(b.dataset.id)));
    this.container.querySelectorAll('.vt-del').forEach(b => b.addEventListener('click', () => this.removeDiscrepancy(b.dataset.id)));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.draw()));
  },

  // ── Request Credit (mailto to the rep, then flip to Credit Requested) ─
  requestCredit(id) {
    const r = this.discRecords().find(x => x.id === id);
    if (!r) return;
    window.location.href = this._creditMailtoHref(r);
    r.status = 'Credit Requested';
    r.credit_requested_at = new Date().toISOString();
    App.putRecord('core', 'vendor_discrepancy', r).then(() => this.draw());
  },

  // Credit-request email draft (shared by the Discrepancies tab + the modal).
  _creditMailtoHref(r) {
    const v = this.vendors().find(x => x.name === r.vendor) || null;
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop User';
    const lines = [];
    lines.push('Hi' + (v?.rep ? ' ' + v.rep : '') + ',', '', 'I am writing to request a credit on a delivery discrepancy.', '');
    if (v?.account_number) lines.push('Account: ' + v.account_number);
    lines.push('Delivery date: ' + (r.date || ''));
    if (r.reference) lines.push('Invoice / Reference: ' + r.reference);
    lines.push('', 'Type: ' + (r.type || 'Other'));
    if (r.sku) lines.push('Product: ' + r.sku);
    if (r.units != null && r.units !== '') lines.push('Units affected: ' + r.units);
    if (r.agreed_price != null)   lines.push('Agreed price: $' + parseFloat(r.agreed_price).toFixed(2));
    if (r.invoiced_price != null) lines.push('Invoiced price: $' + parseFloat(r.invoiced_price).toFixed(2));
    lines.push('Credit amount requested: $' + parseFloat(r.overcharge || 0).toFixed(2));
    if (r.notes) lines.push('', 'Notes: ' + r.notes);
    lines.push('', 'Please confirm the credit and let me know when it will be applied.', '', 'Thanks,', barName);
    const subj = 'Credit request: ' + (r.vendor || 'vendor') + ' discrepancy from ' + (r.date || '');
    return 'mailto:' + encodeURIComponent(v?.email || '')
      + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(lines.join('\n'));
  },

  // ── Mark Resolved (popup asking what was actually recovered) ──────────
  markResolved(id) {
    const r = this.discRecords().find(x => x.id === id);
    if (!r) return;
    const claimed = parseFloat(r.overcharge) || 0;
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Mark Resolved</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:14px;">How much credit did the vendor actually give you? Claimed was <strong style="color:var(--t1);">' + App.fmtCurrency(claimed) + '</strong>. Vendors sometimes credit only part of a claim, and the Recovered total counts what you actually got back.</div>'
      + '<div class="f" style="width:200px;margin-bottom:0;"><label>Recovered Amount</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="vd-resolve-amt" step="0.01" value="' + claimed.toFixed(2) + '"/></div></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="vd-resolve-save">Save</button>'
        + '<button class="btn btn-ghost" id="vd-resolve-cancel">Cancel</button>'
        + '<span id="vd-resolve-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'vd-resolve-modal', maxWidth: 480, noClose: true });
    setTimeout(() => document.getElementById('vd-resolve-amt')?.select(), 50);
    document.getElementById('vd-resolve-cancel')?.addEventListener('click', () => App.closeModal('vd-resolve-modal'));
    document.getElementById('vd-resolve-save')?.addEventListener('click', () => {
      const inp = document.getElementById('vd-resolve-amt');
      const errEl = document.getElementById('vd-resolve-err');
      const recovered = parseFloat(inp?.value);
      if (isNaN(recovered) || recovered < 0) { if (errEl) { errEl.textContent = 'Enter a valid dollar amount.'; errEl.style.display = 'inline'; } return; }
      r.status = 'Resolved';
      r.resolved_at = new Date().toISOString();
      r.recovered_amount = recovered;
      App.putRecord('core', 'vendor_discrepancy', r).then(() => { App.closeModal('vd-resolve-modal'); this.draw(); });
    });
  },

  async removeDiscrepancy(id) {
    const r = this.discRecords().find(x => x.id === id);
    const ok = await App.confirm({
      title: 'Delete this discrepancy?',
      message: (r ? 'The ' + (r.vendor || 'vendor') + ' discrepancy' + ((r.overcharge || 0) > 0 ? ' for ' + App.fmtCurrency(r.overcharge) : '') + ' will be removed. ' : '')
        + 'It feeds your Scorecard open and recovered totals. This cannot be undone.',
      confirmText: 'Delete', danger: true
    });
    if (!ok) return;
    App.removeRecord('core', 'vendor_discrepancy', id).then(() => this.draw());
  },

  // ── Shared discrepancy modal (Receive Delivery + Delivery History) ─────────
  // File a claim and chase it to credit/resolution in place, against the SAME
  // vendor_discrepancies record the Discrepancies tab reads — no page leave.
  // opts: { discrepancyId, prefill, onClose, onFiled }. [[two-doors-same-data]]
  openDiscrepancyModal(opts) {
    opts = opts || {};
    this._vd = { prefill: opts.prefill || {}, onClose: opts.onClose || null, onFiled: opts.onFiled || null };
    App.openModal('<div class="card form-card" id="vdm-card" style="margin:0;"></div>', { id: 'vd-modal', maxWidth: 640, noClose: true });
    this._renderVdBody(opts.discrepancyId || null);
  },
  _vdClose() {
    App.closeModal('vd-modal');
    const cb = this._vd && this._vd.onClose; this._vd = null;
    if (typeof cb === 'function') cb();
  },
  _vdRow(label, val) {
    return '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + val + '</div></div>';
  },
  _renderVdBody(discId) {
    const card = document.getElementById('vdm-card'); if (!card) return;
    const TYPES = ['Price Overcharge', 'Short Count', 'Substitution', 'Damaged Goods', 'Other'];

    // FILE phase: the claim form, pre-filled from the line.
    if (!discId) {
      const pf = (this._vd && this._vd.prefill) || {};
      const typeOpts = TYPES.map(t => '<option value="' + t + '"' + (t === (pf.type || 'Price Overcharge') ? ' selected' : '') + '>' + t + '</option>').join('');
      card.innerHTML = '<div class="card-title">File Discrepancy</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Files a credit claim you can chase to resolution right here. Adjust if needed.</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="width:160px;"><label>Date</label><input type="date" id="vdm-date" value="' + esc(pf.date || App.todayLocal()) + '"/></div>'
          + '<div class="f" style="flex:1;min-width:160px;"><label>Vendor</label><input type="text" id="vdm-vendor" value="' + esc(pf.vendor || '') + '"' + (pf.vendor ? ' readonly' : '') + '/></div>'
          + '<div class="f" style="width:160px;"><label>Invoice / Reference</label><input type="text" id="vdm-ref" value="' + esc(pf.reference || '') + '"/></div>'
        + '</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="flex:1;min-width:200px;"><label>Product</label><input type="text" id="vdm-product" value="' + esc(pf.sku || '') + '"/></div>'
          + '<div class="f" style="width:180px;"><label>Type</label><select id="vdm-type">' + typeOpts + '</select></div>'
        + '</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="flex:1;min-width:80px;"><label>Units</label><input type="number" id="vdm-units" step="1" value="' + (pf.units != null ? esc(String(pf.units)) : '') + '"/></div>'
          + '<div class="f" style="flex:1.3;min-width:110px;"><label>Agreed Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vdm-agreed" step="0.01" value="' + (pf.agreed_price != null ? parseFloat(pf.agreed_price).toFixed(2) : '') + '"/></div></div>'
          + '<div class="f" style="flex:1.3;min-width:110px;"><label>Invoiced Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vdm-invoiced" step="0.01" value="' + (pf.invoiced_price != null ? parseFloat(pf.invoiced_price).toFixed(2) : '') + '"/></div></div>'
          + '<div class="f" style="flex:1.5;min-width:120px;"><label>Overcharge / Loss</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vdm-over" step="0.01" value="' + (pf.overcharge != null ? parseFloat(pf.overcharge).toFixed(2) : '0.00') + '"/></div></div>'
        + '</div>'
        + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Notes</label><input type="text" id="vdm-notes" value="' + esc(pf.notes || '') + '" placeholder="What was wrong, and who you contacted"/></div></div>'
        + '<div id="vdm-err" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none;"></div>'
        + '<div class="card-actions"><button class="btn btn-primary" id="vdm-file">File Discrepancy</button>'
        + '<button class="btn btn-ghost" id="vdm-cancel">Cancel</button></div>';
      card.querySelector('#vdm-cancel').addEventListener('click', () => this._vdClose());
      card.querySelector('#vdm-file').addEventListener('click', () => this._vdFile());
      return;
    }

    // WORK phase: the saved claim — chase it to credit and resolution.
    const r = this.discRecords().find(x => x.id === discId);
    if (!r) { this._vdClose(); return; }
    const st = r.status || 'Open';
    const iSt = 'background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:13px;padding:7px 10px;color-scheme:dark;';

    let statusBlock = '', primary = '';
    if (st === 'Open') {
      statusBlock = '<div style="font-size:12px;color:var(--t2);line-height:1.6;">Open claim. Request the credit from your rep within 24 hours; they age out fast. Requesting drafts the email and flips this to Credit Requested.</div>';
      primary = '<button class="btn btn-primary" id="vdm-credit">Request Credit</button>';
    } else if (st === 'Credit Requested') {
      statusBlock = '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:10px;">Credit requested ' + esc((r.credit_requested_at || '').slice(0, 10)) + '. When the vendor credits you, record what you actually got back.</div>'
        + '<div class="f" style="width:200px;margin-bottom:0;"><label>Recovered Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vdm-recovered" step="0.01" value="' + (parseFloat(r.overcharge) || 0).toFixed(2) + '"/></div></div>';
      primary = '<button class="btn btn-primary" id="vdm-resolve">Mark Resolved</button>';
    } else {
      const rec = r.recovered_amount != null ? r.recovered_amount : r.overcharge;
      statusBlock = '<div style="font-size:12px;color:var(--green);font-weight:700;">Resolved ' + esc((r.resolved_at || '').slice(0, 10)) + ' &middot; Recovered ' + App.fmtCurrency(parseFloat(rec) || 0) + '</div>';
      primary = '<button class="btn btn-primary" id="vdm-reopen">Reopen</button>';
    }

    card.innerHTML = '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Vendor Discrepancy</span>'
      + '<span id="vdm-view" style="font-size:10px;font-weight:700;letter-spacing:0.4px;text-transform:none;color:var(--gold);cursor:pointer;white-space:nowrap;">View in Vendor Tracker &rsaquo;</span></div>'
      + '<div style="font-size:15px;font-weight:800;color:var(--t1);">' + esc(r.sku || '(unrecorded)') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + esc(r.vendor || '-') + ' &middot; ' + esc(r.type || 'Other') + ' &middot; ' + this.discStatusText(st) + '</div>'
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;margin:14px 0;background:var(--input);border:1px solid var(--b-edge);border-radius:6px;padding:12px 16px;">'
        + this._vdRow('Units', r.units != null ? esc(String(r.units)) : '-')
        + this._vdRow('Agreed', r.agreed_price != null ? App.fmtCurrency(r.agreed_price) : '-')
        + this._vdRow('Invoiced', r.invoiced_price != null ? App.fmtCurrency(r.invoiced_price) : '-')
        + this._vdRow('Overcharge', App.fmtCurrency(r.overcharge || 0))
      + '</div>'
      + statusBlock
      + '<div style="margin-top:14px;"><label style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Notes</label>'
      + '<textarea id="vdm-notes-w" rows="2" placeholder="What was wrong, and who you contacted" style="' + iSt + 'width:100%;margin-top:5px;resize:vertical;">' + esc(r.notes || '') + '</textarea></div>'
      + '<div class="card-actions">' + primary
      + '<button class="btn btn-ghost" id="vdm-close">Close</button>'
      + '<button class="btn btn-danger" id="vdm-del" style="margin-left:auto;">Delete</button></div>';

    const flushNotes = () => { const ta = card.querySelector('#vdm-notes-w'); if (ta) r.notes = ta.value; };
    card.querySelector('#vdm-notes-w')?.addEventListener('change', () => { flushNotes(); App.putRecord('core', 'vendor_discrepancy', r); });
    card.querySelector('#vdm-credit')?.addEventListener('click', () => {
      flushNotes();
      window.location.href = this._creditMailtoHref(r);
      r.status = 'Credit Requested'; r.credit_requested_at = new Date().toISOString();
      App.putRecord('core', 'vendor_discrepancy', r).then(() => this._renderVdBody(discId));
    });
    card.querySelector('#vdm-resolve')?.addEventListener('click', () => {
      flushNotes();
      const amt = parseFloat(card.querySelector('#vdm-recovered')?.value);
      if (isNaN(amt) || amt < 0) return;
      r.status = 'Resolved'; r.resolved_at = new Date().toISOString(); r.recovered_amount = amt;
      App.putRecord('core', 'vendor_discrepancy', r).then(() => this._renderVdBody(discId));
    });
    card.querySelector('#vdm-reopen')?.addEventListener('click', () => {
      r.status = 'Credit Requested'; delete r.resolved_at; delete r.recovered_amount;
      App.putRecord('core', 'vendor_discrepancy', r).then(() => this._renderVdBody(discId));
    });
    card.querySelector('#vdm-view')?.addEventListener('click', () => {
      flushNotes();
      App.putRecord('core', 'vendor_discrepancy', r).then(() => { this._vdClose(); this.tab = 'discrepancies'; App.showApp('profit'); App.navigate('vendor-tracker'); });
    });
    card.querySelector('#vdm-close')?.addEventListener('click', () => { flushNotes(); App.putRecord('core', 'vendor_discrepancy', r).then(() => this._vdClose()); });
    card.querySelector('#vdm-del')?.addEventListener('click', async () => { if (!(await App.confirmDelete())) return; await App.removeRecord('core', 'vendor_discrepancy', r.id); this._vdClose(); });
  },
  _vdFile() {
    const card = document.getElementById('vdm-card'); if (!card) return;
    const errEl = card.querySelector('#vdm-err');
    const fail = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'block'; } };
    const date = card.querySelector('#vdm-date')?.value;
    const vendor = (card.querySelector('#vdm-vendor')?.value || '').trim();
    if (!date) { fail('Date is required.'); return; }
    if (!vendor) { fail('Vendor is required.'); return; }
    const pf = (this._vd && this._vd.prefill) || {};
    const rec = {
      id: App.uid(), date, vendor,
      reference: (card.querySelector('#vdm-ref')?.value || '').trim(),
      type: card.querySelector('#vdm-type')?.value || 'Other',
      sku: (card.querySelector('#vdm-product')?.value || '').trim(),
      units: parseFloat(card.querySelector('#vdm-units')?.value) || 0,
      agreed_price: parseFloat(card.querySelector('#vdm-agreed')?.value) || 0,
      invoiced_price: parseFloat(card.querySelector('#vdm-invoiced')?.value) || 0,
      overcharge: parseFloat(card.querySelector('#vdm-over')?.value) || 0,
      notes: (card.querySelector('#vdm-notes')?.value || '').trim(),
      status: 'Open',
      source: pf.source || 'inventory',
      delivery_id: pf.delivery_id || null,
      created_at: new Date().toISOString()
    };
    App.putRecord('core', 'vendor_discrepancy', rec).then(() => {
      if (this._vd && typeof this._vd.onFiled === 'function') this._vd.onFiled(rec);
      this._renderVdBody(rec.id);
    });
  },

  // ── Help ──────────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Vendor Tracker Works', [
      { p: ['One place to keep your vendors honest. Three tabs read the same delivery, price, and discrepancy data: a per-vendor Scorecard, the line-by-line Price Changes, and the Discrepancies log where you chase credits.'] },
      { h: 'Scorecard', p: ['Each vendor rolled up over the range you pick: total spend, net price drift, short counts, open and recovered credits, and average days to a credit. Vendors causing the most pain sort to the top, with a status read of High, Watch, or Clean. Take this into your quarterly vendor review and ask for a price match on every line that drifted up. Export PDF saves the rollup.'] },
      { h: 'Price Changes', p: ['Every per-line price change captured automatically when a delivery is received in Inventory Control, with the annual cost of each increase based on that product\'s usage rate. Read-only; the data comes from receiving deliveries.'] },
      { h: 'Discrepancies', p: ['Every credit claim you are owed, open and resolved. Claims get FILED over in Inventory: flag the line at the dock in Receive Delivery, or open a saved delivery in Delivery History and flag it there if the problem turned up later. This tab is where you WORK them: Request Credit drafts an email to your rep and flips the status, Mark Resolved records what you actually got back, and Export PDF saves the list for a claim.'] }
    ]);
  }
};
