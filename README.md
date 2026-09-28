# Buy Box

A free property deal analyser for South African rental property. It grades each deal from A to E against Brandon Turner's quick screens and Laurens Boel's yield and return targets, stress tests the bond, finds your maximum offer price and compares up to 8 deals side by side.

Deals are saved in your own browser and never leave your device. Use **Buy box & method → Your data** to export a backup or move your deals to another device.

## Develop

```
npm install
npx playwright install chromium   # once, for the on-screen tests
npm run build                     # builds dist/index.html (website) and dist/buy-box.html (single page)
npm test                          # engine checks
npm run test:ui                   # on-screen checks in a real browser
```

Edit `src/`, never `dist/`. See `CLAUDE.md` for how the code is laid out and `ROADMAP.md` for what's next.

## Publish with GitHub Pages

The workflow in `.github/workflows/site.yml` runs both test suites on every push. On the default branch it then publishes `dist/` to GitHub Pages. To switch it on once:

1. GitHub Pages needs a **public** repository on a free GitHub plan. A private repository needs GitHub Pro or higher. The site itself is public either way.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Re-run the latest "Test and publish" workflow, or push a commit. The site appears at `https://<username>.github.io/<repository>/`.

A calculator, not financial advice.
