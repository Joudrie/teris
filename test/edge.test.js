// Edge cases tested on purpose (Phase 6). Each runs with the invariant checks every tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, update, emptyGrid, placeBlock, hardDrop, rotate, move, GW, GH, S, COLS } from '../src/core.js';
import { levelConfig } from '../src/levels.js';
import { validate, createValidator } from '../src/validate.js';
import { mulberry32, createBot, botStep } from '../tools/bots.js';

const DT = 1 / 30;
const count = (g, m) => g.grid.flat().filter((c) => c && c.m === m).length;
function runChecked(g, secs, each) {
  const v = createValidator();
  for (let t = 0; t < secs; t += DT) {
    if (each) each(g);
    update(g, DT);
    const errs = validate(g, v);
    assert.deepEqual(errs, [], `t=${t.toFixed(2)}`);
    if (g.state !== 'play') break;
  }
}
const quiet = (over = {}) => ({ ...levelConfig(3), goal: { pieces: 999 }, pieces: Infinity, start: [], first: [], ...over });

test('fire fully surrounded by glass stays put, nothing leaks or breaks', () => {
  const g = createGame({ level: 3, rand: mulberry32(1), config: quiet() });
  g.grid = emptyGrid();
  placeBlock(g, { m: 'glass', x: 3, y: 15, w: 5, h: 5 });
  for (let y = 16 * S; y < 19 * S; y++) for (let x = 4 * S; x < 7 * S; x++) g.grid[y][x] = { m: 'fire', id: 999, heat: 0, frz: 0, shade: 0.5 };
  g.piece = { m: 'stone', mats: ['stone', 'stone', 'stone', 'stone'], cells: [[0, 0], [1, 0], [0, 1], [1, 1]], x: 0, y: 0 };
  const fire = count(g, 'fire');
  runChecked(g, 5, (gg) => { if (gg.piece) gg.piece.y = 0; });
  assert.equal(count(g, 'fire'), fire);
  assert.ok(count(g, 'glass') > 0);
});

test('water trapped in a sealed pocket sits still and stays valid', () => {
  const g = createGame({ level: 3, rand: mulberry32(2), config: quiet() });
  g.grid = emptyGrid();
  placeBlock(g, { m: 'glass', x: 2, y: 14, w: 6, h: 6 });
  for (let y = 15 * S; y < 19 * S; y++) for (let x = 3 * S; x < 7 * S; x++) g.grid[y][x] = { m: 'water', id: 5000 + x + y * GW, heat: 0, frz: 0, shade: 0.5 };
  g.piece = { m: 'stone', mats: ['stone', 'stone', 'stone', 'stone'], cells: [[0, 0], [1, 0], [0, 1], [1, 1]], x: 9, y: 0 };
  const water = count(g, 'water');
  runChecked(g, 5, (gg) => { if (gg.piece) gg.piece.y = 0; });
  assert.equal(count(g, 'water'), water);
});

test('wall mode at every gap column: the first piece always has somewhere to land', () => {
  for (let gap = 0; gap < COLS; gap++) {
    const cfg = { ...levelConfig(16), pieces: Infinity, goal: { pieces: 999 } };
    cfg.start = Array.from({ length: COLS }, (_, x) => x).filter((x) => x !== gap).map((x) => ({ m: 'wood', x, y: 18, w: 1, h: 2 }));
    const g = createGame({ level: 16, rand: mulberry32(gap), config: cfg });
    hardDrop(g);
    const v = createValidator();
    assert.deepEqual(validate(g, v), []);
    assert.equal(g.state, 'play');
  }
});

test('flood mode with nobody playing: water keeps coming, fire and sand soak it, nothing breaks', () => {
  for (const level of [12, 18, 22]) {
    for (let seed = 1; seed <= 3; seed++) {
      const cfg = { ...levelConfig(level), pieces: Infinity, goal: { pieces: 999 } };
      const g = createGame({ level, rand: mulberry32(seed), config: cfg });
      const ids = g.nextId;
      runChecked(g, 60);
      assert.ok(g.nextId - ids > 200); // hundreds of water particles were added
    }
  }
});

test('worst flood seeds with the random bot keep every invariant', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const g = createGame({ level: 18, rand: mulberry32(seed), config: { ...levelConfig(18), pieces: Infinity } });
    const bot = createBot('random', mulberry32(seed + 50));
    runChecked(g, 90, (gg) => botStep(bot, gg, DT));
  }
});

test('spawn onto a nearly full board loses cleanly instead of overlapping', () => {
  const g = createGame({ level: 3, rand: mulberry32(3), config: quiet() });
  g.grid = emptyGrid();
  placeBlock(g, { m: 'brick', x: 0, y: 2, w: 12, h: 18 });
  placeBlock(g, { m: 'brick', x: 4, y: 1, w: 1, h: 1 });
  g.piece = { m: 'brick', mats: ['brick', 'brick', 'brick', 'brick'], cells: [[0, 0], [1, 0]], x: 8, y: 0 };
  hardDrop(g);
  assert.equal(g.state, 'lose');
  assert.deepEqual(validate(g), []);
});

test('rotating against walls and other blocks never pushes a piece out or into blocks', () => {
  const g = createGame({ level: 3, rand: mulberry32(4), config: quiet({ mixed: 0.5 }) });
  g.grid = emptyGrid();
  placeBlock(g, { m: 'brick', x: 0, y: 6, w: 3, h: 14 });
  placeBlock(g, { m: 'brick', x: 9, y: 6, w: 3, h: 14 });
  const v = createValidator();
  for (let i = 0; i < 400; i++) {
    const r = i % 7;
    if (r < 3) rotate(g);
    else if (r < 5) move(g, -1);
    else move(g, 1);
    tick(g, DT);
    if (i % 23 === 0 && g.piece) { g.piece.y = 0; }
    assert.deepEqual(validate(g, v), [], `step ${i}`);
  }
});
