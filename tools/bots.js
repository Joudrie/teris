// Three bot players for the headless rig.
//
//   random  - mashes: random turn, random column, random drop. The floor: what luck alone gets.
//   smart   - sees every placement, scores it, acts instantly. The ceiling.
//   human   - the smart scorer with a human's hands and eyes: it reacts late, moves one input
//             at a time, misjudges scores, sometimes blunders, and doesn't always slam.
//
// A bot never touches the board directly; it only sends the same inputs a player can.

import {
  COLS, GW, GH, S, collide, move, rotate, softDrop, hardDrop, activatePower, pieceMats,
} from '../src/core.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N4 = [[0, 1], [1, 0], [-1, 0], [0, -1]];
const at = (g, x, y) => (x >= 0 && x < GW && y >= 0 && y < GH ? g.grid[y][x] : undefined);

function turn(cells) {
  const r = cells.map(([a, b]) => [-b, a]);
  const mx = Math.min(...r.map(([a]) => a));
  const my = Math.min(...r.map(([, b]) => b));
  return r.map(([a, b]) => [a - mx, b - my]);
}

// What one particle of a piece material is worth next to one board particle.
// Positive: they react and drain. Negative: they make things worse.
const VALUE = {
  fire: { water: 6, wood: 3, wetwood: 2, ice: 2.5, sand: 1, mud: -0.5 },
  water: { fire: 6, wood: 2.5, wetwood: 3, sand: 3, mud: 1, ice: -1.5, brick: 0.3, stone: 0.2 },
  wood: { fire: 3, water: 1.5 },
  wetwood: { fire: 2, water: 2 },
  ice: { fire: 3, water: -1 },
  sand: { water: 3, fire: 1.5 },
  stone: { water: 0.3 },
  brick: { water: 0.5 },
  glass: {},
};

// Height of the stack in particle rows, ignoring loose water near the top.
function stackTop(g) {
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) if (g.grid[y][x]) return y;
  }
  return GH;
}

// Scores the piece landing at (cells, x, y).
export function scorePlacement(g, cells, mats, x, y, slam) {
  const mine = new Set();
  for (const [a, b] of cells) {
    for (let fy = y + b * S; fy < y + b * S + S; fy++) {
      for (let fx = (x + a) * S; fx < (x + a) * S + S; fx++) mine.add(fy * GW + fx);
    }
  }
  let score = 0;
  let holes = 0;
  let glassHit = 0;
  cells.forEach(([a, b], i) => {
    const m = mats[i];
    const val = VALUE[m] || {};
    const x0 = (x + a) * S;
    const y0 = y + b * S;
    for (let k = 0; k < S; k++) {
      // Four sides of the 4x4 patch.
      for (const [px, py] of [[x0 + k, y0 + S], [x0 + k, y0 - 1], [x0 - 1, y0 + k], [x0 + S, y0 + k]]) {
        if (mine.has(py * GW + px)) continue;
        const n = at(g, px, py);
        if (!n) {
          if (py === y0 + S && py < GH) holes++;
          continue;
        }
        score += val[n.m] || 0;
        if (py === y0 + S && n.m === 'glass' && (slam || m === 'stone')) glassHit++;
      }
    }
    // Water and sand run: credit what the run-off will reach below and beside.
    if (m === 'water' || m === 'sand') score += runoff(g, x0, y0 + S, m, mine);
  });
  // Covering fire with something that isn't water buries it where water can't reach.
  cells.forEach(([a, b], i) => {
    if (mats[i] === 'water') return;
    const y1 = y + b * S + S;
    for (let fx = (x + a) * S; fx < (x + a) * S + S; fx++) {
      const n = at(g, fx, y1);
      if (n && n.m === 'fire' && mats[i] !== 'wood' && mats[i] !== 'ice' && mats[i] !== 'sand') score -= 1.5;
    }
  });
  score += glassHit * 4;
  const loose = mats.every((m) => m === 'water' || m === 'sand');
  if (!loose) score -= holes * 0.6;
  // Height: lower is better, and much better when the stack is near the top.
  const topRow = y + Math.min(...cells.map(([, b]) => b)) * S;
  const fill = 1 - topRow / GH; // 0 at the floor, 1 at the ceiling
  score -= fill * fill * 120;
  // Keep the spawn columns clear.
  const centre = cells.some(([a]) => x + a >= 4 && x + a <= 7);
  if (centre && fill > 0.55) score -= 40;
  return score;
}

// Water and sand fall and spread; look a little way down from where they land.
function runoff(g, x0, y0, m, mine) {
  const val = VALUE[m];
  let s = 0;
  const seen = new Set();
  const stack = [];
  for (let k = 0; k < S; k++) stack.push([x0 + k, y0]);
  let budget = m === 'water' ? 160 : 40;
  while (stack.length && budget-- > 0) {
    const [px, py] = stack.pop();
    const key = py * GW + px;
    if (seen.has(key) || px < 0 || px >= GW || py >= GH || py < 0) continue;
    seen.add(key);
    const c = at(g, px, py);
    if (c && !mine.has(key)) {
      s += (val[c.m] || 0) * 0.35;
      continue;
    }
    stack.push([px, py + 1]);
    if (m === 'water') { stack.push([px - 1, py]); stack.push([px + 1, py]); }
  }
  return s;
}

// Every place the current piece can go: rotation count, column, landing row, score.
export function placements(g, slam = true) {
  const p = g.piece;
  if (!p) return [];
  const mats = pieceMats(p);
  const out = [];
  let cells = p.cells;
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    const key = JSON.stringify(cells);
    if (!seen.has(key)) {
      seen.add(key);
      for (let x = -3; x < COLS; x++) {
        if (collide(g, cells, x, p.y)) continue;
        // Must be reachable in a straight slide at the current height.
        let ok = true;
        const dir = Math.sign(x - p.x);
        for (let k = p.x; k !== x; k += dir) if (collide(g, cells, k, p.y)) { ok = false; break; }
        if (!ok) continue;
        let y = p.y;
        while (!collide(g, cells, x, y + 1)) y++;
        out.push({ r, x, y, cells, score: scorePlacement(g, cells, mats, x, y, slam) });
      }
    }
    cells = turn(cells);
  }
  return out;
}

// ---------- controllers ----------

// A plan is a list of inputs; the bot sends them one at a time at its input rate.
function planInputs(g, target, drop) {
  const inputs = [];
  for (let i = 0; i < target.r; i++) inputs.push('rotate');
  inputs.push({ moveTo: target.x, cells: target.cells });
  inputs.push(drop);
  return inputs;
}

const PROFILES = {
  random: { delay: [0.1, 0.4], rate: 0.12, noise: 0, blunder: 1, slam: 0.5, powerDelay: [0.5, 3], noticePower: 0.6 },
  smart: { delay: [0, 0], rate: 0, noise: 0, blunder: 0, slam: 1, powerDelay: [0, 0], noticePower: 1 },
  // A casual phone player: half a second to read the piece, about eight swipes a second,
  // judges well but not perfectly, drags down about half the time instead of flicking.
  human: { delay: [0.35, 0.9], rate: 0.12, noise: 5, blunder: 0.07, slam: 0.55, powerDelay: [0.4, 2.5], noticePower: 0.9, slamGlass: 0.75 },
};

export function createBot(kind, rand) {
  const prof = PROFILES[kind];
  if (!prof) throw new Error(`unknown bot ${kind}`);
  return { kind, prof, rand, piece: null, wait: 0, inputs: [], cool: 0, powerWait: null, powers: 0 };
}

const between = (rand, [a, b]) => a + (b - a) * rand();
function gauss(rand) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

function choose(bot, g) {
  const { prof, rand } = bot;
  const options = placements(g);
  if (!options.length) return null;
  if (rand() < prof.blunder) return options[Math.floor(rand() * options.length)];
  let best = null;
  for (const o of options) {
    const s = o.score + (prof.noise ? gauss(rand) * prof.noise : 0);
    if (!best || s > best.s) best = { ...o, s };
  }
  return best;
}

function dropKind(bot, g, target) {
  const { prof, rand } = bot;
  if (prof.slam >= 1) return 'slam';
  // A human who sees glass under the piece flicks to smash it more often than not.
  if (prof.slamGlass && target && glassBelow(g, target) && rand() < prof.slamGlass) return 'slam';
  return rand() < prof.slam ? 'slam' : 'drag';
}

function glassBelow(g, t) {
  for (const [a, b] of t.cells) {
    const y1 = t.y + b * S + S;
    for (let fx = (t.x + a) * S; fx < (t.x + a) * S + S; fx++) if (at(g, fx, y1)?.m === 'glass') return true;
  }
  return false;
}

// Called before each game update with the frame's dt. Sends at most one input per call
// for bots with an input rate; the smart bot does everything at once.
export function botStep(bot, g, dt) {
  if (g.state !== 'play') return;
  const { prof, rand } = bot;

  // Power: fire it once the meter is full and the bot has noticed.
  if (g.meter >= 1) {
    if (bot.powerWait === null) bot.powerWait = rand() < prof.noticePower ? between(rand, prof.powerDelay) : 1e9;
    bot.powerWait -= dt;
    if (bot.powerWait <= 0 && activatePower(g)) {
      bot.powers++;
      bot.powerWait = null;
    }
  } else {
    bot.powerWait = null;
  }

  if (!g.piece) return;
  if (g.piece !== bot.piece) {
    bot.piece = g.piece;
    bot.wait = between(rand, prof.delay);
    bot.inputs = null;
  }
  if (bot.wait > 0) {
    bot.wait -= dt;
    return;
  }
  if (!bot.inputs) {
    const target = bot.kind === 'random' ? randomTarget(bot, g) : choose(bot, g);
    if (!target) return;
    bot.inputs = planInputs(g, target, bot.kind === 'random' ? (rand() < 0.5 ? 'slam' : 'drag') : dropKind(bot, g, target));
  }
  bot.cool -= dt;
  let budget = prof.rate === 0 ? 100 : 1;
  while (budget > 0 && bot.inputs.length && (prof.rate === 0 || bot.cool <= 0)) {
    budget--;
    bot.cool = prof.rate;
    const inp = bot.inputs[0];
    if (inp === 'rotate') { rotate(g); bot.inputs.shift(); continue; }
    if (inp.moveTo !== undefined) {
      const p = g.piece;
      if (!p) return;
      if (p.x === inp.moveTo) { bot.inputs.shift(); continue; }
      if (!move(g, Math.sign(inp.moveTo - p.x))) bot.inputs.shift(); // blocked: give up on the slide
      continue;
    }
    if (inp === 'slam') { hardDrop(g); bot.inputs.shift(); return; }
    if (inp === 'drag') {
      // Drag down: soft drops until it lands (the piece locks by gravity).
      softDrop(g);
      if (prof.rate === 0) return;
      return;
    }
  }
}

function randomTarget(bot, g) {
  const options = placements(g, false);
  if (!options.length) return null;
  return options[Math.floor(bot.rand() * options.length)];
}
