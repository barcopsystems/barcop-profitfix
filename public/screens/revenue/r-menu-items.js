'use strict';
S.RevenueMenuItems = {
  editing: null,

  render(container, actions) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', () => this.showForm(container, actions, null));
    actions.appendChild(addBtn);
    this.renderList(container, actions);
  },

  renderList(container, actions) {
    const items = App.data.revenue_menu_items || [];
    const cats  = ['All','Appetizers','Entrees','Desserts','Cocktails','Beer','Wine','NA Beverages','Specials','Other'];

    const incomplete = items.filter(i => !i.price || !i.cost).length;

    const rows = items.map((item, idx) => {
      const cm  = item.price && item.cost ? (item.price - item.cost) : null;
      const pct = item.price && item.cost ? (item.cost / item.price * 100).toFixed(1) : null;
      const ok  = item.price && item.cost;
      return '<tr class="' + (!ok ? 'row-incomplete' : '') + '">'
        + '<td style="font-weight:600;color:' + (ok ? 'var(--t1)' : 'var(--red)') + ';">' + esc(item.name) + (!ok ? ' <span style="font-size:10px;font-weight:700;color:var(--red);">INCOMPLETE</span>' : '') + '</td>'
        + '<td>' + esc(item.category||'') + '</td>'
        + '<td>' + (item.price ? App.fmtCurrency(item.price) : '—') + '</td>'
        + '<td>' + (item.cost  ? App.fmtCurrency(item.cost)  : '—') + '</td>'
        + '<td>' + (pct ? pct + '%' : '—') + '</td>'
        + '<td>' + (cm  ? App.fmtCurrency(cm) : '—') + '</td>'
        + '<td>' + (item.weekly_covers ? item.weekly_covers : '—') + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button class="btn btn-ghost btn-sm ri-edit" data-idx="' + idx + '" style="margin-right:4px;">Edit</button>'
        + '<button class="btn btn-danger btn-sm ri-del" data-idx="' + idx + '">Del</button>'
        + '</td></tr>';
    }).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No menu items yet. Add your first item to get started.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + (incomplete > 0 ? '<div class="alert-bar"><div class="alert-text">' + incomplete + ' item' + (incomplete > 1 ? 's' : '') + ' missing price or cost. Incomplete items cannot be used in Menu Engineering.</div></div>' : '')
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Item Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Contrib. Margin</th><th>Wkly Covers</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    container.querySelectorAll('.ri-edit').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(container, actions, parseInt(btn.dataset.idx)));
    });
    container.querySelectorAll('.ri-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this item?')) return;
        App.data.revenue_menu_items.splice(parseInt(btn.dataset.idx), 1);
        await App.saveKey('revenue_menu_items');
        this.render(container, actions);
      });
    });
  },

  showForm(container, actions, idx) {
    const items = App.data.revenue_menu_items || [];
    const item  = idx !== null ? items[idx] : null;
    const cats  = ['Appetizers','Entrees','Desserts','Cocktails','Beer','Wine','NA Beverages','Specials','Other'];
    const catOpts = cats.map(c => '<option' + (item?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">' + (item ? 'Edit Item' : 'Add Menu Item') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
      + '<div class="f w-lg"><label>Item Name</label><input type="text" id="ri-name" value="' + esc(item?.name||'') + '" placeholder="House Burger"/></div>'
      + '<div class="f w-md"><label>Category</label><select id="ri-cat" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option value="">Select...</option>' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
      + '<div class="f w-md"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-price" value="' + (item?.price||'') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Food / Pour Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-cost" value="' + (item?.cost||'') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>Avg Weekly Covers</label><input type="number" id="ri-cov" value="' + (item?.weekly_covers||'') + '" placeholder="0"/></div>'
      + '</div>'
      + '<div id="ri-calc" style="margin-bottom:16px;"></div>'
      + '<div class="f" style="margin-bottom:16px;"><label>Notes</label><input type="text" id="ri-notes" value="' + esc(item?.notes||'') + '" placeholder="Optional"/></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
      + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
      + '</div></div></div>';

    const calc = () => {
      const price = parseFloat(document.getElementById('ri-price')?.value) || 0;
      const cost  = parseFloat(document.getElementById('ri-cost')?.value)  || 0;
      const el    = document.getElementById('ri-calc');
      if (!el || !price || !cost) { if(el) el.innerHTML=''; return; }
      const pct = (cost / price * 100).toFixed(1);
      const cm  = (price - cost).toFixed(2);
      el.innerHTML = '<div style="background:var(--input);border-radius:6px;padding:10px 16px;display:flex;gap:20px;">'
        + '<div><div style="font-size:10px;color:var(--t3);">Cost %</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + pct + '%</div></div>'
        + '<div><div style="font-size:10px;color:var(--t3);">Contribution Margin</div><div style="font-size:16px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(parseFloat(cm)) + '</div></div>'
        + '</div>';
    };

    ['ri-price','ri-cost'].forEach(id => document.getElementById(id)?.addEventListener('input', calc));
    if (item) calc();

    document.getElementById('ri-cancel')?.addEventListener('click', () => this.render(container, actions));
    document.getElementById('ri-save')?.addEventListener('click', async () => {
      const name = document.getElementById('ri-name')?.value.trim();
      if (!name) return;
      const entry = {
        id:            item?.id || App.uid(),
        name,
        category:      document.getElementById('ri-cat')?.value    || '',
        price:         parseFloat(document.getElementById('ri-price')?.value) || 0,
        cost:          parseFloat(document.getElementById('ri-cost')?.value)  || 0,
        weekly_covers: parseFloat(document.getElementById('ri-cov')?.value)   || 0,
        notes:         document.getElementById('ri-notes')?.value   || '',
      };
      if (!App.data.revenue_menu_items) App.data.revenue_menu_items = [];
      if (idx !== null) App.data.revenue_menu_items[idx] = entry;
      else App.data.revenue_menu_items.push(entry);
      await App.saveKey('revenue_menu_items');
      this.render(container, actions);
    });
  }
};
