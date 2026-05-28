'use strict';

/* ── Bar Cop Audit — Hub-level executive operational audit ───────────────────
   Stub screen. Renders the empty-state copy and reserves the route so the
   sidebar Analysis link works from day one. Wave B of the Hub deep dive
   replaces this stub with the full screen: six sub-scores (Operational
   Discipline, Cash Integrity, Inventory Execution, Labor Hygiene, Recovery
   Action, Operational Consistency), Top Operational Exposures, Recurring
   Patterns, Recovery Activity Snapshot, Bar Cop Outlook button, 30-day
   generate rule, and the executive PDF. */

S.HubBarCopAudit = {
  open() {
    const container = document.getElementById('content-area')
      || document.querySelector('.content')
      || document.body;
    container.innerHTML = '<div class="screen">'
      + '<div class="card" style="padding:32px 28px;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Analysis</div>'
      +   '<div style="font-size:22px;font-weight:800;color:var(--t1);margin-bottom:14px;">Bar Cop Audit</div>'
      +   '<div style="font-size:13px;color:var(--t2);line-height:1.7;max-width:640px;">'
      +     'The monthly executive read on the entire operation. Six sub-scores covering operational discipline, cash integrity, inventory execution, labor hygiene, recovery action, and operational consistency. Top exposures and recurring patterns surfaced across every system. Bar Cop Outlook in plain operator voice.'
      +   '</div>'
      +   '<div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--b2);">'
      +     '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Coming Soon</div>'
      +     '<div style="font-size:12px;color:var(--t3);line-height:1.7;">Bar Cop Audit opens after the operation has 60 days of logged data across Inventory Control, Labor Control, and Shift Control. Most sub-scores need history to mean anything. Work the Recovery audits in the meantime; they feed the Recovery Action sub-score that lands here.</div>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }
};
