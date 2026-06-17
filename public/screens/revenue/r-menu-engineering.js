'use strict';

/* ── Revenue Recovery — Menu Engineering ──────────────────────────────────────
   Two tabs (in-page .ch-tabs): a margin x popularity classification Matrix
   (Stars / Plowhorses / Puzzles / Dogs) and a Price Sensitivity calculator with
   a verifiable Pricing Review Log. Reads priced, costed menu_items; the four
   quadrant colors encode the classification (the chart's meaning). */

S.RevenueMenuEngineering = {
  activeTab: 'matrix',

  // Quadrant colors = the classification meaning (on-palette: gold win / amber
  // watch / steel act / red cut). Used by the matrix dots, legend, and the
  // section dots below.
  QUAD_COLOR: { STAR: 'var(--gold)', PLOWHORSE: 'var(--focus)', PUZZLE: 'var(--amber)', DOG: 'var(--red)' },

  showHowTo() {
    App.showHelpModal('How Menu Engineering Works', [
      { p: ['Menu Engineering sorts every priced item that has a cost and weekly covers into four quadrants by margin and popularity, so you know exactly what to push, reprice, promote, or cut. It needs at least four complete items; finish any Incomplete ones in Menu Items.'] },
      { h: 'The Four Quadrants', p: ['Stars are high margin and high volume, your winners, so feature them and brief servers to push them. Plowhorses sell well but earn little, so raise the price. Puzzles earn well but sell slowly, so promote them and give them server attention. Dogs are low on both, candidates to rework or cut.'] },
      { h: 'Price Sensitivity', p: ['Pick an item, type a proposed price and an estimated volume change, and see the new margin, the weekly and annual dollar impact, and how many covers you could lose before the change stops paying. Log the change and Bar Cop tracks the real result against your prediction once three weeks of covers come in.'] },
      { h: 'The Pricing Review Log', p: ['Every logged price change lands here with a live verification: once three weeks pass it shows the real weekly dollar swing against what you predicted, so your pricing instincts sharpen over time. Logged changes also feed the Recovery Scoreboard.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const tabBar = '<div class="ch-tabs no-print">'
      + [['matrix', 'Matrix'], ['price-sensitivity', 'Price Sensitivity']].map(([id, label]) =>
          '<button class="ch-tab' + (id === this.activeTab ? ' on' : '') + '" data-tab="' + id + '">' + label + '</button>').join('')
      + '</div>';
    const body = this.activeTab === 'matrix' ? this.matrixHtml() : this.priceSensHtml();
    this.container.innerHTML = '<div class="screen">' + tabBar + body + '</div>';
    this.container.querySelectorAll('.ch-tab').forEach(b =>
      b.addEventListener('click', () => { this.activeTab = b.dataset.tab; this.draw(); }));
    if (this.activeTab === 'matrix') this.wireMatrix();
    else this.wirePriceSens();
  },

  // ── Matrix tab ──────────────────────────────────────────────────────────────
  matrixHtml() {
    // Inject the effective cost (auto-computed from recipe when attached, else
    // the manually-entered cost) so the math always sees a current number.
    const items = (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 })).filter(i => i.price && i.cost && i.weekly_covers);
    // Running it with enough data to classify counts as completing Getting
    // Started. The view itself is the work — there's no save action.
    if (items.length >= 4) App.markSetupDone('gs_r_eng');
    if (items.length < 4) {
      return '<div class="card"><div class="empty">'
        + '<div class="empty-title">Not Enough Data</div>'
        + '<div class="empty-sub">Add at least 4 menu items with price, cost, and weekly covers to run Menu Engineering.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'r-menu-items\')">Go to Menu Items</button></div>'
        + '</div></div>';
    }

    const avgCM     = items.reduce((s, i) => s + (i.price - i.cost), 0) / items.length;
    const avgCovers = items.reduce((s, i) => s + i.weekly_covers, 0) / items.length;
    const classify = item => {
      const hiM = (item.price - item.cost) >= avgCM;
      const hiV = item.weekly_covers >= avgCovers;
      if (hiM && hiV) return 'STAR';
      if (!hiM && hiV) return 'PLOWHORSE';
      if (hiM && !hiV) return 'PUZZLE';
      return 'DOG';
    };
    const color = this.QUAD_COLOR;
    const classified = items.map(item => ({ ...item, quad: classify(item), cm: item.price - item.cost, pct: (item.cost / item.price * 100).toFixed(1) }));

    // SVG matrix
    const W = 500, H = 320, PAD = 40;
    const maxCM  = Math.max(...classified.map(i => i.cm)) * 1.1;
    const maxCov = Math.max(...classified.map(i => i.weekly_covers)) * 1.1;
    const xp = cm  => PAD + (cm / maxCM) * (W - PAD * 2);
    const yp = cov => (H - PAD) - (cov / maxCov) * (H - PAD * 2);
    const midX = xp(avgCM), midY = yp(avgCovers);
    const dots = classified.map(i =>
      '<circle cx="' + xp(i.cm).toFixed(1) + '" cy="' + yp(i.weekly_covers).toFixed(1) + '" r="6" fill="' + color[i.quad] + '" opacity="0.85">'
      + '<title>' + esc(i.name) + ' (' + i.quad + ')</title></circle>').join('');

    const svgMatrix = '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-title">Menu Engineering Matrix</div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:500px;height:auto;display:block;margin:0 auto;">'
      + '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - PAD * 2) + '" height="' + (H - PAD * 2) + '" fill="var(--input)" stroke="var(--b1)"/>'
      + '<line x1="' + midX.toFixed(1) + '" y1="' + PAD + '" x2="' + midX.toFixed(1) + '" y2="' + (H - PAD) + '" stroke="var(--b2)" stroke-dasharray="4,4"/>'
      + '<line x1="' + PAD + '" y1="' + midY.toFixed(1) + '" x2="' + (W - PAD) + '" y2="' + midY.toFixed(1) + '" stroke="var(--b2)" stroke-dasharray="4,4"/>'
      + '<text x="' + (PAD + 8) + '" y="' + (PAD + 16) + '" fill="' + color.PUZZLE + '" font-size="9" font-weight="700">PUZZLES</text>'
      + '<text x="' + (midX + 8) + '" y="' + (PAD + 16) + '" fill="' + color.STAR + '" font-size="9" font-weight="700">STARS</text>'
      + '<text x="' + (PAD + 8) + '" y="' + (H - PAD - 8) + '" fill="' + color.DOG + '" font-size="9" font-weight="700">DOGS</text>'
      + '<text x="' + (midX + 8) + '" y="' + (H - PAD - 8) + '" fill="' + color.PLOWHORSE + '" font-size="9" font-weight="700">PLOWHORSES</text>'
      + dots
      + '<text x="' + (W / 2) + '" y="' + (H - 4) + '" text-anchor="middle" fill="var(--t4)" font-size="8">Contribution Margin</text>'
      + '</svg>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">'
      + ['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'].map(q => '<div style="display:flex;align-items:center;gap:6px;"><div style="width:10px;height:10px;border-radius:50%;background:' + color[q] + ';"></div><span style="font-size:11px;color:var(--t3);">' + q + '</span></div>').join('')
      + '</div></div>';

    const quadSections = ['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'].map(q => {
      const qItems = classified.filter(i => i.quad === q);
      if (!qItems.length) return '';
      const rows = qItems.map(i => {
        // Menu Mix Delta: current weekly_covers vs prev_weekly_covers (stamped on
        // r-menu-items save when the value changes). Empty until a prior anchor
        // exists.
        let deltaCell = '<span style="color:var(--t4);">-</span>';
        if (i.prev_weekly_covers != null && i.weekly_covers != null) {
          const delta = i.weekly_covers - i.prev_weekly_covers;
          const pct = i.prev_weekly_covers > 0 ? (delta / i.prev_weekly_covers * 100) : null;
          const col = delta > 0 ? 'var(--gold)' : delta < 0 ? 'var(--red)' : 'var(--t3)';
          deltaCell = '<span style="color:' + col + ';font-weight:600;">'
            + (delta >= 0 ? '+' : '') + delta
            + (pct != null ? ' (' + (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%)' : '') + '</span>';
        }
        return '<tr><td><div class="val">' + esc(i.name) + '</div></td>'
          + '<td>' + esc(i.category || '') + '</td>'
          + '<td>' + App.fmtCurrency(i.price) + '</td>'
          + '<td>' + i.pct + '%</td>'
          + '<td>' + App.fmtCurrency(i.cm) + '</td>'
          + '<td>' + i.weekly_covers + '</td>'
          + '<td>' + deltaCell + '</td></tr>';
      }).join('');
      return '<div class="sh" style="margin:22px 0 10px;display:flex;align-items:center;gap:8px;">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:' + color[q] + ';display:inline-block;"></span>' + q + 'S</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>Price</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th>vs Last Update</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }).join('');

    return svgMatrix + quadSections;
  },

  wireMatrix() { /* matrix is read-only; the empty-state button uses inline onclick */ },

  /* Price-Change Verification — measure a logged price change against the
     prediction made when it was logged, once three weeks of covers data exist.
     Honest by construction: returns a result only when the captured baseline and
     current covers both exist. */
  verify(entry) {
    if (!entry || !entry.date || entry.covers_at_change == null || entry.cost == null) return { status: 'old-format' };
    const t = new Date(entry.date + 'T00:00:00').getTime();
    if (isNaN(t)) return { status: 'old-format' };
    const weeks = Math.floor((Date.now() - t) / (7 * 86400000));
    if (weeks < 3) return { status: 'pending', weeks: Math.max(weeks, 0) };
    const baseItem = (App.data.menu_items || []).find(i => i.id === entry.item_id);
    const item = baseItem ? { ...baseItem, cost: App.menuItemCost(baseItem) || baseItem.cost } : null;
    if (!item || item.weekly_covers == null) return { status: 'no-item' };
    const coversThen = entry.covers_at_change, coversNow = item.weekly_covers;
    if (!coversThen) return { status: 'no-baseline' };
    const oldCM = entry.old_price - entry.cost, newCM = entry.new_price - entry.cost;
    return {
      status: 'ok', weeks: weeks,
      coversThen: coversThen, coversNow: coversNow,
      volPct: (coversNow - coversThen) / coversThen * 100,
      actualWeekly: newCM * coversNow - oldCM * coversThen,
      predicted: entry.predicted_weekly_impact != null ? entry.predicted_weekly_impact : null
    };
  },

  // One Pricing Review Log row, including the verification cell.
  logRow(entry) {
    const v = this.verify(entry);
    let vCell;
    if (v.status === 'ok') {
      const tone = v.actualWeekly >= 0 ? 'var(--gold)' : 'var(--red)';
      const pred = v.predicted != null
        ? 'predicted ' + (v.predicted > 0 ? '+' : '') + App.fmtCurrency(v.predicted) + '/wk'
        : 'no prediction on file';
      vCell = '<div style="font-weight:700;color:' + tone + ';">'
        + (v.actualWeekly > 0 ? '+' : '') + App.fmtCurrency(v.actualWeekly) + '/wk actual</div>'
        + '<div style="font-size:10px;color:var(--t3);">covers ' + v.coversThen + ' to ' + v.coversNow + ', ' + pred + '</div>';
    } else if (v.status === 'pending') {
      vCell = '<span style="color:var(--t3);">Measuring, week ' + v.weeks + ' of 3</span>';
    } else {
      vCell = '<span style="color:var(--t4);">Not verifiable</span>';
    }
    return '<tr><td>' + (entry.date || '').slice(0, 10) + '</td>'
      + '<td>' + esc(entry.item_name || '') + '</td>'
      + '<td>' + App.fmtCurrency(entry.old_price) + '</td>'
      + '<td>' + App.fmtCurrency(entry.new_price) + '</td>'
      + '<td style="font-size:11px;">' + vCell + '</td>'
      + '<td style="font-size:11px;color:var(--t2);">' + esc(entry.reason || '') + '</td></tr>';
  },

  // ── Price Sensitivity tab ─────────────────────────────────────────────────────
  priceSensHtml() {
    const items = (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 })).filter(i => i.price && i.cost);
    const log   = (App.data.revenue_price_log || []).slice().reverse();
    const itemOpts = items.map((i, idx) => '<option value="' + idx + '">' + esc(i.name) + '   $' + i.price + '</option>').join('');
    const logRows = log.slice(0, App.listLimit('core', 'revenue_price_log')).map(e => this.logRow(e)).join('')
      || '<tr><td colspan="6" style="color:var(--t4);text-align:center;padding:22px;">No price changes logged yet.</td></tr>';

    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Price Sensitivity Calculator</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f w-lg"><label>Menu Item</label><select class="form-input" id="rps-item"><option value="">Select item...</option>' + itemOpts + '</select></div>'
      + '<div class="f w-md"><label>Proposed New Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rps-newprice" step="0.25" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Est. Volume Change</label><div class="fw"><input class="form-input suf" type="number" id="rps-vol" step="1" placeholder="0"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rps-result" style="margin-bottom:18px;"></div>'
      + '<div id="rps-log-wrap" style="display:none;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Log This Price Change</div>'
      + '<div class="form-row" style="gap:16px;align-items:flex-end;">'
      + '<div class="f w-lg"><label>Reason</label><input class="form-input" type="text" id="rps-reason" placeholder="Cost increase, repositioning..."/></div>'
      + '<button class="btn btn-ghost" id="rps-log-btn">Log Price Change</button>'
      + '</div></div>'
      + '</div>'
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Pricing Review Log</div>'
      + '<button class="btn btn-ghost btn-sm" id="rps-export">Export PDF</button>'
      + '</div>'
      + '<div id="rps-log-export"><div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Item</th><th>Old Price</th><th>New Price</th><th>Verification</th><th>Reason</th>'
      + '</tr></thead><tbody id="rps-log-table">' + logRows + '</tbody></table></div></div>'
      + App.showOlderBar('core', 'revenue_price_log', log, false) + '</div>';
  },

  wirePriceSens() {
    const container = this.container;
    const items = (App.data.menu_items || []).map(i => ({ ...i, cost: App.menuItemCost(i) || 0 })).filter(i => i.price && i.cost);

    container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.draw()));
    document.getElementById('rps-export')?.addEventListener('click', () =>
      App.exportPDF({ title: 'Pricing Review Log', root: document.getElementById('rps-log-export') || container }));

    const calc = () => {
      const idx      = parseInt(document.getElementById('rps-item')?.value);
      const newPrice = parseFloat(document.getElementById('rps-newprice')?.value) || 0;
      const volChg   = parseFloat(document.getElementById('rps-vol')?.value) || 0;
      const el       = document.getElementById('rps-result');
      const lw       = document.getElementById('rps-log-wrap');
      if (isNaN(idx) || !items[idx] || !newPrice) { if (el) el.innerHTML = ''; if (lw) lw.style.display = 'none'; return; }
      const item     = items[idx];
      const oldCM    = item.price - item.cost;
      const newCM    = newPrice - item.cost;
      const newPct   = (item.cost / newPrice * 100).toFixed(1);
      const oldPct   = (item.cost / item.price * 100).toFixed(1);
      const covers   = item.weekly_covers || 0;
      const adjCov   = covers * (1 + volChg / 100);
      const wkImpact = (newCM * adjCov) - (oldCM * covers);
      const annImpact = wkImpact * 52;
      const breakeven = oldCM > 0 ? covers * (1 - newCM / oldCM) : 0;
      const box = (label, val, color) =>
        '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">' + label + '</div>'
        + '<div style="font-size:16px;font-weight:700;color:' + (color || 'var(--t1)') + ';">' + val + '</div></div>';
      if (el) el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:4px;">'
        + box('Old Cost %', oldPct + '%')
        + box('New Cost %', newPct + '%')
        + box('New Margin', App.fmtCurrency(newCM), newCM > oldCM ? 'var(--gold)' : 'var(--red)')
        + box('Weekly Impact', (wkImpact > 0 ? '+' : '') + App.fmtCurrency(wkImpact), wkImpact > 0 ? 'var(--gold)' : 'var(--red)')
        + box('Annual Impact', (annImpact > 0 ? '+' : '') + App.fmtCurrency(annImpact), annImpact > 0 ? 'var(--gold)' : 'var(--red)')
        + (covers > 0 ? box('Breakeven Volume Drop', Math.round(breakeven) + ' covers', 'var(--t2)') : '')
        + '</div>';
      if (lw) lw.style.display = '';
    };
    ['rps-item', 'rps-newprice', 'rps-vol'].forEach(id => document.getElementById(id)?.addEventListener('input', calc));

    document.getElementById('rps-log-btn')?.addEventListener('click', async () => {
      const idx      = parseInt(document.getElementById('rps-item')?.value);
      const newPrice = parseFloat(document.getElementById('rps-newprice')?.value) || 0;
      const reason   = document.getElementById('rps-reason')?.value || '';
      if (isNaN(idx) || !items[idx] || !newPrice) return;
      const item    = items[idx];
      const volChg2 = parseFloat(document.getElementById('rps-vol')?.value) || 0;
      const oldCM2  = item.price - item.cost;
      const newCM2  = newPrice - item.cost;
      const covers2 = item.weekly_covers || 0;
      const predWk  = (newCM2 * (covers2 * (1 + volChg2 / 100))) - (oldCM2 * covers2);
      const entry = {
        id: App.uid(), date: App.todayLocal(),
        item_id: item.id, item_name: item.name, old_price: item.price, new_price: newPrice, cost: item.cost,
        reason, margin_impact: newPrice - item.price, covers_at_change: covers2,
        predicted_vol_pct: volChg2, predicted_weekly_impact: predWk, saved_at: new Date().toISOString()
      };
      const allItems = App.data.menu_items || [];
      const ri = allItems.findIndex(i => i.id === item.id);
      if (ri >= 0) allItems[ri].price = newPrice;
      // Auto-emit a Recovery Scoreboard fix_log entry tied to the Pricing gap.
      const fixLogRec = {
        id: App.uid(), module: 'revenue', gap_id: 'pricing', gap_name: 'Pricing',
        date: App.todayLocal(), source: 'price-change', source_id: entry.id,
        note: 'Price change logged: ' + (item.name || '') + ' ' + App.fmtCurrency(item.price) + ' to ' + App.fmtCurrency(newPrice)
      };
      await App.putRecord('core', 'revenue_price_log', entry);
      await App.saveKey('menu_items');
      await App.putRecord('core', 'fix_log', fixLogRec);
      const tbody = document.getElementById('rps-log-table');
      if (tbody) {
        const newLog = (App.data.revenue_price_log || []).slice().reverse();
        tbody.innerHTML = newLog.slice(0, App.listLimit('core', 'revenue_price_log')).map(e => this.logRow(e)).join('')
          || '<tr><td colspan="6" style="color:var(--t4);text-align:center;padding:22px;">No price changes logged yet.</td></tr>';
      }
      const reasonEl = document.getElementById('rps-reason');
      if (reasonEl) reasonEl.value = '';
    });
  }
};
