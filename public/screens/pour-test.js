'use strict';

/* ── Profit Recovery — Pour Test (per-bartender pour accuracy) ────────────────
   Captures the operator's measured pour test: bartender pours their standard
   spec into a graduated cylinder, manager records spec vs actual ounces.
   Different signal from Spot Check (which measures the SHIFT). Pour Test
   measures the BARTENDER's technique over time. The chronic over-pourer is
   one of the most common bar-cost leaks and shift-level data misses it.

   Trends per bartender across recent tests. Bartenders with >5% average
   over-pour flag for coaching. Feeds Theft Risk as part of the existing
   Pour Variance signal. Stored at App.data.pour_tests[]. */

S.PourTest = {
  _editId: null,

  list() {
    if (!Array.isArray(App.data.pour_tests)) App.data.pour_tests = [];
    return App.data.pour_tests;
  },

  // Bar product master, active only. Pour spec defaults from product.pour_size_oz.
  barProducts() {
    return ((App.inventoryData && App.inventoryData.ic_products) || [])
      .filter(p => p.active !== false && App.BAR_CATS.includes(p.category));
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
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
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Pour Test';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Worksheet';
    printBtn.addEventListener('click', () => this.printBlank());
    actions.appendChild(printBtn);
    this.renderList();
  },

  printBlank() {
    App.printBlankSheet({
      title: 'Pour Test Sheet',
      subtitle: 'Have the bartender pour their standard spec into a measured cylinder. Manager enters results into Bar Cop after.',
      columns: [
        { label: 'Date',          width: '10%' },
        { label: 'Bartender',     width: '15%' },
        { label: 'Product',       width: '18%' },
        { label: 'Spec (oz)',     width: '10%' },
        { label: 'Actual (oz)',   width: '10%' },
        { label: 'Deviation',     width: '12%' },
        { label: 'Manager',       width: '15%' },
        { label: 'Notes',         width: '10%' }
      ],
      rows: 12
    });
  },

  renderList() {
    const records = this.list().slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Per-bartender summary: avg deviation %, count, last test date.
    // A bartender averaging >5% over their spec is a real cost leak — flag.
    const byBartender = {};
    records.forEach(r => {
      const key = r.bartender_id || r.bartender_name || 'Unknown';
      if (!byBartender[key]) byBartender[key] = {
        name: r.bartender_name || 'Unknown',
        tests: 0,
        totalDevPct: 0,
        lastDate: ''
      };
      byBartender[key].tests++;
      byBartender[key].totalDevPct += (parseFloat(r.deviation_pct) || 0);
      if (!byBartender[key].lastDate || r.date > byBartender[key].lastDate) {
        byBartender[key].lastDate = r.date;
      }
    });
    const summaryRows = Object.values(byBartender)
      .map(b => ({ ...b, avgDevPct: b.tests ? b.totalDevPct / b.tests : 0 }))
      .sort((a, b) => Math.abs(b.avgDevPct) - Math.abs(a.avgDevPct));

    let summaryCard = '';
    if (summaryRows.length) {
      const rows = summaryRows.map(b => {
        const flagged = Math.abs(b.avgDevPct) > 5;
        const direction = b.avgDevPct > 0 ? 'over' : b.avgDevPct < 0 ? 'under' : 'on';
        return '<tr>'
          + '<td><div class="val">' + esc(b.name) + '</div></td>'
          + '<td>' + b.tests + '</td>'
          + '<td>' + this.fmtDate(b.lastDate) + '</td>'
          + '<td class="' + (flagged ? 'neg' : '') + '">' + (b.avgDevPct >= 0 ? '+' : '') + b.avgDevPct.toFixed(1) + '% ' + direction + '</td>'
          + '<td>' + (flagged ? '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);">Coach</span>' : '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">On spec</span>') + '</td>'
          + '</tr>';
      }).join('');
      summaryCard = '<div class="card"><div class="card-title">Bartender Pour Accuracy (rolling)</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Average deviation from spec across every pour test logged. Bartenders averaging more than 5 percent off their spec flag for coaching. A 0.2 oz over-pour on a 1,000-drink-per-month bartender pouring 1.5 oz Tito\'s at $0.65 per ounce is $156 per month per bartender.'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Bartender</th><th>Tests</th><th>Last Test</th><th>Avg Deviation</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    let listCard;
    if (records.length === 0) {
      listCard = '<div class="card"><div class="empty">'
        + '<div class="empty-title">No pour tests logged yet</div>'
        + '<div class="empty-sub">Have each bartender pour their standard spec into a measured cylinder once a month. Log the result here. Trends per bartender expose the chronic over-pourer who is costing real money.</div>'
        + '<button class="btn btn-primary" id="pt-add-first">Log First Pour Test</button></div></div>';
    } else {
      const rows = records.map(r => {
        const flagged = Math.abs(parseFloat(r.deviation_pct) || 0) > 5;
        const dev = parseFloat(r.deviation_pct) || 0;
        return '<tr class="pt-row" data-id="' + esc(r.id) + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + esc(r.bartender_name || '-') + '</td>'
          + '<td>' + esc(r.product_name || '-') + '</td>'
          + '<td>' + (r.spec_oz != null ? r.spec_oz.toFixed(2) + ' oz' : '-') + '</td>'
          + '<td>' + (r.actual_oz != null ? r.actual_oz.toFixed(2) + ' oz' : '-') + '</td>'
          + '<td class="' + (flagged ? 'neg' : '') + '">' + (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%</td>'
          + '<td>' + esc(r.manager_name || '-') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm pt-edit" data-id="' + esc(r.id) + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm pt-del" data-id="' + esc(r.id) + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      listCard = '<div class="card"><div class="card-title">Recent Pour Tests</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Bartender</th><th>Product</th><th>Spec</th><th>Actual</th><th>Deviation</th><th>Manager</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + summaryCard + listCard + '</div>';
    this.container.onclick = ev => {
      const addF = ev.target.closest('#pt-add-first');
      const edit = ev.target.closest('.pt-edit');
      const del  = ev.target.closest('.pt-del');
      const row  = ev.target.closest('.pt-row');
      if (addF)       this.showForm();
      else if (del)   { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)   this.showForm(row.dataset.id);
    };
  },

  showForm(id) {
    this._editId = id || null;
    const r = id ? this.list().find(x => x.id === id) : null;
    const today = new Date().toISOString().slice(0, 10);
    const prods = this.barProducts().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const productOpts = '<option value="">Select product...</option>'
      + prods.map(p => '<option value="' + esc(p.id) + '"' + (r && r.product_id === p.id ? ' selected' : '') + '>' + esc(p.name) + (p.pour_size_oz ? ' (spec ' + p.pour_size_oz + ' oz)' : '') + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Pour Test</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.6;">Bartender pours their standard spec into a graduated cylinder. Read the actual ounces, log them here. Bar Cop computes deviation from spec.</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="pt-date" value="' + esc(r?.date || today) + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Bartender</label>'
      + '<select id="pt-bartender" style="height:44px;">' + App.staffOptions(r?.bartender_id, { placeholder: 'Select bartender...' }) + '</select></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Manager Observing</label>'
      + '<select id="pt-manager" style="height:44px;">' + App.staffOptions(r?.manager_id || App.activeManagerId(), { placeholder: 'Select manager...' }) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="flex:1;min-width:240px;"><label>Product</label>'
      + '<select id="pt-product" style="height:44px;">' + productOpts + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Spec (oz)</label>'
      + '<div class="fw"><input class="suf" type="number" id="pt-spec" min="0" step="0.01" inputmode="decimal" value="' + (r?.spec_oz != null ? r.spec_oz : '') + '" style="height:44px;font-size:16px;"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Actual (oz)</label>'
      + '<div class="fw"><input class="suf" type="number" id="pt-actual" min="0" step="0.01" inputmode="decimal" value="' + (r?.actual_oz != null ? r.actual_oz : '') + '" style="height:44px;font-size:16px;"/><span class="suf">oz</span></div></div>'
      + '</div>'

      + '<div id="pt-preview" style="font-size:12px;color:var(--t3);line-height:1.6;padding:10px 12px;background:var(--bg);border:1px solid var(--b2);border-radius:4px;margin-bottom:12px;">Pick a product and enter the actual measurement to see deviation.</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="pt-notes" rows="2" placeholder="Optional: technique observation, training note, follow-up plan">' + esc(r?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="pt-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="pt-cancel">Cancel</button>'
      + '<span id="pt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    // Picking the product auto-fills the spec from product.pour_size_oz so the
    // operator only types what's actually new (the actual measurement).
    document.getElementById('pt-product')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      if (!p) return;
      const specEl = document.getElementById('pt-spec');
      if (specEl && !specEl.value && p.pour_size_oz) specEl.value = p.pour_size_oz;
      this.updatePreview();
    });
    ['pt-spec', 'pt-actual'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    });
    document.getElementById('pt-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('pt-save')?.addEventListener('click', () => this.save());
    // Trigger initial preview if we're editing an existing record.
    if (r) this.updatePreview();
  },

  updatePreview() {
    const spec = parseFloat(document.getElementById('pt-spec')?.value);
    const actual = parseFloat(document.getElementById('pt-actual')?.value);
    const el = document.getElementById('pt-preview');
    if (!el) return;
    if (isNaN(spec) || isNaN(actual) || spec === 0) {
      el.innerHTML = 'Pick a product and enter the actual measurement to see deviation.';
      return;
    }
    const devOz = actual - spec;
    const devPct = (devOz / spec) * 100;
    const flagged = Math.abs(devPct) > 5;
    const direction = devOz > 0 ? 'OVER spec' : devOz < 0 ? 'UNDER spec' : 'on spec';
    const color = flagged ? 'var(--red)' : (Math.abs(devPct) > 2 ? 'var(--t2)' : 'var(--gold)');
    el.innerHTML = '<span style="color:' + color + ';font-weight:700;">'
      + (devOz >= 0 ? '+' : '') + devOz.toFixed(2) + ' oz ' + direction
      + ' &middot; ' + (devPct >= 0 ? '+' : '') + devPct.toFixed(1) + '%</span>'
      + (flagged ? '<br><span style="font-size:11px;color:var(--red);">Over 5 percent off spec is a coaching conversation.</span>' : '');
  },

  async save() {
    const err = document.getElementById('pt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('pt-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const bartenderId = document.getElementById('pt-bartender')?.value;
    if (!bartenderId) { fail('Pick the bartender.'); return; }
    const productId = document.getElementById('pt-product')?.value;
    if (!productId) { fail('Pick the product.'); return; }
    const spec = parseFloat(document.getElementById('pt-spec')?.value);
    if (isNaN(spec) || spec <= 0) { fail('Spec ounces is required.'); return; }
    const actual = parseFloat(document.getElementById('pt-actual')?.value);
    if (isNaN(actual) || actual < 0) { fail('Actual ounces is required.'); return; }

    const bartender = App.staffById(bartenderId) || {};
    const managerId = document.getElementById('pt-manager')?.value || '';
    const manager = App.staffById(managerId) || {};
    const product = this.productById(productId) || {};
    const devOz = actual - spec;
    const devPct = (devOz / spec) * 100;

    const rec = {
      id: this._editId || App.uid(),
      date,
      bartender_id: bartenderId,
      bartender_name: bartender.name || '',
      product_id: productId,
      product_name: product.name || '',
      spec_oz: spec,
      actual_oz: actual,
      deviation_oz: devOz,
      deviation_pct: devPct,
      manager_id: managerId,
      manager_name: manager.name || '',
      notes: document.getElementById('pt-notes')?.value.trim() || ''
    };
    if (!this._editId) rec.created_at = new Date().toISOString();

    const list = this.list();
    if (this._editId) {
      const i = list.findIndex(x => x.id === this._editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    const btn = document.getElementById('pt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('pour_tests');
    this._editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    App.confirmDelete().then(ok => {
      if (!ok) return;
      App.data.pour_tests = this.list().filter(x => x.id !== id);
      App.saveKey('pour_tests').then(() => this.renderList());
    });
  }
};
