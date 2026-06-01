'use strict';

/* ── Revenue Recovery — Events ────────────────────────────────────────────────
   Three tabs: Pipeline (event records with full detail pages), Rate Card
   (saved package definitions), Catering Calc (per-head pricing tool).

   Pipeline rows now route to a unified detail page (Profile + Event P&L +
   Linked Shifts) instead of being read-only table rows. The Event P&L card
   closes the orphan where fix-revenue promised an Event P&L but no screen
   delivered one. Linked Shifts pulls from sc_shifts.event_tag (Phase 0
   enrichment), so revenue from a tagged shift auto-feeds back here. */

S.RevenueEvents = {
  activeTab: 'pipeline',
  _detailId: null,
  _editId: null,

  // Catering calc default wage. Pulls Front of House staff from Labor Control
  // and averages their hourly wages. Falls back to overall staff average, then
  // to a sensible default if Labor Control has no roster yet.
  _defaultEventsWage() {
    const staff = (App.laborData && App.laborData.lc_staff) || [];
    const positions = (App.laborData && App.laborData.lc_positions) || [];
    const fohIds = new Set(positions.filter(p => p.department === 'Front of House').map(p => p.id));
    const fohStaff = staff.filter(s => fohIds.has(s.position_id) && s.wage != null);
    if (fohStaff.length) {
      return Math.round((fohStaff.reduce((sum, s) => sum + s.wage, 0) / fohStaff.length) * 100) / 100;
    }
    const anyWaged = staff.filter(s => s.wage != null);
    if (anyWaged.length) {
      return Math.round((anyWaged.reduce((sum, s) => sum + s.wage, 0) / anyWaged.length) * 100) / 100;
    }
    return 13;
  },

  events() {
    if (!Array.isArray(App.data.revenue_events)) App.data.revenue_events = [];
    return App.data.revenue_events;
  },

  rateCards() {
    if (!Array.isArray(App.data.revenue_rate_cards)) App.data.revenue_rate_cards = [];
    return App.data.revenue_rate_cards;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';

    // Detail view takes over the screen — actions row gets a Back button
    // instead of the tab strip + Log Event button.
    if (this._detailId) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn btn-ghost btn-sm';
      backBtn.textContent = '← Back to Pipeline';
      backBtn.addEventListener('click', () => { this._detailId = null; this.render(container, actions); });
      actions.appendChild(backBtn);
      this.renderDetail(container, this._detailId);
      return;
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Log Event';
    addBtn.addEventListener('click', () => this.showForm(container, actions));
    actions.appendChild(addBtn);

    if (this.activeTab === 'pipeline') {
      const printBtn = document.createElement('button');
      printBtn.className = 'btn btn-ghost btn-sm';
      printBtn.textContent = 'Worksheet';
      printBtn.addEventListener('click', () => this.printBlank());
      actions.appendChild(printBtn);
    }

    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:8px;';
    ['Pipeline', 'Rate Card', 'Catering Calc'].forEach(t => {
      const key = t.toLowerCase().replace(' ', '-');
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm ' + (key === this.activeTab ? 'btn-primary' : 'btn-ghost');
      btn.textContent = t;
      btn.addEventListener('click', () => { this.activeTab = key; this.render(container, actions); });
      tabs.appendChild(btn);
    });
    actions.insertBefore(tabs, actions.firstChild);

    if (this.activeTab === 'pipeline')       this.renderPipeline(container, actions);
    else if (this.activeTab === 'rate-card') this.renderRateCard(container, actions);
    else                                     this.renderCateringCalc(container, actions);
  },

  // Paper inquiry pad — operator clips it to the host stand to capture event
  // calls in real time. Manager enters into Bar Cop after the day winds down.
  printBlank() {
    App.printBlankSheet({
      title: 'Event Inquiry Pad',
      subtitle: 'Capture event inquiries as the phone rings. Manager enters into Bar Cop after the day.',
      columns: [
        { label: 'Date',          width: '10%' },
        { label: 'Caller',        width: '15%' },
        { label: 'Event Name',    width: '18%' },
        { label: 'Type',          width: '10%' },
        { label: 'Date Wanted',   width: '10%' },
        { label: 'Est Covers',    width: '8%'  },
        { label: 'F&B Min Quoted',width: '13%' },
        { label: 'Follow-up',     width: '16%' }
      ],
      rows: 14
    });
  },

  renderPipeline(container, actions) {
    const events = this.events();
    const t = App.data.revenue_settings?.targets || {};
    const closeRate = t.event_close_rate || 40;

    const totalRev    = events.filter(e => e.status === 'Completed').reduce((s, e) => s + (e.actual_revenue || 0), 0);
    const pipeline    = events.filter(e => e.status === 'Inquiry' || e.status === 'Proposal Sent').reduce((s, e) => s + (e.estimated_revenue || 0), 0);
    const projectedWin = pipeline * (closeRate / 100);

    const statusColor = s => App.EVENT_STATUS_COLOR[s] || 'var(--t2)';

    const rows = events.slice().reverse().map(e =>
      '<tr class="rev-row" data-id="' + esc(e.id) + '" style="cursor:pointer;">'
      + '<td>' + (e.date || '').slice(0, 10) + '</td>'
      + '<td style="font-weight:600;">' + esc(e.event_name || '') + '</td>'
      + '<td>' + esc(e.event_type || '') + '</td>'
      + '<td>' + (e.covers || ' ') + '</td>'
      + '<td>' + (e.fb_minimum ? App.fmtCurrency(e.fb_minimum) : ' ') + '</td>'
      + '<td>' + (e.actual_revenue ? App.fmtCurrency(e.actual_revenue) : e.estimated_revenue ? App.fmtCurrency(e.estimated_revenue) + ' (est)' : ' ') + '</td>'
      + '<td style="color:' + statusColor(e.status) + ';font-weight:700;">' + esc(e.status || '') + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm rev-view" data-id="' + esc(e.id) + '">View</button>'
      + '<button class="btn btn-ghost btn-sm rev-edit" data-id="' + esc(e.id) + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm rev-del" data-id="' + esc(e.id) + '">Delete</button>'
      + '</div></td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No events logged yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid" style="margin-bottom:16px;">'
      + '<div class="metric-card"><div class="metric-label">Completed Revenue</div><div class="metric-val on-target">' + App.fmtCurrency(totalRev) + '</div><div class="metric-target">All time</div></div>'
      + '<div class="metric-card"><div class="metric-label">Pipeline Value</div><div class="metric-val">' + App.fmtCurrency(pipeline) + '</div><div class="metric-target">Open inquiries and proposals</div></div>'
      + '<div class="metric-card"><div class="metric-label">Projected Wins</div><div class="metric-val">' + App.fmtCurrency(projectedWin) + '</div><div class="metric-target">At ' + closeRate + '% close rate</div></div>'
      + '<div class="metric-card"><div class="metric-label">Total Events</div><div class="metric-val">' + events.length + '</div><div class="metric-target">' + events.filter(e => e.status === 'Completed').length + ' completed</div></div>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Event Name</th><th>Type</th><th>Covers ' + tt('r-covers') + '</th><th>F&B Min ' + tt('r-fb-minimum') + '</th><th>Revenue ' + tt('r-event-revenue') + '</th><th>Status</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    container.querySelectorAll('.rev-view, .rev-row').forEach(el => {
      el.addEventListener('click', ev => {
        if (ev.target.closest('.rev-edit') || ev.target.closest('.rev-del')) return;
        const id = el.dataset.id;
        if (id) { this._detailId = id; this.render(container, actions); }
      });
    });
    container.querySelectorAll('.rev-edit').forEach(b => {
      b.addEventListener('click', ev => { ev.stopPropagation(); this.showForm(container, actions, b.dataset.id); });
    });
    container.querySelectorAll('.rev-del').forEach(b => {
      b.addEventListener('click', async ev => {
        ev.stopPropagation();
        const ok = await App.confirm({ title: 'Delete this event?', confirmText: 'Delete', cancelText: 'Cancel' });
        if (!ok) return;
        App.data.revenue_events = this.events().filter(e => e.id !== b.dataset.id);
        await App.saveKey('revenue_events');
        this.render(container, actions);
      });
    });
  },

  // ── Unified Event detail page (Profile + Linked Shifts + Event P&L) ─────
  renderDetail(container, id) {
    const e = this.events().find(x => x.id === id);
    if (!e) { this._detailId = null; this.render(container, this.actions); return; }

    const statusColor = App.EVENT_STATUS_COLOR[e.status] || 'var(--t2)';

    // Linked shifts — sc_shifts records tagged with this event's name.
    // Closes the Phase 0 event_tag orphan. Tag match is case-insensitive on
    // event_name; operators are responsible for tagging shifts consistently.
    const tagKey = (e.event_name || '').trim().toLowerCase();
    const linkedShifts = (App.shiftData?.sc_shifts || []).filter(s => {
      const tag = String(s.event_tag || '').trim().toLowerCase();
      return tag && tag === tagKey;
    });
    const taggedRevenue = linkedShifts.reduce((sum, s) => sum + (parseFloat(s.bar_revenue) || 0) + (parseFloat(s.floor_revenue) || 0), 0);

    // Event P&L — pulls revenue from linked shifts (preferred) or actual_revenue field;
    // labor from lc_actuals on the same dates as linked shifts; food/bar cost from
    // operator-entered cost fields on the event.
    const shiftDates = new Set(linkedShifts.map(s => s.date).filter(Boolean));
    const eventLaborCost = (App.laborData?.lc_actuals || [])
      .filter(a => a.date && shiftDates.has(a.date))
      .reduce((sum, a) => sum + ((parseFloat(a.hours) || 0) * (parseFloat(a.wage) || 0)), 0);

    const revenue = taggedRevenue > 0 ? taggedRevenue : (parseFloat(e.actual_revenue) || 0);
    const foodCost = parseFloat(e.event_food_cost) || 0;
    const barCost  = parseFloat(e.event_bar_cost) || 0;
    const otherCost = parseFloat(e.event_other_cost) || 0;
    const totalCost = foodCost + barCost + eventLaborCost + otherCost;
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue * 100) : null;

    container.innerHTML = '<div class="screen">'
      // Profile card
      + '<div class="card">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--b2);flex-wrap:wrap;gap:12px;">'
          + '<div>'
            + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Event</div>'
            + '<div style="font-size:18px;font-weight:800;color:var(--t1);">' + esc(e.event_name || '') + '</div>'
            + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + esc(e.event_type || '') + ' &middot; ' + esc((e.date || '').slice(0, 10)) + (e.covers ? ' &middot; ' + e.covers + ' covers' : '') + '</div>'
          + '</div>'
          + '<div style="text-align:right;">'
            + '<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + statusColor + ';border:1px solid ' + statusColor + ';border-radius:3px;padding:4px 10px;">' + esc(e.status || '') + '</span>'
          + '</div>'
        + '</div>'
        + '<div class="form-row" style="gap:18px;margin-bottom:8px;">'
          + '<div class="f"><label>F&B Minimum</label><div style="font-size:14px;color:var(--t1);">' + (e.fb_minimum ? App.fmtCurrency(e.fb_minimum) : '<span style="color:var(--t4);">-</span>') + '</div></div>'
          + '<div class="f"><label>Estimated Revenue</label><div style="font-size:14px;color:var(--t1);">' + (e.estimated_revenue ? App.fmtCurrency(e.estimated_revenue) : '<span style="color:var(--t4);">-</span>') + '</div></div>'
          + '<div class="f"><label>Actual Revenue (typed)</label><div style="font-size:14px;color:var(--t1);">' + (e.actual_revenue ? App.fmtCurrency(e.actual_revenue) : '<span style="color:var(--t4);">-</span>') + '</div></div>'
        + '</div>'
        + (e.notes ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;padding-top:10px;border-top:1px solid var(--b2);">' + esc(e.notes) + '</div>' : '')
      + '</div>'

      // Linked Shifts card — closes the event_tag orphan
      + '<div class="card">'
        + '<div class="card-title">Linked Shifts</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Any shift in Shift Control tagged "' + esc(e.event_name || '') + '" feeds revenue here automatically. Tag the shift on Active Shift or Log a Shift in Shift Control.'
        + '</div>'
        + (linkedShifts.length === 0
            ? '<div style="font-size:12px;color:var(--t4);">No shifts tagged with this event name yet.</div>'
            : '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Shift</th><th>Manager</th><th>Bar Rev</th><th>Floor Rev</th><th>Total</th></tr></thead><tbody>'
              + linkedShifts.map(s => '<tr>'
                  + '<td>' + esc(s.date || '') + '</td>'
                  + '<td>' + esc(s.shift_type || '') + '</td>'
                  + '<td>' + esc((App.staffById && App.staffById(s.manager_id) || {}).name || '-') + '</td>'
                  + '<td>' + App.fmtCurrency(s.bar_revenue || 0) + '</td>'
                  + '<td>' + App.fmtCurrency(s.floor_revenue || 0) + '</td>'
                  + '<td class="val">' + App.fmtCurrency((parseFloat(s.bar_revenue) || 0) + (parseFloat(s.floor_revenue) || 0)) + '</td>'
                + '</tr>').join('')
              + '</tbody></table></div>')
      + '</div>'

      // Event P&L card — closes the fix-revenue promise
      + '<div class="card">'
        + '<div class="card-title">Event P&L</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;line-height:1.6;">'
        + 'Revenue prefers linked shifts when present; otherwise uses the Actual Revenue field. Labor cost pulls from Labor Control actuals on the linked shift dates. Food and bar cost are operator estimates (edit on the form to update).'
        + '</div>'
        + '<div class="calc" style="margin-bottom:12px;">'
        + '<div class="calc-item"><div class="calc-label">Revenue</div><div class="calc-val">' + App.fmtCurrency(revenue) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Food Cost</div><div class="calc-val">' + App.fmtCurrency(foodCost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Bar Cost</div><div class="calc-val">' + App.fmtCurrency(barCost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val">' + App.fmtCurrency(eventLaborCost) + '</div></div>'
        + (otherCost > 0 ? '<div class="calc-item"><div class="calc-label">Other</div><div class="calc-val">' + App.fmtCurrency(otherCost) + '</div></div>' : '')
        + '<div class="calc-item"><div class="calc-label">Total Cost</div><div class="calc-val">' + App.fmtCurrency(totalCost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Margin</div><div class="calc-val ' + (margin >= 0 ? 'good' : 'warn') + '">' + App.fmtCurrency(margin) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Margin %</div><div class="calc-val ' + (marginPct != null && marginPct >= 30 ? 'good' : 'warn') + '">' + (marginPct != null ? marginPct.toFixed(1) + '%' : '-') + '</div></div>'
        + '</div>'
      + '</div>'

      + '</div>';
  },

  // ── Rate Card tab ────────────────────────────────────────────────────────
  renderRateCard(container, actions) {
    const rc = this.rateCards();
    const typeOpts = App.EVENT_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
    const rows = rc.map(r =>
      '<tr><td style="font-weight:600;">' + esc(r.package_name || '') + '</td>'
      + '<td>' + esc(r.event_type || '') + '</td>'
      + '<td>' + (r.min_covers || ' ') + ' – ' + (r.max_covers || ' ') + '</td>'
      + '<td>' + (r.fb_minimum ? App.fmtCurrency(r.fb_minimum) : ' ') + '</td>'
      + '<td>' + (r.room_fee ? App.fmtCurrency(r.room_fee) : 'Included') + '</td>'
      + '<td>' + (r.per_head ? App.fmtCurrency(r.per_head) : ' ') + '</td>'
      + '<td><button class="btn btn-danger btn-sm rrc-del" data-id="' + esc(r.id) + '">Del</button></td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="7" style="color:var(--t3);text-align:center;padding:14px;">No rate cards yet.</td></tr>';

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Build Your Rate Card</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-lg"><label>Package Name</label><input type="text" id="rrc-name" placeholder="Weeknight Buyout"/></div>'
      + '<div class="f w-md"><label>Event Type</label><select id="rrc-type" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;">' + typeOpts + '</select></div>'
      + '<div class="f w-md"><label>Min Covers ' + tt('r-event-covers') + '</label><input type="number" id="rrc-minc" placeholder="20"/></div>'
      + '<div class="f w-md"><label>Max Covers</label><input type="number" id="rrc-maxc" placeholder="60"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>F&B Minimum ' + tt('r-fb-minimum') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rrc-fbmin" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Room Fee</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rrc-room" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rrc-perhead" placeholder=""/></div></div>'
      + '</div>'
      + '<button class="btn btn-primary" id="rrc-add">Add Package</button>'
      + '</div>'
      + '<div class="tbl-wrap" style="margin-top:16px;"><table class="tbl"><thead><tr><th>Package</th><th>Type</th><th>Covers</th><th>F&B Min</th><th>Room Fee</th><th>Per Head</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    document.getElementById('rrc-add')?.addEventListener('click', async () => {
      const name = document.getElementById('rrc-name')?.value.trim();
      if (!name) return;
      const entry = {
        id: App.uid(),
        package_name: name,
        event_type:   document.getElementById('rrc-type')?.value,
        min_covers:   parseFloat(document.getElementById('rrc-minc')?.value) || 0,
        max_covers:   parseFloat(document.getElementById('rrc-maxc')?.value) || 0,
        fb_minimum:   parseFloat(document.getElementById('rrc-fbmin')?.value) || 0,
        room_fee:     parseFloat(document.getElementById('rrc-room')?.value) || 0,
        per_head:     parseFloat(document.getElementById('rrc-perhead')?.value) || 0
      };
      this.rateCards().push(entry);
      await App.saveKey('revenue_rate_cards');
      this.render(container, actions);
    });
    container.querySelectorAll('.rrc-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm({ title: 'Delete this package?', confirmText: 'Delete', cancelText: 'Cancel' });
        if (!ok) return;
        App.data.revenue_rate_cards = this.rateCards().filter(r => r.id !== btn.dataset.id);
        await App.saveKey('revenue_rate_cards');
        this.render(container, actions);
      });
    });
  },

  renderCateringCalc(container, actions) {
    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Catering Pricing Calculator</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Guest Count</label><input type="number" id="rcc-guests" placeholder="50"/></div>'
      + '<div class="f w-md"><label>Food Cost Per Head</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-food" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Bar Cost Per Head</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-bar" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Staff Hours</label><input type="number" id="rcc-hrs" placeholder=""/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Avg Staff Wage</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-wage" value="' + this._defaultEventsWage() + '"/></div></div>'
      + '<div class="f w-md"><label>Other Costs</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-other" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Target Food Cost %</label><div class="fw"><input class="suf" type="number" id="rcc-tgt" value="' + (App.MENU_TARGET_COST_PCT.catering || 28) + '" step="1"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rcc-result"></div>'
      + '</div></div>';

    const calc = () => {
      const guests   = parseFloat(document.getElementById('rcc-guests')?.value) || 0;
      const foodCost = parseFloat(document.getElementById('rcc-food')?.value)   || 0;
      const barCost  = parseFloat(document.getElementById('rcc-bar')?.value)    || 0;
      const hrs      = parseFloat(document.getElementById('rcc-hrs')?.value)    || 0;
      const wage     = parseFloat(document.getElementById('rcc-wage')?.value)   || 13;
      const other    = parseFloat(document.getElementById('rcc-other')?.value)  || 0;
      const tgt      = parseFloat(document.getElementById('rcc-tgt')?.value)    || (App.MENU_TARGET_COST_PCT.catering || 28);
      const el       = document.getElementById('rcc-result');
      if (!el || !guests) { if (el) el.innerHTML = ''; return; }
      const totalFoodCost  = foodCost * guests;
      const totalBarCost   = barCost  * guests;
      const laborCost      = hrs * wage;
      const totalCost      = totalFoodCost + totalBarCost + laborCost + other;
      const perHeadCost    = totalCost / guests;
      const perHeadPrice   = tgt > 0 ? perHeadCost / (tgt / 100) : 0;
      const totalRevenue   = perHeadPrice * guests;
      const margin         = totalRevenue - totalCost;
      el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Total Cost</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(totalCost) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Cost Per Head</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(perHeadCost) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;border:1px solid rgba(219,171,70,0.3);"><div style="font-size:10px;color:var(--gold);">Suggested Per Head Price</div><div style="font-size:20px;font-weight:800;color:var(--gold);">' + App.fmtCurrency(perHeadPrice) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Total Event Revenue</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(totalRevenue) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Gross Margin</div><div style="font-size:16px;font-weight:700;color:' + (margin > 0 ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(margin) + '</div></div>'
        + '</div>';
    };
    ['rcc-guests', 'rcc-food', 'rcc-bar', 'rcc-hrs', 'rcc-wage', 'rcc-other', 'rcc-tgt'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', calc));
  },

  // ── Event form (add or edit) ──────────────────────────────────────────────
  showForm(container, actions, id) {
    this._editId = id || null;
    const e = id ? this.events().find(x => x.id === id) : null;
    const typeOpts = App.EVENT_TYPES.map(t =>
      '<option' + (e && e.event_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const statusOpts = App.EVENT_STATUSES.map(s =>
      '<option' + (e && e.status === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';
    const today = new Date().toISOString().slice(0, 10);

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">' + (id ? 'Edit Event' : 'Log Event') + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
        + '<div class="f w-lg"><label>Event Name</label><input type="text" id="rev-name" value="' + esc(e?.event_name || '') + '" placeholder="Smith Wedding Rehearsal"/></div>'
        + '<div class="f w-md"><label>Event Type</label><select id="rev-type" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;">' + typeOpts + '</select></div>'
        + '<div class="f w-md"><label>Status</label><select id="rev-status" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;">' + statusOpts + '</select></div>'
        + '<div class="f w-md"><label>Date</label><input type="date" id="rev-date" value="' + esc(e?.date || today) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
        + '<div class="f w-md"><label>Covers ' + tt('r-event-covers') + '</label><input type="number" id="rev-cov" value="' + v(e?.covers) + '"/></div>'
        + '<div class="f w-md"><label>F&B Minimum ' + tt('r-fb-minimum') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-fbmin" value="' + v(e?.fb_minimum) + '"/></div></div>'
        + '<div class="f w-md"><label>Actual Revenue ' + tt('r-event-revenue') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-actual" value="' + v(e?.actual_revenue) + '"/></div></div>'
        + '<div class="f w-md"><label>Estimated Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-est" value="' + v(e?.estimated_revenue) + '"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
        + '<div class="f w-md"><label>Event Food Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-fcost" value="' + v(e?.event_food_cost) + '" placeholder="For Event P&L"/></div></div>'
        + '<div class="f w-md"><label>Event Bar Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-bcost" value="' + v(e?.event_bar_cost) + '" placeholder="For Event P&L"/></div></div>'
        + '<div class="f w-md"><label>Other Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-ocost" value="' + v(e?.event_other_cost) + '" placeholder="Optional"/></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:16px;"><label>Notes</label><input type="text" id="rev-notes" value="' + esc(e?.notes || '') + '" placeholder="Optional"/></div>'
      + '<div style="display:flex;gap:10px;">'
        + '<button class="btn btn-primary" id="rev-save">' + (id ? 'Update Event' : 'Save Event') + '</button>'
        + '<button class="btn btn-ghost" id="rev-cancel">Cancel</button>'
      + '</div></div></div>';

    document.getElementById('rev-cancel')?.addEventListener('click', () => {
      this._editId = null;
      this.render(container, actions);
    });
    document.getElementById('rev-save')?.addEventListener('click', async () => {
      const name = document.getElementById('rev-name')?.value.trim();
      if (!name) return;
      const rec = {
        id: this._editId || App.uid(),
        event_name:        name,
        event_type:        document.getElementById('rev-type')?.value,
        status:            document.getElementById('rev-status')?.value,
        date:              document.getElementById('rev-date')?.value,
        covers:            parseFloat(document.getElementById('rev-cov')?.value)    || 0,
        fb_minimum:        parseFloat(document.getElementById('rev-fbmin')?.value)  || 0,
        actual_revenue:    parseFloat(document.getElementById('rev-actual')?.value) || 0,
        estimated_revenue: parseFloat(document.getElementById('rev-est')?.value)    || 0,
        event_food_cost:   parseFloat(document.getElementById('rev-fcost')?.value)  || 0,
        event_bar_cost:    parseFloat(document.getElementById('rev-bcost')?.value)  || 0,
        event_other_cost:  parseFloat(document.getElementById('rev-ocost')?.value)  || 0,
        notes:             document.getElementById('rev-notes')?.value || ''
      };
      const list = this.events();
      if (this._editId) {
        const i = list.findIndex(x => x.id === this._editId);
        if (i > -1) list[i] = { ...list[i], ...rec };
      } else {
        rec.saved_at = new Date().toISOString();
        list.push(rec);
      }
      await App.saveKey('revenue_events');
      this._editId = null;
      this.render(container, actions);
    });
  }
};
