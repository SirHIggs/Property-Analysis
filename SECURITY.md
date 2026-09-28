# Security

## Reporting a problem

Please report security problems privately through **Security → Report a vulnerability** on this repository, not in a public issue. You'll get a reply within a week.

## How Buy Box protects visitors

- **No server, no accounts.** The site is static files on GitHub Pages. Deals are saved only in the visitor's own browser (localStorage) and never leave the device.
- **Content Security Policy.** Only the page's own script can run (pinned by its SHA-256 hash), and the page can't make network requests (`connect-src 'none'`). Even if hostile text got into the page, it couldn't send saved deals anywhere.
- **No third parties.** Fonts are served from the site itself. There are no trackers, analytics or adverts.
- **Imports are treated as untrusted.** An imported file keeps only known fields, each forced to the right type, and all text is escaped before it is shown.
- **HTTPS only**, through GitHub Pages' "Enforce HTTPS".
- **Tested on every change.** The on-screen test suite imports a hostile file, checks that no markup gets through, and checks that the policy blocks inline handlers and outbound requests.
