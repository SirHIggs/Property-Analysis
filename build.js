// Assembles src/shell.html + src/engine.js + the example deals in data/deals.json into:
//   dist/buy-box.html  one self-contained page (a claude.ai artifact, and what the tests open)
//   dist/index.html    the same page as a full HTML document for the public website (GitHub Pages), with
//                      self-hosted fonts (dist/fonts) and a Content Security Policy
const fs = require('fs');
const crypto = require('crypto');
const shell = fs.readFileSync(__dirname + '/src/shell.html', 'utf8');
const engine = fs.readFileSync(__dirname + '/src/engine.js', 'utf8');
const narrative = fs.readFileSync(__dirname + '/src/narrative.js', 'utf8');
const seed = JSON.parse(fs.readFileSync(__dirname + '/data/deals.json', 'utf8')).deals;
// The site's address, printed on investor packs and share images. Change it here when the custom domain is live.
const SITE = 'sirhiggs.github.io/Property-Analysis';
// Visit counts: the GoatCounter site code (the "buybox" in buybox.goatcounter.com). Empty = counting off. When set, the
// website gets a <meta name="buybox-count"> tag and its Content Security Policy allows that one counting address as
// an image; nothing else changes. The page counts views and a few actions, never what people type.
const GOATCOUNTER = '';
// Where the Feedback links go: a web address (a form, or the issues page) or a mailto: link.
const FEEDBACK = 'https://github.com/SirHIggs/Property-Analysis/issues/new';
if (GOATCOUNTER && !/^[a-z0-9-]{1,40}$/.test(GOATCOUNTER)) throw new Error('GOATCOUNTER must be a GoatCounter site code');
if (!/^(https:\/\/|mailto:)[^"<>\s]+$/.test(FEEDBACK)) throw new Error('FEEDBACK must be an https:// or mailto: link');
for (const mark of ['%%ENGINE%%', '%%NARRATIVE%%', '%%SEED%%', '%%SITE%%', '%%FEEDBACK%%']) {
  if (!shell.includes(mark)) throw new Error('src/shell.html is missing the ' + mark + ' placeholder');
}
// Function replacements, so a "$" in the engine or the deals is never read as a replacement pattern.
// "<" is escaped so text in the deals can never close the script tag.
const page = shell
  .replaceAll('%%SITE%%', SITE)
  .replaceAll('%%FEEDBACK%%', FEEDBACK)
  .replace('%%ENGINE%%', () => engine)
  .replace('%%NARRATIVE%%', () => narrative)
  .replace('%%SEED%%', () => JSON.stringify(seed).replace(/</g, '\\u003c'));

const description = 'Grade South African rental property deals from A to E against proven investor targets. ' +
  'Stress test the bond, find your maximum offer price and compare up to 8 deals side by side. Free, and your deals stay in your browser.';
const icon = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#101816"/>' +
  '<path d="M7 25h18M10 21v-6M16 21V9M22 21v-9" stroke="#C9A45C" stroke-width="3" stroke-linecap="round"/></svg>');
const head = [
  '<!doctype html>',
  '<html lang="en-ZA">',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="description" content="' + description + '">',
  '<meta name="theme-color" content="#0A0F0E">',
  '<meta property="og:type" content="website">',
  '<meta property="og:title" content="Buy Box: property deal analyser">',
  '<meta property="og:description" content="' + description + '">',
  '<meta name="twitter:card" content="summary">',
  '<link rel="icon" href="' + icon + '">',
].join('\n');

// The website serves its own copy of the fonts instead of loading them from Google, so visitors' browsers
// talk to no one but this site.
const googleFonts = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">\n/;
if (!googleFonts.test(page)) throw new Error('src/shell.html font links changed; update build.js');
const fontFaces = '<style>\n' +
  '@font-face{font-family:"Geist";src:url("fonts/Geist-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap}\n' +
  '@font-face{font-family:"Geist Mono";src:url("fonts/GeistMono-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap}\n' +
  // Investor pack: Fraunces for headings and big figures, Inter for text and tables. This Fraunces file has an empty
  // minus sign (U+2212), so that one character comes from Inter.
  '@font-face{font-family:"Fraunces";src:url("fonts/Fraunces-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap;unicode-range:U+0000-2211,U+2213-FFFF}\n' +
  '@font-face{font-family:"Fraunces";src:url("fonts/Inter-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap;unicode-range:U+2212}\n' +
  '@font-face{font-family:"Inter";src:url("fonts/Inter-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap}\n' +
  '</style>\n';
const site = page.replace(googleFonts, () => fontFaces);

// Content Security Policy: only the page's own inline script (by hash) may run, and the page may not connect
// anywhere, so saved deals cannot be sent off the device even if something slipped into the page.
const scripts = [...site.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1 || /<script[^>]*\ssrc=/.test(site)) throw new Error('expected exactly one inline script');
const hash = crypto.createHash('sha256').update(scripts[0], 'utf8').digest('base64');
const csp = [
  "default-src 'none'",
  "script-src 'sha256-" + hash + "'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:" + (GOATCOUNTER ? ' https://' + GOATCOUNTER + '.goatcounter.com/count' : ''),
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

fs.mkdirSync(__dirname + '/dist/fonts', { recursive: true });
for (const f of ['Geist-Variable.woff2', 'GeistMono-Variable.woff2', 'OFL.txt', 'Fraunces-Variable.woff2', 'OFL-Fraunces.txt', 'Inter-Variable.woff2', 'OFL-Inter.txt']) {
  fs.copyFileSync(__dirname + '/src/fonts/' + f, __dirname + '/dist/fonts/' + f);
}
fs.writeFileSync(__dirname + '/dist/buy-box.html', page);
fs.writeFileSync(__dirname + '/dist/index.html',
  head + '\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n' +
  '<meta name="referrer" content="no-referrer">\n' +
  (GOATCOUNTER ? '<meta name="buybox-count" content="' + GOATCOUNTER + '">\n' : '') + site + '\n</html>\n');
console.log('Built dist/buy-box.html and dist/index.html');
