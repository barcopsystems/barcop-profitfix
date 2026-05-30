'use strict';

/* ── Inventory Control — Dashboard (landing screen) ───────────────────────────
   A decision tool that answers status AND performance: how much cash is tied
   up, is it getting better or worse, what to order (off real usage via Dynamic
   Pars), and where you're leaking. The Health Score is a transparent rollup of
   the sub-signals shown right beside it — not a black box. All quantities are
   in container units (cases for bottle beer); reorder dollars match the Order
   Sheet. */

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

  // On-hand by product for a given count (a product is counted in several
  // locations, so sum its lines).
  _onHand(count) {
    const m = {};
    (count.items || []).forEach(it => { m[it.product_id] = (m[it.product_id] || 0) + (it.total || 0); });
    return m;
  },

  // ── Health score ─────────────────────────────────────────────────────────
  // Transparent 0-100 rollup of sub-signals, computed for any count index so we
  // can show "vs last count". Components that can't be computed (e.g. par
  // accuracy with only one count) are dropped and the remaining weights
  // renormalized. Each component is 0-100; higher is healthier.
  _healthAt(asc, idx) {
    const latest = asc[idx];
    if (!latest) return null;
    const prevC = idx >= 1 ? asc[idx - 1] : null;
    const onHand = this._onHand(latest);
    const invValue = parseFloat(latest.total_value) || 0;
    const comps = [], weights = [];
    const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

    // 1. In-stock vs reorder point (not stocked out) — 30%
    let counted = 0, atRisk = 0;
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const trig = (p.reorder_point != null && p.reorder_point !== '') ? parseFloat(p.reorder_point) : parseFloat(p.par_level);
      if (isNaN(trig) || trig <= 0) return;
      counted++; if (onHand[pid] < trig) atRisk++;
    });
    if (counted > 0) { comps.push({ key: 'stock', label: 'In-stock vs reorder', score: clamp((counted - atRisk) / counted * 100), detail: atRisk + ' at risk' }); weights.push(30); }

    // 2. Par accuracy vs usage (Dynamic Pars) — 25% (needs a prior count)
    const PS = S.InventoryParSuggestions;
    if (prevC && PS && PS.settings && PS.computeSuggestion) {
      const settings = PS.settings();
      let withPar = 0, tuned = 0;
      this.products().forEach(p => {
        if (p.par_level == null || p.par_level === '') return;
        const sug = PS.computeSuggestion(p, settings);
        if (!sug || sug.suggested == null) return;
        withPar++;
        const cur = Math.round(parseFloat(p.par_level) || 0);
        const diff = Math.abs(sug.suggested - cur);
        if (!(diff >= 1 && diff >= cur * 0.25)) tuned++;
      });
      if (withPar > 0) { comps.push({ key: 'par', label: 'Par accuracy', score: clamp(tuned / withPar * 100), detail: (withPar - tuned) + ' off' }); weights.push(25); }
    }

    // 3. Shrinkage control — 20%. Adjustments written off in the 30 days ending
    //    at this count, as a share of inventory value.
    const end = new Date(latest.date + 'T00:00:00').getTime();
    const start = end - 30 * 86400000;
    let shrink = 0;
    this.adjustments().forEach(a => {
      if (a.direction !== 'out') return;
      const t = new Date(a.date_time || a.created_at || 0).getTime();
      if (isNaN(t) || t > end || t < start) return;
      shrink += Math.abs(a.value || 0);
    });
    if (invValue > 0) { const pct = shrink / invValue * 100; comps.push({ key: 'shrink', label: 'Shrinkage control', score: clamp(100 - pct * 12), detail: App.fmtCurrency(shrink) }); weights.push(20); }

    // 4. Count cadence — 15%. Gap to the prior count (regular counting = healthy).
    if (prevC) {
      const gap = (end - new Date(prevC.date + 'T00:00:00').getTime()) / 86400000;
      comps.push({ key: 'cadence', label: 'Count cadence', score: clamp(100 - Math.max(0, gap - 7) * 7), detail: Math.round(gap) + 'd apart' }); weights.push(15);
    }

    // 5. Dead stock — 10%. On-hand value that didn't move this period.
    if (prevC) {
      const base = App.computeUsagePair(prevC, latest, this.deliveries());
      let dead = 0;
      Object.keys(onHand).forEach(pid => {
        const p = this.productById(pid); if (!p || onHand[pid] <= 0) return;
        const used = base[pid] ? Math.max(0, base[pid].rawUsed) : 0;
        if (used > 0.001) return;
        dead += onHand[pid] * (App.unitCost(p) || 0);
      });
      if (invValue > 0) { comps.push({ key: 'dead', label: 'Dead stock', score: clamp(100 - dead / invValue * 100 * 1.5), detail: App.fmtCurrency(dead) }); weights.push(10); }
    }

    const tot = weights.reduce((a, b) => a + b, 0);
    const score = tot ? Math.round(comps.reduce((s, c, i) => s + c.score * weights[i], 0) / tot) : null;
    return { score, comps };
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';

    const asc = this.countsAsc();
    const latest = asc.length ? asc[asc.length - 1] : null;
    const prev   = asc.length >= 2 ? asc[asc.length - 2] : null;

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

    const items = latest.items || [];
    const onHand = this._onHand(latest);
    const inventoryValue = parseFloat(latest.total_value) || 0;
    const lastAge = this.daysSince(latest.date);

    // Last-period usage (one computeUsagePair, reused for COGS + movement).
    let base = null, periodCost = null, weeklyCogs = null, weeksOnHand = null;
    if (prev) {
      base = App.computeUsagePair(prev, latest, this.deliveries());
      periodCost = Object.values(base).reduce((s, b) => s + (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0), 0);
      const span = (new Date(latest.date + 'T00:00:00').getTime() - new Date(prev.date + 'T00:00:00').getTime()) / 86400000;
      const weeks = span > 0 ? span / 7 : null;
      weeklyCogs = weeks ? periodCost / weeks : null;
      weeksOnHand = (weeklyCogs && weeklyCogs > 0) ? inventoryValue / weeklyCogs : null;
    }

    // Health now + prior (delta needs three counts).
    const healthNow = this._healthAt(asc, asc.length - 1);
    const healthPrev = asc.length >= 3 ? this._healthAt(asc, asc.length - 2) : null;
    const score = healthNow ? healthNow.score : null;
    const scoreDelta = (score != null && healthPrev && healthPrev.score != null) ? score - healthPrev.score : null;
    const prevCompScore = {};
    if (healthPrev) healthPrev.comps.forEach(c => { prevCompScore[c.key] = c.score; });

    // Reorder plan (same basis as Order Sheet: below par → fill to par).
    const byVendor = {};
    let reorderTotal = 0, reorderCount = 0;
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const par = parseFloat(p.par_level); if (isNaN(par) || par <= 0) return;
      const oh = onHand[pid]; if (oh >= par) return;
      const qty = Math.max(1, Math.ceil(par - oh));
      const cost = qty * (App.unitCost(p) || 0);
      const v = p.vendor || 'Unassigned';
      if (!byVendor[v]) byVendor[v] = { vendor: v, items: 0, cost: 0 };
      byVendor[v].items++; byVendor[v].cost += cost;
      reorderTotal += cost; reorderCount++;
    });
    const vendors = Object.values(byVendor).sort((a, b) => b.cost - a.cost);

    // Dynamic Pars nudge count (reuse the par-accuracy detail from health).
    let parOff = 0;
    if (healthNow) { const c = healthNow.comps.find(x => x.key === 'par'); if (c) parOff = parseInt(c.detail) || 0; }

    // Movement — fast / slow / dead, from the last period.
    const move = Object.keys(onHand).map(pid => {
      const p = this.productById(pid); if (!p) return null;
      const used = base && base[pid] ? Math.max(0, base[pid].rawUsed) : 0;
      const uc = App.unitCost(p) || 0;
      return { p, name: p.name, used, cost: used * uc, tied: onHand[pid] * uc, oh: onHand[pid], unit: App.productUnit(p) };
    }).filter(Boolean);
    const fast = base ? [...move].filter(m => m.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 3) : [];
    const dead = base ? [...move].filter(m => m.used <= 0.001 && m.oh > 0 && m.tied >= 15).sort((a, b) => b.tied - a.tied).slice(0, 3) : [];
    const fastIds = new Set(fast.map(m => m.p.id));
    const slow = base ? [...move].filter(m => m.used > 0.001 && m.oh > 0 && !fastIds.has(m.p.id)).sort((a, b) => a.cost - b.cost).slice(0, 3) : [];

    // Leaks (last 30 days).
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

    // Inventory value by category.
    const byCat = {};
    items.forEach(it => { const c = it.category || 'Other'; byCat[c] = (byCat[c] || 0) + (parseFloat(it.value) || 0); });
    const catRows = Object.entries(byCat).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const catMax = catRows.length ? catRows[0][1] : 1;

    // ── RENDER ────────────────────────────────────────────────────────────
    const card = (label, valHtml, target, cls) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + '<div class="metric-val ' + (cls || '') + '">' + valHtml + '</div>'
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
    const freshCls = lastAge != null && lastAge <= 10 ? 'on-target' : 'over-target';
    const cards =
        card('Inventory Value', App.fmtCurrency(inventoryValue),
             weeksOnHand != null ? '&asymp; ' + weeksOnHand.toFixed(1) + ' weeks on hand' : this.fmtDate(latest.date) + ' count')
      + card('To Reorder', App.fmtCurrency(reorderTotal),
             reorderCount ? reorderCount + ' item' + (reorderCount === 1 ? '' : 's') + ' &middot; ' + vendors.length + ' vendor' + (vendors.length === 1 ? '' : 's') : 'Everything at par',
             reorderCount ? 'over-target' : 'on-target')
      + card('Used This Period', periodCost != null ? App.fmtCurrency(periodCost) : '&mdash;',
             prev ? this.fmtDate(prev.date) + ' &rarr; ' + this.fmtDate(latest.date) : 'Needs two counts')
      + card('Count Freshness', lastAge === 0 ? 'Today' : lastAge + 'd ago', esc(latest.type || 'Count') + ' count', freshCls);

    // Performance band — Health Score + Since-Last-Count component trends.
    const scoreColor = score == null ? 'var(--t3)' : score >= 80 ? 'var(--gold)' : score >= 60 ? 'var(--steel)' : 'var(--red)';
    const deltaHtml = scoreDelta == null ? '<span style="font-size:12px;color:var(--t3);">first scored count</span>'
      : '<span style="font-size:13px;font-weight:700;color:' + (scoreDelta > 0 ? 'var(--gold)' : scoreDelta < 0 ? 'var(--red)' : 'var(--t3)') + ';">'
        + (scoreDelta > 0 ? '&#9650; +' : scoreDelta < 0 ? '&#9660; ' : '') + scoreDelta + ' vs last count</span>';
    const scoreCard = '<div class="card" style="height:100%;text-align:center;display:flex;flex-direction:column;justify-content:center;">'
      + '<div class="card-title" style="text-align:left;">Inventory Health</div>'
      + (score == null
          ? '<div style="font-size:13px;color:var(--t3);padding:14px 0;">Take a second count to score your inventory health.</div>'
          : '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:64px;font-weight:700;line-height:1;color:' + scoreColor + ';">'
            + score + '<span style="font-size:24px;color:var(--t3);"> / 100</span></div>'
            + '<div style="margin-top:8px;">' + deltaHtml + '</div>')
      + '</div>';

    const trendCard = '<div class="card" style="height:100%;"><div class="card-title">Since Last Count</div>'
      + (healthNow && healthNow.comps.length
          ? healthNow.comps.map((c, i) => {
              const col = c.score >= 80 ? 'var(--gold)' : c.score >= 60 ? 'var(--steel)' : 'var(--red)';
              const pv = prevCompScore[c.key];
              const arrow = pv == null ? '' : c.score > pv ? '<span style="color:var(--gold);">&#9650;</span> ' : c.score < pv ? '<span style="color:var(--red);">&#9660;</span> ' : '<span style="color:var(--t4);">&middot;</span> ';
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;'
                + (i < healthNow.comps.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
                + '<div style="flex:1;font-size:12px;color:var(--t2);">' + c.label
                + ' <span style="color:var(--t4);">' + esc(c.detail) + '</span></div>'
                + '<div style="font-size:12px;color:var(--t3);min-width:70px;text-align:right;">' + arrow + (pv != null ? (c.score > pv ? 'better' : c.score < pv ? 'worse' : 'flat') : '') + '</div>'
                + '<div style="width:90px;height:7px;background:var(--input);border-radius:4px;overflow:hidden;flex-shrink:0;">'
                + '<div style="height:100%;width:' + c.score + '%;background:' + col + ';"></div></div></div>';
            }).join('')
          : '<div style="font-size:12px;color:var(--t3);">Component trends appear once you have two counts.</div>')
      + '</div>';

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
        + '<button class="btn btn-ghost btn-sm ic-d-go" data-go="ic-order-sheet" style="margin:0;">Build Order</button></div>').join('');
      reorderCard = '<div class="card" style="height:100%;"><div class="card-title">Reorder Plan</div>'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
        + '<div style="font-size:12px;color:var(--t2);">Bring everything to par: <strong style="color:var(--gold);font-size:15px;">' + App.fmtCurrency(reorderTotal) + '</strong></div>'
        + '<button class="btn btn-primary btn-sm ic-d-go" data-go="ic-order-sheet" style="margin:0;">Open Order Sheet</button></div>'
        + vRows + (parOff ? this.parNudge(parOff) : '') + '</div>';
    }

    // Where Your Cash Sits
    const catCard = '<div class="card" style="height:100%;"><div class="card-title">Where Your Cash Sits</div>'
      + (catRows.length
          ? catRows.map(([cat, valv]) => {
              const pct = Math.max(2, Math.round(valv / catMax * 100));
              return '<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
                + '<span style="color:var(--t2);">' + esc(cat) + '</span><span style="color:var(--t1);font-weight:600;">' + App.fmtCurrency(valv) + '</span></div>'
                + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div>';
            }).join('')
          : '<div style="font-size:12px;color:var(--t3);">No counted value yet.</div>')
      + '</div>';

    // Movement — fast / slow / dead in one card so the space always works.
    const moveLine = (m, right) =>
      '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
      + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(m.name) + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;">' + right + '</div></div>';
    const moveBlock = (title, rows, emptyMsg, dotColor) =>
      '<div style="margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:6px;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">'
      + '<span style="width:6px;height:6px;border-radius:50%;background:' + dotColor + ';"></span>' + title + '</div>'
      + (rows.length ? rows : '<div style="font-size:11px;color:var(--t4);padding:2px 0;">' + emptyMsg + '</div>') + '</div>';
    const movementCard = '<div class="card" style="height:100%;"><div class="card-title">Movement</div>'
      + (!base
          ? '<div style="font-size:12px;color:var(--t3);">Take a second count to see what is moving fast, slow, and not at all.</div>'
          : moveBlock('Fast Movers', fast.map(m => moveLine(m, App.fmtCurrency(m.cost) + ' used')).join(''), 'No usage recorded.', 'var(--gold)')
            + moveBlock('Slow Movers', slow.map(m => moveLine(m, esc(App.qtyWithUnit(m.p, m.used)) + ' used')).join(''), 'Nothing crawling.', 'var(--steel)')
            + moveBlock('Dead Stock', dead.map(m => moveLine(m, App.fmtCurrency(m.tied) + ' tied')).join(''), 'Nothing stale. Every product moved.', 'var(--red)'))
      + '</div>';

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
      + (anyLeak ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Tap any line to dig in.</div>'
                 : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">No leaks flagged in the last 30 days. Clean.</div>')
      + '</div>';

    const quick = '<div class="card"><div class="card-title">Quick Actions</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + this.actionBtn('ic-take-inventory', 'Start Count')
      + this.actionBtn('ic-receive-delivery', 'Receive Delivery')
      + this.actionBtn('ic-order-sheet', 'Order Sheet')
      + this.actionBtn('ic-spot-check', 'Spot Check')
      + '</div></div>';

    const row = (a, b, ra, rb) =>
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:' + ra + ' 1 300px;min-width:0;">' + a + '</div>'
      + '<div style="flex:' + rb + ' 1 280px;min-width:0;">' + b + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + row(scoreCard, trendCard, 1, 1.6)
      + row(reorderCard, catCard, 1.7, 1)
      + row(movementCard, leakCard, 1, 1)
      + quick
      + '</div>';

    this.wire();
  },

  parNudge(n) {
    return '<div class="ic-d-go" data-go="ic-par-suggestions" style="margin-top:12px;padding:12px 14px;background:var(--input);border:1px solid var(--gold);border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span style="font-size:13px;color:var(--t1);line-height:1.5;"><strong style="color:var(--gold);">' + n + ' par' + (n === 1 ? '' : 's') + '</strong> look off versus your real usage. Tuning them sharpens these reorder numbers.</span>'
      + '<span style="font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap;">Dynamic Pars &rsaquo;</span></div>';
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
