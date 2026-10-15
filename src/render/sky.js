// The live sky behind the board: a few clouds drifting, stars twinkling at the top of the
// tower, the sun slowly breathing, and now and then a bird flapping across. The still
// backdrop is painted once by world.js (the page background); this layer only adds motion,
// at ~24 fps on a 1x canvas, and does nothing when the tab is hidden or quality is low.

import { rng } from './color.js';
import { starsAt, sunAt, cloudsAt } from './world.js';

export function createSky(cv) {
  const ctx = cv.getContext('2d');
  let W = 0;
  let H = 0;
  let alt = 100;
  let stars = [];
  let clouds = [];
  let bird = null;
  let nextBird = 6 + Math.random() * 10;
  let last = 0;
  let acc = 0;
  let on = true;
  const puffs = [];

  // A few cloud sprites, baked once.
  function bakeCloud(w, seed) {
    const r = rng(seed);
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * 0.5);
    const g = c.getContext('2d');
    const n = 4 + Math.floor(r() * 3);
    for (const [col, dy] of [['#d7ecff', w * 0.06], ['#ffffff', 0]]) {
      g.fillStyle = col;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const rad = w * (0.13 + Math.sin(t * Math.PI) * 0.1 + r() * 0.03);
        const x = w * (0.15 + t * 0.7);
        const y = c.height * 0.62 - rad * 0.5 + dy;
        g.moveTo(x + rad, y);
        g.arc(x, y, rad, 0, Math.PI * 2);
      }
      g.rect(w * 0.12, c.height * 0.55 + dy, w * 0.76, c.height * 0.2);
      g.fill();
    }
    return c;
  }

  function layout() {
    const r = rng(Math.round(alt) * 13 + 5);
    stars = [];
    const sa = starsAt(alt);
    for (let k = 0; k < Math.round(46 * sa); k++) stars.push({ x: r() * W, y: r() * H * 0.6, s: r() < 0.3 ? 2 : 1.5, p: r() * Math.PI * 2, f: 0.6 + r() * 1.6 });
    clouds = [];
    const ca = Math.max(cloudsAt(alt), alt < 60 && alt > 20 ? 0.6 : 0);
    if (!puffs.length) for (let k = 0; k < 4; k++) puffs.push(bakeCloud(200 + k * 40, 31 + k * 17));
    for (let k = 0; k < Math.round(5 * ca); k++) clouds.push({ x: r() * W, y: H * (0.08 + r() * 0.55), w: W * (0.18 + r() * 0.16), v: 4 + r() * 8, a: 0.55 + r() * 0.3, i: k % puffs.length });
  }

  function resize(w, h) {
    W = w; H = h;
    cv.width = w; cv.height = h;
    cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    layout();
  }

  function setAlt(a) {
    if (a === alt) return;
    alt = a;
    layout();
  }

  function setOn(v) {
    on = v;
    if (!v) ctx.clearRect(0, 0, W, H);
  }

  function birdPath() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { x: dir > 0 ? -30 : W + 30, y: H * (0.12 + Math.random() * 0.3), v: dir * (40 + Math.random() * 30), t: 0, s: 1 + Math.random() * 0.6 };
  }

  function drawBird(b) {
    // Two-frame pixel bird: wings up, wings down.
    const up = Math.floor(b.t * 6) % 2 === 0;
    const u = Math.round(2 * b.s);
    ctx.fillStyle = 'rgba(30,34,50,.75)';
    ctx.fillRect(b.x - u, b.y, u * 2, u);
    if (up) { ctx.fillRect(b.x - u * 3, b.y - u, u * 2, u); ctx.fillRect(b.x + u, b.y - u, u * 2, u); }
    else { ctx.fillRect(b.x - u * 3, b.y + u, u * 2, u); ctx.fillRect(b.x + u, b.y + u, u * 2, u); }
  }

  function frame(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0);
    last = ts;
    if (!on || document.hidden || !W) return;
    acc += dt;
    if (acc < 1 / 24) return;
    const step = acc;
    acc = 0;
    ctx.clearRect(0, 0, W, H);
    const t = ts / 1000;
    // The sun breathes: a slow, faint glow over the painted sun.
    const sun = sunAt(alt);
    if (sun > 0) {
      const sx = W * 0.8, sy = H * (0.12 + (90 - alt) * 0.004), s = Math.min(W, H) * 0.08;
      const k = 0.5 + 0.5 * Math.sin(t * 0.5);
      const g = ctx.createRadialGradient(sx, sy, s, sx, sy, s * (2.2 + k * 0.8));
      g.addColorStop(0, `rgba(255,236,170,${0.22 * sun * (0.6 + 0.4 * k)})`);
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - s * 3, sy - s * 3, s * 6, s * 6);
    }
    for (const st of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.f + st.p)) ** 3;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(st.x, st.y, st.s, st.s);
      if (a > 0.85) { ctx.globalAlpha = (a - 0.85) * 3; ctx.fillRect(st.x - st.s, st.y + st.s / 2 - 0.5, st.s * 3, 1); ctx.fillRect(st.x + st.s / 2 - 0.5, st.y - st.s, 1, st.s * 3); }
    }
    ctx.globalAlpha = 1;
    for (const c of clouds) {
      c.x += c.v * step;
      if (c.x > W + c.w) c.x = -c.w;
      const img = puffs[c.i];
      ctx.globalAlpha = c.a;
      ctx.drawImage(img, c.x - c.w / 2, c.y, c.w, c.w * 0.5);
    }
    ctx.globalAlpha = 1;
    // Now and then a bird passes, below the stars.
    if (alt < 90) {
      if (!bird) { nextBird -= step; if (nextBird <= 0) bird = birdPath(); }
      if (bird) {
        bird.t += step;
        bird.x += bird.v * step;
        bird.y += Math.sin(bird.t * 2) * 0.3;
        drawBird(bird);
        if (bird.x < -40 || bird.x > W + 40) { bird = null; nextBird = 18 + Math.random() * 25; }
      }
    }
  }

  return { resize, setAlt, setOn, frame };
}
