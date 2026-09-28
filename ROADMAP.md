# Roadmap

Buy Box is moving from a personal claude.ai artifact to a public website that anyone can use to analyse South African rental property deals.

## Phase 1: standalone public site, no accounts (in progress)

- [x] Save deals and targets in each visitor's own browser (localStorage). Nothing is sent to a server.
- [x] Start new visitors with the example deals in `data/deals.json`.
- [x] Export all deals and targets to a JSON file, and import them again, for backups and for moving between devices.
- [x] Build a full web page (`dist/index.html`) with a description, link preview tags and an icon.
- [x] Run both test suites on every push and pull request (GitHub Actions). The suites now fail the build on any failed check.
- [x] Publish `dist/` to GitHub Pages on every push to the default branch.
- [ ] Turn on GitHub Pages in the repository settings (see README). Needs a public repository, or a paid GitHub plan for a private one.
- [ ] Optional: a custom domain.

## Phase 2: accounts and syncing (next step)

Only once people ask for it, because it brings a backend, privacy obligations and possibly running costs.

- Sign-in and cloud storage through a hosted backend such as Supabase (or Firebase), so deals follow people across devices.
- Share a deal, or a comparison, with someone else by link.
- The page already talks to storage through one small interface (`browserDb()` in `src/shell.html`, the same shape as the claude.ai `db`). A Supabase version of that interface can be swapped in without touching the rest of the UI.
- Import existing browser deals into a new account on first sign-in.
- Comply with POPIA (South Africa's data-protection law): privacy policy, consent, data export and deletion on request.
- Plan for hosting costs and abuse protection (rate limits, sign-up checks).

## Later improvements

1. **Editable prime rate.** The prime rate (10.75%) is hard-coded and was correct at September 2026. Make it a setting that visitors can change, or keep it in one clearly marked place that is easy to update when the Reserve Bank moves rates. It also sets the default discount rate for present value.
2. **"How the grades work" page and a disclaimer.** A short, plain page explaining the A to E grade, the ten tests and where the targets come from (Brandon Turner and Laurens Boel), plus a clear notice that Buy Box is a calculator and not financial advice. The Method section in the app is the starting point.
