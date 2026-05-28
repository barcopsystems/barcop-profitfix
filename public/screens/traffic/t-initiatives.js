'use strict';

/* ── Traffic Recovery — Slow-Night Initiatives (writes traffic_initiatives) ──
   The other half of the Revenue Initiative Tracker, scoped to traffic-driving
   tactics on slow weeknights. Trivia, half-price wings, live music, industry
   night, run club, open mic. Operators try these constantly and never track
   whether they worked.

   Each initiative captures the weekday, the start/end dates, baseline covers
   before the tactic launched, current weekday covers, and the percentage lift.
   When the lift is positive after the run, the operator gets a fix_log credit
   on the Recovery Scoreboard. When it's flat or negative, the data tells the
   operator to drop it instead of running the same dead tactic for a year. */

S.TrafficInitiatives = {
  editId: null,
  filterStatus: '',

  WEEKDAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  STATUSES: ['Active', 'Completed', 'Stopped'],
  STATUS_COLOR: { 'Active': 'var(--gold)', 'Completed': 'var(--green)', 'Stopped': 'var(--t3)' },

  initiatives() {
    if (!Array.isArray(App.data.traffic_initiatives)) App.data.traffic_initiatives = [];
    return App.data.traffic_initiatives;
  },

  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  liftPct(baseline, current) {
    const b = parseFloat(baseline), c = parseFloat(current);
    if (!b || isNaN(b) || isNaN(c)) return null;
    return ((c - b) / b) * 100;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Print Blank Sheet';
    printBtn.addEventListener('click', () => this.printBlankSheet());
    this.actions.appendChild(printBtn);
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Start Initiative';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.initiatives();
    const filtered = this.filterStatus ? all.filter(i => i.status === this.filterStatus) : all;
    filtered.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

    const active = all.filter(i => i.status === 'Active');
    const completed = all.filter(i => i.status === 'Completed');
    const lifts = completed.map(i => this.liftPct(i.baseline_covers, i.current_covers)).filter(v => v != null);
    const avgLift = lifts.length ? lifts.reduce((a, b) => a + b, 0) / lifts.length : null;
    const bestInit = completed.slice().sort((a, b) => (this.liftPct(b.baseline_covers, b.current_covers) || -999) - (this.liftPct(a.baseline_covers, a.current_covers) || -999))[0];
    const bestLift = bestInit ? this.liftPct(bestInit.baseline_covers, bestInit.current_covers) : null;

    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Active Initiatives</div><div class="calc-val">' + active.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Completed</div><div class="calc-val">' + completed.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Avg Lift (Completed)</div><div class="calc-val ' + (avgLift != null && avgLift >= 10 ? 'good' : avgLift != null && avgLift < 0 ? 'warn' : '') + '">' + (avgLift != null ? (avgLift >= 0 ? '+' : '') + avgLift.toFixed(0) + '%' : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Best Performer</div><div class="calc-val">' + (bestInit ? esc(bestInit.name) + ' (' + (bestLift >= 0 ? '+' : '') + bestLift.toFixed(0) + '%)' : '-') + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No initiatives running yet</div>'
        + '<div class="empty-sub">Trivia Tuesday. Wing Wednesday. Industry Sunday. Live music Thursday. Every operator tries them. Most never track whether they worked. Log the tactic, capture the baseline covers before launch, then watch the lift. Drop what doesn\'t move the number.</div>'
        + '<button class="btn btn-primary" id="ti-add-first">Start Your First Initiative</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No initiatives match the filter</div>'
        + '<div class="empty-sub">Adjust or clear the filter above.</div></div>';
    } else {
      const rows = filtered.slice(0, 200).map(i => {
        const lift = this.liftPct(i.baseline_covers, i.current_covers);
        const liftColor = lift == null ? 'var(--t3)' : lift >= 10 ? 'var(--gold)' : lift >= 0 ? 'var(--t1)' : 'var(--red)';
        const statusBadge = '<span style="color:' + (this.STATUS_COLOR[i.status] || 'var(--t1)') + ';font-weight:700;">' + esc(i.status || '-') + '</span>';
        return '<tr class="ti-row" data-id="' + i.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(i.name || '-') + '</div>'
          + (i.notes ? '<div style="font-size:10px;color:var(--t3);">' + esc((i.notes || '').slice(0, 50)) + ((i.notes || '').length > 50 ? '...' : '') + '</div>' : '') + '</td>'
          + '<td>' + esc(i.weekday || '-') + '</td>'
          + '<td>' + this.fmtDate(i.start_date) + (i.end_date ? ' → ' + this.fmtDate(i.end_date) : '') + '</td>'
          + '<td class="val">' + (i.baseline_covers || '-') + '</td>'
          + '<td class="val">' + (i.current_covers || '-') + '</td>'
          + '<td><span style="color:' + liftColor + ';font-weight:700;">' + (lift != null ? (lift >= 0 ? '+' : '') + lift.toFixed(0) + '%' : '-') + '</span></td>'
          + '<td>' + statusBadge + '</td>'
          + '<td><div class="row-actions">'
          +   '<button class="btn btn-ghost btn-sm ti-edit" data-id="' + i.id + '">Edit</button>'
          +   '<button class="btn btn-danger btn-sm ti-del" data-id="' + i.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = summary + this.filterCard()
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Initiative</th><th>Weekday</th><th>Run</th><th>Baseline</th><th>Current</th><th>Lift</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  filterCard() {
    const statusOpts = '<option value="">All statuses</option>'
      + this.STATUSES.map(s => '<option value="' + esc(s) + '"' + (this.filterStatus === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      +   '<div class="f" style="width:160px;flex-shrink:0;"><label>Status</label><select id="ti-f-status">' + statusOpts + '</select></div>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="ti-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.ti-row');
      const edit = ev.target.closest('.ti-edit');
      const del  = ev.target.closest('.ti-del');
      const addF = ev.target.closest('#ti-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('ti-f-status')?.addEventListener('change', e => { this.filterStatus = e.target.value || ''; this.renderList(); });
    document.getElementById('ti-f-clear')?.addEventListener('click', () => { this.filterStatus = ''; this.renderList(); });
  },

  showForm(id) {
    this.editId = id || null;
    const r = id ? this.initiatives().find(x => x.id === id) : null;
    const weekdayOpts = '<option value="">-</option>' + this.WEEKDAYS.map(d =>
      '<option' + (r && r.weekday === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('');
    const statusOpts = this.STATUSES.map(s =>
      '<option' + ((r && r.status === s) || (!r && s === 'Active') ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const today = new Date().toISOString().slice(0, 10);

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Initiative' : 'Start a Slow-Night Initiative') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Capture the tactic, the weekday it runs, and the baseline weeknight covers BEFORE you launch it. As the initiative runs, update Current Covers each week. Bar Cop shows the lift percentage so you know whether it\'s working.</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Initiative Name</label>'
          + '<input type="text" id="ti-name" value="' + esc(r?.name || '') + '" placeholder="Trivia Tuesday with $5 wings"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Weekday</label>'
          + '<select id="ti-weekday">' + weekdayOpts + '</select></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label>'
          + '<select id="ti-status">' + statusOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Start Date</label>'
          + '<input type="date" id="ti-start" value="' + esc(r?.start_date || today) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>End Date (optional)</label>'
          + '<input type="date" id="ti-end" value="' + esc(r?.end_date || '') + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Baseline Covers</label>'
          + '<div class="fw"><input class="suf" type="number" id="ti-baseline" min="0" value="' + (r?.baseline_covers != null ? r.baseline_covers : '') + '"/><span class="suf">covers</span></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Current Covers</label>'
          + '<div class="fw"><input class="suf" type="number" id="ti-current" min="0" value="' + (r?.current_covers != null ? r.current_covers : '') + '"/><span class="suf">covers</span></div></div>'
      + '</div>'

      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes (what you tried, what changed, what to keep doing)</label>'
        + '<textarea id="ti-notes" rows="3" placeholder="The bartender ran the trivia. Switched from prizes to gift cards in week 3. Cheap-wing nights pull a different crowd than the Friday regulars.">' + esc(r?.notes || '') + '</textarea></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="ti-save">' + (id ? 'Update' : 'Start Initiative') + '</button>'
        + '<button class="btn btn-ghost" id="ti-cancel">Cancel</button>'
        + '<span id="ti-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('ti-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('ti-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('ti-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name     = document.getElementById('ti-name')?.value.trim() || '';
    const weekday  = document.getElementById('ti-weekday')?.value || '';
    const status   = document.getElementById('ti-status')?.value || 'Active';
    const start    = document.getElementById('ti-start')?.value;
    const baseline = parseInt(document.getElementById('ti-baseline')?.value);
    if (!name)    { fail('Initiative name is required.'); return; }
    if (!weekday) { fail('Pick the weekday this initiative runs.'); return; }
    if (!start)   { fail('Start date is required.'); return; }
    if (isNaN(baseline) || baseline < 0) { fail('Baseline covers must be a number (covers on that weekday before launch).'); return; }

    const wasNotCompleted = this.editId
      ? this.initiatives().find(x => x.id === this.editId)?.status !== 'Completed'
      : true;

    const rec = {
      id:               this.editId || App.uid(),
      name, weekday, status,
      start_date:       start,
      end_date:         document.getElementById('ti-end')?.value || '',
      baseline_covers:  baseline,
      current_covers:   parseInt(document.getElementById('ti-current')?.value) || null,
      notes:            document.getElementById('ti-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.initiatives();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('ti-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('traffic_initiatives');
    if (ok) {
      // fix_log emit when an initiative crosses into Completed with positive
      // lift. Credits the Recovery Scoreboard for tactics that actually moved
      // weeknight covers; no emit for stopped/no-lift initiatives.
      const lift = this.liftPct(rec.baseline_covers, rec.current_covers);
      if (status === 'Completed' && wasNotCompleted && lift != null && lift > 0) {
        await App.emitTrafficFix('social', name + ' lifted ' + weekday + ' covers ' + lift.toFixed(0) + '% vs baseline');
      }
      this.editId = null;
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update' : 'Start Initiative'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this initiative?', confirmText: 'Delete' });
    if (!ok) return;
    App.data.traffic_initiatives = this.initiatives().filter(x => x.id !== id);
    await App.saveKey('traffic_initiatives');
    this.renderList();
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Slow-Night Initiatives',
      subtitle: 'Sketch the tactic on paper before launch; type into Bar Cop when it starts.',
      columns: [
        { label: 'Initiative',     width: '160px' },
        { label: 'Weekday',        width: '90px'  },
        { label: 'Start Date',     width: '90px'  },
        { label: 'Baseline Covers',width: '90px'  },
        { label: 'Notes (mechanics, who runs it)' }
      ],
      rows: 10
    });
  }
};
