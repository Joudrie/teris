import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, physics, hardDrop, rotate, landingY, emptyGrid,
  altitude, fallSpeed, targetLines, pickMaterial, H, W,
} from '../src/core.js';

// Fixed random source so every test is deterministic. 0.9 always picks stone for spawns
// and makes sideways flow try the left side first.
const fixed = () => 0.9;

// Cells as [x, y, material, pieceId]. Without an id each cell is its own piece.
function setup(cells) {
  const g = createGame({ level: 1, rand: fixed });
  g.grid = emptyGrid();
  let auto = 1000;
  for (const [x, y, m, id] of cells) g.grid[y][x] = { m, frz: 0, heat: 0, id: id ?? ++auto };
  return g;
}

test('altitude, fall speed and goal follow the spec', () => {
  assert.equal(altitude(1), 100);
  assert.equal(altitude(100), 1);
  assert.ok(Math.abs(fallSpeed(1) - 0.695) < 1e-9);
  assert.ok(Math.abs(fallSpeed(100) - 0.2) < 1e-9);
  assert.equal(fallSpeed(200), 0.15);
  assert.equal(targetLines(1), 3);
  assert.equal(targetLines(10), 4);
  assert.equal(targetLines(100), 13);
});

test('sand landing on water turns the water into mud and the sand is gone', () => {
  const g = setup([[4, H - 1, 'stone'], [6, H - 1, 'stone'], [5, H - 1, 'water'], [5, H - 2, 'sand']]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 1][5].m, 'mud');
  assert.equal(g.grid[H - 2][5], null);
});

test('water next to wood soaks in: wood becomes wet wood and the water is consumed', () => {
  const g = setup([[4, H - 1, 'wood'], [5, H - 1, 'water'], [6, H - 1, 'stone']]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 1][4].m, 'wetwood');
  assert.equal(g.grid[H - 1][5], null);
});

test('wood under water swaps upward and floats', () => {
  // Wet wood so the water floats it instead of soaking in.
  const g = setup([[4, H - 1, 'stone'], [6, H - 1, 'stone'], [5, H - 1, 'wetwood'], [5, H - 2, 'water']]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 2][5].m, 'wetwood');
  assert.equal(g.grid[H - 1][5].m, 'water');
});

test('a whole wood piece floats up through water together', () => {
  const g = setup([
    [3, H - 1, 'wetwood', 1], [4, H - 1, 'wetwood', 1],
    [3, H - 2, 'water'], [4, H - 2, 'water'],
    [2, H - 1, 'stone'], [5, H - 1, 'stone'], [2, H - 2, 'stone'], [5, H - 2, 'stone'],
  ]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 2][3].m, 'wetwood');
  assert.equal(g.grid[H - 2][4].m, 'wetwood');
  assert.equal(g.grid[H - 1][3].m, 'water');
  assert.equal(g.grid[H - 1][4].m, 'water');
});

test('a landed solid piece stays in one piece instead of crumbling', () => {
  // L shape: only its left column touches the floor, the overhang must not fall.
  const g = setup([
    [3, H - 1, 'stone', 1], [3, H - 2, 'stone', 1], [4, H - 2, 'stone', 1], [5, H - 2, 'stone', 1],
  ]);
  for (let i = 0; i < 10; i++) physics(g, 0.12);
  assert.equal(g.grid[H - 2][4].m, 'stone');
  assert.equal(g.grid[H - 2][5].m, 'stone');
  assert.equal(g.grid[H - 1][4], null);
  assert.equal(g.grid[H - 1][5], null);
});

test('an unsupported solid piece falls as one block', () => {
  const g = setup([[3, 5, 'ice', 1], [4, 5, 'ice', 1], [4, 6, 'ice', 1]]);
  physics(g, 0.12);
  assert.equal(g.grid[6][3].m, 'ice');
  assert.equal(g.grid[6][4].m, 'ice');
  assert.equal(g.grid[7][4].m, 'ice');
  assert.equal(g.grid[5][3], null);
});

test('water next to ice freezes after 3 seconds, not before', () => {
  const sealed = [[0, H - 1, 'stone'], [1, H - 1, 'water'], [2, H - 1, 'ice']];
  const early = setup(sealed);
  for (let i = 0; i < 20; i++) physics(early, 0.12); // 2.4 s
  assert.equal(early.grid[H - 1][1].m, 'water');

  const late = setup(sealed);
  for (let i = 0; i < 26; i++) physics(late, 0.12); // 3.12 s
  assert.equal(late.grid[H - 1][1].m, 'ice');
});

test('stone does not react to anything', () => {
  // Sand is boxed in by stone on both sides so it has nowhere to slide.
  const g = setup([
    [4, H - 1, 'water'], [5, H - 1, 'stone'], [6, H - 1, 'stone'],
    [4, H - 2, 'stone'], [5, H - 2, 'sand'], [6, H - 2, 'stone'],
  ]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 1][5].m, 'stone');
  assert.equal(g.grid[H - 2][5].m, 'sand');
  assert.equal(g.grid[H - 1][3].m, 'water'); // flowed into the open gap
});

test('stone landing on glass shatters it back into sand', () => {
  const g = setup([[5, H - 1, 'glass'], [5, H - 2, 'stone']]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 1][5].m, 'sand');
});

test('glass and brick fall like stone', () => {
  const g = setup([[2, H - 3, 'glass'], [7, H - 3, 'brick']]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 2][2].m, 'glass');
  assert.equal(g.grid[H - 2][7].m, 'brick');
});

test('fire blocks melt sand into glass and bake mud into brick', () => {
  const g = setup([[4, H - 1, 'sand'], [5, H - 1, 'fire'], [6, H - 1, 'mud']]);
  for (let i = 0; i < 30; i++) physics(g, 0.12); // 3.6 s
  assert.equal(g.grid[H - 1][4].m, 'glass');
  assert.equal(g.grid[H - 1][6].m, 'brick');
  assert.equal(g.grid[H - 1][5].m, 'fire');
});

test('fire burns wood away, melts ice, and leaves stone alone', () => {
  const g = setup([
    [2, H - 1, 'wood'], [3, H - 1, 'fire'], [4, H - 1, 'stone'],
    [6, H - 1, 'ice'], [7, H - 1, 'fire'], [8, H - 1, 'stone'],
  ]);
  for (let i = 0; i < 14; i++) physics(g, 0.12); // 1.68 s: ice melted, wood not yet
  assert.equal(g.grid[H - 1][6].m, 'water');
  assert.equal(g.grid[H - 1][2].m, 'wood');
  for (let i = 0; i < 14; i++) physics(g, 0.12); // 3.36 s total
  assert.equal(g.grid[H - 1][2], null);
  assert.equal(g.grid[H - 1][4].m, 'stone');
});

test('fire does not spread', () => {
  const g = setup([[3, H - 1, 'fire'], [4, H - 1, 'wood'], [5, H - 1, 'wood']]);
  for (let i = 0; i < 60; i++) physics(g, 0.12);
  assert.equal(g.grid[H - 1][4], null); // touching wood burned away
  assert.equal(g.grid[H - 1][5].m, 'wood'); // the next one never caught
});

test('a full row clears Tetris-style and rows above drop into place', () => {
  const row = [];
  for (let x = 0; x < W; x++) row.push([x, H - 1, 'stone']);
  const g = setup([...row, [0, H - 2, 'sand']]);
  physics(g, 0.12);
  assert.equal(g.lines, 1);
  assert.equal(g.grid[H - 1][0].m, 'sand');
  assert.equal(g.state, 'play');
});

test('reaching the level goal wins the level', () => {
  const row = [];
  for (let x = 0; x < W; x++) row.push([x, H - 1, 'stone']);
  const g = setup(row);
  g.lines = 2; // level 1 needs 3
  physics(g, 0.12);
  assert.equal(g.lines, 3);
  assert.equal(g.state, 'win');
});

test('a piece that cannot spawn loses the level', () => {
  // Fill everything below the spawn zone except one column, so the piece locks at the top.
  const cells = [];
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W - 1; x++) cells.push([x, y, 'stone']);
  }
  const g = setup(cells);
  g.grid[0].fill(null);
  g.piece = { m: 'stone', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 3, y: 0 };
  hardDrop(g);
  assert.equal(g.state, 'lose');
});

test('landingY finds where the piece would stop', () => {
  const g = setup([]);
  g.piece = { m: 'water', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], x: 3, y: 0 };
  assert.equal(landingY(g), H - 2);
});

test('rotate keeps the piece in bounds and on the board', () => {
  const g = setup([]);
  g.piece = { m: 'wood', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 0, y: 0 };
  rotate(g);
  assert.equal(g.piece.cells.length, 4);
  for (const [a] of g.piece.cells) assert.ok(g.piece.x + a >= 0 && g.piece.x + a < W);
});

test('glass, brick and fire are in the spawn pool', () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) seen.add(pickMaterial(() => i / 1000));
  for (const m of ['glass', 'brick', 'fire']) assert.ok(seen.has(m), m);
});
