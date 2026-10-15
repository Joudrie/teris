// Scripted setups, one per mechanic test card (see DESIGN.md). Each scene builds a board,
// deals a piece, plays a few inputs and says what should happen. The same scenes run
// headless (test/cards.test.js, tools/cards.js) and in the browser with ?debug&scene=<id>
// for the 390x844 screenshots.
//
// Board blocks are in cell units with y counted from the top (0) to the bottom (19).

import {
  emptyGrid, placeBlock, SHAPES, S, PIECE, GW, GH, questCount,
} from './core.js';
import {
  start, input, step, openHome, watchRevive, watchMeterAd, next, startDaily,
} from './session.js';

const count = (g, m) => {
  let n = 0;
  for (const row of g.grid) for (const c of row) if (c && c.m === m) n++;
  return n;
};
const topOf = (g, m) => {
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g.grid[y][x]?.m === m) return y;
  return GH;
};

// Puts the session on a level with a clean, scripted board.
function stage(s, { level = 1, board = [], piece = null, next = null, meter = 0, keepStart = false, drained = 0 } = {}) {
  s.store.set('mb_seen', Array.from({ length: 100 }, (_, i) => i + 1)); // no callouts unless asked
  start(s, level);
  const g = s.game;
  if (!keepStart) g.grid = emptyGrid();
  for (const b of board) placeBlock(g, b);
  if (piece) {
    const mats = piece.mats.length === 1 ? Array(4).fill(piece.mats[0]) : piece.mats;
    g.piece = { m: mats[0], mats, cells: SHAPES[piece.shape ?? 1].map(([a, b]) => [a, b]), x: piece.x ?? 4, y: (piece.y ?? 0) * S };
  }
  if (next) {
    const mats = next.length === 1 ? Array(4).fill(next[0]) : next;
    g.next = { m: mats[0], shape: SHAPES[1], mats };
    g.queue = [];
  }
  g.meter = meter;
  g.drained = drained;
  return g;
}

const mats = (m) => [m];

export const SCENES = {
  // ---------- materials and reactions ----------
  douse: {
    title: 'Water puts out fire', kind: 'reaction',
    setup: (s) => stage(s, { board: [{ m: 'fire', x: 3, y: 18, w: 6, h: 2 }], piece: { mats: mats('water'), x: 5 } }),
    actions: ['slam'], wait: 1.5, watch: (g) => g.doused,
    check: (g) => g.doused >= PIECE / 2,
  },
  burn: {
    title: 'Fire burns a wood piece away', kind: 'reaction',
    setup: (s) => stage(s, { level: 3, board: [{ m: 'wood', x: 4, y: 18, w: 4, h: 2 }], piece: { mats: mats('fire'), shape: 0, x: 4 } }),
    actions: ['slam'], wait: 4, watch: (g) => g.burned,
    check: (g) => count(g, 'wood') === 0 && g.burned >= 2 * PIECE,
  },
  soak: {
    title: 'Water soaks wood, a second soak dissolves it', kind: 'reaction',
    setup: (s) => stage(s, { level: 3, board: [{ m: 'wood', x: 4, y: 18, w: 4, h: 2 }], piece: { mats: mats('water'), x: 4, shape: 0 }, next: ['water'] }),
    actions: ['slam', { wait: 1 }, 'slam'], wait: 2, watch: (g) => g.drained,
    check: (g) => count(g, 'wood') + count(g, 'wetwood') < 8 * 16,
  },
  wetwood: {
    title: 'Fire dries wet wood, then burns it', kind: 'reaction',
    setup: (s) => stage(s, { level: 3, board: [{ m: 'wetwood', x: 4, y: 18, w: 4, h: 2 }], piece: { mats: mats('fire'), shape: 0, x: 4 } }),
    actions: ['slam'], wait: 5, watch: (g) => g.burned,
    check: (g) => count(g, 'wetwood') + count(g, 'wood') === 0,
  },
  melt: {
    title: 'Fire melts ice into water', kind: 'reaction',
    setup: (s) => stage(s, { level: 7, board: [{ m: 'ice', x: 4, y: 18, w: 4, h: 2 }], piece: { mats: mats('fire'), shape: 0, x: 4 } }),
    actions: ['slam'], wait: 3, watch: (g) => g.melted,
    check: (g) => g.melted >= 2 * PIECE,
  },
  freeze: {
    title: 'Water touching ice freezes', kind: 'reaction',
    setup: (s) => stage(s, { level: 7, board: [{ m: 'ice', x: 0, y: 19, w: 12, h: 1 }], piece: { mats: mats('water'), x: 5 } }),
    actions: ['slam'], wait: 2, watch: (g) => count(g, 'ice'),
    check: (g) => count(g, 'ice') > 12 * 16 && count(g, 'water') < PIECE / 2,
  },
  mud: {
    title: 'Water turns sand to mud, mud sinks away', kind: 'reaction',
    setup: (s) => stage(s, { level: 4, board: [{ m: 'sand', x: 0, y: 17, w: 12, h: 3 }], piece: { mats: mats('water'), x: 5 } }),
    actions: ['slam'], wait: 6, watch: (g) => g.drained,
    check: (g) => g.drained >= PIECE && count(g, 'mud') === 0,
  },
  glassmelt: {
    title: 'Fire melts sand into one glass pane', kind: 'reaction',
    setup: (s) => stage(s, { level: 6, board: [{ m: 'sand', x: 3, y: 17, w: 6, h: 3 }], piece: { mats: mats('fire'), x: 5 } }),
    actions: ['slam'], wait: 1.5, watch: (g) => count(g, 'glass'),
    check: (g) => count(g, 'glass') >= 40,
  },
  slam: {
    title: 'Slamming a piece onto glass smashes the pane', kind: 'reaction',
    setup: (s) => stage(s, { level: 5, board: [{ m: 'glass', x: 3, y: 18, w: 6, h: 2 }], piece: { mats: mats('wood'), x: 5 } }),
    actions: ['slam'], wait: 1, watch: (g) => g.smashed,
    check: (g) => g.smashed === 1 && count(g, 'glass') === 0,
  },
  gentle: {
    title: 'Dragging a piece down onto glass does not smash it', kind: 'reaction',
    setup: (s) => stage(s, { level: 5, board: [{ m: 'glass', x: 3, y: 18, w: 6, h: 2 }], piece: { mats: mats('wood'), x: 5 } }),
    actions: Array(20).fill('soft'), wait: 1, watch: (g) => g.smashed,
    check: (g) => g.smashed === 0 && count(g, 'glass') === 12 * 16,
  },
  stone: {
    title: 'Stone smashes glass even when placed gently', kind: 'reaction',
    setup: (s) => stage(s, { level: 11, board: [{ m: 'glass', x: 3, y: 18, w: 6, h: 2 }], piece: { mats: mats('stone'), x: 5 } }),
    actions: Array(20).fill('soft'), wait: 1, watch: (g) => g.smashed,
    check: (g) => g.smashed === 1,
  },
  fall: {
    title: 'A block that falls a long way smashes glass', kind: 'reaction',
    setup: (s) => stage(s, { level: 5, board: [{ m: 'glass', x: 3, y: 19, w: 6, h: 1 }, { m: 'wood', x: 5, y: 8, w: 2, h: 2 }], piece: { mats: mats('water'), x: 0, shape: 1 } }),
    actions: [], wait: 2, watch: (g) => g.smashed,
    check: (g) => g.smashed === 1,
  },
  erode: {
    title: 'Water wears stone into sand, which turns to mud', kind: 'reaction',
    setup: (s) => stage(s, { level: 11, board: [{ m: 'stone', x: 4, y: 19, w: 4, h: 1 }], piece: { mats: mats('water'), x: 4, shape: 0 }, next: ['water'] }),
    actions: ['slam'], wait: 4, watch: (g) => count(g, 'stone'),
    check: (g) => count(g, 'stone') === 0,
  },
  brick: {
    title: 'Water wears brick into sand', kind: 'reaction',
    setup: (s) => stage(s, { level: 13, board: [{ m: 'brick', x: 4, y: 19, w: 4, h: 1 }], piece: { mats: mats('water'), x: 4, shape: 0 }, next: ['water'] }),
    actions: ['slam'], wait: 3, watch: (g) => count(g, 'brick'),
    check: (g) => count(g, 'brick') === 0,
  },
  firestays: {
    title: 'Fire never burns out on its own', kind: 'material',
    setup: (s) => stage(s, { board: [{ m: 'fire', x: 4, y: 18, w: 4, h: 2 }], piece: { mats: mats('fire'), x: 0 } }),
    actions: [], wait: 6, watch: (g) => count(g, 'fire'),
    check: (g) => count(g, 'fire') === 8 * 16,
  },

  // ---------- powers ----------
  rain: {
    title: 'Rainstorm puts out every fire', kind: 'power',
    setup: (s) => stage(s, { level: 1, meter: 1, board: [{ m: 'fire', x: 0, y: 18, w: 4, h: 2 }, { m: 'fire', x: 8, y: 17, w: 4, h: 3 }, { m: 'fire', x: 5, y: 19, w: 2, h: 1 }], piece: { mats: mats('water'), x: 4, y: 2 } }),
    actions: ['power'], wait: 1, watch: (g) => g.drained,
    check: (g) => count(g, 'fire') === 0 && g.powers === 1,
  },
  blaze: {
    title: 'Fire Mode burns every wood block', kind: 'power',
    setup: (s) => stage(s, { level: 10, meter: 1, keepStart: true, piece: { mats: mats('fire'), x: 4, y: 2 } }),
    actions: ['power'], wait: 1, watch: (g) => g.drained,
    check: (g) => count(g, 'wood') === 0 && g.powers === 1,
  },
  deepfreeze: {
    title: 'Deep Freeze clears all water and ice', kind: 'power',
    setup: (s) => stage(s, { level: 7, meter: 1, board: [{ m: 'water', x: 0, y: 16, w: 12, h: 4 }, { m: 'ice', x: 3, y: 14, w: 6, h: 2 }], piece: { mats: mats('fire'), x: 4, y: 2 } }),
    actions: ['power'], wait: 1, watch: (g) => g.drained,
    check: (g) => count(g, 'water') + count(g, 'ice') === 0,
  },
  sweep: {
    title: 'Sandstorm clears all sand and mud', kind: 'power',
    setup: (s) => stage(s, { level: 4, meter: 1, board: [{ m: 'sand', x: 0, y: 16, w: 12, h: 4 }], piece: { mats: mats('water'), x: 4, y: 2 } }),
    actions: ['power'], wait: 1, watch: (g) => g.drained,
    check: (g) => count(g, 'sand') + count(g, 'mud') === 0,
  },
  hammer: {
    title: 'Hammer clears glass, brick and stone', kind: 'power',
    setup: (s) => stage(s, { level: 15, meter: 1, keepStart: true, board: [{ m: 'stone', x: 0, y: 18, w: 3, h: 2 }, { m: 'brick', x: 9, y: 18, w: 3, h: 2 }], piece: { mats: mats('water'), x: 0, y: 2 } }),
    actions: ['power'], wait: 1, watch: (g) => g.drained,
    check: (g) => count(g, 'glass') + count(g, 'stone') + count(g, 'brick') === 0,
  },

  // ---------- modes ----------
  flood: {
    title: 'Flood: water rises from the bottom', kind: 'mode',
    setup: (s) => stage(s, { level: 12, piece: { mats: mats('fire'), x: 4 } }),
    actions: [], wait: 6, watch: (g) => count(g, 'water'),
    check: (g) => count(g, 'water') > 20,
  },
  wall: {
    title: 'Wall: burn through a prefilled wood wall', kind: 'mode',
    setup: (s) => stage(s, { level: 16, keepStart: true, piece: { mats: mats('fire'), shape: 0, x: 3 } }),
    actions: ['slam'], wait: 4, watch: (g) => g.burned,
    check: (g) => g.burned >= PIECE,
  },
  showcase: {
    title: 'Showcase: smash the glass tower', kind: 'mode',
    setup: (s) => stage(s, { level: 5, keepStart: true, piece: { mats: mats('wood'), x: 4 } }),
    actions: ['slam'], wait: 1.5, watch: (g) => g.smashed,
    check: (g) => g.smashed >= 1,
  },

  // ---------- pieces ----------
  rotate: {
    title: 'Tap to rotate, swipe to move, walls kick', kind: 'piece',
    setup: (s) => stage(s, { level: 2, piece: { mats: mats('fire'), shape: 0, x: 4, y: 4 } }),
    actions: ['rotate', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'rotate'], wait: 0.3, watch: (g) => (g.piece ? g.piece.x : -1),
    check: (g) => !!g.piece && g.piece.cells.every(([a]) => g.piece.x + a < 12) && g.piece.cells.some(([a]) => g.piece.x + a === 11),
  },
  mixed: {
    title: 'Two-material piece: each half acts on its own', kind: 'piece',
    setup: (s) => stage(s, { level: 8, board: [{ m: 'fire', x: 0, y: 19, w: 6, h: 1 }, { m: 'water', x: 6, y: 18, w: 6, h: 2 }], piece: { mats: ['wood', 'wood', 'sand', 'sand'], shape: 0, x: 4 } }),
    actions: ['slam'], wait: 3, watch: (g) => g.drained,
    check: (g) => g.burned > 0 && g.drained > PIECE,
  },
  ghost: {
    title: 'Ghost outline shows where the piece lands', kind: 'piece',
    setup: (s) => stage(s, { level: 3, board: [{ m: 'wood', x: 2, y: 16, w: 8, h: 4 }], piece: { mats: mats('fire'), x: 4, shape: 2, y: 2 } }),
    actions: [], wait: 0.2, watch: () => 0,
    check: (g) => !!g.piece,
  },

  // ---------- goal, combo, quest, meter ----------
  bar: {
    title: 'Drain bar fills as blocks cancel', kind: 'goal',
    setup: (s) => stage(s, { level: 1, board: [{ m: 'fire', x: 0, y: 18, w: 12, h: 2 }], piece: { mats: mats('water'), x: 4, shape: 0 } }),
    actions: ['slam'], wait: 1.5, watch: (g) => Math.floor(g.drained / PIECE),
    check: (g) => g.drained >= 2 * PIECE,
  },
  combo: {
    title: 'Draining fast builds a combo', kind: 'goal',
    setup: (s) => stage(s, { level: 1, board: [{ m: 'fire', x: 0, y: 17, w: 12, h: 3 }], piece: { mats: mats('water'), x: 4, shape: 0 }, next: ['water'] }),
    actions: ['slam', { wait: 0.4 }, 'slam'], wait: 1, watch: (g) => g.bestChain,
    check: (g) => g.bestChain >= 3,
  },
  quest: {
    title: 'Side quest done tops up the power meter', kind: 'goal',
    setup: (s) => {
      const g = stage(s, { level: 1, board: [{ m: 'fire', x: 0, y: 18, w: 12, h: 2 }], piece: { mats: mats('water'), x: 4, shape: 0 } });
      g.doused = 3 * PIECE + 10;
    },
    actions: ['slam'], wait: 1.5, watch: (g) => questCount(g),
    check: (g) => g.questDone && g.meter >= 0.35,
  },
  meter: {
    title: 'Full meter: swipe up to fire the power', kind: 'goal',
    setup: (s) => stage(s, { level: 3, meter: 1, board: [{ m: 'wood', x: 0, y: 16, w: 12, h: 4 }], piece: { mats: mats('fire'), x: 4, y: 2 } }),
    actions: [], wait: 0.3, watch: (g) => g.meter,
    check: (g) => g.meter === 1,
  },

  // ---------- screens ----------
  callout: {
    title: 'First-time callout on the board', kind: 'ui',
    setup: (s) => {
      s.store.set('mb_seen', []);
      start(s, 5);
    },
    actions: [], wait: 0.6, watch: (g, s) => (s.callout ? 1 : 0),
    check: (g, s) => !!s.callout,
  },
  win: {
    title: 'Win: celebration, then what is new next level', kind: 'ui',
    setup: (s) => stage(s, { level: 4, drained: 12 * PIECE + 40, board: [{ m: 'fire', x: 0, y: 18, w: 12, h: 2 }], piece: { mats: mats('water'), x: 4, shape: 0 } }),
    actions: ['slam'], wait: 3, watch: (g, s) => (s.phase === 'won' ? 1 : 0),
    check: (g, s) => s.phase === 'won',
  },
  lose: {
    title: 'Loss shows real progress and the one revive', kind: 'ui',
    setup: (s) => {
      const g = stage(s, { level: 9, drained: Math.floor(18 * 0.92) * PIECE + 5, board: [{ m: 'stone', x: 0, y: 2, w: 12, h: 18 }], piece: { mats: mats('stone'), x: 4, shape: 1, y: 0 } });
      for (let y = 0; y < 2 * S; y++) for (let x = 0; x < GW; x++) if (x < 4 * S || x >= 8 * S) g.grid[y][x] = null;
    },
    actions: ['slam'], wait: 0.5, watch: (g, s) => (s.phase === 'lost' ? 1 : 0),
    check: (g, s) => s.phase === 'lost',
  },
  revive: {
    title: 'Revive ad clears the top rows and play goes on', kind: 'ui',
    setup: (s) => {
      SCENES.lose.setup(s);
      input(s, 'slam');
      watchRevive(s);
    },
    actions: [], wait: 0.5, watch: (g, s) => (s.ad ? 1 : 0),
    check: (g, s) => !!s.ad && s.ad.kind === 'revive',
  },
  interstitial: {
    title: 'Interstitial between levels, paced', kind: 'ui',
    setup: (s) => {
      SCENES.win.setup(s);
      s.level = 7;
      s.store.set('mb_since_ad', 1);
      s.store.set('mb_last_ad', 0);
      input(s, 'slam');
      for (let i = 0; i < 40 && s.phase !== 'won'; i++) step(s, 0.1);
      next(s);
    },
    actions: [], wait: 0.5, watch: (g, s) => (s.ad ? 1 : 0),
    check: (g, s) => !!s.ad && s.ad.kind === 'interstitial',
  },
  meterad: {
    title: 'Meter at 80%: one optional ad fills it', kind: 'ui',
    setup: (s) => stage(s, { level: 3, meter: 0.85, board: [{ m: 'wood', x: 0, y: 17, w: 12, h: 3 }], piece: { mats: mats('fire'), x: 4, y: 3 } }),
    actions: [], wait: 0.3, watch: (g) => g.meter,
    check: (g, s) => !s.meterAdUsed && g.meter >= 0.8,
  },
  home: {
    title: 'Home screen: play, daily, how to play', kind: 'ui',
    setup: (s) => openHome(s),
    actions: [], wait: 0.2, watch: (g, s) => (s.home ? 1 : 0),
    check: (g, s) => s.home,
  },
  daily: {
    title: 'Daily challenge', kind: 'ui',
    setup: (s) => {
      s.store.set('mb_daily', {});
      startDaily(s);
    },
    actions: [], wait: 1, watch: (g, s) => (s.daily ? 1 : 0),
    check: (g, s) => s.daily,
  },
  help: {
    title: 'Helping hand after three losses', kind: 'ui',
    setup: (s) => {
      s.store.set('mb_losses_9', 3);
      s.store.set('mb_seen', Array.from({ length: 100 }, (_, i) => i + 1));
      start(s, 9);
    },
    actions: [], wait: 0.5, watch: (g) => (g.cfg.help ? 1 : 0),
    check: (g) => g.cfg.help && g.cfg.bag.filter((m) => m === 'fire').length === 4,
  },
};

// Plays a scene headless: setup, inputs, then `wait` seconds. Returns timing of the
// watched value so the card can say whether the effect is quick to read but visible.
export function playScene(s, id, dt = 1 / 30) {
  const sc = SCENES[id];
  sc.setup(s);
  const t0 = { v: sc.watch(s.game, s) };
  let t = 0;
  let first = null;
  let lastChange = null;
  const look = () => {
    const v = sc.watch(s.game, s);
    if (v !== t0.v) {
      if (first === null) first = t;
      lastChange = t;
      t0.v = v;
    }
  };
  const run = (secs) => {
    for (let k = 0; k < secs / dt - 1e-6; k++) {
      step(s, dt);
      t += dt;
      look();
    }
  };
  for (const a of sc.actions) {
    if (typeof a === 'object') run(a.wait);
    else { input(s, a); look(); }
  }
  run(sc.wait);
  return { ok: !!sc.check(s.game, s), first, last: lastChange, value: t0.v };
}
