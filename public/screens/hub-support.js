'use strict';
/* ── Hub Contact Support — send a message straight to the support inbox ───────
   A Hub-owned view, not a module screen. Opens as a popup from the App Settings
   sidebar and the Help-page footer, so the operator never leaves the page they
   are on (open() keeps a full-page fallback). Submits directly to
   /api/support-message-notify which emails the message to the support inbox via
   Resend. No database record is kept — email is the record. The user's email is
   set as reply_to so the team can reply directly, and the screen they came from
   rides along for context. */
S.HubSupport = {

  _state: 'form',     // 'form' | 'success'
  _submitting: false,
  _modal: false,      // true when opened as a popup

  _demoGate() {
    return App.demoBlock && App.demoBlock({
      title: 'Not in the Demo',
      body: 'Contact Support goes straight to our inbox, so it is off in the demo. Sign up and we are one message away.'
    });
  },

  // Full-page fallback (sidebar stays mounted, content area swaps).
  open() {
    if (this._demoGate()) return;
    this._state = 'form';
    this._modal = false;
    App.openHubFullPage('Contact Bar Cop', (mount) => this.render(mount), 'contact-support');
  },

  // Popup — the primary entry. Same form, submit, and success states, rendered
  // into a modal (the corner X closes it) instead of the Hub full page.
  openModal() {
    if (this._demoGate()) return;
    this._state = 'form';
    this._modal = true;
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Contact Support</div>'
      + '<div id="hs-modal-body">' + this._renderForm() + '</div></div>';
    App.openModal(html, { id: 'hs-modal', maxWidth: 600 });
    this._wireModal();
  },

  _rerenderModalBody() {
    const body = document.getElementById('hs-modal-body');
    if (!body) return;
    body.innerHTML = this._state === 'success' ? this._renderSuccess() : this._renderForm();
    this._wireModal();
  },

  _wireModal() {
    if (this._state === 'form') {
      document.getElementById('hs-sup-submit')?.addEventListener('click', () => this.submit());
    } else {
      document.getElementById('hs-sup-done')?.addEventListener('click', () => App.closeModal('hs-modal'));
      document.getElementById('hs-sup-another')?.addEventListener('click', () => { this._state = 'form'; this._rerenderModalBody(); });
    }
  },

  render(container) {
    container.scrollTop = 0;
    this._container = container;

    const body = this._state === 'success' ? this._renderSuccess() : this._renderForm();
    container.innerHTML = '<div class="screen">' + body + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    if (this._state === 'form') {
      document.getElementById('hs-sup-submit')?.addEventListener('click', () => this.submit());
    } else {
      document.getElementById('hs-sup-done')?.addEventListener('click', () => App.showHub());
      document.getElementById('hs-sup-another')?.addEventListener('click', () => { this._state = 'form'; this.render(container); });
    }
  },

  _renderForm() {
    const inputStyle = 'background-color:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--w);font-family:\'Barlow\',sans-serif;font-size:13px;padding:9px 11px;width:100%;outline:none;';
    const taStyle    = inputStyle + 'resize:vertical;min-height:140px;line-height:1.6;';
    const labelStyle = 'font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:7px;';
    const reqStar    = '<span style="color:var(--red);margin-left:2px;">*</span>';

    const fields =
        '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">Topic' + reqStar + '</label>'
      +   '<select id="hs-sup-topic" class="pop-select" style="' + inputStyle + 'cursor:pointer;">'
      +     '<option value="Question" selected>Question about how something works</option>'
      +     '<option value="Feature Request">Feature request</option>'
      +     '<option value="Billing">Billing or subscription</option>'
      +     '<option value="Other">Other</option>'
      +   '</select>'
      + '</div>'
      + '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">Subject' + reqStar + '</label>'
      +   '<input type="text" id="hs-sup-subject" placeholder="One line summary of what you need" style="' + inputStyle + '"/>'
      + '</div>'
      + '<div style="margin-bottom:18px;">'
      +   '<label style="' + labelStyle + '">Message' + reqStar + '</label>'
      +   '<textarea id="hs-sup-message" placeholder="Give us the details. The more context you provide, the faster we can help." style="' + taStyle + '"></textarea>'
      + '</div>'
      + '<div id="hs-sup-status" style="font-size:11px;font-weight:700;letter-spacing:0.04em;margin-bottom:12px;display:none;"></div>'
      + '<div style="display:flex;gap:10px;align-items:center;">'
      +   '<button class="btn btn-primary" id="hs-sup-submit">Send Message</button>'
      + '</div>';

    // The popup card already provides the chrome; the full-page view keeps the
    // bordered wrapper. Neither carries explainer text.
    if (this._modal) return fields;
    return '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;">' + fields + '</div>';
  },

  _renderSuccess() {
    const userEmail = DB._user?.email || '';
    const replyLine = userEmail
      ? 'We will get back to you at <span style="color:var(--t1);font-weight:600;">' + esc(userEmail) + '</span> within one business day.'
      : 'We will get back to you within one business day.';
    return '<div style="padding:48px 24px;text-align:center;">'
      + '<svg width="56" height="56" viewBox="0 0 26 26" fill="none" style="margin:0 auto;display:block;">'
      +   '<circle cx="13" cy="13" r="11" stroke="var(--green)" stroke-width="1.6"/>'
      +   '<path d="M8 13l3.5 3.5L18 9" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>'
      + '<div style="font-size:18px;font-weight:800;color:var(--green);letter-spacing:0.04em;margin-top:18px;text-transform:uppercase;">Message Sent</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-top:14px;max-width:460px;margin-left:auto;margin-right:auto;">Your message is on its way to the support team. ' + replyLine + '</div>'
      + '<div style="margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">'
      +   '<button class="btn btn-ghost" id="hs-sup-another">Send Another</button>'
      + '</div>'
      + '</div>';
  },

  async submit() {
    if (this._submitting) return;

    const $ = (id) => document.getElementById(id);
    const topic   = $('hs-sup-topic')?.value || 'Other';
    const subject = ($('hs-sup-subject')?.value || '').trim();
    const message = ($('hs-sup-message')?.value || '').trim();
    const status  = $('hs-sup-status');

    const showError = (msg) => {
      if (!status) return;
      status.style.color = 'var(--red)';
      status.textContent = msg;
      status.style.display = 'block';
    };

    if (!subject) { showError('Please enter a subject so we know what your message is about.'); $('hs-sup-subject')?.focus(); return; }
    if (!message) { showError('Please write your message.'); $('hs-sup-message')?.focus(); return; }

    this._submitting = true;
    const btn = $('hs-sup-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    if (status) { status.style.display = 'none'; }

    const prevLoc = App._previousLocation;
    const payload = {
      topic:           topic,
      subject:         subject,
      message:         message,
      user_email:      (DB._user && DB._user.email) || '',
      previous_screen: prevLoc ? (prevLoc.label + ' (' + (prevLoc.module || prevLoc.mode) + '/' + prevLoc.screen + ')') : 'Hub'
    };

    try {
      const resp = await fetch('/api/support-message-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      this._submitting = false;
      if (!resp.ok || data.ok === false || (data.emailed === false && data.reason !== undefined)) {
        if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }
        showError('Could not send your message right now. Check your internet connection and try again. If it keeps failing, the server may be temporarily down.');
        return;
      }
      this._state = 'success';
      if (this._modal) this._rerenderModalBody(); else this.render(this._container);
    } catch (e) {
      this._submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }
      showError('Could not send your message right now. Check your internet connection and try again.');
    }
  }
};
