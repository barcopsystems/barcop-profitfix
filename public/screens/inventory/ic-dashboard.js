'use strict';

/* ── Inventory Control — Dashboard (landing screen) ───────────────────────────
   A decision tool, not a stat readout. Answers the three questions an operator
   actually has: how much cash is tied up, what do I need to order (off real
   usage via Dynamic Pars), and where am I leaking. Each card routes to the
   screen that acts on it. All quantities are in container units (cases for
   bottle beer); all reorder dollars match what the Order Sheet will build. */

S.InventoryDashboard = {
  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries()   { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  products()     { return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false); },
  adjustments()  { return ((App.inventoryData && App.inventoryData.ic_adjustments) || []); },
  spotChecks()   { return ((App.inventoryData && App.inventoryData.ic_spot_checks) || []); },
  productById(id){ return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    const prev   = asc.length >= 2 ? asc[asc.length - 2] : null;

    // ── No data yet — friendly onboarding instead of broken math ──────────────
    if (!latest) {
      this.container.innerHTML = '<div class="screen">'
        + '<div class="card"><div class="card-title">Welcome to Inventory Control</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
        + 'Your dashboard fills in once you take your first count. Set up your products and locations, then run a count and Bar Cop will show you what to reorder, where your cash is tied up, and where you are leaking.</div>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
        + this.actionBtn('ic-product-setup', 'Add Products')
        + this.actionBtn('ic-take-inventory', 'Take Your First Count')
        + '</div></div></div>';
      this.wire();
      return;
    }

    // On-hand by product (a product is counted in several locations — sum them).
    const items = latest.items || [];
    const onHand = {};
    items.forEach(it => { onHand[it.product_id] = (onHand[it.product_id] || 0) + (it.total || 0); });
    const inventoryValue = parseFloat(latest.total_value) || 0;
    const lastAge = this.daysSince(latest.date);

    // ── Period usage + weeks-on-hand (needs two counts) ───────────────────────
    let periodCost = null, weeklyCogs = null, weeksOnHand = null;
    if (prev) {
      const base = App.computeUsagePair(prev, latest, this.deliveries());
      periodCost = Object.values(base).reduce((s, b) =>
        s + (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0), 0);
      const span = (new Date(latest.date + 'T00:00:00').getTime() - new Date(prev.date + 'T00:00:00').getTime()) / 86400000;
      const weeks = span > 0 ? span / 7 : null;
      weeklyCogs = weeks ? periodCost / weeks : null;
      weeksOnHand = (weeklyCogs && weeklyCogs > 0) ? inventoryValue / weeklyCogs : null;
    }

    // ── Reorder plan (same basis as the Order Sheet: below par → fill to par) ──
    const byVendor = {};
    let reorderTotal = 0, reorderCount = 0;
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid);
      if (!p) return;
      const par = parseFloat(p.par_level);
      if (isNaN(par) || par <= 0) return;
      const oh = onHand[pid];
      if (oh >= par) return;
      const qty = Math.max(1, Math.ceil(par - oh));
      const cost = qty * (App.unitCost(p) || 0);
      const v = p.vendor || 'Unassigned';
      if (!byVendor[v]) byVendor[v] = { vendor: v, items: 0, cost: 0 };
      byVendor[v].items++; byVendor[v].cost += cost;
      reorderTotal += cost; reorderCount++;
    });
    const vendors = Object.values(byVendor).sort((a, b) => b.cost - a.cost);

    // ── Dynamic Pars nudge — how many set pars disagree with real usage ───────
    let parOff = 0;
    const PS = S.InventoryParSuggestions;
    if (prev && PS && PS.settings && PS.computeSuggestion) {
      const settings = PS.settings();
      this.products().forEach(p => {
        if (p.par_level == null || p.par_level === '') return;
        const sug = PS.computeSuggestion(p, settings);
        if (!sug || sug.suggested == null) return;
        const cur = Math.round(parseFloat(p.par_level) || 0);
        const diff = Math.abs(sug.suggested - cur);
        if (diff >= 1 && diff >= cur * 0.25) parOff++;
      });
    }

    // ── Dead stock — on hand but not moving across the last few periods ───────
    const deadStock = [];
    if (prev) {
      const usageTot = {};
      const pairCount = Math.min(3, asc.length - 1);
      for (let i = asc.length - pairCount; i < asc.length; i++) {
        const b = App.computeUsagePair(asc[i - 1], asc[i], this.deliveries());
        Object.keys(b).forEach(pid => { usageTot[pid] = (usageTot[pid] || 0) + Math.max(0, b[pid].rawUsed); });
      }
      Object.keys(onHand).forEach(pid => {
        const p = this.productById(pid);
        if (!p || onHand[pid] <= 0) return;
        if ((usageTot[pid] || 0) > 0.001) return;
        const tied = onHand[pid] * (App.unitCost(p) || 0);
        if (tied < 15) return;
        deadStock.push({ name: p.name, tied, oh: onHand[pid], unit: App.productUnit(p) });
      });
      deadStock.sort((a, b) => b.tied - a.tied);
    }
    const deadTotal = deadStock.reduce((s, d) => s + d.tied, 0);

    // ── Leaks this period (last 30 days) ──────────────────────────────────────
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    let shrink = 0;
    this.adjustments().forEach(a => {
      if (a.direction !== 'out') return;
      const d = new Date(a.date_time || a.created_at || 0);
      if (isNaN(d.getTime()) || d < cutoff) return;
      shrink += Math.abs(a.value || 0);
    });
    let spotFlags = 0;
    this.spotChecks().forEach(s => {
      const d = new Date((s.date || '') + 'T00:00:00');
      if (isNaN(d.getTime()) || d < cutoff) return;
      spotFlags += (s.flagged_count || 0);
    });
    const reps = this.repeat86();

    // ── Inventory value by category (where the cash sits) ─────────────────────
    const byCat = {};
    items.forEach(it => { const c = it.category || 'Other'; byCat[c] = (byCat[c] || 0) + (parseFloat(it.value) || 0); });
    const catRows = Object.entries(byCat).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const catMax = catRows.length ? catRows[0][1] : 1;

    // ════════════════════════════════════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════════════════════════════════════
    const card = (label, valHtml, target, cls) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + '<div class="metric-val ' + (cls || '') + '">' + valHtml + '</div>'
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';

    const freshCls = lastAge != null && lastAge <= 10 ? 'on-target' : 'over-target';
    const cards =
        card('Inventory Value', App.fmtCurrency(inventoryValue),
             weeksOnHand != null ? '&asymp; ' + weeksOnHand.toFixed(1) + ' weeks on hand'
                                 : this.fmtDate(latest.date) + ' count')
      + card('To Reorder', App.fmtCurrency(reorderTotal),
             reorderCount ? reorderCount + ' item' + (reorderCount === 1 ? '' : 's') + ' &middot; ' + vendors.length + ' vendor' + (vendors.length === 1 ? '' : 's')
                          : 'Everything at par',
             reorderCount ? 'over-target' : 'on-target')
      + card('Used This Period', periodCost != null ? App.fmtCurrency(periodCost) : '&mdash;',
             prev ? this.fmtDate(prev.date) + ' &rarr; ' + this.fmtDate(latest.date) : 'Needs two counts')
      + card('Count Freshness', lastAge === 0 ? 'Today' : lastAge + 'd ago',
             esc(latest.type || 'Count') + ' count', freshCls);

    // Reorder Plan (hero)
    let reorderCard;
    if (!reorderCount) {
      reorderCard = '<div class="card" style="height:100%;"><div class="card-title">Reorder Plan</div>'
        + '<div style="font-size:13px;color:var(--t2);padding:6px 0;">Everything is at or above par. Nothing to reorder right now.</div>'
        + (parOff ? this.parNudge(parOff) : '') + '</div>';
    } else {
      const vRows = vendors.map((v, i) =>
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;'
        + (i < vendors.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
        + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(v.vendor) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + v.items + ' item' + (v.items === 1 ? '' : 's') + ' below par</div></div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(v.cost) + '</div>'
        + '<button class="btn btn-ghost btn-sm ic-d-go" data-go="ic-order-sheet" style="margin:0;">Build Order</button>'
        + '</div>').join('');
      reorderCard = '<div class="card" style="height:100%;"><div class="card-title">Reorder Plan</div>'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
        + '<div style="font-size:12px;color:var(--t2);">Bring everything to par: <strong style="color:var(--gold);font-size:15px;">' + App.fmtCurrency(reorderTotal) + '</strong></div>'
        + '<button class="btn btn-primary btn-sm ic-d-go" data-go="ic-order-sheet" style="margin:0;">Open Order Sheet</button></div>'
        + vRows
        + (parOff ? this.parNudge(parOff) : '') + '</div>';
    }

    // Where Your Cash Sits
    const catCard = '<div class="card" style="height:100%;"><div class="card-title">Where Your Cash Sits</div>'
      + (catRows.length
          ? catRows.map(([cat, valv]) => {
              const pct = Math.max(2, Math.round(valv / catMax * 100));
              return '<div style="margin-bottom:11px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
                + '<span style="color:var(--t2);">' + esc(cat) + '</span>'
                + '<span style="color:var(--t1);font-weight:600;">' + App.fmtCurrency(valv) + '</span></div>'
                + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;">'
                + '<div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div>';
            }).join('')
          : '<div style="font-size:12px;color:var(--t3);">No counted value yet.</div>')
      + '</div>';

    // Dead Stock
    let deadCard = '<div class="card" style="height:100%;"><div class="card-title">Dead Stock</div>';
    if (!prev) {
      deadCard += '<div style="font-size:12px;color:var(--t3);">Take a second count and Bar Cop flags product that is sitting still and tying up cash.</div>';
    } else if (!deadStock.length) {
      deadCard += '<div style="font-size:12px;color:var(--t3);">Nothing stale. Every product on hand moved in your recent counts.</div>';
    } else {
      deadCard += '<div style="font-size:12px;color:var(--t2);margin-bottom:8px;"><strong style="color:var(--red);">' + App.fmtCurrency(deadTotal) + '</strong> sitting still across ' + deadStock.length + ' product' + (deadStock.length === 1 ? '' : 's') + '.</div>'
        + deadStock.slice(0, 6).map((d, i) =>
            '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;'
            + (i < Math.min(6, deadStock.length) - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);">' + esc(d.name)
            + ' <span style="color:var(--t3);">' + esc(App.qtyWithUnit({ category: '', unit_type: d.unit }, d.oh)) + ' on hand</span></div>'
            + '<div style="font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(d.tied) + '</div></div>').join('')
        + '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Slow movers tie up cash and risk spoilage. Lower their par or run a feature to move them.</div>';
    }
    deadCard += '</div>';

    // Leaks
    const leakRow = (label, val, screen, warn) =>
      '<div class="ic-d-go" data-go="' + screen + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="font-size:12px;color:var(--t2);">' + label + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + ' &rsaquo;</span></div>';
    const anyLeak = shrink > 0 || spotFlags > 0 || reps.length > 0;
    const leakCard = '<div class="card" style="height:100%;"><div class="card-title">Leaks &amp; Watch</div>'
      + leakRow('Shrinkage written off (30d)', App.fmtCurrency(shrink), 'ic-adjustments', shrink > 0)
      + leakRow('Spot-check flags (30d)', String(spotFlags), 'ic-spot-check', spotFlags > 0)
      + leakRow('Repeat 86s (30d)', String(reps.length), 'ic-par-suggestions', reps.length > 0)
      + (anyLeak
          ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Tap any line to dig in.</div>'
          : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">No leaks flagged in the last 30 days. Clean.</div>')
      + '</div>';

    // Quick actions
    const quick = '<div class="card"><div class="card-title">Quick Actions</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + this.actionBtn('ic-take-inventory', 'Start Count')
      + this.actionBtn('ic-receive-delivery', 'Receive Delivery')
      + this.actionBtn('ic-order-sheet', 'Order Sheet')
      + this.actionBtn('ic-spot-check', 'Spot Check')
      + '</div></div>';

    const row = (a, b, ratioA, ratioB) =>
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:' + ratioA + ' 1 340px;min-width:0;">' + a + '</div>'
      + '<div style="flex:' + ratioB + ' 1 260px;min-width:0;">' + b + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + row(reorderCard, catCard, 1.7, 1)
      + row(deadCard, leakCard, 1, 1)
      + quick
      + '</div>';

    this.wire();
  },

  parNudge(n) {
    return '<div class="ic-d-go" data-go="ic-par-suggestions" style="margin-top:12px;padding:10px 12px;background:var(--input);border:1px solid var(--b2);border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;">'
      + '<span style="font-size:11px;color:var(--t2);line-height:1.5;"><strong style="color:var(--gold);">' + n + ' par' + (n === 1 ? '' : 's') + '</strong> look off versus your real usage. Tuning them sharpens these reorder numbers.</span>'
      + '<span style="font-size:11px;font-weight:700;color:var(--gold);white-space:nowrap;">Dynamic Pars &rsaquo;</span></div>';
  },

  actionBtn(id, label) {
    return '<button class="btn btn-primary ic-d-go" data-go="' + id + '" style="flex:1;min-width:150px;">' + label + '</button>';
  },

  wire() {
    this.container.onclick = ev => {
      const go = ev.target.closest('.ic-d-go');
      if (go && go.dataset.go) App.navigate(go.dataset.go);
    };
  }
};
