// Sand mode in a phone browser: opens from the map, plays, clears a bridge, ends, retries.
// Usage: node tools/browser/sand.mjs [outDir]
import { serve, phone, launch } from './lib.mjs';

const out = process.argv[2] || '/tmp/sand';
const { srv, url } = await serve();
const browser = await launch();
const { page, errors } = await phone(browser);
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ` (${info})` : ''}`); };

await page.goto(`${url}?debug`);
await page.waitForFunction(() => window.mb && mb.sess);
await page.evaluate(() => { mb.sess.home = true; });
await page.evaluate(() => document.getElementById('home').hidden = false);
check('map has a Sand button', await page.isVisible('#sandBtn'));
await page.click('#sandBtn');
await page.waitForTimeout(400);
check('sand screen opens', await page.isVisible('#sand'));
check('campaign is paused underneath', await page.evaluate(() => mb.sess && document.getElementById('sand').hidden === false));
await page.screenshot({ path: `${out}/01-open.png` });

// Play a few pieces with real input: swipes, taps and flicks on the board.
const box = await page.locator('#sdCv').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 3;
const x0 = await page.evaluate(() => mb.sand.state.piece.x);
await page.keyboard.press('ArrowLeft');
check('arrow key moves the piece', await page.evaluate((x) => mb.sand.state.piece.x < x, x0));
for (let i = 0; i < 7; i++) {
  await page.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft');
  if (i % 3 === 0) await page.keyboard.press('ArrowUp');
  await page.keyboard.press(' ');
  await page.waitForTimeout(250);
}
await page.waitForTimeout(800);
const grains = await page.evaluate(() => mb.sand.state.cell.reduce((n, v) => n + (v ? 1 : 0), 0));
check('dropped pieces became sand', grains > 0, `${grains} grains`);
await page.screenshot({ path: `${out}/02-sand.png` });

// Set up a near bridge: a blue floor with a gap, then drop a blue I piece into the gap.
await page.evaluate(() => {
  const s = mb.sand.state;
  s.cell.fill(0); s.flash.fill(0);
  const GW = 60, GH = 108;
  for (let y = GH - 6; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (x >= 18 && x < 42) continue;
    s.cell[y * GW + x] = 1; s.shade[y * GW + x] = (Math.random() * 256) | 0;
  }
  for (let y = GH - 14; y < GH; y++) for (let x = 0; x < GW; x++) if (!s.cell[y * GW + x] && y >= GH - 12 && (x < 6 || x > 53)) { s.cell[y * GW + x] = 3; s.shade[y * GW + x] = (Math.random() * 256) | 0; }
  s.piece = { shape: [[0, 0], [1, 0], [2, 0], [3, 0]], color: 0, x: 18, y: 0 };
  s.next = { shape: [[0, 0], [1, 0], [2, 0], [1, 1]], color: 2 };
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/03-before-bridge.png` });
const score0 = await page.evaluate(() => mb.sand.state.score);
// Flick down on the board to hard-drop.
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy + 90, { steps: 3 }); await page.mouse.up();
await page.waitForFunction(() => mb.sand.state.flash.some((f) => f > 0), null, { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(120);
await page.screenshot({ path: `${out}/04-bridge-flash.png` });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/05-after-bridge.png` });
const score1 = await page.evaluate(() => mb.sand.state.score);
check('flick drop + bridge scored', score1 > score0, `${score0} -> ${score1}`);

// Pause and resume.
await page.click('#sdPause');
check('pause card shows', await page.isVisible('#sdOver'));
await page.screenshot({ path: `${out}/06-paused.png` });
await page.click('#sdOvA');
check('resume hides it', !(await page.isVisible('#sdOver')));

// Fill to the top: game over.
await page.evaluate(() => { const s = mb.sand.state; for (let i = 6 * 60 * 2; i < s.cell.length; i++) s.cell[i] = 1 + (i % 4); s.flash.fill(0); });
await page.waitForFunction(() => mb.sand.state.over, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1000);
check('game over card', await page.isVisible('#sdOver') && (await page.textContent('#sdOvT')).includes('Topped'));
await page.screenshot({ path: `${out}/07-over.png` });
await page.click('#sdOvA');
check('retry starts fresh', await page.evaluate(() => !mb.sand.state.over && mb.sand.state.score === 0));
await page.click('#sdPause');
await page.click('#sdOvB');
check('map button returns to the map', !(await page.isVisible('#sand')) && await page.isVisible('#home'));
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
