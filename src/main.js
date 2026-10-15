// The view: draws the session, plays the feedback and turns touches into inputs. All game
// and screen logic lives in session.js and core.js; the meta layer (stars, coins, boosters,
// gifts, skins) lives in meta.js. Rendering is in src/render/, screens in src/ui/.

import { pieceMats, landingY, piecesDrained, piecesLeft, reacts, COLS, GW, GH, S, altitude, TOTAL_LEVELS } from './core.js';
import { POWERS, questText, levelConfig, levelPreview } from './levels.js';
import {
  createSession, step, input, live, next, replay, watchRevive, watchMeterAd, meterAdAvailable, openHome,
  closeHome, startDaily, dismissCallout, winScreen, loseScreen, homeInfo, dailyReady, start, CELEBRATE_TIME,
  AD_TIME, playLog, clearPlayLog, playLogSummary,
} from './session.js';
import { questCount } from './core.js';
import { adsRemoved } from './ads.js';
import * as sound from './sound.js';
import { validate, createValidator } from './validate.js';
import { createBoardRenderer } from './render/board.js';
import { SKINS } from './render/skins.js';
import { previewTile } from './render/tiles.js';
import { paintWorld } from './render/world.js';
import { createSky } from './render/sky.js';
import { createFx } from './render/fx.js';
import { css } from './render/color.js';
import { icon, POWER_ICON, QUEST_ICON } from './ui/icons.js';
import { createMeta, starsFor, winCoins, BOOSTERS } from './meta.js';
import {
  buildMap, mapHud, openPause, openSettings, openShop, openRewards, openCodex, closeSheet, seedMapLevel,
} from './ui/screens.js';

const BRAND = 'Tumbledown';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const $ = (id) => document.getElementById(id);
const { play, unlock, isMuted, setMuted, initSound } = sound;
const call = (name, ...a) => (typeof sound[name] === 'function' ? sound[name](...a) : undefined);

// ---------- session and meta ----------

let storage = null;
try { storage = window.localStorage; } catch (e) { storage = null; }
const sess = createSession({ storage, adsRemoved });
const meta = createMeta(sess.store);
initSound(sess.store.get('mb_muted', false));
if (params.has('level')) start(sess, +params.get('level'));

let settings = meta.settings();
call('setMusic', settings.music);
call('setHaptics', settings.haptics);
document.body.classList.toggle('calm', !settings.motion);
const buzz = (p) => call('buzz', p);

// ---------- renderers ----------

const cv = $('cv');
let skin = SKINS[meta.skin()];
const PX_STAR = (cls) => `<svg class="pxstar ${cls}" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true"><path class="e" d="M5 0h1v2h1v2h4v1h-1v1h-1v1h1v3h-1v1h-1v-1h-1v-1h-3v1h-1v1h-1v-1h-1v-3h1v-1h-1v-1h-1v-1h4v-2h1z"/><path class="f" d="M5 1h1v2h1v2h3v1h-2v2h1v1h-1v-1h-1v-1h-3v1h-1v1h-1v-1h1v-2h-2v-1h3v-2h1z"/><path class="h" d="M5 2h1v2h-1zM3 5h1v1h-1z"/></svg>`;

// The interface is built from the game's own blocks: bake a few tiles once and hand them to the
// stylesheet as textures (--tex-stone, --tex-fire, ...). Always the Toybox tiles, so the chrome
// stays the same whichever block skin the player picks.
for (const m of ['stone', 'brick', 'wood', 'fire', 'ice', 'sand']) {
  document.documentElement.style.setProperty(`--tex-${m}`, `url(${previewTile(SKINS.toybox, m, 48).toDataURL()})`);
}
const board = createBoardRenderer(cv, skin);
const fx = createFx($('fxc'));
fx.motion = settings.motion;
const worldCv = $('world');
const wctx = worldCv.getContext('2d');
const sky = createSky($('sky'));

const POWER_STYLE = {
  rain: { pc: '#8fd0ff', pc2: '#3f9cff', pc3: '#1c5fc8', word: 'aqua' },
  blaze: { pc: '#ffd27a', pc2: '#ff7a1c', pc3: '#c2360c', word: 'gold' },
  freeze: { pc: '#b8f6ff', pc2: '#2bb8f2', pc3: '#1677c8', word: 'aqua' },
  sweep: { pc: '#ffe6a3', pc2: '#f3b84a', pc3: '#b07a1e', word: 'gold' },
  hammer: { pc: '#f0f2f8', pc2: '#9aa3b8', pc3: '#5f6573', word: 'white' },
};
const QUEST_SHORT = {
  chain: (n) => `Hit a ×${n} combo`,
  douse: (n) => `Put out ${n} fires`,
  smash: (n) => `Smash ${n} panes`,
  burn: (n) => `Burn ${n} planks`,
  melt: (n) => `Melt ${n} ice cubes`,
};
const PRAISE = { 2: ['Nice!', 'gold'], 3: ['Great!', 'gold'], 4: ['Amazing!', 'gold'] };
const GOAL_COLOR = '#5fe0ff';
// Drained material flies to the goal as a glowing orb in a bright version of its own color.
const orbOf = (m) => { const c = skin.mats[m] || skin.mats.water; return { color: css(c.light ? c.light : c.base), edge: css(c.base) }; };
// The first-time callouts, rewritten as one short line with a gesture to copy.
const CALLOUTS = {
  1: ['Drop <em>water</em> on the <em>fire</em>', ['water', 'fire'], 'slam'],
  3: ['<em>Fire</em> burns <em>wood</em>', ['fire', 'wood'], 'swipe'],
  4: ['<em>Water</em> turns <em>sand</em> to mud', ['water', 'sand'], 'swipe'],
  5: ['Flick down to <em>smash</em> glass', ['glass'], 'slam'],
  6: ['<em>Fire</em> melts <em>sand</em> into glass', ['fire', 'sand'], 'swipe'],
  7: ['<em>Fire</em> melts <em>ice</em>. Water freezes!', ['fire', 'ice'], 'swipe'],
  8: ['Tap to <em>turn</em> two-part pieces', ['wood', 'ice'], 'tap'],
  10: ['Full meter? <em>Tap the power!</em>', [], 'up'],
  11: ['<em>Stone</em> smashes glass', ['stone', 'glass'], 'slam'],
  12: ['<em>Flood!</em> Soak up the water', ['fire', 'sand'], 'swipe'],
  13: ['<em>Water</em> wears <em>brick</em> away', ['water', 'brick'], 'swipe'],
  15: ['Drop <em>stone</em> on the tower!', ['stone', 'glass'], 'slam'],
  20: ['Melt the <em>glacier</em>, then freeze it!', ['fire', 'ice'], 'up'],
};

// ---------- view state ----------

const view = {
  paused: false, // a sheet is open over the game
  intro: 0, // seconds left on the level intro card
  hitstop: 0,
  shake: 0,
  pieceX: null,
  lastPiece: null,
  shown: 0, // drained count shown on the goal (catches up as the flights land)
  lastDrained: 0,
  recent: [], // recent reaction points [x, y, color, time] that drains fly from
  stars: 0,
  coins: 0,
  first: false,
  lastWorld: '',
  fromMap: false,
};
const selected = new Set(); // boosters picked on the map for the next fresh level
let lastHud = '';
let lastOverlay = '';
let shownGame = null;
let lastNext = '';
const game = () => sess.game;

// ---------- layout ----------

// Dynamic resolution: start at full sharpness, step the board and effects down if frames
// run slow on this device (software-rendered canvas, old phones), never back up mid-session.
const QUALITY = [1, 1.5, 2];
let quality = 2;
let drawEma = 0;
let emaFrames = 0;
const pixelRatio = () => Math.min(QUALITY[quality], window.devicePixelRatio || 1);

function fit() {
  const landscape = innerWidth > innerHeight;
  const ww = $('wellwrap').getBoundingClientRect();
  const availW = landscape ? Math.min(innerWidth * 0.46, 620) : ww.width;
  const availH = landscape ? innerHeight - 40 : ww.height;
  const { w, h } = board.resize(availW - 28, availH - 34, pixelRatio());
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  fx.resize(Math.min(1.5, pixelRatio()));
  paintWorldNow();
  const nx = $('nx');
  const d = Math.min(2, window.devicePixelRatio || 1);
  nx.width = Math.round(64 * d);
  nx.height = Math.round(34 * d);
  lastNext = '';
  const wr = $('well').getBoundingClientRect();
  document.documentElement.style.setProperty('--well-top', `${Math.max(12, Math.round(wr.top))}px`);
  // Resizing clears the canvas: draw straight away so no blank frame is ever shown.
  if (typeof drawBoard === 'function' && sess.game) drawBoard(performance.now(), 0);
}

function paintWorldNow(force = false) {
  const level = sess.daily ? game().level : sess.level;
  const alt = altitude(Math.min(TOTAL_LEVELS, level));
  const key = `${alt}:${innerWidth}x${innerHeight}`;
  if (!force && key === view.lastWorld) return;
  view.lastWorld = key;
  const d = Math.min(quality ? 1.5 : 1, window.devicePixelRatio || 1);
  worldCv.width = Math.round(innerWidth * d);
  worldCv.height = Math.round(innerHeight * d);
  paintWorld(wctx, worldCv.width, worldCv.height, alt, 'quarry');
  sky.resize(innerWidth, innerHeight);
  sky.setAlt(alt);
  // The backdrop never animates, so it becomes the page background rather than a canvas
  // layer the compositor has to blend every frame.
  document.body.style.backgroundImage = `url(${worldCv.toDataURL('image/jpeg', 0.9)})`;
}

// Board particle coordinates to screen (CSS px).
// Read once per frame: layout reads after style writes would force a reflow per event.
let boxCache = null;
function boardBox() {
  if (boxCache) return boxCache;
  const r = cv.getBoundingClientRect();
  boxCache = { x: r.left + cv.clientLeft, y: r.top + cv.clientTop, w: cv.clientWidth, h: cv.clientHeight };
  return boxCache;
}
let goalCache = null;
const toScreen = (px, py, b = boardBox()) => [b.x + (px / GW) * b.w, b.y + (py / GH) * b.h];
const goalPoint = () => {
  if (goalCache) return goalCache;
  const r = $('goalIc').getBoundingClientRect();
  goalCache = [r.left + r.width / 2, r.top + r.height / 2];
  return goalCache;
};
const matColor = (m) => css(skin.mats[m]?.base || [255, 255, 255]);
const b2 = () => boardBox();

// ---------- feedback ----------

function remember(px, py, m) {
  const [x, y] = toScreen(px, py);
  view.recent.push([x, y, m, performance.now()]);
  if (view.recent.length > 16) view.recent.shift();
}

function shakeWell(n) {
  if (!settings.motion) return;
  view.shake = Math.max(view.shake, n);
}

function handleEvents() {
  for (const e of sess.events) {
    if (DEBUG && eventLog.length < 5000 && e.type !== 'steam' && e.type !== 'burn') eventLog.push({ t: performance.now(), type: e.type, mult: e.mult, slam: e.slam, power: e.power });
    const now = performance.now();
    if (e.type === 'combo') {
      const [txt, style] = PRAISE[Math.min(4, e.mult)] || PRAISE[4];
      const b = boardBox();
      const bonus = `×${e.mult} combo!`;
      fx.word(txt, b.x + b.w / 2, b.y + b.h * 0.44, { size: 46 + e.mult * 6, style, sub: bonus, slot: 'praise' });
      shakeWell(3 + e.mult * 2);
      play('combo', e);
      buzz(15 * e.mult);
    } else if (e.type === 'shatter') {
      let sx = 0;
      let sy = 0;
      for (const [x, y] of e.cells) { sx += x; sy += y; }
      const n = e.cells.length || 1;
      const [x, y] = toScreen(sx / n + 0.5, sy / n + 0.5);
      fx.shards(x, y, 34, Math.min(60, Math.sqrt(n) * 3));
      fx.ring(x, y, '#e8fdff', 80);
      fx.flash('#e8fdff', 0.16, 0.35);
      fx.word('SMASH!', b2().x + b2().w / 2, b2().y + b2().h * 0.44, { size: 52, style: 'gold', life: 0.9, slot: 'praise' });
      remember(sx / n, sy / n, 'glass');
      shakeWell(12);
      view.hitstop = Math.max(view.hitstop, 0.08);
      play('shatter');
      buzz([30, 20, 40]);
    } else if (e.type === 'steam') {
      // The steam itself is drawn by the board (one trace per cancelled particle, in place).
      remember(e.x, e.y, 'fire');
      play('steam');
    } else if (e.type === 'burn') {
      const [x, y] = toScreen(e.x + 0.5, e.y);
      fx.sparks(x, y, 2);
      remember(e.x, e.y, 'wood');
      play('burn');
    } else if (e.type === 'land') {
      landed(e);
    } else if (e.type === 'power') {
      firePower(e);
    } else if (e.type === 'quest') {
      toast(`${icon('check')} Quest done! Power +30%`);
      play('quest');
      const q = $('quest').getBoundingClientRect();
      fx.ring(q.left + q.width / 2, q.top + q.height / 2, '#b6ff7a', 70);
    } else if (e.type === 'win') {
      celebrate();
    } else if (e.type === 'callout') {
      play('callout');
    } else if (e.type === 'lose') {
      $('well').classList.add('lost');
      play('lose');
      buzz([60, 40, 60]);
    } else if (e.type === 'start') {
      onStart();
    }
  }
  sess.events.length = 0;
}

function landed(e) {
  const p = view.lastPiece;
  const b = boardBox();
  let x0 = Infinity;
  let x1 = -Infinity;
  let bottom = 0;
  if (p && p.cells.length === e.cells.length) {
    const y = e.cells[0][1] - p.cells[0][1];
    for (const [a, bb] of p.cells) {
      x0 = Math.min(x0, (p.x + a) * S);
      x1 = Math.max(x1, (p.x + a + 1) * S);
      bottom = Math.max(bottom, y + (bb + 1) * S);
    }
  } else {
    for (const [cx] of e.cells) { x0 = Math.min(x0, cx * S); x1 = Math.max(x1, (cx + 1) * S); }
    bottom = GH;
  }
  const [sx0, sy] = toScreen(x0, bottom, b);
  const [sx1] = toScreen(x1, bottom, b);
  if (e.slam) {
    // Slamming into something it reacts with: the reaction is the show, so no dust cloud or
    // impact ring over it. The shake, hit-stop and thud stay.
    if (!view.reactiveLanding) {
      fx.dust((sx0 + sx1) / 2, sy, 14);
      fx.ring((sx0 + sx1) / 2, sy, 'rgba(255,255,255,.9)', 50);
    }
    shakeWell(9);
    view.hitstop = Math.max(view.hitstop, 0.05);
    play('slam');
    buzz(25);
  } else {
    fx.dust(sx0 + 4, sy, 3);
    fx.dust(sx1 - 4, sy, 3);
    play('land');
  }
}

function firePower(e) {
  const st = POWER_STYLE[e.power] || POWER_STYLE.rain;
  const b = boardBox();
  fx.flash(st.pc, 0.55, 0.5);
  fx.word(`${POWERS[e.power].label}!`, b.x + b.w / 2, b.y + b.h * 0.44, { size: 54, style: 'gold', life: 1.4, sub: `+${Math.floor(e.points / 64)} blocks`, slot: 'praise' });
  dismissCallout(sess);
  const step = Math.max(1, Math.floor(e.cells.length / 36));
  const [gx, gy] = goalPoint();
  for (let i = 0, k = 0; i < e.cells.length; i += step, k++) {
    const [px, py, m] = e.cells[i];
    const [x, y] = toScreen(px + 0.5, py + 0.5, b);
    fx.cubes(x, y, [matColor(m)], 1, 220, 7);
    if (k % 3 === 0) { const orb = orbOf(m); fx.flight(x, y, gx, gy, { color: orb.color, edge: orb.edge, delay: 0.25 + k * 0.02, dur: 0.6 }); }
  }
  shakeWell(16);
  view.hitstop = Math.max(view.hitstop, 0.12);
  play('power', e);
  buzz([40, 30, 80]);
}

// Everything left on the board bursts into voxel debris, then the stars are worked out.
function celebrate() {
  const g = game();
  const b = boardBox();
  const k = Math.max(1, Math.floor(GW * GH / 900));
  let n = 0;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const c = g.grid[y][x];
      if (!c) continue;
      if (n++ % (k * 4) === 0) {
        const [sx, sy] = toScreen(x + 0.5, y + 0.5, b);
        fx.cubes(sx, sy, [matColor(c.m)], 1, 320, 9);
      }
      g.grid[y][x] = null;
    }
  }
  fx.confetti(140, ['#ffc83a', '#45c41e', '#2f8cff', '#ff6b5a', '#ff9ad8', '#8ff0ff']);
  fx.flash('#fff6c8', 0.4, 0.45);
  const left = piecesLeft(g);
  const leftNum = Number.isFinite(left) ? left : 0;
  view.stars = starsFor(leftNum, g.cfg.pieces);
  if (sess.daily) {
    view.first = false;
  } else {
    const r = meta.recordStars(sess.level, view.stars);
    view.first = r.first;
  }
  view.coins = winCoins({ stars: view.stars, first: view.first, daily: sess.daily });
  meta.addCoins(view.coins);
  view.shown = piecesDrained(g);
  fx.word('CLEARED!', b.x + b.w / 2, b.y + b.h * 0.38, { size: 64, style: 'gold', life: 1.8, slot: 'praise', sub: leftNum ? `${leftNum} piece${leftNum === 1 ? '' : 's'} to spare!` : '' });
  shakeWell(10);
  play('win');
  buzz([30, 30, 30, 30, 80]);
  call('setIntensity', 1);
}

function onStart() {
  endIntro();
  fx.clear();
  view.lastDrained = 0;
  view.shown = 0;
  view.pieceX = null;
  view.recent = [];
  lastHud = '';
  lastNext = '';
  $('well').classList.remove('lost');
  $('vignette').classList.remove('on');
  paintWorldNow();
  call('setMusicMood', sess.home ? 'map' : 'play');
  call('setIntensity', 0.2);
  if (sess.callout) play('callout');
}

// ---------- toast and intro ----------

function toast(html, tone = 'green') {
  const t = $('toast');
  t.innerHTML = html;
  t.style.background = tone === 'navy' ? 'linear-gradient(180deg, var(--navy-hi), var(--navy))' : '';
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}

function showIntro(boosts) {
  const g = game();
  const cfg = g.cfg;
  const chips = [
    `<span class="chip">${icon('flask')}Goal ${cfg.goal.pieces}</span>`,
    `<span class="chip">${icon('pieces')}${piecesLeft(g)} pieces</span>`,
    `<span class="chip">${icon(POWER_ICON[cfg.power])}${POWERS[cfg.power].label}</span>`,
  ];
  const boostChips = boosts.map((k) => `<span class="chip" style="background:var(--green)">${icon(BOOSTERS[k].icon)}${BOOSTERS[k].label}</span>`).join('');
  $('intro').innerHTML = `<div class="intro-card panel"><span class="t big">Level ${sess.level}</span><div class="chips">${chips.join('')}</div>${boostChips ? `<div class="chips">${boostChips}</div>` : ''}</div>`;
  $('intro').hidden = false;
  view.intro = 1.7;
  play('whoosh');
}

// ---------- overlays ----------

function setBtn(id, html, fn, cls) {
  const el = $(id);
  el.hidden = !html;
  if (!html) return;
  el.innerHTML = html;
  if (cls) el.className = cls;
  el.onclick = () => { unlock(); play('tap'); fn(); };
}

function overlays() {
  const key = [sess.phase, sess.home, sess.ad && sess.ad.kind, sess.game.revived, game() === shownGame].join('|');
  const adEl = $('ad');
  if (sess.ad) {
    adEl.hidden = false;
    const k = sess.ad.kind;
    adEl.querySelector('.ad-label').innerHTML = k === 'interstitial' ? 'Ad break' : k === 'revive' ? 'Your reward is coming' : 'Charging your power';
    adEl.querySelector('.ad-count').textContent = String(Math.max(1, Math.ceil(sess.ad.left)));
    $('adRing').style.strokeDashoffset = String(314.16 * Math.max(0, sess.ad.left / AD_TIME));
  } else {
    adEl.hidden = true;
  }
  if (key === lastOverlay) return;
  lastOverlay = key;
  shownGame = game();
  if (sess.home || sess.phase !== 'play' || sess.ad) closeSheet(app);

  $('home').hidden = !sess.home;
  if (sess.home) {
    buildMap(app);
    mapHud(app);
    call('setMusicMood', 'map');
    if (params.has('playtest')) showPlaytest();
  } else if (sess.phase === 'play') {
    call('setMusicMood', 'play');
  }

  const over = $('over');
  document.body.classList.toggle('ov-win', sess.phase === 'won');
  document.body.classList.toggle('ov-lose', sess.phase === 'lost');
  if (sess.phase === 'won') {
    const w = winScreen(sess);
    over.className = `over win${sess.daily ? ' daily' : ''}`;
    $('ovT').textContent = w.title;
    $('ovSub').textContent = sess.daily ? w.sub : `Level ${sess.level}`;
    $('ovRing').hidden = true;
    $('ovStars').innerHTML = sess.daily ? '' : [1, 2, 3].map((k) => PX_STAR(k <= view.stars ? 'on' : '')).join('');
    $('ovStars').querySelectorAll('.on').forEach((el, i) => { el.style.animationDelay = `${0.35 + i * 0.32}s`; });
    for (let i = 0; i < (sess.daily ? 0 : view.stars); i++) {
      // Each star lands like a gold block: the sound and dust come at the moment of impact.
      setTimeout(() => {
        play('star', { n: i + 1 }); buzz(20);
        const el = $('ovStars').children[i];
        if (el) { const r = el.getBoundingClientRect(); fx.dust(r.left + r.width / 2, r.bottom - 6, 6, true); }
      }, 350 + i * 320 + 280);
    }
    const g = game();
    $('ovS').innerHTML = `
      <div class="row">${icon('flask')}<span>Drained</span><b>${w.drained} / ${g.cfg.goal.pieces}</b></div>
      <div class="row">${icon('pieces')}<span>Pieces left</span><b>${Math.max(0, piecesLeft(g) || 0)}</b></div>
      <div class="row reward">${icon('coin')}<span>Reward</span><b>+${view.coins}</b></div>`;
    const nextLevel = sess.daily ? null : sess.level >= TOTAL_LEVELS ? 1 : sess.level + 1;
    const newMat = nextLevel ? introducedMat(nextLevel) : null;
    $('ovN').innerHTML = sess.daily ? `<div><b>${w.next}</b></div>` : `${newMat ? '<span class="nu-tile"><canvas id="ovNc" width="60" height="60"></canvas><i>New</i></span>' : ''}<div><b>Next up: level ${nextLevel}</b>${shortPreview(nextLevel)}</div>`;
    if (newMat) $('ovNc').getContext('2d').drawImage(previewTile(skin, newMat, 60), 0, 0);
    setBtn('ovA', `<span class="t">${sess.daily ? 'Continue' : sess.level >= TOTAL_LEVELS ? 'Play again' : 'Continue'}</span>`, () => next(sess), 'btn btn-green big');
    setBtn('ovB', icon('retry'), () => replay(sess), 'btn btn-blue sq');
    $('ovB').setAttribute('aria-label', 'Replay level');
    setBtn('ovC', w.dailyReady && !sess.daily ? `${icon('calendar')}<span>Daily challenge ready</span>` : '', () => startDaily(sess), 'btn btn-navy wide');
    over.hidden = false;
    // Coins fly from the reward row to the top of the screen.
    setTimeout(() => {
      const r = $('ovS').querySelector('.reward');
      if (!r || $('over').hidden) return;
      const rr = r.getBoundingClientRect();
      for (let i = 0; i < Math.min(12, 3 + Math.floor(view.coins / 8)); i++) fx.flight(rr.left + 30, rr.top + rr.height / 2, innerWidth / 2, 20, { kind: 'coin', delay: i * 0.06, dur: 0.7, onArrive: i % 3 ? null : () => play('coin') });
    }, 1300);
  } else if (sess.phase === 'lost') {
    const l = loseScreen(sess);
    over.className = 'over lose';
    $('ovT').textContent = l.title;
    $('ovSub').textContent = '';
    $('ovStars').innerHTML = '';
    $('ovRing').hidden = false;
    const toGo = Math.max(1, game().cfg.goal.pieces - piecesDrained(game()));
    $('ovPct').innerHTML = `${toGo}<small>to go</small>`;
    $('ovRingFg').style.strokeDashoffset = '314.16';
    requestAnimationFrame(() => requestAnimationFrame(() => { $('ovRingFg').style.strokeDashoffset = String(314.16 * (1 - l.pct / 100)); }));
    $('ovS').innerHTML = `<p class="lead">${l.canRevive ? `${l.outOfPieces ? 'Out of pieces! Grab 5 more and finish it.' : 'The board filled up! Clear the top rows and keep going.'}` : l.sub}</p>`;
    $('ovN').innerHTML = l.help ? `${icon('gift')}<div><b>Helping hand</b>Next try: extra fire and water in every bag.</div>` : '';
    if (l.canRevive) {
      setBtn('ovA', `<span class="t">${l.outOfPieces ? '+5 Pieces' : 'Clear top rows'}</span><small class="adtag">${icon('ad')} Watch an ad</small>`, () => watchRevive(sess), 'btn btn-green big');
      setBtn('ovB', icon('retry'), () => replay(sess), 'btn btn-blue sq');
    } else {
      $('ovA').hidden = true;
      setBtn('ovB', '<span class="t">Try again</span>', () => replay(sess), 'btn btn-green big');
    }
    $('ovB').setAttribute('aria-label', 'Try again');
    setBtn('ovC', '<span>Give up</span>', () => { replay(sess); openHome(sess); }, 'btn-link');
    over.hidden = false;
  } else {
    over.hidden = true;
  }
}

// The material a level introduces, for the win screen's "next up" tile.
const INTRO_MAT = { 3: 'wood', 4: 'sand', 5: 'glass', 7: 'ice', 11: 'stone', 13: 'brick' };
const introducedMat = (l) => INTRO_MAT[l] || null;
function shortPreview(l) {
  if (CALLOUTS[l]) return CALLOUTS[l][0].replace(/<\/?em>/g, '') + '.';
  const c = levelConfig(l);
  if (c.mode === 'flood') return 'Flood: the water keeps rising.';
  if (c.mode === 'prefill') return 'Burn through a wooden wall.';
  if (c.showcase) return 'Showcase floor: big set piece, power half charged.';
  return levelPreview(l);
}

function showPlaytest() {
  const p = playLogSummary(playLog(sess));
  const f = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);
  const band = (b) => (b ? `${f(b.firstTry)} of ${b.n}` : '–');
  $('playtest').hidden = false;
  $('playtestSummary').textContent = [
    `Attempts: ${p.attempts}, levels tried: ${p.levels}`,
    `Won first try, levels 1-20: ${band(p.early)}`,
    `Won first try, levels 21-60: ${band(p.mid)}`,
    `Won first try, levels 61-100: ${band(p.late)}`,
    `Losses that were close (80%+): ${f(p.closeLosses)}`,
    `Longest no-drain gap (median): ${p.medianGap ?? '–'} s`,
    `First drain (median): ${p.medianFirstDrain ?? '–'} s`,
    `Powers per attempt: ${p.powersPerAttempt === null ? '–' : p.powersPerAttempt.toFixed(2)}`,
  ].join('\n');
}
$('playtestCopy').onclick = () => {
  const text = JSON.stringify(playLog(sess));
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  $('playtestSummary').textContent += `\n\nCopied ${playLog(sess).length} attempts.`;
};
$('playtestClear').onclick = () => { clearPlayLog(sess); showPlaytest(); };

// ---------- HUD ----------

// Every piece is named somewhere on screen, so ice and glass (or sand and wood) never have to be
// told apart by color alone: the falling piece in the "Now" tag, the next one under its preview.
const MAT_NAME = { fire: 'Fire', water: 'Water', wood: 'Wood', wetwood: 'Wet wood', ice: 'Ice', sand: 'Sand', glass: 'Glass', stone: 'Stone', brick: 'Brick', mud: 'Mud' };
const pieceName = (mats) => [...new Set(mats)].map((m) => MAT_NAME[m] || m).join(' + ');
let lastNow = '';
function drawNow() {
  const p = game().piece;
  const name = p ? pieceName(pieceMats(p)) : '';
  if (name === lastNow) return;
  lastNow = name;
  $('nowName').textContent = name;
  $('nowTag').hidden = !name;
}

function drawNext() {
  drawNow();
  const g = game();
  if (!g.next) return;
  const key = `${g.next.mats.join()}|${g.next.shape.flat().join()}|${skin.id}`;
  if (key === lastNext) return;
  const changed = lastNext !== '';
  lastNext = key;
  const nx = $('nx');
  const c = nx.getContext('2d');
  c.clearRect(0, 0, nx.width, nx.height);
  const { shape, mats } = g.next;
  const w = Math.max(...shape.map(([a]) => a)) + 1;
  const h = Math.max(...shape.map(([, b]) => b)) + 1;
  const s = Math.floor(Math.min(nx.width / w, nx.height / h, nx.height / 2));
  const ox = (nx.width - w * s) / 2;
  const oy = (nx.height - h * s) / 2;
  shape.forEach(([a, b], i) => c.drawImage(previewTile(skin, mats[i], s, (a + b) % 3), ox + a * s, oy + b * s));
  $('nxName').textContent = pieceName(mats);
  if (changed) { nx.classList.remove('pop'); void nx.offsetWidth; nx.classList.add('pop'); }
}

function spawnFlights(n) {
  const g = game();
  const [gx, gy] = goalPoint();
  const b = boardBox();
  const now = performance.now();
  const pts = view.recent.filter((p) => now - p[3] < 1500);
  for (let i = 0; i < n; i++) {
    const p = pts.length ? pts[(pts.length - 1 - (i % pts.length))] : [b.x + b.w / 2, b.y + b.h * 0.8, 'water'];
    const orb = orbOf(p[2]);
    for (let k = 0; k < 1; k++) {
      fx.flight(p[0] + (Math.random() - 0.5) * 30, p[1] + (Math.random() - 0.5) * 30, gx, gy, {
        color: orb.color, edge: orb.edge, delay: i * 0.09, dur: 0.5 + Math.random() * 0.15, size: 11,
        onArrive: k ? null : () => {
          view.shown = Math.min(piecesDrained(g), view.shown + 1);
          lastHud = '';
          const ic = $('goalIc');
          ic.classList.remove('hit'); void ic.offsetWidth; ic.classList.add('hit');
          play('drain', { mult: g.mult, step: view.shown });
          fx.ring(gx, gy, '#8ff0ff', 34);
        },
      });
    }
  }
}

function hud() {
  const g = game();
  const cfg = g.cfg;
  const drained = piecesDrained(g);
  // A jump of more than a few pieces at once is a scene or showcase being set up, not play.
  if (drained > view.lastDrained && sess.phase === 'play') {
    if (drained - view.lastDrained > 8) view.shown = drained;
    else spawnFlights(drained - view.lastDrained);
  }
  if (drained < view.lastDrained) view.shown = drained;
  view.lastDrained = drained;
  const qn = questCount(g);
  const meterAd = meterAdAvailable(sess);
  const left = piecesLeft(g);
  const full = g.meter >= 1 && sess.phase === 'play';
  const key = [sess.level, sess.daily, view.shown, left, g.settling !== null, g.meter.toFixed(2), g.questDone, qn, sess.phase, meterAd, skin.id].join('|');
  drawNext();
  if (key === lastHud) return;
  const wasFull = $('powerBtn').classList.contains('ready');
  lastHud = key;
  const goal = cfg.goal.pieces;
  $('lvl').textContent = sess.daily ? 'Daily' : `Level ${sess.level}`;
  $('lvl').classList.toggle('daily', sess.daily);
  $('drainNum').textContent = String(Math.min(view.shown, goal));
  $('drainGoal').textContent = `/${goal}`;
  $('drainBar').style.width = `${Math.min(1, view.shown / goal) * 100}%`;
  call('setIntensity', 0.2 + 0.8 * Math.min(1, view.shown / goal));
  const shownLeft = g.settling !== null ? 0 : left;
  $('left').textContent = Number.isFinite(shownLeft) ? String(shownLeft) : '∞';
  const low = Number.isFinite(left) && left <= 3 && sess.phase === 'play';
  if (low && !$('moves').classList.contains('low')) play('heartbeat');
  $('moves').classList.toggle('low', low);
  $('vignette').classList.toggle('on', Number.isFinite(left) && left <= 1 && sess.phase === 'play' && g.settling === null);

  const pw = POWER_STYLE[cfg.power] || POWER_STYLE.rain;
  const btn = $('powerBtn');
  btn.style.setProperty('--charge', String(Math.min(1, g.meter)));
  btn.style.setProperty('--pc', pw.pc);
  btn.style.setProperty('--pc2', pw.pc2);
  btn.style.setProperty('--pc3', pw.pc3);
  btn.classList.toggle('ready', full);
  if (full && !wasFull) { play('ready'); buzz(30); }
  $('powerIc').innerHTML = icon(POWER_ICON[cfg.power] || 'bolt');
  $('meterLabel').textContent = full ? 'Ready!' : POWERS[cfg.power].label.replace('Deep ', '').replace(' Mode', '');
  btn.setAttribute('aria-label', `${POWERS[cfg.power].label}${full ? ' ready: tap to use' : ''}`);
  const ad = $('meterAd');
  ad.hidden = !meterAd;
  if (meterAd) ad.innerHTML = `${icon('ad')}Fill`;

  const q = cfg.quest;
  const done = g.questDone;
  const n = Math.min(qn, q.n);
  $('quest').className = `quest panel${done ? ' done' : ''}`;
  $('quest').dataset.q = q.type;
  $('quest').innerHTML = `<span class="q-ic">${icon(done ? 'check' : QUEST_ICON[q.type] || 'target')}</span><div class="q-body"><span class="q-text t">${done ? 'Quest done!' : QUEST_SHORT[q.type](q.n)}</span><div class="q-row"><div class="q-bar"><i style="width:${(done ? 1 : n / q.n) * 100}%"></i></div><span class="q-n">${done ? '+Power' : `${n}/${q.n}`}</span></div></div>`;
  $('quest').setAttribute('aria-label', `Side quest: ${questText(q)}, ${n} of ${q.n}`);

  const notes = [];
  if (cfg.help) notes.push([icon('gift'), 'Helping hand']);
  if (cfg.mode === 'flood') notes.push([icon('drop'), 'Flood: water keeps rising']);
  if (cfg.mode === 'prefill') notes.push([icon('flame'), 'Burn the wall']);
  if (sess.daily) notes.push([icon('calendar'), 'Same board for everyone today']);
  $('banner').innerHTML = notes.map(([i, t]) => `${i}<span>${t}</span>`).join(' · ');
  $('banner').hidden = notes.length === 0;
}

function calloutView() {
  const el = $('callout');
  const c = sess.callout;
  if (!c || sess.home || sess.phase !== 'play' || view.intro > 0) { el.hidden = true; return; }
  el.hidden = false;
  if (el.dataset.text !== c.text) {
    el.dataset.text = c.text;
    const power = /ready/i.test(c.text);
    const entry = power ? [`${POWERS[game().cfg.power].label} ready! <em>Tap it</em>`, [], 'up'] : CALLOUTS[sess.level];
    if (entry) {
      const [text, mats, g] = entry;
      const tiles = mats.map((m) => `<canvas data-m="${m}" width="68" height="68"></canvas>`).join(icon('plus'));
      el.innerHTML = `<span class="hand g-${g}">${icon('hand')}</span><span class="co-text">${text}</span>${tiles ? `<span class="co-mats">${tiles}</span>` : ''}<small>Tap to hide</small>`;
      el.querySelectorAll('canvas').forEach((cn) => cn.getContext('2d').drawImage(previewTile(skin, cn.dataset.m, 68), 0, 0));
    } else {
      el.innerHTML = `<span class="co-text">${c.text}</span><small>Tap to hide</small>`;
    }
  }
  el.style.opacity = String(Math.min(1, c.left / 0.4));
}

// ---------- the app object the screens talk to ----------

const app = {
  sess, meta, selected,
  get skin() { return skin; },
  sound: (n) => play(n),
  toast,
  best: () => Math.max(sess.level, sess.store.get('mb_best', 1)),
  homeInfo: () => homeInfo(sess),
  freshGame: () => {
    const g = game();
    return sess.phase === 'play' && g.drained === 0 && !g.revived && Number.isFinite(g.left) && g.left === g.cfg.pieces - 1;
  },
  playFromMap() {
    unlock();
    const fresh = app.freshGame() && !sess.daily;
    const used = [];
    if (fresh) {
      for (const k of selected) if (meta.useBooster(k)) used.push(k);
      const g = game();
      if (used.includes('plus3')) g.left += 3;
      if (used.includes('head')) g.meter = Math.max(g.meter, 0.5);
      selected.clear();
    }
    closeHome(sess);
    fit();
    if (fresh) showIntro(used);
  },
  openHome() { openHome(sess); },
  restart() { start(sess, sess.level, { daily: sess.daily }); },
  sheetOpen(v) { view.paused = v; if (v) play('open'); },
  // Menus are stone slabs: they land with a thud and break up when closed.
  slabLanded(r) { fx.dust(r.left + r.width * 0.25, r.bottom, 5, true); fx.dust(r.left + r.width * 0.75, r.bottom, 5, true); play('slab'); buzz(12); },
  crumble(r, n = 34) { if (r.width) { fx.rubble(r.left, r.top, r.width, r.height, ['#8f96a4', '#6e7480', '#b4bac6', '#a87a4a'], n, 14); play('crumble'); } },
  breakCrate(r) { fx.rubble(r.left, r.top, r.width, r.height, ['#c98a4b', '#8a5528', '#eab275', '#ffcf3a'], 22, 11); fx.dust(r.left + r.width / 2, r.bottom, 5, true); play('crate'); buzz([15, 30, 20]); },
  thud(r) { fx.dust(r.left + r.width / 2, r.bottom, 6, true); play('slab'); buzz(15); },
  isMuted: () => isMuted(),
  toggleMute() {
    unlock();
    setMuted(!isMuted());
    sess.store.set('mb_muted', isMuted());
    play('tap');
  },
  setSetting(k, v) {
    meta.set(k, v);
    settings = meta.settings();
    if (k === 'music') call('setMusic', v);
    if (k === 'haptics') { call('setHaptics', v); buzz(20); }
    if (k === 'motion') { document.body.classList.toggle('calm', !v); fx.motion = v; }
    play('tap');
  },
  refreshMap() { if (sess.home) mapHud(app); },
  applySkin() {
    skin = SKINS[meta.skin()];
    board.setSkin(skin);
    fit();
    lastNext = '';
    if (sess.home) buildMap(app);
  },
  celebrateGift() {
    fx.confetti(60, ['#ffc83a', '#ff9ad8', '#8ff0ff', '#45c41e']);
    const c = $('coinPill').getBoundingClientRect();
    for (let i = 0; i < 8; i++) fx.flight(innerWidth / 2, innerHeight / 2, c.left + 20, c.top + c.height / 2, { kind: 'coin', delay: i * 0.05, dur: 0.6, onArrive: () => mapHud(app) });
  },
};

// ---------- buttons ----------

$('homeBtn').innerHTML = icon('pause');
$('goalIc').innerHTML = icon('flask');
$('settingsBtn').innerHTML = icon('gear');
$('dailyIc').innerHTML = icon('calendar');
$('rewardsIc').innerHTML = icon('gift');
$('shopIc').innerHTML = icon('shop');
$('codexIc').innerHTML = icon('book');
$('homeBtn').onclick = () => { unlock(); sw = null; if (sess.phase === 'play' && !sess.home) openPause(app); };
$('playBtn').onclick = () => {
  unlock(); play('ember');
  // The Play block bursts into embers as the level drops in.
  const r = $('playBtn').getBoundingClientRect();
  fx.rubble(r.left, r.top, r.width, r.height, ['#ff7b1c', '#ffc35a', '#b8460c', '#ffe08a'], 30, 12);
  app.playFromMap();
};
$('dailyBtn').onclick = () => { unlock(); play('tap'); if (dailyReady(sess)) { startDaily(sess); fit(); } };
$('settingsBtn').onclick = () => { unlock(); play('tap'); openSettings(app); };
$('rewardsBtn').onclick = () => { unlock(); play('tap'); openRewards(app); };
$('shopBtn').onclick = () => { unlock(); play('tap'); openShop(app); };
$('codexBtn').onclick = () => { unlock(); play('tap'); openCodex(app); };
$('meterAd').onclick = () => { unlock(); play('tap'); watchMeterAd(sess); };
$('callout').onclick = () => dismissCallout(sess);
$('powerBtn').onclick = () => { unlock(); if (viewLive()) act('power'); };
$('intro').onclick = endIntro;

// ---------- input ----------

const viewLive = () => live(sess) && !view.paused && view.intro <= 0;

function endIntro() {
  view.intro = 0;
  $('intro').hidden = true;
}

function act(a) {
  unlock();
  if (view.intro > 0) endIntro(); // any move skips the level card
  if (!viewLive()) return;
  const before = game().piece ? { x: game().piece.x, cells: JSON.stringify(game().piece.cells) } : null;
  input(sess, a);
  const p = game().piece;
  if (p && before) {
    if (a === 'left' || a === 'right') { if (p.x !== before.x) play('move'); }
    else if (a === 'rotate' && JSON.stringify(p.cells) !== before.cells) play('rotate');
  }
}

// Swipes count anywhere on the screen except on buttons and panels. The tutorial callout is
// the exception: it sits on the board and often says "swipe", so a swipe that starts on it
// still plays (and dismisses it); a plain tap on it only dismisses it.
let sw = null;
const gestures = []; // ?debug only
window.addEventListener('pointerdown', (e) => {
  unlock();
  if (view.intro > 0) { endIntro(); return; }
  if (!viewLive() || e.target.closest('button:not(#callout), .map, .sheet-wrap, .over')) return;
  const step = (cv.getBoundingClientRect().width / COLS) * 0.75;
  sw = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ax: e.clientX, ay: e.clientY, t: performance.now(), step, moved: false, onCallout: !!e.target.closest('#callout') };
});

window.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  if (!viewLive()) { sw = null; return; }
  e.preventDefault();
  let dx = e.clientX - sw.ax;
  let dy = e.clientY - sw.ay;
  while (dx >= sw.step) { act('right'); sw.ax += sw.step; dx -= sw.step; sw.moved = true; }
  while (dx <= -sw.step) { act('left'); sw.ax -= sw.step; dx += sw.step; sw.moved = true; }
  // Dragging down soft-drops, but only once the finger is clearly heading down, so a
  // flick (fast and short) still slams instead of dragging.
  if (performance.now() - sw.t > 120 || Math.abs(dy) > sw.step * 3) {
    while (dy >= sw.step) { act('soft'); sw.ay += sw.step; dy -= sw.step; sw.moved = true; }
  }
  if (dy < 0) sw.ay = e.clientY;
}, { passive: false });

window.addEventListener('pointerup', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dt = performance.now() - sw.t;
  const tx = e.clientX - sw.sx;
  const ty = e.clientY - sw.sy;
  const moved = sw.moved;
  const onCallout = sw.onCallout;
  sw = null;
  if (!viewLive()) return;
  let what = 'none';
  if (dt < 300 && ty < -50 && -ty > Math.abs(tx) * 1.5) what = 'power';
  else if (dt < 250 && ty > 50 && ty > Math.abs(tx) * 1.5) what = 'slam';
  else if (!moved && Math.hypot(tx, ty) < 12 && dt < 400) what = 'rotate';
  if (onCallout && what === 'rotate') what = 'none'; // the tap belongs to the callout's own click
  if (onCallout && (moved || what !== 'none')) dismissCallout(sess);
  if (what !== 'none') act(what);
  if (DEBUG) gestures.push({ dt: Math.round(dt), tx: Math.round(tx), ty: Math.round(ty), moved, what });
});
window.addEventListener('pointercancel', () => { sw = null; });

// No accidental zoom. Two quick taps are how you rotate twice, and iOS Safari reads them as a
// double-tap zoom (it doesn't reliably honor touch-action: none); pinches zoom too. Once zoomed,
// the board's own gestures make it hard to get back out. So:
//   - a quick second tap has its default cancelled. Pointer events (the game's taps) have
//     already been delivered by then; a button gets its click back by hand.
//   - pinch gestures are cancelled while the page is at normal size.
//   - if the page is zoomed anyway (an OS zoom feature, an older cached page), pinching is
//     allowed again so the player can zoom out, and the page snaps back to normal size as soon
//     as the fingers lift.
const zoomed = () => !!window.visualViewport && visualViewport.scale > 1.01;
let lastTap = 0;
let tapFrom = null;
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  tapFrom = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (e.touches.length || !tapFrom) return;
  const t = e.changedTouches[0];
  const tap = Math.hypot(t.clientX - tapFrom.x, t.clientY - tapFrom.y) < 12;
  tapFrom = null;
  if (!tap) return;
  const quick = e.timeStamp - lastTap < 400;
  lastTap = e.timeStamp;
  if (!quick) return;
  e.preventDefault();
  const b = e.target.closest?.('button, a, label');
  if (b && !b.disabled) b.click();
}, { passive: false });
for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, (e) => { if (!zoomed()) e.preventDefault(); }, { passive: false });
}
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && !zoomed()) e.preventDefault(); }, { passive: false });
const viewportMeta = document.querySelector('meta[name="viewport"]');
const viewportBase = viewportMeta?.content || '';
let unzoomTimer = 0;
function unzoom() {
  clearTimeout(unzoomTimer);
  unzoomTimer = setTimeout(() => {
    if (!zoomed() || !viewportMeta) return;
    // Rewriting the viewport tag makes iOS re-apply its scale limits, which zooms back out.
    viewportMeta.content = `${viewportBase}, minimum-scale=1`;
    setTimeout(() => { viewportMeta.content = viewportBase; }, 400);
  }, 450);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => {
    document.documentElement.classList.toggle('zoomed', zoomed());
    if (zoomed()) unzoom();
  });
}
document.addEventListener('touchend', () => { if (zoomed()) unzoom(); }, { passive: true });

// Desktop fallback only.
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'soft', ' ': 'slam', f: 'power', Enter: 'power',
};
window.addEventListener('keydown', (e) => {
  unlock();
  if (e.key === 'Escape') {
    if (!$('sheet').hidden) closeSheet(app);
    else if (sess.home) app.playFromMap();
    else if (sess.phase === 'play') openPause(app);
    return;
  }
  const k = KEYS[e.key];
  if (!k || !viewLive()) return;
  e.preventDefault();
  act(k);
});

window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
if (document.fonts) document.fonts.ready.then(() => { lastHud = ''; });
fit();

// A hidden tab stops the frame loop; drop the stale timestamp so nothing jumps on return.
let last = performance.now();
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  sw = null;
  if (document.hidden && sess.phase === 'play' && !sess.home && live(sess)) openPause(app);
});

// ---------- debug ----------

// ?debug exposes the live session for tests and runs the invariant checks every frame.
const eventLog = [];
const checker = createValidator();
const debugErrors = [];
let frames = 0;
let physMs = 0;
let workMs = 0;
let valMs = 0;
let drawMs = 0;
let worstMs = 0;
if (DEBUG) {
  window.mb = {
    sess,
    meta,
    board,
    fx,
    freeze: false,
    get game() { return sess.game; },
    get phase() { return sess.phase; },
    errors: debugErrors,
    events: eventLog,
    gestures,
    stats: () => ({ frames, avgPhysMs: physMs / Math.max(1, frames), avgFrameWorkMs: workMs / Math.max(1, frames), worstFrameWorkMs: worstMs, avgValidatorMs: valMs / Math.max(1, frames), avgDrawMs: drawMs / Math.max(1, frames) }),
    quality: () => QUALITY[quality],
    resetStats: () => { frames = 0; physMs = 0; workMs = 0; worstMs = 0; valMs = 0; drawMs = 0; },
  };
  if (params.has('scene')) {
    import('./scenes.js').then(({ SCENES }) => {
      const sc = SCENES[params.get('scene')];
      if (sc) {
        sc.setup(sess);
        lastOverlay = '';
        lastHud = '';
      } else console.error('unknown scene', params.get('scene'));
      window.mb.sceneReady = true;
    });
  }
  if (params.has('showcase')) {
    import('./showcase.js').then(({ SHOWCASE }) => {
      SHOWCASE[params.get('showcase')](sess);
      sess.callout = null;
      window.mb.freeze = true;
      window.mb.sceneReady = true;
    });
  }
}

// ---------- frame loop ----------

function frame(ts) {
  const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
  last = ts;
  boxCache = null;
  goalCache = null;
  if (sess.game) fx.setClip(boardBox());
  const t0 = performance.now();
  const valBefore = valMs;
  if (view.intro > 0) {
    view.intro -= dt;
    if (view.intro <= 0) $('intro').hidden = true;
  }
  const hold = view.paused || view.intro > 0 || (DEBUG && window.mb.freeze);
  if (view.hitstop > 0) view.hitstop -= dt;
  else if (!hold) step(sess, dt);
  if (DEBUG) {
    frames++;
    physMs += performance.now() - t0;
    const tv = performance.now();
    const errs = validate(sess.game, checker);
    valMs += performance.now() - tv;
    if (errs.length && debugErrors.length < 50) {
      debugErrors.push(...errs);
      console.error('invariant', errs);
    }
  }
  handleEvents();
  fx.step(dt);
  const td = performance.now();
  drawBoard(ts, dt);
  fx.draw();
  sky.setOn(quality > 0 && !sess.home && !view.paused);
  sky.frame(ts);
  const dd = performance.now() - td;
  if (DEBUG) drawMs += dd;
  // Drop a quality step when frames run long (frame interval or our own draw time).
  if (!document.hidden && dt > 0 && dt < 0.25) {
    drawEma = drawEma ? drawEma * 0.92 + Math.max(dd, dt * 1000 - 10) * 0.08 : dd;
    if (++emaFrames > 20 && drawEma > 9 && quality > 0) {
      const before = pixelRatio();
      quality--;
      emaFrames = 0;
      drawEma = 0;
      if (pixelRatio() !== before) fit();
    }
  }
  hud();
  overlays();
  calloutView();
  if (DEBUG) {
    const w = performance.now() - t0 - (valMs - valBefore);
    workMs += w;
    worstMs = Math.max(worstMs, w);
  }
  requestAnimationFrame(frame);
}

function drawBoard(ts, dt) {
  const g = game();
  const p = sess.phase === 'play' ? g.piece : null;
  if (p) {
    if (view.pieceX === null || view.lastPiece?.ref !== p) view.pieceX = p.x;
    view.pieceX += (p.x - view.pieceX) * Math.min(1, dt * 28);
    if (Math.abs(p.x - view.pieceX) < 0.02) view.pieceX = p.x;
    if (view.lastPiece?.ref !== p || view.lastPiece.rot !== p.cells) view.lastPiece = { ref: p, rot: p.cells, cells: p.cells.map((c) => [...c]), x: p.x, y: p.y };
    view.lastPiece.x = p.x;
    view.lastPiece.y = p.y;
  }
  const gy = p ? landingY(g) : null;
  board.draw(g, { ts, piece: p, pieceX: view.pieceX, ghostY: gy, reacts, assist: settings.assist, lite: quality === 0 });
  view.reactiveLanding = board.reactive;
  const well = $('well');
  if (view.shake > 0.2) {
    view.shake = Math.max(0, view.shake - dt * 40);
    well.style.transform = `translate(${(Math.random() - 0.5) * view.shake}px, ${(Math.random() - 0.5) * view.shake}px)`;
  } else if (well.style.transform) {
    well.style.transform = '';
    view.shake = 0;
  }
}

seedMapLevel(sess.level);
requestAnimationFrame(frame);
document.title = BRAND;
