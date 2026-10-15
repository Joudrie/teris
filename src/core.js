// Material Blocks rules: grid, pieces, materials, levels. No DOM, so it runs under node:test.

export const W = 10;
export const H = 15;
export const TOTAL_LEVELS = 100;
export const PHYS_STEP = 0.12;

// Piece materials and their relative spawn weights.
const WEIGHTS = { water: 30, wood: 20, ice: 15, sand: 15, stone: 20, glass: 5, brick: 5, fire: 5 };

// Solid materials keep their piece together and fall as one rigid block.
// Water and sand flow cell by cell; mud stays put.
const RIGID = new Set(['stone', 'ice', 'glass', 'brick', 'wood', 'wetwood', 'fire']);
const FLOATS = new Set(['wood', 'wetwood']);

// The seven standard tetrominoes as [x, y] offsets, y pointing down.
const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I
  [[0, 0], [1, 0], [0, 1], [1, 1]], // O
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T
  [[1, 0], [2, 0], [0, 1], [1, 1]], // S
  [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
  [[0, 0], [0, 1], [1, 1], [2, 1]], // J
  [[2, 0], [0, 1], [1, 1], [2, 1]], // L
];

const N4 = [[0, 1], [1, 0], [-1, 0], [0, -1]];

// Altitude is 101 - level: level 1 is 100 ft, level 100 is ground.
export const altitude = (level) => 101 - level;
export const fallSpeed = (level) => Math.max(0.15, 0.7 - level * 0.005);
export const targetLines = (level) => 3 + Math.floor(level / 10);
export const evapTime = (level) => Math.max(4, 12 - (level - 1) * 0.08);

export function createGame({ level = 1, rand = Math.random } = {}) {
  const g = {
    level,
    rand,
    grid: emptyGrid(),
    piece: null,
    next: makeNext(rand),
    lines: 0,
    state: 'play', // 'play' | 'win' | 'lose'
    fallAcc: 0,
    physAcc: 0,
    nextId: 0,
  };
  spawn(g);
  return g;
}

export function emptyGrid() {
  return Array.from({ length: H }, () => Array(W).fill(null));
}

const newCell = (g, m) => ({ m, frz: 0, heat: 0, id: ++g.nextId });

// Weighted pick. Weights are relative, so they don't need to sum to 100.
export function pickMaterial(rand) {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const m of Object.keys(WEIGHTS)) {
    r -= WEIGHTS[m];
    if (r < 0) return m;
  }
  return 'stone';
}

function makeNext(rand) {
  return { m: pickMaterial(rand), shape: SHAPES[Math.floor(rand() * SHAPES.length)] };
}

function spawn(g) {
  const { m, shape } = g.next;
  g.next = makeNext(g.rand);
  g.piece = { m, cells: shape, x: 3, y: 0 };
  if (collide(g, shape, 3, 0)) lose(g);
}

function lose(g) {
  g.state = 'lose';
  g.piece = null;
}

function collide(g, cells, x, y) {
  return cells.some(([a, b]) => {
    const nx = x + a;
    const ny = y + b;
    return nx < 0 || nx >= W || ny >= H || (ny >= 0 && g.grid[ny][nx] !== null);
  });
}

export function move(g, dx, dy) {
  if (g.state !== 'play' || !g.piece) return false;
  const p = g.piece;
  if (collide(g, p.cells, p.x + dx, p.y + dy)) return false;
  p.x += dx;
  p.y += dy;
  return true;
}

export function softDrop(g) {
  if (move(g, 0, 1)) g.fallAcc = 0;
}

function drop(g) {
  if (g.piece && !move(g, 0, 1)) lock(g);
}

export function hardDrop(g) {
  if (g.state !== 'play' || !g.piece) return;
  while (move(g, 0, 1));
  lock(g);
}

export function rotate(g) {
  if (g.state !== 'play' || !g.piece) return;
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
  const id = ++g.nextId; // all four cells share an id so solid pieces stay together
  let overflow = false;
  for (const [a, b] of cells) {
    const cy = y + b;
    if (cy < 0) overflow = true;
    else g.grid[cy][x + a] = { m, frz: 0, heat: 0, id };
  }
  if (overflow) return lose(g);
  resolveRows(g);
  if (g.state === 'play') spawn(g);
}

// Tetris-style: any full row clears whatever it is made of, and rows above drop down.
function resolveRows(g) {
  const kept = g.grid.filter((row) => row.some((c) => c === null));
  const cleared = H - kept.length;
  if (!cleared) return;
  while (kept.length < H) kept.unshift(Array(W).fill(null));
  g.grid = kept;
  g.lines += cleared;
  if (g.lines >= targetLines(g.level)) g.state = 'win';
}

// Advances gravity and material physics. Call every frame with real elapsed seconds.
export function update(g, dt) {
  if (g.state !== 'play') return;
  g.fallAcc += dt;
  g.physAcc += dt;
  if (g.fallAcc >= fallSpeed(g.level)) {
    g.fallAcc = 0;
    drop(g);
  }
  if (g.physAcc >= PHYS_STEP) {
    const step = g.physAcc;
    g.physAcc = 0;
    physics(g, step);
  }
}

const at = (g, x, y) => (x >= 0 && x < W && y >= 0 && y < H ? g.grid[y][x] : undefined);

const nextToFire = (g, x, y) => N4.some(([u, v]) => at(g, x + u, y + v)?.m === 'fire');

// One physics tick: fire heats its neighbours, solid blocks move as whole pieces,
// then water and sand flow cell by cell.
export function physics(g, dt) {
  burn(g, dt);
  rigid(g);
  loose(g, dt);
  resolveRows(g);
}

// Fire blocks never spread. They only change the cells touching them.
function burn(g, dt) {
  const evap = evapTime(g.level);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g.grid[y][x];
      if (!c || c.m === 'fire') continue;
      if (!nextToFire(g, x, y)) {
        c.heat = 0;
        continue;
      }
      c.heat += dt;
      switch (c.m) {
        case 'water': // evaporates after a few seconds
          if (c.heat >= evap) g.grid[y][x] = null;
          break;
        case 'wood': // burns away
          if (c.heat >= 3) g.grid[y][x] = null;
          break;
        case 'wetwood': // holds the fire off longer, then dries into wood and burns
          if (c.heat >= evap * 1.8) { c.m = 'wood'; c.heat = 0; }
          break;
        case 'ice': // melts into water
          if (c.heat >= 1.5) { c.m = 'water'; c.heat = 0; c.frz = 0; }
          break;
        case 'sand': // melts into glass
          if (c.heat >= 2) { c.m = 'glass'; c.heat = 0; }
          break;
        case 'mud': // bakes into brick
          if (c.heat >= 3) { c.m = 'brick'; c.heat = 0; }
          break;
        default: // stone, glass, brick: no reaction
          break;
      }
    }
  }
}

// Connected cells of the same piece and a solid material form one block.
function rigidGroups(g) {
  const seen = emptyGrid();
  const groups = [];
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      const c = g.grid[y][x];
      if (!c || seen[y][x] || !RIGID.has(c.m)) continue;
      const cells = [];
      const stack = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        for (const [u, v] of N4) {
          const nx = cx + u;
          const ny = cy + v;
          const n = at(g, nx, ny);
          if (n && !seen[ny][nx] && RIGID.has(n.m) && n.id === c.id) {
            seen[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
      groups.push(cells);
    }
  }
  // Lowest blocks first so a stack settles in one pass.
  groups.sort((a, b) => Math.max(...b.map(([, y]) => y)) - Math.max(...a.map(([, y]) => y)));
  return groups;
}

function rigid(g) {
  for (const cells of rigidGroups(g)) {
    const inGroup = new Set(cells.map(([x, y]) => `${x},${y}`));
    const mine = (x, y) => inGroup.has(`${x},${y}`);

    // Stone landing on glass shatters it back into sand.
    for (const [x, y] of cells) {
      const b = at(g, x, y + 1);
      if (g.grid[y][x].m === 'stone' && b && b.m === 'glass' && !mine(x, y + 1)) b.m = 'sand';
    }

    // Wood floats up through water when every cell above the block is water.
    if (cells.every(([x, y]) => FLOATS.has(g.grid[y][x].m))) {
      const above = cells.filter(([x, y]) => !mine(x, y - 1)).map(([x, y]) => [x, y - 1]);
      if (above.every(([x, y]) => at(g, x, y)?.m === 'water')) {
        shift(g, cells, -1, mine);
        continue;
      }
    }

    // Falls as one piece when nothing outside the block is directly underneath.
    if (cells.every(([x, y]) => mine(x, y + 1) || at(g, x, y + 1) === null)) {
      shift(g, cells, 1, mine);
    }
  }
}

// Moves a block one row up or down. Whatever it displaces (water when floating)
// drops into the cells it leaves behind, column by column.
function shift(g, cells, dy, mine) {
  const lifted = cells.map(([x, y]) => [x, y, g.grid[y][x]]);
  const displaced = new Map(); // column -> displaced cells
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
  moved[ny][nx] = true;
}

function fall(g, moved, x, y) {
  if (at(g, x, y + 1) === null) {
    mv(g, moved, x, y, x, y + 1);
    return true;
  }
  return false;
}

// Water and sand, cell by cell, bottom-up. `moved` stops a cell from acting twice.
function loose(g, dt) {
  const moved = emptyGrid();
  const dir = g.rand() < 0.5 ? 1 : -1;
  for (let y = H - 1; y >= 0; y--) {
    for (let k = 0; k < W; k++) {
      const x = dir > 0 ? k : W - 1 - k;
      const c = g.grid[y][x];
      if (!c || moved[y][x]) continue;
      if (c.m === 'sand') sand(g, moved, x, y);
      else if (c.m === 'water') water(g, moved, x, y, c, dt);
    }
  }
}

function sand(g, moved, x, y) {
  const below = at(g, x, y + 1);
  if (below && below.m === 'water') {
    g.grid[y + 1][x] = newCell(g, 'mud');
    g.grid[y][x] = null;
    return;
  }
  if (fall(g, moved, x, y)) return;
  const s = g.rand() < 0.5 ? 1 : -1;
  for (const d of [s, -s]) {
    if (at(g, x + d, y + 1) === null && at(g, x + d, y) === null) {
      mv(g, moved, x, y, x + d, y + 1);
      return;
    }
  }
}

function water(g, moved, x, y, c, dt) {
  const wood = N4.map(([u, v]) => at(g, x + u, y + v)).find((n) => n && n.m === 'wood');
  if (wood) {
    wood.m = 'wetwood';
    g.grid[y][x] = null;
    return;
  }
  if (N4.some(([u, v]) => at(g, x + u, y + v)?.m === 'ice')) {
    c.frz += dt;
    if (c.frz >= 3) {
      g.grid[y][x] = newCell(g, 'ice');
      return;
    }
  } else {
    c.frz = 0;
  }
  if (fall(g, moved, x, y)) return;
  const s = g.rand() < 0.5 ? 1 : -1;
  for (const d of [s, -s]) {
    if (at(g, x + d, y) === null) {
      mv(g, moved, x, y, x + d, y);
      return;
    }
  }
}
