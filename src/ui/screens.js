// The screens around the board: the tower map and the sheets (pause, settings, shop, daily
// gifts, block codex, store stub). Each builder writes markup and wires its buttons through
// the `app` object main.js passes in, so this file holds no game state of its own.

import { TOTAL_LEVELS } from '../core.js';
import { levelConfig, POWERS } from '../levels.js';
import { icon, POWER_ICON } from './icons.js';
import { previewTile } from '../render/tiles.js';
import { SKINS } from '../render/skins.js';
import { canvas } from '../render/color.js';
import { BOOSTERS, SKIN_ITEMS, DAILY_REWARDS } from '../meta.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');

// ---------- tower map ----------

const ROW = 118; // px between floors on the map
const TOP = 250;
export const nodeY = (level) => TOP + (level - 1) * ROW;
const nodeX = (level) => 50 + Math.sin(level * 1.15) * 15; // percent of the tower width

function towerPattern(skin) {
  const T = 31;
  const d = 2;
  const c = canvas(T * 8 * d, T * 12 * d);
  const ctx = c.getContext('2d');
  const stone = [0, 1, 2].map((v) => previewTile(skin, 'stone', T * d, v));
  const brick = [0, 1, 2].map((v) => previewTile(skin, 'brick', T * d, v));
  const glass = previewTile(skin, 'glass', T * d);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 8; x++) {
      const band = y % 6 >= 4;
      const win = !band && (x === 1 || x === 6) && y % 6 === 1;
      if (win) { ctx.fillStyle = '#1a2a5a'; ctx.fillRect(x * T * d, y * T * d, T * d, T * d); }
      ctx.drawImage(win ? glass : band ? brick[(x + y) % 3] : stone[(x * 7 + y) % 3], x * T * d, y * T * d);
    }
  }
  ctx.fillStyle = 'rgba(170,215,255,.42)';
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL();
}

function cloudImage(w, h, seed) {
  const c = canvas(w * 2, h * 2);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const puffs = Array.from({ length: 5 }, (_, k) => {
    const t = k / 4;
    const rad = h * (0.28 + Math.sin(t * Math.PI) * 0.2 + r() * 0.06);
    return [w * (0.14 + t * 0.72), h * 0.72 - rad * 0.6, rad];
  });
  const blob = (dy, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [x, y, rad] of puffs) { ctx.moveTo(x + rad, y + dy); ctx.arc(x, y + dy, rad, 0, Math.PI * 2); }
    ctx.rect(w * 0.14, h * 0.55 + dy, w * 0.72, h * 0.2);
    ctx.fill();
  };
  blob(5, '#cfe7ff');
  blob(0, '#ffffff');
  return c.toDataURL();
}

export function buildMap(app) {
  const { meta, skin } = app;
  const scroll = $('mapScroll');
  const best = app.best();
  const cur = app.sess.level;
  const H = nodeY(TOTAL_LEVELS) + 300;
  const pat = towerPattern(skin);
  let nodes = '';
  let alts = '';
  const pts = [];
  for (let l = 1; l <= TOTAL_LEVELS; l++) {
    const x = nodeX(l);
    const y = nodeY(l);
    pts.push(`${x}% ${y}`);
    const stars = meta.starsOf(l);
    const done = l !== cur && (l < best || stars > 0);
    const lock = !done && l !== cur;
    const show = l % 5 === 0;
    let inner = lock ? icon('lock') : `<span class="t">${l}</span>`;
    if (done) inner = `<span class="nstars">${[1, 2, 3].map((k) => icon('star', k <= stars ? '' : 'off')).join('')}</span>${inner}`;
    nodes += `<button class="node${l === cur ? ' cur' : ''}${lock ? ' lock' : ''}${show ? ' show' : ''}" data-level="${l}" style="left:calc(50% + ${((x - 50) / 100) * 224}px);top:${y}px" aria-label="Level ${l}">${inner}</button>`;
    if (l % 5 === 1) alts += `<div class="alt" style="top:${y}px">${101 - l} ft</div>`;
  }
  let clouds = '';
  for (let k = 0; k < 26; k++) {
    const y = 80 + k * (H / 26);
    const left = k % 2 ? `${-30 + (k * 37) % 40}px` : `calc(100% - ${110 + (k * 53) % 60}px)`;
    clouds += `<img class="map-cloud" alt="" src="${cloudImage(150, 60, k * 97 + 3)}" style="top:${y}px;left:${left};width:150px;opacity:${0.6 + (k % 3) * 0.13}">`;
  }
  const path = pts.map((p, i) => {
    const [px, py] = p.split(' ');
    return `${i ? 'L' : 'M'}${(parseFloat(px) / 100) * 224} ${py}`;
  }).join(' ');
  scroll.innerHTML = `
    <div class="map-track" style="height:${H}px">
      <div class="map-sky" style="background:linear-gradient(180deg,#1f6fd8 0,#3f9cf5 ${H * 0.2}px,#7ccaff ${H * 0.5}px,#bfe9ff ${H * 0.82}px,#dff6ff ${H - 260}px,#5cbf43 ${H - 150}px,#4aa936 100%)"></div>
      ${clouds}
      <img class="map-logo" src="assets/wordmark.png" alt="Tumbledown">
      <div class="map-tower" style="background-image:url(${pat});background-size:224px auto"></div>
      <svg class="map-path" style="left:calc(50% - 112px);width:224px;height:${H}px"><path d="${path}" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="2 15" stroke-linecap="round" opacity=".9"/></svg>
      ${nodes}${alts}
    </div>`;
  scroll.querySelectorAll('.node').forEach((n) => {
    n.onclick = () => {
      const l = +n.dataset.level;
      app.sound('tap');
      if (l === cur) app.playFromMap();
      else if (n.classList.contains('lock')) app.toast(`${icon('lock')} Clear level ${cur} first`, 'navy');
      else app.toast(`${icon('star')} Level ${l}: ${meta.starsOf(l)} of 3 stars`, 'navy');
    };
  });
  // Center the current floor.
  requestAnimationFrame(() => { scroll.scrollTop = Math.max(0, nodeY(cur) - scroll.clientHeight * 0.48); });
}

export function mapHud(app) {
  const { meta, sess } = app;
  $('coinPill').innerHTML = `${icon('coin')}<span class="t">${fmt(meta.coins())}</span>`;
  $('starPill').innerHTML = `${icon('star')}<span class="t">${meta.totalStars()}</span>`;
  const daily = app.homeInfo();
  $('dailyBtn').disabled = !daily.dailyReady;
  $('dailyInfo').textContent = daily.dailyReady ? (daily.streak ? `Streak ${daily.streak}` : 'New today') : 'Done ✓';
  $('rewardsBadge').hidden = !meta.rewards().ready;
  const fresh = app.freshGame();
  $('playLabel').textContent = fresh ? 'Play' : 'Resume';
  $('homeLevel').textContent = sess.daily ? 'Daily challenge' : `Level ${sess.level}`;
  const b = meta.boosters();
  const sel = app.selected;
  $('boosters').hidden = !fresh || sess.daily;
  $('boosters').innerHTML = Object.entries(BOOSTERS).map(([k, v]) => `<button class="boost${sel.has(k) ? ' on' : ''}${b[k] ? '' : ' empty'}" data-k="${k}">${icon(v.icon)}${v.label}<b>${b[k] ? b[k] : '+'}</b></button>`).join('');
  $('boosters').querySelectorAll('.boost').forEach((el) => {
    el.onclick = () => {
      const k = el.dataset.k;
      app.sound('tap');
      if (!meta.boosters()[k]) { openShop(app, 'boosters'); return; }
      if (sel.has(k)) sel.delete(k); else sel.add(k);
      mapHud(app);
    };
  });
}

// ---------- sheets ----------

export function openSheet(app, html, onOpen) {
  const wrap = $('sheet');
  const body = $('sheetBody');
  body.innerHTML = `<button class="x btn-ic" id="sheetX" aria-label="Close">${icon('close')}</button>${html}`;
  wrap.hidden = false;
  app.sheetOpen(true);
  $('sheetX').onclick = () => { app.sound('close'); closeSheet(app); };
  wrap.onclick = (e) => { if (e.target === wrap) closeSheet(app); };
  if (onOpen) onOpen(body);
}

export function closeSheet(app) {
  if ($('sheet').hidden) return;
  $('sheet').hidden = true;
  $('sheetBody').innerHTML = '';
  app.sheetOpen(false);
}

function toggles(app) {
  const s = app.meta.settings();
  const on = (b) => (b ? ' on' : '');
  return `<div class="toggles">
    <button class="toggle${on(!app.isMuted())}" id="muteBtn" aria-label="${app.isMuted() ? 'Unmute sound' : 'Mute sound'}">${icon(app.isMuted() ? 'mute' : 'sound')}Sound<i></i></button>
    <button class="toggle${on(s.music)}" id="musicBtn">${icon('music')}Music<i></i></button>
    <button class="toggle${on(s.haptics)}" id="hapticBtn">${icon('haptic')}Haptics<i></i></button>
    <button class="toggle${on(s.motion)}" id="motionBtn">${icon('bolt')}Motion<i></i></button>
    <button class="toggle${on(s.assist)}" id="assistBtn" style="grid-column:span 2">${icon('info')}Block symbols (color assist)<i></i></button>
  </div>`;
}

function wireToggles(app, rerender) {
  $('muteBtn').onclick = () => { app.toggleMute(); rerender(); };
  $('musicBtn').onclick = () => { app.setSetting('music', !app.meta.settings().music); rerender(); };
  $('hapticBtn').onclick = () => { app.setSetting('haptics', !app.meta.settings().haptics); rerender(); };
  $('motionBtn').onclick = () => { app.setSetting('motion', !app.meta.settings().motion); rerender(); };
  $('assistBtn').onclick = () => { app.setSetting('assist', !app.meta.settings().assist); rerender(); };
}

export function openPause(app) {
  const render = () => openSheet(app, `
    <h2 class="t">Paused</h2>
    <div class="stack">
      <button class="btn btn-green" id="resumeBtn">${icon('play')}<span class="t">Resume</span></button>
      <button class="btn btn-blue" id="restartBtn">${icon('retry')}<span class="t">Restart</span></button>
      <button class="btn btn-navy" id="pauseHome">${icon('home')}<span class="t">Tower map</span></button>
    </div>
    ${toggles(app)}
    <button class="btn btn-navy small" id="pauseHelp">${icon('book')}<span class="t">How to play</span></button>`, () => {
    $('resumeBtn').onclick = () => { app.sound('tap'); closeSheet(app); };
    $('restartBtn').onclick = () => { app.sound('tap'); closeSheet(app); app.restart(); };
    $('pauseHome').onclick = () => { app.sound('tap'); closeSheet(app); app.openHome(); };
    $('pauseHelp').onclick = () => { app.sound('tap'); openHelp(app, () => openPause(app)); };
    wireToggles(app, () => { closeSheet(app); render(); });
  });
  render();
}

export function openSettings(app) {
  const render = () => openSheet(app, `
    <h2 class="t">Settings</h2>
    ${toggles(app)}
    <button class="btn btn-navy small" id="setHelp">${icon('book')}<span class="t">How to play</span></button>
    <p class="note">Tumbledown · fonts: Lilita One and Nunito (SIL Open Font License) · all art and sound made in code.</p>`, () => {
    $('setHelp').onclick = () => { app.sound('tap'); openHelp(app, () => openSettings(app)); };
    wireToggles(app, () => { closeSheet(app); render(); });
  });
  render();
}

export function openHelp(app, back) {
  const rows = [
    ['play', 'Swipe left or right', 'to move the piece'],
    ['retry', 'Tap', 'to turn it'],
    ['back', 'Drag down', 'to drop faster'],
    ['bolt', 'Flick down', 'to slam (smashes glass)'],
    ['flame', 'Tap the power button', 'or swipe up when it glows'],
  ];
  openSheet(app, `<h2 class="t">How to play</h2>
    <div class="card" style="animation:none"><p class="lead">Put materials next to what cancels them. Whatever cancels drains away into the goal. Fill it before your pieces run out.</p>
    ${rows.map(([ic, a, b]) => `<div class="row">${icon(ic)}<span><b style="margin:0;font-size:17px">${a}</b> ${b}</span></div>`).join('')}</div>
    <button class="btn btn-green small" id="helpBack"><span class="t">Got it</span></button>`, () => {
    $('helpBack').onclick = () => { app.sound('tap'); closeSheet(app); if (back) back(); };
  });
}

export function openStoreStub(app, what) {
  openSheet(app, `<h2 class="t">${what}</h2>
    <div class="card" style="animation:none"><p class="lead">The store isn't connected in this build. When the game ships, this button opens the App Store or Google Play purchase sheet. No money is ever taken here.</p></div>
    <button class="btn btn-blue small" id="stubOk"><span class="t">OK</span></button>`, () => {
    $('stubOk').onclick = () => { app.sound('tap'); openShop(app); };
  });
}

export function openShop(app, focus) {
  const { meta } = app;
  const b = meta.boosters();
  const tile = (id) => {
    const c = previewTile(SKINS[id], 'wood', 88);
    return c.toDataURL();
  };
  openSheet(app, `
    <h2 class="t">Shop</h2>
    <div class="pill" style="align-self:center">${icon('coin')}<span class="t">${fmt(meta.coins())}</span></div>
    <div class="shop-sec">Coins</div>
    <div class="shop-grid">
      ${[[500, '$0.99'], [1200, '$1.99'], [3000, '$4.99']].map(([n, p], i) => `<button class="item" data-stub="${fmt(n)} coins">${i === 2 ? '<span class="ribbon-tag">Best value</span>' : ''}${icon('coin')}<b>${fmt(n)}</b><span class="price">${p}</span></button>`).join('')}
      <button class="item wide" data-stub="Starter pack"><span class="ribbon-tag">One time</span>${icon('gift')}<span class="grow"><b>Starter pack</b><br>2,000 coins + 5 of each booster</span><span class="price">$2.99</span></button>
      <button class="item wide" data-stub="Remove ads">${icon('ad')}<span class="grow"><b>Remove ads</b><br>No breaks between levels, ever</span><span class="price">$3.99</span></button>
    </div>
    <div class="shop-sec" id="secBoost">Boosters</div>
    <div class="shop-grid">
      ${Object.entries(BOOSTERS).map(([k, v]) => `<button class="item" data-boost="${k}">${icon(v.icon)}<b>${v.label}</b><small>Have ${b[k]}</small><span class="price">${icon('coin')}${v.price}</span></button>`).join('')}
    </div>
    <div class="shop-sec">Block skins</div>
    <div class="shop-grid">
      ${SKIN_ITEMS.map((s) => {
        const owned = meta.ownsSkin(s.id);
        const using = meta.skin() === s.id;
        return `<button class="item" data-skin="${s.id}"><img src="${tile(s.id)}" alt="" style="width:44px;height:44px"><b>${s.label}</b><span class="price${using ? ' using' : owned ? ' owned' : ''}">${using ? 'In use' : owned ? 'Use' : `${icon('coin')}${fmt(s.price)}`}</span></button>`;
      }).join('')}
    </div>
    <p class="note">Coins are earned by playing. Real-money items are placeholders until the store is connected.</p>`, (body) => {
    body.querySelectorAll('[data-stub]').forEach((el) => { el.onclick = () => { app.sound('tap'); openStoreStub(app, el.dataset.stub); }; });
    body.querySelectorAll('[data-boost]').forEach((el) => {
      el.onclick = () => {
        if (meta.buyBooster(el.dataset.boost)) { app.sound('coin'); app.toast(`${icon('check')} ${BOOSTERS[el.dataset.boost].label} added`); openShop(app, 'boosters'); app.refreshMap(); } else { app.sound('close'); app.toast(`${icon('coin')} Not enough coins yet`, 'navy'); }
      };
    });
    body.querySelectorAll('[data-skin]').forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.skin;
        if (!meta.ownsSkin(id) && !meta.buySkin(id)) { app.sound('close'); app.toast(`${icon('coin')} Not enough coins yet`, 'navy'); return; }
        meta.setSkin(id);
        app.sound('unlock');
        app.applySkin();
        openShop(app);
      };
    });
    if (focus === 'boosters') $('secBoost').scrollIntoView({ block: 'center' });
  });
}

const GIFT_ICON = (g) => (g.booster && !g.coins ? BOOSTERS[g.booster].icon : 'coin');
const GIFT_TEXT = (g) => [g.coins ? `${g.coins}` : '', g.booster ? `${g.n || 1}× ${BOOSTERS[g.booster].short}` : ''].filter(Boolean).join(' + ');

export function openRewards(app) {
  const { meta } = app;
  const r = meta.rewards();
  const at = r.step % DAILY_REWARDS.length;
  openSheet(app, `
    <h2 class="t">Daily gifts</h2>
    <div class="cal">${DAILY_REWARDS.map((g, i) => `<div class="day${i < at ? ' got' : ''}${i === at && r.ready ? ' today' : ''}${i === 6 ? ' big' : ''}"><span>Day ${i + 1}</span>${icon(GIFT_ICON(g))}<b>${GIFT_TEXT(g)}</b></div>`).join('')}</div>
    <button class="btn ${r.ready ? 'btn-green' : 'btn-navy'}" id="claimBtn" style="height:60px" ${r.ready ? '' : 'disabled'}><span class="t">${r.ready ? 'Claim' : 'Come back tomorrow'}</span></button>
    <p class="note">One gift a day. Miss a day and nothing resets.</p>`, () => {
    $('claimBtn').onclick = () => {
      const gift = meta.claimReward();
      if (!gift) return;
      app.sound('coin');
      app.celebrateGift(gift);
      app.toast(`${icon('gift')} ${GIFT_TEXT(gift)} claimed!`);
      openRewards(app);
      app.refreshMap();
    };
  });
}

const CODEX = [
  ['fire', 'Fire', 'Never goes out on its own. Water puts it out: both drain.', 1],
  ['water', 'Water', 'Douses fire, turns sand to mud, soaks wood, freezes next to ice.', 1],
  ['wood', 'Wood', 'Burns away next to fire. Soaked twice, it dissolves.', 3],
  ['wetwood', 'Wet wood', 'Steams, dries, then burns. Don\'t water wood you want to burn.', 3],
  ['sand', 'Sand', 'Water turns it to mud. Fire melts it into glass.', 4],
  ['mud', 'Mud', 'Sinks away on its own, or water washes it.', 4],
  ['glass', 'Glass', 'Slam a piece onto it, or drop stone, and the whole pane smashes.', 5],
  ['ice', 'Ice', 'Fire melts it. Water that touches it freezes.', 7],
  ['stone', 'Stone', 'Heavy: smashes glass even placed gently. Water wears it to sand.', 11],
  ['brick', 'Brick', 'Water wears it down into sand.', 13],
];

export function openCodex(app) {
  const best = app.best();
  const urls = {};
  for (const [m] of CODEX) urls[m] = previewTile(app.skin, m, 104).toDataURL();
  openSheet(app, `<h2 class="t">Blocks</h2>
    <div class="codex">${CODEX.map(([m, name, text, lvl]) => (best >= lvl
    ? `<div class="mat"><img src="${urls[m]}" alt="" style="width:52px;height:52px"><div><b>${name}</b><p>${text}</p></div></div>`
    : `<div class="mat locked"><span class="lk">${icon('lock')}</span><div><b>???</b><p>Discover it on level ${lvl}.</p></div></div>`)).join('')}
    <div class="shop-sec" style="margin-top:6px">Powers</div>
    ${Object.entries(POWERS).map(([k, p]) => `<div class="mat"><span class="lk" style="color:#2f74e8">${icon(POWER_ICON[k])}</span><div><b>${p.label}</b><p>Clears every ${p.clears.map((m) => CODEX.find((c) => c[0] === m)?.[1].toLowerCase() || m).join(', ')} block.</p></div></div>`).join('')}
    </div>`);
}

export { levelConfig };
