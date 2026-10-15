# Similarity audit

Every row compares the prototype (`before/`) with the redesign (`after/`). The side-by-side composites for every state are in [`compare/`](compare/). The rule from the brief: anything still recognizably similar needs the alternatives and why this one won. Where an alternative was only reasoned through rather than built, the row says so.

| Element | Before | After | Still similar? | Justification |
|---|---|---|---|---|
| **Overall look** | Dark slate web dashboard, `system-ui` | Bright toy world, voxel blocks, chunky outlined UI | **No** | – |
| **Layout skeleton** | HUD rows on top, board, quest line under it | HUD top, framed board, action bar at the bottom | **Partly.** The board is still in the middle with UI above and below | Every portrait puzzle game does this; the board is the game. Alternatives considered (measured, not built): a side tube for the goal costs about 40 px of board width ([DECISIONS.md](DECISIONS.md)); a top-only HUD leaves dead space at the bottom (the prototype's 16% problem). Every element inside the skeleton was replaced and moved. |
| **Board size and aspect** | 12 × 20 cells | 12 × 20 cells | **Yes** | Board size is a rule: levels, budgets and win rates were calibrated on it by thousands of bot games. Changing it would invalidate the balance (non-negotiable 2.2). It now has a frame, a plaque and a well, and fills 59–66% of a phone screen. |
| **Board background** | Night-sky gradient with stars and clouds *inside* the board | A dark navy well with a faint cell grid and an inner shadow; the sky lives *outside* the board | **No** | – |
| **World backdrop** | None outside the board (flat `#101218`) | A full-screen sky that changes with altitude: sun and a sea of blocky clouds, then a city, trees and the ground | **No** (the idea of altitude scenery is kept) | The descent from 100 ft to the ground was the prototype's best idea and it was invisible. It's now the spine of the backdrop and the map. |
| **Block look** | Flat 4 × 4 color mosaics, 1-particle light outline | Baked voxel tiles: 8 × 8 pixel-art faces, bevel, gloss, ink outline, drop shadow | **No** | – |
| **Loose materials** | Stepped pixel rectangles | Smooth bodies: water depth tint, ripples and surface lip; sand grains; mud gloss and bubbles | **No** | – |
| **Material colors** | Mid-saturation, close values | New palette, separated by hue, value and pattern (see [readability](readability/lineup-grid.jpg)) | **Partly.** Fire is still orange, water still blue, wood still brown | Material colors follow the real materials. Making water not blue would make the game harder to read for no gain. Each now also has its own pattern and form, which the prototype lacked. |
| **Fonts** | `system-ui` everywhere | Lilita One (display) and Nunito (UI), self-hosted; game text with an ink outline and gradient fills | **No** | – |
| **Palette** | `#101218` / `#1b1e26` / `#2c303b` and an amber accent | Sky blue, navy chrome, gold rewards, green go, ink outlines | **No** | – |
| **HUD** | Six lines of text; the drain bar a 14 px sliver | Goal meter as the hero, pieces badge, next tray, quest chip, power button; no sentences in play | **No** | – |
| **Power** | 12 px bar plus a label; swipe up only | Charge-ring button in the power's color, READY pulse; tap or swipe | **No** | – |
| **Buttons** | Flat rectangles in three styles | One system of 3D press buttons (face, lip, outline) in five colors | **No** | – |
| **Icons** | Unicode ⌂ and 🔊 emoji | 40 custom outlined SVG icons | **No** | – |
| **Home** | Title, gradient square "Play", scrolling manual | Tower map: 100 floor nodes with stars, wordmark, coins and stars, daily, gifts, shop, codex, boosters, big Play | **No** | – |
| **Callouts** | Dark box, capitalized sentence, "tap to hide" | White card, animated hand gesture, at most 6 words, material tiles | **Partly.** It's still a card over the board on first sight of a lesson | A one-time card is the clearest way to teach a new material in one line. The "once per level, skippable" rule comes from the session and is tested (`callout` card, hook check). Its look, length and teaching method all changed. |
| **Win screen structure** | Title, sentence, info box, three button styles | Ribbon, stamped stars, results card with reward, next-up tile, Continue + replay, daily | **No** | – |
| **"Next: level N" preview on win** | Yes | Yes, as a "Next up" row with the new material's tile | **Partly** | The prototype's own data showed it helps (the hook check "what is new next level"). The idea stays; the presentation is new. |
| **Lose screen** | "So close! 88%" text and an orange "Watch ad: …" button | Blue ribbon, animated progress ring, gift-first revive ("+5 Pieces · Watch an ad") | **Partly.** The words "So close! 88%" | Honest near-miss framing is motivating and was the prototype's best copy. Alternatives considered: "Almost!" and "Out of moves". Both say less, and neither shows the number. The words stay and everything around them changed. |
| **Ad placeholder** | Text over a visible win screen, stacked modals | Single polished card with a countdown ring, clearly labelled as a placeholder | **No** | – |
| **Controls** | Swipe, drag, flick, tap, swipe up | Same, plus a tap target for the power; render-side move tween | **Yes** (gestures) | Input is calibrated and tested by 36 browser checks (sloppy taps, diagonal swipes, flick timing). Changing gestures would cost players muscle memory for no visual gain. |
| **Opening flow** | Straight into level 1 | Straight into level 1 on first launch; the map for returning players | **Partly** | The instant hook is measured (first reaction at 7.2 s, 14/14 hook checks) and is a non-negotiable. |
| **Copy** | Spec-like sentences | Short verbs and numbers; a praise ladder | **No** | – |
| **Sound** | Oscillator beeps, no music | Mastered procedural sound with reverb and a compressor, signature sounds per reaction, generative music that builds with progress | **No** | – |
| **Name and brand** | "Material Blocks", no logo | **Tumbledown** wordmark and app icon | **No** | – |

**Summary.** Nothing visual survived by default. What's still similar is either a rule the brief protects (board size, controls, the instant hook) or an idea that already worked, now presented in a completely new way ("So close!", next-level preview, altitude).
