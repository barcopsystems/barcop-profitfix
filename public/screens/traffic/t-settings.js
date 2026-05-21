'use strict';
S.TrafficSettings = {

  render(container, actions) {
    actions.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.id = 'ts-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.save());
    actions.appendChild(saveBtn);

    const s  = App.data.settings;
    const ts = App.data.traffic_settings || {};
    const t  = ts.targets || {};

    container.innerHTML = `<div class="screen">
      <div class="s-tabs" style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:24px;">
        <button class="s-tab s-tab-active" data-tab="general" style="background:none;border:none;color:var(--gold);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;cursor:pointer;border-bottom:2px solid var(--gold);margin-bottom:-1px;">Settings</button>
        <button class="s-tab" data-tab="subscription" style="background:none;border:none;color:var(--t2);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;">Subscription</button>
      </div>

      <div id="ts-tab-general">
        <div class="settings-section"><div class="settings-title">Your Bar</div>
          <div class="card"><div class="form-row" style="gap:16px;">
            <div class="f w-lg"><label>Bar / Restaurant Name</label><input type="text" id="ts-name" value="${esc(s.bar_name||'')}" placeholder="The Rusty Nail"/></div>
            <div class="f" style="width:160px;"><label>City</label><input type="text" id="ts-city" value="${esc((s.city_state||'').split(',')[0]?.trim()||'')}" placeholder="Austin"/></div>
            <div class="f" style="width:140px;"><label>State / Province</label><input type="text" id="ts-state" value="${esc((s.city_state||'').split(',')[1]?.trim()||'')}" placeholder="TX"/></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Traffic Targets</div>
          <div class="card"><div class="form-row" style="gap:16px 20px;">
            <div class="f" style="width:130px;min-width:120px;"><label>Google Rating ${tt('t-google-rating')}</label><div class="fw"><input class="suf" type="number" id="ts-gr" value="${t.google_rating??4.3}" step="0.1" min="1" max="5"/><span class="suf">★</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>New Reviews/Mo ${tt('t-review-vel')}</label><div class="fw"><input class="suf" type="number" id="ts-rv" value="${t.review_velocity??8}" step="1"/><span class="suf">/mo</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>Response Rate ${tt('t-response-rate')}</label><div class="fw"><input class="suf" type="number" id="ts-rr" value="${t.response_rate??75}" step="1"/><span class="suf">%</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>Monthly Sessions ${tt('t-monthly-sessions')}</label><div class="fw"><input class="suf" type="number" id="ts-ms" value="${t.monthly_sessions??2000}" step="100"/><span class="suf">/mo</span></div></div>
            <div class="f" style="width:130px;min-width:120px;"><label>Social Posts/Mo ${tt('t-social-posts')}</label><div class="fw"><input class="suf" type="number" id="ts-sp" value="${t.social_posts_month??12}" step="1"/><span class="suf">posts</span></div></div>
          </div></div>
        </div>
        <div class="settings-section"><div class="settings-title">Account</div>
          <div class="card">
            <div class="form-row" style="gap:16px;">
              <div class="f" style="width:220px;"><label>New Password</label><div class="fw"><input class="suf" type="password" id="ts-pw1" placeholder="Enter new password" autocomplete="new-password" /><button type="button" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);margin-left:6px;padding:0 9px;cursor:pointer;color:var(--t3);display:flex;align-items:center;flex-shrink:0;" id="ts-pw1-eye" onclick="const i=document.getElementById('ts-pw1');const e=document.getElementById('ts-pw1-eye');i.type=i.type==='password'?'text':'password';e.style.color=i.type==='text'?'var(--gold)':'var(--t3)';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button></div></div>
              <div class="f" style="width:220px;"><label>Confirm Password</label><div class="fw"><input class="suf" type="password" id="ts-pw2" placeholder="Confirm new password" autocomplete="new-password" /><button type="button" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);margin-left:6px;padding:0 9px;cursor:pointer;color:var(--t3);display:flex;align-items:center;flex-shrink:0;" id="ts-pw2-eye" onclick="const i=document.getElementById('ts-pw2');const e=document.getElementById('ts-pw2-eye');i.type=i.type==='password'?'text':'password';e.style.color=i.type==='text'?'var(--gold)':'var(--t3)';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button></div></div>
              <div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost" id="ts-pw-btn">Update Password</button></div>
            </div>
            <div id="ts-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>
          </div>
        </div>
        <div class="settings-section"><div class="settings-title">Testing Tools</div>
          <div class="card">
            <div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Load realistic sample data across every Traffic section to test calculations and screen layouts. Clear traffic data to wipe this module and start fresh with your real numbers.</div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-ghost" id="ts-load-sample">Load Sample Data</button>
              <button class="btn btn-danger" id="ts-clear-all">Clear Traffic Data</button>
            </div>
            <div id="ts-test-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>
          </div>
        </div>
        <div id="ts-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;display:none;margin-top:8px;">Settings saved.</div>
      </div>

      <div id="ts-tab-subscription" style="display:none;">
        <div id="ts-sub-content"></div>
      </div>
    </div>`;

    document.getElementById('ts-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('ts-load-sample')?.addEventListener('click', () => this.loadSample());
    document.getElementById('ts-clear-all')?.addEventListener('click', () => this.clearTraffic());

    container.querySelectorAll('.s-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const which = tab.dataset.tab;
        container.querySelectorAll('.s-tab').forEach(t2 => {
          const active = t2.dataset.tab === which;
          t2.style.color = active ? 'var(--gold)' : 'var(--t2)';
          t2.style.borderBottomColor = active ? 'var(--gold)' : 'transparent';
        });
        document.getElementById('ts-tab-general').style.display       = which === 'general'      ? '' : 'none';
        document.getElementById('ts-tab-subscription').style.display  = which === 'subscription' ? '' : 'none';
        document.getElementById('ts-save-btn').style.display          = which === 'general'      ? '' : 'none';
        if (which === 'subscription') this.renderSubscription();
      });
    });
  },

  async save() {
    const s  = App.data.settings;
    const city  = (document.getElementById('ts-city')?.value  || '').trim();
    const state = (document.getElementById('ts-state')?.value || '').trim();
    s.bar_name   = document.getElementById('ts-name')?.value || s.bar_name;
    s.city_state = city && state ? city + ', ' + state : city || state || s.city_state;

    const ts = App.data.traffic_settings || {};
    ts.targets = {
      ...(ts.targets || {}),
      google_rating:      parseFloat(document.getElementById('ts-gr')?.value) || 4.3,
      review_velocity:    parseInt(document.getElementById('ts-rv')?.value)   || 8,
      response_rate:      parseFloat(document.getElementById('ts-rr')?.value) || 75,
      monthly_sessions:   parseInt(document.getElementById('ts-ms')?.value)   || 2000,
      social_posts_month: parseInt(document.getElementById('ts-sp')?.value)   || 12,
    };
    ts._targets_saved = true;
    App.data.traffic_settings = ts;

    await App.saveKey('settings');
    await App.saveKey('traffic_settings');
    const msg = document.getElementById('ts-msg');
    if (msg) { msg.style.display='block'; setTimeout(()=>msg.style.display='none',2500); }
  },

  async changePassword() {
    const pw1 = document.getElementById('ts-pw1')?.value || '';
    const pw2 = document.getElementById('ts-pw2')?.value || '';
    const msg = document.getElementById('ts-pw-msg');
    if (!msg) return;
    if (!pw1 || pw1.length < 8) { msg.style.color='var(--red)'; msg.textContent='Password must be at least 8 characters.'; msg.style.display='block'; return; }
    if (pw1 !== pw2) { msg.style.color='var(--red)'; msg.textContent='Passwords do not match.'; msg.style.display='block'; return; }
    msg.style.color='var(--gold)'; msg.textContent='Updating...'; msg.style.display='block';
    const { error } = await DB._sb.auth.updateUser({ password: pw1 });
    if (error) { msg.style.color='var(--red)'; msg.textContent='Error: ' + error.message; }
    else { msg.style.color='var(--gold)'; msg.textContent='Password updated.'; }
  },

  async clearTraffic() {
    if (!confirm('Clear all Traffic Recovery data? This cannot be undone.')) return;
    App.data.traffic_weeks   = [];
    App.data.traffic_audits  = [];
    App.data.getting_started_traffic = {};
    App.data.traffic_settings = {
      targets: { google_rating:4.3, review_velocity:8, response_rate:75, monthly_sessions:2000, social_posts_month:12 },
      _targets_saved: false
    };
    await App.save();
    const msg = document.getElementById('ts-test-msg');
    if (msg) { msg.textContent='Traffic data cleared.'; msg.style.display='block'; setTimeout(()=>msg.style.display='none',2500); }
  },

  async loadSample() {
    const msg = document.getElementById('ts-test-msg');
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = 'Loading sample data...'; msg.style.display = 'block'; }

    App.data.settings.bar_name   = 'The Anchor Bar & Kitchen';
    App.data.settings.city_state = 'Austin, TX';

    const today = new Date();
    const wkDate = w => { const d = new Date(today); d.setDate(d.getDate() - w*7); return d.toISOString().slice(0,10); };

    // ── 8 weeks of traffic data — The Anchor Bar's digital recovery ──
    const SS = {
      google_rating:    [4.0,4.0,4.1,4.1,4.2,4.2,4.3,4.3],
      google_total:     [182,186,190,195,199,204,209,214],
      new_reviews:      [4,4,5,6,7,8,9,9],
      response_rate:    [38,45,52,60,68,74,80,82],
      yelp_rating:      [3.6,3.6,3.7,3.7,3.8,3.8,3.9,3.9],
      yelp_total:       [58,60,61,63,65,67,69,71],
      monthly_sessions: [1140,1230,1320,1440,1560,1690,1820,1920],
      bounce_rate:      [73,71,69,67,64,62,60,57],
      ig_followers:     [840,880,920,965,1010,1060,1110,1160],
      ig_posts_month:   [6,7,8,9,10,11,12,13],
      fb_followers:     [600,615,628,642,660,678,698,720],
      dd_rating:        [4.2,4.3,4.3,4.4,4.4,4.5,4.5,4.6],
      ue_rating:        [4.1,4.2,4.2,4.3,4.3,4.4,4.4,4.5],
      email_list_size:  [410,430,448,465,490,512,535,558],
      emails_sent:      [1,1,2,1,2,2,2,2],
      email_open_rate:  [16,17,18,19,20,21,22,23],
      loyalty_members:  [78,86,94,103,112,122,131,142]
    };
    const weeks = [];
    for (let i = 0; i < 8; i++) {
      weeks.push({
        id:               Date.now() + i,
        week_num:         i + 1,
        period_end:       wkDate(8 - i),
        saved_at:         new Date().toISOString(),
        google_rating:    SS.google_rating[i],
        google_total:     SS.google_total[i],
        new_reviews:      SS.new_reviews[i],
        response_rate:    SS.response_rate[i],
        yelp_rating:      SS.yelp_rating[i],
        yelp_total:       SS.yelp_total[i],
        monthly_sessions: SS.monthly_sessions[i],
        bounce_rate:      SS.bounce_rate[i],
        ig_followers:     SS.ig_followers[i],
        ig_posts_month:   SS.ig_posts_month[i],
        fb_followers:     SS.fb_followers[i],
        dd_active:        'yes', dd_rating: SS.dd_rating[i],
        ue_active:        'yes', ue_rating: SS.ue_rating[i],
        gh_active:        'no',  gh_rating: null,
        email_list_size:  SS.email_list_size[i],
        emails_sent:      SS.emails_sent[i],
        email_open_rate:  SS.email_open_rate[i],
        loyalty_active:   'yes', loyalty_members: SS.loyalty_members[i],
        notes:            ''
      });
    }
    App.data.traffic_weeks = weeks;

    // ── traffic_settings: targets + digital-presence profile ──
    App.data.traffic_settings = {
      targets: { google_rating:4.3, review_velocity:8, response_rate:75, monthly_sessions:2000, social_posts_month:12 },
      _targets_saved: true,
      profile: {
        gbp_claimed:true, gbp_hours:true, gbp_phone:true, gbp_website:true,
        gbp_menu:true, gbp_category:true, gbp_attributes:false, gbp_qa:false,
        gbp_photos:88, gbp_posts:9,
        search_maps_pack:true, search_nap:true, search_name:true, search_address:true,
        search_phone:true, search_titles:false,
        search_keyword:'austin sports bar', search_citations:34,
        web_exists:true, web_mobile:true, web_menu:true, web_online_order:true, web_reservations:false,
        web_avg_duration:96, web_top_source:'Organic Search',
        social_ig_engagement:2.4, social_fb_posts:7, social_content_mix:'Balanced',
        social_stories:true, social_reels:false,
        dd_photos:26, dd_menu:true, dd_promo:true,
        ue_photos:19, ue_menu:true, ue_promo:false,
        gh_photos:null, gh_menu:false, gh_promo:false,
        rev_age:5, rev_patterns:'A few weekend reviews mention slow service when the bar is full.',
        email_last_send: wkDate(1), email_frequency:'Monthly', email_growth:'Website signup form'
      }
    };

    // ── 1 complete Traffic Audit ──
    const d = {
      BAR_NAME:'The Anchor Bar & Kitchen', OVERALL_SCORE:60,
      DATA_TIER_LABEL:'Tier 2 Analysis, Standard Data Submitted',
      AUDIT_PERIOD:'May 2026, 4 weeks ending May 17', AUDIT_ID:'TFA-2026-0007',
      INDUSTRY_AVG:58, TARGET_SCORE:65,
      S1_SCORE:62, S1_LISTING_CLAIMED:true, S1_HOURS_COMPLETE:true, S1_WEBSITE_LINKED:true, S1_MENU_LINK_ACTIVE:true,
      S1_PHOTO_COUNT:88, S1_PHOTO_BENCHMARK:100, S1_POSTS_LAST_30_DAYS:9, S1_POSTS_BENCHMARK:8,
      S1_PROFILE_COMPLETENESS_PCT:75, S1_MONTHLY_GAP:0,
      S1_NARRATIVE:'The Google Business Profile is claimed and the core fields are filled in. Profile completeness sits at 75 percent.',
      S1_FINDING:'Two items remain open: attributes are not fully set and the Q and A section is empty. Photo count is 88, just short of the 100 benchmark.',
      S1_TOOL:'Finish the attributes and Q and A, then add a dozen photos to clear the benchmark.',
      S2_SCORE:60, S2_MOBILE_OPTIMIZED:true, S2_MONTHLY_SESSIONS:1920, S2_SESSIONS_BENCHMARK:2000,
      S2_BOUNCE_RATE:57, S2_BOUNCE_BENCHMARK:60, S2_MENU_PAGE_IN_TOP_3:true, S2_ONLINE_ORDERING_PRESENT:true, S2_MONTHLY_GAP:0,
      S2_NARRATIVE:'The website is live, mobile optimized, and carries online ordering. Monthly sessions reached 1,920.',
      S2_FINDING:'Sessions are just under the 2,000 target and there is no reservation system. Bounce rate has improved to 57 percent, which is healthy.',
      S2_TOOL:'Add a reservation system and keep local SEO work going to push sessions past 2,000.',
      S3_SCORE:66, S3_GOOGLE_RATING:4.3, S3_GOOGLE_RATING_BENCHMARK:4.3, S3_GOOGLE_REVIEW_COUNT:214,
      S3_RESPONSE_RATE:82, S3_RESPONSE_BENCHMARK:75, S3_MOST_RECENT_REVIEW_DAYS:5, S3_YELP_RATING:3.9,
      S3_UNANSWERED:6, S3_NEGATIVE_PATTERN:'Occasional slow weekend service', S3_MONTHLY_GAP:0,
      S3_NARRATIVE:'Google rating is 4.3, at target, on 214 reviews. Response rate has climbed to 82 percent.',
      S3_FINDING:'Yelp lags at 3.9 and six reviews are still unanswered. A few weekend reviews mention slow service.',
      S3_TOOL:'Answer the open reviews this week and address the weekend service pattern at the operational level.',
      S4_SCORE:64, S4_MAPS_PACK_CONFIRMED:true, S4_NAP_CONSISTENT:true,
      S4_NAP_BUSINESS_NAME:'The Anchor Bar & Kitchen', S4_PRIMARY_KEYWORD:'austin sports bar',
      S4_NARRATIVE:'The listing is confirmed in the Google Maps 3-pack and NAP is consistent across directories.',
      S4_FINDING:'Citation count is 34, below the 40 benchmark, and website page titles have not been assessed for the primary keyword.',
      S4_TOOL:'Build citations toward 40 and rewrite page titles around the phrase austin sports bar.',
      S5_SCORE:63, S5_IG_FOLLOWERS:1160, S5_IG_POSTS_LAST_30:13, S5_IG_POSTS_BENCHMARK:12,
      S5_FB_FOLLOWERS:720, S5_CONTENT_TYPE:'Balanced mix of food, staff, and events', S5_MONTHLY_GAP:0,
      S5_NARRATIVE:'Instagram posting hit 13 in the last 30 days, above the 12 target, with engagement at 2.4 percent.',
      S5_FINDING:'Reels are not being used, and Reels carry the most organic reach on Instagram right now.',
      S5_TOOL:'Add one Reel per week alongside the current grid posts.',
      S6_SCORE:55, S6_DOORDASH_ACTIVE:true, S6_UBEREATS_ACTIVE:true, S6_GRUBHUB_ACTIVE:false,
      S6_DOORDASH_RATING:4.6, S6_UBEREATS_RATING:4.5, S6_PHOTO_COUNT_DELIVERY:45,
      S6_MENU_COMPLETE:true, S6_PROMO_ACTIVE:true, S6_MONTHLY_GAP:0,
      S6_NARRATIVE:'DoorDash and Uber Eats are both active and well rated, at 4.6 and 4.5 stars.',
      S6_FINDING:'Grubhub is not active at all, and delivery photo coverage is thin across both live platforms.',
      S6_TOOL:'List on Grubhub and add item photos until every menu item on every platform has one.',
      S7_SCORE:57, S7_EMAIL_LIST_EXISTS:true, S7_LIST_SIZE:558, S7_LIST_BENCHMARK:500,
      S7_LAST_SEND_DAYS_AGO:9, S7_SEND_FREQUENCY:'Monthly', S7_OPEN_RATE:23, S7_OPEN_BENCHMARK:20,
      S7_GROWTH_MECHANISM:'Website signup form', S7_LOYALTY_PROGRAM:true, S7_MONTHLY_GAP:0,
      S7_NARRATIVE:'An email list of 558 contacts is in place, with a loyalty program running and 142 members.',
      S7_FINDING:'Email goes out only monthly, and the 23 percent open rate, while above benchmark, has room to grow.',
      S7_TOOL:'Move to twice-monthly sends and tighten subject lines to lift opens.'
    };
    App.data.traffic_audits = [{
      id: App.uid(),
      date: wkDate(0),
      overall_score: 60,
      bar_name: 'The Anchor Bar & Kitchen',
      audit_id: 'TFA-2026-0007',
      audit_period: 'May 2026, 4 weeks ending May 17',
      grade: 'Tier 2 Analysis, Standard Data Submitted',
      sections: {
        'Google Business Profile':62, 'Website':60, 'Reviews':66, 'Search and SEO':64,
        'Social Media':63, 'Delivery Platforms':55, 'Email and Loyalty':57
      },
      action_items: [
        { action:'Add at least 12 photos to the Google Business Profile to pass the 100-photo benchmark.' },
        { action:'List the business on Grubhub. Two of three delivery platforms are active, leaving orders on the table.' },
        { action:'Build local citations from 34 toward 40 or more to strengthen Maps Pack ranking.' },
        { action:'Add a reservation system to the website so guests can book without calling.' },
        { action:'Rewrite website page titles around the primary keyword, austin sports bar.' }
      ],
      raw: d,
      generated_at: new Date().toISOString()
    }];

    await App.save();
    if (App.updatePeriod) App.updatePeriod();
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = 'Sample data loaded. Every Traffic section is populated.'; }
  },

  renderSubscription() {
    const el = document.getElementById('ts-sub-content');
    if (!el) return;
    const sub = App.subscription || {};
    const status = sub.status || 'inactive';
    const plan = sub.plan || null;
    const modules = sub.active_modules || [];
    const periodEnd = sub.period_end ? new Date(sub.period_end) : null;

    const planLabels = { tier_1: '1 Module', tier_2: '2 Modules', tier_3: '3 Modules (Full Access)' };
    const moduleLabels = { profit: 'Profit Recovery', revenue: 'Revenue Recovery', traffic: 'Traffic Recovery' };
    const statusColor = { active: 'var(--gold)', past_due: 'var(--red)', canceled: 'var(--red)', inactive: 'var(--t2)' };
    const statusLabel = { active: 'Active', past_due: 'Past Due', canceled: 'Canceled', inactive: 'No Active Subscription' };
    const allModules = ['profit', 'revenue', 'traffic'];
    const hasAll = allModules.every(m => modules.includes(m));

    let moduleRows = allModules.map(m => {
      const on = modules.includes(m);
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + (on ? 'var(--gold)' : 'var(--t2)') + ';flex-shrink:0;"></div>'
        + '<div style="font-size:13px;color:' + (on ? 'var(--t1)' : 'var(--t2)') + ';">' + moduleLabels[m] + '</div>'
        + '<div style="margin-left:auto;font-size:11px;font-weight:700;letter-spacing:1px;color:' + (on ? 'var(--gold)' : 'var(--t2)') + ';">' + (on ? 'ACTIVE' : 'AVAILABLE') + '</div>'
        + '</div>';
    }).join('');

    let billingLine = '';
    if (periodEnd && status === 'active') {
      billingLine = '<div style="font-size:12px;color:var(--t2);margin-top:4px;">Renews ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    } else if (periodEnd && status === 'canceled') {
      billingLine = '<div style="font-size:12px;color:var(--red);margin-top:4px;">Access ends ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    }

    let upgradeBlock = '';
    if (status === 'active' && !hasAll) {
      upgradeBlock = '<div class="card" style="margin-top:0;">'
        + '<div class="settings-title" style="margin-bottom:12px;">Add More Modules</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Unlock Profit Recovery or Revenue Recovery to get a full picture of where your bar is bleeding money.</div>'
        + '<button class="btn btn-primary" id="ts-upgrade-btn">View Upgrade Options</button>'
        + '</div>';
    }

    let noSubBlock = '';
    if (status === 'inactive' || status === 'canceled') {
      noSubBlock = '<div class="card" style="margin-top:0;">'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">You do not have an active subscription. Return to the Recovery Hub to choose a plan.</div>'
        + '<button class="btn btn-primary" id="ts-go-hub-btn">Go to Recovery Hub</button>'
        + '</div>';
    }

    el.innerHTML = '<div class="settings-section" style="display:flex;flex-direction:column;gap:16px;">'
      + '<div class="card">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--t1);">' + (plan ? planLabels[plan] : 'No Plan') + '</div>'
      + '<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:' + (statusColor[status] || 'var(--t2)') + ';margin-top:4px;text-transform:uppercase;">' + (statusLabel[status] || status) + '</div>'
      + billingLine
      + '</div>'
      + (status === 'active'
        ? '<button class="btn btn-ghost" id="ts-portal-btn" style="flex-shrink:0;">Manage Billing</button>'
        : '')
      + '</div>'
      + '<div style="margin-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t2);margin-bottom:8px;text-transform:uppercase;">Recovery Modules</div>'
      + moduleRows
      + '</div>'
      + '</div>'
      + upgradeBlock
      + noSubBlock
      + '</div>';

    document.getElementById('ts-portal-btn')?.addEventListener('click', () => this.openBillingPortal());
    document.getElementById('ts-upgrade-btn')?.addEventListener('click', () => App.showHub());
    document.getElementById('ts-go-hub-btn')?.addEventListener('click', () => App.showHub());
  },

  async openBillingPortal() {
    const btn = document.getElementById('ts-portal-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening...'; }
    try {
      const userId = DB._sb?.auth?.getUser ? (await DB._sb.auth.getUser()).data?.user?.id : null;
      if (!userId) throw new Error('Not logged in.');
      const res = await fetch('/api/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open billing portal.');
      window.open(data.url, '_blank');
    } catch (e) {
      alert('Could not open billing portal: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Manage Billing'; }
    }
  }
};
