// Level definitions. Four themes rotate; each has a main material and a matching power.

export const POWERS = {
  blaze: { label: 'Fire Mode', clears: ['wood', 'wetwood'] },
  freeze: { label: 'Deep Freeze', clears: ['water', 'ice'] },
  sweep: { label: 'Sandstorm', clears: ['sand', 'mud'] },
  hammer: { label: 'Hammer', clears: ['glass', 'brick', 'stone'] },
};

// Every level spawns every core material. Fire and water are the most common because
// they cancel the most; the theme only nudges its main material up a little.
const BASE_POOL = { fire: 22, water: 22, wood: 16, sand: 16, ice: 12, glass: 6, stone: 4, brick: 2 };
const THEME_BONUS = 10;

const THEMES = [
  { main: 'wood', power: 'blaze' },
  { main: 'water', power: 'freeze' },
  { main: 'sand', power: 'sweep' },
  { main: 'glass', power: 'hammer' },
];

export function levelConfig(level, { help = false } = {}) {
  const theme = THEMES[(level - 1) % THEMES.length];
  const pool = { ...BASE_POOL };
  pool[theme.main] += THEME_BONUS;
  // Helping hand: after repeated losses, more fire and water (the cancellers), and the player is told.
  if (help) {
    pool.fire *= 1.5;
    pool.water *= 1.5;
  }

  // Drain this many four-cell pieces' worth of material to clear the level.
  const goal = { pieces: 15 + Math.floor((level - 1) / 5) };

  let mode = 'normal';
  if (level >= 5 && theme.main === 'water' && level % 2 === 0) mode = 'flood';
  if (level >= 5 && theme.main === 'wood' && level % 2 === 1) mode = 'prefill';

  const quest = level % 2 ? { type: 'chain', n: 3 } : { type: 'douse', n: 2 };

  return { main: theme.main, power: theme.power, pool, goal, mode, quest, help };
}
