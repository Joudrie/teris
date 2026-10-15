// Second tuning pass. Calibration sets each budget from one set of games; a verification
// run with fresh seeds (docs/data/rig-human.json) shows where a level still misses its
// target win rate by more than 20 points. For those levels, try the budget one piece
// tighter or looser on another fresh set of games, and keep whichever lands closest.
//
//   node tools/correct.js [--games 40]          rewrites src/budgets.js

import fs from 'node:fs';
import { runParallel } from './rig.js';
import { targetWinRate, levelConfig, NEWBIE_TARGET } from '../src/levels.js';
import { BUDGETS } from '../src/budgets.js';

const a = process.argv.slice(2);
const games = +(a[a.indexOf('--games') + 1] || 40);
const human = JSON.parse(fs.readFileSync('docs/data/rig-human.json', 'utf8')).human;
const off = human.filter((r) => !NEWBIE_TARGET[r.level] && Math.abs(r.win - targetWinRate(r.level)) > 0.2);
console.log(`${off.length} levels more than 20 points off target`);

// Candidate budgets: current, and one step in the direction that should help.
const jobs = [];
for (const r of off) {
  const b = BUDGETS[r.level];
  const step = r.win > targetWinRate(r.level) ? -1 : 1;
  for (const cand of [b, b + step]) {
    for (let i = 0; i < games; i++) jobs.push({ level: r.level, bot: 'human', seed: 424242 + r.level * 1543 + i * 17, budget: cand, check: false });
  }
}
const res = await runParallel(jobs, 'game');
const by = new Map();
for (const r of res) {
  const k = `${r.level}:${r.budget}`;
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(r.won);
}
const budgets = { ...BUDGETS };
const changes = [];
for (const r of off) {
  const target = targetWinRate(r.level);
  let best = null;
  for (const [k, wins] of by) {
    const [level, pieces] = k.split(':').map(Number);
    if (level !== r.level) continue;
    const rate = wins.filter(Boolean).length / wins.length;
    if (!best || Math.abs(rate - target) < Math.abs(best.rate - target)) best = { pieces, rate };
  }
  if (best.pieces !== BUDGETS[r.level]) {
    budgets[r.level] = best.pieces;
    changes.push(`${r.level}: ${BUDGETS[r.level]} -> ${best.pieces} (target ${Math.round(target * 100)}%, now ${Math.round(best.rate * 100)}%)`);
  }
}
console.log(changes.length ? changes.join('\n') : 'no changes');
const body = Object.entries(budgets).sort((x, y) => x[0] - y[0]).map(([l, b]) => `${l}: ${b}`).join(', ');
const head = fs.readFileSync('src/budgets.js', 'utf8').split('\n').filter((l) => l.startsWith('//')).filter((l) => !l.includes('tools/correct.js')).join('\n');
fs.writeFileSync('src/budgets.js', `${head}\n// Then adjusted by tools/correct.js for ${changes.length} levels that verification showed were off target.\nexport const BUDGETS = { ${body} };\n`);
fs.writeFileSync('docs/data/correction.txt', changes.join('\n'));
void levelConfig;
