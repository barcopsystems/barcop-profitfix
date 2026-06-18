'use strict';

/* ── Traffic Recovery — Traffic Forecast ──────────────────────────────────────
   The forward / opportunity view of the online channel. NOT a prediction of a
   Google rating or a session count. It reads your latest weekly numbers and
   shows what closing each open online gap is worth in DOLLARS, at your OWN
   numbers: your sessions, your check average, your order value, and the
   conversion rates Bar Cop discloses (and you can adjust in Settings). Never an
   invented uplift percentage. Always ranges, always labeled an estimate, never a
   guarantee. Two kinds of opportunity, both honest:
     - a channel you HAVE that is below target  -> close the gap to target
     - a channel you DON'T have (ordering / reservations off) -> stand it up,
       valued off a slice of your existing sessions at a disclosed conversion.
   A channel that is on and at target shows what it is worth now, no fake gap.
   Annual figures only (online-presence work builds over a year, not a month).
   Header off (in App._CONVERTED). Read-only outlook, writes nothing. */

S.TrafficForecast = {

  // Disclosed conversion rates. Defaults are conservative; an operator can
  // override the first two in Settings (traffic_settings.conversion_rates).
  CONV: { session_to_visit: 3, email_open_to_visit: 1, session_to_reservation: 1.5, session_to_order: 1.2 },
  BAND_LOW: 0.7,
  BAND_HIGH: 1.3,

  // ── Inputs ──────────────────────────────────────────────────────────────────
  latestWeek() {
    const w = (App.data.traffic_weeks || []).slice()
      .sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    return w.length ? w[w.length - 1] : null;
  },
  profile() { return (App.data.traffic_settings && App.data.traffic_settings.profile) || {}; },
  targets() { return (App.data.traffic_settings && App.data.traffic_settings.targets) || {}; },
  conv(key)  {
    const c = (typeof Recovery !== 'undefined' && Recovery._tconv) ? Recovery._tconv() : {};
    return (c[key] != null ? c[key] : this.CONV[key]) / 100;
  },
  checkAvg() { return (typeof Recovery !== 'undefined' && Recovery._checkAvg) ? Recovery._checkAvg() : 35; },

  money(n) { return App.fmtCurrency(n, 0); },
  rangeLabel(low, high) {
    low = Math.round(low); high = Math.round(high);
    if (low <= 0 && high <= 0) return null;
    if (low === high) return this.money(low);
    return this.money(low) + ' – ' + this.money(high);
  },

  // ── Build the four outcome channels off the latest week + profile ───────────
  // Each: { id (Fix gap), title, stand (where you stand), worth (annual $ now),
  //         oppLow, oppHigh (annual $ range), note, status }.
  channels(w, p) {
    w = w || {}; p = p || {};
    const ca = this.checkAvg();
    const sessions = w.monthly_sessions != null ? Number(w.monthly_sessions) : null;
    const band = mid => ({ low: mid * this.BAND_LOW, high: mid * this.BAND_HIGH });
    const out = [];

    // 1 — Website visits (gap to target if below)
    {
      const conv = this.conv('session_to_visit');
      const tgt = this.targets().monthly_sessions != null ? Number(this.targets().monthly_sessions) : 2000;
      const worth = sessions != null ? sessions * conv * ca * 12 : null;
      let oppLow = 0, oppHigh = 0, note = '', status = 'nodata';
      if (sessions != null) {
        if (sessions < tgt) {
          const b = band((tgt - sessions) * conv * ca * 12);
          oppLow = b.low; oppHigh = b.high; status = 'opportunity';
          note = 'Reach your ' + Number(tgt).toLocaleString('en-US') + ' visits target.';
        } else { status = 'working'; note = 'At or above your visits target.'; }
      } else { note = 'Add your monthly visits in This Week.'; }
      out.push({ id: 'website', title: 'Website Visits', status,
        stand: sessions != null ? Number(sessions).toLocaleString('en-US') + ' visits/mo' : 'No data yet',
        worth, oppLow, oppHigh, note });
    }

    // 2 — Online ordering (have it -> worth now; dark -> stand it up off sessions)
    {
      const orders = w.delivery_orders != null ? Number(w.delivery_orders) : null;
      const aov = w.delivery_avg_order_value != null ? Number(w.delivery_avg_order_value) : ca;
      const hasOrdering = !!p.web_online_order || (orders != null && orders > 0);
      let worth = null, oppLow = 0, oppHigh = 0, note = '', status;
      if (hasOrdering) {
        worth = orders != null ? orders * aov * 12 : null;
        status = 'working';
        note = orders != null ? 'Running. Keep the menu and photos current.' : 'On. Add your monthly orders in This Week.';
      } else if (sessions != null) {
        const b = band(sessions * this.conv('session_to_order') * aov * 12);
        oppLow = b.low; oppHigh = b.high; status = 'dark'; worth = 0;
        note = 'No online ordering. A slice of your visits would order if you stood it up.';
      } else { status = 'dark'; note = 'No online ordering, and no visits logged to size it.'; }
      out.push({ id: 'delivery', title: 'Online Ordering', status,
        stand: hasOrdering ? (orders != null ? Number(orders).toLocaleString('en-US') + ' orders/mo' : 'On') : 'Not set up',
        worth, oppLow, oppHigh, note });
    }

    // 3 — Online reservations (have it -> worth now; dark -> stand it up)
    {
      const resv = w.monthly_reservations != null ? Number(w.monthly_reservations) : null;
      const hasResv = !!p.web_reservations;
      let worth = null, oppLow = 0, oppHigh = 0, note = '', status;
      if (hasResv) {
        worth = resv != null ? resv * ca * 12 : null;
        status = 'working';
        note = resv != null ? 'Running. Keep the booking link one tap from the homepage.' : 'On. Add your monthly reservations in This Week.';
      } else if (sessions != null) {
        const b = band(sessions * this.conv('session_to_reservation') * ca * 12);
        oppLow = b.low; oppHigh = b.high; status = 'dark'; worth = 0;
        note = 'No online reservations. Visitors who would book are leaving instead.';
      } else { status = 'dark'; note = 'No online reservations, and no visits logged to size it.'; }
      out.push({ id: 'website', title: 'Online Reservations', status,
        stand: hasResv ? (resv != null ? Number(resv).toLocaleString('en-US') + ' reservations/mo' : 'On') : 'Not set up',
        worth, oppLow, oppHigh, note });
    }

    // 4 — Email (worth now where there's a list; no honest stand-up off sessions)
    {
      const list = w.email_list_size != null ? Number(w.email_list_size) : null;
      const open = w.email_open_rate != null ? Number(w.email_open_rate) : null;
      let worth = null, note = '', status;
      if (list != null && list > 0 && open != null) {
        worth = list * (open / 100) * this.conv('email_open_to_visit') * ca * 12;
        status = 'working';
        note = 'Your owned channel. Send at least once a week.';
      } else { status = 'dark'; note = 'No email list yet. Add a sign-up so new guests opt in.'; }
      out.push({ id: 'email-loyalty', title: 'Email Marketing', status,
        stand: (list != null && list > 0) ? Number(list).toLocaleString('en-US') + ' contacts' : 'Not set up',
        worth, oppLow: 0, oppHigh: 0, note });
    }

    return out;
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const w = this.latestWeek();

    if (!w) {
      App.setupCard(container, {
        title: 'Traffic Forecast',
        lead: 'Once you confirm a week in This Week, Bar Cop shows what closing each online gap is worth in dollars, at your own numbers. Run the Traffic Audit first so it knows which channels you already have.',
        steps: [
          { title: 'Run the Traffic Audit', desc: 'It reads your screenshots and flags whether you have online ordering and reservations set up.', btn: 'Open Traffic Audit', screen: 't-audit', done: false },
          { title: 'Confirm a week', desc: 'Log your rating, reviews, visits, orders, and reservations. A week of numbers is all the Forecast needs.', btn: 'Open This Week', screen: 't-this-week', done: false }
        ]
      });
      container.onclick = ev => { const go = ev.target.closest('.setup-go'); if (go && go.dataset.go) App.openScreen(go.dataset.go); };
      return;
    }

    const ch = this.channels(w, this.profile());
    const oppLow = ch.reduce((s, c) => s + (c.oppLow || 0), 0);
    const oppHigh = ch.reduce((s, c) => s + (c.oppHigh || 0), 0);
    const working = ch.filter(c => c.status === 'working').length;
    const lever = ch.slice().filter(c => c.oppHigh > 0).sort((a, b) => b.oppHigh - a.oppHigh)[0];

    // ── Stat strip ──
    const stat = (label, val, style, sub) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (style || '') + '>' + val + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    const oppStr = this.rangeLabel(oppLow, oppHigh) || '$0';
    const statStrip = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Opportunity On The Table', oppStr, ' style="color:var(--gold);"', 'a year, estimated')
      + stat('Channels Working', working + ' of 4')
      + stat('Start Here', lever ? lever.title : 'All pulling their weight')
      + '</div></div>';

    // ── Channel board (data-card) ──
    const statusText = c => {
      if (c.status === 'opportunity') return '<span style="color:var(--gold);font-weight:700;">Below target</span>';
      if (c.status === 'dark')        return '<span style="color:var(--amber);font-weight:700;">Not set up</span>';
      if (c.status === 'working')     return '<span style="color:var(--green);font-weight:700;">Working</span>';
      return '<span style="color:var(--t3);">No data</span>';
    };
    const oppCell = c => {
      const r = this.rangeLabel(c.oppLow, c.oppHigh);
      if (!r) return '<span style="color:var(--t3);">' + (c.status === 'working' ? 'Pulling its weight' : '-') + '</span>';
      return '<span style="color:var(--gold);font-weight:700;">' + r + '</span>'
        + '<div style="margin-top:5px;"><button class="btn btn-ghost btn-sm tf-fix" data-gap="' + esc(c.id) + '">Work on it &rarr;</button></div>';
    };
    const rows = ch.map(c =>
      '<tr>'
      + '<td><div class="val">' + esc(c.title) + '</div><div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:3px;">' + esc(c.note) + '</div></td>'
      + '<td><div>' + esc(c.stand) + '</div><div style="font-size:11px;margin-top:2px;">' + statusText(c) + '</div></td>'
      + '<td>' + (c.worth != null ? this.money(c.worth) + '<span style="color:var(--t3);font-size:11px;"> /yr</span>' : '<span style="color:var(--t3);">-</span>') + '</td>'
      + '<td>' + oppCell(c) + '</td>'
      + '</tr>'
    ).join('');
    const board = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Online Opportunity</div>'
      + '<button class="btn btn-ghost btn-sm" id="tf-export">Export PDF</button></div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl" style="table-layout:fixed;width:100%;min-width:560px;">'
      + '<colgroup><col style="width:34%"/><col style="width:24%"/><col style="width:18%"/><col style="width:24%"/></colgroup>'
      + '<thead><tr><th>Channel</th><th>Where You Stand</th><th>Worth / Yr</th><th>Opportunity / Yr</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div></div>';

    // ── Heads Up: the honest basis + overlap caveat + not-a-guarantee ──
    const cap = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Every figure is built from your own numbers: your visits, your check average, your order value, and the conversion rates Bar Cop discloses (adjust them in Settings). A channel that is dark is valued off a slice of your existing visits, the softest estimate here. Channels can overlap, so read the total as a combined estimate to prioritize against, not an exact sum. These are ranges to plan against in whole dollars, not a guarantee.</div>'
      + '</div>';

    container.innerHTML = '<div class="screen">' + statStrip + board + cap + '</div>';
    container.querySelectorAll('.tf-fix').forEach(b =>
      b.addEventListener('click', () => { App._fixFocus = b.dataset.gap; App.navigate('t-fix'); }));
    document.getElementById('tf-export')?.addEventListener('click', () => App.exportPDF({ title: 'Traffic Forecast', root: container }));
  },

  showHowTo() {
    App.showHelpModal('How Traffic Forecast Works', [
      { p: ['A look ahead at the dollars in your online channel. Not a prediction of your Google rating or your visits, but what closing each open online gap is worth, at your own numbers.'] },
      { h: 'The Board', p: ['Opportunity On The Table up top is the yearly range across every online channel. Below it, each channel shows where you stand, what it is worth a year now, and the opportunity range, with Work on it to open it in Fix. Start Here names your single biggest lever.'] },
      { h: 'How the Numbers Are Figured', p: ['Bar Cop takes your latest weekly numbers and turns each channel into dollars: visits at your check average, orders at your average order value, reservations at your check average, email at your list and open rate. The conversion rates it uses are disclosed and adjustable in Settings. Everything is annual, since online-presence work builds over a year, not a week.'] },
      { h: 'Two Kinds of Opportunity', p: ['A channel you already have that is below target shows what reaching target is worth. A channel you do not have yet, like online ordering or reservations, shows what standing it up is worth, valued off a slice of the visits you already get. A channel that is on and at target shows what it is worth now, with no invented gap.'] },
      { h: 'Where the Channels Come From', p: ['The Traffic Audit reads your site and flags whether you take online orders and reservations. This Week tracks the counts once you have them. Start Here points at your biggest lever; Work on it opens that channel in Traffic Fix.'] },
      { h: 'Honesty', p: ['Always a range, always an estimate, never a guarantee. Channels can overlap, so the total is a combined estimate to prioritize against, not an exact sum. It is a planning tool, not financial advice.'] }
    ]);
  }
};
