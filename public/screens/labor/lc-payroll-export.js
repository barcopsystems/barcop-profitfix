'use strict';

/* ── Labor Control — Payroll Export ───────────────────────────────────────────
   A dedicated handoff screen, modeled on Month-End Books: pick a pay period
   (week), then download a formatted Excel workbook (establishment header,
   spaced columns, disclaimer) for a human to read, or a clean import CSV for a
   payroll provider that imports. All numbers come from what is logged in Labor
   Control via S.LaborPayPeriods.aggregateWeek (the one salary-aware payroll
   aggregation), so this screen never recomputes pay on its own.

   Salaried (exempt) staff show a fixed weekly salary with no overtime. This is
   a worksheet to hand to whoever runs payroll, not the official payroll record:
   the operator and their payroll provider are responsible for wage, hour,
   overtime, classification, and tax compliance. */

S.LaborPayrollExport = {
  PP() { return S.LaborPayPeriods; },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const pp = this.PP();
    if (pp.actuals().length === 0) {
      App.setupCard(this.container, {
        title: 'Payroll Export',
        lead: 'Payroll Export turns any pay period into a formatted workbook or a clean import file for whoever runs your payroll, built from what you log.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours feed each pay period. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }
    const today = App.todayLocal();
    const thisMon = pp.mondayOf(today);
    // Last 12 weeks, plus every saved closed period (even older than 12 weeks) so
    // an old period's payroll worksheet can still be re-exported. Newest first.
    const weeks = [];
    for (let i = 0; i < 12; i++) weeks.push(pp.addDays(thisMon, -7 * i));
    pp.periods().filter(p => p.status === 'Closed' && p.week_start && weeks.indexOf(p.week_start) < 0)
      .forEach(p => weeks.push(p.week_start));
    weeks.sort((a, b) => b.localeCompare(a));

    // Default to a deep-linked week from Pay Periods, else the most recent week
    // that has logged hours, else last week.
    let selected = (App._payrollFocusWeek && weeks.indexOf(App._payrollFocusWeek) > -1)
      ? App._payrollFocusWeek : null;
    App._payrollFocusWeek = null;
    if (!selected) {
      selected = weeks.find(ws => pp.aggregateWeek(ws).totalCount > 0) || weeks[1] || weeks[0];
    }

    const opts = weeks.map(ws => {
      const agg = pp.aggregateWeek(ws);
      const saved = pp.periods().find(p => p.week_start === ws);
      const closed = saved && saved.status === 'Closed' ? ' (Closed)' : '';
      const label = pp.fmtDate(ws) + ' to ' + pp.fmtDate(agg.weekEnd) + closed;
      return '<option value="' + ws + '"' + (ws === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="card form-card">'
        + '<div class="card-title">Payroll Export</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0;">'
          + '<div class="f" style="width:300px;"><label>Pay Period</label><select id="px-week">' + opts + '</select></div>'
        + '</div>'
        + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:18px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop assembles these numbers from what you log. It is a software tool, not a payroll provider, tax preparer, or legal advisor. Overtime eligibility, exempt and non-exempt classification, tip credit, and tax withholding are determined by you and your payroll provider. This is a worksheet, not your official payroll or timekeeping record. Verify every figure before running payroll.</div>'
        + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="px-xlsx">Download Workbook</button>'
        + '<button class="btn btn-ghost" id="px-csv">Download CSV</button>'
        + '<span id="px-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-left:6px;display:none;"></span>'
      + '</div>'
      + this._whatsInsideCard()
      + '</div>';

    document.getElementById('px-xlsx')?.addEventListener('click', () => this._startDownload('xlsx', document.getElementById('px-week')?.value));
    document.getElementById('px-csv')?.addEventListener('click', () => this._startDownload('csv', document.getElementById('px-week')?.value));
  },

  // The payroll worksheet download. NO acknowledgement popup (2026-07-30): this screen already
  // prints the full payroll disclaimer in its Heads Up box, and _downloadWorkbook writes it into
  // the sheet as three merged rows PLUS App.deliverableFooter()'s lines PLUS the workbook
  // Subject. The popup was a fifth copy of a paragraph visible on the page behind it, and
  // ToS §7 already says Bar Cop does not run payroll or cut paychecks.
  // ⚠⚠ THE "PERIOD NOT CLOSED" CONFIRM BELOW IS NOT A LEGAL ACK AND MUST STAY. It warns that
  //   hours can still change after the handoff, which is an operational fact about THIS week,
  //   not boilerplate. It was nested inside the old ack gate, which is exactly how removing a
  //   gate silently removes the warning with it — pinned by verify-export-notice-carried.js,
  //   which RUNS this handler across both period states.
  _startDownload(fmt, weekStart) {
    if (!weekStart) return;
    const pp = S.LaborPayPeriods;
    const saved = pp.periods().find(p => p.week_start === weekStart);
    const isClosed = saved && saved.status === 'Closed';
    const run = () => { if (fmt === 'xlsx') this._downloadWorkbook(weekStart); else this._downloadCSV(weekStart); };
    if (isClosed) { run(); return; }
    App.confirm({
      title: 'This period is not closed yet',
      message: 'This week has not been closed and locked in Pay Periods, so its hours and pay can still change after you export. Close it first for a clean payroll handoff, or export anyway.',
      confirmText: 'Export Anyway', cancelText: 'Cancel', danger: false
    }).then(ok => { if (ok) run(); });
  },

  showHowTo() {
    App.showHelpModal('How Payroll Export Works', [
      { p: ['Pick a pay period and Bar Cop pulls everyone\'s hours, overtime, tip share, and pay into one file you hand to whoever runs payroll. It is all built from what you log in Labor Control, so there is nothing to re-enter.'] },
      { h: 'Two Formats', p: ['Download the Workbook for a clean, readable Excel file with your establishment header and the disclaimer, made for a person to review. Download the CSV for a payroll system that imports a file, just the columns with no extra rows.'] },
      { h: 'Salaried Staff', p: ['Salaried staff show a fixed weekly salary, their annual divided by 52, with no overtime. Their logged hours appear as coverage only and do not drive pay.'] },
      { h: 'A Worksheet, Not The Record', p: ['Bar Cop is a software tool, not a payroll provider, tax preparer, or legal advisor. Overtime eligibility, exempt and non-exempt classification, tip credit, and tax withholding are determined by you and your payroll provider. Verify every figure before running payroll.'] }
    ]);
  },

  _setStatus(msg, color) {
    const el = document.getElementById('px-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || 'var(--t3)';
    el.style.display = 'block';
  },

  _whatsInsideCard() {
    const rows = [
      ['One row per employee', 'Name, position, and pay type, then the week\'s hours and pay.'],
      ['Hours and overtime', 'Regular hours, overtime hours over 40, and total hours worked.'],
      ['Pay', 'Wage rate, regular pay, overtime pay, tip share, and gross pay for the week.'],
      ['Salaried staff', 'Shown as a fixed weekly salary (annual divided by 52) with no overtime. Logged hours appear as coverage only.'],
      ['Tip credit check', 'For tipped roles, flags anyone whose wage plus tips fell below your state minimum so you can make up the difference before payroll runs.'],
      ['Totals', 'A bottom row totaling hours, overtime, and gross pay for the period.']
    ];
    const listHtml = rows.map(r =>
      '<tr><td style="padding:8px 0;font-weight:700;color:var(--t1);width:220px;vertical-align:top;font-size:12px;">' + esc(r[0]) + '</td>'
      + '<td style="padding:8px 0;color:var(--t2);font-size:12px;line-height:1.6;">' + esc(r[1]) + '</td></tr>'
    ).join('');
    return '<div class="card form-card">'
      + '<div class="card-title">What\'s In the File</div>'
      + '<table style="width:100%;border-collapse:collapse;"><tbody>' + listHtml + '</tbody></table>'
      + '</div>';
  },

  // ── Shared row builder (salary-aware via S.LaborPayPeriods) ───────────────
  // Returns { ws, we, header, rows, totals } where each row is an object with
  // typed fields so the workbook can write numbers and the CSV can format text.
  _data(weekStart) {
    const pp = this.PP();
    const agg = pp.aggregateWeek(weekStart);
    const stateMin = parseFloat((App.laborData?.settings || {}).state_min_wage);
    const stateMinValid = !isNaN(stateMin) && stateMin > 0;
    const rows = agg.rows.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(r => {
      const pos = pp.positionById(r.position_id);
      const tipped = !!(pos && pos.tipped) && !r.salaried;
      const tipShare = tipped ? pp.tipShareForStaffInWeek(r.staff_id, agg.weekStart, agg.weekEnd) : 0;
      if (r.salaried) {
        return {
          name: r.name, position: pos ? pos.name : '', payType: 'Salary',
          regHours: r.regular_hours, otHours: 0, totalHours: r.hours,   // show coverage hours so the column foots with the TOTAL row (matches the on-screen detail)
          rate: null, regPay: r.regular_cost, otPay: 0, tipShare: null, gross: r.gross,
          status: 'Salaried (exempt)', salaried: true
        };
      }
      // Straight-time wage + tips for the tip-credit test (not gross, which carries
      // the 1.5x OT premium and would mask a below-minimum shortfall).
      const effHourly = r.hours > 0 ? ((r.wage || 0) * r.hours + tipShare) / r.hours : 0;
      let status = '';
      if (tipped) {
        // Only judge below-minimum once tips for the week are actually recorded. With no
        // tips logged, tipShare is 0 and effHourly collapses to the bare cash wage (e.g.
        // $2.13), firing a false "BELOW: $X/hr owed" on the payroll worksheet a bookkeeper
        // acts on. Mirror the Pay Periods screen: prompt for tips instead of accusing.
        if (!stateMinValid) status = 'No state minimum wage set';
        else if (tipShare <= 0) status = 'Tips not recorded';
        else if (effHourly < stateMin) status = 'BELOW: $' + (stateMin - effHourly).toFixed(2) + '/hr owed';
        else status = 'OK';
      }
      return {
        name: r.name, position: pos ? pos.name : '', payType: 'Hourly',
        regHours: r.regular_hours, otHours: r.ot_hours, totalHours: r.hours,
        rate: r.wage, regPay: r.regular_cost, otPay: r.ot_cost,
        tipShare: tipped ? tipShare : null, gross: r.gross, status: status, salaried: false
      };
    });
    return { ws: agg.weekStart, we: agg.weekEnd, rows, totals: agg.totals, totalCount: agg.totalCount };
  },

  /* ⚠ "Gross Pay" IS WAGES, AND THE HEADER NOW SAYS SO (L10). Gross = Regular + OT and deliberately
     excludes Tip Share — the employer pays the wage, the tips are income the employee already
     received — which is the right side of the worksheet lane ([[payroll-legal-posture]]). But the
     bare word "Gross" invites a bookkeeper to read it as total taxable wages and wonder why the
     Tip Share beside it is not in the sum. Name the basis on the column rather than leave it to be
     inferred, the same fix the Labor cockpit's percentages needed. */
  _columns: ['Staff Name', 'Position', 'Pay Type', 'Regular Hours', 'OT Hours', 'Total Hours',
    'Wage Rate', 'Regular Pay', 'OT Pay', 'Tip Share', 'Gross Pay (wages only)', 'Status'],

  _fileBase(ws) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    return App.fileSafe(barName) + ' - Payroll Worksheet - ' + ws;
  },

  // ── Workbook (.xlsx) — formatted like Month-End Books ─────────────────────
  _downloadWorkbook(weekStart) {
    if (!weekStart) return;
    /* ⚠ THE HARD REFRESH, AND THE WAY OUT THAT IS ALREADY ON SCREEN. This read "Refresh and try
       again", and a plain reload keeps serving the cached script ([[hard-refresh]]) — which is the
       exact failure being reported, so it was advice that can quietly not work. It was also the only
       one of the five XLSX doors not saying Ctrl+Shift+R, and the only one with a working alternative
       sitting beside it (`px-csv` Download CSV, which needs no parser) that it never mentioned. */
    if (typeof XLSX === 'undefined') { this._setStatus(App.excelMissing('lc-payroll-export', 'use Download CSV instead'), 'var(--red)'); return; }
    const d = this._data(weekStart);
    if (!d.rows.length) { this._setStatus('No hours or salaried staff in this pay period.', 'var(--red)'); return; }
    try {
      const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
      const pp = this.PP();
      const COLS = this._columns;
      const N = COLS.length;
      const blank = () => { const r = []; for (let i = 0; i < N; i++) r.push(''); return r; };
      const line = (t) => { const r = [t]; for (let i = 1; i < N; i++) r.push(''); return r; };
      const aoa = [];
      const merges = [];
      const fullMerge = (rowIdx) => merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: N - 1 } });

      aoa.push(line(barName + ' - Payroll Worksheet')); fullMerge(aoa.length - 1);
      aoa.push(line('Pay Period: ' + pp.fmtDate(d.ws) + ' to ' + pp.fmtDate(d.we))); fullMerge(aoa.length - 1);
      aoa.push(line('Prepared ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' from Bar Cop Labor Control')); fullMerge(aoa.length - 1);
      aoa.push(blank());
      aoa.push(COLS.slice());
      const headerRow = aoa.length - 1;

      const num = (v) => (v == null ? '' : v);
      d.rows.forEach(r => {
        aoa.push([
          r.name, r.position, r.payType,
          num(r.regHours), num(r.otHours), num(r.totalHours),
          num(r.rate), num(r.regPay), num(r.otPay), num(r.tipShare), num(r.gross),
          r.status
        ]);
      });
      const dataStart = headerRow + 1;
      const dataEnd = aoa.length - 1;

      const t = d.totals;
      /* ⚠ TIP SHARE IS SUMMED FROM THE ROWS, NOT READ OFF `totals` (L10). `aggregateWeek` builds
         hours and pay; it has no tip_share, so `t.tip_share` would have been undefined and this
         cell would have stayed blank while looking fixed — a field written nowhere reads exactly
         like the bug it was meant to close ([[the-loop]] #25). It was the ONE numeric column with
         no total, on the worksheet a bookkeeper reconciles. */
      const tipTotal = (d.rows || []).reduce((s, r) => s + (Number(r.tipShare) || 0), 0);
      aoa.push(['TOTAL', '', '', t.regular_hours, t.ot_hours, t.hours, '', t.regular_cost, t.ot_cost, tipTotal, t.gross, '']);
      const totalRow = aoa.length - 1;

      this._pushFooter(aoa, merges, line, fullMerge);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const moneyFmt = '"$"#,##0.00';
      const hoursFmt = '0.00';
      const moneyCols = [6, 7, 8, 9, 10];
      const hoursCols = [3, 4, 5];
      for (let r = dataStart; r <= totalRow; r++) {
        moneyCols.forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && typeof cell.v === 'number') cell.z = moneyFmt; });
        hoursCols.forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && typeof cell.v === 'number') cell.z = hoursFmt; });
      }
      ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 9 }, { wch: 11 },
        { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 26 }];
      ws['!merges'] = merges;
      ws['!rows'] = [{ hpt: 22 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
      wb.Props = {
        Title: barName + ' - Payroll, ' + d.ws,
        Subject: App.deliverableFooter().workbookSubject,
        Author: barName, Company: 'Bar Cop', CreatedDate: new Date()
      };
      XLSX.writeFile(wb, this._fileBase(weekStart) + '.xlsx');
      this._setStatus('Downloaded ' + this._fileBase(weekStart) + '.xlsx', 'var(--gold)');
    } catch (e) {
      console.error('Payroll workbook error:', e);
      this._setStatus('Could not build the file: ' + (e?.message || 'unknown error'), 'var(--red)');
    }
  },

  // Footer rows: blank, source note, the payroll-specific line, then the
  // canonical deliverable disclaimer lines. Each line merged across the row.
  _pushFooter(aoa, merges, line, fullMerge) {
    aoa.push(line('')); // spacer
    aoa.push(line('Source: Labor Control hours and tip pools. Revenue and shifts from Shift Control.')); fullMerge(aoa.length - 1);
    // Split the payroll disclaimer across rows so each sentence fits the merged
    // width and reads in full without widening a column. The worksheet caveat
    // gets its own row so it is never clipped at the merge edge.
    aoa.push(line('Bar Cop is a software tool, not a payroll provider, tax preparer, or legal advisor.')); fullMerge(aoa.length - 1);
    aoa.push(line('Overtime eligibility, exempt and non-exempt classification, tip credit, and tax withholding are determined by you and your payroll provider.')); fullMerge(aoa.length - 1);
    aoa.push(line('This is a worksheet, not your official payroll record. Verify every figure before running payroll.')); fullMerge(aoa.length - 1);
    App.deliverableFooter().disclaimerLines.forEach(l => { aoa.push(line(l)); fullMerge(aoa.length - 1); });
  },

  // ── Import CSV — clean columns only, no header or disclaimer rows so a
  // payroll system can import it. The disclaimer lives on the page. ─────────
  _downloadCSV(weekStart) {
    if (!weekStart) return;
    const d = this._data(weekStart);
    if (!d.rows.length) { this._setStatus('No hours or salaried staff in this pay period.', 'var(--red)'); return; }
    const f2 = (v) => (v == null ? '' : Number(v).toFixed(2));
    // ⚠ THE COLUMN MUST FOOT. Every row prints rounded to cents, so the TOTAL has to be the sum of
    // those ROUNDED values — not a rounding of the unrounded sum, which missed the printed rows by
    // up to a cent per person and left a payroll worksheet that does not add up in front of whoever
    // runs the payroll. What is printed per person is what actually gets paid, so the rounded rows
    // are the truth and the total follows them.
    // ⚠ The XLSX deliberately does the OPPOSITE (full precision + a display format, which Excel sums
    // correctly and is proper spreadsheet practice). Do NOT align the two.
    const r2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
    const rows = d.rows.map(r => Object.assign({}, r, {
      regHours: r2(r.regHours), otHours: r2(r.otHours), totalHours: r2(r.totalHours),
      regPay: r2(r.regPay), otPay: r2(r.otPay), tipShare: r2(r.tipShare), gross: r2(r.gross)
    }));
    const dataRows = rows.map(r => [
      r.name, r.position, r.payType,
      f2(r.regHours), f2(r.otHours), f2(r.totalHours),
      f2(r.rate), f2(r.regPay), f2(r.otPay), f2(r.tipShare), f2(r.gross), r.status
    ]);
    const sum = (k) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
    dataRows.push(['TOTAL', '', '', f2(sum('regHours')), f2(sum('otHours')), f2(sum('totalHours')), '',
      f2(sum('regPay')), f2(sum('otPay')), f2(sum('tipShare')), f2(sum('gross')), '']);
    /* Excel and Google Sheets EVALUATE a cell that begins with `=`, `+`, `-` or `@` as a formula
       when the file opens, instead of showing it as text. This file carries the staff name,
       position, pay type and status exactly as the operator typed them, and it is the one export
       that goes to a payroll provider, so a name entered as "=cmd|..." would run rather than
       print. A leading apostrophe is the standard way to tell a spreadsheet "this is text".

       ⛔⛔ `-` IS ON THAT LIST AND THIS FILE IS FULL OF NEGATIVE NUMBERS. Prefixing every cell
       that starts with `-` would turn "-125.00" into text and the payroll provider's import would
       stop reading it as money, which is far worse than the exposure being closed. So the guard
       fires ONLY when the value is not a plain number. Pinned in verify-payroll-export-foots.js
       from both directions: the hostile cells get the apostrophe, and -125.00 must NOT. */
    const escapeCell = (v) => {
      let s = String(v == null ? '' : v);
      if (/^\s*[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s.trim())) s = "'" + s;
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [this._columns, ...dataRows].map(r => r.map(escapeCell).join(','));
    const csv = '﻿' + lines.join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this._fileBase(weekStart).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this._setStatus('Downloaded import CSV for ' + this.PP().fmtDate(d.ws) + ' to ' + this.PP().fmtDate(d.we), 'var(--gold)');
  }
};
