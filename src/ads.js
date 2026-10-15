// Placeholder ad layer. No ad network is connected yet, so every ad is a short screen
// clearly labeled as a test. Swap these functions for the real SDK calls later.

const NOADS_KEY = 'mb_noads';

// True once the player has bought "Remove ads" (not sold yet; the store isn't connected).
export function adsRemoved() {
  try {
    return localStorage.getItem(NOADS_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function testAd(label, seconds) {
  return new Promise((resolve) => {
    const el = document.getElementById('ad');
    const count = el.querySelector('.ad-count');
    el.querySelector('.ad-label').textContent = label;
    let left = seconds;
    count.textContent = String(left);
    el.hidden = false;
    const timer = setInterval(() => {
      left--;
      count.textContent = String(left);
      if (left <= 0) {
        clearInterval(timer);
        el.hidden = true;
        resolve(true); // a real SDK reports whether the reward was earned
      }
    }, 1000);
  });
}

export const showRewarded = (placement) => testAd(`Test rewarded ad: ${placement}`, 2);
export const showInterstitial = () => testAd('Test interstitial ad', 2);
