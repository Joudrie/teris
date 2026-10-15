# Game feel: every number

Where each effect lives: board effects are in [`src/render/board.js`](../../src/render/board.js); screen effects in [`src/render/fx.js`](../../src/render/fx.js); event wiring in `handleEvents()` in [`src/main.js`](../../src/main.js); sounds in [`src/sound.js`](../../src/sound.js); CSS motion in [`style.css`](../../style.css).

| Moment | Visual | Timing / amplitude | Sound | Haptic |
|---|---|---|---|---|
| **Move** | The piece slides between columns (render-only tween) | Exponential approach, about 60 ms to settle (`dt × 28`) | `move` tick, very quiet | – |
| **Rotate** | Snap (the simulation's rotation, with wall kicks) | – | `rotate` tick | – |
| **Ghost** | Faint real tiles at the landing spot under a silhouette tinted by the piece's own material, with a bright rim. Fades in just after the piece spawns, so the reaction the last piece set off keeps the stage | Tiles at 28% alpha, tint at 20%; fade-in from 100 to 300 ms after spawn | – | – |
| **Telegraph** | The blocks the piece would react with on landing get an ink and gold pulsing outline. Fades in with the ghost | Pulse period about 880 ms | – | – |
| **Land (gentle)** | Two small dust puffs at the outer bottom corners | 0.35–0.6 s | `land` thunk | – |
| **Slam** | Dust burst of 14 puffs, white impact ring, well shake. Slamming into something it reacts with skips the dust and ring, so nothing covers the reaction | Shake 9 px decaying at 40 px/s; **hit-stop 50 ms** | `slam` thud and crunch | 25 ms |
| **Smash (glass)** | 34 rotating shards with gravity, a ring, a pale flash, "SMASH!" in aqua at the impact | Flash 160 ms at 35%; shake 12 px; **hit-stop 80 ms** | `shatter` with falling tinkles | 30-20-40 |
| **Cancel (the core moment)** | Every particle a reaction removes leaves a trace exactly where it was (`drawFizz` in `board.js`). Fire and water that cancel flash white-hot in place, then each becomes a steam wisp that grows and rises; the water visibly shrinks into the fire under a boiling white edge, and the steam cloud keeps the cancel's shape. Burned wood flashes ember-orange, then smokes. Sand, mud, stone and glass leave dust that falls and fades | Hot flash for the first 14% of a trace's life. Steam lives 0.95–1.35 s and rises 1.5 cells; smoke 0.95–1.3 s; dust 0.4–0.6 s | `steam` hiss (rate-limited); `burn` crackle | – |
| **Burn** | Ember sparks; the block glows and chars (heat field, multiply plus lighter); each burned particle smokes (see Cancel) | Glow pulse about 750 ms | `burn` crackle | – |
| **Fire block** | 4-frame ember animation, flame tongues on every exposed top, soft glow onto neighbors | Frames every 110 ms; glow pulse about 1.5 s | – | – |
| **Water** | Depth-tinted body, moving ripple lines, wobbling bright surface lip | Ripples drift about 25 px/s | – | – |
| **Drain (the main loop)** | Each piece drained sends a glowing orb (white core, bright material color) arcing into the goal icon. On arrival: icon pop, ring, the number ticks up and the bar fills | Arc 500–620 ms, ease-in, 70 ms stagger; bar fill 300 ms out-expo | `drain` note that climbs the scale with combo and count | – |
| **Combo ×2 / ×3 / ×4** | "Nice!" / "Great!" / "Amazing!" in the one gold style with a "×N combo!" sub-line. One praise slot, so words never stack | Pop to 115% then settle in 280 ms, hold, then float and fade over 1.1 s; size 58/64/70 px. No flash: it would wash out the cancel it is praising | `combo` arpeggio, longer per tier | 15 ms × tier |
| **Power ready** | Button gets a white ring, colored glow and pulse; tag turns red "READY!" | Pulse 1.2 s | `ready` shimmer | 30 ms |
| **Power fired** | Full-screen flash in the power's color, the power's name in big gradient type with "+N", every cleared block bursts into cubes and a third of them fly to the goal | Flash 550 ms at 50%; shake 16 px; **hit-stop 120 ms**; flights start after 250 ms | `power` sweep tinted per power, music ducks | 40-30-80 |
| **Quest done** | Green toast drops in, a ring pulses on the quest chip, the chip turns green | Toast 1.8 s | `quest` chime | – |
| **Low pieces** | Badge turns red with a double heartbeat at 3 left; red vignette at 1 | Heartbeat 1 s | `heartbeat` at 3 | – |
| **Win** | Every block bursts into voxel debris, 140 confetti pieces, a cream flash, "CLEARED!" with "N pieces to spare!" | Celebration 2.2 s (session timing) | `win` fanfare | 30-30-30-30-80 |
| **Win screen** | Ribbon drops in, rays spin, stars stamp in one by one, card rises, buttons rise, then coins fly to the top | Ribbon 520 ms; stars at 350, 670 and 990 ms; card +120 ms; buttons +240 ms; coins at 1.3 s | `star` per star; `coin` | 20 per star |
| **Lose** | Board desaturates and dims; blue ribbon; progress ring fills to the real percentage | Desaturate 600 ms; ring 900 ms | `lose` (gentle) | 60-40-60 |
| **Level intro** (from the map) | Card with "Level N" and chips (goal, pieces, power, boosters) | 1.7 s, skipped by any input | `whoosh` | – |
| **Buttons** | Face moves down, lip collapses | 120 ms | `tap` | – |
| **Sheets** | Pop in from 82% with overshoot over a dimmed backdrop | 340 ms | `open` / `close` | – |

**Reduced motion** (OS setting or the in-game toggle): no shake, flashes at 40%, at most 2 particles per burst, CSS animations off. Every number, word and sound stays.

**Dynamic quality:** the board starts at the device's pixel ratio (up to 2×). If frames run long, it steps down to 1.5× and then 1×. The lowest step also drops block shadows, water ripples and the char pass, and draws every other steam wisp (each twice as strong).
