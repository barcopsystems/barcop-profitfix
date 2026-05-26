'use strict';

/* ── Inventory Control — Dashboard (landing screen) ───────────────────────────
   At-a-glance inventory health: total value, items below par, last count,
   deliveries since that count, period purchases and top movers. */

S.InventoryDashboard = {
  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  productById(id) { return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  daysSince(str) {
    if (!str) return null;
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  },
  // items 86'd 2+ times in the last 30 days (Shift Control feed → par alerts)
  repeat86() {
    const items = (App.shiftData && App.shiftData.sc_86_list) || [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const counts = {};
    items.forEach(i => {
      const d = new Date((i.date_86 || '') + 'T00:00:00');
      if (isNaN(d.getTime()) || d < cutoff) return;
      const key = (i.item || '').trim().toLowerCase();
      if (!key) return;
      if (!counts[key]) counts[key] = { name: (i.item || '').trim(), count: 0 };
      counts[key].count++;
    });
    return Object.values(counts).filter(x => x.count >= 2).sort((a, b) => b.count - a.count);
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';

    const asc = this.countsAsc();
    const latest = asc.length ? asc[asc.length - 1] : null;
    const items = latest ? (latest.items || []) : [];

    // Below par — products in the latest count under their par level.
    // For bottle beer with case_size, par_level is in cases. Convert the
    // total bottles in the count to cases before comparing so the
    // below-par check uses the same unit on both sides.
    const belowPar = items.map(it => {
      const p = this.productById(it.product_id);
      if (!p || p.par_level == null || p.par_level === '') return null;
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      const onHand = isCaseBeer ? ((it.total || 0) / p.case_size) : (it.total || 0);
      if (onHand >= p.par_level) return null;
      return {
        name: it.name,
        onHand,
        par: p.par_level,
        isCaseBeer,
        rawBottles: it.total || 0,
        caseSize: isCaseBeer ? p.case_size : null
      };
    }).filter(Boolean);

    // Deliveries since the last count
    const sinceDels = latest ? this.deliveries().filter(d => d.date > latest.date) : this.deliveries();
    const periodPurchases = sinceDels.reduce((s, d) => s + (d.total || 0), 0);

    // Top movers (latest count period)
    let movers = [];
    if (asc.length >= 2) {
      const rows = S.InventoryMoversReport.computeForPair(asc[asc.length - 2], asc[asc.length - 1]);
      movers = [...rows].sort((a, b) => b.used - a.used).slice(0, 3);
    }

    const lastAge = latest ? this.daysSince(latest.date) : null;

    // ── Metric cards ──
    const card = (label, valHtml, target) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
    const val = (txt, cls) => '<div class="metric-val ' + (cls || '') + '">' + txt + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const cards =
        card('Total Inventory Value', latest ? val(App.fmtCurrency(latest.total_value || 0)) : noData,
             latest ? this.fmtDate(latest.date) + ' count' : 'Take a count to populate')
      + card('Items Below Par', latest ? val(String(belowPar.length), belowPar.length ? 'over-target' : 'on-target') : noData,
             latest ? 'Of ' + items.length + ' counted products' : 'No count yet')
      + card('Last Count', latest ? val(lastAge === 0 ? 'Today' : lastAge + 'd ago') : noData,
             latest ? esc(latest.type || '') + ' count' : 'No count yet')
      + card('Open Deliveries', val(String(sinceDels.length)),
             sinceDels.length ? 'Received since last count' : 'None since last count');

    // ── Alert strip — below par ──
    let alertCard = '';
    if (belowPar.length) {
      alertCard = '<div class="card"><div class="card-title">Below Par: Reorder Soon</div>'
        + belowPar.map((b, i) => '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;'
            + (i < belowPar.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:7px;height:7px;border-radius:50%;background:var(--red);flex-shrink:0;"></span>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);">' + esc(b.name)
            + ' <span style="color:var(--t3);font-size:11px;">on hand '
            + (b.isCaseBeer
                ? (b.onHand.toFixed(1) + ' cases / par ' + b.par + ' cases')
                : (b.onHand.toFixed(1) + ' / par ' + b.par))
            + '</span></div>'
            + '<button class="btn btn-ghost btn-sm ic-d-order" style="margin:0;">Add to Order</button></div>').join('')
        + '</div>';
    }

    // ── Repeat 86s — Shift Control feed → par-level alerts ──
    let repeat86Card = '';
    const reps = this.repeat86();
    if (reps.length) {
      repeat86Card = '<div class="card"><div class="card-title">Repeat 86s: Review Par Levels</div>'
        + reps.map((r, i) => '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;'
            + (i < reps.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:7px;height:7px;border-radius:50%;background:var(--gold);flex-shrink:0;"></span>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);">' + esc(r.name)
            + ' <span style="color:var(--t3);font-size:11px;">86\'d ' + r.count + ' times in the last 30 days</span></div>'
            + '<button class="btn btn-ghost btn-sm ic-d-products" style="margin:0;">Review Par</button></div>').join('')
        + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
        + 'An item that keeps running out usually has its par level set too low. Raise par in Products.</div>'
        + '</div>';
    }

    // ── This period ──
    const moverRows = movers.length
      ? movers.map(m => '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--b2);">'
          + '<span style="font-size:12px;color:var(--t2);">' + esc(m.name) + '</span>'
          + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + m.used.toFixed(1) + ' used</span></div>').join('')
      : '<div style="font-size:12px;color:var(--t3);">Two counts are needed to measure movement.</div>';

    const periodCard = '<div class="card"><div class="card-title">This Period</div>'
      + '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Purchases Since Last Count</div>'
      + '<div class="calc-val">' + App.fmtCurrency(periodPurchases) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Deliveries Logged</div>'
      + '<div class="calc-val">' + sinceDels.length + '</div></div>'
      + '</div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Top Movers</div>'
      + moverRows + '</div>';

    // ── Quick actions ──
    const actionBtn = (id, label) => '<button class="btn btn-primary ic-d-act" data-go="' + id + '" '
      + 'style="flex:1;min-width:160px;">' + label + '</button>';
    const quick = '<div class="card"><div class="card-title">Quick Actions</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + actionBtn('ic-take-inventory', 'Start Count')
      + actionBtn('ic-receive-delivery', 'Receive Delivery')
      + actionBtn('ic-order-sheet', 'Generate Order Sheet')
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + alertCard + repeat86Card + periodCard + quick + '</div>';

    this.container.onclick = ev => {
      const act = ev.target.closest('.ic-d-act');
      const ord = ev.target.closest('.ic-d-order');
      const prod = ev.target.closest('.ic-d-products');
      if (act) App.navigate(act.dataset.go);
      if (ord) App.navigate('ic-order-sheet');
      if (prod) App.navigate('ic-product-setup');
    };
  }
};
