'use strict';
S.TrafficEmail = {
  // Drives off canonical App enums + benchmarks so frequency, growth options,
  // and the two performance benchmarks stay in sync.
  get FREQUENCY()           { return App.TRAFFIC_EMAIL_FREQUENCY; },
  get GROWTH()              { return App.TRAFFIC_EMAIL_GROWTH_SOURCES; },
  get OPEN_RATE_BENCHMARK() { return App.TRAFFIC_BENCHMARKS.open_rate; },
  get LIST_BENCHMARK()      { return App.TRAFFIC_BENCHMARKS.list_size; },

  // Email Campaign Log — per-campaign detail (date, subject, send count,
  // open % if known, action driven). Bookkeeper-ready answer to "what did
  // you send" and drives Emails Sent/Mo with real data when the operator
  // is logging campaigns rather than typing monthly counts.
  CAMPAIGN_TYPES: ['Newsletter', 'Event Promo', 'New Menu', 'Welcome', 'Win-Back', 'Holiday', 'Other'],
  addingCamp: false,
  editId: null,

  campaigns() {
    if (!Array.isArray(App.data.traffic_email_campaigns)) App.data.traffic_email_campaigns = [];
    return App.data.traffic_email_campaigns;
  },
  thisMonthCampaigns() {
    const ym = new Date().toISOString().slice(0, 7);
    return this.campaigns().filter(c => (c.date || '').slice(0, 7) === ym);
  },

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
    // Emails Sent/Mo prefers the campaign log count when any campaign is
    // logged this month; falls back to operator-typed weekly figure otherwise.
    const monthCampLog = this.thisMonthCampaigns().length;
    const sent = monthCampLog > 0 ? monthCampLog : (latest?.emails_sent ?? null);
    // Open rate prefers an average across this-month logged campaigns when
    // any opens were typed; otherwise the weekly typed figure.
    const monthCampOpens = this.thisMonthCampaigns().map(c => c.open_rate).filter(v => v != null);
    const open = monthCampOpens.length
      ? monthCampOpens.reduce((a,b) => a+b, 0) / monthCampOpens.length
      : (latest?.email_open_rate ?? null);

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
      + card('Emails Sent/Mo',  sent != null ? onTargetVal(String(sent), sent >= 1) : noData, 'Send at least monthly', trend(sent, prev?.emails_sent, ''));

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
    const freqOpts = '<option value="">-</option>' + this.FREQUENCY.map(f =>
      '<option' + (prof.email_frequency === f ? ' selected' : '') + '>' + f + '</option>').join('');
    const growthOpts = '<option value="">-</option>' + this.GROWTH.map(g =>
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
    if (list != null && list < this.LIST_BENCHMARK) tips.push('Email list is ' + list.toLocaleString() + ' contacts, below the ' + this.LIST_BENCHMARK + ' benchmark. An owned list is the one channel no algorithm controls. Grow it.');
    if (open != null && open < this.OPEN_RATE_BENCHMARK) tips.push('Open rate is ' + Math.round(open) + '%, below the ' + this.OPEN_RATE_BENCHMARK + '% benchmark. Tighten subject lines and send when guests are deciding where to eat.');
    if (sent != null && sent < 1) tips.push('No emails sent this month. A list you never email is a dead asset. Send at least monthly.');
    if (prof.email_frequency === 'Rarely' || prof.email_frequency === 'Never') tips.push('Send frequency is "' + prof.email_frequency + '". Move to at least monthly so the list stays warm.');
    if (!prof.email_growth || prof.email_growth === 'No active mechanism') tips.push('No active list-growth mechanism. Add a signup form on the website and a capture point in-store.');
    if (!latest) tips.push('No weekly data yet. Enter email metrics in This Week to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Email Marketing Is Working</div>'
        + '<div class="empty-sub">List size, open rate, and send frequency are all on track. Keep sending consistently.</div></div></div>';

    const logCard = this.campaignLogCard();

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + openChart + listChart
      + formCard
      + logCard
      + tipsCard
      + '</div>';

    document.getElementById('em-save')?.addEventListener('click', () => this.save());
    this.wireLog();
  },

  campaignLogCard() {
    const all = this.campaigns().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = all.slice(0, 12);
    const monthCount = this.thisMonthCampaigns().length;

    const rows = recent.length ? recent.map(c => {
      const subjSnippet = (c.subject || '').slice(0, 60) + ((c.subject || '').length > 60 ? '...' : '');
      const openStr = c.open_rate != null ? Math.round(c.open_rate) + '%' : '<span style="color:var(--t4);">-</span>';
      return '<tr class="ecl-row" data-id="' + c.id + '" style="cursor:pointer;">'
        + '<td>' + esc(c.date || '') + '</td>'
        + '<td>' + esc(c.type || '-') + '</td>'
        + '<td style="color:var(--t2);">' + esc(subjSnippet || '-') + '</td>'
        + '<td class="val">' + (c.send_count != null ? c.send_count.toLocaleString() : '-') + '</td>'
        + '<td class="val">' + openStr + '</td>'
        + '<td><div class="row-actions">'
        +   '<button class="btn btn-ghost btn-sm ecl-edit" data-id="' + c.id + '">Edit</button>'
        +   '<button class="btn btn-danger btn-sm ecl-del" data-id="' + c.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('') : '';

    const tableHtml = recent.length
      ? '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Subject</th><th>Sent To</th><th>Open %</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (all.length > recent.length ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Showing 12 of ' + all.length + ' logged campaigns.</div>' : '')
      : '<div style="padding:14px 0;font-size:12px;color:var(--t3);line-height:1.55;">No email campaigns logged yet. Log each campaign when you send it. The log gives you the bookkeeper-ready answer to "what did you send" and drives Emails Sent/Mo with a real count.</div>';

    const form = this.addingCamp ? this.campaignForm() : '';
    const headerActions = this.addingCamp
      ? ''
      : '<button class="btn btn-ghost btn-sm" id="ecl-print">Worksheet</button>'
        + '<button class="btn btn-primary btn-sm" id="ecl-add">+ Log Campaign</button>';

    return '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
      +   '<div class="card-title" style="margin-bottom:0;">Email Campaign Log</div>'
      +   '<div style="display:flex;gap:8px;">' + headerActions + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">' + monthCount + ' campaigns logged this month (minimum 1/mo to keep the list warm).</div>'
      + form
      + tableHtml
      + '</div>';
  },

  campaignForm() {
    const c = this.editId ? this.campaigns().find(x => x.id === this.editId) : null;
    const today = App.todayLocal();
    const typeOpts = '<option value="">-</option>' + this.CAMPAIGN_TYPES.map(t =>
      '<option' + (c && c.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    return '<div style="background:var(--input);border:1px solid var(--b1);border-radius:6px;padding:14px;margin-bottom:14px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t3);text-transform:uppercase;margin-bottom:10px;">' + (this.editId ? 'Edit Campaign' : 'Log an Email Campaign') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
      +   '<div class="f" style="width:150px;"><label>Send Date</label><input type="date" id="ecl-date" value="' + esc(c?.date || today) + '"/></div>'
      +   '<div class="f" style="width:160px;"><label>Campaign Type</label><select id="ecl-type">' + typeOpts + '</select></div>'
      +   '<div class="f" style="width:140px;"><label>Sent To</label><div class="fw"><input class="suf" type="number" id="ecl-sent" value="' + (c?.send_count != null ? c.send_count : '') + '" min="0"/><span class="suf">contacts</span></div></div>'
      +   '<div class="f" style="width:140px;"><label>Open Rate (if known)</label><div class="fw"><input class="suf" type="number" id="ecl-open" value="' + (c?.open_rate != null ? c.open_rate : '') + '" step="1" min="0" max="100"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:10px;"><label>Subject Line</label>'
      +   '<input type="text" id="ecl-subject" value="' + esc(c?.subject || '') + '" placeholder="Sunday brunch is back with bottomless mimosas"/></div>'
      + '<div class="f" style="margin-bottom:0;"><label>Result / Action Driven (optional)</label>'
      +   '<textarea id="ecl-result" rows="2" placeholder="What did this campaign do? Bookings, walk-ins, replies, anything you noticed.">' + esc(c?.result || '') + '</textarea></div>'
      + '<div class="card-actions" style="margin-top:12px;">'
      +   '<button class="btn btn-primary btn-sm" id="ecl-save">' + (this.editId ? 'Update' : 'Save Campaign') + '</button>'
      +   '<button class="btn btn-ghost btn-sm" id="ecl-cancel">Cancel</button>'
      +   '<span id="ecl-err" style="color:var(--red);font-size:11px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  wireLog() {
    const addBtn = document.getElementById('ecl-add');
    if (addBtn) addBtn.addEventListener('click', () => { this.addingCamp = true; this.editId = null; this.draw(); });
    const printBtn = document.getElementById('ecl-print');
    if (printBtn) printBtn.addEventListener('click', () => this.printBlankSheet());
    const saveBtn = document.getElementById('ecl-save');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveCampaign());
    const cancelBtn = document.getElementById('ecl-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { this.addingCamp = false; this.editId = null; this.draw(); });
    this.container.querySelectorAll('.ecl-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.ecl-edit') || e.target.closest('.ecl-del')) return;
        this.addingCamp = true; this.editId = row.dataset.id; this.draw();
      });
    });
    this.container.querySelectorAll('.ecl-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.addingCamp = true; this.editId = btn.dataset.id; this.draw(); });
    });
    this.container.querySelectorAll('.ecl-del').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!(await App.confirmDelete())) return;
        await App.removeRecord('core', 'traffic_email_campaign', btn.dataset.id);
        this.draw();
      });
    });
  },

  printBlankSheet() {
    App.printBlankSheet({
      title: 'Email Campaign Log',
      subtitle: 'Capture each email campaign sent; type into Bar Cop after the send.',
      columns: [
        { label: 'Date',    width: '90px'  },
        { label: 'Type',    width: '110px' },
        { label: 'Subject' },
        { label: 'Sent To', width: '90px'  },
        { label: 'Open %',  width: '70px'  },
        { label: 'Result',  width: '160px' }
      ],
      rows: 8
    });
  },

  async saveCampaign() {
    const err = document.getElementById('ecl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date     = document.getElementById('ecl-date')?.value;
    const type     = document.getElementById('ecl-type')?.value;
    const subject  = document.getElementById('ecl-subject')?.value.trim() || '';
    const sendStr  = document.getElementById('ecl-sent')?.value;
    const openStr  = document.getElementById('ecl-open')?.value;
    const result   = document.getElementById('ecl-result')?.value.trim() || '';
    if (!date)     { fail('Send date is required.'); return; }
    if (!type)     { fail('Pick a campaign type.'); return; }
    if (!subject)  { fail('Subject line is required.'); return; }

    const beforeMonthCount = this.thisMonthCampaigns().length;
    const rec = {
      id: this.editId || App.uid(),
      date, type, subject, result,
      send_count: sendStr === '' ? null : parseInt(sendStr),
      open_rate:  openStr === '' ? null : parseFloat(openStr),
      saved_at: new Date().toISOString()
    };
    const list = this.campaigns();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    }
    const ok = await App.putRecord('core', 'traffic_email_campaign', saved);
    if (ok) {
      const afterMonthCount = this.thisMonthCampaigns().length;
      // Crossing 1 sent this month closes the "no emails sent" gap. Above
      // that, no additional emit per campaign (the monthly milestone is the
      // signal — flooding fix_log with every send would noise the Scoreboard).
      if (afterMonthCount >= 1 && beforeMonthCount === 0) {
        await App.emitTrafficFix('email-loyalty', 'Email campaign logged for the month');
      }
      this.addingCamp = false;
      this.editId = null;
      this.draw();
    } else {
      fail('Save failed. Try again.');
    }
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    const beforeFreq   = prof.email_frequency || '';
    const beforeGrowth = prof.email_growth || '';
    prof.email_last_send = document.getElementById('em-last')?.value || '';
    prof.email_frequency = document.getElementById('em-freq')?.value || '';
    prof.email_growth    = document.getElementById('em-growth')?.value || '';
    prof.email_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    if (ok) {
      const inactiveFreq = ['', 'Rarely', 'Never'];
      const inactiveGrowth = ['', 'No active mechanism'];
      if (!inactiveFreq.includes(prof.email_frequency) && inactiveFreq.includes(beforeFreq)) {
        await App.emitTrafficFix('email-loyalty', 'Email send cadence moved to ' + prof.email_frequency);
      }
      if (!inactiveGrowth.includes(prof.email_growth) && inactiveGrowth.includes(beforeGrowth)) {
        await App.emitTrafficFix('email-loyalty', 'List growth mechanism active: ' + prof.email_growth);
      }
    }
    this.draw();
    const msg = document.getElementById('em-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
