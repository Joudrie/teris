import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, hardDrop, softDrop, rotate, pieceMats, activatePower, revive, progress, piecesDrained, emptyGrid, drawMaterial,
  altitude, fallSpeed, GW, GH, S, PIECE,
} from '../src/core.js';
import { levelConfig, buildBag, difficulty, HAND_LEVELS, POWERS } from '../src/levels.js';

// Deterministic random source. 0.9 makes sideways moves try the left side first.
const fixed = () => 0.9;
const DT = 1 / 30;

const baseConfig = (over = {}) => ({
  main: 'wood', power: 'blaze', bag: ['stone'], mode: 'normal',
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
  assert.ok(Math.abs(fallSpeed(1) - 0.446) < 1e-9);
  assert.equal(fallSpeed(200), 0.12);
});

test('every level can be cleared: fire and water in every bag, a known power', () => {
  for (let l = 1; l <= 100; l++) {
    const c = levelConfig(l);
    assert.ok(c.bag.includes('fire') && c.bag.includes('water'), `level ${l}`);
    assert.ok(POWERS[c.power], `level ${l} power`);
    assert.ok(c.goal.pieces >= 10, `level ${l} goal`);
  }
});

test('the first levels teach one material at a time', () => {
  const firstSeen = {};
  for (let l = 1; l <= HAND_LEVELS; l++) {
    const c = levelConfig(l);
    const mats = new Set([...c.bag, ...c.start.map((b) => b.m)]);
    for (const m of mats) if (!(m in firstSeen)) firstSeen[m] = l;
  }
  assert.deepEqual(firstSeen, { fire: 1, water: 1, wood: 3, sand: 4, glass: 5, ice: 7, stone: 11, brick: 13 });
  // Every level that brings in something new says so on the board.
  for (const l of Object.values(firstSeen)) assert.ok(levelConfig(l).intro, `level ${l} has a callout`);
  assert.ok(levelConfig(8).intro.includes('TWO-MATERIAL'));
  assert.equal(levelConfig(7).mixed, 0);
});

test('no level is a copy of the one before it', () => {
  const sig = (c) => JSON.stringify([c.bag.slice().sort(), c.start, c.mode, c.quest, c.power, c.goal]);
  for (let l = 2; l <= 100; l++) assert.notEqual(sig(levelConfig(l)), sig(levelConfig(l - 1)), `level ${l}`);
});

test('showcase levels come every five levels from 5', () => {
  for (let l = 5; l <= 100; l += 5) assert.ok(levelConfig(l).showcase, `level ${l}`);
});
const tally = (bag) => bag.reduce((t, m) => ({ ...t, [m]: (t[m] || 0) + 1 }), {});

test('generated bags get harder: fewer cancellers, more stone', () => {
  const ratio = (bag) => bag.filter((m) => m === 'fire' || m === 'water').length / bag.length;
  assert.ok(ratio(buildBag(12, 'wood')) < ratio(buildBag(5, 'wood')));
  assert.ok(buildBag(12, 'wood').filter((m) => m === 'stone').length === 2);
  assert.ok(buildBag(12, 'wood').includes('brick'));
  // Difficulty climbs in a sawtooth: every block of five has a breather.
  for (let l = 25; l < 95; l += 5) {
    const d = [0, 1, 2, 3, 4].map((k) => difficulty(l + 1 + k));
    assert.ok(d[2] < d[1], `breather at ${l + 3}`);
    assert.ok(difficulty(l + 5 + 1) > difficulty(l + 1) - 1e-9, `rising from ${l + 1}`);
  }
});
test('helping hand adds one fire and one water to the bag', () => {
  for (const l of [1, 9, 40]) {
    const base = tally(levelConfig(l).bag);
    const help = tally(levelConfig(l, { help: true }).bag);
    assert.equal(help.fire, base.fire + 1);
    assert.equal(help.water, base.water + 1);
    assert.equal(help.wood, base.wood);
  }
});
test('pieces come out of the bag with the exact mix every time', () => {
  let r = 0.37;
  const rand = () => (r = ((r * 9301 + 49297) % 233280) / 233280);
  const g = createGame({ level: 1, rand, config: { ...levelConfig(1), mode: 'normal' } });
  g.bag = [];
  const want = tally(g.cfg.bag);
  for (let round = 0; round < 3; round++) {
    const drawn = g.cfg.bag.map(() => drawMaterial(g));
    assert.deepEqual(tally(drawn), want);
  }
});
test('soaking wet wood again dissolves it', () => {
  const g = setup();
  put(g, 4, GH - 1, 'wetwood');
  put(g, 5, GH - 1, 'water');
  put(g, 6, GH - 1, 'stone');
  tick(g, DT);
  assert.equal(g.grid[GH - 1][4], null);
  assert.equal(g.drained, 2);
});

test('water washes mud away', () => {
  const g = setup();
  put(g, 3, GH - 1, 'stone');
  put(g, 4, GH - 1, 'mud');
  put(g, 5, GH - 1, 'water');
  put(g, 6, GH - 1, 'stone');
  run(g, 0.3);
  assert.equal(g.grid[GH - 1][4].m, 'mud');
  run(g, 0.4);
  assert.equal(g.grid[GH - 1][4], null);
  assert.equal(g.drained, 2);
});

test('sand meeting water turns into mud, and the mud sinks away', () => {
  const g = setup();
  put(g, 5, GH - 1, 'water');
  put(g, 4, GH - 1, 'stone');
  put(g, 6, GH - 1, 'stone');
  put(g, 5, GH - 2, 'sand');
  tick(g, DT);
  assert.equal(count(g, 'sand') + count(g, 'water'), 0);
  assert.equal(count(g, 'mud'), 1);
  run(g, 1.5);
  assert.equal(count(g, 'mud'), 0);
  assert.equal(g.drained, 2);
});

test('a splash of water turns a chunk of sand into mud, not just the surface', () => {
  const g = setup();
  for (let y = GH - 8; y < GH; y++) for (let x = 0; x < GW; x++) put(g, x, y, 'sand');
  put(g, 20, GH - 9, 'water');
  tick(g, DT);
  tick(g, DT);
  let deepest = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g.grid[y][x]?.m === 'mud') deepest = Math.max(deepest, y - (GH - 8));
  assert.ok(count(g, 'mud') > 3, `mud ${count(g, 'mud')}`);
  assert.ok(deepest >= 1, `deepest ${deepest}`);
});

test('fire melts a sand clump into one glass pane that a slam smashes whole', () => {
  const g = setup();
  for (let y = GH - 8; y < GH; y++) for (let x = 0; x < 12; x++) put(g, x, y, 'sand');
  for (let y = GH - 8; y < GH; y++) put(g, 12, y, 'fire');
  block(g, 13, GH - 8, 27, 8, 'stone'); // the right side stays out of it
  run(g, 4);
  const glass = g.grid.flat().filter((c) => c && c.m === 'glass');
  assert.ok(glass.length >= 8 * 8, `glass ${glass.length}`);
  assert.equal(new Set(glass.map((c) => c.id)).size, 1, 'one pane');
  // Slam a piece onto the pane.
  for (let y = 0; y < GH - 8; y++) for (let x = 0; x < 16; x++) g.grid[y][x] = null;
  g.piece = { m: 'brick', cells: [[0, 0], [1, 0]], x: 0, y: 0 };
  const before = g.drained;
  hardDrop(g);
  assert.ok(g.drained - before >= glass.length - 16, `smashed ${g.drained - before} of ${glass.length}`);
});

test('water that freezes joins the ice block it touches', () => {
  const g = setup();
  const id = block(g, 0, GH - 1, 4, 1, 'ice');
  put(g, 4, GH - 1, 'water');
  put(g, 5, GH - 1, 'stone');
  run(g, 1);
  assert.equal(g.grid[GH - 1][4].m, 'ice');
  assert.equal(g.grid[GH - 1][4].id, id);
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
  block(g, 16, GH - 8, 4, 8, 'glass'); // wall so the water can't run off
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

test('water wears stone down to sand, and the wear spreads through the piece', () => {
  const g = setup();
  block(g, 0, GH - 4, 8, 4, 'stone');
  put(g, 8, GH - 1, 'water');
  block(g, 9, GH - 4, 2, 4, 'glass');
  run(g, 0.9);
  assert.equal(count(g, 'stone'), 32);
  run(g, 4);
  assert.equal(count(g, 'stone'), 0); // the whole piece crumbled, not just the wet face
  assert.ok(count(g, 'sand') + count(g, 'mud') > 0);
});
test('fire against a wood piece burns the whole piece, not one column', () => {
  const g = setup();
  block(g, 0, GH - 4, 40, 4, 'stone');
  block(g, 8, GH - 12, 4, 8, 'fire');
  block(g, 12, GH - 12, 12, 8, 'wood');
  run(g, 15);
  assert.equal(count(g, 'wood'), 0);
  assert.equal(count(g, 'fire'), 32);
});

test('fire against an ice piece melts the whole piece', () => {
  const g = setup();
  block(g, 0, GH - 4, 40, 4, 'stone');
  block(g, 8, GH - 12, 4, 8, 'fire');
  block(g, 12, GH - 12, 12, 8, 'ice');
  run(g, 10);
  assert.equal(count(g, 'ice'), 0);
});

test('fire does not jump to a different wood piece', () => {
  const g = setup();
  block(g, 0, GH - 4, 40, 4, 'stone');
  block(g, 8, GH - 8, 4, 4, 'fire');
  block(g, 12, GH - 8, 4, 4, 'wood');
  block(g, 16, GH - 8, 4, 4, 'wood');
  run(g, 15);
  assert.equal(count(g, 'wood'), 16); // the second piece never caught
});

test('glass melted from both sides of a fire joins into one pane', () => {
  const g = setup();
  block(g, 0, GH - 4, 40, 4, 'stone');
  for (let y = GH - 12; y < GH - 4; y++) for (let x = 4; x < 28; x++) if (x < 14 || x >= 18) put(g, x, y, 'sand');
  block(g, 14, GH - 12, 4, 8, 'fire');
  run(g, 4);
  const panes = new Set(g.grid.flat().filter((c) => c && c.m === 'glass').map((c) => c.id));
  assert.ok(count(g, 'glass') > 0);
  assert.equal(panes.size, 1);
});

test('the combo multiplier caps at 4', () => {
  const g = setup();
  block(g, 0, 20, 40, 40, 'wood');
  g.meter = 1;
  activatePower(g);
  assert.equal(g.mult, 4);
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

test('fire melts sand to glass and melts ice, and leaves mud alone', () => {
  const g = setup();
  put(g, 10, GH - 1, 'sand');
  put(g, 11, GH - 1, 'fire');
  put(g, 12, GH - 1, 'mud');
  put(g, 19, GH - 1, 'glass');
  put(g, 20, GH - 1, 'ice');
  put(g, 21, GH - 1, 'fire');
  put(g, 22, GH - 1, 'glass');
  run(g, 0.9);
  assert.equal(g.grid[GH - 1][10].m, 'glass');
  assert.equal(g.grid[GH - 1][12].m, 'mud');
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

test('wood in water floats up and gets eaten away', () => {
  const g = setup();
  block(g, 4, GH - 1, 4, 1, 'wetwood');
  for (let x = 4; x < 8; x++) put(g, x, GH - 2, 'water');
  for (const x of [3, 8]) { put(g, x, GH - 1, 'stone'); put(g, x, GH - 2, 'stone'); }
  tick(g, DT);
  for (let x = 4; x < 8; x++) assert.notEqual(g.grid[GH - 1][x]?.m, 'wetwood');
  assert.ok(g.drained > 0);
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

test('a block landing on glass that is itself part of a falling block does not crash', () => {
  const g = setup();
  block(g, 0, GH - 4, 40, 4, 'stone');
  // A glass pane falling under a brick block: when the brick lands on it, the pane smashes
  // while the pane is still waiting for its own turn to move.
  const pane = block(g, 8, 20, 16, 4, 'glass');
  put(g, 30, 30, 'glass', pane); // a stray bit of the same pane elsewhere
  block(g, 8, 4, 16, 4, 'brick');
  assert.doesNotThrow(() => run(g, 4));
});

test('two-material pieces keep each half as its own material, even after rotating', () => {
  const g = setup();
  block(g, 0, GH - 4, GW, 4, 'stone');
  g.piece = { m: 'fire', mats: ['fire', 'fire', 'wood', 'wood'], cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 2, y: 0 };
  rotate(g);
  assert.deepEqual(pieceMats(g.piece), ['fire', 'fire', 'wood', 'wood']);
  hardDrop(g);
  const mats = new Set(g.grid.flat().filter((c) => c && c.m !== 'stone').map((c) => c.m));
  assert.ok(mats.has('fire') && mats.has('wood'));
});

test('mixed pieces start at level 8', () => {
  assert.equal(levelConfig(7).mixed, 0);
  assert.ok(levelConfig(8).mixed > 0);
  let seed = 12345; // mulberry32, a small seeded generator with no short cycles
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = createGame({ level: 30, rand, config: { ...levelConfig(30), mode: 'normal' } });
  let mixed = 0;
  for (let i = 0; i < 40; i++) {
    const mats = pieceMats(g.piece);
    if (new Set(mats).size > 1) {
      mixed++;
      const [a, b] = [mats[0], mats[3]];
      const bad = [['fire', 'water'], ['fire', 'wood'], ['fire', 'ice'], ['fire', 'sand'], ['water', 'sand'], ['water', 'wood'], ['water', 'ice']];
      assert.ok(!bad.some(([x, y]) => (a === x && b === y) || (a === y && b === x)), `${a} + ${b} would cancel itself`);
    }
    g.grid = emptyGrid(); // keep the board empty so every drop spawns a fresh piece
    hardDrop(g);
  }
  assert.ok(mixed >= 5 && mixed <= 32, `mixed ${mixed}/40`);
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
  block(g, 16, GH - 8, 4, 8, 'glass');
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

// BUG LOG #1 (found by the validator in the rig): fall distance was kept per piece id, so
// it leaked for pieces destroyed mid-fall, and the two halves of a split piece shared it.
test('regression: halves of a split piece track their own falls', () => {
  const g = setup();
  // One wood piece in two halves: the left half rests on glass, the right half hangs high
  // over another pane.
  const id = ++autoId;
  for (let y = GH - 8; y < GH - 4; y++) for (let x = 0; x < 4; x++) put(g, x, y, 'wood', id);
  for (let y = GH - 40; y < GH - 36; y++) for (let x = 20; x < 24; x++) put(g, x, y, 'wood', id);
  block(g, 0, GH - 4, 4, 4, 'glass');
  block(g, 20, GH - 4, 4, 4, 'glass');
  run(g, 1.5);
  // The right half fell a long way and smashed its pane; the left half never moved, so the
  // pane under it is whole. (Before the fix the resting half reset the shared counter every
  // tick, so the falling half never smashed anything.)
  assert.equal(g.smashed, 1);
  assert.equal(count(g, 'glass'), 16);
  assert.ok(g.grid[GH - 1][1].m === 'glass');
});

test('regression: a block destroyed while falling leaves nothing behind', () => {
  const g = setup();
  block(g, 4, GH - 30, 4, 4, 'ice');
  block(g, 4, GH - 20, 4, 4, 'fire');
  run(g, 2);
  assert.equal('falls' in g, false);
  for (const row of g.grid) for (const c of row) if (c && c.fall) assert.ok(Number.isFinite(c.fall));
});

test('piece budget: when the pieces run out, reactions finish, then the level is lost', () => {
  const g = createGame({ level: 1, rand: fixed, config: { ...baseConfig({ bag: ['water'] }), pieces: 2 } });
  g.grid = emptyGrid();
  block(g, 0, GH - 8, 48, 8, 'fire');
  hardDrop(g); // first piece
  assert.ok(g.piece); // second piece
  hardDrop(g);
  assert.equal(g.piece, null);
  assert.notEqual(g.settling, null);
  assert.equal(g.state, 'play');
  run(g, 1.5);
  assert.equal(g.state, 'play'); // still dousing: keep waiting
  run(g, 6);
  assert.equal(g.state, 'lose');
  assert.equal(g.loseReason, 'pieces');
  assert.ok(revive(g));
  assert.equal(g.state, 'play');
  assert.ok(g.piece);
  assert.equal(g.left, 4); // five more, one already falling
});

test('piece budget: a reaction that fills the bar after the last piece still wins', () => {
  const g = createGame({ level: 1, rand: fixed, config: { ...baseConfig({ bag: ['water'], goal: { pieces: 2 } }), pieces: 1 } });
  g.grid = emptyGrid();
  block(g, 0, GH - 8, 48, 8, 'fire');
  hardDrop(g);
  assert.equal(g.piece, null);
  run(g, 5);
  assert.equal(g.state, 'win');
});

test('topping out says so, and the revive clears the top instead', () => {
  const g = setup();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (x % 8 !== 0) put(g, x, y, 'glass', 1);
  g.piece = { m: 'brick', cells: [[0, 0], [1, 0]], x: 3, y: 0 };
  hardDrop(g);
  assert.equal(g.loseReason, 'top');
});
