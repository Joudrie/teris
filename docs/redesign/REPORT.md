# Redesign report

**Branch:** `claude/studio-redesign`, built on the bug-fix branch `claude/new-session-qpcuho` (its latest commit is merged in).

**The rules are untouched:** `src/core.js`, `src/session.js`, `src/levels.js`, `src/scenes.js`, `src/validate.js` and every test are byte-for-byte unchanged.

Before/after composites for every state are in [compare/](compare/). The reasoning is in [AUDIT.md](AUDIT.md), [DIRECTIONS.md](DIRECTIONS.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [JUICE.md](JUICE.md), [DECISIONS.md](DECISIONS.md) and [SIMILARITY.md](SIMILARITY.md).

## The 10 biggest changes

| # | Change | Before / after |
|---|---|---|
| 1 | **Blocks are voxel cubes**: 16 × 16 pixel-art faces, bevel, gloss and shadow. A magma fire block glows and throws flames, water and sand are smooth bodies, and glass is see-through. | [busy](compare/busy@390x844.jpg), [lineup](compare/lineup@390x844.jpg) |
| 2 | **New HUD**: the goal meter is the hero, with a pieces badge, a next tray in real tiles, a quest chip and a power button that charges and glows. No sentences during play. | [open](compare/open-1s@390x844.jpg) |
| 3 | **A world**: a sky that changes with altitude (sun and clouds, then city, trees and ground), and a framed well with the level plaque. | [open](compare/open-1s@390x844.jpg), [desktop](compare/busy@1440x900.jpg) |
| 4 | **Juice**: goal orbs fly from each reaction into the goal; one praise word at a time; hit-stop on slams and smashes; glass shards; steam, smoke and embers; a power cinematic; a win celebration with confetti. | [combo](compare/combo-peak@390x844.jpg), [power](compare/scene-blaze@390x844.jpg), [smash](compare/scene-slam@390x844.jpg) |
| 5 | **Win screen**: ribbon, three stamped stars, results card, coin reward, a "next up" row with the new material's tile, Continue. | [win](compare/win-screen@390x844.jpg) |
| 6 | **Lose screen**: progress ring with "N to go", a gift-first revive, Try again, Give up. | [lose](compare/scene-lose@390x844.jpg) |
| 7 | **Tower map** replaces the manual: 100 floors with stars, wordmark, coins and stars, daily, gifts, shop, the Blocks codex, boosters and a big Play button. | [home](compare/scene-home@390x844.jpg) |
| 8 | **Meta and store UI**: stars from pieces left (calibrated by `tools/stars.js`), coins, two boosters, a 7-day gift track that never resets, and three block skins. Real-money items are honest stubs. | [shop and sheets](after/) |
| 9 | **Sound**: a procedural engine with compressor, reverb, signature sounds per reaction, a combo pitch ladder and generative music that builds with goal progress. | `src/sound.js` |
| 10 | **Brand**: the Tumbledown wordmark, app icon and six App Store screenshots. | [store](store/store-overview.jpg) |

## Fresh-eyes review loop

Each round, a new agent with no context saw only the before/after composites and the store set, and rated both for "looks like a top-grossing studio game". Every round's top problems were fixed before the next round.

| Round | Before | After | What the round changed |
|---|---|---|---|
| 1 | 2 | **6** | Baseline |
| 2 | 2 | **5** | Effects clipped to the board, flashes off the HUD, one praise slot, magma fire, takeover win and lose screens, plainer copy, hero store set |
| 3 | 2 | **5** | Round sun and clouds, an idle power button that keeps its color, landscape HUD aligned to the board, lose copy stated once |
| 4 | 2 | **6** | 16 × 16 faces, a solid ghost, a brighter well, clearer glass and wet wood, a three-tongue flame icon, round map clouds, an opaque ad screen, shiny stars |

Round 4 saw a combo still taken at the praise word's peak (`combo-peak`). The generic scene timing had caught the frame just after the word faded; [motion-combo](after/motion-combo.jpg) shows the full arc. After round 4 I fixed the concrete bugs it found: the event banner wraps instead of clipping in narrow wells, the map's booster chips are solid and the dock fade hides nodes passing under Play, "Give up" is a text link under the revive, and the revive line reads "The board filled up! Clear the top rows and keep going." The final browser check also caught a real bug: the "power ready, swipe up" callout sat over the board and swallowed the swipe it asked for. A swipe that starts on the callout now plays and dismisses it; a tap on it only dismisses it. I stopped the loop there: its remaining asks are art direction, not bugs (below).

**Where it plateaued, and why.** Every reviewer's first complaint was the same: pixel-art blocks inside a glossy vector UI, "rebuild them as high-res glossy tiles". That conflicts with the brief ("pixelly like Minecraft, flat but with depth"). I kept pixel faces, moved to a finer 16 × 16 grid, and added volume and gloss, which narrows the clash without dropping the look you asked for. If you'd rather have the glossy, non-pixel look, the **Clay** skin is already built and can become the default with a two-line change in `src/meta.js` (the default skin and the owned-skins check).

The second recurring complaint is the empty board early in a level. That's level design (most levels start nearly empty), which the brief protects. Possible fixes are listed under next steps.

## Checks

| Suite | Result |
|---|---|
| `npm test` | **123 / 123** |
| `node tools/browser/hook.mjs` | **14 / 14**: a piece falls at 0 s, the first reaction lands at 7.2 s, level 1 clears in about 80 s |
| `node tools/browser/cards.mjs` | **40 / 40** |
| `node tools/browser/check.mjs` | **35 / 36**: the failing row is the 4× CPU-throttle frame rate (below) |

### Checks I changed (intent kept)

1. **`check.mjs`, "home screen scrolls":** the home button now opens the pause sheet, so the check taps Pause, then Tower map. It reads `scrollTop` from the map's scroll container (`#mapScroll`).
2. **`check.mjs`, overlays in random order:**
   - The random clicks now also include the new buttons (`resumeBtn`, `pauseHome`, `powerBtn`, `shopBtn`, `sheetX`).
   - The recovery loop closes an open sheet.
   - The final input test slows the fall first, as the swipe checks in the same file already do. A random sequence could otherwise end with the piece locking between the two reads, a false failure.
3. **`hook.mjs`, mute and daily:** the sound toggle lives in the pause sheet now, so the check opens Pause before tapping `#muteBtn`, then goes to the map with `#pauseHome`.

No check was removed or loosened.

### Performance (same machine, software-rendered headless Chromium, busy level 20)

| | 1× CPU | 4× CPU |
|---|---|---|
| Prototype | 60 fps, JS 1.7 ms/frame | 50–51 fps, JS 8–9 ms/frame |
| Redesign | 59–60 fps, JS 5–6 ms/frame | 14–21 fps, JS 36–53 ms/frame |

**At normal speed the redesign holds 60 fps.** Under 4× throttling in this software-only environment it doesn't.

What I did about it:
- **Dynamic resolution:** the board drops from 2× to 1.5× to 1× when frames run long.
- **A lite tier:** the lowest step drops shadows, ripples and the char pass.
- **Caching:** settled blocks are cached.
- **No particle writes:** the renderer never writes to particles; texture offsets live in a `WeakMap` after I found that writing fields onto them slowed the simulation.
- **Fewer allocations and layers:** lookup tables replace per-frame color math, and the world is the page background rather than a canvas layer.

What remains:
- **Two costs are left:** the simulation itself, which runs more ticks per frame as frames get longer, and native compositing, which real phones do on the GPU.
- **Not verified on hardware.** This needs a test on a real mid-range Android phone before shipping. If it's short there, the next step is a WebGL renderer for the board.

## Stubbed, and what it needs to become real

- **Store:** coin packs, the starter pack and Remove ads open a "store not connected" sheet. They need the App Store / Google Play billing SDK. Coins, boosters and skins already work in-game.
- **Ads:** the placeholder screens still use the session's pacing and revive rules. They need an ad SDK wired into `src/ads.js` and the session hooks (`watchRevive`, `watchMeterAd`, the interstitial in `next`).
- **Name:** "Tumbledown" needs a trademark search (alternatives are in [DECISIONS.md](DECISIONS.md)).

## Known issues

- The 4× frame-rate row above.
- The fresh-eyes reviewers rate the result 5–6 out of 10 against Royal Match (round 4: 6). Their remaining asks: one high-res glossy block style instead of pixel faces, layered sparkle particles instead of plain orbs, a dedicated landscape layout, illustrated scenery or a mascot on the map, and less empty boards at level start.
- Haptics only fire where `navigator.vibrate` exists (Android Chrome). iOS Safari has no vibration API.
- Font licenses and every asset are listed in [docs/CREDITS.md](../CREDITS.md). All art and audio are made in code.

## Next 5 steps

1. Profile on two real phones (a mid-range Android and an older iPhone). If needed, move the board renderer to WebGL (PixiJS) using the same tile atlases.
2. Decide the art question above: pixel faces (current) versus the glossy Clay skin as default. Then commission or paint a map environment with landmarks per altitude band.
3. Start levels with a little more on the board: a few placed blocks per generated level. This is a balance change, so re-run `tools/calibrate.js` and `tools/correct.js` afterwards.
4. Hook up the store and ad SDKs; add analytics for the playtest fields that already exist.
5. Run the five-player playtest in `docs/PLAYTEST.md` on the new build, with a question added about the map and the meta loop.
