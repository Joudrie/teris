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
  piecesDrained, TOTAL_LEVELS,
} from './core.js';
import { levelConfig, levelPreview, dailyConfig, POWERS } from './levels.js';

export const CELEBRATE_TIME = 2.2;
export const AD_TIME = 2; // seconds a placeholder ad stays up
export const CALLOUT_TIME = 4.5;
export const MAX_DT = 0.1; // a backgrounded tab must not fast-forward the game
const FREE_LEVELS = 5; // no interstitials before this level
const AD_EVERY = 2; // at most one interstitial every this many level starts
const AD_GAP_MS = 3 * 60 * 1000; // and never two within three minutes, across sessions

// Storage that never throws: if localStorage is blocked or wiped, the session keeps going
// on an in-memory copy.
export function safeStore(backing) {
  const mem = new Map();
  return {
    get(k, d) {
      try {
        const v = backing && backing.getItem(k);
        if (v !== null && v !== undefined) return JSON.parse(v);
      } catch (e) { /* blocked or corrupt */ }
      return mem.has(k) ? mem.get(k) : d;
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

const clampLevel = (l) => Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(Number(l)) || 1));

export function start(s, level, { daily = false } = {}) {
  s.daily = daily;
  let cfg;
  if (daily) {
    cfg = dailyConfig(dateKey(s.now()), s.level);
  } else {
    s.level = clampLevel(level);
    s.store.set('mb_level', s.level);
    const losses = s.store.get(`mb_losses_${s.level}`, 0);
    cfg = levelConfig(s.level, { help: losses >= 3 });
  }
  s.cfg = cfg;
  s.game = createGame({ level: daily ? cfg.level : s.level, rand: s.rand, config: cfg });
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
    afterGame(s);
  } else if (s.phase === 'celebrate') {
    s.celebrateT += dt;
    if (s.celebrateT >= CELEBRATE_TIME) s.phase = 'won';
  }
}

// Moves game events into the session queue and reacts to a win or a loss.
function afterGame(s) {
  const g = s.game;
  for (const e of g.events) s.events.push(e);
  g.events.length = 0;
  if (s.phase !== 'play') return;
  if (g.state === 'win') {
    s.phase = 'celebrate';
    s.celebrateT = 0;
    s.callout = null;
    if (s.daily) {
      const d = s.store.get('mb_daily', {});
      const today = dateKey(s.now());
      if (d.done !== today) {
        const yesterday = dateKey(s.now() - 86400000);
        s.store.set('mb_daily', { done: today, streak: d.done === yesterday ? (d.streak || 0) + 1 : 1 });
      }
    } else {
      s.store.set(`mb_losses_${s.level}`, 0);
      // Save the win now, so quitting on the win screen or during an ad keeps it.
      s.store.set('mb_level', s.level >= TOTAL_LEVELS ? 1 : s.level + 1);
      s.store.set('mb_best', Math.max(s.store.get('mb_best', 1), Math.min(TOTAL_LEVELS, s.level + 1)));
    }
    s.events.push({ type: 'win', drained: piecesDrained(g) });
  } else if (g.state === 'lose') {
    s.phase = 'lost';
    s.callout = null;
    if (!s.lossCounted && !s.daily) {
      s.lossCounted = true; // one loss per attempt, even if the revive also runs out
      s.store.set(`mb_losses_${s.level}`, s.store.get(`mb_losses_${s.level}`, 0) + 1);
    }
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
    sub: s.daily ? `Streak: ${s.store.get('mb_daily', {}).streak || 1} day(s)` : last ? 'All 100 levels cleared.' : `Down to ${100 - s.level} ft.`,
    next: s.daily ? `Back to level ${s.level}` : last ? 'Play again from the top' : `Next: level ${nextLevel}. ${levelPreview(nextLevel)}`,
    nextLabel: s.daily ? `Continue level ${s.level}` : last ? 'Play again' : `Play level ${nextLevel}`,
    dailyReady: dailyReady(s),
  };
}

export function loseScreen(s) {
  const pct = Math.floor(progress(s.game) * 100);
  return {
    pct,
    title: pct >= 80 ? `So close! ${pct}%` : `Topped out at ${pct}%`,
    sub: `${piecesDrained(s.game)} of ${s.game.cfg.goal.pieces} blocks drained.`,
    canRevive: !s.game.revived,
    help: !s.daily && s.store.get(`mb_losses_${s.level}`, 0) >= 3 && !s.cfg.help,
  };
}

export const dailyReady = (s) => s.store.get('mb_daily', {}).done !== dateKey(s.now());

// Next level from the win screen, with an interstitial when it's due.
export function next(s) {
  if (s.phase !== 'won' || s.ad) return false;
  const to = s.daily ? s.level : s.level >= TOTAL_LEVELS ? 1 : s.level + 1;
  const since = s.store.get('mb_since_ad', 0) + 1;
  const lastAd = s.store.get('mb_last_ad', 0);
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
    streak: s.store.get('mb_daily', {}).streak || 0,
    powers: POWERS,
  };
}
