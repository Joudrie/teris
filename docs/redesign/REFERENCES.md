# Reference teardown

Techniques from twelve reference games that we can carry over, written so an engineer can build them. The numbers are approximate. They come from observation and public teardowns, not from measuring the shipped builds, so treat them as starting values to tune by eye. Each section ends with **Use for**, which maps the technique onto Material Blocks. Public sources used: [Naavik on Royal Match](https://naavik.co/digest/why-dream-games-success-is-a-challenge-to-replicate/), [This Week in LiveOps on Royal Match UX](https://thisweekinliveops.substack.com/p/5-simple-ux-lessons-from-royal-match), [Game Developer's audio analysis of Tetris Effect](https://www.gamedeveloper.com/audio/game-audio-analysis---tetris-effect) and the [Alto's Odyssey press kit](https://altosodyssey.com/press/thelostcity).

## Royal Match

- **Buttons.** A lit top face sits on a 6–8 px bottom lip in the same hue but about 30% darker, over a soft drop shadow. The face has a vertical gradient (the top is roughly 10–15% lighter) and a 1–2 px white highlight along its top edge. On press, the face drops by the lip height in about 60–80 ms and the lip collapses. On release it springs back with a small overshoot over about 150 ms. Colours keep fixed roles: green means go, red means close, blue is secondary.
- **Labels.** Labels are a white, heavy, rounded display face with a 2–3 px outline in a dark shade of the button's own hue (not black) and a 2 px hard drop shadow. Numbers get the same treatment.
- **The HUD's hero.** The top bar holds two chunky plaques: the goals (icon plus remaining count) and moves. Both use big numerals. When a goal is finished, its count turns into a green tick with a pop. Moves turn red and pulse at about 5 left.
- **Collection flights.** Each goal item lifts off the board, scales up to about 1.2×, and flies a curved path to its slot in roughly 400–600 ms, with launches staggered about 30–50 ms apart. The counter goes down when an item *arrives* (with a squash-bounce of the slot and a sparkle), not at match time.
- **Speed is a feature.** Cascades are short, the board still takes input while they resolve, and a free reshuffle replaces dead boards. Naavik credits this speed with fitting more attempts into each session.
- **Booster bar.** Four round wells along the bottom. Each has a red count badge, or a green "+" when empty, which opens the coin offer. Arming a booster dims everything except valid targets and shows a one-line hint above the bar.
- **Win and lose.** On a win, leftover moves turn into rockets that fire across the board before the "Level completed" banner. Coins then stream to the top counter, which ticks up as each one lands. On a loss, the "+5 moves" offer shows which goals are still missing, and the price goes up on a second fail.
- **Use for:** the button and label recipe; drain credit flying from each reaction to the bar; leftover pieces converting into a bonus drain cascade.

## Candy Crush Saga

- **Saga map.** A vertical path of numbered nodes winds through episodes of roughly 15 levels, each with its own palette. Cleared nodes show 1–3 stars, the current node pulses under the player's avatar, and hard levels have tinted nodes.
- **Level-start card.** A modal with a "Level N" ribbon, three empty stars, a single objective line with an icon ("Collect 30 jelly"), pre-game booster toggles and one Play button. It never carries more than one sentence.
- **Praise ladder.** A deep voice and 3D text climb with cascade size ("Sweet", "Tasty", "Delicious", "Divine"), and "Sugar Crush!" plays on a win. The words have a gradient fill, a thick dark outline and a short extrusion. They scale 0 → 1.2 → 1 in about 300 ms, hold for about 600 ms, then float up and fade.
- **Score pops.** Points appear at the match location in the colour of the candy matched. A star meter fills during play and dings at each threshold, so stars are earned live, not only at the end.
- **Candy depth.** Each candy is one saturated hue with a white crescent highlight at the top left, a darker rim and a soft drop shadow. The board sits on a semi-transparent dark panel, so the candies pop over a busy background.
- **Onboarding.** A hand sprite loops the exact gesture (a cycle of about 1.2 s), everything except the involved tiles is dimmed, input is limited to that one move, and there's one short line of text.
- **Use for:** a descending tower map (100 ft at the top, ground at the bottom); the level card; a praise ladder tied to combo tier; tutorials limited to one legal move.

## Block Blast!

- **The bevel recipe.** Each cell is a flat saturated square with lighter top and left edges and darker bottom and right edges (about 3 px at a 40 px cell) around a slightly lighter inner face. Only the hue changes between colours. It reads as 3D without any lighting.
- **The board is a well.** A dark navy recessed panel with faint grid lines, on a deep blue gradient, gives maximum contrast to saturated blocks.
- **Drag preview.** A dragged piece floats about one cell above the finger so the thumb never covers it. A ghost shows where it will land, and any rows it would complete light up in the piece's colour before release.
- **Clear.** The line flashes white for about 60 ms, then bursts into cell-sized squares in the block's colour. Combo text appears in the centre and steps up in size and particle count each tier, along with a "Combo ×N" counter.
- **HUD.** The score is a huge centred number and the clear hero. The best score is small at the top left and settings sit at the top right. There's no currency in the loop.
- **Use for:** the bevel recipe as our base tile; previewing which cells will react before a piece locks; a dark well behind the board.

## Tetris (official mobile) and Tetris Effect

- **Fixed identity.** Every piece keeps a guideline colour forever. The ghost piece is a low-alpha outline. The next queue and the hold slot are small and sit off the main axis.
- **Forgiving lock.** A lock delay of about 0.5 s resets on movement, up to a cap (the guideline uses about 15 resets), so touch players can make fine adjustments without misdrops.
- **Touch schemes.** The mobile app offers drag-to-move with sensitivity settings, tap to rotate and swipe down to hard drop. The piece follows the finger relative to where it touched, not to an absolute position.
- **Spectacle that scales.** A single clear gets a flash. A four-line Tetris gets a big label beside the board (not over it), screen shake and a longer stinger.
- **Reactive music (Effect).** Each move or rotation adds a pitched note in the key, landing plays a percussive stinger, and clears play longer stingers whose notes vary. New layers come in at progress thresholds (about one-third and two-thirds of the line goal).
- **Zone (Effect).** Activating the meter low-pass filters the music, drops the vocals and stops time. Clears then play chords instead of single notes.
- **Use for:** forgiving lock rules; reaction sounds quantised to the key; firing a power filters the music (Zone); stems that build with drain-bar progress.

## Puyo Puyo Tetris

- **Spoken chain ladder.** Each chain step triggers the next line in the character's spell ladder (Arle's runs up to "Bayoen!"), so players can hear how far a chain got without looking.
- **Chain counter.** "N Chain!" pops at the clear location with a big bouncing numeral and a smaller word.
- **Typography with energy.** Heavy italic display type with a gradient fill, a thick outline and a slight shear. Each character has their own accent colour.
- **Squash and blobs.** Puyos squash about 20% on landing and rebound. Same-colour neighbours visually fuse into one blob, which is autotiling by colour.
- **Pinch state.** When the stack nears the top, the music switches to a tense variant and the portraits look panicked.
- **Use for:** autotiling blocks by id so a piece reads as one object; a tense music variant when the board is nearly topped out; a numeral-first combo counter.

## Minecraft and Minecraft Dungeons

- **Texture first, hue second.** At 16×16, each material has its own pattern built from about 4–6 values. Stone is speckled, planks have horizontal grain, sand is a fine dither, brick is a mortar grid, and glass is a frame with a clear centre and two diagonal glints. Each one still reads in greyscale.
- **Face shading.** Faces are shaded by direction: the top at full brightness, the sides at roughly 80% and 60%, the bottom at about 50%.
- **Ambient occlusion.** Smooth lighting darkens the inner corners where blocks meet by a few steps, which grounds stacks.
- **Hard pixels.** Nearest-neighbour scaling at integer multiples, with no texture filtering.
- **Dungeons lighting.** Blocks get a warm key light and cool shadows. Emissive materials (lava, torches) glow and tint their neighbours. Particles are small cubes, not soft circles.
- **Material sound.** Each material has its own break and place sound (gravel crunch, wood thunk, glass shatter).
- **Use for:** our 10 material textures; baked face shading and AO in the atlas; fire lighting its neighbours; square debris; per-material impact sounds.

## Crossy Road

- **Flat voxels.** No textures, a small hue set, shading by face direction only, and a single soft contact shadow under each object.
- **Lane rhythm.** Ground rows alternate between two very close shades, which gives scale and helps readability.
- **Hop feel.** About 50 ms of anticipation squash, a stretch in the air, a squash on landing. The whole hop takes about 150–200 ms and input is buffered.
- **Honest ads.** Ads are opt-in rewarded video framed as a gift ("Watch a video for coins"), plus a free gift every few hours. Nothing interrupts play.
- **Use for:** an alternating backdrop rhythm; anticipation and land squash on piece lock; rewarded ads that are only ever opt-in.

## Townscaper

- **Neighbour-aware placement.** Each click adds one block, and its neighbours re-resolve their shapes (arches, roofs, stairs), so anything you build looks authored.
- **Pop-in.** Blocks scale 0 → 1.1 → 1 over about 200 ms, and adjacent blocks give a small wobble.
- **Almost no UI.** A colour strip at the bottom and nothing else. Each placement plays a soft, pitched clack.
- **Atmosphere.** A sky gradient, soft fog and gentle shadows from a single sun.
- **Use for:** neighbour-aware autotiling when blocks split or merge; pop-in on spawn; pitched placement sounds.

## Monument Valley

- **Strict palettes.** Each chapter uses about 3–5 hues. Isometric faces get fixed tones (lightest top, mid left, darkest right) over a gradient sky.
- **Negative space.** One object is centred with lots of air around it, and the in-level UI is a single small pause glyph.
- **Detents.** Rotating handles click into place with a tone, and a completed connection resolves with a chime.
- **Title cards.** Chapter cards fade in elegant serif type, hold for about 2 s, then fold into the level.
- **Use for:** a 3–5 hue rule per tower section; fixed face tones; a calm card for each new section.

## Toon Blast

- **Pre-telegraphed power.** When a group is big enough to make a power-up, its cubes show the power-up icon *before* you tap.
- **Glossy cubes.** Rounded squares with strong top highlights and dark outlines, matching the cartoon cast.
- **Characters as framing.** The mascots appear on the level start and on wins, not during play.
- **Finale.** Leftover moves turn into rockets that clear the board before the results screen.
- **Use for:** showing a glyph on cells that are about to react; mascots only on cards.

## Two Dots

- **Restraint.** Flat dots with no gloss and soft world backgrounds. The type is a clean, small geometric sans.
- **Rising notes.** Like the original Dots, each dot you add to a chain plays the next note of a rising scale. Closing a square flashes the whole screen in that colour and plays a chord.
- **Meaningful sound.** Taps only make a sound when they do something, so silence marks a dead tap.
- **Illustrated map.** An expedition map with hand-drawn landmarks for each world.
- **Use for:** combo steps rising in pitch; quiet meta screens to offset the loud in-game UI.

## Alto's Odyssey

- **Atmospheric parallax.** About 4–6 background layers, with each farther layer lower in contrast and closer to the sky colour. The foreground is darkest.
- **Time of day and weather.** Sky keyframes (dawn, day, dusk) blend continuously and shift the whole palette. Sandstorms and lightning are events.
- **The world is the menu.** Thin white type floats over the live scene, and menus fade in without hiding it.
- **Use for:** the sky changing with altitude (clouds below at 100 ft, trees and warm light near the ground); the home screen as a live scene.

## Principles we adopt

1. Every button is a lit face on a same-hue darker lip that collapses on press. (Royal Match)
2. In-canvas text is white with a hue-tinted outline and a hard drop shadow, and the hero text gets a gradient fill and extrusion. (Royal Match, Candy Crush, Puyo Puyo Tetris)
3. The HUD has one hero (the drain bar) and one secondary (pieces left), and everything else is an icon. (Royal Match, Block Blast)
4. Progress has to travel: credit flies from the reaction to the bar and counts on arrival. (Royal Match, Candy Crush)
5. Blocks get depth from baked bevels, face shading and AO, never from real-time lighting. (Block Blast, Minecraft)
6. Materials are told apart by texture pattern and value as well as hue, and must read in greyscale. (Minecraft)
7. A piece is one object: autotile on block id, with square debris when it breaks. (Puyo Puyo Tetris, Townscaper, Minecraft Dungeons)
8. Telegraph outcomes before commitment: preview the cells that will react before a piece locks. (Block Blast, Toon Blast)
9. Combo feedback climbs a ladder in words, scale, particles and pitch, and resets visibly. (Candy Crush, Two Dots, Puyo Puyo Tetris)
10. Music reacts to play: notes in the key on moves, stems that build with progress, a filter while a power runs. (Tetris Effect)
11. Keep animations fast and keep the board taking input while effects resolve. (Royal Match)
12. Leftover pieces turn into a bonus spectacle before the results screen. (Candy Crush, Royal Match, Toon Blast)
13. Every tower section gets a strict 3–5 hue palette, and the sky changes with altitude. (Monument Valley, Alto's Odyssey)
14. Tutorials show one gesture with a looping hand on a dimmed board, accept only that move, and use one line of text. (Candy Crush)
15. Lock rules forgive touch input: a lock delay that resets on movement, with a cap. (Tetris)

## Things we deliberately avoid

- Lives or energy walls, and anything at all blocking the daily challenge.
- Countdown timers, fake scarcity and "offer ends in 00:59" pressure.
- Forced interstitial ads. Rewarded video is opt-in and framed as a gift, as in Crossy Road.
- Rigging levels to be "almost winnable" to sell continues. Losses must be honest and readable.
- More than one currency in the core loop, or prices shown mid-level.
- HUD clutter: no more than two numbers at the top of the play screen, and nothing that covers the board.
- Mascots or characters talking over gameplay.
- Soft-focus blur, filtered pixel art, or glow used to hide weak shapes.
