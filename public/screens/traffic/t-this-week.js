'use strict';
S.TrafficThisWeek = {
  render(container, actions) {
    actions.innerHTML = '';
    const weeks   = App.data.traffic_weeks || [];
    const lastWk  = weeks.length ? weeks[weeks.length-1] : null;
    const weekNum = App.nextWeekNum ? (weeks.length ? Math.max(...weeks.map(w=>w.week_num||0))+1 : 1) : weeks.length+1;
    const ts      = App.data.traffic_settings?.targets || {};

    container.innerHTML = `<div class="screen">
      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Weekly Traffic Entry</div>
        <div style="font-size:13px;color:var(--t2);margin-bottom:18px;">Log your digital metrics for the week. Collect these from your Google Business Profile, website analytics, and social media apps before entering.</div>

        <div class="form-row" style="gap:16px;margin-bottom:18px;">
          <div class="f" style="width:120px;"><label>Week Number</label><input type="number" id="tw-wknum" value="${weekNum}" min="1"/></div>
          <div class="f" style="width:160px;"><label>Period End Date</label><input type="date" id="tw-date" value="${new Date().toISOString().slice(0,10)}"/></div>
        </div>

        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;margin-top:4px;padding-top:14px;border-top:1px solid var(--b2);">Google Business Profile</div>
        <div class="form-row" style="gap:16px;margin-bottom:18px;">
          <div class="f" style="width:160px;"><label>Google Rating ${tt('t-google-rating')}</label><div class="fw"><input class="suf" type="number" id="tw-gr" placeholder="4.2" step="0.1" min="1" max="5"/><span class="suf">★</span></div></div>
          <div class="f" style="width:160px;"><label>Total Google Reviews</label><div class="fw"><input class="suf" type="number" id="tw-gtotal" placeholder="148"/><span class="suf">reviews</span></div></div>
          <div class="f" style="width:160px;"><label>New Reviews This Month ${tt('t-review-vel')}</label><div class="fw"><input class="suf" type="number" id="tw-newrev" placeholder="6"/><span class="suf">/mo</span></div></div>
          <div class="f" style="width:160px;"><label>Response Rate ${tt('t-response-rate')}</label><div class="fw"><input class="suf" type="number" id="tw-rr" placeholder="62" step="1" min="0" max="100"/><span class="suf">%</span></div></div>
        </div>

        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;padding-top:14px;border-top:1px solid var(--b2);">Website</div>
        <div class="form-row" style="gap:16px;margin-bottom:18px;">
          <div class="f" style="width:200px;"><label>Monthly Sessions ${tt('t-monthly-sessions')}</label><div class="fw"><input class="suf" type="number" id="tw-sess" placeholder="1840"/><span class="suf">/mo</span></div></div>
          <div class="f" style="width:160px;"><label>Bounce Rate ${tt('t-bounce-rate')}</label><div class="fw"><input class="suf" type="number" id="tw-bounce" placeholder="68" step="1" min="0" max="100"/><span class="suf">%</span></div></div>
        </div>

        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;padding-top:14px;border-top:1px solid var(--b2);">Social Media</div>
        <div class="form-row" style="gap:16px;margin-bottom:18px;">
          <div class="f" style="width:160px;"><label>Instagram Followers</label><div class="fw"><input class="suf" type="number" id="tw-igf" placeholder="1240"/><span class="suf">followers</span></div></div>
          <div class="f" style="width:160px;"><label>IG Posts This Month ${tt('t-social-posts')}</label><div class="fw"><input class="suf" type="number" id="tw-igp" placeholder="8"/><span class="suf">posts</span></div></div>
          <div class="f" style="width:160px;"><label>Facebook Followers</label><div class="fw"><input class="suf" type="number" id="tw-fbf" placeholder="2100"/><span class="suf">followers</span></div></div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-primary" id="tw-save-btn">Save Week</button>
          <div id="tw-msg" style="font-size:12px;color:var(--gold);display:none;">Week saved.</div>
        </div>
      </div>

      ${weeks.length ? `<div class="sh">Recent Weeks</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Period End</th><th>Google Rating</th><th>New Reviews</th><th>Response Rate</th><th>Sessions</th><th></th></tr></thead>
      <tbody>${weeks.slice().reverse().slice(0,8).map(w=>`<tr>
        <td>Wk ${w.week_num}</td>
        <td>${(w.period_end||'').slice(0,10)}</td>
        <td class="${(w.google_rating||0)>=(ts.google_rating||4.3)?'pos':'neg'}">${w.google_rating?w.google_rating.toFixed(1)+'★':'&mdash;'}</td>
        <td class="${(w.new_reviews||0)>=(ts.review_velocity||8)?'pos':'neg'}">${w.new_reviews??'&mdash;'}</td>
        <td class="${(w.response_rate||0)>=(ts.response_rate||75)?'pos':'neg'}">${w.response_rate?w.response_rate.toFixed(0)+'%':'&mdash;'}</td>
        <td>${w.monthly_sessions?w.monthly_sessions.toLocaleString():'&mdash;'}</td>
        <td><button class="btn btn-ghost btn-sm tw-del" data-id="${w.id}" style="font-size:10px;padding:4px 8px;color:var(--red);">Delete</button></td>
      </tr>`).join('')}</tbody></table></div>` : ''}
    </div>`;

    document.getElementById('tw-save-btn')?.addEventListener('click', async () => {
      const wkNum   = parseInt(document.getElementById('tw-wknum')?.value) || weekNum;
      const date    = document.getElementById('tw-date')?.value || '';
      const gr      = parseFloat(document.getElementById('tw-gr')?.value)     || null;
      const gtotal  = parseInt(document.getElementById('tw-gtotal')?.value)   || null;
      const newrev  = parseInt(document.getElementById('tw-newrev')?.value)   || null;
      const rr      = parseFloat(document.getElementById('tw-rr')?.value)     || null;
      const sess    = parseInt(document.getElementById('tw-sess')?.value)     || null;
      const bounce  = parseFloat(document.getElementById('tw-bounce')?.value) || null;
      const igf     = parseInt(document.getElementById('tw-igf')?.value)      || null;
      const igp     = parseInt(document.getElementById('tw-igp')?.value)      || null;
      const fbf     = parseInt(document.getElementById('tw-fbf')?.value)      || null;

      const entry = {
        id:              Date.now(),
        week_num:        wkNum,
        period_end:      date,
        google_rating:   gr,
        google_total:    gtotal,
        new_reviews:     newrev,
        response_rate:   rr,
        monthly_sessions:sess,
        bounce_rate:     bounce,
        ig_followers:    igf,
        ig_posts_month:  igp,
        fb_followers:    fbf,
      };

      App.data.traffic_weeks = App.data.traffic_weeks || [];
      App.data.traffic_weeks.push(entry);
      await App.saveKey('traffic_weeks');
      const msg = document.getElementById('tw-msg');
      if (msg) { msg.style.display='block'; setTimeout(()=>msg.style.display='none',2500); }
      this.render(container, document.getElementById('topbar-actions'));
    });

    container.addEventListener('click', async ev => {
      const btn = ev.target.closest('.tw-del');
      if (!btn) return;
      if (!confirm('Delete this week?')) return;
      const id = parseInt(btn.dataset.id);
      App.data.traffic_weeks = (App.data.traffic_weeks||[]).filter(w=>w.id!==id);
      await App.saveKey('traffic_weeks');
      this.render(container, document.getElementById('topbar-actions'));
    });
  }
};
