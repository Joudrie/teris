// Sand mode rules (no drawing). Pieces are one color of sand. A piece falls as a solid block;
// the moment it lands it breaks into grains that pour and slide. Any connected patch of one
// color that reaches from the left wall to the right wall clears (corners count as touching). Clear patches to score; the
// game ends when the sand reaches the top.
//
// The board is CW x CH cells of G x G grains. Everything is in grain units except piece
// shapes, which are in cells.

export const CW = 10;
export const CH = 18;
export const G = 6;
export const GW = CW * G;
export const GH = CH * G;

// Terracotta-style colors (Minecraft clay vibe): muted, earthy, still easy to tell apart.
export const COLORS = [
  { id: 'blue', name: 'Blue', base: [78, 109, 156] },
  { id: 'green', name: 'Green', base: [111, 138, 52] },
  { id: 'yellow', name: 'Yellow', base: [215, 154, 44] },
  { id: 'red', name: 'Red', base: [180, 71, 47] },
  { id: 'orange', name: 'Orange', base: [196, 103, 42] },
  { id: 'purple', name: 'Purple', base: [125, 74, 110] },
];

const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I
  [[0, 0], [1, 0], [0, 1], [1, 1]], // O
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T
  [[0, 0], [1, 0], [2, 0], [0, 1]], // L
  [[0, 0], [1, 0], [2, 0], [2, 1]], // J
  [[1, 0], [2, 0], [0, 1], [1, 1]], // S
  [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
];

export const LEVEL_POINTS = 1200; // points per level
export const colorsFor = (level) => (level >= 7 ? 6 : level >= 4 ? 5 : 4);
export const fallTime = (level) => Math.max(0.09, 0.55 - (level - 1) * 0.045); // seconds per cell

export function createSand({ rand = Math.random } = {}) {
  const s = {
    rand,
    // Per grain: 0 empty, else color index + 1. shade is a per-grain tint so sand looks grainy.
    cell: new Uint8Array(GW * GH),
    shade: new Uint8Array(GW * GH),
    flash: new Float32Array(GW * GH), // >0 while a cleared grain flashes before it goes
    piece: null,
    next: null,
    score: 0,
    cleared: 0,
    level: 1,
    chain: 0,
    chainT: 0,
    t: 0, // fall timer
    over: false,
    events: [],
    settle: 0, // ticks since anything moved
    tick: 0,
    soft: false, // soft drop held
  };
  s.next = randomPiece(s);
  spawn(s);
  return s;
}

function randomPiece(s) {
  const n = colorsFor(s.level);
  return { shape: SHAPES[Math.floor(s.rand() * SHAPES.length)].map((c) => [...c]), color: Math.floor(s.rand() * n) };
}

const idx = (x, y) => y * GW + x;

// A piece is at (x, y) in grains; its cells are G x G grain squares.
function fits(s, shape, x, y) {
  for (const [a, b] of shape) {
    const gx = x + a * G;
    const gy = y + b * G;
    if (gx < 0 || gx + G > GW || gy + G > GH) return false;
    for (let j = Math.max(0, gy); j < gy + G; j++) {
      const row = j * GW;
      for (let i = gx; i < gx + G; i++) if (s.cell[row + i]) return false;
    }
  }
  return true;
}

function spawn(s) {
  const p = s.next;
  s.next = randomPiece(s);
  const w = Math.max(...p.shape.map(([a]) => a)) + 1;
  p.x = Math.floor((CW - w) / 2) * G;
  p.y = -G;
  if (!fits(s, p.shape, p.x, 0)) { s.over = true; s.piece = null; s.events.push({ type: 'over' }); return; }
  s.piece = p;
  s.t = 0;
}

// The piece turns into sand where it stands.
function lock(s) {
  const p = s.piece;
  for (const [a, b] of p.shape) {
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const gx = p.x + a * G + i;
      const gy = p.y + b * G + j;
      if (gy < 0) { s.over = true; continue; }
      s.cell[idx(gx, gy)] = p.color + 1;
      s.shade[idx(gx, gy)] = Math.floor(s.rand() * 256);
    }
  }
  s.events.push({ type: 'land', color: p.color, x: p.x, y: p.y });
  s.piece = null;
  if (s.over) { s.events.push({ type: 'over' }); return; }
  spawn(s);
}

export function move(s, dx) {
  const p = s.piece;
  if (!p || s.over) return false;
  if (fits(s, p.shape, p.x + dx * G, Math.max(0, p.y))) { p.x += dx * G; return true; }
  return false;
}

export function rotate(s) {
  const p = s.piece;
  if (!p || s.over || p.shape.length === 4 && isO(p.shape)) return false;
  const h = Math.max(...p.shape.map(([, b]) => b));
  const turned = p.shape.map(([a, b]) => [h - b, a]);
  for (const k of [0, -1, 1, -2, 2]) {
    if (fits(s, turned, p.x + k * G, Math.max(0, p.y))) { p.shape = turned; p.x += k * G; return true; }
  }
  return false;
}
const isO = (shape) => shape.every(([a, b]) => a < 2 && b < 2);

export function drop(s) {
  const p = s.piece;
  if (!p || s.over) return 0;
  let n = 0;
  while (fits(s, p.shape, p.x, p.y + 1)) { p.y++; n++; }
  lock(s);
  return n;
}

// Where the piece would land, for the ghost.
export function landing(s) {
  const p = s.piece;
  if (!p) return null;
  let y = p.y;
  while (fits(s, p.shape, p.x, y + 1)) y++;
  return y;
}

// Grains fall straight down, or slide diagonally when blocked. Bottom-up, alternating the
// sweep direction each tick so piles don't lean one way.
function pour(s, flip) {
  const c = s.cell;
  let moved = 0;
  for (let y = GH - 2; y >= 0; y--) {
    const row = y * GW;
    for (let k = 0; k < GW; k++) {
      const x = flip ? GW - 1 - k : k;
      const i = row + x;
      const v = c[i];
      if (!v || s.flash[i] > 0) continue;
      const below = i + GW;
      if (!c[below]) { c[below] = v; s.shade[below] = s.shade[i]; c[i] = 0; moved++; continue; }
      const dir = s.rand() < 0.5 ? -1 : 1;
      for (const d of [dir, -dir]) {
        const nx = x + d;
        if (nx < 0 || nx >= GW) continue;
        if (!c[below + d] && !c[i + d]) { c[below + d] = v; s.shade[below + d] = s.shade[i]; c[i] = 0; moved++; break; }
      }
    }
  }
  return moved;
}

// A color patch connected from the left wall to the right wall clears. Grains touching only at
// a corner count as connected, so a diagonal staircase of one color is a fair bridge.
const seen = new Int32Array(GW * GH);
let stamp = 0;
const queue = new Int32Array(GW * GH);
function findBridges(s) {
  const c = s.cell;
  const out = [];
  stamp++;
  for (let y = 0; y < GH; y++) {
    const start = idx(0, y);
    const v = c[start];
    if (!v || seen[start] === stamp || s.flash[start] > 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = stamp;
    let right = false;
    while (head < tail) {
      const i = queue[head++];
      const x = i % GW;
      if (x === GW - 1) right = true;
      const l = x > 0, r = x < GW - 1;
      const nb = [l ? i - 1 : -1, r ? i + 1 : -1, i - GW, i + GW, l ? i - GW - 1 : -1, r ? i - GW + 1 : -1, l ? i + GW - 1 : -1, r ? i + GW + 1 : -1];
      for (const n of nb) {
        if (n < 0 || n >= GW * GH || seen[n] === stamp || c[n] !== v || s.flash[n] > 0) continue;
        seen[n] = stamp;
        queue[tail++] = n;
      }
    }
    if (right) out.push(queue.slice(0, tail));
  }
  return out;
}

const FLASH = 0.38; // seconds a cleared patch flashes before it goes

export function step(s, dt) {
  s.events.length = 0;
  if (s.over) return s.events;
  // Flashing patches finish and disappear.
  let flashing = false;
  for (let i = 0; i < s.flash.length; i++) {
    if (s.flash[i] > 0) {
      s.flash[i] -= dt;
      if (s.flash[i] <= 0) { s.flash[i] = 0; s.cell[i] = 0; }
      else flashing = true;
    }
  }
  // Sand pours (twice a frame at 60 fps, so it flows quickly but visibly).
  s.tick++;
  const moved = pour(s, s.tick & 1) + pour(s, (s.tick & 1) ^ 1);
  s.settle = moved ? 0 : s.settle + 1;
  // Check for bridges once the sand is mostly still.
  if (!flashing && moved < 40) {
    const bridges = findBridges(s);
    if (bridges.length) {
      let n = 0;
      for (const b of bridges) { for (const i of b) s.flash[i] = FLASH; n += b.length; }
      s.chain = s.chainT > 0 ? s.chain + 1 : 1;
      s.chainT = 2.5;
      const points = Math.round(n * (1 + (s.chain - 1) * 0.5));
      s.score += points;
      s.cleared += n;
      const lv = 1 + Math.floor(s.score / LEVEL_POINTS);
      if (lv > s.level) { s.level = lv; s.events.push({ type: 'level', level: lv }); }
      s.events.push({ type: 'clear', grains: n, points, chain: s.chain, color: s.cell[bridges[0][0]] - 1 });
    }
  }
  if (s.chainT > 0) s.chainT -= dt;
  // The piece falls one grain at a time.
  const p = s.piece;
  if (p) {
    s.t += dt;
    const per = fallTime(s.level) / G * (s.soft ? 0.12 : 1);
    while (s.t >= per && s.piece === p) {
      s.t -= per;
      if (fits(s, p.shape, p.x, p.y + 1)) p.y++;
      else { lock(s); break; }
    }
  }
  return s.events;
}

export const colorName = (i) => COLORS[i]?.name || '';
