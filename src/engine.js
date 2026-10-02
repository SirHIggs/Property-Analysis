/*ENGINE-START*/
const DEFAULTS = {
  name:"New deal", area:"", notes:"", newDev:false,
  price:1000000, marketValue:"", reno:0, legal:"",
  rent:9000, otherIncome:0, vacancy:4,
  levy:1200, rates:500, insurance:150, otherExp:0, mgmt:11.5, maint:5,
  deposit:10, rate:10.75, term:20,
  rentGrowth:6, costGrowth:7, capGrowth:5, hold:10, sellCost:7, taxRate:0
};
// prime is the SA prime lending rate (10.75% at September 2026). It is a setting rather than a graded target:
// new deals start at it and the present-value discount rate follows it until the user sets their own.
const DEFAULT_TARGETS = {onePct:1, expRatio:50, cfMonth:0, capRate:8, dscr:1.2, grossYield:10, effYield:8, coc:12, discount:10, irr:15, discountRate:10.75, prime:10.75};
function num(v){ const n=Number(v); return isFinite(n)?n:0; }
function clamp(v,lo,hi){ return Math.min(hi,Math.max(lo,v)); }
function transferDuty(v){
  if(v<=1210000) return 0;
  if(v<=1663800) return 0.03*(v-1210000);
  if(v<=2329300) return 13614+0.06*(v-1663800);
  if(v<=2994800) return 53544+0.08*(v-2329300);
  if(v<=13310000) return 106784+0.11*(v-2994800);
  return 1241456+0.13*(v-13310000);
}
function irr(flows){
  if(!(flows[0]<0)) return NaN;
  const npv=r=>{ let s=0; for(let t=0;t<flows.length;t++) s+=flows[t]/Math.pow(1+r,t); return s; };
  let lo=-0.9999, hi=50, flo=npv(lo), fhi=npv(hi);
  if(flo<0 && fhi<0) return -1;          // the money never comes back
  if(flo*fhi>0) return NaN;              // above 5000% a year: not meaningful
  for(let i=0;i<300;i++){ const mid=(lo+hi)/2, fm=npv(mid); if(fm===0) return mid; if((flo<0)===(fm<0)){lo=mid;flo=fm;} else {hi=mid;} }
  return (lo+hi)/2;
}
function analyse(raw,lite){
  const p = {...DEFAULTS, ...raw};
  const price=Math.max(0,num(p.price)), rent=Math.max(0,num(p.rent)), other=Math.max(0,num(p.otherIncome));
  const vac=clamp(num(p.vacancy),0,100)/100, mg=clamp(num(p.mgmt),0,100)/100, mt=clamp(num(p.maint),0,100)/100;
  const fixedM = Math.max(0,num(p.levy))+Math.max(0,num(p.rates))+Math.max(0,num(p.insurance))+Math.max(0,num(p.otherExp));
  const dep = clamp(num(p.deposit),0,100)/100;
  const loan = price*(1-dep);
  const duty = p.newDev?0:transferDuty(price);
  const legalEst = p.newDev?0:Math.round(12000+0.013*price+(loan>0?10000+0.012*loan:0));
  const legalBlank = p.legal===""||p.legal==null;
  const legal = legalBlank?legalEst:Math.max(0,num(p.legal));
  const reno = Math.max(0,num(p.reno));
  const cashIn = price*dep+duty+legal+reno;
  const totalCost = price+duty+legal+reno;
  const grossA=(rent+other)*12, effA=grossA*(1-vac);
  const opexA = fixedM*12+mg*effA+mt*grossA;
  const noi = effA-opexA;
  const r=Math.max(0,num(p.rate))/1200;
  const N = loan>0 ? Math.round(clamp(num(p.term),1,40)*12) : 0;
  const pmt = loan<=0?0:(r===0?loan/N:loan*r/(1-Math.pow(1+r,-N)));
  const bal = k => { if(loan<=0) return 0; const m=Math.min(k,N); if(r===0) return Math.max(0,loan-pmt*m); return Math.max(0, loan*Math.pow(1+r,m)-pmt*(Math.pow(1+r,m)-1)/r); };
  const debtA = pmt*Math.min(12,N);
  const cfA = noi-debtA;
  const interest1 = debtA-(loan-bal(12));
  const taxR = clamp(num(p.taxRate),0,100)/100;
  const taxDue = (noi-interest1)*taxR;
  const denom = (1-vac)*(1-mg)-mt;
  const breakEven = denom>0 ? Math.max(0,(fixedM+pmt)/denom-other) : NaN;
  const mv = Math.max(0,num(p.marketValue));
  const H = Math.round(clamp(num(p.hold)||1,1,40));
  const rg=num(p.rentGrowth)/100, cg=num(p.capGrowth)/100, fg=num(p.costGrowth)/100, sell=clamp(num(p.sellCost),0,100)/100;
  const base = mv>0?mv:price;
  const flows=[-cashIn], series=[base*(1-sell)-loan-cashIn];
  let cum=0;
  for(let y=1;y<=H;y++){
    const gA=grossA*Math.pow(1+rg,y-1), eA=gA*(1-vac);
    const op=fixedM*12*Math.pow(1+fg,y-1)+mg*eA+mt*gA;
    const months=Math.max(0,Math.min(12,N-12*(y-1)));
    const cf=eA-op-pmt*months;
    cum+=cf;
    const value=base*Math.pow(1+cg,y), b=bal(12*y);
    series.push(value*(1-sell)-b+cum-cashIn);
    flows.push(cf+(y===H?value*(1-sell)-b:0));
  }
  const coc = cashIn>0 ? cfA/cashIn*100 : (cfA>=0?Infinity:-Infinity);
  return {
    price, rent, effA, loan, duty, legal, legalEst, legalBlank, cashIn, totalCost, noi, pmt, cfA, H, series, flows, fixedM, interest1, taxR,
    deposit:price*dep, reno, ratePct:r*1200, termM:N, debtA,
    // Line items behind effA and opexA (annual), from the same clamped inputs, for reports.
    costs:{rentA:rent*12, otherIncomeA:other*12, grossA, vacancyA:grossA-effA,
      levyA:Math.max(0,num(p.levy))*12, ratesA:Math.max(0,num(p.rates))*12, insuranceA:Math.max(0,num(p.insurance))*12, otherExpA:Math.max(0,num(p.otherExp))*12,
      mgmtA:mg*effA, maintA:mt*grossA, opexA},
    afterTaxCfM:(cfA-taxDue)/12,
    m:{
      onePct: price>0?rent/price*100:NaN,
      expRatio: grossA>0?opexA/grossA*100:NaN,
      cfMonth: cfA/12,
      capRate: price>0?noi/price*100:NaN,
      dscr: debtA>0?noi/debtA:(noi>=0?Infinity:NaN),
      grossYield: price>0?grossA/price*100:NaN,
      effYield: totalCost>0?noi/totalCost*100:NaN,
      coc,
      discount: mv>0?(mv-price)/mv*100:null,
      irr: lite?NaN:(cashIn>0?irr(flows)*100:NaN),
      netGain: series[H],
      breakEven, cashIn, bondPmt:pmt
    }
  };
}
const SCENARIOS = [
  {k:"base",  label:"Today's numbers", sub:"As entered", apply:p=>p},
  {k:"rate1", label:"Prime up 1%", sub:"Interest +1 percentage point", apply:p=>({...p, rate:num(p.rate)+1})},
  {k:"rate2", label:"Prime up 2%", sub:"Back to 2023's peak and beyond", apply:p=>({...p, rate:num(p.rate)+2})},
  {k:"rent10",label:"Rent 10% lower", sub:"New supply nearby, softer market", apply:p=>({...p, rent:num(p.rent)*0.9})},
  {k:"vac2",  label:"Empty 2 months a year", sub:"Slow re-letting or a bad tenant", apply:p=>({...p, vacancy:Math.max(num(p.vacancy),100*2/12)})},
  {k:"levy",  label:"Levy & rates up 25%", sub:"Special levy or big municipal increase", apply:p=>({...p, levy:num(p.levy)*1.25, rates:num(p.rates)*1.25})},
  {k:"flat",  label:"No capital growth", sub:"Value stands still for the whole hold", apply:p=>({...p, capGrowth:0})},
  {k:"storm", label:"Perfect storm", sub:"All of the above at once", apply:p=>({...p, rate:num(p.rate)+2, rent:num(p.rent)*0.9, vacancy:Math.max(num(p.vacancy),100*2/12), levy:num(p.levy)*1.25, rates:num(p.rates)*1.25, capGrowth:0})}
];
function scenario(raw,k){ const p={...DEFAULTS,...raw}; return analyse(SCENARIOS.find(s=>s.k===k).apply(p)); }
function bisect(f,lo,hi,iters){ for(let i=0;i<(iters||80);i++){ const mid=(lo+hi)/2; if(f(mid)>=0) lo=mid; else hi=mid; } return lo; }
function offerPrice(p,g){
  const cur=Math.max(0,num(p.price)), lo=1000, hi=Math.max(cur*3,100000);
  const f=P=>g({...p,price:P});
  if(!(f(lo)>=0)) return {kind:"never"};
  if(f(hi)>=0) return {kind:"above", v:hi};
  return {kind:"ok", v:Math.floor(bisect(f,lo,hi)/1000)*1000};
}
function breakPoints(raw,targets){
  const p={...DEFAULTS,...raw}, b=analyse(p,true), cf=q=>analyse(q,true).cfA;
  let rate;
  if(b.loan<=0) rate={kind:"nobond"};
  else if(b.cfA<0) rate={kind:"already"};
  else { const f=x=>cf({...p,rate:x}); rate = f(60)>=0?{kind:"never"}:{kind:"ok", v:bisect(f,Math.max(0,num(p.rate)),60)}; }
  let vac;
  if(b.cfA<0) vac={kind:"already"};
  else { const f=x=>cf({...p,vacancy:x}); vac = f(100)>=0?{kind:"never"}:{kind:"ok", v:bisect(f,clamp(num(p.vacancy),0,100),100)}; }
  const rentDrop = b.rent>0 && isFinite(b.m.breakEven) ? (1-b.m.breakEven/b.rent)*100 : NaN;
  const offerCoc = offerPrice(p, q=>analyse(q,true).m.coc-targets.coc);
  const offerCf = offerPrice(p, q=>analyse(q,true).m.cfMonth-targets.cfMonth);
  return {rate, vac, rentDrop, offerCoc, offerCf, base:b};
}
function status(row,v,t){
  if(row.info) return "info";
  if(v==null||Number.isNaN(v)) return "na";
  if(row.dir==="hi"){ if(v>=t) return "pass"; const b=row.band??Math.abs(t)*0.2; return v>=t-b?"close":"fail"; }
  if(v<=t) return "pass"; const b=row.band??Math.abs(t)*0.15; return v<=t+b?"close":"fail";
}
const SCORED = [
  {k:"onePct",dir:"hi"},{k:"expRatio",dir:"lo"},{k:"cfMonth",dir:"hi",band:1000},{k:"capRate",dir:"hi"},{k:"dscr",dir:"hi"},
  {k:"grossYield",dir:"hi"},{k:"effYield",dir:"hi"},{k:"coc",dir:"hi"},{k:"discount",dir:"hi"},{k:"irr",dir:"hi"}
];
function verdict(res,targets){
  let n=0,s=0,pass=0,close=0,fail=0;
  SCORED.forEach(row=>{ const st=status(row,res.m[row.k],targets[row.k]); if(st==="pass"){n++;s+=1;pass++;} else if(st==="close"){n++;s+=.5;close++;} else if(st==="fail"){n++;fail++;} });
  const ratio=n?s/n:0;
  const cls=ratio>=0.75?"pass":ratio>=0.45?"close":"fail";
  return {cls, label:cls==="pass"?"Fits the box":cls==="close"?"Borderline":"Doesn't fit", icon:cls==="pass"?"✓":cls==="close"?"~":"✕", pass,close,fail,n,ratio};
}

function timeline(raw,years,discPct){
  const p={...DEFAULTS,...raw}, Y=years||20, a=analyse(p,true);
  const vac=clamp(num(p.vacancy),0,100)/100, mg=clamp(num(p.mgmt),0,100)/100, mt=clamp(num(p.maint),0,100)/100;
  const rg=num(p.rentGrowth)/100, fg=num(p.costGrowth)/100;
  const N=a.loan>0?Math.round(clamp(num(p.term),1,40)*12):0;
  const grossA=(a.rent+Math.max(0,num(p.otherIncome)))*12;
  const d=Math.max(0,num(discPct))/100;
  const rows=[]; let cum=0, inc=0, exp=0, pv=0;
  for(let y=1;y<=Y;y++){
    const gA=grossA*Math.pow(1+rg,y-1), eA=gA*(1-vac);
    const running=a.fixedM*12*Math.pow(1+fg,y-1)+mg*eA+mt*gA;
    const bond=a.pmt*Math.max(0,Math.min(12,N-12*(y-1)));
    const net=eA-running-bond; cum+=net; inc+=eA; exp+=running+bond; pv+=net/Math.pow(1+d,y);
    rows.push({y,income:eA,running,bond,expenses:running+bond,net,cum});
  }
  let lastNeg=0; rows.forEach(r=>{ if(r.net<0) lastNeg=r.y; });
  const crossover = lastNeg===0?1:(lastNeg<Y?lastNeg+1:null);
  const topUp = -rows.reduce((s,r)=>s+Math.min(0,r.net),0);
  const bondFreeYear = N>0 && N<=12*Y ? Math.ceil(N/12)+1 : (N>0?null:1);
  return {rows,crossover,topUp,net:cum,pv,discRate:d*100,income:inc,expenses:exp,bondFreeYear,firstPositive:(rows.find(r=>r.net>=0)||{}).y||null};
}
/*ENGINE-END*/