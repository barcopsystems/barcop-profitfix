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
      { h: 'What You Are Counting', p: ['Bar Cop walks you through your products one location at a time. Go shelf by shelf and enter what is physically there. Anything you do not touch is recorded as zero, so only skip a product if it is truly empty.'] },
      { h: 'Pick Your Locations', p: ['Most operators count one location at a time and come back for the rest later. Pick a single location for a quick section count, or pick several to run a full inventory in one session. You count and finalize each location\'s products together.'] },
      { h: 'How To Enter Each Product', p: [
        'Liquor, wine, and bottled mixers use the fill slider. Set the number of full bottles, then drag the slider to the level of the open bottle. Draft beer uses the same slider shaped like a keg.',
        'Bottle beer is counted by the case. Enter full cases and any loose bottles, and Bar Cop shows the running total in cases as you type.',
        'Food and dry goods use a plain number in the product\'s own unit, like pounds, cases, or each.'
      ] },
      { h: 'It Saves As You Go', p: ['Your count saves to this device automatically. If you close the tab or lose signal partway through, come back and pick up where you left off. Nothing is final until you submit.'] },
      { h: 'Review And Submit', p: ['When you reach the end, Bar Cop shows a review of every product, its total, and its value. Go back and fix anything that looks off, then submit. Submitting writes a finalized count that you cannot change by accident.'] },
      { h: 'What The Count Feeds', p: ['Every finalized count powers your dashboard, the usage and variance reports, dynamic par suggestions, and your cost of goods. Two counts let Bar Cop measure what you used between them, so count on a regular schedule, like every week, to keep the numbers sharp.'] }
    ]);
  },

  route() {
    if (!this.draft) { this.renderSetup(); return; }
    if (this.draft._view === 'review') this.renderReview();
    else this.renderCounting();
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
          + '<button class="btn btn-primary btn-sm" id="ti-resume">Resume Count</button>'
          + '<button class="btn btn-ghost btn-sm" id="ti-discard">Discard</button>'
        + '</div></div>'
      : '';

    const locs = ((App.inventoryData && App.inventoryData.ic_locations) || []).filter(l => !l.archived);

    let locPicker;
    if (locs.length === 0) {
      locPicker = '<div class="empty" style="margin:0;"><div class="empty-title">No locations set up yet</div>'
        + '<div class="empty-sub">Add storage locations in the Locations screen first. Inventory counts are organized by location.</div>'
        + '<button class="btn btn-primary" id="ti-go-locs">Go to Locations</button></div>';
    } else {
      const locCards = locs.map(l => {
        const productCount = this.products().filter(p => App.productLocations(p).includes(l.name)).length;
        return '<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--b1);border-radius:6px;cursor:pointer;margin-bottom:8px;">'
          + '<input type="checkbox" class="ti-loc" value="' + esc(l.name) + '" style="width:18px;height:18px;accent-color:var(--gold);flex-shrink:0;"/>'
          + '<div style="flex:1;">'
            + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(l.name) + '</div>'
            + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + productCount + ' product' + (productCount === 1 ? '' : 's') + ' assigned</div>'
          + '</div></label>';
      }).join('');
      locPicker = locCards;
    }

    this.container.innerHTML = '<div class="screen">' + resumeBar
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Start an Inventory Count</span>'
      + App.helpButton('ti-how') + '</div>'
      + locPicker
      + '<div class="form-row" style="gap:16px;margin-top:14px;">'
      + '<div class="f w-md"><label>Counted By</label>'
      + '<select id="ti-by">' + App.staffOptions(App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="card-actions">'
      + (locs.length > 0 ? '<button class="btn btn-primary" id="ti-start">Start Count</button>' : '')
      + '<span id="ti-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('ti-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('ti-go-locs')?.addEventListener('click', () => App.navigate('ic-locations'));
    document.getElementById('ti-resume')?.addEventListener('click', () => {
      this.draft = this.loadDraft();
      if (this.draft) {
        if (!this.draft._view) this.draft._view = 'counting';
        this.locStep = this.draft._locStep || 0;
        this.route();
      }
    });
    document.getElementById('ti-discard')?.addEventListener('click', () => this.confirmDiscardDraft());
    document.getElementById('ti-start')?.addEventListener('click', () => this.startCount());
  },

  // Discard the in-progress draft. Confirmation modal because losing count
  // data part-way through is destructive — easy to recover from a manual
  // back-out, hard to recover from an accidental discard.
  confirmDiscardDraft() {
    const m = document.createElement('div');
    m.id = 'ti-discard-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';
    m.innerHTML = '<div style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:460px;width:100%;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.55);">'
      + '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);margin-bottom:12px;">Discard This Count?</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:20px;">Any counts you have entered so far will be lost. The product master and your last finalized count stay untouched.</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;">'
        + '<button type="button" id="ti-disc-cancel" class="btn btn-ghost">Keep Counting</button>'
        + '<button type="button" id="ti-disc-confirm" class="btn btn-danger">Discard</button>'
      + '</div>'
    + '</div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('ti-disc-cancel').addEventListener('click', close);
    document.getElementById('ti-disc-confirm').addEventListener('click', () => {
      this.clearDraft();
      close();
      this.renderSetup();
    });
  },

  startCount() {
    const err = document.getElementById('ti-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const picked = [...this.container.querySelectorAll('.ti-loc:checked')].map(c => c.value);
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

  renderCounting() {
    const groups = this.groups();
    if (groups.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No products match this count</div>'
        + '<div class="empty-sub">No active products fall under a ' + esc(this.draft.type) + ' count.</div>'
        + '<button class="btn btn-ghost" id="ti-back">Back to Setup</button></div></div>';
      document.getElementById('ti-back')?.addEventListener('click', () => { this.clearDraft(); this.renderSetup(); });
      return;
    }
    if (this.locStep >= groups.length) this.locStep = groups.length - 1;
    if (this.locStep < 0) this.locStep = 0;

    const grp = groups[this.locStep];
    const total = groups.reduce((s, g) => s + g.products.length, 0);
    const done = Object.keys(this.draft.counts).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const isLast = this.locStep === groups.length - 1;

    const cards = grp.products.map(p => {
      const c = this.draft.counts[p.id + '@@' + grp.location] || { value: 0, fulls: 0, notes: '' };
      // Bottle beer with case_size set uses a case + loose-bottle input
      // pair. Bottles either are full or empty (no partial level applies),
      // so the slider does not fit. Everything else uses the partial slider.
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      // Input type by what the product actually is: case+loose for bottle beer,
      // a fill slider for anything poured from a container (liquor, wine, draft
      // keg, bottled mixers), and a plain number for food / dry goods counted
      // by weight or unit.
      const isPourable = !!(p.container_size_oz && p.pour_size_oz);
      let countInput;
      if (isCaseBeer) {
        countInput = '<div class="form-row" style="gap:14px;justify-content:center;margin-bottom:14px;">'
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
        countInput = '<div style="display:flex;justify-content:center;margin-bottom:14px;">'
          + BottleSlider.html(p.id, { value: c.value, fulls: c.fulls, category: p.category, shape: (p.category === 'Draft Beer' ? 'keg' : 'bottle') })
          + '</div>';
      } else {
        countInput = '<div class="form-row" style="gap:14px;justify-content:center;margin-bottom:14px;">'
          + '<div class="f" style="width:220px;flex-shrink:0;"><label>Count</label>'
            + '<div class="fw"><input class="suf ti-num" type="number" min="0" step="0.1" data-pid="' + p.id + '" value="' + (c.value != null ? c.value : 0) + '" style="height:44px;font-size:18px;text-align:center;"/><span class="suf">' + esc(App.productUnit(p) || 'units') + '</span></div>'
          + '</div></div>';
      }
      return '<div class="card" data-pid="' + p.id + '" data-case-beer="' + (isCaseBeer ? '1' : '0') + '" data-case-size="' + (p.case_size || 0) + '" style="margin-bottom:12px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(p.name) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + esc(p.category || 'Uncategorized')
        + (p.brand ? ' &middot; ' + esc(p.brand) : '') + '</div>'
        + countInput
        + '<div class="f"><label>Notes</label><input type="text" class="ti-note" data-pid="' + p.id + '" '
        + 'value="' + esc(c.notes || '') + '" placeholder="Optional"/></div>'
        + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--t1);">' + esc(grp.location)
      + ' <span style="color:var(--t3);font-weight:600;font-size:11px;">Location ' + (this.locStep + 1) + ' of ' + groups.length + '</span></div>'
      + '<div style="font-size:11px;color:var(--t3);" id="ti-prog-txt">' + done + ' of ' + total + ' counted</div></div>'
      + '<div style="height:6px;background:var(--input);border-radius:3px;overflow:hidden;">'
      + '<div id="ti-prog-bar" style="height:100%;width:' + pct + '%;background:var(--gold);transition:width 0.2s;"></div></div></div>'
      + cards
      + '<div class="card-actions" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">'
      + '<button class="btn btn-ghost" id="ti-prev"' + (this.locStep === 0 ? ' disabled' : '') + '>&#8592; Previous</button>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost" id="ti-exit">Save &amp; Exit</button>'
        + '<button class="btn btn-ghost" id="ti-discard-count" style="color:var(--red);">Discard Count</button>'
      + '</div>'
      + (isLast
          ? '<button class="btn btn-primary" id="ti-review">Review Count &#8594;</button>'
          : '<button class="btn btn-primary" id="ti-next">Next Location &#8594;</button>')
      + '</div></div>';

    BottleSlider._inst = {};
    grp.products.forEach(p => {
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      if (isCaseBeer) return; // case + loose inputs handled below, not the slider
      if (!(p.container_size_oz && p.pour_size_oz)) return; // food/dry: number input, wired below
      BottleSlider.mount(p.id, (v) => {
        const key = p.id + '@@' + grp.location;
        const prev = this.draft.counts[key] || {};
        this.draft.counts[key] = { value: v.value, fulls: v.fulls, notes: prev.notes || '' };
        this.draft._locStep = this.locStep;
        this.saveDraft();
        this.updateProgress();
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

    this.container.onclick = null;
    document.getElementById('ti-prev')?.addEventListener('click', () => { this.locStep--; this.draft._locStep = this.locStep; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-next')?.addEventListener('click', () => { this.locStep++; this.draft._locStep = this.locStep; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-review')?.addEventListener('click', () => { this.draft._view = 'review'; this.saveDraft(); this.renderReview(); });
    document.getElementById('ti-exit')?.addEventListener('click', () => { this.saveDraft(); App.navigate('ic-product-setup'); });
    document.getElementById('ti-discard-count')?.addEventListener('click', () => this.confirmDiscardDraft());
  },

  updateProgress() {
    const total = this.groups().reduce((s, g) => s + g.products.length, 0);
    const done = Object.keys(this.draft.counts).length;
    const txt = document.getElementById('ti-prog-txt');
    const bar = document.getElementById('ti-prog-bar');
    if (txt) txt.textContent = done + ' of ' + total + ' counted';
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  },

  // ── Review ────────────────────────────────────────────────────────────────
  // Bottle beer is counted and stored in CASES. The operator enters full cases +
  // loose bottles; on-hand = cases + (loose / case_size), kept as a decimal
  // number of cases. Value is at the per-case cost (unit_cost is per case for
  // beer). Every other category is already counted in its container unit.
  rows() {
    const out = [];
    this.groups().forEach(g => g.products.forEach(p => {
      const c = this.draft.counts[p.id + '@@' + g.location] || { value: 0, fulls: 0, notes: '' };
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      let total, value;
      if (isCaseBeer) {
        const cases = c.cases || 0;
        const loose = c.loose || 0;
        total = cases + (p.case_size > 0 ? loose / p.case_size : 0);
        value = p.unit_cost != null ? total * p.unit_cost : null;
      } else {
        total = (c.fulls || 0) + (c.value || 0);
        value = p.unit_cost != null ? total * p.unit_cost : null;
      }
      out.push({ p, c, total, value, isCaseBeer, location: g.location });
    }));
    return out;
  },

  renderReview() {
    const rows = this.rows();
    const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0);
    const counted = Object.keys(this.draft.counts).length;

    const tbody = rows.map(r => {
      const fullCol = r.isCaseBeer ? (r.c.cases || 0) + ' cases' : (r.c.fulls || 0);
      const openCol = r.isCaseBeer ? (r.c.loose || 0) + ' loose' : (r.c.value || 0).toFixed(1);
      const totalCol = r.isCaseBeer
        ? (r.total.toFixed(2) + ' cases (' + (r.c.cases || 0) + ' + ' + (r.c.loose || 0) + ' loose)')
        : r.total.toFixed(1);
      return '<tr>'
        + '<td><div class="val">' + esc(r.p.name) + '</div>'
        + (r.p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.p.brand) + '</div>' : '') + '</td>'
        + '<td>' + esc(r.p.category || '-') + '</td>'
        + '<td>' + fullCol + '</td>'
        + '<td>' + openCol + '</td>'
        + '<td class="val">' + totalCol + '</td>'
        + '<td>' + (r.value != null ? App.fmtCurrency(r.value) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '</tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Review ' + esc(this.draft.type) + ' Count</div>'
      + '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Products</div><div class="calc-val">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val">' + counted + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Inventory Value</div><div class="calc-val good">' + App.fmtCurrency(totalValue) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Full</th><th>Open</th><th>Total</th><th>Value</th>'
      + '</tr></thead><tbody>' + tbody + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:12px;">Products left untouched are recorded at zero. '
      + 'Go back to adjust any product before submitting.</div>'
      + '<div class="card-actions" style="justify-content:space-between;">'
      + '<button class="btn btn-ghost" id="ti-back-count">&#8592; Back to Counting</button>'
      + '<button class="btn btn-primary" id="ti-submit">Submit Count</button>'
      + '<span id="ti-sub-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('ti-back-count')?.addEventListener('click', () => { this.draft._view = 'counting'; this.saveDraft(); this.renderCounting(); });
    document.getElementById('ti-submit')?.addEventListener('click', () => this.submit());
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
          notes:               r.c.notes || ''
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
        notes:      r.c.notes || ''
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
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Count Submitted</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.type) + ' count &middot; ' + record.item_count
      + ' products &middot; ' + App.fmtCurrency(record.total_value) + ' total value</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;text-align:center;margin-bottom:16px;">'
      + 'Usage and variance against your previous count appear in Count History. '
      + 'This count can also feed Profit Recovery COGS for the period.</div>'
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-ghost" id="ti-again">Take Another Count</button>'
      + '<button class="btn btn-primary" id="ti-history">View Count History</button>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('ti-again')?.addEventListener('click', () => this.renderSetup());
    document.getElementById('ti-history')?.addEventListener('click', () => App.navigate('ic-count-history'));
  }
};
