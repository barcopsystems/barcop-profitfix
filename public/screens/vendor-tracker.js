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

    const RANGE = [['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['180', 'Last 6 Months'], ['365', 'Last 12 Months'], ['all', 'All Time']];
    const chips = App.filterChips(this.range, RANGE.map(([v, label]) => ({ v, label })), 'vt-range-chip');
    const filterRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="vt-sc-export">Export PDF</button>'
      + '</div>';

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
    const changes = this.priceChanges().map(c => {
      const delta = c.new - c.old;
      const pct = c.old > 0 ? delta / c.old * 100 : 0;
      const au = this.annualUsage(c.product_id);
      return { ...c, delta, pct, annual: au != null ? delta * au : null };
    });

    if (!changes.length) {
      return '<div class="card"><div class="empty"><div class="empty-title">No vendor price changes yet</div>'
        + '<div class="empty-sub">Price changes are captured automatically when a delivery\'s invoice price differs from the product\'s current cost. Record deliveries in Inventory Control and any drift shows up here, with what it costs you per year.</div>'
        + '<button class="btn btn-primary" id="vt-receive" style="margin-top:14px;">Receive a Delivery</button></div></div>';
    }

    const totalAnnual = changes.reduce((s, c) => s + (c.annual || 0), 0);
    const increases = changes.filter(c => c.delta > 0).length;

    const stats = this.statsCard(
      this.statItem('Price Increases', String(increases))
      + this.statItem('Total Annual Impact', (totalAnnual > 0 ? '+' : '') + App.fmtCurrency(totalAnnual) + '/yr', totalAnnual > 0 ? 'warn' : (totalAnnual < 0 ? 'good' : ''))
    );

    const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px;">'
      + '<button class="btn btn-ghost btn-sm" id="vt-receive">Receive Delivery</button>'
      + '<button class="btn btn-ghost btn-sm" id="vt-w-export">Export PDF</button>'
      + '</div>';

    const rows = changes.map(c => '<tr>'
      + '<td>' + this.fmtDate(c.date) + '</td>'
      + '<td>' + esc(c.vendor || '-') + '</td>'
      + '<td class="val">' + esc(c.name || '-') + '</td>'
      + '<td>' + App.fmtCurrency(c.old, 2) + '</td>'
      + '<td>' + App.fmtCurrency(c.new, 2) + '</td>'
      + '<td class="' + (c.delta > 0 ? 'neg' : 'pos') + '">' + (c.delta > 0 ? '+' : '') + App.fmtPct(c.pct) + '</td>'
      + '<td class="' + (c.annual == null ? '' : c.annual > 0 ? 'neg' : 'pos') + '">'
        + (c.annual == null ? '<span style="color:var(--t4);">-</span>' : (c.annual > 0 ? '+' : '') + App.fmtCurrency(c.annual) + '/yr') + '</td>'
      + '</tr>').join('');

    const thead = '<thead><tr><th>Date</th><th>Vendor</th><th>Product</th><th>Previous Cost</th><th>New Cost</th><th>Change %</th><th>Annual Impact</th></tr></thead>';
    return stats + headRow + this.dataCard(thead, rows);
  },

  wireWatch() {
    document.getElementById('vt-receive')?.addEventListener('click', () => App.openScreen('ic-receive-delivery'));
    document.getElementById('vt-w-export')?.addEventListener('click',
      () => App.exportPDF({ title: 'Vendor Price Changes', root: this.container }));
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
    const rows = this.discRecords().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const open = rows.filter(r => r.status !== 'Resolved');
    const openTotal = open.reduce((s, r) => s + (r.overcharge || 0), 0);
    const recovered = rows.filter(r => r.status === 'Resolved').reduce((s, r) => s + ((r.recovered_amount != null ? r.recovered_amount : r.overcharge) || 0), 0);

    const stats = this.statsCard(
      this.statItem('Open Discrepancies', String(open.length), open.length ? 'warn' : 'good')
      + this.statItem('Open Overcharge', App.fmtCurrency(openTotal), openTotal > 0 ? 'warn' : '')
      + this.statItem('Recovered', App.fmtCurrency(recovered), 'good')
    );

    const headRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px;">'
      + '<button class="btn btn-ghost btn-sm" id="vt-file">+ File Manual Discrepancy</button>'
      + '<button class="btn btn-ghost btn-sm" id="vt-worksheet">Worksheet</button>'
      + '</div>';

    let body;
    if (!rows.length) {
      body = '<div class="card"><div class="empty"><div class="empty-title">No discrepancies filed</div>'
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

    return stats + headRow + body;
  },

  wireDiscrepancies() {
    document.getElementById('vt-file')?.addEventListener('click', () => this.openFileModal());
    document.getElementById('vt-worksheet')?.addEventListener('click', () => this.printBlank());
    this.container.querySelectorAll('.vt-credit').forEach(b => b.addEventListener('click', () => this.requestCredit(b.dataset.id)));
    this.container.querySelectorAll('.vt-resolve').forEach(b => b.addEventListener('click', () => this.markResolved(b.dataset.id)));
    this.container.querySelectorAll('.vt-del').forEach(b => b.addEventListener('click', () => this.removeDiscrepancy(b.dataset.id)));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.draw()));
  },

  // ── File a manual discrepancy (popup) ────────────────────────────────
  openFileModal() {
    const vendors = this.vendors().map(v => v && v.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const vendorList = '<option value="">Select vendor...</option>' + vendors.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    const typeOpts = App.VENDOR_DISCREPANCY_TYPES.map(t => '<option value="' + t + '">' + t + '</option>').join('');

    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">File a Manual Discrepancy</div>'
      + '<div class="form-row">'
        + '<div class="f" style="width:150px;"><label>Delivery Date</label><input class="form-input" type="date" id="vd-date"/></div>'
        + '<div class="f" style="width:220px;"><label>Vendor</label><select class="form-input" id="vd-vendor">' + vendorList + '</select></div>'
        + '<div class="f" style="width:160px;"><label>Invoice / Reference</label><input class="form-input" type="text" id="vd-ref" placeholder="Optional"/></div>'
        + '<div class="f" style="width:180px;"><label>Type</label><select class="form-input" id="vd-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="f" style="width:220px;"><label>Product</label><select class="form-input" id="vd-product"><option value="">Pick vendor first...</option></select></div>'
        + '<div class="f" style="width:90px;"><label>Units</label><input class="form-input" type="number" id="vd-units" step="1" placeholder="0"/></div>'
        + '<div class="f" style="width:120px;"><label>Agreed Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="vd-agreed" step="0.01"/></div></div>'
        + '<div class="f" style="width:120px;"><label>Invoiced Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="vd-invoiced" step="0.01"/></div></div>'
        + '<div class="f" style="width:140px;"><label>Overcharge / Loss</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="vd-overcharge" step="0.01"/></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:0;"><label>Notes</label><input class="form-input" type="text" id="vd-notes" placeholder="What was wrong, and who you contacted"/></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="vd-file-save">File Discrepancy</button>'
        + '<button class="btn btn-ghost" id="vd-file-cancel">Cancel</button>'
        + '<span id="vd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    App.openModal(html, { id: 'vd-file-modal', maxWidth: 720, noClose: true });
    const dateInp = document.getElementById('vd-date');
    if (dateInp && !dateInp.value) dateInp.value = App.todayLocal();

    // Live overcharge from (invoiced - agreed) x units until typed directly.
    const recompute = () => {
      const oc = document.getElementById('vd-overcharge');
      if (!oc || oc._touched) return;
      const u = parseFloat(document.getElementById('vd-units')?.value) || 0;
      const a = parseFloat(document.getElementById('vd-agreed')?.value);
      const i = parseFloat(document.getElementById('vd-invoiced')?.value);
      if (!isNaN(a) && !isNaN(i) && u) oc.value = ((i - a) * u).toFixed(2);
    };
    ['vd-units', 'vd-agreed', 'vd-invoiced'].forEach(id => document.getElementById(id)?.addEventListener('input', recompute));
    document.getElementById('vd-overcharge')?.addEventListener('input', e => { e.target._touched = true; });
    document.getElementById('vd-vendor')?.addEventListener('change', () => this.rebuildProductOptions());
    document.getElementById('vd-product')?.addEventListener('change', e => {
      const p = this.products().find(x => x.id === e.target.value);
      const ag = document.getElementById('vd-agreed');
      if (p && ag && !ag.value) ag.value = (parseFloat(p.unit_cost) || 0).toFixed(2);
    });
    document.getElementById('vd-file-save')?.addEventListener('click', () => this.fileDiscrepancy());
    document.getElementById('vd-file-cancel')?.addEventListener('click', () => App.closeModal('vd-file-modal'));
  },

  rebuildProductOptions() {
    const vendorName = document.getElementById('vd-vendor')?.value || '';
    const sel = document.getElementById('vd-product');
    if (!sel) return;
    if (!vendorName) { sel.innerHTML = '<option value="">Pick vendor first...</option>'; return; }
    const prods = this.products().filter(p => (p.vendor || '') === vendorName && p.active !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    sel.innerHTML = prods.length
      ? '<option value="">Select product...</option>' + prods.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('')
      : '<option value="">No products on file for this vendor</option>';
  },

  fileDiscrepancy() {
    const val = id => document.getElementById(id)?.value.trim() || '';
    const num = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
    const err = document.getElementById('vd-err');
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'inline'; } };

    const date = val('vd-date'), vendor = val('vd-vendor'), overcharge = num('vd-overcharge');
    if (!date)   return fail('Enter the delivery date.');
    if (!vendor) return fail('Enter the vendor.');
    if (overcharge == null) return fail('Enter the overcharge or loss amount.');

    const productId = val('vd-product');
    const product = productId ? this.products().find(p => p.id === productId) : null;
    const rec = {
      id: App.uid(), date, vendor,
      reference: val('vd-ref'), type: val('vd-type') || 'Other',
      product_id: productId, sku: (product?.name) || '',
      units: num('vd-units'), agreed_price: num('vd-agreed'), invoiced_price: num('vd-invoiced'),
      overcharge, notes: val('vd-notes'),
      status: 'Open', source: 'manual',
      filed_at: new Date().toISOString(), resolved_at: null
    };
    App.putRecord('core', 'vendor_discrepancy', rec).then(() => { App.closeModal('vd-file-modal'); this.draw(); });
  },

  // ── Request Credit (mailto to the rep, then flip to Credit Requested) ─
  requestCredit(id) {
    const r = this.discRecords().find(x => x.id === id);
    if (!r) return;
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
    window.location.href = 'mailto:' + encodeURIComponent(v?.email || '')
      + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(lines.join('\n'));

    r.status = 'Credit Requested';
    r.credit_requested_at = new Date().toISOString();
    App.putRecord('core', 'vendor_discrepancy', r).then(() => this.draw());
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

  printBlank() {
    App.printBlankSheet({
      title: 'Delivery Inspection Sheet',
      subtitle: 'Check every line at the dock. Anything off, write it down. Manager files each discrepancy in Bar Cop after close.',
      columns: [
        { label: 'Vendor', width: '14%' }, { label: 'Product', width: '20%' },
        { label: 'Ordered Qty', width: '10%' }, { label: 'Received Qty', width: '10%' },
        { label: 'Agreed Price', width: '10%' }, { label: 'Invoiced Price', width: '10%' },
        { label: 'Issue', width: '16%' }, { label: 'Receiver', width: '10%' }
      ],
      rows: 18
    });
  },

  // ── Help ──────────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Vendor Tracker Works', [
      { p: ['One place to keep your vendors honest. Three tabs read the same delivery, price, and discrepancy data: a per-vendor Scorecard, the line-by-line Price Changes, and the Discrepancies log where you chase credits.'] },
      { h: 'Scorecard', p: ['Each vendor rolled up over the range you pick: total spend, net price drift, short counts, open and recovered credits, and average days to a credit. Vendors causing the most pain sort to the top, with a status read of High, Watch, or Clean. Take this into your quarterly vendor review and ask for a price match on every line that drifted up. Export PDF saves the rollup.'] },
      { h: 'Price Changes', p: ['Every per-line price change captured automatically when a delivery is received in Inventory Control, with the annual cost of each increase based on that product\'s usage rate. Read-only; the data comes from receiving deliveries.'] },
      { h: 'Discrepancies', p: ['File a short count, an overcharge, or a substitution. Most get filed right from Receive Delivery; use File Manual Discrepancy for the ones that turn up later. Request Credit drafts an email to your rep and flips the status; Mark Resolved records what you actually got back. Print the Worksheet to inspect deliveries at the dock by hand.'] }
    ]);
  }
};
