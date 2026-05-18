'use strict';
S.RevenueServerCheck = {
  render(container, actions) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Shift Check';
    addBtn.addEventListener('click', () => this.showForm(container, actions));
    actions.appendChild(addBtn);
    this.renderList(container, actions);
  },

  renderList(container, actions) {
    const checks  = (App.data.revenue_server_checks || []).slice().reverse().slice(0, 30);
    const servers  = App.data.revenue_settings?.servers || [];
    const t        = App.data.revenue_settings?.targets || {};
    const targetCA = t.check_avg || 35;
    const weeks    = App.data.revenue_weeks || [];
    // 4-week team average from saved weeks
    const recent4 = weeks.slice(-4);
    const teamAvg4 = recent4.length
      ? recent4.reduce((s,w) => s + (w.check_avg||0), 0) / recent4.length
      : null;

    const statusBadge = (ca) => {
      const diff = ca - targetCA;
      if (diff >= 0)   return '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:2px;background:rgba(201,168,76,0.15);color:var(--gold);">ON TARGET</span>';
      if (diff >= -5)  return '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:2px;background:rgba(208,128,8,0.15);color:#D08008;">WATCH</span>';
      return '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:2px;background:rgba(192,56,40,0.15);color:var(--red);">BELOW STANDARD</span>';
    };

    const rows = checks.map(c => {
      const ca = c.covers > 0 ? (c.sales / c.covers) : 0;
      return '<tr>'
        + '<td>' + (c.date||'').slice(0,10) + '</td>'
        + '<td>' + esc(c.shift||'') + '</td>'
        + '<td>' + esc(c.server_name||'') + '</td>'
        + '<td>' + (c.covers||'—') + '</td>'
        + '<td class="val">' + (ca > 0 ? App.fmtCurrency(ca) : '—') + '</td>'
        + '<td>' + statusBadge(ca) + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--t3);text-align:center;padding:14px;">No shift checks logged yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;">'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Check Avg Target</div><div style="font-size:22px;font-weight:800;color:var(--t1);">$' + targetCA + '</div></div>'
      + (teamAvg4 ? '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">4-Week Team Avg</div><div style="font-size:22px;font-weight:800;color:' + (teamAvg4 >= targetCA ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(teamAvg4) + '</div></div>' : '')
      + '</div></div>'
      + '<div class="sh">Last 30 Shift Checks</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Server</th><th>Covers</th><th>Check Avg</th><th>Status</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  },

  showForm(container, actions) {
    const servers  = App.data.revenue_settings?.servers || [];
    const t        = App.data.revenue_settings?.targets || {};
    const targetCA = t.check_avg || 35;
    const serverOpts = servers.map(s => '<option value="' + esc(s.name) + '">' + esc(s.name) + '</option>').join('');

    const today = new Date().toISOString().slice(0,10);

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">Log Shift Check</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Date</label><input type="date" id="rsc-date" value="' + today + '"/></div>'
      + '<div class="f w-md"><label>Shift</label><select id="rsc-shift" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option>Lunch</option><option>Dinner</option><option>Bar</option></select></div>'
      + '<div class="f w-md"><label>Server</label><select id="rsc-server" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;">' + (serverOpts || '<option>No servers — add in Settings</option>') + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Covers Served</label><input type="number" id="rsc-cov" placeholder="0"/></div>'
      + '<div class="f w-md"><label>Total Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsc-sales" placeholder="0"/></div></div>'
      + '</div>'
      + '<div id="rsc-result" style="margin-bottom:16px;"></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-primary" id="rsc-save">Save Shift Check</button>'
      + '<button class="btn btn-ghost" id="rsc-cancel">Cancel</button>'
      + '</div>'
      + '</div></div>';

    const calc = () => {
      const cov   = parseFloat(document.getElementById('rsc-cov')?.value)   || 0;
      const sales = parseFloat(document.getElementById('rsc-sales')?.value) || 0;
      const ca    = cov > 0 && sales > 0 ? sales / cov : 0;
      const el    = document.getElementById('rsc-result');
      if (!el || !ca) return;
      const diff  = ca - targetCA;
      const status = diff >= 0 ? 'ON TARGET' : diff >= -5 ? 'WATCH' : 'BELOW STANDARD';
      const col    = diff >= 0 ? 'var(--gold)' : diff >= -5 ? '#D08008' : 'var(--red)';
      el.innerHTML = '<div style="background:var(--input);border-radius:6px;padding:12px 16px;display:flex;gap:20px;flex-wrap:wrap;">'
        + '<div><div style="font-size:10px;color:var(--t3);">Check Average</div><div style="font-size:20px;font-weight:800;color:' + col + ';">' + App.fmtCurrency(ca) + '</div></div>'
        + '<div><div style="font-size:10px;color:var(--t3);">vs Target</div><div style="font-size:16px;font-weight:700;color:' + col + ';">' + (diff >= 0 ? '+' : '') + App.fmtCurrency(diff) + '</div></div>'
        + '<div><div style="font-size:10px;color:var(--t3);">Status</div><div style="font-size:13px;font-weight:700;color:' + col + ';">' + status + '</div></div>'
        + '</div>';
    };

    ['rsc-cov','rsc-sales'].forEach(id => document.getElementById(id)?.addEventListener('input', calc));

    document.getElementById('rsc-cancel')?.addEventListener('click', () => this.render(container, actions));
    document.getElementById('rsc-save')?.addEventListener('click', async () => {
      const cov   = parseFloat(document.getElementById('rsc-cov')?.value)   || 0;
      const sales = parseFloat(document.getElementById('rsc-sales')?.value) || 0;
      if (!cov || !sales) return;
      const entry = {
        id:          App.uid(),
        date:        document.getElementById('rsc-date')?.value,
        shift:       document.getElementById('rsc-shift')?.value,
        server_name: document.getElementById('rsc-server')?.value,
        covers:      cov,
        sales:       sales,
        saved_at:    new Date().toISOString()
      };
      if (!App.data.revenue_server_checks) App.data.revenue_server_checks = [];
      App.data.revenue_server_checks.push(entry);
      await App.saveKey('revenue_server_checks');
      this.render(container, actions);
    });
  }
};
