// Level definitions. Four themes rotate; each theme has a main material, a matching power,
// and a "make" recipe used on make-material levels.

export const POWERS = {
  blaze: { label: 'Fire Mode', clears: ['wood', 'wetwood'] },
  freeze: { label: 'Deep Freeze', clears: ['water', 'ice'] },
  sweep: { label: 'Sandstorm', clears: ['sand', 'mud'] },
  hammer: { label: 'Hammer', clears: ['glass', 'brick'] },
};

const THEMES = [
  {
    main: 'wood', power: 'blaze',
    pool: { wood: 40, water: 20, stone: 20, sand: 10, fire: 10 },
    make: { m: 'wetwood', label: 'wet wood', recipe: 'water + wood' },
  },
  {
    main: 'water', power: 'freeze',
    pool: { water: 35, ice: 25, sand: 20, stone: 20 },
    make: { m: 'ice', label: 'ice', recipe: 'water next to ice' },
  },
  {
    main: 'sand', power: 'sweep',
    pool: { sand: 40, water: 20, fire: 15, stone: 25 },
    make: { m: 'glass', label: 'glass', recipe: 'sand + fire' },
  },
  {
    main: 'glass', power: 'hammer',
    pool: { glass: 35, brick: 20, stone: 25, sand: 20 },
    make: { m: 'shatter', label: 'glass smashed', recipe: 'slam onto glass' },
  },
];

export function levelConfig(level, { help = false } = {}) {
  const theme = THEMES[(level - 1) % THEMES.length];
  const pool = { ...theme.pool };
  // Helping hand: after repeated losses the main material shows up more, and the player is told.
  if (help) pool[theme.main] *= 2;

  const goal = level % 3 === 0
    ? { type: 'make', m: theme.make.m, label: theme.make.label, recipe: theme.make.recipe, cells: 3 + Math.floor(level / 25) }
    : { type: 'score', target: 400 + level * 20 };

  let mode = 'normal';
  if (level >= 5 && theme.main === 'water' && level % 2 === 0) mode = 'flood';
  if (level >= 5 && theme.main === 'wood' && level % 2 === 1) mode = 'prefill';

  const quest = level % 2 ? { type: 'chain', n: 3 } : { type: 'breaks', n: 3 };

  return { main: theme.main, power: theme.power, pool, goal, mode, quest, help };
}
