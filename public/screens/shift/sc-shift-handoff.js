'use strict';

/* ── Shift Control — Manager Shift Handoff Report ─────────────────────────────
   The shift-level equivalent of Month-End Books. Opens a styled one-page
   report in a new tab with revenue, cash recon, tip recon, exceptions, and
   handoff notes. Auto-fires window.print() for save-as-PDF. Top-of-page
   Email button packs the same content into a mailto so the closing manager
   can fire it to the opener and ownership.

   Triggered from:
   - Active Shift renderClosed (the "Print Handoff Report" button after close)
   - Shift History detail view (re-generate any past shift's handoff)

   Reads sc_shifts (with cash_recon and tip_recon blocks written by the
   Shift Close Wizard), sc_void_comps, sc_86_list, sc_maintenance,
   sc_checklists, lc_tips. */

S.ShiftHandoff = {
  openForShift(shiftId) {
    const shifts = ((App.shiftData && App.shiftData.sc_shifts) || []);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) {
      alert('Could not find that shift.');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      alert('Your browser blocked the new tab. Allow pop-ups for this site and try again.');
      return;
    }
    const html = this._buildReportHTML(shift);
    w.document.open();
    w.document.write(html);
    w.document.close();
  },

  fmtDate(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  },
  fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  // Pull every exception relevant to the next shift. Some (open 86s, open
  // maintenance) are still-active forward state. Others (big voids/comps,
  // closing checklist completion) are the closing manager's audit trail.
  _gatherExceptions(shift) {
    const eighty6 = ((App.shiftData && App.shiftData.sc_86_list) || []).filter(i => i.status !== 'Back');
    const vcThreshold = 30;
    const vc = ((App.shiftData && App.shiftData.sc_void_comps) || [])
      .filter(r => r.date === shift.date && (parseFloat(r.amount) || 0) >= vcThreshold);
    const openMaint = ((App.shiftData && App.shiftData.sc_maintenance) || []).filter(m => m.status !== 'Resolved');
    const closingCheck = ((App.shiftData && App.shiftData.sc_checklists) || [])
      .filter(c => c.date === shift.date && (c.type || '').toLowerCase().includes('clos'))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
    return { eighty6, vc, openMaint, closingCheck };
  },

  // Compact plain-text version of the report for the mailto body. Email
  // clients render mailto bodies as plain text, so HTML would not survive.
  _buildEmailBody(shift) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const cr = shift.cash_recon || {};
    const tr = shift.tip_recon  || {};
    const ex = this._gatherExceptions(shift);
    const checkAvg = (shift.covers && shift.covers > 0) ? (shift.total_revenue || 0) / shift.covers : null;
    const fmt$ = v => v == null ? '-' : '$' + Number(v).toFixed(2);
    const lines = [];
    lines.push(barName + ' - Shift Handoff');
    lines.push((shift.shift_type || 'Shift') + ' / ' + this.fmtDate(shift.date));
    lines.push('Closed by ' + (shift.manager || 'manager on duty') + (shift.closed_at ? ' at ' + this.fmtTime(shift.closed_at) : ''));
    lines.push('');
    lines.push('REVENUE');
    lines.push('  Total: ' + fmt$(shift.total_revenue) + (shift.covers ? '  /  Covers: ' + shift.covers : '') + (checkAvg ? '  /  Check Avg: ' + fmt$(checkAvg) : ''));
    lines.push('  Bar: ' + fmt$(shift.bar_revenue) + '   Floor: ' + fmt$(shift.floor_revenue));
    lines.push('');
    if (cr.skipped) {
      lines.push('CASH RECONCILIATION');
      lines.push('  Skipped this shift.');
    } else if (cr.variance != null) {
      const tol = App.cashToleranceForShift(shift);
      const status = Math.abs(cr.variance) <= tol ? 'WITHIN TOLERANCE' : cr.variance < 0 ? 'SHORT' : 'OVER';
      lines.push('CASH RECONCILIATION - ' + status);
      lines.push('  Opening Bank: ' + fmt$(cr.opening_bank) + '   Drops Out: ' + fmt$(cr.drops_total));
      lines.push('  POS Cash Sales: ' + fmt$(cr.sales_cash) + '   Counted: ' + fmt$(cr.counted_cash));
      lines.push('  Expected: ' + fmt$(cr.expected) + '   Variance: ' + (cr.variance >= 0 ? '+' : '') + fmt$(cr.variance));
    }
    lines.push('');
    if (tr.logged_total != null || tr.pos_reported != null) {
      lines.push('TIPS');
      lines.push('  Logged: ' + fmt$(tr.logged_total) + '   POS Reported: ' + fmt$(tr.pos_reported)
        + (tr.variance != null ? '   Variance: ' + (tr.variance >= 0 ? '+' : '') + fmt$(tr.variance) : ''));
      lines.push('');
    }
    lines.push('OPEN FOR THE NEXT SHIFT');
    if (ex.eighty6.length) {
      lines.push('  86\'d items (' + ex.eighty6.length + '):');
      ex.eighty6.slice(0, 8).forEach(i => lines.push('    - ' + (i.item || '(unnamed)') + (i.reason ? ' (' + i.reason + ')' : '')));
      if (ex.eighty6.length > 8) lines.push('    ...and ' + (ex.eighty6.length - 8) + ' more');
    } else {
      lines.push('  No 86\'d items.');
    }
    if (ex.openMaint.length) {
      lines.push('  Open maintenance (' + ex.openMaint.length + '):');
      ex.openMaint.slice(0, 6).forEach(m => lines.push('    - ' + (m.issue || m.item || 'Issue') + (m.priority ? ' [' + m.priority + ']' : '')));
      if (ex.openMaint.length > 6) lines.push('    ...and ' + (ex.openMaint.length - 6) + ' more');
    } else {
      lines.push('  No open maintenance.');
    }
    lines.push('');
    if (ex.vc.length) {
      const total = ex.vc.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
      lines.push('NOTABLE VOIDS / COMPS THIS SHIFT');
      lines.push('  ' + ex.vc.length + ' over $30 / ' + fmt$(total) + ' total');
      ex.vc.slice(0, 6).forEach(v => lines.push('    - ' + (v.type || '') + ': ' + (v.item || '') + ' ' + fmt$(v.amount) + (v.server ? ' (' + v.server + ')' : '')));
      lines.push('');
    }
    if (ex.closingCheck) {
      lines.push('CLOSING CHECKLIST: ' + (ex.closingCheck.completion_pct || 0) + '% complete');
      lines.push('');
    }
    if (shift.handoff_notes) {
      lines.push('NOTES FROM THE CLOSING MANAGER');
      lines.push('');
      lines.push(shift.handoff_notes);
      lines.push('');
    }
    lines.push('---');
    lines.push('Generated by Bar Cop. Numbers come from data logged during the shift.');
    return lines.join('\n');
  },

  _buildReportHTML(shift) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const cr = shift.cash_recon || {};
    const tr = shift.tip_recon  || {};
    const ex = this._gatherExceptions(shift);
    const checkAvg = (shift.covers && shift.covers > 0) ? (shift.total_revenue || 0) / shift.covers : null;
    const tol = App.cashToleranceForShift(shift);

    const fmt$ = v => v == null ? '<span class="muted">-</span>' : '$' + Number(v).toFixed(2);
    const num  = v => v == null ? '<span class="muted">-</span>' : String(v);
    const escH = (str) => String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Cash status badge
    let cashStatusBadge = '';
    if (cr.skipped) {
      cashStatusBadge = '<span class="badge badge-muted">SKIPPED</span>';
    } else if (cr.variance != null) {
      const ok = Math.abs(cr.variance) <= tol;
      const label = ok ? 'WITHIN TOLERANCE' : cr.variance < 0 ? 'SHORT' : 'OVER';
      cashStatusBadge = '<span class="badge ' + (ok ? 'badge-good' : 'badge-bad') + '">' + label + '</span>';
    }

    // Exception sections (only render if there's something to show, or render
    // an "all clear" line; the closing manager wants quick confirmation either
    // way).
    const exception86s = ex.eighty6.length === 0
      ? '<div class="empty-line">No 86\'d items. Floor is clean.</div>'
      : '<ul>' + ex.eighty6.map(i => '<li><strong>' + escH(i.item || '(unnamed)') + '</strong>'
          + (i.reason ? ' &mdash; ' + escH(i.reason) : '')
          + (i.date_86 ? ' <span class="muted">since ' + escH(i.date_86) + '</span>' : '')
          + '</li>').join('') + '</ul>';
    const exceptionMaint = ex.openMaint.length === 0
      ? '<div class="empty-line">No open maintenance issues.</div>'
      : '<ul>' + ex.openMaint.map(m => '<li><strong>' + escH(m.issue || m.item || 'Issue') + '</strong>'
          + (m.priority ? ' <span class="badge badge-tight">' + escH(m.priority) + '</span>' : '')
          + (m.location ? ' <span class="muted">' + escH(m.location) + '</span>' : '')
          + (m.notes ? '<div class="sub">' + escH(m.notes) + '</div>' : '')
          + '</li>').join('') + '</ul>';

    const vcSection = ex.vc.length === 0 ? '' : (() => {
      const total = ex.vc.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
      return '<h2>Notable Voids and Comps</h2>'
        + '<div class="meta">' + ex.vc.length + ' over $30 &middot; ' + fmt$(total) + ' total</div>'
        + '<ul>' + ex.vc.map(v => '<li><strong>' + escH(v.type || '') + ':</strong> ' + escH(v.item || '')
          + ' &mdash; ' + fmt$(v.amount)
          + (v.server ? ' <span class="muted">' + escH(v.server) + '</span>' : '')
          + (v.reason ? ' <span class="muted">(' + escH(v.reason) + ')</span>' : '')
          + '</li>').join('') + '</ul>';
    })();

    const checklistSection = ex.closingCheck
      ? '<h2>Closing Checklist</h2>'
        + '<div class="meta">' + (ex.closingCheck.completion_pct || 0) + '% complete'
        + (ex.closingCheck.completed_by ? ' &middot; ' + escH(ex.closingCheck.completed_by) : '') + '</div>'
      : '';

    const tipsSection = (tr.logged_total != null || tr.pos_reported != null)
      ? '<h2>Tip Reconciliation</h2>'
        + '<table>'
        + '<tr><td>Logged in Labor Control</td><td class="right">' + fmt$(tr.logged_total) + '</td></tr>'
        + '<tr><td>POS Reported</td><td class="right">' + fmt$(tr.pos_reported) + '</td></tr>'
        + (tr.variance != null
            ? '<tr><td class="bold">Variance</td><td class="right bold ' + (Math.abs(tr.variance) < 5 ? 'pos' : 'neg') + '">' + (tr.variance >= 0 ? '+' : '') + fmt$(tr.variance).replace('$', '$') + '</td></tr>'
            : '')
        + '</table>'
      : '';

    const cashSection = (cr.opening_bank != null || cr.counted_cash != null || cr.sales_cash != null) && !cr.skipped
      ? '<h2>Cash Reconciliation ' + cashStatusBadge + '</h2>'
        + '<table>'
        + '<tr><td>Opening Bank</td><td class="right">' + fmt$(cr.opening_bank) + '</td></tr>'
        + '<tr><td>+ POS Cash Sales</td><td class="right">' + fmt$(cr.sales_cash) + '</td></tr>'
        + '<tr><td>&minus; Drops Out</td><td class="right">' + fmt$(cr.drops_total) + '</td></tr>'
        + '<tr><td class="bold">Expected in Drawer</td><td class="right bold">' + fmt$(cr.expected) + '</td></tr>'
        + '<tr><td>Counted in Drawer</td><td class="right">' + fmt$(cr.counted_cash) + '</td></tr>'
        + '<tr><td class="bold">Variance</td><td class="right bold ' + (Math.abs(cr.variance || 0) <= tol ? 'pos' : 'neg') + '">' + (cr.variance >= 0 ? '+' : '') + fmt$(cr.variance).replace('$', '$') + '</td></tr>'
        + '</table>'
      : cr.skipped
        ? '<h2>Cash Reconciliation ' + cashStatusBadge + '</h2><div class="empty-line">Drawer was not counted this shift.</div>'
        : '';

    const handoffNotesSection = shift.handoff_notes
      ? '<h2>Notes for the Opener</h2>'
        + '<div class="notes">' + escH(shift.handoff_notes).replace(/\n/g, '<br/>') + '</div>'
      : '';

    const subj = 'Shift Handoff: ' + barName + ' / ' + (shift.shift_type || 'Shift') + ' / ' + this.fmtDate(shift.date);
    const mailto = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(this._buildEmailBody(shift));

    return '<!DOCTYPE html><html><head><meta charset="utf-8"/>'
      + '<title>' + escH(barName) + ' Shift Handoff &middot; ' + escH(this.fmtDate(shift.date)) + '</title>'
      + '<style>'
      + 'body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 7.5in; margin: 0.5in auto; padding: 0; line-height: 1.5; }'
      + 'h1 { font-family: Arial, Helvetica, sans-serif; font-size: 22px; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 4px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }'
      + 'h1 .sub { font-size: 13px; font-weight: normal; text-transform: none; letter-spacing: 0; color: #555; display: block; margin-top: 4px; }'
      + 'h2 { font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #8a6d00; margin: 22px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }'
      + 'table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 13px; }'
      + 'td { padding: 4px 6px; border-bottom: 1px solid #eee; }'
      + 'td.right { text-align: right; font-variant-numeric: tabular-nums; }'
      + 'td.bold { font-weight: bold; }'
      + '.pos { color: #1a7a1a; }'
      + '.neg { color: #a01818; }'
      + '.muted { color: #888; }'
      + '.meta { font-size: 12px; color: #555; margin-bottom: 8px; }'
      + 'ul { margin: 6px 0 6px 0; padding-left: 20px; font-size: 13px; }'
      + 'ul li { margin-bottom: 6px; }'
      + 'ul li .sub { font-size: 11px; color: #666; margin-top: 2px; }'
      + '.empty-line { font-size: 12px; color: #888; font-style: italic; padding: 2px 0 6px; }'
      + '.notes { font-size: 13px; color: #1a1a1a; background: #fdfaf0; border: 1px solid #e8d97a; padding: 12px 14px; border-radius: 3px; line-height: 1.6; }'
      + '.badge { display: inline-block; font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 1.5px; font-weight: bold; padding: 2px 8px; border-radius: 3px; }'
      + '.badge-good { background: #e3f3e3; color: #1a7a1a; border: 1px solid #1a7a1a; }'
      + '.badge-bad { background: #fce6e6; color: #a01818; border: 1px solid #a01818; }'
      + '.badge-muted { background: #efefef; color: #666; border: 1px solid #ccc; }'
      + '.badge-tight { background: #fdfaf0; color: #8a6d00; border: 1px solid #c9a900; font-size: 9px; padding: 1px 5px; }'
      + '.actions { padding: 12px 14px; background: #f4f1e8; border: 1px solid #c9a900; border-radius: 4px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }'
      + '.actions a { display: inline-block; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold; text-decoration: none; padding: 8px 14px; border: 1px solid #1a1a1a; border-radius: 3px; color: #1a1a1a; background: #fff; }'
      + '.actions a:hover { background: #1a1a1a; color: #fff; }'
      + '.actions .lbl { font-size: 12px; color: #555; font-family: Arial, sans-serif; }'
      + '.footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #ccc; font-size: 10px; color: #777; font-style: italic; line-height: 1.6; }'
      + '@media print { body { margin: 0.4in; } @page { margin: 0.4in; } .actions { display: none; } }'
      + '</style></head><body>'

      + '<div class="actions">'
      + '<span class="lbl">Print or email this handoff to the opening manager.</span>'
      + '<span>'
      + '<a href="#" onclick="window.print();return false;">Print or Save PDF</a>&nbsp;&nbsp;'
      + '<a href="' + mailto + '">Email Handoff</a>'
      + '</span>'
      + '</div>'

      + '<h1>' + escH(barName) + ' Shift Handoff'
      + '<span class="sub">' + escH(shift.shift_type || 'Shift') + ' &middot; ' + escH(this.fmtDate(shift.date))
      + (shift.manager ? ' &middot; Closed by ' + escH(shift.manager) : '')
      + (shift.closed_at ? ' at ' + escH(this.fmtTime(shift.closed_at)) : '')
      + '</span></h1>'

      + '<h2>Revenue</h2>'
      + '<table>'
      + '<tr><td>Bar Revenue</td><td class="right">' + fmt$(shift.bar_revenue) + '</td></tr>'
      + '<tr><td>Floor Revenue</td><td class="right">' + fmt$(shift.floor_revenue) + '</td></tr>'
      + '<tr><td class="bold">Total Revenue</td><td class="right bold">' + fmt$(shift.total_revenue) + '</td></tr>'
      + '<tr><td>Covers</td><td class="right">' + num(shift.covers) + '</td></tr>'
      + '<tr><td>Check Average</td><td class="right">' + fmt$(checkAvg) + '</td></tr>'
      + '</table>'

      + cashSection
      + tipsSection

      + '<h2>Open for the Next Shift</h2>'
      + '<div class="meta">86\'d items still out</div>'
      + exception86s
      + '<div class="meta" style="margin-top:10px;">Open maintenance issues</div>'
      + exceptionMaint

      + vcSection
      + checklistSection
      + handoffNotesSection

      + '<div class="footer">'
      + 'Generated by Bar Cop on ' + new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) + '. '
      + 'Numbers and exceptions come from what was logged during the shift. Hand this report to the opening manager so they walk in knowing what they inherit.'
      + '</div>'

      + '</body></html>';
  }
};
