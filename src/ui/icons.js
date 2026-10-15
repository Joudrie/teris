// One icon set for the whole game: chunky filled shapes on a 24-unit grid. They take the
// text color (currentColor); CSS adds the dark outline with `paint-order: stroke`, so the
// same icon works on a button, a badge or a panel. No emoji, no Unicode glyphs.

function gear() {
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const r = k % 2 ? 7.2 : 9.6;
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `<path fill-rule="evenodd" d="M${pts.join('L')}Z M12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8Z"/>`;
}

const P = {
  pause: '<rect x="5" y="4" width="5" height="16" rx="1.6"/><rect x="14" y="4" width="5" height="16" rx="1.6"/>',
  play: '<path d="M7 4.6v14.8a1.1 1.1 0 0 0 1.7.9l11.8-7.4a1.1 1.1 0 0 0 0-1.8L8.7 3.7A1.1 1.1 0 0 0 7 4.6z"/>',
  star: '<path d="M12 2.4l2.95 6.05 6.65.85-4.9 4.6 1.3 6.6L12 17.25l-6 3.25 1.3-6.6-4.9-4.6 6.65-.85z"/>',
  coin: '<circle cx="12" cy="12" r="9.2"/><circle class="i-in" cx="12" cy="12" r="6"/><path class="i-hi" d="M10.6 8h2.8v8h-2.8z"/>',
  lock: '<path d="M7.4 10.5V7.8a4.6 4.6 0 0 1 9.2 0v2.7h-2.7V7.8a1.9 1.9 0 0 0-3.8 0v2.7z"/><rect x="4.8" y="10" width="14.4" height="10.6" rx="2.6"/>',
  gear: gear(),
  home: '<path d="M12 2.8l9.4 8.4h-2.6v9.4h-5.2v-6.2h-3.2v6.2H5.2v-9.4H2.6z"/>',
  close: '<path d="M6.2 3.9L12 9.7l5.8-5.8 2.3 2.3-5.8 5.8 5.8 5.8-2.3 2.3-5.8-5.8-5.8 5.8-2.3-2.3 5.8-5.8-5.8-5.8z"/>',
  retry: '<path d="M12 3.6a8.4 8.4 0 1 1-8.1 10.6h3a5.6 5.6 0 1 0 5.1-7.8v3.4L6.6 5.2 12 .6z"/>',
  sound: '<path d="M3.5 8.8h4.2L13 4.4v15.2l-5.3-4.4H3.5z"/><path d="M15.4 8.1l1.6-1.5a7.4 7.4 0 0 1 0 10.8l-1.6-1.5a5.2 5.2 0 0 0 0-7.8z"/>',
  mute: '<path d="M3.5 8.8h4.2L13 4.4v15.2l-5.3-4.4H3.5z"/><path d="M15.2 9.4l1.5-1.5 2.1 2.1 2.1-2.1 1.5 1.5-2.1 2.1 2.1 2.1-1.5 1.5-2.1-2.1-2.1 2.1-1.5-1.5 2.1-2.1z"/>',
  music: '<path d="M8 5.6l12-2.6v12.4a3.1 3.1 0 1 1-2.2-3V7.2L10.2 8.8v8.8a3.1 3.1 0 1 1-2.2-3z"/>',
  haptic: '<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M2.5 8h2v8h-2zM19.5 8h2v8h-2z"/>',
  gift: '<rect x="2.8" y="8.6" width="18.4" height="4.6" rx="1.2"/><rect x="4.4" y="13.2" width="15.2" height="8" rx="1.2"/><path class="i-in" d="M10.7 8.6h2.6v12.6h-2.6z"/><path d="M12 8.6C10.2 4.6 6 4.2 6 6.6s4.1 2 6 2c1.9 0 6 .4 6-2s-4.2-2-6 2z"/>',
  shop: '<path d="M5.4 8.2h13.2l1.2 12.8H4.2z"/><path d="M8.6 8.2a3.4 3.4 0 0 1 6.8 0h-2.3a1.1 1.1 0 0 0-2.2 0z"/>',
  calendar: '<rect x="3.2" y="4.8" width="17.6" height="15.8" rx="2.6"/><path class="i-in" d="M3.2 9.6h17.6v2H3.2z"/><rect x="7" y="2.6" width="2.4" height="4.6" rx="1"/><rect x="14.6" y="2.6" width="2.4" height="4.6" rx="1"/>',
  check: '<path d="M3.6 12.4l2.4-2.4 4 4 8-8 2.4 2.4-10.4 10.4z"/>',
  info: '<circle cx="12" cy="12" r="9.4"/><path class="i-in" d="M10.8 10.4h2.4v7h-2.4zM10.8 6.4h2.4v2.4h-2.4z"/>',
  trophy: '<path d="M6.5 3.5h11v4.6a5.5 5.5 0 0 1-11 0z"/><path d="M3 5h3.4v2H5a2.4 2.4 0 0 0 2 2.4v2A4.4 4.4 0 0 1 3 7zM21 5h-3.4v2H19a2.4 2.4 0 0 1-2 2.4v2A4.4 4.4 0 0 0 21 7z"/><path d="M10.6 13.4h2.8v3.6h-2.8z"/><rect x="7" y="17" width="10" height="3.6" rx="1.2"/>',
  target: '<circle cx="12" cy="12" r="9.4"/><circle class="i-in" cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.6"/>',
  pieces: '<rect x="2.8" y="12" width="8.6" height="8.6" rx="1.8"/><rect x="12.6" y="12" width="8.6" height="8.6" rx="1.8"/><rect x="7.7" y="2.8" width="8.6" height="8.6" rx="1.8"/>',
  flask: '<path d="M8.8 2.8h6.4V5h-1.1v4.1l5.6 8.9a2.5 2.5 0 0 1-2.1 3.8H6.4a2.5 2.5 0 0 1-2.1-3.8l5.6-8.9V5H8.8z"/><path class="i-in" d="M7.2 15h9.6l1.4 2.4a1 1 0 0 1-.8 1.5H6.6a1 1 0 0 1-.8-1.5z"/>',
  flame: '<path d="M12 1.8c1 4.2 6.4 6.2 6.4 12.4a6.4 6.4 0 0 1-12.8 0c0-3.2 2-5.2 3.2-6.2 0 2 .9 3.2 2.1 3.4.3-3.3-.9-6.6 1.1-9.6z"/><path class="i-in" d="M12 12.4c.6 1.8 3 2.6 3 5a3 3 0 0 1-6 0c0-1.4.8-2.4 1.6-2.8.1 1 .6 1.4 1 1.4.1-1.4-.3-2.6.4-3.6z"/>',
  drop: '<path d="M12 2.2c3.1 4.6 6.8 8.2 6.8 12.4a6.8 6.8 0 0 1-13.6 0c0-4.2 3.7-7.8 6.8-12.4z"/><path class="i-in" d="M9.2 13.8c0 2 1.2 3.4 2.6 3.8-.3.6-1 .8-1.6.6a3.6 3.6 0 0 1-2.4-3.8z"/>',
  snow: '<rect x="10.8" y="2" width="2.4" height="20" rx="1.2"/><rect x="10.8" y="2" width="2.4" height="20" rx="1.2" transform="rotate(60 12 12)"/><rect x="10.8" y="2" width="2.4" height="20" rx="1.2" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="3.2"/>',
  hammer: '<path d="M12.4 2.4l7.2 7.2-2.6 2.6-2-2-1.6 1.6-3.6-3.6 1.6-1.6-2-2z"/><path d="M9.6 9.8l3.6 3.6-8 8a1.4 1.4 0 0 1-2 0l-1.6-1.6a1.4 1.4 0 0 1 0-2z"/>',
  wind: '<path d="M2.6 8.6h11.6a2.6 2.6 0 1 0-2.6-2.6H9.2a5 5 0 1 1 5 5H2.6z"/><path d="M2.6 12.8h14.6a3.4 3.4 0 1 1-3.4 3.4h2.4a1 1 0 1 0 1-1H2.6z"/>',
  rain: '<path d="M6.8 13.6a4.4 4.4 0 0 1 .3-8.8 5.6 5.6 0 0 1 10.6 2.1 3.4 3.4 0 0 1-.2 6.7z"/><path d="M7.6 15.6h2.2l-1.6 4.6H6zM12.4 15.6h2.2L13 20.2h-2.2zM17.2 15.6h2.2l-1.6 4.6h-2.2z"/>',
  log: '<rect x="3" y="6" width="18" height="12" rx="6"/><circle class="i-in" cx="15" cy="12" r="3.6"/>',
  back: '<path d="M14.8 3.6l2.4 2.4-6 6 6 6-2.4 2.4L6.4 12z"/>',
  bolt: '<path d="M13.6 2L4.6 13.4h6l-1.4 8.6 9.2-11.6h-6z"/>',
  book: '<path d="M4 4.4c3-1 5.6-.6 8 1.2v15c-2.4-1.8-5-2.2-8-1.2z"/><path d="M20 4.4c-3-1-5.6-.6-8 1.2v15c2.4-1.8 5-2.2 8-1.2z"/>',
  plus: '<path d="M10.4 4h3.2v6.4H20v3.2h-6.4V20h-3.2v-6.4H4v-3.2h6.4z"/>',
  hand: '<path d="M8.6 11.2V4.6a1.6 1.6 0 0 1 3.2 0v5.6h.6V8.8a1.6 1.6 0 0 1 3.2 0v1.6h.6V9.8a1.6 1.6 0 0 1 3.2 0v5.4a6.2 6.2 0 0 1-6.2 6.2h-1.1a6.2 6.2 0 0 1-5.1-2.7l-3-4.4a1.7 1.7 0 0 1 2.6-2.1l2 2.1z"/>',
  ad: '<rect x="2.6" y="5" width="18.8" height="14" rx="3"/><path class="i-in" d="M10 9l5 3-5 3z"/>',
};

export const ICONS = P;

export const icon = (name, cls = '') => `<svg class="ic ic-${name} ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

// Icons for the materials and powers, used in the codex, quest chip and ability button.
export const MATERIAL_ICON = { fire: 'flame', water: 'drop', wood: 'log', wetwood: 'log', ice: 'snow', sand: 'wind', glass: 'bolt', stone: 'hammer', brick: 'pieces', mud: 'drop' };
export const POWER_ICON = { rain: 'rain', blaze: 'flame', freeze: 'snow', sweep: 'wind', hammer: 'hammer' };
export const QUEST_ICON = { chain: 'bolt', combo: 'bolt', douse: 'drop', burn: 'flame', melt: 'snow', smash: 'hammer' };
