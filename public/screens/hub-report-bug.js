'use strict';
/* ── Hub Report Bug — single-form view to submit bug reports ──────────────────
   A Hub-owned view, not a module screen. Opens from the Hub sidebar into the
   Hub container. Form captures bug details plus auto-captured browser context
   (user agent, viewport, the screen the operator came from) and submits to
   the bug_reports Supabase table via DB.submitBugReport. Success state
   replaces the form so the operator gets clear confirmation. */
S.HubReportBug = {

  _state: 'form',     // 'form' | 'success'
  _submitting: false,
  _modal: false,      // true when opened as a popup from a module sidebar

  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "REPORT A BUG | Back to Dashboard".
  open() {
    this._state = 'form';
    this._modal = false;
    App.openHubFullPage('Report a Bug', (mount) => this.render(mount), 'report-bug');
  },

  // Open as a popup from a module sidebar so the operator never leaves the
  // section they are working in. Same form, submit, and success states,
  // rendered into a modal instead of the Hub full page.
  openModal() {
    this._state = 'form';
    this._modal = true;
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Report a Bug</div>'
      + '<div id="hrb-modal-body">' + this._renderForm() + '</div></div>';
    App.openModal(html, { id: 'hrb-modal', maxWidth: 640, noClose: true });
    this._wireModal();
  },

  _rerenderModalBody() {
    const body = document.getElementById('hrb-modal-body');
    if (!body) return;
    body.innerHTML = this._state === 'success' ? this._renderSuccess() : this._renderForm();
    this._wireModal();
  },

  _wireModal() {
    if (this._state === 'form') {
      document.getElementById('hrb-submit')?.addEventListener('click', () => this.submit());
    } else {
      document.getElementById('hrb-done')?.addEventListener('click', () => App.closeModal('hrb-modal'));
      document.getElementById('hrb-another')?.addEventListener('click', () => { this._state = 'form'; this._rerenderModalBody(); });
    }
  },

  render(container) {
    container.scrollTop = 0;
    this._container = container;

    const body = this._state === 'success' ? this._renderSuccess() : this._renderForm();

    container.innerHTML = '<div class="screen">' + body + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    if (this._state === 'form') {
      document.getElementById('hrb-submit')?.addEventListener('click', () => this.submit());
    } else {
      document.getElementById('hrb-done')?.addEventListener('click', () => App.showHub());
      document.getElementById('hrb-another')?.addEventListener('click', () => {
        this._state = 'form';
        this.render(container);
      });
    }
  },

  _renderForm() {
    const inputStyle = 'background-color:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--w);font-family:\'Barlow\',sans-serif;font-size:13px;padding:9px 11px;width:100%;outline:none;';
    const taStyle    = inputStyle + 'resize:vertical;min-height:90px;line-height:1.6;';
    const labelStyle = 'font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:7px;';
    const reqStar    = '<span style="color:var(--red);margin-left:2px;">*</span>';

    const explainer = '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:20px;">'
      + 'Found a bug, a glitch, or something that just does not work the way it should? Tell the team what happened so we can find it and fix it fast. The more detail you give, the quicker we can get on it.'
      + '</div>';
    const fields =
        '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">Short Title' + reqStar + '</label>'
      +   '<input type="text" id="hrb-title" placeholder="One line summary of the problem" style="' + inputStyle + '"/>'
      + '</div>'
      + '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">Severity' + reqStar + '</label>'
      +   '<select id="hrb-severity" class="pop-select" style="' + inputStyle + 'cursor:pointer;">'
      +     '<option value="minor">Minor (small glitch or visual issue)</option>'
      +     '<option value="moderate" selected>Moderate (feature works but has bugs)</option>'
      +     '<option value="major">Major (feature is broken)</option>'
      +     '<option value="critical">Critical (Bar Cop unusable or data at risk)</option>'
      +   '</select>'
      + '</div>'
      + '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">What Happened' + reqStar + '</label>'
      +   '<textarea id="hrb-what" placeholder="Describe what you saw. Be specific about which page, which button, what data you were working with, and what went wrong." style="' + taStyle + '"></textarea>'
      + '</div>'
      + '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">Steps to Reproduce</label>'
      +   '<textarea id="hrb-steps" placeholder="Number the steps to make the bug happen again. Example: 1. Open Profit Recovery. 2. Click This Week. 3. Enter $1,200. 4. The save button does not respond." style="' + taStyle + '"></textarea>'
      + '</div>'
      + '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">What Did You Expect to Happen</label>'
      +   '<textarea id="hrb-expected" placeholder="Describe what should have happened instead. This helps us know if it is a bug or a misunderstanding of how the feature works." style="' + taStyle + '"></textarea>'
      + '</div>'
      + '<div id="hrb-status" style="font-size:11px;font-weight:700;letter-spacing:0.04em;margin-bottom:12px;display:none;"></div>'
      + '<div style="display:flex;gap:10px;align-items:center;">'
      +   '<button class="btn btn-primary" id="hrb-submit">Submit Report</button>'
      + '</div>';

    // In the popup the modal card already provides the chrome, so skip the
    // intro line and the bordered wrapper. The full-page Hub view keeps both.
    if (this._modal) return fields;
    return explainer
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;">' + fields + '</div>';
  },

  _renderSuccess() {
    return '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:48px 24px;text-align:center;">'
      + '<svg width="56" height="56" viewBox="0 0 26 26" fill="none" style="margin:0 auto;display:block;">'
      +   '<circle cx="13" cy="13" r="11" stroke="var(--green)" stroke-width="1.6"/>'
      +   '<path d="M8 13l3.5 3.5L18 9" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>'
      + '<div style="font-size:18px;font-weight:800;color:var(--green);letter-spacing:0.04em;margin-top:18px;text-transform:uppercase;">Report Submitted</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-top:14px;max-width:460px;margin-left:auto;margin-right:auto;">Got it. Your report is in the queue and the team is on it. A fix will land in the next update. Keep running your operation in the meantime.</div>'
      + '<div style="margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">'
      +   '<button class="btn btn-primary" id="hrb-done">' + (this._modal ? 'Close' : 'Back to Hub') + '</button>'
      +   '<button class="btn btn-ghost" id="hrb-another">Submit Another</button>'
      + '</div>'
      + '</div>';
  },

  async submit() {
    if (this._submitting) return;

    const $ = (id) => document.getElementById(id);
    const title    = ($('hrb-title')?.value || '').trim();
    const severity = $('hrb-severity')?.value || 'moderate';
    const what     = ($('hrb-what')?.value || '').trim();
    const steps    = ($('hrb-steps')?.value || '').trim();
    const expected = ($('hrb-expected')?.value || '').trim();
    const status   = $('hrb-status');

    const showError = (msg) => {
      if (!status) return;
      status.style.color = 'var(--red)';
      status.textContent = msg;
      status.style.display = 'block';
    };

    if (!title) { showError('Please enter a short title for the bug.'); $('hrb-title')?.focus(); return; }
    if (!what)  { showError('Please describe what happened.');          $('hrb-what')?.focus();  return; }

    this._submitting = true;
    const btn = $('hrb-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
    if (status) { status.style.display = 'none'; }

    const prevLoc = App._previousLocation;
    const report = {
      title:              title,
      severity:           severity,
      what_happened:      what,
      steps_to_reproduce: steps,
      expected_behavior:  expected,
      previous_screen:    prevLoc ? (prevLoc.label + ' (' + (prevLoc.module || prevLoc.mode) + '/' + prevLoc.screen + ')') : 'Hub',
      user_agent:         navigator.userAgent || '',
      viewport:           window.innerWidth + 'x' + window.innerHeight
    };

    const result = await DB.submitBugReport(report);

    if (!result.ok) {
      this._submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Report'; }
      showError('Could not submit your report right now. Check your internet connection and try again. If it keeps failing, the server may be temporarily down.');
      return;
    }

    // DB record is saved — fire the notification email best-effort. We don't
    // block the success state on this; if Resend is misconfigured or down,
    // the bug is still in Supabase and the team will see it on next check.
    try {
      const payload = Object.assign({}, report, { user_email: (DB._user && DB._user.email) || '' });
      await fetch('/api/report-bug-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) { /* notification failure is non-fatal */ }

    this._submitting = false;
    this._state = 'success';
    if (this._modal) this._rerenderModalBody();
    else this.render(this._container);
  }
};
