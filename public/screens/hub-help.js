'use strict';

/* ── Hub Help and FAQ — platform-wide help, not module-specific ────────────
   A Hub-owned view (map Section 1). Covers app-wide questions: what the
   platform is, how the three layers fit together, account, data, and
   getting unstuck. Module-specific help lives in each module's own Help
   screen. Renders into the Hub container, never the module app shell. */
S.HubHelp = {

  open() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    let wrap = document.getElementById('hub-wrapper');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'hub-wrapper';
      wrap.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:var(--bg);z-index:100;';
      document.body.appendChild(wrap);
    }
    wrap.style.display = 'block';
    // The Hub leaves hub-wrapper at overflowY:hidden (fixed-viewport dashboard).
    // This view scrolls, so restore it whenever the wrapper is reused.
    wrap.style.overflowY = 'auto';
    this.render(wrap);
  },

  render(container) {
    const sections = [
      { t: 'About Bar Cop', qa: [
        { q: 'What is Bar Cop?',
          a: 'A three-layer operating platform for bars and restaurants. Capture: the Control modules (Inventory, Labor, Shift) where you log operational reality. Diagnose: the Recovery modules (Profit, Revenue, Traffic) and the monthly Audit. Fix: the Fix Layer that prescribes what to do about each gap. The flow runs in that order. Control feeds Recovery, the Audit scores what you have, and the Fix Layer tells you the next step.' },
        { q: 'How do the modules fit together?',
          a: 'The three Control modules log what happened: inventory counts, labor hours, shift revenue and cash. The three Recovery modules read that data and surface gaps. No double entry. Anything you log in Control shows up in Recovery automatically. The Hub rolls every module into one view.' },
        { q: 'Where do I start?',
          a: 'Open Getting Started from the sidebar. It is one ordered checklist across all six modules. Foundation first (operation profile, targets), then the three Control modules, then the three Recovery modules. Work it top to bottom.' },
        { q: 'What is the Hub dashboard showing me?',
          a: 'Four rollup tiles across the top, then three rows of panels: audit scores, key metrics, alerts, and the Recovery Scoreboard, then a trend chart, a weekly money readout, and your top action items. Every metric is clickable and takes you to the screen that calculates it.' }
      ]},
      { t: 'Your Account', qa: [
        { q: 'How is data saved?',
          a: 'Every change saves automatically to your account. There is no save button. Sign in on another device and your data is already there. If your connection drops mid-edit, the change is held locally and synced when you are back online.' },
        { q: 'Can I export my data?',
          a: 'Yes. Open Settings, scroll to Account, and use Export Backup. The export contains every record across every module in one file. Keep it offsite as your own backup. Restore from Backup reads the same file back in.' },
        { q: 'What happens if I cancel?',
          a: 'Your account is held for 30 days after cancellation. During that window you can sign back in, export a backup, or resubscribe. After 30 days the account and its data are removed.' },
        { q: 'How do I change my password or bar name?',
          a: 'Settings, in the sidebar Manage section. Operation Profile holds the bar name. Account holds the password reset and the backup tools.' }
      ]},
      { t: 'Getting Unstuck', qa: [
        { q: 'A number on the dashboard looks wrong.',
          a: 'Click the metric. The Hub takes you to the screen where that number is calculated. From there you can see the inputs that produced it. If you spot a wrong input, fix it on its own screen and the dashboard updates.' },
        { q: 'I have a question about a specific screen.',
          a: 'Every module has its own Help and FAQ in its sidebar. That is where the module-specific answers live. This Help and FAQ covers platform-wide topics.' },
        { q: 'Something is broken.',
          a: 'Use Report Bug in the Manage section of the Hub sidebar. Short description of what you were doing when it broke is all we need.' }
      ]}
    ];

    const sectionsHtml = sections.map(sec => {
      const items = sec.qa.map(f =>
        '<div style="margin-bottom:14px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:6px;">' + esc(f.q) + '</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.65;">' + esc(f.a) + '</div>'
        + '</div>').join('');
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div class="card-title">' + esc(sec.t) + '</div>'
        + items
        + '</div>';
    }).join('');

    container.scrollTop = 0;
    container.innerHTML =
      '<div style="max-width:880px;margin:0 auto;padding:0 24px 64px;">'
      + '<div style="display:flex;align-items:center;gap:14px;padding:20px 0 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);margin-bottom:18px;">'
      +   '<button id="hh-back" class="btn btn-ghost btn-sm">&#8592; Back to Hub</button>'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Help and FAQ</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:16px;">Platform-wide questions. For module-specific help, open the Help and FAQ inside that module.</div>'
      + sectionsHtml
      + '</div>';

    document.getElementById('hh-back').addEventListener('click', () => App.showHub());
  }
};
