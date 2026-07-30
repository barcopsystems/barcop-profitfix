'use strict';
/* FileDrop — one shared drag-and-drop upload zone per audit intake.
   The server extraction pools every uploaded file together (server/index.js
   flattens all multipart files regardless of field), so a single zone, not one
   box per report, matches the architecture. A numbered "what helps" list sits
   above the zone as guidance only; dropped or chosen files collect as removable
   chips. Desktop drag-drop is an enhancement, tap-to-browse works everywhere.

   Honest by design: the list is guidance, never a promise that a given file was
   recognized. The audit's existing N/A section badges show what the data
   actually produced after Generate, so there is no live per-file checkoff to
   fake (filename matching and per-file classification are both unreliable).

   Files live in FileDrop._stores[id]; generateAudit reads them via
   FileDrop.getFiles(id) and appends each under the field name 'file'. */
window.FileDrop = {
  ACCEPT: '.xlsx,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg',
  _stores: {},

  // render(id, opts) -> inner HTML (numbered guidance + zone + hidden input +
  // chips). The caller wraps this in its own card with a heading and intro.
  // opts.items: array of { t: 'Report name', s: 'what it adds' (optional),
  //   hi: true (optional, marks it Highest value).
  render(id, opts) {
    opts = opts || {};
    this._stores[id] = [];
    const items = opts.items || [];
    const li = items.map((it, i) => {
      const star = it.hi ? '<span style="color:var(--gold);font-weight:800;margin-left:8px;font-size:9px;letter-spacing:1px;text-transform:uppercase;">Highest value</span>' : '';
      return '<li style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--b2);align-items:flex-start;">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:700;color:var(--t3);flex-shrink:0;line-height:1.4;min-width:14px;">' + (i + 1) + '</span>'
        + '<span style="flex:1;"><span style="font-size:12px;font-weight:700;color:var(--t1);">' + esc(it.t) + '</span>' + star
        + (it.s ? '<span style="display:block;font-size:11px;color:var(--t3);margin-top:2px;line-height:1.4;">' + esc(it.s) + '</span>' : '')
        + '</span></li>';
    }).join('');
    const listBlock = items.length
      ? '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">What helps</div>'
        + '<ol style="list-style:none;margin:0 0 16px;padding:0;">' + li + '</ol>'
      : '';
    const zone = '<div id="' + id + '-zone" style="border:1.5px dashed var(--b1);border-radius:6px;padding:28px 16px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;background:var(--input);">'
      + '<div style="pointer-events:none;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">Drop your files here</div>'
      + '<div style="font-size:11px;color:var(--t3);">or <span style="color:var(--gold);font-weight:700;">browse</span> to choose. ' + (opts.acceptText || 'PDF, Excel, CSV, or images') + '. Add as many as you like.</div>'
      + '</div></div>';
    const input = '<input type="file" id="' + id + '-input" multiple accept="' + (opts.accept || this.ACCEPT) + '" style="display:none;">';
    const chips = '<div id="' + id + '-chips" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;"></div>';
    return listBlock + zone + input + chips;
  },

  // attach(id) — wire drag/drop, browse, and chip removal. Call once after the
  // rendered HTML is in the DOM.
  attach(id) {
    const zone  = document.getElementById(id + '-zone');
    const input = document.getElementById(id + '-input');
    const chips = document.getElementById(id + '-chips');
    if (!zone || !input || !chips) return;
    if (!this._stores[id]) this._stores[id] = [];
    const store = this._stores[id];

    const fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
    const renderChips = () => {
      chips.innerHTML = store.map((f, i) =>
        '<span style="display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--b1);border-radius:20px;padding:5px 6px 5px 12px;max-width:280px;">'
        + '<span style="font-size:11px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(f.name) + '</span>'
        + '<span style="font-size:10px;color:var(--t4);flex-shrink:0;">' + fmtSize(f.size) + '</span>'
        + '<button type="button" data-fd-rm="' + i + '" aria-label="Remove file" style="flex-shrink:0;width:18px;height:18px;border:none;border-radius:50%;background:var(--b1);color:var(--t2);font-size:13px;line-height:1;cursor:pointer;padding:0;">&times;</button>'
        + '</span>'
      ).join('');
    };
    const add = (fileList) => {
      let added = 0;
      for (const f of fileList) {
        if (f && f.size > 0 && !store.some(x => x.name === f.name && x.size === f.size)) { store.push(f); added++; }
      }
      if (added) renderChips();
    };
    const over = (on) => {
      zone.style.borderColor = on ? 'var(--gold)' : 'var(--b1)';
      zone.style.background  = on ? 'var(--gold-bg)' : 'var(--input)';
    };

    input.addEventListener('change', () => { add(input.files); input.value = ''; });
    zone.addEventListener('click', () => input.click());
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); over(true); }));
    ['dragleave', 'dragend'].forEach(ev => zone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); over(false); }));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); over(false);
      if (e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files);
    });
    chips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fd-rm]');
      if (!btn) return;
      store.splice(parseInt(btn.dataset.fdRm, 10), 1);
      renderChips();
    });
    renderChips();
  },

  count(id)    { return (this._stores[id] || []).length; },
  clear(id)    { this._stores[id] = []; }
};
