// Fuzzer: random and hostile play through the whole session, with the invariant checks
// after every frame. Any crash or broken invariant is printed with its seed so it can be
// replayed exactly (node tools/fuzz.js --replay <seed> --band <band>).
//
//   node tools/fuzz.js --games 1000            1000+ games in each level band
//
// What it does on purpose: rotate 50 times in a row, slam during spawn, walk into walls,
// fire the power at 0%, ask for the revive twice, press buttons during the celebration,
// the ads and the home screen, start levels in any order, feed the clock 0, NaN, negative
// and ten-second frames, and block or wipe storage mid-game.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  createSession, step, input, next, replay, watchRevive, watchMeterAd, openHome, closeHome,
  startDaily, dismissCallout, start, winScreen, loseScreen, homeInfo,
} from '../src/session.js';
import { validate, createValidator } from '../src/validate.js';
import { createBot, botStep, mulberry32 } from './bots.js';
import { TOTAL_LEVELS } from '../src/core.js';

export const BANDS = { a: [1, 10], b: [11, 20], c: [21, 60], d: [61, 100] };
const PHASES = new Set(['play', 'celebrate', 'won', 'lost']);

function storage(rand) {
  const m = new Map();
  let mode = 'ok';
  return {
    getItem(k) { if (mode === 'blocked') throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (mode === 'blocked' || (mode === 'full' && rand() < 0.5)) throw new Error('QuotaExceeded'); m.set(k, String(v)); },
    clear() { m.clear(); },
    set mode(v) { mode = v; },
    get mode() { return mode; },
    // Garbage in a saved value, as if another version of the game wrote it.
    corrupt(rand2) {
      const keys = [...m.keys()];
      if (keys.length) m.set(keys[Math.floor(rand2() * keys.length)], ['{', 'null', '"x"', '[]', '-5', '1e999'][Math.floor(rand2() * 6)]);
    },
  };
}

const ACTS = ['left', 'right', 'rotate', 'soft', 'slam', 'power'];

// One fuzz run: a session that keeps playing until `games` levels have been started.
export function fuzzRun({ seed, band, games = 10, maxFrames = 60000 }) {
  const rand = mulberry32(seed);
  const [lo, hi] = BANDS[band];
  const st = storage(rand);
  let clock = Date.UTC(2026, 9, 15, 9) + Math.floor(rand() * 1e9);
  const s = createSession({ storage: st, rand: mulberry32(seed + 1), now: () => clock });
  const pick = (n) => Math.floor(rand() * n);
  const level = () => lo + pick(hi - lo + 1);
  start(s, level());
  let started = 1;
  let wins = 0;
  let losses = 0;
  const v = createValidator();
  let bot = createBot('human', mulberry32(seed + 2));
  const log = [];
  const fail = (msg) => ({ seed, band, error: msg, log: log.slice(-25), started, frames, level: s.level, phase: s.phase });
  let frames = 0;
  let lastGame = s.game;
  let lastPhase = s.phase;
  try {
    for (; frames < maxFrames && started <= games; frames++) {
      const r = rand();
      let note = null;
      if (r < 0.004) { // spam
        const a = ACTS[pick(ACTS.length)];
        const n = 5 + pick(50);
        for (let i = 0; i < n; i++) input(s, a);
        note = `spam ${a} x${n}`;
      } else if (r < 0.0065) {
        const calls = [
          ['next', () => next(s)], ['replay', () => replay(s)], ['revive', () => watchRevive(s)],
          ['revive2', () => { watchRevive(s); watchRevive(s); }], ['meterAd', () => watchMeterAd(s)],
          ['home', () => openHome(s)], ['closeHome', () => closeHome(s)], ['daily', () => startDaily(s)],
          ['dismiss', () => dismissCallout(s)], ['start', () => start(s, level())],
          ['startAny', () => start(s, [0, -3, 1.5, 101, 999, NaN, '7'][pick(7)])],
          ['screens', () => { winScreen(s); loseScreen(s); homeInfo(s); }],
          ['clearStore', () => st.clear()], ['blockStore', () => { st.mode = st.mode === 'blocked' ? 'ok' : 'blocked'; }],
          ['fullStore', () => { st.mode = 'full'; }], ['corrupt', () => st.corrupt(rand)],
          ['newDay', () => { clock += 86400000; }],
        ];
        const [name, f] = calls[pick(calls.length)];
        f();
        note = name;
      } else if (r < 0.25) {
        const a = ACTS[pick(ACTS.length)];
        input(s, a);
        note = a;
      } else if (r < 0.8 && s.phase === 'play') {
        // Play sensibly some of the time so levels actually get won.
        if (s.game.piece) botStep(bot, s.game, 1 / 30);
      }
      // Overlays: press the obvious button sometimes, like a player would.
      if (s.phase === 'won' && rand() < 0.05) { next(s); note = 'next*'; }
      if (s.phase === 'lost' && rand() < 0.05) { (rand() < 0.5 ? watchRevive : replay)(s); note = 'lost*'; }
      if (s.home && rand() < 0.02) closeHome(s);

      const dr = rand();
      const dt = dr < 0.002 ? 10 : dr < 0.004 ? 0 : dr < 0.005 ? NaN : dr < 0.006 ? -1 : dr < 0.5 ? 1 / 60 : 1 / 30;
      clock += Number.isFinite(dt) && dt > 0 ? dt * 1000 : 0;
      step(s, dt);
      if (note) log.push(`${frames}: ${note}`);

      if (s.game !== lastGame) {
        started++;
        lastGame = s.game;
        bot = createBot('human', mulberry32(seed + started));
        v.lastLevel = null;
      }
      if (s.phase !== lastPhase) {
        if (s.phase === 'won') wins++;
        if (s.phase === 'lost') losses++;
        lastPhase = s.phase;
      }
      s.events.length = 0;

      const errs = validate(s.game, v);
      if (!PHASES.has(s.phase)) errs.push(`session phase ${s.phase}`);
      if (!(s.level >= 1 && s.level <= TOTAL_LEVELS && Number.isInteger(s.level))) errs.push(`session level ${s.level}`);
      if (s.ad && !(s.ad.left <= 2.5 && s.ad.left > -1)) errs.push(`ad timer ${s.ad.left}`);
      if (s.phase === 'play' && !s.ad && s.game.state === 'lose') errs.push('game lost but the session is still playing');
      if (s.phase === 'lost' && s.game.state !== 'lose') errs.push(`lose screen over a ${s.game.state} game`);
      if (s.callout && !(s.callout.left <= 5)) errs.push('callout stuck');
      if (errs.length) return fail(errs.join('; '));
    }
  } catch (e) {
    return fail(`CRASH ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
  }
  return { seed, band, started, frames, wins, losses };
}

// ---------- runner ----------

if (!isMainThread) {
  parentPort.postMessage(workerData.jobs.map((j) => fuzzRun(j)));
}

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  return o;
}

async function main() {
  const o = args();
  if (o.replay) {
    console.log(JSON.stringify(fuzzRun({ seed: +o.replay, band: o.band || 'a', games: +(o.per || 10) }), null, 1));
    return;
  }
  const gamesPerBand = +(o.games || 1000);
  const per = +(o.per || 10); // games per run
  const bands = (o.bands || 'abcd').split('');
  const seed0 = +(o.seed || 1);
  const jobs = [];
  for (const band of bands) {
    for (let i = 0; i < Math.ceil(gamesPerBand / per); i++) jobs.push({ seed: seed0 * 1000003 + i * 7 + band.charCodeAt(0) * 100000, band, games: per });
  }
  const n = os.cpus().length;
  const chunks = Array.from({ length: n }, () => []);
  jobs.forEach((j, i) => chunks[i % n].push(j));
  const t0 = Date.now();
  const res = (await Promise.all(chunks.map((jobs2) => new Promise((ok, no) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: jobs2 } });
    w.on('message', ok);
    w.on('error', no);
  })))).flat();
  const bad = res.filter((r) => r.error);
  const by = {};
  for (const r of res) {
    const b = (by[r.band] ||= { runs: 0, games: 0, frames: 0, wins: 0, losses: 0, bad: 0 });
    b.runs++;
    b.games += r.started;
    b.frames += r.frames;
    b.wins += r.wins || 0;
    b.losses += r.losses || 0;
    if (r.error) b.bad++;
  }
  console.log(`fuzz: ${res.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const [band, b] of Object.entries(by)) {
    console.log(`band ${band} (levels ${BANDS[band].join('-')}): ${b.games} games, ${b.frames} frames, ${b.wins} wins, ${b.losses} losses, ${b.bad} failures`);
  }
  const total = Object.values(by).reduce((t, b) => t + b.games, 0);
  console.log(`TOTAL ${total} games, ${bad.length} failures`);
  for (const r of bad.slice(0, 15)) console.log(JSON.stringify(r));
  if (o.json) (await import('node:fs')).writeFileSync(o.json, JSON.stringify({ by, total, bad }, null, 1));
  process.exitCode = bad.length ? 1 : 0;
}

if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) main();
