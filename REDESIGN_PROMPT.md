# Material Blocks: full studio redesign

> Paste this whole file into a fresh Claude Code session on `joudrie/teris`.
> The owner fills in the **Settings** block first. Everything below it is for the agent.

---

## Settings (owner edits these)

- **Checkpoint after the three visual directions:** `ON`
  (`ON` means stop after Phase 2 and wait for the owner to pick a direction. `OFF` means go ahead with your own recommendation and don't wait.)
- **Branch to start from:** `claude/new-session-qpcuho` (the bug-fix session's branch), unless a newer one exists. See §2.1.
- **Owner's own notes** (paste below; they override anything in this prompt they contradict):

```
(paste notes here)
```

---

## 0. Who you are and the bar you have to clear

You are the whole founding creative team of a mobile games studio in one agent: **art director, UI/UX lead, technical artist, VFX and game-feel engineer, sound designer, and live-ops/monetization designer.** You've been handed a working prototype with this brief: *"This is a prototype. Make it the game."*

The owner's words, lightly edited:

> "I enjoy the picture, but it's genuinely a prototype. I'm trying to change everything. I want the game to feel really professional and polished, like it was made by a proper studio. I want it to feel like it could make a lot of money for what it is. I'm totally fine completely redesigning the user interface. Candy Crush, Tetris and games like that have a 3D aspect to them. Keep it 2D but also 3D, like Minecraft: pixelly and flat, but with depth. Rip this apart. Take screenshots and analyze what's good and bad about them: fonts, the background color, the background style, the style of the blocks. When I open it I want to immediately feel the difference. If it looks anything like the old one I'll be pretty disappointed, and anything that stays similar, you have to justify."

**The bar. All three must hold.**

1. **One-second test.** When the owner opens the new build, they feel the difference before touching anything. The first frame alone has to say "new game".
2. **App Store shelf test.** Put a screenshot of the new build next to Royal Match, Candy Crush Saga, Block Blast! and the official Tetris mobile app on a store page. It shouldn't look like the odd one out, or like a web page.
3. **No-survivors test.** By default, nothing of the prototype's look survives. Anything still recognizably similar (layout, colors, fonts, block look, screen structure, copy) needs a written justification in the similarity audit (§9.3). "It was already fine" doesn't count unless you show the alternatives you actually tried and say why they lost.

You have **full permission** to tear down and replace the layout, fonts, colors, backgrounds, block and material rendering, HUD, every screen, iconography, copy, sound, music, motion, the game's name and brand, and the whole meta layer. You aren't here to polish. You're here to replace.

What you **don't** own (see §2.2) is the simulation rules and level balance. Thousands of bot games calibrated them.

---

## 1. What this game actually is (read before you judge it)

**It isn't Tetris.** It's a falling-block puzzle where every piece is a **material with physics**, and the goal is cancelling materials, not clearing lines.

- **Board:** 12 × 20 cells. Each cell is **4 × 4 particles**, so the simulation runs a **48 × 80 particle grid** at 30 ticks/s (`src/core.js`).
  - *Rigid* materials (stone, ice, glass, brick, wood, wet wood, fire) are blocks. Every particle in one carries a block `id`.
  - *Loose* materials (water, sand, mud) are free-flowing particles.
  - Rigid blocks can fall and split mid-level, so they aren't always aligned to the cell grid vertically.
  - Each particle is `{ m, id, heat, frz, shade, fall }`.
- **10 materials and their reactions:** fire, water, wood, wet wood, ice, sand, mud, glass, stone, brick. The full reaction table is in `DESIGN.md`. In short:
  - Water douses fire.
  - Fire burns wood, melts ice, and melts sand into glass.
  - Water turns sand to mud and soaks wood, freezes next to ice, and erodes brick and stone to sand.
  - A slam, stone, or a long fall smashes glass.
- **Goal:** fill the **drain bar** by putting materials next to what cancels them, within the level's **piece budget**. You lose if you run out of pieces short of the goal, or if the board tops out. You get one revive (+5 pieces, or clear the top 4 rows).
- **Systems already built:**
  - One **power** per level (Rainstorm, Fire Mode, Deep Freeze, Sandstorm, Hammer), charged by combos, fired by swiping up.
  - **Combos**, which multiply bar credit.
  - One **side quest** per level.
  - First-time **callouts**.
  - A **daily challenge** with a streak.
  - A **helping hand** after 3 losses.
  - **Ad pacing**, **revive** and **"fill meter with ad"** seams (`src/session.js`, `src/ads.js`). No SDK is connected.
- **Fiction:** 100 levels. You start at **100 ft** and drop **1 ft per level** down to the ground. The background shifts from night sky with stars, to clouds, to city skyline, to treetops, to grass. Right now the only sign of this fiction is a label ("Lv 3 · 98 ft") and a faint gradient.
- **Controls (touch-first):** swipe to move, drag down to soft drop, flick down to slam, tap to rotate, swipe up to fire the power. There's a keyboard fallback.
- **Tech:**
  - Vanilla JS ES modules, no build step, Canvas 2D, sounds generated with WebAudio.
  - `npm start` runs `python3 -m http.server 8000`.
  - Published as a playable claude.ai artifact (link in `README.md`).
- **Architecture, which works in your favour:**
  - Pure logic, no DOM, unit-tested and fuzzed: `core.js` (simulation), `session.js` (screens, ads, revive, daily), `levels.js`, `budgets.js`.
  - The view: `main.js`, `index.html`, `style.css`, `scenery.js`, `sound.js`. **You can rebuild the entire view without touching the rules.**
- **Tooling already there:**
  - `npm test` runs rules, session, edge-case and mechanic-card tests.
  - Real Chromium with phone emulation and real touch events (Playwright, Chromium at `/opt/pw-browsers`): `tools/browser/check.mjs`, `hook.mjs` and `cards.mjs`, with helpers in `tools/browser/lib.mjs`.
  - URL switches:
    - `?debug` exposes `window.mb` and runs the invariant checks every frame.
    - `?debug&scene=<id>` loads one of 40 scripted scenes: `douse burn soak wetwood melt freeze mud glassmelt slam gentle stone fall erode brick firestays rain blaze deepfreeze sweep hammer flood wall showcase rotate mixed ghost bar combo quest meter budget callout win lose revive interstitial meterad home daily help`.
    - `?level=N` jumps to a level.
    - `?playtest` shows the playtest panel on the home screen.

Read `DESIGN.md` fully before Phase 1. It explains why many things are the way they are (the instant hook, the piece budget, "So close!" framing, ad pacing).

---

## 2. Non-negotiables

### 2.1 The game code isn't on `main`

`main` is just a README. The game lives on **`claude/new-session-qpcuho`**, where another session is fixing bugs **right now**.

- Run `git fetch origin` and list the remote branches with their latest commit dates. Start from the newest bug-fix work (the branch named in Settings, unless something newer exists). If it isn't clear, ask the owner.
- Work on a new branch, e.g. `claude/studio-redesign`.
- **Keep merge conflicts small.** Put new view code in new files (e.g. `src/render/…`, `src/ui/…`, `src/fx/…`, `src/audio/…`) rather than editing `main.js` line by line, and leave `core.js` and `session.js` alone where you can.
- Before you finish, fetch and merge the latest bug-fix branch again and resolve conflicts. Don't rebase or force-push anyone else's branch.

### 2.2 The simulation stays the simulation

- Don't change reaction rules, timings, board size (12 × 20, 4 × 4 particles), piece budgets or level content. Budgets were set by `tools/calibrate.js` over thousands of bot games, and changing rules invalidates them.
- If the presentation truly needs a logic change (e.g. a new event for the renderer to hook into, like "block X started burning"), keep it **additive**: emit events, don't change outcomes. Prove it by running `npm test` and spot-checking `node tools/rig.js all --from 1 --to 20`, so win rates don't move.
- New meta systems (stars, coins, map, shop, boosters, daily rewards) go in **new modules** layered on `session.js`, not inside `core.js`.
- Boosters that affect play mustn't be needed to win any level. Levels stay calibrated for no boosters.

### 2.3 The instant hook stays

On a **first launch**, a piece must still be falling within about 1–2 s of opening, and the first reaction must land within about 10 s with no input. `tools/browser/hook.mjs` measures this. A short studio splash is fine if it fits that budget. Returning players can land on a home or map screen; decide and justify.

### 2.4 Tests and checks stay green

- `npm test`, `node tools/browser/check.mjs`, `node tools/browser/hook.mjs` and `node tools/browser/cards.mjs` must all pass at the end.
- When your new DOM breaks a selector, **update the check, keep its intent**, and list every check you changed and why. Never delete or weaken a check to get to green.
- Keep `?debug`, `window.mb`, `?scene=`, `?level=` and `?playtest` working. The tools depend on them.

### 2.5 Performance

- 60 fps on a mid-range phone. The existing `check.mjs` rows run at 1× and 4× CPU throttle. Keep the 4× row at **≥ 55 fps** on a busy board, and report before and after numbers.
- Pre-render and cache everything you can: sprite atlases, baked bevels, gradients. No per-particle `fillStyle` string building in the hot path (the current `drawPiece` does this).
- Mobile memory: total assets (images, audio, fonts) under about **8 MB**.

### 2.6 Shipping format

- It must still deploy as **static files**: no server, and it must run from `python3 -m http.server`.
- It must stay publishable as a claude.ai artifact. External scripts only from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, or unpkg.com, each at an **exact pinned version**. Fonts from Google Fonts or self-hosted `.woff2`.
- If you add libraries (PixiJS, Three.js, GSAP, Howler…), pin them or vendor them.
- A build step (e.g. Vite) is allowed only if the output is plain static files and `npm start` still serves something playable. Justify it.

### 2.7 Saves survive

Keep every existing `localStorage` key (`mb_*`) readable, so current progress, streaks and mute settings carry over. Add new keys alongside; don't rename the old ones.

### 2.8 Legal

- No "Tetris", "-tris" or "tetromino" anywhere user-facing.
- No Tetris trade dress: no fixed set of 7 colored tetrominoes as a brand look, no Tetris-style logo, no Korobeiniki.
- Assets must be generated by you, written by you (SVG, canvas, synthesis) or **CC0**. Log every external asset with its source and license in `docs/CREDITS.md`.

### 2.9 Monetization that's premium, not predatory

- Build the store, rewarded-ad and booster **UI** to a shippable standard, but there's no real store or ad SDK. Wire purchases to a clearly labelled stub sheet.
- No fake "limited time!" countdowns that reset, no confusing currency math, no tricks with the close button.
- The "Remove ads" path and the existing pacing rules stay.

---

## 3. Phase 1: forensic audit of the prototype

### 3.1 Capture everything

Write `tools/browser/shoot.mjs`, reusing `lib.mjs`, so it can produce the same matrix again after the redesign.

**Viewports:**
- 390 × 844 (primary, DPR 2)
- 375 × 667 (small)
- 430 × 932 (large, DPR 3)
- 768 × 1024 (tablet)
- 844 × 390 (landscape phone)
- 1440 × 900 (desktop)

**States:**
- The first frame of a fresh save, plus 1 s and 7 s in (the first reaction).
- A busy mid-level board.
- **A "material lineup" scene** you add to `src/scenes.js`. It shows all 10 materials side by side, plus every reaction mid-progress (burning, steaming, melting, freezing, eroding, mud sinking, glass shattering).
- A combo popup, a slam and a smash, and a power firing (each power).
- The first-time callout.
- The celebration (3–4 frames), the win screen, the lose screen ("So close!"), and the revive.
- The interstitial and the meter ad.
- Home (top and scrolled), the daily challenge, and the helping-hand banner.
- Low pieces left (the red pulse).

Use the existing scenes wherever you can.

**Motion:**
- Record Playwright video of level 1 from open to win, and of level 5's glass smash.
- Pull frames into contact sheets.
- Write down timings: spawn, land, first reaction, popup durations.

Save everything to `docs/redesign/before/`.

### 3.2 Critique every screenshot harshly

Look at each image yourself. Score each category **1–10 against the reference games**, not against "fine for a prototype":

1. **One-second read.** Where does the eye land first? Is that the right thing?
2. **Typography.** Typeface identity, scale, weight contrast, how numbers look, and the outline and shadow on in-canvas text.
3. **Color.** Palette coherence, value structure, saturation, how well materials, UI and background separate, and mood.
4. **Background.** What it says about the world, its depth, and whether it competes with or supports play.
5. **Blocks and materials.** Readable at a glance, distinct from each other, depth, lighting, the quality of each material and each reaction state.
6. **Layout and hierarchy.** Use of the screen, dead space, thumb reach, safe areas, alignment, and the grid.
7. **HUD.** Information density, words versus icons, what's the hero and what's secondary.
8. **Motion and juice.** Anticipation, impact, follow-through, easing, and feedback on every action.
9. **Copy and voice.** Personality, length, and whether it sounds like a game or a spec.
10. **Sound.**
11. **Brand and perceived value.** Would anyone pay money inside this?
12. **Monetization surfaces.** Do the ad, revive, daily and shop moments feel premium, or like test screens?

Write `docs/redesign/AUDIT.md`. For each screen: the screenshot, the scores, and a ranked bullet list of everything wrong, with measurements ("drain bar is 12 css px wide", not "drain bar is small"). End with **"The 15 reasons this reads as a prototype"** and **"What's worth keeping, and why."**

### 3.3 Pre-audit from a first look (the minimum to find, not the ceiling)

Confirm each of these with your own screenshots and measurements, then go further.

1. **It looks like a dark-mode web dashboard, not a game.**
   - Palette `#101218` / `#1b1e26` / `#2c303b`, 1 px borders, 6–8 px radii: a SaaS admin theme.
   - The font is `system-ui`. It renders as Roboto, SF or Segoe depending on the device, so the game has no typographic identity and looks different on every phone.
2. **The HUD is a reading exercise.** Text above and below the board:
   - "Lv 3 · 98 ft"
   - "18 left"
   - "Next Water"
   - A 12 px cyan tip sentence ("Water: pour it on fire, sand or wood")
   - A "Fire Mode" label
   - "Side quest: burn 3 blocks of wood (0/3) → +power"

   Top puzzle games use icons and big numbers in play, and keep sentences for tutorials.
3. **The main objective is the smallest thing on screen.**
   - The drain bar, the thing you're trying to fill, is a **12 px sliver** to the right of the board, with a 15 px number above and "/18" below.
   - The power meter is a 10 px bar.
   - Meanwhile empty sky fills about 70% of the board early in a level.
4. **Dead space.** At 390 × 844 the board ends around y = 684 and the quest line around y = 700. That leaves about **130 px (~15%) of empty screen** at the bottom.
5. **The board has no physical presence.** It's a canvas with a 1 px `#2c303b` border and an 8 px radius: no frame, no well, no container, no sense of place.
6. **The blocks are flat 4 × 4 pixel mosaics.**
   - They're scaled up with nearest-neighbour, with a 1-particle light outline on rigid edges.
   - No lighting, no depth, no shadow, no ambient occlusion.
   - The Minecraft feel is accidental, not designed. `DESIGN.md` itself calls these textures placeholders.
7. **Loose materials look like rendering bugs.** Water draws as stepped blue rectangles with a row of white dots. Sand and mud read as noise, not substance.
8. **The ghost piece** is thin, low-alpha outline boxes. **The next-piece preview** is a 56 × 42 canvas of outline-only squares, so the next piece looks like a wireframe.
9. **The background is thin.**
   - A two-stop vertical gradient, 60 stars at 1.5 px, and translucent white ellipses for clouds.
   - The city skyline is flat rectangles with random windows.
   - The "descending the tower" fiction is invisible. Nothing says *tower*.
10. **In-canvas popups** ("SMASH!", "SLAM", "+1", "COMBO ×2", "LEVEL CLEARED") are `system-ui` bold with a black stroke, the cheapest treatment there is. In the slam scene, "SLAM" and "SMASH!" overlap.
11. **The home screen:**
    - A plain bold "Material Blocks" title.
    - A 280 px square with an orange-red-blue diagonal gradient that says "Play".
    - Then a long scrolling manual: 5 controls, 10 material paragraphs, powers, two-material pieces.

    Studios teach through play, not manuals. There's no map, no visible progress, and no reason to come back beyond a small outlined "Daily challenge" button.
12. **The win screen** is text on an 88% black scrim, with three different button styles in one modal (orange gradient, grey outline, yellow outline). No stars, no reward, no character, and none of the celebration carries into the screen itself.
13. **The lose screen:** "Watch ad: clear the top 4 rows" leads with the cost, not the gift. The board behind is a muddy dark mess.
14. **Ad placeholders** stack two modals ("Test interstitial ad / 2 / No ad network connected yet." over a faded win screen).
15. **Icons are Unicode glyphs:** ⌂ and the 🔊 emoji. They render differently per OS and don't match each other. The home (34 px) and mute (28 px) buttons are under the 44 pt minimum tap target.
16. **Material colors sit close together in hue and value:**
    - wood `#c0813f`, sand `#dcb66b`, brick `#a8453a`, fire `#ff6a1f`
    - ice `#8fcdf0`, glass `#cdeee6`, water `#3f8ee3`
    - wet wood and mud are still too similar (`DESIGN.md` next steps).

    Color alone carries identity, so colorblind players and small screens suffer.
17. **Sound** is oscillator beeps (`DESIGN.md`: "the sounds are generated beeps"). There's no music.
18. **"Material Blocks" is a description, not a brand.** No logo, no wordmark, no app icon.

**Candidates worth keeping. Each still has to win against alternatives:**
- the physics and reactions (they're the selling point)
- descending from sky to ground over 100 levels (a strong spine for a map)
- the instant-hook opening
- "So close! 88%" near-miss framing
- the ad pacing rules
- the one-power-per-level structure

---

## 4. Phase 2: references, the "2D but 3D" question, and three directions

### 4.1 Reference teardown

Study these, using whatever you can access: store pages, press kits, gameplay videos, screenshots, your own knowledge.

| Game | What to study |
|---|---|
| **Royal Match** | Chunky glossy UI, button press depth, win and reward choreography, the booster bar |
| **Candy Crush Saga** | Saga map, level-start card, praise words, collection flights to the goal |
| **Block Blast!** | How a simple grid game looks premium: beveled blocks, clean HUD, combo text |
| **Tetris (official mobile) / Tetris Effect** | Clarity at speed, line-clear spectacle, music reacting to play |
| **Puyo Puyo Tetris** | Character, chain feedback, typography with energy |
| **Minecraft / Minecraft Dungeons** | Voxel materials that read instantly at low resolution, lighting on chunky forms |
| **Crossy Road / Townscaper / Monument Valley** | Cute low-poly or voxel depth, color discipline, a sense of place |
| **Toon Blast / Two Dots / Alto's Odyssey** | Soft palettes, atmospheric backgrounds, restrained, confident UI |

For each, write **transferable techniques**, not vibes. For example: "Royal Match buttons are a lit top face on a 6–8 px darker bottom lip. On press, the face moves down by the lip height and the lip collapses." Put this in `docs/redesign/REFERENCES.md`.

### 4.2 Pin down "2D but also 3D, like Minecraft"

The owner wants depth and chunkiness without losing 2D readability: cute, tactile, voxel-ish, Candy Crush gloss meeting Minecraft materials. Define exactly what that means for this game, then evaluate at least these three ways to render it:

- **A. Faux 3D in Canvas 2D.**
  - Bake a sprite atlas per material at startup: lit top face, side or extrusion face, bevel highlights, baked AO, specular glints.
  - Draw rigid blocks by **autotiling on block id**: each particle or cell picks a tile from which neighbours share its id, so a piece reads as one chunky beveled object and not a mosaic. Add a soft contact shadow onto the background.
  - Cheapest and lowest risk; fits the current stack.
- **B. WebGL 2D (e.g. PixiJS).**
  - The same sprite approach, plus GPU filters: glow and bloom on fire, displacement or refraction on water, glass and ice, light that fire throws onto its neighbours.
- **C. Real 3D (e.g. Three.js).**
  - Orthographic or very low-FOV camera, `InstancedMesh` voxels (up to 3,840 particles), real lights, maybe a slight board tilt for depth.
  - The most "3D" option, and the biggest risk to readability and phone performance.

Whatever you pick, **spike the worst case first**: a full board, every material, fire glowing, water flowing, a smash in progress, at 4× CPU throttle in `check.mjs` terms. Report the numbers.

**The hardest rendering problems, solved explicitly whatever the approach:**
- **Loose materials** (water, sand, mud) must look like liquid and grains, not stepped rectangles. Try marching squares or metaball smoothing on the particle grid, surface highlight lines, translucency and depth tint for water, granular shading and slumped silhouettes for sand, and a glossy wet surface with bubbles for mud.
- **Partial blocks.** Burning, eroding and smashing leave cells with missing particles. They must look intentional: charred edges, crumbling chunks, cracks, not random holes.
- **Readability before beauty.** Every material must be identifiable by **color + value + surface pattern + motion**, and still distinct in a **grayscale** screenshot and under **deuteranopia, protanopia and tritanopia** simulation.

### 4.3 Three directions, really rendered

Build each direction as a **rendered mockup**: real HTML/canvas, screenshotted at 390 × 844. Show the gameplay screen (busy board with every material), the home or map screen, and the win screen.

The three must differ in **concept**, not just in palette. Example axes (pick your own):
- glossy candy-voxel vs. warm handcrafted diorama vs. moody atmospheric
- bright day vs. dusk vs. night
- toy-like vs. elemental or alchemical vs. architectural tower

For each direction give:
- **Name** and a **one-paragraph pitch**
- **World and fiction:** what the tower is, why you're descending, what the background shows
- **Palette** (hex) with its **value structure**: background, board well, materials, UI, accents
- **Type pairing:** a display font and a UI font, tested on real UI, not a specimen
- **Block and material rendering approach** (A/B/C or a hybrid)
- **UI chrome:** buttons, panels, meters, icons
- **Motion language** and **sound language**
- **Monetization fit:** how the shop, boosters and rewards look in this world
- **Risks and the perf estimate**
- **Scores** against the §3.2 rubric, and a **recommendation**

Save to `docs/redesign/DIRECTIONS.md` with the images.

**Checkpoint:** if Settings says `ON`, show the owner all three, with screenshots and your recommendation, then **stop and wait for their pick.** If `OFF`, go ahead with your recommendation.

---

## 5. Phase 3: design system

Build it as code (CSS custom properties plus a JS tokens module for canvas) and document it in `docs/redesign/DESIGN_SYSTEM.md`.

- **Tokens:**
  - color: semantic names (`--surface-well`, `--reward-gold`, `--danger`), not `--blue2`
  - type scale; spacing (4 px base); radii; elevation and shadow
  - **motion**: durations such as 80/150/250/400/700 ms; named easings such as `out-back` for pop-ins, `out-expo` for flights, and a spring for buttons
- **Typography:**
  - One display face with real personality (chunky, rounded or slab, strong numerals, holds up with a thick outline at 96 px) and one UI face that reads at 12 px. Tabular figures for counters.
  - Candidates to *test* rather than adopt by default: Lilita One, Titan One, Luckiest Guy, Bungee, Fredoka, Baloo 2, Rubik, Nunito, Sora.
  - A pixel font only if the whole direction is pixel and it looks premium at every size, which it usually doesn't.
  - In-canvas text uses the same fonts. Wait for `document.fonts.ready` before the first canvas text.
- **The game-text style:**
  - Popups, praise words and big numbers get a signature treatment: gradient fill, thick outline, drop shadow or extrusion, and bounce-in.
  - Define it once and reuse it everywhere.
- **Components, each with every state (idle, pressed, disabled, focus, attention or pulse):**
  - **3D press buttons:** a lit top face on a bottom lip; on press the face moves down and the lip collapses, with a sound and haptic
  - panels and sheets; modal; toast
  - counter badge; currency pill; progress bar; **objective meter**; ability button
  - stars; chips; tabs; toggles; the next-piece tray
- **Icons:** one custom SVG set with one stroke and fill language. **No emoji, no Unicode glyphs.**
  - home/pause, sound, music, haptics, settings, shop, coin, gem (if used)
  - star, lock, gift, calendar, trophy, close, back, info, retry, play
  - one icon per material and per power
- **Brand:**
  - Propose **5 names** (no "-tris") and recommend one.
  - Design a **wordmark/logo** and a **1024 × 1024 app icon**.
  - Keep `material-blocks` as the code and package name, and the `mb_` storage keys.

---

## 6. Phase 4: the screens

**Priority order** (ship P0 complete before moving on; the owner's first impression is the gameplay screen, because a first launch drops straight into level 1):

- **P0:** gameplay screen, blocks and materials, HUD, juice
- **P1:** win, lose, revive, pause and settings, home/map, tutorials and callouts
- **P2:** meta and monetization UI
- **P3:** marketing assets

### 6.1 Gameplay screen (P0)

- **Use the whole screen.** Zero dead space, safe areas respected, thumb-friendly.
- **The board is the hero.** As big as the screen allows, sitting in a **physical well**: a frame that belongs to the world (a tower window, a stone shaft, a glass tank; whatever your direction says), with an inner shadow and a rim light.
- **The objective is the second hero.**
  - The drain goal becomes a themed vessel, tank, drain or gauge that **visibly fills**, with a big number.
  - It receives the **collection flights** from §7.
  - It must be readable with peripheral vision.
- **Pieces left** is a big counter badge with an icon. It heartbeats at 3, with a subtle red vignette at 1.
- **Next piece** sits in a proper tray, rendered in the full material style (no wireframe), maybe with a second preview.
- **Power** becomes an **ability button**: material/power icon, a radial or fill charge, and a glowing, pulsing "ready" state. Keep swipe up, and **add tap to fire** (accessibility and discoverability).
- **Side quest** becomes a compact icon chip with a progress ring. Its details live on the level-start card and in pause.
- **Level and altitude:** compact, iconic, and tied to the world (e.g. a small floor or altitude marker on the tower).
- **Pause** replaces the home button: resume, restart, settings, home, how to play.
- **Kill the tip sentence.** Teach materials with an icon, on the level-start card and in a codex. In play, at most a tiny icon hint on the next piece.
- **Background:**
  - Layered parallax that **shows the descent**: sky, clouds, city, trees, ground across 100 levels, at much higher quality, with depth and atmosphere.
  - It must stay low-contrast behind the well, so it never competes with materials.

### 6.2 Win and lose (P1)

- **Win choreography** (script the timings in ms):
  1. board cascade or shatter
  2. praise word
  3. results card slides in
  4. **1–3 stars stamp in one by one** with sound
  5. the count-up
  6. **coins fly to the wallet**
  7. next-level preview (keep the "what's new next" idea)
  8. one big continue button
- **Stars:** define the rule from **pieces left at clear**, as a share of the budget, **without changing balance**. Use `docs/data/*` rig data so roughly the top 15–25% of human-ish bot clears earn 3 stars. Document the thresholds.
- **Lose:** the board desaturates and sinks, then the near-miss panel with a **progress ring at 88%**.
  - The revive is offered as a gift ("+5 pieces", with a gift/ad badge), not "Watch ad: …".
  - Retry is clearly secondary.
  - Keep the honest progress numbers.

### 6.3 Home and map (P1)

- **A saga-style map: the tower.** 100 floors you descend, level nodes with stars, a beacon on the current level, a showcase floor every 5 levels, and locked floors below.
- Scroll to see how far you've come; the art changes with altitude.
- Entry points: daily challenge (a calendar or chest, plus the streak), shop, settings, materials codex, profile/stats.
- **Remove the manual from home.**
  - Controls are taught in-game with animated finger-gesture hints (≤ 6 words each).
  - Materials live in an **illustrated codex**: one card per material, with a tiny animated loop of its reactions, unlocked as you meet it.
- **Returning players** land on the map with a **Play** button showing the current level. **First launch** still drops straight into level 1 (§2.3).

### 6.4 Level-start card (P1)

The goal (fill N), pieces, the level's power, the side quest, an icon for the new material if any, optional pre-level boosters (P2), and **Play**.

### 6.5 Tutorials and callouts (P1)

- Replace text callouts with **diegetic, animated hints**: a hand showing the gesture, an arrow to the target, a highlight ring.
- Copy ≤ 6 words.
- Keep "once per level, ever" and keep them skippable.

### 6.6 Pause and settings (P1)

Sound, music and haptics toggles; reduced motion; a colorblind assist that adds stronger per-material patterns and icons; controls help; credits.

### 6.7 Meta and monetization UI (P2: shippable look, stubbed back end)

- **Currency:** coins (and gems only if you can justify two currencies). Earned per win, with a star bonus. Balance shown in a pill on the map and win screen.
- **Boosters:** 2–3 pre-level boosters (e.g. +3 pieces, start with the meter at 50%), never needed to win. You may also add in-level boosters.
- **Shop:** coin packs, starter pack, **Remove ads**, and **block skins/themes**.
  - Make the renderer **skinnable from data**, so a skin swaps material tiles, VFX tints and well frame.
  - Ship 1 default skin plus 1–2 example skins.
- **Rewarded ads:** revive, "fill meter", daily double. Each looks like a gift.
- **Daily rewards:** a 7-day calendar that ties into the existing streak.
- **Lives or energy:** decide and justify. It's the biggest revenue lever and the biggest churn risk. If you add it, keep it generous and keep the daily challenge free.
- Every purchase button opens a polished **"Store not connected in this build"** sheet. Don't fake a transaction.
- The ad placeholder becomes a polished, clearly labelled placeholder screen that never stacks on another modal.

### 6.8 Copy and voice (all priorities)

Pick a voice that fits your direction (warm, playful, confident) and rewrite **every** string. Short. Verbs. Numbers over sentences. Praise words for combo tiers. Keep "So close!" or justify replacing it.

---

## 7. Phase 5: game feel, with every number tuned and written down

Implement and document each of these, with durations, easings and amplitudes, in `docs/redesign/JUICE.md`:

- **Spawn:** the piece drops into the well with a small scale pop (~120 ms).
- **Move:** a 1-cell slide tween (~60 ms) with a slight lean. **Rotate:** a tweened 90° turn (~80 ms) instead of a snap, plus a nudge on wall kicks.
- **Soft drop:** speed lines.
- **Slam:** a motion trail, then on impact:
  - 50–80 ms hit-stop
  - tiered shake (6–10 px)
  - dust burst and a bass thud
  - a haptic pulse where supported
- **Land:** ~10% squash and settle, contact dust, a soft tick.
- **Reactions, each with its own VFX and sound:**
  - douse: steam plume and hiss
  - burn: flame spreading block to block, embers, char, and fire **lighting up its neighbours**
  - melt: drips
  - freeze: frost creeping across
  - mud: bubbles, then a sinking slurp
  - smash: rotating shards with gravity, glass tinkle, a white flash
  - erode: crumbling into sand grains
- **The collection flight (the most important loop):**
  - Drained material spawns orbs or chunks in that material's color.
  - They fly in staggered arcs (400–600 ms, ease-in) into the objective meter.
  - Each arrival pulses the meter and plays a tick pitched by combo.
  - This ties board action to the goal. Make it gorgeous and cheap to draw.
- **Combo escalation:** praise word per tier, rising pitch, a warming vignette, a glowing board rim, and a bigger popup each tier.
- **Power ready:** the ability button glows and shimmers.
- **Power fired:** a ~1 s cinematic:
  1. the screen dims
  2. the power icon slams in
  3. the effect sweeps the board
  4. everything it clears flies to the meter
- **Low pieces:** heartbeat at 3, vignette at 1.
- **UI:** every button has press depth, a sound and (optionally) a haptic. Panels enter with overshoot, numbers count up, currency flies to its pill.
- **Win and lose:** as scripted in §6.2.
- **Reduced motion:** honour `prefers-reduced-motion` plus an in-game toggle. Cut shake, flashes and big camera moves; keep the information.

---

## 8. Phase 6: audio

- **Replace every beep.** Two routes; pick and justify:
  1. **Better synthesis:**
     - layered oscillators plus filtered noise
     - a generated-impulse `ConvolverNode` reverb, and a compressor on the master
     - variation per play (pitch and timing jitter) so repeats don't fatigue
  2. **CC0 libraries:** e.g. Kenney audio packs, or freesound items marked CC0 only.

  **Check network access before planning on downloads.** If hosts are blocked, use route 1.
- **A signature sound per material reaction**, plus UI sounds (tap, open, close, reward, star stamp, coin), slam and smash, combo tiers, power cinematics, win and lose stings.
- **Music:** a menu loop and a gameplay loop. If they're procedural, write a small generative system (fixed key and scale, layers that respond to combo and danger).
- **Mixer:**
  - master, music and SFX buses with separate toggles
  - music **ducks** under big moments
  - nothing plays before the first user gesture (autoplay policy)
- **Formats:** `.mp3` or `.m4a` for Safari. Total audio under about 3 MB.

---

## 9. Phase 7: verify, compare, justify

### 9.1 After-shots

Re-run `shoot.mjs` over the **same matrix** and save to `docs/redesign/after/`. Record level 1 open-to-win and the level 5 smash again.

### 9.2 Side-by-side composites

For every state, build a **before | after** image in `docs/redesign/compare/`. Open each one and look at it. If the "after" isn't obviously a different, better game, you're not done.

### 9.3 Similarity audit

Write `docs/redesign/SIMILARITY.md` as a table: **Element | Before | After | Still recognizably similar? | If yes: the alternatives tried and why this one won.**

Cover at least:
- layout skeleton; board position and aspect; HUD placement
- background; block look per material; loose-material look
- palette; fonts; buttons; overlays
- home structure; win and lose structure; copy; sounds

### 9.4 Readability proof

Render the material-lineup scene in **grayscale** and under **deuteranopia, protanopia and tritanopia** simulation. Every material must stay distinguishable. Include the images.

### 9.5 Fresh-eyes review loop

Spawn a subagent **with no context**. Give it only the before and after screenshots of the same states, and ask:

> "Rate each set 1–10 for 'looks like a top-grossing mobile game from a professional studio'. List everything in the 'after' set that still looks amateur, cheap, inconsistent or hard to read."

Fix what it finds, then repeat with a new subagent. Stop at **≥ 8/10** or when returns clearly diminish. Report every round's scores.

### 9.6 Hostile art-director pass

After the first full build, review it as a rival studio's art director whose job is finding flaws. List the top 10, fix them, and re-shoot.

### 9.7 Fresh-player pass

Play the first 3 levels as a first-timer would, through `hook.mjs` and by watching the recordings. Is it obvious what to do in the first 10 s without reading? Does every action feel good?

### 9.8 Tests and performance

All four test suites green (§2.4), plus the perf rows (before vs. after) and a list of every check you modified, with the reason.

### 9.9 Store-shelf proof (P3)

Produce **5 App Store-style screenshots** (1290 × 2796) from the real build with short captions, plus the **1024 × 1024 icon**, in `docs/redesign/store/`. Put them next to the reference games' store screenshots and judge honestly.

---

## 10. Deliverables

- A branch (e.g. `claude/studio-redesign`) with commits in logical steps, pushed often (the container is ephemeral). **Don't open a PR unless the owner asks.**
- `docs/redesign/`:
  - `AUDIT.md`, `REFERENCES.md`, `DIRECTIONS.md`, `DESIGN_SYSTEM.md`, `JUICE.md`
  - `DECISIONS.md`: every major choice, the alternatives you rejected, and why
  - `SIMILARITY.md`
  - folders: `before/`, `after/`, `compare/`, `store/`
- `docs/CREDITS.md` (every external asset and its license).
- An updated `README.md` (new name, hero screenshot, how to run) and a new "Redesign" section at the top of `DESIGN.md`.
- **A playable build.** Ask the owner whether to update the existing artifact link in the README or publish a new one, since the existing one may already be shared.
- **A final report to the owner:**
  - the top 10 changes, each with before/after images
  - the similarity justifications
  - what's stubbed (store, ads) and what's needed to make it real
  - perf numbers; fresh-eyes scores per round
  - known issues and the next 5 steps

---

## 11. Instant rejects (if you catch yourself doing one of these, stop)

- A dark slate "dashboard" UI with 1 px borders and small radii. System fonts. Emoji or Unicode icons.
- Thin progress bars for the things that matter. The objective smaller than the decoration.
- Sentences in the HUD. A manual on the home screen.
- Dead space. A board without a frame.
- Flat rectangles as buttons. Three button styles in one modal.
- Blurry upscaled pixel art. Pixel art that reads as "placeholder", not "style".
- Generic "AI" styling: purple-to-blue gradients, glassmorphism on everything, neon glow as a substitute for design.
- Making materials *harder* to tell apart in exchange for prettiness.
- Clip-art-looking assets, or assets in mixed styles.
- Shipping any screen without sound, or any action without feedback.
- Popups that overlap each other. Modals stacked on modals.
- Anything branded or styled as Tetris.
- Changing rules or balance to make something easier to draw.

---

## 12. How to work

- **Be harsh and specific.** "The drain bar holds the main objective and is 12 px wide; that's backwards", not "the drain bar could be more prominent". Back every claim with a screenshot or a measurement.
- **Be decisive.** Make the design calls yourself and record them in `DECISIONS.md`. The only time you stop for the owner is the direction checkpoint (if `ON`) and the artifact question.
- **Look at your own output.** After every meaningful visual change, take a screenshot and actually look at it before moving on. Never assume a change looks right because the code looks right.
- **Parallelize** with subagents where it helps: reference teardown, the before-shot capture, and audio while visuals are in progress. Keep one owner of the visual direction (you) so the style stays coherent.
- **Don't stop at the first pass.** The first build is the start of the §9.5–9.7 loops, not the end.
- **Merge the latest bug-fix work before you finish** (§2.1) and re-run everything.
- **When you report back**, lead with the before/after composites. The owner wants to *see* the difference first and read about it second.
