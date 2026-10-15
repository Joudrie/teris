# Decisions

Each entry gives the choice, the alternatives considered, and why this one won.

## Direction: Toybox

- **Chosen:** chunky voxel cubes with pixel-art faces under a candy bevel, a bright sky world, and Royal Match-style press UI.
- **Rejected:** **Arcana** (rune tiles, dusk tower) and **Clay** (soft matte diorama). All three were rendered on the real renderer ([DIRECTIONS.md](DIRECTIONS.md)).
- **Why:** Toybox is the only one that matches every word of the brief: *2D but 3D*, *pixelly like Minecraft*, *Candy Crush polish*, *feels like it makes money*. It also keeps materials physical, so "fire burns wood" needs no explaining. Arcana's best idea (an icon per material) survives as the color-assist mode. Both alternatives also ship as purchasable block skins ("Runes", "Clay"), so that exploration became sellable content.

## Rendering: Canvas 2D with baked tiles (approach A)

- **Rejected:** PixiJS/WebGL (B) and Three.js voxels (C).
- **Why:** A gives the full look with no dependencies, no build step and nothing to load. It keeps the static-file and artifact deploy, and the depth comes from baked bevels, gloss and shadows, which the references (Block Blast, Minecraft) show is enough. C's real lighting would cost readability, and on low-end phones the frame rate.
- **How:** One tile per material, variant and fire frame is baked per board size. Intact cells stamp a whole tile; partly burned or crumbled cells cut particle-sized pieces from it and get fresh bevels on the broken edges. Loose materials are smooth bodies: interior runs as rectangles, edge particles as discs, colored from a smoothed particle field. Static blocks are cached and redrawn only when they change. A dynamic-resolution step-down protects the frame rate.
- **No rule changes:** the renderer never writes to a particle. Texture offsets live in a `WeakMap`, which matters: writing extra fields onto particle objects made the simulation measurably slower.

## Name: Tumbledown

- **Chosen:** Tumbledown. Blocks tumble, the tower is climbed down floor by floor, and things crumble. It's short, warm and unusual in this genre.
- **Alternatives:** *Element Drop*, *Blockfall Tower*, *Meltdown*, *Douse!*.
- **Caveat:** it still needs a trademark search before shipping. The name is one constant (`BRAND` in `src/main.js`) plus the wordmark image, so swapping it is cheap.

## Layout

- **Goal meter top-center**, the hero. The pieces badge sits top-right, the only other number at the top.
- **Next, quest and power in the bottom thumb zone.**
- **The board is as large as the screen allows**, in a framed well with the level plaque on its rim.
- **Why:** every reference keeps at most two numbers at the top and puts actions in thumb reach.
- **Same skeleton as the prototype?** Only in the trivial sense that the board is in the middle with HUD above and below. Every element changed: the drain bar moved from a 14 px side sliver to the hero meter; the tip line and banner are gone; next, quest and power went from text to the bottom bar; the power gained a tap target.
- **Rejected:** a side tube for the goal. It costs about 40 px of board width.

## Power: tap and swipe

The prototype only had swipe up, which nothing on screen invited. A glowing button that charges visibly is discoverable and accessible. Swipe up still works.

## Opening flow

- **First launch still drops straight into level 1** (the instant hook: a piece is falling at 0 s and the first reaction lands at 7.2 s).
- **Returning players** reach the map from pause. Play from the map shows a 1.7 s level card (goal, pieces, power, boosters), skippable by any input.
- **"Continue" on the win screen goes straight into the next level**, keeping the one-tap loop the hook checks for.

## Stars

The rule is pieces left at the clear, as a share of the budget: 3 stars at 8% or more, 2 stars at 3% or more, 1 star for any clear. The cut-offs come from `tools/stars.js` (casual and newbie bots, levels 1–60, 356 wins): 3% is about the median and 8% about the best fifth. Stars never affect whether a level is won.

## Economy

- **One currency (coins).**
- **Earned:** 20 + 10 per star on a first clear, 5 + 3 per star on a replay, 120 for the daily, plus daily gifts.
- **Spent:** two boosters (+3 pieces for 200, Head Start for 250) and two skins (1,500 and 2,500).
- **New players start with** 150 coins, 2 × +3 pieces and 1 × Head Start.
- **Real-money items** (coin packs, starter pack, Remove ads) open an honest "store not connected" sheet.
- **No lives or energy.** It's the biggest revenue lever and the biggest churn risk; with daily gifts and rewarded revives already in place, we'd rather keep play unlimited at launch and test lives later behind a flag.
- **Daily gifts** never reset when a day is missed.
- **Boosters are never needed:** every level is calibrated without them.

## Copy

- Short verbs and numbers: "Put out 4 fire", "+5 Pieces", "Next up: level 5".
- Praise ladder: Nice!, Great!, Amazing!
- "So close! 88%" stays (justified in [SIMILARITY.md](SIMILARITY.md)).
- The revive offer leads with the gift and names the ad underneath it.

## Audio: procedural, not samples

- The container's network blocks freesound and GitHub raw, and procedural keeps the build tiny and license-free.
- The engine has a master compressor, separate sound and music buses, a generated convolution reverb, pitch and timing jitter, and a generative music system whose layers build with goal progress.

## Things deliberately not changed

- Rules, reaction timings, the board size and level budgets.
- Ad pacing.
- Revive types.
- The helping hand.
- The daily challenge's shared seed.
- The `mb_*` save keys.

`src/core.js`, `src/session.js` and `src/levels.js` are byte-for-byte unchanged.
