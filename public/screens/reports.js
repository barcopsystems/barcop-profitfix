'use strict';
S.Reports={
  render(container,actions){
    this.container=container;this.renderMain();
  },
  renderMain(){
    const weeks=(App.data.weeks||[]).slice().reverse();
    const t=App.data.settings.targets||{};
    const allW=App.data.weeks||[];
    const avg=fn=>{const v=allW.map(fn).filter(x=>x!=null&&!isNaN(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;};
    const avgB=avg(w=>w.bar?.cost_pct);const avgF=avg(w=>w.food?.cost_pct);const avgP=avg(w=>w.prime_cost_pct);
    const annBarRev=App.data.settings.annual_bar_revenue||(avg(w=>w.bar?.revenue)*52);
    const annFoodRev=App.data.settings.annual_food_revenue||(avg(w=>w.food?.revenue)*52);

    const histRows=weeks.length===0?'<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--t4);">No weeks saved yet.</td></tr>'
      :weeks.map(w=>{
        const tRev=(w.bar?.revenue||0)+(w.food?.revenue||0);
        const bT=t.bar_pour_cost_pct??22,pT=t.prime_cost_pct??60;
        return '<tr style="cursor:pointer;" onclick="S.Reports.viewWeek(\''+w.id+'\')"><td>'+esc(w.period_end||'—')+'</td><td class="val">Week '+w.week_num+'</td>'
          +'<td>'+App.fmtCurrency(w.bar?.revenue)+'</td>'
          +'<td class="'+(w.bar?.cost_pct>bT?'neg':'pos')+'">'+App.fmtPct(w.bar?.cost_pct)+'</td>'
          +'<td>'+App.fmtCurrency(w.food?.revenue)+'</td>'
          +'<td class="'+(w.food?.cost_pct>32?'neg':'pos')+'">'+App.fmtPct(w.food?.cost_pct)+'</td>'
          +'<td class="'+(w.prime_cost_pct>pT?'neg':'pos')+'">'+App.fmtPct(w.prime_cost_pct)+'</td>'
          +'<td>'+App.fmtCurrency((w.bar_variance||[]).reduce((s,r)=>s+(r.variance_dollar||0),0))+'</td></tr>';
      }).join('');

    const calcBlock=(label,rev,costPct,target)=>{
      const cur=(costPct/100)*rev,tgt=(target/100)*rev,savings=cur-tgt;
      return '<div class="card" style="margin-bottom:12px;"><div class="card-title">'+label+'</div>'
        +'<div class="form-row" style="gap:16px;">'
        +'<div class="f" style="width:180px;flex-shrink:0;"><label>Annual Revenue</label><div class="fw"><input class="pre" type="number" value="'+Math.round(rev)+'" readonly style="opacity:0.7;" /><span class="pre">$</span></div></div>'
        +'<div class="f" style="width:130px;flex-shrink:0;"><label>Current Cost %</label><div class="fw"><input class="suf" type="number" value="'+costPct.toFixed(1)+'" readonly style="opacity:0.7;" /><span class="suf">%</span></div></div>'
        +'<div class="f" style="width:130px;flex-shrink:0;"><label>Target Cost %</label><div class="fw"><input class="suf" type="number" value="'+target+'" readonly style="opacity:0.7;" /><span class="suf">%</span></div></div>'
        +'</div>'
        +'<div class="calc"><div class="calc-item"><div class="calc-label">Current Annual Cost</div><div class="calc-val">'+App.fmtCurrency(cur)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Cost at Target</div><div class="calc-val good">'+App.fmtCurrency(tgt)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Annual Savings</div><div class="calc-val '+(savings>0?'good':'')+'">'+App.fmtCurrency(savings)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Monthly</div><div class="calc-val">'+App.fmtCurrency(savings/12)+'</div></div>'
        +'<div class="calc-item"><div class="calc-label">Weekly</div><div class="calc-val">'+App.fmtCurrency(savings/52)+'</div></div>'
        +'</div></div>';
    };

    this.container.innerHTML='<div class="screen">'
      +'<div class="sh">Weekly History</div>'
      +'<div class="tbl-wrap" style="overflow-x:auto;margin-bottom:24px;"><table class="tbl"><thead><tr>'
      +'<th>Period End</th><th>Week</th><th>Bar Rev</th><th>Bar Cost %</th><th>Food Rev</th><th>Food Cost %</th><th>Prime %</th><th>Variance $</th>'
      +'</tr></thead><tbody>'+histRows+'</tbody></table></div>'
      +'<div class="sh">Annual Calculator</div>'
      +calcBlock('Bar',annBarRev,avgB,t.bar_pour_cost_pct??22)
      +calcBlock('Food',annFoodRev,avgF,t.food_cost_pct??32)
      +calcBlock('Prime Cost',annBarRev+annFoodRev,avgP,t.prime_cost_pct??60)
      +'<div id="week-detail"></div>'
      +'</div>';
  },
  viewWeek(id){
    const w=(App.data.weeks||[]).find(w=>w.id===id);if(!w)return;
    const det=document.getElementById('week-detail');if(!det)return;
    const tRev=(w.bar?.revenue||0)+(w.food?.revenue||0);
    det.innerHTML='<div class="divider"></div>'
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">'
      +'<div class="sh" style="margin-bottom:0;">Week '+w.week_num+' — '+(w.period_end||'')+'</div>'
      +'<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'week-detail\').innerHTML=\'\'">Close</button>'
      +'</div>'
      +'<div class="card"><div class="tbl-wrap"><table class="sum-tbl"><thead><tr><th></th><th>Amount</th></tr></thead><tbody>'
      +'<tr><td>Bar Revenue</td><td class="val">'+App.fmtCurrency(w.bar?.revenue)+'</td></tr>'
      +'<tr><td>Bar COGS</td><td>'+App.fmtCurrency(w.bar?.cogs)+'</td></tr>'
      +'<tr><td>Bar Labor</td><td>'+App.fmtCurrency(w.bar?.labor)+'</td></tr>'
      +'<tr><td>Bar Cost %</td><td class="val '+(w.bar?.cost_pct>22?'neg':'pos')+'">'+App.fmtPct(w.bar?.cost_pct)+'</td></tr>'
      +'<tr><td>Food Revenue</td><td class="val">'+App.fmtCurrency(w.food?.revenue)+'</td></tr>'
      +'<tr><td>Food Cost %</td><td class="val '+(w.food?.cost_pct>32?'neg':'pos')+'">'+App.fmtPct(w.food?.cost_pct)+'</td></tr>'
      +'<tr class="total"><td>Total Revenue</td><td class="val">'+App.fmtCurrency(tRev)+'</td></tr>'
      +'<tr class="total"><td>Prime Cost %</td><td class="val '+(w.prime_cost_pct>60?'neg':'pos')+'">'+App.fmtPct(w.prime_cost_pct)+'</td></tr>'
      +'</tbody></table></div>'
      +(w.notes?'<div style="margin-top:12px;font-size:12px;color:var(--t2);">Notes: '+esc(w.notes)+'</div>':'')
      +'</div>';
    det.scrollIntoView({behavior:'smooth'});
  }
};
