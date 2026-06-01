'use strict';

/* ── Profit Recovery — Vendor Scorecard ───────────────────────────────────────
   Per-vendor performance aggregate. Reads `ic_deliveries`, `ic_products`
   (cost_history), and `vendor_discrepancies` and rolls them up into:
   total spend, price-change frequency, net price drift $, short-count
   count, discrepancies filed + recovered + outstanding, days-to-credit
   average. Always-on read; no operator entry. Operator uses this at the
   quarterly vendor review (per fix-profit Vendor Control gap-area step 6)
   to negotiate from actual numbers instead of impression. */

S.VendorScorecard = {
  range: '90',   // '30' | '90' | '180' | '365' | 'all'

  vendors()       { return ((App.inventoryData && App.inventoryData.ic_vendors)        || []); },
  products()      { return ((App.inventoryData && App.inventoryData.ic_products)       || []); },
  deliveries()    { return ((App.inventoryData && App.inventoryData.ic_deliveries)     || []); },
  discrepancies() { return ((App.data && App.data.vendor_discrepancies)                 || []); },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Inclusive date filter on this.range. Returns earliest date string (YYYY-MM-DD)
  // the screen will count. Empty string for "all time."
  startDate() {
    if (this.range === 'all') return '';
    const days = parseInt(this.range, 10) || 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  },

  // Pull one vendor's roll-up for the active range.
  metricsFor(vendorName) {
    const start = this.startDate();
    const dels  = this.deliveries().filter(d => d.vendor === vendorName && (!start || d.date >= start));
    const disc  = this.discrepancies().filter(d => d.vendor === vendorName && (!start || d.date >= start));

    const totalSpend     = dels.reduce((s, d) => s + (d.total || 0), 0);
    const deliveryCount  = dels.length;
    const shortCounts    = dels.reduce((s, d) => s + (d.short_count_count || 0), 0);
    const priceChanges   = dels.reduce((s, d) => s + (d.price_change_count || 0), 0);
    const priceApplied   = dels.reduce((s, d) => s + (d.price_change_applied_count || 0), 0);

    // Net price drift $: sum (new_cost - old_cost) across cost_history entries
    // sourced from this vendor in the range. Positive = drift up (cost pain).
    let netDrift = 0;
    this.products().forEach(p => {
      (p.cost_history || []).forEach(h => {
        if (h.vendor !== vendorName) return;
        if (start && h.date < start) return;
        if (h.source !== 'delivery') return;
        const oldC = parseFloat(h.old_cost) || 0;
        const newC = parseFloat(h.new_cost) || 0;
        netDrift += (newC - oldC);
      });
    });

    const overchargeOpen      = disc.filter(d => d.status !== 'Resolved').reduce((s, d) => s + (parseFloat(d.overcharge) || 0), 0);
    const recovered           = disc.filter(d => d.status === 'Resolved').reduce((s, d) => s + (parseFloat(d.recovered_amount != null ? d.recovered_amount : d.overcharge) || 0), 0);
    const openCount           = disc.filter(d => d.status !== 'Resolved').length;
    const totalDiscrepancies  = disc.length;

    // Average days from credit_requested_at to resolved_at on resolved items.
    const resolvedTimes = disc.filter(d => d.status === 'Resolved' && d.credit_requested_at && d.resolved_at)
      .map(d => (new Date(d.resolved_at).getTime() - new Date(d.credit_requested_at).getTime()) / 86400000);
    const avgDaysToCredit = resolvedTimes.length
      ? Math.round(resolvedTimes.reduce((s, t) => s + t, 0) / resolvedTimes.length)
      : null;

    return {
      vendorName, totalSpend, deliveryCount, shortCounts,
      priceChanges, priceApplied, netDrift,
      overchargeOpen, recovered, openCount, totalDiscrepancies, avgDaysToCredit
    };
  },

  // Status badge: simple read of "is this vendor causing pain?"
  // High = open overcharge > $100 OR net drift up > 5% of spend OR shortCounts > 2
  // Watch = any open overcharge OR any net drift up OR any short count
  // Clean = nothing of note in the range
  statusFor(m) {
    if (!m.deliveryCount && !m.totalDiscrepancies) return { label: 'NO ACTIVITY', color: 'var(--t4)' };
    const driftPct = m.totalSpend > 0 ? (m.netDrift / m.totalSpend) * 100 : 0;
    if (m.overchargeOpen > 100 || driftPct > 5 || m.shortCounts > 2) return { label: 'HIGH',  color: 'var(--red)' };
    if (m.overchargeOpen > 0   || m.netDrift > 0  || m.shortCounts > 0) return { label: 'WATCH', color: 'var(--steel)' };
    return { label: 'CLEAN', color: 'var(--gold)' };
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="vs-export">Export PDF</button>';
    document.getElementById('vs-export')?.addEventListener('click', () => App.exportPDF({ title: 'Vendor Scorecard', root: this.container }));
    this.draw();
  },

  rangeOptions() {
    const opts = [['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['180', 'Last 6 Months'], ['365', 'Last 12 Months'], ['all', 'All Time']];
    return opts.map(([v, l]) => '<option value="' + v + '"' + (this.range === v ? ' selected' : '') + '>' + l + '</option>').join('');
  },

  draw() {
    const vendors = this.vendors().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (vendors.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No vendors set up yet</div>'
        + '<div class="empty-sub">Add vendors on the Inventory Control Vendors screen. Vendor Scorecard rolls up deliveries, price drift, and discrepancies from there.</div>'
        + '<button class="btn btn-primary" id="vs-go">Go to Vendors</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#vs-go')) App.navigate('ic-vendors'); };
      return;
    }

    const metrics = vendors.map(v => this.metricsFor(v.name));

    // Top-line tiles
    const totalSpend         = metrics.reduce((s, m) => s + m.totalSpend, 0);
    const totalDrift         = metrics.reduce((s, m) => s + m.netDrift, 0);
    const totalOpenOver      = metrics.reduce((s, m) => s + m.overchargeOpen, 0);
    const totalRecovered     = metrics.reduce((s, m) => s + m.recovered, 0);

    const tiles = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Total Spend</div><div class="calc-val">' + App.fmtCurrency(totalSpend) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Net Price Drift</div><div class="calc-val ' + (totalDrift > 0 ? 'warn' : '') + '">' + (totalDrift >= 0 ? '+' : '') + App.fmtCurrency(totalDrift) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Open Overcharge</div><div class="calc-val ' + (totalOpenOver > 0 ? 'warn' : '') + '">' + App.fmtCurrency(totalOpenOver) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Recovered</div><div class="calc-val good">' + App.fmtCurrency(totalRecovered) + '</div></div>'
    + '</div>';

    // Range picker
    const controls = '<div class="form-row" style="margin-bottom:14px;align-items:center;gap:14px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Date Range</label>'
      + '<select id="vs-range">' + this.rangeOptions() + '</select></div>'
      + '<div style="font-size:11px;color:var(--t3);align-self:flex-end;padding-bottom:10px;">'
        + (this.range === 'all' ? 'All vendor activity on file.' : 'Activity from ' + this.fmtDate(this.startDate()) + ' to today.')
      + '</div></div>';

    // Vendor rows. Sorted by total annual impact (spend + open overcharge + drift) so
    // the most pain-causing vendors surface first.
    const sorted = metrics.slice().sort((a, b) =>
      (b.overchargeOpen + Math.max(0, b.netDrift) + b.totalSpend * 0.01)
      - (a.overchargeOpen + Math.max(0, a.netDrift) + a.totalSpend * 0.01)
    );
    const rows = sorted.map(m => {
      const s = this.statusFor(m);
      const driftClass = m.netDrift > 0 ? 'neg' : (m.netDrift < 0 ? 'pos' : '');
      const openClass  = m.overchargeOpen > 0 ? 'neg' : '';
      return '<tr>'
        + '<td><div class="val">' + esc(m.vendorName) + '</div></td>'
        + '<td>' + m.deliveryCount + '</td>'
        + '<td>' + App.fmtCurrency(m.totalSpend) + '</td>'
        + '<td class="' + driftClass + '">' + (m.netDrift > 0 ? '+' : '') + App.fmtCurrency(m.netDrift) + '</td>'
        + '<td>' + m.priceApplied + (m.priceApplied !== m.priceChanges ? ' <span style="color:var(--t4);">of ' + m.priceChanges + '</span>' : '') + '</td>'
        + '<td class="' + (m.shortCounts > 0 ? 'neg' : '') + '">' + m.shortCounts + '</td>'
        + '<td class="' + openClass + '">' + App.fmtCurrency(m.overchargeOpen) + (m.openCount > 0 ? ' <span style="color:var(--t4);font-size:10px;">(' + m.openCount + ')</span>' : '') + '</td>'
        + '<td class="pos">' + App.fmtCurrency(m.recovered) + '</td>'
        + '<td>' + (m.avgDaysToCredit != null ? m.avgDaysToCredit + 'd' : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td><span style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + s.color + ';border:1px solid ' + s.color + ';border-radius:3px;padding:2px 6px;">' + s.label + '</span></td>'
      + '</tr>';
    }).join('');

    const tableHint = '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
      + 'Per-vendor rollup. Vendors ranked by total impact (open overcharge plus net price drift plus a small weight on total spend). Take this read into your quarterly vendor review and ask for a price match or an explanation on every line that drifted up. For the line-by-line price-change log, see <a href="#" id="vs-to-watch" style="color:var(--gold);font-weight:700;">Vendor Watch</a>.'
    + '</div>';

    const tbl = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Vendor</th><th>Deliveries</th><th>Spend</th><th>Net Drift</th>'
      + '<th>Price Updates Applied</th><th>Short Counts</th>'
      + '<th>Open Overcharge</th><th>Recovered</th><th>Avg Days to Credit</th>'
      + '<th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';

    this.container.innerHTML = '<div class="screen">' + controls + tiles + tableHint + tbl + '</div>';
    document.getElementById('vs-range')?.addEventListener('change', e => { this.range = e.target.value; this.draw(); });
    document.getElementById('vs-to-watch')?.addEventListener('click', ev => { ev.preventDefault(); App.navigate('vendor-watch'); });
  }
};
