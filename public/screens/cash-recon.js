'use strict';
S.CashRecon={
  _counted:0,
  BILLS:[100,50,20,10,5,1],
  COINS:[{l:'Quarters',v:0.25},{l:'Dimes',v:0.10},{l:'Nickels',v:0.05},{l:'Pennies',v:0.01}],
  render(container,actions){
    this.container=container;
    const exp=document.createElement('button');exp.className='btn btn-ghost btn-sm';exp.textContent='Export CSV';exp.addEventListener('click',()=>this.exportCsv());
    const sav=document.createElement('button');sav.className='btn btn-primary btn-sm';sav.textContent='Save';sav.addEventListener('click',()=>this.saveEntry());
    actions.appendChild(exp);actions.appendChild(sav);
    this.renderMain();
  },
  renderMain(){
    const tol=App.data.settings.cash_tolerance||10;
    const log=(App.data.reconciliations||[]).slice(-30).reverse();
    const bRows=this.BILLS.map(b=>'<tr><td style="color:var(--t1);font-weight:600;padding:9px 12px;">$'+b+'</td><td style="padding:5px 10px;"><input class="form-input" type="number" min="0" data-d="'+b+'" style="width:84px;" placeholder="" /></td><td style="color:var(--t2);text-align:right;padding:9px 12px;" id="ca-'+b+'">$0</td></tr>').join('');
    const cRows=this.COINS.map(c=>'<tr><td style="color:var(--t1);padding:9px 12px;">'+c.l+'</td><td style="padding:5px 10px;"><input class="form-input" type="number" min="0" data-d="'+c.v+'" style="width:84px;" placeholder="" /></td><td style="color:var(--t2);text-align:right;padding:9px 12px;" id="ca-'+c.v+'">$0</td></tr>').join('');
    const logRows=log.length===0?'<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--t4);">No entries yet.</td></tr>'
      :log.map(r=>{const os=r.over_short||0;const ok=Math.abs(os)<=r.tolerance;return '<tr><td>'+esc(r.date||'—')+'</td><td>'+esc(r.shift||'—')+'</td><td>'+esc(r.cashier||'—')+'</td><td>'+App.fmtCurrency(r.expected_cash)+'</td><td>'+App.fmtCurrency(r.counted_cash)+'</td><td class="'+(ok?'pos':(os>0?'pos':'neg'))+'">'+(os>=0?'+':'')+App.fmtCurrency(os)+'</td><td><span class="badge '+(ok?'badge-ok':'badge-warn')+'">'+(ok?'OK':os>0?'Over':'Short')+'</span></td></tr>';}).join('');

    this.container.innerHTML='<div class="screen">'
      +'<div class="card" style="margin-bottom:18px;"><div class="card-title">Shift Details</div>'
      +'<div class="form-row" style="flex-wrap:wrap;gap:16px;">'
      +'<div class="f" style="width:148px;flex-shrink:0;"><label>Date</label><input type="date" id="rc-date" value="'+new Date().toISOString().slice(0,10)+'" /></div>'
      +'<div class="f" style="width:72px;flex-shrink:0;"><label>Shift</label><select id="rc-shift"><option>AM</option><option>PM</option><option>Close</option></select></div>'
      +'<div class="f" style="width:90px;flex-shrink:0;"><label>Register</label><input type="text" id="rc-reg" placeholder="1" /></div>'
      +'<div class="f" style="width:160px;flex-shrink:0;"><label>Cashier</label><input type="text" id="rc-cashier" placeholder="Name" /></div>'
      +'<div class="f" style="width:128px;flex-shrink:0;"><label>Opening Bank '+tt('opening-bank')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rc-bank" placeholder="200" /></div></div>'
      +'<div class="f" style="width:120px;flex-shrink:0;margin-left:0;"><label>Tolerance '+tt('cash-tolerance')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rc-tol" value="'+tol+'" /></div></div>'
      +'</div></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">'
      +'<div class="card"><div class="card-title">Bill & Coin Count</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px;"><tbody>'+bRows+cRows
      +'<tr style="border-top:1px solid var(--b2);"><td colspan="2" style="color:var(--t3);font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding-top:8px;">Total Counted</td><td style="text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:var(--w);padding-top:8px;" id="rc-total">$0</td></tr>'
      +'</tbody></table></div>'
      +'<div>'
      +'<div class="card" style="margin-bottom:12px;"><div class="card-title">POS Entry</div>'
      +'<div class="form-row">'
      +'<div class="f w-grow"><label>Expected Cash from POS '+tt('expected-cash')+'</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rc-exp" placeholder="" /></div></div>'
      +'<div class="f w-grow"><label>Credit / Debit Total</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rc-credit" placeholder="" /></div></div>'
      +'</div></div>'
      +'<div class="calc"><div class="calc-item"><div class="calc-label">Counted</div><div class="calc-val" id="rc-cnt-d">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Expected</div><div class="calc-val" id="rc-exp-d">—</div></div>'
      +'<div class="calc-item"><div class="calc-label">Over / Short</div><div class="calc-val" id="rc-os-d">—</div></div>'
      +'<div id="rc-status"></div></div>'
      +'</div></div>'
      +'<div class="sh">Last 30 Entries</div>'
      +'<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Date</th><th>Shift</th><th>Cashier</th><th>Expected</th><th>Counted</th><th>Over/Short</th><th>Status</th></tr></thead><tbody>'+logRows+'</tbody></table></div>'
      +'<div id="rc-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;">Saved.</div>'
      +'</div>';

    this.container.querySelectorAll('input[data-d]').forEach(inp=>inp.addEventListener('input',()=>this.calcTotal()));
    document.getElementById('rc-exp')?.addEventListener('input',()=>this.calcResult());
  },
  calcTotal(){
    let total=0;
    this.container.querySelectorAll('input[data-d]').forEach(inp=>{
      const cnt=parseFloat(inp.value)||0,d=parseFloat(inp.dataset.d)||0,amt=cnt*d;
      total+=amt;const el=document.getElementById('ca-'+d);if(el)el.textContent='$'+amt.toFixed(2);
    });
    const el=document.getElementById('rc-total');if(el)el.textContent='$'+total.toFixed(2);
    this._counted=total;const cd=document.getElementById('rc-cnt-d');if(cd)cd.textContent='$'+total.toFixed(2);
    this.calcResult();
  },
  calcResult(){
    const cnt=this._counted||0,exp=parseFloat(document.getElementById('rc-exp')?.value)||0,tol=parseFloat(document.getElementById('rc-tol')?.value)||10,os=cnt-exp;
    const set=(id,val,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val;el.className='calc-val'+(cls?' '+cls:'');};
    set('rc-cnt-d','$'+cnt.toFixed(2));
    const expEntered=document.getElementById('rc-exp')?.value!=='';
    if(expEntered){set('rc-exp-d','$'+exp.toFixed(2));const osColor=Math.abs(os)<=tol?'good':os<0?'warn':'';set('rc-os-d',(os>0?'+':'')+App.fmtCurrency(os),osColor);const ok=Math.abs(os)<=tol;const sd=document.getElementById('rc-status');if(sd)sd.innerHTML='<span class="badge '+(ok?'badge-ok':os<0?'badge-warn':'badge-dim')+'">'+(ok?'OK':os>0?'Over':'Short')+'</span>';}
  },
  saveEntry(){
    const cnt=this._counted||0,exp=parseFloat(document.getElementById('rc-exp')?.value)||0,tol=parseFloat(document.getElementById('rc-tol')?.value)||10,os=cnt-exp;
    const entry={id:App.uid(),date:document.getElementById('rc-date')?.value,shift:document.getElementById('rc-shift')?.value,register:document.getElementById('rc-reg')?.value,cashier:document.getElementById('rc-cashier')?.value,opening_bank:parseFloat(document.getElementById('rc-bank')?.value)||0,expected_cash:exp,counted_cash:cnt,credit_debit:parseFloat(document.getElementById('rc-credit')?.value)||0,over_short:os,tolerance:tol,status:Math.abs(os)<=tol?'OK':os>0?'Over':'Short',saved_at:new Date().toISOString()};
    if(!App.data.reconciliations)App.data.reconciliations=[];
    App.data.reconciliations.push(entry);
    App.saveKey('reconciliations').then(()=>{const m=document.getElementById('rc-msg');if(m){m.style.display='block';setTimeout(()=>m.style.display='none',2500);}this.renderMain();});
  },
  exportCsv(){
    const recs=App.data.reconciliations||[];
    const h='Date,Shift,Register,Cashier,Expected,Counted,Over/Short,Status\n';
    const r=recs.map(r=>`${r.date||''},${r.shift||''},${r.register||''},${r.cashier||''},${r.expected_cash||0},${r.counted_cash||0},${r.over_short||0},${r.status||''}`).join('\n');
    const blob=new Blob([h+r],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='cash_reconciliation.csv';a.click();URL.revokeObjectURL(url);
  }
};
