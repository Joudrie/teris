// Sand mode rules: pieces turn to sand, sand pours, and a one-color patch wall to wall clears.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSand, step, drop, move, rotate, GW, GH, G } from '../src/modes/sandcore.js';
import { mulberry32 } from '../tools/bots.js';

const DT = 1 / 60;
const grains = (s) => s.cell.reduce((n, v) => n + (v ? 1 : 0), 0);
const run = (s, secs) => { const ev = []; for (let t = 0; t < secs; t += DT) ev.push(...step(s, DT).map((e) => ({ ...e }))); return ev; };

test('a dropped piece becomes 4 cells of sand that settles on the floor', () => {
  const s = createSand({ rand: mulberry32(3) });
  drop(s);
  assert.equal(grains(s), 4 * G * G);
  run(s, 3);
  assert.equal(grains(s), 4 * G * G, 'sand is conserved while it pours');
  // Nothing floats: every grain sits on the floor or on another grain.
  for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW; x++) {
    if (s.cell[y * GW + x]) assert.ok(s.cell[(y + 1) * GW + x], `grain at ${x},${y} is floating`);
  }
});

test('one color touching both walls clears and scores', () => {
  const s = createSand({ rand: mulberry32(5) });
  s.piece = null;
  for (let x = 0; x < GW; x++) for (let y = GH - 4; y < GH; y++) s.cell[y * GW + x] = 2;
  const ev = run(s, 1);
  const clear = ev.find((e) => e.type === 'clear');
  assert.ok(clear, 'the bridge clears');
  assert.equal(clear.grains, GW * 4);
  assert.equal(clear.color, 1);
  assert.equal(s.score, GW * 4);
  assert.equal(grains(s), 0, 'the cleared sand is gone');
});

test('two colors side by side do not clear', () => {
  const s = createSand({ rand: mulberry32(7) });
  s.piece = null; // hold the spawn so only the floor is tested
  for (let x = 0; x < GW; x++) for (let y = GH - 4; y < GH; y++) s.cell[y * GW + x] = x < GW / 2 ? 1 : 3;
  const ev = run(s, 1);
  assert.equal(ev.filter((e) => e.type === 'clear').length, 0);
  assert.equal(grains(s), GW * 4);
});

test('moves and rotation stay inside the walls', () => {
  const s = createSand({ rand: mulberry32(9) });
  for (let i = 0; i < 20; i++) move(s, -1);
  assert.equal(s.piece.x, 0);
  for (let i = 0; i < 20; i++) { move(s, 1); rotate(s); }
  for (const [a] of s.piece.shape) assert.ok(s.piece.x + (a + 1) * G <= GW);
});

test('the game ends when the sand reaches the top', () => {
  const s = createSand({ rand: mulberry32(11) });
  let over = false;
  for (let i = 0; i < 400 && !over; i++) {
    drop(s);
    over = s.over || run(s, 0.05).some((e) => e.type === 'over');
  }
  assert.ok(s.over);
});

test('a one-grain diagonal staircase counts as a bridge', () => {
  const s = createSand({ rand: mulberry32(13) });
  s.piece = null;
  // Fill the floor with red, then cut a blue staircase through it that only touches at corners.
  for (let x = 0; x < GW; x++) for (let y = GH - 20; y < GH; y++) s.cell[y * GW + x] = 4;
  for (let x = 0; x < GW; x++) s.cell[(GH - 2 - Math.floor(x / 4)) * GW + x] = 1;
  // Break the red so it can't bridge on its own.
  for (let y = GH - 20; y < GH; y++) if (s.cell[y * GW + 30] === 4) s.cell[y * GW + 30] = 3;
  for (let x = 0; x < GW; x++) { const y = GH - 2 - Math.floor(x / 4); if (x % 4 === 3 && x < GW - 1) { assert.equal(s.cell[(y - 1) * GW + x + 1], 1); assert.notEqual(s.cell[y * GW + x + 1], 1, 'only a corner touches'); } }
  const ev = run(s, 0.05);
  const clear = ev.find((e) => e.type === 'clear');
  assert.ok(clear, 'the staircase clears');
  assert.equal(clear.color, 0);
  assert.equal(clear.grains, GW);
});
