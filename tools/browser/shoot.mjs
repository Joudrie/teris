// Screenshot matrix for art review: every screen and state, at several device sizes, so the
// redesign can be compared like for like.
//
//   node tools/browser/shoot.mjs <outDir> [--only id,id] [--sizes primary|all] [--video]
//
// Writes <outDir>/<id>@<w>x<h>.jpg plus frames.json. With --video it also records the first
// 20 s of level 1 and the level 5 smash as frame strips (<outDir>/motion-*.jpg).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, serve, phone, ROOT } from './lib.mjs';
import { SCENES, playScene } from '../../src/scenes.js';
import { createSession } from '../../src/session.js';
import { mulberry32 } from '../bots.js';

const args = process.argv.slice(2);
const outDir = path.resolve(ROOT, args.find((a) => !a.startsWith('--')) || 'docs/redesign/after');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const allSizes = args.includes('--sizes=all');
const video = args.includes('--video');
fs.mkdirSync(outDir, { recursive: true });

const KEY = { left: 'ArrowLeft', right: 'ArrowRight', rotate: 'ArrowUp', soft: 'ArrowDown', slam: ' ', power: 'f' };
const PRIMARY = [390, 844];
const SIZES = [[390, 844, 2], [375, 667, 2], [430, 932, 3], [768, 1024, 2], [844, 390, 2], [1440, 900, 1]];

// Freezes the simulation but keeps drawing: the new view honours mb.freeze; the old one is
// held with a never-ending placeholder ad whose overlay is hidden.
async function freeze(page) {
  await page.evaluate(() => {
    if ('freeze' in window.mb) { window.mb.freeze = true; return; }
    const st = document.createElement('style');
    st.textContent = '#ad{display:none!important}';
    document.head.appendChild(st);
    window.mb.sess.ad = { kind: 'freeze', left: 1e9 };
  });
}

async function open(browser, url, [w, h, dpr = 2], query = '') {
  const p = await phone(browser, { width: w, height: h });
  if (dpr !== 2) {
    await p.ctx.close();
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 900, hasTouch: true });
    const page = await ctx.newPage();
    Object.assign(p, { ctx, page });
  }
  p.ctx.setDefaultTimeout(10000);
  await p.page.goto(`${url}?debug${query}`);
  await p.page.waitForFunction(() => window.mb && mb.game && (mb.game.piece || mb.sess.phase !== 'play'));
  if (query.includes('scene')) await p.page.waitForFunction(() => mb.sceneReady);
  await p.page.evaluate(() => document.fonts && document.fonts.ready);
  return p;
}

const shot = (page, id, [w, h]) => page.screenshot({ path: path.join(outDir, `${id}@${w}x${h}.jpg`), type: 'jpeg', quality: 82 });

async function scene(page, id) {
  const sc = SCENES[id];
  const headless = playScene(createSession({ rand: mulberry32(1), now: () => Date.UTC(2026, 9, 15, 12) }), id);
  for (const a of sc.actions) {
    if (typeof a === 'object') await page.waitForTimeout(a.wait * 1000);
    else await page.keyboard.press(KEY[a]);
  }
  return sc.shot ?? Math.min(sc.wait, (headless.first ?? 0) + 0.35);
}

// Each state: how to get there, and at which sizes to capture it.
const STATES = [
  { id: 'open-0s', all: true, run: async (page) => { await page.waitForTimeout(300); } },
  { id: 'open-1s', run: async (page) => { await page.waitForTimeout(1000); } },
  { id: 'open-7s', run: async (page) => { await page.waitForTimeout(7200); } },
  {
    id: 'busy', all: true,
    run: async (page) => {
      await page.evaluate(async () => { const { SHOWCASE } = await import('./src/showcase.js'); SHOWCASE.busy(mb.sess); mb.sess.callout = null; });
      await page.waitForTimeout(150);
      await freeze(page);
      await page.waitForTimeout(150);
    },
  },
  {
    id: 'lineup',
    run: async (page) => {
      await page.evaluate(async () => { const { SHOWCASE } = await import('./src/showcase.js'); SHOWCASE.lineup(mb.sess); mb.sess.callout = null; });
      await page.waitForTimeout(60);
      await freeze(page);
      await page.waitForTimeout(150);
    },
  },
  { id: 'live-play', run: async (page) => { await page.evaluate(() => { mb.sess.callout = null; }); for (let i = 0; i < 6; i++) { await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await page.keyboard.press(' '); await page.waitForTimeout(500); } } },
  ...['douse', 'burn', 'melt', 'freeze', 'mud', 'glassmelt', 'slam', 'erode', 'combo', 'rain', 'blaze', 'deepfreeze', 'sweep', 'hammer', 'flood', 'mixed', 'callout', 'meter', 'meterad', 'budget', 'lose', 'revive', 'interstitial', 'daily', 'help', 'home']
    .map((id) => ({ id: `scene-${id}`, scene: id, all: id === 'home' || id === 'lose' })),
  { id: 'win-celebrate-0.4s', scene: 'win', at: 0.4 },
  { id: 'win-celebrate-1.2s', scene: 'win', at: 1.2 },
  { id: 'win-screen', scene: 'win', at: 3.2, all: true },
  {
    id: 'home-scrolled', scene: 'home',
    run: async (page) => { await page.evaluate(() => { const h = document.getElementById('home'); if (h) h.scrollTop = h.scrollHeight * 0.45; }); await page.waitForTimeout(250); },
  },
];

const { srv, url } = await serve();
const browser = await launch();
const frames = {};
for (const st of STATES) {
  if (only.length && !only.includes(st.id)) continue;
  const sizes = allSizes && st.all ? SIZES : [PRIMARY];
  for (const size of sizes) {
    const p = await open(browser, url, size, st.scene ? `&scene=${st.scene}` : '');
    try {
      if (st.scene) {
        const after = await scene(p.page, st.scene);
        await p.page.waitForTimeout((st.at ?? after) * 1000);
      }
      if (st.run) await st.run(p.page);
      await shot(p.page, st.id, size);
      frames[`${st.id}@${size[0]}x${size[1]}`] = { errors: p.errors.slice(0, 3) };
      console.log(`shot ${st.id}@${size[0]}x${size[1]}${p.errors.length ? `  errors: ${p.errors.slice(0, 2).join(' | ')}` : ''}`);
    } catch (e) {
      console.log(`FAIL ${st.id}@${size[0]}x${size[1]}: ${e.message.split('\n')[0]}`);
    }
    await p.ctx.close();
  }
}

// Motion: frame strips (one frame every `every` seconds) for timing review.
async function strip(name, query, secs, every, before) {
  const p = await open(browser, url, [390, 844, 1], query);
  if (before) await before(p.page);
  const tmp = path.join(outDir, `_${name}`);
  fs.mkdirSync(tmp, { recursive: true });
  const n = Math.round(secs / every);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await p.page.screenshot({ path: path.join(tmp, `${String(i).padStart(3, '0')}.png`) });
    const wait = (i + 1) * every * 1000 - (Date.now() - t0);
    if (wait > 0) await p.page.waitForTimeout(wait);
  }
  await p.ctx.close();
  // Contact sheet: 8 frames per row, scaled down.
  execFileSync('python3', ['-I', path.join(ROOT, 'tools/browser/sheet.py'), tmp, path.join(outDir, `motion-${name}.jpg`), String(every)]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`strip ${name}`);
}

if (video) {
  await strip('level1-first-16s', '', 16, 1, null);
  await strip('slam-smash', '&scene=slam', 1.6, 0.1, async (page) => { await page.keyboard.press(' '); });
  await strip('combo', '&scene=combo', 2.4, 0.15, async (page) => { for (const a of SCENES.combo.actions) if (typeof a === 'string') await page.keyboard.press(KEY[a]); });
}

await browser.close();
srv.close();
fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify(frames, null, 1));
