'use strict';
S.TrafficSearch = {
  // Local SEO assessment — stored in traffic_settings.profile
  TOGGLES: [
    ['search_maps_pack', 'Confirmed in the Google Maps 3-pack'],
    ['search_nap',       'Name, address, phone consistent everywhere'],
    ['search_name',      'Business name correct on Google'],
    ['search_address',   'Address correct on Google'],
    ['search_phone',     'Phone number correct on Google'],
    ['search_titles',    'Website page titles assessed for keywords']
  ],
  CITATION_BENCHMARK: 40,

  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts   = App.data.traffic_settings || {};
    const prof = ts.profile || {};

    const checked  = this.TOGGLES.filter(([k]) => prof[k]).length;
    const score    = Math.round(checked / this.TOGGLES.length * 100);
    const citations = prof.search_citations != null ? prof.search_citations : null;
    const keyword   = prof.search_keyword || '';

    // ── Metric cards ──
    const card = (label, valHtml, targetStr) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + targetStr + '</div><div class="metric-trend"> </div></div>';
    const onTargetVal = (val, ok) => '<div class="metric-val ' + (ok ? 'on-target' : 'over-target') + '">' + val + '</div>';
    const noData = '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';

    const cards =
        card('Local SEO Score', '<div class="metric-val" style="color:' + App.scoreColor(score) + ';">' + score + '%</div>', checked + ' of ' + this.TOGGLES.length + ' checks pass')
      + card('Maps Pack',       onTargetVal(prof.search_maps_pack ? 'In Pack' : 'Not In Pack', !!prof.search_maps_pack), 'Goal: in the 3-pack')
      + card('NAP Consistency', onTargetVal(prof.search_nap ? 'Consistent' : 'Inconsistent', !!prof.search_nap), 'Goal: consistent')
      + card('Citations',       citations != null ? onTargetVal(citations.toLocaleString(), citations >= this.CITATION_BENCHMARK) : noData, 'Benchmark: ' + this.CITATION_BENCHMARK + '+');

    // ── Assessment form ──
    const toggleRows = this.TOGGLES.map(([k, label]) =>
      '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="srch-tog" data-key="' + k + '"' + (prof[k] ? ' checked' : '')
      + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>'
      + label + '</label>'
    ).join('');

    const formCard = '<div class="card">'
      + '<div class="card-title">Local Search Assessment</div>'
      + reviewedNote(prof.search_reviewed_at)
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:16px;">' + toggleRows + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:230px;"><label>Primary Local Keyword ' + tt('t-search-keyword') + '</label><input type="text" id="srch-keyword" value="' + esc(keyword) + '" placeholder="austin sports bar"/></div>'
      + '<div class="f" style="width:170px;"><label>Citation Count ' + tt('t-search-citations') + '</label><div class="fw"><input class="suf" type="number" id="srch-citations" value="' + (citations != null ? citations : '') + '" min="0"/><span class="suf">listings</span></div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="srch-save">Save Assessment</button>'
      + '<span id="srch-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (!prof.search_maps_pack) tips.push('Not confirmed in the Google Maps 3-pack. The 3-pack is where most local discovery happens — a complete, active Google Business Profile is how you get there.');
    if (!prof.search_nap) tips.push('NAP is inconsistent. Your business name, address, and phone must match exactly across Google, Yelp, Apple Maps, and every directory. Mismatches confuse search engines.');
    if (!prof.search_name) tips.push('Business name on Google needs correcting.');
    if (!prof.search_address) tips.push('Address on Google needs correcting.');
    if (!prof.search_phone) tips.push('Phone number on Google needs correcting.');
    if (!prof.search_titles) tips.push('Website page titles have not been assessed. Each page title should name your city and cuisine, for example "Austin Sports Bar and Kitchen".');
    if (!keyword.trim()) tips.push('No primary local keyword set. Pick the phrase a guest would search, such as "austin sports bar".');
    if (citations != null && citations < this.CITATION_BENCHMARK) tips.push('Citation count is ' + citations + ', below the ' + this.CITATION_BENCHMARK + ' benchmark. List the business on more directories to build local authority.');
    if (citations == null) tips.push('Enter a citation count estimate above to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Local Search Is Solid</div>'
        + '<div class="empty-sub">Every local search check passes and citations are on benchmark. Re-check NAP consistency once a quarter.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + formCard
      + tipsCard
      + '</div>';

    document.getElementById('srch-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    this.container.querySelectorAll('.srch-tog').forEach(cb => { prof[cb.dataset.key] = cb.checked; });
    prof.search_keyword = document.getElementById('srch-keyword')?.value || '';
    const cit = parseInt(document.getElementById('srch-citations')?.value);
    prof.search_citations = isNaN(cit) ? null : cit;
    prof.search_reviewed_at = new Date().toISOString();
    const ok = await App.saveKey('traffic_settings');
    this.draw();
    const msg = document.getElementById('srch-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
