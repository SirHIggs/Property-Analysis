// Checks the investor-pack commentary (src/narrative.js) against the engine, across thousands of random deals.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/buy-box.html', 'utf8');
const engine = html.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const narr = html.split('/*NARRATIVE-START*/')[1].split('/*NARRATIVE-END*/')[0];
const N = new Function(engine + narr + '; return {DEFAULTS,DEFAULT_TARGETS,analyse,verdict,scenario,breakPoints,timeline,SCORED,status,dealContext,narrateDeal,narratePortfolio,rentSplit,gradeLetter,nR};')();

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, detail) { if (cond) pass++; else { fail++; if (failures.length < 40) failures.push(name + (detail ? ' :: ' + detail : '')); } }
const groups = {};
function group(name, fn) { const p0 = pass, f0 = fail; fn(); groups[name] = { pass: pass - p0, fail: fail - f0 }; }
const T = N.DEFAULT_TARGETS;
const ADVICE = /\b(should|shouldn't|recommend\w*|must|guarantee\w*|buy it|don't buy|do not buy|advise\w*)\b/i;
const BAD = /NaN|Infinity|undefined|null|\[object/;
const sp = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const Ra = n => 'R ' + sp(n);

function rand(i) {
  const R = (a, b) => a + Math.random() * (b - a), newDev = Math.random() < 0.4;
  const d = {
    name: 'Deal ' + i, price: Math.round(R(300000, 6000000)), marketValue: Math.random() < 0.3 ? Math.round(R(300000, 7000000)) : '', newDev,
    reno: Math.random() < 0.3 ? Math.round(R(0, 200000)) : 0, legal: Math.random() < 0.2 ? Math.round(R(0, 90000)) : '',
    rent: Math.round(R(3000, 45000)), otherIncome: Math.random() < 0.2 ? Math.round(R(0, 1500)) : 0, vacancy: R(0, 20),
    levy: Math.round(R(300, 5000)), rates: Math.round(R(0, 3000)), insurance: Math.round(R(0, 600)), otherExp: Math.round(R(0, 500)),
    mgmt: R(0, 15), maint: R(0, 10), deposit: Math.random() < 0.1 ? 100 : Math.round(R(0, 50)), rate: R(0, 16), term: Math.round(R(1, 30)),
    rentGrowth: R(-2, 10), costGrowth: R(0, 10), capGrowth: R(-3, 10), hold: Math.round(R(1, 30)), sellCost: R(0, 10), taxRate: 0
  };
  if (i % 13 === 0) { d.newDev = true; d.deposit = 0; d.reno = 0; }   // no cash in
  if (i % 17 === 0) d.deposit = 100;                                  // cash purchase
  if (i % 19 === 0) { d.rent = 0; d.otherIncome = 0; }               // no rent yet
  return d;
}
const allText = n => [n.headline, n.summary, ...n.strengths, ...n.watch, ...Object.values(n.sections).flatMap(s => [s.lead, s.text])];

group('Every sentence is readable and never advice', () => {
  for (let i = 1; i <= 3000; i++) {
    const n = N.narrateDeal(N.dealContext(rand(i), T));
    allText(n).forEach(s => { ok(typeof s === 'string' && s.trim().length > 0, 'non-empty sentence'); ok(!BAD.test(s), 'no NaN/Infinity/undefined', s); ok(!ADVICE.test(s), 'no advice words', s); ok(!/\s{2,}|\s[.,:]/.test(s), 'no stray spaces', JSON.stringify(s)); });
    ['cashFlow', 'cash', 'returns', 'tests', 'stress', 'offer', 'longTerm'].forEach(k => ok(!!n.sections[k], 'section ' + k));
    ok(n.strengths.length <= 3 && n.watch.length <= 3, 'at most three strengths and watch-outs');
  }
});

group('Figures quoted match the engine', () => {
  for (let i = 1; i <= 3000; i++) {
    const c = N.dealContext(rand(i), T), n = N.narrateDeal(c), r = c.r, cf = r.m.cfMonth;
    if (r.costs.grossA > 0) {
      if (cf >= 50) ok(n.headline.includes(Ra(cf)) && n.sections.cashFlow.text.includes(Ra(cf)), 'positive cash flow quoted', n.headline);
      if (cf <= -50) ok(n.headline.includes(Ra(-cf)) && /from your pocket/.test(n.headline) && /top up/i.test(n.sections.cashFlow.lead), 'shortfall quoted and called a top-up', n.headline);
      if (cf > -50 && cf < 50) ok(/breaks even/.test(n.headline), 'break-even wording', n.headline);
      if (cf < 0) ok(!/to spare|left over/.test(n.headline + n.sections.cashFlow.text), 'never "left over" when you top up');
      if (c.tl.crossover && cf <= -50) ok(n.headline.includes('year ' + c.tl.crossover), 'crossover year quoted');
      ok(n.sections.stress.text.includes(N.nR(c.scen.storm)), 'storm cash flow quoted');
      if (c.bp.rate.kind === 'ok') ok(n.sections.stress.text.includes(c.bp.rate.v.toFixed(2) + '%'), 'breaking rate quoted');
    }
    if (r.cashIn > 0) ok(n.sections.cash.lead.includes(Ra(r.cashIn)), 'cash needed quoted');
    else ok(/No cash goes in/.test(n.sections.cash.lead), 'no-cash wording');
    ok(c.tl.pv >= 0 ? n.sections.longTerm.text.includes('worth ' + N.nR(c.tl.pv)) : n.sections.longTerm.text.includes('net cost of ' + Ra(-c.tl.pv)), 'present value quoted', n.sections.longTerm.text);
    ok(n.sections.tests.lead.includes(`meets ${c.v.pass} of ${c.v.n} tests`) && n.sections.tests.lead.startsWith('Grade ' + c.g), 'tests count and grade');
  }
});

group('Where R100 of rent goes adds up', () => {
  for (let i = 1; i <= 3000; i++) {
    const c = N.dealContext(rand(i), T), s = N.rentSplit(c.r);
    if (!(c.r.costs.grossA > 0)) { ok(s === null, 'no split without rent'); continue; }
    ok(s.vacancy + s.running + s.bond + s.left === 100, 'split adds to 100', JSON.stringify(s));
    if (c.r.cfA > c.r.costs.grossA * 0.01) ok(s.left >= 0, 'clearly positive deal leaves something', JSON.stringify(s));
    if (c.r.cfA < -c.r.costs.grossA * 0.01) ok(s.left <= 0, 'clearly negative deal leaves nothing', JSON.stringify(s));
  }
});

group('Strengths and watch-outs agree with the tests', () => {
  const LABEL = {onePct: 'the 1% rule', expRatio: 'the expense ratio', cfMonth: 'monthly cash flow', capRate: 'cap rate', dscr: 'debt cover (DSCR)', grossYield: 'gross yield', effYield: 'effective yield', coc: 'cash-on-cash', discount: 'the discount to value', irr: 'annualised return'};
  for (let i = 1; i <= 2000; i++) {
    const c = N.dealContext(rand(i), T), n = N.narrateDeal(c);
    N.SCORED.forEach(row => {
      const st = N.status(row, c.r.m[row.k], T[row.k]), L = LABEL[row.k];
      const named = s => s.toLowerCase().startsWith(L.toLowerCase() + ' ');
      if (n.strengths.some(named)) ok(st === 'pass', 'strength only for a met test', row.k + ' ' + st);
      if (n.watch.some(named)) ok(st === 'fail', 'watch-out only for a missed test', row.k + ' ' + st);
    });
    if (c.r.costs.grossA > 0 && c.r.m.cfMonth <= -50) ok(n.watch[0].startsWith('Costs you'), 'a monthly top-up is the first watch-out');
  }
});

group('Grade letter matches the page', () => {
  [[0.95, 'A'], [0.9, 'A'], [0.89, 'B'], [0.75, 'B'], [0.6, 'C'], [0.55, 'C'], [0.4, 'D'], [0.35, 'D'], [0.1, 'E'], [0, 'E']].forEach(([r, g]) => ok(N.gradeLetter(r) === g, 'grade ' + r));
});

group('Portfolio summary counts and leaders', () => {
  for (let k = 0; k < 400; k++) {
    const m = 2 + Math.floor(Math.random() * 6), ctxs = [];
    for (let i = 0; i < m; i++) { const d = rand(k * 10 + i + 1); if (!(d.rent > 0)) d.rent = 9000; ctxs.push(N.dealContext(d, T)); }
    const p = N.narratePortfolio(ctxs), fit = ctxs.filter(c => c.v.cls === 'pass').length, sumCash = ctxs.reduce((a, c) => a + c.r.cashIn, 0);
    ok(p.fit === fit && p.headline.includes(String(fit === 0 || fit === m ? m : fit)), 'fit count', p.headline);
    ok(p.summary.includes(Ra(sumCash)), 'combined cash quoted');
    const most = ctxs.reduce((b, c) => c.r.m.cfMonth > b.r.m.cfMonth ? c : b);
    ok(p.leaders[1].name === most.name, 'most cash flow leader');
    const least = ctxs.reduce((b, c) => c.r.cashIn < b.r.cashIn ? c : b);
    ok(p.leaders[4].name === least.name, 'least cash leader');
    [p.headline, p.summary, p.trade, ...p.leaders.map(l => l.value)].forEach(s => { ok(!BAD.test(s), 'portfolio text readable', s); ok(!ADVICE.test(s), 'portfolio text not advice', s); });
  }
});

group('Year-by-year cash ties to the engine (used to split rent from sale)', () => {
  for (let i = 1; i <= 1000; i++) {
    const c = N.dealContext(rand(i), T), r = c.r;
    for (let y = 1; y < r.H; y++) ok(Math.abs(r.flows[y] - c.tlH.rows[y - 1].net) < 1e-6, 'yearly cash matches', y);
  }
});

console.log(JSON.stringify({ pass, fail, groups, failures }, null, 1));
if (fail) process.exitCode = 1;
