'use strict';

/* ── Shift Control — 86 List (writes sc_86_list) ──────────────────────────────
   Mobile-first. The running list of items 86'd (out of stock) during service.
   Quick-add at the top, active items as large touch cards with a one-tap
   "Back In Stock". Repeat 86s feed Inventory Control's par-level alerts. */

S.Shift86List = {
  editId: null,
  _pendingDelId: null,
  CATEGORIES: ['Food', 'Liquor', 'Beer', 'Wine', 'Other'],

  items() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_86_list)) App.shiftData.sc_86_list = [];
    return App.shiftData.sc_86_list;
  },
  nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  // count of times this item name has been 86'd in the last 30 days
  repeatCount(name) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const key = (name || '').trim().toLowerCase();
    return this.items().filter(i =>
      (i.item || '').trim().toLowerCase() === key
      && new Date((i.date_86 || '') + 'T00:00:00') >= cutoff).length;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="el-export">Export PDF</button>';
    document.getElementById('el-export')?.addEventListener('click', () => window.print());
    this.editId = null;
    this.renderMain();
  },

  catBadge(cat) {
    return '<span class="badge badge-dim">' + esc(cat || 'Other') + '</span>';
  },

  renderMain() {
    const all = this.items();
    const active = all.filter(i => i.status !== 'Back')
      .sort((a, b) => new Date(b.created_at || b.date_86).getTime() - new Date(a.created_at || a.date_86).getTime());
    const back = all.filter(i => i.status === 'Back')
      .sort((a, b) => new Date(b.date_back || b.created_at || 0).getTime() - new Date(a.date_back || a.created_at || 0).getTime())
      .slice(0, 12);

    const catOpts = this.CATEGORIES.map(c => '<option>' + c + '</option>').join('');

    const quickAdd = '<div class="card"><div class="card-title">86 An Item</div>'
      + '<div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;">'
      + '<div class="f" style="flex:1;min-width:180px;"><label>Item</label>'
      + '<input type="text" id="qa-item" placeholder="What ran out?" style="height:48px;font-size:16px;"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Category</label>'
      + '<select id="qa-cat" style="height:48px;">' + catOpts + '</select></div>'
      + '<div class="f" style="width:190px;flex-shrink:0;"><label>Reason</label>'
      + '<input type="text" id="qa-reason" placeholder="Optional" style="height:48px;"/></div>'
      + '<button class="btn btn-primary" id="qa-go" style="height:48px;">86 It</button>'
      + '</div>'
      + '<div id="qa-err" style="color:var(--red);font-size:12px;margin-top:8px;display:none;"></div></div>';

    let activeCards;
    if (active.length === 0) {
      activeCards = '<div class="card"><div class="card-title">Currently 86\'d</div>'
        + '<div style="font-size:13px;color:var(--t3);padding:6px 0;">Nothing is 86\'d right now. The full bar and kitchen are available.</div></div>';
    } else {
      activeCards = '<div class="card"><div class="card-title">Currently 86\'d &middot; ' + active.length + '</div>'
        + active.map(i => {
          const reps = this.repeatCount(i.item);
          const repTag = reps > 1
            ? '<span class="badge badge-warn" style="margin-left:8px;">86\'d ' + reps + '&times; / 30d</span>'
            : '';
          return '<div class="ei-86" data-id="' + i.id + '" style="border:1px solid var(--b1);border-radius:6px;padding:14px;margin-bottom:10px;">'
            + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">'
            + '<span style="font-size:16px;font-weight:700;color:var(--t1);">' + esc(i.item) + '</span>'
            + this.catBadge(i.category) + repTag + '</div>'
            + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">86\'d ' + this.fmtDate(i.date_86)
            + (i.time_86 ? ' at ' + esc(i.time_86) : '')
            + (i.reason ? ' &middot; ' + esc(i.reason) : '')
            + (i.reported_by ? ' &middot; by ' + esc(i.reported_by) : '') + '</div>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
            + '<button class="btn btn-primary ei-back" data-id="' + i.id + '" style="height:44px;">Back In Stock</button>'
            + '<button class="btn btn-ghost ei-edit" data-id="' + i.id + '" style="height:44px;">Edit</button>'
            + '<button class="btn btn-danger ei-del" data-id="' + i.id + '" style="height:44px;">Delete</button>'
            + '</div></div>';
        }).join('') + '</div>';
    }

    let backCard = '';
    if (back.length > 0) {
      const rows = back.map(i => '<tr><td><div class="val">' + esc(i.item) + '</div></td>'
        + '<td>' + esc(i.category || '-') + '</td>'
        + '<td>' + this.fmtDate(i.date_86) + '</td>'
        + '<td>' + this.fmtDate(i.date_back) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm ei-re86" data-id="' + i.id + '">Re-86</button>'
        + '<button class="btn btn-danger btn-sm ei-del" data-id="' + i.id + '">Delete</button>'
        + '</div></td></tr>').join('');
      backCard = '<div class="card"><div class="card-title">Recently Back In Stock</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>86\'d</th><th>Back</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    const modal = '<div id="ei-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this 86 entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="ei-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="ei-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + quickAdd + activeCards + backCard + '</div>' + modal;
    this.container.onclick = ev => {
      const back = ev.target.closest('.ei-back');
      const edit = ev.target.closest('.ei-edit');
      const del = ev.target.closest('.ei-del');
      const re86 = ev.target.closest('.ei-re86');
      if (ev.target.closest('#qa-go')) this.quickAdd();
      else if (back) this.markBack(back.dataset.id);
      else if (edit) this.showForm(edit.dataset.id);
      else if (re86) this.re86(re86.dataset.id);
      else if (del)  this.confirmDel(del.dataset.id);
    };
    document.getElementById('qa-item')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.quickAdd();
    });
  },

  async quickAdd() {
    const err = document.getElementById('qa-err');
    const item = document.getElementById('qa-item')?.value.trim();
    if (!item) {
      if (err) { err.textContent = 'Enter an item name.'; err.style.display = 'block'; }
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    this.items().push({
      id:          App.uid(),
      item,
      category:    document.getElementById('qa-cat')?.value || 'Other',
      reason:      document.getElementById('qa-reason')?.value.trim() || '',
      date_86:     today,
      time_86:     this.nowTime(),
      reported_by: '',
      status:      '86',
      date_back:   '',
      notes:       '',
      created_at:  new Date().toISOString()
    });
    const ok = await App.saveShift();
    if (ok) this.renderMain();
    else if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'block'; }
  },

  async markBack(id) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    it.status = 'Back';
    it.date_back = new Date().toISOString().slice(0, 10);
    it.time_back = this.nowTime();
    await App.saveShift();
    this.renderMain();
  },

  async re86(id) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    it.status = '86';
    it.date_86 = new Date().toISOString().slice(0, 10);
    it.time_86 = this.nowTime();
    it.date_back = '';
    it.time_back = '';
    await App.saveShift();
    this.renderMain();
  },

  showForm(id) {
    this.editId = id;
    const i = this.items().find(x => x.id === id);
    if (!i) { this.renderMain(); return; }
    const catOpts = this.CATEGORIES.map(c =>
      '<option' + (i.category === c ? ' selected' : '') + '>' + c + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Edit 86 Entry</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="flex:1;min-width:180px;"><label>Item</label>'
      + '<input type="text" id="e86-item" value="' + esc(i.item || '') + '"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Category</label>'
      + '<select id="e86-cat">' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date 86\'d</label>'
      + '<input type="date" id="e86-date" value="' + esc(i.date_86 || '') + '"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Time 86\'d</label>'
      + '<input type="time" id="e86-time" value="' + esc(i.time_86 || '') + '"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Reported By</label>'
      + '<input type="text" id="e86-by" value="' + esc(i.reported_by || '') + '" placeholder="Name"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Reason</label>'
      + '<input type="text" id="e86-reason" value="' + esc(i.reason || '') + '" placeholder="Optional"/></div></div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="e86-notes" rows="2" placeholder="Optional">' + esc(i.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="e86-save">Update</button>'
      + '<button class="btn btn-ghost" id="e86-cancel">Cancel</button>'
      + '<span id="e86-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('e86-cancel')?.addEventListener('click', () => this.renderMain());
    document.getElementById('e86-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('e86-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const item = document.getElementById('e86-item')?.value.trim();
    if (!item) { fail('Item name is required.'); return; }

    const list = this.items();
    const i = list.findIndex(x => x.id === this.editId);
    if (i > -1) {
      list[i] = {
        ...list[i],
        item,
        category:    document.getElementById('e86-cat')?.value || 'Other',
        date_86:     document.getElementById('e86-date')?.value || list[i].date_86,
        time_86:     document.getElementById('e86-time')?.value || '',
        reported_by: document.getElementById('e86-by')?.value.trim() || '',
        reason:      document.getElementById('e86-reason')?.value.trim() || '',
        notes:       document.getElementById('e86-notes')?.value.trim() || ''
      };
    }

    const btn = document.getElementById('e86-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      this.renderMain();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Update'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('ei-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('ei-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('ei-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_86_list = this.items().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderMain();
    };
  }
};
