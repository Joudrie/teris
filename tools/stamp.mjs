// Stamps index.html so a deploy reaches every player at once.
//
// GitHub Pages lets browsers reuse any file for 10 minutes without asking, so right after a
// deploy a returning player can get the old page, or worse, a mix of old and new modules.
// This script gives every module and the stylesheet a content-hashed URL through an import
// map (an unchanged file keeps its URL and stays cached), and bakes a build id into the
// page. On load the page fetches version.json uncached; if the build is newer than its
// own, it jumps once to the fresh page.
//
//   node tools/stamp.mjs          rewrite index.html and version.json
//   node tools/stamp.mjs --check  exit 1 if they are out of date (writes nothing)
//
// Run it before every commit that is going live (see CLAUDE.md).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f));
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out.sort();
}

const START = '<!-- stamp:start (written by tools/stamp.mjs, do not edit by hand) -->';
const END = '<!-- stamp:end -->';
const html0 = read('index.html').toString();
// The page without any stamp, so the build id depends on content only.
const bare = html0
  .replace(new RegExp(`\\s*${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}`), '')
  .replace(/(href="style\.css|src="src\/main\.js)\?v=[0-9a-f]+"/g, '$1"');

const modules = walk('src').map((f) => [`./${f}`, `./${f}?v=${hash(read(f))}`]);
const cssV = hash(read('style.css'));
const build = hash([hash(bare), cssV, ...modules.map(([, v]) => v)].join('\n'));
const mainV = modules.find(([k]) => k === './src/main.js')[1].split('?v=')[1];

const check = `(function () {
    var B = '${build}';
    window.BUILD = B;
    if (!window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.build || v.build === B) return;
      var u = new URL(location.href);
      if (u.searchParams.get('v') === v.build) return; // asked for that build once already
      u.searchParams.set('v', v.build);
      location.replace(u.toString());
    }).catch(function () {});
  })();`;
const map = JSON.stringify({ imports: Object.fromEntries(modules) }, null, 2).replace(/\n/g, '\n  ');
const block = `${START}
  <script>${check}</script>
  <script type="importmap">${map}</script>
  ${END}`;

let html = bare
  .replace('<link rel="stylesheet" href="style.css">', `${block}\n  <link rel="stylesheet" href="style.css?v=${cssV}">`)
  .replace('<script type="module" src="src/main.js"></script>', `<script type="module" src="src/main.js?v=${mainV}"></script>`);
if (!html.includes(START) || !html.includes(`src/main.js?v=${mainV}`)) {
  console.error('stamp: could not find the stylesheet link or the main script tag in index.html');
  process.exit(1);
}
const version = `${JSON.stringify({ build }, null, 1)}\n`;

const versionPath = path.join(ROOT, 'version.json');
const current = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf8') : '';
if (process.argv.includes('--check')) {
  const ok = html === html0 && version === current;
  console.log(ok ? `stamp up to date (build ${build})` : 'stamp out of date: run node tools/stamp.mjs');
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
fs.writeFileSync(versionPath, version);
console.log(`stamped build ${build} (${modules.length} modules)`);
