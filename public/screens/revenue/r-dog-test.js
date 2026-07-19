'use strict';

/* ── Revenue Recovery — Dog Test Tracker ──────────────────────────────────────
   A Dog (low margin, low volume) is not always a bad item. Some are buried
   items with a description problem, not bad dishes. Before pulling one, give
   it a 90-day test in a repositioned slot with a rewritten description, and
   track whether volume moves. The Menu Engineering fix process links here. */

S.RevenueDogTest = {
  WINDOW: 90,

  list() {
    if (!Array.isArray(App.data.menu_dog_tests)) App.data.menu_dog_tests = [];
    return App.data.menu_dog_tests;
  },

  _daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  },

  showHowTo() {
    App.showHelpModal('How the Dog Test Tracker Works', [
      { p: ['A Dog (low margin and low volume in the Menu Engineering groups) is not always a bad dish. Some are good items buried in a bad menu slot with a weak description. Before you pull one, give it a fair 90-day test in a better position with a rewritten description and watch whether volume moves.'] },
      { h: 'Starting a Test', p: ['Pick the menu item and Bar Cop auto-fills the baseline from its current weekly units sold on Menu Builder. Note what you changed (new position, new description) and start. The test runs 90 days.'] },
      { h: 'Tracking It', p: ['Current weekly volume reads live from that item\'s weekly units sold on the Menu Builder screen, so keep that number current as service data comes in. The card shows the lift against baseline and counts down the 90 days.'] },
      { h: 'Deciding', p: ['When the test completes, Keep It if volume moved enough to justify the slot, or Cut It to pull it off the menu. Either way the decision snapshots the final volume and lands in Test History. A kept item stays on the menu and shows as Kept back in Menu Engineering; a cut item moves to Archived on Menu Builder, where you can restore it or delete it for good.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const all = this.list();
    const testing = all.filter(t => t.status === 'Testing')
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    const decided = all.filter(t => t.status !== 'Testing')
      .sort((a, b) => (b.decided_at || '').localeCompare(a.decided_at || ''));

    // Filter to items that have a name. Sort alphabetically. Store by ID so
    // renaming the item in Menu Items doesn't orphan the test.
    const items = (App.data.menu_items || []).filter(m => m && m.id && m.name && !m.archived)
      .slice().sort((a, b) => a.name.localeCompare(b.name));
    const opts = '<option value="">Select a menu item...</option>'
      + items.map(m => {
        const wc = m.weekly_covers != null ? (' (current weekly: ' + Math.round(m.weekly_covers) + ')') : '';
        return '<option value="' + esc(m.id) + '">' + esc(m.name) + wc + '</option>';
      }).join('');
    const today = App.todayLocal();

    const form = '<div class="card form-card"><div class="card-title">Start a 90-Day Dog Test</div>'
      + '<div class="form-row" style="flex-wrap:wrap;">'
      + '<div class="f" style="width:280px;"><label>Menu Item</label><select class="form-input" id="dt-item">' + opts + '</select></div>'
      + '<div class="f" style="width:150px;"><label>Start Date</label><input class="form-input" type="date" id="dt-date" value="' + today + '"/></div>'
      + '<div class="f" style="width:170px;"><label>Baseline Weekly Units</label><input class="form-input" type="number" id="dt-base" step="1" placeholder="Auto-fills from item"/></div>'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="flex:1;min-width:260px;"><label>What You Changed</label><input class="form-input" type="text" id="dt-notes" placeholder="New menu position, rewritten description"/></div>'
      + '</div>'
      + '</div>'
      + '<div class="no-print" style="margin:16px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="dt-start">Start Test</button>'
      + '<span id="dt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    // Look up linked menu items so current_volume always reflects the latest
    // weekly_covers on the item — never a stale typed number.
    const itemMap = {};
    (App.data.menu_items || []).forEach(m => { if (m && m.id) itemMap[m.id] = m; });
    const currentFor = t => {
      const linked = t.item_id && itemMap[t.item_id];
      return linked && linked.weekly_covers != null ? linked.weekly_covers : null;
    };

    let active = '';
    if (testing.length) {
      active = '<div class="sh" style="margin:22px 0 10px;">Active Tests</div>' + testing.map(t => {
        const elapsed = Math.max(0, this._daysSince(t.start_date) || 0);
        const pct = Math.min(100, Math.round(elapsed / this.WINDOW * 100));
        const remaining = Math.max(0, this.WINDOW - elapsed);
        const done = elapsed >= this.WINDOW;
        const cur = currentFor(t);
        // Resolve the current item name from the linked id (handles renames).
        const liveName = (t.item_id && itemMap[t.item_id]) ? itemMap[t.item_id].name : (t.item_name || '');
        let liftLine = '';
        if (cur != null && t.baseline_volume) {
          const lift = cur - t.baseline_volume;
          const lpct = t.baseline_volume ? lift / t.baseline_volume * 100 : 0;
          liftLine = '<span style="color:' + (lift >= 0 ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">'
            + (lift >= 0 ? '+' : '') + lift.toFixed(0) + ' units (' + (lift >= 0 ? '+' : '') + lpct.toFixed(0) + '%)</span> vs baseline';
        }
        return '<div class="card" style="margin-bottom:12px;">'
          + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">'
          +   '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(liveName) + '</div>'
          +   '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:' + (done ? 'var(--gold)' : 'var(--t3)') + ';">'
          +     (done ? 'TEST COMPLETE, DECIDE' : 'Day ' + elapsed + ' of ' + this.WINDOW + ', ' + remaining + ' left') + '</div>'
          + '</div>'
          + '<div class="prog" style="margin-bottom:10px;"><div class="prog-fill" style="width:' + pct + '%;background:var(--green);"></div></div>'
          + (t.change_notes ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:10px;">' + esc(t.change_notes) + '</div>' : '')
          + '<div class="form-row" style="margin-bottom:10px;align-items:flex-end;">'
          +   '<div class="f" style="width:150px;"><label>Baseline Weekly</label><div style="font-size:13px;color:var(--t2);padding:8px 0;">' + (t.baseline_volume != null ? t.baseline_volume + ' units' : '-') + '</div></div>'
          +   '<div class="f" style="width:170px;"><label>Current Weekly</label><div style="font-size:13px;color:var(--t1);padding:8px 0;">' + (cur != null ? cur.toFixed(0) + ' units' : '<span style="color:var(--t4);">not set on item</span>') + '</div></div>'
          +   (liftLine ? '<div class="f" style="flex:1;min-width:140px;"><label>&nbsp;</label><div style="font-size:12px;color:var(--t2);padding:8px 0;">' + liftLine + '</div></div>' : '')
          + '</div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
          +   '<button class="btn btn-primary btn-sm dt-keep" data-id="' + esc(t.id) + '">Keep It</button>'
          +   '<button class="btn btn-danger btn-sm dt-remove" data-id="' + esc(t.id) + '">Cut It</button>'
          +   '<button class="btn btn-ghost btn-sm dt-cancel" data-id="' + esc(t.id) + '" style="margin-left:auto;">Cancel Test</button>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    let history = '';
    if (decided.length) {
      const rows = decided.slice(0, App.listLimit('core', 'menu_dog_test')).map(t => {
        const decision = t.status === 'Kept'
          ? '<span style="color:var(--green);font-weight:600;">Kept</span>'
          : '<span style="color:var(--t3);font-weight:600;">Cut</span>';
        // For decided tests, fall back to the volume snapshot saved at decision time.
        const liveCur = currentFor(t);
        const finalCur = (t.current_volume != null) ? t.current_volume : liveCur;
        const lift = (finalCur != null && t.baseline_volume != null) ? (finalCur - t.baseline_volume) : null;
        const liveName = (t.item_id && itemMap[t.item_id]) ? itemMap[t.item_id].name : (t.item_name || '');
        return '<tr><td class="val">' + esc(liveName) + '</td>'
          + '<td>' + esc(t.start_date || '-') + '</td>'
          + '<td>' + (t.baseline_volume != null ? t.baseline_volume : '-') + '</td>'
          + '<td>' + (finalCur != null ? finalCur.toFixed(0) : '-') + '</td>'
          + '<td class="' + (lift == null ? '' : lift >= 0 ? 'pos' : 'neg') + '">' + (lift == null ? '-' : (lift >= 0 ? '+' : '') + lift.toFixed(0)) + '</td>'
          + '<td>' + decision + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm dt-del" data-id="' + esc(t.id) + '">Remove</button></div></td></tr>';
      }).join('');
      history = '<div class="sh" style="margin:22px 0 10px;">Test History</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Item</th><th>Started</th><th>Baseline</th><th>Final Weekly</th><th>Change</th><th>Decision</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('core', 'menu_dog_test', decided, false);
    }

    let emptyMsg = '';
    if (!testing.length && !decided.length) {
      emptyMsg = '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">No Dog tests running. A Dog is not always a bad item. Before you pull one, give it 90 days in a better menu slot with a rewritten description, and track whether volume moves. Start a test above.</div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + form + active + history + emptyMsg + '</div>';
    this.wire();
    // One-shot preselect from Menu Engineering's "Dog Test" action: drop the item
    // into the form and fire the baseline auto-fill.
    if (App._dogTestPreselect) {
      const sel = document.getElementById('dt-item');
      if (sel) { sel.value = App._dogTestPreselect; sel.dispatchEvent(new Event('change')); }
      App._dogTestPreselect = null;
    }
  },

  wire() {
    document.getElementById('dt-start')?.addEventListener('click', () => this.start());
    // Picking an item auto-fills the baseline from item.weekly_covers. Changing
    // to a different item updates that auto value; a baseline the operator typed
    // by hand is left alone (marked manual by the input handler below).
    document.getElementById('dt-item')?.addEventListener('change', e => {
      const baseEl = document.getElementById('dt-base');
      if (!baseEl) return;
      // Only auto-fill when the field is empty or still holds a prior auto value.
      if (baseEl.value && baseEl.dataset.auto !== '1') return;
      const item = (App.data.menu_items || []).find(m => m.id === e.target.value);
      if (item && item.weekly_covers != null) {
        baseEl.value = Math.round(item.weekly_covers);
        baseEl.dataset.auto = '1';
      } else {
        baseEl.value = '';
        delete baseEl.dataset.auto;
      }
    });
    // Typing a baseline by hand marks it manual so switching items won't overwrite it.
    document.getElementById('dt-base')?.addEventListener('input', e => { delete e.target.dataset.auto; });
    this.container.querySelectorAll('.dt-keep').forEach(b =>
      b.addEventListener('click', () => this.decide(b.dataset.id, 'Kept')));
    this.container.querySelectorAll('.dt-remove').forEach(b =>
      b.addEventListener('click', () => this.decide(b.dataset.id, 'Cut')));
    this.container.querySelectorAll('.dt-cancel, .dt-del').forEach(b =>
      b.addEventListener('click', () => this.del(b.dataset.id)));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.draw()));
  },

  start() {
    const itemId = document.getElementById('dt-item')?.value || '';
    const date   = document.getElementById('dt-date')?.value || '';
    const base   = parseFloat(document.getElementById('dt-base')?.value);
    const notes  = document.getElementById('dt-notes')?.value.trim() || '';
    const err = document.getElementById('dt-err');
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } };
    if (!itemId) return fail('Pick the menu item to test.');
    if (!date)   return fail('Enter a start date.');

    const item = (App.data.menu_items || []).find(m => m.id === itemId);
    if (!item) return fail('Item no longer exists. Pick another.');
    if (this.list().some(t => t.item_id === itemId && t.status === 'Testing')) return fail('This item already has an active Dog Test.');

    const rec = {
      id: App.uid(),
      item_id: itemId,
      item_name: item.name,
      start_date: date,
      created_at: new Date().toISOString(),
      baseline_volume: isNaN(base) ? (item.weekly_covers != null ? Math.round(item.weekly_covers) : null) : base,
      change_notes: notes,
      current_volume: null,  // legacy field; reads live from item.weekly_covers via currentFor()
      status: 'Testing',
      decided_at: null
    };
    App.putRecord('core', 'menu_dog_test', rec).then(() => this.draw());
  },

  decide(id, status) {
    const t = this.list().find(x => x.id === id);
    if (!t) return;
    // Snapshot the live volume at decision time so the history record is
    // stable even if weekly_covers on the item changes later.
    const item = t.item_id ? (App.data.menu_items || []).find(m => m.id === t.item_id) : null;
    if (item && item.weekly_covers != null) t.current_volume = item.weekly_covers;
    t.status = status;
    t.decided_at = new Date().toISOString();
    // Cut pulls the item off the menu: it soft-archives so Menu Engineering and
    // Menu Items stop showing it, but it lands in Archived on Menu Items where it
    // can be restored or deleted for good. Keep leaves the item live.
    if (status === 'Cut' && item) {
      item.archived = true;
      App.putRecord('core', 'menu_dog_test', t).then(() => App.putRecord('core', 'menu_item', item)).then(() => this.draw());
      return;
    }
    App.putRecord('core', 'menu_dog_test', t).then(() => this.draw());
  },

  del(id) {
    App.removeRecord('core', 'menu_dog_test', id).then(() => this.draw());
  }
};
