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

    if (!weeks.length) {
      mount.innerHTML = '<div class="screen">' + this._dayOne() + '</div>';
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

    // Hero card = the CURRENT calendar month, month-to-date, so it advances on
    // its own as the months roll (no frozen month name). Filled by whatever
    // weeks have been logged in the current month; empty early in a new month.
    const curKey = (HB && HB._currentMonthKey) ? HB._currentMonthKey() : monthKey;
    const curM   = (HB && HB._aggregateMonth)  ? HB._aggregateMonth(curKey) : M;
    const cmRev   = curM ? (curM.totalRev - (curM.compsLoss || 0)) : 0;
    const cmCogs  = curM ? curM.totalCogs : 0;
    const cmLabor = curM ? curM.totalLabor : 0;
    const cmPrime = cmCogs + cmLabor;
    const cmGross = cmRev - cmCogs;

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

    // ── KPI tiles (standard metric grid) ──
    const tiles = '<div class="metric-grid">'
      + this._metric(monthName + ' Revenue', this._money(netRev), 'Net of comps')
      + this._metric('Prime Cost', this._pct(primePct), 'COGS plus labor')
      + this._metric('Year to Date Revenue', this._money(ytdNet), 'Through ' + monthName)
      + this._metric('Renewals Due', String(dueCount), dueCount ? 'Overdue or within 30 days' : 'Nothing due soon', dueCount ? 'over-target' : '')
      + '</div>';

    // ── Hero band — the current month's mini P&L + accountant CTA ──
    const fig = (label, val) => '<div style="flex:1;min-width:110px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t1);line-height:1;">' + val + '</div></div>';
    const hero = '<div class="card form-card" style="margin-bottom:22px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      +   '<span>Current Month</span>'
      +   '<button class="btn btn-ghost btn-sm" data-act="books">Books for Accountant</button>'
      + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;background:var(--input);border:1px solid var(--b2);border-radius:6px;padding:16px 18px;">'
      +   fig('Revenue', this._money(cmRev)) + fig('COGS', this._money(cmCogs)) + fig('Labor', this._money(cmLabor))
      +   fig('Prime Cost', this._money(cmPrime)) + fig('Gross Profit', this._money(cmGross))
      + '</div></div>';

    // ── Recent months ──
    const monthRows = months.slice(0, 6).map(mk => {
      const mm = HB._aggregateMonth(mk);
      const nr = mm.totalRev - (mm.compsLoss || 0);
      const pp = mm.totalRev ? ((mm.totalCogs + mm.totalLabor) / mm.totalRev) : null;
      return '<div style="display:flex;align-items:center;gap:14px;padding:12px 15px;border-bottom:1px solid var(--b2);">'
        + '<div style="flex:1;font-size:13px;font-weight:600;color:var(--t1);">' + esc(HB._monthLabel(mk)) + '</div>'
        + '<div style="font-size:13px;color:var(--t2);width:96px;text-align:right;">' + this._money(nr) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);width:92px;text-align:right;">' + this._pct(pp) + ' prime</div></div>';
    }).join('');
    const monthsPanel = '<div style="display:flex;flex-direction:column;">'
      + '<div class="sh" style="margin:0 0 8px;">Recent Months</div>'
      + '<div class="card" style="padding:0;flex:1;">' + (monthRows || '<div style="padding:16px;font-size:12px;color:var(--t3);">No months yet.</div>') + '</div></div>';

    // ── Right panel: Coming Due when a renewal is near, otherwise Year to Date.
    //    Renewals only fill this box inside 30 days, so the rest of the year it
    //    carries the year-so-far bottom line instead of sitting empty. ──
    let rightTitle, rightBody;
    if (dueCount) {
      rightTitle = 'Coming Due';
      rightBody = due.slice(0, 6).map(({ r, s }) => '<div class="bk-row" data-act="permits" style="display:flex;align-items:center;gap:14px;padding:12px 15px;border-bottom:1px solid var(--b2);cursor:pointer;">'
        + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(r.name || '(unnamed)') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (HP._fmtDate ? HP._fmtDate(r.renewal_date) : esc(r.renewal_date || '')) + '</div></div>'
        + '<div style="font-size:11px;font-weight:700;color:' + s.color + ';white-space:nowrap;">' + esc(s.label) + '</div></div>').join('');
    } else {
      rightTitle = 'Year to Date';
      const opexY = (HB && HB._opExSums) ? HB._opExSums(monthKey, true) : {};
      const totalOpExY = Object.values(opexY).reduce((s, v) => s + (v || 0), 0)
        + ((YTD && YTD.maintenance) || 0) + ((YTD && YTD.platformFees) || 0) + ((YTD && YTD.compsPolicy) || 0);
      const cogsY  = YTD ? YTD.totalCogs  : 0;
      const laborY = YTD ? YTD.totalLabor : 0;
      const opInc  = ytdNet - cogsY - laborY - totalOpExY;
      const yrow = (label, val, o) => { o = o || {};
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 15px;'
          + (o.top ? 'border-top:1px solid var(--b2);' : 'border-bottom:1px solid var(--b2);') + '">'
          + '<div style="font-size:13px;' + (o.strong ? 'font-weight:700;color:var(--t1);' : 'color:var(--t2);') + '">' + label + '</div>'
          + '<div style="font-size:13px;font-weight:' + (o.strong ? '700' : '600') + ';color:' + (o.color || 'var(--t1)') + ';">' + val + '</div></div>';
      };
      rightBody = yrow('Revenue', this._money(ytdNet))
        + yrow('COGS', this._money(cogsY))
        + yrow('Labor', this._money(laborY))
        + yrow('Operating Expenses', this._money(totalOpExY))
        + yrow('Operating Income', this._money(opInc), { top: true, strong: true, color: (opInc < 0 ? 'var(--red)' : 'var(--t1)') });
    }
    const duePanel = '<div style="display:flex;flex-direction:column;">'
      + '<div class="sh" style="margin:0 0 8px;">' + rightTitle + '</div>'
      + '<div class="card" style="padding:0;flex:1;">' + rightBody + '</div></div>';

    const panelRow = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:stretch;margin-bottom:22px;">'
      + monthsPanel + duePanel + '</div>';

    // ── Quick actions ──
    const qa = (act, label) => '<button class="btn btn-primary" data-act="' + act + '" style="flex:1;min-width:150px;">' + label + '</button>';
    const quick = '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;flex-wrap:wrap;gap:10px;">'
      +   qa('books', 'Month-End Books') + qa('weekly-pnl', 'Weekly P&amp;L Brief') + qa('year-end', 'Year-End Review')
      +   qa('operating-expenses', 'Operating Expenses')
      + '</div></div>';

    mount.innerHTML = '<div class="screen">' + tiles + hero + panelRow + quick + '</div>';
    this._wire();
  },

  _metric(label, val, target, cls) {
    return '<div class="metric-card"><div class="metric-label">' + esc(label) + '</div>'
      + '<div class="metric-val' + (cls ? ' ' + cls : '') + '">' + val + '</div>'
      + '<div class="metric-target">' + (target ? esc(target) : '&nbsp;') + '</div>'
      + '<div class="metric-trend">&nbsp;</div></div>';
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
