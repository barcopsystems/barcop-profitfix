'use strict';
S.TrafficEmail = {
  FREQUENCY: ['Weekly', 'Every two weeks', 'Monthly', 'Rarely', 'Never'],
  GROWTH: ['Website signup form', 'In-store signup', 'WiFi login capture', 'Online order checkout', 'No active mechanism'],
  OPEN_RATE_BENCHMARK: 20,
  LIST_BENCHMARK: 500,

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prev   = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    const list  = latest?.email_list_size ?? null;
    const sent  = latest?.emails_sent ?? null;
    const open  = latest?.email_open_rate ?? null;
    const loyal = latest ? latest.loyalty_active === 'yes' : false;
    const members = latest?.loyalty_members ?? null;

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
    const onTargetVal = (val, ok) => '<div class="metric-val ' + (ok == null ? '' : ok ? 'on-target' : 'over-target') + '">' + val + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const cards =
        card('Email List Size', list != null ? onTargetVal(list.toLocaleString(), list >= this.LIST_BENCHMARK) : noData, 'Benchmark: ' + this.LIST_BENCHMARK + '+', trend(list, prev?.email_list_size, ''))
      + card('Open Rate',       open != null ? onTargetVal(Math.round(open) + '%', open >= this.OPEN_RATE_BENCHMARK) : noData, 'Benchmark: ' + this.OPEN_RATE_BENCHMARK + '%+', trend(open, prev?.email_open_rate, '%'))
      + card('Emails Sent/Mo',  sent != null ? onTargetVal(String(sent), sent >= 1) : noData, 'Send at least monthly', trend(sent, prev?.emails_sent, ''))
      + card('Loyalty Members', loyal ? onTargetVal(members != null ? members.toLocaleString() : '0', members != null && members > 0) : '<div class="metric-val" style="color:var(--t4);font-size:22px;">Not active</div>', loyal ? 'Loyalty program active' : 'No loyalty program', ' ');

    // ── Trend charts ──
    const recent = weeks.slice(-8);
    const openChart = App.trendChart({
      title: 'Email Open Rate Trend', target: this.OPEN_RATE_BENCHMARK,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.email_open_rate ?? null }))
    });
    const listChart = App.trendChart({
      title: 'Email List Growth',
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.email_list_size ?? null }))
    });

    // ── Email detail inputs ──
    const freqOpts = '<option value="">—</option>' + this.FREQUENCY.map(f =>
      '<option' + (prof.email_frequency === f ? ' selected' : '') + '>' + f + '</option>').join('');
    const growthOpts = '<option value="">—</option>' + this.GROWTH.map(g =>
      '<option' + (prof.email_growth === g ? ' selected' : '') + '>' + g + '</option>').join('');

    const formCard = '<div class="card">'
      + '<div class="card-title">Email Program Detail</div>'
      + reviewedNote(prof.email_reviewed_at)
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:160px;"><label>Last Send Date ' + tt('t-email-lastsend') + '</label><input type="date" id="em-last" value="' + esc(prof.email_last_send || '') + '"/></div>'
      + '<div class="f" style="width:190px;"><label>Send Frequency ' + tt('t-email-frequency') + '</label><select id="em-freq">' + freqOpts + '</select></div>'
      + '<div class="f" style="width:230px;"><label>List Growth Mechanism ' + tt('t-email-growth') + '</label><select id="em-growth">' + growthOpts + '</select></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="em-save">Save Email Detail</button>'
      + '<span id="em-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (list != null && list < this.LIST_BENCHMARK) tips.push('Email list is ' + list.toLocaleString() + ' contacts, below the ' + this.LIST_BENCHMARK + ' benchmark. An owned list is the one channel no algorithm controls — grow it.');
    if (open != null && open < this.OPEN_RATE_BENCHMARK) tips.push('Open rate is ' + Math.round(open) + '%, below the ' + this.OPEN_RATE_BENCHMARK + '% benchmark. Tighten subject lines and send when guests are deciding where to eat.');
    if (sent != null && sent < 1) tips.push('No emails sent this month. A list you never email is a dead asset — send at least monthly.');
    if (prof.email_frequency === 'Rarely' || prof.email_frequency === 'Never') tips.push('Send frequency is "' + prof.email_frequency + '". Move to at least monthly so the list stays warm.');
    if (!prof.email_growth || prof.email_growth === 'No active mechanism') tips.push('No active list-growth mechanism. Add a signup form on the website and a capture point in-store.');
    if (!loyal) tips.push('No loyalty program active. A simple loyalty program turns one-time delivery and walk-in guests into regulars.');
    if (!latest) tips.push('No weekly data yet. Enter email metrics in This Week to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Email and Loyalty Are Working</div>'
        + '<div class="empty-sub">List size, open rate, send cadence, and loyalty are all on track. Keep sending consistently.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + openChart + listChart
      + formCard
      + tipsCard
      + '</div>';

    document.getElementById('em-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    prof.email_last_send = document.getElementById('em-last')?.value || '';
    prof.email_frequency = document.getElementById('em-freq')?.value || '';
    prof.email_growth    = document.getElementById('em-growth')?.value || '';
    prof.email_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    this.draw();
    const msg = document.getElementById('em-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
