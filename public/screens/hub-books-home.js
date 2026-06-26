'use strict';

/* ── Books home — "Close Out Your Books" landing ─────────────────────────────
   The Books section landing, opened from the top-nav "Books" link. Mirrors the
   Control/Cash "Close The Week" pattern: a Where You Stand card (the headline
   P&L number on top, a secondary read below), the monthly Close Out Your Books
   step checklist (expandable steps + green progress bar), and an As Needed row.
   Monthly close, no week selector. Numbers roll up from the same S.HubBooks
   aggregators the Month-End file is built from, so they always agree; the work
   happens on the screens the steps link to. */

S.HubBooksHome = {

  _openStep: null,

  open() {
    App.openHubFullPage('Books', (mount) => { this.container = mount; this.render(mount); }, 'books-home');
  },

  _money(v)  { return (v == null || isNaN(v)) ? '-' : App.fmtCurrency(Number(v)); },
  _pct(v)    { return (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%'; },
  _dateLbl(iso) { try { const d = new Date(iso); return isNaN(d) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return null; } },
  _lastRun(key) { try { const v = localStorage.getItem(key); return v ? this._dateLbl(v) : null; } catch (e) { return null; } },

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

  ORDER: ['expenses', 'pnl', 'review', 'generate'],
  _META: {
    expenses: { n: 1, title: 'Log this month\'s operating expenses', act: 'operating-expenses' },
    pnl:      { n: 2, title: 'Generate your weekly P&L brief',        act: 'weekly-pnl' },
    review:   { n: 3, title: 'Review your income statement',          act: 'books' },
    generate: { n: 4, title: 'Generate Month-End Books',              act: 'books' }
  },
  stepDone() { const dm = this.doneMap(); const r = {}; this.ORDER.forEach(k => { r[k] = !!dm[k]; }); return r; },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.container = mount;

    const st = this._computeState();
    const gs = this.getStartedDone();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';

    mount.innerHTML = '<div class="screen">'
      + (gs.all ? this.whereYouStand(st) : this.getStartedBox(gs))
      + this.banner(doneCount, this.ORDER.length)
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done, st)).join('')
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
    return { curKey, monthName, cmRev, cmPrimePct, mInc, ytdInc, ytdNet, ytdMargin, dueCount, expiredCt };
  },

  // ── Where You Stand (hero + secondary, Cash-style) ──────────────────────────
  whereYouStand(st) {
    const incCol = st.ytdInc < 0 ? 'var(--red)' : 'var(--w)';
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

  // ── Close Out Your Books banner (Cash card pattern, no week selector) ────────
  banner(dc, total) {
    const allDone = dc === total;
    const pct = total ? Math.round(dc / total * 100) : 0;
    const doneLine = allDone
      ? '<span style="color:var(--green);font-weight:700;">&#10003; Your books are caught up</span>'
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + dc + '</span> of ' + total + ' done this month</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div style="padding:11px 22px;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Close Out Your Books</div>'
      + '</div>'
      + '<div style="padding:18px 22px;">'
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
      +     '<div style="flex:1;min-width:160px;height:6px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      +     '<div style="font-size:12px;">' + doneLine + '</div>'
      +   '</div>'
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">A monthly pass: log your bills, check the numbers, and send the books to your accountant.</div>')
      + '</div>'
      + '</div>';
  },

  // ── Expandable step (Cash stepRow pattern) ──────────────────────────────────
  stepRow(k, done, st) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="bk-step-head" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, st) + '</div></div>'
      +   '<span style="color:var(--t3);font-size:13px;flex-shrink:0;">' + (isOpen ? '&#9652;' : '&#9662;') + '</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k, isDone) + '</div>';
    return html + '</div>';
  },

  stepStatus(k, st) {
    if (k === 'expenses') {
      const n = ((App.data && App.data.operating_expenses) || []).filter(r => r && r.date && String(r.date).slice(0, 7) === st.curKey).length;
      return n ? n + ' bill' + (n === 1 ? '' : 's') + ' logged this month' : 'No bills logged yet this month';
    }
    if (k === 'pnl')      { const d = this._lastRun('books_report_run_weeklypnl'); return d ? 'Report last run ' + d : 'Not run yet'; }
    if (k === 'review')   { return esc(st.monthName) + ' operating income ' + this._money(st.mInc); }
    if (k === 'generate') { const d = this._lastRun('books_report_run_monthend'); return d ? 'Report last run ' + d : 'Not run yet'; }
    return '';
  },

  workspace(k, isDone) {
    const explain = (txt) => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const markBtn = isDone
      ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
      : '<button class="btn btn-primary btn-sm" data-done="' + k + '">Mark Done</button>';
    const M = {
      expenses: ['Your recurring bills auto-fill each month. Add this month\'s variable ones so your operating income is complete.', '<button class="btn btn-ghost btn-sm" data-act="operating-expenses">Operating Expenses</button>'],
      pnl:      ['A one-page profit and loss for any week range, the brief you keep for yourself or hand to your bookkeeper.', '<button class="btn btn-ghost btn-sm" data-act="weekly-pnl">Weekly P&amp;L Brief</button>'],
      review:   ['Open the income statement and make sure revenue, costs, and operating income read right before anything goes out.', '<button class="btn btn-ghost btn-sm" data-act="books">Income Statement</button>'],
      generate: ['Build the full workbook and one-page summary for your accountant. Nothing to re-type, it pulls from everything you logged.', '<button class="btn btn-ghost btn-sm" data-act="books">Month-End Books</button>']
    };
    const cfg = M[k];
    return explain(cfg[0]) + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + cfg[1] + markBtn + '</div>';
  },

  asNeeded(st) {
    const dueLabel = st.dueCount ? 'Permits &amp; Renewals (' + st.dueCount + ' due)' : 'Permits &amp; Renewals';
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="permits">' + dueLabel + '</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="year-end">Annual Review</button>'
      + '</div>';
  },

  // ── Day one: four-step Get Started box (Cash Close The Week pattern). Each step
  // reads done off real data; once all four are done the Where You Stand card
  // takes its place. The Close Out Your Books steps and As Needed never change.
  getStartedDone() {
    const has = (a) => Array.isArray(a) && a.length > 0;
    const hasWeeks   = has(App.data && App.data.weeks);
    const hasOpex    = has(App.data && App.data.operating_expenses);
    const hasInv     = has(App.inventoryData && App.inventoryData.ic_products);
    const hasPermits = has(App.data && App.data.permits_compliance);
    return { hasWeeks, hasOpex, hasInv, hasPermits, all: hasWeeks && hasOpex && hasInv && hasPermits };
  },
  getStartedBox(d) {
    return DashUI.dayOneStrip(
      'Your books build themselves from what you log. Four steps and this card fills in with your operating income, month to date and year to date.',
      [
        { done: d.hasWeeks,   num: 1, label: 'Log your first week',             go: 'this-week' },
        { done: d.hasOpex,    num: 2, label: 'Add your operating expenses',     go: 'operating-expenses' },
        { done: d.hasInv,     num: 3, label: 'Set up Inventory Control',        go: 'ic-dashboard' },
        { done: d.hasPermits, num: 4, label: 'Enter your permits and licenses', go: 'permits' }
      ]);
  },

  _wire() {
    const go = (act) => {
      if (act === 'books')                   S.HubBooks?.open?.();
      else if (act === 'weekly-pnl')         S.Reports?._openQboModal?.();
      else if (act === 'year-end')           S.HubYearEnd?.open?.();
      else if (act === 'operating-expenses') S.HubOperatingExpenses?.open?.();
      else if (act === 'permits')            S.HubPermits?.open?.();
      else if (act === 'this-week')          App.openScreen('this-week');
      else if (act === 'ic-dashboard')       App.openScreen('ic-dashboard');
    };
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
    this.container.querySelectorAll('.db-go').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));
    this.container.querySelectorAll('.bk-step-head').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container);
    }));
    this.container.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.done, true); this._openStep = null; this.render(this.container); }));
    this.container.querySelectorAll('[data-undone]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.undone, false); this.render(this.container); }));
  }

};
