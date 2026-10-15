import {
  createGame, update, move, softDrop, hardDrop, rotate, landingY,
  W, H, TOTAL_LEVELS, altitude, targetLines,
} from './core.js';
import { drawScenery } from './scenery.js';

const COL = {
  water: '#3f8ee3', wood: '#a8743f', wetwood: '#5f4a33', ice: '#b5ecfa',
  sand: '#dcb66b', stone: '#8d93a1', mud: '#6e4c30',
  glass: '#cdeee6', brick: '#a8453a', fire: '#ff6a1f',
};
const NAME = {
  water: 'Water', wood: 'Wood', wetwood: 'Wet wood', ice: 'Ice',
  sand: 'Sand', stone: 'Stone', mud: 'Mud', glass: 'Glass', brick: 'Brick', fire: 'Fire',
};
const LEGEND = [
  ['water', 'Water: flows, soaks into wood'],
  ['wood', 'Wood: floats on water'],
  ['wetwood', 'Wet wood: wood + water'],
  ['ice', 'Ice: water freezes next to it'],
  ['sand', 'Sand: slides, turns water to mud'],
  ['stone', 'Stone: no reaction'],
  ['mud', 'Mud: sand + water, stays put'],
  ['glass', 'Glass: melted sand, stone shatters it'],
  ['brick', 'Brick: baked mud'],
  ['fire', 'Fire: burns wood, melts ice and sand, dries water'],
];

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const nxCv = $('nx');
const nctx = nxCv.getContext('2d');
const C = cv.width / W; // cell size in canvas pixels (30)

const KEY = 'mb_level';
function loadLevel() {
  try {
    const v = parseInt(localStorage.getItem(KEY), 10);
    if (v >= 1 && v <= TOTAL_LEVELS) return v;
  } catch (e) { /* storage blocked or unavailable */ }
  return 1;
}
function saveLevel(l) {
  try { localStorage.setItem(KEY, String(l)); } catch (e) { /* ignore */ }
}

let level = loadLevel();
let game = createGame({ level });
let shown = 'play';
let lastHud = '';

function startLevel(l) {
  level = l;
  saveLevel(l);
  game = createGame({ level });
  shown = 'play';
  $('over').hidden = true;
}

function showOverlay(kind) {
  const last = level >= TOTAL_LEVELS;
  $('ovB').hidden = false;
  if (kind === 'win') {
    $('ovT').textContent = 'Level cleared';
    $('ovS').textContent = last
      ? 'All 100 levels cleared.'
      : `Level ${level} cleared. Descending to ${altitude(level) - 1} ft.`;
    $('ovA').textContent = last ? 'Play again' : 'Next level';
    $('ovA').onclick = () => startLevel(last ? 1 : level + 1);
    $('ovB').textContent = 'Replay this level';
    $('ovB').onclick = () => startLevel(level);
  } else {
    $('ovT').textContent = 'Tower topped out';
    $('ovS').textContent = `Level ${level} · ${altitude(level)} ft`;
    $('ovA').textContent = 'Retry level';
    $('ovA').onclick = () => startLevel(level);
    $('ovB').hidden = true;
  }
  $('over').hidden = false;
}

// ---------- drawing ----------

function drawCell(x, y, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * C + 1, y * C + 1, C - 2, C - 2);
  ctx.globalAlpha = 1;
}

// Flickering core so fire reads as flame, not a flat orange block.
function drawFire(x, y, ts) {
  const f = 0.55 + 0.45 * Math.sin(ts / 90 + x * 1.7 + y * 2.3);
  ctx.fillStyle = `rgba(255,220,90,${0.35 + 0.5 * f})`;
  ctx.fillRect(x * C + 6, y * C + 6 + (1 - f) * 4, C - 12, C - 12 - (1 - f) * 4);
}

function draw(ts) {
  drawScenery(ctx, altitude(level), cv.width, cv.height);
  ctx.fillStyle = 'rgba(20,22,30,.35)';
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < W; i++) { ctx.moveTo(i * C, 0); ctx.lineTo(i * C, cv.height); }
  for (let j = 1; j < H; j++) { ctx.moveTo(0, j * C); ctx.lineTo(cv.width, j * C); }
  ctx.stroke();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = game.grid[y][x];
      if (!c) continue;
      drawCell(x, y, COL[c.m]);
      if (c.m === 'fire') drawFire(x, y, ts);
      if (c.m === 'wood' || c.m === 'wetwood') {
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath();
        ctx.moveTo(x * C + 4, y * C + 10);
        ctx.lineTo(x * C + C - 4, y * C + 10);
        ctx.moveTo(x * C + 4, y * C + 20);
        ctx.lineTo(x * C + C - 4, y * C + 20);
        ctx.stroke();
      }
    }
  }

  const p = game.piece;
  if (p) {
    const gy = landingY(game);
    for (const [a, b] of p.cells) drawCell(p.x + a, gy + b, COL[p.m], 0.25);
    for (const [a, b] of p.cells) {
      if (p.y + b < 0) continue;
      drawCell(p.x + a, p.y + b, COL[p.m]);
      if (p.m === 'fire') drawFire(p.x + a, p.y + b, ts);
    }
  }
}

function drawNext() {
  nctx.clearRect(0, 0, nxCv.width, nxCv.height);
  const { m, shape } = game.next;
  const s = 14;
  const w = Math.max(...shape.map(([a]) => a)) + 1;
  const h = Math.max(...shape.map(([, b]) => b)) + 1;
  const ox = (nxCv.width - w * s) / 2;
  const oy = (nxCv.height - h * s) / 2;
  nctx.fillStyle = COL[m];
  for (const [a, b] of shape) nctx.fillRect(ox + a * s + 1, oy + b * s + 1, s - 2, s - 2);
}

function hud() {
  const key = `${level}|${game.lines}|${game.next.m}|${game.next.shape.length}`;
  if (key === lastHud) return;
  lastHud = key;
  $('lvl').textContent = `Level ${level} · ${altitude(level)} ft`;
  $('goal').textContent = `Clear ${targetLines(level)} lines · ${game.lines}/${targetLines(level)}`;
  $('nextName').textContent = NAME[game.next.m];
  drawNext();
}

// ---------- input ----------

// Swipes count anywhere on the screen except on buttons.
let sw = null;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  const step = (cv.getBoundingClientRect().width / W) * 0.75;
  sw = {
    id: e.pointerId, sx: e.clientX, sy: e.clientY,
    ax: e.clientX, ay: e.clientY, t: performance.now(), step, moved: false,
  };
});

window.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  e.preventDefault();
  let dx = e.clientX - sw.ax;
  let dy = e.clientY - sw.ay;
  while (dx >= sw.step) { move(game, 1, 0); sw.ax += sw.step; dx -= sw.step; sw.moved = true; }
  while (dx <= -sw.step) { move(game, -1, 0); sw.ax -= sw.step; dx += sw.step; sw.moved = true; }
  while (dy >= sw.step) { softDrop(game); sw.ay += sw.step; dy -= sw.step; sw.moved = true; }
  if (dy < 0) sw.ay = e.clientY;
}, { passive: false });

function endSwipe(e) {
  if (!sw || e.pointerId !== sw.id) return;
  const dt = performance.now() - sw.t;
  const tx = e.clientX - sw.sx;
  const ty = e.clientY - sw.sy;
  if (dt < 250 && ty > 50 && ty > Math.abs(tx) * 1.5) hardDrop(game);
  else if (!sw.moved && Math.hypot(tx, ty) < 12) rotate(game);
  sw = null;
}
window.addEventListener('pointerup', endSwipe);
window.addEventListener('pointercancel', () => { sw = null; });

// Desktop fallback only.
const KEYS = {
  ArrowLeft: () => move(game, -1, 0),
  ArrowRight: () => move(game, 1, 0),
  ArrowUp: () => rotate(game),
  ArrowDown: () => softDrop(game),
  ' ': () => hardDrop(game),
};
window.addEventListener('keydown', (e) => {
  const k = KEYS[e.key];
  if (!k) return;
  e.preventDefault();
  k();
});

// ---------- loop ----------

$('legend').innerHTML = LEGEND
  .map(([k, label]) => `<span><i style="background:${COL[k]}"></i>${label}</span>`)
  .join('');

let last = performance.now();
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000);
  last = ts;
  update(game, dt);
  if (game.state !== shown) {
    shown = game.state;
    if (shown !== 'play') showOverlay(shown);
  }
  draw(ts);
  hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
