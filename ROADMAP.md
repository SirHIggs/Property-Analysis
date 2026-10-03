# Roadmap

Buy Box is moving from a personal claude.ai artifact to a public website that anyone can use to analyse South African rental property deals.

## Phase 1: standalone public site, no accounts (live)

- [x] Save deals and targets in each visitor's own browser (localStorage). Nothing is sent to a server.
- [x] Start new visitors with made-up example deals (`data/deals.json`).
- [x] Export all deals and targets to a JSON file, and import them again, for backups and for moving between devices.
- [x] Build a full web page (`dist/index.html`) with a description, link preview tags and an icon.
- [x] Run both test suites on every push and pull request (GitHub Actions). The suites now fail the build on any failed check.
- [x] Publish `dist/` to GitHub Pages on every push to the default branch.
- [x] Turn on GitHub Pages. Live at https://sirhiggs.github.io/Property-Analysis/
- [x] Security: Content Security Policy, self-hosted fonts, hardened import, Dependabot, SECURITY.md.
- [x] Name: keep **Buy Box**.
- [ ] Custom domain. buybox.co.za is listed for sale on Dan.com (checked 2026-09-28); otherwise a variant such as buyboxsa.co.za.

## Growth plan (agreed October 2026)

Based on a business-scaling playbook (offers, leads, money models, one constraint at a time). The tool works; the constraint now is that too few people use it. So build less and get it in front of people first. One rule throughout: work on one constraint at a time, and don't build what users haven't asked for.

**Decisions.**
- Beginners use Buy Box free.
- Professionals (agents, bond originators, advisers) are the first to pay.
- One channel: short videos.
- Privacy-friendly visit counts.
- Under an hour a day, so every step below is sized for that.

### Stage A: Improvise (now, about 6 weeks). Ten real users and proof
- [ ] Watch 10 beginner investors analyse a real listing with Buy Box. Fix only their number 1 complaint, and collect quotes (with permission) for testimonials.
- [x] **Quick mode.** Price, rent, levy, rates and deposit give a grade in about 30 seconds, with the full form optional. Faster and easier is where most of the value lies.
- [x] **Every pack is an ad.** A shareable square image (grade and monthly cash flow) for WhatsApp and Instagram, and "Analysed with Buy Box · domain" on the pack cover and footer.
- [ ] **Custom domain** (see phase 1), so every share points somewhere we own.
- [ ] **Feedback link** in the sidebar and on the pack page (an email address or a form link; links are allowed by the CSP, form posts are not).
- [ ] **Privacy-friendly counts** with a cookie-free counter such as GoatCounter or Plausible: page views, deals analysed and packs made, never deal figures. Needs:
  - its origin added to `connect-src`/`script-src` in build.js, on purpose;
  - a line on the Terms & privacy page (update its date);
  - a dom-suite check that nothing about a deal is sent.

**Done when:** 10 people have used it on a real deal and at least 5 testimonials are collected.

### Stage B: Advertise. One short video a day for 100 days
- [ ] **Format:** "I ran this R950k 1-bed through Buy Box: it costs R3 534 a month." Show the grade, the stress test and the offer price. Keep listings generic: no real developments, developers or addresses, and say "a calculator, not advice" in every video.
- [ ] **Within the hour a day:** about 30 minutes for one video (screen recording plus voice-over), and 15 minutes replying to comments and messages.
- [ ] **Log daily:** videos posted, views, site visits and packs made. More → Better → New: post more first, then improve the hook where people drop off, and only add a second channel once views flatten.
- [ ] **Lead magnet:** a free one-page "10 checks before you sign an offer to purchase" PDF, linking back to the tool.

**Done when:** 100 videos are posted and visits per week are known and growing.

### Stage C: Monetize. Buy Box Pro for professionals
- [ ] **Sell by hand before building.** Offer 3 to 5 bond originators or agents a branded investor pack, made by hand from their client's deal. Ask what they would pay monthly.
- [ ] **The offer, premium first:**
  - packs with their own logo, name and contact details;
  - client portfolios;
  - a lender-style appendix;
  - unlimited packs.

  Downsell by removing features (for example one template, fewer portfolios), never by cutting the price of the same thing.
- [ ] **Prove the pay-back.** A customer's first-month profit should cover what it cost to win them. Track CAC, first-month gross profit, churn and lifetime gross profit from the first sale.
- [ ] **Partners as lead getters:** become the tool inside an originator's or agency's client pack.
- [ ] **Before charging:**
  - legal advice on the FAIS Act (Pro must stay a calculator and presentation tool, not advice), the Consumer Protection Act and the ECT Act (business details, cancellation terms);
  - VAT registration if turnover passes the threshold.

**Done when:** the first 3 professionals are paying.

### Later, only when it becomes the constraint
- Accounts and syncing (phase 2 below); Pro will need them.
- The annual data pack (see Future offers).
- More metrics and features.

## Phase 2: accounts and syncing

Needed for Buy Box Pro (stage C of the growth plan). Build it only then, because it brings a backend, privacy obligations and possibly running costs.

- Sign-in and cloud storage through a hosted backend such as Supabase (or Firebase), so deals follow people across devices.
- Share a deal, or a comparison, with someone else by link.
- The page already talks to storage through one small interface (`browserDb()` in `src/shell.html`, the same shape as the claude.ai `db`). A Supabase version of that interface can be swapped in without touching the rest of the UI.
- Import existing browser deals into a new account on first sign-in.
- Comply with POPIA (South Africa's data-protection law): privacy policy, consent, data export and deletion on request.
- Plan for hosting costs and abuse protection (rate limits, sign-up checks).

## Done after phase 1

1. **Editable prime rate.** Set under **Buy box & method → Market** and shown in the sidebar. New deals start at it, and the present-value discount rate follows it until you set your own. Saved deals keep their own rate. The default (10.75%, September 2026) is in `DEFAULT_TARGETS` in engine.js.
2. **"How grades work" guide and disclaimer.** A Guide view explains the A to E grade, how tests score, the ten tests with your own targets, what the grade leaves out, and a "not financial advice" section. A first-visit notice and a line in the sidebar link to it.
3. **Light and dark themes.** Dark stays the default; a switch in the sidebar and the mobile top bar changes to a light theme and remembers the choice. Both themes are contrast-checked in the tests.
4. **Legal clean-up.** Made-up example deals instead of real developments, no real investors named, a Terms & privacy page, an accurate note on what GitHub Pages logs, and "last checked" dates on the prime rate and duty table.

5. **Investor pack.** A designed, printable pack for one deal (from Analyse) or any number of deals (Portfolio tick boxes or the Compare set), saved as PDF from the browser: a dark brass cover, an executive summary, a portfolio sheet, one sheet per deal with a cash-flow waterfall, "where every R100 goes", the ten tests, stress test and 20-year view, and plain-language commentary on every section (never advice), then the basis and disclaimer.
6. **Pack readability.** Fraunces and Inter instead of a thin display serif, no italics, a minimum printed text size of 8pt (body 10pt), darker greys, one spacing scale, and page breaks that keep each section and its commentary together.

## Future offers (not a priority now)

- **Annual pack with trusted data.** A paid yearly plan that adds data from reputable sources as inputs, for example TPN reports on tenant payment behaviour by area. Before building it: TPN is a registered credit bureau, so reselling or showing its data needs a licensing agreement and must follow the National Credit Act and POPIA. Charging money also brings in the Consumer Protection Act and the Electronic Communications and Transactions Act (business details, cancellation terms). Get legal advice first.
