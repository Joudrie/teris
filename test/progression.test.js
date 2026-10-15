// The teaching levels must work for someone on their first session (the newbie bot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from '../tools/rig.js';

// BUG LOG #12 (browser hook check): after combos started counting on the bar, level 1's
// budget came from the casual bot and a first-timer ran out of pieces at 80%.
test('regression: a first-timer clears level 1, within two minutes, every time', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const r = playGame({ level: 1, bot: 'newbie', seed: 5000 + seed, useRevive: false });
    assert.ok(r.won, `seed ${seed}: lost at ${Math.round((r.lostAt ?? 0) * 100)}%`);
    assert.ok(r.time <= 120, `seed ${seed}: ${r.time.toFixed(0)} s`);
    assert.ok(r.firstDrain <= 10, `seed ${seed}: first drain at ${r.firstDrain}`);
  }
});

test('levels 2 and 3 are near-certain for a first-timer too', () => {
  for (const level of [2, 3]) {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) if (playGame({ level, bot: 'newbie', seed: 6000 + seed, useRevive: false }).won) wins++;
    assert.ok(wins >= 5, `level ${level}: ${wins}/6`);
  }
});
