// Real-browser checks on phone-sized Chromium with touch. Run: node tools/browser/check.mjs
// Prints PASS/FAIL per check and exits non-zero on any failure. Screenshots of interesting
// moments go to docs/shots/.

import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, phone, ROOT } from './lib.mjs';

const SHOTS = path.join(ROOT, 'docs/shots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
};

// Touch through the DevTools protocol, so the page gets real touch -> pointer events.
async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  return {
    cdp,
    async swipe(x0, y0, x1, y1, ms = 200, steps = 8) {
      await send('touchStart', x0, y0);
      for (let i = 1; i <= steps; i++) {
        if (ms) await page.waitForTimeout(ms / steps);
        await send('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      }
      await send('touchEnd');
    },
    async tap(x, y, jitter = 0) {
      await send('touchStart', x, y);
      if (jitter) await send('touchMove', x + jitter, y + jitter);
      await page.waitForTimeout(60);
      await send('touchEnd');
    },
  };
}

const game = (page, f) => page.evaluate(f);
const piece = (page) => game(page, () => (mb.game.piece ? { x: mb.game.piece.x, y: mb.game.piece.y, cells: JSON.stringify(mb.game.piece.cells) } : null));

async function fresh(browser, query = '', opts = {}) {
  const p = await phone(browser, opts);
  await p.page.goto(`${URL}?debug${query}`);
  await p.page.waitForFunction(() => window.mb && mb.game && mb.game.piece);
  if (query.includes('scene')) await p.page.waitForFunction(() => mb.sceneReady);
  return p;
}

// A board centre point, where swipes start.
async function boardCentre(page) {
  const r = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height * 0.4, w: b.width }; });
  return r;
}

const { srv, url: URL } = await serve();
const browser = await launch();

for (const [w, h] of [[390, 844], [375, 667]]) {
  const tag = `${w}x${h}`;
  // ---------- gestures ----------
  {
    const { page, errors, ctx } = await fresh(browser, '&level=3', { width: w, height: h });
    await page.evaluate(() => { mb.sess.callout = null; mb.game.cfg.speed = 5; }); // hold the piece still
    const t = await touch(page);
    const c = await boardCentre(page);
    const col = c.w / 12;

    let before = await piece(page);
    await t.tap(c.x, c.y);
    let after = await piece(page);
    check(`${tag} tap rotates`, before.cells !== after.cells && before.x === after.x || before.cells !== after.cells);

    before = await piece(page);
    await t.tap(c.x, c.y, 6); // a sloppy tap that moves a few pixels
    after = await piece(page);
    check(`${tag} sloppy 6px tap still rotates, does not move`, after.x === before.x && after.cells !== before.cells);

    before = await piece(page);
    await t.swipe(c.x, c.y, c.x + col * 2.4, c.y, 300, 10);
    after = await piece(page);
    check(`${tag} slow swipe right ~2.4 columns moves 3`, after.x - before.x === 3, `moved ${after.x - before.x}`);

    before = await piece(page);
    await t.swipe(c.x, c.y, c.x - col * 9, c.y, 250, 10);
    after = await piece(page);
    check(`${tag} swipe far into the wall stops at the wall`, after.x <= 0 && after.x >= -1, `x=${after.x}`);

    before = await piece(page);
    await t.swipe(c.x, c.y, c.x, c.y + col * 3, 500, 12);
    after = await piece(page);
    const lockedByDrag = await game(page, () => mb.events.filter((e) => e.type === 'land').length);
    check(`${tag} slow drag down soft-drops without slamming`, after && after.y > before.y && lockedByDrag === 0, `dy=${after && after.y - before.y}`);

    const lands0 = await game(page, () => mb.events.filter((e) => e.type === 'land').length);
    await t.swipe(c.x, c.y, c.x + 8, c.y + 120, 0, 2); // a real flick is ~100 ms; each CDP call adds ~50
    await page.waitForTimeout(100);
    const flick = await game(page, () => mb.events.filter((e) => e.type === 'land'));
    const g1 = await game(page, () => mb.gestures[mb.gestures.length - 1]);
    check(`${tag} quick flick down slams`, flick.length === lands0 + 1 && flick[flick.length - 1].slam === true, JSON.stringify(g1));

    // A diagonal swipe should move, not slam or rotate.
    await page.evaluate(() => { mb.game.cfg.speed = 5; });
    before = await piece(page);
    const lands1 = await game(page, () => mb.events.filter((e) => e.type === 'land').length);
    await t.swipe(c.x, c.y, c.x + col * 2.2, c.y + col * 0.8, 250, 8);
    after = await piece(page);
    const lands2 = await game(page, () => mb.events.filter((e) => e.type === 'land').length);
    check(`${tag} diagonal swipe moves sideways, no slam`, after.x > before.x && lands2 === lands1);

    // Power: flick up with a full meter.
    await page.evaluate(() => { mb.game.meter = 1; });
    await t.swipe(c.x, c.y + 60, c.x, c.y - 80, 0, 2);
    await page.waitForTimeout(50);
    const powered = await game(page, () => mb.game.powers);
    check(`${tag} flick up fires the power at full meter`, powered === 1, JSON.stringify(await game(page, () => mb.gestures[mb.gestures.length - 1])));
    await t.swipe(c.x, c.y + 60, c.x, c.y - 80, 0, 2);
    check(`${tag} flick up at 0% meter does nothing`, (await game(page, () => mb.game.powers)) === 1);

    // No page scroll during play.
    await t.swipe(c.x, c.y + 100, c.x, c.y - 200, 300, 10);
    await t.swipe(c.x, c.y - 100, c.x, c.y + 200, 300, 10);
    const sc = await page.evaluate(() => ({ y: window.scrollY, top: document.scrollingElement.scrollTop, bodyH: document.body.scrollHeight, vh: innerHeight }));
    check(`${tag} the page never scrolls during play`, sc.y === 0 && sc.top === 0, JSON.stringify(sc));

    // Board fits the screen.
    const fitInfo = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); const q = document.getElementById('quest').getBoundingClientRect(); return { bottom: b.bottom, right: b.right, quest: q.bottom, vw: innerWidth, vh: innerHeight }; });
    check(`${tag} board and quest line fit on screen`, fitInfo.bottom <= fitInfo.vh && fitInfo.right <= fitInfo.vw && fitInfo.quest <= fitInfo.vh + 1, JSON.stringify(fitInfo));

    // Home screen scrolls.
    await page.click('#homeBtn');
    await page.waitForTimeout(100);
    await t.swipe(w / 2, h * 0.8, w / 2, h * 0.2, 300, 10);
    await page.waitForTimeout(400);
    const homeTop = await page.evaluate(() => document.getElementById('home').scrollTop);
    check(`${tag} home screen scrolls`, homeTop > 50, `scrollTop ${homeTop}`);
    const frozen = await piece(page);
    await page.waitForTimeout(600);
    check(`${tag} game waits behind the home screen`, JSON.stringify(await piece(page)) === JSON.stringify(frozen));
    await page.click('#playBtn');
    await page.screenshot({ path: path.join(SHOTS, `play-${tag}.jpg`), quality: 70, type: 'jpeg' });
    check(`${tag} no console errors`, errors.length === 0 && (await game(page, () => mb.errors.length)) === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

// ---------- resize and rotate mid-game ----------
{
  const { page, errors, ctx } = await fresh(browser);
  for (const [w, h] of [[844, 390], [390, 844], [375, 667], [430, 932]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
  }
  const fit = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); return { bottom: b.bottom, right: b.right, vw: innerWidth, vh: innerHeight, h: b.height }; });
  await page.screenshot({ path: path.join(SHOTS, 'resize-430x932.jpg'), quality: 70, type: 'jpeg' });
  check('rotate and resize mid-game: board refits, no errors', fit.bottom <= fit.vh && fit.right <= fit.vw && fit.h > 300 && errors.length === 0, JSON.stringify(fit));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  const land = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); return { h: b.height, bottom: b.bottom, vh: innerHeight }; });
  check('landscape phone: board still visible (shrinks to fit)', land.h >= 150, JSON.stringify(land));
  await ctx.close();
}

// ---------- background tab ----------
// A hidden tab gets no animation frames; when it comes back the first frame's timestamp
// is seconds ahead. Hold the frames for 4 s and release them with that jump.
{
  const { page, ctx } = await fresh(browser, '&level=3');
  await page.evaluate(() => { mb.sess.callout = null; });
  const y0 = (await piece(page)).y;
  await page.evaluate(() => {
    window.__held = [];
    window.__raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { window.__held.push(cb); return 0; };
  });
  await page.waitForTimeout(4000);
  const y1 = (await piece(page)).y;
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__raf;
    const now = performance.now();
    for (const cb of window.__held.splice(0)) cb(now);
  });
  await page.waitForTimeout(20);
  const y2 = (await piece(page)).y;
  check('background tab for 4 s and back: no time jump', y1 - y0 <= 1 && y2 - y1 <= 2, `moved ${y1 - y0} rows while hidden, ${y2 - y1} on return`);
  await ctx.close();
}

// ---------- overlays in any order ----------
{
  const { page, errors, ctx } = await fresh(browser);
  const seq = [];
  let ok = true;
  let rnd = 12345;
  const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
  const scenes = ['win', 'lose', 'revive', 'interstitial', 'meterad', 'callout', 'daily', 'help'];
  for (let i = 0; i < 40; i++) {
    const r = rand();
    if (r < 0.25) {
      const sc = scenes[Math.floor(rand() * scenes.length)];
      seq.push(`scene:${sc}`);
      await page.evaluate(async (id) => { const { SCENES } = await import('./src/scenes.js'); SCENES[id].setup(mb.sess); }, sc);
    } else {
      const ids = ['homeBtn', 'playBtn', 'muteBtn', 'callout', 'meterAd', 'ovA', 'ovB', 'ovC', 'dailyBtn'];
      const id = ids[Math.floor(rand() * ids.length)];
      const vis = await page.evaluate((x) => { const e = document.getElementById(x); return !!e && !e.hidden && e.offsetParent !== null && !e.disabled; }, id);
      if (vis) { seq.push(`click:${id}`); await page.click(`#${id}`, { timeout: 1000 }).catch(() => {}); }
    }
    await page.waitForTimeout(150 + rand() * 900);
  }
  // Whatever state we ended in, we must be able to get back to a live board.
  for (let k = 0; k < 20; k++) {
    const st = await page.evaluate(() => ({ phase: mb.sess.phase, home: mb.sess.home, ad: !!mb.sess.ad }));
    if (st.phase === 'play' && !st.home && !st.ad) break;
    if (st.home) await page.click('#playBtn');
    else if (st.ad) await page.waitForTimeout(600);
    else if (st.phase === 'won' || st.phase === 'lost') await page.click('#ovB');
    else await page.waitForTimeout(300);
  }
  await page.evaluate(() => { mb.sess.callout = null; });
  const fr0 = await page.evaluate(() => mb.stats().frames);
  const p0 = await piece(page);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  const p1 = await piece(page);
  const fr1 = await page.evaluate(() => mb.stats().frames);
  ok = p0 && p1 && (p1.x === p0.x - 1 || p1.x === 0) && fr1 > fr0 + 5;
  check('overlays opened/closed in random order: input and frames still work', ok && errors.length === 0, `${seq.length} steps; ${errors.slice(0, 2).join(' | ')}`);
  fs.writeFileSync(path.join(SHOTS, 'overlay-sequence.txt'), seq.join('\n'));
  await ctx.close();
}

// ---------- storage blocked ----------
{
  const p = await phone(browser, { storage: false });
  await p.page.goto(`${URL}?debug`);
  await p.page.waitForFunction(() => window.mb && mb.game && mb.game.piece);
  await p.page.waitForTimeout(1500);
  check('localStorage blocked: game starts and runs with no errors', p.errors.length === 0, p.errors.slice(0, 2).join(' | '));
  await p.ctx.close();
}

// ---------- storage cleared mid-game ----------
{
  const { page, errors, ctx } = await fresh(browser, '&level=4');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(async () => { const { SCENES } = await import('./src/scenes.js'); SCENES.win.setup(mb.sess); });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => mb.sess.phase === 'won', null, { timeout: 8000 });
  const saved = await page.evaluate(() => localStorage.getItem('mb_level'));
  check('localStorage cleared mid-game: win still saved', saved === '5' && errors.length === 0, `mb_level=${saved}`);
  await ctx.close();
}

// ---------- performance ----------
for (const rate of [1, 4]) {
  const { page, ctx } = await fresh(browser, '&level=20');
  const t = await touch(page);
  await t.cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.evaluate(() => { mb.sess.callout = null; mb.resetStats(); });
  // A busy board: drop pieces for a few seconds.
  const start = Date.now();
  while (Date.now() - start < 6000) {
    await page.keyboard.press(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  const st = await page.evaluate(() => mb.stats());
  check(`performance at ${rate}x CPU throttle: physics tick under 4 ms`, st.avgPhysMs < 4, `physics ${st.avgPhysMs.toFixed(2)} ms, game JS per frame ${st.avgFrameWorkMs.toFixed(2)} ms avg / ${st.worstFrameWorkMs.toFixed(1)} worst (debug validator ${st.avgValidatorMs.toFixed(2)} ms extra), ${fps.toFixed(0)} fps in software-rendered headless Chromium`);
  fs.writeFileSync(path.join(SHOTS, `perf-${rate}x.json`), JSON.stringify({ ...st, fps }, null, 1));
  await ctx.close();
}

await browser.close();
srv.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(SHOTS, 'browser-checks.json'), JSON.stringify(results, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
process.exitCode = failed.length ? 1 : 0;
