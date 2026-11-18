// Schreibt die Liste aller App-Dateien in sw.js und zählt die Cache-Version hoch.
// Aufruf: node tests/update-sw.mjs [--bump]
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['css', 'js', 'assets', 'vendor'];
const files = ['./', './index.html', './manifest.webmanifest'];
const walk = (d) => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (!/\.(map|md)$/.test(f) && !f.includes('maskable')) files.push('./' + p);
  }
};
roots.forEach(walk);
let sw = readFileSync('sw.js', 'utf8');
sw = sw.replace(/const FILES = .*?; \/\/ AUTO/s, `const FILES = ${JSON.stringify(files, null, 2)}; // AUTO`);
if (process.argv.includes('--bump')) sw = sw.replace(/kicherkiste-v(\d+)/, (_, n) => `kicherkiste-v${+n + 1}`);
writeFileSync('sw.js', sw);
console.log(files.length, 'Dateien eingetragen;', sw.match(/kicherkiste-v\d+/)[0]);
