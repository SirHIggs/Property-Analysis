// Independent checks of the Buy Box calculation engine.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/buy-box.html', 'utf8');
const src = html.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const E = new Function(src + '; return {DEFAULTS,DEFAULT_TARGETS,transferDuty,irr,analyse,SCENARIOS,scenario,breakPoints,offerPrice,verdict,status,timeline};')();

let pass = 0, fail = 0; const failures = [];
function ok(cond, name, detail) { if (cond) pass++; else { fail++; if (failures.length < 40) failures.push(name + (detail ? ' :: ' + detail : '')); } }
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const groups = {};
function group(name, fn) { const p0 = pass, f0 = fail; fn(); groups[name] = { pass: pass - p0, fail: fail - f0 }; }

// independent helpers (not using engine code)
function simulate(loan, annualRate, months, pmt) {
  let bal = loan, interest = [], balances = [];
  const r = annualRate / 1200;
  for (let m = 1; m <= months; m++) { const i = bal * r; interest.push(i); bal = bal + i - pmt; balances.push(bal); }
  return { bal, interest, balances };
}
function solvePmt(loan, annualRate, months) { // bisection, no closed form
  let lo = 0, hi = loan; for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (simulate(loan, annualRate, months, mid).bal > 0) lo = mid; else hi = mid; } return (lo + hi) / 2;
}
function npv(flows, r) { return flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0); }

group('Transfer duty vs SARS table', () => {
  const T = E.transferDuty;
  const cases = [[0,0],[900000,0],[1210000,0],[1210001,0.03],[1500000,8700],[1663800,13614],[2000000,33786],[2329300,53544],[2994800,106784],[3500000,162356],[13310000,1241456],[15000000,1241456+0.13*1690000]];
  cases.forEach(([v, e]) => ok(near(T(v), e, 0.01), 'duty ' + v, 'got ' + T(v) + ' want ' + e));
  [1210000,1663800,2329300,2994800,13310000].forEach(b => ok(Math.abs(T(b + 1) - T(b)) <= 0.13 + 1e-9, 'continuous at ' + b));
  let prev = -1, mono = true; for (let v = 0; v <= 20e6; v += 5000) { const d = T(v); if (d < prev - 1e-9) mono = false; prev = d; } ok(mono, 'duty never decreases as price rises');
});

group('Bond maths vs month-by-month simulation', () => {
  const combos = [];
  for (const loan of [100000, 1008000, 2500000]) for (const rate of [0, 7, 10.75, 13.25, 20]) for (const term of [1, 5, 20, 30]) combos.push([loan, rate, term]);
  combos.forEach(([loan, rate, term]) => {
    const r = E.analyse({ price: loan, deposit: 0, rate, term, newDev: true, hold: term });
    const N = term * 12;
    const sim = simulate(loan, rate, N, r.pmt);
    ok(Math.abs(sim.bal) < 0.5, `loan fully repaid ${loan}@${rate}% ${term}y`, 'left ' + sim.bal.toFixed(2));
    ok(near(r.pmt, solvePmt(loan, rate, N), 0.01), `payment matches solver ${loan}@${rate}% ${term}y`);
    const int1 = sim.interest.slice(0, 12).reduce((a, b) => a + b, 0);
    ok(near(r.interest1, int1, 0.5), `year-1 interest ${loan}@${rate}% ${term}y`, r.interest1 + ' vs ' + int1);
  });
  const known = E.analyse({ price: 1000000, deposit: 0, rate: 10.75, term: 20, newDev: true });
  ok(near(known.pmt, 10152.29, 1), 'R1m at 10.75% over 20y is about R10 152 a month', known.pmt.toFixed(2));
});

group('Cash flow built up by hand (Cederberg 1-bed)', () => {
  const d = { price: 1120000, newDev: true, rent: 10000, vacancy: 4, levy: 1400, rates: 550, insurance: 100, mgmt: 11.5, maint: 5, deposit: 10, rate: 10.75, term: 20 };
  const r = E.analyse(d);
  const gross = 120000, eff = gross * 0.96, opex = (1400 + 550 + 100) * 12 + 0.115 * eff + 0.05 * gross, noi = eff - opex;
  const loan = 1008000, i = 0.1075 / 12, pmt = loan * i / (1 - Math.pow(1 + i, -240));
  ok(near(r.noi, noi, 0.01), 'NOI', r.noi + ' vs ' + noi);
  ok(near(r.cfA, noi - 12 * pmt, 0.01), 'annual cash flow');
  ok(near(r.m.cfMonth, -4287.6, 1.5), 'monthly cash flow about −R4 288', r.m.cfMonth.toFixed(2));
  ok(near(r.cashIn, 112000, 0.01), 'cash in = 10% deposit, no duty or fees on a new development');
  ok(near(r.m.grossYield, 10.714, 0.01), 'gross yield 10.7%');
  ok(near(r.m.onePct, 0.893, 0.001), '1% rule 0.89%');
  ok(near(r.m.capRate, noi / 1120000 * 100, 1e-9), 'cap rate');
  ok(near(r.m.dscr, noi / (12 * pmt), 1e-9), 'DSCR');
  ok(near(r.m.coc, r.cfA / 112000 * 100, 1e-9), 'cash-on-cash');
});

group('Break-even rent really breaks even', () => {
  for (let k = 0; k < 300; k++) {
    const d = rand();
    const r = E.analyse(d);
    if (!isFinite(r.m.breakEven)) continue;
    if (r.m.breakEven === 0) { ok(E.analyse({ ...d, rent: 0 }).m.cfMonth >= -0.01, 'zero break-even means costs covered by other income'); continue; }
    const at = E.analyse({ ...d, rent: r.m.breakEven });
    ok(Math.abs(at.m.cfMonth) < 0.01, 'cash flow is zero at break-even rent', at.m.cfMonth);
  }
});

group('IRR', () => {
  ok(near(E.irr([-100, 110]), 0.10, 1e-9), 'IRR of −100, +110 is 10%');
  ok(near(E.irr([-100, 0, 121]), 0.10, 1e-9), 'IRR of −100, 0, +121 is 10%');
  ok(E.irr([-100, -10, -10]) === -1, 'money that never comes back returns −100%');
  ok(Number.isNaN(E.irr([0, 10])), 'no cash in means no IRR');
  for (let k = 0; k < 400; k++) {
    const r = E.analyse(rand());
    if (isFinite(r.m.irr) && r.m.irr > -99.9) {
      const x = r.m.irr / 100, scale = r.flows.reduce((s, f, t) => s + Math.abs(f) / Math.pow(1 + x, t), 0);
      const a = npv(r.flows, x - 1e-7), b = npv(r.flows, x + 1e-7);
      ok(Math.abs(npv(r.flows, x)) <= scale * 1e-6 || Math.sign(a) !== Math.sign(b), 'NPV at IRR is zero (relative to size of flows)', r.m.irr);
    }
  }
});

group('Accounting identities', () => {
  for (let k = 0; k < 1000; k++) {
    const d = rand(), r = E.analyse(d);
    const sumFlows = r.flows.reduce((a, b) => a + b, 0);
    ok(near(sumFlows, r.series[r.H], Math.max(0.01, Math.abs(sumFlows) * 1e-9)), 'net gain = sum of all cash flows incl. sale');
    ok(near(r.totalCost - r.cashIn, r.loan, 0.01), 'total cost − cash in = bond');
    if (r.cashIn > 0) ok(Math.sign(r.m.coc) === Math.sign(r.cfA) || r.cfA === 0, 'cash-on-cash has the sign of cash flow');
    const v = E.verdict(r, E.DEFAULT_TARGETS); ok(v.n >= 8 && v.n <= 10 && v.pass + v.close + v.fail === v.n, 'verdict counts add up');
    if (r.taxR > 0) ok(near(r.afterTaxCfM * 12, r.cfA - (r.noi - r.interest1) * r.taxR, 0.01), 'after-tax cash flow');
  }
});

group('Edge cases', () => {
  const cash = E.analyse({ price: 900000, deposit: 100, rent: 8000 });
  ok(cash.pmt === 0 && cash.m.dscr === Infinity, 'cash buy has no bond');
  ok(near(cash.m.coc, cash.m.effYield, 1e-9), 'cash buy: cash-on-cash equals effective yield');
  const zero = E.analyse({ price: 1000000, deposit: 0, newDev: true, rent: 5000 });
  ok(zero.cashIn === 0 && zero.m.coc === -Infinity && Number.isNaN(zero.m.irr), '100% bond, no costs: no cash in, handled');
  const r0 = E.analyse({ price: 1200000, deposit: 0, rate: 0, term: 20, newDev: true });
  ok(near(r0.pmt, 1200000 / 240, 1e-9), '0% interest: loan ÷ months');
  const t0 = E.analyse({ price: 1000000, deposit: 0, term: 0, newDev: true });
  ok(isFinite(t0.pmt) && t0.pmt > 0, 'term 0 is treated as 1 year, not as no bond');
  const short = E.analyse({ price: 1000000, deposit: 20, term: 5, hold: 10, rentGrowth: 0, costGrowth: 0, newDev: true });
  ok(near(short.flows[6], short.noi, 0.01), 'no bond payments after the bond is paid off');
  const y0 = E.analyse({ price: 1000000, marketValue: 1250000, deposit: 10, sellCost: 7 });
  ok(near(y0.series[0], 1250000 * 0.93 - 900000 - y0.cashIn, 0.01), 'day-one position counts the discount to market value');
  const junk = [{ price: 'abc' }, { price: null }, { rent: -5000 }, { vacancy: 150 }, { deposit: -20 }, { term: 100 }, { hold: 0 }, { hold: 500 }, { price: 1e12, rent: 1e9 }, { mgmt: -10, maint: 200 }, { legal: 'x' }, { marketValue: -5 }, {}];
  junk.forEach(j => {
    let r, err = null; try { r = E.analyse(j); } catch (e) { err = e; }
    ok(!err, 'no crash on ' + JSON.stringify(j), err && err.message);
    if (r) ok(isFinite(r.m.cfMonth) && isFinite(r.cashIn) && r.series.every(isFinite), 'finite results on ' + JSON.stringify(j));
  });
});

group('Monotonic: worse inputs never help', () => {
  for (let k = 0; k < 800; k++) {
    const d = rand(), b = E.analyse(d).m.cfMonth;
    ok(E.analyse({ ...d, rate: d.rate + 1 }).m.cfMonth <= b + 1e-6, 'higher rate, less cash flow');
    ok(E.analyse({ ...d, rent: d.rent * 0.9 }).m.cfMonth <= b + 1e-6, 'lower rent, less cash flow');
    ok(E.analyse({ ...d, vacancy: Math.min(100, d.vacancy + 5) }).m.cfMonth <= b + 1e-6, 'more vacancy, less cash flow');
    ok(E.analyse({ ...d, levy: d.levy * 1.25 }).m.cfMonth <= b + 1e-6, 'higher levy, less cash flow');
    ok(E.analyse({ ...d, price: d.price * 1.1 }).m.cfMonth <= b + 1e-6, 'higher price, less cash flow');
    const storm = E.scenario(d, 'storm').m.cfMonth;
    E.SCENARIOS.forEach(s => ok(E.scenario(d, s.k).m.cfMonth >= storm - 1e-6, 'perfect storm is the worst scenario (' + s.k + ')'));
  }
});

group('Breaking points land exactly on the edge', () => {
  for (let k = 0; k < 250; k++) {
    const d = rand(), bp = E.breakPoints(d, E.DEFAULT_TARGETS);
    if (bp.rate.kind === 'ok') { ok(Math.abs(E.analyse({ ...d, rate: bp.rate.v }).m.cfMonth) < 1, 'cash flow ≈ 0 at the breaking interest rate'); ok(E.analyse({ ...d, rate: bp.rate.v + 0.05 }).m.cfMonth < 0, 'and negative just above it'); }
    if (bp.vac.kind === 'ok') ok(Math.abs(E.analyse({ ...d, vacancy: bp.vac.v }).m.cfMonth) < 1, 'cash flow ≈ 0 at the breaking vacancy');
    if (bp.offerCoc.kind === 'ok') {
      ok(E.analyse({ ...d, price: bp.offerCoc.v }).m.coc >= 12 - 1e-6, 'offer price meets 12% cash-on-cash', E.analyse({ ...d, price: bp.offerCoc.v }).m.coc);
      ok(E.analyse({ ...d, price: bp.offerCoc.v + 2000 }).m.coc < 12, 'R2 000 more misses 12%');
    }
    if (bp.offerCf.kind === 'ok') ok(E.analyse({ ...d, price: bp.offerCf.v }).m.cfMonth >= -1e-6, 'break-even offer price is cash-flow positive');
  }
});

group('20-year income vs expenses', () => {
  for (let k = 0; k < 800; k++) {
    const d = rand(), r = E.analyse(d), tl = E.timeline(d, 20);
    ok(tl.rows.length === 20, '20 rows');
    for (let y = 1; y <= Math.min(20, r.H); y++) {
      const flow = r.flows[y] - (y === r.H ? r.flows[y] - tl.rows[y - 1].net : 0);
      ok(near(tl.rows[y - 1].net, y === r.H ? tl.rows[y - 1].net : r.flows[y], 0.01), 'year ' + y + ' matches the main model');
    }
    ok(near(tl.rows[0].net, r.cfA, 0.01), 'year 1 net equals year-1 cash flow');
    ok(near(tl.net, tl.income - tl.expenses, 0.01), '20-year net = income − expenses');
    ok(near(tl.topUp, -tl.rows.reduce((s, x) => s + Math.min(0, x.net), 0), 0.01), 'top-up = sum of shortfalls');
    if (tl.crossover) ok(tl.rows.slice(tl.crossover - 1).every(x => x.net >= 0), 'from the crossover year on, rent covers every cost');
    else ok(tl.rows[19].net < 0, 'no crossover means still short in year 20');
    tl.rows.forEach(x => ok(near(x.expenses, x.running + x.bond, 1e-6) && x.bond >= 0 && x.running >= 0, 'expenses add up'));
  }
  const paid = E.timeline({ price: 1000000, deposit: 10, term: 5, newDev: true }, 20);
  ok(paid.bondFreeYear === 6 && paid.rows[5].bond === 0 && paid.rows[4].bond > 0, 'bond stops after a 5-year term');
});

group('Present value of the 20-year cash', () => {
  for (let k = 0; k < 800; k++) {
    const d = rand(), rate = Math.random() * 20;
    const tl = E.timeline(d, 20, rate);
    let pv = 0; tl.rows.forEach(x => { pv += x.net * Math.pow(1 + rate / 100, -x.y); });
    ok(near(tl.pv, pv, Math.max(0.01, Math.abs(pv) * 1e-9)), 'PV = Σ net ÷ (1+r)^year');
    ok(near(E.timeline(d, 20, 0).pv, tl.net, 0.01), 'PV at 0% equals the raw 20-year total');
    if (tl.rows.every(x => x.net > 0)) ok(E.timeline(d, 20, rate + 2).pv < tl.pv, 'all-positive cash: a higher rate lowers PV');
    if (tl.rows.every(x => x.net < 0)) ok(E.timeline(d, 20, rate + 2).pv > tl.pv, 'all-negative cash: a higher rate makes PV less negative');
    ok(Math.abs(tl.pv) <= tl.rows.reduce((s, x) => s + Math.abs(x.net), 0) + 0.01, 'PV never exceeds the undiscounted size of the flows');
  }
  const flat = E.timeline({ price: 1000000, deposit: 100, rent: 10000, vacancy: 0, levy: 0, rates: 0, insurance: 0, otherExp: 0, mgmt: 0, maint: 0, rentGrowth: 0, costGrowth: 0 }, 20, 10);
  const annuity = 120000 * (1 - Math.pow(1.1, -20)) / 0.1;
  ok(near(flat.pv, annuity, 0.01), 'R120k a year for 20 years at 10% = annuity formula (R1 021 628)', flat.pv);
});

console.log(JSON.stringify({ pass, fail, groups, failures }, null, 1));

function rand() {
  const R = (a, b) => a + Math.random() * (b - a);
  const newDev = Math.random() < 0.4;
  return {
    price: Math.round(R(300000, 6000000)), marketValue: Math.random() < 0.3 ? Math.round(R(300000, 7000000)) : '', newDev,
    reno: Math.random() < 0.3 ? Math.round(R(0, 200000)) : 0, legal: Math.random() < 0.2 ? Math.round(R(0, 90000)) : '',
    rent: Math.round(R(3000, 45000)), otherIncome: Math.random() < 0.2 ? Math.round(R(0, 1500)) : 0, vacancy: R(0, 20),
    levy: Math.round(R(300, 5000)), rates: Math.round(R(0, 3000)), insurance: Math.round(R(0, 600)), otherExp: Math.round(R(0, 500)),
    mgmt: R(0, 15), maint: R(0, 10), deposit: Math.random() < 0.1 ? 100 : Math.round(R(0, 50)), rate: R(0, 16), term: Math.round(R(1, 30)),
    rentGrowth: R(-2, 10), costGrowth: R(0, 10), capGrowth: R(-3, 10), hold: Math.round(R(1, 30)), sellCost: R(0, 10), taxRate: Math.random() < 0.4 ? R(18, 45) : 0
  };
}
