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
      this._cancelClose();
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
      if (!this._inMenu(e.relatedTarget)) this._scheduleClose();
    });

    document.addEventListener('click', (e) => { if (!this._inMenu(e.target)) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }
};

if (typeof window !== 'undefined') window.SectionTabs = SectionTabs;
if (typeof module !== 'undefined' && module.exports) module.exports = SectionTabs;
