'use strict';

/* ══ SECTION LINKS ═════════════════════════════════════════════════════════════════════════════
   A section's GROUPS, in the top bar beside the section name, each opening its own screens. The
   page below gets its own header: the screen's name with the help "i" beside it, left aligned.

   ⭐⭐ WHY IT IS NOT A SECOND SIDEBAR OR A SECOND ROW. `#rail-menu` was an overlay that showed the
   section's shape and took it away again the moment you picked a row; a tab strip under the top bar
   was a whole extra band of chrome for six words. In the bar there is no new row at all.

   ⛔⛔⛔ EVERY GROUP AND ROW IS DERIVED FROM `navHTML()`, NEVER HAND-KEPT. That one source already
   feeds the section sidebar AND the mobile drawer (`groupsOf` in app.js parses the same markup the
   same way). Add a screen to `nav.js` and it appears in all three or in none.

   ⛔ MOBILE IS UNTOUCHED, BY CONSTRUCTION: this reads `navHTML()` and never writes it, adds no rule
   to `.nav-item`, and both hosts are hidden at the phone breakpoint.

   ⛔ ONE HELP "i" IN THE APP ([[help-model]]). The page header does not RENDER a second one — it
   MOVES the existing `#tn-help` node into itself. Two info buttons is exactly the drift that rule
   exists to prevent, and a copy would have gone stale the first time the real one changed.

   ⚠ V1 IS INVENTORY ONLY, by Kyle's call: build one section, settle the design, then roll it out. */

const SectionTabs = {

  ENABLED: { inventory: true },

  /* Support is one row repeated in all seven section sidebars. It is not a group anybody browses,
     and Kyle is folding the FAQs into one global page, so it is kept out of the bar entirely. */
  ASIDE_GROUP: 'Support',

  on(module) { return !!this.ENABLED[module]; },

  _srcFor(module) {
    try {
      if (module === 'inventory' && typeof Inventory !== 'undefined') return Inventory.navHTML();
    } catch (e) { console.error('SectionTabs: nav source failed', e); }
    return '';
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
        if (!screen) return;
        const lab = el.querySelector('.nav-label');
        const ic = el.querySelector('.nav-icon');
        if (!cur) { cur = { name: '', rows: [] }; out.push(cur); }
        // The icon rides along for the DROP-DOWN rows only; the top-bar links are text alone.
        cur.rows.push({
          screen: screen,
          label: lab ? (lab.textContent || '').trim() : screen,
          icon: ic ? ic.outerHTML : ''
        });
      }
    });
    return out.filter(g => g.rows.length && g.name !== this.ASIDE_GROUP);
  },

  tabOf(module, screen) {
    const gs = this.groupsFor(module);
    for (let i = 0; i < gs.length; i++) if (gs[i].rows.some(r => r.screen === screen)) return i;
    return -1;
  },

  labelOf(module, screen) {
    const gs = this.groupsFor(module);
    for (const g of gs) for (const r of g.rows) if (r.screen === screen) return r.label;
    return '';
  },

  linkHost() { return document.getElementById('sec-links'); },
  headHost() { return document.getElementById('sec-head'); },

  close() {
    if (this._drop) { this._drop.remove(); this._drop = null; }
    const h = this.linkHost();
    if (h) Array.from(h.querySelectorAll('.st-link')).forEach(t => t.classList.remove('st-open'));
    this._openTab = -1;
  },

  /* Is this node part of the menu? The drop hangs off BODY now, so "still inside" spans two
     separate subtrees and cannot be answered by one `contains`. */
  _inMenu(node) {
    if (!node) return false;
    const h = this.linkHost();
    return !!((h && h.contains(node)) || (this._drop && this._drop.contains(node)));
  },

  render(module, screen) {
    this._screen = screen;
    this._renderLinks(module, screen);
    this._renderHead(module, screen);
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

  /* The page's own header: the screen's name, left aligned, with the app's ONE help "i" beside it.
     The name comes from the same `navHTML()` row the link menu is built from, so the header and the
     menu can never disagree about what a screen is called. */
  _renderHead(module, screen) {
    const h = this.headHost();
    if (!h) return;
    const tnHelp = document.getElementById('tn-help');
    if (!this.on(module)) {
      h.innerHTML = '';
      h.hidden = true;
      if (tnHelp && tnHelp.parentElement === h) {
        const page = document.querySelector('.tn-page');
        if (page) page.appendChild(tnHelp);
      }
      return;
    }
    const name = this.labelOf(module, screen);
    h.innerHTML = '';
    h.hidden = false;
    const t = document.createElement('h2');
    t.className = 'ph-title';
    t.textContent = name || '';
    h.appendChild(t);
    // MOVED, never copied: one info button in the app.
    if (tnHelp) h.appendChild(tnHelp);
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
    this.close();
    linkEl.classList.add('st-open');
    const d = document.createElement('div');
    d.className = 'st-drop';
    group.rows.forEach(r => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'st-row' + (r.screen === this._screen ? ' st-row-on' : '');
      row.setAttribute('data-screen', r.screen);
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
      if (row) this._go(row.getAttribute('data-screen'));
    });
    d.addEventListener('mouseleave', (e) => { if (!this._inMenu(e.relatedTarget)) this.close(); });
    document.body.appendChild(d);
    const r = linkEl.getBoundingClientRect();
    const nav = document.getElementById('proto-topnav');
    const top = nav ? nav.getBoundingClientRect().bottom : r.bottom;
    d.style.left = Math.round(r.left) + 'px';
    d.style.top = Math.round(top) + 'px';
    this._drop = d;
  },

  _go(screen) {
    this.close();
    if (typeof App === 'undefined' || !screen) return;
    App.navigate(screen);
  },

  _wire(h) {
    if (h._stWired) return;
    h._stWired = true;

    /* ⛔ THE GROUP LINKS ARE NOT CLICKABLE (Kyle's call). They open their menu on hover and do
       nothing else; only a row inside the menu navigates. A link that both opened a menu and moved
       you was two jobs on one control, and the move happened before you had read the menu. */
    h.addEventListener('mouseover', (e) => {
      const link = e.target.closest && e.target.closest('.st-link');
      if (!link) return;
      const idx = Number(link.getAttribute('data-tab'));
      if (this._openTab === idx && this._drop) return;
      const groups = this.groupsFor(App._activeModule);
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
      if (!this._inMenu(e.relatedTarget)) this.close();
    });

    document.addEventListener('click', (e) => { if (!this._inMenu(e.target)) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }
};

if (typeof window !== 'undefined') window.SectionTabs = SectionTabs;
if (typeof module !== 'undefined' && module.exports) module.exports = SectionTabs;
