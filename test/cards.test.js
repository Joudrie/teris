// Every mechanic test card in DESIGN.md has a scripted scene; each one must still happen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, playScene } from '../src/scenes.js';
import { createSession } from '../src/session.js';
import { mulberry32 } from '../tools/bots.js';

for (const id of Object.keys(SCENES)) {
  test(`card: ${SCENES[id].title}`, () => {
    for (const seed of [1, 2, 3]) {
      const s = createSession({ rand: mulberry32(seed), now: () => Date.UTC(2026, 9, 15, 12) });
      const r = playScene(s, id);
      assert.ok(r.ok, `${id} seed ${seed}: ${JSON.stringify(r)}`);
    }
  });
}
