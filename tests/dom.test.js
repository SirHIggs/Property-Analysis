// Types random deals into the live page and checks every number it shows against the engine run separately in Node.
const fs=require('fs'), path=require('path');
const { chromium } = require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../dist/buy-box.html'),'utf8');
const page_=path.join(__dirname,'page.html');
fs.writeFileSync(page_,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html+'</body></html>');
const src=html.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const E=new Function(src+';return {DEFAULTS,DEFAULT_TARGETS,analyse,SCENARIOS,scenario,breakPoints,verdict,status,timeline};')();
const T=E.DEFAULT_TARGETS;
const EX=new Function('return '+html.match(/const OFFLINE_EXAMPLES=(\[[\s\S]*?\]);/)[1])();

let pass=0, fail=0; const failures=[]; const counts={};
function ok(c,name,det){ counts[name]=(counts[name]||0)+1; if(c) pass++; else { fail++; if(failures.length<60) failures.push(name+' :: '+det); } }
const clean=s=>s.replace(/−/g,'-').replace(/ /g,' ').trim();
function pR(s){ s=clean(s).replace(/\/.*$/,'').replace(/[+R\s]/g,''); return Number(s); }
function pC(s){ s=clean(s).replace(/[R+\s]/g,''); const m=s.match(/^(-?[\d.]+)([mk]?)$/); if(!m) return NaN; return Number(m[1])*(m[2]==='m'?1e6:m[2]==='k'?1e3:1); }
function pP(s){ return Number(clean(s).replace('%','')); }
function pX(s){ return Number(clean(s).replace('×','')); }
function grade(v){ const r=v.ratio; return r>=0.9?'A':r>=0.75?'B':r>=0.55?'C':r>=0.35?'D':'E'; }
const closeR=(disp,v,tol)=>Math.abs(disp-Math.round(v))<= (tol||1);
function cmpR(txt,v,name){ const d=pR(txt); ok(closeR(d,v),name,`shown ${txt} vs ${v.toFixed(2)}`); }
function cmpP(txt,v,dp,name){ if(!isFinite(v)){ ok(/No cash in|–/.test(txt),name,`shown ${txt} vs ${v}`); return; } const d=pP(txt); ok(Math.abs(d-v)<=0.5*Math.pow(10,-dp)+1e-9,name,`shown ${txt} vs ${v}`); }
function cmpC(txt,v,name){ const d=pC(txt), a=Math.abs(v); const tol=a>=999500?5000:a>=999.5?500:0.5; ok(Math.abs(d-v)<=tol+1e-6,name,`shown ${txt} vs ${v}`); }

function rnd(i){
  const R=(a,b)=>a+Math.random()*(b-a), newDev=Math.random()<0.35;
  const d={name:'Test '+i, price:Math.round(R(400000,5000000)), marketValue:Math.random()<0.35?Math.round(R(400000,6000000)):'', reno:Math.random()<0.3?Math.round(R(0,150000)):0,
    legal:Math.random()<0.25?Math.round(R(0,80000)):'', rent:Math.round(R(4000,40000)), otherIncome:Math.random()<0.25?Math.round(R(0,1500)):0, vacancy:+R(0,15).toFixed(2),
    levy:Math.round(R(300,4500)), rates:Math.round(R(0,2500)), insurance:Math.round(R(0,500)), otherExp:Math.round(R(0,400)), mgmt:+R(0,14).toFixed(2), maint:+R(0,8).toFixed(2),
    deposit:Math.random()<0.12?100:Math.round(R(5,50)), rate:+R(6,15).toFixed(2), term:Math.round(R(5,30)), taxRate:Math.random()<0.4?+R(18,45).toFixed(1):0,
    hold:Math.round(R(3,25)), sellCost:+R(3,8).toFixed(2), rentGrowth:+R(0,9).toFixed(2), costGrowth:+R(3,10).toFixed(2), capGrowth:+R(-1,9).toFixed(2), newDev};
  if(i%9===0){ d.newDev=true; d.deposit=0; d.reno=0; } // no cash in at all
  if(i%11===0){ d.deposit=100; }                          // cash buy
  return d;
}

(async()=>{
  const b=await chromium.launch(), p=await b.newPage({viewport:{width:1440,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+page_+'#analyse'); await p.waitForTimeout(1200);
  await p.click('#newDeal'); await p.waitForTimeout(900);
  const N=Number(process.argv[2]||40);
  for(let i=1;i<=N;i++){
    const d=rnd(i);
    for(const [k,v] of Object.entries(d)){
      if(k==='newDev'){ await p.setChecked('#f-newDev',v); continue; }
      await p.fill('#f-'+k,String(v));
    }
    await p.waitForTimeout(60);
    const r=E.analyse(d); r.v=E.verdict(r,T);
    const g=await p.evaluate(()=>{
      const t=s=>[...document.querySelectorAll(s)].map(e=>e.textContent);
      return { cash:document.querySelector('#sCash').childNodes[0].textContent, rows:t('#sRows b'), pr:t('#sPr b'), kpi:t('#kpis .v'), sval:t('#screening .srow .val'),
        pills:[...document.querySelectorAll('#screening .srow .pill')].map(e=>e.className.split(' ')[1]), letter:document.querySelector('#seal .letter').textContent,
        tally:document.querySelector('#screenTally').textContent, readout:t('#readout b'), bps:t('#bps .bpc .a'),
        scen:[...document.querySelectorAll('#scen tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent)),
        ie:[1,2,3,4].map(n=>document.querySelector('#ie'+n+'a').textContent), cres:t('#cresult b'),
        ieRows:[...document.querySelectorAll('#ieTable tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent)) };
    });
    // summary
    cmpR(g.cash, r.m.cfMonth, 'summary: monthly cash flow');
    cmpR(g.rows[0], r.effA/12, 'summary: income collected');
    cmpR(g.rows[1], (r.noi-r.effA)/12, 'summary: running costs');
    cmpR(g.rows[2], r.noi/12, 'summary: net operating income');
    cmpR(g.rows[3], -r.pmt, 'summary: bond repayment');
    ok(Math.abs(pR(g.rows[0])+pR(g.rows[1])-pR(g.rows[2]))<=2,'summary: income − running costs = NOI',g.rows.join(' '));
    ok(Math.abs(pR(g.rows[2])+pR(g.rows[3])-pR(g.cash))<=2,'summary: NOI − bond = cash flow',g.rows.join(' ')+' = '+g.cash);
    if(d.taxRate>0) cmpR(g.rows[4], r.afterTaxCfM, 'summary: after-tax cash flow'); else ok(g.rows.length===4,'no tax row when tax rate is 0',g.rows.length);
    cmpR(g.pr[0], r.price,'summary: price'); cmpR(g.pr[1], r.rent,'summary: rent'); cmpR(g.pr[2], r.cashIn,'summary: cash required');
    // KPIs
    cmpP(g.kpi[0], r.m.coc,1,'KPI cash-on-cash'); cmpP(g.kpi[1], r.m.capRate,1,'KPI cap rate'); cmpP(g.kpi[2], r.m.grossYield,1,'KPI gross yield');
    if(isFinite(r.m.dscr)) ok(Math.abs(pX(g.kpi[3])-r.m.dscr)<=0.005+1e-9,'KPI DSCR',g.kpi[3]+' vs '+r.m.dscr); else ok(/No bond|–/.test(g.kpi[3]),'KPI DSCR',g.kpi[3]);
    if(isFinite(r.m.irr)) cmpP(g.kpi[4], r.m.irr,1,'KPI IRR'); else ok(g.kpi[4].trim()==='–','KPI IRR blank when no cash in',g.kpi[4]);
    cmpP(g.kpi[5], r.m.onePct,2,'KPI 1% rule');
    // screening values + pills
    const keys=[['onePct',2],['expRatio',1],['cfMonth','R'],['capRate',1],['dscr','x'],['grossYield',1],['effYield',1],['coc',1],['discount',1],['irr',1]];
    const dirs={expRatio:'lo'};
    keys.forEach(([k,dp],i)=>{
      const v=r.m[k], txt=g.sval[i];
      if(dp==='R') cmpR(txt,v,'screening '+k);
      else if(dp==='x'){ if(isFinite(v)) ok(Math.abs(pX(txt)-v)<=0.005+1e-9,'screening dscr',txt+' vs '+v); }
      else if(v==null||Number.isNaN(v)) ok(txt.trim()==='–','screening '+k+' blank',txt);
      else cmpP(txt,v,dp,'screening '+k);
      const st=E.status({dir:dirs[k]||'hi',band:k==='cfMonth'?1000:undefined},v,T[k]);
      ok(g.pills[i]===(st==='na'?'na':st),'screening status '+k,g.pills[i]+' vs '+st);
    });
    ok(g.letter===grade(r.v),'grade letter',g.letter+' vs '+grade(r.v));
    ok(g.tally.startsWith(`${r.v.pass} met · ${r.v.close} close · ${r.v.fail} missed`),'tally',g.tally);
    // readout
    cmpR(g.readout[0],r.duty,'readout: transfer duty'); cmpR(g.readout[1].replace('est.',''),r.legal,'readout: fees'); cmpR(g.readout[2],r.loan,'readout: bond amount'); cmpR(g.readout[3],r.pmt,'readout: bond /month');
    // scenarios
    E.SCENARIOS.forEach((s,i)=>{
      const x=E.analyse(s.apply({...E.DEFAULTS,...d})); x.v=E.verdict(x,T); const row=g.scen[i];
      cmpR(row[0],x.m.cfMonth,'scenario '+s.k+' cash flow'); cmpP(row[1],x.m.coc,1,'scenario '+s.k+' CoC');
      if(isFinite(x.m.dscr)) ok(Math.abs(pX(row[2])-x.m.dscr)<=0.005+1e-9,'scenario '+s.k+' DSCR',row[2]);
      if(isFinite(x.m.irr)) cmpP(row[3],x.m.irr,1,'scenario '+s.k+' IRR');
      ok(row[4].trim()===grade(x.v),'scenario '+s.k+' grade',row[4]+' vs '+grade(x.v));
    });
    // breaking points
    const bp=E.breakPoints(d,T);
    if(bp.rate.kind==='ok') cmpP(g.bps[0],bp.rate.v,2,'break point: interest rate'); else ok(/No bond|Already short|Any/.test(g.bps[0]),'break point: rate label',g.bps[0]+' '+bp.rate.kind);
    if(!Number.isNaN(bp.rentDrop)&&bp.rentDrop>=0) ok(Math.abs(pP(g.bps[1])-bp.rentDrop)<=0.5+1e-9,'break point: rent drop',g.bps[1]+' vs '+bp.rentDrop);
    if(bp.vac.kind==='ok') ok(Math.abs(parseFloat(clean(g.bps[2]))-bp.vac.v*12/100)<=0.05+1e-9,'break point: vacancy months',g.bps[2]+' vs '+bp.vac.v*12/100);
    if(bp.offerCoc.kind==='ok'&&bp.offerCoc.v<r.price&&r.cashIn>0) cmpC(g.bps[3],bp.offerCoc.v,'offer price for 12% CoC');
    if(r.cashIn<=0) ok(g.bps[3].trim()==='n/a','offer price n/a with no cash in',g.bps[3]);
    if(bp.offerCf.kind==='ok'&&bp.offerCf.v<r.price) cmpC(g.bps[4],bp.offerCf.v,'offer price to break even');
    // custom scenario at rest = base
    cmpR(g.cres[0],r.m.cfMonth,'custom scenario at rest equals base cash flow');
    // income vs expenses
    const tl=E.timeline(d,20,T.discountRate);
    if(tl.crossover===1) ok(/year 1/i.test(g.ie[0]),'IE crossover',g.ie[0]); else if(tl.crossover) ok(g.ie[0]==='Year '+tl.crossover,'IE crossover',g.ie[0]+' vs '+tl.crossover); else ok(/Not in 20/.test(g.ie[0]),'IE crossover none',g.ie[0]);
    cmpR(g.ie[1],tl.topUp,'IE top-up'); cmpR(g.ie[2],tl.net,'IE 20-year net'); cmpR(g.ie[3],tl.pv,'IE present value');
    tl.rows.forEach((x,j)=>{ const row=g.ieRows[j]; cmpR(row[0],x.income,'IE table income'); cmpR(row[1],x.running,'IE table running'); cmpR(row[2],x.bond,'IE table bond'); cmpR(row[3],x.net,'IE table net'); cmpR(row[5],x.cum,'IE table running total');
      ok(Math.abs(pR(row[0])-pR(row[1])-pR(row[2])-pR(row[3]))<=2,'IE table row adds up',row.join(' | ')); });
    ok(Math.abs(g.ieRows.reduce((s,rw)=>s+pR(rw[3]),0)-pR(g.ie[2]))<=20,'IE table nets sum to the 20-year total','');
  }
  // discount-rate control changes PV
  await p.fill('#ie-disc','0'); await p.waitForTimeout(80);
  const at0=await p.textContent('#ie4a'), net=await p.textContent('#ie3a');
  ok(pR(at0)===pR(net),'PV at 0% equals the raw total on screen',at0+' vs '+net);
  await p.fill('#ie-disc','10.75'); await p.waitForTimeout(80);

  // ---------- portfolio ----------
  await p.goto('file://'+page_+'#portfolio'); await p.waitForTimeout(900);
  const pr=await p.evaluate(()=>({ rows:[...document.querySelectorAll('#ptable tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())), stats:[...document.querySelectorAll('#stats .stat b')].map(e=>e.textContent) }));
  const exs=EX.map(x=>({...E.DEFAULTS,...x}));
  const res=exs.map(x=>{ const r=E.analyse(x); r.v=E.verdict(r,T); r.storm=E.scenario(x,'storm').m.cfMonth; return r; });
  pr.rows.forEach(row=>{
    const i=exs.findIndex(x=>row[0].startsWith(x.name)); const r=res[i];
    ok(i>=0,'portfolio row found',row[0]);
    ok(row[1]===grade(r.v),'portfolio grade',row[1]); cmpR(row[2],r.price,'portfolio price'); cmpR(row[3],r.rent,'portfolio rent'); cmpR(row[4],r.m.cfMonth,'portfolio cash flow');
    cmpP(row[5],r.m.coc,1,'portfolio CoC'); cmpP(row[6],r.m.capRate,1,'portfolio cap rate'); cmpR(row[7],r.storm,'portfolio storm'); cmpR(row[8],r.cashIn,'portfolio cash required');
  });
  ok(Number(pr.stats[0])===exs.length,'stats: deal count',pr.stats[0]);
  cmpC(pr.stats[1],res.reduce((s,r)=>s+r.price,0),'stats: combined value');
  cmpP(pr.stats[2],res.reduce((s,r)=>s+r.m.grossYield,0)/res.length,1,'stats: average gross yield');
  ok(pr.stats[3]===`${res.filter(r=>r.m.cfMonth>=0).length} / ${res.length}`,'stats: cash-flow positive',pr.stats[3]);
  ok(pr.stats[4]===grade(res.reduce((b,r)=>!b||r.v.ratio>b.v.ratio?r:b,null).v),'stats: best grade',pr.stats[4]);

  // ---------- compare ----------
  await p.goto('file://'+page_+'#compare'); await p.waitForTimeout(900);
  const cp=await p.evaluate(()=>({ leaders:[...document.querySelectorAll('#leaders .lead .who')].map(e=>e.textContent.trim()),
    rows:[...document.querySelectorAll('#cmp tbody tr:not(.grp)')].map(tr=>({h:tr.querySelector('th').childNodes[0].textContent.trim(), cells:[...tr.querySelectorAll('td')].map(td=>({t:td.querySelector('.val')?td.querySelector('.val span').textContent:td.textContent, best:!!td.querySelector('.best')}))})) }));
  const byName=k=>exs[k].name;
  const argmax=f=>{ let bi=0,bs=-Infinity; res.forEach((r,i)=>{ const s=f(r,i); if(s>bs){bs=s;bi=i;} }); return bi; };
  ok(cp.leaders[1]===byName(argmax(r=>r.m.cfMonth)),'leader: most cash flow',cp.leaders[1]);
  ok(cp.leaders[2]===byName(argmax(r=>isFinite(r.m.coc)?r.m.coc:(r.m.coc>0?1e9:-1e9))),'leader: best CoC',cp.leaders[2]);
  ok(cp.leaders[3]===byName(argmax(r=>r.storm)),'leader: most resilient',cp.leaders[3]);
  ok(cp.leaders[4]===byName(argmax(r=>-r.cashIn)),'leader: least cash',cp.leaders[4]);
  const rowCheck=(label,f,lowBest)=>{ const row=cp.rows.find(x=>x.h===label); if(!row){ ok(false,'compare row '+label,'missing'); return; }
    const vals=res.map(f); const best=lowBest?Math.min(...vals):Math.max(...vals);
    row.cells.forEach((c,i)=>ok(c.best===(vals[i]===best&&vals.filter(v=>v===best).length===1),'compare best flag: '+label,`${exs[i].name} flagged=${c.best}`)); };
  rowCheck('Monthly cash flow',r=>r.m.cfMonth); rowCheck('Gross yield',r=>r.m.grossYield); rowCheck('Expense ratio',r=>r.m.expRatio,true); rowCheck('Cash required',r=>r.cashIn,true); rowCheck('Net gain if sold',r=>r.m.netGain);

  console.log(JSON.stringify({deals:N,pass,fail,pageErrors:errs,failures,checkTypes:Object.keys(counts).length},null,1));
  await b.close();
})();
