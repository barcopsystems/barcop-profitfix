'use strict';

/* ── Inventory Control — Take Inventory (writes ic_counts) ────────────────────
   Count types: Full / Bar Only / Kitchen Only / Custom. Products are counted
   with the bottle slider, grouped and stepped through by location. The working
   count auto-saves to localStorage so it survives a reload and can be resumed.
   On submit a finalized count record is written to App.inventoryData.ic_counts. */

S.InventoryTakeInventory = {
  draft: null,
  locStep: 0,
  DRAFT_KEY: 'ic_count_draft',
  get BAR_CATS() { return App.BAR_CATS; },         // single source on App
  get KITCHEN_CATS() { return App.KITCHEN_CATS; },

  products() {
    const all = (App.inventoryData && App.inventoryData.ic_products) || [];
    return all.filter(p => p.active !== false);
  },
  // How a Food/Misc product is counted: an explicit count_style wins; otherwise a
  // pack item defaults to loose (full+loose), everything else to a typed number.
  _countStyle(p) {
    return App.countStyle(p);
  },

  counts() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_counts)) App.inventoryData.ic_counts = [];
    return App.inventoryData.ic_counts;
  },

  loadDraft() {
    try { const r = localStorage.getItem(this.DRAFT_KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  },
  saveDraft() {
    if (!this.draft) return;
    try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {}
  },
  clearDraft() {
    try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {}
    this.draft = null;
  },

  // Reset the content scroll to the top. Each view re-renders in place, so
  // without this, arriving from a bottom button (Review Count, Next Location,
  // Submit) would leave the user scrolled to the bottom of the new page.
  scrollTop() {
    const s = this.container && (this.container.closest('.content') || document.querySelector('.content'));
    if (s) s.scrollTop = 0;
  },

  ago(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'recently';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + ' hr ago';
    const days = Math.floor(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    /* ⚠⚠ STAMPED AT RENDER TIME, WHICH IS THE WHOLE POINT OF THE TOKEN. `App._mountSeq` answers "am
       I still the screen on the page?" and app.js says a screen that writes in the background MUST
       capture it HERE and compare before repainting. `submit()` captured it inside itself for one
       round, which is after `await App.confirm` — so the operator pressing browser Back while the
       impact dialog was up (popstate is not gated on an open dialog, and the overlay outlives the
       navigation because it hangs off `document.body`) bumped the token BEFORE the capture, and the
       check then read "still here" about a screen that was gone. It marked the Inventory
       Dashboard's wrapper inert and painted "Count Submitted" over it. Capturing late does not
       merely weaken the check; it makes it lie in the one direction that does damage.
       ⚠ Only `App.navigate` / `openHubFullPage` / the crash handler bump the token, so the screen's
       own internal re-renders (setup → counting → review → done) keep the same stamp, which is what
       makes it usable as "this mount" rather than "this paint". */
    this._mountedAt = App._mountSeq;
    actions.innerHTML = '';
    /* One-shot handoff from Count History's Edit button (S250). Consumed immediately, like every
       other cross-screen jump in the app, so a later visit does not silently reopen the count. */
    const pendEdit = App._pendingCountEdit;
    let switchAsk = null;
    if (pendEdit) {
      App._pendingCountEdit = null;
      /* ⚠ ONLY RETURN IF THE EDIT ACTUALLY OPENED (S312). This returned unconditionally, so a
         refusal (record gone, or a confirmed week now covering it) left a BLANK screen.
         ⚠⚠ AND SAY SO. Falling through silently was the first fix and it is not enough: `this.draft`
         is a singleton that survives navigation, so the fall-through can render an UNRELATED count
         that is still in progress — which looks exactly like the edit having worked. An operator who
         clicked Edit on last week's count could then submit against the draft's own `_edit_id` and
         correct a count they never opened. A blank screen at least reads as broken; this reads as
         fine. The refusal has to be visible. */
      /* ⚠ THREE OUTCOMES NOW, NOT TWO (S321). 'busy' means a count is in progress and opening this
         one would destroy it — a question, not a dead end, so it must not get 'gone''s apology. */
      const res = this.editCount(pendEdit);
      if (res === 'opened') return;
      if (res === 'busy') switchAsk = pendEdit;
      else this._countGoneNotice();
    }
    if (this.draft && this.draft._view) this.route();
    else this.renderSetup();
    /* ⚠ AFTER the render, deliberately. The prompt asks the operator to give up the count they are
       in the middle of, so they have to be able to SEE it — asking over a blank or stale screen is
       asking them to answer blind. render() stays synchronous; only the question is deferred. */
    if (switchAsk) this._confirmSwitchCount(switchAsk);
  },

  showHowTo() {
    App.showHelpModal('How the Inventory Count Works', [
      { p: ['An inventory count is a snapshot of everything you have on hand right now, priced out so Bar Cop can tell you what you used, what to reorder, and where you are leaking. Count the same way every time and the numbers stay honest.'] },
      { h: 'What You Are Counting', p: ['Bar Cop walks you through your products one location at a time. Go shelf by shelf and enter what is physically there. Anything you do not touch is tagged Not Counted and keeps its last count, so a partial count never wipes your numbers. If a product is truly empty, tap Out of Stock to record a real zero.'] },
      { h: 'Pick Your Locations', p: ['Set the date and who is counting up top, then pick where. Most operators count one location at a time and come back for the rest later. Pick a single location for a quick section count, or pick several to run a full inventory in one session. You count and finalize each location\'s products together. Hit Worksheet to print a blank count sheet in your shelf order, so you can pencil in full and open on the floor before you key the numbers in.'] },
      { h: 'How To Enter Each Product', p: [
        'Liquor, wine, and bottled mixers use the fill slider. Set the number of full bottles, then drag the slider to the level of the open bottle. Draft beer uses the same slider shaped like a keg.',
        'Bottle beer is counted by the case. Enter full cases and any loose bottles, and Bar Cop shows the running total in cases as you type.',
        'Food and dry goods use a plain number in the product\'s own unit, like pounds, cases, or each.'
      ] },
      { h: 'It Saves As You Go', p: ['Your count saves to this device automatically. If you close the tab or lose signal partway through, come back and pick up where you left off. Nothing is final until you submit.'] },
      { h: 'Review And Submit', p: ['When you reach the end, Bar Cop shows a review of every product, its total, and its value, and flags anything you did not count. Go back and fix anything that looks off, then submit. Submitting writes a finalized count that you cannot change by accident.'] },
      { h: 'What The Count Feeds', p: ['Every finalized count powers your dashboard, the usage and variance reports, dynamic par suggestions, and your cost of goods. Two counts let Bar Cop measure what you used between them, so count on a regular schedule, like every week, to keep the numbers sharp.'] }
    ]);
  },

  route() {
    if (!this.draft) { this.renderSetup(); return; }
    if (this.draft._view === 'review') this.renderReview();
    else this.renderCounting();
  },

  // Print a blank count sheet: every active product grouped by location in the
  // same shelf order as the count, with columns to pencil in Full + Open before
  // entering the counts in Bar Cop.
  printBlank() {
    const order = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived).map(l => l.name);
    const byLoc = {};
    this.products().forEach(p => {
      let plocs = App.productLocations(p);
      if (!plocs || !plocs.length) plocs = [p.primary_location || 'Unassigned'];
      plocs.forEach(loc => { (byLoc[loc] = byLoc[loc] || []).push(p); });
    });
    const seq = (loc, p) => (p.location_sequences && p.location_sequences[loc] != null) ? p.location_sequences[loc] : Number.MAX_SAFE_INTEGER;
    const locNames = [...order.filter(l => byLoc[l]), ...Object.keys(byLoc).filter(l => !order.includes(l)).sort()];
    const rows = [];
    locNames.forEach(loc => {
      byLoc[loc].slice()
        .sort((a, b) => { const d = seq(loc, a) - seq(loc, b); return d !== 0 ? d : (a.name || '').localeCompare(b.name || ''); })
        .forEach(p => rows.push([loc, p.name, '', '']));
    });
    if (!rows.length) return;
    App.printBlankSheet({
      title: 'Inventory Count Sheet',
      subtitle: 'Count each location shelf by shelf. Write the number of full units, then the open or partial amount, and enter the counts in Bar Cop after.',
      columns: [
        { label: 'Location', width: '22%' },
        { label: 'Product',  width: '44%' },
        { label: 'Full',     width: '17%' },
        { label: 'Open',     width: '17%' }
      ],
      bodyRows: rows
    });
  },

  // ── Setup ─────────────────────────────────────────────────────────────────
  renderSetup() {
    const prods = this.products();
    if (prods.length === 0) {
      App.setupCard(this.container, {
        title: 'Take Your First Count',
        lead: 'A count is the backbone of Inventory Control. It sets your stock value and feeds usage, variance, and your reorder list. Add your products and you can count.',
        steps: [
          { title: 'Add your products', desc: 'Add the products you stock so there is something to count.', btn: 'Add Products', screen: 'ic-product-setup', done: prods.length > 0 }
        ]
      });
      return;
    }

    const saved = this.loadDraft();
    const resumeBar = saved
      ? '<div class="alert-bar" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
        /* ⚠ AN EDIT IS NOT "A COUNT IN PROGRESS" (S330c). `editCount` seeds the draft's
           `started_at` from the ORIGINAL record's `created_at`, so an edit draft rendered here as
           "A Full count started 5 hr ago is in progress" — the age and the type of the count being
           CORRECTED, describing an activity the operator is not doing. And "Start Over" on an edit
           sounds like it discards the submitted count, which it never touches. Reaching this state
           at all is now rare (Save & Exit commits an edit), but a browser closed mid-edit still
           lands here and it has to read true. */
        + '<div class="alert-text">' + (saved._edit_id
            ? 'You are part-way through editing the ' + esc(saved.type) + ' count from '
              + esc(this._dayLabel(saved._edit_date)) + '. Your changes are not saved to it yet.'
            : 'A ' + esc(saved.type) + ' count started ' + this.ago(saved.started_at) + ' is in progress.') + '</div>'
        + '<div style="display:flex;gap:8px;">'
          + '<button class="btn btn-ghost btn-sm" id="ti-resume">' + (saved._edit_id ? 'Resume Editing' : 'Resume Count') + '</button>'
          + '<button class="btn btn-ghost btn-sm" id="ti-discard">' + (saved._edit_id ? 'Discard Changes' : 'Start Over') + '</button>'
        + '</div></div>'
      : '';

    const locs = ((App.inventoryData && App.inventoryData.ic_locations) || []).filter(l => !l.archived);

    const countedByRow = '<div class="form-row" style="gap:16px;margin-top:16px;">'
      + '<div class="f w-md"><label>Counted By</label>'
      + '<select id="ti-by">' + App.staffOptions(App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div></div>';

    let body, startAction = '';
    if (locs.length === 0) {
      body = '<div class="card"><div class="empty" style="margin:0;"><div class="empty-title">No locations set up yet</div>'
        + '<div class="empty-sub">Add storage locations in the Locations screen first. Inventory counts are organized by location.</div>'
        + '<button class="btn btn-primary" id="ti-go-locs">Go to Locations</button></div></div>';
    } else {
      const tiles = locs.map(l => {
        const productCount = this.products().filter(p => App.productLocations(p).includes(l.name)).length;
        return '<button type="button" class="ti-loc-tile" data-loc="' + esc(l.name) + '" style="text-align:left;display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:8px;border:1px solid var(--b2);background:#0D181E;cursor:pointer;transition:background .12s,border-color .12s;">'
          + '<span class="ti-loc-ck" style="width:20px;height:20px;border-radius:50%;flex-shrink:0;border:1px solid var(--t3);display:flex;align-items:center;justify-content:center;font-size:11px;color:transparent;">&#10003;</span>'
          + '<span style="flex:1;min-width:0;">'
            + '<span style="display:block;font-size:13px;font-weight:700;color:var(--t1);">' + esc(l.name) + '</span>'
            + '<span style="display:block;font-size:11px;color:var(--t3);margin-top:1px;">' + productCount + ' product' + (productCount === 1 ? '' : 's') + '</span>'
          + '</span></button>';
      }).join('');
      const head = '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Pick the locations to count.</div>';
      body = head + '<div class="ti-loc-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;">' + tiles + '</div>' + countedByRow;
      startAction = '<div style="margin:16px 0 0;display:flex;align-items:center;gap:8px;"><button class="btn btn-primary" id="ti-start">Start Count</button>'
        + '<span id="ti-err" style="color:var(--red);font-size:12px;display:none;"></span></div>';
    }

    this.container.innerHTML = '<div class="screen">' + resumeBar
      + '<div class="card form-card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Start an Inventory Count</span>'
      + (locs.length ? '<button class="btn btn-ghost btn-sm no-print" id="ti-print-blank">Worksheet</button>' : '')
      + '</div>'
      + body
      + '</div>'
      + startAction
      + '</div>';

    this.container.onclick = ev => {
      const tile = ev.target.closest('.ti-loc-tile');
      if (tile) { this.toggleLocTile(tile); return; }
      if (ev.target.closest('#ti-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#ti-go-locs')) { App.navigate('ic-locations'); return; }
      if (ev.target.closest('#ti-discard')) { this.confirmDiscardDraft(); return; }
      if (ev.target.closest('#ti-start'))   { this.startCount(); return; }
      if (ev.target.closest('#ti-resume')) {
        this.draft = this.loadDraft();
        if (this.draft) {
          if (!this.draft._view) this.draft._view = 'counting';
          this.locStep = this.draft._locStep || 0;
          this.route();
        }
        return;
      }
    };
    this.scrollTop();
  },

  // Toggle one location tile's selected look (gold-tint fill + checkmark).
  toggleLocTile(tile) {
    const on = !tile.classList.contains('selected');
    tile.classList.toggle('selected', on);
    tile.style.background = on ? '#1E2B34' : '#0D181E';
    tile.style.borderColor = on ? 'var(--gold-tint-bord)' : 'var(--b2)';
    const ck = tile.querySelector('.ti-loc-ck');
    if (ck) {
      ck.style.color = on ? 'var(--bg)' : 'transparent';
      ck.style.background = on ? 'var(--green)' : 'transparent';
      ck.style.borderColor = on ? 'var(--green)' : 'var(--t3)';
    }
  },

  /* ⚠⚠ SAVE & EXIT MEANS TWO DIFFERENT THINGS, AND IT USED TO DO ONLY ONE (S330c).
     On a NEW count a draft is the whole point: you are forty products into Main Bar, you get pulled
     away, you come back. On an EDIT the record ALREADY EXISTS, so there is nothing to defer — and
     saving a draft instead created a second, invisible version of a submitted count: the saved
     record said one thing, the unsaved edit another, and nothing on screen said which you were
     looking at. The operator pressed a button reading "Save & Exit", landed on a red
     "count in progress" banner, and their correction had NOT been applied.
     Every other edit form in the app (products, vendors, registers) commits on Save; this screen
     was the outlier only because it is a wizard. So on an edit this SAVES — same id, same business
     date, same created_at, edit_count bumped, exactly as the review-screen button does.
     ⚠ `submit()` owns the write, the failure message and the confirmation screen, so this delegates
     rather than repeating any of it — a second write path is how the two would drift ([[the-loop]]
     step 0.6). It also means a REFUSED write keeps the draft, which is the behaviour that matters:
     the correction is not lost because the server said no. */
  async _exitCount() {
    if (this.draft && this.draft._edit_id) { await this.submit(); return; }
    this.saveDraft();
    this.draft = null;
    this.renderSetup();
    this.scrollTop();
  },

  // Discard the in-progress draft. Confirmation because losing count data
  // part-way through is destructive. Standard App.confirm box (discard-draft is
  // a non-delete prompt, so it uses confirm, not confirmDelete).
  /* A business date as "Jul 30". This screen had no date formatter of its own — the edit banner
     needs one and inventing a second copy of the app's is how they drift, so it is one helper here
     and nothing else formats a date on this screen. */
  _dayLabel(ymd) {
    const d = new Date(String(ymd || '') + 'T00:00:00');
    return isNaN(d.getTime()) ? String(ymd || '')
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  async confirmDiscardDraft() {
    /* ⚠ ON AN EDIT THIS DISCARDS THE CHANGES, NOT THE COUNT (S330c). "Start over on this count?"
       reads, on an edit, as an offer to wipe the submitted count — which it never touches. Say
       which of the two things is going away. */
    /* ⚠ `this.draft` IS NULL AT ONE OF THE TWO ENTRY POINTS. This is reached from the counting
       screen (draft live) AND from the setup banner (draft null — it was cleared on exit and only
       the saved copy remains). Reading `this.draft` alone would have made the banner's
       "Discard Changes" button raise a prompt headed "Start over on this count?" — the button and
       the box disagreeing about what is about to happen. Ask the thing that is actually going to be
       cleared. */
    /* ⚠⚠ NOT WHILE A SAVE IS IN FLIGHT. Disabling the save buttons left this one live, and it is
       the destructive twin: `clearDraft()` wipes the correction from memory AND the device while
       `putRecord` is still out. Whichever way that write lands the operator is lied to — a success
       paints "Changes Saved" over a setup screen for a record they just discarded, and a failure
       says "Your numbers are still here, nothing has been lost" about numbers that are gone. */
    if (this._writing) { await this._stillSavingNotice(); return; }
    const d = this.draft || this.loadDraft();
    const editing = !!(d && d._edit_id);
    const ok = await App.confirm({
      title: editing ? 'Discard your changes?' : 'Start over on this count?',
      message: editing
        ? 'The count goes back to exactly what was saved before you opened it. Nothing you had entered here is kept.'
        : 'Any counts you have entered so far will be lost. The product master and your last finalized count stay untouched.',
      confirmText: editing ? 'Discard Changes' : 'Start Over',
      cancelText: editing ? 'Keep Editing' : 'Keep Counting'
    });
    if (!ok) return;
    this.clearDraft();
    this.renderSetup();
  },

  async startCount() {
    const err = document.getElementById('ti-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const picked = [...this.container.querySelectorAll('.ti-loc-tile.selected')].map(t => t.dataset.loc);
    if (picked.length === 0) { fail('Pick at least one location to count.'); return; }
    /* ⚠⚠ TELL THEM BEFORE THEY COUNT, NOT AFTER (S330b — Kyle, and he was right).
       The duplicate guard shipped on the SUBMIT handler, which is the last possible moment: the
       operator picked Kitchen Line, counted every product on it, pressed Submit, and only THEN
       learned the day was already covered by a Full count. Worse, the way out was Count History →
       Edit, which raises the in-progress-draft prompt (S321) and DISCARDS everything they just
       typed. On a forty-product section that is a genuinely infuriating loop, and every step of it
       was mine. **A check that can run before the work must run before the work.**
       Here nothing has been entered yet, so "open that count instead" costs the operator nothing —
       it is the sanctioned path (S250) arriving at the only moment it is free.
       ⚠ The submit-time guard STAYS as the backstop — a count begun before the other one existed,
       or on a second device, still has to be caught — but it now MERGES BY LOCATION instead of
       refusing, so it can never again cost anyone their work.
       ⭐ S331 REMOVED THE SPECIAL CASE THAT USED TO SIT HERE. A prior count inside a confirmed week
       got a plain notice and no offer, for one stated reason: *"editCount would refuse it anyway,
       and dangling a button that cannot work is worse than not offering one."* That premise is
       gone — `editCount` opens a booked count now and `submit()` prices the change for the operator
       — so the notice had become a dead end telling them to "count this one tomorrow" about a
       correction they can simply make. One offer, one path, whether the week is closed or not
       ([[the-loop]] #65: when a limitation pushes you somewhere obviously worse, go and check
       whether the limitation is still true). */
    const sameDay = App.todayLocal();
    const pickedSet = new Set(picked);
    const prior = this.counts().find(c => c
      && String(c.date || '').slice(0, 10) === sameDay
      && (Array.isArray(c.locations) ? c.locations : []).some(l => pickedSet.has(l)));
    if (prior) {
      const overlap = (prior.locations || []).filter(l => pickedSet.has(l));
      const nameList = a => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
      const openIt = await App.confirm({
        title: 'You already counted ' + nameList(overlap) + ' today',
        message: 'Bar Cop keeps one count per location per day, because two counts of the same shelf on one day cannot '
          + 'be used as a usage pair. Open that count and correct it instead of starting a new one?',
        confirmText: 'Open That Count', cancelText: 'Cancel'
      });
      if (!openIt) return;
      /* no draft exists yet, so nothing can be lost — go straight in.
         ⚠ AND LAND ON THE LOCATION THE PROMPT JUST NAMED. Without `atLocation` this opened at step 0
         of the existing count, which on a Full count is a different shelf entirely and 130-odd
         products away from the one they asked about. */
      if (this.editCount(prior.id, { atLocation: overlap[0] }) !== 'opened') this._countGoneNotice();
      return;
    }

    // "type" is now derived: a single location uses the location name; more
    // than one is labeled "Multi-Location". The full set of picked locations
    // is preserved on the draft and the saved count record.
    const allLocs = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived).map(l => l.name);
    const isFull = picked.length === allLocs.length && allLocs.length > 0;
    const type = isFull ? 'Full' : (picked.length === 1 ? picked[0] : 'Multi-Location');

    const counterId = document.getElementById('ti-by')?.value || '';
    const counterName = (App.staffById(counterId) || {}).name || '';
    this.draft = {
      type,
      custom_locations: picked,
      counted_by_id: counterId,
      counted_by: counterName,
      counts: {},
      started_at: new Date().toISOString(),
      _view: 'counting',
      _locStep: 0
    };
    this.locStep = 0;
    this.saveDraft();
    this.renderCounting();
  },

  // ── Counting ──────────────────────────────────────────────────────────────
  /* ── S250: RE-OPEN A SUBMITTED COUNT FOR CORRECTION ────────────────────────────────────
     Kyle: "I inventory a location and submit it, then realize I missed a couple of bottles. How
     do I add those?" Until now: you could not. There was no edit, only Delete, on a record that
     feeds cost of goods -- and an ADJUSTMENT is not a substitute, because computeUsagePair reads
     only the two counts and the deliveries, so one would record a note and correct nothing.

     ⚠ THE ZERO-VS-ABSENT RULE IS PRESERVED EXACTLY, and it is the whole reason this is careful.
     `_hasCount` tests `!= null`, NOT truthiness, so a genuine zero is a COUNT while a missing
     field is a skip. Rebuilding a skipped product as `{fulls:0}` would silently promote every
     shelf the operator deliberately passed over into a counted zero -- which is exactly what
     `computeUsagePair`'s `counted === false` filter exists to prevent, and it would bill the whole
     shelf as used. So a skipped item is rebuilt with NO numeric fields at all. */
  /* ⚠ RETURNS FALSE INSTEAD OF JUST RETURNING (S312). Both refusals below are reachable from a
     STALE Edit button: Count History decides whether to draw it at render time, and the record can
     be deleted, or a week covering it confirmed, while that list is still on screen. `render()`
     called this and then returned unconditionally, so a refusal left `content-area` EMPTY — no
     form, no error, nothing at all. The caller now falls through to the normal view instead. */
  /* ⚠⚠ S321 — RETURNS A STATUS, NOT A BOOLEAN: 'opened' | 'gone' | 'busy'.
     Two refusals now exist and they need OPPOSITE handling — 'gone' is a dead end that gets an
     apology, 'busy' is a question the operator can answer. A boolean could only say "not opened",
     and folding them together would have shown "that count could not be opened" about a count that
     opens perfectly well. Only `render()` calls this. */
  editCount(id, opts) {
    opts = opts || {};
    const rec = this.counts().find(c => c.id === id);
    if (!rec) return 'gone';
    /* ⭐ S331 — NO WEEK-LOCK REFUSAL HERE ANY MORE. This used to read
       `if (App.countLockedByWeek(rec)) return 'gone';` as the belt-and-braces twin of the hidden
       Edit button. Both halves went together: the button is back on a booked row, so a refusal here
       would render a control that silently does nothing. The protection did not disappear, it MOVED
       to where it can show its work — `submit()` asks `ConfirmWeek.cogsImpact` what the correction
       does to every confirmed week and names each one with real before/after figures before
       anything is written. */
    /* ⚠⚠ NEVER OVERWRITE A COUNT IN PROGRESS WITHOUT ASKING (S321). This assigned `this.draft` and
       called `saveDraft()` unconditionally — and `saveDraft` writes the SAME `ic_count_draft` key,
       so a bartender forty bottles into the Back Bar who stepped over to Count History and clicked
       Edit on last week's count lost the live count from MEMORY AND FROM THE DEVICE, with no prompt
       and no undo. Closing the tab did not get it back either.
       The screen already owned the right words and did not use them here: `confirmDiscardDraft`
       says "Any counts you have entered so far will be lost", written because losing part-way
       through a count is destructive. One destructive path asked and its twin did not. */
    if (!opts.force && this._draftAtRisk(id)) return 'busy';

    const counts = {};
    (rec.items || []).forEach(it => {
      if (!it || !it.product_id) return;
      const key = it.product_id + '@@' + (it.location || 'Unassigned');
      const e = { notes: it.notes || '' };
      if (it.counted !== false) {              // a counted line keeps every number, zeros included
        if (it.cases != null || it.loose != null) { e.cases = it.cases || 0; e.loose = it.loose || 0; }
        if (it.fulls != null)   e.fulls = it.fulls;
        if (it.partial != null) e.value = it.partial;
        if (e.fulls == null && e.value == null && e.cases == null) e.value = it.total || 0;
      }
      counts[key] = e;
    });

    this.draft = {
      type:            rec.type,
      custom_locations: (rec.locations || []).slice(),
      counted_by_id:   rec.counted_by_id || '',
      counted_by:      rec.counted_by || '',
      counts,
      started_at:      rec.created_at,
      _view:           'counting',
      _locStep:        0,
      /* Correcting a count must UPDATE it, never mint a second one dated today -- two counts on
         one day would become a usage pair spanning zero days and poison the very COGS this is
         protecting. Same id, same business date, same created_at. */
      _edit_id:        rec.id,
      _edit_date:      rec.date,
      _edit_created_at: rec.created_at,
      _edit_count:     (rec.edit_count || 0) + 1
    };
    /* ⚠⚠ OPEN AT THE LOCATION THEY ASKED ABOUT (found by walking the live app, 2026-07-31).
       S330b's offer is *"You already counted Kitchen Line today. Open that count and correct it
       instead of starting a new one?"* — and it then dropped the operator on **Back Bar**, step 0
       of 5, because this always set `_locStep: 0`. On the seed's Full count that is 133 products
       and three presses of Next Location, with nothing on screen saying where Kitchen Line is. The
       prompt names a location; the screen has to land on it. Same defect class as S330b itself:
       the guard was right and the follow-through sent them somewhere useless.
       ⚠ Falls back to step 0 when the caller names nothing, or names a location this count has no
       products in — a step index that does not exist would render an empty shelf. */
    this.locStep = 0;
    if (opts.atLocation) {
      const at = this.groups().findIndex(g => g && g.location === opts.atLocation);
      if (at > 0) { this.draft._locStep = at; this.locStep = at; }
    }
    this.saveDraft();
    this.renderCounting();
    return 'opened';
  },

  /* True when opening count `id` would destroy work that exists nowhere else.
     ⚠ NOT simply "is there a draft". Two cases are deliberately silent, because a prompt raised
     when nothing is at stake is its own defect and teaches the operator to click through:
       · a count just STARTED and nothing entered yet (`counts` is {}) — nothing to lose;
       · the draft is already a correction of THIS SAME count — re-opening it loses nothing.
     `counts` is keyed per product as the operator enters each one, so its size is the honest
     measure of "work done". A reopened count arrives with its saved numbers already in `counts`,
     so an in-progress CORRECTION is protected by the same test. */
  _draftAtRisk(id) {
    const d = this.draft;
    if (!d) return false;
    if (d._edit_id && d._edit_id === id) return false;
    return Object.keys(d.counts || {}).length > 0;
  },

  /* One wording for "this count is not openable", used by both routes into it, so the two cannot
     drift apart ([[the-loop]] step 0.6).
     ⭐ S331 narrowed what this can mean. It used to say "or the week it falls in has since been
     confirmed" — true when a booked count was refused, and a false claim the moment Edit started
     opening one. A confirmed week is no longer a reason a count will not open, so the only cause
     left is that the record is genuinely gone ([[the-loop]] #79: reuse a message and every word in
     it becomes a claim about which case you are in). */
  /* ONE wording for "a write is in flight", used by both doors that must refuse during it — Save
     (which would start a second write) and Discard (which would wipe the draft out from under it).
     Two copies would drift ([[the-loop]] step 0.6). */
  /* ONE switch instead of a list of controls — and it took two goes to get the switch right.
     ⚠⚠ THE FIRST VERSION WAS `this.container.style.pointerEvents = 'none'` AND IT WAS WRONG TWICE.
     **(1) `pointer-events` is pointer hit-testing and nothing else.** It does not blur the focused
     element, does not leave the tab order, and does not block `keydown` / `input` / `change` or the
     synthetic click a focused button dispatches on Enter. The bottle slider's root carries
     `tabindex="0"` and its own ArrowUp/ArrowDown handler, and every numeric cell still took typing —
     so the exact silent loss it was added to close stayed reachable from the keyboard, and worse,
     Tab + Enter on **Back to Counting** repainted the whole sheet with live listeners while the
     write was still out. **(2) `#content-area` is PERMANENT and SHARED** — app.js says so in as
     many words — and `App.navigate` resets `onclick`/`onchange`/`oninput` and scroll, never inline
     style. So a write that never settles (there is no timeout on the Supabase upsert) left
     `pointer-events:none` on the one element every screen renders into: Dashboard, Order Sheet,
     Cash Control, all dead, nav still working, nothing on screen saying why. **A fix that bricks
     the app on a dropped connection is worse than the bug it closed.**
     ⭐ BOTH GO AWAY BY MOVING THE FLAG ONTO THE PER-RENDER `.screen` WRAPPER AND USING `inert`:
     `inert` blocks pointer, keyboard, focus and click together, which is the mechanism the name
     always claimed; and the wrapper is destroyed by the next `innerHTML` write, so a stalled write
     can only ever leave THIS screen inert until the operator navigates away. `pointerEvents` rides
     along as the fallback for a browser without `inert`, on the same short-lived node.
     ⚠⚠ THAT DESTRUCTION CUTS BOTH WAYS AND `submit()` HANDLES THE OTHER EDGE, NOT THIS METHOD.
     Navigating away destroys the wrapper, which is what keeps a stalled write from bricking the
     app — and it is also the one route this guard cannot cover, because the nav rail and top bar
     are siblings of the mount host rather than children of it. Coming back re-renders a live sheet
     with no inert flag. `submit()` closes that with `App._mountSeq` (the app's documented answer to
     "am I still the screen on the page?"); do not read this method as covering it.
     ⚠ `App.confirm` appends its overlay to `document.body`, so the impact popup and the refusal
     notices are outside this entirely — pinned as a control. */
  _setScreenInert(on) {
    const el = this.container && this.container.firstElementChild;
    if (!el) return;
    el.inert = !!on;
    el.style.pointerEvents = on ? 'none' : '';
  },

  /* Fill the done screen's note slot after the fact. ⚠ Silent when the slot is gone: the operator
     may have pressed "Take Another Count" while the week writes were still out, and painting a
     warning into a screen they have left is worse than not painting it. */
  _setDoneNote(text) {
    const el = document.getElementById('ti-done-note');
    if (!el || !text) return;
    el.textContent = text;
    el.style.display = '';
  },

  _stillSavingNotice() {
    return App.confirm({
      title: 'Still saving',
      message: 'Bar Cop is writing this count now. Give it a second and it will tell you when it is done.',
      confirmText: 'OK', cancelText: ''
    });
  },

  _countGoneNotice() {
    App.confirm({
      title: 'That count could not be opened',
      message: 'It looks like it has been removed. Take Inventory has your other counts; open Count History to see what is still there.',
      confirmText: 'OK', cancelText: ''
    });
  },

  /* The 'busy' answer. Raised AFTER the normal render, so the operator is looking at the count
     they are in the middle of while being asked about it. Cancel touches nothing at all. */
  async _confirmSwitchCount(id) {
    const ok = await App.confirm({
      title: 'You have a count in progress',
      message: 'Opening that count to correct it will discard the one you are in the middle of. Any counts you have entered so far will be lost. The product master and your last finalized count stay untouched.',
      confirmText: 'Discard and Open',
      cancelText: 'Keep Counting'
    });
    if (!ok) return;
    if (this.editCount(id, { force: true }) !== 'opened') this._countGoneNotice();
  },

  // Products to count = active products whose primary_location is one of
  // the picked locations on the draft. Backward compat: old draft types
  // ('Full' / 'Bar Only' / 'Kitchen Only' without custom_locations) still
  // resolve so a resumed pre-rebuild draft does not break.
  countProducts() {
    const all = this.products();
    const locs = this.draft.custom_locations || [];
    if (locs.length > 0) {
      return all.filter(p => App.productLocations(p).some(l => locs.includes(l)));
    }
    // Legacy fallbacks for drafts created before the rebuild.
    const t = this.draft.type;
    if (t === 'Bar Only')     return all.filter(p => this.BAR_CATS.includes(p.category));
    if (t === 'Kitchen Only') return all.filter(p => this.KITCHEN_CATS.includes(p.category));
    return all;
  },

  groups() {
    const prods = this.countProducts();
    const order = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived).map(l => l.name);
    const byLoc = {};
    const picked = this.draft.custom_locations || [];
    prods.forEach(p => {
      let plocs = App.productLocations(p);
      if (picked.length) plocs = plocs.filter(l => picked.includes(l));
      if (!plocs.length) plocs = [p.primary_location || 'Unassigned'];
      plocs.forEach(loc => { (byLoc[loc] = byLoc[loc] || []).push(p); });
    });
    // Sort products within each location by the per-location sequence set
    // on the Locations Manage Order screen. Products with no sequence sort
    // to the end so new products do not jump above the operator's curated
    // shelf/rail order.
    const sortInLoc = (loc, list) => list.slice().sort((a, b) => {
      const sa = (a.location_sequences && a.location_sequences[loc] != null) ? a.location_sequences[loc] : Number.MAX_SAFE_INTEGER;
      const sb = (b.location_sequences && b.location_sequences[loc] != null) ? b.location_sequences[loc] : Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    });
    const result = [];
    order.forEach(loc => {
      if (byLoc[loc]) { result.push({ location: loc, products: sortInLoc(loc, byLoc[loc]) }); delete byLoc[loc]; }
    });
    Object.keys(byLoc).forEach(loc => result.push({ location: loc, products: sortInLoc(loc, byLoc[loc]) }));
    return result;
  },

  // The per-card counted / not-counted state pill (green check when counted).
  pstateHtml(pid, counted) {
    return counted
      ? '<span class="ti-pstate" data-pid="' + pid + '" style="display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--green);"><span style="width:15px;height:15px;border-radius:50%;background:var(--green);color:var(--bg);display:inline-flex;align-items:center;justify-content:center;font-size:9px;">&#10003;</span>COUNTED</span>'
      : '<span class="ti-pstate" data-pid="' + pid + '" style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--t3);">NOT COUNTED</span>';
  },
  setCardCounted(pid, counted) {
    const el = this.container.querySelector('.ti-pstate[data-pid="' + pid + '"]');
    if (el) el.outerHTML = this.pstateHtml(pid, counted);
  },

  renderCounting(keepScroll) {
    /* ⚠⚠ THE COUNTING SCREEN HAS TO KNOW IT IS AN EDIT (S330c — Kyle walked it).
       `_edit_id` used to be read in exactly ONE place, at submit, so every word on this screen was
       written for a brand-new count: "Save & Exit" (which saved a DRAFT, not the edit), "Start
       Over", "Submit Count", and a resume banner announcing "a Full count started 5 hr ago is in
       progress" — using the ORIGINAL count's `created_at`, because `editCount` seeds `started_at`
       from it. Correcting a submitted count is a different activity, and the labels have to say so.
       ⚠ The COUNTING UI itself is deliberately identical — same shelves, same inputs, same muscle
       memory. Only the words that describe STATE change. */
    const editingNow = !!(this.draft && this.draft._edit_id);
    const groups = this.groups();
    if (groups.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="card"><div class="empty">'
        + '<div class="empty-title">No products match this count</div>'
        + '<div class="empty-sub">No active products fall under a ' + esc(this.draft.type) + ' count.</div>'
        + '<button class="btn btn-ghost" id="ti-back">Back to Setup</button></div></div></div>';
      document.getElementById('ti-back')?.addEventListener('click', () => { this.clearDraft(); this.renderSetup(); });
      return;
    }
    if (this.locStep >= groups.length) this.locStep = groups.length - 1;
    if (this.locStep < 0) this.locStep = 0;

    const grp = groups[this.locStep];
    const total = groups.reduce((s, g) => s + g.products.length, 0);
    const done = this._countedTotal();
    const pct = total ? Math.round(done / total * 100) : 0;
    const isLast = this.locStep === groups.length - 1;

    const cards = grp.products.map(p => {
      const _ckey = p.id + '@@' + grp.location;
      const isCounted = this._hasCount(this.draft.counts[_ckey]);
      const c = this.draft.counts[_ckey] || { value: 0, fulls: 0, notes: '' };
      // Bottle beer with case_size set uses a case + loose-bottle input
      // pair. Bottles either are full or empty (no partial level applies),
      // so the slider does not fit. Everything else uses the partial slider.
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      // Input type by what the product actually is: case+loose for bottle beer,
      // a fill slider for anything poured from a container (liquor, wine, draft
      // keg, bottled mixers), and a plain number for food / dry goods counted
      // by weight or unit.
      const isPourable = !!(p.container_size_oz && p.pour_size_oz);
      // Food / Misc with a pack size (100 wings per bag) count like bottle beer:
      // full units + loose pieces, reconciled to a decimal of the unit via the
      // pack size. Same stored on-hand number as a typed decimal, entered more
      // accurately (1 bag + 40 wings = 1.40 bags).
      const foodStyle = (p.category === 'Food' || p.category === 'Misc') ? this._countStyle(p) : null;
      const isPackFood = foodStyle === 'loose' && p.pack_size > 0;
      const isFoodSlider = foodStyle === 'slider';
      let countInput;
      if (isCaseBeer) {
        countInput = '<div class="form-row" style="gap:14px;justify-content:center;margin:0;">'
            + '<div class="f" style="width:140px;flex-shrink:0;"><label>Cases</label>'
              + '<div class="fw"><input class="suf ti-cases" type="number" min="0" step="1" data-pid="' + p.id + '" value="' + (c.cases != null ? c.cases : 0) + '" style="height:44px;font-size:18px;text-align:center;"/><span class="suf">cases</span></div>'
            + '</div>'
            + '<div class="f" style="width:140px;flex-shrink:0;"><label>Loose Bottles</label>'
              + '<div class="fw"><input class="suf ti-loose" type="number" min="0" step="1" data-pid="' + p.id + '" value="' + (c.loose != null ? c.loose : 0) + '" style="height:44px;font-size:18px;text-align:center;"/><span class="suf">btl</span></div>'
            + '</div>'
            + '<div style="align-self:center;font-size:11px;color:var(--t3);">'
              + (p.case_size + ' btl/case')
              + '<div class="ti-echo" data-pid="' + p.id + '" style="color:var(--gold);font-weight:700;margin-top:2px;">= '
                + ((c.cases || 0) + (p.case_size ? (c.loose || 0) / p.case_size : 0)).toFixed(2) + ' cases</div>'
            + '</div>'
          + '</div>';
      } else if (isPourable) {
        countInput = '<div style="display:flex;justify-content:center;margin:0;">'
          + BottleSlider.html(p.id, { value: c.value, fulls: c.fulls, category: p.category, shape: App.sliderShape(p) })
          + '</div>';
      } else if (isFoodSlider) {
        const un = App.productUnit(p) || 'unit';
        const unPl = /(?:s|x|ch|sh)$/i.test(un) ? un + 'es' : un + 's';
        countInput = '<div style="display:flex;justify-content:center;margin:0;">'
          + BottleSlider.html(p.id, { value: c.value, fulls: c.fulls, category: p.category, shape: App.sliderShape(p), noun: un, nounPl: unPl })
          + '</div>';
      } else if (isPackFood) {
        const un = App.productUnit(p) || 'unit';
        countInput = '<div class="form-row" style="gap:14px;justify-content:center;margin:0;">'
            + '<div class="f" style="width:140px;flex-shrink:0;"><label>Full</label>'
              + '<div class="fw"><input class="suf ti-fulls" type="number" min="0" step="1" data-pid="' + p.id + '" value="' + (c.fulls != null ? c.fulls : 0) + '" style="height:44px;font-size:18px;text-align:center;"/><span class="suf">' + esc(un) + '</span></div>'
            + '</div>'
            + '<div class="f" style="width:140px;flex-shrink:0;"><label>Loose Pieces</label>'
              + '<div class="fw"><input class="suf ti-looseea" type="number" min="0" step="1" data-pid="' + p.id + '" value="' + (c.loose != null ? c.loose : 0) + '" style="height:44px;font-size:18px;text-align:center;"/><span class="suf">ea</span></div>'
            + '</div>'
            + '<div style="align-self:center;font-size:11px;color:var(--t3);">'
              + p.pack_size + ' ea/' + esc(un)
              + '<div class="ti-echo-pack" data-pid="' + p.id + '" style="color:var(--gold);font-weight:700;margin-top:2px;">= '
                + ((c.fulls || 0) + (p.pack_size ? (c.loose || 0) / p.pack_size : 0)).toFixed(2) + ' ' + esc(un) + '</div>'
            + '</div>'
          + '</div>';
      } else {
        countInput = '<div class="form-row" style="gap:14px;justify-content:center;margin:0;">'
          + '<div class="f" style="width:220px;flex-shrink:0;"><label>Count</label>'
            + '<div class="fw"><input class="suf ti-num" type="number" min="0" step="0.1" data-pid="' + p.id + '" value="' + (c.value != null ? c.value : 0) + '" style="height:44px;font-size:18px;text-align:center;"/><span class="suf">' + esc(App.productUnit(p) || 'units') + '</span></div>'
          + '</div></div>';
      }
      // Compact card: one-line header (name + category), the input always
      // visible, and Notes collapsed behind a "+ Note" toggle so 200 products
      // are far less scrolling. Notes auto-expand when one already exists.
      const hasNote = !!(c.notes && c.notes.trim());
      return '<div class="card ti-pcard" data-pid="' + p.id + '" data-case-beer="' + (isCaseBeer ? '1' : '0') + '" data-case-size="' + (p.case_size || 0) + '" data-pack-size="' + (isPackFood ? p.pack_size : 0) + '" data-count-style="' + (foodStyle || '') + '" style="margin-bottom:10px;padding:12px 14px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">'
        + '<div style="min-width:0;"><span style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(p.name) + '</span>'
        + '<span style="font-size:11px;color:var(--t3);margin-left:8px;">' + esc(p.category || 'Uncategorized') + (p.brand ? ' &middot; ' + esc(p.brand) : '') + '</span></div>'
        + '<div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">'
        + this.pstateHtml(p.id, isCounted)
        + '<button type="button" class="ti-note-toggle" data-pid="' + p.id + '" style="background:none;border:none;color:' + (hasNote ? 'var(--t1)' : 'var(--t3)') + ';font-size:11px;cursor:pointer;white-space:nowrap;">' + (hasNote ? 'Note' : '+ Add Note') + '</button>'
        + '</div>'
        + '</div>'
        + countInput
        + '<div style="display:flex;justify-content:center;margin-top:8px;"><button type="button" class="ti-oos btn btn-ghost btn-sm" data-pid="' + p.id + '">Out of Stock</button></div>'
        + '<div class="ti-note-wrap" data-pid="' + p.id + '" style="margin-top:10px;' + (hasNote ? '' : 'display:none;') + '">'
        + '<textarea class="ti-note" data-pid="' + p.id + '" rows="2" placeholder="Optional note">' + esc(c.notes || '') + '</textarea></div>'
        + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0 10px;margin-bottom:8px;border-bottom:1px solid var(--b2);">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--t1);">' + esc(grp.location)
      + ' <span style="color:var(--t3);font-weight:600;font-size:11px;">&nbsp;|&nbsp; <span id="ti-prog-txt" style="color:var(--green);">' + done + ' of ' + total + '</span></span></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" id="ti-exit-top">' + (editingNow ? 'Save Changes' : 'Save &amp; Exit') + '</button>'
        + '<button class="btn btn-ghost btn-sm" id="ti-discard-top" style="color:var(--red);">' + (editingNow ? 'Discard Changes' : 'Start Over') + '</button>'
      + '</div></div>'
      + '<div style="height:6px;background:var(--input);border-radius:3px;overflow:hidden;">'
      + '<div id="ti-prog-bar" style="height:100%;width:' + pct + '%;background:var(--green);transition:width 0.2s;"></div></div></div>'
      + cards
      + '<div class="card-actions" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + (isLast
            ? '<button class="btn btn-primary" id="ti-review">Review Count</button>'
            : '<button class="btn btn-primary" id="ti-next">Next Location</button>')
        + (this.locStep > 0 ? '<button class="btn btn-ghost" id="ti-prev">Previous</button>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost" id="ti-exit">' + (editingNow ? 'Save Changes' : 'Save &amp; Exit') + '</button>'
        + '<button class="btn btn-ghost" id="ti-discard-count" style="color:var(--red);">' + (editingNow ? 'Discard Changes' : 'Start Over') + '</button>'
      + '</div>'
      + '</div></div>';

    BottleSlider._inst = {};
    grp.products.forEach(p => {
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      if (isCaseBeer) return; // case + loose inputs handled below, not the slider
      const foodSlider = (p.category === 'Food' || p.category === 'Misc') && this._countStyle(p) === 'slider';
      if (!(p.container_size_oz && p.pour_size_oz) && !foodSlider) return; // food/dry: number/loose input, wired below
      BottleSlider.mount(p.id, (v) => {
        const key = p.id + '@@' + grp.location;
        const prev = this.draft.counts[key] || {};
        this.draft.counts[key] = { value: v.value, fulls: v.fulls, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        this.updateProgress();
        this.setCardCounted(p.id, true);
      });
    });
    // Case + loose inputs for bottle beer products with case_size set.
    this.container.querySelectorAll('.ti-cases, .ti-loose').forEach(inp => {
      inp.addEventListener('input', () => {
        const pid = inp.dataset.pid;
        const card = this.container.querySelector('.card[data-pid="' + pid + '"]');
        if (!card) return;
        const cases = parseInt(card.querySelector('.ti-cases')?.value) || 0;
        const loose = parseInt(card.querySelector('.ti-loose')?.value) || 0;
        const caseSize = parseFloat(card.dataset.caseSize) || 0;
        const echo = card.querySelector('.ti-echo');
        if (echo) echo.textContent = '= ' + (cases + (caseSize ? loose / caseSize : 0)).toFixed(2) + ' cases';
        const key = pid + '@@' + grp.location;
        const prev = this.draft.counts[key] || {};
        this.draft.counts[key] = { cases, loose, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        this.updateProgress();
        this.setCardCounted(pid, true);
      });
    });
    // Food / Misc pack items: full units + loose pieces, echoed as a decimal of
    // the unit (fulls + loose / pack size). Mirrors the bottle-beer case+loose.
    this.container.querySelectorAll('.ti-fulls, .ti-looseea').forEach(inp => {
      inp.addEventListener('input', () => {
        const pid = inp.dataset.pid;
        const card = this.container.querySelector('.card[data-pid="' + pid + '"]');
        if (!card) return;
        const fulls = parseInt(card.querySelector('.ti-fulls')?.value) || 0;
        const loose = parseInt(card.querySelector('.ti-looseea')?.value) || 0;
        const packSize = parseFloat(card.dataset.packSize) || 0;
        const echo = card.querySelector('.ti-echo-pack');
        if (echo) {
          const un = echo.textContent.replace(/^= [\d.]+ /, '') || '';
          echo.textContent = '= ' + (fulls + (packSize ? loose / packSize : 0)).toFixed(2) + ' ' + un;
        }
        const key = pid + '@@' + grp.location;
        const prev = this.draft.counts[key] || {};
        this.draft.counts[key] = { fulls, loose, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        this.updateProgress();
        this.setCardCounted(pid, true);
      });
    });
    // Food / dry-goods plain number input.
    this.container.querySelectorAll('.ti-num').forEach(inp => {
      inp.addEventListener('input', () => {
        const pid = inp.dataset.pid;
        const key = pid + '@@' + grp.location;
        const prev = this.draft.counts[key] || {};
        this.draft.counts[key] = { value: parseFloat(inp.value) || 0, fulls: 0, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        this.updateProgress();
        this.setCardCounted(pid, true);
      });
    });
    this.container.querySelectorAll('.ti-note').forEach(inp => {
      inp.addEventListener('input', () => {
        const pid = inp.dataset.pid;
        const key = pid + '@@' + grp.location;
        const cur = this.draft.counts[key] || {};
        this.draft.counts[key] = { ...cur, notes: inp.value };
        this.saveDraft();
        this.updateProgress();
      });
    });
    // "+ Note" reveals the (otherwise collapsed) note input for a product.
    this.container.querySelectorAll('.ti-note-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = this.container.querySelector('.ti-note-wrap[data-pid="' + btn.dataset.pid + '"]');
        if (!wrap) return;
        const showing = wrap.style.display !== 'none';
        wrap.style.display = showing ? 'none' : 'block';
        if (!showing) { const inp = wrap.querySelector('.ti-note'); if (inp) inp.focus(); }
      });
    });
    // "Out of Stock" records a confirmed 0 (counts the product as empty) and resets
    // its input. Re-renders this location, preserving scroll so the page does not jump.
    this.container.querySelectorAll('.ti-oos').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pid;
        const card = this.container.querySelector('.card[data-pid="' + pid + '"]');
        const isCaseBeer = !!(card && card.dataset.caseBeer === '1');
        const isLoosePack = !!(card && card.dataset.countStyle === 'loose');
        const key = pid + '@@' + grp.location;
        const prev = this.draft.counts[key] || {};
        this.draft.counts[key] = isCaseBeer
          ? { cases: 0, loose: 0, notes: prev.notes || '' }
          : isLoosePack
          ? { fulls: 0, loose: 0, notes: prev.notes || '' }
          : { value: 0, fulls: 0, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        const sc = this.container.closest('.content') || document.querySelector('.content');
        const y = sc ? sc.scrollTop : 0;
        this.renderCounting(true);
        const sc2 = this.container.closest('.content') || document.querySelector('.content');
        if (sc2) sc2.scrollTop = y;
      });
    });

    this.container.onclick = null;
    document.getElementById('ti-prev')?.addEventListener('click', () => { this.locStep--; this.draft._locStep = this.locStep; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-next')?.addEventListener('click', () => { this.locStep++; this.draft._locStep = this.locStep; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-review')?.addEventListener('click', () => { this.draft._view = 'review'; this.saveDraft(); this.renderReview(); });
    document.getElementById('ti-exit')?.addEventListener('click', () => this._exitCount());
    document.getElementById('ti-discard-count')?.addEventListener('click', () => this.confirmDiscardDraft());
    // Top-right duplicates of the session actions, same handlers as the bottom.
    document.getElementById('ti-exit-top')?.addEventListener('click', () => this._exitCount());
    document.getElementById('ti-discard-top')?.addEventListener('click', () => this.confirmDiscardDraft());
    if (!keepScroll) this.scrollTop();
  },

  updateProgress() {
    const total = this.groups().reduce((s, g) => s + g.products.length, 0);
    const done = this._countedTotal();
    const txt = document.getElementById('ti-prog-txt');
    const bar = document.getElementById('ti-prog-bar');
    if (txt) txt.textContent = done + ' of ' + total;
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  },

  // A draft entry is COUNTED only when it carries a real count, never on the presence
  // of the entry alone. Typing a note on a product nobody counted creates the entry
  // from the note by itself: that used to read as counted, drop the product out of the
  // "N products were not counted" review banner, and submit a hard ZERO. The shelf then
  // read empty, the Usage Report billed the whole prior stock as used, Variance called
  // it a full-shelf leak, and the Order Sheet reordered a full par, all off one note.
  _hasCount(e) {
    return !!e && (e.value != null || e.fulls != null || e.cases != null || e.loose != null);
  },
  // How many products actually carry a count. Walks the same product-by-location
  // population the `total` denominator is built from, so the two can never disagree
  // (and an orphan draft key for a deleted product cannot push it over the total).
  // The three call sites used Object.keys(this.draft.counts).length, which counts
  // ENTRIES: typing a note creates an entry from the note alone, so a note-only product
  // read as counted. That inflated the progress bar and put "Counted 12" directly above
  // "1 of 12 products were not counted" on the review screen, which reads off _hasCount.
  _countedTotal() {
    let n = 0;
    this.groups().forEach(g => g.products.forEach(p => {
      if (this._hasCount(this.draft.counts[p.id + '@@' + g.location])) n++;
    }));
    return n;
  },

  // ── Review ────────────────────────────────────────────────────────────────
  // Bottle beer is counted and stored in CASES. The operator enters full cases +
  // loose bottles; on-hand = cases + (loose / case_size), kept as a decimal
  // number of cases. Value is at the per-case cost (unit_cost is per case for
  // beer). Every other category is already counted in its container unit.
  rows() {
    const out = [];
    this.groups().forEach(g => g.products.forEach(p => {
      const _key = p.id + '@@' + g.location;
      const counted = this._hasCount(this.draft.counts[_key]);
      const c = this.draft.counts[_key] || { value: 0, fulls: 0, notes: '' };
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      // Only the loose (full+loose) style totals as fulls + loose/pack; a
      // slider-counted pack item stores {fulls, value} and totals in the else.
      const isPackFood = (p.category === 'Food' || p.category === 'Misc') && p.pack_size > 0 && this._countStyle(p) === 'loose';
      let total, value;
      if (isCaseBeer) {
        const cases = c.cases || 0;
        const loose = c.loose || 0;
        total = cases + (p.case_size > 0 ? loose / p.case_size : 0);
        value = p.unit_cost != null ? total * p.unit_cost : null;
      } else if (isPackFood) {
        total = (c.fulls || 0) + (p.pack_size > 0 ? (c.loose || 0) / p.pack_size : 0);
        value = p.unit_cost != null ? total * p.unit_cost : null;
      } else {
        total = (c.fulls || 0) + (c.value || 0);
        value = p.unit_cost != null ? total * p.unit_cost : null;
      }
      out.push({ p, c, total, value, isCaseBeer, isPackFood, location: g.location, counted });
    }));
    return out;
  },

  renderReview() {
    const rows = this.rows();
    const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0);
    // Same basis as the uncounted banner right below, which reads off _hasCount. These
    // two sat on one screen disagreeing: "Counted 12" above "1 of 12 were not counted".
    const counted = this._countedTotal();

    // Silent-zero guardrail: any product with no entry submits as 0. Flag them
    // so a skipped shelf is never recorded as empty by accident.
    const uncountedSet = new Set(rows.filter(r => !this._hasCount(this.draft.counts[r.p.id + '@@' + r.location]))
      .map(r => r.p.id + '@@' + r.location));
    const uncounted = uncountedSet.size;
    const warnBanner = uncounted > 0
      ? '<div style="display:flex;align-items:flex-start;gap:10px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 13px;margin-bottom:16px;">'
        + '<span style="color:var(--amber);font-weight:800;font-size:14px;line-height:1.3;flex-shrink:0;">!</span>'
        + '<div style="font-size:12px;color:var(--t1);line-height:1.5;"><strong>' + uncounted + ' of ' + rows.length + ' products were not counted.</strong> They keep their last count and will not change. If one is actually empty, go Back to Counting and tap Out of Stock. The uncounted products are tagged below.</div>'
        + '</div>'
      : '';

    const tbody = rows.map(r => {
      // Full / Open / Total via the shared App.countCols so this reads exactly
      // the same as Count History and every other inventory section.
      const cols = App.countCols(r.p, { fulls: r.c.fulls, partial: r.c.value, total: r.total, cases: r.c.cases, loose: r.c.loose });
      const isUncounted = uncountedSet.has(r.p.id + '@@' + r.location);
      return '<tr>'
        + '<td><div class="val">' + esc(r.p.name)
        + (isUncounted ? ' <span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--amber);">NOT COUNTED</span>' : '') + '</div>'
        + (r.p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.p.brand) + '</div>' : '') + '</td>'
        + '<td>' + esc(r.p.category || '-') + '</td>'
        + '<td>' + cols.full + '</td>'
        + '<td>' + cols.open + '</td>'
        + '<td class="val">' + cols.total + '</td>'
        + '<td>' + (r.value != null ? App.fmtBal(r.value) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '</tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + warnBanner
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Products</div><div class="calc-val lg">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val lg">' + counted + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Inventory Value</div><div class="calc-val lg good">' + App.fmtBal(totalValue) + '</div></div>'
      + '</div></div>'
      + '<div class="sh" style="margin:24px 0 10px;">Counted Products</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Full</th><th>Open</th><th>Total</th><th>Value</th>'
      + '</tr></thead><tbody>' + tbody + '</tbody></table></div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:16px;">'
      + '<button class="btn btn-primary" id="ti-submit">' + ((this.draft && this.draft._edit_id) ? 'Save Changes' : 'Submit Count') + '</button>'
      + '<button class="btn btn-ghost" id="ti-back-count">Back to Counting</button>'
      + '<span id="ti-sub-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div></div>';

    this.container.onclick = null;
    document.getElementById('ti-back-count')?.addEventListener('click', () => { this.draft._view = 'counting'; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-submit')?.addEventListener('click', () => this.submit());
    this.scrollTop();
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  async submit() {
    if (!App.canEdit('ic-take-inventory')) return;   // staff-permission guard
    /* ⚠⚠⚠ THE TOKEN IS SNAPSHOT INTO A LOCAL, AT THE TOP, BEFORE ANY `await` — AND THIS EXACT
       MISTAKE IS ALREADY WRITTEN UP IN THIS CODEBASE, IN `ic-prep-batches._resyncStillCurrent`:
       *"It used to read `this._mountedAt` live, and that is a property on the screen object, not a
       value belonging to the visit — so navigating away and BACK restamped it and the stale visit's
       write was waved through by the very check written to stop it."* Reading it live is useless
       here: `App.navigate` bumps `_mountSeq` and then re-renders, which re-stamps `_mountedAt` to
       the same new number, so both sides move together and the comparison passes for a screen the
       operator left and returned to. Round 8 captured `App._mountSeq` at write time (too late —
       browser Back during an awaited dialog bumps it first); round 9 stamped at render time and
       compared LIVE (too loose — a remount restamps it). It needs both: stamped at render, snapshot
       per visit here, compared against the live counter.
       ⚠ AND THE DRAFT IDENTITY WITH IT. `_confirmSwitchCount`'s dialog also survives a popstate, so
       an operator can leave, open a DIFFERENT count, and have this write land against a draft that
       never produced it. Stamping that draft with this record's id would point it at the wrong
       count entirely. */
    const visitToken = this._mountedAt;
    const draftAtStart = this.draft;
    const stillHere = () => App._mountSeq === visitToken;
    /* ⚠ SAY IT, DO NOT JUST SWALLOW IT. A re-render during the write rebuilds the save buttons
       ENABLED with their normal labels, so the operator can press Save again and see nothing happen
       — which is the identical silence the disable was added to remove. Same notice as the discard
       guard, so the two cannot drift ([[the-loop]] step 0.6). */
    if (this._writing) { await this._stillSavingNotice(); return; }
    // Clear any refusal left by an earlier attempt: a stale "Save failed" sitting under a dialog
    // the operator then cancels reads as though THIS attempt failed.
    const priorErr = document.getElementById('ti-sub-err');
    if (priorErr) { priorErr.textContent = ''; priorErr.style.display = 'none'; }
    const rows = this.rows();
    /* ⚠⚠ A COUNT WITH NO PRODUCTS IN IT IS NOT A COUNT (pre-existing, found in the S331 scan).
       `renderCounting` refuses this state by name — "No products match this count" — and clears the
       draft; `renderReview` never learned to, and `route()` sends a resumed draft with `_view:
       'review'` straight there. So: count the Walk-In Cooler, press Review Count (which persists
       that view to the device), close the tab; someone renames or deletes that location, which
       cascades onto every product's `locations`; come back, press Resume, and the review screen
       paints "Products 0 · Total Inventory Value $0.00" over a live Submit button. Pressing it wrote
       `{ items: [], item_count: 0, total_value: 0, locations: [] }` dated today — and the same-day
       merge guard cannot catch it either, because `mine` is empty so nothing ever clashes and every
       press mints another one. `computeUsagePair` then reads an empty end map and Usage, Variance,
       Top Movers, Dynamic Pars and Stock all go blank, while `CashEngine.trapped()` still reports
       `hasData` true and prints $0 of dead stock as if it had been measured.
       Refused HERE rather than in `renderReview`, because this is the one door every path to a
       written record goes through ([[the-loop]] step 0.6). */
    if (!rows.length) {
      await App.confirm({
        title: 'Nothing to save',
        message: 'There are no products on this count. The locations it covers may have been renamed '
          + 'or removed since you started. Start the count again and pick the locations you want.',
        confirmText: 'OK', cancelText: ''
      });
      return;
    }
    /* ⚠⚠⚠ THE FLAG GOES UP HERE, BEFORE THE FIRST DIALOG — NOT AT THE WRITE. It was set three
       `await`s later, and this file already documents why that is not safe: `App.confirm` blocks
       the POINTER and nothing else. It never blurs, never traps focus, never marks the background
       inert (see `_setScreenInert`'s note), so the Submit button the operator just clicked still
       has DOM focus behind the overlay — and **Enter, the reflex answer to a dialog, fires it
       again**. `submit()` #2 then runs while #1 is parked on the impact popup: it mints a fresh
       `App.uid()`, finds no clash because nothing is written yet, and both records land. Two counts,
       one date, one location set — `usageBase` pairs them, `computeUsagePair` finds no deliveries
       between two identical dates, and the whole shelf reads as dead stock at zero velocity. That
       is the S330 harm, arriving by the one door S330's guard cannot see, because both records were
       built before either was written.
       ⚠ EVERYTHING FROM HERE IS INSIDE THE `try`, so every exit — the merge cancel, the impact
       cancel, a throw, the write — goes through the `finally` that lowers it. */
    this._writing = true;
    try {
    // Build per-item records. For bottle beer with case_size, store the
    // case-aware fields (cases, loose, case_size_at_count) alongside the
    // standard fields (fulls, partial, total) so downstream readers that
    // only know about fulls/partial/total keep working unchanged.
    const items = rows.map(r => {
      if (r.isCaseBeer) {
        return {
          product_id: r.p.id,
          name:       r.p.name,
          category:   r.p.category || '',
          location:            r.location,
          cases:               r.c.cases || 0,
          loose:               r.c.loose || 0,
          case_size_at_count:  r.p.case_size || null,
          fulls:               r.c.cases || 0,   // full cases (total is decimal cases)
          partial:             0,
          total:               r.total,           // on-hand in cases (cases + loose/case_size)
          unit_cost:           r.p.unit_cost != null ? r.p.unit_cost : null,
          value:               r.value,
          notes:               r.c.notes || '',
          counted:             r.counted
        };
      }
      if (r.isPackFood) {
        return {
          product_id: r.p.id,
          name:       r.p.name,
          category:   r.p.category || '',
          location:            r.location,
          fulls:               r.c.fulls || 0,    // full units (bags/cases)
          loose:               r.c.loose || 0,    // loose pieces
          pack_size_at_count:  r.p.pack_size || null,
          partial:             0,
          total:               r.total,           // on-hand in units (fulls + loose/pack)
          unit_cost:           r.p.unit_cost != null ? r.p.unit_cost : null,
          value:               r.value,
          notes:               r.c.notes || '',
          counted:             r.counted
        };
      }
      return {
        product_id: r.p.id,
        name:       r.p.name,
        category:   r.p.category || '',
        location:   r.location,
        fulls:      r.c.fulls || 0,
        partial:    r.c.value || 0,
        total:      r.total,
        unit_cost:  r.p.unit_cost != null ? r.p.unit_cost : null,
        value:      r.value,
        notes:      r.c.notes || '',
        counted:    r.counted
      };
    });
    /* An EDIT updates the record in place (S250): same id, same business date, same created_at,
       so it stays the same point in the usage timeline.
       ⚠⚠ NO SCREEN SURFACES THE EDIT HISTORY, and the comment here used to claim otherwise —
       *"Count History prints 'Edited' rather than pretending nothing happened."*
       MEASURED: the word "Edited" appears nowhere in `public/` and Count History's Status column
       renders Latest / Booked / Past only. `edit_count` is read by nothing at all; `edited_at` has
       exactly one reader, `renderDone`'s headline ("Changes Saved" vs "Count Submitted"), so do not
       delete it on the strength of a sweep. So a count Maria took on Sunday
       and Jake rewrote on Sunday night is indistinguishable from one nobody touched. The fields stay
       (they cost nothing and the history is worth having the moment something reads them), but the
       claim goes — a comment asserting a protection the app does not have is worse than none,
       because the next reader stops looking ([[the-loop]] #53). On THE LIST as S336. */
    const editing = !!this.draft._edit_id;
    const record = {
      id:          editing ? this.draft._edit_id : App.uid(),
      // ⚠ `_business_date` pins the day for a MERGED draft that outlived its write (see below), so a
      //    re-save after local midnight still finds its clash instead of minting a second record.
      date:        editing ? this.draft._edit_date : (this.draft._business_date || App.todayLocal()),
      type:        this.draft.type,
      counted_by_id: this.draft.counted_by_id || '',
      counted_by:  this.draft.counted_by || (App.staffById(this.draft.counted_by_id) || {}).name || '',
      locations:   [...new Set(rows.map(r => r.location || 'Unassigned'))],
      items,
      item_count:  items.length,
      total_value: items.reduce((s, i) => s + (i.value || 0), 0),
      created_at:  editing ? this.draft._edit_created_at : new Date().toISOString()
    };
    if (editing) {
      record.edited_at  = new Date().toISOString();
      record.edit_count = this.draft._edit_count || 1;
    }

    /* ⚠⚠ SAME LOCATION, SAME DAY, SECOND RECORD (S330). Kyle: "what do you mean by a double
       submitted count? how could that happen?" — and the answer is that nothing stopped it. This
       handler always minted `App.uid()` and dated the record `todayLocal()` with NO duplicate check
       of any kind. Not a double-click (the button is disabled synchronously below); the path is
       simply COUNTING AGAIN: count the Back Bar, submit, spot a miscount, and run the count again
       instead of going Count History → Edit.
       THE COST IS A COGS NUMBER. `CashEngine.usageBase()` takes the last two counts ascending —
       now two records on ONE date — so the usage pair spans ZERO DAYS, and `computeUsagePair`
       filters deliveries `> start.date && <= end.date`, which an identical date empties. Two counts
       of one shelf an hour apart differ by almost nothing, so usage reads ~0 and the whole shelf
       reads as DEAD STOCK at zero velocity. `editCount` already warned about exactly this: "two
       counts on one day would become a usage pair spanning zero days and poison the very COGS this
       is protecting" — the edit path avoided it and the submit path did not.
       ⭐ IT UPDATES RATHER THAN REFUSES, because the operator counted again precisely BECAUSE the
       first count was wrong: their new numbers ARE the correction. Same id, same business date,
       same created_at, edit_count bumped — identical to Count History → Edit, so nothing they just
       typed is lost and no zero-day pair is created.
       ⚠ ONLY ON AN EXACT LOCATION MATCH. A PARTIAL overlap (earlier: Back Bar + Store Room; now:
       Back Bar alone) must NOT be merged — writing these items over that record would drop Store
       Room's from it. The data cannot say which the operator meant, so it names the difference and
       stops rather than guessing ([[the-loop]] #30).
       ⚠ AND NEVER OVER A BOOKED COUNT: rewriting a count a confirmed week has signed off on is the
       exact thing S250 and S282 forbid. */
    /* ⚠⚠ THE MERGE WRITES A RECORD WIDER THAN THE DRAFT, AND THAT MAKES THE DRAFT UNSAFE TO STAMP.
       `mergedItems` keeps the other locations' lines from the clash and adds this draft's; the draft
       still knows only its own `custom_locations`. Stamping it as an EDIT of that record would gate
       the merge branch OFF on the next save (it is `if (!editing)`), and the re-save would rebuild
       `items` / `locations` / `total_value` from this draft alone — silently deleting the other
       locations' counts from the record. So the merged case keeps its draft UNSTAMPED: a re-save
       re-enters this branch and merges correctly, which is what it is for. */
    let mergedWider = false;
    if (!editing) {
      const mine = new Set(record.locations);
      const clash = this.counts().find(c => c
        && String(c.date || '').slice(0, 10) === record.date
        && (Array.isArray(c.locations) ? c.locations : []).some(l => mine.has(l)));
      if (clash) {
        const theirs = Array.isArray(clash.locations) ? clash.locations : [];
        const missing = theirs.filter(l => !mine.has(l));
        const overlap = theirs.filter(l => mine.has(l));
        const nameList = a => a.length === 1 ? a[0]
          : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
        /* ⭐ S331 REMOVED THE "that day is already confirmed" REFUSAL THAT SAT HERE. It existed
           only because a booked count could not be corrected; now it can, so refusing the merge
           would throw away everything the operator just typed to protect a figure the very next
           popup prices for them. The merged record IS an edit of a booked count, and the
           cogsImpact gate below covers it exactly as it covers Count History -> Edit. */
        /* ⚠⚠ MERGE BY LOCATION — the earlier refusal was MY BAD REASONING (S330b). I wrote that a
           partial overlap "cannot be folded in without losing those numbers" and sent the operator
           to Count History, which then discarded everything they had typed. **Which items to
           replace is not ambiguous at all**: they re-counted exactly the locations they picked, so
           those locations' items are replaced and every other location on that record keeps its
           own, untouched. Nothing is guessed and nothing is lost. That removes the refusal
           entirely, and with it the loop ([[the-loop]] #65 — when a limitation pushes you somewhere
           obviously worse, the limitation is the bug). */
        /* ⚠ "TODAY" IS A CLAIM AND IT CAN BE FALSE HERE. `record.date` is normally `todayLocal()`,
           but a merged draft that outlived its own write carries `_business_date`, so this branch
           can be reached on a LATER calendar day — and then "today" is wrong and the operator has
           no way to see that they are about to write into an older count. Name the day when it is
           not today; the wording is otherwise unchanged. ⚠ The remaining question — how long a
           pinned business date should stay pinned — is S339 on THE LIST, not a number to invent
           here ([[the-loop]] #28). */
        const sameDayNow = record.date === App.todayLocal();
        const merge = await App.confirm({
          title: 'You already counted ' + nameList(overlap)
            + (sameDayNow ? ' today' : ' on ' + this._dayLabel(record.date)),
          message: 'Two counts of the same shelf on one day cannot be used as a usage pair, so Bar Cop keeps one count '
            + 'per location per day. Update that count with what you just entered?'
            + (missing.length ? ' ' + nameList(missing) + ' stays exactly as counted earlier.' : ''),
          confirmText: 'Update That Count', cancelText: 'Cancel'
        });
        if (!merge) return;
        const keep = (Array.isArray(clash.items) ? clash.items : [])
          .filter(it => it && !mine.has(it.location || 'Unassigned'));
        const mergedItems = keep.concat(record.items);
        const mergedLocs = [...new Set((clash.locations || []).concat(record.locations))];
        const liveLocs = ((App.inventoryData && App.inventoryData.ic_locations) || [])
          .filter(l => !l.archived).map(l => l.name);
        record.id          = clash.id;
        record.date        = clash.date;
        record.created_at  = clash.created_at;
        record.edited_at   = new Date().toISOString();
        record.edit_count  = (clash.edit_count || 0) + 1;
        record.items       = mergedItems;
        record.locations   = mergedLocs;
        // the record's own label has to follow the merged set, or a Full count re-counted one
        // shelf at a time would go on calling itself by that one shelf's name.
        record.type        = (liveLocs.length && mergedLocs.length === liveLocs.length) ? 'Full'
                           : (mergedLocs.length === 1 ? mergedLocs[0] : 'Multi-Location');
        record.item_count  = mergedItems.length;
        record.total_value = mergedItems.reduce((s, i) => s + (i.value || 0), 0);
        mergedWider = keep.length > 0;   // the record now carries lines this draft does not
      }
    }

    /* ⭐⭐ S331 — PRICE THE CORRECTION BEFORE WRITING IT. A count is an endpoint of a usage pair, so
       changing one moves the COGS of every confirmed week whose pair touches it. ⚠ THERE IS NO
       BOUND ON HOW MANY: a count ends one week's pair and starts the next, and a week confirmed
       early can share a pair with the week before it, so three is reachable. This comment said "up
       to TWO" for four rounds while the function it calls says the opposite in its own header — a
       number in a comment is a claim, and nothing here enforced it. `cogsImpact` asks every confirmed
       week the question against the corrected set and reports only the ones whose answer actually
       moves; on the ordinary submit nothing moves and no popup is raised.
       ⚠ ASKED ON EVERY SUBMIT, not just on `editing`. The merge branch above turns a same-day
       re-count into an edit of an existing record, and a new count on a day a confirmed week already
       covers is the same question — gating this on a flag would be the narrowing that hides the
       case ([[the-loop]] #21).
       ⚠ IT SITS HERE, ABOVE THE FIRST WRITE AND BELOW EVERY MUTATION-FREE STEP. Nothing has been
       persisted yet and `record` is a local object, so Cancel touches nothing at all — the rollback
       rule ([[the-loop]] #49) is satisfied by there being nothing to roll back.
       ⚠ THE COUNT IS WRITTEN FIRST AND THE WEEKS ONLY IF IT LANDED. A week updated against a count
       that failed to save is a number with nothing behind it. */
    // The count list as it will be once this write lands: the record replaces its own row if it
    // already has one (an edit, or the merge above), otherwise it joins the list.
    const stored = this.counts();
    /* ⚠ `replacing`, NOT `editing`, decides both the array shape AND the popup's wording. `editing`
       is `!!draft._edit_id`, and the same-day MERGE branch above rewrites an existing record with
       `editing` false — so a re-count of a shelf already counted today is every bit a correction
       while that flag says it is not. One measured fact ("is there already a row with this id?")
       answers both questions and cannot drift from the write. */
    const replacing = stored.some(c => c && c.id === record.id);
    const nextCounts = replacing
      ? stored.map(c => (c && c.id === record.id) ? record : c)
      : stored.concat([record]);

    let impacts = [];
    let updateWeeks = false;
    let checkFailed = false;
    /* ⚠ A THROW MUST NOT COST THE OPERATOR THEIR COUNT — but it must not pass silently either.
       Swallowing it would leave the confirmed weeks stale with nothing on screen to say so, which
       is indistinguishable from "nothing changed" ([[the-loop]] #15: a green detector is worse than
       no detector). The count still saves, and the note below tells them to re-confirm the week. */
    try { impacts = ConfirmWeek.cogsImpact(nextCounts) || []; }
    catch (e) { impacts = []; checkFailed = true; }
    if (impacts.length) {
      /* ⚠ `replacing` decides the WORDS, not the behaviour. Confirming the running week early is the
         cockpit's normal door, so a brand-new weekly count routinely lands inside a confirmed week
         and moves it — that is not a "correction" and must not be described as one ([[the-loop]]
         #79). Same figures, same buttons, honest sentence either way. */
      const answer = await ConfirmWeek.askCogsImpact(impacts, replacing);
      if (answer === 'cancel') return;                  // nothing written, nothing lost
      updateWeeks = (answer === 'update');
    }

    /* ⚠⚠ EVERY SAVE CONTROL ON EITHER SCREEN, NOT JUST THE REVIEW BUTTON — step 0.6, and I fixed
       one half of this in the last round and left its twin two lines above it. `ti-submit` lives on
       the REVIEW screen only; since S330c, `_exitCount()` also calls `submit()` from the COUNTING
       screen, where the save controls are `ti-exit` and `ti-exit-top`. There `btn` was null, so
       there was no "Submitting...", no disable and no visual change at all while the write was in
       flight — and on a slow connection the natural response is to press again, which starts a
       SECOND concurrent submit (a second putRecord, a second clearDraft, a second renderDone).
       Nothing else guards it: the button is the guard, and there is no overlay up once the impact
       popup has been answered.
       ⚠ The label is CAPTURED and restored rather than rebuilt, because the three controls read
       differently ("Submit Count" / "Save Changes" / "Save & Exit") and the counting screen's pair
       already follows edit mode. Rebuilding one string for all three would relabel two of them. */
    const btns = ['ti-submit', 'ti-exit-top', 'ti-exit']
      .map(id => document.getElementById(id)).filter(Boolean)
      .map(el => ({ el: el, label: el.textContent }));
    btns.forEach(b => { b.el.disabled = true; b.el.textContent = 'Saving...'; });

    /* ⚠⚠ THE BUTTON IS NOT THE GUARD, AND SAYING IT WAS IS HOW I NARROWED THIS TWICE. Disabling the
       save controls leaves every OTHER control on the screen live through the write: Discard
       Changes, Review Count, Previous/Next, Back to Counting. Two of those are destructive and one
       re-renders the screen, which recreates a disabled button ENABLED and hands back a second
       concurrent submit. So the guard is a flag on the screen, not on an element — it survives a
       re-render, which is the whole point. Cleared in `finally`, because a throw that left it set
       would lock the operator out of saving for the rest of the session ([[the-loop]] #49). */
    /* ⚠⚠ THE GUARD SPANS THE WHOLE OPERATION, NOT JUST THE COUNT WRITE — I scoped it to `putRecord`
       and left the part that takes longest outside it. "Save and Update the Weeks" then does one to
       three MORE network writes through `applyCogsImpact`, and through that whole window the flag
       was already false and the screen was already live again. */
    /* ⚠⚠⚠ AND THE SCREEN ITSELF GOES INERT, BECAUSE FOUR ROUNDS OF NAMING CONTROLS WERE FOUR WRONG
       LISTS. Round 3 disabled the save buttons; round 4 found Discard/Review/Prev/Next still live;
       round 5 found every COUNT-ENTRY control live too — the bottle slider, cases/loose,
       fulls/loose-each, the number cell, the note field, Out of Stock, each ending in `saveDraft()`
       — so a value typed during the write was written to the draft and to the device and then wiped
       by `clearDraft()` under a green check reading "Changes Saved". Round 5 answered that by
       painting the done screen before the WEEK writes, which closed the second window and left the
       first one open: `await App.putRecord` is a bare network round trip with no overlay, and on
       the review screen **Back to Counting** rebuilds every entry control mid-flight.
       **A list of controls is a guess about a surface. One switch is not.** `_setScreenInert` marks
       the screen's own `.screen` wrapper `inert`, which blocks pointer, keyboard, focus and click
       together and therefore covers every control that exists today and every one added later. The
       save buttons already read "Saving...", so the screen says why nothing responds.
       ⚠ It does NOT reach `App.confirm`, which appends its overlay to `document.body` — the impact
       popup and the refusal notices still work.
       ⚠ RELEASED THREE WAYS, and each is load-bearing: in `finally` for a throw ([[the-loop]] #49);
       explicitly once the done screen is up, so the operator is not left staring at a frozen card
       while the WEEK writes finish; and structurally, because the wrapper it is set on is destroyed
       by the next `innerHTML` write. That last one is why it sits on the wrapper and not on
       `#content-area`, which is permanent and shared by every screen in the app. */
    /* ⚠⚠⚠ AND THE ONE THING THE INERT WRAPPER CANNOT COVER: NAVIGATION. The nav rail and the top bar
       are siblings of `#content-area`, not children of it, and browser Back routes through
       `App.navigate` too — so the operator can leave mid-write however inert the sheet is. Coming
       BACK re-runs `render()`, which sees `this.draft` (not cleared until the write lands) and
       repaints a brand-new `.screen` wrapper with fresh listeners and no inert flag. Round 5's
       silent loss, verbatim: type into that sheet, and `clearDraft()` wipes it under a green check.
       Worse, `App.putRecord` pushes the record into the store SYNCHRONOUSLY, so Count History shows
       the new row and its Edit button opens a live correction sheet for a write still in flight.
       ⭐ THE APP ALREADY HAS THE ANSWER AND DOCUMENTS IT AS MANDATORY. `App._mountSeq` is bumped on
       every screen mount, and app.js says in as many words that a screen which writes in the
       background and then re-renders MUST capture it and compare before repainting — *"or a late
       write paints it over whatever the operator went to next (a half-entered count sheet, in the
       worst case found)"*. Four screens honour it; this one had zero references to it.
       ⚠ WHAT "NOT CURRENT" MEANS HERE IS DELIBERATE: leave them alone. The count is saved and the
       week updates they authorised still run, but nothing paints over the screen they moved to and
       nothing clears a draft they may be typing into. The draft is re-stamped as an EDIT of the
       record that just landed (see below), so pressing Save again rewrites that record in place
       rather than minting a second one, and every sentence the screen says about it reads true. */
    /* ⚠ GATED. `_setScreenInert` resolves its target off the permanent shared `#content-area` at
       CALL time, and the awaited dialogs above this line do not block browser Back — so on a
       popstate this froze whatever screen the operator had moved to, pointer, keyboard and focus,
       with no "Saving..." anywhere on it because the buttons went with the old markup. Round 9
       closed the painting half of that and left this half open. */
    if (stillHere()) this._setScreenInert(true);
    const ok = await App.putRecord('ic', 'count', record);
    if (ok) {
      App.markSetupDone('gs_ic_count');
      /* ⚠⚠⚠ THE COUNTING SCREEN GOES FIRST, BEFORE THE WEEK WRITES — AND ROUND 4's VERSION TURNED A
         CRASH INTO A SILENT LOSS, WHICH IS THE WORSE TRADE. Round 3 disabled the save buttons;
         round 4 kept `this.draft` alive through `applyCogsImpact` so the other controls would stop
         throwing on a null. But every COUNT-ENTRY control is live too — the bottle slider, the
         cases/loose and fulls/loose-each inputs, the plain number cell, the note field and Out of
         Stock — and each ends in `saveDraft()`. Before round 4 they threw and nothing moved; after
         it they WORKED: drag the slider during those three or four seconds, watch the pill go green
         and the header count to "42 of 60", and then `clearDraft()` wipes it and a full-screen green
         check says "Changes Saved" over a record that does not contain those bottles.
         Guarding each entry handler would be enumerating controls again, which is the narrowing
         that has bitten this file three rounds running. THREE things close it together: the screen
         wrapper is `inert` from before the count write until this line; the done screen is painted
         BEFORE the week writes so `renderDone` rebuilds `container.innerHTML` and every one of those
         listeners ends up on a detached node; and the `stillHere()` mount check above covers the one
         route inert cannot touch, which is the operator leaving by the nav and coming back to a
         freshly rendered sheet. With all three there is nothing left that can write to the record,
         which is why the inert flag is released HERE rather than held through `applyCogsImpact` —
         freezing a card that says "Changes Saved" would be theatre. The note arrives after and is
         filled in place.
         ⚠ `clearDraft()` sits immediately above `renderDone` with nothing awaited between them, so
         no code ever observes the null draft — that was round 4's problem and it was solved by
         removing the gap, not by delaying the teardown. */
      /* ⚠ ONLY IF THIS IS STILL THE SCREEN ON THE PAGE. If they navigated away mid-write, painting
         here lands "Count Submitted" on top of whatever they went to, and `clearDraft()` wipes a
         sheet they may have come back to and typed into. */
      if (stillHere()) {
        this.clearDraft();
        this.renderDone(record);
        this._setScreenInert(false);   // the done screen is safe: nothing on it writes to the record
      } else if (this.draft && this.draft === draftAtStart && mergedWider) {
        /* ⚠⚠ A MERGED WRITE CANNOT BE STAMPED AS AN EDIT (it would gate the merge branch off and the
           next save would rebuild the record from this narrower draft, deleting the other locations'
           counts) — but leaving it wholly untouched put the midnight double-count straight back.
           `record.date` is `todayLocal()`, so a re-save at 00:05 finds no same-day clash, skips the
           merge and mints a SECOND record with the same items one day on, which `usageBase` then
           pairs as dead stock at zero velocity. Pinning the business DAY is the whole fix: the
           re-save lands on the same date, finds the clash and merges, which is the path that is
           already correct.
           ⚠ KNOWN LIMIT, RECORDED SO A LATER ROUND DOES NOT "FIND" IT: the merged draft still has no
           `_edit_id`, so until they save again the resume banner says "a count is in progress", Start
           Over warns their entries "will be lost", and Count History → Edit on that row offers to
           discard "the one you are in the middle of". All three overstate — the numbers are on the
           server — and all three cost at most a redundant re-save, which now merges correctly. The
           alternative is a third draft state, and that is more surface than the harm. */
        this.draft._business_date = record.date;
        this.saveDraft();
      } else if (this.draft && this.draft === draftAtStart) {
        /* ⚠⚠ THE SURVIVING DRAFT BECOMES AN EDIT OF THE RECORD THAT WAS JUST WRITTEN. Keeping it was
           right — they may have come back and typed — but a draft that still looks like a NEW count
           made three sentences false the moment the record existed: the resume banner says "a Full
           count started 5 hr ago is in progress" about one that is saved; Start Over warns that
           entries "will be lost" when they are on the server; and Count History → Edit on that very
           row raises "opening that count will discard the one you are in the middle of", about
           itself. Stamping the edit fields makes every one of them read true — the banner switches
           to "You are part-way through editing the … count from …. Your changes are not saved to it
           yet", which is exactly the state — and `_draftAtRisk` then matches on the id and stops
           prompting.
           ⚠ IT ALSO CLOSES A REAL DOUBLE-COUNT. Without it a re-save re-derives the business date
           from `todayLocal()`, so counting at 23:50, navigating away and pressing Save again at
           00:05 finds no same-day clash, writes a SECOND record with identical items one day on,
           and `usageBase` then pairs two identical counts — the dead-stock-at-zero-velocity
           distortion S330 exists to prevent. An edit rewrites the record in place, whatever the
           clock has done. */
        this.draft._edit_id = record.id;
        this.draft._edit_date = record.date;
        this.draft._edit_created_at = record.created_at;
        this.draft._edit_count = (record.edit_count || 0) + 1;
        this.saveDraft();
      }
      if (checkFailed) {
        /* ⚠ PLURAL. `cogsImpact` puts no bound on how many weeks move (a count ends one usage pair
           and starts the next, and a week confirmed early can share a pair with the week before it),
           so a singular "that week" would send the operator to fix one of three. */
        this._setDoneNote('Bar Cop could not check which of your confirmed weeks this count prices. '
          + 'Open Week History, edit any week this count falls in or beside, and press Refresh from '
          + 'Control to pull the corrected cost of goods in.');
      } else if (updateWeeks) {
        const res = await ConfirmWeek.applyCogsImpact(impacts);
        // Say which weeks did NOT move rather than reporting a clean save over a partial one.
        if (!res.ok) {
          // ⚠ the noun follows the LIST, or two failures read as one week with two end dates.
          const n = res.failed.length;
          this._setDoneNote('The count was saved, but the week' + (n > 1 ? 's' : '') + ' ending '
            + (n > 1 ? res.failed.slice(0, -1).join(', ') + ' and ' + res.failed[n - 1] : res.failed[0])
            + ' could not be updated. Open Week History, edit ' + (n > 1 ? 'those weeks' : 'that week')
            + ' and press Refresh from Control to pull the new figures in.');
        }
      }
    } else {
      /* ⚠⚠ THE FAILURE HAD NOWHERE TO GO ON THE COUNTING SCREEN (found scanning S331; the hole
         arrived with S330c, not with S331, but S331 makes it far easier to reach). `ti-submit` and
         `ti-sub-err` are rendered by `renderReview` ALONE. Since S330c, `_exitCount()` also calls
         `submit()` straight from the counting screen when the operator presses Save Changes in the
         sticky header -- and there both lookups return null, so a REFUSED write (read-only
         membership, storage full) changed nothing on screen at all: same buttons, same numbers, no
         red text. The comment above `_exitCount` says `submit()` "owns the write, the failure
         message and the confirmation screen", which is the confidence claim that made it invisible.
         So: use the inline slot where one exists, and otherwise SAY IT, because a save that was
         refused in silence reads exactly like a save that worked. */
      /* ⚠ THE REASSURANCE IS CONDITIONAL, because it is a claim about state and it can be false.
         It is only true while the draft is still in hand; if it went (a discard that raced the
         write, a second device) then saying "nothing has been lost" is the worst kind of wrong. */
      const msg = 'Save failed. Try again.';
      const err = document.getElementById('ti-sub-err');
      if (err) { err.textContent = msg; err.style.display = 'inline'; }
      else App.confirm({ title: 'Could not save this count',
        message: msg + (this.draft ? ' Your numbers are still here, nothing has been lost.' : ''),
        confirmText: 'OK', cancelText: '' });
      btns.forEach(b => { b.el.disabled = false; b.el.textContent = b.label; });
    }
    } finally { this._writing = false; this._setScreenInert(false); }
  },

  renderDone(record) {
    const counted = ((record && record.items) || []).filter(it => it && it.counted !== false).length;
    /* ⚠ A PARTIAL RESULT IS SAID OUT LOUD (S331). The count can land while a confirmed week's
       update does not, and "Changes Saved" over a week that did not move is the silent divergence
       this item exists to close. The note sits inside the success card because the count really did
       save — this is what is still outstanding, not a failure of the thing they pressed.
       ⚠ THE SLOT IS ALWAYS RENDERED AND ALWAYS EMPTY. The week writes finish AFTER this screen
       paints — the counting screen has to be gone before they start, or the operator can type into
       a record that is already written — so `_setDoneNote` fills it in place. It took a `weekNote`
       parameter for one round after that change and every caller passed `''`; a parameter nothing
       supplies is a second way to do the job, and the next reader would have used it and wondered
       why nothing appeared ([[the-loop]] #25). */
    const note = '<div id="ti-done-note" style="font-size:12px;color:var(--gold);line-height:1.6;'
      + 'margin-top:12px;max-width:520px;margin-left:auto;margin-right:auto;display:none;"></div>';
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--green)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">' + (record && record.edited_at ? 'Changes Saved' : 'Count Submitted') + '</div>'
      // item_count is everything on the sheet, including the products the operator skipped.
      // The review screen right before this said "Counted 12", so the confirmation says 12 too —
      // reporting 42 here contradicted the screen it followed. Count History uses the same basis.
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.type) + ' count &middot; ' + counted
      + ' product' + (counted === 1 ? '' : 's') + ' &middot; ' + App.fmtCurrency(record.total_value) + ' total value</div>'
      + note
      + '</div>'
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-primary" id="ti-again">Take Another Count</button>'
      + '<button class="btn btn-ghost" id="ti-history">View Count History</button>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('ti-again')?.addEventListener('click', () => this.renderSetup());
    document.getElementById('ti-history')?.addEventListener('click', () => App.navigate('ic-count-history'));
    this.scrollTop();
  }
};
