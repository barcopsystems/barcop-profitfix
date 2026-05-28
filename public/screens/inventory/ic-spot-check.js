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

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.renderMain();
  },

  productOptions() {
    const prods = this.products();
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => {
        const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    let h = '<option value="">Add a product to check...</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat)
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
          + BottleSlider.html('sp-pre-' + lid, { value: 0, fulls: 0, category: p.category })
        + '</div>'
        + '<div style="flex:1;min-width:220px;">'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Post-Shift Count</div>'
          + BottleSlider.html('sp-post-' + lid, { value: 0, fulls: 0, category: p.category })
        + '</div>'
      + '</div>'
      // Mid-shift restock + POS pours sold inputs.
      + '<div class="form-row" style="gap:14px;margin-bottom:10px;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Restocked Mid-Shift</label>'
          + '<div class="fw"><input class="suf sp-added" type="number" min="0" step="1" placeholder="0" style="height:42px;font-size:15px;"/><span class="suf">btl</span></div>'
          + '<div style="font-size:10px;color:var(--t3);margin-top:4px;">Full bottles added from storage during the shift.</div>'
        + '</div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>POS Pours Sold</label>'
          + '<div class="fw"><input class="suf sp-sold" type="number" min="0" step="1" placeholder="0" style="height:42px;font-size:15px;"/><span class="suf">pours</span></div>'
          + '<div style="font-size:10px;color:var(--t3);margin-top:4px;">From your POS report for this shift.</div>'
        + '</div>'
      + '</div>'
      + '<div class="sp-result" style="font-size:12px;color:var(--t3);line-height:1.6;padding:10px 12px;background:var(--bg);border:1px solid var(--b2);border-radius:4px;">'
      + 'Drag pre and post sliders, then enter POS pours to see the variance. ' + (pp ? pp.toFixed(1) : '1') + ' pours per container.</div>'
      + '</div>';
  },

  renderMain() {
    this.actions.innerHTML = '';

    if (this.products().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No products to check</div>'
        + '<div class="empty-sub">Add the products you stock in the Products screen, then run a spot check '
        + 'on your high-risk bottles.</div></div></div>';
      this.container.onclick = null;
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
    const setup = '<div class="card"><div class="card-title">Spot Check</div>'
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
        BottleSlider.mount('sp-pre-'  + lid, () => { if (newLine) { this.recalcLine(newLine); this.recalcTotal(); } });
        BottleSlider.mount('sp-post-' + lid, () => { if (newLine) { this.recalcLine(newLine); this.recalcTotal(); } });
        this.recalcLine(newLine);
        this.recalcTotal();
      }
      e.target.value = '';
    });
    document.getElementById('sp-save')?.addEventListener('click', () => this.save());
    this.container.onclick = ev => {
      const hrow = ev.target.closest('.sp-hrow');
      const hview = ev.target.closest('.sp-hview');
      const hdel = ev.target.closest('.sp-hdel');
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
    const pre  = BottleSlider.get ? BottleSlider.get('sp-pre-'  + lid) : null;
    const post = BottleSlider.get ? BottleSlider.get('sp-post-' + lid) : null;
    if (!pre || !post) return null;
    const preTotal  = (pre.fulls || 0) + (pre.value || 0);
    const postTotal = (post.fulls || 0) + (post.value || 0);
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
      if (res) res.innerHTML = 'Set the pre and post bottle levels to start the variance calculation.';
      return;
    }
    line.dataset.vd = r.vd != null ? r.vd : '0';
    if (r.preTotal === 0 && r.postTotal === 0) {
      line.dataset.flag = '0';
      if (res) res.innerHTML = 'Set the pre and post bottle levels to start the variance calculation.';
      return;
    }
    const usedTxt = 'Used ' + r.used.toFixed(2) + ' container'
      + (Math.abs(r.used - 1) < 0.001 ? '' : 's')
      + (r.added > 0 ? ' (restocked ' + r.added + ' mid-shift)' : '')
      + ' &middot; ' + r.poured.toFixed(1) + ' pours actual';
    if (r.variance == null) {
      line.dataset.flag = '0';
      if (res) res.innerHTML = '<span style="color:var(--t2);">' + usedTxt + '.</span> Enter POS pours sold to see the variance.';
      return;
    }
    // Flag when variance is meaningfully off (more than ~half a pour or $1
    // either direction). Positive variance = overpoured/possible theft.
    // Negative variance = unusual, could be spill or miscount.
    const flagged = Math.abs(r.variance) > 0.5 && Math.abs(r.vd) >= 1;
    line.dataset.flag = flagged ? '1' : '0';
    const cls = flagged ? 'var(--red)' : 'var(--gold)';
    const direction = r.variance > 0 ? 'Overpoured' : (r.variance < 0 ? 'Underpoured' : 'On target');
    if (res) res.innerHTML = '<span style="color:var(--t2);">' + usedTxt + ' &middot; ' + r.sold.toFixed(0) + ' pours rung in.</span><br>'
      + '<span style="color:' + cls + ';font-weight:700;">' + direction + ' by ' + Math.abs(r.variance).toFixed(1) + ' pours &middot; '
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
    this.checks().push(rec);
    const ok = await App.saveInventory();
    if (ok) {
      this.renderMain();
    } else {
      this.checks().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Spot Check'; }
      fail('Save failed. Try again.');
    }
  },

  historyCard() {
    const list = [...this.checks()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    if (list.length === 0) return '';
    const rows = list.map(c => {
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
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  renderDetail(id) {
    const c = this.checks().find(x => x.id === id);
    if (!c) { this.renderMain(); return; }
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="sp-export">Export PDF</button>';
    document.getElementById('sp-export')?.addEventListener('click', () => window.print());

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
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="sp-back">&#8592; Back to Spot Check</button></div>'
      + '<div class="card"><div class="card-title">Spot Check &middot; ' + this.fmtDate(c.date) + '</div>'
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
      if (ev.target.closest('#sp-back')) this.render(this.container, this.actions);
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
      App.data.variance_investigations.push({
        id: App.uid(),
        product_id: productId,
        sku: productName,
        opened_date: new Date().toISOString().slice(0, 10),
        status: 'open',
        steps,
        resolution: ''
      });
      App.saveKey('variance_investigations');
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
      App.inventoryData.ic_spot_checks = this.checks().filter(x => x.id !== delId);
      await App.saveInventory();
      this.renderMain();
    };
  }
};
