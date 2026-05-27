'use strict';

/* ── Shift Control — Active Shift (writes sc_shifts) ──────────────────────────
   Mobile-first live shift command center. Start a shift, then a running view
   with this-shift activity (cash drops, voids/comps, 86s) and one-tap links to
   log them. End Shift captures revenue and covers and closes the sc_shifts
   record — the same record the rest of the platform reads for weekly revenue. */

S.ShiftActiveShift = {
  mode: null,

  shifts() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_shifts)) App.shiftData.sc_shifts = [];
    return App.shiftData.sc_shifts;
  },
  active() {
    return [...this.shifts()]
      .filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },
  shiftTypes() {
    return (S.ShiftLogShift && S.ShiftLogShift.SHIFT_TYPES) || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'];
  },
  byDate(key, date) {
    return ((App.shiftData && App.shiftData[key]) || []).filter(r => r.date === date);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  elapsed(iso) {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const act = this.active();
    this.mode = act ? 'active' : 'start';
    if (act) this.renderActive(act);
    else this.renderStart();
  },

  // ── Start a shift ───────────────────────────────────────────────────────────
  renderStart() {
    const typeOpts = this.shiftTypes().map(t => '<option>' + t + '</option>').join('');
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Start a Shift</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-bottom:16px;">No shift is running. Start one to '
      + 'track cash drops, voids, and 86s live, then close it out with revenue at the end.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="as-date" value="' + new Date().toISOString().slice(0, 10) + '" style="height:48px;"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="as-type" style="height:48px;">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>Manager</label>'
      + '<input type="text" id="as-mgr" placeholder="On duty" style="height:48px;"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Opening Bank</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="as-bank" min="0" step="0.01" '
      + 'inputmode="decimal" style="height:48px;font-size:16px;"/></div></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Staff on Floor</label>'
      + '<input type="number" id="as-staff" min="0" inputmode="numeric" style="height:48px;font-size:16px;"/></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="as-start">Start Shift</button>'
      + '<span id="as-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('as-start')?.addEventListener('click', () => this.startShift());
  },

  async startShift() {
    const err = document.getElementById('as-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('as-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };

    const rec = {
      id:             App.uid(),
      date,
      shift_type:     document.getElementById('as-type')?.value || '',
      manager:        document.getElementById('as-mgr')?.value.trim() || '',
      opening_bank:   num('as-bank'),
      staff_on_floor: num('as-staff'),
      bar_revenue:    0,
      floor_revenue:  0,
      total_revenue:  0,
      covers:         null,
      status:         'Open',
      notes:          '',
      started_at:     new Date().toISOString(),
      created_at:     new Date().toISOString()
    };

    const btn = document.getElementById('as-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Starting...'; }
    this.shifts().push(rec);
    const ok = await App.saveShift();
    if (ok) {
      this.renderActive(rec);
    } else {
      this.shifts().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Start Shift'; }
      fail('Could not start the shift. Try again.');
    }
  },

  // ── Active shift dashboard ──────────────────────────────────────────────────
  renderActive(s) {
    this.mode = 'active';
    const drops = this.byDate('sc_cash_drops', s.date);
    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);
    const vc = this.byDate('sc_void_comps', s.date);
    const vcTotal = vc.reduce((t, r) => t + (r.amount || 0), 0);
    const active86 = ((App.shiftData && App.shiftData.sc_86_list) || []).filter(i => i.status !== 'Back').length;
    const openMaint = ((App.shiftData && App.shiftData.sc_maintenance) || []).filter(m => m.status !== 'Resolved').length;

    const stat = (label, val, sub) =>
      '<div style="flex:1;min-width:130px;background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\';font-size:30px;font-weight:600;color:var(--w);line-height:1.1;">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + sub + '</div></div>';

    const action = (id, label) =>
      '<button class="btn btn-ghost as-go" data-go="' + id + '" style="height:52px;flex:1;min-width:150px;">' + label + '</button>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
      + '<span style="width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);"></span>'
      + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Shift Running</span></div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">'
      + (s.manager ? 'Manager: ' + esc(s.manager) + ' &middot; ' : '')
      + (s.started_at ? 'Running ' + this.elapsed(s.started_at) : '')
      + (s.opening_bank != null ? ' &middot; Opening bank ' + App.fmtCurrency(s.opening_bank) : '') + '</div>'
      + '</div>'

      + '<div class="card"><div class="card-title">This Shift</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + stat('Cash Drops', drops.length, App.fmtCurrency(dropTotal) + ' dropped')
      + stat('Voids &amp; Comps', vc.length, App.fmtCurrency(vcTotal) + ' total')
      + stat('86\'d Items', active86, active86 === 1 ? 'item out' : 'items out')
      + stat('Open Maint.', openMaint, openMaint === 1 ? 'issue' : 'issues')
      + '</div></div>'

      + '<div class="card"><div class="card-title">Log During This Shift</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + action('sc-cash-drop', 'Cash Drop')
      + action('sc-void-comp', 'Void / Comp')
      + action('sc-waste', 'Waste / Spill')
      + action('sc-86-list', '86 an Item')
      + action('sc-safe-log', 'Safe Log')
      + action('sc-maintenance', 'Maintenance')
      + '</div></div>'

      + '<div class="card"><div class="card-title">End of Shift</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-bottom:14px;">Closing the shift records its revenue '
      + 'and covers. That revenue is what feeds your weekly Profit and Revenue numbers.</div>'
      + '<button class="btn btn-primary btn-lg" id="as-end">End Shift</button>'
      + '</div></div>';

    this.container.onclick = ev => {
      const go = ev.target.closest('.as-go');
      if (go) App.navigate(go.dataset.go);
      else if (ev.target.closest('#as-end')) this.renderEnd(s);
    };
  },

  // ── End / close the shift ───────────────────────────────────────────────────
  renderEnd(s) {
    this.mode = 'end';
    const v = val => (val != null && val !== '') ? val : '';
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">End ' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Bar Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ae-bar" min="0" step="0.01" '
      + 'inputmode="decimal" value="' + v(s.bar_revenue) + '" style="height:48px;font-size:16px;" oninput="S.ShiftActiveShift.calcEnd()"/></div></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Floor Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ae-floor" min="0" step="0.01" '
      + 'inputmode="decimal" value="' + v(s.floor_revenue) + '" style="height:48px;font-size:16px;" oninput="S.ShiftActiveShift.calcEnd()"/></div></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Covers</label>'
      + '<input type="number" id="ae-covers" min="0" inputmode="numeric" value="' + v(s.covers) + '" '
      + 'style="height:48px;font-size:16px;" oninput="S.ShiftActiveShift.calcEnd()"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="ae-notes" rows="2" placeholder="Optional">' + esc(s.notes || '') + '</textarea></div></div>'
      + '<div class="calc">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val good" id="ae-total">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="ae-check">-</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="ae-close">Close Shift</button>'
      + '<button class="btn btn-ghost" id="ae-back">Back</button>'
      + '<span id="ae-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#ae-back')) this.renderActive(s);
      else if (ev.target.closest('#ae-close')) this.closeShift(s);
    };
    this.calcEnd();
  },

  calcEnd() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const total = num('ae-bar') + num('ae-floor');
    const covers = num('ae-covers');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ae-total', App.fmtCurrency(total));
    set('ae-check', covers > 0 ? App.fmtCurrency(total / covers) : '-');
  },

  async closeShift(s) {
    const err = document.getElementById('ae-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const bar = num('ae-bar') || 0, floor = num('ae-floor') || 0;

    const list = this.shifts();
    const i = list.findIndex(x => x.id === s.id);
    if (i < 0) { this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div')); return; }

    const snapshot = { ...list[i] };
    list[i] = {
      ...list[i],
      bar_revenue:   bar,
      floor_revenue: floor,
      total_revenue: bar + floor,
      covers:        num('ae-covers'),
      notes:         document.getElementById('ae-notes')?.value.trim() || '',
      status:        'Closed',
      closed_at:     new Date().toISOString()
    };

    const btn = document.getElementById('ae-close');
    if (btn) { btn.disabled = true; btn.textContent = 'Closing...'; }
    const ok = await App.saveShift();
    if (ok) {
      this.renderClosed(list[i]);
    } else {
      list[i] = snapshot;
      if (btn) { btn.disabled = false; btn.textContent = 'Close Shift'; }
      fail('Could not close the shift. Try again.');
    }
  },

  renderClosed(s) {
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Shift Closed</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date)
      + ' &middot; ' + App.fmtCurrency(s.total_revenue || 0) + ' revenue'
      + (s.covers ? ' &middot; ' + s.covers + ' covers' : '') + '</div></div>'
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-ghost" id="ac-start">Start Another Shift</button>'
      + '<button class="btn btn-primary" id="ac-history">View Shift History</button>'
      + '</div></div></div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#ac-start')) this.renderStart();
      else if (ev.target.closest('#ac-history')) App.navigate('sc-shift-history');
    };
  }
};
