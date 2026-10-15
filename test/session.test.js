import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession, step, input, live, next, replay, watchRevive, watchMeterAd, openHome, closeHome,
  startDaily, winScreen, loseScreen, dailyReady, start, safeStore, AD_TIME, MAX_DT, playLog, playLogSummary, clearPlayLog,
} from '../src/session.js';
import { emptyGrid, PIECE, GW, GH, S, placeBlock } from '../src/core.js';
import { mulberry32 } from '../tools/bots.js';

// A localStorage stand-in.
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    clear: () => m.clear(),
    map: m,
  };
}
const blocked = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
};

const run = (s, secs, dt = 1 / 30) => { for (let t = 0; t < secs; t += dt) step(s, dt); };

// Puts the current level one douse away from winning.
function nearWin(s) {
  const g = s.game;
  g.grid = emptyGrid();
  placeBlock(g, { m: 'fire', x: 0, y: 18, w: 12, h: 2 });
  g.drained = g.cfg.goal.pieces * PIECE - 10;
  g.piece = { m: 'water', mats: ['water', 'water', 'water', 'water'], cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 4, y: 0 };
}

function win(s) {
  nearWin(s);
  input(s, 'slam');
  run(s, 4);
  assert.equal(s.phase, 'won');
}

// Fills the board so the next spawn tops out.
function lose(s) {
  const g = s.game;
  g.grid = emptyGrid();
  placeBlock(g, { m: 'brick', x: 0, y: 1, w: 12, h: 19 });
  g.piece = { m: 'brick', mats: ['brick', 'brick', 'brick', 'brick'], cells: [[0, 0], [1, 0], [0, 1], [1, 1]], x: 4, y: 0 };
  input(s, 'slam');
  assert.equal(s.phase, 'lost');
}

const mk = (o = {}) => createSession({ rand: mulberry32(1), storage: memStorage(), now: () => Date.UTC(2026, 9, 15, 12), ...o });

test('a new session opens straight into level 1 with a piece falling', () => {
  const s = mk();
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'play');
  assert.ok(live(s));
  assert.ok(s.game.piece);
  assert.equal(s.callout.text, s.cfg.intro);
});

test('the first-time callout shows once per level, even across sessions', () => {
  const storage = memStorage();
  const s = mk({ storage });
  assert.ok(s.callout);
  run(s, 6);
  assert.equal(s.callout, null);
  start(s, 1);
  assert.equal(s.callout, null);
  const s2 = mk({ storage });
  assert.equal(s2.callout, null);
});

test('playing hurries the callout off the board', () => {
  const s = mk();
  input(s, 'left');
  assert.ok(s.callout.left <= 1.2);
});

test('winning celebrates, then the win screen previews the next level', () => {
  const s = mk();
  win(s);
  const w = winScreen(s);
  assert.match(w.next, /level 2/);
  assert.equal(w.nextLabel, 'Play level 2');
  next(s);
  assert.equal(s.level, 2);
  assert.equal(s.phase, 'play');
});

test('inputs during the celebration and overlays do nothing', () => {
  const s = mk();
  nearWin(s);
  input(s, 'slam');
  run(s, 0.2);
  assert.equal(s.phase, 'celebrate');
  for (const a of ['left', 'right', 'rotate', 'soft', 'slam', 'power']) assert.equal(input(s, a), false);
  assert.equal(next(s), false); // not until the win screen is up
  run(s, 3);
  assert.equal(s.phase, 'won');
  for (const a of ['left', 'slam']) assert.equal(input(s, a), false);
});

test('a loss shows real progress, and only one revive per level', () => {
  const s = mk();
  s.game.drained = Math.floor(s.cfg.goal.pieces * 0.92) * PIECE;
  lose(s);
  const l = loseScreen(s);
  assert.ok(l.title.startsWith('So close!'));
  assert.ok(l.title.includes(`${l.pct}%`));
  assert.ok(l.canRevive);
  assert.ok(watchRevive(s));
  assert.equal(watchRevive(s), false); // already watching
  run(s, AD_TIME + 0.2);
  assert.equal(s.phase, 'play');
  assert.ok(s.game.revived);
  lose(s);
  assert.equal(loseScreen(s).canRevive, false);
  assert.equal(watchRevive(s), false); // no second revive
  assert.ok(replay(s));
  assert.equal(s.phase, 'play');
});

test('a far-off loss is not called close', () => {
  const s = mk();
  s.game.drained = 2 * PIECE;
  lose(s);
  assert.ok(loseScreen(s).title.startsWith('Topped out'));
});

test('helping hand after three losses, and the player is told', () => {
  const s = mk();
  start(s, 9);
  for (let i = 0; i < 3; i++) {
    lose(s);
    if (i === 2) assert.ok(loseScreen(s).help);
    replay(s);
  }
  assert.ok(s.cfg.help);
  // A loss after a revive still counts once.
  win(s);
  start(s, 9);
  assert.equal(s.cfg.help, false);
});

test('one loss per attempt even when the revive also runs out', () => {
  const storage = memStorage();
  const s = mk({ storage });
  start(s, 9);
  lose(s);
  watchRevive(s);
  run(s, AD_TIME + 0.2);
  lose(s);
  assert.equal(s.store.get('mb_losses_9', 0), 1);
});

test('no interstitials in the first five levels; then at most every other level and three minutes apart', () => {
  let clock = Date.UTC(2026, 9, 15, 12);
  const s = mk({ now: () => clock });
  let ads = 0;
  const levels = [];
  for (let l = 1; l <= 12; l++) {
    start(s, l);
    win(s);
    next(s);
    if (s.ad) {
      assert.equal(s.ad.kind, 'interstitial');
      ads++;
      levels.push(l);
      for (const a of ['left', 'slam']) assert.equal(input(s, a), false); // board is covered
      run(s, AD_TIME + 0.2);
      assert.equal(s.level, l + 1);
    }
    clock += 90 * 1000; // a level every minute and a half
  }
  assert.ok(levels.every((l) => l >= 5), `ads after levels ${levels}`);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] >= 2);
  assert.ok(ads >= 2 && ads <= 4, `${ads} ads`);
});

test('interstitial pacing carries across sessions', () => {
  const storage = memStorage();
  let clock = Date.UTC(2026, 9, 15, 12);
  const s = mk({ storage, now: () => clock });
  start(s, 8);
  s.store.set('mb_since_ad', 5);
  win(s);
  next(s);
  assert.ok(s.ad);
  // Quit and reopen a minute later: the three-minute gap still holds.
  clock += 60 * 1000;
  const s2 = mk({ storage, now: () => clock });
  assert.equal(s2.level, 9);
  s2.store.set('mb_since_ad', 5);
  win(s2);
  next(s2);
  assert.equal(s2.ad, null);
});

test('no ads at all once ads are removed', () => {
  const s = mk({ adsRemoved: () => true });
  for (let l = 6; l < 12; l++) {
    start(s, l);
    win(s);
    next(s);
    assert.equal(s.ad, null);
  }
});

test('the meter ad shows at 80% once per level and fills the meter', () => {
  const s = mk();
  s.callout = null;
  s.game.meter = 0.5;
  assert.equal(watchMeterAd(s), false);
  s.game.meter = 0.85;
  assert.ok(watchMeterAd(s));
  run(s, AD_TIME + 0.2);
  assert.equal(s.game.meter, 1);
  s.game.meter = 0.85;
  assert.equal(watchMeterAd(s), false);
});

test('level 100: win screen says so and play again goes back to level 1', () => {
  const s = mk();
  start(s, 100);
  win(s);
  const w = winScreen(s);
  assert.match(w.title, /ground/);
  assert.equal(w.nextLabel, 'Play again');
  next(s);
  run(s, AD_TIME + 0.2);
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'play');
});

test('blocked localStorage: the game still runs, remembering within the session', () => {
  const s = mk({ storage: blocked });
  assert.equal(s.level, 1);
  win(s);
  next(s);
  assert.equal(s.level, 2);
  assert.equal(s.store.get('mb_level', 0), 2);
});

test('localStorage cleared mid-game: play carries on and the level is saved again', () => {
  const storage = memStorage();
  const s = mk({ storage });
  start(s, 6);
  storage.clear();
  run(s, 1);
  win(s);
  next(s);
  run(s, AD_TIME + 0.2);
  assert.equal(s.level, 7);
  assert.equal(storage.getItem('mb_level'), '7');
});

test('corrupt saved values fall back to safe defaults', () => {
  const storage = memStorage();
  storage.setItem('mb_level', '"banana"');
  storage.setItem('mb_seen', '{"x":1}');
  storage.setItem('mb_daily', 'not json');
  const s = mk({ storage });
  assert.equal(s.level, 1);
  assert.ok(dailyReady(s));
  const s2 = mk({ storage: (() => { const st = memStorage(); st.setItem('mb_level', '999'); return st; })() });
  assert.equal(s2.level, 100);
});

test('home pauses the game and closing it resumes', () => {
  const s = mk();
  openHome(s);
  const y = s.game.piece.y;
  run(s, 3);
  assert.equal(s.game.piece.y, y);
  assert.equal(input(s, 'slam'), false);
  closeHome(s);
  run(s, 3);
  assert.ok(s.game.piece.y !== y || s.game.piece !== null);
});

test('a backgrounded tab cannot fast-forward the game', () => {
  const s = mk();
  const y = s.game.piece.y;
  step(s, 30);
  assert.ok(s.game.piece.y - y <= Math.ceil(MAX_DT / (s.cfg.speed / S)) + 1);
  step(s, NaN);
  step(s, -5);
  assert.equal(s.phase, 'play');
});

test('daily challenge: once a day, streak counts consecutive days', () => {
  let clock = Date.UTC(2026, 9, 15, 12);
  const storage = memStorage();
  const s = mk({ storage, now: () => clock });
  assert.ok(dailyReady(s));
  assert.ok(startDaily(s));
  assert.ok(s.daily);
  win(s);
  assert.equal(winScreen(s).title, 'Daily challenge cleared!');
  assert.equal(dailyReady(s), false);
  assert.equal(startDaily(s), false);
  next(s);
  assert.equal(s.daily, false);
  assert.equal(s.level, 1); // back to the campaign, no level skipped
  clock += 86400000;
  assert.ok(startDaily(s));
  win(s);
  assert.equal(s.store.get('mb_daily').streak, 2);
  clock += 3 * 86400000;
  assert.ok(startDaily(s));
  win(s);
  assert.equal(s.store.get('mb_daily').streak, 1);
});

test('a win is saved at once: quitting on the win screen or during the ad keeps it', () => {
  const storage = memStorage();
  const s = mk({ storage });
  start(s, 7);
  win(s);
  assert.equal(mk({ storage }).level, 8);
  start(s, 100);
  win(s);
  assert.equal(mk({ storage }).level, 1);
});

// BUG LOG #3 (fuzz seed 11000437, band d): a saved "null" crashed the daily challenge
// button, and wrong-typed saved numbers switched off ad pacing and loss counting.
test('regression: corrupt saves of every kind fall back to defaults', () => {
  for (const junk of ['null', '"x"', '[]', '{}', '-5', '1e999', '{', 'true']) {
    const storage = memStorage();
    for (const k of ['mb_level', 'mb_daily', 'mb_seen', 'mb_since_ad', 'mb_last_ad', 'mb_losses_6', 'mb_muted']) storage.setItem(k, junk);
    const s = mk({ storage });
    assert.ok(s.level >= 1 && s.level <= 100, junk);
    dailyReady(s);
    startDaily(s);
    winScreen(s);
    loseScreen(s);
    start(s, 6);
    win(s);
    next(s);
    assert.ok(s.store.get('mb_since_ad', 0) >= 0, junk);
  }
});

test('regression: a clock set backwards does not lock ads out forever', () => {
  let clock = Date.UTC(2026, 9, 15, 12);
  const storage = memStorage();
  storage.setItem('mb_last_ad', String(clock + 365 * 86400000));
  storage.setItem('mb_since_ad', '5');
  const s = mk({ storage, now: () => clock });
  start(s, 8);
  win(s);
  next(s);
  assert.ok(s.ad);
});

// BUG LOG #10 (code review): the daily challenge said "same level for everyone today"
// but dealt pieces from Math.random, so every player got a different game.
test('regression: the daily challenge deals the same pieces to everyone that day', () => {
  const deal = (seed, day) => {
    const s = mk({ rand: mulberry32(seed), now: () => Date.UTC(2026, 9, day, 12) });
    startDaily(s);
    const out = [];
    for (let i = 0; i < 12; i++) {
      out.push(s.game.piece.mats.join() + s.game.piece.cells.join());
      s.game.grid.forEach((row) => row.fill(null));
      input(s, 'slam');
    }
    return out.join('|');
  };
  assert.equal(deal(1, 15), deal(99, 15));
  assert.notEqual(deal(1, 15), deal(1, 16));
});

test('safeStore never throws', () => {
  const st = safeStore(blocked);
  st.set('a', 1);
  assert.equal(st.get('a', 0), 1);
  assert.equal(safeStore(null).get('x', 5), 5);
});

test('playtest log: each win and loss is recorded on this device with the rig measures', () => {
  const s = mk();
  run(s, 1);
  input(s, 'slam');
  run(s, 2);
  win(s);
  start(s, 9);
  s.game.drained = Math.floor(s.cfg.goal.pieces * 0.85) * PIECE;
  lose(s);
  const log = playLog(s);
  assert.equal(log.length, 2);
  assert.equal(log[0].result, 'win');
  assert.equal(log[0].level, 1);
  assert.ok(log[0].firstDrain !== null && log[0].time > 0);
  assert.equal(log[1].result, 'lose');
  assert.equal(log[1].reason, 'top');
  const sum = playLogSummary(log);
  assert.equal(sum.early.firstTry, 0.5);
  assert.equal(sum.closeLosses, 1);
  clearPlayLog(s);
  assert.equal(playLog(s).length, 0);
});

test('the first full meter explains the power, once ever', () => {
  const storage = memStorage();
  const s = mk({ storage });
  s.callout = null;
  s.game.meter = 1;
  run(s, 0.1);
  assert.match(s.callout.text, /SWIPE UP/);
  input(s, 'power');
  start(s, 2);
  s.callout = null;
  s.game.meter = 1;
  run(s, 0.1);
  assert.equal(s.callout, null);
});
