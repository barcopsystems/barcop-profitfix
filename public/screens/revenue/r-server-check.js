'use strict';

/* ── Revenue Recovery — Server Check + Server Scorecard ───────────────────────
   Phase 4: one screen owns server-side performance end-to-end. Top of the
   screen is the Server Scorecard — per-server check avg, covers, sales,
   comps %, tips %, trend arrow, and call-outs for the top performer and any
   server trending down. Below that is the New Shift Check form (logs one
   server's lunch/dinner numbers) with auto staff_id + shift_id capture.
   Bottom is the last-30 shift log.

   Roster comes from lc_staff per Rule 20 (no separate server list).
   Comps data flows in from sc_void_comps via staff_id (added in Phase 2.5).
   Tips data flows in from lc_tip_pools and lc_tips via staff_id + shift_id
   (Phase 3). Everything cross-references — operator never enters the same
   thing twice. */

S.RevenueServerCheck = {
  _calc: null,
  _entryId: null,
  _saving: false,

  // Roster auto-syncs from lc_staff per Rule 20. Front of House + Bar staff
  // are the typical tipped servers; falls back to all active staff if
  // departments aren't set. No legacy name-based fallback (pre-launch, no
  // real data — see no-real-data-yet memory).
  serverRoster() {
    const staff     = (App.laborData && App.laborData.lc_staff)     || [];
    const positions = (App.laborData && App.laborData.lc_positions) || [];
    const deptOf = {};
    positions.forEach(p => { deptOf[p.id] = p.department; });
    const active  = staff.filter(s => s.status !== 'Inactive');
    const serving = active.filter(s => {
      const d = deptOf[s.position_id];
      return d === 'Front of House' || d === 'Bar';
    });
    const pick = serving.length ? serving : active;
    return pick.map(s => ({ id: s.id, name: s.name, position_id: s.position_id }));
  },

  printBlank() {
    App.printBlankSheet({
      title: 'Server Shift Check Sheet',
      subtitle: 'Capture server covers and sales during shift. Manager enters into Bar Cop after close.',
      columns: [
        { label: 'Date',         width: '10%' },
        { label: 'Shift',        width: '10%' },
        { label: 'Server',       width: '20%' },
        { label: 'Covers',       width: '10%' },
        { label: 'Total Sales',  width: '15%' },
        { label: 'Check Avg',    width: '10%' },
        { label: 'Notes',        width: '25%' }
      ],
      rows: 14
    });
  },

  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },

  // Active shift on a given date (most recent open). Used for shift_id capture.
  activeShiftFor(date, shiftType) {
    const list = this.shifts();
    return list.filter(s => s.date === date && (!shiftType || s.shift_type === shiftType))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
  },

  // ── Scorecard computation ────────────────────────────────────────────
  // Aggregates per-server metrics over the last N days. Pulls from:
  //   revenue_server_checks  (covers + sales per shift)
  //   sc_void_comps          (comp $ per server)
  //   lc_tip_pools           (tip allocation per server — preferred)
  //   lc_tips                (raw tip log — fallback for shifts with no pool)
  computeScorecard(windowDays) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (windowDays || 30));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const checks = (App.data.revenue_server_checks || []).filter(c => (c.date || '') >= cutoffStr);
    const voids  = ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => r.type === 'Comp' && (r.date || '') >= cutoffStr);
    const pools  = ((App.laborData && App.laborData.lc_tip_pools)  || []).filter(p => (p.date || '') >= cutoffStr);
    const tips   = ((App.laborData && App.laborData.lc_tips)       || []).filter(t => (t.date || '') >= cutoffStr);

    const byId = {};
    const pushTo = (map, key, fn) => { if (!map[key]) map[key] = fn(); return map[key]; };

    checks.forEach(c => {
      const id = c.staff_id;
      if (!id) return;  // pre-Rule 20 entries without staff_id are dropped
      const name = (this.staffById(id)?.name) || c.server_name || '(unknown)';
      const rec  = pushTo(byId, id, () => ({ staff_id: id, name, entries: 0, covers: 0, sales: 0, comp_total: 0, tip_total: 0, checks: [] }));
      rec.entries++;
      rec.covers += parseFloat(c.covers) || 0;
      rec.sales  += parseFloat(c.sales)  || 0;
      rec.checks.push({ date: c.date, covers: parseFloat(c.covers) || 0, sales: parseFloat(c.sales) || 0 });
    });

    // Layer in comp totals (staff_id keyed)
    voids.forEach(v => {
      if (!v.staff_id) return;
      const rec = byId[v.staff_id];
      if (rec) rec.comp_total += parseFloat(v.amount) || 0;
    });

    // Layer in tip totals — pools first (preferred), then lc_tips for any
    // staff whose tips didn't go through a pool. Same priority as Form 8027.
    const poolStaffIds = new Set();
    pools.forEach(p => {
      (p.participants || []).forEach(pt => {
        if (!pt.staff_id) return;
        const rec = byId[pt.staff_id];
        if (rec) {
          rec.tip_total += parseFloat(pt.share) || 0;
          poolStaffIds.add(pt.staff_id + '|' + p.date);
        }
      });
    });
    tips.forEach(t => {
      if (!t.staff_id) return;
      // Skip if this date+staff was covered by a pool
      if (poolStaffIds.has(t.staff_id + '|' + t.date)) return;
      const rec = byId[t.staff_id];
      if (rec) rec.tip_total += parseFloat(t.total_tips) || ((parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0));
    });

    // Compute derived stats + trend (last-7 vs prior-7)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastWeekCutoff = new Date(today); lastWeekCutoff.setDate(lastWeekCutoff.getDate() - 7);
    const priorWeekCutoff = new Date(today); priorWeekCutoff.setDate(priorWeekCutoff.getDate() - 14);
    const all = Object.values(byId).map(rec => {
      const checkAvg = rec.covers > 0 ? rec.sales / rec.covers : 0;
      const compsPct = rec.sales > 0 ? (rec.comp_total / rec.sales) * 100 : 0;
      const tipsPct  = rec.sales > 0 ? (rec.tip_total  / rec.sales) * 100 : 0;
      // Trend: compare last 7 days vs prior 7 days check avg
      const lastWeek = rec.checks.filter(c => new Date((c.date || '') + 'T00:00:00') >= lastWeekCutoff);
      const priorWeek = rec.checks.filter(c => {
        const d = new Date((c.date || '') + 'T00:00:00');
        return d >= priorWeekCutoff && d < lastWeekCutoff;
      });
      const avgOf = arr => {
        const cov = arr.reduce((s, c) => s + c.covers, 0);
        const sal = arr.reduce((s, c) => s + c.sales, 0);
        return cov > 0 ? sal / cov : 0;
      };
      const lastAvg  = avgOf(lastWeek);
      const priorAvg = avgOf(priorWeek);
      let trend = 'flat';
      if (lastAvg > 0 && priorAvg > 0) {
        const diff = (lastAvg - priorAvg) / priorAvg;
        if (diff <= -0.10) trend = 'down';
        else if (diff >= 0.10) trend = 'up';
      }
      return { ...rec, checkAvg, compsPct, tipsPct, lastAvg, priorAvg, trend };
    }).sort((a, b) => b.checkAvg - a.checkAvg);

    const teamCovers = all.reduce((s, r) => s + r.covers, 0);
    const teamSales  = all.reduce((s, r) => s + r.sales,  0);
    const teamAvg    = teamCovers > 0 ? teamSales / teamCovers : 0;

    return { rows: all, teamAvg, teamCovers, teamSales, windowDays: windowDays || 30 };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    // Print Blank Sheet — paper-to-digital bridge for shift checks captured
    // on paper at the host stand during service.
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Print Blank Sheet';
    printBtn.addEventListener('click', () => this.printBlank());
    actions.appendChild(printBtn);
    this._entryId = App.uid();
    this._calc    = null;

    const t        = App.data.revenue_settings?.targets || {};
    const targetCA = t.check_avg || 35;
    const today    = new Date().toISOString().slice(0, 10);
    // Default shift type from active shift if one is running, otherwise infer
    // from clock-hour using the canonical App.SHIFT_TYPES list.
    const active   = (App.activeShift && App.activeShift()) || null;
    const h        = new Date().getHours();
    const shift    = active && active.shift_type
      ? active.shift_type
      : (h < 11 ? 'Brunch' : h < 16 ? 'Lunch' : h < 21 ? 'Dinner' : 'Late Night');

    const log = (App.data.revenue_server_checks || []).slice(-30).reverse();
    const scorecard = this.computeScorecard(30);

    container.innerHTML = '<div class="screen">'
      + this.renderScorecard(scorecard, targetCA)
      + this.renderForm(today, shift, targetCA)
      + this.renderLog(log, targetCA)
      + '</div>';

    this.wireForm(container, actions);
  },

  // ── Scorecard (top of page) ─────────────────────────────────────────
  renderScorecard(sc, targetCA) {
    if (!sc.rows.length) {
      return '<div class="card"><div class="card-title">Server Scorecard &middot; 30 days</div>'
        + '<div style="font-size:12px;color:var(--t3);">No server data yet. Log a Shift Check below to populate the scorecard.</div></div>';
    }
    const top  = sc.rows[0];
    const downCount = sc.rows.filter(r => r.trend === 'down').length;
    const spread = sc.rows.length > 1 ? (sc.rows[0].checkAvg - sc.rows[sc.rows.length - 1].checkAvg) : 0;

    const tile = (label, value, sub, color) =>
      '<div style="flex:1;min-width:160px;background:var(--input);border:1px solid var(--b1);border-radius:6px;padding:14px 18px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">' + esc(label) + '</div>'
      + '<div style="font-size:22px;font-weight:800;color:' + (color || 'var(--t1)') + ';line-height:1;">' + value + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:6px;">' + sub + '</div>' : '')
      + '</div>';

    const tiles = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;">'
      + tile('Team Average', App.fmtCurrency(sc.teamAvg), 'Target ' + App.fmtCurrency(targetCA), sc.teamAvg >= targetCA ? 'var(--gold)' : 'var(--red)')
      + tile('Top Performer', App.fmtCurrency(top.checkAvg), esc(top.name), 'var(--gold)')
      + tile('Trending Down', String(downCount), downCount > 0 ? 'Server' + (downCount > 1 ? 's' : '') + ' off pace (last 7 days)' : 'No servers off pace', downCount > 0 ? 'var(--red)' : 'var(--gold)')
      + tile('Performance Spread', App.fmtCurrency(spread), 'Top vs bottom', spread > 10 ? 'var(--red)' : 'var(--t1)')
      + '</div>';

    const arrow = (trend) => {
      if (trend === 'up')   return '<span style="color:var(--gold);font-size:14px;">▲</span>';
      if (trend === 'down') return '<span style="color:var(--red);font-size:14px;">▼</span>';
      return '<span style="color:var(--t4);font-size:14px;">●</span>';
    };

    const rows = sc.rows.map((r, i) => {
      const vsT = r.checkAvg - targetCA;
      const vsTeam = r.checkAvg - sc.teamAvg;
      const isTop = i === 0;
      const isDown = r.trend === 'down';
      const nameBadge = isTop
        ? ' <span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:1px 5px;margin-left:6px;">TOP</span>'
        : (isDown ? ' <span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--red);border:1px solid var(--red);border-radius:3px;padding:1px 5px;margin-left:6px;">DOWN</span>' : '');
      // Add Coaching Note button only when staff_id is known (Phase 4 lc_staff
      // linkage). Click jumps to Labor Control Staff Roster with a focus flag
      // the staff roster reads to pre-open the Coaching Log form.
      const coachBtn = r.staff_id
        ? '<button class="btn btn-ghost btn-sm rsc-coach" data-sid="' + esc(r.staff_id) + '" style="font-size:10px;padding:3px 8px;">+ Coaching Note</button>'
        : '';
      return '<tr>'
        + '<td style="font-weight:700;color:' + (isDown ? 'var(--red)' : 'var(--t1)') + ';">' + esc(r.name) + nameBadge + '</td>'
        + '<td>' + arrow(r.trend) + '</td>'
        + '<td class="val" style="color:' + (r.checkAvg >= targetCA ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(r.checkAvg) + '</td>'
        + '<td style="color:' + (vsT >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (vsT >= 0 ? '+' : '') + App.fmtCurrency(vsT) + '</td>'
        + '<td style="color:' + (vsTeam >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (vsTeam >= 0 ? '+' : '') + App.fmtCurrency(vsTeam) + '</td>'
        + '<td>' + Math.round(r.covers) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.sales) + '</td>'
        + '<td>' + (r.compsPct > 0 ? r.compsPct.toFixed(1) + '%' : '-') + '</td>'
        + '<td>' + (r.tipsPct > 0 ? r.tipsPct.toFixed(1) + '%' : '-') + '</td>'
        + '<td>' + r.entries + '</td>'
        + '<td>' + coachBtn + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="card">'
      + '<div class="card-title">Server Scorecard &middot; Last 30 Days</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Per-server performance. Comps come from Shift Control&apos;s Void and Comp log. Tips come from the Tip Pool split when saved, otherwise the Tip Log. Trend arrow compares last 7 days vs the prior 7 (10% threshold). Click + Coaching Note on any row to log a coaching moment for that server in Labor Control.</div>'
      + tiles
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Server</th><th></th><th>Check Avg</th><th>vs Target</th><th>vs Team</th><th>Covers</th><th>Sales</th><th>Comps %</th><th>Tips %</th><th>Entries</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  },

  // ── New Shift Check form ─────────────────────────────────────────────
  renderForm(today, shift, targetCA) {
    const servers = this.serverRoster();
    const serverOpts = '<option value="">Select server...</option>'
      + servers.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('');

    // Shift type options come from App.SHIFT_TYPES so Server Check matches
    // how Shift Control labels shifts (Brunch/Lunch/Dinner/Late Night/Full Day).
    const shiftOpts = (App.SHIFT_TYPES || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'])
      .map(t => '<option' + (shift === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    return '<div class="card">'
      + '<div class="card-title">New Shift Check</div>'
      + '<div class="form-row" style="flex-wrap:nowrap;gap:10px;align-items:flex-end;">'
        + '<div class="f" style="width:148px;flex-shrink:0;"><label>Date</label><input type="date" id="rsc-date" value="' + today + '"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Shift</label><select id="rsc-shift">' + shiftOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Server</label><select id="rsc-server">' + (servers.length ? serverOpts : '<option>Add staff in Labor Control</option>') + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Covers</label><input type="number" id="rsc-cov" placeholder=""/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Total Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsc-sales" placeholder=""/></div></div>'
        + '<div class="f" style="flex-shrink:0;"><label style="opacity:0;">x</label><button class="btn btn-primary" id="rsc-submit" style="white-space:nowrap;">Submit</button></div>'
      + '</div>'
      + '<div id="rsc-result" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--b2);">'
        + '<div style="display:flex;align-items:center;gap:40px;flex-wrap:wrap;">'
          + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Check Average</div>'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;" id="rsc-ca"> </div></div>'
          + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Target</div>'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;color:var(--t3);">$' + targetCA + '</div></div>'
          + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">vs Target</div>'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;" id="rsc-var"> </div></div>'
          + '<div style="margin-left:auto;"><div id="rsc-badge" style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:12px 18px;border-radius:4px;"></div></div>'
        + '</div>'
      + '</div>'
      + '</div>';
  },

  // ── Last-30 shift log ────────────────────────────────────────────────
  renderLog(log, targetCA) {
    return '<div class="sh">Shift Log &middot; Last 30</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="rsc-sel-all">Select All</button>'
      + '<button class="btn btn-danger btn-sm" id="rsc-del-sel" style="display:none;">Delete Selected</button>'
      + '<span id="rsc-sel-count" style="font-size:11px;color:var(--t3);"></span>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th style="width:36px;"></th>'
      + '<th>Date</th><th>Shift</th><th>Server</th><th>Check Avg</th><th>vs Target</th><th>Status</th>'
      + '</tr></thead><tbody id="rsc-log">' + this._buildRows(log, targetCA) + '</tbody></table></div>';
  },

  _buildRows(log, targetCA) {
    if (!log.length) return '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--t4);">No shift checks logged yet.</td></tr>';
    return log.map(c => {
      const ca   = c.covers > 0 ? c.sales / c.covers : 0;
      const diff = ca - targetCA;
      const cls  = diff >= 0 ? 'badge-ok' : diff >= -5 ? 'badge-dim' : 'badge-warn';
      const status = diff >= 0 ? 'ON TARGET' : diff >= -5 ? 'WATCH' : 'BELOW STANDARD';
      const shiftLinked = c.shift_id ? ' <span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">SHIFT LINKED</span>' : '';
      return '<tr>'
        + '<td><input type="checkbox" class="rsc-chk" data-id="' + c.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
        + '<td>' + (c.date || '').slice(0, 10) + '</td>'
        + '<td>' + esc(c.shift || '') + shiftLinked + '</td>'
        + '<td>' + esc(c.server_name || '') + '</td>'
        + '<td class="val">' + App.fmtCurrency(ca) + '</td>'
        + '<td style="color:' + (diff >= 0 ? 'var(--gold)' : diff >= -5 ? 'var(--t2)' : 'var(--red)') + ';">' + (diff >= 0 ? '+' : '') + App.fmtCurrency(diff) + '</td>'
        + '<td><span class="badge ' + cls + '">' + status + '</span></td>'
        + '<td><button class="btn btn-ghost btn-sm rsc-edit" data-id="' + c.id + '">Edit</button></td>'
        + '</tr>';
    }).join('');
  },

  // Populate the New Shift Check form with an existing record for editing.
  // Same form, same save path — saving with an existing _entryId updates in
  // place rather than appending.
  editEntry(id) {
    const c = (App.data.revenue_server_checks || []).find(x => x.id === id);
    if (!c) return;
    this._entryId = id;
    const set = (el, v) => { const e = document.getElementById(el); if (e) e.value = v; };
    set('rsc-date',   c.date || '');
    set('rsc-shift',  c.shift || '');
    set('rsc-server', c.staff_id || '');
    set('rsc-cov',    c.covers || '');
    set('rsc-sales',  c.sales || '');
    this.calc();
    document.getElementById('rsc-date')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  // ── Wiring ────────────────────────────────────────────────────────────
  wireForm(container, actions) {
    document.getElementById('rsc-cov')?.addEventListener('input', () => this.calc());
    document.getElementById('rsc-sales')?.addEventListener('input', () => this.calc());
    document.getElementById('rsc-submit')?.addEventListener('click', () => {
      if (this._saving) return;
      this._saving = true; setTimeout(() => { this._saving = false; }, 2000);
      this.calc();
      this.save(container, actions);
    });

    // Bulk delete wiring
    const updateSel = () => {
      const checked = container.querySelectorAll('.rsc-chk:checked');
      const delBtn  = document.getElementById('rsc-del-sel');
      const count   = document.getElementById('rsc-sel-count');
      if (delBtn) delBtn.style.display = checked.length ? '' : 'none';
      if (count)  count.textContent    = checked.length ? checked.length + ' selected' : '';
    };
    document.getElementById('rsc-sel-all')?.addEventListener('click', () => {
      const all = container.querySelectorAll('.rsc-chk');
      const anyUnchecked = [...all].some(c => !c.checked);
      all.forEach(c => { c.checked = anyUnchecked; });
      updateSel();
    });
    container.addEventListener('change', e => { if (e.target.classList.contains('rsc-chk')) updateSel(); });
    container.querySelectorAll('.rsc-edit').forEach(btn => {
      btn.addEventListener('click', () => this.editEntry(btn.dataset.id));
    });
    container.querySelectorAll('.rsc-coach').forEach(btn => {
      btn.addEventListener('click', () => {
        App._coachingFocus = { staff_id: btn.dataset.sid };
        App.showApp('labor');
        App.navigate('lc-staff-roster');
      });
    });
    document.getElementById('rsc-del-sel')?.addEventListener('click', async () => {
      const ids = [...container.querySelectorAll('.rsc-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      const ok = await App.confirm({ title: 'Delete ' + ids.length + ' check' + (ids.length > 1 ? 's' : '') + '?', confirmText: 'Delete', cancelText: 'Cancel' });
      if (!ok) return;
      App.data.revenue_server_checks = (App.data.revenue_server_checks || []).filter(c => !ids.includes(c.id));
      await App.saveKey('revenue_server_checks');
      this.render(container, actions);
    });
  },

  calc() {
    const cov    = parseFloat(document.getElementById('rsc-cov')?.value)   || 0;
    const sales  = parseFloat(document.getElementById('rsc-sales')?.value) || 0;
    const target = App.data.revenue_settings?.targets?.check_avg || 35;
    const res    = document.getElementById('rsc-result');
    if (!res || cov === 0) { if (res) res.style.display = 'none'; return; }
    res.style.display = 'block';
    const ca   = sales / cov;
    const diff = ca - target;
    let status, sBg, sColor, cColor;
    if (diff >= 0)       { status = 'ON TARGET';      sBg = 'var(--gold-bg)'; sColor = 'var(--gold)'; cColor = 'var(--gold)'; }
    else if (diff >= -5) { status = 'WATCH';          sBg = 'rgba(255,255,255,0.08)'; sColor = 'var(--t1)'; cColor = 'var(--t1)'; }
    else                 { status = 'BELOW STANDARD'; sBg = 'var(--red-bg)'; sColor = 'var(--red)'; cColor = 'var(--red)'; }
    const caEl = document.getElementById('rsc-ca');
    const vEl  = document.getElementById('rsc-var');
    const bEl  = document.getElementById('rsc-badge');
    if (caEl) { caEl.textContent = App.fmtCurrency(ca); caEl.style.color = cColor; }
    if (vEl)  { vEl.textContent  = (diff >= 0 ? '+' : '') + App.fmtCurrency(diff); vEl.style.color = diff >= 0 ? 'var(--gold)' : 'var(--red)'; }
    if (bEl)  { bEl.textContent  = status; bEl.style.background = sBg; bEl.style.color = sColor; }
    this._calc = { ca, diff, status };
  },

  save(container, actions) {
    if (!this._calc) return;
    const cov    = parseFloat(document.getElementById('rsc-cov')?.value)   || 0;
    const sales  = parseFloat(document.getElementById('rsc-sales')?.value) || 0;
    if (!cov || !sales) return;

    const serverPick = document.getElementById('rsc-server')?.value || '';
    // Roster is staff_id-only now (legacy revenue_settings.servers fallback
    // killed). Resolve from lc_staff; bail silently if no match (shouldn't
    // happen since picker only offers staff_id options).
    const byId = this.staffById(serverPick);
    if (!byId) return;
    const staffId = byId.id;
    const serverName = byId.name;

    const date  = document.getElementById('rsc-date')?.value || '';
    const shift = document.getElementById('rsc-shift')?.value || '';
    // Auto-capture shift_id when an open shift exists for this date+shift_type
    const matchShift = this.activeShiftFor(date, shift);

    const entry = {
      id:          this._entryId,
      date,
      shift,
      shift_id:    matchShift ? matchShift.id : '',
      staff_id:    staffId,
      server_name: serverName,
      covers:      cov,
      sales,
      saved_at:    new Date().toISOString()
    };
    if (!App.data.revenue_server_checks) App.data.revenue_server_checks = [];
    const idx = App.data.revenue_server_checks.findIndex(c => c.id === entry.id);
    if (idx > -1) App.data.revenue_server_checks[idx] = entry;
    else App.data.revenue_server_checks.push(entry);
    App.saveKey('revenue_server_checks').then(() => {
      this._entryId = App.uid();
      // Re-render the whole screen so the scorecard reflects the new entry
      this.render(container, actions);
    });
  }
};
