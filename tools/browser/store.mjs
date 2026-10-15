// Renders the six App Store screenshots (1290 x 2796) from docs/redesign/store/store.html.
//   node tools/browser/store.mjs   (run after shoot.mjs has refreshed docs/redesign/after/)
import path from 'node:path';
import { launch, serve, ROOT } from './lib.mjs';

const { srv, url } = await serve();
const browser = await launch();

// Moment shots on a paused clock, so each one lands on the exact frame every run: numbers in
// `steps` advance game time by that many ms, strings are key presses.
async function moment(scene, steps, out) {
  const c = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  await p.clock.install();
  await p.goto(`${url}?debug&scene=${scene}`);
  await p.clock.runFor(500);
  await p.waitForFunction(() => window.mb && mb.sceneReady);
  await p.evaluate(() => document.fonts.ready);
  await p.clock.runFor(300);
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 50);
  await p.clock.runFor(100);
  for (const k of steps) { if (typeof k === 'number') await p.clock.runFor(k); else await p.keyboard.press(k); }
  await p.screenshot({ path: path.join(ROOT, 'docs/redesign/after', out), type: 'jpeg', quality: 88 });
  await c.close();
}
// Two water pieces slammed into a fire field: the second one is caught mid-cancel, its last
// sliver of water boiling into the fire under rising steam, with the combo word up.
await moment('combo', [' ', 400, ' ', 250], 'moment-combo@430x932.jpg');
// The power's colour flash has mostly cleared by 450 ms; debris and goal orbs are still in the air.
await moment('blaze', ['f', 450], 'moment-power@430x932.jpg');
const ctx = await browser.newContext({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`${url}docs/redesign/store/store.html`);
await page.waitForFunction(() => window.ready);
await page.waitForTimeout(300);
for (const [i, id] of [[1, 's1'], [2, 's2'], [3, 's3'], [4, 's4'], [5, 's5'], [6, 's6']]) {
  await page.locator(`#${id}`).screenshot({ path: path.join(ROOT, `docs/redesign/store/screen-${i}.jpg`), type: 'jpeg', quality: 88 });
  console.log(`screen-${i}`);
}
await browser.close();
srv.close();
