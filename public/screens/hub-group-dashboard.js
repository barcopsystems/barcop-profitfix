'use strict';

/* ── Hub Group Dashboard ─────────────────────────────────────────────────────
   Roll-up view across every bar the operator belongs to. One row per bar,
   headline metrics in columns, color-coded against target the same way the
   single-bar Hub Dashboard tiles are. Click a row to switch active account
   and enter that bar's Hub.

   Modal overlay (not full-page). Group Dashboard is a quick cross-context
   comparison tool, not a workspace, so it pops over the current screen and
   closes cleanly back to wherever the operator was. Triggered from the
   "Group Dashboard" topbar button that mounts next to the location switcher
   (multi-location operators only). See [[hub-fullpage-pattern]] for why
   this is the exception to the full-page Hub-screen pattern. */

S.HubGroupDashboard = {

  // Standard centered card modal: App.openModal supplies the chrome, the corner
  // close X, and the centering. Kept wide (1100px) for the comparison table.
  async open() {
    App.openModal(this._wrap('<div style="font-size:13px;color:var(--t3);padding:4px 2px;">Loading bars...</div>'), { id: 'gd-modal', maxWidth: 1100, noClose: true });
    this._wireClose();
    const accounts = await DB.listMyAccounts();
    const dataByAccount = await this._fetchAccountData(accounts);
    // The active bar's data lives in memory (App.data) and is the source of
    // truth on this device (newer than the last Supabase snapshot, or sample
    // data that never synced), so always use it for the active bar's row.
    const activeId = (window.DB && DB._accountId) || null;
    if (activeId && App.data) dataByAccount[activeId] = App.data;
    App.openModal(this._wrap(this._body(accounts, dataByAccount)), { id: 'gd-modal', maxWidth: 1100, noClose: true });
    this._wireClose();
    this._wireRows();
  },

  // The standard card shell: a form-card with a banded card-title and a footer
  // Close button (no corner X — noClose is passed to openModal).
  _wrap(bodyHtml) {
    return '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Group Dashboard</div>'
      + bodyHtml
      + '<div class="card-actions"><button class="btn btn-ghost" id="gd-close-btn">Close</button></div>'
      + '</div>';
  },

  _wireClose() {
    document.getElementById('gd-close-btn')?.addEventListener('click', () => App.closeModal('gd-modal'));
  },

  async _fetchAccountData(accounts) {
    if (!accounts || !accounts.length) return {};
    const ids = accounts.map(a => a.id);
    try {
      const { data, error } = await DB._sb
        .from('user_data')
        .select('account_id, data')
        .in('account_id', ids);
      if (error) { console.error('Group dashboard fetch error:', error); return {}; }
      const map = {};
      (data || []).forEach(row => { map[row.account_id] = row.data || {}; });
      return map;
    } catch (e) {
      console.error('Group dashboard fetch exception:', e);
      return {};
    }
  },

  // Extract the headline numbers from one account's user_data blob.
  // All values may be null if the bar has not logged a week yet.
  // Pick the newest record from an unordered array by its date-ish field, so a
  // Supabase blob (or a sample seed) in any order still yields the latest week.
  _latest(arr, key) {
    if (!arr || !arr.length) return null;
    return arr.slice().sort((a, b) => String((b && b[key]) || '').localeCompare(String((a && a[key]) || '')))[0];
  },

  _metrics(accountData) {
    const d = accountData || {};
    const s = d.settings || {};
    const t = s.targets || {};
    const weeks = (d.weeks || []).filter(w => w && (w.bar?.revenue || w.food?.revenue));
    const lastW = this._latest(weeks, 'period_end');
    const rWeeks = (d.revenue_weeks || []).filter(w => w && ((w.bar_revenue || 0) + (w.floor_revenue || 0) > 0));
    const lastR = this._latest(rWeeks, 'period_end');
    const barRev = lastW?.bar?.revenue || 0;
    const foodRev = lastW?.food?.revenue || 0;
    // Bar Cop Audit — the executive monthly score across the whole operation.
    // Latest audit per account; null if the bar has not run one yet.
    const bcaAudits = Array.isArray(d.bar_cop_audits) ? d.bar_cop_audits : [];
    const lastBCA   = this._latest(bcaAudits, 'date');
    return {
      barCopAudit: lastBCA?.overall_score ?? null,
      weeklyRevenue: (barRev + foodRev) || null,
      pourCost:  lastW?.bar?.cost_pct ?? null,
      foodCost:  lastW?.food?.cost_pct ?? null,
      primeCost: lastW?.prime_cost_pct ?? null,
      laborPct:  lastR?.labor_pct_blended ?? null,
      targets: {
        pourCost:  t.bar_pour_cost_pct ?? 22,
        foodCost:  t.food_cost_pct ?? 32,
        primeCost: t.prime_cost_pct ?? 60,
        laborPct:  t.labor_cost_pct ?? 30
      }
    };
  },

  // Audit-score color band. Mirrors the at-a-glance softScore used on the Hub
  // Dashboard so the Group view feels visually consistent with the per-bar view.
  _scoreColor(v) {
    if (v == null) return 'var(--t3)';
    if (v >= 70) return 'var(--green)';
    if (v >= 50) return 'var(--gold)';
    return 'var(--red)';
  },

  // Bar Cop's standard green/amber/red banding logic
  _band(val, target, direction) {
    if (val == null || target == null) return 'na';
    const diff = direction === 'low' ? (val - target) : (target - val);
    if (diff <= 0) return 'good';
    if (direction === 'low') {
      const pct = ((val - target) / target) * 100;
      return pct <= 5 ? 'warn' : 'bad';
    } else {
      const pct = ((target - val) / target) * 100;
      return pct <= 5 ? 'warn' : 'bad';
    }
  },

  _bandColor(band) {
    return band === 'good' ? 'var(--green)'
      : band === 'warn' ? 'var(--gold)'
      : band === 'bad'  ? 'var(--red)'
      : 'var(--t3)';
  },

  _fmtPct(v) { return v == null ? '--' : v.toFixed(1) + '%'; },
  _fmtCur(v) { return v == null ? '--' : App.fmtCurrency(v); },
  _fmtRating(v) { return v == null ? '--' : v.toFixed(1) + ' ★'; },
  _fmtScore(v) { return v == null ? '--' : String(Math.round(v)); },

  // Builds the body inside the form-card: the comparison table as a standard
  // data-card, or an empty state. No explainer text; the columns and the
  // clickable rows carry it.
  _body(accounts, dataByAccount) {
    if (!accounts || accounts.length === 0) {
      return '<div style="font-size:13px;color:var(--t3);padding:4px 2px;">No bars found on your account.</div>';
    }
    if (accounts.length === 1) {
      return '<div style="font-size:13px;color:var(--t2);padding:4px 2px;line-height:1.7;">The Group Dashboard rolls up headline numbers across your bars. You have one. Add a second bar from Your Account to use this view.</div>';
    }
    const numCell = 'font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;white-space:nowrap;';
    const header = '<thead><tr>'
      + '<th>Bar</th><th>Bar Cop Audit</th><th>Weekly Revenue</th><th>Pour Cost</th>'
      + '<th>Food Cost</th><th>Prime Cost</th><th>Labor %</th>'
      + '</tr></thead>';
    const rows = accounts.map(a => {
      const m = this._metrics(dataByAccount[a.id]);
      const pourBand  = this._band(m.pourCost,  m.targets.pourCost,  'low');
      const foodBand  = this._band(m.foodCost,  m.targets.foodCost,  'low');
      const primeBand = this._band(m.primeCost, m.targets.primeCost, 'low');
      const laborBand = this._band(m.laborPct,  m.targets.laborPct,  'low');
      const auditColor = this._scoreColor(m.barCopAudit);
      return '<tr class="gd-row" data-account="' + esc(a.id) + '" style="cursor:pointer;">'
        + '<td><div class="val">' + esc(a.name) + '</div></td>'
        + '<td style="' + numCell + 'color:' + auditColor + ';">' + this._fmtScore(m.barCopAudit) + (m.barCopAudit != null ? '<span style="font-family:\'Barlow\',sans-serif;font-size:10px;color:var(--t3);font-weight:600;margin-left:2px;">/ 100</span>' : '') + '</td>'
        + '<td style="' + numCell + 'color:var(--t1);">' + this._fmtCur(m.weeklyRevenue) + '</td>'
        + '<td style="' + numCell + 'color:' + this._bandColor(pourBand) + ';">' + this._fmtPct(m.pourCost) + '</td>'
        + '<td style="' + numCell + 'color:' + this._bandColor(foodBand) + ';">' + this._fmtPct(m.foodCost) + '</td>'
        + '<td style="' + numCell + 'color:' + this._bandColor(primeBand) + ';">' + this._fmtPct(m.primeCost) + '</td>'
        + '<td style="' + numCell + 'color:' + this._bandColor(laborBand) + ';">' + this._fmtPct(m.laborPct) + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="card card-bleed data-card" style="margin:0;"><div class="card-bleed-tbl"><table class="tbl">' + header + '<tbody>' + rows + '</tbody></table></div></div>';
  },

  _wireRows() {
    const host = document.getElementById('gd-modal');
    if (!host) return;
    host.querySelectorAll('.gd-row').forEach(row => {
      row.addEventListener('click', () => {
        const aid = row.dataset.account;
        if (aid) DB.setActiveAccount(aid);   // switches account; page reloads into that bar's Hub
      });
    });
  }
};
