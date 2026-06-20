'use strict';

/* ── Shift Control — Checklists (writes sc_checklists) ────────────────────────
   One screen for both the Opening and Closing checklist. Toggle the type up
   top (defaults to the one that fits the time of day), the items load from
   your saved template (or the built-in default), check them off, Save. A
   printable Worksheet prints the same list blank for the clipboard. Completed
   runs save to sc_checklists for Operations Reports and the audit trail.

   The default item lists still live on the old per-type modules
   (S.ShiftOpeningChecklist / S.ShiftClosingChecklist), which stay loaded as the
   source of those arrays (and for the seed). This screen reuses them. */

S.ShiftChecklists = {
  TYPES: ['Opening', 'Closing'],
  TYPE: 'Opening',
  _typePicked: false,
  _run: null,
  filterPreset: 'last-4',  // active range chip
  _prevPreset: 'last-4',
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  defaultItems(type) {
    return type === 'Closing'
      ? ((S.ShiftClosingChecklist && S.ShiftClosingChecklist.DEFAULT_ITEMS) || [])
      : ((S.ShiftOpeningChecklist && S.ShiftOpeningChecklist.DEFAULT_ITEMS) || []);
  },
  runs() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_checklists)) App.shiftData.sc_checklists = [];
    return App.shiftData.sc_checklists;
  },
  typeRuns() { return this.runs().filter(r => r.type === this.TYPE); },
  templates() {
    return ((App.shiftData && App.shiftData.sc_checklist_templates) || []).filter(x => x.type === this.TYPE);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  // Manager on the open shift, to pre-fill Completed By.
  activeManagerId() {
    const open = ((App.shiftData && App.shiftData.sc_shifts) || [])
      .filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0];
    return open ? (open.manager_id || '') : '';
  },

  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(r => {
      const date = r.date || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  },

  // Range chips left, Export + Worksheet right, directly above the list.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'cl-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="cl-export">Export PDF</button><button class="btn btn-ghost btn-sm" id="cl-worksheet">Worksheet</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="cl-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="cl-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // Pull the in-progress runner fields into _run before any re-render.
  _syncRun() {
    const d = document.getElementById('cl-date'); if (d) this._run.date = d.value || this._run.date;
    const by = document.getElementById('cl-by');
    if (by) { this._run.completed_by_id = by.value || ''; this._run.completed_by = (App.staffById(this._run.completed_by_id) || {}).name || ''; }
    const n = document.getElementById('cl-notes'); if (n) this._run.notes = n.value || '';
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    // Default the toggle to the checklist that fits the time of day, once.
    if (!this._typePicked) { this.TYPE = new Date().getHours() < 15 ? 'Opening' : 'Closing'; this._typePicked = true; }
    // Keep an in-progress checklist across navigation; only Start Over or Save resets it.
    if (!this._run) this.startRun();
    this.renderMain();
  },

  itemsFor(templateId) {
    const tpl = this.templates().find(t => t.id === templateId);
    const src = tpl ? (tpl.items || []) : this.defaultItems(this.TYPE);
    return src.map(text => ({ text, done: false }));
  },

  startRun(templateId) {
    const tpls = this.templates();
    const tid = templateId != null ? templateId : (tpls[0] ? tpls[0].id : '');
    const mgrId = this.activeManagerId();
    this._run = {
      templateId: tid,
      date: App.todayLocal(),
      completed_by_id: mgrId,
      completed_by: (App.staffById(mgrId) || {}).name || '',
      notes: '',
      items: this.itemsFor(tid)
    };
  },

  showHowTo() {
    App.showHelpModal('How Checklists Work', [
      { p: ['One screen for your opening and closing routines. Flip between Opening and Closing up top (it starts on the one that fits the time of day), check the items off as you go, and Save when you are done. The Save is your record that the checklist got run. Your progress is kept if you step away and come back; Start Over clears it and begins fresh.'] },
      { h: 'Run it on paper', p: ['Tap Worksheet to print the list blank for a clipboard at the bar. Mark it off by hand during the shift, then enter it here after, or just keep the paper.'] },
      { h: 'Templates', p: ['The items come from your saved Opening and Closing templates (set them up on Checklist Templates). Until you build one, Bar Cop uses a sensible built-in default list.'] },
      { h: 'Past runs', p: ['Every saved checklist drops into the list below, filtered to the type you are on. Narrow the range with the chips (This Week, Last Week, This Month, Last 4 Weeks, All, or Custom for your own dates). Tap a row or View to open one run and see exactly which items got checked and who signed off; Export PDF on that detail prints it for the binder. Delete pulls a run off the record if it was logged by mistake.'] }
    ]);
  },

  renderMain() {
    const tpls = this.templates();
    const showPicker = tpls.length > 1;
    const items = this._run.items;
    const done = items.filter(i => i.done).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;

    const toggle = '<div style="display:flex;gap:8px;margin-bottom:18px;">'
      + this.TYPES.map(t =>
        '<button type="button" class="cl-toggle" data-type="' + t + '" style="padding:9px 16px;border-radius:22px;font-size:13px;font-weight:700;cursor:pointer;'
        + (this.TYPE === t ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--gold);' : 'background:var(--input);border:1px solid var(--b1);color:var(--t2);')
        + '">' + t + '</button>').join('')
      + '</div>';

    const tplField = showPicker
      ? '<div class="f" style="width:230px;flex-shrink:0;"><label>Template</label><select id="cl-tpl">'
        + tpls.map(t => '<option value="' + t.id + '"' + (this._run.templateId === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('')
        + '</select></div>'
      : '';

    const itemRows = items.map((it, idx) =>
      '<div class="cl-item" data-idx="' + idx + '" style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<input type="checkbox" class="cl-chk"' + (it.done ? ' checked' : '') + ' tabindex="-1" style="flex-shrink:0;accent-color:var(--gold);width:16px;height:16px;cursor:pointer;pointer-events:none;"/>'
      + '<span style="font-size:14px;color:' + (it.done ? 'var(--t3)' : 'var(--t1)') + ';' + (it.done ? 'text-decoration:line-through;' : '') + '">' + esc(it.text) + '</span>'
      + '</div>').join('');

    const runner = '<div class="card form-card">'
      + App.collapsibleCardTitle('sc-checklists', 'Checklists')
      + '<div class="collapse-body">'
      + toggle
      + '<div class="form-row" style="gap:16px;">'
      + tplField
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label><input type="date" id="cl-date" value="' + esc(this._run.date) + '"/></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Completed By</label><select id="cl-by">' + App.staffOptions(this._run.completed_by_id || this._run.completed_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div style="margin:8px 0 14px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-bottom:6px;"><span>' + done + ' of ' + items.length + ' complete</span><span>' + pct + '%</span></div>'
      + '<div style="height:6px;background:var(--input);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold);transition:width 0.2s;"></div></div></div>'
      + '<div id="cl-items">' + itemRows + '</div>'
      + '<div class="form-row" style="gap:16px;margin-top:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="cl-notes" rows="2" placeholder="Optional">' + esc(this._run.notes) + '</textarea></div></div>'
      + '</div>'
      + '</div>'
      + '<div data-collapse-group="sc-checklists" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="cl-save">Save Completed Checklist</button>'
      + '<button class="btn btn-ghost" id="cl-startover">Start Over</button>'
      + '<span id="cl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    const allRuns = [...this.typeRuns()].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    let histSection = '';
    if (allRuns.length) {
      const filtered = this.applyFilters(allRuns);
      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No runs in this range. Pick a wider range above.</div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'checklist')).map(r => {
          const full = (r.done_count || 0) >= (r.total_count || 0) && (r.total_count || 0) > 0;
          const status = full
            ? '<span style="color:var(--t2);font-weight:700;">Complete</span>'
            : '<span style="color:var(--amber);font-weight:700;">' + (r.done_count || 0) + ' of ' + (r.total_count || 0) + '</span>';
          return '<tr class="cl-hrow" data-id="' + r.id + '" style="cursor:pointer;">'
            + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
            + '<td>' + esc(r.template_name || (this.TYPE + ' Checklist')) + '</td>'
            + '<td>' + esc(r.completed_by || '-') + '</td>'
            + '<td>' + status + '</td>'
            + '<td><div class="row-actions">'
            + '<button class="btn btn-ghost btn-sm cl-hview" data-id="' + r.id + '">View</button>'
            + '<button class="btn btn-danger btn-sm cl-hdel" data-id="' + r.id + '">Delete</button>'
            + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Template</th><th>Completed By</th><th>Status</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
          + App.showOlderBar('sc', 'checklist', filtered, this.filterPreset !== 'all');
      }
      histSection = this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + runner + histSection + '</div>';
    App.applyCollapsed(this.container);
    this._bindRunner();
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      const tog = ev.target.closest('.cl-toggle');
      if (tog) { this.TYPE = tog.dataset.type; this.startRun(); this.renderMain(); return; }
      const chip = ev.target.closest('.cl-range-chip');
      if (chip) {
        this._syncRun();
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderMain();
        return;
      }
      if (ev.target.closest('#cl-export')) { App.exportPDF({ title: this.TYPE + ' Checklists', root: this.container }); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderMain()); return; }
      const hrow = ev.target.closest('.cl-hrow');
      const hview = ev.target.closest('.cl-hview');
      const hdel = ev.target.closest('.cl-hdel');
      if (hdel) { ev.stopPropagation(); this.confirmDel(hdel.dataset.id); }
      else if (hview) { ev.stopPropagation(); const id = hview.dataset.id; App.pushView(() => this.renderDetail(id)); }
      else if (hrow) { const id = hrow.dataset.id; App.pushView(() => this.renderDetail(id)); }
    };
    document.getElementById('cl-f-from')?.addEventListener('change', e => { this._syncRun(); this.filterFrom = e.target.value || ''; this.renderMain(); });
    document.getElementById('cl-f-to')?.addEventListener('change',   e => { this._syncRun(); this.filterTo   = e.target.value || ''; this.renderMain(); });
  },

  _bindRunner() {
    document.getElementById('cl-items')?.addEventListener('click', ev => {
      const row = ev.target.closest('.cl-item');
      if (!row) return;
      this._syncRun();
      const idx = parseInt(row.dataset.idx, 10);
      this._run.items[idx].done = !this._run.items[idx].done;
      this.renderMain();
    });
    document.getElementById('cl-tpl')?.addEventListener('change', e => { this._syncRun(); this.startRun(e.target.value); this.renderMain(); });
    // Keep date / completed-by / notes in _run so stepping away mid-entry keeps them.
    ['cl-date', 'cl-by', 'cl-notes'].forEach(id => document.getElementById(id)?.addEventListener('change', () => this._syncRun()));
    document.getElementById('cl-startover')?.addEventListener('click', () => { this.startRun(this._run.templateId); this.renderMain(); });
    document.getElementById('cl-worksheet')?.addEventListener('click', () => { this._syncRun(); this.worksheet(); });
    document.getElementById('cl-save')?.addEventListener('click', () => { this._syncRun(); this.save(); });
  },

  async save() {
    const err = document.getElementById('cl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!this._run.completed_by_id) { fail('Pick who completed the checklist.'); return; }
    const tpl = this.templates().find(t => t.id === this._run.templateId);
    const items = this._run.items;
    const rec = {
      id:            App.uid(),
      type:          this.TYPE,
      template_id:   this._run.templateId || '',
      template_name: tpl ? tpl.name : ('Default ' + this.TYPE + ' Checklist'),
      date:          this._run.date,
      completed_by_id: this._run.completed_by_id || '',
      completed_by:    this._run.completed_by || '',
      items:         items.map(i => ({ text: i.text, done: !!i.done })),
      done_count:    items.filter(i => i.done).length,
      total_count:   items.length,
      notes:         this._run.notes.trim(),
      completed_at:  new Date().toISOString(),
      created_at:    new Date().toISOString()
    };
    const btn = document.getElementById('cl-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    this.runs().push(rec);
    const ok = await App.putRecord('sc', 'checklist', rec);
    if (ok) { this.startRun(this._run.templateId); this.renderMain(); }
    else {
      this.runs().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Completed Checklist'; }
      fail('Save failed. Try again.');
    }
  },

  renderDetail(id) {
    const r = this.runs().find(x => x.id === id);
    if (!r) { this.renderMain(); return; }
    const itemRows = (r.items || []).map(it =>
      '<div style="display:flex;align-items:center;gap:12px;padding:9px 4px;border-bottom:1px solid var(--b2);">'
      + '<span style="font-size:13px;font-weight:800;color:' + (it.done ? 'var(--gold)' : 'var(--t4)') + ';width:48px;">' + (it.done ? 'DONE' : '-') + '</span>'
      + '<span style="font-size:14px;color:var(--t1);">' + esc(it.text) + '</span></div>').join('');
    // Stats in their own card at top; the run title is a heading outside/above the
    // checklist card, with Export PDF aligned right on the same row.
    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Completed By</div><div class="calc-val lg">' + esc(r.completed_by || '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Items Done</div><div class="calc-val lg">' + (r.done_count || 0) + ' of ' + (r.total_count || 0) + '</div></div>'
      + '</div></div>';
    const headingRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">' + esc(r.template_name || (r.type || '') + ' Checklist') + ' &middot; ' + this.fmtDate(r.date) + '</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="cl-print">Export PDF</button></div></div>';
    const checklistCard = '<div class="card">' + itemRows
      + (r.notes ? '<div style="font-size:12px;color:var(--t3);margin-top:12px;">Notes: ' + esc(r.notes) + '</div>' : '')
      + '</div>';
    this.container.innerHTML = '<div class="screen">' + statsCard + headingRow + checklistCard + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#cl-print')) this.exportPDF(r);
    };
  },

  async exportPDF(r) {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const type = r.type || this.TYPE;
    const b = App._pdfBuilder(type + ' Checklist');
    b.header({ right: type + ' Checklist', meta: this.fmtDate(r.date) });
    b.kv('Template', r.template_name || (type + ' Checklist'));
    b.kv('Completed By', r.completed_by || '-');
    b.kv('Items Done', (r.done_count || 0) + ' of ' + (r.total_count || 0));
    b.spacer(6);
    b.sectionTitle('Checklist Items');
    b.table(['Status', 'Item'], (r.items || []).map(it => [it.done ? 'DONE' : '-', it.text]), { columnStyles: { 0: { cellWidth: 60 } } });
    if (r.notes) { b.sectionTitle('Notes'); b.paragraph(r.notes); }
    const ds = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date.replace(/-/g, '') : App._pdfDateStamp();
    await b.save('BarCop_' + type + 'Checklist_' + ds + '.pdf');
  },

  // Blank printable checklist for the clipboard: the current list with empty
  // check boxes and lines to fill in by hand.
  async worksheet() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const type = this.TYPE;
    const items = this.itemsFor(this._run.templateId).map(i => i.text);
    const b = App._pdfBuilder(type + ' Checklist Worksheet');
    b.header({ right: type + ' Checklist', meta: 'Worksheet' });
    b.kv('Date', '________________');
    b.kv('Completed By', '________________');
    b.spacer(6);
    b.sectionTitle('Check off each item as you complete it');
    b.table(['Done', 'Item'], items.map(t => ['[   ]', t]), { columnStyles: { 0: { cellWidth: 55 } } });
    b.spacer(8);
    b.sectionTitle('Notes');
    b.paragraph(' ');
    await b.save('BarCop_' + type + 'ChecklistWorksheet.pdf');
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('sc', 'checklist', id);
    this.renderMain();
  }
};
