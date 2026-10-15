// The board renderer. Reads the simulation grid (48x80 particles, see core.js) and draws:
//   1. the well (baked once per size),
//   2. a soft drop shadow under everything,
//   3. loose materials (water, sand, mud) as smooth shaded bodies instead of pixel stairs,
//   4. rigid blocks as baked voxel tiles: a whole tile per intact cell, particle-sized cut-outs
//      where a block has partly burned, melted or crumbled,
//   5. heat glow, fire glow and flame tongues,
//   6. the ghost (with the cells it would react with) and the falling piece.
// It only reads the game; it never changes a rule. The one thing it writes is a cached
// texture offset (_v, _row) on each rigid particle the first time it sees it.

import { GW, GH, S, COLS, ROWS } from '../core.js';
import { canvas, css, mix } from './color.js';
import { RIGID, LOOSE } from './skins.js';
import { bakeTiles, bakeFlames, bakeWall, VARIANTS, FIRE_FRAMES } from './tiles.js';

const N = GW * GH;
const LOOSE_LIST = ['water', 'sand', 'mud'];
const pack = ([r, g, b], a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

export function createBoardRenderer(cv, skin) {
  const ctx = cv.getContext('2d');
  const st = {
    skin, P: 8, W: GW * 8, H: GH * 8, d: 2, tiles: null, flames: null, wall: null,
    stamp: new Int32Array(N), frame: 1,
  };

  // Particle-resolution fields, uploaded once per frame and scaled up with smoothing.
  const field = (w, h) => {
    const c = canvas(w, h);
    const x = c.getContext('2d');
    const img = x.createImageData(w, h);
    return { c, x, img, u32: new Uint32Array(img.data.buffer) };
  };
  const shadow = field(GW, GH);
  const heat = field(GW / 2, GH / 2);
  const glow = field(COLS, ROWS);
  const looseField = Object.fromEntries(LOOSE_LIST.map((m) => [m, field(GW, GH)]));
  const glowAcc = new Float32Array(COLS * ROWS);
  const heatAcc = new Float32Array((GW / 2) * (GH / 2));
  const layer = canvas(8, 8);
  const lctx = layer.getContext('2d');
  let grain = null;
  let ripple = null;

  function bakePatterns() {
    const P = st.P;
    const g = canvas(P * 8, P * 8);
    const gx = g.getContext('2d');
    let seed = 99;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < P * 6; k++) {
      gx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(90,50,10,0.35)';
      const s = Math.max(1, Math.round(P * (0.14 + r() * 0.12)));
      gx.fillRect(Math.floor(r() * P * 8), Math.floor(r() * P * 8), s, s);
    }
    grain = ctx.createPattern(g, 'repeat');
    const w = canvas(P * 12, P * 12);
    const wx = w.getContext('2d');
    wx.strokeStyle = 'rgba(255,255,255,0.16)';
    wx.lineWidth = Math.max(1, P * 0.22);
    for (let k = -12; k < 24; k += 3) {
      wx.beginPath();
      for (let x = 0; x <= P * 12; x += P) wx.lineTo(x, k * P + Math.sin(x / (P * 2)) * P * 0.6 + x * 0.35);
      wx.stroke();
    }
    ripple = ctx.createPattern(w, 'repeat');
  }

  function resize(cssW, cssH, dpr = 1) {
    const d = Math.min(2, Math.max(1, dpr));
    const P = Math.max(3, Math.floor(Math.min((cssW * d) / GW, (cssH * d) / GH)));
    if (P === st.P && st.tiles && d === st.d) return { w: st.W / d, h: st.H / d, P };
    st.P = P;
    st.d = d;
    st.W = GW * P;
    st.H = GH * P;
    cv.width = st.W;
    cv.height = st.H;
    layer.width = st.W;
    layer.height = st.H;
    st.tiles = bakeTiles(st.skin, P * S);
    st.flames = bakeFlames(st.skin, Math.round(P * 2.2), Math.round(P * 3.4));
    st.wall = bakeWall(st.skin, st.W, st.H, COLS, ROWS);
    bakePatterns();
    return { w: st.W / d, h: st.H / d, P };
  }

  function setSkin(skin2) {
    st.skin = skin2;
    st.tiles = null;
    const P = st.P;
    st.P = 0;
    resize((GW * P) / st.d, (GH * P) / st.d, st.d);
  }

  // Assigns each new rigid particle its row inside its cell (0..3) and its cell row inside
  // the block, measured from the block's top: right for a freshly locked or placed block.
  function assignV(list) {
    const ids = new Map();
    for (const [c] of list) ids.set(c.id, GH);
    const g = st.g;
    for (let y = 0; y < GH; y++) {
      const row = g.grid[y];
      for (let x = 0; x < GW; x++) {
        const c = row[x];
        if (c && ids.has(c.id) && y < ids.get(c.id)) ids.set(c.id, y);
      }
    }
    for (const [c, y] of list) {
      const top = ids.get(c.id);
      c._v = (y - top) & 3;
      c._row = (y - top) >> 2;
    }
  }

  const variantOf = (x, row) => (((x >> 2) * 3 + row * 5) % VARIANTS + VARIANTS) % VARIANTS;

  function draw(g, opts = {}) {
    st.g = g;
    const { P, W, H, skin: sk, tiles } = st;
    const ts = opts.ts || 0;
    const T = P * S;
    st.frame++;
    const frame = st.frame;
    const stamp = st.stamp;
    const grid = g.grid;

    // ---------- pass 1: fields and bookkeeping ----------
    shadow.u32.fill(0);
    glowAcc.fill(0);
    heatAcc.fill(0);
    const bbox = {};
    for (const m of LOOSE_LIST) {
      looseField[m].u32.fill(pack(sk.mats[m].base));
      bbox[m] = null;
    }
    const depth = new Int16Array(GW);
    const needV = [];
    const shadowA = Math.round(255 * sk.shadow);
    let anyHeat = false;
    let anyFire = false;
    for (let y = 0; y < GH; y++) {
      const row = grid[y];
      for (let x = 0; x < GW; x++) {
        const c = row[x];
        if (!c) { depth[x] = 0; continue; }
        const i = y * GW + x;
        shadow.u32[i] = shadowA << 24;
        const m = c.m;
        if (LOOSE.has(m)) {
          depth[x]++;
          const b = bbox[m];
          if (!b) bbox[m] = [x, y, x, y];
          else { if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; b[3] = y; }
          const p = sk.mats[m];
          let col;
          if (m === 'water') {
            col = mix(mix(p.base, p.light, 0.18), p.dark, Math.min(1, (depth[x] - 1) / 14));
            if (c.frz > 0) col = mix(col, sk.mats.ice.light, Math.min(1, c.frz / 0.75) * 0.8);
          } else if (m === 'sand') {
            col = mix(p.base, c.shade > 0.5 ? p.light : p.dark, Math.abs(c.shade - 0.5) * 0.5);
            col = mix(col, p.dark, Math.min(0.5, (depth[x] - 1) / 24));
            if (c.heat > 0) col = mix(col, sk.mats.fire.light, Math.min(1, c.heat / 0.25) * 0.7);
          } else {
            col = mix(p.base, c.shade > 0.5 ? p.light : p.dark, Math.abs(c.shade - 0.5) * 0.6);
          }
          looseField[m].u32[i] = pack(col);
        } else {
          depth[x] = 0;
          if (c._v === undefined) needV.push([c, y]);
          if (m === 'fire') { glowAcc[(y >> 2) * COLS + (x >> 2)] += 1; anyFire = true; }
          if (c.heat > 0 && m !== 'fire') { heatAcc[(y >> 1) * (GW / 2) + (x >> 1)] += Math.min(1, c.heat / 0.75); anyHeat = true; }
        }
      }
    }
    if (needV.length) assignV(needV);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(st.wall, 0, 0);

    // ---------- drop shadow ----------
    shadow.x.putImageData(shadow.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shadow.c, P * 0.35, P * 0.55, W, H);

    // ---------- loose materials ----------
    for (const m of LOOSE_LIST) {
      const b = bbox[m];
      if (!b) continue;
      const x0 = Math.max(0, (b[0] - 1) * P);
      const y0 = Math.max(0, (b[1] - 1) * P);
      const x1 = Math.min(W, (b[2] + 2) * P);
      const y1 = Math.min(H, (b[3] + 2) * P);
      lctx.save();
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(x0, y0, x1 - x0, y1 - y0);
      lctx.beginPath();
      lctx.rect(x0, y0, x1 - x0, y1 - y0);
      lctx.clip();
      // Body: interior particles as squares, edge particles as overlapping discs, so the
      // outline is soft and round instead of a staircase.
      lctx.beginPath();
      const rad = P * 0.74;
      const surf = [];
      for (let y = b[1]; y <= b[3]; y++) {
        const row = grid[y];
        for (let x = b[0]; x <= b[2]; x++) {
          const c = row[x];
          if (!c || c.m !== m) continue;
          const up = y > 0 ? grid[y - 1][x] : null;
          const dn = y < GH - 1 ? grid[y + 1][x] : null;
          const lf = x > 0 ? row[x - 1] : null;
          const rt = x < GW - 1 ? row[x + 1] : null;
          const same = (n) => n && n.m === m;
          if (same(up) && same(dn) && same(lf) && same(rt)) {
            lctx.rect(x * P - 0.5, y * P - 0.5, P + 1, P + 1);
          } else {
            lctx.moveTo(x * P + P / 2 + rad, y * P + P / 2);
            lctx.arc(x * P + P / 2, y * P + P / 2, rad, 0, Math.PI * 2);
            // Squares where neighbours are solid ground, so bodies sit flush on blocks.
            if (dn || lf || rt) lctx.rect(x * P, y * P + P * 0.3, P, P * 0.7);
          }
          if (!up || !same(up)) surf.push(x, y, up ? 1 : 0);
        }
      }
      lctx.fillStyle = '#fff';
      lctx.fill();
      // Color: the particle field scaled up smoothly.
      const f = looseField[m];
      f.x.putImageData(f.img, 0, 0);
      lctx.globalCompositeOperation = 'source-in';
      lctx.imageSmoothingEnabled = true;
      lctx.drawImage(f.c, 0, 0, W, H);
      lctx.globalCompositeOperation = 'source-atop';
      if (m === 'sand') {
        lctx.fillStyle = grain;
        lctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else if (m === 'water') {
        lctx.save();
        lctx.translate((ts / 40) % (P * 12), (ts / 90) % (P * 12));
        lctx.fillStyle = ripple;
        lctx.fillRect(x0 - P * 12, y0 - P * 12, x1 - x0 + P * 24, y1 - y0 + P * 24);
        lctx.restore();
      }
      // Surface: a bright lip where the body meets air.
      const p = sk.mats[m];
      lctx.fillStyle = css(p.light, m === 'water' ? 0.85 : m === 'mud' ? 0.55 : 0.6);
      lctx.beginPath();
      for (let k = 0; k < surf.length; k += 3) {
        if (surf[k + 2]) continue; // covered by something else, no air above
        const x = surf[k];
        const y = surf[k + 1];
        const wob = m === 'water' ? Math.sin(ts / 260 + x * 0.9) * P * 0.08 : 0;
        lctx.rect(x * P - 1, y * P - P * 0.22 + wob, P + 2, Math.max(2, P * 0.2));
      }
      lctx.fill();
      if (m === 'mud') {
        // Bubbles that swell and pop.
        lctx.fillStyle = css(p.light, 0.5);
        for (let k = 0; k < surf.length; k += 9) {
          const x = surf[k];
          const y = surf[k + 1];
          const ph = ((ts / 900 + x * 0.37) % 1);
          lctx.beginPath();
          lctx.arc(x * P + P / 2, y * P + P * 0.6, P * 0.15 + ph * P * 0.25, 0, 7);
          lctx.fill();
        }
      }
      lctx.restore();
      ctx.globalAlpha = m === 'water' ? 0.94 : 1;
      ctx.drawImage(layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
    }

    // ---------- rigid blocks ----------
    ctx.imageSmoothingEnabled = false;
    const fireFrame = Math.floor(ts / 110);
    const lightEdges = new Path2D();
    const darkEdges = new Path2D();
    let partial = 0;
    const e = Math.max(1, Math.round(P * 0.16));
    for (let y = 0; y < GH; y++) {
      const row = grid[y];
      for (let x = 0; x < GW; x++) {
        const c = row[x];
        if (!c || !RIGID.has(c.m)) continue;
        const i = y * GW + x;
        if (stamp[i] === frame) continue;
        const u = x & 3;
        const v = c._v;
        const ox = x - u;
        const oy = y - v;
        const variant = variantOf(x, c._row);
        const tile = c.m === 'fire' ? tiles.fireFrames[(fireFrame + (c.id % FIRE_FRAMES)) % FIRE_FRAMES][variant] : tiles[c.m][variant];
        let intact = oy >= 0 && oy + 3 < GH;
        for (let j = 0; intact && j < 4; j++) {
          const r2 = grid[oy + j];
          for (let k = 0; k < 4; k++) {
            const n = r2[ox + k];
            if (!n || n.id !== c.id || n.m !== c.m || n._v !== j) { intact = false; break; }
          }
        }
        if (intact) {
          ctx.drawImage(tile, ox * P, oy * P);
          for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) stamp[(oy + j) * GW + ox + k] = frame;
          continue;
        }
        stamp[i] = frame;
        partial++;
        ctx.drawImage(tile, u * P, v * P, P, P, x * P, y * P, P, P);
        // Freshly broken edges get their own bevel so a crumbled block still looks solid.
        const sameAt = (xx, yy) => { const n = xx >= 0 && xx < GW && yy >= 0 && yy < GH ? grid[yy][xx] : null; return n && n.id === c.id && n.m === c.m; };
        if (v !== 0 && !sameAt(x, y - 1)) lightEdges.rect(x * P, y * P, P, e);
        if (u !== 0 && !sameAt(x - 1, y)) lightEdges.rect(x * P, y * P, e, P);
        if (v !== 3 && !sameAt(x, y + 1)) darkEdges.rect(x * P, y * P + P - e, P, e);
        if (u !== 3 && !sameAt(x + 1, y)) darkEdges.rect(x * P + P - e, y * P, e, P);
      }
    }
    if (partial) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fill(lightEdges);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fill(darkEdges);
    }

    // ---------- heat, flames and glow ----------
    ctx.imageSmoothingEnabled = true;
    if (anyHeat) {
      const hw = GW / 2;
      for (let k = 0; k < heatAcc.length; k++) {
        const a = Math.min(1, heatAcc[k] / 2.5);
        heat.u32[k] = a > 0 ? pack([255, 70 + 60 * a, 20], Math.round(a * 200)) : 0;
      }
      heat.x.putImageData(heat.img, 0, 0);
      // Char first (multiply darkens toward ember red), then a lighter pass for the glow.
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(heat.c, 0, 0, hw * 2 * P, (GH / 2) * 2 * P);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(ts / 120);
      ctx.drawImage(heat.c, 0, 0, hw * 2 * P, (GH / 2) * 2 * P);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (anyFire) {
      const fl = st.flames;
      const fw = fl[0].width;
      const fh = fl[0].height;
      for (let y = 0; y < GH; y++) {
        const row = grid[y];
        for (let x = 1; x < GW; x += 2) {
          const c = row[x];
          if (!c || c.m !== 'fire') continue;
          const up = y > 0 ? grid[y - 1][x] : null;
          if (up && (up.m === 'fire' || RIGID.has(up.m))) continue;
          const f = (Math.floor(ts / 90) + x * 3 + y) % FIRE_FRAMES;
          const s = 0.75 + 0.3 * Math.sin(ts / 170 + x * 1.9);
          ctx.drawImage(fl[f], x * P + P / 2 - fw / 2, y * P - fh * s + P * 0.5, fw, fh * s);
        }
      }
      const fireC = sk.mats.fire.glow;
      for (let k = 0; k < glowAcc.length; k++) {
        const a = Math.min(1, glowAcc[k] / 16);
        glow.u32[k] = a > 0 ? pack(fireC, Math.round(a * 150)) : 0;
      }
      glow.x.putImageData(glow.img, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.85 + 0.15 * Math.sin(ts / 240);
      ctx.globalAlpha = 0.55 * pulse;
      ctx.drawImage(glow.c, -T * 0.5, -T * 0.5, W + T, H + T);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---------- ghost and falling piece ----------
    const piece = opts.piece;
    if (piece) {
      const mats = piece.mats || piece.cells.map(() => piece.m);
      const minB = Math.min(...piece.cells.map(([, bb]) => bb));
      const px = opts.pieceX ?? piece.x;
      if (opts.ghostY !== undefined && opts.ghostY !== null) {
        ctx.globalAlpha = 0.28;
        piece.cells.forEach(([a, bb], k) => {
          ctx.drawImage(tiles[mats[k]][variantOf((piece.x + a) * S, bb - minB)], (piece.x + a) * T, (opts.ghostY + bb * S) * P);
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = Math.max(1.5, P * 0.18);
        ctx.setLineDash([P * 0.6, P * 0.4]);
        piece.cells.forEach(([a, bb]) => {
          ctx.strokeRect((piece.x + a) * T + ctx.lineWidth, (opts.ghostY + bb * S) * P + ctx.lineWidth, T - ctx.lineWidth * 2, T - ctx.lineWidth * 2);
        });
        ctx.setLineDash([]);
        // Telegraph: cells the piece would react with when it lands.
        if (opts.targets && opts.targets.length) {
          const a = 0.35 + 0.25 * Math.sin(ts / 140);
          ctx.strokeStyle = `rgba(255,236,140,${a + 0.3})`;
          ctx.lineWidth = Math.max(2, P * 0.28);
          for (const [tx, ty] of opts.targets) ctx.strokeRect(tx * T + ctx.lineWidth / 2, ty * T + ctx.lineWidth / 2, T - ctx.lineWidth, T - ctx.lineWidth);
        }
      }
      const lift = opts.pieceLift || 0;
      piece.cells.forEach(([a, bb], k) => {
        const x = (px + a) * T;
        const y = (piece.y + bb * S) * P - lift;
        if (y < -T) return;
        const m = mats[k];
        const tile = m === 'fire' ? tiles.fireFrames[fireFrame % FIRE_FRAMES][0] : tiles[m][variantOf((piece.x + a) * S, bb - minB)];
        ctx.drawImage(tile, x, y);
      });
      if (mats.includes('fire')) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35;
        piece.cells.forEach(([a, bb], k) => {
          if (mats[k] !== 'fire') return;
          const gx = (px + a) * T + T / 2;
          const gy = (piece.y + bb * S) * P + T / 2;
          const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, T * 1.2);
          rg.addColorStop(0, css(sk.mats.fire.glow, 0.9));
          rg.addColorStop(1, css(sk.mats.fire.glow, 0));
          ctx.fillStyle = rg;
          ctx.fillRect(gx - T * 1.2, gy - T * 1.2, T * 2.4, T * 2.4);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  return {
    resize,
    draw,
    setSkin,
    get P() { return st.P; },
    get W() { return st.W; },
    get H() { return st.H; },
    get dpr() { return st.d; },
    get skin() { return st.skin; },
    get tiles() { return st.tiles; },
  };
}
