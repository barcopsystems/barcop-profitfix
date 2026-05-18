'use strict';
const Onboarding = {
  SIZES: [
    {g:'Spirits',l:'50ml (1.7 oz)',oz:1.7},{g:'Spirits',l:'200ml (6.8 oz)',oz:6.8},
    {g:'Spirits',l:'375ml (12.7 oz)',oz:12.7},{g:'Spirits',l:'750ml (25.4 oz)',oz:25.4},
    {g:'Spirits',l:'1L (33.8 oz)',oz:33.8},{g:'Spirits',l:'1.75L (59.2 oz)',oz:59.2},
    {g:'Wine',l:'187ml (6.3 oz)',oz:6.3},{g:'Wine',l:'375ml (12.7 oz)',oz:12.7},
    {g:'Wine',l:'750ml (25.4 oz)',oz:25.4},{g:'Wine',l:'1.5L (50.7 oz)',oz:50.7},
    {g:'Beer',l:'12 oz',oz:12},{g:'Beer',l:'16 oz',oz:16},{g:'Beer',l:'22 oz bomber',oz:22},
    {g:'Beer',l:'32 oz crowler',oz:32},{g:'Beer',l:'40 oz',oz:40},
    {g:'Draft Keg',l:'1/6 keg (661 oz)',oz:661},{g:'Draft Keg',l:'1/4 keg (992 oz)',oz:992},
    {g:'Draft Keg',l:'1/2 keg (1984 oz)',oz:1984},{g:'Other',l:'Custom (enter oz)',oz:null}
  ],
  sizeOpts() {
    let g = '', h = '<option value="">Select size...</option>';
    this.SIZES.forEach(s => {
      if (s.g !== g) { if (g) h += '</optgroup>'; h += '<optgroup label="' + s.g + '">'; g = s.g; }
      const v = s.oz !== null ? s.oz : 'custom';
      h += '<option value="' + v + '">' + s.l + '</option>';
    });
    if (g) h += '</optgroup>';
    return h;
  },
  start() {
    document.getElementById('ob-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    this.render();
  },
  render() {
    const s = App.data.settings;
    const cityParts = (s.city_state || '').split(',').map(p => p.trim());
    const cityVal  = cityParts[0] || '';
    const stateVal = cityParts[1] || '';

    document.getElementById('ob-content').innerHTML =
      '<div class="ob-heading" style="text-align:center;margin-bottom:8px;">Welcome to Bar Cop</div>'
      + '<div class="ob-sub" style="text-align:center;margin-bottom:28px;">Enter your establishment name and we will get you straight into your Recovery Hub.</div>'
      + '<div style="display:flex;gap:14px;margin-bottom:14px;">'
      + '<div class="f" style="flex:2;"><label>Bar / Restaurant Name</label><input type="text" id="ob-name" value="' + esc(s.bar_name || '') + '" placeholder="The Rusty Nail" /></div>'
      + '<div class="f" style="flex:1.2;"><label>City</label><input type="text" id="ob-city" value="' + esc(cityVal) + '" placeholder="Austin" /></div>'
      + '<div class="f" style="flex:0.8;"><label>State / Province</label><input type="text" id="ob-state" value="' + esc(stateVal) + '" placeholder="TX" /></div>'
      + '</div>'
      + '<div id="ob-err" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none;"></div>'
      + '<div class="ob-actions" style="margin-top:20px;"><button class="btn btn-primary btn-lg" style="width:100%;" id="ob-finish">Enter Recovery Hub</button></div>';

    document.getElementById('ob-name')?.focus();

    document.getElementById('ob-finish')?.addEventListener('click', () => {
      const name  = document.getElementById('ob-name')?.value.trim();
      const city  = document.getElementById('ob-city')?.value.trim();
      const state = document.getElementById('ob-state')?.value.trim();
      if (!name) {
        const e = document.getElementById('ob-err');
        if (e) { e.textContent = 'Please enter your bar or restaurant name.'; e.style.display = 'block'; }
        return;
      }
      App.data.settings.bar_name   = name;
      App.data.settings.city_state = city && state ? city + ', ' + state : city || state || '';
      App.data.settings.onboarding_complete = true;
      App.saveKey('settings').then(() => App.showHub());
    });

    document.getElementById('ob-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('ob-finish')?.click();
    });
  }
};
