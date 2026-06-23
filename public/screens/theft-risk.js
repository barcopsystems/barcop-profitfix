'use strict';

/* ── Profit Recovery — Theft Risk (a live leak detector, not a score) ─────────
   The job is to CATCH theft on the shift it happens and investigate it, which
   is what recovers money. No 0-100 score. The page shows what flagged TODAY and
   over the LAST 7 DAYS from the data you already log — drawer shorts, flagged
   spot checks, and confirmed theft from the Adjustment Log — then lets you open
   and work a Variance Investigation. Per-server sales-pattern theft (no-sales,
   voids, comps, cash mix) lives in its own Sales Integrity screen. The Theft &
   Loss Brief is the periodic 90-day review.

   (Coming next: flags push to the Hub critical alerts + an Open-the-Floor
   warning for the next manager, so this never becomes a page nobody opens.) */

S.TheftRisk = {
  spotChecks() { return ((App.inventoryData && App.inventoryData.ic_spot_checks) || []); },
  voidComps() {
    return ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => {
      if (r.type === 'Void') return true;
      return App.compReasonIsLoss(r.reason || r.category);
    });
  },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  adjustments() { return ((App.inventoryData && App.inventoryData.ic_adjustments) || []); },
  products() { return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false); },
  productById(id) { return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },

  // ── Flag signals over a window (from `fromStr` through today) ────────────────
  // Returns event count + dollar amount per signal. Used for both the Today
  // column (fromStr = today) and the Last-7-Days column (fromStr = a week ago),
  // and at 90 days for the Brief.
  _signalData(fromStr) {
    const inRange = d => { const ds = d ? String(d).slice(0, 10) : ''; return ds && ds >= fromStr; };
    const shorts = this.variances().filter(v => v.status === 'Short' && inRange(v.date));
    const spots = [];
    this.spotChecks().forEach(c => { if (inRange(c.date)) (c.items || []).forEach(it => { if (it.flagged) spots.push(it); }); });
    const theft = this.adjustments().filter(a => a.reason === 'Theft' && inRange((a.date_time || '').slice(0, 10)));
    return {
      shorts:    { count: shorts.length,    amount: Math.abs(shorts.reduce((s, v) => s + Math.min(0, v.variance || 0), 0)) },
      spots:     { count: spots.length,     amount: spots.reduce((s, it) => s + Math.max(0, it.variance_dollar || 0), 0) },
      theft:     { count: theft.length,     amount: theft.reduce((s, a) => s + Math.abs(a.value || 0), 0) }
    };
  },
  _totalFlags(d) { return d.shorts.count + d.spots.count + d.theft.count; },

  // Recent flag events as a flat list, so the Hub alert and the Open-the-Floor
  // warning read the same definition of a dated "flag" (one source). severe =
  // confirmed theft (the one that should not hide). Comp-volume is a windowed
  // pattern, not a dated event, so it surfaces on the page, not in this stream.
  recentFlags(fromStr) {
    const inRange = d => { const ds = d ? String(d).slice(0, 10) : ''; return ds && ds >= fromStr; };
    const out = [];
    this.variances().forEach(v => { if (v.status === 'Short' && inRange(v.date)) out.push({ date: String(v.date).slice(0, 10), severe: false }); });
    this.spotChecks().forEach(c => { if (inRange(c.date)) (c.items || []).forEach(it => { if (it.flagged) out.push({ date: String(c.date).slice(0, 10), severe: false }); }); });
    this.adjustments().forEach(a => { const d = (a.date_time || '').slice(0, 10); if (a.reason === 'Theft' && inRange(d)) out.push({ date: d, severe: true }); });
    return out;
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    const today = App.todayLocal();
    const wk = new Date(); wk.setDate(wk.getDate() - 6);
    const weekStart = App.ymdLocal(wk);
    const td = this._signalData(today);
    const wkd = this._signalData(weekStart);
    const open = (App.data.variance_investigations || []).filter(i => i.status !== 'resolved');
    const flagsWeek = this._totalFlags(wkd);
    const flagsToday = this._totalFlags(td);

    // Banner: the act-now cue when there are flags in the last 7 days.
    const banner = flagsWeek > 0
      ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin-bottom:14px;font-size:12px;color:var(--t1);"><strong>' + flagsWeek + ' flag' + (flagsWeek === 1 ? '' : 's') + ' in the last 7 days.</strong> Review below and open an investigation on anything that does not add up.</div>'
      : '';

    // Stat strip (no score — counts + dollars that drive action).
    const stat = (label, valHtml, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + valHtml + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Flags Today', String(flagsToday), flagsToday > 0 ? 'warn' : '')
      + stat('Flags This Week', String(flagsWeek), flagsWeek > 0 ? 'warn' : '')
      + stat('Confirmed Theft (7d)', wkd.theft.amount ? App.fmtCurrency(wkd.theft.amount) : '-', wkd.theft.count ? 'warn' : '')
      + stat('Open Investigations', String(open.length))
      + '</div></div>';

    // Flags table — Today + Last 7 Days per signal. Today colors red when > 0.
    const fRow = (name, t, w, amt) => '<tr>'
      + '<td><div class="val">' + name + '</div></td>'
      + '<td style="color:' + (t > 0 ? 'var(--red)' : 'var(--t3)') + ';font-weight:700;">' + t + '</td>'
      + '<td>' + w + '</td>'
      + '<td>' + (amt ? App.fmtCurrency(amt) : '-') + '</td>'
      + '</tr>';
    const flagsTable = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px;">'
      + '<div class="sh" style="margin:0;">What Flagged</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="tr-brief">Theft and Loss Brief</button>'
      + '</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Signal</th><th>Today</th><th>Last 7 Days</th><th>Amount (7d)</th></tr></thead><tbody>'
      + fRow('Cash drawer shorts', td.shorts.count, wkd.shorts.count, wkd.shorts.amount)
      + fRow('Flagged spot checks', td.spots.count, wkd.spots.count, wkd.spots.amount)
      + fRow('Confirmed theft (adjustment log)', td.theft.count, wkd.theft.count, wkd.theft.amount)
      + '</tbody></table></div></div>';

    this.container.innerHTML = '<div class="screen">' + banner + statStrip + flagsTable
      + this.investigationsSection() + '</div>';

    // Wiring
    document.getElementById('tr-brief')?.addEventListener('click', () => this.printBrief());

    this.container.querySelector('.vi-open-btn')?.addEventListener('click', () => {
      const sel = this.container.querySelector('.vi-product-select');
      const productId = sel && sel.value;
      if (!productId) { if (sel) sel.style.borderColor = 'var(--red)'; return; }
      const p = this.productById(productId);
      const existing = (App.data.variance_investigations || []).find(i => i.product_id === productId && i.status !== 'resolved');
      if (existing) { App.pushView(() => this.renderInvestigation(existing.id)); return; }
      const inv = {
        id: App.uid(), product_id: productId, sku: (p && p.name) || productId,
        opened_date: App.todayLocal(), created_at: new Date().toISOString(),
        status: 'open', steps: this.VARIANCE_STEPS.map(() => ({ done: false, finding: '' })), resolution: ''
      };
      App.putRecord('core', 'variance_investigation', inv);
      App.pushView(() => this.renderInvestigation(inv.id));
    });
    this.container.querySelector('.vi-print-blank')?.addEventListener('click', () => this.printBlankInvestigation());
    this.container.querySelectorAll('.vi-open-detail').forEach(b => b.addEventListener('click', () => App.pushView(() => this.renderInvestigation(b.dataset.inv))));
    this.container.querySelectorAll('.vi-remove').forEach(b => b.addEventListener('click', () => {
      App.removeRecord('core', 'variance_investigation', b.dataset.inv).then(() => this.renderMain());
    }));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e => App.handleShowOlder(e.target, () => this.renderMain()));
  },

  // ── Variance Investigations — compact list (drill into one) ───────────────
  investigationsSection() {
    const invs = App.data.variance_investigations || [];
    const open = invs.filter(i => i.status !== 'resolved');
    const resolved = invs.filter(i => i.status === 'resolved');

    const prods = this.products();
    const catOrder = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => { const ia = catOrder.indexOf(a), ib = catOrder.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    let productOpts = '<option value="">Pick a product to investigate...</option>';
    cats.forEach(cat => {
      productOpts += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(p => { productOpts += '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; });
      productOpts += '</optgroup>';
    });

    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:22px 0 10px;">'
      + '<div class="sh" style="margin:0;">Variance Investigations</div>'
      + '<button class="btn btn-ghost btn-sm no-print vi-print-blank">Worksheet</button>'
      + '</div>'
      + '<div class="card form-card">'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;margin-bottom:0;">'
      + '<div class="f" style="width:300px;"><label>Open an Investigation</label><select class="form-input vi-product-select">' + productOpts + '</select></div>'
      + '<button class="btn btn-primary vi-open-btn">Open Investigation</button>'
      + '</div></div>';

    if (open.length) {
      const rows = open.map(inv => {
        const doneN = inv.steps.filter(s => s.done).length;
        return '<tr>'
          + '<td><div class="val">' + esc(inv.sku) + '</div></td>'
          + '<td>' + esc(inv.opened_date) + '</td>'
          + '<td class="' + (doneN === 6 ? 'pos' : '') + '">' + doneN + ' of 6 steps</td>'
          + '<td class="no-print" style="text-align:right;"><button class="btn btn-ghost btn-sm vi-open-detail" data-inv="' + esc(inv.id) + '">Open</button></td>'
          + '</tr>';
      }).join('');
      h += '<div class="sh" style="margin:18px 0 10px;">Open</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Opened</th><th>Progress</th><th class="no-print"></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    if (resolved.length) {
      const newest = resolved.slice().reverse();
      const rows = newest.slice(0, App.listLimit('core', 'variance_investigation')).map(inv =>
        '<tr>'
        + '<td><div class="val">' + esc(inv.sku) + '</div></td>'
        + '<td>' + esc(inv.resolved_date || '-') + '</td>'
        + '<td style="color:var(--t2);">' + esc(inv.resolution || '-') + '</td>'
        + '<td class="no-print" style="text-align:right;"><button class="btn btn-danger btn-sm vi-remove" data-inv="' + esc(inv.id) + '">Delete</button></td>'
        + '</tr>').join('');
      h += '<div class="sh" style="margin:18px 0 10px;">Resolved</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Resolved</th><th>Finding</th><th class="no-print"></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        + App.showOlderBar('core', 'variance_investigation', newest, false);
    }
    return h;
  },

  // ── One investigation, drilled into (floating back returns to the landing) ──
  renderInvestigation(id) {
    const inv = this._inv(id);
    if (!inv) { App.navigate('theft-risk'); return; }
    const doneN = inv.steps.filter(s => s.done).length;
    // A Sales Integrity flag opens a server-focused investigation carrying its own
    // step text (steps_def) and no product, so skip the product-pour live data.
    const stepDefs = inv.steps_def || this.VARIANCE_STEPS;
    const liveData = inv.product_id ? this.investigationLiveData(inv.product_id) : { step2: '', step3: '' };
    const inputStyle = 'background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:13px;padding:7px 10px;color-scheme:dark;';

    let steps = '';
    inv.steps.forEach((s, idx) => {
      const st = stepDefs[idx] || { title: '', detail: '' };
      let extra = '';
      if (idx === 1 && liveData.step2) extra = liveData.step2;
      if (idx === 2 && liveData.step3) extra = liveData.step3;
      steps += '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--b2);">'
        + '<input type="checkbox" class="vi-step-check" data-step="' + idx + '"' + (s.done ? ' checked' : '')
        + ' style="margin-top:3px;flex-shrink:0;width:16px;height:16px;accent-color:var(--gold);"/>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;font-weight:700;color:' + (s.done ? 'var(--t3)' : 'var(--t1)') + ';">' + (idx + 1) + '. ' + esc(st.title) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);line-height:1.55;margin:3px 0 8px;">' + esc(st.detail) + '</div>'
        + extra
        + '<input type="text" class="vi-finding" data-step="' + idx + '" value="' + esc(s.finding) + '" placeholder="What you found" style="' + inputStyle + 'width:100%;"/>'
        + '</div></div>';
    });

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Investigating</div><div class="calc-val lg">' + esc(inv.sku) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Opened</div><div class="calc-val lg">' + esc(inv.opened_date) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Progress</div><div class="calc-val lg' + (doneN === 6 ? ' good' : '') + '">' + doneN + ' / 6</div></div>'
      + '</div></div>'
      + '<div class="sh" style="margin:22px 0 10px;">The Six Steps</div>'
      + '<div class="card form-card">' + steps
      + '<div style="margin-top:14px;"><label style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Resolution</label>'
      + '<textarea class="vi-resolution" rows="2" placeholder="The conclusion, even if inconclusive" style="' + inputStyle + 'width:100%;margin-top:5px;resize:vertical;">' + esc(inv.resolution || '') + '</textarea></div>'
      + '</div>'
      + '<div class="no-print" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary vi-save-btn">Save &amp; Close</button>'
      + '<button class="btn btn-ghost vi-resolve-btn">Resolve &amp; Close</button>'
      + '<button class="btn btn-danger vi-remove-detail" style="margin-left:auto;">Delete Investigation</button>'
      + '</div>'
      + '</div>';

    this.container.querySelectorAll('.vi-step-check').forEach(c => c.addEventListener('change', () => {
      inv.steps[+c.dataset.step].done = c.checked;
      App.putRecord('core', 'variance_investigation', inv).then(() => this.renderInvestigation(id));
    }));
    this.container.querySelectorAll('.vi-finding').forEach(i => i.addEventListener('change', () => {
      inv.steps[+i.dataset.step].finding = i.value;
      App.putRecord('core', 'variance_investigation', inv);
    }));
    this.container.querySelector('.vi-resolution')?.addEventListener('change', e => {
      inv.resolution = e.target.value;
      App.putRecord('core', 'variance_investigation', inv);
    });
    // Save & Close — flush the latest entries and return to the list with the
    // investigation still Open. The page already auto-saves; this is the explicit
    // "step away, come back later" exit users expect.
    this.container.querySelector('.vi-save-btn')?.addEventListener('click', () => {
      this.container.querySelectorAll('.vi-finding').forEach(i => { inv.steps[+i.dataset.step].finding = i.value; });
      const ta = this.container.querySelector('.vi-resolution');
      if (ta) inv.resolution = ta.value;
      App.putRecord('core', 'variance_investigation', inv).then(() => App.goBack());
    });
    this.container.querySelector('.vi-resolve-btn')?.addEventListener('click', () => {
      this.container.querySelectorAll('.vi-finding').forEach(i => { inv.steps[+i.dataset.step].finding = i.value; });
      const ta = this.container.querySelector('.vi-resolution');
      if (ta) inv.resolution = ta.value;
      inv.status = 'resolved';
      inv.resolved_date = App.todayLocal();
      App.putRecord('core', 'variance_investigation', inv).then(() => App.goBack());
    });
    this.container.querySelector('.vi-remove-detail')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      App.removeRecord('core', 'variance_investigation', id).then(() => App.goBack());
    });
  },

  /* The Fix System's variance process as a trackable workflow. Step 5 is a
     controlled re-measure that stays attached to THIS investigation. */
  VARIANCE_STEPS: [
    { title: 'Verify the count',
      detail: 'Check every storage location for a missed partial or a count error before chasing theft.' },
    { title: 'Calculate theoretical usage',
      detail: 'Compare POS pours sold against the actual ounce movement from the count.' },
    { title: 'Identify the shifts',
      detail: 'Use opening and closing counts to pin which shifts the variance landed on.' },
    { title: 'Talk to the staff who worked those shifts',
      detail: 'Ask what they saw: breakage, heavy comps, a rush, anything unusual.' },
    { title: 'Re-measure under tighter control',
      detail: 'Unannounced re-count of just this product on one suspect shift, logged here as part of this investigation.' },
    { title: 'Document the finding',
      detail: 'Write the finding and resolution before closing, even if inconclusive.' }
  ],

  _inv(id) { return (App.data.variance_investigations || []).find(x => x.id === id); },

  investigationLiveData(productId) {
    if (!productId) {
      return { step2: '<div style="font-size:11px;color:var(--t4);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">Open this investigation from a product to wire live count + spot-check data into this step.</div>', step3: '' };
    }
    const p = this.productById(productId);
    if (!p) return { step2: '', step3: '' };

    const counts = ((App.inventoryData && App.inventoryData.ic_counts) || []).slice()
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
    let step2Html = '';
    if (counts.length >= 2) {
      const start = counts[counts.length - 2], end = counts[counts.length - 1];
      const si = (start.items || []).find(it => it.product_id === productId);
      const ei = (end.items || []).find(it => it.product_id === productId);
      if (si && ei) {
        let purch = 0;
        ((App.inventoryData && App.inventoryData.ic_deliveries) || [])
          .filter(d => d.date > start.date && d.date <= end.date)
          .forEach(d => (d.line_items || []).forEach(li => {
            if (li.product_id === productId) purch += (App.unitsFromDeliveryLine ? App.unitsFromDeliveryLine(li) : (li.qty || 0));
          }));
        const used = (si.total || 0) + purch - (ei.total || 0);
        const isCaseBeer = p.category === 'Bottle Beer' && p.case_size > 0;
        const pp = isCaseBeer ? p.case_size
          : (p.pours_per_container || (p.container_size_oz && p.pour_size_oz ? p.container_size_oz / p.pour_size_oz : 0));
        const actualPours = used * pp;
        const cost = (App.unitCost ? App.unitCost(p) : (p.unit_cost || 0)) || 0;
        const actualDollars = used * cost;
        step2Html = '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;padding:10px 12px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;">'
          + '<div style="font-weight:700;color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Live Data &middot; ' + esc(start.date) + ' to ' + esc(end.date) + '</div>'
          + '<div>Used: <strong>' + used.toFixed(2) + ' containers</strong> (' + actualPours.toFixed(1) + ' pours, ' + App.fmtCurrency(actualDollars) + ')</div>'
          + '<div style="color:var(--t3);margin-top:4px;">Starting count ' + (si.total || 0).toFixed(2) + ' + purchases ' + purch.toFixed(2) + ' - ending count ' + (ei.total || 0).toFixed(2) + '</div>'
          + '<div style="color:var(--t3);margin-top:4px;">Compare against your POS pours sold for the same window.</div>'
          + '</div>';
      } else {
        step2Html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">This product was not counted on both of the last two inventories. Run a count in Inventory Control to populate the math here.</div>';
      }
    } else {
      step2Html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px dashed var(--b2);border-radius:3px;">Need two inventory counts to compute usage. Run a count in Inventory Control.</div>';
    }

    const recentSpots = this.spotChecks().slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(c => { const item = (c.items || []).find(i => i.product_id === productId); return item ? { date: c.date, shift: c.shift, checked_by: c.checked_by, item } : null; })
      .filter(Boolean).slice(0, 5);
    let step3Html = '';
    if (recentSpots.length) {
      const rows = recentSpots.map(s => {
        const flag = s.item.flagged ? '<span style="color:var(--red);font-weight:700;">FLAGGED</span>' : '<span style="color:var(--t3);">ok</span>';
        const vd = s.item.variance_dollar != null ? App.fmtCurrency(s.item.variance_dollar) : '-';
        return '<div style="display:flex;gap:10px;padding:4px 0;font-size:11px;border-bottom:1px solid var(--b2);">'
          + '<span style="color:var(--t2);width:100px;">' + esc(s.date) + '</span>'
          + '<span style="color:var(--t3);width:90px;">' + esc(s.shift || '-') + '</span>'
          + '<span style="color:var(--t3);flex:1;">' + esc(s.checked_by || '-') + '</span>'
          + '<span style="width:80px;text-align:right;color:' + (s.item.flagged ? 'var(--red)' : 'var(--t2)') + ';">' + vd + '</span>'
          + '<span style="width:80px;text-align:right;">' + flag + '</span>'
          + '</div>';
      }).join('');
      step3Html = '<div style="font-size:11px;color:var(--t2);margin-bottom:8px;padding:10px 12px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;">'
        + '<div style="font-weight:700;color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Recent Spot Checks for This Product</div>' + rows + '</div>';
    }
    return { step2: step2Html, step3: step3Html };
  },

  // Worksheet PRINTS the six steps so it actually guides the investigation.
  printBlankInvestigation() {
    App.printBlankSheet({
      title: 'Variance Investigation Worksheet',
      subtitle: 'Work the six steps in order on a single flagged product. Manager enters findings into Bar Cop after.',
      columns: [
        { label: 'Step',         width: '7%'  },
        { label: 'Task',         width: '43%' },
        { label: 'What You Did', width: '25%' },
        { label: 'Finding',      width: '25%' }
      ],
      bodyRows: this.VARIANCE_STEPS.map((s, i) => [String(i + 1), s.title + '. ' + s.detail, '', ''])
    });
  },

  // ── 90-Day Theft & Loss Brief (PDF) — the periodic owner/insurance review ──
  async printBrief() {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = App.ymdLocal(cutoff);
    const d = this._signalData(cutoffStr);
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const fmt$ = (v) => (v == null || isNaN(v)) ? '-' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const inWindow = (dt) => dt && String(dt).slice(0, 10) >= cutoffStr;
    const recentSpots = this.spotChecks().filter(c => inWindow(c.date));
    const recentVCs = this.voidComps().filter(r => inWindow(r.date));
    const recentVars = this.variances().filter(v => inWindow(v.date));
    const recentAdj = this.adjustments().filter(a => inWindow((a.date_time || '').slice(0, 10)));

    const investigations = (App.data?.variance_investigations || []);
    const openInv = investigations.filter(i => i.status !== 'resolved');
    const resolvedInv = investigations.filter(i => i.status === 'resolved' && inWindow(i.resolved_date));

    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const b = App._pdfBuilder('Theft & Loss Brief');
    b.header({ right: 'Theft & Loss Brief', meta: '90-day review, generated ' + today });

    b.sectionTitle('Loss Signals (90 Days)');
    b.table(['Signal', 'Events', 'Amount'], [
      ['Cash drawer shorts', String(d.shorts.count), fmt$(d.shorts.amount)],
      ['Flagged spot checks', String(d.spots.count), fmt$(d.spots.amount)],
      ['Confirmed theft (adjustment log)', String(d.theft.count), fmt$(d.theft.amount)]
    ], { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });

    b.sectionTitle('90-Day Event Counts');
    b.table(null, [
      ['Spot checks run', String(recentSpots.length)],
      ['Voids and comps logged (loss-bearing)', String(recentVCs.length)],
      ['Cash variances logged', String(recentVars.length)],
      ['Inventory adjustments logged', String(recentAdj.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Variance Investigations');
    b.table(null, [
      ['Open investigations', String(openInv.length)],
      ['Resolved in window', String(resolvedInv.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });
    if (openInv.length > 0) b.paragraph('Open: ' + openInv.map(i => i.sku || '(unnamed)').join(', '), { gray: 70, size: 9 });

    b.disclaimer('Generated from your logged Bar Cop data on ' + today + '. '
      + 'Bar Cop is a software tool, not a forensic auditor, attorney, or insurance adjuster. '
      + 'Use this brief as a reference point for your own review; consult the relevant professional before acting on any conclusion.');

    await b.save('BarCop_TheftLossBrief_' + App._pdfDateStamp() + '.pdf');
  },

  showHowTo() {
    App.showHelpModal('How Loss Prevention Works', [
      { p: ['Loss Prevention is a live leak detector, not a score. Its job is to catch theft on the shift it happens and walk you through investigating it, because that is what actually recovers money. Everything here reads from the data you already log.'] },
      { h: 'What Flagged', p: ['The three things worth a look: drawer counts coming up short, flagged spot checks, and confirmed theft from the Adjustment Log. You see Today and the Last 7 Days for each. A red number under Today means it happened on this shift, deal with it now, not in three months.', 'Per-server sales-pattern theft (no-sales, voids, comps, cash mix) is a deeper read off your POS sales report, so it lives on its own Sales Integrity screen in Profit Recovery rather than here.'] },
      { h: 'Variance Investigations', p: ['When a product does not add up, open an investigation and work the six steps. Open one to drill in: it pulls live count and spot-check data into the steps, you check them off and record findings. You do not have to finish in one sitting; every step and note saves as you go. Hit Save and Close to step away and pick it back up later, it stays open in the list. Hit Resolve and Close only when you have reached a conclusion. A flagged spot check in Inventory Control opens one here for you, and re-flagging the same product reuses the open one. Print the Worksheet to work it on paper at the bar.'] },
      { h: 'Theft and Loss Brief', p: ['Generates a one-page 90-day PDF summary of every loss signal and your investigations, for an owner, bookkeeper, or insurance review. The 90-day window is right for a review document; the live page above stays on the last 7 days.'] }
    ]);
  }
};
