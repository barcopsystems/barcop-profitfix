'use strict';

/* ── Shift Control — Waste / Spill Log (writes sc_waste) ──────────────────────
   Records product that left inventory without producing revenue: spills,
   broken bottles, dumped drinks, expired food. Each entry links to an
   ic_product by id and captures units consumed so the Inventory Variance
   Report can subtract waste from "used" before comparing against POS sales.
   Otherwise legit waste shows up as false-positive theft variance.

   Feeds: Inventory Variance Report adjustments, Profit Audit shrinkage
   section, Theft Risk score (large unexplained waste is a signal). */

S.ShiftWaste = {
  editId: null,
  _pendingDelId: null,
  REASONS: ['Spill', 'Broken', 'Bad Pour / Customer Dissatisfied', 'Dumped / Tasted Bad', 'Expired / Past Date', 'Training', 'Other'],

  records() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_waste)) App.shiftData.sc_waste = [];
    return App.shiftData.sc_waste;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  shiftTypes() {
    return (S.ShiftLogShift && S.ShiftLogShift.SHIFT_TYPES) || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'];
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Per-product unit label so the operator sees what the Units field means
  // for the picked product (case beer counts in btls, draft in oz when
  // partial keg loss, food in whatever unit was set on Product Setup).
  unitLabel(p) {
    if (!p) return 'units';
    if (p.category === 'Bottle Beer') return 'btls';
    if (p.category === 'Draft Beer')  return 'oz';
    if (p.category === 'Food' || p.category === 'Misc') return (p.unit_type || 'units');
    return 'btls';
  },

  // Dollar value of the waste line so the operator sees the cost weight on
  // the log. Uses App.bottleCost for per-bottle cost on case-tracked beer,
  // ounces × per-oz for draft, units × unit_cost for food/misc.
  costFor(p, units) {
    if (!p || !units) return 0;
    if (p.category === 'Draft Beer') {
      if (!p.container_size_oz || p.unit_cost == null) return 0;
      return (units / p.container_size_oz) * p.unit_cost;
    }
    if (p.category === 'Food' || p.category === 'Misc') {
      return (p.unit_cost != null) ? units * p.unit_cost : 0;
    }
    const bc = App.bottleCost(p);
    return bc != null ? units * bc : 0;
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Waste / Spill';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => window.print());
    actions.appendChild(exportBtn);
    this.renderList();
  },

  renderList() {
    const recs = [...this.records()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    let html;
    if (recs.length === 0) {
      html = '<div class="empty"><div class="empty-title">No waste logged yet</div>'
        + '<div class="empty-sub">Log every spill, broken bottle, dumped drink, or expired item. Bar Cop subtracts logged waste from inventory variance so legit losses do not show up as theft signal.</div>'
        + '<button class="btn btn-primary" id="wl-add-first">Log Waste / Spill</button></div>';
    } else {
      const totalCost = recs.reduce((t, r) => t + (r.cost || 0), 0);
      const totalUnits = recs.reduce((t, r) => t + (r.units || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + recs.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Units</div><div class="calc-val">' + totalUnits.toFixed(2).replace(/\.00$/, '') + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Cost</div><div class="calc-val warn">' + App.fmtCurrency(totalCost) + '</div></div>'
        + '</div>';
      const rows = recs.map(r => {
        const p = this.productById(r.product_id);
        const unit = p ? this.unitLabel(p) : (r.unit || 'units');
        return '<tr class="wl-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + esc(r.shift_type || '-') + '</td>'
          + '<td>' + esc(p?.name || r.product_name || '-') + (p?.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.category) + '</div>' : '') + '</td>'
          + '<td class="val">' + (r.units || 0) + ' ' + esc(unit) + '</td>'
          + '<td>' + App.fmtCurrency(r.cost || 0) + '</td>'
          + '<td>' + esc(r.reason || '-') + '</td>'
          + '<td>' + esc(r.recorded_by || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-waste') ? '<button class="btn btn-ghost btn-sm wl-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('sc-waste') ? '<button class="btn btn-danger btn-sm wl-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Product</th><th>Units</th><th>Cost</th>'
        + '<th>Reason</th><th>Recorded By</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="wl-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="wl-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="wl-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.wl-row');
      const edit = ev.target.closest('.wl-edit');
      const del = ev.target.closest('.wl-del');
      const addF = ev.target.closest('#wl-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('sc-waste')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  productOptions(selectedId) {
    const prods = this.products();
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => {
        const order = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    let h = '<option value="">Select product...</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(p => {
          h += '<option value="' + p.id + '"' + (selectedId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        });
      h += '</optgroup>';
    });
    return h;
  },

  reasonOptions(selected) {
    return '<option value="">Select reason...</option>'
      + this.REASONS.map(r => '<option' + (r === selected ? ' selected' : '') + '>' + r + '</option>').join('');
  },

  showForm(id) {
    if (id && !App.canEdit('sc-waste')) return;
    this.editId = id || null;
    const r = id ? this.records().find(x => x.id === id) : null;
    const shiftOpts = '<option value="">Select shift...</option>'
      + this.shiftTypes().map(t => '<option' + (r && r.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';
    const currentProd = r ? this.productById(r.product_id) : null;
    const initialUnitLabel = currentProd ? this.unitLabel(currentProd) : 'units';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Waste / Spill</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="wl-date" value="' + esc(r?.date || new Date().toISOString().slice(0, 10)) + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift</label>'
      + '<select id="wl-shift" style="height:44px;">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:240px;"><label>Product</label>'
      + '<select id="wl-product" style="height:44px;">' + this.productOptions(r?.product_id) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Units Lost</label>'
      + '<div class="fw"><input class="suf" type="number" id="wl-units" min="0" step="0.01" inputmode="decimal" value="' + v(r?.units) + '" placeholder="0" style="height:44px;font-size:16px;"/><span class="suf" id="wl-unit-label">' + esc(initialUnitLabel) + '</span></div></div>'
      + '<div class="f" style="width:240px;flex-shrink:0;"><label>Reason</label>'
      + '<select id="wl-reason" style="height:44px;">' + this.reasonOptions(r?.reason) + '</select></div>'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>Recorded By</label>'
      + '<input type="text" id="wl-by" value="' + esc(r?.recorded_by || '') + '" placeholder="Name" style="height:44px;"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="wl-notes" rows="2" placeholder="Optional">' + esc(r?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="wl-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="wl-cancel">Cancel</button>'
      + '<span id="wl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('wl-product')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      const lbl = document.getElementById('wl-unit-label');
      if (lbl) lbl.textContent = this.unitLabel(p);
    });
    document.getElementById('wl-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('wl-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('wl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('wl-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const product_id = document.getElementById('wl-product')?.value;
    if (!product_id) { fail('Pick a product.'); return; }
    const units = parseFloat(document.getElementById('wl-units')?.value);
    if (isNaN(units) || units <= 0) { fail('Enter units lost.'); return; }
    const reason = document.getElementById('wl-reason')?.value;
    if (!reason) { fail('Pick a reason.'); return; }

    const p = this.productById(product_id);
    const cost = this.costFor(p, units);

    const rec = {
      id:           this.editId || App.uid(),
      date,
      shift_type:   document.getElementById('wl-shift')?.value || '',
      product_id,
      product_name: p?.name || '',
      product_category: p?.category || '',
      unit:         this.unitLabel(p),
      units,
      cost,
      reason,
      recorded_by:  document.getElementById('wl-by')?.value.trim() || '',
      notes:        document.getElementById('wl-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.records();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('wl-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('wl-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('wl-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('wl-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_waste = this.records().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderList();
    };
  }
};
