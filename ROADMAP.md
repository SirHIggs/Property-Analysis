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

Based on a business-scaling playbook (offers, leads, money models, one constraint at a time) and a content playbook (give away the know-how, hook → retain → reward, volume, ask rarely). The tool works; the constraint now is that too few people use it. So build less and get it in front of people first. One rule throughout: work on one constraint at a time, and don't build what users haven't asked for.

**Decisions.**
- Beginners use Buy Box free.
- Professionals (agents, bond originators, advisers) are the first to pay.
- Short videos, faceless (screen recordings with a voice-over): the same video on TikTok, YouTube Shorts and Instagram Reels, with one home platform for replies and judging hooks.
- Three content series (see stage B), so ideas never run out.
- Privacy-friendly visit counts.
- Under an hour a day, so every step below is sized for that.

### Stage A: Improvise (now, about 6 weeks). Ten real users and proof
- [ ] Watch 10 beginner investors analyse a real listing with Buy Box. Fix only their number 1 complaint, and collect quotes (with permission) for testimonials.
- [x] **Quick mode.** Price, rent, levy, rates and deposit give a grade in about 30 seconds, with the full form optional. Faster and easier is where most of the value lies.
- [x] **Every pack is an ad.** A shareable square image (grade and monthly cash flow) for WhatsApp and Instagram, and "Analysed with Buy Box · domain" on the pack cover and footer.
- [ ] **Custom domain** (see phase 1), so every share points somewhere we own.
- [x] **Feedback link** in the sidebar and on the pack page (an email address or a form link; links are allowed by the CSP, form posts are not).
- [x] **Privacy-friendly counts** (on: stats at buybox.goatcounter.com). GoatCounter's image pixel, allowed by one `img-src` address in the CSP: screens viewed, deals saved, packs and share images made, never deal figures. Explained on the Terms & privacy page, with an opt-out, and checked by the dom suite.

**Done when:** 10 people have used it on a real deal and at least 5 testimonials are collected.

### Stage B: Advertise. Short videos for 100 days, running alongside stage A
Start now rather than after stage A: the 10 test users are the warm outreach, and their deals and quotes (with permission) become the first content.

**Who it's for (the puddle):** a first-time buy-to-let buyer in South Africa looking at a sectional-title flat or a new-build. One problem: "Will this flat pay for itself, or cost me every month?"

**One video, three platforms.** Record once and post natively to TikTok, YouTube Shorts and Instagram Reels, each with its own caption, cover text and hashtags. Never paste identical text everywhere. Pick a **home platform** (whichever works best in the first weeks) for replying to comments and judging hooks; the other two are distribution only.

**Three series.** Each video is one unit: a hook, something that keeps people watching, and a payoff.

| Series | What it is | Hook | Keeps them watching | Payoff |
|---|---|---|---|---|
| **1. Will it pay for itself?** (about 4 a week) | One generic listing run through Buy Box | "This R950k Gauteng 1-bed costs its owner R3 534 a month" | Rent → costs → bond, step by step | The grade, the stress test, the price that works |
| **2. What if…** (about 2 a week) | One change on one deal: prime up or down, rent drop, special levy, two months empty | "Prime just moved. Here's what it does to a R1m flat" | Before and after | The new cash flow, and where it breaks |
| **3. Myths and questions** (about 1 a week) | FAQs and objections answered with numbers: "rent covers the bond", "property always goes up", "isn't a bigger deposit a waste?" | "An agent said the rent covers the bond. It doesn't." | A list or steps | The real number, and the one thing to check |

Ideas come from comments and questions (series 3 is where FAQs and objections go) and from stage A users' deals, anonymised.

**Every video:**
- Opens with proof, promise and plan: "I built a free calculator for SA rental deals. This one costs R3 534 a month. Here are the 3 numbers that show why."
- Speaks from experience ("how I check it"), never "you should".
- Keeps listings generic: no developments, developers or addresses.
- Ends with "a calculator, not advice".

**Cadence, within under an hour a day.**
- One batch session a week, about 90 minutes: record about 7 screen recordings of the site (quick mode, the summary, the stress test, the share image) with a voice-over.
- About 15 minutes a day to post on the three platforms and reply on the home platform.

**Calls to action.** Give 10, ask 1, and ask for one thing at a time. The first ask is the free tool ("run your own deal, link in bio"); later, the lead magnet below.

**Checklist:**
- [ ] Set up the three accounts, with a bio link carrying a campaign tag per platform (`…/Property-Analysis/?utm_source=tiktok`, `youtube`, `instagram`). GoatCounter records these, so visits, deals saved and packs show per platform.
- [ ] Post for 100 days. Judge results by visits, deals saved and packs per platform, not views.
- [ ] Monthly self-check:
  - one person, one problem;
  - a hook, something that keeps people watching, a payoff;
  - talking from what I've done;
  - posting minimum hit;
  - the right people getting in touch;
  - giving far more than asking.
- [x] **Lead magnet:** a free one-page "10 checks before you sign an offer to purchase", at `…/Property-Analysis/#checklist` (print or save as PDF), each check linking back to the tool.

**Done when:** 100 days of posting, with visits per platform known and growing.

### Content, later (after about 100 days, or once there's budget)
- Run the best-performing organic videos as paid ads: they're the cheapest ad test.
- Repost winners every few months; most of the audience never saw them.
- A long-form YouTube teardown as a pillar, cut into shorts.
- Carousel export (one deal as 5 swipeable slides) and a 9:16 story image, if the share image and screen recordings aren't enough.
- A professional series on LinkedIn for stage C.

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
- **Owner-only Video mode** for making content: a phone-shaped screen of one deal that reveals the numbers a tap at a time (title → rent → costs → bond → cash flow → stress test → grade → the price that works → end card), for screen recording. Only the owner's account gets it, which is why it waits for accounts.
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
