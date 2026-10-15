// The view: draws the session and turns touches into inputs. All game and screen logic
// lives in session.js and core.js.

import { pieceMats, landingY, progress, piecesDrained, piecesLeft, COLS, GW, GH, S, altitude } from './core.js';
import { POWERS, questText } from './levels.js';
import {
  createSession, step, input, live, next, replay, watchRevive, watchMeterAd, meterAdAvailable, openHome,
  closeHome, startDaily, dismissCallout, winScreen, loseScreen, homeInfo, dailyReady, start, CELEBRATE_TIME,
} from './session.js';
import { questCount } from './core.js';
import { drawScenery } from './scenery.js';
import { adsRemoved } from './ads.js';
import { initSound, setMuted, isMuted, unlock, play } from './sound.js';
import { validate, createValidator } from './validate.js';

const BASE = {
  water: '#3f8ee3', wood: '#c0813f', wetwood: '#5f4a33', ice: '#b5ecfa', sand: '#dcb66b',
  stone: '#8d93a1', mud: '#6e4c30', glass: '#cdeee6', brick: '#a8453a', fire: '#ff6a1f',
};
const NAME = {
  water: 'Water', wood: 'Wood', wetwood: 'Wet wood', ice: 'Ice', sand: 'Sand', stone: 'Stone',
  mud: 'Mud', glass: 'Glass', brick: 'Brick', fire: 'Fire',
};
// One-line tip for the next piece.
const TIP = {
  fire: 'drop water on it to put it out, or set it by wood and ice',
  water: 'pour it on fire, sand or wood',
  wood: 'put it next to fire, or soak it twice',
  ice: 'put it next to fire to melt it',
  sand: 'wet it to make mud, or melt it with fire into glass',
  glass: 'slam a piece onto it to smash it',
  stone: 'heavy: smashes glass. Water wears it down',
  brick: 'water wears it down into sand',
};
const POWER_COLOR = { rain: '#7fc4ff', blaze: '#ff7a1a', freeze: '#9fe6ff', sweep: '#f0c060', hammer: '#ffffff' };

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const nxCv = $('nx');
const nctx = nxCv.getContext('2d');
const PX = 8; // canvas pixels per particle
cv.width = GW * PX;
cv.height = GH * PX;

// Particle layer: one pixel per particle, scaled up without smoothing.
const layer = document.createElement('canvas');
layer.width = GW;
layer.height = GH;
const lctx = layer.getContext('2d');
const img = lctx.createImageData(GW, GH);

const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Four shades per material so loose grains read as texture.
const SHADES = Object.fromEntries(Object.entries(BASE).map(([m, h]) => {
  const [r, g, b] = hexRGB(h);
  return [m, [0.82, 0.92, 1, 1.08].map((f) => [r, g, b].map((v) => Math.min(255, Math.round(v * f))))];
}));
const RIGID = new Set(['stone', 'ice', 'glass', 'brick', 'wood', 'wetwood', 'fire']);
const lighten = (h, k) => `rgb(${hexRGB(h).map((v) => Math.min(255, Math.round(v + (255 - v) * k))).join(',')})`;

// Stable pseudo-random 0..1 for a pixel, so a falling piece's texture doesn't flicker.
const hash = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// Colour of one particle: each material has its own texture so glass, ice and the rest
// can't be confused even before the full art pass.
function pixelColor(m, x, y, shade, ts) {
  let k = Math.floor(shade * 4);
  if (m === 'wood' || m === 'wetwood') k = y % S === 0 ? 0 : 2 + (shade > 0.7 ? 1 : 0); // plank grain
  let [r, g, b] = SHADES[m][k];
  let a = 255;
  if (m === 'fire') {
    const f = 0.75 + 0.35 * Math.sin(ts / 70 + x * 1.3 + y * 2.1);
    r = Math.min(255, r * f + 40); g = Math.min(255, g * f + 30 * f); b *= f;
  } else if (m === 'glass') {
    // Clear with diagonal glints.
    a = 150;
    if ((x + y) % 6 === 0) { r = 255; g = 255; b = 255; a = 230; }
  } else if (m === 'ice') {
    // Solid and frosty: pale with a crackle pattern.
    if ((x * 3 + y * 2) % 7 === 0) { r = 240; g = 252; b = 255; }
  } else if (m === 'water') {
    const w = 0.92 + 0.1 * Math.sin(ts / 300 + x * 0.7 + y * 0.4);
    r *= w; g *= w; b = Math.min(255, b * w + 10);
  }
  return [r, g, b, a];
}

// ---------- session ----------

let storage = null;
try { storage = window.localStorage; } catch (e) { storage = null; }
const sess = createSession({ storage, adsRemoved });
initSound(sess.store.get('mb_muted', false));
if (params.has('level')) start(sess, +params.get('level'));

let fx = { debris: [], puffs: [], popups: [], flash: null, shake: 0 };
let lastHud = '';
let lastDrained = 0;
let lastOverlay = '';
let shownGame = null;

const game = () => sess.game;

// ---------- overlays ----------

function setButtons(list) {
  ['ovA', 'ovB', 'ovC'].forEach((id, i) => {
    const el = $(id);
    const opt = list[i];
    el.hidden = !opt;
    if (opt) {
      el.textContent = opt[0];
      el.onclick = () => { unlock(); play('tap'); opt[1](); };
    }
  });
}

// Shows whichever screen the session is on. Only touches the DOM when that changes.
function overlays() {
  const key = [sess.phase, sess.home, sess.ad && sess.ad.kind, sess.game.revived, game() === shownGame].join('|');
  const adEl = $('ad');
  if (sess.ad) {
    adEl.hidden = false;
    adEl.querySelector('.ad-label').textContent = sess.ad.kind === 'interstitial' ? 'Test interstitial ad' : `Test rewarded ad: ${sess.ad.kind === 'revive' ? 'revive' : 'fill power meter'}`;
    adEl.querySelector('.ad-count').textContent = String(Math.max(1, Math.ceil(sess.ad.left)));
  } else {
    adEl.hidden = true;
  }
  if (key === lastOverlay) return;
  lastOverlay = key;
  shownGame = game();

  $('home').hidden = !sess.home;
  if (sess.home) {
    const h = homeInfo(sess);
    $('homeLevel').textContent = `Level ${h.level}`;
    $('homeFt').textContent = `${h.ft} ft up`;
    $('dailyBtn').disabled = !h.dailyReady;
    $('dailyInfo').textContent = h.dailyReady ? (h.streak ? `streak ${h.streak}` : 'new today') : 'done today ✓';
  }

  const over = $('over');
  if (sess.phase === 'won') {
    const w = winScreen(sess);
    $('ovT').textContent = w.title;
    $('ovS').textContent = `${w.drained} blocks drained. ${w.sub}`;
    $('ovN').textContent = w.next;
    $('ovN').hidden = false;
    setButtons([
      [w.nextLabel, () => next(sess)],
      ['Replay this level', () => replay(sess)],
      w.dailyReady && !sess.daily ? ['★ Daily challenge ready', () => startDaily(sess)] : null,
    ]);
    over.hidden = false;
  } else if (sess.phase === 'lost') {
    const l = loseScreen(sess);
    $('ovT').textContent = l.title;
    $('ovS').textContent = l.sub;
    $('ovN').textContent = l.help ? 'Helping hand next try: an extra fire and water in every bag.' : '';
    $('ovN').hidden = !l.help;
    setButtons([
      l.canRevive ? [l.revive, () => watchRevive(sess)] : null,
      ['Retry level', () => replay(sess)],
      null,
    ]);
    over.hidden = false;
  } else {
    over.hidden = true;
  }
}

$('meterAd').onclick = () => { unlock(); watchMeterAd(sess); };
$('callout').onclick = () => dismissCallout(sess);

// ---------- effects ----------

const cellsCenter = (cells) => {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of cells) { sx += x; sy += y; }
  return [(sx / cells.length + 0.5) * PX, (sy / cells.length + 0.5) * PX];
};

function burst(cells, color, speed, max) {
  const step = Math.max(1, Math.floor(cells.length / max));
  for (let i = 0; i < cells.length; i += step) {
    const [x, y, m] = cells[i];
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    fx.debris.push({
      x: (x + 0.5) * PX, y: (y + 0.5) * PX, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.6,
      life: 1, color: color || BASE[m] || '#fff', size: PX * (0.6 + Math.random() * 0.6),
    });
  }
}

function popup(x, y, text, color = '#fff', size = 18, kind = '') {
  if (kind) fx.popups = fx.popups.filter((p) => p.kind !== kind); // the newest of a kind replaces the last
  fx.popups.push({ x, y, text, color, size, life: 1, kind });
}

function handleEvents() {
  for (const e of sess.events) {
    if (e.type === 'combo') {
      popup(cv.width / 2, cv.height * 0.25, `COMBO ×${e.mult}`, '#ffd34d', 18 + e.mult * 4, 'combo');
      fx.shake = Math.max(fx.shake, 3 + e.mult * 2);
      if (e.mult >= 3) fx.flash = { color: '#ffd34d', life: 0.25 };
      play('combo', e);
    } else if (e.type === 'shatter') {
      burst(e.cells.map(([x, y]) => [x, y, 'glass']), '#e8fffa', 220, 120);
      fx.shake = Math.max(fx.shake, 8);
      const [x, y] = cellsCenter(e.cells);
      popup(x, y, 'SMASH!', '#e8fffa', 24, 'smash');
      play('shatter');
    } else if (e.type === 'steam') {
      fx.puffs.push({ x: (e.x + 0.5) * PX, y: e.y * PX, life: 1, smoke: false });
      play('steam');
    } else if (e.type === 'burn') {
      fx.puffs.push({ x: (e.x + 0.5) * PX, y: e.y * PX, life: 1, smoke: true });
      play('burn');
    } else if (e.type === 'land') {
      const cell = S * PX;
      const [cx, cy] = e.cells.reduce(([a, b], [x, y]) => [a + x, Math.max(b, y)], [0, 0]);
      const px = ((cx / e.cells.length) + 0.5) * cell;
      const py = (cy / S + 1) * cell;
      if (e.slam) {
        fx.shake = Math.max(fx.shake, 5);
        for (let i = 0; i < 10; i++) fx.puffs.push({ x: px + (Math.random() - 0.5) * cell * 2, y: py, life: 0.6, smoke: true });
        popup(px, py - cell, 'SLAM', '#ffffff', 15, 'slam');
        play('slam');
      } else {
        play('land');
      }
    } else if (e.type === 'power') {
      const color = POWER_COLOR[e.power];
      burst(e.cells, color, 260, 700);
      fx.flash = { color, life: 0.6 };
      fx.shake = 16;
      popup(cv.width / 2, cv.height / 2, `${POWERS[e.power].label.toUpperCase()}!  +${Math.floor(e.points / 64)}`, color, 30, 'power');
      play('power');
    } else if (e.type === 'quest') {
      popup(cv.width / 2, cv.height * 0.32, 'Side quest done! +power', '#7fdc8f', 20, 'quest');
      play('quest');
    } else if (e.type === 'win') {
      celebrate();
      play('win');
    } else if (e.type === 'lose') {
      play('lose');
    } else if (e.type === 'start') {
      fx = { debris: [], puffs: [], popups: [], flash: null, shake: 0 };
      lastDrained = 0;
      lastHud = '';
      if (sess.callout) play('callout');
    }
  }
  sess.events.length = 0;
}

// Everything left on the board shatters and falls away.
function celebrate() {
  const g = game();
  const cells = [];
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (g.grid[y][x]) { cells.push([x, y, g.grid[y][x].m]); g.grid[y][x] = null; }
    }
  }
  burst(cells, null, 200, 900);
  // Confetti in the theme colours.
  const conf = [];
  for (let i = 0; i < 160; i++) conf.push([Math.floor(Math.random() * GW), Math.floor(Math.random() * GH * 0.5), Object.keys(BASE)[i % 10]]);
  burst(conf, null, 260, 160);
  fx.flash = { color: '#ffd34d', life: 0.5 };
  fx.shake = 12;
}

function stepFx(dt) {
  for (const d of fx.debris) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 600 * dt; d.life -= dt * 0.9; }
  fx.debris = fx.debris.filter((d) => d.life > 0 && d.y < cv.height + 20);
  if (fx.debris.length > 1500) fx.debris.splice(0, fx.debris.length - 1500);
  for (const p of fx.puffs) { p.y -= 30 * dt; p.life -= dt * 1.2; }
  fx.puffs = fx.puffs.filter((p) => p.life > 0);
  if (fx.puffs.length > 300) fx.puffs.splice(0, fx.puffs.length - 300);
  for (const p of fx.popups) { p.y -= 40 * dt; p.life -= dt * 0.8; }
  fx.popups = fx.popups.filter((p) => p.life > 0);
  if (fx.flash) { fx.flash.life -= dt; if (fx.flash.life <= 0) fx.flash = null; }
  fx.shake = Math.max(0, fx.shake - dt * 40);
}

// ---------- drawing ----------

function drawParticles(ts) {
  const g = game();
  const d = img.data;
  d.fill(0);
  for (let y = 0; y < GH; y++) {
    const row = g.grid[y];
    for (let x = 0; x < GW; x++) {
      const c = row[x];
      if (!c) continue;
      let [r, gg, b, a] = pixelColor(c.m, x, y, c.shade, ts);
      // Light edge around each solid piece so you can see where one ends and the next begins.
      if (RIGID.has(c.m)) {
        const up = y > 0 ? g.grid[y - 1][x] : null;
        const dn = y < GH - 1 ? g.grid[y + 1][x] : null;
        const lf = x > 0 ? row[x - 1] : null;
        const rt = x < GW - 1 ? row[x + 1] : null;
        if (!up || up.id !== c.id || !dn || dn.id !== c.id || !lf || lf.id !== c.id || !rt || rt.id !== c.id) {
          r += (255 - r) * 0.45; gg += (255 - gg) * 0.45; b += (255 - b) * 0.45; a = 255;
        }
      }
      const i = (y * GW + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a;
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, 0, 0, cv.width, cv.height);
}

// The falling piece shows its real texture, with each block outlined in its material's colour.
function drawPiece(ts) {
  const g = game();
  const p = g.piece;
  if (!p) return;
  const cell = S * PX;
  const mats = pieceMats(p);
  const gy = landingY(g);
  ctx.lineWidth = 2;
  p.cells.forEach(([a, b], i) => {
    // Ghost: where it will land, outline only.
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = lighten(BASE[mats[i]], 0.3);
    ctx.strokeRect((p.x + a) * cell + 2, (gy + b * S) * PX + 2, cell - 4, cell - 4);
    ctx.globalAlpha = 1;
  });
  p.cells.forEach(([a, b], i) => {
    const m = mats[i];
    const x0 = (p.x + a) * S;
    const y0 = p.y + b * S;
    for (let y = y0; y < y0 + S; y++) {
      if (y < 0) continue;
      for (let x = x0; x < x0 + S; x++) {
        const [r, gg, bl, al] = pixelColor(m, x, y, hash(x, y - p.y), ts);
        ctx.fillStyle = `rgba(${r | 0},${gg | 0},${bl | 0},${al / 255})`;
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }
    ctx.strokeStyle = lighten(BASE[m], 0.45);
    ctx.strokeRect(x0 * PX + 1, y0 * PX + 1, cell - 2, cell - 2);
  });
}

function drawFx() {
  for (const d of fx.debris) {
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
  }
  for (const p of fx.puffs) {
    ctx.globalAlpha = p.life * 0.6;
    ctx.fillStyle = p.smoke ? '#4a4038' : '#eef3f7';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + (1 - p.life) * 8, 0, 7);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  for (const p of fx.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.font = `700 ${p.size}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  if (fx.flash) {
    ctx.globalAlpha = Math.min(0.45, fx.flash.life);
    ctx.fillStyle = fx.flash.color;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
  }
}

function bigText(lines) {
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,.6)';
  for (const [text, y, size, color] of lines) {
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    ctx.strokeText(text, cv.width / 2, cv.height * y);
    ctx.fillStyle = color;
    ctx.fillText(text, cv.width / 2, cv.height * y);
  }
}

function draw(ts) {
  const g = game();
  const level = sess.daily ? g.level : sess.level;
  // During the celebration the camera pans down 1 ft.
  let alt = altitude(Math.min(100, level));
  if (sess.phase === 'celebrate') alt -= Math.min(1, Math.max(0, (sess.celebrateT - 0.8) / 1.2));
  else if (sess.phase === 'won') alt -= 1;

  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  drawScenery(ctx, Math.max(1, alt), cv.width, cv.height);
  ctx.fillStyle = 'rgba(20,22,30,.35)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  drawParticles(ts);
  if (sess.phase === 'play') drawPiece(ts);
  drawFx();
  if (sess.phase === 'celebrate' || sess.phase === 'won') {
    const total = piecesDrained(g);
    const shown = sess.phase === 'won' ? total : Math.floor(total * Math.min(1, sess.celebrateT / (CELEBRATE_TIME * 0.55)));
    const pop = sess.phase === 'won' ? 1 : Math.min(1, sess.celebrateT * 4);
    bigText([
      ['LEVEL CLEARED', 0.38, Math.round(22 + 14 * pop), '#ffd34d'],
      [`${shown} blocks drained`, 0.46, 24, '#ffffff'],
    ]);
  }
  ctx.restore();
}

function drawNext() {
  nctx.clearRect(0, 0, nxCv.width, nxCv.height);
  const { shape, mats } = game().next;
  const s = 12;
  const w = Math.max(...shape.map(([a]) => a)) + 1;
  const h = Math.max(...shape.map(([, b]) => b)) + 1;
  const ox = (nxCv.width - w * s) / 2;
  const oy = (nxCv.height - h * s) / 2;
  nctx.lineWidth = 1.5;
  shape.forEach(([a, b], i) => {
    nctx.fillStyle = BASE[mats[i]];
    nctx.fillRect(ox + a * s + 1, oy + b * s + 1, s - 2, s - 2);
    nctx.strokeStyle = lighten(BASE[mats[i]], 0.5);
    nctx.strokeRect(ox + a * s + 1.5, oy + b * s + 1.5, s - 3, s - 3);
  });
}

// "Fire + Wood" for a two-material piece, "Glass" for a plain one.
const label = (mats) => [...new Set(mats)].map((m) => NAME[m]).join(' + ');

function hud() {
  const g = game();
  const cfg = g.cfg;
  const drained = piecesDrained(g);
  const nowMats = g.piece ? pieceMats(g.piece) : [];
  const nextMats = g.next ? g.next.mats : [];
  const qn = questCount(g);
  const meterAd = meterAdAvailable(sess);
  const left = piecesLeft(g);
  const key = [sess.level, sess.daily, drained, left, g.settling !== null, nowMats, nextMats, g.next && g.next.shape, g.meter.toFixed(2), g.questDone, qn, sess.phase, meterAd, isMuted()].join('|');
  if (key === lastHud) return;
  if (drained > lastDrained && sess.phase === 'play') {
    const el = document.querySelector('.drain');
    el.classList.remove('bump');
    void el.offsetWidth; // restart the bump animation
    el.classList.add('bump');
    // A "+1" pops off the side of the board toward the bar.
    popup(cv.width - 40, cv.height * (1 - progress(g)) + 20, `+${drained - lastDrained}`, '#7fdc8f', 22, 'plus');
    play('drain', { mult: g.mult });
  }
  lastDrained = drained;
  lastHud = key;

  $('lvl').textContent = sess.daily ? 'Daily' : `Lv ${sess.level} · ${altitude(sess.level)} ft`;
  $('drainNum').textContent = String(drained);
  $('drainGoal').textContent = `/${cfg.goal.pieces}`;
  $('left').textContent = g.settling !== null ? '0' : String(left);
  document.querySelector('.left').classList.toggle('low', left <= 3);
  $('drainBar').style.height = `${progress(g) * 100}%`;

  const full = g.meter >= 1 && sess.phase === 'play';
  $('meterLabel').textContent = full ? `${POWERS[cfg.power].label} ready! Swipe up` : POWERS[cfg.power].label;
  $('meterBar').style.width = `${g.meter * 100}%`;
  document.querySelector('.meter').classList.toggle('full', full);
  $('meterAd').hidden = !meterAd;

  const q = cfg.quest;
  $('quest').textContent = g.questDone ? `✓ Side quest done: ${questText(q)}` : `Side quest: ${questText(q)} (${Math.min(qn, q.n)}/${q.n}) → +power`;
  $('quest').classList.toggle('done', g.questDone);

  $('nowName').textContent = nowMats.length ? label(nowMats) : '–';
  $('nextName').textContent = nextMats.length ? label(nextMats) : '–';
  $('tip').textContent = [...new Set(nextMats)].map((m) => `${NAME[m]}: ${TIP[m]}`).join(' · ');
  $('muteBtn').innerHTML = isMuted() ? '&#128263;' : '&#128266;';
  $('muteBtn').setAttribute('aria-label', isMuted() ? 'Unmute sound' : 'Mute sound');

  const notes = [];
  if (cfg.help) notes.push('Helping hand: an extra fire and water in every bag.');
  if (cfg.mode === 'flood') notes.push('Flood: water keeps rising.');
  if (cfg.mode === 'prefill') notes.push('Burn through the wall.');
  if (sess.daily) notes.push('Daily challenge: same level for everyone today.');
  $('banner').textContent = notes.join(' ');
  $('banner').hidden = notes.length === 0;
  if (g.next) drawNext();
}

function calloutView() {
  const el = $('callout');
  const c = sess.callout;
  if (!c || sess.home || sess.phase !== 'play') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (el.dataset.text !== c.text) {
    el.dataset.text = c.text;
    el.innerHTML = `<b>${c.text}</b><small>tap to hide</small>`;
  }
  el.style.opacity = String(Math.min(1, c.left / 0.4));
}

// ---------- input ----------

function act(a) {
  unlock();
  input(sess, a);
}

// Swipes count anywhere on the screen except on buttons.
let sw = null;
window.addEventListener('pointerdown', (e) => {
  unlock();
  if (!live(sess) || e.target.closest('button')) return;
  const step = (cv.getBoundingClientRect().width / COLS) * 0.75;
  sw = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), step, moved: false };
});

window.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  if (!live(sess)) { sw = null; return; }
  e.preventDefault();
  let dx = e.clientX - sw.ax;
  let dy = e.clientY - sw.ay;
  while (dx >= sw.step) { act('right'); sw.ax += sw.step; dx -= sw.step; sw.moved = true; }
  while (dx <= -sw.step) { act('left'); sw.ax -= sw.step; dx += sw.step; sw.moved = true; }
  // Dragging down soft-drops, but only once the finger is clearly heading down, so a
  // flick (fast and short) still slams instead of dragging.
  if (performance.now() - sw.t > 120 || Math.abs(dy) > sw.step * 3) {
    while (dy >= sw.step) { act('soft'); sw.ay += sw.step; dy -= sw.step; sw.moved = true; }
  }
  if (dy < 0) sw.ay = e.clientY;
}, { passive: false });

window.addEventListener('pointerup', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dt = performance.now() - sw.t;
  const tx = e.clientX - sw.sx;
  const ty = e.clientY - sw.sy;
  const moved = sw.moved;
  sw = null;
  if (!live(sess)) return;
  if (dt < 300 && ty < -50 && -ty > Math.abs(tx) * 1.5) act('power');
  else if (dt < 250 && ty > 50 && ty > Math.abs(tx) * 1.5) act('slam');
  else if (!moved && Math.hypot(tx, ty) < 12 && dt < 400) act('rotate');
});
window.addEventListener('pointercancel', () => { sw = null; });

// Desktop fallback only.
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'soft', ' ': 'slam', f: 'power', Enter: 'power',
};
window.addEventListener('keydown', (e) => {
  unlock();
  if (e.key === 'Escape') {
    if (sess.home) closeHome(sess);
    else openHome(sess);
    return;
  }
  const k = KEYS[e.key];
  if (!k || !live(sess)) return;
  e.preventDefault();
  act(k);
});

// ---------- home screen ----------

// Full sentences here: the home screen scrolls, so there is room to explain.
const HOW_IT_GOES = [
  ['fire', 'Fire never goes out on its own. Water puts it out, and both drain away.'],
  ['water', 'Water puts out fire, turns sand to mud, and soaks wood.'],
  ['wood', 'Wood burns away next to fire. Soak it with water twice and it dissolves.'],
  ['wetwood', 'Wet wood steams next to fire, then dries and burns. More water dissolves it.'],
  ['ice', 'Fire melts ice into water. Water sitting next to ice freezes into it.'],
  ['sand', 'Water turns sand into mud. Fire melts sand into glass.'],
  ['mud', 'Mud sinks away on its own, or water washes it away.'],
  ['glass', 'Slam a piece onto glass, or drop stone on it, and the whole pane smashes.'],
  ['brick', 'Brick is heavy. Water wears it down into sand.'],
  ['stone', 'Stone is the heaviest: it smashes glass. Water wears it down slowly.'],
];

$('legend').innerHTML = HOW_IT_GOES
  .map(([k, text]) => `<li><i style="background:${BASE[k]}"></i><span><b>${NAME[k]}</b> ${text}</span></li>`)
  .join('');
$('powers').innerHTML = Object.values(POWERS)
  .map((p) => `<li><b>${p.label}</b> clears all ${p.clears.map((m) => NAME[m].toLowerCase()).join(', ')}.</li>`)
  .join('');

$('homeBtn').onclick = () => { unlock(); sw = null; openHome(sess); $('home').scrollTop = 0; };
$('playBtn').onclick = () => { unlock(); closeHome(sess); fit(); };
$('dailyBtn').onclick = () => { unlock(); if (dailyReady(sess)) startDaily(sess); fit(); };
$('muteBtn').onclick = () => {
  unlock();
  setMuted(!isMuted());
  sess.store.set('mb_muted', isMuted());
};

// The board takes all the height the phone gives it.
function fit() {
  const stage = document.querySelector('.stage');
  const top = stage.getBoundingClientRect().top;
  const room = window.innerHeight - top - 30; // leave a line for the side quest
  const maxW = stage.clientWidth - 30; // the drain bar sits to the right
  const h = Math.max(200, Math.min(room, maxW * (GH / GW)));
  cv.style.height = `${Math.floor(h)}px`;
  cv.style.width = `${Math.floor(h * (GW / GH))}px`;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();

// A hidden tab stops the frame loop; drop the stale timestamp so nothing jumps on return.
let last = performance.now();
document.addEventListener('visibilitychange', () => { last = performance.now(); sw = null; });

// ---------- debug ----------

// ?debug exposes the live session for tests and runs the invariant checks every frame.
const checker = createValidator();
const debugErrors = [];
let frames = 0;
let physMs = 0;
if (DEBUG) {
  window.mb = {
    sess,
    get game() { return sess.game; },
    get phase() { return sess.phase; },
    errors: debugErrors,
    stats: () => ({ frames, physMs, avgPhysMs: physMs / Math.max(1, frames) }),
  };
  if (params.has('scene')) {
    import('./scenes.js').then(({ SCENES }) => {
      const sc = SCENES[params.get('scene')];
      if (sc) {
        sc.setup(sess);
        lastOverlay = '';
        lastHud = '';
      } else console.error('unknown scene', params.get('scene'));
      window.mb.sceneReady = true;
    });
  }
}

function frame(ts) {
  const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
  last = ts;
  const t0 = performance.now();
  step(sess, dt);
  if (DEBUG) {
    frames++;
    physMs += performance.now() - t0;
    const errs = validate(sess.game, checker);
    if (errs.length && debugErrors.length < 50) {
      debugErrors.push(...errs);
      console.error('invariant', errs);
    }
  }
  handleEvents();
  stepFx(dt);
  draw(ts);
  hud();
  overlays();
  calloutView();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
