// Headless playtest rig. Plays real games through the real rules with a bot on the inputs.
//
//   node tools/rig.js levels  --bot human --from 1 --to 30 --games 40
//   node tools/rig.js campaign --bot human --players 60 --to 40
//   node tools/rig.js all      (the three bots over every level: the SUMMARY table)
//
// Every tick also runs the debug validator; any invariant break is reported with its seed.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  createGame, update, progress, revive, piecesDrained, PIECE, TOTAL_LEVELS, SETTLE_TIME,
} from '../src/core.js';
import { levelConfig } from '../src/levels.js';
import { validate, createValidator } from '../src/validate.js';
import { createBot, botStep, mulberry32, cloneGame } from './bots.js';

const DT = 1 / 30;
const MAX_TIME = 420; // seconds of play before a game counts as stuck

export function playGame({ level, bot: kind, seed, help = false, check = true, maxTime = MAX_TIME, useRevive = true }) {
  const rand = mulberry32(seed);
  const cfg = levelConfig(level, { help });
  // Tuning experiments: scale goals or fall speed without editing the levels.
  if (process.env.GOALX) cfg.goal = { pieces: Math.round(cfg.goal.pieces * +process.env.GOALX) };
  if (process.env.SPEEDX) cfg.speed = (cfg.speed || 0.4) * +process.env.SPEEDX;
  const g = createGame({ level, rand, config: cfg });
  const bot = createBot(kind, mulberry32(seed ^ 0x9e3779b9));
  const v = createValidator();
  const r = {
    level, seed, kind, won: false, wonWithRevive: false, lostAt: null, time: 0, powers: 0,
    longestGap: 0, firstDrain: null, firstCombo: null, firstBar: null, bestMult: 1, errors: [],
    revived: false, pieces: 0,
  };
  let gap = 0;
  let lastDrained = 0;
  let lastPiece = null;
  while (r.time < maxTime) {
    botStep(bot, g, DT);
    update(g, DT);
    r.time += DT;
    if (g.piece && g.piece !== lastPiece) { lastPiece = g.piece; r.pieces++; }
    for (const e of g.events) {
      if (e.type === 'combo' && r.firstCombo === null) r.firstCombo = r.time;
    }
    g.events.length = 0;
    if (g.drained > lastDrained) {
      if (r.firstDrain === null) r.firstDrain = r.time;
      lastDrained = g.drained;
      gap = 0;
    } else if (g.state === 'play') {
      gap += DT;
      // The first piece's fall isn't a dry spell: nothing has landed yet.
      if (r.pieces > 1 || g.drained > 0) r.longestGap = Math.max(r.longestGap, gap);
    }
    if (r.firstBar === null && piecesDrained(g) >= 1) r.firstBar = r.time;
    r.bestMult = Math.max(r.bestMult, g.mult);
    if (check) {
      const errs = validate(g, v);
      if (errs.length) {
        r.errors.push(...errs.map((e) => `t=${r.time.toFixed(2)} ${e}`));
        break;
      }
    }
    if (g.state === 'win') {
      if (r.revived) r.wonWithRevive = true;
      else r.won = true;
      break;
    }
    if (g.state === 'lose') {
      if (r.lostAt === null) r.lostAt = progress(g);
      if (useRevive && !r.revived) {
        r.revived = true;
        revive(g);
        continue;
      }
      break;
    }
  }
  r.stuck = g.state === 'play' && !r.errors.length;
  if (r.stuck && r.lostAt === null) r.lostAt = progress(g);
  r.progress = progress(g);
  r.powers = bot.powers;
  r.drained = g.drained / PIECE;
  return r;
}

// A player going through the levels in order, retrying until they win (helping hand after
// three losses, like the game). Records first-try results per level.
export function playCampaign({ bot, seed, to, from = 1 }) {
  const out = [];
  const rand = mulberry32(seed);
  for (let level = from; level <= to; level++) {
    let tries = 0;
    for (;;) {
      tries++;
      const r = playGame({ level, bot, seed: Math.floor(rand() * 2 ** 31), help: tries > 3, useRevive: true });
      if (r.errors.length) out.push({ level, error: r.errors[0], seed: r.seed });
      if (r.won || r.wonWithRevive) {
        out.push({ level, tries, firstTry: tries === 1 && r.won, time: r.time });
        break;
      }
      if (tries >= 12) { out.push({ level, tries, firstTry: false, stuck: true }); return out; }
    }
  }
  return out;
}

// Fewest pieces a player needs to clear a level. The bot plays with no budget; each time a
// new piece appears, a copy of the game is run on as if the budget had just ended there
// (no more pieces, let the reactions settle). The first copy that wins gives the need.
// Infinity if the board topped out first. tools/calibrate.js turns these into budgets.
export function measureNeed({ level, bot: kind, seed }) {
  const rand = mulberry32(seed);
  const cfg = levelConfig(level);
  cfg.pieces = Infinity;
  const g = createGame({ level, rand, config: cfg });
  const bot = createBot(kind, mulberry32(seed ^ 0x9e3779b9));
  let spawned = 1;
  let piece = g.piece;
  let t = 0;
  let need = Infinity;
  while (t < 900 && g.state === 'play') {
    botStep(bot, g, DT);
    update(g, DT);
    t += DT;
    g.events.length = 0;
    if (g.piece && g.piece !== piece) {
      piece = g.piece;
      // spawned pieces have been placed; would the level be won with exactly that many?
      if (progress(g) >= 0.6 && runsOut(g, seed + spawned)) { need = spawned; break; }
      spawned++;
    }
  }
  if (need === Infinity && g.state === 'win') need = spawned;
  return { level, seed, need, time: t, powers: bot.powers };
}

function runsOut(g, seed) {
  const c = cloneGame(g, seed);
  c.piece = null;
  c.left = 0;
  c.settling = SETTLE_TIME;
  for (let i = 0; i < 30 * 60 && c.state === 'play'; i++) update(c, DT);
  return c.state === 'win';
}

// ---------- parallel runner ----------

export function runParallel(jobs, fn) {
  const n = Math.min(os.cpus().length, jobs.length) || 1;
  const chunks = Array.from({ length: n }, () => []);
  jobs.forEach((j, i) => chunks[i % n].push(j));
  return Promise.all(chunks.map((chunk) => new Promise((res, rej) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { fn, chunk } });
    w.on('message', res);
    w.on('error', rej);
  }))).then((parts) => parts.flat());
}

if (!isMainThread) {
  const { fn, chunk } = workerData;
  const f = fn === 'campaign' ? playCampaign : fn === 'need' ? measureNeed : playGame;
  parentPort.postMessage(chunk.map((j) => f(j)));
}

const pct = (n) => `${Math.round(n * 100)}%`;
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

export function summarize(results) {
  const by = new Map();
  for (const r of results) {
    if (!by.has(r.level)) by.set(r.level, []);
    by.get(r.level).push(r);
  }
  const rows = [];
  for (const [level, rs] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
    const losses = rs.filter((r) => !r.won);
    rows.push({
      level,
      games: rs.length,
      win: rs.filter((r) => r.won).length / rs.length,
      winRevive: rs.filter((r) => r.won || r.wonWithRevive).length / rs.length,
      close: losses.length ? losses.filter((r) => r.lostAt >= 0.8).length / losses.length : NaN,
      winTime: med(rs.filter((r) => r.won).map((r) => r.time)),
      gap: med(rs.map((r) => r.longestGap)),
      gap90: [...rs.map((r) => r.longestGap)].sort((a, b) => a - b)[Math.floor(rs.length * 0.9)] || 0,
      powers: rs.reduce((t, r) => t + r.powers, 0) / rs.length,
      firstDrain: med(rs.map((r) => r.firstDrain ?? 999)),
      firstCombo: med(rs.map((r) => r.firstCombo ?? 999)),
      stuck: rs.filter((r) => r.stuck).length,
      errors: rs.flatMap((r) => r.errors.map((e) => `L${r.level} seed ${r.seed}: ${e}`)),
    });
  }
  return rows;
}

export function printRows(rows, title) {
  console.log(`\n${title}`);
  console.log('lvl  win  +rev  close  winT  gapMed gap90 pow  1stDrain 1stCombo stuck');
  for (const r of rows) {
    console.log([
      String(r.level).padStart(3), pct(r.win).padStart(5), pct(r.winRevive).padStart(5),
      (Number.isNaN(r.close) ? '-' : pct(r.close)).padStart(6), (Number.isNaN(r.winTime) ? '-' : r.winTime.toFixed(0)).padStart(5),
      r.gap.toFixed(1).padStart(6), r.gap90.toFixed(1).padStart(5), r.powers.toFixed(1).padStart(4),
      r.firstDrain.toFixed(1).padStart(8), r.firstCombo.toFixed(1).padStart(8), String(r.stuck).padStart(5),
    ].join(' '));
  }
  const errs = rows.flatMap((r) => r.errors);
  if (errs.length) {
    console.log(`\n${errs.length} INVARIANT BREAKS`);
    for (const e of errs.slice(0, 20)) console.log('  ', e);
  }
}

function args() {
  const a = process.argv.slice(2);
  const o = { cmd: a[0] || 'levels' };
  for (let i = 1; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  return o;
}

async function main() {
  const o = args();
  const from = +(o.from || 1);
  const to = +(o.to || 30);
  const games = +(o.games || 30);
  const seed0 = +(o.seed || 1);
  if (o.cmd === 'levels' || o.cmd === 'all') {
    const bots = o.cmd === 'all' ? ['random', 'smart', 'human'] : [o.bot || 'human'];
    const step = +(o.step || 1);
    const all = {};
    for (const bot of bots) {
      const jobs = [];
      for (let level = from; level <= to; level += step) {
        for (let i = 0; i < games; i++) jobs.push({ level, bot, seed: seed0 * 100003 + level * 1009 + i });
      }
      const t0 = Date.now();
      const rows = summarize(await runParallel(jobs, 'game'));
      all[bot] = rows;
      printRows(rows, `${bot} bot, ${games} games per level (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    if (o.json) {
      const fs = await import('node:fs');
      fs.writeFileSync(o.json, JSON.stringify(all, null, 1));
    }
  } else if (o.cmd === 'campaign') {
    const players = +(o.players || 40);
    const jobs = Array.from({ length: players }, (_, i) => ({ bot: o.bot || 'human', seed: seed0 * 7919 + i, to }));
    const res = (await runParallel(jobs, 'campaign')).flat();
    const by = new Map();
    for (const r of res) {
      if (r.error) { console.log('INVARIANT BREAK', r); continue; }
      if (!by.has(r.level)) by.set(r.level, []);
      by.get(r.level).push(r);
    }
    console.log(`\ncampaign: ${players} ${o.bot || 'human'} players`);
    console.log('lvl players firstTry avgTries medTime');
    for (const [level, rs] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
      console.log([
        String(level).padStart(3), String(rs.length).padStart(7), pct(rs.filter((r) => r.firstTry).length / rs.length).padStart(8),
        (rs.reduce((t, r) => t + r.tries, 0) / rs.length).toFixed(2).padStart(8), med(rs.map((r) => r.time || 0)).toFixed(0).padStart(7),
      ].join(' '));
    }
    if (o.json) {
      const fs = await import('node:fs');
      fs.writeFileSync(o.json, JSON.stringify([...by.entries()], null, 1));
    }
  }
}

if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) main();

export { TOTAL_LEVELS };
