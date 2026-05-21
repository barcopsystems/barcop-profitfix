'use strict';

/* ── Profit Recovery — Vendor Watch (read-out of ic_deliveries price changes) ──
   Loss-surfacing view. Price changes are captured automatically when a delivery
   is received in Inventory Control (an invoice price differing from the product
   master flags a change). This screen surfaces the drift and what it costs per
   year. Read-only — no manual price-change log. */

S.VendorWatch = {
  // Every price-change event across all recorded deliveries, newest first
  priceChanges() {
    const out = [];
    ((App.inventoryData && App.inventoryData.ic_deliveries) || []).forEach(d => {
      (d.line_items || []).forEach(li => {
        if (li.price_changed && li.prev_price != null && li.price_per_unit != null) {
          out.push({
            date: d.date, vendor: d.vendor, product_id: li.product_id, name: li.name,
            old: li.prev_price, new: li.price_per_unit
          });
        }
      });
    });
    return out.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  // Annualized usage of a product, from the latest two inventory counts
  annualUsage(pid) {
    const counts = [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
    if (counts.length < 2) return null;
    const s = counts[counts.length - 2], e = counts[counts.length - 1];
    const si = (s.items || []).find(it => it.product_id === pid);
    const ei = (e.items || []).find(it => it.product_id === pid);
    if (!si || !ei) return null;
    let purch = 0;
    ((App.inventoryData && App.inventoryData.ic_deliveries) || [])
      .filter(d => d.date > s.date && d.date <= e.date)
      .forEach(d => (d.line_items || []).forEach(li => { if (li.product_id === pid) purch += (li.qty || 0); }));
    const used = (si.total || 0) + purch - (ei.total || 0);
    const days = (new Date(e.date + 'T00:00:00').getTime() - new Date(s.date + 'T00:00:00').getTime()) / 86400000;
    if (days <= 0) return null;
    return used / days * 365;
  },

  fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-ghost btn-sm';
    goBtn.textContent = 'Receive Delivery';
    goBtn.addEventListener('click', () => { App.showApp('inventory'); App.navigate('ic-receive-delivery'); });
    actions.appendChild(goBtn);

    const changes = this.priceChanges().map(c => {
      const delta = c.new - c.old;
      const pct = c.old > 0 ? delta / c.old * 100 : 0;
      const au = this.annualUsage(c.product_id);
      const annual = au != null ? delta * au : null;
      return { ...c, delta, pct, annual };
    });

    let body;
    if (changes.length === 0) {
      body = '<div class="empty"><div class="empty-title">No vendor price changes yet</div>'
        + '<div class="empty-sub">Price changes are captured automatically when a delivery\'s invoice '
        + 'price differs from the product\'s current cost. Record deliveries in Inventory Control and any '
        + 'drift shows up here, with what it costs you per year.</div>'
        + '<button class="btn btn-primary" id="vw-go">Receive a Delivery</button></div>';
    } else {
      const totalAnnual = changes.reduce((s, c) => s + (c.annual || 0), 0);
      const increases = changes.filter(c => c.delta > 0).length;

      const rows = changes.map(c => '<tr>'
        + '<td>' + this.fmtDate(c.date) + '</td>'
        + '<td>' + esc(c.vendor || '—') + '</td>'
        + '<td class="val">' + esc(c.name || '—') + '</td>'
        + '<td>' + App.fmtCurrency(c.old, 2) + '</td>'
        + '<td>' + App.fmtCurrency(c.new, 2) + '</td>'
        + '<td class="' + (c.delta > 0 ? 'neg' : 'pos') + '">' + (c.delta > 0 ? '+' : '') + App.fmtPct(c.pct) + '</td>'
        + '<td class="' + (c.annual == null ? '' : c.annual > 0 ? 'neg' : 'pos') + '">'
        + (c.annual == null ? '<span style="color:var(--t4);">—</span>'
            : (c.annual > 0 ? '+' : '') + App.fmtCurrency(c.annual) + '/yr') + '</td>'
        + '</tr>').join('');

      body = '<div class="calc" style="margin-bottom:18px;">'
        + '<div class="calc-item"><div class="calc-label">Price Increases</div><div class="calc-val">' + increases + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Annual Impact</div>'
        + '<div class="calc-val ' + (totalAnnual > 0 ? 'warn' : totalAnnual < 0 ? 'good' : '') + '">'
        + (totalAnnual > 0 ? '+' : '') + App.fmtCurrency(totalAnnual) + '/yr</div></div>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
        + 'Captured automatically from deliveries received in Inventory Control. Annual impact uses each '
        + 'product\'s usage rate from your latest inventory counts.</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Product</th><th>Previous Cost</th><th>New Cost</th>'
        + '<th>Change %</th><th>Annual Impact</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + body + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#vw-go')) { App.showApp('inventory'); App.navigate('ic-receive-delivery'); }
    };
  }
};
