'use strict';
S.ShiftCheck = {
  _calc: null, _entryId: null,

  render(container, actions) {
    this._entryId = App.uid();
    this._calc = null;
    const now = new Date();
    const h = now.getHours();
    const shift = h<14?'AM':h<20?'PM':'Late';
    const today = now.toISOString().slice(0,10);
    const target = App.data.settings.targets?.bar_pour_cost_pct ?? 22;
    const log = (App.data.shifts||[]).slice(-30).reverse();

    const logRows = log.length === 0
      ? '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--t4);">No shifts logged yet.</td></tr>'
      : log.map(s => {
          const cls = s.status==='ON TARGET'?'badge-ok':s.status?.startsWith('WATCH')?'badge-dim':'badge-warn';
          const pctCls = s.status==='ON TARGET'?'pos':s.status?.startsWith('WATCH')?'':'neg';
          return '<tr><td>'+s.date+'</td><td>'+esc(s.shift)+'</td><td>'+esc(s.bartender||'—')+'</td>'
            +'<td class="val">'+App.fmtCurrency(s.revenue)+'</td>'
            +'<td class="'+pctCls+'">'+App.fmtPct(s.pour_cost_pct)+'</td>'
            +'<td><span class="badge '+cls+'">'+esc(s.status||'—')+'</span></td></tr>';
        }).join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="card">'
      + '<div class="card-title">New Shift Entry</div>'
      + '<div class="form-row" style="flex-wrap:nowrap;gap:10px;align-items:flex-end;">'
      + '<div class="f" style="width:148px;flex-shrink:0;"><label>Date</label><input type="date" id="sc-date" value="'+today+'" style="width:100%;" /></div>'
      + '<div class="f" style="width:72px;flex-shrink:0;"><label>Shift</label><select id="sc-shift" style="width:100%;"><option'+(shift==='AM'?' selected':'')+'>AM</option><option'+(shift==='PM'?' selected':'')+'>PM</option><option'+(shift==='Late'?' selected':'')+'>Late</option></select></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Bartender</label><input type="text" id="sc-name" placeholder="Name" style="width:100%;" /></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Revenue '+tt('bar-revenue')+'</label><div class="fw" style="width:100%;"><span class="pre">$</span><input class="pre" type="number" id="sc-rev" placeholder="0" style="width:100%;" /></div></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>COGS '+tt('shift-cogs')+'</label><div class="fw" style="width:100%;"><span class="pre">$</span><input class="pre" type="number" id="sc-cogs" placeholder="0" style="width:100%;" /></div></div>'
      + '<div class="f" style="flex-shrink:0;"><label style="opacity:0;">–</label><button class="btn btn-primary" id="sc-submit" style="white-space:nowrap;">Submit</button></div>'
      + '</div>'
      + '<div id="sc-result" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--b2);">'
      + '<div style="display:flex;align-items:center;gap:40px;flex-wrap:wrap;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Shift Pour Cost</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;" id="sc-pct">—</div></div>'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Target</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;color:var(--t3);">'+target+'%</div></div>'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">$ vs Target</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:56px;font-weight:600;letter-spacing:-1px;line-height:1;" id="sc-var">—</div></div>'
      + '<div style="margin-left:auto;"><div id="sc-badge" style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:12px 18px;border-radius:4px;"></div></div>'
      + '</div></div></div>'
      + '<div class="sh">Shift Log — Last 30</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Bartender</th><th>Revenue</th><th>Pour Cost %</th><th>Status</th>'
      + '</tr></thead><tbody id="sc-log">'+logRows+'</tbody></table></div>'
      + '</div>';

    document.getElementById('sc-rev')?.addEventListener('input', ()=>this.calc());
    document.getElementById('sc-cogs')?.addEventListener('input', ()=>this.calc());
    document.getElementById('sc-submit')?.addEventListener('click', ()=>{this.calc();this.save();});
  },

  calc() {
    const rev  = parseFloat(document.getElementById('sc-rev')?.value)  || 0;
    const cogs = parseFloat(document.getElementById('sc-cogs')?.value) || 0;
    const target = App.data.settings.targets?.bar_pour_cost_pct ?? 22;
    const res = document.getElementById('sc-result');
    if (!res || rev===0) { if(res) res.style.display='none'; return; }
    res.style.display='block';
    const pct = (cogs/rev)*100;
    const diff = pct - target;
    const varD = (diff/100)*rev;
    let status, sBg, sColor, pColor;
    if (diff<=0)      { status='ON TARGET';                        sBg='rgba(201,168,76,0.12)'; sColor='#C9A84C'; pColor='#C9A84C'; }
    else if (diff<=3) { status='WATCH — SLIGHTLY OVER';            sBg='rgba(255,255,255,0.08)'; sColor='rgba(255,255,255,0.8)'; pColor='#fff'; }
    else              { status='INVESTIGATE — SIGNIFICANTLY OVER'; sBg='rgba(192,56,40,0.15)'; sColor='#C03828'; pColor='#C03828'; }
    const pEl=document.getElementById('sc-pct'),vEl=document.getElementById('sc-var'),bEl=document.getElementById('sc-badge');
    if(pEl){pEl.textContent=App.fmtPct(pct);pEl.style.color=pColor;}
    if(vEl){vEl.textContent=(varD>0?'+':'')+App.fmtCurrency(varD);vEl.style.color=diff>0?'#C03828':'#C9A84C';}
    if(bEl){bEl.textContent=status;bEl.style.background=sBg;bEl.style.color=sColor;}
    this._calc={pct,varD,status};
  },

  save() {
    if(!this._calc)return;
    const entry={id:this._entryId,date:document.getElementById('sc-date')?.value||'',shift:document.getElementById('sc-shift')?.value||'',bartender:document.getElementById('sc-name')?.value.trim()||'',revenue:parseFloat(document.getElementById('sc-rev')?.value)||0,cogs:parseFloat(document.getElementById('sc-cogs')?.value)||0,pour_cost_pct:this._calc.pct,variance_dollar:this._calc.varD,status:this._calc.status,saved_at:new Date().toISOString()};
    if(!entry.revenue)return;
    if(!App.data.shifts)App.data.shifts=[];
    const idx=App.data.shifts.findIndex(s=>s.id===entry.id);
    if(idx>-1)App.data.shifts[idx]=entry;else App.data.shifts.push(entry);
    App.saveKey('shifts').then(()=>{
      this._entryId=App.uid();
      const tbody=document.getElementById('sc-log');if(!tbody)return;
      const log=(App.data.shifts||[]).slice(-30).reverse();
      tbody.innerHTML=log.map(s=>{const cls=s.status==='ON TARGET'?'badge-ok':s.status?.startsWith('WATCH')?'badge-dim':'badge-warn';const pCls=s.status==='ON TARGET'?'pos':s.status?.startsWith('WATCH')?'':'neg';return '<tr><td>'+s.date+'</td><td>'+esc(s.shift)+'</td><td>'+esc(s.bartender||'—')+'</td><td class="val">'+App.fmtCurrency(s.revenue)+'</td><td class="'+pCls+'">'+App.fmtPct(s.pour_cost_pct)+'</td><td><span class="badge '+cls+'">'+esc(s.status||'—')+'</span></td></tr>';}).join('');
    });
  }
};
