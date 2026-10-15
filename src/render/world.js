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

// Blocky cumulus: a stack of rounded rectangles with a flat light top and a cool shadow base.
function cloud(ctx, x, y, s, r, top = '#ffffff', shade = '#cfe7ff', alpha = 1) {
  const parts = [];
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) parts.push([x + (k - n / 2) * s * 0.55 + r() * s * 0.2, y - r() * s * 0.45, s * (0.7 + r() * 0.5), s * (0.42 + r() * 0.3)]);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = shade;
  for (const [px, py, w, h] of parts) rr(ctx, px - w / 2, py - h / 2 + s * 0.1, w, h, s * 0.12);
  ctx.fillStyle = top;
  for (const [px, py, w, h] of parts) rr(ctx, px - w / 2, py - h / 2, w, h * 0.82, s * 0.12);
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

  // Sun with soft blocky rays, high up the tower.
  const sunA = clamp((alt - 30) / 40);
  if (sunA > 0) {
    const sx = W * 0.82;
    const sy = H * 0.1;
    const s = Math.min(W, H) * 0.09;
    ctx.save();
    ctx.globalAlpha = sunA * 0.22;
    ctx.translate(sx, sy);
    ctx.fillStyle = '#fff6c8';
    for (let k = 0; k < 12; k++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillRect(-s * 0.18, s * 1.4, s * 0.36, Math.max(W, H));
    }
    ctx.restore();
    ctx.globalAlpha = sunA;
    const g = ctx.createRadialGradient(sx, sy, s * 0.4, sx, sy, s * 2.6);
    g.addColorStop(0, 'rgba(255,248,200,0.9)');
    g.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - s * 3, sy - s * 3, s * 6, s * 6);
    ctx.fillStyle = '#ffe680';
    rr(ctx, sx - s, sy - s, s * 2, s * 2, s * 0.35);
    ctx.fillStyle = '#fff4b8';
    rr(ctx, sx - s * 0.8, sy - s * 0.8, s * 1.6, s * 0.9, s * 0.3);
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, y0 + H * 0.2, W, H);
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

const THEMES = { toybox, arcana, clay };

export function paintWorld(ctx, W, H, alt, theme = 'toybox') {
  (THEMES[theme] || toybox)(ctx, W, H, clamp(alt, 1, 100));
}
