'use strict';
S.RevenueMenuEngineering = {
  activeTab: 'matrix',

  render(container, actions) {
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:8px;';
    ['Matrix','Price Sensitivity','Pricing Log'].forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm ' + (t.toLowerCase().replace(' ','-') === this.activeTab ? 'btn-primary' : 'btn-ghost');
      btn.textContent = t;
      btn.addEventListener('click', () => { this.activeTab = t.toLowerCase().replace(' ','-'); this.render(container, actions); });
      tabs.appendChild(btn);
    });
    actions.appendChild(tabs);

    if (this.activeTab === 'matrix') this.renderMatrix(container);
    else if (this.activeTab === 'price-sensitivity') this.renderPriceSensitivity(container);
    else this.renderPricingLog(container);
  },

  renderMatrix(container) {
    const items = (App.data.revenue_menu_items || []).filter(i => i.price && i.cost && i.weekly_covers);
    if (items.length < 4) {
      container.innerHTML = '<div class="screen"><div class="card"><div class="empty">'
        + '<div class="empty-title">Not Enough Data</div>'
        + '<div class="empty-sub">Add at least 4 menu items with price, cost, and weekly covers to run Menu Engineering.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'r-menu-items\')">Go to Menu Items</button></div>'
        + '</div></div></div>';
      return;
    }

    // Calculate averages for quadrant thresholds
    const avgCM     = items.reduce((s,i) => s + (i.price - i.cost), 0) / items.length;
    const avgCovers = items.reduce((s,i) => s + i.weekly_covers, 0) / items.length;

    const classify = item => {
      const cm  = item.price - item.cost;
      const hi_margin = cm >= avgCM;
      const hi_volume = item.weekly_covers >= avgCovers;
      if (hi_margin && hi_volume)  return 'STAR';
      if (!hi_margin && hi_volume) return 'PLOWHORSE';
      if (hi_margin && !hi_volume) return 'PUZZLE';
      return 'DOG';
    };

    const actions_map = {
      'STAR':      'Feature on menu. Brief servers to push this item.',
      'PLOWHORSE': 'Consider a price increase to hit target margin.',
      'PUZZLE':    'Add to pre-shift briefing. Move to a featured position.',
      'DOG':       'Review cost or remove from menu.',
    };
    const colors_map = {
      'STAR':      'var(--gold)',
      'PLOWHORSE': '#4888A8',
      'PUZZLE':    '#D08008',
      'DOG':       'var(--red)',
    };

    const classified = items.map(item => ({ ...item, quad: classify(item), cm: item.price - item.cost, pct: (item.cost/item.price*100).toFixed(1) }));
    const quads = ['STAR','PLOWHORSE','PUZZLE','DOG'];

    const quadSections = quads.map(q => {
      const qItems = classified.filter(i => i.quad === q);
      if (!qItems.length) return '';
      const rows = qItems.map(i =>
        '<tr><td style="font-weight:600;">' + esc(i.name) + '</td>'
        + '<td>' + esc(i.category||'') + '</td>'
        + '<td>' + App.fmtCurrency(i.price) + '</td>'
        + '<td>' + i.pct + '%</td>'
        + '<td>' + App.fmtCurrency(i.cm) + '</td>'
        + '<td>' + i.weekly_covers + '</td>'
        + '<td style="font-size:11px;color:var(--t2);">' + esc(actions_map[q]) + '</td>'
        + '</tr>'
      ).join('');
      return '<div class="card" style="margin-bottom:14px;border-left:4px solid ' + colors_map[q] + ';">'
        + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + colors_map[q] + ';margin-bottom:4px;">' + q + 's</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;">' + esc(actions_map[q]) + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '</div>';
    }).join('');

    // SVG matrix
    const W = 500, H = 320, PAD = 40;
    const maxCM  = Math.max(...classified.map(i => i.cm)) * 1.1;
    const maxCov = Math.max(...classified.map(i => i.weekly_covers)) * 1.1;
    const xp = cm  => PAD + (cm / maxCM) * (W - PAD*2);
    const yp = cov => (H - PAD) - (cov / maxCov) * (H - PAD*2);
    const midX = xp(avgCM), midY = yp(avgCovers);

    const dots = classified.map(i =>
      '<circle cx="' + xp(i.cm).toFixed(1) + '" cy="' + yp(i.weekly_covers).toFixed(1) + '" r="6" fill="' + colors_map[i.quad] + '" opacity="0.85">'
      + '<title>' + i.name + ' (' + i.quad + ')</title></circle>'
    ).join('');

    const svgMatrix = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Menu Engineering Matrix</div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:500px;height:auto;">'
      + '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W-PAD*2) + '" height="' + (H-PAD*2) + '" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)"/>'
      + '<line x1="' + midX.toFixed(1) + '" y1="' + PAD + '" x2="' + midX.toFixed(1) + '" y2="' + (H-PAD) + '" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4,4"/>'
      + '<line x1="' + PAD + '" y1="' + midY.toFixed(1) + '" x2="' + (W-PAD) + '" y2="' + midY.toFixed(1) + '" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4,4"/>'
      + '<text x="' + (PAD+8) + '" y="' + (PAD+16) + '" fill="' + colors_map.PUZZLE + '" font-size="9" font-weight="700">PUZZLES</text>'
      + '<text x="' + (midX+8) + '" y="' + (PAD+16) + '" fill="' + colors_map.STAR + '" font-size="9" font-weight="700">STARS</text>'
      + '<text x="' + (PAD+8) + '" y="' + (H-PAD-8) + '" fill="' + colors_map.DOG + '" font-size="9" font-weight="700">DOGS</text>'
      + '<text x="' + (midX+8) + '" y="' + (H-PAD-8) + '" fill="' + colors_map.PLOWHORSE + '" font-size="9" font-weight="700">PLOWHORSES</text>'
      + dots
      + '<text x="' + (W/2) + '" y="' + (H-4) + '" text-anchor="middle" fill="var(--t4)" font-size="8">Contribution Margin →</text>'
      + '</svg>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">'
      + quads.map(q => '<div style="display:flex;align-items:center;gap:6px;"><div style="width:10px;height:10px;border-radius:50%;background:' + colors_map[q] + ';"></div><span style="font-size:11px;color:var(--t3);">' + q + '</span></div>').join('')
      + '</div></div>';

    container.innerHTML = '<div class="screen">' + svgMatrix + quadSections + '</div>';
  },

  renderPriceSensitivity(container) {
    const items = (App.data.revenue_menu_items || []).filter(i => i.price && i.cost);
    const itemOpts = items.map((i,idx) => '<option value="' + idx + '">' + esc(i.name) + ' — $' + i.price + '</option>').join('');

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Price Sensitivity Calculator</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Select a menu item, enter a proposed new price, and see the revenue and margin impact.</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-lg"><label>Menu Item</label><select id="rps-item" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option value="">Select item...</option>' + itemOpts + '</select></div>'
      + '<div class="f w-md"><label>Proposed New Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rps-newprice" step="0.25" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Est. Volume Change %</label><div class="fw"><input class="suf" type="number" id="rps-vol" step="1" placeholder="0"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rps-result" style="margin-bottom:18px;"></div>'
      + '<div id="rps-log-wrap" style="display:none;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Log This Price Change</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-md"><label>Reason</label><input type="text" id="rps-reason" placeholder="Cost increase, repositioning..."/></div>'
      + '<button class="btn btn-ghost" id="rps-log-btn" style="align-self:flex-end;">Log Change</button>'
      + '</div></div>'
      + '</div></div>';

    const calc = () => {
      const idx      = parseInt(document.getElementById('rps-item')?.value);
      const newPrice = parseFloat(document.getElementById('rps-newprice')?.value) || 0;
      const volChg   = parseFloat(document.getElementById('rps-vol')?.value) || 0;
      const el       = document.getElementById('rps-result');
      const logWrap  = document.getElementById('rps-log-wrap');
      if (isNaN(idx) || !items[idx] || !newPrice) { if(el) el.innerHTML=''; if(logWrap) logWrap.style.display='none'; return; }
      const item    = items[idx];
      const oldCM   = item.price - item.cost;
      const newCM   = newPrice - item.cost;
      const oldPct  = (item.cost / item.price * 100).toFixed(1);
      const newPct  = (item.cost / newPrice * 100).toFixed(1);
      const covers  = item.weekly_covers || 0;
      const adjCov  = covers * (1 + volChg/100);
      const wkImpact = (newCM * adjCov) - (oldCM * covers);
      const annImpact = wkImpact * 52;
      const breakeven = oldCM > 0 ? covers * (1 - newCM/oldCM) : 0;

      if(el) el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:4px;">'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Current Cost %</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + oldPct + '%</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">New Cost %</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + newPct + '%</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">New Contribution Margin</div><div style="font-size:16px;font-weight:700;color:' + (newCM > oldCM ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(newCM) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Weekly Revenue Impact</div><div style="font-size:16px;font-weight:700;color:' + (wkImpact > 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (wkImpact > 0 ? '+' : '') + App.fmtCurrency(wkImpact) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Annual Revenue Impact</div><div style="font-size:16px;font-weight:700;color:' + (annImpact > 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (annImpact > 0 ? '+' : '') + App.fmtCurrency(annImpact) + '</div></div>'
        + (covers > 0 ? '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Breakeven Volume Drop</div><div style="font-size:16px;font-weight:700;color:var(--t2);">' + Math.round(breakeven) + ' covers</div></div>' : '')
        + '</div>';
      if(logWrap) logWrap.style.display = '';
    };

    ['rps-item','rps-newprice','rps-vol'].forEach(id => document.getElementById(id)?.addEventListener('input', calc));

    document.getElementById('rps-log-btn')?.addEventListener('click', async () => {
      const idx      = parseInt(document.getElementById('rps-item')?.value);
      const newPrice = parseFloat(document.getElementById('rps-newprice')?.value) || 0;
      const reason   = document.getElementById('rps-reason')?.value || '';
      if (isNaN(idx) || !items[idx] || !newPrice) return;
      const item = items[idx];
      const entry = {
        id: App.uid(), date: new Date().toISOString().slice(0,10),
        item_name: item.name, old_price: item.price, new_price: newPrice,
        reason, margin_impact: newPrice - item.price, saved_at: new Date().toISOString()
      };
      if (!App.data.revenue_price_log) App.data.revenue_price_log = [];
      App.data.revenue_price_log.push(entry);
      // Update item price
      const allItems = App.data.revenue_menu_items || [];
      const realIdx  = allItems.findIndex(i => i.id === item.id);
      if (realIdx >= 0) allItems[realIdx].price = newPrice;
      await App.saveKey('revenue_price_log');
      await App.saveKey('revenue_menu_items');
      alert('Price change logged and item updated.');
    });
  },

  renderPricingLog(container) {
    const log = (App.data.revenue_price_log || []).slice().reverse();
    const rows = log.map(e =>
      '<tr><td>' + (e.date||'').slice(0,10) + '</td>'
      + '<td>' + esc(e.item_name||'') + '</td>'
      + '<td>' + App.fmtCurrency(e.old_price) + '</td>'
      + '<td>' + App.fmtCurrency(e.new_price) + '</td>'
      + '<td style="color:' + (e.margin_impact > 0 ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + (e.margin_impact > 0 ? '+' : '') + App.fmtCurrency(e.margin_impact) + '</td>'
      + '<td style="font-size:11px;color:var(--t2);">' + esc(e.reason||'') + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="6" style="color:var(--t3);text-align:center;padding:14px;">No price changes logged yet.</td></tr>';

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Pricing Review Log</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Item</th><th>Old Price</th><th>New Price</th><th>Margin Impact</th><th>Reason</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div></div>';
  }
};
