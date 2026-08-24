'use strict';

/* ══ SECTION LINKS ═════════════════════════════════════════════════════════════════════════════
   A section's GROUPS, in the top bar beside the section ICON, each opening its own screens on
   hover. The links themselves never navigate; only a row inside a menu does.

   ⭐⭐ WHY IT IS NOT A SECOND SIDEBAR OR A SECOND ROW. `#rail-menu` was an overlay that showed the
   section's shape and took it away again the moment you picked a row; a tab strip under the top bar
   was a whole extra band of chrome for six words. In the bar there is no new row at all.

   ⛔⛔⛔ EVERY GROUP AND ROW IS DERIVED FROM `navHTML()`, NEVER HAND-KEPT. That one source already
   feeds the section sidebar AND the mobile drawer (`groupsOf` in app.js parses the same markup the
   same way). Add a screen to `nav.js` and it appears in all three or in none.

   ⛔ MOBILE IS UNTOUCHED, BY CONSTRUCTION: this reads `navHTML()` and never writes it, adds no rule
   to `.nav-item`, and both hosts are hidden at the phone breakpoint.

   ⚠ NO PAGE HEADER. One was built (screen name + the help "i" + a rule under it) and Kyle cut it
   after walking it: the screen already names itself, so it was a third spelling of the same fact.
   The help "i" moved to the top bar beside Sign Out and is still the app's ONE info button
   ([[help-model]]) — one node in `index.html`, never a per-page copy.

   ⚠ V1 IS INVENTORY ONLY, by Kyle's call: build one section, settle the design, then roll it out. */

const SectionTabs = {

  /* ⭐ AUDITS JOINED 2026-08-22 (Kyle: *"the rail Audits goes to a top bar menu like inventory does
     with 4 links"*). ONE LINE, because T33 removed the hardcoded `module === 'inventory'` from
     `_srcFor` — before that, adding a key here made `on()` true while the bar hid itself. */
  /* ⭐ THE WEEK JOINED 2026-08-23 (Kyle: *"make a top bar nav.. Close, Review, History.. no drop
     downs on these"*). Three groups of one row, so all three render as links that NAVIGATE and take
     the hand cursor, exactly like the four Audits links.
     ⚠ IT IS THE FIRST SECTION HERE WHOSE RAIL ROW IS A PLAIN `_PROTO_GLOBAL` GO ROW rather than a
     module section or a hub-sidebar section — `_protoGlobalClick('week')` is its door, and
     `verify-section-tabs` H1 admits that as the third kind. */
  /* ⭐⭐⭐ BOOKS JOINED 2026-08-23 (Kyle, T48: *"Money Out, Statements, Cash, Forecasts"* — one solo
     link and three drop-downs). It is the FIRST section that TAKES pages rather than borrowing
     them: Audits left the three module audits registered in their own menus, so nobody lost a
     route, while Books' Cash and Forecasts menus hold six screens that came out of the Cash, Profit
     and Revenue navs in the same edit. That is why this one also moved their PERMISSION areas
     (`DB.SCREEN_GROUPS`) and deliberately did not move their MODULE — `navigate` still renders all
     six from the branch they always lived in. */
  ENABLED: { inventory: true, audit: true, week: true, events: true, books: true, floor: true, menus: true, settings: true },

  /* Support is one row repeated in all seven section sidebars. It is not a group anybody browses,
     and Kyle is folding the FAQs into one global page, so it is kept out of the bar entirely.
     ⛔⛔ IT DOES NOT APPLY TO A `FLAT` SECTION, AND SETTINGS IS WHY. In the other seven sections the
     Support group is Help repeated, so dropping it costs nothing. In SETTINGS it is the only home
     Contact Support and Report a Bug have, and a section with a tab bar has no overlay to fall back
     to — measured with the flag on: the overlay renders at opacity 0, translated -190px, with ZERO
     rows in it. Applying this to Settings would have taken Contact Support off the desktop
     completely, on the same day the phone drawer already hides it in the demo. */
  ASIDE_GROUP: 'Support',

  /* ⭐⭐⭐ A FLAT SECTION IS SEVEN LINKS, NOT THREE MENUS — AND THE MARKUP DOES NOT MOVE.
     Kyle, 2026-08-24: *"just make the menu... Profile, Targets, Account, Backup, Team, Support,
     Bugs"* and, twice, *"settings on mobile stays as it is right now."*
     ⛔⛔ THOSE TWO PULL AGAINST EACH OTHER, AND THAT IS THE WHOLE REASON THIS TABLE EXISTS. The bar
     is derived from `App.navHTMLFor(module)`, which for settings IS `_settingsSidebarHTML()` — the
     same markup the PHONE DRAWER renders. Rewriting it into seven one-row groups would have given
     the bar its seven links and silently rebuilt the phone menu in the same edit. So the markup is
     untouched and the bar re-shapes it on the way out: one row per group (which is what stamps
     `data-solo`, so each navigates and takes the hand cursor), his order, his shorter words.
     ⭐ ROLE GATING COMES FREE, WHICH IS WHY THIS MAPS ACTIONS RATHER THAN LISTING ROWS. Backup is
     owner-only and Team is admin-only, and the sidebar builder already omits them; a row the markup
     did not emit simply is not there to be re-labelled. Hardcoding seven rows here would have
     handed every member all seven, and NEITHER the owner nor the demo could ever have seen it
     ([[the-loop]] #149 — a permission-gated path is invisible to owner-and-demo testing).
     ⚠ HELP AND FAQ IS DELIBERATELY ABSENT. Kyle: *"help again will be a global help page later."*
     It stays in the phone menu, because that markup is the one thing that must not move. */
  FLAT: {
    settings: [
      ['settings-profile', 'Profile'],
      ['settings-targets', 'Targets'],
      ['user-account',     'Account'],
      ['user-data',        'Backup'],
      ['user-team',        'Team'],
      ['contact-support',  'Support'],
      ['report-bug',       'Bugs']
    ]
  },

  on(module) { return !!this.ENABLED[module]; },

  /* ⛔⛔ THIS WAS THE SECOND IMPLEMENTATION, AND IT MADE `ENABLED` A HALF-SWITCH (T33, fixed
     2026-08-22). It hardcoded `module === 'inventory'`, so turning a second section on made
     `on()` true while `groupsFor` returned [] and the bar hid itself — a SILENT no-op, which is
     worse than a broken menu because nothing says so and the next reader blames the feature.
     ⭐ `App.navHTMLFor` is the one resolver, the same table the mobile drawer reads. Adding a
     section is now `ENABLED` alone, which is what that flag always looked like it meant.
     ⚠ STILL GATED: `ENABLED` is unchanged, so this is inert today and Inventory is still the only
     section with a bar. Removing the trap is not rolling anything out. */
  _srcFor(module) {
    return (typeof App !== 'undefined' && App.navHTMLFor) ? App.navHTMLFor(module) : '';
  },

  /* The same walk the mobile drawer does: `.nav-section` opens a group, `.nav-item` adds a row.
     A row with no `data-screen` is an action (Report a Bug), not a destination. */
  groupsFor(module) {
    const html = this._srcFor(module);
    if (!html) return [];
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const out = [];
    let cur = null;
    Array.from(tmp.children).forEach(el => {
      if (!el.classList) return;
      if (el.classList.contains('nav-section')) {
        cur = { name: (el.textContent || '').trim(), rows: [] };
        out.push(cur);
      } else if (el.classList.contains('nav-item')) {
        const screen = el.getAttribute('data-screen');
        /* ⛔⛔ A ROW IS A DESTINATION IF IT CAN BE ROUTED, NOT ONLY IF IT NAMES A SCREEN.
           This read "no data-screen means it is an action (Report a Bug), not a destination" —
           true of every row it had ever seen, because Inventory's rows are all module screens. The
           Operations audit is a HUB page: it opens through `data-hub-action="bar-cop-audit"` and
           carries no screen id, so the old rule dropped the very page the Audits bar exists for.
           ⭐ MEASURED WHAT WIDENING ADMITS before doing it ([[lessons-paid-for]] #58 — widening a
           mechanism's reach invalidates the assumptions that were safe at its old reach): SEVEN
           rows across three sections, and every one opens a page. The modal-only actions (Report a
           Bug, Contact Support, Help and FAQ) all sit in the Support group, which is dropped
           wholesale by `ASIDE_GROUP` and never reaches the bar at all.
           ⚠ SIX OF THE SEVEN ARE IN BOOKS AND SETTINGS, which are not switched on, so this is inert
           for them until Kyle walks those sections. Today it admits exactly one row: the Operations
           audit. */
        const hubAction = el.getAttribute('data-hub-action') || '';
        if (!screen && !hubAction) return;
        const lab = el.querySelector('.nav-label');
        const ic = el.querySelector('.nav-icon');
        if (!cur) { cur = { name: '', rows: [] }; out.push(cur); }
        // The icon rides along for the DROP-DOWN rows only; the top-bar links are text alone.
        cur.rows.push({
          /* ⛔⛔ THE DOOR TRAVELS WITH THE ROW (2026-08-22). A screen id alone was enough while the
             only section was Inventory, where every row is a module screen in the ACTIVE module and
             `navigate` reaches it. The Audits section is not that: `hub-bar-cop-audit` is a HUB page
             opened by `S.HubBarCopAudit.open()`, and the other three are module screens in THREE
             DIFFERENT modules. Handing any of them to `navigate` lands nowhere
             ([[lessons-paid-for]] #146 — `navigate` is module-internal, and the wrong door shipped
             three dead links last time; #24 — a hub page is not a module screen). */
          hubAction: hubAction,
          mod: el.getAttribute('data-mod') || '',
          /* ⚠ A SCREEN-LESS ROW STILL NEEDS AN IDENTITY. `tabOf` and the active mark compare
             `r.screen` against the current screen id, so a row routed by action falls back to its
             action as its key. That keeps one field doing one job instead of every reader learning
             about two. */
          screen: screen || hubAction,
          label: lab ? (lab.textContent || '').trim() : screen,
          icon: ic ? ic.outerHTML : ''
        });
      }
    });
    /* ⭐ THE FLAT RE-SHAPE. Everything above is untouched: the same walk over the same markup, so
       whatever the sidebar decided about this member's role has already happened. All this does is
       pick the rows out by ACTION, put them in Kyle's order, give them his shorter words, and hand
       back one group each so the renderer stamps them solo.
       ⚠ `filter` BEFORE `map`, deliberately: a row the markup withheld (Backup from a non-owner,
       Team from a non-admin) must vanish, not render as an undefined link. */
    const flat = this.FLAT && this.FLAT[module];
    if (flat) {
      const byAction = {};
      out.forEach(g => g.rows.forEach(r => { byAction[r.hubAction || r.screen] = r; }));
      return flat.filter(([action]) => !!byAction[action])
                 .map(([action, label]) => ({
                   name: label,
                   rows: [Object.assign({}, byAction[action], { label: label })]
                 }));
    }
    return out.filter(g => g.rows.length && g.name !== this.ASIDE_GROUP);
  },

  tabOf(module, screen) {
    const gs = this.groupsFor(module);
    for (let i = 0; i < gs.length; i++) if (gs[i].rows.some(r => r.screen === screen)) return i;
    return -1;
  },

  /* ⚠ `labelOf` LIVED HERE AND WENT WITH THE PAGE HEADER. It existed only to name the screen in
     that header; once the header was cut it had no caller, and `verify-no-retired-code` failed the
     gate on it the same run. Retiring a feature is the render call, the orphaned helpers AND the
     help text ([[the-loop]] #61) — the ratchet caught the helper I walked past. */

  linkHost() { return document.getElementById('sec-links'); },

  /* Take the menu off the page without forgetting WHICH group was open. `_openDrop` needs this:
     calling the full `close()` from there reset `_openTab` to -1 immediately after the caller had
     set it, so the re-open-after-rebuild never fired and the menu vanished on navigation again. */
  _teardown() {
    clearTimeout(this._closeT);
    if (this._drop) { this._drop.remove(); this._drop = null; }
    const h = this.linkHost();
    if (h) Array.from(h.querySelectorAll('.st-link')).forEach(t => t.classList.remove('st-open'));
  },

  close() {
    this._teardown();
    this._openTab = -1;
  },

  /* ⛔⛔ A GRACE PERIOD ON THE WAY OUT, AND IT IS NOT A NICETY — IT IS THE FIX FOR "the drop down
     goes away before you can click a link" (Kyle, walking the pushed build). The menu is a fixed
     element hung off `body` while the links live in the bar, so the pointer travelling between them
     leaves one box before it enters the other, and any gap at all — a rounding, a border, a
     diagonal path — lands it on the page and shuts the menu mid-journey.
     ⭐ Chasing that with pixels is a losing game; every layout change re-opens it. Closing on a
     short timer that any re-entry cancels makes the menu forgiving of the whole class. */
  _scheduleClose() {
    clearTimeout(this._closeT);
    this._closeT = setTimeout(() => this.close(), 220);
  },
  _cancelClose() { clearTimeout(this._closeT); },

  /* Is this node part of the menu? The drop hangs off BODY now, so "still inside" spans two
     separate subtrees and cannot be answered by one `contains`. */
  _inMenu(node) {
    if (!node) return false;
    const h = this.linkHost();
    return !!((h && h.contains(node)) || (this._drop && this._drop.contains(node)));
  },

  render(module, screen) {
    this._screen = screen;
    /* The context this bar was drawn for. `_wire`'s handlers run long after `render` returns and
       cannot re-derive it — see the note in `_wire` on why `_activeModule` is the wrong source. */
    this._ctx = module;
    this._renderLinks(module, screen);
  },

  _renderLinks(module, screen) {
    const h = this.linkHost();
    if (!h) return;
    if (!this.on(module)) { h.innerHTML = ''; h.hidden = true; return; }
    const groups = this.groupsFor(module);
    if (!groups.length) { h.innerHTML = ''; h.hidden = true; return; }

    h.innerHTML = '';
    h.hidden = false;
    const active = this.tabOf(module, screen);

    groups.forEach((g, i) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'st-link' + (i === active ? ' st-on' : '');
      t.textContent = g.name || 'More';
      t.setAttribute('data-tab', String(i));
      /* ⭐⭐ A GROUP WITH ONE DESTINATION IS A LINK, NOT A MENU (Kyle, 2026-08-22: four audit links
         "each going to the corresponding audit landing page"). A drop-down holding a single row is
         theatre: it makes the operator press twice to reach the only thing behind it.
         ⚠ THIS DOES NOT BEND THE "CLICK NEVER NAVIGATES" RULE, IT RESPECTS ITS REASON. Kyle wrote
         that rule because *"a link that both opened a menu and moved you was two jobs on one
         control"*. A solo link opens no menu, so there is only ever one job. Inventory is unchanged:
         every one of its groups holds several screens, so every one of its links still opens. */
      if (g.rows.length === 1) t.setAttribute('data-solo', g.rows[0].screen);
      h.appendChild(t);
    });

    this._wire(h);

    /* ⛔⛔ RE-OPEN THE DROP AFTER A REBUILD, AND THIS IS THE BUG KYLE FOUND BY WALKING IT.
       The first version created the drop and THEN navigated. `navigate` calls `_afterNavigate`,
       which calls this render, which clears `innerHTML` — so the menu was built and destroyed in
       the same press and no drop-down ever appeared on any link you were not already inside.
       Holding the open group across the rebuild is what makes the two orders agree. */
    if (this._openTab >= 0 && groups[this._openTab]) {
      const t = h.querySelector('.st-link[data-tab="' + this._openTab + '"]');
      if (t) this._openDrop(t, groups[this._openTab]);
    }
  },

  /* ⛔⛔⛔ THE MENU HANGS OFF `body`, NOT OFF THE BAR, AND THAT IS THE FIX FOR "it goes behind the
     page". It was never a stacking problem: `#proto-topnav` is `height:var(--navh)` with
     `overflow:hidden`, so a child hanging below 52px was CLIPPED OUT OF EXISTENCE. No z-index
     could have rescued it. Measured live before changing anything: the links' box ended at y=36
     and the bar at y=52.
     ⭐ Anchored to the BAR'S OWN BOTTOM EDGE rather than the link's, so it opens on the top bar's
     divider line whatever the link's height happens to be — which is what Kyle asked for and is
     also what removes the dead gap the pointer used to cross on its way down. */
  _openDrop(linkEl, group) {
    this._teardown();
    linkEl.classList.add('st-open');
    const d = document.createElement('div');
    d.className = 'st-drop';
    group.rows.forEach(r => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'st-row' + (r.screen === this._screen ? ' st-row-on' : '');
      row.setAttribute('data-screen', r.screen);
      if (r.hubAction) row.setAttribute('data-hub-action', r.hubAction);
      if (r.mod) row.setAttribute('data-mod', r.mod);
      if (r.icon) {
        const ic = document.createElement('span');
        ic.className = 'st-ic';
        ic.innerHTML = r.icon;
        row.appendChild(ic);
      }
      const lb = document.createElement('span');
      lb.textContent = r.label;
      row.appendChild(lb);
      d.appendChild(row);
    });
    d.addEventListener('click', (e) => {
      const row = e.target.closest && e.target.closest('.st-row');
      if (row) this._goRow(row);
    });
    d.addEventListener('mouseenter', () => this._cancelClose());
    d.addEventListener('mouseleave', (e) => { if (!this._inMenu(e.relatedTarget)) this._scheduleClose(); });
    document.body.appendChild(d);
    const r = linkEl.getBoundingClientRect();
    const nav = document.getElementById('proto-topnav');
    const top = nav ? nav.getBoundingClientRect().bottom : r.bottom;
    d.style.left = Math.round(r.left) + 'px';
    d.style.top = Math.round(top) + 'px';
    this._drop = d;
  },

  /* ⛔⛔⛔ ROUTE BY THE ROW'S OWN DOOR. `_go` used to hand every screen id to `App.navigate`, which
     is MODULE-INTERNAL: it branches on `_activeModule` and only consults a module's map once that
     module is active. Fine while Inventory was the only section, where every row is a screen in the
     module you are already in. Not fine for Audits, whose four rows are one HUB page and three
     module screens in three DIFFERENT modules ([[lessons-paid-for]] #146/#24).
     ⭐ AND IT DELEGATES RATHER THAN RE-IMPLEMENTING. `S.Hub.routeSidebarAction` already knows how
     to route a sidebar row and says so in its own comment: *"One implementation, so a new action
     reaches both surfaces the day it is added rather than the day somebody remembers the second
     copy."* A third copy of that table here is exactly the drift the suite exists to catch.
     ⚠ INVENTORY'S PATH IS BYTE-IDENTICAL. Its rows carry no `data-hub-action`, so they still take
     `App.navigate(screen)` — the settled, walked behaviour. Only a row that HAS a door uses it. */
  _goRow(row) {
    if (!row) return;
    const action = row.getAttribute('data-hub-action') || '';
    const screen = row.getAttribute('data-screen') || '';
    this.close();
    if (typeof App === 'undefined') return;
    if (action && typeof S !== 'undefined' && S.Hub && S.Hub.routeSidebarAction) {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.setAttribute('data-hub-action', action);
      if (screen) el.setAttribute('data-screen', screen);
      const mod = row.getAttribute('data-mod');
      if (mod) el.setAttribute('data-mod', mod);
      S.Hub.routeSidebarAction(el);
      return;
    }
    if (screen) App.navigate(screen);
  },


  _wire(h) {
    if (h._stWired) return;
    h._stWired = true;

    /* ⛔ THE GROUP LINKS ARE NOT CLICKABLE (Kyle's call). They open their menu on hover and do
       nothing else; only a row inside the menu navigates. A link that both opened a menu and moved
       you was two jobs on one control, and the move happened before you had read the menu. */
    /* A solo link is a destination, so it takes a real click. Group links still do nothing here. */
    h.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('.st-link');
      if (!link) return;
      const solo = link.getAttribute('data-solo');
      if (!solo) return;
      const groups = this.groupsFor(this._ctx || App._activeModule);
      const g = groups[Number(link.getAttribute('data-tab'))];
      const r = g && g.rows[0];
      if (!r) return;
      const el = document.createElement('div');
      el.setAttribute('data-screen', r.screen);
      if (r.hubAction) el.setAttribute('data-hub-action', r.hubAction);
      if (r.mod) el.setAttribute('data-mod', r.mod);
      this._goRow(el);
    });

    h.addEventListener('mouseover', (e) => {
      const link = e.target.closest && e.target.closest('.st-link');
      if (!link) return;
      this._cancelClose();
      /* ⛔ A SOLO LINK OPENS NOTHING. It navigates on click (see `_renderLinks`), so hovering it
         must not build a one-row menu the operator then has to press through. */
      if (link.getAttribute('data-solo')) { this.close(); return; }
      const idx = Number(link.getAttribute('data-tab'));
      if (this._openTab === idx && this._drop) return;
      /* ⛔⛔ THE SAME CONTEXT THE RENDER USED, NOT `_activeModule` (fixed 2026-08-22). `_renderLinks`
         is called with the RAIL's context, which is the only thing that knows about hub-shell pages
         as well as module screens — that was the fix for "the menu survived onto Books". This
         handler read `App._activeModule` instead, a DIFFERENT source that is stale on any hub page,
         so the Audits bar would have opened Inventory's groups or none at all. Inventory never
         exposed it because for a module section the two agree. Two spellings of "where am I" is how
         they drift ([[the-loop]] #54 — when two things answer the same question, they must agree). */
      const groups = this.groupsFor(this._ctx || App._activeModule);
      const g = groups[idx];
      if (!g || !g.rows.length) return;
      this._openTab = idx;
      this._openDrop(link, g);
    });

    /* ⛔ CONTAINMENT, NOT GEOMETRY, and it now spans TWO subtrees: the links live in the bar and
       the menu hangs off `body`, so "am I still in the menu" cannot be one `contains` any more.
       ⚠ The link host stretches to the bar's full height (`align-self:stretch`) so the pointer
       travelling down never crosses dead space between the link and the menu. Without that the
       menu shuts on the way to itself. */
    h.addEventListener('mouseleave', (e) => {
      if (!this._inMenu(e.relatedTarget)) this._scheduleClose();
    });

    document.addEventListener('click', (e) => { if (!this._inMenu(e.target)) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }
};

if (typeof window !== 'undefined') window.SectionTabs = SectionTabs;
if (typeof module !== 'undefined' && module.exports) module.exports = SectionTabs;
