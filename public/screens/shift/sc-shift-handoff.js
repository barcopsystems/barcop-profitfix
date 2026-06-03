'use strict';

/* ── Shift Control — Manager Shift Handoff Report ─────────────────────────────
   The shift-level equivalent of Month-End Books. Builds a clean one-page PDF
   (revenue, cash recon, tip recon, exceptions, handoff notes) from the shift
   data via the shared App._pdfBuilder, saved straight to a file. An Email
   Handoff button packs the same content into a mailto so the closing manager
   can fire it to the opener and ownership.

   Triggered from:
   - Active Shift renderClosed (Save Handoff PDF / Email Handoff buttons after close)
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
    this.exportPDF(shift);
  },

  // Fire the handoff to the opener/ownership as a pre-filled email. Mailto bodies
  // render as plain text, so this uses _buildEmailBody (not the PDF/HTML report).
  emailForShift(shiftId) {
    const shifts = ((App.shiftData && App.shiftData.sc_shifts) || []);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) { alert('Could not find that shift.'); return; }
    const barName = (App.data && App.data.settings && App.data.settings.bar_name) || 'Bar Cop';
    const subj = 'Shift Handoff: ' + barName + ' / ' + (shift.shift_type || 'Shift') + ' / ' + this.fmtDate(shift.date);
    window.location.href = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(this._buildEmailBody(shift));
  },

  // Data-driven jsPDF handoff. Same sections as the legacy print HTML, built
  // through the shared App._pdfBuilder so it saves straight to a PDF (no print
  // preview). The mailto path (_buildEmailBody) is untouched.
  async exportPDF(shift) {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    const cr = shift.cash_recon || {};
    const tr = shift.tip_recon  || {};
    const ex = this._gatherExceptions(shift);
    const checkAvg = (shift.covers && shift.covers > 0) ? (shift.total_revenue || 0) / shift.covers : null;
    const tol = App.cashToleranceForShift(shift);
    const fmt$ = v => v == null ? '-' : '$' + Number(v).toFixed(2);
    const num  = v => v == null ? '-' : String(v);

    const metaBits = [shift.shift_type || 'Shift', this.fmtDate(shift.date)];
    if (shift.manager) metaBits.push('Closed by ' + shift.manager + (shift.closed_at ? ' at ' + this.fmtTime(shift.closed_at) : ''));

    const b = App._pdfBuilder('Shift Handoff');
    b.header({ right: 'Shift Handoff', meta: metaBits.join('   |   ') });

    // ── Revenue ──
    b.sectionTitle('Revenue');
    b.table(null, [
      ['Bar Revenue', fmt$(shift.bar_revenue)],
      ['Floor Revenue', fmt$(shift.floor_revenue)],
      ['Total Revenue', fmt$(shift.total_revenue)],
      ['Covers', num(shift.covers)],
      ['Check Average', fmt$(checkAvg)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    // ── Cash Reconciliation ──
    if (cr.skipped) {
      b.sectionTitle('Cash Reconciliation (Skipped)');
      b.paragraph('Drawers were not counted this shift.', { italic: true, gray: 130 });
    } else if (Array.isArray(cr.drawers) && cr.drawers.length) {
      const okTotal = cr.variance == null ? true : Math.abs(cr.variance) <= tol;
      const statusTotal = cr.variance == null ? '' : okTotal ? 'Within Tolerance' : cr.variance < 0 ? 'Short' : 'Over';
      b.sectionTitle('Cash Reconciliation' + (statusTotal ? ' (' + statusTotal + ')' : ''));
      const vstr = vr => vr != null ? ((vr >= 0 ? '+' : '') + fmt$(vr)) : '-';
      const rows = cr.drawers.map(c => [
        c.name || 'Register', fmt$(c.opening_bank), fmt$(c.drops_total),
        c.sales_cash != null ? fmt$(c.sales_cash) : '-', fmt$(c.expected),
        c.counted_cash != null ? fmt$(c.counted_cash) : '-', vstr(c.variance)
      ]);
      rows.push(['Total', fmt$(cr.opening_bank), fmt$(cr.drops_total),
        cr.sales_cash != null ? fmt$(cr.sales_cash) : '-', fmt$(cr.expected),
        cr.counted_cash != null ? fmt$(cr.counted_cash) : '-', vstr(cr.variance)]);
      b.table(['Drawer', 'Opening', 'Drops', 'POS Cash', 'Expected', 'Counted', 'Variance'], rows,
        { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } } });
    } else if (cr.opening_bank != null || cr.counted_cash != null || cr.sales_cash != null) {
      const ok = cr.variance == null ? true : Math.abs(cr.variance) <= tol;
      const status = cr.variance == null ? '' : ok ? 'Within Tolerance' : cr.variance < 0 ? 'Short' : 'Over';
      b.sectionTitle('Cash Reconciliation' + (status ? ' (' + status + ')' : ''));
      b.table(null, [
        ['Opening Bank', fmt$(cr.opening_bank)],
        ['+ POS Cash Sales', fmt$(cr.sales_cash)],
        ['- Drops Out', fmt$(cr.drops_total)],
        ['Expected in Drawer', fmt$(cr.expected)],
        ['Counted in Drawer', fmt$(cr.counted_cash)],
        ['Variance', (cr.variance != null && cr.variance >= 0 ? '+' : '') + fmt$(cr.variance)]
      ], { columnStyles: { 1: { halign: 'right' } } });
    }

    // ── Tip Reconciliation ──
    if (tr.logged_total != null || tr.pos_reported != null) {
      b.sectionTitle('Tip Reconciliation');
      const tipRows = [
        ['Logged in Labor Control', fmt$(tr.logged_total)],
        ['POS Reported', fmt$(tr.pos_reported)]
      ];
      if (tr.variance != null) tipRows.push(['Variance', (tr.variance >= 0 ? '+' : '') + fmt$(tr.variance)]);
      b.table(null, tipRows, { columnStyles: { 1: { halign: 'right' } } });
    }

    // ── Open for the Next Shift ──
    b.sectionTitle('Open for the Next Shift');
    b.paragraph("86'd items still out", { gray: 90 });
    if (!ex.eighty6.length) {
      b.paragraph("No 86'd items. Floor is clean.", { italic: true, gray: 130 });
    } else {
      b.table(['Item', 'Reason', 'Since'], ex.eighty6.map(i => [
        i.item || '(unnamed)', i.reason || '-', i.date_86 || '-'
      ]));
    }
    b.paragraph('Open maintenance issues', { gray: 90 });
    if (!ex.openMaint.length) {
      b.paragraph('No open maintenance issues.', { italic: true, gray: 130 });
    } else {
      b.table(['Issue', 'Priority', 'Location', 'Notes'], ex.openMaint.map(m => [
        m.issue || m.item || 'Issue', m.priority || '-', m.location || '-', m.notes || '-'
      ]));
    }

    // ── Notable Voids and Comps ──
    if (ex.vc.length) {
      const total = ex.vc.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
      b.sectionTitle('Notable Voids and Comps');
      b.paragraph(ex.vc.length + ' over $30  |  ' + fmt$(total) + ' total', { gray: 90 });
      b.table(['Type', 'Item', 'Amount', 'Server', 'Reason'], ex.vc.map(v => [
        v.type || '-', v.item || '-', fmt$(v.amount), v.server || '-', v.reason || '-'
      ]), { columnStyles: { 2: { halign: 'right' } } });
    }

    // ── Closing Checklist ──
    if (ex.closingCheck) {
      const pct = ex.closingCheck.total_count ? Math.round((ex.closingCheck.done_count || 0) / ex.closingCheck.total_count * 100) : 0;
      b.sectionTitle('Closing Checklist');
      b.paragraph(pct + '% complete' + (ex.closingCheck.completed_by ? '  |  ' + ex.closingCheck.completed_by : ''), { gray: 90 });
    }

    // ── Shift Notes ──
    const shiftNotesList = Array.isArray(shift.shift_notes) ? shift.shift_notes : [];
    if (shiftNotesList.length) {
      b.sectionTitle('Shift Notes');
      b.table(['Time', 'Note'], shiftNotesList.map(n => [
        this.fmtTime(n.at), n.text || ''
      ]));
    }

    // ── Notes for the Opener ──
    if (shift.handoff_notes) {
      b.sectionTitle('Notes for the Opener');
      b.paragraph(shift.handoff_notes);
    }

    b.spacer(4);
    b.paragraph('Numbers and exceptions come from what was logged during the shift. Hand this report to '
      + 'the opening manager so they walk in knowing what they inherit.', { italic: true, gray: 130, size: 8 });

    const ds = /^\d{4}-\d{2}-\d{2}$/.test(shift.date || '') ? shift.date.replace(/-/g, '') : App._pdfDateStamp();
    await b.save('BarCop_ShiftHandoff_' + ds + '.pdf');
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
      lines.push('CLOSING CHECKLIST: ' + (ex.closingCheck.total_count ? Math.round((ex.closingCheck.done_count || 0) / ex.closingCheck.total_count * 100) : 0) + '% complete');
      lines.push('');
    }
    const sNotes = Array.isArray(shift.shift_notes) ? shift.shift_notes : [];
    if (sNotes.length) {
      lines.push('SHIFT NOTES');
      lines.push('');
      sNotes.forEach(n => {
        const t = n.at ? new Date(n.at) : null;
        const time = t && !isNaN(t.getTime()) ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
        lines.push('  ' + (time ? time + ' ' : '') + (n.text || ''));
      });
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
};
