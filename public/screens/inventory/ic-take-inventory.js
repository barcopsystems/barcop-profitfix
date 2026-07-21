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
    actions.innerHTML = '';
    if (this.draft && this.draft._view) this.route();
    else this.renderSetup();
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
        + '<div class="alert-text">A ' + esc(saved.type) + ' count started ' + this.ago(saved.started_at) + ' is in progress.</div>'
        + '<div style="display:flex;gap:8px;">'
          + '<button class="btn btn-ghost btn-sm" id="ti-resume">Resume Count</button>'
          + '<button class="btn btn-ghost btn-sm" id="ti-discard">Start Over</button>'
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

  // Discard the in-progress draft. Confirmation because losing count data
  // part-way through is destructive. Standard App.confirm box (discard-draft is
  // a non-delete prompt, so it uses confirm, not confirmDelete).
  async confirmDiscardDraft() {
    const ok = await App.confirm({
      title: 'Start over on this count?',
      message: 'Any counts you have entered so far will be lost. The product master and your last finalized count stay untouched.',
      confirmText: 'Start Over',
      cancelText: 'Keep Counting'
    });
    if (!ok) return;
    this.clearDraft();
    this.renderSetup();
  },

  startCount() {
    const err = document.getElementById('ti-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const picked = [...this.container.querySelectorAll('.ti-loc-tile.selected')].map(t => t.dataset.loc);
    if (picked.length === 0) { fail('Pick at least one location to count.'); return; }

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
        + '<button class="btn btn-ghost btn-sm" id="ti-exit-top">Save &amp; Exit</button>'
        + '<button class="btn btn-ghost btn-sm" id="ti-discard-top" style="color:var(--red);">Start Over</button>'
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
        + '<button class="btn btn-ghost" id="ti-exit">Save &amp; Exit</button>'
        + '<button class="btn btn-ghost" id="ti-discard-count" style="color:var(--red);">Start Over</button>'
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
    document.getElementById('ti-exit')?.addEventListener('click', () => { this.saveDraft(); this.draft = null; this.renderSetup(); this.scrollTop(); });
    document.getElementById('ti-discard-count')?.addEventListener('click', () => this.confirmDiscardDraft());
    // Top-right duplicates of the session actions, same handlers as the bottom.
    document.getElementById('ti-exit-top')?.addEventListener('click', () => { this.saveDraft(); this.draft = null; this.renderSetup(); this.scrollTop(); });
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
        + '<td>' + (r.value != null ? App.fmtCurrency(r.value) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '</tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + warnBanner
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Products</div><div class="calc-val lg">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val lg">' + counted + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Inventory Value</div><div class="calc-val lg good">' + App.fmtCurrency(totalValue) + '</div></div>'
      + '</div></div>'
      + '<div class="sh" style="margin:24px 0 10px;">Counted Products</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Full</th><th>Open</th><th>Total</th><th>Value</th>'
      + '</tr></thead><tbody>' + tbody + '</tbody></table></div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:16px;">'
      + '<button class="btn btn-primary" id="ti-submit">Submit Count</button>'
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
    const rows = this.rows();
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
    const record = {
      id:          App.uid(),
      date:        App.todayLocal(),
      type:        this.draft.type,
      counted_by_id: this.draft.counted_by_id || '',
      counted_by:  this.draft.counted_by || (App.staffById(this.draft.counted_by_id) || {}).name || '',
      locations:   [...new Set(rows.map(r => r.location || 'Unassigned'))],
      items,
      item_count:  items.length,
      total_value: items.reduce((s, i) => s + (i.value || 0), 0),
      created_at:  new Date().toISOString()
    };

    const btn = document.getElementById('ti-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    const ok = await App.putRecord('ic', 'count', record);
    if (ok) {
      App.markSetupDone('gs_ic_count');
      this.clearDraft();
      this.renderDone(record);
    } else {
      const err = document.getElementById('ti-sub-err');
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Count'; }
    }
  },

  renderDone(record) {
    const counted = ((record && record.items) || []).filter(it => it && it.counted !== false).length;
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--green)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Count Submitted</div>'
      // item_count is everything on the sheet, including the products the operator skipped.
      // The review screen right before this said "Counted 12", so the confirmation says 12 too —
      // reporting 42 here contradicted the screen it followed. Count History uses the same basis.
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.type) + ' count &middot; ' + counted
      + ' product' + (counted === 1 ? '' : 's') + ' &middot; ' + App.fmtCurrency(record.total_value) + ' total value</div>'
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
