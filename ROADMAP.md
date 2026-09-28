# Roadmap

Buy Box is moving from a personal claude.ai artifact to a public website that anyone can use to analyse South African rental property deals.

## Phase 1: standalone public site, no accounts (live)

- [x] Save deals and targets in each visitor's own browser (localStorage). Nothing is sent to a server.
- [x] Start new visitors with the example deals in `data/deals.json`.
- [x] Export all deals and targets to a JSON file, and import them again, for backups and for moving between devices.
- [x] Build a full web page (`dist/index.html`) with a description, link preview tags and an icon.
- [x] Run both test suites on every push and pull request (GitHub Actions). The suites now fail the build on any failed check.
- [x] Publish `dist/` to GitHub Pages on every push to the default branch.
- [x] Turn on GitHub Pages. Live at https://sirhiggs.github.io/Property-Analysis/
- [x] Security: Content Security Policy, self-hosted fonts, hardened import, Dependabot, SECURITY.md.
- [x] Name: keep **Buy Box**.
- [ ] Custom domain (buybox.co.za is listed for sale on Dan.com; alternatives in the README).

## Phase 2: accounts and syncing (next step)

Only once people ask for it, because it brings a backend, privacy obligations and possibly running costs.

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
