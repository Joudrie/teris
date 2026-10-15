// Level definitions.
//
// Levels 1-20 are written by hand and teach one idea at a time: each new material or
// mechanic gets its own level, set up so the player can't miss it, then the next level
// mixes it with what came before. From level 21 on, levels are generated from a
// difficulty number that rises in a sawtooth (harder, harder, breather, hardest, showcase).
//
// Every level has the same goal type (fill the drain bar) so the player always knows what
// winning means. What varies is the bag, the starting board, the mode, the quest and the
// power, and no two levels in a row share all of them.

export const POWERS = {
  rain: { label: 'Rainstorm', clears: ['fire'] },
  blaze: { label: 'Fire Mode', clears: ['wood', 'wetwood'] },
  freeze: { label: 'Deep Freeze', clears: ['water', 'ice'] },
  sweep: { label: 'Sandstorm', clears: ['sand', 'mud'] },
  hammer: { label: 'Hammer', clears: ['glass', 'brick', 'stone'] },
};

import { BUDGETS } from './budgets.js';

// ---------- target win rates ----------
// The sawtooth, as the share of casual players (the rig's human-ish bot) who should clear
// a level on the first try. tools/calibrate.js plays every level and sets its piece
// budget so that share comes out right; src/budgets.js is its output.
const HAND_TARGET = [null, 0.97, 0.96, 0.95, 0.85, 0.85, 0.75, 0.75, 0.8, 0.6, 0.8, 0.85, 0.6, 0.65, 0.85, 0.75, 0.55, 0.8, 0.5, 0.8, 0.7];
const SAW_TARGET = [0.55, 0.45, 0.72, 0.4, 0.62]; // harder, harder, breather, hardest, showcase
export function targetWinRate(level) {
  if (level < HAND_TARGET.length) return HAND_TARGET[level];
  const drift = Math.min(0.08, ((level - 21) / 80) * 0.08); // a little harder overall as you go
  return SAW_TARGET[(level - 1) % 5] - drift;
}

// ---------- starting boards ----------
// Blocks are in cell units, y counted from the top (0) to the bottom (19).
// Each block is one solid piece (one id) unless `each` splits it into cell-sized pieces.

const bed = (m, rows = 1, from = 0, to = 11) => ({ m, x: from, y: 20 - rows, w: to - from + 1, h: rows });

// One- or two-cell glass panes stacked into a tower.
function tower(x, w, floors, m = 'glass') {
  const out = [];
  for (let i = 0; i < floors; i++) out.push({ m, x, y: 19 - i, w, h: 1 });
  return out;
}

// Rows of a material with one gap column, one block per column so they read as planks.
function wall(m, rows, gap) {
  const out = [];
  for (let x = 0; x < 12; x++) if (x !== gap) out.push({ m, x, y: 20 - rows, w: 1, h: rows });
  return out;
}

// ---------- quests ----------

const QUEST_TEXT = {
  chain: (n) => `hit a ×${n} combo`,
  douse: (n) => `put out ${n} blocks of fire`,
  smash: (n) => `smash ${n} glass panes`,
  burn: (n) => `burn ${n} blocks of wood`,
  melt: (n) => `melt ${n} blocks of ice`,
};
export const questText = (q) => QUEST_TEXT[q.type](q.n);

// ---------- the hand-made levels ----------

const B = (o) => Object.entries(o).flatMap(([m, n]) => Array(n).fill(m));

// intro: the one-line callout shown on the board the first time the level is played.
// first: pieces dealt before the shuffled bag starts, so the lesson happens straight away.
// meter: starting power charge (showcases start part full so the big payoff arrives).
const HAND = [
  null,
  { // 1. Fire and water. A bed of fire is already burning and the first pieces are water,
    // so the first reaction happens wherever the piece lands.
    name: 'Put it out', power: 'rain', bag: B({ fire: 2, water: 2 }), goal: 15,
    start: [bed('fire', 1)], first: ['water', 'water'],
    intro: 'Drop WATER on the FIRE to put it out!', quest: { type: 'douse', n: 4 }, speed: 0.42,
  },
  { // 2. Same two materials, nothing pre-placed: now the player sets up their own reactions.
    name: 'Fire and water', power: 'rain', bag: B({ fire: 3, water: 3 }), goal: 18,
    start: [bed('fire', 1, 0, 3), bed('fire', 1, 8, 11)], first: ['fire'],
    quest: { type: 'chain', n: 2 }, speed: 0.48,
  },
  { // 3. Wood. A woodpile sits in the middle and the first piece is fire.
    name: 'Woodpile', power: 'blaze', bag: B({ fire: 2, water: 2, wood: 2 }), goal: 18,
    start: [{ m: 'wood', x: 4, y: 18, w: 4, h: 2 }], first: ['fire'],
    intro: 'New: WOOD. Put FIRE next to it and it burns away!', quest: { type: 'burn', n: 3 }, speed: 0.48,
  },
  { // 4. Sand. A dune and two water pieces: sand + water = mud, which sinks away.
    name: 'Dunes', power: 'sweep', bag: B({ fire: 1, water: 3, wood: 1, sand: 2 }), goal: 20,
    start: [{ m: 'sand', x: 0, y: 18, w: 12, h: 2, loose: true }], first: ['water', 'water'],
    intro: 'New: SAND. WATER turns it to mud, and mud sinks away!', quest: { type: 'chain', n: 3 }, speed: 0.46,
  },
  { // 5. SHOWCASE: a glass tower. Flicking a piece onto glass smashes the whole pane.
    name: 'Glass tower', power: 'hammer', bag: B({ fire: 2, water: 2, wood: 1, sand: 1, glass: 2 }), goal: 21,
    start: [...tower(4, 2, 6), ...tower(6, 2, 6)], first: ['wood'], showcase: true,
    intro: 'New: GLASS. Flick down to SLAM a piece and smash it!', quest: { type: 'smash', n: 6 }, speed: 0.46,
  },
  { // 6. Fire melts sand into glass: combine level 4 and 5.
    name: 'Glassworks', power: 'hammer', bag: B({ fire: 3, water: 2, wood: 1, sand: 2, glass: 1 }), goal: 22,
    start: [{ m: 'sand', x: 3, y: 17, w: 6, h: 3, loose: true }], first: ['fire'],
    intro: 'FIRE melts SAND into GLASS. Then slam it!', quest: { type: 'smash', n: 3 }, speed: 0.44,
  },
  { // 7. Ice. An ice block and a fire piece. Water touching ice freezes, which is the catch.
    name: 'Ice block', power: 'freeze', bag: B({ fire: 3, water: 2, wood: 1, sand: 1, ice: 2 }), goal: 22,
    start: [{ m: 'ice', x: 3, y: 18, w: 6, h: 2 }], first: ['fire'],
    intro: 'New: ICE. FIRE melts it. Water that touches ice freezes!', quest: { type: 'melt', n: 3 }, speed: 0.44,
  },
  { // 8. Two-material pieces. A fire bed so either half of the first piece has something to do.
    name: 'Halves', power: 'blaze', bag: B({ fire: 3, water: 3, wood: 2, sand: 1, ice: 1, glass: 1 }), goal: 22, mixed: 0.5,
    start: [bed('fire', 1, 0, 4), bed('water', 1, 7, 11)], first: [['wood', 'ice']],
    intro: 'New: TWO-MATERIAL pieces. Tap to turn them!', quest: { type: 'chain', n: 3 }, speed: 0.42,
  },
  { // 9. Everything so far, faster: the first real test.
    name: 'Mixed bag', power: 'freeze', bag: B({ fire: 3, water: 3, wood: 1, sand: 2, ice: 2, glass: 1 }), goal: 27, mixed: 0.35,
    quest: { type: 'douse', n: 5 }, speed: 0.4,
  },
  { // 10. SHOWCASE: a wood wall and a part-charged Fire Mode.
    name: 'Firebreak', power: 'blaze', bag: B({ fire: 3, water: 3, wood: 2, sand: 1, ice: 1 }), goal: 27, mixed: 0.25,
    start: wall('wood', 3, 5), meter: 0.6, showcase: true, first: ['fire'],
    intro: 'Fill the meter, then SWIPE UP for FIRE MODE!', quest: { type: 'burn', n: 8 }, speed: 0.42,
  },
  { // 11. Stone: heavy, smashes glass even when placed gently. Breather after the showcase.
    name: 'Stone', power: 'hammer', bag: B({ fire: 2, water: 3, wood: 1, sand: 1, glass: 2, stone: 1 }), goal: 22, mixed: 0.25,
    start: [...tower(2, 2, 3), ...tower(8, 2, 3)], first: ['stone'],
    intro: 'New: STONE. Heavy! It smashes glass. Water wears it down.', quest: { type: 'smash', n: 4 }, speed: 0.42,
  },
  { // 12. Flood mode.
    name: 'Flood', power: 'freeze', mode: 'flood', bag: B({ fire: 3, water: 1, wood: 2, sand: 2, ice: 1, stone: 1 }), goal: 26, mixed: 0.3,
    intro: 'FLOOD! Water keeps rising. Fire, sand and wood soak it up.', quest: { type: 'douse', n: 4 }, speed: 0.4,
  },
  { // 13. Brick: the hard block. Water wears it into sand.
    name: 'Brickworks', power: 'hammer', bag: B({ fire: 3, water: 3, wood: 1, sand: 1, ice: 1, glass: 1, brick: 1 }), goal: 27, mixed: 0.3,
    start: [{ m: 'brick', x: 2, y: 18, w: 8, h: 2 }], first: ['water', 'water'],
    intro: 'New: BRICK. WATER wears it down into sand.', quest: { type: 'chain', n: 3 }, speed: 0.4,
  },
  { // 14. Breather: wood theme, friendly bag.
    name: 'Kindling', power: 'blaze', bag: B({ fire: 3, water: 3, wood: 3, sand: 1, ice: 1 }), goal: 26, mixed: 0.3,
    quest: { type: 'burn', n: 6 }, speed: 0.4,
  },
  { // 15. SHOWCASE: a tall glass tower and stone to drop on it.
    name: 'Skyscraper', power: 'hammer', bag: B({ fire: 2, water: 3, wood: 1, sand: 1, glass: 2, stone: 2 }), goal: 30, mixed: 0.3,
    start: tower(5, 2, 9), first: ['stone'], meter: 0.4, showcase: true,
    intro: 'Drop STONE on the tower and watch it fall!', quest: { type: 'smash', n: 8 }, speed: 0.4,
  },
  { // 16. Burn through the wall (prefill mode).
    name: 'The wall', power: 'blaze', mode: 'prefill', bag: B({ fire: 3, water: 2, wood: 1, sand: 1, ice: 1, stone: 1 }), goal: 28, mixed: 0.35,
    start: wall('wood', 2, 2), quest: { type: 'burn', n: 6 }, speed: 0.38,
  },
  { // 17. Breather.
    name: 'Thaw', power: 'freeze', bag: B({ fire: 3, water: 3, wood: 1, sand: 1, ice: 2, glass: 1 }), goal: 27, mixed: 0.35,
    start: [{ m: 'ice', x: 0, y: 19, w: 4, h: 1 }, { m: 'ice', x: 8, y: 19, w: 4, h: 1 }],
    quest: { type: 'melt', n: 4 }, speed: 0.38,
  },
  { // 18. Flood with stone: harder.
    name: 'High water', power: 'freeze', mode: 'flood', bag: B({ fire: 3, water: 1, wood: 2, sand: 2, ice: 1, stone: 1, glass: 1 }), goal: 28, mixed: 0.4,
    quest: { type: 'douse', n: 5 }, speed: 0.37,
  },
  { // 19. Breather before the showcase.
    name: 'Sandbox', power: 'sweep', bag: B({ fire: 2, water: 4, wood: 1, sand: 3, ice: 1 }), goal: 27, mixed: 0.4,
    start: [{ m: 'sand', x: 0, y: 17, w: 3, h: 3, loose: true }, { m: 'sand', x: 9, y: 17, w: 3, h: 3, loose: true }],
    quest: { type: 'chain', n: 3 }, speed: 0.37,
  },
  { // 20. SHOWCASE: an ice wall and a part-charged Deep Freeze.
    name: 'Glacier', power: 'freeze', bag: B({ fire: 4, water: 2, wood: 1, sand: 1, ice: 2, stone: 1 }), goal: 32, mixed: 0.4,
    start: wall('ice', 3, 6), meter: 0.5, showcase: true, first: ['fire'],
    intro: 'A glacier! Melt it with fire, then DEEP FREEZE the water.', quest: { type: 'melt', n: 8 }, speed: 0.38,
  },
];
export const HAND_LEVELS = HAND.length - 1;

// ---------- generated levels (21 and up) ----------

const THEMES = [
  { main: 'wood', power: 'blaze', quest: 'burn' },
  { main: 'water', power: 'freeze', quest: 'douse' },
  { main: 'sand', power: 'sweep', quest: 'chain' },
  { main: 'glass', power: 'hammer', quest: 'smash' },
  { main: 'ice', power: 'freeze', quest: 'melt' },
];

// Sawtooth over each block of five: harder, harder, breather, hardest, showcase.
const SAW = [0.5, 1, -1, 1.5, 0];
export function difficulty(level) {
  if (level <= HAND_LEVELS) return level / 4;
  return 5 + (level - HAND_LEVELS) / 8 + SAW[(level - 1) % 5];
}

// Pieces come from a shuffled bag, like a deck of cards: every bag has a fixed mix, so
// there are no long streaks of one material. Fire is a tool, water is ammo, and stone and
// brick are the leftovers that clog a board. Harder means fewer tools and more leftovers.
export function buildBag(d, main) {
  const bag = { fire: d >= 9 ? 2 : 3, water: d >= 11 ? 2 : 3, wood: 1, sand: 1, ice: 1, glass: 1 };
  bag[main] = (bag[main] || 0) + 1;
  if (d >= 5) bag.stone = d >= 10 ? 2 : 1;
  if (d >= 7.5) bag.brick = 1;
  return B(bag);
}

function generated(level) {
  const d = difficulty(level);
  const theme = THEMES[(level - 1) % THEMES.length];
  const showcase = level % 5 === 0;
  const cfg = {
    name: `${theme.main[0].toUpperCase()}${theme.main.slice(1)} ${level}`,
    power: theme.power,
    main: theme.main,
    bag: buildBag(d, theme.main),
    goal: Math.round(24 + d * 1.6),
    mixed: Math.min(0.55, 0.35 + d * 0.015),
    speed: Math.max(0.16, 0.42 - d * 0.018),
    quest: { type: theme.quest, n: theme.quest === 'chain' ? (d > 9 ? 4 : 3) : Math.round(4 + d / 3) },
    mode: 'normal',
  };
  // Modes alternate on the wood and water themes so consecutive levels never match.
  if (theme.main === 'water' && level % 2 === 0) cfg.mode = 'flood';
  if (theme.main === 'wood' && level % 2 === 1) {
    cfg.mode = 'prefill';
    cfg.start = wall('wood', 2, level % 12);
  }
  if (showcase) {
    // Showcase: a big set piece and a part-charged power, so the payoff lands.
    cfg.showcase = true;
    cfg.meter = 0.5;
    cfg.name = `Showcase ${level}`;
    const set = {
      glass: () => [...tower(1, 2, 7), ...tower(9, 2, 7)],
      ice: () => wall('ice', 3, level % 12),
      wood: () => wall('wood', 3, level % 12),
      water: () => [bed('fire', 2, 0, 11)],
      sand: () => [{ m: 'sand', x: 0, y: 16, w: 12, h: 4, loose: true }],
    }[theme.main];
    cfg.start = set();
    cfg.mode = 'normal';
  }
  return cfg;
}

// Full config for a level. `help` is the helping hand after three losses in a row:
// one more fire and water in every bag and four more pieces, and the player is told.
export function levelConfig(level, { help = false } = {}) {
  const base = level <= HAND_LEVELS ? { ...HAND[level], main: mainOf(HAND[level]) } : generated(level);
  const bag = [...base.bag];
  if (help) bag.push('fire', 'water');
  // Piece budget: calibrated per level; the helping hand adds a few more.
  const budget = BUDGETS[level] || Math.ceil(base.goal * 1.3);
  return {
    mode: 'normal',
    mixed: 0,
    start: [],
    first: [],
    meter: 0,
    showcase: false,
    ...base,
    bag,
    help,
    goal: { pieces: base.goal },
    pieces: budget + (help ? 4 : 0),
  };
}

// The level's main material: the one there is most of (used for the theme colour).
function mainOf(l) {
  const t = {};
  for (const m of l.bag) t[m] = (t[m] || 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1])[0][0];
}

// What's new about a level, for the win screen's preview: its callout, or else its mode,
// or else its power.
export function levelPreview(level) {
  const c = levelConfig(level);
  if (c.intro) return c.intro;
  if (c.mode === 'flood') return 'Flood: the water keeps rising.';
  if (c.mode === 'prefill') return 'Burn through a wooden wall.';
  if (c.showcase) return 'Showcase level: big set piece, power half charged.';
  return `Power: ${POWERS[c.power].label}. Quest: ${questText(c.quest)}.`;
}

// Daily challenge: one generated level per calendar day, the same for everyone that day.
// Uses a level a little past the player's own so it stays a challenge.
export function dailyConfig(dateKey, playerLevel = 1) {
  let h = 2166136261;
  for (const ch of dateKey) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const level = HAND_LEVELS + 1 + (Math.abs(h) % 20) + Math.min(40, Math.floor(playerLevel / 2));
  const cfg = levelConfig(level);
  return { ...cfg, name: 'Daily challenge', daily: true, seed: Math.abs(h), level };
}
