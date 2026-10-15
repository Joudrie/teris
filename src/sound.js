// Generated sounds with WebAudio: no files to load. Every sound is a few oscillators or a
// burst of noise with an envelope. Muting is remembered. Browsers only allow audio after a
// user gesture, so the context is created on the first touch.

let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;
const lastPlayed = new Map();

export function initSound(isMuted) {
  muted = !!isMuted;
}

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export const isMuted = () => muted;

// Call from a user gesture (pointerdown/keydown).
export function unlock() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) {
    ac = null;
  }
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', delay = 0 } = {}) {
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const SOUNDS = {
  steam: () => noise(0.25, { vol: 0.12, freq: 3000, q: 0.7, type: 'highpass' }),
  burn: () => noise(0.18, { vol: 0.08, freq: 700, q: 2 }),
  drain: (e) => tone(330 + 60 * (e.mult || 1), 0.08, { type: 'triangle', vol: 0.12, slide: 1.3 }),
  land: () => noise(0.08, { vol: 0.15, freq: 300, q: 1, type: 'lowpass' }),
  slam: () => { noise(0.18, { vol: 0.35, freq: 180, q: 1, type: 'lowpass' }); tone(90, 0.15, { type: 'sine', vol: 0.3, slide: 0.5 }); },
  shatter: () => { noise(0.4, { vol: 0.3, freq: 5000, q: 0.5, type: 'highpass' }); tone(2400, 0.12, { type: 'triangle', vol: 0.08, slide: 1.5 }); },
  combo: (e) => [0, 4, 7, 12].slice(0, Math.min(4, e.mult)).forEach((n, i) => tone(523 * 2 ** (n / 12), 0.12, { type: 'square', vol: 0.07, delay: i * 0.06 })),
  power: () => { tone(200, 0.6, { type: 'sawtooth', vol: 0.12, slide: 4 }); noise(0.6, { vol: 0.2, freq: 900, q: 0.8 }); },
  quest: () => [0, 7, 12].forEach((n, i) => tone(660 * 2 ** (n / 12), 0.15, { type: 'triangle', vol: 0.12, delay: i * 0.08 })),
  win: () => [0, 4, 7, 12, 16].forEach((n, i) => tone(523 * 2 ** (n / 12), 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.09 })),
  lose: () => [0, -3, -7].forEach((n, i) => tone(330 * 2 ** (n / 12), 0.3, { type: 'sine', vol: 0.15, delay: i * 0.15 })),
  tap: () => tone(880, 0.04, { type: 'square', vol: 0.04 }),
  callout: () => tone(988, 0.12, { type: 'triangle', vol: 0.1 }),
};

// Rate-limited: a big reaction fires hundreds of events, but each sound plays at most
// once every 60 ms so it stays a sound and not a roar.
export function play(name, e = {}) {
  if (!ac || muted || !SOUNDS[name]) return;
  const t = performance.now();
  if (t - (lastPlayed.get(name) || 0) < 60) return;
  lastPlayed.set(name, t);
  try { SOUNDS[name](e); } catch (err) { /* audio is optional */ }
}
