// Renders the six App Store screenshots (1290 x 2796) from docs/redesign/store/store.html.
//   node tools/browser/store.mjs   (run after shoot.mjs has refreshed docs/redesign/after/)
import path from 'node:path';
import { launch, serve, ROOT } from './lib.mjs';

const { srv, url } = await serve();
const browser = await launch();

// Moment shots: wait for the event itself, so the praise word or the power burst is on screen.
async function moment(scene, keys, type, delay, out) {
  const c = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  await p.goto(`${url}?debug&scene=${scene}`);
  await p.waitForFunction(() => window.mb && mb.sceneReady);
  await p.evaluate(() => document.fonts.ready);
  for (const k of keys) { if (typeof k === 'number') await p.waitForTimeout(k); else await p.keyboard.press(k); }
  await p.waitForFunction((t) => mb.events.some((e) => e.type === t), type, { timeout: 8000 });
  await p.waitForTimeout(delay);
  await p.screenshot({ path: path.join(ROOT, 'docs/redesign/after', out), type: 'jpeg', quality: 88 });
  await c.close();
}
await moment('combo', [' ', 400, ' '], 'combo', 600, 'moment-combo@430x932.jpg');
await moment('blaze', ['f'], 'power', 140, 'moment-power@430x932.jpg');
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
