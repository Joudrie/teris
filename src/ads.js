// Placeholder ad layer. No ad network is connected yet: the session shows a short screen
// clearly labelled as a test ad (see session.js, AD_TIME). Swap in the real SDK here later.

const NOADS_KEY = 'mb_noads';

// True once the player has bought "Remove ads" (not sold yet; the store isn't connected).
export function adsRemoved() {
  try {
    return localStorage.getItem(NOADS_KEY) === '1';
  } catch (e) {
    return false;
  }
}
