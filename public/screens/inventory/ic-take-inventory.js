'use strict';

/* ── Inventory Control — Take Inventory (writes ic_counts) ────────────────────
   Count types: Full / Bar Only / Kitchen Only / Custom. Products are counted
   with the bottle slider, grouped and stepped through by location. The working
   count auto-saves to localStorage so it survives a reload and can be resumed.
   On submit a finalized count record is written to App.inventoryData.ic_counts. */

S.InventoryTakeInventory = {
  draft: null,
  locStep: 0,
  DRAFT_KEY: 'ic_count_draft',
  BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  KITCHEN_CATS: ['Food', 'Misc'],

  products() {
    const all = (App.inventoryData && App.inventoryData.ic_products) || [];
    return all.filter(p => p.active !== false);
  },
  counts() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_counts)) App.inventoryData.ic_counts = [];
    return App.inventoryData.ic_counts;
  },

  loadDraft() {
    try { const r = localStorage.getItem(this.DRAFT_KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  },
  saveDraft() {
    if (!this.draft) return;
    try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {}
  },
  clearDraft() {
    try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {}
    this.draft = null;
  },

  ago(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'recently';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + ' hr ago';
    const days = Math.floor(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    if (this.draft && this.draft._view) this.route();
    else this.renderSetup();
  },

  route() {
    if (!this.draft) { this.renderSetup(); return; }
    if (this.draft._view === 'review') this.renderReview();
    else this.renderCounting();
  },

  // ── Setup ─────────────────────────────────────────────────────────────────
  renderSetup() {
    const prods = this.products();
    if (prods.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No products to count</div>'
        + '<div class="empty-sub">Add products in the Products screen before taking an inventory count.</div>'
        + '</div></div>';
      return;
    }

    const saved = this.loadDraft();
    const resumeBar = saved
      ? '<div class="alert-bar" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<div class="alert-text">A ' + esc(saved.type) + ' count started ' + this.ago(saved.started_at) + ' is in progress.</div>'
        + '<button class="btn btn-primary btn-sm" id="ti-resume">Resume Count</button></div>'
      : '';

    const locs = ((App.inventoryData && App.inventoryData.ic_locations) || []).filter(l => !l.archived);
    const locOpts = locs.length
      ? locs.map(l => '<label style="display:flex;align-items:center;gap:8px;padding:7px 0;font-size:13px;color:var(--t1);cursor:pointer;">'
          + '<input type="checkbox" class="ti-loc" value="' + esc(l.name) + '" style="width:16px;height:16px;accent-color:var(--gold);"/>'
          + esc(l.name) + '</label>').join('')
      : '<div style="font-size:12px;color:var(--t3);">No locations defined yet. Add them in the Locations screen.</div>';

    const typeCard = (val, desc) =>
      '<label style="display:flex;gap:11px;align-items:flex-start;padding:13px 14px;border:1px solid var(--b1);border-radius:6px;cursor:pointer;margin-bottom:8px;">'
      + '<input type="radio" name="ti-type" value="' + val + '" style="margin-top:2px;accent-color:var(--gold);width:16px;height:16px;flex-shrink:0;"/>'
      + '<div><div style="font-size:13px;font-weight:700;color:var(--t1);">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + desc + '</div></div></label>';

    this.container.innerHTML = '<div class="screen">' + resumeBar
      + '<div class="card"><div class="card-title">Start an Inventory Count</div>'
      + typeCard('Full', 'Count every active product across all categories.')
      + typeCard('Bar Only', 'Liquor, wine, and beer only.')
      + typeCard('Kitchen Only', 'Food and misc products only.')
      + typeCard('Custom', 'Choose specific storage locations to count.')
      + '<div id="ti-custom" style="display:none;margin:6px 0 4px;padding:12px 14px;background:var(--input);border-radius:6px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Locations to Count</div>'
      + locOpts + '</div>'
      + '<div class="form-row" style="gap:16px;margin-top:14px;">'
      + '<div class="f w-md"><label>Counted By</label><input type="text" id="ti-by" placeholder="Optional"/></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ti-start">Start Count</button>'
      + '<span id="ti-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    this.container.querySelectorAll('input[name="ti-type"]').forEach(r =>
      r.addEventListener('change', () => {
        document.getElementById('ti-custom').style.display = (r.value === 'Custom' && r.checked) ? '' : 'none';
      }));
    document.getElementById('ti-resume')?.addEventListener('click', () => {
      this.draft = this.loadDraft();
      if (this.draft) {
        if (!this.draft._view) this.draft._view = 'counting';
        this.locStep = this.draft._locStep || 0;
        this.route();
      }
    });
    document.getElementById('ti-start')?.addEventListener('click', () => this.startCount());
  },

  startCount() {
    const typeEl = this.container.querySelector('input[name="ti-type"]:checked');
    const err = document.getElementById('ti-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!typeEl) { fail('Choose a count type.'); return; }
    const type = typeEl.value;
    let customLocs = [];
    if (type === 'Custom') {
      customLocs = [...this.container.querySelectorAll('.ti-loc:checked')].map(c => c.value);
      if (!customLocs.length) { fail('Select at least one location to count.'); return; }
    }
    this.draft = {
      type,
      custom_locations: customLocs,
      counted_by: document.getElementById('ti-by')?.value.trim() || '',
      counts: {},
      started_at: new Date().toISOString(),
      _view: 'counting',
      _locStep: 0
    };
    this.locStep = 0;
    this.saveDraft();
    this.renderCounting();
  },

  // ── Counting ──────────────────────────────────────────────────────────────
  countProducts() {
    const all = this.products();
    const t = this.draft.type;
    if (t === 'Bar Only')     return all.filter(p => this.BAR_CATS.includes(p.category));
    if (t === 'Kitchen Only') return all.filter(p => this.KITCHEN_CATS.includes(p.category));
    if (t === 'Custom')       return all.filter(p => this.draft.custom_locations.includes(p.primary_location || ''));
    return all;
  },

  groups() {
    const prods = this.countProducts();
    const order = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived).map(l => l.name);
    const byLoc = {};
    prods.forEach(p => {
      const loc = p.primary_location || 'Unassigned';
      (byLoc[loc] = byLoc[loc] || []).push(p);
    });
    const result = [];
    order.forEach(loc => { if (byLoc[loc]) { result.push({ location: loc, products: byLoc[loc] }); delete byLoc[loc]; } });
    Object.keys(byLoc).forEach(loc => result.push({ location: loc, products: byLoc[loc] }));
    return result;
  },

  renderCounting() {
    const groups = this.groups();
    if (groups.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No products match this count</div>'
        + '<div class="empty-sub">No active products fall under a ' + esc(this.draft.type) + ' count.</div>'
        + '<button class="btn btn-ghost" id="ti-back">Back to Setup</button></div></div>';
      document.getElementById('ti-back')?.addEventListener('click', () => { this.clearDraft(); this.renderSetup(); });
      return;
    }
    if (this.locStep >= groups.length) this.locStep = groups.length - 1;
    if (this.locStep < 0) this.locStep = 0;

    const grp = groups[this.locStep];
    const total = this.countProducts().length;
    const done = Object.keys(this.draft.counts).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const isLast = this.locStep === groups.length - 1;

    const cards = grp.products.map(p => {
      const c = this.draft.counts[p.id] || { value: 0, fulls: 0, notes: '' };
      return '<div class="card" style="margin-bottom:12px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(p.name) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + esc(p.category || 'Uncategorized')
        + (p.brand ? ' &middot; ' + esc(p.brand) : '') + '</div>'
        + '<div style="display:flex;justify-content:center;margin-bottom:14px;">'
        + BottleSlider.html(p.id, { value: c.value, fulls: c.fulls, category: p.category })
        + '</div>'
        + '<div class="f"><label>Notes</label><input type="text" class="ti-note" data-pid="' + p.id + '" '
        + 'value="' + esc(c.notes || '') + '" placeholder="Optional"/></div>'
        + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--t1);">' + esc(grp.location)
      + ' <span style="color:var(--t3);font-weight:600;font-size:11px;">Location ' + (this.locStep + 1) + ' of ' + groups.length + '</span></div>'
      + '<div style="font-size:11px;color:var(--t3);" id="ti-prog-txt">' + done + ' of ' + total + ' counted</div></div>'
      + '<div style="height:6px;background:var(--input);border-radius:3px;overflow:hidden;">'
      + '<div id="ti-prog-bar" style="height:100%;width:' + pct + '%;background:var(--gold);transition:width 0.2s;"></div></div></div>'
      + cards
      + '<div class="card-actions" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">'
      + '<button class="btn btn-ghost" id="ti-prev"' + (this.locStep === 0 ? ' disabled' : '') + '>&#8592; Previous</button>'
      + '<button class="btn btn-ghost" id="ti-exit">Save &amp; Exit</button>'
      + (isLast
          ? '<button class="btn btn-primary" id="ti-review">Review Count &#8594;</button>'
          : '<button class="btn btn-primary" id="ti-next">Next Location &#8594;</button>')
      + '</div></div>';

    BottleSlider._inst = {};
    grp.products.forEach(p => {
      BottleSlider.mount(p.id, (v) => {
        const prev = this.draft.counts[p.id] || {};
        this.draft.counts[p.id] = { value: v.value, fulls: v.fulls, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        this.updateProgress();
      });
    });
    this.container.querySelectorAll('.ti-note').forEach(inp => {
      inp.addEventListener('input', () => {
        const pid = inp.dataset.pid;
        const cur = this.draft.counts[pid] || { value: 0, fulls: 0 };
        this.draft.counts[pid] = { value: cur.value, fulls: cur.fulls, notes: inp.value };
        this.saveDraft();
        this.updateProgress();
      });
    });

    this.container.onclick = null;
    document.getElementById('ti-prev')?.addEventListener('click', () => { this.locStep--; this.draft._locStep = this.locStep; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-next')?.addEventListener('click', () => { this.locStep++; this.draft._locStep = this.locStep; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-review')?.addEventListener('click', () => { this.draft._view = 'review'; this.saveDraft(); this.renderReview(); });
    document.getElementById('ti-exit')?.addEventListener('click', () => { this.saveDraft(); App.navigate('ic-product-setup'); });
  },

  updateProgress() {
    const total = this.countProducts().length;
    const done = Object.keys(this.draft.counts).length;
    const txt = document.getElementById('ti-prog-txt');
    const bar = document.getElementById('ti-prog-bar');
    if (txt) txt.textContent = done + ' of ' + total + ' counted';
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  },

  // ── Review ────────────────────────────────────────────────────────────────
  rows() {
    return this.countProducts().map(p => {
      const c = this.draft.counts[p.id] || { value: 0, fulls: 0, notes: '' };
      const total = (c.fulls || 0) + (c.value || 0);
      const value = p.unit_cost != null ? total * p.unit_cost : null;
      return { p, c, total, value };
    });
  },

  renderReview() {
    const rows = this.rows();
    const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0);
    const counted = Object.keys(this.draft.counts).length;

    const tbody = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.p.name) + '</div>'
      + (r.p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.p.brand) + '</div>' : '') + '</td>'
      + '<td>' + esc(r.p.category || '—') + '</td>'
      + '<td>' + (r.c.fulls || 0) + '</td>'
      + '<td>' + (r.c.value || 0).toFixed(1) + '</td>'
      + '<td class="val">' + r.total.toFixed(1) + '</td>'
      + '<td>' + (r.value != null ? App.fmtCurrency(r.value) : '<span style="color:var(--t4);">—</span>') + '</td>'
      + '</tr>').join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Review ' + esc(this.draft.type) + ' Count</div>'
      + '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Products</div><div class="calc-val">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val">' + counted + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Inventory Value</div><div class="calc-val good">' + App.fmtCurrency(totalValue) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Full</th><th>Open</th><th>Total</th><th>Value</th>'
      + '</tr></thead><tbody>' + tbody + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:12px;">Products left untouched are recorded at zero. '
      + 'Go back to adjust any product before submitting.</div>'
      + '<div class="card-actions" style="justify-content:space-between;">'
      + '<button class="btn btn-ghost" id="ti-back-count">&#8592; Back to Counting</button>'
      + '<button class="btn btn-primary" id="ti-submit">Submit Count</button>'
      + '<span id="ti-sub-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('ti-back-count')?.addEventListener('click', () => { this.draft._view = 'counting'; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-submit')?.addEventListener('click', () => this.submit());
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  async submit() {
    const rows = this.rows();
    const items = rows.map(r => ({
      product_id: r.p.id,
      name:       r.p.name,
      category:   r.p.category || '',
      fulls:      r.c.fulls || 0,
      partial:    r.c.value || 0,
      total:      r.total,
      unit_cost:  r.p.unit_cost != null ? r.p.unit_cost : null,
      value:      r.value,
      notes:      r.c.notes || ''
    }));
    const record = {
      id:          App.uid(),
      date:        new Date().toISOString().slice(0, 10),
      type:        this.draft.type,
      counted_by:  this.draft.counted_by || '',
      locations:   [...new Set(rows.map(r => r.p.primary_location || 'Unassigned'))],
      items,
      item_count:  items.length,
      total_value: items.reduce((s, i) => s + (i.value || 0), 0),
      created_at:  new Date().toISOString()
    };

    const btn = document.getElementById('ti-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    this.counts().push(record);
    const ok = await App.saveInventory();
    if (ok) {
      this.clearDraft();
      this.renderDone(record);
    } else {
      this.counts().pop();
      const err = document.getElementById('ti-sub-err');
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Count'; }
    }
  },

  renderDone(record) {
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Count Submitted</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.type) + ' count &middot; ' + record.item_count
      + ' products &middot; ' + App.fmtCurrency(record.total_value) + ' total value</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;text-align:center;margin-bottom:16px;">'
      + 'Usage and variance against your previous count appear in Count History. '
      + 'This count can also feed Profit Recovery COGS for the period.</div>'
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-ghost" id="ti-again">Take Another Count</button>'
      + '<button class="btn btn-primary" id="ti-history">View Count History</button>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('ti-again')?.addEventListener('click', () => this.renderSetup());
    document.getElementById('ti-history')?.addEventListener('click', () => App.navigate('ic-count-history'));
  }
};
