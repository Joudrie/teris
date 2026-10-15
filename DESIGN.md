# Material Blocks: design, test cards and bug log

## SUMMARY

Phase 5 (mechanics, progression, instant hook) and Phase 6 (bug overhaul) are done. Every number in this file comes from a script in `tools/` and can be re-run (see [How to re-run](#how-to-re-run)).

**What changed in the game**

- **A piece budget per level** ("fill the bar in N pieces"). This is the biggest change. In this ruleset nearly everything reacts with everything, so before this even random play filled the bar before the board topped out: the random bot won 100% of levels 1–30. Placement still makes a real difference to *efficiency* (about 15% more drain per piece for a sensible player than a random one), and a budget turns that into wins and losses. It also makes near misses honest and common ("So close! 92%"). The board topping out is still a loss too.
- **Budgets are set by playing.** `tools/calibrate.js` plays every level with the human-ish bot and sets the budget so the share who clear it first time follows a sawtooth target (harder, harder, breather, hardest, showcase).
- **A new teaching progression.** There are 20 hand-made levels with one new idea each and a first-time callout on the board. Each is set up so the lesson can't be missed. There is a showcase every 5 levels, then generated levels 21–100 on a sawtooth.
- **An instant hook.** The game opens straight into play with a piece already falling and the first reaction landing at about 7 s with no input. There are generated WebAudio sounds with a mute button, a +N popup and a bar bump on every drain, a slam thud, and a win screen that previews what's new next level and plays on in one tap. There's also a daily challenge with a streak.
- **Mechanics fixed or cut after their test cards.**
  - *Cut:* wood floating, which was dead code because water always dissolved the wood first. Also cut: mud baking into brick, which punished the player with no warning.
  - *Fixed:* stone and brick erosion was invisible (8 s per layer). Erosion now spreads through the piece and crumbles it to sand in about 2 s, and the clouds behind the board no longer look like rubble.
- **Session layer.** `src/session.js` now holds the screens, ad pacing, revive, helping hand, callouts and daily challenge, outside `main.js`. It has no DOM, so it can be unit-tested and fuzzed.

**Final win rates (all three bots, every level)**

<!-- gen:winrates -->
| Levels | Target (casual, first try) | Random bot | Human-ish bot | Human-ish, first try in a campaign | Expert (smart) bot |
|---|---|---|---|---|---|
| Teach (1-3) | 96% | 77% (100% with revive) | 99% (100% with revive) | 98% | 100% (100% with revive) |
| Early (4-10) | 77% | 24% (81% with revive) | 82% (100% with revive) | 80% | 83% (100% with revive) |
| Early (11-20) | 71% | 26% (82% with revive) | 64% (100% with revive) | 66% | 74% (100% with revive) |
| Mid (21-40) | 54% | 8% (56% with revive) | 54% (98% with revive) | 53% | 63% (100% with revive) |
| Mid (41-60) | 52% | 6% (52% with revive) | 57% (97% with revive) | 59% | 71% (100% with revive) |
| Late (61-80) | 50% | 4% (41% with revive) | 55% (97% with revive) | 56% | 68% (100% with revive) |
| Late (81-100) | 48% | 3% (30% with revive) | 50% (98% with revive) | 50% | 56% (100% with revive) |
| **All 100** | 56% | 11% | 58% | 59% | 68% |

Win = cleared without the revive. 6000 rig games in total, every one with the invariant checks on every tick.
<!-- /gen:winrates -->

Reading the table:
- Skill decides outcomes. From level 21 on, random play wins 3–8%, the human-ish bot about 55% and the expert 56–71%.
- The human-ish bot's first-try rate follows the targets within a few points per band. Mid levels (21–60) come out at 56% against an aim of 40–55%, one point over.
- Per level, 10 of 100 levels land more than 20 points from their target. Needs cluster on a few piece counts, so one piece of budget can move a level's win rate by 30 points, and 30 games per level carries about ±9 points of noise.

**Bugs fixed: 10** (see the [bug log](#bug-log)).

**Final fuzz: 5,500 games** (1,375 per level band, 3.1 million frames) through the whole session with hostile input: **0 crashes, 0 invariant breaks**. On top of that come 6,000 rig games and about 4,000 campaign games, all with the validator on every tick, also with 0 breaks.

**Browser:** all checks pass at 390×844 and 375×667 with touch: 36 mobile checks, 14 hook checks, and 40 card scenes re-checked in the browser.

**Top 5 next steps**

1. **Playtest with real people.** All tuning so far is against bots. Put levels 1–10 in front of five new players and compare time to first drain, the win rate and where they hesitate against the newbie and human-ish bots. Then re-run `tools/calibrate.js` with the human-ish bot adjusted to match them.
2. **Deepen decisions.** The expert bot (which simulates its options) only beats the human-ish bot by a few points. Placement mostly matters through efficiency. Three ideas to test with the rig: combos that count toward the bar (rewarding set-ups), more materials that *punish* a wrong neighbour (like ice freezing water) and two-material pieces where the halves *do* react.
3. **Real art and audio pass.** The textures and generated sounds work as hooks but are placeholders. Material identity at 4×4 particles is the main readability risk. Glass and ice are the closest pair.
4. **Connect the real ad SDK and store.** `src/session.js` (`AD_TIME`, `next`, `watchRevive`, `watchMeterAd`) and `src/ads.js` are the seams. Pacing rules are already enforced and tested.
5. **Retention beyond the session.** Daily challenge results could feed a weekly ladder, the streak could earn a cosmetic, and an analytics hook could log the same proxies the rig measures from real devices.

---

## How the game works now

- **Goal:** fill the drain bar beside the board by putting materials next to the ones that cancel them, within the level's **piece budget** (shown as "N left" in the HUD).
- **Losing:** you lose when the pieces run out short of the goal (after the board finishes reacting), or when the board tops out. Either way you get **one revive**: +5 pieces, or the top 4 rows cleared.
- **Power:** each level has one. Draining fast builds a combo, which charges the meter faster. A full meter means swipe up. It fires about once per level for a casual player.
- **Side quest:** one per level (combo, douse, burn, melt or smash). Completing it tops up the meter.
- **Controls:** swipe to move, drag down to drop faster, flick down to slam (this smashes glass), tap to rotate, swipe up for the power.

### Materials and reactions (after this pass)

| Material | Goes away by | Notes |
|---|---|---|
| Fire | water (both drain) | never burns out on its own: a reusable tool |
| Water | fire, sand (to mud), wood (soak) | freezes next to ice |
| Wood | fire (whole piece burns), water twice | wet wood steams, dries, then burns |
| Ice | fire (melts to water) | grows when water touches it |
| Sand | water (to mud, which sinks), fire (to glass) | |
| Glass | a slam, or stone landing on it, or a long fall | whole pane smashes |
| Stone | water: crumbles to sand through the whole piece | heavy: smashes glass even placed gently |
| Brick | water: crumbles to sand (faster than stone) | |
| Mud | sinks away by itself in about a second, or water washes it | |

---

## Progression

Teach one idea, test it, then combine. The order follows what each material needs:
- Fire and water need nothing else, so they come first.
- Wood needs fire.
- Sand needs water.
- Glass needs a slam, or fire plus sand.
- Ice needs fire, and it punishes water.
- Two-material pieces need the player to know what each half wants, so they come after the single materials.
- Stone and brick are the "junk" that clogs boards, so they come last.

| Level | New idea | Set-up so it can't be missed | Showcase |
|---|---|---|---|
| 1 | Water puts out fire | A fire bed across the floor; the first two pieces are water | |
| 2 | Set up your own reactions | Two small fire beds; first piece water runs into both | |
| 3 | **Wood** burns | A woodpile in the middle; first piece is fire | |
| 4 | **Sand** + water = mud | A dune across the floor; first two pieces water | |
| 5 | **Glass**: flick to slam | Two glass towers in the middle | ★ glass tower |
| 6 | Fire melts sand into glass | A sand mound; first piece fire | |
| 7 | **Ice**: fire melts it, water freezes on it | An ice block; first piece fire | |
| 8 | **Two-material pieces** | Fire on one side, water on the other; first piece wood + ice | |
| 9 | Everything so far (first real test) | | |
| 10 | **Power: Fire Mode** | A wood wall, meter starts at 60% | ★ firebreak |
| 11 | **Stone** smashes glass | Glass towers; first piece stone | |
| 12 | **Flood** mode | Water rises from the floor | |
| 13 | **Brick** wears to sand | A brick slab; first two pieces water | |
| 14 | Breather | Friendly wood bag | |
| 15 | Stone on a tall tower | A 9-pane tower; first piece stone | ★ skyscraper |
| 16 | **Wall** mode | A wood wall with one gap | |
| 17–19 | Breather, flood + stone, breather | | |
| 20 | Ice wall + Deep Freeze | An ice wall, meter at 50% | ★ glacier |
| 21–100 | Generated: themes rotate (wood, water, sand, glass, ice); modes alternate; harder bags; showcase every 5th | | ★ every 5 |

**Callouts.** The first time a level brings in something new, a one-line callout appears on the board. Examples: "New: GLASS. Flick down to SLAM a piece and smash it!" and "New: ICE. FIRE melts it. Water that touches ice freezes!" It shows once per level ever (it is remembered across sessions). It fades after 4.5 s, any input hurries it off and tapping it hides it at once. The test `the first levels teach one material at a time` checks that every material's first level has a callout. It also checks that the materials arrive in the order above.

**Sawtooth.** Target first-try win rates come from `targetWinRate()` in `src/levels.js`. Levels 1–3 are near-certain. Levels 4–20 alternate between 50% and 85%. From level 21 each block of five follows the pattern 55% / 45% / 72% (breather) / 40% (hardest) / 62% (showcase), drifting about 8 points harder by level 100.

**No copies.** No level is a copy of the one before it; the test `no level is a copy of the one before it` compares bag, starting board, mode, quest, power and goal.

### Per-level results

<details><summary>All 100 levels: config and rig results</summary>

<!-- gen:perlevel -->
| Lvl | Name | Mode | Goal | Pieces | Target | Random | Human-ish | First try (campaign) | Expert | Close losses | Win time | Gap (med) | Powers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Put it out | normal | 15 | 14 | 97% | 100% | 100% | 100% | 100% | – | 27 s | 2.2 s | 0.1 |
| 2 | Fire and water | normal | 18 | 20 | 96% | 100% | 100% | 100% | 100% | – | 38 s | 3.9 s | 0.3 |
| 3 | Woodpile | normal | 18 | 19 | 95% | 30% | 97% | 95% | 100% | 100% | 36 s | 3.3 s | 0.7 |
| 4 | Dunes | normal | 20 | 16 | 85% | 55% | 87% | 90% | 90% | 100% | 32 s | 2.1 s | 0.8 |
| 5 | Glass tower ★ | normal | 21 | 24 | 85% | 10% | 90% | 90% | 100% | 100% | 35 s | 4.6 s | 0.7 |
| 6 | Glassworks | normal | 22 | 24 | 75% | 15% | 77% | 80% | 90% | 100% | 40 s | 5.6 s | 0.9 |
| 7 | Ice block | normal | 22 | 21 | 75% | 30% | 63% | 83% | 70% | 100% | 42 s | 5.6 s | 0.8 |
| 8 | Halves | normal | 22 | 22 | 80% | 20% | 93% | 83% | 100% | 100% | 41 s | 2.6 s | 0.9 |
| 9 | Mixed bag | normal | 27 | 29 | 60% | 0% | 73% | 53% | 40% | 100% | 55 s | 5.3 s | 1.0 |
| 10 | Firebreak ★ | normal | 27 | 22 | 80% | 40% | 90% | 85% | 90% | 100% | 43 s | 3.2 s | 1.1 |
| 11 | Stone | normal | 22 | 22 | 85% | 30% | 70% | 85% | 80% | 100% | 39 s | 4.5 s | 0.9 |
| 12 | Flood | flood | 26 | 21 | 60% | 55% | 40% | 57% | 50% | 100% | 56 s | 3.5 s | 0.9 |
| 13 | Brickworks | normal | 27 | 25 | 65% | 25% | 43% | 45% | 60% | 100% | 49 s | 3.5 s | 1.0 |
| 14 | Kindling | normal | 26 | 29 | 85% | 30% | 90% | 93% | 100% | 100% | 56 s | 4.9 s | 0.9 |
| 15 | Skyscraper ★ | normal | 30 | 29 | 75% | 10% | 83% | 57% | 100% | 100% | 53 s | 5.3 s | 0.9 |
| 16 | The wall | prefill | 28 | 27 | 55% | 0% | 43% | 48% | 60% | 100% | 49 s | 5.7 s | 0.8 |
| 17 | Thaw | normal | 27 | 28 | 80% | 20% | 87% | 85% | 100% | 100% | 54 s | 5.8 s | 1.0 |
| 18 | High water | flood | 28 | 23 | 50% | 25% | 63% | 43% | 20% | 100% | 61 s | 2.9 s | 0.9 |
| 19 | Sandbox | normal | 27 | 26 | 80% | 55% | 77% | 85% | 100% | 100% | 49 s | 4.3 s | 0.9 |
| 20 | Glacier ★ | normal | 32 | 27 | 70% | 5% | 47% | 60% | 70% | 100% | 52 s | 4.3 s | 0.9 |
| 21 | Wood 21 | prefill | 33 | 31 | 55% | 5% | 53% | 57% | 90% | 100% | 55 s | 4.0 s | 1.0 |
| 22 | Water 22 | flood | 34 | 29 | 45% | 20% | 37% | 38% | 0% | 100% | 59 s | 6.6 s | 0.8 |
| 23 | Sand 23 | normal | 31 | 34 | 72% | 0% | 73% | 80% | 100% | 100% | 65 s | 5.3 s | 0.9 |
| 24 | Glass 24 | normal | 35 | 37 | 40% | 30% | 43% | 43% | 60% | 100% | 64 s | 5.3 s | 0.9 |
| 25 | Showcase 25 ★ | normal | 33 | 27 | 62% | 5% | 43% | 65% | 60% | 88% | 49 s | 5.2 s | 0.9 |
| 26 | Wood 26 | normal | 34 | 37 | 55% | 0% | 77% | 60% | 60% | 100% | 68 s | 5.2 s | 0.9 |
| 27 | Water 27 | normal | 35 | 36 | 44% | 0% | 13% | 8% | 50% | 100% | 76 s | 5.4 s | 0.9 |
| 28 | Sand 28 | normal | 32 | 36 | 71% | 5% | 83% | 73% | 90% | 100% | 66 s | 4.4 s | 0.9 |
| 29 | Glass 29 | normal | 36 | 38 | 39% | 0% | 33% | 48% | 80% | 100% | 73 s | 6.0 s | 1.0 |
| 30 | Showcase 30 ★ | normal | 34 | 28 | 61% | 5% | 57% | 57% | 70% | 100% | 51 s | 5.3 s | 1.0 |
| 31 | Wood 31 | prefill | 35 | 33 | 54% | 5% | 67% | 48% | 20% | 100% | 59 s | 4.7 s | 0.9 |
| 32 | Water 32 | flood | 36 | 31 | 44% | 10% | 50% | 53% | 0% | 100% | 59 s | 4.8 s | 0.9 |
| 33 | Sand 33 | normal | 33 | 36 | 71% | 0% | 67% | 65% | 80% | 100% | 68 s | 6.3 s | 0.9 |
| 34 | Glass 34 | normal | 37 | 39 | 39% | 5% | 37% | 28% | 50% | 100% | 69 s | 5.0 s | 0.9 |
| 35 | Showcase 35 ★ | normal | 35 | 30 | 61% | 30% | 73% | 83% | 100% | 75% | 55 s | 5.1 s | 0.9 |
| 36 | Wood 36 | normal | 36 | 39 | 54% | 0% | 50% | 48% | 60% | 100% | 71 s | 5.7 s | 0.9 |
| 37 | Water 37 | normal | 37 | 39 | 43% | 5% | 60% | 48% | 80% | 100% | 73 s | 5.3 s | 1.0 |
| 38 | Sand 38 | normal | 34 | 37 | 70% | 20% | 60% | 57% | 60% | 100% | 70 s | 5.7 s | 0.8 |
| 39 | Glass 39 | normal | 38 | 40 | 38% | 5% | 27% | 33% | 70% | 100% | 73 s | 4.9 s | 1.0 |
| 40 | Showcase 40 ★ | normal | 36 | 31 | 60% | 5% | 80% | 70% | 80% | 67% | 55 s | 5.5 s | 1.0 |
| 41 | Wood 41 | prefill | 37 | 36 | 53% | 5% | 40% | 57% | 70% | 100% | 65 s | 5.1 s | 1.0 |
| 42 | Water 42 | flood | 38 | 33 | 43% | 10% | 57% | 45% | 0% | 92% | 60 s | 4.7 s | 1.0 |
| 43 | Sand 43 | normal | 35 | 38 | 70% | 0% | 63% | 73% | 100% | 100% | 68 s | 5.0 s | 1.0 |
| 44 | Glass 44 | normal | 39 | 41 | 38% | 10% | 53% | 55% | 70% | 100% | 72 s | 4.6 s | 1.4 |
| 45 | Showcase 45 ★ | normal | 37 | 31 | 60% | 5% | 70% | 63% | 60% | 89% | 56 s | 4.4 s | 1.2 |
| 46 | Wood 46 | normal | 38 | 41 | 53% | 5% | 57% | 48% | 60% | 100% | 73 s | 5.3 s | 0.9 |
| 47 | Water 47 | normal | 39 | 41 | 42% | 5% | 63% | 43% | 70% | 100% | 73 s | 5.1 s | 1.0 |
| 48 | Sand 48 | normal | 36 | 40 | 69% | 5% | 80% | 73% | 100% | 100% | 71 s | 5.2 s | 0.9 |
| 49 | Glass 49 | normal | 40 | 42 | 37% | 5% | 43% | 55% | 50% | 100% | 73 s | 4.9 s | 1.3 |
| 50 | Showcase 50 ★ | normal | 38 | 33 | 59% | 5% | 73% | 78% | 90% | 88% | 57 s | 5.2 s | 1.1 |
| 51 | Wood 51 | prefill | 39 | 36 | 52% | 0% | 37% | 57% | 40% | 100% | 64 s | 5.4 s | 1.1 |
| 52 | Water 52 | flood | 40 | 36 | 42% | 20% | 50% | 55% | 30% | 100% | 64 s | 4.5 s | 1.0 |
| 53 | Sand 53 | normal | 37 | 41 | 69% | 5% | 83% | 70% | 100% | 100% | 73 s | 5.0 s | 1.0 |
| 54 | Glass 54 | normal | 41 | 43 | 37% | 0% | 47% | 43% | 90% | 100% | 75 s | 3.9 s | 1.5 |
| 55 | Showcase 55 ★ | normal | 39 | 34 | 59% | 0% | 43% | 70% | 90% | 65% | 57 s | 6.2 s | 0.8 |
| 56 | Wood 56 | normal | 40 | 43 | 52% | 0% | 47% | 48% | 90% | 100% | 73 s | 5.2 s | 1.1 |
| 57 | Water 57 | normal | 41 | 43 | 41% | 5% | 50% | 55% | 60% | 100% | 76 s | 5.6 s | 1.1 |
| 58 | Sand 58 | normal | 38 | 42 | 68% | 20% | 63% | 73% | 80% | 100% | 72 s | 5.5 s | 1.1 |
| 59 | Glass 59 | normal | 42 | 46 | 36% | 5% | 43% | 65% | 100% | 100% | 74 s | 4.4 s | 1.3 |
| 60 | Showcase 60 ★ | normal | 40 | 35 | 58% | 0% | 70% | 57% | 70% | 89% | 60 s | 4.6 s | 1.3 |
| 61 | Wood 61 | prefill | 41 | 40 | 51% | 10% | 70% | 75% | 100% | 100% | 66 s | 4.8 s | 1.1 |
| 62 | Water 62 | flood | 42 | 36 | 41% | 0% | 57% | 50% | 0% | 92% | 64 s | 3.3 s | 1.2 |
| 63 | Sand 63 | normal | 39 | 42 | 68% | 10% | 80% | 70% | 90% | 100% | 73 s | 4.2 s | 1.3 |
| 64 | Glass 64 | normal | 43 | 46 | 36% | 5% | 43% | 33% | 50% | 100% | 76 s | 5.2 s | 1.3 |
| 65 | Showcase 65 ★ | normal | 41 | 36 | 58% | 5% | 80% | 53% | 90% | 67% | 60 s | 5.0 s | 1.4 |
| 66 | Wood 66 | normal | 42 | 47 | 51% | 5% | 50% | 50% | 60% | 100% | 79 s | 5.2 s | 1.2 |
| 67 | Water 67 | normal | 43 | 46 | 40% | 5% | 67% | 65% | 90% | 100% | 77 s | 4.9 s | 1.7 |
| 68 | Sand 68 | normal | 40 | 44 | 67% | 10% | 63% | 85% | 80% | 100% | 75 s | 6.4 s | 1.6 |
| 69 | Glass 69 | normal | 44 | 47 | 35% | 0% | 40% | 57% | 50% | 100% | 78 s | 4.9 s | 1.3 |
| 70 | Showcase 70 ★ | normal | 42 | 38 | 57% | 10% | 63% | 73% | 80% | 91% | 65 s | 4.9 s | 1.3 |
| 71 | Wood 71 | prefill | 43 | 44 | 50% | 5% | 43% | 65% | 100% | 100% | 72 s | 5.4 s | 1.3 |
| 72 | Water 72 | flood | 44 | 37 | 40% | 5% | 40% | 48% | 0% | 100% | 69 s | 4.1 s | 1.5 |
| 73 | Sand 73 | normal | 41 | 44 | 67% | 0% | 57% | 63% | 70% | 100% | 75 s | 4.9 s | 1.6 |
| 74 | Glass 74 | normal | 45 | 48 | 35% | 0% | 40% | 48% | 80% | 100% | 79 s | 5.2 s | 1.4 |
| 75 | Showcase 75 ★ | normal | 43 | 38 | 57% | 0% | 40% | 48% | 80% | 94% | 64 s | 5.3 s | 1.5 |
| 76 | Wood 76 | normal | 44 | 49 | 50% | 0% | 30% | 43% | 80% | 100% | 81 s | 5.1 s | 1.2 |
| 77 | Water 77 | normal | 45 | 47 | 39% | 10% | 30% | 33% | 10% | 100% | 78 s | 4.5 s | 1.7 |
| 78 | Sand 78 | normal | 42 | 47 | 66% | 0% | 70% | 73% | 100% | 100% | 78 s | 5.4 s | 1.7 |
| 79 | Glass 79 | normal | 46 | 49 | 34% | 0% | 43% | 40% | 70% | 100% | 76 s | 4.3 s | 1.6 |
| 80 | Showcase 80 ★ | normal | 44 | 40 | 56% | 5% | 83% | 60% | 80% | 100% | 66 s | 5.4 s | 1.7 |
| 81 | Wood 81 | prefill | 45 | 45 | 49% | 0% | 50% | 50% | 60% | 100% | 74 s | 5.0 s | 1.5 |
| 82 | Water 82 | flood | 46 | 39 | 39% | 0% | 50% | 40% | 0% | 100% | 69 s | 3.8 s | 1.6 |
| 83 | Sand 83 | normal | 43 | 48 | 66% | 5% | 80% | 73% | 60% | 100% | 80 s | 5.2 s | 1.6 |
| 84 | Glass 84 | normal | 47 | 50 | 34% | 5% | 47% | 53% | 70% | 100% | 78 s | 4.9 s | 1.8 |
| 85 | Showcase 85 ★ | normal | 45 | 41 | 56% | 0% | 70% | 50% | 80% | 100% | 67 s | 4.6 s | 1.7 |
| 86 | Wood 86 | normal | 46 | 51 | 49% | 0% | 57% | 60% | 60% | 100% | 79 s | 4.6 s | 1.7 |
| 87 | Water 87 | normal | 47 | 49 | 38% | 0% | 23% | 25% | 10% | 100% | 81 s | 4.4 s | 1.8 |
| 88 | Sand 88 | normal | 44 | 50 | 65% | 5% | 73% | 83% | 100% | 100% | 82 s | 5.8 s | 1.9 |
| 89 | Glass 89 | normal | 48 | 51 | 33% | 0% | 57% | 48% | 70% | 100% | 81 s | 4.6 s | 1.7 |
| 90 | Showcase 90 ★ | normal | 46 | 42 | 55% | 5% | 60% | 73% | 70% | 92% | 65 s | 4.3 s | 1.5 |
| 91 | Wood 91 | prefill | 47 | 47 | 48% | 0% | 30% | 43% | 60% | 100% | 71 s | 4.7 s | 1.5 |
| 92 | Water 92 | flood | 48 | 41 | 38% | 5% | 50% | 35% | 0% | 100% | 71 s | 3.8 s | 1.8 |
| 93 | Sand 93 | normal | 45 | 50 | 65% | 10% | 63% | 55% | 80% | 100% | 81 s | 5.2 s | 1.7 |
| 94 | Glass 94 | normal | 49 | 52 | 33% | 5% | 50% | 48% | 60% | 100% | 81 s | 4.7 s | 1.7 |
| 95 | Showcase 95 ★ | normal | 47 | 42 | 55% | 0% | 37% | 45% | 60% | 100% | 67 s | 5.0 s | 1.6 |
| 96 | Wood 96 | normal | 48 | 53 | 48% | 0% | 33% | 55% | 70% | 100% | 81 s | 4.8 s | 1.7 |
| 97 | Water 97 | normal | 49 | 51 | 37% | 10% | 40% | 28% | 30% | 100% | 84 s | 4.7 s | 1.8 |
| 98 | Sand 98 | normal | 46 | 51 | 64% | 0% | 43% | 70% | 100% | 100% | 80 s | 5.9 s | 1.8 |
| 99 | Glass 99 | normal | 50 | 52 | 32% | 5% | 37% | 28% | 20% | 100% | 84 s | 4.3 s | 1.9 |
| 100 | Showcase 100 ★ | normal | 48 | 43 | 54% | 0% | 53% | 48% | 70% | 86% | 67 s | 4.6 s | 1.6 |
<!-- /gen:perlevel -->

</details>

---

## Retention proxies

<!-- gen:retention -->
| Proxy (human-ish bot) | Aim | Measured |
|---|---|---|
| Levels won on first try, early (4-20) | 60-75% | 72% |
| Levels won on first try, mid (21-60) | 40-55% | 56% |
| Losses that were close (80%+ of the bar) | at least half | 96% |
| Longest stretch with no drain, per level (median of medians) | under ~6 s | 4.9 s (90th percentile 7.6 s) |
| Powers used per level | about 1 | 1.19 |
| Time to first drain (median level) |  | 3.9 s |
| Time to win a level (median level) |  | 68 s |
<!-- /gen:retention -->

The no-drain gap is measured from the moment the first piece lands. For a true first-timer who never drops pieces, the newbie bot shows gaps of 10–20 s, because a piece takes 7–9 s to fall on its own at early speeds. The first drain still lands at 7.2 s with no input at all (see the hook checklist).

---

## Instant-hook checklist (real browser, 390×844, fresh save)

`node tools/browser/hook.mjs` opens the game in Chromium with touch emulation. It waits ten seconds with no input, then lets the **newbie bot** play level 1 through the live page. The newbie bot is slow to read pieces, swipes slowly and mostly lets pieces fall on their own.

<!-- gen:hook -->
| Check | Result | Measured |
|---|---|---|
| a piece is already falling the moment the game opens (no menu first) | PASS |  |
| the first-time callout explains the one thing to do | PASS | Drop WATER on the FIRE to put it out! |
| first reaction happens in the first 10 s with no input | PASS | 7.2 s |
| first 60 s: a drain, a combo popup and the bar moving | PASS | drain 7.2 s, combo 7.4 s |
| always a visible next goal: drain bar, power meter, side quest, pieces left | PASS | {"bar":true,"meter":true,"quest":true,"left":true} |
| first level clears in 1-2 minutes, as a new player plays it | PASS | celebrate at 79 s |
| win screen: big celebration, then what is new next level | PASS | Level cleared! / Next: level 2. No fire bed this time: set up your own reactions. |
| win screen offers the daily challenge | PASS |  |
| feedback events fired (land/slam, combo, drain popups, quest or power) | PASS | start,land,combo,quest,win |
| session loop: one tap from the win screen and level 2 is falling | PASS | {"phase":"play","level":2,"piece":true,"ad":false} |
| sound layer can be muted, and the choice is remembered | PASS |  |
| home screen: daily challenge ready | PASS | new today |
| no console errors or invariant breaks in the whole session | PASS |  |
| every loss shows real progress and the one revive | PASS | So close! 88% / Watch ad: clear the top 4 rows |
<!-- /gen:hook -->

| Moment | Screenshot |
|---|---|
| First second: piece falling, callout | [hook-01](docs/shots/hook-01-first-second.jpg) |
| First reaction, no input (≈7 s) | [hook-02](docs/shots/hook-02-first-reaction.jpg) |
| First combo popup | [hook-03](docs/shots/hook-03-first-combo.jpg) |
| Bar moving | [hook-04](docs/shots/hook-04-bar-moving.jpg) |
| Celebration | [hook-05](docs/shots/hook-05-celebration.jpg) |
| Win screen with next-level preview and daily challenge | [hook-06](docs/shots/hook-06-win-screen.jpg) |
| One tap later: level 2 | [hook-07](docs/shots/hook-07-level-2.jpg) |
| Home with daily challenge | [hook-08](docs/shots/hook-08-home-daily.jpg) |
| "So close! 88%" with the revive | [hook-09](docs/shots/hook-09-so-close.jpg) |

**Feedback for everything.**

| Event | Sound (`src/sound.js`) | Screen effect | Popup |
|---|---|---|---|
| Drain | rising blip by combo level | the drain bar bumps | +N beside the bar |
| Slam | low thud | shake and dust | "SLAM" |
| Smash | glass shatter | debris and shake | "SMASH!" |
| Combo | arpeggio, longer per level | shake, flash at ×3 | "COMBO ×N" |
| Power | sweep | full-board burst, flash and shake | "FIRE MODE! +N" |
| Side quest | chime | — | "Side quest done! +power" |
| Win / lose | fanfare / falling tones | — | — |

All sounds are rate-limited and can be muted; the choice is remembered.

**Daily reason to return.** The daily challenge is one generated level per calendar day, slightly past the player's own level. It is played from home or from the win screen, and the streak counts consecutive days. It is local only for now.

---

## Mechanic test cards

Every card has a scripted scene in `src/scenes.js`. The same scene runs headless three times with different seeds in `test/cards.test.js`, and once in real Chromium at 390×844 via `?debug&scene=<id>` (`tools/browser/cards.mjs`), which saves the screenshot. Timings are from the headless run.

Scores are 1–5 for **I**ntuitive, **S**atisfying and **D**ecision. The rule was that anything under 3 gets fixed or cut. "Discover / repeat" asks whether a new player could hit it by accident, then do it again on purpose.

<!-- gen:cardtimes -->
| Card | Scene | Headless | Browser | Effect starts | Effect done | Screenshot |
|---|---|---|---|---|---|---|
| Water puts out fire | `douse` | pass | pass | 0.03 s | 0.50 s | [shot](docs/shots/card-douse.jpg) |
| Fire burns a wood piece away | `burn` | pass | pass | 0.77 s | 3.33 s | [shot](docs/shots/card-burn.jpg) |
| Water soaks wood, a second soak dissolves it | `soak` | pass | pass | 0.03 s | 1.37 s | [shot](docs/shots/card-soak.jpg) |
| Fire dries wet wood, then burns it | `wetwood` | pass | pass | 1.53 s | 4.10 s | [shot](docs/shots/card-wetwood.jpg) |
| Fire melts ice into water | `melt` | pass | pass | 0.40 s | 1.57 s | [shot](docs/shots/card-melt.jpg) |
| Water touching ice freezes | `freeze` | pass | pass | 0.77 s | 2.00 s | [shot](docs/shots/card-freeze.jpg) |
| Water turns sand to mud, mud sinks away | `mud` | pass | pass | 0.03 s | 3.80 s | [shot](docs/shots/card-mud.jpg) |
| Fire melts sand into one glass pane | `glassmelt` | pass | pass | 0.27 s | 1.50 s | [shot](docs/shots/card-glassmelt.jpg) |
| Slamming a piece onto glass smashes the pane | `slam` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-slam.jpg) |
| Dragging a piece down onto glass does not smash it | `gentle` | pass | pass | at once | – | [shot](docs/shots/card-gentle.jpg) |
| Stone smashes glass even when placed gently | `stone` | pass | pass | 0.13 s | 0.13 s | [shot](docs/shots/card-stone.jpg) |
| A block that falls a long way smashes glass | `fall` | pass | pass | 1.23 s | 1.23 s | [shot](docs/shots/card-fall.jpg) |
| Water wears stone into sand, which turns to mud | `erode` | pass | pass | 1.20 s | 1.90 s | [shot](docs/shots/card-erode.jpg) |
| Water wears brick into sand | `brick` | pass | pass | 0.60 s | 0.90 s | [shot](docs/shots/card-brick.jpg) |
| Fire never burns out on its own | `firestays` | pass | pass | at once | – | [shot](docs/shots/card-firestays.jpg) |
| Rainstorm puts out every fire | `rain` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-rain.jpg) |
| Fire Mode burns every wood block | `blaze` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-blaze.jpg) |
| Deep Freeze clears all water and ice | `deepfreeze` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-deepfreeze.jpg) |
| Sandstorm clears all sand and mud | `sweep` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-sweep.jpg) |
| Hammer clears glass, brick and stone | `hammer` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-hammer.jpg) |
| Flood: water rises from the bottom | `flood` | pass | pass | 0.27 s | 5.87 s | [shot](docs/shots/card-flood.jpg) |
| Wall: burn through a prefilled wood wall | `wall` | pass | pass | 0.77 s | 3.73 s | [shot](docs/shots/card-wall.jpg) |
| Showcase: smash the glass tower | `showcase` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-showcase.jpg) |
| Tap to rotate, swipe to move, walls kick | `rotate` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-rotate.jpg) |
| Two-material piece: each half acts on its own | `mixed` | pass | pass | 0.03 s | 2.93 s | [shot](docs/shots/card-mixed.jpg) |
| Ghost outline shows where the piece lands | `ghost` | pass | pass | at once | – | [shot](docs/shots/card-ghost.jpg) |
| Drain bar fills as blocks cancel | `bar` | pass | pass | 0.10 s | 0.23 s | [shot](docs/shots/card-bar.jpg) |
| Draining fast builds a combo | `combo` | pass | pass | 0.10 s | 0.67 s | [shot](docs/shots/card-combo.jpg) |
| Side quest done tops up the power meter | `quest` | pass | pass | 0.23 s | 0.23 s | [shot](docs/shots/card-quest.jpg) |
| Full meter: swipe up to fire the power | `meter` | pass | pass | at once | – | [shot](docs/shots/card-meter.jpg) |
| Piece budget: pieces left counts down; reactions finish after the last one | `budget` | pass | pass | 0.00 s | 2.70 s | [shot](docs/shots/card-budget.jpg) |
| First-time callout on the board | `callout` | pass | pass | at once | – | [shot](docs/shots/card-callout.jpg) |
| Win: celebration, then what is new next level | `win` | pass | pass | 2.30 s | 2.30 s | [shot](docs/shots/card-win.jpg) |
| Loss shows real progress and the one revive | `lose` | pass | pass | 0.00 s | 0.00 s | [shot](docs/shots/card-lose.jpg) |
| Revive ad clears the top rows and play goes on | `revive` | pass | pass | at once | – | [shot](docs/shots/card-revive.jpg) |
| Interstitial between levels, paced | `interstitial` | pass | pass | at once | – | [shot](docs/shots/card-interstitial.jpg) |
| Meter at 80%: one optional ad fills it | `meterad` | pass | pass | at once | – | [shot](docs/shots/card-meterad.jpg) |
| Home screen: play, daily, how to play | `home` | pass | pass | at once | – | [shot](docs/shots/card-home.jpg) |
| Daily challenge | `daily` | pass | pass | at once | – | [shot](docs/shots/card-daily.jpg) |
| Helping hand after three losses | `help` | pass | pass | at once | – | [shot](docs/shots/card-help.jpg) |
<!-- /gen:cardtimes -->

### Materials and reactions

| Card | I | S | D | Readable? | Discover / repeat | Notes |
|---|---|---|---|---|---|---|
| Water puts out fire (`douse`) | 5 | 5 | 4 | Starts in 1 frame, done in 0.5 s, with steam puffs | Level 1 forces it: the fire bed is under every drop | The core verb. Where to pour is the decision |
| Fire burns a wood piece (`burn`) | 5 | 4 | 4 | Starts at 0.8 s, whole piece gone by 3.3 s, with smoke | Level 3 deals fire onto a woodpile | Burning spreads through the piece: one fire eats one piece, not one column |
| Water soaks wood, twice dissolves (`soak`) | 3 | 3 | 3 | Wood darkens at once; the second soak drains | Happens by accident whenever water meets wood | Less obvious than burning, but follows "water ruins wood" |
| Fire dries wet wood, then burns it (`wetwood`) | 3 | 3 | 3 | Steam puffs on a beat while drying; burns by 4.1 s | Accident: water then fire on the same wood | The decision: don't water wood you plan to burn |
| Fire melts ice (`melt`) | 5 | 4 | 4 | Starts at 0.4 s, done by 1.6 s | Level 7 deals fire onto an ice block | |
| Water touching ice freezes (`freeze`) | 4 | 3 | 5 | Ice visibly grows within 0.8–2 s | Easy to do by accident; the callout warns | A setback, but a clear one. It's the main "don't put X there" rule |
| Water turns sand to mud, mud sinks (`mud`) | 4 | 4 | 3 | Mud at once; one water piece drains about 4 blocks within about 4 s | Level 4 deals water onto a dune | Big payoff from one piece |
| Fire melts sand into glass (`glassmelt`) | 3 | 3 | 4 | A white pane forms within 0.3–1.5 s | Level 6 deals fire onto sand | Turns junk into a smash target: a two-step plan |
| Slam smashes glass, drag doesn't (`slam`, `gentle`) | 4 | 5 | 4 | Smash in the same frame, with debris, shake and "SMASH!" | Level 5's tower and callout; dragging leaves the glass whole | Flick versus drag is a real choice: you sometimes want glass to stay as a floor |
| Stone smashes glass even placed gently (`stone`) | 4 | 4 | 4 | Smash on landing (0.13 s) | Level 11 deals stone onto glass towers | |
| A long fall smashes glass (`fall`) | 3 | 4 | 3 | Smash on landing after a 7-row drop | Accident: burn out the support under a block | Emergent; can be set up on purpose |
| Water crumbles stone to sand (`erode`) | 3 | 3 | 3 | **Fixed:** starts at 1.2 s, whole piece by 1.9 s | Accident whenever water touches stone | **Was I2 / S1:** 8 s per layer, so 12 of 64 particles after 9 s. Erosion now spreads through the piece like burning, and the sand turns to mud with the next water |
| Water crumbles brick (`brick`) | 3 | 3 | 3 | **Fixed:** starts at 0.6 s, done by 0.9 s | Level 13 deals water onto a brick slab | Same fix as stone |
| Fire never burns out (`firestays`) | 4 | 3 | 4 | Nothing changes for 6 s, which is the point | Every level | Makes fire a reusable tool: where you park it matters |
| ~~Wood floats in water~~ | – | – | – | Never seen: water dissolves the wood first | – | **Cut** (dead code) |
| ~~Fire bakes mud into brick~~ | – | – | – | – | Only by accident, and it's a punishment the player can't see coming | **Cut:** I2 / S1. Mud now just sinks or washes away |

### Powers

| Card | I | S | D | Notes |
|---|---|---|---|---|
| Rainstorm puts out every fire (`rain`) | 5 | 5 | 3 | The level 1–2 power. The decision is timing: wait for more fire |
| Fire Mode burns all wood (`blaze`) | 5 | 5 | 4 | Level 10's showcase starts with the meter at 60% on a wood wall |
| Deep Freeze clears water and ice (`deepfreeze`) | 4 | 4 | 3 | Best in flood levels |
| Sandstorm clears sand and mud (`sweep`) | 4 | 4 | 3 | |
| Hammer clears glass, brick and stone (`hammer`) | 4 | 5 | 3 | The only answer to a stone pile-up |
| Swipe up at full meter (`meter`) | 4 | 5 | 4 | The label turns to "ready! Swipe up" and the bar pulses. The expert bot waits for targets before firing, which casual players don't do: that's the skill gap |

### Modes, pieces and goals

| Card | I | S | D | Notes |
|---|---|---|---|---|
| Flood (`flood`) | 4 | 3 | 4 | Water rises 2 particles every 0.25 s. Soak it with fire, sand and wood, or freeze it |
| Wall (`wall`) | 5 | 4 | 3 | Burn through a prefilled wood wall |
| Showcase (`showcase`) | 5 | 5 | 3 | Every 5th level: a set piece and a part-charged power |
| Move, rotate, wall kicks (`rotate`) | 5 | 3 | 4 | Browser checks: a tap rotates, a sloppy 6 px tap still rotates, a 2.4-column swipe moves 3, a diagonal moves without slamming |
| Two-material pieces (`mixed`) | 3 | 3 | 5 | The halves never react with each other. Rotation decides which half touches what. Level 8 callout: "Tap to turn them!" |
| Ghost outline (`ghost`) | 5 | 3 | 4 | Shows the landing spot, in each half's own colour |
| Piece budget (`budget`) | 4 | 3 | 5 | **New.** The "N left" counter pulses red at 3. Reactions finish after the last piece before the level is called |
| Drain bar (`bar`) | 5 | 4 | 3 | Bumps, plus a "+N" popup by the bar on every block |
| Combo (`combo`) | 4 | 5 | 3 | A big douse gives ×3 in under half a second |
| Side quest (`quest`) | 4 | 3 | 4 | The progress count is in the line ("(2/4)"). Done gives +30% meter |

### Screens and UI elements

| Card | I | S | D | Notes |
|---|---|---|---|---|
| First-time callout (`callout`) | 5 | 3 | – | Once per level ever; skippable; any input hurries it |
| Win (`win`) | 5 | 5 | – | The board shatters, confetti, the camera drops a foot, the count rolls up. Then a preview of what's new next level and a one-tap "Play level N" |
| Lose (`lose`) | 5 | 3 | 4 | Real progress: "So close! 88%" at 80% or more, otherwise "Out of pieces at 64%" or "Topped out at 64%". The revive is a choice |
| Revive (`revive`) | 4 | 4 | 4 | One per level. Its type matches the loss: +5 pieces, or clear the top rows |
| Interstitial (`interstitial`) | 4 | n/a | – | An ad, so it isn't meant to satisfy. Rules instead: never before level 5, at most every 2nd level start, at least 3 minutes apart across sessions, never with "Remove ads" |
| Meter ad (`meterad`) | 4 | 3 | 3 | Appears only at 80–99% meter, once per level, optional |
| Home (`home`) | 4 | 3 | – | Play, Daily challenge, and how to play. It scrolls while the game page doesn't |
| Daily challenge (`daily`) | 4 | 4 | – | A streak of consecutive days |
| Helping hand (`help`) | 4 | 4 | – | After 3 losses in a row on a level: +1 fire, +1 water per bag and +4 pieces. The player is told on the lose screen and in the banner |
| HUD (level · ft, N left, Next + tip) | 4 | 3 | 4 | "Now" was dropped at 390 px to make room for the budget. The falling piece is on the board anyway |
| Mute | 5 | 3 | – | Remembered across sessions |

---

## Bug overhaul

### Invariant checks

`src/validate.js` runs after **every tick** in the rig and fuzzer, and **every frame** in the browser with `?debug` (errors go to `mb.errors` and the console). It asserts:

- no particle where the falling piece is;
- every rigid block has cells, and particles carry finite heat, frz, fall and id values;
- no NaN in heat, frz or meter;
- drained never decreases;
- the meter stays in 0..1 and mult stays in 1..4;
- a next piece is always queued: the bag never runs dry without refilling;
- the piece is always inside the board horizontally;
- the state is always play, win or lose;
- with the piece budget: no piece while settling, and pieces left ≥ 0.

The fuzzer adds session checks:
- the phase is always one of the four;
- the level is always an integer from 1 to 100;
- the ad timer is sane;
- a lost game always shows the lose screen;
- callouts never get stuck.

### Fuzzing

`node tools/fuzz.js --games 1000` runs at least 1,000 games in each of four level bands through the whole session. It plays a mix of a sensible bot and hostile input, including:
- rotating 50 times in a row, slamming during spawn, walking into walls;
- the power at 0%, asking for the revive twice;
- next, replay, home and daily in any phase, including during the celebration and ads;
- starting levels 0, −3, 1.5, 101, 999, NaN and "7";
- frames of 0, NaN, −1 and 10 s;
- storage that is blocked, full, cleared or holding junk values mid-game;
- skipping to the next day.

<!-- gen:fuzz -->
| Band | Levels | Games | Frames | Wins | Losses | Crashes / invariant breaks |
|---|---|---|---|---|---|---|
| a | 1-10 | 1375 | 762548 | 459 | 806 | 0 |
| b | 11-20 | 1375 | 820251 | 333 | 900 | 0 |
| c | 21-60 | 1375 | 824467 | 247 | 1037 | 0 |
| d | 61-100 | 1375 | 706281 | 147 | 1288 | 0 |
| **Total** | | **5500** | 3113547 | | | **0** |
<!-- /gen:fuzz -->

Failures from earlier runs are in the bug log with their seeds and regression tests.

### Edge cases tested on purpose

| Edge case | Where |
|---|---|
| Spawn on a nearly full board | `test/core.test.js` "topping out loses…", `test/session.test.js` lose helper, fuzz |
| Rotating against walls and other blocks | card `rotate` (wall kick at column 11), browser "swipe far into the wall" |
| Two-material pieces at every rotation | `test/core.test.js` "two-material pieces keep each half…", "mixed pieces start at level 8" (never self-reacting) |
| Glass panes split by row positions | `test/core.test.js` "glass melted from both sides of a fire joins into one pane", regression "halves of a split piece track their own falls" |
| Fire fully surrounded by glass | `test/edge.test.js` |
| Water trapped in sealed pockets | `test/edge.test.js` |
| Prefill and flood modes at their worst seeds | `test/edge.test.js` (all gap columns; flood for 60 s with no player) |
| Level 100 win and "play again" | `test/session.test.js` "level 100: …" |
| Helping hand after 3 losses | `test/session.test.js` "helping hand after three losses…" |
| Interstitial pacing across sessions | `test/session.test.js` "interstitial pacing carries across sessions", "no interstitials in the first five levels…" |
| localStorage blocked or cleared mid-game | `test/session.test.js` (blocked, cleared, corrupt); browser checks (blocked, cleared) |

### Browser and mobile

`node tools/browser/check.mjs` runs real Chromium at 390×844 and 375×667 with touch emulation. Touches go through the DevTools protocol, so the page gets real touch, then pointer, events.

<!-- gen:browser -->
| Check | Result | Measured |
|---|---|---|
| 390x844 tap rotates | PASS |  |
| 390x844 sloppy 6px tap still rotates, does not move | PASS |  |
| 390x844 slow swipe right ~2.4 columns moves 3 | PASS | moved 3 |
| 390x844 swipe far into the wall stops at the wall | PASS | x=0 |
| 390x844 slow drag down soft-drops without slamming | PASS | dy=16 |
| 390x844 quick flick down slams | PASS | {"dt":133,"tx":8,"ty":120,"moved":true,"what":"slam"} |
| 390x844 diagonal swipe moves sideways, no slam | PASS |  |
| 390x844 flick up fires the power at full meter | PASS | {"dt":134,"tx":0,"ty":-140,"moved":false,"what":"power"} |
| 390x844 flick up at 0% meter does nothing | PASS |  |
| 390x844 the page never scrolls during play | PASS | {"y":0,"top":0,"bodyH":844,"vh":844} |
| 390x844 board and quest line fit on screen | PASS | {"bottom":684,"right":352,"quest":705,"vw":390,"vh":844} |
| 390x844 home screen scrolls | PASS | scrollTop 491 |
| 390x844 game waits behind the home screen | PASS |  |
| 390x844 no console errors | PASS |  |
| 375x667 tap rotates | PASS |  |
| 375x667 sloppy 6px tap still rotates, does not move | PASS |  |
| 375x667 slow swipe right ~2.4 columns moves 3 | PASS | moved 3 |
| 375x667 swipe far into the wall stops at the wall | PASS | x=0 |
| 375x667 slow drag down soft-drops without slamming | PASS | dy=16 |
| 375x667 quick flick down slams | PASS | {"dt":133,"tx":8,"ty":120,"moved":true,"what":"slam"} |
| 375x667 diagonal swipe moves sideways, no slam | PASS |  |
| 375x667 flick up fires the power at full meter | PASS | {"dt":134,"tx":0,"ty":-140,"moved":false,"what":"power"} |
| 375x667 flick up at 0% meter does nothing | PASS |  |
| 375x667 the page never scrolls during play | PASS | {"y":0,"top":0,"bodyH":670,"vh":667} |
| 375x667 board and quest line fit on screen | PASS | {"bottom":639,"right":329.5,"quest":660,"vw":375,"vh":667} |
| 375x667 home screen scrolls | PASS | scrollTop 385 |
| 375x667 game waits behind the home screen | PASS |  |
| 375x667 no console errors | PASS |  |
| rotate and resize mid-game: board refits, no errors | PASS | {"bottom":751,"right":392,"vw":430,"vh":932,"h":635} |
| landscape phone: board still visible (shrinks to fit) | PASS | {"h":246,"bottom":362,"vh":390} |
| background tab for 4 s and back: no time jump | PASS | moved 0 rows while hidden, 1 on return |
| overlays opened/closed in random order: input and frames still work | PASS | 16 steps;  |
| localStorage blocked: game starts and runs with no errors | PASS |  |
| localStorage cleared mid-game: win still saved | PASS | mb_level=5 |
| performance at 1x CPU throttle: physics tick under 4 ms | PASS | physics 0.28 ms, whole frame 0.99 ms avg / 4.6 worst, 60 fps |
| performance at 4x CPU throttle: physics tick under 4 ms | PASS | physics 2.11 ms, whole frame 5.38 ms avg / 226.6 worst, 55 fps |
<!-- /gen:browser -->

Notes:
- **Flick timing.** Each simulated touch event costs about 50 ms through the protocol, so a "90 ms" flick arrived as 300 ms and missed the 250 ms slam window. The test now sends flicks with fewer events (arriving at 130–180 ms). A real phone flick is about 100–200 ms.
- **Background tab.** Headless Chromium keeps running `requestAnimationFrame` when "frozen", so the check holds frames for 4 s and then releases them with the 4 s timestamp jump, which is what a phone does when the tab comes back. The loop clamps every frame to 0.1 s.
- **Frame rate.** With 4× CPU throttling (a mid-range phone), a busy level 20 runs at 55–56 fps:
  - physics averages 2.1 ms per frame and the whole frame 5.4 ms with the debug validator on;
  - the worst frame was 227 ms, but that was the first-frame warm-up plus the debug-only validator;
  - without `?debug`, 8 frames in 8 s went over 40 ms, all of them at injected key presses;
  - the profile is mostly native canvas compositing, not game code.
- **Performance.** The physics tick was profiled and rewritten with flat typed arrays. Rigid blocks, the piece mask and neighbour lookups no longer create closures or `[x, y]` pairs. The tick went from 0.42 ms to 0.22 ms in node, and the results are bit-for-bit identical (checked on 24 seeded games).

### Bug log

| # | Bug | How found | Seed / steps | Fix commit | Regression test |
|---|---|---|---|---|---|
| 1 | Fall distance was tracked per piece id. It leaked for pieces destroyed mid-fall, and the two halves of a split piece shared it, so a falling half never smashed glass because the resting half reset it every tick | Validator in the rig ("falling block N has no cells") | Rig level 1, seeds 101012–101019; levels 12, 23 and 34, many seeds | 32eed00 | `regression: halves of a split piece track their own falls`, `regression: a block destroyed while falling leaves nothing behind` (both fail on the old code) |
| 2 | A win wasn't saved until the next level *started*, so quitting on the win screen or during the interstitial lost the win | Session test | Win level 7, close the app before tapping Next | 32eed00 | `a win is saved at once: quitting on the win screen or during the ad keeps it` |
| 3 | A saved `null` (corrupt storage) crashed `dailyReady` and the Daily challenge button | Fuzzer | seed 11000437, band d | 32af264 | `regression: corrupt saves of every kind fall back to defaults` |
| 4 | Wrong-typed saved numbers (e.g. `"x"`, Infinity, −5) silently turned off ad pacing, loss counting and the helping hand | Found while fixing #3 | `mb_last_ad="x"` meant no interstitial ever; `mb_since_ad=-5` | 32af264 | same test as #3 |
| 5 | A system clock set backwards (saved `mb_last_ad` in the future) locked interstitials out forever | Found while fixing #3 | `mb_last_ad` = now + 1 year | 32af264 | `regression: a clock set backwards does not lock ads out forever` |
| 6 | Wood floating was dead code: water dissolved the wood before it could float | Test card `float` failed | any wood under water | 32eed00 | removed; card `soak` covers what does happen |
| 7 | Stone and brick erosion was too slow to see (12 of 64 particles after 9 s) | Test card `erode` | card scene | 32eed00 | `water wears stone down to sand, and the wear spreads through the piece`, card `erode` |
| 8 | The background cloud layer was drawn as opaque grey blobs that looked like smoke or rubble and hid materials | Card screenshots | levels 1–45, any board | b1f694b | visual: `docs/shots/card-*.jpg` |
| 9 | The canvas "LEVEL CLEARED" text bled through the win-screen overlay behind the next-level preview | Hook screenshot | win any level | b1f694b | visual: `docs/shots/hook-06-win-screen.jpg` |
| 10 | The daily challenge said "same level for everyone today" but dealt pieces from `Math.random`, so every player got a different game | Code review | Start the daily on two devices on the same day | de3d652 | `regression: the daily challenge deals the same pieces to everyone that day` |

Not bugs, but found and fixed on the way:
- Level 2's first piece reacted with nothing, so a newbie's first drain came at 17 s; it's now 5 s.
- Pure-random play won 100% of levels 1–30, which is why the piece budget exists.
- The expert bot played *worse* than the human-ish bot because it buried reactions still in progress. It now looks ahead and waits for power targets.

---

## How to re-run

```sh
npm test                                     # unit, session, edge and card tests
node tools/rig.js all --from 1 --to 100      # win rates for the three bots
node tools/rig.js campaign --bot human       # first-try rates, levels in order with retries
node tools/calibrate.js --games 40           # re-derive piece budgets (writes src/budgets.js)
node tools/fuzz.js --games 1000              # 1000+ games per level band
node tools/browser/check.mjs                 # mobile browser checks
node tools/browser/cards.mjs                 # one screenshot per test card
node tools/browser/hook.mjs                  # instant-hook checklist
node tools/report.js                         # rebuild the generated tables in this file
```

In the browser: `?debug` exposes `window.mb` and runs the validator every frame. `?debug&scene=<id>` loads a test-card scene, and `?level=N` jumps to a level.
