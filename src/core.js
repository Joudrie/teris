// Material Blocks rules: grid, pieces, materials, levels. No DOM, so it runs under node:test.

export const W = 10;
export const H = 15;
export const TOTAL_LEVELS = 100;
export const PHYS_STEP = 0.12;

// Piece materials and their spawn weights (percent).
const WEIGHTS = { water: 30, wood: 20, ice: 15, sand: 15, stone: 20 };

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
    fire: null, // Set<"x,y"> of fire cells; null while the fire base is parked
  };
  spawn(g);
  return g;
}

export function emptyGrid() {
  return Array.from({ length: H }, () => Array(W).fill(null));
}

function pickMaterial(rand) {
  let r = rand() * 100;
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
  let overflow = false;
  for (const [a, b] of cells) {
    const cy = y + b;
    if (cy < 0) overflow = true;
    else g.grid[cy][x + a] = { m, frz: 0 };
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

// Fire cells are set by the parked fire base. None exist yet, so sand never melts to glass
// and mud never bakes to brick until that feature returns.
const hot = (g, x, y) => !!g.fire && g.fire.has(`${x},${y}`);

const at = (g, x, y) => (x >= 0 && x < W && y >= 0 && y < H ? g.grid[y][x] : undefined);

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

// One physics tick. Rows are processed bottom-up; `moved` stops a cell from acting twice.
export function physics(g, dt) {
  const moved = Array.from({ length: H }, () => Array(W).fill(false));
  const dir = g.rand() < 0.5 ? 1 : -1;
  for (let y = H - 1; y >= 0; y--) {
    for (let k = 0; k < W; k++) {
      const x = dir > 0 ? k : W - 1 - k;
      if (!g.grid[y][x] || moved[y][x]) continue;
      react(g, moved, x, y, dt);
    }
  }
  resolveRows(g);
}

function react(g, moved, x, y, dt) {
  const c = g.grid[y][x];
  switch (c.m) {
    case 'stone': {
      // Stone landing on glass shatters it back into sand.
      const below = at(g, x, y + 1);
      if (below && below.m === 'glass') below.m = 'sand';
      fall(g, moved, x, y);
      return;
    }

    case 'ice':
    case 'glass':
    case 'brick':
      fall(g, moved, x, y);
      return;

    case 'sand': {
      if (hot(g, x, y)) {
        c.m = 'glass';
        return;
      }
      const below = at(g, x, y + 1);
      if (below && below.m === 'water') {
        g.grid[y + 1][x] = { m: 'mud', frz: 0 };
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
      return;
    }

    case 'water': {
      const wood = N4.map(([u, v]) => at(g, x + u, y + v)).find((n) => n && n.m === 'wood');
      if (wood) {
        wood.m = 'wetwood';
        g.grid[y][x] = null;
        return;
      }
      const iceNear = N4.some(([u, v]) => {
        const n = at(g, x + u, y + v);
        return !!n && n.m === 'ice';
      });
      if (iceNear) {
        c.frz += dt;
        if (c.frz >= 3) {
          g.grid[y][x] = { m: 'ice', frz: 0 };
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
      return;
    }

    case 'wood':
    case 'wetwood': {
      const up = at(g, x, y - 1);
      if (up && up.m === 'water' && !moved[y - 1][x]) {
        g.grid[y - 1][x] = c;
        g.grid[y][x] = up;
        moved[y - 1][x] = true;
        return;
      }
      fall(g, moved, x, y);
      return;
    }

    case 'mud':
      // Mud stays put, unless it is in fire.
      if (hot(g, x, y)) c.m = 'brick';
      return;

    default:
      return;
  }
}
