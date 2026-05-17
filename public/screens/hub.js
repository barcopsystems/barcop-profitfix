'use strict';

S.Hub = {
  render(container) {
    const sub = App.subscription || {};
    const modules = sub.active_modules || [];
    const hasProfit  = modules.includes('profit');
    const hasRevenue = modules.includes('revenue');
    const hasTraffic = modules.includes('traffic');

    const planLabel = sub.status === 'active'
      ? (sub.plan === 'tier_3' ? 'All 3 Modules' : sub.plan === 'tier_2' ? '2 Modules' : '1 Module')
      : null;

    container.innerHTML = `
      <div class="screen">
        <div style="max-width:860px;margin:0 auto;">

          <div style="margin-bottom:32px;">
            <div style="font-size:22px;font-weight:700;color:var(--t1);margin-bottom:6px;">
              Welcome to Bar Cop Recovery
            </div>
            <div style="font-size:14px;color:var(--t3);">
              ${sub.status === 'active'
                ? 'Your active plan: <span style="color:var(--gold);font-weight:600;">' + planLabel + '</span>'
                : 'Choose a Recovery module below to get started.'}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-bottom:40px;">
            ${this._moduleCard('profit',  'Profit Recovery',  hasProfit,  '📊', 'Pour cost, food cost, theft risk, prime cost — find and fix where money is leaking.', ['Pour Cost Control','Food Cost Tracking','Variance Analysis','Vendor Watch','Cash Reconciliation','Monthly Profit Audit'])}
            ${this._moduleCard('revenue', 'Revenue Recovery', hasRevenue, '💰', 'Menu engineering, server performance, labor efficiency — grow what you keep.', ['Menu Engineering','Check Average Tracking','Server Performance','Labor Cost Control','Event Revenue','Schedule Builder'])}
            ${this._moduleCard('traffic', 'Traffic Recovery', hasTraffic, '📍', 'Google presence, reviews, social, delivery platforms — bring more guests through the door.', ['Google Business Profile','Review Management','Social Calendar','Website Conversion','Delivery Platforms','Email Marketing'])}
          </div>

          ${sub.status !== 'active' ? `
          <div style="background:var(--surface);border:1px solid var(--b);border-radius:10px;padding:24px;max-width:560px;">
            <div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:6px;">Choose your plan</div>
            <div style="font-size:13px;color:var(--t3);margin-bottom:20px;">Start with the area hurting most. Upgrade anytime from inside the app.</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
              ${this._planCard('tier_1','1 Module','$99','/ month','price_1TY9KKGow04S066UBHLhPLNK')}
              ${this._planCard('tier_2','2 Modules','$149','/ month','price_1TY9KgGow04S066Urrd6TwGP')}
              ${this._planCard('tier_3','All 3','$189','/ month','price_1TY9L4Gow04S066UnAxs4K8Q')}
            </div>
            <div id="hub-module-select" style="display:none;margin-bottom:16px;">
              <div style="font-size:13px;color:var(--t2);margin-bottom:10px;font-weight:500;">Which module(s) do you want?</div>
              <div id="hub-module-checkboxes"></div>
            </div>
            <button class="btn btn-primary" id="hub-checkout-btn" style="width:100%;display:none;">Start Subscription</button>
            <div id="hub-checkout-error" style="color:var(--red);font-size:12px;margin-top:8px;display:none;"></div>
          </div>
          ` : ''}

        </div>
      </div>

      <!-- Upgrade modal for locked modules -->
      <div id="hub-upgrade-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--surface);border:1px solid var(--b);border-radius:12px;padding:32px;max-width:480px;width:90%;position:relative;">
          <button onclick="document.getElementById('hub-upgrade-modal').style.display='none'" style="position:absolute;top:14px;right:16px;background:none;border:none;color:var(--t3);font-size:20px;cursor:pointer;">×</button>
          <div style="font-size:18px;font-weight:700;color:var(--t1);margin-bottom:6px;" id="modal-title">Unlock Revenue Recovery</div>
          <div style="font-size:13px;color:var(--t3);margin-bottom:24px;" id="modal-sub">Add this module to your plan.</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
            ${this._planCard('tier_1','1 Module','$99','/ month','price_1TY9KKGow04S066UBHLhPLNK',true)}
            ${this._planCard('tier_2','2 Modules','$149','/ month','price_1TY9KgGow04S066Urrd6TwGP',true)}
            ${this._planCard('tier_3','All 3','$189','/ month','price_1TY9L4Gow04S066UnAxs4K8Q',true)}
          </div>
          <div id="modal-module-select" style="display:none;margin-bottom:16px;">
            <div style="font-size:13px;color:var(--t2);margin-bottom:10px;font-weight:500;">Which module(s)?</div>
            <div id="modal-module-checkboxes"></div>
          </div>
          <button class="btn btn-primary" id="modal-checkout-btn" style="width:100%;display:none;">Start Subscription</button>
          <div id="modal-checkout-error" style="color:var(--red);font-size:12px;margin-top:8px;display:none;"></div>
        </div>
      </div>
    `;

    this._wireCards(hasProfit, hasRevenue, hasTraffic);
    this._wirePlanSelector('hub');
    this._wirePlanSelector('modal');
  },

  _moduleCard(id, name, active, icon, desc, features) {
    return `
      <div class="hub-module-card ${active ? 'active' : 'locked'}" id="hub-card-${id}" style="
        background:var(--surface);
        border:1px solid ${active ? 'var(--gold)' : 'var(--b)'};
        border-radius:12px;padding:24px;cursor:pointer;
        transition:border-color 0.15s,transform 0.15s;
        position:relative;
      ">
        ${!active ? '<div style="position:absolute;top:14px;right:14px;background:var(--input);border:1px solid var(--b);border-radius:6px;padding:2px 8px;font-size:11px;color:var(--t3);font-weight:600;">LOCKED</div>' : ''}
        <div style="font-size:28px;margin-bottom:12px;">${icon}</div>
        <div style="font-size:16px;font-weight:700;color:${active ? 'var(--gold)' : 'var(--t2)'};margin-bottom:8px;">${name}</div>
        <div style="font-size:13px;color:var(--t3);margin-bottom:16px;line-height:1.5;">${desc}</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:18px;">
          ${features.map(f => `<div style="font-size:12px;color:${active ? 'var(--t2)' : 'var(--t3)'};display:flex;align-items:center;gap:6px;">
            <span style="color:${active ? 'var(--gold)' : 'var(--b)'};">✓</span>${f}
          </div>`).join('')}
        </div>
        <div style="font-size:13px;font-weight:600;color:${active ? 'var(--gold)' : 'var(--t3)'};">
          ${active ? '→ Enter Module' : 'Upgrade to Unlock'}
        </div>
      </div>
    `;
  },

  _planCard(tierId, label, price, period, priceId, inModal = false) {
    const prefix = inModal ? 'modal' : 'hub';
    return `
      <div class="hub-plan-card" data-tier="${tierId}" data-price-id="${priceId}" data-prefix="${prefix}" style="
        background:var(--input);border:2px solid var(--b);border-radius:8px;
        padding:14px 10px;text-align:center;cursor:pointer;transition:border-color 0.15s;
      ">
        <div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:4px;">${label}</div>
        <div style="font-size:20px;font-weight:800;color:var(--t1);">${price}</div>
        <div style="font-size:11px;color:var(--t3);">${period}</div>
      </div>
    `;
  },

  _wireCards(hasProfit, hasRevenue, hasTraffic) {
    const wire = (id, active, screen) => {
      const card = document.getElementById('hub-card-' + id);
      if (!card) return;
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      card.addEventListener('click', () => {
        if (active) {
          App.navigate(screen);
        } else {
          const modal = document.getElementById('hub-upgrade-modal');
          document.getElementById('modal-title').textContent = 'Unlock ' + card.querySelector('[style*="font-size:16px"]').textContent;
          modal.style.display = 'flex';
          this._wirePlanSelector('modal');
        }
      });
    };
    wire('profit',  hasProfit,  'dashboard');
    wire('revenue', hasRevenue, 'dashboard');
    wire('traffic', hasTraffic, 'dashboard');
  },

  _wirePlanSelector(prefix) {
    const cards = document.querySelectorAll(`.hub-plan-card[data-prefix="${prefix}"]`);
    let selectedTier = null;
    let selectedPriceId = null;

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.style.borderColor = 'var(--b)');
        card.style.borderColor = 'var(--gold)';
        selectedTier    = card.dataset.tier;
        selectedPriceId = card.dataset.priceId;

        const slots = selectedTier === 'tier_3' ? 3 : selectedTier === 'tier_2' ? 2 : 1;
        const selectDiv   = document.getElementById(prefix + '-module-select');
        const checkboxDiv = document.getElementById(prefix + '-module-checkboxes');
        const checkoutBtn = document.getElementById(prefix + '-checkout-btn');

        const allMods = [
          { id: 'profit',  label: 'Profit Recovery' },
          { id: 'revenue', label: 'Revenue Recovery' },
          { id: 'traffic', label: 'Traffic Recovery' },
        ];

        checkboxDiv.innerHTML = allMods.map(m => `
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:13px;color:var(--t2);">
            <input type="checkbox" value="${m.id}" class="mod-check-${prefix}" style="accent-color:var(--gold);" ${slots === 3 ? 'checked disabled' : ''}/>
            ${m.label}
          </label>
        `).join('');

        selectDiv.style.display = 'block';
        checkoutBtn.style.display = 'block';

        if (slots < 3) {
          const checks = document.querySelectorAll(`.mod-check-${prefix}`);
          checks.forEach(cb => {
            cb.addEventListener('change', () => {
              const checked = [...document.querySelectorAll(`.mod-check-${prefix}:checked`)];
              if (checked.length > slots) { cb.checked = false; }
            });
          });
        }

        checkoutBtn.onclick = () => this._startCheckout(prefix, selectedPriceId, selectedTier);
      });
    });
  },

  async _startCheckout(prefix, priceId, tier) {
    const btn = document.getElementById(prefix + '-checkout-btn');
    const err = document.getElementById(prefix + '-checkout-error');
    const slots = tier === 'tier_3' ? 3 : tier === 'tier_2' ? 2 : 1;

    let selectedMods;
    if (slots === 3) {
      selectedMods = ['profit','revenue','traffic'];
    } else {
      selectedMods = [...document.querySelectorAll(`.mod-check-${prefix}:checked`)].map(c => c.value);
      if (selectedMods.length === 0) {
        err.textContent = 'Please select which module(s) you want.';
        err.style.display = 'block';
        return;
      }
      if (selectedMods.length !== slots) {
        err.textContent = `Please select exactly ${slots} module${slots > 1 ? 's' : ''}.`;
        err.style.display = 'block';
        return;
      }
    }

    err.style.display = 'none';
    btn.textContent = 'Redirecting to checkout...';
    btn.disabled = true;

    try {
      const userId = DB._user?.id;
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId, modules: selectedMods })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Checkout failed');
      }
    } catch (e) {
      err.textContent = e.message;
      err.style.display = 'block';
      btn.textContent = 'Start Subscription';
      btn.disabled = false;
    }
  }
};
