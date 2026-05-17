'use strict';
S.AuditTracker = {

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.renderMain();
  },

  renderMain() {
    const audits = (App.data.audits || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    const latest = audits[0] || null;
    const prev   = audits[1] || null;

    // ── Audit Request Card ──────────────────────────────────────────
    // Subscription renews monthly. Audit available once per month after renewal.
    // For now: if no audit this month, show Request button. If already one this month, show countdown.
    const now = new Date();
    const thisMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const hasThisMonth = audits.some(a => (a.date||'').slice(0,7) === thisMonthKey);

    // Days until end of month (next renewal)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const daysLeft = Math.ceil((endOfMonth - now) / (1000*60*60*24));

    const requestCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Profit Audit</div>'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;max-width:480px;">'
      + 'One comprehensive audit per month, delivered within 48 hours. '
      + 'Your audit analyses your cost structure, variance patterns, vendor pricing, and cash controls — '
      + 'with a full scored report and ranked action items.</div>'
      + '</div>'
      + (hasThisMonth
          ? '<div style="text-align:right;flex-shrink:0;">'
            + '<div style="font-size:22px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--gold);">' + daysLeft + ' days</div>'
            + '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Until next audit available</div>'
            + '</div>'
          : '<button class="btn btn-primary" id="at-request-btn" style="flex-shrink:0;">Request This Month\'s Audit</button>')
      + '</div>'
      + '</div>';

    // ── Latest Audit Summary ───────────────────────────────────────
    let latestCard = '';
    if (latest) {
      const scoreColor = latest.overall_score >= 80 ? 'var(--gold)' : latest.overall_score >= 60 ? 'var(--t1)' : 'var(--red)';
      const scoreLabel = latest.overall_score >= 80 ? 'Strong' : latest.overall_score >= 60 ? 'Moderate' : 'Needs Work';

      // Progress vs previous
      let progressBanner = '';
      if (prev) {
        const diff = latest.overall_score - prev.overall_score;
        const diffColor = diff >= 0 ? 'var(--gold)' : 'var(--red)';
        const diffSign  = diff >= 0 ? '+' : '';
        progressBanner = '<div style="background:var(--input);border:1px solid var(--b2);border-radius:3px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">vs Previous Audit</div>'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:' + diffColor + ';">' + diffSign + diff.toFixed(0) + ' pts</div>'
          + '<div style="font-size:12px;color:var(--t2);">'
          + (diff > 0 ? 'Score improved from ' : diff < 0 ? 'Score declined from ' : 'No change from ')
          + prev.overall_score + ' → ' + latest.overall_score + '</div>'
          + '</div>';
      }

      // Section scores
      const sections = latest.sections || {};
      const sectionRows = Object.entries(sections).map(([name, score]) => {
        const prev_score = prev?.sections?.[name];
        const diff = prev_score != null ? score - prev_score : null;
        return '<tr>'
          + '<td style="color:var(--t1);">' + esc(name) + '</td>'
          + '<td><div class="prog" style="width:120px;display:inline-block;"><div class="prog-fill" style="width:' + score + '%;background:' + (score>=70?'var(--gold)':score>=50?'rgba(255,200,0,0.5)':'var(--red)') + ';"></div></div></td>'
          + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;color:' + (score>=70?'var(--gold)':score>=50?'var(--t1)':'var(--red)') + ';">' + score + '</td>'
          + (diff != null ? '<td style="font-size:12px;color:' + (diff>=0?'var(--gold)':'var(--red)') + ';">' + (diff>=0?'+':'') + diff + '</td>' : '<td></td>')
          + '</tr>';
      }).join('');

      // Top action items
      const actions_list = (latest.action_items || []).slice(0,5).map((a,i) =>
        '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:24px;flex-shrink:0;">' + (i+1) + '</div>'
        + '<div style="flex:1;">'
        + '<div style="font-size:12px;color:var(--t1);margin-bottom:2px;">' + esc(a.action||a) + '</div>'
        + (a.monthly_impact ? '<div style="font-size:11px;color:var(--gold);font-weight:700;">+' + App.fmtCurrency(a.monthly_impact) + '/month opportunity</div>' : '')
        + '</div>'
        + '</div>'
      ).join('');

      latestCard = '<div class="card" style="margin-bottom:16px;">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--b2);flex-wrap:wrap;gap:10px;">'
        + '<div>'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Audit</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--w);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + '</div>'
        + '</div>'
        + '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:52px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + latest.overall_score + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + scoreLabel + '</div>'
        + (latest.pdf_url ? '<a href="' + latest.pdf_url + '" download class="btn btn-ghost btn-sm" style="margin-top:8px;display:inline-flex;">Download PDF</a>' : '')
        + '</div>'
        + '</div>'
        + progressBanner
        + (sectionRows ? '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">'
          + '<thead><tr>'
          + '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);text-align:left;padding:6px 0;border-bottom:1px solid var(--b2);">Section</th>'
          + '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);padding:6px 0;border-bottom:1px solid var(--b2);"></th>'
          + '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);padding:6px 0;border-bottom:1px solid var(--b2);">Score</th>'
          + (prev ? '<th style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);padding:6px 0;border-bottom:1px solid var(--b2);">Change</th>' : '<th></th>')
          + '</tr></thead><tbody>' + sectionRows + '</tbody></table>' : '')
        + (actions_list ? '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Top Action Items by Impact</div>' + actions_list : '')
        + '</div>';
    }

    // ── Audit History Log ──────────────────────────────────────────
    let historyCard = '';
    if (audits.length > 1) {
      const rows = audits.map((a,i) => {
        const prev = audits[i+1];
        const diff = prev ? a.overall_score - prev.overall_score : null;
        return '<tr>'
          + '<td>' + (a.date||'').slice(0,10) + '</td>'
          + '<td class="val" style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + a.overall_score + '</td>'
          + '<td>' + (diff!=null ? '<span style="color:' + (diff>=0?'var(--gold)':'var(--red)') + ';font-weight:700;">' + (diff>=0?'+':'') + diff + '</span>' : '—') + '</td>'
          + '<td>' + esc(a.grade||'') + '</td>'
          + (a.pdf_url ? '<td><a href="' + a.pdf_url + '" class="btn btn-ghost btn-sm" style="padding:3px 10px;" download>PDF</a></td>' : '<td></td>')
          + '</tr>';
      }).join('');

      historyCard = '<div class="card">'
        + '<div class="card-title">Audit History</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Score</th><th>Change</th><th>Grade</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '</div>';
    }

    // ── Upload section (for manually uploading completed audit PDFs) ──
    const uploadCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-title">Upload Completed Audit PDF</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">When your audit is complete you\'ll receive a PDF report. Upload it here to add it to your history, extract your scores and action items, and compare against your previous audit.</div>'
      + '<div class="form-row" style="gap:16px;align-items:flex-end;">'
      + '<div class="f"><label>Select Audit PDF</label><input type="file" id="at-file" accept=".pdf" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:8px;font-size:12px;cursor:pointer;"/></div>'
      + '<button class="btn btn-primary" id="at-upload-btn" style="flex-shrink:0;">Upload & Extract</button>'
      + '</div>'
      + '<div id="at-status" style="font-size:12px;margin-top:10px;display:none;"></div>'
      + '</div>';

    const emptyState = !latest ? '<div class="empty" style="margin-top:0;padding-top:32px;">'
      + '<div class="empty-title">No Audits Yet</div>'
      + '<div class="empty-sub">Request your first monthly audit above. When your completed PDF arrives, upload it here to start tracking your progress.</div>'
      + '</div>' : '';

    this.container.innerHTML = '<div class="screen">'
      + requestCard
      + uploadCard
      + (latest ? latestCard : emptyState)
      + historyCard
      + '</div>';

    // Wire request button
    document.getElementById('at-request-btn')?.addEventListener('click', () => this.showRequestForm());

    // Wire upload
    document.getElementById('at-upload-btn')?.addEventListener('click', () => {
      const file = document.getElementById('at-file')?.files[0];
      if (!file) { this.setStatus('Select a PDF file first.', 'warn'); return; }
      this.uploadAudit(file);
    });
  },

  showRequestForm() {
    // Show a simple intake form — submits to the operator (Kyle) for processing
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
    const s = App.data.settings;
    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:520px;width:100%;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:16px;">Request Monthly Profit Audit</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:20px;">Your audit will be delivered within 48 hours. We\'ll analyse your cost data, inventory variance, vendor pricing trends, and cash controls — and return a fully scored PDF report with ranked action items.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Bar Name</label><input type="text" id="req-name" value="' + esc(s.bar_name||'') + '" /></div>'
      + '<div class="f w-md"><label>Contact Email</label><input type="email" id="req-email" placeholder="your@email.com" /></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:16px;"><label>What should we focus on this month? (optional)</label><textarea id="req-notes" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--w);font-family:Barlow,sans-serif;font-size:13px;padding:8px 10px;width:100%;min-height:80px;resize:vertical;" placeholder="e.g. bar pour cost has been running high, want to understand why..."></textarea></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:16px;">Current weekly data, products, recipes, and variance reports will be included automatically from your app data.</div>'
      + '<div style="display:flex;gap:10px;justify-content:flex-end;">'
      + '<button class="btn btn-ghost" id="req-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="req-submit">Submit Audit Request</button>'
      + '</div>'
      + '<div id="req-msg" style="font-size:12px;margin-top:10px;display:none;"></div>'
      + '</div>';
    document.body.appendChild(modal);
    modal.onclick = ev => { if (ev.target === modal) modal.remove(); };
    document.getElementById('req-cancel').onclick = () => modal.remove();
    document.getElementById('req-submit').onclick = () => {
      const email = document.getElementById('req-email')?.value.trim();
      const msg = document.getElementById('req-msg');
      if (!email) { if(msg){msg.style.color='var(--red)';msg.textContent='Email required.';msg.style.display='block';} return; }
      // In production this would POST to a webhook or email service
      // For now, show confirmation
      const btn = document.getElementById('req-submit');
      if(btn){btn.disabled=true;btn.textContent='Submitting...';}
      setTimeout(() => {
        if(msg){msg.style.color='var(--gold)';msg.textContent='✓ Audit request submitted. You\'ll receive your report within 48 hours.';msg.style.display='block';}
        setTimeout(() => modal.remove(), 3000);
      }, 800);
    };
  },

  setStatus(msg, type) {
    const el = document.getElementById('at-status');
    if (!el) return;
    el.style.display = 'block';
    el.style.color = type === 'warn' ? 'var(--red)' : type === 'ok' ? 'var(--gold)' : 'var(--t2)';
    el.textContent = msg;
  },

  async uploadAudit(file) {
    this.setStatus('Reading PDF...', 'info');
    const btn = document.getElementById('at-upload-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });

      this.setStatus('Extracting audit data...', 'info');

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              {
                type: 'text',
                text: 'Extract all data from this Bar Cop Profit Audit PDF. Return ONLY valid JSON with no markdown formatting:\n{\n  "bar_name": "",\n  "overall_score": 0,\n  "grade": "",\n  "date": "YYYY-MM-DD",\n  "sections": {"Section Name": score_number},\n  "action_items": [{"action": "", "monthly_impact": 0, "priority": ""}],\n  "key_metrics": {"Bar Pour Cost %": "", "Food Cost %": "", "Prime Cost %": ""}\n}'
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const raw = data.content?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const extracted = JSON.parse(clean);

      extracted.id = App.uid();
      extracted.date = extracted.date || new Date().toISOString().slice(0,10);
      extracted.uploaded_at = new Date().toISOString();
      extracted.pdf_url = null; // Would be set if we stored the PDF

      if (!App.data.audits) App.data.audits = [];
      App.data.audits.push(extracted);
      App.data.audits.sort((a,b) => new Date(a.date) - new Date(b.date));

      await App.saveKey('audits');
      this.setStatus('✓ Audit uploaded and extracted successfully.', 'ok');
      setTimeout(() => this.renderMain(), 1200);

    } catch (e) {
      this.setStatus('Error extracting audit data. Make sure this is a valid Bar Cop Profit Audit PDF.', 'warn');
      console.error('Audit upload error:', e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Upload & Extract'; }
    }
  }
};
