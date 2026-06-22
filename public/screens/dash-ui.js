'use strict';
// Shared layout for the Recovery dashboards (Profit/Revenue/Traffic). Holds only
// the layout skeleton + generic panels; each screen supplies its own content
// (the Recovery Scoreboard hero + leak rows come from FixPanel; forecast,
// insights, and audit data are per-module). Same move as AuditUI, so a layout
// change is made once here and lifts every Recovery dashboard. (dashboard.js
// migrates onto this next; Revenue uses it now.)
const DashUI = {

  // Equal-height two-column row (the Control-dashboard pattern).
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },

  // Heading-outside panel: a .sh title above a flex card. The heading is a
  // fixed-height single-line row so titles line up across the row and the cards
  // start at the same Y; flex:1 + the row's align-items:stretch make both cards
  // equal height.
  shPanel(title, bodyHtml, titleRight) {
    const sh = '<div class="sh" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</div>';
    const head = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:22px;margin:0 0 10px;">' + sh + (titleRight || '') + '</div>';
    return head + '<div class="card" style="flex:1;">' + bodyHtml + '</div>';
  },

  ph(msg) { return '<div style="font-size:13px;color:var(--t3);line-height:1.6;">' + msg + '</div>'; },

  // A "metric vs target" card body. rows = [{label, sub, value, color}]; each
  // value is a plain number colored by meaning (caller decides over/under). No
  // chart; a written read lives behind an Insights button in the panel heading.
  metricsPanel(rows, emptyMsg) {
    if (!rows || !rows.length) {
      return '<div style="text-align:center;padding:28px 0;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">' + (emptyMsg || 'No data yet') + '</div>';
    }
    return rows.map((m, i) => {
      const last = i === rows.length - 1;
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;' + (last ? '' : 'border-bottom:1px solid var(--row-div);') + '">'
        + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:var(--t1);">' + m.label + '</div>'
        + (m.sub ? '<div style="font-size:10px;color:var(--t3);">' + m.sub + '</div>' : '') + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:' + (m.color || 'var(--t3)') + ';">' + m.value + '</div>'
        + '</div>';
    }).join('');
  },

  // Latest-audit panel — score + label + date + next-audit timing + a way in.
  // opts = {audits, screen, runText, emptyText}.
  auditPanel(opts) {
    const audits = ((opts && opts.audits) || []).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const latest = audits[0];
    const screen = opts.screen;
    if (!latest) return '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">' + esc(opts.emptyText || '') + '</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="' + screen + '">' + esc(opts.runText || 'Run Audit') + '</button>';
    const score = latest.overall_score || 0;
    const col = App.scoreColor(score);
    const daysSince = latest.date ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const daysLeft = Math.max(0, 7 - daysSince);
    const timing = daysLeft > 0 ? 'Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') : 'Ready to run a new audit';
    return '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:700;color:' + col + ';line-height:1;">' + score + '</div>'
      + '<div><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + col + ';">' + esc(App.scoreLabel(score)) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date || '').slice(0, 10) + '</div></div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + timing + '</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="' + screen + '">View Audit</button>';
  },

  // Bare Quick Actions block. buttons = [{go, label}].
  quickActions(buttons) {
    const btn = b => '<button class="btn btn-primary db-qa" data-go="' + b.go + '" style="flex:1;min-width:150px;">' + b.label + '</button>';
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + buttons.map(btn).join('') + '</div></div>';
  },

  // Day-one Get Started strip. steps = [{done, num, label, go, cross}]; cross
  // marks a step that lives in another module (openScreen vs navigate).
  dayOneStrip(intro, steps) {
    const step = (s) =>
      '<div class="db-go" data-go="' + s.go + '"' + (s.cross ? ' data-cross="1"' : '') + ' style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid ' + (s.done ? 'var(--b2)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (s.done ? 'var(--input)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;' + (s.done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (s.done ? '&#10003;' : s.num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + s.label + '</span></div>';
    return '<div class="card form-card" style="margin-bottom:14px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + intro + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + steps.map(step).join('') + '</div></div>';
  },

  // Wire .db-qa (navigate within module) + .db-go (cross = openScreen, else navigate).
  wireQuick(container) {
    container.querySelectorAll('.db-qa').forEach(b => b.addEventListener('click', () => App.navigate(b.dataset.go)));
    container.querySelectorAll('.db-go').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.cross) App.openScreen(b.dataset.go); else App.navigate(b.dataset.go);
    }));
  },

  // Shared Insights modal shell (Bar Cop Outlook style): title left, Close
  // top-right, overlay + Esc to close. Opens only when the text is ready.
  insightsModal(label, bodyHtml, generated_at) {
    const dateStr = generated_at ? this._insDate(generated_at) : '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:var(--r);padding:28px;max-width:620px;width:100%;max-height:80vh;overflow-y:auto;';
    box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">' + (label || 'Bar Cop Insights') + (dateStr ? ' &middot; as of ' + esc(dateStr) : '') + '</div>'
      + '<button class="btn btn-ghost btn-sm db-ins-close">Close</button></div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.9;">' + bodyHtml + '</div>'
      + (generated_at ? '<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--b2);font-size:10px;color:var(--t4);line-height:1.6;">Generated from your logged data. A weekly read, refreshes once a week. Not financial or business advice.</div>' : '');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    box.querySelector('.db-ins-close')?.addEventListener('click', close);
    const onKey = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); } };
    document.addEventListener('keydown', onKey);
  },

  // ── Weekly Insights cache (once a week per recovery section) ──────────────
  // The written read is stored on App.data.recovery_insights[module] with a
  // generated_at stamp. Re-opening within 7 days reuses it (no API spend); a
  // new analysis only fires once the stored one is a week old. No manual
  // mid-week refresh, so cost cannot run up on repeat clicks.
  _insDate(iso) { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; } },
  _insRec(moduleKey) { const s = App.data && App.data.recovery_insights; return (s && s[moduleKey] && s[moduleKey].html) ? s[moduleKey] : null; },
  _insFresh(rec) { return !!(rec && rec.generated_at && (Date.now() - new Date(rec.generated_at).getTime()) / 86400000 < 7); },
  _insSave(moduleKey, html) {
    App.data.recovery_insights = App.data.recovery_insights || {};
    const generated_at = new Date().toISOString();
    App.data.recovery_insights[moduleKey] = { html: html, generated_at: generated_at };
    App.save();   // persist in the background; the in-memory copy is live now
    return generated_at;
  }
};
