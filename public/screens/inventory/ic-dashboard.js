'use strict';

/* ── Inventory Control — Dashboard (landing screen) ───────────────────────────
   A decision tool: how much cash is tied up, what to order (off real usage via
   Dynamic Pars), what's moving, what changed since last count, and where you're
   leaking. Every number is computed from real data — no composite scores (that's
   what the audits are for). Quantities are in container units (cases for bottle
   beer); reorder dollars match the Order Sheet.

   Card standard (matches the Shift / Labor dashboards): KPI metric tiles, a
   full-width banded hero, two equal-height rows of heading-outside panels, then
   Quick Actions, with a day-one Get Started state until the first count lands. */

S.InventoryDashboard = {
  showHowTo() {
    App.showHelpModal('How the Inventory Dashboard Works', [
      { p: ['This is the Inventory landing screen, built to answer four questions at a glance: how much cash is sitting on your shelves, what you need to reorder, what is moving, and where you are leaking. Every number is figured from your real counts, deliveries, and logs. There are no made-up scores here, that is what the Bar Cop Audit is for. Until your first count lands, the screen shows a Get Started strip with the four steps to fill it in.'] },
      { h: 'The Four Tiles Up Top', p: ['Inventory Value is the dollars on hand from your latest count, with a rough read on how many weeks of usage that covers. To Reorder is the cost to bring everything back to par, with the item and vendor count behind it. Used This Period is the cost of what you went through between your last two counts. Count Freshness is how many days since you last counted, and it turns amber once a count is more than ten days old, because a stale count makes every number below it soft.'] },
      { h: 'Reorder Plan', p: ['The wide band under the tiles is your order, grouped by vendor and totaled. It uses the same below-par math as the Order Sheet, so if House Cabernet drops under par it shows up under its vendor with the cost to refill. Hit Create Order on a vendor that still needs one; a vendor you have already ordered shows its live status (Open or Submitted) straight from the Order Sheet, and Open Order Sheet in the header jumps to the full thing. If a handful of pars look off versus your real usage, a nudge points you to Dynamic Pars, because the reorder number is only as good as the pars behind it.'] },
      { h: 'Where Your Cash Sits And Movement', p: ['Where Your Cash Sits breaks your counted value down by category, so you can see if you are carrying too deep on Liquor versus Bottle Beer. Movement reads the last period three ways: Fast Movers (the workhorses to keep stocked deep), Slow Movers (crawling), and Dead Stock (counted, paid for, and did not move at all). A bottle of an odd amaro sitting at 40 dollars tied up with zero usage is exactly what Dead Stock is there to surface.'] },
      { h: 'Since Last Count And Leaks', p: ['Since Last Count is an honest better-or-worse readout on real signals: percent in stock versus reorder, how close your pars track usage, shrinkage written off, days between counts, and dead stock, each showing the prior value next to the current one so you can read the direction. Leaks and Watch surfaces the three things worth chasing in the last 30 days: shrinkage written off in the Adjustment Log, spot-check flags, and any item 86d twice or more. Tap any line to jump straight to it. A clean 30 days says so in plain words.'] },
      { h: 'Quick Actions And Day One', p: ['The buttons at the bottom jump you to the jobs you run most: Start Count, Receive Delivery, Order Sheet, and Spot Check. Before your first count, the dashboard shows this same layout in placeholder form with a Get Started strip: list vendors, add products, set locations, then take your first count. The moment that count lands, every panel fills with real numbers.'] }
    ]);
  },

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
  _onHand(count) {
    const m = {};
    (count.items || []).forEach(it => { m[it.product_id] = (m[it.product_id] || 0) + (it.total || 0); });
    return m;
  },

  // ── Health signals at a given count index — raw, honest metrics (no score) ──
  // Each carries its real value + which direction is "good", so Since-Last-Count
  // can show an honest better/worse without inventing a composite number.
  _signalsAt(asc, idx) {
    const latest = asc[idx];
    if (!latest) return null;
    const prevC = idx >= 1 ? asc[idx - 1] : null;
    const onHand = this._onHand(latest);
    const comps = [];

    // In-stock vs reorder (not stocked out)
    let counted = 0, atRisk = 0;
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const trig = (p.reorder_point != null && p.reorder_point !== '') ? parseFloat(p.reorder_point) : parseFloat(p.par_level);
      if (isNaN(trig) || trig <= 0) return;
      counted++; if (onHand[pid] < trig) atRisk++;
    });
    if (counted > 0) comps.push({ key: 'stock', label: 'In-stock vs reorder', raw: (counted - atRisk) / counted * 100, lowerBetter: false, fmt: v => Math.round(v) + '% stocked' });

    // Par accuracy vs usage (Dynamic Pars)
    const PS = S.InventoryParSuggestions;
    if (prevC && PS && PS.settings && PS.computeSuggestion) {
      const settings = PS.settings();
      let withPar = 0, tuned = 0;
      this.products().forEach(p => {
        if (p.par_level == null || p.par_level === '') return;
        const sug = PS.computeSuggestion(p, settings, latest.date);
        if (!sug || sug.suggested == null) return;
        withPar++;
        const cur = Math.round(parseFloat(p.par_level) || 0);
        const diff = Math.abs(sug.suggested - cur);
        if (!(diff >= 1 && diff >= cur * 0.25)) tuned++;
      });
      if (withPar > 0) comps.push({ key: 'par', label: 'Par accuracy', raw: tuned / withPar * 100, lowerBetter: false, fmt: v => Math.round(v) + '% on target', off: withPar - tuned });
    }

    // Shrinkage written off in the 30 days ending at this count
    const end = new Date(latest.date + 'T00:00:00').getTime();
    const start = end - 30 * 86400000;
    let shrink = 0;
    this.adjustments().forEach(a => {
      if (a.direction !== 'out') return;
      const t = new Date(a.date_time || a.created_at || 0).getTime();
      if (isNaN(t) || t > end || t < start) return;
      shrink += Math.abs(a.value || 0);
    });
    comps.push({ key: 'shrink', label: 'Shrinkage (30d)', raw: shrink, lowerBetter: true, fmt: v => App.fmtCurrency(v) });

    // Days between counts (gap to prior count)
    if (prevC) {
      const gap = (end - new Date(prevC.date + 'T00:00:00').getTime()) / 86400000;
      comps.push({ key: 'count_gap', label: 'Days between counts', raw: gap, lowerBetter: true, fmt: v => Math.round(v) + 'd apart' });
    }

    // Dead stock value (on hand but didn't move this period)
    if (prevC) {
      const base = App.computeUsagePair(prevC, latest, this.deliveries());
      let dead = 0;
      Object.keys(onHand).forEach(pid => {
        const p = this.productById(pid); if (!p || onHand[pid] <= 0) return;
        const used = base[pid] ? Math.max(0, base[pid].rawUsed) : 0;
        if (used > 0.001) return;
        dead += onHand[pid] * (App.unitCost(p) || 0);
      });
      comps.push({ key: 'dead', label: 'Dead stock', raw: dead, lowerBetter: true, fmt: v => App.fmtCurrency(v) });
    }
    return { comps };
  },

  // ── Card standard helpers (match the Shift / Labor dashboards) ───────────────
  metricCard(label, valHtml, target, cls) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + '<div class="metric-val ' + (cls || '') + '">' + valHtml + '</div>'
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
  },
  // Full-width hero: a .form-card with a banded title (optional right action).
  panelCard(title, bodyHtml, titleRight) {
    return '<div class="card form-card" style="height:100%;">'
      + '<div class="card-title"' + (titleRight ? ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;"' : '') + '>'
      + '<span>' + title + '</span>' + (titleRight || '') + '</div>'
      + bodyHtml + '</div>';
  },
  // Grid panel: title OUTSIDE the card as a .sh heading so side-by-side panels
  // line up on top; the card flexes to fill its row column for equal height.
  shPanel(title, bodyHtml) {
    return '<div class="sh" style="margin:0 0 10px;">' + title + '</div>'
      + '<div class="card" style="flex:1;">' + bodyHtml + '</div>';
  },
  actionBtn(id, label) {
    return '<button class="btn btn-primary ic-d-go" data-go="' + id + '" style="flex:1;min-width:150px;">' + label + '</button>';
  },
  quickActions() {
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + this.actionBtn('ic-take-inventory', 'Start Count')
      + this.actionBtn('ic-receive-delivery', 'Receive Delivery')
      + this.actionBtn('ic-order-sheet', 'Order Sheet')
      + this.actionBtn('ic-spot-check', 'Spot Check')
      + '</div></div>';
  },
  // Two equal-height columns: each column is a flex-column so the card inside
  // (flex:1) grows to match its row-mate even with the .sh heading outside.
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 280px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const asc = this.countsAsc();
    const latest = asc.length ? asc[asc.length - 1] : null;
    if (!latest) this.renderDayOne();
    else this.renderFull(asc, latest, asc.length >= 2 ? asc[asc.length - 2] : null);
    this.wire();
  },

  // ── Day-one: the real layout in placeholder form + Get Started ───────────────
  renderDayOne() {
    const hasProducts  = this.products().length > 0;
    const hasLocations = ((App.inventoryData && App.inventoryData.ic_locations) || []).length > 0;
    const hasVendors   = ((App.inventoryData && App.inventoryData.ic_vendors) || []).length > 0;
    const step = (done, num, label, screen) =>
      '<div class="ic-d-go" data-go="' + screen + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid ' + (done ? 'var(--b2)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (done ? 'var(--input)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;' + (done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (done ? '&#10003;' : num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + label + '</span></div>';

    const startStrip = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Four steps and this dashboard fills in with what to reorder, where your cash is tied up, and where you are leaking.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + step(hasVendors,   1, 'List vendors',          'ic-vendors')
      + step(hasProducts,  2, 'Add products',          'ic-product-setup')
      + step(hasLocations, 3, 'Set locations',         'ic-locations')
      + step(false,        4, 'Take your first count', 'ic-take-inventory')
      + '</div></div>';

    const cards =
        this.metricCard('Inventory Value', '$0', 'After your first count')
      + this.metricCard('To Reorder', '&mdash;', 'After your first count')
      + this.metricCard('Used This Period', '&mdash;', 'Needs two counts')
      + this.metricCard('Count Freshness', 'No counts', 'Take your first count');

    const hero = this.panelCard('Reorder Plan',
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">Add products and take a count, then Bar Cop builds your reorder plan by vendor right here.</div>'
      + '<button class="btn btn-primary btn-sm ic-d-go" data-go="ic-take-inventory" style="margin:0;">Take Your First Count</button></div>');

    const emptyBody = msg => '<div style="font-size:12px;color:var(--t3);line-height:1.6;">' + msg + '</div>';
    const catCard      = this.shPanel('Where Your Cash Sits', emptyBody('Take a count to see how much cash is tied up in each category.'));
    const movementCard = this.shPanel('Movement', emptyBody('Take two counts to see what is moving fast, slow, and not at all.'));
    const sinceCard    = this.shPanel('Since Last Count', emptyBody('Trends appear once you have two counts.'));
    const leakCard     = this.shPanel('Leaks &amp; Watch', emptyBody('Shrinkage and spot-check flags surface here as you log.'));

    this.container.innerHTML = '<div class="screen">'
      + startStrip
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div style="margin-bottom:16px;">' + hero + '</div>'
      + this.row(catCard, movementCard)
      + this.row(sinceCard, leakCard)
      + this.quickActions()
      + '</div>';
  },

  // ── Populated dashboard ──────────────────────────────────────────────────────
  renderFull(asc, latest, prev) {
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

    // Since-last-count signals (raw metrics + direction).
    const sigNow = this._signalsAt(asc, asc.length - 1);
    const sigPrev = asc.length >= 3 ? this._signalsAt(asc, asc.length - 2) : null;
    const prevRaw = {};
    if (sigPrev) sigPrev.comps.forEach(c => { prevRaw[c.key] = c.raw; });

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

    let parOff = 0;
    if (sigNow) { const pc = sigNow.comps.find(c => c.key === 'par'); if (pc) parOff = pc.off || 0; }

    // Movement — fast / slow / dead, from the last period.
    const move = Object.keys(onHand).map(pid => {
      const p = this.productById(pid); if (!p) return null;
      const used = base && base[pid] ? Math.max(0, base[pid].rawUsed) : 0;
      const uc = App.unitCost(p) || 0;
      return { p, name: p.name, used, cost: used * uc, tied: onHand[pid] * uc, oh: onHand[pid] };
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

    // Inventory value by category.
    const byCat = {};
    items.forEach(it => { const c = it.category || 'Other'; byCat[c] = (byCat[c] || 0) + (parseFloat(it.value) || 0); });
    const catRows = Object.entries(byCat).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const catMax = catRows.length ? catRows[0][1] : 1;

    // ── KPI tiles ──
    const freshCls = lastAge != null && lastAge <= 10 ? 'on-target' : 'over-target';
    const cards =
        this.metricCard('Inventory Value', App.fmtCurrency(inventoryValue),
             weeksOnHand != null ? '&asymp; ' + weeksOnHand.toFixed(1) + ' weeks on hand' : this.fmtDate(latest.date) + ' count')
      + this.metricCard('To Reorder', App.fmtCurrency(reorderTotal),
             reorderCount ? reorderCount + ' item' + (reorderCount === 1 ? '' : 's') + ' &middot; ' + vendors.length + ' vendor' + (vendors.length === 1 ? '' : 's') : 'Everything at par',
             reorderCount ? 'over-target' : 'on-target')
      + this.metricCard('Used This Period', periodCost != null ? App.fmtCurrency(periodCost) : '-',
             prev ? this.fmtDate(prev.date) + ' &rarr; ' + this.fmtDate(latest.date) : 'Needs two counts')
      + this.metricCard('Count Freshness', lastAge === 0 ? 'Today' : lastAge + 'd ago', esc(latest.type || 'Count') + ' count', freshCls);

    // ── Reorder Plan (full-width banded hero) ──
    let reorderHero;
    const openOsBtn = '<button class="btn btn-ghost btn-sm ic-d-go" data-go="ic-order-sheet" style="margin:0;">Open Order Sheet</button>';
    if (!reorderCount) {
      reorderHero = this.panelCard('Reorder Plan',
        '<div style="font-size:13px;color:var(--t2);padding:6px 0;">Everything is at or above par. Nothing to reorder right now.</div>'
        + (parOff ? this.parNudge(parOff) : ''),
        openOsBtn);
    } else {
      // Reflect the live Order Sheet state: a vendor with an in-flight order shows
      // its status (Open / Submitted); only vendors with no order get Create Order.
      const vRows = vendors.map((v, i) => {
        const order = (S.InventoryOrderSheet && S.InventoryOrderSheet.openOrderForVendor) ? S.InventoryOrderSheet.openOrderForVendor(v.vendor) : null;
        const action = order
          ? '<span class="ic-d-go" data-go="ic-order-sheet" style="font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer;color:' + (order.status === 'Submitted' ? 'var(--green)' : 'var(--gold)') + ';">Order ' + esc(order.status || 'Open') + '</span>'
          : '<button class="btn btn-ghost btn-sm ic-d-go" data-go="ic-order-sheet" style="margin:0;">Create Order</button>';
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;'
          + (i < vendors.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
          + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(v.vendor) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);">' + v.items + ' item' + (v.items === 1 ? '' : 's') + ' below par</div></div>'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(v.cost) + '</div>'
          + '<div style="width:130px;flex-shrink:0;display:flex;justify-content:center;">' + action + '</div></div>';
      }).join('');
      reorderHero = this.panelCard('Reorder Plan',
        '<div style="font-size:12px;color:var(--t2);margin-bottom:6px;">Bring everything to par: <strong style="color:var(--gold);font-size:15px;">' + App.fmtCurrency(reorderTotal) + '</strong></div>'
        + vRows + (parOff ? this.parNudge(parOff) : ''),
        openOsBtn);
    }

    // ── Where Your Cash Sits (the one bar chart on the page) ──
    const catBody = catRows.length
      ? catRows.map(([cat, valv]) => {
          const pct = Math.max(2, Math.round(valv / catMax * 100));
          return '<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
            + '<span style="color:var(--t2);">' + esc(cat) + '</span><span style="color:var(--t1);font-weight:600;">' + App.fmtCurrency(valv) + '</span></div>'
            + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3);">No counted value yet.</div>';

    // ── Movement — fast / slow / dead in one panel ──
    const moveLine = (m, right) =>
      '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
      + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(m.name) + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;">' + right + '</div></div>';
    const moveBlock = (title, rows, emptyMsg, dotColor) =>
      '<div style="margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:6px;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">'
      + '<span style="width:6px;height:6px;border-radius:50%;background:' + dotColor + ';"></span>' + title + '</div>'
      + (rows.length ? rows : '<div style="font-size:11px;color:var(--t4);padding:2px 0;">' + emptyMsg + '</div>') + '</div>';
    const moveBody = !base
      ? '<div style="font-size:12px;color:var(--t3);">Take a second count to see what is moving fast, slow, and not at all.</div>'
      : moveBlock('Fast Movers', fast.map(m => moveLine(m, App.fmtCurrency(m.cost) + ' used')).join(''), 'No usage recorded.', 'var(--gold)')
        + moveBlock('Slow Movers', slow.map(m => moveLine(m, App.fmtCurrency(m.cost) + ' used')).join(''), 'Nothing crawling.', 'var(--steel)')
        + moveBlock('Dead Stock', dead.map(m => moveLine(m, App.fmtCurrency(m.tied) + ' tied')).join(''), 'Nothing stale. Every product moved.', 'var(--red)');

    // ── Since Last Count — directional readout, no bars ──
    const sinceBody = sigNow && sigNow.comps.length
      ? sigNow.comps.map((c, i) => {
          const pv = prevRaw[c.key];
          let icon = '&#8226;', word = '', col = 'var(--t4)';
          if (pv != null) {
            const eps = 1e-6;
            const improved = c.lowerBetter ? c.raw < pv - eps : c.raw > pv + eps;
            const worsened = c.lowerBetter ? c.raw > pv + eps : c.raw < pv - eps;
            if (improved) { icon = '&#9650;'; word = 'Improving'; col = 'var(--gold)'; }
            else if (worsened) { icon = '&#9660;'; word = 'Slipping'; col = 'var(--red)'; }
            else { icon = '&#8211;'; word = 'Flat'; col = 'var(--t4)'; }
          }
          const detail = pv != null ? esc(c.fmt(pv)) + ' &rarr; ' + esc(c.fmt(c.raw)) : esc(c.fmt(c.raw));
          return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;'
            + (i < sigNow.comps.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:14px;text-align:center;color:' + col + ';font-size:12px;flex-shrink:0;">' + icon + '</span>'
            + '<div style="flex:1;min-width:0;"><div style="font-size:12px;color:var(--t1);">' + c.label + '</div>'
            + '<div style="font-size:11px;color:var(--t3);">' + detail + '</div></div>'
            + '<span style="font-size:11px;font-weight:700;color:' + col + ';white-space:nowrap;">' + word + '</span></div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3);">Trends appear once you have two counts.</div>';

    // ── Leaks & Watch ──
    const leakRow = (label, val, screen, warn) =>
      '<div class="ic-d-go" data-go="' + screen + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="font-size:12px;color:var(--t2);">' + label + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + ' &rsaquo;</span></div>';
    const anyLeak = shrink > 0 || spotFlags > 0;
    const leakBody = leakRow('Shrinkage written off (30d)', App.fmtCurrency(shrink), 'ic-adjustments', shrink > 0)
      + leakRow('Spot-check flags (30d)', String(spotFlags), 'ic-spot-check', spotFlags > 0)
      + (anyLeak ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Tap any line to dig in.</div>'
                 : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">No leaks flagged in the last 30 days. Clean.</div>');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div style="margin-bottom:16px;">' + reorderHero + '</div>'
      + this.row(this.shPanel('Where Your Cash Sits', catBody), this.shPanel('Movement', moveBody))
      + this.row(this.shPanel('Since Last Count', sinceBody), this.shPanel('Leaks &amp; Watch', leakBody))
      + this.quickActions()
      + '</div>';
  },

  parNudge(n) {
    return '<div class="ic-d-go" data-go="ic-par-suggestions" style="margin-top:12px;padding:11px 13px;background:var(--input);border:1px solid var(--b2);border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span style="font-size:13px;color:var(--t1);line-height:1.5;"><strong style="color:var(--gold);">' + n + ' par' + (n === 1 ? '' : 's') + '</strong> look off versus your real usage. Tuning them sharpens these reorder numbers.</span>'
      + '<span style="font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap;">Dynamic Pars &rsaquo;</span></div>';
  },

  wire() {
    this.container.onclick = ev => {
      const go = ev.target.closest('.ic-d-go');
      if (go && go.dataset.go) App.navigate(go.dataset.go);
    };
  }
};
