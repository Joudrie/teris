// Builds the generated sections of DESIGN.md from the saved run data in docs/data/.
// Each section sits between <!-- gen:name --> and <!-- /gen:name --> markers.
//
//   node tools/report.js

import fs from 'node:fs';
import { targetWinRate, levelConfig } from '../src/levels.js';
import { SCENES } from '../src/scenes.js';

const D = 'docs/data';
const read = (f) => (fs.existsSync(`${D}/${f}`) ? JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8')) : null);
const pct = (x) => (x === null || x === undefined || Number.isNaN(x) ? '–' : `${Math.round(x * 100)}%`);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const rig = { random: read('rig-random.json')?.random, human: read('rig-human.json')?.human, smart: read('rig-smart.json')?.smart };
const campaign = read('campaign-human.json');
const fuzz = read('fuzz.json');
const shots = (f) => (fs.existsSync(`docs/shots/${f}`) ? JSON.parse(fs.readFileSync(`docs/shots/${f}`, 'utf8')) : null);
const browser = shots('browser-checks.json');
const hook = shots('hook-checks.json');
const cards = shots('cards.json') || {};

const BANDS = [[1, 3, 'Teach (1-3)'], [4, 10, 'Early (4-10)'], [11, 20, 'Early (11-20)'], [21, 40, 'Mid (21-40)'], [41, 60, 'Mid (41-60)'], [61, 80, 'Late (61-80)'], [81, 100, 'Late (81-100)']];
const inBand = (rows, a, b) => (rows || []).filter((r) => r.level >= a && r.level <= b);

const firstTry = new Map();
if (campaign) for (const [level, rs] of campaign) firstTry.set(level, rs.filter((r) => r.firstTry).length / rs.length);

const sections = {};

sections.winrates = (() => {
  const out = ['| Levels | Target (casual, first try) | Random bot | Human-ish bot | Human-ish, first try in a campaign | Expert (smart) bot |', '|---|---|---|---|---|---|'];
  for (const [a, b, name] of BANDS) {
    const t = [];
    for (let l = a; l <= b; l++) t.push(targetWinRate(l));
    const ft = [];
    for (let l = a; l <= b; l++) if (firstTry.has(l)) ft.push(firstTry.get(l));
    const cell = (rows) => (rows && rows.length ? `${pct(avg(rows.map((r) => r.win)))} (${pct(avg(rows.map((r) => r.winRevive)))} with revive)` : '–');
    out.push(`| ${name} | ${pct(avg(t))} | ${cell(inBand(rig.random, a, b))} | ${cell(inBand(rig.human, a, b))} | ${ft.length ? pct(avg(ft)) : '–'} | ${cell(inBand(rig.smart, a, b))} |`);
  }
  const all = (k) => (rig[k] ? pct(avg(rig[k].map((r) => r.win))) : '–');
  out.push(`| **All 100** | ${pct(avg(Array.from({ length: 100 }, (_, i) => targetWinRate(i + 1))))} | ${all('random')} | ${all('human')} | ${firstTry.size ? pct(avg([...firstTry.values()])) : '–'} | ${all('smart')} |`);
  const games = Object.values(rig).filter(Boolean).reduce((t, rows) => t + rows.reduce((u, r) => u + r.games, 0), 0);
  out.push('', `Win = cleared without the revive. ${games} rig games in total, every one with the invariant checks on every tick.`);
  return out.join('\n');
})();

sections.retention = (() => {
  const h = rig.human || [];
  const early = inBand(h, 4, 20);
  const mid = inBand(h, 21, 60);
  const losses = h.filter((r) => !Number.isNaN(r.close));
  const closeAll = avg(losses.map((r) => r.close));
  const ftEarly = [];
  const ftMid = [];
  for (const [l, v] of firstTry) (l <= 20 && l >= 4 ? ftEarly : l >= 21 && l <= 60 ? ftMid : []).push(v);
  const rows = [
    ['Levels won on first try, early (4-20)', '60-75%', pct(avg(ftEarly.length ? ftEarly : early.map((r) => r.win)))],
    ['Levels won on first try, mid (21-60)', '40-55%', pct(avg(ftMid.length ? ftMid : mid.map((r) => r.win)))],
    ['Losses that were close (80%+ of the bar)', 'at least half', pct(closeAll)],
    ['Longest stretch with no drain, per level (median of medians)', 'under ~6 s', `${med(h.map((r) => r.gap)).toFixed(1)} s (90th percentile ${med(h.map((r) => r.gap90)).toFixed(1)} s)`],
    ['Powers used per level', 'about 1', avg(h.map((r) => r.powers)).toFixed(2)],
    ['Time to first drain (median level)', '', `${med(h.map((r) => r.firstDrain)).toFixed(1)} s`],
    ['Time to win a level (median level)', '', `${med(h.filter((r) => !Number.isNaN(r.winTime)).map((r) => r.winTime)).toFixed(0)} s`],
  ];
  return ['| Proxy (human-ish bot) | Aim | Measured |', '|---|---|---|', ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
})();

sections.perlevel = (() => {
  const out = ['| Lvl | Name | Mode | Goal | Pieces | Target | Random | Human-ish | First try (campaign) | Expert | Close losses | Win time | Gap (med) | Powers |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (let l = 1; l <= 100; l++) {
    const c = levelConfig(l);
    const r = (k) => (rig[k] || []).find((x) => x.level === l);
    const h = r('human');
    out.push(`| ${l} | ${c.name}${c.showcase ? ' ★' : ''} | ${c.mode} | ${c.goal.pieces} | ${c.pieces} | ${pct(targetWinRate(l))} | ${pct(r('random')?.win)} | ${pct(h?.win)} | ${pct(firstTry.get(l))} | ${pct(r('smart')?.win)} | ${pct(h?.close)} | ${h && !Number.isNaN(h.winTime) ? `${h.winTime.toFixed(0)} s` : '–'} | ${h ? `${h.gap.toFixed(1)} s` : '–'} | ${h ? h.powers.toFixed(1) : '–'} |`);
  }
  return out.join('\n');
})();

sections.fuzz = (() => {
  if (!fuzz) return '_not run yet_';
  const out = ['| Band | Levels | Games | Frames | Wins | Losses | Crashes / invariant breaks |', '|---|---|---|---|---|---|---|'];
  const names = { a: '1-10', b: '11-20', c: '21-60', d: '61-100' };
  for (const [band, b] of Object.entries(fuzz.by)) out.push(`| ${band} | ${names[band]} | ${b.games} | ${b.frames} | ${b.wins} | ${b.losses} | ${b.bad} |`);
  out.push(`| **Total** | | **${fuzz.total}** | ${Object.values(fuzz.by).reduce((t, b) => t + b.frames, 0)} | | | **${fuzz.bad.length}** |`);
  return out.join('\n');
})();

const checklist = (list) => (list ? ['| Check | Result | Measured |', '|---|---|---|', ...list.map((r) => `| ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${String(r.info || '').replace(/\|/g, '/').slice(0, 140)} |`)].join('\n') : '_not run yet_');
sections.browser = checklist(browser);
sections.hook = checklist(hook);

sections.cardtimes = (() => {
  const out = ['| Card | Scene | Headless | Browser | Effect starts | Effect done | Screenshot |', '|---|---|---|---|---|---|---|'];
  for (const [id, sc] of Object.entries(SCENES)) {
    const c = cards[id] || {};
    out.push(`| ${sc.title} | \`${id}\` | ${c.headless === false ? 'FAIL' : 'pass'} | ${c.ok === undefined ? '–' : c.ok ? 'pass' : 'FAIL'} | ${c.first === null || c.first === undefined ? 'at once' : `${c.first.toFixed(2)} s`} | ${c.last === null || c.last === undefined ? '–' : `${c.last.toFixed(2)} s`} | [shot](docs/shots/card-${id}.jpg) |`);
  }
  return out.join('\n');
})();

let md = fs.readFileSync('DESIGN.md', 'utf8');
for (const [name, body] of Object.entries(sections)) {
  const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
  if (re.test(md)) md = md.replace(re, `$1\n${body}\n$2`);
}
fs.writeFileSync('DESIGN.md', md);
console.log('DESIGN.md sections updated:', Object.keys(sections).join(', '));
