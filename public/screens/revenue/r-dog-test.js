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
    const items = (App.data.menu_items || []).filter(m => m && m.id && m.name)
      .slice().sort((a, b) => a.name.localeCompare(b.name));
    const opts = '<option value="">Select a menu item...</option>'
      + items.map(m => {
        const wc = m.weekly_covers != null ? (' (current weekly: ' + Math.round(m.weekly_covers) + ')') : '';
        return '<option value="' + esc(m.id) + '">' + esc(m.name) + wc + '</option>';
      }).join('');
    const today = new Date().toISOString().slice(0, 10);

    const form = '<div class="card"><div class="card-title">Start a 90-Day Dog Test</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
      + 'Picking an item auto-fills the baseline from its current weekly_covers on the Menu Items screen. As you update weekly_covers there during the test, current volume here updates automatically.'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:280px;"><label>Menu Item</label><select id="dt-item">' + opts + '</select></div>'
      + '<div class="f" style="width:150px;"><label>Start Date</label><input type="date" id="dt-date" value="' + today + '"/></div>'
      + '<div class="f" style="width:160px;"><label>Baseline Weekly Units</label><input type="number" id="dt-base" step="1" placeholder="Auto-fills from item"/></div>'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="flex:1;min-width:260px;"><label>What You Changed</label><input type="text" id="dt-notes" placeholder="New menu position, rewritten description"/></div>'
      + '</div>'
      + '<div id="dt-err" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none;"></div>'
      + '<button class="btn btn-primary" id="dt-start">Start Test</button>'
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
      active = '<div class="sh">Active Tests</div>' + testing.map(t => {
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
          + '<div class="prog" style="margin-bottom:10px;"><div class="prog-fill" style="width:' + pct + '%;"></div></div>'
          + (t.change_notes ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:10px;">' + esc(t.change_notes) + '</div>' : '')
          + '<div class="form-row" style="margin-bottom:10px;align-items:flex-end;">'
          +   '<div class="f" style="width:150px;"><label>Baseline Weekly</label><div style="font-size:13px;color:var(--t2);padding:8px 0;">' + (t.baseline_volume != null ? t.baseline_volume + ' units' : '-') + '</div></div>'
          +   '<div class="f" style="width:170px;"><label>Current Weekly</label><div style="font-size:13px;color:var(--t1);padding:8px 0;">' + (cur != null ? cur.toFixed(0) + ' units' : '<span style="color:var(--t4);">not set on item</span>') + '</div></div>'
          +   (liftLine ? '<div class="f" style="flex:1;min-width:140px;"><label>&nbsp;</label><div style="font-size:12px;color:var(--t2);padding:8px 0;">' + liftLine + '</div></div>' : '')
          + '</div>'
          + '<div style="font-size:10px;color:var(--t3);margin-bottom:10px;">Current weekly reads from this menu item\'s weekly_covers on the Menu Items screen. Update there as service data comes in.</div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
          +   '<button class="btn btn-primary btn-sm dt-keep" data-id="' + esc(t.id) + '">Keep It</button>'
          +   '<button class="btn btn-danger btn-sm dt-remove" data-id="' + esc(t.id) + '">Remove It</button>'
          +   '<button class="btn btn-ghost btn-sm dt-cancel" data-id="' + esc(t.id) + '" style="margin-left:auto;">Cancel Test</button>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    let history = '';
    if (decided.length) {
      const rows = decided.map(t => {
        const badge = t.status === 'Kept'
          ? '<span class="badge badge-ok">Kept</span>'
          : '<span class="badge badge-warn">Removed</span>';
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
          + '<td>' + badge + '</td>'
          + '<td><button class="btn btn-ghost btn-sm dt-del" data-id="' + esc(t.id) + '">Remove</button></td></tr>';
      }).join('');
      history = '<div class="sh">Test History</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Item</th><th>Started</th><th>Baseline</th><th>Final Weekly</th><th>Change</th><th>Decision</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    let emptyMsg = '';
    if (!testing.length && !decided.length) {
      emptyMsg = '<div class="card"><div class="empty"><div class="empty-title">No Dog tests running</div>'
        + '<div class="empty-sub">A Dog is not always a bad item. Before you pull one, give it 90 days in a better menu slot with a rewritten description, and track whether volume moves. Start a test above.</div></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + form + active + history + emptyMsg + '</div>';
    this.wire();
  },

  wire() {
    document.getElementById('dt-start')?.addEventListener('click', () => this.start());
    // Picking an item auto-fills the baseline from item.weekly_covers if the
    // operator hasn't typed a value yet.
    document.getElementById('dt-item')?.addEventListener('change', e => {
      const item = (App.data.menu_items || []).find(m => m.id === e.target.value);
      const baseEl = document.getElementById('dt-base');
      if (item && baseEl && !baseEl.value && item.weekly_covers != null) {
        baseEl.value = Math.round(item.weekly_covers);
      }
    });
    this.container.querySelectorAll('.dt-keep').forEach(b =>
      b.addEventListener('click', () => this.decide(b.dataset.id, 'Kept')));
    this.container.querySelectorAll('.dt-remove').forEach(b =>
      b.addEventListener('click', () => this.decide(b.dataset.id, 'Removed')));
    this.container.querySelectorAll('.dt-cancel, .dt-del').forEach(b =>
      b.addEventListener('click', () => this.del(b.dataset.id)));
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

    this.list().push({
      id: App.uid(),
      item_id: itemId,
      item_name: item.name,
      start_date: date,
      baseline_volume: isNaN(base) ? (item.weekly_covers != null ? Math.round(item.weekly_covers) : null) : base,
      change_notes: notes,
      current_volume: null,  // legacy field; reads live from item.weekly_covers via currentFor()
      status: 'Testing',
      decided_at: null
    });
    App.saveKey('menu_dog_tests').then(() => this.draw());
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
    App.saveKey('menu_dog_tests').then(() => this.draw());
  },

  del(id) {
    App.data.menu_dog_tests = this.list().filter(x => x.id !== id);
    App.saveKey('menu_dog_tests').then(() => this.draw());
  }
};
