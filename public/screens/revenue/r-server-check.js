'use strict';
S.RevenueServerCheck = {
  _calc: null,
  _entryId: null,
  _saving: false,

  render(container, actions) {
    actions.innerHTML = '';
    this._entryId = App.uid();
    this._calc    = null;

    const t        = App.data.revenue_settings?.targets || {};
    const servers  = App.data.revenue_settings?.servers || [];
    const targetCA = t.check_avg || 35;
    const today    = new Date().toISOString().slice(0,10);
    const h        = new Date().getHours();
    const shift    = h < 14 ? 'Lunch' : h < 20 ? 'Dinner' : 'Bar';

    const log = (App.data.revenue_server_checks||[]).slice(-30).reverse();

    const logRows = !log.length
      ? '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--t4);">No shift checks logged yet.</td></tr>'
      : log.map(c => {
          const ca  = c.covers > 0 ? c.sales / c.covers : 0;
          const diff = ca - targetCA;
          const cls  = diff >= 0 ? 'badge-ok' : diff >= -5 ? 'badge-dim' : 'badge-warn';
          const status = diff >= 0 ? 'ON TARGET' : diff >= -5 ? 'WATCH' : 'BELOW STANDARD';
          return '<tr>'
            + '<td>' + (c.date||'').slice(0,10) + '</td>'
            + '<td>' + esc(c.shift||'') + '</td>'
            + '<td>' + esc(c.server_name||'') + '</td>'
            + '<td class="val">' + App.fmtCurrency(ca) + '</td>'
            + '<td style="color:' + (diff>=0?'var(--gold)':diff>=-5?'var(--t2)':'var(--red)') + ';">' + (diff>=0?'+':'') + App.fmtCurrency(diff) + '</td>'
            + '<td><span class="badge ' + cls + '">' + status + '</span></td>'
            + '</tr>';
        }).join('');

    const serverOpts = servers.map(s => '<option>' + esc(s.name) + '</option>').join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div class="card-title">New Shift Check</div>'
      + '<div class="form-row" style="flex-wrap:nowrap;gap:10px;align-items:flex-end;">'
      + '<div class="f" style="width:148px;flex-shrink:0;"><label>Date</label><input type="date" id="rsc-date" value="' + today + '" style="width:100%;"/></div>'
      + '<div class="f" style="width:88px;flex-shrink:0;"><label>Shift</label><select id="rsc-shift" style="width:100%;background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;"><option' + (shift==='Lunch'?' selected':'') + '>Lunch</option><option' + (shift==='Dinner'?' selected':'') + '>Dinner</option><option' + (shift==='Bar'?' selected':'') + '>Bar</option></select></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Server</label><select id="rsc-server" style="width:100%;background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;">' + (serverOpts||'<option>No servers in roster</option>') + '</select></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Covers ' + tt('r-covers') + '</label><input type="number" id="rsc-cov" placeholder="0" style="width:100%;"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Total Sales ' + tt('r-check-avg') + '</label><div class="fw" style="width:100%;"><span class="pre">$</span><input class="pre" type="number" id="rsc-sales" placeholder="0" style="width:100%;"/></div></div>'
      + '<div class="f" style="flex-shrink:0;"><label style="opacity:0;">x</label><button class="btn btn-primary" id="rsc-submit" style="white-space:nowrap;">Submit</button></div>'
      + '</div>'
      + '<div id="rsc-result" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--b2);">'
      + '<div style="display:flex;align-items:center;gap:40px;flex-wrap:wrap;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Check Average</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;" id="rsc-ca"> </div></div>'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Target</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;color:var(--t3);">$' + targetCA + '</div></div>'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">vs Target</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;" id="rsc-var"> </div></div>'
      + '<div style="margin-left:auto;"><div id="rsc-badge" style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:12px 18px;border-radius:4px;"></div></div>'
      + '</div></div>'
      + '</div>'
      + '<div class="sh">Shift Log   Last 30</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="rsc-sel-all">Select All</button>'
      + '<button class="btn btn-danger btn-sm" id="rsc-del-sel" style="display:none;">Delete Selected</button>'
      + '<span id="rsc-sel-count" style="font-size:11px;color:var(--t3);"></span>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th style="width:36px;"></th>'
      + '<th>Date</th><th>Shift</th><th>Server</th><th>Check Avg ' + tt('r-check-avg') + '</th><th>vs Target</th><th>Status</th>'
      + '</tr></thead><tbody id="rsc-log">' + this._buildRows(log, targetCA) + '</tbody></table></div>'
      + '</div>';

    document.getElementById('rsc-cov')?.addEventListener('input', () => this.calc());
    document.getElementById('rsc-sales')?.addEventListener('input', () => this.calc());
    document.getElementById('rsc-submit')?.addEventListener('click', () => {
      if (this._saving) return; this._saving=true; setTimeout(()=>{this._saving=false;},2000);
      this.calc(); this.save(container, actions);
    });

    // Bulk delete wiring
    const updateSel = () => {
      const checked = container.querySelectorAll('.rsc-chk:checked');
      const delBtn  = document.getElementById('rsc-del-sel');
      const count   = document.getElementById('rsc-sel-count');
      if (delBtn) delBtn.style.display = checked.length ? '' : 'none';
      if (count)  count.textContent    = checked.length ? checked.length + ' selected' : '';
    };
    document.getElementById('rsc-chk-all')?.addEventListener('change', e => {
      container.querySelectorAll('.rsc-chk').forEach(c => { c.checked=e.target.checked; });
      updateSel();
    });
    container.addEventListener('change', e => { if(e.target.classList.contains('rsc-chk')) updateSel(); });
    document.getElementById('rsc-del-sel')?.addEventListener('click', async () => {
      const ids = [...container.querySelectorAll('.rsc-chk:checked')].map(c=>c.dataset.id);
      if (!ids.length) return;
      App.data.revenue_server_checks = (App.data.revenue_server_checks||[]).filter(c=>!ids.includes(c.id));
      await App.saveKey('revenue_server_checks');
      this.render(container, actions);
    });
  },

  _buildRows(log, targetCA) {
    if (!log.length) return '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--t4);">No shift checks logged yet.</td></tr>';
    return log.map(c => {
      const ca   = c.covers>0 ? c.sales/c.covers : 0;
      const diff = ca - targetCA;
      const cls  = diff>=0?'badge-ok':diff>=-5?'badge-dim':'badge-warn';
      const status = diff>=0?'ON TARGET':diff>=-5?'WATCH':'BELOW STANDARD';
      return '<tr>'
        + '<td><input type="checkbox" class="rsc-chk" data-id="' + c.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
        + '<td>' + (c.date||'').slice(0,10) + '</td>'
        + '<td>' + esc(c.shift||'') + '</td>'
        + '<td>' + esc(c.server_name||'') + '</td>'
        + '<td class="val">' + App.fmtCurrency(ca) + '</td>'
        + '<td style="color:' + (diff>=0?'var(--gold)':diff>=-5?'var(--t2)':'var(--red)') + ';">' + (diff>=0?'+':'') + App.fmtCurrency(diff) + '</td>'
        + '<td><span class="badge ' + cls + '">' + status + '</span></td>'
        + '</tr>';
    }).join('');
  },

  calc() {
    const cov    = parseFloat(document.getElementById('rsc-cov')?.value)   || 0;
    const sales  = parseFloat(document.getElementById('rsc-sales')?.value) || 0;
    const target = App.data.revenue_settings?.targets?.check_avg || 35;
    const res    = document.getElementById('rsc-result');
    if (!res||cov===0) { if(res) res.style.display='none'; return; }
    res.style.display='block';
    const ca   = sales / cov;
    const diff = ca - target;
    let status, sBg, sColor, cColor;
    if (diff>=0)      { status='ON TARGET';          sBg='rgba(201,168,76,0.12)'; sColor='#C9A84C'; cColor='#C9A84C'; }
    else if (diff>=-5){ status='WATCH';              sBg='rgba(255,255,255,0.08)'; sColor='rgba(255,255,255,0.8)'; cColor='#fff'; }
    else              { status='BELOW STANDARD';     sBg='rgba(192,56,40,0.15)'; sColor='#C03828'; cColor='#C03828'; }
    const caEl=document.getElementById('rsc-ca'), vEl=document.getElementById('rsc-var'), bEl=document.getElementById('rsc-badge');
    if(caEl){caEl.textContent=App.fmtCurrency(ca);caEl.style.color=cColor;}
    if(vEl) {vEl.textContent=(diff>=0?'+':'')+App.fmtCurrency(diff);vEl.style.color=diff>=0?'#C9A84C':'#C03828';}
    if(bEl) {bEl.textContent=status;bEl.style.background=sBg;bEl.style.color=sColor;}
    this._calc={ca,diff,status};
  },

  save(container, actions) {
    if (!this._calc) return;
    const cov    = parseFloat(document.getElementById('rsc-cov')?.value)   || 0;
    const sales  = parseFloat(document.getElementById('rsc-sales')?.value) || 0;
    if (!cov||!sales) return;
    const entry = {
      id:          this._entryId,
      date:        document.getElementById('rsc-date')?.value||'',
      shift:       document.getElementById('rsc-shift')?.value||'',
      server_name: document.getElementById('rsc-server')?.value||'',
      covers:      cov, sales,
      saved_at:    new Date().toISOString()
    };
    if (!App.data.revenue_server_checks) App.data.revenue_server_checks=[];
    const idx = App.data.revenue_server_checks.findIndex(c=>c.id===entry.id);
    if (idx>-1) App.data.revenue_server_checks[idx]=entry;
    else App.data.revenue_server_checks.push(entry);
    App.saveKey('revenue_server_checks').then(() => {
      this._entryId = App.uid();
      const targetCA = App.data.revenue_settings?.targets?.check_avg||35;
      const log = (App.data.revenue_server_checks||[]).slice(-30).reverse();
      const tbody = document.getElementById('rsc-log');
      if (tbody) tbody.innerHTML = this._buildRows(log, targetCA);
    });
  }
};
