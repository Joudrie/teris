// Bakes one cell tile per material (and per variant) for a skin, at T device pixels.
// The board renderer stamps a whole tile for every intact cell and cuts particle-sized
// pieces out of it where a block has crumbled, burned or melted part-way.

import { canvas, css, mix, lighten, darken, rng } from './color.js';
import { MATERIALS } from './skins.js';

export const VARIANTS = 3;
export const FIRE_FRAMES = 4;

// ---------- pixel-art faces (8x8 texels) ----------

function grid(n, c) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => [...c, 255]));
}

const jitter = (c, r, amt) => mix(c, r() < 0.5 ? [0, 0, 0] : [255, 255, 255], r() * amt);

// Hand-drawn layouts for cobbles and bricks: letters are separate stones, dots are mortar.
const STONE_A = ['aaa.bbbb', 'aaa.bbbb', 'aaa.bbbb', '....bbbb', 'cccc....', 'cccc.ddd', 'cccc.ddd', 'cccc.ddd'];
const STONE_B = ['aaaa.bbb', 'aaaa.bbb', 'aaaa.bbb', 'aaaa....', '....cccc', 'dd.ccccc', 'dd.ccccc', 'dd.ccccc'];
const BRICK_A = ['aaaaa.bb', 'aaaaa.bb', 'aaaaa.bb', '........', 'cc.ddddd', 'cc.ddddd', 'cc.ddddd', '........'];
const BRICK_B = ['aa.bbbbb', 'aa.bbbbb', 'aa.bbbbb', '........', 'ccccc.dd', 'ccccc.dd', 'ccccc.dd', '........'];

function fromPattern(p, r, n, rows, mortar, spread) {
  const g = grid(n, mortar);
  const tones = {};
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k = rows[y][x];
      if (k === '.') { g[y][x] = [...jitter(mortar, r, 0.05), 255]; continue; }
      if (!tones[k]) tones[k] = mix(p.base, r() < 0.5 ? p.light : p.dark, r() * spread);
      const top = y === 0 || rows[y - 1][x] !== k;
      const left = x === 0 || rows[y][x - 1] !== k;
      const bottom = y === n - 1 || rows[y + 1][x] !== k;
      const right = x === n - 1 || rows[y][x + 1] !== k;
      let c = jitter(tones[k], r, 0.06);
      if (top || left) c = mix(c, p.light, 0.4);
      if (bottom || right) c = mix(c, p.dark, 0.45);
      g[y][x] = [...c, 255];
    }
  }
  return g;
}

const FACES = {
  wood(p, r, n) {
    const g = grid(n, p.base);
    const half = n / 2;
    const seams = [1 + Math.floor(r() * (n - 3)), 1 + Math.floor(r() * (n - 3))];
    for (let y = 0; y < n; y++) {
      const plank = y < half ? 0 : 1;
      const tone = plank ? 0.06 : -0.02;
      for (let x = 0; x < n; x++) {
        let c = mix(p.base, tone > 0 ? p.light : p.dark, Math.abs(tone) * 2);
        // grain: short horizontal streaks
        if (r() < 0.22) c = mix(c, p.dark, 0.35);
        if (y % half === half - 1) c = mix(p.dark, p.edge, 0.25); // plank seam
        if (x === seams[plank] && y % half !== half - 1) c = mix(c, p.dark, 0.6); // plank end
        g[y][x] = [...c, 255];
      }
    }
    // nail heads
    g[1][seams[0] === 1 ? n - 2 : 1] = [...p.light, 255];
    g[half + 1][seams[1] === n - 2 ? 1 : n - 2] = [...p.light, 255];
    return g;
  },
  wetwood(p, r, n) {
    const g = FACES.wood(p, r, n);
    for (let k = 0; k < 3; k++) {
      const x = Math.floor(r() * n);
      const y = Math.floor(r() * (n - 1));
      g[y][x] = [...p.drop, 255];
      g[y + 1][x] = [...mix(p.drop, p.base, 0.5), 255];
    }
    return g;
  },
  stone(p, r, n) {
    return fromPattern(p, r, n, r() < 0.5 ? STONE_A : STONE_B, mix(p.dark, p.edge, 0.4), 0.4);
  },
  brick(p, r, n) {
    return fromPattern(p, r, n, r() < 0.5 ? BRICK_A : BRICK_B, mix(p.mortar, p.dark, 0.18), 0.28);
  },
  ice(p, r, n) {
    const g = grid(n, p.base);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let c = p.base;
        if (x === 1 || y === 1 || x === n - 2 || y === n - 2) c = mix(p.base, p.light, 0.35); // inner rim
        if (r() < 0.08) c = p.light; // frost specks
        g[y][x] = [...c, 255];
      }
    }
    // A crack running across the face.
    let x = 2 + Math.floor(r() * 3);
    for (let y = 2; y < n - 1; y++) {
      g[y][x] = [...mix(p.dark, p.base, 0.2), 255];
      x = Math.max(1, Math.min(n - 2, x + (r() < 0.5 ? -1 : 1)));
    }
    // Frosted corner.
    g[1][1] = [...p.light, 255]; g[1][2] = [...p.light, 255]; g[2][1] = [...p.light, 255];
    return g;
  },
  glass(p, r, n) {
    const g = grid(n, p.base);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const edge = x === 0 || y === 0 || x === n - 1 || y === n - 1;
        g[y][x] = edge ? [...mix(p.edge, p.light, 0.6), 240] : [...mix(p.base, p.light, 0.3 - y / n * 0.25), 70 + Math.round((1 - y / n) * 40)];
      }
    }
    // Long diagonal glints.
    const o = Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const x = n - 2 - k + o;
      const y = 1 + k;
      if (x > 0 && x < n - 1 && y < n - 1 && k < 4) g[y][x] = [...p.light, 210];
      const x2 = x + 3;
      if (x2 > 0 && x2 < n - 1 && y < n - 1 && k > 1 && k < 4) g[y][x2] = [...p.light, 150];
    }
    return g;
  },
  fire(p, r, n, frame = 0) {
    const g = grid(n, p.base);
    const rr = rng(1234 + frame * 97);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = (Math.sin((x * 1.7 + y * 2.3) + frame * 1.6) + Math.sin(x * 0.9 - y * 1.3 - frame * 1.1)) * 0.25 + 0.5;
        let c = mix(p.dark, p.light, v * 0.9 + rr() * 0.15);
        if (v > 0.78) c = lighten(p.light, 0.35); // white-hot seams
        g[y][x] = [...c, 255];
      }
    }
    return g;
  },
  water(p, r, n) {
    const g = grid(n, p.base);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let c = mix(p.base, p.dark, y / n * 0.6);
        if (y === 1 && x > 0 && x < n - 1) c = mix(p.light, p.base, 0.3);
        if (r() < 0.06) c = mix(c, p.light, 0.5);
        g[y][x] = [...c, 230];
      }
    }
    return g;
  },
  sand(p, r, n) {
    const g = grid(n, p.base);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g[y][x] = [...jitter(p.base, r, 0.22), 255];
    return g;
  },
  mud(p, r, n) {
    const g = grid(n, p.base);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let c = mix(p.base, p.dark, y / n * 0.5);
        if (r() < 0.07) c = mix(c, p.light, 0.5);
        g[y][x] = [...c, 255];
      }
    }
    return g;
  },
};

// ---------- tile painters ----------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Pixel-art face + chunky bevel + glossy highlight: the Toybox look.
function paintPixel(ctx, T, skin, m, p, variant, frame) {
  const n = skin.texels;
  const r = rng(m.length * 1000 + variant * 31 + 7);
  const face = FACES[m](p, r, n, frame);
  const rad = T * skin.radius;
  const see = m === 'glass';
  // Outline body.
  if (!see) {
    roundRect(ctx, 0, 0, T, T, rad);
    ctx.fillStyle = css(p.edge);
    ctx.fill();
  }
  ctx.save();
  const o = see ? 0 : Math.max(1, Math.round(T * 0.045));
  roundRect(ctx, o, o, T - o * 2, T - o * 2, Math.max(0, rad - o));
  ctx.clip();
  const span = T - o * 2;
  for (let ty = 0; ty < n; ty++) {
    const y0 = o + Math.round((ty * span) / n);
    const y1 = o + Math.round(((ty + 1) * span) / n);
    for (let tx = 0; tx < n; tx++) {
      const x0 = o + Math.round((tx * span) / n);
      const x1 = o + Math.round(((tx + 1) * span) / n);
      const [cr, cg, cb, ca] = face[ty][tx];
      ctx.fillStyle = css([cr, cg, cb], ca / 255);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  if (!see) {
    // Bevel: one texel of light on top and left, shadow on bottom and right.
    const b = Math.max(2, Math.round((span / n) * skin.bevel));
    ctx.fillStyle = css(p.light, 0.5);
    ctx.fillRect(o, o, span, b);
    ctx.fillStyle = css(p.light, 0.22);
    ctx.fillRect(o, o + b, b, span - b);
    ctx.fillStyle = css(darken(p.dark, 0.2), 0.5);
    ctx.fillRect(o, T - o - b, span, b);
    ctx.fillStyle = css(darken(p.dark, 0.1), 0.3);
    ctx.fillRect(T - o - b, o, b, span - b);
    // Candy gloss in the top-left.
    const gl = ctx.createRadialGradient(T * 0.3, T * 0.22, 0, T * 0.3, T * 0.22, T * 0.62);
    gl.addColorStop(0, `rgba(255,255,255,${skin.gloss})`);
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, T, T);
  }
  ctx.restore();
  if (see) {
    // A sheen band across the pane, then a crisp bright frame so it reads on any wall.
    const sh = ctx.createLinearGradient(0, 0, T, T);
    sh.addColorStop(0, 'rgba(255,255,255,0.42)');
    sh.addColorStop(0.38, 'rgba(255,255,255,0.12)');
    sh.addColorStop(0.42, 'rgba(255,255,255,0.32)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    sh.addColorStop(1, 'rgba(180,240,255,0.18)');
    ctx.fillStyle = sh;
    roundRect(ctx, 0, 0, T, T, rad);
    ctx.fill();
    // Glass keeps a crisp bright frame so the pane reads even with the wall behind it.
    ctx.strokeStyle = css(p.light, 0.9);
    ctx.lineWidth = Math.max(1.5, T * 0.05);
    roundRect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, T - ctx.lineWidth, T - ctx.lineWidth, rad);
    ctx.stroke();
  }
}

// Soft matte toy block: gradient face, big radius, ambient occlusion. The Clay look.
function paintClay(ctx, T, skin, m, p, variant) {
  const rad = T * skin.radius;
  const see = m === 'glass';
  const pad = Math.max(1, T * 0.04);
  roundRect(ctx, pad, pad + T * 0.04, T - pad * 2, T - pad * 2, rad);
  ctx.fillStyle = css(p.edge, see ? 0.25 : 0.55);
  ctx.fill();
  roundRect(ctx, pad, pad, T - pad * 2, T - pad * 2 - T * 0.04, rad);
  const gr = ctx.createLinearGradient(0, 0, T * 0.6, T);
  gr.addColorStop(0, css(p.light, see ? 0.5 : 1));
  gr.addColorStop(0.45, css(p.base, see ? 0.3 : 1));
  gr.addColorStop(1, css(p.dark, see ? 0.35 : 1));
  ctx.fillStyle = gr;
  ctx.fill();
  // Soft motif so materials still differ in more than hue.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = css(p.dark, 0.35);
  ctx.lineWidth = Math.max(1, T * 0.05);
  ctx.lineCap = 'round';
  const r = rng(variant * 13 + m.length);
  if (m === 'wood' || m === 'wetwood') { for (const y of [0.36, 0.68]) { ctx.beginPath(); ctx.moveTo(T * 0.18, T * y); ctx.quadraticCurveTo(T * 0.5, T * (y - 0.06), T * 0.82, T * y); ctx.stroke(); } }
  if (m === 'brick') { ctx.strokeStyle = css(p.mortar, 0.8); ctx.beginPath(); ctx.moveTo(0, T * 0.5); ctx.lineTo(T, T * 0.5); ctx.moveTo(T * 0.5, 0); ctx.lineTo(T * 0.5, T * 0.5); ctx.moveTo(T * 0.25, T * 0.5); ctx.lineTo(T * 0.25, T); ctx.stroke(); }
  if (m === 'stone') { for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(T * (0.25 + r() * 0.5), T * (0.25 + r() * 0.5), T * (0.06 + r() * 0.05), 0, 7); ctx.stroke(); } }
  if (m === 'ice' || m === 'glass') { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(T * 0.62, T * 0.2); ctx.lineTo(T * 0.24, T * 0.6); ctx.stroke(); }
  if (m === 'wetwood') { ctx.fillStyle = css(p.drop, 0.9); ctx.beginPath(); ctx.arc(T * 0.7, T * 0.3, T * 0.06, 0, 7); ctx.fill(); }
  ctx.restore();
}

// Carved rune tile with a glowing sigil. The Arcana look.
function paintSigil(ctx, T, skin, m, p, variant, frame) {
  const rad = T * skin.radius;
  roundRect(ctx, 0, 0, T, T, rad);
  ctx.fillStyle = css(p.edge);
  ctx.fill();
  const o = Math.max(1, T * 0.06);
  roundRect(ctx, o, o, T - o * 2, T - o * 2, rad * 0.7);
  const gr = ctx.createLinearGradient(0, 0, 0, T);
  gr.addColorStop(0, css(mix(p.base, p.light, 0.15), m === 'glass' ? 0.35 : 1));
  gr.addColorStop(1, css(p.dark, m === 'glass' ? 0.35 : 1));
  ctx.fillStyle = gr;
  ctx.fill();
  // Sigil.
  ctx.save();
  ctx.translate(T / 2, T / 2);
  ctx.shadowColor = css(p.light, 0.9);
  ctx.shadowBlur = T * 0.18;
  ctx.strokeStyle = css(p.light, 0.95);
  ctx.fillStyle = css(p.light, 0.95);
  ctx.lineWidth = Math.max(1.2, T * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  sigilPath(ctx, m, T * 0.24);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = `rgba(255,255,255,${skin.gloss})`;
  roundRect(ctx, o * 1.5, o * 1.5, T - o * 3, T * 0.18, rad * 0.5);
  ctx.fill();
  if (m === 'fire') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css(p.glow, 0.12 + 0.06 * Math.sin(frame * 1.6));
    roundRect(ctx, 0, 0, T, T, rad);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// The material glyphs (also used as color-blind emblems in assist mode).
function sigilPath(ctx, m, s) {
  ctx.beginPath();
  if (m === 'fire') { ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.9, 0, 0, s); ctx.quadraticCurveTo(-s * 0.9, 0, 0, -s); }
  else if (m === 'water') { ctx.moveTo(0, -s); ctx.quadraticCurveTo(s, s * 0.3, 0, s); ctx.quadraticCurveTo(-s, s * 0.3, 0, -s); }
  else if (m === 'wood' || m === 'wetwood') { ctx.moveTo(0, s); ctx.lineTo(0, -s); ctx.moveTo(0, 0); ctx.lineTo(s * 0.7, -s * 0.6); ctx.moveTo(0, s * 0.3); ctx.lineTo(-s * 0.7, -s * 0.3); }
  else if (m === 'ice') { for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s); ctx.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); } }
  else if (m === 'sand' || m === 'mud') { ctx.moveTo(-s, s * 0.3); ctx.quadraticCurveTo(-s * 0.4, -s * 0.5, 0, s * 0.3); ctx.quadraticCurveTo(s * 0.4, -s * 0.5, s, s * 0.3); }
  else if (m === 'glass') { ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); }
  else if (m === 'stone') { ctx.moveTo(-s, s * 0.6); ctx.lineTo(-s * 0.3, -s * 0.7); ctx.lineTo(s * 0.5, -s * 0.4); ctx.lineTo(s, s * 0.6); ctx.closePath(); }
  else if (m === 'brick') { ctx.rect(-s, -s * 0.6, s * 2, s * 1.2); ctx.moveTo(0, -s * 0.6); ctx.lineTo(0, s * 0.6); }
}

// Assist mode: a white glyph with an ink outline per material, stamped on every block.
export function bakeEmblems(size) {
  const out = {};
  for (const m of MATERIALS) {
    const c = canvas(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    sigilPath(ctx, m, size * 0.3);
    ctx.strokeStyle = '#0d1640';
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, size * 0.09);
    ctx.stroke();
    out[m] = c;
  }
  return out;
}

const PAINT = { pixel: paintPixel, clay: paintClay, sigil: paintSigil };

// tiles[m][variant] (fire also has animation frames: tiles.fireFrames[frame][variant]).
export function bakeTiles(skin, T) {
  const paint = PAINT[skin.mode];
  const tiles = {};
  for (const m of MATERIALS) {
    tiles[m] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const c = canvas(T, T);
      paint(c.getContext('2d'), T, skin, m, skin.mats[m], v, 0);
      tiles[m].push(c);
    }
  }
  tiles.fireFrames = [];
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const row = [];
    for (let v = 0; v < VARIANTS; v++) {
      const c = canvas(T, T);
      paint(c.getContext('2d'), T, skin, 'fire', skin.mats.fire, v, f);
      row.push(c);
    }
    tiles.fireFrames.push(row);
  }
  return tiles;
}

// One flame tongue sprite per frame, drawn above the exposed top of fire blocks.
export function bakeFlames(skin, w, h) {
  const p = skin.mats.fire;
  const frames = [];
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const sway = Math.sin((f / FIRE_FRAMES) * Math.PI * 2) * w * 0.12;
    const tall = h * (0.82 + 0.18 * Math.sin((f / FIRE_FRAMES) * Math.PI * 2 + 1));
    const g = ctx.createLinearGradient(0, h, 0, h - tall);
    g.addColorStop(0, css(p.light, 0.95));
    g.addColorStop(0.35, css(p.glow, 0.85));
    g.addColorStop(1, css(p.base, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h);
    ctx.quadraticCurveTo(w * 0.05, h - tall * 0.5, w / 2 + sway, h - tall);
    ctx.quadraticCurveTo(w * 0.95, h - tall * 0.5, w * 0.92, h);
    ctx.closePath();
    ctx.fill();
    // white-hot core
    ctx.fillStyle = 'rgba(255,250,220,0.75)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + sway * 0.3, h - tall * 0.18, w * 0.16, tall * 0.2, 0, 0, 7);
    ctx.fill();
    frames.push(c);
  }
  return frames;
}

// The well behind the board: a vertical gradient, a faint cell grid and an inner shadow.
export function bakeWall(skin, W, H, cols, rows) {
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(skin.wall.top));
  g.addColorStop(1, css(skin.wall.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = skin.wall.grid;
  ctx.lineWidth = Math.max(1, W / 400);
  ctx.beginPath();
  for (let x = 1; x < cols; x++) { ctx.moveTo(Math.round((x * W) / cols) + 0.5, 0); ctx.lineTo(Math.round((x * W) / cols) + 0.5, H); }
  for (let y = 1; y < rows; y++) { ctx.moveTo(0, Math.round((y * H) / rows) + 0.5); ctx.lineTo(W, Math.round((y * H) / rows) + 0.5); }
  ctx.stroke();
  // Small rivet dots at grid crossings for a crafted feel.
  ctx.fillStyle = skin.wall.grid;
  for (let x = 1; x < cols; x++) for (let y = 1; y < rows; y++) ctx.fillRect(Math.round((x * W) / cols) - 1, Math.round((y * H) / rows) - 1, 3, 3);
  // Inner shadow: darker edges, light from above.
  const v = ctx.createRadialGradient(W / 2, H * 0.35, Math.min(W, H) * 0.2, W / 2, H * 0.45, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.06);
  top.addColorStop(0, 'rgba(0,0,0,0.4)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.06);
  return c;
}

// A cell tile for UI previews (next piece, codex), at any size.
export function previewTile(skin, m, size, variant = 0) {
  const c = canvas(size, size);
  PAINT[skin.mode](c.getContext('2d'), size, skin, m, skin.mats[m], variant, 0);
  return c;
}
