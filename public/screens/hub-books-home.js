'use strict';

/* ── Books home — "Close The Books" landing ──────────────────────────────────
   The Books section landing, opened from the top-nav "Books" link. Mirrors the
   Control/Cash "Close The Week" pattern: a Where You Stand card (the headline
   P&L number on top, a secondary read below), the monthly Close The Books step
   checklist with a green progress bar, and an As Needed row. Cadence is monthly,
   not weekly. Numbers roll up from the same S.HubBooks aggregators the Month-End
   file is built from, so they always agree; the work happens on the screens the
   steps link to. */

S.HubBooksHome = {

  open() {
    App.openHubFullPage('Books', (mount) => { this.container = mount; this.render(mount); }, 'books-home');
  },

  _money(v)  { return (v == null || isNaN(v)) ? '-' : App.fmtCurrency(Number(v)); },
  _pct(v)    { return (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%'; },

  // ── Per-month "done" stamps (operator-controlled, local to the device) ──────
  _curKey() {
    const HB = S.HubBooks;
    if (HB && HB._currentMonthKey) return HB._currentMonthKey();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },
  _doneKey() { return 'books_close_done_' + this._curKey(); },
  doneMap()  { try { return JSON.parse(localStorage.getItem(this._doneKey()) || '{}'); } catch (e) { return {}; } },
  setDone(step, val) { const m = this.doneMap(); m[step] = val; try { localStorage.setItem(this._doneKey(), JSON.stringify(m)); } catch (e) {} },

  ORDER: ['expenses', 'review', 'generate'],
  _META: {
    expenses: { n: 1, title: 'Log this month\'s operating expenses', sub: 'Your recurring bills auto-fill, add the variable ones', act: 'operating-expenses' },
    review:   { n: 2, title: 'Review your income statement',         sub: 'Check the month reads right before it goes out',    act: 'books' },
    generate: { n: 3, title: 'Generate Month-End Books',             sub: 'The workbook and summary for your accountant',       act: 'books' }
  },
  stepDone() { const dm = this.doneMap(); const r = {}; this.ORDER.forEach(k => { r[k] = !!dm[k]; }); return r; },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.container = mount;
    const weeks = (App.data && App.data.weeks) || [];
    if (!weeks.length) { mount.innerHTML = '<div class="screen">' + this._getStarted() + '</div>'; this._wire(); return; }

    const st = this._computeState();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;

    mount.innerHTML = '<div class="screen">'
      + this.whereYouStand(st)
      + this.banner(doneCount, this.ORDER.length)
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.asNeeded(st)
      + '</div>';
    this._wire();
  },

  // ── Heavy compute, once per render ──────────────────────────────────────────
  _computeState() {
    const HB = S.HubBooks;
    const curKey = this._curKey();
    const curM   = (HB && HB._aggregateMonth) ? HB._aggregateMonth(curKey) : null;
    const monthName = (HB && HB._monthLabel) ? HB._monthLabel(curKey) : curKey;
    const YTD    = (HB && HB._aggregateYTD)  ? HB._aggregateYTD(curKey) : null;

    const cmRev   = curM ? (curM.totalRev - (curM.compsLoss || 0)) : 0;
    const cmCogs  = curM ? curM.totalCogs : 0;
    const cmLabor = curM ? curM.totalLabor : 0;
    const cmPrimePct = cmRev ? (cmCogs + cmLabor) / cmRev : null;
    const opexM = (HB && HB._opExSums) ? HB._opExSums(curKey, false) : {};
    const totalOpExM = Object.values(opexM).reduce((s, v) => s + (v || 0), 0)
      + ((curM && curM.maintenance) || 0) + ((curM && curM.platformFees) || 0) + ((curM && curM.compsPolicy) || 0);
    const mInc = cmRev - cmCogs - cmLabor - totalOpExM;

    const ytdNet = YTD ? (YTD.totalRev - (YTD.compsLoss || 0)) : 0;
    const opexY = (HB && HB._opExSums) ? HB._opExSums(curKey, true) : {};
    const totalOpExY = Object.values(opexY).reduce((s, v) => s + (v || 0), 0)
      + ((YTD && YTD.maintenance) || 0) + ((YTD && YTD.platformFees) || 0) + ((YTD && YTD.compsPolicy) || 0);
    const ytdInc = ytdNet - (YTD ? YTD.totalCogs : 0) - (YTD ? YTD.totalLabor : 0) - totalOpExY;
    const ytdMargin = ytdNet ? ytdInc / ytdNet : null;

    const HP = S.HubPermits;
    const permits = (App.data && App.data.permits_compliance) || [];
    let dueCount = 0, expiredCt = 0;
    if (HP && HP._status) {
      permits.forEach(r => { const s = HP._status(r); if (s.key === 'expired' || s.key === 'critical' || s.key === 'warn') { dueCount++; if (s.key === 'expired') expiredCt++; } });
    }
    return { monthName, cmRev, cmPrimePct, mInc, ytdInc, ytdNet, ytdMargin, dueCount, expiredCt };
  },

  // ── Where You Stand (hero + secondary, Cash-style) ──────────────────────────
  whereYouStand(st) {
    const incCol = st.ytdInc < 0 ? 'var(--red)' : 'var(--t1)';
    const hero = '<div style="padding:2px 0;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:' + incCol + ';">' + this._money(st.ytdInc) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">operating income, year to date</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">Through ' + esc(st.monthName) + (st.ytdMargin != null ? ' &middot; ' + this._pct(st.ytdMargin) + ' operating margin' : '') + '</div></div>';

    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + esc(st.monthName) + ' So Far</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Revenue', this._money(st.cmRev)) + vdiv
      +   mini('Prime Cost', this._pct(st.cmPrimePct)) + vdiv
      +   mini('Operating Income', this._money(st.mInc), st.mInc < 0 ? 'var(--red)' : 'var(--t1)')
      + '</div>'
      + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-act="books">Income Statement</button></div></div>';

    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Where You Stand</div>'
      + hero + secondary + '</div>';
  },

  banner(dc, total) {
    const pct = total ? Math.round(dc / total * 100) : 0;
    return '<div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">'
      +   '<div class="sh" style="margin:0;">Close The Books</div>'
      +   '<div style="font-size:11px;color:var(--t3);">' + dc + ' of ' + total + ' done</div>'
      + '</div>'
      + '<div style="height:5px;background:var(--bg);border:1px solid var(--b-edge);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      + '</div>';
  },

  stepRow(k, done) {
    const m = this._META[k], isDone = done[k];
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;">' + m.n + '</span>';
    return '<div style="display:flex;align-items:center;gap:13px;padding:14px 16px;border:1px solid var(--b-edge);border-radius:var(--r);background:' + (isDone ? 'var(--input)' : 'var(--surface)') + ';flex-wrap:wrap;">'
      + circle
      + '<div style="flex:1;min-width:160px;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +   '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + m.sub + '</div></div>'
      + '<button class="btn btn-ghost btn-sm" data-act="' + m.act + '">Open</button>'
      + (isDone
          ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
          : '<button class="btn btn-primary btn-sm" data-done="' + k + '">Mark Done</button>')
      + '</div>';
  },

  asNeeded(st) {
    const dueLabel = st.dueCount ? 'Permits &amp; Renewals (' + st.dueCount + ' due)' : 'Permits &amp; Renewals';
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="permits">' + dueLabel + '</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="weekly-pnl">Weekly P&amp;L Brief</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="year-end">Annual Review</button>'
      + '</div>';
  },

  // ── Day one (no weeks logged): guided steps, books fill in as data lands ──
  _getStarted() {
    const step = (n, title, body, btn, act) => '<div style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--gold-tint);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">' + n + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + title + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:8px;">' + body + '</div>'
      + (btn ? '<button class="btn btn-ghost btn-sm" data-act="' + act + '">' + btn + '</button>' : '') + '</div></div>';
    return '<div class="card form-card"><div class="card-title">Get Started</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:10px;">Your books fill in from what you log across Bar Cop. Nothing to re-enter here. A few steps and the income statement builds itself.</div>'
      + step(1, 'Log a week', 'Enter a week in Profit, This Week. Revenue, COGS, and labor roll up into your income statement.', 'Go to This Week', 'this-week')
      + step(2, 'Add your fixed bills', 'Rent, utilities, insurance, and the rest go in Operating Expenses so your operating income is complete.', 'Operating Expenses', 'operating-expenses')
      + step(3, 'Enter your permits and licenses', 'Renewal dates show up under As Needed before they lapse.', 'Permits and Licenses', 'permits')
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
    this.container.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.done, true); this.render(this.container); }));
    this.container.querySelectorAll('[data-undone]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.undone, false); this.render(this.container); }));
  }

};
