// One screenshot per mechanic test card, at 390x844, in a real browser with ?debug&scene=<id>.
// The inputs are sent as key presses after the scene is set up, and the shot is taken just
// after the effect first shows (timed from the headless run of the same scene).
//
//   node tools/browser/cards.mjs [id ...]

import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, phone, ROOT } from './lib.mjs';
import { SCENES, playScene } from '../../src/scenes.js';
import { createSession } from '../../src/session.js';
import { mulberry32 } from '../bots.js';

const SHOTS = path.join(ROOT, 'docs/shots');
fs.mkdirSync(SHOTS, { recursive: true });
const KEY = { left: 'ArrowLeft', right: 'ArrowRight', rotate: 'ArrowUp', soft: 'ArrowDown', slam: ' ', power: 'f' };

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
const { srv, url } = await serve();
const browser = await launch();
const report = {};
for (const id of ids) {
  const sc = SCENES[id];
  const headless = playScene(createSession({ rand: mulberry32(1), now: () => Date.UTC(2026, 9, 15, 12) }), id);
  const after = sc.shot ?? Math.min(sc.wait, (headless.first ?? 0) + 0.35);
  const p = await phone(browser, { width: 390, height: 844 });
  p.ctx.setDefaultTimeout(8000);
  await p.page.goto(`${url}?debug&scene=${id}`);
  await p.page.waitForFunction(() => window.mb && mb.sceneReady);
  for (const a of sc.actions) {
    if (typeof a === 'object') await p.page.waitForTimeout(a.wait * 1000);
    else await p.page.keyboard.press(KEY[a]);
  }
  await p.page.waitForTimeout(after * 1000);
  const file = `card-${id}.jpg`;
  await p.page.screenshot({ path: path.join(SHOTS, file), type: 'jpeg', quality: 65 });
  // Then let it play out and check the scene's outcome happened in the browser too.
  await p.page.waitForTimeout(Math.max(0, sc.wait - after) * 1000 + 300);
  const ok = await p.page.evaluate(async (sid) => { const { SCENES: S } = await import('./src/scenes.js'); return !!S[sid].check(mb.game, mb.sess); }, id);
  report[id] = { ok, shotAt: +after.toFixed(2), first: headless.first, last: headless.last, errors: p.errors };
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(13)} shot at ${after.toFixed(2)} s  ${p.errors.join(' | ')}`);
  await p.ctx.close();
}
await browser.close();
srv.close();
const out = path.join(SHOTS, 'cards.json');
const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
fs.writeFileSync(out, JSON.stringify({ ...prev, ...report }, null, 1));
