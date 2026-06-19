'use strict';

/* ── Books home — the Books section landing / back-office overview ───────────
   The Books section's dashboard, opened from the top-nav "Books" link with the
   Books sidebar (Accounting + Operations + Support). Read-only overview: it
   rolls up the same monthly numbers the Month-End Books file is built from
   (via the S.HubBooks aggregators, so the figures always agree) and surfaces
   what is coming due from Permits and Licenses. The real work happens on the
   screens it links to. */

S.HubBooksHome = {

  open() {
    App.openHubFullPage('Books', (mount) => { this.container = mount; this.render(mount); }, 'books-home');
  },

  _money(v)  { return (v == null || isNaN(v)) ? '-' : App.fmtCurrency(Number(v)); },
  _pct(v)    { return (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%'; },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    const weeks = (App.data && App.data.weeks) || [];

    const head = '<div style="margin-bottom:20px;">'
      + '<div style="font-size:22px;font-weight:800;color:var(--w);letter-spacing:0.3px;">Books</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:3px;">Your back office. The month your accountant needs, plus what is coming due.</div>'
      + '</div>';

    if (!weeks.length) {
      mount.innerHTML = '<div class="screen">' + head + this._dayOne() + '</div>';
      this._wire();
      return;
    }

    const HB = S.HubBooks;
    const months   = (HB && HB._availableMonths) ? HB._availableMonths() : [];
    const monthKey = months[0] || (HB && HB._currentMonthKey ? HB._currentMonthKey() : '');
    const M        = (HB && HB._aggregateMonth) ? HB._aggregateMonth(monthKey) : null;
    const YTD      = (HB && HB._aggregateYTD)   ? HB._aggregateYTD(monthKey)   : null;
    const monthName = (HB && HB._monthLabel) ? HB._monthLabel(monthKey) : monthKey;

    const netRev   = M ? (M.totalRev - (M.compsLoss || 0)) : 0;
    const cogs     = M ? M.totalCogs : 0;
    const labor    = M ? M.totalLabor : 0;
    const prime    = cogs + labor;
    const primePct = (M && M.totalRev) ? (prime / M.totalRev) : null;
    const gross    = netRev - cogs;
    const ytdNet   = YTD ? (YTD.totalRev - (YTD.compsLoss || 0)) : 0;

    // Permits / licenses coming due (overdue or within 30 days), soonest first.
    const HP = S.HubPermits;
    const permits = (App.data && App.data.permits_compliance) || [];
    const due = [];
    if (HP && HP._status) {
      permits.forEach(r => {
        const s = HP._status(r);
        if (s.key === 'expired' || s.key === 'critical' || s.key === 'warn') due.push({ r, s });
      });
      due.sort((a, b) => (a.s.days == null ? 9999 : a.s.days) - (b.s.days == null ? 9999 : b.s.days));
    }
    const dueCount = due.length;

    // ── KPI tiles ──
    const tiles = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:18px;">'
      + this._tile(monthName + ' Revenue', this._money(netRev), 'Net of comps')
      + this._tile('Prime Cost', this._pct(primePct), 'COGS plus labor')
      + this._tile('Year to Date Revenue', this._money(ytdNet), 'Through ' + monthName)
      + this._tile('Renewals Due', String(dueCount), dueCount ? 'Overdue or within 30 days' : 'Nothing due soon', dueCount ? 'var(--amber)' : null)
      + '</div>';

    // ── Hero band — the latest month's mini P&L + accountant CTA ──
    const fig = (label, val) => '<div style="flex:1;min-width:110px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t1);line-height:1;">' + val + '</div></div>';
    const hero = '<div class="card form-card" style="margin-bottom:22px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:16px;">'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">' + esc(monthName) + '</div>'
      +   '<div style="font-size:14px;color:var(--t2);margin-top:4px;">Your latest month, rolled up from what you logged.</div></div>'
      +   '<button class="btn btn-primary" data-act="books">Books for Your Accountant</button>'
      + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:16px 18px;">'
      +   fig('Revenue', this._money(netRev)) + fig('COGS', this._money(cogs)) + fig('Labor', this._money(labor))
      +   fig('Prime Cost', this._money(prime)) + fig('Gross Profit', this._money(gross))
      + '</div></div>';

    // ── Recent months ──
    const monthRows = months.slice(0, 6).map(mk => {
      const mm = HB._aggregateMonth(mk);
      const nr = mm.totalRev - (mm.compsLoss || 0);
      const pp = mm.totalRev ? ((mm.totalCogs + mm.totalLabor) / mm.totalRev) : null;
      return '<div class="bk-row" data-act="books" style="display:flex;align-items:center;gap:14px;padding:12px 15px;border-bottom:1px solid var(--b2);cursor:pointer;">'
        + '<div style="flex:1;font-size:13px;font-weight:600;color:var(--t1);">' + esc(HB._monthLabel(mk)) + '</div>'
        + '<div style="font-size:13px;color:var(--t2);width:96px;text-align:right;">' + this._money(nr) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);width:92px;text-align:right;">' + this._pct(pp) + ' prime</div>'
        + '<span class="btn btn-ghost btn-sm">Open</span></div>';
    }).join('');
    const monthsPanel = '<div style="display:flex;flex-direction:column;">'
      + '<div class="sh" style="margin:0 0 8px;">Recent Months</div>'
      + '<div class="card" style="padding:0;flex:1;">' + (monthRows || '<div style="padding:16px;font-size:12px;color:var(--t3);">No months yet.</div>') + '</div></div>';

    // ── Coming due ──
    let dueBody;
    if (!dueCount) {
      dueBody = '<div style="padding:16px 15px;font-size:12px;color:var(--t3);line-height:1.6;">Nothing due in the next 30 days. Renewal dates you enter in Permits and Licenses show up here as they approach.</div>';
    } else {
      dueBody = due.slice(0, 6).map(({ r, s }) => '<div class="bk-row" data-act="permits" style="display:flex;align-items:center;gap:14px;padding:12px 15px;border-bottom:1px solid var(--b2);cursor:pointer;">'
        + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(r.name || '(unnamed)') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (HP._fmtDate ? HP._fmtDate(r.renewal_date) : esc(r.renewal_date || '')) + '</div></div>'
        + '<div style="font-size:11px;font-weight:700;color:' + s.color + ';white-space:nowrap;">' + esc(s.label) + '</div></div>').join('');
    }
    const duePanel = '<div style="display:flex;flex-direction:column;">'
      + '<div class="sh" style="margin:0 0 8px;">Coming Due</div>'
      + '<div class="card" style="padding:0;flex:1;">' + dueBody + '</div></div>';

    const panelRow = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:stretch;margin-bottom:22px;">'
      + monthsPanel + duePanel + '</div>';

    // ── Quick actions ──
    const qa = (act, label) => '<button class="btn btn-ghost" data-act="' + act + '">' + label + '</button>';
    const quick = '<div class="sh" style="margin:0 0 8px;">Quick Actions</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:10px;">'
      +   qa('books', 'Month-End Books') + qa('weekly-pnl', 'Weekly P&amp;L Brief') + qa('year-end', 'Year-End Review')
      +   qa('operating-expenses', 'Operating Expenses') + qa('permits', 'Permits and Licenses')
      + '</div>';

    mount.innerHTML = '<div class="screen">' + head + tiles + hero + panelRow + quick + '</div>';
    this._wire();
  },

  _tile(label, val, sub, color) {
    return '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:16px 18px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">' + esc(label) + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:700;color:' + (color || 'var(--w)') + ';line-height:1;">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:5px;">' + esc(sub) + '</div></div>';
  },

  _dayOne() {
    const step = (n, title, body, btn, act) => '<div style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--gold-tint);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">' + n + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + title + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:8px;">' + body + '</div>'
      + (btn ? '<button class="btn btn-ghost btn-sm" data-act="' + act + '">' + btn + '</button>' : '') + '</div></div>';
    return '<div class="card">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Get Started</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:10px;">Your books fill in from what you log across Bar Cop. Nothing to re-enter here.</div>'
      + step(1, 'Log a week', 'Enter a week in Profit, This Week. Revenue, COGS, and labor roll up into your income statement.', 'Go to This Week', 'this-week')
      + step(2, 'Add your fixed bills', 'Rent, utilities, insurance, and the rest go in Operating Expenses so your operating income is complete.', 'Operating Expenses', 'operating-expenses')
      + step(3, 'Enter your permits and licenses', 'Renewal dates show up under Coming Due before they lapse.', 'Permits and Licenses', 'permits')
      + '</div>';
  },

  _wire() {
    const go = (act) => {
      if (act === 'books')                   S.HubBooks?.open?.();
      else if (act === 'weekly-pnl')         S.Reports?._openQboModal?.();
      else if (act === 'year-end')           S.HubYearEnd?.open?.();
      else if (act === 'operating-expenses') S.HubOperatingExpenses?.open?.();
      else if (act === 'permits')            S.HubPermits?.open?.();
      else if (act === 'this-week')          App.openScreen('this-week');
    };
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
  }

};
