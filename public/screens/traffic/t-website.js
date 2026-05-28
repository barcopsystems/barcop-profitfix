'use strict';
S.TrafficWebsite = {
  // Toggle list drives off App.TRAFFIC_WEB_TOGGLES. web_top_source and
  // web_avg_duration killed 2026-05-28 per [[value-bar]] — operators don't
  // pull those from GA4 weekly, so the inputs were theatrical. The freed
  // space is a single weekly Notes textarea operators can actually use.
  get TOGGLES() { return App.TRAFFIC_WEB_TOGGLES; },

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const tSS   = ts.targets?.monthly_sessions || 2000;
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prev   = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    const checked = this.TOGGLES.filter(([k]) => prof[k]).length;
    const setup   = Math.round(checked / this.TOGGLES.length * 100);
    const ss = latest?.monthly_sessions ?? null;
    const br = latest?.bounce_rate ?? null;

    const trend = (cur, was, suffix) => {
      if (cur == null || was == null) return ' ';
      const diff = cur - was;
      if (Math.abs(diff) < 0.01) return 'No change vs last week';
      const amt = suffix === '%' ? Math.abs(diff).toFixed(0) : Math.round(Math.abs(diff)).toLocaleString();
      return (diff > 0 ? '↑ ' : '↓ ') + amt + (suffix || '') + ' vs last week';
    };
    const card = (label, valHtml, targetStr, trendStr) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + targetStr + '</div>'
      + '<div class="metric-trend">' + (trendStr || ' ') + '</div></div>';
    const onTargetVal = (val, ok) => '<div class="metric-val ' + (ok ? 'on-target' : 'over-target') + '">' + val + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const cards =
        card('Monthly Sessions', ss != null ? onTargetVal(ss.toLocaleString(), ss >= tSS) : noData, 'Target: ' + tSS.toLocaleString() + '/mo', trend(ss, prev?.monthly_sessions, ''))
      + card('Bounce Rate',      br != null ? onTargetVal(Math.round(br) + '%', br <= 60) : noData, 'Goal: under 60%', trend(br, prev?.bounce_rate, '%'))
      + card('Website Setup',    '<div class="metric-val" style="color:' + App.scoreColor(setup) + ';">' + setup + '%</div>', checked + ' of ' + this.TOGGLES.length + ' in place', ' ');

    const recent = weeks.slice(-8);
    const ssChart = App.trendChart({
      title: 'Monthly Website Sessions', target: tSS,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.monthly_sessions ?? null }))
    });
    const brChart = App.trendChart({
      title: 'Bounce Rate Trend', target: 60,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.bounce_rate ?? null }))
    });

    // ── Setup form ──
    const toggleRows = this.TOGGLES.map(([k, label]) =>
      '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="web-tog" data-key="' + k + '"' + (prof[k] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>' + label + '</label>'
    ).join('');

    const formCard = '<div class="card">'
      + '<div class="card-title">Website Setup</div>'
      + reviewedNote(prof.web_reviewed_at)
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:16px;">' + toggleRows + '</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes on this week\'s website traffic ' + tt('t-web-notes') + '</label>'
      +   '<textarea id="web-notes" rows="2" placeholder="Anything you noticed in the numbers this week: a campaign that drove a spike, a page that got slow, a referrer that surprised you.">' + esc(prof.web_notes || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="web-save">Save Website Setup</button>'
      + '<span id="web-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    this.TOGGLES.forEach(([k, label]) => { if (!prof[k]) tips.push('Website item not in place: ' + label + '.'); });
    if (ss != null && ss < tSS) tips.push('Monthly sessions are ' + ss.toLocaleString() + ', below the ' + tSS.toLocaleString() + ' target. Local SEO and an active Google Business Profile are the fastest levers.');
    if (br != null && br > 70) tips.push('Bounce rate is ' + Math.round(br) + '%, well above the 60% goal. Most visitors leave without acting. The homepage needs a clearer call to action.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Website Is Performing</div>'
        + '<div class="empty-sub">Setup is complete, sessions are on target, and visitors are engaging. Keep an eye on the trend.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + ssChart + brChart
      + formCard
      + tipsCard
      + '</div>';

    document.getElementById('web-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    // Snapshot pre-save state so a just-closed gap (every web setup item now
    // checked) can credit a fix_log entry to the Recovery Scoreboard.
    const beforeSetup = this.TOGGLES.filter(([k]) => prof[k]).length;
    this.container.querySelectorAll('.web-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    prof.web_notes = document.getElementById('web-notes')?.value || '';
    prof.web_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    if (ok) {
      const afterSetup = this.TOGGLES.filter(([k]) => prof[k]).length;
      if (afterSetup === this.TOGGLES.length && beforeSetup < this.TOGGLES.length) {
        App.emitTrafficFix('website', 'Website setup checklist 100% complete');
      }
    }
    this.draw();
    const msg = document.getElementById('web-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
