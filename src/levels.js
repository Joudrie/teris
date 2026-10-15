// Level definitions. Four themes rotate; each has a main material and a matching power.

export const POWERS = {
  blaze: { label: 'Fire Mode', clears: ['wood', 'wetwood'] },
  freeze: { label: 'Deep Freeze', clears: ['water', 'ice'] },
  sweep: { label: 'Sandstorm', clears: ['sand', 'mud'] },
  hammer: { label: 'Hammer', clears: ['glass', 'brick', 'stone'] },
};

const THEMES = [
  { main: 'wood', power: 'blaze' },
  { main: 'water', power: 'freeze' },
  { main: 'sand', power: 'sweep' },
  { main: 'glass', power: 'hammer' },
];

// Pieces come from a shuffled bag, like a deck of cards: every bag has a fixed mix, so there
// are no long streaks of one material.
//
// The logic behind the mix: fire is a tool (it never runs out on its own and burns through
// whole wood and ice pieces), water is ammo (fire, wood and mud all use it up), and stone is
// the hard leftover that actually clogs a board. As levels go on there is less fire and more
// stone, so placement starts to matter. Tuned with bot playtests: random play clears early
// levels, wins about half the time around 35-50, and almost never past 70.
export function buildBag(level, main, help = false) {
  const bag = { fire: level > 15 ? 1 : 2, water: level <= 10 ? 3 : 2, wood: 1, sand: 1, ice: 1, glass: 1 };
  bag[main] += 1; // a little extra of the level's theme
  if (level > 10) bag.stone = level > 40 ? 2 : 1;
  if (level > 55) bag.brick = 1;
  // Helping hand: one more of each canceller, and the player is told.
  if (help) {
    bag.fire += 1;
    bag.water += 1;
  }
  return Object.entries(bag).flatMap(([m, n]) => Array(n).fill(m));
}

export function levelConfig(level, { help = false } = {}) {
  const theme = THEMES[(level - 1) % THEMES.length];
  const bag = buildBag(level, theme.main, help);

  // Drain this many four-cell pieces' worth of material to clear the level.
  const goal = { pieces: 15 + Math.floor((level - 1) / 4) };

  let mode = 'normal';
  if (level >= 5 && theme.main === 'water' && level % 2 === 0) mode = 'flood';
  if (level >= 5 && theme.main === 'wood' && level % 2 === 1) mode = 'prefill';

  const quest = level % 2 ? { type: 'chain', n: 3 } : { type: 'douse', n: 2 };

  return { main: theme.main, power: theme.power, bag, goal, mode, quest, help };
}
