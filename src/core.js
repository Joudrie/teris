// Material Blocks rules. Pixel simulation: every board cell is a 4x4 patch of particles.
// No DOM, so it runs under node:test.

import { levelConfig, POWERS } from './levels.js';

export const COLS = 12;
export const ROWS = 20;
export const S = 4; // particles per cell side
export const GW = COLS * S;
export const GH = ROWS * S;
export const TOTAL_LEVELS = 100;
export const TICK = 1 / 30;
export const PIECE = 4 * S * S; // particles in one four-cell piece: the unit of the drain bar
export const METER_POINTS = 1800; // drained particles (times combo) to fill the power meter
const MAX_MULT = 4; // combo multiplier cap
const COMBO_WINDOW = 1.0; // seconds of quiet before a combo ends
const QUEST_BONUS = 0.35; // meter charge for finishing the side quest
const SLAM_DROP = 3 * S; // falling this far onto glass smashes it
const SETTLE = 2.5; // after the last piece, seconds of quiet before the level is called
export const REVIVE_PIECES = 5; // the revive's extra pieces when the budget ran out

// Solid materials keep their piece together and move as one rigid block.
// Water and sand are loose particles; mud stays put.
const RIGID = new Set(['stone', 'ice', 'glass', 'brick', 'wood', 'wetwood', 'fire']);

// Seconds a particle must touch fire before it changes. A cell is 4 particles deep.
const BURN = { wood: 0.75, wetwood: 0.75, ice: 0.375, sand: 0.25 };
// Seconds a particle must touch water before it erodes into sand. Like burning, erosion
// passes through the rest of the piece, so a soaked stone crumbles into a heap of sand,
// which the next water turns to mud.
const ERODE = { brick: 0.6, stone: 1.2 };
const FREEZE_TIME = 0.75;
const WASH_TIME = 0.5; // seconds of water contact before mud washes away
// Reactions spread through a clump instead of stopping at the surface:
const HOT_TIME = 0.6; // fresh glass stays hot this long and melts the sand it touches
const GLASS_DEPTH = 2 * S; // how far a melt spreads from the fire, in particles
const MUD_WET = 2; // water turns sand into mud about half a cell deep
const MUD_LIFE = 1.2; // mud sinks away on its own after this many seconds

// The seven four-cell shapes as [x, y] cell offsets, y pointing down.
export const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];

const N4 = [[0, 1], [1, 0], [-1, 0], [0, -1]];

// Altitude is 101 - level: level 1 is 100 ft, level 100 is ground.
export const altitude = (level) => 101 - level;
export const fallSpeed = (level) => Math.max(0.12, 0.45 - level * 0.004); // seconds per cell
const speedOf = (g) => g.cfg.speed || fallSpeed(g.level);
const SPAWN_X = Math.floor((COLS - 4) / 2);

export function createGame({ level = 1, rand = Math.random, config = levelConfig(level) } = {}) {
  const g = {
    level,
    cfg: config,
    rand,
    grid: emptyGrid(),
    piece: null,
    next: null,
    state: 'play', // 'play' | 'win' | 'lose'
    drained: 0, // particles destroyed by reactions and powers: the level goal
    doused: 0, // fire particles put out by water
    burned: 0, // wood particles burned away
    melted: 0, // ice particles melted
    smashed: 0, // glass panes smashed
    powers: 0, // powers fired this level
    meter: Math.min(1, Math.max(0, config.meter || 0)), // 0..1, full fires the level's power
    combo: 0, // particles drained in the current combo
    comboTimer: 0,
    mult: 1,
    bestChain: 1,
    questDone: false,
    revived: false,
    slam: false,
    fallAcc: 0,
    tickAcc: 0,
    riseAcc: 0,
    nextId: 0,
    bag: [], // pieces left in the current shuffled bag
    queue: [...(config.first || [])], // set pieces dealt before the bag (a level's lesson)
    left: config.pieces || Infinity, // pieces still to come (the level's budget)
    settling: null, // seconds left to let reactions finish once the budget is spent
    loseReason: null, // 'top' (board filled) or 'pieces' (budget spent short of the goal)
    panes: new Map(), // fire block id -> id of the glass pane that fire is melting
    mask: new Uint8Array(GW * GH), // 1 where the falling piece covers a particle
    moved: new Uint8Array(GW * GH), // loose particles already moved this tick
    events: [], // drained by the renderer for effects
  };
  for (const b of config.start || []) placeBlock(g, b);
  g.next = makeNext(g);
  spawn(g);
  return g;
}

export function emptyGrid() {
  return Array.from({ length: GH }, () => Array(GW).fill(null));
}

export function part(g, m, id = ++g.nextId) {
  return { m, id, heat: 0, frz: 0, shade: g.rand() };
}

export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draws the next material from the shuffled bag, refilling it when empty.
export function drawMaterial(g) {
  if (!g.bag.length) g.bag = shuffle(g.cfg.bag, g.rand);
  return g.bag.pop();
}

// Some pieces are made of two materials (half and half), so how you rotate them decides
// what touches what. cfg.mixed is the chance of a two-material piece.
// The two halves never react with each other: a fire + water piece would just cancel itself
// on landing, which is free progress. Each half has to be placed against its own counter.
const REACTS = {
  fire: ['water', 'wood', 'ice', 'sand'],
  water: ['fire', 'sand', 'wood', 'ice'],
  wood: ['fire', 'water'],
  ice: ['fire', 'water'],
  sand: ['fire', 'water'],
};
export const reacts = (a, b) => (REACTS[a] || []).includes(b);

function makeNext(g) {
  const shape = SHAPES[Math.floor(g.rand() * SHAPES.length)];
  if (g.queue.length) {
    const q = g.queue.shift();
    const [a, b] = Array.isArray(q) ? q : [q, q];
    return { m: a, shape, mats: shape.map((_, i) => (i < 2 ? a : b)) };
  }
  const m = drawMaterial(g);
  let m2 = m;
  if (g.rand() < (g.cfg.mixed || 0)) {
    // Try a few draws for a partner that doesn't react; put rejects back in the bag.
    for (let tries = 0; tries < 3; tries++) {
      const pick = drawMaterial(g);
      if (pick !== m && !reacts(m, pick)) { m2 = pick; break; }
      g.bag.unshift(pick);
    }
  }
  return { m, shape, mats: shape.map((_, i) => (i < 2 ? m : m2)) };
}

// Material of each cell of a piece, in the same order as its cells.
export const pieceMats = (p) => p.mats || p.cells.map(() => p.m);

// A starting-board block in cell units (y from the top). Solid blocks are one piece each;
// sand and water are poured in loose.
export function placeBlock(g, { m, x, y, w, h }) {
  const id = ++g.nextId;
  for (let py = y * S; py < (y + h) * S; py++) {
    for (let px = x * S; px < (x + w) * S; px++) {
      if (px < 0 || px >= GW || py < 0 || py >= GH) continue;
      g.grid[py][px] = RIGID.has(m) ? part(g, m, id) : part(g, m);
    }
  }
}

function spawn(g) {
  if (g.left <= 0) {
    // Out of pieces: let what's on the board finish reacting, then call it.
    g.piece = null;
    g.settling = SETTLE;
    return;
  }
  g.left--;
  const { m, shape, mats } = g.next;
  g.next = makeNext(g);
  g.piece = { m, mats, cells: shape, x: SPAWN_X, y: 0 };
  g.slam = false;
  if (collide(g, shape, SPAWN_X, 0)) lose(g, 'top');
}

function lose(g, reason) {
  g.state = 'lose';
  g.loseReason = reason;
  g.piece = null;
  g.settling = null;
}

const inb = (x, y) => x >= 0 && x < GW && y >= 0 && y < GH;
const at = (g, x, y) => (inb(x, y) ? g.grid[y][x] : undefined);
const free = (g, x, y) => inb(x, y) && g.grid[y][x] === null && !g.mask[y * GW + x];

// Which of the four neighbours (index into N4) first has material m, or -1. A plain loop:
// this runs for most particles every tick.
function nb(g, x, y, m) {
  for (let k = 0; k < 4; k++) {
    const nx = x + N4[k][0];
    const ny = y + N4[k][1];
    if (nx >= 0 && nx < GW && ny >= 0 && ny < GH) {
      const c = g.grid[ny][nx];
      if (c !== null && c.m === m) return k;
    }
  }
  return -1;
}
const nextTo = (g, x, y, m) => nb(g, x, y, m) >= 0;

export function collide(g, cells, x, y) {
  for (const [a, b] of cells) {
    const cx = x + a;
    if (cx < 0 || cx >= COLS) return true;
    for (let fy = y + b * S; fy < y + b * S + S; fy++) {
      if (fy >= GH) return true;
      if (fy < 0) continue;
      for (let fx = cx * S; fx < cx * S + S; fx++) if (g.grid[fy][fx]) return true;
    }
  }
  return false;
}

const active = (g) => g.state === 'play' && !!g.piece;

export function move(g, dx) {
  if (!active(g)) return false;
  const p = g.piece;
  if (collide(g, p.cells, p.x + dx, p.y)) return false;
  p.x += dx;
  return true;
}

function stepDown(g) {
  const p = g.piece;
  if (collide(g, p.cells, p.x, p.y + 1)) return false;
  p.y++;
  return true;
}

// Soft drop: one cell down. Placing gently never smashes glass.
export function softDrop(g) {
  if (!active(g)) return;
  for (let i = 0; i < S; i++) if (!stepDown(g)) break;
  g.fallAcc = 0;
}

// Hard drop: slams the piece down, which smashes glass underneath.
export function hardDrop(g) {
  if (!active(g)) return;
  while (stepDown(g));
  g.slam = true;
  lock(g);
}

export function rotate(g) {
  if (!active(g)) return;
  const p = g.piece;
  const r = p.cells.map(([a, b]) => [-b, a]);
  const mx = Math.min(...r.map(([a]) => a));
  const my = Math.min(...r.map(([, b]) => b));
  const turned = r.map(([a, b]) => [a - mx, b - my]);
  for (const k of [0, -1, 1, -2, 2]) {
    if (!collide(g, turned, p.x + k, p.y)) {
      p.cells = turned;
      p.x += k;
      return;
    }
  }
}

export function landingY(g) {
  const p = g.piece;
  let y = p.y;
  while (!collide(g, p.cells, p.x, y + 1)) y++;
  return y;
}

function lock(g) {
  const { cells, x, y } = g.piece;
  const mats = pieceMats(g.piece);
  g.piece = null;
  const id = ++g.nextId; // one id per piece so solid pieces stay together
  let overflow = false;
  cells.forEach(([a, b], i) => {
    for (let fy = y + b * S; fy < y + b * S + S; fy++) {
      for (let fx = (x + a) * S; fx < (x + a) * S + S; fx++) {
        if (fy < 0) overflow = true;
        else g.grid[fy][fx] = part(g, mats[i], id);
      }
    }
  });
  if (overflow) return lose(g, 'top');
  g.events.push({ type: 'land', slam: g.slam, cells: cells.map(([a, b]) => [x + a, y + b]) });
  // A slam smashes glass underneath; stone shatters glass even when placed gently.
  for (const [i, [a, b]] of cells.entries()) {
    if (!g.slam && mats[i] !== 'stone') continue;
    const fy = y + b * S + S;
    for (let fx = (x + a) * S; fx < (x + a) * S + S; fx++) {
      const below = at(g, fx, fy);
      if (below && below.m === 'glass' && below.id !== id) shatter(g, fx, fy);
    }
  }
  checkGoal(g);
  if (g.state === 'play') spawn(g);
}

// Smashed glass drains away: every piece of the pane that was hit.
function shatter(g, x, y) {
  const id = g.grid[y][x].id;
  const cells = [];
  for (let cy = 0; cy < GH; cy++) {
    for (let cx = 0; cx < GW; cx++) {
      const c = g.grid[cy][cx];
      if (c && c.m === 'glass' && c.id === id) {
        g.grid[cy][cx] = null;
        cells.push([cx, cy]);
      }
    }
  }
  g.smashed++;
  drain(g, cells.length);
  g.events.push({ type: 'shatter', cells });
}

// Particles destroyed by a reaction drain away. Draining a lot quickly builds a combo,
// which charges the power meter faster.
function drain(g, n, charge = true) {
  g.drained += n;
  if (g.settling !== null) g.settling = SETTLE; // still reacting: keep waiting
  g.combo += n;
  g.comboTimer = COMBO_WINDOW;
  const mult = Math.min(MAX_MULT, 1 + Math.floor(g.combo / PIECE));
  if (mult > g.mult) {
    g.mult = mult;
    g.bestChain = Math.max(g.bestChain, mult);
    g.events.push({ type: 'combo', mult });
  }
  if (charge) g.meter = Math.min(1, g.meter + (n * g.mult) / (g.cfg.meterPoints || METER_POINTS));

  checkQuest(g);
}

// Side quest: one extra target per level. Done once, it tops up the power meter.
export function questCount(g) {
  const q = g.cfg.quest;
  if (!q) return 0;
  switch (q.type) {
    case 'chain': return g.bestChain;
    case 'douse': return Math.floor(g.doused / PIECE);
    case 'burn': return Math.floor(g.burned / PIECE);
    case 'melt': return Math.floor(g.melted / PIECE);
    case 'smash': return g.smashed;
    default: return 0;
  }
}

function checkQuest(g) {
  const q = g.cfg.quest;
  if (!q || g.questDone || questCount(g) < q.n) return;
  g.questDone = true;
  g.meter = Math.min(1, g.meter + QUEST_BONUS);
  g.events.push({ type: 'quest' });
}

// Whole pieces drained so far, and 0..1 progress toward the level goal.
export const piecesDrained = (g) => Math.floor(g.drained / PIECE);
export function progress(g) {
  return Math.min(1, piecesDrained(g) / g.cfg.goal.pieces);
}

function checkGoal(g) {
  if (g.state === 'play' && progress(g) >= 1) {
    g.state = 'win';
    g.piece = null;
  }
}

// Advances gravity and physics. Call every frame with real elapsed seconds.
export function update(g, dt) {
  if (g.state !== 'play') return;
  g.fallAcc += dt;
  const step = speedOf(g) / S;
  while (g.fallAcc >= step && g.state === 'play') {
    g.fallAcc -= step;
    if (g.piece && !stepDown(g)) lock(g);
  }
  g.tickAcc += dt;
  while (g.tickAcc >= TICK && g.state === 'play') {
    g.tickAcc -= TICK;
    tick(g, TICK);
  }
}

// One physics tick.
export function tick(g, dt) {
  g.comboTimer -= dt;
  if (g.comboTimer <= 0) {
    g.combo = 0;
    g.mult = 1;
  }
  pieceMask(g);
  if (g.cfg.mode === 'flood') flood(g, dt);
  react(g, dt);
  rigid(g);
  loose(g);
  checkGoal(g);
  if (g.state === 'play' && g.settling !== null) {
    g.settling -= dt;
    if (g.settling <= 0) lose(g, 'pieces');
  }
}

function pieceMask(g) {
  const mask = g.mask;
  mask.fill(0);
  const p = g.piece;
  if (!p) return;
  for (const [a, b] of p.cells) {
    for (let fy = p.y + b * S; fy < p.y + b * S + S; fy++) {
      if (fy < 0 || fy >= GH) continue;
      for (let fx = (p.x + a) * S; fx < (p.x + a) * S + S; fx++) if (fx >= 0 && fx < GW) mask[fy * GW + fx] = 1;
    }
  }
}

// Flood mode: water keeps rising in from the bottom.
function flood(g, dt) {
  g.riseAcc += dt;
  if (g.riseAcc < 0.25) return;
  g.riseAcc = 0;
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(g.rand() * GW);
    for (let y = GH - 1; y >= 0; y--) {
      if (free(g, x, y)) {
        g.grid[y][x] = part(g, 'water');
        break;
      }
    }
  }
}

// Id of a touching particle of the same material, so new particles join that block.
function joinId(g, x, y, m) {
  for (const [u, v] of N4) {
    const n = at(g, x + u, y + v);
    if (n && n.m === m) return n.id;
  }
  return ++g.nextId;
}

// What is melting this sand: 0 for fire, otherwise one more than the hot glass next to it.
// -1 when nothing hot is touching it or the melt has spread as far as it goes.
function meltDepth(g, x, y) {
  let best = -1;
  for (const [u, v] of N4) {
    const n = at(g, x + u, y + v);
    if (!n) continue;
    if (n.m === 'fire') return 0;
    if (n.m === 'glass' && n.hot > 0 && n.depth < GLASS_DEPTH && (best < 0 || n.depth + 1 < best)) best = n.depth + 1;
  }
  return best;
}

// Fresh glass joins every pane it touches, so glass melted from different sides is one pane.
function joinGlass(g, x, y, id) {
  for (const [u, v] of N4) {
    const n = at(g, x + u, y + v);
    if (!n || n.m !== 'glass' || n.id === id) continue;
    const old = n.id;
    const stack = [[x + u, y + v]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const c = at(g, cx, cy);
      if (!c || c.m !== 'glass' || c.id !== old) continue;
      c.id = id;
      for (const [a, b] of N4) stack.push([cx + a, cy + b]);
    }
  }
}

// Wood and ice that have caught keep going and pass the heat through their own piece,
// so fire against a piece eats the whole piece instead of one column.
const SAME_BURN = { wood: 'wood', wetwood: 'wood', ice: 'ice' };
function burningNeighbor(g, x, y, c) {
  const fam = SAME_BURN[c.m];
  for (let k = 0; k < 4; k++) {
    const n = at(g, x + N4[k][0], y + N4[k][1]);
    if (n && n.id === c.id && SAME_BURN[n.m] === fam && n.heat >= BURN[n.m] * 0.5) return true;
  }
  return false;
}

// A brick or stone particle next to one of its own piece that is well on the way to sand.
function crumbling(g, x, y, c, limit) {
  for (let k = 0; k < 4; k++) {
    const n = at(g, x + N4[k][0], y + N4[k][1]);
    if (n && n.id === c.id && n.m === c.m && n.heat >= limit * 0.2) return true;
  }
  return false;
}

function mud(g, wet) {
  return { ...part(g, 'mud'), wet, life: 0 };
}

// Fire, ice and water reactions. Fire never spreads and never burns out; only water puts it out.
function react(g, dt) {
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const c = g.grid[y][x];
      if (!c) continue;

      if (c.m === 'fire') {
        const k = nb(g, x, y, 'water');
        if (k >= 0) {
          const w = N4[k];
          // Fire and water cancel out: both drain away.
          g.grid[y + w[1]][x + w[0]] = null;
          g.grid[y][x] = null;
          g.doused++;
          drain(g, 2);
          g.events.push({ type: 'steam', x, y });
        }
        continue;
      }

      if (c.m === 'water') {
        if (nextTo(g, x, y, 'ice')) {
          c.frz += dt;
          if (c.frz >= FREEZE_TIME) g.grid[y][x] = part(g, 'ice', joinId(g, x, y, 'ice'));
        } else {
          c.frz = 0;
        }
        continue;
      }

      if (c.m === 'glass') {
        if (c.hot > 0) c.hot -= dt;
        continue;
      }

      if (c.m === 'mud') {
        // Fresh mud soaks into the sand it touches, so a splash turns a chunk to mud.
        if (c.wet > 0) {
          for (let k = 0; k < 4; k++) {
            const u = N4[k][0];
            const v = N4[k][1];
            const n = at(g, x + u, y + v);
            if (n && n.m === 'sand') g.grid[y + v][x + u] = mud(g, c.wet - 1);
          }
          c.wet = 0;
        }
        // Mud sinks away on its own.
        c.life = (c.life || 0) + dt;
        if (c.life >= MUD_LIFE) {
          g.grid[y][x] = null;
          drain(g, 1);
          continue;
        }
      }

      // Water washes mud away: both drain.
      if (c.m === 'mud') {
        const k = nb(g, x, y, 'water');
        if (k >= 0) {
          const w = N4[k];
          c.frz += dt;
          if (c.frz >= WASH_TIME) {
            g.grid[y + w[1]][x + w[0]] = null;
            g.grid[y][x] = null;
            drain(g, 2);
            continue;
          }
        } else {
          c.frz = 0;
        }
      }

      // Water wears brick and stone down into sand, and the wear spreads through the piece.
      const erode = ERODE[c.m];
      if (erode !== undefined) {
        if (!(c.heat > 0) && !nextTo(g, x, y, 'water') && !crumbling(g, x, y, c, erode)) continue;
        c.heat += dt;
        if (c.heat >= erode) {
          g.grid[y][x] = part(g, 'sand');
          g.events.push({ type: 'crumble', x, y });
        }
        continue;
      }

      const limit = BURN[c.m];
      if (limit === undefined) continue;
      let depth = -1;
      if (c.m === 'sand') depth = meltDepth(g, x, y);
      else if (nextTo(g, x, y, 'fire')) depth = 0;
      else if (SAME_BURN[c.m] && (c.heat > 0 || burningNeighbor(g, x, y, c))) depth = 0;
      if (depth < 0) {
        c.heat = 0;
        continue;
      }
      // Wet wood puffs steam on a steady beat while it dries.
      if (c.m === 'wetwood' && Math.floor((c.heat + dt) * 5) > Math.floor(c.heat * 5)) {
        g.events.push({ type: 'steam', x, y });
      }
      c.heat += dt;
      if (c.heat < limit) continue;
      c.heat = 0;
      switch (c.m) {
        case 'wood': // burns away
          g.grid[y][x] = null;
          g.burned++;
          drain(g, 1);
          g.events.push({ type: 'burn', x, y });
          break;
        case 'wetwood': // steams, then dries into wood, which then burns
          c.m = 'wood';
          c.heat = 0.001; // still alight
          break;
        case 'ice': // melts into water
          g.grid[y][x] = part(g, 'water');
          g.melted++;
          checkQuest(g);
          g.events.push({ type: 'steam', x, y });
          break;
        case 'sand': { // melts into hot glass, which melts the sand next to it: one pane
          // Glass melted by one fire is one pane, even on opposite sides of it.
          let paneId = joinId(g, x, y, 'glass');
          if (depth === 0) {
            const fire = N4.map(([u, v]) => at(g, x + u, y + v)).find((n) => n && n.m === 'fire');
            if (!g.panes.has(fire.id)) g.panes.set(fire.id, paneId);
            paneId = g.panes.get(fire.id);
          }
          const glass = part(g, 'glass', paneId);
          glass.hot = HOT_TIME;
          glass.depth = depth;
          g.grid[y][x] = glass;
          joinGlass(g, x, y, glass.id);
          break;
        }
        default:
          break;
      }
    }
  }
}

// Connected particles of the same piece and a solid material form one rigid block.
// Flat typed arrays instead of [x, y] pairs: this runs every tick over the whole board.
const SEEN = new Int32Array(GW * GH); // stamp of the pass that reached each particle
const OWN = new Int32Array(GW * GH); // stamp of the block that owns each particle
const CELLS = new Int32Array(GW * GH); // every block's particle indices, back to back
const STACK = new Int32Array(GW * GH);
const LIFT = new Array(GW * GH).fill(null);
let stamp = 0;

function rigidBlocks(g) {
  const pass = ++stamp;
  const blocks = [];
  let used = 0;
  for (let y = GH - 1; y >= 0; y--) {
    for (let x = 0; x < GW; x++) {
      const i0 = y * GW + x;
      const c = g.grid[y][x];
      if (c === null || SEEN[i0] === pass || !RIGID.has(c.m)) continue;
      const start = used;
      let sp = 0;
      STACK[sp++] = i0;
      SEEN[i0] = pass;
      let bottom = y;
      while (sp > 0) {
        const i = STACK[--sp];
        CELLS[used++] = i;
        const cx = i % GW;
        const cy = (i - cx) / GW;
        if (cy > bottom) bottom = cy;
        for (let k = 0; k < 4; k++) {
          const nx = cx + N4[k][0];
          const ny = cy + N4[k][1];
          if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue;
          const ni = ny * GW + nx;
          const n = g.grid[ny][nx];
          if (n !== null && SEEN[ni] !== pass && RIGID.has(n.m) && n.id === c.id) {
            SEEN[ni] = pass;
            STACK[sp++] = ni;
          }
        }
      }
      blocks.push({ id: c.id, start, len: used - start, bottom });
    }
  }
  blocks.sort((a, b) => b.bottom - a.bottom); // lowest first so stacks settle in one pass
  return blocks;
}

function rigid(g) {
  const grid = g.grid;
  for (const block of rigidBlocks(g)) {
    const { id } = block;
    // A block processed earlier this tick may have smashed part of this one; skip what's gone.
    const own = ++stamp;
    let n = 0;
    for (let k = block.start; k < block.start + block.len; k++) {
      const i = CELLS[k];
      const c = grid[(i / GW) | 0][i % GW];
      if (c !== null && c.id === id && RIGID.has(c.m)) {
        CELLS[block.start + n++] = i;
        OWN[i] = own;
      }
    }
    if (!n) continue;
    const s0 = block.start;
    const s1 = s0 + n;

    let falls = true;
    for (let k = s0; k < s1 && falls; k++) {
      const below = CELLS[k] + GW;
      if (below >= GW * GH) falls = false;
      else if (OWN[below] !== own && (grid[(below / GW) | 0][below % GW] !== null || g.mask[below])) falls = false;
    }
    if (falls) {
      // Lift the whole block, then set it down one row lower. Each particle remembers how
      // far it has fallen, so a piece that split in two tracks each half on its own, and
      // nothing is left behind when a block is destroyed.
      for (let k = s0; k < s1; k++) {
        const i = CELLS[k];
        const y = (i / GW) | 0;
        LIFT[k] = grid[y][i % GW];
        grid[y][i % GW] = null;
      }
      for (let k = s0; k < s1; k++) {
        const i = CELLS[k];
        const c = LIFT[k];
        LIFT[k] = null;
        c.fall = (c.fall || 0) + 1;
        grid[((i / GW) | 0) + 1][i % GW] = c;
      }
      continue;
    }

    // Just landed: a long fall smashes glass, and stone always does.
    let dropped = 0;
    let stone = false;
    for (let k = s0; k < s1; k++) {
      const i = CELLS[k];
      const c = grid[(i / GW) | 0][i % GW];
      if ((c.fall || 0) > dropped) dropped = c.fall;
      if (c.m === 'stone') stone = true;
    }
    if (dropped > 0) {
      for (let k = s0; k < s1; k++) {
        const i = CELLS[k];
        grid[(i / GW) | 0][i % GW].fall = 0;
      }
      if (dropped >= SLAM_DROP || stone) {
        for (let k = s0; k < s1; k++) {
          const i = CELLS[k];
          const x = i % GW;
          const y = (i - x) / GW;
          const b = at(g, x, y + 1);
          if (b && b.m === 'glass' && OWN[i + GW] !== own) shatter(g, x, y + 1);
        }
      }
    }
  }
}

function mv(g, moved, x, y, nx, ny) {
  g.grid[ny][nx] = g.grid[y][x];
  g.grid[y][x] = null;
  moved[ny * GW + nx] = 1;
}

// Water and sand, particle by particle, bottom-up.
function loose(g) {
  const moved = g.moved;
  moved.fill(0);
  const dir = g.rand() < 0.5 ? 1 : -1;
  for (let y = GH - 1; y >= 0; y--) {
    for (let k = 0; k < GW; k++) {
      const x = dir > 0 ? k : GW - 1 - k;
      const c = g.grid[y][x];
      if (!c || moved[y * GW + x]) continue;
      if (c.m === 'sand') sand(g, moved, x, y);
      else if (c.m === 'water') water(g, moved, x, y);
    }
  }
}

function sand(g, moved, x, y) {
  const below = at(g, x, y + 1);
  if (below && below.m === 'water') {
    // Sand and water pack down into one particle of mud; the sand drains.
    g.grid[y + 1][x] = mud(g, MUD_WET);
    g.grid[y][x] = null;
    drain(g, 1);
    return;
  }
  if (free(g, x, y + 1)) return mv(g, moved, x, y, x, y + 1);
  const s = g.rand() < 0.5 ? 1 : -1;
  for (const d of [s, -s]) {
    if (free(g, x + d, y + 1) && free(g, x + d, y)) return mv(g, moved, x, y, x + d, y + 1);
  }
}

function water(g, moved, x, y) {
  // Water soaks into wood; soaking wet wood again dissolves it.
  let n = null;
  for (let k = 0; k < 4 && !n; k++) {
    const c = at(g, x + N4[k][0], y + N4[k][1]);
    if (c && (c.m === 'wood' || c.m === 'wetwood')) n = [x + N4[k][0], y + N4[k][1]];
  }
  if (n) {
    const wood = g.grid[n[1]][n[0]];
    g.grid[y][x] = null;
    if (wood.m === 'wood') {
      wood.m = 'wetwood';
      drain(g, 1);
    } else {
      g.grid[n[1]][n[0]] = null;
      drain(g, 2);
    }
    return;
  }
  // Water touching sand from any side turns it to mud and is used up.
  const ks = nb(g, x, y, 'sand');
  const sandAt = ks >= 0 ? [x + N4[ks][0], y + N4[ks][1]] : null;
  if (sandAt) {
    g.grid[sandAt[1]][sandAt[0]] = mud(g, MUD_WET);
    g.grid[y][x] = null;
    drain(g, 1);
    return;
  }
  if (free(g, x, y + 1)) return mv(g, moved, x, y, x, y + 1);
  const s = g.rand() < 0.5 ? 1 : -1;
  for (const d of [s, -s]) {
    if (free(g, x + d, y)) return mv(g, moved, x, y, x + d, y);
  }
}

// Fires the level's power when the meter is full: every particle of its materials is cleared.
export function activatePower(g) {
  if (g.state !== 'play' || g.meter < 1) return false;
  g.meter = 0;
  g.powers++;
  const clears = new Set(POWERS[g.cfg.power].clears);
  const cells = [];
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const c = g.grid[y][x];
      if (c && clears.has(c.m)) {
        cells.push([x, y, c.m]);
        g.grid[y][x] = null;
      }
    }
  }
  drain(g, cells.length, false);
  g.events.push({ type: 'power', power: g.cfg.power, cells, points: cells.length });
  checkGoal(g);
  return true;
}

// One revive per level. Topped out: the top four rows are cleared. Out of pieces: five more.
export function revive(g) {
  if (g.state !== 'lose' || g.revived) return false;
  g.revived = true;
  if (g.loseReason === 'pieces') g.left += REVIVE_PIECES;
  else for (let y = 0; y < 4 * S; y++) g.grid[y].fill(null);
  g.state = 'play';
  g.loseReason = null;
  spawn(g);
  return true;
}

// Pieces the player still has, counting the one falling now.
export const piecesLeft = (g) => (g.left === Infinity ? Infinity : g.left + (g.piece ? 1 : 0));
