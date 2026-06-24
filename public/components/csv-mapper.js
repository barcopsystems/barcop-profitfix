'use strict';

/* ── CSV Mapper — reusable column-mapping import component ────────────────────
   Used for POS sales imports (Variance Report) and timeclock imports (Labor
   Control). Reads CSV / XLSX, auto-detects columns, lets the user remap, and
   remembers the mapping per file format (header signature) in localStorage.

   CSVMapper.mount(containerEl, {
     fields:       [{ key, label, required, match:[keywords] }],
     hint:         'optional help line (HTML allowed)',
     dropTitle:    'optional dropzone prompt (plain text; default "Drop your file here")',
     confirmLabel: 'Import',
     onComplete:   rows => {}      // rows: [{ <key>: value, ... }] one per data row
   }); */

const CSVMapper = {
  _LS: 'csv_mappings',

  mount(container, opts) {
    container.innerHTML =
      (opts.hint ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + opts.hint + '</div>' : '')
      + '<div class="csvm-drop" style="border:1.5px dashed var(--b1);border-radius:8px;padding:40px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;background:var(--input);">'
        + '<div style="pointer-events:none;">'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + (opts.dropTitle ? esc(opts.dropTitle) : 'Drop your file here') + '</div>'
        + (opts.dropSub ? '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:12px;">' + opts.dropSub + '</div>' : '')
        + '<div style="font-size:11px;color:var(--t3);margin-top:' + (opts.dropSub ? '12px' : '5px') + ';">or <span style="color:var(--gold);text-decoration:underline;">browse to choose</span> &middot; CSV or Excel</div>'
        + '</div></div>'
      + '<input type="file" class="csvm-file" accept=".csv,.xlsx,.xls" style="display:none;"/>'
      + '<div class="csvm-area"></div>';
    // Optional external actions target (Import / Cancel render there, e.g. below
    // a card instead of inside it). Cleared back to empty in the dropzone state.
    const extEl = this._actionsEl(opts);
    if (extEl) extEl.innerHTML = '';
    const zone = container.querySelector('.csvm-drop');
    const input = container.querySelector('.csvm-file');
    const over = on => { zone.style.borderColor = on ? 'rgba(255,255,255,.30)' : 'var(--b1)'; zone.style.background = on ? 'rgba(255,255,255,.04)' : 'var(--input)'; };
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', e => { const f = e.target.files[0]; if (f) this._readFile(f, container, opts); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); over(true); }));
    ['dragleave', 'dragend'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); over(false); }));
    zone.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); over(false); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) this._readFile(f, container, opts); });
    // Lifecycle hook: 'drop' = dropzone showing, 'map' = column-mapping showing.
    // Lets a caller hide its own sibling buttons while the mapper is open so they
    // do not stack under the Import/Cancel row. Fires again on Cancel (re-mount).
    if (typeof opts.onState === 'function') opts.onState('drop');
  },

  _area(c) { return c.querySelector('.csvm-area'); },
  // Resolve an optional external container for the action row (element, selector,
  // or function returning one). Lets a caller place Import/Cancel outside the card.
  _actionsEl(opts) {
    const a = opts && opts.actionsEl;
    if (!a) return null;
    if (typeof a === 'string') return document.querySelector(a);
    if (typeof a === 'function') return a();
    return a;
  },
  _msg(c, text, color) {
    this._area(c).innerHTML = '<div style="font-size:12px;color:' + (color || 'var(--t3)') + ';margin-top:12px;">' + esc(text) + '</div>';
  },

  _readFile(file, container, opts) {
    this._msg(container, 'Reading file...');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const r = new FileReader();
      r.onload = e => this._afterParse(this._parseCSV(e.target.result), container, opts);
      r.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const r = new FileReader();
      r.onload = e => this._parseXLSX(e.target.result, container, opts);
      r.readAsArrayBuffer(file);
    } else {
      this._msg(container, 'Unsupported file type. Use CSV or Excel.', 'var(--red)');
    }
  },

  _parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const parseLine = line => {
      const out = []; let inQ = false, cur = '';
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };
    const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
    const rows = lines.slice(1).filter(l => l.trim()).map(parseLine);
    return { headers, rows };
  },

  _parseXLSX(buffer, container, opts) {
    const run = () => {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (data.length < 2) { this._msg(container, 'File appears empty.', 'var(--red)'); return; }
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
      this._afterParse({ headers, rows }, container, opts);
    };
    if (typeof XLSX === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = run;
      s.onerror = () => this._msg(container, 'Could not load the Excel reader. Try saving as CSV instead.', 'var(--red)');
      document.head.appendChild(s);
    } else run();
  },

  _sig(headers) { return headers.map(h => String(h).toLowerCase().trim()).join('|'); },
  _savedMaps()  { try { return JSON.parse(localStorage.getItem(this._LS) || '{}'); } catch (e) { return {}; } },
  _saveMap(sig, map) {
    try { const all = this._savedMaps(); all[sig] = map; localStorage.setItem(this._LS, JSON.stringify(all)); } catch (e) {}
  },

  _autoMap(headers, fields) {
    const map = {};
    const used = {};
    fields.forEach(f => {
      const cands = [f.key, f.label, ...(f.match || [])].map(s => String(s).toLowerCase());
      let hit = headers.find(h => !used[h] && cands.includes(String(h).toLowerCase().trim()));
      if (!hit) hit = headers.find(h => !used[h] && cands.some(c => String(h).toLowerCase().trim().includes(c)));
      if (hit) { map[f.key] = hit; used[hit] = true; }
    });
    return map;
  },

  _afterParse(parsed, container, opts) {
    if (!parsed || !parsed.headers.length) {
      this._msg(container, 'File appears empty or has only a header row.', 'var(--red)');
      return;
    }
    const { headers, rows } = parsed;
    const sig = this._sig(headers);
    // Honor any remembered EXPLICIT column picks first, then auto-detect whatever is
    // still unmapped. A remembered skip (or an older saved map missing a field) never
    // suppresses a column the file clearly has — auto-detect still fills it.
    const saved = this._savedMaps()[sig] || {};
    const map = {}, taken = {};
    opts.fields.forEach(f => { if (saved[f.key] && headers.includes(saved[f.key])) { map[f.key] = saved[f.key]; taken[saved[f.key]] = true; } });
    const remaining = opts.fields.filter(f => !map[f.key]);
    if (remaining.length) {
      const auto = this._autoMap(headers.filter(h => !taken[h]), remaining);
      Object.keys(auto).forEach(k => { map[k] = auto[k]; });
    }
    this._renderMapper(headers, rows, map, sig, container, opts);
  },

  _renderMapper(headers, rows, map, sig, container, opts) {
    const optsFor = sel => '<option value="">(skip)</option>'
      + headers.map(h => '<option value="' + esc(h) + '"' + (h === sel ? ' selected' : '') + '>' + esc(h) + '</option>').join('');
    // No card wrapper: the mapper sits directly on the canvas of whatever card it
    // was mounted in, laying out like the manual entry form (a thin divider off
    // the drop zone, a section heading, the field grid, then the action row).
    let html = '<div class="divider"></div>'
      + '<div class="sh" style="margin:0 0 12px;">Map Your Columns</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;">Found <strong style="color:var(--w);">'
      + rows.length + ' rows</strong>. Match each field to a column from your file. '
      + 'Detected columns are pre-selected and this mapping is remembered for next time.</div>'
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">';
    opts.fields.forEach(f => {
      html += '<div class="f" style="width:210px;flex-shrink:0;"><label>' + esc(f.label)
        + (f.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
        + '<select class="csvm-sel" data-key="' + f.key + '">' + optsFor(map[f.key] || '') + '</select></div>';
    });
    html += '</div>';
    // First rows preview so the operator can confirm they mapped the right columns.
    const previewRows = rows.slice(0, 3);
    if (previewRows.length) {
      html += '<div style="margin-top:18px;"><div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;margin-bottom:6px;">PREVIEW: FIRST ROWS FROM YOUR FILE</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl csvm-preview"><thead><tr>'
        + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>'
        + previewRows.map(r => '<tr>' + headers.map((h, i) => '<td>' + esc(r[i] != null ? r[i] : '') + '</td>').join('') + '</tr>').join('')
        + '</tbody></table></div></div>';
    }
    const actionRow = '<div style="display:flex;gap:8px;align-items:center;margin-top:18px;"><button class="btn btn-primary csvm-go">'
      + esc(opts.confirmLabel || 'Import') + ' ' + rows.length + ' Rows</button>'
      + '<button type="button" class="btn btn-ghost csvm-cancel">Cancel</button></div>';
    const extEl = this._actionsEl(opts);
    html += '<div class="csvm-err" style="font-size:12px;color:var(--red);margin-top:10px;display:none;"></div>'
      + (extEl ? '' : actionRow);
    this._area(container).innerHTML = html;
    // Action row goes in the external target when one was given, else inline.
    if (extEl) extEl.innerHTML = actionRow;
    const scope = extEl || this._area(container);

    // Cancel discards this file and returns to the drop zone to pick another.
    const cancelBtn = scope.querySelector('.csvm-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.mount(container, opts));

    scope.querySelector('.csvm-go').addEventListener('click', () => {
      const sels = {};
      this._area(container).querySelectorAll('.csvm-sel').forEach(s => { sels[s.dataset.key] = s.value; });
      const missing = opts.fields.filter(f => f.required && !sels[f.key]);
      if (missing.length) {
        const err = this._area(container).querySelector('.csvm-err');
        err.textContent = 'Map the required field: ' + missing.map(f => f.label).join(', ');
        err.style.display = 'block';
        return;
      }
      this._saveMap(sig, sels);
      const idx = {};
      Object.keys(sels).forEach(k => { idx[k] = headers.indexOf(sels[k]); });
      const mapped = rows.map(row => {
        const o = {};
        Object.keys(idx).forEach(k => { o[k] = idx[k] >= 0 ? (row[idx[k]] || '') : ''; });
        return o;
      });
      opts.onComplete(mapped);
    });
    if (typeof opts.onState === 'function') opts.onState('map');
  }
};

window.CSVMapper = CSVMapper;
