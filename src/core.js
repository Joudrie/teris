// Material Blocks rules. Pixel simulation: every board cell is a 4x4 patch of particles.
// No DOM, so it runs under node:test.

import { levelConfig, POWERS } from './levels.js';

export const COLS = 10;
export const ROWS = 15;
export const S = 4; // particles per cell side
export const GW = COLS * S;
export const GH = ROWS * S;
export const TOTAL_LEVELS = 100;
export const TICK = 1 / 30;
export const METER_POINTS = 300; // points to fill the power meter
const CHAIN_WINDOW = 1.0; // seconds between breaks that still count as a chain
const QUEST_BONUS = 0.35; // meter charge for finishing the side quest
const SLAM_DROP = 3 * S; // falling this far onto glass smashes it

// Solid materials keep their piece together and move as one rigid block.
// Water and sand are loose particles; mud stays put.
const RIGID = new Set(['stone', 'ice', 'glass', 'brick', 'wood', 'wetwood', 'fire']);
const FLOATS = new Set(['wood', 'wetwood']);

// Seconds a particle must touch fire before it changes. A cell is 4 particles deep.
const BURN = { wood: 0.75, wetwood: 0.75, ice: 0.375, sand: 0.5, mud: 0.75 };
const FREEZE_TIME = 0.75;

// The seven four-cell shapes as [x, y] cell offsets, y pointing down.
const SHAPES = [
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
export const fallSpeed = (level) => Math.max(0.15, 0.7 - level * 0.005); // seconds per cell

export function createGame({ level = 1, rand = Math.random, config = levelConfig(level) } = {}) {
  const g = {
    level,
    cfg: config,
    rand,
    grid: emptyGrid(),
    piece: null,
    next: null,
    state: 'play', // 'play' | 'win' | 'lose'
    score: 0,
    made: 0, // particles of the goal material made (make-material levels)
    meter: 0, // 0..1, full fires the level's power
    mult: 1,
    chainTimer: 0,
    breaks: 0,
    bestChain: 1,
    questDone: false,
    revived: false,
    slam: false,
    fallAcc: 0,
    tickAcc: 0,
    riseAcc: 0,
    nextId: 0,
    falls: new Map(), // rigid block id -> rows fallen without stopping
    mask: new Set(), // particles covered by the falling piece
    events: [], // drained by the renderer for effects
  };
  if (config.mode === 'prefill') prefill(g);
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

// Weighted pick. Weights are relative.
export function pickMaterial(pool, rand) {
  const entries = Object.entries(pool);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [m, w] of entries) {
    r -= w;
    if (r < 0) return m;
  }
  return entries[entries.length - 1][0];
}

function makeNext(g) {
  return { m: pickMaterial(g.cfg.pool, g.rand), shape: SHAPES[Math.floor(g.rand() * SHAPES.length)] };
}

// Bottom two rows of the main material with one gap column, one block per column.
function prefill(g) {
  const gap = Math.floor(g.rand() * COLS);
  for (let cx = 0; cx < COLS; cx++) {
    if (cx === gap) continue;
    const id = ++g.nextId;
    for (let y = GH - 2 * S; y < GH; y++) {
      for (let x = cx * S; x < cx * S + S; x++) g.grid[y][x] = part(g, g.cfg.main, id);
    }
  }
}

function spawn(g) {
  const { m, shape } = g.next;
  g.next = makeNext(g);
  g.piece = { m, cells: shape, x: 3, y: 0 };
  g.slam = false;
  if (collide(g, shape, 3, 0)) lose(g);
}

function lose(g) {
  g.state = 'lose';
  g.piece = null;
}

const inb = (x, y) => x >= 0 && x < GW && y >= 0 && y < GH;
const at = (g, x, y) => (inb(x, y) ? g.grid[y][x] : undefined);
const free = (g, x, y) => inb(x, y) && g.grid[y][x] === null && !g.mask.has(y * GW + x);
const nextTo = (g, x, y, m) => N4.some(([u, v]) => at(g, x + u, y + v)?.m === m);

function collide(g, cells, x, y) {
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
  const { m, cells, x, y } = g.piece;
  g.piece = null;
  const id = ++g.nextId; // one id per piece so solid pieces stay together
  let overflow = false;
  for (const [a, b] of cells) {
    for (let fy = y + b * S; fy < y + b * S + S; fy++) {
      for (let fx = (x + a) * S; fx < (x + a) * S + S; fx++) {
        if (fy < 0) overflow = true;
        else g.grid[fy][fx] = part(g, m, id);
      }
    }
  }
  if (overflow) return lose(g);
  // A slam smashes glass underneath; stone shatters glass even when placed gently.
  if (g.slam || m === 'stone') {
    for (const [a, b] of cells) {
      const fy = y + b * S + S;
      for (let fx = (x + a) * S; fx < (x + a) * S + S; fx++) {
        const below = at(g, fx, fy);
        if (below && below.m === 'glass' && below.id !== id) shatter(g, fx, fy);
      }
    }
  }
  checkGoal(g);
  if (g.state === 'play') spawn(g);
}

// Glass breaks back into loose sand: the whole connected pane that was hit.
function shatter(g, x, y) {
  const id = g.grid[y][x].id;
  const stack = [[x, y]];
  const cells = [];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const c = at(g, cx, cy);
    if (!c || c.m !== 'glass' || c.id !== id) continue;
    c.m = 'sand';
    cells.push([cx, cy]);
    for (const [u, v] of N4) stack.push([cx + u, cy + v]);
  }
  credit(g, 'shatter', cells.length);
  g.events.push({ type: 'shatter', cells });
}

function credit(g, key, n = 1) {
  const goal = g.cfg.goal;
  if (goal.type === 'make' && goal.m === key) g.made += n;
}

// 0..1 progress toward the level goal.
export function progress(g) {
  const goal = g.cfg.goal;
  if (goal.type === 'score') return Math.min(1, g.score / goal.target);
  return Math.min(1, Math.floor(g.made / (S * S)) / goal.cells);
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
  const step = fallSpeed(g.level) / S;
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
  g.chainTimer -= dt;
  if (g.chainTimer <= 0) g.mult = 1;
  g.mask = pieceMask(g);
  if (g.cfg.mode === 'flood') flood(g, dt);
  react(g, dt);
  rigid(g);
  loose(g);
  breaks(g);
  checkGoal(g);
}

function pieceMask(g) {
  const mask = new Set();
  const p = g.piece;
  if (!p) return mask;
  for (const [a, b] of p.cells) {
    for (let fy = p.y + b * S; fy < p.y + b * S + S; fy++) {
      if (fy < 0) continue;
      for (let fx = (p.x + a) * S; fx < (p.x + a) * S + S; fx++) mask.add(fy * GW + fx);
    }
  }
  return mask;
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

// Fire, ice and water reactions. Fire never spreads and never burns out; only water puts it out.
function react(g, dt) {
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const c = g.grid[y][x];
      if (!c) continue;

      if (c.m === 'fire') {
        const w = N4.find(([u, v]) => at(g, x + u, y + v)?.m === 'water');
        if (w) {
          g.grid[y + w[1]][x + w[0]] = null;
          g.grid[y][x] = null;
          g.events.push({ type: 'steam', x, y });
        }
        continue;
      }

      if (c.m === 'water') {
        if (nextTo(g, x, y, 'ice')) {
          c.frz += dt;
          if (c.frz >= FREEZE_TIME) {
            g.grid[y][x] = part(g, 'ice');
            credit(g, 'ice');
          }
        } else {
          c.frz = 0;
        }
        continue;
      }

      const limit = BURN[c.m];
      if (limit === undefined) continue;
      if (!nextTo(g, x, y, 'fire')) {
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
          g.events.push({ type: 'burn', x, y });
          break;
        case 'wetwood': // steams, then dries into wood, which then burns
          c.m = 'wood';
          break;
        case 'ice': // melts into water
          g.grid[y][x] = part(g, 'water');
          break;
        case 'sand': // melts into glass
          g.grid[y][x] = part(g, 'glass');
          credit(g, 'glass');
          break;
        case 'mud': // bakes into brick
          g.grid[y][x] = part(g, 'brick');
          break;
        default:
          break;
      }
    }
  }
}

// Connected particles of the same piece and a solid material form one rigid block.
function rigidBlocks(g) {
  const seen = new Uint8Array(GW * GH);
  const blocks = [];
  for (let y = GH - 1; y >= 0; y--) {
    for (let x = 0; x < GW; x++) {
      const c = g.grid[y][x];
      if (!c || seen[y * GW + x] || !RIGID.has(c.m)) continue;
      const cells = [];
      const stack = [[x, y]];
      seen[y * GW + x] = 1;
      let bottom = y;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        if (cy > bottom) bottom = cy;
        for (const [u, v] of N4) {
          const nx = cx + u;
          const ny = cy + v;
          const n = at(g, nx, ny);
          if (n && !seen[ny * GW + nx] && RIGID.has(n.m) && n.id === c.id) {
            seen[ny * GW + nx] = 1;
            stack.push([nx, ny]);
          }
        }
      }
      blocks.push({ id: c.id, cells, bottom });
    }
  }
  blocks.sort((a, b) => b.bottom - a.bottom); // lowest first so stacks settle in one pass
  return blocks;
}

function rigid(g) {
  for (const { id, cells } of rigidBlocks(g)) {
    const own = new Set(cells.map(([x, y]) => y * GW + x));
    const mine = (x, y) => own.has(y * GW + x);

    // Wood floats up through water when water covers its whole top.
    if (cells.every(([x, y]) => FLOATS.has(g.grid[y][x].m))) {
      const top = cells.filter(([x, y]) => !mine(x, y - 1));
      if (top.every(([x, y]) => at(g, x, y - 1)?.m === 'water' && !g.mask.has((y - 1) * GW + x))) {
        shift(g, cells, -1, mine);
        continue;
      }
    }

    if (cells.every(([x, y]) => mine(x, y + 1) || free(g, x, y + 1))) {
      shift(g, cells, 1, mine);
      g.falls.set(id, (g.falls.get(id) || 0) + 1);
      continue;
    }

    // Just landed: a long fall smashes glass, and stone always does.
    const dropped = g.falls.get(id) || 0;
    if (dropped > 0) {
      g.falls.delete(id);
      const stone = cells.some(([x, y]) => g.grid[y][x].m === 'stone');
      if (dropped >= SLAM_DROP || stone) {
        for (const [x, y] of cells) {
          const b = at(g, x, y + 1);
          if (b && b.m === 'glass' && !mine(x, y + 1)) shatter(g, x, y + 1);
        }
      }
    }
  }
}

// Moves a block one row. Whatever it displaces (water, when floating) drops into
// the cells it leaves behind, column by column.
function shift(g, cells, dy, mine) {
  const lifted = cells.map(([x, y]) => [x, y, g.grid[y][x]]);
  const displaced = new Map();
  for (const [x, y] of cells) {
    if (!mine(x, y + dy)) {
      if (!displaced.has(x)) displaced.set(x, []);
      displaced.get(x).push(g.grid[y + dy][x]);
    }
  }
  for (const [x, y] of cells) g.grid[y][x] = null;
  for (const [x, y, c] of lifted) g.grid[y + dy][x] = c;
  for (const [x, y] of cells) {
    if (!mine(x, y - dy)) {
      const list = displaced.get(x);
      if (list && list.length) g.grid[y][x] = list.shift();
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
  const moved = new Uint8Array(GW * GH);
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
    g.grid[y + 1][x] = part(g, 'mud');
    g.grid[y][x] = null;
    return;
  }
  if (free(g, x, y + 1)) return mv(g, moved, x, y, x, y + 1);
  const s = g.rand() < 0.5 ? 1 : -1;
  for (const d of [s, -s]) {
    if (free(g, x + d, y + 1) && free(g, x + d, y)) return mv(g, moved, x, y, x + d, y + 1);
  }
}

function water(g, moved, x, y) {
  const wood = N4.map(([u, v]) => at(g, x + u, y + v)).find((n) => n && n.m === 'wood');
  if (wood) {
    wood.m = 'wetwood';
    credit(g, 'wetwood');
    g.grid[y][x] = null;
    return;
  }
  if (free(g, x, y + 1)) return mv(g, moved, x, y, x, y + 1);
  const s = g.rand() < 0.5 ? 1 : -1;
  for (const d of [s, -s]) {
    if (free(g, x + d, y)) return mv(g, moved, x, y, x + d, y);
  }
}

// Same material connected from the left wall to the right wall breaks.
// Water never breaks this way; it has to be soaked up, frozen, mudded or powered away.
function breaks(g) {
  const seen = new Uint8Array(GW * GH);
  for (let y0 = 0; y0 < GH; y0++) {
    const c = g.grid[y0][0];
    if (!c || seen[y0 * GW] || c.m === 'water') continue;
    const cells = [];
    const stack = [[0, y0]];
    seen[y0 * GW] = 1;
    let right = false;
    while (stack.length) {
      const [x, y] = stack.pop();
      cells.push([x, y]);
      if (x === GW - 1) right = true;
      for (const [u, v] of N4) {
        const nx = x + u;
        const ny = y + v;
        const n = at(g, nx, ny);
        if (n && !seen[ny * GW + nx] && n.m === c.m) {
          seen[ny * GW + nx] = 1;
          stack.push([nx, ny]);
        }
      }
    }
    if (right) breakCells(g, cells, c.m);
  }
}

function breakCells(g, cells, m) {
  for (const [x, y] of cells) g.grid[y][x] = null;
  g.mult = g.chainTimer > 0 ? g.mult + 1 : 1;
  g.chainTimer = CHAIN_WINDOW;
  const points = cells.length * g.mult;
  g.score += points;
  g.meter = Math.min(1, g.meter + points / METER_POINTS);
  g.breaks++;
  g.bestChain = Math.max(g.bestChain, g.mult);
  g.events.push({ type: 'break', m, cells, points, mult: g.mult });

  const q = g.cfg.quest;
  if (!g.questDone && ((q.type === 'chain' && g.mult >= q.n) || (q.type === 'breaks' && g.breaks >= q.n))) {
    g.questDone = true;
    g.meter = Math.min(1, g.meter + QUEST_BONUS);
    g.events.push({ type: 'quest' });
  }
}

// Fires the level's power when the meter is full: every particle of its materials is cleared.
export function activatePower(g) {
  if (g.state !== 'play' || g.meter < 1) return false;
  g.meter = 0;
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
  const points = cells.length * 2;
  g.score += points;
  g.events.push({ type: 'power', power: g.cfg.power, cells, points });
  checkGoal(g);
  return true;
}

// One revive per level: clears the top four rows and play continues.
export function revive(g) {
  if (g.state !== 'lose' || g.revived) return false;
  g.revived = true;
  for (let y = 0; y < 4 * S; y++) g.grid[y].fill(null);
  g.state = 'play';
  spawn(g);
  return true;
}
