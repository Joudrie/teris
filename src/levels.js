// Level definitions. Four themes rotate; each has a main material and a matching power.
// Every pool carries both fire and water so there is always something to cancel.

export const POWERS = {
  blaze: { label: 'Fire Mode', clears: ['wood', 'wetwood'] },
  freeze: { label: 'Deep Freeze', clears: ['water', 'ice'] },
  sweep: { label: 'Sandstorm', clears: ['sand', 'mud'] },
  hammer: { label: 'Hammer', clears: ['glass', 'brick', 'stone'] },
};

const THEMES = [
  { main: 'wood', power: 'blaze', pool: { wood: 30, fire: 25, water: 25, sand: 10, stone: 10 } },
  { main: 'water', power: 'freeze', pool: { water: 30, fire: 25, ice: 20, sand: 15, stone: 10 } },
  { main: 'sand', power: 'sweep', pool: { sand: 30, fire: 25, water: 20, glass: 15, stone: 10 } },
  { main: 'glass', power: 'hammer', pool: { glass: 30, stone: 20, brick: 15, fire: 20, water: 15 } },
];

export function levelConfig(level, { help = false } = {}) {
  const theme = THEMES[(level - 1) % THEMES.length];
  const pool = { ...theme.pool };
  // Helping hand: after repeated losses the main material shows up more, and the player is told.
  if (help) pool[theme.main] *= 2;

  // Drain this many four-cell pieces' worth of material to clear the level.
  const goal = { pieces: 15 + Math.floor((level - 1) / 5) };

  let mode = 'normal';
  if (level >= 5 && theme.main === 'water' && level % 2 === 0) mode = 'flood';
  if (level >= 5 && theme.main === 'wood' && level % 2 === 1) mode = 'prefill';

  const quest = level % 2 ? { type: 'chain', n: 3 } : { type: 'douse', n: 2 };

  return { main: theme.main, power: theme.power, pool, goal, mode, quest, help };
}
