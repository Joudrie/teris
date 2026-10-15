// Generated sounds and music with WebAudio: no files to load. Every effect is a few mallet
// partials, oscillators or filtered noise bursts shaped by envelopes, mixed into an sfx bus
// and a music bus that share a small bright room reverb. Browsers only allow audio after a
// user gesture, so the context is created on the first unlock() and never before. Without
// WebAudio (or without a window at all) every call is a quiet no-op.

const MASTER_VOL = 0.75;
const MUSIC_VOL = 0.34; // music sits well under the effects
const DUCK = 0.4; // about -8 dB while a big moment plays

let ac = null;
let master = null, sfx = null, music = null, musicLP = null, duckGain = null, verbIn = null;
let noiseBuf = null;
let muted = false, musicOn = true, mood = 'off', intensity = 0, haptics = true;
const lastPlayed = new Map();

const noop = () => {};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const fc = (f) => clamp(f, 20, 18000);
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
const settle = (p) => { if (p && p.catch) p.catch(noop); };

// C major pentatonic from C5 up four octaves: every tuned effect stays in the music's key.
const PENT = [];
for (let o = 0; o < 4; o++) for (const s of [0, 2, 4, 7, 9]) PENT.push(72 + 12 * o + s);
const deg = (i) => PENT[clamp(i | 0, 0, PENT.length - 1)];

// Per-play variation so repeats never sound identical. Noisy and percussive parts drift about
// 3% in pitch; tuned notes only a few cents so they stay in key with the music.
let vP = 1, vT = 1, vA = 1;
const vp = (f) => f * vP;
const hz = (m) => mtof(m) * vT;
const vv = (v) => v * vA;

// ---------- settings ----------

export function initSound(isMuted, opts) {
  muted = !!isMuted;
  if (opts && 'music' in opts) musicOn = !!opts.music;
  if (opts && 'haptics' in opts) haptics = !!opts.haptics;
}

// Muting silences effects and music but keeps the music preference for later.
export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ac.currentTime, 0.03);
  updateMusic();
}

export const isMuted = () => muted;

export function setMusic(on) {
  musicOn = !!on;
  updateMusic();
}

export const isMusicOn = () => musicOn;

// 'map' is calm and warm, 'play' has more drive, 'off' fades the music out.
export function setMusicMood(m) {
  if (m !== 'map' && m !== 'play' && m !== 'off') return;
  mood = m;
  musicTone();
  updateMusic();
}

// 0..1, e.g. progress toward the goal. The music gets busier and brighter as it rises.
export function setIntensity(x) {
  intensity = clamp(Number(x) || 0, 0, 1);
  musicTone();
}

export function setHaptics(on) {
  haptics = !!on;
}

export const hapticsOn = () => haptics;

// Named vibration patterns so the game can say buzz('slam') next to play('slam').
const BUZZ = {
  tap: 8, move: 4, land: 10, slam: 26, shatter: [12, 30, 14], power: [25, 40, 60],
  combo: [12, 40, 18], star: 20, coin: 10, ready: [10, 30, 10, 30, 10], unlock: [15, 40, 25],
  win: [20, 60, 20, 60, 45], lose: [60, 90, 60], heartbeat: [16, 110, 12],
};

// navigator.vibrate with a guard for browsers that lack it or block it before a tap.
export function buzz(pattern) {
  if (!haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const p = typeof pattern === 'string' ? (has(BUZZ, pattern) ? BUZZ[pattern] : null) : pattern;
  if (p == null) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate(p); } catch (e) { /* haptics are optional */ }
}

// ---------- the audio graph ----------

// Call from a user gesture (pointerdown/keydown).
export function unlock() {
  if (ac) {
    if (ac.state !== 'running' && !pageHidden()) settle(ac.resume());
    updateMusic();
    return;
  }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return;
  try {
    ac = new AC();
    build();
    // iOS only unlocks output once something has actually played inside the gesture.
    const s = ac.createBufferSource();
    s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
    s.connect(ac.destination);
    s.start(0);
    if (ac.state !== 'running') settle(ac.resume());
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVisibility);
    updateMusic();
  } catch (e) {
    try { if (ac && ac.close) settle(ac.close()); } catch (e2) { /* ignore */ }
    ac = null;
  }
}

const pageHidden = () => typeof document !== 'undefined' && !!document.hidden;

// Sleep with the tab so a backgrounded game is silent and cheap.
function onVisibility() {
  if (!ac) return;
  try { settle(pageHidden() ? ac.suspend() : ac.resume()); } catch (e) { /* ignore */ }
}

// master -> gentle compressor -> speakers. The sfx bus, the music bus (through its tone
// filter and the ducker) and the shared reverb all feed master.
function build() {
  master = ac.createGain();
  master.gain.value = muted ? 0 : MASTER_VOL;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(ac.destination);

  const verb = ac.createConvolver();
  verb.buffer = impulse(1.0);
  verbIn = ac.createGain();
  verbIn.connect(verb);
  verb.connect(master);

  sfx = ac.createGain();
  sfx.connect(master);

  musicLP = ac.createBiquadFilter();
  musicLP.type = 'lowpass';
  musicLP.Q.value = 0.5;
  musicLP.frequency.value = 2000;
  music = ac.createGain();
  music.gain.value = 0;
  duckGain = ac.createGain();
  musicLP.connect(music);
  music.connect(duckGain);
  duckGain.connect(master);
  const send = ac.createGain();
  send.gain.value = 0.22;
  duckGain.connect(send);
  send.connect(verbIn);

  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  musicTone();
}

// A small bright room: stereo noise with an exponential decay (-60 dB at the end), a lowpass
// that closes as the tail fades so the highs die first, and a highpass to keep it from booming.
function impulse(sec) {
  const sr = ac.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.008);
  const buf = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0, hp = 0, prev = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      lp += (0.6 - 0.48 * x) * (Math.random() * 2 - 1 - lp);
      hp = 0.976 * (hp + lp - prev);
      prev = lp;
      d[i] = hp * Math.exp(-6.9 * x);
    }
  }
  return buf;
}

// ---------- voices ----------

// An output for one sound: an optional stereo position (or pan sweep) and a reverb send.
function out({ pan = 0, panTo = null, t = 0, dur = 0, wet = 0.16, dest = sfx } = {}) {
  const g = ac.createGain();
  let n = g;
  if ((pan || panTo !== null) && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.setValueAtTime(clamp(pan, -1, 1), t);
    if (panTo !== null) p.pan.linearRampToValueAtTime(clamp(panTo, -1, 1), t + dur);
    g.connect(p);
    n = p;
  }
  n.connect(dest);
  if (wet > 0) {
    const w = ac.createGain();
    w.gain.value = wet;
    n.connect(w);
    w.connect(verbIn);
  }
  return g;
}

// Linear attack (crisp transient) then an exponential fall to silence.
function env(p, t, a, dur, vol) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(Math.max(vol, 0.0002), t + a);
  p.exponentialRampToValueAtTime(0.0001, t + a + dur);
}

// One oscillator through a percussive envelope, optionally gliding in pitch.
function osc(o, f, t, dur, { type = 'sine', vol = 0.2, a = 0.003, glide = 0, glideT = 0, detune = 0 } = {}) {
  const s = ac.createOscillator(), g = ac.createGain();
  s.type = type;
  s.frequency.setValueAtTime(fc(f), t);
  if (glide) s.frequency.exponentialRampToValueAtTime(fc(f * glide), t + (glideT || dur));
  if (detune) s.detune.value = detune;
  env(g.gain, t, a, dur, vol);
  s.connect(g);
  g.connect(o);
  s.start(t);
  s.stop(t + a + dur + 0.02);
  s.onended = () => g.disconnect();
}

// A burst of filtered noise. The cutoff can sweep to `to`; with `back` it peaks at `to` when
// the attack ends and returns to `back` by the end.
function noise(o, t, dur, { vol = 0.1, type = 'bandpass', f = 1500, to = 0, back = 0, q = 1, a = 0.002 } = {}) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf;
  s.loop = true;
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(fc(f), t);
  if (to && back) {
    fl.frequency.exponentialRampToValueAtTime(fc(to), t + a);
    fl.frequency.exponentialRampToValueAtTime(fc(back), t + a + dur);
  } else if (to) fl.frequency.exponentialRampToValueAtTime(fc(to), t + a + dur);
  env(g.gain, t, a, dur, vol);
  s.connect(fl);
  fl.connect(g);
  g.connect(o);
  s.start(t, Math.random() * 1.5);
  s.stop(t + a + dur + 0.02);
  s.onended = () => g.disconnect();
}

// Struck bars: sine partials at the bar's own ratios, the high ones dying first, plus a tiny
// filtered click for the mallet. This is where the toy-box woody and glassy colour comes from.
const BARS = {
  marimba: { r: [1, 3.93, 9.2], g: [1, 0.2, 0.05], d: [1, 0.25, 0.08], click: 0.18 },
  glock: { r: [1, 2.76, 5.4, 8.93], g: [1, 0.3, 0.12, 0.05], d: [1, 0.45, 0.25, 0.15], click: 0.1 },
  wood: { r: [1, 2.42, 3.98], g: [1, 0.35, 0.1], d: [1, 0.4, 0.2], click: 0.45 },
  bell: { r: [1, 2, 3.01, 4.16, 5.43], g: [1, 0.45, 0.22, 0.1, 0.05], d: [1, 0.65, 0.4, 0.25, 0.15], click: 0.05 },
};

function bar(o, f, t, dur, vol, kind = 'marimba') {
  const b = BARS[kind];
  for (let i = 0; i < b.r.length; i++) {
    const fi = f * b.r[i];
    if (fi > 12000) break;
    osc(o, fi, t, dur * b.d[i], { vol: vol * b.g[i], a: i ? 0.001 : 0.002 });
  }
  if (b.click) noise(o, t, 0.01, { vol: vol * b.click, f: Math.min(f * 2.5, 9000), q: 1.5, a: 0.0008 });
}

// A cascade of quiet glock notes scattered across the stereo field, falling by default.
function sparkle(t, n, span, { lo = 9, hi = 15, vol = 0.035, up = false } = {}) {
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1);
    const d = Math.round(up ? lo + k * (hi - lo) : hi - k * (hi - lo)) + pick([0, 0, 1, -1]);
    const o = out({ wet: 0.25, pan: rand(-0.7, 0.7) });
    bar(o, hz(deg(d)), t + k * span + rand(0, 0.02), rand(0.22, 0.4), vv(vol * (1 - 0.4 * k)), 'glock');
  }
}

// A swish of band-passed noise moving across the stereo field.
function swish(t, { f = 500, to = 2800, back = 0, a = 0.14, dur = 0.2, q = 1.4, vol = 0.1, pan = -0.5, panTo = 0.5, wet = 0.15 } = {}) {
  const o = out({ pan, panTo, t, dur: a + dur, wet });
  noise(o, t, dur, { f, to, back, q, a, vol });
}

// A big soft landing: a sine body dropping in pitch, an octave layer so phone speakers can
// hear it, a lowpassed rumble and an optional short crack.
function impact(t, { vol = 0.5, f = 130, crack = 0.15 } = {}) {
  const o = out({ wet: 0.12 });
  osc(o, vp(f), t, 0.32, { vol: vv(vol), glide: 0.33, glideT: 0.18 });
  osc(o, vp(f * 2), t, 0.12, { type: 'triangle', vol: vv(vol * 0.16), glide: 0.4 });
  noise(o, t, 0.3, { type: 'lowpass', f: 900, to: 160, q: 0.7, vol: vv(vol * 0.45) });
  if (crack) noise(o, t, 0.06, { f: vp(2200), q: 0.8, a: 0.001, vol: vv(crack) });
}

// Briefly pull the music down for a big moment, then let it breathe back.
function duck(hold = 0.25, release = 0.6) {
  if (!duckGain) return;
  const t = ac.currentTime, p = duckGain.gain;
  p.cancelScheduledValues(t);
  p.setTargetAtTime(DUCK, t, 0.02);
  p.setTargetAtTime(1, t + hold, release / 3);
}

// ---------- effects ----------

let tick = false; // move alternates tick and tock
let drainRun = 0, drainAt = -1e9; // drains close together climb the scale on their own

const POWERS = {
  // Soft rain: a rising wash, then droplets pattering across the field and a splash.
  rain(t) {
    const o = out({ wet: 0.2 });
    noise(o, t, 0.5, { type: 'lowpass', f: 400, to: 2400, a: 0.4, vol: vv(0.07) });
    noise(o, t + 0.25, 0.8, { type: 'highpass', f: 3000, a: 0.25, vol: vv(0.035) });
    for (let i = 0; i < 26; i++) {
      const d = out({ wet: 0.15, pan: rand(-0.8, 0.8) });
      const ti = t + 0.2 + Math.random() * 1.0;
      noise(d, ti, rand(0.008, 0.02), { f: rand(2500, 6000), q: 2.5, a: 0.0008, vol: rand(0.02, 0.05) });
      if (Math.random() < 0.4) osc(d, rand(1100, 2400), ti, 0.04, { vol: rand(0.02, 0.04), glide: 1.7, glideT: 0.03, a: 0.001 });
    }
    noise(o, t + 0.4, 0.45, { type: 'lowpass', f: 1600, to: 300, a: 0.01, vol: vv(0.12) });
    impact(t + 0.4, { vol: 0.28, crack: 0 });
  },
  // A roar of lowpassed noise flickering like flames, crackles, then a whump.
  blaze(t) {
    const o = out({ wet: 0.15 });
    const am = ac.createGain();
    am.gain.value = 0.7;
    am.connect(o);
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = rand(7, 10);
    depth.gain.value = 0.3;
    lfo.connect(depth);
    depth.connect(am.gain);
    lfo.start(t);
    lfo.stop(t + 1.3);
    noise(am, t, 0.75, { type: 'lowpass', f: 160, to: 1600, back: 350, a: 0.45, q: 0.9, vol: vv(0.3) });
    noise(am, t + 0.05, 0.6, { f: 900, to: 2200, back: 700, a: 0.4, q: 1.2, vol: vv(0.08) });
    for (let i = 0; i < 12; i++) noise(o, t + 0.15 + Math.random() * 0.95, rand(0.003, 0.009), { f: rand(1200, 4000), q: 1.4, a: 0.0005, vol: rand(0.04, 0.09) });
    impact(t + 0.42, { vol: 0.45, f: 95, crack: 0.08 });
  },
  // Glassy and crystalline: icy hiss, a fall of high glock notes and a frozen bell cluster.
  freeze(t) {
    const o = out({ wet: 0.25 });
    noise(o, t, 0.25, { type: 'highpass', f: 2000, to: 8000, a: 0.4, vol: vv(0.05) });
    sparkle(t + 0.04, 14, 0.9, { lo: 8, hi: 16, vol: 0.04 });
    const hit = t + 0.45;
    for (const m of [96, 100, 103]) bar(o, hz(m), hit, 0.9, vv(0.05), 'bell');
    noise(o, hit, 0.25, { type: 'highpass', f: 6000, a: 0.001, vol: vv(0.08) });
    impact(hit, { vol: 0.3, f: 110, crack: 0.05 });
  },
  // A gust of resonant band-passed wind blowing left to right, with a marimba run riding it.
  sweep(t) {
    const o = out({ wet: 0.18, pan: -0.8, panTo: 0.8, t, dur: 1.05 });
    noise(o, t, 0.6, { f: 350, to: 2200, back: 500, a: 0.45, q: 5, vol: vv(0.22) });
    noise(o, t, 0.6, { f: 700, to: 3500, back: 900, a: 0.4, q: 1.8, vol: vv(0.09) });
    const run = out({ wet: 0.2, pan: -0.5, panTo: 0.5, t, dur: 0.5 });
    for (let i = 0; i < 6; i++) bar(run, hz(deg(4 + i)), t + 0.15 + i * 0.05, 0.2, vv(0.04), 'marimba');
    impact(t + 0.5, { vol: 0.22, crack: 0.04 });
  },
  // A wind-up swing, then a heavy thud and a ringing metallic clang (detuned twins beat).
  hammer(t) {
    swish(t, { f: 300, to: 1800, a: 0.32, dur: 0.04, q: 1.2, vol: vv(0.1), pan: 0.4, panTo: 0 });
    const hit = t + 0.36;
    impact(hit, { vol: 0.62, f: 105, crack: 0.2 });
    const o = out({ wet: 0.22 });
    const base = vp(196);
    for (const [r, g, d] of [[1, 1, 1], [1.47, 0.7, 0.8], [2.09, 0.5, 0.6], [2.56, 0.4, 0.45], [3.39, 0.25, 0.3], [4.1, 0.15, 0.25]]) {
      osc(o, base * r, hit, 0.85 * d, { vol: vv(0.06 * g), a: 0.001 });
      osc(o, base * r + 2.5, hit, 0.85 * d, { vol: vv(0.04 * g), a: 0.001 });
    }
    noise(o, hit, 0.5, { type: 'lowpass', f: 450, to: 110, vol: vv(0.2) });
  },
  // Any other power: a rising whoosh and a soft impact.
  generic(t) {
    swish(t, { f: 300, to: 3000, back: 800, a: 0.45, dur: 0.5, q: 1.5, vol: vv(0.16), pan: -0.6, panTo: 0.6 });
    impact(t + 0.45, { vol: 0.45 });
    sparkle(t + 0.5, 6, 0.5, { lo: 8, hi: 13 });
  },
};

const SOUNDS = {
  // A stone block clicking into its socket.
  tap(t) {
    const o = out({ wet: 0.06, pan: rand(-0.1, 0.1) });
    bar(o, vp(720), t, 0.05, vv(0.12), 'wood');
    noise(o, t, 0.012, { f: vp(2400), q: 1, a: 0.0005, vol: vv(0.05) });
  },
  // A menu slab falling: rushing air (the landing thud is 'slab').
  open(t) {
    swish(t, { f: vp(2600), to: vp(500), a: 0.2, dur: 0.1, vol: vv(0.06), pan: 0.1, panTo: -0.1 });
  },
  close(t) {
    swish(t, { f: vp(900), to: vp(300), a: 0.03, dur: 0.12, vol: vv(0.04), pan: 0.2, panTo: -0.2 });
  },
  move(t) {
    tick = !tick;
    bar(out({ wet: 0.04 }), vp(tick ? 1900 : 1780), t, 0.025, vv(0.045), 'wood');
  },
  rotate(t) {
    const o = out({ wet: 0.08 });
    bar(o, vp(2350), t, 0.05, vv(0.05), 'glock');
    noise(o, t, 0.008, { type: 'highpass', f: 6000, vol: vv(0.03) });
  },
  land(t) {
    const o = out({ wet: 0.08 });
    osc(o, vp(175), t, 0.1, { vol: vv(0.2), glide: 0.55, glideT: 0.06 });
    bar(o, vp(340), t, 0.08, vv(0.13), 'wood');
    noise(o, t, 0.045, { type: 'lowpass', f: 900, vol: vv(0.07) });
  },
  slam(t) {
    const o = out({ wet: 0.1 });
    osc(o, vp(150), t, 0.24, { vol: vv(0.55), glide: 0.3, glideT: 0.12 });
    osc(o, vp(300), t, 0.09, { type: 'triangle', vol: vv(0.1), glide: 0.35 });
    bar(o, vp(210), t, 0.09, vv(0.12), 'wood');
    noise(o, t, 0.09, { f: vp(1500), q: 0.7, a: 0.001, vol: vv(0.17) });
    noise(o, t, 0.2, { type: 'lowpass', f: 700, to: 150, vol: vv(0.22) });
  },
  // A crack, a bright spray of glass, then shards tinkling down in pitch.
  shatter(t) {
    duck(0.2, 0.6);
    const o = out({ wet: 0.2 });
    noise(o, t, 0.05, { f: vp(3200), q: 0.6, a: 0.001, vol: vv(0.25) });
    noise(o, t, 0.3, { f: vp(6500), to: vp(4200), q: 0.5, a: 0.003, vol: vv(0.13) });
    noise(o, t, 0.1, { f: vp(1700), q: 0.9, vol: vv(0.08) });
    let f = rand(4200, 6200);
    for (let i = 0; i < 8; i++) {
      const s = out({ wet: 0.22, pan: rand(-0.7, 0.7) });
      const ti = t + 0.02 + i * 0.038 + Math.random() * 0.03, v = vv(0.04 * (1 - i * 0.07));
      osc(s, f, ti, rand(0.06, 0.16), { vol: v, a: 0.001 });
      osc(s, f * 2.31, ti, 0.05, { vol: v * 0.35, a: 0.001 });
      f *= rand(0.84, 0.95);
    }
  },
  steam(t) {
    const o = out({ wet: 0.1, pan: rand(-0.3, 0.3) });
    noise(o, t, 0.2, { f: vp(4800), to: vp(2600), q: 0.7, a: 0.025, vol: vv(0.055) });
    noise(o, t, 0.08, { type: 'highpass', f: 8000, a: 0.01, vol: vv(0.015) });
  },
  burn(t) {
    const o = out({ wet: 0.08, pan: rand(-0.3, 0.3) });
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) noise(o, t + Math.random() * 0.12, rand(0.003, 0.009), { f: rand(1200, 3800), q: 1.4, a: 0.0005, vol: vv(rand(0.05, 0.11)) });
    noise(o, t, 0.12, { type: 'lowpass', f: 550, a: 0.03, vol: vv(0.025) });
  },
  // Climbs the pentatonic ladder with the multiplier and with each arrival in a run. Without
  // e.step, arrivals less than 0.6 s apart count as a run and step up on their own.
  drain(t, e) {
    const mult = clamp(Math.round(Number(e.mult) || 1), 1, 4);
    let step = Number(e.step);
    const now = clock();
    if (!Number.isFinite(step)) {
      drainRun = now - drainAt < 600 ? drainRun + 1 : 0;
      step = drainRun;
    }
    drainAt = now;
    let i = (mult - 1) * 2 + Math.max(0, step);
    if (i > 12) i = 12 - ((i - 12) % 2); // at the top, rock between the last two notes
    const f = hz(deg(i)), o = out({ wet: 0.18, pan: rand(-0.25, 0.25) });
    bar(o, f, t, 0.3, vv(0.12), 'marimba');
    bar(o, f, t, 0.45, vv(0.035 + 0.012 * mult), 'glock');
  },
  // A rising arpeggio that starts higher, runs longer and sparkles more at each level.
  combo(t, e) {
    const m = clamp(Math.round(Number(e.mult) || 2), 2, 4);
    const n = m + 2, start = (m - 2) * 2 + 2, gap = 0.065 - m * 0.005;
    const o = out({ wet: 0.2 });
    osc(o, vp(130), t, 0.12, { vol: vv(0.18), glide: 0.5 });
    for (let i = 0; i < n; i++) {
      const f = hz(deg(start + i)), ti = t + i * gap + Math.random() * 0.006, last = i === n - 1;
      bar(o, f, ti, last ? 0.7 : 0.22, vv(last ? 0.11 : 0.085), 'marimba');
      bar(o, f, ti, last ? 0.9 : 0.3, vv(0.02 + 0.012 * m), 'glock');
    }
    if (m >= 3) sparkle(t + n * gap, m === 3 ? 3 : 7, m === 3 ? 0.3 : 0.5, { lo: start + 4, hi: start + 9 });
    if (m >= 4) {
      duck(0.3, 0.6);
      bar(o, hz(deg(start + n)), t + n * gap, 1.0, vv(0.06), 'bell');
    }
  },
  quest(t) {
    const o = out({ wet: 0.22 });
    [79, 84, 88].forEach((m, i) => {
      const ti = t + i * 0.085 + rand(0, 0.006), last = i === 2;
      bar(o, hz(m), ti, last ? 0.7 : 0.25, vv(0.09), 'bell');
      bar(o, hz(m), ti, last ? 0.4 : 0.2, vv(0.05), 'marimba');
    });
    sparkle(t + 0.25, 3, 0.2, { lo: 12, hi: 15, vol: 0.03 });
  },
  ready(t) {
    for (let i = 0; i < 9; i++) {
      const o = out({ wet: 0.25, pan: i % 2 ? 0.35 : -0.35 });
      bar(o, hz(deg(3 + i)), t + i * 0.04 + rand(0, 0.005), 0.3 + i * 0.04, vv(0.03 + i * 0.005), 'glock');
    }
    const o = out({ wet: 0.3 });
    noise(o, t, 0.3, { type: 'highpass', f: 4000, to: 9000, a: 0.35, vol: vv(0.025) });
    osc(o, hz(84), t + 0.3, 0.6, { vol: vv(0.04), a: 0.05 });
    osc(o, hz(91), t + 0.3, 0.6, { vol: vv(0.03), a: 0.05 });
    bar(o, hz(96), t + 0.36, 0.8, vv(0.06), 'bell');
  },
  power(t, e) {
    duck(0.7, 0.6);
    (has(POWERS, e.power) ? POWERS[e.power] : POWERS.generic)(t);
  },
  callout(t) {
    const o = out({ wet: 0.25 });
    bar(o, hz(88), t, 0.6, vv(0.09), 'bell');
    bar(o, hz(81), t, 0.3, vv(0.04), 'marimba');
  },
  // A stamp thump under a ding that rises with each star; the third one sparkles.
  star(t, e) {
    const n = clamp(Math.round(Number(e.n) || 1), 1, 3), m = [88, 91, 96][n - 1];
    const o = out({ wet: 0.2 });
    osc(o, vp(160), t, 0.18, { vol: vv(0.32), glide: 0.38, glideT: 0.1 });
    noise(o, t, 0.07, { type: 'lowpass', f: 1200, to: 300, vol: vv(0.14) });
    bar(o, hz(m), t + 0.01, 0.9, vv(0.1), 'bell');
    bar(o, hz(m - 12), t + 0.01, 0.5, vv(0.06), 'marimba');
    if (n === 3) {
      duck(0.3, 0.6);
      sparkle(t + 0.08, 7, 0.5, { lo: 10, hi: 15 });
    }
  },
  coin(t) {
    const o = out({ wet: 0.14, pan: rand(-0.2, 0.2) });
    const a = hz(83), b = hz(88); // B5 then E6
    osc(o, a, t, 0.07, { type: 'triangle', vol: vv(0.12) });
    osc(o, a * 2, t, 0.05, { vol: vv(0.025) });
    osc(o, b, t + 0.07, 0.38, { type: 'triangle', vol: vv(0.13) });
    osc(o, b * 2, t + 0.07, 0.22, { vol: vv(0.03) });
    osc(o, b * 3, t + 0.07, 0.1, { vol: vv(0.012) });
  },
  // Quarry: the interface is stone, wood and fire, and sounds like it.
  // A stone slab landing: a deep thud with grit under it.
  slab(t) {
    impact(t, { vol: 0.42, f: 96, crack: 0.06 });
    const o = out({ wet: 0.1 });
    for (let i = 0; i < 5; i++) noise(o, t + 0.02 + Math.random() * 0.1, rand(0.004, 0.01), { f: rand(700, 1800), q: 1.2, a: 0.0005, vol: vv(rand(0.03, 0.06)) });
  },
  // A piece breaking into sand: a soft thud under a hiss that pours down and fades.
  sand(t) {
    const o = out({ wet: 0.1, pan: rand(-0.2, 0.2) });
    noise(o, t, 0.06, { type: 'lowpass', f: 420, a: 0.002, vol: vv(0.16) });
    noise(o, t + 0.01, 0.45, { f: vp(3200), to: 900, q: 0.7, a: 0.03, vol: vv(0.07) });
    for (let i = 0; i < 6; i++) noise(o, t + 0.04 + Math.random() * 0.3, rand(0.003, 0.008), { f: rand(2500, 5000), q: 1.5, a: 0.0005, vol: vv(rand(0.015, 0.03)) });
  },
  // Stone breaking up: a crack, then chunks rattling down and settling.
  crumble(t) {
    const o = out({ wet: 0.14 });
    noise(o, t, 0.05, { f: vp(1400), q: 0.8, a: 0.001, vol: vv(0.16) });
    noise(o, t, 0.35, { type: 'lowpass', f: 900, to: 200, a: 0.01, vol: vv(0.12) });
    for (let i = 0; i < 12; i++) {
      const s = out({ wet: 0.12, pan: rand(-0.6, 0.6) });
      const ti = t + 0.03 + i * 0.03 + Math.random() * 0.03;
      noise(s, ti, rand(0.006, 0.016), { f: rand(500, 1600) * (1 - i * 0.03), q: 1.3, a: 0.0008, vol: vv(0.07 * (1 - i * 0.05)) });
    }
  },
  // Fire bursting into embers: a rising whoosh, a thump and a crackle.
  ember(t) {
    swish(t, { f: vp(300), to: vp(2200), a: 0.06, dur: 0.22, vol: vv(0.08), pan: -0.2, panTo: 0.2 });
    impact(t + 0.02, { vol: 0.28, f: 120, crack: 0 });
    const o = out({ wet: 0.1 });
    for (let i = 0; i < 9; i++) noise(o, t + 0.05 + Math.random() * 0.35, rand(0.003, 0.008), { f: rand(1500, 4200), q: 1.4, a: 0.0005, vol: vv(rand(0.04, 0.09)) });
  },
  // A wooden crate breaking open: a knock, a crack and splinters.
  crate(t) {
    const o = out({ wet: 0.12 });
    bar(o, vp(260), t, 0.12, vv(0.2), 'wood');
    noise(o, t + 0.01, 0.07, { f: vp(1900), q: 0.7, a: 0.001, vol: vv(0.2) });
    for (let i = 0; i < 7; i++) {
      const s = out({ wet: 0.14, pan: rand(-0.7, 0.7) });
      bar(s, vp(rand(500, 1100)), t + 0.05 + i * 0.035 + Math.random() * 0.02, 0.05, vv(0.06 * (1 - i * 0.08)), 'wood');
    }
  },
  // Major arpeggio up, a rolled marimba chord with a ringing bell, then a sparkle shower.
  win(t) {
    duck(1.4, 0.8);
    const o = out({ wet: 0.22 });
    [72, 76, 79, 84, 88, 91].forEach((m, i) => {
      const ti = t + i * 0.075 + rand(0, 0.006);
      bar(o, hz(m), ti, 0.35, vv(0.09), 'marimba');
      bar(o, hz(m), ti, 0.5, vv(0.04), 'glock');
    });
    const hit = t + 0.5;
    for (const m of [72, 76, 79, 84]) {
      for (let k = 0; k < 4; k++) bar(o, hz(m), hit + k * 0.07 + rand(0, 0.012), k === 3 ? 0.9 : 0.3, vv(0.05 * (1 - k * 0.12)), 'marimba');
    }
    bar(o, hz(96), hit, 1.0, vv(0.07), 'bell');
    osc(o, mtof(48), hit, 0.8, { vol: vv(0.22), a: 0.005 });
    impact(hit, { vol: 0.3, crack: 0 });
    sparkle(hit + 0.1, 12, 0.9, { lo: 8, hi: 15 });
    noise(out({ wet: 0.3 }), hit, 0.6, { type: 'highpass', f: 6000, a: 0.25, vol: vv(0.025) });
  },
  // Gently down the pentatonic to A: wistful, never a buzzer.
  lose(t) {
    duck(0.9, 0.8);
    const o = out({ wet: 0.22 });
    [[79, 0], [76, 0.18], [74, 0.36], [69, 0.58]].forEach(([m, dt], i) => {
      bar(o, hz(m), t + dt + rand(0, 0.01), i === 3 ? 0.8 : 0.35, vv(0.1), 'marimba');
    });
    osc(o, mtof(57), t + 0.45, 0.7, { vol: vv(0.05), a: 0.2 });
    osc(o, mtof(64), t + 0.45, 0.7, { vol: vv(0.035), a: 0.2 });
    osc(o, mtof(45), t + 0.58, 0.6, { vol: vv(0.12), a: 0.01 });
  },
  heartbeat(t) {
    const o = out({ wet: 0.04 });
    for (const [dt, v] of [[0, 1], [0.17, 0.65]]) {
      osc(o, vp(72), t + dt, 0.16, { vol: vv(0.38 * v), glide: 0.65, a: 0.006 });
      osc(o, vp(144), t + dt, 0.08, { type: 'triangle', vol: vv(0.06 * v), glide: 0.6 });
      noise(o, t + dt, 0.05, { type: 'lowpass', f: 300, vol: vv(0.06 * v) });
    }
  },
  pop(t) {
    const o = out({ wet: 0.08 });
    osc(o, vp(520), t, 0.06, { vol: vv(0.14), glide: 2.6, glideT: 0.03, a: 0.002 });
    noise(o, t, 0.006, { f: 3000, q: 1, a: 0.0005, vol: vv(0.04) });
  },
  whoosh(t) {
    swish(t, { f: vp(450), to: vp(2800), back: vp(700), a: 0.13, dur: 0.22, q: 1.1, vol: vv(0.17) });
  },
  // A quick glock run up over a soft Cmaj7 halo, then a sparkle shower.
  unlock(t) {
    duck(0.5, 0.7);
    const o = out({ wet: 0.25 });
    [84, 88, 91, 96, 100].forEach((m, i) => bar(o, hz(m), t + i * 0.05, 0.4, vv(0.06), 'glock'));
    for (const m of [72, 76, 79, 83]) osc(o, hz(m), t + 0.05, 1.1, { vol: vv(0.028), a: 0.2 });
    sparkle(t + 0.25, 10, 0.9, { lo: 9, hi: 15 });
    noise(out({ wet: 0.3 }), t + 0.1, 0.5, { type: 'highpass', f: 6000, a: 0.3, vol: vv(0.02) });
  },
};

// Minimum milliseconds between two plays of the same sound. A big reaction fires hundreds of
// events; this keeps them a sound and not a roar.
const GAP = {
  move: 30, rotate: 30, tap: 35, pop: 40, drain: 45, coin: 45, land: 50, burn: 55, steam: 60,
  slam: 70, shatter: 70, star: 90, combo: 110, quest: 200, power: 250, heartbeat: 300,
  ready: 300, unlock: 300, lose: 700, win: 900, slab: 200, crumble: 150, ember: 200, crate: 200, sand: 80,
};

export function play(name, e) {
  if (!ac || muted || !has(SOUNDS, name)) return;
  const now = clock();
  if (now - (lastPlayed.get(name) ?? -1e9) < (GAP[name] || 50)) return;
  lastPlayed.set(name, now);
  vP = 1 + rand(-0.03, 0.03);
  vT = 1 + rand(-0.006, 0.006);
  vA = 1 + rand(-0.1, 0.06);
  try { SOUNDS[name](ac.currentTime + 0.005 + Math.random() * 0.004, e || {}); } catch (err) { /* audio is optional */ }
}

// ---------- music ----------

// A tiny generative band in C major. A lookahead scheduler wakes every 25 ms and books the
// next ~120 ms of sixteenth notes against the audio clock, so timing stays tight even when
// the main thread is busy.
const CHORDS = {
  C: { root: 48, tones: [60, 64, 67, 74] }, // C add9
  G: { root: 43, tones: [59, 62, 67, 69] }, // G6
  Am: { root: 45, tones: [60, 64, 69, 71] }, // Am add9
  F: { root: 41, tones: [57, 60, 64, 67] }, // Fmaj9, lydian when the line lands on B
};
const MOODS = {
  // Calm and warm: slower, pad-led, a sparse marimba line.
  map: { bpm: 96, prog: ['C', 'Am', 'F', 'G'], line: 0.14, lineUp: 0.3, voice: 'marimba', pad: 0.045, chord: 0.04, bassLen: 0.8, swing: 0.12, tone: 1500, open: 1.4 },
  // More drive: offbeat bass, marimba chords twice a bar, a glock line, kick and wood rim.
  play: { bpm: 104, prog: ['C', 'G', 'Am', 'F'], line: 0.22, lineUp: 0.45, voice: 'glock', pad: 0.025, chord: 0.055, bassLen: 0.4, swing: 0.08, tone: 2200, open: 2.8 },
};
const LINE = PENT.filter((m) => m <= 96); // C5..C7
const LINE_F = [...LINE, 83, 95].sort((a, b) => a - b); // over F the line may touch B
const mus = { timer: 0, stopTimer: 0, next: 0, step: 0, cycle: 0, m: MOODS.play, pats: null, idx: 5 };

// A pattern is a fixed set of random rolls: whether each sixteenth may sound and how the line
// moves. Notes play when their roll is under the current density, so rising intensity adds
// notes while the ones already there stay put, and repeats sound like a riff, not noise.
function pattern() {
  const gate = [], move = [];
  for (let s = 0; s < 16; s++) {
    gate.push(Math.random());
    move.push(pick([-2, -1, -1, 0, 1, 1, 2]));
  }
  return { gate, move, start: 3 + ((Math.random() * 4) | 0) };
}

function updateMusic() {
  if (ac && musicOn && !muted && mood !== 'off') startMusic();
  else stopMusic();
}

function startMusic() {
  clearTimeout(mus.stopTimer);
  mus.stopTimer = 0;
  music.gain.setTargetAtTime(MUSIC_VOL, ac.currentTime, 0.5);
  if (mus.timer) return;
  mus.next = ac.currentTime + 0.1;
  mus.step = 0;
  mus.cycle = 0;
  mus.timer = setInterval(schedule, 25);
}

function stopMusic() {
  if (!mus.timer || mus.stopTimer) return;
  music.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  mus.stopTimer = setTimeout(() => {
    clearInterval(mus.timer);
    mus.timer = 0;
    mus.stopTimer = 0;
  }, 800);
}

// The tone filter opens with intensity, more so in play.
function musicTone() {
  if (!musicLP) return;
  const m = MOODS[mood] || MOODS.play;
  musicLP.frequency.setTargetAtTime(fc(m.tone * (1 + intensity * m.open)), ac.currentTime, 0.5);
}

function schedule() {
  if (!ac) return;
  const now = ac.currentTime;
  if (mus.next < now) mus.next = now + 0.02; // the tab slept: skip ahead instead of piling up
  while (mus.next < now + 0.12) {
    const sd = 15 / mus.m.bpm; // one sixteenth
    try { step(mus.step, mus.next + (mus.step % 2 ? mus.m.swing * sd : 0), sd); } catch (e) { /* audio is optional */ }
    mus.next += sd;
    mus.step = (mus.step + 1) % 64;
  }
}

const mout = (pan = 0) => out({ dest: musicLP, wet: 0, pan });

function step(s, t, sd) {
  const barN = (s / 16) | 0, b = s % 16;
  if (b === 0) {
    if (barN === 0 && mus.cycle++ % 2 === 0) mus.pats = [pattern(), pattern()]; // a new riff every 8 bars
    mus.m = MOODS[mood] || mus.m; // mood and tempo changes land on the bar line
    mus.idx = mus.pats[barN % 2].start;
  }
  const m = mus.m, I = intensity, drive = m === MOODS.play, ch = CHORDS[m.prog[barN]];
  const vel = () => rand(0.85, 1.05);
  const h = () => t + rand(0, 0.005);

  // Bass: a soft pluck on the one, the fifth on three, offbeat octaves in play.
  const bassAt = { 0: [0, 1], 8: [7, 0.7] };
  if (drive && I > 0.25) bassAt[6] = [12, 0.45];
  if (drive && I > 0.55) bassAt[14] = [12, 0.4];
  if (bassAt[b] && (b !== 8 || drive || Math.random() < 0.7)) bass(h(), ch.root + bassAt[b][0], m.bassLen, 0.16 * bassAt[b][1] * vel());

  // Chords: a pad under each bar and a rolled marimba chord on the one (and on the and-of-three in play).
  if (b === 0) pad(t, ch.tones, 16 * sd, m.pad);
  if (b === 0 || (drive && b === 10)) {
    const o = mout(rand(-0.15, 0.15)), v = m.chord * (b ? 0.6 : 1) * vel();
    ch.tones.forEach((n, i) => bar(o, mtof(n), t + i * 0.014, 0.6, v, 'marimba'));
  }

  // Drums: a soft kick and woody rim in play, a shaker on the sixteenths once intensity passes half.
  if (drive && I > 0.3 && (b === 0 || b === 8)) {
    const o = mout();
    osc(o, 110, t, 0.16, { vol: 0.22 * vel(), glide: 0.45, glideT: 0.08 });
    osc(o, 220, t, 0.05, { type: 'triangle', vol: 0.03, glide: 0.5 });
  }
  if (drive && I > 0.7 && (b === 4 || b === 12)) bar(mout(0.2), 900, h(), 0.05, 0.035 * vel(), 'wood');
  if (I > 0.5 && Math.random() < (I - 0.5) * 2 * (b % 2 ? 0.55 : 1)) {
    const acc = b % 4 === 2 ? 1 : 0.55;
    noise(mout(0.3), h(), b % 4 === 2 ? 0.04 : 0.022, { f: 7000, q: 0.7, a: 0.004, vol: (drive ? 0.03 : 0.018) * acc * vel() });
  }

  // Line: walks the scale on the pattern's moves, landing on chord tones on the beats.
  const pat = mus.pats[barN % 2], scale = m.prog[barN] === 'F' ? LINE_F : LINE;
  const weight = b % 4 === 0 ? 1 : b % 2 === 0 ? 0.6 : 0.1 + 0.5 * Math.max(0, I - 0.6);
  mus.idx = clamp(mus.idx + pat.move[b], 0, scale.length - 1);
  if (pat.gate[b] < (m.line + m.lineUp * I) * weight) {
    let n = scale[mus.idx];
    if (b % 4 === 0) n = nearestChordTone(n, ch, scale);
    const f = mtof(n), v = 0.07 * vel(), pan = b % 8 < 4 ? -0.25 : 0.25;
    bar(mout(pan), f, h(), m.voice === 'glock' ? 0.5 : 0.4, v, m.voice);
    if (I > 0.6) bar(mout(-pan), f, t + 3 * sd, 0.3, v * 0.3, 'glock'); // a dotted-eighth echo
  }
}

function nearestChordTone(n, ch, scale) {
  const pcs = new Set([ch.root % 12, ...ch.tones.map((x) => x % 12)]);
  let best = n, dist = Infinity;
  for (const x of scale) {
    if (pcs.has(x % 12) && Math.abs(x - n) < dist) { best = x; dist = Math.abs(x - n); }
  }
  return best;
}

function bass(t, midi, len, vol) {
  const o = mout(), f = mtof(midi);
  osc(o, f, t, len, { type: 'triangle', vol: vol * 0.7, a: 0.006 });
  osc(o, f, t, len * 1.2, { vol, a: 0.006 });
  osc(o, f * 2, t, len * 0.35, { vol: vol * 0.15, a: 0.004 }); // pluck and presence on small speakers
}

// Detuned triangle pairs through a soft lowpass that opens a little with intensity.
function pad(t, tones, len, vol) {
  const o = mout(), lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass';
  lp.frequency.value = 900 + 1400 * intensity;
  lp.connect(o);
  g.connect(lp);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.4);
  g.gain.linearRampToValueAtTime(vol * 0.7, t + len);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6);
  for (const n of tones) {
    for (const d of [-7, 7]) {
      const s = ac.createOscillator();
      s.type = 'triangle';
      s.frequency.value = mtof(n);
      s.detune.value = d;
      s.connect(g);
      s.start(t);
      s.stop(t + len + 0.65);
    }
  }
}
