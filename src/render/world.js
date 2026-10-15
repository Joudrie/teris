// The world around the board. The tower's 100 levels run from high above the clouds down
// to the ground, so the backdrop changes with altitude:
//   100–70 ft  above a sea of clouds, sun up high
//    70–40 ft  inside the cloud layer
//    40–15 ft  below the clouds: a blocky city and hills in the distance
//    15–1 ft   treetops, then grass and the ground
// Everything is drawn once per altitude and size, and cached by the caller.

import { hex, css, mix, rng } from './color.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const band = (alt, hi, lo, fade = 8) => clamp((hi - alt) / fade) * clamp((alt - lo) / fade + 1);

// Puffy cumulus: overlapping round puffs on a flat base, a cool shadow underneath and a
// bright rim on top. Round, to match the glossy UI rather than the pixel blocks.
function cloud(ctx, x, y, s, r, top = '#ffffff', shade = '#cfe7ff', alpha = 1) {
  const n = 4 + Math.floor(r() * 3);
  const puffs = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : k / (n - 1);
    const rad = s * (0.28 + Math.sin(t * Math.PI) * 0.22 + r() * 0.08);
    puffs.push([x + (t - 0.5) * s * 1.5, y - rad * 0.55, rad]);
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = shade;
  ctx.beginPath();
  for (const [px, py, rad] of puffs) { ctx.moveTo(px + rad, py + s * 0.12); ctx.arc(px, py + s * 0.12, rad, 0, Math.PI * 2); }
  ctx.rect(x - s * 0.75, y - s * 0.1, s * 1.5, s * 0.22);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  for (const [px, py, rad] of puffs) { ctx.moveTo(px + rad, py); ctx.arc(px, py, rad, 0, Math.PI * 2); }
  ctx.rect(x - s * 0.75, y - s * 0.16, s * 1.5, s * 0.16);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function toybox(ctx, W, H, alt) {
  const r = rng(11);
  const t = (100 - alt) / 99; // 0 at the top of the tower, 1 at the ground
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, css(mix(hex('#2f8ef0'), hex('#58b9ff'), t)));
  sky.addColorStop(0.6, css(mix(hex('#6fc6ff'), hex('#a6e2ff'), t)));
  sky.addColorStop(1, css(mix(hex('#bfe9ff'), hex('#dff6ff'), t)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun with soft rays, high up the tower.
  const sunA = clamp((alt - 30) / 40);
  if (sunA > 0) {
    const sx = W * 0.82;
    const sy = H * 0.1;
    const s = Math.min(W, H) * 0.085;
    ctx.save();
    ctx.globalAlpha = sunA * 0.18;
    ctx.translate(sx, sy);
    ctx.fillStyle = '#fff6c8';
    for (let k = 0; k < 12; k++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(-s * 0.25, s * 1.3);
      ctx.lineTo(s * 0.25, s * 1.3);
      ctx.lineTo(s * 0.9, Math.max(W, H));
      ctx.lineTo(-s * 0.9, Math.max(W, H));
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = sunA;
    const g = ctx.createRadialGradient(sx, sy, s * 0.6, sx, sy, s * 3);
    g.addColorStop(0, 'rgba(255,248,200,0.85)');
    g.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - s * 3, sy - s * 3, s * 6, s * 6);
    const core = ctx.createRadialGradient(sx - s * 0.3, sy - s * 0.3, s * 0.1, sx, sy, s);
    core.addColorStop(0, '#fffbe0');
    core.addColorStop(0.6, '#ffe36a');
    core.addColorStop(1, '#ffc93a');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sx, sy, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Sea of clouds below you, rising past as you descend.
  const sea = band(alt, 101, 55, 10);
  if (sea > 0) {
    const y0 = H * (0.72 + (100 - alt) / 45 * -0.75);
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 9; k++) cloud(ctx, (k / 8) * W * 1.2 - W * 0.1 + r() * 30, y0 + row * H * 0.07 + r() * 20, W * (0.16 + row * 0.03), r, '#ffffff', row ? '#d8eeff' : '#c7e4ff', sea * (0.75 + row * 0.08));
    }
    ctx.globalAlpha = sea;
    const deck = ctx.createLinearGradient(0, y0 + H * 0.18, 0, H);
    deck.addColorStop(0, '#ffffff');
    deck.addColorStop(0.35, '#e6f4ff');
    deck.addColorStop(1, '#a9d8ff');
    ctx.fillStyle = deck;
    ctx.fillRect(0, y0 + H * 0.18, W, H);
    for (let k = 0; k < 7; k++) cloud(ctx, r() * W, y0 + H * (0.3 + r() * 0.5), W * (0.12 + r() * 0.08), r, '#f4faff', '#c9e4ff', sea * 0.8);
    ctx.globalAlpha = 1;
  }

  // Inside the cloud layer: drifting puffs at every depth.
  const mid = band(alt, 72, 36, 8);
  if (mid > 0) {
    for (let k = 0; k < 16; k++) cloud(ctx, r() * W, r() * H, W * (0.1 + r() * 0.16), r, '#ffffff', '#d7ecff', mid * (0.5 + r() * 0.4));
  }
  // A few distant puffs everywhere, so the sky never reads empty.
  for (let k = 0; k < 5; k++) cloud(ctx, r() * W, H * (0.08 + r() * 0.35), W * (0.06 + r() * 0.06), r, '#ffffff', '#dff0ff', 0.75);

  // City and hills below the clouds.
  const city = band(alt, 44, -10, 10);
  if (city > 0) {
    const base = H * (1.02 - city * 0.3);
    ctx.globalAlpha = city;
    ctx.fillStyle = '#9fd0a8';
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= W; x += W / 8) ctx.lineTo(x, base - H * (0.04 + r() * 0.06));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    for (let k = 0; k < 14; k++) {
      const bw = W * (0.05 + r() * 0.05);
      const bh = H * (0.06 + r() * 0.16) * city;
      const bx = r() * W;
      ctx.fillStyle = css(mix(hex('#8fb2d8'), hex('#6f8fc0'), r()));
      ctx.fillRect(bx, base - bh, bw, bh + H);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wy = base - bh + 6; wy < base - 4; wy += 9) for (let wx = bx + 4; wx < bx + bw - 4; wx += 7) if (r() < 0.5) ctx.fillRect(wx, wy, 3, 4);
    }
    ctx.globalAlpha = 1;
  }

  // Treetops and grass near the ground.
  const ground = band(alt, 16, -10, 6);
  if (ground > 0) {
    const gy = H * (1 - 0.16 * ground);
    for (let k = 0; k < 16; k++) {
      const s = W * (0.06 + r() * 0.05);
      const x = r() * W;
      const y = gy - r() * H * 0.05;
      ctx.fillStyle = '#3f9a3a';
      rr(ctx, x - s, y - s, s * 2, s * 1.6, s * 0.3);
      ctx.fillStyle = '#5cc04a';
      rr(ctx, x - s * 0.85, y - s, s * 1.7, s * 0.7, s * 0.25);
    }
    ctx.fillStyle = '#5cbf43';
    ctx.fillRect(0, gy, W, H);
    ctx.fillStyle = '#4aa936';
    for (let x = 0; x < W; x += 8) ctx.fillRect(x, gy + ((x * 7) % 5), 4, 3);
    if (alt <= 2) {
      ctx.fillStyle = '#8a5a32';
      ctx.fillRect(0, H * 0.95, W, H);
    }
  }
}

function arcana(ctx, W, H) {
  const r = rng(5);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a0f33');
  sky.addColorStop(0.55, '#4a2560');
  sky.addColorStop(0.85, '#c8587a');
  sky.addColorStop(1, '#ffad6b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 70; k++) {
    ctx.fillStyle = `rgba(255,240,220,${0.2 + r() * 0.6})`;
    const s = r() < 0.9 ? 1.5 : 2.5;
    ctx.fillRect(r() * W, r() * H * 0.55, s, s);
  }
  ctx.fillStyle = '#fff1d6';
  ctx.beginPath();
  ctx.arc(W * 0.2, H * 0.14, Math.min(W, H) * 0.05, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#4a2560';
  ctx.beginPath();
  ctx.arc(W * 0.215, H * 0.135, Math.min(W, H) * 0.045, 0, 7);
  ctx.fill();
  // Spires.
  for (let k = 0; k < 9; k++) {
    const x = r() * W;
    const w = W * (0.04 + r() * 0.05);
    const h = H * (0.12 + r() * 0.2);
    ctx.fillStyle = k % 2 ? '#2a1638' : '#1c0f28';
    ctx.fillRect(x - w / 2, H - h, w, h);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.7, H - h);
    ctx.lineTo(x, H - h - w * 1.8);
    ctx.lineTo(x + w * 0.7, H - h);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,110,0.8)';
    ctx.fillRect(x - 2, H - h + w * 0.6, 4, 6);
  }
}

function clay(ctx, W, H) {
  const r = rng(3);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ffd9c2');
  sky.addColorStop(0.5, '#ffe9d6');
  sky.addColorStop(1, '#d9f0e4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const hills = [['#bfe3cf', 0.62], ['#9fd4b8', 0.72], ['#7fc4a2', 0.84]];
  for (const [c, y] of hills) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 4) ctx.quadraticCurveTo(x + W / 8, H * (y - 0.06 - r() * 0.04), x + W / 4, H * y);
    ctx.lineTo(W, H);
    ctx.fill();
  }
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const x = r() * W;
    const y = H * (0.08 + r() * 0.3);
    const s = W * (0.08 + r() * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.45, 0, 0, 7);
    ctx.ellipse(x + s * 0.6, y + s * 0.1, s * 0.6, s * 0.35, 0, 0, 7);
    ctx.fill();
  }
}

// ---------- Quarry: the descent ----------
// One altitude, one screen. Bands (feet above the ground, level 1 = 100 ft):
//   100–84  night sky and stars at the very top of the tower
//    90–60  the sun, and a sea of clouds below you
//    68–44  inside the cloud layer
//    48–30  skyscraper rooftops poking up from below
//    34–14  the skyscrapers themselves
//    20–5   treetops up close
//     8–1   the ground
// Stars twinkle, clouds drift, the sun breathes and birds pass on the live layer in sky.js;
// everything here is the still backdrop.

// Sky colors from the top of the tower (night) down to the ground (pale day).
const SKY = [
  [100, '#0e1236', '#2a3a8c'],
  [88, '#1d3c9a', '#4f8de0'],
  [76, '#2f7ee6', '#8ccfff'],
  [50, '#4aa6f5', '#bfe9ff'],
  [20, '#67b8f5', '#d6f1ff'],
  [1, '#7cc4f2', '#e6f7ff'],
];
export function skyAt(alt) {
  for (let k = 0; k < SKY.length - 1; k++) {
    const [a0, t0, b0] = SKY[k];
    const [a1, t1, b1] = SKY[k + 1];
    if (alt <= a0 && alt >= a1) {
      const t = (a0 - alt) / (a0 - a1);
      return [css(mix(hex(t0), hex(t1), t)), css(mix(hex(b0), hex(b1), t))];
    }
  }
  return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
}
export const starsAt = (alt) => clamp((alt - 80) / 14);
export const sunAt = (alt) => band(alt, 92, 55, 8);
export const cloudsAt = (alt) => Math.max(band(alt, 92, 58, 8), band(alt, 70, 42, 8));

function building(ctx, x, base, w, h, r, tone) {
  ctx.fillStyle = tone;
  ctx.fillRect(x, base - h, w, h + 4);
  // A darker right face for depth, a rooftop ledge and an antenna or water tank.
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(x + w * 0.72, base - h, w * 0.28, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(x - 2, base - h - 4, w + 4, 4);
  if (r() < 0.5) { ctx.fillStyle = tone; ctx.fillRect(x + w * 0.45, base - h - 16 - r() * 18, 3, 30); }
  else { ctx.fillStyle = 'rgba(60,40,30,.55)'; ctx.fillRect(x + w * 0.2, base - h - 12, w * 0.24, 10); }
  ctx.fillStyle = 'rgba(255,248,210,.55)';
  const cw = Math.max(3, Math.round(w / 9));
  for (let wy = base - h + 8; wy < base; wy += cw * 2.2) {
    for (let wx = x + cw; wx < x + w - cw; wx += cw * 2) if (r() < 0.55) ctx.fillRect(wx, wy, cw, cw * 1.2);
  }
}

function tree(ctx, x, base, s, r) {
  ctx.fillStyle = '#6b4424';
  ctx.fillRect(x - s * 0.08, base - s * 0.9, s * 0.16, s * 0.9);
  const leaf = ['#2f7d2c', '#3f9a3a', '#55b548'];
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = leaf[k];
    const rr2 = s * (0.62 - k * 0.12);
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * s * 0.3, base - s * (1.05 + k * 0.22), rr2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function quarry(ctx, W, H, alt) {
  const r = rng(Math.round(alt) * 7 + 3);
  const [top, bottom] = skyAt(alt);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const stars = starsAt(alt);
  if (stars > 0) {
    // Faint fixed stars; the brighter twinkling ones are drawn live.
    for (let k = 0; k < 90; k++) {
      ctx.globalAlpha = stars * (0.25 + r() * 0.45) * (1 - (k / 90) * 0.4);
      ctx.fillStyle = '#ffffff';
      const sz = r() < 0.15 ? 2 : 1;
      ctx.fillRect(Math.round(r() * W), Math.round(r() * H * 0.7), sz * (W / 400 + 0.5), sz * (W / 400 + 0.5));
    }
    ctx.globalAlpha = 1;
  }

  const sun = sunAt(alt);
  if (sun > 0) {
    const sx = W * 0.8, sy = H * (0.12 + (90 - alt) * 0.004), s = Math.min(W, H) * 0.08;
    ctx.globalAlpha = sun;
    const g = ctx.createRadialGradient(sx, sy, s * 0.6, sx, sy, s * 3.2);
    g.addColorStop(0, 'rgba(255,240,190,0.75)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - s * 3.2, sy - s * 3.2, s * 6.4, s * 6.4);
    const core = ctx.createRadialGradient(sx - s * 0.3, sy - s * 0.3, s * 0.1, sx, sy, s);
    core.addColorStop(0, '#fffbe0');
    core.addColorStop(0.6, '#ffe36a');
    core.addColorStop(1, '#ffc93a');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(sx, sy, s, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Sea of clouds below: it rises toward you as you descend into it.
  const sea = band(alt, 92, 58, 8);
  if (sea > 0) {
    const y0 = H * (0.8 - (92 - alt) / 34 * 0.55);
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 9; k++) cloud(ctx, (k / 8) * W * 1.2 - W * 0.1 + r() * 30, y0 + row * H * 0.07 + r() * 20, W * (0.16 + row * 0.03), r, '#ffffff', row ? '#d8eeff' : '#c7e4ff', sea * (0.8 + row * 0.07));
    }
    ctx.globalAlpha = sea;
    const deck = ctx.createLinearGradient(0, y0 + H * 0.18, 0, H);
    deck.addColorStop(0, '#ffffff');
    deck.addColorStop(1, '#b4dcff');
    ctx.fillStyle = deck;
    ctx.fillRect(0, y0 + H * 0.18, W, H);
    ctx.globalAlpha = 1;
  }
  const mid = band(alt, 70, 42, 8);
  if (mid > 0) for (let k = 0; k < 16; k++) cloud(ctx, r() * W, r() * H, W * (0.1 + r() * 0.16), r, '#ffffff', '#d7ecff', mid * (0.5 + r() * 0.4));
  if (alt < 60) for (let k = 0; k < 4; k++) cloud(ctx, r() * W, H * (0.06 + r() * 0.3), W * (0.06 + r() * 0.06), r, '#ffffff', '#dff0ff', 0.7);

  // Skyscrapers: first only rooftops poking up from the bottom, then the whole skyline.
  const rise = clamp((48 - alt) / 30); // 0 at 48 ft, 1 at 18 ft
  if (rise > 0 && alt > 6) {
    const far = H * (1.05 - rise * 0.42);
    for (let k = 0; k < 9; k++) building(ctx, (k / 9) * W + r() * 14 - 10, far + H * 0.25, W * (0.09 + r() * 0.05), H * (0.18 + r() * 0.22), r, css(mix(hex('#a9c6e6'), hex('#8fb0d6'), r())));
    const near = H * (1.1 - rise * 0.48);
    for (let k = 0; k < 7; k++) building(ctx, (k / 7) * W + r() * 16 - 12, near + H * 0.3, W * (0.12 + r() * 0.06), H * (0.22 + r() * 0.26), r, css(mix(hex('#6f8fc0'), hex('#5a77a8'), r())));
  }

  // Treetops up close, then the ground.
  const trees = band(alt, 20, -10, 6);
  if (trees > 0) {
    const base = H * (1.06 - trees * 0.2);
    ctx.globalAlpha = Math.min(1, trees * 1.2);
    for (let k = 0; k < 9; k++) tree(ctx, (k / 8) * W + r() * 24 - 12, base + r() * 20, W * (0.13 + r() * 0.07), r);
    ctx.globalAlpha = 1;
  }
  const ground = band(alt, 8, -10, 6);
  if (ground > 0) {
    const gy = H * (1 - 0.13 * ground);
    ctx.fillStyle = '#5cbf43';
    ctx.fillRect(0, gy, W, H);
    ctx.fillStyle = '#4aa936';
    for (let x = 0; x < W; x += 8) ctx.fillRect(x, gy + ((x * 7) % 5), 4, 3);
    ctx.fillStyle = '#c9a36a';
    ctx.fillRect(W * 0.35, gy + 10, W * 0.3, H);
    for (let k = 0; k < 18; k++) { ctx.fillStyle = ['#ff6fa8', '#ffd84a', '#ffffff'][k % 3]; ctx.fillRect(r() * W, gy + 6 + r() * (H - gy - 8), 4, 4); }
  }
}

// The whole tower's height on one tall canvas for the map: yOf(alt) gives the map y of an
// altitude. Painted at a fraction of the map's size and scaled up by CSS.
export function paintTower(ctx, W, H, yOf) {
  const r = rng(99);
  // Sky: one gradient stop per band, placed at that altitude's height on the map.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stop = (alt, col) => g.addColorStop(clamp(yOf(alt) / H), col);
  stop(104, '#0b0f30');
  for (const [a, t, b] of SKY) stop(a, css(mix(hex(t), hex(b), 0.45)));
  stop(0, '#7cc4f2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Stars at the top.
  for (let k = 0; k < 160; k++) {
    const y = r() * yOf(82);
    ctx.globalAlpha = 0.3 + r() * 0.6 * (1 - y / yOf(82));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r() * W, y, r() < 0.2 ? 2 : 1, r() < 0.2 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  // The sun around 82 ft.
  const sy = yOf(82), sx = W * 0.82, s = W * 0.07;
  const sg = ctx.createRadialGradient(sx, sy, s * 0.5, sx, sy, s * 3);
  sg.addColorStop(0, 'rgba(255,240,190,.7)'); sg.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - s * 3, sy - s * 3, s * 6, s * 6);
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(sx, sy, s, 0, Math.PI * 2); ctx.fill();
  // Cloud layers between 80 and 44 ft.
  for (let k = 0; k < 60; k++) {
    const alt = 44 + r() * 38;
    cloud(ctx, r() * W, yOf(alt), W * (0.08 + r() * 0.1), r, '#ffffff', '#d7ecff', 0.55 + r() * 0.35);
  }
  // Skyline from 46 ft down: far, then near buildings standing on the ground.
  const gy = yOf(2);
  for (let k = 0; k < 22; k++) building(ctx, r() * W, gy, W * (0.06 + r() * 0.05), gy - yOf(44 + r() * 6) - r() * (gy - yOf(30)), r, css(mix(hex('#a9c6e6'), hex('#8fb0d6'), r())));
  for (let k = 0; k < 14; k++) building(ctx, r() * W, gy, W * (0.08 + r() * 0.05), gy - yOf(26 + r() * 10), r, css(mix(hex('#6f8fc0'), hex('#5a77a8'), r())));
  // Trees and ground at the bottom.
  for (let k = 0; k < 18; k++) tree(ctx, r() * W, gy + 4, W * (0.06 + r() * 0.04), r);
  ctx.fillStyle = '#5cbf43';
  ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = '#8a5a32';
  ctx.fillRect(0, gy + 24, W, H - gy - 24);
}

const THEMES = { toybox, arcana, clay, quarry };

export function paintWorld(ctx, W, H, alt, theme = 'toybox') {
  (THEMES[theme] || toybox)(ctx, W, H, clamp(alt, 1, 100));
}
