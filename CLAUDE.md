# Buy Box

A property deal-analysis dashboard for South African rental property. It grades each deal from A to E against ten common investor rules of thumb (quick screens, and yield & return). Don't name real investors, developers or developments anywhere on the site. It also stress tests each deal, keeps a portfolio of deals and compares up to 8 side by side. It started as a claude.ai artifact and is being turned into a public website (see ROADMAP.md).

## Layout

```
src/engine.js      All the maths. Pure functions, no DOM. Lives between /*ENGINE-START*/ and /*ENGINE-END*/.
src/narrative.js   Plain-language commentary for the investor pack. Pure functions over engine results, between
                   /*NARRATIVE-START*/ and /*NARRATIVE-END*/.
src/shell.html     Page markup, CSS and UI code. Contains %%ENGINE%%, %%NARRATIVE%% and %%SEED%% placeholders.
build.js           Injects engine.js, narrative.js and the example deals from data/deals.json into shell.html.
dist/buy-box.html  The built page as one self-contained fragment (claude.ai artifact; what the tests open).
dist/index.html    The public website: the same page as a full HTML document with meta tags, self-hosted fonts and a
                   Content Security Policy.
src/fonts/         Geist and Geist Mono (the app), Fraunces and Inter (the investor pack), all SIL Open Font License, copied to
                   dist/fonts for the website.
tests/engine.test.js  ~50,000 checks on the engine (bond maths vs month-by-month simulation, SARS transfer duty,
                      IRR/NPV, break-even, breaking points, offer prices, 20-year timeline, present value, fuzzing, monotonicity).
tests/narrative.test.js  ~320,000 checks on the commentary: readable, never advice, figures match the engine, sign-correct
                      wording, the R100 split adds up, strengths/watch-outs agree with the tests, portfolio leaders.
tests/dom.test.js     Serves dist/ over HTTP, opens dist/index.html in Playwright, types random deals into the form and
                      checks every number on screen against the engine run separately (summary, KPIs, screening, stress,
                      20-year panel, portfolio, compare), plus saving, export/import, the prime rate, the guide, fonts and
                      security (hostile import, CSP). Any console error or CSP violation fails the run.
data/deals.json    Made-up example deals (none is a real listing) that seed a first visit, plus the default targets
                   (not seeded; visitors start from DEFAULT_TARGETS).
.github/workflows/site.yml  Runs both suites on every push and PR; the default branch also deploys dist/ to GitHub Pages.
.github/dependabot.yml      Weekly update PRs for GitHub Actions and npm.
SECURITY.md        How to report a problem and how the site protects visitors.
```

## Commands

- `npm run build` rebuilds dist/buy-box.html and dist/index.html. Always edit src/, never dist/.
- `npm test` runs the build plus the engine and commentary suites. It must end with 0 failed (both suites exit non-zero on a failure).
- `npm run test:ui` runs the build plus the on-screen reconciliation (needs `npm i` and `npx playwright install chromium`).

Run both test suites after any change to the maths or to how numbers are displayed. When you add a metric, add engine checks for it and a matching on-screen check in dom.test.js.

## Engine (src/engine.js)

- `analyse(deal, lite)` returns every figure for one deal: cash flow, NOI, the bond, cash in, yields, DSCR, IRR, net gain series, break-even rent and after-tax cash flow, plus `costs` (annual line items behind income collected and running costs) and `deposit`, `reno`, `ratePct`, `termM`, `debtA`. `lite` skips IRR for speed inside solvers.
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

The unsaved draft is kept separately in localStorage (`buybox-draft`). The Assumptions panel has two forms, **Quick** (the default) and **All inputs**; the choice is remembered in `buybox-form`. Quick shows only the `GROUPS` fields marked `quick:1` (name, price, rent, levy, rates, deposit, new development), and `renderAssumed()` lists every other value the deal is using in plain words. Hidden fields keep the deal's own values, so switching forms never changes a result. **Your data** in the settings view exports every deal and the targets as JSON, and imports the same format (or the data/deals.json format): deals are added, a deal with the same id is replaced, unknown fields and targets are dropped, and Compare is kept to 8 deals with unique colours.

The prime rate lives in the targets object as `prime` (a setting, not a graded test). New deals start at it (`blankDeal()`), and `discountRate` follows it while the two are equal. It is edited under **Market** in the settings view and shown in the sidebar.

Deals use the same field names as `DEFAULTS` in engine.js, plus `id`, `created`, `updated`, `inCompare` and `slot` (colour slot 0–7). Targets live in one object, whose keys match `DEFAULT_TARGETS`.

## Views

Analyse, Portfolio, Compare, Buy box & method (`settings`), How grades work (`guide`), Terms & privacy (`terms`, static text with a "last updated" date; update the date whenever the wording changes) and Investor report (`report`, not in the nav). Each is a `<section class="view" id="v-…">`, listed in `VIEWS`, rendered from `renderView()` and titled in `renderTop()`. The guide's test table is built from `TESTS` and the live targets. A first-visit "not financial advice" notice sits above Analyse until dismissed (`buybox-notice` in localStorage).

**Investor pack.** `openReport(ids, back)` sets `S.report` and opens `#report`; `renderReport()` builds `.report-doc` as a stack of A4 `.sheet`s: a dark cover (`rptCover`, with `coverOrnament`), 01 Executive summary (`rptExec`), 02 The portfolio when there are 2+ deals (`rptSummary`), one sheet per deal (`rptDeal`: dark hero band, headline figures and summary, then sections for cash flow (waterfall and "where every R100 goes"), returns, income, costs and the bond, assumptions, the ten tests with bullet bars, stress test, where it breaks and the offer price, and the 20-year view (chart, summary and every 5th year)) and Basis of this pack (`rptMethod`). Entry points: the Analyse topbar (drafts included), the Report tick boxes on Portfolio (`S.reportSel`, with Select all) and the Compare topbar. Users save it with Print → Save as PDF. Prepared by/for live in localStorage (`buybox-report`). The cover and every page footer say "Analysed with Buy Box" and the site address.

**Share image.** "Share image" on the Analyse topbar draws a 1080×1080 PNG of the deal on a canvas (`shareCard()` gathers the figures from the engine and `narrateDeal()`, `drawShareImage()` paints it with the dark tokens and the pack fonts). On phones it opens the share sheet; elsewhere it downloads. The PNG carries a plain-text description (`shareAlt()`, an iTXt "Description" chunk), which the dom suite reads back and checks against the engine.

**Site address.** `SITE` in build.js replaces every `%%SITE%%` in shell.html (pack cover and footer, method sheet, share image). Change it there when the custom domain is live.

Commentary comes only from `src/narrative.js`: `dealContext()` gathers engine results, `narrateDeal()` returns a headline, summary, strengths, watch-outs and a note per section (cash flow, cash, returns, tests, stress, offer, long term), `narratePortfolio()` the executive summary for several deals, and `rentSplit()` the R100 split. Rules: describe what the numbers say, never advise (no "should", "recommend", "buy"); the sign decides the wording; judgements only against the user's own targets; no NaN/Infinity text. Its strings can contain deal names, so always `esc()` them. Add a rule → add checks in tests/narrative.test.js.

The pack reuses the screen builders (`breakCards()`, `scenarioRows()`, `ieSummary()`, `ieChart()`/`ieLegendHtml()`, `cmpBody()`, `sealSvg()`, `bulletHtml()`), so a figure can't differ between screen and pack. Sheets use the light tokens (`.report-doc` shares the light-theme selector); the cover and deal hero use the dark tokens (`.rpt-dark` shares the `:root` selector). Pack type and spacing live on `.report-doc`:
- fonts: `--pk-display` (Fraunces, headings and big figures), `--pk-text` and `--pk-num` (Inter, with tabular figures in tables). The Fraunces file has an empty minus sign, so build.js serves U+2212 from Inter under the Fraunces name.
- no italics anywhere in the pack.
- minimum sizes: nothing below 11px (8pt printed), body 13.5px (10pt), tables 13px.
- darker greys: `--muted` and `--text-2` at 7:1 or more.
- spacing tokens `--sp-1…--sp-8` (4–64px).
- sections: each is a `<section class="psec">` (label `.kick`, content blocks `--sp-5` apart, its commentary `.note` last), sections `--sp-7` apart, and the opening block is `.intro`.

The dom suite checks the italics, sizes, contrast and commentary placement.

Print: `@media print` is scoped to `html[data-view="report"]`, every sheet after the cover starts a page, `@page cover` is full-bleed and `@page report` adds the footer and page numbers. Breaks:
- short sections (`.psec.keep`) move to the next page whole;
- longer ones break only between blocks, never inside a table, chart or commentary box;
- a label never ends a page and commentary stays with the block before it.

After changing the pack, print a 1-deal and a 3-deal pack and look at the page breaks.

## Security

- The website has one inline script. build.js hashes it into the CSP, so adding a second `<script>` or an external script fails the build. Don't add inline event handlers (`onclick="…"`); the CSP blocks them. Attach listeners in JS.
- `connect-src 'none'`: the page can't make network requests. Phase 2 (a backend) must add its origin to the CSP in build.js on purpose.
- Escape all user text with `esc()` before it goes into `innerHTML`. Imported files are untrusted: `cleanDeal()` keeps known fields only, each with the type it has in `DEFAULTS`.
- Keep the site free of third-party requests (fonts are self-hosted). The dom suite fails if the page loads anything from Google.

## Design

Ledger-green surfaces with a brass accent (`--brass #C9A45C`). Dark is the default; a light theme (warm paper, darker brass) is set with `data-theme="light"` on `<html>` by the switch in the sidebar and mobile top bar, and remembered in localStorage (`buybox-theme`). Every colour is a token on `:root`, redefined under `:root[data-theme="light"]`: never hard-code a colour, add a token to both blocks. The dom suite checks text (4.5:1) and series (3:1) contrast in both themes. Fonts are Geist and Geist Mono (the investor pack uses Fraunces and Inter). Series colours `--s1…--s8` are a colour-blind-checked categorical palette, assigned per deal and kept with that deal. Status colours (good, warn, bad) are separate from the series colours and never reused as them. Keep new UI in the same token system.

## Known simplifications

- No capital gains tax on the sale. Tax only feeds the optional after-tax cash flow line.
- Attorney and bond fees are a rough estimate when left blank.
- Municipal rates and levies stay fixed when solving for offer prices.
- The default prime rate (10.75%, correct at September 2026) is in `DEFAULT_TARGETS` in engine.js. When you re-check it or the SARS duty table, update `MARKET_CHECKED` in src/shell.html; the date shows in the sidebar, Market panel and Method notes. Users can change their own under Market; saved deals keep their own rate.
