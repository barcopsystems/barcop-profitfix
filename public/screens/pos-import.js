'use strict';

/* ── Import POS Data — the unified Control import hub ─────────────────────────
   One destination for the recurring weekly POS / timeclock exports. Drop as many
   files as you have; Bar Cop reads each, sorts it (Hours / Tips / Voids & Comps),
   shows where it lands and how many rows are new, then commits everything in one
   go. All parsing reuses CSVMapper; all match/dedup/save reuses PosIngest, so the
   per-page import lanes (Log Hours, Tip Log, Void/Comp) stay in lockstep.

   Reachable from each Control sidebar and a Hub tile (screen id 'pos-import'). */

S.PosImport = {
  _files: [],     // [{ id, name, headers, rows, type, map, error }]
  _seq: 0,
  container: null,

  _TYPE_OPTS: [
    ['',           'Pick what this is...'],
    ['hours',      'Hours'],
    ['tips',       'Tips'],
    ['voids',      'Voids & Comps'],
    ['hours_tips', 'Hours + Tips'],
    ['skip',       "Don't import"]
  ],

  _file(id) { return this._files.find(f => f.id === id); },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';

    // Every imported row is matched to a staff member by name, so without a roster
    // nothing can land. Steer to Staff Roster first (same as Log Hours).
    if (!((App.laborData && App.laborData.lc_staff) || []).length) {
      App.setupCard(container, {
        title: 'Import Needs Your Roster First',
        lead: 'Imported hours, tips, voids and comps get matched to a staff member by name. Build your roster and you can drop your POS exports here.',
        steps: [
          { title: 'Add your staff', desc: 'Imports match to a roster name, so set up your people first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    const drop = '<div class="card form-card">'
      + '<div class="card-title">Import POS Data</div>'
      + '<div class="pi-drop" style="border:1.5px dashed var(--b1);border-radius:8px;padding:40px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;background:var(--input);">'
        + '<div style="pointer-events:none;">'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">Drop your POS exports here</div>'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:12px;">Add as many as you have. Bar Cop reads each one and sorts it into hours, tips, voids and comps.</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:12px;">or <span style="color:var(--gold);text-decoration:underline;">browse to choose</span> &middot; CSV or Excel</div>'
        + '</div></div>'
      + '<input type="file" class="pi-file" accept=".csv,.xlsx,.xls" multiple style="display:none;"/>'
      + '</div>';

    container.innerHTML = '<div class="screen">' + drop
      + '<div id="pi-files"></div><div id="pi-actions"></div><div id="pi-result"></div></div>';

    const zone = container.querySelector('.pi-drop');
    const input = container.querySelector('.pi-file');
    const over = on => { zone.style.borderColor = on ? 'var(--gold)' : 'var(--b1)'; zone.style.background = on ? 'var(--gold-bg)' : 'var(--input)'; };
    if (zone && input) {
      zone.addEventListener('click', () => input.click());
      input.addEventListener('change', e => { this.addFiles(e.target.files); input.value = ''; });
      ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); over(true); }));
      ['dragleave', 'dragend'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); over(false); }));
      zone.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); over(false); const ff = e.dataTransfer && e.dataTransfer.files; if (ff && ff.length) this.addFiles(ff); });
    }

    // Delegated handlers (navigate() resets .onclick/.onchange each visit, so no
    // listener pile-up). The file cards re-render in place; delegation persists.
    container.onchange = e => {
      const t = e.target;
      if (t.classList && t.classList.contains('pi-type')) {
        const f = this._file(t.dataset.id);
        if (f) { f.type = t.value; f.map = (f.type && f.type !== 'skip') ? PosIngest.autoMap(f.headers, f.type) : {}; this.renderFiles(); }
      } else if (t.classList && t.classList.contains('pi-mapsel')) {
        const f = this._file(t.dataset.id);
        if (f) { f.map[t.dataset.key] = t.value; this.renderFiles(); }
      }
    };
    container.onclick = e => {
      const rm = e.target.closest && e.target.closest('.pi-remove');
      if (rm) { this._files = this._files.filter(f => f.id !== rm.dataset.id); this.renderFiles(); return; }
      if (e.target.closest && e.target.closest('#pi-startover')) {
        this._files = []; const res = document.getElementById('pi-result'); if (res) res.innerHTML = ''; this.renderFiles(); return;
      }
      if (e.target.closest && e.target.closest('#pi-import-all')) { this.importAll(); return; }
    };

    this.renderFiles();
  },

  addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || typeof CSVMapper === 'undefined') return;
    Promise.all(files.map(f => CSVMapper.parseFile(f).then(
      p => {
        const type = PosIngest.detect(p.headers);
        return { id: 'f' + (++this._seq), name: f.name, headers: p.headers, rows: p.rows, type,
                 map: (type && type !== 'skip') ? PosIngest.autoMap(p.headers, type) : {}, error: null };
      },
      err => {
        const m = err && err.message;
        const msg = m === 'type' ? 'Use a CSV or Excel file.'
                  : m === 'empty' ? 'That file looks empty.'
                  : 'Could not read that file.';
        return { id: 'f' + (++this._seq), name: f.name, error: msg };
      }
    ))).then(items => { this._files.push(...items); this.renderFiles(); });
  },

  renderFiles() {
    const fc = document.getElementById('pi-files');
    const ac = document.getElementById('pi-actions');
    if (fc) fc.innerHTML = this._files.map(f => this.fileCard(f)).join('');
    if (ac) ac.innerHTML = this.renderActions();
  },

  fileCard(f) {
    const head = '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">'
      + '<span>' + esc(f.name) + (f.error ? '' : ' <span style="color:var(--t3);font-weight:400;font-size:12px;">' + f.rows.length + ' rows</span>') + '</span>'
      + '<button class="btn btn-ghost btn-sm pi-remove" data-id="' + f.id + '">Remove</button></div>';
    if (f.error) {
      return '<div class="card form-card" style="margin-top:16px;">' + head
        + '<div style="font-size:13px;color:var(--red);">' + esc(f.error) + '</div></div>';
    }
    const typeSel = '<div class="f" style="width:230px;flex-shrink:0;"><label>This file is</label>'
      + '<select class="pi-type" data-id="' + f.id + '">'
      + this._TYPE_OPTS.map(o => '<option value="' + o[0] + '"' + (f.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('')
      + '</select></div>';
    let body = '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">' + typeSel + '</div>';
    if (f.type && f.type !== 'skip') {
      body += this.mapGrid(f) + this.countsLine(f) + this.previewTable(f);
    } else if (f.type === 'skip') {
      body += '<div style="font-size:13px;color:var(--t3);margin-top:8px;">This file will be left out.</div>';
    }
    return '<div class="card form-card" style="margin-top:16px;">' + head + body + '</div>';
  },

  mapGrid(f) {
    const fields = PosIngest.fieldsFor(f.type);
    const optsFor = sel => '<option value="">(skip)</option>'
      + f.headers.map(h => '<option value="' + esc(h) + '"' + (h === sel ? ' selected' : '') + '>' + esc(h) + '</option>').join('');
    return '<div class="sh" style="margin:14px 0 8px;">Match Your Columns</div>'
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">'
      + fields.map(fl => '<div class="f" style="width:190px;flex-shrink:0;"><label>' + esc(fl.label)
          + (fl.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
          + '<select class="pi-mapsel" data-id="' + f.id + '" data-key="' + fl.key + '">' + optsFor(f.map[fl.key] || '') + '</select></div>').join('')
      + '</div>';
  },

  // Run the real builders (no save) to show how many rows are new vs already in.
  countsFor(f) {
    if (!f.type || f.type === 'skip') return null;
    const subs = PosIngest.SUBTYPES[f.type] || [];
    const mapped = PosIngest.mapRows(f.headers, f.rows, f.map);
    let imp = 0, dup = 0, skp = 0; const missing = [];
    subs.forEach(sub => {
      (PosIngest.FIELDS[sub] || []).forEach(fl => { if (fl.required && !f.map[fl.key]) missing.push(fl.label); });
      const r = PosIngest.build(sub, mapped);
      imp += r.toAdd.length; dup += r.dupCount; skp = Math.max(skp, r.skipped.length);
    });
    return { imp, dup, skp, missing: [...new Set(missing)] };
  },

  countsLine(f) {
    const c = this.countsFor(f);
    if (!c) return '';
    let html = '<div style="margin-top:14px;font-size:13px;">'
      + '<span style="color:var(--t1);font-weight:700;">' + c.imp + ' to import</span>';
    if (c.dup) html += '<span style="color:var(--t3);"> &middot; ' + c.dup + ' already imported, skipped</span>';
    if (!c.imp) {
      if (c.missing.length) html += '<span style="color:var(--amber);"> &middot; map the ' + c.missing.join(' and ') + ' column' + (c.missing.length > 1 ? 's' : '') + '</span>';
      else if (c.skp) html += '<span style="color:var(--amber);"> &middot; no names matched your roster</span>';
    }
    return html + '</div>';
  },

  previewTable(f) {
    const pr = f.rows.slice(0, 3);
    if (!pr.length) return '';
    return '<div style="margin-top:14px;"><div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;margin-bottom:6px;">PREVIEW: FIRST ROWS FROM YOUR FILE</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + f.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>'
      + pr.map(r => '<tr>' + f.headers.map((h, i) => '<td>' + esc(r[i] != null ? r[i] : '') + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></div></div>';
  },

  renderActions() {
    if (!this._files.length) return '';
    const totalImp = this._files.reduce((s, f) => {
      if (f.error || !f.type || f.type === 'skip') return s;
      const c = this.countsFor(f); return s + (c ? c.imp : 0);
    }, 0);
    return '<div style="margin:8px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="pi-import-all"' + (totalImp ? '' : ' disabled') + '>Import ' + totalImp + ' Row' + (totalImp === 1 ? '' : 's') + '</button>'
      + '<button class="btn btn-ghost" id="pi-startover">Start Over</button></div>';
  },

  async importAll() {
    const btn = document.getElementById('pi-import-all');
    if (btn) btn.disabled = true;
    const totals = { hours: 0, tips: 0, voids: 0 };
    let dup = 0, anyFail = false;
    // build -> commit per file in order, so a duplicate second file sees the first
    // one's just-committed rows and is skipped instead of double-counted.
    for (const f of this._files) {
      if (f.error || !f.type || f.type === 'skip') continue;
      const mapped = PosIngest.mapRows(f.headers, f.rows, f.map);
      for (const sub of (PosIngest.SUBTYPES[f.type] || [])) {
        const { toAdd, dupCount } = PosIngest.build(sub, mapped);
        dup += dupCount;
        if (toAdd.length) {
          const ok = await PosIngest.commit(sub, toAdd);
          if (ok) totals[sub] += toAdd.length; else anyFail = true;
        }
      }
    }
    if (totals.hours && App.markSetupDone) App.markSetupDone('gs_lc_hours');

    const parts = [];
    if (totals.hours) parts.push(totals.hours + ' hours');
    if (totals.tips)  parts.push(totals.tips + ' tip' + (totals.tips === 1 ? '' : 's'));
    if (totals.voids) parts.push(totals.voids + ' voids and comps');
    const total = totals.hours + totals.tips + totals.voids;

    this._files = [];
    this.renderFiles();
    const res = document.getElementById('pi-result');
    if (res) {
      if (!total) {
        res.innerHTML = '<div style="font-size:13px;color:var(--amber);margin-top:4px;">Nothing imported. Every row was already in Bar Cop or had no roster match.</div>';
      } else {
        res.innerHTML = '<div style="font-size:14px;color:var(--t1);font-weight:700;margin-top:4px;">Imported ' + parts.join(', ') + '.'
          + (dup ? ' <span style="color:var(--t3);font-weight:400;">' + dup + ' already imported, skipped.</span>' : '')
          + (anyFail ? ' <span style="color:var(--red);font-weight:400;">Some rows did not save, try the import again.</span>' : '')
          + '</div>';
      }
    }
  },

  showHowTo() {
    App.showHelpModal('How Importing POS Data Works', [
      { p: ['Drop a week of POS and timeclock exports here all at once instead of going page by page. Bar Cop reads each file, sorts it into hours, tips, or voids and comps, and lands it in the right place.'] },
      { h: 'Dropping Files', p: ['Drop one or more CSV or Excel exports, or browse to pick them. Each file shows up as its own card with what Bar Cop thinks it is.'] },
      { h: 'Check The Type', p: ['Bar Cop guesses each file from its columns. If it guessed wrong, change "This file is" to Hours, Tips, Voids & Comps, Hours + Tips, or Don\'t import. A payroll export with both hours and tip columns can land in both at once.'] },
      { h: 'Match The Columns', p: ['Required columns are marked with a star. Your headers do not need to match exactly: Bar Cop reads employee / name / staff as Staff Name and so on. Fix any column it missed.'] },
      { h: 'Import All', p: ['The count on each file shows how many rows are new. Anything already in Bar Cop is flagged and skipped so a re-drop never double-counts. Hit Import All to land everything in one go.'] },
      { h: 'Where It Lands', p: ['Hours go to Log Hours, tips to the Tip Log, voids and comps to the Void and Comp Log. From there they feed labor cost, prime cost, tip-outs, and loss prevention like always. You can still import one file at a time from those pages.'] },
      { h: 'Matching To Your Roster', p: ['Every row is matched to a staff member by name. A row that matches no one on the roster is skipped and counted so you can fix the name or add the person.'] }
    ]);
  }
};
