// Screen-space effects on one full-screen canvas above everything: voxel debris, glass
// shards, steam and smoke, embers, confetti, the collection flights that carry drained
// material into the goal meter, coin flights and the big outlined praise words.
// Coordinates are CSS pixels. Nothing here reads or changes the game.

import { canvas } from './color.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = {
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
};

function puffSprite(color) {
  const c = canvas(64, 64);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color.replace('A', '0.9'));
  g.addColorStop(0.55, color.replace('A', '0.5'));
  g.addColorStop(1, color.replace('A', '0'));
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}

function coinSprite(size) {
  const c = canvas(size * 2, size * 2);
  const x = c.getContext('2d');
  const r = size;
  x.translate(r, r);
  x.fillStyle = '#0d1640';
  x.beginPath(); x.arc(0, 0, r * 0.98, 0, TAU); x.fill();
  const g = x.createRadialGradient(-r * 0.3, -r * 0.35, 0, 0, 0, r);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#ffc83a'); g.addColorStop(1, '#e8960c');
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r * 0.8, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(184,110,0,.8)'; x.lineWidth = r * 0.12;
  x.beginPath(); x.arc(0, 0, r * 0.52, 0, TAU); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.75)';
  x.fillRect(-r * 0.12, -r * 0.34, r * 0.24, r * 0.68);
  return c;
}

const GOLD = ['#fff6b0', '#ffc83a', '#e8960c'];

export function createFx(cv) {
  const ctx = cv.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let parts = [];
  let flights = [];
  let texts = [];
  let flash = null;
  let dirty = false;
  const steam = puffSprite('rgba(240,248,255,A)');
  const smoke = puffSprite('rgba(70,60,56,A)');
  const glow = puffSprite('rgba(255,190,90,A)');
  let coin = coinSprite(14);
  let motion = 1; // 0 when the player asked for reduced motion
  let clip = null; // the board's screen rect: debris and flashes stay inside it

  function resize(cap = 1.5) {
    dpr = Math.min(cap, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    coin = coinSprite(14);
  }

  const add = (p) => {
    parts.push(p);
    if (parts.length > 1400) parts.splice(0, parts.length - 1400);
  };

  // Chunky voxel debris: little cubes with a lit top and a dark bottom.
  function cubes(x, y, colors, n, speed = 260, size = 8) {
    for (let k = 0; k < n * motion + (motion ? 0 : 2); k++) {
      const a = rand(0, TAU);
      const v = speed * rand(0.35, 1);
      add({ kind: 'cube', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.55, g: 900, life: rand(0.6, 1.1), max: 1, size: size * rand(0.6, 1.3), color: colors[k % colors.length], rot: rand(0, TAU), vr: rand(-8, 8) });
    }
  }

  function shards(x, y, n, spread = 30) {
    for (let k = 0; k < n * motion; k++) {
      const a = rand(0, TAU);
      const v = rand(140, 420);
      add({ kind: 'shard', x: x + rand(-spread, spread), y: y + rand(-spread * 0.5, spread * 0.5), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220, g: 1100, life: rand(0.6, 1.1), max: 1, size: rand(6, 16), rot: rand(0, TAU), vr: rand(-14, 14) });
    }
  }

  function puff(x, y, dark, size = 18) {
    add({ kind: dark ? 'smoke' : 'steam', x: x + rand(-4, 4), y, vx: rand(-14, 14), vy: rand(-55, -30), g: 0, life: rand(0.7, 1.1), max: 1, size, grow: 2.2 });
  }

  function sparks(x, y, n, color = '#ffb347') {
    for (let k = 0; k < n * motion; k++) add({ kind: 'spark', x: x + rand(-6, 6), y, vx: rand(-40, 40), vy: rand(-160, -60), g: -40, life: rand(0.4, 0.9), max: 1, size: rand(2, 4), color });
  }

  function dust(x, y, n) {
    for (let k = 0; k < n * motion; k++) add({ kind: 'smoke', x: x + rand(-20, 20), y, vx: rand(-90, 90), vy: rand(-40, -10), g: 0, life: rand(0.35, 0.6), max: 1, size: rand(8, 14), grow: 1.6, alpha: 0.5 });
  }

  function confetti(n, colors) {
    for (let k = 0; k < n * motion; k++) {
      add({ kind: 'confetti', x: rand(0, W), y: rand(-H * 0.4, -10), vx: rand(-40, 40), vy: rand(80, 240), g: 120, life: rand(2.2, 3.6), max: 3.6, size: rand(6, 11), color: colors[k % colors.length], rot: rand(0, TAU), vr: rand(-6, 6), flip: rand(4, 10) });
    }
  }

  function ring(x, y, color, size = 60) {
    add({ kind: 'ring', x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size, color });
  }

  // An orb that arcs from (x0, y0) into (x1, y1); onArrive runs when it lands.
  function flight(x0, y0, x1, y1, { color = '#8ff0ff', edge = null, delay = 0, dur = 0.55, size = 9, kind = 'orb', onArrive } = {}) {
    const mx = (x0 + x1) / 2 + rand(-140, 140);
    const my = Math.min(y0, y1) - rand(20, 160);
    flights.push({ x0, y0, x1, y1, mx, my, t: -delay, dur, color, edge, size, kind, onArrive });
  }

  // Big outlined game text. style: 'gold' | 'white' | 'aqua' | 'pink' | 'green'
  function word(text, x, y, { size = 54, style = 'gold', life = 1.1, rise = 40, sub = '', slot = '' } = {}) {
    // A new word in the same slot replaces the last one, so praise never stacks.
    if (slot) texts = texts.filter((t) => t.slot !== slot);
    texts.push({ text, x, y, size, style, life, max: life, rise, sub, slot });
  }

  function popText(text, x, y, color = '#fff', size = 22) {
    texts.push({ text, x, y, size, style: color, life: 0.8, max: 0.8, rise: 46, small: true });
  }

  function doFlash(color, life = 0.3, alpha = 0.5) {
    if (!motion) alpha *= 0.4;
    flash = { color, life, max: life, alpha };
  }

  function clear() {
    parts = [];
    flights = [];
    texts = [];
    flash = null;
  }

  function step(dt) {
    for (const p of parts) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      p.life -= dt;
      if (p.kind === 'confetti') { p.vx *= 0.99; p.vy = Math.min(p.vy, 260); }
    }
    let n = 0;
    for (const p of parts) if (p.life > 0 && p.y < H + 60) parts[n++] = p;
    parts.length = n;
    for (const f of flights) {
      f.t += dt;
      if (f.t >= f.dur && !f.done) {
        f.done = true;
        if (f.onArrive) f.onArrive(f);
      }
    }
    if (flights.some((f) => f.done)) flights = flights.filter((f) => !f.done);
    for (const t of texts) t.life -= dt;
    if (texts.some((t) => t.life <= 0)) texts = texts.filter((t) => t.life > 0);
    if (flash) { flash.life -= dt; if (flash.life <= 0) flash = null; }
  }

  function drawText(t) {
    const age = t.max - t.life;
    const k = Math.min(1, age / 0.28);
    const s = t.small ? 1 : (k < 1 ? 0.4 + 0.6 * ease.outBack(k) : 1);
    const fade = Math.min(1, t.life / 0.3);
    const y = t.y - (t.small ? age * t.rise : Math.max(0, age - 0.5) * t.rise);
    ctx.save();
    ctx.translate(t.x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = fade;
    ctx.font = `${t.size}px 'Lilita One', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const lw = Math.max(4, t.size * 0.17);
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#0d1640';
    ctx.fillStyle = 'rgba(13,22,64,.45)';
    ctx.fillText(t.text, 0, lw * 0.9);
    ctx.strokeText(t.text, 0, lw * 0.9);
    ctx.strokeText(t.text, 0, 0);
    let fill = t.style;
    const styles = {
      gold: ['#fffbe0', '#ffd84a', '#f29a0c'],
      white: ['#ffffff', '#f0f6ff', '#c9dcff'],
      aqua: ['#e8fdff', '#7fe8ff', '#1fa4f0'],
      pink: ['#fff0fa', '#ff9ad8', '#e24aa8'],
      green: ['#f2ffe0', '#9ff060', '#3fb81a'],
      red: ['#fff0ec', '#ff8a70', '#e2362a'],
    };
    if (styles[t.style]) {
      const [a, b, c] = styles[t.style];
      const g = ctx.createLinearGradient(0, -t.size * 0.5, 0, t.size * 0.5);
      g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, c);
      fill = g;
    }
    ctx.fillStyle = fill;
    ctx.fillText(t.text, 0, 0);
    if (!t.small) {
      ctx.globalAlpha = fade * 0.55;
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.beginPath();
      ctx.rect(-W, -t.size * 0.5, W * 2, t.size * 0.3);
      ctx.clip();
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    if (t.sub) {
      ctx.globalAlpha = fade;
      ctx.font = `${Math.round(t.size * 0.38)}px 'Lilita One', system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size * 0.09);
      const sy = t.size * 0.72;
      ctx.strokeText(t.sub, 0, sy);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.sub, 0, sy);
    }
    ctx.restore();
  }

  function draw() {
    const active = parts.length || flights.length || texts.length || flash;
    if (!active) {
      if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; cv.style.visibility = 'hidden'; }
      return;
    }
    if (!dirty) cv.style.visibility = 'visible';
    dirty = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (clip) { ctx.beginPath(); ctx.rect(clip.x - 6, clip.y - 6, clip.w + 12, clip.h + 12); ctx.clip(); }
    for (const p of parts) {
      if (p.kind === 'confetti') continue;
      const a = Math.max(0, Math.min(1, p.life / Math.min(0.35, p.max)));
      if (p.kind === 'cube') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        const s = p.size;
        ctx.fillStyle = '#0d1640';
        ctx.fillRect(-s / 2 - 1.5, -s / 2 - 1.5, s + 3, s + 3);
        ctx.fillStyle = p.color;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.fillRect(-s / 2, -s / 2, s, s * 0.28);
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillRect(-s / 2, s * 0.22, s, s * 0.28);
        ctx.restore();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.55, s * 0.6);
        ctx.lineTo(-s * 0.45, s * 0.35);
        ctx.closePath();
        const sg = ctx.createLinearGradient(-s, -s, s, s);
        sg.addColorStop(0, 'rgba(255,255,255,.95)');
        sg.addColorStop(0.5, 'rgba(170,236,255,.8)');
        sg.addColorStop(1, 'rgba(90,190,240,.7)');
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.strokeStyle = '#0d1640';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'steam' || p.kind === 'smoke') {
        const s = p.size * (1 + (1 - p.life / p.max) * (p.grow || 1));
        ctx.globalAlpha = a * (p.alpha ?? (p.kind === 'smoke' ? 0.55 : 0.75));
        ctx.drawImage(p.kind === 'smoke' ? smoke : steam, p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glow, p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
        ctx.fillStyle = '#fff3c0';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (flash) {
      ctx.globalAlpha = Math.min(flash.alpha, (flash.life / flash.max) * flash.alpha);
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    for (const p of parts) {
      if (p.kind !== 'confetti') continue;
      {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.life * p.flip));
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    for (const p of parts) {
      if (p.kind === 'ring') {
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.3 + k), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of flights) {
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / f.dur);
      const e = ease.inQuad(k);
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * f.mx + e * e * f.x1;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * f.my + e * e * f.y1;
      if (f.kind === 'coin') {
        const s = 14 * (1 + 0.3 * Math.sin(k * Math.PI));
        ctx.drawImage(coin, x - s, y - s, s * 2, s * 2);
        continue;
      }
      const s = f.size * (1 - 0.35 * k);
      for (let tr = 1; tr <= 3; tr++) {
        const kt = Math.max(0, f.t - tr * 0.035) / f.dur;
        const et = ease.inQuad(Math.min(1, kt));
        const tx = (1 - et) * (1 - et) * f.x0 + 2 * (1 - et) * et * f.mx + et * et * f.x1;
        const ty = (1 - et) * (1 - et) * f.y0 + 2 * (1 - et) * et * f.my + et * et * f.y1;
        ctx.globalAlpha = 0.35 / tr;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(tx, ty, s * (1 - tr * 0.2), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(glow, x - s * 2.6, y - s * 2.6, s * 5.2, s * 5.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0d1640';
      ctx.beginPath(); ctx.arc(x, y, s + 2, 0, TAU); ctx.fill();
      const og = ctx.createRadialGradient(x - s * 0.3, y - s * 0.35, s * 0.1, x, y, s);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.45, f.color);
      og.addColorStop(1, f.edge || f.color);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
    for (const t of texts) drawText(t);
  }

  return {
    resize, step, draw, clear, cubes, shards, puff, sparks, dust, confetti, ring, flight, word, popText,
    flash: doFlash,
    gold: GOLD,
    set motion(v) { motion = v ? 1 : 0; },
    get busy() { return parts.length + flights.length + texts.length; },
    setClip(r) { clip = r; },
  };
}
