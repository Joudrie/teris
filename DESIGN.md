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
<!-- /gen:winrates -->

**Bugs fixed: 9** (see the [bug log](#bug-log)). **Final fuzz: see [Fuzzing](#fuzzing): 0 crashes, 0 invariant breaks.**

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
<!-- /gen:perlevel -->

</details>

---

## Retention proxies

<!-- gen:retention -->
<!-- /gen:retention -->

The no-drain gap is measured from the moment the first piece lands. For a true first-timer who never drops pieces, the newbie bot shows gaps of 10–20 s, because a piece takes 7–9 s to fall on its own at early speeds. The first drain still lands at 7.2 s with no input at all (see the hook checklist).

---

## Instant-hook checklist (real browser, 390×844, fresh save)

`node tools/browser/hook.mjs` opens the game in Chromium with touch emulation. It waits ten seconds with no input, then lets the **newbie bot** play level 1 through the live page. The newbie bot is slow to read pieces, swipes slowly and mostly lets pieces fall on their own.

<!-- gen:hook -->
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
| Water turns sand to mud, mud sinks (`mud`) | 4 | 4 | 3 | Mud at once; one water piece drains about 4 blocks over 4.5 s | Level 4 deals water onto a dune | Big payoff from one piece |
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
<!-- /gen:browser -->

Notes:
- **Flick timing.** Each simulated touch event costs about 50 ms through the protocol, so a "90 ms" flick arrived as 300 ms and missed the 250 ms slam window. The test now sends flicks with fewer events (arriving at 130–180 ms). A real phone flick is about 100–200 ms.
- **Background tab.** Headless Chromium keeps running `requestAnimationFrame` when "frozen", so the check holds frames for 4 s and then releases them with the 4 s timestamp jump, which is what a phone does when the tab comes back. The loop clamps every frame to 0.1 s.
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
| 8 | The background cloud layer was drawn as opaque grey blobs that looked like smoke or rubble and hid materials | Card screenshots | levels 1–45, any board | (this pass) | visual: `docs/shots/card-*.jpg` |
| 9 | The canvas "LEVEL CLEARED" text bled through the win-screen overlay behind the next-level preview | Hook screenshot | win any level | (this pass) | visual: `docs/shots/hook-06-win-screen.jpg` |

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
