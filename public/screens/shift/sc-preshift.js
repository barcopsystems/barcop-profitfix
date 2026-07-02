'use strict';

/* ── Shift Control — Pre-Shift Briefing ───────────────────────────────────────
   The daily before-doors line-up tool, next to Run Checklists. Bar Cop builds
   the briefing from live data so the manager reads it instead of filling a blank
   sheet: today's featured Stars (from Menu Engineering), the check-average target,
   tonight's cover forecast (from Build Schedule), and the standing upsell
   sequence. The manager adds a "today's focus" line, reads it at line-up or
   prints it, and taps Held to log it. Logging is OPT-IN: it feeds the Bar Cop
   Audit's operational discipline only once you use it, and never dings a bar that
   does not. Records live in sc_briefings. */

S.ShiftPreShift = {

  UPSELL: [
    ['Greet and first-round drink', 'A drink order on the first visit. The first-round drink is the opening move at every table.'],
    ['Appetizer offer', 'Name one, do not ask "any apps?"'],
    ['Feature the Stars', 'Recommend from tonight\'s Stars below. Point to a dish, not the menu.'],
    ['Second round', 'Check drinks at the halfway mark.'],
    ['Dessert and after-dinner', 'Offer both, every table.'],
    ['Genuine close', 'Thank them, invite them back.']
  ],

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (this._focus == null) this._focus = (this._todayRecord() || {}).focus || '';
    this.draw();
  },

  briefings() { return (App.shiftData && App.shiftData.sc_briefings) || []; },
  _todayRecord() { const t = App.todayLocal(); return this.briefings().find(b => (b.date || '') === t) || null; },

  // ── Live data the briefing is built from ────────────────────────────────────
  n(v) { return (v == null || isNaN(v)) ? null : Number(v); },

  // Today's featured Stars: high margin AND high volume vs the whole menu.
  todayStars() {
    const items = ((App.data && App.data.menu_items) || [])
      .filter(i => !i.archived && this.n(i.price) != null && this.n(i.cost) != null && this.n(i.weekly_covers) != null && i.weekly_covers > 0);
    if (items.length < 4) return [];
    const cm = arr => arr.reduce((s, i) => s + (i.price - i.cost), 0) / arr.length;
    const cv = arr => arr.reduce((s, i) => s + (i.weekly_covers || 0), 0) / arr.length;
    const avgCM = cm(items), avgCov = cv(items);
    return items.filter(i => (i.price - i.cost) >= avgCM && i.weekly_covers >= avgCov)
      .sort((a, b) => (b.price - b.cost) - (a.price - a.cost))
      .slice(0, 5);
  },

  checkTarget() {
    const t = (App.data && App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    return this.n(t.check_avg);
  },

  // Tonight's cover forecast from the week's revenue forecast (covers_per_day).
  coversToday() {
    const fc = (App.data && App.data.revenue_forecasts) || [];
    if (!fc.length) return null;
    const d = new Date(App.todayLocal() + 'T00:00:00');
    const wd = (d.getDay() + 6) % 7;                       // Mon=0
    const mon = new Date(d); mon.setDate(d.getDate() - wd);
    const monStr = App.ymdLocal(mon);
    const abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][wd];
    const rec = fc.find(f => f.week_start === monStr) || fc.slice().sort((a, b) => (b.week_start || '').localeCompare(a.week_start || ''))[0];
    const cpd = rec && rec.covers_per_day;
    return (cpd && cpd[abbr] != null) ? cpd[abbr] : null;
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  draw() {
    const stars = this.todayStars();
    const tgt = this.checkTarget();
    const covers = this.coversToday();
    const held = this._todayRecord();
    const dateLabel = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const starHtml = stars.length
      ? stars.map(s => '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#0D181E;border-radius:6px;margin-top:6px;">'
          + '<div style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--t1);">' + esc(s.name || 'Item') + '</div>'
          + '<div style="flex-shrink:0;font-size:12px;color:var(--gold);font-weight:700;">' + App.fmtCurrency(s.price - s.cost) + ' margin</div></div>').join('')
      : '<div style="font-size:12px;color:var(--t3);padding:10px 14px;background:#0D181E;border-radius:6px;margin-top:6px;">Cost and price your menu items in Menu Engineering and your Stars show up here.</div>';

    const seqHtml = this.UPSELL.map((u, i) => '<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:20px;flex-shrink:0;">' + (i + 1) + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(u[0]) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.5;margin-top:2px;">' + esc(u[1]) + '</div></div></div>').join('');

    const stat = (label, val, sub) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg">' + val + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';

    this.container.innerHTML = '<div class="screen">'
      // Header card
      + '<div class="card form-card" style="margin-bottom:16px;">'
      +   '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      +     '<span>Pre-Shift Briefing</span>'
      +     '<button class="btn btn-ghost btn-sm" id="pb-print">Print</button>'
      +   '</div>'
      +   '<div style="font-size:13px;color:var(--t2);line-height:1.6;">Read this at line-up. Bar Cop builds it from tonight\'s numbers, so it is current every shift. Add your focus for the night, then run it.</div>'
      +   '<div style="font-size:12px;color:var(--t3);margin-top:6px;">' + esc(dateLabel) + (held ? '  &middot;  <span style="color:var(--green);font-weight:700;">Briefing held</span>' : '') + '</div>'
      + '</div>'
      // Live stat strip
      + '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap;">'
      +   stat('Check Average Target', tgt != null ? App.fmtCurrency(tgt) : '-', 'the number for tonight')
      +   stat('Covers Forecast', covers != null ? String(covers) : '-', covers != null ? 'expected tonight' : 'set a forecast in Build Schedule')
      +   stat('Stars Featured', String(stars.length), 'push these')
      + '</div></div>'
      // Today's focus
      + '<div class="sh" style="margin:20px 0 10px;">Today\'s Focus</div>'
      + '<div class="card form-card" style="margin-bottom:16px;">'
      +   '<div class="f"><textarea class="form-input" id="pb-focus" rows="2" placeholder="One thing to hit tonight: a slow daypart, a new dish, a dessert push...">' + esc(this._focus || '') + '</textarea></div>'
      + '</div>'
      // Stars
      + '<div class="sh" style="margin:20px 0 10px;">Feature These Tonight</div>'
      + '<div class="card" style="margin-bottom:16px;">' + starHtml + '</div>'
      // Upsell sequence
      + '<div class="sh" style="margin:20px 0 10px;">The Upsell Sequence</div>'
      + '<div class="card" style="margin-bottom:16px;">' + seqHtml + '</div>'
      // Actions
      + '<div style="display:flex;align-items:center;gap:12px;margin:0 0 20px;">'
      +   '<button class="btn btn-primary" id="pb-held">' + (held ? 'Update Tonight\'s Briefing' : 'Mark Briefing Held') + '</button>'
      +   '<span id="pb-status" style="font-size:12px;color:var(--green);display:none;"></span>'
      + '</div>'
      // History
      + this.historyHtml()
      + '</div>';

    this.wire();
  },

  historyHtml() {
    const rows = this.briefings().slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, App.listLimit ? App.listLimit('sc', 'sc_briefings') : 50)
      .map(b => '<tr>'
        + '<td>' + (b.date || '') + '</td>'
        + '<td>' + (b.stars_count != null ? b.stars_count + ' Stars' : '') + '</td>'
        + '<td style="color:var(--t2);">' + esc((b.focus || '').slice(0, 70)) + '</td>'
        + '</tr>').join('');
    if (!rows) return '';
    return '<div class="sh" style="margin:24px 0 10px;">Briefing History</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list">'
      + '<colgroup><col style="width:22%;"><col style="width:18%;"><col style="width:60%;"></colgroup>'
      + '<thead><tr><th>Date</th><th>Featured</th><th>Focus</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  wire() {
    const focusEl = this.container.querySelector('#pb-focus');
    if (focusEl) focusEl.addEventListener('input', e => { this._focus = e.target.value; });
    this.container.querySelector('#pb-held')?.addEventListener('click', () => this.markHeld());
    this.container.querySelector('#pb-print')?.addEventListener('click', () => this.print());
  },

  async markHeld() {
    const stars = this.todayStars();
    const date = App.todayLocal();
    const existing = this._todayRecord();
    const rec = {
      id: (existing && existing.id) || App.uid(),
      date,
      focus: this._focus || '',
      stars_count: stars.length,
      stars: stars.map(s => s.name),
      check_target: this.checkTarget(),
      covers_forecast: this.coversToday(),
      held: true,
      created_at: new Date().toISOString()
    };
    const ok = await App.putRecord('sc', 'briefing', rec);
    if (ok) {
      const st = this.container.querySelector('#pb-status');
      if (st) { st.style.display = 'inline'; st.textContent = 'Logged for ' + date + '.'; }
      this.draw();
    }
  },

  async print() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const stars = this.todayStars();
    const tgt = this.checkTarget();
    const covers = this.coversToday();
    const dateLabel = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const b = App._pdfBuilder('Pre-Shift Briefing');
    b.header({ right: 'Pre-Shift Briefing', meta: dateLabel });
    b.kv('Check average target', tgt != null ? App.fmtCurrency(tgt) : 'Not set');
    b.kv('Covers forecast', covers != null ? String(covers) : 'Not set');
    if (this._focus) { b.spacer(2); b.sectionTitle('Tonight\'s Focus'); b.spacer(4); b.paragraph(this._focus, { gray: 40 }); }
    b.sectionTitle('Feature These Tonight'); b.spacer(4);
    if (stars.length) b.table(['Item', 'Margin'], stars.map(s => [s.name || 'Item', App.fmtCurrency(s.price - s.cost)]), { columnStyles: { 1: { cellWidth: 90, halign: 'right' } } });
    else b.paragraph('Cost and price your menu in Menu Engineering to feature your Stars.', { gray: 70 });
    b.sectionTitle('The Upsell Sequence'); b.spacer(4);
    this.UPSELL.forEach((u, i) => b.paragraph((i + 1) + '. ' + u[0] + '. ' + u[1], { gray: 45 }));
    const venue = (App.data && App.data.settings && App.data.settings.bar_name) || 'Bar Cop';
    await b.save(venue + ' - Pre-Shift Briefing - ' + App.todayLocal() + '.pdf');
  },

  showHowTo() {
    App.showHelpModal('How the Pre-Shift Briefing Works', [
      { p: ['The Pre-Shift Briefing is the daily line-up sheet, read to the floor before doors. Bar Cop builds it from your live numbers so it is current every shift, with nothing to fill in from scratch.'] },
      { h: 'What Bar Cop fills in', p: ['Tonight\'s featured Stars come from Menu Engineering, the high-margin, high-volume items worth pushing. The check-average target is your Revenue target. The cover forecast comes from Build Schedule. The upsell sequence is the standing six touch points. You add one line of focus for the night.'] },
      { h: 'Run it and log it', p: ['Read it at line-up or tap Print for a paper copy. Tap Mark Briefing Held to log that you ran it. Logging is optional: it counts toward your Bar Cop Audit operational discipline once you start using it, and never counts against you if you do not.'] }
    ]);
  }
};
