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

  async open() {
    App.openHubOverlay((panel) => {
      // Widen the modal panel beyond its default 920px so the 7-column
      // comparison table reads cleanly without horizontal scroll.
      panel.style.maxWidth = '1100px';
      panel.innerHTML = this.renderLoading();
      document.getElementById('gd-close')?.addEventListener('click', () => App.closeHubOverlay());
      this._renderAsync(panel);
    });
  },

  _header() {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 0 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);margin-bottom:18px;">'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Group Dashboard</div>'
      +   '<button id="gd-close" type="button" aria-label="Close" style="background:none;border:none;color:var(--t2);font-size:26px;line-height:1;cursor:pointer;padding:0 4px;font-weight:300;">&times;</button>'
      + '</div>';
  },

  renderLoading() {
    return '<div style="padding:0 24px 32px;">'
      + this._header()
      + '<div style="font-size:13px;color:var(--t3);padding:24px 0;">Loading bars...</div>'
      + '</div>';
  },

  async _renderAsync(panel) {
    const accounts = await DB.listMyAccounts();
    const dataByAccount = await this._fetchAccountData(accounts);
    // The active bar's data lives in memory (App.data) and is the source of
    // truth on this device: it can be newer than the last Supabase snapshot, or
    // sample data that was never synced. Always use it for the active bar's row
    // so the bar you are currently in never shows up blank.
    const activeId = (window.DB && DB._accountId) || null;
    if (activeId && App.data) dataByAccount[activeId] = App.data;
    this._render(panel, accounts, dataByAccount);
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
  _metrics(accountData) {
    const d = accountData || {};
    const s = d.settings || {};
    const t = s.targets || {};
    const weeks = (d.weeks || []).filter(w => w && (w.bar?.revenue || w.food?.revenue));
    const lastW = weeks.length ? weeks[weeks.length - 1] : null;
    const rWeeks = (d.revenue_weeks || []).filter(w => w && ((w.bar_revenue || 0) + (w.floor_revenue || 0) > 0));
    const lastR = rWeeks.length ? rWeeks[rWeeks.length - 1] : null;
    const tWeeks = (d.traffic_weeks || []).filter(w => w && w.period_end);
    const lastT = tWeeks.length ? tWeeks[tWeeks.length - 1] : null;
    const barRev = lastW?.bar?.revenue || 0;
    const foodRev = lastW?.food?.revenue || 0;
    // Bar Cop Audit — the executive monthly score across the whole operation.
    // Latest audit per account; null if the bar has not run one yet.
    const bcaAudits = Array.isArray(d.bar_cop_audits) ? d.bar_cop_audits : [];
    const lastBCA   = bcaAudits.length ? bcaAudits[bcaAudits.length - 1] : null;
    return {
      barCopAudit: lastBCA?.overall_score ?? null,
      weeklyRevenue: (barRev + foodRev) || null,
      pourCost:  lastW?.bar?.cost_pct ?? null,
      foodCost:  lastW?.food?.cost_pct ?? null,
      primeCost: lastW?.prime_cost_pct ?? null,
      laborPct:  lastR?.labor_pct_blended ?? null,
      googleRating: lastT?.google_rating ?? null,
      targets: {
        pourCost:  t.bar_pour_cost_pct ?? 22,
        foodCost:  t.food_cost_pct ?? 32,
        primeCost: t.prime_cost_pct ?? 60,
        laborPct:  t.labor_cost_pct ?? 30,
        googleRating: t.google_rating ?? 4.3
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

  _render(panel, accounts, dataByAccount) {
    if (!accounts || accounts.length === 0) {
      panel.innerHTML = '<div style="padding:0 24px 32px;">'
        + this._header()
        + '<div style="font-size:13px;color:var(--t3);padding:24px 0;">No bars found on your account.</div>'
        + '</div>';
      document.getElementById('gd-close')?.addEventListener('click', () => App.closeHubOverlay());
      return;
    }
    if (accounts.length === 1) {
      panel.innerHTML = '<div style="padding:0 24px 32px;">'
        + this._header()
        + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px;font-size:13px;color:var(--t2);line-height:1.7;">'
        +   '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:10px;">One bar on this account</div>'
        +   'The Group Dashboard rolls up headline numbers across multiple bars. You currently have one. Add a second bar from User Accounts to start using this view.'
        + '</div>'
        + '</div>';
      document.getElementById('gd-close')?.addEventListener('click', () => App.closeHubOverlay());
      return;
    }

    const labelStyle = 'font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);padding:8px 10px;text-align:right;white-space:nowrap;';
    const cellStyle  = 'font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;padding:14px 10px;text-align:right;white-space:nowrap;';
    const nameStyle  = 'font-size:13px;font-weight:700;color:var(--t1);padding:14px 14px;text-align:left;';

    const header = '<thead><tr style="border-bottom:1px solid var(--b2);">'
      + '<th style="' + labelStyle + 'text-align:left;padding-left:14px;">Bar</th>'
      + '<th style="' + labelStyle + '">Bar Cop Audit</th>'
      + '<th style="' + labelStyle + '">Weekly Revenue</th>'
      + '<th style="' + labelStyle + '">Pour Cost</th>'
      + '<th style="' + labelStyle + '">Food Cost</th>'
      + '<th style="' + labelStyle + '">Prime Cost</th>'
      + '<th style="' + labelStyle + '">Labor %</th>'
      + '<th style="' + labelStyle + '">Google Rating</th>'
      + '</tr></thead>';

    const rows = accounts.map(a => {
      const m = this._metrics(dataByAccount[a.id]);
      const pourBand  = this._band(m.pourCost,  m.targets.pourCost,  'low');
      const foodBand  = this._band(m.foodCost,  m.targets.foodCost,  'low');
      const primeBand = this._band(m.primeCost, m.targets.primeCost, 'low');
      const laborBand = this._band(m.laborPct,  m.targets.laborPct,  'low');
      const grBand    = this._band(m.googleRating, m.targets.googleRating, 'high');
      const auditColor = this._scoreColor(m.barCopAudit);
      return '<tr class="gd-row" data-account="' + esc(a.id) + '" style="border-bottom:1px solid var(--b2);cursor:pointer;transition:background 0.12s;">'
        + '<td style="' + nameStyle + '">' + esc(a.name) + '</td>'
        + '<td style="' + cellStyle + 'color:' + auditColor + ';">' + this._fmtScore(m.barCopAudit) + (m.barCopAudit != null ? '<span style="font-family:\'Barlow\',sans-serif;font-size:10px;color:var(--t3);font-weight:600;margin-left:2px;">/ 100</span>' : '') + '</td>'
        + '<td style="' + cellStyle + 'color:var(--t1);">' + this._fmtCur(m.weeklyRevenue) + '</td>'
        + '<td style="' + cellStyle + 'color:' + this._bandColor(pourBand) + ';">' + this._fmtPct(m.pourCost) + '</td>'
        + '<td style="' + cellStyle + 'color:' + this._bandColor(foodBand) + ';">' + this._fmtPct(m.foodCost) + '</td>'
        + '<td style="' + cellStyle + 'color:' + this._bandColor(primeBand) + ';">' + this._fmtPct(m.primeCost) + '</td>'
        + '<td style="' + cellStyle + 'color:' + this._bandColor(laborBand) + ';">' + this._fmtPct(m.laborPct) + '</td>'
        + '<td style="' + cellStyle + 'color:' + this._bandColor(grBand) + ';">' + this._fmtRating(m.googleRating) + '</td>'
        + '</tr>';
    }).join('');

    panel.innerHTML = '<div style="padding:0 24px 32px;">'
      + this._header()
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:18px;">'
      +   'Headline numbers across every bar on your account. Click a row to switch to that bar and open its Hub Dashboard.'
      + '</div>'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;overflow:hidden;">'
      +   '<table style="width:100%;border-collapse:collapse;">' + header + '<tbody>' + rows + '</tbody></table>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t4);margin-top:14px;line-height:1.6;">'
      +   'Targets used for color banding are pulled from each bar\'s own settings. A dash means that bar has no data logged yet for that metric.'
      + '</div>'
      + '</div>';

    document.getElementById('gd-close')?.addEventListener('click', () => App.closeHubOverlay());
    panel.querySelectorAll('.gd-row').forEach(row => {
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.03)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => {
        const aid = row.dataset.account;
        if (!aid) return;
        // Switch active account, page reloads, operator lands on that bar's Hub.
        DB.setActiveAccount(aid);
      });
    });
  }
};
