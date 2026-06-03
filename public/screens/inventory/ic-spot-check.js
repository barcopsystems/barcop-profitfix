'use strict';

/* ── Inventory Control — Spot Check (writes ic_spot_checks) ───────────────────
   Mobile-first per-shift theft check. Pick a few high-risk products, record the
   on-hand count before and after a shift, and enter what the POS sold. The
   screen computes the pour variance and its dollar value. ic_spot_checks feeds
   Profit Recovery's Theft Risk and the Profit Audit's theft/controls section. */

S.InventorySpotCheck = {
  _seq: 0,
  _pendingDelId: null,
  CAT_ORDER: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],

  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  checks() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_spot_checks)) App.inventoryData.ic_spot_checks = [];
    return App.inventoryData.ic_spot_checks;
  },
  poursPer(p) {
    if (!p) return 1;
    if (p.pours_per_container) return p.pours_per_container;
    if (p.container_size_oz && p.pour_size_oz) return p.container_size_oz / p.pour_size_oz;
    return 1;
  },
  costPer(p) {
    if (!p) return 0;
    if (p.cost_per_pour != null) return p.cost_per_pour;
    const pp = this.poursPer(p);
    const bc = App.bottleCost(p);
    if (bc != null && pp > 0) return bc / pp;
    return 0;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Count input by product type (mirrors Take Inventory) ─────────────────
  // Pourable (liquor/wine/draft/bottled mixer) uses the fill slider — a keg
  // outline for draft; bottle beer uses cases + loose; food/dry goods use a
  // plain number. slotId is unique per pre/post slot so both read back cleanly.
  _isCaseBeer(p) { return p.category === 'Bottle Beer' && p.case_size && p.case_size > 0; },
  _isPourable(p) { return !!(p.container_size_oz && p.pour_size_oz); },
  // Units and wording specific to the product: liquor and wine restock in
  // bottles and sell in pours, bottle beer restocks and sells in bottles, draft
  // restocks by the keg and sells in pours.
  _restockUnit(p) { return p.category === 'Draft Beer' ? 'kegs' : 'btl'; },
  _posUnit(p)     { return this._isCaseBeer(p) ? 'btl' : 'pours'; },
  _posLabel(p)    { return this._isCaseBeer(p) ? 'POS Bottles Sold' : 'POS Pours Sold'; },
  _servingWord(p) { return this._isCaseBeer(p) ? 'bottles' : 'pours'; },

  showHowTo() {
    App.showHelpModal('How the Spot Check Works', [
      { p: ['A spot check is a fast theft and overpour check on a few high-risk bar products for one shift. You count a product before and after the shift, tell Bar Cop what the POS rang, and it shows whether what left the bar matches what was sold.'] },
      { h: 'Pick Your Targets', p: ['You do not check everything. Pick the bottles most likely to walk or get overpoured, usually your top-shelf liquor and your fast movers. Spot checks are bar only, so the picker holds liquor, wine, bottle beer, and draft.'] },
      { h: 'Count Before And After', p: ['Set the pre-shift count when the shift starts and the post-shift count when it ends. Liquor and wine use the fill slider, bottle beer is cases plus loose, and draft uses the keg slider.'] },
      { h: 'Restocked And POS Sold', p: ['If you brought more up from storage mid-shift, enter it under Restocked so the used number stays honest. Then enter what the POS rang for that product: pours for liquor, wine, and draft, bottles for bottle beer.'] },
      { h: 'Reading The Result', p: ['Bar Cop works out what should have been sold from your counts and compares it to the POS. A gap flags red. A positive variance means more left the bar than was rung in, the classic sign of overpouring, give-aways, or theft.'] },
      { h: 'After You Save', p: ['Saved checks land in Spot Check History, where View opens the full breakdown. A flagged product can be sent straight to a Variance Investigation in Theft Risk with one click. Spot checks also feed your Theft Risk score and the Bar Cop Audit.'] }
    ]);
  },
  spInputHTML(slotId, p) {
    if (this._isCaseBeer(p)) {
      return '<div class="form-row" style="gap:10px;">'
        + '<div class="f" style="width:104px;"><label>Cases</label><div class="fw"><input class="suf sp-cases" data-slot="' + slotId + '" type="number" min="0" step="1" value="0" style="height:42px;text-align:center;"/><span class="suf">cs</span></div></div>'
        + '<div class="f" style="width:110px;"><label>Loose</label><div class="fw"><input class="suf sp-loose" data-slot="' + slotId + '" type="number" min="0" step="1" value="0" style="height:42px;text-align:center;"/><span class="suf">btl</span></div></div>'
        + '</div>';
    }
    if (this._isPourable(p)) {
      return BottleSlider.html(slotId, { value: 0, fulls: 0, category: p.category, shape: (p.category === 'Draft Beer' ? 'keg' : 'bottle') });
    }
    return '<div class="f" style="width:170px;"><label>Count</label><div class="fw"><input class="suf sp-num" data-slot="' + slotId + '" type="number" min="0" step="0.1" value="0" style="height:42px;text-align:center;"/><span class="suf">' + esc(App.productUnit(p) || 'units') + '</span></div></div>';
  },
  spMount(slotId, p, onChange) {
    if (!this._isCaseBeer(p) && this._isPourable(p)) { BottleSlider.mount(slotId, onChange); return; }
    document.querySelectorAll('[data-slot="' + slotId + '"]').forEach(inp => inp.addEventListener('input', onChange));
  },
  spRead(slotId, p) {
    if (this._isCaseBeer(p)) {
      const cs = parseFloat(document.querySelector('.sp-cases[data-slot="' + slotId + '"]')?.value) || 0;
      const loose = parseFloat(document.querySelector('.sp-loose[data-slot="' + slotId + '"]')?.value) || 0;
      const total = cs * (p.case_size || 1) + loose;
      return { fulls: total, value: 0, total };
    }
    if (this._isPourable(p)) {
      const g = (BottleSlider.get ? BottleSlider.get(slotId) : null) || { fulls: 0, value: 0 };
      return { fulls: g.fulls || 0, value: g.value || 0, total: (g.fulls || 0) + (g.value || 0) };
    }
    const n = parseFloat(document.querySelector('.sp-num[data-slot="' + slotId + '"]')?.value) || 0;
    return { fulls: n, value: 0, total: n };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.renderMain();
  },

  // Spot checks are a bar control, so the picker holds bar products only
  // (liquor, wine, bottle beer, draft). Food and Misc are excluded.
  productOptions() {
    const bar = App.BAR_CATS;
    const prods = this.products().filter(p => bar.includes(p.category));
    const cats = bar.filter(c => prods.some(p => p.category === c));
    let h = '<option value="">Add a product to check...</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => p.category === cat)
        .forEach(p => { h += '<option value="' + p.id + '">' + esc(p.name) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  },

  lineHTML(lid, p) {
    const pp = this.poursPer(p);
    return '<div class="sp-line" data-lid="' + lid + '" data-pid="' + p.id + '" data-vd="0" '
      + 'style="border:1px solid var(--b1);border-radius:6px;padding:16px;margin-bottom:12px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">'
        + '<span style="flex:1;font-size:15px;font-weight:700;color:var(--t1);">' + esc(p.name) + '</span>'
        + '<span class="badge badge-dim">' + esc(p.category || '-') + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm sp-remove">Remove</button>'
      + '</div>'
      // Pre-shift count: open bottle (slider partial 0-1) + full bottles (integer)
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px;">'
        + '<div style="flex:1;min-width:220px;">'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Pre-Shift Count</div>'
          + this.spInputHTML('sp-pre-' + lid, p)
        + '</div>'
        + '<div style="flex:1;min-width:220px;">'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Post-Shift Count</div>'
          + this.spInputHTML('sp-post-' + lid, p)
        + '</div>'
      + '</div>'
      // Mid-shift restock + POS pours sold inputs.
      + '<div class="form-row" style="gap:14px;margin-bottom:10px;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Restocked Mid-Shift ' + tt(p.category === 'Draft Beer' ? 'sp-restock-keg' : 'sp-restock') + '</label>'
          + '<div class="fw"><input class="suf sp-added" type="number" min="0" step="1" placeholder="0" style="height:42px;font-size:15px;"/><span class="suf">' + this._restockUnit(p) + '</span></div>'
        + '</div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>' + this._posLabel(p) + ' ' + tt(this._isCaseBeer(p) ? 'sp-pos-btl' : 'sp-pos-pours') + '</label>'
          + '<div class="fw"><input class="suf sp-sold" type="number" min="0" step="1" placeholder="0" style="height:42px;font-size:15px;"/><span class="suf">' + this._posUnit(p) + '</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="sp-result" style="font-size:12px;color:var(--t3);line-height:1.6;padding:10px 12px;background:var(--bg);border:1px solid var(--b2);border-radius:4px;">'
      + 'Set the pre and post counts, then enter POS ' + this._servingWord(p) + ' sold, to see the variance.</div>'
      + '</div>';
  },

  renderMain() {
    this.actions.innerHTML = '';

    if (this.products().length === 0) {
      App.setupCard(this.container, {
        title: 'Set Up Spot Checks',
        lead: 'A spot check is a fast theft check on a few high-risk bottles mid-shift. Add your products and you can run one in under a minute.',
        steps: [
          { title: 'Add your products', desc: 'A spot check runs against the bottles you stock, so add your products first.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 }
        ]
      });
      return;
    }

    this._seq = 0;
    const today = new Date().toISOString().slice(0, 10);

    // Pre-fill from the active shift when one is running — that's the most
    // common case for a mid-service spot check. Operator can still pick a
    // different shift type and a different person before saving.
    const active = App.activeShift();
    const defaultShift = active && active.shift_type ? active.shift_type : 'Dinner';
    const shiftOpts = (App.SHIFT_TYPES || ['Brunch','Lunch','Dinner','Late Night','Full Day'])
      .map(t => '<option' + (t === defaultShift ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const setup = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Spot Check</span>'
      + '<button class="btn btn-ghost btn-sm" id="sp-how">How This Works</button></div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="sp-date" value="' + today + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift</label>'
      + '<select id="sp-shift" style="height:44px;">' + shiftOpts + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Checked By</label>'
      + '<select id="sp-by" style="height:44px;">' + App.staffOptions(App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div></div>';

    const productsCard = '<div class="card"><div class="card-title">Products Checked</div>'
      + '<div id="sp-lines"></div>'
      + '<div class="form-row" style="gap:12px;margin-bottom:0;"><div class="f" style="width:260px;flex-shrink:0;">'
      + '<label>Add Product</label><select id="sp-add" style="height:44px;">' + this.productOptions() + '</select></div></div>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Products</div><div class="calc-val" id="sp-count">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Flagged</div><div class="calc-val" id="sp-flagged">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Variance</div><div class="calc-val" id="sp-total">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="sp-save">Save Spot Check</button>'
      + '<span id="sp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">' + setup + productsCard + this.historyCard() + '</div>'
      + this.delModal();

    const lines = document.getElementById('sp-lines');
    const onInput = ev => {
      const line = ev.target.closest('.sp-line');
      if (line) { this.recalcLine(line); this.recalcTotal(); }
    };
    lines.addEventListener('input', onInput);
    lines.addEventListener('click', ev => {
      if (ev.target.closest('.sp-remove')) {
        ev.target.closest('.sp-line').remove();
        this.recalcTotal();
      }
    });
    document.getElementById('sp-add')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      if (p) {
        const lid = ++this._seq;
        lines.insertAdjacentHTML('beforeend', this.lineHTML(lid, p));
        const newLine = lines.querySelector('.sp-line[data-lid="' + lid + '"]');
        // Mount the two BottleSliders for this line. Slider changes do not
        // bubble as input events, so we recompute the line from the slider
        // onChange callback directly.
        this.spMount('sp-pre-'  + lid, p, () => { if (newLine) { this.recalcLine(newLine); this.recalcTotal(); } });
        this.spMount('sp-post-' + lid, p, () => { if (newLine) { this.recalcLine(newLine); this.recalcTotal(); } });
        this.recalcLine(newLine);
        this.recalcTotal();
      }
      e.target.value = '';
    });
    document.getElementById('sp-save')?.addEventListener('click', () => this.save());
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderMain()); return; }
      const how = ev.target.closest('#sp-how');
      const hrow = ev.target.closest('.sp-hrow');
      const hview = ev.target.closest('.sp-hview');
      const hdel = ev.target.closest('.sp-hdel');
      if (how) { this.showHowTo(); return; }
      if (hdel) { ev.stopPropagation(); this.confirmDel(hdel.dataset.id); }
      else if (hview) { ev.stopPropagation(); this.renderDetail(hview.dataset.id); }
      else if (hrow) this.renderDetail(hrow.dataset.id);
    };
  },

  // compute one line; returns its variance dollars and supporting numbers
  // Pre + Post counts come from BottleSliders (open + full split). Added is
  // full bottles brought up from storage during the shift. Sold is from
  // the operator's POS report for that shift.
  //   actual_pours_used = (pre_total + added - post_total) × pours_per_container
  //   expected_pours    = pos_pours_sold
  //   variance_pours    = actual - expected   (positive = overpoured/theft)
  //   variance_dollars  = variance_pours × cost_per_pour
  lineCalc(line) {
    const p = this.productById(line.dataset.pid);
    if (!p) return null;
    const lid = line.dataset.lid;
    const pre  = this.spRead('sp-pre-'  + lid, p);
    const post = this.spRead('sp-post-' + lid, p);
    const preTotal  = pre.total;
    const postTotal = post.total;
    const num = sel => { const v = parseFloat(line.querySelector(sel)?.value); return isNaN(v) ? null : v; };
    const added = num('.sp-added') || 0;
    const sold  = num('.sp-sold');
    const pp    = this.poursPer(p);
    const usedContainers = preTotal + added - postTotal;
    const actualPours = usedContainers * pp;
    const variance = sold != null ? actualPours - sold : null;
    const vd = variance != null ? variance * this.costPer(p) : null;
    return {
      p,
      preTotal, postTotal, added, sold,
      pre_value: pre.value, pre_fulls: pre.fulls,
      post_value: post.value, post_fulls: post.fulls,
      used: usedContainers,
      poured: actualPours,
      variance, vd, pp
    };
  },

  recalcLine(line) {
    const r = this.lineCalc(line);
    const res = line.querySelector('.sp-result');
    if (!r) {
      line.dataset.vd = '0';
      line.dataset.flag = '0';
      if (res) res.innerHTML = 'Set the pre and post counts to start the variance calculation.';
      return;
    }
    const sw = this._servingWord(r.p);
    line.dataset.vd = r.vd != null ? r.vd : '0';
    if (r.preTotal === 0 && r.postTotal === 0) {
      line.dataset.flag = '0';
      if (res) res.innerHTML = 'Set the pre and post counts to start the variance calculation.';
      return;
    }
    const usedTxt = 'Used ' + r.used.toFixed(2) + ' container'
      + (Math.abs(r.used - 1) < 0.001 ? '' : 's')
      + (r.added > 0 ? ' (restocked ' + r.added + ' mid-shift)' : '')
      + ' &middot; ' + r.poured.toFixed(1) + ' ' + sw + ' actual';
    if (r.variance == null) {
      line.dataset.flag = '0';
      if (res) res.innerHTML = '<span style="color:var(--t2);">' + usedTxt + '.</span> Enter POS ' + sw + ' sold to see the variance.';
      return;
    }
    // Flag when variance is meaningfully off (more than ~half a serving or $1
    // either direction). Positive variance = more left the bar than was rung in.
    const flagged = Math.abs(r.variance) > 0.5 && Math.abs(r.vd) >= 1;
    line.dataset.flag = flagged ? '1' : '0';
    const cls = flagged ? 'var(--red)' : 'var(--gold)';
    const direction = r.variance > 0 ? 'Over' : (r.variance < 0 ? 'Under' : 'On target');
    const byTxt = r.variance === 0 ? '' : ' by ' + Math.abs(r.variance).toFixed(1) + ' ' + sw;
    if (res) res.innerHTML = '<span style="color:var(--t2);">' + usedTxt + ' &middot; ' + r.sold.toFixed(0) + ' ' + sw + ' rung in.</span><br>'
      + '<span style="color:' + cls + ';font-weight:700;">' + direction + byTxt + ' &middot; '
      + (r.vd > 0 ? '+' : '') + App.fmtCurrency(r.vd) + '</span>';
  },

  recalcTotal() {
    const lines = [...document.querySelectorAll('.sp-line')];
    let total = 0, flagged = 0;
    lines.forEach(line => {
      total += parseFloat(line.dataset.vd) || 0;
      if (line.dataset.flag === '1') flagged++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('sp-count', lines.length);
    set('sp-flagged', flagged);
    const totEl = document.getElementById('sp-total');
    if (totEl) {
      totEl.textContent = (total > 0 ? '+' : '') + App.fmtCurrency(total);
      totEl.className = 'calc-val' + (flagged ? ' warn' : '');
    }
  },

  async save() {
    if (!App.canEdit('ic-spot-check')) return;   // staff-permission guard
    const err = document.getElementById('sp-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('sp-date')?.value;
    if (!date) { fail('Date is required.'); return; }

    const lines = [...document.querySelectorAll('.sp-line')];
    if (lines.length === 0) { fail('Add at least one product to check.'); return; }

    const items = [];
    let valid = false;
    lines.forEach(line => {
      const r = this.lineCalc(line);
      const p = this.productById(line.dataset.pid);
      if (!p) return;
      // A line is valid for save when at least one count was set (either
      // partial level or full bottles entered on pre or post).
      if (r && (r.preTotal > 0 || r.postTotal > 0)) valid = true;
      items.push({
        product_id:      p.id,
        name:            p.name,
        category:        p.category || '',
        pours_per_container: this.poursPer(p),
        cost_per_pour:   this.costPer(p),
        // Open-bottle partial level and full-bottle integer for pre + post.
        pre_value:       r ? r.pre_value : null,
        pre_fulls:       r ? r.pre_fulls : null,
        pre_total:       r ? r.preTotal : null,
        post_value:      r ? r.post_value : null,
        post_fulls:      r ? r.post_fulls : null,
        post_total:      r ? r.postTotal : null,
        // Backward-compat fields for any downstream consumer that still
        // expects flat pre/post numbers.
        pre:             r ? r.preTotal : null,
        post:            r ? r.postTotal : null,
        added:           r ? r.added : null,
        pos_sold:        r ? r.sold : null,
        used_containers: r ? r.used : null,
        poured:          r ? r.poured : null,
        variance_pours:  r ? r.variance : null,
        variance_dollar: r ? r.vd : null,
        flagged:         line.dataset.flag === '1'
      });
    });
    if (!valid) { fail('Set pre and post counts for at least one product.'); return; }

    const rec = {
      id:           App.uid(),
      date,
      shift:        document.getElementById('sp-shift')?.value || '',
      checked_by_id: document.getElementById('sp-by')?.value || '',
      checked_by:   (App.staffById(document.getElementById('sp-by')?.value) || {}).name || '',
      items,
      product_count:  items.length,
      flagged_count:  items.filter(i => i.flagged).length,
      total_variance_dollar: items.reduce((t, i) => t + (i.variance_dollar || 0), 0),
      created_at:   new Date().toISOString()
    };

    const btn = document.getElementById('sp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'spot_check', rec);
    if (ok) {
      this.renderMain();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Spot Check'; }
      fail('Save failed. Try again.');
    }
  },

  historyCard() {
    const list = [...this.checks()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    if (list.length === 0) return '';
    const rows = list.slice(0, App.listLimit('ic', 'spot_check')).map(c => {
      const vd = c.total_variance_dollar || 0;
      return '<tr class="sp-hrow" data-id="' + c.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
        + '<td>' + esc(c.shift || '-') + '</td>'
        + '<td>' + esc(c.checked_by || '-') + '</td>'
        + '<td>' + (c.product_count || 0) + '</td>'
        + '<td class="' + (c.flagged_count ? 'neg' : '') + '">' + (c.flagged_count || 0) + '</td>'
        + '<td class="' + (vd > 0 ? 'neg' : '') + '">' + (vd > 0 ? '+' : '') + App.fmtCurrency(vd) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm sp-hview" data-id="' + c.id + '">View</button>'
        + (App.canEdit('ic-spot-check') ? '<button class="btn btn-danger btn-sm sp-hdel" data-id="' + c.id + '">Delete</button>' : '')
        + '</div></td></tr>';
    }).join('');
    return '<div class="card"><div class="card-title">Spot Check History</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Checked By</th><th>Products</th><th>Flagged</th><th>Variance</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('ic', 'spot_check', list, false) + '</div>';
  },

  renderDetail(id) {
    const c = this.checks().find(x => x.id === id);
    if (!c) { this.renderMain(); return; }
    this.actions.innerHTML = '';

    const rows = (c.items || []).map(it => {
      const vd = it.variance_dollar;
      // Flagged rows get an Investigate action that pre-fills a Variance
      // Investigation in Theft Risk. Closes the orphan where the operator
      // had to retype the product name after seeing the flag.
      const action = (it.flagged && it.product_id)
        ? '<button class="btn btn-ghost btn-sm sp-investigate" data-pid="' + esc(it.product_id) + '" data-name="' + esc(it.name) + '">Investigate</button>'
        : '';
      return '<tr><td><div class="val">' + esc(it.name) + '</div></td>'
        + '<td>' + esc(it.category || '-') + '</td>'
        + '<td>' + (it.pre != null ? it.pre.toFixed(1) : '-') + '</td>'
        + '<td>' + (it.post != null ? it.post.toFixed(1) : '-') + '</td>'
        + '<td>' + (it.poured != null ? it.poured.toFixed(1) : '-') + '</td>'
        + '<td>' + (it.pos_sold != null ? it.pos_sold.toFixed(1) : '-') + '</td>'
        + '<td class="' + (it.flagged ? 'neg' : '') + '">'
        + (it.variance_pours != null ? (it.variance_pours > 0 ? '+' : '') + it.variance_pours.toFixed(1) : '-') + '</td>'
        + '<td class="' + (it.flagged ? 'neg' : '') + '">'
        + (vd != null ? (vd > 0 ? '+' : '') + App.fmtCurrency(vd) : '-') + '</td>'
        + '<td>' + action + '</td></tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Spot Check &middot; ' + this.fmtDate(c.date) + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="sp-export">Export PDF</button></div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Shift</div><div class="calc-val">' + esc(c.shift || '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Checked By</div><div class="calc-val">' + esc(c.checked_by || '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Flagged</div><div class="calc-val ' + (c.flagged_count ? 'warn' : '') + '">' + (c.flagged_count || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Variance</div><div class="calc-val ' + ((c.total_variance_dollar || 0) > 0 ? 'warn' : '') + '">'
      + ((c.total_variance_dollar || 0) > 0 ? '+' : '') + App.fmtCurrency(c.total_variance_dollar || 0) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Pre</th><th>Post</th><th>Poured</th><th>POS Sold</th>'
      + '<th>Variance</th><th>Variance $</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#sp-export')) { App.exportPDF({ title: 'Spot Check', root: this.container }); return; }
      const inv = ev.target.closest('.sp-investigate');
      if (inv) {
        ev.stopPropagation();
        this.openInvestigation(inv.dataset.pid, inv.dataset.name);
      }
    };
  },

  // Spin up a Variance Investigation in theft-risk pre-filled with this
  // product, then navigate the operator to it. Same shape as the dropdown
  // path on theft-risk's investigationsCard, but the trigger is the
  // flagged spot-check row instead of the manual dropdown.
  openInvestigation(productId, productName) {
    App.data.variance_investigations = App.data.variance_investigations || [];
    // De-dupe — if an open investigation already exists for this product,
    // jump to theft-risk instead of opening a second one.
    const existing = App.data.variance_investigations.find(i =>
      i.product_id === productId && i.status !== 'resolved');
    if (!existing) {
      const steps = (S.TheftRisk && S.TheftRisk.VARIANCE_STEPS)
        ? S.TheftRisk.VARIANCE_STEPS.map(() => ({ done: false, finding: '' }))
        : [];
      const inv = {
        id: App.uid(),
        product_id: productId,
        sku: productName,
        opened_date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
        status: 'open',
        steps,
        resolution: ''
      };
      App.putRecord('core', 'variance_investigation', inv);
    }
    App.showApp('profit');
    App.navigate('theft-risk');
  },

  delModal() {
    return '<div id="sp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this spot check?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="sp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="sp-del-confirm">Delete</button>'
      + '</div></div></div>';
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('sp-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('sp-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('sp-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      await App.removeRecord('ic', 'spot_check', delId);
      this.renderMain();
    };
  }
};
