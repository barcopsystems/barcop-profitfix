'use strict';

/* ── ImportConfirm — the shared confirm-before-write screen ────────────────────
   Every import door in Bar Cop drops a file, maps its columns, and then writes.
   This is the step in between: a list of everything the file holds, what will
   happen to each of it, and one button. Nothing is written until that press.

   ⛔ WHAT IS SHARED IS THE SHELL, NOT THE SCREEN. Add Products groups by category
   and sinks the rows that will not land; sales-by-day is flat and stays in date
   order and asks a two-way question on the row. Serving both by option-switch
   ends in a component with fifteen options, which is worse than two clean
   screens. So the DOOR owns its columns, its per-row decision control and its
   build; this owns the frame, and specifically it owns every part of the frame
   that has already gone wrong somewhere:

     - the button's count is DERIVED from the rows, never passed in;
     - a row that will not land is dimmed, EXCEPT one waiting on the operator;
     - the table sits in a `.card`, or its rows are invisible;
     - the colgroup always sums to 100;
     - there is always a result slot for a refused write to report into;
     - the go button is disabled at zero and both buttons are disabled mid-write.

   ImportConfirm.panel({
     label:        'Check your week',        // small uppercase heading
     lead:         'Bar Cop read 7 days...', // one sentence, plain text
     columns:      [{ label:'Day', width:22 }, ...],   // DATA columns only
     outcomeLabel: 'What Happens',           // header for the last column
     rows:         [ {
        cells:    ['Mon, Aug 3', '$1,250.00', '52'],  // HTML, one per data column
        note:     'Replacing earlier figures',        // TEXT — what happens to this row
        notes:    ['Added up from several rows'],     // TEXT — extra lines under cell 1
        lands:    true,                               // will this row be written?
        needsYou: false,                              // is it waiting on a decision?
        decision: '<button ...>'                      // HTML, sits under the note
     } ],
     verb: 'Add', noun: 'Day',               // button reads "Add 4 Days"
     goAttr: 'data-x-go', backAttr: 'data-x-back', backLabel: 'Start Over',
     resultId: 'sc-ck-import-res',
     busy: false
   })

   ⚠ `cells` and `decision` are HTML the door has already built and escaped.
   `note` and `notes` are TEXT and are escaped here — they are also the two the
   NOTE_BUDGET applies to, so keeping them plain is what makes them measurable. */

const ImportConfirm = {

  /* The one-line budget for a row note. These sit under the first cell, which is
     around a fifth of the table, and at this size ~43 characters is one line.
     Measured off a real render: the first note over it wrapped with a single word
     orphaned on the second line. Published so a door can check its own wording
     and a sweep can check every door's at once. */
  NOTE_BUDGET: 43,

  // The small grey line under a cell. Used for row notes and for `compare`.
  sub(html) {
    return '<div style="font-size:10px;color:var(--t3);letter-spacing:0.5px;margin-top:2px;">' + html + '</div>';
  },
  // What happens to this row, in the last column.
  outcome(text) {
    return '<div style="font-size:12px;color:var(--t2);">' + esc(text) + '</div>';
  },
  /* A value the file carries, with the operator's own underneath it when the two
     disagree. Used wherever a door has to show a conflict.
     ⛔ ONLY WHEN THEY DIFFER. A conflict is raised when ANY field disagrees, so a
     column that happens to match must not print "you entered 50" under 50 — that
     is noise on the one row that can least afford it. And no second value at all
     is the ordinary case, which must look identical to agreement rather than
     rendering "you entered undefined". */
  compare(shown, yours) {
    if (yours == null || yours === '' || String(yours) === String(shown)) return shown;
    return shown + this.sub('you entered ' + yours);
  },

  _rowHtml(row) {
    /* ⛔ DIM MEANS "YOU CAN LEAVE THIS ALONE", so a row waiting on the operator is
       never dimmed even though it will not land as things stand. Keyed on `lands`
       alone it greyed out the one row that needed them while it waited, and
       un-greyed it once they answered — loudest exactly when it stopped needing
       attention. Found on the live screen, not by any assertion. */
    const dim = !row.lands && !row.needsYou;
    const notes = (row.notes || []).map(n => this.sub(esc(n))).join('');
    const cells = (row.cells || []).map((c, i) =>
      '<td>' + (c == null ? '&mdash;' : c) + (i === 0 ? notes : '') + '</td>').join('');
    return '<tr' + (dim ? ' style="opacity:0.5;"' : '') + '>'
      + cells
      + '<td>' + this.outcome(row.note || '') + (row.decision || '') + '</td></tr>';
  },

  panel(opts) {
    opts = opts || {};
    const cols = opts.columns || [];
    const rows = opts.rows || [];
    /* ⛔⛔ THE COUNT IS DERIVED, NEVER PASSED. The reference screen's worst defect
       was a button promising 14 over a table saying 13 while 12 landed — three
       numbers from three walks. Taking a `count` option would hand every door in
       the rollout the same defect back. Counted here, from the rows the door has
       just handed over, so a door CANNOT print a number that disagrees with its
       own table. Structural, not a rule somebody has to remember. */
    const n = rows.filter(r => r && r.lands).length;
    const busy = !!opts.busy;
    const verb = opts.verb || 'Add';
    const noun = opts.noun || 'Row';
    /* ⚠ NOT EVERY NOUN TAKES AN `s`. "Add 4 Persons" is what a bare `+ 's'` produces on the staff
       roster. A door whose plural is irregular passes it; the default stays the regular form so
       nothing else has to change. */
    const nounN = n === 1 ? noun : (opts.nounPlural || (noun + 's'));
    /* ⛔ THE LAST COLUMN TAKES WHAT IS LEFT, so the colgroup always sums to 100.
       A colgroup that does not silently rescales every column, and on a grouped
       screen the sections then stop lining up with each other. */
    const used = cols.reduce((t, c) => t + (Number(c.width) || 0), 0);
    const outW = Math.max(0, 100 - used);
    const colgroup = '<colgroup>'
      + cols.map(c => '<col style="width:' + (Number(c.width) || 0) + '%;"/>').join('')
      + '<col style="width:' + outW + '%;"/></colgroup>';
    const head = '<thead><tr>'
      + cols.map(c => '<th>' + esc(c.label || '') + '</th>').join('')
      + '<th>' + esc(opts.outcomeLabel || 'What Happens') + '</th></tr></thead>';

    return (opts.label
        ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">'
          + '<span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">'
          + esc(opts.label) + '</span></div>' : '')
      + (opts.lead ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + esc(opts.lead) + '</div>' : '')
      /* ⛔ THE CARD IS LOAD-BEARING, NOT DECORATION. `.row-list tbody td` is
         #0D181E and a cockpit step workspace is #0D181E too, so a bare table
         paints its row fill invisibly against its own container and the rows read
         as loose text. Measured on the live build. Inside a `.card` (#08131A) the
         fill lands exactly as it does on the Inventory product list. */
      + '<div class="card" style="container-type:inline-size;">'
      +   '<div style="overflow-x:auto;">'
      +   '<table class="row-list" style="table-layout:fixed;width:100%;">'
      +   colgroup + head
      +   '<tbody>' + rows.map(r => this._rowHtml(r)).join('') + '</tbody></table></div></div>'
      /* ⛔ ALWAYS RENDER THE RESULT SLOT. A refused write reports into it, and a
         message with nowhere to render is the worst outcome an import has: the
         operator sees a clean page and no error at all. */
      + '<div id="' + esc(opts.resultId || 'import-confirm-res') + '"></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      +   '<button class="btn btn-primary btn-sm" ' + (opts.goAttr || 'data-confirm-go') + '="1"'
      +     (n && !busy ? '' : ' disabled') + '>'
      +     (busy ? (opts.busyLabel || (verb + 'ing...')) : verb + ' ' + n + ' ' + nounN)
      +   '</button>'
      /* ⚠ THE BACK BUTTON IS DISABLED MID-WRITE TOO. It restarts the import, and a
         restart during the write is how a screen ends up describing a record that
         is no longer the one being written. */
      +   '<button class="btn btn-ghost btn-sm" ' + (opts.backAttr || 'data-confirm-back') + '="1"'
      +     (busy ? ' disabled' : '') + '>' + esc(opts.backLabel || 'Start Over') + '</button>'
      + '</div>';
  }
};

if (typeof window !== 'undefined') window.ImportConfirm = ImportConfirm;
