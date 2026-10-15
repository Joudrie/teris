// The board renderer. Reads the simulation grid (48x80 particles, see core.js) and draws:
//   1. the well (baked once per size),
//   2. a soft drop shadow under everything,
//   3. loose materials (water, sand, mud) as smooth shaded bodies instead of pixel stairs,
//   4. rigid blocks as baked voxel tiles: a whole tile per intact cell, particle-sized cut-outs
//      where a block has partly burned, melted or crumbled,
//   5. heat glow, fire glow and flame tongues,
//   6. the ghost (with the cells it would react with) and the falling piece.
// It only reads the game and never touches a particle: each rigid particle's texture offset
// is kept in a WeakMap, so the simulation's objects keep their shape (and their speed).

import { GW, GH, S, COLS, ROWS } from '../core.js';
import { canvas, css, mix } from './color.js';
import { RIGID, LOOSE } from './skins.js';
import { bakeTiles, bakeFlames, bakeWall, bakeEmblems, VARIANTS, FIRE_FRAMES } from './tiles.js';

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
  const baseCv = canvas(8, 8);
  const bctx = baseCv.getContext('2d');
  const topCv = canvas(8, 8);
  const tctx = topCv.getContext('2d');
  let grain = null;
  let ripple = null;

  // Packed colors for loose particles by depth, shade, frost and heat, so the per-frame
  // pass allocates nothing.
  let lut = null;
  function bakeLut() {
    const mt = st.skin.mats;
    const water = new Uint32Array(16 * 8);
    for (let d = 0; d < 16; d++) {
      for (let f = 0; f < 8; f++) {
        let col = mix(mix(mt.water.base, mt.water.light, 0.18), mt.water.dark, Math.min(1, d / 14));
        if (f) col = mix(col, mt.ice.light, (f / 7) * 0.8);
        water[d * 8 + f] = pack(col);
      }
    }
    const sand = new Uint32Array(8 * 13 * 5);
    for (let sh = 0; sh < 8; sh++) {
      for (let d = 0; d < 13; d++) {
        for (let h = 0; h < 5; h++) {
          const shade = (sh + 0.5) / 8;
          let col = mix(mt.sand.base, shade > 0.5 ? mt.sand.light : mt.sand.dark, Math.abs(shade - 0.5) * 0.5);
          col = mix(col, mt.sand.dark, Math.min(0.5, (d * 2) / 24));
          if (h) col = mix(col, mt.fire.light, (h / 4) * 0.7);
          sand[(sh * 13 + d) * 5 + h] = pack(col);
        }
      }
    }
    const mud = new Uint32Array(8);
    for (let sh = 0; sh < 8; sh++) {
      const shade = (sh + 0.5) / 8;
      mud[sh] = pack(mix(mt.mud.base, shade > 0.5 ? mt.mud.light : mt.mud.dark, Math.abs(shade - 0.5) * 0.6));
    }
    lut = { water, sand, mud };
  }

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
    baseCv.width = st.W;
    baseCv.height = st.H;
    topCv.width = st.W;
    topCv.height = st.H;
    st.sig = null;
    st.calm = 0;
    st.cacheFor = null;
    st.tiles = bakeTiles(st.skin, P * S);
    st.flames = bakeFlames(st.skin, Math.round(P * 2.2), Math.round(P * 3.4));
    st.wall = bakeWall(st.skin, st.W, st.H, COLS, ROWS);
    st.emblems = bakeEmblems(Math.round(P * S * 0.62));
    bakePatterns();
    bakeLut();
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
      vmap.set(c, (((y - top) >> 2) << 2) | ((y - top) & 3));
    }
  }

  const bboxes = { water: null, sand: null, mud: null };
  const bboxStore = { water: new Int16Array(4), sand: new Int16Array(4), mud: new Int16Array(4) };
  const vmap = new WeakMap(); // particle -> (cell row in block << 2) | row in cell
  const variantOf = (x, row) => (((x >> 2) * 3 + row * 5) % VARIANTS + VARIANTS) % VARIANTS;

  const MAT_CODE = { fire: 1, water: 2, wood: 3, wetwood: 4, ice: 5, sand: 6, glass: 7, stone: 8, brick: 9, mud: 10 };
  const depth = new Int16Array(GW);
  const needV = [];
  const surf = [];
  const sameAt = (grid, xx, yy, id, m) => {
    const n = xx >= 0 && xx < GW && yy >= 0 && yy < GH ? grid[yy][xx] : null;
    return n && n.id === id && n.m === m;
  };

  // Rigid tiles into `target`: the solid ones (cached between frames) or only fire (animated).
  function drawRigid(target, grid, onlyFire, ts, assist) {
    const { P, tiles } = st;
    const T = P * S;
    st.frame++;
    const frame = st.frame;
    const stamp = st.stamp;
    const fireFrame = Math.floor(ts / 110);
    let light = null;
    let dark = null;
    const e = Math.max(1, Math.round(P * 0.16));
    target.imageSmoothingEnabled = false;
    for (let y = 0; y < GH; y++) {
      const row = grid[y];
      for (let x = 0; x < GW; x++) {
        const c = row[x];
        if (!c || !RIGID.has(c.m) || (c.m === 'fire') !== onlyFire) continue;
        const i = y * GW + x;
        if (stamp[i] === frame) continue;
        const u = x & 3;
        const pv = vmap.get(c) || 0;
        const v = pv & 3;
        const ox = x - u;
        const oy = y - v;
        const variant = variantOf(x, pv >> 2);
        const tile = onlyFire ? tiles.fireFrames[(fireFrame + (c.id % FIRE_FRAMES)) % FIRE_FRAMES][variant] : tiles[c.m][variant];
        let intact = oy >= 0 && oy + 3 < GH;
        for (let j = 0; intact && j < 4; j++) {
          const r2 = grid[oy + j];
          for (let k = 0; k < 4; k++) {
            const n = r2[ox + k];
            if (!n || n.id !== c.id || n.m !== c.m || ((vmap.get(n) || 0) & 3) !== j) { intact = false; break; }
          }
        }
        if (intact) {
          target.drawImage(tile, ox * P, oy * P);
          if (assist) { const em = st.emblems[c.m]; target.drawImage(em, ox * P + (T - em.width) / 2, oy * P + (T - em.height) / 2); }
          for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) stamp[(oy + j) * GW + ox + k] = frame;
          continue;
        }
        stamp[i] = frame;
        target.drawImage(tile, u * P, v * P, P, P, x * P, y * P, P, P);
        // Freshly broken edges get their own bevel so a crumbled block still looks solid.
        if (!light) { light = new Path2D(); dark = new Path2D(); }
        if (v !== 0 && !sameAt(grid, x, y - 1, c.id, c.m)) light.rect(x * P, y * P, P, e);
        if (u !== 0 && !sameAt(grid, x - 1, y, c.id, c.m)) light.rect(x * P, y * P, e, P);
        if (v !== 3 && !sameAt(grid, x, y + 1, c.id, c.m)) dark.rect(x * P, y * P + P - e, P, e);
        if (u !== 3 && !sameAt(grid, x + 1, y, c.id, c.m)) dark.rect(x * P + P - e, y * P, e, P);
      }
    }
    if (light) {
      target.fillStyle = 'rgba(255,255,255,0.32)';
      target.fill(light);
      target.fillStyle = 'rgba(0,0,0,0.32)';
      target.fill(dark);
    }
  }


  // Particle-space origins (x, y) of the cells next to the landing spot that would react.
  let tgKey = '';
  let tgOut = [];
  function telegraph(grid, piece, mats, gy, reacts) {
    const key = `${piece.x}|${gy}|${piece.cells.flat().join('')}|${st.sig}`;
    if (key === tgKey) return tgOut;
    tgKey = key;
    const seen = new Set();
    const out = [];
    const own = new Set(piece.cells.map(([a, b]) => `${piece.x + a},${b}`));
    piece.cells.forEach(([a, b], k) => {
      const cx = (piece.x + a) * S;
      const top = gy + b * S;
      const probes = [];
      if (!own.has(`${piece.x + a},${b + 1}`)) probes.push([cx + 1, top + S], [cx + 2, top + S]);
      if (!own.has(`${piece.x + a},${b - 1}`)) probes.push([cx + 1, top - 1]);
      if (!own.has(`${piece.x + a - 1},${b}`)) probes.push([cx - 1, top + 1], [cx - 1, top + 2]);
      if (!own.has(`${piece.x + a + 1},${b}`)) probes.push([cx + S, top + 1], [cx + S, top + 2]);
      for (const [x, y] of probes) {
        if (x < 0 || x >= GW || y < 0 || y >= GH) continue;
        const c = grid[y][x];
        if (!c || !reacts(mats[k], c.m)) continue;
        const ox = x - (x & 3);
        const oy = RIGID.has(c.m) ? y - ((vmap.get(c) || 0) & 3) : Math.min(GH - S, Math.max(0, y - 1));
        const id = `${ox},${oy}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push([ox, oy]);
      }
    });
    tgOut = out;
    return out;
  }

  function draw(g, opts = {}) {
    st.g = g;
    const { P, W, H, skin: sk, tiles } = st;
    const ts = opts.ts || 0;
    const T = P * S;
    const grid = g.grid;

    // ---------- pass 1: fields, bounds and a signature of the solid blocks ----------
    glowAcc.fill(0);
    heatAcc.fill(0);
    const bbox = bboxes;
    for (const m of LOOSE_LIST) bbox[m] = null;
    depth.fill(0);
    needV.length = 0;
    let anyHeat = false;
    let anyFire = false;
    let hb0 = GW; let hb1 = -1; let hb2 = GH; let hb3 = -1;
    let fb0 = COLS; let fb1 = -1; let fb2 = ROWS; let fb3 = -1;
    let sig = 7;
    for (let y = 0; y < GH; y++) {
      const row = grid[y];
      for (let x = 0; x < GW; x++) {
        const c = row[x];
        if (!c) { depth[x] = 0; continue; }
        const i = y * GW + x;
        const m = c.m;
        if (LOOSE.has(m)) {
          depth[x]++;
          const b = bbox[m];
          if (!b) {
            const nb = bboxStore[m];
            nb[0] = x; nb[1] = y; nb[2] = x; nb[3] = y;
            bbox[m] = nb;
            looseField[m].u32.fill(pack(sk.mats[m].base));
          } else { if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; b[3] = y; }
          let col;
          if (m === 'water') col = lut.water[Math.min(15, depth[x] - 1) * 8 + (c.frz > 0 ? Math.min(7, 1 + Math.floor((c.frz / 0.75) * 6)) : 0)];
          else if (m === 'sand') col = lut.sand[(Math.min(7, Math.floor(c.shade * 8)) * 13 + Math.min(12, (depth[x] - 1) >> 1)) * 5 + (c.heat > 0 ? Math.min(4, 1 + Math.floor((c.heat / 0.25) * 3)) : 0)];
          else col = lut.mud[Math.min(7, Math.floor(c.shade * 8))];
          looseField[m].u32[i] = col;
        } else {
          depth[x] = 0;
          if (!vmap.has(c)) needV.push([c, y]);
          if (m === 'fire') {
            glowAcc[(y >> 2) * COLS + (x >> 2)] += 1;
            anyFire = true;
            if ((x >> 2) < fb0) fb0 = x >> 2; if ((x >> 2) > fb1) fb1 = x >> 2;
            if ((y >> 2) < fb2) fb2 = y >> 2; if ((y >> 2) > fb3) fb3 = y >> 2;
          } else {
            sig = (Math.imul(sig, 31) + i * 16 + MAT_CODE[m] + (c.id << 13)) | 0;
            if (c.heat > 0) {
              heatAcc[(y >> 1) * (GW / 2) + (x >> 1)] += Math.min(1, c.heat / 0.75);
              anyHeat = true;
              if (x < hb0) hb0 = x; if (x > hb1) hb1 = x; if (y < hb2) hb2 = y; if (y > hb3) hb3 = y;
            }
          }
        }
      }
    }
    if (needV.length) { assignV(needV); sig = (sig + 1) | 0; }
    sig = (sig + (opts.assist ? 99991 : 0)) | 0;

    // ---------- the well with block shadows, and the solid blocks ----------
    // While the board is changing every frame (reactions running) the cache would be rebuilt
    // every frame anyway, so draw straight to the board; once it settles, cache it.
    const changed = sig !== st.sig;
    st.sig = sig;
    st.calm = changed ? 0 : st.calm + 1;
    const direct = st.calm < 2;
    const lite = !!opts.lite;
    const paintBase = (c) => {
      c.globalCompositeOperation = 'source-over';
      c.drawImage(st.wall, 0, 0);
      if (lite) return;
      shadow.u32.fill(0);
      const shadowA = Math.round(255 * sk.shadow) << 24;
      for (let y = 0; y < GH; y++) {
        const row = grid[y];
        for (let x = 0; x < GW; x++) { const cc = row[x]; if (cc && RIGID.has(cc.m)) shadow.u32[y * GW + x] = shadowA; }
      }
      shadow.x.putImageData(shadow.img, 0, 0);
      c.imageSmoothingEnabled = true;
      c.drawImage(shadow.c, P * 0.35, P * 0.55, W, H);
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (direct) {
      paintBase(ctx);
    } else {
      if (st.calm === 2 || st.cacheFor !== sig) {
        st.cacheFor = sig;
        paintBase(bctx);
        tctx.clearRect(0, 0, W, H);
        drawRigid(tctx, grid, false, ts, opts.assist);
      }
      ctx.drawImage(baseCv, 0, 0);
    }

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
      surf.length = 0;
      const same = (n) => n && n.m === m;
      for (let y = b[1]; y <= b[3]; y++) {
        const row = grid[y];
        let run = -1; // start of a run of interior particles, drawn as one rectangle
        for (let x = b[0]; x <= b[2] + 1; x++) {
          const c = x <= b[2] ? row[x] : null;
          const mine = c && c.m === m;
          const up = mine && y > 0 ? grid[y - 1][x] : null;
          const dn = mine && y < GH - 1 ? grid[y + 1][x] : null;
          const lf = mine && x > 0 ? row[x - 1] : null;
          const rt = mine && x < GW - 1 ? row[x + 1] : null;
          const inner = mine && same(up) && same(dn) && same(lf) && same(rt);
          if (inner) { if (run < 0) run = x; continue; }
          if (run >= 0) { lctx.rect(run * P - 0.5, y * P - 0.5, (x - run) * P + 1, P + 1); run = -1; }
          if (!mine) continue;
          lctx.moveTo(x * P + P / 2 + rad, y * P + P / 2);
          lctx.arc(x * P + P / 2, y * P + P / 2, rad, 0, Math.PI * 2);
          // Squares where neighbours are solid ground, so bodies sit flush on blocks.
          if (dn || lf || rt) lctx.rect(x * P, y * P + P * 0.3, P, P * 0.7);
          if (!same(up)) surf.push(x, y, up ? 1 : 0);
        }
      }
      lctx.fillStyle = '#fff';
      lctx.fill();
      // Color: the particle field scaled up smoothly.
      const f = looseField[m];
      f.x.putImageData(f.img, 0, 0);
      lctx.globalCompositeOperation = 'source-in';
      lctx.imageSmoothingEnabled = true;
      const fx0 = Math.max(0, b[0] - 1);
      const fy0 = Math.max(0, b[1] - 1);
      const fw = Math.min(GW, b[2] + 2) - fx0;
      const fh = Math.min(GH, b[3] + 2) - fy0;
      lctx.drawImage(f.c, fx0, fy0, fw, fh, fx0 * P, fy0 * P, fw * P, fh * P);
      lctx.globalCompositeOperation = 'source-atop';
      if (m === 'sand') {
        lctx.fillStyle = grain;
        lctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else if (m === 'water' && !lite) {
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

    if (direct) drawRigid(ctx, grid, false, ts, opts.assist);
    else { ctx.imageSmoothingEnabled = false; ctx.drawImage(topCv, 0, 0); }
    if (anyFire) drawRigid(ctx, grid, true, ts, opts.assist);
    const fireFrame = Math.floor(ts / 110);

    // ---------- heat, flames and glow ----------
    ctx.imageSmoothingEnabled = true;
    if (anyHeat) {
      const hw = GW / 2;
      for (let k = 0; k < heatAcc.length; k++) {
        const a = Math.min(1, heatAcc[k] / 2.5);
        heat.u32[k] = a > 0 ? pack([255, 70 + 60 * a, 20], Math.round(a * 200)) : 0;
      }
      heat.x.putImageData(heat.img, 0, 0);
      // Only the part of the board that is hot: char first (multiply darkens toward ember
      // red), then a lighter pass for the glow.
      const sx = Math.max(0, (hb0 >> 1) - 2);
      const sy = Math.max(0, (hb2 >> 1) - 2);
      const sw = Math.min(hw, (hb1 >> 1) + 3) - sx;
      const sh = Math.min(GH / 2, (hb3 >> 1) + 3) - sy;
      if (!lite) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(heat.c, sx, sy, sw, sh, sx * 2 * P, sy * 2 * P, sw * 2 * P, sh * 2 * P);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(ts / 120);
      ctx.drawImage(heat.c, sx, sy, sw, sh, sx * 2 * P, sy * 2 * P, sw * 2 * P, sh * 2 * P);
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
      const gx0 = Math.max(0, fb0 - 1);
      const gy0 = Math.max(0, fb2 - 1);
      const gw = Math.min(COLS, fb1 + 2) - gx0;
      const gh = Math.min(ROWS, fb3 + 2) - gy0;
      ctx.drawImage(glow.c, gx0, gy0, gw, gh, gx0 * T - T * 0.5, gy0 * T - T * 0.5, gw * T + T, gh * T + T);
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
        // A solid, softly lit silhouette with a bright rim: clearly "here", never a wireframe.
        const lw = Math.max(1.5, P * 0.2);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = lw;
        piece.cells.forEach(([a, bb]) => {
          const gx = (piece.x + a) * T + lw;
          const gy2 = (opts.ghostY + bb * S) * P + lw;
          ctx.fillRect(gx, gy2, T - lw * 2, T - lw * 2);
          ctx.strokeRect(gx, gy2, T - lw * 2, T - lw * 2);
        });
        // Telegraph: the blocks this piece would react with where it lands.
        if (opts.reacts) {
          const targets = telegraph(grid, piece, mats, opts.ghostY, opts.reacts);
          if (targets.length) {
            // An ink outline under a pulsing bright one, so it reads even on glowing fire.
            const a = 0.6 + 0.4 * Math.sin(ts / 140);
            const lw = Math.max(2, P * 0.3);
            const inset = lw;
            ctx.setLineDash([]);
            for (const [tx, ty] of targets) {
              ctx.lineWidth = lw + Math.max(2, P * 0.25);
              ctx.strokeStyle = 'rgba(13,22,64,0.85)';
              ctx.strokeRect(tx * P + inset, ty * P + inset, T - inset * 2, T - inset * 2);
              ctx.lineWidth = lw;
              ctx.strokeStyle = `rgba(255,248,200,${a})`;
              ctx.strokeRect(tx * P + inset, ty * P + inset, T - inset * 2, T - inset * 2);
            }
          }
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
        if (opts.assist) { const em = st.emblems[m]; ctx.drawImage(em, x + (T - em.width) / 2, y + (T - em.height) / 2); }
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
