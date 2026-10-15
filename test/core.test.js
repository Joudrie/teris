import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, hardDrop, softDrop, activatePower, revive, progress, piecesDrained, emptyGrid, pickMaterial,
  altitude, fallSpeed, GW, GH, S, PIECE,
} from '../src/core.js';
import { levelConfig } from '../src/levels.js';

// Deterministic random source. 0.9 makes sideways moves try the left side first.
const fixed = () => 0.9;
const DT = 1 / 30;

const baseConfig = (over = {}) => ({
  main: 'wood', power: 'blaze', pool: { stone: 1 }, mode: 'normal',
  goal: { pieces: 1000 }, quest: { type: 'chain', n: 3 }, ...over,
});

// Empty board, no falling piece, so tests only see the particles they place.
function setup(over) {
  const g = createGame({ level: 1, rand: fixed, config: baseConfig(over) });
  g.grid = emptyGrid();
  g.piece = null;
  return g;
}

let autoId = 10000;
function put(g, x, y, m, id = ++autoId) {
  g.grid[y][x] = { m, id, heat: 0, frz: 0, shade: 0.5 };
}

// Fills a w x h rectangle of particles that share one piece id.
function block(g, x0, y0, w, h, m) {
  const id = ++autoId;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(g, x, y, m, id);
  return id;
}

const run = (g, seconds) => { for (let t = 0; t < seconds; t += DT) tick(g, DT); };
const count = (g, m) => g.grid.flat().filter((c) => c && c.m === m).length;

test('altitude and fall speed follow the spec', () => {
  assert.equal(altitude(1), 100);
  assert.equal(altitude(100), 1);
  assert.ok(Math.abs(fallSpeed(1) - 0.695) < 1e-9);
  assert.equal(fallSpeed(200), 0.15);
});

test('levels rotate themes and every pool has fire and water to cancel', () => {
  assert.equal(levelConfig(1).power, 'blaze');
  assert.equal(levelConfig(2).power, 'freeze');
  assert.equal(levelConfig(1).goal.pieces, 15);
  assert.ok(levelConfig(100).goal.pieces > 15);
  for (let l = 1; l <= 4; l++) {
    assert.ok(levelConfig(l).pool.fire > 0 && levelConfig(l).pool.water > 0, `level ${l}`);
  }
  const pools = [1, 2, 3, 4].map((l) => Object.keys(levelConfig(l).pool)).flat();
  for (const m of ['glass', 'brick', 'fire', 'wood', 'water', 'ice', 'sand', 'stone']) assert.ok(pools.includes(m), m);
});

test('helping hand doubles the main material', () => {
  assert.equal(levelConfig(1, { help: true }).pool.wood, levelConfig(1).pool.wood * 2);
});

test('pickMaterial respects weights', () => {
  assert.equal(pickMaterial({ a: 1, b: 1 }, () => 0.1), 'a');
  assert.equal(pickMaterial({ a: 1, b: 1 }, () => 0.9), 'b');
});

test('sand landing on water turns into mud', () => {
  const g = setup();
  put(g, 5, GH - 1, 'water');
  put(g, 4, GH - 1, 'stone');
  put(g, 6, GH - 1, 'stone');
  put(g, 5, GH - 2, 'sand');
  tick(g, DT);
  assert.equal(g.grid[GH - 1][5].m, 'mud');
  assert.equal(g.grid[GH - 2][5], null);
});

test('water soaks into wood and drains', () => {
  const g = setup();
  put(g, 4, GH - 1, 'wood');
  put(g, 5, GH - 1, 'water');
  tick(g, DT);
  assert.equal(g.grid[GH - 1][4].m, 'wetwood');
  assert.equal(g.drained, 1);
});

test('fire and water cancel out and both drain', () => {
  const g = setup();
  put(g, 4, GH - 1, 'fire');
  put(g, 5, GH - 1, 'water');
  tick(g, DT);
  assert.equal(count(g, 'fire'), 0);
  assert.equal(count(g, 'water'), 0);
  assert.equal(g.drained, 2);
  assert.equal(g.doused, 1);
});

test('a piece of fire and a piece of water drain two blocks on the bar', () => {
  const g = setup();
  block(g, 0, GH - 8, 8, 8, 'fire');
  for (let y = GH - 8; y < GH; y++) for (let x = 8; x < 16; x++) put(g, x, y, 'water');
  block(g, 16, GH - 8, 4, 8, 'stone'); // wall so the water can't run off
  run(g, 10);
  assert.equal(count(g, 'fire'), 0);
  assert.equal(count(g, 'water'), 0);
  assert.equal(piecesDrained(g), 2);
});

test('sand landing on water drains into mud', () => {
  const g = setup();
  put(g, 5, GH - 1, 'water');
  put(g, 4, GH - 1, 'stone');
  put(g, 6, GH - 1, 'stone');
  put(g, 5, GH - 2, 'sand');
  tick(g, DT);
  assert.equal(g.drained, 1);
});

test('water wears stone down to sand, slowly', () => {
  const g = setup();
  put(g, 3, GH - 1, 'stone');
  put(g, 4, GH - 1, 'stone');
  put(g, 5, GH - 1, 'water');
  put(g, 6, GH - 1, 'stone');
  run(g, 4);
  assert.equal(g.grid[GH - 1][4].m, 'stone');
  run(g, 4.2);
  assert.equal(g.grid[GH - 1][4].m, 'sand');
});

test('draining fast builds a combo', () => {
  const g = setup();
  block(g, 0, GH - 8, 8, 8, 'wood');
  g.meter = 1;
  activatePower(g);
  assert.equal(g.mult, 2);
  assert.ok(g.events.some((e) => e.type === 'combo'));
});

test('fire never burns out on its own and does not spread', () => {
  const g = setup();
  put(g, 4, GH - 1, 'fire');
  put(g, 5, GH - 1, 'wood');
  put(g, 6, GH - 1, 'stone');
  put(g, 7, GH - 1, 'wood');
  run(g, 10);
  assert.equal(g.grid[GH - 1][4].m, 'fire');
  assert.equal(g.grid[GH - 1][5], null); // touching wood burned
  assert.equal(g.grid[GH - 1][7].m, 'wood'); // wood not touching fire is untouched
});

test('fire melts sand to glass, bakes mud to brick, melts ice', () => {
  const g = setup();
  put(g, 10, GH - 1, 'sand');
  put(g, 11, GH - 1, 'fire');
  put(g, 12, GH - 1, 'mud');
  put(g, 19, GH - 1, 'stone');
  put(g, 20, GH - 1, 'ice');
  put(g, 21, GH - 1, 'fire');
  put(g, 22, GH - 1, 'stone');
  run(g, 1);
  assert.equal(g.grid[GH - 1][10].m, 'glass');
  assert.equal(g.grid[GH - 1][12].m, 'brick');
  assert.notEqual(g.grid[GH - 1][20]?.m, 'ice');
});

test('wet wood steams first, then dries and burns', () => {
  const g = setup();
  put(g, 4, GH - 1, 'fire');
  put(g, 5, GH - 1, 'wetwood');
  run(g, 0.5);
  assert.equal(g.grid[GH - 1][5].m, 'wetwood');
  assert.ok(g.events.some((e) => e.type === 'steam'));
  run(g, 2);
  assert.equal(g.grid[GH - 1][5], null);
});

test('water next to ice freezes', () => {
  const g = setup();
  put(g, 3, GH - 1, 'stone');
  put(g, 4, GH - 1, 'water');
  put(g, 5, GH - 1, 'ice');
  run(g, 0.5);
  assert.equal(g.grid[GH - 1][4].m, 'water');
  run(g, 0.5);
  assert.equal(g.grid[GH - 1][4].m, 'ice');
});

test('a landed solid piece stays in one piece', () => {
  const g = setup();
  // L shape: left column on the floor, the overhang must not fall.
  const id = ++autoId;
  for (let y = GH - 8; y < GH; y++) for (let x = 0; x < 4; x++) put(g, x, y, 'stone', id);
  for (let y = GH - 8; y < GH - 4; y++) for (let x = 4; x < 12; x++) put(g, x, y, 'stone', id);
  run(g, 1);
  assert.equal(g.grid[GH - 8][8].m, 'stone');
  assert.equal(g.grid[GH - 1][8], null);
});

test('an unsupported solid piece falls as one block', () => {
  const g = setup();
  block(g, 8, 10, 8, 4, 'ice');
  tick(g, DT);
  assert.equal(g.grid[11][8].m, 'ice');
  assert.equal(g.grid[14][15].m, 'ice');
  assert.equal(g.grid[10][8], null);
});

test('wood floats up through water', () => {
  const g = setup();
  block(g, 4, GH - 1, 4, 1, 'wetwood');
  for (let x = 4; x < 8; x++) put(g, x, GH - 2, 'water');
  for (const x of [3, 8]) { put(g, x, GH - 1, 'stone'); put(g, x, GH - 2, 'stone'); }
  tick(g, DT);
  assert.equal(g.grid[GH - 2][5].m, 'wetwood');
  assert.equal(g.grid[GH - 1][5].m, 'water');
});

test('slamming a piece onto glass smashes it away; a gentle drop does not', () => {
  const slam = setup();
  block(slam, 12, GH - S, 16, S, 'glass');
  slam.piece = { m: 'brick', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 3, y: 0 };
  hardDrop(slam);
  assert.equal(count(slam, 'glass'), 0);
  assert.equal(count(slam, 'sand'), 0);
  assert.equal(slam.drained, 16 * S);

  const gentle = setup();
  block(gentle, 12, GH - S, 16, S, 'glass');
  gentle.piece = { m: 'brick', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 3, y: GH - 2 * S - 1 };
  softDrop(gentle);
  for (let i = 0; i < 10; i++) tick(gentle, DT);
  assert.equal(count(gentle, 'glass'), 16 * S);
});

test('a block that falls a long way smashes glass', () => {
  const g = setup();
  block(g, 0, GH - S, GW / 2, S, 'glass');
  block(g, 24, GH - S, 16, S, 'stone'); // stops the floor touching both walls as one material
  block(g, 4, 10, 8, 4, 'brick');
  run(g, 3);
  assert.equal(count(g, 'glass'), 0);
});

test('power needs a full meter and clears the level material', () => {
  const g = setup();
  block(g, 0, GH - 8, 8, 8, 'wood');
  assert.equal(activatePower(g), false);
  g.meter = 1;
  assert.equal(activatePower(g), true);
  assert.equal(count(g, 'wood'), 0);
  assert.equal(g.drained, 64);
  assert.equal(g.meter, 0);
});

test('side quest gives meter charge once', () => {
  const g = setup({ quest: { type: 'douse', n: 1 } });
  block(g, 0, GH - 8, 8, 8, 'fire');
  for (let y = GH - 8; y < GH; y++) for (let x = 8; x < 16; x++) put(g, x, y, 'water');
  block(g, 16, GH - 8, 4, 8, 'stone');
  run(g, 10);
  assert.ok(g.questDone);
  assert.ok(g.meter >= 0.35);
});

test('filling the drain bar wins', () => {
  const g = setup({ goal: { pieces: 1 } });
  block(g, 0, GH - 8, 8, 8, 'wood');
  g.meter = 1;
  activatePower(g);
  assert.equal(PIECE, 64);
  assert.equal(g.state, 'win');
  assert.equal(progress(g), 1);
});

test('topping out loses, and one revive clears the top and continues', () => {
  const g = setup();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (x % 8 !== 0) put(g, x, y, 'stone', 1);
  g.piece = { m: 'stone', cells: [[0, 0], [1, 0]], x: 3, y: 0 };
  hardDrop(g);
  assert.equal(g.state, 'lose');
  assert.equal(revive(g), true);
  assert.equal(g.state, 'play');
  assert.equal(revive(g), false);
});
