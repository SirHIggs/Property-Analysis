// Types random deals into the live page and checks every number it shows against the engine run separately in Node.
// It opens the public website (dist/index.html) over HTTP, as GitHub Pages serves it, with its Content Security Policy.
const fs=require('fs'), path=require('path'), http=require('http');
const { chromium } = require('playwright');
const dist=path.join(__dirname,'../dist');
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const TYPES={'.html':'text/html; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((q,r)=>{
  let f=decodeURIComponent(new URL(q.url,'http://x').pathname); if(f.endsWith('/')) f+='index.html';
  const fp=path.join(dist,path.normalize(f));
  if(!fp.startsWith(dist+path.sep)||!fs.existsSync(fp)){ r.writeHead(404); r.end(); return; }
  r.writeHead(200,{'content-type':TYPES[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(r);
});
const src=html.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const E=new Function(src+';return {DEFAULTS,DEFAULT_TARGETS,analyse,SCENARIOS,scenario,breakPoints,verdict,status,timeline};')();
const narrSrc=html.split('/*NARRATIVE-START*/')[1].split('/*NARRATIVE-END*/')[0];
const NN=new Function(src+narrSrc+';return {dealContext,narrateDeal,narratePortfolio};')();
const T=E.DEFAULT_TARGETS;
const EX=require('../data/deals.json').deals; // a first visit starts with these example deals

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
  await new Promise(res=>server.listen(0,'127.0.0.1',res));
  const BASE='http://127.0.0.1:'+server.address().port+'/';
  const b=await chromium.launch(), p=await b.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  // Any script error, blocked resource or CSP violation fails the run.
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  p.on('dialog',d=>{ errs.push('dialog opened: '+d.message()); d.dismiss(); });
  await p.goto(BASE+'#analyse'); await p.waitForTimeout(1200);
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
  await p.goto(BASE+'#portfolio'); await p.waitForTimeout(900);
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
  await p.goto(BASE+'#compare'); await p.waitForTimeout(900);
  const cp=await p.evaluate(()=>({ leaders:[...document.querySelectorAll('#leaders .lead .who')].map(e=>e.textContent.trim()),
    rows:[...document.querySelectorAll('#cmp tbody tr:not(.grp)')].map(tr=>({h:tr.querySelector('th').childNodes[0].textContent.trim(), cells:[...tr.querySelectorAll('td')].map(td=>({t:td.querySelector('.val')?td.querySelector('.val span').textContent:td.textContent, best:!!td.querySelector('.best')}))})) }));
  // Compare shows only the deals ticked for comparison, oldest first.
  const cmpIdx=exs.map((x,i)=>i).filter(i=>exs[i].inCompare).sort((a,b)=>exs[a].created-exs[b].created);
  const cex=cmpIdx.map(i=>exs[i]), cres=cmpIdx.map(i=>res[i]);
  const byName=k=>cex[k].name;
  const argmax=f=>{ let bi=0,bs=-Infinity; cres.forEach((r,i)=>{ const s=f(r,i); if(s>bs){bs=s;bi=i;} }); return bi; };
  ok(cp.leaders[1]===byName(argmax(r=>r.m.cfMonth)),'leader: most cash flow',cp.leaders[1]);
  ok(cp.leaders[2]===byName(argmax(r=>isFinite(r.m.coc)?r.m.coc:(r.m.coc>0?1e9:-1e9))),'leader: best CoC',cp.leaders[2]);
  ok(cp.leaders[3]===byName(argmax(r=>r.storm)),'leader: most resilient',cp.leaders[3]);
  ok(cp.leaders[4]===byName(argmax(r=>-r.cashIn)),'leader: least cash',cp.leaders[4]);
  const rowCheck=(label,f,lowBest)=>{ const row=cp.rows.find(x=>x.h===label); if(!row){ ok(false,'compare row '+label,'missing'); return; }
    ok(row.cells.length===cres.length,'compare columns: '+label,row.cells.length+' vs '+cres.length);
    const vals=cres.map(f); const best=lowBest?Math.min(...vals):Math.max(...vals);
    row.cells.forEach((c,i)=>ok(c.best===(vals[i]===best&&vals.filter(v=>v===best).length===1),'compare best flag: '+label,`${cex[i].name} flagged=${c.best}`)); };
  rowCheck('Monthly cash flow',r=>r.m.cfMonth); rowCheck('Gross yield',r=>r.m.grossYield); rowCheck('Expense ratio',r=>r.m.expRatio,true); rowCheck('Cash required',r=>r.cashIn,true); rowCheck('Net gain if sold',r=>r.m.netGain);

  // ---------- saving in this browser, export and import ----------
  await p.goto(BASE+'#analyse'); await p.waitForTimeout(900);
  ok((await p.textContent('#statusText'))==='Saved in this browser','status shows browser saving',await p.textContent('#statusText'));
  await p.click('#newDeal'); await p.waitForTimeout(300);
  if(await p.$('#newDeal.armed')) { await p.click('#newDeal'); await p.waitForTimeout(300); }
  await p.fill('#f-name','Persist check'); await p.fill('#f-price','1234567'); await p.waitForTimeout(100);
  await p.click('#saveDeal'); await p.waitForTimeout(1200);
  await p.reload(); await p.goto(BASE+'#portfolio'); await p.waitForTimeout(900);
  const names=async()=>p.evaluate(()=>[...document.querySelectorAll('#ptable tbody tr td:first-child')].map(td=>td.textContent.trim()));
  let nm=await names();
  ok(nm.some(t=>t.startsWith('Persist check')),'saved deal survives a reload',nm.join(' | '));
  ok(nm.length===exs.length+1,'portfolio holds examples plus the saved deal',nm.length);
  await p.goto(BASE+'#settings'); await p.waitForTimeout(500);
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#exportData')]);
  const exported=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  ok(exported.deals.length===exs.length+1,'export holds every deal',exported.deals.length);
  ok(exported.deals.some(d=>d.name==='Persist check'&&d.price===1234567),'export keeps deal fields','');
  ok(Object.keys(T).every(k=>k in exported.targets),'export holds the targets','');
  const imp=path.join(__dirname,'import.json');
  fs.writeFileSync(imp,JSON.stringify({deals:[{id:'imported1',name:'Imported deal',price:2000000,rent:15000,inCompare:true,slot:0,created:1,evil:'<img src=x onerror=alert(1)>'},
    {id:exs[0].id,name:'Replaced example',price:999999}],targets:{irr:17,bogus:5}}));
  await p.setInputFiles('#importFile',imp); await p.waitForTimeout(1200);
  await p.reload(); await p.goto(BASE+'#portfolio'); await p.waitForTimeout(900);
  nm=await names();
  ok(nm.some(t=>t.startsWith('Imported deal')),'imported deal survives a reload',nm.join(' | '));
  ok(nm.some(t=>t.startsWith('Replaced example'))&&!nm.some(t=>t.startsWith(exs[0].name+' ')||t===exs[0].name),'import replaces a deal with the same id',nm.join(' | '));
  ok(nm.length===exs.length+2,'import adds new deals and keeps the rest',nm.length);
  const tg=await p.evaluate(()=>JSON.parse(localStorage.getItem('buybox-data')));
  ok(tg.settings.targets&&tg.settings.targets.irr===17&&!('bogus' in tg.settings.targets),'import takes known targets only',JSON.stringify(tg.settings.targets));
  ok(!('evil' in tg.properties.imported1),'import drops unknown fields','');
  const slots=Object.values(tg.properties).filter(d=>d.inCompare).map(d=>d.slot);
  ok(new Set(slots).size===slots.length&&slots.length<=8,'compare colours stay unique after import',slots.join(','));
  fs.unlinkSync(imp);

  // ---------- prime rate setting ----------
  await p.goto(BASE+'#settings'); await p.waitForTimeout(500);
  await p.fill('#t-prime','11.25'); await p.waitForTimeout(1200);
  ok((await p.textContent('#primeShow'))==='11.25%','sidebar shows the new prime rate',await p.textContent('#primeShow'));
  let st=await p.evaluate(()=>JSON.parse(localStorage.getItem('buybox-data')).settings.targets);
  ok(st.prime===11.25,'prime rate is saved',st.prime);
  ok(st.discountRate===11.25,'discount rate follows prime while they match',st.discountRate);
  await p.fill('#t-discountRate','8'); await p.fill('#t-prime','11.5'); await p.waitForTimeout(1200);
  st=await p.evaluate(()=>JSON.parse(localStorage.getItem('buybox-data')).settings.targets);
  ok(st.prime===11.5&&st.discountRate===8,'a discount rate of your own stays put',JSON.stringify(st));
  await p.goto(BASE+'#analyse'); await p.waitForTimeout(700);
  await p.click('#newDeal'); await p.waitForTimeout(300);
  if(await p.$('#newDeal.armed')) { await p.click('#newDeal'); await p.waitForTimeout(300); }
  ok((await p.inputValue('#f-rate'))==='11.5','a new deal starts at the prime rate',await p.inputValue('#f-rate'));

  // ---------- guide and notice ----------
  await p.goto(BASE+'#guide'); await p.waitForTimeout(500);
  const gt=await p.evaluate(()=>[...document.querySelectorAll('#gtests tbody tr')].map(tr=>({k:tr.dataset.k,t:tr.querySelectorAll('td')[2].textContent})));
  ok(gt.length===10,'guide lists the ten graded tests',gt.length);
  ok((gt.find(r=>r.k==='irr')||{}).t==='≥ 17%','guide shows your own targets',JSON.stringify(gt.find(r=>r.k==='irr')));
  ok((gt.find(r=>r.k==='cfMonth')||{}).t==='≥ R 0','guide formats rand targets',JSON.stringify(gt.find(r=>r.k==='cfMonth')));
  await p.goto(BASE+'#analyse'); await p.waitForTimeout(500);
  ok(await p.isVisible('#notice'),'not-financial-advice notice shows on a first visit','');
  await p.click('#noticeOk'); await p.reload(); await p.waitForTimeout(800);
  ok(!(await p.isVisible('#notice')),'notice stays dismissed after a reload','');

  // ---------- light and dark themes ----------
  const contrast=()=>p.evaluate(()=>{
    const cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
    const lum=h=>{ const c=h.replace('#','').match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
    const cr=(a,b)=>{ const x=lum(v(a)),y=lum(v(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    const out={};
    ['--text','--text-2','--muted','--good-text','--warn-text','--bad-text'].forEach(t=>['--bg','--surface','--surface-2'].forEach(b=>out[t+' on '+b]=[cr(t,b),4.5]));
    for(let i=1;i<=8;i++) ['--surface','--surface-2'].forEach(b=>out['--s'+i+' on '+b]=[cr('--s'+i,b),3]);
    out['--brass-ink on --brass']=[cr('--brass-ink','--brass'),4.5];
    return {theme:document.documentElement.dataset.theme||'dark',out};
  });
  const checkTheme=async want=>{ const c=await contrast(); ok(c.theme===want,'theme is '+want,c.theme);
    Object.entries(c.out).forEach(([k,[r,min]])=>ok(r>=min,want+' contrast '+k,r.toFixed(2)+' < '+min)); };
  await p.goto(BASE+'#analyse'); await p.waitForTimeout(500);
  await checkTheme('dark');
  await p.click('#themeBtn'); await p.waitForTimeout(300);
  await checkTheme('light');
  ok((await p.textContent('#themeLabel'))==='Dark mode','switch offers the other theme',await p.textContent('#themeLabel'));
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='light','theme choice survives a reload','');
  await p.click('#themeBtn'); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!document.documentElement.dataset.theme),'switch goes back to dark','');


  // ---------- investor report ----------
  const T2=await p.evaluate(()=>JSON.parse(localStorage.getItem('buybox-data')).settings.targets); // the targets the page grades with now
  const TT={...T,...T2};
  const deal=id=>p.evaluate(i=>JSON.parse(localStorage.getItem('buybox-data')).properties[i],id);
  // single deal from Analyse
  await p.goto(BASE+'#analyse'); await p.waitForTimeout(600);
  await p.selectOption('#dealPick','ex-townhouse'); await p.waitForTimeout(300);
  await p.click('#rptOne'); await p.waitForTimeout(600);
  const d1={...E.DEFAULTS,...(await deal('ex-townhouse'))}, r1=E.analyse(d1); r1.v=E.verdict(r1,TT);
  const rp=await p.evaluate(()=>{
    const sec=document.querySelector('[data-r=deal]'), t=s=>[...sec.querySelectorAll(s)];
    const rowsOf=sel=>Object.fromEntries(t(sel+' tbody tr').map(tr=>[tr.querySelector('th').childNodes[0].textContent.trim(),[...tr.querySelectorAll('td')].map(td=>td.textContent)]));
    return { n:document.querySelectorAll('[data-r=deal]').length, grade:sec.querySelector('[data-r=grade]').textContent,
      kpis:t('[data-r=kpis] b').map(b=>b.textContent), ie:rowsOf('[data-r=ie]'), cash:rowsOf('[data-r=cash]'),
      tests:t('[data-r=tests] tbody tr').map(tr=>[tr.dataset.k,tr.querySelector('.pill').className.split(' ')[1]]),
      scen:t('[data-r=scen] tbody tr').map(tr=>[tr.dataset.k,tr.querySelectorAll('td')[0].textContent]),
      years:t('[data-r=years] tbody tr').map(tr=>[tr.querySelector('th').textContent,...[...tr.querySelectorAll('td')].map(td=>td.textContent)]),
      ie20:t('[data-r=ie20] b').map(b=>b.textContent), title:document.querySelector('#crumbs h1').textContent };
  });
  ok(rp.n===1,'report from Analyse has one deal',rp.n);
  // the pack: dark cover first, executive summary next, commentary on every section, visuals that add up
  const pk=await p.evaluate(()=>{
    const sp=t=>t.replace(/\u00a0/g,' '); // the pack keeps amounts on one line with no-break spaces
    const sheets=[...document.querySelectorAll('#reportDoc .sheet')], cover=sheets[0], deal=document.querySelector('[data-r=deal]');
    const wf=[...deal.querySelectorAll('[data-r=waterfall] rect[data-step]')].map(r=>Number(r.dataset.v));
    return { first:cover.dataset.r, second:sheets[1].dataset.r, last:sheets[sheets.length-1].dataset.r, coverBg:getComputedStyle(cover).getPropertyValue('--bg').trim(), docBg:getComputedStyle(document.getElementById('reportDoc')).getPropertyValue('--bg').trim(),
      exec:sp(document.querySelector('[data-r=exec-headline]').textContent), dealHl:sp(deal.querySelector('[data-r=deal-headline]').textContent),
      notes:[...deal.querySelectorAll('[data-note]')].map(n=>n.dataset.note), noteText:[...deal.querySelectorAll('[data-note] .txt')].map(n=>sp(n.textContent)),
      wf, split:[...deal.querySelectorAll('[data-r=split] .bar i')].map(i=>Number(i.dataset.v)),
      serif:['Fraunces','Inter'].every(n=>[...document.fonts].some(f=>f.family.replace(/"/g,'')===n&&f.status==='loaded')), coverPage:getComputedStyle(cover).page, dealPage:getComputedStyle(deal).page };
  });
  const n1=NN.narrateDeal(NN.dealContext(await deal('ex-townhouse'),TT));
  ok(pk.first==='cover'&&pk.second==='exec'&&pk.last==='method','pack order: cover, executive summary, …, basis',[pk.first,pk.second,pk.last].join());
  ok(pk.coverBg.toUpperCase()==='#0A0F0E'&&pk.docBg.toUpperCase()==='#F6F3EC','dark cover on light paper',pk.coverBg+' / '+pk.docBg);
  ok(pk.exec===n1.headline&&pk.dealHl===n1.headline,'executive summary and deal headline match the commentary module',pk.exec);
  ok(['cashFlow','cash','returns','tests','stress','offer','longTerm'].every(k=>pk.notes.includes(k)),'commentary on every section',pk.notes.join());
  ok(pk.noteText.includes(n1.sections.cashFlow.text),'cash flow commentary shown in full','');
  ok(pk.wf.length===6&&Math.abs(pk.wf[0]+pk.wf[1]+pk.wf[2]-pk.wf[3])<1e-6&&Math.abs(pk.wf[3]+pk.wf[4]-pk.wf[5])<1e-6,'waterfall steps add up',JSON.stringify(pk.wf));
  cmpR(String(pk.wf[5]),r1.m.cfMonth,'waterfall ends at the cash flow');
  ok(n1.split&&pk.split.reduce((a,b)=>a+b,0)===(n1.split.left>0?100:100-n1.split.left),'R100 bar shows the whole split',JSON.stringify(pk.split));
  ok(pk.serif,'pack fonts load (Fraunces and Inter)','');
  ok(pk.coverPage==='cover'&&pk.dealPage==='report','full-bleed cover page, then report pages',pk.coverPage+' / '+pk.dealPage);
  // readability: no italics, a minimum text size (8pt printed; body 10pt, tables 9.5pt), dark greys, commentary closes its section
  const rd=await p.evaluate(()=>{
    const doc=document.getElementById('reportDoc'), all=[...doc.querySelectorAll('*')], px=e=>parseFloat(getComputedStyle(e).fontSize);
    const own=e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    const size=e=>{ if(e instanceof SVGTextElement||e instanceof SVGTextPathElement){ const svg=e.ownerSVGElement, vb=svg.viewBox.baseVal; return px(e)*(vb&&vb.width?svg.getBoundingClientRect().width/vb.width:1); } return px(e); };
    const small=all.filter(e=>own(e)&&e.getClientRects().length&&size(e)<10.9).map(e=>(e.getAttribute('class')||e.tagName)+' '+size(e).toFixed(1));
    const body=[...doc.querySelectorAll('.note .txt,.lede,.sw2 li,.rpt-notes')].filter(e=>px(e)<13.3).map(e=>e.className+' '+px(e));
    const table=[...doc.querySelectorAll('.rpt-t td,.rpt-t tbody th')].filter(e=>px(e)<12.6).map(e=>e.className+' '+px(e));
    const lum=h=>{ const c=h.replace('#','').match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
    const cr=(el,a,b)=>{ const cs=getComputedStyle(el), x=lum(cs.getPropertyValue(a).trim()), y=lum(cs.getPropertyValue(b).trim()); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    const hero=doc.querySelector('.hero'), con={};
    ['--text','--text-2','--muted'].forEach(t=>{ con['paper '+t]=cr(doc,t,'--surface'); con['dark band '+t]=cr(hero,t,'--surface'); });
    const secs=[...doc.querySelectorAll('.psec')].filter(x=>x.querySelector(':scope>.note'));
    return { italic:all.filter(e=>getComputedStyle(e).fontStyle!=='normal').map(e=>e.getAttribute('class')||e.tagName), small, body, table, con,
      loose:[...doc.querySelectorAll('[data-r=deal] .note')].filter(n=>!n.closest('.psec')).map(n=>n.dataset.note),
      notLast:secs.filter(x=>!x.lastElementChild.classList.contains('note')).map(x=>x.dataset.sec||x.querySelector('.kick').textContent) };
  });
  ok(rd.italic.length===0,'no italic text in the pack',rd.italic.slice(0,5).join());
  ok(rd.small.length===0,'no pack text below 8pt',rd.small.slice(0,8).join(' | '));
  ok(rd.body.length===0,'commentary and summaries at 10pt or more',rd.body.slice(0,5).join());
  ok(rd.table.length===0,'table text at 9.5pt or more',rd.table.slice(0,5).join());
  Object.entries(rd.con).forEach(([k,v])=>ok(v>=7,'pack contrast '+k,v.toFixed(2)));
  ok(rd.loose.length===0,'every commentary box sits in its section',rd.loose.join());
  ok(rd.notLast.length===0,'commentary closes its section',rd.notLast.join());
  ok(rp.title==='Investor report · 1 deal','report title',rp.title);
  ok(rp.grade===grade(r1.v),'report grade',rp.grade+' vs '+grade(r1.v));
  cmpR(rp.kpis[0],r1.price,'report price'); cmpR(rp.kpis[1],r1.cashIn,'report cash required'); cmpR(rp.kpis[2],r1.m.cfMonth,'report cash flow');
  cmpP(rp.kpis[3],r1.m.coc,1,'report CoC'); cmpP(rp.kpis[4],r1.m.grossYield,1,'report gross yield'); cmpP(rp.kpis[5],r1.m.capRate,1,'report cap rate');
  const c1=r1.costs, ieWant={'Rent':c1.rentA,'Vacancy':-c1.vacancyA,'Income collected':r1.effA,'Levy':-c1.levyA,'Rates and taxes':-c1.ratesA,'Insurance':-c1.insuranceA,
    'Management':-c1.mgmtA,'Maintenance':-c1.maintA,'Net operating income':r1.noi,'Bond repayment':-r1.debtA,'Cash flow':r1.cfA};
  Object.entries(ieWant).forEach(([k,v])=>{ const row=rp.ie[k]; ok(!!row,'report income row '+k,'missing'); if(row){ cmpR(row[1],v,'report annual '+k); cmpR(row[0],v/12,'report monthly '+k); } });
  cmpR(rp.cash['Deposit'][0],r1.deposit,'report deposit'); cmpR(rp.cash['Transfer duty'][0],r1.duty,'report duty'); cmpR(rp.cash['Cash required'][0],r1.cashIn,'report cash in');
  cmpR(rp.cash['Bond amount'][0],r1.loan,'report bond'); cmpR(rp.cash['Monthly repayment'][0],r1.pmt,'report repayment');
  const dirs2={expRatio:'lo'};
  ok(rp.tests.length===10,'report lists ten tests',rp.tests.length);
  rp.tests.forEach(([k,st])=>{ const want=E.status({dir:dirs2[k]||'hi',band:k==='cfMonth'?1000:undefined},r1.m[k],TT[k]); ok(st===want,'report test status '+k,st+' vs '+want); });
  ok(rp.scen.length===E.SCENARIOS.length,'report lists every scenario',rp.scen.length);
  rp.scen.forEach(([k,v])=>cmpR(v,E.scenario(d1,k).m.cfMonth,'report scenario '+k));
  const tl1=E.timeline(d1,20,TT.discountRate);
  ok(JSON.stringify(rp.years.map(y=>y[0]))==='["1","5","10","15","20"]','pack shows years 1, 5, 10, 15 and 20',JSON.stringify(rp.years.map(y=>y[0])));
  rp.years.forEach(y=>cmpR(y[5],tl1.rows[Number(y[0])-1].cum,'pack running total, year '+y[0]));
  cmpR(rp.years[rp.years.length-1][5],tl1.net,'report 20-year running total'); cmpR(rp.ie20[2],tl1.net,'report 20-year net'); cmpR(rp.ie20[3],tl1.pv,'report present value');
  // several deals from Portfolio
  await p.goto(BASE+'#portfolio'); await p.waitForTimeout(600);
  ok(await p.isDisabled('#rptSel'),'report button waits for a selection','');
  await p.check('[data-rsel="ex-below-value"]'); await p.check('[data-rsel="ex-townhouse"]'); await p.waitForTimeout(150);
  ok((await p.textContent('#rptSel'))==='Investor report (2)','report button counts the selection',await p.textContent('#rptSel'));
  await p.click('#rptSel'); await p.waitForTimeout(700);
  const ids2=['ex-below-value','ex-townhouse'], ds2=[], rs2=[];
  for(const id of ids2){ const d={...E.DEFAULTS,...(await deal(id))}; ds2.push(d); const r=E.analyse(d); r.storm=E.scenario(d,'storm').m.cfMonth; rs2.push(r); }
  const mp=await p.evaluate(()=>({ deals:[...document.querySelectorAll('[data-r=deal]')].map(e=>e.dataset.id), cover:document.querySelectorAll('[data-r=deals] .dcard').length, exec:document.querySelector('[data-r=exec-headline]').textContent.replace(/\u00a0/g,' '),
    totals:[...document.querySelectorAll('[data-r=totals] b')].map(b=>b.textContent), cmpCols:[...document.querySelectorAll('[data-r=cmp] thead th')].length-1 }));
  ok(JSON.stringify(mp.deals)===JSON.stringify(ids2),'one section per selected deal, in order',JSON.stringify(mp.deals));
  ok(mp.cover===2,'executive summary lists the selected deals',mp.cover);
  const ctx2=[]; for(const id of ids2) ctx2.push(NN.dealContext(await deal(id),TT));
  ok(mp.exec===NN.narratePortfolio(ctx2).headline,'executive summary headline matches the commentary module',mp.exec);
  ok(mp.cmpCols===2,'summary compares the selected deals',mp.cmpCols);
  const sum2=f=>rs2.reduce((a,r)=>a+f(r),0);
  cmpR(mp.totals[0],sum2(r=>r.price),'report combined price'); cmpR(mp.totals[1],sum2(r=>r.cashIn),'report total cash');
  cmpR(mp.totals[2],sum2(r=>r.m.cfMonth),'report combined cash flow',2); cmpR(mp.totals[3],sum2(r=>r.storm),'report combined storm',2);
  // prepared by / for: escaped and remembered
  await p.fill('#rpt-by','<img src=x onerror="window.__xss=1">Rian'); await p.fill('#rpt-for','My bank'); await p.waitForTimeout(150);
  const meta=await p.evaluate(()=>({text:document.getElementById('rptMeta').textContent,imgs:document.querySelectorAll('#reportDoc img').length,xss:!!window.__xss}));
  ok(meta.imgs===0&&!meta.xss&&/Prepared by <img src=x/.test(meta.text)&&/My bank/.test(meta.text),'prepared by/for shown as plain text',JSON.stringify(meta));
  // print: only the report document
  await p.emulateMedia({media:'print'}); await p.waitForTimeout(150);
  const pr2=await p.evaluate(()=>{ const vis=s=>{ const e=document.querySelector(s); return !!e&&getComputedStyle(e).display!=='none'; };
    return {side:vis('.side'),tabbar:vis('.tabbar'),bar:vis('.rpt-bar'),top:vis('.topbar'),doc:vis('#reportDoc'),breaks:[...document.querySelectorAll('.rpt-deal')].map(e=>getComputedStyle(e).breakBefore)}; });
  ok(!pr2.side&&!pr2.tabbar&&!pr2.bar&&!pr2.top&&pr2.doc,'printing shows only the report',JSON.stringify(pr2));
  ok(pr2.breaks.length===3&&pr2.breaks.every(b=>b==='page'),'summary and each deal start a new page',JSON.stringify(pr2.breaks));
  ok(await p.evaluate(()=>[...document.querySelectorAll('#reportDoc .sheet')].slice(1).every(e=>getComputedStyle(e).breakBefore==='page')),'every sheet after the cover starts a new page','');
  await p.emulateMedia({media:'screen'});
  // select all, including deals with hostile names from the import test
  await p.goto(BASE+'#portfolio'); await p.waitForTimeout(500);
  await p.click('#rselAll'); await p.waitForTimeout(150);
  const nDeals=await p.evaluate(()=>document.querySelectorAll('[data-rsel]').length);
  ok((await p.textContent('#rptSel'))===`Investor report (${nDeals})`,'select all selects every deal',await p.textContent('#rptSel'));
  await p.click('#rptSel'); await p.waitForTimeout(900);
  const allR=await p.evaluate(()=>({n:document.querySelectorAll('[data-r=deal]').length,imgs:document.querySelectorAll('#reportDoc img[src="x"]').length,xss:!!window.__xss,scripts:document.scripts.length}));
  ok(allR.n===nDeals&&allR.imgs===0&&!allR.xss&&allR.scripts===1,'report of every deal renders hostile names as text',JSON.stringify(allR));
  await p.reload(); await p.waitForTimeout(700);
  ok((await p.inputValue('#rpt-by')).endsWith('Rian'),'prepared by is remembered',await p.inputValue('#rpt-by'));
  ok(/No deals chosen/.test(await p.textContent('#reportDoc')),'report page without a selection explains what to do','');

  // ---------- legal content ----------
  ok(!/Turner|Boel|Cederberg|Conradie|Pinelands/i.test(html),'site names no real investors or developments','');
  ok(EX.every(d=>/^Example: /.test(d.name)&&/not a real listing/.test(d.notes)),'example deals are marked as made up','');
  await p.goto(BASE+'#terms'); await p.waitForTimeout(400);
  const tv=await p.evaluate(()=>({visible:!document.getElementById('v-terms').hidden,title:document.querySelector('#crumbs h1').textContent,text:document.getElementById('v-terms').textContent}));
  ok(tv.visible&&tv.title==='Terms & privacy','terms view opens',JSON.stringify(tv.title));
  ok(/Not advice/.test(tv.text)&&/GitHub Pages/.test(tv.text)&&/POPIA/.test(tv.text)&&/Republic of South Africa/.test(tv.text),'terms cover advice, hosting, POPIA and law','');
  const dates=await p.evaluate(()=>[...document.querySelectorAll('[data-checked]')].map(e=>e.textContent));
  ok(dates.length>=3&&dates.every(Boolean),'last-checked dates are shown',JSON.stringify(dates));

  // ---------- self-hosted fonts ----------
  const fontsOk=await p.evaluate(async()=>{ await document.fonts.ready; return [document.fonts.check('14px "Geist"'),document.fonts.check('14px "Geist Mono"')]; });
  ok(fontsOk[0]&&fontsOk[1],'self-hosted fonts load',JSON.stringify(fontsOk));
  ok(!/googleapis|gstatic/.test(html),'website loads nothing from Google','');

  // ---------- hostile import ----------
  const bad='"><img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
  const hostile={}; Object.keys(E.DEFAULTS).forEach(k=>hostile[k]=bad);
  fs.writeFileSync(imp,JSON.stringify({deals:[{...hostile,id:'hostile1',inCompare:true,slot:'"><img src=x>'},{...hostile,id:'"><img src=x onerror=alert(1)>'}],targets:{irr:bad,prime:bad}}));
  await p.goto(BASE+'#settings'); await p.waitForTimeout(400);
  await p.setInputFiles('#importFile',imp); await p.waitForTimeout(900); fs.unlinkSync(imp);
  for(const v of ['portfolio','compare','analyse','guide']){
    await p.goto(BASE+'#'+v); await p.waitForTimeout(500);
    if(v==='analyse'){ await p.selectOption('#dealPick','hostile1'); await p.waitForTimeout(400); }
    const hit=await p.evaluate(()=>({xss:!!window.__xss,imgs:document.querySelectorAll('img[src="x"]').length,scripts:document.scripts.length}));
    ok(!hit.xss&&hit.imgs===0&&hit.scripts===1,'hostile import cannot inject markup: '+v,JSON.stringify(hit));
  }
  // The policy itself: injected inline handlers and outbound requests are blocked.
  const before=errs.length;
  const pol=await p.evaluate(async()=>{
    document.body.insertAdjacentHTML('beforeend','<img src="data:," onload="window.__csp=1" onerror="window.__csp=1">');
    let fetched=true; try{ await fetch('https://example.com/'); }catch(e){ fetched=false; }
    await new Promise(r=>setTimeout(r,300)); return {handler:!!window.__csp,fetched};
  });
  ok(!pol.handler,'CSP blocks injected inline handlers',JSON.stringify(pol));
  ok(!pol.fetched,'CSP blocks sending data off the page',JSON.stringify(pol));
  errs.splice(before,errs.length-before,...errs.slice(before).filter(e=>!/Content Security Policy|Failed to fetch/.test(e))); // the probe's own expected violations
  const hs=await p.evaluate(()=>JSON.parse(localStorage.getItem('buybox-data')));
  ok(typeof hs.properties.hostile1.price==='undefined'||typeof hs.properties.hostile1.price==='number','import keeps numbers as numbers',typeof hs.properties.hostile1.price);
  ok(hs.settings.targets.irr===17&&hs.settings.targets.prime===11.5,'import ignores non-numeric targets',JSON.stringify(hs.settings.targets));

  console.log(JSON.stringify({deals:N,pass,fail,pageErrors:errs,failures,checkTypes:Object.keys(counts).length},null,1));
  await b.close(); server.close();
  if(fail||errs.length) process.exitCode=1;
})();
