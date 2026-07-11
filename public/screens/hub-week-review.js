'use strict';

/* ── Week Review — what the crew actually did this week (Books section) ────────
   The accountability side of Close the Week. For a chosen week it reads every
   section's real activity (counts taken, spot checks run, deliveries received,
   orders placed, logs filed) plus the Close-the-Week step-completion state, and
   lays out per section: what was DONE, whether the weekly close got finished,
   what it turned up, and what is carrying into next week. An owner reads one page
   and sees where the team is on it and where they let things slide. Every number
   is a real record or a real step stamp, nothing projected. Monday-based weeks,
   to match the section cockpits. Opened from the Books sidebar (under Break-Even).

   Built one section at a time. Inventory is the pattern; the rest follow it. */

S.WeekReview = {
  container: null,
  _wkStart: null,   // Monday (ymd) of the selected week; null = this week

  open() {
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
    App.openHubFullPage('Week Review', (mount) => { this.container = mount; this.render(mount); }, 'week-review');
  },

  // ── Monday-based week (matches the section closes) ──────────────────────────
  _monday(dstr) {
    const d = dstr ? new Date(dstr + 'T00:00:00') : new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(d);
  },
  _addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  _wkS() { return this._wkStart || this._monday(); },
  _wkE() { return this._addDays(this._wkS(), 6); },
  _inWeek(dstr) { const d = String(dstr || '').slice(0, 10); const s = this._wkS(), e = this._wkE(); return !!d && d >= s && d <= e; },
  _isThisWeek() { return this._wkS() >= this._monday(); },
  _step(n) {
    const next = this._addDays(this._wkS(), n);
    if (n > 0 && next > this._monday()) return;
    this._wkStart = next;
    this.render(this.container);
  },

  // ── Shared visual bits ──────────────────────────────────────────────────────
  _eyebrow(t) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:11px;">' + t + '</div>';
  },
  _check() {
    return '<span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:12px;font-weight:800;">&#10003;</span>';
  },
  _cross() {
    return '<span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:rgba(192,56,40,0.14);border:1px solid var(--red);color:var(--red);font-size:11px;font-weight:800;">&#10005;</span>';
  },
  // One activity figure (count + label); muted when nothing happened, so "what
  // did not get done" reads as plainly as what did.
  _act(n, label) {
    const zero = !n;
    return '<div style="min-width:0;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:23px;font-weight:600;line-height:1;color:' + (zero ? 'var(--t4)' : 'var(--t1)') + ';">' + n + '</div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:4px;">' + label + '</div></div>';
  },
  _actRow(items) {
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 22px;"></div>';
    return '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  // One result figure (label over value, colored by meaning).
  _res(label, val, col) {
    return '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
  },
  _resRow(items) {
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 24px;"></div>';
    return '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _openItem(text, sev) {
    const col = sev === 'red' ? 'var(--red)' : 'var(--amber)';
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;">'
      + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + col + ';"></span>'
      + '<span style="font-size:12.5px;color:var(--t2);line-height:1.5;">' + text + '</span></div>';
  },
  // A section shell: header (name + status pill + open link) over stacked blocks.
  _sectionCard(name, screen, mod, statusPill, blocks) {
    const header = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px;border-bottom:1px solid var(--b2);">'
      + '<div style="display:flex;align-items:center;gap:12px;min-width:0;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--t1);">' + esc(name) + '</span>'
      +   statusPill
      + '</div>'
      + '<button class="btn btn-ghost btn-sm no-print" onclick="S.Hub._enter(\'' + screen + '\',\'' + mod + '\')">Open ' + esc(name) + ' &rsaquo;</button>'
      + '</div>';
    const body = blocks.map((b, i) =>
      '<div style="padding:15px 20px;' + (i < blocks.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">' + this._eyebrow(b.label) + b.html + '</div>').join('');
    return '<div class="card" style="padding:0;overflow:hidden;">' + header + body + '</div>';
  },
  _statusPill(text, tone) {
    const map = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)' };
    const col = map[tone] || 'var(--t3)';
    return '<span style="font-size:10px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:' + col + ';border:1px solid ' + col + ';border-radius:20px;padding:2px 10px;white-space:nowrap;">' + text + '</span>';
  },

  // ── Inventory section (the pattern) ─────────────────────────────────────────
  _inventorySection() {
    const ID = S.InventoryDashboard;
    if (!ID) return '';
    const inv = (App.inventoryData) || {};
    const products = (inv.ic_products || []).filter(p => p.active !== false);
    const counts = inv.ic_counts || [];
    if (!products.length || !counts.length) return null;   // handled by empty state upstream

    // Reuse the real cockpit compute + step stamps, forced to the chosen week,
    // then restore so nothing about the live Inventory page changes.
    const sv = ID._weekStart;
    ID._weekStart = this._wkS();
    let st, done;
    try { st = ID.computeState(); done = ID.stepDone(st); } finally { ID._weekStart = sv; }

    // Activity: real records filed in the week window.
    const wkCounts   = counts.filter(c => this._inWeek(c.date)).length;
    const wkSpot     = (inv.ic_spot_checks || []).filter(s => this._inWeek(s.date)).length;
    const wkDeliv    = st.deliveriesThisWeek || 0;
    const wkOrders   = (inv.ic_orders || []).filter(o => this._inWeek(o.date)).length;
    const wkAdj      = (inv.ic_adjustments || []).filter(a => this._inWeek(a.date_time || a.created_at)).length;
    const wkTransfer = (inv.ic_transfers || []).filter(t => this._inWeek(t.date_time || t.created_at)).length;

    // Weekly close: which of the four steps got signed off.
    const STEPS = [
      { key: 'count',      label: 'Took the count' },
      { key: 'deliveries', label: 'Received deliveries' },
      { key: 'orders',     label: 'Placed the orders' },
      { key: 'review',     label: 'Reviewed the flags' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;
    const pill = doneCount === STEPS.length
      ? this._statusPill('Complete', 'good')
      : this._statusPill((STEPS.length - doneCount) + ' skipped', doneCount >= 2 ? 'warn' : 'bad');

    const activity = this._actRow([
      this._act(wkCounts, 'Counts'),
      this._act(wkDeliv, 'Deliveries'),
      this._act(wkOrders, 'Orders'),
      this._act(wkSpot, 'Spot Checks'),
      this._act(wkAdj, 'Adjustments'),
      this._act(wkTransfer, 'Transfers')
    ]);

    const closeList = '<div style="display:flex;flex-direction:column;gap:9px;">'
      + STEPS.map(s => '<div style="display:flex;align-items:center;gap:11px;">'
          + (done[s.key] ? this._check() : this._cross())
          + '<span style="font-size:13px;color:' + (done[s.key] ? 'var(--t2)' : 'var(--t1)') + ';font-weight:' + (done[s.key] ? '400' : '600') + ';">' + s.label + '</span></div>').join('')
      + '</div>';

    const results = this._resRow([
      this._res('Used This Period', st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-'),
      this._res('To Reorder', App.fmtCurrency(st.reorderTotal, 0), st.reorderCount ? 'var(--amber)' : 'var(--t1)'),
      this._res('Shrinkage 30d', App.fmtCurrency(st.shrink, 0), st.shrink > 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Dead Stock', String(st.deadAll), st.deadAll > 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Over Target', String(st.menuOver), st.menuOver > 0 ? 'var(--red)' : 'var(--t1)')
    ]);

    // Carrying over: real open items (skipped steps + unresolved findings).
    const open = [];
    const anyFlag = st.shrink > 0 || st.spotFlags > 0 || st.deadAll > 0 || st.menuOver > 0;
    if (!done.review && anyFlag) open.push({ t: 'Variance flags never reviewed this week', sev: 'red' });
    if (!done.orders && st.reorderCount > 0) open.push({ t: '<b>' + st.reorderCount + '</b> item' + (st.reorderCount === 1 ? '' : 's') + ' below par, no order placed', sev: 'red' });
    if (st.deadAll > 0) open.push({ t: '<b>' + st.deadAll + '</b> dead-stock item' + (st.deadAll === 1 ? '' : 's') + ' tying up cash', sev: 'amber' });
    if (st.parOff > 0) open.push({ t: '<b>' + st.parOff + '</b> par' + (st.parOff === 1 ? '' : 's') + ' off versus real usage', sev: 'amber' });
    if (st.menuOver > 0) open.push({ t: '<b>' + st.menuOver + '</b> menu item' + (st.menuOver === 1 ? '' : 's') + ' over cost target', sev: 'amber' });
    const openHtml = open.length
      ? open.slice(0, 4).map(o => this._openItem(o.t, o.sev)).join('')
      : '<div style="font-size:12.5px;color:var(--green);padding:2px 0;">&#10003; Nothing open. Clean week.</div>';

    return this._sectionCard('Inventory', 'ic-dashboard', 'inventory', pill, [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: closeList },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: openHtml }
    ]);
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    if (this._wkStart == null) this._wkStart = this._monday();

    const products = ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
    const counts = (App.inventoryData && App.inventoryData.ic_counts) || [];
    if (!products.length || !counts.length) {
      App.setupCard(mount, {
        title: 'Week Review',
        lead: 'Week Review shows what your team actually did in each section this week, what got skipped, and what is carrying over. It reads from your real logs, so set up and work a section first.',
        steps: [{ title: 'Set up Inventory', desc: 'Add products and take a count, then work a weekly close. Week Review reads it back here.', btn: 'Open Inventory', screen: 'ic-dashboard', done: false }]
      });
      return;
    }

    // ── Week selector (one pill, arrows, This Week) ────────────────────────────
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    const isCur = this._isThisWeek();
    const prevBtn = '<span class="wr-arrow" data-step="-7" style="cursor:pointer;color:var(--t2);font-size:20px;padding:0 4px;user-select:none;">&lsaquo;</span>';
    const nextBtn = isCur
      ? '<span style="color:var(--t4);font-size:20px;padding:0 4px;user-select:none;">&rsaquo;</span>'
      : '<span class="wr-arrow" data-step="7" style="cursor:pointer;color:var(--t2);font-size:20px;padding:0 4px;user-select:none;">&rsaquo;</span>';
    const pill = '<span style="display:inline-flex;align-items:center;border:1px solid var(--b-edge);background:var(--sel-active-bg);border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;color:var(--t1);white-space:nowrap;">'
      + esc(range) + (isCur ? '<span style="color:var(--gold);font-weight:800;font-size:11px;margin-left:6px;">NOW</span>' : '') + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm wr-now" style="margin-left:6px;">This Week</button>';
    const selector = '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>';
    const intro = '<div style="font-size:12px;color:var(--t3);margin-bottom:18px;">What your team did in each section this week, what got skipped, and what is carrying over.</div>';

    const inv = this._inventorySection() || '';
    const note = '<div style="margin-top:16px;font-size:11.5px;color:var(--t4);line-height:1.6;">This is the Inventory pattern. Labor, Shift, Profit, Revenue, Cash, Events, and Books roll up the same way, added once this shape is signed off.</div>';

    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="wr-export">Export PDF</button>';
    const head = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;"><div class="sh" style="margin:0;">The Week</div>' + exportBtn + '</div>';

    mount.innerHTML = '<div class="screen">' + selector + intro
      + '<div id="wr-export-root">' + head + inv + note + '</div></div>';

    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => this._step(parseInt(a.dataset.step, 10))));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkStart = this._monday(); this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', async () => {
      const ok = await App.confirmExport({
        title: 'Before You Export Your Week Review',
        message: 'This Week Review is built from the activity and step records you logged in Bar Cop. It is a worksheet, not a filed financial statement. Verify it against your own records before you rely on it.',
        confirmText: 'I Understand, Continue',
        cancelText: 'Cancel'
      });
      if (ok) App.exportPDF({ title: 'Week Review', subtitle: range, root: document.getElementById('wr-export-root') });
    });
  },

  showHowTo() {
    App.showHelpModal('How Week Review Works', [
      { p: ['Week Review is the accountability side of your weekly close. For any week it reads what your team actually did in each section, whether the weekly close got finished, what it turned up, and what is carrying into next week, so you can see in one place where the crew is on it and where things slid.'] },
      { h: 'Pick a week', p: ['Use the arrows to step back through your weeks. NOW marks the current one. Everything reads from your real logs and the steps you marked done, nothing projected.'] },
      { h: 'Read a section', p: ['Done This Week is the raw activity, counts, spot checks, deliveries, orders, and logs filed. The Weekly Close shows which sign-off steps got finished and which got skipped. What It Turned Up is the result, and Carrying Into Next Week is the open items to clear.'] },
      { h: 'Export', p: ['Export PDF saves the week as a one-page accountability report you can keep or hand off.'] }
    ]);
  }
};
