// Sand mode screen: its own board, HUD, controls and overlays, laid over the map. The rules
// live in sandcore.js; this file draws them and turns touches and keys into moves.

import { createSand, step, move, rotate, drop, landing, colorName, COLORS, CW, CH, G, GW, GH, LEVEL_POINTS } from './sandcore.js';
import { icon } from '../ui/icons.js';

const BEST_KEY = 'mb_sand_best';
const TICK = 1 / 60;

const readBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = (n) => { try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode */ } };
const rgb = ([r, g, b], k = 1) => `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;

// One G x G cell of a color as speckled sand with a block bevel, baked once per color.
function bakeCell(base, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const u = px / G;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    g.fillStyle = rgb(base, 0.88 + Math.random() * 0.24);
    g.fillRect(Math.floor(i * u), Math.floor(j * u), Math.ceil(u), Math.ceil(u));
  }
  const b = Math.max(2, Math.round(px * 0.09));
  g.fillStyle = 'rgba(255,240,215,.38)';
  g.fillRect(0, 0, px, b); g.fillRect(0, 0, b, px);
  g.fillStyle = 'rgba(30,14,6,.42)';
  g.fillRect(0, px - b, px, b); g.fillRect(px - b, 0, b, px);
  return c;
}

export function createSandMode({ play, buzz, onOpen, onExit }) {
  const root = document.createElement('section');
  root.id = 'sand';
  root.className = 'sandmode';
  root.hidden = true;
  root.setAttribute('aria-label', 'Sand mode');
  root.innerHTML = `
    <header class="sd-top">
      <button class="btn-ic" id="sdPause" aria-label="Pause">${icon('pause')}</button>
      <div class="panel sd-score"><small>Score</small><b class="t" id="sdScore">0</b></div>
      <div class="panel sd-level"><small>Level</small><b class="t" id="sdLevel">1</b><i class="sd-bar"><i id="sdBar"></i></i></div>
    </header>
    <div class="sd-wellwrap">
      <div class="sd-well" id="sdWell">
        <div class="sd-wall l" aria-hidden="true"></div>
        <div class="sd-wall r" aria-hidden="true"></div>
        <canvas id="sdCv" aria-label="Sand board"></canvas>
        <div class="sd-pops" id="sdPops" aria-live="polite"></div>
      </div>
    </div>
    <footer class="sd-bottom">
      <div class="panel sd-now"><small>Now</small><span class="sd-nowrow"><span class="sd-sw" id="sdNowSw"></span><b id="sdNow"></b></span></div>
      <div class="sd-hint">Link one color<br>wall to wall</div>
      <div class="panel sd-next"><small>Next</small><canvas id="sdNx" width="64" height="34"></canvas><b id="sdNext"></b></div>
    </footer>
    <div class="sd-over" id="sdOver" hidden>
      <div class="sd-card panel">
        <div class="ribbon t" id="sdOvT">Paused</div>
        <div class="sd-ovstats" id="sdOvS"></div>
        <div class="sd-ovbtns">
          <button class="btn btn-navy" id="sdOvB"><span class="t">Map</span></button>
          <button class="btn btn-green" id="sdOvA"><span class="t">Resume</span></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector(`#${id}`);
  const cv = $('sdCv');
  const ctx = cv.getContext('2d');
  const nx = $('sdNx');
  const nctx = nx.getContext('2d');
  // The grains are drawn into a GW x GH image, then scaled up crisp.
  const grains = document.createElement('canvas');
  grains.width = GW; grains.height = GH;
  const gctx = grains.getContext('2d');
  const img = gctx.createImageData(GW, GH);
  // Per-color shade table: 32 tints of each base.
  const tint = COLORS.map((c) => Array.from({ length: 32 }, (_, k) => {
    const f = 0.84 + (k / 31) * 0.3;
    return c.base.map((v) => Math.min(255, Math.round(v * f)));
  }));

  let s = null;
  let open = false;
  let paused = false;
  let best = readBest();
  let raf = 0;
  let last = 0;
  let acc = 0;
  let cell = 20;
  let dpr = 1;
  let cells = [];
  let parts = [];
  let shake = 0;
  let lastHud = '';
  let pieceX = 0;
  let newBest = false;

  function fit() {
    const top = root.querySelector('.sd-top').offsetHeight;
    const bot = root.querySelector('.sd-bottom').offsetHeight;
    const availH = innerHeight - top - bot - 40;
    const availW = Math.min(innerWidth - 40, 520);
    cell = Math.max(10, Math.floor(Math.min(availW / CW, availH / CH)));
    // Whole grains on screen keep the sand crisp.
    cell = Math.max(G, Math.floor(cell / G) * G) || cell;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.width = `${cell * CW}px`;
    cv.style.height = `${cell * CH}px`;
    cv.width = Math.round(cell * CW * dpr);
    cv.height = Math.round(cell * CH * dpr);
    cells = COLORS.map((c) => bakeCell(c.base, Math.round(cell * dpr)));
  }

  function start() {
    s = createSand();
    parts = [];
    newBest = false;
    paused = false;
    lastHud = '';
    pieceX = s.piece ? s.piece.x : 0;
    $('sdOver').hidden = true;
  }

  function show() {
    if (open) return;
    open = true;
    root.hidden = false;
    onOpen?.();
    fit();
    start();
    play('open');
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function hide() {
    open = false;
    root.hidden = true;
    cancelAnimationFrame(raf);
    play('close');
    onExit?.();
  }

  function pause(v) {
    if (!s || s.over) return;
    paused = v;
    if (v) overlay('Paused', `<p>Score <b class="t">${s.score.toLocaleString('en-US')}</b></p>`, 'Resume');
    else $('sdOver').hidden = true;
    play(v ? 'open' : 'close');
  }

  function overlay(title, html, a) {
    $('sdOvT').textContent = title;
    $('sdOvS').innerHTML = html;
    $('sdOvA').innerHTML = `<span class="t">${a}</span>`;
    $('sdOver').hidden = false;
    $('sdOver').classList.toggle('lose', title !== 'Paused');
  }

  // ---------- events from the rules ----------

  function popText(html, cls = '') {
    const el = document.createElement('div');
    el.className = `sd-pop ${cls}`;
    el.innerHTML = html;
    $('sdPops').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  function burst(color, n) {
    // Sparks from grains that are flashing out.
    const picks = [];
    for (let i = 0; i < s.flash.length && picks.length < 400; i++) if (s.flash[i] > 0) picks.push(i);
    const base = COLORS[color]?.base || [255, 255, 255];
    for (let k = 0; k < Math.min(n, 90); k++) {
      const i = picks[Math.floor(Math.random() * picks.length)];
      if (i === undefined) break;
      parts.push({
        x: (i % GW + 0.5) * (cell / G), y: (Math.floor(i / GW) + 0.5) * (cell / G),
        vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 260, life: 0.6 + Math.random() * 0.5,
        c: Math.random() < 0.35 ? '#fff3d6' : rgb(base, 1.1 + Math.random() * 0.3), z: 2 + Math.random() * 3,
      });
    }
  }

  function handle(evs) {
    for (const e of evs) {
      if (e.type === 'land') { play('sand'); buzz?.(8); shake = Math.max(shake, 3); }
      else if (e.type === 'clear') {
        play('drain', { mult: Math.min(4, e.chain) });
        if (e.chain > 1) play('combo', { mult: Math.min(4, e.chain) });
        buzz?.(e.chain > 1 ? [12, 40, 18] : 16);
        burst(e.color, 60 + e.chain * 15);
        shake = Math.max(shake, 5 + e.chain * 2);
        popText(`+${e.points.toLocaleString('en-US')}`, 'pts');
        if (e.chain > 1) popText(`Chain ×${e.chain}`, 'chain');
      } else if (e.type === 'level') {
        play('unlock');
        popText(`Level ${e.level}`, 'lvl');
      } else if (e.type === 'over') {
        play('lose');
        buzz?.([30, 60, 30]);
        if (s.score > best) { best = s.score; saveBest(best); newBest = true; }
        setTimeout(() => {
          if (!open || !s.over) return;
          overlay('Topped out', `<p>Score <b class="t">${s.score.toLocaleString('en-US')}</b></p><p>${newBest ? '<em>New best!</em>' : `Best <b class="t">${best.toLocaleString('en-US')}</b>`}</p><p>Level <b class="t">${s.level}</b></p>`, 'Retry');
        }, 700);
      }
    }
  }

  // ---------- input ----------

  function act(a) {
    if (!s || s.over || paused) return;
    if (a === 'left' || a === 'right') { if (move(s, a === 'left' ? -1 : 1)) play('move'); }
    else if (a === 'rotate') { if (rotate(s)) play('rotate'); }
    else if (a === 'drop') {
      const n = drop(s);
      if (n > G) { play('slam'); shake = Math.max(shake, 6); }
      handle(s.events.splice(0));
    }
  }

  let sw = null;
  root.addEventListener('pointerdown', (e) => {
    if (!open || paused || e.target.closest('button, .sd-over')) return;
    sw = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), step: cell * 0.75, moved: false };
  });
  root.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    e.preventDefault();
    let dx = e.clientX - sw.ax;
    while (dx >= sw.step) { act('right'); sw.ax += sw.step; dx -= sw.step; sw.moved = true; }
    while (dx <= -sw.step) { act('left'); sw.ax -= sw.step; dx += sw.step; sw.moved = true; }
    const dy = e.clientY - sw.sy;
    // Holding a drag downward pours the piece faster; a quick flick still hard-drops.
    if (s) s.soft = (performance.now() - sw.t > 120 || dy > sw.step * 3) && dy > sw.step;
    if (s?.soft) sw.moved = true;
  }, { passive: false });
  const endSwipe = (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const dt = performance.now() - sw.t;
    const tx = e.clientX - sw.sx;
    const ty = e.clientY - sw.sy;
    const moved = sw.moved;
    sw = null;
    if (s) s.soft = false;
    if (e.type === 'pointercancel') return;
    if (dt < 250 && ty > 50 && ty > Math.abs(tx) * 1.5) act('drop');
    else if (!moved && Math.hypot(tx, ty) < 12 && dt < 400) act('rotate');
  };
  root.addEventListener('pointerup', endSwipe);
  root.addEventListener('pointercancel', endSwipe);

  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', x: 'rotate', ' ': 'drop' };
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (s?.over) hide();
      else pause(!paused);
      return;
    }
    if (e.key === 'ArrowDown') { if (s && !paused) s.soft = true; e.preventDefault(); return; }
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    act(k);
  });
  window.addEventListener('keyup', (e) => { if (open && e.key === 'ArrowDown' && s) s.soft = false; });
  window.addEventListener('resize', () => { if (open) fit(); });
  document.addEventListener('visibilitychange', () => { if (open && document.hidden && s && !s.over && !paused) pause(true); });

  $('sdPause').onclick = () => { if (s?.over) return; pause(true); };
  $('sdOvA').onclick = () => {
    if (s?.over) { play('tap'); start(); } else pause(false);
  };
  $('sdOvB').onclick = () => hide();

  // ---------- drawing ----------

  function hud() {
    const p = s.piece;
    const into = (s.score % LEVEL_POINTS) / LEVEL_POINTS;
    const key = `${s.score}|${s.level}|${p?.color}|${s.next.color}|${s.next.shape}`;
    if (key === lastHud) return;
    lastHud = key;
    $('sdScore').textContent = s.score.toLocaleString('en-US');
    $('sdLevel').textContent = s.level;
    $('sdBar').style.width = `${Math.round(into * 100)}%`;
    const now = p ? p.color : s.next.color;
    $('sdNow').textContent = colorName(now);
    $('sdNowSw').style.background = rgb(COLORS[now].base);
    $('sdNext').textContent = colorName(s.next.color);
    // Next piece preview.
    nctx.clearRect(0, 0, nx.width, nx.height);
    const sh = s.next.shape;
    const w = Math.max(...sh.map(([a]) => a)) + 1;
    const h = Math.max(...sh.map(([, b]) => b)) + 1;
    const u = Math.floor(Math.min(nx.width / w, nx.height / h, 15));
    const ox = Math.round((nx.width - w * u) / 2);
    const oy = Math.round((nx.height - h * u) / 2);
    nctx.imageSmoothingEnabled = false;
    for (const [a, b] of sh) nctx.drawImage(cells[s.next.color], ox + a * u, oy + b * u, u, u);
  }

  function draw(ts) {
    const W = cv.width;
    const H = cv.height;
    const gp = (cell / G) * dpr; // one grain in device px
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Back wall: dark fired clay with faint column lines.
    ctx.fillStyle = '#211812';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,230,200,.035)';
    for (let x = 1; x < CW; x += 2) ctx.fillRect(Math.round(x * cell * dpr), 0, Math.round(cell * dpr), H);
    // Grains.
    const d = img.data;
    const blink = Math.floor(ts / 70) % 2 === 0;
    for (let i = 0, o = 0; i < s.cell.length; i++, o += 4) {
      const v = s.cell[i];
      if (!v) { d[o + 3] = 0; continue; }
      if (s.flash[i] > 0) {
        const w = blink ? 255 : 235;
        d[o] = w; d[o + 1] = w; d[o + 2] = blink ? 240 : 200; d[o + 3] = 255;
        continue;
      }
      const t = tint[v - 1][s.shade[i] >> 3];
      d[o] = t[0]; d[o + 1] = t[1]; d[o + 2] = t[2]; d[o + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grains, 0, 0, W, H);
    // Ghost and piece.
    const p = s.piece;
    if (p) {
      pieceX += (p.x - pieceX) * 0.45;
      if (Math.abs(p.x - pieceX) < 0.1) pieceX = p.x;
      const ly = landing(s);
      const c = Math.round(cell * dpr);
      ctx.strokeStyle = rgb(COLORS[p.color].base, 1.35);
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, Math.round(dpr * 1.5));
      ctx.setLineDash([Math.round(3 * dpr), Math.round(3 * dpr)]);
      for (const [a, b] of p.shape) ctx.strokeRect(p.x * gp + a * c + ctx.lineWidth / 2, ly * gp + b * c + ctx.lineWidth / 2, c - ctx.lineWidth, c - ctx.lineWidth);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // Dark outline round the whole piece so it reads against sand of its own color.
      ctx.fillStyle = 'rgba(20,10,4,.75)';
      const o = Math.max(1, Math.round(dpr * 1.5));
      for (const [a, b] of p.shape) ctx.fillRect(pieceX * gp + a * c - o, p.y * gp + b * c - o, c + o * 2, c + o * 2);
      for (const [a, b] of p.shape) ctx.drawImage(cells[p.color], Math.round(pieceX * gp + a * c), Math.round(p.y * gp + b * c), c, c);
    }
    // Sparks.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const q of parts) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = q.c;
      ctx.fillRect(q.x - q.z / 2, q.y - q.z / 2, q.z, q.z);
    }
    ctx.globalAlpha = 1;
  }

  function frame(ts) {
    if (!open) return;
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (!paused && s && !document.hidden) {
      acc += dt;
      let n = 0;
      while (acc >= TICK && n < 6) {
        acc -= TICK;
        n++;
        handle(step(s, TICK));
      }
      if (n === 6) acc = 0;
    }
    for (const q of parts) { q.life -= dt; q.vy += 700 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    parts = parts.filter((q) => q.life > 0);
    if (s) { hud(); draw(ts); }
    const well = $('sdWell');
    if (shake > 0.3) {
      shake *= 0.86;
      well.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`;
    } else if (well.style.transform) { well.style.transform = ''; shake = 0; }
    raf = requestAnimationFrame(frame);
  }

  return {
    show,
    hide,
    get open() { return open; },
    get state() { return s; },
    get best() { return best; },
  };
}
