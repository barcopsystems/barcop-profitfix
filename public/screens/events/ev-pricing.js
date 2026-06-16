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
    const typeOpts = '<option value="">-</option>' + this.types().map(t => '<option>' + esc(t) + '</option>').join('');

    const rows = rc.map(r =>
      '<tr><td style="font-weight:600;">' + esc(r.package_name || '') + '</td>'
      + '<td>' + esc(r.event_type || '-') + '</td>'
      + '<td>' + (r.min_covers || ' ') + ' - ' + (r.max_covers || ' ') + '</td>'
      + '<td>' + (r.fb_minimum ? App.fmtCurrency(r.fb_minimum, 0) : '-') + '</td>'
      + '<td>' + (r.room_fee ? App.fmtCurrency(r.room_fee, 0) : 'Included') + '</td>'
      + '<td>' + (r.per_head ? App.fmtCurrency(r.per_head) : '-') + '</td>'
      + '<td><button class="btn btn-danger btn-sm rp-del" data-id="' + esc(r.id) + '">Delete</button></td></tr>'
    ).join('') || '<tr><td colspan="7" style="color:var(--t3);text-align:center;padding:14px;">No packages yet. Build one above and it prefills your booking quotes.</td></tr>';

    const rateCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Rate Card</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Package Name</label><input type="text" id="rp-name" placeholder="Weeknight Buyout"/></div>'
        + '<div class="f"><label>Event Type</label><select id="rp-type" class="form-input">' + typeOpts + '</select></div>'
        + '<div class="f"><label>Min Covers</label><input type="number" id="rp-minc" placeholder="20"/></div>'
        + '<div class="f"><label>Max Covers</label><input type="number" id="rp-maxc" placeholder="60"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>F&amp;B Minimum</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rp-fb"/></div></div>'
        + '<div class="f"><label>Room Fee</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rp-room"/></div></div>'
        + '<div class="f"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rp-ph" step="0.01"/></div></div>'
      + '</div>'
      + '<div style="margin-top:4px;"><button class="btn btn-primary" id="rp-add">Add Package</button></div>'
      + '<div class="card card-bleed data-card" style="margin-top:16px;"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Package</th><th>Type</th><th>Covers</th><th>F&amp;B Min</th><th>Room Fee</th><th>Per Head</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      + '</div>';

    const calc = '<div class="card form-card"><div class="card-title">Catering Calculator</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Guest Count</label><input type="number" id="rpc-guests" placeholder="50"/></div>'
        + '<div class="f"><label>Food Cost / Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rpc-food" step="0.01"/></div></div>'
        + '<div class="f"><label>Bar Cost / Head</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rpc-bar" step="0.01"/></div></div>'
        + '<div class="f"><label>Staff Hours</label><input type="number" id="rpc-hrs"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f"><label>Avg Staff Wage</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rpc-wage" value="' + this.defaultWage() + '"/></div></div>'
        + '<div class="f"><label>Other Costs</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="rpc-other"/></div></div>'
        + '<div class="f"><label>Target Food Cost %</label><div class="fw"><input class="form-input suf" type="number" id="rpc-tgt" value="' + ((App.MENU_TARGET_COST_PCT && App.MENU_TARGET_COST_PCT.catering) || 28) + '"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rpc-result" style="margin-top:6px;"></div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + rateCard + calc + '</div>';
    this.wire();
  },

  wire() {
    document.getElementById('rp-add')?.addEventListener('click', () => this.addPackage());
    this.container.querySelectorAll('.rp-del').forEach(b => b.addEventListener('click', async () => {
      const ok = await App.confirmDelete(); if (!ok) return;
      App.data.event_rate_cards = this.rateCards().filter(r => r.id !== b.dataset.id);
      await App.saveKey('event_rate_cards'); this.draw();
    }));
    ['rpc-guests', 'rpc-food', 'rpc-bar', 'rpc-hrs', 'rpc-wage', 'rpc-other', 'rpc-tgt'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', () => this.calc()));
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
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">'
      + box('Total Cost', App.fmtCurrency(totalCost))
      + box('Cost Per Head', App.fmtCurrency(perHeadCost))
      + box('Suggested Per Head', App.fmtCurrency(perHeadPrice), true)
      + box('Total Event Revenue', App.fmtCurrency(totalRev))
      + box('Gross Margin', App.fmtCurrency(margin))
      + '</div>';
  },

  showHowTo() {
    App.showHelpModal('How Pricing Works', [
      { p: ['Two tools that feed your booking quotes. Build packages on the Rate Card and price one-offs on the Catering Calculator.'] },
      { h: 'Rate Card', p: ['Save your standard packages: the per-head price, the food and beverage minimum, any room fee, and the cover range it fits. On a booking, picking a package prefills the quote so you are not retyping prices every time.'] },
      { h: 'Catering Calculator', p: ['For a custom job, enter your per-head food and bar cost, the staff hours, and a target food cost percent. Bar Cop works backward to the per-head price that hits your target margin, so an offsite catering gig or a buyout gets quoted on the numbers instead of a guess. It pulls your average front-of-house wage from Labor Control to start.'] }
    ]);
  }
};
