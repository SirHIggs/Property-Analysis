// Assembles src/shell.html + src/engine.js + the example deals in data/deals.json into:
//   dist/buy-box.html  one self-contained page (a claude.ai artifact, and what the tests open)
//   dist/index.html    the same page as a full HTML document for the public website (GitHub Pages)
const fs = require('fs');
const shell = fs.readFileSync(__dirname + '/src/shell.html', 'utf8');
const engine = fs.readFileSync(__dirname + '/src/engine.js', 'utf8');
const seed = JSON.parse(fs.readFileSync(__dirname + '/data/deals.json', 'utf8')).deals;
for (const mark of ['%%ENGINE%%', '%%SEED%%']) {
  if (!shell.includes(mark)) throw new Error('src/shell.html is missing the ' + mark + ' placeholder');
}
// Function replacements, so a "$" in the engine or the deals is never read as a replacement pattern.
// "<" is escaped so text in the deals can never close the script tag.
const page = shell
  .replace('%%ENGINE%%', () => engine)
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

fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/buy-box.html', page);
fs.writeFileSync(__dirname + '/dist/index.html', head + '\n' + page + '\n</html>\n');
console.log('Built dist/buy-box.html and dist/index.html');
