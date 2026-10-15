// Scenery behind the board. Layers come in by altitude (ft); nothing underground before ground level.

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

// Small seeded PRNG so each layer's shapes stay put between frames.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawScenery(ctx, alt, w, h) {
  const t = (100 - alt) / 99;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mix('#0a0f2c', '#4f97e2', Math.min(1, t * 2.5)));
  sky.addColorStop(1, mix('#2c4380', '#c4e5fb', Math.min(1, t * 2.5)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars: visible from 100 ft down to 81 ft, fading out.
  const starA = Math.max(0, (alt - 80) / 20);
  if (starA > 0) {
    const r = rng(7);
    ctx.fillStyle = `rgba(255,255,255,${starA * 0.7})`;
    for (let i = 0; i < 60; i++) ctx.fillRect(r() * w, r() * h * 0.7, 1.5, 1.5);
  }

  // Cloud layer rises past you from 100 ft to 55 ft.
  if (alt >= 55) {
    const r = rng(11);
    const cy = h * (1.05 - ((100 - alt) / 45) * 1.3);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; // faint: it sits behind the materials and must never look like one
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.ellipse(r() * w, cy + (r() - 0.5) * 70, 40 + r() * 40, 14 + r() * 12, 0, 0, 7);
      ctx.fill();
    }
  }

  // City skyline rises into view at 80 ft and below.
  if (alt <= 80) {
    const r = rng(23);
    const rise = (80 - alt) / 80;
    for (let i = 0; i < 10; i++) {
      const bw = 26 + r() * 24;
      const x = i * 32 - 8;
      const bh = h * (0.15 + r() * 0.5) * rise * 1.4;
      ctx.fillStyle = mix('#9db3cf', '#3d4a63', rise);
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,236,170,.55)';
      for (let wy = h - bh + 8; wy < h; wy += 14) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
          if (r() < 0.35) ctx.fillRect(wx, wy, 3, 5);
        }
      }
    }
  }

  // Treetops rise into view at 30 ft and below.
  if (alt <= 30) {
    const r = rng(41);
    const rise = (30 - alt) / 30;
    for (let i = 0; i < 12; i++) {
      const x = r() * w;
      const s = 24 + r() * 30;
      const y = h - rise * h * 0.38 * (0.5 + r() * 0.5);
      ctx.fillStyle = `hsl(${105 + r() * 30},40%,${24 + r() * 12}%)`;
      ctx.beginPath();
      ctx.arc(x, y, s * (0.6 + rise * 0.6), 0, 7);
      ctx.fill();
    }
  }

  // Grass at 10 ft and below; soil only at ground level (1 ft).
  if (alt <= 10) {
    const gh = ((10 - alt) / 9) * h * 0.12;
    ctx.fillStyle = '#4f8a3c';
    ctx.fillRect(0, h - gh, w, gh);
  }
  if (alt <= 1) {
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(0, h - h * 0.06, w, h * 0.06);
  }
}
