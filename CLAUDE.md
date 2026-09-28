# Buy Box

A property deal-analysis dashboard for South African rental property. It grades each deal from A to E against Brandon Turner's quick screens and Laurens Boel's yield and return targets. It also stress tests each deal, keeps a portfolio of deals and compares up to 8 side by side. It started as a claude.ai artifact and is being turned into a public website (see ROADMAP.md).

## Layout

```
src/engine.js      All the maths. Pure functions, no DOM. Lives between /*ENGINE-START*/ and /*ENGINE-END*/.
src/shell.html     Page markup, CSS and UI code. Contains %%ENGINE%% and %%SEED%% placeholders.
build.js           Injects engine.js and the example deals from data/deals.json into shell.html.
dist/buy-box.html  The built page as one self-contained fragment (claude.ai artifact; what the tests open).
dist/index.html    The same page as a full HTML document with meta tags: the public website.
tests/engine.test.js  ~50,000 checks on the engine (bond maths vs month-by-month simulation, SARS transfer duty,
                      IRR/NPV, break-even, breaking points, offer prices, 20-year timeline, present value, fuzzing, monotonicity).
tests/dom.test.js     Opens the built page in Playwright, types random deals into the form and checks every number on
                      screen against the engine run separately (summary, KPIs, screening, stress, 20-year panel, portfolio, compare).
data/deals.json    Deals and buy-box targets exported from the claude.ai version on 2026-09-28. The deals seed
                   a first visit; the targets are not seeded (visitors start from DEFAULT_TARGETS).
.github/workflows/site.yml  Runs both suites on every push and PR; the default branch also deploys dist/ to GitHub Pages.
```

## Commands

- `npm run build` rebuilds dist/buy-box.html and dist/index.html. Always edit src/, never dist/.
- `npm test` runs the build plus the engine suite. It must end with 0 failed (both suites exit non-zero on a failure).
- `npm run test:ui` runs the build plus the on-screen reconciliation (needs `npm i` and `npx playwright install chromium`).

Run both test suites after any change to the maths or to how numbers are displayed. When you add a metric, add engine checks for it and a matching on-screen check in dom.test.js.

## Engine (src/engine.js)

- `analyse(deal, lite)` returns every figure for one deal: cash flow, NOI, the bond, cash in, yields, DSCR, IRR, net gain series, break-even rent and after-tax cash flow. `lite` skips IRR for speed inside solvers.
- `SCENARIOS` / `scenario(deal, key)` hold the stress scenarios (prime +1/+2, rent −10%, 2 months empty, levy +25%, no growth, perfect storm).
- `breakPoints(deal, targets)` solves for the interest rate, vacancy and rent drop that take cash flow to zero, plus the maximum offer prices.
- `timeline(deal, years, discountRatePct)` gives year-by-year income vs running costs vs bond, crossover year, top-up, net and present value.
- `verdict(result, targets)` scores 10 tests (met = 1, close = ½). The UI maps the score to a grade: A ≥ 90%, B ≥ 75%, C ≥ 55%, D ≥ 35%, E below that.
- Conventions: amounts in rand. Percentages are stored as numbers (10.75 means 10.75%). Annual figures, with IRR and present value cash arriving at year end. Inputs are clamped to sensible ranges.

## Storage

`start()` in src/shell.html picks a store with one interface (`collection(name).onSnapshot`, `doc(path).set / delete / onSnapshot`):

1. `window.claude.use("db")` inside a claude.ai artifact.
2. Otherwise `browserDb()`: localStorage under the key `buybox-data`, shaped `{properties:{id:deal}, settings:{targets}}`. A first visit is seeded with the deals from data/deals.json (`SEED_DEALS`). Other tabs pick up changes through the `storage` event.
3. If localStorage is blocked, `startLocal()` shows the example deals and saves nothing.

For accounts and syncing (phase 2 in ROADMAP.md), write another store with the same interface (for example on Supabase) and pick it in `start()`. The rest of the UI doesn't need to change.

The unsaved draft is kept separately in localStorage (`buybox-draft`). **Your data** in the settings view exports every deal and the targets as JSON, and imports the same format (or the data/deals.json format): deals are added, a deal with the same id is replaced, unknown fields and targets are dropped, and Compare is kept to 8 deals with unique colours.

Deals use the same field names as `DEFAULTS` in engine.js, plus `id`, `created`, `updated`, `inCompare` and `slot` (colour slot 0–7). Targets live in one object, whose keys match `DEFAULT_TARGETS`.

## Design

A single dark look, painted explicitly for every host theme: ledger-green surfaces with a brass accent (`--brass #C9A45C`). Fonts are Geist and Geist Mono. Series colours `--s1…--s8` are a colour-blind-checked categorical palette, assigned per deal and kept with that deal. Status colours (good, warn, bad) are separate from the series colours and never reused as them. Keep new UI in the same token system.

## Known simplifications

- No capital gains tax on the sale. Tax only feeds the optional after-tax cash flow line.
- Attorney and bond fees are a rough estimate when left blank.
- Municipal rates and levies stay fixed when solving for offer prices.
- The prime rate (10.75%) shown in the sidebar is hard-coded. It was correct at September 2026. Making it editable is on the roadmap.
