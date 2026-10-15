// The game session around the rules: levels in order, win and lose screens, the one
// revive, ad pacing, the helping hand, first-time callouts and the daily challenge.
// No DOM, so the fuzzer can drive it exactly like a player and the view stays thin.
//
// phase:   'play'      the board is live (unless paused behind home, an ad, or a callout)
//          'celebrate' level cleared: the board shatters and the camera drops a foot
//          'won'       the win screen
//          'lost'      the lose screen

import {
  createGame, update, move, softDrop, hardDrop, rotate, activatePower, revive, progress,
  piecesDrained, TOTAL_LEVELS, REVIVE_PIECES,
} from './core.js';
import { levelConfig, levelPreview, dailyConfig, POWERS } from './levels.js';

export const CELEBRATE_TIME = 2.2;
export const AD_TIME = 2; // seconds a placeholder ad stays up
export const CALLOUT_TIME = 4.5;
export const MAX_DT = 0.1; // a backgrounded tab must not fast-forward the game
const FREE_LEVELS = 5; // no interstitials before this level
const AD_EVERY = 2; // at most one interstitial every this many level starts
const AD_GAP_MS = 3 * 60 * 1000; // and never two within three minutes, across sessions

// A saved value only counts if it has the same shape as its default: a corrupt or
// hand-edited save (null, a string where a number goes, Infinity) falls back to the default.
function sameShape(v, d) {
  if (d === undefined) return v !== undefined;
  if (Array.isArray(d)) return Array.isArray(v);
  if (v === null || typeof v !== typeof d) return false;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'object') return !Array.isArray(v);
  return true;
}

// Storage that never throws: if localStorage is blocked or wiped, the session keeps going
// on an in-memory copy.
export function safeStore(backing) {
  const mem = new Map();
  return {
    get(k, d) {
      try {
        const raw = backing && backing.getItem(k);
        if (raw !== null && raw !== undefined) {
          const v = JSON.parse(raw);
          if (sameShape(v, d)) return v;
        }
      } catch (e) { /* blocked or corrupt */ }
      return mem.has(k) && sameShape(mem.get(k), d) ? mem.get(k) : d;
    },
    set(k, v) {
      mem.set(k, v);
      try { if (backing) backing.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked or full */ }
    },
  };
}

export const dateKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function createSession({ storage = null, rand = Math.random, now = () => Date.now(), adsRemoved = () => false } = {}) {
  const store = safeStore(storage);
  const s = {
    store,
    rand,
    now,
    level: clampLevel(store.get('mb_level', 1)),
    daily: false,
    game: null,
    cfg: null,
    phase: 'play',
    home: false,
    ad: null, // { kind, left, placement }
    callout: null, // { text, left }
    celebrateT: 0,
    meterAdUsed: false,
    lossCounted: false,
    events: [], // for the view: sound and effects
    adsRemoved,
  };
  start(s, s.level);
  return s;
}

// Small seeded generator (mulberry32).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampLevel = (l) => Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(Number(l)) || 1));

export function start(s, level, { daily = false } = {}) {
  s.daily = daily;
  let cfg;
  if (daily) {
    cfg = dailyConfig(dateKey(s.now()), s.level);
  } else {
    s.level = clampLevel(level);
    s.store.set('mb_level', s.level);
    const losses = Math.max(0, s.store.get(`mb_losses_${s.level}`, 0));
    cfg = levelConfig(s.level, { help: losses >= 3 });
  }
  s.cfg = cfg;
  // The daily challenge deals the same pieces to everyone that day.
  s.game = createGame({ level: daily ? cfg.level : s.level, rand: daily ? seeded(cfg.seed) : s.rand, config: cfg });
  s.phase = 'play';
  s.ad = null;
  s.celebrateT = 0;
  s.meterAdUsed = false;
  s.lossCounted = false;
  s.callout = null;
  // First-time callout: once per lesson, even across sessions.
  if (cfg.intro && !daily) {
    const seen = s.store.get('mb_seen', []);
    const list = Array.isArray(seen) ? seen : [];
    if (!list.includes(s.level)) {
      s.callout = { text: cfg.intro, left: CALLOUT_TIME };
      s.store.set('mb_seen', [...list, s.level]);
    }
  }
  s.track = { t: 0, firstDrain: null, sinceDrain: 0, longestGap: 0, drained: 0, landed: false };
  s.events.push({ type: 'start', level: s.level, daily });
}

// The board takes input only while it's live and nothing is covering it.
export const live = (s) => s.phase === 'play' && !s.home && !s.ad && s.game.state === 'play';

const ACTIONS = {
  left: (g) => move(g, -1),
  right: (g) => move(g, 1),
  rotate: (g) => rotate(g),
  soft: (g) => softDrop(g),
  slam: (g) => hardDrop(g),
  power: (g) => activatePower(g),
};

export function input(s, action) {
  if (!live(s)) return false;
  const f = ACTIONS[action];
  if (!f) return false;
  if (s.callout && action !== 'power') s.callout.left = Math.min(s.callout.left, 1.2); // any play hurries it off
  const r = f(s.game);
  afterGame(s);
  return r !== false;
}

export function dismissCallout(s) {
  s.callout = null;
}

// Advances everything by real elapsed seconds.
export function step(s, dt) {
  dt = Math.min(MAX_DT, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (s.ad) {
    s.ad.left -= dt;
    if (s.ad.left <= 0) finishAd(s);
    return;
  }
  if (s.home) return;
  if (s.callout) {
    s.callout.left -= dt;
    if (s.callout.left <= 0) s.callout = null;
  }
  if (s.phase === 'play') {
    update(s.game, dt);
    trackPlay(s, dt);
    afterGame(s);
  } else if (s.phase === 'celebrate') {
    s.celebrateT += dt;
    if (s.celebrateT >= CELEBRATE_TIME) s.phase = 'won';
  }
}

// ---------- playtest log ----------
// The same numbers the rig measures, kept on this device only, so a real playtest can be
// compared with the bots. Nothing is sent anywhere. See ?playtest on the home screen.
const LOG_KEY = 'mb_log';
const LOG_MAX = 300;

function trackPlay(s, dt) {
  const k = s.track;
  const g = s.game;
  k.t += dt;
  if (g.drained > k.drained) {
    if (k.firstDrain === null) k.firstDrain = k.t;
    k.drained = g.drained;
    k.sinceDrain = 0;
  } else if (k.landed) {
    k.sinceDrain += dt;
    if (k.sinceDrain > k.longestGap) k.longestGap = k.sinceDrain;
  }
}

function logAttempt(s, result) {
  const g = s.game;
  const k = s.track;
  const entry = {
    at: s.now(),
    level: s.daily ? 'daily' : s.level,
    result,
    reason: g.loseReason || null,
    pct: Math.floor(progress(g) * 100),
    time: Math.round(k.t * 10) / 10,
    firstDrain: k.firstDrain === null ? null : Math.round(k.firstDrain * 10) / 10,
    longestGap: Math.round(k.longestGap * 10) / 10,
    powers: g.powers,
    revived: g.revived,
    help: !!g.cfg.help,
  };
  const log = s.store.get(LOG_KEY, []);
  log.push(entry);
  s.store.set(LOG_KEY, log.slice(-LOG_MAX));
}

export const playLog = (s) => s.store.get(LOG_KEY, []);
export const clearPlayLog = (s) => s.store.set(LOG_KEY, []);

// Summary of the log in the rig's terms: first-try wins by level band, close losses,
// gaps and powers, so a playtest can be laid next to the bot tables in DESIGN.md.
export function playLogSummary(log) {
  const firsts = new Map();
  for (const e of log) if (typeof e.level === 'number' && !firsts.has(e.level)) firsts.set(e.level, e);
  const band = (a, b) => {
    const xs = [...firsts.values()].filter((e) => e.level >= a && e.level <= b);
    return xs.length ? { n: xs.length, firstTry: xs.filter((e) => e.result === 'win' && !e.revived).length / xs.length } : null;
  };
  const losses = log.filter((e) => e.result === 'lose');
  const med = (xs) => { const v = xs.filter((x) => x !== null).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
  return {
    attempts: log.length,
    levels: firsts.size,
    early: band(1, 20),
    mid: band(21, 60),
    late: band(61, 100),
    closeLosses: losses.length ? losses.filter((e) => e.pct >= 80).length / losses.length : null,
    medianGap: med(log.map((e) => e.longestGap)),
    medianFirstDrain: med(log.map((e) => e.firstDrain)),
    powersPerAttempt: log.length ? log.reduce((t, e) => t + e.powers, 0) / log.length : null,
  };
}

// Moves game events into the session queue and reacts to a win or a loss.
function afterGame(s) {
  const g = s.game;
  for (const e of g.events) {
    if (e.type === 'land' && s.track) s.track.landed = true;
    s.events.push(e);
  }
  g.events.length = 0;
  if (s.phase !== 'play') return;
  // The first time a meter fills, say how to use it. Once ever.
  if (g.state === 'play' && g.meter >= 1 && !s.callout && !s.store.get('mb_seen_power', false)) {
    s.store.set('mb_seen_power', true);
    s.callout = { text: `${POWERS[g.cfg.power].label} ready! SWIPE UP to use it (or press F).`, left: CALLOUT_TIME };
    s.events.push({ type: 'callout' });
  }
  if (g.state === 'win') {
    s.phase = 'celebrate';
    s.celebrateT = 0;
    s.callout = null;
    if (s.daily) {
      const d = s.store.get('mb_daily', {});
      const today = dateKey(s.now());
      if (d.done !== today) {
        const yesterday = dateKey(s.now() - 86400000);
        s.store.set('mb_daily', { done: today, streak: d.done === yesterday ? streakOf(s) + 1 : 1 });
      }
    } else {
      s.store.set(`mb_losses_${s.level}`, 0);
      // Save the win now, so quitting on the win screen or during an ad keeps it.
      s.store.set('mb_level', s.level >= TOTAL_LEVELS ? 1 : s.level + 1);
      s.store.set('mb_best', Math.max(s.store.get('mb_best', 1), Math.min(TOTAL_LEVELS, s.level + 1)));
    }
    logAttempt(s, 'win');
    s.events.push({ type: 'win', drained: piecesDrained(g) });
  } else if (g.state === 'lose') {
    s.phase = 'lost';
    s.callout = null;
    if (!s.lossCounted && !s.daily) {
      s.lossCounted = true; // one loss per attempt, even if the revive also runs out
      s.store.set(`mb_losses_${s.level}`, Math.max(0, s.store.get(`mb_losses_${s.level}`, 0)) + 1);
    }
    logAttempt(s, 'lose');
    s.events.push({ type: 'lose', pct: Math.floor(progress(g) * 100) });
  }
}

// ---------- screens ----------

export function winScreen(s) {
  const last = !s.daily && s.level >= TOTAL_LEVELS;
  const nextLevel = last ? 1 : s.level + 1;
  return {
    title: s.daily ? 'Daily challenge cleared!' : last ? 'You reached the ground!' : 'Level cleared!',
    drained: piecesDrained(s.game),
    sub: s.daily ? `Streak: ${Math.max(1, streakOf(s))} day(s)` : last ? 'All 100 levels cleared.' : `Down to ${100 - s.level} ft.`,
    next: s.daily ? `Back to level ${s.level}` : last ? 'Play again from the top' : `Next: level ${nextLevel}. ${levelPreview(nextLevel)}`,
    nextLabel: s.daily ? `Continue level ${s.level}` : last ? 'Play again' : `Play level ${nextLevel}`,
    dailyReady: dailyReady(s),
  };
}

export function loseScreen(s) {
  const pct = Math.floor(progress(s.game) * 100);
  const outOfPieces = s.game.loseReason === 'pieces';
  return {
    pct,
    outOfPieces,
    title: pct >= 80 ? `So close! ${pct}%` : outOfPieces ? `Out of pieces at ${pct}%` : `Topped out at ${pct}%`,
    sub: `${piecesDrained(s.game)} of ${s.game.cfg.goal.pieces} blocks drained${outOfPieces ? ' before the pieces ran out' : ' before the board filled up'}.`,
    revive: outOfPieces ? `Watch ad: +${REVIVE_PIECES} pieces` : 'Watch ad: clear the top 4 rows',
    canRevive: !s.game.revived,
    help: !s.daily && s.store.get(`mb_losses_${s.level}`, 0) >= 3 && !s.cfg.help,
  };
}

const streakOf = (s) => {
  const n = s.store.get('mb_daily', {}).streak;
  return Number.isFinite(n) ? n : 0;
};

export const dailyReady = (s) => s.store.get('mb_daily', {}).done !== dateKey(s.now());

// Next level from the win screen, with an interstitial when it's due.
export function next(s) {
  if (s.phase !== 'won' || s.ad) return false;
  const to = s.daily ? s.level : s.level >= TOTAL_LEVELS ? 1 : s.level + 1;
  const since = Math.max(0, s.store.get('mb_since_ad', 0)) + 1;
  let lastAd = s.store.get('mb_last_ad', 0);
  if (lastAd > s.now()) lastAd = 0; // the clock went backwards: don't lock ads out forever
  const due = !s.daily && s.level >= FREE_LEVELS && since >= AD_EVERY && s.now() - lastAd >= AD_GAP_MS && !s.adsRemoved();
  if (due) {
    s.store.set('mb_since_ad', 0);
    s.store.set('mb_last_ad', s.now());
    s.ad = { kind: 'interstitial', left: AD_TIME, to };
    s.events.push({ type: 'ad', kind: 'interstitial' });
  } else {
    s.store.set('mb_since_ad', since);
    start(s, to);
  }
  return true;
}

export function replay(s) {
  if ((s.phase !== 'won' && s.phase !== 'lost') || s.ad) return false;
  start(s, s.level, { daily: s.daily });
  return true;
}

export function startDaily(s) {
  if (s.ad || !dailyReady(s)) return false;
  s.home = false;
  start(s, s.level, { daily: true });
  return true;
}

// Rewarded ads: the revive on the lose screen, and filling the meter once per level.
export function watchRevive(s) {
  if (s.phase !== 'lost' || s.ad || s.game.revived) return false;
  s.ad = { kind: 'revive', left: AD_TIME };
  s.events.push({ type: 'ad', kind: 'revive' });
  return true;
}

export function meterAdAvailable(s) {
  return live(s) && !s.meterAdUsed && s.game.meter >= 0.8 && s.game.meter < 1;
}

export function watchMeterAd(s) {
  if (!meterAdAvailable(s)) return false;
  s.meterAdUsed = true;
  s.ad = { kind: 'meter', left: AD_TIME };
  s.events.push({ type: 'ad', kind: 'meter' });
  return true;
}

function finishAd(s) {
  const ad = s.ad;
  s.ad = null;
  if (ad.kind === 'interstitial') start(s, ad.to);
  else if (ad.kind === 'revive') {
    if (s.phase === 'lost' && revive(s.game)) {
      s.phase = 'play';
      afterGame(s); // the revive may have topped out again at once
    }
  } else if (ad.kind === 'meter') {
    if (s.game.state === 'play') s.game.meter = 1;
  }
}

export function openHome(s) {
  s.home = true;
}

export function closeHome(s) {
  s.home = false;
}

export function homeInfo(s) {
  return {
    level: s.level,
    ft: 101 - s.level,
    dailyReady: dailyReady(s),
    streak: streakOf(s),
    powers: POWERS,
  };
}
