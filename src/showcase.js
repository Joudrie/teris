// Static showcase boards for screenshots and art review (not test cards: nothing here is
// checked by the test suite). Load one in the browser with ?debug&showcase=<id>, or from a
// script: import('./src/showcase.js').then(({ SHOWCASE }) => SHOWCASE.lineup(mb.sess)).
// Pair it with mb.freeze = true so loose materials hold still for the shot.

import { emptyGrid, placeBlock, SHAPES, S, GW } from './core.js';
import { start } from './session.js';

function board(s, level, blocks) {
  s.store.set('mb_seen', Array.from({ length: 100 }, (_, i) => i + 1));
  start(s, level);
  const g = s.game;
  g.grid = emptyGrid();
  for (const b of blocks) placeBlock(g, b);
  return g;
}

// Marks part of a block as mid-reaction so the renderer's in-between states show.
function heat(g, x0, y0, w, h, v, key = 'heat') {
  for (let y = y0 * S; y < (y0 + h) * S; y++) {
    for (let x = x0 * S; x < (x0 + w) * S; x++) {
      const c = g.grid[y] && g.grid[y][x];
      if (c) c[key] = v;
    }
  }
}

export const SHOWCASE = {
  // Every material side by side, plus a realistic lower half with reactions mid-way.
  lineup(s) {
    const g = board(s, 12, [
      { m: 'fire', x: 1, y: 2, w: 2, h: 2 },
      { m: 'water', x: 4, y: 2, w: 2, h: 2 },
      { m: 'wood', x: 7, y: 2, w: 2, h: 2 },
      { m: 'wetwood', x: 10, y: 2, w: 2, h: 2 },
      { m: 'ice', x: 1, y: 6, w: 2, h: 2 },
      { m: 'sand', x: 4, y: 6, w: 2, h: 2 },
      { m: 'glass', x: 7, y: 6, w: 2, h: 2 },
      { m: 'mud', x: 10, y: 6, w: 2, h: 2 },
      { m: 'stone', x: 1, y: 10, w: 2, h: 2 },
      { m: 'brick', x: 4, y: 10, w: 2, h: 2 },
      // Lower half: a glass cup of water, a fire bed burning a wood block, stone and brick
      // under a sand heap.
      { m: 'glass', x: 0, y: 15, w: 1, h: 5 },
      { m: 'glass', x: 1, y: 19, w: 2, h: 1 },
      { m: 'glass', x: 3, y: 15, w: 1, h: 5 },
      { m: 'water', x: 1, y: 16, w: 2, h: 3 },
      { m: 'fire', x: 4, y: 18, w: 4, h: 2 },
      { m: 'wood', x: 5, y: 16, w: 2, h: 2 },
      { m: 'stone', x: 8, y: 18, w: 2, h: 2 },
      { m: 'brick', x: 10, y: 18, w: 2, h: 2 },
      { m: 'sand', x: 8, y: 17, w: 4, h: 1 },
      { m: 'ice', x: 8, y: 14, w: 2, h: 1 },
    ]);
    heat(g, 5, 17, 2, 1, 0.5); // the wood's lower half is catching
    // A slumped sand heap rather than a slab.
    for (let x = 8 * S; x < GW; x++) {
      const top = 17 * S + Math.round(Math.abs(x - 10 * S) / 3);
      for (let y = 17 * S; y < top; y++) g.grid[y][x] = null;
    }
    g.piece = { m: 'ice', mats: ['ice', 'ice', 'wood', 'wood'], cells: SHAPES[2].map(([a, b]) => [a, b]), x: 7, y: 9 * S + 2 };
    g.next = { m: 'fire', shape: SHAPES[0], mats: ['fire', 'fire', 'fire', 'fire'] };
    g.meter = 0.62;
    g.drained = 11 * 64;
    return g;
  },

  // A busy mid-game board for the hero shot.
  busy(s) {
    const g = board(s, 18, [
      { m: 'stone', x: 0, y: 17, w: 2, h: 3 },
      { m: 'fire', x: 2, y: 18, w: 3, h: 2 },
      { m: 'wood', x: 5, y: 17, w: 2, h: 3 },
      { m: 'ice', x: 7, y: 18, w: 3, h: 2 },
      { m: 'brick', x: 10, y: 16, w: 2, h: 4 },
      { m: 'glass', x: 7, y: 15, w: 3, h: 1 },
      { m: 'sand', x: 0, y: 15, w: 2, h: 2 },
      { m: 'water', x: 3, y: 16, w: 2, h: 2 },
      { m: 'wetwood', x: 8, y: 13, w: 2, h: 2 },
      { m: 'stone', x: 10, y: 14, w: 2, h: 2 },
    ]);
    heat(g, 5, 17, 1, 3, 0.6);
    g.piece = { m: 'water', mats: ['water', 'water', 'water', 'water'], cells: SHAPES[3].map(([a, b]) => [a, b]), x: 2, y: 6 * S };
    g.next = { m: 'sand', shape: SHAPES[1], mats: ['sand', 'sand', 'sand', 'sand'] };
    g.meter = 1;
    g.drained = 19 * 64;
    g.left = 8;
    return g;
  },
};

export const SHOWCASE_IDS = Object.keys(SHOWCASE);
