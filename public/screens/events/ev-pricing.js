'use strict';

/* ── Events — Pricing ─────────────────────────────────────────────────────────
   Two pricing tools for bookings. The Rate Card is your saved package menu
   (per-head, F&B minimum, room fee, cover range) that prefills a booking's
   quote. The Catering Calculator prices a per-head number to hit a target food
   cost, so an offsite job or a buyout gets quoted on margin, not gut feel.
   Rate cards persist in event_rate_cards. */

S.EventsPricing = {
  rateCards() { if (!Array.isArray(App.data.event_rate_cards)) App.data.event_rate_cards = []; return App.data.event_rate_cards; },
  types() { return (S.EventsBookings && S.EventsBookings.EVENT_TYPES) || ['Birthday', 'Corporate', 'Buyout', 'Catering (Offsite)', 'Other']; },

  // FOH average wage from Labor Control, else overall staff average, else 13.
  defaultWage() {
    const staff = (App.laborData && App.laborData.lc_staff) || [];
    const positions = (App.laborData && App.laborData.lc_positions) || [];
    const fohIds = new Set(positions.filter(p => p.department === 'Front of House').map(p => p.id));
    const foh = staff.filter(s => fohIds.has(s.position_id) && s.wage != null);
    if (foh.length) return Math.round((foh.reduce((s, x) => s + x.wage, 0) / foh.length) * 100) / 100;
    const any = staff.filter(s => s.wage != null);
    if (any.length) return Math.round((any.reduce((s, x) => s + x.wage, 0) / any.length) * 100) / 100;
    return 13;
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const rc = this.rateCards();
    const typeOpts = '<option value="">Select event...</option>' + this.types().map(t => '<option>' + esc(t) + '</option>').join('');

    // Rate Card form — all seven cells on one row; actions below the card.
    const rateForm = '<div class="card form-card"><div class="card-title">Rate Card</div>'
      + '<div class="form-row eb-crow" style="gap:12px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f"><label>Package Name</label><input type="text" id="rp-name" placeholder="Weeknight Buyout"/></div>'
        + '<div class="f"><label>Event Type</label><select id="rp-type" class="form-input">' + typeOpts + '</select></div>'
        + '<div class="f"><label>Min Covers</label><input type="number" id="rp-minc" placeholder="20"/></div>'
        + '<div class="f"><label>Max Covers</label><input type="number" id="rp-maxc" placeholder="60"/></div>'
        + '<div class="f"><label>F&amp;B Minimum</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rp-fb"/></div></div>'
        + '<div class="f"><label>Room Fee</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rp-room"/></div></div>'
        + '<div class="f"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rp-ph" step="0.01"/></div></div>'
      + '</div></div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="rp-add">Add Package</button>'
        + '<button class="btn btn-ghost" id="rp-clear">Start Over</button>'
        + '<button class="btn btn-ghost" id="rp-calc">Catering Calculator</button>'
      + '</div>';

    const rows = rc.map(r =>
      '<tr><td style="font-weight:600;">' + esc(r.package_name || '') + '</td>'
      + '<td>' + esc(r.event_type || '-') + '</td>'
      + '<td>' + (r.min_covers || ' ') + ' - ' + (r.max_covers || ' ') + '</td>'
      + '<td>' + (r.fb_minimum ? App.fmtCurrency(r.fb_minimum) : '-') + '</td>'
      + '<td>' + (r.room_fee ? App.fmtCurrency(r.room_fee) : 'Included') + '</td>'
      + '<td>' + (r.per_head ? App.fmtCurrency(r.per_head) : '-') + '</td>'
      + '<td><div class="row-actions"><button class="btn btn-danger btn-sm rp-del" data-id="' + esc(r.id) + '">Delete</button></div></td></tr>'
    ).join('') || '<tr><td colspan="7" style="color:var(--t3);text-align:center;padding:14px;">No packages yet. Build one above and it prefills your booking quotes.</td></tr>';

    const headingRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Packages</div>'
      + (rc.length ? '<button class="btn btn-ghost btn-sm" id="rp-export">Export PDF</button>' : '')
      + '</div>';

    const listCard = '<div id="rp-list" class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Package</th><th>Type</th><th>Covers</th><th>F&amp;B Min</th><th>Room Fee</th><th>Per Head</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    this.container.innerHTML = '<div class="screen">' + rateForm + headingRow + listCard + '</div>';
    this.wire();
  },

  wire() {
    document.getElementById('rp-add')?.addEventListener('click', () => this.addPackage());
    document.getElementById('rp-clear')?.addEventListener('click', () => this.draw());
    document.getElementById('rp-calc')?.addEventListener('click', () => this.cateringCalcModal());
    document.getElementById('rp-export')?.addEventListener('click', () => { const el = document.getElementById('rp-list'); if (el) App.exportPDF({ title: 'Rate Card', root: el }); });
    this.container.querySelectorAll('.rp-del').forEach(b => b.addEventListener('click', async () => {
      const ok = await App.confirmDelete(); if (!ok) return;
      App.data.event_rate_cards = this.rateCards().filter(r => r.id !== b.dataset.id);
      await App.saveKey('event_rate_cards'); this.draw();
    }));
  },

  // The Catering Calculator as a popup (the on-page version was removed).
  cateringCalcModal() {
    const wage = this.defaultWage();
    const tgt = (App.MENU_TARGET_COST_PCT && App.MENU_TARGET_COST_PCT.catering) || 28;
    const fld = (lbl, fid, val, pre, suf) =>
      '<div class="f"><label>' + lbl + '</label><div class="fw">' + (pre ? '<span class="pre">' + pre + '</span>' : '')
      + '<input class="form-input' + (pre ? ' pre' : suf ? ' suf' : '') + '" type="number" id="' + fid + '" value="' + (val != null ? val : '') + '" step="0.01"/>' + (suf ? '<span class="suf">' + suf + '</span>' : '') + '</div></div>';
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Catering Calculator</div>'
      + '<div class="form-grid">'
        + fld('Guest Count', 'rpc-guests', '')
        + fld('Food Cost / Head', 'rpc-food', '', '$')
        + fld('Bar Cost / Head', 'rpc-bar', '', '$')
        + fld('Staff Hours', 'rpc-hrs', '')
        + fld('Avg Staff Wage', 'rpc-wage', wage, '$')
        + fld('Other Costs', 'rpc-other', '', '$')
        + fld('Target Food Cost %', 'rpc-tgt', tgt, null, '%')
      + '</div>'
      + '<div id="rpc-result" style="margin-top:14px;"></div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="rpc-close">Close</button></div></div>';
    App.openModal(html, { id: 'rp-calc-modal', maxWidth: 680, noClose: true });
    ['rpc-guests', 'rpc-food', 'rpc-bar', 'rpc-hrs', 'rpc-wage', 'rpc-other', 'rpc-tgt'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', () => this.calc()));
    this.calc();
    document.getElementById('rpc-close')?.addEventListener('click', () => App.closeModal('rp-calc-modal'));
  },

  async addPackage() {
    const g = x => document.getElementById(x);
    const name = g('rp-name')?.value.trim();
    if (!name) return;
    this.rateCards().push({
      id: App.uid(), package_name: name,
      event_type: g('rp-type')?.value || '',
      min_covers: parseFloat(g('rp-minc')?.value) || 0,
      max_covers: parseFloat(g('rp-maxc')?.value) || 0,
      fb_minimum: parseFloat(g('rp-fb')?.value) || 0,
      room_fee:   parseFloat(g('rp-room')?.value) || 0,
      per_head:   parseFloat(g('rp-ph')?.value) || 0
    });
    await App.saveKey('event_rate_cards');
    this.draw();
  },

  calc() {
    const g = x => parseFloat(document.getElementById(x)?.value) || 0;
    const el = document.getElementById('rpc-result');
    const guests = g('rpc-guests');
    if (!el) return;
    if (!guests) { el.innerHTML = ''; return; }
    const totalFood = g('rpc-food') * guests, totalBar = g('rpc-bar') * guests;
    const labor = g('rpc-hrs') * (g('rpc-wage') || 13), other = g('rpc-other');
    const totalCost = totalFood + totalBar + labor + other;
    const tgt = g('rpc-tgt') || 28;
    const perHeadCost = totalCost / guests;
    const perHeadPrice = tgt > 0 ? perHeadCost / (tgt / 100) : 0;
    const totalRev = perHeadPrice * guests;
    const margin = totalRev - totalCost;
    const box = (label, val, gold) => '<div style="background:var(--input);border-radius:6px;padding:10px 12px;' + (gold ? 'border:1px solid var(--gold-tint-bord);' : '') + '"><div style="font-size:10px;color:' + (gold ? 'var(--gold)' : 'var(--t3)') + ';">' + label + '</div><div style="font-size:' + (gold ? '20px' : '16px') + ';font-weight:' + (gold ? '800' : '700') + ';color:' + (gold ? 'var(--gold)' : 'var(--t1)') + ';">' + val + '</div></div>';
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:10px;">'
      + box('Total Cost', App.fmtCurrency(totalCost))
      + box('Cost Per Head', App.fmtCurrency(perHeadCost))
      + box('Suggested Per Head', App.fmtCurrency(perHeadPrice), true)
      + box('Total Event Revenue', App.fmtCurrency(totalRev))
      + box('Gross Margin', App.fmtCurrency(margin))
      + '</div>';
  },

  showHowTo() {
    App.showHelpModal('How Pricing Works', [
      { p: ['Your saved packages and a quick calculator, both feeding your booking quotes.'] },
      { h: 'Rate Card', p: ['Build your standard packages: the per-head price, the food and beverage minimum, any room fee, and the cover range each fits. On a booking, picking a package prefills the quote so you are not retyping prices every time. Export PDF prints the list to hand a client or keep on file.'] },
      { h: 'Catering Calculator', p: ['Tap Catering Calculator for a one-off job. Enter the per-head food and bar cost, the staff hours, and a target food cost percent, and Bar Cop works backward to the per-head price that hits your margin. It pulls your average front-of-house wage from Labor Control to start. The same calculator is on every booking\'s quote.'] }
    ]);
  }
};
