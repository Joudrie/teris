// The meta layer around the levels: stars, coins, boosters, daily rewards and block skins.
// No DOM and no rules: it only reads results the session already has and keeps its own
// saves (new mb_* keys, next to the old ones, which it never touches).
//
// Coins are earned by playing and spent on boosters and skins inside the game. Anything
// that would cost real money (coin packs, remove ads, starter pack) is a store stub in the
// view: no purchase is ever faked.

// Share of the piece budget left at the win. tools/stars.js plays the casual bot through
// levels 1-60 (docs/data/stars.txt) and these cut-offs give 3 stars to about the best fifth
// of clears and 2 stars to a little under half (p55 of shares left is 0.03, p80 is 0.08).
export const STAR_CUTS = { two: 0.03, three: 0.08 };

export function starsFor(left, budget) {
  if (!Number.isFinite(left) || !Number.isFinite(budget) || budget <= 0) return 1;
  const share = left / budget;
  if (share >= STAR_CUTS.three) return 3;
  if (share >= STAR_CUTS.two) return 2;
  return 1;
}

export const BOOSTERS = {
  plus3: { label: '+3 Pieces', short: '+3', icon: 'pieces', price: 200, about: 'Start with 3 extra pieces.' },
  head: { label: 'Head Start', short: 'Power', icon: 'bolt', price: 250, about: 'Start with the power half charged.' },
};

export const SKIN_ITEMS = [
  { id: 'toybox', label: 'Toybox', price: 0, about: 'Chunky voxel blocks. The classic.' },
  { id: 'clay', label: 'Clay', price: 1500, about: 'Soft matte toy blocks.' },
  { id: 'arcana', label: 'Runes', price: 2500, about: 'Carved rune tiles that glow.' },
];

// Seven-day reward track. It moves one step per day you claim and never resets: missing a
// day costs nothing.
export const DAILY_REWARDS = [
  { coins: 50 },
  { booster: 'plus3', n: 1 },
  { coins: 100 },
  { booster: 'head', n: 1 },
  { coins: 150 },
  { booster: 'plus3', n: 2 },
  { coins: 300, booster: 'head', n: 1 },
];

const START = { coins: 150, boosters: { plus3: 2, head: 1 } };

export function createMeta(store, now = () => Date.now()) {
  const num = (k, d) => {
    const v = store.get(k, d);
    return Number.isFinite(v) && v >= 0 ? v : d;
  };
  const day = () => {
    const d = new Date(now());
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const m = {
    coins: () => Math.floor(num('mb_coins', START.coins)),
    addCoins(n) {
      store.set('mb_coins', m.coins() + Math.max(0, Math.floor(n)));
      return m.coins();
    },
    spend(n) {
      if (m.coins() < n) return false;
      store.set('mb_coins', m.coins() - n);
      return true;
    },

    starsOf(level) {
      const all = store.get('mb_stars', []);
      const v = Array.isArray(all) ? all[level] : 0;
      return Number.isFinite(v) ? Math.max(0, Math.min(3, v)) : 0;
    },
    // Records a clear; returns { stars, best, first } where first means a first clear.
    recordStars(level, stars) {
      const all = store.get('mb_stars', []);
      const list = Array.isArray(all) ? [...all] : [];
      const prev = Number.isFinite(list[level]) ? list[level] : 0;
      list[level] = Math.max(prev, stars);
      store.set('mb_stars', list);
      return { stars, best: list[level], first: prev === 0, gained: Math.max(0, stars - prev) };
    },
    totalStars() {
      const all = store.get('mb_stars', []);
      return Array.isArray(all) ? all.reduce((t, v) => t + (Number.isFinite(v) ? v : 0), 0) : 0;
    },

    boosters() {
      const b = store.get('mb_boosters', START.boosters);
      const out = {};
      for (const k of Object.keys(BOOSTERS)) out[k] = Number.isFinite(b[k]) && b[k] >= 0 ? b[k] : 0;
      return out;
    },
    addBooster(k, n = 1) {
      if (!BOOSTERS[k]) return;
      const b = m.boosters();
      b[k] += n;
      store.set('mb_boosters', b);
    },
    useBooster(k) {
      const b = m.boosters();
      if (!b[k]) return false;
      b[k]--;
      store.set('mb_boosters', b);
      return true;
    },
    buyBooster(k) {
      if (!BOOSTERS[k] || !m.spend(BOOSTERS[k].price)) return false;
      m.addBooster(k, 1);
      return true;
    },

    rewards() {
      const r = store.get('mb_rewards', { step: 0, last: '' });
      const step = Number.isFinite(r.step) ? Math.max(0, Math.floor(r.step)) : 0;
      return { step, ready: r.last !== day(), today: DAILY_REWARDS[step % DAILY_REWARDS.length] };
    },
    claimReward() {
      const r = m.rewards();
      if (!r.ready) return null;
      const gift = r.today;
      if (gift.coins) m.addCoins(gift.coins);
      if (gift.booster) m.addBooster(gift.booster, gift.n || 1);
      store.set('mb_rewards', { step: r.step + 1, last: day() });
      return gift;
    },

    skin: () => {
      const s = store.get('mb_skin', 'toybox');
      return m.ownsSkin(s) ? s : 'toybox';
    },
    ownsSkin(id) {
      if (id === 'toybox') return true;
      const owned = store.get('mb_skins', []);
      return Array.isArray(owned) && owned.includes(id);
    },
    buySkin(id) {
      const item = SKIN_ITEMS.find((s) => s.id === id);
      if (!item) return false;
      if (m.ownsSkin(id)) return true;
      if (!m.spend(item.price)) return false;
      const owned = store.get('mb_skins', []);
      store.set('mb_skins', [...(Array.isArray(owned) ? owned : []), id]);
      return true;
    },
    setSkin(id) {
      if (!m.ownsSkin(id)) return false;
      store.set('mb_skin', id);
      return true;
    },

    settings() {
      const d = { music: true, haptics: true, motion: true, assist: false };
      const s = store.get('mb_settings', d);
      return { ...d, ...(s && typeof s === 'object' ? s : {}) };
    },
    set(key, value) {
      store.set('mb_settings', { ...m.settings(), [key]: !!value });
    },
  };
  return m;
}

// Coins for a clear: more for stars and for the first clear, a fixed bonus for the daily.
export function winCoins({ stars, first, daily }) {
  if (daily) return 120;
  return (first ? 20 : 5) + stars * (first ? 10 : 3);
}
