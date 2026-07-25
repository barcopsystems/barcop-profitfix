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
  // Bumped to _v2 to throw away every mapping remembered under the old matcher.
  // Confirming an import saves whatever sits in the dropdowns, auto-detected picks
  // included, and _afterParse honors a saved map ahead of _autoMap. So a file that
  // auto-mapped wrong once stayed wrong on every later drop, and fixing _autoMap
  // alone would never have reached those operators. Cost of the reset is one
  // re-pick on files where the columns were chosen by hand.
  _LS: 'csv_mappings_v2',

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
    // ⚠ EVERY reader needs an onerror. Without one, a file the browser cannot read — a OneDrive or
    // network file that is not actually local, or one moved between the picker and the read —
    // leaves "Reading file..." on screen forever, with no error, no telemetry and no way to tell
    // that anything went wrong.
    const failRead = () => this._msg(container,
      'Could not read that file. If it lives in a cloud folder, make it available offline (or copy '
      + 'it to this device) and try again.', 'var(--red)');
    if (ext === 'csv') {
      const r = new FileReader();
      r.onload = e => this._afterParse(this._parseCSV(e.target.result), container, opts);
      r.onerror = failRead;
      r.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const r = new FileReader();
      r.onload = e => this._parseXLSX(e.target.result, container, opts);
      r.onerror = failRead;
      r.readAsArrayBuffer(file);
    } else {
      this._msg(container, 'Unsupported file type. Use CSV or Excel.', 'var(--red)');
    }
  },

  // Parse the WHOLE text character by character. The old shape split on newlines FIRST and only
  // then parsed quotes, so a quoted field CONTAINING a line break was torn in half: the real row
  // lost its trailing values and a phantom row appeared beside it. Any notes/reason cell with a
  // line break does this, and the voids/comps import maps exactly such a field
  // (note/notes/memo/comment). Quote state has to survive newlines, so it is tracked across them.
  /* Which character separates the columns. Excel writes SEMICOLON CSVs wherever the system list
     separator is ';' (most of Europe and Latin America), and a TSV renamed .csv is routine. Both
     parsed as ONE column, and because a menu import's only REQUIRED field is the name, that single
     column auto-mapped to it, Import was enabled, and records literally called "Wings;Food;12.00"
     were written at price 0 with no warning anywhere.
     ⚠ Counted on the HEADER LINE ONLY and OUTSIDE QUOTES, and comma wins ties — a semicolon inside
     an ordinary comma file ("hot; very hot") is data and must not change the delimiter. */
  _sniffDelim(src) {
    const line = String(src == null ? '' : src).split(/\r?\n/)[0] || '';
    const n = { ',': 0, ';': 0, '\t': 0 };
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (!inQ && n[ch] != null) n[ch]++;
    }
    let best = ',';
    [';', '\t'].forEach(d => { if (n[d] > n[best]) best = d; });
    return best;
  },

  _parseCSV(text) {
    // Strip a BOM and any leading blank lines before anything reads column 0. (Neither can sit
    // inside a quoted field at position 0, so this is safe to do up front.)
    const src = String(text == null ? '' : text).replace(/^﻿/, '').replace(/^[\r\n]+/, '');
    const DELIM = (this && this._sniffDelim) ? this._sniffDelim(src) : ',';
    const rows = [];
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQ) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cur += '"'; i++; }   // escaped "" inside a quoted field -> one literal quote (O""Brien -> O"Brien)
          else inQ = false;
        } else cur += ch;                               // a newline in here is DATA, not a row break
        continue;
      }
      // ⚠ A QUOTE ONLY OPENS A FIELD AT THE START OF ONE. Treating any quote as an opening quote
      // meant an inch mark in an ordinary item name — `12" Pizza`, `Bar Towels 16"x19"` — put the
      // parser into quoted mode, so it swallowed the next newline AS DATA: the row merged with the
      // one below it, the first item's price was lost, and the second was imported under a mangled
      // name at the wrong price. Column counts still matched, so the ragged-row banner never fired
      // and the preview collapsed the newline — nothing on screen said a menu item had vanished.
      if (ch === '"' && cur === '') { inQ = true; continue; }
      if (ch === DELIM) { row.push(cur.trim()); cur = ''; continue; }
      if (ch === '\r') continue;                        // CRLF: ignore the CR, break on the LF
      if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; continue; }
      cur += ch;
    }
    row.push(cur.trim());
    rows.push(row);
    // A file ending in a newline leaves one empty row; drop those rather than import blanks.
    while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
    if (rows.length < 2) return null;
    const headers = rows[0].map(h => h.replace(/^"|"$/g, ''));
    return { headers, rows: rows.slice(1).filter(r => r.some(c => c !== '')) };
  },

  // Resolve the operator's picks to COLUMN POSITIONS and read each row. `sels` holds a column INDEX
  // as a string ('' = the "(skip)" option) — never a header NAME. Identifying a column by name is
  // what let a BLANK header cell capture every skipped field (headers.indexOf('') returns a real
  // index, not -1) and made the second of two identically-named columns unreachable.
  _mapRows(rows, sels) {
    const idx = {};
    Object.keys(sels || {}).forEach(k => {
      const v = sels[k];
      idx[k] = (v === '' || v == null) ? -1 : Number(v);
    });
    return (rows || []).map(row => {
      const o = {};
      // `!= null`, not `||` — a legitimate "0" cell must survive.
      Object.keys(idx).forEach(k => { o[k] = (idx[k] >= 0 && row[idx[k]] != null) ? row[idx[k]] : ''; });
      return o;
    });
  },

  _parseXLSX(buffer, container, opts) {
    // ⚠ WRAPPED. run() is called straight from the FileReader onload, so anything XLSX.read threw
    // — a truncated download ("Unsupported ZIP file"), a password-protected workbook ("CFB file
    // size ... < 512"), any non-workbook renamed .xlsx — escaped to window.onerror, which replaces
    // the whole screen with the generic "this screen ran into a problem" card. A bad file is an
    // ordinary thing an operator does; it must not look like the app broke.
    const run = () => {
      try { this._parseXLSXInner(buffer, container, opts); }
      catch (e) {
        this._msg(container, 'Could not read that Excel file. It may be password-protected or only '
          + 'partly downloaded. Try opening it in Excel and saving as CSV.', 'var(--red)');
      }
    };
    if (typeof XLSX === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = run;
      s.onerror = () => this._msg(container, 'Could not load the Excel reader. Try saving as CSV instead.', 'var(--red)');
      document.head.appendChild(s);
    } else run();
  },

  _parseXLSXInner(buffer, container, opts) {
    {
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // raw:false so SheetJS returns each cell as its DISPLAYED text (dates as
      // "7/13/2026", not the numeric serial 45845). Without it a real Excel
      // date-typed column came through as serial numbers, normDate rejected every
      // one, and the whole file imported zero rows with no explanation. Formatted
      // text is exactly what the CSV path already feeds normDate/_num.
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      // ⚠ Only the FIRST sheet is read. Saying "empty" when the data is sitting on sheet 2 sends
      // the operator looking at the wrong thing — name the other sheets so they can move the tab.
      const others = (wb.SheetNames || []).slice(1);
      const emptyMsg = others.length
        ? 'The first sheet ("' + wb.SheetNames[0] + '") has no rows. Bar Cop reads the first sheet only — '
          + 'this file also has: ' + others.join(', ') + '. Move your data to the first sheet and try again.'
        : 'File appears empty.';
      if (data.length < 2) { this._msg(container, emptyMsg, 'var(--red)'); return; }
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
      // ⚠ The guard above runs on the UNFILTERED rows, so a sheet of blank data rows passed it and
      // then filtered down to nothing — rendering a live "Import 0 Rows" button that fired
      // onComplete with an empty array. Re-check after filtering.
      if (!rows.length) { this._msg(container, 'That sheet has headers but no data rows.', 'var(--red)'); return; }
      this._afterParse({ headers, rows }, container, opts);
    }
  },

  _sig(headers) { return headers.map(h => String(h).toLowerCase().trim()).join('|'); },
  _savedMaps()  { return App.acctGet(this._LS, {}); },   // account-synced (App.data): saved import maps follow the user across devices
  _saveMap(sig, map) { const all = { ...this._savedMaps() }; all[sig] = map; App.acctSet(this._LS, all); },

  // Two passes ACROSS ALL FIELDS, exact first. Running exact-then-fuzzy per field
  // let an earlier field's fuzzy guess eat a header a later field named exactly:
  // Void/Comp's `type` matched 'transaction' inside "Transaction Date" before `date`
  // (a later field, exact candidate 'transaction date') ever got to claim it, so
  // every comp imported as a Void stamped today. An exact header match now always
  // beats another field's fuzzy guess, whatever order the fields are declared in.
  // Returns { fieldKey: columnINDEX }. Indexes, not names: two columns can share a name, and a
  // blank name is not a name at all. `takenIdx` marks columns already claimed by a remembered map.
  _autoMap(headers, fields, takenIdx) {
    const map = {};
    const used = Object.assign({}, takenIdx || {});   // keyed by INDEX, so duplicate NAMES don't block each other
    const esc = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const candsFor = f => [f.key, f.label, ...(f.match || [])].map(s => String(s).toLowerCase());
    const norm = h => String(h).toLowerCase().trim();
    const claim = (f, i) => { if (i > -1) { map[f.key] = i; used[i] = true; } };
    // An UNNAMED column is never auto-claimed — there is nothing to match on, and guessing it is
    // how a row-number column ends up imported as covers.
    const findIdx = pred => {
      for (let i = 0; i < headers.length; i++) {
        if (used[i] || String(headers[i]).trim() === '') continue;
        if (pred(headers[i])) return i;
      }
      return -1;
    };

    fields.forEach(f => {
      const cands = candsFor(f);
      claim(f, findIdx(h => cands.includes(norm(h))));
    });
    // Whatever is still unmapped falls back to a WORD-BOUNDARY match, not a raw
    // substring, so "count" no longer matches inside "account" and a candidate only
    // hits a whole token.
    fields.forEach(f => {
      if (map[f.key] != null) return;   // `!= null`: column 0 is a real match, not "unmapped"
      const cands = candsFor(f);
      claim(f, findIdx(h => {
        const hl = norm(h);
        return cands.some(c => c.length >= 3 && new RegExp('(^|[^a-z])' + esc(c) + '([^a-z]|$)').test(hl));
      }));
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
    opts.fields.forEach(f => {
      // Saved maps hold a column INDEX. A map saved by an older build held a header NAME, which
      // Number() turns into NaN — ignore it rather than mis-resolve it, and let auto-detect fill in.
      const v = saved[f.key];
      const i = (v === '' || v == null) ? -1 : Number(v);
      if (Number.isInteger(i) && i >= 0 && i < headers.length) { map[f.key] = i; taken[i] = true; }
    });
    const remaining = opts.fields.filter(f => map[f.key] == null);
    if (remaining.length) {
      // Pass the FULL header list plus the claimed indexes — filtering the array here would have
      // shifted every index auto-detect returned.
      const auto = this._autoMap(headers, remaining, taken);
      Object.keys(auto).forEach(k => { map[k] = auto[k]; });
    }
    this._renderMapper(headers, rows, map, sig, container, opts);
  },

  _renderMapper(headers, rows, map, sig, container, opts) {
    // Option VALUES are column INDEXES, never header names. With names, an unnamed column emitted a
    // second <option value="">, indistinguishable from "(skip)" and silently importing column 0 for
    // every skipped field; and two columns sharing a name made the second one unreachable. An
    // unnamed column also gets a visible label so it can be picked on purpose.
    const optsFor = sel => '<option value="">(skip)</option>'
      + headers.map((h, i) => {
          const label = String(h).trim() === '' ? '(column ' + (i + 1) + ', no header)' : h;
          return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + esc(label) + '</option>';
        }).join('');
    // No card wrapper: the mapper sits directly on the canvas of whatever card it
    // was mounted in, laying out like the manual entry form (a thin divider off
    // the drop zone, a section heading, the field grid, then the action row).
    let html = '<div class="divider"></div>'
      + '<div class="sh" style="margin:0 0 12px;">Map Your Columns</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;">Found <strong style="color:var(--w);">'
      + rows.length + ' rows</strong>. Match each field to a column from your file. '
      + 'Detected columns are pre-selected and this mapping is remembered for next time.</div>'
      // Ragged rows = a data row with a different column count than the header,
      // almost always an unquoted comma in a number cell (like 1,234) that split
      // the row and shifted every column after it. Warn before the operator confirms.
      + (rows.filter(r => r.length !== headers.length).length
          ? '<div style="font-size:12px;color:var(--gold);background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:10px 12px;margin-bottom:14px;">Heads up: some rows have a different number of columns than the header. That usually means a number cell holds an unquoted comma (like 1,234), which splits the row and shifts the columns after it. Check the preview below lines up, or re-save the file with number columns quoted.</div>'
          : '')
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">';
    opts.fields.forEach(f => {
      html += '<div class="f" style="width:210px;flex-shrink:0;"><label>' + esc(f.label)
        + (f.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
        + '<select class="csvm-sel" data-key="' + f.key + '">' + optsFor(map[f.key] != null ? map[f.key] : -1) + '</select></div>';
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

    const goBtn = scope.querySelector('.csvm-go');
    goBtn.addEventListener('click', async () => {
      // ⚠ Re-entry guard for the WHOLE importer class (S194). This shared Import button is never
      // disabled, so a physical double-click fires onComplete TWICE — and any importer that writes
      // per-row or mints fresh ids then double-commits (putRecord updates memory across awaits, so
      // the second build sees a partial set and mints fresh ids for the rest: doubled hours, tips,
      // voids, server checks, regulars, roster). One guard here closes them all. Validation runs
      // BEFORE the flag so a missing-field click never latches it; the flag + the button-disable are
      // held until onComplete settles (await covers a promise-returning handler and a sync one alike).
      // ⚠ SAY SO. A bare `return` here is a button that does nothing when clicked, which the
      // operator reads as "the app is broken" — reachable by cancelling a big import and dropping
      // the file again while the first one is still writing.
      if (this._importing) {
        const busy = this._area(container).querySelector('.csvm-err');
        if (busy) { busy.textContent = 'An import is still finishing. Give it a moment and try again.'; busy.style.display = 'block'; }
        return;
      }
      const sels = {};
      this._area(container).querySelectorAll('.csvm-sel').forEach(s => { sels[s.dataset.key] = s.value; });
      const missing = opts.fields.filter(f => f.required && !sels[f.key]);
      if (missing.length) {
        const err = this._area(container).querySelector('.csvm-err');
        err.textContent = 'Map the required field: ' + missing.map(f => f.label).join(', ');
        err.style.display = 'block';
        return;
      }
      this._importing = true;
      goBtn.disabled = true;
      try {
        this._saveMap(sig, sels);
        // sels holds column INDEXES ('' = skip); _mapRows resolves them by position.
        await opts.onComplete(this._mapRows(rows, sels));
      } catch (e) {
        // ⚠ THIS COMPONENT OWNS AN ERROR SLOT AND WAS NOT USING IT FOR THE ONE FAILURE THAT
        // MATTERS. Every consumer's onComplete is an async multi-write chain; a rejection anywhere
        // in it (a network fault mid-request) used to become an unhandled rejection, which the app
        // logs to the server but deliberately does NOT surface. The button re-enabled and the panel
        // sat there unchanged, so the only reading available to the operator was "nothing
        // happened" — and the natural next move is to click Import again.
        const err = this._area(container).querySelector('.csvm-err');
        if (err) {
          err.textContent = 'The import could not be saved. Nothing was changed — check your connection and try again.';
          err.style.display = 'block';
        }
        // DB.logClientError, not App — it lives on DB (db.js:1195). Guarded, never-throws, and
        // deliberately non-blocking, so reporting can never make a failed import worse.
        if (typeof DB !== 'undefined' && DB.logClientError) {
          DB.logClientError('import_failed', (e && e.message) || 'onComplete rejected',
            'fields=' + Object.keys(sels).join(','), 'csv-import');
        }
      } finally {
        this._importing = false;
        goBtn.disabled = false;
      }
    });
    if (typeof opts.onState === 'function') opts.onState('map');
  }
};

window.CSVMapper = CSVMapper;
