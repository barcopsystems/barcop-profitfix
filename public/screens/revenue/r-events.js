'use strict';
S.RevenueEvents = {
  activeTab: 'pipeline',

  render(container, actions) {
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Log Event';
    addBtn.addEventListener('click', () => this.showForm(container, actions));
    actions.appendChild(addBtn);

    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:8px;';
    ['Pipeline','Rate Card','Catering Calc'].forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm ' + (t.toLowerCase().replace(' ','-') === this.activeTab ? 'btn-primary' : 'btn-ghost');
      btn.textContent = t;
      btn.addEventListener('click', () => { this.activeTab = t.toLowerCase().replace(' ','-'); this.render(container, actions); });
      tabs.appendChild(btn);
    });
    actions.insertBefore(tabs, actions.firstChild);

    if (this.activeTab === 'pipeline')       this.renderPipeline(container, actions);
    else if (this.activeTab === 'rate-card') this.renderRateCard(container, actions);
    else this.renderCateringCalc(container, actions);
  },

  renderPipeline(container, actions) {
    const events = App.data.revenue_events || [];
    const t = App.data.revenue_settings?.targets || {};
    const closeRate = t.event_close_rate || 40;

    const totalRev    = events.filter(e=>e.status==='Completed').reduce((s,e)=>s+(e.actual_revenue||0),0);
    const pipeline    = events.filter(e=>e.status==='Inquiry'||e.status==='Proposal Sent').reduce((s,e)=>s+(e.estimated_revenue||0),0);
    const projectedWin = pipeline * (closeRate/100);

    const statusColor = s => ({ 'Completed':'var(--gold)', 'Confirmed':'#4888A8', 'Proposal Sent':'#D08008', 'Inquiry':'var(--t3)', 'Lost':'var(--red)' }[s] || 'var(--t2)');

    const rows = events.slice().reverse().map((e) =>
      '<tr>'
      + '<td><input type="checkbox" class="rev-chk" data-id="' + e.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
      + '<td>' + (e.date||'').slice(0,10) + '</td>'
      + '<td style="font-weight:600;">' + esc(e.event_name||'') + '</td>'
      + '<td>' + esc(e.event_type||'') + '</td>'
      + '<td>' + (e.covers||' ') + '</td>'
      + '<td>' + (e.fb_minimum ? App.fmtCurrency(e.fb_minimum) : ' ') + '</td>'
      + '<td>' + (e.actual_revenue ? App.fmtCurrency(e.actual_revenue) : e.estimated_revenue ? App.fmtCurrency(e.estimated_revenue) + ' (est)' : ' ') + '</td>'
      + '<td style="color:' + statusColor(e.status) + ';font-weight:700;">' + esc(e.status||'') + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No events logged yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid" style="margin-bottom:16px;">'
      + '<div class="metric-card"><div class="metric-label">Completed Revenue</div><div class="metric-val on-target">' + App.fmtCurrency(totalRev) + '</div><div class="metric-target">All time</div></div>'
      + '<div class="metric-card"><div class="metric-label">Pipeline Value</div><div class="metric-val">' + App.fmtCurrency(pipeline) + '</div><div class="metric-target">Open inquiries and proposals</div></div>'
      + '<div class="metric-card"><div class="metric-label">Projected Wins</div><div class="metric-val">' + App.fmtCurrency(projectedWin) + '</div><div class="metric-target">At ' + closeRate + '% close rate</div></div>'
      + '<div class="metric-card"><div class="metric-label">Total Events</div><div class="metric-val">' + events.length + '</div><div class="metric-target">' + events.filter(e=>e.status==='Completed').length + ' completed</div></div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="rev-sel-all">Select All</button>'
      + '<button class="btn btn-danger btn-sm" id="rev-del-sel" style="display:none;">Delete Selected</button>'
      + '<span id="rev-sel-count" style="font-size:11px;color:var(--t3);"></span>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th style="width:36px;"></th>'
      + '<th>Date</th><th>Event Name</th><th>Type</th><th>Covers ' + tt('r-covers') + '</th><th>F&B Min ' + tt('r-fb-minimum') + '</th><th>Revenue ' + tt('r-event-revenue') + '</th><th>Status</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    const updateSel = () => {
      const checked = container.querySelectorAll('.rev-chk:checked');
      const delBtn  = document.getElementById('rev-del-sel');
      const count   = document.getElementById('rev-sel-count');
      if (delBtn) delBtn.style.display = checked.length ? '' : 'none';
      if (count)  count.textContent    = checked.length ? checked.length + ' selected' : '';
    };
    document.getElementById('rev-sel-all')?.addEventListener('click', () => {
      const all = container.querySelectorAll('.rev-chk');
      const anyUnchecked = [...all].some(c => !c.checked);
      all.forEach(c => { c.checked = anyUnchecked; });
      updateSel();
    });
    document.getElementById('rev-chk-all')?.addEventListener('change', e => {
      container.querySelectorAll('.rev-chk').forEach(c => { c.checked=e.target.checked; });
      updateSel();
    });
    container.addEventListener('change', e => { if(e.target.classList.contains('rev-chk')) updateSel(); });
    document.getElementById('rev-del-sel')?.addEventListener('click', async () => {
      const ids = [...container.querySelectorAll('.rev-chk:checked')].map(c=>c.dataset.id);
      if (!ids.length) return;
      App.data.revenue_events = (App.data.revenue_events||[]).filter(e=>!ids.includes(e.id));
      await App.saveKey('revenue_events');
      this.render(container, actions);
    });
  },

  renderRateCard(container, actions) {
    const rc = App.data.revenue_rate_cards || [];
    const rows = rc.map((r, i) =>
      '<tr><td style="font-weight:600;">' + esc(r.package_name||'') + '</td>'
      + '<td>' + esc(r.event_type||'') + '</td>'
      + '<td>' + (r.min_covers||' ') + ' – ' + (r.max_covers||' ') + '</td>'
      + '<td>' + (r.fb_minimum ? App.fmtCurrency(r.fb_minimum) : ' ') + '</td>'
      + '<td>' + (r.room_fee ? App.fmtCurrency(r.room_fee) : 'Included') + '</td>'
      + '<td>' + (r.per_head ? App.fmtCurrency(r.per_head) : ' ') + '</td>'
      + '<td><button class="btn btn-danger btn-sm" onclick="S.RevenueEvents._delRC(' + i + ', this)">Del</button></td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="7" style="color:var(--t3);text-align:center;padding:14px;">No rate cards yet.</td></tr>';

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Build Your Rate Card</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-lg"><label>Package Name</label><input type="text" id="rrc-name" placeholder="Weeknight Buyout"/></div>'
      + '<div class="f w-md"><label>Event Type</label><select id="rrc-type" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option>Private Dining</option><option>Buyout</option><option>Catering</option><option>Corporate</option><option>Social</option></select></div>'
      + '<div class="f w-md"><label>Min Covers ' + tt('r-event-covers') + '</label><input type="number" id="rrc-minc" placeholder="20"/></div>'
      + '<div class="f w-md"><label>Max Covers</label><input type="number" id="rrc-maxc" placeholder="60"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>F&B Minimum ' + tt('r-fb-minimum') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rrc-fbmin" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Room Fee</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rrc-room" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Per Head</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rrc-perhead" placeholder=""/></div></div>'
      + '</div>'
      + '<button class="btn btn-primary" id="rrc-add">Add Package</button>'
      + '</div>'
      + '<div class="tbl-wrap" style="margin-top:16px;"><table class="tbl"><thead><tr><th>Package</th><th>Type</th><th>Covers</th><th>F&B Min</th><th>Room Fee</th><th>Per Head</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    document.getElementById('rrc-add')?.addEventListener('click', async () => {
      const name = document.getElementById('rrc-name')?.value.trim();
      if (!name) return;
      const entry = {
        id: App.uid(),
        package_name: name,
        event_type:   document.getElementById('rrc-type')?.value,
        min_covers:   parseFloat(document.getElementById('rrc-minc')?.value) || 0,
        max_covers:   parseFloat(document.getElementById('rrc-maxc')?.value) || 0,
        fb_minimum:   parseFloat(document.getElementById('rrc-fbmin')?.value) || 0,
        room_fee:     parseFloat(document.getElementById('rrc-room')?.value) || 0,
        per_head:     parseFloat(document.getElementById('rrc-perhead')?.value) || 0,
      };
      if (!App.data.revenue_rate_cards) App.data.revenue_rate_cards = [];
      App.data.revenue_rate_cards.push(entry);
      await App.saveKey('revenue_rate_cards');
      this.render(container, actions);
    });
  },

  _delRC(i, btn) {
    if (!confirm('Delete this package?')) return;
    App.data.revenue_rate_cards.splice(i, 1);
    App.saveKey('revenue_rate_cards').then(() => {
      const c = document.getElementById('content-area');
      const a = document.getElementById('topbar-actions');
      S.RevenueEvents.render(c, a);
    });
  },

  renderCateringCalc(container, actions) {
    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Catering Pricing Calculator</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Guest Count</label><input type="number" id="rcc-guests" placeholder="50"/></div>'
      + '<div class="f w-md"><label>Food Cost Per Head</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-food" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Bar Cost Per Head</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-bar" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Staff Hours</label><input type="number" id="rcc-hrs" placeholder=""/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Avg Staff Wage</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-wage" value="' + (App.data.revenue_settings?.avg_hourly_wage?.floor || 13) + '"/></div></div>'
      + '<div class="f w-md"><label>Other Costs</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rcc-other" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Target Food Cost %</label><div class="fw"><input class="suf" type="number" id="rcc-tgt" value="28" step="1"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rcc-result"></div>'
      + '</div></div>';

    const calc = () => {
      const guests   = parseFloat(document.getElementById('rcc-guests')?.value) || 0;
      const foodCost = parseFloat(document.getElementById('rcc-food')?.value)   || 0;
      const barCost  = parseFloat(document.getElementById('rcc-bar')?.value)    || 0;
      const hrs      = parseFloat(document.getElementById('rcc-hrs')?.value)    || 0;
      const wage     = parseFloat(document.getElementById('rcc-wage')?.value)   || 13;
      const other    = parseFloat(document.getElementById('rcc-other')?.value)  || 0;
      const tgt      = parseFloat(document.getElementById('rcc-tgt')?.value)    || 28;
      const el       = document.getElementById('rcc-result');
      if (!el || !guests) { if(el) el.innerHTML=''; return; }
      const totalFoodCost  = foodCost * guests;
      const totalBarCost   = barCost  * guests;
      const laborCost      = hrs * wage;
      const totalCost      = totalFoodCost + totalBarCost + laborCost + other;
      const perHeadCost    = totalCost / guests;
      const perHeadPrice   = tgt > 0 ? perHeadCost / (tgt/100) : 0;
      const totalRevenue   = perHeadPrice * guests;
      const margin         = totalRevenue - totalCost;
      el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Total Cost</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(totalCost) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Cost Per Head</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(perHeadCost) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;border:1px solid rgba(201,168,76,0.3);"><div style="font-size:10px;color:var(--gold);">Suggested Per Head Price</div><div style="font-size:20px;font-weight:800;color:var(--gold);">' + App.fmtCurrency(perHeadPrice) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Total Event Revenue</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(totalRevenue) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 12px;"><div style="font-size:10px;color:var(--t3);">Gross Margin</div><div style="font-size:16px;font-weight:700;color:' + (margin > 0 ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(margin) + '</div></div>'
        + '</div>';
    };
    ['rcc-guests','rcc-food','rcc-bar','rcc-hrs','rcc-wage','rcc-other','rcc-tgt'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', calc));
  },

  showForm(container, actions) {
    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Log Event</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
      + '<div class="f w-lg"><label>Event Name</label><input type="text" id="rev-name" placeholder="Smith Wedding Rehearsal"/></div>'
      + '<div class="f w-md"><label>Event Type</label><select id="rev-type" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option>Private Dining</option><option>Buyout</option><option>Catering</option><option>Corporate</option><option>Social</option></select></div>'
      + '<div class="f w-md"><label>Status</label><select id="rev-status" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option>Inquiry</option><option>Proposal Sent</option><option>Confirmed</option><option>Completed</option><option>Lost</option></select></div>'
      + '<div class="f w-md"><label>Date</label><input type="date" id="rev-date" value="' + new Date().toISOString().slice(0,10) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
      + '<div class="f w-md"><label>Covers ' + tt('r-event-covers') + '</label><input type="number" id="rev-cov" placeholder=""/></div>'
      + '<div class="f w-md"><label>F&B Minimum ' + tt('r-fb-minimum') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-fbmin" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Actual Revenue ' + tt('r-event-revenue') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-actual" placeholder=""/></div></div>'
      + '<div class="f w-md"><label>Estimated Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rev-est" placeholder=""/></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:16px;"><label>Notes</label><input type="text" id="rev-notes" placeholder="Optional"/></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-primary" id="rev-save">Save Event</button>'
      + '<button class="btn btn-ghost" id="rev-cancel">Cancel</button>'
      + '</div></div></div>';

    document.getElementById('rev-cancel')?.addEventListener('click', () => this.render(container, actions));
    document.getElementById('rev-save')?.addEventListener('click', async () => {
      const name = document.getElementById('rev-name')?.value.trim();
      if (!name) return;
      const entry = {
        id: App.uid(),
        event_name:        name,
        event_type:        document.getElementById('rev-type')?.value,
        status:            document.getElementById('rev-status')?.value,
        date:              document.getElementById('rev-date')?.value,
        covers:            parseFloat(document.getElementById('rev-cov')?.value)    || 0,
        fb_minimum:        parseFloat(document.getElementById('rev-fbmin')?.value)  || 0,
        actual_revenue:    parseFloat(document.getElementById('rev-actual')?.value) || 0,
        estimated_revenue: parseFloat(document.getElementById('rev-est')?.value)    || 0,
        notes:             document.getElementById('rev-notes')?.value || '',
        saved_at:          new Date().toISOString()
      };
      if (!App.data.revenue_events) App.data.revenue_events = [];
      App.data.revenue_events.push(entry);
      await App.saveKey('revenue_events');
      this.render(container, actions);
    });
  }
};
