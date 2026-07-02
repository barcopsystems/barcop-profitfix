'use strict';

/* ── Shift Control — Closing Checklist (writes sc_checklists) ──────────────────
   Runs the closing checklist for a shift. Uses Closing templates from the
   Templates screen, or a built-in default when none exist. Completed runs are
   saved to sc_checklists for the Operations Reports and audit trail. */

S.ShiftClosingChecklist = {
  TYPE: 'Closing',
  DEFAULT_ITEMS: [
    'Last call announced at posted time',
    'All checks closed and settled in the POS',
    'Cash drops completed and drawers counted',
    'Variances logged for any over / short',
    'Bar restocked for the next shift',
    'Liquor secured and storeroom locked',
    'Check beer / draft walk-in cooler temp',
    'Check food walk-in cooler temp',
    'Bar tops, wells, and equipment cleaned and sanitized',
    'Trash emptied and floors cleaned',
    '86 list updated for the next shift',
    'Lights, music, TVs, and signage off',
    'Doors locked and alarm set'
  ],
  _run: null,
  _pendingDelId: null,

  runs() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_checklists)) App.shiftData.sc_checklists = [];
    return App.shiftData.sc_checklists;
  },
  typeRuns() {
    return this.runs().filter(r => r.type === this.TYPE);
  },
  templates() {
    const t = (App.shiftData && App.shiftData.sc_checklist_templates) || [];
    return t.filter(x => x.type === this.TYPE);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.startRun();
    this.renderMain();
  },

  itemsFor(templateId) {
    const tpl = this.templates().find(t => t.id === templateId);
    const src = tpl ? (tpl.items || []) : this.DEFAULT_ITEMS;
    return src.map(text => ({ text, done: false }));
  },

  startRun(templateId) {
    const tpls = this.templates();
    const tid = templateId != null ? templateId : (tpls[0] ? tpls[0].id : '');
    this._run = {
      templateId: tid,
      date: App.todayLocal(),
      completed_by: '',
      notes: '',
      items: this.itemsFor(tid)
    };
  },

  renderMain() {
    this.detailId = null;
    const tpls = this.templates();
    const tplOpts = (tpls.length
        ? tpls.map(t => '<option value="' + t.id + '"' + (this._run.templateId === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('')
        : '<option value="">Default Closing Checklist</option>');

    const items = this._run.items;
    const done = items.filter(i => i.done).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;

    const itemRows = items.map((it, idx) =>
      '<div class="cl-item" data-idx="' + idx + '" style="display:flex;align-items:center;gap:12px;padding:11px 4px;'
      + 'border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="width:22px;height:22px;flex-shrink:0;border:1px solid ' + (it.done ? 'var(--gold)' : 'var(--b1)') + ';'
      + 'border-radius:4px;background:' + (it.done ? 'var(--gold)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;">'
      + (it.done ? '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5l2.5 2.5 5-5.5" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '')
      + '</span>'
      + '<span style="font-size:14px;color:' + (it.done ? 'var(--t3)' : 'var(--t1)') + ';'
      + (it.done ? 'text-decoration:line-through;' : '') + '">' + esc(it.text) + '</span>'
      + '</div>').join('');

    const runner = '<div class="card"><div class="card-title">Closing Checklist</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:230px;flex-shrink:0;"><label>Template</label>'
      + '<select id="cl-tpl">' + tplOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="cl-date" value="' + esc(this._run.date) + '"/></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Completed By</label>'
      + '<select id="cl-by">' + App.staffOptions(this._run.completed_by_id || this._run.completed_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div style="margin:8px 0 14px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-bottom:6px;">'
      + '<span>' + done + ' of ' + items.length + ' complete</span><span>' + pct + '%</span></div>'
      + '<div style="height:6px;background:var(--input);border-radius:3px;overflow:hidden;">'
      + '<div style="height:100%;width:' + pct + '%;background:var(--gold);transition:width 0.2s;"></div></div></div>'
      + '<div id="cl-items">' + itemRows + '</div>'
      + '<div class="form-row" style="gap:16px;margin-top:14px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="cl-notes" rows="2" placeholder="Optional">' + esc(this._run.notes) + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="cl-save">Save Completed Checklist</button>'
      + '<button class="btn btn-ghost" id="cl-reset">Reset</button>'
      + '<span id="cl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    const hist = [...this.typeRuns()].sort(App.cmpNewest);
    let histCard;
    if (hist.length === 0) {
      histCard = '';
    } else {
      const rows = hist.slice(0, App.listLimit('sc', 'checklist')).map(r => {
        const full = (r.done_count || 0) >= (r.total_count || 0) && (r.total_count || 0) > 0;
        const badge = full
          ? '<span class="badge badge-ok">Complete</span>'
          : '<span class="badge badge-dim">' + (r.done_count || 0) + ' of ' + (r.total_count || 0) + '</span>';
        return '<tr class="cl-hrow" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + esc(r.template_name || 'Closing Checklist') + '</td>'
          + '<td>' + esc(r.completed_by || '-') + '</td>'
          + '<td>' + badge + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm cl-hview" data-id="' + r.id + '">View</button>'
          + '<button class="btn btn-danger btn-sm cl-hdel" data-id="' + r.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      histCard = '<div class="card"><div class="card-title">Completed Closing Checklists</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Template</th><th>Completed By</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'checklist', hist, true) + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + runner + histCard + '</div>';
    this._bindRunner();
    // Property assignment, not addEventListener — renderMain() runs on every
    // checkbox toggle and reset, so addEventListener would stack handlers and
    // history clicks would fire N+1 times after N re-renders.
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderMain()); return; }
      const hrow = ev.target.closest('.cl-hrow');
      const hview = ev.target.closest('.cl-hview');
      const hdel = ev.target.closest('.cl-hdel');
      if (hdel) { ev.stopPropagation(); this.confirmDel(hdel.dataset.id); }
      else if (hview) { ev.stopPropagation(); this.renderDetail(hview.dataset.id); }
      else if (hrow) this.renderDetail(hrow.dataset.id);
    };
  },

  _bindRunner() {
    const sync = () => {
      this._run.date = document.getElementById('cl-date')?.value || this._run.date;
      this._run.completed_by_id = document.getElementById('cl-by')?.value || '';
      this._run.completed_by    = (App.staffById(this._run.completed_by_id) || {}).name || '';
      this._run.notes = document.getElementById('cl-notes')?.value || '';
    };
    document.getElementById('cl-items')?.addEventListener('click', ev => {
      const row = ev.target.closest('.cl-item');
      if (!row) return;
      sync();
      const idx = parseInt(row.dataset.idx, 10);
      this._run.items[idx].done = !this._run.items[idx].done;
      this.renderMain();
    });
    document.getElementById('cl-tpl')?.addEventListener('change', e => {
      sync();
      this.startRun(e.target.value);
      this.renderMain();
    });
    document.getElementById('cl-reset')?.addEventListener('click', () => {
      this.startRun(this._run.templateId);
      this.renderMain();
    });
    document.getElementById('cl-save')?.addEventListener('click', () => { sync(); this.save(); });
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
      template_name: tpl ? tpl.name : 'Default Closing Checklist',
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
    if (ok) {
      this.startRun(this._run.templateId);
      this.renderMain();
    } else {
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
      + '<span style="font-size:13px;font-weight:800;color:' + (it.done ? 'var(--gold)' : 'var(--t4)') + ';width:48px;">'
      + (it.done ? 'DONE' : '-') + '</span>'
      + '<span style="font-size:14px;color:var(--t1);">' + esc(it.text) + '</span></div>').join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="cl-back">&laquo; Back to Closing Checklist</button></div>'
      + '<div class="card"><div class="card-title">' + esc(r.template_name || 'Closing Checklist') + ' &middot; ' + this.fmtDate(r.date) + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Completed By</div><div class="calc-val">' + esc(r.completed_by || '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Items Done</div><div class="calc-val">' + (r.done_count || 0) + ' of ' + (r.total_count || 0) + '</div></div>'
      + '</div>'
      + itemRows
      + (r.notes ? '<div style="font-size:12px;color:var(--t3);margin-top:12px;">Notes: ' + esc(r.notes) + '</div>' : '')
      + '<div class="card-actions">'
        + '<button class="btn btn-ghost btn-sm" id="cl-print">Export PDF</button>'
      + '</div></div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#cl-back')) this.renderMain();
      else if (ev.target.closest('#cl-print')) this.exportPDF(r);
    };
  },

  async exportPDF(r) {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const b = App._pdfBuilder('Closing Checklist');
    b.header({ right: 'Closing Checklist', meta: this.fmtDate(r.date) });
    b.kv('Template', r.template_name || 'Closing Checklist');
    b.kv('Completed By', r.completed_by || '-');
    b.kv('Items Done', (r.done_count || 0) + ' of ' + (r.total_count || 0));
    b.spacer(6);
    b.sectionTitle('Checklist Items');
    b.table(['Status', 'Item'], (r.items || []).map(it => [it.done ? 'DONE' : '-', it.text]), { columnStyles: { 0: { cellWidth: 60 } } });
    if (r.notes) { b.sectionTitle('Notes'); b.paragraph(r.notes); }
    const ds = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date.replace(/-/g, '') : App._pdfDateStamp();
    await b.save('BarCop_ClosingChecklist_' + ds + '.pdf');
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('sc', 'checklist', id);
    this.renderMain();
  }
};
