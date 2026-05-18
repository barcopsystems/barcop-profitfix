'use strict';
S.RevenueThisWeek = {
  step: 1,
  draft: null,
  container: null,

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    if (!this.draft) this.draft = this.loadDraft();
    this.renderStep(this.step);
  },

  loadDraft() {
    try {
      const r = localStorage.getItem('rf_draft');
      if (r) { const d = JSON.parse(r); this.step = d._step || 1; return d; }
    } catch(e) {}
    const weeks = App.data.revenue_weeks || [];
    const lastWeek = weeks.length ? weeks[weeks.length - 1] : null;
    return {
      _step: 1,
      week_num: (lastWeek?.week_num || 0) + 1,
      period_end: App.nextSunday ? App.nextSunday() : '',
      bar_revenue: '', floor_revenue: '', covers: '',
      bar_labor_hours: '', bar_labor_cost: '',
      kitchen_labor_hours: '', kitchen_labor_cost: '',
      floor_labor_hours: '', floor_labor_cost: '',
      rplh_lunch_rev: '', rplh_lunch_hrs: '',
      rplh_dinner_rev: '', rplh_dinner_hrs: '',
      rplh_bar_rev: '', rplh_bar_hrs: '',
      server_entries: [],
      notes: ''
    };
  },

  saveDraft() { this.draft._step = this.step; localStorage.setItem('rf_draft', JSON.stringify(this.draft)); },
  clearDraft() { localStorage.removeItem('rf_draft'); this.draft = null; this.step = 1; },

  renderStep(step) {
    this.step = step; this.saveDraft();
    document.getElementById('topbar-sub').textContent = 'Step ' + step + ' of 6';
    this.container.innerHTML = '<div class="screen">' + this.stepsHtml() + this.getStepHtml(step) + '</div>';
    this.wireStep(step);
  },

  stepsHtml() {
    const labels = ['Period','Revenue','Labor','RPLH','Servers','Review'];
    let h = '<div class="steps">';
    for (let i = 1; i <= 6; i++) {
      const cls = i < this.step ? 'done' : i === this.step ? 'active' : '';
      h += (i > 1 ? '<div class="step-line' + (i-1 < this.step ? ' done' : '') + '"></div>' : '') +
           '<div class="step-dot ' + cls + '">' + (i < this.step ? '✓' : i) + '</div>';
    }
    return h + '</div>';
  },

  getStepHtml(step) {
    switch(step) {
      case 1: return this.step1();
      case 2: return this.step2();
      case 3: return this.step3();
      case 4: return this.step4();
      case 5: return this.step5();
      case 6: return this.step6();
      default: return '';
    }
  },

  nav(showBack, showNext, saveLabel) {
    return '<div class="card-actions">'
      + (showBack ? '<button class="btn btn-ghost" id="rw-back">← Back</button>' : '')
      + (showNext && this.step < 6 ? '<button class="btn btn-primary" id="rw-next">Next →</button>' : '')
      + (saveLabel ? '<button class="btn btn-primary" id="rw-save">' + saveLabel + '</button>' : '')
      + '</div>';
  },

  step1() {
    return '<div class="card"><div class="sh">Step 1   Period Details</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:100px;"><label>Week #</label><input type="number" id="rw-wk" value="' + this.draft.week_num + '" min="1"/></div>'
      + '<div class="f" style="width:160px;"><label>Period End Date</label><input type="date" id="rw-end" value="' + this.draft.period_end + '"/></div>'
      + '</div>'
      + this.nav(false, true) + '</div>';
  },

  step2() {
    const t = App.data.revenue_settings?.targets || {};
    const targetCA = t.check_avg || 35;
    const barRev = parseFloat(this.draft.bar_revenue) || 0;
    const floorRev = parseFloat(this.draft.floor_revenue) || 0;
    const covers = parseFloat(this.draft.covers) || 0;
    const totalRev = barRev + floorRev;
    const checkAvg = covers > 0 ? (totalRev / covers) : 0;
    const caGap = checkAvg > 0 ? checkAvg - targetCA : 0;
    return '<div class="card"><div class="sh">Step 2   Revenue by Department</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Bar Revenue ' + tt('r-bar-revenue') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rw-brev" value="' + (this.draft.bar_revenue||'') + '" placeholder="0"/></div></div>'
      + '<div class="f w-md"><label>Floor Revenue ' + tt('r-floor-revenue') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rw-frev" value="' + (this.draft.floor_revenue||'') + '" placeholder="0"/></div></div>'
      + '<div class="f w-md"><label>Total Covers ' + tt('r-covers') + '</label><input type="number" id="rw-cov" value="' + (this.draft.covers||'') + '" placeholder="0"/></div>'
      + '</div>'
      + (totalRev > 0 && covers > 0 ? '<div style="background:var(--input);border-radius:6px;padding:12px 16px;display:flex;gap:24px;flex-wrap:wrap;">'
        + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Total Revenue</div><div style="font-size:18px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(totalRev) + '</div></div>'
        + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Check Average</div><div style="font-size:18px;font-weight:700;color:' + (caGap >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(checkAvg) + '</div></div>'
        + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">vs Target $' + targetCA + '</div><div style="font-size:18px;font-weight:700;color:' + (caGap >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (caGap >= 0 ? '+' : '') + App.fmtCurrency(caGap) + '</div></div>'
        + '</div>' : '')
      + this.nav(true, true) + '</div>';
  },

  step3() {
    const t = App.data.revenue_settings?.targets || {};
    const barRev   = parseFloat(this.draft.bar_revenue)   || 0;
    const floorRev = parseFloat(this.draft.floor_revenue) || 0;
    const depts = [
      { key: 'bar',     label: 'Bar',     rev: barRev,              target: t.bar_labor_pct || 28,     revLabel: 'Bar revenue' },
      { key: 'kitchen', label: 'Kitchen', rev: barRev + floorRev,   target: t.kitchen_labor_pct || 30, revLabel: 'Blended (bar + floor)' },
      { key: 'floor',   label: 'Floor',   rev: floorRev,            target: t.floor_labor_pct || 32,   revLabel: 'Floor revenue' },
    ];
    let rows = depts.map(d => {
      const hrs  = parseFloat(this.draft[d.key + '_labor_hours']) || 0;
      const cost = parseFloat(this.draft[d.key + '_labor_cost'])  || 0;
      const rev  = d.rev;
      const pct  = rev > 0 && cost > 0 ? (cost / rev * 100).toFixed(1) : null;
      const gap  = pct ? (parseFloat(pct) - d.target).toFixed(1) : null;
      return '<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--b2);">'
        + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + d.label + '   Target: ' + d.target + '%</div>'
        + '<div class="form-row" style="gap:16px;">'
        + '<div class="f w-md"><label>' + d.label + ' Labor Hours ' + tt('r-labor-hours') + '</label><input type="number" id="rw-' + d.key + '-hrs" value="' + (this.draft[d.key + '_labor_hours']||'') + '" placeholder="0"/></div>'
        + '<div class="f w-md"><label>' + d.label + ' Labor Cost ' + tt('r-labor-cost') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rw-' + d.key + '-cost" value="' + (this.draft[d.key + '_labor_cost']||'') + '" placeholder="0"/></div></div>'
        + (pct ? '<div class="f" style="width:120px;"><label>Labor %</label><div style="font-size:18px;font-weight:700;color:' + (parseFloat(gap) > 0 ? 'var(--red)' : 'var(--gold)') + ';padding-top:8px;">' + pct + '%<span style="font-size:11px;font-weight:400;color:' + (parseFloat(gap) > 0 ? 'var(--red)' : 'var(--gold)') + ';margin-left:6px;">' + (parseFloat(gap) > 0 ? '+' : '') + gap + ' pts</span></div></div>' : '')
        + '</div></div>';
    }).join('');
    return '<div class="card"><div class="sh">Step 3   Labor by Department</div>' + rows + this.nav(true, true) + '</div>';
  },

  step4() {
    const t = App.data.revenue_settings?.targets || {};
    const dayparts = [
      { key: 'lunch',  label: 'Lunch',  target: t.rplh_lunch  || 50 },
      { key: 'dinner', label: 'Dinner', target: t.rplh_dinner || 75 },
      { key: 'bar',    label: 'Bar',    target: t.rplh_bar    || 65 },
    ];
    let rows = dayparts.map(d => {
      const rev  = parseFloat(this.draft['rplh_' + d.key + '_rev']) || 0;
      const hrs  = parseFloat(this.draft['rplh_' + d.key + '_hrs']) || 0;
      const rplh = hrs > 0 && rev > 0 ? (rev / hrs) : null;
      const gap  = rplh ? rplh - d.target : null;
      return '<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--b2);">'
        + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + d.label + ' : Target: $' + d.target + ' RPLH ' + tt('r-rplh-target') + '</div>'
        + '<div class="form-row" style="gap:16px;">'
        + '<div class="f w-md"><label>' + d.label + ' Revenue ' + tt('r-daypart-rev') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rw-rplh-' + d.key + '-rev" value="' + (this.draft['rplh_' + d.key + '_rev']||'') + '" placeholder="0"/></div></div>'
        + '<div class="f w-md"><label>' + d.label + ' Labor Hours ' + tt('r-daypart-hrs') + '</label><input type="number" id="rw-rplh-' + d.key + '-hrs" value="' + (this.draft['rplh_' + d.key + '_hrs']||'') + '" placeholder="0"/></div>'
        + (rplh ? '<div class="f" style="width:140px;"><label>RPLH ' + tt('r-rplh') + '</label><div style="font-size:18px;font-weight:700;color:' + (gap >= 0 ? 'var(--gold)' : 'var(--red)') + ';padding-top:8px;">' + App.fmtCurrency(rplh) + '<span style="font-size:11px;font-weight:400;margin-left:6px;">' + (gap >= 0 ? '+' : '') + App.fmtCurrency(gap) + '</span></div></div>' : '')
        + '</div></div>';
    }).join('');
    return '<div class="card"><div class="sh">Step 4 : RPLH by Daypart</div>'
      + rows + this.nav(true, true) + '</div>';
  },

  step5() {
    const servers = App.data.revenue_settings?.servers || [];
    const t = App.data.revenue_settings?.targets || {};
    const targetCA = t.check_avg || 35;
    if (!servers.length) {
      return '<div class="card"><div class="empty"><div class="empty-title">No Servers on Roster</div>'
        + '<div class="empty-sub">Add servers in Settings first, then return to enter their performance data.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'r-settings\')">Go to Settings</button></div>'
        + '</div></div>' + this.nav(true, true);
    }
    if (!this.draft.server_entries || this.draft.server_entries.length !== servers.length) {
      this.draft.server_entries = servers.map(sv => ({ id: sv.id, name: sv.name, covers: '', sales: '' }));
    }
    const entries = this.draft.server_entries;
    const validEntries = entries.filter(e => parseFloat(e.covers) > 0 && parseFloat(e.sales) > 0);
    const teamAvg = validEntries.length ? validEntries.reduce((s,e) => s + parseFloat(e.sales)/parseFloat(e.covers), 0) / validEntries.length : null;

    const rows = entries.map((e, i) => {
      const covers = parseFloat(e.covers) || 0;
      const sales  = parseFloat(e.sales)  || 0;
      const ca     = covers > 0 && sales > 0 ? (sales / covers) : null;
      const vsTeam = ca && teamAvg ? ca - teamAvg : null;
      const vsTgt  = ca ? ca - targetCA : null;
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);flex-wrap:wrap;">'
        + '<div style="width:130px;font-size:12px;font-weight:700;color:var(--t1);flex-shrink:0;">' + esc(e.name) + '</div>'
        + '<div class="f" style="width:100px;"><label style="font-size:10px;">Covers</label><input type="number" class="rsv-cov" data-idx="' + i + '" value="' + (e.covers||'') + '" placeholder="0" style="padding:6px 8px;font-size:12px;"/></div>'
        + '<div class="f" style="width:110px;"><label style="font-size:10px;">Total Sales</label><div class="fw"><span class="pre">$</span><input class="pre rsv-sales" data-idx="' + i + '" type="number" value="' + (e.sales||'') + '" placeholder="0" style="font-size:12px;"/></div></div>'
        + (ca ? '<div style="min-width:80px;"><div style="font-size:10px;color:var(--t3);">Check Avg</div><div style="font-size:14px;font-weight:700;color:' + (vsTgt >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(ca) + '</div></div>' : '')
        + (vsTeam != null ? '<div style="min-width:80px;"><div style="font-size:10px;color:var(--t3);">vs Team</div><div style="font-size:12px;color:' + (vsTeam >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (vsTeam >= 0 ? '+' : '') + App.fmtCurrency(vsTeam) + '</div></div>' : '')
        + '</div>';
    }).join('');

    return '<div class="card"><div class="sh">Step 5 : Server Performance</div>'
      + (teamAvg ? '<div style="background:var(--input);border-radius:6px;padding:10px 16px;margin-bottom:14px;font-size:12px;color:var(--t2);">Team check average this week: <strong style="color:var(--t1);">' + App.fmtCurrency(teamAvg) + '</strong> vs target $' + targetCA + '</div>' : '')
      + rows + this.nav(true, true) + '</div>';
  },

  step6() {
    const d = this.draft;
    const t = App.data.revenue_settings?.targets || {};
    const barRev   = parseFloat(d.bar_revenue)   || 0;
    const floorRev = parseFloat(d.floor_revenue) || 0;
    const covers   = parseFloat(d.covers)        || 0;
    const totalRev = barRev + floorRev;
    const checkAvg = covers > 0 ? totalRev / covers : 0;
    const targetCA = t.check_avg || 35;
    const annualGap = covers > 0 ? (checkAvg - targetCA) * covers * 52 : 0;

    const totalLaborCost = (parseFloat(d.bar_labor_cost)||0) + (parseFloat(d.kitchen_labor_cost)||0) + (parseFloat(d.floor_labor_cost)||0);
    const laborPct = totalRev > 0 && totalLaborCost > 0 ? (totalLaborCost / totalRev * 100).toFixed(1) : null;

    const totalHrs = (parseFloat(d.bar_labor_hours)||0) + (parseFloat(d.kitchen_labor_hours)||0) + (parseFloat(d.floor_labor_hours)||0);
    const rplh = totalHrs > 0 && totalRev > 0 ? (totalRev / totalHrs).toFixed(2) : null;

    const validServers = (d.server_entries||[]).filter(e => parseFloat(e.covers) > 0 && parseFloat(e.sales) > 0);
    const teamAvg = validServers.length ? validServers.reduce((s,e) => s + parseFloat(e.sales)/parseFloat(e.covers), 0) / validServers.length : null;

    const row = (label, val, sub) => '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="font-size:12px;color:var(--t2);">' + label + '</div>'
      + '<div style="text-align:right;"><div style="font-size:13px;font-weight:700;color:var(--t1);">' + val + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);">' + sub + '</div>' : '')
      + '</div></div>';

    return '<div class="card"><div class="sh">Step 6   Review and Save</div>'
      + row('Week', 'Week ' + d.week_num, d.period_end)
      + row('Bar Revenue', App.fmtCurrency(barRev), '')
      + row('Floor Revenue', App.fmtCurrency(floorRev), '')
      + row('Total Revenue', App.fmtCurrency(totalRev), '')
      + row('Covers', covers || ' ', '')
      + row('Check Average', checkAvg ? App.fmtCurrency(checkAvg) : ' ', 'Target $' + targetCA)
      + (annualGap !== 0 ? row('Annual Check Avg Gap', App.fmtCurrency(Math.abs(annualGap)), annualGap >= 0 ? 'above target' : 'below target   recoverable') : '')
      + row('Total Labor Cost', App.fmtCurrency(totalLaborCost), '')
      + (laborPct ? row('Blended Labor %', laborPct + '%', '') : '')
      + (rplh ? row('Blended RPLH', App.fmtCurrency(parseFloat(rplh)), '') : '')
      + (teamAvg ? row('Team Check Average', App.fmtCurrency(teamAvg), validServers.length + ' servers') : '')
      + this.nav(true, false, 'Save Week')
      + '</div>';
  },

  wireStep(step) {
    document.getElementById('rw-back')?.addEventListener('click', () => {
      this.collectStep(step);
      this.renderStep(step - 1);
    });
    document.getElementById('rw-next')?.addEventListener('click', () => {
      this.collectStep(step);
      this.renderStep(step + 1);
    });
    document.getElementById('rw-save')?.addEventListener('click', () => {
      this.collectStep(step);
      this.saveWeek();
    });

    // Live recalc on step 2
    if (step === 2) {
      ['rw-brev','rw-frev','rw-cov'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
          this.collectStep(2);
          const html = this.step2();
          const card = this.container.querySelector('.card');
          if (card) card.outerHTML = html;
          this.wireStep(2);
        });
      });
    }

    // Server entries
    if (step === 5) {
      this.container.querySelectorAll('.rsv-cov,.rsv-sales').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.idx);
          if (inp.classList.contains('rsv-cov'))   this.draft.server_entries[idx].covers = inp.value;
          if (inp.classList.contains('rsv-sales'))  this.draft.server_entries[idx].sales  = inp.value;
          this.saveDraft();
        });
      });
    }
  },

  collectStep(step) {
    const g = id => document.getElementById(id)?.value || '';
    if (step === 1) {
      this.draft.week_num   = parseInt(g('rw-wk')) || this.draft.week_num;
      this.draft.period_end = g('rw-end');
    }
    if (step === 2) {
      this.draft.bar_revenue   = g('rw-brev');
      this.draft.floor_revenue = g('rw-frev');
      this.draft.covers        = g('rw-cov');
    }
    if (step === 3) {
      ['bar','kitchen','floor'].forEach(k => {
        this.draft[k + '_labor_hours'] = g('rw-' + k + '-hrs');
        this.draft[k + '_labor_cost']  = g('rw-' + k + '-cost');
      });
    }
    if (step === 4) {
      ['lunch','dinner','bar'].forEach(k => {
        this.draft['rplh_' + k + '_rev'] = g('rw-rplh-' + k + '-rev');
        this.draft['rplh_' + k + '_hrs'] = g('rw-rplh-' + k + '-hrs');
      });
    }
    this.saveDraft();
  },

  async saveWeek() {
    const d = this.draft;
    const barRev       = parseFloat(d.bar_revenue)       || 0;
    const floorRev     = parseFloat(d.floor_revenue)     || 0;
    const covers       = parseFloat(d.covers)            || 0;
    const totalRev     = barRev + floorRev;

    if (totalRev === 0) {
      alert('Bar revenue and floor revenue are both zero. Enter at least one revenue figure before saving.');
      return;
    }

    const checkAvg     = covers > 0 ? totalRev / covers : 0;

    const barLaborCost     = parseFloat(d.bar_labor_cost)     || 0;
    const kitchenLaborCost = parseFloat(d.kitchen_labor_cost) || 0;
    const floorLaborCost   = parseFloat(d.floor_labor_cost)   || 0;
    const totalLaborCost   = barLaborCost + kitchenLaborCost + floorLaborCost;
    const laborPctBlended  = totalRev > 0 ? totalLaborCost / totalRev * 100 : 0;

    const barLaborHrs     = parseFloat(d.bar_labor_hours)     || 0;
    const kitchenLaborHrs = parseFloat(d.kitchen_labor_hours) || 0;
    const floorLaborHrs   = parseFloat(d.floor_labor_hours)   || 0;
    const totalHrs        = barLaborHrs + kitchenLaborHrs + floorLaborHrs;
    const rplhBlended     = totalHrs > 0 ? totalRev / totalHrs : 0;

    const rplhLunch  = parseFloat(d.rplh_lunch_hrs)  > 0 ? (parseFloat(d.rplh_lunch_rev)  || 0) / parseFloat(d.rplh_lunch_hrs)  : 0;
    const rplhDinner = parseFloat(d.rplh_dinner_hrs) > 0 ? (parseFloat(d.rplh_dinner_rev) || 0) / parseFloat(d.rplh_dinner_hrs) : 0;
    const rplhBar    = parseFloat(d.rplh_bar_hrs)    > 0 ? (parseFloat(d.rplh_bar_rev)    || 0) / parseFloat(d.rplh_bar_hrs)    : 0;

    const week = {
      id:               App.uid(),
      week_num:         parseInt(d.week_num) || 1,
      period_end:       d.period_end,
      bar_revenue:      barRev,
      floor_revenue:    floorRev,
      covers:           covers,
      check_avg:        parseFloat(checkAvg.toFixed(2)),
      bar_labor_hours:  barLaborHrs,
      bar_labor_cost:   barLaborCost,
      kitchen_labor_hours: kitchenLaborHrs,
      kitchen_labor_cost:  kitchenLaborCost,
      floor_labor_hours:   floorLaborHrs,
      floor_labor_cost:    floorLaborCost,
      total_labor_cost:    totalLaborCost,
      total_hours:         totalHrs,
      labor_pct_blended:   parseFloat(laborPctBlended.toFixed(2)),
      rplh_blended:        parseFloat(rplhBlended.toFixed(2)),
      rplh_lunch:          parseFloat(rplhLunch.toFixed(2)),
      rplh_dinner:         parseFloat(rplhDinner.toFixed(2)),
      rplh_bar:            parseFloat(rplhBar.toFixed(2)),
      server_entries:      d.server_entries || [],
      notes:               d.notes || '',
      saved_at:            new Date().toISOString()
    };

    if (!App.data.revenue_weeks) App.data.revenue_weeks = [];
    App.data.revenue_weeks.push(week);
    await App.saveKey('revenue_weeks');
    this.clearDraft();
    App.navigate('r-dashboard');
  }
};
