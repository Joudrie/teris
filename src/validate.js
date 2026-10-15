// Debug-only invariant checks. The rig and fuzzer run these after every tick; the browser
// runs them every frame with ?debug. Each failed check is a short string, so a run can
// collect them all instead of stopping at the first.

import { COLS, GW, GH, S, pieceMats } from './core.js';

const STATES = new Set(['play', 'win', 'lose']);
const MATS = new Set(['fire', 'water', 'wood', 'wetwood', 'ice', 'sand', 'mud', 'glass', 'brick', 'stone']);
const RIGID = new Set(['stone', 'ice', 'glass', 'brick', 'wood', 'wetwood', 'fire']);
export const MAX_MULT = 4;

// Keeps what a check needs to remember between ticks (drained must never go down).
export function createValidator() {
  return { lastDrained: 0, lastLevel: null };
}

const bad = (n) => typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n);

export function validate(g, v = createValidator()) {
  const errs = [];
  if (!STATES.has(g.state)) errs.push(`state is ${g.state}`);

  if (bad(g.meter) || g.meter < 0 || g.meter > 1) errs.push(`meter out of range: ${g.meter}`);
  if (bad(g.mult) || g.mult < 1 || g.mult > MAX_MULT) errs.push(`mult out of range: ${g.mult}`);
  if (bad(g.drained)) errs.push(`drained is ${g.drained}`);
  if (v.lastLevel === g && g.drained < v.lastDrained) errs.push(`drained went down ${v.lastDrained} -> ${g.drained}`);
  v.lastLevel = g;
  v.lastDrained = g.drained;

  // The bag is refilled on the next draw, so the queued piece must always be real.
  if (g.state === 'play') {
    if (!g.next || !g.next.mats || g.next.mats.length !== 4) errs.push('no next piece');
    else for (const m of g.next.mats) if (!MATS.has(m)) errs.push(`next piece has material ${m}`);
    if (!g.piece && g.settling === null) errs.push('playing with no falling piece');
    if (g.piece && g.settling !== null) errs.push('a piece is falling while the level is settling');
    if (!(g.left >= 0)) errs.push(`pieces left is ${g.left}`);
  }
  if (!Array.isArray(g.bag)) errs.push('bag is not a list');

  const p = g.piece;
  if (p) {
    const mats = pieceMats(p);
    if (mats.length !== p.cells.length) errs.push('piece materials do not match its cells');
    for (const [a, b] of p.cells) {
      const cx = p.x + a;
      if (cx < 0 || cx >= COLS) errs.push(`piece outside board at column ${cx}`);
      for (let fy = p.y + b * S; fy < p.y + b * S + S; fy++) {
        if (fy < 0 || fy >= GH) continue;
        for (let fx = cx * S; fx < cx * S + S; fx++) {
          if (fx >= 0 && fx < GW && g.grid[fy][fx]) {
            errs.push(`particle ${g.grid[fy][fx].m} inside the falling piece at ${fx},${fy}`);
            fy = GH; // one report per cell is enough
            break;
          }
        }
      }
    }
  }

  if (g.grid.length !== GH) errs.push(`grid has ${g.grid.length} rows`);
  for (let y = 0; y < GH; y++) {
    const row = g.grid[y];
    if (row.length !== GW) errs.push(`row ${y} has ${row.length} cells`);
    for (let x = 0; x < GW; x++) {
      const c = row[x];
      if (!c) continue;
      if (!MATS.has(c.m)) errs.push(`unknown material ${c.m} at ${x},${y}`);
      if (bad(c.heat)) errs.push(`heat is ${c.heat} at ${x},${y}`);
      if (bad(c.frz)) errs.push(`frz is ${c.frz} at ${x},${y}`);
      if (c.id === undefined || c.id === null || bad(c.id)) errs.push(`particle without id at ${x},${y}`);
      if (c.fall !== undefined && bad(c.fall)) errs.push(`fall is ${c.fall} at ${x},${y}`);
    }
  }
  return errs;
}
