import {
  createGame, update, move, softDrop, hardDrop, rotate, landingY, activatePower, revive, progress,
  piecesDrained, COLS, GW, GH, S, TOTAL_LEVELS, altitude,
} from './core.js';
import { levelConfig, POWERS } from './levels.js';
import { drawScenery } from './scenery.js';
import { showRewarded, showInterstitial, adsRemoved } from './ads.js';

const BASE = {
  water: '#3f8ee3', wood: '#c0813f', wetwood: '#5f4a33', ice: '#b5ecfa', sand: '#dcb66b',
  stone: '#8d93a1', mud: '#6e4c30', glass: '#cdeee6', brick: '#a8453a', fire: '#ff6a1f',
};
const NAME = {
  water: 'Water', wood: 'Wood', wetwood: 'Wet wood', ice: 'Ice', sand: 'Sand', stone: 'Stone',
  mud: 'Mud', glass: 'Glass', brick: 'Brick', fire: 'Fire',
};
// How each material breaks down.
// How each material goes away, short enough to fit two columns on a phone.
const LEGEND = [
  ['fire', 'Fire: water'],
  ['water', 'Water: fire, sand, wood'],
  ['wood', 'Wood: fire, or water twice'],
  ['wetwood', 'Wet wood: water or fire'],
  ['ice', 'Ice: fire melts it'],
  ['sand', 'Sand: water or fire'],
  ['glass', 'Glass: slam it'],
  ['mud', 'Mud: sinks by itself'],
  ['brick', 'Brick: water, slowly'],
  ['stone', 'Stone: water, very slowly'],
];
// One-line tip for the next piece.
const TIP = {
  fire: 'drop water on it to put it out, or set it by wood and ice',
  water: 'pour it on fire, sand or wood',
  wood: 'put it next to fire, or soak it twice',
  ice: 'put it next to fire to melt it',
  sand: 'wet it to make mud, or melt it with fire into glass',
  glass: 'slam a piece onto it to smash it',
  stone: 'hard to clear: water wears it down slowly',
  brick: 'hard to clear: water wears it down',
};
const POWER_COLOR = { blaze: '#ff7a1a', freeze: '#9fe6ff', sweep: '#f0c060', hammer: '#ffffff' };

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const nxCv = $('nx');
const nctx = nxCv.getContext('2d');
const PX = cv.width / GW; // screen pixels per particle (8)

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

// ---------- persistence ----------

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};

// ---------- game state ----------

let level = Math.min(TOTAL_LEVELS, Math.max(1, store.get('mb_level', 1)));
let game;
let phase = 'play'; // 'play' | 'celebrate' | 'won' | 'lost'
let celebrateT = 0;
let meterAdUsed = false;
let lastHud = '';
let lastDrained = 0;
let fx = { debris: [], puffs: [], popups: [], flash: null, shake: 0 };

function startLevel(l) {
  level = l;
  store.set('mb_level', l);
  const losses = store.get(`mb_losses_${l}`, 0);
  const cfg = levelConfig(l, { help: losses >= 3 });
  game = createGame({ level: l, config: cfg });
  phase = 'play';
  meterAdUsed = false;
  lastHud = '';
  lastDrained = 0;
  fx = { debris: [], puffs: [], popups: [], flash: null, shake: 0 };
  $('over').hidden = true;

  const notes = [];
  if (cfg.help) notes.push('Helping hand: an extra fire and water in every bag this round.');
  if (cfg.mode === 'flood') notes.push('Flood: water keeps rising. Freeze it, soak it up, or mud it.');
  if (cfg.mode === 'prefill') notes.push('Burn through the wall.');
  $('banner').textContent = notes.join(' ');
  $('banner').hidden = notes.length === 0;
}

// ---------- overlays ----------

function overlay(title, sub, a, b) {
  $('ovT').textContent = title;
  $('ovS').textContent = sub;
  for (const [el, opt] of [[$('ovA'), a], [$('ovB'), b]]) {
    el.hidden = !opt;
    if (opt) { el.textContent = opt[0]; el.onclick = opt[1]; }
  }
  $('over').hidden = false;
}

function showWin() {
  const last = level >= TOTAL_LEVELS;
  overlay(
    last ? 'You reached the ground' : 'Level cleared',
    last ? 'All 100 levels cleared.' : `Drained ${piecesDrained(game)} blocks. Descending to ${altitude(level) - 1} ft.`,
    [last ? 'Play again' : 'Next level', () => nextLevel(last ? 1 : level + 1)],
    ['Replay this level', () => startLevel(level)],
  );
}

// Interstitials: never in the first 5 levels, at most one every 2 levels, always after the celebration.
async function nextLevel(l) {
  $('over').hidden = true;
  const since = store.get('mb_since_ad', 0) + 1;
  if (level > 5 && since >= 2 && !adsRemoved()) {
    await showInterstitial();
    store.set('mb_since_ad', 0);
  } else {
    store.set('mb_since_ad', since);
  }
  startLevel(l);
}

// Near-miss screen: shows the player's real progress, then offers the one revive.
function showLose() {
  const pct = Math.floor(progress(game) * 100);
  store.set(`mb_losses_${level}`, store.get(`mb_losses_${level}`, 0) + 1);
  overlay(
    pct >= 70 ? 'So close!' : 'Tower topped out',
    `You got ${pct}% of the goal.`,
    game.revived ? null : ['Watch ad: clear the top 4 rows', async () => {
      $('over').hidden = true;
      if (await showRewarded('revive') && revive(game)) phase = 'play';
      else showLose();
    }],
    ['Retry level', () => startLevel(level)],
  );
}

$('meterAd').onclick = async () => {
  if (meterAdUsed || phase !== 'play') return;
  meterAdUsed = true;
  if (await showRewarded('fill power meter')) game.meter = 1;
};

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

function popup(x, y, text, color = '#fff', size = 18) {
  fx.popups.push({ x, y, text, color, size, life: 1, combo: text.startsWith('COMBO') });
}

function handleEvents() {
  for (const e of game.events) {
    if (e.type === 'combo') {
      fx.popups = fx.popups.filter((p) => !p.combo); // the newest combo replaces the last one
      popup(cv.width / 2, cv.height * 0.25, `COMBO ×${e.mult}`, '#ffd34d', 18 + e.mult * 4);
      fx.shake = Math.max(fx.shake, 3 + e.mult * 2);
      if (e.mult >= 3) fx.flash = { color: '#ffd34d', life: 0.25 };
    } else if (e.type === 'shatter') {
      burst(e.cells.map(([x, y]) => [x, y, 'glass']), '#e8fffa', 220, 120);
      fx.shake = Math.max(fx.shake, 8);
      const [x, y] = cellsCenter(e.cells);
      popup(x, y, 'SMASH!', '#e8fffa', 22);
    } else if (e.type === 'steam') {
      fx.puffs.push({ x: (e.x + 0.5) * PX, y: e.y * PX, life: 1, smoke: false });
    } else if (e.type === 'burn') {
      fx.puffs.push({ x: (e.x + 0.5) * PX, y: e.y * PX, life: 1, smoke: true });
    } else if (e.type === 'power') {
      const color = POWER_COLOR[e.power];
      burst(e.cells, color, 260, 700);
      fx.flash = { color, life: 0.6 };
      fx.shake = 16;
      popup(cv.width / 2, cv.height / 2, `${POWERS[e.power].label.toUpperCase()}!  +${e.points}`, color, 30);
    } else if (e.type === 'quest') {
      popup(cv.width / 2, cv.height * 0.3, 'Side quest done! +power', '#7fdc8f', 18);
    }
  }
  game.events.length = 0;
}

function stepFx(dt) {
  for (const d of fx.debris) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 600 * dt; d.life -= dt * 0.9; }
  fx.debris = fx.debris.filter((d) => d.life > 0 && d.y < cv.height + 20);
  for (const p of fx.puffs) { p.y -= 30 * dt; p.life -= dt * 1.2; }
  fx.puffs = fx.puffs.filter((p) => p.life > 0);
  for (const p of fx.popups) { p.y -= 40 * dt; p.life -= dt * 0.8; }
  fx.popups = fx.popups.filter((p) => p.life > 0);
  if (fx.flash) { fx.flash.life -= dt; if (fx.flash.life <= 0) fx.flash = null; }
  fx.shake = Math.max(0, fx.shake - dt * 40);
}

// ---------- drawing ----------

function drawParticles(ts) {
  const d = img.data;
  d.fill(0);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const c = game.grid[y][x];
      if (!c) continue;
      // Wood gets horizontal grain lines so it reads as planks, not dirt.
      const shade = c.m === 'wood' || c.m === 'wetwood'
        ? (y % S === 0 ? 0 : 2 + (c.shade > 0.7 ? 1 : 0))
        : Math.floor(c.shade * 4);
      let [r, g, b] = SHADES[c.m][shade];
      if (c.m === 'fire') {
        const f = 0.75 + 0.35 * Math.sin(ts / 70 + x * 1.3 + y * 2.1);
        r = Math.min(255, r * f + 40); g = Math.min(255, g * f + 30 * f); b *= f;
      }
      const i = (y * GW + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      d[i + 3] = c.m === 'glass' ? 190 : 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, 0, 0, cv.width, cv.height);
}

function drawPiece(ts) {
  const p = game.piece;
  if (!p) return;
  const cell = S * PX;
  const gy = landingY(game);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = BASE[p.m];
  for (const [a, b] of p.cells) ctx.fillRect((p.x + a) * cell + 1, (gy + b * S) * PX + 1, cell - 2, cell - 2);
  ctx.globalAlpha = 1;
  for (const [a, b] of p.cells) {
    const x = (p.x + a) * cell;
    const y = (p.y + b * S) * PX;
    ctx.fillStyle = BASE[p.m];
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    if (p.m === 'fire') {
      const f = 0.55 + 0.45 * Math.sin(ts / 90 + a * 1.7 + b * 2.3);
      ctx.fillStyle = `rgba(255,220,90,${0.35 + 0.5 * f})`;
      ctx.fillRect(x + 7, y + 7, cell - 14, cell - 14);
    }
  }
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

function draw(ts) {
  // During the celebration the camera pans down 1 ft.
  let alt = altitude(level);
  if (phase === 'celebrate') alt -= Math.min(1, Math.max(0, (celebrateT - 0.8) / 1.2));
  else if (phase === 'won') alt -= 1;

  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  drawScenery(ctx, Math.max(1, alt), cv.width, cv.height);
  ctx.fillStyle = 'rgba(20,22,30,.35)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  drawParticles(ts);
  if (phase === 'play') drawPiece(ts);
  drawFx();
  if (phase === 'celebrate' || phase === 'won') {
    const total = piecesDrained(game);
    const shown = phase === 'won' ? total : Math.floor(total * Math.min(1, celebrateT / 1.2));
    ctx.textAlign = 'center';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText('LEVEL CLEARED', cv.width / 2, cv.height * 0.38);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('LEVEL CLEARED', cv.width / 2, cv.height * 0.38);
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.strokeText(`${shown} blocks drained`, cv.width / 2, cv.height * 0.46);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${shown} blocks drained`, cv.width / 2, cv.height * 0.46);
  }
  ctx.restore();
}

function drawNext() {
  nctx.clearRect(0, 0, nxCv.width, nxCv.height);
  const { m, shape } = game.next;
  const s = 12;
  const w = Math.max(...shape.map(([a]) => a)) + 1;
  const h = Math.max(...shape.map(([, b]) => b)) + 1;
  const ox = (nxCv.width - w * s) / 2;
  const oy = (nxCv.height - h * s) / 2;
  nctx.fillStyle = BASE[m];
  for (const [a, b] of shape) nctx.fillRect(ox + a * s + 1, oy + b * s + 1, s - 2, s - 2);
}

function hud() {
  const cfg = game.cfg;
  const drained = piecesDrained(game);
  const key = [level, drained, game.next.m, game.next.shape, game.meter.toFixed(2), game.questDone, phase, meterAdUsed].join('|');
  if (key === lastHud) return;
  if (drained > lastDrained) {
    const el = document.querySelector('.drain');
    el.classList.remove('bump');
    void el.offsetWidth; // restart the bump animation
    el.classList.add('bump');
  }
  lastDrained = drained;
  lastHud = key;

  $('lvl').textContent = `Level ${level} · ${altitude(level)} ft`;
  $('goal').textContent = `Drain ${cfg.goal.pieces} blocks to clear the level`;
  $('drainNum').textContent = String(drained);
  $('drainGoal').textContent = `/${cfg.goal.pieces}`;
  $('drainBar').style.height = `${progress(game) * 100}%`;

  const full = game.meter >= 1 && phase === 'play';
  $('meterLabel').textContent = full ? `${POWERS[cfg.power].label} ready! Swipe up` : POWERS[cfg.power].label;
  $('meterBar').style.width = `${game.meter * 100}%`;
  document.querySelector('.meter').classList.toggle('full', full);
  $('meterAd').hidden = !(phase === 'play' && !meterAdUsed && game.meter >= 0.8 && !full);

  const q = cfg.quest;
  $('quest').textContent = `${game.questDone ? '✓ ' : ''}Side quest: ${q.type === 'chain' ? `hit a ×${q.n} combo` : `put out ${q.n} blocks of fire`} (+power)`;
  $('quest').classList.toggle('done', game.questDone);

  $('nextName').textContent = NAME[game.next.m];
  $('tip').textContent = `Next: ${NAME[game.next.m].toLowerCase()}, ${TIP[game.next.m]}.`;
  drawNext();
}

// ---------- input ----------

function usePower() {
  if (phase === 'play') activatePower(game);
}

// Swipes count anywhere on the screen except on buttons.
let sw = null;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  const step = (cv.getBoundingClientRect().width / COLS) * 0.75;
  sw = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), step, moved: false };
});

window.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id || phase !== 'play') return;
  e.preventDefault();
  let dx = e.clientX - sw.ax;
  let dy = e.clientY - sw.ay;
  while (dx >= sw.step) { move(game, 1); sw.ax += sw.step; dx -= sw.step; sw.moved = true; }
  while (dx <= -sw.step) { move(game, -1); sw.ax -= sw.step; dx += sw.step; sw.moved = true; }
  while (dy >= sw.step) { softDrop(game); sw.ay += sw.step; dy -= sw.step; sw.moved = true; }
  if (dy < 0) sw.ay = e.clientY;
}, { passive: false });

window.addEventListener('pointerup', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dt = performance.now() - sw.t;
  const tx = e.clientX - sw.sx;
  const ty = e.clientY - sw.sy;
  sw = null;
  if (phase !== 'play') return;
  if (dt < 300 && ty < -50 && -ty > Math.abs(tx) * 1.5) usePower();
  else if (dt < 250 && ty > 50 && ty > Math.abs(tx) * 1.5) hardDrop(game);
  else if (Math.hypot(tx, ty) < 12) rotate(game);
});
window.addEventListener('pointercancel', () => { sw = null; });

// Desktop fallback only.
const KEYS = {
  ArrowLeft: () => move(game, -1),
  ArrowRight: () => move(game, 1),
  ArrowUp: () => rotate(game),
  ArrowDown: () => softDrop(game),
  ' ': () => hardDrop(game),
  f: usePower,
  Enter: usePower,
};
window.addEventListener('keydown', (e) => {
  const k = KEYS[e.key];
  if (!k || phase !== 'play') return;
  e.preventDefault();
  k();
});

// ---------- loop ----------

$('legend').innerHTML = LEGEND
  .map(([k, label]) => `<span><i style="background:${BASE[k]}"></i>${label}</span>`)
  .join('');

function celebrate() {
  // Everything left on the board shatters and falls away.
  const cells = [];
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (game.grid[y][x]) { cells.push([x, y, game.grid[y][x].m]); game.grid[y][x] = null; }
    }
  }
  burst(cells, null, 200, 900);
  fx.flash = { color: '#ffd34d', life: 0.5 };
  fx.shake = 12;
  phase = 'celebrate';
  celebrateT = 0;
  store.set(`mb_losses_${level}`, 0);
}

startLevel(level);

// ?debug in the URL exposes the live game for testing in the browser console.
if (new URLSearchParams(location.search).has('debug')) {
  window.mb = { get game() { return game; }, get phase() { return phase; } };
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000);
  last = ts;
  if (phase === 'play') {
    update(game, dt);
    handleEvents();
    if (game.state === 'win') celebrate();
    else if (game.state === 'lose') { phase = 'lost'; showLose(); }
  } else if (phase === 'celebrate') {
    celebrateT += dt;
    if (celebrateT >= 2) { phase = 'won'; showWin(); }
  }
  stepFx(dt);
  draw(ts);
  hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
