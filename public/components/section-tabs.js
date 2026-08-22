'use strict';

/* ══ SECTION TABS ══════════════════════════════════════════════════════════════════════════════
   A permanent horizontal bar of a section's GROUPS, each opening its own screens, replacing the
   overlay menu that opened on a rail click and closed again the moment you picked a row.

   ⭐⭐ THE POINT IS ORIENTATION, NOT WIDTH. `#rail-menu` was never a permanent second column — it
   is an overlay that closes on selection, so the content was always full width. What it cost was
   the section's SHAPE: eighteen Inventory screens in six groups, all of it invisible until you
   opened a menu, and invisible again the moment you chose. The bar keeps the groups on screen.

   ⛔⛔⛔ EVERY GROUP AND ROW IS DERIVED FROM `navHTML()`, NEVER HAND-KEPT. That one source already
   feeds the section sidebar AND the mobile drawer (`groupsOf` in app.js parses the same markup the
   same way). A second list of the same fact is how a nav row goes missing from one surface and not
   the other, and this codebase has paid for a hand-kept list more than once. Add a screen to
   `nav.js` and it appears here, in the sidebar and in the drawer together or not at all.

   ⛔ MOBILE IS UNTOUCHED, BY CONSTRUCTION. This reads `navHTML()` and never writes it, adds no
   class to `.nav-item`, and renders into its own host. The drawer keeps parsing exactly what it
   parsed before.

   ⛔ NEW CLASSES ONLY, NEVER A RESTYLE OF `.nav-item`. Kyle's rules for this bar are the opposite
   of the sidebar's: no hover background, the label stays `--t1`, only the ICON goes gold on hover.
   Applying that to `.nav-item` would change the sidebar and therefore the mobile drawer.

   ⚠ V1 IS INVENTORY ONLY, by Kyle's call: build one section, adjust the design, then roll it out
   so every section stays cohesive. `ENABLED` is the whole switch. */

const SectionTabs = {

  ENABLED: { inventory: true },

  /* The group whose rows become the right-hand Help icon rather than a tab of their own. Support
     is one row repeated in all seven section sidebars; it does not deserve a seventh tab. */
  ASIDE_GROUP: 'Support',

  on(module) { return !!this.ENABLED[module]; },

  _srcFor(module) {
    try {
      if (module === 'inventory' && typeof Inventory !== 'undefined') return Inventory.navHTML();
    } catch (e) { console.error('SectionTabs: nav source failed', e); }
    return '';
  },

  /* Parse the section's own sidebar markup into groups. Deliberately the SAME walk the mobile
     drawer does: `.nav-section` opens a group, `.nav-item` adds a row to it. A row with no
     `data-screen` is an action (Report a Bug), not a destination, and is skipped here. */
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
        const ic  = el.querySelector('.nav-icon');
        if (!cur) { cur = { name: '', rows: [] }; out.push(cur); }
        cur.rows.push({
          screen: screen,
          label: lab ? (lab.textContent || '').trim() : screen,
          icon: ic ? ic.outerHTML : ''
        });
      }
    });
    return out.filter(g => g.rows.length);
  },

  /* Which tab owns a screen. This is what lights the right tab when an operator arrives from a Fix
     step, a Hub row or an audit action item rather than from the bar itself. Derived, so a screen
     that moves group in `nav.js` moves tab here with no second edit. */
  tabOf(module, screen) {
    const gs = this.groupsFor(module);
    for (let i = 0; i < gs.length; i++) {
      if (gs[i].rows.some(r => r.screen === screen)) return i;
    }
    return -1;
  },

  host() { return document.getElementById('section-tabs'); },

  close() {
    const h = this.host();
    if (!h) return;
    const d = h.querySelector('.st-drop');
    if (d) d.remove();
    Array.from(h.querySelectorAll('.st-tab')).forEach(t => t.classList.remove('st-open'));
  },

  /* Render for the active module. Called on every navigate so the lit tab follows the screen.
     ⚠ Rebuilt rather than patched: the groups come from `navHTML()`, which is itself rebuilt per
     render, so patching would need a diff of two things that are already cheap to make. */
  render(module, screen) {
    const h = this.host();
    if (!h) return;
    if (!this.on(module)) { h.innerHTML = ''; h.hidden = true; return; }

    const groups = this.groupsFor(module);
    if (!groups.length) { h.innerHTML = ''; h.hidden = true; return; }
    // The screen this bar is currently showing. Held here so the click handler never has to ask
    // App for it (see the note in _wire).
    this._screen = screen;

    h.innerHTML = '';
    h.hidden = false;
    const active = this.tabOf(module, screen);

    const bar = document.createElement('div');
    bar.className = 'st-bar';

    groups.forEach((g, i) => {
      if (g.name === this.ASIDE_GROUP) return;
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'st-tab' + (i === active ? ' st-on' : '');
      t.textContent = g.name || 'More';
      t.setAttribute('data-tab', String(i));
      bar.appendChild(t);
    });

    /* Help sits at the right end as an icon, not a tab. Its row is whatever the Support group
       holds, so it cannot drift from the sidebar's own Help destination. */
    const hg = groups.find(g => g.name === this.ASIDE_GROUP);
    if (hg && hg.rows.length) {
      const sp = document.createElement('span');
      sp.className = 'st-gap';
      bar.appendChild(sp);
      const hb = document.createElement('button');
      hb.type = 'button';
      hb.className = 'st-help';
      hb.setAttribute('aria-label', hg.rows[0].label || 'Help');
      hb.title = hg.rows[0].label || 'Help';
      hb.setAttribute('data-screen', hg.rows[0].screen);
      hb.innerHTML = hg.rows[0].icon;
      bar.appendChild(hb);
    }

    h.appendChild(bar);
    this._wire(h, module, groups);
  },

  _openDrop(h, tabEl, group) {
    this.close();
    tabEl.classList.add('st-open');
    const d = document.createElement('div');
    d.className = 'st-drop';
    group.rows.forEach(r => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'st-row';
      row.setAttribute('data-screen', r.screen);
      if (r.icon) {
        const ic = document.createElement('span');
        ic.className = 'st-ic';
        ic.innerHTML = r.icon;
        row.appendChild(ic);
      }
      const lb = document.createElement('span');
      lb.className = 'st-lb';
      lb.textContent = r.label;
      row.appendChild(lb);
      d.appendChild(row);
    });
    h.appendChild(d);
    d.style.left = Math.max(0, tabEl.offsetLeft) + 'px';
  },

  _go(screen) {
    this.close();
    if (typeof App === 'undefined' || !screen) return;
    App.navigate(screen);
  },

  _wire(h, module, groups) {
    if (h._stWired) return;
    h._stWired = true;

    h.addEventListener('click', (e) => {
      const help = e.target.closest && e.target.closest('.st-help');
      if (help) { this._go(help.getAttribute('data-screen')); return; }

      const row = e.target.closest && e.target.closest('.st-row');
      if (row) { this._go(row.getAttribute('data-screen')); return; }

      const tab = e.target.closest && e.target.closest('.st-tab');
      if (!tab) return;
      const gs = this.groupsFor(App._activeModule);
      const g = gs[Number(tab.getAttribute('data-tab'))];
      if (!g || !g.rows.length) return;
      /* Kyle's rule, and it is what keeps the common path at two clicks: the tab NAVIGATES to its
         first screen and shows the siblings at the same time. Take Inventory stays exactly as far
         away as it is today; only its siblings cost a third click. */
      if (tab.classList.contains('st-open')) { this.close(); return; }
      this._openDrop(h, tab, g);
      /* ⛔ LAND ONLY IF YOU ARE NOT ALREADY IN THIS GROUP, and the test is the whole GROUP, not the
         group's first screen. Comparing against the first screen alone throws an operator sitting
         on Count History back to Take Inventory just for opening the menu they are already inside.
         ⛔⛔ AND IT READS THE SCREEN THIS COMPONENT WAS HANDED, not a private field on App. Two
         earlier versions reached into App: `_activeScreen`, which does not exist at all, then
         `_currentScreenId`, which does exist but is assigned at runtime and never declared — and
         `verify-app-member-refs` failed the gate on it, correctly. `render(module, screen)` is
         already told the screen; a component that is given a fact should not go looking for it. */
      const here = g.rows.some(r => r.screen === this._screen);
      if (!here) App.navigate(g.rows[0].screen);
    });

    /* Close on an outside click and on Escape. A hover-opened menu is wrong on the tablet people
       actually count on, so this is click-driven throughout. */
    document.addEventListener('click', (e) => {
      if (!h.contains(e.target)) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }
};

if (typeof window !== 'undefined') window.SectionTabs = SectionTabs;
if (typeof module !== 'undefined' && module.exports) module.exports = SectionTabs;
