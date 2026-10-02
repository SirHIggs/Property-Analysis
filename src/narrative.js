/*NARRATIVE-START*/
// Plain-language commentary for the investor pack. Pure functions over engine results: no DOM, no maths of its own.
// It describes what the numbers say and where the risks are. It never advises: no "buy", "should" or "recommend".
// Strings may contain deal names, so callers must escape them before putting them into HTML.

const NARR_LABELS = {onePct:"the 1% rule", expRatio:"the expense ratio", cfMonth:"monthly cash flow", capRate:"cap rate",
  dscr:"debt cover (DSCR)", grossYield:"gross yield", effYield:"effective yield", coc:"cash-on-cash", discount:"the discount to value", irr:"annualised return"};
const nSp = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const nR = n => (Math.round(n) < 0 ? "−R " : "R ") + nSp(n);     // same as the page's rand()
const nRa = n => "R " + nSp(n);                                     // size of an amount, sign said in words
const nP = (n, dp) => (n < 0 ? "−" : "") + Math.abs(n).toFixed(dp == null ? 1 : dp) + "%";
const nVal = (k, v) => k === "cfMonth" ? nR(v) : k === "dscr" ? v.toFixed(2) + "×" : nP(v, k === "onePct" ? 2 : 1);
const nTgt = (k, dir, t) => k === "cfMonth" ? nR(t) : k === "dscr" ? t + "×" : t + "%";
const nGoal = dir => dir === "lo" ? "limit" : "target";
const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));
const gradeLetter = ratio => ratio >= 0.9 ? "A" : ratio >= 0.75 ? "B" : ratio >= 0.55 ? "C" : ratio >= 0.35 ? "D" : "E";

// Everything the commentary needs for one deal, from the engine alone.
function dealContext(raw, T) {
  const d = {...DEFAULTS, ...raw}, r = analyse(d), v = verdict(r, T), g = gradeLetter(v.ratio);
  const scen = {}; SCENARIOS.forEach(s => { scen[s.k] = analyse(s.apply(d)).m.cfMonth; });
  const bp = breakPoints(d, T), tl = timeline(d, 20, T.discountRate), tlH = timeline(d, r.H, 0);
  return {d, r, v, g, scen, bp, tl, tlH, T, name: String(d.name || "Untitled")};
}

// Where each R100 of rent goes. Whole rands that always add up to exactly 100; "left" is negative when you top up.
function rentSplit(r) {
  const c = r.costs, gross = c.grossA;
  if (!(gross > 0)) return null;
  const vacancy = Math.round(c.vacancyA / gross * 100), running = Math.round(c.opexA / gross * 100), bond = Math.round(r.debtA / gross * 100);
  return {vacancy, running, bond, left: 100 - vacancy - running - bond};
}

// How far past (or short of) its target each graded test is, so the best and worst can be named.
function testScores(ctx) {
  const {r, T} = ctx, out = [];
  SCORED.forEach(row => {
    const val = r.m[row.k], t = T[row.k], st = status(row, val, t);
    if (st === "na" || !isFinite(val)) return;
    let score;
    if (row.dir === "lo") score = val > 0 ? t / val : 3;
    else if (row.k === "cfMonth" || !(t > 0)) score = 1 + (val - t) / 2000;
    else score = val / t;
    out.push({k: row.k, dir: row.dir, val, t, st, score});
  });
  return out;
}

function narrateDeal(ctx) {
  const {r, v, g, scen, bp, tl, tlH, T, d} = ctx, cf = r.m.cfMonth, c = r.costs, H = r.H, split = rentSplit(r);
  const noRent = !(c.grossA > 0), hasBond = r.loan > 0;
  const S = {};

  // ---- cash flow
  if (noRent) S.cashFlow = {lead: "No rent entered yet.", text: "There is no rent or other income, so the deal has nothing to pay its costs with. Enter the expected rent to see the picture."};
  else {
    let lead, text;
    if (cf >= 50) { lead = hasBond ? "The rent pays for everything." : "No bond, and the rent covers the costs.";
      text = `After ${hasBond ? "the bond and " : ""}every running cost, about ${nRa(cf)} a month (${nRa(r.cfA)} a year) is left over before tax.`; }
    else if (cf > -50) { lead = "It roughly breaks even.";
      text = `Rent collected almost exactly covers ${hasBond ? "the bond and " : ""}the running costs, so there is little room for surprises.`; }
    else { lead = `You top up ${nRa(-cf)} a month.`;
      text = `The rent doesn't cover ${hasBond ? "the bond and " : ""}the running costs, so you would add about ${nRa(-cf)} a month (${nRa(-r.cfA)} a year) from your pocket in year 1.`
        + (tl.crossover ? ` On these growth assumptions the rent catches up in year ${tl.crossover}.` : " On these assumptions the rent doesn't catch up within 20 years."); }
    if (split) text += split.left >= 0
      ? ` Of every R100 of rent, about R${split.vacancy} is lost to empty months, R${split.running} goes to running costs${hasBond ? ` and R${split.bond} to the bond` : ""}, leaving R${split.left}.`
      : ` Of every R100 of rent, about R${split.vacancy} is lost to empty months, R${split.running} goes to running costs and R${split.bond} would go to the bond, so you add about R${-split.left} for every R100 the property earns.`;
    S.cashFlow = {lead, text};
  }

  // ---- cash needed
  if (r.cashIn <= 0) S.cash = {lead: "No cash goes in upfront.", text: "On these inputs the deal needs no money from you at the start, so cash-on-cash can't be measured."};
  else {
    const parts = [[r.deposit, "the deposit"], [r.duty, "transfer duty"], [r.legal, r.legalBlank ? "estimated attorney and bond fees" : "attorney and bond fees"], [r.reno, "repairs"]]
      .filter(([a]) => a > 0).map(([a, l]) => `${l} (${nRa(a)})`);
    const list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    let text = `That covers ${list}.`;
    if (r.cfA > 0) text += ` At year-1 cash flow it comes back in about ${(r.cashIn / r.cfA).toFixed(1)} years: a ${nP(r.m.coc)} cash-on-cash return, ${r.m.coc >= T.coc ? "above" : "below"} your ${T.coc}% target.`;
    else text += ` Because the deal costs money each month in year 1, that cash earns no cash return yet (cash-on-cash ${nP(r.m.coc)}).`;
    S.cash = {lead: `You need ${nRa(r.cashIn)} upfront.`, text};
  }

  // ---- returns: yields, IRR, and how much rests on the sale
  if (!(r.price > 0)) S.returns = {lead: "No price entered.", text: "Yields and returns need a purchase price."};
  else {
    const irr = r.m.irr, rentTotal = tlH.net, last = tlH.rows[H - 1].net, sale = r.flows[H] - last;
    let lead;
    if (!isFinite(irr) || irr <= -99.9) lead = "The money doesn't come back.";
    else lead = `${nP(irr)} a year over ${plural(H, "year")}.`;
    let text = `Gross yield is ${nP(r.m.grossYield)}; after running costs, duty and fees the effective yield is ${nP(r.m.effYield)}.`;
    const cg = num(d.capGrowth);
    if (sale > 0 && rentTotal <= 0) text += ` All of the return depends on selling: over ${plural(H, "year")} the rent falls ${nRa(-rentTotal)} short in total, and the sale is assumed to bring in ${nRa(sale)} after the bond and selling costs, with ${cg}% a year growth.`;
    else if (sale > 0 && rentTotal > 0) {
      const share = Math.round(sale / (sale + rentTotal) * 100);
      text += share >= 60 ? ` About ${share}% of the money you get back comes from the sale, so the result leans on the ${cg}% a year growth assumption.`
        : ` Most of the money you get back comes from rent (${100 - share}%), so the result depends less on how fast the value grows.`;
    } else if (sale <= 0) text += " The sale is not assumed to return any money after the bond and selling costs.";
    if (isFinite(irr) && irr > -99.9) text += ` That is ${irr >= T.irr ? "above" : "below"} your ${T.irr}% target.`;
    S.returns = {lead, text};
  }

  // ---- the ten tests
  const scores = testScores(ctx), passed = scores.filter(s => s.st === "pass").sort((a, b) => b.score - a.score), failed = scores.filter(s => s.st === "fail").sort((a, b) => a.score - b.score);
  {
    let text = passed.length ? `Its strongest result is ${NARR_LABELS[passed[0].k]} at ${nVal(passed[0].k, passed[0].val)} against a ${nGoal(passed[0].dir)} of ${nTgt(passed[0].k, passed[0].dir, passed[0].t)}.` : "None of the tests is met outright.";
    text += failed.length ? ` The biggest gap is ${NARR_LABELS[failed[0].k]}: ${nVal(failed[0].k, failed[0].val)} against a ${nGoal(failed[0].dir)} of ${nTgt(failed[0].k, failed[0].dir, failed[0].t)}.` : " Nothing misses its target outright.";
    if (v.n < 10) text += ` ${plural(10 - v.n, "test")} couldn't be worked out${r.m.discount == null ? " (the discount needs a market value)" : ""}.`;
    S.tests = {lead: `Grade ${g}: meets ${v.pass} of ${v.n} tests${v.close ? `, ${v.close} close` : ""}.`, text};
  }

  // ---- stress
  if (noRent) S.stress = {lead: "Nothing to stress yet.", text: "Stress tests need a rent."};
  else {
    const lead = cf < 0 ? "Already short before any stress." : scen.storm >= 0 ? "Holds up in a bad year." : (!hasBond || scen.rate2 >= 0) ? "Survives a rate rise, not a perfect storm." : "Sensitive to interest rates.";
    let text = hasBond ? `If prime rises 2 percentage points, monthly cash flow goes from ${nR(cf)} to ${nR(scen.rate2)}.` : "With no bond, interest-rate rises don't affect it.";
    text += ` In a perfect storm (rates up 2 points, rent down 10%, two months empty and levies up 25%) it would be ${nR(scen.storm)} a month.`;
    if (bp.rate.kind === "ok") text += ` Cash flow turns negative if the interest rate reaches ${bp.rate.v.toFixed(2)}%.`;
    else if (bp.rate.kind === "never") text += " Even at very high interest rates the rent still covers the costs.";
    if (isFinite(bp.rentDrop) && bp.rentDrop >= 0 && cf >= 0) text += ` The rent could fall ${bp.rentDrop.toFixed(0)}% before the deal stops paying for itself.`;
    S.stress = {lead, text};
  }

  // ---- price
  {
    const price = r.price, oc = bp.offerCf, oq = bp.offerCoc, cfName = T.cfMonth === 0 ? "break even" : `make ${nR(T.cfMonth)} a month`;
    const say = (o, goal) => o.kind === "never" ? `No price lets it ${goal}, because the rent can't cover the running costs.`
      : (o.kind === "above" || o.v >= price) ? `At this price it already manages to ${goal}.`
      : `To ${goal} the price would need to be about ${nRa(o.v)}, ${Math.round((1 - o.v / price) * 100)}% below ${nRa(price)}.`;
    const lead = oc.kind === "never" ? "Price alone can't fix it." : (oc.kind === "above" || oc.v >= price) ? "The price already works for cash flow." : `Breaks even at about ${nRa(oc.v)}.`;
    let text = say(oc, cfName);
    if (r.cashIn > 0) text += " " + say(oq, `reach your ${T.coc}% cash-on-cash target`);
    S.offer = {lead, text};
  }

  // ---- the long view
  {
    const lead = tl.crossover === 1 ? "Positive from year one." : tl.crossover ? `Rent catches up in year ${tl.crossover}.` : "Rent doesn't catch up in 20 years.";
    let text = tl.topUp > 0 ? `Until then you would top up about ${nRa(tl.topUp)} in total. ` : "";
    text += `Over 20 years the rent brings in ${nRa(tl.income)} against ${nRa(tl.expenses)} of costs and bond: a net ${tl.net >= 0 ? "surplus" : "shortfall"} of ${nRa(Math.abs(tl.net))}, not counting the sale.`;
    if (tl.bondFreeYear && tl.bondFreeYear > 1 && tl.bondFreeYear <= 20) text += ` The bond is paid off in year ${tl.bondFreeYear - 1}.`;
    text += tl.pv >= 0 ? ` In today's money, at ${tl.discRate.toFixed(2)}% a year, those 20 years of cash are worth ${nR(tl.pv)}.` : ` In today's money, at ${tl.discRate.toFixed(2)}% a year, those 20 years of cash come to a net cost of ${nRa(-tl.pv)}.`;
    S.longTerm = {lead, text};
  }

  // ---- headline and summary
  const headline = noRent ? "No rent entered yet."
    : cf >= 50 ? `Pays for itself from day one, with ${nRa(cf)} a month to spare.`
    : cf > -50 ? "Roughly breaks even from day one."
    : tl.crossover ? `Needs ${nRa(-cf)} a month from your pocket until the rent catches up in year ${tl.crossover}.`
    : `Needs ${nRa(-cf)} a month from your pocket, and the rent doesn't catch up within 20 years.`;
  let summary = `Grade ${g}: it meets ${v.pass} of ${v.n} tests${v.close ? ` and is close on ${v.close}` : ""}.`;
  summary += r.cashIn > 0 ? ` It needs ${nRa(r.cashIn)} upfront` : " It needs no cash upfront";
  summary += isFinite(r.m.irr) && r.m.irr > -99.9 ? ` and returns ${nP(r.m.irr)} a year over ${plural(H, "year")} on these assumptions.` : ", and on these assumptions the money doesn't come back.";
  if (!noRent) summary += ` In a perfect storm it would ${scen.storm >= 0 ? `still leave ${nRa(scen.storm)} a month` : `cost ${nRa(-scen.storm)} a month`}.`;

  // ---- strengths and watch-outs (watch-outs only from missed tests and real risks; strengths only from met tests and real buffers)
  const strengths = [], watch = [];
  if (!noRent && cf >= 50) strengths.push(`Leaves ${nRa(cf)} a month after every cost.`);
  if (!noRent && scen.storm >= 0) strengths.push("Still cash-positive in a perfect storm.");
  if (!noRent && cf <= -50) watch.push(`Costs you ${nRa(-cf)} a month in year 1.`);
  if (!noRent && tl.crossover === null) watch.push("The rent doesn't catch up with the costs within 20 years.");
  if (!noRent && cf >= 0 && scen.storm < 0) watch.push(`Turns negative in a perfect storm (${nR(scen.storm)} a month).`);
  // Monthly cash flow is already covered by the cash-flow lines above, so it isn't repeated as a test.
  passed.filter(s => s.k !== "cfMonth").forEach(s => strengths.push(s.dir === "lo" ? `${cap(NARR_LABELS[s.k])} of ${nVal(s.k, s.val)} is inside your ${nTgt(s.k, s.dir, s.t)} limit.` : `${cap(NARR_LABELS[s.k])} of ${nVal(s.k, s.val)} beats your ${nTgt(s.k, s.dir, s.t)} target.`));
  failed.filter(s => s.k !== "cfMonth").forEach(s => watch.push(`${cap(NARR_LABELS[s.k])} is ${nVal(s.k, s.val)} against your ${nTgt(s.k, s.dir, s.t)} ${nGoal(s.dir)}.`));
  if (r.legalBlank && r.legal > 0 && watch.length < 3) watch.push("Attorney and bond fees are an estimate; a quote may differ.");

  return {headline, summary, sections: S, strengths: strengths.slice(0, 3), watch: watch.slice(0, 3), split};
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// The executive summary for two or more deals.
function narratePortfolio(ctxs) {
  const n = ctxs.length, fit = ctxs.filter(c => c.v.cls === "pass").length;
  const sumCash = ctxs.reduce((a, c) => a + c.r.cashIn, 0), sumCf = ctxs.reduce((a, c) => a + c.r.m.cfMonth, 0);
  const pos = ctxs.filter(c => c.r.m.cfMonth >= 0).length;
  const best = (f) => ctxs.reduce((b, c) => (b === null || f(c) > f(b)) ? c : b, null);
  const lead = {
    grade: best(c => c.v.ratio * 1000 + (isFinite(c.r.m.coc) ? c.r.m.coc : 0) / 1000),
    cash: best(c => c.r.m.cfMonth),
    coc: best(c => isFinite(c.r.m.coc) ? c.r.m.coc : (c.r.m.coc > 0 ? 1e9 : -1e9)),
    storm: best(c => c.scen.storm),
    least: best(c => -c.r.cashIn)
  };
  const headline = fit === n ? `All ${n} deals fit your buy box.` : fit === 0 ? `None of the ${n} deals fits your buy box yet.` : `${fit} of ${n} deals ${fit === 1 ? "fits" : "fit"} your buy box.`;
  let summary = `Together they need ${nRa(sumCash)} upfront and, in year 1, ${sumCf >= 0 ? `leave ${nRa(sumCf)} a month after all costs` : `cost ${nRa(-sumCf)} a month more than the rent brings in`}. ${pos === n ? "Every deal pays for itself" : pos === 0 ? "None pays for itself" : pos === 1 ? `1 of ${n} pays for itself` : `${pos} of ${n} pay for themselves`} from day one.`;
  const leaders = [
    {label: "Highest grade", name: lead.grade.name, value: `Grade ${lead.grade.g}`},
    {label: "Most cash flow", name: lead.cash.name, value: nR(lead.cash.r.m.cfMonth) + " /m"},
    {label: "Best cash-on-cash", name: lead.coc.name, value: isFinite(lead.coc.r.m.coc) ? nP(lead.coc.r.m.coc) : "No cash in"},
    {label: "Most resilient", name: lead.storm.name, value: nR(lead.storm.scen.storm) + " /m in a storm"},
    {label: "Least cash needed", name: lead.least.name, value: nRa(lead.least.r.cashIn)}
  ];
  const trade = lead.least !== lead.cash
    ? `The trade-off: ${lead.least.name} asks for the least money upfront (${nRa(lead.least.r.cashIn)}), while ${lead.cash.name} does best month to month (${nR(lead.cash.r.m.cfMonth)}).`
    : `${lead.cash.name} needs the least cash upfront and also does best month to month.`;
  return {headline, summary, leaders, trade, fit, pos, sumCash, sumCf};
}
/*NARRATIVE-END*/
