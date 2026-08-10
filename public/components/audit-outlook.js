'use strict';

/* ── Bar Cop Briefing — shared audit narrative helper ─────────────────────────
   One home for the operator-voice paragraph that goes on every audit detail
   page. The button mounts inside the audit detail header card next to the
   score. On click the API call fires, the button shows "Analyzing...", and
   the paragraphs render in a popup modal layered over the audit (mirroring
   the Trend Insights pattern on the Recovery dashboards so the audit detail
   page itself does not overflow with text).

   Caches the rendered HTML per audit id for the session. Re-clicks open the
   cached modal instantly without re-spending API tokens.

   Replaces the equivalent Outlook plumbing that used to live inside the
   killed audit-diff.js Compare Other Audits modal. All four audits (Profit,
   Revenue, Cash, Bar Cop Audit) call AuditOutlook.attach() from inside
   their audit detail header card. */

window.AuditOutlook = {




  /* Mount the Outlook button into the given container element. Wires the
     click handler. Button-only, no inline text body — the paragraph renders
     in a popup modal on click so the audit header card never overflows.

     containerEl  — DOM node where the button should render
     audit        — the audit record (uses audit_id, date, overall_score,
                    sections, action_items)
     auditType    — one of 'profit', 'revenue', 'cash', 'bar-cop'
     opts         — { compact: true } shrinks button padding for headers
                    where space is tight                                        */
  attach(containerEl, audit, auditType, opts) {
    if (!containerEl || !audit) return;
    opts = opts || {};
    const btnId = 'ao-btn-' + auditType;
    const btnStyle = opts.compact
      ? 'font-size:10px;padding:5px 12px;letter-spacing:1px;'
      : 'font-size:11px;padding:6px 14px;letter-spacing:1px;';
    containerEl.insertAdjacentHTML('beforeend',
      '<button class="btn btn-ghost btn-sm" id="' + btnId + '" style="' + btnStyle + '">Bar Cop Briefing</button>'
    );
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => this._handleClick(auditType, audit, btn));
  },

  // Code-generated (no API): builds the per-audit read and shows it instantly.
  _handleClick(auditType, audit) {
    this._showModal(auditType, audit, this._buildOutlook(auditType, audit));
  },

  _itemShort(i) {
    return String((i && (i.action || i.gap_id)) || 'the top item').replace(/\.\s.*$/, '').replace(/\.$/, '');
  },

  _buildOutlook(auditType, audit) {
    return auditType === 'cash' ? this._cashOutlook(audit) : this._scoreOutlook(auditType, audit);
  },

  _scoreOutlook(auditType, audit) {
    const typeLabel = this._typeLabel(auditType);
    const weekly = auditType === 'bar-cop';
    const target = (audit.raw && audit.raw.TARGET_SCORE) || 70;
    const score = audit.overall_score;
    const money = (v) => '$' + Math.round(v || 0).toLocaleString('en-US');
    const sections = audit.sections || {};
    const secEntries = Object.keys(sections).map(n => [n, sections[n]]).filter(([, v]) => v != null);
    const items = (audit.action_items || []).slice().sort((a, b) => (b.monthly_impact || 0) - (a.monthly_impact || 0));
    const monthlyTotal = items.reduce((s, i) => s + (i.monthly_impact || 0), 0);
    const paras = [];

    // 1 — the overall story
    let p1;
    if (score == null) p1 = 'Not enough data to score this ' + typeLabel + ' audit yet. Keep logging and it fills in.';
    else if (score >= target) p1 = 'Your ' + typeLabel + ' audit came back at ' + score + ', at or above the ' + target + ' line. This side of the operation is running the way it should.';
    else p1 = 'Your ' + typeLabel + ' audit scored ' + score + ' against a ' + target + ' target. There is real room here, and the money below says where.';
    if (secEntries.length) {
      const weakest = secEntries.slice().sort((a, b) => a[1] - b[1])[0];
      if (score != null && weakest[1] < target) p1 += ' The weakest area is ' + weakest[0] + ' at ' + weakest[1] + '.';
    }
    paras.push(p1);

    // 2 — the biggest concern or win, with the number
    if (items.length && items[0].monthly_impact > 0) {
      let p2 = 'The fattest single line is ' + this._itemShort(items[0]).toLowerCase() + ', about ' + money(items[0].monthly_impact) + ' a month.';
      if (monthlyTotal > 0 && !weekly) p2 += ' All in, the sheet is worth about ' + money(monthlyTotal) + ' a month to close.';
      paras.push(p2);
    } else if (items.length) {
      paras.push('The top thing to tighten is ' + this._itemShort(items[0]).toLowerCase() + '.');
    }

    // 3 — the one move
    if (items.length) paras.push('If you make one move ' + (weekly ? 'this week' : 'this month') + ', start with ' + this._itemShort(items[0]).toLowerCase() + '. It is the biggest number on the board.');
    return paras.map(p => '<div style="margin-bottom:14px;">' + esc(p) + '</div>').join('');
  },

  _cashOutlook(audit) {
    const d = audit.raw || {};
    // Negative-safe BALANCE format: the minus goes outside the '$', no plus on a
    // positive. Two of the three things m() renders can go under zero (the low point,
    // and Safe to Spend, whose own line branches on < 0 so it printed "$-2,340" every
    // time it fired). The rest (trapped cash, dead stock, over par) are never
    // negative, so they read exactly as before.
    const m = (v) => v == null ? 'n/a' : (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
    const paras = [];

    // 1 — the survival read
    if (d.HAS_OPENING) {
      let p1 = d.RUNWAY == null ? 'Your cash holds all thirteen weeks ahead.'
             : d.RUNWAY === 0 ? 'Your cash runs out this week. This is the fire.'
             : 'Your cash runs about ' + d.RUNWAY + ' week' + (d.RUNWAY === 1 ? '' : 's') + ' before it would go negative.';
      if (d.LOW_POINT_WEEK) p1 += ' The tightest week is ' + d.LOW_POINT_WEEK + ' at ' + m(d.LOW_POINT_BAL) + '.';
      if (d.TIGHT_WEEKS > 0) p1 += ' ' + d.TIGHT_WEEKS + ' of the next thirteen run tight.';
      if (d.SAFE_TO_SPEND != null) p1 += ' Safe to spend right now is ' + m(d.SAFE_TO_SPEND) + (d.SAFE_TO_SPEND < 0 ? ', into money already spoken for.' : '.');
      paras.push(p1);
    } else {
      paras.push('Set your opening cash balance in Cash Position and the runway becomes real. Right now this is timing only.' + (d.TIGHT_WEEKS > 0 ? ' ' + d.TIGHT_WEEKS + ' of the next thirteen weeks run more cash out than in.' : ''));
    }

    // 2 — where the cash is stuck
    let p2 = '';
    if (d.TRAPPED_CASH > 0) p2 = m(d.TRAPPED_CASH) + ' of shelf cash is stuck, ' + m(d.DEAD_STOCK) + ' dead and ' + m(d.OVERSTOCK) + ' above par. ';
    // ONE cycle sentence, shared with the Cash cockpit briefing. This copy said "locked about
    // -17 days" for a NEGATIVE cycle, which is the healthy case described as the sick one, and
    // it disagreed with Capital Efficiency and Cash Audit S2 printing the same number.
    if (d.CYCLE_DAYS != null) p2 += App.cashCycleSentence(d.CYCLE_DAYS, d.DIO, d.DPO);
    if (p2.trim()) paras.push(p2.trim());

    // 3 — the single move
    let move;
    if (d.HAS_OPENING && d.RUNWAY != null && d.RUNWAY <= 4) move = 'Cover the tight week now. Move a payment to its due date and hold any order you can.';
    else if (d.TRAPPED_CASH > 2000) move = 'Free the shelf cash first. Run the dead stock down and order to par in Trapped Cash.';
    else if (d.TOTAL_VENDORS && d.VENDORS_ON_TERMS < d.TOTAL_VENDORS) move = 'Put the ' + (d.TOTAL_VENDORS - d.VENDORS_ON_TERMS) + ' vendor' + ((d.TOTAL_VENDORS - d.VENDORS_ON_TERMS) === 1 ? '' : 's') + ' without terms on terms, so you stop paying early.';
    else move = 'Nothing on fire. Keep ordering to par and paying on the due date.';
    paras.push(move);
    return paras.map(p => '<div style="margin-bottom:14px;">' + esc(p) + '</div>').join('');
  },

  _showModal(auditType, audit, bodyHtml) {
    const typeLabel = this._typeLabel(auditType);
    const period = (audit.date || '').slice(0, 10);
    /* ⛔ THE DISCLAIMER WAS MISSING HERE, AND IT HAD BEEN THE WHOLE TIME. `verify-briefing-disclaimer`
       was written for `DashUI.insightsModal` and pinned only that one; when the per-section
       briefings were retired for The Rail and the pin was re-pointed at the two SURVIVING briefing
       modals, this one came back empty. Both siblings carry it — The Rail's `_showModal` and
       formerly insightsModal — and this modal prints a scored audit read, which is exactly the
       output [[legal-protection]] wants it on. Unconditional, never behind an argument gate: that
       is the defect the original pin was born from. */
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Bar Cop Briefing: ' + esc(typeLabel) + (period ? ' &middot; ' + esc(period) : '') + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.9;">' + bodyHtml + '</div>'
      + '<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--b2);font-size:10px;color:var(--t4);line-height:1.6;">Generated from your logged Bar Cop data. A read on this audit, not real-time and not financial or business advice.</div>'
      + '</div>';
    App.openModal(html, { id: 'ao-modal', maxWidth: 620 });
  },

  _showError(message) {
    App.openModal('<div class="card form-card" style="margin:0;"><div style="font-size:13px;color:var(--red);line-height:1.6;">' + message + '</div></div>', { id: 'ao-error', maxWidth: 420 });
  },

  _typeLabel(auditType) {
    if (auditType === 'profit')   return 'Profit Recovery';
    if (auditType === 'revenue')  return 'Revenue Recovery';
    if (auditType === 'cash')     return 'Cash Recovery';
    if (auditType === 'bar-cop')  return 'Bar Cop';
    return 'Operational';
  },
};
