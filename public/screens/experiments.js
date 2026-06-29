'use strict';

/* ── Recovery — Experiments (per section: Profit / Revenue / Cash) ─────────────
   The operator's own before/after change log, scoped to the Recovery section it
   lives in. A normal module screen (sidebar + .screen chrome, same as every other
   recovery page), reached from the "Experiments" link in each section's sidebar.

   Reuses the shared, multi-instance InitiativeTracker: a stat strip (active /
   completed / wins) over the tracker card (active tests with before/after/lift,
   completed below). The module is taken from the active section, so one screen
   object serves all three. Reports a metric lift only, never recovered dollars,
   so it never overlaps the Recovery Scoreboard. */

S.RecoveryExperiments = {
  module() {
    const m = App._activeModule;
    return (m === 'revenue' || m === 'cash') ? m : 'profit';
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const mod = this.module();
    const IT = (typeof InitiativeTracker !== 'undefined') ? InitiativeTracker : null;
    const all = IT ? IT.list(mod) : [];
    const active = all.filter(i => i.status === 'Active');
    const completed = all.filter(i => i.status !== 'Active');
    const wins = IT ? completed.filter(i => IT.outcome(mod, i) === 'win').length : 0;

    let stats = '';
    if (all.length) {
      const stat = (label, val, cls) =>
        '<div class="calc-item"><div class="calc-label">' + label + '</div>'
        + '<div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
      stats = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
        + stat('Active Tests', String(active.length))
        + stat('Completed', String(completed.length), completed.length === 0 ? 'dim' : '')
        + stat('Wins', String(wins), wins > 0 ? 'good' : 'dim')
        + '</div></div>';
    }

    const exportRow = all.length
      ? '<div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:10px;"><button class="btn btn-ghost btn-sm" id="exp-export">Export PDF</button></div>'
      : '';

    this.container.innerHTML = '<div class="screen">' + exportRow + stats
      + '<div class="exp-area">' + (IT ? IT.card(mod) : '') + '</div></div>';
    const el = this.container.querySelector('.exp-area');
    if (el && IT) IT.wire(mod, el, () => this.draw());
    this.container.querySelector('#exp-export')?.addEventListener('click', () => { if (IT) IT.exportPDF(mod); });
  },

  showHowTo() {
    const mod = this.module();
    const watched = mod === 'revenue' ? 'sales, covers, and check average'
                  : mod === 'cash'    ? 'trapped cash, the cash cycle, and your runway'
                  :                     'pour cost, food cost, and prime cost';
    const example = mod === 'revenue' ? 'launching a new menu item or running a promotion'
                  : mod === 'cash'    ? 'moving a vendor onto net-30 or cutting par levels'
                  :                     're-speccing a pour or switching a vendor';
    App.showHelpModal('How Experiments Work', [
      { p: ['Experiments is your own before-and-after log. When you make a change you chose, like ' + example + ', start one here. Bar Cop averages the eight weeks before the start date against the eight weeks after on the metric you are watching and shows the lift, so you know whether the change actually moved the number.'] },
      { h: 'Start one', p: ['Tap Start Experiment, name the change, set the date you made it, and pick the metric to watch (' + watched + '). Add a line on what you changed so the record stands on its own later.'] },
      { h: 'Reading it', p: ['Each active experiment shows the metric before, after, and the lift, plus how many weeks of data it has so far. A win shows in gold. Give it a couple of weeks before you read too much into the number.'] },
      { h: 'It measures, it does not double-count', p: ['An experiment reports a metric lift only, never recovered dollars, so it never overlaps the Recovery Scoreboard. It is separate from the Fix System too: the Fix System tracks the fixes your audits prescribed, while an experiment is a change you decided to make on your own. Mark Complete to file one once you have your answer, or Delete one started by mistake.'] }
    ]);
  }
};
