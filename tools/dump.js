// Prints a board as text, one character per cell (majority material of its 4x4 patch).
import { GW, GH, S } from '../src/core.js';
const CH = { fire: 'F', water: '~', wood: 'W', wetwood: 'w', ice: 'I', sand: '.', mud: 'm', glass: 'G', brick: 'B', stone: 'S' };
export function dump(g) {
  const lines = [];
  for (let cy = 0; cy < GH / S; cy++) {
    let line = '';
    for (let cx = 0; cx < GW / S; cx++) {
      const t = {};
      for (let y = cy * S; y < cy * S + S; y++) for (let x = cx * S; x < cx * S + S; x++) { const c = g.grid[y][x]; if (c) t[c.m] = (t[c.m] || 0) + 1; }
      const best = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
      line += best ? (best[1] >= 4 ? CH[best[0]] : CH[best[0]].toLowerCase()) : ' ';
    }
    lines.push(`|${line}|`);
  }
  return lines.join('\n');
}
