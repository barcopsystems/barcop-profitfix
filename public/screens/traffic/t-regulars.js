'use strict';

/* ── Traffic Recovery — VIP Regulars Log (writes traffic_regulars) ────────────
   The bar's regulars book in digital form. Name, contact, birthday,
   anniversary, drink preferences, last visit. Drives birthday and
   anniversary outreach (the highest-converting email you'll ever send) and
   spots regulars who have gone quiet so the operator can pull them back
   before they're gone for good.

   This is what an independent bar does that the big chains can't: know the
   regulars by name, by drink, by date. The log gives the operator a place
   to put that knowledge instead of carrying it on a phone or an index card. */

S.TrafficRegulars = {
  editId: null,
  filterText: '',
  filterQuiet: false,

  regulars() {
    if (!Array.isArray(App.data.traffic_regulars)) App.data.traffic_regulars = [];
    return App.data.traffic_regulars;
  },

  // Birthday and anniversary stored as MM-DD strings so year doesn't matter
  // for the recurring outreach trigger. fmt returns "Mar 12" for display.
  fmtMD(md) {
    if (!md || !/^\d{2}-\d{2}$/.test(md)) return '';
    const [m, d] = md.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[m - 1] + ' ' + d;
  },
  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  // Days from today to next occurrence of an MM-DD (handles year-end wrap).
  daysToMD(md) {
    if (!md || !/^\d{2}-\d{2}$/.test(md)) return null;
    const [m, d] = md.split('-').map(Number);
    const today = new Date(); today.setHours(0,0,0,0);
    let target = new Date(today.getFullYear(), m - 1, d);
    if (target < today) target = new Date(today.getFullYear() + 1, m - 1, d);
    return Math.round((target - today) / 86400000);
  },
  // Days since last visit (null if never recorded).
  daysSinceVisit(dateStr) {
    if (!dateStr) return null;
    const last = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(last.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((today - last) / 86400000);
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
    addBtn.textContent = '+ Add Regular';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.regulars();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const monthIdx = new Date().getMonth();
    const monthBirthdays    = all.filter(r => r.birthday    && parseInt(r.birthday.slice(0, 2))    - 1 === monthIdx);
    const monthAnnivs       = all.filter(r => r.anniversary && parseInt(r.anniversary.slice(0, 2)) - 1 === monthIdx);
    const quietRegulars     = all.filter(r => { const d = this.daysSinceVisit(r.last_visit); return d != null && d >= 60; });

    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Regulars</div><div class="calc-val">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Birthdays This Month</div><div class="calc-val ' + (monthBirthdays.length ? 'good' : '') + '">' + monthBirthdays.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Anniversaries This Month</div><div class="calc-val ' + (monthAnnivs.length ? 'good' : '') + '">' + monthAnnivs.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Quiet 60+ Days</div><div class="calc-val ' + (quietRegulars.length ? 'warn' : '') + '">' + quietRegulars.length + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No regulars logged yet</div>'
        + '<div class="empty-sub">Add the guests you know by name. Birthday and anniversary dates surface here when they\'re coming up so you can pull them in for the night. A regulars book in digital form, not on a sticky note behind the bar.</div>'
        + '<button class="btn btn-primary" id="vr-add-first">Add Your First Regular</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No regulars match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      const rows = filtered.slice(0, 200).map(r => {
        const bdayDays = this.daysToMD(r.birthday);
        const annDays  = this.daysToMD(r.anniversary);
        const upcoming = (bdayDays != null && bdayDays <= 30) || (annDays != null && annDays <= 30);
        const visitDays = this.daysSinceVisit(r.last_visit);
        const quiet = visitDays != null && visitDays >= 60;
        const prefSnippet = (r.preferences || '').slice(0, 50) + ((r.preferences || '').length > 50 ? '...' : '');
        return '<tr class="vr-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(r.name || '-') + '</div>'
          + (r.phone || r.email ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.phone || r.email) + '</div>' : '') + '</td>'
          + '<td><span style="color:' + (bdayDays != null && bdayDays <= 14 ? 'var(--gold)' : 'var(--t1)') + ';font-weight:' + (bdayDays != null && bdayDays <= 14 ? '700' : '400') + ';">'
            + (r.birthday ? this.fmtMD(r.birthday) + (bdayDays != null && bdayDays <= 30 ? ' (' + bdayDays + 'd)' : '') : '-') + '</span></td>'
          + '<td>' + (r.anniversary ? this.fmtMD(r.anniversary) + (annDays != null && annDays <= 30 ? ' (' + annDays + 'd)' : '') : '-') + '</td>'
          + '<td><span style="color:' + (quiet ? 'var(--red)' : 'var(--t2)') + ';">'
            + (r.last_visit ? this.fmtDate(r.last_visit) + (visitDays != null ? ' (' + visitDays + 'd)' : '') : '-') + '</span></td>'
          + '<td style="color:var(--t2);">' + esc(prefSnippet || '-') + '</td>'
          + '<td><div class="row-actions">'
          +   '<button class="btn btn-ghost btn-sm vr-edit" data-id="' + r.id + '">Edit</button>'
          +   '<button class="btn btn-danger btn-sm vr-del" data-id="' + r.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = summary + this.filterCard()
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Name</th><th>Birthday</th><th>Anniversary</th><th>Last Visit</th><th>Preferences</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  filterCard() {
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      +   '<div class="f" style="width:240px;flex-shrink:0;"><label>Search name or notes</label><input type="text" id="vr-f-text" value="' + esc(this.filterText) + '" placeholder="Bob, Manhattan, corner stool..."/></div>'
      +   '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;padding-top:18px;">'
      +     '<input type="checkbox" id="vr-f-quiet" ' + (this.filterQuiet ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Quiet 60+ days only</label>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="vr-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    const txt = this.filterText.trim().toLowerCase();
    return list.filter(r => {
      if (this.filterQuiet) {
        const d = this.daysSinceVisit(r.last_visit);
        if (d == null || d < 60) return false;
      }
      if (!txt) return true;
      const blob = ((r.name || '') + ' ' + (r.preferences || '') + ' ' + (r.notes || '') + ' ' + (r.phone || '') + ' ' + (r.email || '')).toLowerCase();
      return blob.includes(txt);
    });
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.vr-row');
      const edit = ev.target.closest('.vr-edit');
      const del  = ev.target.closest('.vr-del');
      const addF = ev.target.closest('#vr-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('vr-f-text')?.addEventListener('input',  e => { this.filterText = e.target.value || ''; this.renderList(); });
    document.getElementById('vr-f-quiet')?.addEventListener('change', e => { this.filterQuiet = !!e.target.checked; this.renderList(); });
    document.getElementById('vr-f-clear')?.addEventListener('click', () => { this.filterText = ''; this.filterQuiet = false; this.renderList(); });
  },

  showForm(id) {
    this.editId = id || null;
    const r = id ? this.regulars().find(x => x.id === id) : null;
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Regular' : 'Add a Regular') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Write the things you\'d want a new bartender to know. Drinks they order. Where they like to sit. Who they come in with. The dates that matter.</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:260px;flex-shrink:0;"><label>Name</label>'
          + '<input type="text" id="vr-name" value="' + esc(r?.name || '') + '" placeholder="Bob K."/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Phone (optional)</label>'
          + '<input type="tel" id="vr-phone" value="' + esc(r?.phone || '') + '" placeholder="Optional"/></div>'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Email (optional)</label>'
          + '<input type="email" id="vr-email" value="' + esc(r?.email || '') + '" placeholder="Optional"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Birthday</label>'
          + '<input type="text" id="vr-birthday" value="' + esc(r?.birthday || '') + '" placeholder="MM-DD (03-12)" maxlength="5"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Anniversary (optional)</label>'
          + '<input type="text" id="vr-anniversary" value="' + esc(r?.anniversary || '') + '" placeholder="MM-DD" maxlength="5"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Last Visit (optional)</label>'
          + '<input type="date" id="vr-last-visit" value="' + esc(r?.last_visit || '') + '"/></div>'
      + '</div>'

      + '<div class="f" style="margin-bottom:10px;"><label>Preferences (drink, seat, who they come with)</label>'
        + '<textarea id="vr-preferences" rows="2" placeholder="Manhattan up with a Luxardo cherry, corner stool by the window, in with his wife on Fridays.">' + esc(r?.preferences || '') + '</textarea></div>'

      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes (optional)</label>'
        + '<textarea id="vr-notes" rows="2" placeholder="Anything else: birthday party history, comp history, allergy, you spotted them at a different bar.">' + esc(r?.notes || '') + '</textarea></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="vr-save">' + (id ? 'Update' : 'Add Regular') + '</button>'
        + '<button class="btn btn-ghost" id="vr-cancel">Cancel</button>'
        + '<span id="vr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('vr-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('vr-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('vr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('vr-name')?.value.trim() || '';
    if (!name) { fail('Name is required.'); return; }

    const validMD = s => !s || /^\d{2}-\d{2}$/.test(s);
    const birthday    = document.getElementById('vr-birthday')?.value.trim() || '';
    const anniversary = document.getElementById('vr-anniversary')?.value.trim() || '';
    if (!validMD(birthday))    { fail('Birthday must be MM-DD format (for example 03-12).'); return; }
    if (!validMD(anniversary)) { fail('Anniversary must be MM-DD format.'); return; }

    const wasEmpty = this.regulars().length === 0 && !this.editId;
    const rec = {
      id:          this.editId || App.uid(),
      name,
      phone:       document.getElementById('vr-phone')?.value.trim() || '',
      email:       document.getElementById('vr-email')?.value.trim() || '',
      birthday,
      anniversary,
      last_visit:  document.getElementById('vr-last-visit')?.value || '',
      preferences: document.getElementById('vr-preferences')?.value.trim() || '',
      notes:       document.getElementById('vr-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.regulars();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('vr-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveKey('traffic_regulars');
    if (ok) {
      // Crossing zero → first regular logged credits a fix_log entry under
      // email-loyalty (regulars are essentially the manual loyalty channel
      // that scales the personal touch). No emit per record beyond that.
      if (wasEmpty) await App.emitTrafficFix('email-loyalty', 'Started tracking regulars');
      this.editId = null;
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update' : 'Add Regular'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this regular?', confirmText: 'Delete' });
    if (!ok) return;
    App.data.traffic_regulars = this.regulars().filter(x => x.id !== id);
    await App.saveKey('traffic_regulars');
    this.renderList();
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Regulars Book',
      subtitle: 'Capture regulars as you learn them; type into Bar Cop after.',
      columns: [
        { label: 'Name',          width: '150px' },
        { label: 'Contact',       width: '160px' },
        { label: 'Birthday',      width: '90px'  },
        { label: 'Anniversary',   width: '90px'  },
        { label: 'Preferences (drink, seat, etc.)' }
      ],
      rows: 18
    });
  }
};
