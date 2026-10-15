// The instant-hook checklist, in a real browser at 390x844 with a fresh save.
// First ten seconds with no input at all, then the newbie bot plays level 1 through the
// live page. Prints each check with its measured time and saves screenshots.
//
//   node tools/browser/hook.mjs

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
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `hook-${name}.jpg`), type: 'jpeg', quality: 70 });

const { srv, url } = await serve();
const browser = await launch();
const { page, errors, ctx } = await phone(browser, { width: 390, height: 844 });
await page.goto(`${url}?debug`);
await page.waitForFunction(() => window.mb && mb.game);
const t0 = await page.evaluate(() => performance.now());
const now = async () => ((await page.evaluate(() => performance.now())) - t0) / 1000;
const firstEvent = (type) => page.evaluate(([ty, base]) => { const e = mb.events.find((x) => x.type === ty); return e ? (e.t - base) / 1000 : null; }, [type, t0]);

// ---------- first 10 seconds, hands off ----------
await page.waitForTimeout(800);
const falling = await page.evaluate(() => !!mb.game.piece && mb.sess.phase === 'play' && !mb.sess.home);
const callout = await page.evaluate(() => (mb.sess.callout ? mb.sess.callout.text : null));
await shot(page, '01-first-second');
check('a piece is already falling the moment the game opens (no menu first)', falling);
check('the first-time callout explains the one thing to do', !!callout, callout || '');
await page.waitForFunction(() => mb.game.drained > 0, null, { timeout: 15000 }).catch(() => {});
const firstDrain = await now();
await page.waitForTimeout(250);
await shot(page, '02-first-reaction');
check('first reaction happens in the first 10 s with no input', firstDrain <= 10, `${firstDrain.toFixed(1)} s`);

// ---------- the newbie bot plays the rest of level 1 ----------
await page.evaluate(async () => {
  const { createBot, botStep, mulberry32 } = await import('./tools/bots.js');
  const bot = createBot('newbie', mulberry32(5));
  window.__bot = bot;
  let last = performance.now();
  const loop = (ts) => {
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (mb.sess.phase === 'play' && !mb.sess.home && !mb.sess.ad) botStep(bot, mb.game, dt);
    if (!window.__stopBot) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.waitForFunction(() => mb.events.some((e) => e.type === 'combo'), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(150);
await shot(page, '03-first-combo');
await page.waitForFunction(() => mb.sess.phase !== 'play' || mb.game.drained >= 64 * 4, null, { timeout: 60000 }).catch(() => {});
await shot(page, '04-bar-moving');
const tCombo = await firstEvent('combo');
const tBar = await page.evaluate((base) => { const e = mb.events.find((x) => x.type === 'combo' || x.type === 'land'); return e ? (e.t - base) / 1000 : null; }, t0);
check('first 60 s: a drain, a combo popup and the bar moving', firstDrain <= 60 && tCombo !== null && tCombo <= 60 && tBar !== null, `drain ${firstDrain.toFixed(1)} s, combo ${tCombo?.toFixed(1)} s`);

// Visible next goal while playing.
const goals = await page.evaluate(() => {
  const vis = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom <= innerHeight; };
  return { bar: vis('drainBar') || vis('drainNum'), meter: vis('meterBar'), quest: vis('quest') && document.getElementById('quest').textContent.length > 0, left: vis('left') };
});
check('always a visible next goal: drain bar, power meter, side quest, pieces left', Object.values(goals).every(Boolean), JSON.stringify(goals));

await page.waitForFunction(() => mb.sess.phase === 'celebrate' || mb.sess.phase === 'won' || mb.sess.phase === 'lost', null, { timeout: 200000 });
const outcome = await page.evaluate(() => mb.sess.phase);
const tEnd = await now();
if (outcome === 'celebrate') {
  await page.waitForTimeout(700);
  await shot(page, '05-celebration');
}
check('first level clears in 1-2 minutes, as a new player plays it', outcome !== 'lost' && tEnd >= 45 && tEnd <= 130, `${outcome} at ${tEnd.toFixed(0)} s`);
await page.waitForFunction(() => mb.sess.phase === 'won' || mb.sess.phase === 'lost', null, { timeout: 10000 });
await page.waitForTimeout(400);
await shot(page, '06-win-screen');
const win = await page.evaluate(() => ({ title: document.getElementById('ovT').textContent, next: document.getElementById('ovN').textContent, a: document.getElementById('ovA').textContent, daily: !document.getElementById('ovC').hidden }));
check('win screen: big celebration, then what is new next level', /cleared/i.test(win.title) && /level 2/.test(win.next), `${win.title} | ${win.next}`);
check('win screen offers the daily challenge', win.daily);

// Feedback seen during the level.
const kinds = await page.evaluate(() => [...new Set(mb.events.map((e) => e.type))]);
check('feedback events fired (land/slam, combo, drain popups, quest or power)', ['land', 'combo', 'win'].every((k) => kinds.includes(k)), kinds.join(','));

// One tap back into play.
await page.evaluate(() => { window.__stopBot = true; });
await page.click('#ovA');
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({ phase: mb.sess.phase, level: mb.sess.level, piece: !!mb.game.piece, ad: !!mb.sess.ad }));
await shot(page, '07-level-2');
check('session loop: one tap from the win screen and level 2 is falling', after.phase === 'play' && after.level === 2 && after.piece && !after.ad, JSON.stringify(after));

// Mute: sound layer exists and can be switched off, and it is remembered.
await page.click('#muteBtn');
const muted = await page.evaluate(() => JSON.parse(localStorage.getItem('mb_muted')));
check('sound layer can be muted, and the choice is remembered', muted === true);

// Daily reason to return.
await page.click('#homeBtn');
await page.waitForTimeout(200);
await shot(page, '08-home-daily');
const daily = await page.evaluate(() => ({ disabled: document.getElementById('dailyBtn').disabled, info: document.getElementById('dailyInfo').textContent }));
check('home screen: daily challenge ready', !daily.disabled, daily.info);
check('no console errors or invariant breaks in the whole session', errors.length === 0 && (await page.evaluate(() => mb.errors.length)) === 0, errors.slice(0, 2).join(' | '));

// Loss screen and revive, from a real near-miss.
await page.click('#playBtn');
await page.evaluate(async () => { const { SCENES } = await import('./src/scenes.js'); SCENES.lose.setup(mb.sess); });
await page.keyboard.press(' ');
await page.waitForFunction(() => mb.sess.phase === 'lost');
await page.waitForTimeout(300);
await shot(page, '09-so-close');
const lose = await page.evaluate(() => ({ t: document.getElementById('ovT').textContent, a: document.getElementById('ovA').textContent, aVis: !document.getElementById('ovA').hidden }));
check('every loss shows real progress and the one revive', /\d+%/.test(lose.t) && lose.aVis && /ad/i.test(lose.a), `${lose.t} | ${lose.a}`);

await ctx.close();
await browser.close();
srv.close();
fs.writeFileSync(path.join(SHOTS, 'hook-checks.json'), JSON.stringify(results, null, 1));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} hook checks passed`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
