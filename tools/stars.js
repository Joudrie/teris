// Star thresholds from play: the share of the piece budget left when a level is cleared.
// Plays the casual (human-ish) bot over levels 1-60 without the revive and reports the
// distribution, so 3 stars go to roughly the best fifth of first-try clears.
//
//   node tools/stars.js [--games 12]

import { createGame, update, piecesLeft } from '../src/core.js';
import { levelConfig } from '../src/levels.js';
import { createBot, botStep, mulberry32 } from './bots.js';

const games = +(process.argv[process.argv.indexOf('--games') + 1] || 12);
const shares = [];
const DT = 1 / 30;
for (let level = 1; level <= 60; level++) {
  for (let k = 0; k < games; k++) {
    const seed = 50000 + level * 101 + k;
    const g = createGame({ level, rand: mulberry32(seed), config: levelConfig(level) });
    const bot = createBot(level <= 8 ? 'newbie' : 'human', mulberry32(seed ^ 0x9e3779b9));
    for (let t = 0; t < 420 && g.state === 'play'; t += DT) {
      botStep(bot, g, DT);
      update(g, DT);
      g.events.length = 0;
    }
    if (g.state === 'win') shares.push(piecesLeft(g) / g.cfg.pieces);
  }
}
shares.sort((a, b) => a - b);
const q = (p) => shares[Math.floor(p * (shares.length - 1))];
console.log(`wins: ${shares.length}`);
for (const p of [0.25, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) console.log(`p${Math.round(p * 100)} share left: ${q(p).toFixed(3)}`);
