'use strict';
S.TheftRisk={
  IND:[
    ['No daily cash count reconciliation','A reconciliation slip should be completed every close. If it is not, you cannot catch the problem the same night.'],
    ['No weekly liquor inventory count','Weekly counts catch shrinkage early. Monthly counts let a bad actor get away with four weeks of product.'],
    ['POS not used for every transaction','A sale without a ticket is cash in the pocket. Every transaction needs a POS ring.'],
    ['Bartenders allowed to self-comp or void','Self-comps and voids are the most common theft vector. Managers must authorize every one.'],
    ['No pour cost benchmarks tracked','If your staff does not know your pour cost target, they have no incentive to hit it.'],
    ['No camera coverage over POS and bar','Cameras are the single most effective deterrent. Coverage of the POS and bar well is the minimum.'],
    ['Managers do not verify high-dollar deliveries','Short deliveries and product substitution are real. A manager signs off on every high-dollar invoice.'],
    ['Same staff always close, no rotation policy','Rotating close staff breaks up cliques and prevents collusion patterns from forming.'],
    ['No surprise audits or spot counts','Random counts at random times are the only way to validate your weekly count accuracy.'],
    ['Tip pool not audited or formalized','An unaudited tip pool creates resentment and can hide cash skimming.'],
    ['Vendor relationships not reviewed annually','Vendors get comfortable over time. An annual review keeps pricing honest.'],
    ['No signed cash handling policy on file','A signed policy puts staff on notice and creates a record if discipline is needed.']
  ],
  scores:{},
  render(container,actions){
    this.container=container;
    this.IND.forEach((_,i)=>this.scores[i]=1);
    const btn=document.createElement('button');btn.className='btn btn-primary btn-sm';btn.textContent='Save Scorecard';
    btn.addEventListener('click',()=>this.saveScorecard());actions.appendChild(btn);
    this.renderMain();
  },
  renderMain(){
    const hist=(App.data.theft_scores||[]).slice(-4).reverse();
    const total=Object.values(this.scores).reduce((s,v)=>s+v,0);
    const rating=total<=20?'Low Risk — Strong Controls':total<=35?'Moderate Risk — Tighten Controls':'High Risk — Immediate Action';
    const rc=total<=20?'good':total<=35?'':'warn';
    const rows=this.IND.map(([label,note],i)=>'<div class="score-row">'
      +'<div class="score-num">'+(i+1)+'</div>'
      +'<div class="score-body"><div class="score-main">'+esc(label)+'</div><div class="score-sub">'+esc(note)+'</div></div>'
      +'<div class="score-btns">'+[1,2,3,4,5].map(v=>'<button class="sc-btn'+(this.scores[i]===v?' sel':'')+'" data-i="'+i+'" data-v="'+v+'">'+v+'</button>').join('')+'</div>'
      +'</div>').join('');
    const histRows=hist.map(s=>'<tr><td>'+(s.date?s.date.slice(0,10):'—')+'</td><td class="'+(s.total<=20?'pos':s.total<=35?'':'neg')+' val">'+s.total+'</td><td>'+esc(s.rating||'—')+'</td></tr>').join('');

    this.container.innerHTML='<div class="screen">'
      +'<div class="card" style="margin-bottom:18px;">'
      +'<div class="calc" style="margin-bottom:20px;">'
      +'<div class="calc-item"><div class="calc-label">Total Score</div><div class="calc-val '+rc+'" id="tr-total">'+total+'</div></div>'
      +'<div class="calc-item"><div class="calc-label">Max Possible</div><div class="calc-val dim">60</div></div>'
      +'<div class="calc-item"><div class="calc-label">Rating</div><div class="calc-val '+rc+'" id="tr-rating">'+rating+'</div></div>'
      +'</div>'+rows+'</div>'
      +(hist.length>0?'<div class="sh">Last 4 Scorecards</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Score</th><th>Rating</th></tr></thead><tbody>'+histRows+'</tbody></table></div>':'')
      +'<div id="tr-msg" style="color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;margin-top:14px;display:none;">Scorecard saved.</div>'
      +'</div>';

    this.container.onclick=ev=>{
      const btn=ev.target.closest('.sc-btn');if(!btn)return;
      const i=parseInt(btn.dataset.i),v=parseInt(btn.dataset.v);
      this.scores[i]=v;
      this.container.querySelectorAll('.sc-btn[data-i="'+i+'"]').forEach((b,j)=>b.classList.toggle('sel',j+1===v));
      const t=Object.values(this.scores).reduce((s,v)=>s+v,0);
      const r=t<=20?'Low Risk — Strong Controls':t<=35?'Moderate Risk — Tighten Controls':'High Risk — Immediate Action';
      const rc=t<=20?'good':t<=35?'':'warn';
      const te=document.getElementById('tr-total');const re=document.getElementById('tr-rating');
      if(te){te.textContent=t;te.className='calc-val '+rc;}
      if(re){re.textContent=r;re.className='calc-val '+rc;}
    };
  },
  saveScorecard(){
    const total=Object.values(this.scores).reduce((s,v)=>s+v,0);
    const rating=total<=20?'Low Risk — Strong Controls':total<=35?'Moderate Risk — Tighten Controls':'High Risk — Immediate Action';
    if(!App.data.theft_scores)App.data.theft_scores=[];
    App.data.theft_scores.push({id:App.uid(),date:new Date().toISOString(),scores:{...this.scores},total,rating});
    App.data.last_theft_score_date=new Date().toISOString();
    App.saveKey('theft_scores').then(()=>{App.saveKey('last_theft_score_date');const m=document.getElementById('tr-msg');if(m){m.style.display='block';setTimeout(()=>m.style.display='none',2500);}});
  }
};
