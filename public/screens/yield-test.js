'use strict';

/* ── Profit Recovery — Plate Yield Test (per-cook portioning accuracy) ────────
   Kitchen-side equivalent of Pour Test. Manager weighs three plates of a dish
   during service, records actual vs spec yield, captures the cook on the line.
   Different signal from menu cost analysis (which measures the recipe).
   Yield Test measures the COOK's portioning over time. The chronic over-
   portioner is a real food cost leak that no other screen catches.

   Spec yield comes from menu item recipe.plate_yield if the menu item has a
   recipe attached, otherwise the operator types it. Trends per cook over time.
   Cooks with >5% average over-portion flag for coaching. Stored at
   App.data.yield_tests[]. */

S.YieldTest = {
  _editId: null,

  list() {
    if (!Array.isArray(App.data.yield_tests)) App.data.yield_tests = [];
    return App.data.yield_tests;
  },

  // Food-category menu items — these are the dishes that get plated.
  foodMenuItems() {
    const items = App.menuItems ? App.menuItems() : [];
    // Loose filter: anything where category looks food-ish OR a recipe with mode=food.
    return items.filter(i => {
      const cat = String(i.category || '').toLowerCase();
      const mode = i.recipe?.mode;
      return mode === 'food' || cat.includes('food') || cat.includes('entree') ||
             cat.includes('appetizer') || cat.includes('app') || cat.includes('side') ||
             cat.includes('plate') || cat.includes('kitchen');
    });
  },
  itemById(id) {
    return (App.menuItems ? App.menuItems() : []).find(i => i.id === id);
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
    addBtn.textContent = 'Log Yield Test';
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
      title: 'Plate Yield Test Sheet',
      subtitle: 'Weigh three plates of a dish during service. Compare against spec. Manager enters results into Bar Cop after.',
      columns: [
        { label: 'Date',          width: '10%' },
        { label: 'Dish',          width: '20%' },
        { label: 'Cook',          width: '15%' },
        { label: 'Spec',          width: '10%' },
        { label: 'Actual',        width: '10%' },
        { label: 'Unit',          width: '8%'  },
        { label: 'Deviation',     width: '12%' },
        { label: 'Notes',         width: '15%' }
      ],
      rows: 12
    });
  },

  renderList() {
    const records = this.list().slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Per-cook summary
    const byCook = {};
    records.forEach(r => {
      const key = r.cook_id || r.cook_name || 'Unknown';
      if (!byCook[key]) byCook[key] = {
        name: r.cook_name || 'Unknown',
        tests: 0,
        totalDevPct: 0,
        lastDate: ''
      };
      byCook[key].tests++;
      byCook[key].totalDevPct += (parseFloat(r.deviation_pct) || 0);
      if (!byCook[key].lastDate || r.date > byCook[key].lastDate) {
        byCook[key].lastDate = r.date;
      }
    });
    const summaryRows = Object.values(byCook)
      .map(c => ({ ...c, avgDevPct: c.tests ? c.totalDevPct / c.tests : 0 }))
      .sort((a, b) => Math.abs(b.avgDevPct) - Math.abs(a.avgDevPct));

    let summaryCard = '';
    if (summaryRows.length) {
      const rows = summaryRows.map(c => {
        const flagged = Math.abs(c.avgDevPct) > 5;
        const direction = c.avgDevPct > 0 ? 'over' : c.avgDevPct < 0 ? 'under' : 'on';
        return '<tr>'
          + '<td><div class="val">' + esc(c.name) + '</div></td>'
          + '<td>' + c.tests + '</td>'
          + '<td>' + this.fmtDate(c.lastDate) + '</td>'
          + '<td class="' + (flagged ? 'neg' : '') + '">' + (c.avgDevPct >= 0 ? '+' : '') + c.avgDevPct.toFixed(1) + '% ' + direction + '</td>'
          + '<td>' + (flagged ? '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);">Coach</span>' : '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">On spec</span>') + '</td>'
          + '</tr>';
      }).join('');
      summaryCard = '<div class="card"><div class="card-title">Cook Yield Accuracy (rolling)</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Average deviation from spec yield across every plate test logged. Cooks averaging more than 5 percent off spec flag for coaching. A line cook over-portioning fries by 20 percent on a 200-cover night runs through 40 extra pounds a week, real food cost on the floor.'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Cook</th><th>Tests</th><th>Last Test</th><th>Avg Deviation</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    let listCard;
    if (records.length === 0) {
      listCard = '<div class="card"><div class="empty">'
        + '<div class="empty-title">No yield tests logged yet</div>'
        + '<div class="empty-sub">Weigh three plates of a dish during service every couple weeks. Different cooks, different dishes. Trends per cook expose the chronic over-portioner.</div>'
        + '<button class="btn btn-primary" id="yt-add-first">Log First Yield Test</button></div></div>';
    } else {
      const rows = records.map(r => {
        const flagged = Math.abs(parseFloat(r.deviation_pct) || 0) > 5;
        const dev = parseFloat(r.deviation_pct) || 0;
        const unit = r.unit || 'oz';
        return '<tr class="yt-row" data-id="' + esc(r.id) + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + esc(r.dish_name || '-') + '</td>'
          + '<td>' + esc(r.cook_name || '-') + '</td>'
          + '<td>' + (r.spec_yield != null ? r.spec_yield.toFixed(2) + ' ' + esc(unit) : '-') + '</td>'
          + '<td>' + (r.actual_yield != null ? r.actual_yield.toFixed(2) + ' ' + esc(unit) : '-') + '</td>'
          + '<td class="' + (flagged ? 'neg' : '') + '">' + (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%</td>'
          + '<td>' + esc(r.manager_name || '-') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm yt-edit" data-id="' + esc(r.id) + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm yt-del" data-id="' + esc(r.id) + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      listCard = '<div class="card"><div class="card-title">Recent Yield Tests</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Dish</th><th>Cook</th><th>Spec</th><th>Actual</th><th>Deviation</th><th>Manager</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + summaryCard + listCard + '</div>';
    this.container.onclick = ev => {
      const addF = ev.target.closest('#yt-add-first');
      const edit = ev.target.closest('.yt-edit');
      const del  = ev.target.closest('.yt-del');
      const row  = ev.target.closest('.yt-row');
      if (addF)       this.showForm();
      else if (del)   { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)   this.showForm(row.dataset.id);
    };
  },

  showForm(id) {
    this._editId = id || null;
    const r = id ? this.list().find(x => x.id === id) : null;
    const today = App.todayLocal();
    const items = this.foodMenuItems().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const itemOpts = '<option value="">Select dish...</option>'
      + items.map(i => '<option value="' + esc(i.id) + '"' + (r && r.dish_id === i.id ? ' selected' : '') + '>' + esc(i.name) + '</option>').join('');
    const unit = r?.unit || 'oz';
    const unitOpts = ['oz', 'g', 'lb', 'pc', 'cup'].map(u =>
      '<option' + (u === unit ? ' selected' : '') + '>' + u + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Yield Test</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.6;">Weigh the plate on the line. Compare against spec yield. Picking a dish with a recipe auto-fills the spec from the recipe plate yield.</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="yt-date" value="' + esc(r?.date || today) + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Cook</label>'
      + '<select id="yt-cook" style="height:44px;">' + App.staffOptions(r?.cook_id, { placeholder: 'Select cook...', audience: 'kitchen' }) + '</select></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Manager Observing</label>'
      + '<select id="yt-manager" style="height:44px;">' + App.staffOptions(r?.manager_id || App.activeManagerId(), { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="flex:1;min-width:240px;"><label>Dish</label>'
      + '<select id="yt-dish" style="height:44px;">' + itemOpts + '</select></div>'
      + '<div class="f" style="width:100px;flex-shrink:0;"><label>Unit</label>'
      + '<select id="yt-unit" style="height:44px;">' + unitOpts + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Spec Yield</label>'
      + '<input type="number" id="yt-spec" min="0" step="0.01" inputmode="decimal" value="' + (r?.spec_yield != null ? r.spec_yield : '') + '" style="height:44px;font-size:16px;"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Actual Yield</label>'
      + '<input type="number" id="yt-actual" min="0" step="0.01" inputmode="decimal" value="' + (r?.actual_yield != null ? r.actual_yield : '') + '" style="height:44px;font-size:16px;"/></div>'
      + '</div>'

      + '<div id="yt-preview" style="font-size:12px;color:var(--t3);line-height:1.6;padding:10px 12px;background:var(--bg);border:1px solid var(--b2);border-radius:4px;margin-bottom:12px;">Pick a dish and enter the actual yield to see deviation.</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="yt-notes" rows="2" placeholder="Optional: portion technique, plating issue, follow-up plan">' + esc(r?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="yt-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="yt-cancel">Cancel</button>'
      + '<span id="yt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    // Picking the dish auto-fills the spec from recipe.plate_yield if a recipe
    // is attached. Operator can override.
    document.getElementById('yt-dish')?.addEventListener('change', e => {
      const item = this.itemById(e.target.value);
      if (!item) return;
      const specEl = document.getElementById('yt-spec');
      const py = item.recipe?.plate_yield;
      if (specEl && !specEl.value && py) specEl.value = py;
      this.updatePreview();
    });
    ['yt-spec', 'yt-actual'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    });
    document.getElementById('yt-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('yt-save')?.addEventListener('click', () => this.save());
    if (r) this.updatePreview();
  },

  updatePreview() {
    const spec = parseFloat(document.getElementById('yt-spec')?.value);
    const actual = parseFloat(document.getElementById('yt-actual')?.value);
    const unit = document.getElementById('yt-unit')?.value || 'oz';
    const el = document.getElementById('yt-preview');
    if (!el) return;
    if (isNaN(spec) || isNaN(actual) || spec === 0) {
      el.innerHTML = 'Pick a dish and enter the actual yield to see deviation.';
      return;
    }
    const dev = actual - spec;
    const devPct = (dev / spec) * 100;
    const flagged = Math.abs(devPct) > 5;
    const direction = dev > 0 ? 'OVER spec' : dev < 0 ? 'UNDER spec' : 'on spec';
    const color = flagged ? 'var(--red)' : (Math.abs(devPct) > 2 ? 'var(--t2)' : 'var(--gold)');
    el.innerHTML = '<span style="color:' + color + ';font-weight:700;">'
      + (dev >= 0 ? '+' : '') + dev.toFixed(2) + ' ' + esc(unit) + ' ' + direction
      + ' &middot; ' + (devPct >= 0 ? '+' : '') + devPct.toFixed(1) + '%</span>'
      + (flagged ? '<br><span style="font-size:11px;color:var(--red);">Over 5 percent off spec is a coaching conversation.</span>' : '');
  },

  async save() {
    const err = document.getElementById('yt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('yt-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const cookId = document.getElementById('yt-cook')?.value;
    if (!cookId) { fail('Pick the cook.'); return; }
    const dishId = document.getElementById('yt-dish')?.value;
    if (!dishId) { fail('Pick the dish.'); return; }
    const spec = parseFloat(document.getElementById('yt-spec')?.value);
    if (isNaN(spec) || spec <= 0) { fail('Spec yield is required.'); return; }
    const actual = parseFloat(document.getElementById('yt-actual')?.value);
    if (isNaN(actual) || actual < 0) { fail('Actual yield is required.'); return; }

    const cook = App.staffById(cookId) || {};
    const managerId = document.getElementById('yt-manager')?.value || '';
    const manager = App.staffById(managerId) || {};
    const item = this.itemById(dishId) || {};
    const dev = actual - spec;
    const devPct = (dev / spec) * 100;

    const rec = {
      id: this._editId || App.uid(),
      date,
      cook_id: cookId,
      cook_name: cook.name || '',
      dish_id: dishId,
      dish_name: item.name || '',
      unit: document.getElementById('yt-unit')?.value || 'oz',
      spec_yield: spec,
      actual_yield: actual,
      deviation_oz: dev,
      deviation_pct: devPct,
      manager_id: managerId,
      manager_name: manager.name || '',
      notes: document.getElementById('yt-notes')?.value.trim() || ''
    };
    if (!this._editId) rec.created_at = new Date().toISOString();

    const list = this.list();
    if (this._editId) {
      const i = list.findIndex(x => x.id === this._editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    const btn = document.getElementById('yt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('yield_tests');
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
      App.data.yield_tests = this.list().filter(x => x.id !== id);
      App.saveKey('yield_tests').then(() => this.renderList());
    });
  }
};
