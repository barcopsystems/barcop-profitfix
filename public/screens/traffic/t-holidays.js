'use strict';

/* ── Traffic Recovery — Holiday and Events Calendar (writes traffic_holidays) ─
   12-month forward view of holidays and local events with a per-date planning
   checklist: menu locked, promo created, staffing scheduled, reservations
   open. Operators always feel they planned "too late." This is the screen
   the owner-operator opens once a month to look at what's coming up and
   whether the basics are in place.

   No seeded holiday list yet (sample data lands in the final pre-launch
   overhaul). Operators add the dates that matter for their operation: the
   national holidays they trade on, the local festival weekend, the
   homecoming game, NYE. */

S.TrafficHolidays = {
  editId: null,
  filterUpcoming: true,
  filterType: '',

  TYPES: ['Major Holiday', 'Local Event', 'Sports', 'Industry', 'Other'],
  TYPE_COLOR: {
    'Major Holiday': 'var(--gold)',
    'Local Event':   'var(--steel)',
    'Sports':        'var(--blue)',
    'Industry':      'var(--green)',
    'Other':         'var(--t3)'
  },

  holidays() {
    if (!Array.isArray(App.data.traffic_holidays)) App.data.traffic_holidays = [];
    return App.data.traffic_holidays;
  },

  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  },
  daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(target.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((target - today) / 86400000);
  },
  // Returns 0-4: how many of the 4 planning items are checked.
  planningScore(h) {
    return ['plan_menu','plan_promo','plan_staffing','plan_reservations'].filter(k => h[k]).length;
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
    printBtn.textContent = 'Worksheet';
    printBtn.addEventListener('click', () => this.printBlankSheet());
    this.actions.appendChild(printBtn);
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Add Date';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.holidays();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const upcoming = all.filter(h => { const d = this.daysUntil(h.date); return d != null && d >= 0 && d <= 90; });
    const next30 = upcoming.filter(h => this.daysUntil(h.date) <= 30);
    const next30Ready = next30.filter(h => this.planningScore(h) === 4).length;

    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Dates Tracked</div><div class="calc-val">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Next 30 Days</div><div class="calc-val ' + (next30.length ? 'good' : '') + '">' + next30.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Next 90 Days</div><div class="calc-val">' + upcoming.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Ready (Next 30d)</div><div class="calc-val ' + (next30.length > 0 && next30Ready === next30.length ? 'good' : next30.length > 0 ? 'warn' : '') + '">' + next30Ready + ' of ' + next30.length + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No dates on the calendar yet</div>'
        + '<div class="empty-sub">Add the holidays and local events you trade on: Valentine\'s, Mother\'s Day, Father\'s Day, Game Day, NYE, the homecoming weekend, the local festival. Each date gets a planning checklist so menu, promo, staffing, and reservations are locked before the day arrives, not after.</div>'
        + '<button class="btn btn-primary" id="th-add-first">Add Your First Date</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No dates match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      // Group by month for visual scanning
      const groups = {};
      filtered.forEach(h => {
        const ym = (h.date || '').slice(0, 7);
        if (!groups[ym]) groups[ym] = [];
        groups[ym].push(h);
      });
      const monthLabels = Object.keys(groups).sort();

      const monthSections = monthLabels.map(ym => {
        const [y, m] = ym.split('-');
        const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const rows = groups[ym].map(h => {
          const days = this.daysUntil(h.date);
          const score = this.planningScore(h);
          const scoreColor = score === 4 ? 'var(--gold)' : score >= 2 ? 'var(--t1)' : 'var(--red)';
          const checks = ['plan_menu','plan_promo','plan_staffing','plan_reservations'];
          const labels = ['Menu', 'Promo', 'Staffing', 'Reservations'];
          const chips = checks.map((k, idx) => {
            const on = !!h[k];
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.5px;'
              + 'background:' + (on ? 'var(--gold-bg)' : 'transparent') + ';'
              + 'border:1px solid ' + (on ? 'var(--gold)' : 'var(--b2)') + ';'
              + 'color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';">'
              + (on ? '✓ ' : '') + labels[idx] + '</span>';
          }).join(' ');
          const typeBadge = '<span style="color:' + (this.TYPE_COLOR[h.type] || 'var(--t3)') + ';font-weight:700;">' + esc(h.type || '-') + '</span>';
          return '<tr class="th-row" data-id="' + h.id + '" style="cursor:pointer;">'
            + '<td><div class="val">' + esc(h.name || '-') + '</div>'
            + (h.notes ? '<div style="font-size:10px;color:var(--t3);">' + esc((h.notes || '').slice(0, 50)) + ((h.notes || '').length > 50 ? '...' : '') + '</div>' : '') + '</td>'
            + '<td>' + this.fmtDate(h.date) + (days != null && days >= 0 && days <= 60 ? ' <span style="color:var(--t3);font-size:10px;">(' + days + 'd)</span>' : '') + '</td>'
            + '<td>' + typeBadge + '</td>'
            + '<td><span style="color:' + scoreColor + ';font-weight:700;">' + score + '/4</span></td>'
            + '<td>' + chips + '</td>'
            + '<td><div class="row-actions">'
            +   '<button class="btn btn-ghost btn-sm th-edit" data-id="' + h.id + '">Edit</button>'
            +   '<button class="btn btn-danger btn-sm th-del" data-id="' + h.id + '">Delete</button>'
            + '</div></td></tr>';
        }).join('');
        return '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 8px;">' + esc(monthLabel) + '</div>'
          + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Date Name</th><th>Date</th><th>Type</th><th>Planning</th><th>Status</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
      }).join('');

      html = summary + this.filterCard() + monthSections;
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  filterCard() {
    const typeOpts = '<option value="">All types</option>'
      + this.TYPES.map(t => '<option value="' + esc(t) + '"' + (this.filterType === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      +   '<div class="f" style="width:170px;flex-shrink:0;"><label>Type</label><select id="th-f-type">' + typeOpts + '</select></div>'
      +   '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding-top:18px;">'
      +     '<input type="checkbox" id="th-f-upcoming" ' + (this.filterUpcoming ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Upcoming only (next 90 days)</label>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="th-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(h => {
      if (this.filterType && h.type !== this.filterType) return false;
      if (this.filterUpcoming) {
        const d = this.daysUntil(h.date);
        if (d == null || d < 0 || d > 90) return false;
      }
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.th-row');
      const edit = ev.target.closest('.th-edit');
      const del  = ev.target.closest('.th-del');
      const addF = ev.target.closest('#th-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('th-f-type')?.addEventListener('change', e => { this.filterType = e.target.value || ''; this.renderList(); });
    document.getElementById('th-f-upcoming')?.addEventListener('change', e => { this.filterUpcoming = !!e.target.checked; this.renderList(); });
    document.getElementById('th-f-clear')?.addEventListener('click', () => { this.filterType = ''; this.filterUpcoming = true; this.renderList(); });
  },

  showForm(id) {
    this.editId = id || null;
    const h = id ? this.holidays().find(x => x.id === id) : null;
    const typeOpts = this.TYPES.map(t =>
      '<option' + ((h && h.type === t) || (!h && t === 'Major Holiday') ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const tog = (k, label) => '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="th-plan" data-key="' + k + '"' + (h?.[k] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>' + label + '</label>';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Date' : 'Add a Date') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Add the date, then the 4 checkboxes below track whether you\'re ready: menu locked, promo created, staffing scheduled, reservations open. Operators who hit 4 of 4 weeks ahead don\'t feel like they planned the holiday too late.</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Name</label>'
          + '<input type="text" id="th-name" value="' + esc(h?.name || '') + '" placeholder="Mother\'s Day Brunch"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="th-date" value="' + esc(h?.date || '') + '"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Type</label>'
          + '<select id="th-type">' + typeOpts + '</select></div>'
      + '</div>'

      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin:14px 0;">'
        + tog('plan_menu',         'Menu locked (specials, prix-fixe, or no change)')
        + tog('plan_promo',        'Promo created (email, social, or in-house)')
        + tog('plan_staffing',     'Staffing scheduled (right number on the right shifts)')
        + tog('plan_reservations', 'Reservations open (or walk-in plan set)')
      + '</div>'

      + '<div class="f" style="margin-bottom:0;"><label>Notes (optional)</label>'
        + '<textarea id="th-notes" rows="2" placeholder="Past-year covers, what worked last time, who\'s leading the menu, any other reminders.">' + esc(h?.notes || '') + '</textarea></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="th-save">' + (id ? 'Update' : 'Add Date') + '</button>'
        + '<button class="btn btn-ghost" id="th-cancel">Cancel</button>'
        + '<span id="th-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('th-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('th-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('th-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('th-name')?.value.trim() || '';
    const date = document.getElementById('th-date')?.value;
    if (!name) { fail('Name is required.'); return; }
    if (!date) { fail('Date is required.'); return; }

    const before = this.editId ? this.holidays().find(x => x.id === this.editId) : null;
    const beforeScore = before ? this.planningScore(before) : 0;

    const rec = {
      id:                this.editId || App.uid(),
      name, date,
      type:              document.getElementById('th-type')?.value || 'Other',
      notes:             document.getElementById('th-notes')?.value.trim() || '',
      plan_menu:         this.container.querySelector('.th-plan[data-key="plan_menu"]')?.checked || false,
      plan_promo:        this.container.querySelector('.th-plan[data-key="plan_promo"]')?.checked || false,
      plan_staffing:     this.container.querySelector('.th-plan[data-key="plan_staffing"]')?.checked || false,
      plan_reservations: this.container.querySelector('.th-plan[data-key="plan_reservations"]')?.checked || false
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.holidays();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('th-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('traffic_holidays');
    if (ok) {
      // fix_log emit when a date just hit 4/4 on the planning checklist
      // (ready) and it's still upcoming. Closes a planning gap that would
      // otherwise have shown up as a missed trading day.
      const afterScore = this.planningScore(rec);
      const days = this.daysUntil(rec.date);
      if (afterScore === 4 && beforeScore < 4 && days != null && days >= 0) {
        await App.emitTrafficFix('social', name + ' planning checklist ready (' + (days === 0 ? 'today' : days + ' days out') + ')');
      }
      this.editId = null;
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update' : 'Add Date'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    App.data.traffic_holidays = this.holidays().filter(x => x.id !== id);
    await App.saveKey('traffic_holidays');
    this.renderList();
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Holiday and Events Calendar',
      subtitle: 'Sketch the upcoming dates on paper; type into Bar Cop after.',
      columns: [
        { label: 'Date',     width: '100px' },
        { label: 'Name' },
        { label: 'Type',     width: '110px' },
        { label: 'Menu?',    width: '60px'  },
        { label: 'Promo?',   width: '60px'  },
        { label: 'Staff?',   width: '60px'  },
        { label: 'Reserv?',  width: '60px'  }
      ],
      rows: 16
    });
  }
};
