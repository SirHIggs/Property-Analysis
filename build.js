// Assembles src/shell.html + src/engine.js into dist/buy-box.html (one self-contained page).
const fs = require('fs');
const shell = fs.readFileSync(__dirname + '/src/shell.html', 'utf8');
const engine = fs.readFileSync(__dirname + '/src/engine.js', 'utf8');
if (!shell.includes('%%ENGINE%%')) throw new Error('src/shell.html is missing the %%ENGINE%% placeholder');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/buy-box.html', shell.replace('%%ENGINE%%', engine));
console.log('Built dist/buy-box.html');
