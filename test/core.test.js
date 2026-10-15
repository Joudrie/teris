import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, physics, hardDrop, rotate, landingY, emptyGrid,
  altitude, fallSpeed, targetLines, H, W,
} from '../src/core.js';

// Fixed random source so every test is deterministic. 0.9 always picks stone for spawns
// and makes sideways flow try the left side first.
const fixed = () => 0.9;
const stone = () => ({ m: 'stone', frz: 0 });
const cell = (m) => ({ m, frz: 0 });

function setup(cells) {
  const g = createGame({ level: 1, rand: fixed });
  g.grid = emptyGrid();
  for (const [x, y, m] of cells) g.grid[y][x] = cell(m);
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
  const g = setup([[4, H - 1, 'stone'], [6, H - 1, 'stone'], [5, H - 1, 'wood'], [5, H - 2, 'water']]);
  physics(g, 0.12);
  assert.equal(g.grid[H - 2][5].m, 'wood');
  assert.equal(g.grid[H - 1][5].m, 'water');
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
