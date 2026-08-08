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

  /* ⛔⛔ THE FIRST DROP IS THE CASE THAT MATTERS, AND IT IS BIG (Kyle, 2026-08-04): *"nobody is
     dropping a file to add a couple of menu items... what has to work and be right on most all of
     these is the initial first large drop."* Every screen here had been measured on six to nine rows
     against SEEDED data. Measured properly — 240 menu items onto an EMPTY menu, 80 staff onto an
     empty roster — a flat table failed three ways at once:
       - the Add button sat under 240 rows of table, so the primary action was below the fold;
       - the 13 rows needing a look were scattered from row 33 to row 240, so finding them meant
         reading the whole file;
       - and on a genuine first drop the notes became wallpaper: 77 of 80 staff rows carried
         "Position not on your list", because a new operator has no positions yet.
     A section that is collapsed fixes the first two at once, which is why Add Products was built
     that way before any of this started and why the flat table only ever looked fine at six rows. */
  /* ⛔⛔ A COLLAPSED SECTION RENDERS NOTHING AT ALL, which is why Add Products stays flat at 2000
     rows and why this had to stop hiding them with CSS. Measured on the live build: 2000 rows put
     2000 checkboxes in the DOM, a 98,942px page, and ~350ms per re-render — for rows nobody is
     looking at. The reference door has always built it this way; my first version rendered the table
     and hid it with `display:none`, which is the same page weight with none of the benefit.
     ⚠ THE COST OF DOING IT RIGHT: the shell now needs collapse STATE, because a section that is not
     in the DOM cannot be revealed by toggling a class. The door owns that state (it already owns a
     review object and a re-render) and passes it in; the head carries `data-confirm-section` so the
     door's existing click handler can flip it in one line. That is four lines per door, once. */
  _section(title, sub, tableHtml, open, first, key) {
    /* ⚠ NO NEW CSS. `.card.collapsed .card-chevron{transform:rotate(-90deg)}` already ships, so
       putting `collapsed` on the CARD gives the chevron for free — the same reasoning that kept the
       Add Products rebuild from needing a stylesheet change. */
    return '<div class="card' + (open ? '' : ' collapsed') + '" style="padding:0;container-type:inline-size;margin-top:'
      + (first ? '0' : '16') + 'px;">'
      + '<div data-confirm-section="' + esc(key) + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   '<div style="flex:1;min-width:0;">'
      +   '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(title) + '</div>'
      +   '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(sub) + '</div></div>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>'
      + (open ? '<div style="padding:0 16px 16px;overflow-x:auto;">' + tableHtml + '</div>' : '')
      + '</div>';
  },

  /* `hideActions` keeps the Remove column's CELL and leaves it empty. See the note at `table` for why
     the cell cannot go with the button. */
  _rowHtml(row, removable, selectable, isChecked, restorable, hideActions) {
    /* ⛔ DIM MEANS "YOU CAN LEAVE THIS ALONE", so a row waiting on the operator is
       never dimmed even though it will not land as things stand. Keyed on `lands`
       alone it greyed out the one row that needed them while it waited, and
       un-greyed it once they answered — loudest exactly when it stopped needing
       attention. Found on the live screen, not by any assertion.
       ⛔ A REMOVED ROW EARNS THE SAME EXCEPTION. It will not land, so the bare rule would grey it —
       and the one control it carries is Put Back, the thing that undoes the mistake that put it
       there. Kyle on the sales door: *"buttons dimmed makes the hard to see."* */
    const dim = !row.lands && !row.needsYou && !restorable;
    const notes = (row.notes || []).map(n => this.sub(esc(n))).join('');
    const cells = (row.cells || []).map((c, i) =>
      '<td>' + (c == null ? '&mdash;' : c) + (i === 0 ? notes : '') + '</td>').join('');
    /* ⛔ REMOVAL LIVES ON THE ROW (Kyle, 2026-08-04: *"why doesn't this have the remove buttons like
       add products?"*). Add Products used to have a BULK "Not a product" button and it took his
       entire import, because it reached past what was on screen. A control rendered on the row can
       only ever act on a row he is looking at, by name — the fix is structural, not a filter.
       No confirm: nothing is written until the final button, the row is named right beside it, and
       Start Over re-drops the file.
       ⚠ A row with no `key` gets no button. There would be nothing for the door to remove BY, and a
       control that does nothing is worse than no control ([[the-loop]] #106). */
    /* ⛔ IN THE REMOVED SECTION THE SAME COLUMN CARRIES **PUT BACK**, NOT A SECOND REMOVE. Two
       controls acting on one row, one of which is a no-op, is the shape [[the-loop]] #106 is about,
       and the verb has to say what it does. Same column, same width, so the colgroup still lines up
       across all three sections. */
    const rm = removable
      ? '<td>' + (!hideActions && row.key != null && row.key !== ''
          ? '<div class="row-actions"><button type="button" class="btn btn-ghost btn-sm"'
            + (restorable
                ? ' data-confirm-restore="' + esc(row.key) + '">Put Back'
                : ' data-confirm-remove="' + esc(row.key) + '">Remove')
            + '</button></div>'
          : '') + '</td>'
      : '';
    /* ⛔ A ROW WITH NO KEY GETS NO CHECKBOX, for the same reason it gets no Remove: there would be
       nothing for the door to act on BY, and a control that does nothing is worse than no control. */
    const cb = selectable
      ? '<td class="cb-left" style="text-align:center;">'
        + (row.key != null && row.key !== ''
            ? '<input type="checkbox" class="bc-check" data-confirm-check="' + esc(row.key) + '"'
              + (isChecked ? ' checked' : '') + '/>'
            : '') + '</td>'
      : '';
    return '<tr' + (dim ? ' style="opacity:0.5;"' : '') + '>'
      + cb + cells
      + '<td>' + this.outcome(row.note || '') + (row.decision || '') + '</td>'
      + rm + '</tr>';
  },

  /* ⭐⭐ THE GO BUTTON'S LABEL, IN ONE PLACE, because two places printing one string is how they
     drift ([[the-loop]] #54). The expense door rebuilds this button IN PLACE after a refused write —
     a re-render there would destroy the result slot holding the error — and its hand-built version
     said `'Add ' + n + ' Expense'`, which was true until A1 and A6 gave the label a NOUN that
     follows what is going in and a "(N with no type)" tail. So a refused import relabelled the
     button to something the shell would never render, on the screen where the operator is deciding
     whether to press it again. Both callers ask this now. */
  goLabel(opts) {
    opts = opts || {};
    const rows = opts.rows || [];
    const n = rows.filter(r => r && r.lands).length;
    const verb = opts.verb || 'Add';
    const noun = opts.noun || 'Row';
    /* ⚠ NOT EVERY NOUN TAKES AN `s`. "Add 4 Persons" is what a bare `+ 's'` produces on the staff
       roster. A door whose plural is irregular passes it; the default stays the regular form so
       nothing else has to change. */
    const nounN = n === 1 ? noun : (opts.nounPlural || (noun + 's'));
    const unset = opts.unsetNoun ? rows.filter(r => r && r.lands && r.unset).length : 0;
    return verb + ' ' + n + ' ' + nounN + (unset ? ' (' + unset + ' ' + opts.unsetNoun + ')' : '');
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
    /* ⭐⭐ HOW MANY OF THE ROWS GOING IN ARE NOT FULLY ANSWERED (build order A6). Kyle, after
       pressing ADD 5 EXPENSES with all five still unsorted: $7,201.83 went in with an EMPTY
       category and the button said nothing. The BOOKS were right — the Income Statement prints
       "Uncategorized (not on this statement yet)" below the total — but the button read as if the
       rows were fully filed, and reading it and agreeing was the action that caused it.
       ⛔ DERIVED, LIKE `n`, AND FOR THE SAME REASON. A door that passed a number could print one
       that disagrees with its own table. The door supplies only the WORDS, because "with no type"
       is expense vocabulary and the next door's will differ.
       ⚠ OPT-IN ON BOTH SIDES: no `unsetNoun` and no `unset` on any row means the label is
       byte-for-byte what every other door has always rendered.
       ⚠ And it disappears at zero. "(0 with no type)" on every clean import is the noise that makes
       an operator stop reading the button at all. All of that lives in `goLabel` above, because the
       expense door rebuilds this button in place after a refused write. */
    /* ⛔ THE LAST COLUMN TAKES WHAT IS LEFT, so the colgroup always sums to 100.
       A colgroup that does not silently rescales every column, and on a grouped
       screen the sections then stop lining up with each other. */
    // The Remove column takes a fixed slice and the outcome column takes what is left, so the
    // colgroup sums to 100 whether or not the door asked for Remove.
    const removable = !!opts.removable;
    /* ⛔⛔ REMOVE PUTS A ROW IN A SECTION; IT DOES NOT DESTROY IT (Kyle, 2026-08-07). Every control on
       this screen is reversible right up to the button, under a sentence reading "Nothing is saved
       until you do" — except Remove, which destroyed within the session. The only way back was Start
       Over, which drops the review and remounts the drop zone: the column mapping survives (saved per
       header signature, account-synced) but the FILE is gone, so one wrong click on row 90 of a
       122-row import meant re-dropping and redoing every removal already made.
       ⚠ THE DOOR OWNS THE ROWS, as with everything else here: it holds `removed{}` already, so it
       builds these the same way it builds the rest and passes them in. They are NEVER part of
       `rows`, which is what keeps them out of the count, out of the needs/settled split and out of
       the "All N of these" lift without a single special case anywhere else in this function.
       ⚠ REQUIRES `removable`. The section reuses the Remove column for Put Back, so a door that
       never offered Remove has no column to put it in — and has no way to have removed anything. */
    const removedRows = removable ? (opts.removedRows || []) : [];
    const selectable = !!opts.selectable;
    const checked = opts.checked || {};
    const rmW = removable ? 10 : 0;
    const cbW = selectable ? 5 : 0;
    const used = cols.reduce((t, c) => t + (Number(c.width) || 0), 0);
    const outW = Math.max(0, 100 - used - rmW - cbW);
    const colgroup = '<colgroup>'
      + (selectable ? '<col style="width:' + cbW + '%;"/>' : '')
      + cols.map(c => '<col style="width:' + (Number(c.width) || 0) + '%;"/>').join('')
      + '<col style="width:' + outW + '%;"/>'
      + (removable ? '<col style="width:' + rmW + '%;"/>' : '') + '</colgroup>';
    // ⚠ The header gains a cell too, or every row below it is off by one.
    const head = '<thead><tr>'
      + (selectable ? '<th></th>' : '')
      + cols.map(c => '<th>' + esc(c.label || '') + '</th>').join('')
      + '<th>' + esc(opts.outcomeLabel || 'What Happens') + '</th>'
      + (removable ? '<th></th>' : '') + '</tr></thead>';

    /* ⛔ LIFT THE NOTES EVERY LANDING ROW SHARES. See the render below for why. Computed off the
       LANDING rows only: a note on the rows that will not land is about those rows, and there is no
       "all of them" to speak of. */
    const landing = rows.filter(r => r && r.lands);
    const universal = landing.length > 1
      ? (landing[0].notes || []).filter(note => landing.every(r => (r.notes || []).indexOf(note) >= 0))
      : [];
    const shown = universal.length
      ? rows.map(r => Object.assign({}, r, { notes: (r.notes || []).filter(x => universal.indexOf(x) < 0) }))
      : rows;

    // A note every landing row shares is lifted above the table, so it is stripped wherever a row is
    // drawn — the grouped path included, or the same sentence returns once per row inside a section.
    const strip = r => universal.length
      ? Object.assign({}, r, { notes: (r.notes || []).filter(x => universal.indexOf(x) < 0) }) : r;
    /* `hideActions` lets ONE section drop the Remove BUTTON: a section that cannot be acted on must
       not offer the one control that does nothing there.
       ⛔⛔ IT DROPS THE BUTTON, NEVER THE CELL. The first version passed `removable: false` into the
       row, which removed the whole `<td>` — while the colgroup and the header still declared that
       column, because those are built once for the table. Every row in the section then ran one cell
       short and its background stopped 96px before the right edge. Kyle saw it immediately:
       *"you took away the remove button and now the row background does not still go full width."*
       The rule was already written above the colgroup — *"the header gains a cell too, or every row
       below it is off by one"* — and this broke it from the other end. */
    const table = (list, restorable, hideActions) => '<table class="row-list" style="table-layout:fixed;width:100%;">'
      + colgroup + head + '<tbody>'
      + list.map(r => this._rowHtml(strip(r), removable,
          selectable, !!checked[r.key], restorable, hideActions === true)).join('')
      + '</tbody></table>';

    /* ⛔ WHAT NEEDS THE OPERATOR COMES FIRST AND STAYS OPEN; WHAT BAR COP WORKED OUT COLLAPSES.
       On a 240-row first drop the thirteen rows needing a look ran from row 33 to row 240, so
       finding them meant reading the whole file, and the Add button sat below all 240. Collapsing
       the settled section fixes both, and it is what Add Products has always done.
       ⚠ `flat` is for a door whose rows are BOUNDED and ORDERED — the sales week is seven days read
       Monday to Sunday, and splitting it would be worse. That is a fact about the door, not a row
       count, so the door states it rather than the shell guessing a threshold. */
    let body;
    /* ⛔⛔ GROUPED BY WHERE THE ROW IS GOING (Kyle, 2026-08-04, walking the operating-expense screen):
       *"it's just clunky and not user friendly at all... seems like it might be better if it was
       setup like add products.. choose a category and move to."* He is right, and the reason is
       sharper than familiarity: THE SECTION IS THE CATEGORY, so the category lives in exactly ONE
       place. The screen he was looking at had it in three — a Category column, a per-row dropdown and
       a note telling him to pick one — and three copies of one fact cannot agree, which is why
       changing the dropdown made the row vanish into a collapsed section he could not see.
       Add Products has worked this way since before the rollout started and it was the pattern I
       failed to carry over ([[test-the-first-drop]] rule 4: copy the REASON, not just the shape).
       The door supplies the groups and the toolbar; this owns the frame, exactly as before. */
    if (opts.groups) {
      const gs = (opts.groups || []).filter(g => g && (g.rows || []).length);
      /* ⛔ A GROUP MAY SAY IT IS A REPORT, and then it drops the Remove BUTTON exactly as the
         automatic "Not Going In" section does. Money Out builds its own cards, so the split above
         never reaches it — but two of them hold rows that do not land ("Not Operating Expenses",
         "Not Going In") while the panel passes `removable: true` for the category groups, so both
         were offering the control that changes nothing. Kyle: *"the only action is to Remove them..
         but you don't need to do that because they don't get added."*
         ⚠ THE CELL STAYS AND SO DOES THE TICK BOX. The cell because the colgroup is built once for
         the table; the tick box because Move To is how a "Not Operating Expenses" row gets answered,
         and dropping it would take the one real control on that card. */
      body = gs.map((g, i) => this._section(g.title, g.sub,
        g.open ? table(g.rows, false, g.report === true) : '', !!g.open, i === 0, g.key)).join('');
      if (!body) body = '<div class="card" style="container-type:inline-size;">'
        + '<div style="overflow-x:auto;">' + table(rows) + '</div></div>';
    } else if (opts.flat) {
      body = '<div class="card" style="container-type:inline-size;">'
        + '<div style="overflow-x:auto;">' + table(shown) + '</div></div>';
    } else {
      /* ⛔⛔⛔ THE SPLIT IS BY WHETHER THERE IS SOMETHING TO DO, NOT BY WHETHER THE ROW LANDS.
         Kyle, 2026-08-08: *"what exactly is the point of the 'Needs a look' card? there is no action
         there other than 'remove'.. but the Needs a look are not included in the going in group
         anyway.. the 'need a type' or 'need to sort' groups make sense because you actually do
         something with those."* He is right, and the count backs it: measured across all ten
         converted screens, SIX have no decision control at all, so that section was 100% rows the
         operator could not act on.
         THE OLD RULE PUT THREE DIFFERENT THINGS UNDER ONE HEADING that says "check before you add":
           1. will not land, nothing to decide  -> no action exists. Remove is a no-op on it.
           2. IS going in, carrying a caution   -> worth reading before pressing ("No pay set: their
              shifts will cost $0" on a staff row that is about to import).
           3. a real decision                    -> Keep Mine / Use The File, Keep N / Use 0.
         Only 2 and 3 are a task. 1 is a REPORT, and it now looks like one.
         ⛔ THE ROWS STAY. A file of 83 lines that imports 72 has to account for the other 11 or the
         numbers stop reconciling, which is what makes an operator distrust the total. What changes is
         the heading it sits under and the control it no longer offers.
         ⚠ `decision` COUNTS AS AN ACTION EVEN THOUGH THE ROW DOES NOT LAND — a conflict awaiting an
         answer is the row that most needs the operator, which is why it is also the row the dim rule
         already exempts. */
      const actionable = r => !!(r.needsYou || r.decision) || (r.lands && (r.notes || []).length);
      const needs = shown.filter(r => actionable(r));
      const notGoing = shown.filter(r => !actionable(r) && !r.lands);
      const settled = shown.filter(r => !actionable(r) && r.lands);
      /* The door owns the state. "Needs a look" is open unless the operator closed it; "going in" is
         closed unless they opened it. A section that is closed builds no table at all, so a 2000-row
         group costs nothing until somebody asks for it. */
      const openMap = opts.open || {};
      const needsOpen = openMap.needs !== false;
      const settledOpen = !!openMap.settled;
      body = '';
      if (needs.length) {
        /* ⚠ THE SUB FOLLOWS THE BUTTON'S OWN VERB. It read "before you add" for every door, which was
           true while every door said Add — product mix says **Update**, and the section then told the
           operator to check rows "before you add" under a button that does not say add. Same class as
           the sales door's lead, which was pinned against the button's label for exactly this reason.
           ⚠ NO CHANGE FOR AN `Add` DOOR: the verb IS "Add" there, so the sentence is identical. */
        body += this._section(opts.needsLabel || 'Needs A Look',
          needs.length + ' row' + (needs.length === 1 ? '' : 's') + ' to check before you '
            + String(verb || 'Add').toLowerCase(),
          needsOpen ? table(needs) : '', needsOpen, true, 'needs');
      }
      if (settled.length) {
        /* ⛔ "BAR COP WORKED OUT" IS A CLAIM, AND IT IS NOT TRUE ON EVERY DOOR. On operating
           expenses the settled rows are the ones Bar Cop read perfectly and CANNOT tell you belong
           here at all: a bank register lists payroll, COGS, owner draws and transfers beside the
           rent, and that is the one fact the file does not carry. So the head said "64 Expenses Bar
           Cop worked out" directly under a lead saying "remove anything tracked elsewhere" — two
           things on screen disagreeing, with the 64 rows collapsed behind the one that says there is
           nothing to do. Measured on a real month: pressing Add without opening it books $122,586.03
           against a truth of $28,503.63.
           The section stays COLLAPSED, because the button below 200 rows of table is a measured
           defect of its own. What changes is that a door may say what is actually in there. */
        /* ⚠ A DOOR MAY NAME THIS SECTION. The fallback `verb === 'Add' ? 'Going In' : verb` was fine
           while every door said Add; the product-mix door says **Update**, and the head then rendered
           as the bare word "Update" sitting above "72 Items Bar Cop worked out" — a title that reads
           like a stray button. `settledLabel` lets the door say what the section IS ("Going In") while
           the button keeps its own verb, and the fallback is untouched for every existing door. */
        body += this._section(opts.settledLabel || (verb === 'Add' ? 'Going In' : verb),
          opts.settledSub
            ? settled.length + ' ' + (settled.length === 1 ? noun : (opts.nounPlural || noun + 's')) + ' ' + opts.settledSub
            : settled.length + ' ' + (settled.length === 1 ? noun : (opts.nounPlural || noun + 's')) + ' Bar Cop worked out',
          settledOpen ? table(settled) : '', settledOpen, !needs.length, 'settled');
      }
      /* ⛔ THE REPORT. Collapsed, after what IS going in, and carrying NO Remove — offering the one
         control that changes nothing is what made the old section read as a chore. Every row here
         already says why it was left out in its own What Happens cell, which is the whole content.
         ⚠ AFTER `settled`, NOT BEFORE: the button's number is about what is going in, so the section
         that explains it sits next to it, and the one that explains what is NOT comes after. Removed
         stays last, because those are rows the operator has already decided about. */
      if (notGoing.length) {
        const ngOpen = !!openMap.notgoing;
        body += this._section('Not Going In',
          notGoing.length + ' row' + (notGoing.length === 1 ? '' : 's') + ' Bar Cop left out, and why',
          ngOpen ? table(notGoing, false, true) : '', ngOpen, !needs.length && !settled.length, 'notgoing');
      }
      // A file with nothing in it at all still needs a table, or the screen is a lead and a button.
      if (!body) body = '<div class="card" style="container-type:inline-size;">'
        + '<div style="overflow-x:auto;">' + table(shown) + '</div></div>';
    }

    /* ⛔ LAST ON THE PAGE, AND COLLAPSED. It is the least important thing on a screen whose first
       drop already runs three screens tall, and every row in it is one the operator has already
       decided about. Putting it above the button would push the primary action further down for
       rows nobody is looking at — the measured defect the collapse exists to prevent, reintroduced
       from the other end. Collapsed, it costs one line when unused and nothing at all when empty. */
    if (removedRows.length) {
      const removedOpen = !!(opts.open || {}).removed;
      body += this._section('Removed',
        removedRows.length + ' row' + (removedRows.length === 1 ? '' : 's') + ' you took out',
        removedOpen ? table(removedRows, true) : '', removedOpen, false, 'removed');
    }

      /* ⚠ `card-title`, WHICH IS WHAT THE REFERENCE USES AND WHAT CARRIES THE RULE UNDER IT (Kyle,
         2026-08-04: *"operating expenses still doesn't match add products... needs the divider
         line"*). It was a hand-rolled span at a different size, weight and letter-spacing, so every
         confirm screen in the rollout read as a near-miss of the door they were copied from.
         ⚠ BLAST RADIUS, STATED: this is the shared shell, so vendors, staff, menu items and
         sales-by-day all gain the same rule. That is the point of the shell — the alternative is one
         door matching Add Products and four not. */
    return (opts.label ? '<div class="card-title">' + esc(opts.label) + '</div>' : '')
      + (opts.lead ? '<div style="font-size:13.5px;color:var(--t2);line-height:1.55;margin:0 0 18px;">' + esc(opts.lead) + '</div>' : '')
      /* ⛔ THE CARD IS LOAD-BEARING, NOT DECORATION. `.row-list tbody td` is
         #0D181E and a cockpit step workspace is #0D181E too, so a bare table
         paints its row fill invisibly against its own container and the rows read
         as loose text. Measured on the live build. Inside a `.card` (#08131A) the
         fill lands exactly as it does on the Inventory product list. */
      + (universal.length
          /* ⛔ A NOTE CARRIED BY EVERY LANDING ROW IS A FACT ABOUT THE FILE, NOT ABOUT A ROW, and
             repeating it once per row buries the notes that ARE exceptions. Measured on a real first
             drop: 77 of 80 staff rows said "Position not on your list" because the operator had not
             set up positions yet, and the eleven rows that also said "No pay set" were lost in it.
             ⚠ EVERY, not "most". A threshold would be a number fitted to whichever file I happened
             to be holding; "all of them" is structural and needs no number. */
          ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px;">All '
            + n + ' of these: ' + universal.map(esc).join(' &middot; ') + '</div>'
          : '')
      // The door's own controls for the grouped mode (a category picker and Move To). HTML the door
      // has already built and escaped, sitting above the sections it acts on.
      + (opts.toolbar || '')
      + body
      /* ⛔ ALWAYS RENDER THE RESULT SLOT. A refused write reports into it, and a
         message with nowhere to render is the worst outcome an import has: the
         operator sees a clean page and no error at all. */
      + '<div id="' + esc(opts.resultId || 'import-confirm-res') + '"></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      /* ⚠ NORMAL-HEIGHT BUTTONS, NOT `btn-sm` (Kyle, 2026-08-06, walking the import review): *"the
         'Add expenses' and start over button are not the normal button height.. so they need to
         have a little more height."* `btn-sm` is 5px/10px against `.btn`'s 8px/11px, so the one
         press that commits an import read as a secondary control.
         ⛔ BLAST RADIUS, STATED: this is the shared shell, so it moves the confirm pair on ALL SIX
         import doors. That is the intent — they were never meant to differ from each other or from
         every other primary action in the app. */
      +   '<button class="btn btn-primary" ' + (opts.goAttr || 'data-confirm-go') + '="1"'
      +     (n && !busy ? '' : ' disabled') + '>'
      +     (busy ? (opts.busyLabel || (verb + 'ing...')) : this.goLabel(opts))
      +   '</button>'
      /* ⚠ THE BACK BUTTON IS DISABLED MID-WRITE TOO. It restarts the import, and a
         restart during the write is how a screen ends up describing a record that
         is no longer the one being written. */
      +   '<button class="btn btn-ghost" ' + (opts.backAttr || 'data-confirm-back') + '="1"'
      +     (busy ? ' disabled' : '') + '>' + esc(opts.backLabel || 'Start Over') + '</button>'
      + '</div>';
  }
};

if (typeof window !== 'undefined') window.ImportConfirm = ImportConfirm;
