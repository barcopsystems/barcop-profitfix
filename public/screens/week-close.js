'use strict';

/* ── Close The Week — the ONE weekly close ────────────────────────────────────
   Replaces six section "Close The Week" cockpits with a single page that says what this week's
   numbers need, where each piece came from, and what is still missing. Then Confirm the Week.

   ⛔ WHY THE SIX ARE GOING, MEASURED. Across the eight cockpits there were 32 steps and 31 of them
   were MANUAL CHECKBOXES: every `stepDone()` read a stored `doneMap()` the operator ticked by hand.
   Exactly one derived itself from data (`r.week = !!this.savedWeek(...)`). And nothing downstream
   ever read a tick: the only writers outside the cockpits were the demo seeder. So 31 boxes moved
   progress bars and nothing else, while the same 32 were re-rendered three times over (the cockpit,
   the Hub card, the Week In Review payload).

   ⭐ THE RULE THIS PAGE IS BUILT ON: every line is DERIVED FROM DATA, never from a tick. A tick can
   say the sales are in when they are not; a record cannot. That is also why there is no Mark Done
   anywhere on this page.

   ⛔ AND IT NEVER TELLS AN OPERATOR THEIR CADENCE. `icCOGS` already refuses to price a week off a
   count pair that does not span it, because a monthly counter once had a whole month's usage booked
   onto one week and prime cost read about 4x. Plenty of bars count fortnightly or monthly by
   choice. So COGS reads either "from your counts" or "type it", and a count is never a chore here.

   STAGE 1: read-only. It reports and it confirms. The four intakes still live on the section
   cockpits, so this can be walked side by side with them before anything is deleted. */

S.WeekClose = {

  container: null,
  _weekEnd: null,

  open() {
    App.openHubFullPage('Close The Week', (mount) => { this.container = mount; this.render(mount); }, 'week-close');
  },

  /* ── The week ───────────────────────────────────────────────────────────────
     Mirrors the cockpits: the week ENDS on the coming Sunday, so the live week's end is in the
     future while it is still running. */
  weekEnd()   { return this._weekEnd || App.nextSunday(); },
  weekStart() { return App.weekStartFor(this.weekEnd()); },
  atCurrentWeek() { return this.weekEnd() === App.nextSunday(); },
  stepWeek(days) {
    const d = new Date(this.weekEnd() + 'T00:00:00');
    d.setDate(d.getDate() + days);
    this._weekEnd = App.ymdLocal(d);
    this.render(this.container);
  },
  inWeek(date) {
    if (!date) return false;
    const d = String(date).slice(0, 10);
    return d >= this.weekStart() && d <= this.weekEnd();
  },

  /* ── WHAT THE WEEK HAS, read off the real stores ────────────────────────────
     ⚠ Each of these answers "is it in", never "was it ticked". The store names are the ones the
     feeder screens actually write, checked against their own accessors rather than remembered. */
  state() {
    const S_ = App.shiftData || {}, L = App.laborData || {};
    const wk = (arr, key) => (arr || []).filter(r => this.inWeek(r && (r[key] || r.date)));
    const pe = this.weekEnd();

    const sales = wk(S_.sc_shifts, 'date');
    const hours = wk(L.lc_actuals, 'date');
    const tips  = wk(L.lc_tips, 'date');
    const cash  = wk(S_.sc_variances, 'date');

    // COGS: whatever icCOGS says, and it says null whenever a count pair does not span this week.
    const TW = S.ThisWeek;
    const barCogs  = (TW && TW.icCOGS) ? TW.icCOGS(App.BAR_CATS, pe) : null;
    const foodCogs = (TW && TW.icCOGS) ? TW.icCOGS(App.KITCHEN_CATS, pe) : null;
    const counts = ((App.inventoryData && App.inventoryData.ic_counts) || [])
      .map(c => String((c && (c.date || c.created_at)) || '').slice(0, 10)).filter(Boolean).sort();

    // Catering rides in from the Events bookings, not from a form on this page.
    const catering = ((App.data && App.data.bookings) || [])
      .filter(b => b && b.event_date && this.inWeek(b.event_date) && b.stage !== 'Lost');

    const confirmed = ((App.data && App.data.weeks) || [])
      .find(w => String(w.period_end || '').slice(0, 10) === pe) || null;

    /* ⚠ FIELD NAMES ARE READ OFF THE FEEDER SCREENS, NOT GUESSED. My first draft summed
       `net_sales`, `amount` and a hand-rolled tip total; none of the three exist. A wrong field
       name here does not throw, it renders every row as empty and the page quietly lies about the
       week. Sales are `total_revenue` (sc-dashboard sums exactly that), and tips go through
       `App.netTips` because gross minus tip-out is one rule and a second copy of it drifts. */
    return {
      pe, sales, hours, tips, cash, catering, confirmed,
      salesTotal: sales.reduce((t, r) => t + (App.parseNum(r.total_revenue) || 0), 0),
      hoursTotal: hours.reduce((t, r) => t + (App.parseNum(r.hours) || 0), 0),
      tipsTotal:  tips.reduce((t, r) => t + App.netTips(r), 0),
      cogs: { bar: barCogs, food: foodCogs, has: barCogs != null || foodCogs != null, lastCount: counts[counts.length - 1] || null }
    };
  },

  // No App.shortDate exists; the cockpits each carry their own. One local one, same format.
  _shortDate(ymd) {
    if (!ymd) return '';
    const d = new Date(String(ymd).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /* ── The rows. Four intakes, two derived reads, then the confirm. ───────────
     `ready` drives the count and the tick; `note` is what the operator reads. Nothing here is a
     task list: a row that says "type it" is describing where the number comes from, not a chore. */
  rows(st) {
    const money = v => App.fmtCurrency(v || 0);
    const cogsNote = st.cogs.has
      ? 'From your counts'
      : (st.cogs.lastCount ? 'Type it on the confirm. Last count ' + this._shortDate(st.cogs.lastCount) : 'Type it on the confirm');
    return [
      { key: 'sales', label: 'Sales', ready: st.sales.length > 0, go: 'sc-dashboard',
        note: st.sales.length ? st.sales.length + ' day' + (st.sales.length === 1 ? '' : 's') + ' in, ' + money(st.salesTotal) : 'Not in yet' },
      { key: 'hours', label: 'Hours', ready: st.hours.length > 0, go: 'lc-log-hours',
        note: st.hours.length ? st.hoursTotal.toFixed(1) + ' hours across ' + st.hours.length + ' row' + (st.hours.length === 1 ? '' : 's') : 'Not in yet' },
      { key: 'tips', label: 'Tips', ready: st.tips.length > 0, go: 'lc-tip-log', optional: true,
        note: st.tips.length ? money(st.tipsTotal) + ' logged' : 'None logged' },
      { key: 'cash', label: 'Cash over and short', ready: st.cash.length > 0, go: 'sc-cash-control', optional: true,
        note: st.cash.length ? st.cash.length + ' drawer count' + (st.cash.length === 1 ? '' : 's') : 'No drawer counted' },
      { key: 'cogs', label: 'Cost of goods', ready: st.cogs.has, go: 'ic-take-inventory', derived: true,
        note: cogsNote },
      { key: 'catering', label: 'Catering', ready: st.catering.length > 0, go: 'ev-bookings', optional: true, derived: true,
        note: st.catering.length ? st.catering.length + ' event' + (st.catering.length === 1 ? '' : 's') + ' this week' : 'No events this week' }
    ];
  },

  /* ── The week stepper. Same two-chip dash range every weekly page uses. ──── */
  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm wc-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm wc-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm wc-now" style="margin-left:4px;">This Week</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>';
  },

  /* ── The banner. Same card shell and .ck-head band as every cockpit. ─────── */
  banner(st, ready, total) {
    const pct = total ? Math.round(ready / total * 100) : 0;
    const line = st.confirmed
      ? '<span style="color:var(--green);font-weight:700;">&#10003; This week is confirmed</span>'
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + ready + '</span> of ' + total + ' in</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div class="ck-head">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Close Out Your Week</div>'
      + '</div>'
      + '<div style="padding:18px 22px;">'
      +   this.weekSelector()
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +     '<div style="flex:1;min-width:160px;height:6px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      +     '<div style="font-size:12px;">' + line + '</div>'
      +   '</div>'
      + '</div>'
      + '</div>';
  },

  /* One row per piece of the week. Ready reads green, missing reads neutral, and an optional piece
     never reads as a failure: plenty of bars run a week with no tips and no drawer count. */
  row(r) {
    const mark = r.ready
      ? '<span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:12px;font-weight:800;">&#10003;</span>'
      : '<span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;border:1px solid ' + (r.optional ? 'var(--b1)' : 'var(--gold)') + ';"></span>';
    const noteCol = r.ready ? 'var(--t2)' : (r.optional ? 'var(--t3)' : 'var(--t2)');
    const btn = r.ready ? '' : '<button class="btn btn-ghost btn-sm wc-go" data-go="' + esc(r.go) + '">Open</button>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:13px;padding:14px 16px;">'
      +   mark
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(r.label)
      +       (r.optional ? ' <span style="font-size:10px;font-weight:600;color:var(--t4);letter-spacing:0.5px;">OPTIONAL</span>' : '') + '</div>'
      +     '<div style="font-size:11px;color:' + noteCol + ';margin-top:2px;">' + esc(r.note) + '</div>'
      +   '</div>'
      +   btn
      + '</div></div>';
  },

  render(container) {
    if (!container) return;
    this.container = container;
    const st = this.state();
    const rows = this.rows(st);
    const required = rows.filter(r => !r.optional);
    const ready = required.filter(r => r.ready).length;

    const confirmBtn = st.confirmed
      ? '<button class="btn btn-ghost wc-confirm">Edit the confirmed week</button>'
      : '<button class="btn btn-primary wc-confirm">Confirm the Week</button>';

    container.innerHTML = '<div class="screen">'
      + this.banner(st, ready, required.length)
      + '<div class="sh" style="margin:0 0 10px;">What This Week Needs</div>'
      + rows.map(r => this.row(r)).join('')
      + '<div style="margin:18px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' + confirmBtn + '</div>'
      + '</div>';
    this.wire();
  },

  wire() {
    const c = this.container;
    if (!c) return;
    c.querySelector('.wc-prev')?.addEventListener('click', () => this.stepWeek(-7));
    c.querySelector('.wc-next')?.addEventListener('click', () => this.stepWeek(7));
    c.querySelector('.wc-now')?.addEventListener('click', () => { this._weekEnd = null; this.render(this.container); });
    c.querySelectorAll('.wc-go').forEach(el =>
      el.addEventListener('click', () => App.openScreen(el.dataset.go)));
    /* The confirm is the EXISTING popup, not a second copy of that form. It writes the `week` and
       `revenue_week` records, which is the whole definition of a closed week. */
    /* ⚠ `open(weekEnd, opts)` takes an OPTIONS OBJECT with `onDone`, not a bare callback. A callback
       passed positionally would have been read as `opts` and silently ignored, so the popup would
       save and this page would never redraw to show it. Checked against the signature. */
    c.querySelector('.wc-confirm')?.addEventListener('click', () => {
      if (window.ConfirmWeek && ConfirmWeek.open) {
        ConfirmWeek.open(this.weekEnd(), { onDone: () => this.render(this.container) });
      }
    });
  },

  /* ⚠ NO `showHowTo` HERE ON PURPOSE. This page opens through `openHubFullPage`, which installs a
     help shim from `App._HUB_HELP` keyed on the activeAction, so the nav "i" reads
     `_HUB_HELP['week-close']` and a copy on this object would never be shown. Two copies of the
     same directions is exactly how a stale how-to gets written, and only one of them would ever
     be the one the operator reads. */
};
