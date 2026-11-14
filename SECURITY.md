# Security

## Reporting a problem

Please report security problems privately through **Security → Report a vulnerability** on this repository, not in a public issue. You'll get a reply within a week.

## How Buy Box protects visitors

- **No server of our own; accounts are optional.** The site is static files on GitHub Pages. Without an account, deals are saved only in the visitor's own browser (localStorage) and never leave the device.
- **Accounts (when switched on in build.js).** Sign-in and saved deals use Supabase. The page holds only the public (publishable) key; row-level security in `supabase/schema.sql` limits every signed-in person to their own rows, and visitors who aren't signed in can't read or write anything. Nobody can change their own role (there is no update policy on `profiles`), and `delete_me()` can only delete the caller's own account. build.js refuses a secret / service_role key. Passwords are handled by Supabase Auth and never stored by Buy Box; the sign-in token is kept in the browser's localStorage and removed on sign-out. Tokens from email links are taken out of the address bar as soon as the page reads them. Each account is limited to 500 deals of 20 KB each.
- **Content Security Policy.** Only the page's own script can run (pinned by its SHA-256 hash), and the page can't make network requests (`connect-src 'none'`), except to the one Supabase address when accounts are switched on. Even if hostile text got into the page, it couldn't send saved deals anywhere else.
- **No third parties, apart from anonymous counts.** Fonts are served from the site itself. There are no trackers, cookies or adverts. When a GoatCounter site code is set in build.js, the site counts visits anonymously through GoatCounter's image pixel: the policy allows that one image address and nothing else, a count names only the screen or button (never anything typed), and counting is skipped with Do Not Track, Global Privacy Control or the opt-out on the privacy notice.
- **Imports are treated as untrusted.** An imported file keeps only known fields, each forced to the right type, and all text is escaped before it is shown.
- **HTTPS only**, through GitHub Pages' "Enforce HTTPS".
- **Tested on every change.** The on-screen test suite imports a hostile file, checks that no markup gets through, and checks that the policy blocks inline handlers and outbound requests.
